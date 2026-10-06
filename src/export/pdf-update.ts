import type { PdfDest, PdfRef } from './pdf-inspect';

export interface OutlineNode {
	title: string;
	dest: PdfDest;
	children: OutlineNode[];
	/** Whether the bookmark starts expanded. */
	open: boolean;
}

/** A link annotation to turn into a relative link to another PDF. */
export interface RelativeLink {
	ref: PdfRef;
	rect: number[];
	relativePath: string;
}

export interface PdfUpdate {
	/** Document title shown by PDF viewers. */
	title?: string;
	outline: OutlineNode[];
	links: RelativeLink[];
}

/**
 * Adds a title, bookmarks and relative file links to a PDF printed by Chromium, as a
 * PDF incremental update: new objects are appended after the original bytes,
 * followed by a new cross-reference section, so nothing is re-encoded.
 */
export function updatePdf(data: Uint8Array, { title, outline, links }: PdfUpdate): Uint8Array {
	if (!title && outline.length === 0 && links.length === 0) return data;
	const text = new TextDecoder('latin1').decode(data);

	const startxref = /startxref\s+(\d+)\s+%%EOF\s*$/.exec(text);
	const trailerAt = text.lastIndexOf('trailer');
	if (!startxref || trailerAt < 0) throw new Error('Unsupported PDF structure');
	const trailer = text.slice(trailerAt, startxref.index);
	const size = Number(/\/Size\s+(\d+)/.exec(trailer)?.[1]);
	const root = /\/Root\s+(\d+)\s+(\d+)\s+R/.exec(trailer);
	if (!size || !root) throw new Error('Unsupported PDF trailer');
	const infoRef = /\/Info\s+(\d+)\s+(\d+)\s+R/.exec(trailer);
	const id = /\/ID\s*\[[^\]]*\]/.exec(trailer)?.[0] ?? '';

	const objects = new Map<number, { gen: number; body: string }>();
	let nextNum = size;
	let info = infoRef?.[0] ?? '';

	if (title) {
		const existing = infoRef ? readDictionary(text, Number(infoRef[1]), Number(infoRef[2])) : '';
		const withoutTitle = existing.replace(/\/Title\s*(\((?:\\.|[^\\)])*\)|<[^>]*>)/, '');
		const body = `<<${withoutTitle} /Title ${unicodeString(title)}>>`;
		if (infoRef) {
			objects.set(Number(infoRef[1]), { gen: Number(infoRef[2]), body });
		} else {
			const infoNum = nextNum++;
			objects.set(infoNum, { gen: 0, body });
			info = `/Info ${infoNum} 0 R`;
		}
	}

	if (outline.length > 0) {
		const rootNum = Number(root[1]);
		const rootGen = Number(root[2]);
		const catalog = readDictionary(text, rootNum, rootGen)
			.replace(/\/Outlines\s+\d+\s+\d+\s+R/, '')
			.replace(/\/PageMode\s*\/\w+/, '');
		const outlinesNum = nextNum++;
		objects.set(rootNum, {
			gen: rootGen,
			body: `<<${catalog}\n/Outlines ${outlinesNum} 0 R\n/PageMode /UseOutlines>>`,
		});
		nextNum = writeOutline(outline, outlinesNum, nextNum, objects);
	}

	for (const link of links) {
		objects.set(link.ref.num, {
			gen: link.ref.gen,
			body: `<</Type /Annot /Subtype /Link /F 4 /Border [0 0 0] /Rect [${link.rect.map(num).join(' ')}]` +
				` /A <</S /GoToR /F <</Type /Filespec /F ${asciiString(link.relativePath)} /UF ${unicodeString(link.relativePath)}>>` +
				` /D [0 /Fit] /NewWindow false>>>>`,
		});
	}

	// Append the objects, then a cross-reference section that points to them.
	let appendix = data[data.length - 1] === 0x0a ? '' : '\n';
	const offsets: [number, number, number][] = [];
	for (const [objNum, { gen, body }] of [...objects].sort((a, b) => a[0] - b[0])) {
		offsets.push([objNum, gen, data.length + appendix.length]);
		appendix += `${objNum} ${gen} obj\n${body}\nendobj\n`;
	}
	const xrefOffset = data.length + appendix.length;
	appendix += 'xref\n';
	for (let i = 0; i < offsets.length; ) {
		let j = i;
		while (j + 1 < offsets.length && offsets[j + 1]![0] === offsets[j]![0] + 1) j++;
		appendix += `${offsets[i]![0]} ${j - i + 1}\n`;
		for (let k = i; k <= j; k++) {
			const [, gen, offset] = offsets[k]!;
			appendix += `${String(offset).padStart(10, '0')} ${String(gen).padStart(5, '0')} n\r\n`;
		}
		i = j + 1;
	}
	appendix += `trailer\n<</Size ${Math.max(size, nextNum)} /Root ${root[1]} ${root[2]} R ${info} ${id} /Prev ${startxref[1]}>>\n`;
	appendix += `startxref\n${xrefOffset}\n%%EOF\n`;

	const extra = new TextEncoder().encode(appendix);
	const result = new Uint8Array(data.length + extra.length);
	result.set(data);
	result.set(extra, data.length);
	return result;
}

/** Returns the contents of an object's top-level dictionary, without the `<<` `>>`. */
function readDictionary(text: string, objNum: number, gen: number): string {
	const header = new RegExp(`(^|\\s)${objNum}\\s+${gen}\\s+obj\\b`, 'g');
	let start = -1;
	for (let match; (match = header.exec(text)); ) start = match.index + match[0].length;
	if (start < 0) throw new Error(`Object ${objNum} not found`);
	const end = text.indexOf('endobj', start);
	const body = text.slice(start, end).trim();
	if (!body.startsWith('<<') || !body.endsWith('>>')) throw new Error(`Object ${objNum} is not a dictionary`);
	return body.slice(2, -2);
}

/** Writes the outline tree; returns the next free object number. */
function writeOutline(
	nodes: OutlineNode[],
	outlinesNum: number,
	nextNum: number,
	objects: Map<number, { gen: number; body: string }>,
): number {
	const writeLevel = (level: OutlineNode[], parentNum: number): { first: number; last: number; visible: number } => {
		const nums = level.map(() => nextNum++);
		let visible = 0;
		level.forEach((node, i) => {
			let body = `<</Title ${unicodeString(node.title)} /Parent ${parentNum} 0 R`;
			if (i > 0) body += ` /Prev ${nums[i - 1]} 0 R`;
			if (i < level.length - 1) body += ` /Next ${nums[i + 1]} 0 R`;
			if (node.children.length > 0) {
				const children = writeLevel(node.children, nums[i]!);
				// Open items count their visible descendants; closed ones are negative.
				const count = node.open ? children.visible : -node.children.length;
				body += ` /First ${children.first} 0 R /Last ${children.last} 0 R /Count ${count}`;
				if (node.open) visible += children.visible;
			}
			const { pageRef, x, y } = node.dest;
			body += ` /Dest [${pageRef.num} ${pageRef.gen} R /XYZ ${num(x)} ${num(y)} 0]>>`;
			objects.set(nums[i]!, { gen: 0, body });
			visible++;
		});
		return { first: nums[0]!, last: nums[nums.length - 1]!, visible };
	};

	const top = writeLevel(nodes, outlinesNum);
	objects.set(outlinesNum, {
		gen: 0,
		body: `<</Type /Outlines /First ${top.first} 0 R /Last ${top.last} 0 R /Count ${top.visible}>>`,
	});
	return nextNum;
}

function num(value: number | null | undefined): string {
	return value === null || value === undefined || !Number.isFinite(value) ? 'null' : String(Math.round(value * 1000) / 1000);
}

/** A PDF text string in UTF-16BE, written as hex so any character is safe. */
function unicodeString(value: string): string {
	let hex = 'FEFF';
	for (let i = 0; i < value.length; i++) hex += value.charCodeAt(i).toString(16).padStart(4, '0');
	return `<${hex.toUpperCase()}>`;
}

/** A PDF literal string limited to ASCII, for readers that ignore `/UF`. */
function asciiString(value: string): string {
	const ascii = value.replace(/[^\x20-\x7e]/g, '_').replace(/[\\()]/g, (ch) => `\\${ch}`);
	return `(${ascii})`;
}
