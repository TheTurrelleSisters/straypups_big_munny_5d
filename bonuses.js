'use strict';

// ── UNIFIED JACKPOT CHECK — v6l96 ────────────────────────────────────────────
// Single roll at bonus entry (P&C, RS). Must-hit-by takes priority.
// PERMANENT RULE: Fire once per bonus trigger. Never per-spin or per-tile.
// PERMANENT RULE: BONUS orb never calls this — only its sub-bonuses do.
function _checkUnifiedJackpot() {
  var tiers = ['GRAND', 'MAJOR', 'MINOR', 'MINI'];

  // Must-hit-by: force award when within 2% of cap (highest tier first)
  for (var mhi = 0; mhi < tiers.length; mhi++) {
    var mhKey = tiers[mhi];
    var mhJp  = GameState.jackpots[mhKey];
    // v8.1.0: 2% grace zone — fires when current >= mustHitBy × 0.98 (i.e. within 2% of cap)
    if (mhJp && mhJp.mustHitBy > 0 && mhJp.current >= mhJp.mustHitBy * 0.98) {
      logEvent('JACKPOT_MUST_HIT_BY_FORCED', { tier: mhKey, current: mhJp.current, cap: mhJp.mustHitBy });
      return mhKey;
    }
  }

  // ── v7.0.1 — Operator forceJackpotQueue (bonus/any context) ─────────────
  // Fires when operator has armed a jackpot for bonus or any context.
  // Queue allows multi-jackpot: each call pops one tier from the queue.
  var op = GameState.operator;
  var fqCtx = op.forceJackpotContext || 'bonus';
  if (op.forceJackpotQueue && op.forceJackpotQueue.length > 0 &&
      (fqCtx === 'bonus' || fqCtx === 'any')) {
    var forcedTier = op.forceJackpotQueue.shift(); // pop first item
    logEvent('JACKPOT_OPERATOR_FORCED', { tier: forcedTier, context: 'UNIFIED_BONUS', remaining: op.forceJackpotQueue.length });
    if (op.forceJackpotQueue.length === 0) {
      // Queue exhausted — reset legacy forceJackpot flag too
      op.forceJackpot = 'none';
    }
    return forcedTier;
  }
  // Legacy single forceJackpot support (context bonus/any)
  if (op.forceJackpot && op.forceJackpot !== 'none' &&
      (fqCtx === 'bonus' || fqCtx === 'any')) {
    var legTier = op.forceJackpot;
    op.forceJackpot = 'none';
    logEvent('JACKPOT_OPERATOR_FORCED', { tier: legTier, context: 'UNIFIED_BONUS_LEGACY' });
    return legTier;
  }

  // Random roll — highest tier first so GRAND takes priority
  var p = JACKPOT_UNIFIED_PROBS;
  if (rng.chance(p.GRAND))  return 'GRAND';
  if (rng.chance(p.MAJOR))  return 'MAJOR';
  if (rng.chance(p.MINOR))  return 'MINOR';
  if (rng.chance(p.MINI))   return 'MINI';
  return null;
}

var Bonuses = {

// ═══════════════════════════════════════════════════════════════════════
// BONUS #1 — RED SPIN BONUS
// As soon as reels stop → immediately go to next spin (no delay for wins)
// Pick & Choose and Hold & Spin can be disabled in operator menu during red spin
// Jackpot order rule: Mini first, then Minor, Major, Grand in sequence
// ═══════════════════════════════════════════════════════════════════════


  runRedSpin: async function(betPerLine, linesActive, callerContext) { // v8.1.7: async fn expression — was ES6 async method shorthand (BUG-V3)
    if (callerContext === undefined) callerContext = {};
    // ── RS PER-TIER JACKPOT SYSTEM (v8.1.1) ─────────────────────────────────
    // Jackpot check fires at each tier ENTRY via _rollTierJackpot().
    // T1 (index 0): MINI or MAJOR/MINOR/GRAND via unified probs
    // T2 (index 1): MINOR if MINOR progressive ≥ 3× totalBet, else MINI. GRAND always eligible.
    // T3 (index 2): MAJOR designated. GRAND always eligible.
    // T4 (index 3): GRAND always. 4-oak wild combos ascending then GRAND jackpot forced.
    // NO unified entry check at RS start — RS uses per-tier checks exclusively.
    // P&C uses the unified entry check. RS tier system is separate.
    // Both draw from the same progressive pool via awardJackpot().
    var _tierJackpot       = null;  // jackpot type won at current tier entry
    var _tierJpSpinsLeft   = 0;     // normal spins to play before jackpot spin
    var _tierJpFired       = false; // jackpot spin played this tier

    // ══════════════════════════════════════════════════════════════════
    // RED SPIN — CLASS III SCRIPTED VOLATILITY ARCHITECTURE
    // Modelled on BIG MUNNY (BIG MUNNY Class III)
    //
    // ARCHITECTURE (owner confirmed 2026-05-18):
    //   - SAME reel strips as base game — no dynamic strip switching
    //   - SAME evaluateSpin() engine — paylines, wilds, letters, all active
    //   - RNG constrained: each spin must produce a REAL combination
    //     where the payline total EXCEEDS the previous spin's win
    //   - The effect feels scripted because wins genuinely escalate,
    //     but the math is true RNG within that constraint
    //   - No pre-determined spin count — pure random via continuance check
    //
    // FLOOR / CEILING:
    //   - Floor = max(triggering base win, totalBet). Spin 1 always beats
    //     the triggering win. Never awards less than the bet.
    //   - Ceiling = Sisters 5-oak center line → GRAND jackpot fires naturally
    //     via processCharacterJackpots. This is the last possible real
    //     combination — no higher combination exists in the reel math.
    //
    // CONTINUANCE:
    //   - Spin 1: guaranteed (no check)
    //   - Spin 2+: 60% continue / 40% end (RED_SPIN_CONTINUANCE_DEFAULT)
    //   - Grand jackpot hit always ends the sequence
    //
    // BONUSES WITHIN SEQUENCE:
    //   - P&C, BONUS letters CAN trigger on RS spins (same as base)
    //   - Additional RS awards: player must re-trigger naturally after RS ends
    //     and dispatched after the primary sequence completes
    //
    // LAST RESORT (Sisters cap):
    //   - If 500 random attempts AND full R1×R2 scan cannot beat lastWin,
    //     game forces Sisters stops [46,68,42,16,54] → GRAND jackpot
    //   - This maintains reel/win integrity: reels always match payout
    // ══════════════════════════════════════════════════════════════════

    GameState.activeBonus = 'RED_SPIN';
    // v8.1.58: Acquire wake lock at RS start — screen must not dim during long RS sessions
    if (typeof window !== 'undefined' && typeof window._gameAcquireWakeLock === 'function') {
      window._gameAcquireWakeLock();
    }
    var totalBet    = betPerLine * linesActive;
    var op          = GameState.operator;
    var bonusTotal  = 0;
    // Spin 1 floor — BIG MUNNY rule: Red Spin Screen Bonus ALWAYS pays more than the total bet (all denoms).
    // From base game: floor = max(base game win, totalBet). e.g. $1 win on a $100 bet → floor = $100.
    // From BONUS orb or Pick & Choose (no prevWin): floor = totalBet.
    // The zero fallback is intentionally removed — no valid trigger context has a floor below totalBet.
    // totalBet is already denom-scaled (betPerLine = denom × creditsPerLine) — no per-denom logic needed.
    var lastWin     = (callerContext && callerContext.prevWin != null)
                        ? Math.max(callerContext.prevWin, totalBet)
                        : totalBet;
    var spinNum    = 0;
    var grandHit   = false;

    // v8.1.29 CRITICAL FIX: TIERS was referenced 8x but never declared after the
    // v8.1.24 rewrite — every Red Spin threw "TIERS is not defined" and was silently
    // swallowed by the try/catch in game.js, so RS never ran. Restored here.
    // v8.1.40: fallback values updated to match MC-calibrated RED_SPIN_TIERS.
    var TIERS = (typeof RED_SPIN_TIERS !== 'undefined') ? RED_SPIN_TIERS : [
      { tier:1, name:'Small',   minMult:0.10, maxMult:0.80 },
      { tier:2, name:'Medium',  minMult:1.00, maxMult:3.00 },
      { tier:3, name:'Large',   minMult:3.50, maxMult:8.00 },
      { tier:4, name:'Sisters', minMult:10,   maxMult:50   },
    ];

    // v8.1.23: Random tier entry — RS can trigger directly into any tier.
    // RED_SPIN_ENTRY_PROBS = [T1=65%, T2=25%, T3=8%, T4=2%].
    // Cumulative roll: pick highest tier index whose cumulative prob the RNG roll clears.
    var _ENTRY_PROBS = (typeof RED_SPIN_ENTRY_PROBS !== 'undefined') ? RED_SPIN_ENTRY_PROBS : [0.65, 0.25, 0.08, 0.02];
    function _rollEntryTier() {
      var roll = rng.next(); // 0–1
      var cumulative = 0;
      for (var _ei = 0; _ei < _ENTRY_PROBS.length; _ei++) {
        cumulative += _ENTRY_PROBS[_ei];
        if (roll < cumulative) return _ei;
      }
      return 0; // fallback
    }
    var currentTier = (op.forceRSEntryTier >= 0 && op.forceRSEntryTier <= 3)
      ? op.forceRSEntryTier
      : _rollEntryTier();
    if (op.forceRSEntryTier >= 0) op.forceRSEntryTier = -1; // one-shot
    logEvent('RED_SPIN_ENTRY_TIER', { tierIndex: currentTier, tierName: (TIERS[currentTier] || {}).name || 'T'+(currentTier+1) });
    var firstInTier = true;
    var _rsMiniCount = 0;
    var lastPaylineKey = '';
    var lastStops = [];
    var _tierSteps   = [];   // v8.1.25: current tier's RNG step sequence
    var _tierStepIdx = 0;    // v8.1.25: which step we're delivering next

    // ── v8.1.25 STEP SEQUENCE ────────────────────────────────────────────────
    // Owner confirmed 2026-05-28: Fixed tier ranges with RNG delivery.
    // At each tier entry, RNG picks step count (4-6), spaces steps evenly
    // floor-to-ceiling, snaps each to nearest real paytable win. Player sees
    // wins escalate across the full tier range — extended anticipation.
    // Ascending rule carries over across tiers.
    // Advance probs restored: [15%, 25%, 40%] at T1-T2, T2-T3, T3-T4.

    var ADVANCE_PROB = (typeof RED_SPIN_TIER_ADVANCE_PROB !== 'undefined') ? RED_SPIN_TIER_ADVANCE_PROB : [0.15, 0.25, 0.40];
    var STEP_MIN = (typeof RED_SPIN_STEP_COUNT_MIN !== 'undefined') ? RED_SPIN_STEP_COUNT_MIN : 4;
    var STEP_MAX = (typeof RED_SPIN_STEP_COUNT_MAX !== 'undefined') ? RED_SPIN_STEP_COUNT_MAX : 6;

    function _tierWinCandidates(tier) {
      var minW = tier.minMult * totalBet;
      var maxW = tier.maxMult * totalBet;
      var wins = [];
      var symKeys = Object.keys(PAY_TABLE);
      // v8.1.38: wild configs expanded to cover all possible Josie/Sasha combos (up to 4 wilds in a 5-oak).
      // Formula mirrors evaluateLine exactly: mult = 1 + (josie×2) + (sasha×1), additive, no cap.
      // All-wild combos (baseSymCount=0) excluded — they pay $0 per design.
      var counts = [3, 4, 5];
      var wildCfgs = [
        [0,0], // no wilds
        [1,0],[0,1],           // 1 wild
        [2,0],[1,1],[0,2],     // 2 wilds
        [3,0],[2,1],[1,2],[0,3], // 3 wilds
        [4,0],[3,1],[2,2],[1,3],[0,4], // 4 wilds (only valid for 5-oak combos)
      ];
      for (var _si = 0; _si < symKeys.length; _si++) {
        var _pays = PAY_TABLE[symKeys[_si]];
        if (!_pays) continue;
        for (var _ci = 0; _ci < counts.length; _ci++) {
          var _pidx = Math.max(0, 5 - counts[_ci]);
          if (!_pays[_pidx]) continue;
          var _base = _pays[_pidx] * betPerLine;
          if (_base === 0) continue; // skip Josie/Sasha/Sisters/Lipstick (all zero)
          for (var _wi = 0; _wi < wildCfgs.length; _wi++) {
            var _jc = wildCfgs[_wi][0], _sc = wildCfgs[_wi][1];
            if (counts[_ci] - _jc - _sc < 1) continue; // must have at least 1 base symbol
            if (_jc + _sc >= counts[_ci]) continue;      // all-wild combos excluded
            // v8.1.38: additive multiplier, no cap — mirrors evaluateLine exactly
            var _mult = 1 + (_jc * 2) + (_sc * 1);
            var _win = _base * _mult;
            if (_win >= minW && _win <= maxW && wins.indexOf(_win) < 0) wins.push(_win);
          }
        }
      }
      wins.sort(function(a,b){return a-b;});
      return wins;
    }

    function _snapToWin(target, candidates) {
      if (!candidates.length) return target;
      var best = candidates[0], bestDist = Math.abs(target - candidates[0]);
      for (var _i = 1; _i < candidates.length; _i++) {
        var d = Math.abs(target - candidates[_i]);
        if (d < bestDist) { bestDist = d; best = candidates[_i]; }
      }
      return best;
    }

    function _rollTierSequence(tierIdx, floorOverride) {
      var tier = TIERS[tierIdx];
      if (!tier) return [];
      var stepCount = (op.forceRSStepCount >= 4 && op.forceRSStepCount <= 6)
        ? op.forceRSStepCount
        : (STEP_MIN + Math.floor(rng.next() * (STEP_MAX - STEP_MIN + 1)));
      var floor = Math.max(tier.minMult * totalBet, floorOverride || 0);
      var ceiling = tier.maxMult * totalBet;
      var candidates = _tierWinCandidates(tier);
      if (!candidates.length) return [];
      var steps = [];
      for (var _s = 0; _s < stepCount; _s++) {
        var frac = (stepCount > 1) ? _s / (stepCount - 1) : 0.5;
        var idealTarget = floor + frac * (ceiling - floor);
        var lastStep = steps.length ? steps[steps.length - 1] : (floor - 0.01);
        var above = candidates.filter(function(w) { return w > lastStep; });
        if (!above.length) above = candidates;
        var snapped = _snapToWin(idealTarget, above);
        if (steps.indexOf(snapped) < 0) {
          steps.push(snapped);
        } else {
          for (var _ai = 0; _ai < above.length; _ai++) {
            if (above[_ai] > lastStep && steps.indexOf(above[_ai]) < 0) { steps.push(above[_ai]); break; }
          }
        }
      }
      logEvent('RED_SPIN_SEQUENCE_GENERATED', { tier: tier.name, steps: steps, stepCount: steps.length });
      return steps;
    }

        // ── v7.0.2 SWEEP MODE ───────────────────────────────────────────────────
    var _sweepMode    = !!(op.rsSweepMode);
    var _sweepTier    = (op.rsSweepTier !== undefined) ? op.rsSweepTier : -1;
    var _sweepList    = [];
    var _sweepIdx     = 0;

    function _buildSweepCasesForTier(tierIdx) {
      var tier = TIERS[tierIdx];
      if (!tier || tier.minMult === null) {
        return [{ type:'SISTERS', tierIdx: tierIdx, winAmount: totalBet * 1000 }];
      }
      var minW = tier.minMult * totalBet;
      var maxW = tier.maxMult * totalBet;
      var cases = [];
      // v8.1.38: Josie/Sasha pay $0 — exclude from sweep cases. Only paying symbols.
      var symKeys = ['SINGLE_BAR','DOUBLE_BAR','TRIPLE_BAR','DOLLAR_BILLS','DIAMOND','SEVEN','DJ_MAXINE','STRAYPUP'];
      var counts  = [3, 4, 5];
      var wildCfgs = [
        [0,0],[1,0],[0,1],[2,0],[1,1],[0,2],
        [3,0],[2,1],[1,2],[0,3],[4,0],[3,1],[2,2],[1,3],[0,4],
      ];
      for (var ski = 0; ski < symKeys.length; ski++) {
        var sk = symKeys[ski];
        if (!PAY_TABLE || !PAY_TABLE[sk]) continue;
        var pays = PAY_TABLE[sk];
        for (var ci = 0; ci < counts.length; ci++) {
          var cnt = counts[ci];
          var payIdx = Math.max(0, 5 - cnt);
          if (payIdx >= pays.length || pays[payIdx] === 0) continue;
          var basePay = pays[payIdx];
          for (var wi = 0; wi < wildCfgs.length; wi++) {
            var jc = wildCfgs[wi][0]; var sc = wildCfgs[wi][1];
            if (cnt - jc - sc < 1) continue;
            if (jc + sc >= cnt) continue; // all-wild excluded
            // v8.1.38: additive multiplier, no cap — mirrors evaluateLine exactly
            var mult = 1 + (jc * 2) + (sc * 1);
            var winAmt = basePay * betPerLine * mult;
            if (winAmt >= minW && winAmt <= maxW) {
              cases.push({ type:'combo', symKey:sk, count:cnt, josie:jc, sasha:sc, winAmount:winAmt });
            }
          }
        }
      }
      cases.sort(function(a,b){return a.winAmount - b.winAmount;});
      return cases;
    }

    function _buildSweepGrid(swCase) {
      var centerLine = PAYLINES[0]; // [1,1,1,1,1] — middle row
      // Start with random stops for variety in the non-target cells
      var stops = REEL_STRIPS.map(function(r) { return Math.floor(rng.next() * r.length); });
      var grid  = buildGrid(stops);

      if (swCase.type === 'SISTERS') {
        // Place Sisters on all 5 reels at center row
        for (var c = 0; c < 5; c++) grid[c][centerLine[c]] = SYMBOLS.SISTERS.id;
      } else if (swCase.type === 'MIXED_BAR') {
        // Alternate bar types, ensure they differ
        var barIds = [SYMBOLS.SINGLE_BAR.id, SYMBOLS.DOUBLE_BAR.id, SYMBOLS.TRIPLE_BAR.id];
        for (var mc = 0; mc < swCase.count; mc++) {
          grid[mc][centerLine[mc]] = barIds[mc % 3];
        }
        for (var mc2 = swCase.count; mc2 < 5; mc2++) {
          grid[mc2][centerLine[mc2]] = SYMBOLS.LIPSTICK.id; // breaks combo cleanly
        }
      } else {
        // Standard payline combo: wilds first, then match symbol, then breaker
        var symId = SYMBOLS[swCase.symKey] ? SYMBOLS[swCase.symKey].id : SYMBOLS.SEVEN.id;
        var col = 0;
        for (var j = 0; j < swCase.josie && col < swCase.count; j++, col++) {
          grid[col][centerLine[col]] = SYMBOLS.JOSIE.id;
        }
        for (var s = 0; s < swCase.sasha && col < swCase.count; s++, col++) {
          grid[col][centerLine[col]] = SYMBOLS.SASHA.id;
        }
        for (; col < swCase.count; col++) {
          grid[col][centerLine[col]] = symId;
        }
        for (; col < 5; col++) {
          grid[col][centerLine[col]] = SYMBOLS.LIPSTICK.id; // breaks combo
        }
      }
      return { stops: stops, grid: grid };
    }

    // FIX-9 v8.1.48: Hoisted from inside the else{} block — function declarations in block
    // scope are illegal in strict mode ES5 and may throw ReferenceError on Samsung Browser /
    // older WebKit. Moved here alongside the other helper functions (_rollEntryTier, etc.).
    function _rsHasBonusTrigger(g) {
      var centerLine = PAYLINES[0];
      var allLipstick = true;
      for (var _lc = 0; _lc < 5; _lc++) {
        if (g[_lc][centerLine[_lc]] !== BONUS_PC_ID) { allLipstick = false; break; }
      }
      if (allLipstick) return true;
      var allLetters = true;
      for (var _bc = 0; _bc < 5; _bc++) {
        if (g[_bc][2] !== LETTER_IDS[_bc]) { allLetters = false; break; }
      }
      if (allLetters) return true;
      return false;
    }

    if (_sweepMode) {
      // Build the full sweep list across target tiers
      var tierRange = (_sweepTier === -1) ? [0, 1, 2, 3] : [_sweepTier];
      for (var tri = 0; tri < tierRange.length; tri++) {
        var tCases = _buildSweepCasesForTier(tierRange[tri]);
        for (var tci = 0; tci < tCases.length; tci++) {
          _sweepList.push(tCases[tci]);
        }
      }
      logEvent('RS_SWEEP_START', { sweepTier: _sweepTier, totalCases: _sweepList.length });
      if (typeof UI !== 'undefined') UI.showToast('SWEEP: ' + _sweepList.length + ' combos');
    }

    // Helper: get sorted payline key from result
    function _paylineKey(res) {
      if (!res || !res.paylineWins || !res.paylineWins.length) return '__none__';
      return res.paylineWins.map(function(w) { return w.lineIndex; }).sort().join(',');
    }

    // v8.1.1 — additional RS via natural base game trigger only.

    // Activate red screen + music
    // BUG-RS-1 FIX (v8.1.17): startRedSpinMusic() moved to immediately after activateRedScreen(),
    // before showRedSpinEntry(). Previously fired after the 600ms entry flash, which put it too far
    // from the user gesture on iOS/Android — el.play() was silently rejected. Music now starts
    // the instant the screen goes red, matching the visual transition.
    if (typeof UI !== 'undefined') {
      try {
        await UI.activateRedScreen();
      } catch(actErr) {
        console.error('[RS] activateRedScreen threw:', actErr && actErr.message ? actErr.message : actErr);
      }
    }
    if (typeof Audio !== 'undefined') Audio.startRedSpinMusic();
    if (typeof UI !== 'undefined') {
      try {
        await UI.showRedSpinEntry(0, 0);
      } catch(entryErr) {
        console.error('[RS] showRedSpinEntry threw:', entryErr && entryErr.message ? entryErr.message : entryErr);
      }
    }
    if (typeof UI !== 'undefined') UI.setControlsEnabled(false);

    logEvent('RED_SPIN_START', {
      bonusType:'RED_SPIN', betPerLine: betPerLine, linesActive: linesActive, totalBet: totalBet,
      balanceBefore: GameState.balance
    });

    // ── Helper: find a real grid where the given jackpot type fires ─────────
    function _findJpGrid(jpType) {
      var activeLines = PAYLINES.slice(0, linesActive);

      // Shuffle active lines — varies which payline gets highlighted each time
      var lines = activeLines.slice();
      for (var si = lines.length - 1; si > 0; si--) {
        var sj = Math.floor(rng.next() * (si + 1));
        var st = lines[si]; lines[si] = lines[sj]; lines[sj] = st;
      }

      // v8.1.38: JP trigger rules confirmed by owner 2026-05-29:
      // MINI:  5× Sasha only, center line (row 1 all 5 reels)
      // MINOR: 5× Josie only, center line (row 1 all 5 reels)
      // MAJOR: 5 mixed wilds (Josie+Sasha, must have both), any payline
      // GRAND: 5× Sisters, any payline
      // All require exactly 5 matching symbols — no partial combos.

      // For MINI/MINOR: must be center line (row index 1), all 5 reels
      // Force search on center line only
      var searchLines = lines;
      if (jpType === 'MINI' || jpType === 'MINOR') {
        // Center line = PAYLINES[0] = [1,1,1,1,1]
        var centerLine = null;
        for (var cli = 0; cli < activeLines.length; cli++) {
          if (activeLines[cli][0]===1 && activeLines[cli][1]===1 && activeLines[cli][2]===1 &&
              activeLines[cli][3]===1 && activeLines[cli][4]===1) {
            centerLine = activeLines[cli]; break;
          }
        }
        searchLines = centerLine ? [centerLine] : [];
      }

      for (var li = 0; li < searchLines.length; li++) {
        var line  = searchLines[li];
        var stops = [];
        var ok    = true;

        for (var col = 0; col < 5; col++) {
          var strip      = REEL_STRIPS[col];
          var targetRow  = line[col];
          var valid = [];

          for (var s = 0; s < strip.length; s++) {
            // BUG-JP1 FIX v8.1.49: getVisibleSymbols maps rows as:
            //   row0=strip[stop-1], row1=strip[stop], row2=strip[stop+1]
            // To land a symbol at targetRow r, we need strip[stop + (r-1)] = symbol,
            // so we search for stop s where strip[(s + r - 1 + len) % len] = symbol.
            // Previous formula strip[(s + targetRow) % len] was off by +1 — symbols
            // landed one row below target, causing checkCharacterJackpots to miss them
            // and processCharacterJackpots to award nothing.
            var sym = strip[(s + targetRow - 1 + strip.length) % strip.length];
            var hit = false;
            if      (jpType === 'MINI')  hit = (sym === SYMBOLS.SASHA.id);
            else if (jpType === 'MINOR') hit = (sym === SYMBOLS.JOSIE.id);
            else if (jpType === 'MAJOR') hit = (WILD_IDS.indexOf(sym) >= 0); // any wild — checked for mix below
            else /* GRAND */             hit = (sym === SYMBOLS.SISTERS.id);
            if (hit) valid.push(s);
          }

          if (valid.length === 0) { ok = false; break; }
          stops.push(valid[Math.floor(rng.next() * valid.length)]);
        }

        if (!ok) continue;

        var grid = buildGrid(stops);

        // v8.1.38: For MAJOR, verify the line has BOTH Josie and Sasha (mixed wilds).
        // A line of all Josie = MINOR, all Sasha = MINI — neither qualifies for MAJOR.
        // If mix check fails, rebuild with explicit Josie+Sasha placement.
        if (jpType === 'MAJOR') {
          var lineSyms = line.map(function(row, c) { return grid[c][row]; });
          var hasJosie = lineSyms.some(function(s) { return s === SYMBOLS.JOSIE.id; });
          var hasSasha = lineSyms.some(function(s) { return s === SYMBOLS.SASHA.id; });
          if (!hasJosie || !hasSasha) {
            // Force at least 1 Josie and 1 Sasha on this line
            // Place Josie on reel 0, Sasha on reel 1, fill rest with either wild
            var majorStops = stops.slice();
            for (var mc = 0; mc < 5; mc++) {
              var mStrip = REEL_STRIPS[mc];
              var mTarget = line[mc];
              var mWant = (mc === 0) ? SYMBOLS.JOSIE.id : (mc === 1) ? SYMBOLS.SASHA.id : null;
              if (mWant !== null) {
                var mValid = [];
                for (var ms = 0; ms < mStrip.length; ms++) {
                  if (mStrip[(ms + mTarget) % mStrip.length] === mWant) mValid.push(ms);
                }
                if (mValid.length > 0) majorStops[mc] = mValid[Math.floor(rng.next() * mValid.length)];
              }
            }
            grid = buildGrid(majorStops);
            stops = majorStops;
          }
        }

        var hits = checkCharacterJackpots(grid, linesActive);
        if (hits.indexOf(jpType) >= 0) return { stops: stops, grid: grid };
      }

      // Emergency random fallback
      for (var _ji = 0; _ji < 400; _ji++) {
        var _s = REEL_STRIPS.map(function(r) { return Math.floor(rng.next() * r.length); });
        var _g = buildGrid(_s);
        var _h = checkCharacterJackpots(_g, linesActive);
        if (_h.indexOf(jpType) >= 0) return { stops: _s, grid: _g };
      }
      return null;
    }

    // ── Helper: fire tier-entry jackpot check (unified system) ──────────
    // Each RS tier entry is a full unified jackpot check — same system as
    // P&C. All four tiers eligible at every tier entry.
    // Must-hit-by caps enforced first (highest tier priority).
    // GRAND always eligible. T4 also allows MAJOR/MINOR if progressive qualifies.
    // The "designated" tier jackpot determines which symbols appear on the
    // jackpot spin — it does NOT restrict which jackpot can be won.
    // Owner confirmed 2026-05-21: tiered jackpots tied to unified system.
    function _rollTierJackpot(tierIndex) {
      var tiers = ['GRAND', 'MAJOR', 'MINOR', 'MINI'];

      // Must-hit-by: force award when within 2% of cap (highest tier first)
      for (var mhi = 0; mhi < tiers.length; mhi++) {
        var mhKey = tiers[mhi];
        var mhJp  = GameState.jackpots[mhKey];
        // v8.1.0: 2% grace zone — fires when current >= mustHitBy × 0.98 (i.e. within 2% of cap)
    if (mhJp && mhJp.mustHitBy > 0 && mhJp.current >= mhJp.mustHitBy * 0.98) {
          logEvent('JACKPOT_MUST_HIT_BY_FORCED', { tier:mhKey, current:mhJp.current, cap:mhJp.mustHitBy, context:'RED_SPIN_TIER_'+tierIndex });
          return mhKey;
        }
      }

      // ── v7.0.2 — Operator RS tier jackpot force via forceRSTierMap ──────────
      // forceRSTierMap: { 0:'MINI', 1:'MINOR', 2:'MAJOR', 3:'GRAND' }
      // Each tier index has its own designated jackpot. null = no force for that tier.
      var opRS   = GameState.operator;
      var rsCtx  = opRS.forceJackpotContext || 'bonus';
      var tierMap = opRS.forceRSTierMap || {};
      var designatedJp = tierMap[tierIndex]; // may be undefined/null
      if (designatedJp && (rsCtx === 'bonus' || rsCtx === 'any')) {
        // Clear this tier's assignment after it fires (one-shot per tier)
        tierMap[tierIndex] = null;
        logEvent('JACKPOT_OPERATOR_FORCED', { tier: designatedJp, context: 'RED_SPIN_TIER_MAP_'+tierIndex });
        return designatedJp;
      }
      // FIX (v8.1.36): forceJackpotQueue fallback — consumed when no tierMap entry.
      // toggleComboJP populates forceJackpotQueue; this path makes RS consume it
      // the same way P&C does via _checkUnifiedJackpot (one pop per tier entry).
      if (opRS.forceJackpotQueue && opRS.forceJackpotQueue.length > 0 &&
          (rsCtx === 'bonus' || rsCtx === 'any')) {
        var _rsQueueTier = opRS.forceJackpotQueue.shift();
        if (opRS.forceJackpotQueue.length === 0) opRS.forceJackpot = 'none';
        logEvent('JACKPOT_OPERATOR_FORCED', { tier: _rsQueueTier, context: 'RED_SPIN_QUEUE_'+tierIndex });
        return _rsQueueTier;
      }
      // Legacy forceRSTier removed v8.1.2 — forceJackpotQueue handled below via forceJackpot
      // forceRSTier was a stale property written by a duplicate setRSTier function (now removed)
      // FIX-A (v8.1.10): removed dead `(rsTier === -1 || rsTier === tierIndex)` condition —
      // rsTier was never declared in this scope (forceRSTier removed v8.1.2). Referencing it
      // threw a ReferenceError whenever forceJackpot was non-null in saved operator state,
      // crashing runRedSpin() and producing "Spin error — please try again" toast.
      // Legacy single forceJackpot
      if (opRS.forceJackpot && opRS.forceJackpot !== 'none' &&
          (rsCtx === 'bonus' || rsCtx === 'any')) {
        var rsLegTier = opRS.forceJackpot;
        opRS.forceJackpot = 'none';
        logEvent('JACKPOT_OPERATOR_FORCED', { tier: rsLegTier, context: 'RED_SPIN_TIER_LEGACY_'+tierIndex });
        return rsLegTier;
      }

      // Full unified random roll — identical to _checkUnifiedJackpot()
      // GRAND always first. T2 (tierIndex=1) uses dynamic MINOR/MINI selection
      // based on current MINOR progressive vs 3× totalBet threshold (v7.0.4).
      var p = JACKPOT_UNIFIED_PROBS;
      if (rng.chance(p.GRAND)) return 'GRAND';

      if (tierIndex === 2) {
        // T3: MAJOR designated
        if (rng.chance(p.MAJOR)) return 'MAJOR';
        if (rng.chance(p.MINOR)) return 'MINOR';
        if (rng.chance(p.MINI))  return 'MINI';
      } else if (tierIndex === 1) {
        // T2: MINOR if MINOR progressive >= 3× totalBet, else MINI (v7.0.4 owner confirmed)
        var minorProg = (GameState.jackpots && GameState.jackpots.MINOR) ? GameState.jackpots.MINOR.current : 0;
        if (rng.chance(p.MINOR)) {
          return (minorProg >= totalBet * 3) ? 'MINOR' : 'MINI';
        }
        if (rng.chance(p.MINI)) return 'MINI';
      } else {
        // T1 and T4: MINI/MAJOR/MINOR per unified probs
        if (rng.chance(p.MAJOR)) return 'MAJOR';
        if (rng.chance(p.MINOR)) return 'MINOR';
        if (rng.chance(p.MINI))  return 'MINI';
      }
      return null;
    }

    // ── TIERED SPIN LOOP ──────────────────────────────────────────────────
    while (true) {
      spinNum++;

      // ── v7.0.2 SWEEP MODE — plays through all combos in _sweepList ────────
      if (_sweepMode) {
        if (_sweepIdx >= _sweepList.length) {
          // All sweep cases played — end RS
          logEvent('RS_SWEEP_COMPLETE', { totalSpins: spinNum - 1 });
          break;
        }
        var _sweepCase = _sweepList[_sweepIdx++];
        var _sg = _buildSweepGrid(_sweepCase);
        var _sResult = evaluateSpin(_sg.grid, linesActive, betPerLine);
        var _sWin = _sResult.totalWin || _sweepCase.winAmount;
        // Update tier display to match the sweep case's tier
        currentTier = _sweepCase.tierIdx || 0;
        var _sTier = TIERS[currentTier] || TIERS[0];
        bonusTotal += _sWin;
        GameState.balance += _sWin;
        if (typeof UI !== 'undefined') {
          await UI.animateReelsStop(_sg.stops, _sg.grid);
          if (_sResult.paylineWins && _sResult.paylineWins.length > 0) {
            await UI.showBaseWins(_sResult, betPerLine, linesActive, false, true);
          }
          UI.updateRedSpinWin(_sWin, bonusTotal, spinNum);
          UI.updateBalance(GameState.balance);
          UI.showRedSpinTier(_sTier.name, spinNum);
        }
        lastWin = _sWin;
        logEvent('RS_SWEEP_SPIN', { sweepIdx: _sweepIdx, type: _sweepCase.type, symKey: _sweepCase.symKey, count: _sweepCase.count, winAmount: _sWin });
        await this._delay(1200);
        continue;
      }

      var tier = TIERS[currentTier];

      // ── v8.1.25: Generate step sequence at tier entry ────────────────
      // firstInTier triggers sequence generation and JP check.
      // _tierSteps holds the RNG-generated ascending win targets.
      // _tierStepIdx tracks which step we're delivering next.
      if (firstInTier) {
        _tierSteps   = _rollTierSequence(currentTier, lastWin);
        _tierStepIdx = 0;
        _tierJackpot     = _rollTierJackpot(currentTier);
        _tierJpSpinsLeft = _tierJackpot ? (1 + Math.floor(rng.next() * 3)) : 0;
        _tierJpFired     = false;
        firstInTier = false;
        if (_tierJackpot) {
          logEvent('RS_TIER_JP_PENDING', { tier: tier.name, jpType: _tierJackpot, spinsBeforeJp: _tierJpSpinsLeft });
        }
        // FIX-7 v8.1.48: Empty step sequence guard — _rollTierSequence returns [] when no
        // paytable wins fall within the tier's multiplier range at the current bet amount.
        // Without this guard, _sequenceComplete=(0>=0)=true fires on spin 1, triggering the
        // continuance check immediately and potentially ending RS after zero steps.
        // Fix: advance to next tier (or end gracefully at T4) when sequence is empty.
        if (_tierSteps.length === 0 && !_tierJackpot) {
          logEvent('RS_EMPTY_SEQUENCE', { tier: tier.name, currentTier: currentTier });
          if (currentTier < TIERS.length - 1) {
            currentTier++; firstInTier = true; _tierJpFired = false;
            lastPaylineKey = ''; _tierSteps = []; _tierStepIdx = 0;
            continue; // advance to next tier and regenerate sequence
          } else {
            break; // T4 with empty sequence — end RS gracefully
          }
        }
      }

      var stops, grid, result, spinWin;
      var _isJpSpin = (_tierJackpot && !_tierJpFired && _tierJpSpinsLeft <= 0);

      // ── JACKPOT SPIN: find real grid with jackpot symbols ────────────
      if (_isJpSpin) {
        var jpGrid = _findJpGrid(_tierJackpot);
        if (jpGrid) {
          stops  = jpGrid.stops;
          grid   = jpGrid.grid;
          result = evaluateSpin(grid, linesActive, betPerLine);
          spinWin = result.totalWin;
        } else {
          stops  = REEL_STRIPS.map(function(s) { return Math.floor(rng.next() * s.length); });
          grid   = buildGrid(stops);
          result = evaluateSpin(grid, linesActive, betPerLine);
          spinWin = result.totalWin;
          var directJpAmt = awardJackpot(_tierJackpot);
          bonusTotal += directJpAmt;
          GameState.balance += directJpAmt;
          if (_tierJackpot === 'MINI') { _rsMiniCount++; } // FIX-A3 v8.1.45: count MINI hits for multi-MINI celebration
          if (typeof UI !== 'undefined') await UI.showJackpotCelebration(_tierJackpot, directJpAmt, 'RED_SPIN');
          _tierJpFired = true;
          if (_tierJackpot === 'GRAND') { grandHit = true; }
        }
        _tierJpFired = true;
        if (_tierJackpot === 'MINI') { _rsMiniCount++; } // FIX-A3 v8.1.45: count MINI hits for multi-MINI celebration
        _tierJackpot = null;

      } else {
        // ── v8.1.25: Deliver current step target ─────────────────────────
        // Find real reel combo matching _tierSteps[_tierStepIdx], ascending from lastWin.
        if (_tierJpSpinsLeft > 0) _tierJpSpinsLeft--;

        var _stepTarget = (_tierStepIdx < _tierSteps.length)
          ? _tierSteps[_tierStepIdx]
          : tier.maxMult * totalBet; // safety ceiling
        // Floor = max(lastWin, step target floor)
        var _floorWin = Math.max(lastWin, _stepTarget * 0.85); // allow 15% below target

        var tierMin = tier.minMult * totalBet;
        var tierMax = tier.maxMult * totalBet;
        var found = false;
        var attempts = 0;
        do {
          stops  = REEL_STRIPS.map(function(s) { return Math.floor(rng.next() * s.length); });
          grid   = buildGrid(stops);
          result = evaluateSpin(grid, linesActive, betPerLine);
          spinWin = result.totalWin;
          var plKey      = _paylineKey(result);
          var stopsMatch = lastStops.length === 5 && stops.every(function(s, si) { return s === lastStops[si]; });
          var plMatch    = plKey !== '' && plKey === lastPaylineKey;
          // Accept if win is within the tier range, beats lastWin, and near the step target
          found = spinWin >= _floorWin
               && spinWin <= tierMax
               && spinWin >= tierMin
               && (!stopsMatch || !plMatch)
               && !_rsHasBonusTrigger(grid);
          attempts++;
        } while (!found && attempts < 500);

        // ── FALLBACK: Relax step target, find any win in tier range ascending ──
        if (!found) {
          logEvent('RED_SPIN_STEP_FALLBACK', { spinNum: spinNum, tier: tier.name, stepTarget: _stepTarget });
          var r3 = Math.floor(rng.next() * REEL_STRIPS[2].length);
          var r4 = Math.floor(rng.next() * REEL_STRIPS[3].length);
          var r5 = Math.floor(rng.next() * REEL_STRIPS[4].length);
          outer: for (var f1 = 0; f1 < REEL_STRIPS[0].length; f1++) {
            for (var f2 = 0; f2 < REEL_STRIPS[1].length; f2++) {
              var fStops = [f1, f2, r3, r4, r5];
              var fGrid  = buildGrid(fStops);
              var fResult = evaluateSpin(fGrid, linesActive, betPerLine);
              if (fResult.totalWin > lastWin && fResult.totalWin >= tierMin && fResult.totalWin <= tierMax && !_rsHasBonusTrigger(fGrid)) {
                stops = fStops; grid = fGrid; result = fResult; spinWin = fResult.totalWin; found = true;
                break outer;
              }
            }
          }
        }

        // ── FINAL FALLBACK: per-tier rules ────────────────────────────────
        // T1: advance to T2. T2/T3: end gracefully. T4: end bonus (no forced GRAND).
        if (!found) {
          logEvent('RED_SPIN_TIER_FALLBACK_END', { spinNum: spinNum, tier: tier.name });
          if (currentTier === 0) {
            currentTier = 1; firstInTier = true; _tierJpFired = false;
            lastPaylineKey = ''; _tierSteps = []; _tierStepIdx = 0;
            continue;
          } else {
            break; // end sequence gracefully
          }
        }

        lastPaylineKey = _paylineKey(result);
        lastStops      = stops.slice();
        _tierStepIdx++;  // advance to next step in sequence
      }

      // ── Animate reels ────────────────────────────────────────────────
      // v8.1.58: Re-acquire wake lock each spin — OS may revoke it mid-bonus
      if (typeof window !== 'undefined' && typeof window._gameAcquireWakeLock === 'function') {
        window._gameAcquireWakeLock();
      }
      if (typeof UI !== 'undefined') {
        await UI.animateReelsStop(stops, grid, false, true);
      }

      // ── Award win (credit balance before display so meters are live) ─
      bonusTotal += spinWin;
      lastWin     = spinWin > 0 ? spinWin : lastWin;
      GameState.balance += spinWin;

      // ── Display wins exactly like base game (fast=true: one-shot, no loop) ──
      // v8.1.34 FIX: RS previously used showRedSpinPaylineFlash — a lightweight
      // 500ms flash with no per-line amounts, no win-line-label, no cycling.
      // showBaseWins(result, betPerLine, linesActive, isReplay=false, fast=true)
      // draws all paylines + cell highlights, cycles each winning line individually
      // showing its dollar amount, ~800ms total, then clears. Matches base game exactly.
      if (typeof UI !== 'undefined') {
        if (result.paylineWins && result.paylineWins.length > 0) {
          await UI.showBaseWins(result, betPerLine, linesActive, false, true);
        }
        await UI.updateRedSpinWin(spinWin, bonusTotal, spinNum);
        UI.updateBalance(GameState.balance);
      }

      if (typeof Audio !== 'undefined' && spinWin >= totalBet) {
        Audio.playBellsForWin(spinWin, betPerLine);
      }

      logEvent('RED_SPIN', {
        bonusType:'RED_SPIN', spinNum: spinNum, tier: (TIERS[currentTier]||{}).name,
        spinWin: spinWin, bonusTotal: bonusTotal,
        balanceAfter: GameState.balance
      });

      // ── Jackpots on paylines (Sisters fires here naturally) ──────────
      var charJackpots = await processCharacterJackpots(grid, linesActive, 'RED_SPIN');
      if (charJackpots && charJackpots.totalAwarded > 0) {
        bonusTotal += charJackpots.totalAwarded;
        GameState.balance += charJackpots.totalAwarded;
        if (typeof UI !== 'undefined') UI.updateBalance(GameState.balance);
        if (charJackpots.hits && charJackpots.hits.indexOf('GRAND') >= 0) { grandHit = true; }
      }

      if (grandHit) break;

      // ── Bonus triggers within Red Spin ───────────────────────────────
      if (!op.disablePickChooseInRedSpin && result.scatterTriggered) {
        var pcResult = await this.runPickChoose(betPerLine, linesActive, { from:'RED_SPIN', triggerStops:stops, triggerGrid:grid });
        bonusTotal += pcResult.totalWon || 0;
      }
      if (result.bonusLetterCount === 5) {
        var bResult = await this.runBonusFeature(betPerLine, linesActive, { from:'RED_SPIN' });
        bonusTotal += bResult.totalWon || 0;
        if (bResult.awardPickChoose) {
          var pcR = await this.runPickChoose(betPerLine, linesActive, { from:'RED_SPIN_BONUS' });
          bonusTotal += pcR.totalWon || 0;
        }
      }

      // ── v8.1.25: Continuance / tier advancement ──────────────────────
      // All steps in current sequence play guaranteed.
      // After all steps complete → 70/30 continuance check.
      //   70%: generate new sequence, stay in same tier.
      //   30%: tier advance roll (restored probs [15%, 25%, 40%]).
      var _sequenceComplete = (_tierStepIdx >= _tierSteps.length);
      if (_sequenceComplete) {
        var _cont = (GameState && GameState.operator && typeof GameState.operator.redSpinContinuance === 'number')
          ? Math.min(0.95, Math.max(0.70, GameState.operator.redSpinContinuance))
          : RED_SPIN_CONTINUANCE_DEFAULT;
        if (rng.chance(_cont)) {
          // Continue in same tier — generate fresh sequence from current lastWin
          _tierSteps   = _rollTierSequence(currentTier, lastWin);
          _tierStepIdx = 0;
          logEvent('RED_SPIN_SEQUENCE_CONTINUE', { tier: tier.name, newSteps: _tierSteps });
        } else {
          // Continuance failed — tier advance check
          var _hasNext = currentTier < TIERS.length - 1;
          var _advProb = Array.isArray(ADVANCE_PROB) ? (ADVANCE_PROB[currentTier] || 0.15) : ADVANCE_PROB;
          var _forceAdv = !!(op.forceRSAdvance);
          if (_forceAdv) op.forceRSAdvance = false; // one-shot
          if (_hasNext && (_forceAdv || rng.chance(_advProb))) {
            currentTier++;
            firstInTier = true;
            _tierJpFired = false;
            _tierSteps = []; _tierStepIdx = 0;
            logEvent('RED_SPIN_TIER_ADVANCE', { spinNum: spinNum, newTier: (TIERS[currentTier]||{}).name, advProb: _advProb, forced: _forceAdv });
          } else {
            logEvent('RED_SPIN_CONTINUANCE_END', { spinNum: spinNum, bonusTotal: bonusTotal });
            break;
          }
        }
      }
      // else: more steps remain in current sequence — continue automatically

      if (spinNum >= 200) break; // safety valve
    } // end while(true) tier loop

    // ── Sequence complete ──────────────────────────────────────────────
    if (typeof Audio !== 'undefined') { try { Audio.stopRedSpinMusic(); } catch(e) { console.warn('[RS] stopRedSpinMusic error:', e); } }
    if (typeof UI !== 'undefined') {
      // BUG-RS-SCREEN FIX (v8.1.17): Deactivate red screen FIRST so reels return to normal
      // the instant RS ends. Previously deactivateRedScreen() was called AFTER
      // showRedSpinEndCelebration() — red overlay persisted until player tapped or 5s elapsed.
      try {
        await UI.deactivateRedScreen();
      } catch(deactErr) {
        console.error('[RS] deactivateRedScreen threw:', deactErr);
      }
      try {
        await UI.showRedSpinEndCelebration(bonusTotal, spinNum);
      } catch(celebErr) {
        console.error('[RS] showRedSpinEndCelebration threw:', celebErr && celebErr.message ? celebErr.message : celebErr);
        console.error('[RS] Stack:', celebErr && celebErr.stack ? celebErr.stack : '');
      }
    }

    // Log bonus end
    logEvent('RED_SPIN_END', {
      bonusType:'RED_SPIN', totalSpins:spinNum,
      totalWon:bonusTotal, balanceAfter:GameState.balance,
      pendingRedSpins: 0 // removed v6l97
    });

    // ── Additional RS rounds ─────────────────────────────────────────────
    // Removed pendingRedSpins queue (v6l97 owner confirmed).
    // Additional RS only fires if the player presses SPIN after RS ends and
    // lands a winning combination — the natural base game RS trigger applies.
    // No automatic chaining from sub-bonus outcomes.

    // ── Sweep cleanup ──────────────────────────────────────────────────
    if (_sweepMode) {
      GameState.operator.rsSweepMode = false;
      GameState.operator.rsSweepTier = -1;
    }

    // v8.1.0: Multi-MINI celebration — 2+ MINIs in one RS session
    if (_rsMiniCount >= 2 && typeof UI !== 'undefined' && UI.showMultiMiniCelebration) {
      await UI.showMultiMiniCelebration(_rsMiniCount);
    }

    GameState.activeBonus = null;
    saveState();

    if (typeof UI !== 'undefined') UI.setControlsEnabled(true);

    return { totalWon: bonusTotal, spins: spinNum, events: [], outcome: { totalSpins: spinNum, totalWon: bonusTotal } };
  },


  // ── PICK & CHOOSE BONUS ──────────────────────────────────────────────────────
  runPickChoose: async function(betPerLine, linesActive, callerContext) { // v8.1.7: async fn expression — was ES6 async method shorthand (BUG-V3)
    if (callerContext === undefined) callerContext = {};
    // FIX-D (v8.1.10): ES5 shallowCopy helper — replaces Object.assign({}, src) which is ES6
    // and throws TypeError on JoiPlay/older Android WebView.
    function _shallowCopy(src) {
      var out = {};
      for (var _k in src) { if (Object.prototype.hasOwnProperty.call(src, _k)) out[_k] = src[_k]; }
      return out;
    }
    GameState.activeBonus = 'PICK_CHOOSE';
    var events = [], totalBet = betPerLine * linesActive, minAward = totalBet;
    // Jackpots via match-3 tiles only (unified system v6l96).
    var tiles = this._generatePickTiles(totalBet, minAward);
    // FIX-C (v8.1.10): replaced new Array(n).fill(false) — Array.prototype.fill() is ES6, throws on JoiPlay/older WebView
    var revealed = [];
    for (var _ri = 0; _ri < PICK_CHOOSE_GRID_SIZE; _ri++) { revealed.push(false); }
    var matchCounts = {};
    var won=false, totalWon=0, awardRedSpin=false, prize=null;

    if (typeof UI !== 'undefined') await UI.showPickChooseGrid(PICK_CHOOSE_GRID_SIZE);
    if (typeof Audio !== 'undefined') Audio.startPickMusic();
    logEvent('PICK_CHOOSE_ENTRY', { bonusType:'PICK_CHOOSE', gridSize:PICK_CHOOSE_GRID_SIZE, totalBet: totalBet });

    while (!won) {
      var unrevealedCount = 0;
      for (var uri = 0; uri < revealed.length; uri++) { if (!revealed[uri]) unrevealedCount++; }
      if (!unrevealedCount) break;
      var tileIndex = await this._waitForTileTap(revealed);
      if (tileIndex < 0) break;
      revealed[tileIndex] = true;

      // Per-tile JP check removed v6l96 — replaced by _pcEntryJackpot at entry.
      var finalTile = _shallowCopy(tiles[tileIndex]); // FIX-D

      if (typeof UI !== 'undefined') await UI.revealPickTile(tileIndex, finalTile, false, false);
      if (typeof Audio !== 'undefined') Audio.play('pick_reveal');

      var key = finalTile.type;
      matchCounts[key] = (matchCounts[key] || 0) + 1;
      var matchCountsCopy = _shallowCopy(matchCounts); // FIX-D
      var evt = logEvent('PICK_REVEAL', { bonusType:'PICK_CHOOSE', tileIndex: tileIndex, tile:finalTile, matchCounts:matchCountsCopy, isMatch: matchCounts[key] >= 3 });
      events.push(evt);
      if (typeof UI !== 'undefined') UI.updatePickMatches(matchCounts);

      if (matchCounts[key] >= 3) {
        // Match found — lock all tiles immediately
        if (typeof UI !== 'undefined') {
          UI.setPickTapCallback(null);
          if (UI._lockAllPickTiles) UI._lockAllPickTiles();
        }
        won = true;
        prize = finalTile;
        if (typeof Audio !== 'undefined') Audio.play('pick_match');

        if (['mini','minor','major','grand'].indexOf(key) >= 0) { // FIX-B (v8.1.10): .includes()→.indexOf() — ES5 compat (Samsung Browser/JoiPlay)
          totalWon = awardJackpot(key.toUpperCase());
          if (typeof Audio !== 'undefined') Audio.play('jackpot_' + key);
          if (typeof UI !== 'undefined') await UI.showJackpotCelebration(key.toUpperCase(), totalWon, 'PICK_CHOOSE');
        } else if (key === 'cash') {
          totalWon = Math.max(finalTile.value, minAward);
          GameState.balance += totalWon;
        } else if (key === 'red_spin') {
          awardRedSpin = true;
        } else if (key === 'bonus_cash') {
          // v8.0: bonus_cash — value awarded directly (awarded upstream in runBonusFeature)
        }

        saveState();
        if (typeof UI !== 'undefined') {
          await UI.showPickChooseWin(tileIndex, prize, totalWon, awardRedSpin, matchCounts);
        }
        break;
      }
    }

    if (typeof Audio !== 'undefined') Audio.stopPickMusic();
    if (typeof UI !== 'undefined') {
      await UI.endPickChoose(prize, totalWon, awardRedSpin);
      UI.updateBalance(GameState.balance);
      // Restore reels to P&C trigger position (shows 5-oak Lipstick briefly before returning)
      if (callerContext.triggerStops && callerContext.triggerGrid) {
        await UI.animateReelsStop(callerContext.triggerStops, callerContext.triggerGrid, false, false);
      }
    }
    logEvent('PICK_CHOOSE_END', { bonusType:'PICK_CHOOSE', prize: prize, totalWon: totalWon, awardRedSpin: awardRedSpin, matchCounts: matchCounts, balanceAfter:GameState.balance });
    GameState.activeBonus = null;
    // Jackpots in P&C are match-3 tiles only — no separate entry award.
    // When the player matches 3 jackpot tiles, awardJackpot fires in the match block above.
    return { totalWon: totalWon, awardRedSpin: awardRedSpin, events: events, outcome: { prize: prize, totalWon: totalWon, matchCounts: matchCounts } };
  },

  // ── FULLY PREDETERMINED PICK BOARD ─────────────────────────────────
  // Prize type AND amount decided by RNG before player picks anything.
  // Board is rigged: any tile player taps eventually completes match-3.
  // Method: decide winning prize type first, then fill board so exactly
  // 3 tiles of that type exist (the winning tiles), rest are "decoys"
  // of other types (also predetermined). Player ALWAYS finds 3 of the
  // winning type if they keep tapping — guaranteed.
  _generatePickTiles: function(totalBet, minAward) { // v8.1.7: ES5 — was ES6 method shorthand (BUG-V3)
    // v6l100 calibration — owner approved 2026-05-21.
    // Mirrors PICK_CHOOSE_PRIZES in paytable.js — must stay in sync.
    var PRIZE_WEIGHTS = [
      // v8.1.38 MC calibration — owner approved 2026-05-29. Mirrors PICK_CHOOSE_PRIZES in paytable.js.
      // Weights sum to exactly 1.0. JP weights calibrated to casino standard frequencies.
      { type:'cash_a',     weight:0.5625  }, // 56.25% cash
      { type:'cash_b',     weight:0.2200  }, // 22.00% cash
      { type:'bonus_cash', weight:0.04085 }, // 4.085% Bonus Cash
      { type:'red_spin',   weight:0.0600  }, // 6.00%  Red Spin
      { type:'mini',       weight:0.1000  }, // 10.00% MINI JP
      { type:'minor',      weight:0.0150  }, // 1.50%  MINOR JP
      { type:'major',      weight:0.0015  }, // 0.15%  MAJOR JP
      { type:'grand',      weight:0.00015 }, // 0.015% GRAND JP
      // SUM = 1.00000
    ];
    var CASH_TIERS = [
      // v8.1.38: recalibrated to $1.00/spin (1c/20L). Old: $5-$25/$25-$75/$75-$150 (5c/$10/spin).
      { minMult:0.25, maxMult:0.75 },  // small  ($0.25-$0.75)
      { minMult:0.75, maxMult:2.00 },  // medium ($0.75-$2.00)
      { minMult:2.00, maxMult:5.00 },  // large  ($2.00-$5.00)
    ];

    // 1. Decide the winning prize type and value
    var roll = rng.next();
    var cum = 0;
    var winEntry = PRIZE_WEIGHTS[0];
    for (var pi = 0; pi < PRIZE_WEIGHTS.length; pi++) {
      cum += PRIZE_WEIGHTS[pi].weight;
      if (roll < cum) { winEntry = PRIZE_WEIGHTS[pi]; break; }
    }
    // Map internal bucket names to the public prize type used everywhere else
    var winTypeName = (winEntry.type === 'cash_a' || winEntry.type === 'cash_b') ? 'cash' : winEntry.type;

    var winValue = 0;
    if (winTypeName === 'cash') {
      var tier = CASH_TIERS[rng.nextInt(0, 2)];
      // FIX-A1 v8.1.45: rng.nextInt() uses Math.floor — passing float min/max produced only 2 discrete
      // outputs (e.g. nextInt(0.25,0.75) → only 0.25 or 1.25). Use rng.next() interpolation for a
      // true continuous range across the full tier band.
      var tierMult = tier.minMult + rng.next() * (tier.maxMult - tier.minMult);
      winValue = Math.max(Math.round(totalBet * tierMult * 100) / 100, Math.round(minAward * 100) / 100);
    }
    var winPrize = { type: winTypeName, value: winValue };

    // 2. Build 15-tile board: exactly 3 winning tiles + 12 decoy tiles
    // Decoy types are all prize entries whose internal type does NOT map to the winning type.
    // Using the internal names (cash_a / cash_b) means both cash buckets are excluded when cash wins.
    // v8.1.40 BUG-PC-3: deduplicate after mapping — cash_a and cash_b both map to 'cash',
    // previously appearing twice in decoyTypes making cash 2x as likely in decoy selection.
    var decoyTypes = [];
    for (var di = 0; di < PRIZE_WEIGHTS.length; di++) {
      var pw = PRIZE_WEIGHTS[di];
      var pwPublic = (pw.type === 'cash_a' || pw.type === 'cash_b') ? 'cash' : pw.type;
      if (pwPublic !== winTypeName && decoyTypes.indexOf(pwPublic) < 0) decoyTypes.push(pwPublic);
    }

    var tiles = [];
    // Add 3 guaranteed winning tiles
    for (var wi = 0; wi < 3; wi++) { tiles.push({ type: winPrize.type, value: winPrize.value }); } // FIX-D: was Object.assign({}, winPrize) — ES6
    // Add 12 decoy tiles — each decoy type capped at max 2 occurrences.
    // With 12 decoys across types (max 2 each), no decoy type can reach match-3
    // before the 3 guaranteed winning tiles are found — win is always achievable.
    var decoyCounts = {};
    for (var dfi = 3; dfi < PICK_CHOOSE_GRID_SIZE; dfi++) {
      var dt, dattempts = 0;
      do {
        dt = decoyTypes[rng.nextInt(0, decoyTypes.length - 1)];
        dattempts++;
      } while ((decoyCounts[dt] || 0) >= 2 && dattempts < 20);
      decoyCounts[dt] = (decoyCounts[dt] || 0) + 1;
      var dv = 0;
      if (dt === 'cash') {
        var dTier = CASH_TIERS[rng.nextInt(0, CASH_TIERS.length - 1)];
        // FIX-A1 v8.1.45: same fix as winning cash — continuous range interpolation
        var dTierMult = dTier.minMult + rng.next() * (dTier.maxMult - dTier.minMult);
        dv = Math.max(Math.round(totalBet * dTierMult * 100) / 100, Math.round(minAward * 100) / 100);
      }
      tiles.push({ type: dt, value: dv });
    }

    // 3. Shuffle — winning tiles are randomly distributed
    for (var si = tiles.length - 1; si > 0; si--) {
      var sj = rng.nextInt(0, si);
      var stmp = tiles[si]; tiles[si] = tiles[sj]; tiles[sj] = stmp;
    }
    return tiles;
  },

  // ═══════════════════════════════════════════════════════════════════
  // BONUS FEATURE — B-O-N-U-S Letter Bonus
  // 3 glowing orbs animate on screen. Player picks one.
  // Fully predetermined — RNG decides before player taps.
  // Prizes: Red Spin | Pick & Choose | Hold & Spin (no jackpots)
  // ═══════════════════════════════════════════════════════════════════
  runBonusFeature: async function(betPerLine, linesActive, callerContext) { // v8.1.7: async fn expression — was ES6 async method shorthand (BUG-V3)
    if (callerContext === undefined) callerContext = {};
    GameState.activeBonus = 'BONUS_FEATURE';
    var events = [];
    var totalBet = betPerLine * linesActive;
    // Jackpots fully eligible for all sub-bonuses triggered via BONUS orb.
    // noJackpots suppression removed v6l114 — owner confirmed 2026-05-21.
    // Each sub-bonus (P&C, RS) runs its own _checkUnifiedJackpot() at entry.

    // ── STEP 1: Predetermined RNG — decide prize before player picks ──
    var prizes = ['red_spin', 'pick_choose', 'bonus_cash'];
    // Shuffle prizes so each orb position is random
    for (var bfi = prizes.length - 1; bfi > 0; bfi--) {
      var bfj = rng.nextInt(0, bfi);
      var bftmp = prizes[bfi]; prizes[bfi] = prizes[bfj]; prizes[bfj] = bftmp;
    }
    // winPosition here is a display placeholder only — it is overwritten with chosenIdx after the player taps.
    // The actual award is always prizes[chosenIdx]. (v6l114 — owner confirmed real player choice.)
    var winPosition = rng.nextInt(0, 2);
    var winPrize    = prizes[winPosition];

    // ── STEP 2: Show bonus orb selection screen ────────────────────────
    if (typeof UI !== 'undefined') await UI.showBonusOrbScreen(prizes, winPosition);
    if (typeof Audio !== 'undefined') Audio.startPickMusic();
    logEvent('BONUS_FEATURE_ENTRY', { bonusType:'BONUS_FEATURE', betPerLine: betPerLine, linesActive: linesActive, winPrize: winPrize, prizes: prizes });

    // ── STEP 3: Wait for player to tap an orb ─────────────────────────
    var chosenIdx = await this._waitForOrbTap();
    // Award whatever prize is genuinely behind the orb the player tapped.
    // Player choice is real — not predetermined. Shuffle above ensures each
    // orb hides a different sub-bonus so every tap is meaningful.
    // Owner confirmed v6l114 2026-05-21.
    winPrize    = prizes[chosenIdx];
    winPosition = chosenIdx;

    // BUG-ORB1 FIX v8.1.51: Calculate cash amount BEFORE revealBonusOrbs so it can be
    // passed into the UI for display on the orb and in the celebration.
    // Previously calculated after the UI call — player won cash but never saw the amount.
    var awardRedSpin = false, awardPickChoose = false;
    var bonusCashWon = 0;
    if (winPrize === 'bonus_cash') {
      var totalBetOrb = betPerLine * linesActive;
      var cashMult = 5 + Math.floor(rng.next() * 21); // 5–25x
      bonusCashWon = Math.round(cashMult * totalBetOrb * 100) / 100;
    }

    if (typeof UI !== 'undefined') await UI.revealBonusOrbs(prizes, winPosition, chosenIdx, bonusCashWon);
    if (typeof Audio !== 'undefined') Audio.play('pick_match');
    await this._delay(1200);

    // ── STEP 4: Award the orb the player actually chose ───────────────
    if (winPrize === 'bonus_cash') {
      GameState.balance += bonusCashWon;
      logEvent('BONUS_CASH_AWARD', { bonusType:'BONUS_FEATURE', amount:bonusCashWon, multiplier:cashMult });
      if (typeof UI !== 'undefined') UI.updateBalance(GameState.balance);
    }
    if (winPrize === 'red_spin')    awardRedSpin   = true;
    if (winPrize === 'pick_choose') awardPickChoose = true;

    if (typeof Audio !== 'undefined') Audio.stopPickMusic();
    if (typeof UI !== 'undefined') await UI.endBonusOrbScreen(winPrize, bonusCashWon);

    logEvent('BONUS_FEATURE_END', { bonusType:'BONUS_FEATURE', winPrize: winPrize, chosenIdx: chosenIdx, winPosition: winPosition });
    GameState.activeBonus = null;

    return { totalWon: bonusCashWon, awardRedSpin: awardRedSpin, awardPickChoose: awardPickChoose, events: events,
             outcome: { winPrize: winPrize, chosenIdx: chosenIdx, winPosition: winPosition } };
  },

  _waitForOrbTap: function() { // v8.1.7: ES5 — was ES6 method shorthand (BUG-V3)
    return new Promise(function(resolve) {
      if (typeof UI !== 'undefined') {
        // Delay before wiring tap — prevents tap-through from bonus trigger gesture
        setTimeout(function() {
          UI.setOrbTapCallback(resolve);
        }, 600);
      } else {
        setTimeout(function() { resolve(0); }, 500);
      }
    });
  },

  _waitForTileTap: function(revealed) { // v8.1.7: ES5 — was ES6 method shorthand (BUG-V3)
    return new Promise(function(resolve) {
      if (typeof UI !== 'undefined') {
        UI.setPickTapCallback(function(index) { if (!revealed[index]) resolve(index); });
      } else {
        var idx = -1;
        for (var ri = 0; ri < revealed.length; ri++) { if (!revealed[ri]) { idx = ri; break; } }
        setTimeout(function() { resolve(idx); }, 200);
      }
    });
  },


  _delay: function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }, // v8.1.7: ES5
};
