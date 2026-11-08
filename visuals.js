import * as T from 'three';
import {jawTarget,advanceJaw} from './jaw-response.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
let renderer,scene,camera,composer,bloom,post,skull,jaw,floor,neck,threads,particles,key,fill,rim,slow=0,roll=0,heave=0,heaveVelocity=0,strain=0,jawOpen=0;
let jawState={open:0,held:0,holdUntil:0},lastMotionTime=0,lastLunge=-10,lastHit=-1;
const struggle=new T.Vector3(),struggleVelocity=new T.Vector3();
const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const texData=new Float32Array(512*4),audioTex=new T.DataTexture(texData,512,1,T.RGBAFormat,T.FloatType);audioTex.minFilter=T.LinearFilter;audioTex.magFilter=T.LinearFilter;audioTex.needsUpdate=true;
const u={uAudio:{value:audioTex},uTime:{value:0},uBass:{value:0},uMid:{value:0},uHigh:{value:0},uEnergy:{value:0},uSlow:{value:0},uHit:{value:0},uPower:{value:1},uPhase:{value:0},uStrain:{value:0},uDeform:{value:0},uRise:{value:0},uAnchor:{value:new T.Vector2()},uBend:{value:new T.Vector2()},uNeckTilt:{value:new T.Vector2()},uTint:{value:new T.Color('#b7d6cc')}};
const common=`uniform sampler2D uAudio;uniform float uTime,uBass,uMid,uHigh,uEnergy,uSlow,uHit,uPower,uPhase,uStrain,uDeform,uRise;uniform vec2 uAnchor,uBend,uNeckTilt;uniform vec3 uTint;
float braincaseMask(vec3 p){return smoothstep(-.05,.50,p.y);}
float wave(float x){return texture2D(uAudio,vec2(fract(x),.5)).r;}
float band(float x){return texture2D(uAudio,vec2(clamp(x,.001,.999),.5)).g;}
float noise3(vec3 p){return sin(p.x+sin(p.y*1.31))*sin(p.y+sin(p.z*1.17))*sin(p.z+sin(p.x*1.23));}
float liquidHeight(vec2 p){float r=length(p),a=atan(p.y,p.x);float edge=smoothstep(.6,2.7,r);float eddy=a+uTime*.22+sin(r*.7-uTime*.35)*.45;float h=sin(r*3.-uTime*1.65+sin(eddy*3.)*.75)*(.065+uBass*.13)*edge;h+=noise3(vec3(p*.65,uTime*.30))*(.15+uSlow*.6)*edge;h+=wave(r*.07+eddy*.045)*(.008+uHigh*.018)*edge;h+=sin(eddy*5.-r*1.8)*exp(-abs(r-2.1)*1.7)*(.10+uStrain*.25);h+=pow(max(0.,r-6.),1.12)*(.28+uSlow*.22);return h;}
`;
function facetMaterial(inner=false,isJaw=false){const mat=new T.MeshStandardMaterial({color:inner?0x101a23:0x8c9ba4,roughness:inner?.75:.48,metalness:inner?.1:.28,flatShading:true,side:T.DoubleSide});mat.customProgramCacheKey=()=>`${inner?'core':'shell'}-${isJaw?'jaw':'head'}-v7`;mat.onBeforeCompile=s=>{Object.assign(s.uniforms,u);s.uniforms.uLayer={value:inner?1:0};s.uniforms.uJaw={value:isJaw?1:0};s.vertexShader=common+`uniform float uLayer,uJaw;attribute vec3 aCenter;attribute vec3 aBary;varying vec3 vBary;varying vec3 vWorld;varying float vSeed;varying vec3 vAnatomy;\n`+s.vertexShader;
s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`float seed=fract(sin(dot(aCenter,vec3(127.1,311.7,78.3)))*43758.5453);float attack=(uHit*.42+uHigh*.12)*uPower;float gap=(.012+attack*.07)*(1.-uLayer);vec3 pivot=vec3(0.,-.44,-.36)*uJaw;vec3 transformed=aCenter+(position-aCenter)*(1.-gap)+pivot;vAnatomy=position+pivot;transformed*=1.-uLayer*.020;transformed+=normal*attack*(.008+seed*.03)*(1.-uLayer);
// The braincase balloons and strains; the lower face remains a stable reference.
float brain=braincaseMask(vAnatomy)*(1.-uJaw);float weight=.10+brain*.90;float d=uDeform;float h=transformed.y;
float twist=d*.34*weight*sin(h*1.35+uTime*.75);mat2 rot=mat2(cos(twist),-sin(twist),sin(twist),cos(twist));transformed.xz=rot*transformed.xz;
float swell=d*brain;transformed.x*=1.+swell*(.23+.10*sin(h*2.1+uTime*.9));transformed.z*=1.+swell*.19;transformed.y+=swell*(.25+.12*sin(transformed.x*2.1+uTime*.8));
transformed.x+=sin(h*1.8-uTime*.95)*d*.20*weight;transformed.z+=sin(h*2.2+uTime*.65)*d*.18*weight;transformed.y+=sin(transformed.x*2.6-uTime*.8)*d*.08*weight;
transformed-=pivot;vBary=aBary;vSeed=seed;`);
s.vertexShader=s.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvWorld=(modelMatrix*vec4(transformed,1.)).xyz;');s.fragmentShader=common+`uniform float uLayer,uJaw;varying vec3 vBary;varying vec3 vWorld;varying float vSeed;varying vec3 vAnatomy;\n`+s.fragmentShader;
s.fragmentShader=s.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
float waterline=liquidHeight(vWorld.xz);if(vWorld.y<waterline-.025)discard;`);
s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
diffuseColor.rgb*=.65+vSeed*.65;
float crown=braincaseMask(vAnatomy);
vec2 orbit=vec2((abs(vAnatomy.x)-.51)/.29,(vAnatomy.y+.04)/.32);
float socket=exp(-dot(orbit,orbit)*2.)*(1.-smoothstep(.18,.53,vAnatomy.z))*.28;
float colourMask=max(crown,socket)*(1.-uJaw);`);
s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
vec3 fw=max(fwidth(vBary),vec3(.0001));vec3 aa=smoothstep(vec3(0.),fw*.85,vBary);float edge=1.-min(min(aa.x,aa.y),aa.z);float select=step(.70,vSeed);float meniscus=exp(-abs(vWorld.y-waterline)*28.);totalEmissiveRadiance+=vec3(.018,.024,.03)*(1.-uLayer)*(.6+vSeed*.5);
float pulse=.10+uHit*.8+uHigh*.25+uEnergy*.12;
totalEmissiveRadiance+=uTint*colourMask*(uLayer*(.15+pulse)+(1.-uLayer)*(pulse*.52+edge*(.08+select*pulse*.5)));
totalEmissiveRadiance+=vec3(.025)*edge*(1.-colourMask)*(1.-uLayer);`);};return mat;}
function tube(points,r,mat){return new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),60,r,12,false),mat);}
export async function initVisuals(){renderer=new T.WebGLRenderer({canvas:document.getElementById('scene'),antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;scene=new T.Scene();scene.background=new T.Color('#030609');scene.fog=new T.FogExp2('#030609',.035);camera=new T.PerspectiveCamera(46,innerWidth/innerHeight,.1,100);camera.position.set(1.8,9.8,7.4);camera.lookAt(0,1,0);
scene.add(new T.HemisphereLight(0xc5cbd0,0x141414,1.1));key=new T.DirectionalLight(0xdee0bb,3.1);key.position.set(-3,7,5);scene.add(key);fill=new T.PointLight(0xc7cbd0,35,22,2);fill.position.set(4,3,0);scene.add(fill);rim=new T.PointLight(0xe0e3e5,45,20,2);rim.position.set(-3,4,-3);scene.add(rim);
async function loadBone(url){const res=await fetch(url);if(!res.ok)throw new Error('Anatomy geometry could not load');const data=new Float32Array(await res.arrayBuffer()),ib=new T.InterleavedBuffer(data,6),g=new T.BufferGeometry();g.setAttribute('position',new T.InterleavedBufferAttribute(ib,3,0));g.setAttribute('normal',new T.InterleavedBufferAttribute(ib,3,3));const count=g.attributes.position.count,centers=new Float32Array(count*3),bary=new Float32Array(count*3);for(let i=0;i<count;i+=3){const c=[0,0,0];for(let j=0;j<3;j++)for(let k=0;k<3;k++)c[k]+=data[(i+j)*6+k]/3;for(let j=0;j<3;j++){centers.set(c,(i+j)*3);bary[(i+j)*3+j]=1;}}g.setAttribute('aCenter',new T.BufferAttribute(centers,3));g.setAttribute('aBary',new T.BufferAttribute(bary,3));g.computeBoundingSphere();return g;}
const [geo,jawGeo]=await Promise.all([loadBone('assets/faceted-skull.bin'),loadBone('assets/faceted-jaw.bin')]);
skull=new T.Group();const bone=facetMaterial(),core=facetMaterial(true);skull.add(new T.Mesh(geo,core));skull.add(new T.Mesh(geo,bone));jaw=new T.Group();jaw.position.set(0,-.44,-.36);jaw.add(new T.Mesh(jawGeo,facetMaterial(true,true)));jaw.add(new T.Mesh(jawGeo,facetMaterial(false,true)));skull.add(jaw);skull.scale.setScalar(1.65);skull.rotation.x=-Math.PI/2;skull.position.y=-.4;heave=-.4;scene.add(skull);
const floorVert=common+`varying vec3 vPos;varying vec2 vUv;void main(){vec2 p=position.xy;vec3 q=vec3(p.x,liquidHeight(p),p.y);vPos=q;vUv=p;gl_Position=projectionMatrix*modelViewMatrix*vec4(q,1.);}`;
const floorFrag=common+`varying vec3 vPos;varying vec2 vUv;void main(){float r=length(vUv);float eps=.065;vec3 n=normalize(vec3(liquidHeight(vUv-vec2(eps,0.))-liquidHeight(vUv+vec2(eps,0.)),2.*eps,liquidHeight(vUv-vec2(0.,eps))-liquidHeight(vUv+vec2(0.,eps))));vec3 view=normalize(cameraPosition-vPos);float lam=max(0.,dot(n,normalize(vec3(-3.,6.,3.)-vPos)));float fres=pow(1.-abs(dot(n,view)),3.);float a=atan(vUv.y,vUv.x);float flow=a+uTime*.26+sin(r*.8-uTime*.4)*.6;float bent=r*13.+sin(flow*4.+r*.7)*2.+noise3(vec3(vUv*1.8,uTime*.3))*3.+wave(r*.04)*uHigh*3.;float line=pow(max(0.,sin(bent)),22.);float micro=pow(max(0.,sin(r*90.+noise3(vec3(vUv*4.,0.))*4.)),30.);float b=band(fract(r*.08));vec3 col=vec3(.012,.018,.023)*(lam+.25);col+=uTint*(line*(.045+b*.19)+micro*.025*uHigh)*smoothstep(1.,2.,r);col+=uTint*fres*(.07+uHit*.20);col+=uTint*uHit*.025*lam;float spec=pow(max(0.,dot(n,normalize(view+normalize(vec3(-3.,6.,3.)-vPos)))),45.);col+=uTint*spec*.12;col*=.5+.5*smoothstep(.3,1.8,r);col=mix(col,vec3(.006,.009,.015),1.-exp(-r*.035));gl_FragColor=vec4(col,1.);}`;
floor=new T.Mesh(new T.PlaneGeometry(60,60,380,380),new T.ShaderMaterial({uniforms:u,vertexShader:floorVert,fragmentShader:floorFrag,side:T.DoubleSide}));scene.add(floor);
// A flared membrane joins the rising underside to the surrounding floor.
const neckMaterial=new T.ShaderMaterial({uniforms:u,side:T.DoubleSide,vertexShader:common+`varying vec3 vPos;varying float vHeight;void main(){float a=position.x+3.14159265,v=position.y+.5;float r=.90+1.9*pow(1.-v,3.);r+=(sin(a*13.+uTime*.4)*.035+sin(a*7.-uTime*.5)*uDeform*.045)*sin(v*3.14159);vec2 rim=vec2(cos(a),sin(a))*2.8;vec2 p=vec2(cos(a)*r,sin(a)*r)+uAnchor*pow(v,1.7)+uBend*sin(v*3.14159);float top=uRise+dot(vec2(cos(a),sin(a)),uNeckTilt);float y=mix(liquidHeight(rim),top,v);p.x+=sin(v*3.+uTime*.6)*uDeform*.09*sin(v*3.14159);vPos=vec3(p.x,y,p.y);vHeight=v;gl_Position=projectionMatrix*modelViewMatrix*vec4(vPos,1.);}`,fragmentShader:common+`varying vec3 vPos;varying float vHeight;void main(){vec3 n=normalize(cross(dFdx(vPos),dFdy(vPos)));vec3 light=normalize(vec3(-3.,7.,5.)-vPos),view=normalize(cameraPosition-vPos);float lam=abs(dot(n,light));float spec=pow(abs(dot(n,normalize(light+view))),24.);vec3 c=mix(vec3(.018,.023,.028),vec3(.09,.105,.12),vHeight)*(.4+lam*.7)+vec3(spec*.045);gl_FragColor=vec4(c,1.);}`});
neck=new T.Mesh(new T.PlaneGeometry(Math.PI*2,1,96,32),neckMaterial);neck.frustumCulled=false;neck.visible=false;scene.add(neck);
// Dense curved filaments form a deforming field around the emerging body.
const verts=[];for(let k=0;k<90;k++){let radius=2.4+k*.145;for(let j=0;j<220;j++){let a=j/219*Math.PI*2;verts.push(Math.cos(a)*radius,0,Math.sin(a)*radius,k/90);}}const arr=new Float32Array(verts),fg=new T.BufferGeometry(),fi=new T.InterleavedBuffer(arr,4);fg.setAttribute('position',new T.InterleavedBufferAttribute(fi,3,0));fg.setAttribute('aBand',new T.InterleavedBufferAttribute(fi,1,3));const ids=[];for(let k=0;k<90;k++)for(let j=0;j<219;j++)ids.push(k*220+j,k*220+j+1);fg.setIndex(ids);const fmat=new T.ShaderMaterial({uniforms:u,transparent:true,depthWrite:false,blending:T.AdditiveBlending,vertexShader:common+`attribute float aBand;varying float vBand;varying float vLevel;void main(){float a=atan(position.z,position.x),r=length(position.xz);float b=band(aBand);vec3 p=position;float w=wave(a/6.283+.5+aBand*.2);float swirl=sin(r*.6-uTime*.3)*.06*uStrain;mat2 rr=mat2(cos(swirl),-sin(swirl),sin(swirl),cos(swirl));p.xz=rr*p.xz;p.y=.025+liquidHeight(p.xz);p.y+=pow(max(0.,sin(a*5.+uTime*.45+r)),10.)*b*.13;vBand=aBand;vLevel=b;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:common+`varying float vBand;varying float vLevel;void main(){vec3 c=mix(uTint,vec3(.35,.17,.6),vBand);gl_FragColor=vec4(c*(.4+vLevel*.7),(.14+vLevel*.25+uHit*.10)*(1.-vBand*.7));}`});threads=new T.LineSegments(fg,fmat);scene.add(threads);
const pp=new Float32Array(3500*3);for(let i=0;i<3500;i++){let a=i*2.39996,r=2+Math.sqrt(i/3500)*16;pp.set([Math.cos(a)*r,(Math.sin(i*77.13)*.5+.5)*7,Math.sin(a)*r],i*3);}const pg=new T.BufferGeometry();pg.setAttribute('position',new T.BufferAttribute(pp,3));particles=new T.Points(pg,new T.ShaderMaterial({uniforms:u,transparent:true,depthWrite:false,blending:T.AdditiveBlending,vertexShader:common+`varying float vB;void main(){vec3 p=position;float b=band(fract(position.y*.16));p.y=mod(p.y+uTime*.1*(.3+b),8.);float a=uTime*.025+uBass*.06;mat2 rot=mat2(cos(a),-sin(a),sin(a),cos(a));p.xz=rot*p.xz;p.x+=wave(position.y*.12)*uHigh*.15;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((1.+b*1.5)*18./-mv.z,1.,4.);vB=b;}`,fragmentShader:common+`varying float vB;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(uTint,.15+vB*.35);}`}));scene.add(particles);
composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));bloom=new UnrealBloomPass(new T.Vector2(innerWidth,innerHeight),.55,.7,.8);composer.addPass(bloom);post=new ShaderPass({uniforms:{tDiffuse:{value:null},amount:{value:0},tint:{value:new T.Color()},flash:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`uniform sampler2D tDiffuse;uniform float amount,flash;uniform vec3 tint;varying vec2 vUv;void main(){vec2 p=vUv-.5;vec2 d=p*dot(p,p)*amount;vec3 c=vec3(texture2D(tDiffuse,vUv+d).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv-d).b);c+=tint*flash*.035;c*=1.-dot(p,p)*.6;gl_FragColor=vec4(c,1.);}`});composer.addPass(post);addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);});window.visualInfo={type:'faceted-toothless-skull',vertices:geo.attributes.position.count+jawGeo.attributes.position.count,frequencyBands:48,filaments:90,lightning:false};}
export function updateVisuals({t,dt,levels,hit,playing,started,soft,intensity,buffer,bands,hop}){const [bass,mid,high,flux,energy]=levels;slow+=(energy-slow)*(1-Math.exp(-dt*1.4));const power=intensity*(soft?.45:1);strain+=(mid*.65+slow*.4-strain)*(1-Math.exp(-dt*2.6));u.uStrain.value=strain*power*.65;u.uDeform.value=Math.min(1.8,Math.pow(Math.max(0,energy*.60+mid*.25+bass*.15),1.25)*power*1.5);u.uTime.value=t;u.uBass.value=bass*power;u.uMid.value=mid*power*.5;u.uHigh.value=high*power;u.uEnergy.value=energy;u.uSlow.value=slow;u.uHit.value=hit.p*(soft?.1:1);u.uPower.value=power;u.uPhase.value=0;
const hue=(.48+Math.sin(t*.13)*.19+hit.i*.017)%1;u.uTint.value.setHSL(hue,.65,.52);if(buffer){const data=buffer.getChannelData(0),base=Math.floor(t*buffer.sampleRate),f=Math.max(0,Math.floor((base-1024)/hop)),next=bands[f]||[];for(let i=0;i<512;i++){texData[i*4]=playing?(data[base+i*4]||0):0;texData[i*4+1]=playing?(next[Math.min(47,Math.floor(i/512*48))]||0):0;texData[i*4+3]=1;}audioTex.needsUpdate=true;}
// The audio envelope is the sole driver of vertical emergence: no timed bobbing.
const pressure=Math.max(0,Math.min(1,(bass*.68+energy*.32)*intensity));
const emergence=started?-1.72+3.65*Math.pow(pressure,1.1):-.40;
// Fast upward response preserves attacks; a slower release gives the surface weight.
const stiffness=emergence>heave?105:48;
heaveVelocity+=((emergence-heave)*stiffness-heaveVelocity*Math.sqrt(stiffness)*1.9)*dt;
heave+=heaveVelocity*dt;skull.position.y=heave;
// Sparse musical attacks drive whole-head lunges with inertial recoil.
const jumped=Math.abs(t-lastMotionTime)>.35;lastMotionTime=t;
if(jumped){struggle.set(0,0,0);struggleVelocity.set(0,0,0);lastLunge=t-.6;lastHit=-1;jawState={open:jawOpen,held:jawOpen,holdUntil:t+.2};}
const strength=Math.min(1.3,(slow*.65+mid*.35)*power);
if(playing&&hit.i!==lastHit&&hit.i>=0&&hit.p>.28&&t-lastLunge>.48){
 lastHit=hit.i;lastLunge=t;
 const side=hash(hit.i)>.5?1:-1;
 struggleVelocity.x+=side*(2.8+hash(hit.i+7)*2.4)*strength;
 struggleVelocity.y+=(hash(hit.i+19)-.5)*5*strength;
 struggleVelocity.z+=(hash(hit.i+41)-.5)*3.8*strength;
}
// A slow uneven pull keeps tension between attacks; the floor attachment stays fixed.
const pull=new T.Vector3(Math.sin(t*.83+Math.sin(t*.37))*.32,Math.sin(t*.61+Math.cos(t*.29))*.18,Math.sin(t*.71)*.12).multiplyScalar(strength);
struggleVelocity.addScaledVector(pull.clone().sub(struggle),34*dt).multiplyScalar(Math.exp(-dt*6.2));
struggle.addScaledVector(struggleVelocity,dt);struggle.clampScalar(-.95,.95);
skull.position.x=struggle.x*.95;skull.position.z=struggle.y*.65;
const tilt=-Math.PI/2+struggle.y*.26;
skull.rotation.x+=(tilt-skull.rotation.x)*(1-Math.exp(-dt*8));
skull.rotation.y+=(struggle.x*.48-skull.rotation.y)*(1-Math.exp(-dt*8));
skull.rotation.z+=(struggle.z*.38-struggle.x*.23-skull.rotation.z)*(1-Math.exp(-dt*7));
skull.scale.set(1.65*(1.-strain*.025*power),1.65*(1.+strain*.04*power),1.65*(1.+bass*.06*power));
const gasp=jawTarget(energy,mid,flux,power);
jawState=advanceJaw(jawState,gasp,dt,t);jawOpen=jawState.open;
// Hold the mouth open under strain. No periodic hinge chatter or tremor.
jaw.rotation.x=jawOpen;jaw.rotation.z=struggle.z*.025*jawOpen;jaw.position.x=struggle.x*.018*jawOpen;jaw.position.y=-.44-Math.max(0,jawOpen-.4)*.12;
let orbit=started?Math.sin(t*.14)*.12*power:.20;const distance=innerWidth<700?9.7:7.0;const lift=innerWidth<700?12.5:9.5+Math.sin(t*.29)*strain*.15*power;
camera.position.lerp(new T.Vector3(Math.sin(orbit)*distance,lift,Math.cos(orbit)*distance),1-Math.exp(-dt*2));camera.fov=46+Math.sin(t*.2)*energy*3*power;camera.updateProjectionMatrix();camera.lookAt(started?0:-1.7,started?.55:0,0);roll+=(Math.sin(t*.37+Math.sin(t*.17))*strain*.035*power-roll)*(1-Math.exp(-dt*1.5));camera.rotateZ(roll);
u.uRise.value=Math.max(0,heave-.62);u.uAnchor.value.set(skull.position.x,skull.position.z);u.uBend.value.set(-struggleVelocity.x*.045,-struggleVelocity.y*.045);u.uNeckTilt.value.set(-skull.rotation.z*.60,(skull.rotation.x+Math.PI/2)*.65);neck.visible=u.uRise.value>.045;
window.motionState={faceUp:true,deformation:u.uDeform.value,neckHeight:u.uRise.value,intensity,pressure,targetEmergence:emergence,emergence:heave,pitch:skull.rotation.x,strain,jawOpen,jawTarget:gasp,jawShake:0,headLunge:struggle.toArray(),jawHeld:jawState.held};
key.color.setHex(0xe0e1dc);fill.color.setHex(0xc7cbd0);fill.intensity=30;rim.color.setHex(0xe0e3e5);rim.intensity=40;threads.rotation.y=Math.sin(t*.08)*.12*power;bloom.strength=soft?.28:.45+high*.28;post.uniforms.amount.value=0;post.uniforms.tint.value.copy(u.uTint.value);post.uniforms.flash.value=0;composer.render();}
