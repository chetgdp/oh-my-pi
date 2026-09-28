import type { ImageContent, TextContent } from "@oh-my-pi/pi-wire";
import type { ReactNode } from "react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Markdown } from "../Markdown";

function MsgContent({ content }: { content: string | readonly (TextContent | ImageContent)[] }): ReactNode {
	if (typeof content === "string") return <Markdown text={content} magicWords />;
	const parts: ReactNode[] = [];
	for (let i = 0; i < content.length; i++) {
		const block = content[i];
		if (block.type === "text") {
			parts.push(<Markdown key={i} text={block.text} magicWords />);
		} else if (block.type === "image") {
			const src =
				"data" in block && typeof block.data === "string"
					? `data:${(block as { mimeType?: string }).mimeType ?? "image/png"};base64,${block.data}`
					: undefined;
			if (src) parts.push(<img key={i} className="tr-msg-img" src={src} alt="" />);
		}
	}
	return <>{parts}</>;
}

export const UserRow = memo(function UserRow({
	content,
	timestamp,
	pending,
	entryId,
	reaction,
	onRewind,
	canRewind = true,
}: {
	content: string | readonly (TextContent | ImageContent)[];
	timestamp: string;
	pending?: boolean;
	entryId?: string;
	reaction?: string;
	onRewind?: (entryId: string) => void;
	canRewind?: boolean;
}): ReactNode {
	const [armed, setArmed] = useState(false);
	const timerRef = useRef<Timer | number | null>(null);
	useEffect(() => {
		if (armed) {
			timerRef.current = setTimeout(() => setArmed(false), 4000);
		}
		return () => {
			clearTimeout(timerRef.current ?? undefined);
		};
	}, [armed]);

	const handleRewind = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			if (!canRewind || !entryId || !onRewind) return;
			if (!armed) {
				setArmed(true);
				return;
			}
			clearTimeout(timerRef.current ?? undefined);
			timerRef.current = null;
			setArmed(false);
			onRewind(entryId);
		},
		[armed, canRewind, entryId, onRewind],
	);

	return (
		<div className={pending ? "tr-row tr-row--user tr-row--pending" : "tr-row tr-row--user"} title={timestamp}>
			<div className="tr-user-wrapper">
				<div className="tr-body">
					<MsgContent content={content} />
					{!pending && reaction && (
						<span className="tr-reaction" role="img" aria-label={`Agent reacted ${reaction}`}>
							{reaction}
						</span>
					)}
				</div>
				{!pending && entryId && onRewind && (
					<div className="tr-user-actions">
						<button
							type="button"
							className={`tr-rewind-btn${armed ? " tr-rewind-btn--armed" : ""}`}
							onClick={handleRewind}
							disabled={!canRewind}
							aria-label={armed ? "Confirm rewind to this message" : "Rewind to this message"}
							title={armed ? "Tap again to confirm rewind" : "Rewind to this message"}
						>
							<RotateCcw size={12} />
							<span>{armed ? "Confirm rewind?" : "Rewind"}</span>
						</button>
					</div>
				)}
			</div>
		</div>
	);
});
