import { Modal, Notice, Setting, TFolder } from 'obsidian';
import { collectNotes } from '../export/collect';
import type BatchPdfExportPlugin from '../main';
import type { CodeColors, StyleOptions } from '../settings';
import type { ExportMode, ExportOptions } from '../types';

const CODE_COLOR_OPTIONS: Record<CodeColors, string> = { light: 'Light', dark: 'Dark', app: 'Match app' };

/** Asks how to export a folder: one PDF per note or one combined PDF. */
export class ExportModal extends Modal {
	private mode: ExportMode;
	private includeSubfolders: boolean;
	private style: StyleOptions;
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
		const { inlineCodeColors, codeBlockColors, useTheme } = plugin.settings;
		this.style = { inlineCodeColors, codeBlockColors, useTheme };
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

		this.renderAdvanced(contentEl);

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

	/**
	 * Style options, folded away by default. Changes apply to this export
	 * only, unless saved as the new defaults.
	 */
	private renderAdvanced(containerEl: HTMLElement): void {
		const details = containerEl.createEl('details', { cls: 'batch-pdf-export-advanced' });
		details.createEl('summary', { text: 'Advanced' });

		new Setting(details)
			.setName('Inline code colors')
			.setDesc('Colors for `inline code`.')
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(CODE_COLOR_OPTIONS)
					.setValue(this.style.inlineCodeColors)
					.onChange((value) => (this.style.inlineCodeColors = value as CodeColors)),
			);

		new Setting(details)
			.setName('Code block colors')
			.setDesc('Colors for fenced code blocks.')
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(CODE_COLOR_OPTIONS)
					.setValue(this.style.codeBlockColors)
					.onChange((value) => (this.style.codeBlockColors = value as CodeColors)),
			);

		new Setting(details)
			.setName('Use community theme and snippets')
			.setDesc('Style the PDF with your theme and CSS snippets (light variant).')
			.addToggle((toggle) => toggle.setValue(this.style.useTheme).onChange((value) => (this.style.useTheme = value)));

		new Setting(details)
			.setDesc('These options apply to this export only.')
			.addButton((button) => button.setButtonText('Save as default').onClick(() => void this.saveStyleAsDefault()));
	}

	private async saveStyleAsDefault(): Promise<void> {
		Object.assign(this.plugin.settings, this.style);
		await this.plugin.saveSettings();
		new Notice('Saved as the default for future exports.');
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
		this.onSubmit({ mode: this.mode, includeSubfolders: this.includeSubfolders, style: { ...this.style } });
	}
}
