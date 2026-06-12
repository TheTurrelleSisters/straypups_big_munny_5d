# StrayPups Big Munny $5 — Phase Plan
## Repo: straypups_big_munny_5d
## Source of truth: zip archives. GitHub is behind.

---

## Current Version: v5.54 (cache: spbm-v554)

---

## Repo Overview
Class II bingo PWA. $1 denomination. All wins determined by bingo patterns. Reels are cosmetic. Connects to WABC for wide-area ball call and Progressive for WAP jackpot.

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

### v5.52 — Duplicate WABC Channels Fix
- progressive.js now sets window._wabcSupabaseClient = _client
- wabc.js was looking for this but progressive.js only set _floorSupabaseClient
- Without it each game created its own Supabase client and wabc-ballpos channel
- This caused 4 separate WABC channels instead of 1 shared channel
- Cache bust: spbm-v552

### v5.53 — progressive_hits Insert Fix
- Added 500ms delay before progressive_hits insert after progressive_hit RPC
- RPC and insert were firing back-to-back causing silent insert failures
- Added .then() error logging for both _claimForceWin and hit() paths
- Cache bust: spbm-v553

### v5.54 — Presence Rate Limit Fix (CRITICAL)
- updateLastSpin() was calling _presenceChannel.track() on EVERY spin
- This caused ClientPresenceRateLimitReached errors flooding Supabase
- Rate limit terminated entire Realtime tenant — killed ALL tool connections
- Fixed: track() now throttled to max once per 30 seconds
- Last spin time stored locally on every spin, only broadcast every 30s
- Cache bust: spbm-v554

---

## Current Version: v5.54 (cache: spbm-v554)

## Pending
- [ ] Confirm operator tools connect after presence throttle fix
- [ ] Confirm single wabc-ballpos channel (not 4)
- [ ] progressive_hits records writing correctly
- [ ] Full jackpot flow end-to-end test
- [ ] Neon.tech migration planning

### v5.56 — Jackpot Card Generation Fix
- generateCoverAllSpin() rebuilt — now uses actual WABC sequence
- Builds special card from first 25 balls of BG.callSeq respecting column constraints
- B=1-15, I=16-30, N=31-45, G=46-60, O=61-75
- Cell 12 (free space) always null and always pre-daubed
- usingServerBalls stays true throughout — LIVE badge never changes
- Cover All triggers _requestNewWABCSequence for fresh sequence
- Removed unnecessary usingServerBalls save/restore
- Cache bust: spbm-v556

### v5.57 — CRITICAL: Legacy JWT Anon Key Fix
- sb_publishable_ key silently ignored by Supabase Realtime WebSocket server
- This broke ALL Realtime features: presence, broadcast, postgres_changes
- Symptoms: 0 players in operator, WABC not connecting, jackpot not detected
- Fixed: replaced sb_publishable_ with legacy eyJ... JWT anon key everywhere
- Cache bust: spbm-v557

### v5.58 — Force Jackpot Toast/Lockup/Notify Fixes
- onForceNotify/onForceWin converted to multi-listener arrays (were single-callback, getting overwritten)
- winner_game now mapped through PROG_GAME_TITLES (was showing raw game_id like 'straypups_1d')
- Fixed duplicate id="ac-amt"/"ac-jackpot-amt" on attitude-check overlay
- Added ac-game element showing which game won
- Force jackpot card generation wrapped in try/catch with fallback (prevents lockup if generateCoverAllSpin throws)
- Added 15s spin watchdog — force-unlocks game if spin never completes (DB hang, exception, etc.)
- Cache bust: spbm-v558

### v5.59 — CDC Connection Pool Exhaustion Fix
- prog-commands-XXXX (unique per-session channel) caused
  PoolingReplicationPreparationError: queue_timeout after 11+ seconds
- Each test reload created a new CDC replication slot subscription,
  exhausting the free tier's Realtime connection pool
- Fixed: shared 'prog-commands' channel name for all sessions
- Client-side filtering (winner_session !== _sessionKey) unchanged — still correct
- Cache bust: spbm-v559

### v5.60 — Mid-Sequence Join Sync (Ball Position)
- Joining players always started at ball 40 regardless of live caller's actual position
- ball_pos in DB is intentionally never updated (CDC pool protection from v5.39)
- Fixed via broadcast handshake on wabc-ballpos channel (zero DB writes):
  - New player sends 'sync_request' on join
  - Actively-calling player (BG.entTimer running) responds with 'sync_response' { pos }
  - New player fast-forwards card/strip/matchedCells to that position
  - If pos >= 40, joining player also starts their own active caller
- wabc.js: added setPosProvider(), onSyncResponse(), sync_request/sync_response handlers
- Cache bust: spbm-v560

### v5.61 — Jackpot Card Redesign + Duplicate Notification Fix
- generateCoverAllSpin() redesigned per Sasha's spec:
  - Pool is now first 40 balls (pre-called zone), not first 25
  - Picks 25 cells from this 40-ball pool respecting column constraints
  - 40-ball pool guarantees enough numbers per column (avg 8 vs 4-5 needed)
    -> eliminates the "not enough numbers" fallback bug from v5.56-v5.60
  - ALL 25 cells guaranteed daubed (within pre-called zone = already called)
  - BG.ballPos=40 (matches normal pre-called convention, was 25)
  - Natural-feeling: looks like a real Cover All within the pre-called zone
- Fixed duplicate "Attitude Check" popup for other players on force jackpot:
  - progressive_hits INSERT handler now skips notify when pattern==='Force Jackpot'
  - progressive_commands UPDATE handler already covers that case
- v5d: re-synced stale root game.js (was missing v5.60 sync code, unused
  duplicate — index.html loads from js/game.js, this was cosmetic cleanup)
- Cache bust: spbm-v561

### v5.62 — Cover All 40 / Cover All 75 Patterns Added
- Added 2 missing patterns to BINGO_PATTERNS (config.js):
  - 'Cover All 40' (balls:40, pay:[.01,.01,.01] all bets, reel:null)
    Natural Cover All within pre-called zone (1-40) — awards $0.01, ends sequence
  - 'Cover All 75' (balls:75, pay:[0,0,0], reel:null)
    Natural Cover All in entertainment zone (1-75) — no pay, ends sequence
- doBingoSpin()'s existing per-ball pattern loop picks these up automatically —
  no special-casing needed. If Cover All 25 (Progressive) occurs, Cover All 40
  and Cover All 75 both qualify too (25<=40<=75) -> all three stack/pay together
  per bingo rules, full celebration plays
- generateCoverAllSpin() winPatterns filter updated to include all 3 cover-all
  patterns (was excluding Cover All 75 due to balls<=40 filter)
- rsPatterns (Red Spin animation list) now excludes reel:null patterns —
  Cover All 40/75 have no reel stops per design, but their pay (e.g. $0.01)
  is still included via _allPatsBonus
- Cache bust: spbm-v562

### v5.63 — Cover All 40 Pay Always Credited
- In the non-progressive win branch, Cover All 40's $0.01 (and Cover All 75's
  $0, for symmetry) are now always added to baseAmt if present in winPatterns,
  even when basePat is a different pattern. Previously only paid if it
  happened to be winPatterns[0] (since reel:null excludes it from rsPatterns).
- Cache bust: spbm-v563
