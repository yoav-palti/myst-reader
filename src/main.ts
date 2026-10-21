import {
  MarkdownRenderer, MarkdownRenderChild, Plugin, TFile,
  type MarkdownPostProcessorContext,
} from 'obsidian';
import { DIRECTIVES, parseContent, renderDirective, type Directive } from './myst';
import { livePreviewExtension } from './live-preview';

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
    this.registerEditorExtension(livePreviewExtension(this));
    this.app.workspace.onLayoutReady(() => { void this.migrateLegacyPanes(); });
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

  private async migrateLegacyPanes(): Promise<void> {
    const workspace = this.app.workspace;
    for (const leaf of workspace.getLeavesOfType('myst-reader-preview')) {
      const path: unknown = leaf.getViewState().state?.file;
      const alreadyOpen = workspace.getLeavesOfType('markdown')
        .some(normal => normal.getViewState().state?.file === path);
      if (typeof path !== 'string' || alreadyOpen || !(this.app.vault.getAbstractFileByPath(path) instanceof TFile)) {
        leaf.detach();
      } else {
        // Preserve a file that was open only in the retired pane as a normal note.
        try {
          await leaf.setViewState({ type: 'markdown', state: { file: path, mode: 'preview' } });
        } catch (error) {
          console.error('MyST Reader: could not reopen the legacy pane as a note', error);
        }
      }
    }
  }
}
