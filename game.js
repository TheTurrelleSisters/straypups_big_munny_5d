'use strict';
/**
 * game.js — The Turrelle Sisters Big Munny v10
 * ES5 rewrite v6l95 — removed class, const, let, arrow functions, for...of
 */

// ── RNG (crypto-backed, cryptographically secure) ────────────────────
function RNG() { this._buf = new Uint32Array(64); this._index = 64; }
RNG.prototype._refill = function() { crypto.getRandomValues(this._buf); this._index = 0; };
RNG.prototype.next    = function() { if (this._index >= this._buf.length) this._refill(); return this._buf[this._index++] / 0x100000000; };
RNG.prototype.nextInt = function(min, max) { return Math.floor(this.next() * (max - min + 1)) + min; };
RNG.prototype.chance  = function(p) { return this.next() < p; };
var rng = new RNG();

// ── CURRENT SPIN SERIAL ──────────────────────────────────────────────
var _currentSpinSerial = '';

function generateReelStops() {
  var forced = GameState.operator.forceReelStops;
  var anyForced = forced.some(function(s){ return s !== null && s !== undefined; });
  if (anyForced) GameState.operator._forcedSpin = true; // v8.1.58: exclude from RTP
  return REEL_STRIPS.map(function(strip, r) {
    if (forced[r] !== null && forced[r] !== undefined) {
      return Math.max(0, Math.min(strip.length - 1, forced[r]));
    }
    return rng.nextInt(0, strip.length - 1);
  });
}

function getVisibleSymbols(reelIndex, stopPosition) {
  var strip = REEL_STRIPS[reelIndex], len = strip.length;
  return [
    strip[(stopPosition - 1 + len) % len],
    strip[stopPosition],
    strip[(stopPosition + 1) % len],
  ];
}

function buildGrid(stops) {
  return stops.map(function(stop, r) { return getVisibleSymbols(r, stop); });
}

// ── WIN EVALUATION ───────────────────────────────────────────────────
function evaluateLine(lineSymbols, betPerLine) {
  var wildCount = 0, matchSymbol = null;
  for (var i = 0; i < lineSymbols.length; i++) {
    if (WILD_IDS.indexOf(lineSymbols[i]) >= 0) wildCount++;
    else { matchSymbol = lineSymbols[i]; break; }
  }
  // v8.1.38: All-wild line = $0 payline pay. Josie/Sasha are multiplier+JP triggers only.
  // Previously reassigned matchSymbol=JOSIE and paid 400cr — incorrect per owner 2026-05-29.
  if (matchSymbol === null) return { amount: 0 };

  var matchCount = wildCount, extraWilds = 0;
  for (var j = wildCount; j < lineSymbols.length; j++) {
    if (lineSymbols[j] === matchSymbol) matchCount++;
    else if (WILD_IDS.indexOf(lineSymbols[j]) >= 0) { matchCount++; extraWilds++; }
    else break;
  }

  if (matchCount < 2) return { amount: 0 };
  // evaluated normally. No special skip needed here.

  var symbolKey = null;
  var keys = Object.keys(SYMBOLS);
  for (var ki = 0; ki < keys.length; ki++) {
    if (SYMBOLS[keys[ki]].id === matchSymbol) { symbolKey = keys[ki]; break; }
  }
  if (!symbolKey || !PAY_TABLE[symbolKey]) return { amount: 0 };

  var pays     = PAY_TABLE[symbolKey];
  var payIndex = Math.max(0, 5 - matchCount);
  if (payIndex >= pays.length) return { amount: 0 };
  var basePay  = pays[payIndex];
  if (basePay === 0) return { amount: 0 };

  // v8.1.38 Wild multiplier — owner confirmed 2026-05-29.
  // Additive formula: mult = 1 + (josieCount × 2) + (sashaCount × 1). No cap.
  // Each Josie adds ×2, each Sasha adds ×1, stacked independently.
  // Examples: 1J=×3 | 1Sa=×2 | 1J+1Sa=×4 | 2J=×5 | 2J+1Sa=×6 | 3J=×7
  // All-wild line already returns {amount:0} above — multiplier only applies with base symbol present.
  // RULE: Applies to regular payline pays only. Jackpots always pay fixed seed regardless of wilds.
  var josieCount = 0, sashaCount = 0;
  for (var wi = 0; wi < matchCount; wi++) {
    if (lineSymbols[wi] === SYMBOLS.JOSIE.id) josieCount++;
    else if (lineSymbols[wi] === SYMBOLS.SASHA.id) sashaCount++;
  }
  var multiplier = 1 + (josieCount * 2) + (sashaCount * 1);
  if (multiplier < 1) multiplier = 1;

  // ── STRAYPUP 5OAK PROGRESSIVE TRIGGER ──────────────────────────────
  // All 5 Scott (StrayPup) symbols on a payline = progressive jackpot trigger.
  // Existing 5OAK base pay is STILL awarded (150 × betPerLine × multiplier).
  // Progressive pot pays ON TOP. isProgressiveHit flag signals executeSpin to act.
  // ────────────────────────────────────────────────────────────────────────────
  var isProgressiveHit = (symbolKey === 'STRAYPUP' && matchCount === 5);

  return {
    amount: basePay * betPerLine * multiplier,
    symbolKey: symbolKey, count: matchCount,
    wildCount: wildCount, multiplier: multiplier, basePay: basePay,
    isProgressiveHit: isProgressiveHit
  };
}

// ── BONUS LETTER EVALUATION ───────────────────────────────────────────
// Phase M rework 2026-05-16 — cherry-style, all 3 rows, consecutive from reel 1
function evaluateLetterPays(grid, betPerLine) {
  var totalAmount = 0, wins = [];
  for (var row = 0; row < 3; row++) {
    var count = 0;
    for (var col = 0; col < 5; col++) {
      if (grid[col][row] === LETTER_IDS[col]) count++;
      else break;
    }
    if (count >= 1) {
      var pay = (BONUS_LETTER_PAYS[count] || 0) * betPerLine;
      if (pay > 0) { totalAmount += pay; wins.push({ row: row, count: count, amount: pay }); }
    }
  }
  var best = wins.reduce(function(a, b) { return b.count > a.count ? b : a; }, { row: -1, count: 0, amount: 0 });
  return { amount: totalAmount, row: best.row, count: best.count, wins: wins };
}

// ── MIXED BAR EVALUATION ──────────────────────────────────────────────
// v8.1.44: Mixed bar evaluation — owner confirmed 2026-05-29.
// Rules:
//   - Consecutive run from left of any BAR_IDS or WILD_IDS symbols
//   - Must contain 2+ DISTINCT bar types (not counting wilds) to qualify as mixed
//   - Must contain at least 1 actual bar symbol (not all-wild)
//   - Wild multiplier applies: mult = 1 + (josieCount×2) + (sashaCount×1)
//   - Pure single-bar-type runs (even with wilds) are handled by evaluateLine — not here
function evaluateMixedBars(grid, activeLinesCount, betPerLine) {
  var wins = [];
  var activeLines = PAYLINES.slice(0, activeLinesCount);
  activeLines.forEach(function(line, lineIndex) {
    var lineSyms = line.map(function(row, col) { return grid[col][row]; });

    // Count consecutive bars or wilds from left
    var count = 0, josie = 0, sasha = 0, hasBar = false;
    var barTypes = {};
    for (var i = 0; i < 5; i++) {
      var s = lineSyms[i];
      if (BAR_IDS.indexOf(s) >= 0) {
        count++; hasBar = true; barTypes[s] = true;
      } else if (WILD_IDS.indexOf(s) >= 0) {
        count++;
        if (s === SYMBOLS.JOSIE.id) josie++;
        else if (s === SYMBOLS.SASHA.id) sasha++;
      } else {
        break; // consecutive run ends
      }
    }

    // Must have 3+ symbols, at least 1 bar
    if (count < 3 || !hasBar) return;

    // Must have 2+ distinct bar types to be MIXED (otherwise evaluateLine handles it)
    var distinctBars = Object.keys(barTypes).length;
    if (distinctBars < 2) return;

    var cr = MIXED_BAR_PAY[count] || 0;
    if (!cr) return;

    var mult = 1 + (josie * 2) + (sasha * 1);
    wins.push({
      lineIndex: lineIndex, line: line,
      lineName: (typeof PAYLINE_NAMES !== 'undefined' && PAYLINE_NAMES[lineIndex]) ? PAYLINE_NAMES[lineIndex] : ('Line ' + (lineIndex + 1)),
      amount: cr * betPerLine * mult,
      symbolKey: 'MIXED_BAR', count: count, isMixedBar: true,
      multiplier: mult,
    });
  });
  return wins;
}

function evaluateSpin(grid, activeLinesCount, betPerLine) {
  var result = {
    paylineWins: [], scatterCount: 0,
    totalWin: 0, triggerPickChoose: false,
    lipstickCount: 0, scatterTriggered: false,
  };

  var lipstickCount = 0;
  for (var gc = 0; gc < grid.length; gc++) {
    for (var gr = 0; gr < grid[gc].length; gr++) {
      if (grid[gc][gr] === BONUS_PC_ID) lipstickCount++;
    }
  }
  result.lipstickCount = lipstickCount;
  result.scatterCount  = lipstickCount;

  var activeLines = PAYLINES.slice(0, activeLinesCount);
  activeLines.forEach(function(line, lineIndex) {
    var lineSymbols = line.map(function(row, col) { return grid[col][row]; });
    var win = evaluateLine(lineSymbols, betPerLine);
    if (win.amount > 0) {
      result.paylineWins.push({
        lineIndex: lineIndex, line: line,
        lineName: (typeof PAYLINE_NAMES !== 'undefined' && PAYLINE_NAMES[lineIndex]) ? PAYLINE_NAMES[lineIndex] : ('Line ' + (lineIndex + 1)),
        amount: win.amount, count: win.count, symbolKey: win.symbolKey,
      });
      result.totalWin += win.amount;
    }
    if (lineIndex === 0 && lineSymbols.every(function(id) { return id === BONUS_PC_ID; })) {
      result.scatterTriggered = true;
    }
  });

  var mixedBarWins = evaluateMixedBars(grid, activeLinesCount, betPerLine);
  mixedBarWins.forEach(function(win) { result.paylineWins.push(win); result.totalWin += win.amount; });

  var letterResult = evaluateLetterPays(grid, betPerLine);
  if (letterResult.amount > 0) {
    result.bonusLetterWin   = letterResult.amount;
    result.bonusLetterRow   = letterResult.row;
    result.bonusLetterWins  = letterResult.wins;
    result.bonusLetterCount = letterResult.count;
    result.totalWin += letterResult.amount;
    var rowToPaylineIndex = { 0: 1, 1: 0, 2: 2 };
    if (letterResult.wins) {
      letterResult.wins.forEach(function(w) {
        var plIdx = rowToPaylineIndex[w.row];
        var line  = PAYLINES[plIdx] || [w.row, w.row, w.row, w.row, w.row];
        result.paylineWins.push({ lineIndex: plIdx, line: line, lineName: 'BONUS ' + w.count + ' (' + ('Row ' + (w.row + 1)) + ')', amount: w.amount, count: w.count, symbolKey: 'BONUS_LETTER', isLetter: true, letterRow: w.row });
      });
    }
  }

  var bottomRowBonus =
    grid[0][2] === LETTER_IDS[0] && grid[1][2] === LETTER_IDS[1] &&
    grid[2][2] === LETTER_IDS[2] && grid[3][2] === LETTER_IDS[3] &&
    grid[4][2] === LETTER_IDS[4];
  if (bottomRowBonus) {
    result.triggerBonusFeature = true;
    if (result.bonusLetterWins) {
      var bottomRowWin = null;
      for (var bwi = 0; bwi < result.bonusLetterWins.length; bwi++) {
        if (result.bonusLetterWins[bwi].row === 2 && result.bonusLetterWins[bwi].count === 5) { bottomRowWin = result.bonusLetterWins[bwi]; break; }
      }
      if (bottomRowWin) { result.totalWin -= bottomRowWin.amount; result.bonusLetterWin -= bottomRowWin.amount; }
    }
  }

  if (result.scatterTriggered) { result.triggerPickChoose = true; result.scatterWin = 0; }
  if (GameState.operator.maxWinPerSpin > 0) result.totalWin = Math.min(result.totalWin, GameState.operator.maxWinPerSpin);
  return result;
}

// ── JACKPOT CHECKS ───────────────────────────────────────────────────
// DEPRECATED v6l99: checkJackpot/processJackpotCheck were per-spin odds (JACKPOT_ODDS).
// Replaced by _checkUnifiedJackpot() in bonuses.js. Kept only for operator force-jackpot tool.
function checkJackpot(context) {
  if (GameState.operator.forceJackpot !== 'none') {
    var jpCtx = GameState.operator.forceJackpotContext || 'bonus';
    var isBaseCheck = context === 'BASE_GAME';
    if (jpCtx === 'any' || (jpCtx === 'base' && isBaseCheck) || (jpCtx === 'bonus' && !isBaseCheck)) {
      var type = GameState.operator.forceJackpot;
      GameState.operator.forceJackpot = 'none';
      GameState.operator._forcedSpin = true; // v8.1.58: exclude from RTP
      return { type: type, context: context, forced: true };
    }
  }
  var roll = rng.next();
  if (roll < JACKPOT_ODDS.GRAND) return { type: 'GRAND', context: context };
  if (roll < JACKPOT_ODDS.MAJOR) return { type: 'MAJOR', context: context };
  if (roll < JACKPOT_ODDS.MINOR) return { type: 'MINOR', context: context };
  if (roll < JACKPOT_ODDS.MINI)  return { type: 'MINI',  context: context };
  return null;
}

async function processJackpotCheck(context) {
  var result = checkJackpot(context);
  if (!result) return null;
  var amount = awardJackpot(result.type);
  logEvent('JACKPOT_HIT', { bonusType:'JACKPOT', jackpotType:result.type, amount:amount, context:context, serialNumber:_currentSpinSerial, balanceAfter:GameState.balance });
  if (typeof UI !== 'undefined') await UI.showJackpotCelebration(result.type, amount, context);
  return { type: result.type, amount: amount };
}

function checkCharacterJackpots(grid, activeLinesCount) {
  var activeLines = PAYLINES.slice(0, activeLinesCount);
  var highestTier = null;
  var tierOrder   = ['MINI', 'MINOR', 'MAJOR', 'GRAND'];

  for (var li = 0; li < activeLines.length; li++) {
    var line = activeLines[li];
    var syms = line.map(function(row, col) { return grid[col][row]; });
    // BONUS_ID skip removed v8.0 — Dollar Bills (id:9) is now a standard symbol, not a bonus trigger

    var lineTier = null;
    if (syms.every(function(id) { return id === SYMBOLS.SISTERS.id; })) {
      lineTier = 'GRAND';
    } else if (syms.every(function(id) { return WILD_IDS.indexOf(id) >= 0; })) {
      // v8.1.38: All-wild center line JP hierarchy — owner confirmed 2026-05-29.
      // 5× Josie only = MINOR | 5× Sasha only = MINI | mixed Josie+Sasha = MAJOR
      // Order matters: check pure Josie and pure Sasha before falling through to MAJOR.
      var allJosie = syms.every(function(id) { return id === SYMBOLS.JOSIE.id; });
      var allSasha = syms.every(function(id) { return id === SYMBOLS.SASHA.id; });
      if (
        line[0] === 1 && line[1] === 1 && line[2] === 1 && line[3] === 1 && line[4] === 1 &&
        allJosie
      ) {
        lineTier = 'MINOR'; // 5× Josie pure, center line only
      } else if (
        line[0] === 1 && line[1] === 1 && line[2] === 1 && line[3] === 1 && line[4] === 1 &&
        allSasha
      ) {
        lineTier = 'MINI';  // 5× Sasha pure, center line only
      } else {
        lineTier = 'MAJOR'; // mixed Josie+Sasha (any 5 wilds, any payline) — owner confirmed 2026-05-29
      }
    }

    if (lineTier !== null) {
      if (highestTier === null || tierOrder.indexOf(lineTier) > tierOrder.indexOf(highestTier)) {
        highestTier = lineTier;
      }
    }
  }
  return highestTier ? [highestTier] : [];
}

async function processCharacterJackpots(grid, activeLinesCount, context) {
  var hits  = checkCharacterJackpots(grid, activeLinesCount);
  var totalAwarded = 0;
  var order = ['MINI','MINOR','MAJOR','GRAND'];
  var validHits = order.filter(function(k) { return hits.indexOf(k) >= 0; });
  if (validHits.length > 0) {
    var key    = validHits[validHits.length - 1];
    var amount = awardJackpot(key);
    totalAwarded = amount;
    logEvent('JACKPOT_HIT', { bonusType:'JACKPOT', jackpotType:key, trigger:'CHARACTER_SYMBOL', amount:amount, context:context, serialNumber:_currentSpinSerial, balanceAfter:GameState.balance });
    if (typeof UI !== 'undefined') await UI.showJackpotCelebration(key, amount, context);
  }
  return { hits: validHits, totalAwarded: totalAwarded };
}

// buildRedSpinGrid() removed v6l99 — dead code, not called anywhere.

// ── v8.1.27: UNIFIED BONUS TRIGGER SYSTEM ────────────────────────────────────
// Owner confirmed 2026-05-28. Replaced three separate trigger checks.
// v8.1.57 UPDATE (owner confirmed): Split gate — Red Spin fires on winning spins only.
//   Pick & Choose and Bonus Orb fire on ANY spin (independent of win).
//   Each bonus uses UNIFIED_BONUS_FREQ/3 so total bonus frequency is unchanged.
// This function is kept for reference but the split logic is now inline in executeSpin.
// Operator force controls (forceRedSpin, forceFreeSpins, forceBonusFeature) bypass all gating.
function checkUnifiedBonusTrigger() {
  // NOTE v8.1.57: This function is no longer called from executeSpin.
  // Logic moved inline for split gate control. Kept to avoid breaking any external reference.
  var freq = (typeof UNIFIED_BONUS_FREQ !== 'undefined' ? UNIFIED_BONUS_FREQ : 0.08)
           * GameState.operator.bonusFrequencyMultiplier;
  if (!rng.chance(freq)) return null;
  var roll = rng.next();
  var split = typeof UNIFIED_BONUS_SPLIT !== 'undefined' ? UNIFIED_BONUS_SPLIT : 0.3333;
  if (roll < split)        return 'RED_SPIN';
  if (roll < split * 2)    return 'PICK_CHOOSE';
  return 'BONUS_ORB';
}

// ── QUEUED SPIN ───────────────────────────────────────────────────────
var _nextSpinQueued = false, _nextSpinBet = null, _nextSpinLines = null;

function queueNextSpin(betPerLine, linesActive) {
  if (GameState.activeBonus) return;
  _nextSpinQueued = true; _nextSpinBet = betPerLine; _nextSpinLines = linesActive;
}
function clearQueuedSpin() { _nextSpinQueued = false; _nextSpinBet = null; _nextSpinLines = null; }

// ── SKIP PAYLINES ─────────────────────────────────────────────────────
var _skipPaylineAnimations = false;
function setSkipPaylineAnimations(val) { _skipPaylineAnimations = val; }
function getSkipPaylineAnimations()    { return _skipPaylineAnimations; }

// ── MAIN SPIN HANDLER ────────────────────────────────────────────────
async function executeSpin(betPerLine, linesActive, denom, creditsPerLine) {
  if (GameState.spinInProgress) return;
  var _denom   = (denom   != null) ? denom   : (GameState.lastDenom          != null ? GameState.lastDenom          : 0.05);
  var _credits = (creditsPerLine != null) ? creditsPerLine : (GameState.lastCreditsPerLine != null ? GameState.lastCreditsPerLine : 1);
  var totalBet = betPerLine * linesActive;
  if (GameState.balance < totalBet) {
    if (typeof UI !== 'undefined') UI.showMessage('Insufficient balance'); return;
  }

  _currentSpinSerial   = generateSerialNumber();
  GameState.spinInProgress = true;
  _skipPaylineAnimations   = false;
  // BUG-WIRE-2 FIX (v8.1.16): Clear INSERT CASH ticker as soon as spin begins.
  if (typeof UI !== 'undefined' && UI.stopInsertCashTicker) UI.stopInsertCashTicker();
  // SAFETY: spinInProgress must always be cleared even if an uncaught error occurs.
  // All code below is wrapped in the function body — if it throws, the caller's
  // .catch() or unhandledrejection should call UI.setControlsEnabled(true).
  // The per-bonus try/catch blocks already handle individual bonus errors.
  GameState.balance       -= totalBet;
  GameState.lastBet        = betPerLine;
  GameState.lastLines      = linesActive;
  if (denom)          GameState.lastDenom          = _denom;
  if (creditsPerLine) GameState.lastCreditsPerLine = _credits;

  contributeToJackpots(totalBet);
  var _tsForceArmed = false;
  if (typeof Progressive !== 'undefined') {
    _tsForceArmed = Progressive.contribute(totalBet);
  }
  startGameRecord({ perLine: betPerLine, lines: linesActive, total: totalBet });
  logEvent('SPIN_START', { bet: { perLine: betPerLine, lines: linesActive, total: totalBet }, serialNumber: _currentSpinSerial, balanceBefore: GameState.balance + totalBet });

  if (typeof UI !== 'undefined') UI.onSpinStart();
  if (typeof Audio !== 'undefined') Audio.play('spin');

  var stops  = generateReelStops();
  GameState.operator.forceReelStops = [null, null, null, null, null];
  var grid   = buildGrid(stops);
  var result = evaluateSpin(grid, linesActive, betPerLine);

  if (GameState.eventLog.currentGame) {
    GameState.eventLog.currentGame.reelStops    = stops;
    GameState.eventLog.currentGame.grid         = grid;
    GameState.eventLog.currentGame.serialNumber = _currentSpinSerial;
    GameState.eventLog.currentGame.baseResult   = { wins: result.paylineWins, scatterCount: result.scatterCount, totalWin: result.totalWin }; // bonusCount removed v8.1.1
  }

  // Force controls handled in unified trigger block above (v8.1.27)
  if (GameState.operator.forceJackpot !== 'none' &&
      (GameState.operator.forceJackpotContext === 'base' || GameState.operator.forceJackpotContext === 'any')) {
    var fjType = GameState.operator.forceJackpot;
    GameState.operator.forceJackpot = 'none';
    var activeLines2 = PAYLINES.slice(0, linesActive);
    var randomLine   = activeLines2[Math.floor(Math.random() * activeLines2.length)];
    var fjRow        = randomLine[2];
    if (fjType === 'MINI')  { for (var fc = 0; fc < 5; fc++) grid[fc][fjRow] = fc < 3 ? SYMBOLS.SASHA.id : SYMBOLS.LIPSTICK.id; }
    else if (fjType === 'MINOR') { for (var fc = 0; fc < 5; fc++) grid[fc][fjRow] = fc < 3 ? SYMBOLS.JOSIE.id : SYMBOLS.LIPSTICK.id; }
    else if (fjType === 'MAJOR') { for (var fc = 0; fc < 5; fc++) grid[fc][fjRow] = rng.chance(0.5) ? SYMBOLS.JOSIE.id : SYMBOLS.SASHA.id; }
    else if (fjType === 'GRAND') { for (var fc = 0; fc < 5; fc++) grid[fc][fjRow] = SYMBOLS.SISTERS.id; }
    var newResult = evaluateSpin(grid, linesActive, betPerLine);
    result.paylineWins = newResult.paylineWins; result.totalWin = newResult.totalWin;
    result.scatterCount = newResult.scatterCount;
    result.triggerPickChoose = false; result.triggerBonusFeature = false;
  }

  // ── v8.1.28: UNIFIED BONUS DECISION + SYMBOL PLACEMENT (before animation) ──
  // Owner reported 2026-05-28: bonus symbols never displayed because placement
  // ── v8.1.57 BONUS TRIGGER — split gate per bonus type ────────────────
  // Owner confirmed: Red Spin fires only on winning spins.
  //                  Pick & Choose and Bonus Orb fire independently (any spin).
  // Each bonus uses 1/3 of UNIFIED_BONUS_FREQ so total bonus frequency is unchanged.
  var _unifiedBonus = null; // 'RED_SPIN' | 'PICK_CHOOSE' | 'BONUS_ORB' | null
  var _isWinningSpin = (result.totalWin > 0);
  var _bonusFreqBase = (typeof UNIFIED_BONUS_FREQ !== 'undefined' ? UNIFIED_BONUS_FREQ : 0.08)
                     * GameState.operator.bonusFrequencyMultiplier;
  var _perBonusFreq = _bonusFreqBase / 3; // equal split across three bonuses

  if (GameState.operator.forceRedSpin) {
    GameState.operator.forceRedSpin = false;
    GameState.operator._forcedSpin = true; // v8.1.58: exclude from RTP
    _unifiedBonus = 'RED_SPIN';
  } else if (GameState.operator.forceFreeSpins) {
    GameState.operator.forceFreeSpins = false;
    GameState.operator._forcedSpin = true;
    _unifiedBonus = 'PICK_CHOOSE';
  } else if (GameState.operator.forceBonusFeature) {
    GameState.operator.forceBonusFeature = false;
    GameState.operator._forcedSpin = true;
    _unifiedBonus = 'BONUS_ORB';
  } else {
    // Red Spin: winning spins only
    if (_isWinningSpin && rng.chance(_perBonusFreq)) {
      _unifiedBonus = 'RED_SPIN';
    }
    // Pick & Choose: any spin (independent of winning)
    if (!_unifiedBonus && rng.chance(_perBonusFreq)) {
      _unifiedBonus = 'PICK_CHOOSE';
    }
    // Bonus Orb: any spin (independent of winning)
    if (!_unifiedBonus && rng.chance(_perBonusFreq)) {
      _unifiedBonus = 'BONUS_ORB';
    }
  }

  if (_unifiedBonus === 'PICK_CHOOSE') {
    var _pcLine = PAYLINES[0];
    for (var _pcC = 0; _pcC < 5; _pcC++) grid[_pcC][_pcLine[_pcC]] = BONUS_PC_ID;
    result.triggerPickChoose = true; result.scatterTriggered = true; result.scatterCount = 5;
    result.triggerBonusFeature = false;
  } else if (_unifiedBonus === 'BONUS_ORB') {
    var _orbR = 2;
    var _neutrals = [SYMBOLS.SEVEN.id, SYMBOLS.TRIPLE_BAR.id, SYMBOLS.DIAMOND.id, SYMBOLS.DOUBLE_BAR.id];
    for (var _orbC = 0; _orbC < 5; _orbC++) {
      for (var _orbRr = 0; _orbRr < 3; _orbRr++) {
        if (_orbRr !== _orbR && grid[_orbC][_orbRr] === LETTER_IDS[_orbC]) {
          grid[_orbC][_orbRr] = _neutrals[Math.floor(rng.next() * _neutrals.length)];
        }
      }
      grid[_orbC][_orbR] = LETTER_IDS[_orbC];
    }
    result.triggerBonusFeature = true; result.bonusLetterCount = 5; result.bonusLetterRow = _orbR;
    result.triggerPickChoose = false;
  } else if (_unifiedBonus === 'RED_SPIN') {
    // FIX (v8.1.36): Place a real winning combo on the base reels so the player
    // sees a payline win at the moment Red Spin triggers — exactly as the architecture
    // comment in bonuses.js specifies ("RNG constrained: each spin must produce a REAL
    // combination"). Without this, forceRedSpin left the grid as a random (often losing)
    // spin. Mirrors the same placement pattern used by PICK_CHOOSE and BONUS_ORB.
    // Choose a random active payline (not payline 0 — that is reserved for Lipstick/P&C).
    var _rsLines = PAYLINES.slice(1, linesActive); // skip L1 (Lipstick line)
    if (!_rsLines.length) _rsLines = PAYLINES.slice(0, linesActive);
    var _rsLine = _rsLines[Math.floor(rng.next() * _rsLines.length)];
    // Place 3-oak Triple Bar (safe mid-pay symbol — no wild/jackpot/scatter side-effects)
    for (var _rsC = 0; _rsC < 5; _rsC++) {
      grid[_rsC][_rsLine[_rsC]] = (_rsC < 3) ? SYMBOLS.TRIPLE_BAR.id : SYMBOLS.SEVEN.id;
    }
    var _rsReResult = evaluateSpin(grid, linesActive, betPerLine);
    result.paylineWins       = _rsReResult.paylineWins;
    result.totalWin          = _rsReResult.totalWin;
    result.scatterCount      = _rsReResult.scatterCount;
    result.triggerPickChoose = false; result.triggerBonusFeature = false;
  } else {
    // No unified bonus — natural reel triggers remain as secondary path.
    if (result.scatterTriggered) result.triggerPickChoose = true;
  }
  // Re-evaluate grid after placement so payline wins reflect the placed symbols.
  if (_unifiedBonus === 'PICK_CHOOSE' || _unifiedBonus === 'BONUS_ORB') {
    var _reResult = evaluateSpin(grid, linesActive, betPerLine);
    result.paylineWins = _reResult.paylineWins;
    result.totalWin    = _reResult.totalWin;
    result.scatterCount = _reResult.scatterCount;
  }

  if (typeof UI !== 'undefined') await UI.animateReelsStop(stops, grid);

  var charJackpots = await processCharacterJackpots(grid, linesActive, 'BASE_GAME');
  var totalWon = result.totalWin + (charJackpots ? charJackpots.totalAwarded || 0 : 0);
  var redSpinTriggeredEarly = (_unifiedBonus === 'RED_SPIN');

  if (result.totalWin > 0 && typeof Audio !== 'undefined') {
    Audio.play(result.totalWin > totalBet * 10 ? 'win_big' : 'win_small');
    Audio.playBellsForWin(result.totalWin, betPerLine);
  }

  // ── PROGRESSIVE JACKPOT CHECK — STRAYPUP 5OAK ────────────────────────
  var _progHit = false;
  for (var _pwi = 0; _pwi < result.paylineWins.length; _pwi++) {
    if (result.paylineWins[_pwi].isProgressiveHit) { _progHit = true; break; }
  }
  if (_progHit && typeof Progressive !== 'undefined') {
    var _progAmt = Progressive.hit({
      pattern: 'Scott 5OAK',
      balls:   0,
      bet:     totalBet
    });
    // Award progressive on top of existing base pay
    GameState.balance += _progAmt;
    result.totalWin   += _progAmt;
    result.progressiveHit      = true;
    result.progressiveHitAmt   = _progAmt;
  }
  // ── END PROGRESSIVE CHECK ─────────────────────────────────────────────

  // ── FORCE JACKPOT CHECK — Turrelle Sisters ───────────────────────────
  // If operator armed a force jackpot, claim it and force STRAYPUP 5OAK.
  if (_tsForceArmed && typeof Progressive !== 'undefined' && !result.progressiveHit) {
    Progressive.claimForce(function(didWin, forceAmt) {
      if (!didWin) return;
      // Credit the force amount and show win celebration
      GameState.balance += forceAmt;
      result.progressiveHit    = true;
      result.progressiveHitAmt = forceAmt;
      result.forceJackpot      = true;
      if (typeof UI !== 'undefined') UI.updateBalance(GameState.balance);
    });
  }
  // ── END FORCE JACKPOT CHECK ────────────────────────────────────────────

  if (result.paylineWins.length > 0 || result.scatterWin) {
    if (!_skipPaylineAnimations) {
      var _fastWin = !!(redSpinTriggeredEarly || result.triggerBonusFeature);
      if (typeof UI !== 'undefined') await UI.showBaseWins(result, betPerLine, linesActive, false, _fastWin);
    }
  }

  // BUG-WIRE-1 FIX (v8.1.16): Flash individual BONUS letter cells gold when partial letter sequences pay.
  // UI.showBonusLetterWin was coded and exported but never called — letter pay cells never flashed.
  // Loop through all winning rows (multiple rows can pay independently).
  if (result.bonusLetterWins && result.bonusLetterWins.length > 0 && typeof UI !== 'undefined') {
    for (var blwi = 0; blwi < result.bonusLetterWins.length; blwi++) {
      var blw = result.bonusLetterWins[blwi];
      UI.showBonusLetterWin(blw.count, blw.amount, blw.row);
    }
  }

  GameState.balance += result.totalWin;
  if (typeof UI !== 'undefined') {
    UI.updateBalance(GameState.balance);
    if (result.totalWin > 0) UI.updateWinDisplay(result.totalWin);
  }

  // ── PROGRESSIVE HIT CELEBRATION — Scott 5OAK ─────────────────────────
  if (result.progressiveHit && result.progressiveHitAmt) {
    // Use existing jackpot overlay with custom messaging
    var _jpOv  = document.getElementById('jackpot-overlay');
    var _jpTyp = document.getElementById('jackpot-type-text');
    var _jpAmt = document.getElementById('jackpot-amount-text');
    var _jpCtx = document.getElementById('jackpot-context-text');
    var _jpHnt = document.getElementById('jackpot-tap-hint');
    if (_jpOv && _jpTyp && _jpAmt) {
      _jpTyp.textContent = 'PROGRESSIVE JACKPOT!';
      _jpAmt.textContent = '$' + result.progressiveHitAmt.toFixed(2);
      if (_jpCtx) _jpCtx.textContent = 'SCOTT 5 OF A KIND — BASE PAY + PROGRESSIVE POT!';
      if (_jpHnt) _jpHnt.textContent = 'TAP TO CONTINUE';
      _jpOv.style.display = 'flex';
      _jpOv.onclick = function() { _jpOv.style.display = 'none'; _jpOv.onclick = null; };
      _jpOv.ontouchend = function(e) { e.preventDefault(); _jpOv.style.display = 'none'; _jpOv.ontouchend = null; };
    }
    // Update the progressive tile display immediately
    var _ptEl = document.getElementById('ts-prog-val');
    if (_ptEl && typeof Progressive !== 'undefined') _ptEl.textContent = Progressive.getDisplay();
  }
  // ── END PROGRESSIVE CELEBRATION ──────────────────────────────────────

  if (redSpinTriggeredEarly) {
    if (typeof Audio !== 'undefined') {
      Audio.play('red_spin_entry');
      // BUG-RS-AUDIO FIX (v8.1.17): Start music here, close to the user gesture.
      // Calling only from runRedSpin() in bonuses.js put el.play() too deep in the
      // async chain — silently rejected on Samsung Browser / iOS. The bonuses.js call
      // remains as a no-op fallback (startRedSpinMusic guards with if (redLoop) return).
      Audio.startRedSpinMusic();
    }
    if (typeof UI !== 'undefined') UI.activateRedScreen();
  }

  logEvent(result.totalWin > 0 ? 'BASE_WIN' : 'BASE_LOSS', {
    bet: { perLine: betPerLine, lines: linesActive, total: totalBet },
    serialNumber: _currentSpinSerial, reelStops: stops, grid: grid, wins: result.paylineWins,
    scatterCount: result.scatterCount, totalWin: result.totalWin,
    netResult: result.totalWin - totalBet,
    balanceBefore: GameState.balance - result.totalWin + totalBet, balanceAfter: GameState.balance,
  });

  if (typeof UI !== 'undefined') { UI.updateBalance(GameState.balance); UI.updateWinDisplay(result.totalWin); }
  _skipPaylineAnimations = false;
  var currentContext = { base_game: true, red_spin: false, pick_choose: false };

  if (result.triggerPickChoose || result.triggerBonusFeature) {
    if (typeof clearQueuedSpin !== 'undefined') clearQueuedSpin();
  }
  if (redSpinTriggeredEarly) {
    result.triggerPickChoose = false; result.triggerBonusFeature = false;
  }

  if (result.triggerBonusFeature) {
    result.triggerPickChoose = false;
    GameState.stats.bonusFeatureCount = (GameState.stats.bonusFeatureCount || 0) + 1;
    logEvent('BONUS_TRIGGER', { bonusType: 'BONUS_FEATURE', context: 'base_game', serialNumber: _currentSpinSerial });
    if (typeof Audio !== 'undefined') Audio.play('bonus_trigger');
    var bonusResult = { totalWon: 0, awardPickChoose: false, awardRedSpin: false };
    try {
      bonusResult = await Bonuses.runBonusFeature(betPerLine, linesActive, { base_game: currentContext.base_game, red_spin: currentContext.red_spin, pick_choose: currentContext.pick_choose });
    } catch(bfErr) {
      console.error('BONUS Feature error:', bfErr);
      GameState.activeBonus = null;
      if (typeof UI !== 'undefined') { UI.setControlsEnabled(true); UI.showToast('Bonus error — please spin again'); }
    }
    totalWon += bonusResult.totalWon;
    if (bonusResult.awardRedSpin)    result.triggerRedSpin   = true;
    if (bonusResult.awardPickChoose) result.triggerPickChoose = true;
  }

  if (result.triggerPickChoose && !redSpinTriggeredEarly) {
    GameState.stats.pickChooseCount++;
    logEvent('BONUS_TRIGGER', { bonusType: 'PICK_CHOOSE', context: 'base_game', serialNumber: _currentSpinSerial });
    if (typeof Audio !== 'undefined') Audio.play('pick_trigger');
    var pcContext  = { base_game: currentContext.base_game, red_spin: currentContext.red_spin, pick_choose: currentContext.pick_choose, triggerStops: stops, triggerGrid: grid };
    // v8.1.31: wrapped in try/catch (was unprotected — a throw here froze the whole spin
    // with controls locked and spinInProgress stuck true). Logs to console AND recovers state.
    var pickResult = { totalWon: 0, awardRedSpin: false, events: [], outcome: null };
    try {
      pickResult = await Bonuses.runPickChoose(betPerLine, linesActive, pcContext);
    } catch(pcErr) {
      console.error('[P&C] Pick & Choose threw:', pcErr && pcErr.message ? pcErr.message : pcErr);
      console.error('[P&C] Stack:', pcErr && pcErr.stack ? pcErr.stack : 'no stack');
      GameState.activeBonus = null;
      if (typeof UI !== 'undefined') { UI.setControlsEnabled(true); UI.showToast('Bonus error — please spin again'); }
    }
    totalWon += pickResult.totalWon;
    if (GameState.eventLog.currentGame) {
      GameState.eventLog.currentGame.bonuses.push({ type: 'PICK_CHOOSE', triggeredAt: 'base_game', events: pickResult.events, outcome: pickResult.outcome });
    }
    if (pickResult.awardRedSpin) result.triggerRedSpin = true;
  }

  var redSpinTriggered = result.triggerRedSpin || redSpinTriggeredEarly;
  if (redSpinTriggered) {
    clearQueuedSpin();
    GameState.stats.redSpinCount++;
    logEvent('BONUS_TRIGGER', { bonusType: 'RED_SPIN', context: 'base_game', serialNumber: _currentSpinSerial });
    var redResult = { totalWon: 0, events: [], outcome: null };
    try {
      var rsContext = { base_game: currentContext.base_game, red_spin: currentContext.red_spin, pick_choose: currentContext.pick_choose, prevWin: result.totalWin };
      redResult = await Bonuses.runRedSpin(betPerLine, linesActive, rsContext);
    } catch(rsErr) {
      // Log the actual error — critical for debugging
      console.error('[RS] Red Spin threw:', rsErr && rsErr.message ? rsErr.message : rsErr);
      console.error('[RS] Stack:', rsErr && rsErr.stack ? rsErr.stack : 'no stack');
      GameState.activeBonus = null;
      GameState.spinInProgress = false;
      if (typeof UI !== 'undefined') {
        UI.endRedSpinImmediate();
        UI.deactivateRedScreen();
        UI.setControlsEnabled(true);
        // Only show toast if controls were actually locked (real error, not cleanup race)
        if (redResult.totalWon === 0) UI.showToast('Red Spin ended');
      }
    }
    totalWon += redResult.totalWon;
    if (GameState.eventLog.currentGame) {
      GameState.eventLog.currentGame.bonuses.push({ type: 'RED_SPIN', triggeredAt: 'base_game', events: redResult.events, outcome: redResult.outcome });
    }
    clearQueuedSpin();
    if (typeof UI !== 'undefined') { UI.endRedSpinImmediate(); UI.deactivateRedScreen(); }

    // ── Additional RS rounds ─────────────────────────────────────────────
    // No automatic chain. After RS ends, player returns to base game.
    // If they spin and land a winning combination, natural RS trigger applies.
    // (Owner confirmed v6l97 — additional RS via natural base game trigger only)
  }

  // ── COMBO CHAIN (v8.1.36): Fire remaining combo bonuses sequentially after primary ──
  // armCombo() sets forceRedSpin + forceFreeSpins + forceBonusFeature simultaneously.
  // The if/else if force check above fires only the FIRST (forceRedSpin wins).
  // When comboArmed=true, the remaining combo types now fire here in order.
  // Each bonus runs to completion before the next starts — player sees full sequence.
  var _cm = GameState.operator.comboModes || {};
  if (GameState.operator.comboArmed) {
    // P&C combo — fires if pick_choose was selected AND P&C wasn't already the primary bonus
    if (_cm.pick_choose && !result.triggerPickChoose && !redSpinTriggeredEarly) {
      GameState.operator.forceFreeSpins = false; // consume flag
      GameState.stats.pickChooseCount++;
      logEvent('BONUS_TRIGGER', { bonusType:'PICK_CHOOSE', context:'combo_chain', serialNumber:_currentSpinSerial });
      var _cpcContext = { base_game:true, red_spin:false, pick_choose:false, triggerStops:stops, triggerGrid:grid };
      // Place Lipstick on center payline so player sees the P&C trigger visual
      var _cpcLine = PAYLINES[0];
      for (var _cpcC = 0; _cpcC < 5; _cpcC++) grid[_cpcC][_cpcLine[_cpcC]] = BONUS_PC_ID;
      if (typeof UI !== 'undefined') await UI.animateReelsStop(stops, grid);
      var _cpcResult = { totalWon:0, awardRedSpin:false, events:[], outcome:null };
      try {
        _cpcResult = await Bonuses.runPickChoose(betPerLine, linesActive, _cpcContext);
      } catch(_cpcErr) {
        console.error('[COMBO P&C] threw:', _cpcErr && _cpcErr.message ? _cpcErr.message : _cpcErr);
        GameState.activeBonus = null;
      }
      totalWon += _cpcResult.totalWon;
      if (GameState.eventLog.currentGame) {
        GameState.eventLog.currentGame.bonuses.push({ type:'PICK_CHOOSE', triggeredAt:'combo_chain', events:_cpcResult.events, outcome:_cpcResult.outcome });
      }
    }
    // Bonus Letters combo — fires if bonus_letters was selected AND letters weren't already the primary
    if (_cm.bonus_letters && !result.triggerBonusFeature) {
      GameState.operator.forceBonusFeature = false; // consume flag
      logEvent('BONUS_TRIGGER', { bonusType:'BONUS_ORB', context:'combo_chain', serialNumber:_currentSpinSerial });
      // Place B-O-N-U-S letters on the center row so player sees the orb trigger visual
      var _cbRow = 2;
      for (var _cbC = 0; _cbC < 5; _cbC++) grid[_cbC][_cbRow] = LETTER_IDS[_cbC];
      if (typeof UI !== 'undefined') await UI.animateReelsStop(stops, grid);
      var _cbResult = { totalWon:0, awardRedSpin:false, awardPickChoose:false, events:[], outcome:null };
      try {
        _cbResult = await Bonuses.runBonusFeature(betPerLine, linesActive, { base_game:true, red_spin:false, pick_choose:false });
      } catch(_cbErr) {
        console.error('[COMBO BONUS] threw:', _cbErr && _cbErr.message ? _cbErr.message : _cbErr);
        GameState.activeBonus = null;
      }
      totalWon += _cbResult.totalWon;
      // Sub-bonuses from orb
      if (_cbResult.awardPickChoose) {
        var _cbPcR = { totalWon:0, events:[], outcome:null };
        try { _cbPcR = await Bonuses.runPickChoose(betPerLine, linesActive, { base_game:true, red_spin:false, pick_choose:false }); } catch(e) { GameState.activeBonus = null; }
        totalWon += _cbPcR.totalWon;
      }
      if (_cbResult.awardRedSpin) {
        GameState.stats.redSpinCount++;
        var _cbRsR = { totalWon:0, events:[], outcome:null };
        try { _cbRsR = await Bonuses.runRedSpin(betPerLine, linesActive, { prevWin:result.totalWin }); } catch(e) { GameState.activeBonus = null; }
        totalWon += _cbRsR.totalWon;
        if (typeof UI !== 'undefined') { UI.endRedSpinImmediate(); UI.deactivateRedScreen(); }
      }
      if (GameState.eventLog.currentGame) {
        GameState.eventLog.currentGame.bonuses.push({ type:'BONUS_ORB', triggeredAt:'combo_chain', events:_cbResult.events, outcome:_cbResult.outcome });
      }
    }
    // Disarm combo after all bonuses have run
    GameState.operator.comboArmed = false;
    if (_cm) { _cm.red_spin = false; _cm.pick_choose = false; _cm.bonus_letters = false; }
    saveState();
  }

  recordSpin(totalBet, totalWon);

  var summary = {
    totalBet: totalBet, totalWon: totalWon, netResult: totalWon - totalBet,
    serialNumber: _currentSpinSerial,
    balanceBefore: GameState.balance - totalWon + totalBet, balanceAfter: GameState.balance,
    biggestSingleWin: result.totalWin,
    bonusesTriggered: [
      result.triggerPickChoose && 'PICK_CHOOSE',
      redSpinTriggered         && 'RED_SPIN',
    ].filter(Boolean),
  };

  if (GameState.eventLog.currentGame) {
    var _cg = GameState.eventLog.currentGame;
    _cg.denom = _denom; _cg.creditsPerLine = _credits;
    if (grid) {
      _cg.centerRow = grid.map(function(col) {
        var sym = SYMBOL_BY_ID[col[1]];
        return sym ? sym.name : 'Unknown';
      });
    }
  }

  finalizeGameRecord(summary);
  saveState();

  if (typeof UI !== 'undefined') { UI.updateBalance(GameState.balance); UI.onSpinComplete(summary); }
  GameState.spinInProgress = false;
  if (!GameState.activeBonus && typeof UI !== 'undefined') UI.deactivateRedScreen();

  // BUG-WIRE-2 FIX (v8.1.16): Show INSERT CASH pulsing message if player has run out of credits.
  // startInsertCashTicker auto-stops when balance returns above 0 (CashOut or voucher insert).
  if (GameState.balance <= 0 && typeof UI !== 'undefined' && UI.startInsertCashTicker) {
    UI.startInsertCashTicker();
  }

  if (_nextSpinQueued && !GameState.activeBonus) {
    var qBet = _nextSpinBet, qLines = _nextSpinLines;
    clearQueuedSpin();
    setTimeout(function() { executeSpin(qBet, qLines); }, 80);
  }

  return summary;
}
