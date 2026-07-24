import { createLogger } from '/modules/bg3-hud-core/scripts/utils/logger.js';

// Import showSelectionDialog from core utilities
const { showSelectionDialog } = await import('/modules/bg3-hud-core/scripts/utils/dialogs.js');

const log = createLogger('bg3-hud-dnd5e');

const MODULE_ID = 'bg3-hud-dnd5e';

/**
 * Create D&D 5e Passives Container
 * Factory function to avoid import issues with core
 */
export async function createDnD5ePassivesContainer() {
    // Import core PassivesContainer dynamically
    const { PassivesContainer } = await import('/modules/bg3-hud-core/scripts/components/containers/PassivesContainer.js');

    /**
     * D&D 5e Passives Container
     * Displays passive features/traits for D&D 5e
     * Shows ALL features (feats) in alphabetical order for selection
     */
    class DnD5ePassivesContainer extends PassivesContainer {
        /**
         * Get all passive items (feat-type items WITHOUT activities)
         * @returns {Array<Item>} Array of passive feat items
         */
        getPassiveItems() {
            if (!this.actor) return [];

            // Return only feat items that have NO activities
            return this.actor.items.filter(item => {
                if (item.type !== 'feat') return false;

                const activities = item.system?.activities;

                // Check if activities exist and have content
                if (activities instanceof Map) {
                    return activities.size === 0;
                } else if (activities && typeof activities === 'object') {
                    if (Array.isArray(activities)) {
                        return activities.length === 0;
                    } else {
                        return Object.keys(activities).length === 0;
                    }
                }

                // Fallback: check legacy activation
                if (item.system?.activation?.type && item.system.activation.type !== 'none') {
                    return false; // Has activation, not passive
                }

                return true; // No activities or activation, treat as passive
            });
        }

        /**
         * Get the set of selected passive UUIDs
         * Stored in actor flags
         * @returns {Set<string>} Set of item UUIDs that should be displayed
         */
        getSelectedPassives() {
            const saved = this.actor.getFlag(MODULE_ID, 'selectedPassives');
            if (saved && Array.isArray(saved)) {
                return new Set(saved);
            }

            // Default: show nothing (user must configure)
            return new Set();
        }

        /**
         * Save selected passives to actor flags
         * @param {Array<string>} uuids - Array of selected UUIDs
         * @param {boolean} saveToBaseActor - If true, save to base actor with persistence flag
         * @private
         */
        async _saveSelectedPassives(uuids, saveToBaseActor = false) {
            // Save to the token's actor (full UUIDs work here since they're for this specific token)
            await this.actor.setFlag(MODULE_ID, 'selectedPassives', uuids);

            const baseActor = this._getBaseActor();
            if (!baseActor || baseActor === this.actor) {
                // Linked actor or no base actor - nothing more to do
                return;
            }

            if (saveToBaseActor) {
                // User wants to save for all tokens of this type
                // Extract just the item IDs from UUIDs - these are universal across tokens
                // UUID format: "Scene.xxx.Token.yyy.Actor.zzz.Item.ITEM_ID" or "Actor.zzz.Item.ITEM_ID"
                const itemIds = uuids.map(uuid => {
                    const parts = uuid.split('.');
                    // Item ID is always the last part
                    return parts[parts.length - 1];
                });

                // Save the item IDs (not UUIDs) and the persistence flag
                await baseActor.setFlag(MODULE_ID, 'passivesItemIds', itemIds);
                await baseActor.setFlag(MODULE_ID, 'passivesSaveToBase', true);
                log.debug('Saved item IDs to base actor:', itemIds);
            } else {
                // User turned off the toggle - clear the flags from base actor
                // This reverts to normal auto-populate behavior for new tokens
                const wasEnabled = baseActor.getFlag(MODULE_ID, 'passivesSaveToBase');
                if (wasEnabled) {
                    await baseActor.unsetFlag(MODULE_ID, 'passivesSaveToBase');
                    await baseActor.unsetFlag(MODULE_ID, 'passivesItemIds');
                    log.debug('Cleared passives from base actor, reverting to normal auto-populate');
                }
            }
        }

        /**
         * Get the base actor for an unlinked token (the sidebar actor)
         * @returns {Actor|null}
         * @private
         */
        _getBaseActor() {
            // For unlinked tokens, the base actor is in game.actors with the token's actorId
            if (!this.token) return null;

            const tokenDoc = this.token.document ?? this.token;
            const actorId = tokenDoc.actorId;

            if (actorId) {
                return game.actors.get(actorId);
            }

            return null;
        }

        /**
         * Check if the current token is unlinked (synthetic actor)
         * @returns {boolean}
         * @private
         */
        _isUnlinkedToken() {
            if (!this.token) return false;
            const tokenDoc = this.token.document ?? this.token;
            return tokenDoc.actorLink === false;
        }

        /**
         * Show configuration dialog to select which passives to display
         * @param {Event} event - The triggering event
         */
        async showConfigurationDialog(event) {
            const allFeatures = this.getPassiveItems();
            const selected = this.getSelectedPassives();

            // Build items array for dialog
            const items = allFeatures.map(feature => ({
                id: feature.uuid,
                label: feature.name,
                img: feature.img,
                selected: selected.has(feature.uuid)
            }));

            // Check if this is an unlinked token - if so, offer to save to base actor
            const isUnlinked = this._isUnlinkedToken();
            let footerToggles;

            if (isUnlinked) {
                // Check if the base actor already has the "save for all" mode enabled
                const baseActor = this._getBaseActor();
                const saveToBaseEnabled = baseActor?.getFlag(MODULE_ID, 'passivesSaveToBase') ?? false;

                footerToggles = [{
                    key: 'saveToBaseActor',
                    label: game.i18n.localize('bg3-hud-dnd5e.Passives.SaveForAllTokens'),
                    hint: game.i18n.localize('bg3-hud-dnd5e.Passives.SaveForAllTokensHint'),
                    checked: saveToBaseEnabled  // Pre-check if already enabled on base actor
                }];
            }

            // Show dialog using core utility
            const result = await showSelectionDialog({
                title: game.i18n.localize('bg3-hud-dnd5e.Passives.SelectPassiveFeatures'),
                items: items,
                footerToggles
            });

            // If user confirmed (not cancelled), save the selection
            if (result !== null) {
                // Handle both return formats (array for no toggles, object for toggles)
                const selectedIds = Array.isArray(result) ? result : result.selectedIds;
                const saveToBaseActor = result.toggles?.saveToBaseActor ?? false;

                await this._saveSelectedPassives(selectedIds, saveToBaseActor);
                // Don't call render() here - the actor flag update will trigger
                // a refresh via the updateActor hook, which will efficiently
                // update only the passives container
            }
        }
    }

    return DnD5ePassivesContainer;
}


