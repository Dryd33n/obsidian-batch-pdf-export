import { App, HeadingCache, parseLinktext, resolveSubpath } from 'obsidian';
import type { ExportMode, ExportNote, NoteHeading } from '../types';
import { toFileUrl } from '../utils/paths';

export interface LinkContext {
	app: App;
	mode: ExportMode;
	notesByPath: Map<string, ExportNote>;
}

const HEADINGS = 'h1, h2, h3, h4, h5, h6';

export const noteAnchorId = (note: ExportNote) => `n${note.index}`;
const headingAnchorId = (note: ExportNote, cacheIndex: number) => `n${note.index}-h${cacheIndex}`;
const blockAnchorId = (note: ExportNote, blockId: string) => `n${note.index}-b-${blockId}`;

/**
 * Gives headings and blocks stable, export-wide unique IDs and rewrites every
 * link: links to exported notes jump inside the PDF (or to the other PDF),
 * links to anything else become plain text. Returns the note's headings.
 */
export function processLinks(el: HTMLElement, note: ExportNote, ctx: LinkContext): NoteHeading[] {
	prefixLocalFragments(el, note);
	const headings = assignHeadingIds(el, note, ctx.app);
	el.querySelectorAll<HTMLElement>('[data-bpe-block]').forEach((span) => {
		span.id = blockAnchorId(note, span.dataset.bpeBlock ?? '');
	});

	el.querySelectorAll<HTMLAnchorElement>('a.internal-link').forEach((link) => {
		const href = resolveInternalLink(link, note, ctx);
		if (href) {
			link.setAttribute('href', href);
			link.removeAttribute('target');
		} else {
			unwrapLink(link, 'bpe-dead-link');
		}
	});
	el.querySelectorAll<HTMLAnchorElement>('a.tag').forEach((tag) => unwrapLink(tag, 'tag'));
	return headings;
}

/** Footnotes and other `#id` links inside a note get the note's prefix so IDs never clash. */
function prefixLocalFragments(el: HTMLElement, note: ExportNote): void {
	const links = Array.from(el.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')).filter(
		(a) => !a.hasClass('internal-link') && !a.hasClass('tag'),
	);
	const renamed = new Map<string, string>();
	for (const link of links) {
		const target = safeDecode(link.getAttribute('href')?.slice(1) ?? '');
		if (!target) continue;
		let id = renamed.get(target);
		if (!id) {
			const targetEl = el.querySelector(`[id="${CSS.escape(target)}"]`);
			if (!targetEl) continue;
			id = `${noteAnchorId(note)}-${target}`;
			targetEl.id = id;
			renamed.set(target, id);
		}
		link.setAttribute('href', `#${id}`);
		link.removeAttribute('target');
	}
}

/**
 * Matches the rendered headings (excluding those inside embeds) to the
 * metadata cache, so links can be resolved from the cache alone.
 */
function assignHeadingIds(el: HTMLElement, note: ExportNote, app: App): NoteHeading[] {
	const cacheHeadings = app.metadataCache.getFileCache(note.file)?.headings ?? [];
	const domHeadings = Array.from(el.querySelectorAll<HTMLElement>(HEADINGS)).filter(
		(h) => !h.closest('.markdown-embed'),
	);
	const matchByIndex = domHeadings.length === cacheHeadings.length;
	const used = new Set<number>();

	return domHeadings.map((heading, domIndex) => {
		const text = heading.textContent?.trim() ?? '';
		let cacheIndex = matchByIndex ? domIndex : findHeading(cacheHeadings, text, used);
		if (cacheIndex >= 0) used.add(cacheIndex);
		const id = cacheIndex >= 0 ? headingAnchorId(note, cacheIndex) : `n${note.index}-x${domIndex}`;
		heading.id = id;
		// An empty self-link makes Chromium emit a named destination for the heading,
		// which the PDF bookmarks point to.
		heading.prepend(createAnchor(el, id));
		return { id, text, level: Number(heading.tagName.slice(1)) };
	});
}

function findHeading(headings: HeadingCache[], text: string, used: Set<number>): number {
	return headings.findIndex((h, i) => !used.has(i) && h.heading.trim() === text);
}

export function createAnchor(el: HTMLElement, id: string): HTMLAnchorElement {
	const anchor = el.doc.createElement('a');
	anchor.addClass('bpe-anchor');
	anchor.setAttribute('href', `#${id}`);
	anchor.setAttribute('aria-hidden', 'true');
	return anchor;
}

function resolveInternalLink(link: HTMLAnchorElement, note: ExportNote, ctx: LinkContext): string | null {
	const linktext = link.getAttribute('data-href') ?? link.getAttribute('href') ?? '';
	const { path, subpath } = parseLinktext(safeDecode(linktext));
	const targetFile = path
		? ctx.app.metadataCache.getFirstLinkpathDest(path, note.file.path)
		: note.file;
	const target = targetFile ? ctx.notesByPath.get(targetFile.path) : undefined;
	if (!target) return null;

	// In separate mode, a link to another note opens that note's PDF.
	if (ctx.mode === 'separate' && target !== note) {
		return target.outputPath ? toFileUrl(target.outputPath) : null;
	}
	return `#${subpathAnchorId(target, subpath, ctx.app) ?? noteAnchorId(target)}`;
}

function subpathAnchorId(target: ExportNote, subpath: string, app: App): string | null {
	if (!subpath) return null;
	const cache = app.metadataCache.getFileCache(target.file);
	if (!cache) return null;
	const result = resolveSubpath(cache, subpath);
	if (result?.type === 'heading') {
		const index = cache.headings?.indexOf(result.current) ?? -1;
		return index >= 0 ? headingAnchorId(target, index) : null;
	}
	if (result?.type === 'block') return blockAnchorId(target, result.block.id);
	return null;
}

/** Replaces a link with a span that keeps its content but no longer links anywhere. */
function unwrapLink(link: HTMLAnchorElement, cls: string): void {
	const span = link.doc.createElement('span');
	span.addClass(cls);
	while (link.firstChild) span.appendChild(link.firstChild);
	link.replaceWith(span);
}

function safeDecode(text: string): string {
	try {
		return decodeURIComponent(text);
	} catch {
		return text;
	}
}
