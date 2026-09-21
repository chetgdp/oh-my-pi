import type { ImageContent, TextContent } from "@oh-my-pi/pi-wire";
import type { ReactNode } from "react";
import { memo } from "react";
import { Markdown } from "../Markdown";

function MsgContent({ content }: { content: string | readonly (TextContent | ImageContent)[] }): ReactNode {
	if (typeof content === "string") return <Markdown text={content} />;
	const parts: ReactNode[] = [];
	for (let i = 0; i < content.length; i++) {
		const block = content[i];
		if (block.type === "text") {
			parts.push(<Markdown key={i} text={block.text} />);
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
}: {
	content: string | readonly (TextContent | ImageContent)[];
	timestamp: string;
	pending?: boolean;
}): ReactNode {
	return (
		<div className={pending ? "tr-row tr-row--user tr-row--pending" : "tr-row tr-row--user"} title={timestamp}>
			<div className="tr-body">
				<MsgContent content={content} />
			</div>
		</div>
	);
});
