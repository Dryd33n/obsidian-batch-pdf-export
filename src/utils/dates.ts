import { moment as obsidianMoment } from 'obsidian';

/** The parts of moment.js the plugin uses. */
interface DateValue {
	isValid(): boolean;
	format(format: string): string;
}

interface MomentFn {
	(input: number): DateValue;
	(input: string, formats: unknown[], strict: boolean): DateValue;
	ISO_8601: unknown;
}

/**
 * Obsidian's bundled moment.js, typed locally so the code stays type-safe
 * even where moment's own type definitions are unavailable.
 */
const moment = obsidianMoment as unknown as MomentFn;

const DATE_FORMATS = [moment.ISO_8601, 'YYYY-MM-DD', 'YYYY/MM/DD', 'DD.MM.YYYY', 'D MMMM YYYY', 'MMMM D, YYYY'];

/** Formats a timestamp with a moment.js format string. */
export function formatDate(timestamp: number, format: string): string {
	return moment(timestamp).format(format);
}

/** Parses a frontmatter date value strictly. Returns null if it isn't a recognisable date. */
export function parseDate(value: unknown): DateValue | null {
	if (Array.isArray(value)) return parseDate(value[0]);
	let date: DateValue;
	if (typeof value === 'number') date = moment(value);
	else if (typeof value === 'string') date = moment(value.trim(), DATE_FORMATS, true);
	else return null;
	return date.isValid() ? date : null;
}
