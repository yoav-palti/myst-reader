# MyST Reader

Render MyST Markdown directly in your Obsidian notes while keeping your Jupyter Book and Sphinx source unchanged. Designed for technical notes, equations, and multilingual course material, including Hebrew.

## Install before community approval

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest GitHub release, or extract the release ZIP.
2. Create `<your vault>/.obsidian/plugins/myst-reader/` and put the three files directly inside it.
3. Restart Obsidian. Under **Settings → Community plugins**, enable **MyST Reader**. Community plugins must be allowed in your vault.
4. Open a Markdown note as usual. Supported MyST blocks render automatically in **Reading view** and **Live Preview**. No extra pane, ribbon button, or command is needed.

The folder must be called `myst-reader`. The plugin supports desktop and mobile APIs; a physical mobile device has not yet been tested.

## Open a note as usual

| Feature | Reading view | Live Preview |
| --- | --- | --- |
| Backtick-fenced supported directives | Yes | Yes |
| Colon-fenced supported directives | No | Yes |
| Nested supported directives | Inside a processed backtick directive | Yes |
| Standard dollar-delimited math | Obsidian native | Obsidian native |
| Supported inline roles | Inside processed directives | Inside processed directives |
| MyST label anchors and local reference links | Inside processed directives | Inside processed directives |
| Source editing | Obsidian native | Move the cursor into a block or click Edit |

In Live Preview, supported directives render as callouts, equations, or other preview blocks when the cursor is outside them. Move the cursor into a block or use its **Edit** button to expose the source. Source mode always shows the original Markdown.

The separate pane from versions 1.0.0–1.0.2 has been removed. On upgrade, a saved legacy pane is closed if the same file is already open, or converted to a normal note if it was the only view of that file.

## Example

````markdown
```{admonition} מערכות LTI
:class: tip

$$T\{x(t)\}=x(t)\ast h(t)$$
$$x(t)\ast h(t)=\int_{-\infty}^{\infty}x(\tau)h(t-\tau)\,d\tau$$
```
````

The directive becomes a native tip callout containing rendered math. The source file is never rewritten.

Colon fences work in Live Preview:

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
- Top-level `raw` HTML, either inline or loaded with `:file:` from a vault HTML file relative to the current note. Scripts and HTTPS libraries run in an isolated iframe in both Reading view and Live Preview.
- Inline `{math}` / `{m}`, `{code}`, `{file}`, `{command}`, `{kbd}`, `{guilabel}`, `{ref}`, `{eq}`, `{numref}`, and `{doc}` roles. Explicit link text such as `` {ref}`See this <my-label>` `` is supported.
- Standalone `(my-label)=` labels inside processed directives.

See [the demo note](examples/demo.md) for a complete example.

## Scope and limitations

This renderer supports a documented subset of MyST, not the complete MyST parser or a Jupyter/Sphinx runtime. Build your book with its normal toolchain for authoritative output.

Unknown directives and roles remain unchanged. Includes, non-HTML raw directives, nested raw HTML, notebook execution, bibliography resolution, Sphinx domains, tab sets, grids, YAML directive options, cross-document label indexing, automatic equation/figure numbering, and inline roles outside processed directives are not implemented. `ref`, `eq`, and `numref` create local anchor links and do not compute numbers. Image sizing and layout options are not implemented. Invalid or unclosed directives remain readable as source. Inline roles within indented code, fenced code, and frontmatter are preserved. More than 32 nested directive levels fall back to source.

Reading view can recover custom titles when Obsidian supplies source section information; otherwise it uses the directive's default title. Live Preview has the full source and custom titles.

## Interactive HTML

````markdown
```{raw} html
:file: interactives/frequency-response.html
```
````

The example reads `interactives/frequency-response.html` relative to the note's folder. The file must be inside the vault and end in `.html` or `.htm`. Changes to the HTML file reload its frame automatically. Missing or invalid files show an explanatory message.

HTML can contain inline JavaScript and load libraries from absolute HTTPS URLs. Fragments that reference `MathJax` or contain LaTeX delimiters automatically receive MathJax 3.2.2 from jsDelivr, unless they already include a MathJax script loader. This supplies the runtime normally provided by Jupyter Book. Internet access is needed for remote resources, including this math runtime; self-contained HTML can work offline. Relative companion assets are not resolved from the HTML file, so use self-contained content or absolute HTTPS URLs. The frame resizes to its content and retains scrolling for very long documents. Raw HTML formats other than `html` stay readable as source.

## Privacy

MyST Reader does not write to notes, read files outside the vault, or collect telemetry. It reads HTML files explicitly referenced by `raw` directives. Raw HTML scripts execute inside an iframe with `sandbox="allow-scripts"` and without `allow-same-origin`; they cannot access Obsidian's DOM, vault APIs, or application storage. Only embed HTML you trust: its scripts and external resources can contact third-party servers, which receive ordinary network information such as your IP address. The iframe sends no referrer. Other Markdown rendering is delegated to Obsidian, including its ordinary handling of remote images and links. Code cells and code blocks remain display-only.

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
