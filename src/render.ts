import { MarkdownRenderer, type App, type Component } from 'obsidian';
import { renderDirective, type Directive } from './myst';
import { renderRawHTML } from './raw-html';

export async function renderMySTDirective(
  app: App, block: Directive, target: HTMLElement, path: string,
  component: Component, changed: () => void = () => {},
): Promise<void> {
  if (block.name === 'raw' && block.argument.toLowerCase() === 'html') {
    await renderRawHTML(app, block, target, path, component, changed);
  } else await MarkdownRenderer.render(app, renderDirective(block), target, path, component);
}
