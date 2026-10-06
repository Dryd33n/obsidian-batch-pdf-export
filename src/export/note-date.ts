import { App, TFile } from 'obsidian';
import type { BatchPdfExportSettings } from '../settings';
import { formatDate, parseDate } from '../utils/dates';

/** The date printed under a note's title, formatted with the user's format. */
export function noteDate(app: App, file: TFile, settings: BatchPdfExportSettings, exportTime: number): string {
	switch (settings.dateSource) {
		case 'created':
			return formatDate(file.stat.ctime, settings.dateFormat);
		case 'export':
			return formatDate(exportTime, settings.dateFormat);
		case 'modified':
			return formatDate(file.stat.mtime, settings.dateFormat);
		case 'frontmatter': {
			const value: unknown = app.metadataCache.getFileCache(file)?.frontmatter?.[settings.dateProperty];
			return parseDate(value)?.format(settings.dateFormat) ?? formatDate(file.stat.mtime, settings.dateFormat);
		}
	}
}
