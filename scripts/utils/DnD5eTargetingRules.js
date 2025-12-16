/**
 * D&D 5e Targeting Rules
 * System-specific targeting logic for D&D 5e items and activities.
 * All functions are pure and return plain data objects - no DOM manipulation.
 */

/**
 * Check if an item/activity requires targeting.
 * @param {Object} params
 * @param {Item} params.item - The Foundry item document
 * @param {Object} [params.activity] - Optional activity for multi-activity items
 * @returns {boolean} True if targeting is required
 */
export function needsTargeting({ item, activity = null }) {
    if (!item) return false;

    // Check if targeting is explicitly disabled at item level
    if (item.system?.target?.type === 'self' || item.system?.target?.type === 'none') {
        return false;
    }

    // Check for AOE template spells that target points - these should use Foundry's template system
    if (_isAOETemplateSpell(item)) {
        return false;
    }

    // Check item-level target configuration
    if (item.system?.target?.type && item.system.target.type !== 'self') {
        return true;
    }

    // Check activities for targeting requirements (Foundry v12+)
    if (item.system?.activities) {
        const activities = Array.from(item.system.activities.values());

        // Check if ANY activity needs targeting
        for (const act of activities) {
            // Skip activities with templates (AoE)
            if (act.target?.template?.type) {
                continue;
            }

            // Check for range that needs targeting
            if (act.range?.value && parseInt(act.range.value) > 0 && act.range.units !== 'self') {
                return true;
            }

            // Check for target information
            if (act.target) {
                const targetType = act.target.type || act.target.affects?.type;
                // Skip self and none targeting
                if (targetType === 'self' || targetType === 'none') {
                    continue;
                }
                // If there's target information (type or count), activate targeting
                if (targetType || act.target.affects?.count !== undefined) {
                    return true;
                }
            }
        }
        return false;
    }

    // Check for attack rolls (weapons, attack spells)
    const actionType = item.system?.actionType;
    if (actionType === 'attack' || actionType === 'mwak' || actionType === 'rwak' ||
        actionType === 'msak' || actionType === 'rsak') {
        return true;
    }

    // Check for saving throws (most spells that affect others)
    if (actionType === 'save' && item.system?.target?.type !== 'self') {
        return true;
    }

    // Check for specific spell properties
    if (item.type === 'spell') {
        const target = item.system?.target;
        if (target?.type && !['self', 'none'].includes(target.type)) {
            return true;
        }

        // Check spell range - if it has a range other than self, it likely needs targeting
        const range = item.system?.range;
        if (range?.value && range.value > 0 && range.units !== 'self') {
            return true;
        }
    }

    return false;
}

/**
 * Check if an item is an AOE template spell that targets a point
 * @param {Item} item
 * @returns {boolean}
 * @private  
 */
function _isAOETemplateSpell(item) {
    // Check primary target configuration for AOE template
    if (item.system?.target?.template) {
        const templateType = item.system.target.template.type;
        if (['cone', 'cube', 'cylinder', 'line', 'radius', 'sphere'].includes(templateType)) {
            return true;
        }
    }

    // Check activities for AOE template (Foundry v12+)
    if (item.system?.activities) {
        for (const activity of item.system.activities.values()) {
            if (activity.target?.template) {
                const templateType = activity.target.template.type;
                if (['cone', 'cube', 'cylinder', 'line', 'radius', 'sphere'].includes(templateType)) {
                    return true;
                }
            }
        }
    }

    return false;
}

/**
 * Extract targeting requirements from an item/activity.
 * @param {Object} params
 * @param {Item} params.item - The Foundry item document
 * @param {Object} [params.activity] - Optional activity
 * @returns {Object} Target requirements
 */
export function getTargetRequirements({ item, activity = null }) {
    const requirements = {
        minTargets: 1,
        maxTargets: 1,
        range: null,
        longRange: null,
        targetType: 'any',
        hasTemplate: false,
        template: null
    };

    if (!item) return requirements;

    // Get target configuration from activity or item
    const targetConfig = activity?.target || item.system?.target;

    if (targetConfig) {
        // Target type
        requirements.targetType = targetConfig.affects?.type || targetConfig.type || 'any';

        // Target count
        const count = targetConfig.affects?.count || targetConfig.value || 1;
        requirements.minTargets = Math.max(1, count);
        requirements.maxTargets = count || 1;

        // Handle unlimited/special targets
        if (targetConfig.affects?.type === 'any' || targetConfig.affects?.special) {
            requirements.maxTargets = Infinity;
        }

        // Template
        if (targetConfig.template?.type) {
            requirements.hasTemplate = true;
            requirements.template = { ...targetConfig.template };
        }
    }

    // Calculate range
    const rangeInfo = calculateRange({ item, activity, actor: item.actor });
    requirements.range = rangeInfo.range;
    requirements.longRange = rangeInfo.longRange;

    return requirements;
}

/**
 * Check if a token is a valid target given requirements.
 * @param {Object} params
 * @param {Token} params.sourceToken - The attacking/casting token
 * @param {Token} params.targetToken - The potential target token
 * @param {Object} params.requirements - Target requirements
 * @returns {Object} { valid: boolean, reason: string|null }
 */
export function isValidTargetType({ sourceToken, targetToken, requirements }) {
    if (!targetToken) {
        return { valid: false, reason: game.i18n.localize('bg3-hud-core.TargetSelector.InvalidTarget') };
    }

    if (!targetToken.actor) {
        return { valid: false, reason: game.i18n.localize('BG3.TargetSelector.NoActor') };
    }

    // Check visibility
    if (!targetToken.isVisible || targetToken.document.hidden) {
        return { valid: false, reason: game.i18n.localize('BG3.TargetSelector.TokenNotVisible') };
    }

    // Check target type
    const targetType = requirements.targetType;

    if (targetType === 'self') {
        if (targetToken !== sourceToken) {
            return { valid: false, reason: game.i18n.localize('BG3.TargetSelector.SelfOnly') };
        }
    } else if (targetType === 'other' || targetType === 'enemy') {
        // Can't target self
        if (targetToken === sourceToken) {
            return { valid: false, reason: game.i18n.localize('BG3.TargetSelector.CannotTargetSelf') };
        }

        // Check disposition for enemy
        if (targetType === 'enemy') {
            const isEnemy = _isEnemy(sourceToken, targetToken);
            if (!isEnemy) {
                return { valid: false, reason: game.i18n.localize('BG3.TargetSelector.MustBeEnemy') };
            }
        }
    } else if (targetType === 'ally' || targetType === 'willing') {
        // Must be friendly
        const isFriendly = _isFriendly(sourceToken, targetToken);
        if (!isFriendly) {
            return { valid: false, reason: game.i18n.localize('BG3.TargetSelector.MustBeAlly') };
        }
    } else if (targetType === 'creature') {
        // Must have a creature type (not object/etc)
        const creatureType = targetToken.actor?.system?.details?.type?.value;
        if (!creatureType || creatureType === 'object') {
            return { valid: false, reason: game.i18n.localize('BG3.TargetSelector.MustBeCreature') };
        }
    }

    return { valid: true, reason: null };
}

/**
 * Get enhanced target info for display.
 * @param {Object} params
 * @param {Token} params.sourceToken - The source token
 * @param {Token} params.targetToken - The target token
 * @param {Item} params.item - The item being used
 * @param {Object} [params.activity] - Optional activity
 * @returns {Object} Target info for display
 */
export function getTargetInfo({ sourceToken, targetToken, item, activity = null }) {
    const info = {
        name: targetToken?.name || 'Unknown',
        img: targetToken?.document?.texture?.src || 'icons/svg/mystery-man.svg',
        inRange: true,
        inLongRange: true,
        coverStatus: 'none',
        isFlanked: false,
        distance: null,
        disposition: _getDispositionLabel(targetToken),
        statusEffects: []
    };

    if (!sourceToken || !targetToken || !canvas?.grid) {
        return info;
    }

    // Calculate distance (simplified - uses center-to-center)
    const dx = targetToken.center.x - sourceToken.center.x;
    const dy = targetToken.center.y - sourceToken.center.y;
    const distPixels = Math.sqrt(dx * dx + dy * dy);
    const gridDistance = canvas.grid.distance || 5;
    const gridSize = canvas.grid.size;
    info.distance = (distPixels / gridSize) * gridDistance;

    // Check range
    const rangeInfo = calculateRange({ item, activity, actor: item?.actor });
    if (rangeInfo.range && info.distance > rangeInfo.range) {
        info.inRange = false;
    }
    if (rangeInfo.longRange && info.distance > rangeInfo.longRange) {
        info.inLongRange = false;
    }

    // Get relevant status effects from target
    const effects = targetToken.actor?.statuses || new Set();
    for (const status of effects) {
        if (['prone', 'paralyzed', 'stunned', 'unconscious', 'restrained', 'incapacitated'].includes(status)) {
            info.statusEffects.push(status);
        }
    }

    return info;
}

/**
 * Calculate effective range for an item/activity.
 * @param {Object} params
 * @param {Item} params.item - The item
 * @param {Object} [params.activity] - Optional activity
 * @param {Actor} [params.actor] - The actor using the item
 * @returns {Object} Range info
 */
export function calculateRange({ item, activity = null, actor = null }) {
    const rangeInfo = {
        range: null,
        longRange: null,
        units: 'ft',
        isTouch: false,
        isSelf: false,
        isUnlimited: false
    };

    if (!item) return rangeInfo;

    // Get range configuration from activity or item
    const rangeConfig = activity?.range || item.system?.range;

    if (!rangeConfig) return rangeInfo;

    // Handle special range units
    const units = rangeConfig.units || 'ft';
    rangeInfo.units = units;

    if (units === 'self') {
        rangeInfo.isSelf = true;
        rangeInfo.range = 0;
        return rangeInfo;
    }

    if (units === 'touch') {
        rangeInfo.isTouch = true;
        // Touch range is 1 grid unit (typically 5ft)
        rangeInfo.range = canvas?.scene?.grid?.distance || 5;

        // Check for reach bonus
        const reach = rangeConfig.reach || item.system?.range?.reach;
        if (reach) {
            rangeInfo.range = reach;
        }
        return rangeInfo;
    }

    if (units === 'unlimited' || units === 'special' || units === 'any') {
        rangeInfo.isUnlimited = true;
        return rangeInfo;
    }

    // Get numeric range values
    let range = rangeConfig.value || rangeConfig.normal || 0;
    let longRange = rangeConfig.long || 0;

    // Convert units if needed
    if (units === 'mi') {
        range *= 5280;
        longRange *= 5280;
        rangeInfo.units = 'ft';
    } else if (units === 'km') {
        range *= 1000;
        rangeInfo.units = 'm';
    }

    // Apply actor bonuses (e.g., Sharpshooter, Spell Sniper)
    if (actor) {
        const actionType = activity?.actionType || item.system?.actionType;

        // Sharpshooter - ranged weapon attacks ignore long range
        if (actionType === 'rwak' && actor.flags?.dnd5e?.sharpShooter) {
            if (longRange > range) range = longRange;
        }

        // Spell Sniper - doubles range of ranged spell attacks
        if (actionType === 'rsak' && actor.flags?.dnd5e?.spellSniper) {
            range *= 2;
            if (longRange) longRange *= 2;
        }
    }

    rangeInfo.range = range > 0 ? range : null;
    rangeInfo.longRange = longRange > 0 ? longRange : null;

    return rangeInfo;
}

// ========== Private Helper Functions ==========

/**
 * Check if target is an enemy of source.
 * @param {Token} sourceToken
 * @param {Token} targetToken
 * @returns {boolean}
 * @private
 */
function _isEnemy(sourceToken, targetToken) {
    if (!sourceToken || !targetToken) return false;

    // Check disposition
    const sourceDisp = sourceToken.document.disposition;
    const targetDisp = targetToken.document.disposition;

    // HOSTILE = -1, NEUTRAL = 0, FRIENDLY = 1
    const HOSTILE = CONST.TOKEN_DISPOSITIONS?.HOSTILE ?? -1;
    const FRIENDLY = CONST.TOKEN_DISPOSITIONS?.FRIENDLY ?? 1;

    // If source is friendly, enemies are hostile
    if (sourceDisp === FRIENDLY) {
        return targetDisp === HOSTILE;
    }

    // If source is hostile, enemies are friendly
    if (sourceDisp === HOSTILE) {
        return targetDisp === FRIENDLY;
    }

    // Neutral doesn't really have enemies, but hostiles are close enough
    return targetDisp === HOSTILE;
}

/**
 * Check if target is friendly to source.
 * @param {Token} sourceToken
 * @param {Token} targetToken
 * @returns {boolean}
 * @private
 */
function _isFriendly(sourceToken, targetToken) {
    if (!sourceToken || !targetToken) return false;

    // Same token is always friendly
    if (sourceToken === targetToken) return true;

    const sourceDisp = sourceToken.document.disposition;
    const targetDisp = targetToken.document.disposition;

    // Same disposition = friendly
    return sourceDisp === targetDisp;
}

/**
 * Get disposition label for a token.
 * @param {Token} token
 * @returns {string}
 * @private
 */
function _getDispositionLabel(token) {
    if (!token) return 'unknown';

    const disposition = token.document.disposition;
    const HOSTILE = CONST.TOKEN_DISPOSITIONS?.HOSTILE ?? -1;
    const NEUTRAL = CONST.TOKEN_DISPOSITIONS?.NEUTRAL ?? 0;
    const FRIENDLY = CONST.TOKEN_DISPOSITIONS?.FRIENDLY ?? 1;

    if (disposition === HOSTILE) return 'hostile';
    if (disposition === NEUTRAL) return 'neutral';
    if (disposition === FRIENDLY) return 'friendly';
    return 'unknown';
}

/**
 * DnD5eTargetingRules object containing all exported targeting functions.
 * Register this with the adapter for core to use.
 */
export const DnD5eTargetingRules = {
    needsTargeting,
    getTargetRequirements,
    isValidTargetType,
    getTargetInfo,
    calculateRange
};
