// webgui type-checks without the DOM lib (see lib/dom.ts); these are the
// slices of the DOM the patcher touches.
interface BlockNode {
	readonly parentNode: { removeChild(node: BlockNode): unknown } | null;
}

interface BlockFragment {
	readonly childNodes: ArrayLike<BlockNode>;
}

interface BlockTemplate {
	innerHTML: string;
	readonly content: BlockFragment;
}

export interface BlockContainer {
	readonly ownerDocument: { createElement(tagName: "template"): BlockTemplate };
	replaceChildren(): void;
	append(fragment: BlockFragment): void;
}

/** One top-level Markdown block as mounted in the container. */
export interface MountedBlock {
	html: string;
	nodes: BlockNode[];
}

/**
 * Brings `container` from `prev` to `next` blocks. Blocks before the first
 * changed one keep their DOM nodes (and any state on them, like a copied fence
 * button); everything from it on is replaced. While a reply streams only the
 * last block changes, so each delta parses one block instead of the whole text.
 *
 * `prev === null` means the container holds markup not split into blocks (the
 * first render), so every block is mounted fresh.
 */
export function patchBlocks(
	container: BlockContainer,
	prev: MountedBlock[] | null,
	next: readonly string[],
): MountedBlock[] {
	let keep = 0;
	if (prev === null) {
		container.replaceChildren();
	} else {
		const limit = Math.min(prev.length, next.length);
		while (keep < limit && prev[keep]!.html === next[keep]) keep++;
		for (let i = keep; i < prev.length; i++) {
			for (const node of prev[i]!.nodes) node.parentNode?.removeChild(node);
		}
	}
	const mounted = prev === null ? [] : prev.slice(0, keep);
	const template = container.ownerDocument.createElement("template");
	for (let i = keep; i < next.length; i++) {
		const html = next[i]!;
		template.innerHTML = html;
		const nodes = Array.from(template.content.childNodes);
		container.append(template.content);
		mounted.push({ html, nodes });
	}
	return mounted;
}
