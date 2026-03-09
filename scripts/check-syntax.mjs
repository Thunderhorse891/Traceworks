import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

async function walk(dir) {
  const entries = await readdir(dir);
  const out = [];
  for (const entry of entries) {
    const p = join(dir, entry);
    const s = await stat(p);
    if (s.isDirectory()) out.push(...(await walk(p)));
    else if (p.endsWith('.js') || p.endsWith('.mjs')) out.push(p);
  }
  return out;
}

const files = await walk('netlify/functions');
files.push('public/app.js');

for (const file of files) {
  const r = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
console.log(`Syntax check passed for ${files.length} files.`);
