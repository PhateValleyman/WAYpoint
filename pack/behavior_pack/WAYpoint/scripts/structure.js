import { STRUCTURE_DIMENSIONS } from "./structure_dimensions.js";
import { save, paint, BLOCK, TOP, dimOf } from "./lib.js";

const ROTATIONS = ["0_degrees", "90_degrees", "180_degrees", "270_degrees"];
const MIRRORS = ["none", "x", "z", "xz"];
const PAGE_SIZE = 20;
const BUILTIN = Object.entries(STRUCTURE_DIMENSIONS)
  .filter(([id]) => !id.endsWith("_x"))
  .map(([id, data]) => ({ id, size: data.size, name: prettyName(id) }))
  .sort((a, b) => a.name.localeCompare(b.name));

function prettyName(id) {
  const raw = id.includes(":") ? id.split(":").pop() : id;
  return raw.split(/[\\/_-]+/).filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
}
export function structures() { return BUILTIN; }
export function pageSize() { return PAGE_SIZE; }
export function rotations() { return ROTATIONS; }
export function mirrors() { return MIRRORS; }
export function structureById(id) { return BUILTIN.find((item) => item.id === id); }

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
