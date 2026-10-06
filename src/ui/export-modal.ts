import { Modal, Setting, TFolder } from 'obsidian';
import { collectNotes } from '../export/collect';
import type BatchPdfExportPlugin from '../main';
import type { ExportMode, ExportOptions } from '../types';

/** Asks how to export a folder: one PDF per note or one combined PDF. */
export class ExportModal extends Modal {
	private mode: ExportMode;
	private includeSubfolders: boolean;
	private countEl: HTMLElement | null = null;
	private exportButton: HTMLButtonElement | null = null;

	constructor(
		private readonly plugin: BatchPdfExportPlugin,
		private readonly folder: TFolder,
		private readonly onSubmit: (options: ExportOptions) => void,
	) {
		super(plugin.app);
		this.mode = plugin.settings.mode;
		this.includeSubfolders = plugin.settings.includeSubfolders;
		const name = folder.isRoot() ? plugin.app.vault.getName() : folder.name;
		this.setTitle(`Export “${name}” to PDF`);
	}

	onOpen(): void {
		const { contentEl } = this;

		new Setting(contentEl).setName('Export as').addDropdown((dropdown) =>
			dropdown
				.addOption('separate', 'One PDF per note')
				.addOption('single', 'One combined PDF')
				.setValue(this.mode)
				.onChange((value) => {
					this.mode = value as ExportMode;
					this.updateCount();
				}),
		);

		new Setting(contentEl).setName('Include subfolders').addToggle((toggle) =>
			toggle.setValue(this.includeSubfolders).onChange((value) => {
				this.includeSubfolders = value;
				this.updateCount();
			}),
		);

		this.countEl = contentEl.createEl('p', { cls: 'batch-pdf-export-count setting-item-description' });

		new Setting(contentEl)
			.addButton((button) => button.setButtonText('Cancel').onClick(() => this.close()))
			.addButton((button) => {
				this.exportButton = button.buttonEl;
				button
					.setButtonText('Export')
					.setCta()
					.onClick(() => void this.submit());
			});

		this.updateCount();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private updateCount(): void {
		const count = collectNotes(this.folder, this.includeSubfolders).length;
		const notes = `${count} ${count === 1 ? 'note' : 'notes'}`;
		this.countEl?.setText(
			count === 0
				? 'There are no notes to export.'
				: this.mode === 'single'
					? `${notes} will be combined into one PDF.`
					: `${notes} will be exported to a new folder.`,
		);
		if (this.exportButton) this.exportButton.disabled = count === 0;
	}

	private async submit(): Promise<void> {
		const settings = this.plugin.settings;
		settings.mode = this.mode;
		settings.includeSubfolders = this.includeSubfolders;
		await this.plugin.saveSettings();
		this.close();
		this.onSubmit({ mode: this.mode, includeSubfolders: this.includeSubfolders });
	}
}
