import type { TFile } from 'obsidian';
import type { StyleOptions } from './settings';

export type ExportMode = 'separate' | 'single';

export interface ExportOptions {
	mode: ExportMode;
	includeSubfolders: boolean;
	/**
	 * Where to write the export. For `single` mode this is the PDF file path,
	 * for `separate` mode the folder that will hold the PDFs. When omitted, the
	 * user is asked with the system save dialog.
	 */
	outputPath?: string;
	/** Overrides the style settings for this export only. */
	style?: Partial<StyleOptions>;
}

export interface ExportResult {
	/** Absolute paths of the PDFs that were written. */
	outputs: string[];
	/** Notes that could not be exported, with the reason. */
	failures: { path: string; error: string }[];
	cancelled: boolean;
}

/** A note queued for export. */
export interface ExportNote {
	index: number;
	file: TFile;
	/** Folder path relative to the exported folder ('' for the top level). */
	relativeFolder: string;
	/** Absolute output PDF path (separate mode only). */
	outputPath?: string;
}

export interface NoteHeading {
	id: string;
	text: string;
	level: number;
}

/** A note rendered to HTML and ready to place in a print document. */
export interface RenderedNote {
	note: ExportNote;
	title: string;
	date: string;
	html: string;
	headings: NoteHeading[];
	hasMath: boolean;
}
