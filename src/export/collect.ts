import { TFile, TFolder } from 'obsidian';
import type { ExportNote } from '../types';
import { nodePath } from '../utils/node';
import { naturalCompare, sanitizeFileName, uniqueName } from '../utils/paths';

/**
 * Lists the markdown notes in a folder in export order: each folder's notes
 * alphabetically (natural sort), followed by its subfolders, also sorted.
 */
export function collectNotes(folder: TFolder, includeSubfolders: boolean): ExportNote[] {
	const notes: ExportNote[] = [];

	const walk = (current: TFolder, relativeFolder: string) => {
		const files = current.children
			.filter((child): child is TFile => child instanceof TFile && child.extension === 'md')
			.sort((a, b) => naturalCompare(a.basename, b.basename));
		for (const file of files) {
			notes.push({ index: notes.length, file, relativeFolder });
		}
		if (!includeSubfolders) return;
		const subfolders = current.children
			.filter((child): child is TFolder => child instanceof TFolder)
			.sort((a, b) => naturalCompare(a.name, b.name));
		for (const sub of subfolders) {
			walk(sub, relativeFolder ? `${relativeFolder}/${sub.name}` : sub.name);
		}
	};

	walk(folder, '');
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
