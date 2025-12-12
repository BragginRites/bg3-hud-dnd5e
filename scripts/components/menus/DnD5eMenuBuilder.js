import { MenuBuilder } from '/modules/bg3-hud-core/scripts/components/ui/MenuBuilder.js';

const MODULE_ID = 'bg3-hud-dnd5e';

/**
 * D&D 5e Menu Builder
 * Provides D&D 5e specific menu items for portrait, abilities, settings, and lock menus
 */
export class DnD5eMenuBuilder extends MenuBuilder {
    /**
     * Build portrait menu items for D&D 5e
     * @param {PortraitContainer} portraitContainer - The portrait container instance
     * @param {MouseEvent} event - The triggering event
     * @returns {Promise<Array>} Menu items array
     */
    async buildPortraitMenu(portraitContainer, event) {
        const actor = portraitContainer.actor;
        const token = portraitContainer.token;
        if (!actor) return [];

        // Get current preferences from actor flags
        const useTokenImage = actor.getFlag(MODULE_ID, 'useTokenImage') ?? true;
        const scaleWithToken = actor.getFlag(MODULE_ID, 'scaleWithToken') ?? false;
        
        // Check if token has non-default scale
        const tokenScaleX = token?.document?._source?.texture?.scaleX ?? 1;
        const hasTokenScale = tokenScaleX !== 1;

        const items = [];

        // Token image option (with checkmark if selected)
        items.push({
            key: 'token',
            label: game.i18n.localize(`${MODULE_ID}.Menu.UseTokenImage`),
            icon: useTokenImage ? 'fas fa-check' : 'fas fa-chess-pawn',
            onClick: async () => {
                if (!useTokenImage) {
                    await actor.setFlag(MODULE_ID, 'useTokenImage', true);
                }
            }
        });

        // Scale with token option (only show if using token image and token has scale)
        if (useTokenImage && hasTokenScale) {
            items.push({
                key: 'scaleWithToken',
                label: game.i18n.localize(`${MODULE_ID}.Menu.ScaleWithToken`),
                icon: scaleWithToken ? 'fas fa-check' : 'fas fa-up-right-and-down-left-from-center',
                title: game.i18n.localize(`${MODULE_ID}.Menu.ScaleWithTokenHint`),
                onClick: async () => {
                    const newValue = !scaleWithToken;
                    await actor.setFlag(MODULE_ID, 'scaleWithToken', newValue);
                }
            });
        }

        // Character portrait option (with checkmark if selected)
        items.push({
            key: 'portrait',
            label: game.i18n.localize(`${MODULE_ID}.Menu.UseCharacterPortrait`),
            icon: !useTokenImage ? 'fas fa-check' : 'fas fa-user',
            onClick: async () => {
                if (useTokenImage) {
                    await actor.setFlag(MODULE_ID, 'useTokenImage', false);
                }
            }
        });

        return items;
    }

    /**
     * Build settings menu items for D&D 5e
     * Can add D&D 5e specific settings options
     * @param {ControlContainer} controlContainer - The control container instance
     * @param {MouseEvent} event - The triggering event
     * @returns {Promise<Array>} Menu items array
     */
    async buildSettingsMenu(controlContainer, event) {
        // Return empty array to use core settings menu
        // D&D 5e can add custom items here if needed
        return [];
    }

    /**
     * Build lock menu items for D&D 5e
     * Can add D&D 5e specific lock options
     * @param {ControlContainer} controlContainer - The control container instance
     * @param {MouseEvent} event - The triggering event
     * @returns {Promise<Array>} Menu items array
     */
    async buildLockMenu(controlContainer, event) {
        // Return empty array to use core lock menu
        // D&D 5e can add custom items here if needed
        return [];
    }
}

