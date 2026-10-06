import type { RenderedNote } from '../types';
import { escapeHtml } from '../utils/html';
import { noteAnchorId } from './links';

/** One note: a header with title and date, followed by the rendered content. */
export function buildNoteSection(note: RenderedNote): string {
	const id = noteAnchorId(note.note);
	const date = note.date ? `<div class="bpe-note-date">${escapeHtml(note.date)}</div>` : '';
	return `<section class="bpe-note" id="${id}">
<header class="bpe-note-header">
<h1 class="bpe-note-title"><a class="bpe-anchor" href="#${id}" aria-hidden="true"></a>${escapeHtml(note.title)}</h1>
${date}
</header>
<div class="markdown-preview-view markdown-rendered">${note.html}</div>
</section>`;
}

export interface CombinedOptions {
	title: string;
	subtitle: string;
	coverAndToc: boolean;
}

/** All notes in one document, optionally preceded by a title page and table of contents. */
export function buildCombinedDocument(notes: RenderedNote[], options: CombinedOptions): string {
	const parts: string[] = [];
	if (options.coverAndToc) {
		parts.push(`<section class="bpe-cover">
<div class="bpe-cover-title">${escapeHtml(options.title)}</div>
<div class="bpe-cover-subtitle">${escapeHtml(options.subtitle)}</div>
</section>`);
		parts.push(buildToc(notes));
	}
	for (const note of notes) parts.push(buildNoteSection(note));
	return parts.join('\n');
}

/**
 * Table of contents with one entry per note, grouped by folder. Page numbers
 * are filled in after a first print pass, once note positions are known.
 */
function buildToc(notes: RenderedNote[]): string {
	const rows: string[] = [];
	let previousFolder: string[] = [];

	for (const rendered of notes) {
		const folder = rendered.note.relativeFolder ? rendered.note.relativeFolder.split('/') : [];
		// Emit a heading row for each folder level we enter.
		let shared = 0;
		while (shared < folder.length && shared < previousFolder.length && folder[shared] === previousFolder[shared]) shared++;
		for (let depth = shared; depth < folder.length; depth++) {
			rows.push(`<li class="bpe-toc-folder" style="--depth:${depth}">${escapeHtml(folder[depth] ?? '')}</li>`);
		}
		previousFolder = folder;

		const id = noteAnchorId(rendered.note);
		rows.push(`<li class="bpe-toc-entry" style="--depth:${folder.length}"><a href="#${id}">` +
			`<span class="bpe-toc-title">${escapeHtml(rendered.title)}</span>` +
			`<span class="bpe-toc-leader"></span>` +
			`<span class="bpe-toc-page" data-bpe-target="${id}"></span></a></li>`);
	}

	return `<nav class="bpe-toc">
<h1 class="bpe-toc-heading"><a class="bpe-anchor" href="#bpe-toc" aria-hidden="true"></a><span id="bpe-toc">Contents</span></h1>
<ol>${rows.join('\n')}</ol>
</nav>`;
}
