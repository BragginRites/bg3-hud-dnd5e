import { describe, it, expect } from 'vitest';
import { DnD5eAutoSort } from '../DnD5eAutoSort.js';

describe('DnD5eAutoSort.sortItems', () => {
    const sort = new DnD5eAutoSort();

    it('orders items by the D&D 5e type priority: weapon, feat, equipment, spell, consumable, tool, loot', async () => {
        const items = [
            { name: 'Loot', type: 'loot' },
            { name: 'Tool', type: 'tool' },
            { name: 'Potion', type: 'consumable' },
            { name: 'Fireball', type: 'spell' },
            { name: 'Shield', type: 'equipment' },
            { name: 'Feat', type: 'feat' },
            { name: 'Sword', type: 'weapon' }
        ];
        await sort.sortItems(items);
        expect(items.map((i) => i.name)).toEqual([
            'Sword', 'Feat', 'Shield', 'Fireball', 'Potion', 'Tool', 'Loot'
        ]);
    });

    it('sorts a type not in typeOrder last, after every known type', async () => {
        const items = [
            { name: 'Mystery', type: 'something-else' },
            { name: 'Sword', type: 'weapon' },
            { name: 'Loot', type: 'loot' }
        ];
        await sort.sortItems(items);
        expect(items.map((i) => i.name)).toEqual(['Sword', 'Loot', 'Mystery']);
    });

    it('secondary-sorts spells by spellLevel ascending (cantrips are level 0)', async () => {
        const items = [
            { name: 'Fireball', type: 'spell', sortData: { spellLevel: 3 } },
            { name: 'Fire Bolt', type: 'spell', sortData: { spellLevel: 0 } },
            { name: 'Magic Missile', type: 'spell', sortData: { spellLevel: 1 } }
        ];
        await sort.sortItems(items);
        expect(items.map((i) => i.name)).toEqual(['Fire Bolt', 'Magic Missile', 'Fireball']);
    });

    it('secondary-sorts feats by featureType via localeCompare', async () => {
        const items = [
            { name: 'Passive Feat', type: 'feat', sortData: { featureType: 'passive' } },
            { name: 'Active Feat', type: 'feat', sortData: { featureType: 'active' } }
        ];
        await sort.sortItems(items);
        expect(items.map((i) => i.name)).toEqual(['Active Feat', 'Passive Feat']);
    });

    it('falls back to alphabetical order when type and secondary key are equal', async () => {
        const items = [
            { name: 'Zed', type: 'weapon' },
            { name: 'Alpha', type: 'weapon' },
            { name: 'Mid', type: 'weapon' }
        ];
        await sort.sortItems(items);
        expect(items.map((i) => i.name)).toEqual(['Alpha', 'Mid', 'Zed']);
    });

    it('falls back to sortData.name when item.name is absent, then to empty string', async () => {
        const items = [
            { type: 'weapon', sortData: { name: 'Alpha' } },
            { type: 'weapon' }
        ];
        await sort.sortItems(items);
        expect(items.map((i) => i.name || i.sortData?.name || '')).toEqual(['', 'Alpha']);
    });
});
