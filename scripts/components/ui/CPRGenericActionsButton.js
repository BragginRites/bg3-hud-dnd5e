/**
 * CPR Generic Actions Button Component
 * Displays a button to trigger CPR's Generic Actions (2024) item
 */

import { BG3Component } from '/modules/bg3-hud-core/scripts/components/BG3Component.js';

const MODULE_ID = 'bg3-hud-dnd5e';
const CPR_GENERIC_ACTIONS_UUID = 'Compendium.chris-premades.CPRMiscellaneous.Item.Iz2XtxLReLnXTDiI';

/**
 * CPR Generic Actions Button Component
 */
export class CPRGenericActionsButton extends BG3Component {
    /**
     * Create a new CPR Generic Actions button
     * @param {Object} options - Component options
     * @param {Actor} options.actor - The actor
     * @param {Token} options.token - The token
     */
    constructor(options = {}) {
        super(options);
        this.actor = options.actor;
        this.token = options.token;
    }

    /**
     * Check if the button should be visible
     * @returns {boolean}
     */
    isVisible() {
        // Check if CPR module is active
        if (!game.modules.get('chris-premades')?.active) {
            return false;
        }

        // Check if setting is enabled
        if (!game.settings.get(MODULE_ID, 'enableCPRGenericActions')) {
            return false;
        }

        // Only show if actor exists
        return !!this.actor;
    }

    /**
     * Render the CPR Generic Actions button
     * @returns {Promise<HTMLElement>}
     */
    async render() {
        // Create or reuse element
        if (!this.element) {
            this.element = this.createElement('div', ['bg3-cpr-generic-actions-button']);
        }

        // Clear existing content
        this.element.innerHTML = '';

        // Hide if not visible
        if (!this.isVisible()) {
            this.element.style.display = 'none';
            return this.element;
        }

        // Show the button
        this.element.style.display = 'flex';

        // Create button element
        const button = this.createElement('button', ['cpr-generic-actions-btn']);
        button.setAttribute('type', 'button');
        button.setAttribute('aria-label', game.i18n.localize(`${MODULE_ID}.CPR.GenericActionsButton.Label`));
        button.dataset.tooltip = game.i18n.localize(`${MODULE_ID}.CPR.GenericActionsButton.Tooltip`);
        button.dataset.tooltipDirection = 'RIGHT';

        // Add icon
        const icon = this.createElement('i', ['fas', 'fa-hand-fist']);
        button.appendChild(icon);

        // Add click handler
        this.addEventListener(button, 'click', async (event) => {
            event.preventDefault();
            event.stopPropagation();
            await this._onClick(event);
        });

        this.element.appendChild(button);

        return this.element;
    }

    /**
     * Handle button click - use the CPR Generic Actions item
     * @param {MouseEvent} event - Click event
     * @private
     */
    async _onClick(event) {
        try {
            // Get the item from the compendium
            const item = await fromUuid(CPR_GENERIC_ACTIONS_UUID);
            
            if (!item) {
                ui.notifications.warn(
                    game.i18n.localize(`${MODULE_ID}.Notifications.CPRGenericActionsNotFound`)
                );
                return;
            }

            // Check if actor has the item, if not create it
            let actorItem = this.actor.items.find(
                (i) => i.name === item.name || i.system?.identifier === item.system?.identifier
            );

            if (!actorItem) {
                // Create the item on the actor
                const createdItems = await this.actor.createEmbeddedDocuments('Item', [item.toObject()]);
                actorItem = createdItems[0];
            }

            // Use the item (this will trigger CPR's dialog)
            if (typeof actorItem.use === 'function') {
                await actorItem.use({ event });
            } else {
                ui.notifications.warn(
                    game.i18n.localize(`${MODULE_ID}.Notifications.ItemCannotBeUsed`)
                );
            }
        } catch (error) {
            console.error('[bg3-hud-dnd5e] CPRGenericActionsButton | Error using CPR Generic Actions:', error);
            ui.notifications.error(
                game.i18n.localize(`${MODULE_ID}.Notifications.CPRGenericActionsError`)
            );
        }
    }

    /**
     * Update button visibility without full re-render
     */
    async update() {
        if (!this.element) {
            await this.render();
            return;
        }

        if (!this.isVisible()) {
            this.element.style.display = 'none';
        } else {
            this.element.style.display = 'flex';
        }
    }

    /**
     * Destroy the component
     */
    destroy() {
        // Cleanup handled by parent BG3Component
        super.destroy();
    }
}

