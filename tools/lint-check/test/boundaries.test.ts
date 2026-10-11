// Proves the import-boundary and purity rules in eslint.config.mjs actually fire (WS0 acceptance).
import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const eslint = new ESLint({ cwd: root });

async function ruleIds(code: string, file: string) {
  const [result] = await eslint.lintText(code, { filePath: join(root, file) });
  return result!.messages.map((m) => m.ruleId);
}

describe('import boundaries', () => {
  it('apps/web cannot import the engine, room-core or full content', async () => {
    for (const mod of ['@dbay/engine', '@dbay/room-core', '@dbay/content']) {
      expect(
        await ruleIds(`import x from '${mod}';\nexport default x;\n`, 'apps/web/app/bad.ts'),
      ).toContain('no-restricted-imports');
    }
  });

  it('apps/web may import protocol and public content', async () => {
    const code = `import { CATEGORIES } from '@dbay/content/public';\nimport { PROTOCOL_VERSION } from '@dbay/protocol';\nexport const x = [CATEGORIES, PROTOCOL_VERSION];\n`;
    expect(await ruleIds(code, 'apps/web/app/ok.ts')).toEqual([]);
  });

  it('protocol imports no workspace packages', async () => {
    expect(
      await ruleIds(
        `import x from '@dbay/content';\nexport default x;\n`,
        'packages/protocol/src/bad.ts',
      ),
    ).toContain('no-restricted-imports');
  });

  it('room-core reaches content only through the engine', async () => {
    expect(
      await ruleIds(
        `import x from '@dbay/content';\nexport default x;\n`,
        'packages/room-core/src/bad.ts',
      ),
    ).toContain('no-restricted-imports');
  });

  it('apps/server cannot import engine internals', async () => {
    expect(
      await ruleIds(`import x from '@dbay/engine';\nexport default x;\n`, 'apps/server/src/bad.ts'),
    ).toContain('no-restricted-imports');
  });
});

describe('purity rules', () => {
  for (const pkg of ['engine', 'room-core', 'content']) {
    it(`${pkg} cannot read the clock or Math.random`, async () => {
      const ids = await ruleIds(
        `export const a = Date.now();\nexport const b = Math.random();\nexport const c = new Date();\n`,
        `packages/${pkg}/src/bad.ts`,
      );
      expect(ids.filter((id) => id === 'no-restricted-properties')).toHaveLength(2);
      expect(ids).toContain('no-restricted-syntax');
    });
  }
});
