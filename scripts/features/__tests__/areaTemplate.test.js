import { describe, expect, it } from 'vitest';
import { canvasTemplateFor, isKnownAreaType, resolveActivityTemplate } from '../../utils/DnD5eTargetingRules.js';

const dnd5e5Areas = {
    radius: { template: 'circle' },
    sphere: { template: 'circle' },
    cone: { template: 'cone' }
};

const dnd5e6Areas = {
    radius: { template: 'emanation' },
    ring: { template: 'ring' },
    sphere: { template: 'circle' },
    cone: { template: 'cone' }
};

describe('area templates across dnd5e 5 and 6', () => {
    it('keeps a 5.x emanation as a placed circle', () => {
        const resolved = resolveActivityTemplate({ type: 'radius', size: '10' }, dnd5e5Areas);
        expect(resolved.type).toBe('radius');
        expect(resolved.canvas).toBe('circle');
        expect(canvasTemplateFor('radius', dnd5e5Areas)).toBe('circle');
    });

    it('marks a 6.x emanation so Core can attach it to the caster', () => {
        const resolved = resolveActivityTemplate({ type: 'radius', size: '10' }, dnd5e6Areas);
        expect(resolved.type).toBe('radius');
        expect(resolved.canvas).toBe('emanation');
    });

    it('accepts a 6.x ring and leaves the area key intact', () => {
        const resolved = resolveActivityTemplate({ type: 'ring', size: '20', width: '5' }, dnd5e6Areas);
        expect(resolved).toMatchObject({ type: 'ring', canvas: 'ring', size: '20', width: '5' });
    });

    it('still recognises radius and ring when the system table is missing', () => {
        expect(isKnownAreaType('radius', null)).toBe(true);
        expect(isKnownAreaType('ring', null)).toBe(true);
        expect(resolveActivityTemplate({ type: 'radius', size: '10' }, null).canvas).toBeUndefined();
    });

    it('does not treat a creature target as an area', () => {
        expect(resolveActivityTemplate({ type: '' }, dnd5e6Areas)).toBeNull();
        expect(isKnownAreaType('ally', dnd5e6Areas)).toBe(false);
    });
});
