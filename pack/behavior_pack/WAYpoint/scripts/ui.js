import { system } from "@minecraft/server";
import { ActionFormData, FormCancelationReason, ModalFormData } from "@minecraft/server-ui";
import { all, cleanName, dimName, distance, find, forget, paint, probe, save, say } from "./lib.js";
import { STYLES, activate, portalSoundOn, preview, setPortalSound, setStyle, styleOf } from "./sound.js";
import { travel, warping } from "./warp.js";
import { createStructure, formatSize, loadAt, mirrors, moveStructure, pageSize, rebuild, removeStructureCompletely, renameStructure, rotations, structureLabel, structures, structuresInWorld } from "./structure.js";
const ICON={
  build:"textures/ui/structure_icon", structure:"textures/ui/structure_icon", control:"textures/blocks/waystone_on",
  teleport:"textures/items/ender_pearl", move:"textures/items/compass", rotate:"textures/ui/rotate", mirror:"textures/ui/flip_vertical",
  replace:"textures/ui/refresh", settings:"textures/ui/settings_glyph_color_2x", rename:"textures/items/name_tag",
  remove:"textures/ui/icon_trash", close:"textures/ui/cancel", back:"textures/ui/arrow_dark_left_stretch",
  keep:"textures/ui/check", sounds:"textures/ui/sound_glyph_2x", on:"textures/ui/toggle_on", off:"textures/ui/toggle_off"
};
const DIM_ICON={"minecraft:overworld":"textures/blocks/grass_side_carried","minecraft:nether":"textures/blocks/netherrack","minecraft:the_end":"textures/blocks/end_stone"};
const dimIcon=d=>DIM_ICON[d]??ICON.structure;
const sleep=t=>new Promise(r=>system.runTimeout(r,t));
async function show(form,player,tries=8){for(let i=0;i<tries;i++){const r=await form.show(player);if(r.canceled&&r.cancelationReason===FormCancelationReason.UserBusy){await sleep(10);continue;}return r;}return{canceled:true};}
export async function touch(player,dimId,location){if(warping(player))return;const entry=find(dimId,location);if(!entry){say(player,"Tento kámen vzniká automaticky jako součást struktury. Použij Structure/Teleport Tool.");return;}activate(player,player.dimension,entry);await structureMenu(player,entry);}
function structureLabelWorld(e){return `${e.n}\n§8${e.s?.id??"Struktura"} · ${dimName(e.d)} · ${distance({x:0,y:0,z:0},e)} souřadnic`}
export async function staffMenu(player){if(warping(player))return;const entries=structuresInWorld();const form=new ActionFormData().title("Structure / Teleport Tool").body(`Vyber strukturu k teleportu nebo ji spravuj.\nStruktur: ${entries.length}`).button("Postavit novou strukturu",ICON.build);for(const e of entries)form.button(structureLabelWorld(e),dimIcon(e.d));form.button("Nastavení",ICON.settings).button("Zavřít",ICON.close);const r=await show(form,player);if(r.canceled)return;if(r.selection===0){await structureMenu(player);return;}if(r.selection>0&&r.selection<=entries.length){await travel(player,entries[r.selection-1]);return;}if(r.selection===entries.length+1)await settingsMenu(player,()=>staffMenu(player));}
async function structureMenu(player,entry){if(entry){if(probe(entry)==="gone"){forget(entry);say(player,"Kontrolní kámen struktury chybí, záznam byl odstraněn.");return;}paint(entry,true);}const list=structures();const pages=Math.max(1,Math.ceil(list.length/pageSize()));let page=0;while(true){if(entry){const form=new ActionFormData().title(`◆ ${entry.n}`).body("◆").button("Teleport",ICON.teleport).button("Ovládat",ICON.control).button("«",ICON.back);const r=await show(form,player);if(r.canceled||r.selection===2)return;if(r.selection===0){await travel(player,entry);return;}if(r.selection===1){await editStructureMenu(player,entry);return;}}const slice=list.slice(page*pageSize(),(page+1)*pageSize());const form=new ActionFormData().title("Postavit strukturu").body(`Každá stavba dostane automatický kontrolní kámen na rohu.\n${list.length} struktur · strana ${page+1}/${pages}`).button("« Zpět",ICON.back);for(const item of slice)form.button(structureLabel(item),item.icon??ICON.structure);if(page>0)form.button("‹ Předchozí");if(page+1<pages)form.button("Další ›");const r=await show(form,player);if(r.canceled||r.selection===0)return;const selected=r.selection-1;if(selected>=0&&selected<slice.length){const item=slice[selected];try{const made=createStructure(player.dimension.id,{x:Math.floor(player.location.x),y:Math.floor(player.location.y),z:Math.floor(player.location.z)},item.id);say(player,`§aPostaveno: §f${item.name}`);await editStructureMenu(player,made);}catch{say(player,"§cStrukturu se nepodařilo postavit.");}return;}const after=selected-slice.length;if(page>0&&after===0){page--;continue;}if(page+1<pages&&after===(page>0?1:0)){page++;continue;}return;}}
async function editStructureMenu(player,entry){if(!entry?.s)return;const form=new ActionFormData().title(`◆ ${entry.n}`).body("◆   ◈   ⚙   ↔   ✎   ✖").button("Teleport",ICON.teleport).button("Přesun",ICON.move).button("Otočit",ICON.rotate).button("Zrcadlit",ICON.mirror).button("Vyměnit",ICON.replace).button("Název",ICON.rename).button("Odstranit",ICON.remove).button("«",ICON.back);const r=await show(form,player);if(r.canceled||r.selection===7)return;if(r.selection===0){await travel(player,entry);return;}if(r.selection===1){try{moveStructure(entry,{x:Math.floor(player.location.x),y:Math.floor(player.location.y),z:Math.floor(player.location.z)});say(player,"§aStruktura přesunuta.");}catch{say(player,"§cPřesun se nepodařil.");}}else if(r.selection===2||r.selection===3){const values=r.selection===2?rotations():mirrors();const pick=await choose(player,r.selection===2?"Otočení":"Zrcadlení",values);if(pick>=0)try{loadAt(entry,entry.s.id,r.selection===2?pick:entry.s.r??0,r.selection===3?pick:entry.s.m??0);}catch{say(player,"§cÚprava se nepodařila.");}}else if(r.selection===4){await chooseStructure(player,entry);return;}else if(r.selection===5){const f=new ModalFormData().title("Pojmenovat strukturu").textField("Název","např. Domov",entry.n);const q=await show(f,player);if(!q.canceled){const n=cleanName(q.formValues?.[0]);if(n){renameStructure(entry,n);say(player,`§aStruktura se nyní jmenuje ${n}.`);}}}else if(r.selection===6){const q=new ActionFormData().title("✖").body("✖").button("Ano",ICON.remove).button("Ne",ICON.keep);const c=await show(q,player);if(!c.canceled&&c.selection===0){removeStructureCompletely(entry);say(player,"§aStruktura i kontrolní kámen byly odstraněny.");}}}
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
async function choose(player,title,values){const f=new ActionFormData().title(title);for(const v of values)f.button(v);const r=await show(f,player);return r.canceled?-1:r.selection;}
async function settingsMenu(player,back){const current=styleOf(player),other=current==="cinematic"?"classic":"cinematic",portal=portalSoundOn(player);const f=new ActionFormData().title("Nastavení").button(`Zvuky teleportace\n${STYLES[current].tag}: ${STYLES[current].name}`,ICON.sounds);if(current==="classic")f.button(`Zvuk portálu ${portal?"§a(ZAP)":"§c(VYP)"}`,portal?ICON.on:ICON.off);f.button("Zpět",ICON.back);const r=await show(f,player);if(r.canceled)return;if(r.selection===0){setStyle(player,other);preview(player,other);return settingsMenu(player,back);}if(current==="classic"&&r.selection===1){setPortalSound(player,!portal);return settingsMenu(player,back);}return back();}
export async function listMenu(player){await staffMenu(player);}
