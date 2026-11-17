// Contraste WCAG 2.x de los pares de texto del design system, en los dos temas.
//   node docs/redesign/design-system/scripts/check-contrast.mjs
// Sale con codigo 1 si algun par baja de su minimo. Misma aritmetica que packages/ui/src/tokens.test.ts.
import { readFileSync } from 'node:fs';
const t = JSON.parse(readFileSync(new URL('../tokens.json', import.meta.url), 'utf8'));
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const cr = (a, b) => { const [h, l] = [lum(a), lum(b)].sort((x, y) => y - x); return (h + 0.05) / (l + 0.05); };
const grounds = ['bg', 'surface', 'surface-raised', 'sunken'];
// [color, minimo, grounds]
const pairs = [
  ['ink', 7, grounds], ['ink-muted', 4.5, grounds], ['mark', 4.5, grounds], ['calc', 4.5, grounds],
  ['warning', 4.5, grounds], ['danger', 4.5, grounds], ['border', 3, grounds], ['focus', 3, grounds],
  ['on-accent', 7, ['accent']],
];
let fail = 0;
for (const theme of ['dark', 'light']) {
  const v = Object.fromEntries(t.color.tokens.map((x) => [x.name, x.value[theme]]));
  process.stdout.write(`\n== ${theme}` + '\n');
  for (const [fg, min, gs] of pairs) {
    const row = gs.map((g) => { const r = cr(v[fg], v[g]); if (r < min) fail++; return `${g} ${r.toFixed(2)}${r < min ? ' FAIL' : ''}`; });
    process.stdout.write(`${fg.padEnd(10)} (>=${min}) ${row.join(' | ')}` + '\n');
  }
  process.stdout.write(`grid/bg ${cr(v.grid, v.bg).toFixed(2)} · grid-major/bg ${cr(v['grid-major'], v.bg).toFixed(2)} (decorativo, objetivo 1.1-1.5)` + '\n');
}
process.exit(fail ? 1 : 0);
