import { AutoSortFramework, compareByTypeThenKey } from '/modules/bg3-hud-core/scripts/features/AutoSortFramework.js';
import { createLogger } from '/modules/bg3-hud-core/scripts/utils/logger.js';

const log = createLogger('bg3-hud-dnd5e');

/**
 * D&D 5e Auto Sort Implementation
 * Provides D&D 5e-specific item sorting logic
 */
export class DnD5eAutoSort extends AutoSortFramework {
    /**
     * Enrich items with D&D 5e-specific sort data
     * @param {Array<Object>} items - Array of items to enrich
     * @returns {Promise<void>}
     */
    async enrichItemsForSort(items) {
        for (const item of items) {
            try {
                if (!item.uuid) continue;
                const itemData = await fromUuid(item.uuid);
                if (itemData) {
                    // Store basic data
                    item.name = itemData.name;
                    item.type = itemData.type;
                    
                    // Build D&D 5e-specific sort data
                    item.sortData = {
                        name: itemData.name,
                        spellLevel: itemData.type === 'spell' ? (itemData.system?.level ?? 99) : 99,
                        featureType: itemData.type === 'feat' ? (itemData.system?.type?.value ?? '') : ''
                    };
                } else {
                    // Fallback if item not found
                    item.sortData = {
                        name: item.name || '',
                        spellLevel: 99,
                        featureType: ''
                    };
                }
            } catch (error) {
                log.warn(`Failed to fetch item data for ${item.uuid}:`, error);
                item.sortData = {
                    name: item.name || '',
                    spellLevel: 99,
                    featureType: ''
                };
            }
        }
    }

    /**
     * Sort items using D&D 5e priority rules
     * Priority: weapon > feat > equipment > spell > consumable > tool > loot
     * @param {Array<Object>} items - Array of items to sort in place
     * @returns {Promise<void>}
     */
    async sortItems(items) {
        // Define D&D 5e item type order (first to last)
        const typeOrder = ['weapon', 'feat', 'equipment', 'spell', 'consumable', 'tool', 'loot'];

        // Secondary tie-break within a type: spells by level (cantrips = 0, then 1-9),
        // feats by feature type. Every other type falls straight through to name.
        const secondaryKeyFns = {
            spell: (item) => item.sortData?.spellLevel ?? 99,
            feat: (item) => item.sortData?.featureType || ''
        };

        items.sort(compareByTypeThenKey(typeOrder, secondaryKeyFns, {
            getName: (item) => item.name || item.sortData?.name || ''
        }));
    }
}

