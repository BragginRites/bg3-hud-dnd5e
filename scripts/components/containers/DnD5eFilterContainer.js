import { FilterContainer } from '/modules/bg3-hud-core/scripts/components/containers/FilterContainer.js';

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
            label: 'Action',
            symbol: 'fa-circle',
            classes: ['action-type-button'],
            color: getComputedStyle(document.documentElement).getPropertyValue('--dnd5e-filter-action')?.trim() || '#ff6b6b',
            data: { actionType: 'action' }
        });

        filters.push({
            id: 'bonus',
            label: 'Bonus Action',
            symbol: 'fa-triangle',
            classes: ['action-type-button'],
            color: getComputedStyle(document.documentElement).getPropertyValue('--dnd5e-filter-bonus')?.trim() || '#4ecdc4',
            data: { actionType: 'bonus' }
        });

        filters.push({
            id: 'reaction',
            label: 'Reaction',
            symbol: 'fa-sparkle',
            classes: ['action-type-button'],
            color: getComputedStyle(document.documentElement).getPropertyValue('--dnd5e-filter-reaction')?.trim() || '#95e1d3',
            data: { actionType: 'reaction' }
        });

        // Legendary action filter - only show if actor has legendary actions
        if (this._hasLegendaryActions()) {
            filters.push({
                id: 'legendary',
                label: 'Legendary Action',
                symbol: 'fa-dragon',
                classes: ['action-type-button'],
                color: getComputedStyle(document.documentElement).getPropertyValue('--dnd5e-filter-legendary')?.trim() || '#ffd700',
                data: { actionType: 'legendary' }
            });
        }

        filters.push({
            id: 'feature',
            label: 'Feature',
            symbol: 'fa-star',
            classes: ['action-type-button'],
            color: getComputedStyle(document.documentElement).getPropertyValue('--dnd5e-filter-feature')?.trim() || '#f38181',
            data: { itemType: 'feat' }
        });

        // Cantrips
        const cantrips = this.actor.items.filter(i => i.type === 'spell' && i.system.level === 0);
        if (cantrips.length > 0) {
            filters.push({
                id: 'spell',
                label: 'Cantrip',
                short: 'C',
                classes: ['spell-level-button', 'spell-cantrip-box'],
                color: getComputedStyle(document.documentElement).getPropertyValue('--dnd5e-filter-cantrip')?.trim() || '#9b59b6',
                data: { level: 0, value: 1, max: 1 }
            });
        }

        // Spell levels 1-9
        for (let level = 1; level <= 9; level++) {
            const spellLevelKey = `spell${level}`;
            const spellLevel = this.actor.system.spells?.[spellLevelKey];

            if (spellLevel?.max > 0) {
                filters.push({
                    id: 'spell',
                    label: 'Spell Level',
                    short: this._getRomanNumeral(level),
                    classes: ['spell-level-button'],
                    color: getComputedStyle(document.documentElement).getPropertyValue('--dnd5e-filter-spell')?.trim() || '#8e44ad',
                    data: { level: level, value: spellLevel.value, max: spellLevel.max },
                    value: spellLevel.value,
                    max: spellLevel.max
                });
            }
        }

        // Pact Magic
        const pactMagic = this.actor.system.spells?.pact;
        if (pactMagic?.max > 0) {
            filters.push({
                id: 'spell',
                label: 'Pact Magic',
                short: 'P',
                classes: ['spell-level-button', 'spell-pact-box'],
                color: getComputedStyle(document.documentElement).getPropertyValue('--dnd5e-filter-pact')?.trim() || '#9c27b0',
                data: { 
                    isPact: true,
                    value: pactMagic.value,
                    max: pactMagic.max
                },
                value: pactMagic.value,
                max: pactMagic.max
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

        // Handle spell level filtering
        if (filterData.level !== undefined) {
            const itemType = cell.dataset.itemType;
            if (itemType !== 'spell') return false;

            // Pact magic filter
            if (filterData.isPact) {
                return cell.dataset.preparationMode === 'pact';
            }

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
}

