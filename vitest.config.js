import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// DnD5eAutoSort.js (and other adapter files) import their base framework classes from
// the sibling bg3-hud-core module via a Foundry-VTT-absolute path, e.g.:
//   import { AutoSortFramework } from '/modules/bg3-hud-core/scripts/features/AutoSortFramework.js';
// That path is only resolvable by a running Foundry server, so it doesn't exist on disk.
// Alias it to the real file in the sibling bg3-hud-core checkout (repos are siblings
// under the same workspace root) so DnD5eAutoSort.test.js exercises the actual shared
// `compareByTypeThenKey` comparator rather than a stand-in. Both aliased files are safe
// to load standalone: neither touches Foundry globals at module-load time (only lazily,
// inside try/catch, at call time).
const coreFeatures = fileURLToPath(new URL('../bg3-hud-core/scripts/features/', import.meta.url));
const coreUtils = fileURLToPath(new URL('../bg3-hud-core/scripts/utils/', import.meta.url));

export default defineConfig({
    resolve: {
        alias: [
            { find: '/modules/bg3-hud-core/scripts/features/AutoSortFramework.js', replacement: `${coreFeatures}AutoSortFramework.js` },
            { find: '/modules/bg3-hud-core/scripts/utils/logger.js', replacement: `${coreUtils}logger.js` }
        ]
    },
    test: {
        // Only collect our Vitest-authored suites. scripts/notice/resolveNotice.test.js
        // predates this harness and uses node:test directly (run it with `node --test`),
        // so it is intentionally excluded here to avoid double-registration.
        include: ['scripts/features/__tests__/**/*.test.js']
    }
});
