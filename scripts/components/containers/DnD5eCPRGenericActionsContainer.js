/**
 * D&D 5e CPR Generic Actions Container
 * Provides a vertical button to trigger CPR's Generic Actions item
 * Uses the appropriate item based on D&D 5e rules version (2014/legacy or 2024/modern)
 * Only visible when CPR module is active and setting is enabled
 */

import { BG3Component } from '/modules/bg3-hud-core/scripts/components/BG3Component.js';

const MODULE_ID = 'bg3-hud-dnd5e';

// CPR Generic Actions item UUIDs by rules version
const CPR_GENERIC_ACTIONS_UUIDS = {
    legacy: 'Compendium.chris-premades.CPRMiscellaneous.Item.V0rdpb8WPmdYhAjc',  // 2014 rules
    modern: 'Compendium.chris-premades.CPRMiscellaneous.Item.Iz2XtxLReLnXTDiI'   // 2024 rules
};

/**
 * Get the CPR Generic Actions UUID based on D&D 5e rules version
 * @returns {string} The UUID for the appropriate Generic Actions item
 */
function getCPRGenericActionsUUID() {
    const rulesVersion = game.settings.get('dnd5e', 'rulesVersion');
    return CPR_GENERIC_ACTIONS_UUIDS[rulesVersion] || CPR_GENERIC_ACTIONS_UUIDS.modern;
}

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
     * @param {MouseEvent} event - Click event
     * @private
     */
    async _onClick(event) {
        try {
            // Get the item from the compendium (based on rules version)
            const uuid = getCPRGenericActionsUUID();
            const item = await fromUuid(uuid);
            
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
            console.error('[bg3-hud-dnd5e] DnD5eCPRGenericActionsContainer | Error using CPR Generic Actions:', error);
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
