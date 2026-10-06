import type { AssetInliner } from './assets';

export interface CollectedStyles {
	/** `@font-face` rules with fonts inlined as data URLs. */
	fonts: string;
	css: string;
}

const URL_PATTERN = /url\((["']?)([^"')]+)\1\)/g;

/**
 * Chromium before 118 (Obsidian installers up to Electron 25) mixes colours
 * with `transparent` in oklch with the wrong hue, turning tints pink.
 * Mixing in sRGB has no hue to get wrong and looks the same.
 */
const OKLCH_MIX = /color-mix\(\s*in oklch/g;

/** User font settings that live on the main window's body. */
const FONT_VARIABLES = ['--font-text-override', '--font-print-override', '--font-monospace-override'];

/**
 * Copies the app's stylesheets so the PDF looks like Reading view. Fonts are
 * inlined because the print view cannot load Obsidian's `app://` resources.
 */
export class StyleCollector {
	constructor(
		private readonly inliner: AssetInliner,
		private readonly useTheme: boolean,
	) {}

	async collect(includeMath: boolean): Promise<CollectedStyles> {
		const css: string[] = [];
		const fontRules: Promise<string>[] = [];

		for (const sheet of Array.from(activeDocument.styleSheets)) {
			if (!this.isWanted(sheet, includeMath)) continue;
			let rules: CSSRuleList;
			try {
				rules = sheet.cssRules;
			} catch {
				continue; // Cross-origin stylesheet.
			}
			const base = sheet.href ?? activeDocument.baseURI;
			for (const rule of Array.from(rules)) {
				if (rule instanceof CSSFontFaceRule) fontRules.push(this.inlineFontUrls(rule.cssText, base));
				else css.push(rule.cssText);
			}
		}
		return {
			fonts: (await Promise.all(fontRules)).join('\n'),
			css: css.join('\n').replace(OKLCH_MIX, 'color-mix(in srgb'),
		};
	}

	/** The user's font choices, to apply to the print document. */
	fontVariables(): Record<string, string> {
		const style = getComputedStyle(activeDocument.body);
		const vars: Record<string, string> = {};
		for (const name of FONT_VARIABLES) {
			const value = style.getPropertyValue(name).trim();
			if (value) vars[name] = value;
		}
		return vars;
	}

	private isWanted(sheet: CSSStyleSheet, includeMath: boolean): boolean {
		const owner = sheet.ownerNode;
		const isMath = owner instanceof HTMLStyleElement && owner.id.startsWith('MJX-');
		if (isMath) return includeMath;
		if (this.useTheme) return true;
		return !!sheet.href && /\/app\.css(\?|$)/.test(sheet.href);
	}

	private async inlineFontUrls(cssText: string, base: string): Promise<string> {
		const replacements = new Map<string, string>();
		for (const match of cssText.matchAll(URL_PATTERN)) {
			const raw = match[2];
			if (!raw || raw.startsWith('data:') || replacements.has(raw)) continue;
			let absolute: string;
			try {
				absolute = new URL(raw, base).href;
			} catch {
				continue;
			}
			if (/^https?:/i.test(absolute)) continue;
			const dataUrl = await this.inliner.toDataUrl(absolute);
			if (dataUrl) replacements.set(raw, dataUrl);
		}
		return cssText.replace(URL_PATTERN, (whole, _quote: string, raw: string) => {
			const dataUrl = replacements.get(raw);
			return dataUrl ? `url("${dataUrl}")` : whole;
		});
	}
}
