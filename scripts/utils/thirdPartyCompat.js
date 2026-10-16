/**
 * Midi-QoL and CPR hooks in this HUD target the Foundry 13 / dnd5e 5 automation
 * stack. Foundry 14 and dnd5e 6 are a different stack, and these integrations
 * are left off until the HUD is updated for them.
 */

/**
 * @param {string|number|null|undefined} version
 * @returns {number}
 */
function majorVersion(version) {
    const major = Number.parseInt(String(version ?? '').split('.')[0], 10);
    return Number.isFinite(major) ? major : 0;
}

/**
 * @param {object} [host]
 * @param {string|number} [host.foundryVersion]
 * @param {string} [host.systemId]
 * @param {string|number} [host.systemVersion]
 * @returns {boolean}
 */
export function isThirdPartyAutomationUnsupported({ foundryVersion, systemId, systemVersion } = {}) {
    if (majorVersion(foundryVersion) >= 14) return true;
    if (systemId === 'dnd5e' && majorVersion(systemVersion) >= 6) return true;
    return false;
}

/**
 * dnd5e 5.x still owns the ADV/DIS roll path. Only 6 and later turns it off.
 * @param {number} major
 * @param {object} [host]
 * @param {string} [host.systemId]
 * @param {string|number} [host.systemVersion]
 * @returns {boolean}
 */
export function isDnd5eAtLeast(major, { systemId, systemVersion } = {}) {
    return systemId === 'dnd5e' && majorVersion(systemVersion) >= major;
}

/**
 * Read the running world. Missing game data counts as supported so a settings
 * menu built before the system is ready does not grey itself out by accident.
 * @returns {boolean}
 */
export function readThirdPartyAutomationUnsupported() {
    return isThirdPartyAutomationUnsupported({
        foundryVersion: globalThis.game?.release?.version ?? globalThis.game?.version,
        systemId: globalThis.game?.system?.id,
        systemVersion: globalThis.game?.system?.version
    });
}

/**
 * @param {number} major
 * @returns {boolean}
 */
export function readDnd5eAtLeast(major) {
    return isDnd5eAtLeast(major, {
        systemId: globalThis.game?.system?.id,
        systemVersion: globalThis.game?.system?.version
    });
}
