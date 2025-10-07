/**
 * D&D 5e Container Detection, Content Extraction, and Persistence
 * Provides methods for identifying containers, extracting their contents, and saving changes
 */

/**
 * Check if an item is a container (bag, pouch, box, etc.)
 * @param {Object} cellData - The cell's data object
 * @returns {Promise<boolean>}
 */
export async function isContainer(cellData) {
    if (!cellData || !cellData.uuid) return false;

    const item = await fromUuid(cellData.uuid);
    if (!item) return false;

    // D&D 5e containers have type 'container' or 'backpack'
    return item.type === 'container' || item.type === 'backpack';
}

/**
 * Get contents of a container item
 * @param {Item} containerItem - The container item
 * @param {Actor} actor - The actor who owns the container
 * @returns {Promise<Object>} Grid data with rows, cols, and items
 */
export async function getContainerContents(containerItem, actor) {
    if (!containerItem) {
        return { rows: 3, cols: 5, items: {} };
    }

    // Get items from the container
    // D&D 5e v5+: containers have a .contents property
    const contents = containerItem.system?.contents || [];
    
    // Transform contents to grid items
    const items = {};
    let index = 0;
    
    for (const content of contents) {
        // Get the actual item from the content reference
        const item = await fromUuid(content.uuid || content);
        if (!item) continue;

        // Calculate grid position (fill left to right, top to bottom)
        const col = index % 5;
        const row = Math.floor(index / 5);
        const slotKey = `${col}-${row}`;

        // Transform to cell data using adapter's transformation
        const adapter = ui.BG3HOTBAR?.registry?.activeAdapter;
        let cellData;
        if (adapter && typeof adapter.transformItemToCellData === 'function') {
            cellData = await adapter.transformItemToCellData(item);
        } else {
            // Fallback: manual transformation
            cellData = {
                uuid: item.uuid,
                name: item.name,
                img: item.img,
                type: 'Item',
                quantity: item.system?.quantity || 1,
                uses: item.system?.uses ? {
                    value: (item.system.uses.max - (item.system.uses.spent || 0)) || 0,
                    max: item.system.uses.max || 0
                } : null
            };
        }
        
        items[slotKey] = cellData;

        index++;
    }

    // Calculate required rows (minimum 3)
    const requiredRows = Math.max(3, Math.ceil(index / 5));

    return {
        rows: requiredRows,
        cols: 5,
        items: items
    };
}

/**
 * Save contents back to a D&D 5e container item
 * @param {Item} containerItem - The container item
 * @param {Object} items - Grid items object (slotKey: itemData)
 * @param {Actor} actor - The actor that owns the container
 * @returns {Promise<void>}
 */
export async function saveContainerContents(containerItem, items, actor) {
    if (!containerItem) {
        console.warn('DnD5eContainerPopover | No container item provided for save');
        return;
    }

    // Convert grid items back to contents array
    // Sort by slot position (row-col) to maintain order
    const sortedSlots = Object.keys(items).sort((a, b) => {
        const [colA, rowA] = a.split('-').map(Number);
        const [colB, rowB] = b.split('-').map(Number);
        if (rowA !== rowB) return rowA - rowB;
        return colA - colB;
    });

    const contents = [];
    for (const slotKey of sortedSlots) {
        const itemData = items[slotKey];
        if (itemData && itemData.uuid) {
            contents.push(itemData.uuid);
        }
    }

    // Update the container item's contents
    await containerItem.update({
        'system.contents': contents
    });
}
