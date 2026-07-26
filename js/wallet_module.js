'use strict';
/**
 * wallet_module.js — Gold Coins Casino Virtual Wallet
 * Phase A+B: In-game wallet UI + forced cash-out via sendBeacon
 *
 * Drop-in for all games. Expects these globals to exist:
 *   S.bal          — game balance (read/write)
 *   updUI()        — refreshes balance display
 *   toast(msg)     — shows in-game toast
 *   opLog(obj)     — logs event to game_history
 *   sndCreditsAddUp() — (optional) plays credit sound
 *   PROG_GAME_ID   — game slug e.g. 'straypups_1d'
 *   window._playerNickname — set from ?player= URL param
 *
 * Exposes:
 *   WalletUI.open()          — open wallet overlay (ic-btn calls this)
 *   WalletUI.forceSave()     — called on exit / beforeunload
 */

var WalletUI = (function () {

  /* ── Config ── */
  var SB_URL    = 'https://gdmmoeggkqsvqnqyrubx.supabase.co';
  var SB_ANON   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkbW1vZWdna3FzdnFucXlydWJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4MDYzNTQsImV4cCI6MjA5NjM4MjM1NH0.i86afL3CMpmru4z3LZAbCJkxBiwo25QbwEji8tDBAis';
  var BEACON_URL = SB_URL + '/functions/v1/wallet-beacon';
  /* BEACON_API_KEY is injected per-game at build time */
  var BEACON_KEY = 'AP$04167810a';

  var LOBBY_URL  = 'https://theturrellesisters.github.io/turrelle_gold_coins_casino/';
  var PRESETS    = [20, 50, 100, 500];

  var GAME_LABELS = {
    'straypups_1d':'StrayPups $1', 'straypups_5d':'StrayPups $5',
    'maxines':"Maxine's", 'tsbigmunny':'Turrelle Sisters',
    'turrelle_big_munny_2':'TSBM II', 'lobby':'Lobby',
    'preset':'Quick Load', 'operator':'Operator', 'unknown':'Game'
  };

  /* ── Helpers ── */
  function nick()  { return ((window._playerNickname||'')).toLowerCase().trim(); }
  function slug()  { return (typeof PROG_GAME_ID !== 'undefined') ? PROG_GAME_ID : 'unknown'; }
  function fmt(v)  { var n=parseFloat(v);if(isNaN(n)||n<0)n=0;return '$'+n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,','); }
  function el(id)  { return document.getElementById(id); }

  function _lobbyUrl() {
    try { var r=document.referrer; if(r&&r.indexOf('theturrellesisters')!==-1) return r; } catch(e){}
    return LOBBY_URL;
  }

  /* ── Supabase REST fetch ── */
  function _sb(path, opts) {
    opts = opts || {};
    var headers = {
      'apikey': SB_ANON, 'Authorization': 'Bearer '+SB_ANON,
      'Content-Type': 'application/json',
      'Prefer': opts.prefer || 'return=representation'
    };
    return fetch(SB_URL+'/rest/v1/'+path, {
      method:  opts.method || 'GET',
      mode:    'cors',
      headers: headers,
      body:    opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function(r) {
      if (!r.ok) return r.text().then(function(t){ throw new Error(r.status+': '+t); });
      if (opts.prefer === 'return=minimal') return {};
      return r.json();
    });
  }

  /* ── Supabase RPC ── */
  function _rpc(fn, params, cb) {
    fetch(SB_URL+'/rest/v1/rpc/'+fn, {
      method: 'POST',
      mode:   'cors',
      headers: {
        'apikey': SB_ANON, 'Authorization': 'Bearer '+SB_ANON,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    })
    .then(function(r){ return r.json(); })
    .then(function(d){ if(cb) cb(null, d); })
    .catch(function(e){ if(cb) cb(e, null); });
  }

  /* ── Load wallet balance from Supabase ── */
  function _loadBal(cb) {
    var n = nick();
    if (!n) { cb(0); return; }
    _sb('wallet?select=balance&nickname=eq.'+encodeURIComponent(n))
      .then(function(d){ cb(d&&d[0] ? parseFloat(d[0].balance)||0 : 0); })
      .catch(function(){ cb(0); });
  }

  /* ── Load available vouchers ── */
  function _loadVouchers(cb) {
    var n = nick();
    if (!n) { cb([]); return; }
    _sb('vouchers?select=id,amount,source_game,created_at'+
        '&nickname=eq.'+encodeURIComponent(n)+
        '&status=eq.available&order=created_at.desc')
      .then(function(d){ cb(d||[]); })
      .catch(function(){ cb([]); });
  }

  /* ── Adjust wallet balance via RPC ── */
  function _adjustBal(delta, cb) {
    var n = nick();
    if (!n) { if(cb) cb(false); return; }
    _rpc('wallet_adjust_balance', { p_nickname: n, p_delta: delta }, function(err) {
      if(cb) cb(!err);
    });
  }

  /* ── Mark voucher redeemed ── */
  function _redeemVoucherDB(vid, cb) {
    _sb('vouchers?id=eq.'+vid, {
      method:'PATCH', prefer:'return=minimal',
      body:{ status:'redeemed', redeemed_at: new Date().toISOString() }
    })
    .then(function(){ if(cb) cb(true); })
    .catch(function(){ if(cb) cb(false); });
  }

  /* ── Insert voucher ── */
  function _insertVoucher(amount, status, src, cb) {
    var n = nick();
    if (!n) { if(cb) cb(false, null); return; }
    _sb('vouchers', {
      method:'POST',
      body:{ nickname:n, amount:amount, status:status, source_game:src }
    })
    .then(function(d){ if(cb) cb(true, d&&d[0]?d[0]:null); })
    .catch(function(){ if(cb) cb(false, null); });
  }

  /* ══════════════════════════════════════════
     WALLET OVERLAY UI
  ══════════════════════════════════════════ */

  /* Build overlay HTML if it doesn't exist yet */
  function _ensureOverlay() {
    if (el('wov-wrap')) return;
    var div = document.createElement('div');
    div.id = 'wov-wrap';
    div.innerHTML = [
      '<div id="wov-backdrop"></div>',
      '<div id="wov-sheet">',
        '<div id="wov-pill-bar"><div id="wov-pill"></div></div>',
        '<div id="wov-hdr">',
          '<div id="wov-hdr-title">MY WALLET</div>',
          '<button id="wov-hdr-close">&#10005;</button>',
        '</div>',
        '<div id="wov-bal-row">',
          '<div id="wov-bal-lbl">WALLET BALANCE</div>',
          '<div id="wov-bal-amt">$0.00</div>',
          '<div id="wov-bal-nick"></div>',
        '</div>',
        '<div id="wov-divider"></div>',
        '<div id="wov-presets-lbl">QUICK LOAD</div>',
        '<div id="wov-presets">',
          PRESETS.map(function(p){
            return '<button class="wov-preset-btn" data-amt="'+p+'">$'+p+'</button>';
          }).join(''),
        '</div>',
        '<div id="wov-divider2"></div>',
        '<div id="wov-list-lbl">AVAILABLE VOUCHERS</div>',
        '<div id="wov-list"><div id="wov-list-loading">Loading&#8230;</div></div>',
      '</div>',
      /* Force-close overlay */
      '<div id="wov-saving">',
        '<div id="wov-saving-inner">',
          '<div id="wov-saving-icon">&#128179;</div>',
          '<div id="wov-saving-msg">CASHING OUT&hellip;</div>',
          '<div id="wov-saving-sub">Saving your balance to wallet</div>',
        '</div>',
      '</div>'
    ].join('');
    document.body.appendChild(div);
    _injectStyles();
    _wireEvents();
  }

  function _injectStyles() {
    if (el('wov-styles')) return;
    var s = document.createElement('style');
    s.id = 'wov-styles';
    s.textContent = [
      '#wov-wrap{display:none;position:fixed;inset:0;z-index:500;}',
      '#wov-wrap.open{display:block;}',
      '#wov-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.72);}',
      '#wov-sheet{',
        'position:absolute;bottom:0;left:0;right:0;',
        'max-width:500px;margin:0 auto;',
        'background:#111214;border-radius:18px 18px 0 0;',
        'border-top:1.5px solid rgba(255,255,255,.1);',
        'max-height:88vh;display:-webkit-flex;display:flex;',
        '-webkit-flex-direction:column;flex-direction:column;overflow:hidden;',
      '}',
      '#wov-pill-bar{padding:10px 0 0;display:-webkit-flex;display:flex;-webkit-justify-content:center;justify-content:center;-webkit-flex-shrink:0;flex-shrink:0;}',
      '#wov-pill{width:36px;height:4px;border-radius:2px;background:rgba(255,255,255,.15);}',
      '#wov-hdr{-webkit-flex-shrink:0;flex-shrink:0;padding:10px 18px 0;display:-webkit-flex;display:flex;-webkit-align-items:center;align-items:center;-webkit-justify-content:space-between;justify-content:space-between;}',
      '#wov-hdr-title{font-size:11px;letter-spacing:2px;color:#8a8f98;font-family:Arial,sans-serif;font-weight:700;}',
      '#wov-hdr-close{width:28px;height:28px;border-radius:50%;background:#1c1e21;border:none;color:#8a8f98;font-size:15px;cursor:pointer;display:-webkit-flex;display:flex;-webkit-align-items:center;align-items:center;-webkit-justify-content:center;justify-content:center;font-family:Arial,sans-serif;}',
      '#wov-bal-row{-webkit-flex-shrink:0;flex-shrink:0;padding:18px 18px 14px;text-align:center;}',
      '#wov-bal-lbl{font-size:10px;letter-spacing:2px;color:#8a8f98;font-family:Arial,sans-serif;font-weight:700;margin-bottom:4px;}',
      '#wov-bal-amt{font-size:42px;font-weight:900;color:#f5c842;line-height:1;letter-spacing:-1px;font-family:"Arial Black",Arial,sans-serif;}',
      '#wov-bal-nick{font-size:11px;color:#8a8f98;margin-top:4px;font-family:Arial,sans-serif;}',
      '#wov-divider,#wov-divider2{-webkit-flex-shrink:0;flex-shrink:0;height:1px;background:rgba(255,255,255,.07);margin:0 18px;}',
      '#wov-presets-lbl,#wov-list-lbl{-webkit-flex-shrink:0;flex-shrink:0;padding:12px 18px 8px;font-size:10px;letter-spacing:2px;color:#8a8f98;font-family:Arial,sans-serif;font-weight:700;}',
      '#wov-presets{-webkit-flex-shrink:0;flex-shrink:0;display:-webkit-flex;display:flex;gap:8px;padding:0 18px 14px;}',
      '.wov-preset-btn{-webkit-flex:1;flex:1;padding:14px 0;border-radius:10px;border:1.5px solid rgba(29,185,84,.4);background:rgba(29,185,84,.1);color:#1db954;font-size:15px;font-weight:900;font-family:"Arial Black",Arial,sans-serif;cursor:pointer;-webkit-tap-highlight-color:transparent;}',
      '.wov-preset-btn:active{background:rgba(29,185,84,.2);}',
      '#wov-list{-webkit-flex:1;flex:1;overflow-y:auto;padding:0 18px 20px;}',
      '#wov-list-loading{text-align:center;padding:20px 0;color:#8a8f98;font-size:12px;font-family:Arial,sans-serif;}',
      '.wov-voucher{background:#1c1e21;border-radius:12px;padding:14px 16px;margin-bottom:10px;',
        'display:-webkit-flex;display:flex;-webkit-align-items:center;align-items:center;gap:14px;',
        'cursor:pointer;border:1.5px solid transparent;-webkit-tap-highlight-color:transparent;}',
      '.wov-voucher:active{background:#242628;border-color:rgba(29,185,84,.3);}',
      '.wov-v-icon{width:40px;height:40px;border-radius:10px;-webkit-flex-shrink:0;flex-shrink:0;',
        'background:rgba(29,185,84,.12);display:-webkit-flex;display:flex;',
        '-webkit-align-items:center;align-items:center;-webkit-justify-content:center;justify-content:center;font-size:18px;}',
      '.wov-v-body{-webkit-flex:1;flex:1;min-width:0;}',
      '.wov-v-game{font-size:10px;color:#8a8f98;font-family:Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;margin-bottom:2px;}',
      '.wov-v-date{font-size:10px;color:#555a63;font-family:Arial,sans-serif;}',
      '.wov-v-right{text-align:right;}',
      '.wov-v-amt{font-size:16px;font-weight:900;color:#1db954;font-family:"Arial Black",Arial,sans-serif;}',
      '.wov-v-tap{font-size:9px;color:#1db954;letter-spacing:1px;font-family:Arial,sans-serif;margin-top:1px;}',
      '.wov-empty{text-align:center;padding:20px 0;color:#555a63;font-size:12px;font-family:Arial,sans-serif;line-height:1.7;}',
      /* Force-save overlay */
      '#wov-saving{display:none;position:fixed;inset:0;z-index:600;',
        'background:rgba(8,0,15,.96);-webkit-align-items:center;align-items:center;',
        '-webkit-justify-content:center;justify-content:center;}',
      '#wov-saving.on{display:-webkit-flex;display:flex;}',
      '#wov-saving-inner{text-align:center;}',
      '#wov-saving-icon{font-size:48px;margin-bottom:16px;}',
      '#wov-saving-msg{font-size:22px;font-weight:900;color:#f5c842;letter-spacing:3px;',
        'font-family:"Arial Black",Arial,sans-serif;margin-bottom:8px;}',
      '#wov-saving-sub{font-size:12px;color:#8a8f98;letter-spacing:1px;font-family:Arial,sans-serif;}',
    ].join('');
    document.head.appendChild(s);
  }

  function _wireEvents() {
    /* Close button + backdrop */
    var closeBtn  = el('wov-hdr-close');
    var backdrop  = el('wov-backdrop');
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (backdrop) backdrop.addEventListener('click', close);

    /* Preset buttons */
    var presetBtns = document.querySelectorAll('.wov-preset-btn');
    for (var i=0; i<presetBtns.length; i++) {
      (function(btn) {
        btn.addEventListener('click', function() {
          var amt = parseFloat(btn.getAttribute('data-amt'));
          if (!isNaN(amt)) _loadPreset(amt);
        });
      }(presetBtns[i]));
    }
  }

  /* ── Open wallet overlay ── */
  function open() {
    _ensureOverlay();
    var wrap = el('wov-wrap');
    if (wrap) wrap.classList.add('open');

    /* Show nickname */
    var nickEl = el('wov-bal-nick');
    if (nickEl) nickEl.textContent = window._playerNickname
      ? ('\u2605 ' + window._playerNickname) : '';

    /* Load balance */
    var balEl = el('wov-bal-amt');
    if (balEl) balEl.textContent = '$0.00';
    _loadBal(function(bal) {
      if (balEl) balEl.textContent = fmt(bal);
    });

    /* Load vouchers */
    var listEl = el('wov-list');
    if (listEl) listEl.innerHTML = '<div id="wov-list-loading">Loading\u2026</div>';
    _loadVouchers(function(vouchers) {
      _renderVouchers(vouchers);
    });
  }

  function close() {
    var wrap = el('wov-wrap');
    if (wrap) wrap.classList.remove('open');
  }

  function _renderVouchers(vouchers) {
    var listEl = el('wov-list');
    if (!listEl) return;
    if (!vouchers || !vouchers.length) {
      listEl.innerHTML = '<div class="wov-empty">No vouchers available.<br>Cash out from any game or use a Quick Load above.</div>';
      return;
    }
    listEl.innerHTML = vouchers.map(function(v) {
      var d   = new Date(v.created_at);
      var dt  = d.toLocaleDateString()+', '+d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
      var lbl = GAME_LABELS[v.source_game] || (v.source_game||'Lobby');
      return '<div class="wov-voucher" data-vid="'+v.id+'" data-amt="'+v.amount+'">' +
        '<div class="wov-v-icon">\u2b50</div>' +
        '<div class="wov-v-body">' +
          '<div class="wov-v-game">'+lbl+'</div>' +
          '<div class="wov-v-date">'+dt+'</div>' +
        '</div>' +
        '<div class="wov-v-right">' +
          '<div class="wov-v-amt">'+fmt(v.amount)+'</div>' +
          '<div class="wov-v-tap">TAP TO USE</div>' +
        '</div>' +
      '</div>';
    }).join('');

    /* Wire voucher taps */
    var rows = listEl.querySelectorAll('.wov-voucher');
    for (var i=0; i<rows.length; i++) {
      (function(row) {
        row.addEventListener('click', function() {
          var vid = row.getAttribute('data-vid');
          var amt = parseFloat(row.getAttribute('data-amt'));
          if (vid && !isNaN(amt)) _loadVoucher(vid, amt);
        });
      }(rows[i]));
    }
  }

  /* ── Load preset: create voucher → immediately redeem → add to S.bal ── */
  function _loadPreset(amount) {
    var n = nick();
    if (!n) { _noNickToast(); return; }
    _disablePresets(true);

    /* 1. Insert voucher as 'redeemed' immediately — one atomic step */
    _insertVoucher(amount, 'redeemed', 'preset', function(ok, voucher) {
      if (!ok) {
        _disablePresets(false);
        if (typeof toast === 'function') toast('Wallet error — try again');
        return;
      }
      /* 2. Deduct from wallet balance (honor system) */
      _adjustBal(-amount, function() {
        /* 3. Credit game balance */
        S.bal += amount;
        if (typeof updUI === 'function') updUI();
        if (typeof sndCreditsAddUp === 'function') sndCreditsAddUp();
        if (typeof opLog === 'function') {
          opLog({type:'WALLET_LOAD', source:'preset', amount:amount,
                 balAfter:S.bal, walletDelta:-amount});
        }
        if (typeof toast === 'function') toast(fmt(amount)+' LOADED \u2014 GOOD LUCK!');
        _disablePresets(false);
        /* Refresh balance display */
        _loadBal(function(bal) {
          var be = el('wov-bal-amt'); if(be) be.textContent = fmt(bal);
        });
        close();
      });
    });
  }

  /* ── Load available voucher: mark redeemed → add to S.bal ── */
  function _loadVoucher(vid, amount) {
    var n = nick();
    if (!n) { _noNickToast(); return; }
    var listEl = el('wov-list');
    if (listEl) listEl.innerHTML = '<div id="wov-list-loading">Redeeming\u2026</div>';

    _redeemVoucherDB(vid, function(ok) {
      if (!ok) {
        if (typeof toast === 'function') toast('Redemption failed \u2014 try again');
        _loadVouchers(function(v){ _renderVouchers(v); });
        return;
      }
      /* Deduct from wallet balance */
      _adjustBal(-amount, function() {
        S.bal += amount;
        if (typeof updUI === 'function') updUI();
        if (typeof sndCreditsAddUp === 'function') sndCreditsAddUp();
        if (typeof opLog === 'function') {
          opLog({type:'VOUCHER_REDEEM', voucherId:vid, amount:amount,
                 balAfter:S.bal, walletDelta:-amount});
        }
        if (typeof toast === 'function') toast(fmt(amount)+' LOADED \u2014 GOOD LUCK!');
        _loadBal(function(bal) {
          var be = el('wov-bal-amt'); if(be) be.textContent = fmt(bal);
        });
        close();
      });
    });
  }

  function _disablePresets(disabled) {
    var btns = document.querySelectorAll('.wov-preset-btn');
    for (var i=0; i<btns.length; i++) btns[i].disabled = disabled;
  }

  function _noNickToast() {
    if (typeof toast === 'function') toast('Return to lobby to set your nickname');
  }

  /* ══════════════════════════════════════════
     CASH OUT — saves S.bal to wallet + creates voucher
  ══════════════════════════════════════════ */
  function cashOut(onDone) {
    var n      = nick();
    var amount = (typeof S !== 'undefined') ? (parseFloat(S.bal)||0) : 0;

    if (!n || amount <= 0) { if(onDone) onDone(false); return; }

    /* 1. Insert voucher (available) — shows in player's future wallet list */
    _insertVoucher(amount, 'available', slug(), function(ok) {
      if (!ok) { if(onDone) onDone(false); return; }
      /* 2. Increment wallet balance */
      _adjustBal(amount, function(balOk) {
        if(onDone) onDone(balOk);
      });
    });
  }

  /* ══════════════════════════════════════════
     FORCED SAVE — beforeunload / visibilitychange
     Uses sendBeacon for fire-and-forget reliability
  ══════════════════════════════════════════ */
  function forceSave() {
    var n      = nick();
    var amount = (typeof S !== 'undefined') ? (parseFloat(S.bal)||0) : 0;
    if (!n || amount <= 0 || !BEACON_KEY) return;

    var payload = JSON.stringify({
      nickname:     n,
      game_balance: amount,
      source_game:  slug(),
      api_key:      BEACON_KEY
    });

    /* Show cashing-out overlay */
    _ensureOverlay();
    var sav = el('wov-saving'); if(sav) sav.classList.add('on');

    /* sendBeacon is fire-and-forget — survives page unload */
    if (typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(BEACON_URL, payload);
    } else {
      /* Fallback: synchronous XHR (last resort) */
      try {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', BEACON_URL, false); /* sync */
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(payload);
      } catch(e) {}
    }
    /* Zero game balance immediately so double-save can't happen */
    if (typeof S !== 'undefined') S.bal = 0;
    if (typeof updUI === 'function') try { updUI(); } catch(e) {}
  }

  /* ── Wire forced save events ── */
  function _wireExitEvents() {
    /* beforeunload: fires on tab close, navigation away */
    window.addEventListener('beforeunload', function() { forceSave(); });
    /* pagehide: fires on iOS when page is backgrounded/closed */
    window.addEventListener('pagehide', function(e) {
      if (e.persisted) return; /* page went into bfcache — don't save yet */
      forceSave();
    });
    /* visibilitychange: fires when app is hidden (Android Chrome, PWA) */
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'hidden') forceSave();
    });
  }

  /* ── Public init ── */
  function init() {
    _ensureOverlay();
    _wireExitEvents();
  }

  return {
    init:      init,
    open:      open,
    close:     close,
    cashOut:   cashOut,
    forceSave: forceSave,
  };
}());
