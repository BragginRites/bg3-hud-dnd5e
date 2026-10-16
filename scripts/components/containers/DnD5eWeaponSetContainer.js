/**
 * D&D 5e Weapon Set Container
 * Extends base WeaponSetContainer with D&D 5e specific features:
 * - Two-handed weapons occupy both slots
 * - Second slot shows faded duplicate of two-handed weapon
 * - Prevents drops on locked second slots
 */

import { createLogger } from '/modules/bg3-hud-core/scripts/utils/logger.js';
import { isTwoHandedWeapon } from '../../features/ItemClassification.js';

const log = createLogger('bg3-hud-dnd5e');

export async function createDnD5eWeaponSetContainer() {
    // Import base WeaponSetContainer from core
    const { WeaponSetContainer } = await import('../../../../bg3-hud-core/scripts/components/containers/WeaponSetContainer.js');

    return class DnD5eWeaponSetContainer extends WeaponSetContainer {
        constructor(options = {}) {
            super(options);
        }

        /**
         * Check if an item is a two-handed weapon
         * @param {Item} item
         * @returns {boolean}
         * @private
         */
        _itemOccupiesBothSlots(item) {
            return isTwoHandedWeapon(item);
        }

        /**
         * i18n key used by shouldPreventDrop() when warning about a locked slot.
         * @returns {string}
         * @private
         */
        _lockedSlotWarningKey() {
            return 'bg3-hud-dnd5e.Notifications.SlotOccupiedByTwoHandedWeapon';
        }

        /**
         * Equip target set and unequip previously active set
         * @param {number} setIndex
         * @param {GridContainer} setContainer
         */
        async onSetSwitch(setIndex, setContainer) {
            const actor = this.actor;
            if (!actor) return;

            const currentActiveIndex = this.getActiveSet();
            const currentGrid = this.gridContainers[currentActiveIndex];

            const resolveSetItems = async (grid) => {
                // Use grid.cells to get current cell data (grid.items is stale - set at construction)
                if (!grid?.cells) return [];
                const items = [];
                for (const cell of grid.cells) {
                    const cellData = cell?.data;
                    if (!cellData?.uuid || cellData.isTwoHandedDuplicate) continue;
                    try {
                        const item = await fromUuid(cellData.uuid);
                        if (!item || item.actor?.id !== actor.id) continue;
                        if (!this._isWeaponOrShield(item)) continue;
                        items.push(item);
                    } catch (error) {
                        log.warn('Failed to resolve item for weapon set cell', error);
                    }
                }
                return items;
            };

            const [itemsToUnequip, itemsToEquip] = await Promise.all([
                resolveSetItems(currentGrid),
                resolveSetItems(setContainer),
            ]);

            const desiredStates = new Map();
            for (const item of itemsToUnequip) {
                desiredStates.set(item.id, { item, equipped: false });
            }
            for (const item of itemsToEquip) {
                desiredStates.set(item.id, { item, equipped: true });
            }

            const updates = [];
            for (const { item, equipped } of desiredStates.values()) {
                const current = item.system?.equipped === true;
                if (current !== equipped) {
                    updates.push({ _id: item.id, 'system.equipped': equipped });
                }
            }

            if (updates.length) {
                await actor.updateEmbeddedDocuments('Item', updates);
            }
        }

        /**
         * Determine if an item should be managed by weapon sets
         *
         * NOT merged with ItemClassification.js#isHeldDocument: that shared
         * predicate also treats consumable wands as "held", which is correct
         * for weapon-set slot occupancy but wrong here - onSetSwitch() uses
         * this method to decide which items get system.equipped toggled on
         * set-switch, and wands should not be auto-equipped/unequipped by a
         * weapon-set switch.
         * @param {Item} item
         * @returns {boolean}
         * @private
         */
        _isWeaponOrShield(item) {
            if (!item) return false;
            if (item.type === 'weapon') return true;
            if (item.type === 'equipment') {
                const typeValue = item.system?.type?.value || item.system?.type;
                const armorType = item.system?.armor?.type;
                return typeValue === 'shield' || armorType === 'shield';
            }
            return false;
        }
    };
}
