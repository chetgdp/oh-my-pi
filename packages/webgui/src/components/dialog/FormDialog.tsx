import { useState, type ReactNode } from "react";
import { X } from "lucide-react";
import {
	OTHER_LABEL,
	choiceValue,
	fieldError,
	textValue,
	type HtmlFormData,
	type HtmlFormValue,
} from "@oh-my-pi/pi-tui/html-form/data";
import type {
	ChoiceField,
	FormBlock,
	FormField,
	FormSpan,
	HtmlForm,
	TextField,
} from "@oh-my-pi/pi-tui/html-form/parse";
import type { RpcExtensionUIResponse } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";

export interface FormDialogProps {
	id: string;
	form: HtmlForm;
	/** Dialogs waiting behind this one. */
	queued: number;
	onAnswer: (response: RpcExtensionUIResponse) => void;
	/** Hides the sheet without answering; the alert strip reopens it. */
	onClose?: () => void;
	/** Clear: renders in the composer slot with no backdrop instead of as a floating sheet. */
	docked?: boolean;
}

/** Per-field answer state, indexed like `form.fields`; starts at the form's own defaults (`defaultFormData`). */
interface FieldState {
	checked: number[];
	other: string;
	text: string;
}

function initialState(form: HtmlForm): FieldState[] {
	return form.fields.map(field => {
		if (field.kind === "text") return { checked: [], other: "", text: field.value };
		const checked = field.options.flatMap((option, index) => (option.checked ? [index] : []));
		return { checked, other: "", text: "" };
	});
}

function fieldValue(field: FormField, state: FieldState): HtmlFormValue | undefined {
	return field.kind === "text"
		? textValue(field, state.text)
		: choiceValue(field, new Set(state.checked), state.other);
}

function Spans({ spans }: { spans: readonly FormSpan[] }): ReactNode {
	return spans.map((span, i) => {
		const key = `${i}`;
		if (span.style === "code") return <code key={key}>{span.text}</code>;
		if (span.style === "strong") return <strong key={key}>{span.text}</strong>;
		if (span.style === "em") return <em key={key}>{span.text}</em>;
		return <span key={key}>{span.text}</span>;
	});
}

/** Only remote and inline raster sources render; local paths and file URLs show their alt text. */
function isDisplayableImage(src: string): boolean {
	return /^https?:\/\//i.test(src) || /^data:image\/(?:png|jpe?g|gif|webp);/i.test(src);
}

function ContentBlock({ block }: { block: Exclude<FormBlock, { kind: "field" }> }): ReactNode {
	switch (block.kind) {
		case "text":
			return block.heading ? (
				<h3 className="xdlg-form-heading">
					<Spans spans={block.spans} />
				</h3>
			) : (
				<p className="xdlg-form-text">
					<Spans spans={block.spans} />
				</p>
			);
		case "list": {
			const items = block.items.map((item, i) => (
				<li key={`${i}`}>
					<Spans spans={item} />
				</li>
			));
			return block.ordered ? (
				<ol className="xdlg-form-list">{items}</ol>
			) : (
				<ul className="xdlg-form-list">{items}</ul>
			);
		}
		case "pre":
			return <pre className="xdlg-ask-preview">{block.text}</pre>;
		case "table":
			return (
				<table className="xdlg-form-table">
					<tbody>
						{block.rows.map((row, r) => (
							<tr key={`${r}`}>
								{row.map((cell, c) =>
									r < block.headerRows ? (
										<th key={`${c}`}>
											<Spans spans={cell} />
										</th>
									) : (
										<td key={`${c}`}>
											<Spans spans={cell} />
										</td>
									),
								)}
							</tr>
						))}
					</tbody>
				</table>
			);
		case "image":
			return isDisplayableImage(block.src) ? (
				<img className="xdlg-form-image" src={block.src} alt={block.alt} />
			) : block.alt ? (
				<p className="xdlg-form-text">[{block.alt}]</p>
			) : null;
		case "svg":
			// Inline SVG is agent markup; it is never injected into the DOM.
			return block.alt ? <p className="xdlg-form-text">[{block.alt}]</p> : null;
	}
}

/** HTML form the agent sent through `ask`; parent keys it by dialog id so state resets per request. */
export function FormDialog({ id, form, queued, onAnswer, onClose, docked = false }: FormDialogProps): ReactNode {
	const [fields, setFields] = useState<FieldState[]>(() => initialState(form));
	const [errors, setErrors] = useState<(string | undefined)[]>(() => form.fields.map(() => undefined));

	const cancel = (): void => onAnswer({ type: "extension_ui_response", id, cancelled: true });

	function update(index: number, next: FieldState): void {
		setFields(fields.with(index, next));
		if (errors[index]) setErrors(errors.with(index, undefined));
	}

	function submit(): void {
		const formData: HtmlFormData = {};
		for (const [name, value] of form.hidden) formData[name] = value;
		const nextErrors = form.fields.map((field, index) => {
			if (!field.name) return undefined;
			const value = fieldValue(field, fields[index]);
			if (value !== undefined) formData[field.name] = value;
			return fieldError(field, value);
		});
		if (nextErrors.some(Boolean)) {
			setErrors(nextErrors);
			return;
		}
		onAnswer({ type: "extension_ui_response", id, formData });
	}

	function toggle(index: number, field: ChoiceField, option: number): void {
		const state = fields[index];
		if (field.multi) {
			const checked = state.checked.includes(option)
				? state.checked.filter(i => i !== option)
				: [...state.checked, option].sort((a, b) => a - b);
			update(index, { ...state, checked });
			return;
		}
		// A radio pick replaces any typed Other answer.
		update(index, { ...state, checked: [option], other: "" });
	}

	function typeOther(index: number, field: ChoiceField, value: string): void {
		const state = fields[index];
		// Radio: free text replaces the chosen option.
		const checked = !field.multi && value.trim() ? [] : state.checked;
		update(index, { ...state, checked, other: value });
	}

	function renderChoice(index: number, field: ChoiceField, labelText: ReactNode): ReactNode {
		const state = fields[index];
		if (field.select && !field.multi) {
			const current = state.checked[0];
			return (
				<select
					className="plan-refine-input xdlg-input xdlg-form-select"
					aria-label={field.name}
					value={current === undefined ? "" : String(current)}
					onChange={e => {
						const raw = e.target.value;
						update(index, { ...state, checked: raw === "" ? [] : [Number(raw)] });
					}}
				>
					{current === undefined ? <option value="">Choose…</option> : null}
					{field.options.map((option, oi) => (
						<option key={`${oi}:${option.value}`} value={String(oi)} disabled={option.disabled}>
							{option.label.map(s => s.text).join("")}
						</option>
					))}
				</select>
			);
		}
		const multi = field.multi;
		return (
			<>
				<div
					className="xdlg-options"
					role={multi ? "group" : "radiogroup"}
					aria-label={labelText ? undefined : field.name}
				>
					{field.options.map((option, oi) => {
						const isChecked = state.checked.includes(oi);
						return (
							<button
								key={`${oi}:${option.value}`}
								type="button"
								role={multi ? "checkbox" : "radio"}
								aria-checked={isChecked}
								disabled={option.disabled}
								className={
									isChecked ? "xdlg-option xdlg-ask-option xdlg-ask-selected" : "xdlg-option xdlg-ask-option"
								}
								onClick={() => toggle(index, field, oi)}
							>
								<span className="xdlg-ask-option-row">
									<span className={multi ? "xdlg-ask-mark xdlg-ask-check" : "xdlg-ask-mark xdlg-ask-radio"} />
									<span className="xdlg-option-label">
										<Spans spans={option.label} />
									</span>
								</span>
							</button>
						);
					})}
				</div>
				{field.other ? (
					<label className="xdlg-ask-other">
						<span className="xdlg-ask-other-label">{OTHER_LABEL}</span>
						<input
							type="text"
							className="plan-refine-input xdlg-input xdlg-ask-other-input"
							aria-label={OTHER_LABEL}
							placeholder={multi ? "Add your own answer" : "Type your own answer"}
							value={state.other}
							onChange={e => typeOther(index, field, e.target.value)}
						/>
					</label>
				) : null}
			</>
		);
	}

	function renderText(index: number, field: TextField): ReactNode {
		const state = fields[index];
		const label = field.label.map(s => s.text).join("") || field.placeholder || field.name;
		const common = {
			className: "plan-refine-input xdlg-input",
			"aria-label": label,
			placeholder: field.placeholder || undefined,
			value: state.text,
			required: field.required,
			minLength: field.minLength,
			maxLength: field.maxLength,
		};
		return field.multiline ? (
			<textarea
				{...common}
				className="plan-refine-input xdlg-editor"
				rows={Math.max(field.rows, 3)}
				onChange={e => update(index, { ...state, text: e.target.value })}
			/>
		) : (
			<input
				{...common}
				type={field.type || "text"}
				min={field.min}
				max={field.max}
				onChange={e => update(index, { ...state, text: e.target.value })}
			/>
		);
	}

	function renderField(field: FormField): ReactNode {
		// The frame arrives as JSON, so a block's field is a copy of its entry in `form.fields`, never the same object.
		const index = form.fields.findIndex(candidate => candidate.name === field.name);
		if (index === -1) return null;
		const error = errors[index];
		const label = field.label.length > 0 ? <Spans spans={field.label} /> : null;
		return (
			<div className={error ? "xdlg-form-field has-error" : "xdlg-form-field"} data-field={field.name}>
				{label ? (
					<span className="xdlg-form-label">
						{label}
						{field.required ? <span className="xdlg-form-required"> *</span> : null}
					</span>
				) : null}
				{field.kind === "choice" ? renderChoice(index, field, label) : renderText(index, field)}
				{error ? (
					<span className="xdlg-form-error" role="alert">
						{error}
					</span>
				) : null}
			</div>
		);
	}

	const heading = "Input requested";

	return (
		<>
			{docked ? null : <div className="plan-backdrop" onClick={onClose} />}
			<div
				className={docked ? "plan-review-sheet xdlg-sheet is-docked" : "plan-review-sheet xdlg-sheet"}
				role="dialog"
				aria-label={heading}
				data-method="form"
			>
				<div className="plan-review-header">
					<div className="plan-review-header-text">
						<h2 className="plan-review-title">{heading}</h2>
						{queued > 0 ? <span className="plan-review-path">{queued} more waiting</span> : null}
					</div>
					<button type="button" className="plan-review-close" aria-label="Cancel" onClick={cancel}>
						<X size={18} />
					</button>
				</div>
				<div className="plan-review-body xdlg-body">
					{form.sections.map((section, si) => {
						const blocks = section.blocks.map((block, bi) => (
							<div key={`${bi}`} className="xdlg-form-block">
								{block.kind === "field" ? renderField(block.field) : <ContentBlock block={block} />}
							</div>
						));
						return section.fieldset ? (
							<fieldset key={`${si}`} className="xdlg-form-section">
								{section.title.length > 0 ? (
									<legend className="xdlg-form-legend">
										<Spans spans={section.title} />
									</legend>
								) : null}
								{blocks}
							</fieldset>
						) : (
							<div key={`${si}`} className="xdlg-form-section is-loose">
								{blocks}
							</div>
						);
					})}
				</div>
				<div className="plan-review-footer">
					<button type="button" className="plan-btn plan-btn-primary" onClick={submit}>
						Submit
					</button>
					<button type="button" className="plan-btn plan-btn-cancel" onClick={cancel}>
						Cancel
					</button>
				</div>
			</div>
		</>
	);
}
