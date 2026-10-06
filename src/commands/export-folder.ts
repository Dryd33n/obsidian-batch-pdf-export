import { Notice, TFolder } from 'obsidian';
import { ExportError } from '../export/exporter';
import type BatchPdfExportPlugin from '../main';
import type { ExportOptions } from '../types';
import { confirmModal } from '../ui/confirm-modal';
import { ExportModal } from '../ui/export-modal';
import { FolderSuggestModal } from '../ui/folder-suggest-modal';
import { ProgressNotice } from '../ui/progress-notice';
import { showItemInFolder } from '../utils/electron';

export function registerExportCommands(plugin: BatchPdfExportPlugin): void {
	plugin.addCommand({
		id: 'export-folder',
		name: 'Export folder to PDF…',
		callback: () => new FolderSuggestModal(plugin.app, (folder) => openExportModal(plugin, folder)).open(),
	});

	plugin.registerEvent(
		plugin.app.workspace.on('file-menu', (menu, file) => {
			if (!(file instanceof TFolder)) return;
			menu.addItem((item) =>
				item
					.setTitle('Export folder to PDF')
					.setIcon('file-output')
					.setSection('action')
					.onClick(() => openExportModal(plugin, file)),
			);
		}),
	);
}

export function openExportModal(plugin: BatchPdfExportPlugin, folder: TFolder): void {
	new ExportModal(plugin, folder, (options) => void startExport(plugin, folder, options)).open();
}

/** Runs an export with progress, cancel and result notices. */
async function startExport(plugin: BatchPdfExportPlugin, folder: TFolder, options: ExportOptions): Promise<void> {
	if (plugin.isExporting) {
		new Notice('An export is already running.');
		return;
	}
	// Created on first progress update, so nothing shows if the save dialog is cancelled.
	let progress = null as ProgressNotice | null;
	try {
		const result = await plugin.exportFolder(folder, options, {
			onProgress: (message) => {
				progress ??= new ProgressNotice(message);
				progress.setText(message);
			},
			isCancelled: () => progress?.isCancelled ?? false,
			confirm: (title, message, label) => confirmModal(plugin.app, title, message, label),
		});
		progress?.hide();

		if (result.cancelled && result.outputs.length === 0) {
			// Nothing to report if the save dialog was dismissed before the export started.
			if (progress) new Notice('Export cancelled.');
			return;
		}
		const pdfs = `${result.outputs.length} ${result.outputs.length === 1 ? 'PDF' : 'PDFs'}`;
		let message = result.cancelled ? `Export cancelled after ${pdfs}.` : `Exported ${pdfs}.`;
		if (result.failures.length > 0) {
			message += ` ${result.failures.length} ${result.failures.length === 1 ? 'note' : 'notes'} could not be exported; see the developer console for details.`;
		}
		const first = result.outputs[0];
		const fragment = createFragment((f) => {
			f.createDiv({ text: message });
			if (first) {
				f.createEl('button', { text: 'Show in folder', cls: 'batch-pdf-export-reveal' }).addEventListener(
					'click',
					() => showItemInFolder(first),
				);
			}
		});
		new Notice(fragment, 10000);
	} catch (error) {
		progress?.hide();
		console.error('Batch PDF Export: export failed', error);
		const reason = error instanceof ExportError ? error.message : 'Export failed. See the developer console for details.';
		new Notice(reason);
	}
}
