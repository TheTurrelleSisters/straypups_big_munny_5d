/*
 * broadcast-init.js — Broadcast Messages + Progressive Notifications
 * v1.1 — Added operator ball call control commands
 *
 * Wires Progressive.onMessage() for operator broadcasts
 * Wires Progressive.onForceNotify() for force jackpot notifications
 * Handles force_local_ball and restore_wide_ball operator commands
 *
 * ES5 only. No const/let/arrow functions/backticks.
 */

(function () {

  /* ─── Persistent broadcast toast (operator announcements) ──────────────────── */
  function showBroadcastToast(body, title) {
    var DURATION_MS = 12000;
    var el = document.getElementById('broadcast-toast');

    if (!el) {
      el = document.createElement('div');
      el.id = 'broadcast-toast';
      el.style.cssText = [
        'position:fixed',
        'bottom:90px',
        'left:50%',
        'transform:translateX(-50%)',
        'background:rgba(10,10,30,0.96)',
        'color:#ffd700',
        'border:2px solid #ffd700',
        'border-radius:10px',
        'padding:14px 20px',
        'max-width:88vw',
        'width:340px',
        'font-size:14px',
        'line-height:1.45',
        'text-align:center',
        'z-index:9999',
        'box-shadow:0 4px 24px rgba(0,0,0,0.85)',
        'cursor:pointer',
        'font-family:Arial,sans-serif',
        'display:none'
      ].join(';');
      document.body.appendChild(el);
    }

    var html = '';
    if (title) {
      html += '<div style="font-weight:bold;font-size:15px;margin-bottom:6px;">'
            + escapeHtml(title) + '</div>';
    }
    html += '<div>' + escapeHtml(body) + '</div>';
    html += '<div style="margin-top:8px;font-size:11px;color:#aaa;">(tap to dismiss)</div>';
    el.innerHTML = html;
    el.style.display = 'block';

    el.onclick = function () {
      clearTimeout(el._timer);
      el.style.display = 'none';
    };

    clearTimeout(el._timer);
    el._timer = setTimeout(function () {
      el.style.display = 'none';
    }, DURATION_MS);
  }

  function escapeHtml(text) {
    if (!text) return '';
    var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, function(c) { return map[c]; });
  }

  /* ─── Operator ball call control ─────────────────────────────────────────── */
  function handleBallCallCommand(msg) {
    var gameId = typeof PROG_GAME_ID !== 'undefined' ? PROG_GAME_ID : 'unknown';

    if (msg.type === 'force_local_ball') {
      var target = msg.message.replace('FORCE_LOCAL_BALL:', '').trim();
      /* Apply if targeting this game or all games (empty target) */
      if (target === '' || target === gameId) {
        /* Switch to local mode immediately */
        if (typeof BG !== 'undefined') BG.usingServerBalls = false;
        /* Show offline banner */
        var banner = document.getElementById('prog-offline-banner');
        var lbl    = document.getElementById('prog-meter-lbl');
        if (banner) banner.classList.add('show');
        if (lbl) {
          lbl.classList.add('local-mode');
          lbl.textContent = '\u2605 LOCAL BALL CALL \u2605';
        }
        if (typeof updateBallCallBadge === 'function') updateBallCallBadge();
        showBroadcastToast('Operator has switched to local ball call. Wide area temporarily unavailable.', '\u26a0 Local Mode');
        if (typeof _audit === 'function') _audit('OPERATOR CMD', 'Switched to local ball call');
      }
      return true; /* handled */
    }

    if (msg.type === 'restore_wide_ball') {
      var target2 = msg.message.replace('RESTORE_WIDE_BALL:', '').trim();
      if (target2 === '' || target2 === gameId) {
        /* Fetch fresh server sequence */
        if (typeof fetchServerBallCall === 'function') {
          fetchServerBallCall(function() {
            var banner2 = document.getElementById('prog-offline-banner');
            var lbl2    = document.getElementById('prog-meter-lbl');
            if (typeof BG !== 'undefined' && BG.usingServerBalls) {
              if (banner2) banner2.classList.remove('show');
              if (lbl2) {
                lbl2.classList.remove('local-mode');
                lbl2.textContent = '\u2605 PROGRESSIVE JACKPOT \u2605';
              }
            }
            if (typeof updateBallCallBadge === 'function') updateBallCallBadge();
            showBroadcastToast('Wide area ball call restored by operator.', '\u2714 Wide Area Restored');
            if (typeof _audit === 'function') _audit('OPERATOR CMD', 'Wide area ball call restored');
          });
        }
      }
      return true; /* handled */
    }

    return false; /* not a ball call command */
  }

  /* ─── Wait for Progressive, then wire all handlers ───────────────────────── */
  function wireProgressiveHandlers() {
    if (typeof Progressive === 'undefined') {
      setTimeout(wireProgressiveHandlers, 200);
      return;
    }

    /* Handler 1: Operator broadcast messages + ball call commands */
    if (typeof Progressive.onMessage === 'function') {
      Progressive.onMessage(function (msg) {
        if (!msg || !msg.message) return;
        /* Check for special operator commands first */
        if (handleBallCallCommand(msg)) return;
        /* Normal operator broadcast — show toast */
        showBroadcastToast(msg.message, msg.title || '');
      });
    }

    /* Handler 2: Force jackpot notifications (another game won) */
    if (typeof Progressive.onForceNotify === 'function') {
      Progressive.onForceNotify(function (amt, gameId) {
        var label = gameId && gameId !== 'unknown' ? gameId : 'another player';
        var text = '\u2605 JACKPOT HIT on ' + label + '! $' + (amt || 0).toFixed(2);
        if (typeof UI !== 'undefined' && typeof UI.showToast === 'function') {
          UI.showToast(text, 5000);
        } else if (typeof toast === 'function') {
          toast(text);
        } else {
          showBroadcastToast(text, '');
        }
      });
    }

    console.log('[broadcast-init] v1.1 — wired');
  }

  wireProgressiveHandlers();

}());
