/**
 * BG3 HUD D&D 5e Adapter Module
 * Registers D&D 5e specific components with the BG3 HUD Core
 */

import { createDnD5ePortraitContainer } from './components/containers/DnD5ePortraitContainer.js';
import { createDnD5ePassivesContainer } from './components/containers/DnD5ePassivesContainer.js';
import { DnD5eActionButtonsContainer } from './components/containers/DnD5eActionButtonsContainer.js';
import { DnD5eFilterContainer } from './components/containers/DnD5eFilterContainer.js';
import { DnD5eAutoSort } from './features/DnD5eAutoSort.js';
import { DnD5eAutoPopulate } from './features/DnD5eAutoPopulate.js';

const MODULE_ID = 'bg3-hud-dnd5e';

console.log('BG3 HUD D&D 5e | Loading adapter');

/**
 * Register settings
 */
Hooks.once('init', () => {
    console.log('BG3 HUD D&D 5e | Registering settings');
    
    // Enable/disable auto-populate on token creation
    game.settings.register(MODULE_ID, 'autoPopulateEnabled', {
        name: 'Enable Auto-Populate on Token Creation',
        hint: 'Automatically populate the HUD when a token is first created. Configure which item types go to which grids using the menu below.',
        scope: 'world',
        config: true,
        type: Boolean,
        default: false,
        restricted: true
    });

    // Auto-populate configuration (hidden, accessed via menu)
    game.settings.register(MODULE_ID, 'autoPopulateConfiguration', {
        name: 'Auto-Populate Configuration',
        scope: 'world',
        config: false,
        type: Object,
        default: {
            grid0: ['weapon'], // Default: weapons in grid 0 (Grid 1 in UI)
            grid1: ['spell'],   // Default: spells in grid 1 (Grid 2 in UI)
            grid2: ['consumable:potion', 'consumable:poison', 'consumable:scroll'] // Default: potions, poisons, scrolls in grid 2 (Grid 3 in UI)
        }
    });
    
    // Register a menu button to configure item types per grid
    game.settings.registerMenu(MODULE_ID, 'autoPopulateMenu', {
        name: 'Configure Auto-Populate Item Types',
        label: 'Configure Item Assignment',
        hint: 'Assign which item types are automatically added to each hotbar grid when creating tokens.',
        icon: 'fas fa-cog',
        type: AutoPopulateConfigMenu,
        restricted: true // GM only
    });
});

/**
 * Settings Menu for Auto-Populate Configuration
 * Opens the grid assignment dialog directly
 */
class AutoPopulateConfigMenu extends FormApplication {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            popOut: false // Don't create a form, just trigger the dialog
        });
    }

    async render() {
        // Don't render a form, just open the config dialog immediately
        await this._showConfigDialog();
        return this;
    }

    async _showConfigDialog() {
        const adapter = ui.BG3HOTBAR?.registry?.activeAdapter;
        if (!adapter || !adapter.autoPopulate) {
            ui.notifications.error('Auto-populate adapter not available');
            return;
        }

        try {
            // Import the dialog (fix the path - it's in modules folder)
            const { AutoPopulateConfigDialog } = await import('../../bg3-hud-core/scripts/components/ui/AutoPopulateConfigDialog.js');
            
            const choices = await adapter.autoPopulate.getItemTypeChoices();
            const configuration = game.settings.get(MODULE_ID, 'autoPopulateConfiguration');

            const dialog = new AutoPopulateConfigDialog({
                choices: choices,
                configuration: configuration
            });

            const result = await dialog.render();
            
            if (result) {
                // Save the new configuration
                await game.settings.set(MODULE_ID, 'autoPopulateConfiguration', result);
                ui.notifications.info('Auto-populate configuration saved');
            }
        } catch (error) {
            console.error('BG3 HUD D&D 5e | Error opening auto-populate config:', error);
            ui.notifications.error('Failed to open configuration dialog');
        }
    }
}

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
    
    // Register D&D 5e action buttons container (rest/turn buttons)
    BG3HUD_API.registerActionButtonsContainer(DnD5eActionButtonsContainer);
    
    // Register D&D 5e filter container (action types, spell slots)
    BG3HUD_API.registerFilterContainer(DnD5eFilterContainer);

    // TODO: Register other D&D 5e specific components
    // BG3HUD_API.registerContainer('deathSaves', DeathSavesContainer);

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
        this.MODULE_ID = MODULE_ID; // Expose for core to access
        this.systemId = 'dnd5e';
        this.name = 'D&D 5e Adapter';
        
        // Initialize D&D 5e-specific features
        this.autoSort = new DnD5eAutoSort();
        this.autoPopulate = new DnD5eAutoPopulate();
        
        // Link autoPopulate to autoSort for consistent sorting
        this.autoPopulate.setAutoSort(this.autoSort);
        
        console.log('BG3 HUD D&D 5e | DnD5eAdapter created with autoSort and autoPopulate');
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

    /**
     * Decorate a cell element with D&D 5e-specific dataset attributes
     * This allows filters to match cells by action type, spell level, etc.
     * @param {HTMLElement} cellElement - The cell element to decorate
     * @param {Object} cellData - The cell's data object
     */
    async decorateCellElement(cellElement, cellData) {
        if (!cellData || !cellData.uuid) return;

        // Get the item from UUID
        const item = await fromUuid(cellData.uuid);
        if (!item) return;

        // Add item type
        cellElement.dataset.itemType = item.type;

        // Add spell-specific attributes
        if (item.type === 'spell') {
            cellElement.dataset.level = item.system?.level ?? 0;
            // D&D 5e v5.1+: use .method instead of deprecated .preparation.mode
            cellElement.dataset.preparationMode = item.system?.method ?? item.system?.preparation?.mode ?? '';
        }

        // Extract action types from activities (D&D 5e v5+)
        // This applies to ALL item types: spells, weapons, feats, etc.
        const activities = item.system?.activities;
        if (activities) {
            const actionTypes = new Set();

            // Activities is a Foundry Collection (Map-like), not a plain object
            // We need to iterate using Collection methods or convert to array
            let activityList = [];
            
            // Check if it's a Collection with .contents property
            if (activities.contents) {
                activityList = activities.contents;
            }
            // Or if it has a values() method (Map-like)
            else if (typeof activities.values === 'function') {
                activityList = Array.from(activities.values());
            }
            // Fallback to Object.values for plain objects
            else if (typeof activities === 'object') {
                activityList = Object.values(activities);
            }
            
            for (const activity of activityList) {
                if (activity?.activation?.type) {
                    actionTypes.add(activity.activation.type);
                }
            }

            // Store all action types as comma-separated list
            if (actionTypes.size > 0) {
                cellElement.dataset.activityActionTypes = Array.from(actionTypes).join(',');
                
                // For backward compatibility, also set the first action type
                cellElement.dataset.actionType = Array.from(actionTypes)[0];
            }
        }

        // Fallback to legacy activation type if no activities found
        if (!cellElement.dataset.actionType && item.system?.activation?.type) {
            cellElement.dataset.actionType = item.system.activation.type;
        }
    }
}

