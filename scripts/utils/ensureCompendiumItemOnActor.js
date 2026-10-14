/**
 * Shared compendium item provisioning helper.
 * CPR (and similar) items must persist permanently on the actor for
 * midi-qol / active effects to keep working, so this never deletes items
 * it creates - it only clones the compendium item onto the actor once.
 */

import { createLogger } from '/modules/bg3-hud-core/scripts/utils/logger.js';

const log = createLogger('bg3-hud-dnd5e');

/**
 * Ensure the actor has an embedded copy of a compendium item.
 * If the actor already has an embedded item with the same name as the
 * compendium item, that item is reused. Otherwise the compendium item is
 * cloned onto the actor (with a fresh id, flagged noBG3AutoAdd so core's
 * ItemUpdateManager doesn't auto-add it to the hotbar).
 * @param {Actor} actor - The actor to provision the item onto
 * @param {string} uuid - Compendium UUID of the source item
 * @returns {Promise<Item|null>} The embedded actor item, or null if the
 *   compendium UUID could not be resolved or the item could not be created
 */
export async function ensureCompendiumItemOnActor(actor, uuid) {
    if (!actor || !uuid) return null;

    const compendiumItem = await fromUuid(uuid);
    if (!compendiumItem) return null;

    const existing = actor.items.find(i => i.name === compendiumItem.name);
    if (existing) return existing;

    // Create the item on the actor - it stays permanently for midi-qol/active effects.
    // Use noBG3AutoAdd to prevent ItemUpdateManager from auto-adding it to the hotbar.
    const data = foundry.utils.deepClone(compendiumItem.toObject());
    delete data._id; // Let Foundry assign a new ID
    const created = await actor.createEmbeddedDocuments('Item', [data], { noBG3AutoAdd: true });
    const actorItem = created?.[0] ?? null;

    if (actorItem) {
        log.debug(`ensureCompendiumItemOnActor: Created item ${actorItem.name} on actor ${actor.name}`);
    }

    return actorItem;
}
