import { describe, expect, it } from 'vitest';
import { isThirdPartyAutomationUnsupported } from '../../utils/thirdPartyCompat.js';

describe('isThirdPartyAutomationUnsupported', () => {
    it('keeps Foundry 13 with dnd5e 5 supported', () => {
        expect(isThirdPartyAutomationUnsupported({
            foundryVersion: '13.351',
            systemId: 'dnd5e',
            systemVersion: '5.3.3'
        })).toBe(false);
    });

    it('turns the integrations off on Foundry 14 even with dnd5e 5', () => {
        expect(isThirdPartyAutomationUnsupported({
            foundryVersion: '14.368',
            systemId: 'dnd5e',
            systemVersion: '5.3.3'
        })).toBe(true);
    });

    it('turns the integrations off on dnd5e 6', () => {
        expect(isThirdPartyAutomationUnsupported({
            foundryVersion: '14.367',
            systemId: 'dnd5e',
            systemVersion: '6.0.6'
        })).toBe(true);
    });

    it('does not treat another system on Foundry 13 as this gate', () => {
        expect(isThirdPartyAutomationUnsupported({
            foundryVersion: '13.351',
            systemId: 'pf2e',
            systemVersion: '7.0.0'
        })).toBe(false);
    });
});
