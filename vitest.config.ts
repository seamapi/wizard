import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@seamapi/makenew-tsmodule': new URL('./src/index.ts', import.meta.url)
        .pathname,
      lib: new URL('./src/lib', import.meta.url).pathname,
    },
  },
  test: {
    coverage: {
      exclude: [
        '**/index.ts',
        'package/**/*.ts',
        'examples/**/*.ts',
        '**/*.test.ts',
      ],
      provider: 'v8',
      reporter: ['html', 'lcov', 'text'],
    },
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
  },
})
