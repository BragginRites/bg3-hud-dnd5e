## [0.3.0] - 2026-04-28

### Changed
- Keeps pace with core 0.3.0: passive choices, portrait (token vs art), and your advantage/disadvantage HUD buttons still update correctly when those change — same flow, internals lined up with the shared HUD codebase.
- **Rest Button Sizing**: Rest action button now sizes to its content instead of using fixed width/height dimensions.
- **Death Saves Visibility Scope**: "Hide Death Saves UI" now uses a world-level setting so the GM controls this behaviour for all users.
- **Group Actor Compatibility Setting**: Added a new world setting to ignore D&D 5e `group` actor types during HUD compatibility checks (enabled by default).

## [Branch Update: feature/minor-polish] - 2026-04-28

### Changed
- Branch update commit for `feature/minor-polish` to capture current in-progress module changes.

## [0.2.7] - 2026-04-25

### Added
- **Português (Brasil) Translation**: Added full localization support for Brazilian Portuguese, thanks to **Kharmans**.

### Fixed
- **Manifest URLs**: Updated manifest and download URLs in `module.json` to ensure correct update path for users.

## [0.2.6] - 2026-04-24

### Changed
- **Info Panel Redesign**: Complete overhaul of the character info panel with a minimalist, at-a-glance layout.
  - Replaced ability labels with static score columns and d20 modifier overlays.
  - Simplified skills grid into a 3-column layout.
  - Proficiency indicators using color-coded d20 icons with black outlines for readability.
- **UI Localization**: Updated localization for settings, context menus, and tooltips, and others.

## [0.2.5] - 2026-04-22

### Added
- **Simplified Saves**: Refactored the saves column to show one row per ability.
  - **Left-click**: Rolls an Ability Check.
  - **Right-click**: Rolls a Saving Throw.
- **Proficiency Borders**: Swapped proficiency icons for colored borders (Blue=Proficient, Gold=Expertise, Silver=Jack of all Trades).
- **Ability Scores**: Added display of raw ability scores alongside modifiers.

### Fixed
- **Object Object Bug**: Fixed saving throw modifiers displaying as `[object Object]` in DnD5e v5+.
- **UX Polish**: Removed redundant highlighting of the save row when an ability is selected in the middle column.
- **Saving Throw Accuracy**: Switched to using system-provided save values to correctly account for all bonuses (magic items, class features, etc.).

## [0.2.4] - 2026-01-28

### Fixed
- **Target Selector Min Targets**: Fixed spells like Bless requiring all targets instead of allowing "up to X". D&D5e spells say "up to X targets" so minTargets is now 1 instead of the count. (Core Issue #23)

## [0.2.3] - 2026-01-28

### Changed
- **Dependency Update**: Updated core dependency to version 0.2.3, which includes:
  - Fix for "Hide When BG3 HUD Visible" setting not working correctly (Issue #8).
- **Discord Link Updated**: Updated community Discord invite link.

### Fixed
- **Innate Spell Depletion**: Fixed innate spells granted by features (e.g., racial spellcasting) being incorrectly greyed out when the actor has no spell slots. Innate/at-will/pact magic spells now check their own uses instead of spell slot availability. (Issue #16)
- **Weapon Sets 2 & 3 Auto-Equip**: Fixed weapon sets 2 and 3 not auto-equipping/unequipping items when switching sets. The issue was that the switch logic was reading stale data from construction time instead of current cell data. (Issue #24)

## [0.2.2] - 2026-01-14

### Added
- **Show HP Control Buttons Setting**: New option in Display Settings to toggle visibility of the kill (skull) and heal (heart) buttons on the portrait. The HP input field remains visible when disabled. (Issue #21)

### Fixed
- **Portrait Alignment**: Fixed portrait position to properly align with the bottom of the hotbar.

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
