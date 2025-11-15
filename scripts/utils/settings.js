/**
 * Auto-populate Configuration Menu
 * FormApplication that directly opens the existing AutoPopulateConfigDialog
 */
class AutoPopulateConfigMenu extends FormApplication {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: 'bg3-hud-auto-populate-config',
            title: 'Auto-populate Configuration',
            width: 0,
            height: 0,
            closeOnSubmit: true
        });
    }

    async _render(force = false, options = {}) {
        // Don't render anything - just open the dialog directly
        const MODULE_ID = 'bg3-hud-dnd5e';
        
        // Get the adapter's autoPopulate instance
        const adapter = ui.BG3HOTBAR?.registry?.activeAdapter;
        if (!adapter || !adapter.autoPopulate) {
            ui.notifications.error('Auto-populate system not available');
            this.close();
            return;
        }

        // Get current configuration
        const currentConfig = game.settings.get(MODULE_ID, 'autoPopulateConfiguration');
        
        // Get item type choices from the adapter
        const choices = await adapter.autoPopulate.getItemTypeChoices();
        if (!choices || choices.length === 0) {
            ui.notifications.warn('No item types available for configuration');
            this.close();
            return;
        }

        // Close this form immediately
        this.close();

        // Import and show the dialog directly
        const { AutoPopulateConfigDialog } = await import('/modules/bg3-hud-core/scripts/components/ui/AutoPopulateConfigDialog.js');
        
        const dialog = new AutoPopulateConfigDialog({
            title: 'Configure Auto-populate Grids',
            choices: choices,
            configuration: currentConfig
        });

        const result = await dialog.render();
        
        // Save if not cancelled
        if (result) {
            await game.settings.set(MODULE_ID, 'autoPopulateConfiguration', result);
            ui.notifications.info('Auto-populate configuration saved');
        }
    }
}

/**
 * Register D&D 5e adapter module settings
 */
export function registerSettings() {
    const MODULE_ID = 'bg3-hud-dnd5e';

    // Auto-populate configuration menu
    game.settings.registerMenu(MODULE_ID, 'autoPopulateConfigurationMenu', {
        name: 'Configure Auto-populate Grids',
        label: 'Configure Grids',
        hint: 'Configure which item types to auto-populate in each grid when a token is created',
        icon: 'fas fa-grid-2',
        type: AutoPopulateConfigMenu,
        restricted: true
    });

    // Auto-populate passives setting
    game.settings.register(MODULE_ID, 'autoPopulatePassivesEnabled', {
        name: 'Auto-populate Passives',
        hint: 'Automatically populate passives container with feats that have no activities when a token is created',
        scope: 'world',
        config: true,
        type: Boolean,
        default: true
    });

    // Display item names setting
    game.settings.register(MODULE_ID, 'showItemNames', {
        name: 'Show Item Names',
        hint: 'Display item names on hotbar cells',
        scope: 'client',
        config: true,
        type: Boolean,
        default: false
    });

    // Display item uses setting
    game.settings.register(MODULE_ID, 'showItemUses', {
        name: 'Show Item Uses',
        hint: 'Display remaining uses on items that have limited uses',
        scope: 'client',
        config: true,
        type: Boolean,
        default: true
    });

    // Midi-QoL advantage/disadvantage buttons setting
    game.settings.register(MODULE_ID, 'addAdvBtnsMidiQoL', {
        name: 'Enable Advantage/Disadvantage Buttons (Midi-QoL)',
        hint: 'Add advantage/disadvantage buttons to the situational bonuses container when Midi-QoL is active',
        scope: 'world',
        config: true,
        type: Boolean,
        default: true
    });

    // Auto-populate on token creation setting
    game.settings.register(MODULE_ID, 'autoPopulateEnabled', {
        name: 'Auto-populate on Token Creation',
        hint: 'Automatically populate hotbar grids with items when a token is created',
        scope: 'world',
        config: true,
        type: Boolean,
        default: false
    });

    // Auto-populate configuration setting
    game.settings.register(MODULE_ID, 'autoPopulateConfiguration', {
        name: 'Auto-populate Configuration',
        hint: 'Configure which item types to auto-populate in each grid (restricted to GM)',
        restricted: true,
        scope: 'world',
        config: false,
        type: Object,
        default: {
            grid0: [],
            grid1: [],
            grid2: []
        }
    });
}

