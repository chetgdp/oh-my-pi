import { useState, useRef, useEffect } from "react";
import type { ReactNode } from "react";

export interface ComposerModel {
	id: string;
	name: string;
	provider: { id: string; name: string };
}

export interface ModelPickerProps {
	open: boolean;
	models: readonly ComposerModel[];
	current?: ComposerModel;
	onPick(provider: string, modelId: string): void;
	onClose(): void;
}

interface ProviderGroup {
	provider: { id: string; name: string };
	models: readonly ComposerModel[];
}

function groupByProvider(models: readonly ComposerModel[]): ProviderGroup[] {
	const map = new Map<string, { provider: { id: string; name: string }; models: ComposerModel[] }>();
	for (const m of models) {
		let group = map.get(m.provider.id);
		if (!group) {
			group = { provider: m.provider, models: [] };
			map.set(m.provider.id, group);
		}
		group.models.push(m);
	}
	return Array.from(map.values());
}

export function ModelPicker({ open, models, current, onPick, onClose }: ModelPickerProps): ReactNode {
	const [search, setSearch] = useState("");
	const dialogRef = useRef<HTMLDivElement>(null);

	// Reset search on open
	useEffect(() => {
		if (open) setSearch("");
	}, [open]);

	// Focus trap: close on Escape
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

	const query = search.toLowerCase();
	const filtered = query
		? models.filter(m => m.name.toLowerCase().includes(query) || m.provider.name.toLowerCase().includes(query))
		: Array.from(models);
	const groups = groupByProvider(filtered);

	return (
		<>
			<div className="cmp-picker-backdrop" onClick={onClose} />
			<div className="cmp-picker" role="dialog" aria-label="Model picker" ref={dialogRef}>
				<div className="cmp-picker-header">
					<input
						className="cmp-picker-search"
						type="text"
						placeholder="Search models..."
						value={search}
						onChange={e => setSearch(e.target.value)}
						autoFocus
					/>
				</div>
				<div className="cmp-picker-list">
					{groups.map(g => (
						<div key={g.provider.id} className="cmp-picker-group">
							<div className="cmp-picker-group-label">{g.provider.name}</div>
							{g.models.map(m => (
								<button
									key={m.id}
									type="button"
									className={"cmp-picker-row" + (current?.id === m.id ? " cmp-picker-current" : "")}
									onClick={() => {
										onPick(m.provider.id, m.id);
										onClose();
									}}
								>
									{m.name}
									{current?.id === m.id && (
										<span className="cmp-picker-check" aria-label="current">
											&#10003;
										</span>
									)}
								</button>
							))}
						</div>
					))}
					{groups.length === 0 && <div className="cmp-picker-empty">No models match</div>}
				</div>
			</div>
		</>
	);
}
