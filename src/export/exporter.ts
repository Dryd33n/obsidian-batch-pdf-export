import { TFolder } from 'obsidian';
import type BatchPdfExportPlugin from '../main';
import { PAGE_SIZES_MM, type BatchPdfExportSettings } from '../settings';
import type { ExportOptions, ExportResult, RenderedNote } from '../types';
import { formatDate } from '../utils/dates';
import { pauseBackgroundThrottling } from '../utils/electron';
import { nodePath } from '../utils/node';
import { relativeFilePath, fromFileUrl } from '../utils/paths';
import { AssetInliner } from './assets';
import { darkCodeFor } from './code-colors';
import { collectNotes, planOutputPaths } from './collect';
import { buildCombinedDocument, buildNoteSection } from './document';
import { noteAnchorId, processLinks, type LinkContext } from './links';
import { noteDate } from './note-date';
import { combinedOutline, headingsOutline } from './outline';
import { chooseOutputPath, pathState, writePdf } from './output';
import { inspectPdf } from './pdf-inspect';
import { updatePdf, type OutlineNode, type RelativeLink } from './pdf-update';
import { FOOTER_TEMPLATE } from './print-styles';
import { PdfPrinter, type BodyState, type PrintOptions } from './printer';
import { NoteRenderer, allowMermaid, hasBlockedMermaid } from './render';
import { StyleCollector } from './styles';

/** Combined exports above this size ask for confirmation first. */
const LARGE_EXPORT_NOTES = 300;
const MM_PER_INCH = 25.4;
const CSS_PX_PER_INCH = 96;

export interface ExportCallbacks {
	onProgress(message: string): void;
	isCancelled(): boolean;
	confirm(title: string, message: string, confirmLabel: string): Promise<boolean>;
}

export class ExportError extends Error {}

/** Exports a folder of notes to PDF. Shows the save dialog unless `options.outputPath` is set. */
export async function runExport(
	plugin: BatchPdfExportPlugin,
	folder: TFolder,
	options: ExportOptions,
	callbacks: ExportCallbacks,
): Promise<ExportResult> {
	const { app, settings } = plugin;
	const style = { ...settings, ...options.style };
	const result: ExportResult = { outputs: [], failures: [], cancelled: false };
	const folderName = folder.isRoot() ? app.vault.getName() : folder.name;

	const notes = collectNotes(folder, options.includeSubfolders, options.selection);
	if (notes.length === 0) throw new ExportError(`There are no notes in “${folderName}” to export.`);

	if (
		options.mode === 'single' &&
		notes.length > LARGE_EXPORT_NOTES &&
		!(await callbacks.confirm(
			'Large export',
			`“${folderName}” contains ${notes.length} notes. Combining them into one PDF may take a while and use a lot of memory.`,
			'Export anyway',
		))
	) {
		return { ...result, cancelled: true };
	}

	const outputPath = options.outputPath ?? (await askForOutput(plugin, options, folderName, callbacks));
	if (!outputPath) return { ...result, cancelled: true };
	if (options.mode === 'separate') planOutputPaths(notes, outputPath);
	result.outputRoot = outputPath;

	const layout = pageLayout(settings);
	const inliner = new AssetInliner(app);
	const styles = new StyleCollector(app, style.useTheme);
	const linkContext: LinkContext = {
		app,
		mode: options.mode,
		notesByPath: new Map(notes.map((note) => [note.file.path, note])),
	};
	const exportTime = Date.now();
	const restoreThrottling = pauseBackgroundThrottling();
	const renderer = new NoteRenderer(app, layout.contentWidthPx, settings.renderTimeout * 1000);
	let printer: PdfPrinter | null = null;
	let mermaidAllowed: boolean | null = null;

	try {
		printer = await PdfPrinter.create(darkCodeFor(style));
		// Obsidian's body classes and variables don't change during an export, so read them once.
		const body = bodyState(layout, styles);
		const rendered: RenderedNote[] = [];

		for (const note of notes) {
			if (callbacks.isCancelled()) {
				result.cancelled = true;
				break;
			}
			callbacks.onProgress(`Rendering ${note.index + 1} of ${notes.length}: ${note.file.basename}`);
			try {
				let el = await renderer.render(note.file);
				if (hasBlockedMermaid(el)) {
					mermaidAllowed ??= await callbacks.confirm(
						'Allow Mermaid diagrams?',
						'Some notes contain Mermaid diagrams, but diagrams are not allowed in this vault yet. ' +
							'Allowing applies to the whole vault, the same as selecting Allow on a diagram. Only allow them if you trust the contents of this vault; otherwise the diagram source is printed instead.',
						'Allow diagrams',
					);
					if (mermaidAllowed && allowMermaid(el)) el = await renderer.render(note.file);
				}
				await inliner.prepare(el);
				const headings = processLinks(el, note, linkContext);
				const page: RenderedNote = {
					note,
					title: note.file.basename,
					date: noteDate(app, note.file, settings, exportTime),
					html: el.innerHTML,
					headings,
					hasMath: el.querySelector('mjx-container') !== null,
				};
				if (options.mode === 'separate') {
					await printSeparate(printer, styles, layout, body, page);
					result.outputs.push(note.outputPath!);
				} else {
					rendered.push(page);
				}
			} catch (error) {
				console.error(`Batch PDF Export: could not export ${note.file.path}`, error);
				result.failures.push({ path: note.file.path, error: errorMessage(error) });
			} finally {
				renderer.clear();
			}
		}

		if (options.mode === 'single' && !result.cancelled && rendered.length > 0) {
			callbacks.onProgress(`Creating PDF from ${rendered.length} notes…`);
			const subtitle = `${rendered.length} ${rendered.length === 1 ? 'note' : 'notes'} · Exported ${formatDate(exportTime, settings.dateFormat)}`;
			await printCombined(printer, styles, layout, body, rendered, outputPath, {
				title: folderName,
				subtitle,
				coverAndToc: settings.includeCoverAndToc,
			});
			result.outputs.push(outputPath);
		}
	} finally {
		renderer.destroy();
		restoreThrottling();
		printer?.destroy();
	}
	return result;
}

async function askForOutput(
	plugin: BatchPdfExportPlugin,
	options: ExportOptions,
	folderName: string,
	callbacks: ExportCallbacks,
): Promise<string | null> {
	const chosen = await chooseOutputPath(options.mode, folderName, plugin.settings.lastExportDirectory);
	if (!chosen) return null;

	if (options.mode === 'separate') {
		const state = await pathState(chosen);
		if (state === 'file') throw new ExportError(`A file named “${chosen}” already exists. Choose another name.`);
		if (
			state === 'folder' &&
			!(await callbacks.confirm(
				'Folder already exists',
				`“${chosen}” already exists. PDFs with the same names will be replaced.`,
				'Replace',
			))
		) {
			return null;
		}
	}
	plugin.settings.lastExportDirectory = nodePath().dirname(chosen);
	await plugin.saveSettings();
	return chosen;
}

interface PageLayout {
	contentWidthPx: number;
	contentHeightPx: number;
	print: PrintOptions;
}

function pageLayout(settings: BatchPdfExportSettings): PageLayout {
	let [width, height] = PAGE_SIZES_MM[settings.pageSize];
	if (settings.landscape) [width, height] = [height, width];
	const toPx = (mm: number) => (mm / MM_PER_INCH) * CSS_PX_PER_INCH;
	const margin = settings.margin / MM_PER_INCH;
	return {
		contentWidthPx: toPx(width - 2 * settings.margin),
		contentHeightPx: toPx(height - 2 * settings.margin),
		print: {
			landscape: settings.landscape,
			pageSize: settings.pageSize,
			margins: { top: margin, bottom: margin, left: margin, right: margin },
			printBackground: true,
			displayHeaderFooter: settings.pageNumbers,
			headerTemplate: '<span></span>',
			footerTemplate: FOOTER_TEMPLATE,
		},
	};
}

async function printSeparate(
	printer: PdfPrinter,
	styles: StyleCollector,
	layout: PageLayout,
	body: BodyState,
	page: RenderedNote,
): Promise<void> {
	const target = page.note.outputPath!;
	await printer.load(buildNoteSection(page), styles.collect(page.hasMath), body);
	let pdf = await printer.print(layout.print);

	pdf = await postProcess(pdf, page.title, true, (info) => ({
		outline: headingsOutline(page.headings, info.dests),
		links: info.fileLinks.flatMap((link): RelativeLink[] => {
			const linked = fromFileUrl(link.url);
			return linked ? [{ ref: link.ref, rect: link.rect, relativePath: relativeFilePath(target, linked) }] : [];
		}),
	}));
	await writePdf(target, pdf);
}

async function printCombined(
	printer: PdfPrinter,
	styles: StyleCollector,
	layout: PageLayout,
	body: BodyState,
	notes: RenderedNote[],
	target: string,
	options: { title: string; subtitle: string; coverAndToc: boolean },
): Promise<void> {
	const html = buildCombinedDocument(notes, options);
	await printer.load(html, styles.collect(notes.some((n) => n.hasMath)), body);
	let pdf = await printer.print(layout.print);

	if (options.coverAndToc) {
		// Second pass: now that note positions are known, fill in the page numbers.
		try {
			const { dests } = await inspectPdf(pdf, false);
			const pages: Record<string, number> = {};
			for (const rendered of notes) {
				const dest = dests.get(noteAnchorId(rendered.note));
				if (dest) pages[noteAnchorId(rendered.note)] = dest.pageIndex + 1;
			}
			await printer.setPageNumbers(pages);
			pdf = await printer.print(layout.print);
		} catch (error) {
			console.warn('Batch PDF Export: could not add table of contents page numbers', error);
		}
	}

	pdf = await postProcess(pdf, options.title, false, (info) => ({ outline: combinedOutline(notes, info.dests), links: [] }));
	await writePdf(target, pdf);
}

/** Adds the title, bookmarks and relative links. On failure, the PDF is kept as Chromium printed it. */
async function postProcess(
	pdf: Uint8Array,
	title: string,
	collectFileLinks: boolean,
	build: (info: Awaited<ReturnType<typeof inspectPdf>>) => { outline: OutlineNode[]; links: RelativeLink[] },
): Promise<Uint8Array> {
	try {
		const { outline, links } = build(await inspectPdf(pdf, collectFileLinks));
		return updatePdf(pdf, { title, outline, links });
	} catch (error) {
		console.warn('Batch PDF Export: could not add bookmarks', error);
		return pdf;
	}
}

function bodyState(layout: PageLayout, styles: StyleCollector): BodyState {
	return {
		classes: styles.bodyClasses(),
		vars: { ...styles.bodyVariables(), '--bpe-page-height': `${Math.floor(layout.contentHeightPx)}px` },
	};
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
