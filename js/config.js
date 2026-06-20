/*
 * ============================================================
 *  StrayPups Big Munny — GAME CONFIGURATION
 *  v2.6 | Edit this file to tune game behaviour.
 *
 *  SECTIONS:
 *    1. VIRTUAL STOP TABLE  — reel symbol probability weights
 *    2. REEL STRIPS         — physical symbol layout on each reel
 *
 *  NOTE: BINGO_PATTERNS, REEL_SYMS, and SYMBOL_DEFS have moved
 *  to js/paytable.js — that is the single source of truth for
 *  all pay-related game data.
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

/* ── 1. VIRTUAL STOP TABLE ───────────────────────────────────────────────────
   Controls how often each symbol lands on the payline during non-bingo spins.
   Weights must sum to exactly 32768.
   id: symbol ID  |  w: weight (higher = more frequent)
   Symbol IDs: 0=SP(Wild)  1=Seven  2=3-Bar  3=2-Bar  4=1-Bar  5=Cherry  6=Blank  7=Progressive(Wild)
   See js/paytable.js REEL_SYMS for reel stop assignments.
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

/* ── 2. REEL STRIPS ──────────────────────────────────────────────────────────
   Physical symbol layout on each reel. 100 stops per reel, sym/gap interleaved.
   Even indices = symbol ID, odd indices = gap (blank=6).
   ─────────────────────────────────────────────────────────────────────────── */
var STRIPS = [
  // Reel 1 — 100 stops: sym/gap interleaved. Even indices=sym, odd=gap.
  [3,6,0,6,3,6,0,6,7,6,2,6,5,6,4,6,5,6,2,6,0,6,4,6,1,6,0,6,7,6,0,6,2,6,0,6,4,6,0,6,4,6,7,6,1,6,5,6,3,6,1,6,7,6,3,6,5,6,1,6,7,6,5,6,2,6,1,6,4,6,7,6,1,6,3,6,5,6,4,6,7,6,3,6,2,6,1,6,2,6,4,6,3,6,0,6,5,6,2,6],
  // Reel 2 — 100 stops: sym/gap interleaved.
  [1,6,0,6,5,6,2,6,4,6,2,6,5,6,7,6,4,6,0,6,7,6,5,6,0,6,3,6,7,6,1,6,4,6,5,6,7,6,4,6,0,6,1,6,3,6,7,6,0,6,2,6,4,6,1,6,3,6,7,6,0,6,1,6,5,6,2,6,3,6,0,6,3,6,1,6,5,6,7,6,3,6,2,6,3,6,1,6,2,6,4,6,2,6,4,6,5,6,0,6],
  // Reel 3 — 100 stops: sym/gap interleaved.
  [3,6,4,6,1,6,2,6,7,6,2,6,0,6,4,6,0,6,5,6,3,6,2,6,1,6,4,6,5,6,0,6,3,6,5,6,3,6,0,6,5,6,1,6,3,6,5,6,1,6,0,6,7,6,5,6,3,6,0,6,2,6,7,6,1,6,4,6,3,6,1,6,7,6,4,6,0,6,7,6,4,6,7,6,0,6,2,6,5,6,2,6,4,6,1,6,2,6,7,6]
];