/**
 * D&D 5e Advantage/Disadvantage Roll Hooks
 * Registers hook handlers that apply ADV/DIS state (set via the situational
 * bonuses container) to dnd5e rolls, scoped behind midi-qol being active.
 * Mirrors the inspired hotbar's behaviour but scoped to BG3 HUD core.
 */

import { getAdvantageState, clearAdvantageState, isMidiQolIntegrationActive } from './AdvantageState.js';
import { advantageRollActor, applyHudAdvantage, sameActor } from './advantageRoll.js';

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

        const rollingActor = advantageRollActor(rollConfig);
        const currentActor = ui.BG3HUD_APP?.currentActor;
        if (!sameActor(currentActor, rollingActor)) return;

        // Flags are written on the actor the HUD is showing.
        const { state, once } = getAdvantageState(currentActor);
        if (!applyHudAdvantage(rollConfig, state)) return;

        if (once) {
            const situationalBonuses = ui.BG3HOTBAR?.api?.getRegisteredContainer('situationalBonuses');
            if (situationalBonuses && typeof situationalBonuses.clearState === 'function') {
                await situationalBonuses.clearState();
            } else {
                await clearAdvantageState(currentActor);
            }
        }
    };

    for (const event of ADVANTAGE_ROLL_EVENTS) {
        Hooks.on(event, handleRollAdvantage);
    }

    advantageHooksRegistered = true;
}
