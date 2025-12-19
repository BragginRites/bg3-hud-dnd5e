## [0.1.7] - 2025-12-19
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
