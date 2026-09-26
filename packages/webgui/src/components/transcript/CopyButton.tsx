import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { browserWindow } from "../../lib/dom";

export interface CopyButtonProps {
	text: string | (() => string);
	className?: string;
	title?: string;
}

export function CopyButton({ text, className, title = "Copy" }: CopyButtonProps): ReactNode {
	const [copied, setCopied] = useState(false);
	const timerRef = useRef<number | null>(null);

	useEffect(() => {
		return () => {
			if (timerRef.current !== null) {
				clearTimeout(timerRef.current);
			}
		};
	}, []);

	const handleCopy = useCallback(
		(e: React.MouseEvent<HTMLButtonElement>) => {
			e.stopPropagation();
			const payload = typeof text === "function" ? text() : text;
			const clipboard = browserWindow.navigator?.clipboard;
			if (!clipboard?.writeText) return;

			clipboard
				.writeText(payload)
				.then(() => {
					setCopied(true);
					if (timerRef.current !== null) {
						clearTimeout(timerRef.current);
					}
					timerRef.current = setTimeout(() => {
						setCopied(false);
						timerRef.current = null;
					}, 1500) as unknown as number;
				})
				.catch(() => {});
		},
		[text],
	);

	const baseClass = "tr-copy-btn";
	const fullClass = className ? `${baseClass} ${className}` : baseClass;

	return (
		<button
			type="button"
			className={fullClass}
			onClick={handleCopy}
			aria-label={copied ? "Copied" : title}
			title={copied ? "Copied" : title}
		>
			{copied ? (
				<>
					<Check size={13} className="tr-copy-icon" aria-hidden="true" />
					<span className="tr-copy-label">Copied</span>
				</>
			) : (
				<>
					<Copy size={13} className="tr-copy-icon" aria-hidden="true" />
					<span className="tr-copy-label">Copy</span>
				</>
			)}
		</button>
	);
}
