# WAYpoint

A Minecraft Bedrock (PE) add-on that lets you **save your favorite places as waypoints** and **teleport to any of them** with a GTA 5–style character switch. Instead of remembering coordinates, simply place a **Waystone** block, name it, and travel there whenever you want — with cinematic camera transitions, sounds, and optional cross‑dimension support.

---

## ✨ Features

- **Waystone blocks** — placeable, craftable blocks that act as teleport anchors.
- **GTA 5–style character switch** — cinematic camera transition when traveling between waypoints.
- **Save unlimited waypoints** — up to **64** per world.
- **Cross‑dimension travel** — Overworld, Nether, and End are supported.
- **Private / public waystones** — mark a waystone as private so only you can see and use it.
- **Search & list** — browse all saved waypoints in a clean menu.
- **Sound styles** — choose between *Cinematic* (GTA) or *Classic* (Minecraft portal) audio.
- **Waystone Staff** — a hand‑held tool for quick access to the waypoint menu.
- **Custom commands** — list, give, and manage waystones via chat commands.
- **Localized** — English and Czech texts included.

---

## 📦 Installation

1. Download the repository contents (or build an `.mcaddon` by combining the behavior and resource packs).
2. In Minecraft Bedrock Edition, go to **Settings → Storage → Resource Packs** and import the resource pack.
3. Then import the behavior pack in the same way.
4. When creating a new world (or in an existing world's settings), enable both packs:
   - **WAYpoint** (behavior pack) — must be active, otherwise the add‑on will not work.
   - **WAYpoint** (resource pack) — provides textures, models, and sounds.
5. Make sure **cheats / commands** are enabled in the world — the add‑on uses commands for ticking areas.

> **Note:** The add‑on requires Minecraft Bedrock **1.21.100** or newer and the modules `@minecraft/server` (2.0.0) and `@minecraft/server-ui` (2.0.0).

---

## 🎮 Usage

### Crafting

| Item | Recipe |
|---|---|
| **Waystone** | 3× Stone Bricks (top row) + 1× Ender Pearl (middle center) + 3× Stone Bricks (bottom row) |
| **Waystone Staff** | 1× Ender Pearl (top) + 2× Sticks (middle & bottom) |

### Placing & naming a waystone

1. Place a **Waystone** block on the ground.
2. Right‑click / tap the block.
3. Enter a name for the waystone (max 24 characters).
4. Optionally toggle **Private waystone** so only you can see and use it.

### Teleporting

- Right‑click / tap any **Waystone** to open the travel menu.
- Select a destination from the list.
- The add‑on will play a cinematic transition and teleport you to the target.
- You can also use the **Waystone Staff** to open the menu from anywhere.

### Commands

| Command | Description |
|---|---|
| `/voxen:waystones` | List all waystones saved in the world. |
| `/voxen:waystone_block` | Give yourself one Waystone block. |
| `/voxen:waystone_staff` | Give yourself a Waystone Staff. |

### Settings

In the waypoint menu you can change:

- **Sound style** — Cinematic (GTA) or Classic (Minecraft portal).
- **Portal sound** — toggle on/off.
- **Rename / Delete** — manage your own waystones.

---

## 🗂️ Project Structure

```text
WAYpoint/
└── pack/
    ├── behavior_pack/
    │   └── WAYpoint/
    │       ├── blocks/              # waystone.json, waystone_top.json
    │       ├── cameras/presets/voxen/
    │       │   └── warp.json        # Camera preset for travel animation
    │       ├── items/               # waystone_staff.json
    │       ├── recipes/             # waystone.json, waystone_ring.json, waystone_staff.json
    │       ├── scripts/             # lib.js, main.js, sound.js, ui.js, warp.js
    │       ├── texts/               # en_US.lang, languages.json
    │       ├── manifest.json
    │       └── pack_icon.png
    └── resource_pack/
        └── WAYpoint/
            ├── models/blocks/       # Block models
            ├── sounds/              # Audio files
            ├── texts/               # Language files
            ├── textures/            # Textures for blocks, items, UI
            ├── manifest.json
            └── pack_icon.png
```

### Key Files

| File | Description |
|---|---|
| `scripts/main.js` | Entry point — registers custom components, commands, and block behaviors. |
| `scripts/lib.js` | Shared constants and helper functions (waystone storage, naming, validation). |
| `scripts/ui.js` | Menu forms — list, naming, travel, settings. |
| `scripts/warp.js` | Teleportation logic — camera animation, ticking areas, cross‑dimension travel. |
| `scripts/sound.js` | Sound styles and audio cues. |
| `blocks/waystone.json` | Waystone block definition (states, geometry, components). |
| `items/waystone_staff.json` | Waystone Staff item definition. |

---

## ⚠️ Limitations

- **Maximum 64 waystones** per world. You cannot save more than that.
- **Ticking areas** — the add‑on uses ticking areas for cross‑dimension travel. Make sure commands are enabled.
- **Large travel distances** — cross‑dimension travel may take a few seconds to load chunks.
- The add‑on requires **cheats** to be enabled in the world.

---

## 📄 License

The repository does not include a license file. If you plan to distribute the add‑on further, contact the author (**PhateValleyman** / **Voxen**) for clarification of the terms.

---

## 🙏 Credits

- **PhateValleyman** / **Voxen** — author of the add‑on.
- The Minecraft Bedrock community for the scripting API possibilities.

## Kontrolní kámen a struktury

Waypoint je zároveň kontrolní kámen pro struktury. Po klepnutí na uložený kámen nabídne:

- původní teleporty mezi waypointy,
- výběr a postavení struktury z `pack/behavior_pack/WAYpoint/structures/`,
- úpravu aktuální struktury (znovu postavit, otočit, zrcadlit nebo odstranit),
- zachování kontrolního kamene na rohu každé struktury.

Novou strukturu stačí vložit jako `.mcstructure` do `BP/structures`. Při `make`, `make scan` nebo balení add-onu se automaticky načtou rozměry a vytvoří runtime katalog; není potřeba upravovat JavaScript, seznam kategorií ani ručně zadávat rozměry. Soubory s příponou `_x.mcstructure` jsou brány jako volitelné terénní podložky a v menu se nezobrazují.

Bedrock skripty nemají přístup k souborovému systému add-onu za běhu, proto je automatická detekce řešena při buildu pomocí `tools/scan_structures.py`.

### Ikona a automatická aktivace

Behavior pack i resource pack používají stejnou ikonu. Oba manifesty mají vzájemnou závislost, takže aktivace jednoho packu automaticky aktivuje i druhý.

Menu struktur používá obrazový náhled kontrolního kamene místo čistě textového seznamu. Každá načtená struktura dostane po postavení kontrolní kámen na svém rohovém bodě. Ten zůstává waypointem a zároveň dovoluje strukturu znovu postavit, změnit otočení/zrcadlení, přesunout ke hráči nebo odstranit.
