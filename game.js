const $=id=>document.getElementById(id), cv=$('game'),ctx=cv.getContext('2d'),video=$('video');
let w=0,h=0,dpr=1,mode='idle',running=false,stream=null,tracker=null,epoch=0,lastVideo=-1,seen=0,deadline=0,score=0,best=0,head=null,target=null,trail=[],fruit=null,sparks=[],labels=[],sound=true,audio=null,last=performance.now(),lastStatus='';
try{best=Number(localStorage.getItem('strawberry-chase-best'))||0}catch{} $('best').textContent=String(best).padStart(2,'0');
const stage = $('stage');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const readyTitle = $('heading').textContent;
const readyDescription = $('description').textContent;
const privacyNote = $('note').textContent;
let redrawPreview = true;

function resize() {
  w = stage.clientWidth;
  h = stage.clientHeight;
  dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  redrawPreview = true;
  if (running) spawn();
}
new ResizeObserver(resize).observe(stage);
resize();

function status(s){if(s!==lastStatus){$('status').textContent=s;lastStatus=s}}

function spawn() {
  const radius = Math.max(19, Math.min(33, w * .055));
  const margin = radius * 1.7;
  let x, y;
  for (let attempt = 0; attempt < 40; attempt++) {
    x = margin + Math.random() * Math.max(1, w - 2 * margin);
    y = margin + Math.random() * Math.max(1, h - 2 * margin);
    if (!head || Math.hypot(x - head.x, y - head.y) > Math.min(180, w * .3, h * .3)) break;
  }
  fruit = { x, y, born: performance.now(), r: radius };
}
function unlockAudio(){try{audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{})}catch{}}
function ping(){if(!sound||!audio)return;try{const t=audio.currentTime;for(let i=0;i<2;i++){let o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.value=i?1047:784;g.gain.setValueAtTime(.0001,t+i*.065);g.gain.exponentialRampToValueAtTime(.12,t+i*.065+.012);g.gain.exponentialRampToValueAtTime(.0001,t+i*.065+.17);o.connect(g).connect(audio.destination);o.start(t+i*.065);o.stop(t+i*.065+.18)}}catch{}}
function release(){redrawPreview=true;delete document.body.dataset.playing;cv.tabIndex=-1;epoch++;running=false;stream?.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;try{tracker?.close()}catch{}tracker=null;mode='idle';$('stop').hidden=true;$('camera').disabled=false;$('mouse').disabled=false;target=head=null;trail=[];fruit=null;sparks=[];labels=[]}
function start(controlMode) {
  mode = controlMode;
  running = true;
  score = 0;
  head = target = null;
  trail = [];
  sparks = [];
  labels = [];
  seen = 0;
  deadline = performance.now() + 60000;
  $('score').textContent = '00';
  $('time').textContent = '01:00';
  $('progress').style.width = '100%';
  $('heading').textContent = 'Catch the strawberries';
  $('description').textContent = controlMode === 'camera'
    ? 'Point your index finger toward a strawberry.'
    : 'Move your pointer, drag on the playfield, or steer with the arrow keys.';
  $('overlay').hidden = true;
  $('stop').hidden = false;
  document.body.dataset.playing = controlMode;
  cv.tabIndex = controlMode === 'pointer' ? 0 : -1;
  spawn();
  status(controlMode === 'camera' ? 'Show your index finger' : 'Move or use the arrow keys to steer');
  (controlMode === 'pointer' ? cv : $('stop')).focus();
}
async function cameraStart(){release();unlockAudio();const token=epoch;$('camera').disabled=true;$('note').textContent='Loading camera and hand tracking…';try{if(!navigator.mediaDevices?.getUserMedia)throw Error('Camera requires localhost or HTTPS.');let s=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:480}},audio:false});if(token!==epoch){s.getTracks().forEach(t=>t.stop());return}stream=s;video.srcObject=s;await video.play();if(token!==epoch)return;const {FilesetResolver,HandLandmarker}=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/+esm');const files=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm');const tr=await HandLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'},runningMode:'VIDEO',numHands:1,minHandDetectionConfidence:.55,minTrackingConfidence:.55});if(token!==epoch){tr.close();return}tracker=tr;lastVideo=-1;start('camera')}catch(e){if(token!==epoch)return;release();$('note').textContent='Camera unavailable: '+(e.message||e)+'. Try pointer mode.';status('Camera unavailable')}}
$('camera').onclick=cameraStart;$('mouse').onclick=()=>{release();unlockAudio();start('pointer')};$('stop').onclick = () => {
  release();
  $('heading').textContent = readyTitle;
  $('description').textContent = readyDescription;
  $('note').textContent = privacyNote;
  $('overlay').hidden = false;
  $('camera').focus();
  status('Choose a control mode to start');
};$('sound').onclick=()=>{sound=!sound;$('sound').textContent=sound?'Sound on':'Sound off';$('sound').setAttribute('aria-pressed',String(sound));if(sound)unlockAudio()};$('full').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{status('Fullscreen unavailable')}};addEventListener('pagehide',release);
function setTarget(x, y) {
  target = { x: Math.max(0, Math.min(w, x)), y: Math.max(0, Math.min(h, y)) };
  seen = performance.now();
}

function pointer(event) {
  if (!running || mode !== 'pointer') return;
  const bounds = cv.getBoundingClientRect();
  setTarget(event.clientX - bounds.left, event.clientY - bounds.top);
}
cv.addEventListener('pointerdown', pointer);
cv.addEventListener('pointermove', pointer);
cv.addEventListener('pointerleave', () => { if (mode === 'pointer') seen = 0; });

const directions = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
cv.addEventListener('keydown', (event) => {
  if (!running || mode !== 'pointer' || !Object.hasOwn(directions, event.key)) return;
  event.preventDefault();
  const [dx, dy] = directions[event.key];
  const position = target ?? { x: w / 2, y: h / 2 };
  setTarget(position.x + dx * 22, position.y + dy * 22);
});
function track(now){if(mode!=='camera'||!tracker||video.readyState<2||video.currentTime===lastVideo)return;lastVideo=video.currentTime;try{const p=tracker.detectForVideo(video,now).landmarks[0]?.[8];if(!p)return;const vw=video.videoWidth,vh=video.videoHeight;if(!vw||!vh)return;const scale=Math.max(w/vw,h/vh),dx=(vw*scale-w)/2,dy=(vh*scale-h)/2;target={x:Math.max(0,Math.min(w,w-(p.x*vw*scale-dx))),y:Math.max(0,Math.min(h,p.y*vh*scale-dy))};seen=now}catch(e){status('Hand tracking interrupted')}}
function finish(){running=false;best=Math.max(best,score);try{localStorage.setItem('strawberry-chase-best',String(best))}catch{}$('best').textContent=String(best).padStart(2,'0');release();$('heading').textContent=`${score} ${score===1?'strawberry':'strawberries'}!`;$('description').textContent=`Time is up. Your personal best is ${best}. Ready for another round?`;$('note').textContent='Choose a control mode to play again.';$('overlay').hidden=false;status('Challenge complete');$('heading').focus()}
function catchFruit(now){score++;$('score').textContent=String(score).padStart(2,'0');ping();for(let i=0;i<(reducedMotion.matches?0:38);i++){let a=Math.random()*Math.PI*2,v=40+Math.random()*200;sparks.push({x:fruit.x,y:fruit.y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.65+Math.random()*.45,max:1.1,c:i%3===0?'#ff5978':i%3===1?'#ffdf85':'#70ffd2'})}if(!reducedMotion.matches)labels.push({x:fruit.x,y:fruit.y,life:.8});spawn()}
function strawberry(now, berry = fruit){if(!berry)return;const {x,y,r,born}=berry;let s=reducedMotion.matches?1:Math.min(1,(now-born)/240);ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.shadowColor='#ff416d';ctx.shadowBlur=22;ctx.strokeStyle='#ff769b66';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,0,r*1.65,r*1.65,.0,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=12;let g=ctx.createRadialGradient(-r*.32,-r*.45,1,0,0,r*1.4);g.addColorStop(0,'#ffb0a2');g.addColorStop(.35,'#ff5167');g.addColorStop(1,'#9c123c');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(0,-r*.58);ctx.bezierCurveTo(-r*1.5,-r*1.15,-r*1.25,r*.36,0,r*1.13);ctx.bezierCurveTo(r*1.25,r*.36,r*1.5,-r*1.15,0,-r*.58);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#ffe6a0';for(let j=0;j<4;j++)for(let i=0;i<5;i++){let xx=(i-2+(j%2)*.25)*r*.32,yy=(j-1)*r*.33;if(Math.abs(xx)>r*(.82-j*.13))continue;ctx.beginPath();ctx.ellipse(xx,yy,r*.047,r*.085,.3,0,Math.PI*2);ctx.fill()}ctx.fillStyle='#49e08b';for(let i=0;i<5;i++){ctx.save();ctx.translate(0,-r*.67);ctx.rotate((i-2)*.58);ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(-r*.22,-r*.3,0,-r*.7);ctx.quadraticCurveTo(r*.22,-r*.3,0,0);ctx.fill();ctx.restore()}ctx.restore()}
function snake(){if(!head)return;let n=trail.length;ctx.save();for(let i=n-1;i>=0;i--){let p=trail[i],q=1-i/Math.max(1,n),r=3+q*13;let g=ctx.createRadialGradient(p.x-r*.25,p.y-r*.25,0,p.x,p.y,r);g.addColorStop(0,'#e8fff5');g.addColorStop(.35,`hsl(${155+i*1.4%65} 95% 60%)`);g.addColorStop(1,'#07534b');ctx.fillStyle=g;ctx.shadowColor='#50ffb4';ctx.shadowBlur=8;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill()}ctx.shadowBlur=22;ctx.shadowColor='#6affc9';ctx.fillStyle='#baffdc';ctx.beginPath();ctx.arc(head.x,head.y,18,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#17332d';let angle=trail.length>1?Math.atan2(head.y-trail[1].y,head.x-trail[1].x):0;for(let side of [-1,1]){ctx.beginPath();ctx.arc(head.x+Math.cos(angle+side*.65)*10,head.y+Math.sin(angle+side*.65)*10,3,0,Math.PI*2);ctx.fill()}ctx.restore()}
function drawPreview(now) {
  ctx.clearRect(0, 0, w, h);
  const unit = Math.min(w, h);
  const r = Math.min(26, unit * .065);
  const x = w * .52, y = h * .41;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = r * 1.5;
  ctx.strokeStyle = '#72cf9f';
  ctx.shadowColor = '#57e6a675';
  ctx.shadowBlur = r;
  ctx.beginPath();
  ctx.moveTo(x - unit * .31, y + unit * .29);
  ctx.bezierCurveTo(x - unit * .3, y + unit * .01, x + unit * .11, y + unit * .38, x + unit * .08, y + unit * .16);
  ctx.stroke();
  ctx.fillStyle = '#a9efc6';
  ctx.beginPath();
  ctx.arc(x + unit * .08, y + unit * .16, r * .85, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#152b23';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x + unit * .08 + side * r * .34, y + unit * .16 - r * .33, r * .13, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  strawberry(now, { x: x + unit * .11, y: y - unit * .13, r: r * 1.45, born: now - 240 });
}

function frame(now){requestAnimationFrame(frame);const dt=Math.min(.05,(now-last)/1000);last=now;if(!running){if(redrawPreview){drawPreview(now);redrawPreview=false}return}ctx.clearRect(0,0,w,h);const remaining=Math.max(0,deadline-now),sec=Math.ceil(remaining/1000);$('time').textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;$('progress').style.width=`${remaining/600}%`;if(!remaining){finish();return}track(now);const visible=target&&now-seen<(mode==='pointer'?100000:250);if(visible){status(mode==='camera'?'Index finger tracked · Catch the strawberries':'Catch the strawberries');if(!head){head={...target};trail=[{...head}]}else{let a=1-Math.exp(-dt*22);head.x+=(target.x-head.x)*a;head.y+=(target.y-head.y)*a}if(!trail.length||Math.hypot(head.x-trail[0].x,head.y-trail[0].y)>7){trail.unshift({...head});trail.length=Math.min(trail.length,12+score*3,150)}if(fruit&&now-fruit.born>160&&Math.hypot(head.x-fruit.x,head.y-fruit.y)<fruit.r+17)catchFruit(now)}else status(mode==='camera'?'Show your index finger · Timer is running':'Move or use the arrow keys to steer');strawberry(now);if(visible)snake();for(let p of sparks){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=110*dt;ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.c;ctx.beginPath();ctx.arc(p.x,p.y,3,0,Math.PI*2);ctx.fill()}sparks=sparks.filter(p=>p.life>0);for(let p of labels){p.life-=dt;p.y-=45*dt;ctx.globalAlpha=Math.max(0,p.life/.8);ctx.font='bold 25px system-ui';ctx.textAlign='center';ctx.fillStyle='#fff';ctx.fillText('+1',p.x,p.y)}labels=labels.filter(p=>p.life>0);ctx.globalAlpha=1}requestAnimationFrame(frame);
