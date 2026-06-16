
(function(){
'use strict';

var IMG_SCOTT=document.getElementById('img-scott');
var IMG_SPLASH=document.getElementById('img-splash');
var IMG_BANNER=document.getElementById('img-banner');
document.getElementById('hdr-img-el').src=IMG_BANNER.src;

/* â”€â”€ SPLASH â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
(function(){
  var sp=document.getElementById('splash');
  var sbg=document.getElementById('splash-bg');
  var bar=document.getElementById('splash-bar-fill');
  sbg.style.backgroundImage='url('+IMG_SPLASH.src+')';
  var pct=0;
  var iv=setInterval(function(){pct+=1.6;if(pct>=100){pct=100;clearInterval(iv);}bar.style.width=pct+'%';},30);
  var canDismiss=false;
  setTimeout(function(){canDismiss=true;},800);
  sndWelcome();
  function dismiss(){sp.classList.add('fade');setTimeout(function(){sp.style.display='none';sizeLayout();},600);}
  /* 5s auto-dismiss — gives DB time to connect and fetch ball call before game shows */
  setTimeout(dismiss,5000);
  sp.addEventListener('click',function(){if(canDismiss)dismiss();});
  sp.addEventListener('touchend',function(e){e.preventDefault();if(canDismiss)dismiss();});
}());

/* â”€â”€ LAYOUT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
var _lastBingoH=0; var _lastVpw=0; // cached layout values for re-renders
function sizeLayout(){
  var vph=window.innerHeight; var vpw=window.innerWidth;
  // Header: banner is exactly 4:1 — derive height from width so it fits perfectly
  var hdrH=Math.round(vpw/4);
  var hdrEl=document.getElementById('hdr-img');
  var hdrImg=document.getElementById('hdr-img-el');
  hdrEl.style.height=hdrH+'px';
  hdrImg.style.width='100%'; hdrImg.style.height=hdrH+'px';
  hdrImg.style.objectFit='contain'; hdrImg.style.objectPosition='center center';
  // Bingo section: 32% of remaining height (subtract prog-meter if present)
  var progMeterEl=document.getElementById('prog-meter');
  var progMeterH=progMeterEl?progMeterEl.offsetHeight:0;
  var remH=vph-hdrH-progMeterH;
  var bingoH=Math.round(remH*0.32);
  document.getElementById('bingo-section').style.height=bingoH+'px';
  sizeBingoElements(bingoH, vpw);
  _lastBingoH=bingoH; _lastVpw=vpw;
  _cardNodes=null; // force card rebuild on layout change
  // NOTE: _ballNodes is NEVER nulled — ball nodes survive layout changes.
  // sizeBingoElements updates their styles in-place. Nulling caused DOM rebuild
  // inside setInterval callNext, throttling Samsung Browser timer scheduler.
  setTimeout(function(){
    initReelSlots();
    if(!_ballNodes||_ballNodes.length<75) buildBallStrip();
    if(!_cardNodes||_cardNodes.length<25) buildBingoCardNodes();
    setTimeout(function(){ if(_reelWinH===0) initReelSlots(); },300);
  },100);
}

function sizeBingoElements(bingoH, vpw){
  // Derive everything from vpw first so card width is always predictable.
  // Card = 34% of vpw — narrower gives ball strip more room for readable slots.
  var cardW=Math.round(vpw*0.34);
  var cellW=Math.max(10, Math.floor((cardW-4)/5)); // 4px = 4 gaps of 1px
  var cardWrapW=(cellW*5)+4;
  // Cell height: square, but also cap so 5 rows + col-header fit in bingoH
  var nameH=18; var padV=5;
  var hdrFontSz=Math.max(10, Math.round(cellW*0.60));
  var colHdrH=Math.round(hdrFontSz*1.25);
  var maxCellFromH=Math.max(10, Math.floor((bingoH-nameH-padV-colHdrH-5)/5));
  var cellH=Math.min(cellW, maxCellFromH); // never taller than wide, never overflows
  var cellFontSz=Math.max(8, Math.round(cellH*0.58));
  // Apply card cell sizes
  var grid=document.getElementById('bingo-grid');
  if(grid){
    grid.style.gridTemplateColumns='repeat(5,'+cellW+'px)';
    var cells=grid.querySelectorAll('.bc');
    for(var i=0;i<cells.length;i++){
      cells[i].style.height=cellH+'px';
      cells[i].style.width=cellW+'px';
      cells[i].style.fontSize=cellFontSz+'px';
      cells[i].style.minWidth=cellW+'px';
      cells[i].style.maxWidth=cellW+'px';
    }
  }
  // Apply col-header sizes
  var hdrs=document.getElementById('bingo-col-hdrs');
  if(hdrs){
    hdrs.style.gridTemplateColumns='repeat(5,'+cellW+'px)';
    hdrs.style.width=cardWrapW+'px';
    var hdrCells=hdrs.querySelectorAll('.bcol-hdr');
    for(var h=0;h<hdrCells.length;h++){
      hdrCells[h].style.width=cellW+'px';
      hdrCells[h].style.minWidth=cellW+'px';
      hdrCells[h].style.maxWidth=cellW+'px';
      hdrCells[h].style.fontSize=hdrFontSz+'px';
      hdrCells[h].style.lineHeight=colHdrH+'px';
    }
  }
  // Lock card wrap width hard
  var cardWrap=document.getElementById('bingo-card-wrap');
  if(cardWrap){
    cardWrap.style.width=cardWrapW+'px';
    cardWrap.style.minWidth=cardWrapW+'px';
    cardWrap.style.maxWidth=cardWrapW+'px';
    cardWrap.style.flexShrink='0';
  }
  // Ball strip: remaining width after card + 4px gap (no labels)
  var stripW=vpw-cardWrapW-4-8; // 4px gap, 8px total horizontal padding
  // 15 slots per row, 14 gaps of 1px between them
  var slotW=Math.max(7, Math.floor((stripW-14)/15));
  var ballFontSz=Math.max(6, Math.round(slotW*0.70));
  var ballH=cellH;
  var bsGrid=document.getElementById('ball-strip-grid');
  if(bsGrid){
    bsGrid.style.width=stripW+'px';
    // Cache sizing values so renderBallStrip can apply them without re-calling sizeBingoElements
    bsGrid._slotW=slotW; bsGrid._ballH=ballH; bsGrid._ballFontSz=ballFontSz; bsGrid._stripW=stripW;
    var rows=bsGrid.querySelectorAll('.bsr');
    for(var r=0;r<rows.length;r++){
      rows[r].style.height=ballH+'px';
      rows[r].style.width=stripW+'px';
    }
    var balls=bsGrid.querySelectorAll('.ball');
    for(var j=0;j<balls.length;j++){
      balls[j].style.width=slotW+'px';
      balls[j].style.minWidth=slotW+'px';
      balls[j].style.maxWidth=slotW+'px';
      balls[j].style.height=ballH+'px';
      balls[j].style.fontSize=ballFontSz+'px';
      balls[j].style.flex='none';
      balls[j].style.overflow='hidden';
    }
  }
}

function initReelSlots(){
  var reel=document.getElementById('r0'); if(!reel) return;
  var h=reel.offsetHeight; if(h<10) return;
  SLOT_H=Math.floor(h/3);
  var rw=document.getElementById('rw0');
  var rwH=rw?rw.clientHeight:0;
  if(rwH>0) _reelWinH=rwH;
  renderReels(CURRENT_SYMS,CURRENT_GHOSTS);
}
sizeLayout();
window.addEventListener('resize',function(){sizeLayout();setTimeout(initReelSlots,60);});
window.addEventListener('orientationchange',function(){setTimeout(function(){sizeLayout();initReelSlots();},250);});
window.addEventListener('load',function(){setTimeout(initReelSlots,100);});

/* â”€â”€ SOUND â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function playOnce(id){var el=document.getElementById(id);if(!el)return;try{el.pause();el.currentTime=0;el.loop=false;el.play();}catch(e){}}
function playLoop(id){var el=document.getElementById(id);if(!el)return;try{el.pause();el.currentTime=0;el.loop=true;el.play();}catch(e){}}
function stopSound(id){var el=document.getElementById(id);if(!el)return;try{el.pause();el.currentTime=0;el.loop=false;}catch(e){}}
var AudioCtx=window.AudioContext||window.webkitAudioContext; var ac=null;
function getAC(){if(!ac){try{ac=new AudioCtx();}catch(e){}}return ac;}
function sndSpinStart(){var ctx=getAC();if(!ctx)return;var n=ctx.createOscillator();var g=ctx.createGain();n.connect(g);g.connect(ctx.destination);n.type='sawtooth';n.frequency.setValueAtTime(180,ctx.currentTime);n.frequency.exponentialRampToValueAtTime(80,ctx.currentTime+0.18);g.gain.setValueAtTime(0.18,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.18);n.start();n.stop(ctx.currentTime+0.18);}
function sndReelStop(){var ctx=getAC();if(!ctx)return;var b=ctx.createOscillator();var g=ctx.createGain();b.connect(g);g.connect(ctx.destination);b.type='sine';b.frequency.setValueAtTime(220,ctx.currentTime);b.frequency.exponentialRampToValueAtTime(110,ctx.currentTime+0.07);g.gain.setValueAtTime(0.25,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.12);b.start();b.stop(ctx.currentTime+0.12);}
function sndSmallWin(){playOnce('snd-ring');}
function sndBigWin(){playOnce('snd-ring');}
function sndJackpot(){playOnce('snd-ring');}
function sndCreditsAddUp(){playOnce('snd-credits');}
function sndRedSpin(){stopSound('snd-ring');playLoop('snd-redspin');}
function sndRedSpinEnd(){stopSound('snd-redspin');}
function sndBonusSpin(){playOnce('snd-ring');}
function sndWelcome(){playOnce('snd-welcome');}

/* â”€â”€ RNG â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function RNG(){this.b=new Uint32Array(64);this.i=64;}
RNG.prototype.fill=function(){crypto.getRandomValues(this.b);this.i=0;};
RNG.prototype.next=function(){if(this.i>=this.b.length)this.fill();return this.b[this.i++]/0x100000000;};
RNG.prototype.int=function(lo,hi){return Math.floor(this.next()*(hi-lo+1))+lo;};
RNG.prototype.pct=function(p){return this.next()<p;};
RNG.prototype.shuffle=function(arr){for(var i=arr.length-1;i>0;i--){var j=this.int(0,i);var t=arr[i];arr[i]=arr[j];arr[j]=t;}return arr;};
var rng=new RNG();

/* Game data (PAY, STRIPS, BINGO_PATTERNS, etc.) loaded from js/config.js */

/* Reel combo symbol arrays: 0=SP 1=7 2=3Bar 3=2Bar 4=1Bar 5=Cherry 6=Blank */
var REEL_SYMS={
  'jp':[0,0,0],'7':[1,1,1],'3b':[2,2,2],'2b':[3,3,3],
  '1b':[4,4,4],'ch3':[5,5,5],'mb':[2,3,4],'ch2':[5,5,4],
  'ch1':[5,4,3],'7w2':[0,1,1],'3bw2':[0,2,2],'2bw2':[0,3,3],
  '1bw2':[0,4,4],'spmb':[0,2,3],'spch':[0,5,4],'7w4':[0,0,1],
  '3bw4':[0,0,2],'2bw4':[0,0,3],'1bw4':[0,0,4],'spspch':[0,0,5],
  'spchch':[0,5,5],'none':[4,2,3],
  'coverall':[7,7,7]
};

/* â”€â”€ BINGO CARD STATE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
var BG={
  card:[],cardSerial:'',callSeq:[],cardNumSet:{},matchedCells:{},
  winPatterns:[],ballPos:0,entTimer:null,patternCycle:null,cycleIdx:0,
  _coverAll1to40:false,usingServerBalls:false,seqExhausted:false
};
var COL_RANGES=[[1,15],[16,30],[31,45],[46,60],[61,75]];

function cardFingerprint(card){
  // Compact string of all 24 numbers in order (null=0)
  var parts=[];
  for(var i=0;i<25;i++) parts.push(card[i]===null?0:card[i]);
  return parts.join(',');
}

function loadUsedCards(){
  try{
    var raw=localStorage.getItem('spbm_used_cards');
    return raw?JSON.parse(raw):{};
  }catch(e){return{};}
}

function saveUsedCard(fp){
  try{
    var used=loadUsedCards();
    used[fp]=1;
    // Keep only last 1000 fingerprints to avoid storage bloat
    var keys=Object.keys(used);
    if(keys.length>1000){
      var toDelete=keys.slice(0,keys.length-1000);
      for(var i=0;i<toDelete.length;i++) delete used[toDelete[i]];
    }
    localStorage.setItem('spbm_used_cards',JSON.stringify(used));
  }catch(e){}
}

function genBingoCard(){
  var used=loadUsedCards();
  var card, fp, attempts=0;
  do {
    card=[];
    for(var col=0;col<5;col++){
      var lo=COL_RANGES[col][0],hi=COL_RANGES[col][1];
      var pool=[];
      for(var n=lo;n<=hi;n++) pool.push(n);
      rng.shuffle(pool);
      for(var row=0;row<5;row++) card.push(pool[row]);
    }
    var ordered=[];
    for(var r2=0;r2<5;r2++) for(var c2=0;c2<5;c2++) ordered.push(card[c2*5+r2]);
    ordered[12]=null;
    fp=cardFingerprint(ordered);
    attempts++;
    // After 50 attempts just accept it (astronomically unlikely to need this)
    if(attempts>50) break;
  } while(used[fp]);
  saveUsedCard(fp);
  // Assign permanent card serial from localStorage counter
  try{
    var cnt=parseInt(localStorage.getItem('spbm_card_ctr')||'0',10)+1;
    localStorage.setItem('spbm_card_ctr',String(cnt));
    BG.cardSerial='CARD-'+String(cnt).padStart(8,'0');
  }catch(e){BG.cardSerial='CARD-UNKNOWN';}
  return ordered.length?ordered:card;
}

// opLog is defined in operator.js; stub here so game.js never throws
function opLog(rec){if(typeof opLogImpl==='function') opLogImpl(rec); _writeGameHistory(rec);}

/* _writeGameHistory — writes every game event to Supabase game_history table.
   Non-blocking fire-and-forget. Never stalls the game.
   Requires Progressive to be connected (has the Supabase client). */
function _writeGameHistory(rec) {
  if (typeof Progressive === 'undefined' || !Progressive.isConnected()) {
    console.warn('[GameHistory] SKIPPED — Progressive not connected (isConnected()=false)');
    return;
  }
  var _client = window._floorSupabaseClient;
  if (!_client) {
    console.warn('[GameHistory] SKIPPED — window._floorSupabaseClient not set');
    return;
  }
  var _denom = (typeof DENOM !== 'undefined' ? DENOM : 1);
  var _gameId = (typeof PROG_GAME_ID !== 'undefined') ? PROG_GAME_ID : 'straypups_1d';
  var _gameTitle = _gameId === 'straypups_5d' ? 'StrayPups Big Munny $5' : 'StrayPups Big Munny $1';
  var row = {
    game_id:       _gameId,
    game_title:    _gameTitle,
    denom:         _denom,
    event_type:    rec.type || 'SPIN',
    game_serial:   rec.gameSerial   || null,
    card_serial:   rec.cardSerial   || null,
    session_key:   typeof Progressive !== 'undefined' ? Progressive.getSessionKey() : null,
    nickname:      window._playerNickname || null,
    bet:           parseFloat(rec.bet)       || 0,
    win:           parseFloat(rec.win)       || 0,
    bal_before:    parseFloat(rec.balBefore) || 0,
    bal_after:     parseFloat(rec.balAfter)  || 0,
    patterns:      (rec.patterns && rec.patterns.length) ? rec.patterns : [],
    balls_to_win:  rec.balls        || 0,
    is_progressive:rec.isProgressive || false,
    prog_amount:   rec.progAmount   || null,
    archived:      false
  };
  /* CASH_IN stores amount in bet field; CASH_OUT stores in win field */
  if (rec.type === 'CASH_IN')  { row.bet = parseFloat(rec.amount) || 0; row.win = 0; }
  if (rec.type === 'CASH_OUT') { row.win = parseFloat(rec.amount) || 0; row.bet = 0; }
  try {
    _client.from('game_history').insert(row).then(function(res){
      if (res && res.error) console.warn('[GameHistory] insert FAILED:', res.error.message, row);
    });
  } catch(e) { console.warn('[GameHistory] insert threw:', e); }
}
function genGameSerial(){
  var t=Date.now().toString(16);
  var r=Math.floor(Math.random()*0xffff).toString(16).toUpperCase();
  return 'GAME-'+t.toUpperCase()+r;
}

/* genBallCall — local CSPRNG fallback (used offline or as initial state) */
function genBallCall(){
  var balls=[];
  for(var i=1;i<=75;i++) balls.push(i);
  return rng.shuffle(balls);
}

/* updateBallCallBadge — shows LIVE or LOCAL in the UI */
function updateBallCallBadge(){
  var el=document.getElementById('ball-call-badge');
  if(!el) return;
  if(BG.usingServerBalls){
    el.textContent='\u25cf LIVE';
    el.style.color='#00ff88';
  } else {
    el.textContent='\u25cf LOCAL';
    el.style.color='#ffaa00';
  }
}

/* refreshServerBallCall — called when ball 75 exhausted or Cover All fires.
   Online:  calls upsert_ball_call → new sequence → all clients get it via realtime.
   Offline: keeps existing sequence if loaded, generates local only if nothing in memory.
            Schedules background resync every 10s until connection returns.
*/
function refreshServerBallCall(cb) {
  if (typeof Progressive === 'undefined' || !Progressive.isConnected()) {
    /* Offline — keep current sequence if we have one, otherwise generate locally */
    if (!BG.callSeq || BG.callSeq.length !== 75) {
      BG.callSeq = genBallCall();
    }
    BG.usingServerBalls = false;
    updateBallCallBadge();
    if (cb) cb(BG.callSeq);
    /* Schedule background resync attempt every 10s */
    _scheduleResync();
    return;
  }
  Progressive.refreshBallCall(function(seq, isServer) {
    BG.callSeq = seq;
    BG.usingServerBalls = isServer;
    updateBallCallBadge();
    if (cb) cb(BG.callSeq);
  });
}

/* _scheduleResync — quietly attempts to get back on the server sequence 
   after a connection loss. Cancels itself once back online. */
var _resyncTimer = null;
function _scheduleResync() {
  if (_resyncTimer) return; /* already scheduled */
  _resyncTimer = setInterval(function() {
    if (typeof Progressive === 'undefined' || !Progressive.isConnected()) return;
    /* Back online — fetch current server sequence and adopt it */
    Progressive.getBallCall(function(seq, isServer) {
      if (!isServer) return;
      clearInterval(_resyncTimer); _resyncTimer = null;
      /* Only adopt if we're between rounds (not mid-entertainment phase) */
      if (BG.ballPos >= 40) {
        BG.callSeq = seq;
        BG.usingServerBalls = true;
        updateBallCallBadge();
        /* Repopulate strip with server balls */
        if (BG.card) renderBallStrip(BG.callSeq, Math.min(BG.ballPos, 40), BG.cardNumSet);
      }
    });
  }, 10000);
}

/* â”€â”€ BINGO CARD RENDER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
/* Bingo card DOM nodes — built once, updated in-place (no innerHTML rebuild) */
var _cardNodes=null;
function buildBingoCardNodes(){
  var grid=document.getElementById('bingo-grid');
  grid.innerHTML='';_cardNodes=[];
  for(var i=0;i<25;i++){
    var cell=document.createElement('div');
    cell.className='bc'+(i===12?' free':'');
    cell.textContent=i===12?'*':'';
    grid.appendChild(cell);_cardNodes.push(cell);
  }
  if(_lastBingoH>0) sizeBingoElements(_lastBingoH,_lastVpw);
}
function renderBingoCard(card,matchedCells,winPatternCells){
  if(!_cardNodes||_cardNodes.length<25) buildBingoCardNodes();
  // Free space (cell 12) is always daubed — auto-mark it every render
  if(matchedCells) matchedCells[12]=true;
  var wpSet={};
  if(winPatternCells){for(var wi=0;wi<winPatternCells.length;wi++) wpSet[winPatternCells[wi]]=true;}
  for(var i=0;i<25;i++){
    var cell=_cardNodes[i];
    var isFree=(i===12);
    var isDaubed=!!matchedCells[i];
    var isWin=!!wpSet[i];
    var cls='bc';
    if(isFree){
      cls+=isWin?' free-winning':' free';
      cls+=' daubed'; // free space always shown as daubed
    } else if(isWin) cls+=' winning';
    else if(isDaubed) cls+=' daubed';
    cell.className=cls;
    cell.textContent=isFree?'*':(card&&card[i]?card[i]:'');
  }
}

/* â”€â”€ BALL STRIP RENDER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
var _ballNodes=null;
function buildBallStrip(){
  var bsGrid=document.getElementById('ball-strip-grid');
  bsGrid.innerHTML='';_ballNodes=[];
  for(var row=0;row<5;row++){
    var rowDiv=document.createElement('div');rowDiv.className='bsr';
    for(var col=0;col<15;col++){
      var div=document.createElement('div');div.className='ball empty';div.textContent='';
      if(bsGrid._slotW){
        div.style.width=bsGrid._slotW+'px';div.style.minWidth=bsGrid._slotW+'px';
        div.style.maxWidth=bsGrid._slotW+'px';div.style.height=bsGrid._ballH+'px';
        div.style.fontSize=bsGrid._ballFontSz+'px';div.style.flex='none';div.style.overflow='hidden';
      }
      rowDiv.appendChild(div);_ballNodes.push(div);
    }
    bsGrid.appendChild(rowDiv);
  }
}
function renderBallStrip(callSeq,calledCount,cardNumSet){
  /* Ball strip display rules:
     - Balls 1-40 (pre-called): appear ALL AT ONCE instantly when spin resolves.
       Yellow = called, not on card. Pink = called AND on card.
     - Balls 41-75 (entertainment): fill in ONE AT A TIME every 1.3s via _activeCallNext.
       White = called in entertainment phase.
     - Uncalled cells (i >= calledCount): always empty — no number shown until called.
     - Before first spin: strip is fully empty.
  */
  if(!_ballNodes||_ballNodes.length<75) buildBallStrip();
  for(var i=0;i<75;i++){
    var node=_ballNodes[i];
    if(i<calledCount){
      var ball=callSeq[i];var isPre=(i<40);var isMatch=(cardNumSet[ball]!==undefined);
      node.textContent=ball;
      if(isPre&&isMatch)       node.className='ball match';
      else if(isPre&&!isMatch) node.className='ball pre';
      else                     node.className='ball called';
    } else {
      node.className='ball empty';node.textContent='';
    }
  }
}
function clearBallStrip(){
  if(!_ballNodes||_ballNodes.length<75) buildBallStrip();
  for(var i=0;i<75;i++){_ballNodes[i].className='ball empty';_ballNodes[i].textContent='';}
}

/* â”€â”€ CHECK PATTERNS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function checkPatterns(matchedCells){
  var matched=[];
  for(var pi=0;pi<BINGO_PATTERNS.length;pi++){
    var pat=BINGO_PATTERNS[pi]; var ok=true;
    for(var ci=0;ci<pat.cells.length;ci++){
      var cell=pat.cells[ci];
      if(cell===12) continue;
      if(!matchedCells[cell]){ok=false;break;}
    }
    if(ok) matched.push(pat);
  }
  matched.sort(function(a,b){return b.pay[0]-a.pay[0];});
  return matched;
}

/* â”€â”€ PATTERN CYCLE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function startPatternCycle(winPatterns){
  stopPatternCycle();
  if(!winPatterns||winPatterns.length===0){
    document.getElementById('bingo-pattern-name').textContent='\u00a0';
    return;
  }
  BG.cycleIdx=0;
  function showNext(){
    var pat=winPatterns[BG.cycleIdx%winPatterns.length];
    document.getElementById('bingo-pattern-name').textContent=pat.name.toUpperCase();
    renderBingoCard(BG.card,BG.matchedCells,pat.cells);
    BG.cycleIdx++;
  }
  showNext();
  // Always cycle continuously regardless of pattern count — flashes until next spin
  BG.patternCycle=setInterval(showNext,2000);
}
function stopPatternCycle(){
  if(BG.patternCycle){clearInterval(BG.patternCycle);BG.patternCycle=null;}
  document.getElementById('bingo-pattern-name').textContent='\u00a0';
}


/* -- GAME STATE -- */
// GS.state: 'idle'=never spun, 'active'=has spun, 'demo'=$0+30s
var GS={state:'idle',demoTimer:null,hasSpun:false};

function enterDemo(){
  GS.state='demo';
  clearBallStrip();
  _cardNodes=null; // invalidate card nodes — rebuilt cleanly on next renderBingoCard
  document.getElementById('bingo-col-hdrs').style.display='none';
  document.getElementById('bingo-pattern-name').textContent='\u00a0';
  startPatternShowcase();
}
function exitDemo(){
  GS.state='active';
  if(GS.demoTimer){clearTimeout(GS.demoTimer);GS.demoTimer=null;}
  stopPatternShowcase();
  document.getElementById('bingo-col-hdrs').style.display='';
  buildBingoCardNodes(); // rebuild card with col-hdrs now visible
}
function checkDemoTrigger(){
  if(S.bal<=0&&GS.state==='active'){
    if(GS.demoTimer) return;
    GS.demoTimer=setTimeout(function(){if(S.bal<=0) enterDemo();},30000);
  } else if(S.bal>0&&GS.demoTimer){
    clearTimeout(GS.demoTimer);GS.demoTimer=null;
  }
}

/* -- PATTERN SHOWCASE (idle + demo) -- */
var _showcaseTimer=null; var _showcaseIdx=0;
function startPatternShowcase(){
  stopPatternShowcase();
  _showcaseIdx=0;
  _showNextPattern();
}
function stopPatternShowcase(){
  if(_showcaseTimer){clearTimeout(_showcaseTimer);_showcaseTimer=null;}
}
function _showNextPattern(){
  if(GS.state!=='idle'&&GS.state!=='demo') return;
  var pat=BINGO_PATTERNS[_showcaseIdx%BINGO_PATTERNS.length];
  _showcaseIdx++;
  var nameEl=document.getElementById('bingo-pattern-name');
  nameEl.style.color='#f5d878';
  // Empty white cells — no numbers shown during demo/idle showcase
  var dummyCells=[];
  for(var i=0;i<25;i++) dummyCells.push(i===12?null:0); // 0 = empty, null = free space
  var patMatched={12:true};
  for(var ci=0;ci<pat.cells.length;ci++) patMatched[pat.cells[ci]]=true;
  renderBingoCard(dummyCells,patMatched,pat.cells);
  // Set name after renderBingoCard so it's the final text shown
  if(pat.isProgressive){
    nameEl.textContent='\u2605 WIDE AREA PROGRESSIVE \u2605 — Cover All in '+pat.balls+' Balls';
    nameEl.style.color='#ffd700';
  } else {
    nameEl.textContent=pat.name.toUpperCase()+' — In '+pat.balls+' Balls | $'+pat.pay[0]+'/$'+pat.pay[1]+'/$'+pat.pay[2];
  }
  _showcaseTimer=setTimeout(_showNextPattern,2500);
}

/* ── BALL CALLER LIFECYCLE ─────────────────────────────────────────────────

   SILENT caller (1.3s, no display):
     1. Game load — before first SPIN ever
     2. Cover All achieved AND player is idle (GS.hasSpun but not actively spinning)

   ACTIVE caller (1.5s, displays on card and strip):
     - Starts on first SPIN, never stops during active play
     - Continues through reel spin, Red Spin, between spins, all 75 balls
     - When 75 balls called: new sequence seamlessly, active caller continues
     - When Cover All while idle: flash, new sequence, switch to silent
     - When Cover All while spinning: flash, new sequence, active caller continues

   WATCHDOG: removed — lifecycle is deterministic, no safety net needed.
────────────────────────────────────────────────────────────────────────── */

/* -- SILENT CALLER (game load + Cover All idle only) -- */
var _silentTimer=null;
function startSilentCaller(){
  /* Silent caller: player is idle — keep sequence current but do NOT advance ballPos.
     ballPos is only advanced by _activeCallNext during active gameplay.
     Between spins the sequence stays frozen at current position. */
  stopSilentCaller();
  stopActiveCaller(); // silent and active are mutually exclusive
  /* No-op timer — sequence stays live via realtime subscription */
  /* _silentTimer removed — was a 30s no-op interval. Sequence stays
     live via realtime subscription; no timer needed when idle. */
}
function stopSilentCaller(){
  if(_silentTimer){clearInterval(_silentTimer);_silentTimer=null;}
}

/* -- ACTIVE CALLER (all active play) -- */
function startActiveCaller(){
  stopActiveCaller();
  stopSilentCaller(); // active takes over from silent
  /* Ball call interval randomized 3.2-3.5s (was fixed 1.5s) — gives players
     more time to see/react to each new ball. */
  function _tick(){
    _activeCallNext();
    if(BG.entTimer!==null) BG.entTimer=setTimeout(_tick,rng.int(3200,3500));
  }
  BG.entTimer=setTimeout(_tick,rng.int(3200,3500));
}
function stopActiveCaller(){
  if(BG.entTimer){clearTimeout(BG.entTimer);BG.entTimer=null;}
}
function _activeCallNext(){
  BG.ballPos=(BG.ballPos||0)+1;
  /* Update DB ball position so joining players start at correct ball */
  if(typeof Progressive!=='undefined' && Progressive.updateBallPos) {
    Progressive.updateBallPos(BG.ballPos);
  }
  if(BG.ballPos>=75){
    /* Sequence exhausted — stop caller, request new sequence immediately.
       Wide area: request new sequence from DB and broadcast to all players.
       New sequence arrives via WABC.onNewCall() before next spin press.
       Local: genBallCall() runs on next spin press via doBingoSpin(). */
    stopActiveCaller();
    BG.seqExhausted=true;
    _requestNewWABCSequence();
    return;
  }
  var newBall=BG.callSeq[BG.ballPos-1];
  // Daub card if ball matches
  if(BG.card&&BG.cardNumSet&&BG.cardNumSet[newBall]!==undefined){
    BG.matchedCells[BG.cardNumSet[newBall]]=true;
    renderBingoCard(BG.card,BG.matchedCells,null);
  }
  if(BG.card) renderBallStrip(BG.callSeq,BG.ballPos,BG.cardNumSet);
  // Cover All check (balls 41-75 entertainment phase)
  /* !BG.seqExhausted guard: for a progressive/Lazy-T spin, all 25 cells
     are ALREADY matched from the initial 40-ball cover-all setup (before
     entertainment calling even starts), and _handleCoverAll(true) already
     ran + requested a new sequence at spin-result time. Without this
     guard, the FIRST entertainment tick (ball 41) would see
     matchedCells.length===25 again and re-trigger _handleCoverAll, which
     calls stopActiveCaller() — freezing ball-calling at 41 for the entire
     Red Spin sequence. The guard lets calling continue normally (41-75)
     during Red Spin, in sync with the new shared sequence once it arrives
     via WABC.onNewCall. For a genuine FIRST-TIME cover-all reached during
     balls 41-75 (non-progressive), seqExhausted is still false here, so
     existing behavior is unchanged. */
  if(BG.card&&Object.keys(BG.matchedCells).length===25&&!BG.seqExhausted){
    _handleCoverAll(false); // no penny — entertainment phase
  }
}

/* -- COVER ALL HANDLER -- */
function _handleCoverAll(hasPenny){
  var nameEl=document.getElementById('bingo-pattern-name');
  nameEl.textContent=hasPenny?'GAME END — COVER ALL $0.01':'GAME END — COVER ALL';
  nameEl.style.color='#ffcc00';
  if(hasPenny){S.bal+=0.01;updUI();}
  /* v5.40: Stop caller and freeze — new sequence is picked up on next spin press.
     Wide area: player re-syncs to WABC live position on spin.
     Local: doBingoSpin() generates new sequence on spin press.
     Do NOT fetch or generate a new sequence here. */
  stopActiveCaller();
  BG.seqExhausted=true;
  updateBallCallBadge();
  /* Cover All — request new sequence for all players */
  _requestNewWABCSequence();
  setTimeout(function(){
    nameEl.textContent=' ';nameEl.style.color='';
  },2500);
}

/* Legacy aliases so existing call sites don't break */
function startEntertainmentBalls(){startActiveCaller();}
function stopEntertainmentBalls(){stopActiveCaller();}


/* generateCoverAllSpin — called when force jackpot fires.
   Builds a special bingo card using 25 numbers drawn from the first 40
   balls of the current WABC sequence (the pre-called zone). With 40
   numbers to choose from there's always enough per column (avg 8 vs
   4-5 needed), eliminating any "not enough numbers" fallback.
   All 25 cells are within the pre-called zone, so per normal bingo
   rules they're already-called — natural-feeling guaranteed Cover All.
   Column constraints: B=1-15, I=16-30, N=31-45, G=46-60, O=61-75.
   Cell 12 (free space) always null and always pre-daubed.
   usingServerBalls stays true throughout — LIVE badge never changes.
   Returns array of winning patterns found within 25 balls. */
function generateCoverAllSpin(){
  var seq = BG.callSeq;
  if (!seq || seq.length < 75) {
    seq = genBallCall();
  }

  /* Build card from the first 24 numbers in the live ball call sequence,
     fitting each into its correct B/I/N/G/O column + free space at cell 12.
     This guarantees all 24 numbers land within the first 40 balls (pre-called
     zone), so the card is a natural Cover All by design — but pattern wins are
     determined honestly by the ball-by-ball evaluation below, not forced. */
  var pool = seq.slice(0, 40);
  var colRanges = COL_RANGES;
  var card = [];
  var used = {};

  for (var col = 0; col < 5; col++) {
    var lo = colRanges[col][0];
    var hi = colRanges[col][1];
    var needed = (col === 2) ? 4 : 5;
    var colNums = [];
    for (var si = 0; si < pool.length && colNums.length < needed; si++) {
      var ball = pool[si];
      if (ball >= lo && ball <= hi && !used[ball]) {
        colNums.push(ball);
        used[ball] = true;
      }
    }
    if (colNums.length < needed) {
      for (var n = lo; n <= hi && colNums.length < needed; n++) {
        if (!used[n]) { colNums.push(n); used[n] = true; }
      }
    }
    var rowIdx = 0;
    for (var row = 0; row < 5; row++) {
      if (col === 2 && row === 2) {
        card[col * 5 + row] = null;
      } else {
        card[col * 5 + row] = colNums[rowIdx++];
      }
    }
  }

  var ordered = [];
  for (var r = 0; r < 5; r++) {
    for (var c = 0; c < 5; c++) {
      ordered.push(card[c * 5 + r]);
    }
  }
  ordered[12] = null;

  BG.card = ordered;
  BG.cardNumSet = {};
  for (var ci = 0; ci < 25; ci++) {
    if (ordered[ci] !== null) BG.cardNumSet[ordered[ci]] = ci;
  }

  /* Natural ball-by-ball evaluation — identical to doBingoSpin().
     Only patterns genuinely completed within their balls threshold are awarded.
     The card is engineered so all 24 numbers fall in the first 40 balls,
     guaranteeing a Cover All naturally, but each pattern must earn its win. */
  BG.matchedCells = {12: true};
  var wonPatterns = {};
  var winPatterns = [];

  for (var b = 0; b < 40; b++) {
    var ballN = seq[b];
    var cellIdx = BG.cardNumSet[ballN];
    if (cellIdx !== undefined) BG.matchedCells[cellIdx] = true;

    var ballsCalledSoFar = b + 1;
    for (var pi = 0; pi < BINGO_PATTERNS.length; pi++) {
      if (wonPatterns[pi]) continue;
      var pat = BINGO_PATTERNS[pi];
      if (ballsCalledSoFar > pat.balls) continue;
      var complete = true;
      for (var cii = 0; cii < pat.cells.length; cii++) {
        var cc = pat.cells[cii];
        if (cc === 12) continue;
        if (!BG.matchedCells[cc]) { complete = false; break; }
      }
      if (complete) { wonPatterns[pi] = true; winPatterns.push(pat); }
    }
  }

  BG.callSeq = seq;
  BG.ballPos = 40;
  updateBallCallBadge();

  renderBingoCard(BG.card, BG.matchedCells, null);
  renderBallStrip(BG.callSeq, BG.ballPos, BG.cardNumSet);

  BG.winPatterns = winPatterns;
  BG._coverAll1to40 = false;
  return winPatterns;
}


/* _requestNewWABCSequence — called when ball 75 exhausted or Cover All occurs.
   Requests a new 75-ball sequence from DB via upsert_ball_call RPC then
   broadcasts new_call on wabc-ballpos so ALL connected players receive it
   simultaneously via their WABC.onNewCall() handler.
   Race-safe: upsert is atomic, last writer wins but all players get same seq.
   Only runs in wide area mode. No-op if offline or WABC not connected. */
function _requestNewWABCSequence() {
  if(!BG.usingServerBalls) return;
  if(!window._floorSupabaseClient) return;
  window._floorSupabaseClient.rpc('upsert_ball_call', { p_game_id: 'WABC' })
    .then(function(res) {
      if(res.error || !res.data) {
        console.warn('[WABC] _requestNewWABCSequence error:', res.error && res.error.message);
        return;
      }
      var _newSeq = res.data.sequence  || [];
      var _newIAt = res.data.issued_at || new Date().toISOString();
      if(_newSeq.length !== 75) return;
      /* Broadcast to all players — wabc-ballpos channel */
      if(window._wabcChannel) {
        window._wabcChannel.send({
          type:    'broadcast',
          event:   'new_call',
          payload: { sequence: _newSeq, issued_at: _newIAt }
        });
      }
    }).catch(function(err) {
      console.warn('[WABC] _requestNewWABCSequence catch:', err);
    });
}

function doBingoSpin(){
  stopPatternCycle();

  // Preserve how many balls have been revealed so far.
  var prevBallPos=BG.ballPos||0;

  /* v5.40 sequence sync — two paths based on wide area vs local mode.
     Wide area: ALWAYS re-sync from WABC on spin press so all players
     see the exact same sequence. genBallCall() never called in wide area mode.
     Local: only generate new sequence if exhausted or none loaded. */
  if(BG.usingServerBalls && typeof WABC !== 'undefined') {
    /* Wide area — always read current WABC sequence.
       _activeCallNext already called _requestNewWABCSequence at ball 75.
       WABC.onNewCall() will have updated BG.callSeq if broadcast arrived.
       If seqExhausted and new sequence not yet received, request again as fallback. */
    var _wabcSeq = WABC.getSequence();
    if(_wabcSeq && _wabcSeq.length === 75) BG.callSeq = _wabcSeq;
    if(BG.seqExhausted) {
      _requestNewWABCSequence(); /* fallback if broadcast not yet received */
      prevBallPos = 40;
    }
    BG.seqExhausted = false;
  } else {
    /* Local mode — generate new sequence only if exhausted or none loaded */
    if(BG.seqExhausted || !BG.callSeq || BG.callSeq.length !== 75){
      BG.callSeq = genBallCall();
      prevBallPos = 0;
      BG.seqExhausted = false;
    }
  }

  // Fresh card for this spin
  BG.card=genBingoCard();
  BG.cardNumSet={};
  for(var i=0;i<25;i++){if(BG.card[i]!==null) BG.cardNumSet[BG.card[i]]=i;}

  // Evaluate patterns ball-by-ball through first 40.
  // matchedCells starts with free space + any entertainment balls already shown
  // on THIS new card (daubed for display only, not re-evaluated for patterns).
  BG.matchedCells={12:true};
  var wonPatterns={};
  var winPatterns=[];

  for(var b=0;b<40;b++){
    var ball=BG.callSeq[b];
    var cellIdx=BG.cardNumSet[ball];
    if(cellIdx!==undefined) BG.matchedCells[cellIdx]=true;

    var ballsCalledSoFar=b+1;
    for(var pi=0;pi<BINGO_PATTERNS.length;pi++){
      if(wonPatterns[pi]) continue;
      var pat=BINGO_PATTERNS[pi];
      if(ballsCalledSoFar>pat.balls) continue;
      var complete=true;
      for(var ci=0;ci<pat.cells.length;ci++){
        var c=pat.cells[ci];
        if(c===12) continue;
        if(!BG.matchedCells[c]){complete=false;break;}
      }
      if(complete){wonPatterns[pi]=true;winPatterns.push(pat);}
    }
  }

  // Daub any entertainment balls already revealed (visual only, no pattern eval)
  for(var eb=40;eb<prevBallPos;eb++){
    var eball=BG.callSeq[eb];
    if(BG.cardNumSet[eball]!==undefined) BG.matchedCells[BG.cardNumSet[eball]]=true;
  }

  BG.winPatterns=winPatterns;
  BG.ballPos=(prevBallPos>40?prevBallPos:40);
  renderBingoCard(BG.card,BG.matchedCells,null);
  renderBallStrip(BG.callSeq,BG.ballPos,BG.cardNumSet);
  // Cover All in balls 1-40: flag for doSpin to handle
  BG._coverAll1to40=(Object.keys(BG.matchedCells).length===25);
  return BG.winPatterns;
}

/* â”€â”€ VIRTUAL STOPS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function pickVStop(){
  var r=rng.int(0,32767);var acc=0;
  for(var i=0;i<VSTOP_TABLE.length;i++){acc+=VSTOP_TABLE[i].w;if(r<acc)return VSTOP_TABLE[i].id;}
  return 6;
}
function genSpinResult(){
  var syms=[pickVStop(),pickVStop(),pickVStop()]; var ghosts=[];
  for(var r2=0;r2<3;r2++){
    var sym=syms[r2];var strip=STRIPS[r2];var n=strip.length;
    var positions=[];
    for(var s=0;s<n;s++){if(strip[s]===sym) positions.push(s);}
    var pos=positions.length>0?positions[rng.int(0,positions.length-1)]:0;
    ghosts.push({above2:strip[(pos-2+n)%n],above:strip[(pos-1+n)%n],sym:sym,below:strip[(pos+1)%n],below2:strip[(pos+2)%n]});
  }
  return{syms:syms,ghosts:ghosts};
}
function buildGrid(syms,ghosts){
  return[[ghosts[0].above,syms[0],ghosts[0].below],[ghosts[1].above,syms[1],ghosts[1].below],[ghosts[2].above,syms[2],ghosts[2].below]];
}
function forcedSpinResult(syms){
  // Shuffle the symbol combo so the same bingo pattern shows varied reel orderings
  // each spin (e.g. Hopscotch shows SP/Cherry/1Bar OR Cherry/SP/1Bar OR 1Bar/SP/Cherry etc.)
  // Uses Fisher-Yates with the game CSPRNG so it's unpredictable.
  var shuffled=syms.slice();
  /* Progressive is a wild that substitutes for Scott on normal pattern
     wins — random per-spin, independent per symbol, shuffled. Any mix is
     valid (e.g. Corporal Stripes can show Scott+Scott+Progressive or
     Scott+Progressive+Progressive). The Lazy-T combo (syms all ===7) is
     left untouched here — that's the dedicated jackpot trigger, not a
     substitution.
     However an ALL-PROGRESSIVE result must be EXCLUSIVE to the genuine
     Lazy-T combo — if independent substitution happens to turn a
     non-Lazy-T combo (e.g. Corporal Stripes' Scott x3) into all-Progressive,
     revert one symbol back to Scott so it can never be visually identical
     to the Lazy-T trigger. */
  if(!(shuffled[0]===7&&shuffled[1]===7&&shuffled[2]===7)){
    for(var _wi=0;_wi<shuffled.length;_wi++){
      if(shuffled[_wi]===0&&rng.pct(0.5)) shuffled[_wi]=7;
    }
    if(shuffled[0]===7&&shuffled[1]===7&&shuffled[2]===7){
      shuffled[rng.int(0,2)]=0;
    }
  }
  for(var i=shuffled.length-1;i>0;i--){
    var j=rng.int(0,i);
    var tmp=shuffled[i];shuffled[i]=shuffled[j];shuffled[j]=tmp;
  }
  var ghosts=[];
  for(var r=0;r<3;r++){
    var sym=shuffled[r];var strip=STRIPS[r];var n=strip.length;
    // Pick a random occurrence of this symbol on the strip for varied ghost neighbors
    var positions=[];
    for(var s=0;s<n;s++){if(strip[s]===sym) positions.push(s);}
    var pos=positions.length>0?positions[rng.int(0,positions.length-1)]:0;
    ghosts.push({above2:strip[(pos-2+n)%n],above:strip[(pos-1+n)%n],sym:sym,below:strip[(pos+1)%n],below2:strip[(pos+2)%n]});
  }
  return{syms:shuffled,ghosts:ghosts};
}

/* evalSpin: CLASS II VISUAL FILTER ONLY.
   All wins awarded by bingo patterns only. This filter rejects any combo
   that would look like a win to a player given this game's pay structure:
   - Any cherry on any reel = looks like Open Diamond pay (1 cherry pays)
   - Any SP wild on any reel = looks like a wild win
   - 3 of a kind = looks like a win
   - All 3 bars in any mix = looks like mixed bar win
   - Gap present with no cherry/wild = safe non-win */
function evalSpin(grid){
  var L=[grid[0][1],grid[1][1],grid[2][1]];
  // Blank first — most common symbol (~50% of stops), short-circuits fastest
  if(L[0]===6||L[1]===6||L[2]===6) return{amt:0};
  // Any cherry on any reel = always looks like Open Diamond pay
  if(L[0]===5||L[1]===5||L[2]===5) return{amt:1};
  // Any wild (SP=0 or Progressive=7) on payline = win-looking = rejected.
  // 2x Progressive combos only appear via forcedSpinResult on bingo wins.
  // On no-bingo spins, Progressive symbol must not appear on payline at all.
  if(L[0]===0||L[0]===7||L[1]===0||L[1]===7||L[2]===0||L[2]===7) return{amt:1};
  // 3 of a kind
  if(L[0]===L[1]&&L[1]===L[2]) return{amt:1};
  // All 3 are bars in any mix — use hardcoded check (PAY/BARS vars removed)
  var isBar=function(s){return s===2||s===3||s===4;};
  if(isBar(L[0])&&isBar(L[1])&&isBar(L[2])) return{amt:1};
  return{amt:0};
}

/* â”€â”€ SVG SYMBOLS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
var SVG={
  1:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" rx="0" fill="#f8f4e8"/><defs><linearGradient id="r7" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ff5555"/><stop offset="45%" stop-color="#cc0000"/><stop offset="100%" stop-color="#7a0000"/></linearGradient><linearGradient id="g7" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#ffe060"/><stop offset="50%" stop-color="#d4af37"/><stop offset="100%" stop-color="#8b6914"/></linearGradient><filter id="sh7"><feDropShadow dx="3" dy="4" stdDeviation="3" flood-opacity="0.35"/></filter></defs><text x="100" y="185" font-family="Georgia,serif" font-size="195" font-weight="900" text-anchor="middle" fill="url(#r7)" filter="url(#sh7)">7</text><text x="100" y="185" font-family="Georgia,serif" font-size="195" font-weight="900" text-anchor="middle" fill="none" stroke="url(#g7)" stroke-width="3">7</text></svg>',
  2:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#f8f4e8"/><defs><linearGradient id="gb" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#ffe878"/><stop offset="40%" stop-color="#d4af37"/><stop offset="100%" stop-color="#8b5e00"/></linearGradient><filter id="shb"><feDropShadow dx="2" dy="3" stdDeviation="2" flood-opacity="0.3"/></filter></defs><rect x="4" y="8" width="192" height="52" rx="8" fill="url(#gb)" filter="url(#shb)"/><text x="100" y="46" font-family="Georgia,serif" font-size="30" font-weight="900" text-anchor="middle" fill="#2a1400" letter-spacing="4">BAR</text><rect x="4" y="74" width="192" height="52" rx="8" fill="url(#gb)" filter="url(#shb)"/><text x="100" y="112" font-family="Georgia,serif" font-size="30" font-weight="900" text-anchor="middle" fill="#2a1400" letter-spacing="4">BAR</text><rect x="4" y="140" width="192" height="52" rx="8" fill="url(#gb)" filter="url(#shb)"/><text x="100" y="178" font-family="Georgia,serif" font-size="30" font-weight="900" text-anchor="middle" fill="#2a1400" letter-spacing="4">BAR</text></svg>',
  3:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#f8f4e8"/><defs><linearGradient id="gb2" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#ffe878"/><stop offset="40%" stop-color="#d4af37"/><stop offset="100%" stop-color="#8b5e00"/></linearGradient><filter id="shb2"><feDropShadow dx="2" dy="3" stdDeviation="2" flood-opacity="0.3"/></filter></defs><rect x="4" y="20" width="192" height="70" rx="10" fill="url(#gb2)" filter="url(#shb2)"/><text x="100" y="63" font-family="Georgia,serif" font-size="38" font-weight="900" text-anchor="middle" fill="#2a1400" letter-spacing="5">BAR</text><rect x="4" y="110" width="192" height="70" rx="10" fill="url(#gb2)" filter="url(#shb2)"/><text x="100" y="153" font-family="Georgia,serif" font-size="38" font-weight="900" text-anchor="middle" fill="#2a1400" letter-spacing="5">BAR</text></svg>',
  4:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#f8f4e8"/><defs><linearGradient id="gb1" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#ffe878"/><stop offset="40%" stop-color="#d4af37"/><stop offset="100%" stop-color="#8b5e00"/></linearGradient><filter id="shb1"><feDropShadow dx="2" dy="4" stdDeviation="3" flood-opacity="0.3"/></filter></defs><rect x="4" y="40" width="192" height="120" rx="14" fill="url(#gb1)" filter="url(#shb1)"/><text x="100" y="122" font-family="Georgia,serif" font-size="56" font-weight="900" text-anchor="middle" fill="#2a1400" letter-spacing="6">BAR</text></svg>',
  5:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#f8f4e8"/><defs><radialGradient id="cr" cx="38%" cy="30%" r="62%"><stop offset="0%" stop-color="#ff7090"/><stop offset="50%" stop-color="#dd0030"/><stop offset="100%" stop-color="#880010"/></radialGradient><linearGradient id="stm" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#5a9400"/><stop offset="100%" stop-color="#2a4a00"/></linearGradient><filter id="shc"><feDropShadow dx="2" dy="3" stdDeviation="2" flood-opacity="0.3"/></filter></defs><path d="M100 40 Q82 68 58 105" fill="none" stroke="url(#stm)" stroke-width="7" stroke-linecap="round"/><path d="M100 40 Q118 68 142 105" fill="none" stroke="url(#stm)" stroke-width="7" stroke-linecap="round"/><path d="M100 40 L100 8" fill="none" stroke="url(#stm)" stroke-width="6" stroke-linecap="round"/><ellipse cx="114" cy="16" rx="20" ry="10" fill="#4a7800" transform="rotate(-30 114 16)"/><circle cx="58" cy="138" r="42" fill="url(#cr)" filter="url(#shc)"/><circle cx="48" cy="122" r="12" fill="rgba(255,255,255,0.25)"/><circle cx="142" cy="138" r="42" fill="url(#cr)" filter="url(#shc)"/><circle cx="132" cy="122" r="12" fill="rgba(255,255,255,0.25)"/></svg>',
  6:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#f8f4e8"/></svg>'
};
var IMG_PROG_JP=(function(){
  var i=new Image();i.src='assets/symbols/progressive_jackpot.png';
  i.style.cssText='width:95%;height:95%;object-fit:contain;display:block;';
  return i;
}());
function mkSym(id){
  var w=document.createElement('div');
  w.style.cssText='width:100%;height:100%;display:-webkit-flex;display:flex;-webkit-align-items:center;align-items:center;-webkit-justify-content:center;justify-content:center;';
  if(id===6){return w;} // blank = pure dark tape, no content
  if(id===0){var img=IMG_SCOTT.cloneNode();img.style.cssText='width:95%;height:95%;object-fit:contain;display:block;';w.appendChild(img);}
  else if(id===7){var imgP=IMG_PROG_JP.cloneNode();imgP.style.cssText='width:95%;height:95%;object-fit:contain;display:block;';w.appendChild(imgP);}
  else if(SVG[id]) w.innerHTML=SVG[id];
  else w.innerHTML=SVG[6];
  return w;
}

/* â”€â”€ STATE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
/* ── PLAYER STATE PERSISTENCE ── */
function _loadPlayerState(){
  var bal=100,cpl=1;
  try{
    var rawBal=localStorage.getItem('spbm_bal');
    var rawCpl=localStorage.getItem('spbm_cpl');
    if(rawBal!==null){var b=parseFloat(rawBal);if(!isNaN(b)&&b>=0) bal=b;}
    if(rawCpl!==null){var cc=parseInt(rawCpl,10);if(cc===1||cc===2||cc===3) cpl=cc;}
  }catch(e){}
  return{bal:bal,cpl:cpl};
}
function _savePlayerState(){
  try{localStorage.setItem('spbm_bal',S.bal.toFixed(2));localStorage.setItem('spbm_cpl',String(S.cpl));}catch(e){}
}
var _ps=_loadPlayerState();
var S={bal:_ps.bal,cpl:_ps.cpl,spinning:false,lastWin:0};
var _spinDebounce=0;
var _spinWatchdog=null; // timestamp of last spin completion — prevents rapid re-entry
var SLOT_H=120;
var _reelWinH=0; // cached reel-window clientHeight — set in initReelSlots
var CURRENT_SYMS=[5,4,1];
var CURRENT_GHOSTS=[{above2:6,above:6,sym:5,below:4,below2:6},{above2:6,above:6,sym:4,below:3,below2:2},{above2:3,above:6,sym:1,below:6,below2:4}];
var CPL=[1,2,3];

function fmt(n){return '$'+n.toFixed(2);}
function fmtMoney(n){
  var v=parseFloat(n);if(isNaN(v))return '$0.00';
  var p=v.toFixed(2).split('.');
  p[0]=p[0].replace(/\B(?=(\d{3})+(?!\d))/g,',');
  return '$'+p.join('.');
}
function updUI(){
  document.getElementById('bval').textContent=fmt(S.bal);
  _savePlayerState();
  if(typeof checkDemoTrigger==='function') checkDemoTrigger();
  document.getElementById('betval').textContent=fmt(S.cpl);
  document.getElementById('cdisp').textContent=S.cpl;
}
/* Refresh the spin watchdog — called at each stage of a long Red
   Spin/Lazy-T progressive sequence. The 15s watchdog exists to catch a
   genuinely STUCK spin (DB hang, exception), but the full progressive
   celebration sequence can legitimately run 20-40+ seconds across many
   patterns. Without refreshing, the watchdog fired mid-sequence,
   force-re-enabled all buttons (setCtrl(true)) while runRS was still
   playing, letting players press SPIN to skip/interrupt the in-progress
   celebration. Refreshing at each stage means it only fires if a SINGLE
   stage hangs >15s — a real hang — not on cumulative sequence length. */
function _refreshSpinWatchdog(){
  if(_spinWatchdog) clearTimeout(_spinWatchdog);
  _spinWatchdog=setTimeout(function(){
    if(S.spinning){
      console.warn('[Watchdog] Spin stuck >15s — force unlocking');
      _spinWatchdog=null; S.spinning=false; setCtrl(true); updUI();
      var cel=document.getElementById('force-win-cel');
      if(cel) cel.classList.remove('show');
    }
  },15000);
}

/* Clear the spin watchdog WITHOUT rescheduling it. Used before showing a
   player-dismissed celebration overlay (showJP/showProgJP) — waiting for
   a tap is normal and can legitimately take longer than 15s; it is NOT
   "stuck". Previously _refreshSpinWatchdog() was called here, which still
   fired 15s later if the player simply hadn't tapped yet, force-unlocking
   all controls (setCtrl(true)) while the celebration overlay was still
   visible/blocking — the game appeared "locked up" (frozen celebration
   over an unlocked board). The watchdog is re-armed via
   _refreshSpinWatchdog() at the START of the dismiss handler, to still
   catch a genuine hang during POST-celebration cleanup (full-card daub,
   opLog, new WABC sequence request, etc). */
function _clearSpinWatchdog(){
  if(_spinWatchdog){ clearTimeout(_spinWatchdog); _spinWatchdog=null; }
}

function setCtrl(en){
  var ids=['spin-btn','cred-btn','max-btn','co-btn','ic-btn','help-btn'];
  for(var i=0;i<ids.length;i++) document.getElementById(ids[i]).disabled=!en;
}
function toast(m){var el=document.getElementById('toast');el.textContent=m;el.classList.add('on');setTimeout(function(){el.classList.remove('on');},2600);}
function setWin(a,lbl){
  var el=document.getElementById('wval');
  el.textContent=a>0?fmt(a):'$0.00';
  if(a>0){el.classList.remove('pop');void el.offsetWidth;el.classList.add('pop');setTimeout(function(){el.classList.remove('pop');},360);}
  document.getElementById('win-msg').textContent=lbl||'';
}

/* â”€â”€ REEL RENDERER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function buildSlot(symId){
  var slot=document.createElement('div');
  slot.className=symId===6?'reel-slot reel-slot-blank':'reel-slot';
  slot.appendChild(mkSym(symId));return slot;
}
/* slotH helpers — sym=47%, blank=4% of window height */
var SYM_PCT=0.47; var BLK_PCT=0.04;
function symSlotH(winH){return Math.round(winH*SYM_PCT);}
function blkSlotH(winH){return Math.max(2,Math.round(winH*BLK_PCT));}
function slotHFor(id,winH){return id===6?blkSlotH(winH):symSlotH(winH);}
function stripTopFor(slots,winH){
  var h0=slotHFor(slots[0],winH),h1=slotHFor(slots[1],winH),h2=slotHFor(slots[2],winH);
  var paylineCenter=h0+h1+h2/2;
  return Math.round(winH/2-paylineCenter);
}
function stripTotalH(slots,winH){
  var t=0;for(var i=0;i<slots.length;i++) t+=slotHFor(slots[i],winH);
  return t;
}
function renderReels(syms,ghosts){
  CURRENT_SYMS=syms.slice?syms.slice():[syms[0],syms[1],syms[2]];
  CURRENT_GHOSTS=ghosts;
  for(var r=0;r<3;r++){
    var strip=document.getElementById('rs'+r);var win=document.getElementById('rw'+r);
    if(!strip||!win) continue;
    var liveH=win.clientHeight||0;
    var winH=liveH>0?liveH:(_reelWinH>0?_reelWinH:SLOT_H*3);
    var g=ghosts[r];
    var gSlots=[g.above2,g.above,g.sym,g.below,g.below2];
    strip.innerHTML='';
    strip.style.height=stripTotalH(gSlots,winH)+'px';
    strip.style.top=stripTopFor(gSlots,winH)+'px';
    for(var si=0;si<5;si++){
      var s=buildSlot(gSlots[si]);
      s.style.height=slotHFor(gSlots[si],winH)+'px';
      s.style.flex='none';
      strip.appendChild(s);
    }
  }
}
function flashCenter(){
  for(var c=0;c<3;c++){
    var strip=document.getElementById('rs'+c);if(!strip) continue;
    var slots=strip.querySelectorAll('.reel-slot');
    if(slots[1]) slots[1].classList.add('flash');
  }
  setTimeout(function(){
    for(var c2=0;c2<3;c2++){
      var s2=document.getElementById('rs'+c2);if(!s2) continue;
      var sl2=s2.querySelectorAll('.reel-slot');
      if(sl2[1]) sl2[1].classList.remove('flash');
    }
  },1200);
}

/* â”€â”€ SPIN ANIMATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function spinReel(reelIdx,finalGhost,stopDelay,onStop){
  var strip=document.getElementById('rs'+reelIdx);
  var reel=document.getElementById('r'+reelIdx);
  if(!strip||!reel){onStop();return;}

  var spinWin=document.getElementById('rw'+reelIdx);
  var spinWinH=spinWin?spinWin.clientHeight:0;
  var slotH=spinWinH>0?symSlotH(spinWinH):Math.round(reel.offsetHeight*SYM_PCT);
  if(slotH<10) slotH=SLOT_H;
  var spinTopOff=spinWinH>0?Math.round(spinWinH/2-slotH*1.5):0;

  /* Build spin strip: 24 random symbols + final 5 ghost slots.
     Strip uses top positioning, scrolls upward (top goes negative).
     The .reel wrapper is CSS scaleY(-1) so this appears as top-to-bottom spin. */
  var SPIN_SYM_IDS=[0,1,2,3,4,5,6,7];
  var spinSyms=[];
  for(var i=0;i<24;i++) spinSyms.push(SPIN_SYM_IDS[rng.int(0,7)]);
  spinSyms.push(finalGhost.above2);
  spinSyms.push(finalGhost.above);
  spinSyms.push(finalGhost.sym);
  spinSyms.push(finalGhost.below);
  spinSyms.push(finalGhost.below2);

  strip.innerHTML='';
  strip.style.height='auto';
  strip.style.top='0px';
  strip.style.bottom='';
  strip.style.flexDirection='';
  strip.style.transition='none';
  for(var j=0;j<spinSyms.length;j++){
    var slot=buildSlot(spinSyms[j]);
    slot.style.height=slotH+'px';
    slot.style.flex='none';
    strip.appendChild(slot);
  }

  /* targetY: strip.top so payline slot (centerIdx) is centered in window */
  var centerIdx=spinSyms.length-3;
  var targetY=spinTopOff-centerIdx*slotH;

  /* Overshoot 0.6 slots past target then snap back — VGT mechanical thud */
  var overshootExtra=Math.round(slotH*0.6);
  var overshootY=targetY-overshootExtra;

  /* Phase timing */
  var t1=Math.round(stopDelay*0.75); /* phase 1: constant velocity */
  var t2=Math.round(stopDelay*0.90); /* phase 2: hold at overshoot */

  strip.style.willChange='top';
  reel.classList.add('spinning');

  var startTime=null;
  var snapped=false;

  function frame(ts){
    if(!startTime) startTime=ts;
    var elapsed=ts-startTime;

    if(elapsed<t1){
      var p1=elapsed/t1;
      strip.style.top=(p1*overshootY).toFixed(1)+'px';
      requestAnimationFrame(frame);

    } else if(elapsed<t2){
      strip.style.top=overshootY.toFixed(1)+'px';
      requestAnimationFrame(frame);

    } else {
      if(!snapped){
        snapped=true;
        strip.style.top=targetY.toFixed(1)+'px';
        reel.classList.remove('spinning');
        reel.classList.add('stopping');
        sndReelStop();
        setTimeout(function(){
          reel.classList.remove('stopping');
          strip.innerHTML='';
          strip.style.willChange='';
          var winEl=document.getElementById('rw'+reelIdx);
          var liveH2=winEl?winEl.clientHeight:0;
          var winH2=liveH2>0?liveH2:(_reelWinH>0?_reelWinH:SLOT_H*3);
          var restSlots=[finalGhost.above2,finalGhost.above,finalGhost.sym,finalGhost.below,finalGhost.below2];
          strip.style.height=stripTotalH(restSlots,winH2)+'px';
          strip.style.top=stripTopFor(restSlots,winH2)+'px';
          for(var si=0;si<5;si++){
            var rs=buildSlot(restSlots[si]);
            rs.style.height=slotHFor(restSlots[si],winH2)+'px';
            rs.style.flex='none';
            strip.appendChild(rs);
          }
          onStop();
        },80);
      }
    }
  }
  requestAnimationFrame(frame);
}

function animateReels(spinData,cb){
  var STOP_DELAYS=[600,1000,1450];sndSpinStart(); /* v5.70 timing */
    var done=0;
  function onReelStop(r){return function(){done++;if(done===3) setTimeout(cb,100);};}
  for(var ri2=0;ri2<3;ri2++){(function(r){spinReel(r,spinData.ghosts[r],STOP_DELAYS[r],onReelStop(r));})(ri2);}
}

/* â”€â”€ JACKPOT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function showJP(jpAmt,cb){
  var el=document.getElementById('jp-ov');
  var amtEl=document.getElementById('jp-amt');
  if(amtEl) amtEl.textContent=fmt(jpAmt);
  sndJackpot();el.classList.add('on');
  el.onclick=function(){el.classList.remove('on');el.onclick=null;if(cb)cb();};
  el.ontouchend=function(e){e.preventDefault();el.classList.remove('on');el.ontouchend=null;if(cb)cb();};
}

/* â”€â”€ RED SPIN (bingo-driven) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function runRS(rsPatterns,cpl,onDone,progCtx){
  if(!rsPatterns||rsPatterns.length===0){onDone(0);return;}
  var frame2=document.getElementById('reel-frame');
  var redOv=document.getElementById('red-ov');
  var badge=document.getElementById('rs-badge');
  var btBox=document.getElementById('bt-box');
  var btVal=document.getElementById('bt-val');
  frame2.classList.add('bonus-active');
  redOv.classList.add('on');badge.classList.add('on');
  btBox.classList.add('on');btVal.textContent=fmt(0);
  sndRedSpin();
  var bonusTotal=0;var seqIdx=0;
  function playNext(){
    if(seqIdx>=rsPatterns.length){
      frame2.classList.remove('bonus-active');
      redOv.classList.remove('on');badge.classList.remove('on');
      sndRedSpinEnd();
      toast('RED SPIN BONUS: '+fmt(bonusTotal));
      onDone(bonusTotal);return;
    }
    var pat=rsPatterns[seqIdx];seqIdx++;
    _refreshSpinWatchdog();
    badge.textContent='RED SPIN '+seqIdx;
    /* Show this pattern's name + highlight its cells on the bingo card
       while its reel animation plays. */
    var _pnEl=document.getElementById('bingo-pattern-name');
    if(_pnEl) _pnEl.textContent=pat.name.toUpperCase();
    renderBingoCard(BG.card,BG.matchedCells,pat.cells);
    var reelSyms=REEL_SYMS[pat.reel]||REEL_SYMS['none'];
    var sr=forcedSpinResult(reelSyms);
    sndBonusSpin();
    var RS_STOP=[500,800,1100];var rsDone=0; /* v5.70 timing */
    function _onReelDone(){
      rsDone++;
      if(rsDone<3) return; /* wait for all 3 reels to finish */
      setTimeout(function(){
      var payAmt=pat.pay[cpl-1];
      if(pat.isProgressive&&progCtx){
        /* Progressive Jackpot — grand finale. Reels already show 'coverall'
           symbols (just landed). Add accumulated bonusTotal + jackpot amount,
           then hand off to showProgJP. This ends the sequence — no further
           playNext/onDone call. */
        frame2.classList.remove('bonus-active');
        redOv.classList.remove('on');badge.classList.remove('on');
        btBox.classList.remove('on');
        sndRedSpinEnd();
        /* bonusTotal was already added to S.bal incrementally as each
           prior pattern played — only add the jackpot amount here. */
        var _totalAmt=progCtx.pennyAmt+bonusTotal+progCtx.amt;
        S.bal+=progCtx.amt;S.lastWin=_totalAmt;updUI();
        setTimeout(function(){
          _clearSpinWatchdog();
          /* Safety net: if showProgJP throws for any reason, the watchdog
             was just CLEARED (waiting for tap is normal, not "stuck"), so
             without this catch the game would lock up PERMANENTLY with no
             recovery path at all. */
          try {
            showProgJP(_totalAmt,progCtx.winPatterns,progCtx.cardSerial,progCtx.balBefore);
          } catch(e) {
            console.error('[Progressive] showProgJP threw — recovering controls:', e);
            var _cel=document.getElementById('force-win-cel');
            if(_cel) _cel.classList.remove('show');
            S.spinning=false; setCtrl(true); updUI();
          }
        },500);
        return;
      }
      if(pat.reel==='jp'){
        if(progCtx){
          /* Lazy-T is also winning this spin (progCtx set) — its finale
             will be the SINGLE celebration for the whole spin. Skip
             Corporal Stripes' own "$X JACKPOT" popup; just add its pay
             to the running total and continue straight to the next entry. */
          bonusTotal+=payAmt;S.bal+=payAmt;updUI();
          playNext();return;
        }
        /* No Lazy-T this spin — Corporal Stripes is the highest pattern
           and gets its own Congratulations celebration as the finale. */
        frame2.classList.remove('bonus-active');
        redOv.classList.remove('on');badge.classList.remove('on');
        sndRedSpinEnd();
        setTimeout(function(){
          _clearSpinWatchdog();
          /* Safety net: same reasoning as showProgJP above — without this,
             a throw here would leave the watchdog cleared and the game
             permanently locked with no recovery path. */
          try {
            showJP(payAmt,function(){
              _refreshSpinWatchdog();
              bonusTotal+=payAmt;S.bal+=payAmt;updUI();
              setTimeout(function(){playNext();},300);
            });
          } catch(e) {
            console.error('[RedSpin] showJP threw — recovering controls:', e);
            var _jpov=document.getElementById('jp-ov');
            if(_jpov) _jpov.classList.remove('on');
            S.spinning=false; setCtrl(true); updUI();
          }
        },500);return;
      }
      bonusTotal+=payAmt;S.bal+=payAmt;
      document.getElementById('bval').textContent=fmt(S.bal);
      btVal.textContent=fmt(bonusTotal);
      setWin(payAmt,'RED SPIN \u2014 '+pat.name.toUpperCase()+'!');
      flashCenter();
      if(payAmt>=50) sndBigWin(); else sndSmallWin();
      // Do not startPatternCycle here — RS manages its own display
      setTimeout(playNext, 1000+rng.int(0,999)); // random 1-2s pause via CSPRNG
    },120); /* short settle after last reel lands */
  }
  setTimeout(playNext,200);
}
}

/* â”€â”€ MAIN SPIN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function doSpin(){
  if(S.spinning) return;
  if(Date.now()-_spinDebounce<300) return;
  if(S.bal<S.cpl){toast('INSERT CASH TO PLAY');return;}
  if(_reelWinH===0) initReelSlots();
  S.spinning=true;S.bal-=S.cpl;
  var _forceJP=false;
  if(typeof Progressive!=='undefined'){
    _forceJP=Progressive.contribute(S.cpl);
    /* Register player on first spin — safe to call multiple times */
    Progressive.registerPlayer(null, window._playerNickname || null);
    /* Update lastSpin timestamp so operator active/inactive display stays accurate */
    if(Progressive.updateLastSpin) Progressive.updateLastSpin();
  }
  var _spinBalBefore=S.bal+S.cpl; var _spinCardSerial=BG.cardSerial;
  setWin(0,'');document.getElementById('bt-box').classList.remove('on');
  updUI();setCtrl(false);
  stopPatternCycle();
  // Transition to active state on first spin
  if(GS.state==='idle'||GS.state==='demo') exitDemo();
  GS.hasSpun=true;GS.state='active';

  var winPatterns=doBingoSpin();

  // ── FORCE JACKPOT + SPIN CONTINUATION ───────────────────────────────────
  // ALL spin logic lives in _continueSpinAfterClaim().
  // claimForce() is async — BOTH didWin=true AND didWin=false paths call it.
  // FIXES: lockup, wrong toast, wrong amount, double-credit, pot not resetting.
  function _continueSpinAfterClaim(){
    if(!BG.entTimer) startActiveCaller();
    var spinData;
    if(winPatterns.length===0){
      /* Class II: bingo said no win — reel visual must NOT look like a win.
         evalSpin filters out combos that would mislead the player.
         id:7 (Progressive) is treated as a wild so any combo containing it
         looks like a win — correctly filtered out on no-bingo spins.
         Cherry on any reel also looks like a win (Open Diamond) — filtered.
         Max 200 attempts before accepting whatever comes up. */
      var attempts=0;
      do{spinData=genSpinResult();attempts++;}
      while(evalSpin(buildGrid(spinData.syms,spinData.ghosts)).amt>0&&attempts<200);
    } else {
      /* Sort reel-bearing, non-progressive patterns ascending by pay —
         these drive the main spin + Red Spin sequence. Cover All 40/75
         (reel:null, e.g. $0.01) are pulled out separately — they have NO
         reel representation and must never become basePat (which would
         show a no-win combo on the main reels) or appear in the Red Spin
         sequence. They're appended at the end so _finishProgressiveSpin's
         penny-toast scan still finds them. Progressive (Lazy-T) goes
         absolute LAST so basePat is always the lowest reel-bearing pattern. */
      var _progInWins=false;
      var _nonProgPats=[];
      var _sideAwards=[]; // reel:null, e.g. Cover All 40/75
      for(var _rpi=0;_rpi<winPatterns.length;_rpi++){
        var _wp=winPatterns[_rpi];
        if(_wp.isProgressive){_progInWins=true;}
        else if(!_wp.reel){_sideAwards.push(_wp);}
        else{_nonProgPats.push(_wp);}
      }
      _nonProgPats.sort(function(a,b){return a.pay[0]-b.pay[0];});
      if(_progInWins){
        winPatterns=_nonProgPats.concat(_sideAwards).concat(winPatterns.filter(function(p){return p.isProgressive;}));
      } else {
        winPatterns=_nonProgPats.concat(_sideAwards);
      }
      /* Always use the lowest pattern's reel for the MAIN spin — Progressive
         (reel:'coverall') is the LAST entry and plays during Red Spin as
         the grand finale, not on the main reels. */
      spinData=forcedSpinResult(REEL_SYMS[winPatterns[0].reel]||REEL_SYMS['none']);
    }

    animateReels(spinData,function(){
      if(winPatterns.length===0){
        setWin(0,'NO BINGO');
        opLog({type:'SPIN',gameSerial:genGameSerial(),cardSerial:_spinCardSerial,bet:S.cpl,win:0,patterns:[],balBefore:_spinBalBefore,balAfter:S.bal});
        _spinDebounce=Date.now();(function(){if(_spinWatchdog){clearTimeout(_spinWatchdog);_spinWatchdog=null;}})();S.spinning=false;setCtrl(true);updUI();return;
      }

      if(BG._coverAll1to40){BG._coverAll1to40=false;_handleCoverAll(true);}

      var _denom=(typeof DENOM!=='undefined'?DENOM:1);
      var basePat=winPatterns[0];
      /* rsPatterns = patterns for Red Spin animation — exclude progressive
         (handled separately) and Cover All 40/75 (reel:null, no reel stops
         per design; their pay is still included via _allPatsBonus below). */
      var rsPatterns=winPatterns.slice(1).filter(function(p){return !p.isProgressive && p.reel;});

      // Detect progressive BEFORE crediting base pay — prevents double-credit + wrong toast
      var _progPat=null;
      for(var _pi=0;_pi<winPatterns.length;_pi++){
        if(winPatterns[_pi].isProgressive){_progPat=winPatterns[_pi];break;}
      }

      if(_progPat&&typeof Progressive!=='undefined'){
        /* Sum ONLY the patterns that actually won — not all 20 patterns.
           rsPatterns drives Red Spin animation for each winning pattern.
           _allPatsBonus is the total of all non-progressive winners. */
        var _allPatsBonus=0;
        for(var _api=0;_api<winPatterns.length;_api++){
          /* Cover All 40/75 (reel:null) are awarded separately inside
             _finishProgressiveSpin (penny toast) — exclude here to avoid
             double-counting. */
          if(!winPatterns[_api].isProgressive && winPatterns[_api].reel){
            _allPatsBonus+=winPatterns[_api].pay[S.cpl-1]*_denom;
          }
        }
        if(_progPat._forceAmt){
          // Force win — amount confirmed by DB claim, no hit() RPC needed
          _finishProgressiveSpin(_progPat._forceAmt+_allPatsBonus, winPatterns,
                                  basePat, _spinCardSerial, _spinBalBefore);
        } else {
          /* Natural Cover All — arm in DB then claim atomically.
             Player 1 gets full pot, Player 2 gets seed amount.
             Both pay via the same sequential award flow + celebration.
             Progressive.hit() never called — DB is sole payment authority. */
          Progressive.armAndClaim(function(didWin, _progAmt) {
            _finishProgressiveSpin(_progAmt+_allPatsBonus, winPatterns,
                                    basePat, _spinCardSerial, _spinBalBefore);
          });
        }
        return;
      }

      // ── Normal (non-progressive) win ──────────────────────────────────────
      var baseAmt=basePat.pay[S.cpl-1]*_denom;
      /* Cover All 40/75 (reel:null, excluded from rsPatterns) — always add
         their pay (e.g. Cover All 40's $0.01) on top, even if basePat is a
         different pattern. Avoid double-counting if basePat itself IS one
         of these. */
      for(var _cwi=0;_cwi<winPatterns.length;_cwi++){
        var _cwp=winPatterns[_cwi];
        if(_cwp!==basePat && !_cwp.isProgressive && _cwp.reel===null){
          baseAmt+=_cwp.pay[S.cpl-1]*_denom;
        }
      }
      S.bal+=baseAmt;S.lastWin=baseAmt;flashCenter();
      setWin(baseAmt,basePat.name.toUpperCase());
      updUI();
      if(baseAmt>=50) sndBigWin(); else sndSmallWin();

      if(rsPatterns.length>0){
        startPatternCycle([basePat]);
        setTimeout(function(){
          stopPatternCycle();
          runRS(rsPatterns,S.cpl,function(bonusTotal){
            setWin(baseAmt+bonusTotal,'BINGO WIN + RED SPIN!');
            document.getElementById('bt-box').classList.remove('on');
            startPatternCycle(winPatterns);
            opLog({type:'SPIN',gameSerial:genGameSerial(),cardSerial:_spinCardSerial,bet:S.cpl,win:baseAmt+bonusTotal,patterns:winPatterns.map(function(p){return p.name;}),balBefore:_spinBalBefore,balAfter:S.bal});
            _spinDebounce=Date.now();updUI();(function(){if(_spinWatchdog){clearTimeout(_spinWatchdog);_spinWatchdog=null;}})();S.spinning=false;setCtrl(true);
          });
        },600);return;
      }
      startPatternCycle(winPatterns);
      opLog({type:'SPIN',gameSerial:genGameSerial(),cardSerial:_spinCardSerial,bet:S.cpl,win:baseAmt,patterns:winPatterns.map(function(p){return p.name;}),balBefore:_spinBalBefore,balAfter:S.bal});
      _spinDebounce=Date.now();(function(){if(_spinWatchdog){clearTimeout(_spinWatchdog);_spinWatchdog=null;}})();S.spinning=false;setCtrl(true);updUI();
    });
  } // end _continueSpinAfterClaim

  // Force jackpot: claim async, THEN generate guaranteed Cover All + run spin
  if(_forceJP&&typeof Progressive!=='undefined'){
    Progressive.claimForce(function(didWin,forceAmt){
      try {
        if(didWin){
          // Override the random card with a guaranteed Cover All card + matching ball call
          var coverAllPatterns=generateCoverAllSpin();
          /* usingServerBalls preserved inside generateCoverAllSpin — no restore needed */
          var _forcePat={
            name:'Lazy-T',balls:25,pay:[0,0,0],
            reel:'coverall',cells:[4,9,10,11,12,13,14,19,24],
            isProgressive:true,_forceAmt:forceAmt
          };
          // winPatterns = force pattern + all Cover All qualifying patterns
          winPatterns=[_forcePat].concat(coverAllPatterns.filter(function(p){return !p.isProgressive;}));
        }
      } catch(e) {
        console.error('[ForceJP] generateCoverAllSpin failed:', e);
        /* Fall back: pay the force amount as a plain progressive hit with no extra patterns */
        if (didWin) {
          var _forcePatFallback={
            name:'Lazy-T',balls:25,pay:[0,0,0],
            reel:'coverall',cells:[4,9,10,11,12,13,14,19,24],
            isProgressive:true,_forceAmt:forceAmt
          };
          winPatterns=[_forcePatFallback];
        }
      }
      _continueSpinAfterClaim(); // ALWAYS called — no lockup possible
    });
  } else {
    _continueSpinAfterClaim();
  }
}

/* â”€â”€ HELP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function renderHelp(){
  var b=document.getElementById('help-body');b.innerHTML='';
  var s1=document.createElement('div');s1.className='hsec';
  s1.innerHTML='<div class="hstl">HOW TO PLAY</div>'+
    '<div class="hln">- <span>Class II Bingo machine</span> - bingo determines all outcomes</div>'+
    '<div class="hln">- New bingo card generated every spin</div>'+
    '<div class="hln">- First 40 balls determine win - rest are entertainment</div>'+
    '<div class="hln">- Multiple patterns trigger <span>Red Spin Bonus</span></div>'+
    '<div class="hln">- Any cherry on payline pays Open Diamond</div>';
  b.appendChild(s1);
  var s2=document.createElement('div');s2.className='hsec';
  s2.innerHTML='<div class="hstl">WILD SYMBOLS</div>'+
    '<div class="hln"><span>SP (Stray Pup)</span> - Wild on all reels. Bingo pattern determines pay.</div>'+
    '<div class="hln"><span>Progressive (Prog)</span> - Wild on all reels. Bingo pattern determines pay.</div>'+
    '<div class="hln"><span>SP + Prog mix</span> - 2 of a kind visual. Bingo pattern determines pay.</div>'+
    '<div class="hln"><span>Prog Prog Prog</span> - Wide Area Progressive Jackpot (Cover All in 25 balls)</div>';
  b.appendChild(s2);
  var _hd=(typeof DENOM!=='undefined'?DENOM:1);
  var _hp={}; /* name -> pay[0]*DENOM */
  for(var _hi=0;_hi<BINGO_PATTERNS.length;_hi++){
    var _hpat=BINGO_PATTERNS[_hi];
    if(!_hpat.isProgressive&&_hpat.reel) _hp[_hpat.name]=(_hpat.pay[0]*_hd);
  }
  function _hfmt(n){return '$'+n.toLocaleString();}
  var s3=document.createElement('div');s3.className='hsec';
  s3.innerHTML='<div class="hstl">TOP PATTERNS (BET 1)</div>'+
    '<div class="hln"><span>Corporal Stripes</span> - '+_hfmt(_hp['Corporal Stripes']||0)+' (JACKPOT)</div>'+
    '<div class="hln"><span>Cross Corners</span> - '+_hfmt(_hp['Cross Corners']||0)+'</div>'+
    '<div class="hln"><span>Pyramid / The Kite</span> - '+_hfmt(_hp['Pyramid']||0)+'</div>'+
    '<div class="hln"><span>Four Leaf Clover</span> - '+_hfmt(_hp['Four Leaf Clover']||0)+'</div>'+
    '<div class="hln"><span>Double Cross / Arrowhead</span> - '+_hfmt(_hp['Double Cross']||0)+'</div>'+
    '<div class="hln"><span>Valentine</span> - '+_hfmt(_hp['Valentine']||0)+'</div>';
  b.appendChild(s3);
}

/* â”€â”€ INIT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

/* ── PROGRESSIVE JACKPOT OVERLAY ── */
/* ── PROGRESSIVE JACKPOT CELEBRATION (replaces old text overlay) ─────────
   Used for BOTH natural bingo wins AND force jackpot wins.
   Shows the video celebration overlay, NOT the old jp-ov text screen.
   ────────────────────────────────────────────────────────────────────── */
/* _finishProgressiveSpin — runs the FULL Cover-All award sequence per
   bingo rules:
     1. Cover All 40 ($0.01, reel:null) — instant toast + penny credited
     2. All other winning patterns, LOWEST pay -> HIGHEST, via Red Spin
        reel-stacking animation (runRS)
     3. Progressive Jackpot — grand finale celebration (showProgJP)
     4. After celebration dismissed: full card daub, sequence ends
        (Cover All occurred -> stopActiveCaller + request new WABC sequence)
   Called for BOTH force jackpot and natural Cover-All-25 wins. */
function _finishProgressiveSpin(progAmt, winPatterns, basePat, cardSerial, balBefore) {
  var _denom=(typeof DENOM!=='undefined'?DENOM:1);

  /* Step 1: Cover All 40 — instant toast + penny, not part of Red Spin */
  var pennyAmt=0;
  for(var _c40=0;_c40<winPatterns.length;_c40++){
    if(winPatterns[_c40].name==='Cover All 40'){
      pennyAmt=winPatterns[_c40].pay[S.cpl-1]*_denom;
      S.bal+=pennyAmt;S.lastWin=pennyAmt;updUI();
      toast('+'+fmtMoney(pennyAmt)+'  Cover All 40!');
      break;
    }
  }

  /* Step 2 + 3: remaining patterns in winPatterns order — basePat (index 0,
     lowest pay) already played on the MAIN reels, so skip it here. The
     remaining entries are the middle patterns ascending by pay, followed
     by Progressive Jackpot LAST (reel:'coverall') as the grand finale.
     runRS plays each in sequence; when it reaches the Progressive entry
     it calls showProgJP directly instead of continuing. */
  var rsSeq=winPatterns.slice(1).filter(function(p){return p.reel;});
  /* Safety: Progressive must always end the sequence. If basePat itself
     (winPatterns[0]) is the progressive pattern — i.e. nothing else won —
     it's already on the main reels but rsSeq would be empty; append it
     so showProgJP still fires. */
  if(!rsSeq.some(function(p){return p.isProgressive;})){
    rsSeq.push(basePat);
  }

  startPatternCycle([basePat]);
  setTimeout(function(){
    stopPatternCycle();
    runRS(rsSeq,S.cpl,function(){ /* unused — Progressive entry ends the sequence */ },
      {amt:progAmt, pennyAmt:pennyAmt, winPatterns:winPatterns,
       cardSerial:cardSerial, balBefore:balBefore});
  },600);
}

/* showProgJP — Progressive Jackpot grand-finale celebration overlay.
   Called AFTER all other winning patterns have already been daubed/awarded
   via _finishProgressiveSpin. On dismiss: full-card daub, log, and end the
   ball sequence (Cover All occurred per bingo rules). */
function showProgJP(progAmt, winPatterns, cardSerial, balBefore) {
  var CEL_VIDS = [
    'assets/videos/josie_dance.mp4',
    'assets/videos/sasha_dance.mp4',
    'assets/videos/sasha_alt.mp4'
  ];
  var cel  = document.getElementById('force-win-cel');
  var vid  = document.getElementById('fw-video');
  var amtEl = document.getElementById('fw-amt');
  var subEl = document.getElementById('fw-sub');

  if (amtEl) amtEl.textContent = fmtMoney(progAmt);
  if (subEl) subEl.textContent = 'PROGRESSIVE JACKPOT!';
  if (vid) {
    vid.src = CEL_VIDS[Math.floor(Math.random() * CEL_VIDS.length)];
    vid.load(); vid.play();
  }
  if (cel) cel.classList.add('show');

  /* Guard against a residual tap/click from dismissing the PREVIOUS
     overlay (e.g. the $800 Corporal Stripes JACKPOT popup) from
     instantly dismissing THIS overlay too. Dismiss handlers attach
     after a short delay so this celebration is actually seen. */
  var _dismissReady=false;
  setTimeout(function(){_dismissReady=true;},600);

  var dismissBtn = document.getElementById('fw-dismiss');
  function onDismiss() {
    if (!_dismissReady) return; /* ignore residual tap from prior overlay */
    /* Re-arm the watchdog now that we're in the cleanup phase
       (full-card daub, opLog, new WABC sequence request) — this CAN
       hang on a DB issue, unlike waiting for the player's tap. */
    _refreshSpinWatchdog();
    if (cel) cel.classList.remove('show');
    if (dismissBtn) dismissBtn.removeEventListener('click', onDismiss);

    /* Full-card daub — Cover All means every cell is part of the win */
    var _allWinCells = {};
    for (var _wci = 0; _wci < winPatterns.length; _wci++) {
      for (var _wcc = 0; _wcc < winPatterns[_wci].cells.length; _wcc++) {
        _allWinCells[winPatterns[_wci].cells[_wcc]] = true;
      }
    }
    var _allCellArr = Object.keys(_allWinCells).map(Number);
    renderBingoCard(BG.card, BG.matchedCells, _allCellArr);
    startPatternCycle(winPatterns);

    opLog({type:'SPIN', gameSerial:genGameSerial(), cardSerial:cardSerial,
      bet:S.cpl * (typeof DENOM !== 'undefined' ? DENOM : 1),
      win:S.lastWin, balls:25,
      isProgressive:true, progAmount:S.lastWin,
      patterns:winPatterns.map(function(p){return p.name;}),
      balBefore:balBefore, balAfter:S.bal});

    /* Cover All already ended the sequence and requested a fresh WABC
       sequence for all players at spin-result time (_handleCoverAll(true),
       before Red Spin even started) — this is the SAME flow as any other
       cover-all/WABC switch; being a Lazy-T/progressive win doesn't change
       it. Do NOT request a second sequence here — that was redundant
       (issuing a second new sequence after one was already adopted
       mid-Red-Spin). Just stop the entertainment caller now that the
       celebration is done. */
    stopActiveCaller();
    updateBallCallBadge();

    _spinDebounce = Date.now();
    (function(){if(_spinWatchdog){clearTimeout(_spinWatchdog);_spinWatchdog=null;}})();
    S.spinning = false; setCtrl(true); updUI();
  }
  if (dismissBtn) {
    dismissBtn.removeEventListener('click', onDismiss);
    dismissBtn.addEventListener('click', onDismiss);
  }
  if (cel) {
    cel.onclick = function(e) {
      if (e.target === cel) onDismiss();
    };
  }
}

function updateProgMeter(value){
  var el=document.getElementById('prog-meter-val');
  if(el) el.textContent=fmtMoney(value);
}

function _setSplashConnStatus(msg, color) {
  var el = document.getElementById('splash-conn-status');
  if (el) { el.textContent = msg; if (color) el.style.color = color; }
}
function _setSplashBallStatus(msg) {
  var el = document.getElementById('splash-ball-status');
  if (el) el.textContent = msg;
}

function initProgressiveMeter(){
  if(typeof Progressive==='undefined'){
    _setSplashConnStatus('⚠ Local mode only', '#ffaa00');
    return;
  }
  _setSplashConnStatus('Connecting to wide area…', '#ffaa00');
  Progressive.onChange(updateProgMeter);
  Progressive.onBallCallUpdate(function(newSeq) {
    /* onBallCallUpdate fires ONLY when issued_at changes (new sequence issued).
       progressive.js now filters out ball_pos-only updates.
       This means: Cover All fired, ball 75 exhausted, or operator issued NEW CALL.
       Reset ballPos and re-dub current card against the new sequence. */
    BG.callSeq = newSeq;
    BG.usingServerBalls = true;
    BG.ballPos = 0;
    updateBallCallBadge();
    if (BG.card && Object.keys(BG.cardNumSet).length > 0) {
      BG.matchedCells = {12: true};
      for (var _rb = 0; _rb < 40; _rb++) {
        var _rball = BG.callSeq[_rb];
        if (BG.cardNumSet[_rball] !== undefined)
          BG.matchedCells[BG.cardNumSet[_rball]] = true;
      }
      renderBingoCard(BG.card, BG.matchedCells, null);
      renderBallStrip(BG.callSeq, 40, BG.cardNumSet);
    } else {
      clearBallStrip();
    }
  });
  Progressive.onConnChange(function(isOnline) {
    var banner = document.getElementById('prog-offline-banner');
    var lbl    = document.getElementById('prog-meter-lbl');
    var val    = document.getElementById('prog-meter-val');
    if (banner) banner.classList.toggle('show', !isOnline);
    if (lbl) {
      lbl.classList.toggle('local-mode', !isOnline);
      lbl.textContent = isOnline ? '★ PROGRESSIVE JACKPOT ★' : '★ LOCAL JACKPOT ★';
    }
    if (val) val.classList.toggle('local-mode', !isOnline);
    updateBallCallBadge();
    if (typeof Progressive !== 'undefined') updateProgMeter(Progressive.getValue());
  });
  Progressive.init(function(){
    if (Progressive.isConnected()) {
      _setSplashConnStatus('✔ Wide area connected', '#00ff88');
    } else {
      _setSplashConnStatus('⚠ Local mode — no wide area', '#ffaa00');
    }
    updateProgMeter(Progressive.getValue());

    /* v5.40 — Wire WABC for ball call sequence.
       WABC is independent of Progressive (WAP jackpot).
       Progressive owns the pot; WABC owns the ball sequence. */
    _setSplashBallStatus('Fetching ball call…');
    if(typeof WABC !== 'undefined') {
      WABC.init(function() {
        var _seq = WABC.getSequence();
        if(_seq && _seq.length === 75) {
          BG.callSeq = _seq;
          BG.ballPos = 40;
          BG.usingServerBalls = true;
          BG.seqExhausted = false;
          /* Daub first 40 balls against initial card if one exists */
          if(BG.card && Object.keys(BG.cardNumSet).length > 0) {
            BG.matchedCells = {12:true};
            for(var _ib=0;_ib<40;_ib++){
              var _iball=BG.callSeq[_ib];
              if(BG.cardNumSet[_iball]!==undefined)
                BG.matchedCells[BG.cardNumSet[_iball]]=true;
            }
            renderBingoCard(BG.card,BG.matchedCells,null);
          }
          if(!_ballNodes||_ballNodes.length<75) buildBallStrip();
          renderBallStrip(BG.callSeq,40,BG.cardNumSet);
          _setSplashBallStatus('✔ Wide area ball call ready');
        } else {
          /* WABC returned empty — fall back to local */
          BG.callSeq = genBallCall();
          BG.ballPos = 40;
          BG.usingServerBalls = false;
          BG.seqExhausted = false;
          if(!_ballNodes||_ballNodes.length<75) buildBallStrip();
          renderBallStrip(BG.callSeq,40,BG.cardNumSet);
          _setSplashBallStatus('⚠ Local ball call active');
        }
        updateBallCallBadge();

        /* ── WABC event hooks ── registered once here, never re-registered */

        /* Operator issued Reset — new sequence, all players fast-forward to 40 */
        WABC.onNewCall(function(newSeq) {
          if(!newSeq||newSeq.length!==75) return;
          BG.callSeq = newSeq;
          BG.ballPos = 40;
          BG.usingServerBalls = true;
          BG.seqExhausted = false;
          if(BG.card && Object.keys(BG.cardNumSet).length > 0) {
            BG.matchedCells = {12:true};
            for(var _nc=0;_nc<40;_nc++){
              var _ncball=BG.callSeq[_nc];
              if(BG.cardNumSet[_ncball]!==undefined)
                BG.matchedCells[BG.cardNumSet[_ncball]]=true;
            }
            renderBingoCard(BG.card,BG.matchedCells,null);
            renderBallStrip(BG.callSeq,40,BG.cardNumSet);
          }
          updateBallCallBadge();
        });

        /* Operator forced local — all players switch to local ball call */
        WABC.onForceLocal(function() {
          BG.callSeq = genBallCall();
          BG.ballPos = 40;
          BG.usingServerBalls = false;
          BG.seqExhausted = false;
          if(BG.card && Object.keys(BG.cardNumSet).length > 0) {
            BG.matchedCells = {12:true};
            for(var _fl=0;_fl<40;_fl++){
              var _flball=BG.callSeq[_fl];
              if(BG.cardNumSet[_flball]!==undefined)
                BG.matchedCells[BG.cardNumSet[_flball]]=true;
            }
            renderBingoCard(BG.card,BG.matchedCells,null);
            renderBallStrip(BG.callSeq,40,BG.cardNumSet);
          }
          updateBallCallBadge();
          toast('⚠ Switched to local ball call');
        });

        /* Operator restored wide area — re-sync all players to WABC sequence */
        WABC.onRestoreWide(function(restoredSeq) {
          if(!restoredSeq||restoredSeq.length!==75) return;
          BG.callSeq = restoredSeq;
          BG.ballPos = 40;
          BG.usingServerBalls = true;
          BG.seqExhausted = false;
          if(BG.card && Object.keys(BG.cardNumSet).length > 0) {
            BG.matchedCells = {12:true};
            for(var _rw=0;_rw<40;_rw++){
              var _rwball=BG.callSeq[_rw];
              if(BG.cardNumSet[_rwball]!==undefined)
                BG.matchedCells[BG.cardNumSet[_rwball]]=true;
            }
            renderBingoCard(BG.card,BG.matchedCells,null);
            renderBallStrip(BG.callSeq,40,BG.cardNumSet);
          }
          updateBallCallBadge();
          toast('✔ Wide area ball call restored');
        });

        /* WABC.onChange NOT wired — each player drives BG.ballPos locally */

        /* Provide our current ball position to newly-joined players.
           Only respond if WE are actively calling (entTimer running) —
           silent/idle players don't answer sync requests. */
        WABC.setPosProvider(function() {
          return BG.entTimer ? BG.ballPos : null;
        });

        /* We just joined — another active player answered with the live
           ball position. Fast-forward our card/strip to match instead of
           sitting at ball 40. */
        WABC.onSyncResponse(function(pos) {
          if (!pos || pos <= BG.ballPos) return;
          BG.ballPos = Math.min(pos, 75);
          if (BG.card && Object.keys(BG.cardNumSet).length > 0) {
            BG.matchedCells = {12:true};
            var _capN = Math.min(BG.ballPos, BG.callSeq.length);
            for (var _si=0; _si<_capN; _si++) {
              var _sball = BG.callSeq[_si];
              if (BG.cardNumSet[_sball] !== undefined) {
                BG.matchedCells[BG.cardNumSet[_sball]] = true;
              }
            }
            renderBingoCard(BG.card, BG.matchedCells, null);
          }
          renderBallStrip(BG.callSeq, BG.ballPos, BG.cardNumSet);
          updateBallCallBadge();
          if (BG.ballPos >= 40 && !BG.entTimer) startActiveCaller();
        });
      });
    } else {
      /* WABC not loaded — fall back to local */
      BG.callSeq = genBallCall();
      BG.ballPos = 40;
      BG.usingServerBalls = false;
      BG.seqExhausted = false;
      if(!_ballNodes||_ballNodes.length<75) buildBallStrip();
      renderBallStrip(BG.callSeq,40,BG.cardNumSet);
      _setSplashBallStatus('⚠ Local ball call active');
      updateBallCallBadge();
    }
    setTimeout(function(){ sizeLayout(); }, 50);
  });
}

/* -- INIT -- */
/* Read player nickname from URL param (passed by Gold Coins Casino lobby) */
(function(){
  try {
    var _urlParams = new URLSearchParams(window.location.search);
    var _urlNick = _urlParams.get('player');
    if (_urlNick && _urlNick.trim().length >= 2) {
      window._playerNickname = _urlNick.trim().substring(0, 16);
    }
  } catch(e) {}
}());
BG.callSeq=genBallCall(); /* local default — overwritten by server on init */
BG.ballPos=0;
// State 1: idle — show pattern showcase, run silent caller
GS.state='idle';
buildBallStrip(); // pre-build ball nodes (empty)
buildBingoCardNodes(); // pre-build card grid (empty cells visible before first spin)
/* Render empty grid immediately so structure is always visible */
if(_ballNodes&&_ballNodes.length===75){
  for(var _ei=0;_ei<75;_ei++){
    _ballNodes[_ei].className='ball empty';
    _ballNodes[_ei].textContent='';
  }
}
document.getElementById('bingo-col-hdrs').style.display='none';
(function(){
  var initGhosts=[
    {above2:6,above:6,sym:5,below:4,below2:6},
    {above2:6,above:6,sym:1,below:3,below2:4},
    {above2:3,above:6,sym:4,below:6,below2:2}
  ];
  renderReels([5,1,4],initGhosts);
}());
updUI();
initProgressiveMeter();
startSilentCaller();
setTimeout(sizeLayout,100); // game load — silent until first SPIN
startPatternShowcase();

document.getElementById('spin-btn').addEventListener('click',doSpin);
document.getElementById('spin-btn').addEventListener('touchend',function(e){e.preventDefault();doSpin();});
document.addEventListener('keydown',function(e){if(e.code==='Space'||e.code==='Enter'){e.preventDefault();doSpin();}});
document.getElementById('cred-btn').addEventListener('click',function(){if(S.spinning)return;var i=CPL.indexOf(S.cpl);S.cpl=CPL[(i+1)%CPL.length];updUI();});
document.getElementById('max-btn').addEventListener('click',function(){if(S.spinning)return;S.cpl=3;updUI();setTimeout(doSpin,80);});
document.getElementById('help-btn').addEventListener('click',function(){renderHelp();document.getElementById('help').classList.add('on');});
document.getElementById('help-close').addEventListener('click',function(){document.getElementById('help').classList.remove('on');});
  document.getElementById('co-btn').addEventListener('click',function(){if(S.spinning)return;if(S.bal<=0){toast('NOTHING TO CASH OUT');return;}var _coAmt=S.bal;toast('CASHING OUT '+fmt(_coAmt));S.bal=0;opLog({type:'CASH_OUT',amount:_coAmt,balBefore:_coAmt,balAfter:0});updUI();});
document.getElementById('ic-btn').addEventListener('click',function(){if(S.spinning)return;document.getElementById('ic-ov').classList.add('on');});
document.getElementById('ic-ok').addEventListener('click',function(){var v=parseFloat(document.getElementById('ic-inp').value);if(v>0&&v<=9999){var _ciBal=S.bal;S.bal+=v;opLog({type:'CASH_IN',amount:v,balBefore:_ciBal,balAfter:S.bal});updUI();toast(fmt(v)+' ADDED');sndCreditsAddUp();}document.getElementById('ic-ov').classList.remove('on');});
document.getElementById('ic-no').addEventListener('click',function(){document.getElementById('ic-ov').classList.remove('on');});
document.querySelectorAll('.icpre').forEach(function(btn){btn.addEventListener('click',function(){var a=parseFloat(btn.getAttribute('data-a'));var _ciBalP=S.bal;S.bal+=a;opLog({type:'CASH_IN',amount:a,balBefore:_ciBalP,balAfter:S.bal});updUI();toast(fmt(a)+' ADDED');sndCreditsAddUp();document.getElementById('ic-ov').classList.remove('on');});});
document.getElementById('ic-ov').addEventListener('click',function(e){if(e.target===this)this.classList.remove('on');});

}());
