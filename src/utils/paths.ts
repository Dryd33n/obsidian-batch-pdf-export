import * as path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';

/** Characters not allowed in file names on Windows, macOS or Linux. */
// eslint-disable-next-line no-control-regex -- control characters are invalid in file names
const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;

/** Makes a string safe to use as a file or folder name on any platform. */
export function sanitizeFileName(name: string): string {
	const cleaned = name
		.replace(INVALID_FILENAME_CHARS, '_')
		.replace(/[. ]+$/, '')
		.trim();
	return cleaned || 'untitled';
}

/** Returns `candidate`, or `candidate (2)`, `(3)`… if it was already taken. */
export function uniqueName(candidate: string, taken: Set<string>): string {
	let name = candidate;
	for (let i = 2; taken.has(name.toLowerCase()); i++) name = `${candidate} (${i})`;
	taken.add(name.toLowerCase());
	return name;
}

export function ensureExtension(filePath: string, ext: string): string {
	return filePath.toLowerCase().endsWith(ext) ? filePath : filePath + ext;
}

export function toFileUrl(absolutePath: string): string {
	return pathToFileURL(absolutePath).href;
}

export function fromFileUrl(url: string): string | null {
	try {
		return fileURLToPath(url);
	} catch {
		return null;
	}
}

/** Relative path from one file to another, with forward slashes. */
export function relativeFilePath(fromFile: string, toFile: string): string {
	return path.relative(path.dirname(fromFile), toFile).split(path.sep).join('/');
}

/** Natural, case-insensitive comparison so that "2" sorts before "10". */
export function naturalCompare(a: string, b: string): number {
	return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}
