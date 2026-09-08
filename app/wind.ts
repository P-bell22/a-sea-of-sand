import { SandField } from './sediment';
export const MAX_SIMULATION_SPEED=1000;
export type SimState={
 cycles:number;pending:number;grainTime:number;playing:boolean;speed:number;strength:number;
 altitude:number;view:string;yaw:number;direction:number;variableWind:boolean;windPhase:number;
 model:SandField|null;
};
export const makeState=():SimState=>({cycles:0,pending:0,grainTime:0,playing:true,speed:5,strength:1,altitude:260,view:'aerial',yaw:0,direction:60,variableWind:false,windPhase:0,model:null});
export function windAt(s:SimState,phase=s.windPhase){const angle=s.direction+(s.variableWind?55*Math.sin(phase)+12*Math.sin(phase*2):0);return {direction:((angle%360)+360)%360,strength:s.strength*(s.variableWind?.8+.2*Math.cos(phase*1.7):1)};}
export function advanceSimulation(s:SimState,dt:number){
 if(!s.playing||dt<=0)return;
 if(s.view==='grain'){const w=windAt(s);s.grainTime+=dt*s.speed/5*(w.strength>.3?w.strength:0);return;}
 s.model??=new SandField();
 s.pending=Math.min(Math.max(3,s.speed*.1),s.pending+dt*s.speed);
 // Batch inexpensive steps for high targets, yielding between batches so
 // controls remain responsive. A costly individual step is never truncated.
 const deadline=performance.now()+8;
 while(s.pending>=1){const w=windAt(s);s.model.step(w.strength,w.direction);s.pending-=1;s.cycles++;if(s.variableWind)s.windPhase+=2*Math.PI/240;if(performance.now()>=deadline)break;}
}
export function resetSimulation(s:SimState){s.cycles=0;s.pending=0;s.grainTime=0;s.yaw=0;s.windPhase=0;s.model?.reset();}
