import { BlockPermutation, CommandPermissionLevel, CustomCommandStatus, ItemStack, Player, system, world } from "@minecraft/server";
import { BLOCK, STAFF, STATE_ON, TOP, find, forget, say } from "./lib.js";
import { listMenu, staffMenu, touch } from "./ui.js";
import { watch } from "./warp.js";
function neighbour(block, dy) { try { return dy > 0 ? block.above(dy) : block.below(-dy); } catch { return undefined; } }
function setAir(block) { try { block.setType("minecraft:air"); } catch {} }
function fitTop(base) { const up=neighbour(base,1); if(!up)return; let on=false; try{on=base.permutation.getState(STATE_ON)===true;}catch{} if(up.typeId===TOP){try{if(up.permutation.getState(STATE_ON)!==on)up.setPermutation(BlockPermutation.resolve(TOP,{[STATE_ON]:on}));}catch{};return;} if(up.isAir)try{up.setPermutation(BlockPermutation.resolve(TOP,{[STATE_ON]:on}));}catch{} }
function manualPlacementMessage(player) { if(player) system.run(()=>say(player,"§eKontrolní kámen se nepokládá ručně. Vzniká automaticky při postavení struktury pomocí Structure/Teleport Tool.")); }
system.beforeEvents.startup.subscribe((ev)=>{
  const registry=ev.blockComponentRegistry;
  registry?.registerCustomComponent("voxen:waystone",{beforeOnPlayerPlace(e){e.cancel=true;manualPlacementMessage(e.player);},onPlace(e){fitTop(e.block);},onTick(e){fitTop(e.block);},onPlayerInteract(e){if(e.player)system.run(()=>touch(e.player,e.dimension.id,e.block.location));}});
  registry?.registerCustomComponent("voxen:waystone_top",{onTick(e){if(neighbour(e.block,-1)?.typeId!==BLOCK)setAir(e.block);},onPlayerInteract(e){const base=neighbour(e.block,-1);if(e.player&&base?.typeId===BLOCK)system.run(()=>touch(e.player,e.dimension.id,base.location));}});
  const reg=ev.customCommandRegistry;if(!reg)return;
  const open=({sourceEntity:p})=>{if(!(p instanceof Player))return{status:CustomCommandStatus.Failure};system.run(()=>staffMenu(p));return{status:CustomCommandStatus.Success};};
  const giveTool=({sourceEntity:p})=>{if(!(p instanceof Player))return{status:CustomCommandStatus.Failure};system.run(()=>give(p,STAFF,"Structure/Teleport Tool"));return{status:CustomCommandStatus.Success};};
  const commands=[["voxen:structures","Otevře Structure/Teleport Tool",open],["voxen:structure_tool","Dá Structure/Teleport Tool",giveTool]];
  for(const [name,description,handler] of commands)try{reg.registerCommand({name,description,cheatsRequired:false,permissionLevel:CommandPermissionLevel.Any},handler);}catch{}
});
function give(player,id,label){const stack=new ItemStack(id,1);const container=player.getComponent("minecraft:inventory")?.container;try{const left=container?.addItem(stack);if(!left){say(player,`Dostal jsi: ${label}.`);return;}}catch{}try{player.dimension.spawnItem(stack,player.location);say(player,`Dostal jsi: ${label}.`);}catch{say(player,"Inventář je plný.");}}
function broke(e){const entry=find(e.dimension.id,e.block.location);if(entry)forget(entry);const up=neighbour(e.block,1);if(up?.typeId===TOP)setAir(up);}
world.afterEvents.playerBreakBlock.subscribe((e)=>{const id=e.brokenBlockPermutation?.type?.id;if(id===BLOCK)broke(e);else if(id===TOP){const base=neighbour(e.block,-1);if(base?.typeId===BLOCK){broke({...e,block:base});setAir(base);}}});
const heldTools = new Map();
const startUse = world.afterEvents.itemStartUse;
if (startUse?.subscribe) startUse.subscribe((e) => {
  if (e.itemStack?.typeId !== STAFF || !(e.source instanceof Player)) return;
  const id = e.source.id;
  const run = system.runTimeout(() => { heldTools.delete(id); staffMenu(e.source); }, 10);
  heldTools.set(id, run);
});
const stopUse = world.afterEvents.itemStopUse;
if (stopUse?.subscribe) stopUse.subscribe((e) => {
  if (!(e.source instanceof Player)) return;
  const run = heldTools.get(e.source.id);
  if (run !== undefined) { system.clearRun(run); heldTools.delete(e.source.id); }
});
if (!startUse?.subscribe) world.afterEvents.itemUse.subscribe((e) => {
  if (e.itemStack?.typeId === STAFF && e.source instanceof Player) system.run(() => staffMenu(e.source));
});
watch();
