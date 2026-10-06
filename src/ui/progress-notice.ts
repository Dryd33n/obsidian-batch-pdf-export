import { Notice } from 'obsidian';

/** A persistent notice that shows export progress and offers a Cancel button. */
export class ProgressNotice {
	private readonly notice: Notice;
	private readonly textEl: HTMLElement;
	private cancelled = false;

	constructor(message: string) {
		const fragment = createFragment();
		const wrapper = fragment.createDiv({ cls: 'batch-pdf-export-progress' });
		this.textEl = wrapper.createDiv({ text: message });
		const cancel = wrapper.createEl('button', { text: 'Cancel' });
		cancel.addEventListener('click', (event) => {
			event.stopPropagation();
			this.cancelled = true;
			cancel.disabled = true;
			this.textEl.setText('Cancelling after the current note…');
		});
		// Clicking a notice normally dismisses it; keep this one until the export ends.
		wrapper.addEventListener('click', (event) => event.stopPropagation());
		this.notice = new Notice(fragment, 0);
	}

	get isCancelled(): boolean {
		return this.cancelled;
	}

	setText(message: string): void {
		if (!this.cancelled) this.textEl.setText(message);
	}

	hide(): void {
		this.notice.hide();
	}
}
