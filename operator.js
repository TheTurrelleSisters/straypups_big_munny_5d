'use strict';
var Operator = (function() {
  function $(id) { return document.getElementById(id); }
  var tapCount = 0;
  var pinBuffer = '';
  var CORRECT_PIN = '7777';

  // ── TAP SEQUENCE DETECTION ───────────────────────────────────────────
  // v8.1.33: No timeout — simply 5 taps anywhere on title bar, any pace.
  // 300ms dedup guard prevents touch+click double-fire from counting as 2 taps.
  var _lastTapTime = 0;
  function initTapZone() {
    var title = $('game-title');
    if (!title) return;

    function registerTap() {
      // Dedupe touch+click double-fire by timestamp (300ms window)
      var now = Date.now();
      if (now - _lastTapTime < 300) return; // same physical tap fired twice — ignore
      _lastTapTime = now;

      tapCount++;
      if (tapCount >= 5) {
        tapCount = 0;
        showPinEntry();
      }
    }

    // Listen on both click and touchend for mobile PWA compatibility.
    // touchend does NOT preventDefault — that was blocking the tap on some WebViews.
    title.addEventListener('click', registerTap);
    title.addEventListener('touchend', registerTap);
  }

  // ── PIN ENTRY ─────────────────────────────────────────────────────────
  // Timestamp of when pin overlay was last opened.
  // The 5th tap is a touchend; the browser fires a paired synthetic click ~300ms later.
  // That click lands on #pin-overlay (now covering the screen) and fires the
  // click-outside handler immediately, closing the overlay before the player sees it.
  // Guard: ignore any click-outside within 500ms of opening.
  var _pinOpenedAt = 0;

  function showPinEntry() {
    pinBuffer = '';
    updatePinDisplay();
    var overlay = $('pin-overlay');
    if (overlay) overlay.classList.add('active');
    var err = $('pin-error');
    if (err) err.textContent = '';
    _pinOpenedAt = Date.now();
  }

  function hidePinEntry() {
    var overlay = $('pin-overlay');
    if (overlay) overlay.classList.remove('active');
    pinBuffer = '';
    _pinOpenedAt = 0;
  }

  function updatePinDisplay() {
    var el = $('pin-display');
    if (el) el.textContent = '●'.repeat(pinBuffer.length) || '';
  }

  function handlePinKey(key) {
    if (key === 'clear') { pinBuffer = ''; updatePinDisplay(); return; }
    if (key === 'enter') { checkPin(); return; }
    if (pinBuffer.length < 4) { pinBuffer += key; updatePinDisplay(); }
    if (pinBuffer.length === 4) checkPin();
  }

  function checkPin() {
    if (pinBuffer === CORRECT_PIN) {
      hidePinEntry();
      // Small delay ensures any pending popstate/touch events are consumed first
      setTimeout(function() {
        openPanel();
      }, 80);
    } else {
      var err = $('pin-error');
      if (err) err.textContent = 'Incorrect PIN. Try again.';
      pinBuffer = '';
      updatePinDisplay();
    }
  }

  // ── OPERATOR PANEL ───────────────────────────────────────────────────
  function openPanel() {
    GameState.operator.panelOpen = true;
    // Show overlay FIRST — before renderPanel in case it errors
    var overlay = $('op-overlay');
    if (overlay) {
      overlay.classList.add('active');
      overlay.scrollTop = 0;
    }
    // Render panel content with error protection
    try {
      renderPanel();
    } catch(err) {
      var panel = $('op-panel');
      if (panel) panel.innerHTML = '<div style="color:#ff6666;padding:20px;font-size:14px">Panel render error: ' + err.message + '</div>';
    }
    var panel = $('op-panel');
    if (panel) panel.scrollTop = 0;
  }

  function closePanel() {
    GameState.operator.panelOpen = false;
    var _ov = $('op-overlay');
    if (_ov) _ov.classList.remove('active');
    saveState();
  }

  function renderPanel() {
    var panel = $('op-panel');
    if (!panel) return;

    var op  = GameState.operator;
    var st  = GameState.stats;
    var actualRTP  = getActualRTP();
    var rtpClass   = Math.abs(actualRTP - op.targetRTP) > 3 ? 'rtp-warn' : '';
    // v8.1.58: Use full theoretical RTP calculator (base + wilds + mixed bars + bonuses + jackpots)
    var theoFull   = (typeof calculateFullTheoreticalRTP !== 'undefined')
                   ? calculateFullTheoreticalRTP(DEFAULT_LINES)
                   : null;
    var theoRTP    = theoFull
                   ? (theoFull.total * 100).toFixed(1) + '%'
                   : (op.targetRTP.toFixed(1) + '%');
    var jpKeys     = ['MINI','MINOR','MAJOR','GRAND'];
    var forceKeys  = ['MINI','MINOR','MAJOR','GRAND'];
    var ctxKeys    = ['bonus','base','any'];
    var ctxLabels  = {'bonus':'🎰 BONUS','base':'🎡 BASE','any':'⚡ ANY'};

    // Detect any armed force triggers for banner
    var armedList = [];
    if (op.forceRedSpin)      armedList.push('Red Spin');
    if (op.forceFreeSpins)    armedList.push('P&C');
    // forceBonusGame removed v8.1.1
    if (op.forceBonusFeature) armedList.push('BONUS Letters');
    if (op.forceJackpot && op.forceJackpot !== 'none') armedList.push(op.forceJackpot + ' JP');
    // v7.0.1 — show jackpot queue in banner
    if (op.forceJackpotQueue && op.forceJackpotQueue.length > 0) {
      armedList.push('JP Queue: ' + op.forceJackpotQueue.join('+'));
    }

    // Denom + bet for context
    var denomVal   = (typeof GameState.denom !== 'undefined') ? GameState.denom : 0.01;
    var linesVal   = (typeof DEFAULT_LINES !== 'undefined') ? DEFAULT_LINES : 20;
    var cplVal     = (typeof GameState.creditsPerLine !== 'undefined') ? GameState.creditsPerLine : 1;
    var totalBetVal = denomVal * cplVal * linesVal;

    // ── Build HTML using string concatenation (ES5 — no template literals) ──
    var h = '';

    // Header — includes denom/bet context
    h += '<div id="op-header">';
    h += '<div id="op-title">⚙️ OPERATOR PANEL</div>';
    h += '<div style="font-size:10px;color:rgba(255,220,80,0.7);margin-top:2px">';
    h += Math.round(denomVal * 100) + '¢ denom · ' + cplVal + 'cr/line · ' + linesVal + 'L · Bet $' + totalBetVal.toFixed(2);
    h += '</div>';
    h += '<button id="op-close">✕ CLOSE</button>';
    h += '</div>';

    // Armed banner — always visible if anything is armed
    if (armedList.length > 0) {
      h += '<div id="op-armed-banner">⚡ ARMED: ' + armedList.join(' + ') + '</div>';
      h += '<button class="op-btn danger" style="width:calc(100% - 20px);margin:0 10px 8px;font-size:11px" onclick="Operator.disarmAll()">🚫 DISARM ALL</button>';
    }

    // ── Helper: collapsible section header (var expressions — safe in all modes)
    var _sec = function(key, icon, title) {
      var collapsed = op._collapsed && op._collapsed[key];
      var arr = collapsed ? '▶' : '▼';
      return '<div class="op-section' + (collapsed ? ' collapsed' : '') + '" id="op-sec-' + key + '">'
           + '<div class="op-section-title" onclick="Operator.toggleSection(\'' + key + '\')" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center">'
           + '<span>' + icon + ' ' + title + '</span><span style="font-size:10px;opacity:0.6">' + arr + '</span>'
           + '</div>'
           + (collapsed ? '' : '<!-- body -->');
    };
    var _secEnd = function(key) {
      var collapsed = op._collapsed && op._collapsed[key];
      return collapsed ? '</div>' : '</div></div>';
    };

    // RTP & Hold
    h += _sec('rtp', '📊', 'RTP &amp; HOLD');
    if (!(op._collapsed && op._collapsed['rtp'])) {
      h += '<div class="op-row"><span class="op-label">Target RTP % <span style="color:#aaa;font-size:9px">(monitor only)</span></span>';
      h += '<input class="op-input" id="op-rtp" type="number" min="85" max="99" step="0.5" value="' + op.targetRTP.toFixed(1) + '"></div>';
      h += '<div class="op-row"><span class="op-label">Hold % <span style="color:#aaa;font-size:9px">(monitor only)</span></span>';
      h += '<input class="op-input" id="op-hold" type="number" min="1" max="15" step="0.5" value="' + (100 - op.targetRTP).toFixed(1) + '"></div>';
      h += '<div style="text-align:right;margin-top:6px"><button class="op-btn" onclick="Operator.applyRTP()">APPLY</button></div>';
      h += '<div class="op-rtp-stats" style="margin-top:10px">';
      h += 'Target RTP: <span>' + op.targetRTP.toFixed(1) + '%</span><br>';
      // v8.1.58: Full theoretical RTP breakdown
      if (theoFull) {
        h += 'Theoretical RTP: <span id="op-theoretical-rtp" style="color:#22c55e;font-weight:900">' + theoRTP + '</span>';
        h += ' <span style="font-size:9px;color:#6a5a8a">(full estimate)</span><br>';
        h += '<div style="font-size:9px;color:#6a5a8a;margin:2px 0 4px 8px;line-height:1.6">';
        h += '&middot; Base paylines: ' + (theoFull.base * 100).toFixed(1) + '%<br>';
        h += '&middot; + Wilds (&times;' + theoFull.wildBoost + '): ' + (theoFull.baseWithWilds * 100).toFixed(1) + '%<br>';
        h += '&middot; + Mixed bars: ' + (theoFull.mixedBars * 100).toFixed(1) + '%<br>';
        h += '&middot; + Bonus features: ' + (theoFull.bonusFeatures * 100).toFixed(1) + '% (freq:' + (theoFull.bonusFreq * 100).toFixed(1) + '%)<br>';
        h += '&middot; + Jackpots: ' + (theoFull.jackpots * 100).toFixed(1) + '%</div>';
      } else {
        h += 'Theoretical RTP: <span id="op-theoretical-rtp">' + theoRTP + '</span><br>';
      }
      var liveColor = Math.abs(actualRTP - op.targetRTP) > 5 ? '#ef4444' : Math.abs(actualRTP - op.targetRTP) > 2 ? '#f59e0b' : '#22c55e';
      h += 'Live RTP: <span style="color:' + liveColor + ';font-weight:900">' + (st.totalWagered > 0 ? actualRTP.toFixed(1) + '%' : '—') + '</span>';
      h += ' <span style="font-size:9px;color:#6a5a8a">(excl. operator-forced spins)</span><br>';
      h += 'Total Wagered: <span>$' + st.totalWagered.toFixed(2) + '</span><br>';
      h += 'Total Paid Out: <span>$' + st.totalWon.toFixed(2) + '</span><br>';
      h += 'Total Spins: <span>' + st.totalSpins + '</span><br>';
      h += 'Session: <span>' + getSessionDuration() + '</span><br>';
      h += 'Biggest Win: <span>$' + st.biggestWin.toFixed(2) + '</span>';
      h += '</div>';
    }
    h += _secEnd('rtp');

    // Bonus Controls
    h += _sec('bonus', '🎰', 'BONUS CONTROLS');
    if (!(op._collapsed && op._collapsed['bonus'])) {
      h += '<div class="op-row"><span class="op-label">Bonus Freq Multiplier</span>';
      h += '<input class="op-input" id="op-bfreq" type="number" min="0.5" max="5" step="0.1" value="' + op.bonusFrequencyMultiplier.toFixed(1) + '"></div>';
      h += '<div class="op-row"><span class="op-label">RS Continuance <span style="color:#aaa;font-size:9px">(70% default · max 95%)</span></span>';
      h += '<div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:4px">';
      [70,75,80,85,90,95].forEach(function(pct) {
        var active = Math.round((op.redSpinContinuance||0.70)*100) === pct;
        h += '<button class="op-btn' + (active ? ' armed' : '') + '" style="flex:1;min-width:36px;font-size:10px;padding:3px 2px" data-cont="' + (pct/100) + '" onclick="Operator.setContinuance(parseFloat(this.dataset.cont))">' + pct + '%</button>';
      });
      h += '<button class="op-btn danger" style="font-size:9px;padding:3px 5px" onclick="Operator.resetRedSpinContinuance()">RST</button>';
      h += '</div></div>';
      // v8.1.25: Force RS Entry Tier
      h += '<div class="op-row"><span class="op-label">Force RS Entry Tier <span style="color:#aaa;font-size:9px">(next trigger only)</span></span>';
      h += '<div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:4px">';
      var _entryLabels = ['Rnd','T1','T2','T3','T4'], _entryVals = [-1,0,1,2,3];
      for (var _eli = 0; _eli < _entryLabels.length; _eli++) {
        var _eActive = (op.forceRSEntryTier === _entryVals[_eli]);
        h += '<button class="op-btn' + (_eActive ? ' armed' : '') + '" style="flex:1;font-size:10px;padding:3px 2px" onclick="Operator.setRSEntryTier(' + _entryVals[_eli] + ')">' + _entryLabels[_eli] + '</button>';
      }
      h += '</div></div>';
      // v8.1.25: Force RS Step Count
      h += '<div class="op-row"><span class="op-label">Force RS Steps/Tier <span style="color:#aaa;font-size:9px">(per tier)</span></span>';
      h += '<div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:4px">';
      var _stepLabels = ['Rnd','4','5','6'], _stepVals = [-1,4,5,6];
      for (var _sli = 0; _sli < _stepLabels.length; _sli++) {
        var _sActive = (op.forceRSStepCount === _stepVals[_sli]);
        h += '<button class="op-btn' + (_sActive ? ' armed' : '') + '" style="flex:1;font-size:10px;padding:3px 2px" onclick="Operator.setRSStepCount(' + _stepVals[_sli] + ')">' + _stepLabels[_sli] + '</button>';
      }
      h += '</div></div>';
      // v8.1.25: Force RS Tier Advance
      h += '<div class="op-row"><span class="op-label">Force Next RS Advance <span style="color:#aaa;font-size:9px">(on next continuance-fail)</span></span><button class="op-btn force-btn ' + (op.forceRSAdvance ? 'armed' : '') + '" data-fkey="forceRSAdvance" onclick="Operator.toggleForce(this.dataset.fkey)">' + (op.forceRSAdvance ? 'ARMED' : 'OFF') + '</button></div>';
      h += '<div class="op-row"><span class="op-label">Disable P&amp;C in Red Spin</span><button class="op-btn force-btn ' + (op.disablePickChooseInRedSpin?'armed':'') + '" data-fkey="disablePickChooseInRedSpin" onclick="Operator.toggleForce(this.dataset.fkey)">' + (op.disablePickChooseInRedSpin?'OFF':'ON') + '</button></div>';
      h += '<div class="op-row"><span class="op-label">JP Contribution % <span style="color:#aaa;font-size:9px">(% of each bet added to JP pools)</span></span>';
      h += '<input class="op-input" id="op-jpct" type="number" min="1" max="10" step="0.5" value="' + (op.jackpotContribution*100).toFixed(1) + '"></div>';
      h += '<div class="op-row"><span class="op-label">Max Win Per Spin ($0=off)</span>';
      h += '<input class="op-input" id="op-maxwin" type="number" min="0" step="10" value="' + op.maxWinPerSpin + '"></div>';
      h += '<div style="text-align:right;margin-top:6px"><button class="op-btn" onclick="Operator.applyBonusSettings()">APPLY</button></div>';
    }
    h += _secEnd('bonus');

    // Force Triggers
    h += _sec('force', '⚡', 'FORCE TRIGGERS (Next Spin)');
    if (!(op._collapsed && op._collapsed['force'])) {
      var forceItems = [
        ['forceRedSpin',     'Force Red Spin'],
        ['forceFreeSpins',   'Force Pick &amp; Choose'],
        // ['forceBonusGame', 'Force Hold & Spin'], // removed v8.1.1
        ['forceBonusFeature','Force BONUS Letters'],
      ];
      for (var fi = 0; fi < forceItems.length; fi++) {
        var fkey = forceItems[fi][0];
        var flbl = forceItems[fi][1];
        var farmed = op[fkey] ? 'armed' : '';
        var ftxt = op[fkey] ? '✅ ARMED' : 'ARM';
        h += '<div class="op-row"><span class="op-label">' + flbl + '</span>';
        h += '<button class="op-btn force-btn ' + farmed + '" data-fkey="' + fkey + '" onclick="Operator.toggleForce(this.dataset.fkey)">' + ftxt + '</button></div>';
      }
      // Jackpot force
      h += '<div class="op-row" style="flex-direction:column;align-items:flex-start;gap:6px">';
      h += '<span class="op-label">⚡ Force Jackpot Trigger</span>';
      h += '<div style="display:flex;gap:6px;flex-wrap:wrap;width:100%">';
      for (var ji = 0; ji < forceKeys.length; ji++) {
        var jk = forceKeys[ji];
        var jarmed = op.forceJackpot === jk ? ' armed' : '';
        var jtxt = (op.forceJackpot === jk ? '✅ ' : '') + jk;
        h += '<button class="op-btn force-btn' + jarmed + '" style="flex:1;min-width:56px" data-jptype="' + jk + '" onclick="Operator.selectJackpotType(this.dataset.jptype)">' + jtxt + '</button>';
      }
      h += '<button class="op-btn danger" style="flex:1;min-width:56px" data-jptype="none" onclick="Operator.selectJackpotType(this.dataset.jptype)">CLEAR</button>';
      h += '</div>';
      if (op.forceJackpot !== 'none') {
        h += '<div style="display:flex;gap:4px;width:100%;margin-top:2px">';
        for (var ci = 0; ci < ctxKeys.length; ci++) {
          var ck = ctxKeys[ci];
          var carmed = op.forceJackpotContext === ck ? ' armed' : '';
          var ctxt = (op.forceJackpotContext === ck ? '✅ ' : '') + ctxLabels[ck];
          h += '<button class="op-btn force-btn' + carmed + '" style="flex:1;font-size:9px" data-ctx="' + ck + '" onclick="Operator.setJackpotContext(this.dataset.ctx)">' + ctxt + '</button>';
        }
        h += '</div>';
        var armCtx = op.forceJackpotContext === 'base' ? '(BASE REELS)' : op.forceJackpotContext === 'any' ? '(ANY CONTEXT)' : '(NEXT BONUS)';
        h += '<button class="op-btn" style="width:100%;background:linear-gradient(135deg,#1a3a1a,#0d1f0d);border-color:#40cc40;color:#80ff80" onclick="Operator.armJackpot()">🚀 ARM — ' + op.forceJackpot + ' ' + armCtx + '</button>';
      }
      h += '</div></div>';
    }
    h += _secEnd('force');

    // ── K2: COMBINED FORCE TRIGGER (v7.0.2 — multi-bonus, tier-map, sweep mode) ──
    h += _sec('combo', '\u26A1', 'COMBINED FORCE TRIGGER');
    if (!(op._collapsed && op._collapsed['combo'])) {
      var cm  = op.comboModes || { red_spin:false, pick_choose:false, bonus_letters:false };
      var fq  = op.forceJackpotQueue || [];
      var rtm = op.forceRSTierMap   || {};  // { 0:'MINI', 1:'MINOR', 2:'MAJOR', 3:'GRAND' }
      var jpTierOpts = ['MINI','MINOR','MAJOR','GRAND'];

      h += '<div style="font-size:9px;color:var(--text-dim);margin-bottom:6px">Select multiple bonuses. All fire sequentially on next spin. RS gets per-tier jackpot assignments.</div>';

      // ── Bonus type multi-select ──
      h += '<div style="font-size:9px;color:#ffcc44;margin-bottom:4px;font-weight:bold">\u25B6 BONUS TYPES (multi-select)</div>';
      h += '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px">';
      var cBonusOpts = [
        { key:'red_spin',      label:'Red Spin'     },
        { key:'bonus_letters', label:'BONUS Letters' },
        { key:'pick_choose',   label:'P&C'          },
      ];
      for (var cbi = 0; cbi < cBonusOpts.length; cbi++) {
        var cbo = cBonusOpts[cbi];
        var cbOn = cm[cbo.key] ? true : false;
        h += '<button class="op-btn force-btn' + (cbOn ? ' armed' : '') + '" style="flex:1;min-width:70px;font-size:10px" data-cbk="' + cbo.key + '" onclick="Operator.toggleComboBonus(this.dataset.cbk)">' + (cbOn ? '\u2705 ' : '') + cbo.label + '</button>';
      }
      h += '</div>';

      // ── RS Per-Tier Jackpot Map (only shown when Red Spin is selected) ──
      if (cm.red_spin) {
        h += '<div style="font-size:9px;color:#ff9966;margin-bottom:3px;font-weight:bold">\u25B6 RS JACKPOT PER TIER</div>';
        h += '<div style="font-size:9px;color:var(--text-dim);margin-bottom:4px">Assign a jackpot to each RS tier. ARM ALL = T1\u2192MINI, T2\u2192MINOR, T3\u2192MAJOR, T4\u2192GRAND.</div>';
        var tierLabels = ['T1 (SMALL)','T2 (MED)','T3 (LARGE)','T4 (SISTERS)'];
        for (var ti = 0; ti < 4; ti++) {
          var assigned = rtm[ti] || null;
          h += '<div style="display:flex;align-items:center;gap:4px;margin-bottom:3px">';
          h += '<span style="font-size:9px;color:#ffcc44;min-width:64px">' + tierLabels[ti] + '</span>';
          for (var jpi = 0; jpi < jpTierOpts.length; jpi++) {
            var jpo = jpTierOpts[jpi];
            var jpOn = (assigned === jpo);
            h += '<button class="op-btn force-btn' + (jpOn ? ' armed' : '') + '" style="flex:1;font-size:9px;padding:3px 2px" data-ti="' + ti + '" data-jp="' + jpo + '" onclick="Operator.setRSTierJP(parseInt(this.dataset.ti),this.dataset.jp)">' + (jpOn ? '\u2705' : '') + jpo + '</button>';
          }
          var clrOn = (!assigned);
          h += '<button class="op-btn' + (clrOn ? '' : ' danger') + '" style="font-size:9px;padding:3px 5px" data-ti="' + ti + '" data-jp="" onclick="Operator.setRSTierJP(parseInt(this.dataset.ti),\'\')">CLR</button>';
          h += '</div>';
        }
        h += '<div style="display:flex;gap:4px;margin-bottom:6px">';
        h += '<button class="op-btn" style="flex:1;font-size:9px" onclick="Operator.armRSTierAll()">\u26A1 ARM ALL TIERS</button>';
        h += '<button class="op-btn danger" style="flex:1;font-size:9px" onclick="Operator.clearRSTierMap()">CLEAR ALL</button>';
        h += '</div>';

        // ── RS Sweep Mode ──────────────────────────────────────────────────
        h += '<div style="font-size:9px;color:#ff9966;margin-bottom:3px;font-weight:bold">\u25B6 SWEEP MODE — Play all combos in tier</div>';
        h += '<div style="font-size:9px;color:var(--text-dim);margin-bottom:4px">Plays one spin per winning symbol combination in the selected tier(s). Ascending rule suspended.</div>';
        var sweepTier = (op.rsSweepTier !== undefined) ? op.rsSweepTier : -1;
        var sweepTierOpts = [{v:-1,label:'ALL'},{v:0,label:'T1'},{v:1,label:'T2'},{v:2,label:'T3'},{v:3,label:'T4'}];
        h += '<div style="display:flex;gap:4px;margin-bottom:4px">';
        for (var sti = 0; sti < sweepTierOpts.length; sti++) {
          var sto = sweepTierOpts[sti];
          var stOn = (sweepTier === sto.v);
          h += '<button class="op-btn force-btn' + (stOn ? ' armed' : '') + '" style="flex:1;font-size:9px" data-stv="' + sto.v + '" onclick="Operator.setSweepTier(parseInt(this.dataset.stv))">' + (stOn ? '\u2705 ' : '') + sto.label + '</button>';
        }
        h += '</div>';
        h += '<button class="op-btn" style="width:100%;margin-bottom:6px;font-size:10px" onclick="Operator.armSweep()">\uD83D\uDD01 ARM SWEEP (runs when RS triggers)</button>';
      }

      // ── Jackpots for P&C (non-RS bonuses — uses queue) ──
      if (cm.pick_choose || cm.bonus_letters) {
        h += '<div style="font-size:9px;color:#ffcc44;margin-bottom:4px;font-weight:bold">\u25B6 JACKPOTS for P&C (queued)</div>';
        h += '<div style="display:flex;gap:4px;margin-bottom:2px">';
        var jpQKeys2 = ['MINI','MINOR','MAJOR','GRAND'];
        for (var qji = 0; qji < jpQKeys2.length; qji++) {
          var qjk = jpQKeys2[qji];
          var qjOn = (fq.indexOf(qjk) >= 0);
          h += '<button class="op-btn force-btn' + (qjOn ? ' armed' : '') + '" style="flex:1" data-qjk="' + qjk + '" onclick="Operator.toggleComboJP(this.dataset.qjk)">' + (qjOn ? '\u2705 ' : '') + qjk + '</button>';
        }
        h += '</div>';
        if (fq.length > 0) {
          h += '<div style="font-size:9px;color:#80ff80;margin-bottom:4px">Queue: ' + fq.join(' \u2192 ') + '</div>';
        }
        h += '<div style="display:flex;gap:4px;margin-bottom:8px">';
        for (var cxi = 0; cxi < ctxKeys.length; cxi++) {
          var cxk = ctxKeys[cxi];
          var cxOn = (op.forceJackpotContext === cxk);
          h += '<button class="op-btn force-btn' + (cxOn ? ' armed' : '') + '" style="flex:1;font-size:9px" data-ctx="' + cxk + '" onclick="Operator.setJackpotContext(this.dataset.ctx)">' + (cxOn ? '\u2705 ' : '') + ctxLabels[cxk] + '</button>';
        }
        h += '</div>';
      }

      // ── ARM / DISARM ──
      var anyBonusSel = cm.red_spin || cm.pick_choose || cm.bonus_letters;
      var comboBtnCls = op.comboArmed ? ' danger' : '';
      var comboBtnLbl = op.comboArmed ? '\uD83D\uDD34 COMBO ARMED \u2014 DISARM' : '\uD83D\uDE80 ARM COMBO';
      h += '<button class="op-btn' + comboBtnCls + '" style="width:100%" onclick="Operator.armCombo()">' + comboBtnLbl + '</button>';
      if (!anyBonusSel && !op.comboArmed) {
        h += '<div style="font-size:9px;color:var(--text-dim);text-align:center;margin-top:4px">Select at least one bonus type above</div>';
      }
    }
    h += _secEnd('combo');

    // Reel Stops
    h += _sec('reels', '🎯', 'FORCE REEL STOPS');
    if (!(op._collapsed && op._collapsed['reels'])) {
      h += '<div style="display:flex;gap:5px;margin-bottom:6px">';
      for (var ri = 0; ri < 5; ri++) {
        var rv = (op.forceReelStops[ri] != null) ? op.forceReelStops[ri] : '';
        h += '<input class="op-input" id="op-stop' + ri + '" type="number" min="0" max="79" placeholder="R' + (ri+1) + '" style="width:52px;padding:5px 4px;font-size:12px" value="' + rv + '">';
      }
      h += '</div>';
      h += '<div style="display:flex;gap:6px;justify-content:flex-end">';
      h += '<button class="op-btn" onclick="Operator.applyReelStops()">SET STOPS</button>';
      h += '<button class="op-btn danger" onclick="Operator.clearReelStops()">CLEAR</button>';
      h += '</div>';
    }
    h += _secEnd('reels');

    // Balance & Jackpots
    h += _sec('balance', '💰', 'BALANCE &amp; JACKPOTS');
    if (!(op._collapsed && op._collapsed['balance'])) {
      h += '<div class="op-row"><span class="op-label">Current Balance</span><span class="op-val">$' + GameState.balance.toFixed(2) + '</span></div>';
      h += '<div class="op-row"><span class="op-label">Set Balance $</span>';
      h += '<input class="op-input" id="op-bal" type="number" min="0" step="10" value="' + op.startingBalance + '"></div>';
      h += '<div style="text-align:right;margin-bottom:8px"><button class="op-btn" onclick="Operator.setBalance()">SET BALANCE</button></div>';
      for (var jpi = 0; jpi < jpKeys.length; jpi++) {
        var jpk = jpKeys[jpi];
        h += '<div class="op-row"><span class="op-label">' + jpk + ' Jackpot</span>';
        h += '<span class="op-val">$' + GameState.jackpots[jpk].current.toFixed(2) + '</span>';
        h += '<button class="op-btn danger" style="padding:4px 8px;font-size:10px" data-jpkey="' + jpk + '" onclick="Operator.resetJP(this.dataset.jpkey)">RESET</button></div>';
      }
      h += '<div style="text-align:right;margin-top:6px"><button class="op-btn danger" onclick="Operator.resetAllJP()">RESET ALL JACKPOTS</button></div>';
    }
    h += _secEnd('balance');

    // Bonus Stats
    h += _sec('stats', '📈', 'BONUS STATS');
    if (!(op._collapsed && op._collapsed['stats'])) {
      h += '<div class="op-rtp-stats">';
      h += 'Red Spin Triggers: <span>' + st.redSpinCount + '</span><br>';
      // Hold & Spin Triggers stat removed v8.0
      h += 'Pick &amp; Choose Triggers: <span>' + st.pickChooseCount + '</span><br>';
      h += 'MINI Jackpots: <span>' + st.jackpotWins.MINI + '</span><br>';
      h += 'MINOR Jackpots: <span>' + st.jackpotWins.MINOR + '</span><br>';
      h += 'MAJOR Jackpots: <span>' + st.jackpotWins.MAJOR + '</span><br>';
      h += 'GRAND Jackpots: <span>' + st.jackpotWins.GRAND + '</span>';
      h += '</div>';
    }
    h += _secEnd('stats');

    // Event Log
    h += _sec('log', '📋', 'EVENT LOG &amp; AUDIT HISTORY');
    if (!(op._collapsed && op._collapsed['log'])) {
      h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px">';
      h += '<button class="op-btn" onclick="Operator.showLog()">📋 SPIN LOG &amp; EVENTS</button>';
      h += '</div>';
      h += '<div style="display:flex;gap:6px;flex-wrap:wrap">';
      h += '<button class="op-btn" onclick="exportHistoryCSV()">⬇ CSV</button>';
      h += '<button class="op-btn" onclick="exportHistoryJSON()">⬇ JSON</button>';
      h += '<button class="op-btn danger" onclick="Operator.confirmClearHistory()">CLEAR HISTORY</button>';
      h += '</div>';
    }
    h += _secEnd('log');

    // Reset
    h += _sec('reset', '⚠️', 'RESET OPTIONS');
    if (!(op._collapsed && op._collapsed['reset'])) {
      h += '<div style="display:flex;gap:6px;flex-wrap:wrap">';
      h += '<button class="op-btn danger" onclick="Operator.resetGame(false)">RESET PLAYER</button>';
      h += '<button class="op-btn danger" onclick="Operator.resetGame(true)">FULL RESET</button>';
      h += '<button class="op-btn danger" style="background:rgba(239,68,68,0.25);border-color:#ff4444" onclick="Operator.factoryReset()">🏭 FACTORY RESET</button>';
      h += '</div>';
    }
    h += _secEnd('reset');
    h += '<div style="height:20px"></div>';

    panel.innerHTML = h;

    // Attach close button
    var closeBtn = $('op-close');
    if (closeBtn) closeBtn.onclick = function() { Operator.closePanel(); };
  }

  // ── OPERATOR ACTIONS ─────────────────────────────────────────────────
  function applyRTP() {
    var rtpEl  = $('op-rtp');
    var holdEl = $('op-hold');
    if (!rtpEl) return;
    var rtp  = Math.min(99, Math.max(85, parseFloat(rtpEl.value) || 94));
    var hold = parseFloat((100 - rtp).toFixed(1));
    GameState.operator.targetRTP      = rtp;
    GameState.operator.holdPercentage = hold;
    if (holdEl) holdEl.value = hold.toFixed(1);

    // Auto-adjust bonus frequency multiplier to push live RTP toward target
    var liveRTP = getActualRTP();
    if (liveRTP > 0) {
      var diff = rtp - liveRTP;
      // Positive diff = live is below target = increase bonus freq
      var adj = 1.0 + (diff / 15.0);
      GameState.operator.bonusFrequencyMultiplier = Math.max(0.5, Math.min(5.0, parseFloat(adj.toFixed(1))));
    }

    // Update theoretical RTP display live
    var theoEl = $('op-theoretical-rtp');
    if (theoEl && typeof calculateTheoreticalRTP !== 'undefined') {
      theoEl.textContent = (calculateTheoreticalRTP(DEFAULT_LINES)*100).toFixed(2) + '%';
    }

    saveState();
    renderPanel();
    UI.showToast('RTP ' + rtp + '% | Hold ' + hold + '% | BonusFreq ' + GameState.operator.bonusFrequencyMultiplier.toFixed(1) + 'x');
  }

  function applyBonusSettings() {
    var op = GameState.operator;
    op.bonusFrequencyMultiplier = Math.min(5, Math.max(0.5, parseFloat(($('op-bfreq')||{}).value) || 1));
    // op-rscont input removed v8.1.2 — continuance set via pill buttons (setContinuance)
    op.jackpotContribution = Math.min(0.1, Math.max(0.01, (parseFloat(($('op-jpct')||{}).value)||3)/100));
    op.maxWinPerSpin = Math.max(0, parseFloat(($('op-maxwin')||{}).value)||0);
    saveState();
    UI.showToast('Bonus settings applied');
  }

  // ── RS CONTINUANCE CONTROL (v8.1.2) ────────────────────────────────
  // Range: 70–95% only. Set via pill buttons. Wired to bonuses.js RS loop.
  function setContinuance(val) {
    var clamped = Math.min(0.95, Math.max(0.70, parseFloat(val) || 0.70));
    // Round to nearest 5%
    clamped = Math.round(clamped * 20) / 20;
    GameState.operator.redSpinContinuance = clamped;
    saveState();
    renderPanel();
    UI.showToast('RS Continuance set to ' + Math.round(clamped * 100) + '%');
  }

  function resetRedSpinContinuance() {
    GameState.operator.redSpinContinuance = 0.70;
    saveState();
    renderPanel();
    UI.showToast('RS Continuance reset to 70%');
  }

  // v8.1.25: Force entry tier (-1=random, 0-3=T1-T4)
  function setRSEntryTier(val) {
    GameState.operator.forceRSEntryTier = parseInt(val);
    saveState(); renderPanel();
    var labels = ['Random','T1','T2','T3','T4'];
    UI.showToast('RS Entry Tier: ' + (labels[val+1] || 'Random'));
  }

  // v8.1.25: Force step count (-1=random, 4/5/6=fixed)
  function setRSStepCount(val) {
    GameState.operator.forceRSStepCount = parseInt(val);
    saveState(); renderPanel();
    UI.showToast('RS Step Count: ' + (val < 0 ? 'Random' : val));
  }

  // ── DISARM ALL — clears every armed force trigger at once ─────────────
  function disarmAll() {
    var op = GameState.operator;
    op.forceRedSpin      = false;
    op.forceFreeSpins    = false;
    op.forceBonusFeature = false;
    op.forceJackpot      = 'none';
    op.forceJackpotContext = 'bonus';
    // also clear multi-jackpot queue, RS tier, combo modes
    op.forceJackpotQueue = [];
    op.comboArmed        = false;
    var cm = op.comboModes;
    if (cm) { cm.red_spin = false; cm.pick_choose = false; cm.bonus_letters = false; }
    // v7.0.2 — clear RS tier map and sweep mode
    op.forceRSTierMap   = {};
    op.rsSweepMode      = false;
    op.rsSweepTier      = -1;
    op.forceRSEntryTier = -1;
    op.forceRSStepCount = -1;
    op.forceRSAdvance   = false;
    saveState();
    renderPanel();
    UI.showToast('All force triggers disarmed');
  }

  // ── SECTION COLLAPSE TOGGLE ───────────────────────────────────────────
  function toggleSection(key) {
    var op = GameState.operator;
    if (!op._collapsed) op._collapsed = {};
    op._collapsed[key] = !op._collapsed[key];
    // Don't persist collapse state — session-only UX preference
    renderPanel();
  }

  // ── v7.0.2 RS tier jackpot map functions ─────────────────────────────
  function setRSTierJP(tierIdx, jp) {
    var op = GameState.operator;
    if (!op.forceRSTierMap) op.forceRSTierMap = {};
    op.forceRSTierMap[tierIdx] = jp || null;
    saveState(); renderPanel();
  }

  function armRSTierAll() {
    var op = GameState.operator;
    op.forceRSTierMap = { 0:'MINI', 1:'MINOR', 2:'MAJOR', 3:'GRAND' };
    saveState(); renderPanel();
    UI.showToast('RS tiers armed: T1\u2192MINI T2\u2192MINOR T3\u2192MAJOR T4\u2192GRAND');
  }

  function clearRSTierMap() {
    GameState.operator.forceRSTierMap = {};
    saveState(); renderPanel();
    UI.showToast('RS tier map cleared');
  }

  function setSweepTier(val) {
    GameState.operator.rsSweepTier = val;
    saveState(); renderPanel();
  }

  function armSweep() {
    var op = GameState.operator;
    op.rsSweepMode = true;
    // Make sure Red Spin will trigger
    if (!op.comboModes) op.comboModes = { red_spin:true, pick_choose:false, bonus_letters:false };
    op.comboModes.red_spin  = true;
    op.forceRedSpin = true;
    op.comboArmed   = true;
    saveState(); renderPanel();
    UI.showToast('\uD83D\uDD01 Sweep armed — trigger Red Spin to run');
  }

  // ── v7.0.2 — update setRSTier to write into forceRSTierMap as well ──
  function setRSTier(val) {
    // Legacy single-tier setter — kept for any old callers
    var op = GameState.operator;
    if (!op.forceRSTierMap) op.forceRSTierMap = {};
    // val: -1=any → clear map; 0-3 → set that tier from forceJackpotQueue[0]
    if (val === -1) {
      op.forceRSTierMap = {};
    }
    saveState(); renderPanel();
  }
  function toggleComboBonus(key) {
    var op = GameState.operator;
    if (!op.comboModes) op.comboModes = { red_spin:false, pick_choose:false, bonus_letters:false };
    op.comboModes[key] = !op.comboModes[key];
    saveState(); renderPanel();
  }

  // ── v7.0.1 COMBO: toggle a jackpot tier on/off in the queue ─────────
  function toggleComboJP(tier) {
    var op = GameState.operator;
    if (!op.forceJackpotQueue) op.forceJackpotQueue = [];
    var idx = op.forceJackpotQueue.indexOf(tier);
    if (idx >= 0) {
      op.forceJackpotQueue.splice(idx, 1);
    } else {
      op.forceJackpotQueue.push(tier);
    }
    saveState(); renderPanel();
  }

  // ── v7.0.1 COMBO: set RS tier for jackpot fire ──────────────────────
  // Second setRSTier definition removed v8.1.2 — was silently overwriting the correct first definition
  // forceRSTier property removed — replaced by forceRSTierMap (see setRSTierJP)

  // setComboBonus and setComboJP removed v8.1.2 — dead legacy functions, never called from UI
  // comboBonus and comboJP properties unused since multi-select upgrade in v7.0.1

  function armCombo() {
    var op = GameState.operator;
    if (op.comboArmed) {
      // Disarm — clear all combo flags
      op.comboArmed          = false;
      // op.forceBonusGame reset removed v8.1.1
      op.forceRedSpin        = false;
      op.forceFreeSpins      = false;
      op.forceBonusFeature   = false;
      op.forceJackpot        = 'none';
      op.forceJackpotQueue   = [];
      op.forceJackpotContext = 'bonus';
      var cm = op.comboModes;
      if (cm) { cm.red_spin = false; cm.pick_choose = false; cm.bonus_letters = false; }
      saveState(); renderPanel();
      UI.showToast('Combo disarmed');
      return;
    }
    // ── Arm: read multi-select bonus and jackpot states ────────────────
    var cm2 = op.comboModes || {};
    var anyBonus = cm2.red_spin || cm2.pick_choose || cm2.bonus_letters;
    if (!anyBonus) { UI.showToast('Select at least one bonus type first'); return; }
    op.comboArmed        = true;
    op.forceRedSpin      = !!cm2.red_spin;
    op.forceFreeSpins    = !!cm2.pick_choose;
    op.forceBonusFeature = !!cm2.bonus_letters;
    // forceJackpotQueue is already populated by toggleComboJP — copy it fresh
    if (!op.forceJackpotQueue) op.forceJackpotQueue = [];
    // Build a human-readable summary for the toast
    var armedBonuses = [];
    if (cm2.red_spin)      armedBonuses.push('Red Spin');
    if (cm2.bonus_letters) armedBonuses.push('BONUS Letters');
    if (cm2.pick_choose)   armedBonuses.push('P&C');
    var jpSummary = op.forceJackpotQueue.length > 0 ? ' + JPs: ' + op.forceJackpotQueue.join(', ') : '';
    saveState(); renderPanel();
    UI.showToast('COMBO ARMED: ' + armedBonuses.join(' + ') + jpSummary);
  }

  function toggleForce(key) {
    GameState.operator[key] = !GameState.operator[key];
    saveState();
    renderPanel();
  }

  function setForceJP(val) {
    GameState.operator.forceJackpot = val;
    saveState();
  }

  function selectJackpotType(jp) {
    GameState.operator.forceJackpot = jp;
    // Default context to bonus when selecting a new type
    if (jp !== 'none' && !GameState.operator.forceJackpotContext) {
      GameState.operator.forceJackpotContext = 'bonus';
    }
    saveState();
    renderPanel();
  }

  function setJackpotContext(ctx) {
    GameState.operator.forceJackpotContext = ctx;
    saveState();
    renderPanel();
  }

  // ── ARM JACKPOT — sets up force trigger based on context ──────────────
  function armJackpot() {
    var op  = GameState.operator;
    var jp  = op.forceJackpot;
    var ctx = op.forceJackpotContext;
    if (jp === 'none') { UI.showToast('Select a jackpot type first'); return; }

    if (ctx === 'bonus') {
      // BONUS context: jackpot fires inside next P&C or RS bonus
      // forceJackpot is already set; _rollTierJackpot reads it when bonus triggers
      saveState();
      UI.showToast('✅ ' + jp + ' jackpot armed — fires in next bonus');
      renderPanel();

    } else {
      // BASE GAME context: force Lipstick on center payline → P&C triggers → jackpot fires via P&C
      op.forceFreeSpins = true; // forces center payline Lipstick on next spin
      saveState();
      UI.showToast('✅ ' + jp + ' jackpot armed — will fire via Pick & Choose on next spin');
      renderPanel();
    }
  }

  // _findCoinStops permanently removed v8.1.2
  // BASE GAME jackpot arm now forces Lipstick on center payline → P&C → jackpot fires via P&C

  function applyReelStops() {
    var stops = [0,1,2,3,4].map(function(r) {
      var el = document.getElementById('op-stop' + r);
      var val = el ? el.value : '';
      return val !== '' && val !== undefined ? parseInt(val) : null;
    });
    GameState.operator.forceReelStops = stops;
    saveState();
    UI.showToast('Reel stops set');
  }

  function clearReelStops() {
    GameState.operator.forceReelStops = [null,null,null,null,null];
    [0,1,2,3,4].forEach(function(r) { var el=document.getElementById('op-stop'+r); if(el) el.value=''; });
    saveState();
    UI.showToast('Reel stops cleared');
  }

  function setBalance() {
    var val = parseFloat(($('op-bal')||{}).value) || GameState.operator.startingBalance;
    GameState.balance = Math.max(0, val);
    GameState.operator.startingBalance = val;
    UI.updateBalance(GameState.balance);
    saveState();
    UI.showToast('Balance set to $' + val.toFixed(2));
  }

  function resetJP(key) {
    resetSingleJackpot(key);
    UI.updateJackpotMeters();
    renderPanel();
    UI.showToast(key + ' Jackpot reset to seed');
  }

  function resetAllJP() {
    resetJackpotValues();
    UI.updateJackpotMeters();
    renderPanel();
    UI.showToast('All jackpots reset');
  }

  function resetGame(full) {
    if (!confirm(full ? 'Full reset? Clears all stats, balance, jackpots.' :
                        'Reset player balance and stats?')) return;
    resetState({ keepJackpots: !full, keepOperator: true });
    UI.updateBalance(GameState.balance);
    UI.updateJackpotMeters();
    closePanel();
    UI.showToast(full ? 'Full reset complete' : 'Player reset complete');
  }

  function factoryReset() {
    // v8.1.58: Wipes ALL data — stats, balance, jackpots, vouchers, operator settings, logs
    if (!confirm('FACTORY RESET?\n\nThis will clear EVERYTHING:\n- Balance reset to $' + (DEFAULT_BALANCE || 500).toFixed(2) + '\n- All stats and history cleared\n- All jackpots reset to seeds\n- All vouchers deleted\n- All operator settings reset\n- Page will reload\n\nThis cannot be undone.')) return;
    // Clear game state
    resetState({ keepJackpots: false, keepStats: false, keepOperator: false });
    // Clear vouchers
    if (typeof CashOut !== 'undefined' && CashOut.clearAllVouchers) {
      CashOut.clearAllVouchers();
    } else {
      try { localStorage.removeItem('turrelleSisters_vouchers_v1'); } catch(e) {}
    }
    // Clear all localStorage keys related to the game
    try {
      var keysToRemove = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && (k.indexOf('turrelle') >= 0 || k.indexOf('Turrelle') >= 0)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(function(k) { localStorage.removeItem(k); });
    } catch(e) {}
    // Reload page for clean state
    UI.showToast('Factory reset complete — reloading...');
    setTimeout(function() { window.location.reload(); }, 1200);
  }
  function showLog(tab) { tab = tab || 'history';
    var screen = $('log-screen');
    if (!screen) return;
    screen.classList.add('active');
    renderLogTab(tab);
  }

  function _formatGameRow(g) {
    var s       = g.summary || {};
    var net     = (s.netResult != null) ? s.netResult : 0;
    var winCls  = net >= 0 ? 'win' : 'loss';
    var netStr  = (net >= 0 ? '+' : '-') + '$' + Math.abs(net).toFixed(2);
    var betAmt  = (g.bet && g.bet.total != null) ? g.bet.total.toFixed(2) : '?';
    var bonuses = (g.bonuses && g.bonuses.length) ? g.bonuses.map(function(b) {return b.type;}).join(', ') : 'None';
    var centerStr = (g.centerRow && g.centerRow.length) ? g.centerRow.join(' - ') : '—';
    var stopsStr  = (g.reelStops && g.reelStops.length) ? '[' + g.reelStops.join('-') + ']' : '';
    var denomStr  = g.denom ? (Math.round(g.denom * 100) + '¢') : '';
    var cplStr    = g.creditsPerLine ? g.creditsPerLine + 'cr' : '';
    var linesStr  = ((g.bet && g.bet.lines) ? g.bet.lines : '') + 'L'; // BUG-OP3 fix v8.1.33: was hardcoded '20L'
    var betLine   = [denomStr, cplStr, linesStr, 'Bet $' + betAmt].filter(Boolean).join(' · ');
    // Payline names for this spin
    var plNames = '';
    if (g.baseResult && g.baseResult.wins && g.baseResult.wins.length) {
      var names = g.baseResult.wins.filter(function(w) { return w.lineName; }).map(function(w) { return w.lineName; });
      if (names.length) plNames = '<div style="font-size:9px;color:#c0a840;margin-top:1px">Lines: ' + names.join(', ') + '</div>';
    }

    var h = '';
    h += '<div class="log-game-header">';
    h += '<span class="log-game-num">Spin #' + (g.gameNumber || '?') + '</span>';
    h += '<span class="log-game-time">' + (g.timeFormatted || '') + '</span>';
    h += '</div>';
    h += '<div style="font-size:11px;color:#e8d97a;margin:2px 0">' + centerStr + ' ' + stopsStr + '</div>';
    h += plNames;
    h += '<div style="font-size:10px;color:var(--text-dim)">' + betLine + '</div>';
    h += '<div class="log-game-result ' + winCls + '">' + netStr + '</div>';
    if (bonuses !== 'None') h += '<div class="log-game-bonuses">🎰 ' + bonuses + '</div>';
    return h;
  }

  function renderLogTab(tab, filterMode) {
    if (filterMode === undefined) filterMode = 'all';
    var logContent = $('log-content');
    if (!logContent) return;
    logContent.innerHTML = '';

    // ── FILTER BAR ────────────────────────────────────────────────────
    var filterBar = document.createElement('div');
    filterBar.style.cssText = 'display:flex;gap:5px;flex-wrap:wrap;padding:7px 10px;background:rgba(0,0,0,0.55);border-bottom:1px solid rgba(255,220,80,0.2);position:sticky;top:0;z-index:3;';
    [
      { key:'all',      label:'All' },
      { key:'wins',     label:'Wins ✓' },
      { key:'losses',   label:'Losses' },
      { key:'bonuses',  label:'Bonuses 🎰' },
      { key:'jackpots', label:'Jackpots 💰' },
    ].forEach(function(f) {
      var btn = document.createElement('button');
      btn.textContent = f.label;
      var isActive = f.key === filterMode;
      btn.style.cssText = 'font-size:10px;padding:3px 9px;border-radius:10px;border:1px solid rgba(255,220,80,' + (isActive ? '0.7' : '0.3') + ');background:' + (isActive ? 'rgba(245,197,24,0.22)' : 'rgba(0,0,0,0.3)') + ';color:' + (isActive ? '#f5d878' : 'rgba(255,255,255,0.45)') + ';cursor:pointer;';
      btn.addEventListener('click', function() { renderLogTab(tab, f.key); });
      filterBar.appendChild(btn);
    });
    logContent.appendChild(filterBar);

    // ── SPIN HISTORY SECTION ──────────────────────────────────────────
    var history = GameState.spinHistory || [];

    // Apply filter
    var filtered = history.filter(function(g) {
      if (filterMode === 'all') return true;
      var s   = g.summary || {};
      var net = s.netResult || 0;
      var hasBonuses  = g.bonuses && g.bonuses.length > 0;
      var hasJackpot  = g.bonuses && g.bonuses.some(function(b) {
        return b.outcome && b.outcome.jackpotType;
      });
      if (filterMode === 'wins')     return net > 0;
      if (filterMode === 'losses')   return net <= 0;
      if (filterMode === 'bonuses')  return hasBonuses;
      if (filterMode === 'jackpots') return hasJackpot;
      return true;
    });

    var statsHdr = document.createElement('div');
    statsHdr.style.cssText = 'padding:7px 10px;background:rgba(0,0,0,0.5);border-bottom:1px solid rgba(255,220,80,0.25);font-size:10px;color:var(--text-dim);';
    var stats = GameState.stats;
    var lRTP  = stats.totalWagered > 0 ? (stats.totalWon / stats.totalWagered * 100).toFixed(1) : '—';
    statsHdr.innerHTML = '<b style="color:var(--gold)">📊 ' + filtered.length.toLocaleString() + ' / ' + history.length.toLocaleString() + ' spins</b>'
      + ' · Wagered: $' + (stats.totalWagered||0).toFixed(2)
      + ' · Paid: $' + (stats.totalWon||0).toFixed(2)
      + ' · RTP: ' + lRTP + '%';
    logContent.appendChild(statsHdr);

    if (!filtered.length) {
      var noHist = document.createElement('p');
      noHist.style.cssText = 'color:var(--text-dim);padding:10px 20px;font-size:11px';
      noHist.textContent = history.length ? 'No spins match this filter.' : 'No spin history yet.';
      logContent.appendChild(noHist);
    } else {
      var slice = filtered.slice(0, 150);
      for (var hi = 0; hi < slice.length; hi++) {
        var g = slice[hi];
        var row = document.createElement('div');
        row.className = 'log-game-row';
        row.innerHTML = _formatGameRow(g);
        logContent.appendChild(row);
      }
      if (filtered.length > 150) {
        var more = document.createElement('div');
        more.style.cssText = 'text-align:center;color:var(--text-dim);padding:6px;font-size:10px';
        more.textContent = '… ' + (filtered.length - 150).toLocaleString() + ' more — use CSV export for full history';
        logContent.appendChild(more);
      }
    }

    // ── RAW EVENTS SECTION ────────────────────────────────────────────
    var evHdr = document.createElement('div');
    evHdr.style.cssText = 'padding:6px 10px;background:rgba(0,0,0,0.5);border-top:1px solid rgba(255,220,80,0.25);border-bottom:1px solid rgba(255,220,80,0.15);font-size:10px;color:var(--gold);margin-top:4px';
    evHdr.textContent = '🔍 RAW EVENT LOG (most recent first)';
    logContent.appendChild(evHdr);

    var allEvents = (GameState.eventLog.allEvents || []).slice().reverse();
    if (!allEvents.length) {
      var noEv = document.createElement('p');
      noEv.style.cssText = 'color:var(--text-dim);padding:10px 20px;font-size:11px';
      noEv.textContent = 'No events yet.';
      logContent.appendChild(noEv);
    } else {
      var evSlice = allEvents.slice(0, 150);
      for (var ei = 0; ei < evSlice.length; ei++) {
        var e = evSlice[ei];
        var detail = '';
        if (e.type === 'CASH_OUT' || e.type === 'CASH_IN') detail = 'Voucher ' + (e.voucherId||'') + ' $' + ((e.amount||0).toFixed(2));
        else if (e.totalWin != null) detail = 'Win: $' + (e.totalWin||0).toFixed(2);
        else if (e.amount != null)   detail = '$' + e.amount.toFixed(2);
        else if (e.bonusType)        detail = e.bonusType;
        // Add payline name if present
        if (e.type === 'SPIN_RESULT' && e.wins && e.wins.length) {
          var winNames = e.wins.filter(function(w) { return w.lineName; }).map(function(w) { return w.lineName; });
          if (winNames.length) detail += ' [' + winNames.slice(0,3).join(', ') + ']';
        }
        var typeColor = e.type === 'CASH_OUT' ? '#7dcc20' : e.type === 'CASH_IN' ? '#40a0ff' : 'var(--gold)';
        var eRow = document.createElement('div');
        eRow.className = 'log-event-row';
        eRow.innerHTML = '<span class="log-event-time">' + ((e.timeFormatted||'').slice(-8)) + '</span>'
          + '<span class="log-event-type" style="color:' + typeColor + '">' + e.type + '</span>'
          + '<span class="log-event-detail">' + detail + '</span>';
        logContent.appendChild(eRow);
      }
    }
  }

  function confirmClearHistory() {
    if (confirm('Clear all ' + (GameState.spinHistory ? GameState.spinHistory.length : 0) + ' spin history records? This cannot be undone.')) {
      clearSpinHistory();
      renderPanel(); // refresh button count
      UI.showToast('History cleared');
    }
  }

  function closeLogScreen() {
    var screen = $('log-screen');
    if (screen) screen.classList.remove('active');
  }

  // ── INIT ─────────────────────────────────────────────────────────────
  function init() {
    initTapZone();

    // PIN keypad listeners
    document.querySelectorAll('.pin-key').forEach(function(btn) {
      btn.addEventListener('click', function() { handlePinKey(btn.dataset.val); });
    });
    var pinOverlay = $('pin-overlay');
    if (pinOverlay) pinOverlay.addEventListener('click', function(e) {
      // v8.1.35: Ignore click-outside events within 500ms of opening.
      // The 5th tap (touchend) opens the overlay; the browser fires a paired
      // synthetic click ~300ms later that lands on the overlay background
      // (e.target === pinOverlay) and would close it instantly without this guard.
      if (Date.now() - _pinOpenedAt < 500) return;
      if (e.target === pinOverlay) hidePinEntry();
    });

    // Log screen close
    var logClose = $('log-close');
    if (logClose) logClose.addEventListener('click', closeLogScreen);
    var logTabs = document.querySelectorAll('.log-tab');
    logTabs.forEach(function(tab) { tab.addEventListener('click', function() {
      logTabs.forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');
      renderLogTab(tab.dataset.tab);
    }); });
  }

  return {
    init: init, closePanel: closePanel, showLog: showLog, confirmClearHistory: confirmClearHistory,
    applyRTP: applyRTP, applyBonusSettings: applyBonusSettings, resetRedSpinContinuance: resetRedSpinContinuance, setContinuance: setContinuance,
    setRSEntryTier: setRSEntryTier, setRSStepCount: setRSStepCount,
    toggleForce: toggleForce, setForceJP: setForceJP,
    selectJackpotType: selectJackpotType, setJackpotContext: setJackpotContext, armJackpot: armJackpot,
    disarmAll: disarmAll, toggleSection: toggleSection,
    armCombo: armCombo,
    toggleComboBonus: toggleComboBonus, toggleComboJP: toggleComboJP, setRSTier: setRSTier,
    setRSTierJP: setRSTierJP, armRSTierAll: armRSTierAll, clearRSTierMap: clearRSTierMap,
    setSweepTier: setSweepTier, armSweep: armSweep,
    applyReelStops: applyReelStops, clearReelStops: clearReelStops, setBalance: setBalance,
    resetJP: resetJP, resetAllJP: resetAllJP, resetGame: resetGame, factoryReset: factoryReset,
  };
}());
