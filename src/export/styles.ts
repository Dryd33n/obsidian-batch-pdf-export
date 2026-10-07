import type { App } from 'obsidian';

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
 * Body variables and classes that describe the window rather than the
 * content, as left out by Obsidian's own PDF export. The print stylesheet
 * sets its own text size.
 */
const SKIPPED_VARIABLES = new Set(['--zoom-factor', '--keyboard-height', '--font-text-size']);
const SKIPPED_CLASSES = new Set(['theme-dark', 'theme-light', 'is-frameless', 'is-focused', 'is-fullscreen']);

/** Obsidian's theme and CSS snippet style elements (not public API). */
interface CustomCss {
	styleEl?: HTMLStyleElement;
	extraStyleEls?: HTMLStyleElement[];
}

/**
 * Copies the app's stylesheets so the PDF looks like Reading view. Font URLs
 * are made absolute so the print view can load Obsidian's bundled fonts.
 *
 * Plugin styles are always included, since plugins style the content they
 * render. The community theme and CSS snippets are only included when
 * `useTheme` is on.
 */
export class StyleCollector {
	constructor(
		private readonly app: App,
		private readonly useTheme: boolean,
	) {}

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

	/**
	 * Variables set on the main window's body, such as the user's font
	 * choices and values set by plugins, to apply to the print document.
	 */
	bodyVariables(): Record<string, string> {
		const body = activeDocument.body;
		const vars: Record<string, string> = {};
		for (const name of Array.from(body.style)) {
			if (name.startsWith('--') && !SKIPPED_VARIABLES.has(name)) vars[name] = body.style.getPropertyValue(name);
		}
		const computed = getComputedStyle(body);
		for (const name of FONT_VARIABLES) {
			const value = computed.getPropertyValue(name).trim();
			if (value) vars[name] = value;
		}
		return vars;
	}

	/** Classes on the main window's body. Plugins and themes scope their styles with them. */
	bodyClasses(): string[] {
		return Array.from(activeDocument.body.classList).filter((name) => !SKIPPED_CLASSES.has(name));
	}

	private isWanted(sheet: CSSStyleSheet, includeMath: boolean): boolean {
		const owner = sheet.ownerNode;
		if (!(owner instanceof HTMLStyleElement)) return true;
		if (owner.id.startsWith('MJX-')) return includeMath;
		// CodeMirror's editor styles, which Obsidian's own PDF export also leaves out.
		if (owner.textContent?.includes('ͼ1')) return false;
		return this.useTheme || !this.isThemeOrSnippet(owner);
	}

	private isThemeOrSnippet(el: HTMLStyleElement): boolean {
		const customCss = (this.app as unknown as { customCss?: CustomCss }).customCss;
		return el === customCss?.styleEl || (customCss?.extraStyleEls?.includes(el) ?? false);
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
