/**
 * BG3 HUD D&D 5e Adapter Module
 * Registers D&D 5e specific components with the BG3 HUD Core
 */

import { createDnD5ePortraitContainer } from './components/containers/DnD5ePortraitContainer.js';
import { createDnD5ePassivesContainer } from './components/containers/DnD5ePassivesContainer.js';

const MODULE_ID = 'bg3-hud-dnd5e';

console.log('BG3 HUD D&D 5e | Loading adapter');

/**
 * Wait for core to be ready, then register D&D 5e components
 */
Hooks.on('bg3HudReady', async (BG3HUD_API) => {
    console.log('BG3 HUD D&D 5e | Received bg3HudReady hook');
    
    // Verify we're in D&D 5e system
    if (game.system.id !== 'dnd5e') {
        console.warn('BG3 HUD D&D 5e | Not running D&D 5e system, skipping registration');
        return;
    }

    console.log('BG3 HUD D&D 5e | Registering D&D 5e components');

    // Create the portrait container class (extends core's PortraitContainer)
    const DnD5ePortraitContainer = await createDnD5ePortraitContainer();
    
    // Create the passives container class (extends core's PassivesContainer)
    const DnD5ePassivesContainer = await createDnD5ePassivesContainer();
    
    // Register D&D 5e portrait container (includes health display)
    BG3HUD_API.registerPortraitContainer(DnD5ePortraitContainer);
    
    // Register D&D 5e passives container (feat selection)
    BG3HUD_API.registerPassivesContainer(DnD5ePassivesContainer);

    // TODO: Register other D&D 5e specific components
    // BG3HUD_API.registerContainer('deathSaves', DeathSavesContainer);
    // BG3HUD_API.registerContainer('restTurn', RestTurnContainer);

    // Create and register the adapter instance
    const adapter = new DnD5eAdapter();
    BG3HUD_API.registerAdapter(adapter);

    console.log('BG3 HUD D&D 5e | Registration complete');
    
    // Signal that adapter registration is complete
    Hooks.call('bg3HudRegistrationComplete');
});

/**
 * D&D 5e Adapter Class
 * Handles system-specific interactions and data transformations
 */
class DnD5eAdapter {
    constructor() {
        this.systemId = 'dnd5e';
        this.name = 'D&D 5e Adapter';
    }

    /**
     * Handle cell click (use item/spell/feature)
     * @param {GridCell} cell - The clicked cell
     * @param {MouseEvent} event - The click event
     */
    async onCellClick(cell, event) {
        const data = cell.data;
        if (!data) return;

        console.log('D&D 5e Adapter | Cell clicked:', data);

        // Handle different data types
        switch (data.type) {
            case 'Item':
                await this._useItem(data.uuid, event);
                break;
            case 'Macro':
                await this._executeMacro(data.uuid);
                break;
            default:
                console.warn('D&D 5e Adapter | Unknown cell data type:', data.type);
        }
    }

    /**
     * Get context menu items for a cell
     * @param {GridCell} cell - The cell to get menu items for
     * @returns {Array} Menu items
     */
    async getCellMenuItems(cell) {
        const data = cell.data;
        if (!data) return [];

        const items = [];

        // Add D&D 5e specific menu items based on data type
        if (data.type === 'Item') {
            items.push({
                label: 'Open Item Sheet',
                icon: 'fas fa-book-open',
                onClick: async () => {
                    const item = await fromUuid(data.uuid);
                    if (item) {
                        item.sheet.render(true);
                    }
                }
            });
        }

        return items;
    }

    /**
     * Use a D&D 5e item
     * @param {string} uuid - Item UUID
     * @param {MouseEvent} event - The triggering event
     * @private
     */
    async _useItem(uuid, event) {
        const item = await fromUuid(uuid);
        if (!item) {
            ui.notifications.warn('Item not found');
            return;
        }

        console.log('D&D 5e Adapter | Using item:', item.name);

        // Use the item (D&D 5e v4+ uses .use() method)
        if (typeof item.use === 'function') {
            await item.use({ event });
        } else {
            ui.notifications.warn('Item cannot be used');
        }
    }

    /**
     * Execute a macro
     * @param {string} uuid - Macro UUID
     * @private
     */
    async _executeMacro(uuid) {
        const macro = await fromUuid(uuid);
        if (!macro) {
            ui.notifications.warn('Macro not found');
            return;
        }

        console.log('D&D 5e Adapter | Executing macro:', macro.name);
        await macro.execute();
    }
}

