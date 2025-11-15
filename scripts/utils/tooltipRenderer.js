/**
 * D&D 5e Tooltip Renderer
 * Handles rendering tooltips for items, activities, and macros
 */

/**
 * Extract component and cast time tags from item/activity data
 * @param {Object} itemOrActivity - Item or activity data
 * @param {Object} labels - Labels object
 * @param {Item} parentItem - Parent item (for activities)
 * @returns {Array<string>} Array of tags
 */
function extractComponentAndCastTimeTags(itemOrActivity, labels, parentItem = null) {
    const tags = [];

    // Component tags (V, S, M, etc.)
    // Always extract from system.properties first (most reliable source)
    // Note: system.properties can be a Set or Array
    // Only combine V, S, M into a single tag (e.g., "V, S, M")
    // Concentration and Ritual remain as individual tags
    const componentTags = [];
    const systemProperties = itemOrActivity.system?.properties ?? parentItem?.system?.properties;
    if (systemProperties) {
        // Convert Set to Array if needed
        const propertiesArray = systemProperties instanceof Set
            ? Array.from(systemProperties)
            : (Array.isArray(systemProperties) ? systemProperties : []);

        if (propertiesArray.length > 0) {
            // Only map casting components (V, S, M)
            const componentMap = {
                'vocal': 'V',
                'somatic': 'S',
                'material': 'M'
            };

            // Extract V, S, M components
            const mappedComponents = propertiesArray
                .map(prop => {
                    if (!prop) return null;
                    const normalized = String(prop).toLowerCase().trim();
                    return componentMap[normalized];
                })
                .filter(tag => tag); // Remove null/undefined values

            componentTags.push(...mappedComponents);

            // Add concentration and ritual as individual tags (not combined)
            if (propertiesArray.some(prop => String(prop).toLowerCase().trim() === 'concentration')) {
                tags.push('Concentration');
            }
            if (propertiesArray.some(prop => String(prop).toLowerCase().trim() === 'ritual')) {
                tags.push('Ritual');
            }
        }
    }

    // Also check labels.components.tags as supplement (may have additional info like material descriptions)
    // Only add V, S, M from labels, not concentration/ritual
    if (labels.components?.tags && Array.isArray(labels.components.tags) && labels.components.tags.length > 0) {
        labels.components.tags.forEach(tag => {
            // Only add V, S, M to componentTags, skip others
            if (tag && ['V', 'S', 'M'].includes(tag) && !componentTags.includes(tag)) {
                componentTags.push(tag);
            }
        });
    }

    // Combine V, S, M components into a single comma-separated tag
    if (componentTags.length > 0) {
        tags.push(componentTags.join(', '));
    }

    // Cast time - check activities first, then fall back to labels or system.activation
    let castTime = null;
    let hasActivityCastTime = false;

    // Check activities first (D&D 5e v4.x+)
    // Activities are stored as an object with unique IDs as keys
    const activities = itemOrActivity.system?.activities ?? parentItem?.system?.activities;
    if (activities && typeof activities === 'object') {
        const activityKeys = Object.keys(activities);
        if (activityKeys.length > 0) {
            // Sort activities by their sort property (if available) to get the primary one
            const sortedActivities = activityKeys
                .map(key => ({ key, activity: activities[key] }))
                .sort((a, b) => (a.activity.sort ?? 0) - (b.activity.sort ?? 0));

            const firstActivity = sortedActivities[0].activity;
            if (firstActivity?.activation?.type) {
                hasActivityCastTime = true;
                // Format activation type (e.g., "action" -> "Action", "bonus" -> "Bonus Action")
                const activationType = firstActivity.activation.type;
                const activationValue = firstActivity.activation.value;

                // Format based on type - include value when present
                if (activationType === 'action') {
                    castTime = activationValue && activationValue !== 1
                        ? `${activationValue} Actions`
                        : 'Action';
                } else if (activationType === 'bonus') {
                    castTime = 'Bonus Action';
                } else if (activationType === 'reaction') {
                    castTime = 'Reaction';
                } else if (activationType === 'minute') {
                    const value = activationValue ?? 1;
                    castTime = `${value} ${value === 1 ? 'Minute' : 'Minutes'}`;
                } else if (activationType === 'hour') {
                    const value = activationValue ?? 1;
                    castTime = `${value} ${value === 1 ? 'Hour' : 'Hours'}`;
                } else {
                    // For other types, include value if present
                    if (activationValue) {
                        castTime = `${activationValue} ${activationType.charAt(0).toUpperCase() + activationType.slice(1)}`;
                    } else {
                        castTime = activationType.charAt(0).toUpperCase() + activationType.slice(1);
                    }
                }
            }
        }
    }

    // Only fall back to labels.cast or system.activation if no activity cast time was found
    if (!hasActivityCastTime) {
        // Fall back to labels.cast if no activity found
        if (labels.cast) {
            castTime = labels.cast;
        }
        // Fall back to system.activation if still no cast time
        else if (itemOrActivity.system?.activation?.type ?? parentItem?.system?.activation?.type) {
            const activation = itemOrActivity.system?.activation ?? parentItem.system.activation;
            const activationType = activation.type;
            const activationValue = activation.value;

            if (activationType === 'action') {
                castTime = activationValue && activationValue !== 1
                    ? `${activationValue} Actions`
                    : 'Action';
            } else if (activationType === 'bonus') {
                castTime = 'Bonus Action';
            } else if (activationType === 'reaction') {
                castTime = 'Reaction';
            } else if (activationType === 'minute') {
                const value = activationValue ?? 1;
                castTime = `${value} ${value === 1 ? 'Minute' : 'Minutes'}`;
            } else if (activationType === 'hour') {
                const value = activationValue ?? 1;
                castTime = `${value} ${value === 1 ? 'Hour' : 'Hours'}`;
            } else {
                if (activationValue) {
                    castTime = `${activationValue} ${activationType.charAt(0).toUpperCase() + activationType.slice(1)}`;
                } else {
                    castTime = activationType.charAt(0).toUpperCase() + activationType.slice(1);
                }
            }
        }
    }

    // Add cast time to tags if found
    if (castTime) {
        tags.push(castTime);
    }

    // Add spell-specific tags (range, duration, target, area, save)
    const isSpell = itemOrActivity.type === 'spell' || parentItem?.type === 'spell';
    if (isSpell) {
        // Range
        if (labels.range) {
            tags.push(labels.range);
        }

        // Duration
        if (labels.duration) {
            tags.push(labels.duration);
        }

        // Target
        if (labels.target) {
            tags.push(labels.target);
        }

        // Area
        if (labels.area) {
            tags.push(labels.area);
        }

        // Save
        if (labels.save) {
            tags.push(labels.save);
        }
    }

    return tags.filter(_ => _); // Remove any empty values
}

/**
 * Get card data for an item (similar to D&D 5e's getCardData)
 * @param {Item} item - Foundry Item document
 * @param {Object} enrichmentOptions - Text enrichment options
 * @returns {Promise<Object>} Card data object
 */
async function getItemCardData(item, enrichmentOptions = {}) {
    const isIdentified = item.identified !== false;
    const labels = foundry.utils.deepClone(item.labels);
    
    const context = {
        name: item.name,
        type: item.type,
        img: item.img,
        school: item.system?.school,
        labels: labels,
        config: CONFIG.DND5E,
        controlHints: game.settings.get("dnd5e", "controlHints"),
        description: {
            value: await foundry.applications.ux.TextEditor.implementation.enrichHTML(item.system?.description?.value ?? "", {
                rollData: item.getRollData(),
                relativeTo: item,
                ...enrichmentOptions
            })
        },
        uses: (item.hasLimitedUses && (game.user.isGM || isIdentified)) ? item.system.uses : null,
        materials: item.system.materials,
        tags: [],
        isSpell: item.type === 'spell',
        price: item.system.price,
        weight: item.system.weight
    };

    // Extract tags using shared helper function
    context.tags = extractComponentAndCastTimeTags(item, labels);

    // Add spell-specific data
    if (context.isSpell) {
        context.level = item.system.level;
        // Format subtitle with level and school
        const schoolKey = item.system.school;
        const schoolConfig = schoolKey ? CONFIG.DND5E.spellSchools?.[schoolKey] : null;
        const schoolLabel = schoolConfig?.label || '';
        
        if (schoolLabel) {
            // Level 0 is a cantrip
            if (item.system.level === 0) {
                context.subtitle = `Cantrip. ${schoolLabel}`;
            } else {
                context.subtitle = `Level ${item.system.level}. ${schoolLabel}`;
            }
        } else {
            if (item.system.level === 0) {
                context.subtitle = 'Cantrip';
            } else {
                context.subtitle = game.i18n.format("DND5E.SpellLevel", { level: item.system.level });
            }
        }
    } else {
        context.subtitle = labels.type;
    }

        // Add damage enrichment for weapons/spells
        if (labels.damage?.length) {
            let textDamage = '';
            const rollData = item.getRollData();
            for (let i = 0; i < labels.damage.length; i++) {
                textDamage += `[[/damage ${labels.damage[i].formula}${labels.damage[i].damageType ? ` type=${labels.damage[i].damageType}` : ''}]]`;
                if (i < labels.damage.length - 1) textDamage += ' | ';
            }
            context.enrichDamage = {
                value: await foundry.applications.ux.TextEditor.implementation.enrichHTML(textDamage ?? "", {
                    rollData,
                    relativeTo: item,
                    ...enrichmentOptions
                })
            };
        }

    // Add properties
    context.properties = [];
    if (game.user.isGM || isIdentified) {
        const activationLabels = labels.activations?.[0] ?? {};
        context.properties.push(...Object.values(activationLabels));
    }
    context.properties = context.properties.filter(_ => _);
    context.hasProperties = context.tags?.length || context.properties.length;

    return context;
}

/**
 * Get card data for an activity (D&D 5e v4.x+)
 * @param {Object} activity - Activity data object
 * @param {Item} parentItem - Parent item
 * @param {Object} enrichmentOptions - Text enrichment options
 * @returns {Promise<Object>} Card data object
 */
async function getActivityCardData(activity, parentItem, enrichmentOptions = {}) {
    const isIdentified = activity.identified !== false || parentItem.identified !== false;
    
    const getDataParent = (property) => {
        return activity[property] ?? parentItem[property];
    };

    const labels = foundry.utils.deepClone(activity.labels ?? parentItem.labels);
    
    const context = {
        name: activity.name ?? parentItem.name,
        type: activity.type ?? parentItem.type,
        img: activity.img ?? parentItem.img,
        school: getDataParent('system')?.school ?? parentItem.system?.school,
        labels: labels,
        config: CONFIG.DND5E,
        controlHints: game.settings.get("dnd5e", "controlHints"),
        description: {
            value: await foundry.applications.ux.TextEditor.implementation.enrichHTML(activity.description?.chatFlavor ?? parentItem.system?.description?.value ?? "", {
                rollData: activity.getRollData ? activity.getRollData() : parentItem.getRollData(),
                relativeTo: activity,
                ...enrichmentOptions
            })
        },
        uses: ((activity.hasLimitedUses || parentItem.hasLimitedUses) && (game.user.isGM || isIdentified)) 
            ? (activity.system?.uses ?? parentItem.system?.uses) : null,
        materials: activity.system?.materials ?? parentItem.system?.materials,
        tags: [],
        isSpell: getDataParent('isSpell') ?? parentItem.type === 'spell',
        parentType: parentItem.type
    };

    // Extract tags using shared helper function
    context.tags = extractComponentAndCastTimeTags(activity, labels, parentItem);

    if (context.isSpell && !context.labels.components) {
        context.labels.components = parentItem.labels.components;
    }

        // Add damage enrichment
        if (labels.damage?.length) {
            let textDamage = '';
            const rollData = activity.getRollData ? activity.getRollData() : parentItem.getRollData();
            for (let i = 0; i < labels.damage.length; i++) {
                textDamage += `[[/damage ${labels.damage[i].formula}${labels.damage[i].damageType ? ` type=${labels.damage[i].damageType}` : ''}]]`;
                if (i < labels.damage.length - 1) textDamage += ' | ';
            }
            context.enrichDamage = {
                value: await foundry.applications.ux.TextEditor.implementation.enrichHTML(textDamage ?? "", {
                    rollData,
                    relativeTo: parentItem,
                    ...enrichmentOptions
                })
            };
        }

    // Add properties
    context.properties = [];
    if (game.user.isGM || isIdentified) {
        const activationLabels = activity.activationLabels ?? labels.activations?.[0] ?? {};
        context.properties.push(...Object.values(activationLabels));
    }
    context.properties = context.properties.filter(_ => _);
    context.hasProperties = context.tags?.length || context.properties.length;

    return context;
}

/**
 * Get card data for an active effect
 * @param {ActiveEffect} effect - Foundry ActiveEffect document
 * @param {Object} enrichmentOptions - Text enrichment options
 * @returns {Promise<Object>} Card data object
 */
async function getActiveEffectCardData(effect, enrichmentOptions = {}) {
    // Get description from various possible locations
    let descriptionText = '';
    if (effect.description) {
        descriptionText = effect.description;
    } else if (effect.flags?.dnd5e?.description) {
        descriptionText = effect.flags.dnd5e.description;
    } else if (effect.changes && effect.changes.length > 0) {
        // Build description from changes if no description exists
        descriptionText = effect.changes.map(change => {
            const key = change.key || '';
            const mode = change.mode || 0;
            const value = change.value || '';
            return `${key}: ${value}`;
        }).join('<br>');
    }

    const context = {
        name: effect.label || effect.name || 'Effect',
        type: 'effect',
        img: effect.img || effect.icon || 'icons/svg/aura.svg',
        subtitle: 'Active Effect',
        config: CONFIG.DND5E,
        controlHints: game.settings.get("dnd5e", "controlHints"),
        description: {
            value: await foundry.applications.ux.TextEditor.implementation.enrichHTML(descriptionText, {
                rollData: effect.getRollData ? effect.getRollData() : {},
                relativeTo: effect,
                ...enrichmentOptions
            })
        },
        disabled: effect.disabled || false,
        duration: effect.duration || {},
        statuses: effect.statuses || new Set()
    };

    // Extract tags from statuses or effect flags
    const tags = [];
    if (effect.statuses && effect.statuses.size > 0) {
        tags.push(...Array.from(effect.statuses));
    }
    // Add any additional tags from effect flags or system data
    if (effect.flags?.dnd5e?.tags) {
        tags.push(...effect.flags.dnd5e.tags);
    }
    // Add duration info as a tag if available
    if (effect.duration?.seconds) {
        tags.push(`Duration: ${effect.duration.seconds}s`);
    } else if (effect.duration?.rounds) {
        tags.push(`Duration: ${effect.duration.rounds} rounds`);
    } else if (effect.duration?.turns) {
        tags.push(`Duration: ${effect.duration.turns} turns`);
    }
    context.tags = tags;
    context.properties = [];
    context.hasProperties = context.tags?.length || context.properties.length;

    return context;
}

/**
 * Render tooltip HTML for D&D 5e items/activities/macros/effects
 * @param {Object} data - Item, Activity, Macro, or ActiveEffect document
 * @param {Object} options - Rendering options
 * @returns {Promise<Object>} Object with { content: string, classes: string[], direction: string }
 */
export async function renderDnD5eTooltip(data, options = {}) {
    try {
        let cardData;
        let templatePath;

        // Determine what type of data we have
        if (data instanceof ActiveEffect) {
            // Active Effect
            cardData = await getActiveEffectCardData(data, options);
            templatePath = 'modules/bg3-hud-dnd5e/templates/tooltips/item-tooltip.hbs';
        } else if (data instanceof Item) {
            // Regular item
            cardData = await getItemCardData(data, options);
            templatePath = 'modules/bg3-hud-dnd5e/templates/tooltips/item-tooltip.hbs';
        } else if (data.documentName === 'Macro' || data instanceof Macro) {
            // Macro
            cardData = {
                name: data.name,
                type: data.type,
                img: data.img,
                config: CONFIG.DND5E,
                controlHints: game.settings.get("dnd5e", "controlHints")
            };
            templatePath = 'modules/bg3-hud-dnd5e/templates/tooltips/macro-tooltip.hbs';
        } else if (data.parent || (data.constructor?.name && data.constructor.name.includes('Activity'))) {
            // Activity (D&D 5e v4.x+ activities system)
            // Activities have a parent property pointing to the item
            let parentItem;
            if (data.parent instanceof Item) {
                parentItem = data.parent;
            } else if (data.parent?.uuid) {
                parentItem = await fromUuid(data.parent.uuid);
            } else if (data.item) {
                // Some activities store item reference as 'item'
                parentItem = data.item instanceof Item ? data.item : await fromUuid(data.item.uuid);
            } else {
                // Fallback: try to get item from the activity's context
                console.warn('BG3 HUD D&D 5e | Could not determine parent item for activity:', data);
                // Try to use the activity as if it were an item
                cardData = await getItemCardData(data, options);
                templatePath = 'modules/bg3-hud-dnd5e/templates/tooltips/item-tooltip.hbs';
            }
            
            if (parentItem) {
                cardData = await getActivityCardData(data, parentItem, options);
                templatePath = 'modules/bg3-hud-dnd5e/templates/tooltips/activity-tooltip.hbs';
            }
        } else {
            // Fallback to item tooltip
            cardData = await getItemCardData(data, options);
            templatePath = 'modules/bg3-hud-dnd5e/templates/tooltips/item-tooltip.hbs';
        }

        // Render template
        const html = await foundry.applications.handlebars.renderTemplate(templatePath, cardData);

        if (!html) {
            console.warn('BG3 HUD D&D 5e | Template rendered empty HTML');
            return null;
        }

        return {
            content: html,
            classes: ['dnd5e2', 'dnd5e-tooltip', 'item-tooltip'],
            direction: 'UP'
        };
    } catch (error) {
        console.error('BG3 HUD D&D 5e | Error rendering tooltip:', error);
        console.error('BG3 HUD D&D 5e | Error stack:', error.stack);
        return null;
    }
}

