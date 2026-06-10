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
  var SUPABASE_ANON_KEY = 'sb_publishable_NGsKBAUUsVUvD5XKTblIdw_aBDPldSd';

  /* Private state */
  var _client        = null;
  var _channel       = null;
  var _sequence      = [];
  var _ballPos       = 0;
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

  /* ── INITIAL STATE FETCH ── */
  function _fetchInitial(cb) {
    _client.from('ball_call')
      .select('sequence, ball_pos, issued_at')
      .eq('game_id', 'WABC')
      .single()
      .then(function(res) {
        if (!res.error && res.data) {
          _sequence  = res.data.sequence  || [];
          _ballPos   = res.data.ball_pos  || 0;
          _issuedAt  = res.data.issued_at || null;
        }
        if (cb) cb();
      });
  }

  /* ── BROADCAST SUBSCRIBE ── */
  function _subscribe() {
    if (_channel) {
      try { _client.removeChannel(_channel); } catch(e) {}
      _channel = null;
    }

    _channel = _client.channel('wabc-ballpos', {
      config: { broadcast: { self: false } }
    });

    _channel
      .on('broadcast', { event: 'pos' }, function(msg) {
        if (!msg || !msg.payload) return;
        var p = msg.payload;
        /* Guard: ignore stale sequence updates */
        if (p.seq_issued_at && _issuedAt && p.seq_issued_at !== _issuedAt) return;
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
        try { _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); }
        catch(e) { console.warn('[WABC] init failed:', e); if (onReady) onReady(); return; }
      }
      _fetchInitial(function() {
        _subscribe();
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

  return {
    init:          init,
    getSequence:   getSequence,
    getBallPos:    getBallPos,
    getNextBall:   getNextBall,
    isLocalMode:   isLocalMode,
    onChange:      onChange,
    onNewCall:     onNewCall,
    onForceLocal:  onForceLocal,
    onRestoreWide: onRestoreWide
  };

}());
