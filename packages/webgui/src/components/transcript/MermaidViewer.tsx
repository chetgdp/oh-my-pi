import type * as Panzoom from "@panzoom/panzoom";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { browserDocument, browserWindow } from "../../lib/dom";
import { LazyModule } from "../../lib/lazy-module";

// panzoom only matters once a diagram is opened; keep it out of the entry chunk.
const panzoom = new LazyModule<typeof Panzoom>(() => import("@panzoom/panzoom"));

/** Full-screen view of one rendered diagram: pinch or wheel to zoom, drag to pan. */
export function MermaidViewer({ svg, onClose }: { svg: string; onClose: () => void }): ReactNode {
	const viewportRef = useRef<HTMLDivElement>(null);
	const stageRef = useRef<HTMLDivElement>(null);
	const mod = useSyncExternalStore(panzoom.subscribe, panzoom.snapshot, panzoom.snapshot);

	useEffect(() => {
		const stage = stageRef.current;
		const viewport = viewportRef.current;
		if (!stage || !viewport) return;
		if (mod === null) {
			panzoom.request();
			return;
		}
		const pz = mod.default(stage, { maxScale: 8, minScale: 0.5, canvas: true });
		// React registers wheel as passive, and panzoom must preventDefault to stop page scroll.
		const onWheel = (e: unknown) => {
			// Only wheel events reach this listener.
			pz.zoomWithWheel(e as WheelEvent);
		};
		viewport.addEventListener("wheel", onWheel, { passive: false });
		return () => {
			viewport.removeEventListener("wheel", onWheel);
			pz.destroy();
		};
	}, [mod]);

	useEffect(() => {
		const onKey = (e: unknown) => {
			if (e !== null && typeof e === "object" && "key" in e && e.key === "Escape") onClose();
		};
		browserWindow.addEventListener("keydown", onKey);
		return () => {
			browserWindow.removeEventListener("keydown", onKey);
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
