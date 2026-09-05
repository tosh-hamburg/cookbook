import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // index.ts (Prozessstart) und stdio.ts (bindet an process.stdin) lassen
      // sich nur im laufenden Prozess prüfen — dafür gibt es den Rauchtest
      // "npm run build && node dist/index.js".
      exclude: ['src/**/*.test.ts', 'src/test-utils.ts', 'src/index.ts', 'src/transport/stdio.ts'],
      thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
    },
  },
});
