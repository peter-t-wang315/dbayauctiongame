// Writes an HTML page that renders every sprite at 48px (and 24px), for eyeballing.
// Usage: pnpm --filter @dbay/content sprites:preview   (output is gitignored)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORY_SPRITES, SHARED_PALETTE, publicPack } from '../src/public';
import type { Sprite } from '../src/public';

function svg(s: Sprite, px: number): string {
  const colors: Record<string, string> = { ...SHARED_PALETTE, ...s.palette };
  const rects: string[] = [];
  s.rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const c = colors[ch];
      if (c) rects.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${c}"/>`);
    });
  });
  return `<svg width="${px}" height="${px}" viewBox="0 0 12 12" shape-rendering="crispEdges">${rects.join('')}</svg>`;
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const cards: string[] = [];
for (const cat of publicPack.categories) {
  cards.push(`<h2 style="border-color:${cat.accentHint}">${esc(cat.name)}</h2><div class="grid">`);
  cards.push(
    `<div class="card fallback">${svg(CATEGORY_SPRITES[cat.id], 48)}<span>fallback</span></div>`,
  );
  for (const item of publicPack.items.filter((i) => i.category === cat.id)) {
    const s = item.sprite;
    cards.push(
      `<div class="card">${s ? svg(s, 48) + svg(s, 24) : '<em>none</em>'}<span>${esc(item.name)}</span></div>`,
    );
  }
  cards.push('</div>');
}

cards.push('<h2>Specials</h2><div class="grid">');
for (const sp of publicPack.specials.filter((x) => x.id.endsWith('-1'))) {
  const s = sp.sprite;
  cards.push(
    `<div class="card">${s ? svg(s, 48) + svg(s, 24) : '<em>none</em>'}<span>${esc(sp.name)}</span></div>`,
  );
}
cards.push('</div>');

const html = `<!doctype html><meta charset="utf-8"><title>dBay sprites</title>
<style>
body{font:14px system-ui;background:#FBF3DF;color:#0E1511;margin:16px}
h2{border-bottom:4px solid;padding-bottom:4px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.card{background:#fff;border:2px solid #0E1511;border-radius:6px;padding:8px;display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end}
.card span{flex-basis:100%;font-size:12px}
.fallback{background:#EEE}
</style>
<h1>dBay sprites (${publicPack.items.filter((i) => i.sprite).length} / ${publicPack.items.length} items)</h1>
${cards.join('\n')}`;

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../.preview/sprites.html');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`wrote ${out}`);
