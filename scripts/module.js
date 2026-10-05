/**
 * BG3 HUD D&D 5e Adapter Module
 * Registers D&D 5e specific components with the BG3 HUD Core
 */

import { createDnD5ePortraitContainer } from './components/containers/DnD5ePortraitContainer.js';
import { createDnD5ePassivesContainer } from './components/containers/DnD5ePassivesContainer.js';
import { getDnd5eRests } from './components/containers/DnD5eActionButtonsContainer.js';
import { ActiveEffectsContainer } from '/modules/bg3-hud-core/scripts/components/containers/ActiveEffectsContainer.js';
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
import {
    isExcludedCPRAutoPopulateActionName,
    shouldExcludeGenericActionFromHotbarAutoAdd
} from './constants/cprBlockedHotbarActions.js';
import { createLogger } from '/modules/bg3-hud-core/scripts/utils/logger.js';
import { resolveDnd5eNotice } from './notice/resolveNotice.js';

const log = createLogger('bg3-hud-dnd5e');

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

log.info('Loading adapter');

/**
 * Register settings
 */
Hooks.once('init', () => {
    log.info('Registering settings');
    registerSettings();
});

/**
 * Wait for core to be ready, then register D&D 5e components
 */
Hooks.on('bg3HudReady', async (BG3HUD_API) => {
    log.info('Received bg3HudReady hook');

    // Verify we're in D&D 5e system
    if (game.system.id !== 'dnd5e') {
        log.warn('Not running D&D 5e system, skipping registration');
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

    log.info('Registering D&D 5e components');

    // Create the portrait container class (extends core's PortraitContainer)
    const DnD5ePortraitContainer = await createDnD5ePortraitContainer();

    // Create the passives container class (extends core's PassivesContainer)
    const DnD5ePassivesContainer = await createDnD5ePassivesContainer();

    // Create the weapon set container class (extends core's WeaponSetContainer)
    const DnD5eWeaponSetContainer = await createDnD5eWeaponSetContainer();

    BG3HUD_API.registerNamedHudParts({
        portrait: DnD5ePortraitContainer,
        passives: DnD5ePassivesContainer,
        weaponSet: DnD5eWeaponSetContainer,
        filter: DnD5eFilterContainer,
        characterInfo: DnD5eInfoContainer,
        activeEffects: ActiveEffectsContainer,
        rest: getDnd5eRests
    });

    // Optional left-rail containers (core lays out by region/order; ids stay adapter-owned)
    // CPR sits left of ADV (lower order renders first in the left region)
    BG3HUD_API.registerContainer('cprGenericActions', DnD5eCPRGenericActionsContainer, {
        region: 'left',
        order: 10
    });
    BG3HUD_API.registerContainer('situationalBonuses', DnD5eAdvContainer, {
        region: 'left',
        order: 20
    });

    // Create and register the adapter instance
    const adapter = new DnD5eAdapter();
    BG3HUD_API.registerAdapter(adapter, {
        // CSS classes to filter from UI element tooltips (core's TooltipManager uses this)
        tooltipClassBlacklist: ['dnd5e2', 'dnd5e-tooltip', 'item-tooltip']
    });

    // Register D&D 5e menu builder
    BG3HUD_API.registerMenuBuilder('dnd5e', DnD5eMenuBuilder, { adapter: adapter });
    log.info('Menu builder registered');

    // Register D&D 5e tooltip renderer
    const tooltipManager = BG3HUD_API.getTooltipManager();
    if (!tooltipManager) {
        log.error('TooltipManager not available, cannot register tooltip renderer');
    } else {
        BG3HUD_API.registerTooltipRenderer('dnd5e', renderDnD5eTooltip);
        log.info('Tooltip renderer registered');

        // Align tooltip element ID for dnd5e tooltip styling while relying on our blocker to prevent system tooltips on UI
        if (tooltipManager.tooltipElement) {
            tooltipManager.tooltipElement.id = 'tooltip';
            log.info('Tooltip ID set to #tooltip for dnd5e styling');
        }
    }

    log.info('Registration complete');

    // Initialize default CPR actions if not set
    await adapter.cprAutoPopulate.initializeDefaultActions();

    // Update situational bonuses (advantage/disadvantage container) when inspiration changes
    Hooks.on('updateActor', async (actor, changes, options, userId) => {
        const hotbarApp = ui.BG3HUD_APP;
        if (!hotbarApp || actor !== hotbarApp.currentActor) return;

        const inspirationChanged = changes?.system?.attributes?.inspiration !== undefined;
        if (inspirationChanged) {
            const advContainer = hotbarApp.components?.situationalBonuses;
            if (advContainer && typeof advContainer.updateButtons === 'function') {
                advContainer.updateButtons();
            }
        }
    });

    // Signal that adapter registration is complete
    Hooks.call('bg3HudRegistrationComplete');

    // Register advantage/disadvantage hooks once
    registerAdvantageHooks();


});

/**
 * Collect activation types from a D&D 5e item's activities.
 * @param {Item} item
 * @returns {string[]}
 */
function collectActivityActionTypes(item) {
    const actionTypes = new Set();
    const activities = item?.system?.activities;
    if (!activities) return [];

    let activityList = [];
    if (activities.contents) {
        activityList = activities.contents;
    } else if (typeof activities.values === 'function') {
        activityList = Array.from(activities.values());
    } else if (typeof activities === 'object') {
        activityList = Object.values(activities);
    }

    for (const activity of activityList) {
        if (activity?.activation?.type) {
            actionTypes.add(activity.activation.type);
        }
    }
    return Array.from(actionTypes);
}

/**
 * Filter fields the HUD already knows after hydrate. Stored on cellData so
 * decorate does not fromUuid every Slot on first paint.
 * @param {Object} cellData
 * @param {Item} item
 */
function attachFilterFields(cellData, item) {
    if (!cellData || !item) return;
    cellData.itemType = item.type;
    if (item.type === 'spell') {
        cellData.level = item.system?.level ?? 0;
        cellData.preparationMode = item.system?.method ?? item.system?.preparation?.mode ?? '';
    }
    const actionTypes = collectActivityActionTypes(item);
    if (actionTypes.length > 0) {
        cellData.activityActionTypes = actionTypes.join(',');
        cellData.actionType = actionTypes[0];
    } else if (item.system?.activation?.type) {
        cellData.actionType = item.system.activation.type;
    }
}

/**
 * Apply stored filter fields to a Slot element.
 * @param {HTMLElement} cellElement
 * @param {Object} cellData
 * @returns {boolean} True when enough fields were present to skip a document lookup.
 */
function decorateElementFromCellData(cellElement, cellData) {
    if (!cellData) return false;
    let applied = false;
    if (cellData.itemType) {
        cellElement.dataset.itemType = cellData.itemType;
        applied = true;
    }
    if (cellData.level != null && cellData.level !== '') {
        cellElement.dataset.level = cellData.level;
    }
    if (cellData.preparationMode) {
        cellElement.dataset.preparationMode = cellData.preparationMode;
    }
    if (cellData.activityActionTypes) {
        cellElement.dataset.activityActionTypes = cellData.activityActionTypes;
        applied = true;
    }
    if (cellData.actionType) {
        cellElement.dataset.actionType = cellData.actionType;
        applied = true;
    }
    return applied;
}

/**
 * @param {HTMLElement} cellElement
 * @param {Item} item
 */
function decorateElementFromItem(cellElement, item) {
    if (!item) return;
    const fields = {};
    attachFilterFields(fields, item);
    decorateElementFromCellData(cellElement, fields);
}

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

        log.info('DnD5eAdapter created with autoSort, autoPopulate, cprAutoPopulate, and targetingRules');
    }

    resolveNotice(changes, actor) {
        return resolveDnd5eNotice(changes, actor);
    }

    isHeldItem(cell) {
        if (!cell || cell.isTwoHandedDuplicate) return false;
        const item = this._documentFromCell(cell);
        return this._isHeldDocument(item);
    }

    isTwoHanded(cell) {
        if (!cell || cell.isTwoHandedDuplicate) return false;
        if (cell.two) return true;
        const item = this._documentFromCell(cell);
        if (!item || item.type !== 'weapon') return false;
        const properties = item.system?.properties;
        if (properties instanceof Set) return properties.has('two');
        if (Array.isArray(properties)) return properties.includes('two');
        return properties?.two === true;
    }

    _documentFromCell(cell) {
        if (cell.itemType) {
            return {
                type: cell.itemType,
                system: {
                    type: { value: cell.equipmentType || cell.consumableType },
                    armor: { type: cell.armorType }
                }
            };
        }
        if (!cell.uuid || typeof fromUuidSync !== 'function') return null;
        try {
            return fromUuidSync(cell.uuid);
        } catch {
            return null;
        }
    }

    _isHeldDocument(item) {
        if (!item) return false;
        if (item.type === 'weapon') return true;
        if (item.type === 'equipment') {
            const typeValue = item.system?.type?.value || item.system?.type;
            const armorType = item.system?.armor?.type;
            return typeValue === 'shield' || armorType === 'shield';
        }
        if (item.type === 'consumable') {
            const t = item.system?.type?.value || item.system?.type;
            return t === 'wand';
        }
        return false;
    }

    /**
     * Check if an actor is compatible with this adapter
     * @param {Actor} actor - The actor to check
     * @returns {boolean} True if compatible
     */
    isCompatible(actor) {
        if (!actor) return false;
        // D&D 5e actor types include: character, npc, vehicle, group, encounter
        // Group actors are party/collection records and can be excluded via GM setting.
        if (actor.type === 'group' && game.settings.get(MODULE_ID, 'ignoreGroupActors')) return false;
        return true;
    }

    /**
     * PC chrome / auto-populate gate for core.
     * @param {Actor} actor
     * @returns {boolean}
     */
    isPlayerCharacter(actor) {
        if (!actor) return false;
        return actor.type === 'character' || !!actor.hasPlayerOwner;
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
     * Handle cell click (use item/spell/feature/activity)
     * @param {GridCell} cell - The clicked cell
     * @param {MouseEvent} event - The click event
     */
    async onCellClick(cell, event) {
        const data = cell.data;
        if (!data?.uuid) return;

        log.debug('Cell clicked:', data);

        // Canonical Activity cells
        if (data.type === 'Activity') {
            await this._useActivity(data.uuid, event);
            return;
        }

        // Canonical Item cells, plus legacy persisted system types
        // (older saves stored type: 'spell' / 'feat' / 'weapon' instead of 'Item').
        // Macros are handled by core before this adapter method runs.
        await this._useItem(data.uuid, event);
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

        // Hydration can leave Activity UUIDs tagged as type 'Item'; route correctly.
        if (resolved.constructor?.metadata?.name === 'Activity') {
            await this._useActivity(uuid, event);
            return;
        }

        // If this is an embedded item (already on the actor), use it directly.
        // If it's from a compendium, we need to create a real embedded item so midi-qol can find it.
        const isEmbedded = !!resolved.parent;
        const actor =
            resolved.actor ??
            (resolved.parent?.documentName === 'Actor' ? resolved.parent : null) ??
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

        log.debug('Using item:', itemToUse.name, isEmbedded ? '(embedded)' : '(from compendium)');

        // Check if item needs targeting and target selector is enabled
        const targetSelectorEnabled = game.settings.get('bg3-hud-core', 'enableTargetSelector');
        const needsTargeting = targetSelectorEnabled && this.targetingRules?.needsTargeting({ item: itemToUse });
        let areaPlaced = false;

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

                    if (!targets?.placed && (!targets || targets.length === 0)) {
                        log.debug('Target selection cancelled');
                        // Clean up temp item if we created one
                        if (createdItemId && actor.items.has(createdItemId)) {
                            await actor.deleteEmbeddedDocuments('Item', [createdItemId]);
                        }
                        return;
                    }

                    log.debug('Targets selected:', targets.map(t => t.name).join(', '));
                    areaPlaced = targets.placed === true;
                } catch (error) {
                    log.error('Target selection error:', error);
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
                const config = { event };
                if (areaPlaced) {
                    config.create = { measuredTemplate: false };
                }
                await itemToUse.use(config);
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
     * Use a D&D 5e activity
     * @param {string} uuid - Activity UUID
     * @param {MouseEvent} event - The triggering event
     * @private
     */
    async _useActivity(uuid, event) {
        const activity = await fromUuid(uuid);
        if (!activity) {
            ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.Notifications.ActivityNotFound`));
            return;
        }

        log.debug('Using activity:', activity.name);

        const item = activity.item;
        const actor = item?.actor;
        const targetSelectorEnabled = game.settings.get('bg3-hud-core', 'enableTargetSelector');
        const needsTargeting = targetSelectorEnabled
            && this.targetingRules?.needsTargeting({ item, activity });

        let areaPlaced = false;

        if (needsTargeting && actor) {
            const sourceToken = actor.token?.object
                ?? canvas?.tokens?.placeables?.find(t => t.actor?.id === actor.id)
                ?? null;
            if (sourceToken) {
                try {
                    const targets = await ui.BG3HOTBAR?.api?.startTargetSelection({
                        token: sourceToken,
                        item,
                        activity
                    });
                    if (!targets?.placed && (!targets || targets.length === 0)) {
                        log.debug('Activity target selection cancelled');
                        return;
                    }
                    areaPlaced = targets.placed === true;
                } catch (error) {
                    log.error('Activity target selection error:', error);
                    return;
                }
            }
        }

        // Activities have their own use() method
        if (typeof activity.use === 'function') {
            const config = { event };
            if (areaPlaced) {
                config.create = { measuredTemplate: false };
            }
            await activity.use(config);
        } else {
            ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.Notifications.ActivityCannotBeUsed`));
        }
    }

    /**
     * Transform an activity to cell data format
     * @param {Activity} activity - The activity to transform
     * @returns {Promise<Object>} Cell data object
     */
    async transformActivityToCellData(activity) {
        if (!activity) {
            log.warn('transformActivityToCellData: No activity provided');
            return null;
        }

        return {
            uuid: activity.uuid,
            name: activity.name,
            img: activity.img || activity.item?.img,
            type: 'Activity'
        };
    }

    /**
     * Auto-populate passives on token creation
     * Selects all features that have no activities
     * Only runs if passives haven't been configured yet (to avoid overwriting user selections)
     * @param {Actor} actor - The actor for the newly created token
     * @param {TokenDocument} tokenDocument - The token document (optional)
     */
    async autoPopulatePassives(actor, tokenDocument = null) {
        if (!actor) return;

        // Check if auto-populate passives is enabled
        if (!game.settings.get(MODULE_ID, 'autoPopulatePassivesEnabled')) {
            return;
        }

        // GUARD: Check if passives are already configured for this actor (token's synthetic actor)
        // This prevents overwriting user selections when tokens already have passives set
        const existingPassives = actor.getFlag(MODULE_ID, 'selectedPassives');
        if (existingPassives && Array.isArray(existingPassives) && existingPassives.length > 0) {
            log.debug('Passives already configured on token actor, skipping auto-populate');
            return;
        }

        // For unlinked tokens, check the BASE actor (from sidebar) for saved configuration
        // If "Save for all tokens" was checked, the base actor will have:
        // - 'passivesItemIds' flag with just the item IDs (not full UUIDs)
        // - 'passivesSaveToBase' flag set to true
        if (tokenDocument && tokenDocument.actorLink === false) {
            const baseActorId = tokenDocument.actorId;
            const baseActor = baseActorId ? game.actors.get(baseActorId) : null;

            log.debug('Checking base actor for unlinked token:', {
                baseActorId,
                baseActorFound: !!baseActor,
                baseActorName: baseActor?.name
            });

            if (baseActor) {
                // Check if "Save for all tokens" mode is active on base actor
                const saveToBaseEnabled = baseActor.getFlag(MODULE_ID, 'passivesSaveToBase');
                const baseItemIds = baseActor.getFlag(MODULE_ID, 'passivesItemIds');

                log.debug('Base actor flags:', {
                    saveToBaseEnabled,
                    baseItemIds: baseItemIds?.length ?? 0
                });

                if (saveToBaseEnabled && baseItemIds && Array.isArray(baseItemIds) && baseItemIds.length > 0) {
                    // Translate item IDs to this token's UUIDs
                    // The token's items will have the same item IDs but different UUID prefixes
                    const tokenUuids = [];
                    for (const itemId of baseItemIds) {
                        const item = actor.items.get(itemId);
                        if (item) {
                            tokenUuids.push(item.uuid);
                        } else {
                            log.warn(`Item ID ${itemId} not found on token actor`);
                        }
                    }

                    if (tokenUuids.length > 0) {
                        log.debug('Copying passives from base actor to unlinked token:', tokenUuids);
                        await actor.setFlag(MODULE_ID, 'selectedPassives', tokenUuids);
                        return;
                    }
                }
            }
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
     * Called by core AFTER all auto-populate grids are completed
     * Used for CPR auto-populate to avoid race conditions with state saving
     * @param {Actor} actor - The actor for the newly created token
     * @param {PersistenceManager} persistenceManager - The same persistence manager used for grid population
     */
    async onTokenCreationComplete(actor, persistenceManager) {
        if (!actor) return;

        if (persistenceManager) {
            persistenceManager.setToken(actor);
        }

        if (this.cprAutoPopulate) {
            await this.cprAutoPopulate.onTokenCreation(actor, persistenceManager);
        }

        // ItemUpdateManager may auto-add feats during createItem (async); strip any that slipped through
        await this._stripExcludedGenericActionsFromHotbar(persistenceManager);
        setTimeout(() => {
            if (persistenceManager) {
                persistenceManager.setToken(actor);
            }
            this._stripExcludedGenericActionsFromHotbar(persistenceManager).catch(err => {
                log.warn('Deferred hotbar generic-action strip failed:', err);
            });
        }, 300);
    }

    /**
     * Remove excluded generic actions from main hotbar state (not quick access).
     * @param {PersistenceManager} persistenceManager
     * @private
     */
    async _stripExcludedGenericActionsFromHotbar(persistenceManager) {
        if (!persistenceManager || game.settings.get(MODULE_ID, 'allowCPRActionsInAutoPopulate')) return;

        const state = await persistenceManager.loadState();
        let changed = false;

        for (const grid of state.hotbar?.grids || []) {
            for (const [slotKey, cell] of Object.entries(grid.items || {})) {
                if (!cell) continue;

                if (isExcludedCPRAutoPopulateActionName(cell.name)) {
                    delete grid.items[slotKey];
                    changed = true;
                    continue;
                }

                if (cell.uuid) {
                    const doc = await fromUuid(cell.uuid);
                    if (shouldExcludeGenericActionFromHotbarAutoAdd(doc)) {
                        delete grid.items[slotKey];
                        changed = true;
                    }
                }
            }
        }

        if (!changed) return;

        await persistenceManager.saveState(state);

        const hotbarApp = ui.BG3HUD_APP;
        if (hotbarApp?.rendered && hotbarApp?.components?.hotbar?.gridContainers) {
            for (const gridContainer of hotbarApp.components.hotbar.gridContainers) {
                const gridIndex = gridContainer.containerIndex;
                const gridData = state.hotbar.grids[gridIndex];
                if (gridData) {
                    gridContainer.items = gridData.items;
                    await gridContainer.render();
                }
            }
        }
    }

    /**
     * Whether ItemUpdateManager should auto-add this item to the hotbar on create/update.
     * @param {Item} item
     * @returns {boolean}
     */
    shouldAutoAddItem(item) {
        if (!item) return false;

        if (shouldExcludeGenericActionFromHotbarAutoAdd(item)) {
            return false;
        }

        const activities = item.system?.activities;
        const hasActivities = (activities instanceof Map && activities.size > 0)
            || (activities && typeof activities === 'object' && !Array.isArray(activities) && Object.keys(activities).length > 0)
            || (Array.isArray(activities) && activities.length > 0)
            || (item.system?.activation?.type && item.system.activation.type !== 'none');

        return hasActivities;
    }

    /**
     * D&D 5e spell preparation / casting-mode membership for the hotbar.
     * Called by core ItemUpdateManager on item updates (no system logic in core).
     *
     * Modern dnd5e: `system.method` is `"spell"` for prepared casters (not `"prepared"`),
     * and `system.prepared` is numeric (0 unprepared, 1 prepared, 2 always).
     *
     * @param {Item} item
     * @param {Actor} _actor
     * @returns {'add'|'remove'|null}
     */
    resolveHotbarMembershipOnItemUpdate(item, _actor) {
        if (!item || item.type !== 'spell') return null;

        const method = item.system?.method ?? item.system?.preparation?.mode ?? '';
        // Numeric in dnd5e v4+; boolean possible on legacy preparation.prepared
        const preparedRaw = item.system?.prepared ?? item.system?.preparation?.prepared;
        const preparedValue = Number(preparedRaw) || 0;
        const isPrepared = preparedValue > 0;

        // Always-prepared (prepared === 2) or casting methods that ignore the checkbox
        const alwaysEligible = preparedValue >= 2
            || ['pact', 'apothecary', 'atwill', 'innate', 'ritual', 'always'].includes(method);
        if (alwaysEligible) return 'add';

        // Prepared casters: modern method is "spell"; legacy prep mode was "prepared"
        const isPreparedMethod = method === 'spell' || method === 'prepared';
        if (isPreparedMethod) {
            return isPrepared ? 'add' : 'remove';
        }

        return null;
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
        if (!cellData) return;

        if (decorateElementFromCellData(cellElement, cellData)) return;
        if (!cellData.uuid) return;

        let item = null;
        if (typeof fromUuidSync === 'function') {
            try {
                item = fromUuidSync(cellData.uuid);
            } catch {
                item = null;
            }
        }
        if (!item) {
            try {
                item = await fromUuid(cellData.uuid);
            } catch {
                return;
            }
        }
        if (!item) return;

        const source = item.item ?? item;
        decorateElementFromItem(cellElement, source);
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
            log.warn('transformItemToCellData: No item provided');
            return null;
        }

        const cellData = {
            uuid: item.uuid,
            name: item.name,
            img: item.img,
            type: 'Item',
            itemType: item.type
        };
        attachFilterFields(cellData, item);

        if (item.type === 'weapon') {
            const properties = item.system?.properties;
            if (properties instanceof Set) cellData.two = properties.has('two');
            else if (Array.isArray(properties)) cellData.two = properties.includes('two');
            else cellData.two = properties?.two === true;
        } else if (item.type === 'equipment') {
            cellData.equipmentType = item.system?.type?.value || item.system?.type;
            cellData.armorType = item.system?.armor?.type;
        } else if (item.type === 'consumable') {
            cellData.consumableType = item.system?.type?.value || item.system?.type;
        }

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

        // Calculate depletion state for spells
        if (item.type === 'spell') {
            const level = item.system?.level || 0;
            // D&D 5e v5.1+: use .method instead of deprecated .preparation.mode
            const method = item.system?.method ?? item.system?.preparation?.mode ?? 'spell';
            // Spells with their own limited uses (ancestry innate grants, etc.) should
            // never be grayed out just because the actor has no spell slots.
            const hasOwnUses = !!cellData.uses
                || ((parseInt(item.system?.uses?.max) || 0) > 0)
                || ((Number(item.system?.uses?.max) || 0) > 0);
            const usesSlots = method === 'spell' && !hasOwnUses;

            if (level === 0) {
                // Cantrips never deplete
                cellData.depleted = false;
            } else if (!usesSlots) {
                // Innate / at-will / pact / own-uses spells - ignore spell slots
                if (cellData.uses) {
                    cellData.depleted = cellData.uses.value <= 0;
                } else {
                    cellData.depleted = false;
                }
            } else {
                // Regular learned spells (method === 'spell') - check spell slots
                const actor = item.actor;
                if (actor) {
                    const spells = actor.system?.spells;
                    if (spells) {
                        let canCast = false;

                        // Check if any slot at this level or higher has remaining uses
                        for (let l = level; l <= 9; l++) {
                            const slot = spells[`spell${l}`];
                            if (slot?.value > 0) {
                                canCast = true;
                                break;
                            }
                        }

                        // Also check pact slots - they can cast spells up to their level
                        if (!canCast && spells.pact?.value > 0 && spells.pact?.level >= level) {
                            canCast = true;
                        }

                        // Also check apothecary slots (SCGD compatibility)
                        if (!canCast && spells.apothecary?.value > 0 && (spells.apothecary?.level ?? 1) >= level) {
                            canCast = true;
                        }

                        // Set depleted flag for GridCell to consume
                        cellData.depleted = !canCast;
                    }
                }
            }
        }

        return cellData;
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

// NOTE: CPR auto-populate for token creation is now handled via adapter.onTokenCreationComplete()
// which is called by core AFTER all grids are populated, preventing race conditions with state saving.

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
