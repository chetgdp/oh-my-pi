import type { ReactNode } from "react";
import { memo, useState } from "react";
import { ChevronRight } from "lucide-react";

export const ThinkingRow = memo(function ThinkingRow({
	text,
	expandAll,
}: {
	text: string;
	expandAll?: boolean;
}): ReactNode {
	const [open, setOpen] = useState(false);
	const expanded = expandAll || open;
	return (
		<div className="tr-thinking">
			<button type="button" className="tr-think-head" aria-expanded={expanded} onClick={() => setOpen(v => !v)}>
				<ChevronRight size={14} className={`tr-chev${expanded ? " tr-chev--open" : ""}`} />
				thinking
			</button>
			{expanded && <div className="tr-think-body">{text}</div>}
		</div>
	);
});
