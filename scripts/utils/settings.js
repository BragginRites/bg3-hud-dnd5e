import { createSettingsSubmenu } from '/modules/bg3-hud-core/scripts/api/SettingsSubmenu.js';
import { getCPRConfig } from '../constants/cprBlockedHotbarActions.js';

const MODULE_ID = 'bg3-hud-dnd5e';

/** Default grid assignment for NPC token auto-populate */
export const DEFAULT_AUTO_POPULATE_CONFIGURATION = {
  grid0: ['weapon', 'feat'],
  grid1: ['spell'],
  grid2: ['consumable:potion', 'consumable:scroll'],
  options: {}
};

/**
 * Decouple legacy drag-block setting from auto-populate allow (v1 migration conflated them).
 */
function migrateLegacyBlockCPRActionsSetting() {
  if (game.settings.get(MODULE_ID, '_cprAutoPopulateV2Decoupled')) return;

  // V1 incorrectly set allowCPRActionsInAutoPopulate = !blockCPRActionsOnHotbar — reset to default
  if (game.settings.get(MODULE_ID, '_cprAutoPopulateSettingMigrated')) {
    game.settings.set(MODULE_ID, 'allowCPRActionsInAutoPopulate', false);
  }

  game.settings.set(MODULE_ID, '_cprAutoPopulateSettingMigrated', true);
  game.settings.set(MODULE_ID, '_cprAutoPopulateV2Decoupled', true);
}

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

  const { showAutoPopulateConfigDialog } = await import(
    '/modules/bg3-hud-core/scripts/utils/dialogs.js'
  );

  // Define toggle options for the dialog
  const toggleOptions = [
    {
      key: 'includeActivities',
      label: game.i18n.localize(`${MODULE_ID}.AutoPopulateOptions.IncludeActivities`),
      hint: game.i18n.localize(`${MODULE_ID}.AutoPopulateOptions.IncludeActivitiesHint`)
    }
  ];

  const result = await showAutoPopulateConfigDialog({
    title: game.i18n.localize(`${MODULE_ID}.Settings.ConfigureAutoPopulateGrids`),
    description: game.i18n.localize(`${MODULE_ID}.Settings.ConfigureAutoPopulateDescription`),
    choices,
    configuration: currentConfig,
    toggleOptions
  });

  if (result) {
    await game.settings.set(MODULE_ID, 'autoPopulateConfiguration', result);
    ui.notifications.info(
      game.i18n.localize(`${MODULE_ID}.Notifications.AutoPopulateConfigurationSaved`),
    );
  }
};

const openCPRActionsSelection = async () => {
  // Check if CPR module is active
  if (!game.modules.get('chris-premades')?.active) {
    ui.notifications.warn(
      game.i18n.localize(`${MODULE_ID}.Notifications.CPRModuleNotActive`)
    );
    return;
  }

  // Import showSelectionDialog from core
  const { showSelectionDialog } = await import(
    '/modules/bg3-hud-core/scripts/utils/dialogs.js'
  );

  // Get CPR config to determine which compendium and settings key to use
  const cprConfig = getCPRConfig();
  const currentSelection = game.settings.get(MODULE_ID, cprConfig.settingsKey) || [];

  // Load available actions from the appropriate CPRActions compendium
  const pack = game.packs.get(cprConfig.packId);
  if (!pack) {
    ui.notifications.warn(
      game.i18n.localize(`${MODULE_ID}.CPR.NoActionsAvailable`)
    );
    return;
  }

  // Get pack index and load all items
  const index = await pack.getIndex();
  const itemIds = Array.from(index.keys());
  const documents = await Promise.all(
    itemIds.map(id => pack.getDocument(id))
  );

  // Format items for showSelectionDialog interface
  const items = documents
    .filter(doc => doc) // Filter out null/undefined
    .map(doc => ({
      id: doc.uuid,
      label: doc.name,
      img: doc.img || 'icons/svg/item-bag.svg',
      selected: currentSelection.includes(doc.uuid)
    }));

  if (items.length === 0) {
    ui.notifications.warn(
      game.i18n.localize(`${MODULE_ID}.CPR.NoActionsAvailable`)
    );
    return;
  }

  // Show selection dialog with max 6 selections
  const result = await showSelectionDialog({
    title: game.i18n.localize(`${MODULE_ID}.CPR.SelectActionsTitle`),
    description: game.i18n.format(`${MODULE_ID}.CPR.SelectActionsDescription`, { max: 6 }),
    items,
    maxSelections: 6
  });

  if (result) {
    await game.settings.set(MODULE_ID, cprConfig.settingsKey, result);
    ui.notifications.info(
      game.i18n.localize(`${MODULE_ID}.Notifications.CPRActionsSelectionSaved`)
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

class CPRActionsSelectionMenu extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    window: { frame: false, positioned: false, resizable: false, minimizable: false },
    position: { width: 'auto', height: 'auto' },
    tag: 'div',
  };

  async render() {
    await openCPRActionsSelection();
    return this;
  }
}

/**
 * Register D&D 5e adapter module settings
 */
export function registerSettings() {
  // Register all actual settings first, before creating submenu classes

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
    default: true,
    onChange: () => ui.BG3HUD_APP?.updateDisplaySettings()
  });

  // Display item uses setting
  game.settings.register(MODULE_ID, 'showItemUses', {
    name: `${MODULE_ID}.Settings.ShowItemUses`,
    hint: `${MODULE_ID}.Settings.ShowItemUsesHint`,
    scope: 'client',
    config: false,
    type: Boolean,
    default: true,
    onChange: () => ui.BG3HUD_APP?.updateDisplaySettings()
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

  // Default portrait image source when actor has no explicit preference
  game.settings.register(MODULE_ID, 'defaultPortraitImageSource', {
    name: `${MODULE_ID}.Settings.DefaultPortraitImageSource`,
    hint: `${MODULE_ID}.Settings.DefaultPortraitImageSourceHint`,
    scope: 'client',
    config: false,
    type: String,
    choices: {
      token: `${MODULE_ID}.Settings.PortraitSourceToken`,
      portrait: `${MODULE_ID}.Settings.PortraitSourceActor`
    },
    default: 'token',
    onChange: () => ui.BG3HUD_APP?.refresh()
  });

  // Show HP controls (kill/heal buttons) setting
  game.settings.register(MODULE_ID, 'showHPControls', {
    name: `${MODULE_ID}.Settings.ShowHPControls`,
    hint: `${MODULE_ID}.Settings.ShowHPControlsHint`,
    scope: 'client',
    config: false,
    type: Boolean,
    default: true
  });

  // Hide Death Saves UI
  game.settings.register(MODULE_ID, 'hideDeathSaves', {
    name: `${MODULE_ID}.Settings.HideDeathSaves`,
    hint: `${MODULE_ID}.Settings.HideDeathSavesHint`,
    scope: 'world',
    config: false,
    type: Boolean,
    default: false,
    onChange: () => ui.BG3HUD_APP?.refresh()
  });

  // Ignore D&D 5e Group actors when selecting compatible tokens
  game.settings.register(MODULE_ID, 'ignoreGroupActors', {
    name: `${MODULE_ID}.Settings.IgnoreGroupActors`,
    hint: `${MODULE_ID}.Settings.IgnoreGroupActorsHint`,
    scope: 'world',
    config: false,
    type: Boolean,
    default: true
  });

  // CPR Generic Actions button setting (vertical button next to adv container)
  game.settings.register(MODULE_ID, 'enableCPRGenericActions', {
    name: `${MODULE_ID}.Settings.EnableCPRGenericActions`,
    hint: `${MODULE_ID}.Settings.EnableCPRGenericActionsHint`,
    scope: 'world',
    config: false,
    type: Boolean,
    default: false
  });

  // CPR Actions auto-populate setting (populate action buttons on token creation)
  game.settings.register(MODULE_ID, 'enableCPRActionsAutoPopulate', {
    name: `${MODULE_ID}.Settings.EnableCPRActionsAutoPopulate`,
    hint: `${MODULE_ID}.Settings.EnableCPRActionsAutoPopulateHint`,
    scope: 'world',
    config: false,
    type: Boolean,
    default: false
  });

  // Selected CPR Actions for Legacy/2014 rules (array of compendium UUIDs, max 6)
  // Defaults: Dash, Disengage, Dodge, Grapple, Help, Hide
  game.settings.register(MODULE_ID, 'selectedCPRActionsLegacy', {
    name: `${MODULE_ID}.Settings.SelectedCPRActions`,
    hint: `${MODULE_ID}.Settings.SelectedCPRActionsHint`,
    scope: 'world',
    config: false,
    restricted: true,
    type: Array,
    default: []
  });

  // Selected CPR Actions for Modern/2024 rules (array of compendium UUIDs, max 6)
  // Defaults: Dash, Disengage, Dodge, Help, Hide, Ready
  game.settings.register(MODULE_ID, 'selectedCPRActionsModern', {
    name: `${MODULE_ID}.Settings.SelectedCPRActions`,
    hint: `${MODULE_ID}.Settings.SelectedCPRActionsHint`,
    scope: 'world',
    config: false,
    restricted: true,
    type: Array,
    default: []
  });

  game.settings.register(MODULE_ID, 'allowCPRActionsInAutoPopulate', {
    name: `${MODULE_ID}.Settings.AllowCPRActionsInAutoPopulate`,
    hint: `${MODULE_ID}.Settings.AllowCPRActionsInAutoPopulateHint`,
    scope: 'world',
    config: false,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, '_cprAutoPopulateSettingMigrated', {
    scope: 'world',
    config: false,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, '_cprAutoPopulateV2Decoupled', {
    scope: 'world',
    config: false,
    type: Boolean,
    default: false
  });

  // World settings cannot be written during init; migrate after ready.
  Hooks.once('ready', () => migrateLegacyBlockCPRActionsSetting());

  // Midi-QoL advantage/disadvantage buttons setting
  game.settings.register(MODULE_ID, 'addAdvBtnsMidiQoL', {
    name: `${MODULE_ID}.Settings.EnableAdvBtnsMidiQoL`,
    hint: `${MODULE_ID}.Settings.EnableAdvBtnsMidiQoLHint`,
    scope: 'world',
    config: false,
    type: Boolean,
    default: false,
    onChange: () => ui.BG3HUD_APP?.components?.situationalBonuses?.render?.()
  });

  // Midi-QoL bonus/reaction filter sync
  game.settings.register(MODULE_ID, 'syncBonusReactionFilters', {
    name: `${MODULE_ID}.Settings.SyncBonusReactionFilters`,
    hint: `${MODULE_ID}.Settings.SyncBonusReactionFiltersHint`,
    scope: 'world',
    config: false,
    type: Boolean,
    default: true,
    onChange: () => ui.BG3HUD_APP?.components?.filters?.syncUsedActionFilters?.()
  });

  // Auto-populate on token creation setting
  game.settings.register(MODULE_ID, 'autoPopulateEnabled', {
    name: `${MODULE_ID}.Settings.AutoPopulateOnTokenCreation`,
    hint: `${MODULE_ID}.Settings.AutoPopulateOnTokenCreationHint`,
    scope: 'world',
    config: false,
    type: Boolean,
    default: true
  });

  // Auto-populate player characters override setting
  game.settings.register(MODULE_ID, 'autoPopulatePlayerCharacters', {
    name: `${MODULE_ID}.Settings.AutoPopulatePlayerCharacters`,
    hint: `${MODULE_ID}.Settings.AutoPopulatePlayerCharactersHint`,
    scope: 'world',
    config: false,
    type: Boolean,
    default: false
  });

  // Filter to prepared spells only - Players
  game.settings.register(MODULE_ID, 'filterPreparedSpellsPlayers', {
    name: `${MODULE_ID}.Settings.FilterPreparedSpellsPlayers`,
    hint: `${MODULE_ID}.Settings.FilterPreparedSpellsPlayersHint`,
    scope: 'world',
    config: false,
    type: Boolean,
    default: true
  });

  // Filter to prepared spells only - NPCs
  game.settings.register(MODULE_ID, 'filterPreparedSpellsNPCs', {
    name: `${MODULE_ID}.Settings.FilterPreparedSpellsNPCs`,
    hint: `${MODULE_ID}.Settings.FilterPreparedSpellsNPCsHint`,
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
    default: foundry.utils.deepClone(DEFAULT_AUTO_POPULATE_CONFIGURATION)
  });

  // Now create submenu classes that reference the registered settings
  const DisplaySettingsMenu = createSettingsSubmenu({
    moduleId: MODULE_ID,
    titleKey: `${MODULE_ID}.Settings.Display.MenuTitle`,
    sections: [
      { legend: `${MODULE_ID}.Settings.Display.Legend`, keys: ['showItemNames', 'showItemUses', 'showHealthOverlay', 'defaultPortraitImageSource', 'showHPControls', 'hideDeathSaves'] }
    ]
  });

  const AutoPopulateSettingsMenu = createSettingsSubmenu({
    moduleId: MODULE_ID,
    titleKey: `${MODULE_ID}.Settings.AutoPopulate.MenuTitle`,
    sections: [
      { legend: `${MODULE_ID}.Settings.AutoPopulate.Legend`, keys: ['autoPopulateEnabled', 'autoPopulatePlayerCharacters', 'autoPopulatePassivesEnabled', 'filterPreparedSpellsPlayers', 'filterPreparedSpellsNPCs', 'ignoreGroupActors'] }
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

  // Display submenu — player-visible: holds per-client display preferences.
  // (Any GM-only settings mixed in are hidden/skipped for non-GMs by the submenu factory.)
  game.settings.registerMenu(MODULE_ID, 'displaySettingsMenu', {
    name: `${MODULE_ID}.Settings.Display.MenuName`,
    label: `${MODULE_ID}.Settings.Display.MenuLabel`,
    hint: `${MODULE_ID}.Settings.Display.MenuHint`,
    icon: 'fas fa-list',
    type: DisplaySettingsMenu,
    restricted: false
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

  // Third-party modules submenu (only show if relevant modules are installed)
  const hasCPR = game.modules.has('chris-premades');
  const hasMidiQoL = game.modules.has('midi-qol');

  if (hasCPR || hasMidiQoL) {
    // Build sections dynamically based on installed modules
    const thirdPartySections = [];

    if (hasCPR) {
      thirdPartySections.push({
        legend: `${MODULE_ID}.Settings.ThirdParty.CPR.Legend`,
        keys: ['enableCPRGenericActions', 'enableCPRActionsAutoPopulate', 'allowCPRActionsInAutoPopulate'],
        buttons: [
          {
            id: 'cprActionsSelect',
            name: `${MODULE_ID}.CPR.SelectActionsMenuName`,
            label: `${MODULE_ID}.CPR.SelectActionsMenuLabel`,
            icon: 'fas fa-list-check',
            hint: `${MODULE_ID}.CPR.SelectActionsMenuHint`,
            onClick: () => new CPRActionsSelectionMenu().render(true)
          }
        ]
      });
    }

    if (hasMidiQoL) {
      thirdPartySections.push({
        legend: `${MODULE_ID}.Settings.ThirdParty.Midi.Legend`,
        keys: ['addAdvBtnsMidiQoL', 'syncBonusReactionFilters']
      });
    }

    const ThirdPartySettingsMenu = createSettingsSubmenu({
      moduleId: MODULE_ID,
      titleKey: `${MODULE_ID}.Settings.ThirdParty.MenuTitle`,
      sections: thirdPartySections
    });

    game.settings.registerMenu(MODULE_ID, 'thirdPartySettingsMenu', {
      name: `${MODULE_ID}.Settings.ThirdParty.MenuName`,
      label: `${MODULE_ID}.Settings.ThirdParty.MenuLabel`,
      hint: `${MODULE_ID}.Settings.ThirdParty.MenuHint`,
      icon: 'fas fa-puzzle-piece',
      type: ThirdPartySettingsMenu,
      restricted: true
    });
  }
}

