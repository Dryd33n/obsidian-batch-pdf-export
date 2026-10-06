import type { ExportMode } from '../types';
import { getDocumentsPath, showSaveDialog } from '../utils/electron';
import { nodeFs, nodePath } from '../utils/node';
import { ensureExtension, sanitizeFileName } from '../utils/paths';

/**
 * Asks where to save the export. In `single` mode this picks the PDF file; in
 * `separate` mode the chosen name becomes a new folder for the PDFs.
 * Resolves to null if the dialog is cancelled.
 */
export async function chooseOutputPath(mode: ExportMode, name: string, lastDirectory: string): Promise<string | null> {
	const path = nodePath();
	const directory = lastDirectory || getDocumentsPath();
	const baseName = sanitizeFileName(name);

	if (mode === 'single') {
		const chosen = await showSaveDialog({
			title: 'Export folder as one PDF',
			defaultPath: path.join(directory, `${baseName}.pdf`),
			filters: [{ name: 'PDF', extensions: ['pdf'] }],
			properties: ['showOverwriteConfirmation', 'createDirectory'],
		});
		return chosen ? ensureExtension(chosen, '.pdf') : null;
	}

	return await showSaveDialog({
		title: 'Name the folder for the PDFs',
		defaultPath: path.join(directory, baseName),
		buttonLabel: 'Create folder',
		properties: ['createDirectory'],
	});
}

/** What currently exists at a path. */
export async function pathState(target: string): Promise<'missing' | 'file' | 'empty-folder' | 'folder'> {
	const fs = nodeFs().promises;
	try {
		const stat = await fs.stat(target);
		if (!stat.isDirectory()) return 'file';
		return (await fs.readdir(target)).length === 0 ? 'empty-folder' : 'folder';
	} catch {
		return 'missing';
	}
}

export async function writePdf(target: string, data: Uint8Array): Promise<void> {
	const fs = nodeFs().promises;
	await fs.mkdir(nodePath().dirname(target), { recursive: true });
	await fs.writeFile(target, data);
}
