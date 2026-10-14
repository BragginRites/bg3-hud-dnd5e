/**
 * D&D 5e Item Classification
 * Pure data-in/data-out predicates for "is this item held in a weapon-set
 * slot" and "does this weapon need both hands" questions. No Foundry globals
 * (game/ui/canvas, fromUuidSync) are read here - callers must resolve the
 * item/document themselves and pass it in, keeping this module trivially
 * testable.
 */

/**
 * Whether a resolved item/document counts as "held" for weapon-set slot
 * purposes.
 *
 * Mirrors the previous inline logic in DnD5eAdapter#_isHeldDocument:
 * - weapons are always held
 * - equipment is held only if it's a shield (`system.type.value`/`system.type`
 *   === 'shield', or `system.armor.type` === 'shield')
 * - consumables are held only if they're a wand (`system.type.value`/
 *   `system.type` === 'wand')
 * - everything else (including a falsy item) is not held
 *
 * @param {Item|Object|null} item - A resolved item/document, or a plain
 *   object with the same `type`/`system` shape
 * @returns {boolean}
 */
export function isHeldDocument(item) {
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
 * Whether a resolved weapon item/document is two-handed, based on its
 * `properties` (the "two" property - `item.system.properties` may be a Set,
 * an Array, or a plain object of booleans depending on dnd5e schema version).
 *
 * Mirrors the previous inline logic in DnD5eAdapter#isTwoHanded (the portion
 * that runs once a weapon document has been resolved; the cell-level
 * `isTwoHandedDuplicate`/`cell.two` shortcuts stay in the adapter since they
 * inspect the cell data, not the resolved document).
 *
 * @param {Item|Object|null} item - A resolved item/document, or a plain
 *   object with the same `type`/`system` shape
 * @returns {boolean}
 */
export function isTwoHandedWeapon(item) {
    if (!item || item.type !== 'weapon') return false;
    const properties = item.system?.properties;
    if (properties instanceof Set) return properties.has('two');
    if (Array.isArray(properties)) return properties.includes('two');
    return properties?.two === true;
}

/**
 * Normalize an item's `system.activities` field to a plain array, regardless
 * of whether dnd5e is storing it as a Map/Collection, a plain object keyed
 * by activity id, or (rarely) an array. Returns `[]` for a falsy/absent
 * `activities` field.
 *
 * Mirrors the previously independently hand-rolled normalization in
 * PassiveBookkeeping.js, DnD5eAutoPopulate.js (`_getActivities`/
 * `_hasActivities`), and (partially - see DnD5eFilterContainer.js for the one
 * site that was NOT merged into this helper) DnD5eFilterContainer.js.
 *
 * @param {Item|Object|null} item - A resolved item/document, or a plain
 *   object with the same `system.activities` shape
 * @returns {Array} The normalized list of activities (empty if none)
 */
export function getActivitiesArray(item) {
    const activities = item?.system?.activities;
    if (!activities) return [];
    if (activities instanceof Map) return Array.from(activities.values());
    if (Array.isArray(activities)) return activities;
    if (typeof activities === 'object') return Object.values(activities);
    return [];
}
