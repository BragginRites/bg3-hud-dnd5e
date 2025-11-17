/**
 * Rest Dialog
 * Allows player to choose between Short Rest and Long Rest
 * Uses BG3 HUD dialog styling
 */
export class RestDialog extends foundry.applications.api.ApplicationV2 {
    constructor(options = {}) {
        super(options);
        this.actor = options.actor;
    }

    static DEFAULT_OPTIONS = {
        id: 'bg3-rest-dialog',
        classes: ['bg3-dialog-overlay'],
        tag: 'div',
        window: {
            frame: false,
            positioned: false
        },
        position: {
            width: 'auto',
            height: 'auto'
        }
    };

    /**
     * Render the dialog HTML
     */
    async _renderHTML(context, options) {
        const dialog = document.createElement('div');
        dialog.className = 'bg3-dialog';

        // Title
        const title = document.createElement('h2');
        title.className = 'bg3-dialog-title';
        title.textContent = game.i18n.localize('BG3HUD.Rest');
        dialog.appendChild(title);

        // Content
        const content = document.createElement('div');
        content.className = 'bg3-dialog-content';
        
        const description = document.createElement('p');
        description.textContent = game.i18n.localize('BG3HUD.ChooseRestType');
        description.style.marginBottom = '1rem';
        description.style.textAlign = 'center';
        content.appendChild(description);

        dialog.appendChild(content);

        // Buttons
        const buttons = document.createElement('div');
        buttons.className = 'bg3-dialog-buttons';

        // Short Rest button
        const shortRestBtn = document.createElement('button');
        shortRestBtn.className = 'bg3-button bg3-button-primary';
        shortRestBtn.innerHTML = '<i class="fas fa-campfire"></i> ' + game.i18n.localize('DND5E.ShortRest');
        shortRestBtn.addEventListener('click', async () => {
            await this.takeShortRest();
        });
        buttons.appendChild(shortRestBtn);

        // Long Rest button
        const longRestBtn = document.createElement('button');
        longRestBtn.className = 'bg3-button bg3-button-primary';
        longRestBtn.innerHTML = '<i class="fas fa-tent"></i> ' + game.i18n.localize('DND5E.LongRest');
        longRestBtn.addEventListener('click', async () => {
            await this.takeLongRest();
        });
        buttons.appendChild(longRestBtn);

        // Cancel button
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'bg3-button bg3-button-secondary';
        cancelBtn.textContent = game.i18n.localize('Cancel');
        cancelBtn.addEventListener('click', () => {
            this.close();
        });
        buttons.appendChild(cancelBtn);

        dialog.appendChild(buttons);

        return dialog;
    }

    /**
     * Replace HTML (required by ApplicationV2)
     */
    _replaceHTML(result, content, options) {
        content.replaceChildren(result);
    }

    /**
     * Take a short rest
     */
    async takeShortRest() {
        if (this.actor && typeof this.actor.shortRest === 'function') {
            // Close dialog and take rest immediately (non-blocking)
            this.close();
            await this.actor.shortRest();
        } else {
            ui.notifications.error('Short rest not available for this actor');
        }
    }

    /**
     * Take a long rest
     */
    async takeLongRest() {
        if (this.actor && typeof this.actor.longRest === 'function') {
            // Close dialog and take rest immediately (non-blocking)
            this.close();
            await this.actor.longRest();
        } else {
            ui.notifications.error('Long rest not available for this actor');
        }
    }

    /**
     * Handle closing the dialog
     */
    async close(options = {}) {
        // Immediately hide to prevent animation issues
        if (this.element) {
            this.element.style.display = 'none';
        }
        await super.close(options);
    }
}

