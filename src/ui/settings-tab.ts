import {
	App,
	PluginSettingTab,
	requireApiVersion,
	Setting,
	type SettingDefinition,
	type SettingDefinitionGroup,
	type SettingDefinitionItem,
} from 'obsidian';
import type BatchPdfExportPlugin from '../main';
import { DEFAULT_SETTINGS, PAGE_SIZES_MM, type BatchPdfExportSettings } from '../settings';

type SettingKey = Exclude<keyof BatchPdfExportSettings, 'lastExportDirectory'>;

/**
 * Settings are declared once with `getSettingDefinitions()`. Obsidian 1.13+
 * renders and indexes them for settings search; older versions fall back to
 * `display()`, which renders the same definitions imperatively.
 */
export class BatchPdfExportSettingTab extends PluginSettingTab {
	plugin: BatchPdfExportPlugin;

	constructor(app: App, plugin: BatchPdfExportPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem<SettingKey>[] {
		const settings = this.plugin.settings;
		return [
			{
				type: 'group',
				items: [
					{
						name: 'Default export mode',
						desc: 'You can change this each time you export.',
						control: {
							type: 'dropdown',
							key: 'mode',
							options: { separate: 'One PDF per note', single: 'One combined PDF' },
						},
					},
					{
						name: 'Include subfolders',
						desc: 'Also export notes in nested folders.',
						control: { type: 'toggle', key: 'includeSubfolders' },
					},
				],
			},
			{
				type: 'group',
				heading: 'Page',
				items: [
					{
						name: 'Page size',
						control: {
							type: 'dropdown',
							key: 'pageSize',
							options: Object.fromEntries(Object.keys(PAGE_SIZES_MM).map((size) => [size, size])),
						},
					},
					{ name: 'Landscape', control: { type: 'toggle', key: 'landscape' } },
					{
						name: 'Margins',
						desc: 'Page margins in millimetres, from 5 to 50.',
						control: {
							type: 'number',
							key: 'margin',
							placeholder: String(DEFAULT_SETTINGS.margin),
							min: 5,
							max: 50,
							validate: (value) => rangeError(value, 5, 50),
						},
					},
					{
						name: 'Page numbers',
						desc: 'Show page numbers in the page footer.',
						control: { type: 'toggle', key: 'pageNumbers' },
					},
					{
						name: 'Title page and table of contents',
						desc: 'Add a title page and a linked table of contents when combining notes into one PDF.',
						aliases: ['cover', 'contents', 'toc'],
						control: { type: 'toggle', key: 'includeCoverAndToc' },
					},
				],
			},
			{
				type: 'group',
				heading: 'Note header',
				items: [
					{
						name: 'Date shown',
						desc: 'The date printed under each note title.',
						control: {
							type: 'dropdown',
							key: 'dateSource',
							options: {
								frontmatter: 'Property, else date modified',
								modified: 'Date modified',
								created: 'Date created',
								export: 'Export date',
							},
						},
					},
					{
						name: 'Date property',
						desc: 'Property that holds the note date.',
						visible: () => settings.dateSource === 'frontmatter',
						control: {
							type: 'text',
							key: 'dateProperty',
							placeholder: DEFAULT_SETTINGS.dateProperty,
							validate: (value) => (value.trim() ? undefined : 'Enter a property name.'),
						},
					},
					{
						name: 'Date format',
						desc: 'Uses moment.js format tokens, for example YYYY-MM-DD or D MMMM YYYY.',
						control: {
							type: 'text',
							key: 'dateFormat',
							placeholder: DEFAULT_SETTINGS.dateFormat,
							validate: (value) => (value.trim() ? undefined : 'Enter a date format.'),
						},
					},
				],
			},
			{
				type: 'group',
				heading: 'Advanced',
				items: [
					{
						name: 'Use community theme and snippets',
						desc: 'Style the PDF with your theme and CSS snippets (light variant) instead of the clean default style.',
						control: { type: 'toggle', key: 'useTheme' },
					},
					{
						name: 'Render timeout',
						desc: 'Maximum seconds to wait for a note to finish rendering, for example diagrams or content from other plugins.',
						control: {
							type: 'number',
							key: 'renderTimeout',
							placeholder: String(DEFAULT_SETTINGS.renderTimeout),
							min: 1,
							max: 120,
							validate: (value) => rangeError(value, 1, 120),
						},
					},
				],
			},
		];
	}

	getControlValue(key: string): unknown {
		return this.plugin.settings[key as SettingKey];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		Object.assign(this.plugin.settings, { [key]: value });
		await this.plugin.saveSettings();
		// Some settings are only shown for certain values of others.
		if (requireApiVersion('1.13.0')) this.refreshDomState();
	}

	/** Fallback for Obsidian versions before 1.13, which don't render setting definitions. */
	display(): void {
		this.renderLegacy();
	}

	private renderLegacy(): void {
		const { containerEl } = this;
		containerEl.empty();
		for (const item of this.getSettingDefinitions()) {
			if (!isGroup(item)) continue;
			if (item.heading) new Setting(containerEl).setName(item.heading).setHeading();
			for (const definition of item.items ?? []) {
				if ('control' in definition && definition.control) this.renderLegacySetting(definition);
			}
		}
	}

	private renderLegacySetting(definition: SettingDefinition<SettingKey>): void {
		const visible = typeof definition.visible === 'function' ? definition.visible() : definition.visible ?? true;
		const control = definition.control;
		if (!visible || !control) return;
		const setting = new Setting(this.containerEl).setName(definition.name);
		if (typeof definition.desc === 'string') setting.setDesc(definition.desc);
		const key = control.key;
		const current = this.getControlValue(key);
		// Re-render after a change so dependent settings show or hide.
		const save = async (value: unknown) => {
			await this.setControlValue(key, value);
			this.renderLegacy();
		};

		switch (control.type) {
			case 'toggle':
				setting.addToggle((toggle) => toggle.setValue(current === true).onChange(save));
				break;
			case 'dropdown':
				setting.addDropdown((dropdown) =>
					dropdown.addOptions(control.options).setValue(String(current)).onChange(save),
				);
				break;
			case 'text':
			case 'number':
				setting.addText((text) =>
					text
						.setPlaceholder(control.placeholder ?? '')
						.setValue(String(current))
						.onChange(async (raw) => {
							const value = control.type === 'number' ? Number(raw) : raw;
							if (raw.trim() === '' || (await control.validate?.(value as never))) return;
							await this.setControlValue(key, value);
						}),
				);
				break;
		}
	}
}

function isGroup(item: SettingDefinitionItem<SettingKey>): item is SettingDefinitionGroup<SettingKey> {
	return 'type' in item && (item.type === 'group' || item.type === 'list');
}

function rangeError(value: number, min: number, max: number): string | undefined {
	return Number.isFinite(value) && value >= min && value <= max ? undefined : `Enter a number from ${min} to ${max}.`;
}
