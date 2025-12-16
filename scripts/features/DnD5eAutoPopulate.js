import { AutoPopulateFramework } from '/modules/bg3-hud-core/scripts/features/AutoPopulateFramework.js';

const MODULE_ID = 'bg3-hud-dnd5e';

/**
 * D&D 5e Auto Populate Implementation
 * Provides D&D 5e-specific item filtering and population logic
 */
export class DnD5eAutoPopulate extends AutoPopulateFramework {
    /**
     * Get D&D 5e item type choices (grouped)
     * @returns {Promise<Array<{group: string, choices: Array<{value: string, label: string}>}>>}
     */
    async getItemTypeChoices() {
        return [
            {
                group: game.i18n.localize(`${MODULE_ID}.AutoPopulate.Groups.Combat`),
                choices: [
                    { value: 'weapon', label: game.i18n.localize(`${MODULE_ID}.AutoPopulate.ItemTypes.Weapons`) },
                    { value: 'feat', label: game.i18n.localize(`${MODULE_ID}.AutoPopulate.ItemTypes.FeaturesActions`) },
                    { value: 'spell', label: game.i18n.localize(`${MODULE_ID}.AutoPopulate.ItemTypes.Spells`) }
                ]
            },
            {
                group: game.i18n.localize(`${MODULE_ID}.AutoPopulate.Groups.Consumables`),
                choices: [
                    { value: 'consumable:ammo', label: game.i18n.localize(`${MODULE_ID}.AutoPopulate.ItemTypes.Ammunition`) },
                    { value: 'consumable:potion', label: game.i18n.localize(`${MODULE_ID}.AutoPopulate.ItemTypes.Potions`) },
                    { value: 'consumable:poison', label: game.i18n.localize(`${MODULE_ID}.AutoPopulate.ItemTypes.Poisons`) },
                    { value: 'consumable:scroll', label: game.i18n.localize(`${MODULE_ID}.AutoPopulate.ItemTypes.Scrolls`) },
                    { value: 'consumable:food', label: game.i18n.localize(`${MODULE_ID}.AutoPopulate.ItemTypes.FoodDrink`) }
                ]
            },
            {
                group: game.i18n.localize(`${MODULE_ID}.AutoPopulate.Groups.Wondrous`),
                choices: [
                    { value: 'equipment', label: game.i18n.localize(`${MODULE_ID}.AutoPopulate.ItemTypes.Equipment`) },
                    { value: 'consumable:wand', label: game.i18n.localize(`${MODULE_ID}.AutoPopulate.ItemTypes.Wands`) },
                    { value: 'consumable:rod', label: game.i18n.localize(`${MODULE_ID}.AutoPopulate.ItemTypes.Rods`) },
                    { value: 'consumable:trinket', label: game.i18n.localize(`${MODULE_ID}.AutoPopulate.ItemTypes.Trinkets`) }
                ]
            },
            {
                group: game.i18n.localize(`${MODULE_ID}.AutoPopulate.Groups.Other`),
                choices: [
                    { value: 'tool', label: game.i18n.localize(`${MODULE_ID}.AutoPopulate.ItemTypes.Tools`) },
                    { value: 'loot', label: game.i18n.localize(`${MODULE_ID}.AutoPopulate.ItemTypes.Loot`) }
                ]
            }
        ];
    }

    /**
     * Get items from actor that match selected types
     * Includes D&D 5e-specific filtering (spell preparation, activities, etc.)
     * Excludes CPR actions which should only appear in quick access
     * @param {Actor} actor - The actor
     * @param {Array<string>} selectedTypes - Selected type values
     * @returns {Promise<Array<{uuid: string}>>}
     */
    async getMatchingItems(actor, selectedTypes) {
        const items = [];

        for (const item of actor.items) {
            // Check if item matches any selected type
            if (!this._matchesType(item, selectedTypes)) {
                continue;
            }

            // For spells, check preparation state
            if (item.type === 'spell' && !this._isSpellUsable(actor, item)) {
                continue;
            }

            // Spells bypass _hasActivities (v5.1 spells often have no activities)
            if (item.type !== 'spell' && !this._hasActivities(item)) {
                continue;
            }

            // Exclude CPR items - they should only appear in quick access
            if (this._isCPRItem(item)) {
                continue;
            }

            items.push({ uuid: item.uuid });
        }

        return items;
    }

    /**
     * Check if an item is a CPR action that should be excluded from main hotbar
     * CPR actions should only appear in quick access container
     * @param {Item} item - The item to check
     * @returns {boolean} True if this is a CPR item that should be excluded
     * @private
     */
    _isCPRItem(item) {
        if (!item) return false;

        // Check if CPR blocking is enabled
        const blockCPRActions = game.settings.get(MODULE_ID, 'blockCPRActionsOnHotbar');
        if (!blockCPRActions) return false;

        // Check if CPR module is active
        if (!game.modules.get('chris-premades')?.active) return false;

        // CHECK BY NAME FIRST - most reliable for embedded items
        // Generic Actions items (main dialog items)
        const genericActionsNames = [
            'Generic Actions (2014)',
            'Generic Actions (2024)'
        ];
        if (genericActionsNames.includes(item.name)) {
            return true;
        }

        // Check against selected CPR action names from settings
        // These are the actions that get auto-populated to quick access
        const rulesVersion = game.settings.get('dnd5e', 'rulesVersion');
        const settingsKey = rulesVersion === 'modern'
            ? 'selectedCPRActionsModern'
            : 'selectedCPRActionsLegacy';

        // Get the CPR action names that are configured for quick access
        // These should NOT appear in main hotbar
        const cprActionNames = this._getCPRActionNames();
        if (cprActionNames.includes(item.name)) {
            return true;
        }

        // CHECK BY SOURCE - for items dragged from compendium
        const sourceCompendium = item._stats?.compendiumSource || item.flags?.core?.sourceId || '';

        // Block items from CPRActions or CPRActions2024 compendiums
        if (sourceCompendium.includes('chris-premades.CPRActions') ||
            sourceCompendium.includes('chris-premades.CPRActions2024')) {
            return true;
        }

        // Block items from CPRMiscellaneous (Generic Actions items)
        if (sourceCompendium.includes('chris-premades.CPRMiscellaneous')) {
            return true;
        }

        return false;
    }

    /**
     * Get the list of CPR action names that should be blocked from main hotbar
     * These are the standard CPR actions like Dash, Dodge, Disengage, etc.
     * @returns {string[]} Array of action names
     * @private
     */
    _getCPRActionNames() {
        // Standard CPR action names (both 2014 and 2024)
        // These should only appear in quick access, not main hotbar
        return [
            'Dash',
            'Disengage',
            'Dodge',
            'Grapple',
            'Help',
            'Hide',
            'Ready',
            'Shove',
            'Search',
            'Use an Object',
            'Influence',
            'Magic',
            'Study'
        ];
    }

    /**
     * Check if item matches any of the selected types
     * @param {Item} item - The item to check
     * @param {Array<string>} selectedTypes - Selected type values
     * @returns {boolean}
     * @private
     */
    _matchesType(item, selectedTypes) {
        for (const selectedType of selectedTypes) {
            if (selectedType.includes(':')) {
                // Handle subtype (e.g., "consumable:potion")
                const [mainType, subType] = selectedType.split(':');

                if (item.type !== mainType) continue;

                // dnd5e v5+: consumables store subtype in system.type.value
                // e.g., { type: "consumable", system: { type: { value: "potion" } } }
                const systemType = item.system?.type;
                const detectedSubtype = (
                    systemType?.value ??      // Primary: system.type.value (potions, scrolls, etc.)
                    systemType?.subtype ??    // Fallback: system.type.subtype
                    item.system?.consumableType  // Legacy: system.consumableType
                );

                if (detectedSubtype === subType) return true;
            } else {
                // Handle main type (e.g., "weapon", "feat", "spell")
                if (item.type === selectedType) return true;
            }
        }
        return false;
    }

    /**
     * Check if spell is usable (prepared, always prepared, etc.)
     * When 'autoPopulatePreparedSpellsOnly' is enabled (default), only includes:
     * - Prepared spells (system.prepared !== 0)
     * - At-will, innate, pact magic spells (method !== "spell")
     * When disabled, includes all spells with a valid casting method.
     * @param {Actor} actor - The actor
     * @param {Item} item - The spell item
     * @returns {boolean}
     * @private
     */
    _isSpellUsable(actor, item) {
        const sys = item.system ?? {};
        const method = sys.method ?? "";

        // Empty method: not a usable spell regardless of setting
        if (method === "") {
            return false;
        }

        // Non-learned spells (pact, innate, atwill, etc.) are always considered usable
        if (method !== "spell") {
            return true;
        }

        // For learned spells with method="spell", check preparation if setting is enabled
        const preparedOnly = game.settings.get(MODULE_ID, 'autoPopulatePreparedSpellsOnly');
        if (!preparedOnly) {
            // Setting disabled: include all learned spells
            return true;
        }

        // Setting enabled: only include prepared spells (prepared !== 0)
        const prepared = sys.prepared ?? 0;
        return prepared !== 0;
    }

    /**
     * Check if item has activities or is usable
     * @param {Item} item - The item to check
     * @returns {boolean}
     * @private
     */
    _hasActivities(item) {
        const activities = item.system?.activities;

        // dnd5e v5+: activities is typically a plain object keyed by id
        if (activities instanceof Map) {
            if (activities.size > 0) return true;
        } else if (activities && typeof activities === 'object') {
            if (Array.isArray(activities)) {
                if (activities.length > 0) return true;
            } else if (Object.keys(activities).length > 0) {
                return true;
            }
        }

        // Fallback to legacy activation
        if (item.system?.activation?.type && item.system.activation.type !== 'none') return true;

        // Weapons and equipment are generally usable
        if (item.type === 'weapon' || item.type === 'equipment') return true;

        return false;
    }
}