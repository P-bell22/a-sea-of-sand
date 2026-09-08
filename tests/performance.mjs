import {performance} from 'node:perf_hooks';
const path=process.argv[2]||'../app/sediment.ts';
const {SandField}=await import(path);
let start=performance.now();const field=new SandField();const startup=performance.now()-start;
const timings={sample:0,deposit:0,windShadow:0,creep:0,relax:0};
// Profile whole passes only: per-sample instrumentation would distort hot loops.
for(const key of ['windShadow','creep','relax']){const original=field[key];field[key]=function(...args){const t=performance.now();const r=original.apply(this,args);timings[key]+=performance.now()-t;return r;};}
start=performance.now();for(let i=0;i<30;i++)field.step(1,60);const steady=performance.now()-start;
const steadyParts={...timings};
start=performance.now();for(let i=0;i<30;i++)field.step(2,60+70*Math.sin(i*.04));const varied=performance.now()-start;
console.log(JSON.stringify({startupMs:startup,steadyStepMs:steady/30,strongVariableStepMs:varied/30,steadyPartsMs:steadyParts,totalPartsMs:timings,stats:field.stats()},null,2));
