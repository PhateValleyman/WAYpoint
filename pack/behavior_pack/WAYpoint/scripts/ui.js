import { system } from "@minecraft/server";
import { ActionFormData, FormCancelationReason, ModalFormData } from "@minecraft/server-ui";

import {
  MAX_NAME, MAX_STONES, add, all, cleanName, dimName, distance, find, forget,
  freeName, nameTaken, ownedBy, paint, probe, save, say, visibleTo,
} from "./lib.js";
import { STYLES, activate, portalSoundOn, preview, setPortalSound, setStyle, styleOf } from "./sound.js";
import { travel, warping } from "./warp.js";

const ICON = {
  settings: "textures/ui/settings_glyph_color_2x",
  rename: "textures/items/name_tag",
  remove: "textures/ui/icon_trash",
  close: "textures/ui/cancel",
  back: "textures/ui/arrow_dark_left_stretch",
  keep: "textures/ui/check",
  sounds: "textures/ui/sound_glyph_2x",
  on: "textures/ui/toggle_on",
  off: "textures/ui/toggle_off",
};

const DIM_ICON = {
  "minecraft:overworld": "textures/blocks/grass_side_carried",
  "minecraft:nether": "textures/blocks/netherrack",
  "minecraft:the_end": "textures/blocks/end_stone",
};

function dimIcon(dimId) {
  return DIM_ICON[dimId] ?? "textures/items/ender_pearl";
}

function sleep(ticks) {
  return new Promise((done) => system.runTimeout(done, ticks));
}

async function show(form, player, tries = 8) {
  for (let i = 0; i < tries; i++) {
    const res = await form.show(player);
    if (res.canceled && res.cancelationReason === FormCancelationReason.UserBusy) {
      await sleep(10);
      continue;
    }
    return res;
  }
  return { canceled: true };
}

export async function touch(player, dimId, location) {
  if (warping(player)) return;
  const entry = find(dimId, location);
  if (entry && !visibleTo(entry, player)) {
    say(player, `${entry.n} je soukromý waystone.`);
    return;
  }
  if (entry) {
    activate(player, player.dimension, entry);
    await travelMenu(player, entry);
    return;
  }
  if (all().length >= MAX_STONES) {
    say(player, `Tento svět už obsahuje ${MAX_STONES} waystonů, což je maximum.`);
    return;
  }
  await nameMenu(player, undefined, dimId, location);
}

async function nameMenu(player, entry, dimId, location) {
  const spot = entry ? "Pojmenujte tento waystone" : "Pojmenujte tento waystone, abyste ho znovu našli.";

  const canHide = !entry || ownedBy(entry, player);
  const form = new ModalFormData()
    .title(entry ? "Přejmenovat waystone" : "Nový waystone")
    .textField(spot, entry ? "Název waystonu" : freeName(), entry
      ? { defaultValue: entry.n, maxLength: MAX_NAME }
      : { maxLength: MAX_NAME });
  if (canHide) form.toggle("Soukromý waystone", { defaultValue: entry?.p === true });

  const res = await show(form, player);
  if (res.canceled) return;

  const name = cleanName(res.formValues?.[0]) || (entry ? entry.n : freeName());
  const hidden = canHide ? res.formValues?.[1] === true : entry?.p === true;
  if (nameTaken(name, entry)) {
    say(player, `Waystone s názvem ${name} už existuje.`);
    return;
  }

  if (entry) {
    entry.n = name;
    if (hidden) entry.p = true;
    else delete entry.p;
    save();
    say(player, `${name} je uložen jako ${hidden ? "soukromý" : "veřejný"} waystone.`);
    return;
  }

  if (probe({ d: dimId, x: location.x, y: location.y, z: location.z }) === "gone") {
    say(player, "Ten waystone byl zničen, než mohl být uložen.");
    return;
  }
  if (find(dimId, location)) {
    say(player, "Tento waystone už někdo jiný uložil.");
    return;
  }
  if (all().length >= MAX_STONES) {
    say(player, `Tento svět už obsahuje ${MAX_STONES} waystonů, což je maximum.`);
    return;
  }

  const made = add(dimId, location, name, player.name, hidden);
  paint(made, true);
  say(player, `${name} je uložen jako ${hidden ? "soukromý" : "veřejný"} waystone. Klepnutím na něj znovu cestujte.`);
}

export async function travelMenu(player, entry) {
  if (probe(entry) === "gone") {
    forget(entry);
    say(player, "Ten waystone je pryč.");
    return;
  }
  paint(entry, true);

  const others = all()
    .filter((e) => e !== entry && visibleTo(e, player))
    .sort((a, b) => {
      if (a.d !== b.d) return a.d === entry.d ? -1 : 1;
      return a.n.localeCompare(b.n);
    });

  const form = new ActionFormData()
    .title("Waystone")
    .body([
      entry.p ? `${entry.n} (Soukromý)` : entry.n,
      dimName(entry.d),
      others.length
        ? `${others.length} ${others.length === 1 ? "další waystone" : (others.length >= 2 && others.length <= 4 ? "další waystony" : "dalších waystonů")} k cestování.`
        : "Zatím nebyl postaven žádný další waystone.",
    ].join("\n"));

  const actions = [];
  const button = (text, icon, run) => { form.button(text, icon); actions.push(run); };

  for (const other of others) {
    button(label(other, entry.d, entry), dimIcon(other.d), () => travel(player, other));
  }

  button("Přejmenovat tento waystone", ICON.rename, () => nameMenu(player, entry));
  button("Nastavení", ICON.settings, () => settingsMenu(player, () => travelMenu(player, entry)));
  button("Odstranit tento waystone", ICON.remove, () => removeMenu(player, entry));
  button("Zavřít", ICON.close, () => {});

  const res = await show(form, player);
  if (res.canceled) return;
  await actions[res.selection]?.();
}

function label(entry, dimId, from) {
  const name = entry.p ? `${entry.n} (Soukromý)` : entry.n;
  if (entry.d !== dimId) return `${name}\n${dimName(entry.d)}`;
  if (!from) return name;
  const blocks = distance(from, entry);
  return `${name}\n${blocks} ${blocks === 1 ? "blok" : (blocks >= 2 && blocks <= 4 ? "bloky" : "bloků")} daleko`;
}

export async function staffMenu(player) {
  if (warping(player)) return;
  const stones = all().filter((e) => visibleTo(e, player));
  if (!stones.length) {
    say(player, "Zatím nebyly umístěny žádné waystony.");
    return;
  }

  const here = player.location;
  const dimId = player.dimension.id;
  const list = stones.slice().sort((a, b) => {
    if (a.d !== b.d) {
      if (a.d === dimId) return -1;
      if (b.d === dimId) return 1;
      return a.d.localeCompare(b.d);
    }
    return a.d === dimId ? distance(here, a) - distance(here, b) : a.n.localeCompare(b.n);
  });

  const form = new ActionFormData()
    .title("Waystone hůl")
    .body(`Vyberte waystone, kam cestovat.\nWaystony: ${list.length}`);
  for (const entry of list) form.button(label(entry, dimId, here), dimIcon(entry.d));
  form.button("Nastavení", ICON.settings);
  form.button("Zavřít", ICON.close);

  const res = await show(form, player);
  if (res.canceled) return;
  if (res.selection === list.length) {
    await settingsMenu(player, () => staffMenu(player));
    return;
  }
  const pick = list[res.selection];
  if (pick) travel(player, pick);
}

async function settingsMenu(player, back) {
  const current = styleOf(player);
  const other = current === "cinematic" ? "classic" : "cinematic";
  const portal = portalSoundOn(player);

  const form = new ActionFormData().title("Nastavení");
  const actions = [];
  const button = (text, icon, run) => { form.button(text, icon); actions.push(run); };

  button(`Zvuky teleportace\n${STYLES[current].tag}: ${STYLES[current].name}`, ICON.sounds, async () => {
    setStyle(player, other);
    preview(player, other);
    await settingsMenu(player, back);
  });
  if (current === "classic") {
    button(`Zvuk portálu ${portal ? "§a(ZAP)" : "§c(VYP)"}`, portal ? ICON.on : ICON.off, async () => {
      setPortalSound(player, !portal);
      await settingsMenu(player, back);
    });
  }
  button("Zpět", ICON.back, back);

  const res = await show(form, player);
  if (res.canceled) return;
  await actions[res.selection]?.();
}

async function removeMenu(player, entry) {
  const form = new ActionFormData()
    .title("Odstranit waystone")
    .body(`${entry.n} bude zapomenut a nikdo sem už nebude moci cestovat.\nBlok samotný zůstane na místě.`)
    .button("Odstranit", ICON.remove)
    .button("Ponechat", ICON.keep);

  const res = await show(form, player);
  if (res.canceled || res.selection !== 0) return;

  paint(entry, false);
  forget(entry);
  say(player, `${entry.n} už není cílem.`);
}

export async function listMenu(player) {
  const stones = all().filter((e) => visibleTo(e, player));
  if (!stones.length) {
    say(player, "Zatím nebyly umístěny žádné waystony.");
    return;
  }

  const lines = stones
    .slice()
    .sort((a, b) => (a.d === b.d ? a.n.localeCompare(b.n) : a.d.localeCompare(b.d)))
    .map((e) => `${e.p ? `${e.n} (Soukromý)` : e.n}\n${dimName(e.d)}`);

  const form = new ActionFormData()
    .title("Waystony")
    .body(`Waystony: ${stones.length}\n\n${lines.join("\n\n")}`)
    .button("Zavřít", ICON.close);

  await show(form, player);
}