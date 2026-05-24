import { FilterContainer } from '/modules/bg3-hud-core/scripts/components/containers/FilterContainer.js';
import { normalizeApothecarySlots } from '../../compatibility/scgd-apothecary.js';

const MODULE_ID = 'bg3-hud-dnd5e';

/** Midi-QoL action economy status effect IDs (see midi-qol getStaticID) */
const BONUS_ACTION_EFFECT_ID = 'dnd5ebonusaction';
const REACTION_EFFECT_ID = 'dnd5ereaction000';
const ACTION_ECONOMY_EFFECT_IDS = [BONUS_ACTION_EFFECT_ID, REACTION_EFFECT_ID];

/**
 * D&D 5e Filter Container
 * Provides action type and spell slot filters for D&D 5e
 */
export class DnD5eFilterContainer extends FilterContainer {
    /**
     * Create D&D 5e filter container
     * @param {Object} options - Container options
     */
    constructor(options = {}) {
        super({
            ...options,
            getFilters: () => this.getD5eFilters()
        });
    }

    /**
     * Check if actor has legendary actions
     * @returns {boolean} True if actor has legendary actions
     * @private
     */
    _hasLegendaryActions() {
        if (!this.actor) return false;

        // Check if actor has any items with legendary action type
        // Check both old system (actionType) and new system (activities)
        const hasLegendaryItems = this.actor.items.some(item => {
            // Old system: check actionType
            if (item.system?.actionType === 'legendary') return true;

            // New system: check activities
            if (item.system?.activities) {
                const activities = item.system.activities;
                if (activities instanceof Map) {
                    return Array.from(activities.values()).some(activity =>
                        activity.type === 'legendary' ||
                        activity.actionType === 'legendary'
                    );
                } else if (Array.isArray(activities)) {
                    return activities.some(activity =>
                        activity.type === 'legendary' ||
                        activity.actionType === 'legendary'
                    );
                }
            }

            return false;
        });

        return hasLegendaryItems;
    }

    /**
     * Get D&D 5e-specific filter definitions
     * @returns {Array<Object>} Filter definitions
     */
    getD5eFilters() {
        const filters = [];

        if (!this.actor) return filters;

        // Action type filters
        filters.push({
            id: 'action',
            label: game.i18n.localize(`${MODULE_ID}.Filters.Action`),
            symbol: 'fa-circle',
            classes: ['action-type-button'],
            color: getComputedStyle(document.documentElement).getPropertyValue('--dnd5e-filter-action')?.trim() || '#2ecc71',
            data: { actionType: 'action' }
        });

        filters.push({
            id: 'bonus',
            label: game.i18n.localize(`${MODULE_ID}.Filters.BonusAction`),
            symbol: 'fa-triangle',
            classes: ['action-type-button'],
            color: getComputedStyle(document.documentElement).getPropertyValue('--dnd5e-filter-bonus')?.trim() || '#e37d22',
            data: { actionType: 'bonus' }
        });

        filters.push({
            id: 'reaction',
            label: game.i18n.localize(`${MODULE_ID}.Filters.Reaction`),
            symbol: 'fa-sparkle',
            classes: ['action-type-button'],
            color: getComputedStyle(document.documentElement).getPropertyValue('--dnd5e-filter-reaction')?.trim() || '#fe85f6',
            data: { actionType: 'reaction' }
        });

        // Legendary action filter - only show if actor has legendary actions
        if (this._hasLegendaryActions()) {
            filters.push({
                id: 'legendary',
                label: game.i18n.localize(`${MODULE_ID}.Filters.LegendaryAction`),
                symbol: 'fa-dragon',
                classes: ['action-type-button'],
                color: getComputedStyle(document.documentElement).getPropertyValue('--dnd5e-filter-legendary')?.trim() || '#ffd700',
                data: { actionType: 'legendary' }
            });
        }

        filters.push({
            id: 'feature',
            label: game.i18n.localize(`${MODULE_ID}.Filters.Feature`),
            symbol: 'fa-star',
            classes: ['action-type-button'],
            color: getComputedStyle(document.documentElement).getPropertyValue('--dnd5e-filter-feature')?.trim() || '#d15300',
            data: { itemType: 'feat' }
        });

        // Cantrips (standalone - not grouped)
        const cantrips = this.actor.items.filter(i => i.type === 'spell' && i.system.level === 0);
        if (cantrips.length > 0) {
            filters.push({
                id: 'spell',
                label: game.i18n.localize(`${MODULE_ID}.Filters.Cantrip`),
                centerLabel: 'C',
                classes: ['spell-level-button', 'spell-cantrip-box'],
                color: getComputedStyle(document.documentElement).getPropertyValue('--dnd5e-filter-cantrip')?.trim() || '#3497d9',
                data: { level: 0, value: 1, max: 1 }
            });
        }

        // Build spell slot children for the group
        const spellSlotChildren = [];
        const spellColor = getComputedStyle(document.documentElement).getPropertyValue('--dnd5e-filter-spell')?.trim() || '#3497d9';

        // Spell levels 1-9
        for (let level = 1; level <= 9; level++) {
            const spellLevelKey = `spell${level}`;
            const spellLevel = this.actor.system.spells?.[spellLevelKey];

            if (spellLevel?.max > 0) {
                spellSlotChildren.push({
                    id: `spell-${level}`,
                    label: game.i18n.localize(`${MODULE_ID}.Filters.SpellLevel`),
                    short: this._getRomanNumeral(level),
                    classes: ['spell-level-button'],
                    color: spellColor,
                    data: { level: level, value: spellLevel.value, max: spellLevel.max },
                    value: spellLevel.value,
                    max: spellLevel.max
                });
            }
        }

        // Pact Magic
        const pactMagic = this.actor.system.spells?.pact;
        if (pactMagic?.max > 0) {
            const pactColor = getComputedStyle(document.documentElement).getPropertyValue('--dnd5e-filter-pact')?.trim() || '#7d3d97';
            spellSlotChildren.push({
                id: 'spell-pact',
                label: game.i18n.localize(`${MODULE_ID}.Filters.PactMagic`),
                short: 'P',
                classes: ['spell-level-button', 'spell-pact-box'],
                color: pactColor,
                data: {
                    isPact: true,
                    value: pactMagic.value,
                    max: pactMagic.max
                },
                value: pactMagic.value,
                max: pactMagic.max
            });
        }

        // Apothecary Magic (Sebastian Crowe's Guide to Drakkenheim compatibility)
        const apothecarySlot = normalizeApothecarySlots(this.actor);
        if (apothecarySlot) {
            spellSlotChildren.push(apothecarySlot);
        }

        // Add spell slots group if there are any spell slots
        if (spellSlotChildren.length > 0) {
            filters.push({
                id: 'spell-slots-group',
                type: 'group',
                label: game.i18n.localize(`${MODULE_ID}.Filters.SpellSlots`),
                symbol: 'fa-hat-wizard',
                color: spellColor,
                children: spellSlotChildren
            });
        }

        return filters;
    }

    /**
     * Convert number to Roman numeral
     * @param {number} num
     * @returns {string}
     * @private
     */
    _getRomanNumeral(num) {
        const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
        return numerals[num - 1] || num.toString();
    }

    /**
     * Check if a cell matches a filter (D&D 5e-specific logic)
     * @param {FilterButton} filter - The filter button
     * @param {HTMLElement} cell - The cell element
     * @returns {boolean}
     */
    matchesFilter(filter, cell) {
        if (!filter || !cell) return false;

        const filterData = filter.data;

        // Pact magic filter
        if (filterData.isPact) {
            const itemType = cell.dataset.itemType;
            if (itemType !== 'spell') return false;
            return cell.dataset.preparationMode === 'pact';
        }

        // Apothecary magic filter (SCGD compatibility)
        if (filterData.isApothecary) {
            const itemType = cell.dataset.itemType;
            if (itemType !== 'spell') return false;
            return cell.dataset.preparationMode === 'apothecary';
        }

        // Handle spell level filtering
        if (filterData.level !== undefined) {
            const itemType = cell.dataset.itemType;
            if (itemType !== 'spell') return false;

            // Spell level filter
            const cellLevel = parseInt(cell.dataset.level);
            return cellLevel === filterData.level;
        }

        // Handle item type filtering (features)
        if (filterData.itemType) {
            return cell.dataset.itemType === filterData.itemType;
        }

        // Handle action type filtering (action, bonus, reaction)
        if (filterData.actionType) {
            const actionType = filterData.actionType;
            // Check both old system (actionType) and new system (activityActionTypes)
            return cell.dataset.actionType === actionType ||
                cell.dataset.activityActionTypes?.split(',').includes(actionType);
        }

        return false;
    }

    /**
     * Sync bonus/reaction filter "used" state from Midi-QoL action economy effects
     * @param {ActiveEffect} [effect] - Optional effect that triggered the sync
     */
    syncUsedActionFilters(effect) {
        if (!game.modules.get('midi-qol')?.active) return;
        if (!game.settings.get(MODULE_ID, 'syncBonusReactionFilters')) return;
        if (!this.actor) return;

        if (effect && !ACTION_ECONOMY_EFFECT_IDS.includes(effect.id)) return;

        const activeEffects = this.actor.effects?.contents ?? [];
        const bonusFilter = this.getAllFilterButtons().find(f => f.data.id === 'bonus');
        const reactionFilter = this.getAllFilterButtons().find(f => f.data.id === 'reaction');

        this._syncFilterUsedState(
            bonusFilter,
            activeEffects.some(e => e.id === BONUS_ACTION_EFFECT_ID)
        );
        this._syncFilterUsedState(
            reactionFilter,
            activeEffects.some(e => e.id === REACTION_EFFECT_ID)
        );
    }

    /**
     * Align a filter's used state with the desired value
     * @param {import('/modules/bg3-hud-core/scripts/components/buttons/FilterButton.js').FilterButton|null} filterButton
     * @param {boolean} isUsed
     * @private
     */
    _syncFilterUsedState(filterButton, isUsed) {
        if (!filterButton) return;

        const currentlyUsed = this._used.includes(filterButton);
        if (isUsed !== currentlyUsed) {
            this.used = filterButton;
        }
    }

    /**
     * @override
     */
    async render() {
        const element = await super.render();
        this.syncUsedActionFilters();
        return element;
    }

    /**
     * @override
     */
    async update() {
        await super.update();
        this.syncUsedActionFilters();
    }
}

