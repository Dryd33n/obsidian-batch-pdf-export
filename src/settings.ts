import type { ExportMode } from './types';

export type PageSize = 'A3' | 'A4' | 'A5' | 'Letter' | 'Legal';
export type DateSource = 'frontmatter' | 'modified' | 'created' | 'export';
/** `app` follows Obsidian's current light or dark mode. */
export type CodeColors = 'app' | 'light' | 'dark';

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
	inlineCodeColors: CodeColors;
	codeBlockColors: CodeColors;
	useTheme: boolean;
	/** Maximum time in seconds to wait for a note to finish rendering. */
	renderTimeout: number;
	/** Directory last chosen in the save dialog. */
	lastExportDirectory: string;
}

/** Settings that can be changed for a single export in the export dialog. */
export type StyleOptions = Pick<BatchPdfExportSettings, 'inlineCodeColors' | 'codeBlockColors' | 'useTheme'>;

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
	inlineCodeColors: 'light',
	codeBlockColors: 'light',
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
