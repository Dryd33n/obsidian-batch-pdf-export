import { App, Modal, Setting } from 'obsidian';

/** Asks a yes/no question. Resolves to true only if the confirm button is selected. */
export function confirmModal(app: App, title: string, message: string, confirmLabel: string): Promise<boolean> {
	return new Promise((resolve) => new ConfirmModal(app, title, message, confirmLabel, resolve).open());
}

class ConfirmModal extends Modal {
	private confirmed = false;

	constructor(
		app: App,
		title: string,
		private readonly message: string,
		private readonly confirmLabel: string,
		private readonly onResult: (confirmed: boolean) => void,
	) {
		super(app);
		this.setTitle(title);
	}

	onOpen(): void {
		this.contentEl.createEl('p', { text: this.message });
		new Setting(this.contentEl)
			.addButton((button) =>
				button.setButtonText('Cancel').onClick(() => this.close()),
			)
			.addButton((button) =>
				button
					.setButtonText(this.confirmLabel)
					.setCta()
					.onClick(() => {
						this.confirmed = true;
						this.close();
					}),
			);
	}

	onClose(): void {
		this.contentEl.empty();
		this.onResult(this.confirmed);
	}
}
