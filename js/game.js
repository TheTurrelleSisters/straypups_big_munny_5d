
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
  setTimeout(function(){
    initReelSlots();
    if(!_ballNodes||_ballNodes.length<75) buildBallStrip();
    if(!_cardNodes||_cardNodes.length<25) buildBingoCardNodes();
    /* Re-render showcase after card rebuild during idle — always go through
       startPatternShowcase() so the existing timer is cleared first.
       Direct _showNextPattern() calls from here stacked timers on top of
       the one already running from startPatternShowcase(), causing the
       double-run glitch (two timers racing at different phases). */
    if(GS.state==='idle') startPatternShowcase();
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
/* SOUND STUBS — sndSmallWin/sndBigWin/sndJackpot/sndBonusSpin are intentionally
   identical (all play snd-ring). They are semantic placeholders awaiting unique
   audio assets. Do NOT collapse them into one function — the distinct names
   document intent at every call site. */
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

/* â”€â”€ BINGO CARD STATE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
var BG={
  card:[],cardSerial:'',callSeq:[],cardNumSet:{},matchedCells:{},
  winPatterns:[],ballPos:0,entTimer:null,patternCycle:null,cycleIdx:0,
  _coverAll1to40:false,usingServerBalls:false,seqExhausted:false,
  awaitingNewSeq:false,_coverAll75Fired:false
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
  var _denom = (typeof PROG_DENOM !== 'undefined' ? PROG_DENOM : 1);
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

/* v5.115: refreshServerBallCall() and _scheduleResync() removed.
   Both were dead code — never called. _scheduleResync used Progressive.getBallCall()
   which is a stub always returning isServer=false, so the interval could never
   clear itself. Sequence resync is handled correctly by WABC.onNewCall(). */

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
     - Balls 41-75 (entertainment): fill in ONE AT A TIME via server-driven WABC.onChange (_onServerBallPos).
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

/* ── PATTERN CYCLE ───────────────────────────────────────────────── */
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
// GS.state: 'idle' = showcase running (pre-first-spin), 'active' = player has spun
var GS={state:'idle',hasSpun:false};

/* -- PATTERN SHOWCASE (idle only) -- */
var _showcaseTimer=null; var _showcaseIdx=0; var _showcaseRunning=false;
function startPatternShowcase(){
  stopPatternShowcase();   /* always clears timer + _showcaseRunning before restart */
  _showcaseIdx=0;
  _showcaseRunning=true;
  _showNextPattern();
}
function stopPatternShowcase(){
  _showcaseRunning=false;
  if(_showcaseTimer){clearTimeout(_showcaseTimer);_showcaseTimer=null;}
  /* Clear frozen pattern from card so spin doesn't flash last showcased pattern */
  document.getElementById('bingo-pattern-name').textContent='\u00a0';
  if(_cardNodes&&_cardNodes.length===25){
    for(var _sci=0;_sci<25;_sci++){
      _cardNodes[_sci].className='bc'+(_sci===12?' free':'');
      _cardNodes[_sci].textContent=_sci===12?'*':'';
    }
  }
}
function _showNextPattern(){
  /* Dual guard: GS.state must be idle AND _showcaseRunning must be true.
     _showcaseRunning is only set by startPatternShowcase() and cleared by
     stopPatternShowcase(). This prevents any stale timer (e.g. from a
     sizeLayout resize call) from re-entering the loop after it was stopped. */
  if(!_showcaseRunning||GS.state!=='idle') return;
  var nameEl=document.getElementById('bingo-pattern-name');
  /* Brief blank frame between patterns — clears card and name for 250ms
     before the next pattern renders. Eliminates the glitch/flash caused
     by simultaneous cell transitions firing on the previous pattern's
     highlighted cells. Gives a clean, consistent rhythm at one speed. */
  nameEl.style.color='#f5d878';
  nameEl.textContent='\u00a0';
  if(_cardNodes&&_cardNodes.length===25){
    for(var _bi=0;_bi<25;_bi++){
      _cardNodes[_bi].className='bc'+(_bi===12?' free':'');
      _cardNodes[_bi].textContent=_bi===12?'*':'';
    }
  }
  _showcaseTimer=setTimeout(function(){
    if(GS.state!=='idle') return;
    var pat=BINGO_PATTERNS[_showcaseIdx%BINGO_PATTERNS.length];
    _showcaseIdx++;
    /* Set name FIRST — text and card change together in the same frame */
    if(pat.isProgressive){
      nameEl.textContent=pat.name.toUpperCase()+' \u2014 In '+pat.balls+' Balls | PROGRESSIVE POT';
      nameEl.style.color='#ffd700';
    } else if(!pat.reel){
      nameEl.textContent=pat.name.toUpperCase()+' \u2014 In '+pat.balls+' Balls | $'+pat.pay[0].toFixed(2);
      nameEl.style.color='#f5d878';
    } else {
      nameEl.textContent=pat.name.toUpperCase()+' \u2014 In '+pat.balls+' Balls | $'+pat.pay[0]+'/$'+pat.pay[1]+'/$'+pat.pay[2];
      nameEl.style.color='#f5d878';
    }
    /* Render card highlight after name is set */
    var dummyCells=[];
    for(var i=0;i<25;i++) dummyCells.push(i===12?null:0);
    var patMatched={12:true};
    for(var ci=0;ci<pat.cells.length;ci++) patMatched[pat.cells[ci]]=true;
    renderBingoCard(dummyCells,patMatched,pat.cells);
    /* Fixed 5000ms dwell — same for every pattern, enough time to read
       name, ball threshold, and pay at any complexity. No variable speeds. */
    _showcaseTimer=setTimeout(_showNextPattern,5000);
  },250); /* 250ms blank gap between patterns */
}

/* -- ENTERTAINMENT PHASE STATE --
   BG.entTimer is now a boolean flag (true/false) only.
   Ball position is driven by the server (wabc-ball-ticker Edge Function)
   via WABC.onChange — no local timer needed.
   startActiveCaller: marks entertainment phase as active.
   stopActiveCaller:  marks entertainment phase as inactive.
   The flag gates: Cover All 75 detection, setPosProvider, card rendering. */
function startActiveCaller(){
  BG.entTimer=true;
}
function stopActiveCaller(){
  BG.entTimer=false;
}

/* _onServerBallPos — called by WABC.onChange when server broadcasts a new
   ball position. Server only drives balls 41-75 (entertainment phase).
   BG.ballPos starts at 40 after every spin/sequence reset.
   Server sends pos=41, 42... 74 then issues a new sequence back at 40. */
function _onServerBallPos(newPos){
  if(!BG.card||!BG.callSeq||BG.callSeq.length!==75) return;
  if(newPos<=40||newPos>75) return;  /* server only sends 41-75 now */
  if(newPos<=BG.ballPos) return;     /* ignore stale or duplicate pos */

  /* Update BG.ballPos */
  BG.ballPos=newPos;

  /* Daub all entertainment balls up to current position
     (handles catch-up if player joins mid-sequence) */
  for(var _bp=40;_bp<BG.ballPos;_bp++){
    var _bball=BG.callSeq[_bp];
    if(BG.cardNumSet[_bball]!==undefined)
      BG.matchedCells[BG.cardNumSet[_bball]]=true;
  }

  /* Gate: never overwrite the card during Red Spin or any active spin.
     runRS sets pattern highlights on the card as each reel stops — a
     server ball-pos event mid-Red Spin must not wipe those highlights
     by re-rendering with winPatternCells=null. The ball strip can still
     update (server position is authoritative for the strip display). */
  if(GS.state==='active'&&!S.spinning){
    renderBingoCard(BG.card,BG.matchedCells,null);
  }
  renderBallStrip(BG.callSeq,BG.ballPos,BG.cardNumSet);

  /* Cover All 75 check */
  if(!BG._coverAll75Fired&&!BG.awaitingNewSeq&&
     Object.keys(BG.matchedCells).length===25){
    _handleCoverAll75();
  }
}

/* -- COVER ALL HANDLER -- */
/* Cover All 40: all 25 cells covered within balls 1-40.
   Penny credited, new sequence requested, broadcast to all players.
   $0.01 pay is credited in _broadcastCoverAll(). */
function _handleCoverAll(){
  stopActiveCaller();
  BG.seqExhausted=true;
  BG.awaitingNewSeq=true;
  BG._coverAll75Fired=true; /* prevent Cover All 75 from also firing this sequence */
  updateBallCallBadge();
  _requestNewWABCSequence();
  _broadcastCoverAll('Cover All — 40 Balls!');
}

/* Cover All 75: all 25 cells covered within balls 41-75.
   Identical award to Cover All 40 — penny + toast + new sequence.
   Only fires if Cover All 40 did NOT already fire this sequence.
   Guard: BG.awaitingNewSeq=true means Cover All 40 already fired — ignore. */
function _handleCoverAll75(){
  if(BG._coverAll75Fired) return; /* already fired this sequence */
  if(BG.awaitingNewSeq) return;   /* Cover All 40 already fired — ignore */
  BG._coverAll75Fired=true;
  stopActiveCaller();
  BG.seqExhausted=true;
  BG.awaitingNewSeq=true;
  updateBallCallBadge();
  _requestNewWABCSequence();
  _broadcastCoverAll('Cover All — 75 Balls!');
}

/* _broadcastCoverAll — credits $0.01 and shows local toast to the winning player only.
   msg: display string e.g. 'Cover All — 40 Balls!' or 'Cover All — 75 Balls!'
   IMPORTANT: Cover All is a sequence/system event, NOT a player-facing announcement.
   The $0.01 award and toast are LOCAL ONLY — only the player whose spin triggered
   Cover All receives the penny and sees the toast. Other players learn about the new
   sequence via WABC (upsert_ball_call broadcast), not through broadcast_messages.
   No insert into broadcast_messages — prevents:
     (a) idle/non-spinning players receiving a misleading "Cover All" win banner
     (b) startup message spam when _checkUnreadMessages replays accumulated rows */
function _broadcastCoverAll(msg){
  var _msg = msg || 'Cover All Achieved!';
  toast(_msg);
  S.bal+=0.01;updUI();
}


/* v5.115: generateCoverAllSpin() removed — only called from
   Force Jackpot path which is now removed. Natural progressive
   jackpot wins use doBingoSpin() + armAndClaim() exclusively. */




/* _requestNewWABCSequence — called when Cover All fires (40 or 75).
   Normal sequence exhaustion at ball 75 is now handled server-side by
   the wabc-ball-ticker Edge Function. This is a client-side fallback
   for Cover All events only.
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
      /* Broadcast to all OTHER players — wabc-ballpos channel is configured
         with broadcast.self=false, so the sender never receives this event
         back. Apply the new sequence locally right here for the triggering
         player instead of waiting on WABC.onNewCall, which would never
         fire for them and would leave THIS player's BG.awaitingNewSeq
         stuck on true forever (the "Ball Sequence Loading" lockup). */
      if(window._wabcChannel) {
        window._wabcChannel.send({
          type:    'broadcast',
          event:   'new_call',
          payload: { sequence: _newSeq, issued_at: _newIAt }
        });
      }
      /* Sync WABC's own internal _issuedAt/_sequence/_ballPos for the
         triggering player. Without this, WABC's seq_issued_at guard on
         incoming 'pos' broadcasts keeps comparing against the OLD
         issued_at and silently drops every ball-position update from
         the new sequence — freezing the strip at ball 40 (balls 41-75
         never animate) even though awaitingNewSeq has been cleared. */
      if(typeof WABC !== 'undefined' && WABC.applyLocalNewCall) {
        WABC.applyLocalNewCall(_newSeq, _newIAt);
      }
      BG.callSeq = _newSeq;
      BG.ballPos = 40;
      BG.usingServerBalls = true;
      BG.seqExhausted = false;
      BG.awaitingNewSeq = false;
      BG._coverAll75Fired = false;
      if(BG.card && Object.keys(BG.cardNumSet).length > 0) {
        BG.matchedCells = {12:true};
        for(var _nc=0;_nc<40;_nc++){
          var _ncball=BG.callSeq[_nc];
          if(BG.cardNumSet[_ncball]!==undefined)
            BG.matchedCells[BG.cardNumSet[_ncball]]=true;
        }
        if(GS.state==='active'){
          renderBingoCard(BG.card,BG.matchedCells,null);
        }
        renderBallStrip(BG.callSeq,40,BG.cardNumSet);
      }
      updateBallCallBadge();
    }).catch(function(err) {
      console.warn('[WABC] _requestNewWABCSequence catch:', err);
    });
}

function doBingoSpin(){
  stopPatternCycle();

  // Preserve how many balls have been revealed so far.
  var prevBallPos=BG.ballPos||0;

  /* WABC is the only source of ball sequences. Always re-sync from WABC on
     spin press so all players see the exact same sequence. */
  if(BG.usingServerBalls && typeof WABC !== 'undefined') {
    var _wabcSeq = WABC.getSequence();
    if(!_wabcSeq || _wabcSeq.length !== 75) {
      /* Sequence not ready — DB may be restarting */
      toast('Ball call unavailable \u2014 please wait for connection');
      S.spinning=false; S.bal+=S.cpl; setCtrl(true); updUI();
      return [];
    }
    BG.callSeq = _wabcSeq;
    if(BG.seqExhausted) {
      _requestNewWABCSequence();
      prevBallPos = 40;
    }
    BG.seqExhausted = false;
  } else {
    /* WABC unavailable — cannot proceed without a valid ball sequence */
    toast('Ball call unavailable \u2014 please wait for connection');
    S.spinning=false; S.bal+=S.cpl; setCtrl(true); updUI();
    return [];
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
  /* Cover All in balls 1-40: use the authoritative wonPatterns result —
     NOT matchedCells.length which includes entertainment balls from prior spin
     and can false-positive. isCoverAll flag set in paytable.js. */
  BG._coverAll1to40=false;
  for(var _capi=0;_capi<BINGO_PATTERNS.length;_capi++){
    if(BINGO_PATTERNS[_capi].isCoverAll&&wonPatterns[_capi]){
      BG._coverAll1to40=true;break;
    }
  }
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
  // v5.95 FIX: win-looking checks MUST run before blank short-circuit.
  // Previously blank ran first (~50% frequency), causing blank/cherry or
  // blank/wild combos to exit as SAFE without ever checking the other reels.
  // Any cherry on any reel = always looks like Open Diamond pay — reject first.
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
  // Blank present with no win-looking combo = safe non-win (fallback)
  if(L[0]===6||L[1]===6||L[2]===6) return{amt:0};
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

  /* Overshoot 0.6 slots past target then snap back — VGT mechanical thud.
     Per PHASE_PLAN v5.92: overshoot + snap-back is intentional design. */
  var overshootExtra=Math.round(slotH*0.6);
  var overshootY=targetY-overshootExtra;

  /* Phase timing */
  var t1=Math.round(stopDelay*0.75); /* phase 1: constant velocity to overshoot */
  var t2=Math.round(stopDelay*0.90); /* phase 2: hold at overshoot briefly */

  strip.style.willChange='top';
  reel.classList.add('spinning');

  var startTime=null;
  var snapped=false;

  /* Fallback timer: Samsung Browser and backgrounded tabs throttle/stop rAF.
     If rAF hasn't completed by stopDelay+500ms, force completion.
     _rafDone prevents double-firing if both rAF and fallback trigger. */
  var _rafDone=false;
  var _rafFallback=setTimeout(function(){
    if(_rafDone) return;
    _rafDone=true;
    console.log('[spinReel] reel'+reelIdx+' rAF fallback fired');
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
  },stopDelay+500);

  function frame(ts){
    if(_rafDone) return; /* fallback already fired — stop rAF loop */
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
        _rafDone=true;
        clearTimeout(_rafFallback);
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
  var _jpDone=false;
  function _doJPDismiss(){
    if(_jpDone) return; _jpDone=true;
    el.classList.remove('on');
    el.onclick=null; el.ontouchend=null;
    if(cb) cb();
  }
  el.onclick=function(){_doJPDismiss();};
  el.ontouchend=function(e){e.preventDefault();_doJPDismiss();};
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
    console.log('[RedSpin] playNext called, seqIdx='+seqIdx+', total='+rsPatterns.length);
    if(seqIdx>=rsPatterns.length){
      frame2.classList.remove('bonus-active');
      redOv.classList.remove('on');badge.classList.remove('on');
      sndRedSpinEnd();
      toast('RED SPIN BONUS: '+fmt(bonusTotal));
      onDone(bonusTotal);return;
    }
    var pat=rsPatterns[seqIdx];seqIdx++;
    _refreshSpinWatchdog();
    console.log('[RedSpin] Pattern: '+pat.name+', reel: '+pat.reel);
    badge.textContent='RED SPIN '+seqIdx;
    /* Clear pattern name and card highlight BEFORE reels spin —
       player sees no answer until the 3rd reel lands. */
    var _pnEl=document.getElementById('bingo-pattern-name');
    if(_pnEl) _pnEl.textContent='\u00a0';
    var reelSyms=REEL_SYMS[pat.reel]||REEL_SYMS['none'];
    var sr=forcedSpinResult(reelSyms);
    sndBonusSpin();
    var RS_STOP=[500,800,1100];var rsDone=0; /* v5.70 timing */
    /* v5.96 FIX: spinReel calls were missing — _onReelDone was defined but
       never triggered, causing Red Spin to hang permanently on every pattern. */
    for(var _ri=0;_ri<3;_ri++){(function(r){spinReel(r,sr.ghosts[r],RS_STOP[r],_onReelDone);}(_ri));}
    function _onReelDone(){
      rsDone++;
      console.log('[RedSpin] _onReelDone called, rsDone='+rsDone);
      if(rsDone<3) return; /* wait for all 3 reels to finish */
      /* Reveal pattern name + card highlight NOW — exactly as 3rd reel lands.
         Player sees the result at the moment of stop, not before the spin. */
      if(_pnEl) _pnEl.textContent=pat.name.toUpperCase();
      renderBingoCard(BG.card,BG.matchedCells,pat.cells);
      console.log('[RedSpin] All 3 reels done, firing 120ms callback');
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
  } /* v5.112 FIX: this brace closes playNext — was previously placed AFTER
       the setTimeout(playNext,200) kickoff call below, leaving that call
       trapped INSIDE playNext's own body. Every playNext() invocation was
       re-firing itself 200ms later regardless of whether the current
       pattern's reel animation (500-1450ms) had finished, racing seqIdx
       past rsPatterns.length on any 2+ pattern win. pat became undefined,
       the next pat.* access threw inside an uncaught async callback, and
       onDone() never fired — S.spinning/setCtrl(false) stayed stuck
       forever (the Red Spin lockup). Fix: kickoff call now runs exactly
       once, at runRS's level, after playNext is fully defined. */
  setTimeout(playNext,200);
}

/* â”€â”€ MAIN SPIN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function doSpin(){
  if(S.spinning) return;
  if(Date.now()-_spinDebounce<300) return;
  if(BG.awaitingNewSeq){toast('New ball sequence loading \u2014 please wait');return;}
  if(S.bal<S.cpl){toast('INSERT CASH TO PLAY');return;}
  if(_reelWinH===0) initReelSlots();
  S.spinning=true;S.bal-=S.cpl;
  if(typeof Progressive!=='undefined'){
    Progressive.registerPlayer(null, window._playerNickname || null);
    if(Progressive.updateLastSpin) Progressive.updateLastSpin();
    if(Progressive.contribute) Progressive.contribute(S.cpl);
  }
  var _spinBalBefore=S.bal+S.cpl; var _spinCardSerial=BG.cardSerial;
  setWin(0,'');document.getElementById('bt-box').classList.remove('on');
  updUI();setCtrl(false);
  stopPatternCycle();
  // Transition to active state on first spin
  if(GS.state==='idle'){
    stopPatternShowcase();
    document.getElementById('bingo-col-hdrs').style.display='';
    if(!_cardNodes||_cardNodes.length<25) buildBingoCardNodes();
  }
  GS.hasSpun=true;GS.state='active';

  var winPatterns=doBingoSpin();

  // ── SPIN CONTINUATION ───────────────────────────────────────────────────
  // ALL spin logic lives in _continueSpinAfterClaim().
  function _continueSpinAfterClaim(){
    /* Mark entertainment phase as active. Server (wabc-ball-ticker) drives
       actual ball positions via WABC.onChange → _onServerBallPos. */
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
      /* v5.115 PERMANENT DESIGN — pattern order lowest pay -> highest pay.
         All reel-bearing patterns sorted ascending by pay[S.cpl-1].
         basePat = winPatterns[0] = lowest-paying reel-bearing pattern.
         Cover All 40 (reel:null) is the trigger event — handled by
         _handleCoverAll() at spin result — NOT a reel or Red Spin entry.
         Progressive (Lazy-T) always last via _finishProgressiveSpin.
         NEVER revert to ball-completion order without owner confirmation. */
      var _progInWins=false;
      for(var _rpi=0;_rpi<winPatterns.length;_rpi++){
        if(winPatterns[_rpi].isProgressive) _progInWins=true;
      }
      /* Separate progressive from reel-bearing patterns.
         Cover All 40 (reel:null) excluded from reel sequence entirely —
         it is handled as an event, not an awardable reel slot. */
      var _reelPats=winPatterns.filter(function(p){return !p.isProgressive&&p.reel;});
      var _progPats=winPatterns.filter(function(p){return p.isProgressive;});
      /* Sort reel-bearing patterns ascending by pay — lowest first.
         basePat will be winPatterns[0] = lowest reel-bearing pattern. */
      _reelPats.sort(function(a,b){return a.pay[S.cpl-1]-b.pay[S.cpl-1];});
      winPatterns=_reelPats.concat(_progPats);
      /* Progressive: main reels show 3x JP symbol.
         Non-progressive: lowest reel-bearing pattern drives main reels.
         Cover All alone (no reel patterns): non-winning combo on reels. */
      spinData=forcedSpinResult(_progInWins?REEL_SYMS['coverall']:(_reelPats.length>0?(REEL_SYMS[_reelPats[0].reel]||REEL_SYMS['none']):REEL_SYMS['none']));
    }

    animateReels(spinData,function(){
      if(winPatterns.length===0){
        setWin(0,'NO BINGO');
        opLog({type:'SPIN',gameSerial:genGameSerial(),cardSerial:_spinCardSerial,bet:S.cpl,win:0,patterns:[],balBefore:_spinBalBefore,balAfter:S.bal});
        _spinDebounce=Date.now();_clearSpinWatchdog();S.spinning=false;setCtrl(true);updUI();return;
      }

      if(BG._coverAll1to40){BG._coverAll1to40=false;_handleCoverAll();}

      var _denom=(typeof PROG_DENOM!=='undefined'?PROG_DENOM:1);
      /* v5.115: winPatterns is pre-sorted ascending by pay (reel-bearing first,
         progressive last). basePat = winPatterns[0] = lowest-paying reel-bearing
         pattern. Cover All 40 (reel:null) is excluded from winPatterns here —
         it is handled as an event by _handleCoverAll(), not as a reel slot.
         rsPatterns = Red Spin sequence: all reel-bearing patterns except basePat,
         ascending pay order (already sorted). Cover All 40 never enters rsPatterns.
         PERMANENT DESIGN — never change sort direction without owner confirmation. */
      var basePat=winPatterns[0];
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
        /* v5.115: winPatterns contains only reel-bearing patterns at this point.
           Cover All 40 handled as event (not in winPatterns here). Sum all non-progressive reel patterns. */
        var _allPatsBonus=0;
        for(var _api=0;_api<winPatterns.length;_api++){
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
          Progressive.armAndClaim(winPatterns, function(didWin, _progAmt) {
            _finishProgressiveSpin(_progAmt+_allPatsBonus, winPatterns,
                                    basePat, _spinCardSerial, _spinBalBefore);
          });
        }
        return;
      }

      // ── Normal (non-progressive) win ──────────────────────────────────────
      /* v5.115: winPatterns contains only reel-bearing patterns (Cover All 40
         excluded as an event, not a pay slot). Sum all non-basePat reel patterns. */
      var baseAmt=basePat.pay[S.cpl-1]*_denom;
      for(var _cwi=0;_cwi<winPatterns.length;_cwi++){
        var _cwp=winPatterns[_cwi];
        if(_cwp!==basePat&&!_cwp.isProgressive&&_cwp.reel){
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
            _spinDebounce=Date.now();updUI();_clearSpinWatchdog();S.spinning=false;setCtrl(true);
          });
        },600);return;
      }
      startPatternCycle(winPatterns);
      opLog({type:'SPIN',gameSerial:genGameSerial(),cardSerial:_spinCardSerial,bet:S.cpl,win:baseAmt,patterns:winPatterns.map(function(p){return p.name;}),balBefore:_spinBalBefore,balAfter:S.bal});
      _spinDebounce=Date.now();_clearSpinWatchdog();S.spinning=false;setCtrl(true);updUI();
    });
  } // end _continueSpinAfterClaim

  /* v5.115: Force Jackpot path removed — operator UI no longer has a Force
     Jackpot button. Natural progressive wins go through armAndClaim() only.
     _forceJP / Progressive.contribute() / generateCoverAllSpin() removed. */
  _continueSpinAfterClaim();
}

/* â”€â”€ HELP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function renderHelp(){
  var b=document.getElementById('help-body');b.innerHTML='';
  var _hd=(typeof PROG_DENOM!=='undefined'?PROG_DENOM:1);
  var s0=document.createElement('div');s0.className='hsec';
  s0.innerHTML='<div class="hstl">HOW TO PLAY</div>'+
    '<div class="hln">- <span>Class II Bingo machine</span> — bingo determines all outcomes</div>'+
    '<div class="hln">- New bingo card every spin. First 40 balls determine win.</div>'+
    '<div class="hln">- Multiple patterns won = <span>Red Spin Bonus</span></div>'+
    '<div class="hln">- First pattern completed lands on main reels</div>'+
    '<div class="hln">- Cover All 40 balls = \$0.01 + Game End broadcast to all players</div>';
  b.appendChild(s0);
  if(typeof PAYS_SCREEN!=='undefined'){
    for(var _si=0;_si<PAYS_SCREEN.length;_si++){
      var _sec=PAYS_SCREEN[_si];
      var _sd=document.createElement('div');_sd.className='hsec';
      var _html='<div class="hstl">'+_sec.section+'</div>';
      for(var _ei=0;_ei<_sec.entries.length;_ei++){
        var _e=_sec.entries[_ei];
        _html+='<div class="hln"><span>'+_e.name+'</span>';
        if(_e.desc) _html+=' — '+_e.desc;
        _html+=' <span style="color:var(--gold2)">'+_e.pay+'</span></div>';
      }
      _sd.innerHTML=_html;b.appendChild(_sd);
    }
  }
}

/* â”€â”€ INIT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

/* ── PROGRESSIVE JACKPOT CELEBRATION ─────────────────────────────────────
   v5.115: Natural progressive (Lazy-T) wins only — force jackpot path removed.
   Shows the video celebration overlay.
   ────────────────────────────────────────────────────────────────────────── */
/* _finishProgressiveSpin — runs the progressive jackpot award sequence:
     1. All other winning patterns paid via _allPatsBonus (silently)
     2. Progressive Jackpot — grand finale celebration (showProgJP)
     3. After celebration dismissed: sequence ends
   Called for natural Cover-All Lazy-T wins only. */
function _finishProgressiveSpin(progAmt, winPatterns, basePat, cardSerial, balBefore) {
  var _denom=(typeof PROG_DENOM!=='undefined'?PROG_DENOM:1);
  var pennyAmt=0;

  /* Progressive win goes STRAIGHT to jackpot celebration.
     Sub-patterns (Pyramid etc.) are paid silently via _allPatsBonus.
     No intermediate Red Spin reel stops — only the JP finale fires. */
  var _progPat=null;
  for(var _rsi=0;_rsi<winPatterns.length;_rsi++){
    if(winPatterns[_rsi].isProgressive){_progPat=winPatterns[_rsi];break;}
  }
  var rsSeq=_progPat?[_progPat]:[basePat];

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
      bet:S.cpl * (typeof PROG_DENOM !== 'undefined' ? PROG_DENOM : 1),
      win:S.lastWin, balls:25,
      isProgressive:true, progAmount:S.lastWin,
      patterns:winPatterns.map(function(p){return p.name;}),
      balBefore:balBefore, balAfter:S.bal});

    /* Cover All already ended the sequence and requested a fresh WABC
       sequence for all players at spin-result time (_handleCoverAll(),
       before Red Spin even started). Do NOT request a second sequence
       here — just stop the entertainment caller now that the
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
    BG.seqExhausted = false;
    BG.awaitingNewSeq = false;
    BG._coverAll75Fired = false;
    BG.ballPos = 40; /* server starts entertainment phase at 40 */
    updateBallCallBadge();
    /* Only re-render card and strip during active play.
       During idle (pre-spin), strip stays empty — player hasn't spun yet. */
    if(GS.state==='active' && BG.card && Object.keys(BG.cardNumSet).length > 0) {
      BG.matchedCells = {12: true};
      for (var _rb = 0; _rb < 40; _rb++) {
        var _rball = BG.callSeq[_rb];
        if (BG.cardNumSet[_rball] !== undefined)
          BG.matchedCells[BG.cardNumSet[_rball]] = true;
      }
      /* Do not re-render card during spin/Red Spin — pattern highlights
         set by runRS must remain locked until player presses Spin again. */
      if(!S.spinning) renderBingoCard(BG.card, BG.matchedCells, null);
      renderBallStrip(BG.callSeq, 40, BG.cardNumSet);
    } else if(GS.state!=='active') {
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
            /* Don't overwrite showcase pattern during idle */
            if(GS.state==='active'){
              renderBingoCard(BG.card,BG.matchedCells,null);
            }
          }
          if(!_ballNodes||_ballNodes.length<75) buildBallStrip();
          /* Only render pre-called balls if player has already spun.
             During idle (pre-spin), strip stays empty. */
          if(GS.state==='active'){
            renderBallStrip(BG.callSeq,40,BG.cardNumSet);
          } else {
            clearBallStrip();
          }
          _setSplashBallStatus('✔ Wide area ball call ready');
        } else {
          /* WABC returned empty — cannot play without ball sequence */
          BG.usingServerBalls = false;
          BG.seqExhausted = false;
          _setSplashBallStatus('⚠ Ball call unavailable — reconnecting');
          toast('Ball call unavailable \u2014 please wait for connection');
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
          BG.awaitingNewSeq = false;
          BG._coverAll75Fired = false;
          if(BG.card && Object.keys(BG.cardNumSet).length > 0) {
            BG.matchedCells = {12:true};
            for(var _nc=0;_nc<40;_nc++){
              var _ncball=BG.callSeq[_nc];
              if(BG.cardNumSet[_ncball]!==undefined)
                BG.matchedCells[BG.cardNumSet[_ncball]]=true;
            }
            /* Do not re-render card during spin/Red Spin — pattern highlights locked. */
            if(GS.state==='active'&&!S.spinning){
              renderBingoCard(BG.card,BG.matchedCells,null);
            }
            renderBallStrip(BG.callSeq,40,BG.cardNumSet);
          }
          updateBallCallBadge();
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
            /* Do not re-render card during spin/Red Spin — pattern highlights locked. */
            if(GS.state==='active'&&!S.spinning){
              renderBingoCard(BG.card,BG.matchedCells,null);
            }
            renderBallStrip(BG.callSeq,40,BG.cardNumSet);
          }
          updateBallCallBadge();
          toast('✔ Wide area ball call restored');
        });

        /* WABC.onChange — server drives ball position via wabc-ball-ticker
           Edge Function. Every 'pos' broadcast event updates BG.ballPos
           and daubes/renders the card and strip for all players in sync. */
        WABC.onChange(function(newPos) {
          _onServerBallPos(newPos);
        });

        /* setPosProvider and onSyncResponse removed — the wabc-ball-ticker
           Edge Function is the sole position authority. All players receive
           ball positions from the server via WABC.onChange above. */
      });
    } else {
      /* WABC not loaded — cannot play without ball sequence */
      BG.usingServerBalls = false;
      _setSplashBallStatus('\u26a0 Ball call unavailable \u2014 reconnecting');
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
BG.callSeq=[]; /* populated by WABC on connect */
BG.ballPos=40; /* server drives balls 41-75; 1-40 handled by doBingoSpin */
// State 1: idle — show pattern showcase
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
setTimeout(sizeLayout,100);
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
