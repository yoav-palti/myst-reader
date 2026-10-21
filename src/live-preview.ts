import { StateField, type EditorState } from '@codemirror/state';
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view';
import { Component, editorInfoField, editorLivePreviewField, MarkdownRenderer, type Plugin } from 'obsidian';
import { DIRECTIVES, parseDocument, renderDirective } from './myst';

class DirectiveWidget extends WidgetType {
  private components = new WeakMap<HTMLElement, Component>();

  constructor(
    private owner: Plugin,
    private markdown: string,
    private raw: string,
    private path: string,
    private from: number,
  ) { super(); }

  eq(other: DirectiveWidget): boolean {
    return this.markdown === other.markdown && this.path === other.path && this.from === other.from;
  }

  toDOM(view: EditorView): HTMLElement {
    const doc = view.dom.ownerDocument;
    const wrapper = doc.createElement('div');
    wrapper.className = 'myst-reader-widget';
    const edit = doc.createElement('button');
    edit.className = 'myst-reader-edit';
    edit.textContent = 'Edit';
    edit.setAttribute('aria-label', 'Edit MyST source');
    edit.addEventListener('click', () => {
      view.dispatch({ selection: { anchor: this.from }, scrollIntoView: true });
      view.focus();
    });
    const content = doc.createElement('div');
    content.className = 'markdown-rendered myst-reader-content';
    content.setAttribute('dir', 'auto');
    wrapper.append(edit, content);
    const component = this.owner.addChild(new Component());
    this.components.set(wrapper, component);
    void MarkdownRenderer.render(this.owner.app, this.markdown, content, this.path, component)
      .then(() => { if (this.components.has(wrapper)) view.requestMeasure(); })
      .catch(error => {
        if (!this.components.has(wrapper)) return;
        content.replaceChildren();
        const pre = doc.createElement('pre');
        pre.textContent = this.raw;
        content.append(pre);
        console.error('MyST Reader: Live Preview rendering failed', error);
        view.requestMeasure();
      });
    return wrapper;
  }

  destroy(dom: HTMLElement): void {
    const component = this.components.get(dom);
    if (component) this.owner.removeChild(component);
    this.components.delete(dom);
  }

  ignoreEvent(): boolean { return true; }
}

function decorations(state: EditorState, owner: Plugin): DecorationSet {
  if (!state.field(editorLivePreviewField, false)) return Decoration.none;
  const path = state.field(editorInfoField, false)?.file?.path ?? '';
  const ranges = [];
  let offset = 0;
  for (const block of parseDocument(state.doc.toString())) {
    const end = offset + block.raw.length;
    if (block.kind === 'directive' && DIRECTIVES.includes(block.name)) {
      const editing = state.selection.ranges.some(range => range.from <= end && range.to >= offset);
      if (!editing) ranges.push(Decoration.replace({
        block: true,
        widget: new DirectiveWidget(owner, renderDirective(block), block.raw, path, offset),
      }).range(offset, end));
    }
    offset = end + 1;
  }
  return Decoration.set(ranges, true);
}

export function livePreviewExtension(owner: Plugin): StateField<DecorationSet> {
  return StateField.define<DecorationSet>({
    create: state => decorations(state, owner),
    update: (value, transaction) => transaction.docChanged || transaction.selection || transaction.reconfigured
      || transaction.startState.field(editorLivePreviewField, false) !== transaction.state.field(editorLivePreviewField, false)
      ? decorations(transaction.state, owner) : value,
    provide: field => EditorView.decorations.from(field),
  });
}
