/**
 * CPR Actions Selection Dialog
 * Allows GMs to select up to 6 CPR Generic Actions from the appropriate CPRActions compendium
 * based on the D&D 5e rules version setting (2014/legacy or 2024/modern)
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
     * Render the dialog HTML
     * @private
     */
    _renderDialog() {
        // Create dialog container (non-blocking, no dimming)
        this.element = this.createElement('div', ['cpr-actions-selection-overlay']);
        
        // Create dialog box
        const dialogBox = this.createElement('div', ['bg3-dialog', 'cpr-actions-selection-dialog']);
        
        // Title
        const title = this.createElement('h2', ['bg3-dialog-title']);
        title.textContent = this.title;
        dialogBox.appendChild(title);

        // Description
        const description = this.createElement('p', ['bg3-dialog-description']);
        description.innerHTML = game.i18n.format(`${MODULE_ID}.CPR.SelectActionsDescription`, { max: MAX_SELECTIONS });
        dialogBox.appendChild(description);

        // Selection counter
        const counter = this.createElement('div', ['cpr-actions-counter']);
        this._updateCounter(counter);
        dialogBox.appendChild(counter);

        // Content area with action list
        const content = this.createElement('div', ['bg3-dialog-content', 'cpr-actions-list']);
        
        if (this.availableActions.length === 0) {
            const emptyMessage = this.createElement('p', ['cpr-actions-empty']);
            emptyMessage.textContent = game.i18n.localize(`${MODULE_ID}.CPR.NoActionsAvailable`);
            content.appendChild(emptyMessage);
        } else {
            // Create checkbox list
            const actionList = this.createElement('div', ['cpr-actions-checkbox-list']);
            
            for (const action of this.availableActions) {
                const item = this._createActionItem(action);
                actionList.appendChild(item);
            }
            
            content.appendChild(actionList);
        }
        
        dialogBox.appendChild(content);

        // Buttons
        const buttons = this.createElement('div', ['bg3-dialog-buttons']);
        
        const confirmButton = this.createElement('button', ['bg3-button', 'bg3-button-primary']);
        confirmButton.innerHTML = '<i class="fas fa-save"></i> ' + game.i18n.localize('Save');
        confirmButton.addEventListener('click', () => this._onConfirm());
        
        const cancelButton = this.createElement('button', ['bg3-button']);
        cancelButton.innerHTML = '<i class="fas fa-times"></i> ' + game.i18n.localize('Cancel');
        cancelButton.addEventListener('click', () => this._onCancel());
        
        buttons.appendChild(cancelButton);
        buttons.appendChild(confirmButton);
        dialogBox.appendChild(buttons);

        this.element.appendChild(dialogBox);
        
        // Add to DOM
        document.body.appendChild(this.element);

        // Prevent clicks on dialog from closing (only close on cancel button)
        dialogBox.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Close on Escape key
        this._escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this._onCancel();
            }
        };
        document.addEventListener('keydown', this._escapeHandler);
    }

    /**
     * Create an action item checkbox
     * @param {Object} action - Action data {id, uuid, name, img}
     * @returns {HTMLElement}
     * @private
     */
    _createActionItem(action) {
        const item = this.createElement('div', ['cpr-action-item']);
        
        const checkbox = this.createElement('input', ['cpr-action-checkbox']);
        checkbox.type = 'checkbox';
        checkbox.id = `cpr-action-${action.id}`;
        checkbox.value = action.uuid;
        checkbox.checked = this.selectedActions.has(action.uuid);
        checkbox.disabled = !checkbox.checked && this.selectedActions.size >= MAX_SELECTIONS;
        
        checkbox.addEventListener('change', (e) => {
            this._onCheckboxChange(e.target, action.uuid);
            const counter = this.element.querySelector('.cpr-actions-counter');
            if (counter) this._updateCounter(counter);
        });
        
        // Create icon container
        const iconContainer = this.createElement('div', ['cpr-action-icon']);
        const icon = this.createElement('img', ['cpr-action-icon-img']);
        icon.src = action.img;
        icon.alt = action.name;
        icon.width = 40;
        icon.height = 40;
        iconContainer.appendChild(icon);
        
        const label = this.createElement('label', ['cpr-action-label']);
        label.setAttribute('for', checkbox.id);
        label.textContent = action.name;
        
        item.appendChild(checkbox);
        item.appendChild(iconContainer);
        item.appendChild(label);
        
        return item;
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
        const allCheckboxes = this.element.querySelectorAll('.cpr-action-checkbox');
        allCheckboxes.forEach((cb) => {
            cb.disabled = !cb.checked && this.selectedActions.size >= MAX_SELECTIONS;
        });
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
        this._cleanup();
        if (this.resolve) {
            this.resolve(selected);
        }
    }

    /**
     * Handle cancel button click
     * @private
     */
    _onCancel() {
        this._cleanup();
        if (this.resolve) {
            this.resolve(null);
        }
    }

    /**
     * Cleanup dialog
     * @private
     */
    _cleanup() {
        if (this._escapeHandler) {
            document.removeEventListener('keydown', this._escapeHandler);
        }
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}


