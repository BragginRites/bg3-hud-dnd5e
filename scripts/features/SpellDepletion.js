/**
 * D&D 5e Spell Slot Depletion
 * Pure data-in/data-out helpers for spell "depleted" state and spell
 * hotbar-membership resolution. No Foundry globals (game/ui/canvas) are read
 * here - callers must read whatever Foundry state they need and pass plain
 * data in, keeping this module trivially testable.
 */

/**
 * Compute the "depleted" state for a spell cell.
 *
 * Mirrors the previous inline logic in DnD5eAdapter#transformItemToCellData:
 * - Cantrips (level 0) never deplete.
 * - Spells that don't draw from the actor's spell slots (innate/at-will/pact/
 *   apothecary casting methods, or spells with their own limited-use pool)
 *   are depleted only when their own `uses` are exhausted.
 * - Regular learned spells (method === 'spell') are depleted when the actor
 *   has no spell slot (regular, pact, or apothecary) at or above the spell's
 *   level.
 *
 * When there isn't enough data to determine slot-based depletion (no
 * `spellSlots` supplied), returns `undefined` so the caller can leave
 * `cellData.depleted` unset, exactly as the original code did.
 *
 * @param {Object} params
 * @param {number} params.level - Spell level (0 = cantrip)
 * @param {string} params.method - Casting method; callers should resolve this as
 *   `item.system?.method ?? item.system?.preparation?.mode ?? 'spell'` (dnd5e 5.1+
 *   uses `.method`, older schemas used `.preparation.mode`)
 * @param {boolean} params.hasOwnUses - Whether the spell has its own limited-use pool
 * @param {{value: number}|null} [params.uses] - The cell's own uses (value/max), if any
 * @param {Object|null} [params.spellSlots] - actor.system.spells, or null/undefined if unavailable
 * @returns {boolean|undefined} True if depleted, false if not, undefined if indeterminate
 */
export function computeSpellDepletion({ level, method, hasOwnUses, uses = null, spellSlots = null }) {
    // Spells with their own limited uses (ancestry innate grants, etc.) should
    // never be grayed out just because the actor has no spell slots.
    const usesSlots = method === 'spell' && !hasOwnUses;

    if (level === 0) {
        // Cantrips never deplete
        return false;
    }

    if (!usesSlots) {
        // Innate / at-will / pact / own-uses spells - ignore spell slots
        if (uses) {
            return uses.value <= 0;
        }
        return false;
    }

    // Regular learned spells (method === 'spell') - check spell slots
    if (!spellSlots) {
        return undefined;
    }

    let canCast = false;

    // Check if any slot at this level or higher has remaining uses
    for (let l = level; l <= 9; l++) {
        const slot = spellSlots[`spell${l}`];
        if (slot?.value > 0) {
            canCast = true;
            break;
        }
    }

    // Also check pact slots - they can cast spells up to their level
    if (!canCast && spellSlots.pact?.value > 0 && spellSlots.pact?.level >= level) {
        canCast = true;
    }

    // Also check apothecary slots (SCGD compatibility)
    if (!canCast && spellSlots.apothecary?.value > 0 && (spellSlots.apothecary?.level ?? 1) >= level) {
        canCast = true;
    }

    return !canCast;
}

/**
 * D&D 5e spell preparation / casting-mode membership for the hotbar.
 * Called by core ItemUpdateManager on item updates (no system logic in core).
 *
 * Modern dnd5e: `system.method` is `"spell"` for prepared casters (not `"prepared"`),
 * and `system.prepared` is numeric (0 unprepared, 1 prepared, 2 always).
 *
 * Pure function of item/actor data - takes the item document (read-only) and
 * returns a plain membership directive.
 *
 * @param {Item} item
 * @param {Actor} [_actor]
 * @returns {'add'|'remove'|null}
 */
export function resolveHotbarMembershipOnItemUpdate(item, _actor) {
    if (!item || item.type !== 'spell') return null;

    const method = item.system?.method ?? item.system?.preparation?.mode ?? '';
    // Numeric in dnd5e v4+; boolean possible on legacy preparation.prepared
    const preparedRaw = item.system?.prepared ?? item.system?.preparation?.prepared;
    const preparedValue = Number(preparedRaw) || 0;
    const isPrepared = preparedValue > 0;

    // Always-prepared (prepared === 2) or casting methods that ignore the checkbox
    const alwaysEligible = preparedValue >= 2
        || ['pact', 'apothecary', 'atwill', 'innate', 'ritual', 'always'].includes(method);
    if (alwaysEligible) return 'add';

    // Prepared casters: modern method is "spell"; legacy prep mode was "prepared"
    const isPreparedMethod = method === 'spell' || method === 'prepared';
    if (isPreparedMethod) {
        return isPrepared ? 'add' : 'remove';
    }

    return null;
}
