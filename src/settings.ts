import { App, PluginSettingTab, Setting } from 'obsidian';
import type BatchPdfExportPlugin from './main';
import type { ExportMode } from './types';

export type PageSize = 'A3' | 'A4' | 'A5' | 'Letter' | 'Legal';
export type DateSource = 'frontmatter' | 'modified' | 'created' | 'export';

export interface BatchPdfExportSettings {
	mode: ExportMode;
	includeSubfolders: boolean;
	pageSize: PageSize;
	landscape: boolean;
	/** Page margin in millimetres. */
	margin: number;
	dateSource: DateSource;
	/** Frontmatter property read when `dateSource` is `frontmatter`. */
	dateProperty: string;
	dateFormat: string;
	includeCoverAndToc: boolean;
	pageNumbers: boolean;
	useTheme: boolean;
	/** Maximum time in seconds to wait for a note to finish rendering. */
	renderTimeout: number;
	/** Directory last chosen in the save dialog. */
	lastExportDirectory: string;
}

export const DEFAULT_SETTINGS: BatchPdfExportSettings = {
	mode: 'separate',
	includeSubfolders: true,
	pageSize: 'A4',
	landscape: false,
	margin: 15,
	dateSource: 'frontmatter',
	dateProperty: 'date',
	dateFormat: 'YYYY-MM-DD',
	includeCoverAndToc: true,
	pageNumbers: true,
	useTheme: false,
	renderTimeout: 10,
	lastExportDirectory: '',
};

/** Page dimensions in millimetres, portrait. */
export const PAGE_SIZES_MM: Record<PageSize, [number, number]> = {
	A3: [297, 420],
	A4: [210, 297],
	A5: [148, 210],
	Letter: [215.9, 279.4],
	Legal: [215.9, 355.6],
};

export class BatchPdfExportSettingTab extends PluginSettingTab {
	plugin: BatchPdfExportPlugin;

	constructor(app: App, plugin: BatchPdfExportPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		const settings = this.plugin.settings;
		const save = () => this.plugin.saveSettings();
		containerEl.empty();

		new Setting(containerEl)
			.setName('Default export mode')
			.setDesc('You can change this each time you export.')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('separate', 'One PDF per note')
					.addOption('single', 'One combined PDF')
					.setValue(settings.mode)
					.onChange(async (value) => {
						settings.mode = value as ExportMode;
						await save();
					}),
			);

		new Setting(containerEl)
			.setName('Include subfolders')
			.setDesc('Also export notes in nested folders.')
			.addToggle((toggle) =>
				toggle.setValue(settings.includeSubfolders).onChange(async (value) => {
					settings.includeSubfolders = value;
					await save();
				}),
			);

		new Setting(containerEl).setName('Page').setHeading();

		new Setting(containerEl).setName('Page size').addDropdown((dropdown) => {
			for (const size of Object.keys(PAGE_SIZES_MM)) dropdown.addOption(size, size);
			dropdown.setValue(settings.pageSize).onChange(async (value) => {
				settings.pageSize = value as PageSize;
				await save();
			});
		});

		new Setting(containerEl).setName('Landscape').addToggle((toggle) =>
			toggle.setValue(settings.landscape).onChange(async (value) => {
				settings.landscape = value;
				await save();
			}),
		);

		new Setting(containerEl)
			.setName('Margins')
			.setDesc('Page margins in millimetres.')
			.addText((text) =>
				text
					.setPlaceholder(String(DEFAULT_SETTINGS.margin))
					.setValue(String(settings.margin))
					.onChange(async (value) => {
						const margin = Number(value);
						if (value.trim() === '' || !Number.isFinite(margin) || margin < 5 || margin > 50) return;
						settings.margin = margin;
						await save();
					}),
			);

		new Setting(containerEl)
			.setName('Page numbers')
			.setDesc('Show page numbers in the page footer.')
			.addToggle((toggle) =>
				toggle.setValue(settings.pageNumbers).onChange(async (value) => {
					settings.pageNumbers = value;
					await save();
				}),
			);

		new Setting(containerEl)
			.setName('Title page and table of contents')
			.setDesc('Add a title page and a linked table of contents when combining notes into one PDF.')
			.addToggle((toggle) =>
				toggle.setValue(settings.includeCoverAndToc).onChange(async (value) => {
					settings.includeCoverAndToc = value;
					await save();
				}),
			);

		new Setting(containerEl).setName('Note header').setHeading();

		new Setting(containerEl)
			.setName('Date shown')
			.setDesc('The date printed under each note title.')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('frontmatter', 'Property, else date modified')
					.addOption('modified', 'Date modified')
					.addOption('created', 'Date created')
					.addOption('export', 'Export date')
					.setValue(settings.dateSource)
					.onChange(async (value) => {
						settings.dateSource = value as DateSource;
						await save();
						this.display();
					}),
			);

		if (settings.dateSource === 'frontmatter') {
			new Setting(containerEl)
				.setName('Date property')
				.setDesc('Property that holds the note date.')
				.addText((text) =>
					text
						.setPlaceholder(DEFAULT_SETTINGS.dateProperty)
						.setValue(settings.dateProperty)
						.onChange(async (value) => {
							settings.dateProperty = value.trim() || DEFAULT_SETTINGS.dateProperty;
							await save();
						}),
				);
		}

		new Setting(containerEl)
			.setName('Date format')
			.setDesc('Uses moment.js format tokens.')
			.addMomentFormat((format) =>
				format
					.setDefaultFormat(DEFAULT_SETTINGS.dateFormat)
					.setValue(settings.dateFormat)
					.onChange(async (value) => {
						settings.dateFormat = value.trim() || DEFAULT_SETTINGS.dateFormat;
						await save();
					}),
			);

		new Setting(containerEl).setName('Advanced').setHeading();

		new Setting(containerEl)
			.setName('Use community theme and snippets')
			.setDesc('Style the PDF with your theme and CSS snippets (light variant) instead of the clean default style.')
			.addToggle((toggle) =>
				toggle.setValue(settings.useTheme).onChange(async (value) => {
					settings.useTheme = value;
					await save();
				}),
			);

		new Setting(containerEl)
			.setName('Render timeout')
			.setDesc('Maximum seconds to wait for a note to finish rendering, for example diagrams or content from other plugins.')
			.addText((text) =>
				text
					.setPlaceholder(String(DEFAULT_SETTINGS.renderTimeout))
					.setValue(String(settings.renderTimeout))
					.onChange(async (value) => {
						const seconds = Number(value);
						if (value.trim() === '' || !Number.isFinite(seconds) || seconds < 1 || seconds > 120) return;
						settings.renderTimeout = seconds;
						await save();
					}),
			);
	}
}
