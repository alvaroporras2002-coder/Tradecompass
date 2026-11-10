import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { extname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'dist');

async function files(directory) {
  const result = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    if (item.isDirectory()) result.push(...await files(resolve(directory, item.name)));
    else if (item.isFile()) result.push(resolve(directory, item.name));
  }
  return result.sort();
}

if (process.argv.includes('--check')) {
  let count = 0;
  for (const folder of ['src', 'server', 'scripts', 'tests', 'public']) {
    for (const path of await files(resolve(root, folder))) {
      if (!['.js', '.mjs'].includes(extname(path))) continue;
      const result = spawnSync(process.execPath, ['--check', path], { stdio: 'inherit' });
      if (result.status !== 0) process.exit(result.status || 1);
      count++;
    }
  }
  console.log(`Sintaxis verificada: ${count} módulos.`);
  process.exit(0);
}

await rm(output, { recursive: true, force: true });
await mkdir(resolve(output, 'client'), { recursive: true });
await mkdir(resolve(output, 'server'), { recursive: true });
await cp(resolve(root, 'public'), resolve(output, 'client'), { recursive: true });
await cp(resolve(root, 'src'), resolve(output, 'client/src'), { recursive: true });

const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8'
};
const assets = {};
let size = 0;
for (const path of await files(resolve(output, 'client'))) {
  const data = await readFile(path);
  size += data.length;
  assets['/' + relative(resolve(output, 'client'), path).replaceAll('\\', '/')] = {
    body: data.toString('base64'), type: mime[extname(path)] || 'application/octet-stream'
  };
}
if (!assets['/index.html']) throw new Error('Falta public/index.html; no se puede publicar.');
const extensionSource = (await readFile(resolve(root, 'src/extensions.js'), 'utf8')).replace('export function validExtensions', 'function validExtensions');
const backend = extensionSource + '\n' + (await readFile(resolve(root, 'server/worker.js'), 'utf8')).replace("import { validExtensions } from '../src/extensions.js';", '');
await writeFile(resolve(output, 'server/index.js'), `${backend}\nconst assets = ${JSON.stringify(assets)};\nexport default createWorker(assets);\n`);
console.log(`Compilado: ${Object.keys(assets).length} recursos, ${(size / 1024).toFixed(1)} KiB de cliente; Worker y GitHub Pages listos.`);
