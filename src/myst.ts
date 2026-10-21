/** A deliberately bounded MyST preview adapter, not a Sphinx/MyST execution engine. */
export interface Directive {
  kind: 'directive';
  name: string;
  argument: string;
  options: Record<string, string>;
  body: string;
  raw: string;
}

export interface TextBlock { kind: 'text'; raw: string }
export type Block = Directive | TextBlock;

const admonitions: Record<string, string> = {
  admonition: 'note', note: 'note', tip: 'tip', hint: 'tip', important: 'important',
  warning: 'warning', caution: 'warning', attention: 'warning', danger: 'danger',
  error: 'failure', seealso: 'info', todo: 'todo', topic: 'info', sidebar: 'info',
};

export const DIRECTIVES = [
  ...Object.keys(admonitions), 'dropdown', 'math', 'image', 'figure', 'code-block',
  'code', 'code-cell', 'list-table', 'table', 'rubric', 'epigraph', 'pull-quote',
];

const opening = /^ {0,3}(`{3,}|:{3,})\{([a-zA-Z][\w-]*)\}(?:[ \t]+(.*))?[ \t]*$/;
const fence = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const has = (object: object, key: string): boolean => Object.prototype.hasOwnProperty.call(object, key);

function isClose(line: string, marker: string): boolean {
  const match = /^ {0,3}(`{3,}|:{3,}|~{3,})[ \t]*$/.exec(line);
  return !!match && match[1]![0] === marker[0] && match[1]!.length >= marker.length;
}

/** Skip ordinary fenced code so examples and strings never become directives. */
function codeEnd(lines: string[], start: number, marker: string): number {
  for (let i = start + 1; i < lines.length; i++) {
    if (isClose(lines[i]!, marker)) return i;
  }
  return lines.length - 1;
}

function directiveEnd(lines: string[], start: number, marker: string, depth: number): number {
  if (depth > 32) return -1;
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (isClose(line, marker)) return i;
    const child = opening.exec(line);
    if (child) {
      const end = directiveEnd(lines, i, child[1]!, depth + 1);
      if (end < 0) return -1;
      i = end;
    } else {
      const code = fence.exec(line);
      if (code) i = codeEnd(lines, i, code[1]!);
    }
  }
  return -1;
}

export function parseContent(source: string): Pick<Directive, 'options' | 'body'> {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const options: Record<string, string> = Object.create(null) as Record<string, string>;
  let index = 0;
  while (index < lines.length) {
    const option = /^\s*:([\w-]+):(?:[ \t]*(.*))?$/.exec(lines[index]!);
    if (!option) break;
    options[option[1]!] = option[2] ?? '';
    index++;
  }
  if (lines[index]?.trim() === '') index++;
  return { options, body: lines.slice(index).join('\n') };
}

export function parseDocument(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let text: string[] = [];
  const flush = () => {
    if (text.length) blocks.push({ kind: 'text', raw: text.join('\n') });
    text = [];
  };
  // Frontmatter is metadata, not prose or a directive.
  let start = 0;
  if (lines[0] === '---') {
    const end = lines.findIndex((line, index) => index > 0 && /^(---|\.\.\.)$/.test(line));
    if (end >= 0) {
      text.push(...lines.slice(0, end + 1));
      start = end + 1;
    }
  }
  for (let i = start; i < lines.length; i++) {
    const line = lines[i]!;
    const match = opening.exec(line);
    if (match) {
      const end = directiveEnd(lines, i, match[1]!, 0);
      if (end < 0) {
        text.push(...lines.slice(i));
        break;
      }
      flush();
      blocks.push({
        kind: 'directive', name: match[2]!.toLowerCase(), argument: match[3]?.trim() ?? '',
        ...parseContent(lines.slice(i + 1, end).join('\n')),
        raw: lines.slice(i, end + 1).join('\n'),
      });
      i = end;
    } else {
      const code = fence.exec(line);
      if (code) {
        const end = codeEnd(lines, i, code[1]!);
        text.push(...lines.slice(i, end + 1));
        i = end;
      } else text.push(line);
    }
  }
  flush();
  return blocks;
}

function escapeText(text: string): string {
  return text.replace(/[\\[\]<>]/g, '\\$&').replace(/[\r\n]+/g, ' ');
}

function destination(value: string): string | null {
  const clean = value.trim();
  if (!clean || /[\u0000-\u0020<>"\\]/.test(clean.replace(/ /g, ''))) return null;
  const scheme = /^([a-z][\w+.-]*):/i.exec(clean)?.[1]?.toLowerCase();
  if (scheme && scheme !== 'http' && scheme !== 'https') return null;
  if (clean.startsWith('//')) return null;
  return encodeURI(clean).replace(/[()]/g, char => '%' + char.charCodeAt(0).toString(16));
}

function codeBlock(body: string, language = ''): string {
  const longest = Math.max(2, ...Array.from(body.matchAll(/`+/g), match => match[0].length));
  const marker = '`'.repeat(longest + 1);
  const safeLanguage = /^[\w+-]*$/.test(language) ? language : '';
  return `${marker}${safeLanguage}\n${body}\n${marker}`;
}

function quote(body: string): string {
  return body.split('\n').map(line => line ? `> ${line}` : '>').join('\n');
}

/** Convert supported inline roles, preserving unsupported roles and inline code. */
export function transformRoles(source: string): string {
  const parts = source.split(/(`+[^`]*`+)/g);
  // A role's backticks are a separate token from the preceding {role} text.
  for (let i = 1; i < parts.length; i += 2) {
    const before = parts[i - 1]!;
    const role = /\{([\w:-]+)\}$/.exec(before);
    const token = /^`([^`\n]+)`$/.exec(parts[i]!);
    if (!role || !token) continue;
    const value = token[1]!;
    let rendered: string | null = null;
    switch (role[1]) {
      case 'math': case 'm': rendered = `$${value}$`; break;
      case 'code': case 'file': case 'command': case 'kbd': case 'guilabel':
        rendered = '`' + value + '`'; break;
      case 'ref': case 'eq': case 'numref': case 'doc': {
        const explicit = /^(.*?)\s*<([^<>]+)>$/.exec(value);
        const target = explicit?.[2] ?? value;
        const label = explicit?.[1] ?? value;
        const url = destination(role[1] === 'doc' ? target : '#' + target);
        if (url) rendered = `[${escapeText(label)}](${url})`;
        break;
      }
    }
    if (rendered !== null) {
      parts[i - 1] = before.slice(0, -role[0].length);
      parts[i] = rendered;
    }
  }
  return parts.join('');
}

function transformText(source: string): string {
  // Keep fenced examples untouched, including inline roles inside them.
  const lines = source.split('\n');
  const out: string[] = [];
  let start = 0;
  if (lines[0] === '---') {
    const end = lines.findIndex((line, index) => index > 0 && /^(---|\.\.\.)$/.test(line));
    if (end >= 0) { out.push(...lines.slice(0, end + 1)); start = end + 1; }
  }
  for (let i = start; i < lines.length; i++) {
    const line = lines[i]!;
    const code = fence.exec(line);
    if (code) {
      const end = codeEnd(lines, i, code[1]!);
      out.push(...lines.slice(i, end + 1));
      i = end;
    } else if (/^( {4}|\t)/.test(line)) out.push(line);
    else if (/^\([\w:.-]+\)=$/.test(line)) {
      out.push(`<span id="${line.slice(1, -2)}"></span>`);
    } else out.push(transformRoles(line));
  }
  return out.join('\n');
}

function listTable(body: string, headerRows: number): string | null {
  const rows: string[][] = [];
  for (const line of body.split('\n')) {
    const row = /^\s*\*\s+-\s+(.*)$/.exec(line);
    const cell = /^\s+-\s+(.*)$/.exec(line);
    if (row) rows.push([row[1]!]);
    else if (cell && rows.length) rows[rows.length - 1]!.push(cell[1]!);
    else if (line.trim()) return null;
  }
  const width = rows[0]?.length ?? 0;
  if (!width || rows.some(row => row.length !== width) || headerRows > 1) return null;
  const result = rows.map(row => '| ' + row.map(cell => transformRoles(cell).replace(/\|/g, '\\|')).join(' | ') + ' |');
  const divider = '| ' + Array<string>(width).fill('---').join(' | ') + ' |';
  if (headerRows === 1) result.splice(1, 0, divider);
  else result.unshift('| ' + Array<string>(width).fill(' ').join(' | ') + ' |', divider);
  return result.join('\n');
}

export function renderDirective(block: Directive, depth = 0): string {
  if (depth > 32) return codeBlock(block.raw, 'text');
  const { name, argument, options, body } = block;
  const content = () => transformMyST(body, depth + 1);
  const label = options.name ?? options.label;
  const anchor = label && /^[\w:.-]+$/.test(label) ? `<span id="${label}"></span>\n\n` : '';
  if (has(admonitions, name) || name === 'dropdown') {
    const classes = (options.class ?? '').split(/\s+/);
    const style = classes.find(value => has(admonitions, value));
    const type = style ? admonitions[style]! : (admonitions[name] ?? 'note');
    const fold = name === 'dropdown' || classes.includes('dropdown') ? (has(options, 'open') ? '+' : '-') : '';
    return anchor + `> [!${type}]${fold} ${escapeText(argument || (name === 'admonition' ? 'Note' : name.charAt(0).toUpperCase() + name.slice(1)))}\n` + quote(content());
  }
  if (name === 'math') return anchor + `$$\n${body.trim()}\n$$`;
  if (name === 'code-block' || name === 'code' || name === 'code-cell') return codeBlock(body, argument);
  if (name === 'figure' || name === 'image') {
    const url = destination(argument);
    if (!url) return codeBlock(block.raw, 'text');
    const image = `![${escapeText(options.alt ?? '')}](${url})`;
    return anchor + image + (name === 'figure' && body.trim() ? '\n\n' + content() : '');
  }
  if (name === 'list-table') {
    const table = listTable(body, Number(options['header-rows'] ?? 0));
    if (table) return anchor + (argument ? `**${escapeText(argument)}**\n\n` : '') + table;
  }
  if (name === 'table') return anchor + (argument ? `**${escapeText(argument)}**\n\n` : '') + content();
  if (name === 'rubric') return `**${escapeText(argument)}**`;
  if (name === 'epigraph' || name === 'pull-quote') return quote(content() + (options.attribution ? `\n\n— ${escapeText(options.attribution)}` : ''));
  // Unsupported directives remain visibly readable and are never executed.
  return codeBlock(block.raw, 'text');
}

export function transformMyST(source: string, depth = 0): string {
  const blocks = parseDocument(source);
  return blocks.map((block, index) => {
    const rendered = block.kind === 'directive' ? renderDirective(block, depth) : transformText(block.raw);
    if (index === blocks.length - 1) return rendered;
    // A blank line prevents following prose becoming a lazy continuation of a callout.
    const next = blocks[index + 1]!;
    return rendered + (rendered.endsWith('\n') || next.raw.startsWith('\n') ? '\n' : '\n\n');
  }).join('');
}
