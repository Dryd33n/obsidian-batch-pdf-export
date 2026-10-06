# Batch PDF Export

Export a folder of Obsidian notes to PDF: one PDF per note, or one combined PDF.

## Features

- One PDF per note, or one combined PDF
- Renders like Reading view: math, Mermaid, callouts, code, tables, images, embedded notes
- Clean light print style, whatever your theme
- Title and date at the top of every note
- Every note starts on a new page
- Title page and linked table of contents with page numbers
- Links between exported notes, headings and blocks work inside the PDF
- PDF bookmarks grouped by folder
- Page numbers, page size and orientation settings
- Progress notice with **Cancel**

## Installation

Desktop only (Windows, macOS, Linux).

**Community plugins** (once listed): **Settings → Community plugins → Browse**, search **Batch PDF Export**, then select **Install** and **Enable**.

**BRAT:** install [BRAT](https://github.com/TfTHacker/obsidian42-brat), select **Add beta plugin**, and enter `Dryd33n/obsidian-batch-pdf-export`.

**Manual:**

1. Download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/Dryd33n/obsidian-batch-pdf-export/releases/latest).
2. Copy them into `<Vault>/.obsidian/plugins/batch-pdf-export/`.
3. Reload Obsidian and enable the plugin in **Settings → Community plugins**.

## Usage

1. Right-click a folder and select **Export folder to PDF**, or run **Export folder to PDF…** from the command palette.
2. Pick **One PDF per note** or **One combined PDF**.
3. Select **Export** and choose where to save.

## Settings

| Setting | Default |
| --- | --- |
| Export mode | One PDF per note |
| Include subfolders | On |
| Page size | A4, portrait |
| Margins | 15 mm |
| Page numbers | On |
| Title page and table of contents | On |
| Date shown | `date` property, else date modified |
| Date format | `YYYY-MM-DD` |
| Use community theme and snippets | Off |
| Render timeout | 10 s per note |

## Limitations

- Desktop only.
- PDFs are saved only where you choose; nothing else outside the vault is touched.
- Embedded PDFs, audio, video and canvases print as placeholders.
- Links between separate PDFs work in desktop viewers (Acrobat, Foxit, SumatraPDF), not in most browsers.
- Mermaid diagrams need your vault's Mermaid permission; the export asks if it's missing.
- Increase **Render timeout** for slow plugin content such as Dataview.

## Contributing

Issues and pull requests are welcome.

- **Bugs:** [open an issue](https://github.com/Dryd33n/obsidian-batch-pdf-export/issues) with your Obsidian version, OS, and a sample note that reproduces the problem if you can.
- **Features:** open an issue to discuss before starting large changes.

### Setup

```bash
git clone https://github.com/Dryd33n/obsidian-batch-pdf-export.git
cd obsidian-batch-pdf-export
npm install
npm run dev     # rebuild main.js on change
```

Copy `main.js`, `manifest.json` and `styles.css` into a **test vault** at `.obsidian/plugins/batch-pdf-export/`, then reload Obsidian.

### Pull requests

- Branch from `master` and keep each PR focused on one change.
- Run `npm run lint` and `npm run build` before pushing; both must pass with no errors.
- Test both export modes in Obsidian, and describe what you tested in the PR.
- Don't commit `main.js` or other build output.
- Use sentence case for any UI text.

### Code layout

| Path | Contents |
| --- | --- |
| `src/main.ts` | Plugin lifecycle |
| `src/commands/` | Command and folder menu |
| `src/ui/` | Modals and notices |
| `src/export/` | Rendering, links, printing and PDF post-processing |
| `src/utils/` | Electron, path and HTML helpers |

### Releasing

Bump `version` in `manifest.json` and `versions.json`, then push a tag with the same version (no `v` prefix). CI builds the plugin and creates a draft release to publish.
