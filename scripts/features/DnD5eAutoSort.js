import { AutoSortFramework } from '/modules/bg3-hud-core/scripts/features/AutoSortFramework.js';

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
                console.warn(`BG3 HUD D&D 5e | Failed to fetch item data for ${item.uuid}:`, error);
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
        
        items.sort((a, b) => {
            // First, sort by item type according to our defined order
            const typeIndexA = typeOrder.indexOf(a.type);
            const typeIndexB = typeOrder.indexOf(b.type);
            
            // Handle different type priorities
            if (typeIndexA !== typeIndexB) {
                if (typeIndexA === -1) return 1;  // Unknown types go to the end
                if (typeIndexB === -1) return -1;
                return typeIndexA - typeIndexB;
            }
            
            // Then apply D&D 5e type-specific sorting
            switch (a.type) {
                case 'spell':
                    // Sort by spell level first (cantrips = 0, then 1-9)
                    const levelA = a.sortData?.spellLevel ?? 99;
                    const levelB = b.sortData?.spellLevel ?? 99;
                    if (levelA !== levelB) {
                        return levelA - levelB;
                    }
                    // If same level, sort alphabetically
                    return (a.name || a.sortData?.name || '').localeCompare(b.name || b.sortData?.name || '');

                case 'feat':
                    // Sort by feature type first
                    const typeA = a.sortData?.featureType || '';
                    const typeB = b.sortData?.featureType || '';
                    const typeCompare = typeA.localeCompare(typeB);
                    if (typeCompare !== 0) {
                        return typeCompare;
                    }
                    // If same type, sort alphabetically
                    return (a.name || a.sortData?.name || '').localeCompare(b.name || b.sortData?.name || '');

                default:
                    // All other items sort alphabetically within their type
                    return (a.name || a.sortData?.name || '').localeCompare(b.name || b.sortData?.name || '');
            }
        });
    }
}

