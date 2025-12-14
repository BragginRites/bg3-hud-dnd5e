/**
 * D&D 5e CPR Actions Auto-Populate
 * Handles auto-population of CPR (Chris's Premades) actions to the quick access container
 */

const MODULE_ID = 'bg3-hud-dnd5e';

/**
 * D&D 5e CPR Auto-Populate Implementation
 * Provides CPR-specific action population logic for quick access container
 */
export class DnD5eCPRAutoPopulate {
    /**
     * Get CPR configuration based on D&D 5e rules version
     * @returns {{packName: string, packId: string, defaultActions: string[], isModern: boolean, settingsKey: string}}
     */
    getCPRConfig() {
        // Check D&D 5e rules version setting
        // "modern" = 2024 rules, "legacy" = 2014 rules
        const rulesVersion = game.settings.get('dnd5e', 'rulesVersion');
        const isModern = rulesVersion === 'modern';

        if (isModern) {
            return {
                packName: 'CPRActions2024',
                packId: 'chris-premades.CPRActions2024',
                // 2024 default actions: Dash, Disengage, Dodge, Help, Hide, Ready
                defaultActions: ['Dash', 'Disengage', 'Dodge', 'Help', 'Hide', 'Ready'],
                isModern: true,
                settingsKey: 'selectedCPRActionsModern'
            };
        } else {
            return {
                packName: 'CPRActions',
                packId: 'chris-premades.CPRActions',
                // 2014 default actions: Dash, Disengage, Dodge, Grapple, Help, Hide
                defaultActions: ['Dash', 'Disengage', 'Dodge', 'Grapple', 'Help', 'Hide'],
                isModern: false,
                settingsKey: 'selectedCPRActionsLegacy'
            };
        }
    }

    /**
     * Check if CPR module is active
     * @returns {boolean}
     */
    isCPRActive() {
        return game.modules.get('chris-premades')?.active ?? false;
    }

    /**
     * Initialize default CPR actions based on rules version
     * Only sets defaults if the versioned selectedCPRActions setting is empty
     * @returns {Promise<void>}
     */
    async initializeDefaultActions() {
        if (!this.isCPRActive()) {
            return;
        }

        const cprConfig = this.getCPRConfig();

        // Check if already set for this rules version
        const currentSelection = game.settings.get(MODULE_ID, cprConfig.settingsKey);
        if (currentSelection && currentSelection.length > 0) {
            return; // Already configured for this rules version
        }

        try {
            const pack = game.packs.get(cprConfig.packId);
            if (!pack) {
                console.warn(`[bg3-hud-dnd5e] CPR pack ${cprConfig.packId} not found`);
                return;
            }

            // Get pack index
            const index = await pack.getIndex();

            // Find UUIDs for default actions
            const defaultUuids = [];
            for (const actionName of cprConfig.defaultActions) {
                const entry = Array.from(index.entries()).find(([id, data]) =>
                    data.name === actionName
                );
                if (entry) {
                    const [id] = entry;
                    defaultUuids.push(`Compendium.${cprConfig.packId}.Item.${id}`);
                }
            }

            // Set defaults if we found any
            if (defaultUuids.length > 0) {
                await game.settings.set(MODULE_ID, cprConfig.settingsKey, defaultUuids);
                console.log(`[bg3-hud-dnd5e] Initialized default CPR actions (${cprConfig.isModern ? '2024' : '2014'}): ${defaultUuids.length} actions`);
            }
        } catch (error) {
            console.warn('[bg3-hud-dnd5e] Failed to initialize default CPR actions:', error);
        }
    }

    /**
     * Populate quick access grid with CPR actions
     * @param {Actor} actor - The actor
     * @param {Array<string>} actionUuids - Array of CPR action UUIDs (max 6)
     * @returns {Promise<void>}
     */
    async populateQuickAccess(actor, actionUuids) {
        if (!actor || !actionUuids || actionUuids.length === 0) {
            console.log('[bg3-hud-dnd5e] CPR AutoPopulate: Skipping - no actor or action UUIDs');
            return;
        }

        try {
            // Create temporary persistence manager for this actor
            const { PersistenceManager } = await import('/modules/bg3-hud-core/scripts/managers/PersistenceManager.js');
            const tempPersistence = new PersistenceManager();
            tempPersistence.setToken(actor);

            // Load current state
            let state = await tempPersistence.loadState();

            // Check if quickAccess already has items (don't overwrite user data or other auto-populations)
            const existingItems = state.quickAccess?.grids?.[0]?.items || {};
            const hasExistingItems = Object.keys(existingItems).length > 0;

            if (hasExistingItems) {
                console.log(`[bg3-hud-dnd5e] CPR AutoPopulate: Skipping - quickAccess already has ${Object.keys(existingItems).length} items`);
                return; // Don't overwrite existing items
            }

            console.log(`[bg3-hud-dnd5e] CPR AutoPopulate: Populating with ${actionUuids.length} CPR actions for actor ${actor.name}`);

            // Resolve UUIDs to get item names for alphabetical sorting
            const resolvedActions = [];
            for (const uuid of actionUuids) {
                const item = await fromUuid(uuid);
                if (item) {
                    resolvedActions.push({ uuid, name: item.name });
                }
            }

            // Sort alphabetically by name
            resolvedActions.sort((a, b) => a.name.localeCompare(b.name));
            const sortedUuids = resolvedActions.map(a => a.uuid);

            // Ensure quickAccess structure exists
            if (!state.quickAccess || !Array.isArray(state.quickAccess.grids)) {
                state.quickAccess = { grids: [{ rows: 2, cols: 3, items: {} }] };
            }

            const grid = state.quickAccess.grids[0];
            if (!grid.items) {
                grid.items = {};
            }

            // Populate grid cells with CPR action UUIDs (up to 6, filling left to right, top to bottom)
            // Slot keys use format "col-row" (e.g., "0-0", "1-0", "2-0", "0-1", "1-1", "2-1")
            const maxActions = Math.min(sortedUuids.length, 6);
            const populatedSlots = [];
            for (let i = 0; i < maxActions; i++) {
                const row = Math.floor(i / grid.cols);
                const col = i % grid.cols;
                const slotKey = `${col}-${row}`; // Format: col-row (not row-col!)

                // Store cell data with UUID reference (compendium UUID)
                grid.items[slotKey] = {
                    uuid: sortedUuids[i],
                    type: 'Item',
                };
                populatedSlots.push(slotKey);
            }

            // Save updated state
            await tempPersistence.saveState(state);

            console.log(`[bg3-hud-dnd5e] Populated quickAccess with ${maxActions} CPR actions in slots: ${populatedSlots.join(', ')}`);

            // Delay before refreshing HUD (50ms after quickAccess population)
            await new Promise(resolve => setTimeout(resolve, 50));

            // Refresh HUD if it's currently showing this actor
            if (ui.BG3HUD_APP?.currentActor?.id === actor.id) {
                await ui.BG3HUD_APP.refresh();
            }
        } catch (error) {
            console.error('[bg3-hud-dnd5e] Error populating quickAccess with CPR actions:', error);
        }
    }

    /**
     * Handle token creation - populate quick access with CPR actions if enabled
     * @param {Actor} actor - The actor for the newly created token
     * @returns {Promise<void>}
     */
    async onTokenCreation(actor) {
        if (!actor) return;

        // Check if CPR actions auto-populate is enabled
        const enableAutoPopulate = game.settings.get(MODULE_ID, 'enableCPRActionsAutoPopulate');
        if (!enableAutoPopulate) return;

        // Check if CPR module is active
        if (!this.isCPRActive()) return;

        // Wait for grids to finish populating
        // Grids populate with 50ms delays between them, so wait for all grids + passives + buffer
        // This ensures quickAccess populates after grid 0, grid 1, grid 2, and passives
        await new Promise(resolve => setTimeout(resolve, 200));

        try {
            // Get CPR config for current rules version
            const cprConfig = this.getCPRConfig();

            // Get selected CPR actions for this rules version (these are the ones the GM chose)
            const selectedActions = game.settings.get(MODULE_ID, cprConfig.settingsKey) || [];
            if (selectedActions.length === 0) {
                // If no actions selected, get actions based on rules version (fallback)
                const pack = game.packs.get(cprConfig.packId);
                if (!pack) {
                    console.warn(`[bg3-hud-dnd5e] ${cprConfig.packName} pack not found`);
                    return;
                }

                const index = await pack.getIndex();
                const actions = Array.from(index.entries())
                    .map(([id, entry]) => ({
                        id,
                        uuid: `Compendium.${cprConfig.packId}.Item.${id}`,
                        name: entry.name
                    }))
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .slice(0, 6);

                const actionUuids = actions.map(a => a.uuid);
                await this.populateQuickAccess(actor, actionUuids);
            } else {
                // Use selected actions (respects GM's choices)
                await this.populateQuickAccess(actor, selectedActions.slice(0, 6));
            }
        } catch (error) {
            console.error('[bg3-hud-dnd5e] Error populating CPR actions on token creation:', error);
        }
    }

    /**
     * Handle token change - populate quick access with CPR actions if empty
     * @param {Token} token - The token that was changed to
     * @returns {Promise<void>}
     */
    async onTokenChange(token) {
        if (!token?.actor) return;

        const actor = token.actor;

        // Check if CPR module is active
        if (!this.isCPRActive()) return;

        // Get CPR config for current rules version
        const cprConfig = this.getCPRConfig();

        // Get selected CPR actions for this rules version
        const selectedActions = game.settings.get(MODULE_ID, cprConfig.settingsKey) || [];
        if (selectedActions.length === 0) return;

        // Use populateQuickAccess which checks for existing items
        await this.populateQuickAccess(actor, selectedActions.slice(0, 6));
    }
}
