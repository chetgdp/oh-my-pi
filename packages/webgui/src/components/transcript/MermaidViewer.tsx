import type { PanzoomObject } from "@panzoom/panzoom";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { browserDocument, browserWindow } from "../../lib/dom";

/** Full-screen view of one rendered diagram: pinch or wheel to zoom, drag to pan. */
export function MermaidViewer({ svg, onClose }: { svg: string; onClose: () => void }): ReactNode {
	const viewportRef = useRef<HTMLDivElement>(null);
	const stageRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const stage = stageRef.current;
		const viewport = viewportRef.current;
		if (!stage || !viewport) return;
		let pz: PanzoomObject | null = null;
		let cancelled = false;
		// React registers wheel as passive, and panzoom must preventDefault to stop page scroll.
		const onWheel = (e: unknown) => {
			// Only wheel events reach this listener.
			const wheel = e as WheelEvent;
			pz?.zoomWithWheel(wheel);
		};
		// panzoom only matters once a diagram is opened; keep it out of the entry chunk.
		void import("@panzoom/panzoom").then(({ default: Panzoom }) => {
			if (cancelled) return;
			pz = Panzoom(stage, { maxScale: 8, minScale: 0.5, canvas: true });
			viewport.addEventListener("wheel", onWheel, { passive: false });
		});
		const onKey = (e: unknown) => {
			if (e !== null && typeof e === "object" && "key" in e && e.key === "Escape") onClose();
		};
		browserWindow.addEventListener("keydown", onKey);
		return () => {
			cancelled = true;
			viewport.removeEventListener("wheel", onWheel);
			browserWindow.removeEventListener("keydown", onKey);
			pz?.destroy();
		};
	}, [onClose]);

	return createPortal(
		<div className="mmv-overlay" role="dialog" aria-label="Diagram">
			<button type="button" className="mmv-close" aria-label="Close diagram" onClick={onClose}>
				<X size={22} />
			</button>
			<div className="mmv-viewport" ref={viewportRef}>
				<div className="mmv-stage" ref={stageRef} dangerouslySetInnerHTML={{ __html: svg }} />
			</div>
		</div>,
		browserDocument.body,
	);
}
