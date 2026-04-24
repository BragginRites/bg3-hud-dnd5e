import { InfoContainer } from '/modules/bg3-hud-core/scripts/components/containers/InfoContainer.js';

const MODULE_ID = 'bg3-hud-dnd5e';

/**
 * Ability icon mapping (FontAwesome)
 */
const ABILITY_ICONS = {
  str: 'fas fa-fist-raised',
  dex: 'fas fa-running',
  con: 'fas fa-heart',
  int: 'fas fa-brain',
  wis: 'fas fa-eye',
  cha: 'fas fa-masks-theater'
};

/**
 * D&D 5e Info Container
 * Displays ability scores (header), skills (3-col grid), and saves (via header d20s)
 */
export class DnD5eInfoContainer extends InfoContainer {
  constructor(options = {}) {
    super(options);
  }

  /**
   * Render the D&D 5e specific content
   * @returns {Promise<HTMLElement>}
   */
  async renderContent() {
    const content = this.createElement('div', ['bg3-info-content']);

    // Top: Ability header row
    const header = await this.renderAbilitiesHeader();
    content.appendChild(header);

    // Bottom: Skills grid (3 columns)
    const skillsGrid = await this.renderSkills();
    content.appendChild(skillsGrid);

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
   * Render the ability scores header row
   * Each block: icon + short name, full name, large score, d20 with modifier
   * Left-click = ability check, Right-click = saving throw
   * @returns {Promise<HTMLElement>}
   * @private
   */
  async renderAbilitiesHeader() {
    const header = this.createElement('div', ['bg3-info-abilities-header']);

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
      const modifier = ability?.mod ?? 0;
      const score = ability?.value ?? 10;

      const block = this.createElement('div', ['bg3-info-ability-block']);

      // Row 1: short name
      const label = this.createElement('div', ['bg3-info-ability-label']);
      label.textContent = abilityId.toUpperCase();
      block.appendChild(label);

      // Row 2: large score
      const scoreEl = this.createElement('div', ['bg3-info-ability-score']);
      scoreEl.textContent = score;
      block.appendChild(scoreEl);

      // Row 3: d20 icon with modifier overlay
      const d20Wrapper = this.createElement('div', ['bg3-info-d20-modifier']);
      if (ability?.proficient === 1) {
        d20Wrapper.classList.add('proficient');
      }
      
      const d20Icon = this.createElement('i', ['fas', 'fa-dice-d20', 'bg3-d20-icon']);
      const d20Value = this.createElement('span', ['bg3-d20-value']);
      d20Value.textContent = modifier >= 0 ? `+${modifier}` : `${modifier}`;
      d20Wrapper.appendChild(d20Icon);
      d20Wrapper.appendChild(d20Value);
      block.appendChild(d20Wrapper);

      // Left-click → ability check
      this.addEventListener(block, 'click', (e) => {
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
      this.addEventListener(block, 'contextmenu', (e) => {
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

      // Tooltip
      const checkLabel = game.i18n.localize(`${MODULE_ID}.Info.CheckTooltip`);
      const saveLabel = game.i18n.localize(`${MODULE_ID}.Info.SaveTooltip`);
      block.setAttribute('data-tooltip', `${checkLabel} / ${saveLabel}`);
      block.setAttribute('data-tooltip-direction', 'UP');

      header.appendChild(block);
    }

    return header;
  }

  /**
   * Render all skills in a 3-column grid
   * Skills are fetched dynamically from CONFIG.DND5E.skills
   * @returns {Promise<HTMLElement>}
   * @private
   */
  async renderSkills() {
    const grid = this.createElement('div', ['bg3-info-skills-grid']);

    // Gather all skills from system config
    const skillsConfig = CONFIG.DND5E?.skills || {};
    const skillEntries = [];

    for (const [skillId, skillConfig] of Object.entries(skillsConfig)) {
      const skill = this.actor.system.skills[skillId];
      const total = skill?.total ?? 0;
      const prof = skill?.value ?? 0;
      const abilityKey = skillConfig.ability || skill?.ability || '';

      skillEntries.push({
        id: skillId,
        label: skillConfig.label || skillId,
        total,
        prof,
        abilityKey: abilityKey.toUpperCase()
      });
    }

    // Sort alphabetically by label
    skillEntries.sort((a, b) => a.label.localeCompare(b.label));

    // Split into 3 balanced columns
    const colCount = 3;
    const perCol = Math.ceil(skillEntries.length / colCount);

    for (let col = 0; col < colCount; col++) {
      const column = this.createElement('div', ['bg3-info-skills-column']);
      const start = col * perCol;
      const end = Math.min(start + perCol, skillEntries.length);

      for (let i = start; i < end; i++) {
        const entry = skillEntries[i];

        const skillDiv = this.createElement('div', ['bg3-info-skill']);

        // d20 Modifier
        const modifierWrapper = this.createElement('div', ['bg3-info-d20-modifier']);
        if (entry.prof === 2) {
          modifierWrapper.classList.add('expertise');
        } else if (entry.prof === 1) {
          modifierWrapper.classList.add('proficient');
        } else if (entry.prof === 0.5) {
          modifierWrapper.classList.add('half-proficient');
        }

        const d20Icon = this.createElement('i', ['fas', 'fa-dice-d20', 'bg3-d20-icon']);
        const d20Value = this.createElement('span', ['bg3-d20-value']);
        d20Value.textContent = entry.total >= 0 ? `+${entry.total}` : `${entry.total}`;
        modifierWrapper.appendChild(d20Icon);
        modifierWrapper.appendChild(d20Value);
        skillDiv.appendChild(modifierWrapper);

        // Skill name
        const nameSpan = this.createElement('span', ['bg3-info-skill-name']);
        nameSpan.textContent = entry.label;
        skillDiv.appendChild(nameSpan);

        // Ability abbreviation
        const abilitySpan = this.createElement('span', ['bg3-info-skill-ability']);
        abilitySpan.textContent = entry.abilityKey;
        skillDiv.appendChild(abilitySpan);

        // Click to roll skill
        const skillId = entry.id;
        this.addEventListener(skillDiv, 'click', (e) => {
          e.preventDefault();
          e.stopPropagation();

          if (!this.actor?.system?.skills?.[skillId]) {
            console.warn('DnD5e Info | Skill data not ready', { skillId });
            return;
          }

          try {
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

        column.appendChild(skillDiv);
      }

      grid.appendChild(column);
    }

    return grid;
  }
}
