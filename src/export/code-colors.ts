import type { CodeColors, StyleOptions } from '../settings';

/** Which kinds of code are printed with the dark colour scheme. */
export interface DarkCode {
	inline: boolean;
	blocks: boolean;
}

export function darkCodeFor(style: StyleOptions): DarkCode {
	return { inline: isDark(style.inlineCodeColors), blocks: isDark(style.codeBlockColors) };
}

function isDark(setting: CodeColors): boolean {
	if (setting === 'app') return activeDocument.body.hasClass('theme-dark');
	return setting === 'dark';
}

const BLOCK_SELECTOR = '.markdown-preview-view pre';
const INLINE_SELECTOR = '.markdown-preview-view code:not(pre code)';

/**
 * Runs inside the print view. The page itself is always printed light, so
 * code is given the dark scheme on its own.
 *
 * Adding `theme-dark` to the code elements is not enough: Obsidian and
 * themes declare variables such as `--code-background` on `body`, where they
 * are resolved against the light colours before code inherits them. Instead,
 * the body is briefly switched to dark and every custom property it resolves
 * is copied into a rule that applies only to code. Chromium 114 does not
 * list custom properties in computed styles, so their names are collected
 * from the stylesheets.
 *
 * The page's body classes must be set before this runs, since plugins scope
 * their variables with them.
 *
 * `refresh` recomputes the copied variables, which is needed after the
 * stylesheets change. Returns an empty script when no code is dark.
 */
export function darkCodeScript(dark: DarkCode, refresh: boolean): string {
	const selectors = [...(dark.blocks ? [BLOCK_SELECTOR] : []), ...(dark.inline ? [INLINE_SELECTOR] : [])];
	if (selectors.length === 0) return '';
	return `(() => {
		let style = document.getElementById('bpe-dark-code');
		if (!style || ${refresh}) {
			const names = new Set();
			const walk = (rules) => {
				for (const rule of rules) {
					if (rule.style) for (const name of rule.style) if (name.startsWith('--')) names.add(name);
					if (rule.cssRules) walk(rule.cssRules);
				}
			};
			for (const sheet of document.styleSheets) {
				if (sheet.ownerNode.id !== 'bpe-dark-code') walk(sheet.cssRules);
			}
			const body = document.body;
			body.classList.replace('theme-light', 'theme-dark');
			const computed = getComputedStyle(body);
			const declarations = [];
			for (const name of names) {
				const value = computed.getPropertyValue(name);
				if (value.trim()) declarations.push(name + ':' + value);
			}
			body.classList.replace('theme-dark', 'theme-light');
			if (!style) {
				style = document.createElement('style');
				style.id = 'bpe-dark-code';
				document.head.append(style);
			}
			// Text that plugins add around the code, such as titles and line
			// numbers, inherits its colour, as it would from a dark body.
			style.textContent = '.bpe-dark-code{' + declarations.join(';') + ';color:var(--text-normal)}';
		}
		for (const el of document.querySelectorAll(${JSON.stringify(selectors.join(', '))})) {
			el.classList.add('theme-dark', 'bpe-dark-code');
		}
	})();`;
}
