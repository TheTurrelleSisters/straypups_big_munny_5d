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

### v5.64 — Bug B: Cancel-Jackpot Reset
- _subscribeCommands UPDATE handler now also handles status==='cancelled':
  clears _forceArmed/_forceCommandId/_forceClaimed if matches this game's
  armed command id, so it stops trying to claim a dead command.
- _claimForceWin: when the won-update matches 0 rows (already claimed by
  another player OR cancelled), also clears _forceArmed/_forceCommandId
  (previously only _forceClaimed was reset, causing repeated retry attempts
  on every future spin).
- Cache bust: spbm-v564

### v5.65 — Splash Version Display Fix
- <title> and #splash-ver were hardcoded at "v5.39" for 25 versions —
  never updated despite cache-bust bumps. Now shows v5.65.
- PERMANENT RULE ADDED: every future version bump must also update the
  user-visible version display (splash/title), not just cache-busting.
- Cache bust: spbm-v565

### v5.66 — Progressive Jackpot Sequential Award Flow (Major Restructure)
Per Sasha's spec, the Cover-All-25 award sequence is now correctly ordered:
  1. Cover All 40 ($0.01) — instant toast + penny credited immediately
  2. All other winning patterns (balls<=40), sorted LOWEST pay -> HIGHEST,
     daubed/awarded via Red Spin reel-stacking animation (runRS)
  3. Progressive Jackpot — grand finale celebration (showProgJP)
  4. After celebration dismissed: full-card daub, win logged, sequence ends
     (stopActiveCaller + _requestNewWABCSequence) per Cover-All bingo rule

New function _finishProgressiveSpin() implements steps 1-3 and calls the
rewritten showProgJP() (now finale-only, handles step 4 on dismiss).
Previously showProgJP ran FIRST (celebration before other patterns) and
the ball sequence never ended after a progressive win — both fixed.

_allPatsBonus no longer double-counts Cover All 40 (now handled solely
inside _finishProgressiveSpin).

Applies to BOTH force jackpot and natural Cover-All-25 wins.
Cache bust: spbm-v566

### v5.67 — Progressive Celebration Dismiss-Collision Fix
- When Corporal Stripes ($800, reel:'jp') is the last Red Spin pattern before
  the Progressive finale, the player's tap-to-dismiss on the $800 JACKPOT
  overlay was also instantly dismissing the Progressive overlay that appeared
  right after (residual tap hit both full-screen tap-anywhere overlays).
- Fixed: showProgJP's dismiss handlers now activate only after a 600ms guard
  delay. Added a 300ms pause after the $800 JACKPOT overlay closes before
  continuing to the Progressive finale, so the two celebrations are visually
  distinct moments.
- Confirmed: Red Spin reel symbols correctly escalate low->high (Open Diamond
  cherry first, up through Corporal Stripes, then Progressive coverall) since
  each pattern uses its own reel type via REEL_SYMS[pat.reel].
- Cache bust: spbm-v567

### v5.68 — Pacing & Card Highlight Improvements
- Bingo card now highlights each pattern's winning cells AND shows its name
  in the pattern-name display during Red Spin (was previously silent —
  only the reels/payout updated, card stayed unchanged).
- Entertainment ball-call interval changed from fixed 1.5s to randomized
  3.2-3.5s (slower pace, more time to react to each ball).
- Spin animation lengthened: main reel stop delays 380/620/900ms ->
  600/1000/1450ms; Red Spin reel stop delays 320/520/720ms -> 500/800/1150ms.
- Cache bust: spbm-v568

### v5.69 — Progressive Jackpot Now Truly LAST in Sequence
- Main spin reels no longer forced to 'coverall'. Main reels now always show
  winPatterns[0] (lowest-pay pattern, e.g. Open Diamond) — Progressive plays
  during Red Spin as the FINAL entry instead.
- runRS extended: when it reaches an isProgressive pattern (now always last),
  its 'coverall' reel symbols land, then showProgJP fires directly as the
  grand finale — no separate Progressive overlay before Red Spin anymore.
- Fixed double-counting: bonusTotal was being added to S.bal twice (once
  per-pattern during the loop, once again at the progressive finale).
- Safeguard: if no other pattern won (winPatterns[0] is itself Progressive),
  it's appended to the Red Spin sequence so showProgJP still fires.
- Correct order end-to-end: Open Diamond -> ... -> Corporal Stripes ->
  Progressive Jackpot (finale) -> sequence ends.
- Cache bust: spbm-v569

### v5.70 — Lazy-T Pattern + Progressive Symbol on Reel Strips (Bonanza Bingo)
- NEW dedicated Progressive trigger pattern "Lazy-T" replaces the old
  all-25-cells "Progressive Jackpot" entry. Cells = O column (4,9,14,19,24)
  + N/middle row (10,11,12,13,14) = 9 cells, matching Bonanza Bingo Lazy-T
  shape. reel:'coverall' (7-7-7), isProgressive:true, pay:[0,0,0].
- A Cover-All-25 card (from generateCoverAllSpin) satisfies Lazy-T
  automatically (9 cells are a subset of all-25) alongside Cover All 40/75
  and the ~20 paytable patterns — all stack as before.
- Symbol 7 (Progressive mascot) added to all 3 reel strips — now appears
  7 times per 50-symbol reel, evenly distributed alongside symbols 0-5.
  Previously symbol 7 existed only as an artificially-inserted result for
  forced 7-7-7 spins, never as a real spinning symbol.
- forcedSpinResult: for any NON-Lazy-T winning pattern that uses symbol 0
  (Scott) as a wild, each wild slot now randomly shows Scott(0) or
  Progressive(7) (50/50, shuffled per spin) — e.g. Tee can show
  Progressive+1Bar+1Bar, Hopscotch can show Progressive+Cherry+blank, etc.
  Lazy-T's fixed 7-7-7 is left untouched (not a substitution).
- Renamed 'Progressive Jackpot' -> 'Lazy-T' throughout (game.js _forcePat
  objects, progressive.js fallback pattern names).
- Cache bust: spbm-v570

### v5.71 — CRITICAL: Lazy-T Finale Never Reached (2 Bugs Fixed)
Root cause of "Lazy-T never awarded, sequence ended on Corporal Stripes,
wrong celebration amount, pot didn't reset visually":

Bug 1 — basePat selection: Cover All 40/75 (pay $0.01/$0, reel:null) were
included in the ascending-pay sort and landed at winPatterns[0] (lowest
pay), becoming basePat. Main reels then showed a no-win 'none' combo
(REEL_SYMS[null] fallback) instead of Open Diamond.
Fix: Cover All 40/75 are now pulled into a separate _sideAwards array,
excluded from basePat/Red-Spin-sequence selection entirely, but still
appended to winPatterns so the penny-toast scan in _finishProgressiveSpin
still finds them.

Bug 2 — runRS's Corporal Stripes ('jp' reel) branch called onDone()
directly after its $800 celebration, ending the ENTIRE Red Spin sequence
early. Since Lazy-T sorts after Corporal Stripes (appended last as the
progressive finale), it never played — sequence stopped at Corporal
Stripes, whose own "$800 JACKPOT" overlay was mistaken for the progressive
celebration (wrong amount, pot never visually updated).
Fix: 'jp' branch now calls playNext() to continue the sequence, so
Lazy-T (or anything else after Corporal Stripes) still plays and
showProgJP fires as the true finale.

Correct order restored: Open Diamond (main reels) -> ... -> Corporal
Stripes ($800 celebration) -> Lazy-T (Progressive finale, showProgJP) ->
sequence ends. Cover All 40/75 awarded silently via penny-toast, unaffected
by reel ordering.
Cache bust: spbm-v571

### v5.72 — Single Combined Celebration (Corporal Stripes + Lazy-T)
Per Sasha's feedback on v5.71 test: when BOTH Corporal Stripes AND Lazy-T
win in the same spin, only ONE final celebration should show.

- runRS's 'jp' branch (Corporal Stripes) now checks progCtx:
  - If progCtx is set (Lazy-T also winning this spin): SKIP Corporal
    Stripes' own "$X JACKPOT" popup entirely. Silently add its pay to
    bonusTotal/S.bal and continue to the next entry. Lazy-T's showProgJP
    becomes the SINGLE finale, with Corporal Stripes' amount folded into
    the total (already added to the accumulative win via _allPatsBonus +
    bonusTotal -> Lazy-T's totalAmt).
  - If progCtx is null (no Lazy-T this spin): Corporal Stripes plays its
    own "$X JACKPOT" Congratulations celebration as the spin's finale,
    as before.

Result: exactly one celebration overlay per spin, regardless of whether
Corporal Stripes, Lazy-T, or both win. Progressive amount is always part
of the single accumulative total shown.
Cache bust: spbm-v572

### v5.73 — Pattern Name Position + Pot Reset Fix
- #bingo-pattern-name moved from full-width (above both card AND ball strip)
  to sit ONLY above the bingo card column (first child of #bingo-card-wrap).
  Font size/letter-spacing reduced (13px/3px -> 10px/1px) to fit the
  narrower card-width column, with ellipsis overflow for long pattern names.
- armAndClaim's !_connected/!_client fallback path now resets _localValue
  to _seed (and notifies listeners) after paying out — previously the pot
  meter stayed stuck at the pre-win value when this offline/disconnected
  path fired (likely related to the ongoing Realtime/0-players issue).
  Server-side DB reset still requires a working connection, but the
  player's own display is now consistent.
- Cache bust: spbm-v573

### v5.74 — Pot Reset Diagnostic + Player Nickname Fix
- _claimForceWin's progressive_hit RPC call (the server-side pot reset for
  Force Jackpot wins) NEVER checked rpcRes.error. Supabase RPC failures
  resolve with {error:...} rather than rejecting the promise, so a failed
  reset was silently treated as success — the winning player's LOCAL
  display reset to seed (false success), while the DB pot was never
  actually reset, explaining why other players/operator never saw a
  reset and why the player's own display reverted on the next refresh.
  Now logs a console.warn with the actual error message if this RPC fails
  — needed to diagnose root cause server-side (likely RPC permissions or
  signature mismatch in Supabase).
- Fixed progressive_hits insert: player_label now uses _playerNickname
  (player's chosen name) instead of the generic auto-assigned "Player N"
  label, for both Force Jackpot and natural hit records. Hit History will
  now show the player's actual nickname.
- Cache bust: spbm-v574

### v5.75 — CRITICAL: WABC Channel Reconnect Loop Fixed (likely root cause of 0-players)
- Log evidence showed an INFINITE loop: "Channel CHANNEL_ERROR — reconnecting
  in 2s" -> "Channel CLOSED — reconnecting in 4s" -> "Broadcast channel
  connected" -> CHANNEL_ERROR... repeating forever, with _onConnClose firing
  on the underlying WEBSOCKET connection itself (not just one channel).
- Root cause: _subscribe() called _client.removeChannel(_channel) WITHOUT
  awaiting its Promise, then immediately created a NEW channel with the SAME
  topic name ('wabc-ballpos'). Supabase Realtime rejected the duplicate join
  (CHANNEL_ERROR) before the old one finished leaving (CLOSED shortly after),
  triggering reconnect -> same race -> infinite loop.
- Fix: _subscribe() now awaits removeChannel()'s promise (via .then/.catch)
  before creating the new channel via new _doSubscribe().
- Since ALL Realtime channels (including presence-lobby) share ONE
  websocket, a socket that never stabilizes resets presence state on
  every 2-4s cycle — this is the most likely explanation for the
  persistent "0 connected players" across WABC/Progressive Operator/Floor
  Manager seen all session.
- Cache bust: spbm-v575

### Service Worker + Supabase Client Hardening (this batch)
- service-worker.js fetch handler rewritten with proper guards:
  - Non-GET requests (POST/PATCH/PUT/DELETE) are no longer intercepted at
    all -> eliminates "cache.put: Request method X is unsupported" errors
    on every Supabase RPC/insert/update.
  - ANY supabase.co request is passed straight to network, never cached ->
    eliminates risk of stale cached API responses masking live DB changes,
    and removes these requests from the JS/HTML cache-refresh branch.
  - 206 Partial Content responses (audio/video range requests) are no
    longer passed to cache.put -> eliminates "Partial response (206)
    unsupported" errors.
- createClient() calls now pass { auth: { persistSession:false,
  detectSessionInUrl:false, storage: <in-memory no-op> } } — avoids
  Supabase client touching localStorage at all, which browsers with
  Tracking Prevention (Safari ITP, Samsung Browser) were silently
  blocking ("Tracking Prevention blocked access to storage for
  ...supabase-js...") and which also triggered "Multiple GoTrueClient
  instances" warnings.
These changes target the console error noise seen across every tool in
this session's logs and may also help Realtime stability (all channels
share one client/connection). 0-players root cause still unconfirmed —
retest after this deploy with game + operator tool open simultaneously.

KNOWN OPEN ISSUE (not yet investigated): both StrayPups games appear to be
broadcasting DIFFERENT ball-call sequences again (regression) — possible
WABC/local-vs-wide-area switching issue. To be investigated next session.


### v5.77 — game_history Diagnostic Logging + WABC/Progressive Banner Decoupling
- CONFIRMED via direct SQL query: game_history table has ZERO rows ever
  inserted. _writeGameHistory() (called via opLog on every spin/cash-in/
  cash-out) has never successfully completed.
- Added diagnostic console.warn logging to pinpoint exactly where it fails:
  - "[GameHistory] SKIPPED — Progressive not connected" if isConnected()=false
  - "[GameHistory] SKIPPED — window._floorSupabaseClient not set" if the
    shared client was never exposed
  - "[GameHistory] insert FAILED: <error>" if the DB rejects the row
    (schema/RLS/type mismatch)
- broadcast-init.js: force_local_ball / restore_wide_ball (WABC ball-call
  mode) no longer touch #prog-offline-banner / #prog-meter-lbl. These are
  owned exclusively by progressive.js connection state. Previously, forcing
  local ball call incorrectly showed "PROGRESSIVE JACKPOT UNAVAILABLE —
  RECONNECTING" even though Progressive itself was fine. Ball-call mode is
  already correctly shown via the LIVE/LOCAL badge.
- Cache bust: spbm-v577

NEXT STEP: do a few test spins, then check browser console for
"[GameHistory]" messages — this will tell us exactly why the table is
empty and let us apply the real fix.


### v5.78 — Red Spin Button-Mash Fixed (Watchdog Refresh)
- The 15s spin watchdog (added to catch genuine DB/exception hangs) was
  set ONCE at spin start and never refreshed. Full Lazy-T progressive
  sequences (multiple Red Spin patterns + finale celebrations) can
  legitimately run 20-40+ seconds, so the watchdog fired MID-SEQUENCE,
  force-set S.spinning=false and called setCtrl(true) -> re-enabled ALL
  buttons while runRS was still playing the celebration. Players could
  then press SPIN to start a new spin, interrupting/skipping the
  in-progress sequence.
- Added _refreshSpinWatchdog(): now called at the start of each Red Spin
  pattern in runRS, and again before each finale celebration (showJP /
  showProgJP). Watchdog now only fires if a SINGLE stage genuinely hangs
  >15s, not on cumulative multi-pattern sequence length.
- Cache bust: spbm-v578


### v5.79 — $5 Bet Display Fix (v5d), Lockup Fix, Presence Retry
- v5d ONLY: fmt() had a stray *DENOM (fmt(n){return "$"+(n*DENOM).toFixed(2);}),
  inflating ALL displayed dollar amounts (balance, bets, wins, jackpot
  popups) by 5x — e.g. a $15 max bet displayed/deducted as $75. S.bal,
  S.cpl*DENOM, pay[]*DENOM were ALREADY correct dollar values; fmt() was
  double-converting. Fixed to match v5_27_PWA (no *DENOM).
- Fixed "game locked up after progressive hit": the v5.78 watchdog-refresh
  fix still fired 15s after entering a player-dismissed celebration
  (showJP/showProgJP), force-unlocking controls (setCtrl(true)) while the
  celebration overlay was still visible/blocking. Waiting for a tap is
  normal, not "stuck". Now: watchdog is CLEARED (not refreshed) before
  these celebrations, and RE-ARMED at the start of the dismiss handler to
  still catch a genuine hang during post-celebration cleanup.
- PRESENCE FIX (root cause of "0 connected players" since early builds):
  _subscribePresence used a ONE-SHOT subscribe — if the first attempt
  returned CHANNEL_ERROR/TIMED_OUT/CLOSED (e.g. during Supabase free-tier
  Realtime tenant cold-start), .track() never fired and this player was
  PERMANENTLY invisible to presence for the session, with zero retries.
  Now retries with exponential backoff (2s->4s->8s...capped 30s) using the
  same removeChannel-then-resubscribe pattern as wabc.js.
- Cache bust: spbm-v579


### v5.80 — CRITICAL: Fixed Ball-Call Sequence Divergence (force_local_ball/restore_wide_ball race)
- Operator FORCE LOCAL / RESTORE WIDE buttons (WABC Master) fire on TWO
  channels for the same action: (1) wabc-ballpos broadcast (force_local/
  restore_wide), fully handled by WABC.onForceLocal/onRestoreWide in
  game.js — correct in every way. (2) progressive_commands INSERT
  (force_local_ball/restore_wide_ball), handled by broadcast-init.js,
  which for restore_wide_ball called fetchServerBallCall() ->
  Progressive.getBallCall() — a legacy v5.39 stub that ALWAYS returns a
  brand-new RANDOM LOCAL shuffle with isServer=false.
- These two handlers raced (different Realtime channels, different
  latency). Whichever ran LAST won. If broadcast-init.js's handler ran
  after WABC's correct one, it CLOBBERED the real shared WABC sequence
  with a random local shuffle and reset the badge to LOCAL — directly
  contradicting "restore wide area" and causing that game instance to
  diverge onto its own random ball sequence while WABC/other games
  continued on the shared one.
- Fix: removed force_local_ball/restore_wide_ball handling from
  broadcast-init.js entirely. WABC.onForceLocal/onRestoreWide are now the
  SOLE authority for ball-call mode switches.
- NOTE: fetchServerBallCall/refreshServerBallCall (game.js) and
  Progressive.getBallCall/refreshBallCall (progressive.js) are now
  UNREFERENCED legacy code — left in place pending confirmation before
  removal.
- Cache bust: spbm-v580


### v5.81 — Corporal Stripes Combo Fix, Lockup Safety Net, Ball-Call Freeze Fix
- Corporal Stripes (jp reel) substitution: kept independent per-symbol
  substitution (any Scott/Progressive mix is valid), but if the result
  happens to become ALL-Progressive on a non-Lazy-T combo, revert one
  symbol back to Scott. The all-Progressive combo is now EXCLUSIVE to the
  genuine Lazy-T trigger.
- Lockup safety net: wrapped showProgJP/showJP calls in try/catch. If
  either throws, the watchdog (just cleared, since waiting for a tap is
  normal) would otherwise leave the game PERMANENTLY locked with no
  recovery. Catch now logs the error, hides the relevant overlay, and
  restores controls (setCtrl(true)).
- Ball-call freeze fix: _activeCallNext's cover-all check now requires
  !BG.seqExhausted. Previously, a progressive/Lazy-T spin (which already
  satisfies all 25 cells from its initial 40-ball setup and already
  requested a new sequence via _handleCoverAll(true)) would freeze the
  entertainment caller at ball 41 on its first tick, because the
  redundant cover-all re-trigger called stopActiveCaller(). Now the
  caller keeps ticking 41-75 throughout Red Spin, in sync with the new
  shared sequence as it arrives via WABC.onNewCall — same as any other
  cover-all/WABC sequence switch.
- Removed the SECOND, redundant _requestNewWABCSequence() call in
  showProgJP's onDismiss handler — a new sequence was already requested
  and adopted at spin-result time (before Red Spin started); requesting
  another after the celebration was unnecessary. Being a
  progressive/Lazy-T win does not change the cover-all/WABC-switch flow.
- Cache bust: spbm-v581


### v5.82 — Presence Heartbeat (zombie-channel fix)
- updateLastSpin() already re-calls .track() every ~30s during active
  play, yet presence still showed 0 — meaning re-tracking on the SAME
  channel object is not enough. Hypothesis: the Supabase free-tier
  Realtime tenant repeatedly cold-starts/shuts down, and the underlying
  socket can silently reconnect WITHOUT this channel's status callback
  re-firing CHANNEL_ERROR/CLOSED. The channel becomes a "zombie" —
  .track() succeeds locally but the presence entry is gone server-side,
  with no visible error.
- Added a 25s heartbeat: fully removeChannel + recreate the presence
  channel (fresh join + fresh track()) on a fixed interval, regardless of
  whether an error was ever observed. Self-heals a zombie channel within
  ~25s.
- Cache bust: spbm-v582


### v5.83 — REVERT v5.82 Presence Heartbeat (caused console flood + lockup)
- v5.82's 25s full-teardown-recreate heartbeat for the presence channel
  caused the F12 console to flood with errors and locked up the system.
- Likely cause: the heartbeat raced with the EXISTING error-retry logic
  (both could attempt removeChannel+recreate on the same channel
  concurrently), and/or 25s-interval channel churn hit Supabase free-tier
  Realtime connection/rate limits, triggering CHANNEL_ERROR -> retry loops
  from both mechanisms simultaneously.
- REVERTED ENTIRELY. Presence subscribe is back to the v5.81/v3.17/v1.15
  state (one-shot subscribe + error-triggered retry with exponential
  backoff, no periodic heartbeat). The "0 players with active games"
  issue remains OPEN — needs a different approach.
- Cache bust: spbm-v583


### v5.84 — player_registry.last_seen Heartbeat (touch_player_last_seen)
- ROOT CAUSE for "0 players" on operator tools, identified: register_player
  RPC only re-fires on subsequent spins if a nickname is set
  (if(nickname && _client && _connected)). For nickname-less players (the
  majority), last_seen was frozen at first-connect time forever, even
  while actively spinning — making player_registry unusable as a
  "connected" signal.
- NEW SQL RPC touch_player_last_seen(p_session_key) — updates ONLY
  last_seen, kept separate from register_player to avoid any risk to the
  nickname field.
- updateLastSpin() now calls this RPC every ~30s (same throttle as the
  existing presence track), unconditionally regardless of nickname.
- This is part of a larger switch: all 3 operator tools (Progressive
  Operator, WABC Master, Floor Manager) now read player_registry instead
  of presence-lobby for Connected/Inactive counts and player lists — a
  durable DB table instead of ephemeral Realtime presence state, which
  has been unreliable all session.
- Cache bust: spbm-v584

  REQUIRED SQL (run once in Supabase SQL Editor):
  CREATE OR REPLACE FUNCTION public.touch_player_last_seen(p_session_key text)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
  BEGIN
    UPDATE player_registry SET last_seen = now() WHERE session_key = p_session_key;
  END; $$;
  GRANT EXECUTE ON FUNCTION public.touch_player_last_seen(text) TO anon, authenticated;



### v5.85 — Progressive Symbol Replacement, Free Space Color, Reel Reshuffle, Ball-Call Freeze (Item 7), Celebration/Attitude Check CSS (Item 6), Pattern Cycling (Item 4), Winner Records
- **Progressive Jackpot symbol replaced**: New artwork (DJ-pup "PROGRESSIVE
  JACKPOT" mascot, user-supplied), background removed (flood-fill + isolated
  artifact cleanup), cropped to 863x1023, resized to 320x379, saved as
  assets/symbols/progressive_jackpot.png. Old assets/symbols/stray_pup_progressive.svg
  DELETED (fully replaced, no frame/border/separate text banner — blank
  canvas). game.js's IMG_PROG_JP preload updated to the new PNG path.
  Renders via existing mkSym id===7 -> object-fit:contain, no markup changes
  needed.
- **Free Space color fixed to blue**: .bc.free and .bc.free.daubed changed
  from gold gradient to the same blue gradient as .bc.daubed (#2255cc-#0033aa),
  text color changed from dark to light. Free space is always shown as
  daubed, so it should match daubed styling, not the un-daubed gold.
- **Reel strips reshuffled (no adjacent duplicates)**: All 3 STRIPS arrays in
  js/config.js reshuffled so the 50-symbol subsequence (even indices) has
  ZERO adjacent duplicates, circularly. Per-reel symbol counts preserved
  exactly. STRIPS is purely visual (above2/below2 "ghost" symbols next to
  the landing symbol) -- no effect on odds/RTP (VIRTUAL_STOP_TABLE /
  forcedSpinResult unchanged).

- **ITEM 7 FIX -- Ball-call freeze at ball 41 (ROOT CAUSE FOUND, CONFIRMED
  on v5.84)**: _handleCoverAll(true) (the progressive Cover-All-1-to-40
  setup, called from animateReels' callback) unconditionally called
  stopActiveCaller(), and NOTHING ever restarted it for Red Spin's balls
  41-75. The v5.81 !seqExhausted guard alone could not fix this -- even
  when the guard correctly prevented a second _handleCoverAll(false) call,
  _handleCoverAll(true) itself still stopped the caller with no restart path.
  TWO-PART FIX in js/game.js (both games):
    1. _continueSpinAfterClaim now sets BG.seqExhausted=true IMMEDIATELY
       (based on BG._coverAll1to40, already known synchronously from
       doBingoSpin) BEFORE calling startActiveCaller() -- closes the race
       where the first entertainment tick (~3.2s) could fire before
       _handleCoverAll(true) runs (animateReels' callback timing varies).
    2. _handleCoverAll(hasPenny) now only calls stopActiveCaller() when
       !hasPenny. For progressive spins (hasPenny=true), the active caller
       keeps running through Red Spin's balls 41-75; the seqExhausted guard
       in _activeCallNext prevents re-triggering _handleCoverAll(false).
       Non-progressive entertainment-phase cover-all (hasPenny=false)
       still freezes as designed (v5.40 behavior unchanged).

- **ITEM 6 FIX -- Celebration video / Attitude Check never appeared (ROOT
  CAUSE: missing CSS entirely)**: #force-win-cel and #attitude-check had
  ZERO CSS anywhere -- no display/position/z-index rules, so .classList.add
  ('show') did nothing visually. showProgJP and showAttitudeCheck were both
  firing correctly in JS; the overlays were just invisible/inert divs.
  Added full fullscreen-overlay CSS for both (css/styles.css, both games):
  fixed position, high z-index (250 / 240), flex-centered, #fw-video as a
  cover background behind text, gold/crimson text styling matching the
  existing #jp-ov jackpot popup, styled dismiss buttons.

- **ITEM 4 -- On-screen pattern cycling (resolved as a consequence of Item
  6)**: startPatternCycle(winPatterns) in showProgJP's onDismiss was already
  correctly designed to cycle through ALL achieved patterns every 2s -- it
  just never ran because onDismiss was unreachable (invisible dismiss
  button, per Item 6). No code change needed beyond the Item 6 CSS fix;
  verified no other stopPatternCycle() call interferes during Red
  Spin/celebration.

- **Winner name + real pattern names now recorded for every jackpot hit**:
  _claimForceWin (js/progressive.js, both games) previously HARDCODED
  pattern='Force Jackpot' and win_patterns='Force Jackpot' for EVERY hit,
  natural or forced -- Progressive Operator's "Last Hit"/history UI already
  displays these fields (win_patterns||pattern, player_label) but always
  showed the generic label. Now:
    - armAndClaim(winPatterns, onResult) -- new winPatterns param, passed
      through to _claimForceWin for natural Lazy-T wins (game.js's
      armAndClaim call site updated to pass winPatterns).
    - _claimForceWin(onClaimed, winPatterns) -- if winPatterns provided,
      records the real progressive pattern name (e.g. "Lazy-T") as
      `pattern` and ALL achieved pattern names joined as `win_patterns`.
      Genuine operator-forced jackpots (claimForce() called directly,
      before winPatterns exists for that spin) keep 'Force Jackpot' --
      accurate description of how that hit was triggered.
    - player_label continues to use _playerNickname||_playerLabel||_sessionKey.
  No UI changes needed in Progressive Operator -- it already reads these
  fields correctly.

- **Attitude Check now shows WHO won + how much**: progressive_commands
  gets a new `winner_label` column (SQL migration, see below), set by
  _claimForceWin alongside winner_session/winner_game/winner_amt.
  _subscribeCommands' UPDATE handler passes winner_label to
  onForceNotify listeners (3rd arg). showAttitudeCheck(amt, winnerGame,
  winnerLabel) (index.html inline script, both games) now populates a new
  #ac-winner element: "<name> Just Won The Progressive Jackpot!" (fixed a
  pre-existing duplicate #ac-sub id in the same edit -- second instance
  renamed #ac-sub2).

  REQUIRED SQL (run once in Supabase SQL Editor, BEFORE deploying v5.85):
  ALTER TABLE progressive_commands ADD COLUMN IF NOT EXISTS winner_label text;

- **Item 3 (operator-forced jackpots not recorded as a win/in history)**:
  root cause is the SAME as Item 6 -- onDismiss (which fires the opLog/
  game_history write with isProgressive/progAmount/patterns, AND the
  progressive_hits insert via _claimForceWin) never ran because the
  celebration overlay was invisible/undismissable, for BOTH natural and
  operator-forced wins. The Item 6 CSS fix applies equally to the forced
  path (_progPat._forceAmt branch -> same _finishProgressiveSpin ->
  runRS -> showProgJP -> onDismiss chain). No separate code change
  identified as additionally needed; please re-test operator-forced
  jackpots after this deploy and report back if still not recording.

- **DEAD CODE REMOVED**:
    - showForceWin / Progressive.onForceWin (index.html inline script +
      js/progressive.js): _onForceWinListeners was populated but NEVER
      fired anywhere -- the real winner celebration is showProgJP via
      game.js, called directly. Removed showForceWin(), CEL_VIDEOS/_celIdx,
      the onForceWin registration call, and onForceWin/_onForceWinListeners
      from progressive.js's exports entirely.
    - _subscribeHits' notify loop (js/progressive.js): now redundant --
      ALL real hits go through armAndClaim -> _claimForceWin, which updates
      progressive_commands (status='won') BEFORE the progressive_hits row
      is inserted; _subscribeCommands' UPDATE handler already notifies
      other players (with real pattern names + winner_label) for every
      hit. Disabled (always returns) to avoid a duplicate Attitude Check
      popup. Subscription left registered but inert, in case
      progressive_hits INSERT-based logic is needed again later.

- **ORPHANED DUPLICATE FILES DELETED** (root-level copies superseded by
  js/ versions, confirmed unreferenced by index.html <script> tags AND
  absent from the service-worker FILES cache list):
    - /game.js (root) -- index.html loads js/game.js
    - /progressive.js (root) -- index.html loads js/progressive.js; was
      uselessly cached, now removed from FILES too
    - /js/broadcast-init.js -- index.html loads root /broadcast-init.js
  GitHub still has these files from before this zip upload -- see
  GITHUB CLEANUP list (provided separately to Sasha) for the full set of
  files to delete manually from both repos (uploading a zip does not
  delete files).

- **service-worker.js FILES list fixed**: removed the now-deleted
  stray_pup_progressive.svg (would have made cache.addAll() fail entirely
  on next install/update -- it's atomic) and the now-removed root
  progressive.js; added assets/symbols/progressive_jackpot.png.

- Cache bust: spbm-v585. Splash/title version updated to v5.85.


### v5.86 — Random Trigger Odds wired up (must-hit-by-ceiling)
- **"Random Trigger Odds" setting (Progressive Operator) is now wired up**.
  Previously stored in the `progressive` table (column trigger_odds,
  default 500, UI label "1-in-N spins at seed (increases toward cap)") but
  NEVER READ by either game -- pure dead setting. Now:
    - js/progressive.js (both games): new _triggerOdds var, fetched in
      _fetchRow and kept current via _subscribeValue's UPDATE handler
      (same pattern as _seed/_ceiling/_contribRate).
    - contribute(betAmt) (called once per spin): if no force is currently
      armed and _triggerOdds>0 and ceiling>seed, rolls a random check each
      spin with odds interpolated linearly from 1-in-_triggerOdds when the
      pot is at seed to guaranteed (1-in-1) once the pot reaches the
      must-hit ceiling:
        progress = clamp((value-seed)/(ceiling-seed), 0, 1)
        chance   = (1/triggerOdds) + progress * (1 - 1/triggerOdds)
    - On success, new _armRandomTrigger() inserts a force_jackpot/'armed'
      row into progressive_commands with created_by='random_trigger' --
      the SAME mechanism the operator's manual Force Jackpot button uses.
      _subscribeCommands' existing INSERT handler picks this up for all
      connected clients exactly like an operator-armed command; takes
      effect starting the next spin (current spin's _forceJP was already
      evaluated before the async insert resolves).
    - Race safety: if _forceArmed becomes true from elsewhere (operator,
      natural Lazy-T armAndClaim, or another client's random trigger)
      while our insert is in flight, the newly-inserted row is immediately
      cancelled (status='cancelled') so it doesn't sit as an orphaned
      'armed' command.
  No Progressive Operator UI changes needed -- the existing "Random
  Trigger Odds" input already reads/writes the column this consumes.

  PRECAUTIONARY SQL (no-op if column already exists, run before deploy):
  ALTER TABLE progressive ADD COLUMN IF NOT EXISTS trigger_odds numeric DEFAULT 500;

- **Lazy-T pattern corrected in conversation/docs (no code change)**: cells
  [4,9,10,11,12,13,14,19,24] = the full O column (5 cells, incl. free
  space at 12) + the middle-row B/I/G cells (3 cells) = 8 numbers needed
  in the first 25 balls. Earlier description (N column + bottom row) was
  backwards -- code/config unaffected, this is just a documentation
  correction. Natural odds unchanged: ~1-in-15,599 per spin
  (C(67,17)/C(75,25)), independent of any operator action -- confirmed
  the natural armAndClaim(winPatterns,...) path is fully wired (same path
  fixed in v5.85).

- Cache bust: spbm-v586. Splash/title version updated to v5.86.


### v5.87 — Friendly game-name update (Stray Pups / Turrelle Sisters)
- PROG_GAME_TITLES (js/progressive.js): 'StrayPups Big Munny $1'/'$5' ->
  'Stray Pups Big Munny $1'/'$5'; 'turrelle': 'Turrelle Sisters' ->
  'The Turrelle Sisters Big Munny'. These feed game_title in
  progressive_hits/progressive_commands records and the Attitude Check
  "Won on <game>" display.
- _writeGameHistory's hardcoded _gameTitle (js/game.js) updated to match
  ('Stray Pups Big Munny $1'/'$5') -- feeds game_history.game_title, shown
  in Floor Manager.
- In-game <title>/#splash-ver branding ("StrayPups Big Munny vX.XX")
  UNCHANGED -- this rename is for cross-repo "friendly name" displays in
  the operator tools / hit records only, not the game's own branding.
- Companion changes this release: progressive_operator v3.21 (same
  PROG_GAME_TITLES rename), floor_manager v1.10 (GAMES map renamed + new
  'turrelle' entry so The Turrelle Sisters Big Munny / TSBIGMUNNY shows up
  correctly wherever Floor Manager displays per-game names), tsbigmunny
  v8.2.2 (same PROG_GAME_TITLES rename + new presence fix -- see
  tsbigmunny/PHASE_PLAN.md).
- Cache bust: spbm-v587. Splash/title version updated to v5.87.
