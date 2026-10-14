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

/**
 * CPR (Chris's Premades) pack registry for the active D&D 5e rules version.
 * "modern" = 2024 rules, "legacy" = 2014 rules.
 *
 * Two distinct CPR compendium packs are involved, for two distinct purposes:
 *  - actionsPackId: the pack GMs choose quick-access / auto-populate actions
 *    from (CPRActions for legacy, CPRActions2024 for modern).
 *  - miscPackId / genericActionsUuid: the pack (and specific item) backing
 *    the "Generic Actions" dialog button (CPRMiscellaneous for both).
 * Keep these separate — they are not interchangeable.
 */
const CPR_PACKS = {
    legacy: {
        packName: 'CPRActions',
        actionsPackId: 'chris-premades.CPRActions',
        // 2014 default actions: Dash, Disengage, Dodge, Grapple, Help, Hide
        defaultActions: ['Dash', 'Disengage', 'Dodge', 'Grapple', 'Help', 'Hide'],
        settingsKey: 'selectedCPRActionsLegacy',
        miscPackId: 'chris-premades.CPRMiscellaneous',
        genericActionsUuid: 'Compendium.chris-premades.CPRMiscellaneous.Item.V0rdpb8WPmdYhAjc'
    },
    modern: {
        packName: 'CPRActions2024',
        actionsPackId: 'chris-premades.CPRActions2024',
        // 2024 default actions: Dash, Disengage, Dodge, Help, Hide, Ready
        defaultActions: ['Dash', 'Disengage', 'Dodge', 'Help', 'Hide', 'Ready'],
        settingsKey: 'selectedCPRActionsModern',
        miscPackId: 'chris-premades.CPRMiscellaneous',
        genericActionsUuid: 'Compendium.chris-premades.CPRMiscellaneous.Item.Iz2XtxLReLnXTDiI'
    }
};

/**
 * Single source of truth for reading the active D&D 5e rules version.
 * Every CPR consumer should call into this (directly or via getCPRConfig /
 * getCPRGenericActionsUUID) instead of reading the setting independently.
 * @returns {string} The raw `dnd5e.rulesVersion` setting value (typically 'legacy' or 'modern')
 */
export function getCPRRulesVersion() {
    return game.settings.get('dnd5e', 'rulesVersion');
}

/**
 * CPR (Chris's Premades) actions configuration for the active D&D 5e rules version.
 * "modern" = 2024 rules, "legacy" = 2014 rules.
 * @returns {{packName: string, packId: string, defaultActions: string[], isModern: boolean, settingsKey: string}}
 */
export function getCPRConfig() {
    const rulesVersion = getCPRRulesVersion();
    const isModern = rulesVersion === 'modern';
    const entry = isModern ? CPR_PACKS.modern : CPR_PACKS.legacy;

    return {
        packName: entry.packName,
        packId: entry.actionsPackId,
        defaultActions: entry.defaultActions,
        isModern,
        settingsKey: entry.settingsKey
    };
}

/**
 * CPR Generic Actions item UUID (CPRMiscellaneous pack) for the active rules version.
 * @returns {string}
 */
export function getCPRGenericActionsUUID() {
    const rulesVersion = getCPRRulesVersion();
    const entry = rulesVersion === 'legacy' ? CPR_PACKS.legacy : CPR_PACKS.modern;
    return entry.genericActionsUuid;
}
