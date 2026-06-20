/*
 * ============================================================
 *  StrayPups Big Munny — PAYTABLE
 *  paytable.js | v1.0
 *
 *  ⚠️  SINGLE SOURCE OF TRUTH for all pay-related game data.
 *  All bingo patterns, reel assignments, symbol definitions,
 *  and win hierarchy rules live HERE.
 *
 *  If a pattern pays wrong, a reel shows wrong symbols, or
 *  a win rule is wrong — THIS IS THE ONLY FILE TO EDIT.
 *
 *  Load order in index.html:
 *    paytable.js → config.js → game.js
 *
 *  MANDATORY RULES FOR ALL ENGINEERS:
 *  1. Never define BINGO_PATTERNS, REEL_SYMS, or SYMBOL_DEFS anywhere else.
 *  2. Never change a pattern's cells[] without updating the pattern mapper tool.
 *  3. Never change reel assignments without going through bingo_pattern_mapper_v6.html.
 *  4. Never remove Cover All 40 — it is a Class II required sequence-end signal.
 *  5. Lazy-T is the ONLY progressive jackpot pattern. Its cells are the
 *     O column + middle row (9 cells). It is NOT a Cover All.
 *  6. Pay arrays must follow [bet1, bet2, bet3] multiplier structure.
 * ============================================================
 */

/* ── 1. SYMBOL DEFINITIONS ──────────────────────────────────────────────────
   All 8 reel symbols. These are the authoritative IDs used everywhere:
   VSTOP_TABLE, STRIPS, REEL_SYMS, forcedSpinResult, evalSpin, mkSym.
   ─────────────────────────────────────────────────────────────────────────── */
var SYMBOL_DEFS = [
  { id:0, name:'SP',          label:'Stray Pup',          wild:true,  asset:'scott_full.png',              desc:'Wild — doubles win, matches any symbol' },
  { id:1, name:'7',           label:'Seven',              wild:false, asset:null,                          desc:'Seven — part of Seven-based patterns' },
  { id:2, name:'3B',          label:'Triple Bar',         wild:false, asset:null,                          desc:'Triple Bar — highest bar symbol' },
  { id:3, name:'2B',          label:'Double Bar',         wild:false, asset:null,                          desc:'Double Bar' },
  { id:4, name:'1B',          label:'Single Bar',         wild:false, asset:null,                          desc:'Single Bar — lowest bar symbol' },
  { id:5, name:'CHR',         label:'Cherry',             wild:false, asset:null,                          desc:'Cherry — any cherry on payline pays Open Diamond minimum' },
  { id:6, name:'BLK',         label:'Blank',              wild:false, asset:null,                          desc:'Blank — non-win. Only valid in Cherry combos and no-win stops' },
  { id:7, name:'JP',          label:'Progressive JP',     wild:true,  asset:'progressive_jackpot.png',     desc:'Progressive JP Wild — same rules as SP, interchangeable' }
];

/* ── 2. WILD SYMBOL RULES ───────────────────────────────────────────────────
   SP (id:0) and Progressive JP (id:7) are BOTH wilds and interchangeable.
   Any mix of SP and JP counts equally toward wild count.

   1 Wild  on payline = doubles the winning combination pay
   2 Wilds on payline = pays 4× the winning combination
   3× SP (any mix of SP+JP) = Corporal Stripes jackpot pattern
   3× JP exclusively = Lazy-T Progressive Jackpot pattern

   Wilds NEVER appear on the payline during a no-win spin.
   ─────────────────────────────────────────────────────────────────────────── */

/* ── 3. BLANK SYMBOL RULES ──────────────────────────────────────────────────
   Blank (id:6) appears ONLY in:
     - Cherry-based winning combinations (fills non-cherry positions)
     - No-win reel stops

   Blank NEVER appears with Bar or Seven winning combinations.
   All Bar and Seven combos require all 3 reel positions to show a non-blank symbol.
   ─────────────────────────────────────────────────────────────────────────── */

/* ── 4. REEL STOP ASSIGNMENTS (REEL_SYMS) ───────────────────────────────────
   Maps each bingo pattern's reel key to the 3 payline symbols [R1, R2, R3].

   The key is the QUALIFYING MINIMUM combination. The actual reel strip
   shuffles equivalent combinations each spin for variety (e.g. Corporal
   Stripes can show SP+SP+JP or SP+JP+SP etc. in any order).

   SP(0) and JP(7) are interchangeable wilds — any mix is valid.

   DO NOT add or change entries here without updating bingo_pattern_mapper_v6.html
   and getting explicit approval.
   ─────────────────────────────────────────────────────────────────────────── */
var REEL_SYMS = {
  /* ── Jackpot ── */
  'jp'      : [0,0,0],   /* SP + SP + SP  → Corporal Stripes */

  /* ── Seven patterns ── */
  '7w4'     : [0,0,1],   /* SP + SP + 7   → Cross Corners (2× wild) */
  '7w2'     : [0,1,1],   /* SP + 7  + 7   → Pyramid (1× wild) */
  '7'       : [1,1,1],   /* 7  + 7  + 7   → Double Cross */

  /* ── Triple Bar patterns ── */
  '3bw4'    : [0,0,2],   /* SP + SP + 3B  → The Kite (2× wild) */
  '3bw2'    : [0,2,2],   /* SP + 3B + 3B  → Arrowhead (1× wild) */
  '3b'      : [2,2,2],   /* 3B + 3B + 3B  → G Flat */

  /* ── Double Bar patterns ── */
  '2bw4'    : [0,0,3],   /* SP + SP + 2B  → Four Leaf Clover (2× wild) */
  '2bw2'    : [0,3,3],   /* SP + 2B + 2B  → Valentine (1× wild) */
  '2b'      : [3,3,3],   /* 2B + 2B + 2B  → Christmas Tree */

  /* ── Single Bar patterns ── */
  '1bw4'    : [0,0,4],   /* SP + SP + 1B  → (reserved — no pattern assigned yet) */
  'spjpch'  : [0,7,4],   /* SP + JP + 1B  → Hot Dog */
  '1bw2'    : [0,4,4],   /* SP + 1B + 1B  → Tee (1× wild) */
  '1b'      : [4,4,4],   /* 1B + 1B + 1B  → Private Stripes */

  /* ── Mixed Bar patterns ── */
  'mb'      : [2,3,4],   /* 3B + 2B + 1B  → Small Diamond (any 3 bars) */
  'spmb'    : [0,2,3],   /* SP + 3B + 2B  → Stepladder (wild + mixed bars) */

  /* ── Cherry patterns ── */
  'spspch'  : [0,0,5],   /* SP + SP + CHR → Poodle Dog (2× wild + cherry) */
  'spchch'  : [0,5,5],   /* SP + CHR + CHR → Make Cents (1× wild + 2 cherries) */
  'spch'    : [0,5,4],   /* SP + CHR + 1B → Hopscotch (1× wild + 1 cherry) */
  'ch3'     : [5,5,5],   /* CHR + CHR + CHR → Baby Buggy */
  'ch2'     : [5,5,4],   /* CHR + CHR + 1B → EII */
  'ch1'     : [5,4,3],   /* CHR + 1B  + 2B → Open Diamond */

  /* ── Progressive Jackpot ── */
  'coverall': [7,7,7],   /* JP + JP + JP → Lazy-T Progressive Jackpot */

  /* ── No-win ── */
  'none'    : [4,2,3]    /* 1B + 3B + 2B → non-paying stop */
};

/* ── 5. WIN HIERARCHY RULES ─────────────────────────────────────────────────
   These rules define which BINGO PATTERN a reel combination corresponds to.
   evalSpin() uses these to filter win-looking combos from no-win spins.
   forcedSpinResult() uses REEL_SYMS above to generate the correct stop.

   CHERRY HIERARCHY (no blanks allowed with bar/seven wins):
     1 Cherry  + any non-wild (incl. Blank) = Open Diamond
     2 Cherries + any non-wild (incl. Blank) = EII
     3 Cherries (no wilds)                  = Baby Buggy
     1 Wild + 1 Cherry + anything           = Hopscotch
     1 Wild + 2 Cherries                    = Make Cents
     2 Wilds + 1 Cherry                     = Poodle Dog

   BAR/SEVEN HIERARCHY (NO blanks — all 3 positions must be non-blank):
     Seven patterns (ascending wild count):
       3× Wild (any SP/JP mix)  = Corporal Stripes (JACKPOT)
       2× Wild + Seven          = Cross Corners
       1× Wild + 2× Seven       = Pyramid
       3× Seven                 = Double Cross

     Triple Bar patterns:
       2× Wild + Triple Bar     = The Kite
       1× Wild + 2× Triple Bar  = Arrowhead
       3× Triple Bar            = G Flat

     Double Bar patterns:
       2× Wild + Double Bar     = Four Leaf Clover
       1× Wild + 2× Double Bar  = Valentine
       3× Double Bar            = Christmas Tree

     Single Bar patterns:
       2× Wild + Single Bar     = Private Stripes
       1× Wild + 2× Single Bar  = Tee
       3× Single Bar            = Private Stripes

     Mixed Bar patterns:
       1× Wild + Triple + Double = Stepladder
       Triple + Double + Single  = Small Diamond (any 3 different bars)
   ─────────────────────────────────────────────────────────────────────────── */

/* ── 6. BINGO PATTERNS ──────────────────────────────────────────────────────
   Moved from config.js. This is the SINGLE SOURCE OF TRUTH.

   Each pattern:
     name  : display name (must match renderHelp and startPatternCycle)
     balls : maximum balls allowed (THRESHOLD). Raise = hits more often.
     pay   : [bet1_pay, bet2_pay, bet3_pay] in dollars
     reel  : key into REEL_SYMS above (null = no reel stop, e.g. Cover All 40)
     cells : required cell indices on 5×5 card
             Cell 12 = FREE SPACE (always daubed, skipped in evaluation,
             included in cells[] for visual showcase correctness only)

   CELL INDEX MAP:
     B   I   N   G   O
     0   1   2   3   4   ← row 1
     5   6   7   8   9   ← row 2
    10  11  12  13  14   ← row 3  (12 = FREE SPACE)
    15  16  17  18  19   ← row 4
    20  21  22  23  24   ← row 5

   PATTERN ORDER = first-completed order during ball evaluation.
   DO NOT sort by pay — the order they appear here is also the showcase order.
   ─────────────────────────────────────────────────────────────────────────── */
var BINGO_PATTERNS = [

  /* ── JACKPOT ─────────────────────────────────────────────────────────── */
  {name:'Corporal Stripes', balls:27, pay:[800,1600,2500], reel:'jp',
   cells:[2,6,7,8,10,11,12,13,14,15,19]},

  /* ── HIGH PAYS ───────────────────────────────────────────────────────── */
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
   cells:[1,5,6,7,11,12,13,17,18,19,23]},

  {name:'Valentine',        balls:37, pay:[50,100,150],    reel:'2bw2',
   cells:[4,6,8,10,12,14,16,18,20,22]},

  /* ── MID PAYS ────────────────────────────────────────────────────────── */
  {name:'Tee',              balls:38, pay:[20,40,60],      reel:'1bw2',
   cells:[0,1,2,3,4,7,12,17,22]},

  {name:'Poodle Dog',       balls:35, pay:[20,40,60],      reel:'spspch',
   cells:[0,1,6,11,12,13,14,16,18,21,23]},

  {name:'Christmas Tree',   balls:38, pay:[25,50,75],      reel:'2b',
   cells:[2,6,7,8,10,11,12,13,14,17,22]},

  {name:'Private Stripes',  balls:30, pay:[12,24,36],      reel:'1b',
   cells:[2,6,8,10,12,14]},

  {name:'Stepladder',       balls:36, pay:[10,20,30],      reel:'spmb',
   cells:[4,7,8,12,15,16,20]},

  {name:'Hopscotch',        balls:38, pay:[10,20,30],      reel:'spch',
   cells:[1,3,7,11,12,13,17,21,23]},

  {name:'Baby Buggy',       balls:35, pay:[10,20,30],      reel:'ch3',
   cells:[3,4,8,10,11,12,13,15,16,17,18,21,23]},

  /* ── LOW PAYS ────────────────────────────────────────────────────────── */
  {name:'Small Diamond',    balls:38, pay:[5,10,15],       reel:'mb',
   cells:[7,11,12,13,17]},

  {name:'EII',              balls:38, pay:[4,8,12],        reel:'ch2',
   cells:[0,5,10,15,20,21,22,23,24]},

  {name:'Open Diamond',     balls:38, pay:[2,4,6],         reel:'ch1',
   cells:[2,10,12,14,22]},

  /* ── MID PAY ─────────────────────────────────────────────────────────── */
  {name:'Hot Dog',          balls:39, pay:[40,80,120],     reel:'spjpch',
   cells:[6,7,8,10,11,12,13,14,16,17,18]},

  /* ── PROGRESSIVE JACKPOT ─────────────────────────────────────────────── */
  /* Lazy-T = O column (4,9,14,19,24) + middle row (10,11,13,14) + free(12)
     = 9 cells. Must complete within 24 called balls (cell 12 = free space,
     always daubed, so only 8 non-free cells needed).
     Reel: 3× Progressive JP symbol. Awards wide area progressive pot.
     NOT a Cover All — only 9 specific cells required, not all 25. */
  {name:'Lazy-T', balls:25, pay:[0,0,0], reel:'coverall',
   cells:[4,9,10,11,12,13,14,19,24], isProgressive:true},

  /* ── COVER ALL ───────────────────────────────────────────────────────── */
  /* Cover All 40: all 25 cells matched within first 40 balls.
     v5.115: Awards $0.01 penny, broadcasts 'GAME END — Cover All Achieved'
     to all connected players, signals DB to issue new WABC sequence.
     reel:null — no reel stop. Not a Red Spin entry — trigger/event only. */
  {name:'Cover All 40', balls:40, pay:[0.01,0.01,0.01], reel:null,
   cells:[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24]}

];

/* ── 7. PAYS SCREEN DATA ─────────────────────────────────────────────────────
   Drives the PAYS button overlay. Grouped by category for display.
   All amounts are at Bet 1. Bet 2 = ×2, Bet 3 = ×3 (or as per pay[] array).
   ─────────────────────────────────────────────────────────────────────────── */
var PAYS_SCREEN = [
  {
    section: 'PROGRESSIVE JACKPOT',
    entries: [
      {name:'Lazy-T',           desc:'O column + middle row in ≤24 balls', pay:'Progressive Pot'},
      {name:'Corporal Stripes', desc:'Pattern in ≤27 balls',               pay:'$800'}
    ]
  },
  {
    section: 'HIGH PAYS',
    entries: [
      {name:'Cross Corners',    desc:'in ≤29 balls', pay:'$320'},
      {name:'Four Leaf Clover', desc:'in ≤34 balls', pay:'$100'},
      {name:'Pyramid',          desc:'in ≤29 balls', pay:'$160'},
      {name:'The Kite',         desc:'in ≤35 balls', pay:'$160'},
      {name:'Valentine',        desc:'in ≤37 balls', pay:'$50'},
      {name:'Double Cross',     desc:'in ≤28 balls', pay:'$80'},
      {name:'Arrowhead',        desc:'in ≤30 balls', pay:'$80'},
      {name:'G Flat',           desc:'in ≤36 balls', pay:'$40'},
      {name:'Make Cents',       desc:'in ≤29 balls', pay:'$40'}
    ]
  },
  {
    section: 'MID PAYS',
    entries: [
      {name:'Hot Dog',          desc:'in ≤39 balls', pay:'$40'},
      {name:'Christmas Tree',   desc:'in ≤38 balls', pay:'$25'},
      {name:'Tee',              desc:'in ≤38 balls', pay:'$20'},
      {name:'Poodle Dog',       desc:'in ≤35 balls', pay:'$20'},
      {name:'Private Stripes',  desc:'in ≤30 balls', pay:'$12'},
      {name:'Stepladder',       desc:'in ≤36 balls', pay:'$10'},
      {name:'Hopscotch',        desc:'in ≤38 balls', pay:'$10'},
      {name:'Baby Buggy',       desc:'in ≤35 balls', pay:'$10'}
    ]
  },
  {
    section: 'LOW PAYS',
    entries: [
      {name:'Small Diamond',    desc:'in ≤38 balls', pay:'$5'},
      {name:'EII',              desc:'in ≤38 balls', pay:'$4'},
      {name:'Open Diamond',     desc:'in ≤38 balls', pay:'$2'}
    ]
  },
  {
    section: 'SPECIAL',
    entries: [
      {name:'Cover All 40',     desc:'All 25 cells in ≤40 balls', pay:'$0.01 + New Sequence'},
      {name:'Red Spin Bonus',   desc:'2+ patterns won same spin',  pay:'Cumulative Win'}
    ]
  },
  {
    section: 'WILD SYMBOL RULES',
    entries: [
      {name:'1 Wild on payline',  desc:'SP or JP',          pay:'2× winning combo'},
      {name:'2 Wilds on payline', desc:'any SP+JP mix',     pay:'4× winning combo'},
      {name:'3× SP / SP+JP mix',  desc:'Corporal Stripes',  pay:'Jackpot'},
      {name:'3× JP exclusively',  desc:'Lazy-T',            pay:'Progressive Pot'}
    ]
  }
];
