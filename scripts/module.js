/**
 * BG3 HUD D&D 5e Adapter Module
 * Registers D&D 5e specific components with the BG3 HUD Core
 */

import { createDnD5ePortraitContainer } from './components/containers/DnD5ePortraitContainer.js';
import { createDnD5ePassivesContainer } from './components/containers/DnD5ePassivesContainer.js';
import { DnD5eActionButtonsContainer } from './components/containers/DnD5eActionButtonsContainer.js';
import { DnD5eFilterContainer } from './components/containers/DnD5eFilterContainer.js';
import { createDnD5eWeaponSetContainer } from './components/containers/DnD5eWeaponSetContainer.js';
import { DnD5eInfoContainer } from './components/containers/DnD5eInfoContainer.js';
import { DnD5eAdvContainer } from './components/containers/DnD5eAdvContainer.js';
import { DnD5eCPRGenericActionsContainer } from './components/containers/DnD5eCPRGenericActionsContainer.js';
import { isContainer, getContainerContents, saveContainerContents } from './components/containers/DnD5eContainerPopover.js';
import { DnD5eAutoSort } from './features/DnD5eAutoSort.js';
import { DnD5eAutoPopulate } from './features/DnD5eAutoPopulate.js';
import { DnD5eCPRAutoPopulate } from './features/DnD5eCPRAutoPopulate.js';
import { registerSettings } from './utils/settings.js';
import { renderDnD5eTooltip } from './utils/tooltipRenderer.js';
import { DnD5eMenuBuilder } from './components/menus/DnD5eMenuBuilder.js';
import { DnD5eTargetingRules } from './utils/DnD5eTargetingRules.js';

const MODULE_ID = 'bg3-hud-dnd5e';
const ADVANTAGE_ROLL_EVENTS = [
    'dnd5e.preRollAttackV2',
    'dnd5e.preRollSavingThrowV2',
    'dnd5e.preRollSkillV2',
    'dnd5e.preRollAbilityCheckV2',
    'dnd5e.preRollConcentrationV2',
    'dnd5e.preRollDeathSaveV2',
    'dnd5e.preRollToolV2'
];

let advantageHooksRegistered = false;

console.log('BG3 HUD D&D 5e | Loading adapter');

/**
 * Register settings
 */
Hooks.once('init', () => {
    console.log('BG3 HUD D&D 5e | Registering settings');
    registerSettings();
});

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

    // Register Handlebars helpers for tooltip templates
    Handlebars.registerHelper('contains', function (array, value) {
        if (!array || !Array.isArray(array)) return false;
        return array.includes(value) || array.some(item => String(item).includes(String(value)));
    });

    // Register Handlebars partials for tooltips
    const weaponBlockTemplate = await fetch('modules/bg3-hud-dnd5e/templates/tooltips/weapon-block.hbs').then(r => r.text());
    Handlebars.registerPartial('bg3-hud-dnd5e.weapon-block', weaponBlockTemplate);

    console.log('BG3 HUD D&D 5e | Registering D&D 5e components');

    // Create the portrait container class (extends core's PortraitContainer)
    const DnD5ePortraitContainer = await createDnD5ePortraitContainer();

    // Create the passives container class (extends core's PassivesContainer)
    const DnD5ePassivesContainer = await createDnD5ePassivesContainer();

    // Create the weapon set container class (extends core's WeaponSetContainer)
    const DnD5eWeaponSetContainer = await createDnD5eWeaponSetContainer();

    // Register D&D 5e portrait container (includes health display)
    BG3HUD_API.registerPortraitContainer(DnD5ePortraitContainer);

    // Register D&D 5e passives container (feat selection)
    BG3HUD_API.registerPassivesContainer(DnD5ePassivesContainer);

    // Register D&D 5e weapon set container (two-handed weapon support)
    BG3HUD_API.registerWeaponSetContainer(DnD5eWeaponSetContainer);

    // Register D&D 5e action buttons container (rest/turn buttons)
    BG3HUD_API.registerActionButtonsContainer(DnD5eActionButtonsContainer);

    // Register D&D 5e filter container (action types, spell slots)
    BG3HUD_API.registerFilterContainer(DnD5eFilterContainer);

    // Register D&D 5e info container (abilities, skills, saves)
    BG3HUD_API.registerInfoContainer(DnD5eInfoContainer);

    // Register D&D 5e situational bonuses container (midi-qol integration)
    BG3HUD_API.registerContainer('situationalBonuses', DnD5eAdvContainer);

    // Register D&D 5e CPR Generic Actions container
    BG3HUD_API.registerContainer('cprGenericActions', DnD5eCPRGenericActionsContainer);

    // TODO: Register other D&D 5e specific components
    // BG3HUD_API.registerContainer('deathSaves', DeathSavesContainer);

    // Create and register the adapter instance
    const adapter = new DnD5eAdapter();
    BG3HUD_API.registerAdapter(adapter);

    // Register D&D 5e menu builder
    BG3HUD_API.registerMenuBuilder('dnd5e', DnD5eMenuBuilder, { adapter: adapter });
    console.log('BG3 HUD D&D 5e | Menu builder registered');

    // Register D&D 5e tooltip renderer
    const tooltipManager = BG3HUD_API.getTooltipManager();
    if (!tooltipManager) {
        console.error('BG3 HUD D&D 5e | TooltipManager not available, cannot register tooltip renderer');
    } else {
        BG3HUD_API.registerTooltipRenderer('dnd5e', renderDnD5eTooltip);
        console.log('BG3 HUD D&D 5e | Tooltip renderer registered');

        // Align tooltip element ID for dnd5e tooltip styling while relying on our blocker to prevent system tooltips on UI
        if (tooltipManager.tooltipElement) {
            tooltipManager.tooltipElement.id = 'tooltip';
            console.log('BG3 HUD D&D 5e | Tooltip ID set to #tooltip for dnd5e styling');
        }
    }

    console.log('BG3 HUD D&D 5e | Registration complete');

    // Initialize default CPR actions if not set
    await adapter.cprAutoPopulate.initializeDefaultActions();

    // Signal that adapter registration is complete
    Hooks.call('bg3HudRegistrationComplete');

    // Register advantage/disadvantage hooks once
    registerAdvantageHooks();
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
        this.cprAutoPopulate = new DnD5eCPRAutoPopulate();

        // Targeting rules for target selector integration
        this.targetingRules = DnD5eTargetingRules;

        // Link autoPopulate to autoSort for consistent sorting
        this.autoPopulate.setAutoSort(this.autoSort);

        console.log('BG3 HUD D&D 5e | DnD5eAdapter created with autoSort, autoPopulate, cprAutoPopulate, and targetingRules');
    }

    /**
     * Get default portrait data configuration for D&D 5e
     * Called by core when user hasn't configured portrait data yet
     * @returns {Array<Object>} Default slot configurations
     */
    getPortraitDataDefaults() {
        return [
            { path: 'system.attributes.ac.value', icon: 'fas fa-shield-alt', color: '#4a90d9' },
            { path: 'system.attributes.movement.walk', icon: 'fas fa-running', color: '#2ecc71' },
            { path: '', icon: '', color: '#ffffff' },
            { path: '', icon: '', color: '#ffffff' },
            { path: '', icon: '', color: '#ffffff' },
            { path: '', icon: '', color: '#ffffff' }
        ];
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

        // D&D 5e doesn't add extra context menu items
        // The core context menu already provides "Edit Item" which opens the sheet

        return items;
    }

    /**
     * Use a D&D 5e item
     * @param {string} uuid - Item UUID
     * @param {MouseEvent} event - The triggering event
     * @private
     */
    async _useItem(uuid, event) {
        const resolved = await fromUuid(uuid);
        if (!resolved) {
            ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.Notifications.ItemNotFound`));
            return;
        }

        // If this is an embedded item (already on the actor), use it directly.
        // If it's from a compendium, we need to create a real embedded item so midi-qol can find it.
        const isEmbedded = !!resolved.parent;
        const actor =
            resolved.parent ??
            ui.BG3HUD_APP?.currentActor ??
            canvas?.tokens?.controlled?.[0]?.actor ??
            null;

        if (!actor) {
            ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.Notifications.ItemCannotBeUsed`));
            return;
        }

        let itemToUse = resolved;
        let createdItemId = null;

        // For compendium items, we must create a real embedded document (not temporary)
        // so that midi-qol can find it in the actor's items collection during its workflow.
        if (!isEmbedded) {
            // Clone the item data and ensure it's properly migrated
            const data = foundry.utils.deepClone(resolved.toObject());

            // Ensure modern V13+ stats shape exists to avoid deprecated flags.exportSource access
            if (!data._stats) {
                data._stats = {};
            }
            if (data.flags?.exportSource && !data._stats.exportSource) {
                data._stats.exportSource = data.flags.exportSource;
                delete data.flags.exportSource;
            }

            // Let Foundry assign the id
            delete data._id;

            // Create a real embedded document - midi-qol requires the item to be in the collection
            // We'll delete it after use to avoid cluttering the actor's inventory
            const created = await actor.createEmbeddedDocuments('Item', [data]);
            itemToUse = created?.[0] ?? null;
            createdItemId = itemToUse?.id;
        }

        if (!itemToUse) {
            ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.Notifications.ItemNotFound`));
            return;
        }

        console.log('D&D 5e Adapter | Using item:', itemToUse.name, isEmbedded ? '(embedded)' : '(from compendium)');

        // Check if item needs targeting and target selector is enabled
        const targetSelectorEnabled = game.settings.get('bg3-hud-core', 'enableTargetSelector');
        const needsTargeting = targetSelectorEnabled && this.targetingRules?.needsTargeting({ item: itemToUse });

        if (needsTargeting) {
            // Get the source token
            const sourceToken = actor.token?.object ??
                canvas?.tokens?.placeables?.find(t => t.actor?.id === actor.id) ??
                null;

            if (sourceToken) {
                try {
                    // Start target selection
                    const targets = await ui.BG3HOTBAR?.api?.startTargetSelection({
                        token: sourceToken,
                        item: itemToUse
                    });

                    // If user cancelled (empty array returned when cancelled), abort item use
                    if (!targets || targets.length === 0) {
                        console.log('D&D 5e Adapter | Target selection cancelled');
                        // Clean up temp item if we created one
                        if (createdItemId && actor.items.has(createdItemId)) {
                            await actor.deleteEmbeddedDocuments('Item', [createdItemId]);
                        }
                        return;
                    }

                    console.log('D&D 5e Adapter | Targets selected:', targets.map(t => t.name).join(', '));
                } catch (error) {
                    console.error('D&D 5e Adapter | Target selection error:', error);
                    // Clean up temp item if we created one
                    if (createdItemId && actor.items.has(createdItemId)) {
                        await actor.deleteEmbeddedDocuments('Item', [createdItemId]);
                    }
                    return;
                }
            }
        }

        // Use the item (D&D 5e v4+ uses .use() method)
        if (typeof itemToUse.use === 'function') {
            try {
                await itemToUse.use({ event });
            } finally {
                // Clean up: delete the temporarily created item from the actor's inventory
                // This runs even if item.use() throws, ensuring we don't leave orphan items
                if (createdItemId && actor.items.has(createdItemId)) {
                    await actor.deleteEmbeddedDocuments('Item', [createdItemId]);
                }
            }
        } else {
            // Clean up if we created an item but can't use it
            if (createdItemId && actor.items.has(createdItemId)) {
                await actor.deleteEmbeddedDocuments('Item', [createdItemId]);
            }
            ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.Notifications.ItemCannotBeUsed`));
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
            ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.Notifications.MacroNotFound`));
            return;
        }

        console.log('D&D 5e Adapter | Executing macro:', macro.name);
        await macro.execute();
    }

    /**
     * Auto-populate passives on token creation
     * Selects all features that have no activities
     * @param {Actor} actor - The actor for the newly created token
     * @param {TokenDocument} tokenDocument - The token document (optional)
     */
    async autoPopulatePassives(actor, tokenDocument = null) {
        if (!actor) return;

        // Check if auto-populate passives is enabled
        if (!game.settings.get(MODULE_ID, 'autoPopulatePassivesEnabled')) {
            return;
        }

        // Get all feat items
        const feats = actor.items.filter(item => item.type === 'feat');

        // Filter to only features without activities
        const passiveFeats = feats.filter(feat => {
            const activities = feat.system?.activities;

            // Check if activities exist and have content
            if (activities instanceof Map) {
                return activities.size === 0;
            } else if (activities && typeof activities === 'object') {
                if (Array.isArray(activities)) {
                    return activities.length === 0;
                } else {
                    return Object.keys(activities).length === 0;
                }
            }

            // Fallback: check legacy activation
            if (feat.system?.activation?.type && feat.system.activation.type !== 'none') {
                return false; // Has activation, not passive
            }

            return true; // No activities or activation, treat as passive
        });

        // Save the passive UUIDs to actor flags
        const passiveUuids = passiveFeats.map(feat => feat.uuid);
        await actor.setFlag(MODULE_ID, 'selectedPassives', passiveUuids);
    }

    /**
     * Check if an item is a container (bag, pouch, box, etc.)
     * Delegates to DnD5eContainerPopover module
     * @param {Object} cellData - The cell's data object
     * @returns {Promise<boolean>}
     */
    async isContainer(cellData) {
        return await isContainer(cellData);
    }

    /**
     * Get contents of a container item
     * Delegates to DnD5eContainerPopover module
     * @param {Item} containerItem - The container item
     * @param {Actor} actor - The actor who owns the container
     * @returns {Promise<Object>} Grid data with rows, cols, and items
     */
    async getContainerContents(containerItem, actor) {
        return await getContainerContents(containerItem, actor);
    }

    /**
     * Save contents back to a container item
     * Delegates to DnD5eContainerPopover module
     * @param {Item} containerItem - The container item
     * @param {Object} items - Grid items object (slotKey: itemData)
     * @param {Actor} actor - The actor who owns the container
     * @returns {Promise<void>}
     */
    async saveContainerContents(containerItem, items, actor) {
        return await saveContainerContents(containerItem, items, actor);
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

    /**
     * Get display settings from the adapter
     * Called by core to determine what display options to apply
     * @returns {Object} Display settings object
     */
    getDisplaySettings() {
        return {
            showItemNames: game.settings.get(MODULE_ID, 'showItemNames'),
            showItemUses: game.settings.get(MODULE_ID, 'showItemUses')
        };
    }

    /**
     * Transform a D&D 5e item to cell data format
     * Extracts all relevant data including uses and quantity
     * @param {Item} item - The item to transform
     * @returns {Promise<Object>} Cell data object
     */
    async transformItemToCellData(item) {
        if (!item) {
            console.warn('DnD5e Adapter | transformItemToCellData: No item provided');
            return null;
        }

        const cellData = {
            uuid: item.uuid,
            name: item.name,
            img: item.img,
            type: 'Item'
        };

        // Extract quantity (D&D 5e stores this in system.quantity)
        if (item.system?.quantity) {
            cellData.quantity = item.system.quantity;
        }

        // Extract uses (D&D 5e stores this in system.uses)
        if (item.system?.uses) {
            // Only include uses if max > 0
            const maxUses = parseInt(item.system.uses.max) || 0;
            if (maxUses > 0) {
                const spentUses = parseInt(item.system.uses.spent) || 0;
                const value = maxUses - spentUses;

                cellData.uses = {
                    value: value,
                    max: maxUses
                };
            }
        }

        return cellData;
    }

    /**
     * Check if an item should be blocked from being added to the hotbar
     * Used by InteractionCoordinator to filter external drops
     * CPR items should only appear in quick access or via the Generic Actions button
     * @param {Item} item - The item to check
     * @returns {Promise<{blocked: boolean, reason?: string}>} Whether the item should be blocked and why
     */
    async shouldBlockFromHotbar(item) {
        if (!item) return { blocked: false };

        // Check if blocking CPR Generic Actions is enabled
        const blockCPRActions = game.settings.get(MODULE_ID, 'blockCPRActionsOnHotbar');
        if (!blockCPRActions) return { blocked: false };

        // Check if CPR module is active
        if (!game.modules.get('chris-premades')?.active) return { blocked: false };

        const uuid = item.uuid || '';

        // Block the "Generic Actions" items from CPRMiscellaneous compendium (both 2014 and 2024 versions)
        // These are the main Generic Actions dialog items
        const genericActionsUuids = [
            'Compendium.chris-premades.CPRMiscellaneous.Item.V0rdpb8WPmdYhAjc',  // Generic Actions (2014)
            'Compendium.chris-premades.CPRMiscellaneous.Item.Iz2XtxLReLnXTDiI'   // Generic Actions (2024)
        ];
        if (genericActionsUuids.includes(uuid)) {
            return {
                blocked: true,
                reason: game.i18n.localize(`${MODULE_ID}.Notifications.CPRActionBlockedFromHotbar`)
            };
        }

        // Check if the item is from either CPRActions compendium (2014 or 2024)
        // Compendium items have UUIDs like: Compendium.chris-premades.CPRActions.Item.xxx
        // or Compendium.chris-premades.CPRActions2024.Item.xxx
        if (uuid.startsWith('Compendium.chris-premades.CPRActions.') ||
            uuid.startsWith('Compendium.chris-premades.CPRActions2024.')) {
            return {
                blocked: true,
                reason: game.i18n.localize(`${MODULE_ID}.Notifications.CPRActionBlockedFromHotbar`)
            };
        }

        // Check for Generic Actions items by NAME (for embedded items on actors)
        const genericActionsNames = [
            'Generic Actions (2014)',
            'Generic Actions (2024)'
        ];
        if (genericActionsNames.includes(item.name)) {
            return {
                blocked: true,
                reason: game.i18n.localize(`${MODULE_ID}.Notifications.CPRActionBlockedFromHotbar`)
            };
        }

        // Check if the item was created from CPRActions compendium (for embedded items)
        // These have the source compendium stored in flags or _stats
        const sourceCompendium = item._stats?.compendiumSource || item.flags?.core?.sourceId || '';

        // Block embedded Generic Actions items (imported from CPRMiscellaneous)
        if (sourceCompendium.includes('chris-premades.CPRMiscellaneous')) {
            return {
                blocked: true,
                reason: game.i18n.localize(`${MODULE_ID}.Notifications.CPRActionBlockedFromHotbar`)
            };
        }

        // Block items from CPRActions or CPRActions2024 compendiums
        if (sourceCompendium.includes('chris-premades.CPRActions') ||
            sourceCompendium.includes('chris-premades.CPRActions2024')) {
            return {
                blocked: true,
                reason: game.i18n.localize(`${MODULE_ID}.Notifications.CPRActionBlockedFromHotbar`)
            };
        }

        return { blocked: false };
    }
}

/**
 * Register hook handlers that apply ADV/DIS state to dnd5e rolls
 * Mirrors inspired hotbar behaviour but scoped to BG3 HUD core
 */
function registerAdvantageHooks() {
    if (advantageHooksRegistered) return;

    const handleRollAdvantage = async (rollConfig) => {
        // Ensure midi-qol integration is active and setting enabled
        if (!game.modules.get('midi-qol')?.active) return;
        if (!game.settings.get(MODULE_ID, 'addAdvBtnsMidiQoL')) return;

        const workflowActor = rollConfig?.workflow?.actor;
        if (!workflowActor) return;

        // Only apply when HUD is controlling this actor
        const currentActor = ui.BG3HUD_APP?.currentActor;
        if (!currentActor || currentActor !== workflowActor) return;

        const state = workflowActor.getFlag(MODULE_ID, 'advState');
        const once = workflowActor.getFlag(MODULE_ID, 'advOnce');

        if (state === 'advBtn') {
            rollConfig.advantage = true;
        } else if (state === 'disBtn') {
            rollConfig.disadvantage = true;
        } else {
            return;
        }

        if (once) {
            const situationalBonuses = ui.BG3HUD_APP?.components?.situationalBonuses;
            if (situationalBonuses && typeof situationalBonuses.clearState === 'function') {
                await situationalBonuses.clearState();
            } else {
                await workflowActor.unsetFlag(MODULE_ID, 'advState');
                await workflowActor.unsetFlag(MODULE_ID, 'advOnce');
            }
        }
    };

    for (const event of ADVANTAGE_ROLL_EVENTS) {
        Hooks.on(event, handleRollAdvantage);
    }

    advantageHooksRegistered = true;
}

/**
 * Hook into token creation to populate quickAccess with CPR actions
 */
Hooks.on('createToken', async (tokenDocument, options, userId) => {
    // Only run for GMs or if the user created the token
    if (!game.user.isGM && game.userId !== userId) return;

    // Get actor directly from tokenDocument
    const actor = tokenDocument.actor;
    if (!actor) return;

    // Use adapter's cprAutoPopulate
    const adapter = ui.BG3HOTBAR?.registry?.activeAdapter;
    if (adapter?.cprAutoPopulate) {
        await adapter.cprAutoPopulate.onTokenCreation(actor);
    }
});

/**
 * Hook into token selection/change to populate quickAccess with selected CPR actions if empty
 */
Hooks.on('BG3HUD_TOKEN_CHANGED', async (token) => {
    if (!token?.actor) return;

    // Use adapter's cprAutoPopulate
    const adapter = ui.BG3HOTBAR?.registry?.activeAdapter;
    if (adapter?.cprAutoPopulate) {
        await adapter.cprAutoPopulate.onTokenChange(token);
    }
});
