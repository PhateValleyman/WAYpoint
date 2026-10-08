import { STRUCTURE_DIMENSIONS } from "./structure_dimensions.js";
import { add, save, paint, BLOCK, TOP, dimOf, find, all, forget } from "./lib.js";

const ROTATIONS = ["0_degrees", "90_degrees", "180_degrees", "270_degrees"];
const MIRRORS = ["none", "x", "z", "xz"];
const PAGE_SIZE = 20;
const BUILTIN = Object.entries(STRUCTURE_DIMENSIONS)
  .filter(([id]) => !id.endsWith("_x"))
  .map(([id, data]) => ({ id, size: data.size, name: prettyName(id), icon: iconFor(id) }))
  .sort((a, b) => a.name.localeCompare(b.name));

function iconFor(id) {
  const name = id.toLowerCase();
  if (name.includes("farm")) return "textures/items/wheat";
  if (name.includes("car") || name.includes("truck") || name.includes("bus") || name.includes("airplane") || name.includes("helicopter") || name.includes("ship") || name.includes("taxi") || name.includes("tractor")) return "textures/items/minecart_normal";
  if (name.includes("statue") || name.includes("head") || name.includes("pixelart")) return "textures/items/armor_stand";
  if (name.includes("castle") || name.includes("tower") || name.includes("fort")) return "textures/blocks/stonebrick";
  if (name.includes("fountain") || name.includes("pool") || name.includes("aquarium")) return "textures/items/bucket_water";
  if (name.includes("portal") || name.includes("nether")) return "textures/blocks/netherrack";
  if (name.includes("decoration") || name.includes("garden") || name.includes("tree")) return "textures/items/flower_poppy";
  if (name.includes("beacon")) return "textures/items/nether_star";
  if (name.includes("house") || name.includes("barn") || name.includes("garage") || name.includes("library")) return "textures/blocks/planks_oak";
  return "textures/ui/structure_icon";
}
function prettyName(id) {
  const raw = id.includes(":") ? id.split(":").pop() : id;
  return raw.split(/[\\/_-]+/).filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
}
export function structures() { return BUILTIN; }
export function pageSize() { return PAGE_SIZE; }
export function rotations() { return ROTATIONS; }
export function mirrors() { return MIRRORS; }
export function structureById(id) { return BUILTIN.find((item) => item.id === id); }
export function orientedSize(id, rotation = 0) { const item = structureById(id); return item ? effectiveSize(item.size, rotation) : undefined; }

function effectiveSize(size, rotation) {
  const swap = rotation === 1 || rotation === 3;
  return { x: swap ? size[2] : size[0], y: size[1], z: swap ? size[0] : size[2] };
}
function command(dim, command) {
  const result = dim.runCommand(command);
  if (result && result.successCount === 0) throw new Error(command);
}
function clearVolume(dim, point, size) {
  command(dim, `fill ${point.x} ${point.y} ${point.z} ${point.x + size.x - 1} ${point.y + size.y - 1} ${point.z + size.z - 1} air`);
  try { command(dim, `setblock ${point.x} ${point.y + 1} ${point.z} air`); } catch {}
}
function putAnchor(dim, entry) {
  const p = entry;
  command(dim, `setblock ${p.x} ${p.y} ${p.z} ${BLOCK} replace`);
  const above = dim.getBlock({ x: p.x, y: p.y + 1, z: p.z });
  if (above?.typeId !== TOP) command(dim, `setblock ${p.x} ${p.y + 1} ${p.z} ${TOP} replace`);
  paint({ d: dim.id, x: p.x, y: p.y, z: p.z }, true);
}
export function loadAt(entry, structureId, rotation = 0, mirror = 0) {
  const dim = dimOf(entry.d);
  const item = structureById(structureId);
  if (!dim || !item) throw new Error(`Unknown structure ${structureId}`);
  const p = `${entry.x} ${entry.y} ${entry.z}`;
  if (entry.s?.size) {
    try { clearVolume(dim, entry, entry.s.size); } catch {}
  }
  command(dim, `structure load ${structureId} ${p} ${ROTATIONS[rotation] ?? ROTATIONS[0]} ${MIRRORS[mirror] ?? MIRRORS[0]}`);
  putAnchor(dim, entry);
  entry.s = { id: structureId, n: item.name, size: effectiveSize(item.size, rotation), source: item.size, r: rotation, m: mirror };
  save();
}
export function moveStructure(entry, location) {
  if (!entry.s) return;
  const dim = dimOf(entry.d);
  if (!dim) throw new Error("Dimension unavailable");
  const old = { x: entry.x, y: entry.y, z: entry.z };
  const target = { x: Math.floor(location.x), y: Math.floor(location.y), z: Math.floor(location.z) };
  if (old.x === target.x && old.y === target.y && old.z === target.z) return;
  const snapshot = { ...entry.s };
  try {
    clearVolume(dim, old, snapshot.size);
    entry.x = target.x;
    entry.y = target.y;
    entry.z = target.z;
    loadAt(entry, snapshot.id, snapshot.r ?? 0, snapshot.m ?? 0);
  } catch (error) {
    entry.x = old.x;
    entry.y = old.y;
    entry.z = old.z;
    try { loadAt(entry, snapshot.id, snapshot.r ?? 0, snapshot.m ?? 0); } catch {}
    throw error;
  }
  save();
}
export function removeStructure(entry) {
  if (!entry.s) return;
  const dim = dimOf(entry.d);
  if (dim) {
    const s = entry.s.size;
    try { command(dim, `fill ${entry.x} ${entry.y} ${entry.z} ${entry.x + s.x - 1} ${entry.y + s.y - 1} ${entry.z + s.z - 1} air`); } catch {}
    try { putAnchor(dim, entry); } catch {}
  }
  delete entry.s;
  save();
}
export function rebuild(entry) {
  if (!entry.s) return;
  loadAt(entry, entry.s.id, entry.s.r ?? 0, entry.s.m ?? 0);
}
export function formatSize(size) { return `${size[0]}×${size[1]}×${size[2]}`; }
export function structureLabel(item) { return `${item.name}\n§8${formatSize(item.size)}`; }
export function structureCount() { return BUILTIN.length; }

export function createStructure(dimId, location, structureId, name = "Struktura") {
  const existing = find(dimId, location);
  if (existing) return existing;
  const entry = add(dimId, location, name);
  loadAt(entry, structureId);
  return entry;
}
export function renameStructure(entry, name) { entry.n = name; save(); }
export function structuresInWorld() { return all().filter(e => e.s?.id); }
export function removeStructureCompletely(entry) {
  const dim = dimOf(entry.d);
  if (dim && entry.s?.size) { try { clearVolume(dim, entry, entry.s.size); } catch {} }
  forget(entry);
}
