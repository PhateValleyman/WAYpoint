import { system } from "@minecraft/server";
import { ActionFormData, FormCancelationReason, ModalFormData } from "@minecraft/server-ui";
import { all, cleanName, dimName, distance, find, forget, isFavorite, paint, probe, say, toggleFavorite } from "./lib.js";
import { STYLES, activate, portalSoundOn, preview, setPortalSound, setStyle, styleOf } from "./sound.js";
import { travel, warping } from "./warp.js";
import { createStructure, formatSize, loadAt, mirrors, moveStructure, orientedSize, pageSize, removeStructureCompletely, renameStructure, rotations, structureLabel, structures, structuresInWorld } from "./structure.js";
const ICON={
  build:"textures/ui/structure_icon", structure:"textures/ui/structure_icon", control:"textures/blocks/waystone_on",
  teleport:"textures/items/ender_pearl", move:"textures/items/compass", rotate:"textures/ui/structure_rotate", mirror:"textures/ui/flip_vertical",
  replace:"textures/ui/structure_replace", settings:"textures/ui/settings_glyph_color_2x", rename:"textures/items/name_tag",
  remove:"textures/ui/icon_trash", close:"textures/ui/cancel", back:"textures/ui/arrow_dark_left_stretch",
  keep:"textures/ui/check", sounds:"textures/ui/sound_glyph_2x", on:"textures/ui/toggle_on", off:"textures/ui/toggle_off"
};
const DIM_ICON={"minecraft:overworld":"textures/blocks/grass_side_carried","minecraft:nether":"textures/blocks/netherrack","minecraft:the_end":"textures/blocks/end_stone"};
const dimIcon=d=>DIM_ICON[d]??ICON.structure;
const sleep=t=>new Promise(r=>system.runTimeout(r,t));
async function show(form,player,tries=8){for(let i=0;i<tries;i++){const r=await form.show(player);if(r.canceled&&r.cancelationReason===FormCancelationReason.UserBusy){await sleep(10);continue;}return r;}return{canceled:true};}
export async function touch(player,dimId,location){if(warping(player))return;const entry=find(dimId,location);if(!entry){say(player,"Tento kámen vzniká automaticky jako součást struktury. Použij Structure/Teleport Tool.");return;}activate(player,player.dimension,entry);await structureMenu(player,entry);}
function structureLabelWorld(e){return `${e.n}\n§8${e.s?.id??"Struktura"} · ${dimName(e.d)} · ${distance({x:0,y:0,z:0},e)} souřadnic`}
export async function staffMenu(player){
  if(warping(player))return;
  const form=new ActionFormData().title("Structure / Teleport Tool").body("◆   ◈   ⚙   ✖").button("Teleport",ICON.teleport).button("Budování",ICON.build).button("Nastavení",ICON.settings).button("Exit",ICON.close);
  const r=await show(form,player); if(r.canceled)return;
  if(r.selection===0)await teleportMenu(player);
  else if(r.selection===1)await buildingMenu(player);
  else if(r.selection===2)await settingsMenu(player,()=>staffMenu(player));
}
async function teleportMenu(player){
  const entries=structuresInWorld();
  const form=new ActionFormData().title("Teleport").body(`Uložená místa: ${entries.length}`).button("«",ICON.back);
  for(const e of entries)form.button(`${e.n}\n§8${dimName(e.d)}`,dimIcon(e.d));
  const r=await show(form,player); if(r.canceled||r.selection===0)return;
  const entry=entries[r.selection-1]; if(entry)await travel(player,entry);
}
async function buildingMenu(player){
  const form=new ActionFormData().title("Budování").body("Vyber katalog struktur nebo oblíbené šablony.").button("Oblíbené",ICON.keep).button("Všechny struktury",ICON.build).button("«",ICON.back);
  const r=await show(form,player); if(r.canceled||r.selection===2)return;
  await buildBrowser(player,r.selection===0);
}
async function buildBrowser(player,favoriteOnly){
  const list=structures().filter(item=>!favoriteOnly||isFavorite(item.id));
  const pages=Math.max(1,Math.ceil(list.length/pageSize())); let page=0;
  while(true){
    const slice=list.slice(page*pageSize(),(page+1)*pageSize());
    const form=new ActionFormData().title(favoriteOnly?"Oblíbené":"Struktury").body(`${list.length} položek · strana ${page+1}/${pages}`).button("«",ICON.back);
    for(const item of slice)form.button(`${isFavorite(item.id)?"★":"☆"} ${structureLabel(item)}`,item.icon??ICON.structure);
    if(page>0)form.button("‹",ICON.back); if(page+1<pages)form.button("›",ICON.build);
    const r=await show(form,player); if(r.canceled||r.selection===0)return;
    const selected=r.selection-1;
    if(selected>=0&&selected<slice.length){await buildChoice(player,slice[selected],favoriteOnly);return;}
    const after=selected-slice.length; if(page>0&&after===0){page--;continue;} if(page+1<pages&&after===(page>0?1:0)){page++;continue;} return;
  }
}
async function buildChoice(player,item,favoriteOnly){
  const form=new ActionFormData().title(`◆ ${item.name}`).body(formatSize(item.size)).button("Postavit",ICON.build).button(isFavorite(item.id)?"★ Oblíbené":"☆ Uložit do oblíbených",ICON.keep).button("«",ICON.back);
  const r=await show(form,player); if(r.canceled||r.selection===2)return;
  if(r.selection===1){toggleFavorite(item.id);say(player,isFavorite(item.id)?"§aUloženo do oblíbených.":"§eOdebráno z oblíbených.");return;}
  if(r.selection===0){try{const made=createStructure(player.dimension.id,{x:Math.floor(player.location.x),y:Math.floor(player.location.y),z:Math.floor(player.location.z)},item.id);say(player,`§aPostaveno: §f${item.name}`);await editStructureMenu(player,made);}catch{say(player,"§cStrukturu se nepodařilo postavit.");}}
}
async function structureMenu(player,entry){if(entry){if(probe(entry)==="gone"){forget(entry);say(player,"Kontrolní kámen struktury chybí, záznam byl odstraněn.");return;}paint(entry,true);}const list=structures();const pages=Math.max(1,Math.ceil(list.length/pageSize()));let page=0;while(true){if(entry){const form=new ActionFormData().title(`◆ ${entry.n}`).body("◆").button("Teleport",ICON.teleport).button("Ovládat",ICON.control).button("«",ICON.back);const r=await show(form,player);if(r.canceled||r.selection===2)return;if(r.selection===0){await travel(player,entry);return;}if(r.selection===1){await editStructureMenu(player,entry);return;}}const slice=list.slice(page*pageSize(),(page+1)*pageSize());const form=new ActionFormData().title("Postavit strukturu").body(`Každá stavba dostane automatický kontrolní kámen na rohu.\n${list.length} struktur · strana ${page+1}/${pages}`).button("« Zpět",ICON.back);for(const item of slice)form.button(structureLabel(item),item.icon??ICON.structure);if(page>0)form.button("‹ Předchozí");if(page+1<pages)form.button("Další ›");const r=await show(form,player);if(r.canceled||r.selection===0)return;const selected=r.selection-1;if(selected>=0&&selected<slice.length){const item=slice[selected];try{const made=createStructure(player.dimension.id,{x:Math.floor(player.location.x),y:Math.floor(player.location.y),z:Math.floor(player.location.z)},item.id);say(player,`§aPostaveno: §f${item.name}`);await editStructureMenu(player,made);}catch{say(player,"§cStrukturu se nepodařilo postavit.");}return;}const after=selected-slice.length;if(page>0&&after===0){page--;continue;}if(page+1<pages&&after===(page>0?1:0)){page++;continue;}return;}}
async function editStructureMenu(player,entry){if(!entry?.s)return;const form=new ActionFormData().title(`◆ ${entry.n}`).body("◆   ◈   ⚙   ↔   ✎   ✖").button("Teleport",ICON.teleport).button("Přesun",ICON.move).button("Otočit",ICON.rotate).button("Zrcadlit",ICON.mirror).button("Vyměnit",ICON.replace).button("Název",ICON.rename).button("Odstranit",ICON.remove).button("«",ICON.back);const r=await show(form,player);if(r.canceled||r.selection===7)return;if(r.selection===0){await travel(player,entry);return;}if(r.selection===1){await movePreviewMenu(player,entry);}else if(r.selection===2||r.selection===3){const values=r.selection===2?rotations():mirrors();const icons=r.selection===2?[ICON.rotate,ICON.rotate,ICON.rotate,ICON.rotate]:[ICON.mirror,ICON.mirror,ICON.mirror,ICON.mirror];const pick=await choose(player,r.selection===2?"Otočení":"Zrcadlení",values,icons);if(pick>=0){if(r.selection===2)await rotationPreviewMenu(player,entry,pick);else try{loadAt(entry,entry.s.id,entry.s.r??0,pick);}catch{say(player,"§cÚprava se nepodařila.");}}}else if(r.selection===4){await chooseStructure(player,entry);return;}else if(r.selection===5){const f=new ModalFormData().title("Pojmenovat strukturu").textField("Název","např. Domov",entry.n);const q=await show(f,player);if(!q.canceled){const n=cleanName(q.formValues?.[0]);if(n){renameStructure(entry,n);say(player,`§aStruktura se nyní jmenuje ${n}.`);}}}else if(r.selection===6){const q=new ActionFormData().title("✖").body("✖").button("Ano",ICON.remove).button("Ne",ICON.keep);const c=await show(q,player);if(!c.canceled&&c.selection===0){removeStructureCompletely(entry);say(player,"§aStruktura i kontrolní kámen byly odstraněny.");}}}
function drawPreview(dimension, origin, size) {
  const points = [];
  const maxX = origin.x + size.x - 1, maxY = origin.y + size.y - 1, maxZ = origin.z + size.z - 1;
  const addEdge = (a, b) => {
    const steps = Math.max(Math.abs(b.x-a.x), Math.abs(b.y-a.y), Math.abs(b.z-a.z));
    const denominator = steps || 1;
    for (let i=0; i<=steps; i+=Math.max(1, Math.ceil(steps/12))) points.push({x:a.x+(b.x-a.x)*i/denominator+.5,y:a.y+(b.y-a.y)*i/denominator+.5,z:a.z+(b.z-a.z)*i/denominator+.5});
  };
  const c = [[origin.x,origin.y,origin.z],[maxX,origin.y,origin.z],[origin.x,origin.y,maxZ],[maxX,origin.y,maxZ],[origin.x,maxY,origin.z],[maxX,maxY,origin.z],[origin.x,maxY,maxZ],[maxX,maxY,maxZ]].map(([x,y,z])=>({x,y,z}));
  [[0,1],[0,2],[1,3],[2,3],[4,5],[4,6],[5,7],[6,7],[0,4],[1,5],[2,6],[3,7]].forEach(([a,b])=>addEdge(c[a],c[b]));
  for (const point of points) { try { dimension.spawnParticle("minecraft:end_rod", point); } catch {} }
  try { dimension.spawnParticle("minecraft:totem_particle", {x:origin.x+.5,y:origin.y+1.5,z:origin.z+.5}); } catch {}
}
async function rotationPreviewMenu(player,entry,rotation){
  const size=orientedSize(entry.s.id,rotation); if(!size)return;
  const dim=player.dimension; if(dim.id!==entry.d){say(player,"§cOtočení musí proběhnout ve stejné dimenzi jako struktura.");return;}
  let ticks=0; const preview=system.runInterval(()=>{if(ticks++>100){system.clearRun(preview);return;}drawPreview(dim,{x:entry.x,y:entry.y,z:entry.z},size);},5);
  const form=new ActionFormData().title("Otočit").body("Hologram ukazuje nový tvar struktury.\nPotvrdit otočení?").button("Ano",ICON.keep).button("Ne",ICON.close);
  const result=await show(form,player); system.clearRun(preview); if(result.canceled||result.selection!==0)return;
  try{loadAt(entry,entry.s.id,rotation,entry.s.m??0);say(player,"§aOtočení potvrzeno.");}catch{say(player,"§cOtočení se nepodařilo.");}
}
async function movePreviewMenu(player, entry) {
  if(player.dimension.id!==entry.d){say(player,"§cPřesun musí proběhnout ve stejné dimenzi jako struktura.");return;}
  const target = {x:Math.floor(player.location.x),y:Math.floor(player.location.y),z:Math.floor(player.location.z)};
  let ticks = 0;
  const preview = system.runInterval(() => { if (ticks++ > 100) { system.clearRun(preview); return; } drawPreview(player.dimension, target, entry.s.size); }, 5);
  const form = new ActionFormData().title("Přesunout").body("Hologram ukazuje novou pozici.\nPotvrdit přesun?").button("Ano", ICON.keep).button("Ne", ICON.close);
  const result = await show(form, player);
  system.clearRun(preview);
  if (result.canceled || result.selection !== 0) return;
  try { moveStructure(entry, target); say(player,"§aStruktura přesunuta na holografickou pozici."); } catch { say(player,"§cPřesun se nepodařil."); }
}
async function chooseStructure(player, entry) {
  const list = structures();
  const pages = Math.max(1, Math.ceil(list.length / pageSize()));
  let page = 0;
  while (true) {
    const slice = list.slice(page * pageSize(), (page + 1) * pageSize());
    const form = new ActionFormData().title("Změnit strukturu").body("Vyber novou stavbu pro tento kontrolní kámen.").button("« Zpět", ICON.back);
    for (const item of slice) form.button(structureLabel(item), item.icon ?? ICON.structure);
    if (page > 0) form.button("‹ Předchozí");
    if (page + 1 < pages) form.button("Další ›");
    const r = await show(form, player);
    if (r.canceled || r.selection === 0) return;
    const selected = r.selection - 1;
    if (selected >= 0 && selected < slice.length) {
      try { loadAt(entry, slice[selected].id); say(player, `§aStruktura změněna na: §f${slice[selected].name}`); }
      catch { say(player, "§cStrukturu se nepodařilo změnit."); }
      return;
    }
    const after = selected - slice.length;
    if (page > 0 && after === 0) { page--; continue; }
    if (page + 1 < pages && after === (page > 0 ? 1 : 0)) { page++; continue; }
    return;
  }
}
async function choose(player,title,values,icons=[]){const f=new ActionFormData().title(title).body(title==="Otočení"?"↻   ↻   ↻   ↻":"◇   ◇   ◇   ◇");for(let i=0;i<values.length;i++)f.button(values[i],icons[i]??ICON.settings);const r=await show(f,player);return r.canceled?-1:r.selection;}
async function settingsMenu(player,back){const current=styleOf(player),other=current==="cinematic"?"classic":"cinematic",portal=portalSoundOn(player);const f=new ActionFormData().title("Nastavení").button(`Zvuky teleportace\n${STYLES[current].tag}: ${STYLES[current].name}`,ICON.sounds);if(current==="classic")f.button(`Zvuk portálu ${portal?"§a(ZAP)":"§c(VYP)"}`,portal?ICON.on:ICON.off);f.button("Zpět",ICON.back);const r=await show(f,player);if(r.canceled)return;if(r.selection===0){setStyle(player,other);preview(player,other);return settingsMenu(player,back);}if(current==="classic"&&r.selection===1){setPortalSound(player,!portal);return settingsMenu(player,back);}return back();}
export async function listMenu(player){await staffMenu(player);}
