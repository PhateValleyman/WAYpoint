import { BlockPermutation, world } from "@minecraft/server";

export const BLOCK = "voxen:waystone";
export const STAFF = "voxen:waystone_staff";
export const TOP = "voxen:waystone_top";
export const STATE_ON = "voxen:on";
const PROP = "voxen:stones";

export const MAX_STONES = 64;
export const MAX_NAME = 24;

export const DIM_NAME = {
  "minecraft:overworld": "Overworld",
  "minecraft:nether": "Nether",
  "minecraft:the_end": "End",
};

let cache;

export function all() {
  if (cache) return cache;
  try {
    const raw = world.getDynamicProperty(PROP);
    cache = raw ? JSON.parse(raw) : [];
  } catch {
    cache = [];
  }
  if (!Array.isArray(cache)) cache = [];
  return cache;
}

export function save() {
  try {
    world.setDynamicProperty(PROP, JSON.stringify(all()));
  } catch {}
}

export function dimOf(id) {
  try {
    return world.getDimension(id);
  } catch {
    return undefined;
  }
}

export function dimName(id) {
  return DIM_NAME[id] ?? id.replace("minecraft:", "");
}

export function find(dimId, loc) {
  const x = Math.floor(loc.x), y = Math.floor(loc.y), z = Math.floor(loc.z);
  return all().find((e) => e.d === dimId && e.x === x && e.y === y && e.z === z);
}

export function add(dimId, loc, name, owner, hidden) {
  const entry = {
    d: dimId,
    x: Math.floor(loc.x),
    y: Math.floor(loc.y),
    z: Math.floor(loc.z),
    n: name,
    o: owner,
  };
  if (hidden) entry.p = true;
  all().push(entry);
  save();
  return entry;
}

export function ownedBy(entry, player) {
  return entry.o === player.name;
}

export function visibleTo(entry, player) {
  return !entry.p || ownedBy(entry, player);
}

export function forget(entry) {
  const list = all();
  const at = list.indexOf(entry);
  if (at >= 0) list.splice(at, 1);
  save();
}

export function nameTaken(name, except) {
  const want = name.trim().toLowerCase();
  return all().some((e) => e !== except && e.n.trim().toLowerCase() === want);
}

export function cleanName(raw) {
  const text = String(raw ?? "").replace(/[\u00a7\n\r\t]/g, " ").trim();
  return text.slice(0, MAX_NAME);
}

export function freeName() {
  for (let i = 1; i <= MAX_STONES + 1; i++) {
    const name = `Cestovní kámen ${i}`;
    if (!nameTaken(name)) return name;
  }
  return "Cestovní kámen";
}

const AROUND = [
  [0, -1], [0, 1], [-1, 0], [1, 0],
  [-1, -1], [1, -1], [-1, 1], [1, 1],
];

export function perch(entry) {
  return { x: entry.x + 0.5, y: entry.y + 2, z: entry.z + 0.5 };
}

function standable(dim, x, y, z) {
  const feet = dim.getBlock({ x, y, z });
  const head = dim.getBlock({ x, y: y + 1, z });
  const floor = dim.getBlock({ x, y: y - 1, z });
  if (!feet || !head || !floor) return false;
  if (!feet.isAir || !head.isAir) return false;
  return !floor.isAir && !floor.isLiquid;
}

export function arrival(entry) {
  const dim = dimOf(entry.d);
  if (!dim) return undefined;
  for (const [dx, dz] of AROUND) {
    const x = entry.x + dx, z = entry.z + dz;
    let ok;
    try {
      ok = standable(dim, x, entry.y, z);
    } catch {
      return undefined;
    }
    if (!ok) continue;
    return {
      at: { x: x + 0.5, y: entry.y, z: z + 0.5 },
      yaw: Math.atan2(dx, -dz) * (180 / Math.PI),
    };
  }
  return undefined;
}

export function probe(entry) {
  const dim = dimOf(entry.d);
  if (!dim) return "unknown";
  let block;
  try {
    block = dim.getBlock({ x: entry.x, y: entry.y, z: entry.z });
  } catch {
    return "unknown";
  }
  if (!block) return "unknown";
  return block.typeId === BLOCK ? "here" : "gone";
}

export function paint(entry, on) {
  if (probe(entry) !== "here") return;
  try {
    const base = dimOf(entry.d)?.getBlock({ x: entry.x, y: entry.y, z: entry.z });
    base?.setPermutation(BlockPermutation.resolve(BLOCK, { [STATE_ON]: on }));
    const up = base?.above();
    if (up?.typeId === TOP) up.setPermutation(BlockPermutation.resolve(TOP, { [STATE_ON]: on }));
  } catch {}
}

export function distance(from, entry) {
  return Math.round(Math.hypot(from.x - entry.x, from.y - entry.y, from.z - entry.z));
}

export function say(player, text) {
  try {
    player.sendMessage(text);
  } catch {}
}

export function tip(player, text) {
  try {
    player.onScreenDisplay.setActionBar(text);
  } catch {}
}

export function alive(thing) {
  try {
    return typeof thing.isValid === "function" ? thing.isValid() : thing.isValid !== false;
  } catch {
    return false;
  }
}