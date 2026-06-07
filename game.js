
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
  setTimeout(dismiss,3200);
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
  'spchch':[0,5,5],'none':[4,2,3]
};

/* â”€â”€ BINGO CARD STATE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
var BG={
  card:[],cardSerial:'',callSeq:[],cardNumSet:{},matchedCells:{},
  winPatterns:[],ballPos:0,entTimer:null,patternCycle:null,cycleIdx:0,
  _coverAll1to40:false
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
function opLog(rec){if(typeof opLogImpl==='function') opLogImpl(rec);}
function genGameSerial(){
  var t=Date.now().toString(16);
  var r=Math.floor(Math.random()*0xffff).toString(16).toUpperCase();
  return 'GAME-'+t.toUpperCase()+r;
}

function genBallCall(){
  var balls=[];
  for(var i=1;i<=75;i++) balls.push(i);
  return rng.shuffle(balls);
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
  if(!_ballNodes||_ballNodes.length<75) buildBallStrip();
  for(var i=0;i<75;i++){
    var node=_ballNodes[i];
    if(i<calledCount){
      var ball=callSeq[i];var isPre=(i<40);var isMatch=(cardNumSet[ball]!==undefined);
      node.textContent=ball;
      if(isPre&&isMatch) node.className='ball match';
      else if(isPre&&!isMatch) node.className='ball pre';
      else node.className='ball called';
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
  _cardNodes=null; // force card rebuild with col-hdrs visible
  if(!_cardNodes||_cardNodes.length<25) buildBingoCardNodes();
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
  nameEl.textContent=pat.name.toUpperCase()+' — In '+pat.balls+' Balls | $'+pat.pay[0]+'/$'+pat.pay[1]+'/$'+pat.pay[2];
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
  stopSilentCaller();
  stopActiveCaller(); // silent and active are mutually exclusive
  _silentTimer=setInterval(function(){
    BG.ballPos=(BG.ballPos||0)+1;
    if(BG.ballPos>=75){BG.callSeq=genBallCall();BG.ballPos=0;}
  },1300);
}
function stopSilentCaller(){
  if(_silentTimer){clearInterval(_silentTimer);_silentTimer=null;}
}

/* -- ACTIVE CALLER (all active play) -- */
function startActiveCaller(){
  stopActiveCaller();
  stopSilentCaller(); // active takes over from silent
  BG.entTimer=setInterval(_activeCallNext,1500);
}
function stopActiveCaller(){
  if(BG.entTimer){clearInterval(BG.entTimer);BG.entTimer=null;}
}
function _activeCallNext(){
  BG.ballPos=(BG.ballPos||0)+1;
  if(BG.ballPos>=75){
    // All 75 called — seamlessly continue with new sequence, no pause, no silent
    BG.callSeq=genBallCall();
    BG.ballPos=1; // start immediately on ball 1 of new sequence
  }
  var newBall=BG.callSeq[BG.ballPos-1];
  // Daub card if ball matches
  if(BG.card&&BG.cardNumSet&&BG.cardNumSet[newBall]!==undefined){
    BG.matchedCells[BG.cardNumSet[newBall]]=true;
    renderBingoCard(BG.card,BG.matchedCells,null);
  }
  if(BG.card) renderBallStrip(BG.callSeq,BG.ballPos,BG.cardNumSet);
  // Cover All check (balls 41-75 entertainment phase)
  if(BG.card&&Object.keys(BG.matchedCells).length===25){
    _handleCoverAll(false); // no penny — entertainment phase
  }
}

/* -- COVER ALL HANDLER -- */
function _handleCoverAll(hasPenny){
  var nameEl=document.getElementById('bingo-pattern-name');
  nameEl.textContent=hasPenny?'GAME END — COVER ALL $0.01':'GAME END — COVER ALL';
  nameEl.style.color='#ffcc00';
  if(hasPenny){S.bal+=0.01;updUI();}
  // Reset ball sequence
  BG.callSeq=genBallCall();
  BG.ballPos=0;
  setTimeout(function(){
    nameEl.textContent=' ';nameEl.style.color='';
    if(BG.card) renderBallStrip(BG.callSeq,0,BG.cardNumSet);
  },2500);
  // Switch to silent only if player is idle (not spinning)
  if(!S.spinning){
    stopActiveCaller();
    startSilentCaller();
  }
  // If spinning: active caller keeps running with new sequence — no interruption
}

/* Legacy aliases so existing call sites don't break */
function startEntertainmentBalls(){startActiveCaller();}
function stopEntertainmentBalls(){stopActiveCaller();}


function doBingoSpin(){
  stopPatternCycle();

  // Preserve how many balls have been revealed so far.
  // Only regenerate sequence if we haven't started or all 75 were exhausted.
  var prevBallPos=BG.ballPos||0;
  if(!BG.callSeq||BG.callSeq.length!==75||prevBallPos===0){
    BG.callSeq=genBallCall();
    prevBallPos=0;
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
  // Any cherry on any reel = always looks like Open Diamond pay
  if(L[0]===5||L[1]===5||L[2]===5) return{amt:1};
  // Gap on any reel with no cherry = safe non-win
  if(L[0]===6||L[1]===6||L[2]===6) return{amt:0};
  // Any wild
  if(L[0]===0||L[1]===0||L[2]===0) return{amt:1};
  // 3 of a kind
  if(L[0]===L[1]&&L[1]===L[2]) return{amt:1};
  // All 3 are bars in any mix
  if(BARS.indexOf(L[0])>=0&&BARS.indexOf(L[1])>=0&&BARS.indexOf(L[2])>=0) return{amt:1};
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
function mkSym(id){
  var w=document.createElement('div');
  w.style.cssText='width:100%;height:100%;display:-webkit-flex;display:flex;-webkit-align-items:center;align-items:center;-webkit-justify-content:center;justify-content:center;';
  if(id===6){return w;} // blank = pure dark tape, no content
  if(id===0){var img=IMG_SCOTT.cloneNode();img.style.cssText='width:95%;height:95%;object-fit:contain;display:block;';w.appendChild(img);}
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
var _spinDebounce=0; // timestamp of last spin completion — prevents rapid re-entry
var SLOT_H=120;
var _reelWinH=0; // cached reel-window clientHeight — set in initReelSlots
var CURRENT_SYMS=[5,4,1];
var CURRENT_GHOSTS=[{above:6,sym:5,below:4},{above:6,sym:4,below:3},{above:3,sym:1,below:6}];
var CPL=[1,2,3];

function fmt(n){return '$'+n.toFixed(2);}
function updUI(){
  document.getElementById('bval').textContent=fmt(S.bal);
  _savePlayerState();
  if(typeof checkDemoTrigger==='function') checkDemoTrigger();
  document.getElementById('betval').textContent=fmt(S.cpl);
  document.getElementById('cdisp').textContent=S.cpl;
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
  if(slotH<10) slotH=SLOT_H;

  // Build spin strip: random symbols (mix of all ids including blanks) + final 3
  // Use 18 scroll symbols so phase 1 has plenty of tape flying through
  var SPIN_SYM_IDS=[0,1,2,3,4,5,6];
  var spinSyms=[];
  for(var i=0;i<18;i++) spinSyms.push(SPIN_SYM_IDS[rng.int(0,6)]);
  spinSyms.push(finalGhost.above2);
  spinSyms.push(finalGhost.above);
  spinSyms.push(finalGhost.sym);
  spinSyms.push(finalGhost.below);
  spinSyms.push(finalGhost.below2);

  strip.innerHTML='';
  strip.style.height='auto';
  for(var j=0;j<spinSyms.length;j++){
    var slot=buildSlot(spinSyms[j]);
    slot.style.height=slotH+'px';
    slot.style.flex='none';
    strip.appendChild(slot);
  }

  // targetY: center the payline slot (centerIdx) in the window.
  // Payline slot top must be at (winH-slotH)/2 = -spinTopOff from window top.
  // strip.top + centerIdx*slotH = -spinTopOff  =>  strip.top = -spinTopOff - centerIdx*slotH
  var centerIdx=spinSyms.length-3; // payline is 3rd from end in 5-slot sequence
  var targetY=spinTopOff-centerIdx*slotH; // strip.top that centers payline slot

  // Overshoot: strip travels 0.6 slots past target then snaps back
  var overshootExtra=Math.round(slotH*0.6);
  var overshootY=targetY-overshootExtra;

  // Phase timing
  var t1=Math.round(stopDelay*0.75); // phase 1 end: constant velocity
  var t2=Math.round(stopDelay*0.90); // phase 2 end: overshoot reached
  // phase 3: snap (single frame, fires at t2)

  strip.style.top='0px';
  strip.style.willChange='top';
  reel.classList.add('spinning');

  var startTime=null;
  var snapped=false;

  function frame(ts){
    if(!startTime) startTime=ts;
    var elapsed=ts-startTime;

    if(elapsed<t1){
      // Phase 1: constant velocity — full speed from frame 1, scrolls to overshootY
      var p1=elapsed/t1;
      strip.style.top=(p1*overshootY).toFixed(1)+'px';
      requestAnimationFrame(frame);

    } else if(elapsed<t2){
      // Phase 2: hold at overshoot position (brief pause before snap)
      strip.style.top=overshootY.toFixed(1)+'px';
      requestAnimationFrame(frame);

    } else {
      // Phase 3: snap to exact target — instant mechanical thud
      if(!snapped){
        snapped=true;
        strip.style.top=targetY.toFixed(1)+'px';
        reel.classList.remove('spinning');
        reel.classList.add('stopping');
        sndReelStop();
        setTimeout(function(){
          reel.classList.remove('stopping');
          // Restore 3-slot rest layout with explicit px heights — avoids flex/% height collapse
          // that occurs when transitioning from willChange compositing layer back to normal flow
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
  var STOP_DELAYS=[380,620,900];sndSpinStart();
  for(var ri=0;ri<3;ri++) document.getElementById('r'+ri).classList.add('spinning');
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
function runRS(rsPatterns,cpl,onDone){
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
    badge.textContent='RED SPIN '+seqIdx;
    var reelSyms=REEL_SYMS[pat.reel]||REEL_SYMS['none'];
    var sr=forcedSpinResult(reelSyms);
    sndBonusSpin();
    var RS_STOP=[320,520,720];var rsDone=0;
    for(var ri3=0;ri3<3;ri3++){
      (function(rIdx){spinReel(rIdx,sr.ghosts[rIdx],RS_STOP[rIdx],function(){rsDone++;});})(ri3);
    }
    setTimeout(function(){
      var payAmt=pat.pay[cpl-1];
      if(pat.reel==='jp'){
        frame2.classList.remove('bonus-active');
        redOv.classList.remove('on');badge.classList.remove('on');
        sndRedSpinEnd();
        setTimeout(function(){showJP(payAmt,function(){
          bonusTotal+=payAmt;S.bal+=payAmt;updUI();onDone(bonusTotal);
        });},500);return;
      }
      bonusTotal+=payAmt;S.bal+=payAmt;
      document.getElementById('bval').textContent=fmt(S.bal);
      btVal.textContent=fmt(bonusTotal);
      setWin(payAmt,'RED SPIN \u2014 '+pat.name.toUpperCase()+'!');
      flashCenter();
      if(payAmt>=50) sndBigWin(); else sndSmallWin();
      // Do not startPatternCycle here — RS manages its own display
      setTimeout(playNext, 1000+rng.int(0,999)); // random 1-2s pause via CSPRNG
    },500);
  }
  setTimeout(playNext,200);
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
  }
  var _spinBalBefore=S.bal+S.cpl; var _spinCardSerial=BG.cardSerial;
  setWin(0,'');document.getElementById('bt-box').classList.remove('on');
  updUI();setCtrl(false);
  stopPatternCycle();
  // Transition to active state on first spin
  if(GS.state==='idle'||GS.state==='demo') exitDemo();
  GS.hasSpun=true;GS.state='active';

  var winPatterns=doBingoSpin();

  // ── FORCE JACKPOT CHECK ─────────────────────────────────────────────
  // If operator armed a force jackpot, try to claim it atomically.
  // If claim succeeds: inject Progressive Jackpot pattern into winPatterns.
  // If claim fails (another device was faster): spin continues normally.
  if(_forceJP && typeof Progressive!=='undefined'){
    Progressive.claimForce(function(didWin, forceAmt){
      if(!didWin) return; // someone else got it — spin normally
      // Inject the progressive pattern (Hot Dog cells, ≤21 balls)
      var _forcePat={
        name:'Progressive Jackpot',balls:21,pay:[40,80,120],
        reel:'1bw4',cells:[6,7,8,10,11,12,13,14,16,17,18],
        isProgressive:true,_forceAmt:forceAmt
      };
      if(!winPatterns.length){
        winPatterns=[_forcePat];
      } else {
        winPatterns.unshift(_forcePat);
      }
    });
  }
  // ── END FORCE JACKPOT CHECK ───────────────────────────────────────────
  // Active caller: start on first spin, keep running on subsequent spins
  if(!BG.entTimer) startActiveCaller();
  var spinData;
  if(winPatterns.length===0){
    // No bingo â€” realistic non-winning combo
    var attempts=0;
    do{spinData=genSpinResult();attempts++;}
    while(evalSpin(buildGrid(spinData.syms,spinData.ghosts)).amt>0&&attempts<200);
  } else {
    // Sort ascending â€” LOWEST paying pattern is the base spin
    winPatterns.sort(function(a,b){return a.pay[0]-b.pay[0];});
    // If progressive jackpot fired, always show SP/SP/Single BAR on reels
    var _progInWins=false;
    for(var _rpi=0;_rpi<winPatterns.length;_rpi++){if(winPatterns[_rpi].isProgressive){_progInWins=true;break;}}
    if(_progInWins){
      spinData=forcedSpinResult(REEL_SYMS['1bw4']); // SP / SP / Single BAR
    } else {
      spinData=forcedSpinResult(REEL_SYMS[winPatterns[0].reel]||REEL_SYMS['none']);
    }
  }

  animateReels(spinData,function(){
    if(winPatterns.length===0){
      setWin(0,'NO BINGO');
      opLog({type:'SPIN',gameSerial:genGameSerial(),cardSerial:_spinCardSerial,bet:S.cpl,win:0,patterns:[],balBefore:_spinBalBefore,balAfter:S.bal});
      _spinDebounce=Date.now();S.spinning=false;setCtrl(true);updUI();return;
    }

    // Cover All in balls 1-40: penny award, reset sequence
    if(BG._coverAll1to40){
      BG._coverAll1to40=false;
      _handleCoverAll(true); // penny award — _handleCoverAll checks S.spinning for silent vs active
    }

    // winPatterns already sorted ascending â€” index 0 = lowest (base), rest = RS ascending
    var basePat=winPatterns[0];
    var rsPatterns=winPatterns.slice(1); // ascending order, no reverse needed

    var baseAmt=basePat.pay[S.cpl-1];
    S.bal+=baseAmt;S.lastWin=baseAmt;flashCenter();
    setWin(baseAmt,basePat.name.toUpperCase());
    updUI();
    if(baseAmt>=50) sndBigWin(); else sndSmallWin();

    // ── PROGRESSIVE JACKPOT CHECK (Class II — bingo determined) ──────────
    var _progPat=null;
    for(var _pi=0;_pi<winPatterns.length;_pi++){
      if(winPatterns[_pi].isProgressive){_progPat=winPatterns[_pi];break;}
    }
    if(_progPat&&typeof Progressive!=='undefined'){
      var _progAmt=Progressive.hit({pattern:'Progressive Jackpot',balls:21,bet:S.cpl});
      S.bal+=_progAmt;S.lastWin+=_progAmt;updUI();
      showProgJP(_progAmt,basePat,rsPatterns,winPatterns,S.cpl,baseAmt,_spinCardSerial,_spinBalBefore);
      return;
    }
    // ── END PROGRESSIVE CHECK ─────────────────────────────────────────────

    // Pattern cycle starts AFTER reels are visible — no RS path

    if(rsPatterns.length>0){
      // Reels visible, RS about to fire — show base pattern briefly then RS takes over
      startPatternCycle([basePat]); // show base pattern only until RS starts
      setTimeout(function(){
        stopPatternCycle(); // RS screen activates — clear pattern display
        runRS(rsPatterns,S.cpl,function(bonusTotal){
          setWin(baseAmt+bonusTotal,'BINGO WIN + RED SPIN!');
          document.getElementById('bt-box').classList.remove('on');
          // Now show ALL patterns after RS completes and final reel state visible
          startPatternCycle(winPatterns);
          // Active caller already running — no restart needed
          opLog({type:'SPIN',gameSerial:genGameSerial(),cardSerial:_spinCardSerial,bet:S.cpl,win:baseAmt+bonusTotal,patterns:winPatterns.map(function(p){return p.name;}),balBefore:_spinBalBefore,balAfter:S.bal});
          _spinDebounce=Date.now();updUI();S.spinning=false;setCtrl(true);
        });
      },600);return;
    }
    // No RS — reels are landed, now reveal all patterns
    startPatternCycle(winPatterns);
    opLog({type:'SPIN',gameSerial:genGameSerial(),cardSerial:_spinCardSerial,bet:S.cpl,win:baseAmt,patterns:winPatterns.map(function(p){return p.name;}),balBefore:_spinBalBefore,balAfter:S.bal});
    _spinDebounce=Date.now();S.spinning=false;setCtrl(true);updUI();
  });
}

/* â”€â”€ HELP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function renderHelp(){
  var b=document.getElementById('help-body');b.innerHTML='';
  var s1=document.createElement('div');s1.className='hsec';
  s1.innerHTML='<div class="hstl">HOW TO PLAY</div>'+
    '<div class="hln">- <span>Class II Bingo machine</span> â€” bingo determines all outcomes</div>'+
    '<div class="hln">- New bingo card generated every spin</div>'+
    '<div class="hln">- First 40 balls determine win â€” rest are entertainment</div>'+
    '<div class="hln">- Multiple patterns trigger <span>Red Spin Bonus</span></div>'+
    '<div class="hln">- Any cherry on payline pays Open Diamond</div>';
  b.appendChild(s1);
  var s2=document.createElement('div');s2.className='hsec';
  s2.innerHTML='<div class="hstl">TOP PATTERNS (BET 1)</div>'+
    '<div class="hln"><span>Corporal Stripes</span> â€” $800 (JACKPOT)</div>'+
    '<div class="hln"><span>Cross Corners</span> â€” $320</div>'+
    '<div class="hln"><span>Pyramid / The Kite</span> â€” $160</div>'+
    '<div class="hln"><span>Four Leaf Clover</span> â€” $100</div>'+
    '<div class="hln"><span>Double Cross / Arrowhead</span> â€” $80</div>'+
    '<div class="hln"><span>Valentine</span> â€” $50</div>';
  b.appendChild(s2);
}

/* â”€â”€ INIT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

/* ── PROGRESSIVE JACKPOT OVERLAY ── */
/* ── PROGRESSIVE JACKPOT CELEBRATION (replaces old text overlay) ─────────
   Used for BOTH natural bingo wins AND force jackpot wins.
   Shows the video celebration overlay, NOT the old jp-ov text screen.
   ────────────────────────────────────────────────────────────────────── */
function showProgJP(progAmt, basePat, rsPatterns, winPatterns, cpl, baseAmt, cardSerial, balBefore) {
  var CEL_VIDS = [
    'assets/videos/josie_dance.mp4',
    'assets/videos/sasha_dance.mp4',
    'assets/videos/sasha_alt.mp4'
  ];
  var cel  = document.getElementById('force-win-cel');
  var vid  = document.getElementById('fw-video');
  var amtEl = document.getElementById('fw-amt');
  var subEl = document.getElementById('fw-sub');

  if (amtEl) amtEl.textContent = '$' + progAmt.toFixed(2);
  if (subEl) subEl.textContent = 'PROGRESSIVE JACKPOT!';
  if (vid) {
    vid.src = CEL_VIDS[Math.floor(Math.random() * CEL_VIDS.length)];
    vid.load(); vid.play();
  }
  if (cel) cel.classList.add('show');

  /* Wire dismiss to continue the spin */
  var dismissBtn = document.getElementById('fw-dismiss');
  function onDismiss() {
    if (cel) cel.classList.remove('show');
    if (dismissBtn) dismissBtn.removeEventListener('click', onDismiss);
    /* Continue spin resolution */
    if (rsPatterns && rsPatterns.length > 0) {
      startPatternCycle([basePat]);
      setTimeout(function () {
        stopPatternCycle();
        runRS(rsPatterns, cpl, function (bonusTotal) {
          setWin(baseAmt + bonusTotal + (S.lastWin - baseAmt), 'PROGRESSIVE JACKPOT!');
          document.getElementById('bt-box').classList.remove('on');
          startPatternCycle(winPatterns);
          opLog({type:'SPIN', gameSerial:genGameSerial(), cardSerial:cardSerial,
            bet:cpl * (typeof DENOM !== 'undefined' ? DENOM : 1),
            win:S.lastWin,
            patterns:winPatterns.map(function(p){return p.name;}),
            balBefore:balBefore, balAfter:S.bal});
          _spinDebounce = Date.now(); updUI(); S.spinning = false; setCtrl(true);
        });
      }, 600);
    } else {
      startPatternCycle(winPatterns);
      opLog({type:'SPIN', gameSerial:genGameSerial(), cardSerial:cardSerial,
        bet:cpl * (typeof DENOM !== 'undefined' ? DENOM : 1),
        win:S.lastWin,
        patterns:winPatterns.map(function(p){return p.name;}),
        balBefore:balBefore, balAfter:S.bal});
      _spinDebounce = Date.now(); S.spinning = false; setCtrl(true); updUI();
    }
  }
  if (dismissBtn) {
    dismissBtn.removeEventListener('click', onDismiss);
    dismissBtn.addEventListener('click', onDismiss);
  }
  /* Also allow tapping the overlay to dismiss */
  if (cel) {
    cel.onclick = function(e) {
      if (e.target === cel) onDismiss();
    };
  }
}

function updateProgMeter(value){
  var el=document.getElementById('prog-meter-val');
  if(el) el.textContent='$'+value.toFixed(2);
}

/* ── BROADCAST TOAST v1.3 ─────────────────────────────────────────────────────
   Shows operator broadcast messages as a persistent gold overlay.
   Auto-dismisses after 12 seconds. Tap to dismiss early.
   ─────────────────────────────────────────────────────────────────────────── */
function showBroadcastToast(body,title){
  var DURATION_MS=12000;
  var el=document.getElementById('broadcast-toast');
  if(!el){
    el=document.createElement('div');
    el.id='broadcast-toast';
    el.style.cssText=[
      'position:fixed','bottom:90px','left:50%','transform:translateX(-50%)',
      'background:rgba(10,10,30,0.96)','color:#ffd700',
      'border:2px solid #ffd700','border-radius:10px',
      'padding:14px 20px','max-width:88vw','width:340px',
      'font-size:14px','line-height:1.45','text-align:center',
      'z-index:9999','box-shadow:0 4px 24px rgba(0,0,0,0.85)',
      'cursor:pointer','display:none'
    ].join(';');
    document.body.appendChild(el);
  }
  var html='';
  if(title) html+='<div style="font-weight:bold;font-size:15px;margin-bottom:6px;">'+title+'</div>';
  html+='<div>'+body+'</div>';
  html+='<div style="margin-top:8px;font-size:11px;color:#aaa;">(tap to dismiss)</div>';
  el.innerHTML=html;
  el.style.display='block';
  el.onclick=function(){clearTimeout(el._timer);el.style.display='none';};
  clearTimeout(el._timer);
  el._timer=setTimeout(function(){el.style.display='none';},DURATION_MS);
}

function initProgressiveMeter(){
  if(typeof Progressive==='undefined') return;
  Progressive.onChange(updateProgMeter);
  /* v1.3 — wire broadcast messages so operator announcements reach players */
  Progressive.onMessage(function(msg){
    if(!msg||!msg.message) return;
    showBroadcastToast(msg.message, msg.title||'');
  });
  /* Wire ATTITUDE CHECK notification */
  Progressive.onForceNotify(function(amt,gameId){
    var label=gameId&&gameId!=='unknown'?gameId:'another game';
    toast('\u2605 JACKPOT HIT on '+label+'! $'+amt.toFixed(2));
  });
  Progressive.init(function(){
    updateProgMeter(Progressive.getValue());
    setTimeout(function(){ sizeLayout(); }, 50);
  });
}

/* -- INIT -- */
BG.callSeq=genBallCall();
BG.ballPos=0;
// State 1: idle — show pattern showcase, run silent caller
GS.state='idle';
buildBallStrip(); // pre-build ball nodes (empty)
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

