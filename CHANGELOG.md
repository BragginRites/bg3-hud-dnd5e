## [0.2.0] - 2026-01-05

### Fixed
- **Melee Weapon Range**: Fixed melee weapons not showing range indicator. Now correctly uses `reach` value or defaults to 5ft for melee action types.
- **Touch Spell Range**: Touch range now returns 1 grid square instead of feet.

## [0.1.11] - 2026-01-05

### Fixed
- **Target Selector Range**: Fixed touch range returning feet (5) instead of grid squares (1). Reach bonuses now also correctly convert to grid squares.

## [0.1.10] - 2026-01-04

### Added
- **Portrait Scaling**: Implemented `getPortraitScale()` override to support "Scale with Token" option. Portrait container now resizes based on token scale, expanding upward and leftward.
- **Tooltip Blacklist**: Adapter now passes `tooltipClassBlacklist` config to core, filtering out D&D 5e tooltip classes without hardcoding in core.
- **Animated Portrait Support**: Uses core's `_createMediaElement()` for WEBM/MP4 animated token support. Health overlay bend mask skipped for video (incompatible technique).

### Changed
- **CPR Actions Menu**: Moved CPR Actions selector inside the Third Party Modules submenu as a button, reducing top-level settings clutter.
- **Third Party Menu**: Third Party Modules submenu now builds sections dynamically based on installed modules (CPR, Midi-QoL). Only shows if at least one module is present (#11).

## [0.1.9] - 2025-12-25

> 🎄 **Merry Christmas and Happy Holidays!** 🎄

### Changed
- **Discord Link Updated**: Updated community Discord invite link.

### Fixed
- **Passive Features Reset**: Fixed issue where passive feature selections were reset when placing tokens (Issue #9):
  - **Linked actors**: Auto-populate now checks if passives are already configured before overwriting.
  - **Unlinked tokens**: Added "Save for all tokens of this type" toggle in passives dialog. When enabled, saves item IDs to the base actor so future tokens inherit those passives with correctly translated UUIDs.

### Added
- **Spell Slot Grouping**: Spell level filters (I-IX, Pact) are now grouped under an expandable "Spell Slots" button to reduce filter bar clutter. Cantrips remain standalone.

## [0.1.8] - 2025-12-21
### Changed
- **Dialog Synchronization**: All dialogs are now synchronized to use consistent `DialogV2` styling and behavior (Issue #11).
- **Manifest Updates**: Updated manifest URL to point to `latest` release for easier updates (Issue #10).

## [0.1.7] - 2025-12-20
### Changed
- **DialogV2 Migration**: Updated dialogs to use core's new `DialogV2`-based utilities for consistent Foundry V13 styling:
  - Passives selection dialog now uses `showSelectionDialog()`.
  - CPR Actions selection dialog now uses `showSelectionDialog()` with max selections support.
  - Auto-populate configuration dialog now uses `showAutoPopulateConfigDialog()`.

## [0.1.6] - 2025-12-19
### Fixed
- **Pact Slots Filter**: Fixed issue where the Pact Magic filter button would not appear in the filter list even when the actor had Pact Magic spells.

## [0.1.5] - 2025-12-19
### Fixed
- **Monster Spell Auto-Populate**: Fixed issue where spells from monsters (MM 2024 and earlier) would not appear in the spell grid on token creation. CPR auto-populate now runs after all grids are populated via core's `onTokenCreationComplete` hook, preventing race conditions with state saving.

## [0.1.4] - 2025-12-17
### Added
- **Activity Drag-and-Drop**: Added full support for dragging individual D&D 5e activities (e.g. "Throw" vs "Melee" attack) onto the hotbar.
- **Auto-Populate Activities**: New option "Include Individual Activities" in Auto-Populate configuration. When enabled, items with multiple activities will populate each activity as a separate cell entry.

## [0.1.3] - 2025-12-17
### Added
- **Prepared Spell Filtering**: Separate settings for Players (default: on) and NPCs (default: off) to filter spell containers to only show prepared spells. At-will, innate, and pact magic spells are always included.

### Changed
- **Macro Support**: Removed redundant macro handling - now delegated to core for system-agnostic execution.

## [0.1.2] - 2025-12-16
### Changed
- **Consistency Update**: Changelog added for consistency with the new modular architecture.

## [0.1.1] - 2025-12-15
### Added
- Initial modular release of `bg3-hud-dnd5e`.
- Provides the D&D 5e system adapter for the BG3 Inspired HUD.
- Requires `bg3-hud-core` to function.
