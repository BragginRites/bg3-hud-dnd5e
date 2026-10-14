import { describe, it, expect } from 'vitest';
import { computeSpellDepletion, resolveHotbarMembershipOnItemUpdate } from '../SpellDepletion.js';

describe('computeSpellDepletion', () => {
    it('cantrips (level 0) never deplete, regardless of slots/uses', () => {
        expect(computeSpellDepletion({ level: 0, method: 'spell', hasOwnUses: false, spellSlots: {} })).toBe(false);
        expect(computeSpellDepletion({ level: 0, method: 'innate', hasOwnUses: true, uses: { value: 0 } })).toBe(false);
    });

    it('own-uses / non-slot methods (innate, pact, apothecary, atwill) deplete based on their own uses', () => {
        expect(computeSpellDepletion({ level: 2, method: 'innate', hasOwnUses: true, uses: { value: 0, max: 1 } })).toBe(true);
        expect(computeSpellDepletion({ level: 2, method: 'innate', hasOwnUses: true, uses: { value: 1, max: 1 } })).toBe(false);
    });

    it('non-slot methods with no uses tracked are never depleted', () => {
        expect(computeSpellDepletion({ level: 1, method: 'atwill', hasOwnUses: false, uses: null, spellSlots: {} })).toBe(false);
    });

    it('learned ("spell") method with its own limited-use pool bypasses slot checks', () => {
        // hasOwnUses true forces usesSlots=false even though method === 'spell'
        expect(computeSpellDepletion({ level: 3, method: 'spell', hasOwnUses: true, uses: { value: 0, max: 2 } })).toBe(true);
        expect(computeSpellDepletion({ level: 3, method: 'spell', hasOwnUses: true, uses: { value: 1, max: 2 } })).toBe(false);
    });

    it('regular learned spells check actor spell slots at or above their level', () => {
        const spellSlots = { spell1: { value: 0 }, spell2: { value: 0 }, spell3: { value: 1 } };
        // Level 1 spell: no slot1/slot2 remaining, but slot3 is open -> castable via higher slot
        expect(computeSpellDepletion({ level: 1, method: 'spell', hasOwnUses: false, spellSlots })).toBe(false);
        // Level 3 spell with slot3 open -> castable
        expect(computeSpellDepletion({ level: 3, method: 'spell', hasOwnUses: false, spellSlots })).toBe(false);
    });

    it('regular learned spells are depleted when no slot at or above level remains', () => {
        const spellSlots = { spell1: { value: 0 }, spell2: { value: 0 } };
        expect(computeSpellDepletion({ level: 1, method: 'spell', hasOwnUses: false, spellSlots })).toBe(true);
    });

    it('falls back to pact slots when regular slots are exhausted', () => {
        const spellSlots = { spell1: { value: 0 }, spell2: { value: 0 }, pact: { value: 1, level: 2 } };
        expect(computeSpellDepletion({ level: 2, method: 'spell', hasOwnUses: false, spellSlots })).toBe(false);
        // Pact slot level too low for this spell's level
        expect(computeSpellDepletion({ level: 3, method: 'spell', hasOwnUses: false, spellSlots })).toBe(true);
    });

    it('falls back to apothecary slots (SCGD compatibility) when regular/pact slots are exhausted', () => {
        const spellSlots = { spell1: { value: 0 }, apothecary: { value: 1, level: 1 } };
        expect(computeSpellDepletion({ level: 1, method: 'spell', hasOwnUses: false, spellSlots })).toBe(false);
        // apothecary.level defaults to 1 when absent
        const spellSlotsNoLevel = { spell1: { value: 0 }, apothecary: { value: 1 } };
        expect(computeSpellDepletion({ level: 1, method: 'spell', hasOwnUses: false, spellSlots: spellSlotsNoLevel })).toBe(false);
        expect(computeSpellDepletion({ level: 2, method: 'spell', hasOwnUses: false, spellSlots: spellSlotsNoLevel })).toBe(true);
    });

    it('returns undefined (indeterminate) when no spellSlots data is available for a slot-using spell', () => {
        expect(computeSpellDepletion({ level: 2, method: 'spell', hasOwnUses: false, spellSlots: null })).toBeUndefined();
    });
});

describe('resolveHotbarMembershipOnItemUpdate', () => {
    it('returns null for non-spell items', () => {
        const item = { type: 'weapon', system: {} };
        expect(resolveHotbarMembershipOnItemUpdate(item)).toBeNull();
    });

    it('uses the modern .method field: prepared spell -> add, unprepared -> remove', () => {
        const prepared = { type: 'spell', system: { method: 'spell', prepared: 1 } };
        expect(resolveHotbarMembershipOnItemUpdate(prepared)).toBe('add');

        const unprepared = { type: 'spell', system: { method: 'spell', prepared: 0 } };
        expect(resolveHotbarMembershipOnItemUpdate(unprepared)).toBe('remove');
    });

    it('falls back to legacy .preparation.mode/.prepared when .method is absent', () => {
        const prepared = { type: 'spell', system: { preparation: { mode: 'prepared', prepared: true } } };
        expect(resolveHotbarMembershipOnItemUpdate(prepared)).toBe('add');

        const unprepared = { type: 'spell', system: { preparation: { mode: 'prepared', prepared: false } } };
        expect(resolveHotbarMembershipOnItemUpdate(unprepared)).toBe('remove');
    });

    it('always-eligible casting methods (pact, apothecary, atwill, innate, ritual, always) add regardless of prepared flag', () => {
        for (const method of ['pact', 'apothecary', 'atwill', 'innate', 'ritual', 'always']) {
            const item = { type: 'spell', system: { method, prepared: 0 } };
            expect(resolveHotbarMembershipOnItemUpdate(item)).toBe('add');
        }
    });

    it('prepared === 2 (always prepared) adds regardless of method', () => {
        const item = { type: 'spell', system: { method: 'spell', prepared: 2 } };
        expect(resolveHotbarMembershipOnItemUpdate(item)).toBe('add');
    });

    it('unrecognized casting methods return null', () => {
        const item = { type: 'spell', system: { method: 'mystery', prepared: 1 } };
        expect(resolveHotbarMembershipOnItemUpdate(item)).toBeNull();
    });
});
