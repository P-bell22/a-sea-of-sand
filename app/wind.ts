export type SimState = {
 years:number;travel:number;driftX:number;driftY:number;grainTime:number;
 playing:boolean;speed:number;strength:number;altitude:number;view:string;yaw:number;
 direction:number;variableWind:boolean;windPhase:number;
};
export const makeState=():SimState=>({years:0,travel:0,driftX:0,driftY:0,grainTime:0,playing:true,speed:5,strength:1,altitude:310,view:'aerial',yaw:0,direction:60,variableWind:false,windPhase:0});
export function windAt(s:SimState,phase=s.windPhase){
 const angle=s.direction+(s.variableWind?55*Math.sin(phase)+12*Math.sin(phase*2):0);
 return {direction:((angle%360)+360)%360,strength:s.strength*(s.variableWind?.8+.2*Math.cos(phase*1.7):1)};
}
export function advanceSimulation(s:SimState,dt:number){
 if(!s.playing||dt<=0)return;
 if(s.view==='grain'){s.grainTime+=dt*s.speed/5*windAt(s).strength;return;}
 const years=dt*s.speed;
 const phaseStep=s.variableWind?years*2*Math.PI/120:0;
 const wind=windAt(s,s.windPhase+phaseStep/2);
 const dose=years*wind.strength,angle=wind.direction*Math.PI/180;
 // Integrate world-space displacement; changing direction changes the next
 // movement, never the position of the existing dune field.
 s.driftX+=dose*Math.sin(angle);s.driftY+=dose*Math.cos(angle);
 s.travel+=dose;s.years+=years;s.windPhase+=phaseStep;
}
export function resetSimulation(s:SimState){s.years=0;s.travel=0;s.driftX=0;s.driftY=0;s.grainTime=0;s.yaw=0;s.windPhase=0;}
