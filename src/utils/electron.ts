import { desktopRequire } from './node';

/**
 * Typed access to the parts of Electron the plugin needs. Obsidian exposes
 * `@electron/remote` as `require('electron').remote` on desktop.
 */

interface FileFilter {
	name: string;
	extensions: string[];
}

export interface SaveDialogOptions {
	title?: string;
	defaultPath?: string;
	buttonLabel?: string;
	filters?: FileFilter[];
	properties?: ('showOverwriteConfirmation' | 'createDirectory' | 'showHiddenFiles')[];
}

interface ElectronRemote {
	dialog: {
		showSaveDialog(
			window: unknown,
			options: SaveDialogOptions,
		): Promise<{ canceled: boolean; filePath?: string }>;
	};
	shell: { showItemInFolder(fullPath: string): void };
	app: { getPath(name: 'documents' | 'home'): string };
	getCurrentWindow(): unknown;
	getCurrentWebContents(): WebContents;
	webContents: { fromId(id: number): WebContents | undefined };
}

interface WebContents {
	getBackgroundThrottling?(): boolean;
	setBackgroundThrottling(allowed: boolean): void;
}

function getRemote(): ElectronRemote {
	const electron = desktopRequire<{ remote?: ElectronRemote }>('electron');
	if (!electron.remote) throw new Error('Electron remote is not available.');
	return electron.remote;
}

/** Shows the system save dialog. Resolves to the chosen path, or null if cancelled. */
export async function showSaveDialog(options: SaveDialogOptions): Promise<string | null> {
	const remote = getRemote();
	const result = await remote.dialog.showSaveDialog(remote.getCurrentWindow(), options);
	return result.canceled || !result.filePath ? null : result.filePath;
}

export function showItemInFolder(fullPath: string): void {
	getRemote().shell.showItemInFolder(fullPath);
}

/**
 * Chromium slows timers to about once a second while a window is hidden or
 * covered, which would make an export crawl if the user switches apps.
 * Turns that off for the given web contents (the Obsidian window by default)
 * and returns a function that restores the previous behaviour.
 */
export function pauseBackgroundThrottling(webContentsId?: number): () => void {
	try {
		const remote = getRemote();
		const contents = webContentsId === undefined ? remote.getCurrentWebContents() : remote.webContents.fromId(webContentsId);
		if (!contents) return () => {};
		const previous = contents.getBackgroundThrottling?.() ?? true;
		contents.setBackgroundThrottling(false);
		return () => contents.setBackgroundThrottling(previous);
	} catch {
		return () => {};
	}
}

export function getDocumentsPath(): string {
	try {
		return getRemote().app.getPath('documents');
	} catch {
		return '';
	}
}
