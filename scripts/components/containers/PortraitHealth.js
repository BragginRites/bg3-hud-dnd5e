// Import from core using module path
const BG3ComponentModule = await import('/modules/bg3-hud-core/scripts/components/BG3Component.js');
const BG3Component = BG3ComponentModule.BG3Component;

/**
 * Portrait Health Component
 * Displays HP, temp HP, and optional HP controls for D&D 5e
 */
export class PortraitHealth extends BG3Component {
    /**
     * Create a new portrait health component
     * @param {Object} options - Component options
     * @param {Actor} options.actor - The actor
     * @param {Token} options.token - The token
     * @param {BG3Component} options.parent - Parent container
     */
    constructor(options = {}) {
        super(options);
        this.actor = options.actor;
        this.token = options.token;
        this.parent = options.parent;
    }

    /**
     * Get health data from parent or directly from actor
     * @returns {Object} Health data
     */
    getHealth() {
        if (this.parent && typeof this.parent.getHealth === 'function') {
            return this.parent.getHealth();
        }
        
        // Fallback: calculate directly
        const hpValue = this.actor.system.attributes?.hp?.value || 0;
        const hpMax = this.actor.system.attributes?.hp?.max || 1;
        const hpPercent = Math.max(0, Math.min(100, (hpValue / hpMax) * 100));
        const damagePercent = 100 - hpPercent;
        const tempHp = this.actor.system.attributes?.hp?.temp || 0;
        
        return {
            current: hpValue,
            max: hpMax,
            percent: hpPercent,
            damage: damagePercent,
            temp: tempHp
        };
    }

    /**
     * Check if HP controls should be enabled
     * @returns {boolean}
     */
    canModifyHP() {
        return this.actor?.canUserModify(game.user, "update") ?? false;
    }

    /**
     * Render the health display
     * @returns {Promise<HTMLElement>}
     */
    async render() {
        // Create or reuse element
        if (!this.element) {
            this.element = this.createElement('div', ['hp-text']);
        }

        const health = this.getHealth();
        const hpControls = this.canModifyHP();

        // Clear existing content
        this.element.innerHTML = '';

        // Temp HP display
        if (health.temp > 0) {
            const tempHpText = this.createElement('div', ['temp-hp-text']);
            tempHpText.textContent = `+${health.temp}`;
            this.element.appendChild(tempHpText);
        }

        // HP Label (shown by default)
        const hpLabel = this.createElement('div', ['hp-label']);
        hpLabel.textContent = `${health.current}/${health.max}`;
        this.element.appendChild(hpLabel);

        // HP Controls (shown on hover if user can modify)
        if (hpControls) {
            const hpControlsDiv = this.createElement('div', ['hp-controls']);

            // Death button (set HP to 0)
            const deathBtn = this.createElement('div', ['hp-control-death']);
            deathBtn.innerHTML = '<i class="fas fa-skull" data-tooltip="Set to 0 HP"></i>';
            this.addEventListener(deathBtn, 'click', async (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (this.actor.system.attributes.hp.value > 0) {
                    await this.actor.update({'system.attributes.hp.value': 0});
                }
            });
            hpControlsDiv.appendChild(deathBtn);

            // HP Input field
            const hpInput = this.createElement('input', ['hp-input']);
            hpInput.type = 'text';
            hpInput.value = health.current + health.temp;
            hpInput.max = health.max;

            // Input event handlers
            this.addEventListener(hpInput, 'click', (event) => {
                event.preventDefault();
                event.stopPropagation();
            });

            this.addEventListener(hpInput, 'keydown', (event) => {
                if (event.code === "Enter" || event.code === "NumpadEnter") {
                    event.currentTarget.blur();
                }
            });

            this.addEventListener(hpInput, 'focusin', (event) => {
                event.target.select();
                this.element.dataset.hpLocked = 'true';
            });

            this.addEventListener(hpInput, 'focusout', async (event) => {
                const inputValue = event.currentTarget.value.trim();
                const {value, delta, isDelta} = this._parseAttributeInput(inputValue);
                
                await this.actor.modifyTokenAttribute('attributes.hp', isDelta ? delta : value, isDelta);
                
                if (isDelta && event.target.value === inputValue) {
                    event.target.value = this.actor.system.attributes.hp.value;
                }
                
                this.element.dataset.hpLocked = 'false';
            });

            hpControlsDiv.appendChild(hpInput);

            // Full heal button
            const fullBtn = this.createElement('div', ['hp-control-full']);
            fullBtn.innerHTML = '<i class="fas fa-heart" data-tooltip="Full Heal"></i>';
            this.addEventListener(fullBtn, 'click', async (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (this.actor.system.attributes.hp.value < this.actor.system.attributes.hp.max) {
                    await this.actor.update({'system.attributes.hp.value': this.actor.system.attributes.hp.max});
                }
            });
            hpControlsDiv.appendChild(fullBtn);

            this.element.appendChild(hpControlsDiv);
        }

        // Disable pointer events if can't modify
        if (!hpControls) {
            this.element.style.setProperty('pointer-events', 'none');
        } else {
            this.element.style.removeProperty('pointer-events');
        }

        return this.element;
    }

    /**
     * Update health display without full re-render
     * Only updates the text content and temp HP, much faster than render()
     */
    async updateHealth() {
        if (!this.element) {
            console.warn('PortraitHealth | Cannot update health, element not rendered yet');
            return;
        }

        const health = this.getHealth();

        // Update temp HP
        const existingTempHp = this.element.querySelector('.temp-hp-text');
        if (health.temp > 0) {
            if (existingTempHp) {
                // Update existing temp HP text
                existingTempHp.textContent = `+${health.temp}`;
            } else {
                // Add temp HP text if it doesn't exist
                const tempHpText = this.createElement('div', ['temp-hp-text']);
                tempHpText.textContent = `+${health.temp}`;
                this.element.insertBefore(tempHpText, this.element.firstChild);
            }
        } else if (existingTempHp) {
            // Remove temp HP text if it exists but temp is 0
            existingTempHp.remove();
        }

        // Update HP label
        const hpLabel = this.element.querySelector('.hp-label');
        if (hpLabel) {
            hpLabel.textContent = `${health.current}/${health.max}`;
        }

        // Update HP input if it exists and is not currently focused
        const hpInput = this.element.querySelector('.hp-input');
        if (hpInput && this.element.dataset.hpLocked !== 'true') {
            hpInput.value = health.current + health.temp;
        }
    }

    /**
     * Parse HP input (supports =, +, -, %)
     * @param {string} input - The input string
     * @returns {Object} Parsed value and delta
     * @private
     */
    _parseAttributeInput(input) {
        const isEqual = input.startsWith("=");
        const isDelta = input.startsWith("+") || input.startsWith("-");
        const current = this.actor.system.attributes.hp.value;
        let v;

        // Explicit equality
        if (isEqual) input = input.slice(1);

        // Percentage change
        if (input.endsWith("%")) {
            const p = Number(input.slice(0, -1)) / 100;
            v = this.actor.system.attributes.hp.max * p;
        }
        // Additive delta
        else {
            v = Number(input);
        }

        // Return parsed input
        const value = isDelta ? current + v : v;
        const delta = isDelta ? v : undefined;
        return {value, delta, isDelta};
    }
}

