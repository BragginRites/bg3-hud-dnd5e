// Import from core using module path
const BG3ComponentModule = await import('/modules/bg3-hud-core/scripts/components/BG3Component.js');
const BG3Component = BG3ComponentModule.BG3Component;

/**
 * Death Saves Component
 * Displays death saving throws for D&D 5e characters at 0 HP
 * Shows skull icon with success/failure boxes that can be clicked to mark
 */
export class DeathSaves extends BG3Component {
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

