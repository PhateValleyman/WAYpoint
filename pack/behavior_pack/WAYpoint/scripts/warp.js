import * as mc from "@minecraft/server";
import { InputPermissionCategory, system, world } from "@minecraft/server";

import { alive, all, arrival, dimOf, forget, perch, probe, say } from "./lib.js";
import { portalSoundOn, styleOf } from "./sound.js";

const PRESET = "voxen:warp";

const EYE = 1.62;
const MAX_PITCH = 89.9;

const EXIT_BODY_TICKS = 12;
const ENTER_BODY_TICKS = 12;
const BODY_GLIDE_TICKS = 10;
const BODY_CAMERA_HEIGHT = 6;
const BODY_GLIDE_HEIGHT = 0.5;
const STAGE_HEIGHTS = [20, 40, 60];
const STAGE_TICKS = 13;
const STAGE_GLIDE_HEIGHT = 0.5;
const PRE_TRAVEL_WAIT = 10;
const PRE_PUSH_WAIT = 10;
const CROSS_DIMENSION_WAIT = 20;
const TRAVEL_BLOCKS_PER_TICK = 30;
const MIN_TRAVEL_TICKS = 20;
const MAX_TRAVEL_TICKS = 60;
const TRAVEL_SOUND_FADE_TICKS = 30;
const HUD_HIDE_TICK = 8;
const LEAD = 2;

const SOUND_VOLUME = 0.5;
const QUIET_CUES = new Set(["teleport", "zoom_in_short", "zoom_in_short_2", "zoom_in_long", "camera_in"]);

const TRAVEL_EASE_EDGE = 10;
const TRAVEL_REACH = 72;
const REACH_STEP = 16;

const PRELOAD_PAD = 40;
const PATH_PAD = 24;
const MIN_PAD = 8;
const MAX_AREA_CHUNKS = 100;
const AREA_PROP = "voxen:warp_areas";

const busy = new Set();
const areas = new Map();
const trips = new Map();
let areaSeq = 0;

export function warping(player) {
  return busy.has(player.id);
}

function allAreas() {
  return [...areas.values()].flat();
}

function saveAreas() {
  try {
    world.setDynamicProperty(AREA_PROP, JSON.stringify(allAreas()));
  } catch {}
}

function loaded(dim, x, y, z) {
  try {
    return dim.getBlock({ x: Math.floor(x), y: Math.floor(y), z: Math.floor(z) }) !== undefined;
  } catch {
    return false;
  }
}

function dropArea(area) {
  try {
    dimOf(area.d)?.runCommand(`tickingarea remove ${area.name}`);
  } catch {}
}

function chunkCount(box) {
  return (Math.floor(box.x2 / 16) - Math.floor(box.x1 / 16) + 1)
    * (Math.floor(box.z2 / 16) - Math.floor(box.z1 / 16) + 1);
}

function claim(player, dimId, a, b, y, startPad) {
  const dim = dimOf(dimId);
  if (!dim) return;

  let pad = startPad;
  let box;
  for (;;) {
    box = {
      x1: Math.floor(Math.min(a.x, b.x)) - pad, z1: Math.floor(Math.min(a.z, b.z)) - pad,
      x2: Math.floor(Math.max(a.x, b.x)) + pad, z2: Math.floor(Math.max(a.z, b.z)) + pad,
    };
    if (chunkCount(box) <= MAX_AREA_CHUNKS || pad <= MIN_PAD) break;
    pad -= 8;
  }

  const name = `waystone_warp_${(Date.now() % 1679616).toString(36)}${(areaSeq++).toString(36)}`;
  const iy = Math.floor(y);
  let result;
  try {
    result = dim.runCommand(
      `tickingarea add ${box.x1} ${iy} ${box.z1} ${box.x2} ${iy} ${box.z2} ${name} true`);
  } catch {
    return;
  }
  if (!result?.successCount) return;

  const area = { d: dimId, name };
  const list = areas.get(player.id) ?? [];
  list.push(area);
  areas.set(player.id, list);
  saveAreas();
}

function unload(playerId) {
  const list = areas.get(playerId);
  if (!list) return;
  areas.delete(playerId);
  saveAreas();
  for (const area of list) dropArea(area);
}

function sweepAreas() {
  let left = [];
  try {
    const raw = world.getDynamicProperty(AREA_PROP);
    left = raw ? JSON.parse(raw) : [];
  } catch {}
  const live = new Set(allAreas().map((a) => a.name));
  const stale = Array.isArray(left) ? left.filter((a) => !live.has(a?.name)) : [];
  stale.forEach(dropArea);
  saveAreas();
}

function roof(dimId) {
  if (dimId === "minecraft:nether") return 116;
  if (dimId === "minecraft:the_end") return 250;
  return 315;
}

function heights(dimId, feetY) {
  const want = STAGE_HEIGHTS[STAGE_HEIGHTS.length - 1] + STAGE_GLIDE_HEIGHT;
  const room = roof(dimId) - feetY;
  const scale = room >= want ? 1 : Math.max(0.15, room / want);
  return STAGE_HEIGHTS.map((h) => h * scale);
}

function clamp01(x) {
  return Math.min(1, Math.max(0, x));
}

function smoothStep(x) {
  const v = clamp01(x);
  return v * v * (3 - 2 * v);
}

function easeOutCubic(x) {
  const inv = 1 - clamp01(x);
  return 1 - inv * inv * inv;
}

function bodyLook(x) {
  return easeOutCubic(clamp01(x * 1.5));
}

function lerp(a, b, t) {
  return a + (b - a) * clamp01(t);
}

function wrapDegrees(v) {
  let w = v % 360;
  if (w >= 180) w -= 360;
  if (w < -180) w += 360;
  return w;
}

function lerpDegrees(a, b, t) {
  return a + wrapDegrees(b - a) * clamp01(t);
}

function hermiteFromLinear(x, decelStart, speed) {
  if (x <= decelStart) return x * speed;
  const t = (x - decelStart) / (1 - decelStart);
  const t2 = t * t, t3 = t2 * t;
  const y0 = decelStart * speed;
  const m0 = speed * (1 - decelStart);
  const v = (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2);
  return Math.min(1, Math.max(0, v));
}

function linearThenEaseOut(x) {
  return hermiteFromLinear(clamp01(x), 0.64, 1.08);
}

function longEaseOut(x) {
  return hermiteFromLinear(clamp01(x), 0.36, 1.0);
}

function shake(yaw, pitch, ft) {
  const vertical = Math.sin(ft * 0.105) * 0.74 + Math.sin(ft * 0.052 + 1.6) * 0.26;
  const horizontal = Math.sin(ft * 0.105 + 2.1) * 0.78 + Math.sin(ft * 0.15 + 0.35) * 0.22;
  const pitchShake = (Math.min(1, Math.max(-1, vertical)) - 1) * 0.5 * 1.05;
  const yawShake = horizontal * 0.15;
  return { x: Math.min(MAX_PITCH, Math.max(-90, pitch + pitchShake)), y: yaw + yawShake };
}

function travelTicksFor(from, to) {
  const d = Math.hypot(to.x - from.x, to.z - from.z);
  return Math.min(MAX_TRAVEL_TICKS, Math.max(MIN_TRAVEL_TICKS, Math.ceil(d / TRAVEL_BLOCKS_PER_TICK)));
}

function integratedSmoothStep(x) {
  const v = clamp01(x);
  return v * v * v - 0.5 * v * v * v * v;
}

function travelEase(progress, ticks) {
  const total = Math.max(1, ticks);
  const edge = Math.min(TRAVEL_EASE_EDGE, total * 0.5);
  const elapsed = clamp01(progress) * total;
  const weighted = Math.max(1, total - edge);
  if (elapsed < edge) return edge * integratedSmoothStep(elapsed / edge) / weighted;
  const steadyEnd = total - edge;
  if (elapsed <= steadyEnd) return (edge * 0.5 + elapsed - edge) / weighted;
  const decel = (elapsed - steadyEnd) / edge;
  const before = edge * 0.5 + Math.max(0, total - edge * 2);
  return (before + edge * (clamp01(decel) - integratedSmoothStep(decel))) / weighted;
}

function setFrame(player, frame, easeTicks) {
  const options = { location: frame.location, rotation: frame.rotation };
  if (easeTicks > 0) options.easeOptions = { easeTime: easeTicks / 20, easeType: "Linear" };
  try {
    player.camera.setCamera(PRESET, options);
  } catch {}
}

function cue(player, sound) {
  try {
    player.playSound(sound, { volume: SOUND_VOLUME });
  } catch {}
}

function hud(player, hidden) {
  const mode = hidden ? mc.HudVisibility?.Hide : mc.HudVisibility?.Reset;
  if (mode !== undefined) {
    try {
      player.onScreenDisplay.setHudVisibility(mode);
      return;
    } catch {}
  }
  try {
    player.runCommand(hidden ? "hud @s hide all" : "hud @s reset all");
  } catch {}
}

function frozen(player, locked) {
  try {
    player.inputPermissions.setPermissionCategory(InputPermissionCategory.Movement, !locked);
    player.inputPermissions.setPermissionCategory(InputPermissionCategory.Camera, !locked);
  } catch {}
}

function release(player) {
  busy.delete(player.id);
  const live = alive(player);
  unload(player.id);
  trips.delete(player.id);
  if (!live) return;
  frozen(player, false);
  hud(player, false);
  try {
    player.camera.clear();
  } catch {}
}

export function travel(player, entry) {
  if (busy.has(player.id)) return;

  if (!all().includes(entry)) {
    say(player, "Tento cestovní kámen byl mezitím odstraněn, zatímco bylo otevřené menu.");
    return;
  }
  if (probe(entry) === "gone") {
    forget(entry);
    say(player, "Tento cestovní kámen už tam není.");
    return;
  }
  const target = dimOf(entry.d);
  if (!target) {
    say(player, "Tento cestovní kámen je někde, kam se tento svět nedostane.");
    return;
  }

  busy.add(player.id);
  const startTick = system.currentTick;
  trips.set(player.id, startTick);
  frozen(player, true);

  const source = player.dimension;
  const startFeet = { ...player.location };
  const startEye = { x: startFeet.x, y: startFeet.y + EYE, z: startFeet.z };
  const startYaw = player.getRotation().y;
  const startPitch = player.getRotation().x;
  const planned = { x: entry.x + 0.5, y: entry.y + 1, z: entry.z + 0.5 };

  const skipTravel = entry.d !== source.id;
  const travelTicks = skipTravel ? 0 : travelTicksFor(startFeet, planned);
  const preTravelWait = skipTravel ? CROSS_DIMENSION_WAIT : PRE_TRAVEL_WAIT;
  const prePushWait = skipTravel ? CROSS_DIMENSION_WAIT : PRE_PUSH_WAIT;

  const pullStart = EXIT_BODY_TICKS + BODY_GLIDE_TICKS;
  const pullStage = [0, 1, 2].map((i) => pullStart + STAGE_TICKS * i);
  const pullEnd = pullStart + STAGE_TICKS * 3;
  const travelStart = pullEnd + preTravelWait;
  const travelEnd = travelStart + travelTicks;
  const pushStart = travelEnd + prePushWait;
  const pushStage = [0, 1, 2].map((i) => pushStart + STAGE_TICKS * i);
  const pullMotionEnd = skipTravel ? pullEnd : travelStart;
  const pushMotionStart = skipTravel ? pushStart : travelEnd;
  const enterHoldStart = pushStart + STAGE_TICKS * 3;
  const enterStart = enterHoldStart + BODY_GLIDE_TICKS;
  const totalTicks = enterStart + ENTER_BODY_TICKS;
  const commandTick = skipTravel ? travelStart : travelStart + Math.floor(travelTicks / 2);

  const outHeights = heights(source.id, startFeet.y);
  let arrivalFeet = { ...planned };
  let inHeights = heights(entry.d, arrivalFeet.y);
  let bodyYaw = startYaw;
  let teleported = false;

  const gap = skipTravel ? 0 : Math.hypot(planned.x - startFeet.x, planned.z - startFeet.z);
  const course = gap >= 1
    ? { x: (planned.x - startFeet.x) / gap, z: (planned.z - startFeet.z) / gap }
    : { x: 0, z: 0 };
  const continuous = !skipTravel && gap <= 2 * TRAVEL_REACH;
  const reach = Math.min(TRAVEL_REACH, gap);
  let reachOut = reach;
  let reachIn = reach;

  const cutTicks = new Set([0, pullStage[0], pullStage[1], pullStage[2], pushStage[1], pushStage[2], enterHoldStart]);
  if (!continuous) cutTicks.add(commandTick);


  unload(player.id);
  if (reach >= 1) {
    claim(player, source.id, startFeet, {
      x: startFeet.x + course.x * reach, z: startFeet.z + course.z * reach,
    }, startFeet.y, PATH_PAD);
  }
  claim(player, entry.d, {
    x: planned.x - course.x * reach, z: planned.z - course.z * reach,
  }, planned, entry.y, PRELOAD_PAD);

  function pullAltitude(ft) {
    if (ft < pullStage[1]) return startFeet.y + outHeights[0] + linearThenEaseOut((ft - pullStage[0]) / STAGE_TICKS) * STAGE_GLIDE_HEIGHT;
    if (ft < pullStage[2]) return startFeet.y + outHeights[1] + linearThenEaseOut((ft - pullStage[1]) / STAGE_TICKS) * STAGE_GLIDE_HEIGHT;
    return startFeet.y + outHeights[2] + longEaseOut((ft - pullStage[2]) / Math.max(1, pullMotionEnd - pullStage[2])) * STAGE_GLIDE_HEIGHT;
  }

  function pushAltitude(ft) {
    if (ft < pushStage[1]) return arrivalFeet.y + inHeights[2] + (1 - linearThenEaseOut((ft - pushMotionStart) / STAGE_TICKS)) * STAGE_GLIDE_HEIGHT;
    if (ft < pushStage[2]) return arrivalFeet.y + inHeights[1] + (1 - linearThenEaseOut((ft - pushStage[1]) / STAGE_TICKS)) * STAGE_GLIDE_HEIGHT;
    return arrivalFeet.y + inHeights[0] + (1 - linearThenEaseOut((ft - pushStage[2]) / Math.max(1, enterHoldStart - pushStage[2]))) * STAGE_GLIDE_HEIGHT;
  }

  function over(feet, y, ft, shaken = true) {
    return {
      location: { x: feet.x, y, z: feet.z + 0.001 },
      rotation: shaken ? shake(startYaw, 90, ft) : { x: MAX_PITCH, y: startYaw },
    };
  }

  function frameAt(ft) {
    if (ft <= EXIT_BODY_TICKS) {
      const p = ft / EXIT_BODY_TICKS;
      return {
        location: {
          x: startEye.x,
          y: lerp(startEye.y, startFeet.y + BODY_CAMERA_HEIGHT, smoothStep(p)),
          z: startEye.z,
        },
        rotation: { x: Math.min(MAX_PITCH, lerp(startPitch, 90, bodyLook(p))), y: startYaw },
      };
    }
    if (ft <= pullStart) {
      const p = clamp01((ft - EXIT_BODY_TICKS) / BODY_GLIDE_TICKS);
      return over(startFeet, startFeet.y + BODY_CAMERA_HEIGHT + p * BODY_GLIDE_HEIGHT, ft, false);
    }
    if (ft <= pullMotionEnd) return over(startFeet, pullAltitude(ft), ft);
    if (!skipTravel && ft > travelStart && ft < travelEnd) {
      const progress = travelEase((ft - travelStart) / travelTicks, travelTicks);
      const y = lerp(startFeet.y + outHeights[2], arrivalFeet.y + inHeights[2], progress) + STAGE_GLIDE_HEIGHT;
      if (continuous) {
        return over({
          x: lerp(startFeet.x, arrivalFeet.x, progress),
          z: lerp(startFeet.z, arrivalFeet.z, progress),
        }, y, ft);
      }
      if (!teleported) {
        const a = clamp01((ft - travelStart) / Math.max(1, commandTick - travelStart));
        const run = reachOut * (1 - Math.cos(a * Math.PI / 2));
        return over({ x: startFeet.x + course.x * run, z: startFeet.z + course.z * run }, y, ft);
      }
      const b = clamp01((ft - commandTick) / Math.max(1, travelEnd - commandTick));
      const left = reachIn * (1 - Math.sin(b * Math.PI / 2));
      return over({ x: arrivalFeet.x - course.x * left, z: arrivalFeet.z - course.z * left }, y, ft);
    }
    if (!teleported) return over(startFeet, startFeet.y + outHeights[2] + STAGE_GLIDE_HEIGHT, ft);
    if (ft <= pushMotionStart) return over(arrivalFeet, arrivalFeet.y + inHeights[2] + STAGE_GLIDE_HEIGHT, ft);
    if (ft < enterHoldStart) return over(arrivalFeet, pushAltitude(ft), ft);
    if (ft <= enterStart) {
      const p = clamp01((ft - enterHoldStart) / BODY_GLIDE_TICKS);
      return over(arrivalFeet, arrivalFeet.y + BODY_CAMERA_HEIGHT + (1 - p) * BODY_GLIDE_HEIGHT, ft, false);
    }
    const p = (ft - enterStart) / ENTER_BODY_TICKS;
    const look = bodyLook(p);
    return {
      location: {
        x: arrivalFeet.x,
        y: lerp(arrivalFeet.y + BODY_CAMERA_HEIGHT, arrivalFeet.y + EYE, smoothStep(p)),
        z: arrivalFeet.z,
      },
      rotation: { x: Math.min(MAX_PITCH, lerp(90, 0, look)), y: lerpDegrees(startYaw, bodyYaw, look) },
    };
  }

  function nextCut(tick) {
    let best = Infinity;
    for (const c of cutTicks) if (c > tick && c < best) best = c;
    return best;
  }

  function teleportBody() {
    const spot = arrival(entry);
    const at = spot ? spot.at : perch(entry);
    bodyYaw = spot ? spot.yaw : startYaw;
    try {
      player.teleport(at, { dimension: target, rotation: { x: 0, y: bodyYaw } });
    } catch {
      return;
    }
    teleported = true;
    arrivalFeet = { x: at.x, y: at.y, z: at.z };
    inHeights = heights(entry.d, arrivalFeet.y);
    if (!continuous && !skipTravel) {
      while (reachIn > REACH_STEP && !loaded(target, arrivalFeet.x - course.x * reachIn, arrivalFeet.y, arrivalFeet.z - course.z * reachIn)) reachIn -= REACH_STEP;
    }
  }

  const style = styleOf(player);
  const quiet = style === "classic" && !portalSoundOn(player);
  const sfx = (name) => `voxen.${style}.${quiet && QUIET_CUES.has(name) ? `quiet_${name}` : name}`;

  function run(tick) {
    if (tick === 1) cue(player, sfx("camera_out"));
    if (tick === HUD_HIDE_TICK) hud(player, true);

    if (tick === pullStage[0]) cue(player, sfx("zoom_out_short"));
    if (tick === pullStage[1]) cue(player, sfx("zoom_out_short_2"));
    if (tick === pullStage[2]) cue(player, sfx("zoom_out_long"));
    if (tick === pushStage[1]) cue(player, sfx("zoom_in_short"));
    if (tick === pushStage[2]) cue(player, sfx("zoom_in_short_2"));
    if (tick === enterHoldStart) cue(player, sfx("zoom_in_long"));
    if (tick === enterStart) cue(player, sfx("camera_in"));

    if (!skipTravel && tick === travelStart) cue(player, sfx("teleport"));
    if (!skipTravel && tick === travelEnd + TRAVEL_SOUND_FADE_TICKS) {
      try {
        player.runCommand(`stopsound @s ${sfx("teleport")}`);
      } catch {}
    }

    if (!skipTravel && !continuous && tick === pullEnd) {
      while (reachOut > REACH_STEP && !loaded(source, startFeet.x + course.x * reachOut, startFeet.y, startFeet.z + course.z * reachOut)) reachOut -= REACH_STEP;
    }

    if (tick === commandTick && !teleported) teleportBody();

    if (tick >= totalTicks) {
      release(player);
      if (probe(entry) === "gone") {
        forget(entry);
        say(player, `${entry.n} byl mezitím rozbit, takže byl nyní odebrán ze seznamu.`);
      }
      return false;
    }

    if (cutTicks.has(tick)) {
      const frame = frameAt(tick + 0.001);
      if (frame) setFrame(player, frame, 0);
      return true;
    }

    const aim = Math.min(tick + LEAD, nextCut(tick) - 0.01, totalTicks);
    const frame = frameAt(aim);
    if (frame) setFrame(player, frame, Math.max(0.5, aim - tick));
    return true;
  }

  setFrame(player, frameAt(0), 0);

  const driver = system.runInterval(() => {
    if (!alive(player) || !busy.has(player.id) || trips.get(player.id) !== startTick) {
      system.clearRun(driver);
      return;
    }
    const tick = system.currentTick - startTick;
    let keep;
    try {
      keep = run(tick);
    } catch {
      release(player);
      keep = false;
    }
    if (!keep) system.clearRun(driver);
  }, 1);
}

export function watch() {
  world.afterEvents.playerLeave.subscribe((e) => {
    busy.delete(e.playerId);
    unload(e.playerId);
    trips.delete(e.playerId);
  });

  world.afterEvents.worldLoad?.subscribe(() => {
    system.runTimeout(sweepAreas, 20);
  });

  world.afterEvents.playerSpawn.subscribe((e) => {
    if (!e.initialSpawn) return;
    release(e.player);
  });

  world.afterEvents.entityDie.subscribe((e) => {
    release(e.deadEntity);
  }, { entityTypes: ["minecraft:player"] });
}