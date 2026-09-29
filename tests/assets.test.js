import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// Всё, что не попало в ASSETS в sw.js, не будет работать без интернета.
test('sw.js: все js-файлы есть в списке кэша', () => {
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const files = readdirSync(new URL('../js', import.meta.url), { recursive: true })
    .filter((f) => f.endsWith('.js'))
    .map((f) => `./js/${f}`);
  for (const f of files) assert.ok(sw.includes(`'${f}'`), `нет в ASSETS: ${f}`);
});
