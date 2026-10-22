import "./dom-setup";
import { win } from "./dom-setup";
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
// Exception: react-dom/client and LoginFlow must be imported after dom-setup initializes globalThis window and events
const { createRoot } = await import("react-dom/client");
const { act } = await import("react");
const { LoginFlow } = await import("../src/components/models/LoginFlow");
import type { LoginFlowProps } from "../src/components/models/contract";

interface TestMount {
	container: HTMLElement;
	cleanup(): void;
	findButton(text: string): { click(): void; disabled?: boolean; textContent: string | null } | undefined;
	findInput(selector: string): { value: string; type?: string; dispatchEvent(e: unknown): boolean } | null;
}

function mount(ui: React.ReactElement): TestMount {
	const container = win.document.createElement("div");
	win.document.body.appendChild(container);
	const root = createRoot(container as unknown as HTMLElement);
	act(() => {
		root.render(ui);
	});
	return {
		container: container as unknown as HTMLElement,
		cleanup() {
			act(() => {
				root.unmount();
			});
			container.remove();
		},
		findButton(text: string) {
			const buttons = Array.from(container.querySelectorAll("button")) as unknown as Array<{
				click(): void;
				disabled?: boolean;
				textContent: string | null;
			}>;
			return buttons.find(b => b.textContent === text);
		},
		findInput(selector: string) {
			const el = container.querySelector(selector);
			return el as unknown as { value: string; type?: string; dispatchEvent(e: unknown): boolean } | null;
		},
	};
}

function changeInputValue(
	input: { value: string; dispatchEvent: (e: unknown) => boolean },
	value: string,
): void {
	const nativeSetter = Object.getOwnPropertyDescriptor(
		win.HTMLInputElement.prototype,
		"value",
	)?.set;
	if (nativeSetter) {
		nativeSetter.call(input, value);
	} else {
		input.value = value;
	}
	input.dispatchEvent(new win.Event("input", { bubbles: true }));
}

describe("LoginFlow component", () => {
	const baseProps: LoginFlowProps = {
		onSubmitInput: () => {},
		onCancel: () => {},
		onClose: () => {},
	};

	test("renders auth url and copy button, copy writes to clipboard", () => {
		let copiedText = "";
		Object.defineProperty(win.navigator, "clipboard", {
			value: {
				writeText: async (text: string) => {
					copiedText = text;
				},
			},
			configurable: true,
			writable: true,
		});

		const props: LoginFlowProps = {
			...baseProps,
			url: "https://github.com/login/device",
		};

		// SSR verification
		const html = renderToStaticMarkup(<LoginFlow {...props} />);
		expect(html).toContain('href="https://github.com/login/device"');
		expect(html).toContain('target="_blank"');
		expect(html).toContain('rel="noopener noreferrer"');
		expect(html).toContain("Open sign-in page");
		expect(html).toContain("Copy link");

		// DOM verification for copy click
		const { findButton, cleanup } = mount(<LoginFlow {...props} />);
		const copyBtn = findButton("Copy link");
		expect(copyBtn).toBeDefined();

		act(() => {
			copyBtn?.click();
		});

		expect(copiedText).toBe("https://github.com/login/device");
		cleanup();
	});

	test("renders instructions and progress list", () => {
		const props: LoginFlowProps = {
			...baseProps,
			instructions: "Enter the code shown on your terminal.",
			progress: ["Connecting to server...", "Awaiting authorization code"],
		};

		const html = renderToStaticMarkup(<LoginFlow {...props} />);
		expect(html).toContain("Enter the code shown on your terminal.");
		expect(html).toContain("Connecting to server...");
		expect(html).toContain("Awaiting authorization code");
	});

	test("manual_input submit fires onSubmitInput with value", () => {
		let submittedValue = "";
		const props: LoginFlowProps = {
			...baseProps,
			pending: {
				requestId: "req-manual-1",
				kind: "manual_input",
			},
			onSubmitInput: val => {
				submittedValue = val;
			},
		};

		// SSR verification
		const html = renderToStaticMarkup(<LoginFlow {...props} />);
		expect(html).toContain("Paste the address of the page you landed on");
		expect(html).toContain(
			"After you sign in, the browser opens a page that cannot load. Copy its address and paste it here.",
		);
		expect(html).toContain("Submit");

		// DOM verification
		const { findInput, findButton, cleanup } = mount(<LoginFlow {...props} />);
		const input = findInput("#login-manual-input");
		const submitBtn = findButton("Submit");
		expect(input).not.toBeNull();
		expect(submitBtn).toBeDefined();
		expect(submitBtn?.disabled).toBe(true);

		// Type value
		act(() => {
			changeInputValue(input!, "http://localhost:8080/callback?code=xyz123");
		});

		expect(submitBtn?.disabled).toBe(false);

		// Click Submit
		act(() => {
			submitBtn?.click();
		});

		expect(submittedValue).toBe("http://localhost:8080/callback?code=xyz123");
		cleanup();
	});

	test("manual_input submits on Enter key", () => {
		let submittedValue = "";
		const props: LoginFlowProps = {
			...baseProps,
			pending: {
				requestId: "req-manual-2",
				kind: "manual_input",
			},
			onSubmitInput: val => {
				submittedValue = val;
			},
		};

		const { findInput, cleanup } = mount(<LoginFlow {...props} />);
		const input = findInput("#login-manual-input");
		expect(input).not.toBeNull();

		act(() => {
			changeInputValue(input!, "code-via-enter");
		});

		act(() => {
			input?.dispatchEvent(
				new win.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
			);
		});

		expect(submittedValue).toBe("code-via-enter");
		cleanup();
	});

	test("secret prompt renders password input and fires onSubmitInput", () => {
		let submittedValue = "";
		const props: LoginFlowProps = {
			...baseProps,
			pending: {
				requestId: "req-prompt-1",
				kind: "prompt",
				message: "Enter your API secret token",
				placeholder: "sk-...",
				secret: true,
			},
			onSubmitInput: val => {
				submittedValue = val;
			},
		};

		// SSR verification: password type and placeholder
		const html = renderToStaticMarkup(<LoginFlow {...props} />);
		expect(html).toContain('type="password"');
		expect(html).toContain('placeholder="sk-..."');
		expect(html).toContain("Enter your API secret token");

		// DOM verification
		const { findInput, findButton, cleanup } = mount(<LoginFlow {...props} />);
		const input = findInput("#login-prompt-input");
		expect(input).not.toBeNull();
		expect(input?.type).toBe("password");

		act(() => {
			changeInputValue(input!, "my-secret-key");
		});

		const submitBtn = findButton("Submit");
		act(() => {
			submitBtn?.click();
		});

		expect(submittedValue).toBe("my-secret-key");
		cleanup();
	});

	test("allowEmpty prompt allows submitting empty input", () => {
		let submittedValue = "";
		const props: LoginFlowProps = {
			...baseProps,
			pending: {
				requestId: "req-prompt-2",
				kind: "prompt",
				message: "Optional note",
				allowEmpty: true,
			},
			onSubmitInput: val => {
				submittedValue = val;
			},
		};

		const { findButton, cleanup } = mount(<LoginFlow {...props} />);
		const submitBtn = findButton("Submit");
		expect(submitBtn?.disabled).toBe(false);

		act(() => {
			submitBtn?.click();
		});

		expect(submittedValue).toBe("");
		cleanup();
	});

	test("cancel button fires onCancel while no result", () => {
		let cancelCount = 0;
		const props: LoginFlowProps = {
			...baseProps,
			onCancel: () => {
				cancelCount++;
			},
		};

		const { container, cleanup } = mount(<LoginFlow {...props} />);

		// 1. Cancel button in footer
		const cancelBtn = container.querySelector(".login-btn-cancel") as unknown as {
			click(): void;
			textContent: string | null;
		} | null;
		expect(cancelBtn).not.toBeNull();
		expect(cancelBtn?.textContent).toBe("Cancel");

		act(() => {
			cancelBtn?.click();
		});
		expect(cancelCount).toBe(1);
		cleanup();
	});

	test("done state renders success text and Done button calling onClose", () => {
		let closeCount = 0;
		const props: LoginFlowProps = {
			...baseProps,
			result: {
				kind: "done",
				identity: "octocat@github.com",
			},
			onClose: () => {
				closeCount++;
			},
		};

		// SSR verification
		const html = renderToStaticMarkup(<LoginFlow {...props} />);
		expect(html).toContain("Connected as octocat@github.com");
		expect(html).toContain("Done");
		expect(html).not.toContain("Cancel");

		// DOM verification: Done button calls onClose
		const { findButton, cleanup } = mount(<LoginFlow {...props} />);
		const doneBtn = findButton("Done");
		expect(doneBtn).toBeDefined();

		act(() => {
			doneBtn?.click();
		});

		expect(closeCount).toBe(1);
		cleanup();
	});

	test("failed state renders error text and Close button calling onClose", () => {
		let closeCount = 0;
		const props: LoginFlowProps = {
			...baseProps,
			result: {
				kind: "failed",
				error: "OAuth token request timed out",
				cancelled: false,
			},
			onClose: () => {
				closeCount++;
			},
		};

		// SSR verification
		const html = renderToStaticMarkup(<LoginFlow {...props} />);
		expect(html).toContain("OAuth token request timed out");
		expect(html).toContain("Close");

		// DOM verification
		const { findButton, cleanup } = mount(<LoginFlow {...props} />);
		const closeBtn = findButton("Close");
		expect(closeBtn).toBeDefined();

		act(() => {
			closeBtn?.click();
		});

		expect(closeCount).toBe(1);
		cleanup();
	});

	test("failed state with cancelled: true renders 'Login cancelled'", () => {
		const props: LoginFlowProps = {
			...baseProps,
			result: {
				kind: "failed",
				error: "Cancelled by user",
				cancelled: true,
			},
		};

		const html = renderToStaticMarkup(<LoginFlow {...props} />);
		expect(html).toContain("Login cancelled");
		expect(html).not.toContain("Cancelled by user");
	});
});
