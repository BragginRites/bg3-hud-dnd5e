/**
 * Apply the HUD ADV/DIS state to a dnd5e 5 roll config.
 * Attack rolls put an Activity on `subject`. Skill, save, and check rolls put
 * the Actor there. Midi-QoL puts the Actor on `workflow.actor`.
 */

/**
 * @param {object|null|undefined} rollConfig
 * @returns {object|null}
 */
export function advantageRollActor(rollConfig) {
    const workflowActor = rollConfig?.workflow?.actor;
    if (workflowActor) return workflowActor;

    const subject = rollConfig?.subject;
    if (!subject) return null;
    if (subject.documentName === 'Actor') return subject;
    if (subject.actor) return subject.actor;
    return null;
}

/**
 * @param {object|null|undefined} current
 * @param {object|null|undefined} rolling
 * @returns {boolean}
 */
export function sameActor(current, rolling) {
    if (!current || !rolling) return false;
    if (current === rolling) return true;
    if (current.uuid && rolling.uuid) return current.uuid === rolling.uuid;
    if (current.id && rolling.id) return current.id === rolling.id;
    return false;
}

/**
 * Set advantage or disadvantage on the roll config and clear the other side,
 * so a later keybinding check cannot cancel it back to a normal roll.
 * @param {object} rollConfig
 * @param {string|undefined} state - 'advBtn' | 'disBtn'
 * @returns {boolean} Whether a mode was applied
 */
export function applyHudAdvantage(rollConfig, state) {
    if (!rollConfig) return false;
    if (state === 'advBtn') {
        rollConfig.advantage = true;
        rollConfig.disadvantage = false;
        return true;
    }
    if (state === 'disBtn') {
        rollConfig.disadvantage = true;
        rollConfig.advantage = false;
        return true;
    }
    return false;
}
