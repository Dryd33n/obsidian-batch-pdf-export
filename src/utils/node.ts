/**
 * Typed access to the Node.js built-ins the plugin uses on desktop. Loading
 * them through `window.require` with explicit interfaces keeps the code
 * type-safe without depending on `@types/node`.
 */

export interface NodePath {
	sep: string;
	join(...segments: string[]): string;
	dirname(path: string): string;
	relative(from: string, to: string): string;
}

export interface NodeFs {
	promises: {
		stat(path: string): Promise<{ isDirectory(): boolean }>;
		readdir(path: string): Promise<string[]>;
		mkdir(path: string, options: { recursive: boolean }): Promise<unknown>;
		writeFile(path: string, data: Uint8Array): Promise<void>;
	};
}

export interface NodeUrl {
	pathToFileURL(path: string): { href: string };
	fileURLToPath(url: string): string;
}

type RequireFn = (id: string) => unknown;

/** Loads a module provided by Obsidian's desktop runtime (Node built-ins or Electron). */
export function desktopRequire<T>(id: string): T {
	const req = (window as unknown as { require?: RequireFn }).require;
	if (!req) throw new Error(`"${id}" is only available on desktop.`);
	return req(id) as T;
}

export const nodePath = (): NodePath => desktopRequire<NodePath>('path');
export const nodeFs = (): NodeFs => desktopRequire<NodeFs>('fs');
export const nodeUrl = (): NodeUrl => desktopRequire<NodeUrl>('url');
