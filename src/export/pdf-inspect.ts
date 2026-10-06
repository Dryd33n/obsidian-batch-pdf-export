import { loadPdfJs } from 'obsidian';

export interface PdfRef {
	num: number;
	gen: number;
}

/** Where a named destination points: a page and a position on it. */
export interface PdfDest {
	pageIndex: number;
	pageRef: PdfRef;
	x: number | null;
	y: number | null;
}

/** A link annotation that opens a local file. */
export interface PdfFileLink {
	ref: PdfRef;
	rect: number[];
	url: string;
}

export interface PdfInfo {
	numPages: number;
	dests: Map<string, PdfDest>;
	fileLinks: PdfFileLink[];
}

/* Minimal typings for the parts of pdf.js used here. */
interface PdfJsLib {
	getDocument(params: { data: Uint8Array }): { promise: Promise<PdfJsDocument> };
}
interface PdfJsDocument {
	numPages: number;
	getDestinations(): Promise<Record<string, unknown[]> | null>;
	getPageIndex(ref: PdfRef): Promise<number>;
	getPage(pageNumber: number): Promise<{ getAnnotations(): Promise<PdfJsAnnotation[]> }>;
	destroy(): Promise<void>;
}
interface PdfJsAnnotation {
	id: string;
	subtype: string;
	rect: number[];
	unsafeUrl?: string;
}

/** Reads named destinations and local file links from a PDF printed by Chromium. */
export async function inspectPdf(data: Uint8Array, collectFileLinks: boolean): Promise<PdfInfo> {
	const pdfjs = (await loadPdfJs()) as PdfJsLib;
	// pdf.js takes ownership of the buffer it is given, so pass a copy.
	const doc = await pdfjs.getDocument({ data: data.slice() }).promise;
	try {
		const dests = new Map<string, PdfDest>();
		for (const [name, dest] of Object.entries((await doc.getDestinations()) ?? {})) {
			const pageRef = dest[0] as PdfRef | undefined;
			if (!pageRef || typeof pageRef.num !== 'number') continue;
			dests.set(name, {
				pageIndex: await doc.getPageIndex(pageRef),
				pageRef,
				x: typeof dest[2] === 'number' ? dest[2] : null,
				y: typeof dest[3] === 'number' ? dest[3] : null,
			});
		}

		const fileLinks: PdfFileLink[] = [];
		if (collectFileLinks) {
			for (let page = 1; page <= doc.numPages; page++) {
				for (const annotation of await (await doc.getPage(page)).getAnnotations()) {
					const ref = parseAnnotationId(annotation.id);
					const url = annotation.unsafeUrl;
					if (annotation.subtype === 'Link' && ref && url?.startsWith('file:')) {
						fileLinks.push({ ref, rect: annotation.rect, url });
					}
				}
			}
		}
		return { numPages: doc.numPages, dests, fileLinks };
	} finally {
		await doc.destroy();
	}
}

/** pdf.js annotation IDs look like `12R` (object 12, generation 0) or `12R3`. */
function parseAnnotationId(id: string): PdfRef | null {
	const match = /^(\d+)R(\d*)$/.exec(id);
	return match ? { num: Number(match[1]), gen: Number(match[2] || 0) } : null;
}
