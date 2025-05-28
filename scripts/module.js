const MODULE_NAME = "bg3-hud-dnd5e";

Hooks.on("BG3HotbarInit", async (BG3Hotbar) => {
    const [BG3CONFIG, BG3UTILS] = BG3Hotbar.getConfig();

    BG3UTILS.check2Handed = function(item) {
        return !!item?.labels?.properties?.find(p => p.abbr === 'two');
    }

    BG3UTILS.itemIsPassive = function(item) {
        return item.type === "feat" && ((item.system?.activities?.size === 0) || !(item.system?.activation?.type && (item.system?.activation?.type !== "none" && item.system?.activation?.type !== "passive")));
    }

    class DND5EAbilityContainer extends CONFIG.BG3HUD.COMPONENTS.PORTRAIT.ABILITY {
        constructor(data) {
            super(data);
        }

        getInitMethod() {
            return this.actor.rollInitiativeDialog.bind(this.actor);
        }

        saveRoll(event) {
            event.stopPropagation();
            const parent = event.target.closest('.ability-container');
            try {
                if(this.actor.rollSavingThrow) {
                    this.actor.rollSavingThrow({
                        ability: parent.dataset.key,
                        event: event,
                        advantage: event.altKey,
                        disadvantage: event.ctrlKey,
                        fastForward: event.shiftKey
                    });
                } else if(this.actor.rollAbilitySave) {
                    this.actor.rollAbilitySave(
                        parent.dataset.key, {
                            event: event,
                            advantage: event.altKey,
                            disadvantage: event.ctrlKey,
                            fastForward: event.shiftKey
                        }
                    )
                }
                
                // this.element.querySelectorAll('.bg3-menu-container').forEach(e => e.classList.add('hidden'));
            } catch (error) {
                ui.notifications.error(`Error rolling ${parent.dataset.key.toUpperCase()} save. See console for details.`);
            }
        }

        checkRoll(event) {
            event.stopPropagation();
            const parent = event.target.closest('.ability-container');
            try {
                if(this.actor.rollAbilityCheck) {
                    this.actor.rollAbilityCheck({
                        ability: parent.dataset.key,
                        event: event,
                        advantage: event.altKey,
                        disadvantage: event.ctrlKey,
                        fastForward: event.shiftKey
                    });
                } else if(this.actor.rollAbilityTest) {
                    this.actor.rollAbilityTest(
                        parent.dataset.key, {
                            event: event,
                            advantage: event.altKey,
                            disadvantage: event.ctrlKey,
                            fastForward: event.shiftKey
                        }
                    )
                }
                // this.element.querySelectorAll('.bg3-menu-container').forEach(e => e.classList.add('hidden'));
            } catch (error) {
                ui.notifications.error(`Error rolling ${parent.dataset.key.toUpperCase()} save. See console for details.`);
            }
        }

        getProfColor(proficient) {
            return proficient === 1 ?  'color: #3498db' : '';
        }

        getSaveMod(key) {
            const abilityScore = this.actor.system.abilities?.[key] || { value: 10, proficient: false, save: {value: 0} },
                mod = abilityScore.save?.value ?? abilityScore.save ?? 0,
                modString = mod >= 0 ? `+${mod}` : mod.toString();
            return {value: modString, style: this.getProfColor(abilityScore.proficient)};
        }

        getAbilityMod(key) {
            let mod = 0,
                modString = '';
            const abilityScore = this.actor.system.abilities?.[key] || { value: 10, proficient: false };
            mod = abilityScore?.mod ?? 0;
            modString = mod >= 0 ? `+${mod}` : mod.toString();
            return {value: modString, style: this.getProfColor(abilityScore?.proficient)};
        };

        skillRoll(event) {
            event.stopPropagation();
            const parent = event.target.closest('[data-key]');
            try {
                this.actor.rollSkill({
                    skill: parent.dataset.key,
                    event: event,
                    advantage: event.altKey,
                    disadvantage: event.ctrlKey,
                    fastForward: event.shiftKey
                });
            } catch (error) {
                ui.notifications.error(`Error rolling ${parent.dataset.key.toUpperCase()} save. See console for details.`);
            }
        };

        getSkillMod(key) {
            const skills = {};
            let count = 0;
            Object.entries(CONFIG.DND5E.skills).forEach(([k, v]) => {
                if(v.ability !== key) return;
                count++;
                const skill = this.actor.system.skills?.[k] || { proficient: false },
                    mod = skill.total ?? 0,
                    modStr = mod >= 0 ? `+${mod}` : mod.toString();
                skills[k] = {label:  v.label, icon: 'fas fa-dice-d20', value: modStr, style: this.getProfColor(skill?.proficient), click: this.skillRoll}
            });
            return count > 0 ? skills : null;
        };

        getMenuBtns() {
            const btns = {};
            for(const abl in CONFIG.DND5E.abilities) {
                const abilityMod = this.getAbilityMod(abl);
                btns[abl] = {
                    ...{
                        label: CONFIG.DND5E.abilities[abl].label,
                        class: 'ability-container'
                    },
                    ...abilityMod,
                    subMenu: [
                        {
                            position: 'topright', name: 'saveMenu', event: 'click', 
                            buttons: {
                                [`check${abl.toUpperCase()}`]: {...{label: 'Check', icon: 'fas fa-dice-d20', click: this.checkRoll}, ...abilityMod},
                                [`save${abl.toUpperCase()}`]: {...{label: 'Save', icon: 'fas fa-dice-d20', click: this.saveRoll}, ...this.getSaveMod(abl)}
                            }
                        },
                        {
                            position: 'topleft', name: 'skillMenu', event: 'click',
                            buttons: this.getSkillMod(abl)
                        }
                    ]
                }
            };
            return btns;
        }
    }

    class DND5EDeathSavesContainer extends CONFIG.BG3HUD.COMPONENTS.PORTRAIT.DEATH {
        constructor(data) {
            super(data);
        }

        getData() {
            return {
                display: game.settings.get(BG3CONFIG.MODULE_NAME, 'showDeathSavingThrow'), 
                data1: {
                    value: this.actor.system.attributes.death.success ?? 0,
                    max: 3,
                    update: async (value) => {
                        await this.actor.update({
                            'system.attributes.death.success': value
                        });
                    }
                },
                data2: {
                    value: this.actor.system.attributes.death.failure ?? 0,
                    max: 3,
                    update: async (value) => {
                        await this.actor.update({
                            'system.attributes.death.failure': value
                        });
                    }
                }
            };
        }

        isVisible() {
            if (!this.actor || this.actor.type !== 'character' || game.settings.get(BG3CONFIG.MODULE_NAME, 'showDeathSavingThrow') === 'hide') return false;
            // Get current HP and death saves state
            const currentHP = this.actor.system.attributes?.hp?.value || 0;

            return currentHP <= 0;
        }

        async skullClick(event) {
            event.preventDefault();
            event.stopPropagation();
            // Get current death save count before the roll
            const currentSuccesses = this.actor.system.attributes.death.success || 0;

            try {
                // Determine roll mode based on modifiers
                let rollMode = "roll";
                if (event.altKey) rollMode = "advantage";
                if (event.ctrlKey) rollMode = "disadvantage";
                if (event.shiftKey) rollMode = "gmroll";

                // Roll the death save with the appropriate mode
                const roll = await this.actor.rollDeathSave({
                    event: event,  // Pass the original event
                    advantage: event.altKey,
                    disadvantage: event.ctrlKey,
                    fastForward: event.shiftKey
                });
                
                if(!roll) return;
                this.setVisibility();
            } catch (error) {
                console.error("Error during death save roll:", error);
            }
        }
    }

    class DND5ERestTurnContainer extends CONFIG.BG3HUD.COMPONENTS.RESTTURN {
        constructor(data) {
            super(data);
        }

        async getRestBtns() {
            const btnData = [];
            if(this.actor) {
                btnData.push(
                    {
                        type: 'div',
                        class: ["rest-turn-button"],
                        label: 'Short Rest',
                        icon: "fa-campfire",
                        visible: () => !game.combat?.started,
                        events: {
                            'click': this.actor.shortRest.bind(this.actor)
                        }
                    },
                    {
                        type: 'div',
                        class: ["rest-turn-button"],
                        label: 'Long Rest',
                        icon: "fa-tent",
                        visible: () => !game.combat?.started,
                        events: {
                            'click': this.actor.longRest.bind(this.actor)
                        }
                    }
                )
            };
            return btnData;
        }
    }

    class DND5EAdvContainer extends CONFIG.BG3HUD.COMPONENTS.ADVANTAGE {
        constructor(data) {
            super(data);
        }

        isVisible() {
            console.log('DND5E: isVisible')
            return game.modules.get("midi-qol")?.active && game.settings.get(MODULE_NAME, 'addAdvBtnsMidiQoL');
        }
        
        getBtnData() {
            return [
                {
                    type: 'div',
                    key: 'advBtn',
                    title: 'Left-click to set Advantage to roll once.<br>Right-click to toggle.',
                    label: 'ADV',
                    events: {
                        'mouseup': this.setState.bind(this),
                    }
                },
                {
                    type: 'div',
                    key: 'disBtn',
                    title: 'Left-click to set Disadvantage to roll once.<br>Right-click to toggle.',
                    label: 'DIS',
                    events: {
                        'mouseup': this.setState.bind(this),
                    }
                }
            ];
        }
    }

    class DND5EFilterContainer extends CONFIG.BG3HUD.COMPONENTS.HOTBAR.FILTER {
        constructor(data) {
            super(data);
        }

        get filterData() {
            const filterData = [
                {
                    id: 'action',
                    label: 'Action',
                    symbol: 'fa-circle',
                    class: ['action-type-button'],
                    color: BG3CONFIG.COLORS.ACTION
                },
                {
                    id: 'bonus',
                    label: 'Bonus Action',
                    symbol: 'fa-triangle',
                    class: ['action-type-button'],
                    color: BG3CONFIG.COLORS.BONUS
                },
                {
                    id: 'reaction',
                    label: 'Reaction',
                    symbol: 'fa-sparkle',
                    class: ['action-type-button'],
                    color: BG3CONFIG.COLORS.REACTION
                },
                {
                    id: 'feature',
                    label: 'Feature',
                    symbol: 'fa-star',
                    class: ['action-type-button'],
                    color: BG3CONFIG.COLORS.FEATURE_HIGHLIGHT
                }
            ]

            // Add cantrip spell
            let cantrips = this.actor.items.filter(i => i.type==="spell" && i.system.level===0)
            if(cantrips.length) {
            filterData.push({
                id: 'spell',
                label: 'Cantrip',
                level: 0,
                max: 1,
                value: 1,
                class: ['spell-level-button', 'spell-cantrip-box'],
                color: BG3CONFIG.COLORS.SPELL_SLOT
            });
            }

            // Then add regular spell levels
            for (let level = 1; level <= 9; level++) {
                const spellLevelKey = `spell${level}`;
                const spellLevel = this.actor.system.spells?.[spellLevelKey];
                
                if (spellLevel?.max > 0) {
                    filterData.push({
                        id: 'spell',
                        label: 'Spell Level',
                        level: level,
                        value: spellLevel.value,
                        max: spellLevel.max,
                        short: this._getRomanNumeral(level),
                        class: ['spell-level-button'],
                        color: BG3CONFIG.COLORS.SPELL_SLOT
                    });
                }
            }

            // Add pact magic if it exists
            const pactMagic = this.actor.system.spells?.pact;
            if (pactMagic?.max > 0) {
                filterData.push({
                    id: 'spell',
                    // isPact: true,
                    preparationMode: 'pact',
                    label: 'Pact Magic',
                    short: 'P',
                    max: pactMagic.max,
                    value: pactMagic.value,
                    class: ['spell-level-button', 'spell-pact-box'],
                    color: BG3CONFIG.COLORS.PACT_MAGIC
                });
            }

            // Add apothecary magic from SCGD if it exists
            const apothecaryMagic = this.actor.system.spells?.apothecary;
            if (apothecaryMagic?.max > 0) {
                filterData.push({
                    id: 'spell',
                    // isApothecary: true,
                    preparationMode: 'apothecary',
                    label: 'Apothecary Magic',
                    short: 'A',
                    max: apothecaryMagic.max,
                    value: apothecaryMagic.value,
                    class: ['spell-level-button', 'spell-apothecary-box'],
                    color: BG3CONFIG.COLORS.APOTHECARY_MAGIC
                });
            }

            return filterData;
        }

        _autoCheckUsed() {
            // effect._id === "dnd5ebonusaction"
            // effect._id === "dnd5ereaction000"
            if(!game.settings.settings.get(MODULE_NAME + '.synchroBRMidiQoL') || !game.settings.get(MODULE_NAME,'synchroBRMidiQoL') || !ui.BG3HOTBAR.components.container.components.activeContainer) return;

            const bonusFilter = this.components.find(f => f.data.id === 'bonus'),
                reactionFilter = this.components.find(f => f.data.id === 'reaction');

            if((ui.BG3HOTBAR.components.container.components.activeContainer.activesList.find(a => a._id === 'dnd5ebonusaction') && !this.used.includes(bonusFilter)) || (!ui.BG3HOTBAR.components.container.components.activeContainer.activesList.find(a => a._id === 'dnd5ebonusaction') && this.used.includes(bonusFilter))) this.used = bonusFilter;

            if((ui.BG3HOTBAR.components.container.components.activeContainer.activesList.find(a => a._id === 'dnd5ereaction000') && !this.used.includes(reactionFilter)) || (!ui.BG3HOTBAR.components.container.components.activeContainer.activesList.find(a => a._id === 'dnd5ereaction000') && this.used.includes(reactionFilter))) this.used = reactionFilter;
        }
    }

    class DND5EWeaponContainer extends CONFIG.BG3HUD.COMPONENTS.WEAPON {
        constructor(data) {
            super(data);
        }

        async autoEquipWeapons(c) {
            const weaponsList = this.actor.items.filter(w => w.type == 'weapon'),
                compareOld = c.index === this.activeSet ? c.oldWeapons : this.components.weapon[this.activeSet].data.items;
            let toUpdate = [];
            weaponsList.forEach(w => {
                if(w.system.equipped && !Object.values(c.data.items).find(wc => wc?.uuid && w.id === wc.uuid.split('.').pop())) {
                    toUpdate.push({_id: w.id, "system.equipped": 0});
                } else if(!w.system.equipped && Object.values(c.data.items).find(wc => wc?.uuid && w.id === wc.uuid.split('.').pop())) {
                    toUpdate.push({_id: w.id, "system.equipped": 1});
                }
            });
            Object.values(c.data.items).forEach(nw => {
                if(!nw?.uuid) return;
                const itemId = nw.uuid.split('.').pop(),
                    item = this.actor.items.get(itemId);
                if(item && item.type !== 'weapon' && !item.system.equipped) toUpdate.push({_id: itemId, "system.equipped": 1});
            });
            if(compareOld) {
                Object.values(compareOld).forEach(ow => {
                    if(!ow?.uuid) return;
                    const itemId = ow.uuid.split('.').pop(),
                        item = this.actor.items.get(itemId);
                    if(item && item.type !== 'weapon' && item.system.equipped && !Object.values(c.data.items).find(w => w.uuid === ow.uuid)) toUpdate.push({_id: itemId, "system.equipped": 0});
                });
            }
            
            // Update active set & equipped items
            c.oldWeapons = foundry.utils.deepClone(c.data.items);
            if(toUpdate.length) {
                for(const update of toUpdate) {
                    const item = this.actor.items.get(update._id);
                    if(item) item.updateSource({"system.equipped": update["system.equipped"]})
                }
            }
        }
    }

    class DND5ECPRActionsDialog extends CONFIG.BG3HUD.DIALOGS.CPR {
        constructor () {
            super();
        }

        async getData() {
            const cprs = game.packs.get("chris-premades.CPRActions");
            return {actions: cprs.index, selected: game.settings.get(BG3CONFIG.MODULE_NAME, 'choosenCPRActions').filter(i => cprs.index.get(i))};
        }
    }
    
    class DND5EBG3TooltipManager extends CONFIG.BG3HUD.MANAGERS.TOOLTIP {
        constructor() {
            super();
        }

        _init() {
            super._init();
            
            BG3UTILS.patchFunc("game.dnd5e.dataModels.ItemDataModel.prototype.getCardData", async function (wrapped, { activity, ...enrichmentOptions }={}) {
                const context = await wrapped.call(this);
                if(context.labels?.damages?.length) {
                    let textDamage = '';
                    const rollData = (activity ?? this.parent).getRollData();
                    for(let i = 0; i < context.labels.damages.length; i++) {
                        // [[/damage {{damage.formula}}{{#if damage.damageType}} type={{damage.damageType}}{{/if}}]]
                        textDamage += `[[/damage ${context.labels.damages[i].formula}${context.labels.damages[i].damageType ? ` type=${context.labels.damages[i].damageType}` : ''}]]`;
                        if(i < context.labels.damages.length - 1) textDamage += ' | ';
                    }
                    context.enrichDamage = {
                        value: await TextEditor.enrichHTML(textDamage ?? "", {
                            rollData, relativeTo: this.parent, ...enrichmentOptions
                        })
                    }
                }
                if(!this.hasOwnProperty('identified') && this.hasLimitedUses) context.uses = this.uses;
                return context;
            }, "MIXED");
            game.dnd5e.dataModels.ItemDataModel.ITEM_TOOLTIP_TEMPLATE = `modules/${MODULE_NAME}/templates/tooltips/item-tooltip.hbs`;
            if(game.settings.get(BG3CONFIG.MODULE_NAME, 'showDamageRanges')) this._tooltipRangeDamage();
            // Add Tooltip to Activity
            if(game.dnd5e.dataModels.activity) {
                game.dnd5e.dataModels.activity.BaseActivityData.ACTIVITY_TOOLTIP_TEMPLATE = `modules/${MODULE_NAME}/templates/tooltips/activity-tooltip.hbs`;
                game.dnd5e.dataModels.activity.BaseActivityData.prototype.richTooltip = async function (enrichmentOptions={}) {
                    return {
                        content: await renderTemplate(
                        this.constructor.ACTIVITY_TOOLTIP_TEMPLATE, await this.getCardData(enrichmentOptions)
                        ),
                        classes: ["dnd5e2", "dnd5e-tooltip", "item-tooltip"]
                    };
                }    
                game.dnd5e.dataModels.activity.BaseActivityData.prototype.getDataParent = function (property) {
                    return this[property] ?? this.parent?.parent[property] ?? this.parent[property];
                }        
                game.dnd5e.dataModels.activity.BaseActivityData.prototype.getCardData = async function ({ activity, ...enrichmentOptions }={}) {
                    const { name, type, img } = this;
                    const isIdentified = this.identified !== false || this.parent?.parent.identified !== false || this.parent.identified !== false;
                    const context = {
                        name, type, img,
                        labels: foundry.utils.deepClone(this.getDataParent('labels')),
                        config: CONFIG.DND5E,
                        controlHints: game.settings.get("dnd5e", "controlHints"),
                        description: {
                            value: await TextEditor.enrichHTML(this.description?.chatFlavor ?? "", {
                                rollData: this.getRollData(), relativeTo: this, ...enrichmentOptions
                            })
                        },
                        uses: (this.hasLimitedUses || this.parent?.parent.hasLimitedUses || this.parent.hasLimitedUses) && (game.user.isGM || this.parent?.parent.identified || this.parent.identified) ? this.getDataParent('uses') : null,
                        materials: this.getDataParent('materials'),
                        tags: this.labels?.components?.tags ?? this.parent?.parent?.labels?.components?.tags ?? this.parent.labels?.components?.tags,
                        isSpell : this.getDataParent('isSpell'),
                        parentType: this.parent?.parent.type ?? this.parent.type
                    }
                    if(context.isSpell && !context.labels.components) {
                        context.labels.components = this.parent?.parent.labels.components ?? this.parent.labels.components;
                    }
                    if(context.labels?.damage?.length) {
                        let textDamage = '';
                        const rollData = (activity ?? this.parent).getRollData();
                        for(let i = 0; i < context.labels.damage.length; i++) {
                            // [[/damage {{damage.formula}}{{#if damage.damageType}} type={{damage.damageType}}{{/if}}]]
                            textDamage += `[[/damage ${context.labels.damage[i].formula}${context.labels.damage[i].damageType ? ` type=${context.labels.damage[i].damageType}` : ''}]]`;
                            if(i < context.labels.damage.length - 1) textDamage += ' | ';
                        }
                        context.enrichDamage = {
                            value: await TextEditor.enrichHTML(textDamage ?? "", {
                                rollData, relativeTo: this.parent, ...enrichmentOptions
                            })
                        }
                    }
                    context.properties = [];
                    if ( game.user.isGM || isIdentified ) {
                        context.properties.push(
                            ...Object.values((this.activationLabels ? this.activationLabels : (this.parent?.parent.labels?.activations?.[0] ? this.parent?.parent.labels?.activations?.[0] : this.parent.labels?.activations?.[0])) ?? {})
                        );
                    }
                    context.properties = context.properties.filter(_ => _);
                    context.hasProperties = context.tags?.length || context.properties.length;
                    
                    return context;
                }
            }

            const oldActivate = dnd5e.tooltips._onHoverContentLink;
            dnd5e.tooltips._onHoverContentLink = async function(doc) {
                if(!doc.MACRO_TOOLTIP_TEMPLATE) doc.MACRO_TOOLTIP_TEMPLATE = `modules/${BG3CONFIG.MODULE_NAME}/templates/tooltips/macro-tooltip.hbs`;
                if(!doc.richTooltip) doc.richTooltip = async function(enrichmentOptions={}) {
                    return {
                        content: await renderTemplate(
                            this.MACRO_TOOLTIP_TEMPLATE, await this.getCardData(enrichmentOptions)
                        ),
                        classes: ["dnd5e2", "dnd5e-tooltip", "item-tooltip"]
                    };
                };
                if(!doc.getCardData) doc.getCardData = async function({ activity, ...enrichmentOptions }={}) {
                    const { name, type, img = 'icons/svg/book.svg' } = this;
                    const context = {
                        name, type, img,
                        config: CONFIG.DND5E,
                        controlHints: game.settings.get("dnd5e", "controlHints")
                    }
                    return context;
                };
                oldActivate.bind(this)(doc);
            }

            const rollEvents = ["dnd5e.preRollAttackV2", "dnd5e.preRollSavingThrowV2", "dnd5e.preRollSkillV2", "dnd5e.preRollAbilityCheckV2", "dnd5e.preRollConcentrationV2", "dnd5e.preRollDeathSaveV2", "dnd5e.preRollToolV2"];
            for(const event of rollEvents) Hooks.on(event, (rollConfig, dialogConfig, messageConfig) => {
                if(!game.modules.get("midi-qol")?.active || !game.settings.get(MODULE_NAME, 'addAdvBtnsMidiQoL') || !ui.BG3HOTBAR.manager?.actor || ui.BG3HOTBAR.manager?.actor !== rollConfig.workflow?.actor) return;
                const state = ui.BG3HOTBAR.manager.actor.getFlag(BG3CONFIG.MODULE_NAME, "advState"),
                    once = ui.BG3HOTBAR.manager.actor.getFlag(BG3CONFIG.MODULE_NAME, "advOnce");
                if(state !== undefined) {
                    if(state === 'advBtn') rollConfig.advantage = true;
                    else if(state === 'disBtn') rollConfig.disadvantage = true;
                    if(once && !!ui.BG3HOTBAR.components.advantage) ui.BG3HOTBAR.components.advantage.setState(null);
                }
            });

            const partials = [
                `modules/${MODULE_NAME}/templates/tooltips/weapon-block.hbs`,
                `modules/${MODULE_NAME}/templates/tooltips/activity-tooltip.hbs`
            ];
        
            const paths = {};
            for ( const path of partials ) {
                paths[path.replace(".hbs", ".html")] = path;
                paths[`bg3hotbar.${path.split("/").pop().replace(".hbs", "")}`] = path;
            }
            loadTemplates(paths);
        }

        _saveEnrichers() {
            const stringNames = [
                "attack", "award", "check", "concentration", "damage", "heal", "healing", "item", "save", "skill", "tool"
            ],
            pattern = new RegExp(`\\[\\[/(?<type>${stringNames.join("|")})(?<config> .*?)?]](?!])(?:{(?<label>[^}]+)})?`, "gi");
            const enricher = this.enrichers.find(e => e.pattern.toString() == pattern.toString());
            if(enricher) this.savedEnrichers.damage = enricher.enricher;
        }

        _tooltipRangeDamage() {
            const stringNames = [
                "attack", "award", "check", "concentration", "damage", "heal", "healing", "item", "save", "skill", "tool"
            ],
            pattern = new RegExp(`\\[\\[/(?<type>${stringNames.join("|")})(?<config> .*?)?]](?!])(?:{(?<label>[^}]+)})?`, "gi"),
            damageEnricher = this.enrichers.find(e => e.pattern.toString() == pattern.toString());
            if(damageEnricher) {
                const prevEnricher = damageEnricher.enricher;
                damageEnricher.id = 'damageEnricher';
                damageEnricher.enricher = async function(match, options) {
                    const formatted = await prevEnricher(match, options);
                    let { type, config, label } = match.groups;
                    if(['damage', 'heal', 'healing'].includes(type)) {
                        const rollLink = formatted.querySelector('.roll-link');
                        if(rollLink) {
                            if(formatted.dataset.formulas) rollLink.innerHTML = rollLink.innerHTML.replace(formatted.dataset.formulas, await BG3UTILS.damageToRange(formatted.dataset.formulas));
                        }
                    }
                    return formatted;
                }
            }
        }
    }

    class DND5EGridCell extends CONFIG.BG3HUD.CORE.CELL {
        constructor(data, parent) {
            super(data, parent);
        }

        getActionType(itemData) {
            return itemData.system?.activation?.type?.toLowerCase() ?? itemData.activation?.type?.toLowerCase() ?? null;
        }

        getPreparationMode(itemData) {
            return itemData.system?.preparation?.mode ?? null;
        }

        async useItem(item, e, override) {
            let used = false,
                options = {};
            if(item.execute) item.execute();
            else if(item.use) {
                options = {
                    configureDialog: false,
                    legacy: false,
                    event: e
                };
                if (e.ctrlKey) options.disadvantage = true;
                if (e.altKey) options.advantage = true;
                used = await item.use(options, { event: e });
            } else if(item.consume) {
                item.consume(e);
                if(item.toChat) item.toChat(e);
                used = await this.useItem(item, this.data.override.level ?? item.system.level);
            } else if(item.sheet?.render) item.sheet.render(true);
            else item.toChat(e);
            return used;
        }

        async getData() {
            let itemData = await this.item,
                data = {};
            if(itemData) {
                data = {...data, ...{
                        uuid: itemData.uuid,
                        name: itemData.name,
                        icon: itemData.img ?? 'icons/svg/book.svg',
                        actionType: this.getActionType(itemData),
                        itemType: itemData.type,
                        quantity: itemData.system?.quantity && itemData.system?.quantity > 1 ? itemData.system?.quantity : false
                    },
                    ...await this.getItemUses()
                };
                if(itemData.type === "spell") data = {...data, ...{preparationMode: this.getPreparationMode(itemData), level: itemData.system?.level}};
                if(itemData.type === 'feat') data = {...data, ...{featType: itemData.system?.type?.value || 'default'}};
            }
            return data;
        }

        async getItemMenuBtns() {
            return this.data.item ? {activity: {
                label: game.i18n.localize("BG3.Hotbar.ContextMenu.ConfigureActivities"),
                icon: 'fas fa-cog',
                visibility: !this.data.item,
                click: () => {
                    if(!this.data.item) return;
                    this.menuItemAction('activity');
                }
            }} : {};
        }

        async getItemUses() {
            const itemData = await this.item;
            if (itemData.hasLimitedUses && (game.user.isGM || !itemData.system.hasOwnProperty('identified') || itemData.system.identified)) {
                const uses = itemData.system.uses;
                const value = uses.value ?? 0;
                const max = uses.max ?? 0;

                // Only show uses if max > 0.
                if (max > 0) return {uses: {value: value, max: max}};
                else return null;
            }
            return null;
        }
    }

    class DND5EAutoPopulateFeature extends CONFIG.BG3HUD.FEATURES.POPULATE {
        static checkPreparedSpell(item) {
            const prep = item.system?.preparation;
            // Skip if it's an unprepared "prepared" spell
            if (!prep?.prepared && prep?.mode === "prepared") return false;
            // Include if it's prepared or has a valid casting mode
            if (!prep?.prepared && !["pact", "apothecary", "atwill", "innate", "ritual", "always"].includes(prep?.mode)) return false;
            return true;
        }

        static shouldEnforceSpellPreparation(actor, tokenId) {
            const isLinked = BG3UTILS.isTokenLinked(actor, tokenId);
        
            // If linked token (including PCs) - use PC setting
            if (isLinked) return game.settings.get(MODULE_NAME, 'enforceSpellPreparationPC');
            
            // If unlinked token - use NPC setting
            return game.settings.get(MODULE_NAME, 'enforceSpellPreparationNPC');
        }

        static checkExtraConditions(item, actor, manager) {
            let isValid = true;
            if(!game.settings.get(BG3CONFIG.MODULE_NAME, 'noActivityAutoPopulate') && BG3UTILS.itemIsPassive(item)) isValid = false;
            console.log(this)
            if (item.type === "spell" && (this.shouldEnforceSpellPreparation(actor, manager.currentTokenId) && !this.checkPreparedSpell(item))) isValid = false;
            return isValid;
        }

        static async _getCombatActionsList(actor) {
            let ids = [];
            if(game.modules.get("chris-premades")?.active && game.packs.get("chris-premades.CPRActions")?.index?.size) {
                const pack = game.packs.get("chris-premades.CPRActions"),
                    promises = [];
                for(const id of game.settings.get(BG3CONFIG.MODULE_NAME, 'choosenCPRActions')) {
                    const item = actor.items.find(i => i.system.identifier === pack.index.get(id)?.system?.identifier);
                    if(item) ids.push(item.uuid);
                    else {
                        const cprItem = pack.index.get(id);
                        if(cprItem) {
                            promises.push(new Promise(async (resolve, reject) => {
                                let item = await pack.getDocument(cprItem._id);
                                resolve(item);
                            }))
                        }
                    }
                }
                if(promises.length) {
                    await Promise.all(promises).then(async (values) => {
                        let tmpDoc = await actor.createEmbeddedDocuments('Item', values);
                        ids = tmpDoc.map(i => i.uuid);
                    })
                }
            } else {
                const compendium = await game.packs.get("bg3-hud-dnd5e.bg3-inspired-hud");
                if(!compendium) return ids;
                ids = compendium.folders.find(f => f.name === 'Common Actions').contents.map(m => m.uuid);
            }
            return ids;
        }

        static async _populateWeaponsToken(actor, manager) {
            if (!actor?.items || !manager?.containers?.weapon) return;
            try {
                // Process each container
                let weaponsList = actor.items.filter(w => w.type == 'weapon'),
                toUpdate = [];
                if(weaponsList.length) {
                    for(let i = 0; i < weaponsList.length; i++) {
                        const gridKey = `0-0`,
                        item = weaponsList[i];
                        if(i < 3) {
                        manager.containers.weapon[i].items = {};
                        const itemData = {uuid: item.uuid};
                        manager.containers.weapon[i].items[gridKey] = itemData;
                        }
                        if((i === 0 && !item.system.equipped) || (i > 0 && item.system.equipped)) toUpdate.push({_id: item.uuid.split('.').pop(), "system.equipped": (i === 0 ? 1 : 0)})
                    }
                    if(game.settings.get(BG3CONFIG.MODULE_NAME, 'enableWeaponAutoEquip')) actor.updateEmbeddedDocuments("Item", toUpdate);
                }     
            } catch (error) {
                console.error("BG3 Inspired Hotbar | Error auto-populating weapons token hotbar:", error);
            }
        }
    }

    BG3Hotbar.overrideClass('COMPONENTS.PORTRAIT.ABILITY', DND5EAbilityContainer);
    BG3Hotbar.overrideClass('COMPONENTS.PORTRAIT.DEATH', DND5EDeathSavesContainer);
    BG3Hotbar.overrideClass('COMPONENTS.RESTTURN', DND5ERestTurnContainer);
    BG3Hotbar.overrideClass('COMPONENTS.ADVANTAGE', DND5EAdvContainer);
    BG3Hotbar.overrideClass('COMPONENTS.HOTBAR.FILTER', DND5EFilterContainer);
    BG3Hotbar.overrideClass('COMPONENTS.WEAPON', DND5EWeaponContainer);
    BG3Hotbar.overrideClass('DIALOGS.CPR', DND5ECPRActionsDialog);
    BG3Hotbar.overrideClass('MANAGERS.TOOLTIP', DND5EBG3TooltipManager);
    BG3Hotbar.overrideClass('CORE.CELL', DND5EGridCell);
    BG3Hotbar.overrideClass('FEATURES.POPULATE', DND5EAutoPopulateFeature);

    game.settings.menus.get(BG3CONFIG.MODULE_NAME + ".chooseCPRActions").type = DND5ECPRActionsDialog;
    game.settings.menus.get(BG3CONFIG.MODULE_NAME + ".chooseCPRActions").visible = () => game.modules.get("chris-premades")?.active;
    game.settings.settings.get(BG3CONFIG.MODULE_NAME + ".choosenCPRActions").default = ["9wbU6kYxfAaRFrbI", "ga6foNaesV3UJFKm", "eqOOv3smPuxTq7Xm", "pmn1iLabeps5aPtW", "nmkcJWUba7hyi5m5", "34jFXjMOseErle3M"];
    game.settings.settings.get(BG3CONFIG.MODULE_NAME + ".dataExtraInfo").default = [
        {attr: 'attributes.ac.value', icon: 'fas fa-shield', color: '#5abef5', pos: 'Top Left'},
        {attr: 'attributes.spell.dc', icon: 'fas fa-book-open', color: '#af68d5', pos: 'Top Right'},
        {attr: '', icon: '', color: '', pos: 'Left'},
        {attr: '', icon: '', color: '', pos: 'Right'},
        {attr: '', icon: '', color: '', pos: 'Bottom Left'},
        {attr: '', icon: '', color: '', pos: 'Bottom Right'}
    ];

    Hooks.on("renderSettingsConfig", (app, html, data) => {
        const detailsSettings = [
            {
                label: 'BG3.Settings.Menu.Populate.Name',
                isOpen: true,
                categories: [
                    {
                        label: null,
                        fields: ['enforceSpellPreparationPC', 'enforceSpellPreparationNPC']
                    }
                ]
            },
            {
                label: 'BG3.Settings.Menu.Tooltip.Name',
                isOpen: true,
                categories: [
                    {
                        label: null,
                        fields: ['showMaterialDescription']
                    }
                ]
            },
            {
                label: 'BG3.Settings.Menu.Midi.Name',
                isOpen: true,
                categories: [
                    {
                        label: null,
                        fields: ['synchroBRMidiQoL', 'addAdvBtnsMidiQoL']
                    }
                ]
            }
        ];
        BG3UTILS.formatSettingsDetails(MODULE_NAME, detailsSettings);
    });

    (async () => {
        const promises = [],
            migrationClient = game.settings.get(MODULE_NAME, 'migrationV3ToV4Client');
        game.settings.settings.forEach(s => {
            if(s.namespace === 'bg3-hud-dnd5e' && !migrationClient && s.config) {
                const v3Setting = game.settings.storage.get("client")[`${BG3CONFIG.MODULE_NAME}.${s.key}`] ?? game.settings.storage.get("world")[`${BG3CONFIG.MODULE_NAME}.${s.key}`] ?? null;
                if(v3Setting) {
                    const saved = JSON.parse(v3Setting);
                    if(saved !== s.default) {
                        promises.push(new Promise(async (resolve, reject) => {
                            try {
                                game.settings.set(MODULE_NAME, s.key, saved);
                                resolve(`Setting ${s.key}: ${s.default} to ${saved}`);
                            } catch (error) {
                                reject(`Error setting migration: ${s.key}`);
                            }
                        }))
                    }
                }
            }
        });
        if(promises.length) {
            await Promise.all(promises).then(async (values) => {
                game.settings.set(MODULE_NAME, 'migrationV3ToV4Client', true);
                console.log('BG3 Inspired Hotbar: Migration V3 to V4 done.');
            })
        }
    })();

    // Temp Fix for compendium macros
    (async () => {
        const compendium = await game.packs.get("bg3-inspired-hotbar.bg3-inspired-hud");
        if(compendium?.ownership && compendium?.ownership?.['PLAYER'] !== 'LIMITED') {
            compendium.configure({ownership: {...compendium.ownership, ...{'PLAYER': 'LIMITED'}}});
        }
    })()
});

Hooks.once('ready', () => {
    game.settings.register(MODULE_NAME, 'enforceSpellPreparationPC', {
        name: 'BG3.Settings.EnforceSpellPreparationPC.Name',
        hint: 'BG3.Settings.EnforceSpellPreparationPC.Hint',
        scope: 'client',
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register(MODULE_NAME, 'enforceSpellPreparationNPC', {
        name: 'BG3.Settings.EnforceSpellPreparationNPC.Name',
        hint: 'BG3.Settings.EnforceSpellPreparationNPC.Hint',
        scope: 'client',
        config: true,
        type: Boolean,
        default: false
    });

    game.settings.register(MODULE_NAME, 'showMaterialDescription', {
        name: 'BG3.Settings.ShowMaterialDescription.Name',
        hint: 'BG3.Settings.ShowMaterialDescription.Hint',
        scope: 'client',
        config: true,
        type: Boolean,
        default: false,
        onChange: value => {
            document.body.dataset.showMaterials = value;
        }
    });
    document.body.dataset.showMaterials = game.settings.get(MODULE_NAME, 'showMaterialDescription');

    // if(game.modules.get("midi-qol")?.active) {
        game.settings.register(MODULE_NAME, 'synchroBRMidiQoL', {
            name: 'BG3.Settings.synchroMidiQoL.BR.Name',
            hint: 'BG3.Settings.synchroMidiQoL.BR.Hint',
            scope: 'client',
            config: game.modules.get("midi-qol")?.active,
            type: Boolean,
            default: false,
            onChange: () => {
                if(ui.BG3HOTBAR.components?.container?.components?.filterContainer) ui.BG3HOTBAR.components.container.components.filterContainer._autoCheckUsed();
            }
        });

        game.settings.register(MODULE_NAME, 'addAdvBtnsMidiQoL', {
            name: 'BG3.Settings.synchroMidiQoL.ADV.Name',
            hint: 'BG3.Settings.synchroMidiQoL.ADV.Hint',
            scope: 'client',
            config: game.modules.get("midi-qol")?.active,
            type: Boolean,
            default: false,
            onChange: value => {
                if(ui.BG3HOTBAR.components?.advantage) {
                    if(value) ui.BG3HOTBAR.components.advantage._renderInner();
                    else ui.BG3HOTBAR.components.advantage.destroy();
                }
            }
        });
    // }
    
    // Settings Migration V3 to V4
    game.settings.register(MODULE_NAME, 'migrationV3ToV4Client', {
        name: 'Client: Migration V3 to V4',
        hint: 'Client: Is migration already done ?',
        scope: 'client',
        config: false,
        type: Boolean,
        default: false
    });
});