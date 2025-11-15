import { MenuBuilder } from '/modules/bg3-hud-core/scripts/components/ui/MenuBuilder.js';

/**
 * D&D 5e Menu Builder
 * Provides D&D 5e specific menu items for portrait, abilities, settings, and lock menus
 */
export class DnD5eMenuBuilder extends MenuBuilder {
    /**
     * Build portrait menu items for D&D 5e
     * @param {PortraitContainer} portraitContainer - The portrait container instance
     * @param {MouseEvent} event - The triggering event
     * @returns {Promise<Array>} Menu items array
     */
    async buildPortraitMenu(portraitContainer, event) {
        // Check if container has the necessary properties/methods
        const useTokenImage = portraitContainer.useTokenImage ?? false;

        const items = [];

        // Token image option
        items.push({
            key: 'token',
            label: 'Use Token Image',
            icon: 'fas fa-chess-pawn',
            onClick: async () => {
                if (!useTokenImage) {
                    await portraitContainer.updateImagePreference?.();
                }
            }
        });

        // Character portrait option
        items.push({
            key: 'portrait',
            label: 'Use Character Portrait',
            icon: 'fas fa-user',
            onClick: async () => {
                if (useTokenImage) {
                    await portraitContainer.updateImagePreference?.();
                }
            }
        });

        return items;
    }

    /**
     * Build ability menu items for D&D 5e
     * Creates ability menu with submenus for saves and skills
     * @param {AbilityContainer} abilityContainer - The ability container instance
     * @param {MouseEvent} event - The triggering event
     * @returns {Promise<Array>} Menu items array
     */
    async buildAbilityMenu(abilityContainer, event) {
        // If container has getMenuData(), use it and convert
        if (typeof abilityContainer.getMenuData === 'function') {
            const menuData = abilityContainer.getMenuData();
            if (menuData && menuData.buttons) {
                return this.toMenuItems(menuData.buttons);
            }
        }

        // Otherwise, build menu from abilities
        const abilities = abilityContainer.getAbilities?.() || CONFIG.DND5E?.abilities || {};
        const items = [];

        for (const [key, ability] of Object.entries(abilities)) {
            const abilityMod = abilityContainer.getAbilityMod?.(key) || { value: '+0' };
            const saveMod = abilityContainer.getSaveMod?.(key) || { value: '+0' };
            const skills = abilityContainer.getSkillMod?.(key);

            // Create submenus
            const subMenus = [];

            // Save/Check submenu
            const saveCheckSubmenu = {
                buttons: {}
            };

            // Ability Check
            saveCheckSubmenu.buttons[`check${key.toUpperCase()}`] = {
                label: 'Check',
                icon: 'fas fa-dice-d20',
                value: abilityMod.value,
                style: abilityMod.style,
                click: (e) => {
                    e.stopPropagation();
                    const rollData = {
                        event: e,
                        advantage: e.altKey,
                        disadvantage: e.ctrlKey,
                        fastForward: e.shiftKey
                    };
                    if (abilityContainer.actor) {
                        if (abilityContainer.actor.rollAbilityCheck) {
                            abilityContainer.actor.rollAbilityCheck({
                                ability: key,
                                ...rollData
                            });
                        } else if (abilityContainer.actor.rollAbilityTest) {
                            abilityContainer.actor.rollAbilityTest(key, rollData);
                        }
                    }
                }
            };

            // Saving Throw
            saveCheckSubmenu.buttons[`save${key.toUpperCase()}`] = {
                label: 'Save',
                icon: 'fas fa-dice-d20',
                value: saveMod.value,
                style: saveMod.style,
                click: (e) => {
                    e.stopPropagation();
                    const rollData = {
                        event: e,
                        advantage: e.altKey,
                        disadvantage: e.ctrlKey,
                        fastForward: e.shiftKey
                    };
                    if (abilityContainer.actor) {
                        if (abilityContainer.actor.rollSavingThrow) {
                            abilityContainer.actor.rollSavingThrow({
                                ability: key,
                                ...rollData
                            });
                        } else if (abilityContainer.actor.rollAbilitySave) {
                            abilityContainer.actor.rollAbilitySave(key, rollData);
                        }
                    }
                }
            };

            subMenus.push(saveCheckSubmenu);

            // Skills submenu (if any)
            if (skills && Object.keys(skills).length > 0) {
                const skillsSubmenu = {
                    buttons: skills
                };
                subMenus.push(skillsSubmenu);
            }

            items.push({
                key: key,
                label: ability.label || key.toUpperCase(),
                value: abilityMod.value,
                valueStyle: abilityMod.style,
                class: 'ability-container',
                subMenu: subMenus.length > 0 ? subMenus : undefined
            });
        }

        return items;
    }

    /**
     * Build settings menu items for D&D 5e
     * Can add D&D 5e specific settings options
     * @param {ControlContainer} controlContainer - The control container instance
     * @param {MouseEvent} event - The triggering event
     * @returns {Promise<Array>} Menu items array
     */
    async buildSettingsMenu(controlContainer, event) {
        // Return empty array to use core settings menu
        // D&D 5e can add custom items here if needed
        return [];
    }

    /**
     * Build lock menu items for D&D 5e
     * Can add D&D 5e specific lock options
     * @param {ControlContainer} controlContainer - The control container instance
     * @param {MouseEvent} event - The triggering event
     * @returns {Promise<Array>} Menu items array
     */
    async buildLockMenu(controlContainer, event) {
        // Return empty array to use core lock menu
        // D&D 5e can add custom items here if needed
        return [];
    }
}

