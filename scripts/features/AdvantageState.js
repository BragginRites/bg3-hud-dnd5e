/**
 * Advantage/disadvantage roll-reminder state.
 * Owns the `advState` / `advOnce` actor flags so the ADV/DIS container, the
 * dnd5e roll hooks, and anything else that needs this state don't each
 * re-derive the flag names independently.
 */

import { readDnd5eAtLeast } from '../utils/thirdPartyCompat.js';

const MODULE_ID = 'bg3-hud-dnd5e';

/**
 * @typedef {Object} AdvantageStateValue
 * @property {string|undefined} state - 'advBtn' | 'disBtn' | undefined when cleared
 * @property {boolean|undefined} once - whether the state clears after one roll
 */

/**
 * Read the current advantage/disadvantage roll-reminder state from an actor.
 * @param {Actor} actor
 * @returns {AdvantageStateValue}
 */
export function getAdvantageState(actor) {
    return {
        state: actor?.getFlag(MODULE_ID, 'advState'),
        once: actor?.getFlag(MODULE_ID, 'advOnce')
    };
}

/**
 * Set the advantage/disadvantage roll-reminder state on an actor.
 * @param {Actor} actor
 * @param {string} state - 'advBtn' | 'disBtn'
 * @param {boolean} once - whether the state should clear after one roll
 * @returns {Promise<void>}
 */
export async function setAdvantageState(actor, state, once) {
    if (!actor) return;
    await actor.setFlag(MODULE_ID, 'advOnce', once);
    await actor.setFlag(MODULE_ID, 'advState', state);
}

/**
 * Clear the advantage/disadvantage roll-reminder state on an actor.
 * @param {Actor} actor
 * @returns {Promise<void>}
 */
export async function clearAdvantageState(actor) {
    if (!actor) return;
    await actor.unsetFlag(MODULE_ID, 'advState');
    await actor.unsetFlag(MODULE_ID, 'advOnce');
}

/**
 * Whether ADV/DIS roll-reminder state should be applied to midi-qol rolls -
 * i.e. the midi-qol module is active AND the "addAdvBtnsMidiQoL" setting is
 * enabled.
 *
 * Note: deliberately not coerced to a strict boolean - mirrors the previous
 * inline `game.modules.get('midi-qol')?.active && game.settings.get(...)`
 * expression, which evaluates to `undefined` (not `false`) when the
 * midi-qol module isn't installed at all. Callers that stringify this value
 * (e.g. for a dataset attribute) rely on that distinction being preserved.
 * @returns {boolean|undefined}
 */
export function isMidiQolIntegrationActive() {
    // dnd5e 5 keeps this path, including on Foundry 14. dnd5e 6 does not.
    if (readDnd5eAtLeast(6)) return false;
    return game.modules.get('midi-qol')?.active
        && game.settings.get(MODULE_ID, 'addAdvBtnsMidiQoL');
}
