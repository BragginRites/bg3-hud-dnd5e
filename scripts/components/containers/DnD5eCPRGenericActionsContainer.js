/**
 * D&D 5e CPR Generic Actions Container
 * Provides a vertical button to trigger CPR's Generic Actions item
 * Uses the appropriate item based on D&D 5e rules version (2014/legacy or 2024/modern)
 * Only visible when CPR module is active and setting is enabled
 */

import { BG3Component } from '/modules/bg3-hud-core/scripts/components/BG3Component.js';
import { createLogger } from '/modules/bg3-hud-core/scripts/utils/logger.js';
import { getCPRGenericActionsUUID } from '../../constants/cprBlockedHotbarActions.js';
import { ensureCompendiumItemOnActor } from '../../utils/ensureCompendiumItemOnActor.js';

const log = createLogger('bg3-hud-dnd5e');

const MODULE_ID = 'bg3-hud-dnd5e';

/**
 * D&D 5e CPR Generic Actions Container
 */
export class DnD5eCPRGenericActionsContainer extends BG3Component {
    /**
     * Create a new CPR Generic Actions container
     * @param {Object} options - Container options
     * @param {Actor} options.actor - The actor
     * @param {Token} options.token - The token
     */
    constructor(options = {}) {
        super(options);
        this.actor = options.actor || null;
        this.token = options.token || null;
    }

    /**
     * Check if container should be visible
     * @returns {boolean}
     */
    get visible() {
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
     * Render the container
     * @returns {Promise<HTMLElement>}
     */
    async render() {
        // Create container element
        if (!this.element) {
            this.element = this.createElement('div', ['bg3-cpr-generic-actions-container']);
            // Mark as UI element to prevent system tooltips
            this.element.dataset.bg3Ui = 'true';
        }

        // Clear existing content
        while (this.element.firstChild) {
            this.element.removeChild(this.element.firstChild);
        }

        // Hide container if not visible
        if (!this.visible) {
            this.element.style.display = 'none';
            return this.element;
        }

        // Show container
        this.element.style.display = 'flex';

        // Create button element
        const button = this.createElement('button', ['cpr-generic-actions-btn']);
        button.setAttribute('type', 'button');
        button.setAttribute('aria-label', game.i18n.localize(`${MODULE_ID}.CPR.GenericActionsButton.Label`));
        button.dataset.tooltip = game.i18n.localize(`${MODULE_ID}.CPR.GenericActionsButton.Tooltip`);
        button.dataset.tooltipDirection = 'LEFT';

        // Add text label (will be rotated vertically)
        const label = this.createElement('span', ['cpr-generic-actions-label']);
        label.textContent = game.i18n.localize(`${MODULE_ID}.CPR.GenericActionsButton.Label`);
        button.appendChild(label);

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
     * CPR items must stay permanently on actor for active effects to work with midi-qol
     * @param {MouseEvent} event - Click event
     * @private
     */
    async _onClick(event) {
        try {
            // Resolve (and create on the actor if needed) the Generic Actions
            // item for the active rules version. CPR items must stay
            // permanently on the actor for active effects to work with midi-qol.
            const uuid = getCPRGenericActionsUUID();
            const actorItem = await ensureCompendiumItemOnActor(this.actor, uuid);

            if (!actorItem) {
                ui.notifications.warn(
                    game.i18n.localize(`${MODULE_ID}.Notifications.CPRGenericActionsNotFound`)
                );
                return;
            }

            // Use the embedded item (never delete - active effects require persistence)
            if (typeof actorItem.use === 'function') {
                await actorItem.use({ event });
            } else {
                ui.notifications.warn(
                    game.i18n.localize(`${MODULE_ID}.Notifications.ItemCannotBeUsed`)
                );
            }
        } catch (error) {
            log.error('DnD5eCPRGenericActionsContainer | Error using CPR Generic Actions:', error);
            ui.notifications.error(
                game.i18n.localize(`${MODULE_ID}.Notifications.CPRGenericActionsError`)
            );
        }
    }

    /**
     * Update container visibility without full re-render
     */
    async update() {
        if (!this.element) {
            await this.render();
            return;
        }

        if (!this.visible) {
            this.element.style.display = 'none';
        } else {
            this.element.style.display = 'flex';
        }
    }

    /**
     * Destroy the component
     */
    destroy() {
        // Clear content
        if (this.element) {
            while (this.element.firstChild) {
                this.element.removeChild(this.element.firstChild);
            }
        }
        super.destroy();
    }
}
