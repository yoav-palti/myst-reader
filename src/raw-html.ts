import { TFile, type App, type Component } from 'obsidian';
import type { Directive } from './myst';

/** Resolve only vault-relative files, never filesystem paths or remote URLs. */
export function htmlFilePath(sourcePath: string, requested: string): string {
  if (!requested || /[\\:\u0000-\u001f\u007f?#]/.test(requested) || requested.startsWith('/')) {
    throw new Error('Use a relative HTML file path inside this vault.');
  }
  const parts = sourcePath.split('/').slice(0, -1);
  for (const part of requested.split('/')) {
    if (part === '..') {
      if (!parts.length) throw new Error('The HTML file must stay inside this vault.');
      parts.pop();
    } else if (part && part !== '.') parts.push(part);
  }
  const path = parts.join('/');
  if (!/\.html?$/i.test(path)) throw new Error('The file must have an .html or .htm extension.');
  return path;
}

// Runs inside the isolated document. Only a height is sent back to Obsidian.
const measure = `<script>(()=>{
  let queued=false;
  const report=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{
    queued=false;parent.postMessage({type:'myst-reader-height',height:Math.ceil(document.body.getBoundingClientRect().height)+24},'*');
  });};
  new ResizeObserver(report).observe(document.body);
  addEventListener('load',report);report();
})();</script>`;

export async function renderRawHTML(
  app: App, block: Directive, target: HTMLElement, sourcePath: string,
  component: Component, changed: () => void,
): Promise<void> {
  const doc = target.ownerDocument;
  const win = doc.defaultView;
  let alive = true;
  let revision = 0;
  component.register(() => { alive = false; revision++; });
  let file: TFile | undefined;
  const requested = block.options.file;
  try {
    if (requested !== undefined) {
      const path = htmlFilePath(sourcePath, requested);
      const found = app.vault.getAbstractFileByPath(path);
      if (!(found instanceof TFile)) throw new Error(`HTML file not found: ${path}`);
      file = found;
    }
  } catch (error) {
    const message = doc.createElement('p');
    message.className = 'myst-reader-html-error';
    message.textContent = `MyST Reader: ${error instanceof Error ? error.message : String(error)}`;
    target.append(message);
    return;
  }

  const frame = doc.createElement('iframe');
  frame.className = 'myst-reader-html';
  frame.title = requested ? `Interactive HTML: ${requested}` : 'MyST interactive HTML';
  // Never add allow-same-origin: HTML scripts must not access Obsidian's DOM,
  // vault APIs, storage, or the desktop application's Node environment.
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.referrerPolicy = 'no-referrer';
  const resize = (event: MessageEvent) => {
    if (!alive || event.source !== frame.contentWindow || event.data?.type !== 'myst-reader-height') return;
    const height: unknown = event.data.height;
    if (typeof height !== 'number' || !Number.isFinite(height)) return;
    const pixels = `${Math.max(160, Math.min(12000, Math.ceil(height)))}px`;
    if (frame.style.height !== pixels) { frame.style.height = pixels; changed(); }
  };
  win?.addEventListener('message', resize);
  component.register(() => { win?.removeEventListener('message', resize); frame.remove(); });
  target.append(frame);

  const load = async () => {
    const current = ++revision;
    try {
      const html = file ? await app.vault.read(file) : block.body;
      if (!alive || current !== revision) return;
      // srcdoc preserves inline scripts and external HTTPS libraries, while the
      // opaque sandbox origin keeps them separate from the application.
      frame.srcdoc = '<!doctype html><html><head><meta charset="utf-8">'
        + '<meta name="viewport" content="width=device-width, initial-scale=1">'
        + '<style>html{background:transparent}body{margin:0;padding:8px;box-sizing:border-box;font-family:system-ui,sans-serif}</style>'
        + '</head><body>' + html + measure + '</body></html>';
      changed();
    } catch (error) {
      if (!alive || current !== revision) return;
      const message = doc.createElement('p');
      message.className = 'myst-reader-html-error';
      message.textContent = `MyST Reader: could not read HTML. ${String(error)}`;
      target.replaceChildren(message);
      changed();
    }
  };
  if (file) component.registerEvent(app.vault.on('modify', modified => {
    if (modified === file) void load();
  }));
  await load();
}
