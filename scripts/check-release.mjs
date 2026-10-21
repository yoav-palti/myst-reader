import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const readJson = async name => JSON.parse(await readFile(name, 'utf8'));
const manifest = await readJson('manifest.json');
const pkg = await readJson('package.json');
const versions = await readJson('versions.json');
assert.match(manifest.id, /^[a-z]+(?:-[a-z]+)*$/);
assert.ok(!manifest.id.includes('obsidian') && !manifest.id.endsWith('plugin'));
assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
assert.equal(manifest.version, pkg.version);
assert.equal(versions[manifest.version], manifest.minAppVersion);
assert.ok(manifest.author && manifest.description.endsWith('.') && manifest.description.length <= 250);
assert.equal(manifest.isDesktopOnly, false);
for (const file of ['main.js', 'styles.css', 'LICENSE', 'README.md']) assert.ok((await stat(file)).size > 0);
const bundle = await readFile('main.js', 'utf8');
assert.ok(bundle.includes('module.exports'));
assert.ok(!/\brequire\(["'](?:fs|child_process|electron)["']\)/.test(bundle));
console.log(`Release assets validated: ${manifest.name} ${manifest.version}`);
