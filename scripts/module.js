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
import { isContainer, getContainerContents, saveContainerContents } from './components/containers/ItemContainerContents.js';
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
import { useItem, useActivity } from './features/ItemUseWorkflow.js';
import { computeSpellDepletion, resolveHotbarMembershipOnItemUpdate as resolveSpellHotbarMembership } from './features/SpellDepletion.js';
import { autoPopulatePassives as runAutoPopulatePassives } from './features/PassiveBookkeeping.js';
import { registerAdvantageHooks } from './features/AdvantageHooks.js';
import { isHeldDocument, isTwoHandedWeapon } from './features/ItemClassification.js';

const log = createLogger('bg3-hud-dnd5e');

const MODULE_ID = 'bg3-hud-dnd5e';

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
    const spellBlockTemplate = await fetch('modules/bg3-hud-dnd5e/templates/tooltips/spell-block.hbs').then(r => r.text());
    Handlebars.registerPartial('bg3-hud-dnd5e.spell-block', spellBlockTemplate);

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
        return isHeldDocument(item);
    }

    isTwoHanded(cell) {
        if (!cell || cell.isTwoHandedDuplicate) return false;
        if (cell.two) return true;
        const item = this._documentFromCell(cell);
        return isTwoHandedWeapon(item);
    }

    /**
     * Resolve a plain item/document from a weapon-set cell. Cells created
     * from "ghost" entries (not yet backed by a real item) carry enough
     * shape (`itemType`/`equipmentType`/`consumableType`/`armorType`) to
     * synthesize a minimal document; otherwise resolve the real document via
     * `fromUuidSync` (a Foundry global, hence this stays on the adapter
     * rather than becoming a pure helper).
     */
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
        return useItem(this.targetingRules, uuid, event);
    }

    /**
     * Use a D&D 5e activity
     * @param {string} uuid - Activity UUID
     * @param {MouseEvent} event - The triggering event
     * @private
     */
    async _useActivity(uuid, event) {
        return useActivity(this.targetingRules, uuid, event);
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
        return runAutoPopulatePassives(actor, tokenDocument);
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
        return resolveSpellHotbarMembership(item, _actor);
    }

    /**
     * Check if an item is a container (bag, pouch, box, etc.)
     * Delegates to the ItemContainerContents module
     * @param {Object} cellData - The cell's data object
     * @returns {Promise<boolean>}
     */
    async isContainer(cellData) {
        return await isContainer(cellData);
    }

    /**
     * Get contents of a container item
     * Delegates to the ItemContainerContents module, passing this adapter's
     * own transformItemToCellData as the transform (no global ui.BG3HOTBAR lookup needed).
     * @param {Item} containerItem - The container item
     * @param {Actor} actor - The actor who owns the container
     * @returns {Promise<Object>} Grid data with rows, cols, and items
     */
    async getContainerContents(containerItem, actor) {
        return await getContainerContents(containerItem, actor, this.transformItemToCellData.bind(this));
    }

    /**
     * Save contents back to a container item
     * Delegates to the ItemContainerContents module
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
        return ui.BG3HOTBAR.api.getDisplaySettings(MODULE_ID);
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
            const spellSlots = item.actor?.system?.spells ?? null;

            const depleted = computeSpellDepletion({
                level,
                method,
                hasOwnUses,
                uses: cellData.uses ?? null,
                spellSlots
            });

            // Pure function returns undefined when there isn't enough data to
            // determine slot-based depletion (no actor / no spells block) -
            // leave cellData.depleted unset in that case, matching prior behavior.
            if (depleted !== undefined) {
                cellData.depleted = depleted;
            }
        }

        return cellData;
    }

}

// NOTE: Advantage/disadvantage roll hooks live in ./features/AdvantageHooks.js
// and are registered once via registerAdvantageHooks() from the bg3HudReady handler above.

// NOTE: CPR auto-populate for token creation is now handled via adapter.onTokenCreationComplete()
// which is called by core AFTER all grids are populated, preventing race conditions with state saving.

/**
 * Hook into token selection/change to populate quickAccess with selected CPR actions if empty
 */
Hooks.on('BG3HUD_TOKEN_CHANGED', async (token) => {
    if (!token?.actor) return;

    // Use adapter's cprAutoPopulate
    const adapter = ui.BG3HOTBAR?.api?.getActiveAdapter();
    if (adapter?.cprAutoPopulate) {
        await adapter.cprAutoPopulate.onTokenChange(token);
    }
});
