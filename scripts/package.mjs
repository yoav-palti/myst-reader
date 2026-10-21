import { mkdir, copyFile } from 'node:fs/promises';
const target = 'dist/myst-reader';
await mkdir(target, { recursive: true });
for (const name of ['main.js', 'manifest.json', 'styles.css']) await copyFile(name, `${target}/${name}`);
console.log(`Ready for installation: ${target}`);
