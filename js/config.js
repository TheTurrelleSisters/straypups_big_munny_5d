/*
 * ============================================================
 *  StrayPups Big Munny — GAME CONFIGURATION
 *  v2.6 | Edit this file to tune game behaviour.
 *
 *  SECTIONS:
 *    1. SLOT PAY TABLE      — symbol payouts and jackpot amounts
 *    2. VIRTUAL STOP TABLE  — reel symbol probability weights
 *    3. REEL STRIPS         — physical symbol layout on each reel
 *    4. BINGO PATTERNS      — all 21 patterns, thresholds, payouts
 *
 *  HOW TO TUNE FREQUENCY:
 *    - Raise a pattern's `balls` value → it hits more often
 *      (e.g. Tee: balls:38 → balls:40 allows 2 more balls to complete it)
 *    - Lower a pattern's `balls` value → it hits less often / never
 *    - Change `pay` arrays to adjust payout at each bet level [bet1, bet2, bet3]
 *
 *  RULE: Never change math without Monte Carlo verification (PHASE_PLAN Rule 3).
 * ============================================================
 */

// SP-SP-SP jackpot (per bet level)

/* ── 2. VIRTUAL STOP TABLE ───────────────────────────────────────────────────
   Controls how often each symbol lands on the payline during non-bingo spins.
   Weights must sum to exactly 32768.
   id: symbol ID  |  w: weight (higher = more frequent)
   Symbol IDs: 0=SP(Wild)  1=Seven  2=3-Bar  3=2-Bar  4=1-Bar  5=Cherry  6=Blank  7=Progressive(Wild)
   ─────────────────────────────────────────────────────────────────────────── */
var VSTOP_TABLE = [
  {id:6, w:15884},  // Gap (blank) — reduced from 16384 to accommodate id:7
  {id:5, w: 8000},  // Cherry
  {id:4, w: 4000},  // 1-Bar
  {id:3, w: 2000},  // 2-Bar
  {id:2, w: 1200},  // 3-Bar
  {id:1, w:  684},  // Seven
  {id:0, w:  500},  // SP (Wild)
  {id:7, w:  500}   // Progressive (Wild) — mirrors SP weight
  // Total: 32768
];

var STRIPS = [
  // Reel 1 — 100 stops: sym/gap interleaved. Even indices=sym, odd=gap.
  [3,6,0,6,3,6,0,6,7,6,2,6,5,6,4,6,5,6,2,6,0,6,4,6,1,6,0,6,7,6,0,6,2,6,0,6,4,6,0,6,4,6,7,6,1,6,5,6,3,6,1,6,7,6,3,6,5,6,1,6,7,6,5,6,2,6,1,6,4,6,7,6,1,6,3,6,5,6,4,6,7,6,3,6,2,6,1,6,2,6,4,6,3,6,0,6,5,6,2,6],
  // Reel 2 — 100 stops: sym/gap interleaved.
  [1,6,0,6,5,6,2,6,4,6,2,6,5,6,7,6,4,6,0,6,7,6,5,6,0,6,3,6,7,6,1,6,4,6,5,6,7,6,4,6,0,6,1,6,3,6,7,6,0,6,2,6,4,6,1,6,3,6,7,6,0,6,1,6,5,6,2,6,3,6,0,6,3,6,1,6,5,6,7,6,3,6,2,6,3,6,1,6,2,6,4,6,2,6,4,6,5,6,0,6],
  // Reel 3 — 100 stops: sym/gap interleaved.
  [3,6,4,6,1,6,2,6,7,6,2,6,0,6,4,6,0,6,5,6,3,6,2,6,1,6,4,6,5,6,0,6,3,6,5,6,3,6,0,6,5,6,1,6,3,6,5,6,1,6,0,6,7,6,5,6,3,6,0,6,2,6,7,6,1,6,4,6,3,6,1,6,7,6,4,6,0,6,7,6,4,6,7,6,0,6,2,6,5,6,2,6,4,6,1,6,2,6,7,6]
];/* ── 4. BINGO PATTERNS ───────────────────────────────────────────────────────
   Each pattern:
     name  : display name
     balls : maximum balls allowed to complete this pattern (THRESHOLD)
             Raise this number → pattern hits more frequently
             Lower this number → pattern hits less frequently
     pay   : [payout_bet1, payout_bet2, payout_bet3]
     cells : required cell indices on the 5×5 card (0=top-left, 24=bottom-right,
             reading left-to-right then top-to-bottom; 12=free space, always daubed)
     reel  : forced reel symbol combo key (see REEL_SYMS in game.js)

   CELL INDEX MAP (5×5 grid, row-major):
     B  I  N  G  O
     0  1  2  3  4   ← row 1
     5  6  7  8  9   ← row 2
    10 11 12 13 14   ← row 3  (12 = FREE SPACE)
    15 16 17 18 19   ← row 4
    20 21 22 23 24   ← row 5
   ─────────────────────────────────────────────────────────────────────────── */
var BINGO_PATTERNS = [
  // ── JACKPOT ──────────────────────────────────────────────────────────────
  {name:'Corporal Stripes', balls:27, pay:[800,1600,2500], reel:'jp',
   cells:[2,6,7,8,10,11,12,13,14,15,19]},

  // ── HIGH PAYS ────────────────────────────────────────────────────────────
  {name:'Cross Corners',    balls:29, pay:[320,640,960],   reel:'7w4',
   cells:[0,4,7,11,12,13,17,20,24]},

  {name:'Pyramid',          balls:29, pay:[160,320,480],   reel:'7w2',
   cells:[12,16,17,18,20,21,22,23,24]},

  {name:'The Kite',         balls:35, pay:[160,320,480],   reel:'3bw4',
   cells:[0,1,2,5,6,7,10,11,12,18,24]},

  {name:'Double Cross',     balls:28, pay:[80,160,240],    reel:'7',
   cells:[2,6,7,8,12,16,17,18,22]},

  {name:'Arrowhead',        balls:30, pay:[80,160,240],    reel:'3bw2',
   cells:[2,6,7,8,10,12,14,17,22]},


  {name:'G Flat',           balls:36, pay:[40,80,120],     reel:'3b',
   cells:[2,3,4,7,12,15,16,17,20,21,22]},

  {name:'Make Cents',       balls:29, pay:[40,80,120],     reel:'spchch',
   cells:[2,6,7,8,11,12,16,17,18,22]},

  {name:'Four Leaf Clover', balls:34, pay:[100,200,300],   reel:'2bw4',
   cells:[1,5,6,7,11,13,17,18,19,23]},

  {name:'Valentine',        balls:37, pay:[50,100,150],    reel:'2bw2',
   cells:[4,6,8,10,12,14,16,18,20,22]},

  // ── MID PAYS ─────────────────────────────────────────────────────────────
  {name:'Tee',              balls:38, pay:[20,40,60],      reel:'1bw2',
   cells:[0,1,2,3,4,7,12,17,22]},

  {name:'Poodle Dog',       balls:35, pay:[20,40,60],      reel:'spspch',
   cells:[0,1,6,11,12,13,14,16,18,21,23]},

  {name:'Christmas Tree',   balls:38, pay:[25,50,75],      reel:'2b',
   cells:[2,6,7,8,10,11,12,13,14,17,22]},

  {name:'Private Stripes',  balls:30, pay:[12,24,36],      reel:'1b',
   cells:[2,6,8,10,14]},

  {name:'Stepladder',       balls:36, pay:[10,20,30],      reel:'spmb',
   cells:[4,7,8,12,15,16,20]},

  {name:'Hopscotch',        balls:38, pay:[10,20,30],      reel:'spch',
   cells:[1,3,7,11,13,17,21,23]},

  {name:'Baby Buggy',       balls:35, pay:[10,20,30],      reel:'ch3',
   cells:[3,4,8,10,11,12,13,15,16,17,18,21,23]},

  // ── LOW PAYS ─────────────────────────────────────────────────────────────
  {name:'Small Diamond',    balls:38, pay:[5,10,15],       reel:'mb',
   cells:[7,11,12,13,17]},

  {name:'EII',              balls:38, pay:[4,8,12],        reel:'ch2',
   cells:[0,5,10,15,20,21,22,23,24]},

  {name:'Open Diamond',     balls:38, pay:[2,4,6],         reel:'ch1',
   cells:[2,10,12,14,22]},

  // ── PROGRESSIVE JACKPOT ─────────────────────────────────────────────────
  // Class II compliant: bingo-determined. Cover All (all 25 cells) in ≤25 balls.
  // Awards progressive pot PLUS sum of ALL other pattern payouts stacked.
  // Lazy-T: O column (4,9,14,19,24) + N/middle row (10,11,12,13,14) = 9 cells.
  // Symbol 7-7-7 (Progressive mascot) on reels. Bonanza Bingo rules: this is
  // the dedicated Progressive trigger pattern, distinct from Cover All 40/75
  // (which require ALL 25 cells). A Cover-All-25 card satisfies Lazy-T too
  // (its 9 cells are a subset of all-25), so it stacks naturally.
  {name:'Lazy-T', balls:25, pay:[0,0,0],     reel:'coverall',
   cells:[4,9,10,11,12,13,14,19,24], isProgressive:true},

  // ── COVER ALL — SEQUENCE-ENDING RULES ───────────────────────────────────
  // These are not slot-reel wins (reel:null = no reel stops). They represent
  // bingo-rule sequence-ending conditions and stack with Progressive Jackpot:
  // covering all 25 in <=25 balls automatically also satisfies these two
  // (25 <= 40 <= 75), so all three pay/end together on a Cover-All-25.
  // Cover All within the pre-called zone (<=40 balls) — awards $0.01, ends sequence.
  {name:'Cover All 40', balls:40, pay:[0.01,0.01,0.01], reel:null,
   cells:[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24]},

  // Cover All in entertainment zone (<=75 balls) — no pay, ends sequence.
  {name:'Cover All 75', balls:75, pay:[0,0,0], reel:null,
   cells:[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24]}

];
