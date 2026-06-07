'use strict';
/**
 * audio.js — The Turrelle Sisters Big Munny v8.1.3
 * ES5 COMPLIANT — no const/let/arrow functions (Rule 14 + Samsung Browser compatibility)
 *
 * FILE MAP:
 *   theme_music.mp3      → base game background loop
 *   red_spin_music.mp3   → red spin bonus loop
 *   pick_music.mp3       → pick & choose background loop
 *   credits_addup.wav    → credit rollup tick
 *   pick_reveal.wav      → pick & choose tile reveal
 *   splash_welcome.wav   → splash screen welcome (on tap)
 *   ring1.mp3            → bell (jackpots, red spin entry, win bells)
 */

var Audio = (function() {
  var ctx = null, masterGain = null;
  var muted = false, volumeLevel = 0.50;
  var musicMuted = false; // v8.1.53: theme-only mute — independent of full mute

  var bgLoop = null, redLoop = null, holdLoop = null, pickLoop = null;
  var jpBellTimer = null;

  var mp3 = {};

  // ── INIT ─────────────────────────────────────────────────────────
  function init() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = volumeLevel;
      masterGain.connect(ctx.destination);
    } catch(e) { console.warn('[Audio] WebAudio init failed:', e); }

    _load('ring1',          'assets/audio/ring1.mp3');
    _load('theme',          'assets/audio/theme_music.mp3',    true);
    _load('red_spin',       'assets/audio/red_spin_music.mp3', true);
    _load('pick_bg',        'assets/audio/pick_music.mp3',     true);
    _load('credits_addup',  'assets/audio/credits_addup.wav');
    _load('pick_reveal',    'assets/audio/pick_reveal.wav');
    _load('splash_welcome', 'assets/audio/splash_welcome.wav');
  }

  function _load(key, src, loop) {
    if (loop === undefined) loop = false;
    try {
      var el = document.createElement('audio');
      el.src = src;
      el.preload = 'auto';
      el.loop = loop;
      el.volume = volumeLevel;
      mp3[key] = el;
    } catch(e) { console.warn('[Audio] Load failed:', key, e); }
  }

  function _play(key, vol) {
    if (vol === undefined) vol = 1.0;
    var el = mp3[key];
    if (!el || muted) return null;
    try {
      var clone = el.loop ? el : el.cloneNode();
      clone.volume = Math.min(1, volumeLevel * vol);
      var p = clone.play();
      if (p && p.catch) p.catch(function() {});
      return clone;
    } catch(e) { return null; }
  }

  // ── VOLUME / MUTE ─────────────────────────────────────────────────
  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function setVolume(v) {
    volumeLevel = Math.max(0, Math.min(1, v));
    if (masterGain) masterGain.gain.value = muted ? 0 : volumeLevel * 0.85;
    var keys = Object.keys(mp3);
    for (var i = 0; i < keys.length; i++) {
      var el = mp3[keys[i]];
      if (!el) continue;
      if (keys[i] === 'theme') {
        el.volume = volumeLevel * 0.40;
      } else {
        el.volume = muted ? 0 : Math.min(1, volumeLevel * 0.40);
      }
    }
  }

  function setMuted(v) {
    muted = v;
    if (masterGain) masterGain.gain.value = v ? 0 : volumeLevel * 0.85;
    var keys = Object.keys(mp3);
    for (var i = 0; i < keys.length; i++) {
      var el = mp3[keys[i]];
      if (el) el.volume = v ? 0 : volumeLevel;
    }
  }

  function getMuted() { return muted; }

  function toggleMute() {
    muted = !muted;
    setMuted(muted);
    return muted;
  }

  // ── WEB AUDIO SYNTH HELPERS ───────────────────────────────────────
  function _tone(freq, type, t0, t1, vol, endVol) {
    if (vol === undefined) vol = 0.35;
    if (endVol === undefined) endVol = 0.001;
    if (!ctx || muted) return;
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol * volumeLevel, t0);
    g.gain.exponentialRampToValueAtTime(endVol, t1);
    o.connect(g); g.connect(masterGain);
    o.start(t0); o.stop(t1);
  }

  function _noise(dur, t0, vol, freq) {
    if (vol === undefined) vol = 0.2;
    if (freq === undefined) freq = 800;
    if (!ctx || muted) return;
    var buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    var d   = buf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 0.8;
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol * volumeLevel, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(bp); bp.connect(g); g.connect(masterGain);
    src.start(t0); src.stop(t0 + dur);
  }

  // ── BELL SYSTEM ───────────────────────────────────────────────────
  function playBellsForWin(winAmount) {
    if (muted || winAmount <= 0) return;
    var ringCount = 0;
    if      (winAmount >= 1000) ringCount = 10;
    else if (winAmount >= 100)  ringCount = 3;
    else if (winAmount >= 50)   ringCount = 2;
    else if (winAmount >= 10)   ringCount = 1;
    if (ringCount === 0) return;
    for (var i = 0; i < ringCount; i++) {
      (function(idx) {
        setTimeout(function() { _play('ring1', 0.55); }, idx * 0);
      })(i);
    }
  }

  function playBellsForBonus() {
    if (muted) return;
    _play('ring1', 0.55);
  }

  function startJackpotBells() {
    stopJackpotBells();
    jpBellTimer = setInterval(function() { _play('ring1', 0.40); }, 150);
  }

  function stopJackpotBells() {
    if (jpBellTimer) { clearInterval(jpBellTimer); jpBellTimer = null; }
  }

  // ── SOUND EVENTS ──────────────────────────────────────────────────
  var sounds = {
    spin: function() {
      if (!ctx) return;
      var t = ctx.currentTime;
      _noise(0.22, t, 0.28, 1100);
      _tone(240, 'sawtooth', t, t + 0.18, 0.22, 0.001);
    },
    reel_stop: function() {
      if (!ctx) return;
      var t = ctx.currentTime;
      _tone(160, 'square', t, t + 0.04, 0.25, 0.01);
      _noise(0.04, t, 0.15, 350);
    },
    win_small: function() {
      if (!ctx) return;
      var t = ctx.currentTime;
      var freqs = [523, 659, 784];
      for (var i = 0; i < freqs.length; i++) {
        _tone(freqs[i], 'sine', t + i * 0.1, t + i * 0.1 + 0.2, 0.30, 0.001);
      }
    },
    win_big: function() {
      if (!ctx) return;
      var t = ctx.currentTime;
      var freqs = [392, 523, 659, 784, 1047];
      for (var i = 0; i < freqs.length; i++) {
        _tone(freqs[i], 'sine', t + i * 0.09, t + i * 0.09 + 0.3, 0.38, 0.001);
      }
      setTimeout(function() { _play('ring1', 0.40); }, 500);
    },
    button_click: function() {
      if (!ctx) return;
      var t = ctx.currentTime;
      _tone(600, 'sine', t, t + 0.10, 0.55, 0.001);
    },
    red_spin_entry: function() {
      _play('ring1', 0.45);
      setTimeout(function() { _play('ring1', 0.40); }, 270);
      setTimeout(function() { _play('ring1', 0.35); }, 520);
      if (ctx) {
        var t = ctx.currentTime + 0.6;
        var o = ctx.createOscillator();
        var g = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(200, t);
        o.frequency.exponentialRampToValueAtTime(900, t + 0.35);
        g.gain.setValueAtTime(0.28 * volumeLevel, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        o.connect(g); g.connect(masterGain);
        o.start(t); o.stop(t + 0.35);
      }
    },
    coin_drop: function() {
      _play('credits_addup', 0.35);
    },
    pick_reveal: function() {
      _play('pick_reveal', 0.38);
    },
    pick_match: function() {
      _play('ring1', 0.38);
      if (!ctx) return;
      var t = ctx.currentTime + 0.1;
      var freqs = [523, 659, 784];
      for (var i = 0; i < freqs.length; i++) {
        _tone(freqs[i], 'sine', t + i * 0.1, t + i * 0.1 + 0.28, 0.38, 0.001);
      }
    },
    pick_trigger: function() {
      _play('ring1', 0.38);
    },
    bonus_trigger: function() {
      _play('ring1', 0.42);
      if (!ctx) return;
      var t = ctx.currentTime + 0.15;
      var freqs = [523, 659, 784, 988, 1047];
      for (var i = 0; i < freqs.length; i++) {
        _tone(freqs[i], 'sine', t + i * 0.1, t + i * 0.1 + 0.25, 0.32, 0.001);
      }
    },
    jackpot_mini: function() {
      _play('ring1', 0.38);
      if (!ctx) return;
      var t = ctx.currentTime;
      var freqs = [523, 659, 784, 1047];
      for (var i = 0; i < freqs.length; i++) {
        _tone(freqs[i], 'sine', t + i * 0.1, t + i * 0.1 + 0.28, 0.38, 0.001);
      }
    },
    jackpot_minor: function() {
      _play('ring1', 0.40);
      setTimeout(function() { _play('ring1', 0.38); }, 300);
      if (!ctx) return;
      var t = ctx.currentTime;
      var freqs = [392, 494, 587, 740, 880];
      for (var i = 0; i < freqs.length; i++) {
        _tone(freqs[i], 'sine', t + i * 0.1, t + i * 0.1 + 0.35, 0.42, 0.001);
      }
    },
    jackpot_major: function() {
      _play('ring1', 0.42);
      setTimeout(function() { _play('ring1', 0.40); }, 250);
      setTimeout(function() { _play('ring1', 0.38); }, 500);
      if (!ctx) return;
      var t = ctx.currentTime;
      var freqs = [261, 329, 392, 523, 659, 784, 1047];
      for (var i = 0; i < freqs.length; i++) {
        _tone(freqs[i], 'sine', t + i * 0.09, t + i * 0.09 + 0.40, 0.44, 0.001);
      }
    },
    jackpot_grand: function() {
      _play('ring1', 0.45);
      setTimeout(function() { _play('ring1', 0.43); }, 200);
      setTimeout(function() { _play('ring1', 0.40); }, 400);
      setTimeout(function() { startJackpotBells(); }, 600);
      if (!ctx) return;
      var t = ctx.currentTime;
      _noise(0.3, t, 0.35, 500);
      var freqs = [130, 164, 196, 261, 329, 392, 523, 659, 784, 1047];
      for (var i = 0; i < freqs.length; i++) {
        _tone(freqs[i], 'sine', t + i * 0.07, t + i * 0.07 + 0.45, 0.46, 0.001);
      }
    },
    splash_welcome: function() {
      _play('splash_welcome', 1.0);
    }
  };

  function play(name) {
    if (muted) return;
    resume();
    try { if (sounds[name]) sounds[name](); }
    catch(e) { console.warn('[Audio] Sound error:', name, e); }
  }

  // ── SPLASH WELCOME ────────────────────────────────────────────────
  function playSplashWelcome() {
    return new Promise(function(resolve) {
      var el = mp3['splash_welcome'];
      if (!el || muted) { resolve(); return; }
      resume();
      try {
        el.currentTime = 0;
        el.volume = Math.min(1, volumeLevel * 0.40);
        var p = el.play();
        if (p && p.catch) p.catch(function() { resolve(); });
        el.onended = function() { resolve(); };
        setTimeout(resolve, 8000);
      } catch(e) { resolve(); }
    });
  }

  // ── BACKGROUND MUSIC LOOPS ────────────────────────────────────────
  function setMusicMuted(v) {
    musicMuted = v;
    if (v) {
      stopAmbientMusic();
    } else {
      if (!muted) startAmbientMusic();
    }
  }
  function getMusicMuted() { return musicMuted; }
  function toggleMusicMute() {
    setMusicMuted(!musicMuted);
    return musicMuted;
  }

  function startAmbientMusic() {
    if (bgLoop) return;
    var el = mp3['theme'];
    if (!el || muted || musicMuted) return; // v8.1.53: also respect musicMuted
    resume();
    try {
      el.volume = volumeLevel * 0.40;
      el.currentTime = 0;
      var p = el.play();
      if (p && p.catch) p.catch(function() {});
      bgLoop = el;
    } catch(e) {}
  }

  function stopAmbientMusic() {
    if (!bgLoop) return;
    try { bgLoop.pause(); bgLoop.currentTime = 0; } catch(e) {}
    bgLoop = null;
  }

  function startRedSpinMusic() {
    stopAmbientMusic();
    if (redLoop) return;
    var el = mp3['red_spin'];
    if (!el || muted) return;
    try {
      el.volume = volumeLevel * 0.40;
      el.currentTime = 0;
      var p = el.play();
      if (p && p.catch) p.catch(function() {});
      redLoop = el;
    } catch(e) {}
  }

  function stopRedSpinMusic() {
    if (!redLoop) return;
    try { redLoop.pause(); redLoop.currentTime = 0; } catch(e) {}
    redLoop = null;
    startAmbientMusic();
  }

  function startPickMusic() {
    stopAmbientMusic();
    if (pickLoop) return;
    var el = mp3['pick_bg'];
    if (!el || muted) return;
    try {
      var clone = el.cloneNode();
      clone.loop = false;
      clone.volume = volumeLevel * 0.40;
      var p = clone.play();
      if (p && p.catch) p.catch(function() {});
      pickLoop = clone;
    } catch(e) {}
  }

  function stopPickMusic() {
    if (!pickLoop) return;
    try { pickLoop.pause(); } catch(e) {}
    pickLoop = null;
    startAmbientMusic();
  }

  return {
    init: init, resume: resume, setVolume: setVolume,
    setMuted: setMuted, getMuted: getMuted, toggleMute: toggleMute,
    setMusicMuted: setMusicMuted, getMusicMuted: getMusicMuted, toggleMusicMute: toggleMusicMute,
    play: play, playBellsForWin: playBellsForWin,
    playBellsForBonus: playBellsForBonus, playSplashWelcome: playSplashWelcome,
    startJackpotBells: startJackpotBells, stopJackpotBells: stopJackpotBells,
    startAmbientMusic: startAmbientMusic, stopAmbientMusic: stopAmbientMusic,
    startRedSpinMusic: startRedSpinMusic, stopRedSpinMusic: stopRedSpinMusic,
    startPickMusic: startPickMusic, stopPickMusic: stopPickMusic
  };
})();
