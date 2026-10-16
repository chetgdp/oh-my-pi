import { describe, expect, it } from "bun:test";
import { foldView, type NodeRef } from "@oh-my-pi/pi-coding-agent/omem/index";

interface States {
	keep: number;
	life: number;
	state: number;
	older: States | null;
}

// Taelin's rollback push, verbatim from gist §3.1.
function push(new_state: number, states: States | null): States {
	if (states === null) {
		return { keep: 0, life: 0, state: new_state, older: null };
	}
	const { keep, life, state, older } = states;
	if (keep === 0) return { keep: 1, life, state, older };
	if (life > 0) {
		return { keep: 0, life: 0, state: new_state, older: { keep: 0, life: life - 1, state, older } };
	}
	return { keep: 0, life, state: new_state, older: push(state, older) };
}

describe("omem fold", () => {
	it("matches Taelin push for t=0..20000 at push's budget", () => {
		let states: States | null = null;
		const view: NodeRef[] = [];
		for (let t = 0; t <= 20_000; t++) {
			states = push(t, states);
			const starts: number[] = [];
			for (let s: States | null = states; s; s = s.older) starts.unshift(s.state);
			view.push({ l: 0, i: t });
			foldView(
				view,
				t + 1,
				starts.length,
				view.length,
				() => true,
				() => 1,
			);
			const ours = view.map(n => n.i * 2 ** n.l);
			if (ours.join() !== starts.join()) expect({ t, ours }).toEqual({ t, ours: starts });
		}
	});

	it("never merges pairs whose parent is unbuilt", () => {
		const view: NodeRef[] = [0, 1, 2, 3].map(i => ({ l: 0, i }));
		const total = foldView(
			view,
			4,
			1,
			4,
			(l, i) => !(l === 1 && i === 0),
			() => 1,
		);
		expect(view).toEqual([
			{ l: 0, i: 0 },
			{ l: 0, i: 1 },
			{ l: 1, i: 1 },
		]);
		expect(total).toBe(3);
	});
});
