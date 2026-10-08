import { BlockPermutation, world } from "@minecraft/server";
export const BLOCK = "voxen:waystone";
export const STAFF = "voxen:waystone_staff";
export const TOP = "voxen:waystone_top";
export const STATE_ON = "voxen:on";
const PROP = "voxen:structures";
export const MAX_STONES = 256;
export const DIM_NAME = { "minecraft:overworld":"Overworld", "minecraft:nether":"Nether", "minecraft:the_end":"End" };
let cache;
export function all() { if (cache) return cache; try { const raw=world.getDynamicProperty(PROP); cache=raw?JSON.parse(raw):[]; } catch { cache=[]; } if(!Array.isArray(cache)) cache=[]; cache=cache.filter(e=>e&&e.d&&Number.isInteger(e.x)&&Number.isInteger(e.y)&&Number.isInteger(e.z)); return cache; }
export function save() { try { world.setDynamicProperty(PROP,JSON.stringify(all())); } catch {} }
export function dimOf(id) { try{return world.getDimension(id);}catch{return undefined;} }
export function dimName(id) { return DIM_NAME[id]??id.replace("minecraft:",""); }
export function find(d,loc) { const x=Math.floor(loc.x),y=Math.floor(loc.y),z=Math.floor(loc.z); return all().find(e=>e.d===d&&e.x===x&&e.y===y&&e.z===z); }
export function add(d,loc,name="Struktura") { const e={d,x:Math.floor(loc.x),y:Math.floor(loc.y),z:Math.floor(loc.z),n:name}; all().push(e); save(); return e; }
export function forget(e) { const list=all(),i=list.indexOf(e); if(i>=0)list.splice(i,1); save(); }
export function cleanName(raw) { return String(raw??"").replace(/[§\n\r\t]/g," ").trim().slice(0,48); }
export function paint(e,on) { try { const b=dimOf(e.d)?.getBlock({x:e.x,y:e.y,z:e.z}); if(b?.typeId!==BLOCK)return; b.setPermutation(BlockPermutation.resolve(BLOCK,{[STATE_ON]:on})); const u=b.above(); if(u?.typeId===TOP)u.setPermutation(BlockPermutation.resolve(TOP,{[STATE_ON]:on})); }catch{} }
export function probe(e) { try { const b=dimOf(e.d)?.getBlock({x:e.x,y:e.y,z:e.z}); return !b?"unknown":b.typeId===BLOCK?"here":"gone"; }catch{return "unknown";} }
const AROUND=[[0,-1],[0,1],[-1,0],[1,0],[-1,-1],[1,-1],[-1,1],[1,1]];
function standable(dim,x,y,z){const f=dim.getBlock({x,y,z}),h=dim.getBlock({x,y:y+1,z}),fl=dim.getBlock({x,y:y-1,z});return !!f&&!!h&&!!fl&&f.isAir&&h.isAir&&!fl.isAir&&!fl.isLiquid;}
export function arrival(e){const dim=dimOf(e.d);if(!dim)return;for(const [dx,dz] of AROUND){try{if(standable(dim,e.x+dx,e.y,e.z+dz))return{at:{x:e.x+dx+.5,y:e.y,z:e.z+dz+.5},yaw:Math.atan2(dx,-dz)*180/Math.PI};}catch{return;}}}
export function perch(e){return{x:e.x+.5,y:e.y+2,z:e.z+.5};}
export function distance(from,e){return Math.round(Math.hypot(from.x-e.x,from.y-e.y,from.z-e.z));}
export function say(p,t){try{p.sendMessage(t);}catch{}}
export function tip(p,t){try{p.onScreenDisplay.setActionBar(t);}catch{}}
export function alive(x){try{return typeof x.isValid==="function"?x.isValid():x.isValid!==false;}catch{return false;}}
