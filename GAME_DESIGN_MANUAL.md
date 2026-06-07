# THE TURRELLE SISTERS BIG MUNNY
## Game Design Manual — Authoritative Reference v2.1

> **This document is law.** Every rule, trigger, and design decision lives here.
> It is maintained alongside PHASE_PLAN.md. When a rule changes, BOTH documents update.
> Last updated: v8.1.23 (2026-05-27) — full RS tier redesign, H&S purge complete
>
> ## ⚠️ PERMANENT RULES FOR ALL DEVELOPERS AND AI ASSISTANTS
> 1. **Update this document and PHASE_PLAN.md together** — they must never be out of sync
> 2. **Always check with the owner before changing any game design** — owner-confirmed decisions are logged here and are final
> 3. **Cross-reference this document** when making any code change that touches game logic, math, or bonus behaviour
> 4. **Never deliver a zip** where the code and this manual describe different behaviour

---

## 1. GAME OVERVIEW

| Field | Value |
|---|---|
| Game name | The Turrelle Sisters Big Munny |
| Type | Class III video slot (5-reel, 3-row, 20-line) |
| Platform | Mobile web (Samsung Galaxy S23, Android Chrome) |
| Future format | Android APK (Android Studio, no ads, owner-built) |
| Pay direction | Left to right only |
| Pay mechanic | Highest win per payline only (no multi-pay stacking on same line) |
| Wild behaviour | Josie and Sasha substitute for all standard symbols |
| Non-substitutable | Lipstick, BONUS letters B/O/N/U/S |

---

## 2. SYMBOL REFERENCE

| ID | Symbol | Type | Wild | Notes |
|---|---|---|---|---|
| 0 | Sisters | Character | No | GRAND jackpot trigger (5-oak any payline). Displays "JACKPOT" badge on reel. |
| 1 | Josie | Wild | Yes (+×2) | Contributes +×2 to wild multiplier (additive). Displays "×2" badge on reel. |
| 2 | Sasha | Wild | Yes (+×1) | Contributes +×1 to wild multiplier (additive). Displays "×1" badge on reel. |
| 3 | Seven | Standard | — | High-pay symbol |
| 4 | Triple Bar | Standard | — | |
| 5 | Double Bar | Standard | — | |
| 6 | Single Bar | Standard | — | |
| 7 | *(retired)* | — | — | Cherry — removed v6l13. ID 7 is unused. |
| 8 | Lipstick | Bonus | No | Pick & Choose trigger (5-oak center payline) |
| 9 | Dollar Bills | Standard | No | **v8.0.0** — H&S trigger removed. Standard paying symbol [40,28,16,0]. Asset: dollar_bills.svg (clean vector, v8.1.12). |
| 10 | BONUS-B | Letter | No | Reel 1 only — cherry-style evaluation |
| 11 | BONUS-O | Letter | No | Reel 2 only |
| 12 | BONUS-N | Letter | No | Reel 3 only |
| 13 | BONUS-U | Letter | No | Reel 4 only |
| 14 | BONUS-S | Letter | No | Reel 5 only |
| 15 | Diamond | Standard | — | |
| 16 | StrayPup | Character | No | High-pay |
| 17 | DJ Maxine | Character | No | High-pay |

**PERMANENTLY REMOVED (v8.0.0):** Hold & Spin bonus fully removed from game logic, UI, operator controls, and paytable. Dollar Bills (id:9) is now a standard paying symbol.

---

## 3. REEL STRUCTURE

- **Strips:** 5 reels × 80 stops each
- **Window:** 3 visible rows per reel (top/middle/bottom)
- **Dollar Bills stops:** 15 per reel (MIN_GAP=1 — allows multiple in window simultaneously)
- **Lipstick stops:** 12 per reel
- **All strips sum to exactly 80 stops**

---

## 4. PAYLINES

- 20 active paylines, all left-to-right
- **Line 1 (index 0):** Middle row [1,1,1,1,1] — also the Lipstick trigger line
- Standard BIG MUNNY BIG MUNNY 20-line pattern set

---

## 5. WILD MULTIPLIER RULES

**Owner confirmed 2026-05-29 (v8.1.38 redesign)**

Josie (id:1) and Sasha (id:2) are wilds. Every Josie and Sasha anywhere in the matched run contributes additively to the multiplier. There is no cap — multipliers stack freely:
- **Josie:** contributes +×2 per occurrence
- **Sasha:** contributes +×1 per occurrence
- **Formula:** `multiplier = 1 + (josie_count × 2) + (sasha_count × 1)`
- **No cap** — combos with 3 Josie = ×7, 2 Josie + 1 Sasha = ×6, etc.
- **All-wild line** (only Josie/Sasha, no base symbol): pays $0 — multiplier role only. JP trigger checked separately.
- **Scope:** All Josie/Sasha symbols within positions 0 through (matchCount − 1) of the payline

| Wilds in combo | Multiplier |
|---|---|
| No wilds | ×1 (base pay only) |
| 1× Sasha | ×2 |
| 1× Josie | ×3 |
| 2× Sasha | ×3 |
| 1× Josie + 1× Sasha | ×4 |
| 2× Josie | ×5 |
| 2× Josie + 1× Sasha | ×6 |
| 3× Josie | ×7 |
| 2× Josie + 2× Sasha | ×7 |

**RULE:** Multiplier applies to regular payline pays ONLY. Jackpots always pay their fixed progressive seed regardless of wild count. Same rule applies in Red Spin bonus (uses same evaluateLine function).

**RULE:** Wilds do NOT substitute for: Lipstick, BONUS letters.

**Symbol badges (v8.1.40):** Sisters displays "JACKPOT" badge. Josie displays "×2" badge. Sasha displays "×1" badge. Badges rendered as CSS overlays on reel cells — placeholder styled labels until final asset art is delivered.

---

## 6. LETTER (BONUS) RULES

- Letters B/O/N/U/S appear on their designated reel only (B=reel1, O=reel2, etc.)
- Evaluated cherry-style: all 3 rows simultaneously, each row independent
- Consecutive letters from reel 1 only — break at first non-letter
- Pays are additive across rows — all qualifying rows sum together
- Wilds do NOT substitute for letters

| Count | Multiplier (× bet/line) |
|---|---|
| 1 letter | ×1 |
| 2 letters | ×2 |
| 3 letters | ×4 |
| 4 letters | ×12 |
| 5 letters (bottom row) | → BONUS trigger (no cash pay for this row) |

**Bottom Row Trigger (M4):** If B-O-N-U-S all appear on row 2 (bottom row) simultaneously, BONUS Feature triggers. The 5-letter pay for that row is suppressed — the trigger replaces it.

---

## 7. MIXED BAR RULES

- Any mix of Single/Double/Triple Bar on a payline (3–5 consecutive from reel 1)
- Only fires on MIXED combos — pure same-bar 3/4/5-oak pays via regular paytable
- Wilds do NOT substitute

| Count | Pay (× bet/line) |
|---|---|
| 3 mixed bars | ×5 |
| 4 mixed bars | ×10 |
| 5 mixed bars | ×15 |

---

## 8. JACKPOT SYSTEM — UNIFIED (v8.1.0)

**v8.0.0: Hold & Spin permanently removed. Jackpot entry points: Red Spin (per tier entry) and Pick & Choose (per trigger) only.**

### Architecture

One jackpot check fires at the **moment each bonus triggers** (P&C, RS).
- Same probability table for both bonuses
- One roll per bonus trigger — never per-spin, never per-tile-tap
- BONUS orb never directly awards jackpots — it routes to P&C/RS which each do their own entry check

### Per-Bonus-Entry Probabilities (v8.0.0 — boosted ~1.5× vs v7 following H&S removal)

| Tier | P per bonus entry | Notes |
|---|---|---|
| MINI | 9.0% | Boosted from 6.28% — v8.0.0 following H&S removal |
| MINOR | 2.4% | Boosted from 1.57% |
| MAJOR | 0.5% | Boosted from 0.31% |
| GRAND | 0.10% | Boosted from 0.06% |

> **MC calibration required:** Run Monte Carlo after v8.0.0 to confirm jackpot hit frequency vs targets. Log results in PHASE_PLAN.md. Adjust JACKPOT_UNIFIED_PROBS if needed.

### Must-Hit-By Caps (unchanged)

| Tier | Cap = seed × |
|---|---|
| MINI | × 3 |
| MINOR | × 4 |
| MAJOR | × 5 |
| GRAND | × 6 |

### How Each Bonus Awards Jackpots

**Pick & Choose:**
Jackpots are **match-3 tiles** — player taps tiles one at a time until they match 3 of the same type. Matching 3 MINOR tiles = MINOR jackpot. Matching 3 GRAND tiles = GRAND jackpot.

**Red Spin:**
Jackpot check fires once at **each tier entry**. 1–3 normal tier spins play first in the tier, then the jackpot spin plays as a real RS spin where jackpot-triggering symbols appear on the reels.
- GRAND (0.10%) eligible at every tier entry
- T1 designated jackpot: MINI
- T2 designated jackpot: MINOR
- T3 designated jackpot: MAJOR
- T4: GRAND always eligible; MINOR/MAJOR eligible only if progressive > T3 ceiling

### Progressive Seeds by Denomination (updated v8.1.46 — synced with paytable.js JACKPOT_SEEDS_BY_DENOM)

| Denom | MINI seed | MINOR seed | MAJOR seed | GRAND seed |
|---|---|---|---|---|
| 1¢ | $20 | $50 | $500 | $1,000 |
| 2¢ | $40 | $100 | $1,000 | $2,000 |
| 5¢ | $100 | $250 | $2,500 | $5,000 |
| 10¢ | $200 | $500 | $5,000 | $10,000 |
| 25¢ | $500 | $1,250 | $12,500 | $25,000 |
| 50¢ | $1,000 | $2,500 | $25,000 | $50,000 |
| $1 | $2,000 | $5,000 | $50,000 | $100,000 |
| $2 | $4,000 | $10,000 | $100,000 | $200,000 |
| $3 | $6,000 | $15,000 | $150,000 | $300,000 |
| $5 | $10,000 | $25,000 | $250,000 | $500,000 |

Must-hit-by caps = seed × multiplier (MINI×3, MINOR×4, MAJOR×5, GRAND×6). Full cap table in `paytable.js JACKPOT_SEEDS_BY_DENOM`.

### Character Symbol Jackpots (Base Game — unchanged)

| Level | Trigger |
|---|---|
| MINI | 3+ consecutive Sasha from reel 1 on any active payline |
| MINOR | 3+ consecutive Josie from reel 1 on any active payline |
| MAJOR | All 5 wilds (any mix Josie/Sasha) on any active payline |
| GRAND | 5-oak Sisters on any active payline |

**Owner confirmed 2026-05-20. This is the single authoritative jackpot design.**

### Architecture

One jackpot check fires at the **moment each bonus triggers** (P&C, RS). H&S permanently removed v8.0.0.
- Same probability table for all three bonuses
- One roll per bonus trigger — never per-spin, never per-tile-tap
- BONUS orb never directly awards jackpots — it routes to P&C/RS which each do their own entry check
- P&C triggered from inside Red Spin IS eligible for jackpots (noJackpots suppression removed)

### Per-Bonus-Entry Probabilities

| Tier | P per bonus entry | Target spin rate | Frequency |
|---|---|---|---|
| MINI | 6.28% | ~1-in-200 spins | Most frequent |
| MINOR | 1.57% | ~1-in-800 spins | |
| MAJOR | 0.31% | ~1-in-4,000 spins | |
| GRAND | 0.06% | ~1-in-20,000 spins | Rarest |

### Must-Hit-By Caps

Each tier has a cap. When the progressive reaches the cap, the next bonus entry **forces** an award. 2% grace zone applies.

| Tier | Cap = seed × |
|---|---|
| MINI | × 3 |
| MINOR | × 4 |
| MAJOR | × 5 |
| GRAND | × 6 |

### How Each Bonus Awards Jackpots

**Hold & Spin (Option X — REMOVED v8.0.0):**
If the entry roll wins a jackpot, a jackpot coin of that tier is **guaranteed to appear on the board** during play. If it didn't land naturally during respins, it is injected by replacing one cash coin. The jackpot is awarded when that coin is collected at bonus end.

**Pick & Choose:**
Jackpots are **match-3 tiles** — exactly the same mechanic as cash, Red Spin, and Bonus Cash tiles. Player taps tiles one at a time until they match 3 of the same type. Matching 3 MINOR tiles = MINOR jackpot. Matching 3 GRAND tiles = GRAND jackpot. **No separate entry-check jackpot award.** The match-3 is the only jackpot mechanism in P&C.

**Red Spin:**
Jackpot check fires once at **each tier entry** (one roll at the moment the tier starts). 1–3 normal tier spins play first in the tier, then the jackpot spin plays as a **real RS spin** where jackpot-triggering symbols appear on the reels (processCharacterJackpots fires naturally on that spin).
- GRAND (0.06%) eligible at every tier entry
- T1 designated jackpot: MINI (6.28%)
- T2 designated jackpot: MINOR (1.57%)
- T3 designated jackpot: MAJOR (0.31%)
- T4: GRAND always eligible; MINOR/MAJOR eligible only if their current progressive > T3 ceiling (200× total bet); MINI not eligible in T4
- 70/30 continuance applies in T4 same as other tiers (operator-adjustable 70–95%)
- T4 uses the same ascending win engine as T1–T3 (finds real high-value wild combos on the reels)

### Progressive Seeds by Denomination (updated v8.1.46 — synced with paytable.js)

| Denom | MINI seed | MINOR seed | MAJOR seed | GRAND seed |
|---|---|---|---|---|
| 1¢ | $20 | $50 | $500 | $1,000 |
| 2¢ | $40 | $100 | $1,000 | $2,000 |
| 5¢ | $100 | $250 | $2,500 | $5,000 |
| 10¢ | $200 | $500 | $5,000 | $10,000 |
| 25¢ | $500 | $1,250 | $12,500 | $25,000 |
| 50¢ | $1,000 | $2,500 | $25,000 | $50,000 |
| $1 | $2,000 | $5,000 | $50,000 | $100,000 |
| $2 | $4,000 | $10,000 | $100,000 | $200,000 |
| $3 | $6,000 | $15,000 | $150,000 | $300,000 |
| $5 | $10,000 | $25,000 | $250,000 | $500,000 |

*$10 and $20 denominations permanently removed v6l94.*

### Character Symbol Jackpots (Base Game)

Jackpots also fire from character symbol combos on any active payline. These use the same progressive pool. Only the highest tier per spin is awarded.

| Level | Trigger |
|---|---|
| MINI | 3+ consecutive Sasha from reel 1 on any active payline |
| MINOR | 3+ consecutive Josie from reel 1 on any active payline |
| MAJOR | All 5 wilds (any mix Josie/Sasha) on any active payline |
| GRAND | 5-oak Sisters on any active payline |

---

## 9. BONUS TRIGGERS

### ~~9A. Hold & Spin~~ — **PERMANENTLY REMOVED v8.0.0**
Hold & Spin bonus is fully removed. Dollar Bills symbol replaced by Dollar Bills (id:9, standard paying symbol). All H&S code, UI, operator controls, and paytable references removed.

### 9A. Pick & Choose (formerly 9B)
- **Trigger:** 6 or more Dollar Billss visible anywhere in the 5×3 grid on a single spin
- **Natural rate:** ~1-in-95 spins (v7.0.5: 11 coins/reel, threshold 6 — fresh-shuffle sim verified)

- **Priority:** Second after Red Spin. Suppressed if RS triggers in same spin.

### Pick & Choose Cash Tile Value Tiers (v8.x)
Target avg tile: 0.33× totalBet.

| Tier | Weight | Range (% of totalBet) | Avg per tile |
|---|---|---|---|
| Tiny | 45% | 2–8% | 5% |
| Small | 28% | 8–25% | 16.5% |
| Medium | 16% | 25–70% | 47.5% |
| Large | 8% | 70–180% | 125% |
| Big | 3% | 180–400% | 290% ← rare |

### Conveyor Belt (v7.0.5 — dynamic 18-slot belt)
- 18 slots per pass × 2 passes = 36 scrollable items
- Per session composition: 6 cash coins + 2 JP coins (tier randomized, 25% each non-entry tier) + 10 blanks
- JP positions randomized each session — not fixed
- 
- JP coins on belt are decorative — only award via unified entry check (Layer 1)

### 9B. Pick & Choose
- **Trigger:** 5-oak Lipstick on Payline 1 (center row, Line index 0 = [1,1,1,1,1])
- **Natural rate:** ~1-in-1,734 spins (v6l108: Lipstick 18/reel — reduced from 22 to restore Diamond)
- **Priority:** Third. Suppressed if RS triggers in same spin.
- **Note:** Lipstick pays ZERO on all paylines. Only 5-oak on center payline (line index 0, [1,1,1,1,1]) triggers P&C. No cash win for any Lipstick combination on paylines 2–20. PAY_TABLE.LIPSTICK = [0,0,0,0] — owner confirmed v8.1.22.

### 9C. Red Spin
- **Trigger:** Random roll on any WINNING spin only. `RS_FREQ = 0.007` (0.7% per winning spin, ~1-in-143 winning spins). Operator-adjustable via `redSpinFrequency` slider.
- **PERMANENT RULE:** Red Spin must NEVER fire on a $0 (losing) spin — no exceptions. Not even chain RS.
- **Priority:** First and highest. All other bonus triggers suppressed when RS fires in same spin.
- **Tier entry (v8.1.23):** On trigger, a random roll selects which tier RS enters directly. T1=65%, T2=25%, T3=8%, T4=2%. All four tiers reachable on first spin. Entry tier logged as RED_SPIN_ENTRY_TIER event.
- **Additional rounds:** After RS ends, game returns to base. Player presses SPIN manually. If that spin wins and the RS_FREQ check passes, a fresh RS sequence starts. No automatic chain — player must earn it.

### 9D. BONUS Feature (Orb Pick)
- **Trigger:** B-O-N-U-S on bottom row (row 2) simultaneously — natural reel trigger ONLY
- **PERMANENT RULE:** The orb pick screen must NEVER appear without B-O-N-U-S genuinely landing on the bottom row. No RNG shortcut. No probability-based random firing. (RNG shortcut removed v6l100 after bug report.)
- **Award:** Player picks one of 3 orbs — each hides a different sub-bonus (P&C, RS, or Bonus Cash). H&S permanently removed v8.0.0. The prize behind the orb the player taps is what they receive. All three prizes are randomly shuffled before the screen appears; the player's actual tap choice determines the award. (v6l114 — predetermined forced-win removed, owner confirmed 2026-05-21.)
- **Note:** BONUS orb does not directly award jackpots — the sub-bonus it routes to runs its own `_checkUnifiedJackpot()` entry check. P&C and RS triggered via the BONUS orb are fully jackpot-eligible (noJackpots suppression removed v6l114).

---

## 10. HOLD & SPIN — PERMANENTLY REMOVED (v8.0.0)

Hold & Spin was removed in v8.0.0 and does not exist in any form in the current codebase. All H&S code, assets, CSS, and audio have been purged as of v8.1.14. Do not re-add.

---

## 11. RED SPIN RULES

### Architecture
Class III scripted volatility — real reel strips, real evaluateSpin, but wins are constrained to an ascending tier range.

**PERMANENT RULE:** RS must NEVER fire on a losing spin. Not even chain RS.

### Tier System (v8.1.23 — owner confirmed 2026-05-27)

| Tier | Win Range | JP Eligible |
|---|---|---|
| T1 Small | 0.5× – 6× total bet | MINI |
| T2 Medium | 7× – 30× total bet | MINI + MINOR |
| T3 Large | 37.5× – 42× total bet | MINI + MINOR + MAJOR |
| T4 Sisters | 45× – 150× total bet | All 4 tiers |

- Each spin's win must beat the previous RS win (ascending rule — permanent)
- Continuance: 70% continue / 30% end every spin from spin 2. Operator-adjustable 70–95% via `redSpinContinuance` slider. Expected avg: ~3.3 spins per session.
- Spin 1 of each tier: guaranteed (no continuance check)
- **Tier entry (v8.1.23):** RS triggers directly into a randomly selected tier — T1=65%, T2=25%, T3=8%, T4=2%.
- **Tier advance** (when continuance check fails): T1→T2=15%, T2→T3=25%, T3→T4=40%. Auto-advances if jackpot win pushes lastWin above current tier ceiling.
- Wild multiplier: additive, no cap. Josie +×2, Sasha +×1. Formula: 1+(josie×2)+(sasha×1). Same formula as base game.
- Player sees no tier labels — presents as a continuous escalating sequence

### T2 Jackpot Selection Rule (v8.1.23)
At T2 entry jackpot check:
- Award **MINOR** if current MINOR progressive ≥ 3× totalBet (progressive has built to meaningful value)
- Award **MINI** if MINOR progressive < 3× totalBet
- GRAND eligible at every tier entry regardless (0.06% per unified probs)

### T4 Design (v8.1.40 — wild multiplier additive no cap, owner confirmed 2026-05-29)
T4 plays a scripted ascending sequence using real center-payline combinations, then forces GRAND:

| Step | Combination | Target pay |
|---|---|---|
| 1 | StrayPup 5-oak + 1 Josie (×3 mult) | ~10–17× total bet |
| 2 | StrayPup 3-oak + 2J+1Sa (×6 mult) | ~50–60× total bet |
| 3 | lastWin ≥ tier max — no higher payline combo in range | **GRAND jackpot forced** |

Note: With additive no-cap multiplier, T4 combos can reach ×7 (3 Josie on StrayPup 3-oak).

After T4 scripted combos exhaust (or 70/30 continuance ends sequence), GRAND jackpot fires. T4 uses same ascending win engine and operator-adjustable continuance as T1–T3.

### RS Bonus Trigger Exclusions (v8.1.23)
During RS, the grid acceptance loop rejects any stop combination that would trigger:

- **P&C** (5× Lipstick on center payline)
- **BONUS orb** (all five B-O-N-U-S letters on the bottom row simultaneously)

Individual BONUS letters appearing on the bottom row (partial sequences 1–4) are NOT excluded — they still appear and pay the bonus letter pay table normally. Only a full 5-letter bottom row trigger is blocked.

This exclusion applies at every grid acceptance check in the RS loop including the random roll, the R1×R2 exhaustive scan, and the relaxed payline scan. T4 deterministic wild combos are not affected (those are constructed directly and cannot contain bonus triggers by construction).


After RS ends, game returns to base. Player presses SPIN manually. If that spin produces a winning combination AND the RNG RS frequency check passes, Red Spin activates again as a fresh sequence. No automatic chain — player must earn re-trigger naturally.

**The stale "Chain RS Option A (v6l93)" rule is SUPERSEDED by v6l97 and removed. Do not re-implement automatic chain RS.**

---

## 12. PICK & CHOOSE RULES

- **Grid:** 15 tiles, face-down
- **Mechanic:** Player taps tiles to reveal. First to match 3 of the same type wins.
- **Tile types:** Cash (multiple tiers), Red Spin, Bonus Cash, MINI, MINOR, MAJOR, GRAND
- **RULE:** Game ends immediately on match-3. Remaining tiles stay face-down.
- **RULE:** Decoy tiles of each type capped at 2 occurrences (prevents premature match from decoys)
- Jackpot: unified entry check at P&C trigger, awarded at end regardless of match-3 result

### Cash Prize Tiers
| Tier | Range (× total bet) |
|---|---|
| Small | 5–25× |
| Medium | 25–75× |
| Large | 75–150× |

---

## 13. DENOMINATIONS (v8.1.0)

**Active denominations:** 1¢, 2¢, 5¢, 10¢, 25¢, 50¢
**Permanently removed:** $1, $2, $3, $5 — all code, UI, and JP seed references deleted v8.1.0

**Bet structure (v8.1.0):** Credits-per-line is locked to denomination cent value. Not player-adjustable.

| Denom | Locked cr/line | Bet/line | Max bet (20 lines) |
|---|---|---|---|
| 1¢ | 5 | $0.05 | $1.00 |
| 2¢ | 10 | $0.20 | $4.00 |
| 5¢ | 10 | $0.50 | $10.00 |
| 10¢ | 10 | $1.00 | $20.00 |
| 25¢ | 10 | $2.50 | $50.00 |
| 50¢ | 10 | $5.00 | $100.00 |
| 50¢ | 50 | $25.00 | $500.00 |

**Jackpot Seeds & Must-Hit-By Caps (v8.1.0 — Option A, 2% grace zone):**

| Denom | MINI seed | MINI cap | MINOR seed | MINOR cap | MAJOR seed | MAJOR cap | GRAND seed | GRAND cap |
|---|---|---|---|---|---|---|---|---|
| 1¢ | $20 | $50 | $50 | $100 | $500 | $1,000 | $1,000 | $5,000 |
| 2¢ | $40 | $100 | $100 | $200 | $1,000 | $2,000 | $2,000 | $10,000 |
| 5¢ | $100 | $250 | $250 | $500 | $2,500 | $5,000 | $5,000 | $25,000 |
| 10¢ | $200 | $500 | $500 | $1,000 | $5,000 | $10,000 | $10,000 | $50,000 |
| 25¢ | $500 | $1,250 | $1,250 | $2,500 | $12,500 | $25,000 | $25,000 | $125,000 |
| 50¢ | $1,000 | $2,500 | $2,500 | $5,000 | $25,000 | $50,000 | $50,000 | $250,000 |

## 13B. DENOMINATIONS (original)

Active: 1¢, 2¢, 5¢, 10¢, 25¢, 50¢, $1, $2, $3, $5
**Permanently removed:** $10, $20 (v6l94 — do not re-add)

Credits per line: 1, 2, 3, or 5
Lines: up to 20 active
Max bet: $5.00 denom × 5 credits × 20 lines = **$500/spin**

### Per-Denomination Pay Tables
`PAY_TABLE_BY_DENOM` in paytable.js allows denom-specific pay overrides.
Call `getPayTableForDenom(denom)` instead of `PAY_TABLE` directly.
Currently all denoms use the base PAY_TABLE (no overrides active yet).

---

## 14. RTP TARGETS (v8.0.0 — updated 2026-05-23)

| Component | Target RTP | Notes |
|---|---|---|
| Total game RTP | 88–93% | Pending Monte Carlo recalibration (bet structure changed v8.1.15) |
| Base game | ~65–68% | Wild multiplier cap ×3 (was ×6) reduces base game RTP vs v7 |
| Red Spin | ~15% | Unchanged architecture; frequency and tier probs unchanged |
| Pick & Choose | ~2.5% | Unchanged — full redesign deferred to FUTURE-PC1 |
| Jackpots (all) | ~2–3% | JP probs boosted ~1.5× following v8.0.0 H&S removal |

> **MC calibration required after v8.0.0 delivery.** Run Monte Carlo at 5¢ denom to confirm all component RTPs. Log results in PHASE_PLAN.md before any further math tuning.

---

## 15. OPERATOR CONTROLS (v8.0.0)

| Control | Function |
|---|---|
| Balance inject | Add test credits |
| ~~Force H&S~~ | **REMOVED v8.0.0** |
| Force RS | Flags next winning spin to trigger RS |
| Force P&C | Places Lipstick on center payline, triggers P&C |
| Force BONUS | Places B-O-N-U-S on bottom row |
| Force Jackpot | Writes jackpot symbol combo to random active payline |
| Bonus Frequency Multiplier | Scales RS_FREQ (0.5×–5.0×) |
| Max Win Per Spin | Caps individual spin win (0 = no cap) |
| ~~Disable H&S in RS~~ | **REMOVED v8.0.0** |

---

## 12. JACKPOT CELEBRATION (v8.1.0)

**Character assignment per tier:**

| Tier | Overlay shown | Character(s) | Dismiss |
|---|---|---|-|
| GRAND | Full overlay | Sisters (`sisters_celebrate.png`) | CASH OUT or CONTINUE |
| MAJOR | Full overlay | Josie + Sasha side by side | CASH OUT or CONTINUE |
| MINOR | Audio only | None | Auto 3s |
| MINI | Audio only | None | Auto 3s |

**Multiple MINIs in Red Spin:** If 2+ MINI jackpots in one RS session, Sasha + Scott + Maxine shown simultaneously at RS end. Auto 4s.

**Character image fix (v8.1.0):** Flex layout — character never clips.

## 16. VERSION & CHANGE LOG

| Version | Change | Date |
|---|---|---|
| v8.1.2 | RS tier boundaries calibrated to 5,366-arrangement win map (T1:0.5–6×, T2:7–30×, T3:37.5–42×, T4:45–150×). RS continuance 60%→70%, operator-adjustable 70–95% via pill buttons, now wired for real. T4 wild combo table rewritten (v7-era ×4–×8 mults→v8.x ×3 cap). T4 sequence: StrayPup 5-oak ×3 (45×)→Josie/Sasha 5-oak ×3 (60×)→GRAND. Full operator menu audit: 9 bugs fixed, 3 dead functions removed, 2 labels clarified, _findCoinStops replaced with Lipstick-based P&C force. | 2026-05-24 |
| v8.1.1 | Bug fixes and dead code removal: RS_FREQ corrected to 0.007, forceBonusGame/H&S operator refs removed, bonusCount undefined fixed, hold_spin P&C tile removed, DOLLAR_BILLS added to RS sweep, MIN_GAP null check cleaned, PAY_TABLE_BY_DENOM permanently removed (owner confirmed), dead credits-btn handlers removed, stale v6/v7 comments updated. dollar_bills.svg text repositioned above/below Scott portrait. | 2026-05-24 |
| v8.1.0 | Paylines replaced (IGT/WMS/Aristocrat 20-line classic). Reel strips recalibrated (Josie 1→2, Sasha 2→3, Dollar Bills 11→8, bars reduced). RS_FREQ 0.010→0.007, tier ranges widened, advance probs tightened. Denoms $1/$2/$3/$5 permanently deleted. Credits/line locked to denom cent value (selector removed). Jackpot seeds+caps replaced (Option A per-denom table, 2% grace). Bet panel redesigned (SPIN circle, rect buttons, denom square, HELP btn, taller action row). Help menu 4-page (How to Play / Jackpots & Wilds / Standard Symbols / Bonus Features). deadfiles.zip and tools/ retired from builds. Jackpot celebration: GRAND=Sisters, MAJOR=Josie+Sasha, MINI/MINOR=audio only. Character image cut-off fixed. Multi-MINI RS celebration (Sasha+Scott+Maxine). | 2026-05-23 |
| v8.0.0 | **MAJOR REDESIGN:** Hold & Spin permanently removed. Dollar Bills (id:9) replaced by Dollar Bills (standard paying symbol [40,28,16,0]). Wild multiplier redesigned: Josie ×3, Sasha ×2, hard cap ×3. Symbol badges added: Sisters "JACKPOT", Josie "×3", Sasha "×2". JACKPOT_UNIFIED_PROBS boosted ~1.5× (MINI 9%, MINOR 2.4%, MAJOR 0.5%, GRAND 0.1%). Paytable redesigned: 3-page layout with left/right/exit navigation. Operator menu H&S controls removed. BONUS orb 'hold_spin' prize replaced with 'bonus_cash' (5–25× totalBet). Future phases logged: FUTURE-PC1 (P&C redesign), FUTURE-BO1 (BONUS Orb redesign). | 2026-05-23 |

| Component | Target RTP | Notes |
|---|---|---|
| Total game RTP | 94–96% | Per-denom targets to be set in future session |
| Base game | ~70% | Calibrated — reel strips confirmed accurate |
| Red Spin | ~15% | Revised up — reflects new tier design and frequency 0.018 |
| Hold & Spin | N/A | Permanently removed v8.0.0 |
| Pick & Choose | ~2.5% | Pending P&C calibration pass |
| Jackpots (all) | ~1.5% | Pending JP calibration pass |

> RS RTP revised to 15% from original 4–6%. With new tier ranges (avg session ~22.5× totalBet) and frequency 0.018 per winning spin (~1-in-150 all spins, ~every 3.75 min), RS contributes ~15% RTP. Owner confirmed 2026-05-23.

---

## 15. OPERATOR CONTROLS

| Control | Function |
|---|---|
| Balance inject | Add test credits |
| Force RS | Flags next winning spin to trigger RS |
| Force P&C | Places Lipstick on center payline, triggers P&C |
| Force BONUS | Places B-O-N-U-S on bottom row |
| Force Jackpot | Writes jackpot symbol combo to random active payline |
| Bonus Frequency Multiplier | Scales RS_FREQ (0.5×–5.0×) |
| Max Win Per Spin | Caps individual spin win (0 = no cap) |

---

## 16. VERSION & CHANGE LOG

| Version | Change | Date |
|---|---|---| 
| v6l114 | Wild multiplier: all Josie/Sasha in matched run count (not leading-only). BONUS orb: player's real tap choice determines award (predetermined forced-win removed). All sub-bonuses via BONUS orb fully jackpot-eligible (noJackpots suppression removed). Reel strips: per-session crypto shuffle (LCG replaced). Script version tags bumped to ?v=6l114. | 2026-05-21 |
| v6l103 | RS per-tier JP: full unified check (GRAND any tier). BONUS orb RNG shortcut removed. H&S CSS orphaned keyframe fixed. MC rebuilt with correct JP architecture per each bonus type. GAME_DESIGN_MANUAL v1.2. | 2026-05-21 |
| v6l100 | Lipstick 32→22/reel (+10 paying symbols). P&C PRIZE_WEIGHTS rebalanced (H&S 14→8%, RS 12→6%). P&C rate: 1-in-636. MC: base 64%, total ~452%. | 2026-05-21 |
| v6l97 | RS per-tier jackpot (fires at tier entry, 1-3 spins before JP spin, real symbols on reels). T4 wild combos via ascending spin engine. MINOR/MAJOR eligible in T4 if progressive > T3 ceiling. pendingRedSpins queue removed — additional RS via natural base game trigger. Jackpot celebration redesigned: meter flash red + bell. MAJOR/GRAND keeps Cash Out screen. P&C jackpot entry award removed — match-3 tiles only. Game Design Manual v1.1 + Phase Plan permanent rules added. | 2026-05-20 |
| v6l96 | Wild multiplier redesign (additive Josie×2+Sasha×1). Unified jackpot system. _checkUnifiedJackpot at all bonus entries. H&S Option X (guaranteed jackpot coin). Must-hit-by caps. Game Design Manual created. | 2026-05-20 |
| v6l95 | game.js full ES5 rewrite. Dead generateCashCoinValue removed. MC evalLine wild multiplier fixed. | 2026-05-20 |
| v6l94 | $10/$20 denoms permanently removed | 2026-05-20 |
| v6l93 | Version badge on splash. Cache fix (sessionStorage version check). RS Option A chain (35%/20%). H&S 7-tier coin cap. | 2026-05-20 |
| v6l92 | PAY_TABLE_BY_DENOM scaffold. RS freq 0.240→0.120. HS_LAND 0.055→0.022. MC tool calibrated. | 2026-05-20 |
| v6l90 | Gold coins 10→15/reel. MIN_GAP exception for BONUS_ID (3→1). RS freq 0.286→0.240. | 2026-05-20 |
