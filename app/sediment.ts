/** Reduced bulk-sediment model inspired by Werner (1995).
 * The grid stores sand thickness in metres above non-erodible, level ground.
 * Every erosion, deposition, creep and avalanche transfer is explicitly balanced.
 * Periodic boundaries represent a continuous desert: outgoing sand re-enters opposite edges.
 * Transport cycles are model units, not calibrated calendar years.
 */
export const GRID_SIZE=256;
export const CELL_SIZE=6;
export const FIELD_SIZE=GRID_SIZE*CELL_SIZE;
export const REPOSE=Math.tan(32*Math.PI/180);
const SHADOW_SLOPE=Math.tan(15*Math.PI/180);
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export type FieldStats={volume:number;exported:number;initial:number;balanceError:number;maxHeight:number;bareFraction:number;cycles:number};
export class SandField{
 readonly size:number;readonly cell:number;readonly height:Float64Array;
 private delta:Float64Array;private shelter:Float64Array;
 readonly initialHeight:Float64Array;
 version=0;cycles=0;exported=0;initialVolume=0;
 constructor(size=GRID_SIZE,cell=CELL_SIZE,seed=true){
  this.size=size;this.cell=cell;this.height=new Float64Array(size*size);this.delta=new Float64Array(size*size);this.shelter=new Float64Array(size*size);
  if(seed)this.seedDunes();
  this.relax(80);this.initialHeight=this.height.slice();this.initialVolume=this.volume();
 }
 private seedDunes(){
  // Irregular, finite initial sand bodies. Their shapes are starting conditions,
  // never translated as rigid shapes or prescribed during evolution.
  let randomState=3719;
  const random=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;};
  const seeds:number[][]=[];
  for(let z=0;z<7;z++)for(let x=0;x<7;x++)seeds.push([
   (x+.5+(random()-.5)*.85)*FIELD_SIZE/7-FIELD_SIZE/2,
   (z+.5+(random()-.5)*.85)*FIELD_SIZE/7-FIELD_SIZE/2,
   23+random()*26,.82+random()*.45
  ]);
  const domain=this.size*this.cell,scale=domain/FIELD_SIZE;
  for(let j=0;j<seeds.length;j++){
   const [cx0,cz0,H0,wide]=seeds[j];const cx=cx0*scale,cz=cz0*scale,H=H0*scale;
   const angle=(60+(j%5-2)*5)*Math.PI/180,dx=Math.sin(angle),dz=Math.cos(angle),W=H*3.7*wide;
   for(let z=0;z<this.size;z++)for(let x=0;x<this.size;x++){
    let px=(x+.5)*this.cell-domain/2-cx,pz=(z+.5)*this.cell-domain/2-cz;
    px-=Math.round(px/domain)*domain;pz-=Math.round(pz/domain)*domain;
    const along=px*dx+pz*dz,cross=px*dz-pz*dx,a=cross/W;
    if(Math.abs(a)>=1)continue;
    const crown=H*Math.pow(1-a*a,.75),crest=W*.8*a*a;
    const u=along-crest,up=crown/.17,down=crown/REPOSE;
    let h=0;
    if(u<0&&u>-up){const f=1+u/up;h=crown*(.4*f+.6*f*f);}
    else if(u>=0&&u<down)h=crown*(1-u/down);
    // Round only the immediate crest and taper toes into the bare plain.
    h=Math.max(0,h-.45*scale);
    const i=z*this.size+x;this.height[i]+=h;
   }
  }
 }
 volume(){let sum=0;for(const h of this.height)sum+=h;return sum*this.cell*this.cell;}
 stats():FieldStats{let maxHeight=0,bare=0;for(const h of this.height){maxHeight=Math.max(maxHeight,h);if(h<.1)bare++;}const volume=this.volume();return {volume,exported:this.exported,initial:this.initialVolume,balanceError:volume+this.exported-this.initialVolume,maxHeight,bareFraction:bare/this.height.length,cycles:this.cycles};}
 reset(){this.height.set(this.initialHeight);this.exported=0;this.cycles=0;this.version++;}
 private sample(a:Float64Array,x:number,z:number){
  x=((x%this.size)+this.size)%this.size;z=((z%this.size)+this.size)%this.size;
  const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz,n=this.size;
  const x1=(ix+1)%n,z1=(iz+1)%n;
  return (a[iz*n+ix]*(1-fx)+a[iz*n+x1]*fx)*(1-fz)+(a[z1*n+ix]*(1-fx)+a[z1*n+x1]*fx)*fz;
 }
 private windShadow(dx:number,dz:number){
  const n=this.size,h=this.height,s=this.shelter;
  // Two sweeps carry the upwind envelope across the periodic boundary.
  s.set(h);
  // Crosswind interpolation avoids locking shadows to 8 winds.
  if(Math.abs(dx)>=Math.abs(dz)){
   const sign=dx>=0?1:-1,offset=dz/Math.abs(dx),drop=this.cell/Math.abs(dx)*SHADOW_SLOPE;
   for(let k=0;k<2*n;k++){const x=sign>0?k%n:n-1-k%n;for(let z=0;z<n;z++){const i=z*n+x;s[i]=Math.max(h[i],this.sample(s,x-sign,z-offset)-drop);}}
  }else{
   const sign=dz>=0?1:-1,offset=dx/Math.abs(dz),drop=this.cell/Math.abs(dz)*SHADOW_SLOPE;
   for(let k=0;k<2*n;k++){const z=sign>0?k%n:n-1-k%n;for(let x=0;x<n;x++){const i=z*n+x;s[i]=Math.max(h[i],this.sample(s,x-offset,z-sign)-drop);}}
  }
 }
 private deposit(x:number,z:number,amount:number){
  const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz,n=this.size;
  for(let oz=0;oz<=1;oz++)for(let ox=0;ox<=1;ox++){
   const part=amount*(ox?fx:1-fx)*(oz?fz:1-fz),xx=((ix+ox)%n+n)%n,zz=((iz+oz)%n+n)%n;
   this.delta[zz*n+xx]+=part;
  }
 }
 step(strength:number,direction:number){
  this.cycles++;
  // A dimensionless transport law with a threshold and nonlinear response.
  // It is not a calibrated conversion from wind speed to sediment flux.
  const transport=strength>.3?strength*(strength*strength-.09)/.91:0;
  if(transport<=0)return;
  const theta=direction*Math.PI/180,dx=Math.sin(theta),dz=Math.cos(theta),n=this.size;
  this.windShadow(dx,dz);this.delta.fill(0);
  const h=this.height,sh=this.shelter,hop=2.5;
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){
   const i=z*n+x;if(h[i]<=0||sh[i]>h[i]+.08)continue;
   const up=this.sample(h,x-dx,z-dz),down=this.sample(h,x+dx,z+dz);
   const slope=(down-up)/(2*this.cell);
   const erosion=Math.min(h[i],.12*transport*clamp(1+1.5*slope,.3,1.8));
   this.delta[i]-=erosion;
   let remaining=erosion,tx=x,tz=z;
   for(let k=0;k<14;k++){
    tx+=dx*hop;tz+=dz*hop;
    tx=(tx+n)%n;tz=(tz+n)%n;
    const surface=this.sample(h,tx,tz),shadow=this.sample(sh,tx,tz);
    const probability=shadow>surface+.08?.97:surface>.08?.55:.08;
    const landed=k===13?remaining:remaining*probability;
    this.deposit(tx,tz,landed);remaining-=landed;
   }
  }
  for(let i=0;i<h.length;i++)h[i]+=this.delta[i];
  // Conservative slope-driven surface creep, followed by repose-limited slides.
  this.creep(Math.min(.018,.006*transport));
  this.relax(48);this.version++;
 }
 private creep(k:number){
  const n=this.size,h=this.height;
  this.delta.fill(0);
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){
   const i=z*n+x;
   const right=z*n+(x+1)%n,below=((z+1)%n)*n+x;
   const qx=(h[i]-h[right])*k,qz=(h[i]-h[below])*k;
   this.delta[i]-=qx+qz;this.delta[right]+=qx;this.delta[below]+=qz;
  }
  for(let i=0;i<h.length;i++)h[i]+=this.delta[i];
 }
 relax(maxPasses=32){
  const n=this.size,h=this.height,limit=this.cell*REPOSE;
  const neighbors=[[1,0,limit],[0,1,limit],[1,1,limit*Math.SQRT2],[-1,1,limit*Math.SQRT2]];
  for(let pass=0;pass<maxPasses;pass++){
   let worst=0;
   for(let zz=0;zz<n;zz++)for(let xx=0;xx<n;xx++){
    const x=pass%2?n-1-xx:xx,z=pass%2?n-1-zz:zz,i=z*n+x;
    for(const [ox,oz,max] of neighbors){const nx=(x+ox+n)%n,nz=(z+oz+n)%n;const j=nz*n+nx,d=h[i]-h[j],excess=Math.abs(d)-max;if(excess<=.002)continue;
     worst=Math.max(worst,excess);const source=d>0?i:j,dest=d>0?j:i,move=Math.min(h[source],excess*.5);h[source]-=move;h[dest]+=move;
    }
   }
   if(worst<.005)break;
  }
 }
 /** Pack metres into two colour channels. Linear texture interpolation remains
  * linear in height, and the rendered grid is the actual simulated sand field. */
 pack(target:Uint8Array){for(let i=0;i<this.height.length;i++){const v=Math.round(clamp(this.height[i],0,255)*256);target[i*4]=v>>8;target[i*4+1]=v&255;target[i*4+2]=0;target[i*4+3]=255;}return target;}
}
