import { App, FuzzySuggestModal, TFolder } from 'obsidian';

/** Lets the user pick any folder in the vault. */
export class FolderSuggestModal extends FuzzySuggestModal<TFolder> {
	constructor(
		app: App,
		private readonly onChoose: (folder: TFolder) => void,
	) {
		super(app);
		this.setPlaceholder('Choose a folder to export to PDF');
	}

	getItems(): TFolder[] {
		return this.app.vault.getAllFolders(true);
	}

	getItemText(folder: TFolder): string {
		return folder.isRoot() ? '/' : folder.path;
	}

	onChooseItem(folder: TFolder): void {
		this.onChoose(folder);
	}
}
