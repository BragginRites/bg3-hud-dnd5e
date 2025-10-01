import { PortraitHealth } from './PortraitHealth.js';

/**
 * D&D 5e Portrait Container
 * This will be dynamically created to extend the core PortraitContainer
 * when the module loads and core is available
 */
export async function createDnD5ePortraitContainer() {
    // Import core PortraitContainer dynamically
    const { PortraitContainer } = await import('/modules/bg3-hud-core/scripts/components/containers/PortraitContainer.js');
    
    /**
     * D&D 5e Portrait Container
     * Extends the core PortraitContainer with D&D 5e specific features:
     * - Health/temp HP display
     * - Death saves (future)
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
     * For now, uses token image. Future: add setting for actor portrait
     * @returns {string} Image URL
     */
    getPortraitImage() {
        return this.token?.document?.texture?.src || this.actor?.img || '';
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

        // Assemble portrait image structure
        portraitImageSubContainer.appendChild(img);
        portraitImageSubContainer.appendChild(healthOverlay);
        portraitImageContainer.appendChild(portraitImageSubContainer);
        this.element.appendChild(portraitImageContainer);

        // Add health text component
        this.components.health = new PortraitHealth({
            actor: this.actor,
            token: this.token,
            parent: this
        });
        const healthElement = await this.components.health.render();
        this.element.appendChild(healthElement);

        // TODO: Add death saves container when actor is at 0 HP

        console.log('DnD5ePortraitContainer | Rendered with health:', health);

        return this.element;
    }

    /**
     * Update only the health display without full re-render
     * This is called when HP changes to avoid re-rendering the entire UI
     * Optimized: Only updates what changed (overlay height and text)
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

