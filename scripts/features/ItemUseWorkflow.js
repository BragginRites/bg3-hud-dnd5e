/**
 * D&D 5e Item/Activity Use Workflow
 * Handles cell-click "use" behaviour for Items and Activities, including the
 * midi-qol compendium-cloning workaround (compendium items must be cloned to a
 * real embedded document before midi-qol can find them) and the HUD target
 * selector integration gated by DnD5eTargetingRules.
 */

import { createLogger } from '/modules/bg3-hud-core/scripts/utils/logger.js';

const log = createLogger('bg3-hud-dnd5e');

const MODULE_ID = 'bg3-hud-dnd5e';

/**
 * Use a D&D 5e item.
 * @param {Object} targetingRules - DnD5eTargetingRules (or adapter's reference to it)
 * @param {string} uuid - Item UUID
 * @param {MouseEvent} event - The triggering event
 */
export async function useItem(targetingRules, uuid, event) {
    const resolved = await fromUuid(uuid);
    if (!resolved) {
        ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.Notifications.ItemNotFound`));
        return;
    }

    // Hydration can leave Activity UUIDs tagged as type 'Item'; route correctly.
    if (resolved.constructor?.metadata?.name === 'Activity') {
        await useActivity(targetingRules, uuid, event);
        return;
    }

    // If this is an embedded item (already on the actor), use it directly.
    // If it's from a compendium, we need to create a real embedded item so midi-qol can find it.
    const isEmbedded = !!resolved.parent;
    const actor =
        resolved.actor ??
        (resolved.parent?.documentName === 'Actor' ? resolved.parent : null) ??
        ui.BG3HUD_APP?.currentActor ??
        canvas?.tokens?.controlled?.[0]?.actor ??
        null;

    if (!actor) {
        ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.Notifications.ItemCannotBeUsed`));
        return;
    }

    let itemToUse = resolved;
    let createdItemId = null;

    // For compendium items, we must create a real embedded document (not temporary)
    // so that midi-qol can find it in the actor's items collection during its workflow.
    if (!isEmbedded) {
        // Clone the item data and ensure it's properly migrated
        const data = foundry.utils.deepClone(resolved.toObject());

        // Ensure modern V13+ stats shape exists to avoid deprecated flags.exportSource access
        if (!data._stats) {
            data._stats = {};
        }
        if (data.flags?.exportSource && !data._stats.exportSource) {
            data._stats.exportSource = data.flags.exportSource;
            delete data.flags.exportSource;
        }

        // Let Foundry assign the id
        delete data._id;

        // Create a real embedded document - midi-qol requires the item to be in the collection
        // We'll delete it after use to avoid cluttering the actor's inventory
        const created = await actor.createEmbeddedDocuments('Item', [data]);
        itemToUse = created?.[0] ?? null;
        createdItemId = itemToUse?.id;
    }

    if (!itemToUse) {
        ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.Notifications.ItemNotFound`));
        return;
    }

    log.debug('Using item:', itemToUse.name, isEmbedded ? '(embedded)' : '(from compendium)');

    // Check if item needs targeting and target selector is enabled
    const targetSelectorEnabled = game.settings.get('bg3-hud-core', 'enableTargetSelector');
    const needsTargeting = targetSelectorEnabled && targetingRules?.needsTargeting({ item: itemToUse });
    let areaPlaced = false;

    if (needsTargeting) {
        // Get the source token
        const sourceToken = actor.token?.object ??
            canvas?.tokens?.placeables?.find(t => t.actor?.id === actor.id) ??
            null;

        if (sourceToken) {
            try {
                // Start target selection
                const targets = await ui.BG3HOTBAR?.api?.startTargetSelection({
                    token: sourceToken,
                    item: itemToUse
                });

                if (!targets?.placed && (!targets || targets.length === 0)) {
                    log.debug('Target selection cancelled');
                    // Clean up temp item if we created one
                    if (createdItemId && actor.items.has(createdItemId)) {
                        await actor.deleteEmbeddedDocuments('Item', [createdItemId]);
                    }
                    return;
                }

                log.debug('Targets selected:', targets.map(t => t.name).join(', '));
                areaPlaced = targets.placed === true;
            } catch (error) {
                log.error('Target selection error:', error);
                // Clean up temp item if we created one
                if (createdItemId && actor.items.has(createdItemId)) {
                    await actor.deleteEmbeddedDocuments('Item', [createdItemId]);
                }
                return;
            }
        }
    }

    // Use the item (D&D 5e v4+ uses .use() method)
    if (typeof itemToUse.use === 'function') {
        try {
            const config = { event };
            if (areaPlaced) {
                config.create = { measuredTemplate: false };
            }
            await itemToUse.use(config);
        } finally {
            // Clean up: delete the temporarily created item from the actor's inventory
            // This runs even if item.use() throws, ensuring we don't leave orphan items
            if (createdItemId && actor.items.has(createdItemId)) {
                await actor.deleteEmbeddedDocuments('Item', [createdItemId]);
            }
        }
    } else {
        // Clean up if we created an item but can't use it
        if (createdItemId && actor.items.has(createdItemId)) {
            await actor.deleteEmbeddedDocuments('Item', [createdItemId]);
        }
        ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.Notifications.ItemCannotBeUsed`));
    }
}

/**
 * Use a D&D 5e activity.
 * @param {Object} targetingRules - DnD5eTargetingRules (or adapter's reference to it)
 * @param {string} uuid - Activity UUID
 * @param {MouseEvent} event - The triggering event
 */
export async function useActivity(targetingRules, uuid, event) {
    const activity = await fromUuid(uuid);
    if (!activity) {
        ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.Notifications.ActivityNotFound`));
        return;
    }

    log.debug('Using activity:', activity.name);

    const item = activity.item;
    const actor = item?.actor;
    const targetSelectorEnabled = game.settings.get('bg3-hud-core', 'enableTargetSelector');
    const needsTargeting = targetSelectorEnabled
        && targetingRules?.needsTargeting({ item, activity });

    let areaPlaced = false;

    if (needsTargeting && actor) {
        const sourceToken = actor.token?.object
            ?? canvas?.tokens?.placeables?.find(t => t.actor?.id === actor.id)
            ?? null;
        if (sourceToken) {
            try {
                const targets = await ui.BG3HOTBAR?.api?.startTargetSelection({
                    token: sourceToken,
                    item,
                    activity
                });
                if (!targets?.placed && (!targets || targets.length === 0)) {
                    log.debug('Activity target selection cancelled');
                    return;
                }
                areaPlaced = targets.placed === true;
            } catch (error) {
                log.error('Activity target selection error:', error);
                return;
            }
        }
    }

    // Activities have their own use() method
    if (typeof activity.use === 'function') {
        const config = { event };
        if (areaPlaced) {
            config.create = { measuredTemplate: false };
        }
        await activity.use(config);
    } else {
        ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.Notifications.ActivityCannotBeUsed`));
    }
}
