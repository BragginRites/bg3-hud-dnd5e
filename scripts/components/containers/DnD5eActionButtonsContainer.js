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

        // Rest button (visible outside combat) - Ctrl for short rest, Alt for long rest, or dialog
        buttons.push({
            key: 'rest',
            classes: ['rest-button'],
            icon: 'fas fa-bed',
            label: game.i18n.localize('BG3HUD.Rest'),
            tooltip: game.i18n.localize('BG3HUD.RestTooltip'),
            tooltipDirection: 'LEFT',
            visible: () => {
                return !game.combat?.started;
            },
            onClick: async (event) => {
                // Ctrl = Short Rest
                if (event.ctrlKey || event.metaKey) {
                    if (this.actor && typeof this.actor.shortRest === 'function') {
                        await this.actor.shortRest();
                    }
                }
                // Alt = Long Rest
                else if (event.altKey) {
                    if (this.actor && typeof this.actor.longRest === 'function') {
                        await this.actor.longRest();
                    }
                }
                // No modifier = Show dialog
                else {
                    await this.showRestDialog();
                }
            }
        });

        return buttons;
    }

    /**
     * Show rest type selection dialog
     */
    async showRestDialog() {
        const { RestDialog } = await import('../ui/RestDialog.js');
        const dialog = new RestDialog({
            actor: this.actor
        });
        await dialog.render(true);
    }
}

