import {
  BlockPermutation, CommandPermissionLevel, CustomCommandStatus, ItemStack, Player, system, world,
} from "@minecraft/server";

import { BLOCK, STAFF, STATE_ON, TOP, find, forget, say } from "./lib.js";
import { listMenu, staffMenu, touch } from "./ui.js";
import { watch } from "./warp.js";

function neighbour(block, dy) {
  try {
    return dy > 0 ? block.above(dy) : block.below(-dy);
  } catch {
    return undefined;
  }
}

function setAir(block) {
  try {
    block.setType("minecraft:air");
  } catch {}
}

function fitTop(base) {
  const up = neighbour(base, 1);
  if (!up) return;
  let on = false;
  try {
    on = base.permutation.getState(STATE_ON) === true;
  } catch {}
  if (up.typeId === TOP) {
    try {
      if (up.permutation.getState(STATE_ON) !== on) {
        up.setPermutation(BlockPermutation.resolve(TOP, { [STATE_ON]: on }));
      }
    } catch {}
    return;
  }
  if (!up.isAir) return;
  try {
    up.setPermutation(BlockPermutation.resolve(TOP, { [STATE_ON]: on }));
  } catch {}
}

function isCreative(player) {
  try {
    return String(player?.getGameMode()).toLowerCase() === "creative";
  } catch {
    return false;
  }
}

system.beforeEvents.startup.subscribe((ev) => {
  const registry = ev.blockComponentRegistry;

  registry?.registerCustomComponent("voxen:waystone", {
    beforeOnPlayerPlace(e) {
      const up = neighbour(e.block, 1);
      if (up?.isAir) return;
      e.cancel = true;
      const player = e.player;
      if (player) system.run(() => say(player, "Cestovní kámen potřebuje dva bloky prázdného prostoru."));
    },

    onPlace(e) {
      fitTop(e.block);
    },

    onTick(e) {
      fitTop(e.block);
    },

    onPlayerInteract(e) {
      const player = e.player;
      if (!player) return;
      system.run(() => {
        touch(player, e.dimension.id, e.block.location);
      });
    },
  });

  registry?.registerCustomComponent("voxen:waystone_top", {
    onTick(e) {
      if (neighbour(e.block, -1)?.typeId !== BLOCK) setAir(e.block);
    },

    onPlayerInteract(e) {
      const player = e.player;
      const base = neighbour(e.block, -1);
      if (!player || base?.typeId !== BLOCK) return;
      const location = base.location;
      system.run(() => {
        touch(player, e.dimension.id, location);
      });
    },
  });

  const reg = ev.customCommandRegistry;
  if (!reg) return;

  const lister = ({ sourceEntity: player }) => {
    if (!(player instanceof Player)) return { status: CustomCommandStatus.Failure };
    system.run(() => { listMenu(player); });
    return { status: CustomCommandStatus.Success };
  };

  const giver = ({ sourceEntity: player }) => {
    if (!(player instanceof Player)) return { status: CustomCommandStatus.Failure };
    system.run(() => { give(player, BLOCK, "Cestovní kámen"); });
    return { status: CustomCommandStatus.Success };
  };

  const staffGiver = ({ sourceEntity: player }) => {
    if (!(player instanceof Player)) return { status: CustomCommandStatus.Failure };
    system.run(() => { give(player, STAFF, "Cestovní hůl"); });
    return { status: CustomCommandStatus.Success };
  };

  const commands = [
    ["voxen:waystones", "Všechny cestovní kameny uložené v tomto světě", lister],
    ["voxen:waystone_block", "Dej si jeden blok cestovního kamene", giver],
    ["voxen:waystone_staff", "Dej si jednu cestovní hůl", staffGiver],
  ];

  for (const [name, description, handler] of commands) {
    try {
      reg.registerCommand({
        name,
        description,
        cheatsRequired: false,
        permissionLevel: CommandPermissionLevel.Any,
      }, handler);
    } catch {}
  }
});

function give(player, id, label) {
  const stack = new ItemStack(id, 1);
  const container = player.getComponent("minecraft:inventory")?.container;

  if (container) {
    let leftover;
    try { leftover = container.addItem(stack); } catch { leftover = stack; }
    if (!leftover) {
      say(player, `Dostal jsi: ${label}.`);
      return;
    }
  }

  try {
    player.dimension.spawnItem(stack, player.location);
    say(player, `Tvůj inventář je plný, takže předmět ${label} vypadl u tvých nohou.`);
  } catch {
    say(player, `Pro ${label} nebylo místo.`);
  }
}

function forgetAt(player, dimId, location) {
  const entry = find(dimId, location);
  if (!entry) return;
  forget(entry);
  if (player) say(player, `${entry.n} už není cílem.`);
}

function brokeBase(e) {
  const up = neighbour(e.block, 1);
  if (up?.typeId === TOP) setAir(up);
  forgetAt(e.player, e.dimension.id, e.block.location);
}

function brokeTop(e) {
  const base = neighbour(e.block, -1);
  if (base?.typeId !== BLOCK) return;
  forgetAt(e.player, e.dimension.id, base.location);
  if (isCreative(e.player)) {
    setAir(base);
    return;
  }
  const { x, y, z } = base.location;
  try {
    e.dimension.runCommand(`setblock ${x} ${y} ${z} air destroy`);
  } catch {
    setAir(base);
  }
}

world.afterEvents.playerBreakBlock.subscribe((e) => {
  const broken = e.brokenBlockPermutation?.type?.id;
  if (broken === BLOCK) brokeBase(e);
  else if (broken === TOP) brokeTop(e);
});

world.afterEvents.itemUse.subscribe((e) => {
  const player = e.source;
  if (e.itemStack?.typeId !== STAFF || !(player instanceof Player)) return;
  system.run(() => { staffMenu(player); });
});

watch();