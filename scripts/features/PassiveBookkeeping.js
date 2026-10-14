/**
 * D&D 5e Passive Auto-Populate Bookkeeping
 * Selects passive features (feats with no activities) on token creation and
 * records them to actor flags, respecting any existing user selection and the
 * unlinked-token "save for all tokens" base-actor configuration.
 */

import { createLogger } from '/modules/bg3-hud-core/scripts/utils/logger.js';
import { getActivitiesArray } from './ItemClassification.js';

const log = createLogger('bg3-hud-dnd5e');

const MODULE_ID = 'bg3-hud-dnd5e';

/**
 * Auto-populate passives on token creation.
 * Selects all features that have no activities.
 * Only runs if passives haven't been configured yet (to avoid overwriting user selections).
 * @param {Actor} actor - The actor for the newly created token
 * @param {TokenDocument} [tokenDocument] - The token document (optional)
 */
export async function autoPopulatePassives(actor, tokenDocument = null) {
    if (!actor) return;

    // Check if auto-populate passives is enabled
    if (!game.settings.get(MODULE_ID, 'autoPopulatePassivesEnabled')) {
        return;
    }

    // GUARD: Check if passives are already configured for this actor (token's synthetic actor)
    // This prevents overwriting user selections when tokens already have passives set
    const existingPassives = actor.getFlag(MODULE_ID, 'selectedPassives');
    if (existingPassives && Array.isArray(existingPassives) && existingPassives.length > 0) {
        log.debug('Passives already configured on token actor, skipping auto-populate');
        return;
    }

    // For unlinked tokens, check the BASE actor (from sidebar) for saved configuration
    // If "Save for all tokens" was checked, the base actor will have:
    // - 'passivesItemIds' flag with just the item IDs (not full UUIDs)
    // - 'passivesSaveToBase' flag set to true
    if (tokenDocument && tokenDocument.actorLink === false) {
        const baseActorId = tokenDocument.actorId;
        const baseActor = baseActorId ? game.actors.get(baseActorId) : null;

        log.debug('Checking base actor for unlinked token:', {
            baseActorId,
            baseActorFound: !!baseActor,
            baseActorName: baseActor?.name
        });

        if (baseActor) {
            // Check if "Save for all tokens" mode is active on base actor
            const saveToBaseEnabled = baseActor.getFlag(MODULE_ID, 'passivesSaveToBase');
            const baseItemIds = baseActor.getFlag(MODULE_ID, 'passivesItemIds');

            log.debug('Base actor flags:', {
                saveToBaseEnabled,
                baseItemIds: baseItemIds?.length ?? 0
            });

            if (saveToBaseEnabled && baseItemIds && Array.isArray(baseItemIds) && baseItemIds.length > 0) {
                // Translate item IDs to this token's UUIDs
                // The token's items will have the same item IDs but different UUID prefixes
                const tokenUuids = [];
                for (const itemId of baseItemIds) {
                    const item = actor.items.get(itemId);
                    if (item) {
                        tokenUuids.push(item.uuid);
                    } else {
                        log.warn(`Item ID ${itemId} not found on token actor`);
                    }
                }

                if (tokenUuids.length > 0) {
                    log.debug('Copying passives from base actor to unlinked token:', tokenUuids);
                    await actor.setFlag(MODULE_ID, 'selectedPassives', tokenUuids);
                    return;
                }
            }
        }
    }

    // Get all feat items
    const feats = actor.items.filter(item => item.type === 'feat');

    // Filter to only features without activities
    const passiveFeats = feats.filter(feat => {
        // Check if activities exist and have content
        if (feat.system?.activities) {
            return getActivitiesArray(feat).length === 0;
        }

        // Fallback: check legacy activation
        if (feat.system?.activation?.type && feat.system.activation.type !== 'none') {
            return false; // Has activation, not passive
        }

        return true; // No activities or activation, treat as passive
    });

    // Save the passive UUIDs to actor flags
    const passiveUuids = passiveFeats.map(feat => feat.uuid);
    await actor.setFlag(MODULE_ID, 'selectedPassives', passiveUuids);
}
