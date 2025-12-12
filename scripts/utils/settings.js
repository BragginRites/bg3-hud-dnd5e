import { createSettingsSubmenu } from '/modules/bg3-hud-core/scripts/api/SettingsSubmenu.js';

const MODULE_ID = 'bg3-hud-dnd5e';

const openAutoPopulateConfiguration = async () => {
  const adapter = ui.BG3HOTBAR?.registry?.activeAdapter;
  if (!adapter || !adapter.autoPopulate) {
    ui.notifications.error(
      game.i18n.localize(`${MODULE_ID}.Notifications.AutoPopulateSystemNotAvailable`),
    );
    return;
  }

  const currentConfig = game.settings.get(MODULE_ID, 'autoPopulateConfiguration');
  const choices = await adapter.autoPopulate.getItemTypeChoices();

  if (!choices || choices.length === 0) {
    ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.Notifications.NoItemTypesAvailable`));
    return;
  }

  const { AutoPopulateConfigDialog } = await import(
    '/modules/bg3-hud-core/scripts/components/ui/AutoPopulateConfigDialog.js'
  );

  const result = await new AutoPopulateConfigDialog({
    title: game.i18n.localize(`${MODULE_ID}.Settings.ConfigureAutoPopulateGrids`),
    choices,
    configuration: currentConfig,
  }).render();

  if (result) {
    await game.settings.set(MODULE_ID, 'autoPopulateConfiguration', result);
    ui.notifications.info(
      game.i18n.localize(`${MODULE_ID}.Notifications.AutoPopulateConfigurationSaved`),
    );
  }
};

class AutoPopulateConfigMenu extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    window: { frame: false, positioned: false, resizable: false, minimizable: false },
    position: { width: 'auto', height: 'auto' },
    tag: 'div',
  };

  async render() {
    await openAutoPopulateConfiguration();
    return this;
  }
}

/**
 * Register D&D 5e adapter module settings
 */
export function registerSettings() {
    const DisplaySettingsMenu = createSettingsSubmenu({
        moduleId: MODULE_ID,
        titleKey: `${MODULE_ID}.Settings.Display.MenuTitle`,
        sections: [
            { legend: `${MODULE_ID}.Settings.Display.Legend`, keys: ['showItemNames', 'showItemUses', 'showHealthOverlay'] }
        ]
    });

    const AutoPopulateSettingsMenu = createSettingsSubmenu({
        moduleId: MODULE_ID,
        titleKey: `${MODULE_ID}.Settings.AutoPopulate.MenuTitle`,
        sections: [
            { legend: `${MODULE_ID}.Settings.AutoPopulate.Legend`, keys: ['autoPopulateEnabled', 'autoPopulatePassivesEnabled'] }
        ]
    });

    const MidiSettingsMenu = createSettingsSubmenu({
        moduleId: MODULE_ID,
        titleKey: `${MODULE_ID}.Settings.Midi.MenuTitle`,
        sections: [
            { legend: `${MODULE_ID}.Settings.Midi.Legend`, keys: ['addAdvBtnsMidiQoL'] }
        ]
    });

    // Auto-populate configuration menu
    game.settings.registerMenu(MODULE_ID, 'autoPopulateConfigurationMenu', {
        name: `${MODULE_ID}.Settings.ConfigureAutoPopulateGrids`,
        label: `${MODULE_ID}.Settings.ConfigureGrids`,
        hint: `${MODULE_ID}.Settings.ConfigureGridsHint`,
        icon: 'fas fa-grid-2',
        type: AutoPopulateConfigMenu,
        restricted: true,
    });

    // Display submenu
    game.settings.registerMenu(MODULE_ID, 'displaySettingsMenu', {
        name: `${MODULE_ID}.Settings.Display.MenuName`,
        label: `${MODULE_ID}.Settings.Display.MenuLabel`,
        hint: `${MODULE_ID}.Settings.Display.MenuHint`,
        icon: 'fas fa-list',
        type: DisplaySettingsMenu,
        restricted: true
    });

    // Auto-populate submenu
    game.settings.registerMenu(MODULE_ID, 'autoPopulateSettingsMenu', {
        name: `${MODULE_ID}.Settings.AutoPopulate.MenuName`,
        label: `${MODULE_ID}.Settings.AutoPopulate.MenuLabel`,
        hint: `${MODULE_ID}.Settings.AutoPopulate.MenuHint`,
        icon: 'fas fa-list',
        type: AutoPopulateSettingsMenu,
        restricted: true
    });

    // Midi submenu
    game.settings.registerMenu(MODULE_ID, 'midiSettingsMenu', {
        name: `${MODULE_ID}.Settings.Midi.MenuName`,
        label: `${MODULE_ID}.Settings.Midi.MenuLabel`,
        hint: `${MODULE_ID}.Settings.Midi.MenuHint`,
        icon: 'fas fa-list',
        type: MidiSettingsMenu,
        restricted: true
    });

    // Auto-populate passives setting
    game.settings.register(MODULE_ID, 'autoPopulatePassivesEnabled', {
        name: `${MODULE_ID}.Settings.AutoPopulatePassives`,
        hint: `${MODULE_ID}.Settings.AutoPopulatePassivesHint`,
        scope: 'world',
        config: false,
        type: Boolean,
        default: true
    });

    // Display item names setting
    game.settings.register(MODULE_ID, 'showItemNames', {
        name: `${MODULE_ID}.Settings.ShowItemNames`,
        hint: `${MODULE_ID}.Settings.ShowItemNamesHint`,
        scope: 'client',
        config: false,
        type: Boolean,
        default: false
    });

    // Display item uses setting
    game.settings.register(MODULE_ID, 'showItemUses', {
        name: `${MODULE_ID}.Settings.ShowItemUses`,
        hint: `${MODULE_ID}.Settings.ShowItemUsesHint`,
        scope: 'client',
        config: false,
        type: Boolean,
        default: true
    });

    // Show health overlay setting
    game.settings.register(MODULE_ID, 'showHealthOverlay', {
        name: `${MODULE_ID}.Settings.ShowHealthOverlay`,
        hint: `${MODULE_ID}.Settings.ShowHealthOverlayHint`,
        scope: 'client',
        config: false,
        type: Boolean,
        default: true
    });

    // Midi-QoL advantage/disadvantage buttons setting
    game.settings.register(MODULE_ID, 'addAdvBtnsMidiQoL', {
        name: `${MODULE_ID}.Settings.EnableAdvBtnsMidiQoL`,
        hint: `${MODULE_ID}.Settings.EnableAdvBtnsMidiQoLHint`,
        scope: 'world',
        config: false,
        type: Boolean,
        default: true
    });

    // Auto-populate on token creation setting
    game.settings.register(MODULE_ID, 'autoPopulateEnabled', {
        name: `${MODULE_ID}.Settings.AutoPopulateOnTokenCreation`,
        hint: `${MODULE_ID}.Settings.AutoPopulateOnTokenCreationHint`,
        scope: 'world',
        config: false,
        type: Boolean,
        default: false
    });

    // Auto-populate configuration setting
    game.settings.register(MODULE_ID, 'autoPopulateConfiguration', {
        name: `${MODULE_ID}.Settings.AutoPopulateConfiguration`,
        hint: `${MODULE_ID}.Settings.AutoPopulateConfigurationHint`,
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

