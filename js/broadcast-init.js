/*
 * broadcast-init.js — Broadcast Messages + Progressive Notifications
 * v1.2 — System commands moved to progressive_commands
 *        broadcast_messages is now player-facing only
 *
 * broadcast_messages: operator messages shown to players (general/alert/info)
 * progressive_commands: system commands (force_local_ball, restore_wide_ball)
 */

(function () {

  var PLAYER_TYPES = ['general', 'alert', 'info', 'special', null, undefined, ''];

  /* ─── Broadcast toast for player-facing messages ─────────────────── */
  function showBroadcastToast(body, title) {
    var DURATION_MS = 12000;
    var el = document.getElementById('broadcast-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'broadcast-toast';
      el.style.cssText = [
        'position:fixed','bottom:90px','left:50%',
        'transform:translateX(-50%)',
        'background:rgba(10,10,30,0.96)','color:#ffd700',
        'border:2px solid #ffd700','border-radius:10px',
        'padding:14px 20px','max-width:88vw','width:340px',
        'font-size:14px','line-height:1.45','text-align:center',
        'z-index:9999','box-shadow:0 4px 24px rgba(0,0,0,0.85)',
        'cursor:pointer','font-family:Arial,sans-serif','display:none'
      ].join(';');
      document.body.appendChild(el);
    }
    var html = title
      ? '<div style="font-weight:bold;font-size:15px;margin-bottom:6px;">' + _esc(title) + '</div>'
      : '';
    html += '<div>' + _esc(body) + '</div>';
    html += '<div style="margin-top:8px;font-size:11px;color:#aaa;">(tap to dismiss)</div>';
    el.innerHTML = html;
    el.style.display = 'block';
    el.onclick = function() { clearTimeout(el._timer); el.style.display = 'none'; };
    clearTimeout(el._timer);
    el._timer = setTimeout(function() { el.style.display = 'none'; }, DURATION_MS);
  }

  function _esc(t) {
    if (!t) return '';
    var m = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'};
    return String(t).replace(/[&<>"']/g, function(c) { return m[c]; });
  }

  /* ─── System command handler (progressive_commands) ─────────────── */
  function handleSystemCommand(row) {
    var gameId = typeof PROG_GAME_ID !== 'undefined' ? PROG_GAME_ID : 'unknown';

    if (row.command === 'force_local_ball') {
      var target = (row.winner_game || '').trim();
      if (target === '' || target === 'WABC' || target === gameId) {
        if (typeof BG !== 'undefined') BG.usingServerBalls = false;
        var banner = document.getElementById('prog-offline-banner');
        var lbl    = document.getElementById('prog-meter-lbl');
        if (banner) banner.classList.add('show');
        if (lbl) { lbl.classList.add('local-mode'); lbl.textContent = '\u2605 LOCAL BALL CALL \u2605'; }
        if (typeof updateBallCallBadge === 'function') updateBallCallBadge();
        showBroadcastToast('Wide area ball call temporarily unavailable.', '\u26a0 Local Mode Active');
      }
      return true;
    }

    if (row.command === 'restore_wide_ball') {
      var target2 = (row.winner_game || '').trim();
      if (target2 === '' || target2 === 'WABC' || target2 === gameId) {
        if (typeof fetchServerBallCall === 'function') {
          fetchServerBallCall(function() {
            var banner2 = document.getElementById('prog-offline-banner');
            var lbl2    = document.getElementById('prog-meter-lbl');
            if (typeof BG !== 'undefined' && BG.usingServerBalls) {
              if (banner2) banner2.classList.remove('show');
              if (lbl2) { lbl2.classList.remove('local-mode'); lbl2.textContent = '\u2605 PROGRESSIVE JACKPOT \u2605'; }
            }
            if (typeof updateBallCallBadge === 'function') updateBallCallBadge();
            showBroadcastToast('Wide area ball call restored.', '\u2714 Wide Area Restored');
          });
        }
      }
      return true;
    }

    return false;
  }

  /* ─── Subscribe to progressive_commands for system commands ─────── */
  function subscribeSystemCommands() {
    if (typeof Progressive === 'undefined' || !Progressive.isConnected()) {
      setTimeout(subscribeSystemCommands, 500);
      return;
    }
    var client = Progressive._getClient ? Progressive._getClient() : null;
    if (!client) { setTimeout(subscribeSystemCommands, 500); return; }

    client.channel('game-sys-commands')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'progressive_commands'
      }, function(p) {
        if (!p.new) return;
        handleSystemCommand(p.new);
      })
      .subscribe();
  }

  /* ─── Wire Progressive message + notification handlers ──────────── */
  function wireHandlers() {
    if (typeof Progressive === 'undefined') {
      setTimeout(wireHandlers, 200);
      return;
    }

    /* Player-facing broadcast messages only — filter system types */
    if (typeof Progressive.onMessage === 'function') {
      Progressive.onMessage(function(msg) {
        if (!msg || !msg.message) return;
        /* Silently ignore any system types that leaked into broadcast_messages */
        var t = (msg.type || '').toLowerCase();
        if (t === 'force_local_ball' || t === 'restore_wide_ball') return;
        showBroadcastToast(msg.message, msg.title || '');
      });
    }

    /* Force jackpot notifications */
    if (typeof Progressive.onForceNotify === 'function') {
      Progressive.onForceNotify(function(amt, gameId) {
        var label = gameId && gameId !== 'unknown' ? gameId : 'another player';
        showBroadcastToast('\u2605 JACKPOT HIT on ' + label + '! $' + (amt||0).toFixed(2), '');
      });
    }

    /* Subscribe to system commands channel */
    subscribeSystemCommands();
    console.log('[broadcast-init] v1.2 wired');
  }

  wireHandlers();

}());
