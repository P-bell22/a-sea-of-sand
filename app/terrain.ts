import type { SimState } from './wind';
import { SandField, FIELD_SIZE, GRID_SIZE } from './sediment';
export const vertexShader=`attribute vec2 position;void main(){gl_Position=vec4(position,0.,1.);}`;
export const fragmentShader=`
precision highp float;
uniform vec2 resolution;
uniform sampler2D sandMap;
uniform float fieldSize;
uniform float maxHeight;
uniform float altitude;
uniform float yaw;
uniform float overhead;
float heightAt(vec2 p){
 vec2 uv=fract(p/fieldSize+.5);
 return dot(texture2D(sandMap,uv).rg,vec2(255.,255./256.));
}
float shadow(vec3 p,vec3 sun){
 float shade=1.,t=4.;
 for(int i=0;i<22;i++){
  vec3 q=p+sun*t;float gap=q.y-heightAt(q.xz);
  shade=min(shade,5.*gap/t);t+=5.+float(i)*1.5;
 }
 return clamp(shade,0.,1.);
}
void main(){
 vec2 uv=(gl_FragCoord.xy-.5*resolution)/resolution.y;
 float pitch=mix(.29,1.565,overhead),cy=cos(yaw),sy=sin(yaw);
 vec3 forward=vec3(sy*cos(pitch),-sin(pitch),cy*cos(pitch));
 vec3 right=vec3(cy,0.,-sy),up=cross(forward,right);
 vec3 ro=vec3(0.,altitude,mix(-280.,0.,overhead));
 vec3 rd=normalize(forward*mix(1.17,.68,overhead)+uv.x*right+uv.y*up);
 vec3 sky=mix(vec3(.80,.84,.78),vec3(.28,.56,.72),clamp(rd.y*2.6,0.,1.));
 vec3 col=sky;
 if(rd.y<0.){
  float t=max(0.,(ro.y-maxHeight-2.)/-rd.y);float hit=0.;vec3 p=ro;
  for(int i=0;i<176;i++){
   p=ro+rd*t;float gap=p.y-heightAt(p.xz);
   if(gap<max(.15,t*.42/resolution.y)){hit=1.;break;}
   t+=max(.3,gap*.65);if(t>12000.)break;
  }
  if(hit<.5&&t<12000.){
   for(int i=0;i<100;i++){
    float next=t+max(3.,t*.002);vec3 q=ro+rd*next;
    if(q.y-heightAt(q.xz)<max(.15,next*.42/resolution.y)){
     float lo=t,hi=next;
     for(int j=0;j<7;j++){float mid=(lo+hi)*.5;vec3 m=ro+rd*mid;if(m.y>heightAt(m.xz))lo=mid;else hi=mid;}
     t=hi;p=ro+rd*t;hit=1.;break;
    }
    t=next;if(t>12000.)break;
   }
  }
  // At the far clipping distance, merge unresolved dunes into atmospheric haze.
  if(hit<.5){t=ro.y/-rd.y;p=ro+rd*t;hit=1.;}
  if(hit>.5){
   float e=max(5.,t*.0007),h=heightAt(p.xz);
   vec3 n=normalize(vec3(heightAt(p.xz-vec2(e,0))-heightAt(p.xz+vec2(e,0)),2.*e,heightAt(p.xz-vec2(0,e))-heightAt(p.xz+vec2(0,e))));
   vec3 sun=normalize(vec3(-.68,.5,-.53));float shade=shadow(p+n*.8,sun);
   float light=max(0.,dot(n,sun));
   vec3 sand=mix(vec3(.84,.59,.32),vec3(.96,.685,.365),smoothstep(.05,2.,h));
   col=mix(vec3(.32,.235,.155),sand,clamp(.12+light*shade*.94,0.,1.));
   float haze=1.-exp(-t*.00022);col=mix(col,vec3(.80,.84,.78),haze);
  }
 }
 gl_FragColor=vec4(pow(col,vec3(.92)),1.);
}`;
export function createTerrain(canvas:HTMLCanvasElement,state:SimState,onError:(message:string)=>void){
 const gl=canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'high-performance'});
 if(!gl){onError('The 3D view needs hardware acceleration. You can still explore Grain journey.');return()=>{};}
 state.model??=new SandField();
 const compile=(type:number,source:string)=>{const s=gl.createShader(type)!;gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||'Shader compilation failed');return s;};
 let program:WebGLProgram,vs:WebGLShader,fs:WebGLShader;
 try{vs=compile(gl.VERTEX_SHADER,vertexShader);fs=compile(gl.FRAGMENT_SHADER,fragmentShader);program=gl.createProgram()!;gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Terrain shader link failed');}catch(e){onError('The 3D view could not start. Grain journey is still available.');console.error(e);return()=>{};}
 gl.useProgram(program);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const pos=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
 const uniforms=Object.fromEntries(['resolution','sandMap','fieldSize','maxHeight','altitude','yaw','overhead'].map(k=>[k,gl.getUniformLocation(program,k)]));
 const texture=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
 gl.uniform1i(uniforms.sandMap,0);gl.uniform1f(uniforms.fieldSize,FIELD_SIZE);
 const packed=new Uint8Array(GRID_SIZE*GRID_SIZE*4);let packedVersion=-1;
 let frame=0,previous=0,top=0,alt=state.altitude,quality=.9,frameTime=16,frames=0;
 const resize=()=>{const r=canvas.getBoundingClientRect(),ratio=Math.min(window.devicePixelRatio||1,1.3)*quality;canvas.width=Math.max(1,Math.floor(r.width*ratio));canvas.height=Math.max(1,Math.floor(r.height*ratio));gl.viewport(0,0,canvas.width,canvas.height);};
 const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
 const lost=(e:Event)=>{e.preventDefault();cancelAnimationFrame(frame);onError('The graphics connection was lost. Reload to restore the 3D view.');};canvas.addEventListener('webglcontextlost',lost);
 function draw(now:number){
  frame=requestAnimationFrame(draw);if(document.hidden||state.view==='grain'){previous=now;return;}
  const dt=Math.min((now-previous)/1000,.05);if(previous)frameTime=frameTime*.96+(now-previous)*.04;previous=now;
  if(++frames===180&&frameTime>38){quality=.65;resize();}
  const model=state.model!;
  if(model.version!==packedVersion){model.pack(packed);gl!.texImage2D(gl!.TEXTURE_2D,0,gl!.RGBA,GRID_SIZE,GRID_SIZE,0,gl!.RGBA,gl!.UNSIGNED_BYTE,packed);gl!.uniform1f(uniforms.maxHeight,model.stats().maxHeight);packedVersion=model.version;}
  top+=(Number(state.view==='above')-top)*Math.min(1,dt*4);alt+=(state.altitude-alt)*Math.min(1,dt*4);
  gl!.uniform2f(uniforms.resolution,canvas.width,canvas.height);gl!.uniform1f(uniforms.altitude,alt);gl!.uniform1f(uniforms.yaw,state.yaw);gl!.uniform1f(uniforms.overhead,top);gl!.drawArrays(gl!.TRIANGLES,0,6);
 }
 frame=requestAnimationFrame(draw);
 return()=>{cancelAnimationFrame(frame);observer.disconnect();canvas.removeEventListener('webglcontextlost',lost);gl.deleteTexture(texture);gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);};
}
export function drawGrain(canvas:HTMLCanvasElement,t:number){
 const rect=canvas.getBoundingClientRect();const ratio=Math.min(window.devicePixelRatio||1,2);if(canvas.width!==Math.round(rect.width*ratio)||canvas.height!==Math.round(rect.height*ratio)){canvas.width=Math.round(rect.width*ratio);canvas.height=Math.round(rect.height*ratio);}
 const ctx=canvas.getContext('2d');if(!ctx)return;ctx.setTransform(ratio,0,0,ratio,0,0);const w=rect.width,h=rect.height;ctx.clearRect(0,0,w,h);
 const start=w*.08,end=w*.86,crest=w*.66,baseline=h*.77,height=Math.min(h*.25,w*.19);const shape=(x:number,shift=0)=>{const v=x-shift;if(v<start||v>end)return baseline;const f=v<crest?(v-start)/(crest-start):(end-v)/(end-crest);return baseline-height*f*f*(3-2*f);};
 ctx.strokeStyle='#a4b19966';ctx.lineWidth=1;ctx.setLineDash([5,6]);ctx.beginPath();for(let x=start-35;x<=end;x+=2){const y=shape(x,-35);if(x===start-35)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();ctx.setLineDash([]);
 const grad=ctx.createLinearGradient(0,baseline-height,0,baseline);grad.addColorStop(0,'#d2ac68');grad.addColorStop(1,'#6e6944');ctx.fillStyle=grad;ctx.beginPath();ctx.moveTo(start,baseline);for(let x=start;x<=end;x+=2)ctx.lineTo(x,shape(x));ctx.lineTo(end,baseline);ctx.closePath();ctx.fill();
 ctx.strokeStyle='#f0d39a';ctx.lineWidth=1.4;ctx.beginPath();for(let x=start;x<=end;x+=2){if(x===start)ctx.moveTo(x,shape(x));else ctx.lineTo(x,shape(x));}ctx.stroke();
 ctx.fillStyle='#e9e5d0';ctx.font=`${w<600?12:14}px Arial`;ctx.textAlign='center';ctx.fillText('Windward slope',w*.35,shape(w*.35)-35);ctx.fillText('Crest',crest,baseline-height-25);ctx.fillText('Slip face',w*.8,shape(w*.8)-30);
 ctx.strokeStyle='#ffffff33';ctx.beginPath();ctx.moveTo(w*.06,baseline+3);ctx.lineTo(w*.94,baseline+3);ctx.stroke();ctx.fillStyle='#bdc7af';ctx.fillText('Dune migration →',w*.5,baseline+38);
 const phase=(t/9)%1;
 for(let i=0;i<29;i++){const f=(phase+i/29)%1;const x=start+(end-start)*f;const hop=x<crest?Math.abs(Math.sin(f*93))*Math.min(8,w*.01):0;ctx.fillStyle=i===0?'#fff3bc':'#f0d78d99';ctx.shadowColor='#ffe6a0';ctx.shadowBlur=i===0?12:0;ctx.beginPath();ctx.arc(x,shape(x)-3-hop,i===0?4:1.5,0,Math.PI*2);ctx.fill();}ctx.shadowBlur=0;
 const ax=w*.38,ay=baseline-height-65;ctx.strokeStyle='#c9d4ba';ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(ax+60,ay);ctx.lineTo(ax+53,ay-4);ctx.moveTo(ax+60,ay);ctx.lineTo(ax+53,ay+4);ctx.stroke();ctx.fillStyle='#becaae';ctx.fillText('Wind',ax+30,ay-12);
}
