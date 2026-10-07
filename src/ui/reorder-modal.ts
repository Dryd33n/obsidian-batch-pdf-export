import { Modal, Notice, Setting, TFile, TFolder, setIcon, type TAbstractFile } from 'obsidian';
import { collectNotes } from '../export/collect';
import { copySelection, countNotes, orderRank, orderedChildren, sortedOrder, type SortBy } from '../export/note-order';
import { saveSelection } from '../export/saved-selections';
import type BatchPdfExportPlugin from '../main';
import type { NoteSelection } from '../types';

type SortChoice = SortBy | 'custom';

const SORT_OPTIONS: Record<SortChoice, string> = {
	name: 'Name',
	created: 'Date created',
	modified: 'Date modified',
	custom: 'Custom order',
};

interface Dragged {
	item: TAbstractFile;
	parent: TFolder;
}

/**
 * Lets the user leave notes out of an export and, for combined PDFs, change
 * their order. Notes and subfolders move only within their own folder, so the
 * table of contents and bookmarks stay grouped by folder.
 */
export class ReorderModal extends Modal {
	private order: string[];
	private readonly removed: Set<string>;
	private rank = new Map<string, number>();
	private sortChoice: SortChoice;
	private dragged: Dragged | null = null;
	private dropTarget: HTMLElement | null = null;
	/** Button to focus after the list is redrawn, so keyboard users keep their place. */
	private focusAfterRender: { path: string; action: string } | null = null;
	private listEl!: HTMLElement;
	private removedEl!: HTMLElement;
	private countEl!: HTMLElement;
	private doneButtons: HTMLButtonElement[] = [];

	constructor(
		private readonly plugin: BatchPdfExportPlugin,
		private readonly folder: TFolder,
		private readonly includeSubfolders: boolean,
		/** False when each note gets its own PDF, where order doesn't matter. */
		private readonly canReorder: boolean,
		selection: NoteSelection,
		private readonly onDone: (selection: NoteSelection) => void,
	) {
		super(plugin.app);
		this.order = [...selection.order];
		this.removed = new Set(selection.removed);
		this.sortChoice = this.order.length === 0 ? 'name' : 'custom';
		this.setTitle(canReorder ? 'Reorder and remove notes' : 'Remove notes');
	}

	onOpen(): void {
		const { contentEl } = this;
		this.modalEl.addClass('batch-pdf-export-reorder-modal');

		contentEl.createEl('p', {
			cls: 'setting-item-description',
			text: this.canReorder
				? 'Drag notes and folders to reorder them within their folder, or select ✕ to leave one out.'
				: 'Select ✕ to leave a note or folder out of the export.',
		});

		const toolbar = new Setting(contentEl);
		if (this.canReorder) {
			toolbar.setName('Sort by').addDropdown((dropdown) =>
				dropdown
					.addOptions(SORT_OPTIONS)
					.setValue(this.sortChoice)
					.onChange((value) => {
						if (value === 'custom') return;
						this.sortChoice = value as SortBy;
						this.order = value === 'name' ? [] : sortedOrder(this.folder, this.includeSubfolders, value as SortBy);
						this.refresh();
					}),
			);
		}
		toolbar.addButton((button) =>
			button
				.setButtonText('Reset')
				.setTooltip(this.canReorder ? 'Alphabetical order, with every note included' : 'Include every note')
				.onClick(() => {
					this.order = [];
					this.removed.clear();
					this.sortChoice = 'name';
					this.refresh();
				}),
		);

		this.listEl = contentEl.createDiv({ cls: 'batch-pdf-export-reorder-list' });
		this.removedEl = contentEl.createDiv();
		this.countEl = contentEl.createEl('p', { cls: 'batch-pdf-export-count setting-item-description' });

		new Setting(contentEl)
			.addButton((button) => {
				this.doneButtons.push(button.buttonEl);
				button
					.setButtonText('Save for next time')
					.setTooltip('Use this order and these notes whenever you export this folder')
					.onClick(() => void this.finish(true));
			})
			.addButton((button) => button.setButtonText('Cancel').onClick(() => this.close()))
			.addButton((button) => {
				this.doneButtons.push(button.buttonEl);
				button
					.setButtonText('Done')
					.setCta()
					.onClick(() => void this.finish(false));
			});

		this.refresh();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	/** Not named `selection`: Obsidian's Modal uses that property internally. */
	private get noteSelection(): NoteSelection {
		return { order: this.order, removed: [...this.removed] };
	}

	private async finish(save: boolean): Promise<void> {
		const selection = copySelection(this.noteSelection);
		if (save) {
			await saveSelection(this.plugin, this.folder, selection);
			new Notice('Saved for the next time you export this folder.');
		}
		this.onDone(selection);
		this.close();
	}

	private refresh(): void {
		this.rank = orderRank(this.order);
		const select = this.contentEl.querySelector('select');
		if (select) select.value = this.sortChoice;

		this.listEl.empty();
		this.renderItems(this.listEl, this.folder, 0);
		this.renderRemoved();

		const total = collectNotes(this.folder, this.includeSubfolders).length;
		const included = collectNotes(this.folder, this.includeSubfolders, this.noteSelection).length;
		this.countEl.setText(
			included === 0 ? 'Every note is removed. Restore at least one to export.' : `${included} of ${total} notes included.`,
		);
		for (const button of this.doneButtons) button.disabled = included === 0;

		this.restoreFocus();
	}

	private renderItems(parentEl: HTMLElement, folder: TFolder, depth: number): void {
		const items = orderedChildren(folder, this.includeSubfolders, this.rank).filter((item) => !this.removed.has(item.path));
		items.forEach((item, index) => {
			const itemEl = parentEl.createDiv({ cls: 'batch-pdf-export-reorder-item' });
			itemEl.dataset.path = item.path;
			const row = itemEl.createDiv({ cls: 'batch-pdf-export-reorder-row' });
			row.setCssProps({ '--bpe-depth': String(depth) });

			if (this.canReorder) setIcon(row.createSpan({ cls: 'batch-pdf-export-reorder-grip' }), 'grip-vertical');
			renderName(row, item, false);

			const actions = row.createDiv({ cls: 'batch-pdf-export-reorder-actions' });
			if (this.canReorder) {
				this.actionButton(actions, item, 'up', 'arrow-up', 'Move up', index === 0, () =>
					this.move(item, folder, items[index - 1]!, false),
				);
				this.actionButton(actions, item, 'down', 'arrow-down', 'Move down', index === items.length - 1, () =>
					this.move(item, folder, items[index + 1]!, true),
				);
			}
			this.actionButton(actions, item, 'remove', 'x', 'Remove', false, () => {
				this.removed.add(item.path);
				// Keep keyboard focus nearby: on the next item's remove button, else the previous one's.
				const neighbour = items[index + 1] ?? items[index - 1];
				this.focusAfterRender = neighbour ? { path: neighbour.path, action: 'remove' } : null;
				this.refresh();
			});

			if (this.canReorder) this.makeDraggable(itemEl, row, item, folder);
			if (item instanceof TFolder) this.renderItems(itemEl.createDiv(), item, depth + 1);
		});
	}

	private actionButton(
		container: HTMLElement,
		item: TAbstractFile,
		action: string,
		icon: string,
		label: string,
		disabled: boolean,
		onClick: () => void,
	): void {
		const button = container.createEl('button', { cls: 'clickable-icon', attr: { 'aria-label': label } });
		button.dataset.action = action;
		setIcon(button, icon);
		button.disabled = disabled;
		button.addEventListener('click', () => {
			this.focusAfterRender = { path: item.path, action };
			onClick();
		});
	}

	/** Moves `item` before or after `target`, a sibling in the same folder. */
	private move(item: TAbstractFile, parent: TFolder, target: TAbstractFile, after: boolean): void {
		// Every sibling, including removed ones, so a restored item returns to its place.
		const siblings = orderedChildren(parent, this.includeSubfolders, this.rank).filter((sibling) => sibling !== item);
		const index = siblings.indexOf(target);
		if (index < 0) return;
		siblings.splice(after ? index + 1 : index, 0, item);
		const paths = siblings.map((sibling) => sibling.path);
		const moved = new Set(paths);
		this.order = this.order.filter((path) => !moved.has(path)).concat(paths);
		this.sortChoice = 'custom';
		this.refresh();
	}

	private makeDraggable(itemEl: HTMLElement, row: HTMLElement, item: TAbstractFile, parent: TFolder): void {
		itemEl.draggable = true;

		itemEl.addEventListener('dragstart', (event) => {
			// Nested items sit inside their folder's element; only the innermost one is dragged.
			event.stopPropagation();
			this.dragged = { item, parent };
			event.dataTransfer?.setData('text/plain', item.path);
			if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
			itemEl.addClass('is-dragging');
		});

		itemEl.addEventListener('dragend', () => {
			itemEl.removeClass('is-dragging');
			this.clearDropTarget();
			this.dragged = null;
		});

		// Events from other folders' items bubble up here, so a sibling folder
		// is a drop target wherever its contents are hovered.
		itemEl.addEventListener('dragover', (event) => {
			const dragged = this.dragged;
			if (!dragged || dragged.parent !== parent) return;
			event.preventDefault();
			event.stopPropagation();
			if (dragged.item === item) {
				this.clearDropTarget();
				return;
			}
			const after = this.isAfter(event, row);
			this.clearDropTarget();
			this.dropTarget = itemEl;
			itemEl.addClass(after ? 'is-drop-after' : 'is-drop-before');
		});

		itemEl.addEventListener('drop', (event) => {
			const dragged = this.dragged;
			if (!dragged || dragged.parent !== parent) return;
			event.preventDefault();
			event.stopPropagation();
			this.clearDropTarget();
			if (dragged.item !== item) this.move(dragged.item, parent, item, this.isAfter(event, row));
		});
	}

	/** Below the middle of the item's own row (for a folder, anywhere in its contents). */
	private isAfter(event: DragEvent, row: HTMLElement): boolean {
		const rect = row.getBoundingClientRect();
		return event.clientY > rect.top + rect.height / 2;
	}

	private clearDropTarget(): void {
		this.dropTarget?.removeClasses(['is-drop-before', 'is-drop-after']);
		this.dropTarget = null;
	}

	/** Removed notes and folders, each with a Restore button. Items inside a removed folder are not listed separately. */
	private renderRemoved(): void {
		this.removedEl.empty();
		const removed: TAbstractFile[] = [];
		const walk = (folder: TFolder) => {
			for (const item of orderedChildren(folder, this.includeSubfolders, this.rank)) {
				if (this.removed.has(item.path)) removed.push(item);
				else if (item instanceof TFolder) walk(item);
			}
		};
		walk(this.folder);
		if (removed.length === 0) return;

		const details = this.removedEl.createEl('details', { cls: 'batch-pdf-export-removed' });
		details.open = true;
		details.createEl('summary', { text: `Removed (${removed.length})` });
		for (const item of removed) {
			const row = details.createDiv({ cls: 'batch-pdf-export-reorder-row' });
			renderName(row, item, true);
			row.createEl('button', { text: 'Restore' }).addEventListener('click', () => {
				this.removed.delete(item.path);
				this.refresh();
			});
		}
	}

	private restoreFocus(): void {
		const target = this.focusAfterRender;
		this.focusAfterRender = null;
		if (!target) return;
		const itemEl = Array.from(this.listEl.querySelectorAll<HTMLElement>('.batch-pdf-export-reorder-item')).find(
			(el) => el.dataset.path === target.path,
		);
		const buttons = Array.from(itemEl?.querySelectorAll<HTMLButtonElement>(':scope > .batch-pdf-export-reorder-row button') ?? []);
		// Prefer the same button; if it is now disabled (moved to the end), the other arrow.
		const preferred = buttons.find((button) => button.dataset.action === target.action && !button.disabled);
		(preferred ?? buttons.find((button) => !button.disabled))?.focus();
	}
}

/** A note's name, or a folder icon and name, with its note count if `withCount`. */
function renderName(row: HTMLElement, item: TAbstractFile, withCount: boolean): void {
	let text = item instanceof TFile ? item.basename : item.name;
	if (item instanceof TFolder) {
		setIcon(row.createSpan({ cls: 'batch-pdf-export-reorder-icon' }), 'folder');
		if (withCount) {
			const count = countNotes(item);
			text += ` (${count} ${count === 1 ? 'note' : 'notes'})`;
		}
	}
	row.createSpan({ cls: 'batch-pdf-export-reorder-name', text });
}
