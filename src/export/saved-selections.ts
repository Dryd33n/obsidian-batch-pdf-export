import type { TFolder } from 'obsidian';
import type BatchPdfExportPlugin from '../main';
import type { NoteSelection } from '../types';
import { copySelection, deleteFromSelection, isDefaultSelection, movedPath, renameInSelection } from './note-order';

/** The order and notes left out saved for a folder, if any. */
export function savedSelection(plugin: BatchPdfExportPlugin, folder: TFolder): NoteSelection | null {
	const saved = plugin.settings.savedSelections[folder.path];
	return saved ? copySelection(saved) : null;
}

/** Saves a folder's selection for next time. A default selection clears the saved one. */
export async function saveSelection(plugin: BatchPdfExportPlugin, folder: TFolder, selection: NoteSelection): Promise<void> {
	const saved = plugin.settings.savedSelections;
	if (isDefaultSelection(selection)) delete saved[folder.path];
	else saved[folder.path] = copySelection(selection);
	await plugin.saveSettings();
}

/** Keeps saved selections pointing at the right notes when notes or folders are renamed, moved or deleted. */
export function registerSelectionTracking(plugin: BatchPdfExportPlugin): void {
	const { vault } = plugin.app;

	plugin.registerEvent(
		vault.on('rename', (file, oldPath) => {
			const saved = plugin.settings.savedSelections;
			let changed = false;
			for (const [folderPath, selection] of Object.entries(saved)) {
				if (renameInSelection(selection, oldPath, file.path)) changed = true;
				const newFolderPath = movedPath(folderPath, oldPath, file.path);
				if (newFolderPath !== folderPath) {
					delete saved[folderPath];
					saved[newFolderPath] = selection;
					changed = true;
				}
			}
			if (changed) void plugin.saveSettings();
		}),
	);

	plugin.registerEvent(
		vault.on('delete', (file) => {
			const saved = plugin.settings.savedSelections;
			let changed = false;
			for (const [folderPath, selection] of Object.entries(saved)) {
				if (movedPath(folderPath, file.path, '') !== folderPath) {
					delete saved[folderPath];
					changed = true;
				} else if (deleteFromSelection(selection, file.path)) {
					if (isDefaultSelection(selection)) delete saved[folderPath];
					changed = true;
				}
			}
			if (changed) void plugin.saveSettings();
		}),
	);
}
