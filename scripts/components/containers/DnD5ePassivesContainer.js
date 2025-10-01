// Import SelectionDialog from core
const SelectionDialogModule = await import('/modules/bg3-hud-core/scripts/components/ui/SelectionDialog.js');
const SelectionDialog = SelectionDialogModule.SelectionDialog;

const MODULE_ID = 'bg3-hud-dnd5e';

/**
 * Create D&D 5e Passives Container
 * Factory function to avoid import issues with core
 */
export async function createDnD5ePassivesContainer() {
    // Import core PassivesContainer dynamically
    const { PassivesContainer } = await import('/modules/bg3-hud-core/scripts/components/containers/PassivesContainer.js');
    
    /**
     * D&D 5e Passives Container
     * Displays passive features/traits for D&D 5e
     * Shows ALL features (feats) in alphabetical order for selection
     */
    class DnD5ePassivesContainer extends PassivesContainer {
        /**
         * Get all passive items (all feat-type items for D&D 5e)
         * @returns {Array<Item>} Array of feat items
         */
        getPassiveItems() {
            if (!this.actor) return [];
            
            // Return all feat items - let the user decide what to display
            return this.actor.items.filter(item => item.type === 'feat');
        }

        /**
         * Get the set of selected passive UUIDs
         * Stored in actor flags
         * @returns {Set<string>} Set of item UUIDs that should be displayed
         */
        getSelectedPassives() {
            const saved = this.actor.getFlag(MODULE_ID, 'selectedPassives');
            if (saved && Array.isArray(saved)) {
                return new Set(saved);
            }
            
            // Default: show nothing (user must configure)
            return new Set();
        }

        /**
         * Save selected passives to actor flags
         * @param {Array<string>} uuids - Array of selected UUIDs
         * @private
         */
        async _saveSelectedPassives(uuids) {
            await this.actor.setFlag(MODULE_ID, 'selectedPassives', uuids);
        }

        /**
         * Show configuration dialog to select which passives to display
         * @param {Event} event - The triggering event
         */
        async showConfigurationDialog(event) {
            const allFeatures = this.getPassiveItems();
            const selected = this.getSelectedPassives();

            // Build items array for dialog
            const items = allFeatures.map(feature => ({
                id: feature.uuid,
                label: feature.name,
                img: feature.img,
                selected: selected.has(feature.uuid)
            }));

            // Create and show dialog
            const dialog = new SelectionDialog({
                title: 'Select Passive Features',
                items: items,
                onSave: async (selectedIds) => {
                    await this._saveSelectedPassives(selectedIds);
                    // Don't call render() here - the actor flag update will trigger
                    // a refresh via the updateActor hook, which will efficiently
                    // update only the passives container
                }
            });

            await dialog.render();
        }
    }
    
    return DnD5ePassivesContainer;
}

