import type { ReactNode } from "react";
import { memo, useState } from "react";

export const DeveloperRow = memo(function DeveloperRow({
	content,
	timestamp,
}: {
	content: string;
	timestamp: string;
}): ReactNode {
	const [open, setOpen] = useState(false);
	const preview = content.length > 120 ? content.slice(0, 120) + "..." : content;
	return (
		<div className="tr-row tr-row--developer" title={timestamp}>
			<button type="button" className="tr-developer-toggle" aria-expanded={open} onClick={() => setOpen(v => !v)}>
				<span className="tr-developer-label">system</span>
				{!open && <span className="tr-developer-preview">{preview}</span>}
			</button>
			{open && <pre className="tr-developer-body">{content}</pre>}
		</div>
	);
});
