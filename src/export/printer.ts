import { pauseBackgroundThrottling } from '../utils/electron';
import { darkCodeScript, type DarkCode } from './code-colors';
import type { CollectedStyles } from './styles';
import { PRINT_CSS } from './print-styles';

/** Electron's `printToPDF` options (Electron 25+). Sizes are in inches. */
export interface PrintOptions {
	landscape: boolean;
	pageSize: string;
	margins: { top: number; bottom: number; left: number; right: number };
	printBackground: boolean;
	displayHeaderFooter: boolean;
	headerTemplate?: string;
	footerTemplate?: string;
}

/** The subset of Electron's `<webview>` element the printer uses. */
interface WebviewTag extends HTMLElement {
	executeJavaScript(code: string): Promise<unknown>;
	printToPDF(options: PrintOptions): Promise<Uint8Array>;
	getWebContentsId(): number;
}

declare global {
	interface HTMLElementTagNameMap {
		webview: WebviewTag;
	}
}

/** Classes and CSS variables for the print document's body. */
export interface BodyState {
	classes: string[];
	vars: Record<string, string>;
}

const SHELL = `<!doctype html><html><head><meta charset="utf-8">
<style id="bpe-fonts"></style><style id="bpe-css"></style><style id="bpe-print"></style>
</head><body class="theme-light bpe-export"><div class="print" id="bpe-root"></div></body></html>`;

const ASSET_TIMEOUT_MS = 15000;

/**
 * Prints HTML to PDF with Chromium, using an off-screen `<webview>` so the
 * Obsidian window itself is never affected. One instance is reused for a
 * whole export; styles are only re-sent when they change.
 */
export class PdfPrinter {
	private sent: { fonts?: string; css?: string; bodyClass?: string } = {};

	private constructor(
		private readonly webview: WebviewTag,
		private readonly darkCode: DarkCode,
	) {}

	/** `darkCode` says which kinds of code are printed with the dark colour scheme. */
	static async create(darkCode: DarkCode): Promise<PdfPrinter> {
		const webview = activeDocument.body.createEl('webview', {
			cls: 'batch-pdf-export-webview',
			attr: { src: 'about:blank' },
		});
		const ready = new Promise<void>((resolve, reject) => {
			webview.addEventListener('dom-ready', () => resolve(), { once: true });
			webview.addEventListener('did-fail-load', () => reject(new Error('Could not start the PDF printer.')), { once: true });
		});
		await ready;
		// The webview is never visible, so keep Chromium from throttling it like a hidden page.
		pauseBackgroundThrottling(webview.getWebContentsId());
		await webview.executeJavaScript(
			`document.open(); document.write(${JSON.stringify(SHELL)}); document.close();
			document.getElementById('bpe-print').textContent = ${JSON.stringify(PRINT_CSS)}; true;`,
		);
		return new PdfPrinter(webview, darkCode);
	}

	/** Replaces the printed content and waits for fonts and images to load. */
	async load(html: string, styles: CollectedStyles, body: BodyState): Promise<void> {
		const updates: string[] = [];
		if (styles.fonts !== this.sent.fonts) {
			updates.push(`document.getElementById('bpe-fonts').textContent = ${JSON.stringify(styles.fonts)};`);
		}
		if (styles.css !== this.sent.css) {
			updates.push(`document.getElementById('bpe-css').textContent = ${JSON.stringify(styles.css)};`);
		}
		// The page is always printed light; the other body classes are kept for plugin and theme styles.
		const bodyClass = ['theme-light', 'bpe-export', ...body.classes].join(' ');
		if (bodyClass !== this.sent.bodyClass) {
			updates.push(`document.body.className = ${JSON.stringify(bodyClass)};`);
		}
		const vars = Object.entries(body.vars)
			.map(([name, value]) => `document.body.style.setProperty(${JSON.stringify(name)}, ${JSON.stringify(value)});`)
			.join('');

		await this.webview.executeJavaScript(`(async () => {
			${updates.join('\n')}
			${vars}
			document.getElementById('bpe-root').innerHTML = ${JSON.stringify(html)};
			${darkCodeScript(this.darkCode, updates.length > 0)}
			const images = Array.from(document.images).filter((img) => !img.complete);
			const loaded = Promise.all(images.map((img) => new Promise((r) => { img.onload = img.onerror = r; })));
			// Fonts load lazily, so fonts.ready can resolve before math fonts are fetched.
			// Load every declared face up front; they are local files.
			const fonts = Promise.all(Array.from(document.fonts, (face) => face.load().catch(() => null)));
			await Promise.race([
				Promise.all([loaded, fonts]).then(() => document.fonts.ready),
				new Promise((r) => setTimeout(r, ${ASSET_TIMEOUT_MS})),
			]);
			return true;
		})()`);
		this.sent = { fonts: styles.fonts, css: styles.css, bodyClass };
	}

	/** Writes the table of contents page numbers into the loaded document. */
	async setPageNumbers(pages: Record<string, number>): Promise<void> {
		await this.webview.executeJavaScript(`(() => {
			const pages = ${JSON.stringify(pages)};
			for (const el of document.querySelectorAll('[data-bpe-target]')) {
				el.textContent = pages[el.getAttribute('data-bpe-target')] ?? '';
			}
			return true;
		})()`);
	}

	async print(options: PrintOptions): Promise<Uint8Array> {
		return await this.webview.printToPDF(options);
	}

	destroy(): void {
		this.webview.remove();
	}
}
