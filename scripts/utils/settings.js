/**
 * Register D&D 5e adapter settings
 */
export function registerSettings() {
    const MODULE_ID = 'bg3-hud-dnd5e';

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

    // Enable/disable auto-populate passives on token creation
    game.settings.register(MODULE_ID, 'autoPopulatePassivesEnabled', {
        name: 'Auto-Populate Passives on Token Creation',
        hint: 'Automatically populate the passives container with features that have no activities when a token is first created.',
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
}

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
            const configuration = game.settings.get('bg3-hud-dnd5e', 'autoPopulateConfiguration');

            const dialog = new AutoPopulateConfigDialog({
                choices: choices,
                configuration: configuration
            });

            const result = await dialog.render();

            if (result) {
                // Save the new configuration
                await game.settings.set('bg3-hud-dnd5e', 'autoPopulateConfiguration', result);
                ui.notifications.info('Auto-populate configuration saved');
            }
        } catch (error) {
            console.error('BG3 HUD D&D 5e | Error opening auto-populate config:', error);
            ui.notifications.error('Failed to open configuration dialog');
        }
    }
}
