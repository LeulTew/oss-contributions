import { cp, lstat, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve, join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { manifestHash, readSnapshot, validateManifest, validateQuotes } from './collect.mjs';

async function vendorMarkdown(dist) {
  const marked = fileURLToPath(import.meta.resolve('marked'));
  const parse5 = dirname(fileURLToPath(import.meta.resolve('parse5')));
  const entities = dirname(fileURLToPath(import.meta.resolve('entities/decode')));
  const vendor = resolve(dist, 'vendor');
  await mkdir(vendor, { recursive: true });
  await cp(marked, resolve(vendor, 'marked.mjs'));
  async function copyModules(source, target, rewrite = false) {
    await mkdir(target, { recursive: true });
    for (const item of await readdir(source, { withFileTypes: true })) {
      const from = join(source, item.name), to = join(target, item.name);
      if (item.isDirectory()) await copyModules(from, to, rewrite);
      else if (item.name.endsWith('.js')) {
        let content = await readFile(from, 'utf8');
        if (rewrite) content = content.replace(/from (['"])entities\/(decode|escape)\1/g, (_, quote, module) => {
          const path = relative(dirname(to), resolve(vendor, 'entities', `${module}.js`)).split(sep).join('/');
          return `from ${quote}${path.startsWith('.') ? path : `./${path}`}${quote}`;
        });
        await writeFile(to, content);
      }
    }
  }
  await copyModules(parse5, resolve(vendor, 'parse5'), true);
  await copyModules(entities, resolve(vendor, 'entities'));
  const notices = [];
  for (const root of [dirname(dirname(marked)), dirname(parse5), dirname(entities)]) {
    const metadata = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
    const license = (await readdir(root)).find(name => /^LICENSE(?:\.[a-z]+)?$/i.test(name));
    if (!license) throw new Error('Missing parser redistribution license.');
    notices.push(`${metadata.name} ${metadata.version} (${metadata.license})\n\n${await readFile(resolve(root, license), 'utf8')}`);
  }
  await writeFile(resolve(dist, 'THIRD-PARTY-LICENSES.txt'), notices.join('\n\n---\n\n'));
}

export async function build(root = process.cwd()) {
  const manifest = validateManifest(JSON.parse(await readFile(resolve(root, 'config', 'contributions.json'), 'utf8')));
  const quotes = validateQuotes(JSON.parse(await readFile(resolve(root, 'config', 'quotes.json'), 'utf8')));
  const data = JSON.parse(await readFile(resolve(root, 'site', 'data.json'), 'utf8'));
  if (data.schemaVersion !== 2 || data.manifestHash !== manifestHash(manifest) || readSnapshot(data, manifest).size !== manifest.length ||
      !Number.isFinite(Date.parse(data.fetchedAt)) || data.refreshMinutes !== 15) throw new Error('Invalid collected data.');
  const files = [];
  async function inspect(directory, relative = '') {
    for (const name of await readdir(directory)) {
      if (name.startsWith('.')) throw new Error('Hidden site content is not publishable.');
      const path = join(directory, name);
      const stat = await lstat(path);
      if (stat.isSymbolicLink()) throw new Error('Site symlinks are not publishable.');
      const local = join(relative, name);
      if (stat.isDirectory()) await inspect(path, local);
      else if (stat.isFile() && /\.(html|css|js|mjs|json|svg|png|jpe?g|webp|ico|woff2?|txt)$/i.test(name)) files.push(local);
      else throw new Error('Unexpected site content is not publishable.');
    }
  }
  await inspect(resolve(root, 'site'));
  if (!files.includes('index.html') || !files.includes('data.json')) throw new Error('Missing site entry point.');
  const dist = resolve(root, 'dist');
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  for (const file of files) {
    await mkdir(resolve(dist, file, '..'), { recursive: true });
    await cp(resolve(root, 'site', file), resolve(dist, file));
  }
  if (files.includes('markdown.mjs')) {
    const module = await readFile(resolve(dist, 'markdown.mjs'), 'utf8');
    await vendorMarkdown(dist);
    await writeFile(resolve(dist, 'markdown.mjs'), module
      .replace("from 'marked'", "from './vendor/marked.mjs'")
      .replace("from 'parse5'", "from './vendor/parse5/index.js'"));
  }
  await mkdir(resolve(dist, 'config'), { recursive: true });
  await writeFile(resolve(dist, 'config', 'contributions.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(resolve(dist, 'config', 'quotes.json'), `${JSON.stringify(quotes, null, 2)}\n`);
  await writeFile(resolve(dist, 'catalog.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(resolve(dist, 'fallback.json'), `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Built ${files.length} site files, public manifests, identity catalog, and verified fallback into dist.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build().catch(() => {
    console.error('Build failed: verify collected data and public site files.');
    process.exitCode = 1;
  });
}
