import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveDnd5eNotice } from './resolveNotice.js';

describe('resolveDnd5eNotice', () => {
    it('maps selectedPassives flags to Passives', () => {
        const notice = resolveDnd5eNotice({
            flags: { 'bg3-hud-dnd5e': { selectedPassives: ['a'] } }
        });
        assert.deepEqual(notice.fills, ['passives']);
    });

    it('maps token-image flags to Face', () => {
        const notice = resolveDnd5eNotice({
            flags: { 'bg3-hud-dnd5e': { useTokenImage: true } }
        });
        assert.deepEqual(notice.fills, ['portrait:face']);
    });

    it('maps ADV flags to the situational-bonuses extra', () => {
        const notice = resolveDnd5eNotice({
            flags: { 'bg3-hud-dnd5e': { advState: 1 } }
        });
        assert.deepEqual(notice.extras, ['situationalBonuses']);
        assert.deepEqual(notice.fills, []);
    });

    it('maps spell slots to Filter and parked spell Cells', () => {
        const actor = {
            items: [
                { type: 'spell', uuid: 'Item.fireball' },
                { type: 'weapon', uuid: 'Item.sword' }
            ]
        };
        const notice = resolveDnd5eNotice({
            system: { spells: { spell3: { value: 1 } } }
        }, actor);
        assert.deepEqual(notice.fills, ['filter']);
        assert.deepEqual(notice.cells, { parked: ['Item.fireball'] });
    });

    it('maps spell slots to Filter without all-Cells when no parked spells', () => {
        const notice = resolveDnd5eNotice({
            system: { spells: { spell1: { value: 0 } } }
        }, { items: [] });
        assert.deepEqual(notice.fills, ['filter']);
        assert.equal(notice.cells, undefined);
    });

    it('does not map HP (Core default owns Vitals)', () => {
        const notice = resolveDnd5eNotice({
            system: { attributes: { hp: { value: 1 } } }
        });
        assert.deepEqual(notice.fills, []);
    });
});
