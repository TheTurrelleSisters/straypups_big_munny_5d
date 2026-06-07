'use strict';
/**
 * cashout.js — The Turrelle Sisters Big Munny
 * Cash Out / Insert Cash voucher system.
 * Vouchers are stored in localStorage and the event log.
 * NOT redeemable for real cash — entertainment purposes only.
 */

var CashOut = (function() {
  var CASINO_NAME   = 'Lucky Bitches Casino';
  var VOUCHER_KEY   = 'turrelleSisters_vouchers_v1';
  var VOUCHER_PREFIX= 'LBC';

  // These MUST be declared — strict mode throws ReferenceError on undeclared assignment
  var insertCashFlashInterval = null;
  var insertCashFlashTimer    = null;



  // ── VOUCHER STORAGE ────────────────────────────────────────────────
  function loadVouchers() {
    try {
      var raw = localStorage.getItem(VOUCHER_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch(e) { return []; }
  }

  function saveVouchers(vouchers) {
    try { localStorage.setItem(VOUCHER_KEY, JSON.stringify(vouchers)); }
    catch(e) { console.warn('[CashOut] Save failed:', e); }
  }

  function generateVoucherId() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var id = VOUCHER_PREFIX + '-';
    for (var i = 0; i < 8; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
      if (i === 3) id += '-';
    }
    return id;
  }

  function formatTimestamp(ts) {
    var d = new Date(ts);
    // FIX-B5b v8.1.47: padStart() is ES2017 — replaced with ES5 zero-pad helper
    function pad(n) { var s = String(n); return s.length < 2 ? '0' + s : s; }
    return pad(d.getMonth()+1)+'/'+pad(d.getDate())+'/'+String(d.getFullYear()).slice(-2)+' '+pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds());
  }

  // ── CASH OUT ───────────────────────────────────────────────────────
  function doCashOut() {
    if (GameState.spinInProgress || GameState.activeBonus) {
      UI.showToast('Finish current game before cashing out.');
      return;
    }
    var amount = GameState.balance;
    if (amount <= 0) {
      UI.showToast('No credits to cash out.');
      return;
    }

    // Create voucher
    var voucher = {
      id:        generateVoucherId(),
      serialNumber: typeof _currentSpinSerial !== 'undefined' ? _currentSpinSerial : generateSerialNumber(),
      amount:    Math.round(amount * 100) / 100,
      issuedAt:  Date.now(),
      issuedStr: formatTimestamp(Date.now()),
      status:    'active',
    };

    // Save voucher
    var vouchers = loadVouchers();
    vouchers.unshift(voucher);
    saveVouchers(vouchers);

    // Reset balance
    GameState.balance = 0;
    saveState();

    // Log event
    logEvent('CASH_OUT', {
      bonusType:    'CASH_OUT',
      voucherId:    voucher.id,
      serialNumber: voucher.serialNumber,
      amount:       voucher.amount,
      issuedStr:    voucher.issuedStr,
      balanceAfter: 0,
    });

    if (typeof UI !== 'undefined') UI.updateBalance(0);

    // Show voucher
    showVoucherModal(voucher);

    Audio && Audio.play('credit_sweep');
    // ticker auto-starts via UI.updateBalance(0) above
  }

  // ── CREATE CUSTOM VOUCHER ─────────────────────────────────────────
  function doCreateVoucher() {
    hideWalletModal(); // Close wallet first to avoid z-index stacking
    setTimeout(showCreateVoucherModal, 150); // Brief delay for smooth transition
  }

  function showCreateVoucherModal() {
    var modal = document.getElementById('create-voucher-modal');
    if (modal) modal.classList.add('active');
  }

  function hideCreateVoucherModal() {
    var modal = document.getElementById('create-voucher-modal');
    if (modal) modal.classList.remove('active');
    var input = document.getElementById('cv-amount-input');
    if (input) input.value = '';
  }

  function confirmCreateVoucher() {
    var input = document.getElementById('cv-amount-input');
    if (!input) return;
    var amount = parseFloat(input.value);
    if (isNaN(amount) || amount <= 0) {
      var err = document.getElementById('cv-error');
      if (err) { err.textContent = 'Please enter a valid amount'; err.style.display = 'block'; }
      return;
    }
    var voucher = {
      id:        generateVoucherId(),
      amount:    Math.round(amount * 100) / 100,
      issuedAt:  Date.now(),
      issuedStr: formatTimestamp(Date.now()),
      status:    'active',
    };
    var vouchers = loadVouchers();
    vouchers.unshift(voucher);
    saveVouchers(vouchers);
    logEvent('VOUCHER_CREATED', {
      bonusType: 'VOUCHER_CREATED',
      voucherId: voucher.id,
      amount:    voucher.amount,
    });
    hideCreateVoucherModal();
    // Reopen wallet immediately so player sees and can use the new voucher
    setTimeout(function() {
      var active = loadVouchers().filter(function(v) { return v.status === 'active'; });
      showWalletModal(active);
    }, 180);
    if (typeof UI !== 'undefined') UI.showToast('Voucher $' + voucher.amount.toFixed(2) + ' ready!', 2000);
  }

  // ── JACKPOT CASH OUT ─────────────────────────────────────────────────
  // Called when player taps Cash Out on Major/Grand jackpot lock screen
  function doCashOutAmount(amount, label) {
    var voucher = {
      id:        generateVoucherId(),
      amount:    Math.round(amount * 100) / 100,
      issuedAt:  Date.now(),
      issuedStr: formatTimestamp(Date.now()),
      label:     label || 'JACKPOT',
      status:    'active',
    };
    var vouchers = loadVouchers();
    vouchers.unshift(voucher);
    saveVouchers(vouchers);
    logEvent('JACKPOT_CASHOUT', {
      bonusType:  'JACKPOT_CASHOUT',
      voucherId:  voucher.id,
      amount:     voucher.amount,
      label:      voucher.label,
    });
    if (typeof UI !== 'undefined') UI.showToast('Jackpot voucher $' + voucher.amount.toFixed(2) + ' saved!', 3000);
  }

  // ── INSERT CASH ────────────────────────────────────────────────────
  function doInsertCash() {
    var vouchers = loadVouchers().filter(function(v) { return v.status === 'active'; });
    showWalletModal(vouchers);
  }

  function redeemVoucher(voucherId) {
    var vouchers = loadVouchers();
    var idx = -1;
    for (var ri = 0; ri < vouchers.length; ri++) {
      if (vouchers[ri].id === voucherId && vouchers[ri].status === 'active') { idx = ri; break; }
    }
    if (idx < 0) { UI.showToast('Voucher not found or already used.'); return; }

    var voucher = vouchers[idx];
    voucher.status     = 'redeemed';
    voucher.redeemedAt = Date.now();
    saveVouchers(vouchers);

    GameState.balance += voucher.amount;
    saveState();

    logEvent('CASH_IN', {
      bonusType:    'CASH_IN',
      voucherId:    voucher.id,
      amount:       voucher.amount,
      redeemedStr:  formatTimestamp(Date.now()),
      balanceAfter: GameState.balance,
    });

    if (typeof UI !== 'undefined') UI.updateBalance(GameState.balance);
    hideWalletModal();
    if (typeof UI !== 'undefined') UI.stopInsertCashTicker();
    UI.showToast('💳 $' + voucher.amount.toFixed(2) + ' loaded — Good Luck!', 2500);
    if (typeof Audio !== 'undefined') Audio.play('win_small');
  }

  // ── ZERO BALANCE FLASH ─────────────────────────────────────────────
  function startZeroBalanceFlash() {
    stopZeroBalanceFlash();
    _flashMessage();
    insertCashFlashInterval = setInterval(function() {
      if (GameState.balance <= 0) _flashMessage();
      else stopZeroBalanceFlash();
    }, 5000);
  }

  function _flashMessage() {
    var el = document.getElementById('zero-balance-msg');
    if (!el) return;
    el.classList.add('visible');
    clearTimeout(insertCashFlashTimer);
    insertCashFlashTimer = setTimeout(function() { el.classList.remove('visible'); }, 2500);
  }

  function stopZeroBalanceFlash() {
    clearInterval(insertCashFlashInterval);
    clearTimeout(insertCashFlashTimer);
    var el = document.getElementById('zero-balance-msg');
    if (el) el.classList.remove('visible');
  }

  function checkZeroBalance() {
    if (GameState.balance <= 0) startZeroBalanceFlash();
    else stopZeroBalanceFlash();
  }

  // ── VOUCHER MODAL ──────────────────────────────────────────────────
  function showVoucherModal(voucher) {
    var modal = document.getElementById('voucher-modal');
    if (!modal) return;

    document.getElementById('vm-casino').textContent   = CASINO_NAME;
    document.getElementById('vm-amount').textContent   = '$' + voucher.amount.toFixed(2);
    document.getElementById('vm-id').textContent       = voucher.id;
    document.getElementById('vm-issued').textContent   = voucher.issuedStr;
    var serialEl = document.getElementById('vm-serial');
    if (serialEl) serialEl.textContent = voucher.serialNumber || '---';

    var bars = document.getElementById('vm-barcode');
    if (bars) {
      bars.innerHTML = '';
      var seed = voucher.id.split('').reduce(function(a,c) { return a + c.charCodeAt(0); }, 0);
      for (var bi = 0; bi < 40; bi++) {
        var bar = document.createElement('div');
        var w = ((seed * (bi+7) * 13) % 3) + 1;
        bar.style.cssText = 'display:inline-block;width:'+w+'px;height:40px;background:#000;margin:0 0.5px;vertical-align:top;';
        bars.appendChild(bar);
      }
    }

    modal.classList.add('active');
  }

  function hideVoucherModal() {
    var _vm = document.getElementById('voucher-modal');
    if (_vm) _vm.classList.remove('active');
  }

  // ── WALLET MODAL ───────────────────────────────────────────────────
  function showWalletModal(vouchers) {
    var modal   = document.getElementById('wallet-modal');
    var listEl  = document.getElementById('wallet-list');
    if (!modal || !listEl) return;

    listEl.innerHTML = '';

    if (vouchers.length === 0) {
      listEl.innerHTML = '<div class="wallet-empty">No vouchers in wallet.<br><span>Cash out during a session to create vouchers.</span></div>';
    } else {
      vouchers.forEach(function(v) {
        var row = document.createElement('div');
        row.className = 'wallet-row';
        row.innerHTML =
          '<div class="wallet-info">' +
            '<div class="wallet-id">' + v.id + '</div>' +
            '<div class="wallet-date">' + v.issuedStr + '</div>' +
          '</div>' +
          '<div class="wallet-amount">$' + v.amount.toFixed(2) + '</div>' +
          '<button class="wallet-use-btn" onclick="CashOut.redeemVoucher(\'' + v.id + '\')">INSERT</button>';
        listEl.appendChild(row);
      });
    }

    modal.classList.add('active');
  }

  function hideWalletModal() {
    var _wm = document.getElementById('wallet-modal');
    if (_wm) _wm.classList.remove('active');
  }

  // ── INIT ───────────────────────────────────────────────────────────
  function init() {
    var _cb = document.getElementById('cashout-btn');
    if (_cb) _cb.addEventListener('click', doCashOut);
    var _icb = document.getElementById('insertcash-btn');
    if (_icb) _icb.addEventListener('click', doInsertCash);
    var _cvc = document.getElementById('create-voucher-btn');
    if (_cvc) _cvc.addEventListener('click', doCreateVoucher);
    var _cvconf = document.getElementById('cv-confirm');
    if (_cvconf) _cvconf.addEventListener('click', confirmCreateVoucher);
    var _cvcan = document.getElementById('cv-cancel');
    if (_cvcan) _cvcan.addEventListener('click', hideCreateVoucherModal);
    var _vmc = document.getElementById('vm-close');
    if (_vmc) _vmc.addEventListener('click', hideVoucherModal);
    var _vmp = document.getElementById('vm-print');
    if (_vmp) _vmp.addEventListener('click', function() {
      hideVoucherModal();
      UI.showToast('Voucher saved to wallet ✓', 2000);
    });
    var _wc = document.getElementById('wallet-close');
    if (_wc) _wc.addEventListener('click', hideWalletModal);

    // Clear ALL stale overlay/modal states from previous session
    var staleOverlays = [
      'voucher-modal', 'wallet-modal', 'jackpot-overlay',
      'pick-screen', 'op-overlay', 'pin-overlay', 'log-screen',
    ];
    staleOverlays.forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.classList.remove('active');
    });
  }

  // v8.1.58: Factory reset support
  function clearAllVouchers() {
    try { localStorage.removeItem(VOUCHER_KEY); } catch(e) {}
  }

  return {
    init:                init,
    doCashOut:           doCashOut,
    doCreateVoucher:     doCreateVoucher,
    doCashOutAmount:     doCashOutAmount,
    doInsertCash:        doInsertCash,
    redeemVoucher:       redeemVoucher,
    checkZeroBalance:    checkZeroBalance,
    startZeroBalanceFlash: startZeroBalanceFlash,
    stopZeroBalanceFlash:  stopZeroBalanceFlash,
    loadVouchers:        loadVouchers,
    clearAllVouchers:    clearAllVouchers,
  };
})();
