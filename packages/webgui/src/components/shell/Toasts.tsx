import { useSyncExternalStore, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
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
		const delay = notice.kind === "info" ? 4000 : 8000;
		timerRef.current = setTimeout(() => {
			dismissNotice(notice.id);
		}, delay);
		return () => {
			clearTimeout(timerRef.current!);
		};
	}, [notice.id, notice.kind]);

	return (
		<div className={`toast toast-${notice.kind}`}>
			<span>{notice.message}</span>
			<button type="button" className="toast-dismiss" onClick={() => dismissNotice(notice.id)} aria-label="Dismiss">
				<X size={14} />
			</button>
		</div>
	);
}
