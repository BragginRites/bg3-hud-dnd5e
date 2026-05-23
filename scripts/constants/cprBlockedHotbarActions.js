/**
 * Generic action names excluded from main hotbar auto-populate by default.
 * Derived items (e.g. "Grapple: Escape") are allowed — match exact names only.
 */
export const CPR_EXCLUDED_AUTO_POPULATE_ACTION_NAMES = [
    'Attack',
    'Check Cover',
    'Dash',
    'Disengage',
    'Dodge',
    'Fall',
    'Grapple',
    'Help',
    'Hide',
    'Influence',
    'Jump',
    'Knock Out',
    'Magic',
    'Mount',
    'Ready',
    'Search',
    'Shove',
    'Squeeze',
    'Stabilize',
    'Study',
    'Suffocation',
    'Underwater',
    'Use an Object',
    'Utilize'
];

/** Compendium source substrings for CPR / generic action items */
export const CPR_ACTION_COMPENDIUM_SOURCE_PATTERNS = [
    'chris-premades.CPRActions',
    'chris-premades.CPRActions2024',
    'chris-premades.CPRMiscellaneous',
    'world.cpr-actions',
    'world.cpr-actions-2024'
];

const GENERIC_ACTIONS_DIALOG_NAMES = [
    'Generic Actions (2014)',
    'Generic Actions (2024)'
];

/** @deprecated Use CPR_EXCLUDED_AUTO_POPULATE_ACTION_NAMES */
export const CPR_BLOCKED_HOTBAR_ACTION_NAMES = CPR_EXCLUDED_AUTO_POPULATE_ACTION_NAMES;

/**
 * @param {string} name - Item or activity display name
 * @returns {boolean}
 */
export function isExcludedCPRAutoPopulateActionName(name) {
    if (!name) return false;
    return CPR_EXCLUDED_AUTO_POPULATE_ACTION_NAMES.includes(name)
        || GENERIC_ACTIONS_DIALOG_NAMES.includes(name);
}

/**
 * @param {Item|{name?: string, _stats?: object, flags?: object}} doc
 * @returns {boolean}
 */
export function isExcludedCPRAutoPopulateDocument(doc) {
    if (!doc) return false;
    if (isExcludedCPRAutoPopulateActionName(doc.name)) return true;

    const source = doc._stats?.compendiumSource || doc.flags?.core?.sourceId || '';
    return CPR_ACTION_COMPENDIUM_SOURCE_PATTERNS.some(pattern => source.includes(pattern));
}

const MODULE_ID = 'bg3-hud-dnd5e';

/**
 * Whether a document should be excluded from hotbar auto-add / auto-populate.
 * @param {Item|{name?: string, _stats?: object, flags?: object}} doc
 * @returns {boolean}
 */
export function shouldExcludeGenericActionFromHotbarAutoAdd(doc) {
    if (!doc) return false;
    if (game.settings.get(MODULE_ID, 'allowCPRActionsInAutoPopulate')) return false;
    return isExcludedCPRAutoPopulateDocument(doc);
}
