import { TFolder, type App, type TAbstractFile } from 'obsidian';
import type { ExportSource } from '../types';
import { countNotes, isNote } from './note-order';

export function folderSource(app: App, folder: TFolder): ExportSource {
	return { name: folderName(app, folder), items: folder.children, folder };
}

/**
 * The notes and folders selected in the file explorer, or null if none of
 * them can be exported. Items inside a selected folder are exported with that
 * folder, so they are not listed again.
 */
export function selectionSource(app: App, files: TAbstractFile[]): ExportSource | null {
	const picked = files.filter((file) => isNote(file) || (file instanceof TFolder && countNotes(file) > 0));
	const pickedPaths = new Set(picked.map((file) => file.path));
	const items = picked.filter((file) => !hasPickedAncestor(file, pickedPaths));
	if (items.length === 0) return null;

	// Named after the folder they share, if they all sit in the same one.
	const parent = items[0]!.parent;
	const name = parent && items.every((item) => item.parent === parent) ? folderName(app, parent) : 'Selected notes';
	return { name, items };
}

function hasPickedAncestor(file: TAbstractFile, pickedPaths: ReadonlySet<string>): boolean {
	for (let folder = file.parent; folder; folder = folder.parent) {
		if (pickedPaths.has(folder.path)) return true;
	}
	return false;
}

function folderName(app: App, folder: TFolder): string {
	return folder.isRoot() ? app.vault.getName() : folder.name;
}
