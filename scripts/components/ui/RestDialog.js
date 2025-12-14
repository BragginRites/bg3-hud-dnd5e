/**
 * Rest Dialog
 * Uses DialogV2.wait() to let the player choose between Short Rest and Long Rest
 */
const MODULE_ID = 'bg3-hud-dnd5e';

/**
 * Show rest type selection dialog and execute the chosen rest
 * @param {Actor} actor - The actor to rest
 * @returns {Promise<void>}
 */
export async function showRestDialog(actor) {
    if (!actor) return;

    const choice = await foundry.applications.api.DialogV2.wait({
        window: { title: game.i18n.localize('BG3HUD.Rest') },
        content: `<p style="text-align:center;margin-bottom:1rem">${game.i18n.localize('BG3HUD.ChooseRestType')}</p>`,
        buttons: [
            {
                action: 'short',
                label: game.i18n.localize(`${MODULE_ID}.RestDialog.ShortRest`),
                icon: 'fas fa-campfire',
                callback: () => 'short'
            },
            {
                action: 'long',
                label: game.i18n.localize(`${MODULE_ID}.RestDialog.LongRest`),
                icon: 'fas fa-tent',
                callback: () => 'long'
            }
        ],
        close: () => null
    });

    if (choice === 'short' && typeof actor.shortRest === 'function') {
        await actor.shortRest();
    } else if (choice === 'long' && typeof actor.longRest === 'function') {
        await actor.longRest();
    }
}
