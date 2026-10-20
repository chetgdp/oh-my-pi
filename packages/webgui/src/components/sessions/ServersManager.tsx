import { useState } from "react";
import type { ReactNode } from "react";
import type { ServerOperator, ServerEntry, ServerStatus } from "../../lib/servers";
import { LOCAL_SERVER_ID } from "../../lib/servers";

/** Add by URL, rename, remove. `local` (this page's origin) is fixed. */
export function ServersManager(props: {
	servers: ServerOperator;
	list: readonly ServerEntry[];
	status: ReadonlyMap<string, ServerStatus>;
}): ReactNode {
	const { servers, list, status } = props;
	const [url, setUrl] = useState("");
	const [name, setName] = useState("");
	const [error, setError] = useState<string | null>(null);

	function submit(): void {
		try {
			servers.add(url, name);
			setUrl("");
			setName("");
			setError(null);
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : String(err));
		}
	}

	return (
		<div className="ses-new-form ses-servers">
			<p className="ses-new-form-title">Servers</p>
			<ul className="ses-servers-list">
				{list.map(s => (
					<li key={s.id} className="ses-servers-item">
						<span
							className={`ses-server-dot ses-server-dot--${status.get(s.id) ?? "loading"}`}
							aria-hidden="true"
						/>
						{s.id === LOCAL_SERVER_ID ? (
							<span className="ses-servers-name">{s.name} (this page)</span>
						) : (
							<>
								<input
									className="ses-cwd-input ses-servers-rename"
									defaultValue={s.name}
									aria-label={`Name for ${s.url}`}
									onBlur={e => servers.rename(s.id, e.currentTarget.value)}
									onKeyDown={e => {
										if (e.key === "Enter") e.currentTarget.blur();
									}}
								/>
								<span className="ses-servers-url">{s.url}</span>
								<button
									type="button"
									className="ses-retry-btn"
									onClick={() => servers.remove(s.id)}
									aria-label={`Remove ${s.name}`}
								>
									Remove
								</button>
							</>
						)}
					</li>
				))}
			</ul>
			<form
				className="ses-servers-add"
				onSubmit={e => {
					e.preventDefault();
					submit();
				}}
			>
				<input
					className="ses-cwd-input"
					placeholder="https://host.tailnet.ts.net"
					value={url}
					onChange={e => setUrl(e.currentTarget.value)}
					aria-label="Server URL"
					autoCapitalize="off"
					autoCorrect="off"
					spellCheck={false}
				/>
				<input
					className="ses-cwd-input"
					placeholder="Name (optional)"
					value={name}
					onChange={e => setName(e.currentTarget.value)}
					aria-label="Server name"
				/>
				<button type="submit" className="ses-retry-btn" disabled={!url.trim()}>
					Add server
				</button>
				{error && <p className="ses-unreachable-reason">{error}</p>}
			</form>
		</div>
	);
}

/** Shown only when more than one server exists; launch and resume target the selection. */
export function ServerPicker(props: {
	label: string;
	list: readonly ServerEntry[];
	value: string;
	onChange(id: string): void;
}): ReactNode {
	const { label, list, value, onChange } = props;
	return (
		<label className="ses-server-picker">
			<span>{label}</span>
			<select value={value} onChange={e => onChange(e.currentTarget.value)} aria-label={label}>
				{list.map(s => (
					<option key={s.id} value={s.id}>
						{s.name}
					</option>
				))}
			</select>
		</label>
	);
}
