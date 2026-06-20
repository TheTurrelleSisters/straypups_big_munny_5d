/*
 * progressive.js — Virtual Progressive Controller
 * Stray-Pup LLC / The Turrelle Sisters LLC
 * v1.5 — Ball call stubs removed (WABC is sole source). Dead code cleanup.
 * ES5 only. No arrow functions. No const/let. No backticks.
 */

var SUPABASE_URL      = 'https://gdmmoeggkqsvqnqyrubx.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkbW1vZWdna3FzdnFucXlydWJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4MDYzNTQsImV4cCI6MjA5NjM4MjM1NH0.i86afL3CMpmru4z3LZAbCJkxBiwo25QbwEji8tDBAis';

/* Per-game identity — set via inline script BEFORE this file loads */
var PROG_GAME_ID = (typeof PROG_GAME_ID !== 'undefined') ? PROG_GAME_ID : 'unknown';
var PROG_DENOM   = (typeof PROG_DENOM   !== 'undefined') ? PROG_DENOM   : 1.00;

/* Game title map for hit records */
var PROG_GAME_TITLES = {
  'straypups_1d': 'Stray Pups Big Munny $1',
  'straypups_5d': 'Stray Pups Big Munny $5',
  'turrelle':     'The Turrelle Sisters Big Munny',
  'maxine':       "Maxine's Wild Cherries",
  'unknown':      'Unknown Game'
};

var Progressive = (function () {

  /* ── Private state ── */
  var _client            = null;
  var _connected         = false;
  var _localValue        = 500.00;
  var _seed              = 500.00;
  var _ceiling           = 9999.00;
  var _contribRate       = 0.02;
  var _triggerOdds       = 500;   /* "1-in-N at seed" -> scales toward guaranteed at ceiling */
  var _pendingAdd        = 0;
  var _flushTimer        = null;
  var _valueListeners    = [];
  var _presenceChannel   = null;
  var _joinedAt          = null;
  var _presenceCount     = 0;
  var _presenceListeners = [];
  var _sessionKey        = 'sess_' + Math.random().toString(36).substr(2, 9);

  /* ── Player registry state ── */
  var _playerNum         = 0;     /* assigned after register_player RPC */
  var _playerLabel       = '';    /* "Player 3" — set after registration */
  var _playerNickname    = '';    /* player-chosen nickname */
  var _playerRegistered  = false;

  /* Ball pos update — debounced, max 1 write per 1.3s */
  var _ballPosTimer      = null;
  var _lastSentBallPos   = -1;

  /* ── LOCAL PROGRESSIVE (offline fallback) ── */
  var _localMode         = false;  /* true when offline, grows local pot */
  var _localPotValue     = 500.00; /* mirrors last known wide area value */
  var _localPotSeed      = 500.00; /* snapshot of seed when went offline */
  var _localPotCeiling   = 9999.00;/* mirrors wide area ceiling */
  var _connChangeListeners = [];   /* fired when online/offline state changes */
  var _connMonitorTimer  = null;

  /* ── Ball call state ── */
  var _serverBallCall    = null;  /* array of 75 numbers from DB, or null */
  var _usingServerBalls  = false; /* true when currently using server sequence */
  var _ballCallListeners = [];    /* callbacks when new sequence arrives */

  /* ── Progressive jackpot claim state ── */
  /* _forceArmed/_forceCommandId/_forceClaimed used by armAndClaim() + _claimForceWin()
     as a race guard between simultaneous natural Lazy-T hits from multiple players.
     v5.115: operator-triggered Force Jackpot feature removed — these vars now serve
     ONLY the natural jackpot race-protection path. */
  var _forceArmed        = false;
  var _forceCommandId    = null;
  var _forceClaimed      = false;
  var _justWon           = false;

  /* ── Local fallback RNG (mirrors game.js RNG) ── */
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

  /* ── Connectivity check ── */
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
     PLAYER REGISTRATION
     ═══════════════════════════════════════════════════════════════ */

  /*
   * registerPlayer(cb)
   * Registers this session in player_registry and returns player_num.
   * cb(playerNum, playerLabel) — e.g. cb(3, "Player 3")
   * Falls back to local counter if offline.
   * Safe to call multiple times — only registers once per session.
   */
  var _localPlayerCounter = 1; /* shared local counter for offline sessions */

  function registerPlayer(cb, nickname) {
    if (nickname) _playerNickname = nickname;
    if (_playerRegistered) {
      /* Update nickname if changed */
      if (nickname && _client && _connected) {
        _client.rpc('register_player', {
          p_session_key: _sessionKey, p_game_id: PROG_GAME_ID,
          p_denom: PROG_DENOM, p_nickname: nickname
        });
      }
      if (cb) cb(_playerNum, _playerLabel);
      return;
    }

    if (!_isOnline()) {
      _playerNum       = _localPlayerCounter++;
      _playerLabel     = 'Player ' + _playerNum;
      _playerRegistered = true;
      _startHeartbeat();
      console.warn('[Progressive] registerPlayer offline — assigned ' + _playerLabel + ' locally');
      if (cb) cb(_playerNum, _playerLabel);
      return;
    }

    /* 4-second timeout for registration */
    var _cbFired = false;
    var _timer = setTimeout(function () {
      if (_cbFired) return;
      _playerNum       = _localPlayerCounter++;
      _playerLabel     = 'Player ' + _playerNum + ' (local)';
      _playerRegistered = true;
      _cbFired = true;
      _startHeartbeat();
      console.warn('[Progressive] registerPlayer timeout — using local label');
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
      _startHeartbeat();
      if (cb) cb(_playerNum, _playerLabel);
    }).catch(function (err) {
      clearTimeout(_timer);
      if (_cbFired) return;
      console.warn('[Progressive] registerPlayer catch:', err);
      _playerNum       = _localPlayerCounter++;
      _playerLabel     = 'Player ' + _playerNum + ' (local)';
      _playerRegistered = true;
      _cbFired = true;
      _startHeartbeat();
      if (cb) cb(_playerNum, _playerLabel);
    });
  }

  /*
   * updateLastSpin()
   * Call on every spin press to update the player's lastSpin timestamp
   * in the presence channel. Keeps the progressive operator's
   * active/inactive display accurate. ES5-safe.
   */
  var _lastSpinTrackTime = 0;
  var _lastSpinTime      = null;
  var _TRACK_THROTTLE_MS = 30000; /* Only broadcast presence every 30s max */
  var _heartbeatTimer    = null;
  var _HEARTBEAT_MS      = 20000; /* Touch last_seen every 20s — keeps ball
                                     caller active between spins */

  function updateLastSpin() {
    if (!_playerRegistered) return;
    /* Always store the last spin time locally */
    _lastSpinTime = new Date().toISOString();
    /* Throttle presence track() / DB touch — Supabase rate limits rapid
       calls. Only update if 30 seconds have passed since last update. */
    var now = Date.now();
    if (now - _lastSpinTrackTime < _TRACK_THROTTLE_MS) return;
    _lastSpinTrackTime = now;

    if (_presenceChannel) {
      _presenceChannel.track({
        gameId:      PROG_GAME_ID,
        denom:       PROG_DENOM,
        joinedAt:    _joinedAt || new Date().toISOString(),
        playerLabel: _playerLabel || ('sess_' + _sessionKey.substr(0, 6)),
        nickname:    _playerNickname || _playerLabel || ('sess_' + _sessionKey.substr(0, 6)),
        sessionKey:  _sessionKey,
        lastSpin:    _lastSpinTime
      });
    }

    /* Touch player_registry.last_seen — the durable, DB-backed signal
       that operator tools now use for "connected"/"inactive" displays.
       Separate from register_player's nickname-gated re-call (which never
       fires again for nickname-less players), so this keeps last_seen
       fresh for EVERY player regardless of nickname. */
    if (_client && _connected && _sessionKey) {
      _client.rpc('touch_player_last_seen', { p_session_key: _sessionKey })
        .then(function(res) {
          if (res.error) console.warn('[Progressive] touch_player_last_seen error:', res.error.message);
        })
        .catch(function(err) {
          console.warn('[Progressive] touch_player_last_seen catch:', err);
        });
    }
  }

  /* _touchLastSeen — lightweight DB ping, no throttle.
     Called by heartbeat every 20s so advance_ball_call() always
     sees an active player and keeps the ball caller running. */
  function _touchLastSeen() {
    if (!_client || !_connected || !_sessionKey) return;
    _client.rpc('touch_player_last_seen', { p_session_key: _sessionKey })
      .then(function(res) {
        if (res.error) console.warn('[Progressive] heartbeat touch error:', res.error.message);
      })
      .catch(function(err) {
        console.warn('[Progressive] heartbeat touch catch:', err);
      });
  }

  /* _startHeartbeat — begins the 20-second last_seen heartbeat.
     Called once after player registers. Stops on page unload. */
  function _startHeartbeat() {
    if (_heartbeatTimer) return; /* already running */
    _touchLastSeen(); /* touch immediately on register */
    _heartbeatTimer = setInterval(function() {
      _touchLastSeen();
    }, _HEARTBEAT_MS);
  }

  function _stopHeartbeat() {
    if (_heartbeatTimer) { clearInterval(_heartbeatTimer); _heartbeatTimer = null; }
  }

    /* ═══════════════════════════════════════════════════════════════
     DB FETCH
     ═══════════════════════════════════════════════════════════════ */
  function _fetchRow(cb) {
    if (!_client) { if (cb) cb(); return; }
    _client.from('progressive').select('*').eq('id', 1).single().then(function (res) {
      if (res.error) {
        console.warn('[Progressive] _fetchRow error:', res.error.message);
        /* DB reachable but query failed — go local mode */
        if (!_localMode) _goLocalMode();
        if (cb) cb();
        return;
      }
      var d = res.data;
      if (!d) { if (cb) cb(); return; }
      _localValue  = parseFloat(d.value)        || _seed;
      _seed        = parseFloat(d.seed)         || _seed;
      _ceiling     = parseFloat(d.ceiling)      || _ceiling;
      _contribRate = parseFloat(d.contrib_rate) || _contribRate;
      _triggerOdds = parseFloat(d.trigger_odds) || _triggerOdds;
      /* If we were in local mode and DB is now responding, go back online */
      if (_localMode) _goOnlineMode();
      _notifyValue();
      if (cb) cb();
    }).catch(function(err) {
      console.warn('[Progressive] _fetchRow catch:', err);
      if (!_localMode) _goLocalMode();
      if (cb) cb();
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     REALTIME
     ═══════════════════════════════════════════════════════════════ */
  function _subscribeValue() {
    _client.channel('prog-value')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'progressive', filter: 'id=eq.1'
      }, function (p) {
        if (!p.new) return;
        _localValue  = parseFloat(p.new.value)        || _localValue;
        _seed        = parseFloat(p.new.seed)         || _seed;
        _ceiling     = parseFloat(p.new.ceiling)      || _ceiling;
        _contribRate = parseFloat(p.new.contrib_rate) || _contribRate;
        _triggerOdds = parseFloat(p.new.trigger_odds) || _triggerOdds;
        _notifyValue();
      }).subscribe();
  }

  /* _subscribeBallCall removed in v5.39 — ball_call postgres_changes subscription
     eliminated. Ball position is now delivered via WABC Broadcast (wabc.js),
     removing ~2-3 DB writes/second that saturated the CDC replication pool. */


  function _subscribeHits() {
    _client.channel('prog-hits-notify')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'progressive_hits'
      }, function (p) {
        /* v5.85: ALL real hits now go through armAndClaim -> _claimForceWin,
           which updates progressive_commands (status='won') BEFORE this
           progressive_hits row is even inserted — _subscribeCommands' UPDATE
           handler above already notifies other players (with the real
           pattern names + winner_label) for every hit, natural or forced.
           This listener is now redundant for notification purposes and is
           disabled to avoid a duplicate Attitude Check popup. Left in place
           (rather than removed) in case progressive_hits INSERT-based logic
           is needed again later. */
        return;
      }).subscribe();
  }

  /* ═══════════════════════════════════════════════════════════════
     LOCAL PROGRESSIVE — OFFLINE FALLBACK
     When offline: pot mirrors last known wide area value, grows locally.
     Win pays from local pot, resets to last known seed. No DB writes.
     On reconnect: switches back to wide area instantly.
     ═══════════════════════════════════════════════════════════════ */

  function _goLocalMode() {
    if (_localMode) return;
    _localMode       = true;
    /* Snapshot current wide area values as local baseline */
    _localPotValue   = _localValue;
    _localPotSeed    = _seed;
    _localPotCeiling = _ceiling;
    console.warn('[Progressive] OFFLINE — switching to local progressive. Pot: $' + _localPotValue.toFixed(2));
    _notifyConnChange(false);
    _notifyValue(); /* re-notify with local value so meter updates */
  }

  function _goOnlineMode() {
    if (!_localMode) return;
    _localMode = false;
    console.log('[Progressive] ONLINE — resuming wide area progressive.');
    /* Re-fetch live value immediately */
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
    /* Also use browser online/offline events for instant detection */
    if (typeof window !== 'undefined') {
      window.addEventListener('offline', function() { if (!_localMode) _goLocalMode(); });
      window.addEventListener('online',  function() { setTimeout(function() { if (_localMode) _goOnlineMode(); }, 1000); });
      window.addEventListener('beforeunload', function() { _stopHeartbeat(); });
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     BALL POSITION TRACKING
     ═══════════════════════════════════════════════════════════════ */

  /*
   * updateBallPos(pos) — STUBBED in v5.39.
   * Ball position advances are now sent over WABC Broadcast (wabc.js).
   * DB tick-writes removed to prevent CDC replication pool saturation.
   * Checkpoint writes (new sequence, reset) are handled by the WABC operator.
   */
  function updateBallPos(pos) {
    /* no-op — ball position is per-player local only.
       Never written to DB or broadcast. CDC replication protection. */
  }

  /* ═══════════════════════════════════════════════════════════════
     PRESENCE
     ═══════════════════════════════════════════════════════════════ */
  var _presenceRetryDelay = 2000;
  function _subscribePresence() {
    /* Expose client for Floor Manager writes and WABC client reuse.
       _wabcSupabaseClient MUST be set before WABC.init() runs so wabc.js
       reuses this client instead of creating its own — prevents duplicate
       Supabase clients and multiple wabc-ballpos channel subscriptions. */
    window._floorSupabaseClient = _client;
    window._wabcSupabaseClient  = _client;
    _doSubscribePresence();
  }

  function _doSubscribePresence() {
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
          _presenceRetryDelay = 2000; /* reset backoff on success */
          _joinedAt = new Date().toISOString();
          _presenceChannel.track({
            gameId:      PROG_GAME_ID,
            denom:       PROG_DENOM,
            joinedAt:    _joinedAt,
            playerLabel: _playerLabel || ('sess_' + _sessionKey.substr(0, 6)),
            nickname:    _playerNickname || _playerLabel || ('sess_' + _sessionKey.substr(0, 6)),
            sessionKey:  _sessionKey,
            lastSpin:    null
          });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          /* Previously a ONE-SHOT subscribe — if the first attempt failed
             (e.g. during Supabase free-tier Realtime tenant cold-start),
             .track() never fired and this player was PERMANENTLY invisible
             to presence for the rest of the session, with no retry. Retry
             with the same removeChannel-then-resubscribe pattern used by
             wabc.js, with exponential backoff up to 30s. */
          console.warn('[Progressive] presence channel ' + status + ' — reconnecting in ' + (_presenceRetryDelay/1000) + 's');
          var _old = _presenceChannel;
          var _delay = _presenceRetryDelay;
          _presenceRetryDelay = Math.min(_presenceRetryDelay * 2, 30000);
          setTimeout(function () {
            try {
              var _rm = _client.removeChannel(_old);
              if (_rm && typeof _rm.then === 'function') {
                _rm.then(_doSubscribePresence).catch(_doSubscribePresence);
              } else {
                _doSubscribePresence();
              }
            } catch (e) { _doSubscribePresence(); }
          }, _delay);
        }
      });
  }

  /* ═══════════════════════════════════════════════════════════════
     CONTRIBUTION FLUSH
     ═══════════════════════════════════════════════════════════════ */
  function _scheduleFlush() {
    if (_flushTimer) return;
    _flushTimer = setTimeout(function () {
      _flushTimer = null;
      if (_pendingAdd <= 0 || !_client || !_connected) return;
      var toAdd   = parseFloat(_pendingAdd.toFixed(4));
      _pendingAdd = 0;
      _client.rpc('progressive_contribute', { add_amount: toAdd }).then(function (res) {
        if (res.error) console.warn('[Progressive] contribute error:', res.error.message);
      });
    }, 5000);
  }

  /* ═══════════════════════════════════════════════════════════════
     FORCE WIN CLAIM (unchanged from v1.3)
     ═══════════════════════════════════════════════════════════════ */
  function _claimForceWin(onClaimed, winPatterns) {
    if (!_forceCommandId || _forceClaimed) { onClaimed(false); return; }
    _forceClaimed = true;
    var hitAmt    = parseFloat(_localValue.toFixed(2));

    /* Derive the actual pattern(s) achieved + winner label for this hit record.
       winPatterns always provided (natural Lazy-T win from armAndClaim).
       v5.115: operator Force Jackpot removed — fallback 'Force Jackpot'
       label kept as safety net only, should never fire in normal play. */
    var _winnerLabel = _playerNickname || _playerLabel || _sessionKey;
    var _patternName, _winPatternsStr;
    if (winPatterns && winPatterns.length) {
      _winPatternsStr = winPatterns.map(function(p){return p.name;}).join(', ');
      var _progP = null;
      for (var _wpi=0; _wpi<winPatterns.length; _wpi++){
        if (winPatterns[_wpi].isProgressive){ _progP=winPatterns[_wpi]; break; }
      }
      _patternName = (_progP && _progP.name) || 'Lazy-T';
    } else {
      _patternName    = 'Force Jackpot';
      _winPatternsStr = 'Force Jackpot';
    }

    var _cfwCalled=false;
    function _onceClaimed(didWin,amt){
      if(_cfwCalled) return; _cfwCalled=true; onClaimed(didWin,amt);
    }
    var _safetyTimer = setTimeout(function () {
      _forceClaimed = false; _forceArmed = false; _forceCommandId = null;
      _onceClaimed(false);
    }, 8000);

    _client.from('progressive_commands')
      .update({
        status: 'won', winner_session: _sessionKey,
        winner_game: PROG_GAME_ID, winner_amt: hitAmt,
        winner_label: _winnerLabel,
        won_at: new Date().toISOString()
      })
      .eq('id', _forceCommandId).eq('status', 'armed').select()
      .then(function (res) {
        if (res.error || !res.data || !res.data.length) {
          clearTimeout(_safetyTimer);
          _forceClaimed   = false;
          /* 0 rows matched: command was won by someone else or cancelled —
             either way it's no longer claimable. Clear armed state so we
             don't keep retrying this dead command every spin. */
          _forceArmed     = false;
          _forceCommandId = null;
          _onceClaimed(false);
          return;
        }
        /* v5.90: claim succeeded — clear armed state immediately so the
           NEXT spin doesn't think a force_jackpot is still armed.
           contribute() returns _forceArmed directly (no _forceClaimed
           check) to determine _biasedBalls=24 for genBiasedBingoCard —
           without this reset, every subsequent spin would keep biasing
           toward a 24-ball Cover-All, making BG._coverAll1to40 true
           almost every spin and firing _requestNewWABCSequence()
           repeatedly (racing with the next spin's doBingoSpin and
           corrupting BG.callSeq/matchedCells — the "2nd spin freeze /
           blank card / ball call cells" bug). */
        _forceArmed     = false;
        _forceCommandId = null;
        _client.rpc('progressive_hit', { reset_to: _seed }).then(function (rpcRes) {
          /* Supabase RPC errors resolve with {error:...}, NOT a rejected
             promise — must check explicitly or a failed server-side reset
             goes completely unnoticed, leaving the DB pot unchanged while
             this client falsely believes it reset (until the next periodic
             _fetchRow overwrites _localValue back to the stale DB value). */
          if (rpcRes && rpcRes.error) {
            console.warn('[Progressive] progressive_hit RPC FAILED — pot NOT reset server-side:', rpcRes.error.message);
          }
          /* Small delay to ensure RPC transaction commits before insert */
          setTimeout(function() {
            _client.from('progressive_hits').insert({
              game_id:        PROG_GAME_ID,
              denom:          PROG_DENOM,
              amount:         hitAmt,
              pattern:        _patternName,
              balls:          0,
              bet:            0,
              player_session: _sessionKey,
              player_label:   _winnerLabel,
              game_title:     PROG_GAME_TITLES[PROG_GAME_ID] || PROG_GAME_ID,
              win_patterns:   _winPatternsStr
            }).then(function(r) {
              if (r.error) console.warn('[Progressive] _claimForceWin hit insert error:', r.error.message);
            });
          }, 500);
          clearTimeout(_safetyTimer);
          _justWon = true;
          setTimeout(function () { _justWon = false; }, 5000);
          _localValue = _seed; _notifyValue();
          _forceArmed = false; _forceCommandId = null;
          _onceClaimed(true, hitAmt);
        }).catch(function () {
          clearTimeout(_safetyTimer);
          _justWon = true;
          setTimeout(function () { _justWon = false; }, 5000);
          _localValue = _seed; _notifyValue();
          _forceArmed = false; _forceCommandId = null;
          _onceClaimed(true, hitAmt);
        });
      }).catch(function () {
        clearTimeout(_safetyTimer);
        _forceClaimed   = false;
        _forceArmed     = false;
        _forceCommandId = null;
        _onceClaimed(false);
      });
  }

  /* ═══════════════════════════════════════════════════════════════
     PUBLIC API
     ═══════════════════════════════════════════════════════════════ */

  function init(onReady) {
    _loadSDK(function () {
      if (!window.supabase) {
        /* SDK failed to load — full offline mode */
        console.warn('[Progressive] Full offline mode — no DB connection');
        _goLocalMode();
        _startConnMonitor();
        if (onReady) onReady();
        return;
      }
      try {
        _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: { persistSession: false, detectSessionInUrl: false,
            storage: {
              getItem: function(key){ return null; },
              setItem: function(key,value){},
              removeItem: function(key){}
            }
          }
        });
        /* _connected set AFTER DB responds — not before */
        _fetchRow(function () {
          if (!_localValue || _localValue === 500) {
            /* _fetchRow succeeded — we have live data */
          }
          _connected = true;
          _subscribeValue();
          _subscribeHits();
          _subscribePresence();
          /* _subscribeBallCall removed v5.39 — WABC Broadcast handles ball position */
          _subscribeMessages();
          _checkUnreadMessages();
          setInterval(function () { _fetchRow(null); }, 60000);
          _startConnMonitor();
          if (onReady) onReady();
        });
      } catch (e) {
        console.warn('[Progressive] init failed:', e);
        _connected = false;
        _goLocalMode();
        if (onReady) onReady();
      }
    });
  }

  function contribute(betAmt) {
    if (!betAmt || betAmt <= 0) return false;
    var addition = betAmt * _contribRate;
    if (_localMode) {
      /* Offline — grow local pot only, no DB write */
      _localPotValue = Math.min(_localPotValue + addition, _localPotCeiling);
      _notifyValue(); /* meter shows local value */
      return false;   /* never armed when offline */
    }
    _localValue = Math.min(_localValue + addition, _ceiling);
    _notifyValue();
    if (_connected && _client) {
      _pendingAdd += addition;
      _scheduleFlush();
    }

    /* v5.115: _forceArmed return removed — contribute() no longer used
       to trigger Force Jackpot. Kept as no-op return for API compat. */
    return false;
  }

  function hit(info, onDone) {
    if (_localMode) {
      /* Offline local win — pay local pot, reset to local seed, no DB write */
      var hitAmt = parseFloat(_localPotValue.toFixed(2));
      _localPotValue = _localPotSeed;
      _notifyValue();
      console.log('[Progressive] LOCAL WIN: $' + hitAmt.toFixed(2) + ' — wide area pot unaffected');
      if (onDone) onDone(hitAmt);
      return hitAmt;
    }
    var hitAmt  = parseFloat(_localValue.toFixed(2));
    _localValue = _seed;
    _notifyValue();
    _justWon = true;
    setTimeout(function () { _justWon = false; }, 5000);

    var patternNames = (info && info.patterns)
      ? info.patterns.join(', ')
      : ((info && info.pattern) ? info.pattern : 'Lazy-T');

    if (!_connected || !_client) {
      if (onDone) onDone(hitAmt);
      return hitAmt;
    }

    var rec = {
      game_id:        PROG_GAME_ID,
      denom:          PROG_DENOM,
      amount:         hitAmt,
      pattern:        (info && info.pattern) ? info.pattern : 'Lazy-T',
      balls:          (info && info.balls)   ? info.balls   : 0,
      bet:            (info && info.bet)     ? info.bet     : 0,
      player_session: _sessionKey,
      player_label:   _playerNickname || _playerLabel || _sessionKey,
      game_title:     PROG_GAME_TITLES[PROG_GAME_ID] || PROG_GAME_ID,
      win_patterns:   patternNames
    };

    var _hitSafety = onDone ? setTimeout(function () {
      console.warn('[Progressive] hit() DB timeout');
      if (onDone) { onDone(hitAmt); onDone = null; }
    }, 8000) : null;

    _client.rpc('progressive_hit', { reset_to: _seed })
      .then(function (rpcRes) {
        if (rpcRes.error) console.warn('[Progressive] hit RPC error:', rpcRes.error.message);
        /* Delay insert to ensure RPC transaction commits first */
        setTimeout(function() {
          _client.from('progressive_hits').insert(rec).then(function(r) {
            if (r.error) console.warn('[Progressive] hit() insert error:', r.error.message);
          });
        }, 500);
        setTimeout(function () { _fetchRow(null); }, 1000);
        if (_hitSafety) clearTimeout(_hitSafety);
        if (onDone) { onDone(hitAmt); onDone = null; }
      })
      .catch(function () {
        _client.from('progressive_hits').insert(rec);
        if (_hitSafety) clearTimeout(_hitSafety);
        if (onDone) { onDone(hitAmt); onDone = null; }
      });

    return hitAmt;
  }

  /* ═══════════════════════════════════════════════════════════════
     BROADCAST MESSAGES (unchanged from v1.3)
     ═══════════════════════════════════════════════════════════════ */
  var _messageListeners  = [];
  var _onForceNotifyListeners = [];
  var _lastSeenMessageId = 0;
  var _SEEN_KEY          = 'prog_last_msg_' + PROG_GAME_ID;

  function _loadLastSeen() {
    try { var v = localStorage.getItem(_SEEN_KEY); if (v) _lastSeenMessageId = parseInt(v, 10) || 0; } catch(e) {}
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
  function _subscribeMessages() {
    _client.channel('broadcast-messages')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'broadcast_messages'
      }, function(p) { if (p.new) _notifyMessage(p.new); })
      .subscribe();
  }
  function _checkUnreadMessages() {
    _loadLastSeen();
    /* Only replay messages from the last 30 minutes — prevents players
       who were offline for hours/days from receiving a backlog of stale
       Cover All or system notifications that are no longer relevant.
       Cover All events no longer insert into broadcast_messages (v6.0),
       but this age guard protects against any historical rows and future
       message types that should not replay on login. */
    var _cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    _client.from('broadcast_messages').select('*')
      .gt('id', _lastSeenMessageId)
      .gt('created_at', _cutoff)
      .not('type', 'in', '("force_local_ball","restore_wide_ball")')
      .order('id', { ascending: true })
      .then(function(res) {
        if (res.error || !res.data || !res.data.length) return;
        /* Cap replay at 3 messages max — never flood a newly-connecting
           player with a long queue of banners regardless of how many
           legitimate messages accumulated while they were away. */
        var _msgs = res.data.slice(0, 3);
        _msgs.forEach(function(msg, i) {
          setTimeout(function() { _notifyMessage(msg); }, i * 4000);
        });
      });
  }

  /*
   * armAndClaim(onResult)
   * Called when bingo engine detects natural Cover All in <=25 balls.
   * Inserts a force_jackpot command directly (atomic) then claims it
   * using the returned ID — no Realtime timing dependency.
   * onResult(didWin, amount) always fires:
   *   didWin=true  — player won full pot
   *   didWin=false — another player won first, pays seed amount
   * ES5-safe.
   */
  function armAndClaim(winPatterns, onResult) {
    if (_localMode) {
      var _localAmt = parseFloat(_localPotValue.toFixed(2));
      _localPotValue = _localPotSeed;
      _notifyValue();
      if (onResult) onResult(true, _localAmt);
      return;
    }
    if (!_connected || !_client) {
      /* No DB connection — pay out the current local pot value, then reset
         the LOCAL display to seed so the meter doesn't appear "stuck" at
         the old amount. Server-side reset can't happen without a
         connection, but the player's own display should still be correct. */
      var _offlineAmt = parseFloat(_localValue.toFixed(2));
      _localValue = _seed; _notifyValue();
      if (onResult) onResult(true, _offlineAmt);
      return;
    }
    /* Safety timeout — never lock the game */
    var _armed = false;
    var _safetyTimer = setTimeout(function() {
      if (_armed) return;
      console.warn('[Progressive] armAndClaim safety timeout — paying local value');
      _armed = true;
      if (onResult) onResult(true, parseFloat(_localValue.toFixed(2)));
    }, 5000);

    /* Race guard: if another player's natural Lazy-T hit already armed a
       progressive_commands row before this player's spin completes, claim
       THAT existing command instead of inserting a duplicate. Prevents two
       simultaneous natural Lazy-T winners both inserting competing rows.
       v5.115: operator Force Jackpot removed — this guard is now solely
       for simultaneous natural-hit race protection. */
    if (_forceArmed && _forceCommandId && !_forceClaimed) {
      _claimForceWin(function(didWin, claimedAmt) {
        clearTimeout(_safetyTimer); _armed = true;
        if (onResult) onResult(didWin ? true : false,
          didWin ? claimedAmt : parseFloat(_seed.toFixed(2)));
      }, winPatterns);
      return;
    }

    /* Insert armed command directly — get ID from response for immediate claim */
    _client.from('progressive_commands').insert({
      command:     'force_jackpot',
      status:      'armed',
      winner_game: PROG_GAME_ID,
      created_by:  _playerLabel || _sessionKey
    }).select().then(function(res) {
      if (res.error || !res.data || !res.data.length) {
        /* Insert failed — another player may have just armed. Try to find it. */
        console.warn('[Progressive] armAndClaim insert error:', res.error && res.error.message);
        _client.from('progressive_commands')
          .select('*').eq('status', 'armed').eq('command', 'force_jackpot')
          .limit(1).then(function(r2) {
            if (r2.error || !r2.data || !r2.data.length) {
              clearTimeout(_safetyTimer); _armed = true;
              if (onResult) onResult(false, parseFloat(_seed.toFixed(2)));
              return;
            }
            _forceCommandId = r2.data[0].id;
            _forceArmed = true; _forceClaimed = false;
            _claimForceWin(function(didWin, claimedAmt) {
              clearTimeout(_safetyTimer); _armed = true;
              if (onResult) onResult(didWin ? true : false,
                didWin ? claimedAmt : parseFloat(_seed.toFixed(2)));
            }, winPatterns);
          }).catch(function() {
            clearTimeout(_safetyTimer); _armed = true;
            if (onResult) onResult(false, parseFloat(_seed.toFixed(2)));
          });
        return;
      }
      /* We inserted it — use returned ID to claim immediately */
      _forceCommandId = res.data[0].id;
      _forceArmed = true; _forceClaimed = false;
      _claimForceWin(function(didWin, claimedAmt) {
        clearTimeout(_safetyTimer); _armed = true;
        if (onResult) onResult(didWin ? true : false,
          didWin ? claimedAmt : parseFloat(_seed.toFixed(2)));
      }, winPatterns);
    }).catch(function(err) {
      clearTimeout(_safetyTimer); _armed = true;
      console.warn('[Progressive] armAndClaim catch:', err);
      if (onResult) onResult(true, parseFloat(_localValue.toFixed(2)));
    });
  }

  /* ── Accessors ── */
  function mustHit()            { return _localMode ? (_localPotValue >= _localPotCeiling) : (_localValue >= _ceiling); }
  function getDisplay()         { var v = _localMode ? _localPotValue : _localValue; return '$' + v.toFixed(2); }
  function getValue()           { return _localMode ? _localPotValue : _localValue; }
  function isLocalMode()        { return _localMode; }
  function isConnected()        { return _connected; }
  function getPresenceCount()   { return _presenceCount; }
  function isForceArmed()       { return _forceArmed; }
  function getSessionKey()      { return _sessionKey; }
  function getPlayerNum()       { return _playerNum; }
  function getPlayerLabel()     { return _playerLabel; }
  function isUsingServerBalls() { return _usingServerBalls; }

  function onChange(fn)         { _valueListeners.push(fn); fn(_localValue); }
  function onPresenceChange(fn) { _presenceListeners.push(fn); fn(_presenceCount); }
  function onMessage(fn)        { _messageListeners.push(fn); }
  function onForceNotify(fn)    { if (typeof fn==='function') _onForceNotifyListeners.push(fn); }
  function onBallCallUpdate(fn) { _ballCallListeners.push(fn); }

  return {
    init:               init,
    contribute:         contribute,
    armAndClaim:        armAndClaim,
    hit:                hit,
    updateLastSpin:     updateLastSpin,
    registerPlayer:     registerPlayer,
    mustHit:            mustHit,
    getDisplay:         getDisplay,
    getValue:           getValue,
    isConnected:        isConnected,
    isForceArmed:       isForceArmed,
    getPresenceCount:   getPresenceCount,
    getSessionKey:      getSessionKey,
    getPlayerNickname:  function() { return _playerNickname; },
    isLocalMode:        isLocalMode,
    _getClient:         function() { return _client; },
    updateBallPos:      updateBallPos,
    getPlayerNum:       getPlayerNum,
    getPlayerLabel:     getPlayerLabel,
    isUsingServerBalls: isUsingServerBalls,
    onChange:           onChange,
    onPresenceChange:   onPresenceChange,
    onMessage:          onMessage,
    onForceNotify:      onForceNotify,
    onBallCallUpdate:   onBallCallUpdate,
    onConnChange:       function(fn) { _connChangeListeners.push(fn); }
  };
}());
