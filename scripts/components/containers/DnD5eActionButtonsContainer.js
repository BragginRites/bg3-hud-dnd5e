/**
 * D&D 5e rest fill for the named Rest HUD part.
 * @param {{ actor?: Actor, token?: Token }} ctx
 * @returns {Array<Object>}
 */
export function getDnd5eRests({ actor } = {}) {
    if (!actor) return [];

    const restVisible = () => !game.combat?.started;

    return [
        {
            key: 'short-rest',
            classes: ['rest-button'],
            icon: 'fas fa-campfire',
            label: game.i18n.localize('bg3-hud-dnd5e.RestDialog.ShortRest'),
            tooltip: game.i18n.localize('bg3-hud-dnd5e.RestDialog.ShortRest'),
            tooltipDirection: 'LEFT',
            visible: restVisible,
            onClick: async () => {
                if (typeof actor.shortRest === 'function') {
                    await actor.shortRest();
                }
            }
        },
        {
            key: 'long-rest',
            classes: ['rest-button'],
            icon: 'fas fa-tent',
            label: game.i18n.localize('bg3-hud-dnd5e.RestDialog.LongRest'),
            tooltip: game.i18n.localize('bg3-hud-dnd5e.RestDialog.LongRest'),
            tooltipDirection: 'LEFT',
            visible: restVisible,
            onClick: async () => {
                if (typeof actor.longRest === 'function') {
                    await actor.longRest();
                }
            }
        }
    ];
}
