import { TFile, TFolder, type TAbstractFile } from 'obsidian';
import type { NoteSelection } from '../types';
import { naturalCompare } from '../utils/paths';

export type SortBy = 'name' | 'created' | 'modified';

export const EMPTY_SELECTION: NoteSelection = { order: [], removed: [] };

export function isNote(item: TAbstractFile): item is TFile {
	return item instanceof TFile && item.extension === 'md';
}

/** Ranks paths by their position in `order`, for `orderedChildren`. */
export function orderRank(order: readonly string[]): Map<string, number> {
	return new Map(order.map((path, index) => [path, index]));
}

/**
 * A folder's notes and subfolders in export order. By default notes come
 * first, then subfolders, each sorted by name. Items ranked in `rank` move to
 * the front in that order; the rest keep the default order after them.
 */
export function orderedChildren(
	folder: TFolder,
	includeSubfolders: boolean,
	rank: ReadonlyMap<string, number>,
): TAbstractFile[] {
	const notes = folder.children.filter(isNote).sort((a, b) => naturalCompare(a.basename, b.basename));
	const folders = includeSubfolders
		? folder.children
				.filter((child): child is TFolder => child instanceof TFolder && countNotes(child) > 0)
				.sort((a, b) => naturalCompare(a.name, b.name))
		: [];
	const items: TAbstractFile[] = [...notes, ...folders];
	if (rank.size === 0) return items;
	// Array sort is stable, so unranked items keep the default order.
	return items.sort((a, b) => (rank.get(a.path) ?? Infinity) - (rank.get(b.path) ?? Infinity) || 0);
}

/** Number of notes in a folder and all its subfolders. */
export function countNotes(folder: TFolder): number {
	let count = 0;
	for (const child of folder.children) {
		if (isNote(child)) count++;
		else if (child instanceof TFolder) count += countNotes(child);
	}
	return count;
}

/** An explicit order for every note and subfolder, sorted by `sortBy` within each folder. */
export function sortedOrder(folder: TFolder, includeSubfolders: boolean, sortBy: SortBy): string[] {
	const order: string[] = [];
	const walk = (current: TFolder) => {
		const items = orderedChildren(current, includeSubfolders, new Map());
		if (sortBy !== 'name') {
			const time = (item: TAbstractFile) =>
				item instanceof TFile ? (sortBy === 'created' ? item.stat.ctime : item.stat.mtime) : Infinity;
			// Oldest notes first; subfolders stay after the notes, by name.
			items.sort((a, b) => time(a) - time(b) || 0);
		}
		for (const item of items) {
			order.push(item.path);
			if (item instanceof TFolder) walk(item);
		}
	};
	walk(folder);
	return order;
}

/** Whether a selection changes nothing: default order, nothing left out. */
export function isDefaultSelection(selection: NoteSelection): boolean {
	return selection.order.length === 0 && selection.removed.length === 0;
}

export function copySelection(selection: NoteSelection): NoteSelection {
	return { order: [...selection.order], removed: [...selection.removed] };
}

/**
 * Rewrites paths after a note or folder is renamed or moved, including
 * everything inside a renamed folder. Returns true if anything changed.
 */
export function renameInSelection(selection: NoteSelection, oldPath: string, newPath: string): boolean {
	let changed = false;
	const rename = (path: string) => {
		const renamed = movedPath(path, oldPath, newPath);
		if (renamed !== path) changed = true;
		return renamed;
	};
	selection.order = selection.order.map(rename);
	selection.removed = selection.removed.map(rename);
	return changed;
}

/** Drops a deleted note or folder, and everything inside it. Returns true if anything changed. */
export function deleteFromSelection(selection: NoteSelection, deletedPath: string): boolean {
	const keep = (path: string) => path !== deletedPath && !path.startsWith(`${deletedPath}/`);
	const before = selection.order.length + selection.removed.length;
	selection.order = selection.order.filter(keep);
	selection.removed = selection.removed.filter(keep);
	return selection.order.length + selection.removed.length !== before;
}

export function movedPath(path: string, oldPath: string, newPath: string): string {
	if (path === oldPath) return newPath;
	if (path.startsWith(`${oldPath}/`)) return newPath + path.slice(oldPath.length);
	return path;
}
