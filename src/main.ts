import {
  Component, debounce, ItemView, MarkdownRenderer, MarkdownRenderChild, Notice, Plugin, TFile,
  type MarkdownPostProcessorContext, type ViewStateResult, type WorkspaceLeaf,
} from 'obsidian';
import { DIRECTIVES, parseContent, renderDirective, transformMyST, type Directive } from './myst';
import { livePreviewExtension } from './live-preview';

const VIEW_TYPE = 'myst-reader-preview';

class MySTView extends ItemView {
  private file: TFile | null = null;
  private rendered: Component | null = null;
  private revision = 0;
  private readonly scheduleRender = debounce((source?: string) => { void this.render(source); }, 180, true);

  getViewType(): string { return VIEW_TYPE; }
  getDisplayText(): string { return this.file ? `MyST: ${this.file.basename}` : 'MyST preview'; }
  getIcon(): string { return 'book-open'; }
  getState(): Record<string, unknown> { return { file: this.file?.path }; }

  async setState(state: { file?: string }, result: ViewStateResult): Promise<void> {
    const file = state.file ? this.app.vault.getAbstractFileByPath(state.file) : null;
    if (file instanceof TFile && file.extension === 'md') this.file = file;
    await super.setState(state, result);
    await this.render();
  }

  async onOpen(): Promise<void> {
    this.contentEl.addClass('myst-reader-view');
    this.file ??= this.app.workspace.getActiveFile();
    this.registerEvent(this.app.workspace.on('file-open', file => {
      if (file?.extension === 'md') { this.file = file; this.scheduleRender(); }
    }));
    this.registerEvent(this.app.workspace.on('editor-change', (editor, info) => {
      if (info.file?.path === this.file?.path) this.scheduleRender(editor.getValue());
    }));
    this.registerEvent(this.app.vault.on('modify', file => {
      if (file === this.file) this.scheduleRender();
    }));
    this.registerEvent(this.app.vault.on('delete', file => {
      if (file === this.file) { this.file = null; this.scheduleRender(); }
    }));
    this.addAction('refresh-cw', 'Refresh MyST preview', () => this.scheduleRender());
    await this.render();
  }

  async onClose(): Promise<void> {
    this.revision++;
    this.scheduleRender.cancel();
    if (this.rendered) this.removeChild(this.rendered);
    this.rendered = null;
  }

  private async render(source?: string): Promise<void> {
    const revision = ++this.revision;
    const file = this.file;
    const component = this.addChild(new Component());
    const container = this.contentEl.createDiv({ cls: 'myst-reader-staging' });
    // Render in a detached container, then commit only the newest request.
    container.remove();
    container.addClasses(['markdown-rendered', 'myst-reader-content']);
    container.setAttribute('dir', 'auto');
    try {
      if (!file || file.extension !== 'md') {
        container.createEl('p', { text: 'Open a Markdown note to preview its MyST content.' });
      } else {
        const markdown = source ?? await this.app.vault.cachedRead(file);
        await MarkdownRenderer.render(this.app, transformMyST(markdown), container, file.path, component);
      }
      if (revision !== this.revision) { this.removeChild(component); return; }
      const scroll = this.contentEl.scrollTop;
      if (this.rendered) this.removeChild(this.rendered);
      this.rendered = component;
      this.contentEl.replaceChildren(container);
      this.contentEl.scrollTop = scroll;
    } catch (error) {
      this.removeChild(component);
      console.error('MyST Reader: preview rendering failed', error);
      if (revision === this.revision) new Notice(`MyST Reader: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/** The host passes the body, so recover a custom title from the source section. */
function directiveFromProcessor(name: string, source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): Directive {
  const info = ctx.getSectionInfo(el);
  const lines = info?.text.split('\n').slice(info.lineStart, info.lineEnd + 1) ?? [];
  const start = lines.find(line => new RegExp('^ {0,3}`{3,}\\{' + name + '\\}(?:[ \\t]|$)').test(line));
  const argument = start?.replace(/^ {0,3}`{3,}\{[^}]+\}\s*/, '').trim() ?? '';
  const body = source.replace(/\r\n?/g, '\n').replace(/\n$/, '');
  return { kind: 'directive', name, argument, ...parseContent(body), raw: source };
}

export default class MySTReader extends Plugin {
  onload(): void {
    this.registerView(VIEW_TYPE, leaf => new MySTView(leaf));
    this.addCommand({ id: 'open-preview', name: 'Open MyST preview', callback: () => { void this.openPreview(); } });
    this.addRibbonIcon('book-open', 'Open MyST preview', () => { void this.openPreview(); });
    this.registerEditorExtension(livePreviewExtension(this));
    // Obsidian interpolates code-block language names into a CSS selector.
    // Registering "{admonition}" there makes every Markdown render throw.
    // Inspect class tokens through a generic postprocessor instead.
    this.registerMarkdownPostProcessor(async (el, ctx) => {
      const blocks = el.tagName === 'PRE' ? [el] : Array.from(el.querySelectorAll<HTMLElement>('pre'));
      for (const pre of blocks) {
        if (pre.dataset.mystReader) continue;
        const code = pre.querySelector<HTMLElement>('code');
        if (!code) continue;
        const language = Array.from(code.classList).find(value => /^language-\{[\w-]+\}$/.test(value));
        const name = language?.slice('language-{'.length, -1);
        if (!name || !DIRECTIVES.includes(name)) continue;
        pre.dataset.mystReader = 'rendering';
        const block = directiveFromProcessor(name, code.textContent ?? '', pre, ctx);
        const container = pre.ownerDocument.createElement('div');
        container.className = 'myst-reader-content';
        container.setAttribute('dir', 'auto');
        pre.after(container);
        const child = new MarkdownRenderChild(container);
        ctx.addChild(child);
        try {
          await MarkdownRenderer.render(this.app, renderDirective(block), container, ctx.sourcePath, child);
          pre.remove();
        } catch (error) {
          container.remove();
          child.unload();
          delete pre.dataset.mystReader;
          console.error('MyST Reader: directive rendering failed', error);
        }
      }
    });
  }

  private async openPreview(): Promise<void> {
    let leaf: WorkspaceLeaf | undefined = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = this.app.workspace.getLeaf('split');
      await leaf.setViewState({ type: VIEW_TYPE, active: true, state: { file: this.app.workspace.getActiveFile()?.path } });
    }
    await this.app.workspace.revealLeaf(leaf);
  }
}
