import { defineConfig } from 'vitest/config';

// tsconfig keeps `jsx: preserve` for Next; tests transform JSX themselves (component render tests).
export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
});
