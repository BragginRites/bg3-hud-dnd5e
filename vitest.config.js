import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Only collect our Vitest-authored suites. scripts/notice/resolveNotice.test.js
        // predates this harness and uses node:test directly (run it with `node --test`),
        // so it is intentionally excluded here to avoid double-registration.
        include: ['scripts/features/__tests__/**/*.test.js']
    }
});
