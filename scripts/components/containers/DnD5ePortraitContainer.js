/**
 * D&D 5e Portrait Container
 * This will be dynamically created to extend the core PortraitContainer
 * when the module loads and core is available
 */
export async function createDnD5ePortraitContainer() {
    // Import core components dynamically
    const { PortraitContainer } = await import('/modules/bg3-hud-core/scripts/components/containers/PortraitContainer.js');
    const BG3ComponentModule = await import('/modules/bg3-hud-core/scripts/components/BG3Component.js');
    const BG3Component = BG3ComponentModule.BG3Component;
    
    /**
     * Portrait Health Component
     * Displays HP, temp HP, and optional HP controls for D&D 5e
     */
    class PortraitHealth extends BG3Component {
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

                // Death button (set HP and temp HP to 0)
                const deathBtn = this.createElement('div', ['hp-control-death']);
                // Mark as UI element to prevent system tooltips (dnd5e2, etc.) from showing
                deathBtn.dataset.bg3Ui = 'true';
                deathBtn.innerHTML = '<i class="fas fa-skull" data-tooltip="Set to 0 HP"></i>';
                this.addEventListener(deathBtn, 'click', async (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (this.actor.system.attributes.hp.value > 0 || this.actor.system.attributes.hp.temp > 0) {
                        await this.actor.update({
                            'system.attributes.hp.value': 0,
                            'system.attributes.hp.temp': 0
                        });
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
                // Mark as UI element to prevent system tooltips (dnd5e2, etc.) from showing
                fullBtn.dataset.bg3Ui = 'true';
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

    /**
     * Death Saves Component
     * Displays death saving throws for D&D 5e characters at 0 HP
     * Shows skull icon with success/failure boxes that can be clicked to mark
     */
    class DeathSaves extends BG3Component {
        /**
         * Create a new death saves component
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
         * Check if component should be visible
         * Only visible for characters at 0 HP or below
         * @returns {boolean}
         */
        isVisible() {
            if (!this.actor || this.actor.type !== 'character') return false;
            const currentHP = this.actor.system.attributes?.hp?.value || 0;
            return currentHP <= 0;
        }

        /**
         * Get death save data
         * @returns {Object}
         */
        getDeathSaveData() {
            return {
                success: this.actor.system.attributes?.death?.success || 0,
                failure: this.actor.system.attributes?.death?.failure || 0
            };
        }

        /**
         * Render the death saves display
         * @returns {Promise<HTMLElement>}
         */
        async render() {
            // Create or reuse element
            if (!this.element) {
                this.element = this.createElement('div', ['bg3-death-saves-container']);
            }

            // Clear existing content
            this.element.innerHTML = '';

            // Hide if not visible (fade out with opacity)
            if (!this.isVisible()) {
                this.element.style.opacity = '0';
                // After fade, set display none
                setTimeout(() => {
                    if (this.element && !this.isVisible()) {
                        this.element.style.display = 'none';
                    }
                }, 200);
                return this.element;
            }

            // Fade in: set display and start at opacity 0, then transition to 1
            this.element.style.display = 'flex';
            this.element.style.opacity = '0';
            // Force reflow to ensure opacity 0 is applied before transition
            void this.element.offsetHeight;
            this.element.style.opacity = '1';

            const deathData = this.getDeathSaveData();

            // Success boxes (3 boxes, filled from bottom up: index 0 = bottom/closest to skull)
            const successGroup = this.createElement('div', ['death-saves-group']);
            for (let i = 2; i >= 0; i--) {
                const box = this.createElement('div', ['death-save-box', 'success']);
                const successNeeded = i + 1; // How many successes to mark this box (1, 2, or 3)
                if (deathData.success >= successNeeded) {
                    box.classList.add('marked');
                }
                box.dataset.index = i;
                
                this.addEventListener(box, 'click', async (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    await this._onSuccessClick(i);
                });
                
                successGroup.appendChild(box);
            }
            this.element.appendChild(successGroup);

            // Skull button (center)
            const skull = this.createElement('div', ['death-saves-skull']);
            // Mark as UI element to prevent system tooltips (dnd5e2, etc.) from showing
            skull.dataset.bg3Ui = 'true';
            skull.innerHTML = '<i class="fas fa-skull"></i>';
            skull.dataset.tooltip = 'Left Click: Roll Death Save<br>Shift: Fast Forward | Alt: Advantage | Ctrl: Disadvantage<br>Right Click: Reset';
            skull.dataset.tooltipDirection = 'UP';
            
            this.addEventListener(skull, 'click', async (event) => {
                event.preventDefault();
                event.stopPropagation();
                await this._onSkullClick(event);
            });
            
            this.addEventListener(skull, 'contextmenu', async (event) => {
                event.preventDefault();
                event.stopPropagation();
                await this._onSkullRightClick();
            });
            
            this.element.appendChild(skull);

            // Failure boxes (3 boxes, filled from left to right)
            const failureGroup = this.createElement('div', ['death-saves-group']);
            for (let i = 0; i < 3; i++) {
                const box = this.createElement('div', ['death-save-box', 'failure']);
                if (i < deathData.failure) {
                    box.classList.add('marked');
                }
                box.dataset.index = i;
                
                this.addEventListener(box, 'click', async (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    await this._onFailureClick(i);
                });
                
                failureGroup.appendChild(box);
            }
            this.element.appendChild(failureGroup);

            return this.element;
        }

        /**
         * Update the death saves display without full re-render
         * Only updates the marked state of boxes
         * If element hasn't been rendered yet or has no content, render it first
         */
        async update() {
            // If not rendered yet, do a full render
            if (!this.element) {
                await this.render();
                return;
            }

            // If element exists but has no boxes (was rendered hidden), re-render it
            const hasBoxes = this.element.querySelector('.death-save-box');
            if (!hasBoxes) {
                await this.render();
                return;
            }

            // Update visibility
            if (!this.isVisible()) {
                this.element.style.opacity = '0';
                // After fade, set display none
                setTimeout(() => {
                    if (!this.isVisible()) {
                        this.element.style.display = 'none';
                    }
                }, 200);
                return;
            }

            // Fade in: set display and start at opacity 0, then transition to 1
            this.element.style.display = 'flex';
            this.element.style.opacity = '0';
            // Force reflow to ensure opacity 0 is applied before transition
            void this.element.offsetHeight;
            this.element.style.opacity = '1';

            const deathData = this.getDeathSaveData();

            // Update success boxes
            const successBoxes = this.element.querySelectorAll('.death-save-box.success');
            successBoxes.forEach((box) => {
                const dataIndex = parseInt(box.dataset.index);
                const successNeeded = dataIndex + 1;
                if (deathData.success >= successNeeded) {
                    box.classList.add('marked');
                } else {
                    box.classList.remove('marked');
                }
            });

            // Update failure boxes
            const failureBoxes = this.element.querySelectorAll('.death-save-box.failure');
            failureBoxes.forEach((box, index) => {
                if (index < deathData.failure) {
                    box.classList.add('marked');
                } else {
                    box.classList.remove('marked');
                }
            });
        }

        /**
         * Handle success box click
         * @param {number} index - Box index (0, 1, 2 from top to bottom)
         * @private
         */
        async _onSuccessClick(index) {
            if (!this.actor || this.actor.type !== 'character') return;
            
            const newSuccesses = index + 1;
            await this.actor.update({
                'system.attributes.death.success': newSuccesses
            });
        }

        /**
         * Handle failure box click
         * @param {number} index - Box index (0, 1, 2 from left to right)
         * @private
         */
        async _onFailureClick(index) {
            if (!this.actor || this.actor.type !== 'character') return;
            
            const newFailures = index + 1;
            await this.actor.update({
                'system.attributes.death.failure': newFailures
            });
        }

        /**
         * Handle skull click - roll death save
         * @param {MouseEvent} event - Click event
         * @private
         */
        async _onSkullClick(event) {
            if (!this.actor || this.actor.type !== 'character') return;

            try {
                // Roll death save with appropriate modifiers
                const roll = await this.actor.rollDeathSave({
                    event: event,
                    advantage: event.altKey,
                    disadvantage: event.ctrlKey,
                    fastForward: event.shiftKey
                });

                if (roll) {
                    // Update display after roll
                    await this.update();
                }
            } catch (error) {
                console.error('DeathSaves | Error rolling death save:', error);
            }
        }

        /**
         * Handle skull right-click - reset death saves
         * @private
         */
        async _onSkullRightClick() {
            if (!this.actor || this.actor.type !== 'character') return;

            await this.actor.update({
                'system.attributes.death.success': 0,
                'system.attributes.death.failure': 0
            });
        }
    }
    
    /**
     * D&D 5e Portrait Container
     * Extends the core PortraitContainer with D&D 5e specific features:
     * - Health/temp HP display
     * - Death saves
     * - D&D 5e specific styling
     */
    class DnD5ePortraitContainer extends PortraitContainer {
        /**
         * Create a new D&D 5e portrait container
         * @param {Object} options - Container options
         * @param {Actor} options.actor - The actor to display
         * @param {Token} options.token - The token to display
         */
        constructor(options = {}) {
            super(options);
            this.components = {};
        }

        /**
         * Get D&D 5e specific health data
         * @returns {Object} Health data including current, max, temp, percent
         */
        getHealth() {
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
         * Get portrait image URL
         * Defaults to token image unless explicitly set to use actor portrait
         * @returns {string} Image URL
         */
        getPortraitImage() {
            // Check saved preference (undefined means use default: token image)
            const useTokenImage = this.actor?.getFlag('bg3-hud-dnd5e', 'useTokenImage') ?? true;
            
            if (useTokenImage) {
                return this.token?.document?.texture?.src || this.actor?.img || '';
            } else {
                return this.actor?.img || this.token?.document?.texture?.src || '';
            }
        }

        /**
         * Update image preference (toggle between token and portrait)
         * @returns {Promise<void>}
         */
        async updateImagePreference() {
            if (!this.actor) return;
            
            // Get current preference
            const currentPreference = this.actor.getFlag('bg3-hud-dnd5e', 'useTokenImage') ?? true;
            
            // Toggle the preference
            const newPreference = !currentPreference;
            
            // Save to actor flags
            await this.actor.setFlag('bg3-hud-dnd5e', 'useTokenImage', newPreference);
            
            // The UpdateCoordinator will handle the re-render via _handleAdapterFlags
        }

        /**
         * Render the D&D 5e portrait container
         * @returns {Promise<HTMLElement>}
         */
        async render() {
            // Create container if not exists
            if (!this.element) {
                this.element = this.createElement('div', ['bg3-portrait-container']);
            }

            if (!this.token || !this.actor) {
                console.warn('DnD5ePortraitContainer | No token or actor provided');
                return this.element;
            }

            // Clear existing content
            this.element.innerHTML = '';

            // Add info container (button + panel) if provided by core
            // Place it before the portrait image so it sits above and is centered
            if (this.infoContainer) {
                try {
                    const infoElement = await this.infoContainer.render();
                    this.element.appendChild(infoElement);
                } catch (e) {
                    console.warn('DnD5ePortraitContainer | Failed to render info container', e);
                }
            }

            // Get health data
            const health = this.getHealth();
            const imageSrc = this.getPortraitImage();

            // Build portrait structure
            const portraitImageContainer = this.createElement('div', ['portrait-image-container']);
            const portraitImageSubContainer = this.createElement('div', ['portrait-image-subcontainer']);
            
            // Portrait image
            const img = this.createElement('img', ['portrait-image']);
            img.src = imageSrc;
            img.alt = this.actor?.name || 'Portrait';
            
            // Health overlay (red damage indicator)
            const healthOverlay = this.createElement('div', ['health-overlay']);
            const damageOverlay = this.createElement('div', ['damage-overlay']);
            damageOverlay.style.height = `${health.damage}%`;
            damageOverlay.style.opacity = '1';
            healthOverlay.appendChild(damageOverlay);

            // Apply alpha mask so overlays only affect non-transparent pixels of the image
            portraitImageSubContainer.setAttribute('data-bend-mode', 'true');
            // Use the resolved img.src (absolute URL) and quote it for CSS parsing safety
            portraitImageSubContainer.style.setProperty('--bend-img', `url("${img.src}")`);
            this.element.classList.add('use-bend-mask');

            // Assemble portrait image structure
            portraitImageSubContainer.appendChild(img);
            portraitImageSubContainer.appendChild(healthOverlay);
            portraitImageContainer.appendChild(portraitImageSubContainer);
            this.element.appendChild(portraitImageContainer);

            // Register context menu for portrait image (right-click to toggle token/portrait)
            this._registerPortraitMenu(portraitImageContainer);

            // Add health text component
            this.components.health = new PortraitHealth({
                actor: this.actor,
                token: this.token,
                parent: this
            });
            const healthElement = await this.components.health.render();
            this.element.appendChild(healthElement);

            // Add death saves component (shows only when HP <= 0 and character)
            this.components.deathSaves = new DeathSaves({
                actor: this.actor,
                token: this.token
            });
            const deathSavesElement = await this.components.deathSaves.render();
            this.element.appendChild(deathSavesElement);

            return this.element;
        }

        /**
         * Update only the health display without full re-render
         * This is called when HP changes to avoid re-rendering the entire UI
         * Optimized: Only updates what changed (overlay height, text, and death saves)
         */
        async updateHealth() {
            if (!this.element || !this.token || !this.actor) {
                return;
            }

            // Get updated health data
            const health = this.getHealth();

            // Update damage overlay height (just change the style, don't recreate)
            const damageOverlay = this.element.querySelector('.damage-overlay');
            if (damageOverlay) {
                damageOverlay.style.height = `${health.damage}%`;
            }

            // Update health text component (it has its own optimized update method)
            if (this.components.health && typeof this.components.health.updateHealth === 'function') {
                await this.components.health.updateHealth();
            }

            // Update death saves visibility (show/hide based on HP <= 0)
            if (this.components.deathSaves && typeof this.components.deathSaves.update === 'function') {
                await this.components.deathSaves.update();
            }
        }

        /**
         * Destroy the container and cleanup
         */
        destroy() {
            // Destroy child components
            for (const [key, component] of Object.entries(this.components)) {
                if (component && typeof component.destroy === 'function') {
                    component.destroy();
                }
            }
            this.components = {};

            // Call parent destroy
            super.destroy();
        }
    }
    
    return DnD5ePortraitContainer;
}
