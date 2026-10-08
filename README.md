# WAYpoint

A Minecraft Bedrock add-on for building, controlling and teleporting between structure instances with cinematic cross-dimension travel.

## Structure / Teleport Tool

The add-on no longer uses manually created waypoints. It stores **structure instances** instead.

- Use the **Structure / Teleport Tool** to open the structure browser.
- Choose a `.mcstructure` from `pack/behavior_pack/WAYpoint/structures/` and build it at your position.
- Every structure automatically receives a control stone at its origin corner.
- The control stone is both a teleport destination and the structure controller.
- The controller supports teleporting, moving, rotating, mirroring, replacing, renaming and removing the structure.
- Control stones cannot be placed manually; they are generated only by the structure system.
- Add a new `.mcstructure` under `BP/structures` and run `make`; the catalog is generated automatically.

The tool can also be opened with `/voxen:structures`. Give it with `/voxen:structure_tool` or the existing staff recipe. Cross-dimension travel, cinematic camera transitions and sound settings remain available.

## Installation

1. Import `WAYpoint.mcaddon`, or import both `.mcpack` files.
2. Enable either pack; behavior and resource packs declare mutual dependencies and activate each other.
3. Cheats/commands must be enabled because the travel animation uses ticking areas and structure commands.

Requires Bedrock 1.21.100+ with `@minecraft/server` 2.0.0 and `@minecraft/server-ui` 2.0.0.

## Build

```text
make          # scan structures and create .mcpack + .mcaddon
make scan     # regenerate the structure catalog
make check    # validate JavaScript and JSON resources
```

`*_x.mcstructure` files are accepted as optional terrain variants and are not shown as separate menu entries.

## Project layout

- `pack/behavior_pack/WAYpoint/structures/` — structure templates
- `pack/behavior_pack/WAYpoint/scripts/structure_dimensions.js` — generated catalog
- `pack/behavior_pack/WAYpoint/scripts/structure.js` — structure instances and control stones
- `pack/behavior_pack/WAYpoint/scripts/warp.js` — cinematic teleport implementation
- `tools/scan_structures.py` — build-time `.mcstructure` scanner
