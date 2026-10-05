import { all } from "./lib.js";

const ACTIVATED = "voxen.classic.waystone_activated";
const SEEN_PROP = "voxen:seen";
const STYLE_PROP = "voxen:sound_style";
const PORTAL_PROP = "voxen:portal_sound";

export const STYLES = {
  cinematic: {
    tag: "GTA",
    name: "Filmový přepínač",
  },
  classic: {
    tag: "MINECRAFT",
    name: "Klasický portál",
  },
};

export function styleOf(player) {
  try {
    const value = player.getDynamicProperty(STYLE_PROP);
    return STYLES[value] ? value : "cinematic";
  } catch {
    return "cinematic";
  }
}

export function setStyle(player, style) {
  if (!STYLES[style]) return;
  try {
    player.setDynamicProperty(STYLE_PROP, style);
  } catch {}
}

export function portalSoundOn(player) {
  try {
    return player.getDynamicProperty(PORTAL_PROP) !== false;
  } catch {
    return true;
  }
}

export function setPortalSound(player, on) {
  try {
    player.setDynamicProperty(PORTAL_PROP, on);
  } catch {}
}

export function preview(player, style) {
  try {
    player.playSound(`voxen.${style}.zoom_out_short`, { volume: 0.5 });
  } catch {}
}

function keyOf(entry) {
  return `${entry.d} ${entry.x} ${entry.y} ${entry.z}`;
}

function center(x, y, z) {
  return { x: Math.floor(x) + 0.5, y: Math.floor(y) + 0.5, z: Math.floor(z) + 0.5 };
}

function seenBy(player) {
  try {
    const raw = player.getDynamicProperty(SEEN_PROP);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function activate(player, dimension, entry) {
  if (entry.o === player.name) return;
  const seen = seenBy(player);
  const key = keyOf(entry);
  if (seen.includes(key)) return;
  const live = new Set(all().map(keyOf));
  const kept = seen.filter((k) => live.has(k));
  kept.push(key);
  try {
    player.setDynamicProperty(SEEN_PROP, JSON.stringify(kept));
  } catch {}
  if (styleOf(player) !== "classic") return;
  try {
    dimension.playSound(ACTIVATED, center(entry.x, entry.y, entry.z), { volume: 0.2, pitch: 1.0 });
  } catch {}
}