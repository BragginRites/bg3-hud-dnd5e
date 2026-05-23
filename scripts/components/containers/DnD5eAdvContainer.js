import { BG3Component } from '/modules/bg3-hud-core/scripts/components/BG3Component.js';

const MODULE_ID = 'bg3-hud-dnd5e';

/**
 * D&D 5e Advantage/Disadvantage Container
 * ADV/DIS buttons are always shown as roll reminders; midi-qol integration is optional.
 */
export class DnD5eAdvContainer extends BG3Component {
    constructor(options = {}) {
        super(options);
        this.actor = options.actor || null;
        this.token = options.token || null;
    }

    /**
     * Whether ADV/DIS state should apply to midi-qol rolls
     * @returns {boolean}
     */
    _midiIntegrationActive() {
        return game.modules.get('midi-qol')?.active
            && game.settings.get(MODULE_ID, 'addAdvBtnsMidiQoL');
    }

    /**
     * Check if container should be visible
     * @returns {boolean}
     */
    get visible() {
        return !!this.actor;
    }

    /**
     * Get button data for ADV and DIS buttons
     * @returns {Array}
     */
    get btnData() {
        if (!this.actor) return [];

        const buttons = [
            {
                type: 'div',
                key: 'advBtn',
                tooltip: () => game.i18n.localize(`${MODULE_ID}.Advantage.AdvTooltip`),
                label: () => game.i18n.localize(`${MODULE_ID}.Advantage.ADV`),
                events: {
                    'mouseup': this.setState.bind(this),
                }
            }
        ];

        // Insert Heroic Inspiration button in the middle for character type actors
        if (this.actor.type === 'character') {
            const hasInspiration = !!this.actor.system.attributes.inspiration;
            buttons.push({
                type: 'div',
                key: 'inspirationBtn',
                classes: [hasInspiration ? 'active' : 'inactive'],
                tooltip: () => {
                    const active = !!this.actor.system.attributes.inspiration;
                    return `Heroic Inspiration: ${active ? 'Active' : 'Inactive'}<br>Left Click to Toggle`;
                },
                icon: 'fas fa-star',
                events: {
                    'click': this.toggleInspiration.bind(this)
                }
            });
        }

        buttons.push({
            type: 'div',
            key: 'disBtn',
            tooltip: () => game.i18n.localize(`${MODULE_ID}.Advantage.DisTooltip`),
            label: () => game.i18n.localize(`${MODULE_ID}.Advantage.DIS`),
            events: {
                'mouseup': this.setState.bind(this),
            }
        });

        return buttons;
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

        if (!this.visible) {
            this.element.style.display = 'none';
            return this.element;
        }

        this.element.style.display = 'flex';
        this.element.dataset.midiIntegration = String(this._midiIntegrationActive());

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
        
        // Add classes
        if (btnData.classes) {
            button.classList.add(...btnData.classes);
        }
        
        // Add tooltip
        if (btnData.tooltip) {
            const tooltipText = typeof btnData.tooltip === 'function' ? btnData.tooltip() : btnData.tooltip;
            button.dataset.tooltip = tooltipText;
            button.dataset.tooltipDirection = btnData.tooltipDirection || 'UP';
            if (btnData.tooltipClass) {
                button.dataset.tooltipClass = btnData.tooltipClass;
            }
        }

        // Add icon or label
        if (btnData.icon) {
            const icon = document.createElement('i');
            icon.className = btnData.icon;
            button.appendChild(icon);
        } else if (btnData.label) {
            const label = document.createElement('span');
            const labelText = typeof btnData.label === 'function' ? btnData.label() : btnData.label;
            label.textContent = labelText;
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
     * Toggle inspiration on the actor
     * @param {MouseEvent} event - Click event
     */
    async toggleInspiration(event) {
        if (!this.actor) return;
        event.preventDefault();
        event.stopPropagation();
        
        const hasInspiration = !!this.actor.system.attributes.inspiration;
        await this.actor.update({ 'system.attributes.inspiration': !hasInspiration });
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

        // Update inspiration button visual classes and tooltip
        const inspBtn = this.element.querySelector('[data-key="inspirationBtn"]');
        if (inspBtn) {
            const hasInspiration = !!this.actor.system.attributes.inspiration;
            inspBtn.classList.toggle('active', hasInspiration);
            inspBtn.classList.toggle('inactive', !hasInspiration);
            inspBtn.dataset.tooltip = `Heroic Inspiration: ${hasInspiration ? 'Active' : 'Inactive'}<br>Left Click to Toggle`;
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

