# MyST Reader

Preview MyST Markdown in Obsidian while keeping your Jupyter Book and Sphinx source unchanged. Designed for technical notes, equations, and multilingual course material, including Hebrew.

## Install before community approval

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest GitHub release, or extract the release ZIP.
2. Create `<your vault>/.obsidian/plugins/myst-reader/` and put the three files directly inside it.
3. Restart Obsidian. Under **Settings → Community plugins**, enable **MyST Reader**. Community plugins must be allowed in your vault.
4. Open a Markdown note and run **MyST Reader: Open MyST preview** from the command palette, or use the book ribbon icon.

The folder must be called `myst-reader`. The plugin supports desktop and mobile APIs; a physical mobile device has not yet been tested.

## Two ways to preview

| Feature | Reading view | MyST preview pane |
| --- | --- | --- |
| Backtick-fenced supported directives | Yes | Yes |
| Colon-fenced supported directives | No | Yes |
| Nested supported directives | Yes, inside a processed backtick directive | Yes |
| Standard dollar-delimited math | Obsidian native | Obsidian native |
| Supported inline roles | Inside processed directives | Throughout prose |
| MyST label anchors and local reference links | Inside processed directives | Yes |
| Source editing | Obsidian native | Read-only; follows the current note |

The preview pane follows Markdown file switches and editor changes. Open it beside the editor to write and preview simultaneously. Standard Live Preview editing behavior depends on Obsidian's code block rendering; full-document MyST support is provided by the separate pane.

## Example

````markdown
```{admonition} מערכות LTI
:class: tip

$$T\{x(t)\}=x(t)\ast h(t)$$
$$x(t)\ast h(t)=\int_{-\infty}^{\infty}x(\tau)h(t-\tau)\,d\tau$$
```
````

The directive becomes a native tip callout containing rendered math. The source file is never rewritten.

Colon fences work in the MyST preview pane:

```markdown
::::{note} An outer note

:::{warning} Nested warning
Keep an eye on the units.
:::
::::
```

## Supported syntax

- Admonitions: `admonition`, `note`, `tip`, `hint`, `important`, `warning`, `caution`, `attention`, `danger`, `error`, `seealso`, `todo`, `topic`, and `sidebar`.
- `:class: tip` and related admonition types; `dropdown` and `:class: dropdown` become collapsible callouts. `:open:` expands them initially.
- `math`, with `:label:` or `:name:` anchors; dollar math is handled by Obsidian's MathJax renderer.
- `figure` and `image`, with relative image paths, alt text, and figure captions.
- `code`, `code-block`, and `code-cell` display code. They **never execute code**.
- Simple `list-table` directives, with zero or one header row and one-line cells; `table` wraps a Markdown table.
- `rubric`, `epigraph`, and `pull-quote`.
- Inline `{math}` / `{m}`, `{code}`, `{file}`, `{command}`, `{kbd}`, `{guilabel}`, `{ref}`, `{eq}`, `{numref}`, and `{doc}` roles. Explicit link text such as `` {ref}`See this <my-label>` `` is supported.
- Standalone `(my-label)=` labels in the preview pane.

See [the demo note](examples/demo.md) for a complete example.

## Scope and limitations

This is a preview adapter for a documented subset of MyST, not the complete MyST parser or a Jupyter/Sphinx runtime. Build your book with its normal toolchain for authoritative output.

Unknown directives display as source in the preview pane. Unknown roles remain unchanged. Includes, raw directives, notebook execution, bibliography resolution, Sphinx domains, tab sets, grids, YAML directive options, cross-document label indexing, and automatic equation/figure numbering are not implemented. `ref`, `eq`, and `numref` create local anchor links and do not compute numbers. Image sizing and layout options are not implemented. Invalid or unclosed directives remain readable as source. Inline roles within indented code, fenced code, and frontmatter are preserved. More than 32 nested directive levels fall back to source.

Reading view can recover custom titles when Obsidian supplies source section information; otherwise it uses the directive's default title. The preview pane always has the full source and custom titles.

## Privacy

MyST Reader does not write to notes, execute code, access files outside the vault, make network requests, or collect telemetry. Rendering is delegated to Obsidian, including its ordinary handling of remote images and links embedded in your Markdown. Remote images can therefore load through Obsidian in the same way they do in ordinary notes. Only the selected Markdown file is read for the preview.

## Development

Requires Node.js 22.18+ or 24+, npm, and Obsidian 1.7.2 or newer. The plugin uses public Obsidian APIs only; the development Node requirement does not apply to users installing the bundled plugin.

```sh
npm ci
npm run check
npm run package
```

`npm run dev` watches source changes. The CommonJS bundle is intentionally unminified for review. `npm run package` creates the three release assets under `dist/myst-reader/`; ZIP that directory for manual installation.

## Release and community registration

The repository must be public with `manifest.json`, `README.md`, and `LICENSE` at its root. Create a GitHub release tagged exactly as the manifest's version (no `v`) and attach `main.js`, `manifest.json`, and `styles.css`. The included release workflow does this for a pushed version tag after running checks.

Submit through [Obsidian Community](https://community.obsidian.md) using an Obsidian account linked to the repository owner's GitHub account. Community availability depends on Obsidian's review. See the [official submission guide](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin).

## License

[MIT](LICENSE). This is an independent implementation; it does not incorporate code from other MyST plugins.
