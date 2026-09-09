const MODULE_ID = 'bg3-hud-dnd5e';

function adapterFlags(changes) {
    return changes?.flags?.[MODULE_ID] || null;
}

function hasOwn(obj, key) {
    return !!obj && Object.prototype.hasOwnProperty.call(obj, key);
}

function itemList(actor) {
    const items = actor?.items;
    if (!items) return [];
    if (typeof items.filter === 'function') return items.filter((item) => item);
    if (Array.isArray(items)) return items;
    if (Array.isArray(items.contents)) return items.contents;
    return [];
}

/**
 * System-specific notice. Core unions this with the default (HP, abilities, resources).
 * @param {Object} [changes]
 * @param {Object} [actor]
 */
export function resolveDnd5eNotice(changes = {}, actor = null) {
    const fills = [];
    const extras = [];
    const flags = adapterFlags(changes);

    if (hasOwn(flags, 'selectedPassives')) {
        fills.push('passives');
    }
    if (hasOwn(flags, 'useTokenImage') || hasOwn(flags, 'scaleWithToken')) {
        fills.push('portrait:face');
    }
    if (
        hasOwn(flags, 'advState') || hasOwn(flags, '-=advState')
        || hasOwn(flags, 'advOnce') || hasOwn(flags, '-=advOnce')
    ) {
        extras.push('situationalBonuses');
    }

    let cells;
    if (changes?.system?.spells !== undefined) {
        fills.push('filter');
        const parked = itemList(actor)
            .filter((item) => item.type === 'spell' && item.uuid)
            .map((item) => item.uuid);
        if (parked.length) cells = { parked };
    }

    return { fills, extras, cells };
}
