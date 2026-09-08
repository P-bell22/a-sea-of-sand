import type { SimState } from './wind';
type ToolInput={playing?:boolean;view?:string;speed?:number;strength?:number;altitude?:number;reset?:boolean;direction?:number;variableWind?:boolean};
export function validateSettings(input:unknown):ToolInput{
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Expected a settings object');
 const s=input as Record<string,unknown>;
 for(const key of Object.keys(s))if(!['playing','view','speed','strength','altitude','reset','direction','variableWind'].includes(key))throw new Error(`Unknown setting: ${key}`);
 for(const key of ['playing','reset','variableWind'])if(key in s&&typeof s[key]!=='boolean')throw new Error(`${key} must be boolean`);
 if('view' in s&&!['aerial','above','grain'].includes(s.view as string))throw new Error('Invalid viewpoint');
 for(const [key,min,max] of [['speed',1,50],['strength',0,2],['altitude',160,700],['direction',0,360]] as const){if(key in s&&(typeof s[key]!=='number'||!Number.isFinite(s[key])||Number(s[key])<min||Number(s[key])>max))throw new Error(`${key} must be between ${min} and ${max}`);}
 return s as ToolInput;
}
export function registerModelTools(read:()=>SimState,apply:(input:ToolInput)=>void){
 type Tool={name:string;description:string;inputSchema:object;annotations:object;execute:(input:unknown)=>unknown};
 const ctx=(document as Document & {modelContext?:{registerTool:(t:Tool,o:{signal:AbortSignal})=>unknown}}).modelContext;
 if(!ctx?.registerTool)return()=>{};const controller=new AbortController();
 const tool:Tool={name:'configure_dune_simulation',description:'Set dune simulation playback, viewpoint, time speed, sand transport, wind direction, automatic wind variation or altitude. Reset restarts the elapsed time and camera.',inputSchema:{type:'object',properties:{playing:{type:'boolean'},view:{type:'string',enum:['aerial','above','grain']},speed:{type:'number',minimum:1,maximum:50},strength:{type:'number',minimum:0,maximum:2},altitude:{type:'number',minimum:160,maximum:700},reset:{type:'boolean'},direction:{type:'number',minimum:0,maximum:360},variableWind:{type:'boolean'}},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:async(input)=>{apply(validateSettings(input));await new Promise(requestAnimationFrame);return {...read()};}};
 try{void Promise.resolve(ctx.registerTool(tool,{signal:controller.signal})).catch(()=>{});}catch{/* Optional browser capability. */}
 return()=>controller.abort();
}
