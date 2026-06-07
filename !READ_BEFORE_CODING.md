# !READ_BEFORE_CODING.md
## The Turrelle Sisters Big Munny — Developer Briefing

**READ THIS ENTIRE FILE BEFORE MAKING ANY CHANGE.**

This file is required reading for every developer and AI assistant, every session, without exception (Rule 15).

---

## 1. This is a live casino-style slot game
It has real math, real RTP targets, and real progressive jackpots. Every change to paytable values, reel strips, bonus frequencies, or jackpot probabilities has mathematical consequences. Never change math without Monte Carlo verification (Rule 10).

## 2. The authoritative documents are
- `PHASE_PLAN.md` — All rules, known issues, build history, session audits
- `GAME_DESIGN_MANUAL.md` — All game design decisions (authoritative)
- `diagnostic_report_[version].md` — Live bug tracker, read before every session

Read all three before touching code. If they conflict with each other, PHASE_PLAN.md wins.

## 3. The most important rules (full list in PHASE_PLAN.md)
- **Owner approval required** before any code change (Rule 20/22)
- **Present full written plan** and wait for sign-off before coding (Rule 24)
- **Update PHASE_PLAN.md BEFORE coding** — log what you will do, why, which files (Rule 11)
- **Syntax check ALL JS files** with `node --check` before delivering any zip (Rule 13)
- **ES5 only in inline `<script>` blocks** — no const/let/arrow/?./?? (Rule 14)
- **Both PHASE_PLAN.md and GAME_DESIGN_MANUAL.md update together** always (Rule 21)
- **deadfiles.zip must be in every build zip** (Rule 16)
- **diagnostic_report_[version].md must be in every build zip** (Rule 25)
- **Launcher files must be in every build zip** (Rule 26)

## 4. The crash prevention checklist (run before every zip)
1. `node --check` every .js file — zero failures allowed
2. `wc -c` every .js file — zero 0-byte files allowed
3. Verify `DENOM_CREDIT_LOCK` defined in paytable.js
4. Verify brace balance in bonuses.js
5. Verify reel sums all equal 80
6. Verify critical element IDs exist in index.html DOM
7. Log scan results in PHASE_PLAN.md

Full checklist: see diagnostic_report_[version].md Part I2.

## 5. What Hold & Spin was (permanently removed v8.0.0)
H&S bonus is gone. `BONUS_ID = null`. Gold Coin replaced by Dollar Bills (id:9, standard paying symbol). Do not re-add H&S. Do not reference `runHoldSpin`, `_findCoinStops`, or `HOLD_SPIN_*` constants. They do not exist.

## 6. Current version
v8.1.33 — see PHASE_PLAN.md for full build history.
