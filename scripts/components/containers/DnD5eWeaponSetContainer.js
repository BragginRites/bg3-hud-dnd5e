/**
 * D&D 5e Weapon Set Container
 * Extends base WeaponSetContainer with D&D 5e specific features:
 * - Two-handed weapons occupy both slots
 * - Second slot shows faded duplicate of two-handed weapon
 * - Prevents drops on locked second slots
 */

export async function createDnD5eWeaponSetContainer() {
    // Import base WeaponSetContainer from core
    const { WeaponSetContainer } = await import('../../../../bg3-hud-core/scripts/components/containers/WeaponSetContainer.js');
    
    return class DnD5eWeaponSetContainer extends WeaponSetContainer {
        constructor(options = {}) {
            super(options);
        }

        /**
         * Check if an item is a two-handed weapon
         * @param {Object} cellData - Cell data object with uuid
         * @returns {Promise<boolean>}
         * @private
         */
        async _isTwoHandedWeapon(cellData) {
            if (!cellData?.uuid) return false;
            
            try {
                const item = await fromUuid(cellData.uuid);
                if (!item) return false;
                
                // Check if it's a weapon
                if (item.type !== 'weapon') return false;
                
                // Check for two-handed property
                // D&D 5e v5+: properties is a Set
                const properties = item.system?.properties;
                if (properties instanceof Set) {
                    return properties.has('two');
                }
                // Fallback for older versions: properties might be an object/array
                if (properties && typeof properties === 'object') {
                    if (Array.isArray(properties)) {
                        return properties.includes('two');
                    }
                    return properties.two === true;
                }
                
                return false;
            } catch (error) {
                console.warn('BG3 HUD D&D 5e | Error checking two-handed weapon:', error);
                return false;
            }
        }

        /**
         * Override render to handle two-handed weapon duplication
         * @returns {Promise<HTMLElement>}
         */
        async render() {
            // Call parent render first
            await super.render();
            
            // Process each weapon set for two-handed weapons
            await this._updateTwoHandedWeapons();
            
            return this.element;
        }

        /**
         * Update all weapon sets to show two-handed weapon duplicates
         * @private
         */
        async _updateTwoHandedWeapons() {
            for (let setIndex = 0; setIndex < this.gridContainers.length; setIndex++) {
                const gridContainer = this.gridContainers[setIndex];
                await this._updateSetTwoHandedWeapons(gridContainer);
            }
        }

        /**
         * Update a single weapon set for two-handed weapons
         * @param {GridContainer} gridContainer
         * @private
         */
        async _updateSetTwoHandedWeapons(gridContainer) {
            // Only process if this is a 2-slot weapon set (1 row, 2 cols)
            if (gridContainer.rows !== 1 || gridContainer.cols !== 2) return;
            
            const leftCell = gridContainer.getCell(0, 0);  // Left slot (col 0, row 0)
            const rightCell = gridContainer.getCell(1, 0); // Right slot (col 1, row 0)
            
            if (!leftCell || !rightCell) return;
            
            // Check left slot for two-handed weapon
            if (leftCell.data && await this._isTwoHandedWeapon(leftCell.data)) {
                // Duplicate to right slot with special marker
                const duplicateData = {
                    ...leftCell.data,
                    isTwoHandedDuplicate: true,
                    sourceSlot: '0-0'
                };
                await rightCell.setData(duplicateData, { skipSave: true });
                rightCell.element.classList.add('two-handed-duplicate');
                rightCell.element.dataset.locked = 'true';
            } else {
                // Clear duplicate marker if right cell was previously a duplicate
                if (rightCell.data?.isTwoHandedDuplicate) {
                    await rightCell.setData(null, { skipSave: true });
                }
                rightCell.element.classList.remove('two-handed-duplicate');
                delete rightCell.element.dataset.locked;
            }
        }

        /**
         * Override updateSet to handle two-handed weapons after update
         * @param {number} setIndex
         * @param {Object} newData
         */
        async updateSet(setIndex, newData) {
            await super.updateSet(setIndex, newData);
            
            // Update two-handed weapon display
            const gridContainer = this.gridContainers[setIndex];
            if (gridContainer) {
                await this._updateSetTwoHandedWeapons(gridContainer);
            }
        }

        /**
         * Check if a cell is locked (occupied by two-handed weapon duplicate)
         * @param {GridCell} cell
         * @returns {boolean}
         */
        isCellLocked(cell) {
            return cell.element.dataset.locked === 'true';
        }

        /**
         * Handle drop on a cell - prevent drops on locked cells
         * This method is called by the interaction coordinator
         * @param {GridCell} targetCell
         * @param {DragEvent} event
         * @param {Object} dragData
         * @returns {boolean} - true if drop should be prevented
         */
        shouldPreventDrop(targetCell) {
            // Prevent drop on locked cells (two-handed duplicates)
            if (this.isCellLocked(targetCell)) {
                ui.notifications.warn('This slot is occupied by a two-handed weapon');
                return true;
            }
            return false;
        }

        /**
         * After a cell is updated, check if we need to update two-handed weapon display
         * @param {number} setIndex
         * @param {string} slotKey
         */
        async onCellUpdated(setIndex, slotKey) {
            const gridContainer = this.gridContainers[setIndex];
            if (gridContainer) {
                await this._updateSetTwoHandedWeapons(gridContainer);
            }
        }
    };
}
