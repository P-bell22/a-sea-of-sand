import assert from 'node:assert/strict';
import {SandField,REPOSE} from '../app/sediment.ts';

function invariants(field,label){
 const s=field.stats();
 assert.ok(Math.abs(s.balanceError)<Math.max(1e-7,s.initial*1e-10),`${label}: mass balance ${s.balanceError}`);
 assert.ok(field.height.every(h=>Number.isFinite(h)&&h>=-1e-10),`${label}: nonnegative finite sand`);
 let excess=0;
 for(let z=0;z<field.size;z++)for(let x=0;x<field.size;x++)for(const [dx,dz] of [[1,0],[0,1],[1,1],[-1,1]]){
  if(x+dx<0||x+dx>=field.size||z+dz>=field.size)continue;
  excess=Math.max(excess,Math.abs(field.height[z*field.size+x]-field.height[(z+dz)*field.size+x+dx])-field.cell*Math.hypot(dx,dz)*REPOSE);
 }
 assert.ok(excess<.02,`${label}: repose excess ${excess} m`);
 return {relativeMassError:s.balanceError/s.initial,maxSlopeExcessM:excess,exportedM3:s.exported};
}
const f=new SandField();
const initial=f.height.slice();
for(const strength of [0,.3]){f.step(strength,60);assert.deepEqual(f.height,initial);}
for(let i=0;i<120;i++)f.step(i%30<10?2:1,60+70*Math.sin(i*.04));
console.log('Varying winds:',invariants(f,'varying winds'));
f.reset();assert.deepEqual(f.height,initial);assert.equal(f.exported,0);assert.equal(f.cycles,0);

function mound(H){
 const m=new SandField(96,3,false);
 for(let z=0;z<m.size;z++)for(let x=0;x<m.size;x++)m.height[z*m.size+x]=Math.max(0,H-.2*Math.hypot((x-48)*m.cell,(z-48)*m.cell));
 m.relax(80);m.initialVolume=m.volume();return m;
}
function centroid(m){let sx=0,sz=0,total=0;for(let z=0;z<m.size;z++)for(let x=0;x<m.size;x++){const h=m.height[z*m.size+x];sx+=x*h;sz+=z*h;total+=h;}return [sx/total*m.cell,sz/total*m.cell];}
for(const bearing of [0,90,180,270]){
 const m=mound(12),before=centroid(m);
 for(let i=0;i<20;i++)m.step(1,bearing);
 const after=centroid(m),theta=bearing*Math.PI/180;
 const along=(after[0]-before[0])*Math.sin(theta)+(after[1]-before[1])*Math.cos(theta);
 assert.ok(along>0,`centroid must move downwind at ${bearing}°`);
 invariants(m,`bearing ${bearing}`);
 console.log(`Wind toward ${bearing}°: centroid moved ${along.toFixed(2)} m downwind`);
}
const travel=[];
for(const H of [6,15]){const m=mound(H),before=centroid(m);for(let i=0;i<25;i++)m.step(1,90);travel.push(centroid(m)[0]-before[0]);}
assert.ok(travel[0]>travel[1],'smaller isolated mound should migrate faster');
console.log('Small / large mound centroid displacement:',travel);
const empty=new SandField(32,6,false);empty.step(2,90);assert.equal(empty.volume(),0);assert.equal(empty.exported,0);
const edge=new SandField(32,6,false);edge.height[16*32+31]=2;edge.initialVolume=edge.volume();edge.step(2,90);assert.ok(edge.exported>0);invariants(edge,'open boundary');
console.log('PASS: conservation, finite nonnegative sand, repose, calm threshold, reset, wind direction, relative migration and open boundary export.');
