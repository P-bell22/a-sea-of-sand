import type { SimState } from './wind';
export const vertexShader = `attribute vec2 position; void main(){gl_Position=vec4(position,0.,1.);}`;
export const fragmentShader = `
precision highp float;
uniform vec2 resolution;
uniform vec2 drift;
uniform float altitude;
uniform float yaw;
uniform float overhead;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
// A rounded, asymmetric dune section. Matching zero slopes at the crest
// and trough avoids the knife edges made by the previous power/linear join.
float profile(float p){
 float f=fract(p);
 float flank=f<.70?f/.70:(1.-f)/.30;
 return flank*flank*(3.-2.*flank);
}
float terrain(vec2 world){
 vec2 p=vec2(world.x*.88+world.y*.475,-world.x*.475+world.y*.88);
 vec2 driftAlong=vec2(drift.x*.88+drift.y*.475,-drift.x*.475+drift.y*.88);
 vec2 b=p-driftAlong*2.;
 float warp=sin(b.y*.008)*.28+sin(b.y*.021+b.x*.001)*.14+(noise(b*.003)-.5)*.55;
 float large=profile(b.x/300.+warp);
 float height=56.*large*(.78+.28*noise(b*.004+12.));
 vec2 s=p-driftAlong*8.;
 float bend=.26*sin(s.y*.027)+.2*sin(s.y*.011+s.x*.008)+.13*noise(s*.012);
 float small=profile(s.x/76.+bend);
 height+=12.*small*(.6+.4*(1.-large));
 height+=1.1*noise(p*.055);
 return 3.+height;
}
float shadow(vec3 p, vec3 light){float shade=1.;float t=7.;for(int i=0;i<9;i++){vec3 q=p+light*t;float d=q.y-terrain(q.xz);shade=min(shade,3.5*d/t);t+=9.+float(i)*6.;}return clamp(shade,.28,1.);}
void main(){
 vec2 uv=(gl_FragCoord.xy-.5*resolution)/resolution.y;
 float pitch=mix(.29,1.565,overhead);
 float cy=cos(yaw),sy=sin(yaw);
 vec3 forward=vec3(sy*cos(pitch),-sin(pitch),cy*cos(pitch));
 vec3 right=vec3(cy,0.,-sy);vec3 up=cross(forward,right);
 vec3 ro=vec3(0.,altitude,-260.);
 vec3 rd=normalize(forward*1.17+uv.x*right+uv.y*up);
 vec3 sky=mix(vec3(.71,.77,.75),vec3(.29,.47,.58),clamp(rd.y*2.2,0.,1.));
 vec3 col=sky;
 if(rd.y<0.){
  float t=max(0.,(ro.y-78.)/-rd.y);float hit=0.;vec3 p=ro;
  for(int i=0;i<192;i++){p=ro+rd*t;float d=p.y-terrain(p.xz);if(d<max(.13,t*.00013)){hit=1.;break;}t+=max(.25,d*.4);if(t>9000.)break;}
  if(hit>.5){
   float e=max(.3,t*.0004);float h=terrain(p.xz);
   vec3 n=normalize(vec3(terrain(p.xz-vec2(e,0))-terrain(p.xz+vec2(e,0)),2.*e,terrain(p.xz-vec2(0,e))-terrain(p.xz+vec2(0,e))));
   vec3 sun=normalize(vec3(-.65,.6,-.48));
   float diffuse=max(0.,dot(n,sun));float sh=shadow(p+n*.6,sun);
   vec2 ripplePoint=p.xz-drift*14.;
   float fine=sin((ripplePoint.x*.88+ripplePoint.y*.475)*2.5+noise(ripplePoint*.08)*5.);
   fine*=.018*exp(-t*.002);
   vec3 warm=vec3(.91,.695,.435);vec3 cool=vec3(.355,.38,.36);
   col=mix(cool,warm,clamp(.12+diffuse*sh*1.06,0.,1.));
   col*=.9+.12*n.y+fine+.055*noise(p.xz*.12);
   float haze=1.-exp(-t*.00037);col=mix(col,vec3(.72,.755,.71),haze);
  }
 }
 col=pow(col,vec3(.94));float grain=hash(gl_FragCoord.xy)*.007;col+=grain;
 gl_FragColor=vec4(col,1.);
}`;
export function createTerrain(canvas:HTMLCanvasElement,state:SimState,onError:(message:string)=>void){
 const gl=canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'high-performance'});
 if(!gl){onError('Your browser cannot start the 3D view. Try the Grain journey view, or enable hardware acceleration.');return()=>{};}
 const compile=(type:number,source:string)=>{const s=gl.createShader(type)!;gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||'Shader compilation failed');return s;};
 let program:WebGLProgram;let vs:WebGLShader;let fs:WebGLShader;
 try{vs=compile(gl.VERTEX_SHADER,vertexShader);fs=compile(gl.FRAGMENT_SHADER,fragmentShader);program=gl.createProgram()!;gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Cannot link terrain shader');}catch(e){onError('The 3D view is unavailable in this browser. The Grain journey view still works.');console.error(e);return()=>{};}
 gl.useProgram(program);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const pos=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
 const uniforms=Object.fromEntries(['resolution','drift','altitude','yaw','overhead'].map(k=>[k,gl.getUniformLocation(program,k)]));
 let frame=0,previous=0;let top=0;let alt=state.altitude;let quality=.85;let renderMs=16;let count=0;
 const resize=()=>{const r=canvas.getBoundingClientRect();const ratio=Math.min(window.devicePixelRatio||1,1.4)*quality;canvas.width=Math.max(1,Math.floor(r.width*ratio));canvas.height=Math.max(1,Math.floor(r.height*ratio));gl.viewport(0,0,canvas.width,canvas.height);};
 const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
 const lost=(e:Event)=>{e.preventDefault();cancelAnimationFrame(frame);onError('The 3D view paused because the graphics connection was lost. Reload to restore it, or explore Grain journey.');};canvas.addEventListener('webglcontextlost',lost);
 function draw(now:number){frame=requestAnimationFrame(draw);if(document.hidden||state.view==='grain'){previous=now;return;}const dt=Math.min((now-previous)/1000,.05);if(previous){renderMs=renderMs*.96+(now-previous)*.04;}previous=now;
  if(++count===180&&renderMs>36&&quality>.55){quality=.6;resize();}
  top+=(Number(state.view==='above')-top)*Math.min(1,dt*4);alt+=(state.altitude-alt)*Math.min(1,dt*4);
  gl!.uniform2f(uniforms.resolution,canvas.width,canvas.height);gl!.uniform2f(uniforms.drift,state.driftX,state.driftY);gl!.uniform1f(uniforms.altitude,alt);gl!.uniform1f(uniforms.yaw,state.yaw);gl!.uniform1f(uniforms.overhead,top);gl!.drawArrays(gl!.TRIANGLES,0,6);
 }
 frame=requestAnimationFrame(draw);
 return()=>{cancelAnimationFrame(frame);observer.disconnect();canvas.removeEventListener('webglcontextlost',lost);gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);};
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
