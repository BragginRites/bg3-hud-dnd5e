import { InfoContainer } from '/modules/bg3-hud-core/scripts/components/containers/InfoContainer.js';

const MODULE_ID = 'bg3-hud-dnd5e';

/**
 * D&D 5e Info Container
 * Displays ability scores, skills, and saving throws
 */
export class DnD5eInfoContainer extends InfoContainer {
    constructor(options = {}) {
        super(options);
        this.selectedAbility = 'str'; // Default to Strength
    }

    /**
     * Render the D&D 5e specific content
     * @returns {Promise<HTMLElement>}
     */
    async renderContent() {
        const content = this.createElement('div', ['bg3-info-content']);

        // Left column: Skills (filtered to selected ability)
        const skillsColumn = await this.renderSkills();
        content.appendChild(skillsColumn);

        // Center column: Ability Scores (always visible)
        const abilitiesColumn = await this.renderAbilities();
        content.appendChild(abilitiesColumn);

        // Right column: Saving Throws (filtered to selected ability)
        const savesColumn = await this.renderSaves();
        content.appendChild(savesColumn);

        return content;
    }

    /**
     * Handle right-click on info button - roll initiative
     * @param {MouseEvent} event - The context menu event
     * @override
     */
    async onButtonRightClick(event) {
        if (!this.actor) {
            console.warn('DnD5e Info | No actor available for initiative roll');
            return;
        }

        try {
            // D&D5e v5+ initiative roll dialog
            if (typeof this.actor.rollInitiativeDialog === 'function') {
                // Use dialog method for v5+
                await this.actor.rollInitiativeDialog({
                    createCombatants: true,
                    rerollInitiative: true
                });
            } else if (typeof this.actor.rollInitiative === 'function') {
                // Fallback - try to force dialog by not passing event
                await this.actor.rollInitiative({ 
                    createCombatants: true,
                    rerollInitiative: true
                });
            }
        } catch (err) {
            console.error('DnD5e Info | Initiative roll failed', err);
            ui.notifications?.error(game.i18n.localize(`${MODULE_ID}.Notifications.FailedToRollInitiative`));
        }
    }

    /**
     * Handle ability click - expand to show skills and saves
     * @param {string} abilityId - The ability that was clicked
     * @private
     */
    async _onAbilityClick(abilityId) {
        // If clicking the same ability, collapse
        if (this.selectedAbility === abilityId) {
            this._resetExpanded();
            return;
        }
        
        this.selectedAbility = abilityId;
        
        // Re-render the panel content with filtered skills/saves
        await this.update();
    }

    /**
     * Reset expanded state (back to just abilities)
     * @private
     */
    async _resetExpanded() {
        this.selectedAbility = null;
        
        // Re-render to hide skills/saves
        await this.update();
    }

    /**
     * Render ability scores
     * @returns {Promise<HTMLElement>}
     * @private
     */
    async renderAbilities() {
        const column = this.createElement('div', ['bg3-info-abilities']);

        const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
        const abilityNames = {
            str: game.i18n.localize(`${MODULE_ID}.Info.Abilities.Strength`),
            dex: game.i18n.localize(`${MODULE_ID}.Info.Abilities.Dexterity`),
            con: game.i18n.localize(`${MODULE_ID}.Info.Abilities.Constitution`),
            int: game.i18n.localize(`${MODULE_ID}.Info.Abilities.Intelligence`),
            wis: game.i18n.localize(`${MODULE_ID}.Info.Abilities.Wisdom`),
            cha: game.i18n.localize(`${MODULE_ID}.Info.Abilities.Charisma`)
        };

        for (const abilityId of abilities) {
            const ability = this.actor.system.abilities[abilityId];
            const modifier = ability?.mod || 0;
            const score = ability?.value || 10;

            const abilityDiv = this.createElement('div', ['bg3-info-ability']);
            
            // Highlight selected ability
            if (abilityId === this.selectedAbility) {
                abilityDiv.classList.add('selected');
            }
            
            const nameSpan = this.createElement('span', ['bg3-info-ability-name']);
            nameSpan.textContent = abilityNames[abilityId];

            const scoreSpan = this.createElement('span', ['bg3-info-ability-score']);
            scoreSpan.textContent = score;

            const modifierSpan = this.createElement('span', ['bg3-info-ability-modifier']);
            if (modifier >= 0) {
                modifierSpan.classList.add('positive');
            }
            modifierSpan.textContent = modifier;

            // Click to expand and show related skills/saves
            this.addEventListener(abilityDiv, 'click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await this._onAbilityClick(abilityId);
            });
            
            // Right-click to roll ability check (v5+ only)
            this.addEventListener(abilityDiv, 'contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (!this.actor?.system?.abilities?.[abilityId]) {
                    console.warn('DnD5e Info | Ability data not ready', { abilityId });
                    return;
                }
                
                try {
                    // v5+ API - pass event and modifier keys
                    this.actor.rollAbilityCheck({
                        ability: abilityId,
                        event: e,
                        advantage: e.altKey,
                        disadvantage: e.ctrlKey,
                        fastForward: e.shiftKey
                    });
                } catch (err) {
                    console.error('DnD5e Info | Ability check roll failed', { abilityId, error: err });
                }
            });

            abilityDiv.appendChild(nameSpan);
            abilityDiv.appendChild(scoreSpan);
            abilityDiv.appendChild(modifierSpan);
            column.appendChild(abilityDiv);
        }

        return column;
    }

    /**
     * Render skills
     * @returns {Promise<HTMLElement>}
     * @private
     */
    async renderSkills() {
        const column = this.createElement('div', ['bg3-info-skills']);

        // Don't render any skills if no ability is selected
        if (!this.selectedAbility) {
            return column;
        }

        // Header
        const header = this.createElement('div', ['bg3-info-section-header']);
        header.textContent = game.i18n.localize(`${MODULE_ID}.Info.Skills`);
        column.appendChild(header);

        // Use system config for skills (supports custom skills and future changes)
        const skillsConfig = CONFIG.DND5E?.skills || {};

        for (const [skillId, skillConfig] of Object.entries(skillsConfig)) {
            // Get the skill's associated ability from system config
            const skillAbility = skillConfig.ability || this.actor.system.skills[skillId]?.ability;

            // Only show skills related to selected ability
            if (skillAbility !== this.selectedAbility) {
                continue;
            }

            const skill = this.actor.system.skills[skillId];
            const total = skill?.total || 0;

            const skillDiv = this.createElement('div', ['bg3-info-skill']);

            const nameSpan = this.createElement('span', ['bg3-info-skill-name']);
            // Use system's localized label
            nameSpan.textContent = skillConfig.label || skillId;

            // Add proficiency classes for border coloring
            const prof = skill?.value || 0;
            if (prof === 2) {
                skillDiv.classList.add('expertise');
            } else if (prof === 1) {
                skillDiv.classList.add('proficient');
            } else if (prof === 0.5) {
                skillDiv.classList.add('half-proficient');
            }

            const modifierSpan = this.createElement('span', ['bg3-info-skill-modifier']);
            if (total >= 0) {
                modifierSpan.classList.add('positive');
            }
            modifierSpan.textContent = total;

            // Click to roll skill (v5+ only)
            this.addEventListener(skillDiv, 'click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                if (!this.actor?.system?.skills?.[skillId]) {
                    console.warn('DnD5e Info | Skill data not ready', { skillId });
                    return;
                }

                try {
                    // v5+ API - pass event and modifier keys
                    this.actor.rollSkill({
                        skill: skillId,
                        event: e,
                        advantage: e.altKey,
                        disadvantage: e.ctrlKey,
                        fastForward: e.shiftKey
                    });
                } catch (err) {
                    console.error('DnD5e Info | Skill roll failed', { skillId, error: err });
                }
            });

            skillDiv.appendChild(nameSpan);
            skillDiv.appendChild(modifierSpan);
            column.appendChild(skillDiv);
        }

        return column;
    }

    /**
     * Render checks and saves
     * @returns {Promise<HTMLElement>}
     * @private
     */
    async renderSaves() {
        const column = this.createElement('div', ['bg3-info-saves']);

        // Don't render any checks/saves if no ability is selected
        if (!this.selectedAbility) {
            return column;
        }

        // Header
        const header = this.createElement('div', ['bg3-info-section-header']);
        header.textContent = game.i18n.localize(`${MODULE_ID}.Info.ChecksSaves`);
        column.appendChild(header);

        const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
        const abilityNames = {
            str: game.i18n.localize(`${MODULE_ID}.Info.Abilities.Strength`),
            dex: game.i18n.localize(`${MODULE_ID}.Info.Abilities.Dexterity`),
            con: game.i18n.localize(`${MODULE_ID}.Info.Abilities.Constitution`),
            int: game.i18n.localize(`${MODULE_ID}.Info.Abilities.Intelligence`),
            wis: game.i18n.localize(`${MODULE_ID}.Info.Abilities.Wisdom`),
            cha: game.i18n.localize(`${MODULE_ID}.Info.Abilities.Charisma`)
        };

        for (const abilityId of abilities) {
            const isSelected = abilityId === this.selectedAbility;
            const ability = this.actor.system.abilities[abilityId];

            // In dnd5e v5+, ability.save is an object with .value
            const saveRaw = ability?.save;
            const saveValue = typeof saveRaw === 'object' ? (saveRaw?.value ?? saveRaw?.mod ?? 0) : (saveRaw ?? 0);

            // Single row per ability: left-click = check, right-click = save
            const row = this.createElement('div', ['bg3-info-save']);

            // Add proficiency classes for border coloring
            const prof = ability?.proficient || 0;
            if (prof === 1) {
                row.classList.add('proficient');
            }

            const nameSpan = this.createElement('span', ['bg3-info-save-name']);
            nameSpan.textContent = abilityNames[abilityId];
            row.appendChild(nameSpan);

            const modSpan = this.createElement('span', ['bg3-info-save-modifier']);
            if (saveValue >= 0) {
                modSpan.classList.add('positive');
            }
            modSpan.textContent = saveValue;
            row.appendChild(modSpan);

            // Left-click → ability check
            this.addEventListener(row, 'click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                    this.actor.rollAbilityCheck({
                        ability: abilityId,
                        event: e,
                        advantage: e.altKey,
                        disadvantage: e.ctrlKey,
                        fastForward: e.shiftKey
                    });
                } catch (err) {
                    console.error('DnD5e Info | Ability check roll failed', { abilityId, error: err });
                }
            });

            // Right-click → saving throw
            this.addEventListener(row, 'contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                    this.actor.rollSavingThrow({
                        ability: abilityId,
                        event: e,
                        advantage: e.altKey,
                        disadvantage: e.ctrlKey,
                        fastForward: e.shiftKey
                    });
                } catch (err) {
                    console.error('DnD5e Info | Save roll failed', { abilityId, error: err });
                }
            });

            column.appendChild(row);
        }

        return column;
    }
}

