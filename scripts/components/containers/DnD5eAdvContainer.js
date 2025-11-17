import { BG3Component } from '/modules/bg3-hud-core/scripts/components/BG3Component.js';

const MODULE_ID = 'bg3-hud-dnd5e';

/**
 * D&D 5e Advantage/Disadvantage Container
 * Provides ADV/DIS buttons for midi-qol integration
 * Only visible when midi-qol is active and setting is enabled
 */
export class DnD5eAdvContainer extends BG3Component {
    constructor(options = {}) {
        super(options);
        this.actor = options.actor || null;
    }

    /**
     * Check if container should be visible
     * @returns {boolean}
     */
    get visible() {
        return game.settings.get(MODULE_ID, 'addAdvBtnsMidiQoL') && 
               game.modules.get("midi-qol")?.active;
    }

    /**
     * Get button data for ADV and DIS buttons
     * @returns {Array}
     */
    get btnData() {
        return [
            {
                type: 'div',
                key: 'advBtn',
                tooltip: 'Left-click to set Advantage to roll only.<br>Right-click to toggle.',
                label: 'ADV',
                events: {
                    'mouseup': this.setState.bind(this),
                }
            },
            {
                type: 'div',
                key: 'disBtn',
                tooltip: 'Left-click to set Disadvantage to roll only.<br>Right-click to toggle.',
                label: 'DIS',
                events: {
                    'mouseup': this.setState.bind(this),
                }
            }
        ];
    }

    /**
     * Render the container
     * @returns {Promise<HTMLElement>}
     */
    async render() {
        // Create container element (always create for proper flex positioning)
        if (!this.element) {
            this.element = this.createElement('div', ['bg3-adv-container']);
            // Mark as UI element to prevent system tooltips
            this.element.dataset.bg3Ui = 'true';
        }

        // Clear existing content
        while (this.element.firstChild) {
            this.element.removeChild(this.element.firstChild);
        }

        // Hide container if not visible (midi-qol not active or setting disabled)
        if (!this.visible || !this.actor) {
            this.element.style.display = 'none';
            return this.element;
        }

        // Show container
        this.element.style.display = 'flex';

        // Create buttons
        const buttons = this.btnData.map((btn) => this._createButton(btn));
        for (const btn of buttons) {
            this.element.appendChild(btn);
        }

        // Update button states
        this.updateButtons();

        return this.element;
    }

    /**
     * Create a button element
     * @param {Object} btnData - Button configuration
     * @returns {HTMLElement}
     * @private
     */
    _createButton(btnData) {
        const button = document.createElement('div');
        button.dataset.key = btnData.key;
        
        // Mark as UI element to prevent system tooltips (dnd5e2, etc.) from showing
        button.dataset.bg3Ui = 'true';
        
        // Add tooltip
        if (btnData.tooltip) {
            button.dataset.tooltip = btnData.tooltip;
            button.dataset.tooltipDirection = btnData.tooltipDirection || 'UP';
            if (btnData.tooltipClass) {
                button.dataset.tooltipClass = btnData.tooltipClass;
            }
        }

        // Add label
        if (btnData.label) {
            const label = document.createElement('span');
            label.textContent = btnData.label;
            button.appendChild(label);
        }

        // Add event listeners
        if (btnData.events) {
            for (const [event, handler] of Object.entries(btnData.events)) {
                this.addEventListener(button, event, handler);
            }
        }

        return button;
    }

    /**
     * Set advantage/disadvantage state
     * @param {MouseEvent} event - Mouse event
     */
    async setState(event) {
        if (!this.actor) return;

        const once = event?.button === 2 ? false : true;
        const key = event?.target?.closest('[data-key]')?.dataset.key;

        if (event === null || 
            (this.actor.getFlag(MODULE_ID, "advOnce") === once && 
             this.actor.getFlag(MODULE_ID, "advState") === key)) {
            // Clear state if clicking the same button with same mode
            await this.actor.unsetFlag(MODULE_ID, "advState");
            await this.actor.unsetFlag(MODULE_ID, "advOnce");
        } else {
            // Set new state
            await this.actor.setFlag(MODULE_ID, "advOnce", once);
            await this.actor.setFlag(MODULE_ID, "advState", key);
        }
        
        this.updateButtons();
    }

    /**
     * Clear advantage/disadvantage state programmatically
     * Used by external hooks to reset one-time effects
     */
    async clearState() {
        await this.setState(null);
    }

    /**
     * Update button visual states based on actor flags
     */
    updateButtons() {
        if (!this.actor || !this.element) return;

        const state = this.actor.getFlag(MODULE_ID, "advState");
        const once = this.actor.getFlag(MODULE_ID, "advOnce");

        if (state !== undefined) {
            this.element.dataset.state = state;
        } else {
            this.element.removeAttribute('data-state');
        }

        if (once !== undefined) {
            this.element.dataset.once = String(once);
        } else {
            this.element.removeAttribute('data-once');
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

