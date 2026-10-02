import "fake-indexeddb/auto";
import { describe, expect, test } from "bun:test";
import { createStore, entries, set } from "idb-keyval";
import { createDraftStore, type DraftStore } from "../src/lib/drafts";

const HOUR = 60 * 60 * 1000;
let dbSeq = 0;

function freshDb(): string {
	dbSeq += 1;
	return `drafts-test-${dbSeq}`;
}

async function open(dbName: string, at: number): Promise<DraftStore> {
	const store = createDraftStore({ dbName, now: () => at, listenLifecycle: false });
	await store.hydrateDrafts();
	return store;
}

async function storedKeys(dbName: string): Promise<string[]> {
	return (await entries<string, unknown>(createStore(dbName, "drafts"))).map(([k]) => k).sort();
}

describe("draft store", () => {
	test("a draft written in one page load is there after reload", async () => {
		const db = freshDb();
		const first = await open(db, 0);
		first.writeDraft("s1:Main", { text: "half a prompt", images: [] });
		first.flushDrafts();
		const second = await open(db, HOUR);
		expect(second.readDraft("s1:Main").text).toBe("half a prompt");
		expect(second.readDraft("s2:Main").text).toBe("");
	});

	test("drafts older than one day are dropped and deleted from storage", async () => {
		const db = freshDb();
		const first = await open(db, 0);
		first.writeDraft("old:Main", { text: "stale", images: [] });
		first.flushDrafts();
		const keep = await open(db, 23 * HOUR);
		expect(keep.readDraft("old:Main").text).toBe("stale");
		const later = await open(db, 25 * HOUR);
		expect(later.readDraft("old:Main").text).toBe("");
		expect(await storedKeys(db)).toEqual([]);
	});

	test("clearing a draft removes it across reloads", async () => {
		const db = freshDb();
		const first = await open(db, 0);
		first.writeDraft("s1:Main", { text: "sent soon", images: [] });
		first.flushDrafts();
		first.writeDraft("s1:Main", { text: "", images: [] });
		first.flushDrafts();
		expect((await open(db, 1)).readDraft("s1:Main").text).toBe("");
	});

	test("only the 20 newest drafts survive", async () => {
		const db = freshDb();
		let t = 0;
		const store = createDraftStore({ dbName: db, now: () => t, listenLifecycle: false });
		await store.hydrateDrafts();
		for (let i = 0; i < 21; i++) {
			t = i;
			store.writeDraft(`s${i}:Main`, { text: `draft ${i}`, images: [] });
		}
		store.flushDrafts();
		const reloaded = await open(db, 100);
		expect(reloaded.readDraft("s0:Main").text).toBe("");
		expect(reloaded.readDraft("s1:Main").text).toBe("draft 1");
		expect(reloaded.readDraft("s20:Main").text).toBe("draft 20");
		expect(await storedKeys(db)).toHaveLength(20);
	});

	test("text typed before storage loads beats the stored draft", async () => {
		const db = freshDb();
		const first = await open(db, 0);
		first.writeDraft("s1:Main", { text: "stored", images: [] });
		first.flushDrafts();
		const second = createDraftStore({ dbName: db, now: () => 1, listenLifecycle: false });
		second.writeDraft("s1:Main", { text: "typed during load", images: [] });
		await second.hydrateDrafts();
		expect(second.readDraft("s1:Main").text).toBe("typed during load");
		expect((await open(db, 2)).readDraft("s1:Main").text).toBe("typed during load");
	});

	test("undated plain-string drafts from older builds load, then expire a day later", async () => {
		const db = freshDb();
		await set("s1:Main", "legacy text", createStore(db, "drafts"));
		expect((await open(db, 10 * HOUR)).readDraft("s1:Main").text).toBe("legacy text");
		expect((await open(db, 35 * HOUR)).readDraft("s1:Main").text).toBe("");
	});
});
