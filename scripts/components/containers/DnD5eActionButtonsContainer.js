import { ActionButtonsContainer } from '/modules/bg3-hud-core/scripts/components/containers/ActionButtonsContainer.js';

/**
 * D&D 5e Action Buttons Container
 * Provides rest and turn buttons specific to D&D 5e
 */
export class DnD5eActionButtonsContainer extends ActionButtonsContainer {
    /**
     * Create D&D 5e action buttons container
     * @param {Object} options - Container options
     * @param {Actor} options.actor - The actor
     * @param {Token} options.token - The token
     */
    constructor(options = {}) {
        super({
            ...options,
            getButtons: () => this.getD5eButtons()
        });
    }

    /**
     * Get D&D 5e-specific button definitions
     * @returns {Array<Object>} Button definitions
     */
    getD5eButtons() {
        const buttons = [];

        if (!this.actor) return buttons;

        // End Turn button (visible during combat when it's the actor's turn)
        buttons.push({
            key: 'end-turn',
            classes: ['end-turn-button'],
            icon: 'fas fa-clock-rotate-left',
            label: game.i18n.localize('BG3HUD.EndTurn'),
            tooltip: game.i18n.localize('BG3HUD.EndTurn'),
            tooltipDirection: 'LEFT',
            visible: () => {
                return !!game.combat?.started &&
                    game.combat?.combatant?.actor?.id === this.actor.id;
            },
            onClick: async () => {
                if (game.combat) {
                    await game.combat.nextTurn();
                }
            }
        });

        const restVisible = () => !game.combat?.started;

        // Short Rest / Long Rest (legacy inspired-hotbar split; no dialog on click)
        buttons.push({
            key: 'short-rest',
            classes: ['rest-button'],
            icon: 'fas fa-campfire',
            label: game.i18n.localize('bg3-hud-dnd5e.RestDialog.ShortRest'),
            tooltip: game.i18n.localize('bg3-hud-dnd5e.RestDialog.ShortRest'),
            tooltipDirection: 'LEFT',
            visible: restVisible,
            onClick: async () => {
                if (this.actor && typeof this.actor.shortRest === 'function') {
                    await this.actor.shortRest();
                }
            }
        });

        buttons.push({
            key: 'long-rest',
            classes: ['rest-button'],
            icon: 'fas fa-tent',
            label: game.i18n.localize('bg3-hud-dnd5e.RestDialog.LongRest'),
            tooltip: game.i18n.localize('bg3-hud-dnd5e.RestDialog.LongRest'),
            tooltipDirection: 'LEFT',
            visible: restVisible,
            onClick: async () => {
                if (this.actor && typeof this.actor.longRest === 'function') {
                    await this.actor.longRest();
                }
            }
        });

        return buttons;
    }

    /**
     * Show rest type selection dialog.
     * Kept available but not wired to the rest buttons (short/long are direct).
     */
    async showRestDialog() {
        const { showRestDialog } = await import('../ui/RestDialog.js');
        await showRestDialog(this.actor);
    }
}
