import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { build } from 'esbuild';
import { Window } from 'happy-dom';
import * as cmState from '@codemirror/state';
import * as cmView from '@codemirror/view';

const bundle = await build({
  entryPoints: ['src/main.ts'], bundle: true, platform: 'node', format: 'cjs',
  external: ['obsidian', '@codemirror/state', '@codemirror/view'], write: false,
});

function createHost() {
  const document = new Window().document;
  const postprocessors = [];
  const codeprocessors = [];
  const rendered = [];
  const children = [];
  const editorExtensions = [];
  const liveField = cmState.StateField.define({ create: () => true, update: value => value });
  const infoField = cmState.StateField.define({ create: () => ({ file: { path: 'note.md' } }), update: value => value });
  let failRender = false;
  class Component {
    addChild(child) { return child; }
    unload() {}
  }
  class Plugin extends Component {
    app = {};
    registerView() {}
    addCommand() {}
    addRibbonIcon() {}
    registerEditorExtension(extension) { editorExtensions.push(extension); }
    registerMarkdownPostProcessor(fn) { postprocessors.push(fn); }
    registerMarkdownCodeBlockProcessor(language, handler) { codeprocessors.push({ language, handler }); }
  }
  const api = {
    Component, Plugin, ItemView: Component, TFile: class {},
    editorInfoField: infoField, editorLivePreviewField: liveField,
    MarkdownRenderChild: class extends Component {},
    Notice: class {}, debounce: fn => fn,
    MarkdownRenderer: { async render(app, markdown, el) {
      // Match Obsidian's actual selector contract: braces in a registered
      // language invalidate this selector, even when the note has no code.
      for (const { language } of codeprocessors) el.querySelectorAll('code.language-' + language);
      if (failRender) throw new Error('Host render failure');
      rendered.push(markdown);
      el.textContent = markdown;
    } },
  };
  const module = { exports: {} };
  vm.runInNewContext(bundle.outputFiles[0].text, {
    module, exports: module.exports,
    require: name => {
      if (name === '@codemirror/state') return cmState;
      if (name === '@codemirror/view') return cmView;
      assert.equal(name, 'obsidian'); return api;
    },
    console: { error() {} },
  });
  const plugin = new module.exports.default();
  plugin.onload();
  const context = {
    sourcePath: 'LTI/impulse_response.md',
    getSectionInfo: () => ({
      text: '```{admonition} מערכות LTI\n:class: tip\n\n$$x\\ast h$$\n```',
      lineStart: 0, lineEnd: 5,
    }),
    addChild: child => children.push(child),
  };
  function codeBlock(language, source) {
    const root = document.createElement('div');
    const pre = document.createElement('pre');
    const code = document.createElement('code');
    code.className = 'language-' + language;
    code.textContent = source;
    pre.append(code);
    root.append(pre);
    document.body.append(root);
    return { root, pre, code };
  }
  return {
    document, api, context, postprocessors, rendered, codeBlock, editorExtensions, liveField, infoField,
    failRendering: () => { failRender = true; },
  };
}

test('registering the plugin does not break ordinary Markdown rendering', async () => {
  const host = createHost();
  await assert.doesNotReject(host.api.MarkdownRenderer.render({}, 'Plain note', host.document.createElement('div')));
  assert.equal(host.postprocessors.length, 1);
});

test('Live Preview renders inactive directives and exposes source when the cursor enters', () => {
  const host = createHost();
  const field = host.editorExtensions[0];
  const doc = 'Before\n\n```{admonition} Test\nHello\n```\n\nAfter';
  const state = cmState.EditorState.create({ doc, extensions: [host.liveField, host.infoField, field] });
  assert.equal(state.field(field).size, 1);
  const editing = state.update({ selection: { anchor: doc.indexOf('Hello') } }).state;
  assert.equal(editing.field(field).size, 0);
  const outside = editing.update({ selection: { anchor: doc.length } }).state;
  assert.equal(outside.field(field).size, 1);
});

test('Live Preview leaves ordinary fenced examples and source mode alone', () => {
  const host = createHost();
  const field = host.editorExtensions[0];
  const doc = 'Before\n\n````markdown\n```{note}\nLiteral\n```\n````';
  const state = cmState.EditorState.create({ doc, extensions: [host.liveField, field] });
  assert.equal(state.field(field).size, 0);
  const source = cmState.EditorState.create({ doc: ':::{note}\nText\n:::', extensions: [field] });
  assert.equal(source.field(field).size, 0);
});

test('the host adapter processes curly-braced language classes with Hebrew titles and math', async () => {
  const host = createHost();
  const { root } = host.codeBlock('{admonition}', ':class: tip\n\n$$x\\ast h$$\n');
  await host.postprocessors[0](root, host.context);
  assert.equal(root.querySelector('pre'), null);
  assert.equal(root.querySelector('.myst-reader-content')?.getAttribute('dir'), 'auto');
  assert.equal(host.rendered[0], '> [!tip] מערכות LTI\n> $$x\\ast h$$');
});

test('the host adapter supports a pre element as its root', async () => {
  const host = createHost();
  const { root, pre } = host.codeBlock('{admonition}', ':class: tip\n\nHello');
  await host.postprocessors[0](pre, host.context);
  assert.equal(root.querySelector('pre'), null);
  assert.match(root.textContent, /Hello/);
});

test('ordinary code and unsupported directives are untouched', async () => {
  for (const language of ['python', '{include}']) {
    const host = createHost();
    const { root, pre } = host.codeBlock(language, 'literal source');
    await host.postprocessors[0](root, host.context);
    assert.equal(root.querySelector('pre'), pre);
    assert.equal(host.rendered.length, 0);
  }
});

test('a rendering failure keeps the original code readable', async () => {
  const host = createHost();
  host.failRendering();
  const { root, pre } = host.codeBlock('{admonition}', 'Original source');
  await host.postprocessors[0](root, host.context);
  assert.equal(root.querySelector('pre'), pre);
  assert.equal(root.querySelector('.myst-reader-content'), null);
  assert.equal(pre.textContent, 'Original source');
  assert.equal(pre.dataset.mystReader, undefined);
});
