'use strict';
/**
 * state.js — The Turrelle Sisters Big Munny
 * Manages all game state and localStorage persistence.
 * ES5 rewrite v6l99 — removed const/let/arrow functions.
 */

var STATE_KEY   = 'turrelleSisters_v1';
var HISTORY_KEY = 'turrelle_game_history';
var HISTORY_MAX = 10000;

// FIX-B5 v8.1.46: ES5 zero-pad helper — replaces String.prototype.padStart() (ES2017)
// padStart() throws TypeError on older Android WebViews and JoiPlay.
function _zeroPad(n, len) { var s = String(n); while (s.length < len) s = '0' + s; return s; }

// ═══════════════════════════════════════════════════════════════════════
// GAME STATE — single source of truth
// ═══════════════════════════════════════════════════════════════════════
var GameState = {

  balance:            DEFAULT_BALANCE,
  lastBet:            DEFAULT_BET,
  lastLines:          DEFAULT_LINES,
  lastDenom:          0.05,
  lastCreditsPerLine: 1,

  spinInProgress: false,
  activeBonus:    null,
  bonusState:     null,
  replayMode:     false,

  jackpots: {
    MINI:  { current: JACKPOT_CONFIG.MINI.seed,  seed: JACKPOT_CONFIG.MINI.seed,  mustHitBy: JACKPOT_CONFIG.MINI.seed  * (JACKPOT_MHB_MULTIPLIERS ? JACKPOT_MHB_MULTIPLIERS.MINI  : 3) },
    MINOR: { current: JACKPOT_CONFIG.MINOR.seed, seed: JACKPOT_CONFIG.MINOR.seed, mustHitBy: JACKPOT_CONFIG.MINOR.seed * (JACKPOT_MHB_MULTIPLIERS ? JACKPOT_MHB_MULTIPLIERS.MINOR : 4) },
    MAJOR: { current: JACKPOT_CONFIG.MAJOR.seed, seed: JACKPOT_CONFIG.MAJOR.seed, mustHitBy: JACKPOT_CONFIG.MAJOR.seed * (JACKPOT_MHB_MULTIPLIERS ? JACKPOT_MHB_MULTIPLIERS.MAJOR : 5) },
    GRAND: { current: JACKPOT_CONFIG.GRAND.seed, seed: JACKPOT_CONFIG.GRAND.seed, mustHitBy: JACKPOT_CONFIG.GRAND.seed * (JACKPOT_MHB_MULTIPLIERS ? JACKPOT_MHB_MULTIPLIERS.GRAND : 6) },
  },

  stats: {
    totalWagered:      0,
    totalWon:          0,
    totalSpins:        0,
    biggestWin:        0,
    biggestWinDetail:  null,
    redSpinCount:      0,
    pickChooseCount:   0,
    bonusFeatureCount: 0,
    jackpotWins:       { MINI:0, MINOR:0, MAJOR:0, GRAND:0 },
    sessionStart:      Date.now(),
  },

  operator: {
    targetRTP:                TARGET_RTP_DEFAULT,
    holdPercentage:           100 - TARGET_RTP_DEFAULT,
    jackpotContribution:      JACKPOT_CONTRIBUTION_RATE_DEFAULT,
    bonusFrequencyMultiplier: 1.0,
    redSpinContinuance:       RED_SPIN_CONTINUANCE_DEFAULT,
    redSpinFrequency:         RED_SPIN_FREQUENCY_DEFAULT,
    // bonusFeatureFrequency removed v6l100 — BONUS orb triggers via bottom-row letters only, no RNG shortcut.
    maxWinPerSpin:            0,
    startingBalance:          DEFAULT_BALANCE,
    panelOpen:                false,
    comboArmed:               false,
    comboBonus:               'red_spin',
    comboJP:                  'MINI',
    // v7.0.2 — multi-bonus combo: object of booleans for each bonus type
    comboModes: { red_spin: false, pick_choose: false, bonus_letters: false },
    // v7.0.2 — multi-jackpot queue: array of tier strings e.g. ['MINI','MAJOR'] for P&C
    forceJackpotQueue:        [],
    // v7.0.2 — RS tier-to-jackpot map: { 0:'MINI', 1:'MINOR', 2:'MAJOR', 3:'GRAND' }
    // Each key is a tier index (0=T1...3=T4), value is the jackpot type or null for no force.
    forceRSTierMap:           {},
    // v7.0.2 — RS sweep mode: plays all winning combos within each tier for QA
    rsSweepMode:              false,
    rsSweepTier:              -1,
    forceRSEntryTier:         -1,   // v8.1.25: -1=random, 0-3=force T1-T4
    forceRSStepCount:         -1,   // v8.1.25: -1=random, 4/5/6=force step count
    forceRSAdvance:           false, // v8.1.25: force next continuance-fail to advance tier    // -1=ALL tiers, 0-3=specific tier index
    forceFreeSpins:           false,
    forceBonusFeature:        false,
    forceRedSpin:             false,
    forceJackpot:             'none',
    forceJackpotContext:      'bonus',
    forceReelStops:           [null, null, null, null, null],
    disablePickChooseInRedSpin: true,
    _forcedSpin: false,  // v8.1.58: true during operator-forced spins — excluded from RTP stats
  },

  eventLog: {
    allEvents:   [],
    games:       [],
    currentGame: null,
    gameCounter: 0,
  },

  spinHistory: [],
};

// ═══════════════════════════════════════════════════════════════════════
// PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════

function saveState() {
  try {
    var payload = {
      balance:            GameState.balance,
      lastBet:            GameState.lastBet,
      lastLines:          GameState.lastLines,
      lastDenom:          GameState.lastDenom,
      lastCreditsPerLine: GameState.lastCreditsPerLine,
      jackpots:           GameState.jackpots,
      stats:              GameState.stats,
      operator: (function() {
        // BUG-ES6-1 FIX (v8.1.19): Object.assign() replaced — ES5 manual snapshot.
        // saveState fires every spin; Object.assign on Samsung Browser <10 / JoiPlay crashes.
        var op = GameState.operator;
        return {
          targetRTP: op.targetRTP, holdPercentage: op.holdPercentage,
          jackpotContribution: op.jackpotContribution,
          bonusFrequencyMultiplier: op.bonusFrequencyMultiplier,
          redSpinContinuance: op.redSpinContinuance, redSpinFrequency: op.redSpinFrequency,
          maxWinPerSpin: op.maxWinPerSpin, startingBalance: op.startingBalance,
          panelOpen: false,  // always reset on save
          comboArmed: op.comboArmed, comboBonus: op.comboBonus, comboJP: op.comboJP,
          comboModes: { red_spin: op.comboModes.red_spin, pick_choose: op.comboModes.pick_choose, bonus_letters: op.comboModes.bonus_letters },
          forceJackpotQueue: op.forceJackpotQueue.slice(),
          forceRSTierMap: (function() { var m = {}; var keys = Object.keys(op.forceRSTierMap); for (var ki = 0; ki < keys.length; ki++) { m[keys[ki]] = op.forceRSTierMap[keys[ki]]; } return m; })(),
          rsSweepMode: op.rsSweepMode, rsSweepTier: op.rsSweepTier,
          forceRSEntryTier: op.forceRSEntryTier, forceRSStepCount: op.forceRSStepCount, forceRSAdvance: op.forceRSAdvance,
          forceFreeSpins: op.forceFreeSpins, forceBonusFeature: op.forceBonusFeature,
          forceRedSpin: op.forceRedSpin, forceJackpot: op.forceJackpot,
          forceJackpotContext: op.forceJackpotContext,
          forceReelStops: op.forceReelStops.slice(),
          disablePickChooseInRedSpin: op.disablePickChooseInRedSpin,
        };
      })(),
      eventLog: {
        allEvents:   GameState.eventLog.allEvents,
        games:       GameState.eventLog.games,
        gameCounter: GameState.eventLog.gameCounter,
      },
    };
    localStorage.setItem(STATE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('State save failed:', e);
  }
}

function loadState() {
  try {
    var raw = localStorage.getItem(STATE_KEY);
    if (!raw) return false;
    var saved = JSON.parse(raw);

    if (saved.balance            !== undefined) GameState.balance            = saved.balance;
    if (saved.lastBet            !== undefined) GameState.lastBet            = saved.lastBet;
    if (saved.lastLines          !== undefined) GameState.lastLines          = saved.lastLines;
    if (saved.lastDenom          !== undefined) GameState.lastDenom          = saved.lastDenom;
    if (saved.lastCreditsPerLine !== undefined) GameState.lastCreditsPerLine = saved.lastCreditsPerLine;
    // v8.1.58 FIX: always re-derive creditsPerLine from DENOM_CREDIT_LOCK to prevent stale 1cr/line bug.
    // Old saved states may have creditsPerLine=1 from earlier builds.
    if (GameState.lastDenom && typeof DENOM_CREDIT_LOCK !== 'undefined' && DENOM_CREDIT_LOCK[GameState.lastDenom]) {
      GameState.lastCreditsPerLine = DENOM_CREDIT_LOCK[GameState.lastDenom];
    }

    if (saved.jackpots) {
      Object.keys(GameState.jackpots).forEach(function(key) {
        if (saved.jackpots[key]) {
          GameState.jackpots[key].current = saved.jackpots[key].current;
          GameState.jackpots[key].seed    = saved.jackpots[key].seed;
          if (saved.jackpots[key].mustHitBy != null) {
            GameState.jackpots[key].mustHitBy = saved.jackpots[key].mustHitBy;
          } else {
            var mhbMult = JACKPOT_MHB_MULTIPLIERS ? (JACKPOT_MHB_MULTIPLIERS[key] || 4) : 4;
            GameState.jackpots[key].mustHitBy = GameState.jackpots[key].seed * mhbMult;
          }
        }
      });
    }

    // BUG-ES6-1 FIX (v8.1.19): Object.assign() replaced with ES5 _mergeKeys helper.
    // Only copies keys that already exist in target — safe upgrade-compatible merge.
    function _mergeKeys(target, src) {
      var keys = Object.keys(src);
      for (var ki = 0; ki < keys.length; ki++) {
        if (Object.prototype.hasOwnProperty.call(target, keys[ki])) {
          target[keys[ki]] = src[keys[ki]];
        }
      }
    }
    if (saved.stats)    _mergeKeys(GameState.stats,    saved.stats);
    if (saved.operator) _mergeKeys(GameState.operator, saved.operator);

    if (saved.eventLog) {
      if (saved.eventLog.allEvents)   GameState.eventLog.allEvents   = saved.eventLog.allEvents;
      if (saved.eventLog.games)       GameState.eventLog.games       = saved.eventLog.games;
      if (saved.eventLog.gameCounter) GameState.eventLog.gameCounter = saved.eventLog.gameCounter;
    }

    loadSpinHistory();
    GameState.stats.sessionStart = Date.now();
    console.warn('[State] Restored — Balance: $' + GameState.balance.toFixed(2));
    return true;
  } catch (e) {
    console.warn('State load failed:', e);
    return false;
  }
}

function resetState(options) {
  if (options === undefined) options = {};
  var keepJackpots = options.keepJackpots !== undefined ? options.keepJackpots : false;
  var keepStats    = options.keepStats    !== undefined ? options.keepStats    : false;
  var keepOperator = options.keepOperator !== undefined ? options.keepOperator : true;
  var newBalance   = options.newBalance   !== undefined ? options.newBalance   : GameState.operator.startingBalance;

  GameState.balance        = newBalance;
  GameState.lastBet        = DEFAULT_BET;
  GameState.lastLines      = DEFAULT_LINES;
  GameState.spinInProgress = false;
  GameState.activeBonus    = null;
  GameState.bonusState     = null;

  if (!keepJackpots) {
    Object.keys(GameState.jackpots).forEach(function(key) {
      GameState.jackpots[key].current = GameState.jackpots[key].seed;
    });
  }

  if (!keepStats) {
    GameState.stats = {
      totalWagered: 0, totalWon: 0, totalSpins: 0,
      biggestWin: 0, biggestWinDetail: null,
      redSpinCount: 0, pickChooseCount: 0, bonusFeatureCount: 0,
      jackpotWins: { MINI:0, MINOR:0, MAJOR:0, GRAND:0 },
      sessionStart: Date.now(),
    };
    clearSpinHistory();
  }

  GameState.eventLog = { allEvents:[], games:[], currentGame:null, gameCounter:0 };

  if (!keepOperator) {
    GameState.operator.targetRTP                 = TARGET_RTP_DEFAULT;
    GameState.operator.holdPercentage            = 100 - TARGET_RTP_DEFAULT;
    GameState.operator.jackpotContribution       = JACKPOT_CONTRIBUTION_RATE_DEFAULT;
    GameState.operator.bonusFrequencyMultiplier  = 1.0;
    GameState.operator.redSpinContinuance        = RED_SPIN_CONTINUANCE_DEFAULT;
    GameState.operator.maxWinPerSpin             = 0;
  }

  saveState();
}

function resetJackpotValues() {
  Object.keys(GameState.jackpots).forEach(function(key) {
    GameState.jackpots[key].current = GameState.jackpots[key].seed;
  });
  saveState();
}

function resetSingleJackpot(key) {
  if (GameState.jackpots[key]) {
    GameState.jackpots[key].current = GameState.jackpots[key].seed;
    saveState();
  }
}

// ═══════════════════════════════════════════════════════════════════════
// JACKPOT MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════

function contributeToJackpots(totalBet) {
  var rate = GameState.operator.jackpotContribution;
  var pool = totalBet * rate;
  Object.keys(GameState.jackpots).forEach(function(key) {
    GameState.jackpots[key].current += pool * JACKPOT_SPLIT[key];
  });
  saveState();
}

function awardJackpot(key) {
  var amount = GameState.jackpots[key].current;
  GameState.balance += amount;
  // NOTE: do NOT add to stats.totalWon here — recordSpin() is the single point of truth.
  GameState.stats.jackpotWins[key]++;
  resetSingleJackpot(key);
  saveState();
  return amount;
}

// ═══════════════════════════════════════════════════════════════════════
// EVENT LOGGING
// ═══════════════════════════════════════════════════════════════════════

function formatTimestamp(ts) {
  var d = new Date(ts);
  return d.toLocaleString('en-US', {
    month:'2-digit', day:'2-digit', year:'2-digit',
    hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false,
  });
}

function startGameRecord(bet) {
  var g = GameState.eventLog;
  g.gameCounter++;
  g.currentGame = {
    gameId:        'game_' + _zeroPad(g.gameCounter, 4),
    gameNumber:    g.gameCounter,
    timestamp:     Date.now(),
    timeFormatted: formatTimestamp(Date.now()),
    bet:           { perLine: bet.perLine, lines: bet.lines, total: bet.total },
    reelStops:     null,
    grid:          null,
    baseResult:    null,
    bonuses:       [],
    summary:       null,
  };
}

function logEvent(type, data) {
  if (data === undefined) data = {};
  var g   = GameState.eventLog;
  var now = Date.now();
  var evt = {
    id:            'evt_' + now + '_' + g.allEvents.length,
    type:          type,
    timestamp:     now,
    timeFormatted: formatTimestamp(now),
    gameId:        (g.currentGame && g.currentGame.gameId) ? g.currentGame.gameId : 'system',
  };
  // BUG-ES6-2 FIX (v8.1.20): Object.assign(evt, data) replaced — last Object.assign in codebase.
  // Fires on every spin-start, bonus trigger, jackpot, and game-event log call.
  var _dataKeys = Object.keys(data);
  for (var _di = 0; _di < _dataKeys.length; _di++) { evt[_dataKeys[_di]] = data[_dataKeys[_di]]; }
  g.allEvents.push(evt);
  if (g.allEvents.length > 500) g.allEvents.shift();
  return evt;
}

function finalizeGameRecord(summary) {
  var g    = GameState.eventLog;
  var game = g.currentGame;
  if (!game) return;

  game.summary = summary;
  g.games.unshift(game);
  if (g.games.length > 10) g.games.pop();
  g.currentGame = null;

  recordSpinHistory(game);
  saveState();
}

// ═══════════════════════════════════════════════════════════════════════
// PHASE L — PERSISTENT SPIN HISTORY
// ═══════════════════════════════════════════════════════════════════════

function loadSpinHistory() {
  try {
    var raw = localStorage.getItem(HISTORY_KEY);
    GameState.spinHistory = raw ? JSON.parse(raw) : [];
  } catch(e) {
    console.warn('[History] Load failed:', e);
    GameState.spinHistory = [];
  }
}

function recordSpinHistory(gameRecord) {
  if (!Array.isArray(GameState.spinHistory)) GameState.spinHistory = [];
  GameState.spinHistory.unshift(gameRecord);
  if (GameState.spinHistory.length > HISTORY_MAX) {
    GameState.spinHistory = GameState.spinHistory.slice(0, HISTORY_MAX);
  }
  var saved = false;
  while (!saved && GameState.spinHistory.length > 0) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(GameState.spinHistory));
      saved = true;
    } catch(e) {
      GameState.spinHistory.pop();
    }
  }
}

function clearSpinHistory() {
  GameState.spinHistory = [];
  try { localStorage.removeItem(HISTORY_KEY); } catch(e) {}
}

function exportHistoryCSV() {
  var headers = ['spin','timestamp','denom','cpl','lines','total_bet',
    'center_row','reel_stops','base_win','bonuses','bonus_win',
    'jackpot_type','jackpot_amt','balance_before','balance_after','net'].join(',');
  var rows = (GameState.spinHistory || []).map(function(g) {
    var s  = g.summary || {};
    var br = g.baseResult || {};
    var bonusTypes = (g.bonuses || []).map(function(b){ return b.type; }).join('|');
    var bonusWin   = (s.totalWon || 0) - (br.totalWin || 0);
    return [
      g.gameNumber || '',
      g.timeFormatted || '',
      g.denom || '',
      g.creditsPerLine || '',
      (g.bet && g.bet.lines) || '20',
      (g.bet && g.bet.total != null) ? g.bet.total.toFixed(2) : '',
      (g.centerRow || []).join('-'),
      (g.reelStops || []).join('-'),
      (br.totalWin != null) ? br.totalWin.toFixed(2) : '0',
      bonusTypes || 'none',
      bonusWin.toFixed(2),
      g.jackpotType || '',
      (g.jackpotAmt != null) ? g.jackpotAmt.toFixed(2) : '',
      (s.balanceBefore != null) ? s.balanceBefore.toFixed(2) : '',
      (s.balanceAfter  != null) ? s.balanceAfter.toFixed(2)  : '',
      (s.netResult     != null) ? s.netResult.toFixed(2)     : '',
    ].map(function(v){ return '"' + String(v).replace(/"/g, '""') + '"'; }).join(',');
  });
  _downloadFile(
    'turrelle_history_' + Date.now() + '.csv',
    [headers].concat(rows).join('\n'),
    'text/csv'
  );
}

function exportHistoryJSON() {
  var data = {
    exportedAt:   formatTimestamp(Date.now()),
    version:      '2.0',
    totalRecords: (GameState.spinHistory || []).length,
    stats:        GameState.stats,
    history:      GameState.spinHistory || [],
  };
  _downloadFile(
    'turrelle_history_' + Date.now() + '.json',
    JSON.stringify(data, null, 2),
    'application/json'
  );
}

// ═══════════════════════════════════════════════════════════════════════
// STATS HELPERS
// ═══════════════════════════════════════════════════════════════════════

function recordSpin(totalBet, totalWon) {
  var s = GameState.stats;
  s.totalSpins++;
  // v8.1.58: operator-forced spins excluded from RTP metrics (Rule — op triggers are for testing only)
  if (!GameState.operator._forcedSpin) {
    s.totalWagered += totalBet;
    s.totalWon     += totalWon;
    if (totalWon > s.biggestWin) s.biggestWin = totalWon;
  }
  GameState.operator._forcedSpin = false; // always reset after each spin
  if (!s.sessionStart) s.sessionStart = Date.now();
}

function getActualRTP() {
  var s = GameState.stats;
  if (s.totalWagered === 0) return 0;
  return (s.totalWon / s.totalWagered) * 100;
}

function getSessionDuration() {
  if (!GameState.stats.sessionStart) return '00:00:00';
  var ms  = Date.now() - GameState.stats.sessionStart;
  var h   = Math.floor(ms / 3600000);
  var m   = Math.floor((ms % 3600000) / 60000);
  var sec = Math.floor((ms % 60000) / 1000);
  return _zeroPad(h, 2) + ':' + _zeroPad(m, 2) + ':' + _zeroPad(sec, 2);
}

// ═══════════════════════════════════════════════════════════════════════
// EXPORT LOG AS FILE
// ═══════════════════════════════════════════════════════════════════════

function exportLogAsCSV() {
  var headers = ['EventID','Type','Timestamp','GameID','BetTotal','TotalWin','NetResult','BalanceAfter','BonusType'];
  var rows = GameState.eventLog.allEvents.map(function(e) {
    var betTotal  = (e.bet && e.bet.total != null) ? e.bet.total  : '';
    var totalWin  = (e.totalWin    != null) ? e.totalWin    : '';
    var netResult = (e.netResult   != null) ? e.netResult   : '';
    var balAfter  = (e.balanceAfter != null) ? e.balanceAfter : '';
    var bonusType = (e.bonusType   != null) ? e.bonusType   : '';
    return [e.id, e.type, e.timeFormatted, e.gameId, betTotal, totalWin, netResult, balAfter, bonusType]
      .map(function(v) { return '"' + v + '"'; }).join(',');
  });
  _downloadFile('turrelle_log_' + Date.now() + '.csv', [headers.join(',')].concat(rows).join('\n'), 'text/csv');
}

function exportLogAsJSON() {
  var data = {
    exportedAt:  formatTimestamp(Date.now()),
    version:     '1.0',
    stats:       GameState.stats,
    last10Games: GameState.eventLog.games,
    allEvents:   GameState.eventLog.allEvents,
  };
  _downloadFile('turrelle_log_' + Date.now() + '.json', JSON.stringify(data, null, 2), 'application/json');
}

function _downloadFile(filename, content, mime) {
  var blob = new Blob([content], { type: mime });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
