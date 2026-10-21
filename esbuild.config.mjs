import * as esbuild from 'esbuild';

const options = {
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: ['obsidian', '@codemirror/state', '@codemirror/view'],
  format: 'cjs',
  target: 'es2020',
  outfile: 'main.js',
  sourcemap: false,
  minify: false,
  treeShaking: true,
  banner: { js: '/* MyST Reader | MIT License | Source: src/ */' },
};

if (process.argv.includes('--watch')) {
  const context = await esbuild.context(options);
  await context.watch();
} else {
  await esbuild.build(options);
}
