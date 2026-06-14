/*
 * ============================================================
 *  StrayPups Big Munny — OPERATOR MENU  v3.0
 *
 *  Access: Tap the banner 5 times within 3 seconds → PIN pad → menu
 *  Default PIN: 7777
 *
 *  Sections: HISTORY | RTP | SETTINGS
 *
 *  Storage keys (localStorage):
 *    spbm_history      — array of game/transaction records (max 500)
 *    spbm_op_pin       — hashed PIN (never stored plain)
 *    spbm_card_ctr     — card serial counter (set by game.js)
 *    spbm_used_cards   — card fingerprint dedup set (set by game.js)
 * ============================================================
 */

/* ── CONSTANTS ─────────────────────────────────────────────────────────── */
var OP_TAP_REQUIRED = 5;
var OP_TAP_WINDOW   = 3000; // ms
var OP_MAX_HISTORY  = 500;
var OP_DEFAULT_PIN  = '7777';

/* ── STATE ─────────────────────────────────────────────────────────────── */
var opTapCount  = 0;
var opTapTimer  = null;
var opPinBuffer = '';
var opActiveTab = 'history';

/* ── SIMPLE PIN HASH (not cryptographic — just not plaintext in storage) ── */
function opHashPin(pin) {
  var h = 0;
  for (var i = 0; i < pin.length; i++) {
    h = (h * 31 + pin.charCodeAt(i)) & 0xffffffff;
  }
  return 'ph_' + (h >>> 0).toString(16);
}

function opCheckPin(pin) {
  var stored = localStorage.getItem('spbm_op_pin') || opHashPin(OP_DEFAULT_PIN);
  return opHashPin(pin) === stored;
}

function opSavePin(pin) {
  localStorage.setItem('spbm_op_pin', opHashPin(pin));
}

/* ── LOGGING ───────────────────────────────────────────────────────────── */
function opTimestamp() {
  var d = new Date();
  var pad = function(n) { return n < 10 ? '0' + n : String(n); };
  return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()) +
    ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
}

function opLoadHistory() {
  try {
    var raw = localStorage.getItem('spbm_history');
    return raw ? JSON.parse(raw) : [];
  } catch(e) { return []; }
}

function opSaveHistory(arr) {
  try { localStorage.setItem('spbm_history', JSON.stringify(arr)); } catch(e) {}
}

/* Called by game.js via opLog() stub */
function opLogImpl(rec) {
  rec.dateTime = opTimestamp();
  var arr = opLoadHistory();
  arr.push(rec);
  if (arr.length > OP_MAX_HISTORY) arr = arr.slice(arr.length - OP_MAX_HISTORY);
  opSaveHistory(arr);
}

/* ── BANNER TAP TRIGGER ────────────────────────────────────────────────── */
function opInitTrigger() {
  var banner = document.getElementById('hdr-img');
  if (!banner) return;

  function handleTap(e) {
    e.stopPropagation();
    opTapCount++;
    if (opTapTimer) clearTimeout(opTapTimer);
    opTapTimer = setTimeout(function() { opTapCount = 0; }, OP_TAP_WINDOW);
    if (opTapCount >= OP_TAP_REQUIRED) {
      opTapCount = 0;
      clearTimeout(opTapTimer);
      opShowPin();
    }
  }

  banner.addEventListener('click', handleTap);
  banner.addEventListener('touchend', function(e) {
    e.preventDefault();
    handleTap(e);
  });
}

/* ── PIN PAD ───────────────────────────────────────────────────────────── */
function opShowPin() {
  opPinBuffer = '';
  var ov = document.getElementById('op-pin-ov');
  if (ov) { opUpdatePinDots(); ov.style.display = 'flex'; return; }

  ov = document.createElement('div');
  ov.id = 'op-pin-ov';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.95);z-index:500;'
    + 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;';

  var title = document.createElement('div');
  title.textContent = 'OPERATOR ACCESS';
  title.style.cssText = 'font-family:"Bebas Neue",Impact,sans-serif;font-size:22px;'
    + 'letter-spacing:4px;color:#d4af37;';

  var dots = document.createElement('div');
  dots.id = 'op-pin-dots';
  dots.style.cssText = 'display:flex;gap:12px;';

  var err = document.createElement('div');
  err.id = 'op-pin-err';
  err.style.cssText = 'font-size:11px;letter-spacing:2px;color:#ff4444;min-height:16px;';

  var pad = document.createElement('div');
  pad.style.cssText = 'display:grid;grid-template-columns:repeat(3,64px);gap:8px;';

  var keys = ['1','2','3','4','5','6','7','8','9','←','0','✓'];
  keys.forEach(function(k) {
    var btn = document.createElement('button');
    btn.textContent = k;
    btn.style.cssText = 'height:56px;font-family:"Bebas Neue",Impact,sans-serif;'
      + 'font-size:22px;border-radius:8px;cursor:pointer;-webkit-appearance:none;'
      + 'background:linear-gradient(135deg,#1a0035,#280050);border:2px solid #8b6914;'
      + 'color:#f5d878;letter-spacing:1px;';
    if (k === '✓') btn.style.background = 'linear-gradient(135deg,#6a0000,#aa0000)';
    if (k === '←') btn.style.background = 'linear-gradient(135deg,#0d0018,#1a002a)';
    btn.addEventListener('click', function() { opPinKey(k); });
    btn.addEventListener('touchend', function(e) { e.preventDefault(); opPinKey(k); });
    pad.appendChild(btn);
  });

  var cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'CANCEL';
  cancelBtn.style.cssText = 'padding:8px 28px;font-family:"Bebas Neue",Impact,sans-serif;'
    + 'font-size:14px;letter-spacing:2px;color:rgba(255,255,255,.4);background:transparent;'
    + 'border:1px solid rgba(255,255,255,.15);border-radius:6px;cursor:pointer;-webkit-appearance:none;';
  cancelBtn.addEventListener('click', function() { ov.style.display = 'none'; });
  cancelBtn.addEventListener('touchend', function(e) { e.preventDefault(); ov.style.display = 'none'; });

  ov.appendChild(title);
  ov.appendChild(dots);
  ov.appendChild(err);
  ov.appendChild(pad);
  ov.appendChild(cancelBtn);
  document.body.appendChild(ov);
  opUpdatePinDots();
}

function opUpdatePinDots() {
  var dots = document.getElementById('op-pin-dots');
  if (!dots) return;
  dots.innerHTML = '';
  for (var i = 0; i < 4; i++) {
    var d = document.createElement('div');
    d.style.cssText = 'width:16px;height:16px;border-radius:50%;border:2px solid #d4af37;'
      + (i < opPinBuffer.length ? 'background:#d4af37;' : 'background:transparent;');
    dots.appendChild(d);
  }
}

function opPinKey(k) {
  var err = document.getElementById('op-pin-err');
  if (err) err.textContent = '';
  if (k === '←') {
    opPinBuffer = opPinBuffer.slice(0, -1);
  } else if (k === '✓') {
    if (opPinBuffer.length < 4) {
      if (err) err.textContent = 'ENTER 4 DIGITS';
      return;
    }
    if (opCheckPin(opPinBuffer)) {
      document.getElementById('op-pin-ov').style.display = 'none';
      opPinBuffer = '';
      opShowMenu();
    } else {
      if (err) { err.textContent = 'INCORRECT PIN'; }
      opPinBuffer = '';
      opUpdatePinDots();
      var ov = document.getElementById('op-pin-ov');
      if (ov) {
        ov.style.animation = 'opShake .4s ease';
        setTimeout(function() { ov.style.animation = ''; }, 400);
      }
    }
    return;
  } else {
    if (opPinBuffer.length >= 4) return;
    opPinBuffer += k;
  }
  opUpdatePinDots();
}

/* ── OPERATOR MENU ─────────────────────────────────────────────────────── */
function opShowMenu() {
  var menu = document.getElementById('op-menu');
  if (!menu) { opBuildMenu(); menu = document.getElementById('op-menu'); }
  opActiveTab = 'history';
  opSwitchTab('history');
  menu.style.display = 'flex';
}

function opBuildMenu() {
  var menu = document.createElement('div');
  menu.id = 'op-menu';
  menu.style.cssText = 'position:fixed;inset:0;background:#08000f;z-index:499;'
    + 'display:none;flex-direction:column;overflow:hidden;';

  /* Header */
  var hdr = document.createElement('div');
  hdr.style.cssText = 'flex-shrink:0;display:flex;align-items:center;justify-content:space-between;'
    + 'padding:10px 14px;border-bottom:2px solid #d4af37;background:#0d0018;';
  var hdrTitle = document.createElement('div');
  hdrTitle.style.cssText = 'font-family:"Bebas Neue",Impact,sans-serif;font-size:20px;'
    + 'letter-spacing:4px;color:#f5d878;';
  hdrTitle.textContent = 'OPERATOR MENU';
  var closeBtn = document.createElement('button');
  closeBtn.textContent = '✕ CLOSE';
  closeBtn.style.cssText = 'padding:6px 14px;font-family:"Bebas Neue",Impact,sans-serif;'
    + 'font-size:13px;color:#d4af37;background:rgba(30,0,60,.8);'
    + 'border:1.5px solid #8b6914;border-radius:6px;cursor:pointer;-webkit-appearance:none;';
  closeBtn.addEventListener('click', function() { menu.style.display = 'none'; });
  closeBtn.addEventListener('touchend', function(e) { e.preventDefault(); menu.style.display = 'none'; });
  hdr.appendChild(hdrTitle);
  hdr.appendChild(closeBtn);

  /* Tab bar */
  var tabs = document.createElement('div');
  tabs.style.cssText = 'flex-shrink:0;display:flex;border-bottom:1px solid rgba(212,175,55,.2);'
    + 'background:#0d0018;';
  ['history','rtp','settings'].forEach(function(tab) {
    var btn = document.createElement('button');
    btn.id = 'op-tab-' + tab;
    btn.textContent = tab === 'rtp' ? 'RTP / HOLD' : tab.toUpperCase();
    btn.style.cssText = 'flex:1;padding:10px 4px;font-family:"Bebas Neue",Impact,sans-serif;'
      + 'font-size:14px;letter-spacing:2px;cursor:pointer;border:none;-webkit-appearance:none;'
      + 'border-bottom:3px solid transparent;background:transparent;color:rgba(245,216,120,.4);';
    btn.addEventListener('click', function() { opSwitchTab(tab); });
    btn.addEventListener('touchend', function(e) { e.preventDefault(); opSwitchTab(tab); });
    tabs.appendChild(btn);
  });

  /* Content area */
  var body = document.createElement('div');
  body.id = 'op-body';
  body.style.cssText = 'flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px 10px;';

  menu.appendChild(hdr);
  menu.appendChild(tabs);
  menu.appendChild(body);
  document.body.appendChild(menu);
}

function opSwitchTab(tab) {
  opActiveTab = tab;
  ['history','rtp','settings'].forEach(function(t) {
    var btn = document.getElementById('op-tab-' + t);
    if (btn) {
      btn.style.color = t === tab ? '#f5d878' : 'rgba(245,216,120,.4)';
      btn.style.borderBottom = t === tab ? '3px solid #d4af37' : '3px solid transparent';
    }
  });
  var body = document.getElementById('op-body');
  if (!body) return;
  body.innerHTML = '';
  if (tab === 'history') opRenderHistory(body);
  else if (tab === 'rtp') opRenderRTP(body);
  else if (tab === 'settings') opRenderSettings(body);
}

/* ── HISTORY TAB ───────────────────────────────────────────────────────── */
function opRenderHistory(body) {
  var arr = opLoadHistory().reverse(); // newest first

  /* Summary row */
  var spins = arr.filter(function(r) { return r.type === 'SPIN'; });
  var totalWagered = spins.reduce(function(s, r) { return s + (r.bet || 0); }, 0);
  var totalWon     = spins.reduce(function(s, r) { return s + (r.win || 0); }, 0);
  var cashIn       = arr.filter(function(r) { return r.type === 'CASH_IN'; })
                       .reduce(function(s,r){ return s+(r.amount||0); }, 0);
  var cashOut      = arr.filter(function(r) { return r.type === 'CASH_OUT'; })
                       .reduce(function(s,r){ return s+(r.amount||0); }, 0);

  var summary = document.createElement('div');
  summary.style.cssText = 'background:rgba(212,175,55,.07);border:1px solid rgba(212,175,55,.2);'
    + 'border-radius:8px;padding:10px 12px;margin-bottom:10px;display:grid;'
    + 'grid-template-columns:1fr 1fr;gap:4px 12px;';
  var sItems = [
    ['TOTAL SPINS', spins.length],
    ['TOTAL WAGERED', '$' + totalWagered.toFixed(2)],
    ['TOTAL WON', '$' + totalWon.toFixed(2)],
    ['CASH IN', '$' + cashIn.toFixed(2)],
    ['CASH OUT', '$' + cashOut.toFixed(2)],
    ['RECORDS', arr.length + ' / ' + OP_MAX_HISTORY]
  ];
  sItems.forEach(function(item) {
    var lbl = document.createElement('div');
    lbl.style.cssText = 'font-size:8px;letter-spacing:2px;color:rgba(212,175,55,.55);';
    lbl.textContent = item[0];
    var val = document.createElement('div');
    val.style.cssText = 'font-family:"Bebas Neue",Impact,sans-serif;font-size:14px;color:#f5d878;';
    val.textContent = item[1];
    var wrap = document.createElement('div');
    wrap.appendChild(lbl); wrap.appendChild(val);
    summary.appendChild(wrap);
  });
  body.appendChild(summary);

  /* Export button */
  var exportBtn = document.createElement('button');
  exportBtn.textContent = '📋 EXPORT JSON';
  exportBtn.style.cssText = 'width:100%;padding:8px;margin-bottom:10px;'
    + 'font-family:"Bebas Neue",Impact,sans-serif;font-size:14px;letter-spacing:2px;'
    + 'background:rgba(0,40,60,.8);border:1.5px solid #006080;color:#44ccff;'
    + 'border-radius:6px;cursor:pointer;-webkit-appearance:none;';
  exportBtn.addEventListener('click', function() {
    try {
      var data = JSON.stringify(opLoadHistory(), null, 2);
      if (navigator.clipboard) {
        navigator.clipboard.writeText(data).then(function() {
          exportBtn.textContent = '✓ COPIED TO CLIPBOARD';
          setTimeout(function() { exportBtn.textContent = '📋 EXPORT JSON'; }, 2000);
        });
      } else {
        var ta = document.createElement('textarea');
        ta.value = data;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        exportBtn.textContent = '✓ COPIED';
        setTimeout(function() { exportBtn.textContent = '📋 EXPORT JSON'; }, 2000);
      }
    } catch(e) { exportBtn.textContent = 'COPY FAILED'; }
  });
  body.appendChild(exportBtn);

  if (arr.length === 0) {
    var empty = document.createElement('div');
    empty.style.cssText = 'text-align:center;color:rgba(255,255,255,.3);font-size:12px;'
      + 'letter-spacing:2px;padding:30px;';
    empty.textContent = 'NO HISTORY YET';
    body.appendChild(empty);
    return;
  }

  /* Records */
  arr.forEach(function(rec, idx) {
    var row = document.createElement('div');
    var isCashIn  = rec.type === 'CASH_IN';
    var isCashOut = rec.type === 'CASH_OUT';
    var borderCol = isCashIn ? '#006080' : isCashOut ? '#4a8000' : 'rgba(212,175,55,.15)';
    row.style.cssText = 'border:1px solid ' + borderCol + ';border-radius:6px;'
      + 'padding:8px 10px;margin-bottom:6px;background:rgba(255,255,255,.02);';

    var top = document.createElement('div');
    top.style.cssText = 'display:flex;justify-content:space-between;align-items:baseline;'
      + 'margin-bottom:3px;';
    var typeSpan = document.createElement('span');
    typeSpan.style.cssText = 'font-family:"Bebas Neue",Impact,sans-serif;font-size:13px;'
      + 'letter-spacing:2px;color:'
      + (isCashIn ? '#44ccff' : isCashOut ? '#88ff44' : '#f5d878') + ';';
    typeSpan.textContent = rec.type;
    var dtSpan = document.createElement('span');
    dtSpan.style.cssText = 'font-size:9px;color:rgba(255,255,255,.35);letter-spacing:.5px;';
    dtSpan.textContent = rec.dateTime || '';
    top.appendChild(typeSpan);
    top.appendChild(dtSpan);
    row.appendChild(top);

    var details = document.createElement('div');
    details.style.cssText = 'font-size:9px;color:rgba(255,255,255,.55);line-height:1.7;'
      + 'letter-spacing:.5px;';

    if (rec.type === 'SPIN') {
      var patStr = rec.patterns && rec.patterns.length ? rec.patterns.join(', ') : 'NO BINGO';
      details.innerHTML =
        '<span style="color:rgba(212,175,55,.6)">CARD:</span> ' + (rec.cardSerial || '—') +
        ' &nbsp;|&nbsp; <span style="color:rgba(212,175,55,.6)">GAME:</span> ' + (rec.gameSerial || '—') + '<br>' +
        '<span style="color:rgba(212,175,55,.6)">BET:</span> $' + (rec.bet || 0).toFixed(2) +
        ' &nbsp;|&nbsp; <span style="color:#00dd55">WIN: $' + (rec.win || 0).toFixed(2) + '</span>' +
        ' &nbsp;|&nbsp; <span style="color:rgba(212,175,55,.6)">BAL:</span> $' + (rec.balBefore || 0).toFixed(2) + ' → $' + (rec.balAfter || 0).toFixed(2) + '<br>' +
        '<span style="color:rgba(212,175,55,.6)">PATTERNS:</span> ' + patStr;
    } else {
      details.innerHTML =
        '<span style="color:rgba(212,175,55,.6)">AMOUNT:</span> $' + (rec.amount || 0).toFixed(2) +
        ' &nbsp;|&nbsp; <span style="color:rgba(212,175,55,.6)">BAL:</span> $' + (rec.balBefore || 0).toFixed(2) + ' → $' + (rec.balAfter || 0).toFixed(2);
    }

    row.appendChild(details);
    body.appendChild(row);
  });
}

/* ── RTP TAB ────────────────────────────────────────────────────────────── */
function opRenderRTP(body) {
  var arr = opLoadHistory();
  var spins = arr.filter(function(r) { return r.type === 'SPIN'; });
  var wagered = spins.reduce(function(s, r) { return s + (r.bet || 0); }, 0);
  var paid    = spins.reduce(function(s, r) { return s + (r.win || 0); }, 0);
  var rtp     = wagered > 0 ? (paid / wagered * 100) : 0;
  var hold    = 100 - rtp;

  var items = [
    ['TOTAL SPINS',    spins.length],
    ['TOTAL WAGERED',  '$' + wagered.toFixed(2)],
    ['TOTAL PAID OUT', '$' + paid.toFixed(2)],
    ['ACTUAL RTP',     rtp.toFixed(2) + '%'],
    ['ACTUAL HOLD',    hold.toFixed(2) + '%'],
    ['TARGET RTP',     '94.00%'],
    ['TARGET HOLD',    '6.00%']
  ];

  var card = document.createElement('div');
  card.style.cssText = 'background:rgba(212,175,55,.05);border:1px solid rgba(212,175,55,.2);'
    + 'border-radius:8px;padding:14px 16px;';

  items.forEach(function(item) {
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:baseline;'
      + 'padding:6px 0;border-bottom:1px solid rgba(255,255,255,.05);';
    var lbl = document.createElement('span');
    lbl.style.cssText = 'font-size:10px;letter-spacing:2px;color:rgba(212,175,55,.6);';
    lbl.textContent = item[0];
    var val = document.createElement('span');
    val.style.cssText = 'font-family:"Bebas Neue",Impact,sans-serif;font-size:16px;color:#f5d878;';
    val.textContent = item[1];
    row.appendChild(lbl); row.appendChild(val);
    card.appendChild(row);
  });

  var note = document.createElement('div');
  note.style.cssText = 'margin-top:10px;font-size:9px;color:rgba(255,255,255,.3);'
    + 'line-height:1.6;letter-spacing:.5px;';
  note.textContent = 'RTP calculated from all recorded spins. '
    + (spins.length < 100 ? 'Low sample size — more spins needed for accurate reading.' : '');
  card.appendChild(note);
  body.appendChild(card);
}

/* ── SETTINGS TAB ──────────────────────────────────────────────────────── */
function opRenderSettings(body) {
  /* Version info */
  var verCard = document.createElement('div');
  verCard.style.cssText = 'background:rgba(212,175,55,.05);border:1px solid rgba(212,175,55,.15);'
    + 'border-radius:8px;padding:10px 14px;margin-bottom:14px;';
  verCard.innerHTML = '<div style="font-size:8px;letter-spacing:2px;color:rgba(212,175,55,.5);">VERSION</div>'
    + '<div style="font-family:\'Bebas Neue\',Impact,sans-serif;font-size:18px;color:#f5d878;letter-spacing:3px;">StrayPups Big Munny v5.22</div>'
    + '<div style="font-size:9px;color:rgba(255,255,255,.3);margin-top:2px;">Class II Bingo Machine</div>';
  body.appendChild(verCard);

  /* Change PIN */
  var pinCard = document.createElement('div');
  pinCard.style.cssText = 'background:rgba(212,175,55,.05);border:1px solid rgba(212,175,55,.15);'
    + 'border-radius:8px;padding:12px 14px;margin-bottom:14px;';
  var pinTitle = document.createElement('div');
  pinTitle.style.cssText = 'font-family:"Bebas Neue",Impact,sans-serif;font-size:15px;'
    + 'letter-spacing:2px;color:#f5d878;margin-bottom:10px;';
  pinTitle.textContent = 'CHANGE PIN';
  pinCard.appendChild(pinTitle);

  ['Current PIN', 'New PIN (4 digits)', 'Confirm New PIN'].forEach(function(lbl, idx) {
    var wrap = document.createElement('div');
    wrap.style.cssText = 'margin-bottom:8px;';
    var l = document.createElement('div');
    l.style.cssText = 'font-size:8px;letter-spacing:2px;color:rgba(212,175,55,.5);margin-bottom:3px;';
    l.textContent = lbl;
    var inp = document.createElement('input');
    inp.type = 'password';
    inp.maxLength = 4;
    inp.id = 'op-pin-inp-' + idx;
    inp.inputMode = 'numeric';
    inp.style.cssText = 'width:100%;padding:7px;font-size:16px;background:#111;'
      + 'color:#f5d878;border:1.5px solid #8b6914;border-radius:6px;text-align:center;'
      + '-webkit-appearance:none;';
    wrap.appendChild(l); wrap.appendChild(inp);
    pinCard.appendChild(wrap);
  });

  var pinMsg = document.createElement('div');
  pinMsg.id = 'op-pin-change-msg';
  pinMsg.style.cssText = 'font-size:10px;letter-spacing:1px;min-height:16px;margin-bottom:6px;';
  pinCard.appendChild(pinMsg);

  var savePin = document.createElement('button');
  savePin.textContent = 'SAVE NEW PIN';
  savePin.style.cssText = 'width:100%;padding:9px;font-family:"Bebas Neue",Impact,sans-serif;'
    + 'font-size:14px;letter-spacing:2px;background:linear-gradient(135deg,#1a4000,#2a6000);'
    + 'color:#fff;border:2px solid #4a8000;border-radius:6px;cursor:pointer;-webkit-appearance:none;';
  savePin.addEventListener('click', function() {
    var cur = document.getElementById('op-pin-inp-0').value;
    var n1  = document.getElementById('op-pin-inp-1').value;
    var n2  = document.getElementById('op-pin-inp-2').value;
    var msg = document.getElementById('op-pin-change-msg');
    if (!opCheckPin(cur)) { msg.style.color='#ff4444'; msg.textContent='INCORRECT CURRENT PIN'; return; }
    if (n1.length !== 4 || !/^\d{4}$/.test(n1)) { msg.style.color='#ff4444'; msg.textContent='NEW PIN MUST BE 4 DIGITS'; return; }
    if (n1 !== n2) { msg.style.color='#ff4444'; msg.textContent='NEW PINS DO NOT MATCH'; return; }
    opSavePin(n1);
    msg.style.color='#88ff44'; msg.textContent='PIN CHANGED SUCCESSFULLY';
    document.getElementById('op-pin-inp-0').value='';
    document.getElementById('op-pin-inp-1').value='';
    document.getElementById('op-pin-inp-2').value='';
  });
  pinCard.appendChild(savePin);
  body.appendChild(pinCard);

  /* Clear history */
  var clearCard = document.createElement('div');
  clearCard.style.cssText = 'background:rgba(200,0,0,.05);border:1px solid rgba(200,0,0,.2);'
    + 'border-radius:8px;padding:12px 14px;';
  var clearTitle = document.createElement('div');
  clearTitle.style.cssText = 'font-family:"Bebas Neue",Impact,sans-serif;font-size:15px;'
    + 'letter-spacing:2px;color:#ff6666;margin-bottom:6px;';
  clearTitle.textContent = 'CLEAR HISTORY';
  var clearWarn = document.createElement('div');
  clearWarn.style.cssText = 'font-size:9px;color:rgba(255,255,255,.4);letter-spacing:.5px;'
    + 'margin-bottom:10px;line-height:1.5;';
  clearWarn.textContent = 'Permanently deletes all recorded game history. Cannot be undone.';
  var clearBtn = document.createElement('button');
  clearBtn.textContent = 'CLEAR ALL HISTORY';
  clearBtn.style.cssText = 'width:100%;padding:9px;font-family:"Bebas Neue",Impact,sans-serif;'
    + 'font-size:14px;letter-spacing:2px;background:linear-gradient(135deg,#4a0000,#800000);'
    + 'color:#fff;border:2px solid #cc0000;border-radius:6px;cursor:pointer;-webkit-appearance:none;';
  clearBtn.addEventListener('click', function() {
    if (confirm('Delete ALL game history? This cannot be undone.')) {
      localStorage.removeItem('spbm_history');
      clearBtn.textContent = '✓ HISTORY CLEARED';
      setTimeout(function() { clearBtn.textContent = 'CLEAR ALL HISTORY'; }, 2000);
    }
  });
  clearCard.appendChild(clearTitle);
  clearCard.appendChild(clearWarn);
  clearCard.appendChild(clearBtn);
  body.appendChild(clearCard);
}

/* ── INIT ──────────────────────────────────────────────────────────────── */
(function() {
  /* Inject shake keyframe */
  var style = document.createElement('style');
  style.textContent = '@keyframes opShake{'
    + '0%,100%{transform:translateX(0)}'
    + '20%,60%{transform:translateX(-10px)}'
    + '40%,80%{transform:translateX(10px)}}';
  document.head.appendChild(style);

  /* Wait for DOM */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', opInitTrigger);
  } else {
    opInitTrigger();
  }
}());
