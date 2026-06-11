# StrayPups Big Munny $5 — Phase Plan
## Repo: straypups_big_munny_5d
## Source of truth: zip archives. GitHub is behind.

---

## Current Version: v5.53 (cache: spbm-v553)

---

## Repo Overview
Class II bingo PWA. $5 denomination. All wins determined by bingo patterns. Reels are cosmetic. Connects to WABC for wide-area ball call and Progressive for WAP jackpot.

---

## Stack
- ES5 only — no arrow functions, const, let, backticks, async/await
- Supabase: gdmmoeggkqsvqnqyrubx.supabase.co
- Service worker cache: spbm-v551
- Key files: js/game.js, js/progressive.js, js/config.js, js/operator.js, wabc.js, broadcast-init.js
- Root copies of game.js and progressive.js must always stay in sync with js/ versions

---

## Phase History

### v5.40–v5.42 — WABC + Progressive Integration
- WABC.init() wired inside Progressive.init() callback
- Progressive symbol id:7 added to SPIN_SYM_IDS and VSTOP_TABLE (weight 500)
- _activeCallNext() stops at ball 75, sets seqExhausted=true
- generateCoverAllSpin() saves/restores usingServerBalls
- Progressive pattern pay:[0,0,0] — showcase shows WIDE AREA PROGRESSIVE
- armAndClaim() rewritten — inserts directly into progressive_commands, uses returned ID
- winPatterns sort — progressive pattern sorted LAST (pay:[0,0,0] would break basePat)
- rsPatterns filters out progressive pattern (handled separately, not run through Red Spin)

### v5.43 — Bug Fix Pass
- doBingoSpin: stop overwriting player ballPos from WABC.getBallPos()
- generateCoverAllSpin: restore usingServerBalls after call
- armAndClaim: rewritten to insert directly and use returned command ID (no Realtime timing dependency)
- Progressive pattern sorted to last position — basePat always lowest non-progressive pattern
- rsPatterns excludes progressive pattern from Red Spin

### v5.44 — Class II Reel Fix (REVERTED in v5.47)
- Removed evalSpin rejection loop — WRONG, caused cherries to show on losing spins

### v5.45 — Floor Manager Integration
- _writeGameHistory() added — writes every SPIN/CASH_IN/CASH_OUT to game_history table
- window._floorSupabaseClient exposed by progressive.js
- isProgressive and progAmount added to progressive jackpot opLog calls

### v5.46 — evalSpin Restored
- evalSpin rejection loop restored for no-bingo spins (Class II: visual must not contradict bingo result)
- Cherries on any reel rejected on no-bingo spins
- Wild+blank reordered correctly

### v5.47 — evalSpin Corrected
- Any wild (Scott id:0 or Progressive id:7) on payline always rejected on no-bingo spins
- 2x Progressive combos only appear via forcedSpinResult on bingo wins
- Scott+Progressive combo also correctly rejected

### v5.48 — WABC Channel Exposure (REVERTED in v5.50)
- WRONG: attempted to broadcast ball position — reverted

### v5.49 — Sequence Exhaustion (REVERTED in v5.50)
- WRONG architecture — reverted

### v5.50 — Correct Sequence Architecture
- updateBallPos() confirmed no-op — ball position per-player local only, never broadcast
- _requestNewWABCSequence() added — called when ball 75 hit OR Cover All occurs
- Calls upsert_ball_call RPC + broadcasts new_call to all players via wabc-ballpos channel
- wabc.js exposes window._wabcChannel after init for _requestNewWABCSequence to use

### v5.51 — Auto Sequence Renewal
- _activeCallNext() now calls _requestNewWABCSequence() immediately at ball 75
- New sequence broadcasting before player even presses spin
- doBingoSpin simplified — reads WABC.getSequence(), fallback _requestNewWABCSequence if still exhausted
- All root file copies synced (game.js, progressive.js, sw.js)
- Cache bust: spbm-v551

---

## Pending
- [ ] Player nickname device-to-device travel (via player_registry)
- [ ] Balance persistence across sessions
- [ ] game_history writes verified end-to-end with Floor Manager
- [ ] Full jackpot flow test: natural Cover All → armAndClaim → showProgJP → all patterns pay → Red Spin
- [ ] Connected players showing in Progressive Operator and WABC tool

---

## Rules
- Never modify RTP/math without Monte Carlo verification
- ES5 only throughout
- Version bumps: 0.1 per delivery
- Root copies of game.js and progressive.js must always match js/ versions
- Cache bust on every single build — no exceptions
