/**
 * Sebastian Crowe's Guide to Drakkenheim - Apothecary Magic Compatibility
 *
 * Detects and normalizes apothecary spell slots from the SCGD module.
 * Apothecary Magic is a special spell slot type similar to Pact Magic,
 * used by the Apothecary class from SCGD.
 *
 * @module compatibility/scgd-apothecary
 */

const MODULE_ID = 'bg3-hud-dnd5e';

/**
 * Detect apothecary magic slots on an actor
 * @param {Actor5e} actor - The D&D 5e actor
 * @returns {Object|null} Apothecary magic data or null if not present
 */
export function detectApothecaryMagic(actor) {
    const apothecary = actor?.system?.spells?.apothecary;

    if (!apothecary || apothecary.max <= 0) {
        return null;
    }

    return {
        value: apothecary.value ?? 0,
        max: apothecary.max,
        level: apothecary.level ?? 1
    };
}

/**
 * Normalize apothecary magic to HUD resource format
 * @param {Actor5e} actor - The D&D 5e actor
 * @returns {Object|null} Normalized spell slot resource or null
 */
export function normalizeApothecarySlots(actor) {
    const data = detectApothecaryMagic(actor);

    if (!data) return null;

    return {
        id: 'spell-apothecary',
        label: game.i18n.localize(`${MODULE_ID}.Filters.ApothecaryMagic`),
        short: 'A',
        classes: ['spell-level-button', 'spell-apothecary-box'],
        color: getComputedStyle(document.documentElement)
            .getPropertyValue('--dnd5e-filter-apothecary')?.trim() || '#285348',
        data: {
            isApothecary: true,
            value: data.value,
            max: data.max,
            level: data.level
        },
        value: data.value,
        max: data.max
    };
}
