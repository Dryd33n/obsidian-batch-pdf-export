import { TFolder } from 'obsidian';
import type { ExportNote, ExportSource, NoteSelection } from '../types';
import { nodePath } from '../utils/node';
import { sanitizeFileName, uniqueName } from '../utils/paths';
import { EMPTY_SELECTION, isNote, orderRank, orderedChildren } from './note-order';

/**
 * Lists the markdown notes in an export source in export order. Selected notes
 * sit at the top level and selected folders keep their own structure. By default each
 * folder's notes come first, then its subfolders, both sorted by name; a
 * selection can reorder them within their folder and leave some out.
 */
export function collectNotes(
	source: ExportSource,
	includeSubfolders: boolean,
	selection: NoteSelection = EMPTY_SELECTION,
): ExportNote[] {
	const notes: ExportNote[] = [];
	const rank = orderRank(selection.order);
	const removed = new Set(selection.removed);

	const walk = (current: TFolder | ExportSource, relativeFolder: string) => {
		for (const item of orderedChildren(current, includeSubfolders, rank)) {
			if (removed.has(item.path)) continue;
			if (isNote(item)) {
				notes.push({ index: notes.length, file: item, relativeFolder });
			} else if (item instanceof TFolder) {
				walk(item, relativeFolder ? `${relativeFolder}/${item.name}` : item.name);
			}
		}
	};

	walk(source, '');
	return notes;
}

/** Assigns each note a PDF path inside `outputDir`, mirroring the folder structure. */
export function planOutputPaths(notes: ExportNote[], outputDir: string): void {
	const path = nodePath();
	const takenByDir = new Map<string, Set<string>>();
	for (const note of notes) {
		const segments = note.relativeFolder ? note.relativeFolder.split('/').map(sanitizeFileName) : [];
		const dir = path.join(outputDir, ...segments);
		let taken = takenByDir.get(dir);
		if (!taken) takenByDir.set(dir, (taken = new Set()));
		const name = uniqueName(sanitizeFileName(note.file.basename), taken);
		note.outputPath = path.join(dir, `${name}.pdf`);
	}
}
