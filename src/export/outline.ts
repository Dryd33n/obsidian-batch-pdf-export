import type { NoteHeading, RenderedNote } from '../types';
import { noteAnchorId } from './links';
import type { PdfDest } from './pdf-inspect';
import type { OutlineNode } from './pdf-update';

/** Bookmarks for one note's headings, nested by heading level. */
export function headingsOutline(headings: NoteHeading[], dests: Map<string, PdfDest>): OutlineNode[] {
	const roots: OutlineNode[] = [];
	const stack: { level: number; node: OutlineNode }[] = [];
	for (const heading of headings) {
		const dest = dests.get(heading.id);
		if (!dest || !heading.text) continue;
		const node: OutlineNode = { title: heading.text, dest, children: [], open: false };
		while (stack.length > 0 && stack[stack.length - 1]!.level >= heading.level) stack.pop();
		const parent = stack[stack.length - 1];
		(parent ? parent.node.children : roots).push(node);
		stack.push({ level: heading.level, node });
	}
	return roots;
}

/**
 * Bookmarks for a combined PDF: the table of contents, then one entry per note
 * (holding its headings), grouped under expanded folder entries.
 */
export function combinedOutline(notes: RenderedNote[], dests: Map<string, PdfDest>): OutlineNode[] {
	const roots: OutlineNode[] = [];
	const toc = dests.get('bpe-toc');
	if (toc) roots.push({ title: 'Contents', dest: toc, children: [], open: false });

	const folders = new Map<string, OutlineNode>();
	const folderNode = (relativeFolder: string, dest: PdfDest): OutlineNode[] => {
		if (!relativeFolder) return roots;
		const existing = folders.get(relativeFolder);
		if (existing) return existing.children;
		const slash = relativeFolder.lastIndexOf('/');
		const parent = folderNode(slash < 0 ? '' : relativeFolder.slice(0, slash), dest);
		const node: OutlineNode = { title: relativeFolder.slice(slash + 1), dest, children: [], open: true };
		parent.push(node);
		folders.set(relativeFolder, node);
		return node.children;
	};

	for (const rendered of notes) {
		const dest = dests.get(noteAnchorId(rendered.note));
		if (!dest) continue;
		folderNode(rendered.note.relativeFolder, dest).push({
			title: rendered.title,
			dest,
			children: headingsOutline(rendered.headings, dests),
			open: false,
		});
	}
	return roots;
}
