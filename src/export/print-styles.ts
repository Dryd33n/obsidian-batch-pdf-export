/** Light print stylesheet layered on top of Obsidian's own styles. */
export const PRINT_CSS = `
html, body {
	background: #fff !important;
	margin: 0 !important;
	padding: 0 !important;
	height: auto !important;
	overflow: visible !important;
}
body.bpe-export {
	--font-text-size: 14px;
	/* Obsidian prints in Arial by default; use the normal reading font instead. */
	--font-print: var(--font-print-override), var(--font-text-override), var(--font-text-theme), var(--font-default) !important;
	-webkit-print-color-adjust: exact;
	print-color-adjust: exact;
}
.print {
	font-family: var(--font-text);
	color: var(--text-normal);
}
.print .markdown-preview-view {
	padding: 0 !important;
	overflow: visible !important;
	font-size: var(--font-text-size);
}
.print .markdown-preview-view > :first-child {
	margin-top: 0;
}

/* Every note, the table of contents and the title page start on a new page. */
.bpe-cover + *,
.bpe-toc + *,
.bpe-note + .bpe-note {
	break-before: page;
}
.bpe-note-header {
	margin: 0 0 1.6em;
	padding-bottom: 0.6em;
	border-bottom: 1px solid var(--background-modifier-border);
}
.bpe-note-title {
	margin: 0 0 0.15em;
	font-size: 2em;
	line-height: 1.2;
	color: var(--text-normal);
}
.bpe-note-date {
	color: var(--text-muted);
	font-size: 0.9em;
}

/* Zero-size self links that give headings a PDF destination. */
.bpe-anchor {
	display: inline-block;
	width: 0;
	height: 1em;
	overflow: hidden;
}
.bpe-block-anchor {
	display: inline-block;
	width: 0;
}

/* Keep things together across page breaks where possible. */
h1, h2, h3, h4, h5, h6 {
	break-after: avoid;
}
pre, img, figure, table, blockquote, .callout, .math-block, .mermaid, .bpe-placeholder {
	break-inside: avoid;
}
img {
	max-width: 100%;
}
.mermaid svg {
	max-width: 100%;
	height: auto;
}
.markdown-preview-view pre {
	white-space: pre-wrap;
	word-break: break-word;
}
.markdown-embed-content {
	max-height: none !important;
	overflow: visible !important;
}
.print .markdown-embed {
	margin: 0.6em 0;
	padding: 0 0 0 1em;
	border: none;
	border-left: 2px solid var(--background-modifier-border-hover);
}

.callout {
	mix-blend-mode: normal !important;
}

.bpe-dead-link {
	text-decoration: underline dotted var(--text-faint);
	text-underline-offset: 2px;
}
.bpe-placeholder {
	display: flex;
	flex-wrap: wrap;
	gap: 0.5em;
	margin: 0.8em 0;
	padding: 0.6em 0.9em;
	border: 1px dashed var(--background-modifier-border-hover);
	border-radius: 6px;
	color: var(--text-muted);
	font-size: 0.9em;
}
.bpe-placeholder-label {
	font-weight: 600;
}

/* Title page */
.bpe-cover {
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
	height: calc(var(--bpe-page-height) - 4px);
	text-align: center;
}
.bpe-cover-title {
	font-size: 2.6em;
	font-weight: 700;
	line-height: 1.2;
	color: var(--text-normal);
}
.bpe-cover-subtitle {
	margin-top: 0.8em;
	color: var(--text-muted);
}

/* Table of contents */
.bpe-toc-heading {
	margin: 0 0 1em;
	font-size: 1.8em;
}
.bpe-toc ol {
	list-style: none;
	margin: 0;
	padding: 0;
}
.bpe-toc li {
	padding-left: calc(var(--depth, 0) * 1.4em);
	break-inside: avoid;
}
.bpe-toc-folder {
	margin-top: 0.9em;
	font-weight: 600;
	color: var(--text-muted);
}
.bpe-toc-entry a {
	display: flex;
	align-items: baseline;
	padding: 0.2em 0;
	color: var(--text-normal);
	text-decoration: none;
}
.bpe-toc-leader {
	flex: 1;
	min-width: 1em;
	margin: 0 0.4em;
	border-bottom: 1px dotted var(--text-faint);
}
.bpe-toc-page {
	min-width: 2.5em;
	text-align: right;
	font-variant-numeric: tabular-nums;
}
`;

export const FOOTER_TEMPLATE = `<div style="width:100%;font-size:8px;color:#888;text-align:center;font-family:sans-serif;">
<span class="pageNumber"></span> / <span class="totalPages"></span></div>`;
