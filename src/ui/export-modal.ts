import { Modal, Notice, Setting, TFolder, type ButtonComponent } from 'obsidian';
import { collectNotes } from '../export/collect';
import { EMPTY_SELECTION, copySelection, isDefaultSelection } from '../export/note-order';
import { saveSelection, savedSelection } from '../export/saved-selections';
import type BatchPdfExportPlugin from '../main';
import { CODE_COLOR_OPTIONS, type CodeColors, type StyleOptions } from '../settings';
import type { ExportMode, ExportOptions, NoteSelection } from '../types';
import { ReorderModal } from './reorder-modal';

/** Asks how to export a folder: one PDF per note or one combined PDF. */
export class ExportModal extends Modal {
	private mode: ExportMode;
	private includeSubfolders: boolean;
	private style: StyleOptions;
	/** Not named `selection`: Obsidian's Modal uses that property internally. */
	private noteSelection: NoteSelection;
	private selectionSetting: Setting | null = null;
	private selectionButton: ButtonComponent | null = null;
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
		this.noteSelection = savedSelection(plugin, folder) ?? copySelection(EMPTY_SELECTION);
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
					this.update();
				}),
		);

		new Setting(contentEl).setName('Include subfolders').addToggle((toggle) =>
			toggle.setValue(this.includeSubfolders).onChange((value) => {
				this.includeSubfolders = value;
				this.update();
			}),
		);

		this.selectionSetting = new Setting(contentEl).addButton((button) => {
			this.selectionButton = button;
			button.onClick(() =>
				new ReorderModal(this.plugin, this.folder, this.includeSubfolders, this.mode === 'single', this.noteSelection, (selection) => {
					this.noteSelection = selection;
					this.update();
				}).open(),
			);
		});

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

		this.update();
	}

	/**
	 * Style options, folded away by default. Changes apply to this export
	 * only, unless saved as the new defaults.
	 */
	private renderAdvanced(containerEl: HTMLElement): void {
		const details = containerEl.createEl('details', { cls: 'batch-pdf-export-advanced' });
		const summary = details.createEl('summary');
		summary.createSpan({ text: 'Advanced' });
		summary.createDiv({
			cls: 'batch-pdf-export-hint setting-item-description',
			text: 'Optional. The defaults suit most exports.',
		});

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

	/** Refreshes the note selection row, the note count and the Export button. */
	private update(): void {
		const all = collectNotes(this.folder, this.includeSubfolders);
		const chosen = collectNotes(this.folder, this.includeSubfolders, this.noteSelection);
		const leftOut = all.length - chosen.length;

		this.updateSelectionSetting(chosen.map((note) => note.file.path), leftOut);

		const notes = leftOut > 0 ? `${chosen.length} of ${all.length} notes` : plural(chosen.length, 'note');
		this.countEl?.setText(
			chosen.length === 0
				? 'There are no notes to export.'
				: this.mode === 'single'
					? `${notes} will be combined into one PDF.`
					: `${notes} will be exported to a new folder.`,
		);
		if (this.exportButton) this.exportButton.disabled = chosen.length === 0;
	}

	private updateSelectionSetting(chosenPaths: string[], leftOut: number): void {
		const setting = this.selectionSetting;
		if (!setting) return;
		const combined = this.mode === 'single';
		setting.setName(combined ? 'Note order' : 'Notes');
		this.selectionButton?.setButtonText(combined ? 'Reorder and remove…' : 'Remove notes…');

		const saved = this.plugin.settings.savedSelections[this.folder.path];
		const usingSaved = saved !== undefined && sameSelection(saved, this.noteSelection);
		// Custom order: the included notes are not in the default order.
		const defaultPaths = collectNotes(this.folder, this.includeSubfolders, { order: [], removed: this.noteSelection.removed }).map(
			(note) => note.file.path,
		);
		const customOrder = combined && chosenPaths.some((path, index) => path !== defaultPaths[index]);
		const leftOutText = leftOut > 0 ? `${plural(leftOut, 'note')} left out` : '';

		let text: string;
		if (combined) {
			if (!customOrder && leftOut === 0 && !usingSaved) {
				text = 'Notes are in alphabetical order and all of them are included. Change the order or leave notes out.';
			} else {
				const order = usingSaved ? 'Using your saved order for this folder' : customOrder ? 'Custom order' : 'Alphabetical order';
				text = `${[order, leftOutText].filter(Boolean).join(', ')}.`;
			}
		} else if (leftOut === 0) {
			text = 'All notes are included. Leave some out if you don’t need them.';
		} else {
			text = usingSaved ? `Using your saved selection for this folder, ${leftOutText}.` : `${leftOutText}.`;
		}

		setting.descEl.empty();
		setting.descEl.appendText(`${text} `);
		if (!isDefaultSelection(this.noteSelection) || saved) {
			setting.descEl
				.createEl('a', { text: 'Reset', href: '#', cls: 'batch-pdf-export-reset' })
				.addEventListener('click', (event) => {
					event.preventDefault();
					void this.resetSelection();
				});
		}
	}

	/** Back to alphabetical order with every note, forgetting any saved order for this folder. */
	private async resetSelection(): Promise<void> {
		this.noteSelection = copySelection(EMPTY_SELECTION);
		if (this.plugin.settings.savedSelections[this.folder.path]) {
			await saveSelection(this.plugin, this.folder, this.noteSelection);
			new Notice('Cleared the saved order for this folder.');
		}
		this.update();
	}

	private async submit(): Promise<void> {
		const settings = this.plugin.settings;
		settings.mode = this.mode;
		settings.includeSubfolders = this.includeSubfolders;
		await this.plugin.saveSettings();
		this.close();
		this.onSubmit({
			mode: this.mode,
			includeSubfolders: this.includeSubfolders,
			style: { ...this.style },
			selection: copySelection(this.noteSelection),
		});
	}
}

function sameSelection(a: NoteSelection, b: NoteSelection): boolean {
	const sameList = (x: string[], y: string[]) => x.length === y.length && x.every((value, index) => value === y[index]);
	return sameList(a.order, b.order) && sameList([...a.removed].sort(), [...b.removed].sort());
}

function plural(count: number, noun: string): string {
	return `${count} ${count === 1 ? noun : `${noun}s`}`;
}
