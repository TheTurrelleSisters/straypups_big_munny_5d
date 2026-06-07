'use strict';
var UI = (function() {
  function $(id) { return document.getElementById(id); }
  var reelEls = [], paylineCanvas = null, paylineCtx = null;
  // pickTapCb removed v8.1.36 — was dead variable (never written after init).
  // Tile taps now correctly use _pickTapCallback (set by setPickTapCallback).
  var _skipCreditAnim = false;
  var isAnimatingCredits = false;

  var PAYLINE_COLORS = ['#ff0','#0ff','#f0f','#0f0','#f80','#08f','#f44','#4f4','#44f','#ff8','#8ff','#f8f','#8f8','#88f','#f88','#4ff','#ff4','#f4f','#4f8','#84f'];

  function init() {
    reelEls = [0,1,2,3,4].map(function(i) { return $('reel-'+i); });
    if (typeof GameState !== 'undefined' && GameState.balance <= 0) _startInsertCashTicker();
    paylineCanvas = $('payline-canvas');
    if (paylineCanvas) paylineCtx = paylineCanvas.getContext('2d');
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    _wireHelpButtons(); // v8.1.3: wire help menu buttons
  }

  function resizeCanvas() {
    var frame = $('reel-frame');
    if (!frame || !paylineCanvas) return;
    // Use clientWidth/clientHeight (excludes border) so canvas coords match
    // the CSS pixel space of the cells inside the frame. offsetWidth includes
    // the 3px border on each side, which would create a 1.5% scale mismatch.
    var cw = frame.clientWidth, ch = frame.clientHeight;
    if (cw === 0 || ch === 0) { setTimeout(resizeCanvas, 100); return; }
    if (paylineCanvas.width  !== cw) paylineCanvas.width  = cw;
    if (paylineCanvas.height !== ch) paylineCanvas.height = ch;
  }

  function _roundCoinValue(raw) { return Math.round(raw); }

  function _formatCoinAmt(raw) {
    var v = _roundCoinValue(raw);
    if (v < 1) v = 1;
    if (v >= 1000) return '$' + Math.round(v / 1000) + 'K';
    return '$' + v;
  }

  // _makeCoinSVG, _makeCoinElement, _pendingCoinMap, setPendingCoinMap,

  function makeSymbolImg(symId) {
    var sym = SYMBOL_BY_ID[symId];
    if (!sym) {
      console.warn('[UI] makeSymbolImg: no symbol for id', symId, '— SYMBOL_BY_ID keys:', typeof SYMBOL_BY_ID !== 'undefined' ? Object.keys(SYMBOL_BY_ID).join(',') : 'UNDEFINED');
      return null;
    }
    var img = document.createElement('img');
    img.src = sym.file; img.alt = sym.name; img.draggable = false;
    return img;
  }

  function renderGrid(grid) {
    for (var col = 0; col < reelEls.length; col++) {
      var reel = reelEls[col];
      if (!reel) continue;
      var strip = reel.querySelector('.reel-strip');
      if (!strip) {
        strip = document.createElement('div');
        strip.className = 'reel-strip';
        reel.appendChild(strip);
      }
      strip.innerHTML   = '';
      strip.style.transform  = '';
      strip.style.transition = '';
      strip.style.height     = '100%';
      for (var row = 0; row < 3; row++) {
        strip.appendChild(_makeCell(grid[col][row], col, row));
      }
    }
    resizeCanvas();
  }

  // ── Symbol badge helper — v8.0 ─────────────────────────────────────
  function _makeSymbolBadge(symId) {
    var txt = null, cls = 'sym-badge';
    if (symId === SYMBOLS.SISTERS.id)   { txt = 'JACKPOT'; cls += ' sym-badge-jackpot'; }
    else if (symId === SYMBOLS.JOSIE.id)  { txt = '×2'; cls += ' sym-badge-josie'; }  // v8.1.40: +×2 additive (was ×3 capped)
    else if (symId === SYMBOLS.SASHA.id)  { txt = '×1'; cls += ' sym-badge-sasha'; }  // v8.1.40: +×1 additive (was ×2 capped)
    if (!txt) return null;
    var b = document.createElement('div');
    b.className = cls; b.textContent = txt;
    return b;
  }

  function _makeCell(symId, col, row) {
    var cell = document.createElement('div');
    cell.className = 'symbol-cell';
    cell.id = 'sc-' + col + '-' + row;
    // img is direct child of symbol-cell — uses .symbol-cell img rule (width:90% height:90%)
    // Badge overlays with position:absolute — no wrapper div needed (Samsung Browser safe)
    var img = makeSymbolImg(symId);
    if (img) cell.appendChild(img);
    var badge = _makeSymbolBadge(symId);
    if (badge) cell.appendChild(badge);
    return cell;
  }

  async function animateReelsStop(stops, grid, isReplay, isRedSpin) {
    if (isReplay === undefined) isReplay = false;
    if (isRedSpin === undefined) isRedSpin = false;
    clearPaylines(); clearHighlights();

    var DELAYS = isReplay ? [190,230,270,320,370] : [640,790,940,1090,1240];
    var SPIN   = isReplay ? 155 : 490;

    var promises = reelEls.map(function(reel, col) {
      return new Promise(function(resolve) {
        if (!reel) { resolve(); return; }
        setTimeout(function() {
          // v8.1.4: wrap in try/catch — if this throws it becomes a traceable error
          try {
          var strip = reel.querySelector('.reel-strip');
          if (!strip) { reel.style.filter = ''; resolve(); return; }

          var reelStrip = REEL_STRIPS[col];
          if (!reelStrip) { console.error('[UI] REEL_STRIPS['+col+'] undefined'); resolve(); return; }
          var len       = reelStrip.length;
          var stop      = stops[col];
          var reelH     = reel.offsetHeight || 210;
          var cellH     = Math.floor(reelH / 3);

          strip.style.transition = 'none';
          strip.style.transform  = 'translateY(0)';
          strip.style.height     = 'auto';
          strip.innerHTML        = '';

          for (var i = -15; i < 3; i++) {
            var symId = reelStrip[((stop + i) % len + len) % len];
            var cell  = document.createElement('div');
            cell.className = 'symbol-cell';
            cell.style.cssText = 'height:' + cellH + 'px;flex:none;min-height:unset;';
            var img = makeSymbolImg(symId);
            // img direct child of cell — Samsung Browser safe (no % height wrapper)
            if (img) cell.appendChild(img);
            var sbadge = _makeSymbolBadge(symId);
            if (sbadge) cell.appendChild(sbadge);
            strip.appendChild(cell);
          }

          strip.style.transform = 'translateY(0)';

          requestAnimationFrame(function() {
            requestAnimationFrame(function() {
              strip.style.transition = 'transform ' + SPIN + 'ms cubic-bezier(0.15,0.75,0.35,1)';
              strip.style.transform  = 'translateY(' + (-15 * cellH) + 'px)';

              setTimeout(function() {
                reel.style.transition  = '';
                strip.style.transition = 'none';
                strip.style.transform  = '';
                strip.style.height     = '100%';
                strip.innerHTML        = '';

                for (var row = 0; row < 3; row++) {
                  strip.appendChild(_makeCell(grid[col][row], col, row));
                }

                strip.style.transform = 'translateY(-5px)';
                setTimeout(function() {
                  strip.style.transition = 'transform 0.11s ease-out';
                  strip.style.transform  = 'translateY(2px)';
                  setTimeout(function() {
                    strip.style.transition = 'transform 0.08s ease-in';
                    strip.style.transform  = '';
                    if (!isReplay && !isRedSpin) Audio.play('reel_stop');
                    resolve();
                  }, 75);
                }, isRedSpin ? 55 : 105);

              }, SPIN + 25);
            });
          });
          } catch(animErr) {
            console.error('[UI] animateReelsStop reel '+col+' threw:', animErr.message, animErr.stack);
            // Still resolve so Promise.all completes and game can continue
            resolve();
          }
        }, DELAYS[col]);
      });
    });

    await Promise.all(promises);
    resizeCanvas();
    // v8.1.3: Re-enable controls after reel animation completes
    setControlsEnabled(true);
  }

  async function showRedSpinPaylineFlash(paylineWins) {
    if (!paylineWins || paylineWins.length === 0) return;
    clearPaylines();
    for (var wi = 0; wi < paylineWins.length; wi++) {
      drawPayline(paylineWins[wi].lineIndex, paylineWins[wi].line, paylineWins[wi].isLetter);
      flashCells(paylineWins[wi].line, paylineWins[wi].count);
    }
    await delay(500);
    clearPaylines();
    clearHighlights();
  }

  function _skipRequested() {
    try { return typeof getSkipPaylineAnimations !== 'undefined' && getSkipPaylineAnimations(); }
    catch(e) { return false; }
  }

  async function showBaseWins(result, betPerLine, linesActive, isReplay, fast) {
    if (isReplay === undefined) isReplay = false;
    if (fast === undefined) fast = false;
    if (!isReplay && _skipRequested()) { clearPaylines(); clearHighlights(); return; }
    var wins = result.paylineWins || [];
    if (!wins.length && !result.scatterWin) return;

    // ── Phase 1: Show all wins simultaneously ────────────────────────
    if (!_skipRequested()) {
      for (var wi = 0; wi < wins.length; wi++) {
        drawPayline(wins[wi].lineIndex, wins[wi].line, wins[wi].isLetter);
        flashCells(wins[wi].line, wins[wi].count);
      }
      if (result.scatterWin) flashScatters();
      updateWinDisplay(result.totalWin);
      var p1 = fast ? 350 : isReplay ? 500 : 800;
      for (var i1 = 0; i1 < 4; i1++) {
        if (!isReplay && _skipRequested()) { clearPaylines(); clearHighlights(); return; }
        await delay(Math.ceil(p1 / 4));
      }
      clearPaylines(); clearHighlights();
    }

    if (fast || isReplay) {
      // Bonus triggered or replay — one-shot only, don't loop
      if (fast) return;
      // Replay: brief individual cycle
      var sortedR = wins.slice().sort(function(a, b) { return a.amount - b.amount; });
      for (var ri = 0; ri < sortedR.length; ri++) {
        var rw = sortedR[ri];
        if (_skipRequested()) { clearPaylines(); clearHighlights(); return; }
        drawPayline(rw.lineIndex, rw.line, rw.isLetter);
        flashCells(rw.line, rw.count);
        updateWinDisplay(rw.amount, rw.lineName || '');
        for (var rj = 0; rj < 4; rj++) {
          if (_skipRequested()) break;
          await delay(100);
        }
        clearPaylines(); clearHighlights();
      }
      if (!_skipRequested()) updateWinDisplay(result.totalWin, '');
      return;
    }

    // ── Phase 2: LOOP — cycle through wins until player presses spin ─
    // v7.0.3: loops indefinitely so player sees their winning lines clearly.
    // Each iteration: all-at-once flash → cycle each win → repeat.
    // Broken immediately when _skipRequested() (spin button tap).
    var sortedWins = wins.slice().sort(function(a, b) { return a.amount - b.amount; });

    while (!_skipRequested()) {
      // All wins simultaneously (brief flash) — show total, no individual label
      for (var aw = 0; aw < wins.length; aw++) {
        drawPayline(wins[aw].lineIndex, wins[aw].line, wins[aw].isLetter);
        flashCells(wins[aw].line, wins[aw].count);
      }
      if (result.scatterWin) flashScatters();
      updateWinDisplay(result.totalWin, wins.length > 1 ? (wins.length + ' LINES') : '');
      for (var af = 0; af < 4; af++) {
        if (_skipRequested()) break;
        await delay(130);
      }
      clearPaylines(); clearHighlights();
      if (_skipRequested()) break;

      // Cycle each win individually — FIX-UI1 v8.1.48: pass lineName to show which line won
      for (var si = 0; si < sortedWins.length; si++) {
        if (_skipRequested()) break;
        var win = sortedWins[si];
        drawPayline(win.lineIndex, win.line, win.isLetter);
        flashCells(win.line, win.count);
        updateWinDisplay(win.amount, win.lineName || '');
        for (var ii = 0; ii < 4; ii++) {
          if (_skipRequested()) break;
          await delay(110); // 440ms per win — responsive to skip tap
        }
        clearPaylines(); clearHighlights();
      }

      if (result.scatterWin && !_skipRequested()) {
        flashScatters();
        updateWinDisplay(result.scatterWin, 'SCATTER');
        for (var sf = 0; sf < 3; sf++) {
          if (_skipRequested()) break;
          await delay(130);
        }
        clearPaylines(); clearHighlights();
      }
    }

    clearPaylines(); clearHighlights();
    updateWinDisplay(result.totalWin, '');
  }

  function drawPayline(lineIndex, line, isLetter) {
    if (!paylineCtx || !line) return;
    resizeCanvas();
    if (!paylineCanvas || paylineCanvas.width === 0) return;

    // v7.0.2 FIX: use getBoundingClientRect on the actual sc-col-row cell elements
    // instead of arithmetic (frame.offsetWidth/5). The arithmetic ignored #reels
    // padding:4px and gap:3px between reels, causing lines to miss cell centers.
    // Canvas coordinate space matches clientWidth/clientHeight (after resizeCanvas fix),
    // so subtracting the canvas's own rect gives pixel-accurate canvas coordinates.
    var canvasRect = paylineCanvas.getBoundingClientRect();
    if (!canvasRect || canvasRect.width === 0) return;
    // Scale from CSS pixels to canvas element pixels (should be 1:1 after resizeCanvas fix)
    var scaleX = paylineCanvas.width  / canvasRect.width;
    var scaleY = paylineCanvas.height / canvasRect.height;

    paylineCtx.beginPath();
    var color = isLetter ? '#f5d878' : PAYLINE_COLORS[lineIndex % PAYLINE_COLORS.length];
    paylineCtx.strokeStyle = color;
    paylineCtx.lineWidth   = (isLetter ? 4 : 3) * Math.max(scaleX, scaleY);
    paylineCtx.shadowColor = color;
    paylineCtx.shadowBlur  = (isLetter ? 14 : 10) * Math.max(scaleX, scaleY);
    paylineCtx.lineCap = 'round'; paylineCtx.lineJoin = 'round';

    var firstPt = true;
    for (var col = 0; col < line.length; col++) {
      var row  = line[col];
      var cell = document.getElementById('sc-' + col + '-' + row);
      var x, y;
      if (cell) {
        var cr = cell.getBoundingClientRect();
        x = (cr.left + cr.width  * 0.5 - canvasRect.left) * scaleX;
        y = (cr.top  + cr.height * 0.5 - canvasRect.top)  * scaleY;
      } else {
        // Arithmetic fallback if cell element not found
        var cw = paylineCanvas.width  / 5;
        var ch = paylineCanvas.height / 3;
        x = col * cw + cw * 0.5;
        y = row * ch + ch * 0.5;
      }
      if (firstPt) { paylineCtx.moveTo(x, y); firstPt = false; }
      else          { paylineCtx.lineTo(x, y); }
    }
    paylineCtx.stroke();
    paylineCtx.shadowBlur = 0;
  }

  function flashCells(line, count) {
    for (var col = 0; col < count; col++) {
      var cell = $('sc-' + col + '-' + line[col]);
      if (cell) cell.classList.add('win-flash', 'highlight');
    }
  }

  function flashScatters() {
    var imgs = document.querySelectorAll('.symbol-cell img');
    for (var i = 0; i < imgs.length; i++) {
      if (imgs[i].src.indexOf('lipstick') >= 0) imgs[i].parentElement.classList.add('win-flash', 'highlight');
    }
  }

  var _paylineHighlightTimer = null;
  function showActivePaylines(linesCount) {
    if (_paylineHighlightTimer) { clearTimeout(_paylineHighlightTimer); _paylineHighlightTimer = null; }
    clearPaylines();
    if (!PAYLINES) return;
    var count = Math.min(linesCount, PAYLINES.length);
    for (var i = 0; i < count; i++) drawPayline(i, PAYLINES[i], false);
    _paylineHighlightTimer = setTimeout(function() { clearPaylines(); _paylineHighlightTimer = null; }, 2500);
  }

  function clearPaylines() {
    if (paylineCtx) paylineCtx.clearRect(0, 0, paylineCanvas ? paylineCanvas.width : 0, paylineCanvas ? paylineCanvas.height : 0);
  }

  function clearHighlights() {
    var cells = document.querySelectorAll('.symbol-cell');
    for (var i = 0; i < cells.length; i++) cells[i].classList.remove('win-flash', 'highlight');
  }

  function skipCreditAnimation() {
    _skipCreditAnim = true;
    isAnimatingCredits = false;
    var sb = $('spin-btn'); if (sb) sb.classList.remove('skip-mode');
  }

  async function animateCreditCountup(amount, isRedSpin) {
    if (isRedSpin === undefined) isRedSpin = false;
    if (!isRedSpin) {
      isAnimatingCredits = true;
      _skipCreditAnim = false;
      var sb = $('spin-btn'); if (sb) sb.classList.add('skip-mode');
    }
    var end      = GameState.balance;
    var start    = end - amount;
    var duration = Math.min(1600, Math.max(350, amount * 6));
    var startTime = Date.now();

    while (true) {
      if (!isRedSpin && _skipCreditAnim) { updateBalance(end); break; }
      var progress = Math.min((Date.now() - startTime) / duration, 1);
      var eased    = 1 - Math.pow(1 - progress, 3);
      updateBalance(start + (end - start) * eased);
      Audio.play('coin_drop');
      if (progress >= 1) break;
      await delay(40);
    }

    updateBalance(end);
    if (!isRedSpin) {
      isAnimatingCredits = false;
      _skipCreditAnim = false;
      var sb2 = $('spin-btn'); if (sb2) sb2.classList.remove('skip-mode');
    }
  }

  function updateBalance(val) {
    var el = $('balance-val');
    if (el) el.textContent = '$' + (parseFloat(val) || 0).toFixed(2);
    if ((parseFloat(val) || 0) > 0) _stopInsertCashTicker();
    else _startInsertCashTicker();
  }

  function updateWinDisplay(val, lineLabel) {
    if (lineLabel === undefined) lineLabel = null;
    var el = $('win-amount');
    if (!el) return;
    el.textContent = val > 0 ? '$' + val.toFixed(2) : '$0.00';
    var lblEl = $('win-line-label');
    if (lblEl) lblEl.textContent = lineLabel || '';
    if (val > 0) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
  }

  // updateBetDisplay removed v8.1.52 — zero callers, #bet-display DOM element removed (dead UI)

  function updateJackpotMeters() {
    var keys = ['MINI','MINOR','MAJOR','GRAND'];
    for (var ji = 0; ji < keys.length; ji++) {
      var key = keys[ji];
      var val = '$' + GameState.jackpots[key].current.toLocaleString('en', {minimumFractionDigits:2, maximumFractionDigits:2});
      var k   = key.toLowerCase();
      var el  = document.querySelector('#jp-' + k + ' .jp-amount');
      if (el) el.textContent = val;
      var holdEl = $('hold-jp-' + k);
      if (holdEl) holdEl.textContent = val;
      var pickEl = $('pick-jp-' + k);
      if (pickEl) pickEl.textContent = val;
    }
  }

  async function showRedSpinEntry() {
    var overlay = $('red-reel-overlay');
    var frame   = $('reel-frame');
    if (overlay) overlay.classList.add('active');
    if (frame)   frame.classList.add('red-active');
    var btb = $('bonus-total-box'); if (btb) btb.classList.add('visible');
    var bta = $('bonus-total-amount'); if (bta) bta.textContent = '$0.00';
    setControlsEnabled(false);
    if (overlay) {
      for (var i = 0; i < 3; i++) {
        overlay.style.background = 'rgba(220,0,0,0.72)';
        await delay(100);
        overlay.style.background = '';
        await delay(100);
      }
    }
  }

  async function updateRedSpinWin(winAmount, bonusTotal, spinNum, isReplay) {
    if (isReplay === undefined) isReplay = false;
    updateWinDisplay(winAmount);
    var bt = $('bonus-total-amount');
    if (bt) bt.textContent = '$' + bonusTotal.toFixed(2);
    var btb = $('bonus-total-box'); if (btb) btb.classList.add('visible');
    await delay(isReplay ? 200 : 550);
  }

  async function endRedSpinBonus(total) {
    updateWinDisplay(total);
    updateBalance(GameState.balance);
    showToast('RED SPIN TOTAL: $' + total.toFixed(2), 2000);
    await delay(600);
    deactivateRedScreen();
  }

  // PERMANENTLY REMOVED v8.0 — Hold & Spin bonus is fully removed.

    async function showPickChooseGrid(size, extraPicks) {
    if (extraPicks === undefined) extraPicks = 0;
    var screen = $('pick-screen');
    if (!screen) return;
    screen.classList.add('active');
    updateJackpotMeters();
    var grid = $('pick-grid');
    if (!grid) return;
    grid.innerHTML = '';
    var matchDiv = $('pick-matches');
    if (matchDiv) matchDiv.textContent = 'Match 3 symbols to win!';

    for (var i = 0; i < size; i++) {
      var tile = document.createElement('div');
      tile.className = 'pick-tile';
      tile.dataset.index = i;
      tile.style.pointerEvents = '';
      tile.style.cursor = '';
      tile.innerHTML = '<div class="tile-back">&#11088;</div><div class="tile-front"></div>';
      (function(t) {
        t.addEventListener('click', function() {
          if (_pickTapCallback && !t.classList.contains('revealed')) _pickTapCallback(parseInt(t.dataset.index));
        });
      })(tile);
      grid.appendChild(tile);
    }
    setControlsEnabled(false);
    await delay(300);
  }

  async function revealPickTile(index, prize, isReplay, showValue) {
    if (isReplay === undefined) isReplay = false;
    if (showValue === undefined) showValue = true;
    var tile = document.querySelector('.pick-tile[data-index="' + index + '"]');
    if (!tile) return;
    tile.classList.add('revealed');
    var front = tile.querySelector('.tile-front');
    if (front) {
      // v8.1.40 BUG-PC-2: use CSS classes instead of inline styles for design consistency
      var typeClass = 'pt-type-' + prize.type.replace('_', '-');
      var icons  = { cash:'💰', red_spin:'🔴', bonus_cash:'💵', mini:'⭐', minor:'💎', major:'💚', grand:'🏆' };
      var icon   = icons[prize.type] || '❓';
      var label;
      if (prize.type === 'cash') {
        label = showValue ? '$' + prize.value.toFixed(2) : '?';
      } else if (prize.type === 'red_spin')   { label = 'RED SPIN'; }
      else if (prize.type === 'bonus_cash')   { label = 'BONUS CASH'; }
      else if (prize.type === 'mini')         { label = 'MINI JP'; }
      else if (prize.type === 'minor')        { label = 'MINOR JP'; }
      else if (prize.type === 'major')        { label = 'MAJOR JP'; }
      else if (prize.type === 'grand')        { label = 'GRAND JP'; }
      else                                    { label = prize.type.toUpperCase(); }
      front.className = 'tile-front ' + typeClass;
      front.innerHTML = '<div class="pt-icon">' + icon + '</div><div class="pt-label">' + label + '</div>';
      front.dataset.prizeType = prize.type;
    }
    await delay(isReplay ? 180 : 260);
  }

  function _lockAllPickTiles() {
    var tiles = document.querySelectorAll('.pick-tile');
    for (var i = 0; i < tiles.length; i++) {
      tiles[i].style.pointerEvents = 'none';
      tiles[i].style.cursor = 'default';
    }
  }

  function updatePickMatches(matchCounts) {
    var el = $('pick-matches');
    if (!el) return;
    var icons = {cash:'$', red_spin:'RS', mini:'MINI', minor:'MINOR', major:'MAJOR', grand:'GRAND'};
    var parts = [];
    var keys  = Object.keys(matchCounts);
    for (var ki = 0; ki < keys.length; ki++) {
      var type  = keys[ki];
      var count = matchCounts[type];
      if (count > 0) parts.push((icons[type] || type.toUpperCase()) + ' x' + count);
    }
    el.textContent = parts.length > 0 ? parts.join('  |  ') : 'Match 3 symbols to win!';
  }

  async function showPickChooseWin(matchedIndex, prize, totalWon, awardRedSpin, matchCounts) {
    _lockAllPickTiles();
    var type      = prize.type;
    var matchFound = 0;
    var revealed  = document.querySelectorAll('.pick-tile.revealed');
    for (var i = 0; i < revealed.length; i++) {
      var front = revealed[i].querySelector('.tile-front');
      if (!front) continue;
      if (front.dataset.prizeType === type && matchFound < 3) {
        revealed[i].classList.add('match');
        if (type === 'cash' && totalWon > 0) {
          var valDiv = front.querySelectorAll('div')[1];
          if (valDiv) valDiv.textContent = '$' + Math.round(totalWon);
        }
        matchFound++;
      }
    }
    var winText = type === 'cash'      ? 'MATCH! WON $' + Math.round(totalWon) :
                  type === 'red_spin'  ? 'MATCH! RED SPIN BONUS!' :
                  type === 'bonus_cash' ? 'MATCH! BONUS CASH!' :
                  'MATCH! ' + type.toUpperCase() + ' JACKPOT!';
    showToast(winText, 3000);
    await delay(2000);
  }

  async function endPickChoose(prize, totalWon, awardRedSpin) {
    await delay(1500);
    var ps = $('pick-screen'); if (ps) ps.classList.remove('active');
    if (totalWon > 0) {
      updateWinDisplay(totalWon);
      await animateCreditCountup(totalWon, false);
    }
    setControlsEnabled(true);
  }

  // ── JACKPOT CELEBRATION — v6l97 redesign ────────────────────────────
  // Flash the relevant jackpot meter panel + ring bell simultaneously.
  // MAJOR/GRAND: also show Cash Out / Continue screen after the flash.
  // MINI/MINOR: meter flash + bell only, auto-dismiss after 3s.
  // ── JACKPOT CELEBRATION — v8.1.x ────────────────────────────────────
  // GRAND: Sisters | MAJOR: Josie+Sasha | MINI/MINOR: audio only
  async function showJackpotCelebration(type, amount, context) {
    var colors = { MINI:'#a8d8ea', MINOR:'#c9f0a0', MAJOR:'#f5d878', GRAND:'#ff6b35' };
    var isMajorPlus = (type === 'MAJOR' || type === 'GRAND');
    var color = colors[type] || '#f5c518';
    var meterId = 'jp-' + type.toLowerCase();
    var meter = $(meterId);
    if (meter) {
      var flashCount = 0;
      var flashInterval = setInterval(function() {
        flashCount++;
        meter.style.background = (flashCount % 2 === 1) ? 'rgba(255,0,0,0.65)' : '';
        meter.style.boxShadow  = (flashCount % 2 === 1) ? '0 0 22px rgba(255,0,0,0.9)' : '';
        if (flashCount >= 8) {
          clearInterval(flashInterval);
          meter.style.background = ''; meter.style.boxShadow = '';
        }
      }, 160);
    }
    if (typeof Audio !== 'undefined') { Audio.startJackpotBells(); Audio.play('jackpot_' + type.toLowerCase()); }
    if (!isMajorPlus) {
      await delay(3000);
      if (typeof Audio !== 'undefined') Audio.stopJackpotBells();
      return { action: 'dismiss' };
    }
    await delay(640);
    var overlay   = $('jackpot-overlay');
    var charLeft  = $('jackpot-char-left');
    var charRight = $('jackpot-char-right');
    var typeEl    = $('jackpot-type-text');
    var amtEl     = $('jackpot-amount-text');
    var actionsEl = $('jackpot-actions');
    var tapEl     = $('jackpot-tap-hint');
    if (overlay) {
      if (typeEl) { typeEl.textContent = type + ' JACKPOT!'; typeEl.style.color = color; }
      if (amtEl)  amtEl.textContent = '$' + amount.toFixed(2);
      if (charLeft)  { charLeft.src = ''; charLeft.style.display = 'none'; }
      if (charRight) { charRight.src = ''; charRight.style.display = 'none'; }
      if (type === 'GRAND') {
        if (charLeft) { charLeft.src = 'assets/sisters_celebrate.png'; charLeft.alt = 'The Turrelle Sisters'; charLeft.style.display = 'block'; charLeft.style.margin = '0 auto'; }
      } else if (type === 'MAJOR') {
        if (charLeft)  { charLeft.src  = 'assets/josie.png';  charLeft.alt  = 'Josie';  charLeft.style.display  = 'block'; charLeft.style.margin  = '0'; }
        if (charRight) { charRight.src = 'assets/sasha.png'; charRight.alt = 'Sasha'; charRight.style.display = 'block'; charRight.style.margin = '0'; }
      }
      if (actionsEl) actionsEl.style.display = 'flex';
      if (tapEl)     tapEl.style.display = 'none';
      overlay.classList.add('active');
    }
    return new Promise(function(resolve) {
      var cashBtn = $('jackpot-cashout-btn'); var contBtn = $('jackpot-continue-btn');
      function cleanup() {
        if (cashBtn) cashBtn.removeEventListener('click', onCash);
        if (contBtn) contBtn.removeEventListener('click', onCont);
        if (typeof Audio !== 'undefined') Audio.stopJackpotBells();
        if (overlay) overlay.classList.remove('active');
        if (charLeft)  { charLeft.style.display = 'none'; charLeft.src = ''; }
        if (charRight) { charRight.style.display = 'none'; charRight.src = ''; }
      }
      function onCash() { cleanup(); if (typeof CashOut !== 'undefined' && CashOut.doCashOutAmount) CashOut.doCashOutAmount(amount, type + '_JACKPOT'); resolve({ action: 'cashout' }); }
      function onCont() { cleanup(); resolve({ action: 'continue' }); }
      if (cashBtn) cashBtn.addEventListener('click', onCash, { once: true });
      if (contBtn) contBtn.addEventListener('click', onCont, { once: true });
    });
  }

  // ── MULTI-MINI CELEBRATION — v8.1.x ──────────────────────────────────
  async function showMultiMiniCelebration(miniCount) {
    var overlay = $('jackpot-overlay'), charLeft = $('jackpot-char-left'), charRight = $('jackpot-char-right');
    var typeEl = $('jackpot-type-text'), amtEl = $('jackpot-amount-text');
    var actionsEl = $('jackpot-actions'), tapEl = $('jackpot-tap-hint');
    if (!overlay) return;
    var charRow = $('jackpot-char-row');
    var charMid = document.createElement('img');
    charMid.id = 'jackpot-char-mid';
    charMid.style.cssText = 'height:100%;max-width:30%;object-fit:contain;flex:1;';
    if (charRow) charRow.insertBefore(charMid, charRight);
    if (charLeft)  { charLeft.src  = 'assets/sasha.png';   charLeft.alt  = 'Sasha';     charLeft.style.display  = 'block'; charLeft.style.margin  = '0'; }
    if (charMid)   { charMid.src   = 'assets/scott.png';   charMid.alt   = 'Scott';     charMid.style.display   = 'block'; }
    if (charRight) { charRight.src = 'assets/maxine.png'; charRight.alt = 'DJ Maxine'; charRight.style.display = 'block'; charRight.style.margin = '0'; }
    if (typeEl) { typeEl.textContent = String.fromCodePoint(0x1F389) + ' ' + miniCount + '× MINI JACKPOT!'; typeEl.style.color = '#a8d8ea'; }
    if (amtEl)  amtEl.textContent = 'MULTIPLE WINS!';
    if (actionsEl) actionsEl.style.display = 'none';
    if (tapEl)     tapEl.style.display = 'block';
    overlay.classList.add('active');
    if (typeof Audio !== 'undefined') { Audio.startJackpotBells(); Audio.play('jackpot_mini'); }
    await delay(4000);
    if (typeof Audio !== 'undefined') Audio.stopJackpotBells();
    overlay.classList.remove('active');
    if (charLeft)  { charLeft.style.display = 'none'; charLeft.src = ''; charLeft.style.margin = ''; }
    if (charRight) { charRight.style.display = 'none'; charRight.src = ''; charRight.style.margin = ''; }
    if (charMid && charMid.parentNode) charMid.parentNode.removeChild(charMid);
  }

    var _orbTapCallback = null;
  function setOrbTapCallback(cb) { _orbTapCallback = cb; }

  var _pickTapCallback = null;
  function setPickTapCallback(cb) { _pickTapCallback = cb; }

  async function showBonusLetterCelebration() {
    var cel = $('bonus-letter-celebrate');
    if (!cel) return;
    var spans = cel.querySelectorAll('.bonus-cel-letter');
    cel.style.display = 'flex';
    for (var li = 0; li < spans.length; li++) {
      spans[li].classList.add('letter-pop');
      Audio.play('reel_stop');
      await delay(220);
    }
    await delay(600);
    cel.classList.add('bonus-cel-pulse');
    await delay(900);
    cel.style.display = 'none';
    cel.classList.remove('bonus-cel-pulse');
    for (var lj = 0; lj < spans.length; lj++) spans[lj].classList.remove('letter-pop');
  }

  async function showBonusOrbScreen(prizes, winPosition) {
    var screen    = $('bonus-orb-screen');
    if (!screen) return;
    var container = $('bonus-orb-container');
    if (!container) return;
    container.innerHTML = '';
    var orbLabels = { red_spin:'RED SPIN', pick_choose:'PICK & CHOOSE', bonus_cash:'BONUS CASH' };

    for (var i = 0; i < prizes.length; i++) {
      var orb = document.createElement('div');
      orb.className = 'bonus-orb';
      orb.id = 'orb-' + i;
      orb.innerHTML = '<div class="orb-glow"></div><div class="orb-inner"><div class="orb-icon">&#10024;</div><div class="orb-label">PICK ME</div></div>';
      (function(idx) {
        orb.addEventListener('click', function() {
          if (_orbTapCallback) { var cb = _orbTapCallback; _orbTapCallback = null; cb(idx); }
        });
      })(i);
      container.appendChild(orb);
      (function(el, ms) { setTimeout(function() { el.classList.add('orb-in'); }, ms); })(orb, i * 400);
    }

    screen.style.display = 'flex';
    setControlsEnabled(false);
    await delay(1600);
  }

  async function revealBonusOrbs(prizes, winPosition, chosenIdx, cashAmount) {
    // BUG-ORB1 FIX v8.1.51: cashAmount now passed in so winner orb can show dollar amount
    var labels = { red_spin:'RED SPIN', pick_choose:'PICK & CHOOSE', bonus_cash:'BONUS CASH' };
    var icons  = { red_spin:'RS', pick_choose:'PC', bonus_cash:'$' };
    for (var i = 0; i < prizes.length; i++) {
      var orb   = $('orb-' + i);
      if (!orb) continue;
      var icon  = orb.querySelector('.orb-icon');
      var label = orb.querySelector('.orb-label');
      if (icon) icon.textContent = icons[prizes[i]] || '?';
      if (i === winPosition) {
        if (prizes[i] === 'bonus_cash' && cashAmount > 0) {
          if (icon)  icon.textContent  = '$';
          if (label) label.textContent = '$' + cashAmount.toFixed(2);
        } else {
          if (label) label.textContent = labels[prizes[i]] || prizes[i];
        }
        orb.classList.add('orb-winner');
      } else {
        if (label) label.textContent = labels[prizes[i]] || prizes[i];
        orb.classList.add('orb-loser');
      }
    }
    await delay(800);
  }

  async function endBonusOrbScreen(winPrize, cashAmount) {
    // BUG-ORB1 FIX v8.1.51: show cash amount in toast and credit countup animation
    var toastMsg;
    if (winPrize === 'bonus_cash' && cashAmount > 0) {
      toastMsg = 'BONUS CASH! $' + cashAmount.toFixed(2);
    } else {
      var labels = { red_spin:'RED SPIN!', pick_choose:'PICK & CHOOSE!', bonus_cash:'BONUS CASH!' };
      toastMsg = labels[winPrize] || winPrize;
    }
    showToast(toastMsg, 3000);
    Audio.play('win_big');
    if (winPrize === 'bonus_cash' && cashAmount > 0) {
      // Animate the credit countup so player sees the cash visually credited
      updateWinDisplay(cashAmount, 'BONUS CASH');
      await animateCreditCountup(cashAmount, false);
    }
    await delay(1500);
    var screen = $('bonus-orb-screen');
    if (screen) screen.style.display = 'none';
    setControlsEnabled(true);
  }

  function showBonusLetterWin(count, amount, row) {
    if (row >= 0 && row <= 2) {
      var flashList = [];
      for (var col = 0; col < count; col++) {
        var cell = document.getElementById('sc-' + col + '-' + row);
        if (cell) {
          var img = cell.querySelector('img');
          var isLetter = img && (
            img.src.indexOf('letter_b') >= 0 || img.src.indexOf('letter_o') >= 0 ||
            img.src.indexOf('letter_n') >= 0 || img.src.indexOf('letter_u') >= 0 ||
            img.src.indexOf('letter_s') >= 0
          );
          if (isLetter) {
            cell.classList.add('win-flash', 'letter-win-flash');
            cell.style.outline = '3px solid #f5d878';
            cell.style.outlineOffset = '-2px';
            flashList.push(cell);
          }
        }
      }
      setTimeout(function() {
        for (var fi = 0; fi < flashList.length; fi++) {
          flashList[fi].classList.remove('win-flash', 'letter-win-flash');
          flashList[fi].style.outline = '';
          flashList[fi].style.outlineOffset = '';
        }
      }, 1500);
    }
  }

  // showAdditionalRedSpinsWon removed v6l106 — 0 callers, pendingRedSpins chain removed v6l97.


  function setControlsEnabled(enabled) {
    var ids = ['spin-btn','bet-max-btn','bet-one-btn']; // v8.1.9: removed ghost IDs bet-up/bet-down/auto-btn (NEW-BUG-A fix — none exist in DOM)
    for (var i = 0; i < ids.length; i++) {
      var el = $(ids[i]); if (el) el.disabled = !enabled;
    }
    var btns = document.querySelectorAll('.line-btn,.bet-btn');
    for (var j = 0; j < btns.length; j++) {
      btns[j].style.pointerEvents = enabled ? '' : 'none';
      btns[j].style.opacity       = enabled ? '' : '0.45';
    }
  }

  function showToast(msg, dur) {
    if (dur === undefined) dur = 2500;
    var t = $('toast'); if (!t) return;
    t.textContent = msg; t.classList.add('show');
    setTimeout(function() { t.classList.remove('show'); }, dur);
  }

  function showMessage(msg) { showToast(msg); }

  function onSpinStart() {
    clearPaylines(); clearHighlights(); updateWinDisplay(0);
    updateBalance(GameState.balance);
    for (var i = 0; i < reelEls.length; i++) { if (reelEls[i]) reelEls[i].classList.remove('spinning'); }
  }

  function onSpinComplete() {
    for (var i = 0; i < reelEls.length; i++) { if (reelEls[i]) reelEls[i].classList.remove('spinning'); }
    updateBalance(GameState.balance);
    updateJackpotMeters();
  }

  var _insertCashTickerInterval = null;

  function _startInsertCashTicker() {
    if (_insertCashTickerInterval) return;
    var el = $('reels-insert-msg');
    if (!el) return;
    function showMsg() {
      if (GameState.balance > 0) { _stopInsertCashTicker(); return; }
      el.classList.add('visible');
      setTimeout(function() { el.classList.remove('visible'); }, 2000);
    }
    showMsg();
    _insertCashTickerInterval = setInterval(showMsg, 5000);
  }

  function _stopInsertCashTicker() {
    if (_insertCashTickerInterval) { clearInterval(_insertCashTickerInterval); _insertCashTickerInterval = null; }
    var el = $('reels-insert-msg');
    if (el) el.classList.remove('visible');
  }

  function flashReelRed() { activateRedScreen(); }

  function activateRedScreen() {
    var frame   = $('reel-frame');
    var overlay = $('red-reel-overlay');
    if (frame)   frame.classList.add('red-active');
    if (overlay) overlay.classList.add('active');
    var btb = $('bonus-total-box'); if (btb) btb.classList.add('visible');
  }

  function deactivateRedScreen() {
    var rro = $('red-reel-overlay'); if (rro) rro.classList.remove('active');
    var rf  = $('reel-frame');       if (rf)  rf.classList.remove('red-active');
    var btb = $('bonus-total-box');  if (btb) btb.classList.remove('visible');
  }

  function endRedSpinImmediate() { deactivateRedScreen(); setControlsEnabled(true); }

  function delay(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }


  // ── HELP / PAYTABLE MENU — v8.1.3 ───────────────────────────────────
  var _helpCurrentPage = 1;
  var HELP_TOTAL_PAGES = 4;

  function buildHelpMenu() {
    // v8.1.54: Compact no-scroll redesign. VGT-style pay table. Fits Galaxy S23 without scrolling.
    var info = document.getElementById('help-denom-info');
    if (info) {
      var _d = (typeof GameState !== 'undefined' && GameState.lastDenom) ? GameState.lastDenom : 0.01;
      var _c = (typeof GameState !== 'undefined' && GameState.lastCreditsPerLine) ? GameState.lastCreditsPerLine : 5;
      info.textContent = '$' + (Math.round(_d * _c * 100) / 100).toFixed(2) + '/line';
    }

    function si(src, alt) { return '<img class="ht-sym" src="' + src + '" alt="' + alt + '">'; }

    // PAGE 1: HOW TO PLAY
    var p1 = '<div class="ht-page">';
    p1 += '<div class="ht-title">HOW TO PLAY</div>';
    p1 += '<div class="ht-sec">THE BASICS</div>';
    p1 += '<div class="ht-row2">Choose your coin denom with the <b>50c v</b> button</div>';
    p1 += '<div class="ht-row2">Press <b>SPIN</b> to play all 20 paylines at once</div>';
    p1 += '<div class="ht-row2">Wins pay left to right starting from reel 1</div>';
    p1 += '<div class="ht-row2">More matching symbols = bigger win!</div>';
    p1 += '<div class="ht-sec">WILDS AND MULTIPLIERS</div>';
    p1 += '<div class="ht-row2"><b>Josie</b> = Wild x3 multiplier on any line she helps win</div>';
    p1 += '<div class="ht-row2"><b>Sasha</b> = Wild x2 multiplier on any line she helps win</div>';
    p1 += '<div class="ht-row2">Combined wilds capped at x3 total multiplier</div>';
    p1 += '<div class="ht-sec">JACKPOTS</div>';
    p1 += '<div class="ht-row2">4 progressives grow with every spin: <b>MINI MINOR MAJOR GRAND</b></div>';
    p1 += '<div class="ht-row2">Each jackpot is <b>guaranteed to hit</b> before its cap</div>';
    p1 += '<div class="ht-row2">Won through bonus features — keep spinning!</div>';
    p1 += '<div class="ht-sec">CASH OUT AND WALLET</div>';
    p1 += '<div class="ht-row2">Tap <b>CASH OUT</b> to convert balance to a digital voucher</div>';
    p1 += '<div class="ht-row2">Tap <b>INSERT CASH</b> to open wallet and redeem vouchers</div>';
    p1 += '<div class="ht-row2">Store your voucher ID safely to collect your winnings</div>';
    p1 += '</div>';

    // PAGE 2: PAY TABLE — VGT-style dense grid
    // v8.1.55 FIX: Josie/Sasha are multiplier wilds — wild-only lines pay ZERO credits.
    // Their rows now correctly show jackpot tiers, not credit amounts.
    var p2 = '<div class="ht-page ht-pt">';

    // Jackpot symbols — separate section, no pay columns (jackpots not credits)
    p2 += '<div class="ht-pt-sec">JACKPOT SYMBOLS</div>';
    p2 += '<div class="ht-jp-note">5 of a kind on the center line (or any line for MAJOR)</div>';

    var jpRows = [
      { img: si('assets/sisters.png','Sisters'), label:'Sisters',      jp:'GRAND',  note:'any line' },
      { img: si('assets/josie.png',  'Josie'),   label:'5x Josie',    jp:'MINOR',  note:'center line' },
      { img: si('assets/sasha.png',  'Sasha'),   label:'5x Sasha',    jp:'MINI',   note:'center line' },
      { img: si('assets/josie.png',  'Josie') + si('assets/sasha.png','Sasha'), label:'Josie + Sasha mix', jp:'MAJOR', note:'any line' },
    ];
    for (var ji = 0; ji < jpRows.length; ji++) {
      var jr = jpRows[ji];
      p2 += '<div class="ht-jp-row">';
      p2 += '<div class="ht-jp-imgs">' + jr.img + '</div>';
      p2 += '<div class="ht-jp-tier ' + jr.jp.toLowerCase() + '-tier">' + jr.jp + '</div>';
      p2 += '<div class="ht-jp-note2">' + jr.note + '</div>';
      p2 += '</div>';
    }
    p2 += '<div class="ht-jp-wild-note">Josie x3 and Sasha x2 multiply wins — wild-only lines pay $0</div>';

    // Standard symbols — with 3/4/5 column headers
    p2 += '<div class="ht-pt-hdr">';
    p2 += '<div class="ht-pt-sym-col"></div>';
    p2 += '<div class="ht-pt-pays-hdr"><span>3</span><span>4</span><span>5</span></div>';
    p2 += '</div>';
    p2 += '<div class="ht-pt-sec">STANDARD SYMBOLS</div>';
    var stdRows = [
      ['assets/scott.png',               'StrayPup', ['40','80','150']],  // v8.1.58 recalibrated
      ['assets/maxine.png',              'DJ Maxine',['20','40','60']],
      ['assets/symbols/seven.svg',       'Seven',    ['10','15','25']],
      ['assets/symbols/diamond.svg',     'Diamond',  ['6','12','20']],
      ['assets/symbols/dollar_bills.svg','Bills',    ['5','8','15']]
    ];
    for (var si2 = 0; si2 < stdRows.length; si2++) {
      var sr = stdRows[si2];
      p2 += '<div class="ht-pt-row"><div class="ht-pt-sym-col">' + si(sr[0],sr[1]) + '</div>';
      p2 += '<div class="ht-pt-pays"><span>' + sr[2][0] + '</span><span>' + sr[2][1] + '</span><span>' + sr[2][2] + '</span></div></div>';
    }
    p2 += '<div class="ht-pt-sec">BAR SYMBOLS</div>';
    var barRows = [
      [si('assets/symbols/triple_bar.svg','3-Bar'), ['4','6','10']],   // v8.1.58 recalibrated
      [si('assets/symbols/double_bar.svg','2-Bar'), ['3','5','8']],
      [si('assets/symbols/single_bar.svg','1-Bar'), ['2','3','6']],
      [si('assets/symbols/triple_bar.svg','Bar')+si('assets/symbols/double_bar.svg','Bar')+si('assets/symbols/single_bar.svg','Bar'), ['3','5','8']]
    ];
    for (var bi = 0; bi < barRows.length; bi++) {
      var brr = barRows[bi];
      p2 += '<div class="ht-pt-row"><div class="ht-pt-sym-col">' + brr[0] + '</div>';
      p2 += '<div class="ht-pt-pays"><span>' + brr[1][0] + '</span><span>' + brr[1][1] + '</span><span>' + brr[1][2] + '</span></div></div>';
    }
    p2 += '<div class="ht-pt-note">Credits x bet/line = cash win. Wild multiplier applies on winning lines.</div>';
    p2 += '</div>';

    // PAGE 3: BONUS FEATURES
    var p3 = '<div class="ht-page">';
    p3 += '<div class="ht-title">BONUS FEATURES</div>';
    p3 += '<div class="ht-bonus-row"><div class="ht-bicon">&#128308;</div>';
    p3 += '<div class="ht-binfo"><div class="ht-bname">RED SPIN</div>';
    p3 += '<div class="ht-bdesc">Reels go RED and every spin pays more than the last! Keep climbing toward the Sisters Jackpot!</div></div></div>';
    p3 += '<div class="ht-bonus-row"><div class="ht-bicon">' + si('assets/symbols/lipstick.svg','Lipstick') + '</div>';
    p3 += '<div class="ht-binfo"><div class="ht-bname">PICK AND CHOOSE</div>';
    p3 += '<div class="ht-bdesc">5 Lipstick on the center line! Tap tiles to match 3 and win cash, jackpots, or more bonus action.</div></div></div>';
    p3 += '<div class="ht-bonus-row"><div class="ht-bicon ht-blet">';
    p3 += si('assets/symbols/letter_b.svg','B') + si('assets/symbols/letter_o.svg','O') + si('assets/symbols/letter_n.svg','N');
    p3 += '</div><div class="ht-binfo"><div class="ht-bname">BONUS ORB GAME</div>';
    p3 += '<div class="ht-bdesc">Collect B-O-N-U-S on the bottom row! Three glowing orbs appear - pick one to reveal your mystery prize!</div></div></div>';
    p3 += '<div class="ht-sec">BONUS LETTER PAYS (credits x bet/line)</div>';
    p3 += '<div class="ht-letrow">';
    p3 += '<div class="ht-letcell">' + si('assets/symbols/letter_b.svg','B') + '<div class="ht-letval">2</div></div>';
    p3 += '<div class="ht-letcell">' + si('assets/symbols/letter_b.svg','B') + si('assets/symbols/letter_o.svg','O') + '<div class="ht-letval">4</div></div>';
    p3 += '<div class="ht-letcell">' + si('assets/symbols/letter_b.svg','B') + si('assets/symbols/letter_o.svg','O') + si('assets/symbols/letter_n.svg','N') + '<div class="ht-letval">8</div></div>';
    p3 += '<div class="ht-letcell">' + si('assets/symbols/letter_b.svg','B') + si('assets/symbols/letter_o.svg','O') + si('assets/symbols/letter_n.svg','N') + si('assets/symbols/letter_u.svg','U') + '<div class="ht-letval">20</div></div>';
    p3 += '</div></div>';

    // PAGE 4: SOUND CONTROLS
    var p4 = '<div class="ht-page">';
    p4 += '<div class="ht-title">SOUND CONTROLS</div>';
    p4 += '<div class="ht-sound-blk"><div class="ht-sec">&#128266; MASTER VOLUME</div>';
    p4 += '<div class="ht-vol-row"><span class="ht-vol-lbl">&#128264;</span>';
    p4 += '<input type="range" id="help-vol-slider" class="ht-slider" min="0" max="100" value="50">';
    p4 += '<span class="ht-vol-lbl">&#128266;</span></div></div>';
    p4 += '<div class="ht-sound-blk"><div class="ht-sec">&#127925; THEME MUSIC</div>';
    p4 += '<div class="ht-sound-desc">Mute background music only - win sounds still play normally</div>';
    p4 += '<button id="help-music-btn" class="ht-mute-btn">&#127925; MUSIC ON</button></div>';
    p4 += '<div class="ht-sound-blk"><div class="ht-sec">&#128263; ALL SOUNDS</div>';
    p4 += '<div class="ht-sound-desc">Mute everything - music, win sounds, bells and bonus audio</div>';
    p4 += '<button id="help-sfx-btn" class="ht-mute-btn">&#128266; SOUND ON</button></div>';
    p4 += '</div>';

    // Render
    var pgs = [p1, p2, p3, p4];
    for (var n = 1; n <= 4; n++) {
      var pg = document.getElementById('help-page-' + n);
      if (pg) pg.innerHTML = pgs[n - 1];
    }
    var totEl = document.getElementById('help-page-total');
    if (totEl) totEl.textContent = '4';
    _helpSetPage(1);

    // Wire sound controls
    var slider = document.getElementById('help-vol-slider');
    if (slider && typeof Audio !== 'undefined') {
      slider.addEventListener('input', function() { Audio.setVolume(parseInt(this.value,10)/100); });
    }
    var musicBtn = document.getElementById('help-music-btn');
    if (musicBtn && typeof Audio !== 'undefined') {
      var _updM = function() {
        var m = Audio.getMusicMuted();
        musicBtn.textContent = m ? String.fromCharCode(128263)+' MUSIC OFF' : String.fromCharCode(127925)+' MUSIC ON';
        if (m) musicBtn.classList.add('ht-mute-on'); else musicBtn.classList.remove('ht-mute-on');
      };
      _updM();
      musicBtn.addEventListener('click', function() { Audio.toggleMusicMute(); _updM(); });
    }
    var sfxBtn = document.getElementById('help-sfx-btn');
    if (sfxBtn && typeof Audio !== 'undefined') {
      var _updS = function() {
        var m = Audio.getMuted();
        sfxBtn.textContent = m ? String.fromCharCode(128263)+' ALL MUTED' : String.fromCharCode(128266)+' SOUND ON';
        if (m) sfxBtn.classList.add('ht-mute-on'); else sfxBtn.classList.remove('ht-mute-on');
      };
      _updS();
      sfxBtn.addEventListener('click', function() { Audio.toggleMute(); _updS(); });
    }
  }

  function _helpSetPage(n) {
    _helpCurrentPage = n;
    var pages = document.querySelectorAll('.pt-page');
    for (var i = 0; i < pages.length; i++) pages[i].classList.remove('active');
    var pg = document.getElementById('help-page-' + n);
    if (pg) { pg.classList.add('active'); pg.scrollTop = 0; }
    var cur = document.getElementById('help-page-cur');
    if (cur) cur.textContent = n;
    var tot = document.getElementById('help-page-total');
    if (tot) tot.textContent = HELP_TOTAL_PAGES;
    var prev = document.getElementById('help-prev');
    var next = document.getElementById('help-next');
    if (prev) prev.disabled = (n <= 1);
    if (next) next.disabled = (n >= HELP_TOTAL_PAGES);
  }

  // Wire help buttons (called from init)
  function _wireHelpButtons() {
    var _helpBtn = document.getElementById('help-btn');
    if (_helpBtn) _helpBtn.addEventListener('click', function() {
      buildHelpMenu();
      var hs = document.getElementById('help-screen');
      if (hs) hs.classList.add('active');
      if (typeof Audio !== 'undefined') Audio.play('button_click');
    });
    var _helpClose = document.getElementById('help-close');
    if (_helpClose) _helpClose.addEventListener('click', function() {
      var hs = document.getElementById('help-screen');
      if (hs) hs.classList.remove('active');
      if (typeof Audio !== 'undefined') Audio.play('button_click');
    });
    var _helpPrev = document.getElementById('help-prev');
    if (_helpPrev) _helpPrev.addEventListener('click', function() {
      if (_helpCurrentPage > 1) { _helpSetPage(_helpCurrentPage - 1); }
    });
    var _helpNext = document.getElementById('help-next');
    if (_helpNext) _helpNext.addEventListener('click', function() {
      if (_helpCurrentPage < HELP_TOTAL_PAGES) { _helpSetPage(_helpCurrentPage + 1); }
    });
    // Close on background tap
    var hs2 = document.getElementById('help-screen');
    if (hs2) hs2.addEventListener('click', function(e) {
      if (e.target === hs2) hs2.classList.remove('active');
    });
  }


  // ── RED SPIN TIER BANNER — v8.1.3 ──────────────────────────────────
  // Called by bonuses.js when player advances to a new RS tier
  function showRedSpinTier(tierName, spinNum) {
    var banner = document.getElementById('rs-tier-banner');
    if (!banner) {
      // Create banner dynamically if not in DOM
      banner = document.createElement('div');
      banner.id = 'rs-tier-banner';
      banner.style.cssText = 'position:fixed;top:40%;left:50%;-webkit-transform:translateX(-50%);transform:translateX(-50%);background:rgba(180,0,0,0.92);color:#fff7a0;font-family:var(--font-display,sans-serif);font-size:22px;font-weight:900;letter-spacing:3px;padding:14px 28px;border-radius:12px;border:2px solid #d4af37;z-index:600;pointer-events:none;text-align:center;-webkit-animation:rsBannerPulse 0.6s ease;animation:rsBannerPulse 0.6s ease;';
      document.body.appendChild(banner);
    }
    banner.textContent = tierName.toUpperCase() + ' TIER';
    banner.style.display = 'block';
    banner.style.opacity = '1';
    setTimeout(function() {
      banner.style.opacity = '0';
      setTimeout(function() { banner.style.display = 'none'; }, 400);
    }, 1800);
  }
  // v8.1.3: Restored as functional stubs to prevent runtime errors
  function startInsertCashTicker() {
    // Cash insert ticker — shows credits adding up
    // Full implementation lives in cashout.js; this stub satisfies calls from game.js
    var d = document.getElementById('balance-val');
    if (d) d.classList.add('balance-update');
  }

  function stopInsertCashTicker() {
    var d = document.getElementById('balance-val');
    if (d) d.classList.remove('balance-update');
  }

  async function showRedSpinEndCelebration(totalWon, spinCount) {
    // Red Spin end summary celebration
    var overlay = document.getElementById('rs-bonus-win-overlay');
    if (!overlay) return;
    var label = document.getElementById('rs-bonus-win-label');
    var amt   = document.getElementById('rs-bonus-win-amt');
    var spins = document.getElementById('rs-bonus-win-spins');
    var tap   = document.getElementById('rs-bonus-win-tap');
    if (label) label.textContent = 'RED SPIN COMPLETE!';
    if (amt)   amt.textContent   = '$' + (totalWon || 0).toFixed(2);
    if (spins) spins.textContent = (spinCount || 0) + ' SPINS';
    if (tap)   tap.textContent   = 'TAP TO CONTINUE';
    overlay.classList.add('active');
    return new Promise(function(resolve) {
      function onTap() {
        overlay.classList.remove('active');
        overlay.removeEventListener('click', onTap);
        resolve();
      }
      overlay.addEventListener('click', onTap, { once: true });
      setTimeout(function() { overlay.classList.remove('active'); resolve(); }, 5000);
    });
  }

  return {
    init: init, renderGrid: renderGrid, buildHelpMenu: buildHelpMenu,

    animateReelsStop: animateReelsStop, showBaseWins: showBaseWins,
    updateBalance: updateBalance, updateWinDisplay: updateWinDisplay, updateJackpotMeters: updateJackpotMeters,
    startInsertCashTicker: _startInsertCashTicker, stopInsertCashTicker: _stopInsertCashTicker,
    animateCreditCountup: animateCreditCountup,
    get isAnimatingCredits() { return isAnimatingCredits; },
    skipCreditAnimation: skipCreditAnimation,
    showRedSpinEntry: showRedSpinEntry, showRedSpinTier: showRedSpinTier, updateRedSpinWin: updateRedSpinWin, showRedSpinPaylineFlash: showRedSpinPaylineFlash,
    endRedSpin: endRedSpinBonus, endRedSpinBonus: endRedSpinBonus,
    showPickChooseGrid: showPickChooseGrid, revealPickTile: revealPickTile, _lockAllPickTiles: _lockAllPickTiles,
    setPickTapCallback: setPickTapCallback, endPickChoose: endPickChoose, updatePickMatches: updatePickMatches, showPickChooseWin: showPickChooseWin,
    showJackpotCelebration: showJackpotCelebration, showMultiMiniCelebration: showMultiMiniCelebration, setControlsEnabled: setControlsEnabled,
    showBonusOrbScreen: showBonusOrbScreen, revealBonusOrbs: revealBonusOrbs, endBonusOrbScreen: endBonusOrbScreen, setOrbTapCallback: setOrbTapCallback,
    showBonusLetterWin: showBonusLetterWin,
    flashReelRed: flashReelRed, activateRedScreen: activateRedScreen, deactivateRedScreen: deactivateRedScreen, endRedSpinImmediate: endRedSpinImmediate,
    showRedSpinEndCelebration: showRedSpinEndCelebration,
    showToast: showToast, showMessage: showMessage, onSpinStart: onSpinStart, onSpinComplete: onSpinComplete,
    clearPaylines: clearPaylines, showActivePaylines: showActivePaylines,
  };
})();
