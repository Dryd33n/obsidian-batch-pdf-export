export interface CollectedStyles {
	/** `@font-face` rules with absolute font URLs. */
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
 * Copies the app's stylesheets so the PDF looks like Reading view. Font URLs
 * are made absolute so the print view can load Obsidian's bundled fonts.
 */
export class StyleCollector {
	constructor(private readonly useTheme: boolean) {}

	collect(includeMath: boolean): CollectedStyles {
		const css: string[] = [];
		const fonts: string[] = [];

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
				if (rule instanceof CSSFontFaceRule) fonts.push(absoluteUrls(rule.cssText, base));
				else css.push(rule.cssText);
			}
		}
		return {
			fonts: fonts.join('\n'),
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
}

/** Resolves relative `url()` references against the stylesheet's location. */
function absoluteUrls(cssText: string, base: string): string {
	return cssText.replace(URL_PATTERN, (whole, _quote: string, raw: string) => {
		if (raw.startsWith('data:')) return whole;
		try {
			return `url("${new URL(raw, base).href}")`;
		} catch {
			return whole;
		}
	});
}
