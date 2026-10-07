<div align="center">

# 📑 Batch PDF Export

**Export a whole folder of Obsidian notes to PDF, one file per note or one combined book.**

[![Obsidian plugin](https://img.shields.io/badge/Obsidian-Community%20plugin-7C3AED?logo=obsidian&logoColor=white)](https://community.obsidian.md/plugins/batch-pdf-export)
[![Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&logoColor=white&color=7C3AED&label=downloads&query=%24%5B%22batch-pdf-export%22%5D.downloads&url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json)](https://community.obsidian.md/plugins/batch-pdf-export)
[![Latest release](https://img.shields.io/github/v/release/Dryd33n/obsidian-batch-pdf-export?color=7C3AED&label=release)](https://github.com/Dryd33n/obsidian-batch-pdf-export/releases/latest)
[![Lint](https://img.shields.io/github/actions/workflow/status/Dryd33n/obsidian-batch-pdf-export/lint.yml?branch=master&label=lint)](https://github.com/Dryd33n/obsidian-batch-pdf-export/actions/workflows/lint.yml)
[![License: 0BSD](https://img.shields.io/badge/license-0BSD-blue)](LICENSE)

### [**→ Get it from the Obsidian community plugins**](https://community.obsidian.md/plugins/batch-pdf-export)

[Features](#-features) · [Install](#-installation) · [Usage](#-usage) · [Settings](#%EF%B8%8F-settings) · [Limitations](#%EF%B8%8F-limitations) · [Contributing](#-contributing)

</div>

---

## ✨ Features

<table>
<tr>
<td width="50%" valign="top">

### 🖨️ Faithful rendering
- Looks like **Reading view**: math, Mermaid, callouts, code, tables, images and embedded notes
- Clean light print style, whatever your theme
- **Dark or light code**, set separately for inline code and code blocks
- Keeps the styling of plugin content, including Code Styler code blocks
- Title and date at the top of every note
- Every note starts on a new page

</td>
<td width="50%" valign="top">

### 📚 Combined PDF extras
- Title page and **linked table of contents** with page numbers
- Links between notes, headings and blocks **work inside the PDF**
- PDF bookmarks grouped by folder
- Page numbers, page size and orientation settings

</td>
</tr>
</table>

Exports show a progress notice with a **Cancel** button, so long batches never lock you in.

## 📦 Installation

> [!IMPORTANT]
> Desktop only: Windows, macOS and Linux.

**From Obsidian (recommended)**

1. Open **Settings → Community plugins → Browse**.
2. Search for **Batch PDF Export**.
3. Select **Install**, then **Enable**.

Or open the [plugin listing](https://community.obsidian.md/plugins/batch-pdf-export) directly.

<details>
<summary><b>Manual install</b></summary>

1. Download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/Dryd33n/obsidian-batch-pdf-export/releases/latest).
2. Copy them into `<Vault>/.obsidian/plugins/batch-pdf-export/`.
3. Reload Obsidian and enable the plugin in **Settings → Community plugins**.

</details>

<details>
<summary><b>Beta builds with BRAT</b></summary>

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat).
2. Select **Add beta plugin** and enter `Dryd33n/obsidian-batch-pdf-export`.

</details>

## 🚀 Usage

1. Right-click a folder and select **Export folder to PDF**, or run **Export folder to PDF…** from the command palette (<kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>P</kbd>).
2. Pick **One PDF per note** or **One combined PDF**.
3. Optionally, open **Advanced** to change code colors or use your theme for this export. Select **Save as default** to keep the choices for next time.
4. Select **Export** and choose where to save.

> [!TIP]
> Want a single shareable document? Choose **One combined PDF**. You get a title page, a clickable table of contents, and bookmarks for every folder.

## ⚙️ Settings

Defaults for every export, under **Settings → Batch PDF Export**:

| Setting | Default |
| :--- | :--- |
| Export mode | One PDF per note |
| Include subfolders | ✅ On |
| Page size | A4, portrait |
| Margins | 15 mm |
| Page numbers | ✅ On |
| Title page and table of contents | ✅ On |
| Date shown | `date` property, else date modified |
| Date format | `YYYY-MM-DD` |
| Inline code colors | Light (also Dark, or Match app) |
| Code block colors | Light (also Dark, or Match app) |
| Use community theme and snippets | ⬜ Off |
| Render timeout | 10 s per note |

## ⚠️ Limitations

- Embedded PDFs, audio, video and canvases print as placeholders.
- Links between separate PDFs work in desktop viewers (Acrobat, Foxit, SumatraPDF), but not in most browsers.
- Code block options read from the fence line by some plugins (Shiki titles and line numbers, Advanced Codeblock line numbers) are not printed, the same as in Obsidian's own PDF export. Code Styler is supported.
- Mermaid diagrams need your vault's Mermaid permission. The export asks for it if it's missing.

> [!NOTE]
> Slow plugin content such as Dataview may need more time. Increase **Render timeout** if it comes out blank.

> [!NOTE]
> **Privacy:** everything runs locally. PDFs are saved only where you choose, and nothing else outside the vault is touched.

## 🤝 Contributing

Issues and pull requests are welcome.

- 🐛 **Bugs:** [open an issue](https://github.com/Dryd33n/obsidian-batch-pdf-export/issues) with your Obsidian version, OS and, if you can, a sample note that reproduces the problem.
- 💡 **Features:** open an issue to discuss before starting large changes.

<details>
<summary><b>Development setup</b></summary>

```bash
git clone https://github.com/Dryd33n/obsidian-batch-pdf-export.git
cd obsidian-batch-pdf-export
npm install
npm run dev     # rebuild main.js on change
```

Copy `main.js`, `manifest.json` and `styles.css` into a **test vault** at `.obsidian/plugins/batch-pdf-export/`, then reload Obsidian.

</details>

<details>
<summary><b>Pull request checklist</b></summary>

- [ ] Branch from `master` and keep each PR focused on one change.
- [ ] `npm run lint` and `npm run build` pass with no errors.
- [ ] Both export modes tested in Obsidian, and the PR describes what you tested.
- [ ] No `main.js` or other build output committed.
- [ ] Any UI text uses sentence case.

</details>

<details>
<summary><b>Code layout</b></summary>

| Path | Contents |
| :--- | :--- |
| `src/main.ts` | Plugin lifecycle |
| `src/commands/` | Command and folder menu |
| `src/ui/` | Modals and notices |
| `src/export/` | Rendering, links, printing and PDF post-processing |
| `src/utils/` | Electron, path and HTML helpers |

</details>

<details>
<summary><b>Releasing</b></summary>

Bump `version` in `manifest.json`, `package.json` and `versions.json`, then push a tag with the same version (no `v` prefix). CI builds the plugin and creates a draft release for you to publish.

</details>

---

<div align="center">
<sub>Made for <a href="https://obsidian.md">Obsidian</a> by <a href="https://github.com/Dryd33n">Dryd33n</a> · <a href="LICENSE">0BSD license</a></sub>
</div>
