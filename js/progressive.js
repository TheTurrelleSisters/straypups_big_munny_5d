/*
 * progressive.js — Virtual Progressive Controller
 * Stray-Pup LLC / The Turrelle Sisters LLC
 * v1.5 — Ported from casino lobby v1.4. Changes vs v1.2:
 *
 *  FIX-1: progressive_hits insert in _claimForceWin() and hit() now writes all
 *         schema columns: player_session, player_label, game_title, win_patterns.
 *
 *  FIX-2: presence track() includes sessionKey + nickname fields so operator
 *         controller can resolve "Player N" labels correctly.
 *
 *  FIX-3: registerPlayer() now calls the register_player RPC and writes to
 *         player_registry. Includes _retrackPresence() so the operator sees
 *         the real label after the async RPC resolves (race condition fix).
 *
 *  FIX-4: Shared flat channel names replaced with single session-keyed
 *         consolidated channel (prog-main-<sessionKey>). Eliminates silent
 *         subscriber drops when multiple devices connect to the same project.
 *
 *  FIX-5: Ball call overhauled:
 *         - getBallCall() uses get_ball_call_with_pos RPC with 3s timeout.
 *           Callback now includes ball_pos as 3rd arg so joining players
 *           start at the correct position in the server sequence.
 *         - refreshBallCall() uses upsert_ball_call RPC instead of raw upsert.
 *         - _subscribeBallCall() added — live realtime sync when another
 *           session issues a new sequence.
 *         - updateBallPos() added — debounced write so joining players sync.
 *         - onBallCallUpdate() exposed so game.js listener works correctly.
 *
 *  FIX-6: onConnChange() + _isOnline() + _goLocalMode() + _startConnMonitor()
 *         added. game.js already calls Progressive.onConnChange — previously
 *         this was a silent no-op throwing an error and the offline banner
 *         never appeared.
 *
 * ES5 only. No arrow functions. No const/let. No backticks.
 */

var SUPABASE_URL      = 'https://gdmmoeggkqsvqnqyrubx.supabase.co';
var SUPABASE_ANON_KEY = 'sb_publishable_NGsKBAUUsVUvD5XKTblIdw_aBDPldSd';

/* Per-game identity — set via inline script BEFORE this file loads */
var PROG_GAME_ID = (typeof PROG_GAME_ID !== 'undefined') ? PROG_GAME_ID : 'unknown';
var PROG_DENOM   = (typeof PROG_DENOM   !== 'undefined') ? PROG_DENOM   : 1.00;

var Progressive = (function () {

  /* ── Private state ── */
  var _client           = null;
  var _connected        = false;
  var _localValue       = 500.00;
  var _seed             = 500.00;
  var _ceiling          = 9999.00;
  var _contribRate      = 0.02;
  var _pendingAdd       = 0;
  var _flushTimer       = null;
  var _valueListeners   = [];
  var _presenceChannel  = null;
  var _presenceCount    = 0;
  var _presenceListeners= [];
  var _sessionKey       = 'sess_' + Math.random().toString(36).substr(2, 9);
  var _mainChannel      = null;   /* FIX-4: single consolidated channel */

  /* ── Player registry state ── */
  var _playerNum         = 0;
  var _playerLabel       = '';
  var _playerNickname    = '';
  var _playerRegistered  = false;
  var _localPlayerCounter = 1;

  /* ── Offline / conn-change state (FIX-6) ── */
  var _localMode           = false;
  var _localPotValue       = 500.00;
  var _localPotSeed        = 500.00;
  var _localPotCeiling     = 9999.00;
  var _connChangeListeners = [];
  var _connMonitorTimer    = null;

  /* ── Ball call state (FIX-5) ── */
  var _serverBallCall    = null;
  var _usingServerBalls  = false;
  var _ballCallListeners = [];
  var _ballPosTimer      = null;
  var _lastSentBallPos   = -1;

  /* ── Force jackpot state ── */
  var _forceArmed       = false;
  var _forceCommandId   = null;
  var _forceClaimed     = false;
  var _onForceWin       = null;
  var _onForceNotify    = null;
  var _justWon          = false;

  /* ── Local fallback RNG ── */
  var _rng = (function() {
    var b = new Uint32Array(64); var i = 64;
    function fill() { crypto.getRandomValues(b); i = 0; }
    function next() { if (i >= b.length) fill(); return b[i++] / 0x100000000; }
    function int(lo, hi) { return Math.floor(next() * (hi - lo + 1)) + lo; }
    function shuffle(arr) {
      for (var j = arr.length - 1; j > 0; j--) {
        var k = int(0, j); var t = arr[j]; arr[j] = arr[k]; arr[k] = t;
      }
      return arr;
    }
    return { next: next, int: int, shuffle: shuffle };
  }());

  function _localBallShuffle() {
    var balls = [];
    for (var i = 1; i <= 75; i++) balls.push(i);
    return _rng.shuffle(balls);
  }

  /* ── Connectivity check (FIX-6) ── */
  function _isOnline() {
    return _connected && _client !== null;
  }

  /* ═══════════════════════════════════════════════════════════════
     SDK LOADER
     ═══════════════════════════════════════════════════════════════ */
  function _loadSDK(cb) {
    if (typeof window !== 'undefined' && window.supabase) { cb(); return; }
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.0/dist/umd/supabase.min.js';
    s.onload  = cb;
    s.onerror = function () {
      console.warn('[Progressive] SDK load failed — offline mode.');
      cb(); /* still call cb so game proceeds with local fallback */
    };
    document.head.appendChild(s);
  }

  /* ═══════════════════════════════════════════════════════════════
     NOTIFY HELPERS
     ═══════════════════════════════════════════════════════════════ */
  function _notifyValue() {
    var val = _localMode ? _localPotValue : _localValue;
    for (var i = 0; i < _valueListeners.length; i++) {
      try { _valueListeners[i](val); } catch (e) {}
    }
  }
  function _notifyPresence() {
    for (var i = 0; i < _presenceListeners.length; i++) {
      try { _presenceListeners[i](_presenceCount); } catch (e) {}
    }
  }
  function _notifyBallCall(seq) {
    for (var i = 0; i < _ballCallListeners.length; i++) {
      try { _ballCallListeners[i](seq); } catch (e) {}
    }
  }
  function _notifyConnChange(isOnline) {
    for (var i = 0; i < _connChangeListeners.length; i++) {
      try { _connChangeListeners[i](isOnline); } catch (e) {}
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     DB FETCH
     ═══════════════════════════════════════════════════════════════ */
  function _fetchRow(cb) {
    _client.from('progressive').select('*').eq('id', 1).single().then(function (res) {
      if (res.error) { console.warn('[Progressive] fetchRow:', res.error.message); if (cb) cb(); return; }
      var d = res.data;
      _localValue  = parseFloat(d.value)        || _seed;
      _seed        = parseFloat(d.seed)         || _seed;
      _ceiling     = parseFloat(d.ceiling)      || _ceiling;
      _contribRate = parseFloat(d.contrib_rate) || _contribRate;
      _notifyValue();
      if (cb) cb();
    });
  }

  function _checkArmedCommand() {
    _client.from('progressive_commands')
      .select('*').eq('status', 'armed').limit(1).then(function (res) {
        if (res.error) {
          console.warn('[Progressive] commands table error:', res.error.message);
          return;
        }
        if (!res.data || !res.data.length) return;
        _forceArmed     = true;
        _forceCommandId = res.data[0].id;
        console.log('[Progressive] Force jackpot ARMED on load — fires on next spin!');
      });
  }

  /* ═══════════════════════════════════════════════════════════════
     OFFLINE / CONN-CHANGE (FIX-6)
     ═══════════════════════════════════════════════════════════════ */
  function _goLocalMode() {
    if (_localMode) return;
    _localMode       = true;
    _localPotValue   = _localValue;
    _localPotSeed    = _seed;
    _localPotCeiling = _ceiling;
    /* FIX: set _connected=false so Progressive.isConnected() returns false.
       game.js guards fetchServerBallCall/refreshServerBallCall with isConnected() —
       when false it calls genBallCall() directly, skipping the Progressive.getBallCall()
       RPC path and its 3-second timeout stall on every new round while offline. */
    _connected = false;
    console.warn('[Progressive] OFFLINE — switching to local progressive. Pot: $' + _localPotValue.toFixed(2));
    _notifyConnChange(false);
    _notifyValue();
  }

  function _goOnlineMode() {
    if (!_localMode) return;
    _localMode = false;
    /* Restore connected flag so isConnected() returns true and game.js
       resumes routing ball calls through the server. */
    _connected = (_client !== null);
    console.log('[Progressive] ONLINE — resuming wide area progressive.');
    if (_client) _fetchRow(function() {
      _notifyValue();
      _notifyConnChange(true);
    });
  }

  function _startConnMonitor() {
    if (_connMonitorTimer) return;
    _connMonitorTimer = setInterval(function() {
      var nowConnected = (_connected && _client !== null);
      if (!nowConnected && !_localMode) {
        _goLocalMode();
      } else if (nowConnected && _localMode) {
        _goOnlineMode();
      }
    }, 2000);
    if (typeof window !== 'undefined') {
      window.addEventListener('offline', function() { if (!_localMode) _goLocalMode(); });
      window.addEventListener('online',  function() { setTimeout(function() { if (_localMode) _goOnlineMode(); }, 1000); });
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     BALL CALL (FIX-5)
     ═══════════════════════════════════════════════════════════════ */

  /*
   * getBallCall(cb)
   * cb(sequence, isServer, ballPos) — 3rd arg is current ball position
   * so a joining player starts at the right spot in the server sequence.
   * Falls back to local with 3s timeout.
   */
  function getBallCall(cb) {
    if (!_isOnline()) {
      var local = _localBallShuffle();
      _usingServerBalls = false;
      if (cb) cb(local, false, 0);
      return;
    }

    var _timedOut = false;
    var _cbFired  = false;

    var _timer = setTimeout(function () {
      if (_cbFired) return;
      _timedOut = true;
      console.warn('[Progressive] getBallCall timeout — using local fallback');
      var local = _localBallShuffle();
      _usingServerBalls = false;
      _cbFired = true;
      if (cb) cb(local, false, 0);
    }, 3000);

    _client.rpc('get_ball_call_with_pos', { p_game_id: PROG_GAME_ID })
      .then(function (res) {
        clearTimeout(_timer);
        if (res.error || !res.data || !res.data.sequence) {
          console.warn('[Progressive] getBallCall RPC error:', res.error && res.error.message);
          if (!_cbFired) {
            var local2 = _localBallShuffle();
            _usingServerBalls = false;
            _cbFired = true;
            if (cb) cb(local2, false, 0);
          }
          return;
        }
        _serverBallCall = res.data.sequence;
        var _serverBallPos = res.data.ball_pos || 0;
        _usingServerBalls = true;
        if (!_cbFired) {
          _cbFired = true;
          if (cb) cb(_serverBallCall.slice(), true, _serverBallPos);
        } else {
          /* Timeout already fired with local — quietly push the server seq to listeners */
          _notifyBallCall(_serverBallCall.slice());
        }
      })
      .catch(function (err) {
        clearTimeout(_timer);
        console.warn('[Progressive] getBallCall catch:', err);
        if (!_cbFired) {
          var local3 = _localBallShuffle();
          _usingServerBalls = false;
          _cbFired = true;
          if (cb) cb(local3, false, 0);
        }
      });
  }

  /*
   * refreshBallCall(cb)
   * Issues a new server sequence via RPC. All connected clients receive it
   * via _subscribeBallCall realtime listener.
   */
  function refreshBallCall(cb) {
    if (!_isOnline()) {
      var local = _localBallShuffle();
      _usingServerBalls = false;
      if (cb) cb(local, false, 0);
      return;
    }

    _client.rpc('upsert_ball_call', { p_game_id: PROG_GAME_ID })
      .then(function (res) {
        if (res.error || !res.data || !Array.isArray(res.data)) {
          console.warn('[Progressive] refreshBallCall error — using local');
          var local2 = _localBallShuffle();
          _usingServerBalls = false;
          if (cb) cb(local2, false, 0);
          return;
        }
        _serverBallCall = res.data;
        _usingServerBalls = true;
        if (cb) cb(_serverBallCall.slice(), true, 0);
      })
      .catch(function () {
        var local3 = _localBallShuffle();
        _usingServerBalls = false;
        if (cb) cb(local3, false, 0);
      });
  }

  /*
   * updateBallPos(pos) — debounced write so joining players start at
   * the correct position in the current server sequence.
   */
  var _lastSentBallPos = -1;
  var _ballPosTimer    = null;
  function updateBallPos(pos) {
    if (!_connected || !_client) return;
    if (pos === _lastSentBallPos) return;
    _lastSentBallPos = pos;
    if (_ballPosTimer) return;
    _ballPosTimer = setTimeout(function() {
      _ballPosTimer = null;
      _client.rpc('update_ball_pos', {
        p_game_id: PROG_GAME_ID,
        p_pos:     _lastSentBallPos
      }).then(function(res) {
        if (res.error) console.warn('[Progressive] updateBallPos error:', res.error.message);
      });
    }, 300);
  }

  /* ═══════════════════════════════════════════════════════════════
     REALTIME — CONSOLIDATED SINGLE CHANNEL (FIX-4)
     Replaces 4 flat shared channel names with one session-keyed
     channel carrying all postgres_changes listeners.
     ═══════════════════════════════════════════════════════════════ */
  function _subscribeMain() {
    var chName = 'prog-main-' + _sessionKey;
    _mainChannel = _client.channel(chName)

      /* Progressive value updates */
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'progressive', filter: 'id=eq.1'
      }, function (p) {
        if (!p.new) return;
        _localValue  = parseFloat(p.new.value)        || _localValue;
        _seed        = parseFloat(p.new.seed)         || _seed;
        _ceiling     = parseFloat(p.new.ceiling)      || _ceiling;
        _contribRate = parseFloat(p.new.contrib_rate) || _contribRate;
        _notifyValue();
      })

      /* Force jackpot commands — INSERT (arm) */
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'progressive_commands'
      }, function (p) {
        if (!p.new || p.new.command !== 'force_jackpot' || p.new.status !== 'armed') return;
        _forceArmed     = true;
        _forceCommandId = p.new.id;
        _forceClaimed   = false;
        console.log('[Progressive] FORCE JACKPOT ARMED — fires on next spin!');
      })

      /* Force jackpot commands — UPDATE (claimed by winner) */
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'progressive_commands'
      }, function (p) {
        if (!p.new || p.new.command !== 'force_jackpot') return;
        if (p.new.status === 'won') {
          if (p.new.winner_session === _sessionKey) return;
          _forceArmed     = false;
          _forceCommandId = null;
          if (_onForceNotify) {
            _onForceNotify(parseFloat(p.new.winner_amt) || 0, p.new.winner_game || 'another game');
          }
        }
      })

      /* Progressive hits — ATTITUDE CHECK on non-winner devices */
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'progressive_hits'
      }, function (p) {
        if (!p.new || _justWon) return;
        if (_onForceNotify) {
          _onForceNotify(
            parseFloat(p.new.amount) || 0,
            p.new.game_id || 'another game'
          );
        }
      })

      /* Broadcast messages */
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'broadcast_messages'
      }, function (p) {
        if (!p.new) return;
        _notifyMessage(p.new);
      })

      /* Ball call updates — new sequence issued by another session (FIX-5) */
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'ball_call',
        filter: 'game_id=eq.' + PROG_GAME_ID
      }, function (p) {
        if (!p.new || !p.new.sequence) return;
        var seq = p.new.sequence;
        if (!Array.isArray(seq)) return;
        _serverBallCall   = seq;
        _usingServerBalls = true;
        _notifyBallCall(seq.slice());
      })

      .subscribe(function (status) {
        if (status === 'SUBSCRIBED') {
          console.log('[Progressive] Realtime connected (' + _sessionKey + ')');
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn('[Progressive] Realtime ' + status);
        }
      });
  }

  /* ═══════════════════════════════════════════════════════════════
     PRESENCE
     ═══════════════════════════════════════════════════════════════ */
  function _subscribePresence() {
    _presenceChannel = _client.channel('presence-lobby', {
      config: { presence: { key: _sessionKey } }
    });
    _presenceChannel
      .on('presence', { event: 'sync' }, function () {
        _presenceCount = Object.keys(_presenceChannel.presenceState()).length;
        _notifyPresence();
      })
      .on('presence', { event: 'join' }, function () {
        _presenceCount = Object.keys(_presenceChannel.presenceState()).length;
        _notifyPresence();
      })
      .on('presence', { event: 'leave' }, function () {
        _presenceCount = Object.keys(_presenceChannel.presenceState()).length;
        _notifyPresence();
      })
      .subscribe(function (status) {
        if (status === 'SUBSCRIBED') {
          /* FIX-2: include sessionKey + nickname so operator can resolve Player N */
          _presenceChannel.track({
            gameId:      PROG_GAME_ID,
            denom:       PROG_DENOM,
            joinedAt:    new Date().toISOString(),
            playerLabel: _playerLabel || null,
            nickname:    _playerNickname || _playerLabel || null,
            sessionKey:  _sessionKey,
            lastSpin:    null
          });
        }
      });
  }

  /* FIX-3: Re-broadcast presence once registerPlayer resolves with real label */
  function _retrackPresence() {
    if (!_presenceChannel) return;
    try {
      _presenceChannel.track({
        gameId:      PROG_GAME_ID,
        denom:       PROG_DENOM,
        joinedAt:    new Date().toISOString(),
        playerLabel: _playerLabel,
        nickname:    _playerNickname || _playerLabel,
        sessionKey:  _sessionKey,
        lastSpin:    null
      });
    } catch (e) {
      console.warn('[Progressive] _retrackPresence failed:', e);
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     CONTRIBUTION FLUSH
     ═══════════════════════════════════════════════════════════════ */
  function _scheduleFlush() {
    if (_flushTimer) return;
    _flushTimer = setTimeout(function () {
      _flushTimer = null;
      if (_pendingAdd <= 0 || !_client) return;
      var toAdd   = parseFloat(_pendingAdd.toFixed(4));
      _pendingAdd = 0;
      _client.rpc('progressive_contribute', { add_amount: toAdd }).then(function (res) {
        if (res.error) console.warn('[Progressive] contribute error:', res.error.message);
      });
    }, 5000);
  }

  /* ═══════════════════════════════════════════════════════════════
     FORCE WIN CLAIM — atomic, race-condition safe
     ═══════════════════════════════════════════════════════════════ */
  function _claimForceWin(onClaimed) {
    if (!_forceCommandId || _forceClaimed) { onClaimed(false); return; }
    _forceClaimed = true;
    var hitAmt = parseFloat(_localValue.toFixed(2));

    _client.from('progressive_commands')
      .update({
        status:         'won',
        winner_session: _sessionKey,
        winner_game:    PROG_GAME_ID,
        winner_amt:     hitAmt,
        won_at:         new Date().toISOString()
      })
      .eq('id', _forceCommandId)
      .eq('status', 'armed')
      .select()
      .then(function (res) {
        if (res.error || !res.data || !res.data.length) {
          _forceClaimed = false;
          onClaimed(false);
          return;
        }
        _justWon = true; setTimeout(function(){ _justWon = false; }, 5000);
        _localValue = _seed;
        _notifyValue();
        _forceArmed = false;
        _client.rpc('progressive_hit', { reset_to: _seed });
        /* FIX-1: full schema insert including player fields */
        _client.from('progressive_hits').insert({
          game_id:        PROG_GAME_ID,
          game_title:     PROG_GAME_ID,
          denom:          PROG_DENOM,
          amount:         hitAmt,
          pattern:        'Force Jackpot',
          balls:          0,
          bet:            0,
          player_session: _sessionKey,
          player_label:   _playerLabel || _sessionKey,
          win_patterns:   'Force Jackpot'
        });
        onClaimed(true, hitAmt);
      });
  }

  /* ═══════════════════════════════════════════════════════════════
     PUBLIC API
     ═══════════════════════════════════════════════════════════════ */

  function init(onReady) {
    _loadSDK(function () {
      if (!window.supabase) {
        console.warn('[Progressive] Full offline mode — no DB connection.');
        _goLocalMode();
        _startConnMonitor();
        if (onReady) onReady();
        return;
      }
      try {
        _client    = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        _connected = true;
        _fetchRow(function () {
          _subscribeMain();
          _subscribePresence();
          _checkArmedCommand();
          _checkUnreadMessages();
          setInterval(function() { _fetchRow(null); }, 60000);
          _startConnMonitor();
          if (onReady) onReady();
        });
      } catch (e) {
        console.warn('[Progressive] init failed:', e);
        _connected = false;
        _goLocalMode();
        _startConnMonitor();
        if (onReady) onReady();
      }
    });
  }

  /*
   * retrack() — re-send presence with current nickname (called by game.js
   * after player enters their name). Kept for backward compatibility.
   * FIX-3: now delegates to _retrackPresence().
   */
  function retrack() {
    _retrackPresence();
  }

  /*
   * registerPlayer(cb, nickname)
   * FIX-3: Now calls the register_player RPC to write player_registry
   * and get a server-assigned player number. Falls back to local counter
   * if offline or RPC fails. Re-tracks presence after label is confirmed.
   *
   * Backward-compat: also accepts old (sessionKey, nickname) signature —
   * if first arg is a string, treat as nickname.
   */
  function registerPlayer(cbOrSessionKey, nickname) {
    /* Support old call signature: registerPlayer(sessionKey, nickname) */
    var cb = (typeof cbOrSessionKey === 'function') ? cbOrSessionKey : null;
    var nick = nickname || (typeof cbOrSessionKey === 'string' ? cbOrSessionKey : '');

    if (nick) _playerNickname = nick;

    if (_playerRegistered) {
      if (nick && _client && _connected) {
        _client.rpc('register_player', {
          p_session_key: _sessionKey, p_game_id: PROG_GAME_ID,
          p_denom: PROG_DENOM, p_nickname: _playerNickname
        });
        _retrackPresence();
      }
      if (cb) cb(_playerNum, _playerLabel);
      return;
    }

    if (!_isOnline()) {
      _playerNum        = _localPlayerCounter++;
      _playerLabel      = 'Player ' + _playerNum;
      _playerRegistered = true;
      console.warn('[Progressive] registerPlayer offline — assigned ' + _playerLabel + ' locally');
      _retrackPresence();
      if (cb) cb(_playerNum, _playerLabel);
      return;
    }

    var _cbFired = false;
    var _timer = setTimeout(function () {
      if (_cbFired) return;
      _playerNum        = _localPlayerCounter++;
      _playerLabel      = 'Player ' + _playerNum + ' (local)';
      _playerRegistered = true;
      _cbFired = true;
      console.warn('[Progressive] registerPlayer timeout — using local label');
      _retrackPresence();
      if (cb) cb(_playerNum, _playerLabel);
    }, 4000);

    _client.rpc('register_player', {
      p_session_key: _sessionKey,
      p_game_id:     PROG_GAME_ID,
      p_denom:       PROG_DENOM,
      p_nickname:    _playerNickname || null
    }).then(function (res) {
      clearTimeout(_timer);
      if (_cbFired) return;
      if (res.error) {
        console.warn('[Progressive] register_player error:', res.error.message);
        _playerNum   = _localPlayerCounter++;
        _playerLabel = 'Player ' + _playerNum + ' (local)';
      } else {
        _playerNum   = res.data;
        _playerLabel = 'Player ' + _playerNum;
      }
      _playerRegistered = true;
      _cbFired = true;
      _retrackPresence();
      if (cb) cb(_playerNum, _playerLabel);
    }).catch(function (err) {
      clearTimeout(_timer);
      if (_cbFired) return;
      console.warn('[Progressive] registerPlayer catch:', err);
      _playerNum        = _localPlayerCounter++;
      _playerLabel      = 'Player ' + _playerNum + ' (local)';
      _playerRegistered = true;
      _cbFired = true;
      _retrackPresence();
      if (cb) cb(_playerNum, _playerLabel);
    });
  }

  function contribute(betAmt) {
    if (!betAmt || betAmt <= 0) return false;
    var addition = betAmt * _contribRate;
    _localValue  = _localValue + addition;
    if (_localValue > _ceiling) _localValue = _ceiling;
    _notifyValue();
    if (_connected && _client) {
      _pendingAdd += addition;
      _scheduleFlush();
    }
    return _forceArmed;
  }

  function claimForce(onResult) {
    _claimForceWin(onResult);
  }

  /*
   * hit(info) — natural jackpot (bingo pattern / 5OAK)
   * FIX-1: full progressive_hits insert including player_session, player_label,
   *        game_title, and win_patterns.
   */
  function hit(info) {
    var hitAmt  = parseFloat(_localValue.toFixed(2));
    _localValue = _seed;
    _notifyValue();
    _justWon = true;
    setTimeout(function() { _justWon = false; }, 5000);
    if (_connected && _client) {
      var rec = {
        game_id:        PROG_GAME_ID,
        game_title:     PROG_GAME_ID,
        denom:          PROG_DENOM,
        amount:         hitAmt,
        pattern:        (info && info.pattern) ? info.pattern : 'Progressive Jackpot',
        balls:          (info && info.balls)   ? info.balls   : 0,
        bet:            (info && info.bet)     ? info.bet     : 0,
        player_session: _sessionKey,
        player_label:   _playerLabel || _sessionKey,
        win_patterns:   (info && info.pattern) ? info.pattern : 'Progressive Jackpot'
      };
      _client.rpc('progressive_hit', { reset_to: _seed });
      _client.from('progressive_hits').insert(rec);
      setTimeout(function() { _fetchRow(null); }, 1000);
    }
    return hitAmt;
  }

  function mustHit()              { return _localValue >= _ceiling; }
  function getDisplay()           { return '$' + _localValue.toFixed(2); }
  function getValue()             { return _localValue; }
  function isConnected()          { return _connected; }
  function getPresenceCount()     { return _presenceCount; }
  function isForceArmed()         { return _forceArmed; }
  function getSessionKey()        { return _sessionKey; }
  function getPlayerNum()         { return _playerNum; }
  function getPlayerLabel()       { return _playerLabel; }

  /* ═══════════════════════════════════════════════════════════════
     BROADCAST MESSAGES
     ═══════════════════════════════════════════════════════════════ */
  var _messageListeners  = [];
  var _lastSeenMessageId = 0;
  var _SEEN_KEY          = 'prog_last_msg_' + PROG_GAME_ID;

  function _loadLastSeen() {
    try {
      var v = localStorage.getItem(_SEEN_KEY);
      if (v) _lastSeenMessageId = parseInt(v, 10) || 0;
    } catch(e) {}
  }

  function _saveLastSeen(id) {
    _lastSeenMessageId = id;
    try { localStorage.setItem(_SEEN_KEY, String(id)); } catch(e) {}
  }

  function _notifyMessage(msg) {
    for (var i = 0; i < _messageListeners.length; i++) {
      try { _messageListeners[i](msg); } catch(e) {}
    }
    _saveLastSeen(msg.id);
  }

  function _checkUnreadMessages() {
    _loadLastSeen();
    _client.from('broadcast_messages')
      .select('*')
      .gt('id', _lastSeenMessageId)
      .order('id', { ascending: true })
      .then(function(res) {
        if (res.error || !res.data || !res.data.length) return;
        res.data.forEach(function(msg, i) {
          setTimeout(function() { _notifyMessage(msg); }, i * 4000);
        });
      });
  }

  function onMessage(fn) { _messageListeners.push(fn); }

  function onChange(fn)           { _valueListeners.push(fn); fn(_localValue); }
  function onPresenceChange(fn)   { _presenceListeners.push(fn); fn(_presenceCount); }
  function onForceWin(fn)         { _onForceWin    = fn; }
  function onForceNotify(fn)      { _onForceNotify = fn; }
  function onBallCallUpdate(fn)   { _ballCallListeners.push(fn); }   /* FIX-5 */
  function onConnChange(fn)       { _connChangeListeners.push(fn); } /* FIX-6 */

  return {
    init:             init,
    contribute:       contribute,
    claimForce:       claimForce,
    hit:              hit,
    mustHit:          mustHit,
    getDisplay:       getDisplay,
    getValue:         getValue,
    isConnected:      isConnected,
    isForceArmed:     isForceArmed,
    getPresenceCount: getPresenceCount,
    getSessionKey:    getSessionKey,
    getPlayerNum:     getPlayerNum,
    getPlayerLabel:   getPlayerLabel,
    onChange:         onChange,
    onPresenceChange: onPresenceChange,
    onMessage:        onMessage,
    onForceWin:       onForceWin,
    onForceNotify:    onForceNotify,
    onBallCallUpdate: onBallCallUpdate,  /* FIX-5 */
    onConnChange:     onConnChange,      /* FIX-6 */
    retrack:          retrack,
    registerPlayer:   registerPlayer,
    getBallCall:      getBallCall,
    refreshBallCall:  refreshBallCall,
    updateBallPos:    updateBallPos      /* FIX-5 */
  };
}());
