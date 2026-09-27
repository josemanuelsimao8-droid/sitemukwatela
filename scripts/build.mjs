import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { minify } from 'terser';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');

const excluded = new Set(['.git', 'node_modules', 'dist', '.vercel', '.DS_Store', 'package.json', 'package-lock.json']);

async function copyTree(src, dest) {
  await mkdir(dest, { recursive: true });
  for (const entry of await readdir(src, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue;
    const from = join(src, entry.name);
    const to = join(dest, entry.name);
    if (entry.isDirectory()) await copyTree(from, to);
    else await cp(from, to);
  }
}

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else if (entry.isFile() && entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

await cp(join(root, 'dist'), join(root, '.vercel-build-backup'), { recursive: true, force: true }).catch(() => {});
await cp(join(root, 'dist'), join(root, 'dist'), { recursive: true, force: true }).catch(() => {});
await copyTree(root, dist);

const jsFiles = await walk(join(dist, 'js'));
let minified = 0;
for (const file of jsFiles) {
  const source = await readFile(file, 'utf8');
  const result = await minify(source, {
    compress: { passes: 2 },
    mangle: true,
    format: { comments: false }
  });
  if (!result.code) throw new Error(`Minification produced empty output: ${relative(root, file)}`);
  await writeFile(file, result.code + '\n', 'utf8');
  minified++;
}

console.log(`Production build complete: copied static site and minified ${minified} JavaScript files.`);
