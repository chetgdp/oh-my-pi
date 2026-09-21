import { useSyncExternalStore, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { subscribeNotices, getNotices, dismissNotice } from "../../lib/notify";
import type { Notice } from "../../lib/notify";

export function Toasts(): ReactNode {
	const notices = useSyncExternalStore(subscribeNotices, getNotices);
	return (
		<div className="toast-container">
			{notices.map(n => (
				<Toast key={n.id} notice={n} />
			))}
		</div>
	);
}

function Toast({ notice }: { notice: Notice }): ReactNode {
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (notice.kind !== "info") return;
		timerRef.current = setTimeout(() => {
			dismissNotice(notice.id);
		}, 5000);
		return () => {
			if (timerRef.current !== null) clearTimeout(timerRef.current);
		};
	}, [notice.id, notice.kind]);

	return (
		<div className={`toast toast-${notice.kind}`}>
			<span>{notice.message}</span>
			<button type="button" className="toast-dismiss" onClick={() => dismissNotice(notice.id)} aria-label="Dismiss">
				\u2715
			</button>
		</div>
	);
}
