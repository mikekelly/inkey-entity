import {initVisuals,updateVisuals} from './visuals.js';



const $=id=>document.getElementById(id), clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const enter=$('enter');enter.disabled=true;
const media=document.getElementById('soundtrack');
let buffer,offset=0,playRequest=0,starting=false,playing=false,started=false,soft=matchMedia('(prefers-reduced-motion: reduce)').matches,muted=false,features=[],peaks=[],intensity=Number($('intensity').value)/100*1.6;

const fftSize=2048,hop=256;let bandFrames=[];
function fft(real,imag){let n=real.length;for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[real[i],real[j]]=[real[j],real[i]];}}for(let len=2;len<=n;len<<=1){const ang=-2*Math.PI/len,wr0=Math.cos(ang),wi0=Math.sin(ang);for(let i=0;i<n;i+=len){let wr=1,wi=0;for(let j=0;j<len/2;j++){const k=i+j,l=k+len/2,vr=real[l]*wr-imag[l]*wi,vi=real[l]*wi+imag[l]*wr;real[l]=real[k]-vr;imag[l]=imag[k]-vi;real[k]+=vr;imag[k]+=vi;const nr=wr*wr0-wi*wi0;wi=wr*wi0+wi*wr0;wr=nr;}}}}
async function analyse(buf){const sr=buf.sampleRate,channels=Array.from({length:buf.numberOfChannels},(_,i)=>buf.getChannelData(i)),count=Math.ceil(buf.length/hop),r=new Float32Array(fftSize),im=new Float32Array(fftSize),prev=new Float32Array(fftSize/2),max=[0,0,0,0,0];for(let f=0;f<count;f++){let rms=0;for(let i=0;i<fftSize;i++){const idx=f*hop+i;let v=0;for(const c of channels)v+=c[idx]||0;v/=channels.length;r[i]=v*(.5-.5*Math.cos(2*Math.PI*i/(fftSize-1)));im[i]=0;rms+=v*v;}fft(r,im);let bs=0,mi=0,hi=0,flux=0;const bands=new Float32Array(48);for(let k=1;k<fftSize/2;k++){const mag=Math.hypot(r[k],im[k]),hz=k*sr/fftSize;const bi=Math.max(0,Math.min(47,Math.floor(Math.log2(Math.max(hz,30)/30)/Math.log2(16000/30)*48)));bands[bi]+=mag*mag;if(hz<180)bs+=mag*mag;else if(hz<2400)mi+=mag*mag;else hi+=mag*mag;flux+=Math.max(0,mag-prev[k]);prev[k]=mag;}const v=[Math.sqrt(bs),Math.sqrt(mi),Math.sqrt(hi),flux,Math.sqrt(rms/fftSize)];features.push(v);bandFrames.push(bands);for(let k=0;k<5;k++)max[k]=Math.max(max[k],v[k]);if(f%500===0){$('loadStatus').textContent=`Reading the waveform · ${Math.round(f/count*100)}%`;await new Promise(requestAnimationFrame);}}// Robust scaling keeps quieter passages expressive.
const bandMax=Array.from({length:48},(_,k)=>Math.sqrt(bandFrames.map(f=>f[k]).sort((a,b)=>a-b)[Math.floor(count*.97)])||1);for(const f of bandFrames)for(let k=0;k<48;k++)f[k]=clamp(Math.sqrt(f[k])/bandMax[k],0,1.5);
const scales=Array.from({length:5},(_,k)=>features.map(f=>f[k]).sort((a,b)=>a-b)[Math.floor(count*.96)]||1);for(const f of features)for(let k=0;k<5;k++)f[k]=clamp(f[k]/scales[k],0,1.4);for(let i=2;i<count-2;i++){const v=features[i][3],local=(features[i-2][3]+features[i-1][3]+features[i+1][3]+features[i+2][3])/4;if(v>.40&&v>local*1.13&&v>=features[i-1][3]&&v>features[i+1][3]&&(!peaks.length||i*hop/sr-peaks.at(-1).t>.105))peaks.push({t:(i*hop+fftSize/2)/sr,v:clamp(v)});}window.analysisInfo={duration:buf.duration,sampleRate:sr,frames:count,attacks:peaks.length};}
function time(){return buffer?clamp(media.currentTime||0,0,buffer.duration):0;}
function updatePlaybackButton(){ $('play').textContent=playing?'Ⅱ':media.ended?'↺':'▶';$('play').setAttribute('aria-label',playing?'Pause':media.ended?'Replay':'Play'); }
function audioIssue(message){$('audioIssue').hidden=false;$('audioMessage').textContent=message;}
async function play(){
 if(!buffer||starting||playing)return;
 const request=++playRequest;starting=true;$('audioIssue').hidden=true;
 // Native media playback is requested synchronously within the user's tap.
 // Offline waveform analysis never routes or gates the audible soundtrack.
 try {if('audioSession' in navigator)navigator.audioSession.type='playback';}catch{}
 if(media.ended||media.currentTime>=buffer.duration-.02)media.currentTime=0;
 media.muted=muted;
 const timeout=setTimeout(()=>{if(request===playRequest&&starting)audioIssue('Sound has not started. Tap Enable sound to retry.');},7000);
 try {await media.play();if(request!==playRequest)return;playing=!media.paused;started=true;document.body.classList.add('started');$('liveLabel').classList.remove('hidden');$('audioIssue').hidden=true;updatePlaybackButton();}
 catch(error){if(request===playRequest){playing=false;updatePlaybackButton();audioIssue(error.name==='NotAllowedError'?'Your browser blocked playback. Tap Enable sound.':'The soundtrack could not start. Tap Enable sound to retry.');}}
 finally{clearTimeout(timeout);if(request===playRequest)starting=false;}
}
function pause(){++playRequest;starting=false;media.pause();offset=time();playing=false;$('elapsed').textContent=format(offset);$('seek').value=offset;updatePlaybackButton();}
function seek(t){media.currentTime=clamp(t,0,buffer.duration);offset=media.currentTime;$('elapsed').textContent=format(offset);$('seek').value=offset;}
media.addEventListener('playing',()=>{playing=true;started=true;document.body.classList.add('started');$('liveLabel').classList.remove('hidden');$('audioIssue').hidden=true;updatePlaybackButton();});
media.addEventListener('pause',()=>{playing=false;updatePlaybackButton();});
media.addEventListener('ended',()=>{playing=false;updatePlaybackButton();});
media.addEventListener('error',()=>{playing=false;starting=false;updatePlaybackButton();audioIssue('The audio could not load. Tap Enable sound to retry, or open the audio directly.');});
$('retryAudio').onclick=()=>{if(media.error){media.load();}starting=false;play();};
function getFeature(t){if(!buffer||!features.length)return [0,0,0,0,0];const f=Math.max(0,(t*buffer.sampleRate-fftSize/2)/hop),a=Math.floor(f),mix=f-a;return Array.from({length:5},(_,i)=>(features[a]?.[i]||0)*(1-mix)+(features[a+1]?.[i]||0)*mix);}
function nearestAttack(t){let lo=0,hi=peaks.length-1;while(lo<=hi){let m=(lo+hi)>>1;if(peaks[m].t<=t)lo=m+1;else hi=m-1;}return hi<0?{i:-1,p:0}:{i:hi,p:peaks[hi].v*Math.exp(-(t-peaks[hi].t)*15)};}
function format(t){return `${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;}
function drawWave(t){const canvas=$('wave'),w=canvas.clientWidth,h=30;if(canvas.width!==w*2){canvas.width=w*2;canvas.height=60;}const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,60);for(let x=0;x<w;x+=3){const ix=Math.floor(x/w*features.length),v=features[ix]?.[4]||.02,played=buffer&&x/w<t/buffer.duration;c.fillStyle=played?'#d0edac':'#526047';c.fillRect(x*2,30-v*20,2,Math.max(2,v*40));}if(buffer){c.fillStyle='#efffcf';c.fillRect(t/buffer.duration*canvas.width,0,2,60);}}
let last=0,levels=[0,0,0,0,0],frames=0;
function animate(ms){requestAnimationFrame(animate);const dt=Math.min((ms-last)/1000,.05);last=ms;const t=time(),raw=playing?getFeature(t):[0,0,0,0,0];for(let i=0;i<5;i++){const speed=raw[i]>levels[i]?35:8;levels[i]+=(raw[i]-levels[i])*(1-Math.exp(-dt*speed));}const hit=playing?nearestAttack(t):{i:-1,p:0};updateVisuals({t:started?t:ms*.00025,dt,levels,hit,playing,started,soft,intensity,buffer,bands:bandFrames,hop});if(frames++%3===0){drawWave(t);$('elapsed').textContent=format(t);if(buffer)$('seek').value=t;['bass','mid','high'].forEach((k,i)=>{$(k+'Bar').style.width=clamp(levels[i])*100+'%';$(k+'Value').textContent=String(Math.round(clamp(levels[i])*99)).padStart(2,'0');});$('state').textContent=!playing?'SUSPENDED':levels[0]>.9?'BREAKING THROUGH':levels[4]>.45?'SURFACING':'SUBMERGING';}}
$('enter').onclick=play;$('play').onclick=()=>playing?pause():play();$('seek').oninput=e=>seek(Number(e.target.value));$('intensity').oninput=e=>{intensity=Number(e.target.value)/100*1.6;$('intensityValue').textContent=e.target.value+'%';};
function setSoft(){ $('soft').setAttribute('aria-pressed',String(soft));$('soft').innerHTML=`Soft light <span>${soft?'●':'○'}</span>`;}$('soft').onclick=()=>{soft=!soft;setSoft();};setSoft();$('mute').onclick=()=>{muted=!muted;media.muted=muted;$('mute').textContent=muted?'SOUND OFF':'SOUND ON';$('mute').setAttribute('aria-label',muted?'Unmute':'Mute');};$('full').onclick=()=>{const p=document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();p?.catch(()=>{});};document.addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement||e.target instanceof HTMLButtonElement)return;if(e.code==='Space'){e.preventDefault();playing?pause():play();}if(e.code==='ArrowRight'&&buffer)seek(Math.min(buffer.duration,time()+5));if(e.code==='ArrowLeft'&&buffer)seek(Math.max(0,time()-5));});
async function boot(){try{await initVisuals();requestAnimationFrame(animate);const Offline=window.OfflineAudioContext||window.webkitOfflineAudioContext;const decodeContext=new Offline(2,1,44100);const res=await fetch('assets/inkey.mp3');if(!res.ok)throw new Error('The audio could not be loaded.');const audioBytes=await res.arrayBuffer();media.src=URL.createObjectURL(new Blob([audioBytes],{type:'audio/mpeg'}));media.load();buffer=await decodeContext.decodeAudioData(audioBytes);await analyse(buffer);$('duration').textContent=format(buffer.duration);$('seek').max=buffer.duration;$('play').disabled=false;enter.disabled=false;$('loadStatus').textContent=`${format(buffer.duration)} · Waveform analysed · Ready to enter`;window.entityReady=true;}catch(e){console.error(e);$('error').hidden=false;$('error').textContent=`Unable to start: ${e.message}. This experience needs a browser with WebGL 2 and audio enabled.`;$('loadStatus').textContent='Unable to prepare the experience';}}
boot();
