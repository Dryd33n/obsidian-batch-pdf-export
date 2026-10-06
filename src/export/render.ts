import { App, CachedMetadata, Component, MarkdownRenderer, TFile, getFrontMatterInfo } from 'obsidian';
import { escapeHtml, sleep } from '../utils/html';

const QUIET_MS = 400;
const POLL_MS = 50;

/** Mermaid code blocks and math that Obsidian has not finished rendering. */
const PENDING_SELECTOR = [
	'pre.language-mermaid:not(.mermaid-guard-source pre)',
	'.math:not(.is-loaded)',
].join(', ');

/**
 * Embedded files that cannot appear in a PDF. They are swapped for a
 * placeholder before rendering, so their viewers are never loaded.
 */
const UNPRINTABLE_EXTENSIONS = new Set([
	'pdf', 'canvas',
	'mp3', 'wav', 'm4a', 'ogg', 'flac', '3gp',
	'mp4', 'webm', 'ogv', 'mov', 'mkv',
]);

interface TextEdit {
	start: number;
	end: number;
	text: string;
}

/**
 * Renders notes with Obsidian's own markdown renderer into an off-screen
 * container, so that embeds, MathJax, Mermaid and plugin content behave
 * exactly like Reading view.
 */
export class NoteRenderer {
	private readonly stagingEl: HTMLElement;
	private component: Component | null = null;

	constructor(
		private readonly app: App,
		widthPx: number,
		private readonly timeoutMs: number,
	) {
		this.stagingEl = activeDocument.body.createDiv({ cls: 'batch-pdf-export-staging' });
		this.stagingEl.setCssProps({ '--bpe-staging-width': `${Math.round(widthPx)}px` });
	}

	/** Renders a note and returns its container. The container stays valid until the next render. */
	async render(file: TFile): Promise<HTMLElement> {
		this.clear();
		const component = new Component();
		component.load();
		this.component = component;

		const el = this.stagingEl.createDiv({ cls: 'markdown-preview-view markdown-rendered' });
		const markdown = this.prepareMarkdown(await this.app.vault.cachedRead(file), file);
		const started = Date.now();
		await Promise.race([
			MarkdownRenderer.render(this.app, markdown, el, file.path, component),
			sleep(this.timeoutMs),
		]);
		await waitForSettle(el, Math.max(this.timeoutMs - (Date.now() - started), QUIET_MS * 2));
		return el;
	}

	clear(): void {
		this.component?.unload();
		this.component = null;
		this.stagingEl.empty();
	}

	destroy(): void {
		this.clear();
		this.stagingEl.remove();
	}

	/**
	 * Removes the frontmatter, turns block IDs (`^id`) into anchors that
	 * survive rendering so `[[Note#^id]]` links can jump to them, and replaces
	 * embeds of files that cannot be printed with a placeholder.
	 */
	private prepareMarkdown(content: string, file: TFile): string {
		const cache = this.app.metadataCache.getFileCache(file);
		const edits = [...blockAnchorEdits(content, cache), ...this.unprintableEmbedEdits(cache, file)];
		for (const edit of edits.sort((a, b) => b.start - a.start)) {
			content = content.slice(0, edit.start) + edit.text + content.slice(edit.end);
		}
		return content.slice(getFrontMatterInfo(content).contentStart);
	}

	private unprintableEmbedEdits(cache: CachedMetadata | null, file: TFile): TextEdit[] {
		return (cache?.embeds ?? []).flatMap((embed) => {
			const target = this.app.metadataCache.getFirstLinkpathDest(embed.link.split('#')[0] ?? '', file.path);
			if (!target || !UNPRINTABLE_EXTENSIONS.has(target.extension.toLowerCase())) return [];
			const label = target.extension === 'pdf' || target.extension === 'canvas' ? 'Embedded file not included' : 'Media not included';
			return [{
				start: embed.position.start.offset,
				end: embed.position.end.offset,
				text: `<span class="bpe-placeholder"><span class="bpe-placeholder-label">${label}</span>` +
					`<span class="bpe-placeholder-detail">${escapeHtml(target.name)}</span></span>`,
			}];
		});
	}
}

function blockAnchorEdits(content: string, cache: CachedMetadata | null): TextEdit[] {
	return Object.values(cache?.blocks ?? {}).flatMap((block) => {
		const marker = `^${block.id}`;
		const start = content.indexOf(marker, block.position.start.offset);
		if (start < 0) return [];
		return [{
			start,
			end: start + marker.length,
			text: `<span class="bpe-block-anchor" data-bpe-block="${block.id}"></span>`,
		}];
	});
}

/** True if Mermaid diagrams are blocked because the vault is not trusted for them yet. */
export function hasBlockedMermaid(el: HTMLElement): boolean {
	return el.querySelector('.mermaid-wrapper.is-guarded') !== null;
}

/** Selects Obsidian's own "Allow" button on a Mermaid guard, which trusts the vault. */
export function allowMermaid(el: HTMLElement): boolean {
	const button = el.querySelector<HTMLButtonElement>('.mermaid-wrapper.is-guarded .mermaid-guard-actions button');
	button?.click();
	return button !== null;
}

/** Waits until nothing in `el` has changed for a moment and no diagrams or math are pending. */
async function waitForSettle(el: HTMLElement, timeoutMs: number): Promise<void> {
	const start = Date.now();
	let lastChange = Date.now();
	const observer = new MutationObserver(() => (lastChange = Date.now()));
	observer.observe(el, { subtree: true, childList: true, attributes: true, characterData: true });
	try {
		while (Date.now() - start < timeoutMs) {
			await sleep(POLL_MS);
			if (Date.now() - lastChange >= QUIET_MS && !el.querySelector(PENDING_SELECTOR)) return;
		}
	} finally {
		observer.disconnect();
	}
}
