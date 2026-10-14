/**
 * D&D 5e Advantage/Disadvantage Roll Hooks
 * Registers hook handlers that apply ADV/DIS state (set via the situational
 * bonuses container) to dnd5e rolls, scoped behind midi-qol being active.
 * Mirrors the inspired hotbar's behaviour but scoped to BG3 HUD core.
 */

import { getAdvantageState, clearAdvantageState, isMidiQolIntegrationActive } from './AdvantageState.js';

const ADVANTAGE_ROLL_EVENTS = [
    'dnd5e.preRollAttackV2',
    'dnd5e.preRollSavingThrowV2',
    'dnd5e.preRollSkillV2',
    'dnd5e.preRollAbilityCheckV2',
    'dnd5e.preRollConcentrationV2',
    'dnd5e.preRollDeathSaveV2',
    'dnd5e.preRollToolV2'
];

let advantageHooksRegistered = false;

/**
 * Register advantage/disadvantage hooks once. Safe to call multiple times -
 * subsequent calls are no-ops.
 */
export function registerAdvantageHooks() {
    if (advantageHooksRegistered) return;

    const handleRollAdvantage = async (rollConfig) => {
        // Ensure midi-qol integration is active and setting enabled
        if (!isMidiQolIntegrationActive()) return;

        const workflowActor = rollConfig?.workflow?.actor;
        if (!workflowActor) return;

        // Only apply when HUD is controlling this actor
        const currentActor = ui.BG3HUD_APP?.currentActor;
        if (!currentActor || currentActor !== workflowActor) return;

        const { state, once } = getAdvantageState(workflowActor);

        if (state === 'advBtn') {
            rollConfig.advantage = true;
        } else if (state === 'disBtn') {
            rollConfig.disadvantage = true;
        } else {
            return;
        }

        if (once) {
            const situationalBonuses = ui.BG3HUD_APP?.components?.situationalBonuses;
            if (situationalBonuses && typeof situationalBonuses.clearState === 'function') {
                await situationalBonuses.clearState();
            } else {
                await clearAdvantageState(workflowActor);
            }
        }
    };

    for (const event of ADVANTAGE_ROLL_EVENTS) {
        Hooks.on(event, handleRollAdvantage);
    }

    advantageHooksRegistered = true;
}
