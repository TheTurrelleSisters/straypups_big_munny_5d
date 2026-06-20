/*
 * wabc.js — Wide Area Ball Caller client library
 * Stray-Pup LLC / The Turrelle Sisters LLC
 * v1.0
 *
 * WHAT THIS FILE DOES:
 *   Subscribes to the 'wabc-ballpos' Supabase Broadcast channel.
 *   Receives ball position advances from operator WITHOUT any postgres writes.
 *   Exposes a simple public API for game clients to consume.
 *
 * ARCHITECTURE:
 *   Ball position is broadcast over Supabase Broadcast (not postgres_changes).
 *   This eliminates ~2-3 DB writes/second per active game and prevents the
 *   CDC replication pool from being overwhelmed.
 *   The ball_call table in postgres is only written when:
 *     - A new sequence is issued  (once per 75 balls)
 *     - Ball position is reset    (operator action)
 *     - Force local / restore     (operator action)
 *
 * INSTALLATION:
 *   1. Drop wabc.js into the game repo root (same folder as progressive.js)
 *   2. In index.html, load it AFTER the Supabase SDK and BEFORE your game JS:
 *        <script src="wabc.js?v=1.0"></script>
 *   3. Progressive.js must already be loaded — WABC reuses its Supabase client
 *      via window._wabcSupabaseClient (set by progressive.js v1.7+) or
 *      falls back to creating its own client with the same credentials.
 *
 * PUBLIC API:
 *   WABC.init(onReady)           — connect and fetch initial state
 *   WABC.getSequence()           → array[75]
 *   WABC.getBallPos()            → integer 0-74
 *   WABC.getNextBall()           → integer (the ball at current pos)
 *   WABC.isLocalMode()           → boolean (true = operator forced local)
 *   WABC.onChange(fn)            — called every time ball pos advances
 *   WABC.onNewCall(fn)           — called when operator issues new sequence
 *   WABC.onForceLocal(fn)        — called when operator forces local mode
 *   WABC.onRestoreWide(fn)       — called when operator restores wide mode
 *
 * ES5 only. No arrow functions. No const/let. No backticks. No async/await.
 */

var WABC = (function() {

  var SUPABASE_URL      = 'https://gdmmoeggkqsvqnqyrubx.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkbW1vZWdna3FzdnFucXlydWJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4MDYzNTQsImV4cCI6MjA5NjM4MjM1NH0.i86afL3CMpmru4z3LZAbCJkxBiwo25QbwEji8tDBAis';

  /* Private state */
  var _client        = null;
  var _channel       = null;
  var _sequence      = [];
  var _ballPos       = 0;
  var _posProvider   = null;  /* fn() -> current ball position if this player is actively calling */
  var _syncResolved  = false; /* true once a sync_response has been applied */
  var _syncListeners = [];
  var _issuedAt      = null;
  var _localMode     = false;
  var _changeListeners     = [];
  var _newCallListeners    = [];
  var _forceLocalListeners = [];
  var _restoreListeners    = [];
  var _reconnectTimer      = null;
  var _reconnectDelay      = 2000;

  /* ── SDK LOADER ── */
  function _loadSDK(cb) {
    /* Prefer the client already created by progressive.js */
    if (window._wabcSupabaseClient) { _client = window._wabcSupabaseClient; cb(); return; }
    if (typeof window !== 'undefined' && window.supabase) { cb(); return; }
    var attempts = 0;
    var poll = setInterval(function() {
      attempts++;
      if (window._wabcSupabaseClient) { clearInterval(poll); _client = window._wabcSupabaseClient; cb(); return; }
      if (window.supabase)            { clearInterval(poll); cb(); return; }
      if (attempts >= 50) {
        clearInterval(poll);
        var s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
        s.onload  = cb;
        s.onerror = function() { console.warn('[WABC] SDK load failed.'); };
        document.head.appendChild(s);
      }
    }, 100);
  }

  /* ── NOTIFY HELPERS ── */
  function _notifyChange()     { for (var i=0;i<_changeListeners.length;i++)     { try{_changeListeners[i](_ballPos,_sequence);}catch(e){} } }
  function _notifyNewCall()    { for (var i=0;i<_newCallListeners.length;i++)    { try{_newCallListeners[i](_sequence,_issuedAt);}catch(e){} } }
  function _notifyForceLocal() { for (var i=0;i<_forceLocalListeners.length;i++) { try{_forceLocalListeners[i]();}catch(e){} } }
  function _notifyRestore()    { for (var i=0;i<_restoreListeners.length;i++)    { try{_restoreListeners[i](_sequence,_issuedAt);}catch(e){} } }
  function _notifySyncResponse(pos) { for (var i=0;i<_syncListeners.length;i++) { try{_syncListeners[i](pos);}catch(e){} } }

  /* ── INITIAL STATE FETCH ── */
  function _fetchInitial(cb) {
    /* Use maybeSingle() — .single() throws error when WABC row missing,
       causing empty sequence and game falling back to local ball call */
    _client.from('ball_call')
      .select('sequence, ball_pos, issued_at')
      .eq('game_id', 'WABC')
      .maybeSingle()
      .then(function(res) {
        if (res.error) {
          console.warn('[WABC] _fetchInitial error:', res.error.message);
          if (cb) cb();
          return;
        }
        if (res.data) {
          _sequence  = res.data.sequence  || [];
          _ballPos   = res.data.ball_pos  || 0;
          _issuedAt  = res.data.issued_at || null;
        } else {
          /* Row missing — request new sequence so all players get one */
          console.warn('[WABC] No WABC row found — requesting new sequence');
          if (_client) {
            _client.rpc('upsert_ball_call', { p_game_id: 'WABC' })
              .then(function(r) {
                if (!r.error && r.data) {
                  _sequence = r.data.sequence  || [];
                  _ballPos  = 0;
                  _issuedAt = r.data.issued_at || new Date().toISOString();
                }
                if (cb) cb();
              }).catch(function() { if (cb) cb(); });
            return;
          }
        }
        if (cb) cb();
      }).catch(function(err) {
        console.warn('[WABC] _fetchInitial catch:', err);
        if (cb) cb();
      });
  }

  /* ── BROADCAST SUBSCRIBE ── */
  function _subscribe() {
    /* removeChannel() is ASYNC (returns a Promise) — creating a new
       channel with the SAME topic name ('wabc-ballpos') before the old
       one has fully left causes Supabase Realtime to reject the new join
       (CHANNEL_ERROR), then close the old one shortly after (CLOSED),
       triggering an endless reconnect loop. Await removal first. */
    if (_channel) {
      var _oldChannel = _channel;
      _channel = null;
      try {
        var _rm = _client.removeChannel(_oldChannel);
        if (_rm && typeof _rm.then === 'function') {
          _rm.then(_doSubscribe).catch(_doSubscribe);
          return;
        }
      } catch(e) {}
    }
    _doSubscribe();
  }

  function _doSubscribe() {
    _channel = _client.channel('wabc-ballpos', {
      config: { broadcast: { self: false } }
    });

    _channel
      .on('broadcast', { event: 'pos' }, function(msg) {
        if (!msg || !msg.payload) return;
        var p = msg.payload;
        /* Guard: ignore pos events from a different sequence.
           Normalize both timestamps before comparing — Postgres returns
           "2026-06-20 00:33:58+00" while REST API returns
           "2026-06-20T00:33:58+00:00". Strip to first 19 chars for comparison. */
        if (p.seq_issued_at && _issuedAt) {
          var _pNorm = String(p.seq_issued_at).replace('T',' ').substr(0,19);
          var _iNorm = String(_issuedAt).replace('T',' ').substr(0,19);
          if (_pNorm !== _iNorm) return;
        }
        _ballPos = parseInt(p.pos, 10) || 0;
        _notifyChange();
      })
      .on('broadcast', { event: 'new_call' }, function(msg) {
        if (!msg || !msg.payload) return;
        _sequence = msg.payload.sequence  || [];
        _ballPos  = 0;
        _issuedAt = msg.payload.issued_at || new Date().toISOString();
        _notifyNewCall();
        _notifyChange();
      })
      .on('broadcast', { event: 'sync_request' }, function(msg) {
        /* A newly-joined player is asking who's actively calling.
           If WE are actively calling (BG.entTimer running via game.js),
           respond with our current ball position so they can catch up. */
        if (typeof _posProvider === 'function') {
          var pos = _posProvider();
          if (pos !== null && pos !== undefined && pos > 0 && _channel) {
            _channel.send({
              type: 'broadcast', event: 'sync_response',
              payload: { pos: pos, seq_issued_at: _issuedAt }
            });
          }
        }
      })
      .on('broadcast', { event: 'sync_response' }, function(msg) {
        /* Another player answered our sync_request with their live position. */
        if (!msg || !msg.payload || _syncResolved) return;
        var p = msg.payload;
        if (p.seq_issued_at && _issuedAt) {
          var _pNorm = String(p.seq_issued_at).replace('T',' ').substr(0,19);
          var _iNorm = String(_issuedAt).replace('T',' ').substr(0,19);
          if (_pNorm !== _iNorm) return;
        }
        var pos = parseInt(p.pos, 10) || 0;
        if (pos > _ballPos) {
          _ballPos = pos;
          _syncResolved = true;
          _notifyChange();
          _notifySyncResponse(pos);
        }
      })
      .on('broadcast', { event: 'reset_pos' }, function() {
        _ballPos = 0;
        _notifyChange();
      })
      .on('broadcast', { event: 'force_local' }, function() {
        _localMode = true;
        _notifyForceLocal();
      })
      .on('broadcast', { event: 'restore_wide' }, function(msg) {
        _localMode = false;
        if (msg && msg.payload && msg.payload.sequence) {
          _sequence = msg.payload.sequence;
          _ballPos  = 0;
          _issuedAt = msg.payload.issued_at || new Date().toISOString();
        }
        _notifyRestore();
        _notifyChange();
      })
      .subscribe(function(status) {
        if (status === 'SUBSCRIBED') {
          _reconnectDelay = 2000;
          if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
          /* Re-fetch sequence on reconnect. Only notify new_call if
             issued_at changed (genuinely new sequence) — not on every
             reconnect, which was causing ball strip to fill pre-spin. */
          var _prevIssuedAt = _issuedAt;
          _fetchInitial(function() {
            if (_issuedAt !== _prevIssuedAt) {
              _notifyNewCall(); /* new sequence issued while disconnected */
            }
            console.log('[WABC] Reconnected — sequence re-fetched, pos=' + _ballPos);
          });
          console.log('[WABC] Broadcast channel connected');
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn('[WABC] Channel ' + status + ' — reconnecting in ' + (_reconnectDelay/1000) + 's');
          _scheduleReconnect();
        }
      });
  }

  function _scheduleReconnect() {
    if (_reconnectTimer) return;
    var delay = _reconnectDelay;
    _reconnectDelay = Math.min(_reconnectDelay * 2, 30000);
    _reconnectTimer = setTimeout(function() {
      _reconnectTimer = null;
      if (_client) _subscribe();
    }, delay);
  }

  /* ══ PUBLIC API ══ */

  function init(onReady) {
    _loadSDK(function() {
      if (!_client) {
        try { _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: { persistSession: false, detectSessionInUrl: false,
            storage: {
              getItem: function(key){ return null; },
              setItem: function(key,value){},
              removeItem: function(key){}
            }
          }
        }); }
        catch(e) { console.warn('[WABC] init failed:', e); if (onReady) onReady(); return; }
      }
      _fetchInitial(function() {
        _subscribe();
        /* Expose channel so game can broadcast new_call on sequence exhaustion */
        window._wabcChannel = _channel;
        /* Ask any actively-calling players for their current position so we
           join mid-sequence instead of always starting at ball 40. Small
           delay lets the channel finish subscribing first. */
        setTimeout(function() {
          if (_channel && !_syncResolved) {
            _channel.send({
              type: 'broadcast', event: 'sync_request',
              payload: { seq_issued_at: _issuedAt }
            });
          }
        }, 400);
        if (onReady) onReady();
      });
    });
  }

  function getSequence()  { return _sequence; }
  function getBallPos()   { return _ballPos; }
  function getNextBall()  { return (_sequence && _ballPos < _sequence.length) ? _sequence[_ballPos] : null; }
  function isLocalMode()  { return _localMode; }

  function onChange(fn)        { _changeListeners.push(fn); }
  function onNewCall(fn)       { _newCallListeners.push(fn); }
  function onForceLocal(fn)    { _forceLocalListeners.push(fn); }
  function onRestoreWide(fn)   { _restoreListeners.push(fn); }
  function onSyncResponse(fn)  { _syncListeners.push(fn); }
  function setPosProvider(fn)  { _posProvider = fn; }

  /* applyLocalNewCall — for the player who TRIGGERED a new sequence
     (e.g. via upsert_ball_call on Cover All). The 'wabc-ballpos' channel
     is broadcast.self=false, so this player never receives their own
     new_call broadcast and onNewCall() never fires for them. Without
     this, their internal _issuedAt stays stale, and the 'pos' broadcast
     guard (which drops any event whose seq_issued_at doesn't match
     _issuedAt) silently filters out every future ball-position update,
     freezing their strip at ball 40 even though they're not "awaiting".
     Caller is responsible for its own UI update — this only syncs the
     internal state used by the seq_issued_at guard, and does NOT fire
     the onNewCall listeners (the caller already handled its own UI). */
  function applyLocalNewCall(sequence, issuedAt) {
    if (!sequence || sequence.length !== 75) return;
    _sequence  = sequence;
    _ballPos   = 0;
    _issuedAt  = issuedAt || new Date().toISOString();
  }

  return {
    init:          init,
    getSequence:   getSequence,
    getBallPos:    getBallPos,
    getNextBall:   getNextBall,
    isLocalMode:   isLocalMode,
    onChange:      onChange,
    onNewCall:     onNewCall,
    onForceLocal:  onForceLocal,
    onRestoreWide: onRestoreWide,
    onSyncResponse: onSyncResponse,
    setPosProvider: setPosProvider,
    applyLocalNewCall: applyLocalNewCall
  };

}());
