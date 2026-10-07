import { Plugin, TFolder } from 'obsidian';
import { registerExportCommands } from './commands/export-folder';
import { runExport, type ExportCallbacks } from './export/exporter';
import { registerSelectionTracking } from './export/saved-selections';
import { DEFAULT_SETTINGS, type BatchPdfExportSettings } from './settings';
import { BatchPdfExportSettingTab } from './ui/settings-tab';
import type { ExportOptions, ExportResult } from './types';

export default class BatchPdfExportPlugin extends Plugin {
	settings!: BatchPdfExportSettings;
	isExporting = false;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new BatchPdfExportSettingTab(this.app, this));
		registerExportCommands(this);
		registerSelectionTracking(this);
	}

	/** Exports a folder to PDF. Only one export runs at a time. */
	async exportFolder(
		folder: TFolder,
		options: ExportOptions,
		callbacks: Partial<ExportCallbacks> = {},
	): Promise<ExportResult> {
		if (this.isExporting) throw new Error('An export is already running.');
		this.isExporting = true;
		try {
			return await runExport(this, folder, options, {
				onProgress: callbacks.onProgress ?? (() => {}),
				isCancelled: callbacks.isCancelled ?? (() => false),
				confirm: callbacks.confirm ?? (() => Promise.resolve(false)),
			});
		} finally {
			this.isExporting = false;
		}
	}

	async loadSettings(): Promise<void> {
		const data = ((await this.loadData()) ?? {}) as Partial<BatchPdfExportSettings>;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
		// Copied so that changes never touch the shared default object.
		this.settings.savedSelections = { ...data.savedSelections };
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
