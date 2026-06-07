'use strict';
/**
 * paytable.js — The Turrelle Sisters Big Munny v8.1.43
 * v8.0 redesign: Hold & Spin removed. Dollar Bills replaces Dollar Bills (id:9).
 * Wild multiplier: Josie +×2, Sasha +×1, additive, no cap. Formula: 1+(josie×2)+(sasha×1).
 * Jackpot entry: Red Spin (per tier) and Pick & Choose only.
 * MC calibrated 2026-05-29: 97% target RTP @ 1c/20L. See diagnostic_report_v8.1.43.md.
 */

// ═══════════════════════════════════════════════════════════════════════
// SYMBOL DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════
var SYMBOLS = {
  SISTERS:    { id:0,  name:'Sisters',   type:'png', file:'assets/sisters.png',              isWild:false, isScatter:false, isBonus:false },
  JOSIE:      { id:1,  name:'Josie',     type:'png', file:'assets/josie.png',                isWild:true,  isScatter:false, isBonus:false },
  SASHA:      { id:2,  name:'Sasha',     type:'png', file:'assets/sasha.png',                isWild:true,  isScatter:false, isBonus:false },
  SEVEN:      { id:3,  name:'Seven',     type:'svg', file:'assets/symbols/seven.svg',        isWild:false, isScatter:false, isBonus:false },
  TRIPLE_BAR: { id:4,  name:'3 Bar',     type:'svg', file:'assets/symbols/triple_bar.svg',   isWild:false, isScatter:false, isBonus:false },
  DOUBLE_BAR: { id:5,  name:'2 Bar',     type:'svg', file:'assets/symbols/double_bar.svg',   isWild:false, isScatter:false, isBonus:false },
  SINGLE_BAR: { id:6,  name:'1 Bar',     type:'svg', file:'assets/symbols/single_bar.svg',   isWild:false, isScatter:false, isBonus:false },
  LIPSTICK:   { id:8,  name:'Lipstick',  type:'svg', file:'assets/symbols/lipstick.svg',     isWild:false, isScatter:false, isBonus:true  },
  // Dollar Bills, a standard paying symbol. Asset: assets/symbols/dollar_bills.svg.
  DOLLAR_BILLS: { id:9,  name:'DollarBills', type:'svg', file:'assets/symbols/dollar_bills.svg',    isWild:false, isScatter:false, isBonus:false },
  LETTER_B:   { id:10, name:'LetterB',   type:'svg', file:'assets/symbols/letter_b.svg',     isWild:false, isScatter:false, isBonus:false, isLetter:true, letter:'B', letterReel:0 },
  LETTER_O:   { id:11, name:'LetterO',   type:'svg', file:'assets/symbols/letter_o.svg',     isWild:false, isScatter:false, isBonus:false, isLetter:true, letter:'O', letterReel:1 },
  LETTER_N:   { id:12, name:'LetterN',   type:'svg', file:'assets/symbols/letter_n.svg',     isWild:false, isScatter:false, isBonus:false, isLetter:true, letter:'N', letterReel:2 },
  LETTER_U:   { id:13, name:'LetterU',   type:'svg', file:'assets/symbols/letter_u.svg',     isWild:false, isScatter:false, isBonus:false, isLetter:true, letter:'U', letterReel:3 },
  LETTER_S:   { id:14, name:'LetterS',   type:'svg', file:'assets/symbols/letter_s.svg',     isWild:false, isScatter:false, isBonus:false, isLetter:true, letter:'S', letterReel:4 },
  DIAMOND:    { id:15, name:'Diamond',   type:'svg', file:'assets/symbols/diamond.svg',      isWild:false, isScatter:false, isBonus:false },
  DJ_MAXINE:  { id:16, name:'DJ Maxine', type:'png', file:'assets/maxine.png',               isWild:false, isScatter:false, isBonus:false },
  STRAYPUP:   { id:17, name:'StrayPup',  type:'png', file:'assets/scott.png',                isWild:false, isScatter:false, isBonus:false },
};

var SYMBOL_BY_ID = (function() {
  var _map = {}, _keys = Object.keys(SYMBOLS);
  for (var _i = 0; _i < _keys.length; _i++) { var _s = SYMBOLS[_keys[_i]]; _map[_s.id] = _s; }
  return _map;
}());
var WILD_IDS    = [SYMBOLS.JOSIE.id, SYMBOLS.SASHA.id];
var BONUS_PC_ID = SYMBOLS.LIPSTICK.id;
var BONUS_ID    = null;
var LETTER_IDS  = [10, 11, 12, 13, 14];
var LETTER_ORDER = ['B','O','N','U','S'];

// Partial pays × bet per line (left-to-right consecutive, same row)
// Full BONUS (all 5) triggers bonus feature — no credit pay
// BONUS letter pays — index = consecutive count from reel 1 (0=none, 1=B, 2=B-O, 3=B-O-N, 4=B-O-N-U)
// 5 letters on bottom row = BONUS trigger (no cash). 5 on any other row impossible by reel design (S bottom-row only).
var BONUS_LETTER_PAYS = [0, 2, 4, 8, 20]; // v8.1.58 — B=2cr($0.10), B-O=4cr($0.20), B-O-N=8cr($0.40), B-O-N-U=20cr($1.00), B-O-N-U-S=Bonus Game // v8.1.38 MC calibration 2026-05-29 — index=letterCount, credits × betPerLine. 5 letters = BONUS ORB trigger (no cash).

// ═══════════════════════════════════════════════════════════════════════
// PAYTABLE — Classic casino style
// Format: [5-of-a-kind, 4-of-a-kind, 3-of-a-kind, 2-of-a-kind]
//
// Classic mapping for display:
//  5 Sisters  = GRAND JACKPOT
//  5 Josie/Sasha = MAJOR JACKPOT  
//  5 Seven    = 500× 
//  3 Bar      = 250×
//  2 Bar      = 100×
//  1 Bar      = 50×
//  Lipstick   = scatter / Pick & Choose trigger
//  Dollar Bills  = Hold & Spin trigger
// ═══════════════════════════════════════════════════════════════════════
// ── PAY TABLE — v8.1.38+ ─────────────────────────────────────────────
// Wild multiplier (v8.1.38, owner confirmed 2026-05-29): Josie +×2, Sasha +×1, additive, no cap.
//   Formula: 1 + (josieCount×2) + (sashaCount×1)
// Format: [5-oak, 4-oak, 3-oak, 2-oak] × bet/line
var PAY_TABLE = {
  // v8.1.44 MC CALIBRATION — owner approved 2026-05-29.
  // PAY_TABLE scaled ×0.84 from v8.1.38 values to compensate for mixed bar RTP addition (~12.5%).
  // Mixed bars now pay {3:1,4:2,5:4}cr with wild multiplier — see MIXED_BAR_PAY below.
  // Target RTP 96-98% at 1c/20L. Full MC in diagnostic_report_v8.1.44.md.
  // Format: [5-oak, 4-oak, 3-oak, 2-oak] credits × betPerLine
  SISTERS:    [   0,   0,    0,  0],  // GRAND jackpot trigger only
  JOSIE:      [   0,   0,    0,  0],  // +×2 multiplier, MINOR JP — no payline pay
  SASHA:      [   0,   0,    0,  0],  // +×1 multiplier, MINI JP — no payline pay
  // v8.1.58 — owner-approved whole-number pay table. All values unique per oak count.
  // 1c/5cr/20L: BPL=$0.05. Est total RTP ~97% (base ~64% + wilds + bonuses + jackpots).
  STRAYPUP:   [ 150,  80,   40,  0],  // 5-oak=$7.50, 4-oak=$4.00, 3-oak=$2.00
  DJ_MAXINE:  [  60,  40,   20,  0],  // 5-oak=$3.00, 4-oak=$2.00, 3-oak=$1.00
  SEVEN:      [  25,  15,   10,  0],  // 5-oak=$1.25, 4-oak=$0.75, 3-oak=$0.50
  DIAMOND:    [  20,  12,    6,  0],  // 5-oak=$1.00, 4-oak=$0.60, 3-oak=$0.30
  DOLLAR_BILLS: [ 15,   8,   5,  0],  // 5-oak=$0.75, 4-oak=$0.40, 3-oak=$0.25
  TRIPLE_BAR: [  10,   6,    4,  0],  // 5-oak=$0.50, 4-oak=$0.30, 3-oak=$0.20
  DOUBLE_BAR: [   8,   5,    3,  0],  // 5-oak=$0.40, 4-oak=$0.25, 3-oak=$0.15
  SINGLE_BAR: [   6,   3,    2,  0],  // 5-oak=$0.30, 4-oak=$0.15, 3-oak=$0.10
  LIPSTICK:   [   0,   0,    0,  0],  // P&C trigger — no credit pay
};

// ═══════════════════════════════════════════════════════════════════════
// PAY_TABLE_BY_DENOM and getPayTableForDenom permanently removed v8.1.1
// Per-denom RTP calibration deferred — will be re-added in a future session when needed.


// Mixed Bar: ANY mix of Single/Double/Triple Bar on any payline (3-5 consecutive from reel 1)
// v6k3 RTP tuning: reduced from 5/15/35 → 3/10/25
var MIXED_BAR_PAY = { 3: 3, 4: 5, 5: 8 }; // v8.1.58 — owner-approved: 3-mix=$0.15, 4-mix=$0.25, 5-mix=$0.40 — raised from {3:1,4:2,5:4} to compensate for lower win frequency with new reel strips. 3-oak=2cr, 4-oak=4cr, 5-oak=6cr.
var BAR_IDS = [SYMBOLS.TRIPLE_BAR.id, SYMBOLS.DOUBLE_BAR.id, SYMBOLS.SINGLE_BAR.id];

// Wild multiplier — v8.1.38 (owner confirmed 2026-05-29)
// Josie (id:1) contributes +×2 per occurrence. Sasha (id:2) contributes +×1 per occurrence.
// Formula: multiplier = 1 + (josieCount × 2) + (sashaCount × 1). Additive, NO CAP.
// All-wild line (no base symbol): returns $0 — Josie/Sasha are multiplier+JP triggers only.
// Examples: 1J=×3 | 1Sa=×2 | 1J+1Sa=×4 | 2J=×5 | 2J+1Sa=×6 | 3J=×7 | 2J+2Sa=×7
// See GAME_DESIGN_MANUAL.md §5.

// BONUS_PC_ID = Lipstick. 5-oak on center payline (Line 1, middle row) = Pick & Choose trigger.
// Lipstick pays [0,0,0,0] on all paylines — bonus trigger only (owner-confirmed 2026-05-18).

// ═══════════════════════════════════════════════════════════════════════
// REEL STRIPS — Casino-style distribution, 80 stops per reel
// ═══════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════
// REEL STRIPS — 80 stops per reel
// ═══════════════════════════════════════════════════════════════════════
var REEL_SIZE = 80;

// Symbol ID key:
//   0=Sisters  1=Josie  2=Sasha   3=Seven  4=TripleBar  5=DoubleBar  6=SingleBar
//   8=Lipstick 9=DollarBills(v8.0 — standard paying symbol)
//   10=B  11=O  12=N  13=U  14=S   15=Diamond  16=DJMaxine  17=StrayPup
//
// v8.0 — id:9 counts unchanged (11/reel). DollarBills is now evaluated normally by evaluateLine.
var REEL_FREQUENCIES = [
  // v8.1.56 recalibration — Lipstick(8) reduced from 16-18 → 6 per reel.
  // Freed stops redistributed to paying symbols (Dollar Bills, Diamond, Seven, Bars).
  // This raises base payline RTP from ~28% to ~53%. PAY_TABLE also recalibrated.
  // Symbol ID key:
  //   0=Sisters  1=Josie  2=Sasha   3=Seven  4=TripleBar  5=DoubleBar  6=SingleBar
  //   8=Lipstick 9=DollarBills  10=B  11=O  12=N  13=U  14=S  15=Diamond  16=DJMaxine  17=StrayPup
  // All reels Σ=80 ✅ (MC verified)

  // Reel 1 — B(10)×4  | Lip 16→6 frees 10: +3 DollarBills(9), +3 Diamond(15), +2 Seven(3), +2 SingleBar(6) | Σ=80 ✅
  { 0:1, 1:2, 2:3, 17:2, 16:3, 3:9, 15:11, 9:13, 4:8, 5:8, 6:10, 8:6, 10:4 },

  // Reel 2 — O(11)×4  | Lip 18→6 frees 12: +3 DollarBills, +3 Diamond, +2 Seven, +2 TripleBar, +2 DoubleBar | Σ=80 ✅
  { 0:1, 1:2, 2:3, 17:2, 16:3, 3:9, 15:11, 9:13, 4:9, 5:9, 6:8,  8:6, 11:4 },

  // Reel 3 — N(12)×4  | Lip 18→6 frees 12: same redistribution | Σ=80 ✅
  { 0:1, 1:2, 2:3, 17:2, 16:3, 3:9, 15:11, 9:13, 4:9, 5:7, 6:10, 8:6, 12:4 },

  // Reel 4 — U(13)×4  | Lip 18→6 frees 12 | Σ=80 ✅
  { 0:1, 1:2, 2:3, 17:2, 16:3, 3:9, 15:11, 9:13, 4:9, 5:7, 6:10, 8:6, 13:4 },

  // Reel 5 — S(14)×4  | Lip 18→6 frees 12: same redistribution | Σ=80 ✅
  { 0:1, 1:2, 2:3, 17:2, 16:3, 3:9, 15:11, 9:13, 4:9, 5:9, 6:8,  8:6, 14:4 },
];

function buildReelStrips(frequencies) {
  return frequencies.map(function(freq, reelIdx) {
    var strip = [];
    // ES5 rewrite — Object.entries() not safe on Samsung Browser < 6 (v6l111)
    var _fkeys = Object.keys(freq);
    for (var _fi = 0; _fi < _fkeys.length; _fi++) {
      var id = parseInt(_fkeys[_fi]), count = freq[_fkeys[_fi]];
      for (var i = 0; i < count; i++) strip.push(id);
    }
    if (strip.length !== REEL_SIZE) {
      console.error('Reel ' + (reelIdx+1) + ' frequency total is ' + strip.length + ', expected ' + REEL_SIZE);
    }
    // ── Per-session crypto shuffle (v6l114) ────────────────────────────
    // Uses crypto.getRandomValues() so every player session gets a unique
    // reel strip layout. Prevents stop-position reverse engineering.
    // Owner confirmed 2026-05-21. Symbol frequencies are unchanged — only ordering varies.
    var _shuffleBuf = new Uint32Array(strip.length);
    crypto.getRandomValues(_shuffleBuf);
    for (var i = strip.length - 1; i > 0; i--) {
      var j = _shuffleBuf[i] % (i + 1);
      var tmp = strip[i]; strip[i] = strip[j]; strip[j] = tmp;
    }

    // ── Minimum spacing enforcement ────────────────────────────────────
    // Prevents the same low-frequency symbol (≤12 per reel) from appearing
    // in adjacent stops — which causes two of the same symbol to show in the
    // 3-row visible window at once (e.g. two B's in column 1).
    // MIN_GAP=3 for all symbols — ensures visual spread across reel strip. v8.1.1: BONUS_ID exception removed.
    // so that multiple coins can appear in the 3-row window simultaneously,
    var DEFAULT_GAP = 3;
    var len = strip.length;
    for (var pass = 0; pass < 8; pass++) {
      var moved = false;
      for (var si = 0; si < len; si++) {
        var sym = strip[si];
        var symCount = 0;
        for (var sc = 0; sc < len; sc++) { if (strip[sc] === sym) symCount++; }
        var MIN_GAP = DEFAULT_GAP; // v8.1.1: BONUS_ID null check removed — all symbols use DEFAULT_GAP
        if (symCount > 12) continue; // only enforce on low-freq symbols
        var tooClose = false;
        for (var g = 1; g <= MIN_GAP; g++) {
          if (strip[(si + g) % len] === sym || strip[(si - g + len) % len] === sym) {
            tooClose = true; break;
          }
        }
        if (!tooClose) continue;
        // Find a safe swap target
        for (var ti = 0; ti < len; ti++) {
          if (ti === si) continue;
          var ok = true;
          for (var g2 = 1; g2 <= MIN_GAP; g2++) {
            var fwd = (ti + g2) % len, bwd = (ti - g2 + len) % len;
            if ((strip[fwd] === sym && fwd !== si) || (strip[bwd] === sym && bwd !== si)) { ok = false; break; }
          }
          if (!ok) continue;
          var displaced = strip[ti];
          if (displaced === sym) continue;
          strip[ti] = sym; strip[si] = displaced;
          moved = true; break;
        }
      }
      if (!moved) break;
    }

    // ── REEL 5: S bottom-row enforcement is handled by game.js M4 check ─
    if (reelIdx === 4) { /* no-op — code trigger is authoritative */ }

    return strip;
  });
}

var REEL_STRIPS = buildReelStrips(REEL_FREQUENCIES);

// ═══════════════════════════════════════════════════════════════════════
// PAYLINES
// ═══════════════════════════════════════════════════════════════════════
// PAYLINES — BIG MUNNY BIG MUNNY 20-line pattern set (matched 2026-05-16)
// Row index: 0=Top, 1=Middle, 2=Bottom. All lines pay Left-to-Right.
// 7 lines replaced from prior set to match BIG MUNNY exactly (Lines 10,11,14,15,18,19,20).
var PAYLINES = [
  // IGT/WMS/Aristocrat classic 20-line set — owner confirmed 2026-05-23
  // Row indices: 0=Top 1=Middle 2=Bottom
  [1,1,1,1,1], // L1  Center straight — PERMANENT: Lipstick P&C trigger line
  [0,0,0,0,0], // L2  Top straight
  [2,2,2,2,2], // L3  Bottom straight
  [0,1,2,1,0], // L4  V-shape
  [2,1,0,1,2], // L5  Inverted V
  [0,1,1,1,2], // L6  Diagonal down
  [2,1,1,1,0], // L7  Diagonal up
  [1,0,0,0,1], // L8  Top arch
  [1,2,2,2,1], // L9  Bottom arch
  [0,0,1,2,2], // L10 Staircase down
  [2,2,1,0,0], // L11 Staircase up
  [1,0,1,0,1], // L12 High zigzag
  [1,2,1,2,1], // L13 Low zigzag
  [0,1,2,2,2], // L14 Top-left to bottom-right
  [2,1,0,0,0], // L15 Bottom-left to top-right
  [1,1,0,1,1], // L16 Single peak up
  [1,1,2,1,1], // L17 Single peak down
  [0,0,0,1,2], // L18 Top-left step down
  [2,2,2,1,0], // L19 Bottom-left step up
  [0,2,0,2,0], // L20 Wide alternating
];

var LINE_PRESETS = [1, 5, 10, 15, 20];

// Human-readable payline pattern names — matches PAYLINES order (index 0 = Line 1)
var PAYLINE_NAMES = [
  'Center Straight','Top Straight','Bottom Straight','V-Shape','Inverted V',
  'Diagonal Down','Diagonal Up','Top Arch','Bottom Arch','Staircase Down',
  'Staircase Up','High Zigzag','Low Zigzag','Top-Left to Bottom-Right','Bottom-Left to Top-Right',
  'Single Peak Up','Single Peak Down','Top-Left Step Down','Bottom-Left Step Up','Wide Alternating',
];

// ═══════════════════════════════════════════════════════════════════════
// BET CONFIGURATION — MLMC (Multi-Line Multi-Credit) BIG MUNNY style
// Total Bet = Denomination × Credits Per Line × Lines Active
// Win Cash  = Credits Won × Credits Per Line × Denomination
// ═══════════════════════════════════════════════════════════════════════

// Denominations in dollars
var DENOMINATIONS   = [0.01, 0.02, 0.05, 0.10, 0.25, 0.50]; // $1/$2/$3/$5 removed v8.1.52 (owner confirmed obsolete); $10/$20 removed v6l94
var DENOM_LABELS    = ['1¢', '2¢', '5¢', '10¢', '25¢', '50¢'];               // mirrors DENOMINATIONS
var DEFAULT_DENOM   = 0.01; // 1¢ default — v8.1.53: changed from 5¢ (owner confirmed)

// v8.1.0: Credits-per-line locked to denomination cent value — not player-adjustable.
// When denom changes, creditsPerLine is auto-set from this table.
// PERMANENT RULE: Do not add a credits-per-line selector UI. Bet scale is denom-controlled only.
var DENOM_CREDIT_LOCK = {
  0.01: 5,    // 1¢  →  5cr/line → $0.05/line → $1.00   max (20L)
  0.02: 10,   // 2¢  → 10cr/line → $0.20/line → $4.00   max (20L)
  0.05: 10,   // 5¢  → 10cr/line → $0.50/line → $10.00  max (20L)
  0.10: 10,   // 10¢ → 10cr/line → $1.00/line → $20.00  max (20L)
  0.25: 10,   // 25¢ → 10cr/line → $2.50/line → $50.00  max (20L)
  0.50: 10,   // 50¢ → 10cr/line → $5.00/line → $100.00 max (20L)
  1.00: 10,   // $1  → 10cr/line → $10.00/line → $200.00 max (20L)  v8.1.46: re-added
  2.00: 10,   // $2  → 10cr/line → $20.00/line → $400.00 max (20L)  v8.1.46: re-added
  3.00: 10,   // $3  → 10cr/line → $30.00/line → $600.00 max (20L)  v8.1.46: re-added
  5.00: 10,   // $5  → 10cr/line → $50.00/line → $1000.00 max (20L) v8.1.46: re-added
};

// Credits per line options (BIG MUNNY style — skips 4, skips 6-9)
var CREDITS_PER_LINE_OPTIONS = [1, 2, 3, 5]; // J3: max credits/line = 5 (max bet = denom × 5 × 20)
var DEFAULT_CREDITS_PER_LINE = 10; // matches DENOM_CREDIT_LOCK[DEFAULT_DENOM=0.05]

// Lines (unchanged)
var DEFAULT_LINES   = 5;  // owner-confirmed 2026-05-18: minimum 5 lines, default start 5
var DEFAULT_BALANCE = 500.00;

// Legacy — kept for compatibility with existing code that references BET_INCREMENTS
// In MLMC mode, actual bet = denom × creditsPerLine × lines
var BET_INCREMENTS  = [0.01, 0.02, 0.05, 0.10, 0.25, 0.50, 1.00];
var DEFAULT_BET     = DEFAULT_DENOM;

// Helper: calculate total bet from MLMC parameters
function calcTotalBet(denom, creditsPerLine, lines) {
  return Math.round(denom * creditsPerLine * lines * 100) / 100;
}

// Helper: calculate cash win from credits won
// Win Cash = Credits Won × Credits Per Line × Denomination
function calcWinCash(creditsWon, creditsPerLine, denom) {
  return Math.round(creditsWon * creditsPerLine * denom * 100) / 100;
}

// Min/max total bets
var MIN_TOTAL_BET = calcTotalBet(0.01, 1,  1);   // $0.01
var MAX_TOTAL_BET = calcTotalBet(5.00, 5, 20);  // $500.00 — $10/$20 denoms removed v6l94

// ═══════════════════════════════════════════════════════════════════════
// PROGRESSIVE JACKPOT
// ═══════════════════════════════════════════════════════════════════════
var JACKPOT_CONFIG = {
  MINI:  { seed: 50.00,    label: 'MINI',  color: '#a8d8ea' },
  MINOR: { seed: 150.00,   label: 'MINOR', color: '#c9f0a0' },
  MAJOR: { seed: 500.00,   label: 'MAJOR', color: '#f5d878' },
  GRAND: { seed: 5000.00,  label: 'GRAND', color: '#ff6b35' },
};

// Jackpot seeds scale with denomination — higher denom = bigger jackpots
// Baseline: 10¢ = $50 / $150 / $500 / $5,000
// J2 owner-approved seed table (2026-05-15):
// 1¢–$1: flat floor — jackpots feel meaningful at any denom (max bet $1c×5×20=$1.00 to $1×5×20=$100)
// $2+:   scale up from $1 tier — GRAND = denom × 2000
// Jackpot seeds — owner-confirmed custom table 2026-05-18
// Seeds update dynamically on every denom change (applyScaledJackpotSeeds called in index.html)
// Jackpot seeds — proportional to max bet at each denomination
// Formula: MINI=20× MINOR=60× MAJOR=200× GRAND=2000× (max bet = denom × 5cr × 20L)
// Owner confirmed 2026-05-18
var JACKPOT_SEEDS_BY_DENOM = {
  // v8.1.0: Option A linear scaling. Each denom has seed + mustHitBy cap. +2% grace zone applied in bonuses.js.
  // v8.1.46: $1/$2/$3/$5 entries re-added (were incorrectly removed). GAME_DESIGN_MANUAL.md §Progressive Seeds
  // is the authoritative source. Seeds scale linearly with denom (same ×factor relative to 0.05 baseline).
  // Caps = seed × MHB multiplier (MINI×3, MINOR×4, MAJOR×5, GRAND×6).
  '0.01': { MINI:{seed:20,      cap:60      }, MINOR:{seed:50,      cap:200     }, MAJOR:{seed:500,    cap:2500   }, GRAND:{seed:1000,   cap:6000   } },
  '0.02': { MINI:{seed:40,      cap:120     }, MINOR:{seed:100,     cap:400     }, MAJOR:{seed:1000,   cap:5000   }, GRAND:{seed:2000,   cap:12000  } },
  '0.05': { MINI:{seed:100,     cap:300     }, MINOR:{seed:250,     cap:1000    }, MAJOR:{seed:2500,   cap:12500  }, GRAND:{seed:5000,   cap:30000  } },
  '0.10': { MINI:{seed:200,     cap:600     }, MINOR:{seed:500,     cap:2000    }, MAJOR:{seed:5000,   cap:25000  }, GRAND:{seed:10000,  cap:60000  } },
  '0.25': { MINI:{seed:500,     cap:1500    }, MINOR:{seed:1250,    cap:5000    }, MAJOR:{seed:12500,  cap:62500  }, GRAND:{seed:25000,  cap:150000 } },
  '0.50': { MINI:{seed:1000,    cap:3000    }, MINOR:{seed:2500,    cap:10000   }, MAJOR:{seed:25000,  cap:125000 }, GRAND:{seed:50000,  cap:300000 } },
  '1.00': { MINI:{seed:2000,    cap:6000    }, MINOR:{seed:5000,    cap:20000   }, MAJOR:{seed:50000,  cap:250000 }, GRAND:{seed:100000, cap:600000 } },
  '2.00': { MINI:{seed:4000,    cap:12000   }, MINOR:{seed:10000,   cap:40000   }, MAJOR:{seed:100000, cap:500000 }, GRAND:{seed:200000, cap:1200000} },
  '3.00': { MINI:{seed:6000,    cap:18000   }, MINOR:{seed:15000,   cap:60000   }, MAJOR:{seed:150000, cap:750000 }, GRAND:{seed:300000, cap:1800000} },
  '5.00': { MINI:{seed:10000,   cap:30000   }, MINOR:{seed:25000,   cap:100000  }, MAJOR:{seed:250000, cap:1250000}, GRAND:{seed:500000, cap:3000000} },
};

// Helper: get seeds+caps for active denom
// v8.1.6: removed duplicate definition that used broken numeric key lookup
function getJackpotSeedsForDenom(denom) {
  var key = parseFloat(denom).toFixed(2);
  return JACKPOT_SEEDS_BY_DENOM[key] || JACKPOT_SEEDS_BY_DENOM['0.05'];
}

// Tighter jackpot odds — harder to win, casino authentic
// ── LEGACY per-spin odds (still used by checkJackpot in processJackpotCheck for forced-JP operator tool)
// DO NOT use these for normal gameplay — use JACKPOT_UNIFIED_PROBS below.
var JACKPOT_ODDS = {
  MINI:  1 / 1500,
  MINOR: 1 / 15000,
  MAJOR: 1 / 150000,
  GRAND: 1 / 1500000,
};

// ── UNIFIED JACKPOT SYSTEM — v8.0 ────────────────────────────────────
// Entry points: Red Spin (per tier entry) and Pick & Choose (per trigger) ONLY.
// PERMANENT RULE: Only P&C and RS may award jackpots. Never BONUS orb directly.
// PERMANENT RULE: One jackpot check per bonus trigger — no per-spin or per-tile checks.
var JACKPOT_UNIFIED_PROBS = {
  // v8.1.38 MC calibration 2026-05-29 — casino standard frequencies at 1 in 43 bonus rate.
  // MINI: ~1 in 750 spins | MINOR: ~1 in 5000 | MAJOR: ~1 in 50000 | GRAND: ~1 in 500000
  // Prob per bonus entry = target_spin_freq / bonus_rate (0.0235)
  MINI:  0.0333,  // ~1 in 750 spins  (was 0.090)
  MINOR: 0.0050,  // ~1 in 5000 spins (was 0.024)
  MAJOR: 0.0005,  // ~1 in 50000 spins (was 0.005)
  GRAND: 0.00005, // ~1 in 500000 spins (was 0.001)
};

// Must-Hit-By cap multipliers — cap = seed × multiplier per denom.
// When progressive reaches cap the next bonus entry FORCES a jackpot award.
// 2% grace: if meter passes cap (e.g. contribution ticked it over), force fires
// within seed × multiplier × 1.02 regardless of random roll.
// Owner confirmed 2026-05-20. Adjust multipliers in future calibration sessions.
var JACKPOT_MHB_MULTIPLIERS = {
  MINI:  3,   // MINI cap = seed × 3  (frequent, tight cap)
  MINOR: 4,   // MINOR cap = seed × 4
  MAJOR: 5,   // MAJOR cap = seed × 5
  GRAND: 6,   // GRAND cap = seed × 6 (rarest, widest range)
};

var JACKPOT_CONTRIBUTION_RATE_DEFAULT = 0.025; // 2.5%
var JACKPOT_SPLIT = { MINI: 0.30, MINOR: 0.25, MAJOR: 0.25, GRAND: 0.20 };

// ═══════════════════════════════════════════════════════════════════════
// RTP & BONUS FREQUENCY
// ═══════════════════════════════════════════════════════════════════════
var TARGET_RTP_DEFAULT = 97.0; // 97% — MC calibrated 2026-05-29 (was 94%)

// Red Spin: more frequent (was 1/125, now 1/60)
// BONUS_FEATURE_FREQ_DEFAULT — legacy natural reel frequency reference.
// RULE OVERRIDE (v8.1.26 — owner confirmed 2026-05-28):
// The "PERMANENTLY DEAD" rule from v6l100 is superseded. Owner has explicitly
// authorised reconnecting the BONUS Orb to an RNG frequency check to equalise
// probability with Red Spin. The v6l100 bug (orb appearing without letters) is
// addressed by always placing letters visually before triggering. See game.js
// checkBonusFeatureTrigger() and PHASE_PLAN.md v8.1.26.
var BONUS_FEATURE_FREQ_DEFAULT = 0.0067; // legacy reference — use BONUS_ORB_FREQ for live check

// v8.1.26: BONUS Orb RNG trigger frequency — matches RS exactly.
// Owner confirmed 2026-05-28: equal probability to Red Spin.
// Fires on winning spins only. Natural B-O-N-U-S landing remains a second trigger path.
var BONUS_ORB_FREQ = 0.007; // must always equal RED_SPIN_FREQUENCY_DEFAULT — update both together

// v8.1.44 MC recalibration 2026-05-29 — raised from 0.0213 to 0.0269 (1 in ~37 spins).
// PAY_TABLE scaled ×0.84, BONUS_FREQ raised to compensate for mixed bar addition (~9.8% RTP).
// MC confirmed: 96.03% RTP @ 5M spins. See diagnostic_report_v8.1.44.md.
var UNIFIED_BONUS_FREQ = 0.08;   // v8.1.56: raised from 0.0269 → 0.08 (owner requested higher bonus frequency). At ~20% win rate: ~1 in 63 spins triggers a bonus.

// v8.1.27: Unified bonus trigger system — owner confirmed 2026-05-28.
// One trigger fires; RNG routes equally to RS / P&C / BONUS Orb.
// v8.1.27 (owner confirmed 2026-05-28): rate raised to 5% per winning spin (~1 bonus per 40 spins).
// *** RTP WARNING: ~7x higher than prior. MONTE CARLO RECALIBRATION MANDATORY (Rule 10). ***
var UNIFIED_BONUS_SPLIT = 0.3333; // 33.33% each: RED_SPIN / PICK_CHOOSE / BONUS_ORB

var RED_SPIN_FREQUENCY_DEFAULT  = 0.007; // v8.1.1: 0.007 per winning spin (~1-in-289 all spins). Was 0.010 (v8.1.0 patch failed to apply).
var RED_SPIN_CONTINUANCE_DEFAULT = 0.70; // v8.1.2: 70% (was 60%). Operator-adjustable 70–95%. // 60% continue / 40% end — owner confirmed 2026-05-18 (was 0.70)

// ── RED SPIN TIERED VOLATILITY SYSTEM ────────────────────────────────────────
// v7.0.4 REDESIGN — owner confirmed 2026-05-23. New tier ranges aligned to actual
// reel strip win distribution (500k spin analysis). Old ranges caused premature cascade.
// Within-tier: 60/40 (same as RED_SPIN_CONTINUANCE_DEFAULT). Spin 1 always guaranteed.
// Player sees no tier labels — presents as continuous free spin sequence.
// Advancement (Option C): progressive — harder early, more accessible toward T4.
// Win rules: win >= lastWin (can equal), within tier range, different payline set.
var RED_SPIN_TIER_ADVANCE_PROB = [0.15, 0.25, 0.40]; // v8.1.0: P(T4) ~1.5% (was 3.0%) // v7.0.4: [T1→T2, T2→T3, T3→T4]. P(reach T4) = 0.20×0.30×0.50 = 3.0% of sequences. Was scalar 0.20 (P(T4)=0.8%).

// v8.1.23: Random tier entry on RS trigger — any tier can be entered directly.
// Cumulative: roll < 0.65 → T1, < 0.90 → T2, < 0.98 → T3, else T4.
// Owner confirmed 2026-05-27. T4 direct entry = ~1 in 50 RS triggers.
var RED_SPIN_ENTRY_PROBS = [0.65, 0.25, 0.08, 0.02]; // [T1%, T2%, T3%, T4%] — must sum to 1.00

// v8.1.24: Equal-chance tier advancement — 25% at every boundary.
// Owner confirmed 2026-05-28. Pure RNG, no tier-position weighting.
var RED_SPIN_ADVANCE_PROB_EQUAL = 0.25; // P(advance) at T1→T2, T2→T3, T3→T4 — identical at every boundary

// v8.1.25: Step count range per tier — RNG picks between min and max inclusive.
// Owner confirmed 2026-05-28: 4-6 steps per tier for extended anticipation.
var RED_SPIN_STEP_COUNT_MIN = 4;
var RED_SPIN_STEP_COUNT_MAX = 6;
var RED_SPIN_TIERS = [
  // v8.1.38 MC calibration 2026-05-29 — recalibrated to $1.00/spin (1c/20L) reality.
  // Old ranges (T1:0.5-6, T2:7-30, T3:37.5-42, T4:45-150) were calibrated for higher bet.
  // New ranges target RS RTP ~6.5% at 1 in 43 bonus frequency.
  // T1 covers: bar combos, low symbol 3-oak (pure and +1 Sasha)
  // T2 covers: Seven+wilds, DJ Maxine 3-4-oak, StrayPup lower combos
  // T3 covers: DJ Maxine 5-oak+wilds, StrayPup 4-oak+wilds
  // T4 covers: StrayPup 3-oak+3J (top), high-excitement ceiling
  { tier:1, name:'Small',   minMult:0.10, maxMult:0.80, jpEligible:['MINI'] },
  { tier:2, name:'Medium',  minMult:1.00, maxMult:3.00, jpEligible:['MINI','MINOR'] },
  { tier:3, name:'Large',   minMult:3.50, maxMult:8.00, jpEligible:['MINI','MINOR','MAJOR'] },
  { tier:4, name:'Sisters', minMult:10,   maxMult:50,   jpEligible:['MINI','MINOR','MAJOR','GRAND'] },
];

// JP available per tier — owner confirmed 2026-05-18
// MINI (20× maxBet) always exceeds T1 ceiling (10×) → forces T2 advancement
// MINOR (60× maxBet) always exceeds T2 ceiling (35×) → forces T3 advancement
// MAJOR (200× maxBet) = T3 ceiling (200×) → stays in T3, no forced advancement
// Works identically at ALL denoms because seeds are proportional to max bet
// RS_TIER_JP_ODDS and RS_TIER_JP_TYPES removed v6l96 — replaced by JACKPOT_UNIFIED_PROBS.
// Red Spin now uses single entry check like all other bonuses. No per-spin JP rolls in RS tiers.

// Lipstick: 5-oak on center payline (Line 1) triggers Pick & Choose — reel freq controlled above

// ── HOLD & SPIN CONSTANTS — PERMANENTLY REMOVED v8.0 ─────────────────

// Hold & Spin bonus is fully removed. Do NOT re-add these constants.

function calculateTheoreticalRTP(lines) {
  if (lines === undefined) lines = 20;
  var totalReturn = 0;
  var activeLines = PAYLINES.slice(0, lines);
  activeLines.forEach(function(line) {
    Object.keys(PAY_TABLE).forEach(function(key) {
      if (!SYMBOLS[key]) return;
      var symId  = SYMBOLS[key].id;
      var pays   = PAY_TABLE[key];
      var freq   = REEL_STRIPS.map(function(strip) { return strip.filter(function(s) { return s === symId; }).length / strip.length; });
      var wildFreq = REEL_STRIPS.map(function(strip) { return strip.filter(function(s) { return WILD_IDS.indexOf(s) >= 0; }).length / strip.length; }); // FIX (v8.1.37): .includes()→.indexOf() — ES5 compat (Samsung Browser/JoiPlay)
      if (pays[0] > 0) {
        var p5 = 1; for (var r=0;r<5;r++) p5 *= (freq[r]+wildFreq[r]);
        totalReturn += p5 * pays[0] / lines;
      }
      if (pays[1] > 0) {
        var p4 = 1; for (var r=0;r<4;r++) p4 *= (freq[r]+wildFreq[r]);
        p4 *= (1-freq[4]-wildFreq[4]); totalReturn += p4 * pays[1] / lines;
      }
      if (pays[2] > 0) {
        var p3 = 1; for (var r=0;r<3;r++) p3 *= (freq[r]+wildFreq[r]);
        p3 *= (1-freq[3]-wildFreq[3]); totalReturn += p3 * pays[2] / lines;
      }
      if (pays[3] > 0) {
        var p2 = (freq[0]+wildFreq[0])*(freq[1]+wildFreq[1])*(1-freq[2]-wildFreq[2]);
        totalReturn += p2 * pays[3] / lines;
      }
    });
  });
  // NOTE: Lipstick [0,0,0,0] — bonus trigger only, no payline pay (owner-confirmed 2026-05-18).
  // 5-oak triggers Pick & Choose. Bonus RTP not included in this theoretical calculation.
  // Uncomment to log: console.warn('Theoretical RTP (' + lines + ' lines):', (totalReturn*100).toFixed(2) + '%');
  return totalReturn;
}

// ── v8.1.58: FULL THEORETICAL RTP — wilds + mixed bars + bonuses + jackpots ─────────────────
// Returns object with total and component breakdown (all values are 0-1 fractions).
// Display in operator panel for real-time RTP visibility.
function calculateFullTheoreticalRTP(lines) {
  if (lines === undefined) lines = 20;

  // 1. Raw base paylines (no wilds, pure analytical)
  var baseRaw = calculateTheoreticalRTP(lines);

  // 2. Wild multiplier boost — calibrated from MC: ~2.3x observed boost on base
  // (Josie=2/80 per reel adds ×2, Sasha=3/80 adds ×1; compounding effect = ~2.3x)
  var WILD_BOOST = 2.3;
  var baseWithWilds = baseRaw * WILD_BOOST;

  // 3. Mixed bars — MC-measured contribution at current reel config (~10%)
  var MIXED_BARS_CONTRIB = 0.10;

  // 4. Bonus features — split gate per v8.1.57:
  //    RS: UNIFIED_BONUS_FREQ/3 on winning spins (~20% rate)
  //    P&C + Orb: UNIFIED_BONUS_FREQ/3 each on any spin
  var freq = (typeof UNIFIED_BONUS_FREQ !== 'undefined') ? UNIFIED_BONUS_FREQ : 0.08;
  var WIN_RATE = 0.20;
  // Avg payout per event at $1/spin (1c/5cr/20L) — calibrated from MC and tier analysis:
  // RS: long sessions with escalating wins, avg ~$6.74/event
  // P&C + Orb: shorter events, avg ~$2.50/event at $1/spin
  var RS_AVG  = 6.74;
  var PC_AVG  = 2.50;
  var ORB_AVG = 2.50;
  var SPIN_BET = 1.00;
  var rsPerSpin  = (freq / 3) * WIN_RATE;  // RS gated on winning spins
  var pcPerSpin  = (freq / 3);              // P&C any spin
  var orbPerSpin = (freq / 3);              // Orb any spin
  var bonusFraction = (rsPerSpin * RS_AVG + pcPerSpin * PC_AVG + orbPerSpin * ORB_AVG) / SPIN_BET;

  // 5. Jackpots — contribution rate returns at steady state
  var JP_CONTRIB = (typeof JACKPOT_CONTRIBUTION_RATE_DEFAULT !== 'undefined')
    ? JACKPOT_CONTRIBUTION_RATE_DEFAULT : 0.025;

  var total = baseWithWilds + MIXED_BARS_CONTRIB + bonusFraction + JP_CONTRIB;

  return {
    total:         total,
    base:          baseRaw,
    baseWithWilds: baseWithWilds,
    mixedBars:     MIXED_BARS_CONTRIB,
    bonusFeatures: bonusFraction,
    jackpots:      JP_CONTRIB,
    wildBoost:     WILD_BOOST,
    bonusFreq:     freq,
  };
}
// ═══════════════════════════════════════════════════════════════════════
// v6k5: multipliers reduced to target ~10x avg win (was 32.75x — too high at 1-in-178 trigger)
// New avg = 0.45×6.5 + 0.25×16 + 0.12×31 = 10.6× total bet
// PICK & CHOOSE prize table — mirrors bonuses.js _generatePickTiles PRIZE_WEIGHTS exactly.
// v8.1.38 MC calibration 2026-05-29 — recalibrated to $1.00/spin (1c/20L) reality.
// Old tiers ($5-$25, $25-$75, $75-$150) were calibrated for 5c/$10/spin. ~10x too high.
// RULE: Any change here MUST also update bonuses.js PRIZE_WEIGHTS and CASH_TIERS.
var PICK_CHOOSE_CASH_TIERS = [
  { minMult:0.25, maxMult:0.75  },  // tier 0 — small  ($0.25-$0.75 at $1/spin)
  { minMult:0.75, maxMult:2.00  },  // tier 1 — medium ($0.75-$2.00)
  { minMult:2.00, maxMult:5.00  },  // tier 2 — large  ($2.00-$5.00)
];
var PICK_CHOOSE_PRIZES = [
  // v8.1.38 MC calibration — owner approved 2026-05-29.
  // Weights sum to exactly 1.0. JP weights calibrated to casino standard frequencies.
  // RULE: Any change here MUST also update bonuses.js PRIZE_WEIGHTS.
  { type:'cash',       weight:0.5625  }, // 56.25% cash (primary prize)
  { type:'cash',       weight:0.2200  }, // 22.00% cash
  { type:'bonus_cash', weight:0.04085 }, // 4.085% Bonus Cash
  { type:'red_spin',   weight:0.0600  }, // 6.00%  Red Spin
  { type:'mini',       weight:0.1000  }, // 10.00% MINI JP  (~1 in 750 spins via PC)
  { type:'minor',      weight:0.0150  }, // 1.50%  MINOR JP (~1 in 5000 spins)
  { type:'major',      weight:0.0015  }, // 0.15%  MAJOR JP (~1 in 50000 spins)
  { type:'grand',      weight:0.00015 }, // 0.015% GRAND JP (~1 in 500000 spins)
  // SUM = 0.5625+0.22+0.04085+0.06+0.10+0.015+0.0015+0.00015 = 1.00000
];

var PICK_CHOOSE_GRID_SIZE = 15;

// ═══════════════════════════════════════════════════════════════════════
// SERIAL NUMBER GENERATOR
// Generates a unique 9-digit serial number per spin
// ═══════════════════════════════════════════════════════════════════════
// FIX-B5 v8.1.46: ES5 zero-pad helper — replaces String.prototype.padStart() (ES2017)
// Declared here so generateSerialNumber() can use it; state.js has its own copy.
function _paytable_zeroPad(n, len) { var s = String(n); while (s.length < len) s = '0' + s; return s; }

function generateSerialNumber() {
  // 9 digits: timestamp-seeded to guarantee uniqueness
  var ts   = Date.now();
  var rand = Math.floor(Math.random() * 100000);
  var raw  = ((ts % 100000) * 10000 + rand) % 1000000000;
  return _paytable_zeroPad(raw, 9);
}

if (typeof module !== 'undefined') module.exports = {
  SYMBOLS, SYMBOL_BY_ID, WILD_IDS, BONUS_PC_ID, BONUS_ID,
  PAY_TABLE, // PAY_TABLE_BY_DENOM removed v8.1.1
  LETTER_IDS, LETTER_ORDER, BONUS_LETTER_PAYS,
  MIXED_BAR_PAY, BAR_IDS,
  REEL_STRIPS, REEL_FREQUENCIES, REEL_SIZE, PAYLINES, PAYLINE_NAMES, LINE_PRESETS,
  DENOMINATIONS, DENOM_LABELS, DEFAULT_DENOM, DENOM_CREDIT_LOCK,
  CREDITS_PER_LINE_OPTIONS, DEFAULT_CREDITS_PER_LINE,
  BET_INCREMENTS, DEFAULT_BET, DEFAULT_LINES, DEFAULT_BALANCE,
  calcTotalBet, calcWinCash, MIN_TOTAL_BET, MAX_TOTAL_BET,
  JACKPOT_CONFIG, JACKPOT_SEEDS_BY_DENOM, getJackpotSeedsForDenom,
  JACKPOT_ODDS, JACKPOT_UNIFIED_PROBS, JACKPOT_MHB_MULTIPLIERS,
  JACKPOT_CONTRIBUTION_RATE_DEFAULT, JACKPOT_SPLIT,
  TARGET_RTP_DEFAULT, BONUS_FEATURE_FREQ_DEFAULT, BONUS_ORB_FREQ, UNIFIED_BONUS_FREQ,
  UNIFIED_BONUS_SPLIT,
  RED_SPIN_FREQUENCY_DEFAULT, RED_SPIN_CONTINUANCE_DEFAULT,
  RED_SPIN_TIERS, RED_SPIN_TIER_ADVANCE_PROB, RED_SPIN_ENTRY_PROBS, RED_SPIN_ADVANCE_PROB_EQUAL,
  RED_SPIN_STEP_COUNT_MIN, RED_SPIN_STEP_COUNT_MAX,
  PICK_CHOOSE_CASH_TIERS, PICK_CHOOSE_PRIZES, PICK_CHOOSE_GRID_SIZE,
  generateSerialNumber, calculateTheoreticalRTP, calculateFullTheoreticalRTP,
};
