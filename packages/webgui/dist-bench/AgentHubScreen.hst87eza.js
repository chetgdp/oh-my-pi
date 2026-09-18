import {
  TranscriptView,
  X,
  agentIdLabel,
  applyTranscriptChunk,
  browserWindow,
  buildHubRows,
  childrenOf,
  computeTotals,
  draftKey,
  emptyHubTranscript,
  emptyTranscriptState,
  entryMetrics,
  fmtCost,
  fmtDuration,
  fmtTokens,
  getSubagentMessages,
  isFocusable,
  killAgent,
  notify,
  onDraftsHydrated,
  parentOf,
  readDraft,
  relTime,
  require_jsx_runtime,
  require_react,
  reviveAgent,
  steerAgent,
  useVirtualizer,
  writeDraft
} from "./main.r6jtkypk.js";
import {
  __toESM
} from "./main.5hz6q5qz.js";

// src/components/agent-hub/AgentHubScreen.tsx
var import_react3 = __toESM(require_react(), 1);

// src/components/agent-hub/HubDetail.tsx
var jsx_runtime = __toESM(require_jsx_runtime(), 1);
function Field(props) {
  return /* @__PURE__ */ jsx_runtime.jsxs("div", {
    className: "ah-field",
    children: [
      /* @__PURE__ */ jsx_runtime.jsx("span", {
        className: "ah-field-label",
        children: props.label
      }),
      /* @__PURE__ */ jsx_runtime.jsx("span", {
        className: "ah-field-value",
        children: props.children
      })
    ]
  });
}
function AgentLinkButton(props) {
  return /* @__PURE__ */ jsx_runtime.jsxs("button", {
    type: "button",
    className: "ah-link",
    onClick: () => props.onSelect(props.entry.id),
    children: [
      /* @__PURE__ */ jsx_runtime.jsx("span", {
        className: `ah-dot ah-dot--${props.entry.status}`
      }),
      agentIdLabel(props.entry.id)
    ]
  });
}
function HubDetail(props) {
  const { entry, parent, children, now, onSelect } = props;
  const p = entry.progress;
  const m = entryMetrics(entry);
  const ctxPct = m?.contextTokens !== undefined && m.contextWindow ? Math.min(100, m.contextTokens / m.contextWindow * 100) : null;
  const running = entry.status === "running";
  const toolMs = p?.currentToolStartMs;
  const model = entry.resolvedModel ?? p?.resolvedModel;
  return /* @__PURE__ */ jsx_runtime.jsxs("div", {
    className: "ah-detail",
    children: [
      /* @__PURE__ */ jsx_runtime.jsxs("section", {
        className: "ah-section",
        children: [
          /* @__PURE__ */ jsx_runtime.jsx("h3", {
            children: "Status"
          }),
          /* @__PURE__ */ jsx_runtime.jsxs(Field, {
            label: "State",
            children: [
              /* @__PURE__ */ jsx_runtime.jsx("span", {
                className: `ah-badge ah-badge--${entry.status}`,
                children: entry.status
              }),
              entry.detached && /* @__PURE__ */ jsx_runtime.jsx("span", {
                className: "ah-badge",
                children: "detached"
              })
            ]
          }),
          entry.agent && /* @__PURE__ */ jsx_runtime.jsx(Field, {
            label: "Agent",
            children: entry.agent
          }),
          model && /* @__PURE__ */ jsx_runtime.jsxs(Field, {
            label: "Model",
            children: [
              model,
              p?.resolvedThinkingLevel ? ` (${p.resolvedThinkingLevel})` : "",
              p?.resolvedModelIsFallback ? " fallback" : ""
            ]
          }),
          (entry.modelRole ?? p?.modelRole) && /* @__PURE__ */ jsx_runtime.jsx(Field, {
            label: "Role",
            children: entry.modelRole ?? p?.modelRole
          }),
          /* @__PURE__ */ jsx_runtime.jsx(Field, {
            label: "Created",
            children: relTime(entry.createdAt)
          }),
          /* @__PURE__ */ jsx_runtime.jsx(Field, {
            label: "Active",
            children: relTime(entry.lastActivity)
          }),
          entry.description && /* @__PURE__ */ jsx_runtime.jsx(Field, {
            label: "About",
            children: entry.description
          }),
          entry.task && /* @__PURE__ */ jsx_runtime.jsx(Field, {
            label: "Task",
            children: entry.task
          })
        ]
      }),
      (running || p?.retryState || p?.retryFailure || entry.activity) && /* @__PURE__ */ jsx_runtime.jsxs("section", {
        className: "ah-section",
        children: [
          /* @__PURE__ */ jsx_runtime.jsx("h3", {
            children: "Now"
          }),
          running && p?.currentTool && /* @__PURE__ */ jsx_runtime.jsxs(Field, {
            label: "Tool",
            children: [
              /* @__PURE__ */ jsx_runtime.jsx("code", {
                children: p.currentTool
              }),
              p.currentToolArgs ? /* @__PURE__ */ jsx_runtime.jsxs("span", {
                className: "ah-dim",
                children: [
                  " ",
                  p.currentToolArgs
                ]
              }) : null,
              toolMs !== undefined ? /* @__PURE__ */ jsx_runtime.jsxs("span", {
                className: "ah-dim",
                children: [
                  " ",
                  fmtDuration(Math.max(0, now - toolMs))
                ]
              }) : null
            ]
          }),
          (p?.lastIntent ?? entry.activity) && /* @__PURE__ */ jsx_runtime.jsx(Field, {
            label: "Intent",
            children: p?.lastIntent ?? entry.activity
          }),
          p?.retryState && /* @__PURE__ */ jsx_runtime.jsxs(Field, {
            label: "Retry",
            children: [
              /* @__PURE__ */ jsx_runtime.jsxs("span", {
                className: "ah-badge ah-badge--warn",
                children: [
                  p.retryState.attempt,
                  "/",
                  p.retryState.maxAttempts
                ]
              }),
              " ",
              p.retryState.errorMessage
            ]
          }),
          p?.retryFailure && /* @__PURE__ */ jsx_runtime.jsxs(Field, {
            label: "Failed",
            children: [
              /* @__PURE__ */ jsx_runtime.jsxs("span", {
                className: "ah-badge ah-badge--aborted",
                children: [
                  "after ",
                  p.retryFailure.attempt
                ]
              }),
              " ",
              p.retryFailure.errorMessage
            ]
          })
        ]
      }),
      m && /* @__PURE__ */ jsx_runtime.jsxs("section", {
        className: "ah-section",
        children: [
          /* @__PURE__ */ jsx_runtime.jsx("h3", {
            children: "Usage"
          }),
          /* @__PURE__ */ jsx_runtime.jsx(Field, {
            label: "Tokens",
            children: fmtTokens(m.tokens)
          }),
          /* @__PURE__ */ jsx_runtime.jsx(Field, {
            label: "Requests",
            children: m.requests
          }),
          /* @__PURE__ */ jsx_runtime.jsx(Field, {
            label: "Tools",
            children: m.tools
          }),
          /* @__PURE__ */ jsx_runtime.jsx(Field, {
            label: "Cost",
            children: fmtCost(m.cost)
          }),
          /* @__PURE__ */ jsx_runtime.jsx(Field, {
            label: "Duration",
            children: fmtDuration(m.durationMs)
          }),
          ctxPct !== null && /* @__PURE__ */ jsx_runtime.jsxs(Field, {
            label: "Context",
            children: [
              /* @__PURE__ */ jsx_runtime.jsx("span", {
                className: "ah-gauge",
                role: "meter",
                "aria-valuemin": 0,
                "aria-valuemax": 100,
                "aria-valuenow": Math.round(ctxPct),
                children: /* @__PURE__ */ jsx_runtime.jsx("span", {
                  className: `ah-gauge-fill${ctxPct >= 90 ? " ah-gauge-fill--danger" : ctxPct >= 70 ? " ah-gauge-fill--warn" : ""}`,
                  style: { width: `${ctxPct}%` }
                })
              }),
              " ",
              Math.round(ctxPct),
              "% (",
              fmtTokens(m.contextTokens ?? 0),
              "/",
              fmtTokens(m.contextWindow ?? 0),
              ")"
            ]
          })
        ]
      }),
      /* @__PURE__ */ jsx_runtime.jsxs("section", {
        className: "ah-section",
        children: [
          /* @__PURE__ */ jsx_runtime.jsx("h3", {
            children: "Lineage"
          }),
          /* @__PURE__ */ jsx_runtime.jsx(Field, {
            label: "Parent",
            children: parent ? /* @__PURE__ */ jsx_runtime.jsx(AgentLinkButton, {
              entry: parent,
              onSelect
            }) : /* @__PURE__ */ jsx_runtime.jsx("span", {
              className: "ah-dim",
              children: "none"
            })
          }),
          /* @__PURE__ */ jsx_runtime.jsx(Field, {
            label: "Children",
            children: children.length === 0 ? /* @__PURE__ */ jsx_runtime.jsx("span", {
              className: "ah-dim",
              children: "none"
            }) : /* @__PURE__ */ jsx_runtime.jsx("span", {
              className: "ah-links",
              children: children.map((c) => /* @__PURE__ */ jsx_runtime.jsx(AgentLinkButton, {
                entry: c,
                onSelect
              }, c.id))
            })
          })
        ]
      }),
      (entry.outputPath || entry.patchPath || entry.branchName) && /* @__PURE__ */ jsx_runtime.jsxs("section", {
        className: "ah-section",
        children: [
          /* @__PURE__ */ jsx_runtime.jsx("h3", {
            children: "Changes"
          }),
          entry.branchName && /* @__PURE__ */ jsx_runtime.jsx(Field, {
            label: "Branch",
            children: entry.branchName
          }),
          entry.patchPath && /* @__PURE__ */ jsx_runtime.jsx(Field, {
            label: "Patch",
            children: /* @__PURE__ */ jsx_runtime.jsx("code", {
              children: entry.patchPath
            })
          }),
          entry.outputPath && /* @__PURE__ */ jsx_runtime.jsx(Field, {
            label: "Output",
            children: /* @__PURE__ */ jsx_runtime.jsx("code", {
              children: entry.outputPath
            })
          })
        ]
      }),
      p && (p.recentTools.length > 0 || p.recentOutput.length > 0) && /* @__PURE__ */ jsx_runtime.jsxs("section", {
        className: "ah-section",
        children: [
          /* @__PURE__ */ jsx_runtime.jsx("h3", {
            children: "Recent"
          }),
          p.recentTools.slice(0, 8).map((t, i) => /* @__PURE__ */ jsx_runtime.jsxs("div", {
            className: "ah-recent",
            children: [
              /* @__PURE__ */ jsx_runtime.jsx("code", {
                children: t.tool
              }),
              " ",
              /* @__PURE__ */ jsx_runtime.jsx("span", {
                className: "ah-dim",
                children: t.args
              })
            ]
          }, `${t.endMs}:${i}`)),
          p.recentOutput.length > 0 && /* @__PURE__ */ jsx_runtime.jsx("pre", {
            className: "ah-output",
            children: p.recentOutput.slice(-8).join(`
`)
          })
        ]
      })
    ]
  });
}

// src/components/agent-hub/HubTranscript.tsx
var import_react = __toESM(require_react(), 1);
var jsx_runtime2 = __toESM(require_jsx_runtime(), 1);
var POLL_MS = 1000;
function HubTranscript(props) {
  const { sink, entry, toolHost, draftKey: draftKey2 } = props;
  const agentId = entry.id;
  const [transcript, setTranscript] = import_react.useState(() => emptyHubTranscript(agentId));
  const [error, setError] = import_react.useState(null);
  const [draft, setDraft] = import_react.useState(() => readDraft(draftKey2).text);
  import_react.useEffect(() => {
    writeDraft(draftKey2, { text: draft, images: [] });
  }, [draftKey2, draft]);
  const draftRef = import_react.useRef(draft);
  draftRef.current = draft;
  import_react.useEffect(() => onDraftsHydrated(() => {
    if (draftRef.current === "")
      setDraft(readDraft(draftKey2).text);
  }), [draftKey2]);
  const [sending, setSending] = import_react.useState(false);
  const cursor = import_react.useRef(transcript);
  import_react.useEffect(() => {
    const fresh = emptyHubTranscript(agentId);
    cursor.current = fresh;
    setTranscript(fresh);
    setError(null);
    if (!sink)
      return;
    let cancelled = false;
    let inFlight = false;
    const poll = async () => {
      if (inFlight || cancelled)
        return;
      inFlight = true;
      try {
        const resp = await getSubagentMessages(sink, agentId, cursor.current.nextByte, cursor.current.fileId, cursor.current.sentinel);
        if (cancelled)
          return;
        const next = applyTranscriptChunk(cursor.current, resp.data);
        setError(null);
        if (next !== cursor.current) {
          cursor.current = next;
          setTranscript(next);
        }
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : String(err));
      } finally {
        inFlight = false;
      }
    };
    poll();
    const timer = setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [sink, agentId]);
  const state = import_react.useMemo(() => {
    const entries = transcript.entries.filter((e) => e.type !== "session");
    return { ...emptyTranscriptState(), entries };
  }, [transcript.entries]);
  const canSteer = sink !== null && entry.kind === "sub" && entry.status !== "aborted";
  const send = import_react.useCallback(async () => {
    const text = draft.trim();
    if (!sink || text === "" || sending)
      return;
    setSending(true);
    try {
      await steerAgent(sink, agentId, text);
      setDraft("");
    } catch (err) {
      notify("error", err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }, [sink, agentId, draft, sending]);
  return /* @__PURE__ */ jsx_runtime2.jsxs("div", {
    className: "ah-transcript",
    children: [
      error && /* @__PURE__ */ jsx_runtime2.jsx("div", {
        className: "ah-note ah-note--err",
        children: error
      }),
      !entry.sessionFile && transcript.entries.length === 0 ? /* @__PURE__ */ jsx_runtime2.jsx("div", {
        className: "ah-empty",
        children: "No transcript yet."
      }) : /* @__PURE__ */ jsx_runtime2.jsx("div", {
        className: "ah-transcript-body",
        children: /* @__PURE__ */ jsx_runtime2.jsx(TranscriptView, {
          state,
          streaming: entry.status === "running",
          expandAll: false,
          toolHost
        })
      }),
      /* @__PURE__ */ jsx_runtime2.jsxs("form", {
        className: "ah-steer",
        onSubmit: (e) => {
          e.preventDefault();
          send();
        },
        children: [
          /* @__PURE__ */ jsx_runtime2.jsx("input", {
            className: "ah-input",
            value: draft,
            disabled: !canSteer,
            placeholder: canSteer ? `Steer ${agentIdLabel(entry.id)}...` : "Steering unavailable for this agent",
            "aria-label": "Steer agent",
            onChange: (e) => setDraft(e.currentTarget.value)
          }),
          /* @__PURE__ */ jsx_runtime2.jsx("button", {
            type: "submit",
            className: "ah-btn",
            disabled: !canSteer || sending || draft.trim() === "",
            children: "Steer"
          })
        ]
      })
    ]
  });
}

// src/components/agent-hub/HubTree.tsx
var import_react2 = __toESM(require_react(), 1);
var jsx_runtime3 = __toESM(require_jsx_runtime(), 1);
var VIRTUALIZE_THRESHOLD = 200;
var ROW_HEIGHT = 44;
function Row(props) {
  const { row, selected, tree, onSelect, onOpen } = props;
  const { entry } = row;
  const m = entryMetrics(entry);
  const ref = import_react2.useRef(null);
  import_react2.useEffect(() => {
    if (selected)
      ref.current?.scrollIntoView?.({ block: "nearest" });
  }, [selected]);
  return /* @__PURE__ */ jsx_runtime3.jsxs("button", {
    ref,
    type: "button",
    className: "ah-row",
    "data-selected": selected ? "true" : undefined,
    "data-agent-id": entry.id,
    style: { paddingLeft: 8 + (tree ? row.depth * 16 : 0) },
    onClick: () => onSelect(entry.id),
    onDoubleClick: () => onOpen(entry.id),
    children: [
      /* @__PURE__ */ jsx_runtime3.jsx("span", {
        className: `ah-dot ah-dot--${entry.status}`,
        title: entry.status
      }),
      /* @__PURE__ */ jsx_runtime3.jsxs("span", {
        className: "ah-row-main",
        children: [
          /* @__PURE__ */ jsx_runtime3.jsxs("span", {
            className: "ah-row-name",
            children: [
              /* @__PURE__ */ jsx_runtime3.jsx("span", {
                className: "ah-row-label",
                children: agentIdLabel(entry.id)
              }),
              entry.agent && entry.kind === "sub" ? /* @__PURE__ */ jsx_runtime3.jsx("span", {
                className: "ah-chip",
                children: entry.agent
              }) : null
            ]
          }),
          /* @__PURE__ */ jsx_runtime3.jsx("span", {
            className: "ah-row-sub",
            children: entry.activity ?? entry.description ?? entry.task ?? entry.status
          })
        ]
      }),
      (entry.unreadIrc ?? 0) > 0 && /* @__PURE__ */ jsx_runtime3.jsx("span", {
        className: "ah-badge ah-badge--accent",
        children: entry.unreadIrc
      }),
      m && /* @__PURE__ */ jsx_runtime3.jsxs("span", {
        className: "ah-row-metrics",
        children: [
          fmtTokens(m.tokens),
          " · ",
          fmtCost(m.cost)
        ]
      })
    ]
  });
}
function HubTree(props) {
  const { rows, tree, selectedId, onSelect, onOpen } = props;
  const scrollRef = import_react2.useRef(null);
  const virtual = rows.length > VIRTUALIZE_THRESHOLD;
  const virtualizer = useVirtualizer({
    count: virtual ? rows.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12
  });
  const selectedIndex = selectedId === null ? -1 : rows.findIndex((r) => r.entry.id === selectedId);
  import_react2.useEffect(() => {
    if (selectedIndex < 0)
      return;
    if (virtual)
      virtualizer.scrollToIndex(selectedIndex);
  }, [selectedIndex, virtual, virtualizer]);
  if (rows.length === 0)
    return /* @__PURE__ */ jsx_runtime3.jsx("div", {
      className: "ah-empty",
      children: "No agents match."
    });
  return /* @__PURE__ */ jsx_runtime3.jsx("div", {
    className: "ah-tree",
    ref: scrollRef,
    role: "listbox",
    "aria-label": "Agents",
    children: virtual ? /* @__PURE__ */ jsx_runtime3.jsx("div", {
      style: { height: virtualizer.getTotalSize(), position: "relative" },
      children: virtualizer.getVirtualItems().map((item) => {
        const row = rows[item.index];
        return /* @__PURE__ */ jsx_runtime3.jsx("div", {
          style: {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: item.size,
            transform: `translateY(${item.start}px)`
          },
          children: /* @__PURE__ */ jsx_runtime3.jsx(Row, {
            row,
            tree,
            selected: row.entry.id === selectedId,
            onSelect,
            onOpen
          })
        }, row.entry.id);
      })
    }) : rows.map((row) => /* @__PURE__ */ jsx_runtime3.jsx(Row, {
      row,
      tree,
      selected: row.entry.id === selectedId,
      onSelect,
      onOpen
    }, row.entry.id))
  });
}

// src/components/agent-hub/AgentHubScreen.tsx
var jsx_runtime4 = __toESM(require_jsx_runtime(), 1);
function errMsg(err) {
  return err instanceof Error ? err.message : String(err);
}
function isTypingTarget(target) {
  const tag = target?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA";
}
function AgentHubScreen({
  hub,
  sink,
  instanceId,
  focusAgentId,
  onFocusAgent,
  onClose
}) {
  const [tree, setTree] = import_react3.useState(true);
  const [filter, setFilter] = import_react3.useState("");
  const [selectedId, setSelectedId] = import_react3.useState(focusAgentId ?? null);
  const [tab, setTab] = import_react3.useState("details");
  const [detailOpen, setDetailOpen] = import_react3.useState(focusAgentId !== undefined);
  const [confirmKill, setConfirmKill] = import_react3.useState(null);
  const [now, setNow] = import_react3.useState(() => Date.now());
  const filterRef = import_react3.useRef(null);
  import_react3.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  import_react3.useEffect(() => {
    if (focusAgentId === undefined)
      return;
    setSelectedId(focusAgentId);
    setDetailOpen(true);
    setTab("transcript");
  }, [focusAgentId]);
  const rows = import_react3.useMemo(() => buildHubRows(hub.agents, { tree, filter }), [hub.agents, tree, filter]);
  const totals = import_react3.useMemo(() => computeTotals(hub.agents), [hub.agents]);
  const effectiveId = selectedId !== null && rows.some((r) => r.entry.id === selectedId) ? selectedId : rows[0]?.entry.id ?? null;
  const selected = effectiveId === null ? undefined : hub.agents.get(effectiveId);
  const toolHost = import_react3.useMemo(() => ({
    hasAgent: (id) => hub.agents.has(id),
    openAgent: (id) => {
      setSelectedId(id);
      setDetailOpen(true);
      setTab("transcript");
    }
  }), [hub.agents]);
  const kill = (id) => {
    if (!sink)
      return;
    killAgent(sink, id).catch((err) => notify("error", errMsg(err)));
  };
  const revive = (id) => {
    if (!sink)
      return;
    reviveAgent(sink, id).catch((err) => notify("error", errMsg(err)));
  };
  const canKill = selected !== undefined && selected.kind === "sub" && selected.status !== "aborted";
  const canRevive = selected !== undefined && selected.kind === "sub" && selected.status === "parked";
  const latest = import_react3.useRef({ rows, effectiveId, selected, canKill, canRevive, confirmKill, filter });
  latest.current = { rows, effectiveId, selected, canKill, canRevive, confirmKill, filter };
  const openEntry = (id) => {
    if (isFocusable(hub.agents.get(id))) {
      onFocusAgent(id);
      return;
    }
    setSelectedId(id);
    setDetailOpen(true);
    setTab("transcript");
  };
  const openEntryRef = import_react3.useRef(openEntry);
  openEntryRef.current = openEntry;
  import_react3.useEffect(() => {
    const handle = (e) => {
      const ev = e;
      if (ev.ctrlKey || ev.metaKey || ev.altKey)
        return;
      const s = latest.current;
      if (ev.key === "Escape") {
        if (isTypingTarget(ev.target) && s.filter === "") {
          ev.target.blur?.();
          return;
        }
        ev.preventDefault();
        if (s.confirmKill !== null)
          setConfirmKill(null);
        else if (s.filter !== "") {
          setFilter("");
          filterRef.current?.blur();
        } else
          onClose();
        return;
      }
      if (isTypingTarget(ev.target))
        return;
      const move = (delta) => {
        if (s.rows.length === 0)
          return;
        const at = s.rows.findIndex((r) => r.entry.id === s.effectiveId);
        const next = Math.max(0, Math.min(s.rows.length - 1, (at < 0 ? 0 : at) + delta));
        setSelectedId(s.rows[next].entry.id);
      };
      if (s.confirmKill !== null) {
        if (ev.key === "Enter" || ev.key === "y") {
          ev.preventDefault();
          kill(s.confirmKill);
          setConfirmKill(null);
        } else if (ev.key === "n")
          setConfirmKill(null);
        return;
      }
      switch (ev.key) {
        case "j":
        case "ArrowDown":
          ev.preventDefault();
          move(1);
          break;
        case "k":
        case "ArrowUp":
          ev.preventDefault();
          move(-1);
          break;
        case "Enter":
          if (s.selected) {
            ev.preventDefault();
            openEntryRef.current(s.selected.id);
          }
          break;
        case "t":
          setTree((v) => !v);
          break;
        case "/":
          ev.preventDefault();
          filterRef.current?.focus();
          break;
        case "r":
          if (s.canRevive && s.effectiveId)
            revive(s.effectiveId);
          break;
        case "x":
          if (s.canKill && s.effectiveId)
            setConfirmKill(s.effectiveId);
          break;
      }
    };
    browserWindow.addEventListener("keydown", handle);
    return () => browserWindow.removeEventListener("keydown", handle);
  }, [onClose, sink]);
  const statusCounts = ["running", "idle", "parked", "aborted"].filter((k) => totals.counts[k] > 0);
  return /* @__PURE__ */ jsx_runtime4.jsxs("div", {
    className: "ah-screen",
    "data-detail-open": detailOpen ? "true" : undefined,
    children: [
      /* @__PURE__ */ jsx_runtime4.jsxs("header", {
        className: "ah-header",
        children: [
          /* @__PURE__ */ jsx_runtime4.jsx("h2", {
            children: "Agent Hub"
          }),
          /* @__PURE__ */ jsx_runtime4.jsxs("div", {
            className: "ah-totals",
            children: [
              /* @__PURE__ */ jsx_runtime4.jsx("span", {
                children: fmtCost(totals.cost)
              }),
              /* @__PURE__ */ jsx_runtime4.jsxs("span", {
                children: [
                  totals.requests,
                  " req"
                ]
              }),
              /* @__PURE__ */ jsx_runtime4.jsxs("span", {
                children: [
                  totals.tools,
                  " tools"
                ]
              }),
              /* @__PURE__ */ jsx_runtime4.jsxs("span", {
                children: [
                  fmtTokens(totals.tokens),
                  " tok"
                ]
              }),
              statusCounts.map((k) => /* @__PURE__ */ jsx_runtime4.jsxs("span", {
                className: "ah-count",
                children: [
                  /* @__PURE__ */ jsx_runtime4.jsx("span", {
                    className: `ah-dot ah-dot--${k}`
                  }),
                  totals.counts[k],
                  " ",
                  k
                ]
              }, k))
            ]
          }),
          /* @__PURE__ */ jsx_runtime4.jsx("button", {
            type: "button",
            className: "ah-icon-btn",
            onClick: onClose,
            "aria-label": "Close agent hub",
            title: "Close (Esc)",
            children: /* @__PURE__ */ jsx_runtime4.jsx(X, {
              size: 18
            })
          })
        ]
      }),
      /* @__PURE__ */ jsx_runtime4.jsxs("div", {
        className: "ah-body",
        children: [
          /* @__PURE__ */ jsx_runtime4.jsxs("aside", {
            className: "ah-left",
            children: [
              /* @__PURE__ */ jsx_runtime4.jsxs("div", {
                className: "ah-toolbar",
                children: [
                  /* @__PURE__ */ jsx_runtime4.jsx("input", {
                    ref: filterRef,
                    className: "ah-input",
                    value: filter,
                    placeholder: "Filter (/)",
                    "aria-label": "Filter agents",
                    onChange: (e) => setFilter(e.currentTarget.value),
                    onKeyDown: (e) => {
                      if (e.key === "Enter" || e.key === "ArrowDown")
                        filterRef.current?.blur();
                    }
                  }),
                  /* @__PURE__ */ jsx_runtime4.jsx("button", {
                    type: "button",
                    className: "ah-btn",
                    "data-active": tree ? "true" : undefined,
                    onClick: () => setTree((v) => !v),
                    title: "Toggle tree (t)",
                    children: tree ? "Tree" : "List"
                  })
                ]
              }),
              !hub.loaded ? /* @__PURE__ */ jsx_runtime4.jsx("div", {
                className: "ah-empty",
                children: "Loading agents..."
              }) : /* @__PURE__ */ jsx_runtime4.jsx(HubTree, {
                rows,
                tree,
                selectedId: effectiveId,
                onSelect: (id) => {
                  setSelectedId(id);
                  setDetailOpen(true);
                },
                onOpen: openEntry
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime4.jsx("main", {
            className: "ah-right",
            children: selected ? /* @__PURE__ */ jsx_runtime4.jsxs(jsx_runtime4.Fragment, {
              children: [
                /* @__PURE__ */ jsx_runtime4.jsxs("div", {
                  className: "ah-detail-head",
                  children: [
                    /* @__PURE__ */ jsx_runtime4.jsx("button", {
                      type: "button",
                      className: "ah-btn ah-back",
                      onClick: () => setDetailOpen(false),
                      children: "Back"
                    }),
                    /* @__PURE__ */ jsx_runtime4.jsx("span", {
                      className: `ah-dot ah-dot--${selected.status}`
                    }),
                    /* @__PURE__ */ jsx_runtime4.jsx("strong", {
                      className: "ah-title",
                      children: agentIdLabel(selected.id)
                    }),
                    selected.agent && selected.kind === "sub" ? /* @__PURE__ */ jsx_runtime4.jsx("span", {
                      className: "ah-chip",
                      children: selected.agent
                    }) : null,
                    /* @__PURE__ */ jsx_runtime4.jsx("span", {
                      className: "ah-spacer"
                    }),
                    canRevive && /* @__PURE__ */ jsx_runtime4.jsx("button", {
                      type: "button",
                      className: "ah-btn",
                      onClick: () => revive(selected.id),
                      title: "Revive (r)",
                      children: "Revive"
                    }),
                    canKill && (confirmKill === selected.id ? /* @__PURE__ */ jsx_runtime4.jsxs("span", {
                      className: "ah-confirm",
                      children: [
                        "Kill ",
                        agentIdLabel(selected.id),
                        "?",
                        /* @__PURE__ */ jsx_runtime4.jsx("button", {
                          type: "button",
                          className: "ah-btn ah-btn--danger",
                          onClick: () => {
                            kill(selected.id);
                            setConfirmKill(null);
                          },
                          children: "Confirm"
                        }),
                        /* @__PURE__ */ jsx_runtime4.jsx("button", {
                          type: "button",
                          className: "ah-btn",
                          onClick: () => setConfirmKill(null),
                          children: "Cancel"
                        })
                      ]
                    }) : /* @__PURE__ */ jsx_runtime4.jsx("button", {
                      type: "button",
                      className: "ah-btn ah-btn--danger",
                      onClick: () => setConfirmKill(selected.id),
                      title: "Kill (x)",
                      children: "Kill"
                    }))
                  ]
                }),
                /* @__PURE__ */ jsx_runtime4.jsxs("div", {
                  className: "ah-tabs",
                  role: "tablist",
                  children: [
                    /* @__PURE__ */ jsx_runtime4.jsx("button", {
                      type: "button",
                      role: "tab",
                      "aria-selected": tab === "details",
                      className: "ah-tab",
                      onClick: () => setTab("details"),
                      children: "Details"
                    }),
                    /* @__PURE__ */ jsx_runtime4.jsx("button", {
                      type: "button",
                      role: "tab",
                      "aria-selected": tab === "transcript",
                      className: "ah-tab",
                      onClick: () => setTab("transcript"),
                      children: "Transcript"
                    })
                  ]
                }),
                tab === "details" ? /* @__PURE__ */ jsx_runtime4.jsx(HubDetail, {
                  entry: selected,
                  parent: parentOf(hub.agents, selected.id),
                  children: childrenOf(hub.agents, selected.id),
                  now,
                  onSelect: (id) => setSelectedId(id)
                }) : /* @__PURE__ */ jsx_runtime4.jsx(HubTranscript, {
                  sink,
                  entry: selected,
                  toolHost,
                  draftKey: draftKey(instanceId, `hub:${selected.id}`)
                }, selected.id)
              ]
            }) : /* @__PURE__ */ jsx_runtime4.jsx("div", {
              className: "ah-empty",
              children: "Select an agent."
            })
          })
        ]
      }),
      /* @__PURE__ */ jsx_runtime4.jsx("footer", {
        className: "ah-help",
        children: "j/k move · Enter open · t tree · / filter · r revive · x kill · Esc close"
      })
    ]
  });
}
var AgentHubScreen_default = AgentHubScreen;
export {
  AgentHubScreen_default as default,
  AgentHubScreen
};

//# debugId=76C137DF9BA9DA9D64756E2164756E21
