import { describe, expect, it } from 'vitest';
import { advantageRollActor, applyHudAdvantage, sameActor } from '../advantageRoll.js';

const hero = { documentName: 'Actor', id: 'hero', uuid: 'Actor.hero' };
const heroClone = { documentName: 'Actor', id: 'hero', uuid: 'Actor.hero' };

describe('dnd5e 5 advantage rolls', () => {
    it('reads the actor from a skill or save roll', () => {
        expect(advantageRollActor({ subject: hero })).toBe(hero);
    });

    it('reads the actor from an attack activity', () => {
        const activity = { documentName: 'Activity', actor: hero };
        expect(advantageRollActor({ subject: activity })).toBe(hero);
    });

    it('prefers the Midi workflow actor when one is present', () => {
        const other = { documentName: 'Actor', id: 'other', uuid: 'Actor.other' };
        expect(advantageRollActor({ subject: other, workflow: { actor: hero } })).toBe(hero);
    });

    it('matches the HUD actor to a different document with the same uuid', () => {
        expect(sameActor(hero, heroClone)).toBe(true);
        expect(sameActor(hero, { documentName: 'Actor', id: 'orc', uuid: 'Actor.orc' })).toBe(false);
    });

    it('sets advantage and clears disadvantage so the roll is not cancelled', () => {
        const config = { disadvantage: true };
        expect(applyHudAdvantage(config, 'advBtn')).toBe(true);
        expect(config).toEqual({ advantage: true, disadvantage: false });
    });

    it('sets disadvantage the same way', () => {
        const config = { advantage: true };
        expect(applyHudAdvantage(config, 'disBtn')).toBe(true);
        expect(config).toEqual({ advantage: false, disadvantage: true });
    });

    it('leaves the roll alone when no button is selected', () => {
        const config = {};
        expect(applyHudAdvantage(config, undefined)).toBe(false);
        expect(config).toEqual({});
    });
});
