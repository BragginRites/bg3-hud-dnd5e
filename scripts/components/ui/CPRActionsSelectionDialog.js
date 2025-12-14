/**
 * CPR Actions Selection Dialog
 * Allows GMs to select up to 6 CPR Generic Actions from the appropriate CPRActions compendium
 * based on the D&D 5e rules version setting (2014/legacy or 2024/modern)
 * 
 * Uses the same styling pattern as core SelectionDialog (bg3-selection-dialog)
 */

import { BG3Component } from '/modules/bg3-hud-core/scripts/components/BG3Component.js';

const MODULE_ID = 'bg3-hud-dnd5e';
const MAX_SELECTIONS = 6;

/**
 * Get CPR configuration based on D&D 5e rules version
 * @returns {{packName: string, packId: string, isModern: boolean, settingsKey: string}}
 */
function getCPRConfig() {
    // Check D&D 5e rules version setting
    // "modern" = 2024 rules, "legacy" = 2014 rules
    const rulesVersion = game.settings.get('dnd5e', 'rulesVersion');
    const isModern = rulesVersion === 'modern';

    if (isModern) {
        return {
            packName: 'CPRActions2024',
            packId: 'chris-premades.CPRActions2024',
            // 2024 default actions: Dash, Disengage, Dodge, Help, Hide, Ready
            defaultActions: ['Dash', 'Disengage', 'Dodge', 'Help', 'Hide', 'Ready'],
            isModern: true,
            settingsKey: 'selectedCPRActionsModern'
        };
    } else {
        return {
            packName: 'CPRActions',
            packId: 'chris-premades.CPRActions',
            // 2014 default actions: Dash, Disengage, Dodge, Grapple, Help, Hide
            defaultActions: ['Dash', 'Disengage', 'Dodge', 'Grapple', 'Help', 'Hide'],
            isModern: false,
            settingsKey: 'selectedCPRActionsLegacy'
        };
    }
}

/**
 * CPR Actions Selection Dialog
 */
export class CPRActionsSelectionDialog extends BG3Component {
    /**
     * Create new CPR actions selection dialog
     * @param {Object} options - Dialog options
     * @param {Array<string>} options.selectedActions - Currently selected action UUIDs
     */
    constructor(options = {}) {
        super(options);
        this.title = options.title || game.i18n.localize(`${MODULE_ID}.CPR.SelectActionsTitle`);
        this.selectedActions = new Set(options.selectedActions || []);
        this.resolve = null;
        this.availableActions = [];
    }

    /**
     * Render the dialog and return a promise that resolves with selected UUIDs
     * @returns {Promise<Array<string>|null>} Array of selected UUIDs or null if cancelled
     */
    async render() {
        return new Promise(async (resolve) => {
            this.resolve = resolve;

            // Load available actions from compendium
            await this._loadAvailableActions();

            // Render dialog
            this._renderDialog();
        });
    }

    /**
     * Load available actions from the appropriate CPRActions compendium based on rules version
     * @private
     */
    async _loadAvailableActions() {
        const cprConfig = getCPRConfig();
        this.cprConfig = cprConfig; // Store for later use

        const pack = game.packs.get(cprConfig.packId);
        if (!pack) {
            console.warn(`[bg3-hud-dnd5e] CPRActionsSelectionDialog | ${cprConfig.packName} pack not found`);
            this.availableActions = [];
            return;
        }

        // Get pack index
        const index = await pack.getIndex();

        // Load all items to get icons
        const itemIds = Array.from(index.keys());
        const items = await Promise.all(
            itemIds.map(id => pack.getDocument(id))
        );

        // Convert to array with icon data and sort alphabetically by name
        this.availableActions = items
            .filter(item => item) // Filter out any null/undefined items
            .map(item => ({
                id: item.id,
                uuid: item.uuid,
                name: item.name,
                img: item.img || item.system?.img || 'icons/svg/item-bag.svg'
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * Render the dialog HTML using bg3-selection-dialog pattern
     * @private
     */
    _renderDialog() {
        // Create dialog container (matches SelectionDialog pattern)
        this.element = this.createElement('div', ['bg3-selection-dialog']);

        // Dialog header
        const header = this.createElement('div', ['dialog-header']);
        const titleEl = this.createElement('h2', ['dialog-title']);
        titleEl.textContent = this.title;
        header.appendChild(titleEl);
        this.element.appendChild(header);

        // Description (between header and content)
        const description = this.createElement('p', ['bg3-dialog-description']);
        description.innerHTML = game.i18n.format(`${MODULE_ID}.CPR.SelectActionsDescription`, { max: MAX_SELECTIONS });

        // Add selection counter to description
        const counterSpan = this.createElement('span', ['dialog-counter']);
        this._updateCounter(counterSpan);
        description.appendChild(document.createElement('br'));
        description.appendChild(counterSpan);
        this.element.appendChild(description);

        // Dialog content
        const content = this.createElement('div', ['dialog-content']);

        if (this.availableActions.length === 0) {
            const emptyMessage = this.createElement('p', ['dialog-empty-message']);
            emptyMessage.textContent = game.i18n.localize(`${MODULE_ID}.CPR.NoActionsAvailable`);
            emptyMessage.style.textAlign = 'center';
            emptyMessage.style.color = 'var(--bg3-text, #ddd)';
            content.appendChild(emptyMessage);
        } else {
            // Create item rows (same pattern as SelectionDialog)
            for (const action of this.availableActions) {
                const row = this._createActionRow(action);
                content.appendChild(row);
            }
        }

        this.element.appendChild(content);

        // Dialog footer with buttons
        const footer = this.createElement('div', ['dialog-footer']);

        const cancelBtn = this.createElement('button', ['dialog-button', 'dialog-button-secondary']);
        cancelBtn.innerHTML = '<i class="fas fa-times"></i> ' + game.i18n.localize('Cancel');
        this.addEventListener(cancelBtn, 'click', () => this._onCancel());

        const saveBtn = this.createElement('button', ['dialog-button', 'dialog-button-primary']);
        saveBtn.innerHTML = '<i class="fas fa-save"></i> ' + game.i18n.localize('Save');
        this.addEventListener(saveBtn, 'click', () => this._onConfirm());

        footer.appendChild(cancelBtn);
        footer.appendChild(saveBtn);
        this.element.appendChild(footer);

        // Add dialog directly to body
        document.body.appendChild(this.element);

        // Close on Escape key
        this.addEventListener(document, 'keydown', (event) => {
            if (event.key === 'Escape') {
                this._onCancel();
            }
        });
    }

    /**
     * Create an action row (matches SelectionDialog .dialog-item-row pattern)
     * @param {Object} action - Action data {id, uuid, name, img}
     * @returns {HTMLElement}
     * @private
     */
    _createActionRow(action) {
        const row = this.createElement('div', ['dialog-item-row']);
        row.dataset.itemId = action.uuid;

        // Checkbox
        const checkbox = this.createElement('input', ['dialog-checkbox']);
        checkbox.type = 'checkbox';
        checkbox.checked = this.selectedActions.has(action.uuid);
        checkbox.dataset.itemId = action.uuid;
        checkbox.disabled = !checkbox.checked && this.selectedActions.size >= MAX_SELECTIONS;

        // Icon
        const icon = this.createElement('img', ['dialog-item-icon']);
        icon.src = action.img;
        icon.alt = action.name;

        // Label
        const label = this.createElement('span', ['dialog-item-label']);
        label.textContent = action.name;

        // Handle row click (toggle checkbox)
        this.addEventListener(row, 'click', (event) => {
            // Don't toggle if clicking directly on checkbox or if disabled
            if (event.target !== checkbox && !checkbox.disabled) {
                checkbox.checked = !checkbox.checked;
                this._onCheckboxChange(checkbox, action.uuid);
            }
        });

        // Handle checkbox change
        this.addEventListener(checkbox, 'change', () => {
            this._onCheckboxChange(checkbox, action.uuid);
        });

        row.appendChild(checkbox);
        row.appendChild(icon);
        row.appendChild(label);

        return row;
    }

    /**
     * Handle checkbox change
     * @param {HTMLInputElement} checkbox - The checkbox element
     * @param {string} uuid - Action UUID
     * @private
     */
    _onCheckboxChange(checkbox, uuid) {
        if (checkbox.checked) {
            if (this.selectedActions.size < MAX_SELECTIONS) {
                this.selectedActions.add(uuid);
            } else {
                checkbox.checked = false;
                ui.notifications.warn(
                    game.i18n.format(`${MODULE_ID}.CPR.MaxSelectionsReached`, { max: MAX_SELECTIONS })
                );
            }
        } else {
            this.selectedActions.delete(uuid);
        }

        // Update disabled state of all checkboxes
        const allCheckboxes = this.element.querySelectorAll('.dialog-checkbox');
        allCheckboxes.forEach((cb) => {
            cb.disabled = !cb.checked && this.selectedActions.size >= MAX_SELECTIONS;
        });

        // Update counter
        const counter = this.element.querySelector('.dialog-counter');
        if (counter) this._updateCounter(counter);
    }

    /**
     * Update selection counter
     * @param {HTMLElement} counter - Counter element
     * @private
     */
    _updateCounter(counter) {
        const count = this.selectedActions.size;
        counter.textContent = game.i18n.format(`${MODULE_ID}.CPR.SelectionCounter`, {
            current: count,
            max: MAX_SELECTIONS
        });
    }

    /**
     * Handle confirm button click
     * @private
     */
    _onConfirm() {
        const selected = Array.from(this.selectedActions);
        this.close();
        if (this.resolve) {
            this.resolve(selected);
        }
    }

    /**
     * Handle cancel button click
     * @private
     */
    _onCancel() {
        this.close();
        if (this.resolve) {
            this.resolve(null);
        }
    }

    /**
     * Close and cleanup the dialog
     */
    close() {
        // Remove dialog from DOM
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        // Then destroy component (cleans up event listeners)
        this.destroy();
    }

    /**
     * Destroy the dialog
     */
    destroy() {
        // Clean up event listeners
        super.destroy();
        // Clear references
        this.element = null;
    }
}
