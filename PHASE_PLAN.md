# StrayPups Big Munny — PHASE PLAN
## Version: v5.27 | Last Updated: 2026-06-06

## MANDATORY RULES
1. Read this file FIRST before any code change
2. Update after every change
3. Never change math without Monte Carlo verification
4. Present written plan, wait for owner approval before coding
5. ES5 mandatory in inline scripts
6. Cross-platform required
7. This file in every zip
8. Folder/zip name matches version
9. JS syntax check before every delivery
10. Always confirm with owner before changes
11. RULE 13: Version increments by 0.1 on EVERY delivery
12. **SPLASH VERSION**: Update `#splash-ver` in index.html to match current version on every delivery — required, no exceptions
13. **CARD SERIALS**: Card serial counter (`spbm_card_ctr`) stored in `localStorage` — permanent, never resets, never repeats across sessions
14. **OPERATOR PIN**: PIN never stored or logged in plaintext; only hashed value written to localStorage; never appears in game history records
15. **CACHE-BUST TAGS**: Every delivery must add `?v=VERSION` to ALL `<script src>` and `<link rel=stylesheet>` tags in index.html. No exceptions.

## GAME TYPE: Class II Bingo Machine (slot disguise)

## BINGO ENGINE SPEC
- Fresh unique card every spin (sessionStorage tracks last 1000 fingerprints)
- B(1-15) I(16-30) N(31-45) G(46-60) O(61-75), free space center
- 75 balls pre-shuffled, first 40 determine outcome, 41-75 entertainment (3s each)
- Cherry on ANY reel pays Open Diamond (2 credits bet 1)

## RED SPIN ORDER (v1.8+)
- Patterns sorted ASCENDING by payout
- LOWEST pattern = base spin result (plays before red screen)
- Screen turns red AFTER base spin lands
- Remaining patterns play as Red Spins in ascending order (lowest→highest)

## BALL DISPLAY COLORS
- Green: called ball that matches player card
- Yellow: pre-called (1-40) NOT on player card
- White: entertainment ball (41-75) not on card
- Blue: daubed cell on bingo card (matched)
- Pink pulse: winning pattern cells on card

## v5.23 -> v5.24 CHANGES

### Fix 1: STRIPS — 100-stop sym/gap interleaved strips
Each of the 50 paying symbols now has a gap (id:6) inserted immediately after it, giving 100 stops per reel. Every even index is a symbol, every odd index is a gap. This lets the game land on empty tape between symbols, producing a clear unambiguous visual non-win with symbols peeking above and below the payline.

### Fix 2: VSTOP_TABLE — gap weight restored
Gap (id:6) restored at weight 16384 (50% of picks). This ensures the majority of non-win spins land on a gap stop, giving clean visual losses. Cherry 8000, 1Bar 4000, 2Bar 2000, 3Bar 1200, Seven 684, SP 500. Total: 32768.

### Fix 3: evalSpin — gap always passes, 2-of-a-kind rejected
Gap (id:6) on any payline position returns amt:0 immediately — guaranteed safe non-win. Added rejection of 2-of-a-kind on reels 1+2 or reels 2+3 (e.g. Cherry/Cherry/Seven looks like a near-win to players).

### Fix 4: targetY off-by-one — BUG-02 finally fixed
Changed targetY formula from spinTopOff-(centerIdx-1)*slotH to spinTopOff-centerIdx*slotH. The payline symbol now lands correctly on the payline during animation. This was the cause of symbols appearing to not stop on the payline.

**No bingo engine changes. No pattern changes. No RTP changes.**

---

## v5.22 -> v5.23 CHANGES

### Fix: evalSpin over-rejection causing winning visuals on no-bingo

**Root cause:** v5.22 evalSpin flagged "any cherry on any reel" as a winner. With cherry at 48.8% of VSTOP picks and no blanks in the strips, nearly every random combo contained at least one cherry. The filter exhausted all 200 attempts and fell through, displaying the last generated combo (which always contained cherry or bars) as a loss with "NO BINGO".

**Fix:** Removed the blanket cherry rule. evalSpin now only flags three unambiguous winning-looking combinations:
- Any SP wild (id:0) on any reel
- All 3 reels show the same symbol (3-of-a-kind, including 3x cherry)
- All 3 reels are bars in any mix (mixed bar win)

A cherry on one or two reels mixed with non-bar symbols on the other reels does NOT look like a win and is now allowed as a visual loss. This gives the filter a large pool of valid non-win combos to choose from on every spin.

**No config/strip/bingo/RTP changes.**

---

## v5.7 -> v5.22 CHANGES

### Approach
Rebuilt fresh from v5.7 (last known good reel base). All reel geometry — SYM_PCT, stripTopFor, renderReels slot count, spinReel, centerIdx, CURRENT_GHOSTS — preserved exactly as v5.7. Only the issues proven to need fixing were changed.

### Fix 1: STRIPS — blanks replaced with paying symbols
All 26 blank (id:6) entries per reel replaced with paying symbols. White space between symbols is provided by the slot background (cream #f5f0e8), not by blank slots. No black gaps will appear.

### Fix 2: VSTOP_TABLE — blank entry removed
Blank removed from VSTOP_TABLE. Weight redistributed: Cherry 16000, 1Bar 8000, 2Bar 4000, 3Bar 2500, Seven 1268, SP 1000. Total still 32768. Previously blank (58% of picks) caused syms[r]=6 while strip displayed strip[0], making evalSpin check the wrong symbol.

### Fix 3: evalSpin — Class II visual filter only
evalSpin no longer calculates payouts. Returns amt:1 if combo looks like a winner (any wild, any cherry, 3-of-a-kind, mixed bars), amt:0 if safe to show as loss. cpl parameter removed.

### Fix 4: Player state persistence
Balance and bet saved to localStorage on every updUI call. Restored on page load.

### Fix 5: genSpinResult — random strip position
Picks a random occurrence of each symbol on the strip instead of always the first, preventing the same visual combo repeating on every loss spin.

### Fix 6: _reelWinH cache
Reel window height cached in initReelSlots (100ms delay + 300ms retry). Used as fallback in renderReels, spinReel, and snap rebuild to prevent blank reels when Samsung Browser returns clientHeight=0 during GPU compositing.

### Fix 7: RS CSPRNG + operator version + paytable balls
Red Spin pause uses rng.int(0,999). Operator menu shows v5.22. 14 pattern balls values loosened per owner spec.

**Reel geometry: IDENTICAL TO v5.7. No other game logic changes.**

---

## BUILD HISTORY
| Version | Date | Notes |
|---|---|---|
| v5.27 | 2026-06-06 | Monte Carlo RTP tuning. 7 pattern balls values reduced to achieve 97.29% RTP at Bet $1/$2 and 97.83% at Bet $3 (target: 95%-98%). Small Diamond 40->38, Open Diamond 40->38, Private Stripes 32->30, Stepladder 38->36, Hopscotch 39->38, EII 39->38, Tee 39->38. No pay amounts changed. Verified via 300,000-spin Monte Carlo. |
| v5.26 | 2026-06-06 | Randomized winning reel combinations: forcedSpinResult now shuffles the REEL_SYMS combo via Fisher-Yates CSPRNG before forcing to reels. Same bingo pattern shows varied symbol orderings each spin (e.g. Tee=1b always 3x1Bar no variation; Hopscotch=spch rotates SP/Cherry/1Bar across 6 orderings). Also picks random strip position for each symbol giving varied ghost neighbors. No bingo/pattern/RTP changes. |
| v5.25 | 2026-06-06 | Fix evalSpin: any cherry on any reel now rejected — 1 cherry on any reel pays Open Diamond per game design, so cherry anywhere always looks like a win to a player. Gap with no cherry = safe pass. No other changes. |
| v5.24 | 2026-06-06 | STRIPS: 50->100 stops, sym/gap interleaved. VSTOP: gap weight 16384 restored. evalSpin: gap always passes, 2-of-a-kind on reels 1+2 or 2+3 now rejected. targetY off-by-one fixed (centerIdx-1->centerIdx). No bingo/pattern changes. |
| v5.23 | 2026-06-06 | Fix evalSpin over-rejection: removed blanket "any cherry = win" rule. Now only flags true unambiguous winners: any wild, 3-of-a-kind, mixed bars (all 3 are bars). Cherry mixed with non-bar non-cherry symbols on other reels passes as safe non-win. Fixes filter exhausting 200 attempts and showing winning combos. No other changes. |
| v5.22 | 2026-06-06 | Fresh build from v5.7 (last known good reel base). Reel geometry/SYM_PCT/stripTopFor/slot counts UNTOUCHED. Fixes: STRIPS blanks replaced with paying symbols; VSTOP_TABLE blank removed, weights redistributed; evalSpin rewritten as visual filter only; player state persistence; genSpinResult random strip position; _reelWinH cache + 100ms/300ms retry; doSpin _reelWinH guard; RS CSPRNG; 14 paytable balls values; operator version v5.22. |
| v5.7 | 2026-06-05 | Complete ball caller lifecycle rewrite. Silent caller: game load only + Cover All while idle. Active caller: starts on first spin, never stops during play including RS, seamless 75-ball reset. Cover All during active spin: new sequence, active caller continues. Watchdog removed entirely. No math/RTP changes.
| v5.6 | 2026-06-05 | Red Spin between-spin pause changed from fixed 1000ms to random 1000-2000ms. No math/RTP changes.
| v5.5 | 2026-06-05 | Fix 1: Free space visual — blue glow border+star so clearly marked as used; Fix 2: Ball caller fast-tap lockup — startEntertainmentBalls called directly after animateReels starts not deferred, spin debounce 300ms after S.spinning=false; Fix 3: Red Spin speed — entry 500->200ms, pay display 820->500ms, between spins 1800->1000ms, base-to-RS 1200->600ms. No math/RTP changes.
| v5.4 | 2026-06-05 | Cosmetic: matched ball color changed from green (background highlight) to pink plain text — no background, no box-shadow, just pink colored number. No logic/math/RTP changes.
| v5.3 | 2026-06-05 | Fix 1: BG._coverAll1to40 initialized in BG object; Fix 2: enterDemo uses _cardNodes=null not innerHTML=""; Fix 3: watchdog S.spinning guard removed; Fix 4: _showNextPattern dead first text assignment removed. No math/RTP/bingo changes.
| v5.2 | 2026-06-05 | Fix 1: _ballNodes never nulled in sizeLayout/exitDemo — permanent ball timer fix; Fix 2: doSeamlessReset/allBallsCalled check GS.state to call correct timer; Fix 3: opLog CASH_OUT moved inside button handler (was firing on page load); Fix 4: startPatternCycle removed from runRS playNext; Fix 5: Cover All added to BINGO_PATTERNS (all 25 cells, balls:75, correct pay); Cover All flash message + seamless reset + ball caller restart; Free space class priority fixed (free+daubed coexist). No math/RTP changes.
| v5.1 | 2026-06-05 | Ball caller definitive fix: (1) startEntertainmentBalls deferred via setTimeout(fn,0) so synchronous spin setup completes before timer starts — prevents Samsung Browser dropping setInterval during heavy sync work; (2) exitDemo pre-builds _ballNodes/_cardNodes before spin so no lazy DOM rebuild during animation; (3) sizeLayout pre-builds nodes after layout settles; (4) watchdog now fires during spin too — no longer skips S.spinning check; (5) Free space cell 12 always auto-daubed in renderBingoCard. No math/RTP/bingo changes.
| v5.0 | 2026-06-05 | Reel strip redesign: all 3 reels rebuilt with exactly 4 of each paying symbol (SP=4, Seven=4, 3Bar=4, 2Bar=4, 1Bar=4, Cherry=4) and 26 blanks = 50 stops. Each reel independently randomized — no fixed neighbor pattern, authentic random feel. All REEL_SYMS forced combos verified present. No VSTOP_TABLE/bingo/math/RTP changes.
| v4.9 | 2026-06-05 | Version corrected (v4.8 delivered without version bump — Rule 11 violation). renderBingoCard rewritten to in-place node updates (no innerHTML rebuild, no sizeBingoElements on every call) — same pattern as renderBallStrip fix. Permanent ball caller watchdog added: setInterval every 3s checks entTimer alive during active play, self-heals if dead. _cardNodes/_ballNodes invalidated on sizeLayout/enterDemo/exitDemo. No math/RTP/bingo changes. |
| v4.8 | 2026-06-05 | Pattern showcase: empty white cells in demo grid (value=0 renders as blank via card[i]||''). Win reveal: startPatternCycle moved to after animateReels completes so reels visible before pattern shown. Pattern flash: always setInterval regardless of win count — single pattern also flashes continuously until next spin. RS path: base pattern shows during 1200ms pause, cleared when RS fires, all patterns shown after RS completes. No math/RTP changes. |
| v4.7 | 2026-06-05 | 5-slot variable-height reel strip (symH=47%, blankH=4% of winH); above2+below2 neighbors in all ghost objects; stripTopFor/stripTotalH cumulative height math; spinReel end sequence 5 slots, centerIdx=length-3; snap-back 5-slot. renderBallStrip single-node in-place update. Three game states: idle=pattern showcase+silent caller@1.3s; active=live card+balls@1.5s; demo=$0+30s=pattern showcase+silent caller. Pattern showcase cycles all 21 patterns with empty grid+name+balls+pay every 2.5s. No math/RTP/bingo changes. |
| v4.6 | 2026-06-05 | slotH=66% winH; SVG artwork edge-to-edge; Blank weight restored VSTOP_TABLE (Cherry 27068→8000, Blank 0→19068); all-white reel strip (blank=white, no divider borders). No RTP/bingo/pattern changes. |
| v4.5 | 2026-06-05 | slotH=42% winH; symbol fill 84→95%; StrayPup fill 90→95%; strip.top centering formula. No math/bingo/RTP changes. |
| v4.4 | 2026-06-05 | strip.top 0px (not -slotH); slotH from clientHeight not offsetHeight; CSS top:-33.3333%→0; stopEntertainmentBalls removed from doBingoSpin. No math changes. |
| v4.3 | 2026-06-05 | Snap restore and renderReels use explicit px slot heights — flex/% collapsed after willChange compositing transition. |
| v4.2 | 2026-06-05 | STRIPS expanded with blank spacers; spinReel rewritten constant-velocity+overshoot+snap; blur 1.5px→6px; blank slots dark tape; ?v=4.2 cache-bust; Rule 15 added. Bug fixes: targetY, mkSym id=6, startEntertainmentBalls in RS onDone, blur moved to .reel-strip. |
| v1.0-v4.1 | 2026-06-04/05 | See archived change notes below. |
## v5.2 -> v5.3 CHANGES

### Fix 1: BG._coverAll1to40 initialized in BG object
Added `_coverAll1to40:false` to BG object declaration so the flag is always defined with a clean default. Previously undefined until first doBingoSpin call.

### Fix 2: enterDemo — no more innerHTML=""
Replaced `bingo-grid.innerHTML=""` with `_cardNodes=null`. The grid was being destroyed then immediately invalidated, causing an unnecessary DOM wipe. Now _cardNodes=null lets buildBingoCardNodes() rebuild cleanly on next renderBingoCard call.

### Fix 3: Watchdog S.spinning guard removed
Removed `if(S.spinning) return` from the 3-second watchdog. The watchdog now fires regardless of spin state — if the ball timer dies during a spin, it self-heals within 3 seconds rather than waiting until the spin completes.

### Fix 4: _showNextPattern dead assignment removed
The pattern name text was set twice in _showNextPattern: once before renderBingoCard (dead, immediately overwritten), once after. Removed the first dead assignment. Text is now set once after renderBingoCard so it is the final visible value.

**No bingo engine changes. No math changes. No RTP changes.**

---

## v5.1 -> v5.2 CHANGES

### Bug 1: _ballNodes NEVER nulled — permanent ball timer fix
_ballNodes was being set to null in sizeLayout on every layout change. When callNext (the 1.5s setInterval) fired and found _ballNodes null, it called buildBallStrip() which did innerHTML="" + 75 DOM node rebuilds inside the timer callback. This is the DOM thrash that throttled Samsung Browser timer scheduler. Fix: _ballNodes is never nulled anywhere. sizeBingoElements already resizes ball nodes in-place via querySelectorAll. Ball nodes survive all layout changes.

### Bug 2: exitDemo cleanup
Removed redundant _ballNodes pre-build from exitDemo. Since _ballNodes is never nulled, pre-building is unnecessary.

### Bug 3: opLog CASH_OUT fired on page load
The cash-out opLog call was outside the button event listener in the INIT section, executing on every page load and logging a fake $0 cash-out to the audit log. Moved inside the co-btn click handler where it belongs.

### Bug 4: startPatternCycle removed from runRS playNext
startPatternCycle([pat]) was being called inside runRS after each individual RS spin result, creating a competing patternCycle setInterval (firing every 2s) during Red Spin sequence. Removed — RS manages its own display.

### Bug 5: Cover All balls 1-40 — correct behavior
doBingoSpin now sets BG._coverAll1to40 flag if all 25 cells are matched in first 40 balls. doSpin checks this flag after animateReels and calls _coverAllReset(true): flashes "GAME END — COVER ALL $0.01", awards $0.01, resets ball sequence, resumes silent caller. New card generated only when player presses SPIN.

### Bug 6: Cover All balls 41-75 — correct behavior  
callNext in startEntertainmentBalls now checks Cover All after each daub. If achieved: calls _coverAllReset(false): flashes "GAME END — COVER ALL" (no penny), resets ball sequence, resumes silent caller. New card generated only when player presses SPIN.

### Bug 7: All Balls Called behavior
stopEntertainmentBalls called, sequence reset, silent caller resumes. New card waits for SPIN.

### Bug 8: Free space always shown as daubed
renderBingoCard always adds daubed class to cell 12. CSS .bc.free.daubed override keeps gold background + star visible (not blue) so free space is visually distinct from regular daubed cells.

### Dead code removed
- height:300% removed from .reel-strip CSS (JS sets height in px, CSS value was never used)
- Redundant .ball style loop in sizeBingoElements still present but harmless (low priority)

**No bingo engine changes. No math changes. No RTP changes.**

---

## v4.9 -> v5.0 CHANGES

### Reel strip redesign — equal symbol distribution

**Goal:** All 6 paying symbols appear exactly 4 times per reel — equal weight, no symbol over-represented. Previously Cherry appeared 7-8 times per reel vs SP=2, Seven=1, giving Cherry disproportionate visual presence.

**Change — `js/config.js` STRIPS:**
- Old distribution: SP=2, Seven=1, 3Bar=3, 2Bar=3-4, 1Bar=5, Cherry=7-8, Blank=28 (50 stops)
- New distribution: SP=4, Seven=4, 3Bar=4, 2Bar=4, 1Bar=4, Cherry=4, Blank=26 (50 stops)
- Each reel independently shuffled with a different random seed — no fixed neighbor pattern
- All 22 REEL_SYMS forced combination keys verified present on all 3 reels
- Strip length unchanged at 50 stops per reel
- Blank count reduced from 28 to 26 to accommodate the 6 extra paying symbol slots

**No VSTOP_TABLE changes. No bingo engine changes. No payout math changes. No RTP changes.**

---

## v4.8 -> v4.9 CHANGES

### Fix 1: Version corrected — Rule 11 violation
v4.8 hotfix (renderBingoCard rewrite) was delivered as an in-place update to the v4.8 zip without incrementing the version number, violating Rule 11. v4.9 corrects this. All version strings updated: index.html title, splash-ver div, all ?v= cache-bust tags, PHASE_PLAN header, folder name, zip name.

### Fix 2: Permanent ball caller watchdog
A self-healing `setInterval` runs every 3 seconds for the lifetime of the page. Logic:
- If `GS.state !== 'active'` → skip (idle/demo states manage their own callers)
- If `S.spinning` → skip (spin manages its own lifecycle)
- If `BG.entTimer` alive → skip (all good)
- If `_silentTimer` alive → skip (silent caller is running, also fine)
- Otherwise → `startEntertainmentBalls()` — self-heals within 3 seconds

This cannot be broken by future code changes. Any accidental timer kill during active play is caught and repaired automatically.

**No bingo engine changes. No math changes. No RTP changes.**

---

## v4.7 -> v4.8 CHANGES

### Fix 1: Pattern showcase — empty white cells
`_showNextPattern()` dummy card array changed from `i+1` (real numbers) to `0` (empty). `renderBingoCard` uses `card[i]||''` so 0 renders as blank white. Pattern cells still highlight blue. Free space still shows `*`. Numbers only appear when player joins and a real card is generated.

### Fix 2: renderBingoCard rewritten — in-place node updates (CRITICAL)
**Root cause of ball caller freeze:** `renderBingoCard` called `grid.innerHTML=''` (destroying/rebuilding 25 DOM nodes) and `sizeBingoElements` (full DOM reflow) on every call. `startPatternCycle` called `renderBingoCard` every 2 seconds. On Samsung Browser this DOM thrash throttled the `setInterval(callNext,1500)` ball timer — identical class of bug as `renderBallStrip` had.

**Fix:** `renderBingoCard` now pre-builds 25 cell nodes once via `buildBingoCardNodes()`. On each render call it only updates `className` and `textContent` in-place — no DOM destruction, no reflow. `_cardNodes` cache invalidated on `sizeLayout`, `enterDemo`, `exitDemo` to force rebuild on layout changes.

### Fix 3: Win reveal — reels land before patterns shown
`startPatternCycle(winPatterns)` moved to AFTER `animateReels` completes. Player sees reel combination first, then pattern grid highlights.
- No-RS path: `startPatternCycle(winPatterns)` called immediately after reel land
- RS path: base pattern shown during 1200ms pause → RS fires → `stopPatternCycle()` → all patterns shown after RS completes

### Fix 4: Pattern cycle always continuous
Removed `if(winPatterns.length>1)` guard. `BG.patternCycle=setInterval(showNext,2000)` fires unconditionally — single pattern wins also flash continuously until next spin.

**No bingo engine changes. No math changes. No RTP changes.**

---

## v4.6 -> v4.7 CHANGES

### Change 1: 5-slot variable-height reel strip
- Symbol slots: `symH = Math.round(winH * 0.47)` — 47% of window
- Blank slots: `blkH = Math.max(2, Math.round(winH * 0.04))` — 4% of window (thin gap)
- Strip now has 5 slots: `[above2, above, sym, below, below2]`
- `stripTotalH(slots, winH)` = sum of each slot's individual height
- `stripTopFor(slots, winH)` = centers payline slot (index 2) in window using cumulative height math
- `spinReel` end sequence extended to 5 final slots; `centerIdx = spinSyms.length - 3`
- `targetY` updated: `spinTopOff - (centerIdx-1)*slotH` → cumulative position of payline slot
- Snap-back rebuilds as 5-slot variable-height strip using same helpers

### Change 2: Ghost objects extended — above2/below2
`genSpinResult` and `forcedSpinResult` now include `above2` and `below2` in every ghost object, looking 2 positions back/forward on the reel strip.

### Change 3: renderBallStrip — single-node in-place update
Pre-builds 75 ball DOM nodes once via `buildBallStrip()`. Each 1.5s tick updates only the newly called ball's `className` and `textContent`. Eliminates the 75-node rebuild that throttled Samsung Browser's timer scheduler.

### Change 4: Three game states
- **`GS.state='idle'`** (page load, has credits, never spun): pattern showcase cycles, ball strip empty, silent caller runs at 1.3s
- **`GS.state='active'`** (has spun at least once): live card + ball strip, entertainment caller at 1.5s
- **`GS.state='demo'`** (balance=$0, 30s elapsed): pattern showcase cycles, ball strip clears, silent caller runs

### Change 5: Pattern showcase
Cycles all 21 BINGO_PATTERNS every 2.5s showing: pattern name, ball threshold, all 3 bet payouts, and the pattern grid with cells highlighted blue on empty white card. Starts on page load (idle) and after 30s broke (demo). Stops instantly on SPIN or BET MAX.

### Change 6: Silent background caller (1.3s)
`startSilentCaller()` runs a `setInterval` at 1.3s advancing `BG.ballPos` silently — no display. Seamlessly restarts sequence at 75. Player joins wherever the sequence is on spin. `startEntertainmentBalls()` calls `stopSilentCaller()` so the two never compete.

**No bingo engine changes. No pattern changes. No RTP changes. No payout math changes.**

---


## v4.5 -> v4.6 CHANGES

### Change 1: slotH = 66% of window height
Each symbol slot is now 66% of the reel window height. Strip = 3×66% = 198% of window. Above/below symbols bleed ~17% of window into view (~25% of a symbol visible), matching real VGT Mr.Moneybags cabinet reel aesthetics. Formula: `slotH = Math.round(winH * 0.66)`. strip.top and targetY use same centering math as v4.5.

### Change 2: SVG symbol artwork redesigned edge-to-edge
All 6 SVG symbols (Seven, 3Bar, 2Bar, 1Bar, Cherry, Blank) redesigned to fill the full 200×200 viewBox with minimal internal padding. Previous artwork occupied only ~60% of viewBox, making symbols appear small even at 95% CSS fill.

### Change 3: Blank weight restored in VSTOP_TABLE (config.js)
In v3.5, blank weight (19068) was merged into Cherry (8000→27068) to prevent blanks landing on payline. This caused no-bingo spins to always show active symbols on payline — including cherries — making loss spins look like wins. Fix: Cherry restored to w:8000, Blank restored to w:19068. Total still 32768. Blank landing on payline = clean white space = unambiguous loss. No RTP impact — bingo drives all outcomes.

### Change 4: All-white reel strip — no dark tape, no dividers
- `.reel-slot-blank`: background changed from dark (#1a0e00) to white (#f5f0e8) — blank positions look clean, not like dark tape
- `.reel-slot`: border-bottom removed — no gold divider lines between symbols on strip
- `.reel-slot:last-child`: border rule removed (redundant)
- `.reel-slot:nth-child(2)`: border-top and border-bottom removed — payline slot keeps box-shadow highlight only

**No bingo engine changes. No pattern changes. No RTP changes. No payout math changes.**

---

## v4.4 -> v4.5 CHANGES

### Reel visual redesign — VGT cabinet reference match

**Goal:** Match real VGT machine reel aesthetics where each reel window shows the payline symbol fully centered with the symbols immediately above and below it partially visible (~30%), creating authentic near-miss tension. Previous design showed 3 equal full-height symbols with no partial peek.

**Change 1 — slotH formula (game.js, 3 locations):**
- `renderReels`, `spinReel` animation, `spinReel` snap-back
- Old: `slotH = Math.floor(winH / 3)` — 3 equal slots, each exactly 1/3 of window
- New: `slotH = Math.round(winH * 0.42)` — center slot ~42% of window; remaining ~58% split as ~29% above + ~29% below, creating authentic partial-peek near-miss

**Change 2 — strip.top offset formula (game.js, 3 locations):**
- Old: `strip.top = 0` (v4.4 fix for 3-equal-slot layout)
- New: `strip.top = -Math.round((winH - slotH) / 2)` — centers the payline slot (index 1 in 3-slot strip) exactly in the middle of the window regardless of slotH size
- Math: payline slot top edge must be at `(winH - slotH) / 2`. Strip slot[1] is at `strip.top + slotH`. So `strip.top = (winH - slotH)/2 - slotH = -(slotH - (winH-slotH)/2)`
- targetY in spinReel updated to match: `targetY = -(centerIdx * slotH) + Math.round((winH - slotH) / 2)`

**Change 3 — symbol fill size (styles.css):**
- `.reel-slot svg, .reel-slot img`: `84%` → `95%` — symbols fill slot boldly

**Change 4 — StrayPup image fill (game.js mkSym):**
- `width:90%;height:90%` → `width:95%;height:95%`

**No bingo engine changes. No math changes. No RTP changes. No pattern changes.**

---

## v4.3 -> v4.4 CHANGES

### Fix 1: Symbols not landing on centerline — CRITICAL

**Root cause:** The reel-window is the clip container. With a 3-slot strip, the payline symbol is at index 1. For it to appear in the middle third of the window, `strip.top` must equal 0 (not `-slotH`). Setting `top=-slotH` shifts the entire strip one slot upward: the above-ghost is clipped off the top, the payline symbol sits at the very top of the window, and the bottom half of the window is empty black. Two contributing factors: (1) `slotH` was computed from `reel.offsetHeight` which includes the 4px top+bottom borders (8px total), making each slot slightly too tall so `3×slotH > windowH`, overflowing the clip area; (2) CSS `top:-33.3333%` applied the same wrong one-slot-up shift in the CSS rest state.

**Fix — three locations:**
1. `renderReels()` in game.js: `strip.style.top = (-slotPx)+"px"` → `strip.style.top = "0px"`. `slotPx` now derived from `win.clientHeight` (inner height, excludes border) not `reelEl.offsetHeight`.
2. `spinReel()` snap-back in game.js: same correction — `strip.style.top = (-restSlotH)+"px"` → `strip.style.top = "0px"`. `restSlotH` computed from `win.clientHeight`.
3. CSS `styles.css`: `.reel-strip { top: -33.3333% }` → `top: 0`.

**No bingo engine changes. No math changes. No pattern changes.**

### Fix 2: Ball caller freezes during Red Spin — CRITICAL

**Root cause:** `startPatternCycle()` called `stopEntertainmentBalls()` internally. During a Red Spin, `playNext()` calls `startPatternCycle([pat])` after every RS spin result — this killed the `setInterval` ball timer mid-sequence. The ball caller only restarted when the entire RS sequence completed (line 857).

**Fix:** Removed `stopEntertainmentBalls()` from `startPatternCycle()`. Pattern cycling and ball calling are independent features. `stopPatternCycle()` and `stopEntertainmentBalls()` are already called together at the correct points in `doBingoSpin()` and `doSpin()`.

**No bingo engine changes. No math changes.**

---

## v3.8 -> v3.9 CHANGES

### Fix 1: Every non-bingo spin showed cherry-cherry-cherry — CRITICAL

**Root cause:** Since v3.5, blanks (id:6) were removed from all reel strips. However REEL_SYMS still contained id:6 in four entries: 'none':[6,6,6], 'ch2':[5,5,6], 'ch1':[5,6,6], 'spch':[0,5,6]. When forcedSpinResult searched STRIPS[r] for symbol 6, the loop never found a match, leaving pos=0. Strip position 0 on all three reels is Cherry (5). So every affected spin force-landed cherry on all reels.

**Fix — js/game.js REEL_SYMS:**
- 'none':[6,6,6] → [4,2,3] — 1Bar/3Bar/2Bar: clear visual mixed-loss
- 'ch2':[5,5,6] → [5,5,4] — Cherry/Cherry/1Bar
- 'ch1':[5,6,6] → [5,4,3] — Cherry/1Bar/2Bar
- 'spch':[0,5,6] → [0,5,4] — SP/Cherry/1Bar

All replacement symbols verified present on all three reel strips.

### Fix 2: Spin speed increased

- STOP_DELAYS: [620,980,1380] → [380,620,900]
- RS_STOP: [500,780,1060] → [320,520,720]

**No bingo engine changes. No pattern changes. No CSS changes. No payout math changes.**

---

## v2.0 → v2.1 CHANGES

### Fix 1: index.html duplicate tail removed (CRITICAL)
- Root cause: The closing `</div>`, `<script src="js/game.js">`, `</body>`, and `</html>` block appeared **twice** at the end of index.html. The parser loaded game.js twice, doubling all event listeners (two spin triggers per tap, doubled sound calls, two competing game state objects).
- Fix: Removed the duplicate tail (lines 115–119). File now has a single script tag and a single `</body></html>`.

### Fix 2: Fresh ball sequence generated every spin
- Root cause: `doBingoSpin()` only called `genBallCall()` if `BG.callSeq` was missing or not 75 balls long. The same shuffled 75-ball sequence was reused across consecutive spins, weakening the randomness of the bingo engine. A Class II machine should use a fresh independent shuffle for each spin's outcome determination.
- Fix: `doBingoSpin()` now unconditionally calls `BG.callSeq = genBallCall()` at the top of every spin, guaranteeing a fresh independent shuffle each time.

---

## AUDIT FINDINGS v2.0 — FULL RECORD (2026-06-05)

The following findings were produced by a full code audit of v2.0. Items marked FIXED were resolved in v2.1. Items marked OPEN remain for owner review/decision.

### [FIXED] Critical: index.html double-load of game.js
See Fix 1 above.

### [FIXED] Significant: BG.callSeq not regenerated per spin
See Fix 2 above.

### [OPEN] Significant: Single-cherry pay doesn't match PHASE_PLAN spec
- PHASE_PLAN states: "Cherry on ANY reel pays Open Diamond (2 credits bet 1)."
- The Open Diamond bingo pattern pays `[2,4,6]`.
- `evalSpin` single-cherry pays `CPART[ci]` = `[1,2,3]` — 1 credit at bet 1, not 2.
- Two cherries correctly pays `CPART[ci]*2` = `[2,4,6]`.
- DECISION NEEDED: Does "cherry on any reel" mean the Open Diamond bingo *pattern* (2cr), or a standalone 1-cherry slot pay (1cr)? If the bingo engine drives all outcomes, `evalSpin` may only apply to non-bingo display and the spec may refer to the pattern pay. Clarify intent before changing math (Rule 3).

### [OPEN] Minor: Dead code in evalSpin wild=2 branch
- When `wilds===2`, there are two back-to-back conditions for BAR symbols. All BARs (id 2, 3, 4) are keys in `PAY`, so the second `BARS.indexOf` condition is unreachable — the first `PAY[L[2]]` check always fires first.
- Not harmful; safe to leave or clean up.

### [OPEN] Minor: RS Jackpot doesn't update Bonus Total display
- When a JP pattern fires inside a Red Spin sequence, `bt-val` is not updated with the jackpot amount before the JP overlay appears. The jackpot shows correctly in the overlay, but the on-screen Bonus Total counter stays at its pre-jackpot value.
- Cosmetic only.

### [OPEN] Minor: RS Jackpot early-exit is assumption-dependent
- `runRS` has a special early-exit branch for `pat.reel === 'jp'` that abandons any remaining patterns after the JP fires. Currently safe because Corporal Stripes (the only JP pattern) pays the highest of all patterns and always sorts to the last position in ascending RS order, so it's never mid-sequence.
- Fragile if new JP-tier patterns are added. Consider a guard: sort JP patterns to always last regardless of pay value.

### [OPEN] Note: All win-tier sounds play the same file
- `sndSmallWin()`, `sndBigWin()`, and `sndJackpot()` all call `playOnce('snd-ring')`. No audio differentiation between win tiers. Likely intentional given available assets, but noted for future enhancement.

### [OPEN] Note: UTF-8 BOM on all three text files
- `index.html`, `game.js`, and `styles.css` all begin with a UTF-8 BOM (EF BB BF). Browsers handle it fine; low risk. Worth stripping if any server pipeline or concatenation tool is introduced.

### [CONFIRMED OK] Weight table math
- VSTOP_TABLE weights sum to exactly 32768, matching `rng.int(0,32767)` (which produces 32768 distinct values). No probability gap, no over-representation of blanks. Table is correct.

### [CONFIRMED OK] RS sort order
- `winPatterns` sorted ascending by `pay[0]`; index 0 = lowest = base spin; `slice(1)` = remaining RS patterns in ascending order. Matches PHASE_PLAN spec exactly.

### [CONFIRMED OK] Wild logic and jackpot detection
- JP (three SPs) is detected before wild expansion. Leading-wild-only counting (reel 0 and/or reel 1) is correct for left-to-right logic.

### [CONFIRMED OK] Cover-all detection
- `Object.keys(BG.matchedCells).length === 25` correctly counts 24 numbered cells + 1 free space = full cover-all.

### [CONFIRMED OK] Double-spin prevention
- `S.spinning` flag prevents re-entry. `touchend` calls `e.preventDefault()` suppressing the subsequent `click` event on mobile.

### [CONFIRMED OK] Card uniqueness
- sessionStorage fingerprinting with 1000-card history is correctly implemented.

### [CONFIRMED OK] genBingoCard ordering
- Correctly transposes from column-major generation to row-major cell ordering before setting free space at index 12.

## v1.9 → v2.0 CHANGES

### Issue 1 Fixed: Card cell color scheme — now matches reference (Image 1)
- Root cause: `.bc` used dark semi-transparent background with light text, opposite of reference.
- Fix: `.bc` now uses `linear-gradient(135deg,#f5d878,#d4af37)` with `color:#1a0800` (dark text on gold).
- Daubed cells: bright blue gradient `#2255cc→#0033aa` with white text (still clearly distinguishable).
- Free space: same gold background, dark translucent star text.

### Issue 2 Fixed: BINGO column header size
- Root cause: `.bcol-hdr` was hardcoded `font-size:10px`, too small.
- Fix: `sizeBingoElements` now calculates `hdrFontSz` from `cellW * 0.65`, applied dynamically per cell size.
- CSS default bumped to `font-size:16px` with gold text-shadow for visual weight.

### Issue 3 Fixed: Card dominates full width — now locked to ≤40% viewport width
- Root cause: `sizeBingoElements` derived `cellW` only from height, no width cap.
- Fix: Added `maxCardW = vpw * 0.40` constraint. If `(cellW*5+4) > maxCardW`, `cellW` is recalculated from width.
- Ball strip `flex:1` already claimed remaining space; now it reliably gets ~60%.

## v2.1 -> v2.2 CHANGES

### Issue 1 Fixed: Bingo card cut off by reels
- Root cause: Header height formula (`min(vpw*0.30, vph*0.15)`) allocated too much vertical space for the tall splash image. Bingo section only received 28% of remaining height — insufficient for 5 card rows + ball strip.
- Fix: Header height reduced to `min(vpw*0.18, vph*0.10)`. Bingo section increased to 32% of remaining height. `object-fit` switched from `contain` to `cover` for the wide banner.

### Issue 2 Fixed: Banner image replaced
- Root cause: `hdr-img-el` was pointed at `splash.jpg` (the square splash screen art). The new wide landscape banner (Image 2) is far better suited as an in-game header.
- Fix: `banner.jpg` added to `assets/`. `img-banner` element added to asset-store in `index.html`. `IMG_BANNER` variable added to `game.js`; `hdr-img-el.src` now set from `IMG_BANNER`. Splash screen continues to use `splash.jpg` unchanged.

### Issue 3 Fixed: Ball strip redesigned to VGT call-order display
- Root cause: Ball strip rendered all 75 balls in fixed numeric order (1-15 in B row, 16-30 in I row, etc.), which is static and doesn't show call sequence. Reference VGT machines show balls in the order they were called, filling left-to-right across each B/I/N/G/O row.
- Fix: `renderBallStrip` completely rewritten. Each row now shows up to 15 slots filled in call order:
  - GREEN: ball is in first 40 (outcome-determining) AND is on the player's card
  - YELLOW: ball is in first 40 AND is NOT on the player's card
  - WHITE: entertainment ball (call index 41-75), revealed one at a time at 3s intervals
  - DIM EMPTY: slot not yet filled (placeholder shown)
- Bingo card outcome is still determined solely by first 40 balls (unchanged per spec).
- `sizeBingoElements` updated: ball slot width is now calculated from available strip width divided by 15 slots, ensuring all 15 fit. Ball row height matches card cell height for visual alignment.

## OPEN ITEMS (carried forward from v2.0 audit)
- Single-cherry pay vs PHASE_PLAN spec discrepancy (1cr vs 2cr at bet 1) — needs owner decision
- Dead code in evalSpin wild=2 BAR branch — harmless, low priority
- RS Jackpot doesn't update Bonus Total display — cosmetic
- RS Jackpot early-exit fragility — safe with current pattern set
- All win-tier sounds play same file — intentional per available assets
- UTF-8 BOM on all three text files — low risk

## v2.2 -> v2.3 CHANGES

### Issue Fixed: Bingo card cut off and ball strip collapsed on S23
- Root cause (card): `sizeBingoElements` derived cell size from height first, then applied a 40% width cap. The CSS `.ball{flex:1}` and `.bsr` rows lacking `overflow:hidden` allowed flex children to override inline widths. The card col-header container had no explicit width lock, allowing it to stretch to full content width.
- Root cause (ball strip): `.ball` had `flex:1` in CSS which competed with inline `width` assignments. Rows had no `overflow:hidden`, so two-digit numbers bled outside their slots, appearing as corrupted text (e.g. "3023" = "30" and "23" overlapping).
- Fix (JS): `sizeBingoElements` completely rewritten with a vpw-first approach. Card width is derived first as 38% of vpw, cells sized to fit that width. Cell height is then capped to ensure 5 rows + col-header fit within `bingoH`. All card and strip elements receive `min-width`, `max-width`, and `flex:none` via inline style — no CSS flex can override them.
- Fix (CSS): `.ball` changed from `flex:1` to `flex:none`. `.bsr` rows get `overflow:hidden` and `flex-wrap:nowrap`. `#bingo-card-wrap` gets explicit `flex-grow:0`. `#bingo-card-area` gets `overflow:hidden` and `flex-wrap:nowrap`.

## v2.3 -> v2.4 CHANGES

### Issue Fixed: Bingo patterns awarded without ball-count threshold enforcement
- Root cause: `doBingoSpin` daubed all 40 balls into `matchedCells` up-front, then called `checkPatterns(matchedCells)` which checked cell coverage only — it had no concept of *when* each cell was daubed relative to the pattern's `balls` threshold. A pattern like Tee (threshold: 38 balls) could be awarded even if its last required cell wasn't covered until ball 39 or 40.
- Fix: `doBingoSpin` now evaluates patterns **ball-by-ball** through the first 40. After each ball is daubed, every uncompleted pattern is checked. A pattern is only added to winners if all its required cells are filled AND the current ball count is ≤ `pat.balls`. Once a pattern wins it is flagged and skipped on subsequent balls. `matchedCells` still accumulates all 40 daubed cells for display purposes.
- Impact (Monte Carlo, 100,000 spins): ~0.75% of spins had at least one pattern previously awarded in error. These are now correctly rejected. RTP impact is minor but real — owner should note this slightly reduces payout frequency for borderline patterns.
- The `balls` field was already correct in `BINGO_PATTERNS` for all 21 patterns; this fix activates it.

## v2.4 -> v2.5 CHANGES

### Fix 1: Banner cropped — switched to aspect-ratio-derived height with contain
- Root cause: `object-fit:cover` with a fixed height cap was cropping the top and bottom of the 4:1 banner. The height formula `min(vpw*0.18, vph*0.10)` was also too small.
- Fix: Header height now calculated as `Math.round(vpw/4)` — exactly the natural height of a 4:1 image at full screen width. `object-fit` switched back to `contain`. Banner now shows in full with no cropping on any screen width.

### Fix 2: Ball call sequence regenerated every spin (incorrect)
- Root cause: v2.1 fix unconditionally called `genBallCall()` on every spin. This was wrong — the ball sequence should persist and continue across spins, only regenerating when all 75 balls are exhausted.
- Fix: Conditional restored: `if(!BG.callSeq || BG.callSeq.length!==75 || BG.ballPos>=75) BG.callSeq=genBallCall()`. Sequence persists across spins; new sequence generated only when `ballPos` reaches 75 (all balls called through entertainment phase).

### Fix 3: Ball strip display — card narrowed, strip width explicitly set
- Root cause: Card at 38% of vpw left slot widths of only 13px for 15 ball slots — too cramped for 2-digit numbers. Ball strip grid also lacked an explicit width, allowing flex to missize it.
- Fix: Card reduced to 34% of vpw (slotW increases to 14px). Ball strip grid and each `.bsr` row now receive explicit `width=stripW` inline, ensuring they stretch to fill the available space precisely.

## v2.5 -> v2.6 CHANGES

### Fix 1: Reel strips — blanks reduced from 13 to 1 per strip
- Root cause: Original strips had 13 blanks out of 22 stops (59%), making reels look mostly empty. Since all wins are bingo-determined, blanks serve no mathematical purpose — they're purely cosmetic.
- Fix: All three reel strips rebuilt with exactly 1 blank each (22 stops total):
  `[5,4,5,3,5,4,5,2,5,4,3,5,1,4,3,2,4,0,3,2,0,6]`
  Distribution: SP×2, Seven×1, 3Bar×3, 2Bar×4, 1Bar×5, Cherry×6, Blank×1.
  All symbols required by REEL_SYMS combos are present. Blank is flanked by SP and Cherry for clean ghost display.

### Change: Game data extracted to js/config.js
- All tunable game data moved out of game.js into a new dedicated file: `js/config.js`.
- config.js contains: PAY table, CPART/MBAR/JP amounts, VSTOP_TABLE weights, STRIPS, and all 21 BINGO_PATTERNS.
- game.js loads these as globals; no functional change — purely an organisational split.
- config.js is heavily commented with instructions for tuning frequency and payouts.
- index.html now loads config.js before game.js.

## HOW TO TUNE THE GAME (config.js)

### Make a pattern hit more often
Raise its `balls` value. Example — Tee currently hits within 38 balls:
  `{name:'Tee', balls:38, ...}`
Change to `balls:40` and it can now complete with up to 40 balls called instead of 38.
The maximum useful value is 40 (the outcome window). Setting `balls:41` or higher
has no additional effect since only 40 balls determine the outcome.

### Make a pattern pay more
Change its `pay` array. Example — Tee at bet 1 pays $20:
  `pay:[20,40,60]`  →  `pay:[25,50,75]`

### Change jackpot amounts
Edit the `JP` array at the top of config.js:
  `var JP = [800, 1600, 2500];`  (bet1, bet2, bet3)

### RULE: Any math change requires Monte Carlo verification (PHASE_PLAN Rule 3).

## v2.6 -> v2.7 CHANGES

### Fix 1: Ball caller — pure call-order display, no row labels
- Root cause: Ball strip was grouping balls by B/I/N/G/O column range and showing them within each labelled row. Reference machines show all 75 balls in a plain 5×15 grid filled strictly in call order: slot [row 0, col 0] = ball called 1st, [row 0, col 14] = ball called 15th, [row 1, col 0] = ball called 16th, etc. No B/I/N/G/O labels.
- Fix: `renderBallStrip` rewritten. Ball at sequence index `(row*15)+col` fills each slot. Colour rules unchanged: GREEN = first 40 + on card, YELLOW = first 40 + not on card, WHITE = entertainment (41+), DIM = not yet called. Row label elements no longer rendered; `.bsr-lbl` CSS removed.
- `sizeBingoElements` updated: strip width now split equally across 15 slots with no label offset.

### Fix 2: Version number on splash screen (Rule 12)
- Added `<div id="splash-ver">` to splash footer in index.html, displaying current version.
- CSS: small muted gold text below the title.
- **Rule 12 added to PHASE_PLAN mandatory rules**: Update `#splash-ver` in index.html to the current version on every delivery. Required, no exceptions.

## v2.7 -> v2.8 CHANGES

### Fix 1: Entertainment balls (41-75) now persist across spins
- Root cause: `doBingoSpin` was unconditionally setting `BG.ballPos=40` on every call, discarding any entertainment progress. The ball sequence was also being regenerated whenever `BG.ballPos` exceeded 0, so pressing spin always reset to a fresh 40-ball state.
- Fix: `doBingoSpin` now saves `prevBallPos` before any changes. The call sequence is only regenerated if `prevBallPos===0` (first ever spin or after a full 75-ball cycle). After the 40-ball outcome evaluation, any entertainment balls already revealed (`callSeq[40..prevBallPos-1]`) are daubed onto the new card for display. `BG.ballPos` is set to `max(40, prevBallPos)` so the strip renders showing all previously revealed balls immediately.

### Fix 2: Entertainment balls daub the card (visual only)
- Entertainment balls 41+ that match numbers on the new card are now daubed in `BG.matchedCells` for display. They are NOT evaluated for pattern completion — pattern evaluation is strictly limited to the first 40 balls only (unchanged).

### Fix 3: "ALL BALLS CALLED — NEW GAME" message
- When `BG.ballPos` reaches 75 in `startEntertainmentBalls`, the entertainment timer stops, the pattern name bar flashes "ALL BALLS CALLED — NEW GAME" in gold, then after 2 seconds: clears the message, generates a fresh 75-ball sequence, resets `BG.ballPos=0`, and re-renders the empty strip.

### Fix 4: Entertainment interval reduced from 3s to 1.5s
- 3 seconds per ball × 35 remaining balls = 105 seconds to complete a full call. Reduced to 1.5 seconds (~52 seconds total), which feels closer to a real machine pace.

## v2.8 -> v2.9 CHANGES

### Fix: Ball strip numbers invisible during active gameplay
- Root cause: `renderBallStrip` called `sizeBingoElements(bingo-section.offsetHeight||160)` at the end of every render. During an active spin, `bingo-section.offsetHeight` returns 0 (the element hasn't reflowed yet), so the fallback `160` was used. With `bingoH=160`, `sizeBingoElements` calculated a tiny `slotW` and set `balls[j].style.fontSize` to a near-zero value — visually hiding all numbers. The CSS color classes (`ball.match`, `ball.pre`, `ball.called`) were correct, but the text was rendered at ~0px.
- Same issue affected `renderBingoCard` (called during entertainment ball daubing).
- Fix: Two-part solution:
  1. `sizeLayout` now stores `_lastBingoH` and `_lastVpw` globals after computing the bingo section height. `renderBingoCard` uses `sizeBingoElements(_lastBingoH, _lastVpw)` — always correct, never stale.
  2. `sizeBingoElements` caches `slotW`, `ballH`, `ballFontSz`, `stripW` directly on the `bsGrid` DOM element. `renderBallStrip` uses these cached values instead of calling `sizeBingoElements` at all — no offsetHeight lookup, no reflow, guaranteed correct font size every render tick including during animation.

## v3.7 -> v3.8 CHANGES

### Fix: Ghost symbols (above/below payline) completely invisible at rest — CRITICAL

**Root cause:** `.reel-strip` had `top:-100%`. In CSS, percentage `top` on an absolutely-positioned element is relative to the **containing block height** — here the `.reel-window`, which equals the reel height (= 1 slot height). So `top:-100%` = `-1 × reelHeight` = `-1 × slotH`. This placed the 3-slot strip so that:
- slot[0] (above ghost): `y = -slotH` → entirely above the clip region, **invisible**
- slot[1] (payline sym): `y = 0` → visible at center ✓
- slot[2] (below ghost): `y = +slotH` → entirely below the clip region, **invisible**

Only the payline symbol ever showed at rest. The near-miss symbols vanished the moment the spin animation snapped back.

**Fix:** Changed `top:-100%` → `top:-33.3333%`. Since the strip is `height:300%` of the reel-window, `-33.3333%` of the reel-window = `-1/3` of the strip height = exactly one slot height up. This centers the strip so:
- slot[0] (above ghost): `y = -slotH` → top of reel-window, partially visible ✓
- slot[1] (payline sym): `y = 0` → center of reel-window, on payline ✓
- slot[2] (below ghost): `y = +slotH` → bottom of reel-window, partially visible ✓

The spin animation `centerIdx` math was already correct and is unchanged — its final pixel position always placed `finalGhost.sym` at the payline. The snap-back `strip.style.top=''` correctly reverts to the new CSS value.

**One line changed in styles.css. No JS changes. No math changes. No bingo engine changes.**

---

## v3.6 -> v3.7 CHANGES

### Feature: Rounded reel porthole design — near-miss symbols visible and naturally faded

**Goal:** Match VGT reference machine reel aesthetics where above/below ghost symbols are clearly visible but fade softly at the top and bottom of each reel window, creating a genuine near-miss tension effect.

**Change 1 — `.reel` border-radius: 8px → 22px**
Raised from a barely-noticeable rectangle to a prominent rounded-rectangle ("playing card portrait") shape matching the physical reel frames on reference machines. Border upgraded from 3px to 4px solid gold. Dark background (#1a0a00) replaces the light cream — matches the cabinet surround. Inset highlight/shadow gives a 3D bevel feel.

**Change 2 — `.reel-window` border-radius: 6px → 20px**
The clip mask now has strongly rounded top and bottom, so ghost symbols at the edges curve away rather than cutting flat.

**Change 3 — `.reel-window::after` gradient vignette (NEW)**
A pseudo-element overlay fades the top and bottom 30% of each reel window from ~78% dark → transparent. This makes above/below ghost symbols visible at the center of their slot (full symbol clear) while dissolving softly into the reel frame at the outermost edges — identical to viewing a physical reel drum through a cabinet window.

**Change 4 — `.reel-slot:nth-child(2)` center highlight**
The middle (payline) slot gets a slightly brighter background and a faint inner glow to visually reinforce it as the "hot" landing zone.

**Change 5 — `#payline-mark` z-index: 20 → 25**
Raised above the new `::after` vignette overlay (z-index:5) so the payline stripe always renders on top.

**No JS changes. No math changes. No bingo engine changes. No layout sizing changes.**

---

## v3.5 -> v3.6 CHANGES

### Fix: Reels showing only 2 partial symbols — full 3-row near-miss layout restored

**Root cause:** Fixed pixel `SLOT_H` approach was fragile across screen sizes. The reel container height varies with padding/border/flex layout, so `height/3` calculated at init could be wrong by the time symbols rendered — causing slots to overflow or underlap the reel window, showing only partial rows.

**Fix — CSS-driven percentage layout (no pixel dependency at rest):**
- `.reel-strip`: `height:300%`, `top:-100%` — strip is always exactly 3× the reel window height, positioned so the center slot sits perfectly on the payline
- `.reel-slot`: `flex:1` — each slot claims exactly one-third of the strip height automatically, on any screen size, with no JS math
- No inline `style.height` on slots at rest — CSS owns the layout entirely

**Spin animation (still pixel-based for smooth easing):**
- `spinReel()` measures `reel.offsetHeight/3` at spin time (accurate after layout) for pixel-exact animation math
- During animation: slot heights set to measured pixels + `flex:none` so easing scrolls precisely
- On land (after 80ms stopping): strip innerHTML replaced with clean 3-slot CSS build — `style.height`, `style.top`, `style.willChange` all cleared, slots revert to `flex:1`
- Result: perfect snap to full-window 3-row display every time

**No bingo engine, math, or pattern changes.**

---

## v3.4 -> v3.5 CHANGES

### Fix: No blanks on reel strips — near-miss on every spin like real machine

**Change 1 — `js/config.js` STRIPS:** Replaced the single blank (`6`) position on each of the 3 reel strips with Cherry (`5`). All 22 stops on every reel now hold a paying symbol. Near-miss tension comes entirely from high-value symbols landing just above or below the payline.

**Change 2 — `js/config.js` VSTOP_TABLE:** The blank entry (`id:6, w:19068`) was remapped to Cherry (`id:5`). Its weight (19068) was merged into Cherry's weight (8000) → Cherry now `w:27068`. Total still sums to 32768. No probability gap. Non-bingo loss spins now resolve cleanly to Cherry on the payline instead of hunting for a missing blank stop.

**Bonus fix — `js/game.js` `renderReels()`:** Removed leftover stray `1.0` argument from `buildSlot(g.sym, 1.0)` — function signature is now `buildSlot(symId)` only, consistent throughout.

**No bingo engine changes. No pattern changes. No payout math changes.**

---

## v3.3 -> v3.4 CHANGES

### Fix: Reel symbols not showing (only 1 of 3 slots visible)

**Root cause:** `initReelSlots()` set `SLOT_H = r0.offsetHeight` — the full height of the reel container. Each slot was then rendered at that full height, so 3 slots stacked = 3× the reel window height. Only the top slot (the "above" ghost) was visible; center and below were scrolled far out of view. The strip offset `top = -SLOT_H` moved the strip up one full reel height, which accidentally placed the above-ghost in the center — explaining why only 1 symbol showed.

**Fix:** `SLOT_H = Math.floor(r0.offsetHeight / 3)`. Each slot is now exactly one-third of the reel height, so all three positions (above, center, below) fit perfectly in the reel window with no overflow.

---

## v3.2 -> v3.3 CHANGES

### Feature: Near-miss ghost symbols — full brightness on all reel rows

**Root cause of missing near-miss feel:** Ghost slots (above and below the payline) were rendered at `opacity:0.22` — nearly invisible. This killed any sense of "so close!" tension. Reference VGT machines show all three visible symbol rows at equal full brightness.

**Fix — three spots in `game.js`:**

1. **`buildSlot(symId, opacity)`** — removed the `opacity` parameter and the conditional `slot.style.opacity` assignment. All slots now render at the browser default (1.0) always.

2. **`renderReels()`** — removed the `0.22` opacity arguments on `g.above` and `g.below` calls to `buildSlot`. Ghost slots on rested reels now show at full brightness.

3. **`spinReel()`** — removed the `0.22` opacity on the final ghost slots built at the end of the spin strip (the above/below landing positions). All animation frames and the landed state are now full brightness throughout.

**No math, no bingo engine, no pattern eval, no sizing changes.**

---

## v3.1 -> v3.2 CHANGES

### Feature: Cover All ends game at any ball (1–75) — seamless reset

**Rule added:** If all 25 card cells are daubed at any point during ball calling (first 40 outcome balls or entertainment balls 41–75), the current game ends and a fresh game begins automatically.

**Seamless design — zero glitch for the player:**
- On cover all detection: next card + 75-ball sequence are pre-generated immediately in the background
- `✦ COVER ALL ✦` flashes in the pattern name bar (gold, 1.5s) while the new data is ready
- After 1.5s: new card renders, strip resets to empty, `BG.ballPos=0`, `startEntertainmentBalls()` fires — ball calling resumes with no gap
- Same seamless reset applied to the "ALL BALLS CALLED" path (now also restarts ball calling instead of leaving strip frozen)

**Implementation:** `doSeamlessReset()` helper added inside `startEntertainmentBalls()`. Cover all check (`Object.keys(BG.matchedCells).length===25`) runs after every daub in `callNext()`.

**No math changes. No pattern eval changes. No RNG changes. `doSpin` untouched.**

---

## v3.0 -> v3.1 CHANGES

### Fix: Ball caller not running during gameplay (only idle/bonus)

**Root cause:** `startEntertainmentBalls()` was only called inside the `animateReels` callback — after reels stopped — so the ball caller was frozen during reel animation (~1.4s) and absent during Red Spin bonus. It was also never called at game init, so the strip was static until the first spin completed.

**Fix — three changes in `game.js`:**
1. **Init:** `startEntertainmentBalls()` added after the initial `renderBallStrip()` call. Ball caller begins on page load.
2. **`doSpin()`:** `startEntertainmentBalls()` added immediately after `doBingoSpin()` (before `animateReels`). Balls call continuously through reel animation and into Red Spin.
3. **Removed 3 redundant calls:** Removed `startEntertainmentBalls()` from the no-bingo, base-win, and Red Spin completion paths inside `animateReels` callback. Timer was already running; re-calling it would restart the 1.5s interval mid-sequence.

No math, no logic changes. `BG.ballPos` untouched.

---

## v2.9 -> v3.0 CHANGES


### Feature: Operator Menu (js/operator.js)

**Access:** Tap the banner (#hdr-img) 5 times within 3 seconds. PIN pad appears.
**Default PIN:** 7777 (change via Settings tab — stored as hash, never plaintext).

**HISTORY tab:**
- Summary: total spins, wagered, won, cash in/out, record count
- Per-record: type (SPIN/CASH_IN/CASH_OUT), datetime, card serial, game serial, bet, win, patterns won, balance before/after
- SPIN records: gold border; CASH_IN: cyan; CASH_OUT: green
- Export JSON button (copies to clipboard)
- Max 500 records; oldest dropped when full

**RTP / HOLD tab:**
- Actual RTP% and Hold% calculated from all recorded spins
- Total wagered, total paid out, spin count
- Target RTP (94%) and Target Hold (6%) shown for comparison

**SETTINGS tab:**
- Change PIN (enter current + new twice; validated before saving)
- Clear History (confirmation required)
- Version info

**Card serial numbers (Rule 13):**
- `localStorage` counter `spbm_card_ctr` increments on every card generated
- Format: `CARD-00000001`, `CARD-00000002`, etc.
- Permanent — survives session, browser restart, and device sleep
- Used card fingerprints also moved from `sessionStorage` to `localStorage`

**opLog hooks (game.js):**
- Every spin logged at completion (win and no-bingo paths)
- Cash-in (ic-ok button and preset buttons) logged
- Cash-out logged
- `genGameSerial()` generates unique game ID per spin: `GAME-` + timestamp hex + random hex

**Rule 14:** PIN stored only as a simple hash (`ph_XXXXXXXX`). Never appears in history records or any log.
