import { App, TFile, moment } from 'obsidian';
import type { BatchPdfExportSettings } from '../settings';

const DATE_FORMATS = [moment.ISO_8601, 'YYYY-MM-DD', 'YYYY/MM/DD', 'DD.MM.YYYY', 'D MMMM YYYY', 'MMMM D, YYYY'];

/** The date printed under a note's title, formatted with the user's format. */
export function noteDate(app: App, file: TFile, settings: BatchPdfExportSettings, exportTime: number): string {
	let date: moment.Moment;
	switch (settings.dateSource) {
		case 'created':
			date = moment(file.stat.ctime);
			break;
		case 'export':
			date = moment(exportTime);
			break;
		case 'modified':
			date = moment(file.stat.mtime);
			break;
		case 'frontmatter': {
			const value: unknown = app.metadataCache.getFileCache(file)?.frontmatter?.[settings.dateProperty];
			date = parseDate(value) ?? moment(file.stat.mtime);
			break;
		}
	}
	return date.format(settings.dateFormat);
}

function parseDate(value: unknown): moment.Moment | null {
	if (Array.isArray(value)) return parseDate(value[0]);
	if (typeof value !== 'string' && typeof value !== 'number') return null;
	const date = typeof value === 'number' ? moment(value) : moment(value.trim(), DATE_FORMATS, true);
	return date.isValid() ? date : null;
}
