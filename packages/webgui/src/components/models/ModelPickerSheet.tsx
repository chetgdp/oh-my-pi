import { useState, useRef, useEffect } from "react";
import type { ReactNode } from "react";
import { ThinkingLevel } from "@oh-my-pi/pi-agent-core/thinking";

export interface PickerModel {
	id: string;
	name: string;
	provider: { id: string; name: string };
}

export type PickerMode =
	| { kind: "active" }
	| { kind: "role"; role: string }
	| { kind: "agent"; agent: string; hasOverride: boolean };

export interface ModelPickerSheetProps {
	open: boolean;
	title: string;
	models: readonly PickerModel[];
	eligible?: string[];
	current?: { provider: string; id: string; thinkingLevel?: ThinkingLevel };
	allowThinking: boolean;
	mode: PickerMode;
	onPick(selection: { provider: string; id: string; thinkingLevel?: ThinkingLevel; persist?: boolean }): void;
	onClear?(): void;
	onClose(): void;
}

const LEVELS: readonly ThinkingLevel[] = [
	ThinkingLevel.Off,
	ThinkingLevel.Minimal,
	ThinkingLevel.Low,
	ThinkingLevel.Medium,
	ThinkingLevel.High,
	ThinkingLevel.XHigh,
	ThinkingLevel.Max,
];

interface ProviderGroup {
	provider: { id: string; name: string };
	models: readonly PickerModel[];
}

function groupByProvider(models: readonly PickerModel[]): ProviderGroup[] {
	const map = new Map<string, { provider: { id: string; name: string }; models: PickerModel[] }>();
	for (const m of models) {
		let g = map.get(m.provider.id);
		if (!g) {
			g = { provider: m.provider, models: [] };
			map.set(m.provider.id, g);
		}
		g.models.push(m);
	}
	return Array.from(map.values());
}

export function ModelPickerSheet({
	open,
	title,
	models,
	eligible,
	current,
	allowThinking,
	mode,
	onPick,
	onClear,
	onClose,
}: ModelPickerSheetProps): ReactNode {
	const [search, setSearch] = useState("");
	const [selectedModel, setSelectedModel] = useState<PickerModel | null>(null);
	const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel | undefined>(undefined);
	const [persist, setPersist] = useState(false);
	const dialogRef = useRef<HTMLDivElement>(null);

	// Reset state on open
	useEffect(() => {
		if (open) {
			setSearch("");
			setSelectedModel(null);
			setThinkingLevel(current?.thinkingLevel);
			setPersist(false);
		}
	}, [open]);

	// Close on Escape
	useEffect(() => {
		if (!open) return;
		function handleKey(e: KeyboardEvent): void {
			if (e.key === "Escape") {
				e.preventDefault();
				onClose();
			}
		}
		const win = globalThis as unknown as {
			addEventListener(t: string, fn: (e: KeyboardEvent) => void): void;
			removeEventListener(t: string, fn: (e: KeyboardEvent) => void): void;
		};
		win.addEventListener("keydown", handleKey);
		return () => win.removeEventListener("keydown", handleKey);
	}, [open, onClose]);

	if (!open) return null;

	// Filter by eligibility then by search
	let visible = eligible ? models.filter(m => eligible.includes(`${m.provider.id}/${m.id}`)) : Array.from(models);

	const query = search.toLowerCase();
	if (query) {
		visible = visible.filter(
			m =>
				m.name.toLowerCase().includes(query) ||
				m.id.toLowerCase().includes(query) ||
				m.provider.name.toLowerCase().includes(query),
		);
	}

	const groups = groupByProvider(visible);
	const chosen =
		selectedModel ??
		(current ? models.find(m => m.provider.id === current.provider && m.id === current.id) : undefined);

	function handleConfirm(): void {
		if (!chosen) return;
		onPick({
			provider: chosen.provider.id,
			id: chosen.id,
			thinkingLevel: allowThinking ? thinkingLevel : undefined,
			persist: mode.kind === "active" ? persist : undefined,
		});
		onClose();
	}

	return (
		<>
			<div className="mps-backdrop" onClick={onClose} />
			<div className="mps-sheet" role="dialog" aria-label={title} ref={dialogRef}>
				<div className="mps-header">
					<span className="mps-title">{title}</span>
				</div>

				<input
					type="text"
					className="mps-search"
					placeholder="Search models..."
					value={search}
					onChange={e => setSearch((e.target as HTMLInputElement).value)}
					autoFocus
				/>

				<div className="mps-list">
					{groups.length === 0 && <div className="mps-empty">No models found</div>}
					{groups.map(g => (
						<div key={g.provider.id}>
							<div className="mps-group-label">{g.provider.name}</div>
							{g.models.map(m => {
								const isCurrent = chosen && chosen.provider.id === m.provider.id && chosen.id === m.id;
								return (
									<button
										key={m.id}
										type="button"
										className={"mps-row" + (isCurrent ? " mps-row--selected" : "")}
										onClick={() => setSelectedModel(m)}
									>
										<span className="mps-row-name">{m.name}</span>
										<span className="mps-row-id">{m.id}</span>
										{isCurrent && (
											<span className="mps-check" aria-label="selected">
												✓
											</span>
										)}
									</button>
								);
							})}
						</div>
					))}
				</div>

				{allowThinking && (
					<div className="mps-thinking">
						<span className="mps-thinking-label">Thinking</span>
						<div className="mps-thinking-levels">
							{LEVELS.map(level => (
								<button
									key={level}
									type="button"
									className={"mps-level" + (thinkingLevel === level ? " mps-level--active" : "")}
									onClick={() => setThinkingLevel(level)}
								>
									{level}
								</button>
							))}
						</div>
					</div>
				)}

				{mode.kind === "active" && (
					<div className="mps-persist">
						<button
							type="button"
							className={"mps-persist-btn" + (!persist ? " mps-persist-btn--active" : "")}
							onClick={() => setPersist(false)}
						>
							This session
						</button>
						<button
							type="button"
							className={"mps-persist-btn" + (persist ? " mps-persist-btn--active" : "")}
							onClick={() => setPersist(true)}
						>
							Set as default
						</button>
					</div>
				)}

				<div className="mps-actions">
					{mode.kind === "agent" && mode.hasOverride && onClear && (
						<button
							type="button"
							className="mps-btn mps-btn--clear"
							onClick={() => {
								onClear();
								onClose();
							}}
						>
							Clear override
						</button>
					)}
					{mode.kind === "role" && onClear && (
						<button
							type="button"
							className="mps-btn mps-btn--clear"
							onClick={() => {
								onClear();
								onClose();
							}}
						>
							Reset to default
						</button>
					)}
					<button type="button" className="mps-btn mps-btn--confirm" disabled={!chosen} onClick={handleConfirm}>
						Confirm
					</button>
				</div>
			</div>
		</>
	);
}
