import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { askRenderer } from "../src/components/transcript/tool-views/tools/ask";

const HTML = `<form>
	<p>Which database?</p>
	<label><input type="radio" name="db" value="sqlite"> SQLite</label>
	<label><input type="radio" name="db" value="pg"> Postgres</label>
	<label>Project name <input type="text" name="title"></label>
</form>`;

describe("ask renderer", () => {
	it("summarizes an HTML form by its first question and question count", () => {
		const Summary = askRenderer.Summary;
		const html = renderToStaticMarkup(<Summary name="ask" args={{ html: HTML }} />);
		expect(html).toContain("Which database?");
		expect(html).toContain("2 questions");
		expect(html).not.toContain("invalid");
	});

	it("lists form answers, notes and the timeout marker", () => {
		const Body = askRenderer.Body!;
		const html = renderToStaticMarkup(
			<Body
				name="ask"
				args={{ html: HTML }}
				result={{
					content: [{ type: "text", text: "answered" }],
					details: {
						answers: [
							{ name: "db", question: "Which database?", answer: "Postgres" },
							{ name: "title", question: "Project name", answer: "demo" },
						],
						notes: [{ name: "db", question: "Which database?", option: "Postgres", value: "pg", text: "v16" }],
						timedOut: true,
					},
				}}
			/>,
		);
		expect(html).toContain("Which database?");
		expect(html).toContain("Postgres");
		expect(html).toContain("demo");
		expect(html).toContain("v16");
		expect(html).toContain("timeout");
	});

	it("shows the questions while waiting for the user", () => {
		const Body = askRenderer.Body!;
		const html = renderToStaticMarkup(<Body name="ask" args={{ html: HTML }} running />);
		expect(html).toContain("Which database?");
		expect(html).toContain("Project name");
		expect(html).toContain("waiting for the user");
	});

	it("a partially streamed form summarizes without an invalid marker", () => {
		const Summary = askRenderer.Summary;
		const html = renderToStaticMarkup(<Summary name="ask" args={{ html: "<form><p>Whi" }} />);
		expect(html).not.toContain("invalid");
	});

	it("keeps rendering legacy questions from old sessions", () => {
		const Body = askRenderer.Body!;
		const html = renderToStaticMarkup(
			<Body
				name="ask"
				args={{ questions: [{ id: "db", question: "Which DB?", options: [{ label: "SQLite" }, { label: "PG" }] }] }}
				result={{
					content: [{ type: "text", text: "ok" }],
					details: { results: [{ id: "db", question: "Which DB?", selectedOptions: ["PG"] }] },
				}}
			/>,
		);
		expect(html).toContain("Which DB?");
		expect(html).toContain("●");
	});
});
