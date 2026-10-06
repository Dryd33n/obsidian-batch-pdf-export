# Batch PDF Export

Export a whole folder of Obsidian notes to PDF, either as **one PDF per note** or as **one combined PDF**.

Notes are rendered with Obsidian's own renderer, so the PDFs match Reading view: math, Mermaid diagrams, callouts, code highlighting, tables, images and embedded notes all come out as they look in the app. The output uses a clean light print style, whatever theme you use.

## Features

- **Two export modes**
  - **One PDF per note**: you name a new folder in the save dialog. Each note becomes its own PDF inside it, and subfolders are recreated.
  - **One combined PDF**: every note starts on a new page, after a title page and a linked table of contents with page numbers.
- **Note header**: each note starts with its title and a date (a date property, date modified, date created or the export date).
- **Working links**
  - In a combined PDF, links to other exported notes, headings (`[[Note#Heading]]`), blocks (`[[Note#^id]]`) and footnotes jump to the right page.
  - With one PDF per note, links to other exported notes open the matching PDF through a relative link, so the folder can be moved or shared.
  - Links to notes that weren't exported become plain text.
- **PDF bookmarks**: the sidebar outline in PDF viewers lists notes, grouped by folder, with each note's headings nested inside.
- **Page numbers** in the footer, and A3, A4, A5, Letter or Legal pages in portrait or landscape.

## Installation

Batch PDF Export works on desktop only (Windows, macOS and Linux).

### From Community plugins

Once the plugin is listed in the Obsidian community catalog:

1. Open **Settings → Community plugins** and turn off **Restricted mode** if it's on.
2. Select **Browse**, search for **Batch PDF Export**, then select **Install**.
3. Select **Enable**.

### With BRAT (beta releases)

1. Install and enable the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin from **Community plugins**.
2. Open **Settings → BRAT**, select **Add beta plugin**, and enter `Dryd33n/obsidian-batch-pdf-export`.
3. Enable **Batch PDF Export** in **Settings → Community plugins**.

### Manually

1. Download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/Dryd33n/obsidian-batch-pdf-export/releases/latest).
2. In your vault, create the folder `.obsidian/plugins/batch-pdf-export/` and copy the three files into it. The `.obsidian` folder is hidden by default, so you may need to show hidden files.
3. Restart Obsidian, or reload plugins in **Settings → Community plugins**.
4. Enable **Batch PDF Export** in **Settings → Community plugins**.

### From source

```bash
git clone https://github.com/Dryd33n/obsidian-batch-pdf-export.git
cd obsidian-batch-pdf-export
npm install
npm run build
```

Then copy `main.js`, `manifest.json` and `styles.css` into `<Vault>/.obsidian/plugins/batch-pdf-export/` and enable the plugin as described above.

## Usage

1. Right-click a folder in the file explorer and select **Export folder to PDF**, or run **Batch PDF Export: Export folder to PDF…** from the command palette and pick a folder.
2. Choose **One PDF per note** or **One combined PDF**, and whether to include subfolders.
3. Select **Export** and choose where to save.

A notice shows progress and has a **Cancel** button. When the export finishes, select **Show in folder** to open the result.

### Mermaid diagrams

Recent versions of Obsidian ask before showing Mermaid diagrams in a vault. If your vault hasn't allowed them yet, the export asks once. Allowing works exactly like selecting **Allow** on a diagram in Obsidian and applies to the whole vault. If you decline, the diagram source is printed instead.

## Settings

| Setting | Default |
| --- | --- |
| Default export mode | One PDF per note |
| Include subfolders | On |
| Page size, landscape | A4, portrait |
| Margins | 15 mm |
| Page numbers | On |
| Title page and table of contents (combined PDF) | On |
| Date shown | `date` property, else date modified |
| Date format | `YYYY-MM-DD` |
| Use community theme and snippets | Off |
| Render timeout | 10 seconds per note |

## Notes and limitations

- **Desktop only.** PDFs are printed by Obsidian's built-in Chromium engine, which isn't available on mobile.
- **Files outside the vault.** PDFs are written only to the location you choose in the save dialog. Nothing else is read or written outside the vault.
- **No network requests of its own.** Notes that embed web images or iframes load them the same way Reading view does.
- **Content that can't be printed**, such as embedded PDFs, audio, video and canvases, is replaced with a labelled placeholder.
- **Links between separate PDFs** are relative file links. Desktop viewers such as Adobe Acrobat, Foxit, SumatraPDF and Okular follow them. Browser PDF viewers usually don't open other local files.
- **Content from other plugins** (for example Dataview) is included once it finishes rendering. Increase **Render timeout** if a plugin needs longer.
- Folder order is alphabetical with natural number sorting ("2" before "10"). Notes in a folder come before its subfolders.

## Development

```bash
npm install
npm run dev     # watch build
npm run build   # type-check and production build
npm run lint
```

To test, copy `main.js`, `manifest.json` and `styles.css` into `<Vault>/.obsidian/plugins/batch-pdf-export/`, then reload Obsidian and enable the plugin.

### How it works

1. Each note is rendered off-screen with `MarkdownRenderer`. The plugin waits for Mermaid, MathJax and embeds to finish, then cleans up the HTML: links are rewritten, vault images and fonts are inlined, and collapsed callouts are expanded.
2. The HTML is printed with `printToPDF` in a hidden `<webview>`.
3. For combined PDFs, a first print pass finds the page of each note (using Obsidian's bundled pdf.js) so the table of contents can show page numbers.
4. Bookmarks, the document title and relative links between PDFs are added with a small PDF incremental update, without any extra libraries.
