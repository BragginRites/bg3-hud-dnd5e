import { describe, it, expect } from 'vitest';
import { isHeldDocument, isTwoHandedWeapon } from '../ItemClassification.js';

describe('isHeldDocument', () => {
    it('returns false for a falsy item', () => {
        expect(isHeldDocument(null)).toBe(false);
        expect(isHeldDocument(undefined)).toBe(false);
    });

    it('weapons are always held', () => {
        expect(isHeldDocument({ type: 'weapon', system: {} })).toBe(true);
    });

    it('shield equipment is held, via system.type.value', () => {
        expect(isHeldDocument({ type: 'equipment', system: { type: { value: 'shield' } } })).toBe(true);
    });

    it('shield equipment is held, via legacy string system.type', () => {
        expect(isHeldDocument({ type: 'equipment', system: { type: 'shield' } })).toBe(true);
    });

    it('shield equipment is held, via system.armor.type', () => {
        expect(isHeldDocument({ type: 'equipment', system: { armor: { type: 'shield' } } })).toBe(true);
    });

    it('non-shield equipment is not held', () => {
        expect(isHeldDocument({ type: 'equipment', system: { type: { value: 'bonus' } } })).toBe(false);
        expect(isHeldDocument({ type: 'equipment', system: {} })).toBe(false);
    });

    it('wand consumables are held', () => {
        expect(isHeldDocument({ type: 'consumable', system: { type: { value: 'wand' } } })).toBe(true);
        expect(isHeldDocument({ type: 'consumable', system: { type: 'wand' } })).toBe(true);
    });

    it('non-wand consumables are not held', () => {
        expect(isHeldDocument({ type: 'consumable', system: { type: { value: 'potion' } } })).toBe(false);
    });

    it('other item types are never held', () => {
        expect(isHeldDocument({ type: 'feat', system: {} })).toBe(false);
        expect(isHeldDocument({ type: 'spell', system: {} })).toBe(false);
    });
});

describe('isTwoHandedWeapon', () => {
    it('returns false for a falsy item', () => {
        expect(isTwoHandedWeapon(null)).toBe(false);
        expect(isTwoHandedWeapon(undefined)).toBe(false);
    });

    it('returns false for non-weapon items regardless of properties', () => {
        expect(isTwoHandedWeapon({ type: 'equipment', system: { properties: new Set(['two']) } })).toBe(false);
    });

    it('detects the "two" property when properties is a Set (modern dnd5e)', () => {
        expect(isTwoHandedWeapon({ type: 'weapon', system: { properties: new Set(['two', 'fin']) } })).toBe(true);
        expect(isTwoHandedWeapon({ type: 'weapon', system: { properties: new Set(['fin']) } })).toBe(false);
    });

    it('detects the "two" property when properties is an Array (legacy dnd5e)', () => {
        expect(isTwoHandedWeapon({ type: 'weapon', system: { properties: ['two', 'fin'] } })).toBe(true);
        expect(isTwoHandedWeapon({ type: 'weapon', system: { properties: ['fin'] } })).toBe(false);
    });

    it('detects the "two" property when properties is a plain boolean map', () => {
        expect(isTwoHandedWeapon({ type: 'weapon', system: { properties: { two: true } } })).toBe(true);
        expect(isTwoHandedWeapon({ type: 'weapon', system: { properties: { two: false } } })).toBe(false);
        expect(isTwoHandedWeapon({ type: 'weapon', system: { properties: { fin: true } } })).toBe(false);
    });

    it('returns false when properties is missing entirely', () => {
        expect(isTwoHandedWeapon({ type: 'weapon', system: {} })).toBe(false);
        expect(isTwoHandedWeapon({ type: 'weapon', system: undefined })).toBe(false);
    });
});
