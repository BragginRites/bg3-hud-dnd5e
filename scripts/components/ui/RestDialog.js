/**
 * Rest Dialog
 * Uses Core's showButtonChoiceDialog for consistent styling
 */
import { showButtonChoiceDialog } from '../../../../bg3-hud-core/scripts/utils/dialogs.js';

const MODULE_ID = 'bg3-hud-dnd5e';

/**
 * Show rest type selection dialog and execute the chosen rest
 * @param {Actor} actor - The actor to rest
 * @returns {Promise<void>}
 */
export async function showRestDialog(actor) {
    if (!actor) return;

    const choice = await showButtonChoiceDialog({
        title: game.i18n.localize('BG3HUD.Rest'),
        content: `<p style="text-align:center;margin-bottom:1rem">${game.i18n.localize('BG3HUD.ChooseRestType')}</p>`,
        buttons: [
            {
                action: 'short',
                label: game.i18n.localize(`${MODULE_ID}.RestDialog.ShortRest`),
                icon: 'fas fa-campfire'
            },
            {
                action: 'long',
                label: game.i18n.localize(`${MODULE_ID}.RestDialog.LongRest`),
                icon: 'fas fa-tent'
            }
        ]
    });

    if (choice === 'short' && typeof actor.shortRest === 'function') {
        await actor.shortRest();
    } else if (choice === 'long' && typeof actor.longRest === 'function') {
        await actor.longRest();
    }
}
