import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseContent, parseDocument, transformMyST, transformRoles } from '../src/myst.ts';

test('the Hebrew LTI example keeps both equations and uses a tip callout', () => {
  const equations = '$$T:\\{x(t)\\}=x(t)\\ast h(t)$$\n$$x(t)\\ast h(t)=\\int_{-\\infty}^{\\infty}x(\\tau)h(t-\\tau)\\,d\\tau$$';
  const source = '```{admonition} מערכות LTI\n:class: tip\n\n' + equations + '\n```';
  const result = transformMyST(source);
  assert.match(result, /^> \[!tip\] מערכות LTI/);
  for (const equation of equations.split('\n')) assert.ok(result.includes('> ' + equation));
  assert.equal(source.includes(':class: tip'), true);
});

test('colon fences and nested backtick directives render recursively', () => {
  const result = transformMyST('::::{note} Outer\n\n```{warning} Inner\nCareful\n```\n::::');
  assert.match(result, /^> \[!note\] Outer/);
  assert.ok(result.includes('> > [!warning] Inner\n> > Careful'));
});

test('longer backtick fences contain shorter nested fences', () => {
  const result = transformMyST('````{note}\n```{tip}\nHi\n```\n````');
  assert.ok(result.includes('> > [!tip] Tip'));
});

test('fenced examples, including roles, are unchanged', () => {
  const source = '````markdown\n```{note}\n{math}`x`\n```\n````';
  assert.equal(transformMyST(source), source);
});

test('tilde fenced examples are unchanged', () => {
  const source = '~~~md\n:::{note}\nHello\n:::\n~~~';
  assert.equal(transformMyST(source), source);
});

test('unclosed directives remain intact', () => {
  assert.equal(transformMyST('```{note}\nunfinished'), '```{note}\nunfinished');
  assert.equal(parseDocument(':::{note}\nunfinished')[0]?.kind, 'text');
});

test('options do not require a blank line before the body', () => {
  assert.deepEqual({ ...parseContent(':class: tip\nשלום').options }, { class: 'tip' });
  assert.equal(parseContent(':class: tip\nשלום').body, 'שלום');
});

test('prototype-like options are inert data', () => {
  const result = parseContent(':__proto__: value\n\nbody');
  assert.equal(Object.getPrototypeOf(result.options), null);
  assert.equal(result.options.__proto__, 'value');
});

test('dropdowns support open and collapsed states', () => {
  assert.match(transformMyST(':::{dropdown} More\nBody\n:::'), /^> \[!note\]- More/);
  assert.match(transformMyST(':::{dropdown} More\n:open:\n\nBody\n:::'), /^> \[!note\]\+ More/);
});

test('inline math, code, references and document roles transform', () => {
  assert.equal(transformRoles('{math}`a^2` and {code}`a`'), '$a^2$ and `a`');
  assert.equal(transformRoles('{ref}`See this <my-label>`'), '[See this](#my-label)');
  assert.equal(transformRoles('{doc}`intro.md`'), '[intro.md](intro.md)');
  assert.equal(transformRoles('`{math}` and `literal`'), '`{math}` and `literal`');
  assert.equal(transformRoles('{cite:p}`paper`'), '{cite:p}`paper`');
});

test('math labels generate anchors without changing LaTeX', () => {
  assert.equal(transformMyST(':::{math}\n:label: eq-one\n\nx^2 + y^2 = z^2\n:::'), '<span id="eq-one"></span>\n\n$$\nx^2 + y^2 = z^2\n$$');
});

test('figures use relative paths and preserve alt text and captions', () => {
  assert.equal(transformMyST(':::{figure} images/a b.png\n:alt: תגובה להלם\n\nכיתוב\n:::'), '![תגובה להלם](images/a%20b.png)\n\nכיתוב');
});

test('unsafe URL schemes and attributes cannot be injected', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,hello', '//example.com/image.png']) {
    assert.ok(!transformMyST(':::{image} ' + url + '\n:::').startsWith('!['));
  }
  const label = transformMyST(':::{math}\n:label: x\" onclick=\"bad\n\nx\n:::');
  assert.ok(!label.includes('<span'));
  assert.equal(transformRoles('{doc}`javascript:alert(1)`'), '{doc}`javascript:alert(1)`');
});

test('unknown directives and executable code remain inert', () => {
  const unknown = transformMyST(':::{include} secret.txt\n:::');
  assert.match(unknown, /^```text\n:::\{include\} secret.txt/);
  assert.equal(transformMyST(':::{code-cell} python\nprint(1)\n:::'), '```python\nprint(1)\n```');
});

test('list tables support headers, alignment-independent cells and escaped pipes', () => {
  const result = transformMyST(':::{list-table} Table\n:header-rows: 1\n\n* - Name\n  - Value\n* - A\n  - x | y\n:::');
  assert.equal(result, '**Table**\n\n| Name | Value |\n| --- | --- |\n| A | x \\| y |');
});

test('unsupported complex list tables preserve source', () => {
  assert.match(transformMyST(':::{list-table}\n* - One\n  continuation\n:::'), /^```text/);
});

test('CRLF is normalized and text surrounding directives stays present', () => {
  const result = transformMyST('Before\r\n\r\n```{tip}\r\nHello\r\n```\r\n\r\nAfter');
  assert.equal(result, 'Before\n\n> [!tip] Tip\n> Hello\n\nAfter');
});

test('labels are constrained and do not convert inline examples', () => {
  assert.equal(transformMyST('(my-label)=\n# Heading'), '<span id="my-label"></span>\n# Heading');
  assert.equal(transformMyST('Example: (my-label)='), 'Example: (my-label)=');
});

test('frontmatter is preserved', () => {
  const source = '---\ntitle: "{math}`literal`"\n---\n\nHello';
  assert.equal(transformMyST(source), source);
});

test('following prose does not become a callout continuation', () => {
  assert.equal(transformMyST(':::{note}\nInside\n:::\nOutside'), '> [!note] Note\n> Inside\n\nOutside');
});

test('indented code does not transform roles', () => {
  assert.equal(transformMyST('    {math}`literal`'), '    {math}`literal`');
});

test('deeply nested input is bounded and stays readable', () => {
  const source = Array.from({ length: 40 }, (_, i) => ':'.repeat(44 - i) + '{note}').join('\n') + '\nHello\n' + Array.from({ length: 40 }, (_, i) => ':'.repeat(i + 5)).join('\n');
  assert.ok(transformMyST(source).includes('Hello'));
});

test('nested ordinary code in admonitions stays literal', () => {
  const result = transformMyST('::::{note}\n```python\nprint("{math}`x`")\n```\n::::');
  assert.ok(result.includes('> print("{math}`x`")'));
});
