import { App, arrayBufferToBase64 } from 'obsidian';

const IMAGE_TYPES: Record<string, string> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	webp: 'image/webp',
	avif: 'image/avif',
	bmp: 'image/bmp',
	svg: 'image/svg+xml',
	ico: 'image/x-icon',
};

/**
 * Turns a rendered note container into self-contained, printable HTML:
 * strips interactive UI, expands collapsed content, inlines images and
 * replaces content that cannot be printed with a placeholder.
 */

/** Interactive bits of Reading view that make no sense on paper. */
const REMOVE_SELECTOR = [
	'pre.frontmatter',
	'.metadata-container',
	'.copy-code-button',
	'.markdown-embed-link',
	'.callout-fold',
	'.collapse-indicator',
	'.heading-collapse-indicator',
	'.list-collapse-indicator',
	'.mermaid-guard-header',
	'.edit-block-button',
].join(', ');

/** Embeds that cannot be reproduced in a static PDF. */
const UNPRINTABLE_EMBED_SELECTOR = [
	'.internal-embed.pdf-embed',
	'.internal-embed.audio-embed',
	'.internal-embed.video-embed',
	'.internal-embed.canvas-embed',
	'.internal-embed.file-embed',
].join(', ');

export class AssetInliner {
	/** Data URLs by source URL, shared across all notes in one export. */
	private readonly cache = new Map<string, Promise<string | null>>();
	/** URL prefix of vault resources, e.g. `app://<id>/C:/path/to/vault/`. */
	private readonly vaultPrefix: string;

	constructor(private readonly app: App) {
		this.vaultPrefix = stripQuery(app.vault.adapter.getResourcePath('')).replace(/\/?$/, '/');
	}

	async prepare(el: HTMLElement): Promise<void> {
		el.querySelectorAll(REMOVE_SELECTOR).forEach((node) => node.remove());
		expandCollapsed(el);
		replaceUnprintable(el);
		convertCanvases(el);
		await this.inlineImages(el);
	}

	private async inlineImages(el: HTMLElement): Promise<void> {
		const images = Array.from(el.querySelectorAll('img'));
		await Promise.all(
			images.map(async (img) => {
				img.removeAttribute('loading');
				img.removeAttribute('srcset');
				const src = img.getAttribute('src');
				if (!src || src.startsWith('data:') || /^https?:/i.test(src)) return;
				const dataUrl = await this.toDataUrl(src);
				if (dataUrl) img.setAttribute('src', dataUrl);
			}),
		);
	}

	/** Reads a local resource (vault file or bundled app asset) as a data URL. */
	toDataUrl(src: string): Promise<string | null> {
		let pending = this.cache.get(src);
		if (!pending) {
			pending = src.startsWith(this.vaultPrefix) ? this.readVaultFile(src) : fetchAppAsset(src);
			this.cache.set(src, pending);
		}
		return pending;
	}

	private async readVaultFile(src: string): Promise<string | null> {
		const relativePath = decodeURIComponent(stripQuery(src.slice(this.vaultPrefix.length)));
		const file = this.app.vault.getFileByPath(relativePath);
		const type = file ? IMAGE_TYPES[file.extension.toLowerCase()] : undefined;
		if (!file || !type) return null;
		return `data:${type};base64,${arrayBufferToBase64(await this.app.vault.readBinary(file))}`;
	}
}

function stripQuery(url: string): string {
	const query = url.indexOf('?');
	return query < 0 ? url : url.slice(0, query);
}

/**
 * Reads a file bundled with Obsidian, such as a font. These live behind the
 * local app:// protocol, which only `fetch` can read (`requestUrl` cannot).
 */
async function fetchAppAsset(src: string): Promise<string | null> {
	try {
		const response = await fetch(src);
		if (!response.ok) return null;
		const blob = await response.blob();
		return await new Promise<string>((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
			reader.readAsDataURL(blob);
		});
	} catch {
		return null;
	}
}

function expandCollapsed(el: HTMLElement): void {
	el.querySelectorAll('.is-collapsed').forEach((node) => node.removeClass('is-collapsed'));
	el.querySelectorAll<HTMLElement>('.callout-content, .heading-collapse-content').forEach((node) => {
		node.style.removeProperty('display');
	});
	el.querySelectorAll('details').forEach((details) => details.setAttribute('open', ''));
}

function replaceUnprintable(el: HTMLElement): void {
	el.querySelectorAll<HTMLElement>(UNPRINTABLE_EMBED_SELECTOR).forEach((embed) => {
		const name = embed.getAttribute('src') ?? embed.getAttribute('alt') ?? 'file';
		embed.replaceWith(placeholder(el, 'Embedded file not included', name));
	});
	el.querySelectorAll('video, audio').forEach((media) => {
		const name = media.getAttribute('src') ?? '';
		media.replaceWith(placeholder(el, 'Media not included', decodeURIComponent(name.split('/').pop() ?? '')));
	});
	el.querySelectorAll('iframe, webview').forEach((frame) => {
		const src = frame.getAttribute('src') ?? '';
		const box = placeholder(el, 'Embedded web content', '');
		if (/^https?:/i.test(src)) box.createEl('a', { cls: 'external-link', href: src, text: src });
		frame.replaceWith(box);
	});
}

function placeholder(el: HTMLElement, label: string, detail: string): HTMLElement {
	const box = el.doc.createElement('div');
	box.addClass('bpe-placeholder');
	box.createSpan({ cls: 'bpe-placeholder-label', text: label });
	if (detail) box.createSpan({ cls: 'bpe-placeholder-detail', text: detail });
	return box;
}

/** Charts and other canvas content become images so they survive serialization. */
function convertCanvases(el: HTMLElement): void {
	el.querySelectorAll('canvas').forEach((canvas) => {
		try {
			const img = el.doc.createElement('img');
			img.src = canvas.toDataURL('image/png');
			img.width = canvas.clientWidth || canvas.width;
			canvas.replaceWith(img);
		} catch {
			// A canvas tainted by cross-origin content cannot be exported.
			canvas.replaceWith(placeholder(el, 'Canvas content not included', ''));
		}
	});
}
