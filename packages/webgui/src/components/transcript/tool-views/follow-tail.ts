/** Tail-follow for growing scroll panes (job output): pinned while the reader sits at the bottom. */

/** Slack for sub-pixel scroll positions and zoomed layouts. */
const BOTTOM_SLACK_PX = 8;

export interface ScrollBox {
	scrollTop: number;
	scrollHeight: number;
	clientHeight: number;
}

/** True when the pane shows its last line, so new output should keep it pinned there. */
export function isAtBottom(box: ScrollBox): boolean {
	return box.scrollHeight - box.clientHeight - box.scrollTop <= BOTTOM_SLACK_PX;
}

/** Scroll to the newest line when following; returns whether it moved. */
export function followTail(box: ScrollBox, following: boolean): boolean {
	if (!following) return false;
	const bottom = Math.max(0, box.scrollHeight - box.clientHeight);
	if (box.scrollTop === bottom) return false;
	box.scrollTop = bottom;
	return true;
}
