import {
  Bot,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  EMPTY_AGENT_HUB_STATE,
  EMPTY_SUBAGENT_STATE,
  EllipsisVertical,
  Ghost,
  Info,
  Lock,
  MAIN_AGENT_ID,
  Markdown,
  PanelLeft,
  PanelRight,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcwClock,
  RotateCw,
  SUBAGENT_SUBSCRIBE_COMMAND,
  SlidersHorizontal,
  TranscriptView,
  Trash,
  Volume2,
  VolumeX,
  X,
  abortAndRestoreQueue,
  addPendingUser,
  agentIdLabel,
  applyFocusChunk,
  applyFocusEvent,
  applyFocusSnapshot,
  applyHistoryPage,
  applyRegistryFrame,
  applyRoster,
  applySubagentEvent,
  applySubagentLifecycle,
  applySubagentProgress,
  applyTranscriptEvent,
  applyV3Event,
  approvePlan,
  branch,
  browserDocument,
  browserWindow,
  btw,
  btwCancel,
  claimOnInput,
  clearAllPendingUser,
  clearContext,
  clearPendingUser,
  compact,
  countTodoProgress,
  createStore,
  currentLeafId,
  cycleRoleModel,
  cycleTaskStatus,
  del,
  deleteModelRole,
  detachMessage,
  disableVoice,
  dismissNotice,
  draftKey,
  emptyTranscriptState,
  enableVoice,
  entries,
  entryMetrics,
  escapeAction,
  eventPersistsEntries,
  extractTodoPhasesFromEvent,
  fmtCost,
  fmtDuration,
  fmtTokens,
  followUp,
  formatRoman,
  gateFocusedSubmit,
  get,
  getBtwHistory,
  getLatestTodoPhasesFromEntries,
  getNotices,
  getResetCredits,
  getUsageReports,
  getWrenState,
  handoff,
  hydrateDrafts,
  initialFocusWatch,
  interruptAgent,
  isFocusable,
  loginCancel,
  loginInput,
  loginStart,
  logout,
  mergeSubagentSnapshots,
  newSession,
  notify,
  oldestEntryId,
  onDraftsHydrated,
  readDraft,
  redeemResetCredit,
  refreshModels,
  relTime,
  require_jsx_runtime,
  require_react,
  require_react_dom,
  resetFocusCursor,
  resetTranscriptForResync,
  restoreClearedMessagesToDraft,
  retry,
  sendPrompt,
  set,
  setAgentAdvisor,
  setAgentEnabled,
  setAgentModel,
  setAgentPrewalk,
  setAgentServiceTier,
  setCycleOrder,
  setModel,
  setModelRole,
  setModelTag,
  setPlanMode,
  setSessionName,
  setThinkingLevel,
  startFocus,
  steer,
  steerAgent,
  subagentTreeFromSnapshots,
  subscribeNotices,
  subscribeWren,
  triggerBlobDownload,
  updateTaskStatus,
  viewingMessage,
  watchFocusedAgent,
  writeDraft
} from "./main.r6jtkypk.js";
import {
  __commonJS,
  __esm,
  __export,
  __require,
  __toESM
} from "./main.5hz6q5qz.js";

// ../../node_modules/scheduler/cjs/scheduler.production.js
var exports_scheduler_production = {};
__export(exports_scheduler_production, {
  unstable_wrapCallback: () => $unstable_wrapCallback,
  unstable_shouldYield: () => $unstable_shouldYield,
  unstable_scheduleCallback: () => $unstable_scheduleCallback,
  unstable_runWithPriority: () => $unstable_runWithPriority,
  unstable_requestPaint: () => $unstable_requestPaint,
  unstable_now: () => $unstable_now,
  unstable_next: () => $unstable_next,
  unstable_getCurrentPriorityLevel: () => $unstable_getCurrentPriorityLevel,
  unstable_forceFrameRate: () => $unstable_forceFrameRate,
  unstable_cancelCallback: () => $unstable_cancelCallback,
  unstable_UserBlockingPriority: () => $unstable_UserBlockingPriority,
  unstable_Profiling: () => $unstable_Profiling,
  unstable_NormalPriority: () => $unstable_NormalPriority,
  unstable_LowPriority: () => $unstable_LowPriority,
  unstable_ImmediatePriority: () => $unstable_ImmediatePriority,
  unstable_IdlePriority: () => $unstable_IdlePriority
});
function push(heap, node) {
  var index = heap.length;
  heap.push(node);
  a:
    for (;0 < index; ) {
      var parentIndex = index - 1 >>> 1, parent = heap[parentIndex];
      if (0 < compare(parent, node))
        heap[parentIndex] = node, heap[index] = parent, index = parentIndex;
      else
        break a;
    }
}
function peek(heap) {
  return heap.length === 0 ? null : heap[0];
}
function pop(heap) {
  if (heap.length === 0)
    return null;
  var first = heap[0], last = heap.pop();
  if (last !== first) {
    heap[0] = last;
    a:
      for (var index = 0, length = heap.length, halfLength = length >>> 1;index < halfLength; ) {
        var leftIndex = 2 * (index + 1) - 1, left = heap[leftIndex], rightIndex = leftIndex + 1, right = heap[rightIndex];
        if (0 > compare(left, last))
          rightIndex < length && 0 > compare(right, left) ? (heap[index] = right, heap[rightIndex] = last, index = rightIndex) : (heap[index] = left, heap[leftIndex] = last, index = leftIndex);
        else if (rightIndex < length && 0 > compare(right, last))
          heap[index] = right, heap[rightIndex] = last, index = rightIndex;
        else
          break a;
      }
  }
  return first;
}
function compare(a, b) {
  var diff = a.sortIndex - b.sortIndex;
  return diff !== 0 ? diff : a.id - b.id;
}
function advanceTimers(currentTime) {
  for (var timer = peek(timerQueue);timer !== null; ) {
    if (timer.callback === null)
      pop(timerQueue);
    else if (timer.startTime <= currentTime)
      pop(timerQueue), timer.sortIndex = timer.expirationTime, push(taskQueue, timer);
    else
      break;
    timer = peek(timerQueue);
  }
}
function handleTimeout(currentTime) {
  isHostTimeoutScheduled = false;
  advanceTimers(currentTime);
  if (!isHostCallbackScheduled)
    if (peek(taskQueue) !== null)
      isHostCallbackScheduled = true, isMessageLoopRunning || (isMessageLoopRunning = true, schedulePerformWorkUntilDeadline());
    else {
      var firstTimer = peek(timerQueue);
      firstTimer !== null && requestHostTimeout(handleTimeout, firstTimer.startTime - currentTime);
    }
}
function shouldYieldToHost() {
  return needsPaint ? true : $unstable_now() - startTime < frameInterval ? false : true;
}
function performWorkUntilDeadline() {
  needsPaint = false;
  if (isMessageLoopRunning) {
    var currentTime = $unstable_now();
    startTime = currentTime;
    var hasMoreWork = true;
    try {
      a: {
        isHostCallbackScheduled = false;
        isHostTimeoutScheduled && (isHostTimeoutScheduled = false, localClearTimeout(taskTimeoutID), taskTimeoutID = -1);
        isPerformingWork = true;
        var previousPriorityLevel = currentPriorityLevel;
        try {
          b: {
            advanceTimers(currentTime);
            for (currentTask = peek(taskQueue);currentTask !== null && !(currentTask.expirationTime > currentTime && shouldYieldToHost()); ) {
              var callback = currentTask.callback;
              if (typeof callback === "function") {
                currentTask.callback = null;
                currentPriorityLevel = currentTask.priorityLevel;
                var continuationCallback = callback(currentTask.expirationTime <= currentTime);
                currentTime = $unstable_now();
                if (typeof continuationCallback === "function") {
                  currentTask.callback = continuationCallback;
                  advanceTimers(currentTime);
                  hasMoreWork = true;
                  break b;
                }
                currentTask === peek(taskQueue) && pop(taskQueue);
                advanceTimers(currentTime);
              } else
                pop(taskQueue);
              currentTask = peek(taskQueue);
            }
            if (currentTask !== null)
              hasMoreWork = true;
            else {
              var firstTimer = peek(timerQueue);
              firstTimer !== null && requestHostTimeout(handleTimeout, firstTimer.startTime - currentTime);
              hasMoreWork = false;
            }
          }
          break a;
        } finally {
          currentTask = null, currentPriorityLevel = previousPriorityLevel, isPerformingWork = false;
        }
        hasMoreWork = undefined;
      }
    } finally {
      hasMoreWork ? schedulePerformWorkUntilDeadline() : isMessageLoopRunning = false;
    }
  }
}
function requestHostTimeout(callback, ms) {
  taskTimeoutID = localSetTimeout(function() {
    callback($unstable_now());
  }, ms);
}
var $unstable_now = undefined, localPerformance, localDate, initialTime, taskQueue, timerQueue, taskIdCounter = 1, currentTask = null, currentPriorityLevel = 3, isPerformingWork = false, isHostCallbackScheduled = false, isHostTimeoutScheduled = false, needsPaint = false, localSetTimeout, localClearTimeout, localSetImmediate, isMessageLoopRunning = false, taskTimeoutID = -1, frameInterval = 5, startTime = -1, schedulePerformWorkUntilDeadline, channel, port, $unstable_IdlePriority = 5, $unstable_ImmediatePriority = 1, $unstable_LowPriority = 4, $unstable_NormalPriority = 3, $unstable_Profiling = null, $unstable_UserBlockingPriority = 2, $unstable_cancelCallback = function(task) {
  task.callback = null;
}, $unstable_forceFrameRate = function(fps) {
  0 > fps || 125 < fps ? console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported") : frameInterval = 0 < fps ? Math.floor(1000 / fps) : 5;
}, $unstable_getCurrentPriorityLevel = function() {
  return currentPriorityLevel;
}, $unstable_next = function(eventHandler) {
  switch (currentPriorityLevel) {
    case 1:
    case 2:
    case 3:
      var priorityLevel = 3;
      break;
    default:
      priorityLevel = currentPriorityLevel;
  }
  var previousPriorityLevel = currentPriorityLevel;
  currentPriorityLevel = priorityLevel;
  try {
    return eventHandler();
  } finally {
    currentPriorityLevel = previousPriorityLevel;
  }
}, $unstable_requestPaint = function() {
  needsPaint = true;
}, $unstable_runWithPriority = function(priorityLevel, eventHandler) {
  switch (priorityLevel) {
    case 1:
    case 2:
    case 3:
    case 4:
    case 5:
      break;
    default:
      priorityLevel = 3;
  }
  var previousPriorityLevel = currentPriorityLevel;
  currentPriorityLevel = priorityLevel;
  try {
    return eventHandler();
  } finally {
    currentPriorityLevel = previousPriorityLevel;
  }
}, $unstable_scheduleCallback = function(priorityLevel, callback, options) {
  var currentTime = $unstable_now();
  typeof options === "object" && options !== null ? (options = options.delay, options = typeof options === "number" && 0 < options ? currentTime + options : currentTime) : options = currentTime;
  switch (priorityLevel) {
    case 1:
      var timeout = -1;
      break;
    case 2:
      timeout = 250;
      break;
    case 5:
      timeout = 1073741823;
      break;
    case 4:
      timeout = 1e4;
      break;
    default:
      timeout = 5000;
  }
  timeout = options + timeout;
  priorityLevel = {
    id: taskIdCounter++,
    callback,
    priorityLevel,
    startTime: options,
    expirationTime: timeout,
    sortIndex: -1
  };
  options > currentTime ? (priorityLevel.sortIndex = options, push(timerQueue, priorityLevel), peek(taskQueue) === null && priorityLevel === peek(timerQueue) && (isHostTimeoutScheduled ? (localClearTimeout(taskTimeoutID), taskTimeoutID = -1) : isHostTimeoutScheduled = true, requestHostTimeout(handleTimeout, options - currentTime))) : (priorityLevel.sortIndex = timeout, push(taskQueue, priorityLevel), isHostCallbackScheduled || isPerformingWork || (isHostCallbackScheduled = true, isMessageLoopRunning || (isMessageLoopRunning = true, schedulePerformWorkUntilDeadline())));
  return priorityLevel;
}, $unstable_shouldYield, $unstable_wrapCallback = function(callback) {
  var parentPriorityLevel = currentPriorityLevel;
  return function() {
    var previousPriorityLevel = currentPriorityLevel;
    currentPriorityLevel = parentPriorityLevel;
    try {
      return callback.apply(this, arguments);
    } finally {
      currentPriorityLevel = previousPriorityLevel;
    }
  };
};
var init_scheduler_production = __esm(() => {
  if (typeof performance === "object" && typeof performance.now === "function") {
    localPerformance = performance;
    $unstable_now = function() {
      return localPerformance.now();
    };
  } else {
    localDate = Date, initialTime = localDate.now();
    $unstable_now = function() {
      return localDate.now() - initialTime;
    };
  }
  taskQueue = [];
  timerQueue = [];
  localSetTimeout = typeof setTimeout === "function" ? setTimeout : null;
  localClearTimeout = typeof clearTimeout === "function" ? clearTimeout : null;
  localSetImmediate = typeof setImmediate !== "undefined" ? setImmediate : null;
  if (typeof localSetImmediate === "function")
    schedulePerformWorkUntilDeadline = function() {
      localSetImmediate(performWorkUntilDeadline);
    };
  else if (typeof MessageChannel !== "undefined") {
    channel = new MessageChannel, port = channel.port2;
    channel.port1.onmessage = performWorkUntilDeadline;
    schedulePerformWorkUntilDeadline = function() {
      port.postMessage(null);
    };
  } else
    schedulePerformWorkUntilDeadline = function() {
      localSetTimeout(performWorkUntilDeadline, 0);
    };
  $unstable_shouldYield = shouldYieldToHost;
});

// ../../node_modules/scheduler/index.js
var require_scheduler = __commonJS((exports, module) => {
  init_scheduler_production();
  if (true) {
    module.exports = exports_scheduler_production;
  }
});

// ../../node_modules/react-dom/cjs/react-dom-profiling.profiling.js
var exports_react_dom_profiling_profiling = {};
__export(exports_react_dom_profiling_profiling, {
  version: () => $version,
  useFormStatus: () => $useFormStatus,
  useFormState: () => $useFormState,
  unstable_batchedUpdates: () => $unstable_batchedUpdates,
  requestFormReset: () => $requestFormReset,
  preloadModule: () => $preloadModule,
  preload: () => $preload,
  preinitModule: () => $preinitModule,
  preinit: () => $preinit,
  prefetchDNS: () => $prefetchDNS,
  preconnect: () => $preconnect,
  hydrateRoot: () => $hydrateRoot,
  flushSync: () => $flushSync,
  createRoot: () => $createRoot,
  createPortal: () => $createPortal,
  __DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: () => $__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
});
function formatProdErrorMessage(code) {
  var url = "https://react.dev/errors/" + code;
  if (1 < arguments.length) {
    url += "?args[]=" + encodeURIComponent(arguments[1]);
    for (var i = 2;i < arguments.length; i++)
      url += "&args[]=" + encodeURIComponent(arguments[i]);
  }
  return "Minified React error #" + code + "; visit " + url + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
}
function isValidContainer(node) {
  return !(!node || node.nodeType !== 1 && node.nodeType !== 9 && node.nodeType !== 11);
}
function getNearestMountedFiber(fiber) {
  var node = fiber, nearestMounted = fiber;
  if (fiber.alternate)
    for (;node.return; )
      node = node.return;
  else {
    fiber = node;
    do
      node = fiber, (node.flags & 4098) !== 0 && (nearestMounted = node.return), fiber = node.return;
    while (fiber);
  }
  return node.tag === 3 ? nearestMounted : null;
}
function getSuspenseInstanceFromFiber(fiber) {
  if (fiber.tag === 13) {
    var suspenseState = fiber.memoizedState;
    suspenseState === null && (fiber = fiber.alternate, fiber !== null && (suspenseState = fiber.memoizedState));
    if (suspenseState !== null)
      return suspenseState.dehydrated;
  }
  return null;
}
function getActivityInstanceFromFiber(fiber) {
  if (fiber.tag === 31) {
    var activityState = fiber.memoizedState;
    activityState === null && (fiber = fiber.alternate, fiber !== null && (activityState = fiber.memoizedState));
    if (activityState !== null)
      return activityState.dehydrated;
  }
  return null;
}
function assertIsMounted(fiber) {
  if (getNearestMountedFiber(fiber) !== fiber)
    throw Error(formatProdErrorMessage(188));
}
function findCurrentFiberUsingSlowPath(fiber) {
  var alternate = fiber.alternate;
  if (!alternate) {
    alternate = getNearestMountedFiber(fiber);
    if (alternate === null)
      throw Error(formatProdErrorMessage(188));
    return alternate !== fiber ? null : fiber;
  }
  for (var a = fiber, b = alternate;; ) {
    var parentA = a.return;
    if (parentA === null)
      break;
    var parentB = parentA.alternate;
    if (parentB === null) {
      b = parentA.return;
      if (b !== null) {
        a = b;
        continue;
      }
      break;
    }
    if (parentA.child === parentB.child) {
      for (parentB = parentA.child;parentB; ) {
        if (parentB === a)
          return assertIsMounted(parentA), fiber;
        if (parentB === b)
          return assertIsMounted(parentA), alternate;
        parentB = parentB.sibling;
      }
      throw Error(formatProdErrorMessage(188));
    }
    if (a.return !== b.return)
      a = parentA, b = parentB;
    else {
      for (var didFindChild = false, child$0 = parentA.child;child$0; ) {
        if (child$0 === a) {
          didFindChild = true;
          a = parentA;
          b = parentB;
          break;
        }
        if (child$0 === b) {
          didFindChild = true;
          b = parentA;
          a = parentB;
          break;
        }
        child$0 = child$0.sibling;
      }
      if (!didFindChild) {
        for (child$0 = parentB.child;child$0; ) {
          if (child$0 === a) {
            didFindChild = true;
            a = parentB;
            b = parentA;
            break;
          }
          if (child$0 === b) {
            didFindChild = true;
            b = parentB;
            a = parentA;
            break;
          }
          child$0 = child$0.sibling;
        }
        if (!didFindChild)
          throw Error(formatProdErrorMessage(189));
      }
    }
    if (a.alternate !== b)
      throw Error(formatProdErrorMessage(190));
  }
  if (a.tag !== 3)
    throw Error(formatProdErrorMessage(188));
  return a.stateNode.current === a ? fiber : alternate;
}
function findCurrentHostFiberImpl(node) {
  var tag = node.tag;
  if (tag === 5 || tag === 26 || tag === 27 || tag === 6)
    return node;
  for (node = node.child;node !== null; ) {
    tag = findCurrentHostFiberImpl(node);
    if (tag !== null)
      return tag;
    node = node.sibling;
  }
  return null;
}
function getIteratorFn(maybeIterable) {
  if (maybeIterable === null || typeof maybeIterable !== "object")
    return null;
  maybeIterable = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable["@@iterator"];
  return typeof maybeIterable === "function" ? maybeIterable : null;
}
function getComponentNameFromType(type) {
  if (type == null)
    return null;
  if (typeof type === "function")
    return type.$$typeof === REACT_CLIENT_REFERENCE ? null : type.displayName || type.name || null;
  if (typeof type === "string")
    return type;
  switch (type) {
    case REACT_FRAGMENT_TYPE:
      return "Fragment";
    case REACT_PROFILER_TYPE:
      return "Profiler";
    case REACT_STRICT_MODE_TYPE:
      return "StrictMode";
    case REACT_SUSPENSE_TYPE:
      return "Suspense";
    case REACT_SUSPENSE_LIST_TYPE:
      return "SuspenseList";
    case REACT_ACTIVITY_TYPE:
      return "Activity";
  }
  if (typeof type === "object")
    switch (type.$$typeof) {
      case REACT_PORTAL_TYPE:
        return "Portal";
      case REACT_CONTEXT_TYPE:
        return type.displayName || "Context";
      case REACT_CONSUMER_TYPE:
        return (type._context.displayName || "Context") + ".Consumer";
      case REACT_FORWARD_REF_TYPE:
        var innerType = type.render;
        type = type.displayName;
        type || (type = innerType.displayName || innerType.name || "", type = type !== "" ? "ForwardRef(" + type + ")" : "ForwardRef");
        return type;
      case REACT_MEMO_TYPE:
        return innerType = type.displayName || null, innerType !== null ? innerType : getComponentNameFromType(type.type) || "Memo";
      case REACT_LAZY_TYPE:
        innerType = type._payload;
        type = type._init;
        try {
          return getComponentNameFromType(type(innerType));
        } catch (x) {}
    }
  return null;
}
function getComponentNameFromFiber(fiber) {
  var type = fiber.type;
  switch (fiber.tag) {
    case 31:
      return "Activity";
    case 24:
      return "Cache";
    case 9:
      return (type._context.displayName || "Context") + ".Consumer";
    case 10:
      return type.displayName || "Context";
    case 18:
      return "DehydratedFragment";
    case 11:
      return fiber = type.render, fiber = fiber.displayName || fiber.name || "", type.displayName || (fiber !== "" ? "ForwardRef(" + fiber + ")" : "ForwardRef");
    case 7:
      return "Fragment";
    case 26:
    case 27:
    case 5:
      return type;
    case 4:
      return "Portal";
    case 3:
      return "Root";
    case 6:
      return "Text";
    case 16:
      return getComponentNameFromType(type);
    case 8:
      return type === REACT_STRICT_MODE_TYPE ? "StrictMode" : "Mode";
    case 22:
      return "Offscreen";
    case 12:
      return "Profiler";
    case 21:
      return "Scope";
    case 13:
      return "Suspense";
    case 19:
      return "SuspenseList";
    case 25:
      return "TracingMarker";
    case 1:
    case 0:
    case 14:
    case 15:
      if (typeof type === "function")
        return type.displayName || type.name || null;
      if (typeof type === "string")
        return type;
  }
  return null;
}
function createCursor(defaultValue) {
  return { current: defaultValue };
}
function pop2(cursor) {
  0 > index || (cursor.current = valueStack[index], valueStack[index] = null, index--);
}
function push2(cursor, value) {
  index++;
  valueStack[index] = cursor.current;
  cursor.current = value;
}
function pushHostContainer(fiber, nextRootInstance) {
  push2(rootInstanceStackCursor, nextRootInstance);
  push2(contextFiberStackCursor, fiber);
  push2(contextStackCursor, null);
  switch (nextRootInstance.nodeType) {
    case 9:
    case 11:
      fiber = (fiber = nextRootInstance.documentElement) ? (fiber = fiber.namespaceURI) ? getOwnHostContext(fiber) : 0 : 0;
      break;
    default:
      if (fiber = nextRootInstance.tagName, nextRootInstance = nextRootInstance.namespaceURI)
        nextRootInstance = getOwnHostContext(nextRootInstance), fiber = getChildHostContextProd(nextRootInstance, fiber);
      else
        switch (fiber) {
          case "svg":
            fiber = 1;
            break;
          case "math":
            fiber = 2;
            break;
          default:
            fiber = 0;
        }
  }
  pop2(contextStackCursor);
  push2(contextStackCursor, fiber);
}
function popHostContainer() {
  pop2(contextStackCursor);
  pop2(contextFiberStackCursor);
  pop2(rootInstanceStackCursor);
}
function pushHostContext(fiber) {
  fiber.memoizedState !== null && push2(hostTransitionProviderCursor, fiber);
  var context = contextStackCursor.current;
  var JSCompiler_inline_result = getChildHostContextProd(context, fiber.type);
  context !== JSCompiler_inline_result && (push2(contextFiberStackCursor, fiber), push2(contextStackCursor, JSCompiler_inline_result));
}
function popHostContext(fiber) {
  contextFiberStackCursor.current === fiber && (pop2(contextStackCursor), pop2(contextFiberStackCursor));
  hostTransitionProviderCursor.current === fiber && (pop2(hostTransitionProviderCursor), HostTransitionContext._currentValue = sharedNotPendingObject);
}
function describeBuiltInComponentFrame(name) {
  if (prefix === undefined)
    try {
      throw Error();
    } catch (x) {
      var match = x.stack.trim().match(/\n( *(at )?)/);
      prefix = match && match[1] || "";
      suffix = -1 < x.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < x.stack.indexOf("@") ? "@unknown:0:0" : "";
    }
  return `
` + prefix + name + suffix;
}
function describeNativeComponentFrame(fn, construct) {
  if (!fn || reentry)
    return "";
  reentry = true;
  var previousPrepareStackTrace = Error.prepareStackTrace;
  Error.prepareStackTrace = undefined;
  try {
    var RunInRootFrame = {
      DetermineComponentFrameRoot: function() {
        try {
          if (construct) {
            var Fake = function() {
              throw Error();
            };
            Object.defineProperty(Fake.prototype, "props", {
              set: function() {
                throw Error();
              }
            });
            if (typeof Reflect === "object" && Reflect.construct) {
              try {
                Reflect.construct(Fake, []);
              } catch (x) {
                var control = x;
              }
              Reflect.construct(fn, [], Fake);
            } else {
              try {
                Fake.call();
              } catch (x$1) {
                control = x$1;
              }
              fn.call(Fake.prototype);
            }
          } else {
            try {
              throw Error();
            } catch (x$2) {
              control = x$2;
            }
            (Fake = fn()) && typeof Fake.catch === "function" && Fake.catch(function() {});
          }
        } catch (sample) {
          if (sample && control && typeof sample.stack === "string")
            return [sample.stack, control.stack];
        }
        return [null, null];
      }
    };
    RunInRootFrame.DetermineComponentFrameRoot.displayName = "DetermineComponentFrameRoot";
    var namePropDescriptor = Object.getOwnPropertyDescriptor(RunInRootFrame.DetermineComponentFrameRoot, "name");
    namePropDescriptor && namePropDescriptor.configurable && Object.defineProperty(RunInRootFrame.DetermineComponentFrameRoot, "name", { value: "DetermineComponentFrameRoot" });
    var _RunInRootFrame$Deter = RunInRootFrame.DetermineComponentFrameRoot(), sampleStack = _RunInRootFrame$Deter[0], controlStack = _RunInRootFrame$Deter[1];
    if (sampleStack && controlStack) {
      var sampleLines = sampleStack.split(`
`), controlLines = controlStack.split(`
`);
      for (namePropDescriptor = RunInRootFrame = 0;RunInRootFrame < sampleLines.length && !sampleLines[RunInRootFrame].includes("DetermineComponentFrameRoot"); )
        RunInRootFrame++;
      for (;namePropDescriptor < controlLines.length && !controlLines[namePropDescriptor].includes("DetermineComponentFrameRoot"); )
        namePropDescriptor++;
      if (RunInRootFrame === sampleLines.length || namePropDescriptor === controlLines.length)
        for (RunInRootFrame = sampleLines.length - 1, namePropDescriptor = controlLines.length - 1;1 <= RunInRootFrame && 0 <= namePropDescriptor && sampleLines[RunInRootFrame] !== controlLines[namePropDescriptor]; )
          namePropDescriptor--;
      for (;1 <= RunInRootFrame && 0 <= namePropDescriptor; RunInRootFrame--, namePropDescriptor--)
        if (sampleLines[RunInRootFrame] !== controlLines[namePropDescriptor]) {
          if (RunInRootFrame !== 1 || namePropDescriptor !== 1) {
            do
              if (RunInRootFrame--, namePropDescriptor--, 0 > namePropDescriptor || sampleLines[RunInRootFrame] !== controlLines[namePropDescriptor]) {
                var frame = `
` + sampleLines[RunInRootFrame].replace(" at new ", " at ");
                fn.displayName && frame.includes("<anonymous>") && (frame = frame.replace("<anonymous>", fn.displayName));
                return frame;
              }
            while (1 <= RunInRootFrame && 0 <= namePropDescriptor);
          }
          break;
        }
    }
  } finally {
    reentry = false, Error.prepareStackTrace = previousPrepareStackTrace;
  }
  return (previousPrepareStackTrace = fn ? fn.displayName || fn.name : "") ? describeBuiltInComponentFrame(previousPrepareStackTrace) : "";
}
function describeFiber(fiber, childFiber) {
  switch (fiber.tag) {
    case 26:
    case 27:
    case 5:
      return describeBuiltInComponentFrame(fiber.type);
    case 16:
      return describeBuiltInComponentFrame("Lazy");
    case 13:
      return fiber.child !== childFiber && childFiber !== null ? describeBuiltInComponentFrame("Suspense Fallback") : describeBuiltInComponentFrame("Suspense");
    case 19:
      return describeBuiltInComponentFrame("SuspenseList");
    case 0:
    case 15:
      return describeNativeComponentFrame(fiber.type, false);
    case 11:
      return describeNativeComponentFrame(fiber.type.render, false);
    case 1:
      return describeNativeComponentFrame(fiber.type, true);
    case 31:
      return describeBuiltInComponentFrame("Activity");
    default:
      return "";
  }
}
function getStackByFiberInDevAndProd(workInProgress) {
  try {
    var info = "", previous = null;
    do
      info += describeFiber(workInProgress, previous), previous = workInProgress, workInProgress = workInProgress.return;
    while (workInProgress);
    return info;
  } catch (x) {
    return `
Error generating stack: ` + x.message + `
` + x.stack;
  }
}
function setIsStrictModeForDevtools(newIsStrictMode) {
  typeof log$1 === "function" && unstable_setDisableYieldValue2(newIsStrictMode);
  if (injectedHook && typeof injectedHook.setStrictMode === "function")
    try {
      injectedHook.setStrictMode(rendererID, newIsStrictMode);
    } catch (err) {}
}
function clz32Fallback(x) {
  x >>>= 0;
  return x === 0 ? 32 : 31 - (log2(x) / LN2 | 0) | 0;
}
function getHighestPriorityLanes(lanes) {
  var pendingSyncLanes = lanes & 42;
  if (pendingSyncLanes !== 0)
    return pendingSyncLanes;
  switch (lanes & -lanes) {
    case 1:
      return 1;
    case 2:
      return 2;
    case 4:
      return 4;
    case 8:
      return 8;
    case 16:
      return 16;
    case 32:
      return 32;
    case 64:
      return 64;
    case 128:
      return 128;
    case 256:
    case 512:
    case 1024:
    case 2048:
    case 4096:
    case 8192:
    case 16384:
    case 32768:
    case 65536:
    case 131072:
      return lanes & 261888;
    case 262144:
    case 524288:
    case 1048576:
    case 2097152:
      return lanes & 3932160;
    case 4194304:
    case 8388608:
    case 16777216:
    case 33554432:
      return lanes & 62914560;
    case 67108864:
      return 67108864;
    case 134217728:
      return 134217728;
    case 268435456:
      return 268435456;
    case 536870912:
      return 536870912;
    case 1073741824:
      return 0;
    default:
      return lanes;
  }
}
function getNextLanes(root, wipLanes, rootHasPendingCommit) {
  var pendingLanes = root.pendingLanes;
  if (pendingLanes === 0)
    return 0;
  var nextLanes = 0, suspendedLanes = root.suspendedLanes, pingedLanes = root.pingedLanes;
  root = root.warmLanes;
  var nonIdlePendingLanes = pendingLanes & 134217727;
  nonIdlePendingLanes !== 0 ? (pendingLanes = nonIdlePendingLanes & ~suspendedLanes, pendingLanes !== 0 ? nextLanes = getHighestPriorityLanes(pendingLanes) : (pingedLanes &= nonIdlePendingLanes, pingedLanes !== 0 ? nextLanes = getHighestPriorityLanes(pingedLanes) : rootHasPendingCommit || (rootHasPendingCommit = nonIdlePendingLanes & ~root, rootHasPendingCommit !== 0 && (nextLanes = getHighestPriorityLanes(rootHasPendingCommit))))) : (nonIdlePendingLanes = pendingLanes & ~suspendedLanes, nonIdlePendingLanes !== 0 ? nextLanes = getHighestPriorityLanes(nonIdlePendingLanes) : pingedLanes !== 0 ? nextLanes = getHighestPriorityLanes(pingedLanes) : rootHasPendingCommit || (rootHasPendingCommit = pendingLanes & ~root, rootHasPendingCommit !== 0 && (nextLanes = getHighestPriorityLanes(rootHasPendingCommit))));
  return nextLanes === 0 ? 0 : wipLanes !== 0 && wipLanes !== nextLanes && (wipLanes & suspendedLanes) === 0 && (suspendedLanes = nextLanes & -nextLanes, rootHasPendingCommit = wipLanes & -wipLanes, suspendedLanes >= rootHasPendingCommit || suspendedLanes === 32 && (rootHasPendingCommit & 4194048) !== 0) ? wipLanes : nextLanes;
}
function checkIfRootIsPrerendering(root, renderLanes) {
  return (root.pendingLanes & ~(root.suspendedLanes & ~root.pingedLanes) & renderLanes) === 0;
}
function computeExpirationTime(lane, currentTime) {
  switch (lane) {
    case 1:
    case 2:
    case 4:
    case 8:
    case 64:
      return currentTime + 250;
    case 16:
    case 32:
    case 128:
    case 256:
    case 512:
    case 1024:
    case 2048:
    case 4096:
    case 8192:
    case 16384:
    case 32768:
    case 65536:
    case 131072:
    case 262144:
    case 524288:
    case 1048576:
    case 2097152:
      return currentTime + 5000;
    case 4194304:
    case 8388608:
    case 16777216:
    case 33554432:
      return -1;
    case 67108864:
    case 134217728:
    case 268435456:
    case 536870912:
    case 1073741824:
      return -1;
    default:
      return -1;
  }
}
function claimNextRetryLane() {
  var lane = nextRetryLane;
  nextRetryLane <<= 1;
  (nextRetryLane & 62914560) === 0 && (nextRetryLane = 4194304);
  return lane;
}
function createLaneMap(initial) {
  for (var laneMap = [], i = 0;31 > i; i++)
    laneMap.push(initial);
  return laneMap;
}
function markRootUpdated$1(root, updateLane) {
  root.pendingLanes |= updateLane;
  updateLane !== 268435456 && (root.suspendedLanes = 0, root.pingedLanes = 0, root.warmLanes = 0);
}
function markRootFinished(root, finishedLanes, remainingLanes, spawnedLane, updatedLanes, suspendedRetryLanes) {
  var previouslyPendingLanes = root.pendingLanes;
  root.pendingLanes = remainingLanes;
  root.suspendedLanes = 0;
  root.pingedLanes = 0;
  root.warmLanes = 0;
  root.expiredLanes &= remainingLanes;
  root.entangledLanes &= remainingLanes;
  root.errorRecoveryDisabledLanes &= remainingLanes;
  root.shellSuspendCounter = 0;
  var { entanglements, expirationTimes, hiddenUpdates } = root;
  for (remainingLanes = previouslyPendingLanes & ~remainingLanes;0 < remainingLanes; ) {
    var index$7 = 31 - clz32(remainingLanes), lane = 1 << index$7;
    entanglements[index$7] = 0;
    expirationTimes[index$7] = -1;
    var hiddenUpdatesForLane = hiddenUpdates[index$7];
    if (hiddenUpdatesForLane !== null)
      for (hiddenUpdates[index$7] = null, index$7 = 0;index$7 < hiddenUpdatesForLane.length; index$7++) {
        var update = hiddenUpdatesForLane[index$7];
        update !== null && (update.lane &= -536870913);
      }
    remainingLanes &= ~lane;
  }
  spawnedLane !== 0 && markSpawnedDeferredLane(root, spawnedLane, 0);
  suspendedRetryLanes !== 0 && updatedLanes === 0 && root.tag !== 0 && (root.suspendedLanes |= suspendedRetryLanes & ~(previouslyPendingLanes & ~finishedLanes));
}
function markSpawnedDeferredLane(root, spawnedLane, entangledLanes) {
  root.pendingLanes |= spawnedLane;
  root.suspendedLanes &= ~spawnedLane;
  var spawnedLaneIndex = 31 - clz32(spawnedLane);
  root.entangledLanes |= spawnedLane;
  root.entanglements[spawnedLaneIndex] = root.entanglements[spawnedLaneIndex] | 1073741824 | entangledLanes & 261930;
}
function markRootEntangled(root, entangledLanes) {
  var rootEntangledLanes = root.entangledLanes |= entangledLanes;
  for (root = root.entanglements;rootEntangledLanes; ) {
    var index$8 = 31 - clz32(rootEntangledLanes), lane = 1 << index$8;
    lane & entangledLanes | root[index$8] & entangledLanes && (root[index$8] |= entangledLanes);
    rootEntangledLanes &= ~lane;
  }
}
function getBumpedLaneForHydration(root, renderLanes) {
  var renderLane = renderLanes & -renderLanes;
  renderLane = (renderLane & 42) !== 0 ? 1 : getBumpedLaneForHydrationByLane(renderLane);
  return (renderLane & (root.suspendedLanes | renderLanes)) !== 0 ? 0 : renderLane;
}
function getBumpedLaneForHydrationByLane(lane) {
  switch (lane) {
    case 2:
      lane = 1;
      break;
    case 8:
      lane = 4;
      break;
    case 32:
      lane = 16;
      break;
    case 256:
    case 512:
    case 1024:
    case 2048:
    case 4096:
    case 8192:
    case 16384:
    case 32768:
    case 65536:
    case 131072:
    case 262144:
    case 524288:
    case 1048576:
    case 2097152:
    case 4194304:
    case 8388608:
    case 16777216:
    case 33554432:
      lane = 128;
      break;
    case 268435456:
      lane = 134217728;
      break;
    default:
      lane = 0;
  }
  return lane;
}
function addFiberToLanesMap(root, fiber, lanes) {
  if (isDevToolsPresent)
    for (root = root.pendingUpdatersLaneMap;0 < lanes; ) {
      var index$10 = 31 - clz32(lanes), lane = 1 << index$10;
      root[index$10].add(fiber);
      lanes &= ~lane;
    }
}
function movePendingFibersToMemoized(root, lanes) {
  if (isDevToolsPresent)
    for (var { pendingUpdatersLaneMap, memoizedUpdaters } = root;0 < lanes; ) {
      var index$11 = 31 - clz32(lanes);
      root = 1 << index$11;
      index$11 = pendingUpdatersLaneMap[index$11];
      0 < index$11.size && (index$11.forEach(function(fiber) {
        var alternate = fiber.alternate;
        alternate !== null && memoizedUpdaters.has(alternate) || memoizedUpdaters.add(fiber);
      }), index$11.clear());
      lanes &= ~root;
    }
}
function lanesToEventPriority(lanes) {
  lanes &= -lanes;
  return 2 < lanes ? 8 < lanes ? (lanes & 134217727) !== 0 ? 32 : 268435456 : 8 : 2;
}
function resolveUpdatePriority() {
  var updatePriority = ReactDOMSharedInternals.p;
  if (updatePriority !== 0)
    return updatePriority;
  updatePriority = window.event;
  return updatePriority === undefined ? 32 : getEventPriority(updatePriority.type);
}
function runWithPriority(priority, fn) {
  var previousPriority = ReactDOMSharedInternals.p;
  try {
    return ReactDOMSharedInternals.p = priority, fn();
  } finally {
    ReactDOMSharedInternals.p = previousPriority;
  }
}
function detachDeletedInstance(node) {
  delete node[internalInstanceKey];
  delete node[internalPropsKey];
  delete node[internalEventHandlersKey];
  delete node[internalEventHandlerListenersKey];
  delete node[internalEventHandlesSetKey];
}
function getClosestInstanceFromNode(targetNode) {
  var targetInst = targetNode[internalInstanceKey];
  if (targetInst)
    return targetInst;
  for (var parentNode = targetNode.parentNode;parentNode; ) {
    if (targetInst = parentNode[internalContainerInstanceKey] || parentNode[internalInstanceKey]) {
      parentNode = targetInst.alternate;
      if (targetInst.child !== null || parentNode !== null && parentNode.child !== null)
        for (targetNode = getParentHydrationBoundary(targetNode);targetNode !== null; ) {
          if (parentNode = targetNode[internalInstanceKey])
            return parentNode;
          targetNode = getParentHydrationBoundary(targetNode);
        }
      return targetInst;
    }
    targetNode = parentNode;
    parentNode = targetNode.parentNode;
  }
  return null;
}
function getInstanceFromNode(node) {
  if (node = node[internalInstanceKey] || node[internalContainerInstanceKey]) {
    var tag = node.tag;
    if (tag === 5 || tag === 6 || tag === 13 || tag === 31 || tag === 26 || tag === 27 || tag === 3)
      return node;
  }
  return null;
}
function getNodeFromInstance(inst) {
  var tag = inst.tag;
  if (tag === 5 || tag === 26 || tag === 27 || tag === 6)
    return inst.stateNode;
  throw Error(formatProdErrorMessage(33));
}
function getResourcesFromRoot(root) {
  var resources = root[internalRootNodeResourcesKey];
  resources || (resources = root[internalRootNodeResourcesKey] = { hoistableStyles: new Map, hoistableScripts: new Map });
  return resources;
}
function markNodeAsHoistable(node) {
  node[internalHoistableMarker] = true;
}
function registerTwoPhaseEvent(registrationName, dependencies) {
  registerDirectEvent(registrationName, dependencies);
  registerDirectEvent(registrationName + "Capture", dependencies);
}
function registerDirectEvent(registrationName, dependencies) {
  registrationNameDependencies[registrationName] = dependencies;
  for (registrationName = 0;registrationName < dependencies.length; registrationName++)
    allNativeEvents.add(dependencies[registrationName]);
}
function isAttributeNameSafe(attributeName) {
  if (hasOwnProperty.call(validatedAttributeNameCache, attributeName))
    return true;
  if (hasOwnProperty.call(illegalAttributeNameCache, attributeName))
    return false;
  if (VALID_ATTRIBUTE_NAME_REGEX.test(attributeName))
    return validatedAttributeNameCache[attributeName] = true;
  illegalAttributeNameCache[attributeName] = true;
  return false;
}
function setValueForAttribute(node, name, value) {
  if (isAttributeNameSafe(name))
    if (value === null)
      node.removeAttribute(name);
    else {
      switch (typeof value) {
        case "undefined":
        case "function":
        case "symbol":
          node.removeAttribute(name);
          return;
        case "boolean":
          var prefix$12 = name.toLowerCase().slice(0, 5);
          if (prefix$12 !== "data-" && prefix$12 !== "aria-") {
            node.removeAttribute(name);
            return;
          }
      }
      node.setAttribute(name, "" + value);
    }
}
function setValueForKnownAttribute(node, name, value) {
  if (value === null)
    node.removeAttribute(name);
  else {
    switch (typeof value) {
      case "undefined":
      case "function":
      case "symbol":
      case "boolean":
        node.removeAttribute(name);
        return;
    }
    node.setAttribute(name, "" + value);
  }
}
function setValueForNamespacedAttribute(node, namespace, name, value) {
  if (value === null)
    node.removeAttribute(name);
  else {
    switch (typeof value) {
      case "undefined":
      case "function":
      case "symbol":
      case "boolean":
        node.removeAttribute(name);
        return;
    }
    node.setAttributeNS(namespace, name, "" + value);
  }
}
function getToStringValue(value) {
  switch (typeof value) {
    case "bigint":
    case "boolean":
    case "number":
    case "string":
    case "undefined":
      return value;
    case "object":
      return value;
    default:
      return "";
  }
}
function isCheckable(elem) {
  var type = elem.type;
  return (elem = elem.nodeName) && elem.toLowerCase() === "input" && (type === "checkbox" || type === "radio");
}
function trackValueOnNode(node, valueField, currentValue) {
  var descriptor = Object.getOwnPropertyDescriptor(node.constructor.prototype, valueField);
  if (!node.hasOwnProperty(valueField) && typeof descriptor !== "undefined" && typeof descriptor.get === "function" && typeof descriptor.set === "function") {
    var { get: get2, set: set2 } = descriptor;
    Object.defineProperty(node, valueField, {
      configurable: true,
      get: function() {
        return get2.call(this);
      },
      set: function(value) {
        currentValue = "" + value;
        set2.call(this, value);
      }
    });
    Object.defineProperty(node, valueField, {
      enumerable: descriptor.enumerable
    });
    return {
      getValue: function() {
        return currentValue;
      },
      setValue: function(value) {
        currentValue = "" + value;
      },
      stopTracking: function() {
        node._valueTracker = null;
        delete node[valueField];
      }
    };
  }
}
function track(node) {
  if (!node._valueTracker) {
    var valueField = isCheckable(node) ? "checked" : "value";
    node._valueTracker = trackValueOnNode(node, valueField, "" + node[valueField]);
  }
}
function updateValueIfChanged(node) {
  if (!node)
    return false;
  var tracker = node._valueTracker;
  if (!tracker)
    return true;
  var lastValue = tracker.getValue();
  var value = "";
  node && (value = isCheckable(node) ? node.checked ? "true" : "false" : node.value);
  node = value;
  return node !== lastValue ? (tracker.setValue(node), true) : false;
}
function getActiveElement(doc) {
  doc = doc || (typeof document !== "undefined" ? document : undefined);
  if (typeof doc === "undefined")
    return null;
  try {
    return doc.activeElement || doc.body;
  } catch (e) {
    return doc.body;
  }
}
function escapeSelectorAttributeValueInsideDoubleQuotes(value) {
  return value.replace(escapeSelectorAttributeValueInsideDoubleQuotesRegex, function(ch) {
    return "\\" + ch.charCodeAt(0).toString(16) + " ";
  });
}
function updateInput(element, value, defaultValue, lastDefaultValue, checked, defaultChecked, type, name) {
  element.name = "";
  type != null && typeof type !== "function" && typeof type !== "symbol" && typeof type !== "boolean" ? element.type = type : element.removeAttribute("type");
  if (value != null)
    if (type === "number") {
      if (value === 0 && element.value === "" || element.value != value)
        element.value = "" + getToStringValue(value);
    } else
      element.value !== "" + getToStringValue(value) && (element.value = "" + getToStringValue(value));
  else
    type !== "submit" && type !== "reset" || element.removeAttribute("value");
  value != null ? setDefaultValue(element, type, getToStringValue(value)) : defaultValue != null ? setDefaultValue(element, type, getToStringValue(defaultValue)) : lastDefaultValue != null && element.removeAttribute("value");
  checked == null && defaultChecked != null && (element.defaultChecked = !!defaultChecked);
  checked != null && (element.checked = checked && typeof checked !== "function" && typeof checked !== "symbol");
  name != null && typeof name !== "function" && typeof name !== "symbol" && typeof name !== "boolean" ? element.name = "" + getToStringValue(name) : element.removeAttribute("name");
}
function initInput(element, value, defaultValue, checked, defaultChecked, type, name, isHydrating) {
  type != null && typeof type !== "function" && typeof type !== "symbol" && typeof type !== "boolean" && (element.type = type);
  if (value != null || defaultValue != null) {
    if (!(type !== "submit" && type !== "reset" || value !== undefined && value !== null)) {
      track(element);
      return;
    }
    defaultValue = defaultValue != null ? "" + getToStringValue(defaultValue) : "";
    value = value != null ? "" + getToStringValue(value) : defaultValue;
    isHydrating || value === element.value || (element.value = value);
    element.defaultValue = value;
  }
  checked = checked != null ? checked : defaultChecked;
  checked = typeof checked !== "function" && typeof checked !== "symbol" && !!checked;
  element.checked = isHydrating ? element.checked : !!checked;
  element.defaultChecked = !!checked;
  name != null && typeof name !== "function" && typeof name !== "symbol" && typeof name !== "boolean" && (element.name = name);
  track(element);
}
function setDefaultValue(node, type, value) {
  type === "number" && getActiveElement(node.ownerDocument) === node || node.defaultValue === "" + value || (node.defaultValue = "" + value);
}
function updateOptions(node, multiple, propValue, setDefaultSelected) {
  node = node.options;
  if (multiple) {
    multiple = {};
    for (var i = 0;i < propValue.length; i++)
      multiple["$" + propValue[i]] = true;
    for (propValue = 0;propValue < node.length; propValue++)
      i = multiple.hasOwnProperty("$" + node[propValue].value), node[propValue].selected !== i && (node[propValue].selected = i), i && setDefaultSelected && (node[propValue].defaultSelected = true);
  } else {
    propValue = "" + getToStringValue(propValue);
    multiple = null;
    for (i = 0;i < node.length; i++) {
      if (node[i].value === propValue) {
        node[i].selected = true;
        setDefaultSelected && (node[i].defaultSelected = true);
        return;
      }
      multiple !== null || node[i].disabled || (multiple = node[i]);
    }
    multiple !== null && (multiple.selected = true);
  }
}
function updateTextarea(element, value, defaultValue) {
  if (value != null && (value = "" + getToStringValue(value), value !== element.value && (element.value = value), defaultValue == null)) {
    element.defaultValue !== value && (element.defaultValue = value);
    return;
  }
  element.defaultValue = defaultValue != null ? "" + getToStringValue(defaultValue) : "";
}
function initTextarea(element, value, defaultValue, children) {
  if (value == null) {
    if (children != null) {
      if (defaultValue != null)
        throw Error(formatProdErrorMessage(92));
      if (isArrayImpl(children)) {
        if (1 < children.length)
          throw Error(formatProdErrorMessage(93));
        children = children[0];
      }
      defaultValue = children;
    }
    defaultValue == null && (defaultValue = "");
    value = defaultValue;
  }
  defaultValue = getToStringValue(value);
  element.defaultValue = defaultValue;
  children = element.textContent;
  children === defaultValue && children !== "" && children !== null && (element.value = children);
  track(element);
}
function setTextContent(node, text) {
  if (text) {
    var firstChild = node.firstChild;
    if (firstChild && firstChild === node.lastChild && firstChild.nodeType === 3) {
      firstChild.nodeValue = text;
      return;
    }
  }
  node.textContent = text;
}
function setValueForStyle(style, styleName, value) {
  var isCustomProperty = styleName.indexOf("--") === 0;
  value == null || typeof value === "boolean" || value === "" ? isCustomProperty ? style.setProperty(styleName, "") : styleName === "float" ? style.cssFloat = "" : style[styleName] = "" : isCustomProperty ? style.setProperty(styleName, value) : typeof value !== "number" || value === 0 || unitlessNumbers.has(styleName) ? styleName === "float" ? style.cssFloat = value : style[styleName] = ("" + value).trim() : style[styleName] = value + "px";
}
function setValueForStyles(node, styles, prevStyles) {
  if (styles != null && typeof styles !== "object")
    throw Error(formatProdErrorMessage(62));
  node = node.style;
  if (prevStyles != null) {
    for (var styleName in prevStyles)
      !prevStyles.hasOwnProperty(styleName) || styles != null && styles.hasOwnProperty(styleName) || (styleName.indexOf("--") === 0 ? node.setProperty(styleName, "") : styleName === "float" ? node.cssFloat = "" : node[styleName] = "");
    for (var styleName$18 in styles)
      styleName = styles[styleName$18], styles.hasOwnProperty(styleName$18) && prevStyles[styleName$18] !== styleName && setValueForStyle(node, styleName$18, styleName);
  } else
    for (var styleName$19 in styles)
      styles.hasOwnProperty(styleName$19) && setValueForStyle(node, styleName$19, styles[styleName$19]);
}
function isCustomElement(tagName) {
  if (tagName.indexOf("-") === -1)
    return false;
  switch (tagName) {
    case "annotation-xml":
    case "color-profile":
    case "font-face":
    case "font-face-src":
    case "font-face-uri":
    case "font-face-format":
    case "font-face-name":
    case "missing-glyph":
      return false;
    default:
      return true;
  }
}
function sanitizeURL(url) {
  return isJavaScriptProtocol.test("" + url) ? "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')" : url;
}
function noop$1() {}
function getEventTarget(nativeEvent) {
  nativeEvent = nativeEvent.target || nativeEvent.srcElement || window;
  nativeEvent.correspondingUseElement && (nativeEvent = nativeEvent.correspondingUseElement);
  return nativeEvent.nodeType === 3 ? nativeEvent.parentNode : nativeEvent;
}
function restoreStateOfTarget(target) {
  var internalInstance = getInstanceFromNode(target);
  if (internalInstance && (target = internalInstance.stateNode)) {
    var props = target[internalPropsKey] || null;
    a:
      switch (target = internalInstance.stateNode, internalInstance.type) {
        case "input":
          updateInput(target, props.value, props.defaultValue, props.defaultValue, props.checked, props.defaultChecked, props.type, props.name);
          internalInstance = props.name;
          if (props.type === "radio" && internalInstance != null) {
            for (props = target;props.parentNode; )
              props = props.parentNode;
            props = props.querySelectorAll('input[name="' + escapeSelectorAttributeValueInsideDoubleQuotes("" + internalInstance) + '"][type="radio"]');
            for (internalInstance = 0;internalInstance < props.length; internalInstance++) {
              var otherNode = props[internalInstance];
              if (otherNode !== target && otherNode.form === target.form) {
                var otherProps = otherNode[internalPropsKey] || null;
                if (!otherProps)
                  throw Error(formatProdErrorMessage(90));
                updateInput(otherNode, otherProps.value, otherProps.defaultValue, otherProps.defaultValue, otherProps.checked, otherProps.defaultChecked, otherProps.type, otherProps.name);
              }
            }
            for (internalInstance = 0;internalInstance < props.length; internalInstance++)
              otherNode = props[internalInstance], otherNode.form === target.form && updateValueIfChanged(otherNode);
          }
          break a;
        case "textarea":
          updateTextarea(target, props.value, props.defaultValue);
          break a;
        case "select":
          internalInstance = props.value, internalInstance != null && updateOptions(target, !!props.multiple, internalInstance, false);
      }
  }
}
function batchedUpdates$2(fn, a, b) {
  if (isInsideEventHandler)
    return fn(a, b);
  isInsideEventHandler = true;
  try {
    var JSCompiler_inline_result = fn(a);
    return JSCompiler_inline_result;
  } finally {
    if (isInsideEventHandler = false, restoreTarget !== null || restoreQueue !== null) {
      if (flushSyncWork$1(), restoreTarget && (a = restoreTarget, fn = restoreQueue, restoreQueue = restoreTarget = null, restoreStateOfTarget(a), fn))
        for (a = 0;a < fn.length; a++)
          restoreStateOfTarget(fn[a]);
    }
  }
}
function getListener(inst, registrationName) {
  var stateNode = inst.stateNode;
  if (stateNode === null)
    return null;
  var props = stateNode[internalPropsKey] || null;
  if (props === null)
    return null;
  stateNode = props[registrationName];
  a:
    switch (registrationName) {
      case "onClick":
      case "onClickCapture":
      case "onDoubleClick":
      case "onDoubleClickCapture":
      case "onMouseDown":
      case "onMouseDownCapture":
      case "onMouseMove":
      case "onMouseMoveCapture":
      case "onMouseUp":
      case "onMouseUpCapture":
      case "onMouseEnter":
        (props = !props.disabled) || (inst = inst.type, props = !(inst === "button" || inst === "input" || inst === "select" || inst === "textarea"));
        inst = !props;
        break a;
      default:
        inst = false;
    }
  if (inst)
    return null;
  if (stateNode && typeof stateNode !== "function")
    throw Error(formatProdErrorMessage(231, registrationName, typeof stateNode));
  return stateNode;
}
function getData() {
  if (fallbackText)
    return fallbackText;
  var start, startValue = startText, startLength = startValue.length, end, endValue = "value" in root ? root.value : root.textContent, endLength = endValue.length;
  for (start = 0;start < startLength && startValue[start] === endValue[start]; start++)
    ;
  var minEnd = startLength - start;
  for (end = 1;end <= minEnd && startValue[startLength - end] === endValue[endLength - end]; end++)
    ;
  return fallbackText = endValue.slice(start, 1 < end ? 1 - end : undefined);
}
function getEventCharCode(nativeEvent) {
  var keyCode = nativeEvent.keyCode;
  "charCode" in nativeEvent ? (nativeEvent = nativeEvent.charCode, nativeEvent === 0 && keyCode === 13 && (nativeEvent = 13)) : nativeEvent = keyCode;
  nativeEvent === 10 && (nativeEvent = 13);
  return 32 <= nativeEvent || nativeEvent === 13 ? nativeEvent : 0;
}
function functionThatReturnsTrue() {
  return true;
}
function functionThatReturnsFalse() {
  return false;
}
function createSyntheticEvent(Interface) {
  function SyntheticBaseEvent(reactName, reactEventType, targetInst, nativeEvent, nativeEventTarget) {
    this._reactName = reactName;
    this._targetInst = targetInst;
    this.type = reactEventType;
    this.nativeEvent = nativeEvent;
    this.target = nativeEventTarget;
    this.currentTarget = null;
    for (var propName in Interface)
      Interface.hasOwnProperty(propName) && (reactName = Interface[propName], this[propName] = reactName ? reactName(nativeEvent) : nativeEvent[propName]);
    this.isDefaultPrevented = (nativeEvent.defaultPrevented != null ? nativeEvent.defaultPrevented : nativeEvent.returnValue === false) ? functionThatReturnsTrue : functionThatReturnsFalse;
    this.isPropagationStopped = functionThatReturnsFalse;
    return this;
  }
  assign(SyntheticBaseEvent.prototype, {
    preventDefault: function() {
      this.defaultPrevented = true;
      var event = this.nativeEvent;
      event && (event.preventDefault ? event.preventDefault() : typeof event.returnValue !== "unknown" && (event.returnValue = false), this.isDefaultPrevented = functionThatReturnsTrue);
    },
    stopPropagation: function() {
      var event = this.nativeEvent;
      event && (event.stopPropagation ? event.stopPropagation() : typeof event.cancelBubble !== "unknown" && (event.cancelBubble = true), this.isPropagationStopped = functionThatReturnsTrue);
    },
    persist: function() {},
    isPersistent: functionThatReturnsTrue
  });
  return SyntheticBaseEvent;
}
function modifierStateGetter(keyArg) {
  var nativeEvent = this.nativeEvent;
  return nativeEvent.getModifierState ? nativeEvent.getModifierState(keyArg) : (keyArg = modifierKeyToProp[keyArg]) ? !!nativeEvent[keyArg] : false;
}
function getEventModifierState() {
  return modifierStateGetter;
}
function isFallbackCompositionEnd(domEventName, nativeEvent) {
  switch (domEventName) {
    case "keyup":
      return END_KEYCODES.indexOf(nativeEvent.keyCode) !== -1;
    case "keydown":
      return nativeEvent.keyCode !== 229;
    case "keypress":
    case "mousedown":
    case "focusout":
      return true;
    default:
      return false;
  }
}
function getDataFromCustomEvent(nativeEvent) {
  nativeEvent = nativeEvent.detail;
  return typeof nativeEvent === "object" && "data" in nativeEvent ? nativeEvent.data : null;
}
function getNativeBeforeInputChars(domEventName, nativeEvent) {
  switch (domEventName) {
    case "compositionend":
      return getDataFromCustomEvent(nativeEvent);
    case "keypress":
      if (nativeEvent.which !== 32)
        return null;
      hasSpaceKeypress = true;
      return SPACEBAR_CHAR;
    case "textInput":
      return domEventName = nativeEvent.data, domEventName === SPACEBAR_CHAR && hasSpaceKeypress ? null : domEventName;
    default:
      return null;
  }
}
function getFallbackBeforeInputChars(domEventName, nativeEvent) {
  if (isComposing)
    return domEventName === "compositionend" || !canUseCompositionEvent && isFallbackCompositionEnd(domEventName, nativeEvent) ? (domEventName = getData(), fallbackText = startText = root = null, isComposing = false, domEventName) : null;
  switch (domEventName) {
    case "paste":
      return null;
    case "keypress":
      if (!(nativeEvent.ctrlKey || nativeEvent.altKey || nativeEvent.metaKey) || nativeEvent.ctrlKey && nativeEvent.altKey) {
        if (nativeEvent.char && 1 < nativeEvent.char.length)
          return nativeEvent.char;
        if (nativeEvent.which)
          return String.fromCharCode(nativeEvent.which);
      }
      return null;
    case "compositionend":
      return useFallbackCompositionData && nativeEvent.locale !== "ko" ? null : nativeEvent.data;
    default:
      return null;
  }
}
function isTextInputElement(elem) {
  var nodeName = elem && elem.nodeName && elem.nodeName.toLowerCase();
  return nodeName === "input" ? !!supportedInputTypes[elem.type] : nodeName === "textarea" ? true : false;
}
function createAndAccumulateChangeEvent(dispatchQueue, inst, nativeEvent, target) {
  restoreTarget ? restoreQueue ? restoreQueue.push(target) : restoreQueue = [target] : restoreTarget = target;
  inst = accumulateTwoPhaseListeners(inst, "onChange");
  0 < inst.length && (nativeEvent = new SyntheticEvent("onChange", "change", null, nativeEvent, target), dispatchQueue.push({ event: nativeEvent, listeners: inst }));
}
function runEventInBatch(dispatchQueue) {
  processDispatchQueue(dispatchQueue, 0);
}
function getInstIfValueChanged(targetInst) {
  var targetNode = getNodeFromInstance(targetInst);
  if (updateValueIfChanged(targetNode))
    return targetInst;
}
function getTargetInstForChangeEvent(domEventName, targetInst) {
  if (domEventName === "change")
    return targetInst;
}
function stopWatchingForValueChange() {
  activeElement$1 && (activeElement$1.detachEvent("onpropertychange", handlePropertyChange), activeElementInst$1 = activeElement$1 = null);
}
function handlePropertyChange(nativeEvent) {
  if (nativeEvent.propertyName === "value" && getInstIfValueChanged(activeElementInst$1)) {
    var dispatchQueue = [];
    createAndAccumulateChangeEvent(dispatchQueue, activeElementInst$1, nativeEvent, getEventTarget(nativeEvent));
    batchedUpdates$2(runEventInBatch, dispatchQueue);
  }
}
function handleEventsForInputEventPolyfill(domEventName, target, targetInst) {
  domEventName === "focusin" ? (stopWatchingForValueChange(), activeElement$1 = target, activeElementInst$1 = targetInst, activeElement$1.attachEvent("onpropertychange", handlePropertyChange)) : domEventName === "focusout" && stopWatchingForValueChange();
}
function getTargetInstForInputEventPolyfill(domEventName) {
  if (domEventName === "selectionchange" || domEventName === "keyup" || domEventName === "keydown")
    return getInstIfValueChanged(activeElementInst$1);
}
function getTargetInstForClickEvent(domEventName, targetInst) {
  if (domEventName === "click")
    return getInstIfValueChanged(targetInst);
}
function getTargetInstForInputOrChangeEvent(domEventName, targetInst) {
  if (domEventName === "input" || domEventName === "change")
    return getInstIfValueChanged(targetInst);
}
function is(x, y) {
  return x === y && (x !== 0 || 1 / x === 1 / y) || x !== x && y !== y;
}
function shallowEqual(objA, objB) {
  if (objectIs(objA, objB))
    return true;
  if (typeof objA !== "object" || objA === null || typeof objB !== "object" || objB === null)
    return false;
  var keysA = Object.keys(objA), keysB = Object.keys(objB);
  if (keysA.length !== keysB.length)
    return false;
  for (keysB = 0;keysB < keysA.length; keysB++) {
    var currentKey = keysA[keysB];
    if (!hasOwnProperty.call(objB, currentKey) || !objectIs(objA[currentKey], objB[currentKey]))
      return false;
  }
  return true;
}
function getLeafNode(node) {
  for (;node && node.firstChild; )
    node = node.firstChild;
  return node;
}
function getNodeForCharacterOffset(root2, offset) {
  var node = getLeafNode(root2);
  root2 = 0;
  for (var nodeEnd;node; ) {
    if (node.nodeType === 3) {
      nodeEnd = root2 + node.textContent.length;
      if (root2 <= offset && nodeEnd >= offset)
        return { node, offset: offset - root2 };
      root2 = nodeEnd;
    }
    a: {
      for (;node; ) {
        if (node.nextSibling) {
          node = node.nextSibling;
          break a;
        }
        node = node.parentNode;
      }
      node = undefined;
    }
    node = getLeafNode(node);
  }
}
function containsNode(outerNode, innerNode) {
  return outerNode && innerNode ? outerNode === innerNode ? true : outerNode && outerNode.nodeType === 3 ? false : innerNode && innerNode.nodeType === 3 ? containsNode(outerNode, innerNode.parentNode) : ("contains" in outerNode) ? outerNode.contains(innerNode) : outerNode.compareDocumentPosition ? !!(outerNode.compareDocumentPosition(innerNode) & 16) : false : false;
}
function getActiveElementDeep(containerInfo) {
  containerInfo = containerInfo != null && containerInfo.ownerDocument != null && containerInfo.ownerDocument.defaultView != null ? containerInfo.ownerDocument.defaultView : window;
  for (var element = getActiveElement(containerInfo.document);element instanceof containerInfo.HTMLIFrameElement; ) {
    try {
      var JSCompiler_inline_result = typeof element.contentWindow.location.href === "string";
    } catch (err) {
      JSCompiler_inline_result = false;
    }
    if (JSCompiler_inline_result)
      containerInfo = element.contentWindow;
    else
      break;
    element = getActiveElement(containerInfo.document);
  }
  return element;
}
function hasSelectionCapabilities(elem) {
  var nodeName = elem && elem.nodeName && elem.nodeName.toLowerCase();
  return nodeName && (nodeName === "input" && (elem.type === "text" || elem.type === "search" || elem.type === "tel" || elem.type === "url" || elem.type === "password") || nodeName === "textarea" || elem.contentEditable === "true");
}
function constructSelectEvent(dispatchQueue, nativeEvent, nativeEventTarget) {
  var doc = nativeEventTarget.window === nativeEventTarget ? nativeEventTarget.document : nativeEventTarget.nodeType === 9 ? nativeEventTarget : nativeEventTarget.ownerDocument;
  mouseDown || activeElement == null || activeElement !== getActiveElement(doc) || (doc = activeElement, ("selectionStart" in doc) && hasSelectionCapabilities(doc) ? doc = { start: doc.selectionStart, end: doc.selectionEnd } : (doc = (doc.ownerDocument && doc.ownerDocument.defaultView || window).getSelection(), doc = {
    anchorNode: doc.anchorNode,
    anchorOffset: doc.anchorOffset,
    focusNode: doc.focusNode,
    focusOffset: doc.focusOffset
  }), lastSelection && shallowEqual(lastSelection, doc) || (lastSelection = doc, doc = accumulateTwoPhaseListeners(activeElementInst, "onSelect"), 0 < doc.length && (nativeEvent = new SyntheticEvent("onSelect", "select", null, nativeEvent, nativeEventTarget), dispatchQueue.push({ event: nativeEvent, listeners: doc }), nativeEvent.target = activeElement)));
}
function makePrefixMap(styleProp, eventName) {
  var prefixes = {};
  prefixes[styleProp.toLowerCase()] = eventName.toLowerCase();
  prefixes["Webkit" + styleProp] = "webkit" + eventName;
  prefixes["Moz" + styleProp] = "moz" + eventName;
  return prefixes;
}
function getVendorPrefixedEventName(eventName) {
  if (prefixedEventNames[eventName])
    return prefixedEventNames[eventName];
  if (!vendorPrefixes[eventName])
    return eventName;
  var prefixMap = vendorPrefixes[eventName], styleProp;
  for (styleProp in prefixMap)
    if (prefixMap.hasOwnProperty(styleProp) && styleProp in style)
      return prefixedEventNames[eventName] = prefixMap[styleProp];
  return eventName;
}
function registerSimpleEvent(domEventName, reactName) {
  topLevelEventsToReactNames.set(domEventName, reactName);
  registerTwoPhaseEvent(reactName, [domEventName]);
}
function setCurrentTrackFromLanes(lanes) {
  currentTrack = lanes & 63 ? "Blocking" : lanes & 64 ? "Gesture" : lanes & 4194176 ? "Transition" : lanes & 62914560 ? "Suspense" : lanes & 2080374784 ? "Idle" : "Other";
}
function logComponentTrigger(fiber, startTime2, endTime, trigger) {
  supportsUserTiming && (reusableComponentOptions.start = startTime2, reusableComponentOptions.end = endTime, reusableComponentDevToolDetails.color = "warning", reusableComponentDevToolDetails.tooltipText = trigger, reusableComponentDevToolDetails.properties = null, performance.measure(trigger, reusableComponentOptions));
}
function logComponentReappeared(fiber, startTime2, endTime) {
  logComponentTrigger(fiber, startTime2, endTime, "Reconnect");
}
function logComponentRender(fiber, startTime2, endTime, wasHydrated) {
  var name = getComponentNameFromFiber(fiber);
  if (name !== null && supportsUserTiming) {
    var { alternate, actualDuration: selfTime } = fiber;
    if (alternate === null || alternate.child !== fiber.child)
      for (fiber = fiber.child;fiber !== null; fiber = fiber.sibling)
        selfTime -= fiber.actualDuration;
    console.timeStamp(name, startTime2, endTime, "Components ⚛", undefined, 0.5 > selfTime ? wasHydrated ? "tertiary-light" : "primary-light" : 10 > selfTime ? wasHydrated ? "tertiary" : "primary" : 100 > selfTime ? wasHydrated ? "tertiary-dark" : "primary-dark" : "error");
  }
}
function logComponentErrored(fiber, startTime2, endTime) {
  supportsUserTiming && (fiber = getComponentNameFromFiber(fiber), fiber !== null && console.timeStamp(fiber, startTime2, endTime, "Components ⚛", undefined, "error"));
}
function logComponentEffect(fiber, startTime2, endTime, selfTime, errors) {
  errors !== null ? supportsUserTiming && (selfTime = getComponentNameFromFiber(fiber), selfTime !== null && console.timeStamp(selfTime, startTime2, endTime, "Components ⚛", undefined, "error")) : (fiber = getComponentNameFromFiber(fiber), fiber !== null && supportsUserTiming && console.timeStamp(fiber, startTime2, endTime, "Components ⚛", undefined, 1 > selfTime ? "secondary-light" : 100 > selfTime ? "secondary" : 500 > selfTime ? "secondary-dark" : "error"));
}
function logSuspendedRenderPhase(startTime2, endTime, lanes) {
  !supportsUserTiming || endTime <= startTime2 || console.timeStamp("Prewarm", startTime2, endTime, currentTrack, "Scheduler ⚛", (lanes & 738197653) === lanes ? "tertiary-dark" : "primary-dark");
}
function logSuspendedWithDelayPhase(startTime2, endTime, lanes) {
  !supportsUserTiming || endTime <= startTime2 || console.timeStamp("Suspended", startTime2, endTime, currentTrack, "Scheduler ⚛", (lanes & 738197653) === lanes ? "tertiary-dark" : "primary-dark");
}
function logErroredRenderPhase(startTime2, endTime) {
  !supportsUserTiming || endTime <= startTime2 || console.timeStamp("Errored", startTime2, endTime, currentTrack, "Scheduler ⚛", "error");
}
function logCommitErrored(startTime2, endTime) {
  !supportsUserTiming || endTime <= startTime2 || console.timeStamp("Errored", startTime2, endTime, currentTrack, "Scheduler ⚛", "error");
}
function finishQueueingConcurrentUpdates() {
  for (var endIndex = concurrentQueuesIndex, i = concurrentlyUpdatedLanes = concurrentQueuesIndex = 0;i < endIndex; ) {
    var fiber = concurrentQueues[i];
    concurrentQueues[i++] = null;
    var queue = concurrentQueues[i];
    concurrentQueues[i++] = null;
    var update = concurrentQueues[i];
    concurrentQueues[i++] = null;
    var lane = concurrentQueues[i];
    concurrentQueues[i++] = null;
    if (queue !== null && update !== null) {
      var pending = queue.pending;
      pending === null ? update.next = update : (update.next = pending.next, pending.next = update);
      queue.pending = update;
    }
    lane !== 0 && markUpdateLaneFromFiberToRoot(fiber, update, lane);
  }
}
function enqueueUpdate$1(fiber, queue, update, lane) {
  concurrentQueues[concurrentQueuesIndex++] = fiber;
  concurrentQueues[concurrentQueuesIndex++] = queue;
  concurrentQueues[concurrentQueuesIndex++] = update;
  concurrentQueues[concurrentQueuesIndex++] = lane;
  concurrentlyUpdatedLanes |= lane;
  fiber.lanes |= lane;
  fiber = fiber.alternate;
  fiber !== null && (fiber.lanes |= lane);
}
function enqueueConcurrentHookUpdate(fiber, queue, update, lane) {
  enqueueUpdate$1(fiber, queue, update, lane);
  return getRootForUpdatedFiber(fiber);
}
function enqueueConcurrentRenderForLane(fiber, lane) {
  enqueueUpdate$1(fiber, null, null, lane);
  return getRootForUpdatedFiber(fiber);
}
function markUpdateLaneFromFiberToRoot(sourceFiber, update, lane) {
  sourceFiber.lanes |= lane;
  var alternate = sourceFiber.alternate;
  alternate !== null && (alternate.lanes |= lane);
  for (var isHidden = false, parent = sourceFiber.return;parent !== null; )
    parent.childLanes |= lane, alternate = parent.alternate, alternate !== null && (alternate.childLanes |= lane), parent.tag === 22 && (sourceFiber = parent.stateNode, sourceFiber === null || sourceFiber._visibility & 1 || (isHidden = true)), sourceFiber = parent, parent = parent.return;
  return sourceFiber.tag === 3 ? (parent = sourceFiber.stateNode, isHidden && update !== null && (isHidden = 31 - clz32(lane), sourceFiber = parent.hiddenUpdates, alternate = sourceFiber[isHidden], alternate === null ? sourceFiber[isHidden] = [update] : alternate.push(update), update.lane = lane | 536870912), parent) : null;
}
function getRootForUpdatedFiber(sourceFiber) {
  if (50 < nestedUpdateCount)
    throw nestedUpdateCount = 0, rootWithNestedUpdates = null, Error(formatProdErrorMessage(185));
  for (var parent = sourceFiber.return;parent !== null; )
    sourceFiber = parent, parent = sourceFiber.return;
  return sourceFiber.tag === 3 ? sourceFiber.stateNode : null;
}
function FiberNode(tag, pendingProps, key, mode) {
  this.tag = tag;
  this.key = key;
  this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null;
  this.index = 0;
  this.refCleanup = this.ref = null;
  this.pendingProps = pendingProps;
  this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null;
  this.mode = mode;
  this.subtreeFlags = this.flags = 0;
  this.deletions = null;
  this.childLanes = this.lanes = 0;
  this.alternate = null;
  this.actualDuration = -0;
  this.actualStartTime = -1.1;
  this.treeBaseDuration = this.selfBaseDuration = -0;
}
function createFiberImplClass(tag, pendingProps, key, mode) {
  return new FiberNode(tag, pendingProps, key, mode);
}
function shouldConstruct(Component) {
  Component = Component.prototype;
  return !(!Component || !Component.isReactComponent);
}
function createWorkInProgress(current, pendingProps) {
  var workInProgress = current.alternate;
  workInProgress === null ? (workInProgress = createFiberImplClass(current.tag, pendingProps, current.key, current.mode), workInProgress.elementType = current.elementType, workInProgress.type = current.type, workInProgress.stateNode = current.stateNode, workInProgress.alternate = current, current.alternate = workInProgress) : (workInProgress.pendingProps = pendingProps, workInProgress.type = current.type, workInProgress.flags = 0, workInProgress.subtreeFlags = 0, workInProgress.deletions = null, workInProgress.actualDuration = -0, workInProgress.actualStartTime = -1.1);
  workInProgress.flags = current.flags & 65011712;
  workInProgress.childLanes = current.childLanes;
  workInProgress.lanes = current.lanes;
  workInProgress.child = current.child;
  workInProgress.memoizedProps = current.memoizedProps;
  workInProgress.memoizedState = current.memoizedState;
  workInProgress.updateQueue = current.updateQueue;
  pendingProps = current.dependencies;
  workInProgress.dependencies = pendingProps === null ? null : { lanes: pendingProps.lanes, firstContext: pendingProps.firstContext };
  workInProgress.sibling = current.sibling;
  workInProgress.index = current.index;
  workInProgress.ref = current.ref;
  workInProgress.refCleanup = current.refCleanup;
  workInProgress.selfBaseDuration = current.selfBaseDuration;
  workInProgress.treeBaseDuration = current.treeBaseDuration;
  return workInProgress;
}
function resetWorkInProgress(workInProgress, renderLanes) {
  workInProgress.flags &= 65011714;
  var current = workInProgress.alternate;
  current === null ? (workInProgress.childLanes = 0, workInProgress.lanes = renderLanes, workInProgress.child = null, workInProgress.subtreeFlags = 0, workInProgress.memoizedProps = null, workInProgress.memoizedState = null, workInProgress.updateQueue = null, workInProgress.dependencies = null, workInProgress.stateNode = null, workInProgress.selfBaseDuration = 0, workInProgress.treeBaseDuration = 0) : (workInProgress.childLanes = current.childLanes, workInProgress.lanes = current.lanes, workInProgress.child = current.child, workInProgress.subtreeFlags = 0, workInProgress.deletions = null, workInProgress.memoizedProps = current.memoizedProps, workInProgress.memoizedState = current.memoizedState, workInProgress.updateQueue = current.updateQueue, workInProgress.type = current.type, renderLanes = current.dependencies, workInProgress.dependencies = renderLanes === null ? null : {
    lanes: renderLanes.lanes,
    firstContext: renderLanes.firstContext
  }, workInProgress.selfBaseDuration = current.selfBaseDuration, workInProgress.treeBaseDuration = current.treeBaseDuration);
  return workInProgress;
}
function createFiberFromTypeAndProps(type, key, pendingProps, owner, mode, lanes) {
  var fiberTag = 0;
  owner = type;
  if (typeof type === "function")
    shouldConstruct(type) && (fiberTag = 1);
  else if (typeof type === "string")
    fiberTag = isHostHoistableType(type, pendingProps, contextStackCursor.current) ? 26 : type === "html" || type === "head" || type === "body" ? 27 : 5;
  else
    a:
      switch (type) {
        case REACT_ACTIVITY_TYPE:
          return type = createFiberImplClass(31, pendingProps, key, mode), type.elementType = REACT_ACTIVITY_TYPE, type.lanes = lanes, type;
        case REACT_FRAGMENT_TYPE:
          return createFiberFromFragment(pendingProps.children, mode, lanes, key);
        case REACT_STRICT_MODE_TYPE:
          fiberTag = 8;
          mode |= 24;
          break;
        case REACT_PROFILER_TYPE:
          return type = createFiberImplClass(12, pendingProps, key, mode | 2), type.elementType = REACT_PROFILER_TYPE, type.lanes = lanes, type.stateNode = { effectDuration: 0, passiveEffectDuration: 0 }, type;
        case REACT_SUSPENSE_TYPE:
          return type = createFiberImplClass(13, pendingProps, key, mode), type.elementType = REACT_SUSPENSE_TYPE, type.lanes = lanes, type;
        case REACT_SUSPENSE_LIST_TYPE:
          return type = createFiberImplClass(19, pendingProps, key, mode), type.elementType = REACT_SUSPENSE_LIST_TYPE, type.lanes = lanes, type;
        default:
          if (typeof type === "object" && type !== null)
            switch (type.$$typeof) {
              case REACT_CONTEXT_TYPE:
                fiberTag = 10;
                break a;
              case REACT_CONSUMER_TYPE:
                fiberTag = 9;
                break a;
              case REACT_FORWARD_REF_TYPE:
                fiberTag = 11;
                break a;
              case REACT_MEMO_TYPE:
                fiberTag = 14;
                break a;
              case REACT_LAZY_TYPE:
                fiberTag = 16;
                owner = null;
                break a;
            }
          fiberTag = 29;
          pendingProps = Error(formatProdErrorMessage(130, type === null ? "null" : typeof type, ""));
          owner = null;
      }
  key = createFiberImplClass(fiberTag, pendingProps, key, mode);
  key.elementType = type;
  key.type = owner;
  key.lanes = lanes;
  return key;
}
function createFiberFromFragment(elements, mode, lanes, key) {
  elements = createFiberImplClass(7, elements, key, mode);
  elements.lanes = lanes;
  return elements;
}
function createFiberFromText(content, mode, lanes) {
  content = createFiberImplClass(6, content, null, mode);
  content.lanes = lanes;
  return content;
}
function createFiberFromDehydratedFragment(dehydratedNode) {
  var fiber = createFiberImplClass(18, null, null, 0);
  fiber.stateNode = dehydratedNode;
  return fiber;
}
function createFiberFromPortal(portal, mode, lanes) {
  mode = createFiberImplClass(4, portal.children !== null ? portal.children : [], portal.key, mode);
  mode.lanes = lanes;
  mode.stateNode = {
    containerInfo: portal.containerInfo,
    pendingChildren: null,
    implementation: portal.implementation
  };
  return mode;
}
function createCapturedValueAtFiber(value, source) {
  if (typeof value === "object" && value !== null) {
    var existing = CapturedStacks.get(value);
    if (existing !== undefined)
      return existing;
    source = {
      value,
      source,
      stack: getStackByFiberInDevAndProd(source)
    };
    CapturedStacks.set(value, source);
    return source;
  }
  return {
    value,
    source,
    stack: getStackByFiberInDevAndProd(source)
  };
}
function pushTreeFork(workInProgress, totalChildren) {
  forkStack[forkStackIndex++] = treeForkCount;
  forkStack[forkStackIndex++] = treeForkProvider;
  treeForkProvider = workInProgress;
  treeForkCount = totalChildren;
}
function pushTreeId(workInProgress, totalChildren, index2) {
  idStack[idStackIndex++] = treeContextId;
  idStack[idStackIndex++] = treeContextOverflow;
  idStack[idStackIndex++] = treeContextProvider;
  treeContextProvider = workInProgress;
  var baseIdWithLeadingBit = treeContextId;
  workInProgress = treeContextOverflow;
  var baseLength = 32 - clz32(baseIdWithLeadingBit) - 1;
  baseIdWithLeadingBit &= ~(1 << baseLength);
  index2 += 1;
  var length = 32 - clz32(totalChildren) + baseLength;
  if (30 < length) {
    var numberOfOverflowBits = baseLength - baseLength % 5;
    length = (baseIdWithLeadingBit & (1 << numberOfOverflowBits) - 1).toString(32);
    baseIdWithLeadingBit >>= numberOfOverflowBits;
    baseLength -= numberOfOverflowBits;
    treeContextId = 1 << 32 - clz32(totalChildren) + baseLength | index2 << baseLength | baseIdWithLeadingBit;
    treeContextOverflow = length + workInProgress;
  } else
    treeContextId = 1 << length | index2 << baseLength | baseIdWithLeadingBit, treeContextOverflow = workInProgress;
}
function pushMaterializedTreeId(workInProgress) {
  workInProgress.return !== null && (pushTreeFork(workInProgress, 1), pushTreeId(workInProgress, 1, 0));
}
function popTreeContext(workInProgress) {
  for (;workInProgress === treeForkProvider; )
    treeForkProvider = forkStack[--forkStackIndex], forkStack[forkStackIndex] = null, treeForkCount = forkStack[--forkStackIndex], forkStack[forkStackIndex] = null;
  for (;workInProgress === treeContextProvider; )
    treeContextProvider = idStack[--idStackIndex], idStack[idStackIndex] = null, treeContextOverflow = idStack[--idStackIndex], idStack[idStackIndex] = null, treeContextId = idStack[--idStackIndex], idStack[idStackIndex] = null;
}
function restoreSuspendedTreeContext(workInProgress, suspendedContext) {
  idStack[idStackIndex++] = treeContextId;
  idStack[idStackIndex++] = treeContextOverflow;
  idStack[idStackIndex++] = treeContextProvider;
  treeContextId = suspendedContext.id;
  treeContextOverflow = suspendedContext.overflow;
  treeContextProvider = workInProgress;
}
function throwOnHydrationMismatch(fiber) {
  var error = Error(formatProdErrorMessage(418, 1 < arguments.length && arguments[1] !== undefined && arguments[1] ? "text" : "HTML", ""));
  queueHydrationError(createCapturedValueAtFiber(error, fiber));
  throw HydrationMismatchException;
}
function prepareToHydrateHostInstance(fiber) {
  var { stateNode: instance, type, memoizedProps: props } = fiber;
  instance[internalInstanceKey] = fiber;
  instance[internalPropsKey] = props;
  switch (type) {
    case "dialog":
      listenToNonDelegatedEvent("cancel", instance);
      listenToNonDelegatedEvent("close", instance);
      break;
    case "iframe":
    case "object":
    case "embed":
      listenToNonDelegatedEvent("load", instance);
      break;
    case "video":
    case "audio":
      for (type = 0;type < mediaEventTypes.length; type++)
        listenToNonDelegatedEvent(mediaEventTypes[type], instance);
      break;
    case "source":
      listenToNonDelegatedEvent("error", instance);
      break;
    case "img":
    case "image":
    case "link":
      listenToNonDelegatedEvent("error", instance);
      listenToNonDelegatedEvent("load", instance);
      break;
    case "details":
      listenToNonDelegatedEvent("toggle", instance);
      break;
    case "input":
      listenToNonDelegatedEvent("invalid", instance);
      initInput(instance, props.value, props.defaultValue, props.checked, props.defaultChecked, props.type, props.name, true);
      break;
    case "select":
      listenToNonDelegatedEvent("invalid", instance);
      break;
    case "textarea":
      listenToNonDelegatedEvent("invalid", instance), initTextarea(instance, props.value, props.defaultValue, props.children);
  }
  type = props.children;
  typeof type !== "string" && typeof type !== "number" && typeof type !== "bigint" || instance.textContent === "" + type || props.suppressHydrationWarning === true || checkForUnmatchedText(instance.textContent, type) ? (props.popover != null && (listenToNonDelegatedEvent("beforetoggle", instance), listenToNonDelegatedEvent("toggle", instance)), props.onScroll != null && listenToNonDelegatedEvent("scroll", instance), props.onScrollEnd != null && listenToNonDelegatedEvent("scrollend", instance), props.onClick != null && (instance.onclick = noop$1), instance = true) : instance = false;
  instance || throwOnHydrationMismatch(fiber, true);
}
function popToNextHostParent(fiber) {
  for (hydrationParentFiber = fiber.return;hydrationParentFiber; )
    switch (hydrationParentFiber.tag) {
      case 5:
      case 31:
      case 13:
        rootOrSingletonContext = false;
        return;
      case 27:
      case 3:
        rootOrSingletonContext = true;
        return;
      default:
        hydrationParentFiber = hydrationParentFiber.return;
    }
}
function popHydrationState(fiber) {
  if (fiber !== hydrationParentFiber)
    return false;
  if (!isHydrating)
    return popToNextHostParent(fiber), isHydrating = true, false;
  var tag = fiber.tag, JSCompiler_temp;
  if (JSCompiler_temp = tag !== 3 && tag !== 27) {
    if (JSCompiler_temp = tag === 5)
      JSCompiler_temp = fiber.type, JSCompiler_temp = !(JSCompiler_temp !== "form" && JSCompiler_temp !== "button") || shouldSetTextContent(fiber.type, fiber.memoizedProps);
    JSCompiler_temp = !JSCompiler_temp;
  }
  JSCompiler_temp && nextHydratableInstance && throwOnHydrationMismatch(fiber);
  popToNextHostParent(fiber);
  if (tag === 13) {
    fiber = fiber.memoizedState;
    fiber = fiber !== null ? fiber.dehydrated : null;
    if (!fiber)
      throw Error(formatProdErrorMessage(317));
    nextHydratableInstance = getNextHydratableInstanceAfterHydrationBoundary(fiber);
  } else if (tag === 31) {
    fiber = fiber.memoizedState;
    fiber = fiber !== null ? fiber.dehydrated : null;
    if (!fiber)
      throw Error(formatProdErrorMessage(317));
    nextHydratableInstance = getNextHydratableInstanceAfterHydrationBoundary(fiber);
  } else
    tag === 27 ? (tag = nextHydratableInstance, isSingletonScope(fiber.type) ? (fiber = previousHydratableOnEnteringScopedSingleton, previousHydratableOnEnteringScopedSingleton = null, nextHydratableInstance = fiber) : nextHydratableInstance = tag) : nextHydratableInstance = hydrationParentFiber ? getNextHydratable(fiber.stateNode.nextSibling) : null;
  return true;
}
function resetHydrationState() {
  nextHydratableInstance = hydrationParentFiber = null;
  isHydrating = false;
}
function upgradeHydrationErrorsToRecoverable() {
  var queuedErrors = hydrationErrors;
  queuedErrors !== null && (workInProgressRootRecoverableErrors === null ? workInProgressRootRecoverableErrors = queuedErrors : workInProgressRootRecoverableErrors.push.apply(workInProgressRootRecoverableErrors, queuedErrors), hydrationErrors = null);
  return queuedErrors;
}
function queueHydrationError(error) {
  hydrationErrors === null ? hydrationErrors = [error] : hydrationErrors.push(error);
}
function pushProvider(providerFiber, context, nextValue) {
  push2(valueCursor, context._currentValue);
  context._currentValue = nextValue;
}
function popProvider(context) {
  context._currentValue = valueCursor.current;
  pop2(valueCursor);
}
function scheduleContextWorkOnParentPath(parent, renderLanes, propagationRoot) {
  for (;parent !== null; ) {
    var alternate = parent.alternate;
    (parent.childLanes & renderLanes) !== renderLanes ? (parent.childLanes |= renderLanes, alternate !== null && (alternate.childLanes |= renderLanes)) : alternate !== null && (alternate.childLanes & renderLanes) !== renderLanes && (alternate.childLanes |= renderLanes);
    if (parent === propagationRoot)
      break;
    parent = parent.return;
  }
}
function propagateContextChanges(workInProgress, contexts, renderLanes, forcePropagateEntireTree) {
  var fiber = workInProgress.child;
  fiber !== null && (fiber.return = workInProgress);
  for (;fiber !== null; ) {
    var list = fiber.dependencies;
    if (list !== null) {
      var nextFiber = fiber.child;
      list = list.firstContext;
      a:
        for (;list !== null; ) {
          var dependency = list;
          list = fiber;
          for (var i = 0;i < contexts.length; i++)
            if (dependency.context === contexts[i]) {
              list.lanes |= renderLanes;
              dependency = list.alternate;
              dependency !== null && (dependency.lanes |= renderLanes);
              scheduleContextWorkOnParentPath(list.return, renderLanes, workInProgress);
              forcePropagateEntireTree || (nextFiber = null);
              break a;
            }
          list = dependency.next;
        }
    } else if (fiber.tag === 18) {
      nextFiber = fiber.return;
      if (nextFiber === null)
        throw Error(formatProdErrorMessage(341));
      nextFiber.lanes |= renderLanes;
      list = nextFiber.alternate;
      list !== null && (list.lanes |= renderLanes);
      scheduleContextWorkOnParentPath(nextFiber, renderLanes, workInProgress);
      nextFiber = null;
    } else
      nextFiber = fiber.child;
    if (nextFiber !== null)
      nextFiber.return = fiber;
    else
      for (nextFiber = fiber;nextFiber !== null; ) {
        if (nextFiber === workInProgress) {
          nextFiber = null;
          break;
        }
        fiber = nextFiber.sibling;
        if (fiber !== null) {
          fiber.return = nextFiber.return;
          nextFiber = fiber;
          break;
        }
        nextFiber = nextFiber.return;
      }
    fiber = nextFiber;
  }
}
function propagateParentContextChanges(current, workInProgress, renderLanes, forcePropagateEntireTree) {
  current = null;
  for (var parent = workInProgress, isInsidePropagationBailout = false;parent !== null; ) {
    if (!isInsidePropagationBailout) {
      if ((parent.flags & 524288) !== 0)
        isInsidePropagationBailout = true;
      else if ((parent.flags & 262144) !== 0)
        break;
    }
    if (parent.tag === 10) {
      var currentParent = parent.alternate;
      if (currentParent === null)
        throw Error(formatProdErrorMessage(387));
      currentParent = currentParent.memoizedProps;
      if (currentParent !== null) {
        var context = parent.type;
        objectIs(parent.pendingProps.value, currentParent.value) || (current !== null ? current.push(context) : current = [context]);
      }
    } else if (parent === hostTransitionProviderCursor.current) {
      currentParent = parent.alternate;
      if (currentParent === null)
        throw Error(formatProdErrorMessage(387));
      currentParent.memoizedState.memoizedState !== parent.memoizedState.memoizedState && (current !== null ? current.push(HostTransitionContext) : current = [HostTransitionContext]);
    }
    parent = parent.return;
  }
  current !== null && propagateContextChanges(workInProgress, current, renderLanes, forcePropagateEntireTree);
  workInProgress.flags |= 262144;
}
function checkIfContextChanged(currentDependencies) {
  for (currentDependencies = currentDependencies.firstContext;currentDependencies !== null; ) {
    if (!objectIs(currentDependencies.context._currentValue, currentDependencies.memoizedValue))
      return true;
    currentDependencies = currentDependencies.next;
  }
  return false;
}
function prepareToReadContext(workInProgress) {
  currentlyRenderingFiber$1 = workInProgress;
  lastContextDependency = null;
  workInProgress = workInProgress.dependencies;
  workInProgress !== null && (workInProgress.firstContext = null);
}
function readContext(context) {
  return readContextForConsumer(currentlyRenderingFiber$1, context);
}
function readContextDuringReconciliation(consumer, context) {
  currentlyRenderingFiber$1 === null && prepareToReadContext(consumer);
  return readContextForConsumer(consumer, context);
}
function readContextForConsumer(consumer, context) {
  var value = context._currentValue;
  context = { context, memoizedValue: value, next: null };
  if (lastContextDependency === null) {
    if (consumer === null)
      throw Error(formatProdErrorMessage(308));
    lastContextDependency = context;
    consumer.dependencies = { lanes: 0, firstContext: context };
    consumer.flags |= 524288;
  } else
    lastContextDependency = lastContextDependency.next = context;
  return value;
}
function createCache() {
  return {
    controller: new AbortControllerLocal,
    data: new Map,
    refCount: 0
  };
}
function releaseCache(cache) {
  cache.refCount--;
  cache.refCount === 0 && scheduleCallback$2(NormalPriority, function() {
    cache.controller.abort();
  });
}
function startUpdateTimerByLane(lane) {
  if ((lane & 127) !== 0) {
    if (0 > blockingUpdateTime) {
      blockingUpdateTime = now();
      (executionContext & 6) !== 0 && (componentEffectSpawnedUpdate = true, blockingUpdateType = 1);
      lane = resolveEventTimeStamp();
      var newEventType$30 = resolveEventType();
      lane !== blockingEventRepeatTime || newEventType$30 !== blockingEventType ? blockingEventRepeatTime = -1.1 : newEventType$30 !== null && (blockingUpdateType = 1);
      blockingEventTime = lane;
      blockingEventType = newEventType$30;
    }
  } else if ((lane & 4194048) !== 0 && 0 > transitionUpdateTime && (transitionUpdateTime = now(), 0 > transitionStartTime)) {
    lane = resolveEventTimeStamp();
    newEventType$30 = resolveEventType();
    if (lane !== transitionEventRepeatTime || newEventType$30 !== transitionEventType)
      transitionEventRepeatTime = -1.1;
    transitionEventTime = lane;
    transitionEventType = newEventType$30;
  }
}
function startHostActionTimer() {
  if (0 > blockingUpdateTime) {
    blockingUpdateTime = now();
    (executionContext & 6) !== 0 && (blockingUpdateType = 1);
    var newEventTime = resolveEventTimeStamp(), newEventType = resolveEventType();
    newEventTime !== blockingEventRepeatTime || newEventType !== blockingEventType ? blockingEventRepeatTime = -1.1 : newEventType !== null && (blockingUpdateType = 1);
    blockingEventTime = newEventTime;
    blockingEventType = newEventType;
  }
  if (0 > transitionUpdateTime && (transitionUpdateTime = now(), 0 > transitionStartTime)) {
    newEventTime = resolveEventTimeStamp();
    newEventType = resolveEventType();
    if (newEventTime !== transitionEventRepeatTime || newEventType !== transitionEventType)
      transitionEventRepeatTime = -1.1;
    transitionEventTime = newEventTime;
    transitionEventType = newEventType;
  }
}
function pushNestedEffectDurations() {
  var prevEffectDuration = profilerEffectDuration;
  profilerEffectDuration = 0;
  return prevEffectDuration;
}
function popNestedEffectDurations(prevEffectDuration) {
  var elapsedTime = profilerEffectDuration;
  profilerEffectDuration = prevEffectDuration;
  return elapsedTime;
}
function bubbleNestedEffectDurations(prevEffectDuration) {
  var elapsedTime = profilerEffectDuration;
  profilerEffectDuration += prevEffectDuration;
  return elapsedTime;
}
function resetComponentEffectTimers() {
  componentEffectEndTime = componentEffectStartTime = -1.1;
}
function pushComponentEffectStart() {
  var prevEffectStart = componentEffectStartTime;
  componentEffectStartTime = -1.1;
  return prevEffectStart;
}
function popComponentEffectStart(prevEffectStart) {
  0 <= prevEffectStart && (componentEffectStartTime = prevEffectStart);
}
function pushComponentEffectDuration() {
  var prevEffectDuration = componentEffectDuration;
  componentEffectDuration = -0;
  return prevEffectDuration;
}
function popComponentEffectDuration(prevEffectDuration) {
  0 <= prevEffectDuration && (componentEffectDuration = prevEffectDuration);
}
function pushComponentEffectErrors() {
  var prevErrors = componentEffectErrors;
  componentEffectErrors = null;
  return prevErrors;
}
function pushComponentEffectDidSpawnUpdate() {
  var prev = componentEffectSpawnedUpdate;
  componentEffectSpawnedUpdate = false;
  return prev;
}
function startProfilerTimer(fiber) {
  profilerStartTime = now();
  0 > fiber.actualStartTime && (fiber.actualStartTime = profilerStartTime);
}
function stopProfilerTimerIfRunningAndRecordDuration(fiber) {
  if (0 <= profilerStartTime) {
    var elapsedTime = now() - profilerStartTime;
    fiber.actualDuration += elapsedTime;
    fiber.selfBaseDuration = elapsedTime;
    profilerStartTime = -1;
  }
}
function stopProfilerTimerIfRunningAndRecordIncompleteDuration(fiber) {
  if (0 <= profilerStartTime) {
    var elapsedTime = now() - profilerStartTime;
    fiber.actualDuration += elapsedTime;
    profilerStartTime = -1;
  }
}
function recordEffectDuration() {
  if (0 <= profilerStartTime) {
    var endTime = now(), elapsedTime = endTime - profilerStartTime;
    profilerStartTime = -1;
    profilerEffectDuration += elapsedTime;
    componentEffectDuration += elapsedTime;
    componentEffectEndTime = endTime;
  }
}
function recordEffectError(errorInfo) {
  componentEffectErrors === null && (componentEffectErrors = []);
  componentEffectErrors.push(errorInfo);
  commitErrors === null && (commitErrors = []);
  commitErrors.push(errorInfo);
}
function startEffectTimer() {
  profilerStartTime = now();
  0 > componentEffectStartTime && (componentEffectStartTime = profilerStartTime);
}
function transferActualDuration(fiber) {
  for (var child = fiber.child;child; )
    fiber.actualDuration += child.actualDuration, child = child.sibling;
}
function entangleAsyncAction(transition, thenable) {
  if (currentEntangledListeners === null) {
    var entangledListeners = currentEntangledListeners = [];
    currentEntangledPendingCount = 0;
    currentEntangledLane = requestTransitionLane();
    currentEntangledActionThenable = {
      status: "pending",
      value: undefined,
      then: function(resolve) {
        entangledListeners.push(resolve);
      }
    };
  }
  currentEntangledPendingCount++;
  thenable.then(pingEngtangledActionScope, pingEngtangledActionScope);
  return thenable;
}
function pingEngtangledActionScope() {
  if (--currentEntangledPendingCount === 0 && (-1 < transitionUpdateTime || (transitionStartTime = -1.1), currentEntangledListeners !== null)) {
    currentEntangledActionThenable !== null && (currentEntangledActionThenable.status = "fulfilled");
    var listeners = currentEntangledListeners;
    currentEntangledListeners = null;
    currentEntangledLane = 0;
    currentEntangledActionThenable = null;
    for (var i = 0;i < listeners.length; i++)
      (0, listeners[i])();
  }
}
function chainThenableValue(thenable, result) {
  var listeners = [], thenableWithOverride = {
    status: "pending",
    value: null,
    reason: null,
    then: function(resolve) {
      listeners.push(resolve);
    }
  };
  thenable.then(function() {
    thenableWithOverride.status = "fulfilled";
    thenableWithOverride.value = result;
    for (var i = 0;i < listeners.length; i++)
      (0, listeners[i])(result);
  }, function(error) {
    thenableWithOverride.status = "rejected";
    thenableWithOverride.reason = error;
    for (error = 0;error < listeners.length; error++)
      (0, listeners[error])(undefined);
  });
  return thenableWithOverride;
}
function peekCacheFromPool() {
  var cacheResumedFromPreviousRender = resumedCache.current;
  return cacheResumedFromPreviousRender !== null ? cacheResumedFromPreviousRender : workInProgressRoot.pooledCache;
}
function pushTransition(offscreenWorkInProgress, prevCachePool) {
  prevCachePool === null ? push2(resumedCache, resumedCache.current) : push2(resumedCache, prevCachePool.pool);
}
function getSuspendedCache() {
  var cacheFromPool = peekCacheFromPool();
  return cacheFromPool === null ? null : { parent: CacheContext._currentValue, pool: cacheFromPool };
}
function isThenableResolved(thenable) {
  thenable = thenable.status;
  return thenable === "fulfilled" || thenable === "rejected";
}
function trackUsedThenable(thenableState, thenable, index2) {
  index2 = thenableState[index2];
  index2 === undefined ? thenableState.push(thenable) : index2 !== thenable && (thenable.then(noop$1, noop$1), thenable = index2);
  switch (thenable.status) {
    case "fulfilled":
      return thenable.value;
    case "rejected":
      throw thenableState = thenable.reason, checkIfUseWrappedInAsyncCatch(thenableState), thenableState;
    default:
      if (typeof thenable.status === "string")
        thenable.then(noop$1, noop$1);
      else {
        thenableState = workInProgressRoot;
        if (thenableState !== null && 100 < thenableState.shellSuspendCounter)
          throw Error(formatProdErrorMessage(482));
        thenableState = thenable;
        thenableState.status = "pending";
        thenableState.then(function(fulfilledValue) {
          if (thenable.status === "pending") {
            var fulfilledThenable = thenable;
            fulfilledThenable.status = "fulfilled";
            fulfilledThenable.value = fulfilledValue;
          }
        }, function(error) {
          if (thenable.status === "pending") {
            var rejectedThenable = thenable;
            rejectedThenable.status = "rejected";
            rejectedThenable.reason = error;
          }
        });
      }
      switch (thenable.status) {
        case "fulfilled":
          return thenable.value;
        case "rejected":
          throw thenableState = thenable.reason, checkIfUseWrappedInAsyncCatch(thenableState), thenableState;
      }
      suspendedThenable = thenable;
      throw SuspenseException;
  }
}
function resolveLazy(lazyType) {
  try {
    var init = lazyType._init;
    return init(lazyType._payload);
  } catch (x) {
    if (x !== null && typeof x === "object" && typeof x.then === "function")
      throw suspendedThenable = x, SuspenseException;
    throw x;
  }
}
function getSuspendedThenable() {
  if (suspendedThenable === null)
    throw Error(formatProdErrorMessage(459));
  var thenable = suspendedThenable;
  suspendedThenable = null;
  return thenable;
}
function checkIfUseWrappedInAsyncCatch(rejectedReason) {
  if (rejectedReason === SuspenseException || rejectedReason === SuspenseActionException)
    throw Error(formatProdErrorMessage(483));
}
function unwrapThenable(thenable) {
  var index2 = thenableIndexCounter$1;
  thenableIndexCounter$1 += 1;
  thenableState$1 === null && (thenableState$1 = []);
  return trackUsedThenable(thenableState$1, thenable, index2);
}
function coerceRef(workInProgress, element) {
  element = element.props.ref;
  workInProgress.ref = element !== undefined ? element : null;
}
function throwOnInvalidObjectTypeImpl(returnFiber, newChild) {
  if (newChild.$$typeof === REACT_LEGACY_ELEMENT_TYPE)
    throw Error(formatProdErrorMessage(525));
  returnFiber = Object.prototype.toString.call(newChild);
  throw Error(formatProdErrorMessage(31, returnFiber === "[object Object]" ? "object with keys {" + Object.keys(newChild).join(", ") + "}" : returnFiber));
}
function createChildReconciler(shouldTrackSideEffects) {
  function deleteChild(returnFiber, childToDelete) {
    if (shouldTrackSideEffects) {
      var deletions = returnFiber.deletions;
      deletions === null ? (returnFiber.deletions = [childToDelete], returnFiber.flags |= 16) : deletions.push(childToDelete);
    }
  }
  function deleteRemainingChildren(returnFiber, currentFirstChild) {
    if (!shouldTrackSideEffects)
      return null;
    for (;currentFirstChild !== null; )
      deleteChild(returnFiber, currentFirstChild), currentFirstChild = currentFirstChild.sibling;
    return null;
  }
  function mapRemainingChildren(currentFirstChild) {
    for (var existingChildren = new Map;currentFirstChild !== null; )
      currentFirstChild.key !== null ? existingChildren.set(currentFirstChild.key, currentFirstChild) : existingChildren.set(currentFirstChild.index, currentFirstChild), currentFirstChild = currentFirstChild.sibling;
    return existingChildren;
  }
  function useFiber(fiber, pendingProps) {
    fiber = createWorkInProgress(fiber, pendingProps);
    fiber.index = 0;
    fiber.sibling = null;
    return fiber;
  }
  function placeChild(newFiber, lastPlacedIndex, newIndex) {
    newFiber.index = newIndex;
    if (!shouldTrackSideEffects)
      return newFiber.flags |= 1048576, lastPlacedIndex;
    newIndex = newFiber.alternate;
    if (newIndex !== null)
      return newIndex = newIndex.index, newIndex < lastPlacedIndex ? (newFiber.flags |= 67108866, lastPlacedIndex) : newIndex;
    newFiber.flags |= 67108866;
    return lastPlacedIndex;
  }
  function placeSingleChild(newFiber) {
    shouldTrackSideEffects && newFiber.alternate === null && (newFiber.flags |= 67108866);
    return newFiber;
  }
  function updateTextNode(returnFiber, current, textContent, lanes) {
    if (current === null || current.tag !== 6)
      return current = createFiberFromText(textContent, returnFiber.mode, lanes), current.return = returnFiber, current;
    current = useFiber(current, textContent);
    current.return = returnFiber;
    return current;
  }
  function updateElement(returnFiber, current, element, lanes) {
    var elementType = element.type;
    if (elementType === REACT_FRAGMENT_TYPE)
      return updateFragment(returnFiber, current, element.props.children, lanes, element.key);
    if (current !== null && (current.elementType === elementType || typeof elementType === "object" && elementType !== null && elementType.$$typeof === REACT_LAZY_TYPE && resolveLazy(elementType) === current.type))
      return current = useFiber(current, element.props), coerceRef(current, element), current.return = returnFiber, current;
    current = createFiberFromTypeAndProps(element.type, element.key, element.props, null, returnFiber.mode, lanes);
    coerceRef(current, element);
    current.return = returnFiber;
    return current;
  }
  function updatePortal(returnFiber, current, portal, lanes) {
    if (current === null || current.tag !== 4 || current.stateNode.containerInfo !== portal.containerInfo || current.stateNode.implementation !== portal.implementation)
      return current = createFiberFromPortal(portal, returnFiber.mode, lanes), current.return = returnFiber, current;
    current = useFiber(current, portal.children || []);
    current.return = returnFiber;
    return current;
  }
  function updateFragment(returnFiber, current, fragment, lanes, key) {
    if (current === null || current.tag !== 7)
      return current = createFiberFromFragment(fragment, returnFiber.mode, lanes, key), current.return = returnFiber, current;
    current = useFiber(current, fragment);
    current.return = returnFiber;
    return current;
  }
  function createChild(returnFiber, newChild, lanes) {
    if (typeof newChild === "string" && newChild !== "" || typeof newChild === "number" || typeof newChild === "bigint")
      return newChild = createFiberFromText("" + newChild, returnFiber.mode, lanes), newChild.return = returnFiber, newChild;
    if (typeof newChild === "object" && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE:
          return lanes = createFiberFromTypeAndProps(newChild.type, newChild.key, newChild.props, null, returnFiber.mode, lanes), coerceRef(lanes, newChild), lanes.return = returnFiber, lanes;
        case REACT_PORTAL_TYPE:
          return newChild = createFiberFromPortal(newChild, returnFiber.mode, lanes), newChild.return = returnFiber, newChild;
        case REACT_LAZY_TYPE:
          return newChild = resolveLazy(newChild), createChild(returnFiber, newChild, lanes);
      }
      if (isArrayImpl(newChild) || getIteratorFn(newChild))
        return newChild = createFiberFromFragment(newChild, returnFiber.mode, lanes, null), newChild.return = returnFiber, newChild;
      if (typeof newChild.then === "function")
        return createChild(returnFiber, unwrapThenable(newChild), lanes);
      if (newChild.$$typeof === REACT_CONTEXT_TYPE)
        return createChild(returnFiber, readContextDuringReconciliation(returnFiber, newChild), lanes);
      throwOnInvalidObjectTypeImpl(returnFiber, newChild);
    }
    return null;
  }
  function updateSlot(returnFiber, oldFiber, newChild, lanes) {
    var key = oldFiber !== null ? oldFiber.key : null;
    if (typeof newChild === "string" && newChild !== "" || typeof newChild === "number" || typeof newChild === "bigint")
      return key !== null ? null : updateTextNode(returnFiber, oldFiber, "" + newChild, lanes);
    if (typeof newChild === "object" && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE:
          return newChild.key === key ? updateElement(returnFiber, oldFiber, newChild, lanes) : null;
        case REACT_PORTAL_TYPE:
          return newChild.key === key ? updatePortal(returnFiber, oldFiber, newChild, lanes) : null;
        case REACT_LAZY_TYPE:
          return newChild = resolveLazy(newChild), updateSlot(returnFiber, oldFiber, newChild, lanes);
      }
      if (isArrayImpl(newChild) || getIteratorFn(newChild))
        return key !== null ? null : updateFragment(returnFiber, oldFiber, newChild, lanes, null);
      if (typeof newChild.then === "function")
        return updateSlot(returnFiber, oldFiber, unwrapThenable(newChild), lanes);
      if (newChild.$$typeof === REACT_CONTEXT_TYPE)
        return updateSlot(returnFiber, oldFiber, readContextDuringReconciliation(returnFiber, newChild), lanes);
      throwOnInvalidObjectTypeImpl(returnFiber, newChild);
    }
    return null;
  }
  function updateFromMap(existingChildren, returnFiber, newIdx, newChild, lanes) {
    if (typeof newChild === "string" && newChild !== "" || typeof newChild === "number" || typeof newChild === "bigint")
      return existingChildren = existingChildren.get(newIdx) || null, updateTextNode(returnFiber, existingChildren, "" + newChild, lanes);
    if (typeof newChild === "object" && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE:
          return existingChildren = existingChildren.get(newChild.key === null ? newIdx : newChild.key) || null, updateElement(returnFiber, existingChildren, newChild, lanes);
        case REACT_PORTAL_TYPE:
          return existingChildren = existingChildren.get(newChild.key === null ? newIdx : newChild.key) || null, updatePortal(returnFiber, existingChildren, newChild, lanes);
        case REACT_LAZY_TYPE:
          return newChild = resolveLazy(newChild), updateFromMap(existingChildren, returnFiber, newIdx, newChild, lanes);
      }
      if (isArrayImpl(newChild) || getIteratorFn(newChild))
        return existingChildren = existingChildren.get(newIdx) || null, updateFragment(returnFiber, existingChildren, newChild, lanes, null);
      if (typeof newChild.then === "function")
        return updateFromMap(existingChildren, returnFiber, newIdx, unwrapThenable(newChild), lanes);
      if (newChild.$$typeof === REACT_CONTEXT_TYPE)
        return updateFromMap(existingChildren, returnFiber, newIdx, readContextDuringReconciliation(returnFiber, newChild), lanes);
      throwOnInvalidObjectTypeImpl(returnFiber, newChild);
    }
    return null;
  }
  function reconcileChildrenArray(returnFiber, currentFirstChild, newChildren, lanes) {
    for (var resultingFirstChild = null, previousNewFiber = null, oldFiber = currentFirstChild, newIdx = currentFirstChild = 0, nextOldFiber = null;oldFiber !== null && newIdx < newChildren.length; newIdx++) {
      oldFiber.index > newIdx ? (nextOldFiber = oldFiber, oldFiber = null) : nextOldFiber = oldFiber.sibling;
      var newFiber = updateSlot(returnFiber, oldFiber, newChildren[newIdx], lanes);
      if (newFiber === null) {
        oldFiber === null && (oldFiber = nextOldFiber);
        break;
      }
      shouldTrackSideEffects && oldFiber && newFiber.alternate === null && deleteChild(returnFiber, oldFiber);
      currentFirstChild = placeChild(newFiber, currentFirstChild, newIdx);
      previousNewFiber === null ? resultingFirstChild = newFiber : previousNewFiber.sibling = newFiber;
      previousNewFiber = newFiber;
      oldFiber = nextOldFiber;
    }
    if (newIdx === newChildren.length)
      return deleteRemainingChildren(returnFiber, oldFiber), isHydrating && pushTreeFork(returnFiber, newIdx), resultingFirstChild;
    if (oldFiber === null) {
      for (;newIdx < newChildren.length; newIdx++)
        oldFiber = createChild(returnFiber, newChildren[newIdx], lanes), oldFiber !== null && (currentFirstChild = placeChild(oldFiber, currentFirstChild, newIdx), previousNewFiber === null ? resultingFirstChild = oldFiber : previousNewFiber.sibling = oldFiber, previousNewFiber = oldFiber);
      isHydrating && pushTreeFork(returnFiber, newIdx);
      return resultingFirstChild;
    }
    for (oldFiber = mapRemainingChildren(oldFiber);newIdx < newChildren.length; newIdx++)
      nextOldFiber = updateFromMap(oldFiber, returnFiber, newIdx, newChildren[newIdx], lanes), nextOldFiber !== null && (shouldTrackSideEffects && nextOldFiber.alternate !== null && oldFiber.delete(nextOldFiber.key === null ? newIdx : nextOldFiber.key), currentFirstChild = placeChild(nextOldFiber, currentFirstChild, newIdx), previousNewFiber === null ? resultingFirstChild = nextOldFiber : previousNewFiber.sibling = nextOldFiber, previousNewFiber = nextOldFiber);
    shouldTrackSideEffects && oldFiber.forEach(function(child) {
      return deleteChild(returnFiber, child);
    });
    isHydrating && pushTreeFork(returnFiber, newIdx);
    return resultingFirstChild;
  }
  function reconcileChildrenIterator(returnFiber, currentFirstChild, newChildren, lanes) {
    if (newChildren == null)
      throw Error(formatProdErrorMessage(151));
    for (var resultingFirstChild = null, previousNewFiber = null, oldFiber = currentFirstChild, newIdx = currentFirstChild = 0, nextOldFiber = null, step = newChildren.next();oldFiber !== null && !step.done; newIdx++, step = newChildren.next()) {
      oldFiber.index > newIdx ? (nextOldFiber = oldFiber, oldFiber = null) : nextOldFiber = oldFiber.sibling;
      var newFiber = updateSlot(returnFiber, oldFiber, step.value, lanes);
      if (newFiber === null) {
        oldFiber === null && (oldFiber = nextOldFiber);
        break;
      }
      shouldTrackSideEffects && oldFiber && newFiber.alternate === null && deleteChild(returnFiber, oldFiber);
      currentFirstChild = placeChild(newFiber, currentFirstChild, newIdx);
      previousNewFiber === null ? resultingFirstChild = newFiber : previousNewFiber.sibling = newFiber;
      previousNewFiber = newFiber;
      oldFiber = nextOldFiber;
    }
    if (step.done)
      return deleteRemainingChildren(returnFiber, oldFiber), isHydrating && pushTreeFork(returnFiber, newIdx), resultingFirstChild;
    if (oldFiber === null) {
      for (;!step.done; newIdx++, step = newChildren.next())
        step = createChild(returnFiber, step.value, lanes), step !== null && (currentFirstChild = placeChild(step, currentFirstChild, newIdx), previousNewFiber === null ? resultingFirstChild = step : previousNewFiber.sibling = step, previousNewFiber = step);
      isHydrating && pushTreeFork(returnFiber, newIdx);
      return resultingFirstChild;
    }
    for (oldFiber = mapRemainingChildren(oldFiber);!step.done; newIdx++, step = newChildren.next())
      step = updateFromMap(oldFiber, returnFiber, newIdx, step.value, lanes), step !== null && (shouldTrackSideEffects && step.alternate !== null && oldFiber.delete(step.key === null ? newIdx : step.key), currentFirstChild = placeChild(step, currentFirstChild, newIdx), previousNewFiber === null ? resultingFirstChild = step : previousNewFiber.sibling = step, previousNewFiber = step);
    shouldTrackSideEffects && oldFiber.forEach(function(child) {
      return deleteChild(returnFiber, child);
    });
    isHydrating && pushTreeFork(returnFiber, newIdx);
    return resultingFirstChild;
  }
  function reconcileChildFibersImpl(returnFiber, currentFirstChild, newChild, lanes) {
    typeof newChild === "object" && newChild !== null && newChild.type === REACT_FRAGMENT_TYPE && newChild.key === null && (newChild = newChild.props.children);
    if (typeof newChild === "object" && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE:
          a: {
            for (var key = newChild.key;currentFirstChild !== null; ) {
              if (currentFirstChild.key === key) {
                key = newChild.type;
                if (key === REACT_FRAGMENT_TYPE) {
                  if (currentFirstChild.tag === 7) {
                    deleteRemainingChildren(returnFiber, currentFirstChild.sibling);
                    lanes = useFiber(currentFirstChild, newChild.props.children);
                    lanes.return = returnFiber;
                    returnFiber = lanes;
                    break a;
                  }
                } else if (currentFirstChild.elementType === key || typeof key === "object" && key !== null && key.$$typeof === REACT_LAZY_TYPE && resolveLazy(key) === currentFirstChild.type) {
                  deleteRemainingChildren(returnFiber, currentFirstChild.sibling);
                  lanes = useFiber(currentFirstChild, newChild.props);
                  coerceRef(lanes, newChild);
                  lanes.return = returnFiber;
                  returnFiber = lanes;
                  break a;
                }
                deleteRemainingChildren(returnFiber, currentFirstChild);
                break;
              } else
                deleteChild(returnFiber, currentFirstChild);
              currentFirstChild = currentFirstChild.sibling;
            }
            newChild.type === REACT_FRAGMENT_TYPE ? (lanes = createFiberFromFragment(newChild.props.children, returnFiber.mode, lanes, newChild.key), lanes.return = returnFiber, returnFiber = lanes) : (lanes = createFiberFromTypeAndProps(newChild.type, newChild.key, newChild.props, null, returnFiber.mode, lanes), coerceRef(lanes, newChild), lanes.return = returnFiber, returnFiber = lanes);
          }
          return placeSingleChild(returnFiber);
        case REACT_PORTAL_TYPE:
          a: {
            for (key = newChild.key;currentFirstChild !== null; ) {
              if (currentFirstChild.key === key)
                if (currentFirstChild.tag === 4 && currentFirstChild.stateNode.containerInfo === newChild.containerInfo && currentFirstChild.stateNode.implementation === newChild.implementation) {
                  deleteRemainingChildren(returnFiber, currentFirstChild.sibling);
                  lanes = useFiber(currentFirstChild, newChild.children || []);
                  lanes.return = returnFiber;
                  returnFiber = lanes;
                  break a;
                } else {
                  deleteRemainingChildren(returnFiber, currentFirstChild);
                  break;
                }
              else
                deleteChild(returnFiber, currentFirstChild);
              currentFirstChild = currentFirstChild.sibling;
            }
            lanes = createFiberFromPortal(newChild, returnFiber.mode, lanes);
            lanes.return = returnFiber;
            returnFiber = lanes;
          }
          return placeSingleChild(returnFiber);
        case REACT_LAZY_TYPE:
          return newChild = resolveLazy(newChild), reconcileChildFibersImpl(returnFiber, currentFirstChild, newChild, lanes);
      }
      if (isArrayImpl(newChild))
        return reconcileChildrenArray(returnFiber, currentFirstChild, newChild, lanes);
      if (getIteratorFn(newChild)) {
        key = getIteratorFn(newChild);
        if (typeof key !== "function")
          throw Error(formatProdErrorMessage(150));
        newChild = key.call(newChild);
        return reconcileChildrenIterator(returnFiber, currentFirstChild, newChild, lanes);
      }
      if (typeof newChild.then === "function")
        return reconcileChildFibersImpl(returnFiber, currentFirstChild, unwrapThenable(newChild), lanes);
      if (newChild.$$typeof === REACT_CONTEXT_TYPE)
        return reconcileChildFibersImpl(returnFiber, currentFirstChild, readContextDuringReconciliation(returnFiber, newChild), lanes);
      throwOnInvalidObjectTypeImpl(returnFiber, newChild);
    }
    return typeof newChild === "string" && newChild !== "" || typeof newChild === "number" || typeof newChild === "bigint" ? (newChild = "" + newChild, currentFirstChild !== null && currentFirstChild.tag === 6 ? (deleteRemainingChildren(returnFiber, currentFirstChild.sibling), lanes = useFiber(currentFirstChild, newChild), lanes.return = returnFiber, returnFiber = lanes) : (deleteRemainingChildren(returnFiber, currentFirstChild), lanes = createFiberFromText(newChild, returnFiber.mode, lanes), lanes.return = returnFiber, returnFiber = lanes), placeSingleChild(returnFiber)) : deleteRemainingChildren(returnFiber, currentFirstChild);
  }
  return function(returnFiber, currentFirstChild, newChild, lanes) {
    try {
      thenableIndexCounter$1 = 0;
      var firstChildFiber = reconcileChildFibersImpl(returnFiber, currentFirstChild, newChild, lanes);
      thenableState$1 = null;
      return firstChildFiber;
    } catch (x) {
      if (x === SuspenseException || x === SuspenseActionException)
        throw x;
      var fiber = createFiberImplClass(29, x, null, returnFiber.mode);
      fiber.lanes = lanes;
      fiber.return = returnFiber;
      return fiber;
    } finally {}
  };
}
function initializeUpdateQueue(fiber) {
  fiber.updateQueue = {
    baseState: fiber.memoizedState,
    firstBaseUpdate: null,
    lastBaseUpdate: null,
    shared: { pending: null, lanes: 0, hiddenCallbacks: null },
    callbacks: null
  };
}
function cloneUpdateQueue(current, workInProgress) {
  current = current.updateQueue;
  workInProgress.updateQueue === current && (workInProgress.updateQueue = {
    baseState: current.baseState,
    firstBaseUpdate: current.firstBaseUpdate,
    lastBaseUpdate: current.lastBaseUpdate,
    shared: current.shared,
    callbacks: null
  });
}
function createUpdate(lane) {
  return { lane, tag: 0, payload: null, callback: null, next: null };
}
function enqueueUpdate(fiber, update, lane) {
  var updateQueue = fiber.updateQueue;
  if (updateQueue === null)
    return null;
  updateQueue = updateQueue.shared;
  if ((executionContext & 2) !== 0) {
    var pending = updateQueue.pending;
    pending === null ? update.next = update : (update.next = pending.next, pending.next = update);
    updateQueue.pending = update;
    update = getRootForUpdatedFiber(fiber);
    markUpdateLaneFromFiberToRoot(fiber, null, lane);
    return update;
  }
  enqueueUpdate$1(fiber, updateQueue, update, lane);
  return getRootForUpdatedFiber(fiber);
}
function entangleTransitions(root2, fiber, lane) {
  fiber = fiber.updateQueue;
  if (fiber !== null && (fiber = fiber.shared, (lane & 4194048) !== 0)) {
    var queueLanes = fiber.lanes;
    queueLanes &= root2.pendingLanes;
    lane |= queueLanes;
    fiber.lanes = lane;
    markRootEntangled(root2, lane);
  }
}
function enqueueCapturedUpdate(workInProgress, capturedUpdate) {
  var { updateQueue: queue, alternate: current } = workInProgress;
  if (current !== null && (current = current.updateQueue, queue === current)) {
    var newFirst = null, newLast = null;
    queue = queue.firstBaseUpdate;
    if (queue !== null) {
      do {
        var clone = {
          lane: queue.lane,
          tag: queue.tag,
          payload: queue.payload,
          callback: null,
          next: null
        };
        newLast === null ? newFirst = newLast = clone : newLast = newLast.next = clone;
        queue = queue.next;
      } while (queue !== null);
      newLast === null ? newFirst = newLast = capturedUpdate : newLast = newLast.next = capturedUpdate;
    } else
      newFirst = newLast = capturedUpdate;
    queue = {
      baseState: current.baseState,
      firstBaseUpdate: newFirst,
      lastBaseUpdate: newLast,
      shared: current.shared,
      callbacks: current.callbacks
    };
    workInProgress.updateQueue = queue;
    return;
  }
  workInProgress = queue.lastBaseUpdate;
  workInProgress === null ? queue.firstBaseUpdate = capturedUpdate : workInProgress.next = capturedUpdate;
  queue.lastBaseUpdate = capturedUpdate;
}
function suspendIfUpdateReadFromEntangledAsyncAction() {
  if (didReadFromEntangledAsyncAction) {
    var entangledActionThenable = currentEntangledActionThenable;
    if (entangledActionThenable !== null)
      throw entangledActionThenable;
  }
}
function processUpdateQueue(workInProgress$jscomp$0, props, instance$jscomp$0, renderLanes) {
  didReadFromEntangledAsyncAction = false;
  var queue = workInProgress$jscomp$0.updateQueue;
  hasForceUpdate = false;
  var { firstBaseUpdate, lastBaseUpdate } = queue, pendingQueue = queue.shared.pending;
  if (pendingQueue !== null) {
    queue.shared.pending = null;
    var lastPendingUpdate = pendingQueue, firstPendingUpdate = lastPendingUpdate.next;
    lastPendingUpdate.next = null;
    lastBaseUpdate === null ? firstBaseUpdate = firstPendingUpdate : lastBaseUpdate.next = firstPendingUpdate;
    lastBaseUpdate = lastPendingUpdate;
    var current = workInProgress$jscomp$0.alternate;
    current !== null && (current = current.updateQueue, pendingQueue = current.lastBaseUpdate, pendingQueue !== lastBaseUpdate && (pendingQueue === null ? current.firstBaseUpdate = firstPendingUpdate : pendingQueue.next = firstPendingUpdate, current.lastBaseUpdate = lastPendingUpdate));
  }
  if (firstBaseUpdate !== null) {
    var newState = queue.baseState;
    lastBaseUpdate = 0;
    current = firstPendingUpdate = lastPendingUpdate = null;
    pendingQueue = firstBaseUpdate;
    do {
      var updateLane = pendingQueue.lane & -536870913, isHiddenUpdate = updateLane !== pendingQueue.lane;
      if (isHiddenUpdate ? (workInProgressRootRenderLanes & updateLane) === updateLane : (renderLanes & updateLane) === updateLane) {
        updateLane !== 0 && updateLane === currentEntangledLane && (didReadFromEntangledAsyncAction = true);
        current !== null && (current = current.next = {
          lane: 0,
          tag: pendingQueue.tag,
          payload: pendingQueue.payload,
          callback: null,
          next: null
        });
        a: {
          var workInProgress = workInProgress$jscomp$0, update = pendingQueue;
          updateLane = props;
          var instance = instance$jscomp$0;
          switch (update.tag) {
            case 1:
              workInProgress = update.payload;
              if (typeof workInProgress === "function") {
                newState = workInProgress.call(instance, newState, updateLane);
                break a;
              }
              newState = workInProgress;
              break a;
            case 3:
              workInProgress.flags = workInProgress.flags & -65537 | 128;
            case 0:
              workInProgress = update.payload;
              updateLane = typeof workInProgress === "function" ? workInProgress.call(instance, newState, updateLane) : workInProgress;
              if (updateLane === null || updateLane === undefined)
                break a;
              newState = assign({}, newState, updateLane);
              break a;
            case 2:
              hasForceUpdate = true;
          }
        }
        updateLane = pendingQueue.callback;
        updateLane !== null && (workInProgress$jscomp$0.flags |= 64, isHiddenUpdate && (workInProgress$jscomp$0.flags |= 8192), isHiddenUpdate = queue.callbacks, isHiddenUpdate === null ? queue.callbacks = [updateLane] : isHiddenUpdate.push(updateLane));
      } else
        isHiddenUpdate = {
          lane: updateLane,
          tag: pendingQueue.tag,
          payload: pendingQueue.payload,
          callback: pendingQueue.callback,
          next: null
        }, current === null ? (firstPendingUpdate = current = isHiddenUpdate, lastPendingUpdate = newState) : current = current.next = isHiddenUpdate, lastBaseUpdate |= updateLane;
      pendingQueue = pendingQueue.next;
      if (pendingQueue === null)
        if (pendingQueue = queue.shared.pending, pendingQueue === null)
          break;
        else
          isHiddenUpdate = pendingQueue, pendingQueue = isHiddenUpdate.next, isHiddenUpdate.next = null, queue.lastBaseUpdate = isHiddenUpdate, queue.shared.pending = null;
    } while (1);
    current === null && (lastPendingUpdate = newState);
    queue.baseState = lastPendingUpdate;
    queue.firstBaseUpdate = firstPendingUpdate;
    queue.lastBaseUpdate = current;
    firstBaseUpdate === null && (queue.shared.lanes = 0);
    workInProgressRootSkippedLanes |= lastBaseUpdate;
    workInProgress$jscomp$0.lanes = lastBaseUpdate;
    workInProgress$jscomp$0.memoizedState = newState;
  }
}
function callCallback(callback, context) {
  if (typeof callback !== "function")
    throw Error(formatProdErrorMessage(191, callback));
  callback.call(context);
}
function commitCallbacks(updateQueue, context) {
  var callbacks = updateQueue.callbacks;
  if (callbacks !== null)
    for (updateQueue.callbacks = null, updateQueue = 0;updateQueue < callbacks.length; updateQueue++)
      callCallback(callbacks[updateQueue], context);
}
function pushHiddenContext(fiber, context) {
  fiber = entangledRenderLanes;
  push2(prevEntangledRenderLanesCursor, fiber);
  push2(currentTreeHiddenStackCursor, context);
  entangledRenderLanes = fiber | context.baseLanes;
}
function reuseHiddenContextOnStack() {
  push2(prevEntangledRenderLanesCursor, entangledRenderLanes);
  push2(currentTreeHiddenStackCursor, currentTreeHiddenStackCursor.current);
}
function popHiddenContext() {
  entangledRenderLanes = prevEntangledRenderLanesCursor.current;
  pop2(currentTreeHiddenStackCursor);
  pop2(prevEntangledRenderLanesCursor);
}
function pushPrimaryTreeSuspenseHandler(handler) {
  var current = handler.alternate;
  push2(suspenseStackCursor, suspenseStackCursor.current & 1);
  push2(suspenseHandlerStackCursor, handler);
  shellBoundary === null && (current === null || currentTreeHiddenStackCursor.current !== null ? shellBoundary = handler : current.memoizedState !== null && (shellBoundary = handler));
}
function pushDehydratedActivitySuspenseHandler(fiber) {
  push2(suspenseStackCursor, suspenseStackCursor.current);
  push2(suspenseHandlerStackCursor, fiber);
  shellBoundary === null && (shellBoundary = fiber);
}
function pushOffscreenSuspenseHandler(fiber) {
  fiber.tag === 22 ? (push2(suspenseStackCursor, suspenseStackCursor.current), push2(suspenseHandlerStackCursor, fiber), shellBoundary === null && (shellBoundary = fiber)) : reuseSuspenseHandlerOnStack(fiber);
}
function reuseSuspenseHandlerOnStack() {
  push2(suspenseStackCursor, suspenseStackCursor.current);
  push2(suspenseHandlerStackCursor, suspenseHandlerStackCursor.current);
}
function popSuspenseHandler(fiber) {
  pop2(suspenseHandlerStackCursor);
  shellBoundary === fiber && (shellBoundary = null);
  pop2(suspenseStackCursor);
}
function findFirstSuspended(row) {
  for (var node = row;node !== null; ) {
    if (node.tag === 13) {
      var state = node.memoizedState;
      if (state !== null && (state = state.dehydrated, state === null || isSuspenseInstancePending(state) || isSuspenseInstanceFallback(state)))
        return node;
    } else if (node.tag === 19 && (node.memoizedProps.revealOrder === "forwards" || node.memoizedProps.revealOrder === "backwards" || node.memoizedProps.revealOrder === "unstable_legacy-backwards" || node.memoizedProps.revealOrder === "together")) {
      if ((node.flags & 128) !== 0)
        return node;
    } else if (node.child !== null) {
      node.child.return = node;
      node = node.child;
      continue;
    }
    if (node === row)
      break;
    for (;node.sibling === null; ) {
      if (node.return === null || node.return === row)
        return null;
      node = node.return;
    }
    node.sibling.return = node.return;
    node = node.sibling;
  }
  return null;
}
function throwInvalidHookError() {
  throw Error(formatProdErrorMessage(321));
}
function areHookInputsEqual(nextDeps, prevDeps) {
  if (prevDeps === null)
    return false;
  for (var i = 0;i < prevDeps.length && i < nextDeps.length; i++)
    if (!objectIs(nextDeps[i], prevDeps[i]))
      return false;
  return true;
}
function renderWithHooks(current, workInProgress, Component, props, secondArg, nextRenderLanes) {
  renderLanes = nextRenderLanes;
  currentlyRenderingFiber = workInProgress;
  workInProgress.memoizedState = null;
  workInProgress.updateQueue = null;
  workInProgress.lanes = 0;
  ReactSharedInternals.H = current === null || current.memoizedState === null ? HooksDispatcherOnMount : HooksDispatcherOnUpdate;
  shouldDoubleInvokeUserFnsInHooksDEV = false;
  nextRenderLanes = Component(props, secondArg);
  shouldDoubleInvokeUserFnsInHooksDEV = false;
  didScheduleRenderPhaseUpdateDuringThisPass && (nextRenderLanes = renderWithHooksAgain(workInProgress, Component, props, secondArg));
  finishRenderingHooks(current);
  return nextRenderLanes;
}
function finishRenderingHooks(current) {
  ReactSharedInternals.H = ContextOnlyDispatcher;
  var didRenderTooFewHooks = currentHook !== null && currentHook.next !== null;
  renderLanes = 0;
  workInProgressHook = currentHook = currentlyRenderingFiber = null;
  didScheduleRenderPhaseUpdate = false;
  thenableIndexCounter = 0;
  thenableState = null;
  if (didRenderTooFewHooks)
    throw Error(formatProdErrorMessage(300));
  current === null || didReceiveUpdate || (current = current.dependencies, current !== null && checkIfContextChanged(current) && (didReceiveUpdate = true));
}
function renderWithHooksAgain(workInProgress, Component, props, secondArg) {
  currentlyRenderingFiber = workInProgress;
  var numberOfReRenders = 0;
  do {
    didScheduleRenderPhaseUpdateDuringThisPass && (thenableState = null);
    thenableIndexCounter = 0;
    didScheduleRenderPhaseUpdateDuringThisPass = false;
    if (25 <= numberOfReRenders)
      throw Error(formatProdErrorMessage(301));
    numberOfReRenders += 1;
    workInProgressHook = currentHook = null;
    if (workInProgress.updateQueue != null) {
      var children = workInProgress.updateQueue;
      children.lastEffect = null;
      children.events = null;
      children.stores = null;
      children.memoCache != null && (children.memoCache.index = 0);
    }
    ReactSharedInternals.H = HooksDispatcherOnRerender;
    children = Component(props, secondArg);
  } while (didScheduleRenderPhaseUpdateDuringThisPass);
  return children;
}
function TransitionAwareHostComponent() {
  var dispatcher = ReactSharedInternals.H, maybeThenable = dispatcher.useState()[0];
  maybeThenable = typeof maybeThenable.then === "function" ? useThenable(maybeThenable) : maybeThenable;
  dispatcher = dispatcher.useState()[0];
  (currentHook !== null ? currentHook.memoizedState : null) !== dispatcher && (currentlyRenderingFiber.flags |= 1024);
  return maybeThenable;
}
function checkDidRenderIdHook() {
  var didRenderIdHook = localIdCounter !== 0;
  localIdCounter = 0;
  return didRenderIdHook;
}
function bailoutHooks(current, workInProgress, lanes) {
  workInProgress.updateQueue = current.updateQueue;
  workInProgress.flags &= -2053;
  current.lanes &= ~lanes;
}
function resetHooksOnUnwind(workInProgress) {
  if (didScheduleRenderPhaseUpdate) {
    for (workInProgress = workInProgress.memoizedState;workInProgress !== null; ) {
      var queue = workInProgress.queue;
      queue !== null && (queue.pending = null);
      workInProgress = workInProgress.next;
    }
    didScheduleRenderPhaseUpdate = false;
  }
  renderLanes = 0;
  workInProgressHook = currentHook = currentlyRenderingFiber = null;
  didScheduleRenderPhaseUpdateDuringThisPass = false;
  thenableIndexCounter = localIdCounter = 0;
  thenableState = null;
}
function mountWorkInProgressHook() {
  var hook = {
    memoizedState: null,
    baseState: null,
    baseQueue: null,
    queue: null,
    next: null
  };
  workInProgressHook === null ? currentlyRenderingFiber.memoizedState = workInProgressHook = hook : workInProgressHook = workInProgressHook.next = hook;
  return workInProgressHook;
}
function updateWorkInProgressHook() {
  if (currentHook === null) {
    var nextCurrentHook = currentlyRenderingFiber.alternate;
    nextCurrentHook = nextCurrentHook !== null ? nextCurrentHook.memoizedState : null;
  } else
    nextCurrentHook = currentHook.next;
  var nextWorkInProgressHook = workInProgressHook === null ? currentlyRenderingFiber.memoizedState : workInProgressHook.next;
  if (nextWorkInProgressHook !== null)
    workInProgressHook = nextWorkInProgressHook, currentHook = nextCurrentHook;
  else {
    if (nextCurrentHook === null) {
      if (currentlyRenderingFiber.alternate === null)
        throw Error(formatProdErrorMessage(467));
      throw Error(formatProdErrorMessage(310));
    }
    currentHook = nextCurrentHook;
    nextCurrentHook = {
      memoizedState: currentHook.memoizedState,
      baseState: currentHook.baseState,
      baseQueue: currentHook.baseQueue,
      queue: currentHook.queue,
      next: null
    };
    workInProgressHook === null ? currentlyRenderingFiber.memoizedState = workInProgressHook = nextCurrentHook : workInProgressHook = workInProgressHook.next = nextCurrentHook;
  }
  return workInProgressHook;
}
function createFunctionComponentUpdateQueue() {
  return { lastEffect: null, events: null, stores: null, memoCache: null };
}
function useThenable(thenable) {
  var index2 = thenableIndexCounter;
  thenableIndexCounter += 1;
  thenableState === null && (thenableState = []);
  thenable = trackUsedThenable(thenableState, thenable, index2);
  index2 = currentlyRenderingFiber;
  (workInProgressHook === null ? index2.memoizedState : workInProgressHook.next) === null && (index2 = index2.alternate, ReactSharedInternals.H = index2 === null || index2.memoizedState === null ? HooksDispatcherOnMount : HooksDispatcherOnUpdate);
  return thenable;
}
function use(usable) {
  if (usable !== null && typeof usable === "object") {
    if (typeof usable.then === "function")
      return useThenable(usable);
    if (usable.$$typeof === REACT_CONTEXT_TYPE)
      return readContext(usable);
  }
  throw Error(formatProdErrorMessage(438, String(usable)));
}
function useMemoCache(size) {
  var memoCache = null, updateQueue = currentlyRenderingFiber.updateQueue;
  updateQueue !== null && (memoCache = updateQueue.memoCache);
  if (memoCache == null) {
    var current = currentlyRenderingFiber.alternate;
    current !== null && (current = current.updateQueue, current !== null && (current = current.memoCache, current != null && (memoCache = {
      data: current.data.map(function(array) {
        return array.slice();
      }),
      index: 0
    })));
  }
  memoCache == null && (memoCache = { data: [], index: 0 });
  updateQueue === null && (updateQueue = createFunctionComponentUpdateQueue(), currentlyRenderingFiber.updateQueue = updateQueue);
  updateQueue.memoCache = memoCache;
  updateQueue = memoCache.data[memoCache.index];
  if (updateQueue === undefined)
    for (updateQueue = memoCache.data[memoCache.index] = Array(size), current = 0;current < size; current++)
      updateQueue[current] = REACT_MEMO_CACHE_SENTINEL;
  memoCache.index++;
  return updateQueue;
}
function basicStateReducer(state, action) {
  return typeof action === "function" ? action(state) : action;
}
function updateReducer(reducer) {
  var hook = updateWorkInProgressHook();
  return updateReducerImpl(hook, currentHook, reducer);
}
function updateReducerImpl(hook, current, reducer) {
  var queue = hook.queue;
  if (queue === null)
    throw Error(formatProdErrorMessage(311));
  queue.lastRenderedReducer = reducer;
  var baseQueue = hook.baseQueue, pendingQueue = queue.pending;
  if (pendingQueue !== null) {
    if (baseQueue !== null) {
      var baseFirst = baseQueue.next;
      baseQueue.next = pendingQueue.next;
      pendingQueue.next = baseFirst;
    }
    current.baseQueue = baseQueue = pendingQueue;
    queue.pending = null;
  }
  pendingQueue = hook.baseState;
  if (baseQueue === null)
    hook.memoizedState = pendingQueue;
  else {
    current = baseQueue.next;
    var newBaseQueueFirst = baseFirst = null, newBaseQueueLast = null, update = current, didReadFromEntangledAsyncAction$69 = false;
    do {
      var updateLane = update.lane & -536870913;
      if (updateLane !== update.lane ? (workInProgressRootRenderLanes & updateLane) === updateLane : (renderLanes & updateLane) === updateLane) {
        var revertLane = update.revertLane;
        if (revertLane === 0)
          newBaseQueueLast !== null && (newBaseQueueLast = newBaseQueueLast.next = {
            lane: 0,
            revertLane: 0,
            gesture: null,
            action: update.action,
            hasEagerState: update.hasEagerState,
            eagerState: update.eagerState,
            next: null
          }), updateLane === currentEntangledLane && (didReadFromEntangledAsyncAction$69 = true);
        else if ((renderLanes & revertLane) === revertLane) {
          update = update.next;
          revertLane === currentEntangledLane && (didReadFromEntangledAsyncAction$69 = true);
          continue;
        } else
          updateLane = {
            lane: 0,
            revertLane: update.revertLane,
            gesture: null,
            action: update.action,
            hasEagerState: update.hasEagerState,
            eagerState: update.eagerState,
            next: null
          }, newBaseQueueLast === null ? (newBaseQueueFirst = newBaseQueueLast = updateLane, baseFirst = pendingQueue) : newBaseQueueLast = newBaseQueueLast.next = updateLane, currentlyRenderingFiber.lanes |= revertLane, workInProgressRootSkippedLanes |= revertLane;
        updateLane = update.action;
        shouldDoubleInvokeUserFnsInHooksDEV && reducer(pendingQueue, updateLane);
        pendingQueue = update.hasEagerState ? update.eagerState : reducer(pendingQueue, updateLane);
      } else
        revertLane = {
          lane: updateLane,
          revertLane: update.revertLane,
          gesture: update.gesture,
          action: update.action,
          hasEagerState: update.hasEagerState,
          eagerState: update.eagerState,
          next: null
        }, newBaseQueueLast === null ? (newBaseQueueFirst = newBaseQueueLast = revertLane, baseFirst = pendingQueue) : newBaseQueueLast = newBaseQueueLast.next = revertLane, currentlyRenderingFiber.lanes |= updateLane, workInProgressRootSkippedLanes |= updateLane;
      update = update.next;
    } while (update !== null && update !== current);
    newBaseQueueLast === null ? baseFirst = pendingQueue : newBaseQueueLast.next = newBaseQueueFirst;
    if (!objectIs(pendingQueue, hook.memoizedState) && (didReceiveUpdate = true, didReadFromEntangledAsyncAction$69 && (reducer = currentEntangledActionThenable, reducer !== null)))
      throw reducer;
    hook.memoizedState = pendingQueue;
    hook.baseState = baseFirst;
    hook.baseQueue = newBaseQueueLast;
    queue.lastRenderedState = pendingQueue;
  }
  baseQueue === null && (queue.lanes = 0);
  return [hook.memoizedState, queue.dispatch];
}
function rerenderReducer(reducer) {
  var hook = updateWorkInProgressHook(), queue = hook.queue;
  if (queue === null)
    throw Error(formatProdErrorMessage(311));
  queue.lastRenderedReducer = reducer;
  var { dispatch, pending: lastRenderPhaseUpdate } = queue, newState = hook.memoizedState;
  if (lastRenderPhaseUpdate !== null) {
    queue.pending = null;
    var update = lastRenderPhaseUpdate = lastRenderPhaseUpdate.next;
    do
      newState = reducer(newState, update.action), update = update.next;
    while (update !== lastRenderPhaseUpdate);
    objectIs(newState, hook.memoizedState) || (didReceiveUpdate = true);
    hook.memoizedState = newState;
    hook.baseQueue === null && (hook.baseState = newState);
    queue.lastRenderedState = newState;
  }
  return [newState, dispatch];
}
function updateSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) {
  var fiber = currentlyRenderingFiber, hook = updateWorkInProgressHook(), isHydrating$jscomp$0 = isHydrating;
  if (isHydrating$jscomp$0) {
    if (getServerSnapshot === undefined)
      throw Error(formatProdErrorMessage(407));
    getServerSnapshot = getServerSnapshot();
  } else
    getServerSnapshot = getSnapshot();
  var snapshotChanged = !objectIs((currentHook || hook).memoizedState, getServerSnapshot);
  snapshotChanged && (hook.memoizedState = getServerSnapshot, didReceiveUpdate = true);
  hook = hook.queue;
  updateEffect(subscribeToStore.bind(null, fiber, hook, subscribe), [
    subscribe
  ]);
  if (hook.getSnapshot !== getSnapshot || snapshotChanged || workInProgressHook !== null && workInProgressHook.memoizedState.tag & 1) {
    fiber.flags |= 2048;
    pushSimpleEffect(9, { destroy: undefined }, updateStoreInstance.bind(null, fiber, hook, getServerSnapshot, getSnapshot), null);
    if (workInProgressRoot === null)
      throw Error(formatProdErrorMessage(349));
    isHydrating$jscomp$0 || (renderLanes & 127) !== 0 || pushStoreConsistencyCheck(fiber, getSnapshot, getServerSnapshot);
  }
  return getServerSnapshot;
}
function pushStoreConsistencyCheck(fiber, getSnapshot, renderedSnapshot) {
  fiber.flags |= 16384;
  fiber = { getSnapshot, value: renderedSnapshot };
  getSnapshot = currentlyRenderingFiber.updateQueue;
  getSnapshot === null ? (getSnapshot = createFunctionComponentUpdateQueue(), currentlyRenderingFiber.updateQueue = getSnapshot, getSnapshot.stores = [fiber]) : (renderedSnapshot = getSnapshot.stores, renderedSnapshot === null ? getSnapshot.stores = [fiber] : renderedSnapshot.push(fiber));
}
function updateStoreInstance(fiber, inst, nextSnapshot, getSnapshot) {
  inst.value = nextSnapshot;
  inst.getSnapshot = getSnapshot;
  checkIfSnapshotChanged(inst) && forceStoreRerender(fiber);
}
function subscribeToStore(fiber, inst, subscribe) {
  return subscribe(function() {
    checkIfSnapshotChanged(inst) && (startUpdateTimerByLane(2), forceStoreRerender(fiber));
  });
}
function checkIfSnapshotChanged(inst) {
  var latestGetSnapshot = inst.getSnapshot;
  inst = inst.value;
  try {
    var nextValue = latestGetSnapshot();
    return !objectIs(inst, nextValue);
  } catch (error) {
    return true;
  }
}
function forceStoreRerender(fiber) {
  var root2 = enqueueConcurrentRenderForLane(fiber, 2);
  root2 !== null && scheduleUpdateOnFiber(root2, fiber, 2);
}
function mountStateImpl(initialState) {
  var hook = mountWorkInProgressHook();
  if (typeof initialState === "function") {
    var initialStateInitializer = initialState;
    initialState = initialStateInitializer();
    if (shouldDoubleInvokeUserFnsInHooksDEV) {
      setIsStrictModeForDevtools(true);
      try {
        initialStateInitializer();
      } finally {
        setIsStrictModeForDevtools(false);
      }
    }
  }
  hook.memoizedState = hook.baseState = initialState;
  hook.queue = {
    pending: null,
    lanes: 0,
    dispatch: null,
    lastRenderedReducer: basicStateReducer,
    lastRenderedState: initialState
  };
  return hook;
}
function updateOptimisticImpl(hook, current, passthrough, reducer) {
  hook.baseState = passthrough;
  return updateReducerImpl(hook, currentHook, typeof reducer === "function" ? reducer : basicStateReducer);
}
function dispatchActionState(fiber, actionQueue, setPendingState, setState, payload) {
  if (isRenderPhaseUpdate(fiber))
    throw Error(formatProdErrorMessage(485));
  fiber = actionQueue.action;
  if (fiber !== null) {
    var actionNode = {
      payload,
      action: fiber,
      next: null,
      isTransition: true,
      status: "pending",
      value: null,
      reason: null,
      listeners: [],
      then: function(listener) {
        actionNode.listeners.push(listener);
      }
    };
    ReactSharedInternals.T !== null ? setPendingState(true) : actionNode.isTransition = false;
    setState(actionNode);
    setPendingState = actionQueue.pending;
    setPendingState === null ? (actionNode.next = actionQueue.pending = actionNode, runActionStateAction(actionQueue, actionNode)) : (actionNode.next = setPendingState.next, actionQueue.pending = setPendingState.next = actionNode);
  }
}
function runActionStateAction(actionQueue, node) {
  var { action, payload } = node, prevState = actionQueue.state;
  if (node.isTransition) {
    var prevTransition = ReactSharedInternals.T, currentTransition = {};
    ReactSharedInternals.T = currentTransition;
    try {
      var returnValue = action(prevState, payload), onStartTransitionFinish = ReactSharedInternals.S;
      onStartTransitionFinish !== null && onStartTransitionFinish(currentTransition, returnValue);
      handleActionReturnValue(actionQueue, node, returnValue);
    } catch (error) {
      onActionError(actionQueue, node, error);
    } finally {
      prevTransition !== null && currentTransition.types !== null && (prevTransition.types = currentTransition.types), ReactSharedInternals.T = prevTransition;
    }
  } else
    try {
      prevTransition = action(prevState, payload), handleActionReturnValue(actionQueue, node, prevTransition);
    } catch (error$75) {
      onActionError(actionQueue, node, error$75);
    }
}
function handleActionReturnValue(actionQueue, node, returnValue) {
  returnValue !== null && typeof returnValue === "object" && typeof returnValue.then === "function" ? returnValue.then(function(nextState) {
    onActionSuccess(actionQueue, node, nextState);
  }, function(error) {
    return onActionError(actionQueue, node, error);
  }) : onActionSuccess(actionQueue, node, returnValue);
}
function onActionSuccess(actionQueue, actionNode, nextState) {
  actionNode.status = "fulfilled";
  actionNode.value = nextState;
  notifyActionListeners(actionNode);
  actionQueue.state = nextState;
  actionNode = actionQueue.pending;
  actionNode !== null && (nextState = actionNode.next, nextState === actionNode ? actionQueue.pending = null : (nextState = nextState.next, actionNode.next = nextState, runActionStateAction(actionQueue, nextState)));
}
function onActionError(actionQueue, actionNode, error) {
  var last = actionQueue.pending;
  actionQueue.pending = null;
  if (last !== null) {
    last = last.next;
    do
      actionNode.status = "rejected", actionNode.reason = error, notifyActionListeners(actionNode), actionNode = actionNode.next;
    while (actionNode !== last);
  }
  actionQueue.action = null;
}
function notifyActionListeners(actionNode) {
  actionNode = actionNode.listeners;
  for (var i = 0;i < actionNode.length; i++)
    (0, actionNode[i])();
}
function actionStateReducer(oldState, newState) {
  return newState;
}
function mountActionState(action, initialStateProp) {
  if (isHydrating) {
    var ssrFormState = workInProgressRoot.formState;
    if (ssrFormState !== null) {
      a: {
        var JSCompiler_inline_result = currentlyRenderingFiber;
        if (isHydrating) {
          if (nextHydratableInstance) {
            b: {
              var JSCompiler_inline_result$jscomp$0 = nextHydratableInstance;
              for (var inRootOrSingleton = rootOrSingletonContext;JSCompiler_inline_result$jscomp$0.nodeType !== 8; ) {
                if (!inRootOrSingleton) {
                  JSCompiler_inline_result$jscomp$0 = null;
                  break b;
                }
                JSCompiler_inline_result$jscomp$0 = getNextHydratable(JSCompiler_inline_result$jscomp$0.nextSibling);
                if (JSCompiler_inline_result$jscomp$0 === null) {
                  JSCompiler_inline_result$jscomp$0 = null;
                  break b;
                }
              }
              inRootOrSingleton = JSCompiler_inline_result$jscomp$0.data;
              JSCompiler_inline_result$jscomp$0 = inRootOrSingleton === "F!" || inRootOrSingleton === "F" ? JSCompiler_inline_result$jscomp$0 : null;
            }
            if (JSCompiler_inline_result$jscomp$0) {
              nextHydratableInstance = getNextHydratable(JSCompiler_inline_result$jscomp$0.nextSibling);
              JSCompiler_inline_result = JSCompiler_inline_result$jscomp$0.data === "F!";
              break a;
            }
          }
          throwOnHydrationMismatch(JSCompiler_inline_result);
        }
        JSCompiler_inline_result = false;
      }
      JSCompiler_inline_result && (initialStateProp = ssrFormState[0]);
    }
  }
  ssrFormState = mountWorkInProgressHook();
  ssrFormState.memoizedState = ssrFormState.baseState = initialStateProp;
  JSCompiler_inline_result = {
    pending: null,
    lanes: 0,
    dispatch: null,
    lastRenderedReducer: actionStateReducer,
    lastRenderedState: initialStateProp
  };
  ssrFormState.queue = JSCompiler_inline_result;
  ssrFormState = dispatchSetState.bind(null, currentlyRenderingFiber, JSCompiler_inline_result);
  JSCompiler_inline_result.dispatch = ssrFormState;
  JSCompiler_inline_result = mountStateImpl(false);
  inRootOrSingleton = dispatchOptimisticSetState.bind(null, currentlyRenderingFiber, false, JSCompiler_inline_result.queue);
  JSCompiler_inline_result = mountWorkInProgressHook();
  JSCompiler_inline_result$jscomp$0 = {
    state: initialStateProp,
    dispatch: null,
    action,
    pending: null
  };
  JSCompiler_inline_result.queue = JSCompiler_inline_result$jscomp$0;
  ssrFormState = dispatchActionState.bind(null, currentlyRenderingFiber, JSCompiler_inline_result$jscomp$0, inRootOrSingleton, ssrFormState);
  JSCompiler_inline_result$jscomp$0.dispatch = ssrFormState;
  JSCompiler_inline_result.memoizedState = action;
  return [initialStateProp, ssrFormState, false];
}
function updateActionState(action) {
  var stateHook = updateWorkInProgressHook();
  return updateActionStateImpl(stateHook, currentHook, action);
}
function updateActionStateImpl(stateHook, currentStateHook, action) {
  currentStateHook = updateReducerImpl(stateHook, currentStateHook, actionStateReducer)[0];
  stateHook = updateReducer(basicStateReducer)[0];
  if (typeof currentStateHook === "object" && currentStateHook !== null && typeof currentStateHook.then === "function")
    try {
      var state = useThenable(currentStateHook);
    } catch (x) {
      if (x === SuspenseException)
        throw SuspenseActionException;
      throw x;
    }
  else
    state = currentStateHook;
  currentStateHook = updateWorkInProgressHook();
  var actionQueue = currentStateHook.queue, dispatch = actionQueue.dispatch;
  action !== currentStateHook.memoizedState && (currentlyRenderingFiber.flags |= 2048, pushSimpleEffect(9, { destroy: undefined }, actionStateActionEffect.bind(null, actionQueue, action), null));
  return [state, dispatch, stateHook];
}
function actionStateActionEffect(actionQueue, action) {
  actionQueue.action = action;
}
function rerenderActionState(action) {
  var stateHook = updateWorkInProgressHook(), currentStateHook = currentHook;
  if (currentStateHook !== null)
    return updateActionStateImpl(stateHook, currentStateHook, action);
  updateWorkInProgressHook();
  stateHook = stateHook.memoizedState;
  currentStateHook = updateWorkInProgressHook();
  var dispatch = currentStateHook.queue.dispatch;
  currentStateHook.memoizedState = action;
  return [stateHook, dispatch, false];
}
function pushSimpleEffect(tag, inst, create, deps) {
  tag = { tag, create, deps, inst, next: null };
  inst = currentlyRenderingFiber.updateQueue;
  inst === null && (inst = createFunctionComponentUpdateQueue(), currentlyRenderingFiber.updateQueue = inst);
  create = inst.lastEffect;
  create === null ? inst.lastEffect = tag.next = tag : (deps = create.next, create.next = tag, tag.next = deps, inst.lastEffect = tag);
  return tag;
}
function updateRef() {
  return updateWorkInProgressHook().memoizedState;
}
function mountEffectImpl(fiberFlags, hookFlags, create, deps) {
  var hook = mountWorkInProgressHook();
  currentlyRenderingFiber.flags |= fiberFlags;
  hook.memoizedState = pushSimpleEffect(1 | hookFlags, { destroy: undefined }, create, deps === undefined ? null : deps);
}
function updateEffectImpl(fiberFlags, hookFlags, create, deps) {
  var hook = updateWorkInProgressHook();
  deps = deps === undefined ? null : deps;
  var inst = hook.memoizedState.inst;
  currentHook !== null && deps !== null && areHookInputsEqual(deps, currentHook.memoizedState.deps) ? hook.memoizedState = pushSimpleEffect(hookFlags, inst, create, deps) : (currentlyRenderingFiber.flags |= fiberFlags, hook.memoizedState = pushSimpleEffect(1 | hookFlags, inst, create, deps));
}
function mountEffect(create, deps) {
  mountEffectImpl(8390656, 8, create, deps);
}
function updateEffect(create, deps) {
  updateEffectImpl(2048, 8, create, deps);
}
function useEffectEventImpl(payload) {
  currentlyRenderingFiber.flags |= 4;
  var componentUpdateQueue = currentlyRenderingFiber.updateQueue;
  if (componentUpdateQueue === null)
    componentUpdateQueue = createFunctionComponentUpdateQueue(), currentlyRenderingFiber.updateQueue = componentUpdateQueue, componentUpdateQueue.events = [payload];
  else {
    var events = componentUpdateQueue.events;
    events === null ? componentUpdateQueue.events = [payload] : events.push(payload);
  }
}
function updateEvent(callback) {
  var ref = updateWorkInProgressHook().memoizedState;
  useEffectEventImpl({ ref, nextImpl: callback });
  return function() {
    if ((executionContext & 2) !== 0)
      throw Error(formatProdErrorMessage(440));
    return ref.impl.apply(undefined, arguments);
  };
}
function updateInsertionEffect(create, deps) {
  return updateEffectImpl(4, 2, create, deps);
}
function updateLayoutEffect(create, deps) {
  return updateEffectImpl(4, 4, create, deps);
}
function imperativeHandleEffect(create, ref) {
  if (typeof ref === "function") {
    create = create();
    var refCleanup = ref(create);
    return function() {
      typeof refCleanup === "function" ? refCleanup() : ref(null);
    };
  }
  if (ref !== null && ref !== undefined)
    return create = create(), ref.current = create, function() {
      ref.current = null;
    };
}
function updateImperativeHandle(ref, create, deps) {
  deps = deps !== null && deps !== undefined ? deps.concat([ref]) : null;
  updateEffectImpl(4, 4, imperativeHandleEffect.bind(null, create, ref), deps);
}
function mountDebugValue() {}
function updateCallback(callback, deps) {
  var hook = updateWorkInProgressHook();
  deps = deps === undefined ? null : deps;
  var prevState = hook.memoizedState;
  if (deps !== null && areHookInputsEqual(deps, prevState[1]))
    return prevState[0];
  hook.memoizedState = [callback, deps];
  return callback;
}
function updateMemo(nextCreate, deps) {
  var hook = updateWorkInProgressHook();
  deps = deps === undefined ? null : deps;
  var prevState = hook.memoizedState;
  if (deps !== null && areHookInputsEqual(deps, prevState[1]))
    return prevState[0];
  prevState = nextCreate();
  if (shouldDoubleInvokeUserFnsInHooksDEV) {
    setIsStrictModeForDevtools(true);
    try {
      nextCreate();
    } finally {
      setIsStrictModeForDevtools(false);
    }
  }
  hook.memoizedState = [prevState, deps];
  return prevState;
}
function mountDeferredValueImpl(hook, value, initialValue) {
  if (initialValue === undefined || (renderLanes & 1073741824) !== 0 && (workInProgressRootRenderLanes & 261930) === 0)
    return hook.memoizedState = value;
  hook.memoizedState = initialValue;
  hook = requestDeferredLane();
  currentlyRenderingFiber.lanes |= hook;
  workInProgressRootSkippedLanes |= hook;
  return initialValue;
}
function updateDeferredValueImpl(hook, prevValue, value, initialValue) {
  if (objectIs(value, prevValue))
    return value;
  if (currentTreeHiddenStackCursor.current !== null)
    return hook = mountDeferredValueImpl(hook, value, initialValue), objectIs(hook, prevValue) || (didReceiveUpdate = true), hook;
  if ((renderLanes & 42) === 0 || (renderLanes & 1073741824) !== 0 && (workInProgressRootRenderLanes & 261930) === 0)
    return didReceiveUpdate = true, hook.memoizedState = value;
  hook = requestDeferredLane();
  currentlyRenderingFiber.lanes |= hook;
  workInProgressRootSkippedLanes |= hook;
  return prevValue;
}
function startTransition(fiber, queue, pendingState, finishedState, callback) {
  var previousPriority = ReactDOMSharedInternals.p;
  ReactDOMSharedInternals.p = previousPriority !== 0 && 8 > previousPriority ? previousPriority : 8;
  var prevTransition = ReactSharedInternals.T, currentTransition = {};
  ReactSharedInternals.T = currentTransition;
  dispatchOptimisticSetState(fiber, false, queue, pendingState);
  try {
    var returnValue = callback(), onStartTransitionFinish = ReactSharedInternals.S;
    onStartTransitionFinish !== null && onStartTransitionFinish(currentTransition, returnValue);
    if (returnValue !== null && typeof returnValue === "object" && typeof returnValue.then === "function") {
      var thenableForFinishedState = chainThenableValue(returnValue, finishedState);
      dispatchSetStateInternal(fiber, queue, thenableForFinishedState, requestUpdateLane(fiber));
    } else
      dispatchSetStateInternal(fiber, queue, finishedState, requestUpdateLane(fiber));
  } catch (error) {
    dispatchSetStateInternal(fiber, queue, { then: function() {}, status: "rejected", reason: error }, requestUpdateLane());
  } finally {
    ReactDOMSharedInternals.p = previousPriority, prevTransition !== null && currentTransition.types !== null && (prevTransition.types = currentTransition.types), ReactSharedInternals.T = prevTransition;
  }
}
function noop() {}
function startHostTransition(formFiber, pendingState, action, formData) {
  if (formFiber.tag !== 5)
    throw Error(formatProdErrorMessage(476));
  var queue = ensureFormComponentIsStateful(formFiber).queue;
  startHostActionTimer();
  startTransition(formFiber, queue, pendingState, sharedNotPendingObject, action === null ? noop : function() {
    requestFormReset$2(formFiber);
    return action(formData);
  });
}
function ensureFormComponentIsStateful(formFiber) {
  var existingStateHook = formFiber.memoizedState;
  if (existingStateHook !== null)
    return existingStateHook;
  existingStateHook = {
    memoizedState: sharedNotPendingObject,
    baseState: sharedNotPendingObject,
    baseQueue: null,
    queue: {
      pending: null,
      lanes: 0,
      dispatch: null,
      lastRenderedReducer: basicStateReducer,
      lastRenderedState: sharedNotPendingObject
    },
    next: null
  };
  var initialResetState = {};
  existingStateHook.next = {
    memoizedState: initialResetState,
    baseState: initialResetState,
    baseQueue: null,
    queue: {
      pending: null,
      lanes: 0,
      dispatch: null,
      lastRenderedReducer: basicStateReducer,
      lastRenderedState: initialResetState
    },
    next: null
  };
  formFiber.memoizedState = existingStateHook;
  formFiber = formFiber.alternate;
  formFiber !== null && (formFiber.memoizedState = existingStateHook);
  return existingStateHook;
}
function requestFormReset$2(formFiber) {
  var stateHook = ensureFormComponentIsStateful(formFiber);
  stateHook.next === null && (stateHook = formFiber.alternate.memoizedState);
  dispatchSetStateInternal(formFiber, stateHook.next.queue, {}, requestUpdateLane());
}
function useHostTransitionStatus() {
  return readContext(HostTransitionContext);
}
function updateId() {
  return updateWorkInProgressHook().memoizedState;
}
function updateRefresh() {
  return updateWorkInProgressHook().memoizedState;
}
function refreshCache(fiber) {
  for (var provider = fiber.return;provider !== null; ) {
    switch (provider.tag) {
      case 24:
      case 3:
        var lane = requestUpdateLane();
        fiber = createUpdate(lane);
        var root$78 = enqueueUpdate(provider, fiber, lane);
        root$78 !== null && (startUpdateTimerByLane(lane), scheduleUpdateOnFiber(root$78, provider, lane), entangleTransitions(root$78, provider, lane));
        provider = { cache: createCache() };
        fiber.payload = provider;
        return;
    }
    provider = provider.return;
  }
}
function dispatchReducerAction(fiber, queue, action) {
  var lane = requestUpdateLane();
  action = {
    lane,
    revertLane: 0,
    gesture: null,
    action,
    hasEagerState: false,
    eagerState: null,
    next: null
  };
  isRenderPhaseUpdate(fiber) ? enqueueRenderPhaseUpdate(queue, action) : (action = enqueueConcurrentHookUpdate(fiber, queue, action, lane), action !== null && (startUpdateTimerByLane(lane), scheduleUpdateOnFiber(action, fiber, lane), entangleTransitionUpdate(action, queue, lane)));
}
function dispatchSetState(fiber, queue, action) {
  var lane = requestUpdateLane();
  dispatchSetStateInternal(fiber, queue, action, lane) && startUpdateTimerByLane(lane);
}
function dispatchSetStateInternal(fiber, queue, action, lane) {
  var update = {
    lane,
    revertLane: 0,
    gesture: null,
    action,
    hasEagerState: false,
    eagerState: null,
    next: null
  };
  if (isRenderPhaseUpdate(fiber))
    enqueueRenderPhaseUpdate(queue, update);
  else {
    var alternate = fiber.alternate;
    if (fiber.lanes === 0 && (alternate === null || alternate.lanes === 0) && (alternate = queue.lastRenderedReducer, alternate !== null))
      try {
        var currentState = queue.lastRenderedState, eagerState = alternate(currentState, action);
        update.hasEagerState = true;
        update.eagerState = eagerState;
        if (objectIs(eagerState, currentState))
          return enqueueUpdate$1(fiber, queue, update, 0), workInProgressRoot === null && finishQueueingConcurrentUpdates(), false;
      } catch (error) {} finally {}
    action = enqueueConcurrentHookUpdate(fiber, queue, update, lane);
    if (action !== null)
      return scheduleUpdateOnFiber(action, fiber, lane), entangleTransitionUpdate(action, queue, lane), true;
  }
  return false;
}
function dispatchOptimisticSetState(fiber, throwIfDuringRender, queue, action) {
  action = {
    lane: 2,
    revertLane: requestTransitionLane(),
    gesture: null,
    action,
    hasEagerState: false,
    eagerState: null,
    next: null
  };
  if (isRenderPhaseUpdate(fiber)) {
    if (throwIfDuringRender)
      throw Error(formatProdErrorMessage(479));
  } else
    throwIfDuringRender = enqueueConcurrentHookUpdate(fiber, queue, action, 2), throwIfDuringRender !== null && (startUpdateTimerByLane(2), scheduleUpdateOnFiber(throwIfDuringRender, fiber, 2));
}
function isRenderPhaseUpdate(fiber) {
  var alternate = fiber.alternate;
  return fiber === currentlyRenderingFiber || alternate !== null && alternate === currentlyRenderingFiber;
}
function enqueueRenderPhaseUpdate(queue, update) {
  didScheduleRenderPhaseUpdateDuringThisPass = didScheduleRenderPhaseUpdate = true;
  var pending = queue.pending;
  pending === null ? update.next = update : (update.next = pending.next, pending.next = update);
  queue.pending = update;
}
function entangleTransitionUpdate(root2, queue, lane) {
  if ((lane & 4194048) !== 0) {
    var queueLanes = queue.lanes;
    queueLanes &= root2.pendingLanes;
    lane |= queueLanes;
    queue.lanes = lane;
    markRootEntangled(root2, lane);
  }
}
function applyDerivedStateFromProps(workInProgress, ctor, getDerivedStateFromProps, nextProps) {
  ctor = workInProgress.memoizedState;
  getDerivedStateFromProps = getDerivedStateFromProps(nextProps, ctor);
  getDerivedStateFromProps = getDerivedStateFromProps === null || getDerivedStateFromProps === undefined ? ctor : assign({}, ctor, getDerivedStateFromProps);
  workInProgress.memoizedState = getDerivedStateFromProps;
  workInProgress.lanes === 0 && (workInProgress.updateQueue.baseState = getDerivedStateFromProps);
}
function checkShouldComponentUpdate(workInProgress, ctor, oldProps, newProps, oldState, newState, nextContext) {
  workInProgress = workInProgress.stateNode;
  return typeof workInProgress.shouldComponentUpdate === "function" ? workInProgress.shouldComponentUpdate(newProps, newState, nextContext) : ctor.prototype && ctor.prototype.isPureReactComponent ? !shallowEqual(oldProps, newProps) || !shallowEqual(oldState, newState) : true;
}
function callComponentWillReceiveProps(workInProgress, instance, newProps, nextContext) {
  workInProgress = instance.state;
  typeof instance.componentWillReceiveProps === "function" && instance.componentWillReceiveProps(newProps, nextContext);
  typeof instance.UNSAFE_componentWillReceiveProps === "function" && instance.UNSAFE_componentWillReceiveProps(newProps, nextContext);
  instance.state !== workInProgress && classComponentUpdater.enqueueReplaceState(instance, instance.state, null);
}
function resolveClassComponentProps(Component, baseProps) {
  var newProps = baseProps;
  if ("ref" in baseProps) {
    newProps = {};
    for (var propName in baseProps)
      propName !== "ref" && (newProps[propName] = baseProps[propName]);
  }
  if (Component = Component.defaultProps) {
    newProps === baseProps && (newProps = assign({}, newProps));
    for (var propName$82 in Component)
      newProps[propName$82] === undefined && (newProps[propName$82] = Component[propName$82]);
  }
  return newProps;
}
function defaultOnUncaughtError(error) {
  reportGlobalError(error);
}
function defaultOnCaughtError(error) {
  console.error(error);
}
function defaultOnRecoverableError(error) {
  reportGlobalError(error);
}
function logUncaughtError(root2, errorInfo) {
  try {
    var onUncaughtError = root2.onUncaughtError;
    onUncaughtError(errorInfo.value, { componentStack: errorInfo.stack });
  } catch (e$83) {
    setTimeout(function() {
      throw e$83;
    });
  }
}
function logCaughtError(root2, boundary, errorInfo) {
  try {
    var onCaughtError = root2.onCaughtError;
    onCaughtError(errorInfo.value, {
      componentStack: errorInfo.stack,
      errorBoundary: boundary.tag === 1 ? boundary.stateNode : null
    });
  } catch (e$84) {
    setTimeout(function() {
      throw e$84;
    });
  }
}
function createRootErrorUpdate(root2, errorInfo, lane) {
  lane = createUpdate(lane);
  lane.tag = 3;
  lane.payload = { element: null };
  lane.callback = function() {
    logUncaughtError(root2, errorInfo);
  };
  return lane;
}
function createClassErrorUpdate(lane) {
  lane = createUpdate(lane);
  lane.tag = 3;
  return lane;
}
function initializeClassErrorUpdate(update, root2, fiber, errorInfo) {
  var getDerivedStateFromError = fiber.type.getDerivedStateFromError;
  if (typeof getDerivedStateFromError === "function") {
    var error = errorInfo.value;
    update.payload = function() {
      return getDerivedStateFromError(error);
    };
    update.callback = function() {
      logCaughtError(root2, fiber, errorInfo);
    };
  }
  var inst = fiber.stateNode;
  inst !== null && typeof inst.componentDidCatch === "function" && (update.callback = function() {
    logCaughtError(root2, fiber, errorInfo);
    typeof getDerivedStateFromError !== "function" && (legacyErrorBoundariesThatAlreadyFailed === null ? legacyErrorBoundariesThatAlreadyFailed = new Set([this]) : legacyErrorBoundariesThatAlreadyFailed.add(this));
    var stack = errorInfo.stack;
    this.componentDidCatch(errorInfo.value, {
      componentStack: stack !== null ? stack : ""
    });
  });
}
function throwException(root2, returnFiber, sourceFiber, value, rootRenderLanes) {
  sourceFiber.flags |= 32768;
  isDevToolsPresent && restorePendingUpdaters(root2, rootRenderLanes);
  if (value !== null && typeof value === "object" && typeof value.then === "function") {
    returnFiber = sourceFiber.alternate;
    returnFiber !== null && propagateParentContextChanges(returnFiber, sourceFiber, rootRenderLanes, true);
    sourceFiber = suspenseHandlerStackCursor.current;
    if (sourceFiber !== null) {
      switch (sourceFiber.tag) {
        case 31:
        case 13:
          return shellBoundary === null ? renderDidSuspendDelayIfPossible() : sourceFiber.alternate === null && workInProgressRootExitStatus === 0 && (workInProgressRootExitStatus = 3), sourceFiber.flags &= -257, sourceFiber.flags |= 65536, sourceFiber.lanes = rootRenderLanes, value === noopSuspenseyCommitThenable ? sourceFiber.flags |= 16384 : (returnFiber = sourceFiber.updateQueue, returnFiber === null ? sourceFiber.updateQueue = new Set([value]) : returnFiber.add(value), attachPingListener(root2, value, rootRenderLanes)), false;
        case 22:
          return sourceFiber.flags |= 65536, value === noopSuspenseyCommitThenable ? sourceFiber.flags |= 16384 : (returnFiber = sourceFiber.updateQueue, returnFiber === null ? (returnFiber = {
            transitions: null,
            markerInstances: null,
            retryQueue: new Set([value])
          }, sourceFiber.updateQueue = returnFiber) : (sourceFiber = returnFiber.retryQueue, sourceFiber === null ? returnFiber.retryQueue = new Set([value]) : sourceFiber.add(value)), attachPingListener(root2, value, rootRenderLanes)), false;
      }
      throw Error(formatProdErrorMessage(435, sourceFiber.tag));
    }
    attachPingListener(root2, value, rootRenderLanes);
    renderDidSuspendDelayIfPossible();
    return false;
  }
  if (isHydrating)
    return returnFiber = suspenseHandlerStackCursor.current, returnFiber !== null ? ((returnFiber.flags & 65536) === 0 && (returnFiber.flags |= 256), returnFiber.flags |= 65536, returnFiber.lanes = rootRenderLanes, value !== HydrationMismatchException && (root2 = Error(formatProdErrorMessage(422), { cause: value }), queueHydrationError(createCapturedValueAtFiber(root2, sourceFiber)))) : (value !== HydrationMismatchException && (returnFiber = Error(formatProdErrorMessage(423), {
      cause: value
    }), queueHydrationError(createCapturedValueAtFiber(returnFiber, sourceFiber))), root2 = root2.current.alternate, root2.flags |= 65536, rootRenderLanes &= -rootRenderLanes, root2.lanes |= rootRenderLanes, value = createCapturedValueAtFiber(value, sourceFiber), rootRenderLanes = createRootErrorUpdate(root2.stateNode, value, rootRenderLanes), enqueueCapturedUpdate(root2, rootRenderLanes), workInProgressRootExitStatus !== 4 && (workInProgressRootExitStatus = 2)), false;
  var wrapperError = Error(formatProdErrorMessage(520), { cause: value });
  wrapperError = createCapturedValueAtFiber(wrapperError, sourceFiber);
  workInProgressRootConcurrentErrors === null ? workInProgressRootConcurrentErrors = [wrapperError] : workInProgressRootConcurrentErrors.push(wrapperError);
  workInProgressRootExitStatus !== 4 && (workInProgressRootExitStatus = 2);
  if (returnFiber === null)
    return true;
  value = createCapturedValueAtFiber(value, sourceFiber);
  sourceFiber = returnFiber;
  do {
    switch (sourceFiber.tag) {
      case 3:
        return sourceFiber.flags |= 65536, root2 = rootRenderLanes & -rootRenderLanes, sourceFiber.lanes |= root2, root2 = createRootErrorUpdate(sourceFiber.stateNode, value, root2), enqueueCapturedUpdate(sourceFiber, root2), false;
      case 1:
        if (returnFiber = sourceFiber.type, wrapperError = sourceFiber.stateNode, (sourceFiber.flags & 128) === 0 && (typeof returnFiber.getDerivedStateFromError === "function" || wrapperError !== null && typeof wrapperError.componentDidCatch === "function" && (legacyErrorBoundariesThatAlreadyFailed === null || !legacyErrorBoundariesThatAlreadyFailed.has(wrapperError))))
          return sourceFiber.flags |= 65536, rootRenderLanes &= -rootRenderLanes, sourceFiber.lanes |= rootRenderLanes, rootRenderLanes = createClassErrorUpdate(rootRenderLanes), initializeClassErrorUpdate(rootRenderLanes, root2, sourceFiber, value), enqueueCapturedUpdate(sourceFiber, rootRenderLanes), false;
    }
    sourceFiber = sourceFiber.return;
  } while (sourceFiber !== null);
  return false;
}
function reconcileChildren(current, workInProgress, nextChildren, renderLanes2) {
  workInProgress.child = current === null ? mountChildFibers(workInProgress, null, nextChildren, renderLanes2) : reconcileChildFibers(workInProgress, current.child, nextChildren, renderLanes2);
}
function updateForwardRef(current, workInProgress, Component, nextProps, renderLanes2) {
  Component = Component.render;
  var ref = workInProgress.ref;
  if ("ref" in nextProps) {
    var propsWithoutRef = {};
    for (var key in nextProps)
      key !== "ref" && (propsWithoutRef[key] = nextProps[key]);
  } else
    propsWithoutRef = nextProps;
  prepareToReadContext(workInProgress);
  nextProps = renderWithHooks(current, workInProgress, Component, propsWithoutRef, ref, renderLanes2);
  key = checkDidRenderIdHook();
  if (current !== null && !didReceiveUpdate)
    return bailoutHooks(current, workInProgress, renderLanes2), bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes2);
  isHydrating && key && pushMaterializedTreeId(workInProgress);
  workInProgress.flags |= 1;
  reconcileChildren(current, workInProgress, nextProps, renderLanes2);
  return workInProgress.child;
}
function updateMemoComponent(current, workInProgress, Component, nextProps, renderLanes2) {
  if (current === null) {
    var type = Component.type;
    if (typeof type === "function" && !shouldConstruct(type) && type.defaultProps === undefined && Component.compare === null)
      return workInProgress.tag = 15, workInProgress.type = type, updateSimpleMemoComponent(current, workInProgress, type, nextProps, renderLanes2);
    current = createFiberFromTypeAndProps(Component.type, null, nextProps, workInProgress, workInProgress.mode, renderLanes2);
    current.ref = workInProgress.ref;
    current.return = workInProgress;
    return workInProgress.child = current;
  }
  type = current.child;
  if (!checkScheduledUpdateOrContext(current, renderLanes2)) {
    var prevProps = type.memoizedProps;
    Component = Component.compare;
    Component = Component !== null ? Component : shallowEqual;
    if (Component(prevProps, nextProps) && current.ref === workInProgress.ref)
      return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes2);
  }
  workInProgress.flags |= 1;
  current = createWorkInProgress(type, nextProps);
  current.ref = workInProgress.ref;
  current.return = workInProgress;
  return workInProgress.child = current;
}
function updateSimpleMemoComponent(current, workInProgress, Component, nextProps, renderLanes2) {
  if (current !== null) {
    var prevProps = current.memoizedProps;
    if (shallowEqual(prevProps, nextProps) && current.ref === workInProgress.ref)
      if (didReceiveUpdate = false, workInProgress.pendingProps = nextProps = prevProps, checkScheduledUpdateOrContext(current, renderLanes2))
        (current.flags & 131072) !== 0 && (didReceiveUpdate = true);
      else
        return workInProgress.lanes = current.lanes, bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes2);
  }
  return updateFunctionComponent(current, workInProgress, Component, nextProps, renderLanes2);
}
function updateOffscreenComponent(current, workInProgress, renderLanes2, nextProps) {
  var nextChildren = nextProps.children, prevState = current !== null ? current.memoizedState : null;
  current === null && workInProgress.stateNode === null && (workInProgress.stateNode = {
    _visibility: 1,
    _pendingMarkers: null,
    _retryCache: null,
    _transitions: null
  });
  if (nextProps.mode === "hidden") {
    if ((workInProgress.flags & 128) !== 0) {
      prevState = prevState !== null ? prevState.baseLanes | renderLanes2 : renderLanes2;
      if (current !== null) {
        nextProps = workInProgress.child = current.child;
        for (nextChildren = 0;nextProps !== null; )
          nextChildren = nextChildren | nextProps.lanes | nextProps.childLanes, nextProps = nextProps.sibling;
        nextProps = nextChildren & ~prevState;
      } else
        nextProps = 0, workInProgress.child = null;
      return deferHiddenOffscreenComponent(current, workInProgress, prevState, renderLanes2, nextProps);
    }
    if ((renderLanes2 & 536870912) !== 0)
      workInProgress.memoizedState = { baseLanes: 0, cachePool: null }, current !== null && pushTransition(workInProgress, prevState !== null ? prevState.cachePool : null), prevState !== null ? pushHiddenContext(workInProgress, prevState) : reuseHiddenContextOnStack(), pushOffscreenSuspenseHandler(workInProgress);
    else
      return nextProps = workInProgress.lanes = 536870912, deferHiddenOffscreenComponent(current, workInProgress, prevState !== null ? prevState.baseLanes | renderLanes2 : renderLanes2, renderLanes2, nextProps);
  } else
    prevState !== null ? (pushTransition(workInProgress, prevState.cachePool), pushHiddenContext(workInProgress, prevState), reuseSuspenseHandlerOnStack(workInProgress), workInProgress.memoizedState = null) : (current !== null && pushTransition(workInProgress, null), reuseHiddenContextOnStack(), reuseSuspenseHandlerOnStack(workInProgress));
  reconcileChildren(current, workInProgress, nextChildren, renderLanes2);
  return workInProgress.child;
}
function bailoutOffscreenComponent(current, workInProgress) {
  current !== null && current.tag === 22 || workInProgress.stateNode !== null || (workInProgress.stateNode = {
    _visibility: 1,
    _pendingMarkers: null,
    _retryCache: null,
    _transitions: null
  });
  return workInProgress.sibling;
}
function deferHiddenOffscreenComponent(current, workInProgress, nextBaseLanes, renderLanes2, remainingChildLanes) {
  var JSCompiler_inline_result = peekCacheFromPool();
  JSCompiler_inline_result = JSCompiler_inline_result === null ? null : { parent: CacheContext._currentValue, pool: JSCompiler_inline_result };
  workInProgress.memoizedState = {
    baseLanes: nextBaseLanes,
    cachePool: JSCompiler_inline_result
  };
  current !== null && pushTransition(workInProgress, null);
  reuseHiddenContextOnStack();
  pushOffscreenSuspenseHandler(workInProgress);
  current !== null && propagateParentContextChanges(current, workInProgress, renderLanes2, true);
  workInProgress.childLanes = remainingChildLanes;
  return null;
}
function mountActivityChildren(workInProgress, nextProps) {
  nextProps = mountWorkInProgressOffscreenFiber({ mode: nextProps.mode, children: nextProps.children }, workInProgress.mode);
  nextProps.ref = workInProgress.ref;
  workInProgress.child = nextProps;
  nextProps.return = workInProgress;
  return nextProps;
}
function retryActivityComponentWithoutHydrating(current, workInProgress, renderLanes2) {
  reconcileChildFibers(workInProgress, current.child, null, renderLanes2);
  current = mountActivityChildren(workInProgress, workInProgress.pendingProps);
  current.flags |= 2;
  popSuspenseHandler(workInProgress);
  workInProgress.memoizedState = null;
  return current;
}
function updateActivityComponent(current, workInProgress, renderLanes2) {
  var nextProps = workInProgress.pendingProps, didSuspend = (workInProgress.flags & 128) !== 0;
  workInProgress.flags &= -129;
  if (current === null) {
    if (isHydrating) {
      if (nextProps.mode === "hidden")
        return current = mountActivityChildren(workInProgress, nextProps), workInProgress.lanes = 536870912, bailoutOffscreenComponent(null, current);
      pushDehydratedActivitySuspenseHandler(workInProgress);
      (current = nextHydratableInstance) ? (current = canHydrateHydrationBoundary(current, rootOrSingletonContext), current = current !== null && current.data === "&" ? current : null, current !== null && (workInProgress.memoizedState = {
        dehydrated: current,
        treeContext: treeContextProvider !== null ? { id: treeContextId, overflow: treeContextOverflow } : null,
        retryLane: 536870912,
        hydrationErrors: null
      }, renderLanes2 = createFiberFromDehydratedFragment(current), renderLanes2.return = workInProgress, workInProgress.child = renderLanes2, hydrationParentFiber = workInProgress, nextHydratableInstance = null)) : current = null;
      if (current === null)
        throw throwOnHydrationMismatch(workInProgress);
      workInProgress.lanes = 536870912;
      return null;
    }
    return mountActivityChildren(workInProgress, nextProps);
  }
  var prevState = current.memoizedState;
  if (prevState !== null) {
    var dehydrated = prevState.dehydrated;
    pushDehydratedActivitySuspenseHandler(workInProgress);
    if (didSuspend)
      if (workInProgress.flags & 256)
        workInProgress.flags &= -257, workInProgress = retryActivityComponentWithoutHydrating(current, workInProgress, renderLanes2);
      else if (workInProgress.memoizedState !== null)
        workInProgress.child = current.child, workInProgress.flags |= 128, workInProgress = null;
      else
        throw Error(formatProdErrorMessage(558));
    else if (didReceiveUpdate || propagateParentContextChanges(current, workInProgress, renderLanes2, false), didSuspend = (renderLanes2 & current.childLanes) !== 0, didReceiveUpdate || didSuspend) {
      nextProps = workInProgressRoot;
      if (nextProps !== null && (dehydrated = getBumpedLaneForHydration(nextProps, renderLanes2), dehydrated !== 0 && dehydrated !== prevState.retryLane))
        throw prevState.retryLane = dehydrated, enqueueConcurrentRenderForLane(current, dehydrated), scheduleUpdateOnFiber(nextProps, current, dehydrated), SelectiveHydrationException;
      renderDidSuspendDelayIfPossible();
      workInProgress = retryActivityComponentWithoutHydrating(current, workInProgress, renderLanes2);
    } else
      current = prevState.treeContext, nextHydratableInstance = getNextHydratable(dehydrated.nextSibling), hydrationParentFiber = workInProgress, isHydrating = true, hydrationErrors = null, rootOrSingletonContext = false, current !== null && restoreSuspendedTreeContext(workInProgress, current), workInProgress = mountActivityChildren(workInProgress, nextProps), workInProgress.flags |= 4096;
    return workInProgress;
  }
  current = createWorkInProgress(current.child, {
    mode: nextProps.mode,
    children: nextProps.children
  });
  current.ref = workInProgress.ref;
  workInProgress.child = current;
  current.return = workInProgress;
  return current;
}
function markRef(current, workInProgress) {
  var ref = workInProgress.ref;
  if (ref === null)
    current !== null && current.ref !== null && (workInProgress.flags |= 4194816);
  else {
    if (typeof ref !== "function" && typeof ref !== "object")
      throw Error(formatProdErrorMessage(284));
    if (current === null || current.ref !== ref)
      workInProgress.flags |= 4194816;
  }
}
function updateFunctionComponent(current, workInProgress, Component, nextProps, renderLanes2) {
  prepareToReadContext(workInProgress);
  Component = renderWithHooks(current, workInProgress, Component, nextProps, undefined, renderLanes2);
  nextProps = checkDidRenderIdHook();
  if (current !== null && !didReceiveUpdate)
    return bailoutHooks(current, workInProgress, renderLanes2), bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes2);
  isHydrating && nextProps && pushMaterializedTreeId(workInProgress);
  workInProgress.flags |= 1;
  reconcileChildren(current, workInProgress, Component, renderLanes2);
  return workInProgress.child;
}
function replayFunctionComponent(current, workInProgress, nextProps, Component, secondArg, renderLanes2) {
  prepareToReadContext(workInProgress);
  workInProgress.updateQueue = null;
  nextProps = renderWithHooksAgain(workInProgress, Component, nextProps, secondArg);
  finishRenderingHooks(current);
  Component = checkDidRenderIdHook();
  if (current !== null && !didReceiveUpdate)
    return bailoutHooks(current, workInProgress, renderLanes2), bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes2);
  isHydrating && Component && pushMaterializedTreeId(workInProgress);
  workInProgress.flags |= 1;
  reconcileChildren(current, workInProgress, nextProps, renderLanes2);
  return workInProgress.child;
}
function updateClassComponent(current, workInProgress, Component, nextProps, renderLanes2) {
  prepareToReadContext(workInProgress);
  if (workInProgress.stateNode === null) {
    var context = emptyContextObject, contextType = Component.contextType;
    typeof contextType === "object" && contextType !== null && (context = readContext(contextType));
    context = new Component(nextProps, context);
    workInProgress.memoizedState = context.state !== null && context.state !== undefined ? context.state : null;
    context.updater = classComponentUpdater;
    workInProgress.stateNode = context;
    context._reactInternals = workInProgress;
    context = workInProgress.stateNode;
    context.props = nextProps;
    context.state = workInProgress.memoizedState;
    context.refs = {};
    initializeUpdateQueue(workInProgress);
    contextType = Component.contextType;
    context.context = typeof contextType === "object" && contextType !== null ? readContext(contextType) : emptyContextObject;
    context.state = workInProgress.memoizedState;
    contextType = Component.getDerivedStateFromProps;
    typeof contextType === "function" && (applyDerivedStateFromProps(workInProgress, Component, contextType, nextProps), context.state = workInProgress.memoizedState);
    typeof Component.getDerivedStateFromProps === "function" || typeof context.getSnapshotBeforeUpdate === "function" || typeof context.UNSAFE_componentWillMount !== "function" && typeof context.componentWillMount !== "function" || (contextType = context.state, typeof context.componentWillMount === "function" && context.componentWillMount(), typeof context.UNSAFE_componentWillMount === "function" && context.UNSAFE_componentWillMount(), contextType !== context.state && classComponentUpdater.enqueueReplaceState(context, context.state, null), processUpdateQueue(workInProgress, nextProps, context, renderLanes2), suspendIfUpdateReadFromEntangledAsyncAction(), context.state = workInProgress.memoizedState);
    typeof context.componentDidMount === "function" && (workInProgress.flags |= 4194308);
    nextProps = true;
  } else if (current === null) {
    context = workInProgress.stateNode;
    var unresolvedOldProps = workInProgress.memoizedProps, oldProps = resolveClassComponentProps(Component, unresolvedOldProps);
    context.props = oldProps;
    var oldContext = context.context, contextType$jscomp$0 = Component.contextType;
    contextType = emptyContextObject;
    typeof contextType$jscomp$0 === "object" && contextType$jscomp$0 !== null && (contextType = readContext(contextType$jscomp$0));
    var getDerivedStateFromProps = Component.getDerivedStateFromProps;
    contextType$jscomp$0 = typeof getDerivedStateFromProps === "function" || typeof context.getSnapshotBeforeUpdate === "function";
    unresolvedOldProps = workInProgress.pendingProps !== unresolvedOldProps;
    contextType$jscomp$0 || typeof context.UNSAFE_componentWillReceiveProps !== "function" && typeof context.componentWillReceiveProps !== "function" || (unresolvedOldProps || oldContext !== contextType) && callComponentWillReceiveProps(workInProgress, context, nextProps, contextType);
    hasForceUpdate = false;
    var oldState = workInProgress.memoizedState;
    context.state = oldState;
    processUpdateQueue(workInProgress, nextProps, context, renderLanes2);
    suspendIfUpdateReadFromEntangledAsyncAction();
    oldContext = workInProgress.memoizedState;
    unresolvedOldProps || oldState !== oldContext || hasForceUpdate ? (typeof getDerivedStateFromProps === "function" && (applyDerivedStateFromProps(workInProgress, Component, getDerivedStateFromProps, nextProps), oldContext = workInProgress.memoizedState), (oldProps = hasForceUpdate || checkShouldComponentUpdate(workInProgress, Component, oldProps, nextProps, oldState, oldContext, contextType)) ? (contextType$jscomp$0 || typeof context.UNSAFE_componentWillMount !== "function" && typeof context.componentWillMount !== "function" || (typeof context.componentWillMount === "function" && context.componentWillMount(), typeof context.UNSAFE_componentWillMount === "function" && context.UNSAFE_componentWillMount()), typeof context.componentDidMount === "function" && (workInProgress.flags |= 4194308)) : (typeof context.componentDidMount === "function" && (workInProgress.flags |= 4194308), workInProgress.memoizedProps = nextProps, workInProgress.memoizedState = oldContext), context.props = nextProps, context.state = oldContext, context.context = contextType, nextProps = oldProps) : (typeof context.componentDidMount === "function" && (workInProgress.flags |= 4194308), nextProps = false);
  } else {
    context = workInProgress.stateNode;
    cloneUpdateQueue(current, workInProgress);
    contextType = workInProgress.memoizedProps;
    contextType$jscomp$0 = resolveClassComponentProps(Component, contextType);
    context.props = contextType$jscomp$0;
    getDerivedStateFromProps = workInProgress.pendingProps;
    oldState = context.context;
    oldContext = Component.contextType;
    oldProps = emptyContextObject;
    typeof oldContext === "object" && oldContext !== null && (oldProps = readContext(oldContext));
    unresolvedOldProps = Component.getDerivedStateFromProps;
    (oldContext = typeof unresolvedOldProps === "function" || typeof context.getSnapshotBeforeUpdate === "function") || typeof context.UNSAFE_componentWillReceiveProps !== "function" && typeof context.componentWillReceiveProps !== "function" || (contextType !== getDerivedStateFromProps || oldState !== oldProps) && callComponentWillReceiveProps(workInProgress, context, nextProps, oldProps);
    hasForceUpdate = false;
    oldState = workInProgress.memoizedState;
    context.state = oldState;
    processUpdateQueue(workInProgress, nextProps, context, renderLanes2);
    suspendIfUpdateReadFromEntangledAsyncAction();
    var newState = workInProgress.memoizedState;
    contextType !== getDerivedStateFromProps || oldState !== newState || hasForceUpdate || current !== null && current.dependencies !== null && checkIfContextChanged(current.dependencies) ? (typeof unresolvedOldProps === "function" && (applyDerivedStateFromProps(workInProgress, Component, unresolvedOldProps, nextProps), newState = workInProgress.memoizedState), (contextType$jscomp$0 = hasForceUpdate || checkShouldComponentUpdate(workInProgress, Component, contextType$jscomp$0, nextProps, oldState, newState, oldProps) || current !== null && current.dependencies !== null && checkIfContextChanged(current.dependencies)) ? (oldContext || typeof context.UNSAFE_componentWillUpdate !== "function" && typeof context.componentWillUpdate !== "function" || (typeof context.componentWillUpdate === "function" && context.componentWillUpdate(nextProps, newState, oldProps), typeof context.UNSAFE_componentWillUpdate === "function" && context.UNSAFE_componentWillUpdate(nextProps, newState, oldProps)), typeof context.componentDidUpdate === "function" && (workInProgress.flags |= 4), typeof context.getSnapshotBeforeUpdate === "function" && (workInProgress.flags |= 1024)) : (typeof context.componentDidUpdate !== "function" || contextType === current.memoizedProps && oldState === current.memoizedState || (workInProgress.flags |= 4), typeof context.getSnapshotBeforeUpdate !== "function" || contextType === current.memoizedProps && oldState === current.memoizedState || (workInProgress.flags |= 1024), workInProgress.memoizedProps = nextProps, workInProgress.memoizedState = newState), context.props = nextProps, context.state = newState, context.context = oldProps, nextProps = contextType$jscomp$0) : (typeof context.componentDidUpdate !== "function" || contextType === current.memoizedProps && oldState === current.memoizedState || (workInProgress.flags |= 4), typeof context.getSnapshotBeforeUpdate !== "function" || contextType === current.memoizedProps && oldState === current.memoizedState || (workInProgress.flags |= 1024), nextProps = false);
  }
  context = nextProps;
  markRef(current, workInProgress);
  nextProps = (workInProgress.flags & 128) !== 0;
  context || nextProps ? (context = workInProgress.stateNode, nextProps && typeof Component.getDerivedStateFromError !== "function" ? (Component = null, profilerStartTime = -1) : Component = context.render(), workInProgress.flags |= 1, current !== null && nextProps ? (workInProgress.child = reconcileChildFibers(workInProgress, current.child, null, renderLanes2), workInProgress.child = reconcileChildFibers(workInProgress, null, Component, renderLanes2)) : reconcileChildren(current, workInProgress, Component, renderLanes2), workInProgress.memoizedState = context.state, current = workInProgress.child) : current = bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes2);
  return current;
}
function mountHostRootWithoutHydrating(current, workInProgress, nextChildren, renderLanes2) {
  resetHydrationState();
  workInProgress.flags |= 256;
  reconcileChildren(current, workInProgress, nextChildren, renderLanes2);
  return workInProgress.child;
}
function mountSuspenseOffscreenState(renderLanes2) {
  return { baseLanes: renderLanes2, cachePool: getSuspendedCache() };
}
function getRemainingWorkInPrimaryTree(current, primaryTreeDidDefer, renderLanes2) {
  current = current !== null ? current.childLanes & ~renderLanes2 : 0;
  primaryTreeDidDefer && (current |= workInProgressDeferredLane);
  return current;
}
function updateSuspenseComponent(current, workInProgress, renderLanes2) {
  var nextProps = workInProgress.pendingProps, showFallback = false, didSuspend = (workInProgress.flags & 128) !== 0, JSCompiler_temp;
  (JSCompiler_temp = didSuspend) || (JSCompiler_temp = current !== null && current.memoizedState === null ? false : (suspenseStackCursor.current & 2) !== 0);
  JSCompiler_temp && (showFallback = true, workInProgress.flags &= -129);
  JSCompiler_temp = (workInProgress.flags & 32) !== 0;
  workInProgress.flags &= -33;
  if (current === null) {
    if (isHydrating) {
      showFallback ? pushPrimaryTreeSuspenseHandler(workInProgress) : reuseSuspenseHandlerOnStack(workInProgress);
      (current = nextHydratableInstance) ? (current = canHydrateHydrationBoundary(current, rootOrSingletonContext), current = current !== null && current.data !== "&" ? current : null, current !== null && (workInProgress.memoizedState = {
        dehydrated: current,
        treeContext: treeContextProvider !== null ? { id: treeContextId, overflow: treeContextOverflow } : null,
        retryLane: 536870912,
        hydrationErrors: null
      }, renderLanes2 = createFiberFromDehydratedFragment(current), renderLanes2.return = workInProgress, workInProgress.child = renderLanes2, hydrationParentFiber = workInProgress, nextHydratableInstance = null)) : current = null;
      if (current === null)
        throw throwOnHydrationMismatch(workInProgress);
      isSuspenseInstanceFallback(current) ? workInProgress.lanes = 32 : workInProgress.lanes = 536870912;
      return null;
    }
    var nextPrimaryChildren = nextProps.children;
    nextProps = nextProps.fallback;
    if (showFallback)
      return reuseSuspenseHandlerOnStack(workInProgress), showFallback = workInProgress.mode, nextPrimaryChildren = mountWorkInProgressOffscreenFiber({ mode: "hidden", children: nextPrimaryChildren }, showFallback), nextProps = createFiberFromFragment(nextProps, showFallback, renderLanes2, null), nextPrimaryChildren.return = workInProgress, nextProps.return = workInProgress, nextPrimaryChildren.sibling = nextProps, workInProgress.child = nextPrimaryChildren, nextProps = workInProgress.child, nextProps.memoizedState = mountSuspenseOffscreenState(renderLanes2), nextProps.childLanes = getRemainingWorkInPrimaryTree(current, JSCompiler_temp, renderLanes2), workInProgress.memoizedState = SUSPENDED_MARKER, bailoutOffscreenComponent(null, nextProps);
    pushPrimaryTreeSuspenseHandler(workInProgress);
    return mountSuspensePrimaryChildren(workInProgress, nextPrimaryChildren);
  }
  var prevState = current.memoizedState;
  if (prevState !== null && (nextPrimaryChildren = prevState.dehydrated, nextPrimaryChildren !== null)) {
    if (didSuspend)
      workInProgress.flags & 256 ? (pushPrimaryTreeSuspenseHandler(workInProgress), workInProgress.flags &= -257, workInProgress = retrySuspenseComponentWithoutHydrating(current, workInProgress, renderLanes2)) : workInProgress.memoizedState !== null ? (reuseSuspenseHandlerOnStack(workInProgress), workInProgress.child = current.child, workInProgress.flags |= 128, workInProgress = null) : (reuseSuspenseHandlerOnStack(workInProgress), nextPrimaryChildren = nextProps.fallback, showFallback = workInProgress.mode, nextProps = mountWorkInProgressOffscreenFiber({ mode: "visible", children: nextProps.children }, showFallback), nextPrimaryChildren = createFiberFromFragment(nextPrimaryChildren, showFallback, renderLanes2, null), nextPrimaryChildren.flags |= 2, nextProps.return = workInProgress, nextPrimaryChildren.return = workInProgress, nextProps.sibling = nextPrimaryChildren, workInProgress.child = nextProps, reconcileChildFibers(workInProgress, current.child, null, renderLanes2), nextProps = workInProgress.child, nextProps.memoizedState = mountSuspenseOffscreenState(renderLanes2), nextProps.childLanes = getRemainingWorkInPrimaryTree(current, JSCompiler_temp, renderLanes2), workInProgress.memoizedState = SUSPENDED_MARKER, workInProgress = bailoutOffscreenComponent(null, nextProps));
    else if (pushPrimaryTreeSuspenseHandler(workInProgress), isSuspenseInstanceFallback(nextPrimaryChildren)) {
      JSCompiler_temp = nextPrimaryChildren.nextSibling && nextPrimaryChildren.nextSibling.dataset;
      if (JSCompiler_temp)
        var digest = JSCompiler_temp.dgst;
      JSCompiler_temp = digest;
      nextProps = Error(formatProdErrorMessage(419));
      nextProps.stack = "";
      nextProps.digest = JSCompiler_temp;
      queueHydrationError({ value: nextProps, source: null, stack: null });
      workInProgress = retrySuspenseComponentWithoutHydrating(current, workInProgress, renderLanes2);
    } else if (didReceiveUpdate || propagateParentContextChanges(current, workInProgress, renderLanes2, false), JSCompiler_temp = (renderLanes2 & current.childLanes) !== 0, didReceiveUpdate || JSCompiler_temp) {
      JSCompiler_temp = workInProgressRoot;
      if (JSCompiler_temp !== null && (nextProps = getBumpedLaneForHydration(JSCompiler_temp, renderLanes2), nextProps !== 0 && nextProps !== prevState.retryLane))
        throw prevState.retryLane = nextProps, enqueueConcurrentRenderForLane(current, nextProps), scheduleUpdateOnFiber(JSCompiler_temp, current, nextProps), SelectiveHydrationException;
      isSuspenseInstancePending(nextPrimaryChildren) || renderDidSuspendDelayIfPossible();
      workInProgress = retrySuspenseComponentWithoutHydrating(current, workInProgress, renderLanes2);
    } else
      isSuspenseInstancePending(nextPrimaryChildren) ? (workInProgress.flags |= 192, workInProgress.child = current.child, workInProgress = null) : (current = prevState.treeContext, nextHydratableInstance = getNextHydratable(nextPrimaryChildren.nextSibling), hydrationParentFiber = workInProgress, isHydrating = true, hydrationErrors = null, rootOrSingletonContext = false, current !== null && restoreSuspendedTreeContext(workInProgress, current), workInProgress = mountSuspensePrimaryChildren(workInProgress, nextProps.children), workInProgress.flags |= 4096);
    return workInProgress;
  }
  if (showFallback)
    return reuseSuspenseHandlerOnStack(workInProgress), nextPrimaryChildren = nextProps.fallback, showFallback = workInProgress.mode, prevState = current.child, digest = prevState.sibling, nextProps = createWorkInProgress(prevState, {
      mode: "hidden",
      children: nextProps.children
    }), nextProps.subtreeFlags = prevState.subtreeFlags & 65011712, digest !== null ? nextPrimaryChildren = createWorkInProgress(digest, nextPrimaryChildren) : (nextPrimaryChildren = createFiberFromFragment(nextPrimaryChildren, showFallback, renderLanes2, null), nextPrimaryChildren.flags |= 2), nextPrimaryChildren.return = workInProgress, nextProps.return = workInProgress, nextProps.sibling = nextPrimaryChildren, workInProgress.child = nextProps, bailoutOffscreenComponent(null, nextProps), nextProps = workInProgress.child, nextPrimaryChildren = current.child.memoizedState, nextPrimaryChildren === null ? nextPrimaryChildren = mountSuspenseOffscreenState(renderLanes2) : (showFallback = nextPrimaryChildren.cachePool, showFallback !== null ? (prevState = CacheContext._currentValue, showFallback = showFallback.parent !== prevState ? { parent: prevState, pool: prevState } : showFallback) : showFallback = getSuspendedCache(), nextPrimaryChildren = {
      baseLanes: nextPrimaryChildren.baseLanes | renderLanes2,
      cachePool: showFallback
    }), nextProps.memoizedState = nextPrimaryChildren, nextProps.childLanes = getRemainingWorkInPrimaryTree(current, JSCompiler_temp, renderLanes2), workInProgress.memoizedState = SUSPENDED_MARKER, bailoutOffscreenComponent(current.child, nextProps);
  pushPrimaryTreeSuspenseHandler(workInProgress);
  renderLanes2 = current.child;
  current = renderLanes2.sibling;
  renderLanes2 = createWorkInProgress(renderLanes2, {
    mode: "visible",
    children: nextProps.children
  });
  renderLanes2.return = workInProgress;
  renderLanes2.sibling = null;
  current !== null && (JSCompiler_temp = workInProgress.deletions, JSCompiler_temp === null ? (workInProgress.deletions = [current], workInProgress.flags |= 16) : JSCompiler_temp.push(current));
  workInProgress.child = renderLanes2;
  workInProgress.memoizedState = null;
  return renderLanes2;
}
function mountSuspensePrimaryChildren(workInProgress, primaryChildren) {
  primaryChildren = mountWorkInProgressOffscreenFiber({ mode: "visible", children: primaryChildren }, workInProgress.mode);
  primaryChildren.return = workInProgress;
  return workInProgress.child = primaryChildren;
}
function mountWorkInProgressOffscreenFiber(offscreenProps, mode) {
  offscreenProps = createFiberImplClass(22, offscreenProps, null, mode);
  offscreenProps.lanes = 0;
  return offscreenProps;
}
function retrySuspenseComponentWithoutHydrating(current, workInProgress, renderLanes2) {
  reconcileChildFibers(workInProgress, current.child, null, renderLanes2);
  current = mountSuspensePrimaryChildren(workInProgress, workInProgress.pendingProps.children);
  current.flags |= 2;
  workInProgress.memoizedState = null;
  return current;
}
function scheduleSuspenseWorkOnFiber(fiber, renderLanes2, propagationRoot) {
  fiber.lanes |= renderLanes2;
  var alternate = fiber.alternate;
  alternate !== null && (alternate.lanes |= renderLanes2);
  scheduleContextWorkOnParentPath(fiber.return, renderLanes2, propagationRoot);
}
function initSuspenseListRenderState(workInProgress, isBackwards, tail, lastContentRow, tailMode, treeForkCount2) {
  var renderState = workInProgress.memoizedState;
  renderState === null ? workInProgress.memoizedState = {
    isBackwards,
    rendering: null,
    renderingStartTime: 0,
    last: lastContentRow,
    tail,
    tailMode,
    treeForkCount: treeForkCount2
  } : (renderState.isBackwards = isBackwards, renderState.rendering = null, renderState.renderingStartTime = 0, renderState.last = lastContentRow, renderState.tail = tail, renderState.tailMode = tailMode, renderState.treeForkCount = treeForkCount2);
}
function updateSuspenseListComponent(current, workInProgress, renderLanes2) {
  var nextProps = workInProgress.pendingProps, revealOrder = nextProps.revealOrder, tailMode = nextProps.tail;
  nextProps = nextProps.children;
  var suspenseContext = suspenseStackCursor.current, shouldForceFallback = (suspenseContext & 2) !== 0;
  shouldForceFallback ? (suspenseContext = suspenseContext & 1 | 2, workInProgress.flags |= 128) : suspenseContext &= 1;
  push2(suspenseStackCursor, suspenseContext);
  reconcileChildren(current, workInProgress, nextProps, renderLanes2);
  nextProps = isHydrating ? treeForkCount : 0;
  if (!shouldForceFallback && current !== null && (current.flags & 128) !== 0)
    a:
      for (current = workInProgress.child;current !== null; ) {
        if (current.tag === 13)
          current.memoizedState !== null && scheduleSuspenseWorkOnFiber(current, renderLanes2, workInProgress);
        else if (current.tag === 19)
          scheduleSuspenseWorkOnFiber(current, renderLanes2, workInProgress);
        else if (current.child !== null) {
          current.child.return = current;
          current = current.child;
          continue;
        }
        if (current === workInProgress)
          break a;
        for (;current.sibling === null; ) {
          if (current.return === null || current.return === workInProgress)
            break a;
          current = current.return;
        }
        current.sibling.return = current.return;
        current = current.sibling;
      }
  switch (revealOrder) {
    case "forwards":
      renderLanes2 = workInProgress.child;
      for (revealOrder = null;renderLanes2 !== null; )
        current = renderLanes2.alternate, current !== null && findFirstSuspended(current) === null && (revealOrder = renderLanes2), renderLanes2 = renderLanes2.sibling;
      renderLanes2 = revealOrder;
      renderLanes2 === null ? (revealOrder = workInProgress.child, workInProgress.child = null) : (revealOrder = renderLanes2.sibling, renderLanes2.sibling = null);
      initSuspenseListRenderState(workInProgress, false, revealOrder, renderLanes2, tailMode, nextProps);
      break;
    case "backwards":
    case "unstable_legacy-backwards":
      renderLanes2 = null;
      revealOrder = workInProgress.child;
      for (workInProgress.child = null;revealOrder !== null; ) {
        current = revealOrder.alternate;
        if (current !== null && findFirstSuspended(current) === null) {
          workInProgress.child = revealOrder;
          break;
        }
        current = revealOrder.sibling;
        revealOrder.sibling = renderLanes2;
        renderLanes2 = revealOrder;
        revealOrder = current;
      }
      initSuspenseListRenderState(workInProgress, true, renderLanes2, null, tailMode, nextProps);
      break;
    case "together":
      initSuspenseListRenderState(workInProgress, false, null, null, undefined, nextProps);
      break;
    default:
      workInProgress.memoizedState = null;
  }
  return workInProgress.child;
}
function bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes2) {
  current !== null && (workInProgress.dependencies = current.dependencies);
  profilerStartTime = -1;
  workInProgressRootSkippedLanes |= workInProgress.lanes;
  if ((renderLanes2 & workInProgress.childLanes) === 0)
    if (current !== null) {
      if (propagateParentContextChanges(current, workInProgress, renderLanes2, false), (renderLanes2 & workInProgress.childLanes) === 0)
        return null;
    } else
      return null;
  if (current !== null && workInProgress.child !== current.child)
    throw Error(formatProdErrorMessage(153));
  if (workInProgress.child !== null) {
    current = workInProgress.child;
    renderLanes2 = createWorkInProgress(current, current.pendingProps);
    workInProgress.child = renderLanes2;
    for (renderLanes2.return = workInProgress;current.sibling !== null; )
      current = current.sibling, renderLanes2 = renderLanes2.sibling = createWorkInProgress(current, current.pendingProps), renderLanes2.return = workInProgress;
    renderLanes2.sibling = null;
  }
  return workInProgress.child;
}
function checkScheduledUpdateOrContext(current, renderLanes2) {
  if ((current.lanes & renderLanes2) !== 0)
    return true;
  current = current.dependencies;
  return current !== null && checkIfContextChanged(current) ? true : false;
}
function attemptEarlyBailoutIfNoScheduledUpdate(current, workInProgress, renderLanes2) {
  switch (workInProgress.tag) {
    case 3:
      pushHostContainer(workInProgress, workInProgress.stateNode.containerInfo);
      pushProvider(workInProgress, CacheContext, current.memoizedState.cache);
      resetHydrationState();
      break;
    case 27:
    case 5:
      pushHostContext(workInProgress);
      break;
    case 4:
      pushHostContainer(workInProgress, workInProgress.stateNode.containerInfo);
      break;
    case 10:
      pushProvider(workInProgress, workInProgress.type, workInProgress.memoizedProps.value);
      break;
    case 12:
      (renderLanes2 & workInProgress.childLanes) !== 0 && (workInProgress.flags |= 4);
      workInProgress.flags |= 2048;
      var stateNode = workInProgress.stateNode;
      stateNode.effectDuration = -0;
      stateNode.passiveEffectDuration = -0;
      break;
    case 31:
      if (workInProgress.memoizedState !== null)
        return workInProgress.flags |= 128, pushDehydratedActivitySuspenseHandler(workInProgress), null;
      break;
    case 13:
      stateNode = workInProgress.memoizedState;
      if (stateNode !== null) {
        if (stateNode.dehydrated !== null)
          return pushPrimaryTreeSuspenseHandler(workInProgress), workInProgress.flags |= 128, null;
        if ((renderLanes2 & workInProgress.child.childLanes) !== 0)
          return updateSuspenseComponent(current, workInProgress, renderLanes2);
        pushPrimaryTreeSuspenseHandler(workInProgress);
        current = bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes2);
        return current !== null ? current.sibling : null;
      }
      pushPrimaryTreeSuspenseHandler(workInProgress);
      break;
    case 19:
      var didSuspendBefore = (current.flags & 128) !== 0;
      stateNode = (renderLanes2 & workInProgress.childLanes) !== 0;
      stateNode || (propagateParentContextChanges(current, workInProgress, renderLanes2, false), stateNode = (renderLanes2 & workInProgress.childLanes) !== 0);
      if (didSuspendBefore) {
        if (stateNode)
          return updateSuspenseListComponent(current, workInProgress, renderLanes2);
        workInProgress.flags |= 128;
      }
      didSuspendBefore = workInProgress.memoizedState;
      didSuspendBefore !== null && (didSuspendBefore.rendering = null, didSuspendBefore.tail = null, didSuspendBefore.lastEffect = null);
      push2(suspenseStackCursor, suspenseStackCursor.current);
      if (stateNode)
        break;
      else
        return null;
    case 22:
      return workInProgress.lanes = 0, updateOffscreenComponent(current, workInProgress, renderLanes2, workInProgress.pendingProps);
    case 24:
      pushProvider(workInProgress, CacheContext, current.memoizedState.cache);
  }
  return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes2);
}
function beginWork(current, workInProgress, renderLanes2) {
  if (current !== null)
    if (current.memoizedProps !== workInProgress.pendingProps)
      didReceiveUpdate = true;
    else {
      if (!checkScheduledUpdateOrContext(current, renderLanes2) && (workInProgress.flags & 128) === 0)
        return didReceiveUpdate = false, attemptEarlyBailoutIfNoScheduledUpdate(current, workInProgress, renderLanes2);
      didReceiveUpdate = (current.flags & 131072) !== 0 ? true : false;
    }
  else
    didReceiveUpdate = false, isHydrating && (workInProgress.flags & 1048576) !== 0 && pushTreeId(workInProgress, treeForkCount, workInProgress.index);
  workInProgress.lanes = 0;
  switch (workInProgress.tag) {
    case 16:
      a: {
        var props = workInProgress.pendingProps;
        current = resolveLazy(workInProgress.elementType);
        workInProgress.type = current;
        if (typeof current === "function")
          shouldConstruct(current) ? (props = resolveClassComponentProps(current, props), workInProgress.tag = 1, workInProgress = updateClassComponent(null, workInProgress, current, props, renderLanes2)) : (workInProgress.tag = 0, workInProgress = updateFunctionComponent(null, workInProgress, current, props, renderLanes2));
        else {
          if (current !== undefined && current !== null) {
            var $$typeof = current.$$typeof;
            if ($$typeof === REACT_FORWARD_REF_TYPE) {
              workInProgress.tag = 11;
              workInProgress = updateForwardRef(null, workInProgress, current, props, renderLanes2);
              break a;
            } else if ($$typeof === REACT_MEMO_TYPE) {
              workInProgress.tag = 14;
              workInProgress = updateMemoComponent(null, workInProgress, current, props, renderLanes2);
              break a;
            }
          }
          workInProgress = getComponentNameFromType(current) || current;
          throw Error(formatProdErrorMessage(306, workInProgress, ""));
        }
      }
      return workInProgress;
    case 0:
      return updateFunctionComponent(current, workInProgress, workInProgress.type, workInProgress.pendingProps, renderLanes2);
    case 1:
      return props = workInProgress.type, $$typeof = resolveClassComponentProps(props, workInProgress.pendingProps), updateClassComponent(current, workInProgress, props, $$typeof, renderLanes2);
    case 3:
      a: {
        pushHostContainer(workInProgress, workInProgress.stateNode.containerInfo);
        if (current === null)
          throw Error(formatProdErrorMessage(387));
        props = workInProgress.pendingProps;
        var prevState = workInProgress.memoizedState;
        $$typeof = prevState.element;
        cloneUpdateQueue(current, workInProgress);
        processUpdateQueue(workInProgress, props, null, renderLanes2);
        var nextState = workInProgress.memoizedState;
        props = nextState.cache;
        pushProvider(workInProgress, CacheContext, props);
        props !== prevState.cache && propagateContextChanges(workInProgress, [CacheContext], renderLanes2, true);
        suspendIfUpdateReadFromEntangledAsyncAction();
        props = nextState.element;
        if (prevState.isDehydrated)
          if (prevState = {
            element: props,
            isDehydrated: false,
            cache: nextState.cache
          }, workInProgress.updateQueue.baseState = prevState, workInProgress.memoizedState = prevState, workInProgress.flags & 256) {
            workInProgress = mountHostRootWithoutHydrating(current, workInProgress, props, renderLanes2);
            break a;
          } else if (props !== $$typeof) {
            $$typeof = createCapturedValueAtFiber(Error(formatProdErrorMessage(424)), workInProgress);
            queueHydrationError($$typeof);
            workInProgress = mountHostRootWithoutHydrating(current, workInProgress, props, renderLanes2);
            break a;
          } else {
            current = workInProgress.stateNode.containerInfo;
            switch (current.nodeType) {
              case 9:
                current = current.body;
                break;
              default:
                current = current.nodeName === "HTML" ? current.ownerDocument.body : current;
            }
            nextHydratableInstance = getNextHydratable(current.firstChild);
            hydrationParentFiber = workInProgress;
            isHydrating = true;
            hydrationErrors = null;
            rootOrSingletonContext = true;
            renderLanes2 = mountChildFibers(workInProgress, null, props, renderLanes2);
            for (workInProgress.child = renderLanes2;renderLanes2; )
              renderLanes2.flags = renderLanes2.flags & -3 | 4096, renderLanes2 = renderLanes2.sibling;
          }
        else {
          resetHydrationState();
          if (props === $$typeof) {
            workInProgress = bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes2);
            break a;
          }
          reconcileChildren(current, workInProgress, props, renderLanes2);
        }
        workInProgress = workInProgress.child;
      }
      return workInProgress;
    case 26:
      return markRef(current, workInProgress), current === null ? (renderLanes2 = getResource(workInProgress.type, null, workInProgress.pendingProps, null)) ? workInProgress.memoizedState = renderLanes2 : isHydrating || (renderLanes2 = workInProgress.type, current = workInProgress.pendingProps, props = getOwnerDocumentFromRootContainer(rootInstanceStackCursor.current).createElement(renderLanes2), props[internalInstanceKey] = workInProgress, props[internalPropsKey] = current, setInitialProperties(props, renderLanes2, current), markNodeAsHoistable(props), workInProgress.stateNode = props) : workInProgress.memoizedState = getResource(workInProgress.type, current.memoizedProps, workInProgress.pendingProps, current.memoizedState), null;
    case 27:
      return pushHostContext(workInProgress), current === null && isHydrating && (props = workInProgress.stateNode = resolveSingletonInstance(workInProgress.type, workInProgress.pendingProps, rootInstanceStackCursor.current), hydrationParentFiber = workInProgress, rootOrSingletonContext = true, $$typeof = nextHydratableInstance, isSingletonScope(workInProgress.type) ? (previousHydratableOnEnteringScopedSingleton = $$typeof, nextHydratableInstance = getNextHydratable(props.firstChild)) : nextHydratableInstance = $$typeof), reconcileChildren(current, workInProgress, workInProgress.pendingProps.children, renderLanes2), markRef(current, workInProgress), current === null && (workInProgress.flags |= 4194304), workInProgress.child;
    case 5:
      if (current === null && isHydrating) {
        if ($$typeof = props = nextHydratableInstance)
          props = canHydrateInstance(props, workInProgress.type, workInProgress.pendingProps, rootOrSingletonContext), props !== null ? (workInProgress.stateNode = props, hydrationParentFiber = workInProgress, nextHydratableInstance = getNextHydratable(props.firstChild), rootOrSingletonContext = false, $$typeof = true) : $$typeof = false;
        $$typeof || throwOnHydrationMismatch(workInProgress);
      }
      pushHostContext(workInProgress);
      $$typeof = workInProgress.type;
      prevState = workInProgress.pendingProps;
      nextState = current !== null ? current.memoizedProps : null;
      props = prevState.children;
      shouldSetTextContent($$typeof, prevState) ? props = null : nextState !== null && shouldSetTextContent($$typeof, nextState) && (workInProgress.flags |= 32);
      workInProgress.memoizedState !== null && ($$typeof = renderWithHooks(current, workInProgress, TransitionAwareHostComponent, null, null, renderLanes2), HostTransitionContext._currentValue = $$typeof);
      markRef(current, workInProgress);
      reconcileChildren(current, workInProgress, props, renderLanes2);
      return workInProgress.child;
    case 6:
      if (current === null && isHydrating) {
        if (current = renderLanes2 = nextHydratableInstance)
          renderLanes2 = canHydrateTextInstance(renderLanes2, workInProgress.pendingProps, rootOrSingletonContext), renderLanes2 !== null ? (workInProgress.stateNode = renderLanes2, hydrationParentFiber = workInProgress, nextHydratableInstance = null, current = true) : current = false;
        current || throwOnHydrationMismatch(workInProgress);
      }
      return null;
    case 13:
      return updateSuspenseComponent(current, workInProgress, renderLanes2);
    case 4:
      return pushHostContainer(workInProgress, workInProgress.stateNode.containerInfo), props = workInProgress.pendingProps, current === null ? workInProgress.child = reconcileChildFibers(workInProgress, null, props, renderLanes2) : reconcileChildren(current, workInProgress, props, renderLanes2), workInProgress.child;
    case 11:
      return updateForwardRef(current, workInProgress, workInProgress.type, workInProgress.pendingProps, renderLanes2);
    case 7:
      return reconcileChildren(current, workInProgress, workInProgress.pendingProps, renderLanes2), workInProgress.child;
    case 8:
      return reconcileChildren(current, workInProgress, workInProgress.pendingProps.children, renderLanes2), workInProgress.child;
    case 12:
      return workInProgress.flags |= 4, workInProgress.flags |= 2048, props = workInProgress.stateNode, props.effectDuration = -0, props.passiveEffectDuration = -0, reconcileChildren(current, workInProgress, workInProgress.pendingProps.children, renderLanes2), workInProgress.child;
    case 10:
      return props = workInProgress.pendingProps, pushProvider(workInProgress, workInProgress.type, props.value), reconcileChildren(current, workInProgress, props.children, renderLanes2), workInProgress.child;
    case 9:
      return $$typeof = workInProgress.type._context, props = workInProgress.pendingProps.children, prepareToReadContext(workInProgress), $$typeof = readContext($$typeof), props = props($$typeof), workInProgress.flags |= 1, reconcileChildren(current, workInProgress, props, renderLanes2), workInProgress.child;
    case 14:
      return updateMemoComponent(current, workInProgress, workInProgress.type, workInProgress.pendingProps, renderLanes2);
    case 15:
      return updateSimpleMemoComponent(current, workInProgress, workInProgress.type, workInProgress.pendingProps, renderLanes2);
    case 19:
      return updateSuspenseListComponent(current, workInProgress, renderLanes2);
    case 31:
      return updateActivityComponent(current, workInProgress, renderLanes2);
    case 22:
      return updateOffscreenComponent(current, workInProgress, renderLanes2, workInProgress.pendingProps);
    case 24:
      return prepareToReadContext(workInProgress), props = readContext(CacheContext), current === null ? ($$typeof = peekCacheFromPool(), $$typeof === null && ($$typeof = workInProgressRoot, prevState = createCache(), $$typeof.pooledCache = prevState, prevState.refCount++, prevState !== null && ($$typeof.pooledCacheLanes |= renderLanes2), $$typeof = prevState), workInProgress.memoizedState = { parent: props, cache: $$typeof }, initializeUpdateQueue(workInProgress), pushProvider(workInProgress, CacheContext, $$typeof)) : ((current.lanes & renderLanes2) !== 0 && (cloneUpdateQueue(current, workInProgress), processUpdateQueue(workInProgress, null, null, renderLanes2), suspendIfUpdateReadFromEntangledAsyncAction()), $$typeof = current.memoizedState, prevState = workInProgress.memoizedState, $$typeof.parent !== props ? ($$typeof = { parent: props, cache: props }, workInProgress.memoizedState = $$typeof, workInProgress.lanes === 0 && (workInProgress.memoizedState = workInProgress.updateQueue.baseState = $$typeof), pushProvider(workInProgress, CacheContext, props)) : (props = prevState.cache, pushProvider(workInProgress, CacheContext, props), props !== $$typeof.cache && propagateContextChanges(workInProgress, [CacheContext], renderLanes2, true))), reconcileChildren(current, workInProgress, workInProgress.pendingProps.children, renderLanes2), workInProgress.child;
    case 29:
      throw workInProgress.pendingProps;
  }
  throw Error(formatProdErrorMessage(156, workInProgress.tag));
}
function markUpdate(workInProgress) {
  workInProgress.flags |= 4;
}
function preloadInstanceAndSuspendIfNeeded(workInProgress, type, oldProps, newProps, renderLanes2) {
  if (type = (workInProgress.mode & 32) !== 0)
    type = false;
  if (type) {
    if (workInProgress.flags |= 16777216, (renderLanes2 & 335544128) === renderLanes2)
      if (workInProgress.stateNode.complete)
        workInProgress.flags |= 8192;
      else if (shouldRemainOnPreviousScreen())
        workInProgress.flags |= 8192;
      else
        throw suspendedThenable = noopSuspenseyCommitThenable, SuspenseyCommitException;
  } else
    workInProgress.flags &= -16777217;
}
function preloadResourceAndSuspendIfNeeded(workInProgress, resource) {
  if (resource.type !== "stylesheet" || (resource.state.loading & 4) !== 0)
    workInProgress.flags &= -16777217;
  else if (workInProgress.flags |= 16777216, !preloadResource(resource))
    if (shouldRemainOnPreviousScreen())
      workInProgress.flags |= 8192;
    else
      throw suspendedThenable = noopSuspenseyCommitThenable, SuspenseyCommitException;
}
function scheduleRetryEffect(workInProgress, retryQueue) {
  retryQueue !== null && (workInProgress.flags |= 4);
  workInProgress.flags & 16384 && (retryQueue = workInProgress.tag !== 22 ? claimNextRetryLane() : 536870912, workInProgress.lanes |= retryQueue, workInProgressSuspendedRetryLanes |= retryQueue);
}
function cutOffTailIfNeeded(renderState, hasRenderedATailFallback) {
  if (!isHydrating)
    switch (renderState.tailMode) {
      case "hidden":
        hasRenderedATailFallback = renderState.tail;
        for (var lastTailNode = null;hasRenderedATailFallback !== null; )
          hasRenderedATailFallback.alternate !== null && (lastTailNode = hasRenderedATailFallback), hasRenderedATailFallback = hasRenderedATailFallback.sibling;
        lastTailNode === null ? renderState.tail = null : lastTailNode.sibling = null;
        break;
      case "collapsed":
        lastTailNode = renderState.tail;
        for (var lastTailNode$116 = null;lastTailNode !== null; )
          lastTailNode.alternate !== null && (lastTailNode$116 = lastTailNode), lastTailNode = lastTailNode.sibling;
        lastTailNode$116 === null ? hasRenderedATailFallback || renderState.tail === null ? renderState.tail = null : renderState.tail.sibling = null : lastTailNode$116.sibling = null;
    }
}
function bubbleProperties(completedWork) {
  var didBailout = completedWork.alternate !== null && completedWork.alternate.child === completedWork.child, newChildLanes = 0, subtreeFlags = 0;
  if (didBailout)
    if ((completedWork.mode & 2) !== 0) {
      for (var { selfBaseDuration: treeBaseDuration$118, child: child$119 } = completedWork;child$119 !== null; )
        newChildLanes |= child$119.lanes | child$119.childLanes, subtreeFlags |= child$119.subtreeFlags & 65011712, subtreeFlags |= child$119.flags & 65011712, treeBaseDuration$118 += child$119.treeBaseDuration, child$119 = child$119.sibling;
      completedWork.treeBaseDuration = treeBaseDuration$118;
    } else
      for (treeBaseDuration$118 = completedWork.child;treeBaseDuration$118 !== null; )
        newChildLanes |= treeBaseDuration$118.lanes | treeBaseDuration$118.childLanes, subtreeFlags |= treeBaseDuration$118.subtreeFlags & 65011712, subtreeFlags |= treeBaseDuration$118.flags & 65011712, treeBaseDuration$118.return = completedWork, treeBaseDuration$118 = treeBaseDuration$118.sibling;
  else if ((completedWork.mode & 2) !== 0) {
    treeBaseDuration$118 = completedWork.actualDuration;
    child$119 = completedWork.selfBaseDuration;
    for (var child = completedWork.child;child !== null; )
      newChildLanes |= child.lanes | child.childLanes, subtreeFlags |= child.subtreeFlags, subtreeFlags |= child.flags, treeBaseDuration$118 += child.actualDuration, child$119 += child.treeBaseDuration, child = child.sibling;
    completedWork.actualDuration = treeBaseDuration$118;
    completedWork.treeBaseDuration = child$119;
  } else
    for (treeBaseDuration$118 = completedWork.child;treeBaseDuration$118 !== null; )
      newChildLanes |= treeBaseDuration$118.lanes | treeBaseDuration$118.childLanes, subtreeFlags |= treeBaseDuration$118.subtreeFlags, subtreeFlags |= treeBaseDuration$118.flags, treeBaseDuration$118.return = completedWork, treeBaseDuration$118 = treeBaseDuration$118.sibling;
  completedWork.subtreeFlags |= subtreeFlags;
  completedWork.childLanes = newChildLanes;
  return didBailout;
}
function completeWork(current, workInProgress, renderLanes2) {
  var newProps = workInProgress.pendingProps;
  popTreeContext(workInProgress);
  switch (workInProgress.tag) {
    case 16:
    case 15:
    case 0:
    case 11:
    case 7:
    case 8:
    case 12:
    case 9:
    case 14:
      return bubbleProperties(workInProgress), null;
    case 1:
      return bubbleProperties(workInProgress), null;
    case 3:
      renderLanes2 = workInProgress.stateNode;
      newProps = null;
      current !== null && (newProps = current.memoizedState.cache);
      workInProgress.memoizedState.cache !== newProps && (workInProgress.flags |= 2048);
      popProvider(CacheContext);
      popHostContainer();
      renderLanes2.pendingContext && (renderLanes2.context = renderLanes2.pendingContext, renderLanes2.pendingContext = null);
      if (current === null || current.child === null)
        popHydrationState(workInProgress) ? markUpdate(workInProgress) : current === null || current.memoizedState.isDehydrated && (workInProgress.flags & 256) === 0 || (workInProgress.flags |= 1024, upgradeHydrationErrorsToRecoverable());
      bubbleProperties(workInProgress);
      return null;
    case 26:
      var { type, memoizedState: nextResource } = workInProgress;
      current === null ? (markUpdate(workInProgress), nextResource !== null ? (bubbleProperties(workInProgress), preloadResourceAndSuspendIfNeeded(workInProgress, nextResource)) : (bubbleProperties(workInProgress), preloadInstanceAndSuspendIfNeeded(workInProgress, type, null, newProps, renderLanes2))) : nextResource ? nextResource !== current.memoizedState ? (markUpdate(workInProgress), bubbleProperties(workInProgress), preloadResourceAndSuspendIfNeeded(workInProgress, nextResource)) : (bubbleProperties(workInProgress), workInProgress.flags &= -16777217) : (current = current.memoizedProps, current !== newProps && markUpdate(workInProgress), bubbleProperties(workInProgress), preloadInstanceAndSuspendIfNeeded(workInProgress, type, current, newProps, renderLanes2));
      return null;
    case 27:
      popHostContext(workInProgress);
      renderLanes2 = rootInstanceStackCursor.current;
      type = workInProgress.type;
      if (current !== null && workInProgress.stateNode != null)
        current.memoizedProps !== newProps && markUpdate(workInProgress);
      else {
        if (!newProps) {
          if (workInProgress.stateNode === null)
            throw Error(formatProdErrorMessage(166));
          bubbleProperties(workInProgress);
          return null;
        }
        current = contextStackCursor.current;
        popHydrationState(workInProgress) ? prepareToHydrateHostInstance(workInProgress, current) : (current = resolveSingletonInstance(type, newProps, renderLanes2), workInProgress.stateNode = current, markUpdate(workInProgress));
      }
      bubbleProperties(workInProgress);
      return null;
    case 5:
      popHostContext(workInProgress);
      type = workInProgress.type;
      if (current !== null && workInProgress.stateNode != null)
        current.memoizedProps !== newProps && markUpdate(workInProgress);
      else {
        if (!newProps) {
          if (workInProgress.stateNode === null)
            throw Error(formatProdErrorMessage(166));
          bubbleProperties(workInProgress);
          return null;
        }
        nextResource = contextStackCursor.current;
        if (popHydrationState(workInProgress))
          prepareToHydrateHostInstance(workInProgress, nextResource);
        else {
          var ownerDocument = getOwnerDocumentFromRootContainer(rootInstanceStackCursor.current);
          switch (nextResource) {
            case 1:
              nextResource = ownerDocument.createElementNS("http://www.w3.org/2000/svg", type);
              break;
            case 2:
              nextResource = ownerDocument.createElementNS("http://www.w3.org/1998/Math/MathML", type);
              break;
            default:
              switch (type) {
                case "svg":
                  nextResource = ownerDocument.createElementNS("http://www.w3.org/2000/svg", type);
                  break;
                case "math":
                  nextResource = ownerDocument.createElementNS("http://www.w3.org/1998/Math/MathML", type);
                  break;
                case "script":
                  nextResource = ownerDocument.createElement("div");
                  nextResource.innerHTML = "<script></script>";
                  nextResource = nextResource.removeChild(nextResource.firstChild);
                  break;
                case "select":
                  nextResource = typeof newProps.is === "string" ? ownerDocument.createElement("select", {
                    is: newProps.is
                  }) : ownerDocument.createElement("select");
                  newProps.multiple ? nextResource.multiple = true : newProps.size && (nextResource.size = newProps.size);
                  break;
                default:
                  nextResource = typeof newProps.is === "string" ? ownerDocument.createElement(type, { is: newProps.is }) : ownerDocument.createElement(type);
              }
          }
          nextResource[internalInstanceKey] = workInProgress;
          nextResource[internalPropsKey] = newProps;
          a:
            for (ownerDocument = workInProgress.child;ownerDocument !== null; ) {
              if (ownerDocument.tag === 5 || ownerDocument.tag === 6)
                nextResource.appendChild(ownerDocument.stateNode);
              else if (ownerDocument.tag !== 4 && ownerDocument.tag !== 27 && ownerDocument.child !== null) {
                ownerDocument.child.return = ownerDocument;
                ownerDocument = ownerDocument.child;
                continue;
              }
              if (ownerDocument === workInProgress)
                break a;
              for (;ownerDocument.sibling === null; ) {
                if (ownerDocument.return === null || ownerDocument.return === workInProgress)
                  break a;
                ownerDocument = ownerDocument.return;
              }
              ownerDocument.sibling.return = ownerDocument.return;
              ownerDocument = ownerDocument.sibling;
            }
          workInProgress.stateNode = nextResource;
          a:
            switch (setInitialProperties(nextResource, type, newProps), type) {
              case "button":
              case "input":
              case "select":
              case "textarea":
                newProps = !!newProps.autoFocus;
                break a;
              case "img":
                newProps = true;
                break a;
              default:
                newProps = false;
            }
          newProps && markUpdate(workInProgress);
        }
      }
      bubbleProperties(workInProgress);
      preloadInstanceAndSuspendIfNeeded(workInProgress, workInProgress.type, current === null ? null : current.memoizedProps, workInProgress.pendingProps, renderLanes2);
      return null;
    case 6:
      if (current && workInProgress.stateNode != null)
        current.memoizedProps !== newProps && markUpdate(workInProgress);
      else {
        if (typeof newProps !== "string" && workInProgress.stateNode === null)
          throw Error(formatProdErrorMessage(166));
        current = rootInstanceStackCursor.current;
        if (popHydrationState(workInProgress)) {
          current = workInProgress.stateNode;
          renderLanes2 = workInProgress.memoizedProps;
          newProps = null;
          type = hydrationParentFiber;
          if (type !== null)
            switch (type.tag) {
              case 27:
              case 5:
                newProps = type.memoizedProps;
            }
          current[internalInstanceKey] = workInProgress;
          current = current.nodeValue === renderLanes2 || newProps !== null && newProps.suppressHydrationWarning === true || checkForUnmatchedText(current.nodeValue, renderLanes2) ? true : false;
          current || throwOnHydrationMismatch(workInProgress, true);
        } else
          current = getOwnerDocumentFromRootContainer(current).createTextNode(newProps), current[internalInstanceKey] = workInProgress, workInProgress.stateNode = current;
      }
      bubbleProperties(workInProgress);
      return null;
    case 31:
      renderLanes2 = workInProgress.memoizedState;
      if (current === null || current.memoizedState !== null) {
        newProps = popHydrationState(workInProgress);
        if (renderLanes2 !== null) {
          if (current === null) {
            if (!newProps)
              throw Error(formatProdErrorMessage(318));
            current = workInProgress.memoizedState;
            current = current !== null ? current.dehydrated : null;
            if (!current)
              throw Error(formatProdErrorMessage(557));
            current[internalInstanceKey] = workInProgress;
            bubbleProperties(workInProgress);
            (workInProgress.mode & 2) !== 0 && renderLanes2 !== null && (current = workInProgress.child, current !== null && (workInProgress.treeBaseDuration -= current.treeBaseDuration));
          } else
            resetHydrationState(), (workInProgress.flags & 128) === 0 && (renderLanes2 = workInProgress.memoizedState = null), workInProgress.flags |= 4, bubbleProperties(workInProgress), (workInProgress.mode & 2) !== 0 && renderLanes2 !== null && (current = workInProgress.child, current !== null && (workInProgress.treeBaseDuration -= current.treeBaseDuration));
          current = false;
        } else
          renderLanes2 = upgradeHydrationErrorsToRecoverable(), current !== null && current.memoizedState !== null && (current.memoizedState.hydrationErrors = renderLanes2), current = true;
        if (!current) {
          if (workInProgress.flags & 256)
            return popSuspenseHandler(workInProgress), workInProgress;
          popSuspenseHandler(workInProgress);
          return null;
        }
        if ((workInProgress.flags & 128) !== 0)
          throw Error(formatProdErrorMessage(558));
      }
      bubbleProperties(workInProgress);
      return null;
    case 13:
      newProps = workInProgress.memoizedState;
      if (current === null || current.memoizedState !== null && current.memoizedState.dehydrated !== null) {
        type = newProps;
        nextResource = popHydrationState(workInProgress);
        if (type !== null && type.dehydrated !== null) {
          if (current === null) {
            if (!nextResource)
              throw Error(formatProdErrorMessage(318));
            nextResource = workInProgress.memoizedState;
            nextResource = nextResource !== null ? nextResource.dehydrated : null;
            if (!nextResource)
              throw Error(formatProdErrorMessage(317));
            nextResource[internalInstanceKey] = workInProgress;
            bubbleProperties(workInProgress);
            (workInProgress.mode & 2) !== 0 && type !== null && (type = workInProgress.child, type !== null && (workInProgress.treeBaseDuration -= type.treeBaseDuration));
          } else
            resetHydrationState(), (workInProgress.flags & 128) === 0 && (type = workInProgress.memoizedState = null), workInProgress.flags |= 4, bubbleProperties(workInProgress), (workInProgress.mode & 2) !== 0 && type !== null && (type = workInProgress.child, type !== null && (workInProgress.treeBaseDuration -= type.treeBaseDuration));
          type = false;
        } else
          type = upgradeHydrationErrorsToRecoverable(), current !== null && current.memoizedState !== null && (current.memoizedState.hydrationErrors = type), type = true;
        if (!type) {
          if (workInProgress.flags & 256)
            return popSuspenseHandler(workInProgress), workInProgress;
          popSuspenseHandler(workInProgress);
          return null;
        }
      }
      popSuspenseHandler(workInProgress);
      if ((workInProgress.flags & 128) !== 0)
        return workInProgress.lanes = renderLanes2, (workInProgress.mode & 2) !== 0 && transferActualDuration(workInProgress), workInProgress;
      renderLanes2 = newProps !== null;
      current = current !== null && current.memoizedState !== null;
      renderLanes2 && (newProps = workInProgress.child, type = null, newProps.alternate !== null && newProps.alternate.memoizedState !== null && newProps.alternate.memoizedState.cachePool !== null && (type = newProps.alternate.memoizedState.cachePool.pool), nextResource = null, newProps.memoizedState !== null && newProps.memoizedState.cachePool !== null && (nextResource = newProps.memoizedState.cachePool.pool), nextResource !== type && (newProps.flags |= 2048));
      renderLanes2 !== current && renderLanes2 && (workInProgress.child.flags |= 8192);
      scheduleRetryEffect(workInProgress, workInProgress.updateQueue);
      bubbleProperties(workInProgress);
      (workInProgress.mode & 2) !== 0 && renderLanes2 && (current = workInProgress.child, current !== null && (workInProgress.treeBaseDuration -= current.treeBaseDuration));
      return null;
    case 4:
      return popHostContainer(), current === null && listenToAllSupportedEvents(workInProgress.stateNode.containerInfo), bubbleProperties(workInProgress), null;
    case 10:
      return popProvider(workInProgress.type), bubbleProperties(workInProgress), null;
    case 19:
      pop2(suspenseStackCursor);
      newProps = workInProgress.memoizedState;
      if (newProps === null)
        return bubbleProperties(workInProgress), null;
      type = (workInProgress.flags & 128) !== 0;
      nextResource = newProps.rendering;
      if (nextResource === null)
        if (type)
          cutOffTailIfNeeded(newProps, false);
        else {
          if (workInProgressRootExitStatus !== 0 || current !== null && (current.flags & 128) !== 0)
            for (current = workInProgress.child;current !== null; ) {
              nextResource = findFirstSuspended(current);
              if (nextResource !== null) {
                workInProgress.flags |= 128;
                cutOffTailIfNeeded(newProps, false);
                current = nextResource.updateQueue;
                workInProgress.updateQueue = current;
                scheduleRetryEffect(workInProgress, current);
                workInProgress.subtreeFlags = 0;
                current = renderLanes2;
                for (renderLanes2 = workInProgress.child;renderLanes2 !== null; )
                  resetWorkInProgress(renderLanes2, current), renderLanes2 = renderLanes2.sibling;
                push2(suspenseStackCursor, suspenseStackCursor.current & 1 | 2);
                isHydrating && pushTreeFork(workInProgress, newProps.treeForkCount);
                return workInProgress.child;
              }
              current = current.sibling;
            }
          newProps.tail !== null && now$1() > workInProgressRootRenderTargetTime && (workInProgress.flags |= 128, type = true, cutOffTailIfNeeded(newProps, false), workInProgress.lanes = 4194304);
        }
      else {
        if (!type)
          if (current = findFirstSuspended(nextResource), current !== null) {
            if (workInProgress.flags |= 128, type = true, current = current.updateQueue, workInProgress.updateQueue = current, scheduleRetryEffect(workInProgress, current), cutOffTailIfNeeded(newProps, true), newProps.tail === null && newProps.tailMode === "hidden" && !nextResource.alternate && !isHydrating)
              return bubbleProperties(workInProgress), null;
          } else
            2 * now$1() - newProps.renderingStartTime > workInProgressRootRenderTargetTime && renderLanes2 !== 536870912 && (workInProgress.flags |= 128, type = true, cutOffTailIfNeeded(newProps, false), workInProgress.lanes = 4194304);
        newProps.isBackwards ? (nextResource.sibling = workInProgress.child, workInProgress.child = nextResource) : (current = newProps.last, current !== null ? current.sibling = nextResource : workInProgress.child = nextResource, newProps.last = nextResource);
      }
      if (newProps.tail !== null)
        return current = newProps.tail, newProps.rendering = current, newProps.tail = current.sibling, newProps.renderingStartTime = now$1(), current.sibling = null, renderLanes2 = suspenseStackCursor.current, push2(suspenseStackCursor, type ? renderLanes2 & 1 | 2 : renderLanes2 & 1), isHydrating && pushTreeFork(workInProgress, newProps.treeForkCount), current;
      bubbleProperties(workInProgress);
      return null;
    case 22:
    case 23:
      return popSuspenseHandler(workInProgress), popHiddenContext(), newProps = workInProgress.memoizedState !== null, current !== null ? current.memoizedState !== null !== newProps && (workInProgress.flags |= 8192) : newProps && (workInProgress.flags |= 8192), newProps ? (renderLanes2 & 536870912) !== 0 && (workInProgress.flags & 128) === 0 && (bubbleProperties(workInProgress), workInProgress.subtreeFlags & 6 && (workInProgress.flags |= 8192)) : bubbleProperties(workInProgress), renderLanes2 = workInProgress.updateQueue, renderLanes2 !== null && scheduleRetryEffect(workInProgress, renderLanes2.retryQueue), renderLanes2 = null, current !== null && current.memoizedState !== null && current.memoizedState.cachePool !== null && (renderLanes2 = current.memoizedState.cachePool.pool), newProps = null, workInProgress.memoizedState !== null && workInProgress.memoizedState.cachePool !== null && (newProps = workInProgress.memoizedState.cachePool.pool), newProps !== renderLanes2 && (workInProgress.flags |= 2048), current !== null && pop2(resumedCache), null;
    case 24:
      return renderLanes2 = null, current !== null && (renderLanes2 = current.memoizedState.cache), workInProgress.memoizedState.cache !== renderLanes2 && (workInProgress.flags |= 2048), popProvider(CacheContext), bubbleProperties(workInProgress), null;
    case 25:
      return null;
    case 30:
      return null;
  }
  throw Error(formatProdErrorMessage(156, workInProgress.tag));
}
function unwindWork(current, workInProgress) {
  popTreeContext(workInProgress);
  switch (workInProgress.tag) {
    case 1:
      return current = workInProgress.flags, current & 65536 ? (workInProgress.flags = current & -65537 | 128, (workInProgress.mode & 2) !== 0 && transferActualDuration(workInProgress), workInProgress) : null;
    case 3:
      return popProvider(CacheContext), popHostContainer(), current = workInProgress.flags, (current & 65536) !== 0 && (current & 128) === 0 ? (workInProgress.flags = current & -65537 | 128, workInProgress) : null;
    case 26:
    case 27:
    case 5:
      return popHostContext(workInProgress), null;
    case 31:
      if (workInProgress.memoizedState !== null) {
        popSuspenseHandler(workInProgress);
        if (workInProgress.alternate === null)
          throw Error(formatProdErrorMessage(340));
        resetHydrationState();
      }
      current = workInProgress.flags;
      return current & 65536 ? (workInProgress.flags = current & -65537 | 128, (workInProgress.mode & 2) !== 0 && transferActualDuration(workInProgress), workInProgress) : null;
    case 13:
      popSuspenseHandler(workInProgress);
      current = workInProgress.memoizedState;
      if (current !== null && current.dehydrated !== null) {
        if (workInProgress.alternate === null)
          throw Error(formatProdErrorMessage(340));
        resetHydrationState();
      }
      current = workInProgress.flags;
      return current & 65536 ? (workInProgress.flags = current & -65537 | 128, (workInProgress.mode & 2) !== 0 && transferActualDuration(workInProgress), workInProgress) : null;
    case 19:
      return pop2(suspenseStackCursor), null;
    case 4:
      return popHostContainer(), null;
    case 10:
      return popProvider(workInProgress.type), null;
    case 22:
    case 23:
      return popSuspenseHandler(workInProgress), popHiddenContext(), current !== null && pop2(resumedCache), current = workInProgress.flags, current & 65536 ? (workInProgress.flags = current & -65537 | 128, (workInProgress.mode & 2) !== 0 && transferActualDuration(workInProgress), workInProgress) : null;
    case 24:
      return popProvider(CacheContext), null;
    case 25:
      return null;
    default:
      return null;
  }
}
function unwindInterruptedWork(current, interruptedWork) {
  popTreeContext(interruptedWork);
  switch (interruptedWork.tag) {
    case 3:
      popProvider(CacheContext);
      popHostContainer();
      break;
    case 26:
    case 27:
    case 5:
      popHostContext(interruptedWork);
      break;
    case 4:
      popHostContainer();
      break;
    case 31:
      interruptedWork.memoizedState !== null && popSuspenseHandler(interruptedWork);
      break;
    case 13:
      popSuspenseHandler(interruptedWork);
      break;
    case 19:
      pop2(suspenseStackCursor);
      break;
    case 10:
      popProvider(interruptedWork.type);
      break;
    case 22:
    case 23:
      popSuspenseHandler(interruptedWork);
      popHiddenContext();
      current !== null && pop2(resumedCache);
      break;
    case 24:
      popProvider(CacheContext);
  }
}
function shouldProfile(current) {
  return (current.mode & 2) !== 0;
}
function commitHookLayoutEffects(finishedWork, hookFlags) {
  shouldProfile(finishedWork) ? (startEffectTimer(), commitHookEffectListMount(hookFlags, finishedWork), recordEffectDuration()) : commitHookEffectListMount(hookFlags, finishedWork);
}
function commitHookLayoutUnmountEffects(finishedWork, nearestMountedAncestor, hookFlags) {
  shouldProfile(finishedWork) ? (startEffectTimer(), commitHookEffectListUnmount(hookFlags, finishedWork, nearestMountedAncestor), recordEffectDuration()) : commitHookEffectListUnmount(hookFlags, finishedWork, nearestMountedAncestor);
}
function commitHookEffectListMount(flags, finishedWork) {
  try {
    var updateQueue = finishedWork.updateQueue, lastEffect = updateQueue !== null ? updateQueue.lastEffect : null;
    if (lastEffect !== null) {
      var firstEffect = lastEffect.next;
      updateQueue = firstEffect;
      do {
        if ((updateQueue.tag & flags) === flags) {
          lastEffect = undefined;
          var { create, inst } = updateQueue;
          lastEffect = create();
          inst.destroy = lastEffect;
        }
        updateQueue = updateQueue.next;
      } while (updateQueue !== firstEffect);
    }
  } catch (error) {
    captureCommitPhaseError(finishedWork, finishedWork.return, error);
  }
}
function commitHookEffectListUnmount(flags, finishedWork, nearestMountedAncestor$jscomp$0) {
  try {
    var updateQueue = finishedWork.updateQueue, lastEffect = updateQueue !== null ? updateQueue.lastEffect : null;
    if (lastEffect !== null) {
      var firstEffect = lastEffect.next;
      updateQueue = firstEffect;
      do {
        if ((updateQueue.tag & flags) === flags) {
          var inst = updateQueue.inst, destroy = inst.destroy;
          if (destroy !== undefined) {
            inst.destroy = undefined;
            lastEffect = finishedWork;
            var nearestMountedAncestor = nearestMountedAncestor$jscomp$0, destroy_ = destroy;
            try {
              destroy_();
            } catch (error) {
              captureCommitPhaseError(lastEffect, nearestMountedAncestor, error);
            }
          }
        }
        updateQueue = updateQueue.next;
      } while (updateQueue !== firstEffect);
    }
  } catch (error) {
    captureCommitPhaseError(finishedWork, finishedWork.return, error);
  }
}
function commitHookPassiveMountEffects(finishedWork, hookFlags) {
  shouldProfile(finishedWork) ? (startEffectTimer(), commitHookEffectListMount(hookFlags, finishedWork), recordEffectDuration()) : commitHookEffectListMount(hookFlags, finishedWork);
}
function commitHookPassiveUnmountEffects(finishedWork, nearestMountedAncestor, hookFlags) {
  shouldProfile(finishedWork) ? (startEffectTimer(), commitHookEffectListUnmount(hookFlags, finishedWork, nearestMountedAncestor), recordEffectDuration()) : commitHookEffectListUnmount(hookFlags, finishedWork, nearestMountedAncestor);
}
function commitClassCallbacks(finishedWork) {
  var updateQueue = finishedWork.updateQueue;
  if (updateQueue !== null) {
    var instance = finishedWork.stateNode;
    try {
      commitCallbacks(updateQueue, instance);
    } catch (error) {
      captureCommitPhaseError(finishedWork, finishedWork.return, error);
    }
  }
}
function safelyCallComponentWillUnmount(current, nearestMountedAncestor, instance) {
  instance.props = resolveClassComponentProps(current.type, current.memoizedProps);
  instance.state = current.memoizedState;
  if (shouldProfile(current)) {
    startEffectTimer();
    try {
      instance.componentWillUnmount();
    } catch (error) {
      captureCommitPhaseError(current, nearestMountedAncestor, error);
    }
    recordEffectDuration();
  } else
    try {
      instance.componentWillUnmount();
    } catch (error$159) {
      captureCommitPhaseError(current, nearestMountedAncestor, error$159);
    }
}
function safelyAttachRef(current, nearestMountedAncestor) {
  try {
    var ref = current.ref;
    if (ref !== null) {
      switch (current.tag) {
        case 26:
        case 27:
        case 5:
          var instanceToUse = current.stateNode;
          break;
        case 30:
          instanceToUse = current.stateNode;
          break;
        default:
          instanceToUse = current.stateNode;
      }
      if (typeof ref === "function")
        if (shouldProfile(current))
          try {
            startEffectTimer(), current.refCleanup = ref(instanceToUse);
          } finally {
            recordEffectDuration();
          }
        else
          current.refCleanup = ref(instanceToUse);
      else
        ref.current = instanceToUse;
    }
  } catch (error) {
    captureCommitPhaseError(current, nearestMountedAncestor, error);
  }
}
function safelyDetachRef(current, nearestMountedAncestor) {
  var { ref, refCleanup } = current;
  if (ref !== null)
    if (typeof refCleanup === "function")
      try {
        if (shouldProfile(current))
          try {
            startEffectTimer(), refCleanup();
          } finally {
            recordEffectDuration(current);
          }
        else
          refCleanup();
      } catch (error) {
        captureCommitPhaseError(current, nearestMountedAncestor, error);
      } finally {
        current.refCleanup = null, current = current.alternate, current != null && (current.refCleanup = null);
      }
    else if (typeof ref === "function")
      try {
        if (shouldProfile(current))
          try {
            startEffectTimer(), ref(null);
          } finally {
            recordEffectDuration(current);
          }
        else
          ref(null);
      } catch (error$160) {
        captureCommitPhaseError(current, nearestMountedAncestor, error$160);
      }
    else
      ref.current = null;
}
function commitProfilerUpdate(finishedWork, current, commitStartTime2, effectDuration) {
  try {
    var _finishedWork$memoize = finishedWork.memoizedProps, id = _finishedWork$memoize.id, onCommit = _finishedWork$memoize.onCommit, onRender = _finishedWork$memoize.onRender;
    current = current === null ? "mount" : "update";
    currentUpdateIsNested && (current = "nested-update");
    typeof onRender === "function" && onRender(id, current, finishedWork.actualDuration, finishedWork.treeBaseDuration, finishedWork.actualStartTime, commitStartTime2);
    typeof onCommit === "function" && onCommit(id, current, effectDuration, commitStartTime2);
  } catch (error) {
    captureCommitPhaseError(finishedWork, finishedWork.return, error);
  }
}
function commitHostMount(finishedWork) {
  var { type, memoizedProps: props, stateNode: instance } = finishedWork;
  try {
    a:
      switch (type) {
        case "button":
        case "input":
        case "select":
        case "textarea":
          props.autoFocus && instance.focus();
          break a;
        case "img":
          props.src ? instance.src = props.src : props.srcSet && (instance.srcset = props.srcSet);
      }
  } catch (error) {
    captureCommitPhaseError(finishedWork, finishedWork.return, error);
  }
}
function commitHostUpdate(finishedWork, newProps, oldProps) {
  try {
    var domElement = finishedWork.stateNode;
    updateProperties(domElement, finishedWork.type, oldProps, newProps);
    domElement[internalPropsKey] = newProps;
  } catch (error) {
    captureCommitPhaseError(finishedWork, finishedWork.return, error);
  }
}
function isHostParent(fiber) {
  return fiber.tag === 5 || fiber.tag === 3 || fiber.tag === 26 || fiber.tag === 27 && isSingletonScope(fiber.type) || fiber.tag === 4;
}
function getHostSibling(fiber) {
  a:
    for (;; ) {
      for (;fiber.sibling === null; ) {
        if (fiber.return === null || isHostParent(fiber.return))
          return null;
        fiber = fiber.return;
      }
      fiber.sibling.return = fiber.return;
      for (fiber = fiber.sibling;fiber.tag !== 5 && fiber.tag !== 6 && fiber.tag !== 18; ) {
        if (fiber.tag === 27 && isSingletonScope(fiber.type))
          continue a;
        if (fiber.flags & 2)
          continue a;
        if (fiber.child === null || fiber.tag === 4)
          continue a;
        else
          fiber.child.return = fiber, fiber = fiber.child;
      }
      if (!(fiber.flags & 2))
        return fiber.stateNode;
    }
}
function insertOrAppendPlacementNodeIntoContainer(node, before, parent) {
  var tag = node.tag;
  if (tag === 5 || tag === 6)
    node = node.stateNode, before ? (parent.nodeType === 9 ? parent.body : parent.nodeName === "HTML" ? parent.ownerDocument.body : parent).insertBefore(node, before) : (before = parent.nodeType === 9 ? parent.body : parent.nodeName === "HTML" ? parent.ownerDocument.body : parent, before.appendChild(node), parent = parent._reactRootContainer, parent !== null && parent !== undefined || before.onclick !== null || (before.onclick = noop$1));
  else if (tag !== 4 && (tag === 27 && isSingletonScope(node.type) && (parent = node.stateNode, before = null), node = node.child, node !== null))
    for (insertOrAppendPlacementNodeIntoContainer(node, before, parent), node = node.sibling;node !== null; )
      insertOrAppendPlacementNodeIntoContainer(node, before, parent), node = node.sibling;
}
function insertOrAppendPlacementNode(node, before, parent) {
  var tag = node.tag;
  if (tag === 5 || tag === 6)
    node = node.stateNode, before ? parent.insertBefore(node, before) : parent.appendChild(node);
  else if (tag !== 4 && (tag === 27 && isSingletonScope(node.type) && (parent = node.stateNode), node = node.child, node !== null))
    for (insertOrAppendPlacementNode(node, before, parent), node = node.sibling;node !== null; )
      insertOrAppendPlacementNode(node, before, parent), node = node.sibling;
}
function commitHostSingletonAcquisition(finishedWork) {
  var { stateNode: singleton, memoizedProps: props } = finishedWork;
  try {
    for (var type = finishedWork.type, attributes = singleton.attributes;attributes.length; )
      singleton.removeAttributeNode(attributes[0]);
    setInitialProperties(singleton, type, props);
    singleton[internalInstanceKey] = finishedWork;
    singleton[internalPropsKey] = props;
  } catch (error) {
    captureCommitPhaseError(finishedWork, finishedWork.return, error);
  }
}
function isHydratingParent(current, finishedWork) {
  return finishedWork.tag === 31 ? (finishedWork = finishedWork.memoizedState, current.memoizedState !== null && finishedWork === null) : finishedWork.tag === 13 ? (current = current.memoizedState, finishedWork = finishedWork.memoizedState, current !== null && current.dehydrated !== null && (finishedWork === null || finishedWork.dehydrated === null)) : finishedWork.tag === 3 ? current.memoizedState.isDehydrated && (finishedWork.flags & 256) === 0 : false;
}
function commitBeforeMutationEffects(root2, firstChild) {
  root2 = root2.containerInfo;
  eventsEnabled = _enabled;
  root2 = getActiveElementDeep(root2);
  if (hasSelectionCapabilities(root2)) {
    if ("selectionStart" in root2)
      var JSCompiler_temp = {
        start: root2.selectionStart,
        end: root2.selectionEnd
      };
    else
      a: {
        JSCompiler_temp = (JSCompiler_temp = root2.ownerDocument) && JSCompiler_temp.defaultView || window;
        var selection = JSCompiler_temp.getSelection && JSCompiler_temp.getSelection();
        if (selection && selection.rangeCount !== 0) {
          JSCompiler_temp = selection.anchorNode;
          var { anchorOffset, focusNode } = selection;
          selection = selection.focusOffset;
          try {
            JSCompiler_temp.nodeType, focusNode.nodeType;
          } catch (e$22) {
            JSCompiler_temp = null;
            break a;
          }
          var length = 0, start = -1, end = -1, indexWithinAnchor = 0, indexWithinFocus = 0, node = root2, parentNode = null;
          b:
            for (;; ) {
              for (var next;; ) {
                node !== JSCompiler_temp || anchorOffset !== 0 && node.nodeType !== 3 || (start = length + anchorOffset);
                node !== focusNode || selection !== 0 && node.nodeType !== 3 || (end = length + selection);
                node.nodeType === 3 && (length += node.nodeValue.length);
                if ((next = node.firstChild) === null)
                  break;
                parentNode = node;
                node = next;
              }
              for (;; ) {
                if (node === root2)
                  break b;
                parentNode === JSCompiler_temp && ++indexWithinAnchor === anchorOffset && (start = length);
                parentNode === focusNode && ++indexWithinFocus === selection && (end = length);
                if ((next = node.nextSibling) !== null)
                  break;
                node = parentNode;
                parentNode = node.parentNode;
              }
              node = next;
            }
          JSCompiler_temp = start === -1 || end === -1 ? null : { start, end };
        } else
          JSCompiler_temp = null;
      }
    JSCompiler_temp = JSCompiler_temp || { start: 0, end: 0 };
  } else
    JSCompiler_temp = null;
  selectionInformation = { focusedElem: root2, selectionRange: JSCompiler_temp };
  _enabled = false;
  for (nextEffect = firstChild;nextEffect !== null; )
    if (firstChild = nextEffect, root2 = firstChild.child, (firstChild.subtreeFlags & 1028) !== 0 && root2 !== null)
      root2.return = firstChild, nextEffect = root2;
    else
      for (;nextEffect !== null; ) {
        firstChild = nextEffect;
        focusNode = firstChild.alternate;
        root2 = firstChild.flags;
        switch (firstChild.tag) {
          case 0:
            if ((root2 & 4) !== 0 && (root2 = firstChild.updateQueue, root2 = root2 !== null ? root2.events : null, root2 !== null))
              for (JSCompiler_temp = 0;JSCompiler_temp < root2.length; JSCompiler_temp++)
                anchorOffset = root2[JSCompiler_temp], anchorOffset.ref.impl = anchorOffset.nextImpl;
            break;
          case 11:
          case 15:
            break;
          case 1:
            if ((root2 & 1024) !== 0 && focusNode !== null) {
              root2 = undefined;
              JSCompiler_temp = firstChild;
              anchorOffset = focusNode.memoizedProps;
              focusNode = focusNode.memoizedState;
              selection = JSCompiler_temp.stateNode;
              try {
                var resolvedPrevProps = resolveClassComponentProps(JSCompiler_temp.type, anchorOffset);
                root2 = selection.getSnapshotBeforeUpdate(resolvedPrevProps, focusNode);
                selection.__reactInternalSnapshotBeforeUpdate = root2;
              } catch (error) {
                captureCommitPhaseError(JSCompiler_temp, JSCompiler_temp.return, error);
              }
            }
            break;
          case 3:
            if ((root2 & 1024) !== 0) {
              if (root2 = firstChild.stateNode.containerInfo, JSCompiler_temp = root2.nodeType, JSCompiler_temp === 9)
                clearContainerSparingly(root2);
              else if (JSCompiler_temp === 1)
                switch (root2.nodeName) {
                  case "HEAD":
                  case "HTML":
                  case "BODY":
                    clearContainerSparingly(root2);
                    break;
                  default:
                    root2.textContent = "";
                }
            }
            break;
          case 5:
          case 26:
          case 27:
          case 6:
          case 4:
          case 17:
            break;
          default:
            if ((root2 & 1024) !== 0)
              throw Error(formatProdErrorMessage(163));
        }
        root2 = firstChild.sibling;
        if (root2 !== null) {
          root2.return = firstChild.return;
          nextEffect = root2;
          break;
        }
        nextEffect = firstChild.return;
      }
}
function commitLayoutEffectOnFiber(finishedRoot, current, finishedWork) {
  var prevEffectStart = pushComponentEffectStart(), prevEffectDuration = pushComponentEffectDuration(), prevEffectErrors = pushComponentEffectErrors(), prevEffectDidSpawnUpdate = pushComponentEffectDidSpawnUpdate(), flags = finishedWork.flags;
  switch (finishedWork.tag) {
    case 0:
    case 11:
    case 15:
      recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
      flags & 4 && commitHookLayoutEffects(finishedWork, 5);
      break;
    case 1:
      recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
      if (flags & 4)
        if (finishedRoot = finishedWork.stateNode, current === null)
          if (shouldProfile(finishedWork)) {
            startEffectTimer();
            try {
              finishedRoot.componentDidMount();
            } catch (error) {
              captureCommitPhaseError(finishedWork, finishedWork.return, error);
            }
            recordEffectDuration();
          } else
            try {
              finishedRoot.componentDidMount();
            } catch (error$156) {
              captureCommitPhaseError(finishedWork, finishedWork.return, error$156);
            }
        else {
          var prevProps = resolveClassComponentProps(finishedWork.type, current.memoizedProps);
          current = current.memoizedState;
          if (shouldProfile(finishedWork)) {
            startEffectTimer();
            try {
              finishedRoot.componentDidUpdate(prevProps, current, finishedRoot.__reactInternalSnapshotBeforeUpdate);
            } catch (error$157) {
              captureCommitPhaseError(finishedWork, finishedWork.return, error$157);
            }
            recordEffectDuration();
          } else
            try {
              finishedRoot.componentDidUpdate(prevProps, current, finishedRoot.__reactInternalSnapshotBeforeUpdate);
            } catch (error$158) {
              captureCommitPhaseError(finishedWork, finishedWork.return, error$158);
            }
        }
      flags & 64 && commitClassCallbacks(finishedWork);
      flags & 512 && safelyAttachRef(finishedWork, finishedWork.return);
      break;
    case 3:
      current = pushNestedEffectDurations();
      recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
      if (flags & 64 && (flags = finishedWork.updateQueue, flags !== null)) {
        prevProps = null;
        if (finishedWork.child !== null)
          switch (finishedWork.child.tag) {
            case 27:
            case 5:
              prevProps = finishedWork.child.stateNode;
              break;
            case 1:
              prevProps = finishedWork.child.stateNode;
          }
        try {
          commitCallbacks(flags, prevProps);
        } catch (error) {
          captureCommitPhaseError(finishedWork, finishedWork.return, error);
        }
      }
      finishedRoot.effectDuration += popNestedEffectDurations(current);
      break;
    case 27:
      current === null && flags & 4 && commitHostSingletonAcquisition(finishedWork);
    case 26:
    case 5:
      recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
      current === null && flags & 4 && commitHostMount(finishedWork);
      flags & 512 && safelyAttachRef(finishedWork, finishedWork.return);
      break;
    case 12:
      flags & 4 ? (flags = pushNestedEffectDurations(), recursivelyTraverseLayoutEffects(finishedRoot, finishedWork), finishedRoot = finishedWork.stateNode, finishedRoot.effectDuration += bubbleNestedEffectDurations(flags), commitProfilerUpdate(finishedWork, current, commitStartTime, finishedRoot.effectDuration)) : recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
      break;
    case 31:
      recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
      flags & 4 && commitActivityHydrationCallbacks(finishedRoot, finishedWork);
      break;
    case 13:
      recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
      flags & 4 && commitSuspenseHydrationCallbacks(finishedRoot, finishedWork);
      flags & 64 && (finishedRoot = finishedWork.memoizedState, finishedRoot !== null && (finishedRoot = finishedRoot.dehydrated, finishedRoot !== null && (current = retryDehydratedSuspenseBoundary.bind(null, finishedWork), registerSuspenseInstanceRetry(finishedRoot, current))));
      break;
    case 22:
      flags = finishedWork.memoizedState !== null || offscreenSubtreeIsHidden;
      if (!flags) {
        current = current !== null && current.memoizedState !== null || offscreenSubtreeWasHidden;
        prevProps = offscreenSubtreeIsHidden;
        var prevOffscreenSubtreeWasHidden = offscreenSubtreeWasHidden;
        offscreenSubtreeIsHidden = flags;
        (offscreenSubtreeWasHidden = current) && !prevOffscreenSubtreeWasHidden ? (recursivelyTraverseReappearLayoutEffects(finishedRoot, finishedWork, (finishedWork.subtreeFlags & 8772) !== 0), (finishedWork.mode & 2) !== 0 && 0 <= componentEffectStartTime && 0 <= componentEffectEndTime && 0.05 < componentEffectEndTime - componentEffectStartTime && logComponentReappeared(finishedWork, componentEffectStartTime, componentEffectEndTime)) : recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
        offscreenSubtreeIsHidden = prevProps;
        offscreenSubtreeWasHidden = prevOffscreenSubtreeWasHidden;
      }
      break;
    case 30:
      break;
    default:
      recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
  }
  (finishedWork.mode & 2) !== 0 && 0 <= componentEffectStartTime && 0 <= componentEffectEndTime && ((componentEffectSpawnedUpdate || 0.05 < componentEffectDuration) && logComponentEffect(finishedWork, componentEffectStartTime, componentEffectEndTime, componentEffectDuration, componentEffectErrors), finishedWork.alternate === null && finishedWork.return !== null && finishedWork.return.alternate !== null && 0.05 < componentEffectEndTime - componentEffectStartTime && (isHydratingParent(finishedWork.return.alternate, finishedWork.return) || logComponentTrigger(finishedWork, componentEffectStartTime, componentEffectEndTime, "Mount")));
  popComponentEffectStart(prevEffectStart);
  popComponentEffectDuration(prevEffectDuration);
  componentEffectErrors = prevEffectErrors;
  componentEffectSpawnedUpdate = prevEffectDidSpawnUpdate;
}
function detachFiberAfterEffects(fiber) {
  var alternate = fiber.alternate;
  alternate !== null && (fiber.alternate = null, detachFiberAfterEffects(alternate));
  fiber.child = null;
  fiber.deletions = null;
  fiber.sibling = null;
  fiber.tag === 5 && (alternate = fiber.stateNode, alternate !== null && detachDeletedInstance(alternate));
  fiber.stateNode = null;
  fiber.return = null;
  fiber.dependencies = null;
  fiber.memoizedProps = null;
  fiber.memoizedState = null;
  fiber.pendingProps = null;
  fiber.stateNode = null;
  fiber.updateQueue = null;
}
function recursivelyTraverseDeletionEffects(finishedRoot, nearestMountedAncestor, parent) {
  for (parent = parent.child;parent !== null; )
    commitDeletionEffectsOnFiber(finishedRoot, nearestMountedAncestor, parent), parent = parent.sibling;
}
function commitDeletionEffectsOnFiber(finishedRoot, nearestMountedAncestor, deletedFiber) {
  if (injectedHook && typeof injectedHook.onCommitFiberUnmount === "function")
    try {
      injectedHook.onCommitFiberUnmount(rendererID, deletedFiber);
    } catch (err) {}
  var prevEffectStart = pushComponentEffectStart(), prevEffectDuration = pushComponentEffectDuration(), prevEffectErrors = pushComponentEffectErrors(), prevEffectDidSpawnUpdate = pushComponentEffectDidSpawnUpdate();
  switch (deletedFiber.tag) {
    case 26:
      offscreenSubtreeWasHidden || safelyDetachRef(deletedFiber, nearestMountedAncestor);
      recursivelyTraverseDeletionEffects(finishedRoot, nearestMountedAncestor, deletedFiber);
      deletedFiber.memoizedState ? deletedFiber.memoizedState.count-- : deletedFiber.stateNode && (finishedRoot = deletedFiber.stateNode, finishedRoot.parentNode.removeChild(finishedRoot));
      break;
    case 27:
      offscreenSubtreeWasHidden || safelyDetachRef(deletedFiber, nearestMountedAncestor);
      var prevHostParent = hostParent, prevHostParentIsContainer = hostParentIsContainer;
      isSingletonScope(deletedFiber.type) && (hostParent = deletedFiber.stateNode, hostParentIsContainer = false);
      recursivelyTraverseDeletionEffects(finishedRoot, nearestMountedAncestor, deletedFiber);
      releaseSingletonInstance(deletedFiber.stateNode);
      hostParent = prevHostParent;
      hostParentIsContainer = prevHostParentIsContainer;
      break;
    case 5:
      offscreenSubtreeWasHidden || safelyDetachRef(deletedFiber, nearestMountedAncestor);
    case 6:
      prevHostParent = hostParent;
      prevHostParentIsContainer = hostParentIsContainer;
      hostParent = null;
      recursivelyTraverseDeletionEffects(finishedRoot, nearestMountedAncestor, deletedFiber);
      hostParent = prevHostParent;
      hostParentIsContainer = prevHostParentIsContainer;
      if (hostParent !== null)
        if (hostParentIsContainer)
          try {
            (hostParent.nodeType === 9 ? hostParent.body : hostParent.nodeName === "HTML" ? hostParent.ownerDocument.body : hostParent).removeChild(deletedFiber.stateNode);
          } catch (error) {
            captureCommitPhaseError(deletedFiber, nearestMountedAncestor, error);
          }
        else
          try {
            hostParent.removeChild(deletedFiber.stateNode);
          } catch (error) {
            captureCommitPhaseError(deletedFiber, nearestMountedAncestor, error);
          }
      break;
    case 18:
      hostParent !== null && (hostParentIsContainer ? (finishedRoot = hostParent, clearHydrationBoundary(finishedRoot.nodeType === 9 ? finishedRoot.body : finishedRoot.nodeName === "HTML" ? finishedRoot.ownerDocument.body : finishedRoot, deletedFiber.stateNode), retryIfBlockedOn(finishedRoot)) : clearHydrationBoundary(hostParent, deletedFiber.stateNode));
      break;
    case 4:
      prevHostParent = hostParent;
      prevHostParentIsContainer = hostParentIsContainer;
      hostParent = deletedFiber.stateNode.containerInfo;
      hostParentIsContainer = true;
      recursivelyTraverseDeletionEffects(finishedRoot, nearestMountedAncestor, deletedFiber);
      hostParent = prevHostParent;
      hostParentIsContainer = prevHostParentIsContainer;
      break;
    case 0:
    case 11:
    case 14:
    case 15:
      commitHookEffectListUnmount(2, deletedFiber, nearestMountedAncestor);
      offscreenSubtreeWasHidden || commitHookLayoutUnmountEffects(deletedFiber, nearestMountedAncestor, 4);
      recursivelyTraverseDeletionEffects(finishedRoot, nearestMountedAncestor, deletedFiber);
      break;
    case 1:
      offscreenSubtreeWasHidden || (safelyDetachRef(deletedFiber, nearestMountedAncestor), prevHostParent = deletedFiber.stateNode, typeof prevHostParent.componentWillUnmount === "function" && safelyCallComponentWillUnmount(deletedFiber, nearestMountedAncestor, prevHostParent));
      recursivelyTraverseDeletionEffects(finishedRoot, nearestMountedAncestor, deletedFiber);
      break;
    case 21:
      recursivelyTraverseDeletionEffects(finishedRoot, nearestMountedAncestor, deletedFiber);
      break;
    case 22:
      offscreenSubtreeWasHidden = (prevHostParent = offscreenSubtreeWasHidden) || deletedFiber.memoizedState !== null;
      recursivelyTraverseDeletionEffects(finishedRoot, nearestMountedAncestor, deletedFiber);
      offscreenSubtreeWasHidden = prevHostParent;
      break;
    default:
      recursivelyTraverseDeletionEffects(finishedRoot, nearestMountedAncestor, deletedFiber);
  }
  (deletedFiber.mode & 2) !== 0 && 0 <= componentEffectStartTime && 0 <= componentEffectEndTime && (componentEffectSpawnedUpdate || 0.05 < componentEffectDuration) && logComponentEffect(deletedFiber, componentEffectStartTime, componentEffectEndTime, componentEffectDuration, componentEffectErrors);
  popComponentEffectStart(prevEffectStart);
  popComponentEffectDuration(prevEffectDuration);
  componentEffectErrors = prevEffectErrors;
  componentEffectSpawnedUpdate = prevEffectDidSpawnUpdate;
}
function commitActivityHydrationCallbacks(finishedRoot, finishedWork) {
  if (finishedWork.memoizedState === null && (finishedRoot = finishedWork.alternate, finishedRoot !== null && (finishedRoot = finishedRoot.memoizedState, finishedRoot !== null))) {
    finishedRoot = finishedRoot.dehydrated;
    try {
      retryIfBlockedOn(finishedRoot);
    } catch (error) {
      captureCommitPhaseError(finishedWork, finishedWork.return, error);
    }
  }
}
function commitSuspenseHydrationCallbacks(finishedRoot, finishedWork) {
  if (finishedWork.memoizedState === null && (finishedRoot = finishedWork.alternate, finishedRoot !== null && (finishedRoot = finishedRoot.memoizedState, finishedRoot !== null && (finishedRoot = finishedRoot.dehydrated, finishedRoot !== null))))
    try {
      retryIfBlockedOn(finishedRoot);
    } catch (error) {
      captureCommitPhaseError(finishedWork, finishedWork.return, error);
    }
}
function getRetryCache(finishedWork) {
  switch (finishedWork.tag) {
    case 31:
    case 13:
    case 19:
      var retryCache = finishedWork.stateNode;
      retryCache === null && (retryCache = finishedWork.stateNode = new PossiblyWeakSet);
      return retryCache;
    case 22:
      return finishedWork = finishedWork.stateNode, retryCache = finishedWork._retryCache, retryCache === null && (retryCache = finishedWork._retryCache = new PossiblyWeakSet), retryCache;
    default:
      throw Error(formatProdErrorMessage(435, finishedWork.tag));
  }
}
function attachSuspenseRetryListeners(finishedWork, wakeables) {
  var retryCache = getRetryCache(finishedWork);
  wakeables.forEach(function(wakeable) {
    if (!retryCache.has(wakeable)) {
      retryCache.add(wakeable);
      if (isDevToolsPresent)
        if (inProgressLanes !== null && inProgressRoot !== null)
          restorePendingUpdaters(inProgressRoot, inProgressLanes);
        else
          throw Error(formatProdErrorMessage(413));
      var retry2 = resolveRetryWakeable.bind(null, finishedWork, wakeable);
      wakeable.then(retry2, retry2);
    }
  });
}
function recursivelyTraverseMutationEffects(root$jscomp$0, parentFiber) {
  var deletions = parentFiber.deletions;
  if (deletions !== null)
    for (var i = 0;i < deletions.length; i++) {
      var childToDelete = deletions[i], root2 = root$jscomp$0, returnFiber = parentFiber, prevEffectStart = pushComponentEffectStart(), parent = returnFiber;
      a:
        for (;parent !== null; ) {
          switch (parent.tag) {
            case 27:
              if (isSingletonScope(parent.type)) {
                hostParent = parent.stateNode;
                hostParentIsContainer = false;
                break a;
              }
              break;
            case 5:
              hostParent = parent.stateNode;
              hostParentIsContainer = false;
              break a;
            case 3:
            case 4:
              hostParent = parent.stateNode.containerInfo;
              hostParentIsContainer = true;
              break a;
          }
          parent = parent.return;
        }
      if (hostParent === null)
        throw Error(formatProdErrorMessage(160));
      commitDeletionEffectsOnFiber(root2, returnFiber, childToDelete);
      hostParent = null;
      hostParentIsContainer = false;
      (childToDelete.mode & 2) !== 0 && 0 <= componentEffectStartTime && 0 <= componentEffectEndTime && 0.05 < componentEffectEndTime - componentEffectStartTime && logComponentTrigger(childToDelete, componentEffectStartTime, componentEffectEndTime, "Unmount");
      popComponentEffectStart(prevEffectStart);
      root2 = childToDelete.alternate;
      root2 !== null && (root2.return = null);
      childToDelete.return = null;
    }
  if (parentFiber.subtreeFlags & 13886)
    for (parentFiber = parentFiber.child;parentFiber !== null; )
      commitMutationEffectsOnFiber(parentFiber, root$jscomp$0), parentFiber = parentFiber.sibling;
}
function commitMutationEffectsOnFiber(finishedWork, root2) {
  var prevEffectStart = pushComponentEffectStart(), prevEffectDuration = pushComponentEffectDuration(), prevEffectErrors = pushComponentEffectErrors(), prevEffectDidSpawnUpdate = pushComponentEffectDidSpawnUpdate(), current = finishedWork.alternate, flags = finishedWork.flags;
  switch (finishedWork.tag) {
    case 0:
    case 11:
    case 14:
    case 15:
      recursivelyTraverseMutationEffects(root2, finishedWork);
      commitReconciliationEffects(finishedWork);
      flags & 4 && (commitHookEffectListUnmount(3, finishedWork, finishedWork.return), commitHookEffectListMount(3, finishedWork), commitHookLayoutUnmountEffects(finishedWork, finishedWork.return, 5));
      break;
    case 1:
      recursivelyTraverseMutationEffects(root2, finishedWork);
      commitReconciliationEffects(finishedWork);
      flags & 512 && (offscreenSubtreeWasHidden || current === null || safelyDetachRef(current, current.return));
      if (flags & 64 && offscreenSubtreeIsHidden && (flags = finishedWork.updateQueue, flags !== null && (current = flags.callbacks, current !== null))) {
        var existingHiddenCallbacks = flags.shared.hiddenCallbacks;
        flags.shared.hiddenCallbacks = existingHiddenCallbacks === null ? current : existingHiddenCallbacks.concat(current);
      }
      break;
    case 26:
      existingHiddenCallbacks = currentHoistableRoot;
      recursivelyTraverseMutationEffects(root2, finishedWork);
      commitReconciliationEffects(finishedWork);
      flags & 512 && (offscreenSubtreeWasHidden || current === null || safelyDetachRef(current, current.return));
      if (flags & 4) {
        var currentResource = current !== null ? current.memoizedState : null;
        flags = finishedWork.memoizedState;
        if (current === null)
          if (flags === null)
            if (finishedWork.stateNode === null) {
              a: {
                flags = finishedWork.type;
                current = finishedWork.memoizedProps;
                existingHiddenCallbacks = existingHiddenCallbacks.ownerDocument || existingHiddenCallbacks;
                b:
                  switch (flags) {
                    case "title":
                      currentResource = existingHiddenCallbacks.getElementsByTagName("title")[0];
                      if (!currentResource || currentResource[internalHoistableMarker] || currentResource[internalInstanceKey] || currentResource.namespaceURI === "http://www.w3.org/2000/svg" || currentResource.hasAttribute("itemprop"))
                        currentResource = existingHiddenCallbacks.createElement(flags), existingHiddenCallbacks.head.insertBefore(currentResource, existingHiddenCallbacks.querySelector("head > title"));
                      setInitialProperties(currentResource, flags, current);
                      currentResource[internalInstanceKey] = finishedWork;
                      markNodeAsHoistable(currentResource);
                      flags = currentResource;
                      break a;
                    case "link":
                      var maybeNodes = getHydratableHoistableCache("link", "href", existingHiddenCallbacks).get(flags + (current.href || ""));
                      if (maybeNodes) {
                        for (var i = 0;i < maybeNodes.length; i++)
                          if (currentResource = maybeNodes[i], currentResource.getAttribute("href") === (current.href == null || current.href === "" ? null : current.href) && currentResource.getAttribute("rel") === (current.rel == null ? null : current.rel) && currentResource.getAttribute("title") === (current.title == null ? null : current.title) && currentResource.getAttribute("crossorigin") === (current.crossOrigin == null ? null : current.crossOrigin)) {
                            maybeNodes.splice(i, 1);
                            break b;
                          }
                      }
                      currentResource = existingHiddenCallbacks.createElement(flags);
                      setInitialProperties(currentResource, flags, current);
                      existingHiddenCallbacks.head.appendChild(currentResource);
                      break;
                    case "meta":
                      if (maybeNodes = getHydratableHoistableCache("meta", "content", existingHiddenCallbacks).get(flags + (current.content || ""))) {
                        for (i = 0;i < maybeNodes.length; i++)
                          if (currentResource = maybeNodes[i], currentResource.getAttribute("content") === (current.content == null ? null : "" + current.content) && currentResource.getAttribute("name") === (current.name == null ? null : current.name) && currentResource.getAttribute("property") === (current.property == null ? null : current.property) && currentResource.getAttribute("http-equiv") === (current.httpEquiv == null ? null : current.httpEquiv) && currentResource.getAttribute("charset") === (current.charSet == null ? null : current.charSet)) {
                            maybeNodes.splice(i, 1);
                            break b;
                          }
                      }
                      currentResource = existingHiddenCallbacks.createElement(flags);
                      setInitialProperties(currentResource, flags, current);
                      existingHiddenCallbacks.head.appendChild(currentResource);
                      break;
                    default:
                      throw Error(formatProdErrorMessage(468, flags));
                  }
                currentResource[internalInstanceKey] = finishedWork;
                markNodeAsHoistable(currentResource);
                flags = currentResource;
              }
              finishedWork.stateNode = flags;
            } else
              mountHoistable(existingHiddenCallbacks, finishedWork.type, finishedWork.stateNode);
          else
            finishedWork.stateNode = acquireResource(existingHiddenCallbacks, flags, finishedWork.memoizedProps);
        else
          currentResource !== flags ? (currentResource === null ? current.stateNode !== null && (current = current.stateNode, current.parentNode.removeChild(current)) : currentResource.count--, flags === null ? mountHoistable(existingHiddenCallbacks, finishedWork.type, finishedWork.stateNode) : acquireResource(existingHiddenCallbacks, flags, finishedWork.memoizedProps)) : flags === null && finishedWork.stateNode !== null && commitHostUpdate(finishedWork, finishedWork.memoizedProps, current.memoizedProps);
      }
      break;
    case 27:
      recursivelyTraverseMutationEffects(root2, finishedWork);
      commitReconciliationEffects(finishedWork);
      flags & 512 && (offscreenSubtreeWasHidden || current === null || safelyDetachRef(current, current.return));
      current !== null && flags & 4 && commitHostUpdate(finishedWork, finishedWork.memoizedProps, current.memoizedProps);
      break;
    case 5:
      recursivelyTraverseMutationEffects(root2, finishedWork);
      commitReconciliationEffects(finishedWork);
      flags & 512 && (offscreenSubtreeWasHidden || current === null || safelyDetachRef(current, current.return));
      if (finishedWork.flags & 32) {
        existingHiddenCallbacks = finishedWork.stateNode;
        try {
          setTextContent(existingHiddenCallbacks, "");
        } catch (error) {
          captureCommitPhaseError(finishedWork, finishedWork.return, error);
        }
      }
      flags & 4 && finishedWork.stateNode != null && (existingHiddenCallbacks = finishedWork.memoizedProps, commitHostUpdate(finishedWork, existingHiddenCallbacks, current !== null ? current.memoizedProps : existingHiddenCallbacks));
      flags & 1024 && (needsFormReset = true);
      break;
    case 6:
      recursivelyTraverseMutationEffects(root2, finishedWork);
      commitReconciliationEffects(finishedWork);
      if (flags & 4) {
        if (finishedWork.stateNode === null)
          throw Error(formatProdErrorMessage(162));
        flags = finishedWork.memoizedProps;
        current = finishedWork.stateNode;
        try {
          current.nodeValue = flags;
        } catch (error) {
          captureCommitPhaseError(finishedWork, finishedWork.return, error);
        }
      }
      break;
    case 3:
      existingHiddenCallbacks = pushNestedEffectDurations();
      tagCaches = null;
      currentResource = currentHoistableRoot;
      currentHoistableRoot = getHoistableRoot(root2.containerInfo);
      recursivelyTraverseMutationEffects(root2, finishedWork);
      currentHoistableRoot = currentResource;
      commitReconciliationEffects(finishedWork);
      if (flags & 4 && current !== null && current.memoizedState.isDehydrated)
        try {
          retryIfBlockedOn(root2.containerInfo);
        } catch (error) {
          captureCommitPhaseError(finishedWork, finishedWork.return, error);
        }
      needsFormReset && (needsFormReset = false, recursivelyResetForms(finishedWork));
      root2.effectDuration += popNestedEffectDurations(existingHiddenCallbacks);
      break;
    case 4:
      flags = currentHoistableRoot;
      currentHoistableRoot = getHoistableRoot(finishedWork.stateNode.containerInfo);
      recursivelyTraverseMutationEffects(root2, finishedWork);
      commitReconciliationEffects(finishedWork);
      currentHoistableRoot = flags;
      break;
    case 12:
      flags = pushNestedEffectDurations();
      recursivelyTraverseMutationEffects(root2, finishedWork);
      commitReconciliationEffects(finishedWork);
      finishedWork.stateNode.effectDuration += bubbleNestedEffectDurations(flags);
      break;
    case 31:
      recursivelyTraverseMutationEffects(root2, finishedWork);
      commitReconciliationEffects(finishedWork);
      flags & 4 && (flags = finishedWork.updateQueue, flags !== null && (finishedWork.updateQueue = null, attachSuspenseRetryListeners(finishedWork, flags)));
      break;
    case 13:
      recursivelyTraverseMutationEffects(root2, finishedWork);
      commitReconciliationEffects(finishedWork);
      finishedWork.child.flags & 8192 && finishedWork.memoizedState !== null !== (current !== null && current.memoizedState !== null) && (globalMostRecentFallbackTime = now$1());
      flags & 4 && (flags = finishedWork.updateQueue, flags !== null && (finishedWork.updateQueue = null, attachSuspenseRetryListeners(finishedWork, flags)));
      break;
    case 22:
      existingHiddenCallbacks = finishedWork.memoizedState !== null;
      var wasHidden = current !== null && current.memoizedState !== null, prevOffscreenSubtreeIsHidden = offscreenSubtreeIsHidden, prevOffscreenSubtreeWasHidden = offscreenSubtreeWasHidden;
      offscreenSubtreeIsHidden = prevOffscreenSubtreeIsHidden || existingHiddenCallbacks;
      offscreenSubtreeWasHidden = prevOffscreenSubtreeWasHidden || wasHidden;
      recursivelyTraverseMutationEffects(root2, finishedWork);
      offscreenSubtreeWasHidden = prevOffscreenSubtreeWasHidden;
      offscreenSubtreeIsHidden = prevOffscreenSubtreeIsHidden;
      wasHidden && !existingHiddenCallbacks && !prevOffscreenSubtreeIsHidden && !prevOffscreenSubtreeWasHidden && (finishedWork.mode & 2) !== 0 && 0 <= componentEffectStartTime && 0 <= componentEffectEndTime && 0.05 < componentEffectEndTime - componentEffectStartTime && logComponentReappeared(finishedWork, componentEffectStartTime, componentEffectEndTime);
      commitReconciliationEffects(finishedWork);
      if (flags & 8192)
        a:
          for (root2 = finishedWork.stateNode, root2._visibility = existingHiddenCallbacks ? root2._visibility & -2 : root2._visibility | 1, !existingHiddenCallbacks || current === null || wasHidden || offscreenSubtreeIsHidden || offscreenSubtreeWasHidden || (recursivelyTraverseDisappearLayoutEffects(finishedWork), (finishedWork.mode & 2) !== 0 && 0 <= componentEffectStartTime && 0 <= componentEffectEndTime && 0.05 < componentEffectEndTime - componentEffectStartTime && logComponentTrigger(finishedWork, componentEffectStartTime, componentEffectEndTime, "Disconnect")), current = null, root2 = finishedWork;; ) {
            if (root2.tag === 5 || root2.tag === 26) {
              if (current === null) {
                wasHidden = current = root2;
                try {
                  if (currentResource = wasHidden.stateNode, existingHiddenCallbacks)
                    maybeNodes = currentResource.style, typeof maybeNodes.setProperty === "function" ? maybeNodes.setProperty("display", "none", "important") : maybeNodes.display = "none";
                  else {
                    i = wasHidden.stateNode;
                    var styleProp = wasHidden.memoizedProps.style, display = styleProp !== undefined && styleProp !== null && styleProp.hasOwnProperty("display") ? styleProp.display : null;
                    i.style.display = display == null || typeof display === "boolean" ? "" : ("" + display).trim();
                  }
                } catch (error) {
                  captureCommitPhaseError(wasHidden, wasHidden.return, error);
                }
              }
            } else if (root2.tag === 6) {
              if (current === null) {
                wasHidden = root2;
                try {
                  wasHidden.stateNode.nodeValue = existingHiddenCallbacks ? "" : wasHidden.memoizedProps;
                } catch (error) {
                  captureCommitPhaseError(wasHidden, wasHidden.return, error);
                }
              }
            } else if (root2.tag === 18) {
              if (current === null) {
                wasHidden = root2;
                try {
                  var instance = wasHidden.stateNode;
                  existingHiddenCallbacks ? hideOrUnhideDehydratedBoundary(instance, true) : hideOrUnhideDehydratedBoundary(wasHidden.stateNode, false);
                } catch (error) {
                  captureCommitPhaseError(wasHidden, wasHidden.return, error);
                }
              }
            } else if ((root2.tag !== 22 && root2.tag !== 23 || root2.memoizedState === null || root2 === finishedWork) && root2.child !== null) {
              root2.child.return = root2;
              root2 = root2.child;
              continue;
            }
            if (root2 === finishedWork)
              break a;
            for (;root2.sibling === null; ) {
              if (root2.return === null || root2.return === finishedWork)
                break a;
              current === root2 && (current = null);
              root2 = root2.return;
            }
            current === root2 && (current = null);
            root2.sibling.return = root2.return;
            root2 = root2.sibling;
          }
      flags & 4 && (flags = finishedWork.updateQueue, flags !== null && (current = flags.retryQueue, current !== null && (flags.retryQueue = null, attachSuspenseRetryListeners(finishedWork, current))));
      break;
    case 19:
      recursivelyTraverseMutationEffects(root2, finishedWork);
      commitReconciliationEffects(finishedWork);
      flags & 4 && (flags = finishedWork.updateQueue, flags !== null && (finishedWork.updateQueue = null, attachSuspenseRetryListeners(finishedWork, flags)));
      break;
    case 30:
      break;
    case 21:
      break;
    default:
      recursivelyTraverseMutationEffects(root2, finishedWork), commitReconciliationEffects(finishedWork);
  }
  (finishedWork.mode & 2) !== 0 && 0 <= componentEffectStartTime && 0 <= componentEffectEndTime && ((componentEffectSpawnedUpdate || 0.05 < componentEffectDuration) && logComponentEffect(finishedWork, componentEffectStartTime, componentEffectEndTime, componentEffectDuration, componentEffectErrors), finishedWork.alternate === null && finishedWork.return !== null && finishedWork.return.alternate !== null && 0.05 < componentEffectEndTime - componentEffectStartTime && (isHydratingParent(finishedWork.return.alternate, finishedWork.return) || logComponentTrigger(finishedWork, componentEffectStartTime, componentEffectEndTime, "Mount")));
  popComponentEffectStart(prevEffectStart);
  popComponentEffectDuration(prevEffectDuration);
  componentEffectErrors = prevEffectErrors;
  componentEffectSpawnedUpdate = prevEffectDidSpawnUpdate;
}
function commitReconciliationEffects(finishedWork) {
  var flags = finishedWork.flags;
  if (flags & 2) {
    try {
      for (var hostParentFiber, parentFiber = finishedWork.return;parentFiber !== null; ) {
        if (isHostParent(parentFiber)) {
          hostParentFiber = parentFiber;
          break;
        }
        parentFiber = parentFiber.return;
      }
      if (hostParentFiber == null)
        throw Error(formatProdErrorMessage(160));
      switch (hostParentFiber.tag) {
        case 27:
          var parent = hostParentFiber.stateNode, before = getHostSibling(finishedWork);
          insertOrAppendPlacementNode(finishedWork, before, parent);
          break;
        case 5:
          var parent$161 = hostParentFiber.stateNode;
          hostParentFiber.flags & 32 && (setTextContent(parent$161, ""), hostParentFiber.flags &= -33);
          var before$162 = getHostSibling(finishedWork);
          insertOrAppendPlacementNode(finishedWork, before$162, parent$161);
          break;
        case 3:
        case 4:
          var parent$163 = hostParentFiber.stateNode.containerInfo, before$164 = getHostSibling(finishedWork);
          insertOrAppendPlacementNodeIntoContainer(finishedWork, before$164, parent$163);
          break;
        default:
          throw Error(formatProdErrorMessage(161));
      }
    } catch (error) {
      captureCommitPhaseError(finishedWork, finishedWork.return, error);
    }
    finishedWork.flags &= -3;
  }
  flags & 4096 && (finishedWork.flags &= -4097);
}
function recursivelyResetForms(parentFiber) {
  if (parentFiber.subtreeFlags & 1024)
    for (parentFiber = parentFiber.child;parentFiber !== null; ) {
      var fiber = parentFiber;
      recursivelyResetForms(fiber);
      fiber.tag === 5 && fiber.flags & 1024 && fiber.stateNode.reset();
      parentFiber = parentFiber.sibling;
    }
}
function recursivelyTraverseLayoutEffects(root2, parentFiber) {
  if (parentFiber.subtreeFlags & 8772)
    for (parentFiber = parentFiber.child;parentFiber !== null; )
      commitLayoutEffectOnFiber(root2, parentFiber.alternate, parentFiber), parentFiber = parentFiber.sibling;
}
function recursivelyTraverseDisappearLayoutEffects(parentFiber) {
  for (parentFiber = parentFiber.child;parentFiber !== null; ) {
    var finishedWork = parentFiber, prevEffectStart = pushComponentEffectStart(), prevEffectDuration = pushComponentEffectDuration(), prevEffectErrors = pushComponentEffectErrors(), prevEffectDidSpawnUpdate = pushComponentEffectDidSpawnUpdate();
    switch (finishedWork.tag) {
      case 0:
      case 11:
      case 14:
      case 15:
        commitHookLayoutUnmountEffects(finishedWork, finishedWork.return, 4);
        recursivelyTraverseDisappearLayoutEffects(finishedWork);
        break;
      case 1:
        safelyDetachRef(finishedWork, finishedWork.return);
        var instance = finishedWork.stateNode;
        typeof instance.componentWillUnmount === "function" && safelyCallComponentWillUnmount(finishedWork, finishedWork.return, instance);
        recursivelyTraverseDisappearLayoutEffects(finishedWork);
        break;
      case 27:
        releaseSingletonInstance(finishedWork.stateNode);
      case 26:
      case 5:
        safelyDetachRef(finishedWork, finishedWork.return);
        recursivelyTraverseDisappearLayoutEffects(finishedWork);
        break;
      case 22:
        finishedWork.memoizedState === null && recursivelyTraverseDisappearLayoutEffects(finishedWork);
        break;
      case 30:
        recursivelyTraverseDisappearLayoutEffects(finishedWork);
        break;
      default:
        recursivelyTraverseDisappearLayoutEffects(finishedWork);
    }
    (finishedWork.mode & 2) !== 0 && 0 <= componentEffectStartTime && 0 <= componentEffectEndTime && (componentEffectSpawnedUpdate || 0.05 < componentEffectDuration) && logComponentEffect(finishedWork, componentEffectStartTime, componentEffectEndTime, componentEffectDuration, componentEffectErrors);
    popComponentEffectStart(prevEffectStart);
    popComponentEffectDuration(prevEffectDuration);
    componentEffectErrors = prevEffectErrors;
    componentEffectSpawnedUpdate = prevEffectDidSpawnUpdate;
    parentFiber = parentFiber.sibling;
  }
}
function recursivelyTraverseReappearLayoutEffects(finishedRoot$jscomp$0, parentFiber, includeWorkInProgressEffects) {
  includeWorkInProgressEffects = includeWorkInProgressEffects && (parentFiber.subtreeFlags & 8772) !== 0;
  for (parentFiber = parentFiber.child;parentFiber !== null; ) {
    var current = parentFiber.alternate, finishedRoot = finishedRoot$jscomp$0, finishedWork = parentFiber, prevEffectStart = pushComponentEffectStart(), prevEffectDuration = pushComponentEffectDuration(), prevEffectErrors = pushComponentEffectErrors(), prevEffectDidSpawnUpdate = pushComponentEffectDidSpawnUpdate(), flags = finishedWork.flags;
    switch (finishedWork.tag) {
      case 0:
      case 11:
      case 15:
        recursivelyTraverseReappearLayoutEffects(finishedRoot, finishedWork, includeWorkInProgressEffects);
        commitHookLayoutEffects(finishedWork, 4);
        break;
      case 1:
        recursivelyTraverseReappearLayoutEffects(finishedRoot, finishedWork, includeWorkInProgressEffects);
        current = finishedWork;
        finishedRoot = current.stateNode;
        if (typeof finishedRoot.componentDidMount === "function")
          try {
            finishedRoot.componentDidMount();
          } catch (error) {
            captureCommitPhaseError(current, current.return, error);
          }
        current = finishedWork;
        finishedRoot = current.updateQueue;
        if (finishedRoot !== null) {
          var instance = current.stateNode;
          try {
            var hiddenCallbacks = finishedRoot.shared.hiddenCallbacks;
            if (hiddenCallbacks !== null)
              for (finishedRoot.shared.hiddenCallbacks = null, finishedRoot = 0;finishedRoot < hiddenCallbacks.length; finishedRoot++)
                callCallback(hiddenCallbacks[finishedRoot], instance);
          } catch (error) {
            captureCommitPhaseError(current, current.return, error);
          }
        }
        includeWorkInProgressEffects && flags & 64 && commitClassCallbacks(finishedWork);
        safelyAttachRef(finishedWork, finishedWork.return);
        break;
      case 27:
        commitHostSingletonAcquisition(finishedWork);
      case 26:
      case 5:
        recursivelyTraverseReappearLayoutEffects(finishedRoot, finishedWork, includeWorkInProgressEffects);
        includeWorkInProgressEffects && current === null && flags & 4 && commitHostMount(finishedWork);
        safelyAttachRef(finishedWork, finishedWork.return);
        break;
      case 12:
        includeWorkInProgressEffects && flags & 4 ? (flags = pushNestedEffectDurations(), recursivelyTraverseReappearLayoutEffects(finishedRoot, finishedWork, includeWorkInProgressEffects), finishedRoot = finishedWork.stateNode, finishedRoot.effectDuration += bubbleNestedEffectDurations(flags), commitProfilerUpdate(finishedWork, current, commitStartTime, finishedRoot.effectDuration)) : recursivelyTraverseReappearLayoutEffects(finishedRoot, finishedWork, includeWorkInProgressEffects);
        break;
      case 31:
        recursivelyTraverseReappearLayoutEffects(finishedRoot, finishedWork, includeWorkInProgressEffects);
        includeWorkInProgressEffects && flags & 4 && commitActivityHydrationCallbacks(finishedRoot, finishedWork);
        break;
      case 13:
        recursivelyTraverseReappearLayoutEffects(finishedRoot, finishedWork, includeWorkInProgressEffects);
        includeWorkInProgressEffects && flags & 4 && commitSuspenseHydrationCallbacks(finishedRoot, finishedWork);
        break;
      case 22:
        finishedWork.memoizedState === null && recursivelyTraverseReappearLayoutEffects(finishedRoot, finishedWork, includeWorkInProgressEffects);
        safelyAttachRef(finishedWork, finishedWork.return);
        break;
      case 30:
        break;
      default:
        recursivelyTraverseReappearLayoutEffects(finishedRoot, finishedWork, includeWorkInProgressEffects);
    }
    (finishedWork.mode & 2) !== 0 && 0 <= componentEffectStartTime && 0 <= componentEffectEndTime && (componentEffectSpawnedUpdate || 0.05 < componentEffectDuration) && logComponentEffect(finishedWork, componentEffectStartTime, componentEffectEndTime, componentEffectDuration, componentEffectErrors);
    popComponentEffectStart(prevEffectStart);
    popComponentEffectDuration(prevEffectDuration);
    componentEffectErrors = prevEffectErrors;
    componentEffectSpawnedUpdate = prevEffectDidSpawnUpdate;
    parentFiber = parentFiber.sibling;
  }
}
function commitOffscreenPassiveMountEffects(current, finishedWork) {
  var previousCache = null;
  current !== null && current.memoizedState !== null && current.memoizedState.cachePool !== null && (previousCache = current.memoizedState.cachePool.pool);
  current = null;
  finishedWork.memoizedState !== null && finishedWork.memoizedState.cachePool !== null && (current = finishedWork.memoizedState.cachePool.pool);
  current !== previousCache && (current != null && current.refCount++, previousCache != null && releaseCache(previousCache));
}
function commitCachePassiveMountEffect(current, finishedWork) {
  current = null;
  finishedWork.alternate !== null && (current = finishedWork.alternate.memoizedState.cache);
  finishedWork = finishedWork.memoizedState.cache;
  finishedWork !== current && (finishedWork.refCount++, current != null && releaseCache(current));
}
function recursivelyTraversePassiveMountEffects(root2, parentFiber, committedLanes, committedTransitions, endTime) {
  if (parentFiber.subtreeFlags & 10256 || parentFiber.actualDuration !== 0 && (parentFiber.alternate === null || parentFiber.alternate.child !== parentFiber.child))
    for (parentFiber = parentFiber.child;parentFiber !== null; ) {
      var nextSibling = parentFiber.sibling;
      commitPassiveMountOnFiber(root2, parentFiber, committedLanes, committedTransitions, nextSibling !== null ? nextSibling.actualStartTime : endTime);
      parentFiber = nextSibling;
    }
}
function commitPassiveMountOnFiber(finishedRoot, finishedWork, committedLanes, committedTransitions, endTime) {
  var prevEffectStart = pushComponentEffectStart(), prevEffectDuration = pushComponentEffectDuration(), prevEffectErrors = pushComponentEffectErrors(), prevEffectDidSpawnUpdate = pushComponentEffectDidSpawnUpdate(), flags = finishedWork.flags;
  switch (finishedWork.tag) {
    case 0:
    case 11:
    case 15:
      (finishedWork.mode & 2) !== 0 && 0 < finishedWork.actualStartTime && (finishedWork.flags & 1) !== 0 && logComponentRender(finishedWork, finishedWork.actualStartTime, endTime, inHydratedSubtree);
      recursivelyTraversePassiveMountEffects(finishedRoot, finishedWork, committedLanes, committedTransitions, endTime);
      flags & 2048 && commitHookPassiveMountEffects(finishedWork, 9);
      break;
    case 1:
      (finishedWork.mode & 2) !== 0 && 0 < finishedWork.actualStartTime && ((finishedWork.flags & 128) !== 0 ? logComponentErrored(finishedWork, finishedWork.actualStartTime, endTime) : (finishedWork.flags & 1) !== 0 && logComponentRender(finishedWork, finishedWork.actualStartTime, endTime, inHydratedSubtree));
      recursivelyTraversePassiveMountEffects(finishedRoot, finishedWork, committedLanes, committedTransitions, endTime);
      break;
    case 3:
      var prevProfilerEffectDuration = pushNestedEffectDurations(), wasInHydratedSubtree = inHydratedSubtree;
      inHydratedSubtree = finishedWork.alternate !== null && finishedWork.alternate.memoizedState.isDehydrated && (finishedWork.flags & 256) === 0;
      recursivelyTraversePassiveMountEffects(finishedRoot, finishedWork, committedLanes, committedTransitions, endTime);
      inHydratedSubtree = wasInHydratedSubtree;
      flags & 2048 && (committedLanes = null, finishedWork.alternate !== null && (committedLanes = finishedWork.alternate.memoizedState.cache), committedTransitions = finishedWork.memoizedState.cache, committedTransitions !== committedLanes && (committedTransitions.refCount++, committedLanes != null && releaseCache(committedLanes)));
      finishedRoot.passiveEffectDuration += popNestedEffectDurations(prevProfilerEffectDuration);
      break;
    case 12:
      if (flags & 2048) {
        flags = pushNestedEffectDurations();
        recursivelyTraversePassiveMountEffects(finishedRoot, finishedWork, committedLanes, committedTransitions, endTime);
        finishedRoot = finishedWork.stateNode;
        finishedRoot.passiveEffectDuration += bubbleNestedEffectDurations(flags);
        try {
          prevProfilerEffectDuration = finishedWork.memoizedProps;
          wasInHydratedSubtree = prevProfilerEffectDuration.id;
          var onPostCommit = prevProfilerEffectDuration.onPostCommit, phase = finishedWork.alternate === null ? "mount" : "update";
          currentUpdateIsNested && (phase = "nested-update");
          typeof onPostCommit === "function" && onPostCommit(wasInHydratedSubtree, phase, finishedRoot.passiveEffectDuration, commitStartTime);
        } catch (error) {
          captureCommitPhaseError(finishedWork, finishedWork.return, error);
        }
      } else
        recursivelyTraversePassiveMountEffects(finishedRoot, finishedWork, committedLanes, committedTransitions, endTime);
      break;
    case 31:
      flags = inHydratedSubtree;
      prevProfilerEffectDuration = finishedWork.alternate !== null ? finishedWork.alternate.memoizedState : null;
      wasInHydratedSubtree = finishedWork.memoizedState;
      prevProfilerEffectDuration !== null && wasInHydratedSubtree === null ? (wasInHydratedSubtree = finishedWork.deletions, wasInHydratedSubtree !== null && 0 < wasInHydratedSubtree.length && wasInHydratedSubtree[0].tag === 18 ? (inHydratedSubtree = false, prevProfilerEffectDuration.hydrationErrors !== null && logComponentErrored(finishedWork, finishedWork.actualStartTime, endTime)) : inHydratedSubtree = true) : inHydratedSubtree = false;
      recursivelyTraversePassiveMountEffects(finishedRoot, finishedWork, committedLanes, committedTransitions, endTime);
      inHydratedSubtree = flags;
      break;
    case 13:
      flags = inHydratedSubtree;
      prevProfilerEffectDuration = finishedWork.alternate !== null ? finishedWork.alternate.memoizedState : null;
      wasInHydratedSubtree = finishedWork.memoizedState;
      prevProfilerEffectDuration === null || prevProfilerEffectDuration.dehydrated === null || wasInHydratedSubtree !== null && wasInHydratedSubtree.dehydrated !== null ? inHydratedSubtree = false : (wasInHydratedSubtree = finishedWork.deletions, wasInHydratedSubtree !== null && 0 < wasInHydratedSubtree.length && wasInHydratedSubtree[0].tag === 18 ? (inHydratedSubtree = false, prevProfilerEffectDuration.hydrationErrors !== null && logComponentErrored(finishedWork, finishedWork.actualStartTime, endTime)) : inHydratedSubtree = true);
      recursivelyTraversePassiveMountEffects(finishedRoot, finishedWork, committedLanes, committedTransitions, endTime);
      inHydratedSubtree = flags;
      break;
    case 23:
      break;
    case 22:
      wasInHydratedSubtree = finishedWork.stateNode;
      prevProfilerEffectDuration = finishedWork.alternate;
      finishedWork.memoizedState !== null ? wasInHydratedSubtree._visibility & 2 ? recursivelyTraversePassiveMountEffects(finishedRoot, finishedWork, committedLanes, committedTransitions, endTime) : recursivelyTraverseAtomicPassiveEffects(finishedRoot, finishedWork, committedLanes, committedTransitions, endTime) : wasInHydratedSubtree._visibility & 2 ? recursivelyTraversePassiveMountEffects(finishedRoot, finishedWork, committedLanes, committedTransitions, endTime) : (wasInHydratedSubtree._visibility |= 2, recursivelyTraverseReconnectPassiveEffects(finishedRoot, finishedWork, committedLanes, committedTransitions, (finishedWork.subtreeFlags & 10256) !== 0 || finishedWork.actualDuration !== 0 && (finishedWork.alternate === null || finishedWork.alternate.child !== finishedWork.child), endTime), (finishedWork.mode & 2) === 0 || inHydratedSubtree || (finishedRoot = finishedWork.actualStartTime, 0 <= finishedRoot && 0.05 < endTime - finishedRoot && logComponentReappeared(finishedWork, finishedRoot, endTime), 0 <= componentEffectStartTime && 0 <= componentEffectEndTime && 0.05 < componentEffectEndTime - componentEffectStartTime && logComponentReappeared(finishedWork, componentEffectStartTime, componentEffectEndTime)));
      flags & 2048 && commitOffscreenPassiveMountEffects(prevProfilerEffectDuration, finishedWork);
      break;
    case 24:
      recursivelyTraversePassiveMountEffects(finishedRoot, finishedWork, committedLanes, committedTransitions, endTime);
      flags & 2048 && commitCachePassiveMountEffect(finishedWork.alternate, finishedWork);
      break;
    default:
      recursivelyTraversePassiveMountEffects(finishedRoot, finishedWork, committedLanes, committedTransitions, endTime);
  }
  if ((finishedWork.mode & 2) !== 0) {
    if (finishedRoot = !inHydratedSubtree && finishedWork.alternate === null && finishedWork.return !== null && finishedWork.return.alternate !== null)
      committedLanes = finishedWork.actualStartTime, 0 <= committedLanes && 0.05 < endTime - committedLanes && logComponentTrigger(finishedWork, committedLanes, endTime, "Mount");
    0 <= componentEffectStartTime && 0 <= componentEffectEndTime && ((componentEffectSpawnedUpdate || 0.05 < componentEffectDuration) && logComponentEffect(finishedWork, componentEffectStartTime, componentEffectEndTime, componentEffectDuration, componentEffectErrors), finishedRoot && 0.05 < componentEffectEndTime - componentEffectStartTime && logComponentTrigger(finishedWork, componentEffectStartTime, componentEffectEndTime, "Mount"));
  }
  popComponentEffectStart(prevEffectStart);
  popComponentEffectDuration(prevEffectDuration);
  componentEffectErrors = prevEffectErrors;
  componentEffectSpawnedUpdate = prevEffectDidSpawnUpdate;
}
function recursivelyTraverseReconnectPassiveEffects(finishedRoot$jscomp$0, parentFiber, committedLanes$jscomp$0, committedTransitions$jscomp$0, includeWorkInProgressEffects, endTime$jscomp$0) {
  includeWorkInProgressEffects = includeWorkInProgressEffects && ((parentFiber.subtreeFlags & 10256) !== 0 || parentFiber.actualDuration !== 0 && (parentFiber.alternate === null || parentFiber.alternate.child !== parentFiber.child));
  for (var child = parentFiber.child;child !== null; ) {
    parentFiber = child.sibling;
    var finishedRoot = finishedRoot$jscomp$0, committedLanes = committedLanes$jscomp$0, committedTransitions = committedTransitions$jscomp$0, endTime = parentFiber !== null ? parentFiber.actualStartTime : endTime$jscomp$0, prevEffectStart = pushComponentEffectStart(), prevEffectDuration = pushComponentEffectDuration(), prevEffectErrors = pushComponentEffectErrors(), prevEffectDidSpawnUpdate = pushComponentEffectDidSpawnUpdate();
    includeWorkInProgressEffects && (child.mode & 2) !== 0 && 0 < child.actualStartTime && (child.flags & 1) !== 0 && logComponentRender(child, child.actualStartTime, endTime, inHydratedSubtree);
    var flags = child.flags;
    switch (child.tag) {
      case 0:
      case 11:
      case 15:
        recursivelyTraverseReconnectPassiveEffects(finishedRoot, child, committedLanes, committedTransitions, includeWorkInProgressEffects, endTime);
        commitHookPassiveMountEffects(child, 8);
        break;
      case 23:
        break;
      case 22:
        var instance = child.stateNode;
        child.memoizedState !== null ? instance._visibility & 2 ? recursivelyTraverseReconnectPassiveEffects(finishedRoot, child, committedLanes, committedTransitions, includeWorkInProgressEffects, endTime) : recursivelyTraverseAtomicPassiveEffects(finishedRoot, child, committedLanes, committedTransitions, endTime) : (instance._visibility |= 2, recursivelyTraverseReconnectPassiveEffects(finishedRoot, child, committedLanes, committedTransitions, includeWorkInProgressEffects, endTime));
        includeWorkInProgressEffects && flags & 2048 && commitOffscreenPassiveMountEffects(child.alternate, child);
        break;
      case 24:
        recursivelyTraverseReconnectPassiveEffects(finishedRoot, child, committedLanes, committedTransitions, includeWorkInProgressEffects, endTime);
        includeWorkInProgressEffects && flags & 2048 && commitCachePassiveMountEffect(child.alternate, child);
        break;
      default:
        recursivelyTraverseReconnectPassiveEffects(finishedRoot, child, committedLanes, committedTransitions, includeWorkInProgressEffects, endTime);
    }
    (child.mode & 2) !== 0 && 0 <= componentEffectStartTime && 0 <= componentEffectEndTime && (componentEffectSpawnedUpdate || 0.05 < componentEffectDuration) && logComponentEffect(child, componentEffectStartTime, componentEffectEndTime, componentEffectDuration, componentEffectErrors);
    popComponentEffectStart(prevEffectStart);
    popComponentEffectDuration(prevEffectDuration);
    componentEffectErrors = prevEffectErrors;
    componentEffectSpawnedUpdate = prevEffectDidSpawnUpdate;
    child = parentFiber;
  }
}
function recursivelyTraverseAtomicPassiveEffects(finishedRoot$jscomp$0, parentFiber, committedLanes$jscomp$0, committedTransitions$jscomp$0, endTime$jscomp$0) {
  if (parentFiber.subtreeFlags & 10256 || parentFiber.actualDuration !== 0 && (parentFiber.alternate === null || parentFiber.alternate.child !== parentFiber.child))
    for (var child = parentFiber.child;child !== null; ) {
      parentFiber = child.sibling;
      var finishedRoot = finishedRoot$jscomp$0, committedLanes = committedLanes$jscomp$0, committedTransitions = committedTransitions$jscomp$0, endTime = parentFiber !== null ? parentFiber.actualStartTime : endTime$jscomp$0;
      (child.mode & 2) !== 0 && 0 < child.actualStartTime && (child.flags & 1) !== 0 && logComponentRender(child, child.actualStartTime, endTime, inHydratedSubtree);
      var flags = child.flags;
      switch (child.tag) {
        case 22:
          recursivelyTraverseAtomicPassiveEffects(finishedRoot, child, committedLanes, committedTransitions, endTime);
          flags & 2048 && commitOffscreenPassiveMountEffects(child.alternate, child);
          break;
        case 24:
          recursivelyTraverseAtomicPassiveEffects(finishedRoot, child, committedLanes, committedTransitions, endTime);
          flags & 2048 && commitCachePassiveMountEffect(child.alternate, child);
          break;
        default:
          recursivelyTraverseAtomicPassiveEffects(finishedRoot, child, committedLanes, committedTransitions, endTime);
      }
      child = parentFiber;
    }
}
function recursivelyAccumulateSuspenseyCommit(parentFiber, committedLanes, suspendedState) {
  if (parentFiber.subtreeFlags & suspenseyCommitFlag)
    for (parentFiber = parentFiber.child;parentFiber !== null; )
      accumulateSuspenseyCommitOnFiber(parentFiber, committedLanes, suspendedState), parentFiber = parentFiber.sibling;
}
function accumulateSuspenseyCommitOnFiber(fiber, committedLanes, suspendedState) {
  switch (fiber.tag) {
    case 26:
      recursivelyAccumulateSuspenseyCommit(fiber, committedLanes, suspendedState);
      fiber.flags & suspenseyCommitFlag && fiber.memoizedState !== null && suspendResource(suspendedState, currentHoistableRoot, fiber.memoizedState, fiber.memoizedProps);
      break;
    case 5:
      recursivelyAccumulateSuspenseyCommit(fiber, committedLanes, suspendedState);
      break;
    case 3:
    case 4:
      var previousHoistableRoot = currentHoistableRoot;
      currentHoistableRoot = getHoistableRoot(fiber.stateNode.containerInfo);
      recursivelyAccumulateSuspenseyCommit(fiber, committedLanes, suspendedState);
      currentHoistableRoot = previousHoistableRoot;
      break;
    case 22:
      fiber.memoizedState === null && (previousHoistableRoot = fiber.alternate, previousHoistableRoot !== null && previousHoistableRoot.memoizedState !== null ? (previousHoistableRoot = suspenseyCommitFlag, suspenseyCommitFlag = 16777216, recursivelyAccumulateSuspenseyCommit(fiber, committedLanes, suspendedState), suspenseyCommitFlag = previousHoistableRoot) : recursivelyAccumulateSuspenseyCommit(fiber, committedLanes, suspendedState));
      break;
    default:
      recursivelyAccumulateSuspenseyCommit(fiber, committedLanes, suspendedState);
  }
}
function detachAlternateSiblings(parentFiber) {
  var previousFiber = parentFiber.alternate;
  if (previousFiber !== null && (parentFiber = previousFiber.child, parentFiber !== null)) {
    previousFiber.child = null;
    do
      previousFiber = parentFiber.sibling, parentFiber.sibling = null, parentFiber = previousFiber;
    while (parentFiber !== null);
  }
}
function recursivelyTraversePassiveUnmountEffects(parentFiber) {
  var deletions = parentFiber.deletions;
  if ((parentFiber.flags & 16) !== 0) {
    if (deletions !== null)
      for (var i = 0;i < deletions.length; i++) {
        var childToDelete = deletions[i], prevEffectStart = pushComponentEffectStart();
        nextEffect = childToDelete;
        commitPassiveUnmountEffectsInsideOfDeletedTree_begin(childToDelete, parentFiber);
        (childToDelete.mode & 2) !== 0 && 0 <= componentEffectStartTime && 0 <= componentEffectEndTime && 0.05 < componentEffectEndTime - componentEffectStartTime && logComponentTrigger(childToDelete, componentEffectStartTime, componentEffectEndTime, "Unmount");
        popComponentEffectStart(prevEffectStart);
      }
    detachAlternateSiblings(parentFiber);
  }
  if (parentFiber.subtreeFlags & 10256)
    for (parentFiber = parentFiber.child;parentFiber !== null; )
      commitPassiveUnmountOnFiber(parentFiber), parentFiber = parentFiber.sibling;
}
function commitPassiveUnmountOnFiber(finishedWork) {
  var prevEffectStart = pushComponentEffectStart(), prevEffectDuration = pushComponentEffectDuration(), prevEffectErrors = pushComponentEffectErrors(), prevEffectDidSpawnUpdate = pushComponentEffectDidSpawnUpdate();
  switch (finishedWork.tag) {
    case 0:
    case 11:
    case 15:
      recursivelyTraversePassiveUnmountEffects(finishedWork);
      finishedWork.flags & 2048 && commitHookPassiveUnmountEffects(finishedWork, finishedWork.return, 9);
      break;
    case 3:
      var prevProfilerEffectDuration = pushNestedEffectDurations();
      recursivelyTraversePassiveUnmountEffects(finishedWork);
      finishedWork.stateNode.passiveEffectDuration += popNestedEffectDurations(prevProfilerEffectDuration);
      break;
    case 12:
      prevProfilerEffectDuration = pushNestedEffectDurations();
      recursivelyTraversePassiveUnmountEffects(finishedWork);
      finishedWork.stateNode.passiveEffectDuration += bubbleNestedEffectDurations(prevProfilerEffectDuration);
      break;
    case 22:
      prevProfilerEffectDuration = finishedWork.stateNode;
      finishedWork.memoizedState !== null && prevProfilerEffectDuration._visibility & 2 && (finishedWork.return === null || finishedWork.return.tag !== 13) ? (prevProfilerEffectDuration._visibility &= -3, recursivelyTraverseDisconnectPassiveEffects(finishedWork), (finishedWork.mode & 2) !== 0 && 0 <= componentEffectStartTime && 0 <= componentEffectEndTime && 0.05 < componentEffectEndTime - componentEffectStartTime && logComponentTrigger(finishedWork, componentEffectStartTime, componentEffectEndTime, "Disconnect")) : recursivelyTraversePassiveUnmountEffects(finishedWork);
      break;
    default:
      recursivelyTraversePassiveUnmountEffects(finishedWork);
  }
  (finishedWork.mode & 2) !== 0 && 0 <= componentEffectStartTime && 0 <= componentEffectEndTime && (componentEffectSpawnedUpdate || 0.05 < componentEffectDuration) && logComponentEffect(finishedWork, componentEffectStartTime, componentEffectEndTime, componentEffectDuration, componentEffectErrors);
  popComponentEffectStart(prevEffectStart);
  popComponentEffectDuration(prevEffectDuration);
  componentEffectSpawnedUpdate = prevEffectDidSpawnUpdate;
  componentEffectErrors = prevEffectErrors;
}
function recursivelyTraverseDisconnectPassiveEffects(parentFiber) {
  var deletions = parentFiber.deletions;
  if ((parentFiber.flags & 16) !== 0) {
    if (deletions !== null)
      for (var i = 0;i < deletions.length; i++) {
        var childToDelete = deletions[i], prevEffectStart = pushComponentEffectStart();
        nextEffect = childToDelete;
        commitPassiveUnmountEffectsInsideOfDeletedTree_begin(childToDelete, parentFiber);
        (childToDelete.mode & 2) !== 0 && 0 <= componentEffectStartTime && 0 <= componentEffectEndTime && 0.05 < componentEffectEndTime - componentEffectStartTime && logComponentTrigger(childToDelete, componentEffectStartTime, componentEffectEndTime, "Unmount");
        popComponentEffectStart(prevEffectStart);
      }
    detachAlternateSiblings(parentFiber);
  }
  for (parentFiber = parentFiber.child;parentFiber !== null; ) {
    deletions = parentFiber;
    i = pushComponentEffectStart();
    childToDelete = pushComponentEffectDuration();
    prevEffectStart = pushComponentEffectErrors();
    var prevEffectDidSpawnUpdate = pushComponentEffectDidSpawnUpdate();
    switch (deletions.tag) {
      case 0:
      case 11:
      case 15:
        commitHookPassiveUnmountEffects(deletions, deletions.return, 8);
        recursivelyTraverseDisconnectPassiveEffects(deletions);
        break;
      case 22:
        var instance = deletions.stateNode;
        instance._visibility & 2 && (instance._visibility &= -3, recursivelyTraverseDisconnectPassiveEffects(deletions));
        break;
      default:
        recursivelyTraverseDisconnectPassiveEffects(deletions);
    }
    (deletions.mode & 2) !== 0 && 0 <= componentEffectStartTime && 0 <= componentEffectEndTime && (componentEffectSpawnedUpdate || 0.05 < componentEffectDuration) && logComponentEffect(deletions, componentEffectStartTime, componentEffectEndTime, componentEffectDuration, componentEffectErrors);
    popComponentEffectStart(i);
    popComponentEffectDuration(childToDelete);
    componentEffectSpawnedUpdate = prevEffectDidSpawnUpdate;
    componentEffectErrors = prevEffectStart;
    parentFiber = parentFiber.sibling;
  }
}
function commitPassiveUnmountEffectsInsideOfDeletedTree_begin(deletedSubtreeRoot, nearestMountedAncestor$jscomp$0) {
  for (;nextEffect !== null; ) {
    var fiber = nextEffect, nearestMountedAncestor = nearestMountedAncestor$jscomp$0, prevEffectStart = pushComponentEffectStart(), prevEffectDuration = pushComponentEffectDuration(), prevEffectErrors = pushComponentEffectErrors(), prevEffectDidSpawnUpdate = pushComponentEffectDidSpawnUpdate();
    switch (fiber.tag) {
      case 0:
      case 11:
      case 15:
        commitHookPassiveUnmountEffects(fiber, nearestMountedAncestor, 8);
        break;
      case 23:
      case 22:
        fiber.memoizedState !== null && fiber.memoizedState.cachePool !== null && (nearestMountedAncestor = fiber.memoizedState.cachePool.pool, nearestMountedAncestor != null && nearestMountedAncestor.refCount++);
        break;
      case 24:
        releaseCache(fiber.memoizedState.cache);
    }
    (fiber.mode & 2) !== 0 && 0 <= componentEffectStartTime && 0 <= componentEffectEndTime && (componentEffectSpawnedUpdate || 0.05 < componentEffectDuration) && logComponentEffect(fiber, componentEffectStartTime, componentEffectEndTime, componentEffectDuration, componentEffectErrors);
    popComponentEffectStart(prevEffectStart);
    popComponentEffectDuration(prevEffectDuration);
    componentEffectSpawnedUpdate = prevEffectDidSpawnUpdate;
    componentEffectErrors = prevEffectErrors;
    prevEffectStart = fiber.child;
    if (prevEffectStart !== null)
      prevEffectStart.return = fiber, nextEffect = prevEffectStart;
    else
      a:
        for (fiber = deletedSubtreeRoot;nextEffect !== null; ) {
          prevEffectStart = nextEffect;
          prevEffectDuration = prevEffectStart.sibling;
          prevEffectErrors = prevEffectStart.return;
          detachFiberAfterEffects(prevEffectStart);
          if (prevEffectStart === fiber) {
            nextEffect = null;
            break a;
          }
          if (prevEffectDuration !== null) {
            prevEffectDuration.return = prevEffectErrors;
            nextEffect = prevEffectDuration;
            break a;
          }
          nextEffect = prevEffectErrors;
        }
  }
}
function requestUpdateLane() {
  return (executionContext & 2) !== 0 && workInProgressRootRenderLanes !== 0 ? workInProgressRootRenderLanes & -workInProgressRootRenderLanes : ReactSharedInternals.T !== null ? requestTransitionLane() : resolveUpdatePriority();
}
function requestDeferredLane() {
  if (workInProgressDeferredLane === 0)
    if ((workInProgressRootRenderLanes & 536870912) === 0 || isHydrating) {
      var lane = nextTransitionDeferredLane;
      nextTransitionDeferredLane <<= 1;
      (nextTransitionDeferredLane & 3932160) === 0 && (nextTransitionDeferredLane = 262144);
      workInProgressDeferredLane = lane;
    } else
      workInProgressDeferredLane = 536870912;
  lane = suspenseHandlerStackCursor.current;
  lane !== null && (lane.flags |= 32);
  return workInProgressDeferredLane;
}
function scheduleUpdateOnFiber(root2, fiber, lane) {
  if (root2 === workInProgressRoot && (workInProgressSuspendedReason === 2 || workInProgressSuspendedReason === 9) || root2.cancelPendingCommit !== null)
    prepareFreshStack(root2, 0), markRootSuspended(root2, workInProgressRootRenderLanes, workInProgressDeferredLane, false);
  markRootUpdated$1(root2, lane);
  if ((executionContext & 2) === 0 || root2 !== workInProgressRoot)
    isDevToolsPresent && addFiberToLanesMap(root2, fiber, lane), root2 === workInProgressRoot && ((executionContext & 2) === 0 && (workInProgressRootInterleavedUpdatedLanes |= lane), workInProgressRootExitStatus === 4 && markRootSuspended(root2, workInProgressRootRenderLanes, workInProgressDeferredLane, false)), ensureRootIsScheduled(root2);
}
function performWorkOnRoot(root$jscomp$0, lanes, forceSync) {
  if ((executionContext & 6) !== 0)
    throw Error(formatProdErrorMessage(327));
  if (workInProgressRootRenderLanes !== 0 && workInProgress !== null) {
    var yieldEndTime = now$1();
    switch (yieldReason) {
      case 3:
      case 2:
        supportsUserTiming && console.timeStamp("Suspended", yieldStartTime, yieldEndTime, "Components ⚛", undefined, "primary-light");
        break;
      case 9:
        supportsUserTiming && console.timeStamp("Action", yieldStartTime, yieldEndTime, "Components ⚛", undefined, "primary-light");
        break;
      default:
        if (supportsUserTiming) {
          var yieldDuration = yieldEndTime - yieldStartTime;
          3 > yieldDuration || console.timeStamp("Blocked", yieldStartTime, yieldEndTime, "Components ⚛", undefined, 5 > yieldDuration ? "primary-light" : 10 > yieldDuration ? "primary" : 100 > yieldDuration ? "primary-dark" : "error");
        }
    }
  }
  var exitStatus = (yieldEndTime = !forceSync && (lanes & 127) === 0 && (lanes & root$jscomp$0.expiredLanes) === 0 || checkIfRootIsPrerendering(root$jscomp$0, lanes)) ? renderRootConcurrent(root$jscomp$0, lanes) : renderRootSync(root$jscomp$0, lanes, true), renderWasConcurrent = yieldEndTime;
  do {
    if (exitStatus === 0) {
      workInProgressRootIsPrerendering && !yieldEndTime && markRootSuspended(root$jscomp$0, lanes, 0, false);
      lanes = workInProgressSuspendedReason;
      yieldStartTime = now();
      yieldReason = lanes;
      break;
    } else {
      yieldDuration = now$1();
      forceSync = root$jscomp$0.current.alternate;
      if (renderWasConcurrent && !isRenderConsistentWithExternalStores(forceSync)) {
        setCurrentTrackFromLanes(lanes);
        !supportsUserTiming || yieldDuration <= renderStartTime || console.timeStamp("Teared Render", renderStartTime, yieldDuration, currentTrack, "Scheduler ⚛", "error");
        finalizeRender(lanes, yieldDuration);
        exitStatus = renderRootSync(root$jscomp$0, lanes, false);
        renderWasConcurrent = false;
        continue;
      }
      if (exitStatus === 2) {
        renderWasConcurrent = lanes;
        if (root$jscomp$0.errorRecoveryDisabledLanes & renderWasConcurrent)
          var JSCompiler_inline_result = 0;
        else
          JSCompiler_inline_result = root$jscomp$0.pendingLanes & -536870913, JSCompiler_inline_result = JSCompiler_inline_result !== 0 ? JSCompiler_inline_result : JSCompiler_inline_result & 536870912 ? 536870912 : 0;
        if (JSCompiler_inline_result !== 0) {
          setCurrentTrackFromLanes(lanes);
          logErroredRenderPhase(renderStartTime, yieldDuration);
          finalizeRender(lanes, yieldDuration);
          lanes = JSCompiler_inline_result;
          var root2 = root$jscomp$0;
          yieldDuration = workInProgressRootConcurrentErrors;
          var wasRootDehydrated = root2.current.memoizedState.isDehydrated;
          wasRootDehydrated && (prepareFreshStack(root2, JSCompiler_inline_result).flags |= 256);
          exitStatus = renderRootSync(root2, JSCompiler_inline_result, false);
          exitStatus !== 2 && (workInProgressRootDidAttachPingListener && !wasRootDehydrated ? (root2.errorRecoveryDisabledLanes |= renderWasConcurrent, workInProgressRootInterleavedUpdatedLanes |= renderWasConcurrent, exitStatus = 4) : (renderWasConcurrent = workInProgressRootRecoverableErrors, workInProgressRootRecoverableErrors = yieldDuration, renderWasConcurrent !== null && (yieldDuration = renderWasConcurrent, workInProgressRootRecoverableErrors === null ? workInProgressRootRecoverableErrors = yieldDuration : workInProgressRootRecoverableErrors.push.apply(workInProgressRootRecoverableErrors, yieldDuration))));
          renderWasConcurrent = false;
          if (exitStatus !== 2)
            continue;
          else
            yieldDuration = now$1();
        }
      }
      if (exitStatus === 1) {
        setCurrentTrackFromLanes(lanes);
        logErroredRenderPhase(renderStartTime, yieldDuration);
        finalizeRender(lanes, yieldDuration);
        prepareFreshStack(root$jscomp$0, 0);
        markRootSuspended(root$jscomp$0, lanes, 0, true);
        break;
      }
      a: {
        yieldEndTime = root$jscomp$0;
        renderWasConcurrent = exitStatus;
        switch (renderWasConcurrent) {
          case 0:
          case 1:
            throw Error(formatProdErrorMessage(345));
          case 4:
            if ((lanes & 4194048) !== lanes)
              break;
          case 6:
            setCurrentTrackFromLanes(lanes);
            logSuspendedRenderPhase(renderStartTime, yieldDuration, lanes);
            finalizeRender(lanes, yieldDuration);
            forceSync = lanes;
            (forceSync & 127) !== 0 ? blockingSuspendedTime = yieldDuration : (forceSync & 4194048) !== 0 && (transitionSuspendedTime = yieldDuration);
            markRootSuspended(yieldEndTime, lanes, workInProgressDeferredLane, !workInProgressRootDidSkipSuspendedSiblings);
            break a;
          case 2:
            workInProgressRootRecoverableErrors = null;
            break;
          case 3:
          case 5:
            break;
          default:
            throw Error(formatProdErrorMessage(329));
        }
        if ((lanes & 62914560) === lanes && (exitStatus = globalMostRecentFallbackTime + 300 - now$1(), 10 < exitStatus)) {
          markRootSuspended(yieldEndTime, lanes, workInProgressDeferredLane, !workInProgressRootDidSkipSuspendedSiblings);
          if (getNextLanes(yieldEndTime, 0, true) !== 0)
            break a;
          pendingEffectsLanes = lanes;
          yieldEndTime.timeoutHandle = scheduleTimeout(commitRootWhenReady.bind(null, yieldEndTime, forceSync, workInProgressRootRecoverableErrors, workInProgressTransitions, workInProgressRootDidIncludeRecursiveRenderUpdate, lanes, workInProgressDeferredLane, workInProgressRootInterleavedUpdatedLanes, workInProgressSuspendedRetryLanes, workInProgressRootDidSkipSuspendedSiblings, renderWasConcurrent, "Throttled", renderStartTime, yieldDuration), exitStatus);
          break a;
        }
        commitRootWhenReady(yieldEndTime, forceSync, workInProgressRootRecoverableErrors, workInProgressTransitions, workInProgressRootDidIncludeRecursiveRenderUpdate, lanes, workInProgressDeferredLane, workInProgressRootInterleavedUpdatedLanes, workInProgressSuspendedRetryLanes, workInProgressRootDidSkipSuspendedSiblings, renderWasConcurrent, null, renderStartTime, yieldDuration);
      }
    }
    break;
  } while (1);
  ensureRootIsScheduled(root$jscomp$0);
}
function commitRootWhenReady(root2, finishedWork, recoverableErrors, transitions, didIncludeRenderPhaseUpdate, lanes, spawnedLane, updatedLanes, suspendedRetryLanes, didSkipSuspendedSiblings, exitStatus, suspendedCommitReason, completedRenderStartTime, completedRenderEndTime) {
  root2.timeoutHandle = -1;
  var subtreeFlags = finishedWork.subtreeFlags, suspendedState = null;
  if (subtreeFlags & 8192 || (subtreeFlags & 16785408) === 16785408) {
    if (suspendedState = {
      stylesheets: null,
      count: 0,
      imgCount: 0,
      imgBytes: 0,
      suspenseyImages: [],
      waitingForImages: true,
      waitingForViewTransition: false,
      unsuspend: noop$1
    }, accumulateSuspenseyCommitOnFiber(finishedWork, lanes, suspendedState), subtreeFlags = (lanes & 62914560) === lanes ? globalMostRecentFallbackTime - now$1() : (lanes & 4194048) === lanes ? globalMostRecentTransitionTime - now$1() : 0, subtreeFlags = waitForCommitToBeReady(suspendedState, subtreeFlags), subtreeFlags !== null) {
      pendingEffectsLanes = lanes;
      root2.cancelPendingCommit = subtreeFlags(commitRoot.bind(null, root2, finishedWork, lanes, recoverableErrors, transitions, didIncludeRenderPhaseUpdate, spawnedLane, updatedLanes, suspendedRetryLanes, exitStatus, suspendedState, suspendedState.waitingForViewTransition ? "Waiting for the previous Animation" : 0 < suspendedState.count ? 0 < suspendedState.imgCount ? "Suspended on CSS and Images" : "Suspended on CSS" : suspendedState.imgCount === 1 ? "Suspended on an Image" : 0 < suspendedState.imgCount ? "Suspended on Images" : null, completedRenderStartTime, completedRenderEndTime));
      markRootSuspended(root2, lanes, spawnedLane, !didSkipSuspendedSiblings);
      return;
    }
  }
  commitRoot(root2, finishedWork, lanes, recoverableErrors, transitions, didIncludeRenderPhaseUpdate, spawnedLane, updatedLanes, suspendedRetryLanes, exitStatus, suspendedState, suspendedCommitReason, completedRenderStartTime, completedRenderEndTime);
}
function isRenderConsistentWithExternalStores(finishedWork) {
  for (var node = finishedWork;; ) {
    var tag = node.tag;
    if ((tag === 0 || tag === 11 || tag === 15) && node.flags & 16384 && (tag = node.updateQueue, tag !== null && (tag = tag.stores, tag !== null)))
      for (var i = 0;i < tag.length; i++) {
        var check = tag[i], getSnapshot = check.getSnapshot;
        check = check.value;
        try {
          if (!objectIs(getSnapshot(), check))
            return false;
        } catch (error) {
          return false;
        }
      }
    tag = node.child;
    if (node.subtreeFlags & 16384 && tag !== null)
      tag.return = node, node = tag;
    else {
      if (node === finishedWork)
        break;
      for (;node.sibling === null; ) {
        if (node.return === null || node.return === finishedWork)
          return true;
        node = node.return;
      }
      node.sibling.return = node.return;
      node = node.sibling;
    }
  }
  return true;
}
function markRootSuspended(root2, suspendedLanes, spawnedLane, didAttemptEntireTree) {
  suspendedLanes &= ~workInProgressRootPingedLanes;
  suspendedLanes &= ~workInProgressRootInterleavedUpdatedLanes;
  root2.suspendedLanes |= suspendedLanes;
  root2.pingedLanes &= ~suspendedLanes;
  didAttemptEntireTree && (root2.warmLanes |= suspendedLanes);
  didAttemptEntireTree = root2.expirationTimes;
  for (var lanes = suspendedLanes;0 < lanes; ) {
    var index$6 = 31 - clz32(lanes), lane = 1 << index$6;
    didAttemptEntireTree[index$6] = -1;
    lanes &= ~lane;
  }
  spawnedLane !== 0 && markSpawnedDeferredLane(root2, spawnedLane, suspendedLanes);
}
function flushSyncWork$1() {
  return (executionContext & 6) === 0 ? (flushSyncWorkAcrossRoots_impl(0, false), false) : true;
}
function resetWorkInProgressStack() {
  if (workInProgress !== null) {
    if (workInProgressSuspendedReason === 0)
      var interruptedWork = workInProgress.return;
    else
      interruptedWork = workInProgress, lastContextDependency = currentlyRenderingFiber$1 = null, resetHooksOnUnwind(interruptedWork), thenableState$1 = null, thenableIndexCounter$1 = 0, interruptedWork = workInProgress;
    for (;interruptedWork !== null; )
      unwindInterruptedWork(interruptedWork.alternate, interruptedWork), interruptedWork = interruptedWork.return;
    workInProgress = null;
  }
}
function finalizeRender(lanes, finalizationTime) {
  (lanes & 127) !== 0 && (blockingClampTime = finalizationTime);
  (lanes & 4194048) !== 0 && (transitionClampTime = finalizationTime);
}
function prepareFreshStack(root2, lanes) {
  supportsUserTiming && (console.timeStamp("Blocking Track", 0.003, 0.003, "Blocking", "Scheduler ⚛", "primary-light"), console.timeStamp("Transition Track", 0.003, 0.003, "Transition", "Scheduler ⚛", "primary-light"), console.timeStamp("Suspense Track", 0.003, 0.003, "Suspense", "Scheduler ⚛", "primary-light"), console.timeStamp("Idle Track", 0.003, 0.003, "Idle", "Scheduler ⚛", "primary-light"));
  var previousRenderStartTime = renderStartTime;
  renderStartTime = now();
  if (workInProgressRootRenderLanes !== 0 && 0 < previousRenderStartTime) {
    setCurrentTrackFromLanes(workInProgressRootRenderLanes);
    if (workInProgressRootExitStatus === 3 || workInProgressRootExitStatus === 4)
      logSuspendedRenderPhase(previousRenderStartTime, renderStartTime, lanes);
    else {
      var endTime = renderStartTime;
      !supportsUserTiming || endTime <= previousRenderStartTime || console.timeStamp((lanes & 536870912) === lanes ? "Prewarm" : (lanes & 201326741) === lanes ? "Interrupted Hydration" : "Interrupted Render", previousRenderStartTime, endTime, currentTrack, "Scheduler ⚛", (lanes & 738197653) === lanes ? "tertiary-dark" : "primary-dark");
    }
    finalizeRender(workInProgressRootRenderLanes, renderStartTime);
  }
  if ((lanes & 127) !== 0) {
    previousRenderStartTime = 0 <= blockingUpdateTime && blockingUpdateTime < blockingClampTime ? blockingClampTime : blockingUpdateTime;
    endTime = 0 <= blockingEventTime && blockingEventTime < blockingClampTime ? blockingClampTime : blockingEventTime;
    var clampedRenderStartTime$203 = 0 <= endTime ? endTime : 0 <= previousRenderStartTime ? previousRenderStartTime : renderStartTime;
    0 <= blockingSuspendedTime && (setCurrentTrackFromLanes(2), logSuspendedWithDelayPhase(blockingSuspendedTime, clampedRenderStartTime$203, lanes));
    clampedRenderStartTime$203 = blockingEventType;
    var eventIsRepeat = 0 < blockingEventRepeatTime, isSpawnedUpdate = blockingUpdateType === 1, isPingedUpdate = blockingUpdateType === 2, renderStartTime$jscomp$0 = renderStartTime;
    supportsUserTiming && (currentTrack = "Blocking", 0 < previousRenderStartTime ? previousRenderStartTime > renderStartTime$jscomp$0 && (previousRenderStartTime = renderStartTime$jscomp$0) : previousRenderStartTime = renderStartTime$jscomp$0, 0 < endTime ? endTime > previousRenderStartTime && (endTime = previousRenderStartTime) : endTime = previousRenderStartTime, clampedRenderStartTime$203 !== null && previousRenderStartTime > endTime && console.timeStamp(eventIsRepeat ? "Consecutive" : "Event: " + clampedRenderStartTime$203, endTime, previousRenderStartTime, currentTrack, "Scheduler ⚛", eventIsRepeat ? "secondary-light" : "warning"), renderStartTime$jscomp$0 > previousRenderStartTime && console.timeStamp(isPingedUpdate ? "Promise Resolved" : isSpawnedUpdate ? "Cascading Update" : 5 < renderStartTime$jscomp$0 - previousRenderStartTime ? "Update Blocked" : "Update", previousRenderStartTime, renderStartTime$jscomp$0, currentTrack, "Scheduler ⚛", isSpawnedUpdate ? "error" : (lanes & 738197653) === lanes ? "tertiary-light" : "primary-light"));
    blockingUpdateTime = -1.1;
    blockingUpdateType = 0;
    blockingSuspendedTime = -1.1;
    blockingEventRepeatTime = blockingEventTime;
    blockingEventTime = -1.1;
    blockingClampTime = now();
  }
  (lanes & 4194048) !== 0 && (previousRenderStartTime = 0 <= transitionStartTime && transitionStartTime < transitionClampTime ? transitionClampTime : transitionStartTime, endTime = 0 <= transitionUpdateTime && transitionUpdateTime < transitionClampTime ? transitionClampTime : transitionUpdateTime, clampedRenderStartTime$203 = 0 <= transitionEventTime && transitionEventTime < transitionClampTime ? transitionClampTime : transitionEventTime, eventIsRepeat = 0 <= clampedRenderStartTime$203 ? clampedRenderStartTime$203 : 0 <= endTime ? endTime : renderStartTime, 0 <= transitionSuspendedTime && (setCurrentTrackFromLanes(256), logSuspendedWithDelayPhase(transitionSuspendedTime, eventIsRepeat, lanes)), eventIsRepeat = transitionEventType, isSpawnedUpdate = 0 < transitionEventRepeatTime, isPingedUpdate = transitionUpdateType === 2, renderStartTime$jscomp$0 = renderStartTime, supportsUserTiming && (currentTrack = "Transition", 0 < endTime ? endTime > renderStartTime$jscomp$0 && (endTime = renderStartTime$jscomp$0) : endTime = renderStartTime$jscomp$0, 0 < previousRenderStartTime ? previousRenderStartTime > endTime && (previousRenderStartTime = endTime) : previousRenderStartTime = endTime, 0 < clampedRenderStartTime$203 ? clampedRenderStartTime$203 > previousRenderStartTime && (clampedRenderStartTime$203 = previousRenderStartTime) : clampedRenderStartTime$203 = previousRenderStartTime, previousRenderStartTime > clampedRenderStartTime$203 && eventIsRepeat !== null && console.timeStamp(isSpawnedUpdate ? "Consecutive" : "Event: " + eventIsRepeat, clampedRenderStartTime$203, previousRenderStartTime, currentTrack, "Scheduler ⚛", isSpawnedUpdate ? "secondary-light" : "warning"), endTime > previousRenderStartTime && console.timeStamp("Action", previousRenderStartTime, endTime, currentTrack, "Scheduler ⚛", "primary-dark"), renderStartTime$jscomp$0 > endTime && console.timeStamp(isPingedUpdate ? "Promise Resolved" : 5 < renderStartTime$jscomp$0 - endTime ? "Update Blocked" : "Update", endTime, renderStartTime$jscomp$0, currentTrack, "Scheduler ⚛", "primary-light")), transitionUpdateTime = transitionStartTime = -1.1, transitionUpdateType = 0, transitionSuspendedTime = -1.1, transitionEventRepeatTime = transitionEventTime, transitionEventTime = -1.1, transitionClampTime = now());
  previousRenderStartTime = root2.timeoutHandle;
  previousRenderStartTime !== -1 && (root2.timeoutHandle = -1, cancelTimeout(previousRenderStartTime));
  previousRenderStartTime = root2.cancelPendingCommit;
  previousRenderStartTime !== null && (root2.cancelPendingCommit = null, previousRenderStartTime());
  pendingEffectsLanes = 0;
  resetWorkInProgressStack();
  workInProgressRoot = root2;
  workInProgress = previousRenderStartTime = createWorkInProgress(root2.current, null);
  workInProgressRootRenderLanes = lanes;
  workInProgressSuspendedReason = 0;
  workInProgressThrownValue = null;
  workInProgressRootDidSkipSuspendedSiblings = false;
  workInProgressRootIsPrerendering = checkIfRootIsPrerendering(root2, lanes);
  workInProgressRootDidAttachPingListener = false;
  workInProgressSuspendedRetryLanes = workInProgressDeferredLane = workInProgressRootPingedLanes = workInProgressRootInterleavedUpdatedLanes = workInProgressRootSkippedLanes = workInProgressRootExitStatus = 0;
  workInProgressRootRecoverableErrors = workInProgressRootConcurrentErrors = null;
  workInProgressRootDidIncludeRecursiveRenderUpdate = false;
  (lanes & 8) !== 0 && (lanes |= lanes & 32);
  endTime = root2.entangledLanes;
  if (endTime !== 0)
    for (root2 = root2.entanglements, endTime &= lanes;0 < endTime; )
      clampedRenderStartTime$203 = 31 - clz32(endTime), eventIsRepeat = 1 << clampedRenderStartTime$203, lanes |= root2[clampedRenderStartTime$203], endTime &= ~eventIsRepeat;
  entangledRenderLanes = lanes;
  finishQueueingConcurrentUpdates();
  return previousRenderStartTime;
}
function handleThrow(root2, thrownValue) {
  currentlyRenderingFiber = null;
  ReactSharedInternals.H = ContextOnlyDispatcher;
  thrownValue === SuspenseException || thrownValue === SuspenseActionException ? (thrownValue = getSuspendedThenable(), workInProgressSuspendedReason = 3) : thrownValue === SuspenseyCommitException ? (thrownValue = getSuspendedThenable(), workInProgressSuspendedReason = 4) : workInProgressSuspendedReason = thrownValue === SelectiveHydrationException ? 8 : thrownValue !== null && typeof thrownValue === "object" && typeof thrownValue.then === "function" ? 6 : 1;
  workInProgressThrownValue = thrownValue;
  var erroredWork = workInProgress;
  erroredWork === null ? (workInProgressRootExitStatus = 1, logUncaughtError(root2, createCapturedValueAtFiber(thrownValue, root2.current))) : erroredWork.mode & 2 && stopProfilerTimerIfRunningAndRecordDuration(erroredWork);
}
function shouldRemainOnPreviousScreen() {
  var handler = suspenseHandlerStackCursor.current;
  return handler === null ? true : (workInProgressRootRenderLanes & 4194048) === workInProgressRootRenderLanes ? shellBoundary === null ? true : false : (workInProgressRootRenderLanes & 62914560) === workInProgressRootRenderLanes || (workInProgressRootRenderLanes & 536870912) !== 0 ? handler === shellBoundary : false;
}
function pushDispatcher() {
  var prevDispatcher = ReactSharedInternals.H;
  ReactSharedInternals.H = ContextOnlyDispatcher;
  return prevDispatcher === null ? ContextOnlyDispatcher : prevDispatcher;
}
function pushAsyncDispatcher() {
  var prevAsyncDispatcher = ReactSharedInternals.A;
  ReactSharedInternals.A = DefaultAsyncDispatcher;
  return prevAsyncDispatcher;
}
function renderDidSuspendDelayIfPossible() {
  workInProgressRootExitStatus = 4;
  workInProgressRootDidSkipSuspendedSiblings || (workInProgressRootRenderLanes & 4194048) !== workInProgressRootRenderLanes && suspenseHandlerStackCursor.current !== null || (workInProgressRootIsPrerendering = true);
  (workInProgressRootSkippedLanes & 134217727) === 0 && (workInProgressRootInterleavedUpdatedLanes & 134217727) === 0 || workInProgressRoot === null || markRootSuspended(workInProgressRoot, workInProgressRootRenderLanes, workInProgressDeferredLane, false);
}
function renderRootSync(root2, lanes, shouldYieldForPrerendering) {
  var prevExecutionContext = executionContext;
  executionContext |= 2;
  var prevDispatcher = pushDispatcher(), prevAsyncDispatcher = pushAsyncDispatcher();
  if (workInProgressRoot !== root2 || workInProgressRootRenderLanes !== lanes) {
    if (isDevToolsPresent) {
      var memoizedUpdaters = root2.memoizedUpdaters;
      0 < memoizedUpdaters.size && (restorePendingUpdaters(root2, workInProgressRootRenderLanes), memoizedUpdaters.clear());
      movePendingFibersToMemoized(root2, lanes);
    }
    workInProgressTransitions = null;
    prepareFreshStack(root2, lanes);
  }
  lanes = false;
  memoizedUpdaters = workInProgressRootExitStatus;
  a:
    do
      try {
        if (workInProgressSuspendedReason !== 0 && workInProgress !== null) {
          var unitOfWork = workInProgress, thrownValue = workInProgressThrownValue;
          switch (workInProgressSuspendedReason) {
            case 8:
              resetWorkInProgressStack();
              memoizedUpdaters = 6;
              break a;
            case 3:
            case 2:
            case 9:
            case 6:
              suspenseHandlerStackCursor.current === null && (lanes = true);
              var reason = workInProgressSuspendedReason;
              workInProgressSuspendedReason = 0;
              workInProgressThrownValue = null;
              throwAndUnwindWorkLoop(root2, unitOfWork, thrownValue, reason);
              if (shouldYieldForPrerendering && workInProgressRootIsPrerendering) {
                memoizedUpdaters = 0;
                break a;
              }
              break;
            default:
              reason = workInProgressSuspendedReason, workInProgressSuspendedReason = 0, workInProgressThrownValue = null, throwAndUnwindWorkLoop(root2, unitOfWork, thrownValue, reason);
          }
        }
        workLoopSync();
        memoizedUpdaters = workInProgressRootExitStatus;
        break;
      } catch (thrownValue$208) {
        handleThrow(root2, thrownValue$208);
      }
    while (1);
  lanes && root2.shellSuspendCounter++;
  lastContextDependency = currentlyRenderingFiber$1 = null;
  executionContext = prevExecutionContext;
  ReactSharedInternals.H = prevDispatcher;
  ReactSharedInternals.A = prevAsyncDispatcher;
  workInProgress === null && (workInProgressRoot = null, workInProgressRootRenderLanes = 0, finishQueueingConcurrentUpdates());
  return memoizedUpdaters;
}
function workLoopSync() {
  for (;workInProgress !== null; )
    performUnitOfWork(workInProgress);
}
function renderRootConcurrent(root2, lanes) {
  var prevExecutionContext = executionContext;
  executionContext |= 2;
  var prevDispatcher = pushDispatcher(), prevAsyncDispatcher = pushAsyncDispatcher();
  if (workInProgressRoot !== root2 || workInProgressRootRenderLanes !== lanes) {
    if (isDevToolsPresent) {
      var memoizedUpdaters = root2.memoizedUpdaters;
      0 < memoizedUpdaters.size && (restorePendingUpdaters(root2, workInProgressRootRenderLanes), memoizedUpdaters.clear());
      movePendingFibersToMemoized(root2, lanes);
    }
    workInProgressTransitions = null;
    workInProgressRootRenderTargetTime = now$1() + 500;
    prepareFreshStack(root2, lanes);
  } else
    workInProgressRootIsPrerendering = checkIfRootIsPrerendering(root2, lanes);
  a:
    do
      try {
        if (workInProgressSuspendedReason !== 0 && workInProgress !== null)
          b:
            switch (lanes = workInProgress, memoizedUpdaters = workInProgressThrownValue, workInProgressSuspendedReason) {
              case 1:
                workInProgressSuspendedReason = 0;
                workInProgressThrownValue = null;
                throwAndUnwindWorkLoop(root2, lanes, memoizedUpdaters, 1);
                break;
              case 2:
              case 9:
                if (isThenableResolved(memoizedUpdaters)) {
                  workInProgressSuspendedReason = 0;
                  workInProgressThrownValue = null;
                  replaySuspendedUnitOfWork(lanes);
                  break;
                }
                lanes = function() {
                  workInProgressSuspendedReason !== 2 && workInProgressSuspendedReason !== 9 || workInProgressRoot !== root2 || (workInProgressSuspendedReason = 7);
                  ensureRootIsScheduled(root2);
                };
                memoizedUpdaters.then(lanes, lanes);
                break a;
              case 3:
                workInProgressSuspendedReason = 7;
                break a;
              case 4:
                workInProgressSuspendedReason = 5;
                break a;
              case 7:
                isThenableResolved(memoizedUpdaters) ? (workInProgressSuspendedReason = 0, workInProgressThrownValue = null, replaySuspendedUnitOfWork(lanes)) : (workInProgressSuspendedReason = 0, workInProgressThrownValue = null, throwAndUnwindWorkLoop(root2, lanes, memoizedUpdaters, 7));
                break;
              case 5:
                var resource = null;
                switch (workInProgress.tag) {
                  case 26:
                    resource = workInProgress.memoizedState;
                  case 5:
                  case 27:
                    var hostFiber = workInProgress;
                    if (resource ? preloadResource(resource) : hostFiber.stateNode.complete) {
                      workInProgressSuspendedReason = 0;
                      workInProgressThrownValue = null;
                      var sibling = hostFiber.sibling;
                      if (sibling !== null)
                        workInProgress = sibling;
                      else {
                        var returnFiber = hostFiber.return;
                        returnFiber !== null ? (workInProgress = returnFiber, completeUnitOfWork(returnFiber)) : workInProgress = null;
                      }
                      break b;
                    }
                }
                workInProgressSuspendedReason = 0;
                workInProgressThrownValue = null;
                throwAndUnwindWorkLoop(root2, lanes, memoizedUpdaters, 5);
                break;
              case 6:
                workInProgressSuspendedReason = 0;
                workInProgressThrownValue = null;
                throwAndUnwindWorkLoop(root2, lanes, memoizedUpdaters, 6);
                break;
              case 8:
                resetWorkInProgressStack();
                workInProgressRootExitStatus = 6;
                break a;
              default:
                throw Error(formatProdErrorMessage(462));
            }
        workLoopConcurrentByScheduler();
        break;
      } catch (thrownValue$210) {
        handleThrow(root2, thrownValue$210);
      }
    while (1);
  lastContextDependency = currentlyRenderingFiber$1 = null;
  ReactSharedInternals.H = prevDispatcher;
  ReactSharedInternals.A = prevAsyncDispatcher;
  executionContext = prevExecutionContext;
  if (workInProgress !== null)
    return 0;
  workInProgressRoot = null;
  workInProgressRootRenderLanes = 0;
  finishQueueingConcurrentUpdates();
  return workInProgressRootExitStatus;
}
function workLoopConcurrentByScheduler() {
  for (;workInProgress !== null && !shouldYield(); )
    performUnitOfWork(workInProgress);
}
function performUnitOfWork(unitOfWork) {
  var current = unitOfWork.alternate;
  (unitOfWork.mode & 2) !== 0 ? (startProfilerTimer(unitOfWork), current = beginWork(current, unitOfWork, entangledRenderLanes), stopProfilerTimerIfRunningAndRecordDuration(unitOfWork)) : current = beginWork(current, unitOfWork, entangledRenderLanes);
  unitOfWork.memoizedProps = unitOfWork.pendingProps;
  current === null ? completeUnitOfWork(unitOfWork) : workInProgress = current;
}
function replaySuspendedUnitOfWork(unitOfWork) {
  var next = unitOfWork;
  var current = next.alternate, isProfilingMode = (next.mode & 2) !== 0;
  isProfilingMode && startProfilerTimer(next);
  switch (next.tag) {
    case 15:
    case 0:
      current = replayFunctionComponent(current, next, next.pendingProps, next.type, undefined, workInProgressRootRenderLanes);
      break;
    case 11:
      current = replayFunctionComponent(current, next, next.pendingProps, next.type.render, next.ref, workInProgressRootRenderLanes);
      break;
    case 5:
      resetHooksOnUnwind(next);
    default:
      unwindInterruptedWork(current, next), next = workInProgress = resetWorkInProgress(next, entangledRenderLanes), current = beginWork(current, next, entangledRenderLanes);
  }
  isProfilingMode && stopProfilerTimerIfRunningAndRecordDuration(next);
  next = current;
  unitOfWork.memoizedProps = unitOfWork.pendingProps;
  next === null ? completeUnitOfWork(unitOfWork) : workInProgress = next;
}
function throwAndUnwindWorkLoop(root2, unitOfWork, thrownValue, suspendedReason) {
  lastContextDependency = currentlyRenderingFiber$1 = null;
  resetHooksOnUnwind(unitOfWork);
  thenableState$1 = null;
  thenableIndexCounter$1 = 0;
  var returnFiber = unitOfWork.return;
  try {
    if (throwException(root2, returnFiber, unitOfWork, thrownValue, workInProgressRootRenderLanes)) {
      workInProgressRootExitStatus = 1;
      logUncaughtError(root2, createCapturedValueAtFiber(thrownValue, root2.current));
      workInProgress = null;
      return;
    }
  } catch (error) {
    if (returnFiber !== null)
      throw workInProgress = returnFiber, error;
    workInProgressRootExitStatus = 1;
    logUncaughtError(root2, createCapturedValueAtFiber(thrownValue, root2.current));
    workInProgress = null;
    return;
  }
  if (unitOfWork.flags & 32768) {
    if (isHydrating || suspendedReason === 1)
      root2 = true;
    else if (workInProgressRootIsPrerendering || (workInProgressRootRenderLanes & 536870912) !== 0)
      root2 = false;
    else if (workInProgressRootDidSkipSuspendedSiblings = root2 = true, suspendedReason === 2 || suspendedReason === 9 || suspendedReason === 3 || suspendedReason === 6)
      suspendedReason = suspenseHandlerStackCursor.current, suspendedReason !== null && suspendedReason.tag === 13 && (suspendedReason.flags |= 16384);
    unwindUnitOfWork(unitOfWork, root2);
  } else
    completeUnitOfWork(unitOfWork);
}
function completeUnitOfWork(unitOfWork) {
  var completedWork = unitOfWork;
  do {
    if ((completedWork.flags & 32768) !== 0) {
      unwindUnitOfWork(completedWork, workInProgressRootDidSkipSuspendedSiblings);
      return;
    }
    var current = completedWork.alternate;
    unitOfWork = completedWork.return;
    startProfilerTimer(completedWork);
    current = completeWork(current, completedWork, entangledRenderLanes);
    (completedWork.mode & 2) !== 0 && stopProfilerTimerIfRunningAndRecordIncompleteDuration(completedWork);
    if (current !== null) {
      workInProgress = current;
      return;
    }
    completedWork = completedWork.sibling;
    if (completedWork !== null) {
      workInProgress = completedWork;
      return;
    }
    workInProgress = completedWork = unitOfWork;
  } while (completedWork !== null);
  workInProgressRootExitStatus === 0 && (workInProgressRootExitStatus = 5);
}
function unwindUnitOfWork(unitOfWork, skipSiblings) {
  do {
    var next = unwindWork(unitOfWork.alternate, unitOfWork);
    if (next !== null) {
      next.flags &= 32767;
      workInProgress = next;
      return;
    }
    if ((unitOfWork.mode & 2) !== 0) {
      stopProfilerTimerIfRunningAndRecordIncompleteDuration(unitOfWork);
      next = unitOfWork.actualDuration;
      for (var child = unitOfWork.child;child !== null; )
        next += child.actualDuration, child = child.sibling;
      unitOfWork.actualDuration = next;
    }
    next = unitOfWork.return;
    next !== null && (next.flags |= 32768, next.subtreeFlags = 0, next.deletions = null);
    if (!skipSiblings && (unitOfWork = unitOfWork.sibling, unitOfWork !== null)) {
      workInProgress = unitOfWork;
      return;
    }
    workInProgress = unitOfWork = next;
  } while (unitOfWork !== null);
  workInProgressRootExitStatus = 6;
  workInProgress = null;
}
function commitRoot(root2, finishedWork, lanes, recoverableErrors, transitions, didIncludeRenderPhaseUpdate, spawnedLane, updatedLanes, suspendedRetryLanes, exitStatus, suspendedState, suspendedCommitReason, completedRenderStartTime, completedRenderEndTime) {
  root2.cancelPendingCommit = null;
  do
    flushPendingEffects();
  while (pendingEffectsStatus !== 0);
  if ((executionContext & 6) !== 0)
    throw Error(formatProdErrorMessage(327));
  setCurrentTrackFromLanes(lanes);
  exitStatus === 2 ? logErroredRenderPhase(completedRenderStartTime, completedRenderEndTime) : recoverableErrors !== null ? !supportsUserTiming || completedRenderEndTime <= completedRenderStartTime || console.timeStamp("Recovered", completedRenderStartTime, completedRenderEndTime, currentTrack, "Scheduler ⚛", "error") : !supportsUserTiming || completedRenderEndTime <= completedRenderStartTime || console.timeStamp((lanes & 536870912) === lanes ? "Prepared" : (lanes & 201326741) === lanes ? "Hydrated" : "Render", completedRenderStartTime, completedRenderEndTime, currentTrack, "Scheduler ⚛", (lanes & 738197653) === lanes ? "tertiary-dark" : "primary-dark");
  if (finishedWork !== null) {
    if (finishedWork === root2.current)
      throw Error(formatProdErrorMessage(177));
    didIncludeRenderPhaseUpdate = finishedWork.lanes | finishedWork.childLanes;
    didIncludeRenderPhaseUpdate |= concurrentlyUpdatedLanes;
    markRootFinished(root2, lanes, didIncludeRenderPhaseUpdate, spawnedLane, updatedLanes, suspendedRetryLanes);
    root2 === workInProgressRoot && (workInProgress = workInProgressRoot = null, workInProgressRootRenderLanes = 0);
    pendingFinishedWork = finishedWork;
    pendingEffectsRoot = root2;
    pendingEffectsLanes = lanes;
    pendingEffectsRemainingLanes = didIncludeRenderPhaseUpdate;
    pendingPassiveTransitions = transitions;
    pendingRecoverableErrors = recoverableErrors;
    pendingEffectsRenderEndTime = completedRenderEndTime;
    pendingSuspendedCommitReason = suspendedCommitReason;
    pendingDelayedCommitReason = 0;
    pendingSuspendedViewTransitionReason = null;
    finishedWork.actualDuration !== 0 || (finishedWork.subtreeFlags & 10256) !== 0 || (finishedWork.flags & 10256) !== 0 ? (root2.callbackNode = null, root2.callbackPriority = 0, scheduleCallback$1(NormalPriority$1, function() {
      schedulerEvent = window.event;
      pendingDelayedCommitReason === 0 && (pendingDelayedCommitReason = 2);
      flushPassiveEffects();
      return null;
    })) : (root2.callbackNode = null, root2.callbackPriority = 0);
    commitErrors = null;
    commitStartTime = now();
    suspendedCommitReason !== null && (!supportsUserTiming || commitStartTime <= completedRenderEndTime || console.timeStamp(suspendedCommitReason, completedRenderEndTime, commitStartTime, currentTrack, "Scheduler ⚛", "secondary-light"));
    recoverableErrors = (finishedWork.flags & 13878) !== 0;
    if ((finishedWork.subtreeFlags & 13878) !== 0 || recoverableErrors) {
      recoverableErrors = ReactSharedInternals.T;
      ReactSharedInternals.T = null;
      transitions = ReactDOMSharedInternals.p;
      ReactDOMSharedInternals.p = 2;
      spawnedLane = executionContext;
      executionContext |= 4;
      try {
        commitBeforeMutationEffects(root2, finishedWork, lanes);
      } finally {
        executionContext = spawnedLane, ReactDOMSharedInternals.p = transitions, ReactSharedInternals.T = recoverableErrors;
      }
    }
    pendingEffectsStatus = 1;
    flushMutationEffects();
    flushLayoutEffects();
    flushSpawnedWork();
  }
}
function flushMutationEffects() {
  if (pendingEffectsStatus === 1) {
    pendingEffectsStatus = 0;
    var root2 = pendingEffectsRoot, finishedWork = pendingFinishedWork, lanes = pendingEffectsLanes, rootMutationHasEffect = (finishedWork.flags & 13878) !== 0;
    if ((finishedWork.subtreeFlags & 13878) !== 0 || rootMutationHasEffect) {
      rootMutationHasEffect = ReactSharedInternals.T;
      ReactSharedInternals.T = null;
      var previousPriority = ReactDOMSharedInternals.p;
      ReactDOMSharedInternals.p = 2;
      var prevExecutionContext = executionContext;
      executionContext |= 4;
      try {
        inProgressLanes = lanes;
        inProgressRoot = root2;
        resetComponentEffectTimers();
        commitMutationEffectsOnFiber(finishedWork, root2);
        inProgressRoot = inProgressLanes = null;
        lanes = selectionInformation;
        var curFocusedElem = getActiveElementDeep(root2.containerInfo), priorFocusedElem = lanes.focusedElem, priorSelectionRange = lanes.selectionRange;
        if (curFocusedElem !== priorFocusedElem && priorFocusedElem && priorFocusedElem.ownerDocument && containsNode(priorFocusedElem.ownerDocument.documentElement, priorFocusedElem)) {
          if (priorSelectionRange !== null && hasSelectionCapabilities(priorFocusedElem)) {
            var { start, end } = priorSelectionRange;
            end === undefined && (end = start);
            if ("selectionStart" in priorFocusedElem)
              priorFocusedElem.selectionStart = start, priorFocusedElem.selectionEnd = Math.min(end, priorFocusedElem.value.length);
            else {
              var doc = priorFocusedElem.ownerDocument || document, win = doc && doc.defaultView || window;
              if (win.getSelection) {
                var selection = win.getSelection(), length = priorFocusedElem.textContent.length, start$jscomp$0 = Math.min(priorSelectionRange.start, length), end$jscomp$0 = priorSelectionRange.end === undefined ? start$jscomp$0 : Math.min(priorSelectionRange.end, length);
                !selection.extend && start$jscomp$0 > end$jscomp$0 && (curFocusedElem = end$jscomp$0, end$jscomp$0 = start$jscomp$0, start$jscomp$0 = curFocusedElem);
                var startMarker = getNodeForCharacterOffset(priorFocusedElem, start$jscomp$0), endMarker = getNodeForCharacterOffset(priorFocusedElem, end$jscomp$0);
                if (startMarker && endMarker && (selection.rangeCount !== 1 || selection.anchorNode !== startMarker.node || selection.anchorOffset !== startMarker.offset || selection.focusNode !== endMarker.node || selection.focusOffset !== endMarker.offset)) {
                  var range = doc.createRange();
                  range.setStart(startMarker.node, startMarker.offset);
                  selection.removeAllRanges();
                  start$jscomp$0 > end$jscomp$0 ? (selection.addRange(range), selection.extend(endMarker.node, endMarker.offset)) : (range.setEnd(endMarker.node, endMarker.offset), selection.addRange(range));
                }
              }
            }
          }
          doc = [];
          for (selection = priorFocusedElem;selection = selection.parentNode; )
            selection.nodeType === 1 && doc.push({
              element: selection,
              left: selection.scrollLeft,
              top: selection.scrollTop
            });
          typeof priorFocusedElem.focus === "function" && priorFocusedElem.focus();
          for (priorFocusedElem = 0;priorFocusedElem < doc.length; priorFocusedElem++) {
            var info = doc[priorFocusedElem];
            info.element.scrollLeft = info.left;
            info.element.scrollTop = info.top;
          }
        }
        _enabled = !!eventsEnabled;
        selectionInformation = eventsEnabled = null;
      } finally {
        executionContext = prevExecutionContext, ReactDOMSharedInternals.p = previousPriority, ReactSharedInternals.T = rootMutationHasEffect;
      }
    }
    root2.current = finishedWork;
    pendingEffectsStatus = 2;
  }
}
function flushLayoutEffects() {
  if (pendingEffectsStatus === 2) {
    pendingEffectsStatus = 0;
    var suspendedViewTransitionReason = pendingSuspendedViewTransitionReason;
    suspendedViewTransitionReason !== null && (commitStartTime = now(), !supportsUserTiming || commitStartTime <= commitEndTime || console.timeStamp(suspendedViewTransitionReason, commitEndTime, commitStartTime, currentTrack, "Scheduler ⚛", "secondary-light"));
    suspendedViewTransitionReason = pendingEffectsRoot;
    var finishedWork = pendingFinishedWork, lanes = pendingEffectsLanes, rootHasLayoutEffect = (finishedWork.flags & 8772) !== 0;
    if ((finishedWork.subtreeFlags & 8772) !== 0 || rootHasLayoutEffect) {
      rootHasLayoutEffect = ReactSharedInternals.T;
      ReactSharedInternals.T = null;
      var previousPriority = ReactDOMSharedInternals.p;
      ReactDOMSharedInternals.p = 2;
      var prevExecutionContext = executionContext;
      executionContext |= 4;
      try {
        inProgressLanes = lanes, inProgressRoot = suspendedViewTransitionReason, resetComponentEffectTimers(), commitLayoutEffectOnFiber(suspendedViewTransitionReason, finishedWork.alternate, finishedWork), inProgressRoot = inProgressLanes = null;
      } finally {
        executionContext = prevExecutionContext, ReactDOMSharedInternals.p = previousPriority, ReactSharedInternals.T = rootHasLayoutEffect;
      }
    }
    suspendedViewTransitionReason = pendingEffectsRenderEndTime;
    finishedWork = pendingSuspendedCommitReason;
    commitEndTime = now();
    suspendedViewTransitionReason = finishedWork === null ? suspendedViewTransitionReason : commitStartTime;
    finishedWork = commitEndTime;
    lanes = pendingDelayedCommitReason === 1;
    commitErrors !== null ? logCommitErrored(suspendedViewTransitionReason, finishedWork) : !supportsUserTiming || finishedWork <= suspendedViewTransitionReason || console.timeStamp(lanes ? "Commit Interrupted View Transition" : "Commit", suspendedViewTransitionReason, finishedWork, currentTrack, "Scheduler ⚛", lanes ? "error" : "secondary-dark");
    pendingEffectsStatus = 3;
  }
}
function flushSpawnedWork() {
  if (pendingEffectsStatus === 4 || pendingEffectsStatus === 3) {
    if (pendingEffectsStatus === 4) {
      var startViewTransitionStartTime = commitEndTime;
      commitEndTime = now();
      var abortedViewTransition = pendingDelayedCommitReason === 1;
      !supportsUserTiming || commitEndTime <= startViewTransitionStartTime || console.timeStamp(abortedViewTransition ? "Interrupted View Transition" : "Starting Animation", startViewTransitionStartTime, commitEndTime, currentTrack, "Scheduler ⚛", abortedViewTransition ? " error" : "secondary-light");
      pendingDelayedCommitReason !== 1 && (pendingDelayedCommitReason = 3);
    }
    pendingEffectsStatus = 0;
    requestPaint();
    startViewTransitionStartTime = pendingEffectsRoot;
    var finishedWork = pendingFinishedWork;
    abortedViewTransition = pendingEffectsLanes;
    var recoverableErrors = pendingRecoverableErrors, rootDidHavePassiveEffects = finishedWork.actualDuration !== 0 || (finishedWork.subtreeFlags & 10256) !== 0 || (finishedWork.flags & 10256) !== 0;
    rootDidHavePassiveEffects ? pendingEffectsStatus = 5 : (pendingEffectsStatus = 0, pendingFinishedWork = pendingEffectsRoot = null, releaseRootPooledCache(startViewTransitionStartTime, startViewTransitionStartTime.pendingLanes));
    var remainingLanes = startViewTransitionStartTime.pendingLanes;
    remainingLanes === 0 && (legacyErrorBoundariesThatAlreadyFailed = null);
    remainingLanes = lanesToEventPriority(abortedViewTransition);
    finishedWork = finishedWork.stateNode;
    if (injectedHook && typeof injectedHook.onCommitFiberRoot === "function")
      try {
        var didError = (finishedWork.current.flags & 128) === 128;
        switch (remainingLanes) {
          case 2:
            var schedulerPriority = ImmediatePriority;
            break;
          case 8:
            schedulerPriority = UserBlockingPriority;
            break;
          case 32:
            schedulerPriority = NormalPriority$1;
            break;
          case 268435456:
            schedulerPriority = IdlePriority;
            break;
          default:
            schedulerPriority = NormalPriority$1;
        }
        injectedHook.onCommitFiberRoot(rendererID, finishedWork, schedulerPriority, didError);
      } catch (err) {}
    isDevToolsPresent && startViewTransitionStartTime.memoizedUpdaters.clear();
    if (recoverableErrors !== null) {
      didError = ReactSharedInternals.T;
      schedulerPriority = ReactDOMSharedInternals.p;
      ReactDOMSharedInternals.p = 2;
      ReactSharedInternals.T = null;
      try {
        var onRecoverableError = startViewTransitionStartTime.onRecoverableError;
        for (finishedWork = 0;finishedWork < recoverableErrors.length; finishedWork++) {
          var recoverableError = recoverableErrors[finishedWork];
          onRecoverableError(recoverableError.value, {
            componentStack: recoverableError.stack
          });
        }
      } finally {
        ReactSharedInternals.T = didError, ReactDOMSharedInternals.p = schedulerPriority;
      }
    }
    (pendingEffectsLanes & 3) !== 0 && flushPendingEffects();
    ensureRootIsScheduled(startViewTransitionStartTime);
    remainingLanes = startViewTransitionStartTime.pendingLanes;
    (abortedViewTransition & 261930) !== 0 && (remainingLanes & 42) !== 0 ? (nestedUpdateScheduled = true, startViewTransitionStartTime === rootWithNestedUpdates ? nestedUpdateCount++ : (nestedUpdateCount = 0, rootWithNestedUpdates = startViewTransitionStartTime)) : nestedUpdateCount = 0;
    rootDidHavePassiveEffects || finalizeRender(abortedViewTransition, commitEndTime);
    flushSyncWorkAcrossRoots_impl(0, false);
  }
}
function releaseRootPooledCache(root2, remainingLanes) {
  (root2.pooledCacheLanes &= remainingLanes) === 0 && (remainingLanes = root2.pooledCache, remainingLanes != null && (root2.pooledCache = null, releaseCache(remainingLanes)));
}
function flushPendingEffects() {
  flushMutationEffects();
  flushLayoutEffects();
  flushSpawnedWork();
  return flushPassiveEffects();
}
function flushPassiveEffects() {
  if (pendingEffectsStatus !== 5)
    return false;
  var root2 = pendingEffectsRoot, remainingLanes = pendingEffectsRemainingLanes;
  pendingEffectsRemainingLanes = 0;
  var renderPriority = lanesToEventPriority(pendingEffectsLanes), prevTransition = ReactSharedInternals.T, previousPriority = ReactDOMSharedInternals.p;
  try {
    ReactDOMSharedInternals.p = 32 > renderPriority ? 32 : renderPriority;
    ReactSharedInternals.T = null;
    var transitions = pendingPassiveTransitions;
    pendingPassiveTransitions = null;
    renderPriority = pendingEffectsRoot;
    var lanes = pendingEffectsLanes;
    pendingEffectsStatus = 0;
    pendingFinishedWork = pendingEffectsRoot = null;
    pendingEffectsLanes = 0;
    if ((executionContext & 6) !== 0)
      throw Error(formatProdErrorMessage(331));
    setCurrentTrackFromLanes(lanes);
    var passiveEffectStartTime = 0;
    commitErrors = null;
    passiveEffectStartTime = now$1();
    pendingDelayedCommitReason === 3 ? !supportsUserTiming || passiveEffectStartTime <= commitEndTime || console.timeStamp("Animating", commitEndTime, passiveEffectStartTime, currentTrack, "Scheduler ⚛", "secondary-dark") : !supportsUserTiming || passiveEffectStartTime <= commitEndTime || console.timeStamp(pendingDelayedCommitReason === 2 ? "Waiting for Paint" : "Waiting", commitEndTime, passiveEffectStartTime, currentTrack, "Scheduler ⚛", "secondary-light");
    var prevExecutionContext = executionContext;
    executionContext |= 4;
    var finishedWork = renderPriority.current;
    resetComponentEffectTimers();
    commitPassiveUnmountOnFiber(finishedWork);
    var finishedWork$jscomp$0 = renderPriority.current;
    finishedWork = pendingEffectsRenderEndTime;
    resetComponentEffectTimers();
    commitPassiveMountOnFiber(renderPriority, finishedWork$jscomp$0, lanes, transitions, finishedWork);
    executionContext = prevExecutionContext;
    var passiveEffectsEndTime = now$1();
    finishedWork$jscomp$0 = passiveEffectStartTime;
    commitErrors !== null ? logCommitErrored(finishedWork$jscomp$0, passiveEffectsEndTime) : !supportsUserTiming || passiveEffectsEndTime <= finishedWork$jscomp$0 || console.timeStamp("Remaining Effects", finishedWork$jscomp$0, passiveEffectsEndTime, currentTrack, "Scheduler ⚛", "secondary-dark");
    finalizeRender(lanes, passiveEffectsEndTime);
    flushSyncWorkAcrossRoots_impl(0, false);
    if (injectedHook && typeof injectedHook.onPostCommitFiberRoot === "function")
      try {
        injectedHook.onPostCommitFiberRoot(rendererID, renderPriority);
      } catch (err) {}
    var stateNode = renderPriority.current.stateNode;
    stateNode.effectDuration = 0;
    stateNode.passiveEffectDuration = 0;
    return true;
  } finally {
    ReactDOMSharedInternals.p = previousPriority, ReactSharedInternals.T = prevTransition, releaseRootPooledCache(root2, remainingLanes);
  }
}
function captureCommitPhaseErrorOnRoot(rootFiber, sourceFiber, error) {
  sourceFiber = createCapturedValueAtFiber(error, sourceFiber);
  recordEffectError(sourceFiber);
  sourceFiber = createRootErrorUpdate(rootFiber.stateNode, sourceFiber, 2);
  rootFiber = enqueueUpdate(rootFiber, sourceFiber, 2);
  rootFiber !== null && (markRootUpdated$1(rootFiber, 2), ensureRootIsScheduled(rootFiber));
}
function captureCommitPhaseError(sourceFiber, nearestMountedAncestor, error) {
  if (sourceFiber.tag === 3)
    captureCommitPhaseErrorOnRoot(sourceFiber, sourceFiber, error);
  else
    for (;nearestMountedAncestor !== null; ) {
      if (nearestMountedAncestor.tag === 3) {
        captureCommitPhaseErrorOnRoot(nearestMountedAncestor, sourceFiber, error);
        break;
      } else if (nearestMountedAncestor.tag === 1) {
        var instance = nearestMountedAncestor.stateNode;
        if (typeof nearestMountedAncestor.type.getDerivedStateFromError === "function" || typeof instance.componentDidCatch === "function" && (legacyErrorBoundariesThatAlreadyFailed === null || !legacyErrorBoundariesThatAlreadyFailed.has(instance))) {
          sourceFiber = createCapturedValueAtFiber(error, sourceFiber);
          recordEffectError(sourceFiber);
          error = createClassErrorUpdate(2);
          instance = enqueueUpdate(nearestMountedAncestor, error, 2);
          instance !== null && (initializeClassErrorUpdate(error, instance, nearestMountedAncestor, sourceFiber), markRootUpdated$1(instance, 2), ensureRootIsScheduled(instance));
          break;
        }
      }
      nearestMountedAncestor = nearestMountedAncestor.return;
    }
}
function attachPingListener(root2, wakeable, lanes) {
  var pingCache = root2.pingCache;
  if (pingCache === null) {
    pingCache = root2.pingCache = new PossiblyWeakMap;
    var threadIDs = new Set;
    pingCache.set(wakeable, threadIDs);
  } else
    threadIDs = pingCache.get(wakeable), threadIDs === undefined && (threadIDs = new Set, pingCache.set(wakeable, threadIDs));
  threadIDs.has(lanes) || (workInProgressRootDidAttachPingListener = true, threadIDs.add(lanes), pingCache = pingSuspendedRoot.bind(null, root2, wakeable, lanes), isDevToolsPresent && restorePendingUpdaters(root2, lanes), wakeable.then(pingCache, pingCache));
}
function pingSuspendedRoot(root2, wakeable, pingedLanes) {
  var pingCache = root2.pingCache;
  pingCache !== null && pingCache.delete(wakeable);
  root2.pingedLanes |= root2.suspendedLanes & pingedLanes;
  root2.warmLanes &= ~pingedLanes;
  (pingedLanes & 127) !== 0 ? 0 > blockingUpdateTime && (blockingClampTime = blockingUpdateTime = now(), blockingUpdateType = 2) : (pingedLanes & 4194048) !== 0 && 0 > transitionUpdateTime && (transitionClampTime = transitionUpdateTime = now(), transitionUpdateType = 2);
  workInProgressRoot === root2 && (workInProgressRootRenderLanes & pingedLanes) === pingedLanes && (workInProgressRootExitStatus === 4 || workInProgressRootExitStatus === 3 && (workInProgressRootRenderLanes & 62914560) === workInProgressRootRenderLanes && 300 > now$1() - globalMostRecentFallbackTime ? (executionContext & 2) === 0 && prepareFreshStack(root2, 0) : workInProgressRootPingedLanes |= pingedLanes, workInProgressSuspendedRetryLanes === workInProgressRootRenderLanes && (workInProgressSuspendedRetryLanes = 0));
  ensureRootIsScheduled(root2);
}
function retryTimedOutBoundary(boundaryFiber, retryLane) {
  retryLane === 0 && (retryLane = claimNextRetryLane());
  boundaryFiber = enqueueConcurrentRenderForLane(boundaryFiber, retryLane);
  boundaryFiber !== null && (markRootUpdated$1(boundaryFiber, retryLane), ensureRootIsScheduled(boundaryFiber));
}
function retryDehydratedSuspenseBoundary(boundaryFiber) {
  var suspenseState = boundaryFiber.memoizedState, retryLane = 0;
  suspenseState !== null && (retryLane = suspenseState.retryLane);
  retryTimedOutBoundary(boundaryFiber, retryLane);
}
function resolveRetryWakeable(boundaryFiber, wakeable) {
  var retryLane = 0;
  switch (boundaryFiber.tag) {
    case 31:
    case 13:
      var retryCache = boundaryFiber.stateNode;
      var suspenseState = boundaryFiber.memoizedState;
      suspenseState !== null && (retryLane = suspenseState.retryLane);
      break;
    case 19:
      retryCache = boundaryFiber.stateNode;
      break;
    case 22:
      retryCache = boundaryFiber.stateNode._retryCache;
      break;
    default:
      throw Error(formatProdErrorMessage(314));
  }
  retryCache !== null && retryCache.delete(wakeable);
  retryTimedOutBoundary(boundaryFiber, retryLane);
}
function restorePendingUpdaters(root2, lanes) {
  isDevToolsPresent && root2.memoizedUpdaters.forEach(function(schedulingFiber) {
    addFiberToLanesMap(root2, schedulingFiber, lanes);
  });
}
function scheduleCallback$1(priorityLevel, callback) {
  return scheduleCallback$3(priorityLevel, callback);
}
function ensureRootIsScheduled(root2) {
  root2 !== lastScheduledRoot && root2.next === null && (lastScheduledRoot === null ? firstScheduledRoot = lastScheduledRoot = root2 : lastScheduledRoot = lastScheduledRoot.next = root2);
  mightHavePendingSyncWork = true;
  didScheduleMicrotask || (didScheduleMicrotask = true, scheduleImmediateRootScheduleTask());
}
function flushSyncWorkAcrossRoots_impl(syncTransitionLanes, onlyLegacy) {
  if (!isFlushingWork && mightHavePendingSyncWork) {
    isFlushingWork = true;
    do {
      var didPerformSomeWork = false;
      for (var root$213 = firstScheduledRoot;root$213 !== null; ) {
        if (!onlyLegacy)
          if (syncTransitionLanes !== 0) {
            var pendingLanes = root$213.pendingLanes;
            if (pendingLanes === 0)
              var JSCompiler_inline_result = 0;
            else {
              var { suspendedLanes, pingedLanes } = root$213;
              JSCompiler_inline_result = (1 << 31 - clz32(42 | syncTransitionLanes) + 1) - 1;
              JSCompiler_inline_result &= pendingLanes & ~(suspendedLanes & ~pingedLanes);
              JSCompiler_inline_result = JSCompiler_inline_result & 201326741 ? JSCompiler_inline_result & 201326741 | 1 : JSCompiler_inline_result ? JSCompiler_inline_result | 2 : 0;
            }
            JSCompiler_inline_result !== 0 && (didPerformSomeWork = true, performSyncWorkOnRoot(root$213, JSCompiler_inline_result));
          } else
            JSCompiler_inline_result = workInProgressRootRenderLanes, JSCompiler_inline_result = getNextLanes(root$213, root$213 === workInProgressRoot ? JSCompiler_inline_result : 0, root$213.cancelPendingCommit !== null || root$213.timeoutHandle !== -1), (JSCompiler_inline_result & 3) === 0 || checkIfRootIsPrerendering(root$213, JSCompiler_inline_result) || (didPerformSomeWork = true, performSyncWorkOnRoot(root$213, JSCompiler_inline_result));
        root$213 = root$213.next;
      }
    } while (didPerformSomeWork);
    isFlushingWork = false;
  }
}
function processRootScheduleInImmediateTask() {
  schedulerEvent = window.event;
  processRootScheduleInMicrotask();
}
function processRootScheduleInMicrotask() {
  mightHavePendingSyncWork = didScheduleMicrotask = false;
  var syncTransitionLanes = 0;
  currentEventTransitionLane !== 0 && shouldAttemptEagerTransition() && (syncTransitionLanes = currentEventTransitionLane);
  for (var currentTime = now$1(), prev = null, root2 = firstScheduledRoot;root2 !== null; ) {
    var next = root2.next, nextLanes = scheduleTaskForRootDuringMicrotask(root2, currentTime);
    if (nextLanes === 0)
      root2.next = null, prev === null ? firstScheduledRoot = next : prev.next = next, next === null && (lastScheduledRoot = prev);
    else if (prev = root2, syncTransitionLanes !== 0 || (nextLanes & 3) !== 0)
      mightHavePendingSyncWork = true;
    root2 = next;
  }
  pendingEffectsStatus !== 0 && pendingEffectsStatus !== 5 || flushSyncWorkAcrossRoots_impl(syncTransitionLanes, false);
  currentEventTransitionLane !== 0 && (currentEventTransitionLane = 0);
}
function scheduleTaskForRootDuringMicrotask(root2, currentTime) {
  for (var { suspendedLanes, pingedLanes, expirationTimes } = root2, lanes = root2.pendingLanes & -62914561;0 < lanes; ) {
    var index$5 = 31 - clz32(lanes), lane = 1 << index$5, expirationTime = expirationTimes[index$5];
    if (expirationTime === -1) {
      if ((lane & suspendedLanes) === 0 || (lane & pingedLanes) !== 0)
        expirationTimes[index$5] = computeExpirationTime(lane, currentTime);
    } else
      expirationTime <= currentTime && (root2.expiredLanes |= lane);
    lanes &= ~lane;
  }
  currentTime = workInProgressRoot;
  suspendedLanes = workInProgressRootRenderLanes;
  suspendedLanes = getNextLanes(root2, root2 === currentTime ? suspendedLanes : 0, root2.cancelPendingCommit !== null || root2.timeoutHandle !== -1);
  pingedLanes = root2.callbackNode;
  if (suspendedLanes === 0 || root2 === currentTime && (workInProgressSuspendedReason === 2 || workInProgressSuspendedReason === 9) || root2.cancelPendingCommit !== null)
    return pingedLanes !== null && pingedLanes !== null && cancelCallback$1(pingedLanes), root2.callbackNode = null, root2.callbackPriority = 0;
  if ((suspendedLanes & 3) === 0 || checkIfRootIsPrerendering(root2, suspendedLanes)) {
    currentTime = suspendedLanes & -suspendedLanes;
    if (currentTime === root2.callbackPriority)
      return currentTime;
    pingedLanes !== null && cancelCallback$1(pingedLanes);
    switch (lanesToEventPriority(suspendedLanes)) {
      case 2:
      case 8:
        suspendedLanes = UserBlockingPriority;
        break;
      case 32:
        suspendedLanes = NormalPriority$1;
        break;
      case 268435456:
        suspendedLanes = IdlePriority;
        break;
      default:
        suspendedLanes = NormalPriority$1;
    }
    pingedLanes = performWorkOnRootViaSchedulerTask.bind(null, root2);
    suspendedLanes = scheduleCallback$3(suspendedLanes, pingedLanes);
    root2.callbackPriority = currentTime;
    root2.callbackNode = suspendedLanes;
    return currentTime;
  }
  pingedLanes !== null && pingedLanes !== null && cancelCallback$1(pingedLanes);
  root2.callbackPriority = 2;
  root2.callbackNode = null;
  return 2;
}
function performWorkOnRootViaSchedulerTask(root2, didTimeout) {
  nestedUpdateScheduled = currentUpdateIsNested = false;
  schedulerEvent = window.event;
  if (pendingEffectsStatus !== 0 && pendingEffectsStatus !== 5)
    return root2.callbackNode = null, root2.callbackPriority = 0, null;
  var originalCallbackNode = root2.callbackNode;
  pendingDelayedCommitReason === 0 && (pendingDelayedCommitReason = 2);
  if (flushPendingEffects() && root2.callbackNode !== originalCallbackNode)
    return null;
  var workInProgressRootRenderLanes$jscomp$0 = workInProgressRootRenderLanes;
  workInProgressRootRenderLanes$jscomp$0 = getNextLanes(root2, root2 === workInProgressRoot ? workInProgressRootRenderLanes$jscomp$0 : 0, root2.cancelPendingCommit !== null || root2.timeoutHandle !== -1);
  if (workInProgressRootRenderLanes$jscomp$0 === 0)
    return null;
  performWorkOnRoot(root2, workInProgressRootRenderLanes$jscomp$0, didTimeout);
  scheduleTaskForRootDuringMicrotask(root2, now$1());
  return root2.callbackNode != null && root2.callbackNode === originalCallbackNode ? performWorkOnRootViaSchedulerTask.bind(null, root2) : null;
}
function performSyncWorkOnRoot(root2, lanes) {
  if (flushPendingEffects())
    return null;
  currentUpdateIsNested = nestedUpdateScheduled;
  nestedUpdateScheduled = false;
  performWorkOnRoot(root2, lanes, true);
}
function scheduleImmediateRootScheduleTask() {
  scheduleMicrotask(function() {
    (executionContext & 6) !== 0 ? scheduleCallback$3(ImmediatePriority, processRootScheduleInImmediateTask) : processRootScheduleInMicrotask();
  });
}
function requestTransitionLane() {
  if (currentEventTransitionLane === 0) {
    var actionScopeLane = currentEntangledLane;
    actionScopeLane === 0 && (actionScopeLane = nextTransitionUpdateLane, nextTransitionUpdateLane <<= 1, (nextTransitionUpdateLane & 261888) === 0 && (nextTransitionUpdateLane = 256));
    currentEventTransitionLane = actionScopeLane;
  }
  return currentEventTransitionLane;
}
function coerceFormActionProp(actionProp) {
  return actionProp == null || typeof actionProp === "symbol" || typeof actionProp === "boolean" ? null : typeof actionProp === "function" ? actionProp : sanitizeURL("" + actionProp);
}
function createFormDataWithSubmitter(form, submitter) {
  var temp = submitter.ownerDocument.createElement("input");
  temp.name = submitter.name;
  temp.value = submitter.value;
  form.id && temp.setAttribute("form", form.id);
  submitter.parentNode.insertBefore(temp, submitter);
  form = new FormData(form);
  temp.parentNode.removeChild(temp);
  return form;
}
function extractEvents$1(dispatchQueue, domEventName, maybeTargetInst, nativeEvent, nativeEventTarget) {
  if (domEventName === "submit" && maybeTargetInst && maybeTargetInst.stateNode === nativeEventTarget) {
    var action = coerceFormActionProp((nativeEventTarget[internalPropsKey] || null).action), submitter = nativeEvent.submitter;
    submitter && (domEventName = (domEventName = submitter[internalPropsKey] || null) ? coerceFormActionProp(domEventName.formAction) : submitter.getAttribute("formAction"), domEventName !== null && (action = domEventName, submitter = null));
    var event = new SyntheticEvent("action", "action", null, nativeEvent, nativeEventTarget);
    dispatchQueue.push({
      event,
      listeners: [
        {
          instance: null,
          listener: function() {
            if (nativeEvent.defaultPrevented) {
              if (currentEventTransitionLane !== 0) {
                var formData = submitter ? createFormDataWithSubmitter(nativeEventTarget, submitter) : new FormData(nativeEventTarget);
                startHostTransition(maybeTargetInst, {
                  pending: true,
                  data: formData,
                  method: nativeEventTarget.method,
                  action
                }, null, formData);
              }
            } else
              typeof action === "function" && (event.preventDefault(), formData = submitter ? createFormDataWithSubmitter(nativeEventTarget, submitter) : new FormData(nativeEventTarget), startHostTransition(maybeTargetInst, {
                pending: true,
                data: formData,
                method: nativeEventTarget.method,
                action
              }, action, formData));
          },
          currentTarget: nativeEventTarget
        }
      ]
    });
  }
}
function processDispatchQueue(dispatchQueue, eventSystemFlags) {
  eventSystemFlags = (eventSystemFlags & 4) !== 0;
  for (var i = 0;i < dispatchQueue.length; i++) {
    var _dispatchQueue$i = dispatchQueue[i], event = _dispatchQueue$i.event;
    _dispatchQueue$i = _dispatchQueue$i.listeners;
    a: {
      var previousInstance = undefined;
      if (eventSystemFlags)
        for (var i$jscomp$0 = _dispatchQueue$i.length - 1;0 <= i$jscomp$0; i$jscomp$0--) {
          var _dispatchListeners$i = _dispatchQueue$i[i$jscomp$0], instance = _dispatchListeners$i.instance, currentTarget = _dispatchListeners$i.currentTarget;
          _dispatchListeners$i = _dispatchListeners$i.listener;
          if (instance !== previousInstance && event.isPropagationStopped())
            break a;
          previousInstance = _dispatchListeners$i;
          event.currentTarget = currentTarget;
          try {
            previousInstance(event);
          } catch (error) {
            reportGlobalError(error);
          }
          event.currentTarget = null;
          previousInstance = instance;
        }
      else
        for (i$jscomp$0 = 0;i$jscomp$0 < _dispatchQueue$i.length; i$jscomp$0++) {
          _dispatchListeners$i = _dispatchQueue$i[i$jscomp$0];
          instance = _dispatchListeners$i.instance;
          currentTarget = _dispatchListeners$i.currentTarget;
          _dispatchListeners$i = _dispatchListeners$i.listener;
          if (instance !== previousInstance && event.isPropagationStopped())
            break a;
          previousInstance = _dispatchListeners$i;
          event.currentTarget = currentTarget;
          try {
            previousInstance(event);
          } catch (error) {
            reportGlobalError(error);
          }
          event.currentTarget = null;
          previousInstance = instance;
        }
    }
  }
}
function listenToNonDelegatedEvent(domEventName, targetElement) {
  var JSCompiler_inline_result = targetElement[internalEventHandlersKey];
  JSCompiler_inline_result === undefined && (JSCompiler_inline_result = targetElement[internalEventHandlersKey] = new Set);
  var listenerSetKey = domEventName + "__bubble";
  JSCompiler_inline_result.has(listenerSetKey) || (addTrappedEventListener(targetElement, domEventName, 2, false), JSCompiler_inline_result.add(listenerSetKey));
}
function listenToNativeEvent(domEventName, isCapturePhaseListener, target) {
  var eventSystemFlags = 0;
  isCapturePhaseListener && (eventSystemFlags |= 4);
  addTrappedEventListener(target, domEventName, eventSystemFlags, isCapturePhaseListener);
}
function listenToAllSupportedEvents(rootContainerElement) {
  if (!rootContainerElement[listeningMarker]) {
    rootContainerElement[listeningMarker] = true;
    allNativeEvents.forEach(function(domEventName) {
      domEventName !== "selectionchange" && (nonDelegatedEvents.has(domEventName) || listenToNativeEvent(domEventName, false, rootContainerElement), listenToNativeEvent(domEventName, true, rootContainerElement));
    });
    var ownerDocument = rootContainerElement.nodeType === 9 ? rootContainerElement : rootContainerElement.ownerDocument;
    ownerDocument === null || ownerDocument[listeningMarker] || (ownerDocument[listeningMarker] = true, listenToNativeEvent("selectionchange", false, ownerDocument));
  }
}
function addTrappedEventListener(targetContainer, domEventName, eventSystemFlags, isCapturePhaseListener) {
  switch (getEventPriority(domEventName)) {
    case 2:
      var listenerWrapper = dispatchDiscreteEvent;
      break;
    case 8:
      listenerWrapper = dispatchContinuousEvent;
      break;
    default:
      listenerWrapper = dispatchEvent;
  }
  eventSystemFlags = listenerWrapper.bind(null, domEventName, eventSystemFlags, targetContainer);
  listenerWrapper = undefined;
  !passiveBrowserEventsSupported || domEventName !== "touchstart" && domEventName !== "touchmove" && domEventName !== "wheel" || (listenerWrapper = true);
  isCapturePhaseListener ? listenerWrapper !== undefined ? targetContainer.addEventListener(domEventName, eventSystemFlags, {
    capture: true,
    passive: listenerWrapper
  }) : targetContainer.addEventListener(domEventName, eventSystemFlags, true) : listenerWrapper !== undefined ? targetContainer.addEventListener(domEventName, eventSystemFlags, {
    passive: listenerWrapper
  }) : targetContainer.addEventListener(domEventName, eventSystemFlags, false);
}
function dispatchEventForPluginEventSystem(domEventName, eventSystemFlags, nativeEvent, targetInst$jscomp$0, targetContainer) {
  var ancestorInst = targetInst$jscomp$0;
  if ((eventSystemFlags & 1) === 0 && (eventSystemFlags & 2) === 0 && targetInst$jscomp$0 !== null)
    a:
      for (;; ) {
        if (targetInst$jscomp$0 === null)
          return;
        var nodeTag = targetInst$jscomp$0.tag;
        if (nodeTag === 3 || nodeTag === 4) {
          var container = targetInst$jscomp$0.stateNode.containerInfo;
          if (container === targetContainer)
            break;
          if (nodeTag === 4)
            for (nodeTag = targetInst$jscomp$0.return;nodeTag !== null; ) {
              var grandTag = nodeTag.tag;
              if ((grandTag === 3 || grandTag === 4) && nodeTag.stateNode.containerInfo === targetContainer)
                return;
              nodeTag = nodeTag.return;
            }
          for (;container !== null; ) {
            nodeTag = getClosestInstanceFromNode(container);
            if (nodeTag === null)
              return;
            grandTag = nodeTag.tag;
            if (grandTag === 5 || grandTag === 6 || grandTag === 26 || grandTag === 27) {
              targetInst$jscomp$0 = ancestorInst = nodeTag;
              continue a;
            }
            container = container.parentNode;
          }
        }
        targetInst$jscomp$0 = targetInst$jscomp$0.return;
      }
  batchedUpdates$2(function() {
    var targetInst = ancestorInst, nativeEventTarget = getEventTarget(nativeEvent), dispatchQueue = [];
    a: {
      var reactName = topLevelEventsToReactNames.get(domEventName);
      if (reactName !== undefined) {
        var SyntheticEventCtor = SyntheticEvent, reactEventType = domEventName;
        switch (domEventName) {
          case "keypress":
            if (getEventCharCode(nativeEvent) === 0)
              break a;
          case "keydown":
          case "keyup":
            SyntheticEventCtor = SyntheticKeyboardEvent;
            break;
          case "focusin":
            reactEventType = "focus";
            SyntheticEventCtor = SyntheticFocusEvent;
            break;
          case "focusout":
            reactEventType = "blur";
            SyntheticEventCtor = SyntheticFocusEvent;
            break;
          case "beforeblur":
          case "afterblur":
            SyntheticEventCtor = SyntheticFocusEvent;
            break;
          case "click":
            if (nativeEvent.button === 2)
              break a;
          case "auxclick":
          case "dblclick":
          case "mousedown":
          case "mousemove":
          case "mouseup":
          case "mouseout":
          case "mouseover":
          case "contextmenu":
            SyntheticEventCtor = SyntheticMouseEvent;
            break;
          case "drag":
          case "dragend":
          case "dragenter":
          case "dragexit":
          case "dragleave":
          case "dragover":
          case "dragstart":
          case "drop":
            SyntheticEventCtor = SyntheticDragEvent;
            break;
          case "touchcancel":
          case "touchend":
          case "touchmove":
          case "touchstart":
            SyntheticEventCtor = SyntheticTouchEvent;
            break;
          case ANIMATION_END:
          case ANIMATION_ITERATION:
          case ANIMATION_START:
            SyntheticEventCtor = SyntheticAnimationEvent;
            break;
          case TRANSITION_END:
            SyntheticEventCtor = SyntheticTransitionEvent;
            break;
          case "scroll":
          case "scrollend":
            SyntheticEventCtor = SyntheticUIEvent;
            break;
          case "wheel":
            SyntheticEventCtor = SyntheticWheelEvent;
            break;
          case "copy":
          case "cut":
          case "paste":
            SyntheticEventCtor = SyntheticClipboardEvent;
            break;
          case "gotpointercapture":
          case "lostpointercapture":
          case "pointercancel":
          case "pointerdown":
          case "pointermove":
          case "pointerout":
          case "pointerover":
          case "pointerup":
            SyntheticEventCtor = SyntheticPointerEvent;
            break;
          case "toggle":
          case "beforetoggle":
            SyntheticEventCtor = SyntheticToggleEvent;
        }
        var inCapturePhase = (eventSystemFlags & 4) !== 0, accumulateTargetOnly = !inCapturePhase && (domEventName === "scroll" || domEventName === "scrollend"), reactEventName = inCapturePhase ? reactName !== null ? reactName + "Capture" : null : reactName;
        inCapturePhase = [];
        for (var instance = targetInst, lastHostComponent;instance !== null; ) {
          var _instance = instance;
          lastHostComponent = _instance.stateNode;
          _instance = _instance.tag;
          _instance !== 5 && _instance !== 26 && _instance !== 27 || lastHostComponent === null || reactEventName === null || (_instance = getListener(instance, reactEventName), _instance != null && inCapturePhase.push(createDispatchListener(instance, _instance, lastHostComponent)));
          if (accumulateTargetOnly)
            break;
          instance = instance.return;
        }
        0 < inCapturePhase.length && (reactName = new SyntheticEventCtor(reactName, reactEventType, null, nativeEvent, nativeEventTarget), dispatchQueue.push({ event: reactName, listeners: inCapturePhase }));
      }
    }
    if ((eventSystemFlags & 7) === 0) {
      a: {
        reactName = domEventName === "mouseover" || domEventName === "pointerover";
        SyntheticEventCtor = domEventName === "mouseout" || domEventName === "pointerout";
        if (reactName && nativeEvent !== currentReplayingEvent && (reactEventType = nativeEvent.relatedTarget || nativeEvent.fromElement) && (getClosestInstanceFromNode(reactEventType) || reactEventType[internalContainerInstanceKey]))
          break a;
        if (SyntheticEventCtor || reactName) {
          reactName = nativeEventTarget.window === nativeEventTarget ? nativeEventTarget : (reactName = nativeEventTarget.ownerDocument) ? reactName.defaultView || reactName.parentWindow : window;
          if (SyntheticEventCtor) {
            if (reactEventType = nativeEvent.relatedTarget || nativeEvent.toElement, SyntheticEventCtor = targetInst, reactEventType = reactEventType ? getClosestInstanceFromNode(reactEventType) : null, reactEventType !== null && (accumulateTargetOnly = getNearestMountedFiber(reactEventType), inCapturePhase = reactEventType.tag, reactEventType !== accumulateTargetOnly || inCapturePhase !== 5 && inCapturePhase !== 27 && inCapturePhase !== 6))
              reactEventType = null;
          } else
            SyntheticEventCtor = null, reactEventType = targetInst;
          if (SyntheticEventCtor !== reactEventType) {
            inCapturePhase = SyntheticMouseEvent;
            _instance = "onMouseLeave";
            reactEventName = "onMouseEnter";
            instance = "mouse";
            if (domEventName === "pointerout" || domEventName === "pointerover")
              inCapturePhase = SyntheticPointerEvent, _instance = "onPointerLeave", reactEventName = "onPointerEnter", instance = "pointer";
            accumulateTargetOnly = SyntheticEventCtor == null ? reactName : getNodeFromInstance(SyntheticEventCtor);
            lastHostComponent = reactEventType == null ? reactName : getNodeFromInstance(reactEventType);
            reactName = new inCapturePhase(_instance, instance + "leave", SyntheticEventCtor, nativeEvent, nativeEventTarget);
            reactName.target = accumulateTargetOnly;
            reactName.relatedTarget = lastHostComponent;
            _instance = null;
            getClosestInstanceFromNode(nativeEventTarget) === targetInst && (inCapturePhase = new inCapturePhase(reactEventName, instance + "enter", reactEventType, nativeEvent, nativeEventTarget), inCapturePhase.target = lastHostComponent, inCapturePhase.relatedTarget = accumulateTargetOnly, _instance = inCapturePhase);
            accumulateTargetOnly = _instance;
            if (SyntheticEventCtor && reactEventType)
              b: {
                inCapturePhase = getParent;
                reactEventName = SyntheticEventCtor;
                instance = reactEventType;
                lastHostComponent = 0;
                for (_instance = reactEventName;_instance; _instance = inCapturePhase(_instance))
                  lastHostComponent++;
                _instance = 0;
                for (var tempB = instance;tempB; tempB = inCapturePhase(tempB))
                  _instance++;
                for (;0 < lastHostComponent - _instance; )
                  reactEventName = inCapturePhase(reactEventName), lastHostComponent--;
                for (;0 < _instance - lastHostComponent; )
                  instance = inCapturePhase(instance), _instance--;
                for (;lastHostComponent--; ) {
                  if (reactEventName === instance || instance !== null && reactEventName === instance.alternate) {
                    inCapturePhase = reactEventName;
                    break b;
                  }
                  reactEventName = inCapturePhase(reactEventName);
                  instance = inCapturePhase(instance);
                }
                inCapturePhase = null;
              }
            else
              inCapturePhase = null;
            SyntheticEventCtor !== null && accumulateEnterLeaveListenersForEvent(dispatchQueue, reactName, SyntheticEventCtor, inCapturePhase, false);
            reactEventType !== null && accumulateTargetOnly !== null && accumulateEnterLeaveListenersForEvent(dispatchQueue, accumulateTargetOnly, reactEventType, inCapturePhase, true);
          }
        }
      }
      a: {
        reactName = targetInst ? getNodeFromInstance(targetInst) : window;
        SyntheticEventCtor = reactName.nodeName && reactName.nodeName.toLowerCase();
        if (SyntheticEventCtor === "select" || SyntheticEventCtor === "input" && reactName.type === "file")
          var getTargetInstFunc = getTargetInstForChangeEvent;
        else if (isTextInputElement(reactName))
          if (isInputEventSupported)
            getTargetInstFunc = getTargetInstForInputOrChangeEvent;
          else {
            getTargetInstFunc = getTargetInstForInputEventPolyfill;
            var handleEventFunc = handleEventsForInputEventPolyfill;
          }
        else
          SyntheticEventCtor = reactName.nodeName, !SyntheticEventCtor || SyntheticEventCtor.toLowerCase() !== "input" || reactName.type !== "checkbox" && reactName.type !== "radio" ? targetInst && isCustomElement(targetInst.elementType) && (getTargetInstFunc = getTargetInstForChangeEvent) : getTargetInstFunc = getTargetInstForClickEvent;
        if (getTargetInstFunc && (getTargetInstFunc = getTargetInstFunc(domEventName, targetInst))) {
          createAndAccumulateChangeEvent(dispatchQueue, getTargetInstFunc, nativeEvent, nativeEventTarget);
          break a;
        }
        handleEventFunc && handleEventFunc(domEventName, reactName, targetInst);
        domEventName === "focusout" && targetInst && reactName.type === "number" && targetInst.memoizedProps.value != null && setDefaultValue(reactName, "number", reactName.value);
      }
      handleEventFunc = targetInst ? getNodeFromInstance(targetInst) : window;
      switch (domEventName) {
        case "focusin":
          if (isTextInputElement(handleEventFunc) || handleEventFunc.contentEditable === "true")
            activeElement = handleEventFunc, activeElementInst = targetInst, lastSelection = null;
          break;
        case "focusout":
          lastSelection = activeElementInst = activeElement = null;
          break;
        case "mousedown":
          mouseDown = true;
          break;
        case "contextmenu":
        case "mouseup":
        case "dragend":
          mouseDown = false;
          constructSelectEvent(dispatchQueue, nativeEvent, nativeEventTarget);
          break;
        case "selectionchange":
          if (skipSelectionChangeEvent)
            break;
        case "keydown":
        case "keyup":
          constructSelectEvent(dispatchQueue, nativeEvent, nativeEventTarget);
      }
      var fallbackData;
      if (canUseCompositionEvent)
        b: {
          switch (domEventName) {
            case "compositionstart":
              var eventType = "onCompositionStart";
              break b;
            case "compositionend":
              eventType = "onCompositionEnd";
              break b;
            case "compositionupdate":
              eventType = "onCompositionUpdate";
              break b;
          }
          eventType = undefined;
        }
      else
        isComposing ? isFallbackCompositionEnd(domEventName, nativeEvent) && (eventType = "onCompositionEnd") : domEventName === "keydown" && nativeEvent.keyCode === 229 && (eventType = "onCompositionStart");
      eventType && (useFallbackCompositionData && nativeEvent.locale !== "ko" && (isComposing || eventType !== "onCompositionStart" ? eventType === "onCompositionEnd" && isComposing && (fallbackData = getData()) : (root = nativeEventTarget, startText = ("value" in root) ? root.value : root.textContent, isComposing = true)), handleEventFunc = accumulateTwoPhaseListeners(targetInst, eventType), 0 < handleEventFunc.length && (eventType = new SyntheticCompositionEvent(eventType, domEventName, null, nativeEvent, nativeEventTarget), dispatchQueue.push({ event: eventType, listeners: handleEventFunc }), fallbackData ? eventType.data = fallbackData : (fallbackData = getDataFromCustomEvent(nativeEvent), fallbackData !== null && (eventType.data = fallbackData))));
      if (fallbackData = canUseTextInputEvent ? getNativeBeforeInputChars(domEventName, nativeEvent) : getFallbackBeforeInputChars(domEventName, nativeEvent))
        eventType = accumulateTwoPhaseListeners(targetInst, "onBeforeInput"), 0 < eventType.length && (handleEventFunc = new SyntheticCompositionEvent("onBeforeInput", "beforeinput", null, nativeEvent, nativeEventTarget), dispatchQueue.push({
          event: handleEventFunc,
          listeners: eventType
        }), handleEventFunc.data = fallbackData);
      extractEvents$1(dispatchQueue, domEventName, targetInst, nativeEvent, nativeEventTarget);
    }
    processDispatchQueue(dispatchQueue, eventSystemFlags);
  });
}
function createDispatchListener(instance, listener, currentTarget) {
  return {
    instance,
    listener,
    currentTarget
  };
}
function accumulateTwoPhaseListeners(targetFiber, reactName) {
  for (var captureName = reactName + "Capture", listeners = [];targetFiber !== null; ) {
    var _instance2 = targetFiber, stateNode = _instance2.stateNode;
    _instance2 = _instance2.tag;
    _instance2 !== 5 && _instance2 !== 26 && _instance2 !== 27 || stateNode === null || (_instance2 = getListener(targetFiber, captureName), _instance2 != null && listeners.unshift(createDispatchListener(targetFiber, _instance2, stateNode)), _instance2 = getListener(targetFiber, reactName), _instance2 != null && listeners.push(createDispatchListener(targetFiber, _instance2, stateNode)));
    if (targetFiber.tag === 3)
      return listeners;
    targetFiber = targetFiber.return;
  }
  return [];
}
function getParent(inst) {
  if (inst === null)
    return null;
  do
    inst = inst.return;
  while (inst && inst.tag !== 5 && inst.tag !== 27);
  return inst ? inst : null;
}
function accumulateEnterLeaveListenersForEvent(dispatchQueue, event, target, common, inCapturePhase) {
  for (var registrationName = event._reactName, listeners = [];target !== null && target !== common; ) {
    var _instance3 = target, alternate = _instance3.alternate, stateNode = _instance3.stateNode;
    _instance3 = _instance3.tag;
    if (alternate !== null && alternate === common)
      break;
    _instance3 !== 5 && _instance3 !== 26 && _instance3 !== 27 || stateNode === null || (alternate = stateNode, inCapturePhase ? (stateNode = getListener(target, registrationName), stateNode != null && listeners.unshift(createDispatchListener(target, stateNode, alternate))) : inCapturePhase || (stateNode = getListener(target, registrationName), stateNode != null && listeners.push(createDispatchListener(target, stateNode, alternate))));
    target = target.return;
  }
  listeners.length !== 0 && dispatchQueue.push({ event, listeners });
}
function normalizeMarkupForTextOrAttribute(markup) {
  return (typeof markup === "string" ? markup : "" + markup).replace(NORMALIZE_NEWLINES_REGEX, `
`).replace(NORMALIZE_NULL_AND_REPLACEMENT_REGEX, "");
}
function checkForUnmatchedText(serverText, clientText) {
  clientText = normalizeMarkupForTextOrAttribute(clientText);
  return normalizeMarkupForTextOrAttribute(serverText) === clientText ? true : false;
}
function setProp(domElement, tag, key, value, props, prevValue) {
  switch (key) {
    case "children":
      typeof value === "string" ? tag === "body" || tag === "textarea" && value === "" || setTextContent(domElement, value) : (typeof value === "number" || typeof value === "bigint") && tag !== "body" && setTextContent(domElement, "" + value);
      break;
    case "className":
      setValueForKnownAttribute(domElement, "class", value);
      break;
    case "tabIndex":
      setValueForKnownAttribute(domElement, "tabindex", value);
      break;
    case "dir":
    case "role":
    case "viewBox":
    case "width":
    case "height":
      setValueForKnownAttribute(domElement, key, value);
      break;
    case "style":
      setValueForStyles(domElement, value, prevValue);
      break;
    case "data":
      if (tag !== "object") {
        setValueForKnownAttribute(domElement, "data", value);
        break;
      }
    case "src":
    case "href":
      if (value === "" && (tag !== "a" || key !== "href")) {
        domElement.removeAttribute(key);
        break;
      }
      if (value == null || typeof value === "function" || typeof value === "symbol" || typeof value === "boolean") {
        domElement.removeAttribute(key);
        break;
      }
      value = sanitizeURL("" + value);
      domElement.setAttribute(key, value);
      break;
    case "action":
    case "formAction":
      if (typeof value === "function") {
        domElement.setAttribute(key, "javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')");
        break;
      } else
        typeof prevValue === "function" && (key === "formAction" ? (tag !== "input" && setProp(domElement, tag, "name", props.name, props, null), setProp(domElement, tag, "formEncType", props.formEncType, props, null), setProp(domElement, tag, "formMethod", props.formMethod, props, null), setProp(domElement, tag, "formTarget", props.formTarget, props, null)) : (setProp(domElement, tag, "encType", props.encType, props, null), setProp(domElement, tag, "method", props.method, props, null), setProp(domElement, tag, "target", props.target, props, null)));
      if (value == null || typeof value === "symbol" || typeof value === "boolean") {
        domElement.removeAttribute(key);
        break;
      }
      value = sanitizeURL("" + value);
      domElement.setAttribute(key, value);
      break;
    case "onClick":
      value != null && (domElement.onclick = noop$1);
      break;
    case "onScroll":
      value != null && listenToNonDelegatedEvent("scroll", domElement);
      break;
    case "onScrollEnd":
      value != null && listenToNonDelegatedEvent("scrollend", domElement);
      break;
    case "dangerouslySetInnerHTML":
      if (value != null) {
        if (typeof value !== "object" || !("__html" in value))
          throw Error(formatProdErrorMessage(61));
        key = value.__html;
        if (key != null) {
          if (props.children != null)
            throw Error(formatProdErrorMessage(60));
          domElement.innerHTML = key;
        }
      }
      break;
    case "multiple":
      domElement.multiple = value && typeof value !== "function" && typeof value !== "symbol";
      break;
    case "muted":
      domElement.muted = value && typeof value !== "function" && typeof value !== "symbol";
      break;
    case "suppressContentEditableWarning":
    case "suppressHydrationWarning":
    case "defaultValue":
    case "defaultChecked":
    case "innerHTML":
    case "ref":
      break;
    case "autoFocus":
      break;
    case "xlinkHref":
      if (value == null || typeof value === "function" || typeof value === "boolean" || typeof value === "symbol") {
        domElement.removeAttribute("xlink:href");
        break;
      }
      key = sanitizeURL("" + value);
      domElement.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", key);
      break;
    case "contentEditable":
    case "spellCheck":
    case "draggable":
    case "value":
    case "autoReverse":
    case "externalResourcesRequired":
    case "focusable":
    case "preserveAlpha":
      value != null && typeof value !== "function" && typeof value !== "symbol" ? domElement.setAttribute(key, "" + value) : domElement.removeAttribute(key);
      break;
    case "inert":
    case "allowFullScreen":
    case "async":
    case "autoPlay":
    case "controls":
    case "default":
    case "defer":
    case "disabled":
    case "disablePictureInPicture":
    case "disableRemotePlayback":
    case "formNoValidate":
    case "hidden":
    case "loop":
    case "noModule":
    case "noValidate":
    case "open":
    case "playsInline":
    case "readOnly":
    case "required":
    case "reversed":
    case "scoped":
    case "seamless":
    case "itemScope":
      value && typeof value !== "function" && typeof value !== "symbol" ? domElement.setAttribute(key, "") : domElement.removeAttribute(key);
      break;
    case "capture":
    case "download":
      value === true ? domElement.setAttribute(key, "") : value !== false && value != null && typeof value !== "function" && typeof value !== "symbol" ? domElement.setAttribute(key, value) : domElement.removeAttribute(key);
      break;
    case "cols":
    case "rows":
    case "size":
    case "span":
      value != null && typeof value !== "function" && typeof value !== "symbol" && !isNaN(value) && 1 <= value ? domElement.setAttribute(key, value) : domElement.removeAttribute(key);
      break;
    case "rowSpan":
    case "start":
      value == null || typeof value === "function" || typeof value === "symbol" || isNaN(value) ? domElement.removeAttribute(key) : domElement.setAttribute(key, value);
      break;
    case "popover":
      listenToNonDelegatedEvent("beforetoggle", domElement);
      listenToNonDelegatedEvent("toggle", domElement);
      setValueForAttribute(domElement, "popover", value);
      break;
    case "xlinkActuate":
      setValueForNamespacedAttribute(domElement, "http://www.w3.org/1999/xlink", "xlink:actuate", value);
      break;
    case "xlinkArcrole":
      setValueForNamespacedAttribute(domElement, "http://www.w3.org/1999/xlink", "xlink:arcrole", value);
      break;
    case "xlinkRole":
      setValueForNamespacedAttribute(domElement, "http://www.w3.org/1999/xlink", "xlink:role", value);
      break;
    case "xlinkShow":
      setValueForNamespacedAttribute(domElement, "http://www.w3.org/1999/xlink", "xlink:show", value);
      break;
    case "xlinkTitle":
      setValueForNamespacedAttribute(domElement, "http://www.w3.org/1999/xlink", "xlink:title", value);
      break;
    case "xlinkType":
      setValueForNamespacedAttribute(domElement, "http://www.w3.org/1999/xlink", "xlink:type", value);
      break;
    case "xmlBase":
      setValueForNamespacedAttribute(domElement, "http://www.w3.org/XML/1998/namespace", "xml:base", value);
      break;
    case "xmlLang":
      setValueForNamespacedAttribute(domElement, "http://www.w3.org/XML/1998/namespace", "xml:lang", value);
      break;
    case "xmlSpace":
      setValueForNamespacedAttribute(domElement, "http://www.w3.org/XML/1998/namespace", "xml:space", value);
      break;
    case "is":
      setValueForAttribute(domElement, "is", value);
      break;
    case "innerText":
    case "textContent":
      break;
    default:
      if (!(2 < key.length) || key[0] !== "o" && key[0] !== "O" || key[1] !== "n" && key[1] !== "N")
        key = aliases.get(key) || key, setValueForAttribute(domElement, key, value);
  }
}
function setPropOnCustomElement(domElement, tag, key, value, props, prevValue) {
  switch (key) {
    case "style":
      setValueForStyles(domElement, value, prevValue);
      break;
    case "dangerouslySetInnerHTML":
      if (value != null) {
        if (typeof value !== "object" || !("__html" in value))
          throw Error(formatProdErrorMessage(61));
        key = value.__html;
        if (key != null) {
          if (props.children != null)
            throw Error(formatProdErrorMessage(60));
          domElement.innerHTML = key;
        }
      }
      break;
    case "children":
      typeof value === "string" ? setTextContent(domElement, value) : (typeof value === "number" || typeof value === "bigint") && setTextContent(domElement, "" + value);
      break;
    case "onScroll":
      value != null && listenToNonDelegatedEvent("scroll", domElement);
      break;
    case "onScrollEnd":
      value != null && listenToNonDelegatedEvent("scrollend", domElement);
      break;
    case "onClick":
      value != null && (domElement.onclick = noop$1);
      break;
    case "suppressContentEditableWarning":
    case "suppressHydrationWarning":
    case "innerHTML":
    case "ref":
      break;
    case "innerText":
    case "textContent":
      break;
    default:
      if (!registrationNameDependencies.hasOwnProperty(key))
        a: {
          if (key[0] === "o" && key[1] === "n" && (props = key.endsWith("Capture"), tag = key.slice(2, props ? key.length - 7 : undefined), prevValue = domElement[internalPropsKey] || null, prevValue = prevValue != null ? prevValue[key] : null, typeof prevValue === "function" && domElement.removeEventListener(tag, prevValue, props), typeof value === "function")) {
            typeof prevValue !== "function" && prevValue !== null && (key in domElement ? domElement[key] = null : domElement.hasAttribute(key) && domElement.removeAttribute(key));
            domElement.addEventListener(tag, value, props);
            break a;
          }
          key in domElement ? domElement[key] = value : value === true ? domElement.setAttribute(key, "") : setValueForAttribute(domElement, key, value);
        }
  }
}
function setInitialProperties(domElement, tag, props) {
  switch (tag) {
    case "div":
    case "span":
    case "svg":
    case "path":
    case "a":
    case "g":
    case "p":
    case "li":
      break;
    case "img":
      listenToNonDelegatedEvent("error", domElement);
      listenToNonDelegatedEvent("load", domElement);
      var hasSrc = false, hasSrcSet = false, propKey;
      for (propKey in props)
        if (props.hasOwnProperty(propKey)) {
          var propValue = props[propKey];
          if (propValue != null)
            switch (propKey) {
              case "src":
                hasSrc = true;
                break;
              case "srcSet":
                hasSrcSet = true;
                break;
              case "children":
              case "dangerouslySetInnerHTML":
                throw Error(formatProdErrorMessage(137, tag));
              default:
                setProp(domElement, tag, propKey, propValue, props, null);
            }
        }
      hasSrcSet && setProp(domElement, tag, "srcSet", props.srcSet, props, null);
      hasSrc && setProp(domElement, tag, "src", props.src, props, null);
      return;
    case "input":
      listenToNonDelegatedEvent("invalid", domElement);
      var defaultValue = propKey = propValue = hasSrcSet = null, checked = null, defaultChecked = null;
      for (hasSrc in props)
        if (props.hasOwnProperty(hasSrc)) {
          var propValue$227 = props[hasSrc];
          if (propValue$227 != null)
            switch (hasSrc) {
              case "name":
                hasSrcSet = propValue$227;
                break;
              case "type":
                propValue = propValue$227;
                break;
              case "checked":
                checked = propValue$227;
                break;
              case "defaultChecked":
                defaultChecked = propValue$227;
                break;
              case "value":
                propKey = propValue$227;
                break;
              case "defaultValue":
                defaultValue = propValue$227;
                break;
              case "children":
              case "dangerouslySetInnerHTML":
                if (propValue$227 != null)
                  throw Error(formatProdErrorMessage(137, tag));
                break;
              default:
                setProp(domElement, tag, hasSrc, propValue$227, props, null);
            }
        }
      initInput(domElement, propKey, defaultValue, checked, defaultChecked, propValue, hasSrcSet, false);
      return;
    case "select":
      listenToNonDelegatedEvent("invalid", domElement);
      hasSrc = propValue = propKey = null;
      for (hasSrcSet in props)
        if (props.hasOwnProperty(hasSrcSet) && (defaultValue = props[hasSrcSet], defaultValue != null))
          switch (hasSrcSet) {
            case "value":
              propKey = defaultValue;
              break;
            case "defaultValue":
              propValue = defaultValue;
              break;
            case "multiple":
              hasSrc = defaultValue;
            default:
              setProp(domElement, tag, hasSrcSet, defaultValue, props, null);
          }
      tag = propKey;
      props = propValue;
      domElement.multiple = !!hasSrc;
      tag != null ? updateOptions(domElement, !!hasSrc, tag, false) : props != null && updateOptions(domElement, !!hasSrc, props, true);
      return;
    case "textarea":
      listenToNonDelegatedEvent("invalid", domElement);
      propKey = hasSrcSet = hasSrc = null;
      for (propValue in props)
        if (props.hasOwnProperty(propValue) && (defaultValue = props[propValue], defaultValue != null))
          switch (propValue) {
            case "value":
              hasSrc = defaultValue;
              break;
            case "defaultValue":
              hasSrcSet = defaultValue;
              break;
            case "children":
              propKey = defaultValue;
              break;
            case "dangerouslySetInnerHTML":
              if (defaultValue != null)
                throw Error(formatProdErrorMessage(91));
              break;
            default:
              setProp(domElement, tag, propValue, defaultValue, props, null);
          }
      initTextarea(domElement, hasSrc, hasSrcSet, propKey);
      return;
    case "option":
      for (checked in props)
        if (props.hasOwnProperty(checked) && (hasSrc = props[checked], hasSrc != null))
          switch (checked) {
            case "selected":
              domElement.selected = hasSrc && typeof hasSrc !== "function" && typeof hasSrc !== "symbol";
              break;
            default:
              setProp(domElement, tag, checked, hasSrc, props, null);
          }
      return;
    case "dialog":
      listenToNonDelegatedEvent("beforetoggle", domElement);
      listenToNonDelegatedEvent("toggle", domElement);
      listenToNonDelegatedEvent("cancel", domElement);
      listenToNonDelegatedEvent("close", domElement);
      break;
    case "iframe":
    case "object":
      listenToNonDelegatedEvent("load", domElement);
      break;
    case "video":
    case "audio":
      for (hasSrc = 0;hasSrc < mediaEventTypes.length; hasSrc++)
        listenToNonDelegatedEvent(mediaEventTypes[hasSrc], domElement);
      break;
    case "image":
      listenToNonDelegatedEvent("error", domElement);
      listenToNonDelegatedEvent("load", domElement);
      break;
    case "details":
      listenToNonDelegatedEvent("toggle", domElement);
      break;
    case "embed":
    case "source":
    case "link":
      listenToNonDelegatedEvent("error", domElement), listenToNonDelegatedEvent("load", domElement);
    case "area":
    case "base":
    case "br":
    case "col":
    case "hr":
    case "keygen":
    case "meta":
    case "param":
    case "track":
    case "wbr":
    case "menuitem":
      for (defaultChecked in props)
        if (props.hasOwnProperty(defaultChecked) && (hasSrc = props[defaultChecked], hasSrc != null))
          switch (defaultChecked) {
            case "children":
            case "dangerouslySetInnerHTML":
              throw Error(formatProdErrorMessage(137, tag));
            default:
              setProp(domElement, tag, defaultChecked, hasSrc, props, null);
          }
      return;
    default:
      if (isCustomElement(tag)) {
        for (propValue$227 in props)
          props.hasOwnProperty(propValue$227) && (hasSrc = props[propValue$227], hasSrc !== undefined && setPropOnCustomElement(domElement, tag, propValue$227, hasSrc, props, undefined));
        return;
      }
  }
  for (defaultValue in props)
    props.hasOwnProperty(defaultValue) && (hasSrc = props[defaultValue], hasSrc != null && setProp(domElement, tag, defaultValue, hasSrc, props, null));
}
function updateProperties(domElement, tag, lastProps, nextProps) {
  switch (tag) {
    case "div":
    case "span":
    case "svg":
    case "path":
    case "a":
    case "g":
    case "p":
    case "li":
      break;
    case "input":
      var name = null, type = null, value = null, defaultValue = null, lastDefaultValue = null, checked = null, defaultChecked = null;
      for (propKey in lastProps) {
        var lastProp = lastProps[propKey];
        if (lastProps.hasOwnProperty(propKey) && lastProp != null)
          switch (propKey) {
            case "checked":
              break;
            case "value":
              break;
            case "defaultValue":
              lastDefaultValue = lastProp;
            default:
              nextProps.hasOwnProperty(propKey) || setProp(domElement, tag, propKey, null, nextProps, lastProp);
          }
      }
      for (var propKey$244 in nextProps) {
        var propKey = nextProps[propKey$244];
        lastProp = lastProps[propKey$244];
        if (nextProps.hasOwnProperty(propKey$244) && (propKey != null || lastProp != null))
          switch (propKey$244) {
            case "type":
              type = propKey;
              break;
            case "name":
              name = propKey;
              break;
            case "checked":
              checked = propKey;
              break;
            case "defaultChecked":
              defaultChecked = propKey;
              break;
            case "value":
              value = propKey;
              break;
            case "defaultValue":
              defaultValue = propKey;
              break;
            case "children":
            case "dangerouslySetInnerHTML":
              if (propKey != null)
                throw Error(formatProdErrorMessage(137, tag));
              break;
            default:
              propKey !== lastProp && setProp(domElement, tag, propKey$244, propKey, nextProps, lastProp);
          }
      }
      updateInput(domElement, value, defaultValue, lastDefaultValue, checked, defaultChecked, type, name);
      return;
    case "select":
      propKey = value = defaultValue = propKey$244 = null;
      for (type in lastProps)
        if (lastDefaultValue = lastProps[type], lastProps.hasOwnProperty(type) && lastDefaultValue != null)
          switch (type) {
            case "value":
              break;
            case "multiple":
              propKey = lastDefaultValue;
            default:
              nextProps.hasOwnProperty(type) || setProp(domElement, tag, type, null, nextProps, lastDefaultValue);
          }
      for (name in nextProps)
        if (type = nextProps[name], lastDefaultValue = lastProps[name], nextProps.hasOwnProperty(name) && (type != null || lastDefaultValue != null))
          switch (name) {
            case "value":
              propKey$244 = type;
              break;
            case "defaultValue":
              defaultValue = type;
              break;
            case "multiple":
              value = type;
            default:
              type !== lastDefaultValue && setProp(domElement, tag, name, type, nextProps, lastDefaultValue);
          }
      tag = defaultValue;
      lastProps = value;
      nextProps = propKey;
      propKey$244 != null ? updateOptions(domElement, !!lastProps, propKey$244, false) : !!nextProps !== !!lastProps && (tag != null ? updateOptions(domElement, !!lastProps, tag, true) : updateOptions(domElement, !!lastProps, lastProps ? [] : "", false));
      return;
    case "textarea":
      propKey = propKey$244 = null;
      for (defaultValue in lastProps)
        if (name = lastProps[defaultValue], lastProps.hasOwnProperty(defaultValue) && name != null && !nextProps.hasOwnProperty(defaultValue))
          switch (defaultValue) {
            case "value":
              break;
            case "children":
              break;
            default:
              setProp(domElement, tag, defaultValue, null, nextProps, name);
          }
      for (value in nextProps)
        if (name = nextProps[value], type = lastProps[value], nextProps.hasOwnProperty(value) && (name != null || type != null))
          switch (value) {
            case "value":
              propKey$244 = name;
              break;
            case "defaultValue":
              propKey = name;
              break;
            case "children":
              break;
            case "dangerouslySetInnerHTML":
              if (name != null)
                throw Error(formatProdErrorMessage(91));
              break;
            default:
              name !== type && setProp(domElement, tag, value, name, nextProps, type);
          }
      updateTextarea(domElement, propKey$244, propKey);
      return;
    case "option":
      for (var propKey$260 in lastProps)
        if (propKey$244 = lastProps[propKey$260], lastProps.hasOwnProperty(propKey$260) && propKey$244 != null && !nextProps.hasOwnProperty(propKey$260))
          switch (propKey$260) {
            case "selected":
              domElement.selected = false;
              break;
            default:
              setProp(domElement, tag, propKey$260, null, nextProps, propKey$244);
          }
      for (lastDefaultValue in nextProps)
        if (propKey$244 = nextProps[lastDefaultValue], propKey = lastProps[lastDefaultValue], nextProps.hasOwnProperty(lastDefaultValue) && propKey$244 !== propKey && (propKey$244 != null || propKey != null))
          switch (lastDefaultValue) {
            case "selected":
              domElement.selected = propKey$244 && typeof propKey$244 !== "function" && typeof propKey$244 !== "symbol";
              break;
            default:
              setProp(domElement, tag, lastDefaultValue, propKey$244, nextProps, propKey);
          }
      return;
    case "img":
    case "link":
    case "area":
    case "base":
    case "br":
    case "col":
    case "embed":
    case "hr":
    case "keygen":
    case "meta":
    case "param":
    case "source":
    case "track":
    case "wbr":
    case "menuitem":
      for (var propKey$265 in lastProps)
        propKey$244 = lastProps[propKey$265], lastProps.hasOwnProperty(propKey$265) && propKey$244 != null && !nextProps.hasOwnProperty(propKey$265) && setProp(domElement, tag, propKey$265, null, nextProps, propKey$244);
      for (checked in nextProps)
        if (propKey$244 = nextProps[checked], propKey = lastProps[checked], nextProps.hasOwnProperty(checked) && propKey$244 !== propKey && (propKey$244 != null || propKey != null))
          switch (checked) {
            case "children":
            case "dangerouslySetInnerHTML":
              if (propKey$244 != null)
                throw Error(formatProdErrorMessage(137, tag));
              break;
            default:
              setProp(domElement, tag, checked, propKey$244, nextProps, propKey);
          }
      return;
    default:
      if (isCustomElement(tag)) {
        for (var propKey$270 in lastProps)
          propKey$244 = lastProps[propKey$270], lastProps.hasOwnProperty(propKey$270) && propKey$244 !== undefined && !nextProps.hasOwnProperty(propKey$270) && setPropOnCustomElement(domElement, tag, propKey$270, undefined, nextProps, propKey$244);
        for (defaultChecked in nextProps)
          propKey$244 = nextProps[defaultChecked], propKey = lastProps[defaultChecked], !nextProps.hasOwnProperty(defaultChecked) || propKey$244 === propKey || propKey$244 === undefined && propKey === undefined || setPropOnCustomElement(domElement, tag, defaultChecked, propKey$244, nextProps, propKey);
        return;
      }
  }
  for (var propKey$275 in lastProps)
    propKey$244 = lastProps[propKey$275], lastProps.hasOwnProperty(propKey$275) && propKey$244 != null && !nextProps.hasOwnProperty(propKey$275) && setProp(domElement, tag, propKey$275, null, nextProps, propKey$244);
  for (lastProp in nextProps)
    propKey$244 = nextProps[lastProp], propKey = lastProps[lastProp], !nextProps.hasOwnProperty(lastProp) || propKey$244 === propKey || propKey$244 == null && propKey == null || setProp(domElement, tag, lastProp, propKey$244, nextProps, propKey);
}
function isLikelyStaticResource(initiatorType) {
  switch (initiatorType) {
    case "css":
    case "script":
    case "font":
    case "img":
    case "image":
    case "input":
    case "link":
      return true;
    default:
      return false;
  }
}
function estimateBandwidth() {
  if (typeof performance.getEntriesByType === "function") {
    for (var count = 0, bits = 0, resourceEntries = performance.getEntriesByType("resource"), i = 0;i < resourceEntries.length; i++) {
      var entry = resourceEntries[i], transferSize = entry.transferSize, initiatorType = entry.initiatorType, duration = entry.duration;
      if (transferSize && duration && isLikelyStaticResource(initiatorType)) {
        initiatorType = 0;
        duration = entry.responseEnd;
        for (i += 1;i < resourceEntries.length; i++) {
          var overlapEntry = resourceEntries[i], overlapStartTime = overlapEntry.startTime;
          if (overlapStartTime > duration)
            break;
          var { transferSize: overlapTransferSize, initiatorType: overlapInitiatorType } = overlapEntry;
          overlapTransferSize && isLikelyStaticResource(overlapInitiatorType) && (overlapEntry = overlapEntry.responseEnd, initiatorType += overlapTransferSize * (overlapEntry < duration ? 1 : (duration - overlapStartTime) / (overlapEntry - overlapStartTime)));
        }
        --i;
        bits += 8 * (transferSize + initiatorType) / (entry.duration / 1000);
        count++;
        if (10 < count)
          break;
      }
    }
    if (0 < count)
      return bits / count / 1e6;
  }
  return navigator.connection && (count = navigator.connection.downlink, typeof count === "number") ? count : 5;
}
function getOwnerDocumentFromRootContainer(rootContainerElement) {
  return rootContainerElement.nodeType === 9 ? rootContainerElement : rootContainerElement.ownerDocument;
}
function getOwnHostContext(namespaceURI) {
  switch (namespaceURI) {
    case "http://www.w3.org/2000/svg":
      return 1;
    case "http://www.w3.org/1998/Math/MathML":
      return 2;
    default:
      return 0;
  }
}
function getChildHostContextProd(parentNamespace, type) {
  if (parentNamespace === 0)
    switch (type) {
      case "svg":
        return 1;
      case "math":
        return 2;
      default:
        return 0;
    }
  return parentNamespace === 1 && type === "foreignObject" ? 0 : parentNamespace;
}
function shouldSetTextContent(type, props) {
  return type === "textarea" || type === "noscript" || typeof props.children === "string" || typeof props.children === "number" || typeof props.children === "bigint" || typeof props.dangerouslySetInnerHTML === "object" && props.dangerouslySetInnerHTML !== null && props.dangerouslySetInnerHTML.__html != null;
}
function shouldAttemptEagerTransition() {
  var event = window.event;
  if (event && event.type === "popstate") {
    if (event === currentPopstateTransitionEvent)
      return false;
    currentPopstateTransitionEvent = event;
    return true;
  }
  currentPopstateTransitionEvent = null;
  return false;
}
function resolveEventType() {
  var event = window.event;
  return event && event !== schedulerEvent ? event.type : null;
}
function resolveEventTimeStamp() {
  var event = window.event;
  return event && event !== schedulerEvent ? event.timeStamp : -1.1;
}
function handleErrorInNextTick(error) {
  setTimeout(function() {
    throw error;
  });
}
function isSingletonScope(type) {
  return type === "head";
}
function clearHydrationBoundary(parentInstance, hydrationInstance) {
  var node = hydrationInstance, depth = 0;
  do {
    var nextNode = node.nextSibling;
    parentInstance.removeChild(node);
    if (nextNode && nextNode.nodeType === 8)
      if (node = nextNode.data, node === "/$" || node === "/&") {
        if (depth === 0) {
          parentInstance.removeChild(nextNode);
          retryIfBlockedOn(hydrationInstance);
          return;
        }
        depth--;
      } else if (node === "$" || node === "$?" || node === "$~" || node === "$!" || node === "&")
        depth++;
      else if (node === "html")
        releaseSingletonInstance(parentInstance.ownerDocument.documentElement);
      else if (node === "head") {
        node = parentInstance.ownerDocument.head;
        releaseSingletonInstance(node);
        for (var node$jscomp$0 = node.firstChild;node$jscomp$0; ) {
          var { nextSibling: nextNode$jscomp$0, nodeName } = node$jscomp$0;
          node$jscomp$0[internalHoistableMarker] || nodeName === "SCRIPT" || nodeName === "STYLE" || nodeName === "LINK" && node$jscomp$0.rel.toLowerCase() === "stylesheet" || node.removeChild(node$jscomp$0);
          node$jscomp$0 = nextNode$jscomp$0;
        }
      } else
        node === "body" && releaseSingletonInstance(parentInstance.ownerDocument.body);
    node = nextNode;
  } while (node);
  retryIfBlockedOn(hydrationInstance);
}
function hideOrUnhideDehydratedBoundary(suspenseInstance, isHidden) {
  var node = suspenseInstance;
  suspenseInstance = 0;
  do {
    var nextNode = node.nextSibling;
    node.nodeType === 1 ? isHidden ? (node._stashedDisplay = node.style.display, node.style.display = "none") : (node.style.display = node._stashedDisplay || "", node.getAttribute("style") === "" && node.removeAttribute("style")) : node.nodeType === 3 && (isHidden ? (node._stashedText = node.nodeValue, node.nodeValue = "") : node.nodeValue = node._stashedText || "");
    if (nextNode && nextNode.nodeType === 8)
      if (node = nextNode.data, node === "/$")
        if (suspenseInstance === 0)
          break;
        else
          suspenseInstance--;
      else
        node !== "$" && node !== "$?" && node !== "$~" && node !== "$!" || suspenseInstance++;
    node = nextNode;
  } while (node);
}
function clearContainerSparingly(container) {
  var nextNode = container.firstChild;
  nextNode && nextNode.nodeType === 10 && (nextNode = nextNode.nextSibling);
  for (;nextNode; ) {
    var node = nextNode;
    nextNode = nextNode.nextSibling;
    switch (node.nodeName) {
      case "HTML":
      case "HEAD":
      case "BODY":
        clearContainerSparingly(node);
        detachDeletedInstance(node);
        continue;
      case "SCRIPT":
      case "STYLE":
        continue;
      case "LINK":
        if (node.rel.toLowerCase() === "stylesheet")
          continue;
    }
    container.removeChild(node);
  }
}
function canHydrateInstance(instance, type, props, inRootOrSingleton) {
  for (;instance.nodeType === 1; ) {
    var anyProps = props;
    if (instance.nodeName.toLowerCase() !== type.toLowerCase()) {
      if (!inRootOrSingleton && (instance.nodeName !== "INPUT" || instance.type !== "hidden"))
        break;
    } else if (!inRootOrSingleton)
      if (type === "input" && instance.type === "hidden") {
        var name = anyProps.name == null ? null : "" + anyProps.name;
        if (anyProps.type === "hidden" && instance.getAttribute("name") === name)
          return instance;
      } else
        return instance;
    else if (!instance[internalHoistableMarker])
      switch (type) {
        case "meta":
          if (!instance.hasAttribute("itemprop"))
            break;
          return instance;
        case "link":
          name = instance.getAttribute("rel");
          if (name === "stylesheet" && instance.hasAttribute("data-precedence"))
            break;
          else if (name !== anyProps.rel || instance.getAttribute("href") !== (anyProps.href == null || anyProps.href === "" ? null : anyProps.href) || instance.getAttribute("crossorigin") !== (anyProps.crossOrigin == null ? null : anyProps.crossOrigin) || instance.getAttribute("title") !== (anyProps.title == null ? null : anyProps.title))
            break;
          return instance;
        case "style":
          if (instance.hasAttribute("data-precedence"))
            break;
          return instance;
        case "script":
          name = instance.getAttribute("src");
          if ((name !== (anyProps.src == null ? null : anyProps.src) || instance.getAttribute("type") !== (anyProps.type == null ? null : anyProps.type) || instance.getAttribute("crossorigin") !== (anyProps.crossOrigin == null ? null : anyProps.crossOrigin)) && name && instance.hasAttribute("async") && !instance.hasAttribute("itemprop"))
            break;
          return instance;
        default:
          return instance;
      }
    instance = getNextHydratable(instance.nextSibling);
    if (instance === null)
      break;
  }
  return null;
}
function canHydrateTextInstance(instance, text, inRootOrSingleton) {
  if (text === "")
    return null;
  for (;instance.nodeType !== 3; ) {
    if ((instance.nodeType !== 1 || instance.nodeName !== "INPUT" || instance.type !== "hidden") && !inRootOrSingleton)
      return null;
    instance = getNextHydratable(instance.nextSibling);
    if (instance === null)
      return null;
  }
  return instance;
}
function canHydrateHydrationBoundary(instance, inRootOrSingleton) {
  for (;instance.nodeType !== 8; ) {
    if ((instance.nodeType !== 1 || instance.nodeName !== "INPUT" || instance.type !== "hidden") && !inRootOrSingleton)
      return null;
    instance = getNextHydratable(instance.nextSibling);
    if (instance === null)
      return null;
  }
  return instance;
}
function isSuspenseInstancePending(instance) {
  return instance.data === "$?" || instance.data === "$~";
}
function isSuspenseInstanceFallback(instance) {
  return instance.data === "$!" || instance.data === "$?" && instance.ownerDocument.readyState !== "loading";
}
function registerSuspenseInstanceRetry(instance, callback) {
  var ownerDocument = instance.ownerDocument;
  if (instance.data === "$~")
    instance._reactRetry = callback;
  else if (instance.data !== "$?" || ownerDocument.readyState !== "loading")
    callback();
  else {
    var listener = function() {
      callback();
      ownerDocument.removeEventListener("DOMContentLoaded", listener);
    };
    ownerDocument.addEventListener("DOMContentLoaded", listener);
    instance._reactRetry = listener;
  }
}
function getNextHydratable(node) {
  for (;node != null; node = node.nextSibling) {
    var nodeType = node.nodeType;
    if (nodeType === 1 || nodeType === 3)
      break;
    if (nodeType === 8) {
      nodeType = node.data;
      if (nodeType === "$" || nodeType === "$!" || nodeType === "$?" || nodeType === "$~" || nodeType === "&" || nodeType === "F!" || nodeType === "F")
        break;
      if (nodeType === "/$" || nodeType === "/&")
        return null;
    }
  }
  return node;
}
function getNextHydratableInstanceAfterHydrationBoundary(hydrationInstance) {
  hydrationInstance = hydrationInstance.nextSibling;
  for (var depth = 0;hydrationInstance; ) {
    if (hydrationInstance.nodeType === 8) {
      var data = hydrationInstance.data;
      if (data === "/$" || data === "/&") {
        if (depth === 0)
          return getNextHydratable(hydrationInstance.nextSibling);
        depth--;
      } else
        data !== "$" && data !== "$!" && data !== "$?" && data !== "$~" && data !== "&" || depth++;
    }
    hydrationInstance = hydrationInstance.nextSibling;
  }
  return null;
}
function getParentHydrationBoundary(targetInstance) {
  targetInstance = targetInstance.previousSibling;
  for (var depth = 0;targetInstance; ) {
    if (targetInstance.nodeType === 8) {
      var data = targetInstance.data;
      if (data === "$" || data === "$!" || data === "$?" || data === "$~" || data === "&") {
        if (depth === 0)
          return targetInstance;
        depth--;
      } else
        data !== "/$" && data !== "/&" || depth++;
    }
    targetInstance = targetInstance.previousSibling;
  }
  return null;
}
function resolveSingletonInstance(type, props, rootContainerInstance) {
  props = getOwnerDocumentFromRootContainer(rootContainerInstance);
  switch (type) {
    case "html":
      type = props.documentElement;
      if (!type)
        throw Error(formatProdErrorMessage(452));
      return type;
    case "head":
      type = props.head;
      if (!type)
        throw Error(formatProdErrorMessage(453));
      return type;
    case "body":
      type = props.body;
      if (!type)
        throw Error(formatProdErrorMessage(454));
      return type;
    default:
      throw Error(formatProdErrorMessage(451));
  }
}
function releaseSingletonInstance(instance) {
  for (var attributes = instance.attributes;attributes.length; )
    instance.removeAttributeNode(attributes[0]);
  detachDeletedInstance(instance);
}
function getHoistableRoot(container) {
  return typeof container.getRootNode === "function" ? container.getRootNode() : container.nodeType === 9 ? container : container.ownerDocument;
}
function flushSyncWork() {
  var previousWasRendering = previousDispatcher.f(), wasRendering = flushSyncWork$1();
  return previousWasRendering || wasRendering;
}
function requestFormReset$1(form) {
  var formInst = getInstanceFromNode(form);
  formInst !== null && formInst.tag === 5 && formInst.type === "form" ? requestFormReset$2(formInst) : previousDispatcher.r(form);
}
function preconnectAs(rel, href, crossOrigin) {
  var ownerDocument = globalDocument;
  if (ownerDocument && typeof href === "string" && href) {
    var limitedEscapedHref = escapeSelectorAttributeValueInsideDoubleQuotes(href);
    limitedEscapedHref = 'link[rel="' + rel + '"][href="' + limitedEscapedHref + '"]';
    typeof crossOrigin === "string" && (limitedEscapedHref += '[crossorigin="' + crossOrigin + '"]');
    preconnectsSet.has(limitedEscapedHref) || (preconnectsSet.add(limitedEscapedHref), rel = { rel, crossOrigin, href }, ownerDocument.querySelector(limitedEscapedHref) === null && (href = ownerDocument.createElement("link"), setInitialProperties(href, "link", rel), markNodeAsHoistable(href), ownerDocument.head.appendChild(href)));
  }
}
function prefetchDNS$1(href) {
  previousDispatcher.D(href);
  preconnectAs("dns-prefetch", href, null);
}
function preconnect$1(href, crossOrigin) {
  previousDispatcher.C(href, crossOrigin);
  preconnectAs("preconnect", href, crossOrigin);
}
function preload$1(href, as, options2) {
  previousDispatcher.L(href, as, options2);
  var ownerDocument = globalDocument;
  if (ownerDocument && href && as) {
    var preloadSelector = 'link[rel="preload"][as="' + escapeSelectorAttributeValueInsideDoubleQuotes(as) + '"]';
    as === "image" ? options2 && options2.imageSrcSet ? (preloadSelector += '[imagesrcset="' + escapeSelectorAttributeValueInsideDoubleQuotes(options2.imageSrcSet) + '"]', typeof options2.imageSizes === "string" && (preloadSelector += '[imagesizes="' + escapeSelectorAttributeValueInsideDoubleQuotes(options2.imageSizes) + '"]')) : preloadSelector += '[href="' + escapeSelectorAttributeValueInsideDoubleQuotes(href) + '"]' : preloadSelector += '[href="' + escapeSelectorAttributeValueInsideDoubleQuotes(href) + '"]';
    var key = preloadSelector;
    switch (as) {
      case "style":
        key = getStyleKey(href);
        break;
      case "script":
        key = getScriptKey(href);
    }
    preloadPropsMap.has(key) || (href = assign({
      rel: "preload",
      href: as === "image" && options2 && options2.imageSrcSet ? undefined : href,
      as
    }, options2), preloadPropsMap.set(key, href), ownerDocument.querySelector(preloadSelector) !== null || as === "style" && ownerDocument.querySelector(getStylesheetSelectorFromKey(key)) || as === "script" && ownerDocument.querySelector(getScriptSelectorFromKey(key)) || (as = ownerDocument.createElement("link"), setInitialProperties(as, "link", href), markNodeAsHoistable(as), ownerDocument.head.appendChild(as)));
  }
}
function preloadModule$1(href, options2) {
  previousDispatcher.m(href, options2);
  var ownerDocument = globalDocument;
  if (ownerDocument && href) {
    var as = options2 && typeof options2.as === "string" ? options2.as : "script", preloadSelector = 'link[rel="modulepreload"][as="' + escapeSelectorAttributeValueInsideDoubleQuotes(as) + '"][href="' + escapeSelectorAttributeValueInsideDoubleQuotes(href) + '"]', key = preloadSelector;
    switch (as) {
      case "audioworklet":
      case "paintworklet":
      case "serviceworker":
      case "sharedworker":
      case "worker":
      case "script":
        key = getScriptKey(href);
    }
    if (!preloadPropsMap.has(key) && (href = assign({ rel: "modulepreload", href }, options2), preloadPropsMap.set(key, href), ownerDocument.querySelector(preloadSelector) === null)) {
      switch (as) {
        case "audioworklet":
        case "paintworklet":
        case "serviceworker":
        case "sharedworker":
        case "worker":
        case "script":
          if (ownerDocument.querySelector(getScriptSelectorFromKey(key)))
            return;
      }
      as = ownerDocument.createElement("link");
      setInitialProperties(as, "link", href);
      markNodeAsHoistable(as);
      ownerDocument.head.appendChild(as);
    }
  }
}
function preinitStyle(href, precedence, options2) {
  previousDispatcher.S(href, precedence, options2);
  var ownerDocument = globalDocument;
  if (ownerDocument && href) {
    var styles = getResourcesFromRoot(ownerDocument).hoistableStyles, key = getStyleKey(href);
    precedence = precedence || "default";
    var resource = styles.get(key);
    if (!resource) {
      var state = { loading: 0, preload: null };
      if (resource = ownerDocument.querySelector(getStylesheetSelectorFromKey(key)))
        state.loading = 5;
      else {
        href = assign({ rel: "stylesheet", href, "data-precedence": precedence }, options2);
        (options2 = preloadPropsMap.get(key)) && adoptPreloadPropsForStylesheet(href, options2);
        var link = resource = ownerDocument.createElement("link");
        markNodeAsHoistable(link);
        setInitialProperties(link, "link", href);
        link._p = new Promise(function(resolve, reject) {
          link.onload = resolve;
          link.onerror = reject;
        });
        link.addEventListener("load", function() {
          state.loading |= 1;
        });
        link.addEventListener("error", function() {
          state.loading |= 2;
        });
        state.loading |= 4;
        insertStylesheet(resource, precedence, ownerDocument);
      }
      resource = {
        type: "stylesheet",
        instance: resource,
        count: 1,
        state
      };
      styles.set(key, resource);
    }
  }
}
function preinitScript(src, options2) {
  previousDispatcher.X(src, options2);
  var ownerDocument = globalDocument;
  if (ownerDocument && src) {
    var scripts = getResourcesFromRoot(ownerDocument).hoistableScripts, key = getScriptKey(src), resource = scripts.get(key);
    resource || (resource = ownerDocument.querySelector(getScriptSelectorFromKey(key)), resource || (src = assign({ src, async: true }, options2), (options2 = preloadPropsMap.get(key)) && adoptPreloadPropsForScript(src, options2), resource = ownerDocument.createElement("script"), markNodeAsHoistable(resource), setInitialProperties(resource, "link", src), ownerDocument.head.appendChild(resource)), resource = {
      type: "script",
      instance: resource,
      count: 1,
      state: null
    }, scripts.set(key, resource));
  }
}
function preinitModuleScript(src, options2) {
  previousDispatcher.M(src, options2);
  var ownerDocument = globalDocument;
  if (ownerDocument && src) {
    var scripts = getResourcesFromRoot(ownerDocument).hoistableScripts, key = getScriptKey(src), resource = scripts.get(key);
    resource || (resource = ownerDocument.querySelector(getScriptSelectorFromKey(key)), resource || (src = assign({ src, async: true, type: "module" }, options2), (options2 = preloadPropsMap.get(key)) && adoptPreloadPropsForScript(src, options2), resource = ownerDocument.createElement("script"), markNodeAsHoistable(resource), setInitialProperties(resource, "link", src), ownerDocument.head.appendChild(resource)), resource = {
      type: "script",
      instance: resource,
      count: 1,
      state: null
    }, scripts.set(key, resource));
  }
}
function getResource(type, currentProps, pendingProps, currentResource) {
  var JSCompiler_inline_result = (JSCompiler_inline_result = rootInstanceStackCursor.current) ? getHoistableRoot(JSCompiler_inline_result) : null;
  if (!JSCompiler_inline_result)
    throw Error(formatProdErrorMessage(446));
  switch (type) {
    case "meta":
    case "title":
      return null;
    case "style":
      return typeof pendingProps.precedence === "string" && typeof pendingProps.href === "string" ? (currentProps = getStyleKey(pendingProps.href), pendingProps = getResourcesFromRoot(JSCompiler_inline_result).hoistableStyles, currentResource = pendingProps.get(currentProps), currentResource || (currentResource = {
        type: "style",
        instance: null,
        count: 0,
        state: null
      }, pendingProps.set(currentProps, currentResource)), currentResource) : { type: "void", instance: null, count: 0, state: null };
    case "link":
      if (pendingProps.rel === "stylesheet" && typeof pendingProps.href === "string" && typeof pendingProps.precedence === "string") {
        type = getStyleKey(pendingProps.href);
        var styles$286 = getResourcesFromRoot(JSCompiler_inline_result).hoistableStyles, resource$287 = styles$286.get(type);
        resource$287 || (JSCompiler_inline_result = JSCompiler_inline_result.ownerDocument || JSCompiler_inline_result, resource$287 = {
          type: "stylesheet",
          instance: null,
          count: 0,
          state: { loading: 0, preload: null }
        }, styles$286.set(type, resource$287), (styles$286 = JSCompiler_inline_result.querySelector(getStylesheetSelectorFromKey(type))) && !styles$286._p && (resource$287.instance = styles$286, resource$287.state.loading = 5), preloadPropsMap.has(type) || (pendingProps = {
          rel: "preload",
          as: "style",
          href: pendingProps.href,
          crossOrigin: pendingProps.crossOrigin,
          integrity: pendingProps.integrity,
          media: pendingProps.media,
          hrefLang: pendingProps.hrefLang,
          referrerPolicy: pendingProps.referrerPolicy
        }, preloadPropsMap.set(type, pendingProps), styles$286 || preloadStylesheet(JSCompiler_inline_result, type, pendingProps, resource$287.state)));
        if (currentProps && currentResource === null)
          throw Error(formatProdErrorMessage(528, ""));
        return resource$287;
      }
      if (currentProps && currentResource !== null)
        throw Error(formatProdErrorMessage(529, ""));
      return null;
    case "script":
      return currentProps = pendingProps.async, pendingProps = pendingProps.src, typeof pendingProps === "string" && currentProps && typeof currentProps !== "function" && typeof currentProps !== "symbol" ? (currentProps = getScriptKey(pendingProps), pendingProps = getResourcesFromRoot(JSCompiler_inline_result).hoistableScripts, currentResource = pendingProps.get(currentProps), currentResource || (currentResource = {
        type: "script",
        instance: null,
        count: 0,
        state: null
      }, pendingProps.set(currentProps, currentResource)), currentResource) : { type: "void", instance: null, count: 0, state: null };
    default:
      throw Error(formatProdErrorMessage(444, type));
  }
}
function getStyleKey(href) {
  return 'href="' + escapeSelectorAttributeValueInsideDoubleQuotes(href) + '"';
}
function getStylesheetSelectorFromKey(key) {
  return 'link[rel="stylesheet"][' + key + "]";
}
function stylesheetPropsFromRawProps(rawProps) {
  return assign({}, rawProps, {
    "data-precedence": rawProps.precedence,
    precedence: null
  });
}
function preloadStylesheet(ownerDocument, key, preloadProps, state) {
  ownerDocument.querySelector('link[rel="preload"][as="style"][' + key + "]") ? state.loading = 1 : (key = ownerDocument.createElement("link"), state.preload = key, key.addEventListener("load", function() {
    return state.loading |= 1;
  }), key.addEventListener("error", function() {
    return state.loading |= 2;
  }), setInitialProperties(key, "link", preloadProps), markNodeAsHoistable(key), ownerDocument.head.appendChild(key));
}
function getScriptKey(src) {
  return '[src="' + escapeSelectorAttributeValueInsideDoubleQuotes(src) + '"]';
}
function getScriptSelectorFromKey(key) {
  return "script[async]" + key;
}
function acquireResource(hoistableRoot, resource, props) {
  resource.count++;
  if (resource.instance === null)
    switch (resource.type) {
      case "style":
        var instance = hoistableRoot.querySelector('style[data-href~="' + escapeSelectorAttributeValueInsideDoubleQuotes(props.href) + '"]');
        if (instance)
          return resource.instance = instance, markNodeAsHoistable(instance), instance;
        var styleProps = assign({}, props, {
          "data-href": props.href,
          "data-precedence": props.precedence,
          href: null,
          precedence: null
        });
        instance = (hoistableRoot.ownerDocument || hoistableRoot).createElement("style");
        markNodeAsHoistable(instance);
        setInitialProperties(instance, "style", styleProps);
        insertStylesheet(instance, props.precedence, hoistableRoot);
        return resource.instance = instance;
      case "stylesheet":
        styleProps = getStyleKey(props.href);
        var instance$292 = hoistableRoot.querySelector(getStylesheetSelectorFromKey(styleProps));
        if (instance$292)
          return resource.state.loading |= 4, resource.instance = instance$292, markNodeAsHoistable(instance$292), instance$292;
        instance = stylesheetPropsFromRawProps(props);
        (styleProps = preloadPropsMap.get(styleProps)) && adoptPreloadPropsForStylesheet(instance, styleProps);
        instance$292 = (hoistableRoot.ownerDocument || hoistableRoot).createElement("link");
        markNodeAsHoistable(instance$292);
        var linkInstance = instance$292;
        linkInstance._p = new Promise(function(resolve, reject) {
          linkInstance.onload = resolve;
          linkInstance.onerror = reject;
        });
        setInitialProperties(instance$292, "link", instance);
        resource.state.loading |= 4;
        insertStylesheet(instance$292, props.precedence, hoistableRoot);
        return resource.instance = instance$292;
      case "script":
        instance$292 = getScriptKey(props.src);
        if (styleProps = hoistableRoot.querySelector(getScriptSelectorFromKey(instance$292)))
          return resource.instance = styleProps, markNodeAsHoistable(styleProps), styleProps;
        instance = props;
        if (styleProps = preloadPropsMap.get(instance$292))
          instance = assign({}, props), adoptPreloadPropsForScript(instance, styleProps);
        hoistableRoot = hoistableRoot.ownerDocument || hoistableRoot;
        styleProps = hoistableRoot.createElement("script");
        markNodeAsHoistable(styleProps);
        setInitialProperties(styleProps, "link", instance);
        hoistableRoot.head.appendChild(styleProps);
        return resource.instance = styleProps;
      case "void":
        return null;
      default:
        throw Error(formatProdErrorMessage(443, resource.type));
    }
  else
    resource.type === "stylesheet" && (resource.state.loading & 4) === 0 && (instance = resource.instance, resource.state.loading |= 4, insertStylesheet(instance, props.precedence, hoistableRoot));
  return resource.instance;
}
function insertStylesheet(instance, precedence, root2) {
  for (var nodes = root2.querySelectorAll('link[rel="stylesheet"][data-precedence],style[data-precedence]'), last = nodes.length ? nodes[nodes.length - 1] : null, prior = last, i = 0;i < nodes.length; i++) {
    var node = nodes[i];
    if (node.dataset.precedence === precedence)
      prior = node;
    else if (prior !== last)
      break;
  }
  prior ? prior.parentNode.insertBefore(instance, prior.nextSibling) : (precedence = root2.nodeType === 9 ? root2.head : root2, precedence.insertBefore(instance, precedence.firstChild));
}
function adoptPreloadPropsForStylesheet(stylesheetProps, preloadProps) {
  stylesheetProps.crossOrigin == null && (stylesheetProps.crossOrigin = preloadProps.crossOrigin);
  stylesheetProps.referrerPolicy == null && (stylesheetProps.referrerPolicy = preloadProps.referrerPolicy);
  stylesheetProps.title == null && (stylesheetProps.title = preloadProps.title);
}
function adoptPreloadPropsForScript(scriptProps, preloadProps) {
  scriptProps.crossOrigin == null && (scriptProps.crossOrigin = preloadProps.crossOrigin);
  scriptProps.referrerPolicy == null && (scriptProps.referrerPolicy = preloadProps.referrerPolicy);
  scriptProps.integrity == null && (scriptProps.integrity = preloadProps.integrity);
}
function getHydratableHoistableCache(type, keyAttribute, ownerDocument) {
  if (tagCaches === null) {
    var cache = new Map;
    var caches = tagCaches = new Map;
    caches.set(ownerDocument, cache);
  } else
    caches = tagCaches, cache = caches.get(ownerDocument), cache || (cache = new Map, caches.set(ownerDocument, cache));
  if (cache.has(type))
    return cache;
  cache.set(type, null);
  ownerDocument = ownerDocument.getElementsByTagName(type);
  for (caches = 0;caches < ownerDocument.length; caches++) {
    var node = ownerDocument[caches];
    if (!(node[internalHoistableMarker] || node[internalInstanceKey] || type === "link" && node.getAttribute("rel") === "stylesheet") && node.namespaceURI !== "http://www.w3.org/2000/svg") {
      var nodeKey = node.getAttribute(keyAttribute) || "";
      nodeKey = type + nodeKey;
      var existing = cache.get(nodeKey);
      existing ? existing.push(node) : cache.set(nodeKey, [node]);
    }
  }
  return cache;
}
function mountHoistable(hoistableRoot, type, instance) {
  hoistableRoot = hoistableRoot.ownerDocument || hoistableRoot;
  hoistableRoot.head.insertBefore(instance, type === "title" ? hoistableRoot.querySelector("head > title") : null);
}
function isHostHoistableType(type, props, hostContext) {
  if (hostContext === 1 || props.itemProp != null)
    return false;
  switch (type) {
    case "meta":
    case "title":
      return true;
    case "style":
      if (typeof props.precedence !== "string" || typeof props.href !== "string" || props.href === "")
        break;
      return true;
    case "link":
      if (typeof props.rel !== "string" || typeof props.href !== "string" || props.href === "" || props.onLoad || props.onError)
        break;
      switch (props.rel) {
        case "stylesheet":
          return type = props.disabled, typeof props.precedence === "string" && type == null;
        default:
          return true;
      }
    case "script":
      if (props.async && typeof props.async !== "function" && typeof props.async !== "symbol" && !props.onLoad && !props.onError && props.src && typeof props.src === "string")
        return true;
  }
  return false;
}
function preloadResource(resource) {
  return resource.type === "stylesheet" && (resource.state.loading & 3) === 0 ? false : true;
}
function suspendResource(state, hoistableRoot, resource, props) {
  if (resource.type === "stylesheet" && (typeof props.media !== "string" || matchMedia(props.media).matches !== false) && (resource.state.loading & 4) === 0) {
    if (resource.instance === null) {
      var key = getStyleKey(props.href), instance = hoistableRoot.querySelector(getStylesheetSelectorFromKey(key));
      if (instance) {
        hoistableRoot = instance._p;
        hoistableRoot !== null && typeof hoistableRoot === "object" && typeof hoistableRoot.then === "function" && (state.count++, state = onUnsuspend.bind(state), hoistableRoot.then(state, state));
        resource.state.loading |= 4;
        resource.instance = instance;
        markNodeAsHoistable(instance);
        return;
      }
      instance = hoistableRoot.ownerDocument || hoistableRoot;
      props = stylesheetPropsFromRawProps(props);
      (key = preloadPropsMap.get(key)) && adoptPreloadPropsForStylesheet(props, key);
      instance = instance.createElement("link");
      markNodeAsHoistable(instance);
      var linkInstance = instance;
      linkInstance._p = new Promise(function(resolve, reject) {
        linkInstance.onload = resolve;
        linkInstance.onerror = reject;
      });
      setInitialProperties(instance, "link", props);
      resource.instance = instance;
    }
    state.stylesheets === null && (state.stylesheets = new Map);
    state.stylesheets.set(resource, hoistableRoot);
    (hoistableRoot = resource.state.preload) && (resource.state.loading & 3) === 0 && (state.count++, resource = onUnsuspend.bind(state), hoistableRoot.addEventListener("load", resource), hoistableRoot.addEventListener("error", resource));
  }
}
function waitForCommitToBeReady(state, timeoutOffset) {
  state.stylesheets && state.count === 0 && insertSuspendedStylesheets(state, state.stylesheets);
  return 0 < state.count || 0 < state.imgCount ? function(commit) {
    var stylesheetTimer = setTimeout(function() {
      state.stylesheets && insertSuspendedStylesheets(state, state.stylesheets);
      if (state.unsuspend) {
        var unsuspend = state.unsuspend;
        state.unsuspend = null;
        unsuspend();
      }
    }, 60000 + timeoutOffset);
    0 < state.imgBytes && estimatedBytesWithinLimit === 0 && (estimatedBytesWithinLimit = 62500 * estimateBandwidth());
    var imgTimer = setTimeout(function() {
      state.waitingForImages = false;
      if (state.count === 0 && (state.stylesheets && insertSuspendedStylesheets(state, state.stylesheets), state.unsuspend)) {
        var unsuspend = state.unsuspend;
        state.unsuspend = null;
        unsuspend();
      }
    }, (state.imgBytes > estimatedBytesWithinLimit ? 50 : 800) + timeoutOffset);
    state.unsuspend = commit;
    return function() {
      state.unsuspend = null;
      clearTimeout(stylesheetTimer);
      clearTimeout(imgTimer);
    };
  } : null;
}
function onUnsuspend() {
  this.count--;
  if (this.count === 0 && (this.imgCount === 0 || !this.waitingForImages)) {
    if (this.stylesheets)
      insertSuspendedStylesheets(this, this.stylesheets);
    else if (this.unsuspend) {
      var unsuspend = this.unsuspend;
      this.unsuspend = null;
      unsuspend();
    }
  }
}
function insertSuspendedStylesheets(state, resources) {
  state.stylesheets = null;
  state.unsuspend !== null && (state.count++, precedencesByRoot = new Map, resources.forEach(insertStylesheetIntoRoot, state), precedencesByRoot = null, onUnsuspend.call(state));
}
function insertStylesheetIntoRoot(root2, resource) {
  if (!(resource.state.loading & 4)) {
    var precedences = precedencesByRoot.get(root2);
    if (precedences)
      var last = precedences.get(null);
    else {
      precedences = new Map;
      precedencesByRoot.set(root2, precedences);
      for (var nodes = root2.querySelectorAll("link[data-precedence],style[data-precedence]"), i = 0;i < nodes.length; i++) {
        var node = nodes[i];
        if (node.nodeName === "LINK" || node.getAttribute("media") !== "not all")
          precedences.set(node.dataset.precedence, node), last = node;
      }
      last && precedences.set(null, last);
    }
    nodes = resource.instance;
    node = nodes.getAttribute("data-precedence");
    i = precedences.get(node) || last;
    i === last && precedences.set(null, nodes);
    precedences.set(node, nodes);
    this.count++;
    last = onUnsuspend.bind(this);
    nodes.addEventListener("load", last);
    nodes.addEventListener("error", last);
    i ? i.parentNode.insertBefore(nodes, i.nextSibling) : (root2 = root2.nodeType === 9 ? root2.head : root2, root2.insertBefore(nodes, root2.firstChild));
    resource.state.loading |= 4;
  }
}
function FiberRootNode(containerInfo, tag, hydrate, identifierPrefix, onUncaughtError, onCaughtError, onRecoverableError, onDefaultTransitionIndicator, formState) {
  this.tag = 1;
  this.containerInfo = containerInfo;
  this.pingCache = this.current = this.pendingChildren = null;
  this.timeoutHandle = -1;
  this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null;
  this.callbackPriority = 0;
  this.expirationTimes = createLaneMap(-1);
  this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0;
  this.entanglements = createLaneMap(0);
  this.hiddenUpdates = createLaneMap(null);
  this.identifierPrefix = identifierPrefix;
  this.onUncaughtError = onUncaughtError;
  this.onCaughtError = onCaughtError;
  this.onRecoverableError = onRecoverableError;
  this.pooledCache = null;
  this.pooledCacheLanes = 0;
  this.formState = formState;
  this.incompleteTransitions = new Map;
  this.passiveEffectDuration = this.effectDuration = -0;
  this.memoizedUpdaters = new Set;
  containerInfo = this.pendingUpdatersLaneMap = [];
  for (tag = 0;31 > tag; tag++)
    containerInfo.push(new Set);
}
function createFiberRoot(containerInfo, tag, hydrate, initialChildren, hydrationCallbacks, isStrictMode, identifierPrefix, formState, onUncaughtError, onCaughtError, onRecoverableError, onDefaultTransitionIndicator) {
  containerInfo = new FiberRootNode(containerInfo, tag, hydrate, identifierPrefix, onUncaughtError, onCaughtError, onRecoverableError, onDefaultTransitionIndicator, formState);
  tag = 1;
  isStrictMode === true && (tag |= 24);
  isDevToolsPresent && (tag |= 2);
  isStrictMode = createFiberImplClass(3, null, null, tag);
  containerInfo.current = isStrictMode;
  isStrictMode.stateNode = containerInfo;
  tag = createCache();
  tag.refCount++;
  containerInfo.pooledCache = tag;
  tag.refCount++;
  isStrictMode.memoizedState = {
    element: initialChildren,
    isDehydrated: hydrate,
    cache: tag
  };
  initializeUpdateQueue(isStrictMode);
  return containerInfo;
}
function createPortal$1(children, containerInfo, implementation) {
  var key = 3 < arguments.length && arguments[3] !== undefined ? arguments[3] : null;
  return {
    $$typeof: REACT_PORTAL_TYPE,
    key: key == null ? null : "" + key,
    children,
    containerInfo,
    implementation
  };
}
function getContextForSubtree(parentComponent) {
  if (!parentComponent)
    return emptyContextObject;
  parentComponent = emptyContextObject;
  return parentComponent;
}
function updateContainerImpl(rootFiber, lane, element, container, parentComponent, callback) {
  parentComponent = getContextForSubtree(parentComponent);
  container.context === null ? container.context = parentComponent : container.pendingContext = parentComponent;
  container = createUpdate(lane);
  container.payload = { element };
  callback = callback === undefined ? null : callback;
  callback !== null && (container.callback = callback);
  element = enqueueUpdate(rootFiber, container, lane);
  element !== null && (startUpdateTimerByLane(lane), scheduleUpdateOnFiber(element, rootFiber, lane), entangleTransitions(element, rootFiber, lane));
}
function markRetryLaneImpl(fiber, retryLane) {
  fiber = fiber.memoizedState;
  if (fiber !== null && fiber.dehydrated !== null) {
    var a = fiber.retryLane;
    fiber.retryLane = a !== 0 && a < retryLane ? a : retryLane;
  }
}
function markRetryLaneIfNotHydrated(fiber, retryLane) {
  markRetryLaneImpl(fiber, retryLane);
  (fiber = fiber.alternate) && markRetryLaneImpl(fiber, retryLane);
}
function attemptContinuousHydration(fiber) {
  if (fiber.tag === 13 || fiber.tag === 31) {
    var root2 = enqueueConcurrentRenderForLane(fiber, 67108864);
    root2 !== null && scheduleUpdateOnFiber(root2, fiber, 67108864);
    markRetryLaneIfNotHydrated(fiber, 67108864);
  }
}
function attemptHydrationAtCurrentPriority(fiber) {
  if (fiber.tag === 13 || fiber.tag === 31) {
    var lane = requestUpdateLane();
    lane = getBumpedLaneForHydrationByLane(lane);
    var root2 = enqueueConcurrentRenderForLane(fiber, lane);
    root2 !== null && scheduleUpdateOnFiber(root2, fiber, lane);
    markRetryLaneIfNotHydrated(fiber, lane);
  }
}
function dispatchDiscreteEvent(domEventName, eventSystemFlags, container, nativeEvent) {
  var prevTransition = ReactSharedInternals.T;
  ReactSharedInternals.T = null;
  var previousPriority = ReactDOMSharedInternals.p;
  try {
    ReactDOMSharedInternals.p = 2, dispatchEvent(domEventName, eventSystemFlags, container, nativeEvent);
  } finally {
    ReactDOMSharedInternals.p = previousPriority, ReactSharedInternals.T = prevTransition;
  }
}
function dispatchContinuousEvent(domEventName, eventSystemFlags, container, nativeEvent) {
  var prevTransition = ReactSharedInternals.T;
  ReactSharedInternals.T = null;
  var previousPriority = ReactDOMSharedInternals.p;
  try {
    ReactDOMSharedInternals.p = 8, dispatchEvent(domEventName, eventSystemFlags, container, nativeEvent);
  } finally {
    ReactDOMSharedInternals.p = previousPriority, ReactSharedInternals.T = prevTransition;
  }
}
function dispatchEvent(domEventName, eventSystemFlags, targetContainer, nativeEvent) {
  if (_enabled) {
    var blockedOn = findInstanceBlockingEvent(nativeEvent);
    if (blockedOn === null)
      dispatchEventForPluginEventSystem(domEventName, eventSystemFlags, nativeEvent, return_targetInst, targetContainer), clearIfContinuousEvent(domEventName, nativeEvent);
    else if (queueIfContinuousEvent(blockedOn, domEventName, eventSystemFlags, targetContainer, nativeEvent))
      nativeEvent.stopPropagation();
    else if (clearIfContinuousEvent(domEventName, nativeEvent), eventSystemFlags & 4 && -1 < discreteReplayableEvents.indexOf(domEventName)) {
      for (;blockedOn !== null; ) {
        var fiber = getInstanceFromNode(blockedOn);
        if (fiber !== null)
          switch (fiber.tag) {
            case 3:
              fiber = fiber.stateNode;
              if (fiber.current.memoizedState.isDehydrated) {
                var lanes = getHighestPriorityLanes(fiber.pendingLanes);
                if (lanes !== 0) {
                  var root2 = fiber;
                  root2.pendingLanes |= 2;
                  for (root2.entangledLanes |= 2;lanes; ) {
                    var lane = 1 << 31 - clz32(lanes);
                    root2.entanglements[1] |= lane;
                    lanes &= ~lane;
                  }
                  ensureRootIsScheduled(fiber);
                  (executionContext & 6) === 0 && (workInProgressRootRenderTargetTime = now$1() + 500, flushSyncWorkAcrossRoots_impl(0, false));
                }
              }
              break;
            case 31:
            case 13:
              root2 = enqueueConcurrentRenderForLane(fiber, 2), root2 !== null && scheduleUpdateOnFiber(root2, fiber, 2), flushSyncWork$1(), markRetryLaneIfNotHydrated(fiber, 2);
          }
        fiber = findInstanceBlockingEvent(nativeEvent);
        fiber === null && dispatchEventForPluginEventSystem(domEventName, eventSystemFlags, nativeEvent, return_targetInst, targetContainer);
        if (fiber === blockedOn)
          break;
        blockedOn = fiber;
      }
      blockedOn !== null && nativeEvent.stopPropagation();
    } else
      dispatchEventForPluginEventSystem(domEventName, eventSystemFlags, nativeEvent, null, targetContainer);
  }
}
function findInstanceBlockingEvent(nativeEvent) {
  nativeEvent = getEventTarget(nativeEvent);
  return findInstanceBlockingTarget(nativeEvent);
}
function findInstanceBlockingTarget(targetNode) {
  return_targetInst = null;
  targetNode = getClosestInstanceFromNode(targetNode);
  if (targetNode !== null) {
    var nearestMounted = getNearestMountedFiber(targetNode);
    if (nearestMounted === null)
      targetNode = null;
    else {
      var tag = nearestMounted.tag;
      if (tag === 13) {
        targetNode = getSuspenseInstanceFromFiber(nearestMounted);
        if (targetNode !== null)
          return targetNode;
        targetNode = null;
      } else if (tag === 31) {
        targetNode = getActivityInstanceFromFiber(nearestMounted);
        if (targetNode !== null)
          return targetNode;
        targetNode = null;
      } else if (tag === 3) {
        if (nearestMounted.stateNode.current.memoizedState.isDehydrated)
          return nearestMounted.tag === 3 ? nearestMounted.stateNode.containerInfo : null;
        targetNode = null;
      } else
        nearestMounted !== targetNode && (targetNode = null);
    }
  }
  return_targetInst = targetNode;
  return null;
}
function getEventPriority(domEventName) {
  switch (domEventName) {
    case "beforetoggle":
    case "cancel":
    case "click":
    case "close":
    case "contextmenu":
    case "copy":
    case "cut":
    case "auxclick":
    case "dblclick":
    case "dragend":
    case "dragstart":
    case "drop":
    case "focusin":
    case "focusout":
    case "input":
    case "invalid":
    case "keydown":
    case "keypress":
    case "keyup":
    case "mousedown":
    case "mouseup":
    case "paste":
    case "pause":
    case "play":
    case "pointercancel":
    case "pointerdown":
    case "pointerup":
    case "ratechange":
    case "reset":
    case "resize":
    case "seeked":
    case "submit":
    case "toggle":
    case "touchcancel":
    case "touchend":
    case "touchstart":
    case "volumechange":
    case "change":
    case "selectionchange":
    case "textInput":
    case "compositionstart":
    case "compositionend":
    case "compositionupdate":
    case "beforeblur":
    case "afterblur":
    case "beforeinput":
    case "blur":
    case "fullscreenchange":
    case "focus":
    case "hashchange":
    case "popstate":
    case "select":
    case "selectstart":
      return 2;
    case "drag":
    case "dragenter":
    case "dragexit":
    case "dragleave":
    case "dragover":
    case "mousemove":
    case "mouseout":
    case "mouseover":
    case "pointermove":
    case "pointerout":
    case "pointerover":
    case "scroll":
    case "touchmove":
    case "wheel":
    case "mouseenter":
    case "mouseleave":
    case "pointerenter":
    case "pointerleave":
      return 8;
    case "message":
      switch (getCurrentPriorityLevel()) {
        case ImmediatePriority:
          return 2;
        case UserBlockingPriority:
          return 8;
        case NormalPriority$1:
        case LowPriority:
          return 32;
        case IdlePriority:
          return 268435456;
        default:
          return 32;
      }
    default:
      return 32;
  }
}
function clearIfContinuousEvent(domEventName, nativeEvent) {
  switch (domEventName) {
    case "focusin":
    case "focusout":
      queuedFocus = null;
      break;
    case "dragenter":
    case "dragleave":
      queuedDrag = null;
      break;
    case "mouseover":
    case "mouseout":
      queuedMouse = null;
      break;
    case "pointerover":
    case "pointerout":
      queuedPointers.delete(nativeEvent.pointerId);
      break;
    case "gotpointercapture":
    case "lostpointercapture":
      queuedPointerCaptures.delete(nativeEvent.pointerId);
  }
}
function accumulateOrCreateContinuousQueuedReplayableEvent(existingQueuedEvent, blockedOn, domEventName, eventSystemFlags, targetContainer, nativeEvent) {
  if (existingQueuedEvent === null || existingQueuedEvent.nativeEvent !== nativeEvent)
    return existingQueuedEvent = {
      blockedOn,
      domEventName,
      eventSystemFlags,
      nativeEvent,
      targetContainers: [targetContainer]
    }, blockedOn !== null && (blockedOn = getInstanceFromNode(blockedOn), blockedOn !== null && attemptContinuousHydration(blockedOn)), existingQueuedEvent;
  existingQueuedEvent.eventSystemFlags |= eventSystemFlags;
  blockedOn = existingQueuedEvent.targetContainers;
  targetContainer !== null && blockedOn.indexOf(targetContainer) === -1 && blockedOn.push(targetContainer);
  return existingQueuedEvent;
}
function queueIfContinuousEvent(blockedOn, domEventName, eventSystemFlags, targetContainer, nativeEvent) {
  switch (domEventName) {
    case "focusin":
      return queuedFocus = accumulateOrCreateContinuousQueuedReplayableEvent(queuedFocus, blockedOn, domEventName, eventSystemFlags, targetContainer, nativeEvent), true;
    case "dragenter":
      return queuedDrag = accumulateOrCreateContinuousQueuedReplayableEvent(queuedDrag, blockedOn, domEventName, eventSystemFlags, targetContainer, nativeEvent), true;
    case "mouseover":
      return queuedMouse = accumulateOrCreateContinuousQueuedReplayableEvent(queuedMouse, blockedOn, domEventName, eventSystemFlags, targetContainer, nativeEvent), true;
    case "pointerover":
      var pointerId = nativeEvent.pointerId;
      queuedPointers.set(pointerId, accumulateOrCreateContinuousQueuedReplayableEvent(queuedPointers.get(pointerId) || null, blockedOn, domEventName, eventSystemFlags, targetContainer, nativeEvent));
      return true;
    case "gotpointercapture":
      return pointerId = nativeEvent.pointerId, queuedPointerCaptures.set(pointerId, accumulateOrCreateContinuousQueuedReplayableEvent(queuedPointerCaptures.get(pointerId) || null, blockedOn, domEventName, eventSystemFlags, targetContainer, nativeEvent)), true;
  }
  return false;
}
function attemptExplicitHydrationTarget(queuedTarget) {
  var targetInst = getClosestInstanceFromNode(queuedTarget.target);
  if (targetInst !== null) {
    var nearestMounted = getNearestMountedFiber(targetInst);
    if (nearestMounted !== null) {
      if (targetInst = nearestMounted.tag, targetInst === 13) {
        if (targetInst = getSuspenseInstanceFromFiber(nearestMounted), targetInst !== null) {
          queuedTarget.blockedOn = targetInst;
          runWithPriority(queuedTarget.priority, function() {
            attemptHydrationAtCurrentPriority(nearestMounted);
          });
          return;
        }
      } else if (targetInst === 31) {
        if (targetInst = getActivityInstanceFromFiber(nearestMounted), targetInst !== null) {
          queuedTarget.blockedOn = targetInst;
          runWithPriority(queuedTarget.priority, function() {
            attemptHydrationAtCurrentPriority(nearestMounted);
          });
          return;
        }
      } else if (targetInst === 3 && nearestMounted.stateNode.current.memoizedState.isDehydrated) {
        queuedTarget.blockedOn = nearestMounted.tag === 3 ? nearestMounted.stateNode.containerInfo : null;
        return;
      }
    }
  }
  queuedTarget.blockedOn = null;
}
function attemptReplayContinuousQueuedEvent(queuedEvent) {
  if (queuedEvent.blockedOn !== null)
    return false;
  for (var targetContainers = queuedEvent.targetContainers;0 < targetContainers.length; ) {
    var nextBlockedOn = findInstanceBlockingEvent(queuedEvent.nativeEvent);
    if (nextBlockedOn === null) {
      nextBlockedOn = queuedEvent.nativeEvent;
      var nativeEventClone = new nextBlockedOn.constructor(nextBlockedOn.type, nextBlockedOn);
      currentReplayingEvent = nativeEventClone;
      nextBlockedOn.target.dispatchEvent(nativeEventClone);
      currentReplayingEvent = null;
    } else
      return targetContainers = getInstanceFromNode(nextBlockedOn), targetContainers !== null && attemptContinuousHydration(targetContainers), queuedEvent.blockedOn = nextBlockedOn, false;
    targetContainers.shift();
  }
  return true;
}
function attemptReplayContinuousQueuedEventInMap(queuedEvent, key, map) {
  attemptReplayContinuousQueuedEvent(queuedEvent) && map.delete(key);
}
function replayUnblockedEvents() {
  hasScheduledReplayAttempt = false;
  queuedFocus !== null && attemptReplayContinuousQueuedEvent(queuedFocus) && (queuedFocus = null);
  queuedDrag !== null && attemptReplayContinuousQueuedEvent(queuedDrag) && (queuedDrag = null);
  queuedMouse !== null && attemptReplayContinuousQueuedEvent(queuedMouse) && (queuedMouse = null);
  queuedPointers.forEach(attemptReplayContinuousQueuedEventInMap);
  queuedPointerCaptures.forEach(attemptReplayContinuousQueuedEventInMap);
}
function scheduleCallbackIfUnblocked(queuedEvent, unblocked) {
  queuedEvent.blockedOn === unblocked && (queuedEvent.blockedOn = null, hasScheduledReplayAttempt || (hasScheduledReplayAttempt = true, Scheduler.unstable_scheduleCallback(Scheduler.unstable_NormalPriority, replayUnblockedEvents)));
}
function scheduleReplayQueueIfNeeded(formReplayingQueue) {
  lastScheduledReplayQueue !== formReplayingQueue && (lastScheduledReplayQueue = formReplayingQueue, Scheduler.unstable_scheduleCallback(Scheduler.unstable_NormalPriority, function() {
    lastScheduledReplayQueue === formReplayingQueue && (lastScheduledReplayQueue = null);
    for (var i = 0;i < formReplayingQueue.length; i += 3) {
      var form = formReplayingQueue[i], submitterOrAction = formReplayingQueue[i + 1], formData = formReplayingQueue[i + 2];
      if (typeof submitterOrAction !== "function")
        if (findInstanceBlockingTarget(submitterOrAction || form) === null)
          continue;
        else
          break;
      var formInst = getInstanceFromNode(form);
      formInst !== null && (formReplayingQueue.splice(i, 3), i -= 3, startHostTransition(formInst, {
        pending: true,
        data: formData,
        method: form.method,
        action: submitterOrAction
      }, submitterOrAction, formData));
    }
  }));
}
function retryIfBlockedOn(unblocked) {
  function unblock(queuedEvent) {
    return scheduleCallbackIfUnblocked(queuedEvent, unblocked);
  }
  queuedFocus !== null && scheduleCallbackIfUnblocked(queuedFocus, unblocked);
  queuedDrag !== null && scheduleCallbackIfUnblocked(queuedDrag, unblocked);
  queuedMouse !== null && scheduleCallbackIfUnblocked(queuedMouse, unblocked);
  queuedPointers.forEach(unblock);
  queuedPointerCaptures.forEach(unblock);
  for (var i = 0;i < queuedExplicitHydrationTargets.length; i++) {
    var queuedTarget = queuedExplicitHydrationTargets[i];
    queuedTarget.blockedOn === unblocked && (queuedTarget.blockedOn = null);
  }
  for (;0 < queuedExplicitHydrationTargets.length && (i = queuedExplicitHydrationTargets[0], i.blockedOn === null); )
    attemptExplicitHydrationTarget(i), i.blockedOn === null && queuedExplicitHydrationTargets.shift();
  i = (unblocked.ownerDocument || unblocked).$$reactFormReplay;
  if (i != null)
    for (queuedTarget = 0;queuedTarget < i.length; queuedTarget += 3) {
      var form = i[queuedTarget], submitterOrAction = i[queuedTarget + 1], formProps = form[internalPropsKey] || null;
      if (typeof submitterOrAction === "function")
        formProps || scheduleReplayQueueIfNeeded(i);
      else if (formProps) {
        var action = null;
        if (submitterOrAction && submitterOrAction.hasAttribute("formAction"))
          if (form = submitterOrAction, formProps = submitterOrAction[internalPropsKey] || null)
            action = formProps.formAction;
          else {
            if (findInstanceBlockingTarget(form) !== null)
              continue;
          }
        else
          action = formProps.action;
        typeof action === "function" ? i[queuedTarget + 1] = action : (i.splice(queuedTarget, 3), queuedTarget -= 3);
        scheduleReplayQueueIfNeeded(i);
      }
    }
}
function defaultOnDefaultTransitionIndicator() {
  function handleNavigate(event) {
    event.canIntercept && event.info === "react-transition" && event.intercept({
      handler: function() {
        return new Promise(function(resolve) {
          return pendingResolve = resolve;
        });
      },
      focusReset: "manual",
      scroll: "manual"
    });
  }
  function handleNavigateComplete() {
    pendingResolve !== null && (pendingResolve(), pendingResolve = null);
    isCancelled || setTimeout(startFakeNavigation, 20);
  }
  function startFakeNavigation() {
    if (!isCancelled && !navigation.transition) {
      var currentEntry = navigation.currentEntry;
      currentEntry && currentEntry.url != null && navigation.navigate(currentEntry.url, {
        state: currentEntry.getState(),
        info: "react-transition",
        history: "replace"
      });
    }
  }
  if (typeof navigation === "object") {
    var isCancelled = false, pendingResolve = null;
    navigation.addEventListener("navigate", handleNavigate);
    navigation.addEventListener("navigatesuccess", handleNavigateComplete);
    navigation.addEventListener("navigateerror", handleNavigateComplete);
    setTimeout(startFakeNavigation, 100);
    return function() {
      isCancelled = true;
      navigation.removeEventListener("navigate", handleNavigate);
      navigation.removeEventListener("navigatesuccess", handleNavigateComplete);
      navigation.removeEventListener("navigateerror", handleNavigateComplete);
      pendingResolve !== null && (pendingResolve(), pendingResolve = null);
    };
  }
}
function ReactDOMRoot(internalRoot) {
  this._internalRoot = internalRoot;
}
function ReactDOMHydrationRoot(internalRoot) {
  this._internalRoot = internalRoot;
}
function getCrossOriginStringAs(as, input) {
  if (as === "font")
    return "";
  if (typeof input === "string")
    return input === "use-credentials" ? input : "";
}
var Scheduler, React, ReactDOM, assign, REACT_LEGACY_ELEMENT_TYPE, REACT_ELEMENT_TYPE, REACT_PORTAL_TYPE, REACT_FRAGMENT_TYPE, REACT_STRICT_MODE_TYPE, REACT_PROFILER_TYPE, REACT_CONSUMER_TYPE, REACT_CONTEXT_TYPE, REACT_FORWARD_REF_TYPE, REACT_SUSPENSE_TYPE, REACT_SUSPENSE_LIST_TYPE, REACT_MEMO_TYPE, REACT_LAZY_TYPE, REACT_ACTIVITY_TYPE, REACT_MEMO_CACHE_SENTINEL, MAYBE_ITERATOR_SYMBOL, REACT_CLIENT_REFERENCE, isArrayImpl, ReactSharedInternals, ReactDOMSharedInternals, sharedNotPendingObject, valueStack, index = -1, contextStackCursor, contextFiberStackCursor, rootInstanceStackCursor, hostTransitionProviderCursor, prefix, suffix, reentry = false, hasOwnProperty, scheduleCallback$3, cancelCallback$1, shouldYield, requestPaint, now$1, getCurrentPriorityLevel, ImmediatePriority, UserBlockingPriority, NormalPriority$1, LowPriority, IdlePriority, log$1, unstable_setDisableYieldValue2, rendererID = null, injectedHook = null, isDevToolsPresent, clz32, log2, LN2, nextTransitionUpdateLane = 256, nextTransitionDeferredLane = 262144, nextRetryLane = 4194304, randomKey, internalInstanceKey, internalPropsKey, internalContainerInstanceKey, internalEventHandlersKey, internalEventHandlerListenersKey, internalEventHandlesSetKey, internalRootNodeResourcesKey, internalHoistableMarker, allNativeEvents, registrationNameDependencies, VALID_ATTRIBUTE_NAME_REGEX, illegalAttributeNameCache, validatedAttributeNameCache, escapeSelectorAttributeValueInsideDoubleQuotesRegex, unitlessNumbers, aliases, isJavaScriptProtocol, currentReplayingEvent = null, restoreTarget = null, restoreQueue = null, isInsideEventHandler = false, canUseDOM, passiveBrowserEventsSupported = false, options, root = null, startText = null, fallbackText = null, EventInterface, SyntheticEvent, UIEventInterface, SyntheticUIEvent, lastMovementX, lastMovementY, lastMouseEvent, MouseEventInterface, SyntheticMouseEvent, DragEventInterface, SyntheticDragEvent, FocusEventInterface, SyntheticFocusEvent, AnimationEventInterface, SyntheticAnimationEvent, ClipboardEventInterface, SyntheticClipboardEvent, CompositionEventInterface, SyntheticCompositionEvent, normalizeKey, translateToKey, modifierKeyToProp, KeyboardEventInterface, SyntheticKeyboardEvent, PointerEventInterface, SyntheticPointerEvent, TouchEventInterface, SyntheticTouchEvent, TransitionEventInterface, SyntheticTransitionEvent, WheelEventInterface, SyntheticWheelEvent, ToggleEventInterface, SyntheticToggleEvent, END_KEYCODES, canUseCompositionEvent, documentMode = null, canUseTextInputEvent, useFallbackCompositionData, SPACEBAR_CHAR, hasSpaceKeypress = false, isComposing = false, supportedInputTypes, activeElement$1 = null, activeElementInst$1 = null, isInputEventSupported = false, JSCompiler_inline_result$jscomp$330, isSupported$jscomp$inline_473, element$jscomp$inline_474, objectIs, skipSelectionChangeEvent, activeElement = null, activeElementInst = null, lastSelection = null, mouseDown = false, vendorPrefixes, prefixedEventNames, style, ANIMATION_END, ANIMATION_ITERATION, ANIMATION_START, TRANSITION_RUN, TRANSITION_START, TRANSITION_CANCEL, TRANSITION_END, topLevelEventsToReactNames, simpleEventPluginEvents, reportGlobalError, supportsUserTiming, currentTrack = "Blocking", reusableComponentDevToolDetails, reusableComponentOptions, concurrentQueues, concurrentQueuesIndex = 0, concurrentlyUpdatedLanes = 0, emptyContextObject, CapturedStacks, forkStack, forkStackIndex = 0, treeForkProvider = null, treeForkCount = 0, idStack, idStackIndex = 0, treeContextProvider = null, treeContextId = 1, treeContextOverflow = "", hydrationParentFiber = null, nextHydratableInstance = null, isHydrating = false, hydrationErrors = null, rootOrSingletonContext = false, HydrationMismatchException, valueCursor, currentlyRenderingFiber$1 = null, lastContextDependency = null, AbortControllerLocal, scheduleCallback$2, NormalPriority, CacheContext, now, renderStartTime = -0, commitStartTime = -0, commitEndTime = -0, commitErrors = null, profilerStartTime = -1.1, profilerEffectDuration = -0, componentEffectDuration = -0, componentEffectStartTime = -1.1, componentEffectEndTime = -1.1, componentEffectErrors = null, componentEffectSpawnedUpdate = false, blockingClampTime = -0, blockingUpdateTime = -1.1, blockingUpdateType = 0, blockingEventTime = -1.1, blockingEventType = null, blockingEventRepeatTime = -1.1, blockingSuspendedTime = -1.1, transitionClampTime = -0, transitionStartTime = -1.1, transitionUpdateTime = -1.1, transitionUpdateType = 0, transitionEventTime = -1.1, transitionEventType = null, transitionEventRepeatTime = -1.1, transitionSuspendedTime = -1.1, yieldReason = 0, yieldStartTime = -1.1, currentUpdateIsNested = false, nestedUpdateScheduled = false, currentEntangledListeners = null, currentEntangledPendingCount = 0, currentEntangledLane = 0, currentEntangledActionThenable = null, prevOnStartTransitionFinish, resumedCache, SuspenseException, SuspenseyCommitException, SuspenseActionException, noopSuspenseyCommitThenable, suspendedThenable = null, thenableState$1 = null, thenableIndexCounter$1 = 0, reconcileChildFibers, mountChildFibers, hasForceUpdate = false, didReadFromEntangledAsyncAction = false, currentTreeHiddenStackCursor, prevEntangledRenderLanesCursor, suspenseHandlerStackCursor, shellBoundary = null, suspenseStackCursor, renderLanes = 0, currentlyRenderingFiber = null, currentHook = null, workInProgressHook = null, didScheduleRenderPhaseUpdate = false, didScheduleRenderPhaseUpdateDuringThisPass = false, shouldDoubleInvokeUserFnsInHooksDEV = false, localIdCounter = 0, thenableIndexCounter = 0, thenableState = null, globalClientIdCounter = 0, ContextOnlyDispatcher, HooksDispatcherOnMount, HooksDispatcherOnUpdate, HooksDispatcherOnRerender, classComponentUpdater, SelectiveHydrationException, didReceiveUpdate = false, SUSPENDED_MARKER, offscreenSubtreeIsHidden = false, offscreenSubtreeWasHidden = false, needsFormReset = false, PossiblyWeakSet, nextEffect = null, inProgressLanes = null, inProgressRoot = null, hostParent = null, hostParentIsContainer = false, currentHoistableRoot = null, inHydratedSubtree = false, suspenseyCommitFlag = 8192, DefaultAsyncDispatcher, PossiblyWeakMap, executionContext = 0, workInProgressRoot = null, workInProgress = null, workInProgressRootRenderLanes = 0, workInProgressSuspendedReason = 0, workInProgressThrownValue = null, workInProgressRootDidSkipSuspendedSiblings = false, workInProgressRootIsPrerendering = false, workInProgressRootDidAttachPingListener = false, entangledRenderLanes = 0, workInProgressRootExitStatus = 0, workInProgressRootSkippedLanes = 0, workInProgressRootInterleavedUpdatedLanes = 0, workInProgressRootPingedLanes = 0, workInProgressDeferredLane = 0, workInProgressSuspendedRetryLanes = 0, workInProgressRootConcurrentErrors = null, workInProgressRootRecoverableErrors = null, workInProgressRootDidIncludeRecursiveRenderUpdate = false, globalMostRecentFallbackTime = 0, globalMostRecentTransitionTime = 0, workInProgressRootRenderTargetTime = Infinity, workInProgressTransitions = null, legacyErrorBoundariesThatAlreadyFailed = null, pendingEffectsStatus = 0, pendingEffectsRoot = null, pendingFinishedWork = null, pendingEffectsLanes = 0, pendingEffectsRemainingLanes = 0, pendingEffectsRenderEndTime = -0, pendingPassiveTransitions = null, pendingRecoverableErrors = null, pendingSuspendedCommitReason = null, pendingDelayedCommitReason = 0, pendingSuspendedViewTransitionReason = null, nestedUpdateCount = 0, rootWithNestedUpdates = null, firstScheduledRoot = null, lastScheduledRoot = null, didScheduleMicrotask = false, mightHavePendingSyncWork = false, isFlushingWork = false, currentEventTransitionLane = 0, eventName$jscomp$inline_1876, domEventName$jscomp$inline_1877, capitalizedEvent$jscomp$inline_1878, i$jscomp$inline_1875, mediaEventTypes, nonDelegatedEvents, listeningMarker, NORMALIZE_NEWLINES_REGEX, NORMALIZE_NULL_AND_REPLACEMENT_REGEX, eventsEnabled = null, selectionInformation = null, currentPopstateTransitionEvent = null, schedulerEvent = undefined, scheduleTimeout, cancelTimeout, localPromise, scheduleMicrotask, previousHydratableOnEnteringScopedSingleton = null, preloadPropsMap, preconnectsSet, previousDispatcher, globalDocument, tagCaches = null, estimatedBytesWithinLimit = 0, precedencesByRoot = null, HostTransitionContext, _enabled = true, return_targetInst = null, hasScheduledReplayAttempt = false, queuedFocus = null, queuedDrag = null, queuedMouse = null, queuedPointers, queuedPointerCaptures, queuedExplicitHydrationTargets, discreteReplayableEvents, lastScheduledReplayQueue = null, isomorphicReactPackageVersion$jscomp$inline_2138, internals$jscomp$inline_2658, hook$jscomp$inline_2659, $__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, $createPortal = function(children, container) {
  var key = 2 < arguments.length && arguments[2] !== undefined ? arguments[2] : null;
  if (!isValidContainer(container))
    throw Error(formatProdErrorMessage(299));
  return createPortal$1(children, container, null, key);
}, $createRoot = function(container, options2) {
  if (!isValidContainer(container))
    throw Error(formatProdErrorMessage(299));
  var isStrictMode = false, identifierPrefix = "", onUncaughtError = defaultOnUncaughtError, onCaughtError = defaultOnCaughtError, onRecoverableError = defaultOnRecoverableError;
  options2 !== null && options2 !== undefined && (options2.unstable_strictMode === true && (isStrictMode = true), options2.identifierPrefix !== undefined && (identifierPrefix = options2.identifierPrefix), options2.onUncaughtError !== undefined && (onUncaughtError = options2.onUncaughtError), options2.onCaughtError !== undefined && (onCaughtError = options2.onCaughtError), options2.onRecoverableError !== undefined && (onRecoverableError = options2.onRecoverableError));
  options2 = createFiberRoot(container, 1, false, null, null, isStrictMode, identifierPrefix, null, onUncaughtError, onCaughtError, onRecoverableError, defaultOnDefaultTransitionIndicator);
  container[internalContainerInstanceKey] = options2.current;
  listenToAllSupportedEvents(container);
  return new ReactDOMRoot(options2);
}, $flushSync = function(fn) {
  var previousTransition = ReactSharedInternals.T, previousUpdatePriority = ReactDOMSharedInternals.p;
  try {
    if (ReactSharedInternals.T = null, ReactDOMSharedInternals.p = 2, fn)
      return fn();
  } finally {
    ReactSharedInternals.T = previousTransition, ReactDOMSharedInternals.p = previousUpdatePriority, ReactDOMSharedInternals.d.f();
  }
}, $hydrateRoot = function(container, initialChildren, options2) {
  if (!isValidContainer(container))
    throw Error(formatProdErrorMessage(299));
  var isStrictMode = false, identifierPrefix = "", onUncaughtError = defaultOnUncaughtError, onCaughtError = defaultOnCaughtError, onRecoverableError = defaultOnRecoverableError, formState = null;
  options2 !== null && options2 !== undefined && (options2.unstable_strictMode === true && (isStrictMode = true), options2.identifierPrefix !== undefined && (identifierPrefix = options2.identifierPrefix), options2.onUncaughtError !== undefined && (onUncaughtError = options2.onUncaughtError), options2.onCaughtError !== undefined && (onCaughtError = options2.onCaughtError), options2.onRecoverableError !== undefined && (onRecoverableError = options2.onRecoverableError), options2.formState !== undefined && (formState = options2.formState));
  initialChildren = createFiberRoot(container, 1, true, initialChildren, options2 != null ? options2 : null, isStrictMode, identifierPrefix, formState, onUncaughtError, onCaughtError, onRecoverableError, defaultOnDefaultTransitionIndicator);
  initialChildren.context = getContextForSubtree(null);
  options2 = initialChildren.current;
  isStrictMode = requestUpdateLane();
  isStrictMode = getBumpedLaneForHydrationByLane(isStrictMode);
  identifierPrefix = createUpdate(isStrictMode);
  identifierPrefix.callback = null;
  enqueueUpdate(options2, identifierPrefix, isStrictMode);
  startUpdateTimerByLane(isStrictMode);
  options2 = isStrictMode;
  initialChildren.current.lanes = options2;
  markRootUpdated$1(initialChildren, options2);
  ensureRootIsScheduled(initialChildren);
  container[internalContainerInstanceKey] = initialChildren.current;
  listenToAllSupportedEvents(container);
  return new ReactDOMHydrationRoot(initialChildren);
}, $preconnect = function(href, options2) {
  typeof href === "string" && (options2 ? (options2 = options2.crossOrigin, options2 = typeof options2 === "string" ? options2 === "use-credentials" ? options2 : "" : undefined) : options2 = null, ReactDOMSharedInternals.d.C(href, options2));
}, $prefetchDNS = function(href) {
  typeof href === "string" && ReactDOMSharedInternals.d.D(href);
}, $preinit = function(href, options2) {
  if (typeof href === "string" && options2 && typeof options2.as === "string") {
    var as = options2.as, crossOrigin = getCrossOriginStringAs(as, options2.crossOrigin), integrity = typeof options2.integrity === "string" ? options2.integrity : undefined, fetchPriority = typeof options2.fetchPriority === "string" ? options2.fetchPriority : undefined;
    as === "style" ? ReactDOMSharedInternals.d.S(href, typeof options2.precedence === "string" ? options2.precedence : undefined, {
      crossOrigin,
      integrity,
      fetchPriority
    }) : as === "script" && ReactDOMSharedInternals.d.X(href, {
      crossOrigin,
      integrity,
      fetchPriority,
      nonce: typeof options2.nonce === "string" ? options2.nonce : undefined
    });
  }
}, $preinitModule = function(href, options2) {
  if (typeof href === "string")
    if (typeof options2 === "object" && options2 !== null) {
      if (options2.as == null || options2.as === "script") {
        var crossOrigin = getCrossOriginStringAs(options2.as, options2.crossOrigin);
        ReactDOMSharedInternals.d.M(href, {
          crossOrigin,
          integrity: typeof options2.integrity === "string" ? options2.integrity : undefined,
          nonce: typeof options2.nonce === "string" ? options2.nonce : undefined
        });
      }
    } else
      options2 == null && ReactDOMSharedInternals.d.M(href);
}, $preload = function(href, options2) {
  if (typeof href === "string" && typeof options2 === "object" && options2 !== null && typeof options2.as === "string") {
    var as = options2.as, crossOrigin = getCrossOriginStringAs(as, options2.crossOrigin);
    ReactDOMSharedInternals.d.L(href, as, {
      crossOrigin,
      integrity: typeof options2.integrity === "string" ? options2.integrity : undefined,
      nonce: typeof options2.nonce === "string" ? options2.nonce : undefined,
      type: typeof options2.type === "string" ? options2.type : undefined,
      fetchPriority: typeof options2.fetchPriority === "string" ? options2.fetchPriority : undefined,
      referrerPolicy: typeof options2.referrerPolicy === "string" ? options2.referrerPolicy : undefined,
      imageSrcSet: typeof options2.imageSrcSet === "string" ? options2.imageSrcSet : undefined,
      imageSizes: typeof options2.imageSizes === "string" ? options2.imageSizes : undefined,
      media: typeof options2.media === "string" ? options2.media : undefined
    });
  }
}, $preloadModule = function(href, options2) {
  if (typeof href === "string")
    if (options2) {
      var crossOrigin = getCrossOriginStringAs(options2.as, options2.crossOrigin);
      ReactDOMSharedInternals.d.m(href, {
        as: typeof options2.as === "string" && options2.as !== "script" ? options2.as : undefined,
        crossOrigin,
        integrity: typeof options2.integrity === "string" ? options2.integrity : undefined
      });
    } else
      ReactDOMSharedInternals.d.m(href);
}, $requestFormReset = function(form) {
  ReactDOMSharedInternals.d.r(form);
}, $unstable_batchedUpdates = function(fn, a) {
  return fn(a);
}, $useFormState = function(action, initialState, permalink) {
  return ReactSharedInternals.H.useFormState(action, initialState, permalink);
}, $useFormStatus = function() {
  return ReactSharedInternals.H.useHostTransitionStatus();
}, $version = "19.2.7";
var init_react_dom_profiling_profiling = __esm(() => {
  Scheduler = __toESM(require_scheduler(), 1);
  React = __toESM(require_react(), 1);
  ReactDOM = __toESM(require_react_dom(), 1);
  typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== "undefined" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart === "function" && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(Error());
  assign = Object.assign;
  REACT_LEGACY_ELEMENT_TYPE = Symbol.for("react.element");
  REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element");
  REACT_PORTAL_TYPE = Symbol.for("react.portal");
  REACT_FRAGMENT_TYPE = Symbol.for("react.fragment");
  REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode");
  REACT_PROFILER_TYPE = Symbol.for("react.profiler");
  REACT_CONSUMER_TYPE = Symbol.for("react.consumer");
  REACT_CONTEXT_TYPE = Symbol.for("react.context");
  REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref");
  REACT_SUSPENSE_TYPE = Symbol.for("react.suspense");
  REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list");
  REACT_MEMO_TYPE = Symbol.for("react.memo");
  REACT_LAZY_TYPE = Symbol.for("react.lazy");
  Symbol.for("react.scope");
  REACT_ACTIVITY_TYPE = Symbol.for("react.activity");
  Symbol.for("react.legacy_hidden");
  Symbol.for("react.tracing_marker");
  REACT_MEMO_CACHE_SENTINEL = Symbol.for("react.memo_cache_sentinel");
  Symbol.for("react.view_transition");
  MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
  REACT_CLIENT_REFERENCE = Symbol.for("react.client.reference");
  isArrayImpl = Array.isArray;
  ReactSharedInternals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  ReactDOMSharedInternals = ReactDOM.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  sharedNotPendingObject = {
    pending: false,
    data: null,
    method: null,
    action: null
  };
  valueStack = [];
  contextStackCursor = createCursor(null);
  contextFiberStackCursor = createCursor(null);
  rootInstanceStackCursor = createCursor(null);
  hostTransitionProviderCursor = createCursor(null);
  hasOwnProperty = Object.prototype.hasOwnProperty;
  scheduleCallback$3 = Scheduler.unstable_scheduleCallback;
  cancelCallback$1 = Scheduler.unstable_cancelCallback;
  shouldYield = Scheduler.unstable_shouldYield;
  requestPaint = Scheduler.unstable_requestPaint;
  now$1 = Scheduler.unstable_now;
  getCurrentPriorityLevel = Scheduler.unstable_getCurrentPriorityLevel;
  ImmediatePriority = Scheduler.unstable_ImmediatePriority;
  UserBlockingPriority = Scheduler.unstable_UserBlockingPriority;
  NormalPriority$1 = Scheduler.unstable_NormalPriority;
  LowPriority = Scheduler.unstable_LowPriority;
  IdlePriority = Scheduler.unstable_IdlePriority;
  log$1 = Scheduler.log;
  unstable_setDisableYieldValue2 = Scheduler.unstable_setDisableYieldValue;
  isDevToolsPresent = typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== "undefined";
  clz32 = Math.clz32 ? Math.clz32 : clz32Fallback;
  log2 = Math.log;
  LN2 = Math.LN2;
  randomKey = Math.random().toString(36).slice(2);
  internalInstanceKey = "__reactFiber$" + randomKey;
  internalPropsKey = "__reactProps$" + randomKey;
  internalContainerInstanceKey = "__reactContainer$" + randomKey;
  internalEventHandlersKey = "__reactEvents$" + randomKey;
  internalEventHandlerListenersKey = "__reactListeners$" + randomKey;
  internalEventHandlesSetKey = "__reactHandles$" + randomKey;
  internalRootNodeResourcesKey = "__reactResources$" + randomKey;
  internalHoistableMarker = "__reactMarker$" + randomKey;
  allNativeEvents = new Set;
  registrationNameDependencies = {};
  VALID_ATTRIBUTE_NAME_REGEX = RegExp("^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$");
  illegalAttributeNameCache = {};
  validatedAttributeNameCache = {};
  escapeSelectorAttributeValueInsideDoubleQuotesRegex = /[\n"\\]/g;
  unitlessNumbers = new Set("animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp".split(" "));
  aliases = new Map([
    ["acceptCharset", "accept-charset"],
    ["htmlFor", "for"],
    ["httpEquiv", "http-equiv"],
    ["crossOrigin", "crossorigin"],
    ["accentHeight", "accent-height"],
    ["alignmentBaseline", "alignment-baseline"],
    ["arabicForm", "arabic-form"],
    ["baselineShift", "baseline-shift"],
    ["capHeight", "cap-height"],
    ["clipPath", "clip-path"],
    ["clipRule", "clip-rule"],
    ["colorInterpolation", "color-interpolation"],
    ["colorInterpolationFilters", "color-interpolation-filters"],
    ["colorProfile", "color-profile"],
    ["colorRendering", "color-rendering"],
    ["dominantBaseline", "dominant-baseline"],
    ["enableBackground", "enable-background"],
    ["fillOpacity", "fill-opacity"],
    ["fillRule", "fill-rule"],
    ["floodColor", "flood-color"],
    ["floodOpacity", "flood-opacity"],
    ["fontFamily", "font-family"],
    ["fontSize", "font-size"],
    ["fontSizeAdjust", "font-size-adjust"],
    ["fontStretch", "font-stretch"],
    ["fontStyle", "font-style"],
    ["fontVariant", "font-variant"],
    ["fontWeight", "font-weight"],
    ["glyphName", "glyph-name"],
    ["glyphOrientationHorizontal", "glyph-orientation-horizontal"],
    ["glyphOrientationVertical", "glyph-orientation-vertical"],
    ["horizAdvX", "horiz-adv-x"],
    ["horizOriginX", "horiz-origin-x"],
    ["imageRendering", "image-rendering"],
    ["letterSpacing", "letter-spacing"],
    ["lightingColor", "lighting-color"],
    ["markerEnd", "marker-end"],
    ["markerMid", "marker-mid"],
    ["markerStart", "marker-start"],
    ["overlinePosition", "overline-position"],
    ["overlineThickness", "overline-thickness"],
    ["paintOrder", "paint-order"],
    ["panose-1", "panose-1"],
    ["pointerEvents", "pointer-events"],
    ["renderingIntent", "rendering-intent"],
    ["shapeRendering", "shape-rendering"],
    ["stopColor", "stop-color"],
    ["stopOpacity", "stop-opacity"],
    ["strikethroughPosition", "strikethrough-position"],
    ["strikethroughThickness", "strikethrough-thickness"],
    ["strokeDasharray", "stroke-dasharray"],
    ["strokeDashoffset", "stroke-dashoffset"],
    ["strokeLinecap", "stroke-linecap"],
    ["strokeLinejoin", "stroke-linejoin"],
    ["strokeMiterlimit", "stroke-miterlimit"],
    ["strokeOpacity", "stroke-opacity"],
    ["strokeWidth", "stroke-width"],
    ["textAnchor", "text-anchor"],
    ["textDecoration", "text-decoration"],
    ["textRendering", "text-rendering"],
    ["transformOrigin", "transform-origin"],
    ["underlinePosition", "underline-position"],
    ["underlineThickness", "underline-thickness"],
    ["unicodeBidi", "unicode-bidi"],
    ["unicodeRange", "unicode-range"],
    ["unitsPerEm", "units-per-em"],
    ["vAlphabetic", "v-alphabetic"],
    ["vHanging", "v-hanging"],
    ["vIdeographic", "v-ideographic"],
    ["vMathematical", "v-mathematical"],
    ["vectorEffect", "vector-effect"],
    ["vertAdvY", "vert-adv-y"],
    ["vertOriginX", "vert-origin-x"],
    ["vertOriginY", "vert-origin-y"],
    ["wordSpacing", "word-spacing"],
    ["writingMode", "writing-mode"],
    ["xmlnsXlink", "xmlns:xlink"],
    ["xHeight", "x-height"]
  ]);
  isJavaScriptProtocol = /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;
  canUseDOM = !(typeof window === "undefined" || typeof window.document === "undefined" || typeof window.document.createElement === "undefined");
  if (canUseDOM)
    try {
      options = {};
      Object.defineProperty(options, "passive", {
        get: function() {
          passiveBrowserEventsSupported = true;
        }
      });
      window.addEventListener("test", options, options);
      window.removeEventListener("test", options, options);
    } catch (e) {
      passiveBrowserEventsSupported = false;
    }
  EventInterface = {
    eventPhase: 0,
    bubbles: 0,
    cancelable: 0,
    timeStamp: function(event) {
      return event.timeStamp || Date.now();
    },
    defaultPrevented: 0,
    isTrusted: 0
  };
  SyntheticEvent = createSyntheticEvent(EventInterface);
  UIEventInterface = assign({}, EventInterface, { view: 0, detail: 0 });
  SyntheticUIEvent = createSyntheticEvent(UIEventInterface);
  MouseEventInterface = assign({}, UIEventInterface, {
    screenX: 0,
    screenY: 0,
    clientX: 0,
    clientY: 0,
    pageX: 0,
    pageY: 0,
    ctrlKey: 0,
    shiftKey: 0,
    altKey: 0,
    metaKey: 0,
    getModifierState: getEventModifierState,
    button: 0,
    buttons: 0,
    relatedTarget: function(event) {
      return event.relatedTarget === undefined ? event.fromElement === event.srcElement ? event.toElement : event.fromElement : event.relatedTarget;
    },
    movementX: function(event) {
      if ("movementX" in event)
        return event.movementX;
      event !== lastMouseEvent && (lastMouseEvent && event.type === "mousemove" ? (lastMovementX = event.screenX - lastMouseEvent.screenX, lastMovementY = event.screenY - lastMouseEvent.screenY) : lastMovementY = lastMovementX = 0, lastMouseEvent = event);
      return lastMovementX;
    },
    movementY: function(event) {
      return "movementY" in event ? event.movementY : lastMovementY;
    }
  });
  SyntheticMouseEvent = createSyntheticEvent(MouseEventInterface);
  DragEventInterface = assign({}, MouseEventInterface, { dataTransfer: 0 });
  SyntheticDragEvent = createSyntheticEvent(DragEventInterface);
  FocusEventInterface = assign({}, UIEventInterface, { relatedTarget: 0 });
  SyntheticFocusEvent = createSyntheticEvent(FocusEventInterface);
  AnimationEventInterface = assign({}, EventInterface, {
    animationName: 0,
    elapsedTime: 0,
    pseudoElement: 0
  });
  SyntheticAnimationEvent = createSyntheticEvent(AnimationEventInterface);
  ClipboardEventInterface = assign({}, EventInterface, {
    clipboardData: function(event) {
      return "clipboardData" in event ? event.clipboardData : window.clipboardData;
    }
  });
  SyntheticClipboardEvent = createSyntheticEvent(ClipboardEventInterface);
  CompositionEventInterface = assign({}, EventInterface, { data: 0 });
  SyntheticCompositionEvent = createSyntheticEvent(CompositionEventInterface);
  normalizeKey = {
    Esc: "Escape",
    Spacebar: " ",
    Left: "ArrowLeft",
    Up: "ArrowUp",
    Right: "ArrowRight",
    Down: "ArrowDown",
    Del: "Delete",
    Win: "OS",
    Menu: "ContextMenu",
    Apps: "ContextMenu",
    Scroll: "ScrollLock",
    MozPrintableKey: "Unidentified"
  };
  translateToKey = {
    8: "Backspace",
    9: "Tab",
    12: "Clear",
    13: "Enter",
    16: "Shift",
    17: "Control",
    18: "Alt",
    19: "Pause",
    20: "CapsLock",
    27: "Escape",
    32: " ",
    33: "PageUp",
    34: "PageDown",
    35: "End",
    36: "Home",
    37: "ArrowLeft",
    38: "ArrowUp",
    39: "ArrowRight",
    40: "ArrowDown",
    45: "Insert",
    46: "Delete",
    112: "F1",
    113: "F2",
    114: "F3",
    115: "F4",
    116: "F5",
    117: "F6",
    118: "F7",
    119: "F8",
    120: "F9",
    121: "F10",
    122: "F11",
    123: "F12",
    144: "NumLock",
    145: "ScrollLock",
    224: "Meta"
  };
  modifierKeyToProp = {
    Alt: "altKey",
    Control: "ctrlKey",
    Meta: "metaKey",
    Shift: "shiftKey"
  };
  KeyboardEventInterface = assign({}, UIEventInterface, {
    key: function(nativeEvent) {
      if (nativeEvent.key) {
        var key = normalizeKey[nativeEvent.key] || nativeEvent.key;
        if (key !== "Unidentified")
          return key;
      }
      return nativeEvent.type === "keypress" ? (nativeEvent = getEventCharCode(nativeEvent), nativeEvent === 13 ? "Enter" : String.fromCharCode(nativeEvent)) : nativeEvent.type === "keydown" || nativeEvent.type === "keyup" ? translateToKey[nativeEvent.keyCode] || "Unidentified" : "";
    },
    code: 0,
    location: 0,
    ctrlKey: 0,
    shiftKey: 0,
    altKey: 0,
    metaKey: 0,
    repeat: 0,
    locale: 0,
    getModifierState: getEventModifierState,
    charCode: function(event) {
      return event.type === "keypress" ? getEventCharCode(event) : 0;
    },
    keyCode: function(event) {
      return event.type === "keydown" || event.type === "keyup" ? event.keyCode : 0;
    },
    which: function(event) {
      return event.type === "keypress" ? getEventCharCode(event) : event.type === "keydown" || event.type === "keyup" ? event.keyCode : 0;
    }
  });
  SyntheticKeyboardEvent = createSyntheticEvent(KeyboardEventInterface);
  PointerEventInterface = assign({}, MouseEventInterface, {
    pointerId: 0,
    width: 0,
    height: 0,
    pressure: 0,
    tangentialPressure: 0,
    tiltX: 0,
    tiltY: 0,
    twist: 0,
    pointerType: 0,
    isPrimary: 0
  });
  SyntheticPointerEvent = createSyntheticEvent(PointerEventInterface);
  TouchEventInterface = assign({}, UIEventInterface, {
    touches: 0,
    targetTouches: 0,
    changedTouches: 0,
    altKey: 0,
    metaKey: 0,
    ctrlKey: 0,
    shiftKey: 0,
    getModifierState: getEventModifierState
  });
  SyntheticTouchEvent = createSyntheticEvent(TouchEventInterface);
  TransitionEventInterface = assign({}, EventInterface, {
    propertyName: 0,
    elapsedTime: 0,
    pseudoElement: 0
  });
  SyntheticTransitionEvent = createSyntheticEvent(TransitionEventInterface);
  WheelEventInterface = assign({}, MouseEventInterface, {
    deltaX: function(event) {
      return "deltaX" in event ? event.deltaX : ("wheelDeltaX" in event) ? -event.wheelDeltaX : 0;
    },
    deltaY: function(event) {
      return "deltaY" in event ? event.deltaY : ("wheelDeltaY" in event) ? -event.wheelDeltaY : ("wheelDelta" in event) ? -event.wheelDelta : 0;
    },
    deltaZ: 0,
    deltaMode: 0
  });
  SyntheticWheelEvent = createSyntheticEvent(WheelEventInterface);
  ToggleEventInterface = assign({}, EventInterface, {
    newState: 0,
    oldState: 0
  });
  SyntheticToggleEvent = createSyntheticEvent(ToggleEventInterface);
  END_KEYCODES = [9, 13, 27, 32];
  canUseCompositionEvent = canUseDOM && "CompositionEvent" in window;
  canUseDOM && "documentMode" in document && (documentMode = document.documentMode);
  canUseTextInputEvent = canUseDOM && "TextEvent" in window && !documentMode;
  useFallbackCompositionData = canUseDOM && (!canUseCompositionEvent || documentMode && 8 < documentMode && 11 >= documentMode);
  SPACEBAR_CHAR = String.fromCharCode(32);
  supportedInputTypes = {
    color: true,
    date: true,
    datetime: true,
    "datetime-local": true,
    email: true,
    month: true,
    number: true,
    password: true,
    range: true,
    search: true,
    tel: true,
    text: true,
    time: true,
    url: true,
    week: true
  };
  if (canUseDOM) {
    if (canUseDOM) {
      isSupported$jscomp$inline_473 = "oninput" in document;
      if (!isSupported$jscomp$inline_473) {
        element$jscomp$inline_474 = document.createElement("div");
        element$jscomp$inline_474.setAttribute("oninput", "return;");
        isSupported$jscomp$inline_473 = typeof element$jscomp$inline_474.oninput === "function";
      }
      JSCompiler_inline_result$jscomp$330 = isSupported$jscomp$inline_473;
    } else
      JSCompiler_inline_result$jscomp$330 = false;
    isInputEventSupported = JSCompiler_inline_result$jscomp$330 && (!document.documentMode || 9 < document.documentMode);
  }
  objectIs = typeof Object.is === "function" ? Object.is : is;
  skipSelectionChangeEvent = canUseDOM && "documentMode" in document && 11 >= document.documentMode;
  vendorPrefixes = {
    animationend: makePrefixMap("Animation", "AnimationEnd"),
    animationiteration: makePrefixMap("Animation", "AnimationIteration"),
    animationstart: makePrefixMap("Animation", "AnimationStart"),
    transitionrun: makePrefixMap("Transition", "TransitionRun"),
    transitionstart: makePrefixMap("Transition", "TransitionStart"),
    transitioncancel: makePrefixMap("Transition", "TransitionCancel"),
    transitionend: makePrefixMap("Transition", "TransitionEnd")
  };
  prefixedEventNames = {};
  style = {};
  canUseDOM && (style = document.createElement("div").style, ("AnimationEvent" in window) || (delete vendorPrefixes.animationend.animation, delete vendorPrefixes.animationiteration.animation, delete vendorPrefixes.animationstart.animation), ("TransitionEvent" in window) || delete vendorPrefixes.transitionend.transition);
  ANIMATION_END = getVendorPrefixedEventName("animationend");
  ANIMATION_ITERATION = getVendorPrefixedEventName("animationiteration");
  ANIMATION_START = getVendorPrefixedEventName("animationstart");
  TRANSITION_RUN = getVendorPrefixedEventName("transitionrun");
  TRANSITION_START = getVendorPrefixedEventName("transitionstart");
  TRANSITION_CANCEL = getVendorPrefixedEventName("transitioncancel");
  TRANSITION_END = getVendorPrefixedEventName("transitionend");
  topLevelEventsToReactNames = new Map;
  simpleEventPluginEvents = "abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");
  simpleEventPluginEvents.push("scrollEnd");
  reportGlobalError = typeof reportError === "function" ? reportError : function(error) {
    if (typeof window === "object" && typeof window.ErrorEvent === "function") {
      var event = new window.ErrorEvent("error", {
        bubbles: true,
        cancelable: true,
        message: typeof error === "object" && error !== null && typeof error.message === "string" ? String(error.message) : String(error),
        error
      });
      if (!window.dispatchEvent(event))
        return;
    } else if (typeof process === "object" && typeof process.emit === "function") {
      process.emit("uncaughtException", error);
      return;
    }
    console.error(error);
  };
  supportsUserTiming = typeof console !== "undefined" && typeof console.timeStamp === "function" && true;
  reusableComponentDevToolDetails = {
    color: "primary",
    properties: null,
    tooltipText: "",
    track: "Components ⚛"
  };
  reusableComponentOptions = {
    start: -0,
    end: -0,
    detail: { devtools: reusableComponentDevToolDetails }
  };
  concurrentQueues = [];
  emptyContextObject = {};
  CapturedStacks = new WeakMap;
  forkStack = [];
  idStack = [];
  HydrationMismatchException = Error(formatProdErrorMessage(519));
  valueCursor = createCursor(null);
  AbortControllerLocal = typeof AbortController !== "undefined" ? AbortController : function() {
    var listeners = [], signal = this.signal = {
      aborted: false,
      addEventListener: function(type, listener) {
        listeners.push(listener);
      }
    };
    this.abort = function() {
      signal.aborted = true;
      listeners.forEach(function(listener) {
        return listener();
      });
    };
  };
  scheduleCallback$2 = Scheduler.unstable_scheduleCallback;
  NormalPriority = Scheduler.unstable_NormalPriority;
  CacheContext = {
    $$typeof: REACT_CONTEXT_TYPE,
    Consumer: null,
    Provider: null,
    _currentValue: null,
    _currentValue2: null,
    _threadCount: 0
  };
  now = Scheduler.unstable_now;
  prevOnStartTransitionFinish = ReactSharedInternals.S;
  ReactSharedInternals.S = function(transition, returnValue) {
    globalMostRecentTransitionTime = now$1();
    if (typeof returnValue === "object" && returnValue !== null && typeof returnValue.then === "function") {
      if (0 > transitionStartTime && 0 > transitionUpdateTime) {
        transitionStartTime = now();
        var newEventTime = resolveEventTimeStamp(), newEventType = resolveEventType();
        if (newEventTime !== transitionEventRepeatTime || newEventType !== transitionEventType)
          transitionEventRepeatTime = -1.1;
        transitionEventTime = newEventTime;
        transitionEventType = newEventType;
      }
      entangleAsyncAction(transition, returnValue);
    }
    prevOnStartTransitionFinish !== null && prevOnStartTransitionFinish(transition, returnValue);
  };
  resumedCache = createCursor(null);
  SuspenseException = Error(formatProdErrorMessage(460));
  SuspenseyCommitException = Error(formatProdErrorMessage(474));
  SuspenseActionException = Error(formatProdErrorMessage(542));
  noopSuspenseyCommitThenable = { then: function() {} };
  reconcileChildFibers = createChildReconciler(true);
  mountChildFibers = createChildReconciler(false);
  currentTreeHiddenStackCursor = createCursor(null);
  prevEntangledRenderLanesCursor = createCursor(0);
  suspenseHandlerStackCursor = createCursor(null);
  suspenseStackCursor = createCursor(0);
  ContextOnlyDispatcher = {
    readContext,
    use,
    useCallback: throwInvalidHookError,
    useContext: throwInvalidHookError,
    useEffect: throwInvalidHookError,
    useImperativeHandle: throwInvalidHookError,
    useLayoutEffect: throwInvalidHookError,
    useInsertionEffect: throwInvalidHookError,
    useMemo: throwInvalidHookError,
    useReducer: throwInvalidHookError,
    useRef: throwInvalidHookError,
    useState: throwInvalidHookError,
    useDebugValue: throwInvalidHookError,
    useDeferredValue: throwInvalidHookError,
    useTransition: throwInvalidHookError,
    useSyncExternalStore: throwInvalidHookError,
    useId: throwInvalidHookError,
    useHostTransitionStatus: throwInvalidHookError,
    useFormState: throwInvalidHookError,
    useActionState: throwInvalidHookError,
    useOptimistic: throwInvalidHookError,
    useMemoCache: throwInvalidHookError,
    useCacheRefresh: throwInvalidHookError
  };
  ContextOnlyDispatcher.useEffectEvent = throwInvalidHookError;
  HooksDispatcherOnMount = {
    readContext,
    use,
    useCallback: function(callback, deps) {
      mountWorkInProgressHook().memoizedState = [
        callback,
        deps === undefined ? null : deps
      ];
      return callback;
    },
    useContext: readContext,
    useEffect: mountEffect,
    useImperativeHandle: function(ref, create, deps) {
      deps = deps !== null && deps !== undefined ? deps.concat([ref]) : null;
      mountEffectImpl(4194308, 4, imperativeHandleEffect.bind(null, create, ref), deps);
    },
    useLayoutEffect: function(create, deps) {
      return mountEffectImpl(4194308, 4, create, deps);
    },
    useInsertionEffect: function(create, deps) {
      mountEffectImpl(4, 2, create, deps);
    },
    useMemo: function(nextCreate, deps) {
      var hook = mountWorkInProgressHook();
      deps = deps === undefined ? null : deps;
      var nextValue = nextCreate();
      if (shouldDoubleInvokeUserFnsInHooksDEV) {
        setIsStrictModeForDevtools(true);
        try {
          nextCreate();
        } finally {
          setIsStrictModeForDevtools(false);
        }
      }
      hook.memoizedState = [nextValue, deps];
      return nextValue;
    },
    useReducer: function(reducer, initialArg, init) {
      var hook = mountWorkInProgressHook();
      if (init !== undefined) {
        var initialState = init(initialArg);
        if (shouldDoubleInvokeUserFnsInHooksDEV) {
          setIsStrictModeForDevtools(true);
          try {
            init(initialArg);
          } finally {
            setIsStrictModeForDevtools(false);
          }
        }
      } else
        initialState = initialArg;
      hook.memoizedState = hook.baseState = initialState;
      reducer = {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: reducer,
        lastRenderedState: initialState
      };
      hook.queue = reducer;
      reducer = reducer.dispatch = dispatchReducerAction.bind(null, currentlyRenderingFiber, reducer);
      return [hook.memoizedState, reducer];
    },
    useRef: function(initialValue) {
      var hook = mountWorkInProgressHook();
      initialValue = { current: initialValue };
      return hook.memoizedState = initialValue;
    },
    useState: function(initialState) {
      initialState = mountStateImpl(initialState);
      var queue = initialState.queue, dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue);
      queue.dispatch = dispatch;
      return [initialState.memoizedState, dispatch];
    },
    useDebugValue: mountDebugValue,
    useDeferredValue: function(value, initialValue) {
      var hook = mountWorkInProgressHook();
      return mountDeferredValueImpl(hook, value, initialValue);
    },
    useTransition: function() {
      var stateHook = mountStateImpl(false);
      stateHook = startTransition.bind(null, currentlyRenderingFiber, stateHook.queue, true, false);
      mountWorkInProgressHook().memoizedState = stateHook;
      return [false, stateHook];
    },
    useSyncExternalStore: function(subscribe, getSnapshot, getServerSnapshot) {
      var fiber = currentlyRenderingFiber, hook = mountWorkInProgressHook();
      if (isHydrating) {
        if (getServerSnapshot === undefined)
          throw Error(formatProdErrorMessage(407));
        getServerSnapshot = getServerSnapshot();
      } else {
        getServerSnapshot = getSnapshot();
        if (workInProgressRoot === null)
          throw Error(formatProdErrorMessage(349));
        (workInProgressRootRenderLanes & 127) !== 0 || pushStoreConsistencyCheck(fiber, getSnapshot, getServerSnapshot);
      }
      hook.memoizedState = getServerSnapshot;
      var inst = { value: getServerSnapshot, getSnapshot };
      hook.queue = inst;
      mountEffect(subscribeToStore.bind(null, fiber, inst, subscribe), [
        subscribe
      ]);
      fiber.flags |= 2048;
      pushSimpleEffect(9, { destroy: undefined }, updateStoreInstance.bind(null, fiber, inst, getServerSnapshot, getSnapshot), null);
      return getServerSnapshot;
    },
    useId: function() {
      var hook = mountWorkInProgressHook(), identifierPrefix = workInProgressRoot.identifierPrefix;
      if (isHydrating) {
        var JSCompiler_inline_result = treeContextOverflow;
        var idWithLeadingBit = treeContextId;
        JSCompiler_inline_result = (idWithLeadingBit & ~(1 << 32 - clz32(idWithLeadingBit) - 1)).toString(32) + JSCompiler_inline_result;
        identifierPrefix = "_" + identifierPrefix + "R_" + JSCompiler_inline_result;
        JSCompiler_inline_result = localIdCounter++;
        0 < JSCompiler_inline_result && (identifierPrefix += "H" + JSCompiler_inline_result.toString(32));
        identifierPrefix += "_";
      } else
        JSCompiler_inline_result = globalClientIdCounter++, identifierPrefix = "_" + identifierPrefix + "r_" + JSCompiler_inline_result.toString(32) + "_";
      return hook.memoizedState = identifierPrefix;
    },
    useHostTransitionStatus,
    useFormState: mountActionState,
    useActionState: mountActionState,
    useOptimistic: function(passthrough) {
      var hook = mountWorkInProgressHook();
      hook.memoizedState = hook.baseState = passthrough;
      var queue = {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: null,
        lastRenderedState: null
      };
      hook.queue = queue;
      hook = dispatchOptimisticSetState.bind(null, currentlyRenderingFiber, true, queue);
      queue.dispatch = hook;
      return [passthrough, hook];
    },
    useMemoCache,
    useCacheRefresh: function() {
      return mountWorkInProgressHook().memoizedState = refreshCache.bind(null, currentlyRenderingFiber);
    },
    useEffectEvent: function(callback) {
      var hook = mountWorkInProgressHook(), ref = { impl: callback };
      hook.memoizedState = ref;
      return function() {
        if ((executionContext & 2) !== 0)
          throw Error(formatProdErrorMessage(440));
        return ref.impl.apply(undefined, arguments);
      };
    }
  };
  HooksDispatcherOnUpdate = {
    readContext,
    use,
    useCallback: updateCallback,
    useContext: readContext,
    useEffect: updateEffect,
    useImperativeHandle: updateImperativeHandle,
    useInsertionEffect: updateInsertionEffect,
    useLayoutEffect: updateLayoutEffect,
    useMemo: updateMemo,
    useReducer: updateReducer,
    useRef: updateRef,
    useState: function() {
      return updateReducer(basicStateReducer);
    },
    useDebugValue: mountDebugValue,
    useDeferredValue: function(value, initialValue) {
      var hook = updateWorkInProgressHook();
      return updateDeferredValueImpl(hook, currentHook.memoizedState, value, initialValue);
    },
    useTransition: function() {
      var booleanOrThenable = updateReducer(basicStateReducer)[0], start = updateWorkInProgressHook().memoizedState;
      return [
        typeof booleanOrThenable === "boolean" ? booleanOrThenable : useThenable(booleanOrThenable),
        start
      ];
    },
    useSyncExternalStore: updateSyncExternalStore,
    useId: updateId,
    useHostTransitionStatus,
    useFormState: updateActionState,
    useActionState: updateActionState,
    useOptimistic: function(passthrough, reducer) {
      var hook = updateWorkInProgressHook();
      return updateOptimisticImpl(hook, currentHook, passthrough, reducer);
    },
    useMemoCache,
    useCacheRefresh: updateRefresh
  };
  HooksDispatcherOnUpdate.useEffectEvent = updateEvent;
  HooksDispatcherOnRerender = {
    readContext,
    use,
    useCallback: updateCallback,
    useContext: readContext,
    useEffect: updateEffect,
    useImperativeHandle: updateImperativeHandle,
    useInsertionEffect: updateInsertionEffect,
    useLayoutEffect: updateLayoutEffect,
    useMemo: updateMemo,
    useReducer: rerenderReducer,
    useRef: updateRef,
    useState: function() {
      return rerenderReducer(basicStateReducer);
    },
    useDebugValue: mountDebugValue,
    useDeferredValue: function(value, initialValue) {
      var hook = updateWorkInProgressHook();
      return currentHook === null ? mountDeferredValueImpl(hook, value, initialValue) : updateDeferredValueImpl(hook, currentHook.memoizedState, value, initialValue);
    },
    useTransition: function() {
      var booleanOrThenable = rerenderReducer(basicStateReducer)[0], start = updateWorkInProgressHook().memoizedState;
      return [
        typeof booleanOrThenable === "boolean" ? booleanOrThenable : useThenable(booleanOrThenable),
        start
      ];
    },
    useSyncExternalStore: updateSyncExternalStore,
    useId: updateId,
    useHostTransitionStatus,
    useFormState: rerenderActionState,
    useActionState: rerenderActionState,
    useOptimistic: function(passthrough, reducer) {
      var hook = updateWorkInProgressHook();
      if (currentHook !== null)
        return updateOptimisticImpl(hook, currentHook, passthrough, reducer);
      hook.baseState = passthrough;
      return [passthrough, hook.queue.dispatch];
    },
    useMemoCache,
    useCacheRefresh: updateRefresh
  };
  HooksDispatcherOnRerender.useEffectEvent = updateEvent;
  classComponentUpdater = {
    enqueueSetState: function(inst, payload, callback) {
      inst = inst._reactInternals;
      var lane = requestUpdateLane(), update = createUpdate(lane);
      update.payload = payload;
      callback !== undefined && callback !== null && (update.callback = callback);
      payload = enqueueUpdate(inst, update, lane);
      payload !== null && (startUpdateTimerByLane(lane), scheduleUpdateOnFiber(payload, inst, lane), entangleTransitions(payload, inst, lane));
    },
    enqueueReplaceState: function(inst, payload, callback) {
      inst = inst._reactInternals;
      var lane = requestUpdateLane(), update = createUpdate(lane);
      update.tag = 1;
      update.payload = payload;
      callback !== undefined && callback !== null && (update.callback = callback);
      payload = enqueueUpdate(inst, update, lane);
      payload !== null && (startUpdateTimerByLane(lane), scheduleUpdateOnFiber(payload, inst, lane), entangleTransitions(payload, inst, lane));
    },
    enqueueForceUpdate: function(inst, callback) {
      inst = inst._reactInternals;
      var lane = requestUpdateLane(), update = createUpdate(lane);
      update.tag = 2;
      callback !== undefined && callback !== null && (update.callback = callback);
      callback = enqueueUpdate(inst, update, lane);
      callback !== null && (startUpdateTimerByLane(lane), scheduleUpdateOnFiber(callback, inst, lane), entangleTransitions(callback, inst, lane));
    }
  };
  SelectiveHydrationException = Error(formatProdErrorMessage(461));
  SUSPENDED_MARKER = {
    dehydrated: null,
    treeContext: null,
    retryLane: 0,
    hydrationErrors: null
  };
  PossiblyWeakSet = typeof WeakSet === "function" ? WeakSet : Set;
  DefaultAsyncDispatcher = {
    getCacheForType: function(resourceType) {
      var cache = readContext(CacheContext), cacheForType = cache.data.get(resourceType);
      cacheForType === undefined && (cacheForType = resourceType(), cache.data.set(resourceType, cacheForType));
      return cacheForType;
    },
    cacheSignal: function() {
      return readContext(CacheContext).controller.signal;
    }
  };
  PossiblyWeakMap = typeof WeakMap === "function" ? WeakMap : Map;
  for (i$jscomp$inline_1875 = 0;i$jscomp$inline_1875 < simpleEventPluginEvents.length; i$jscomp$inline_1875++) {
    eventName$jscomp$inline_1876 = simpleEventPluginEvents[i$jscomp$inline_1875], domEventName$jscomp$inline_1877 = eventName$jscomp$inline_1876.toLowerCase(), capitalizedEvent$jscomp$inline_1878 = eventName$jscomp$inline_1876[0].toUpperCase() + eventName$jscomp$inline_1876.slice(1);
    registerSimpleEvent(domEventName$jscomp$inline_1877, "on" + capitalizedEvent$jscomp$inline_1878);
  }
  registerSimpleEvent(ANIMATION_END, "onAnimationEnd");
  registerSimpleEvent(ANIMATION_ITERATION, "onAnimationIteration");
  registerSimpleEvent(ANIMATION_START, "onAnimationStart");
  registerSimpleEvent("dblclick", "onDoubleClick");
  registerSimpleEvent("focusin", "onFocus");
  registerSimpleEvent("focusout", "onBlur");
  registerSimpleEvent(TRANSITION_RUN, "onTransitionRun");
  registerSimpleEvent(TRANSITION_START, "onTransitionStart");
  registerSimpleEvent(TRANSITION_CANCEL, "onTransitionCancel");
  registerSimpleEvent(TRANSITION_END, "onTransitionEnd");
  registerDirectEvent("onMouseEnter", ["mouseout", "mouseover"]);
  registerDirectEvent("onMouseLeave", ["mouseout", "mouseover"]);
  registerDirectEvent("onPointerEnter", ["pointerout", "pointerover"]);
  registerDirectEvent("onPointerLeave", ["pointerout", "pointerover"]);
  registerTwoPhaseEvent("onChange", "change click focusin focusout input keydown keyup selectionchange".split(" "));
  registerTwoPhaseEvent("onSelect", "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" "));
  registerTwoPhaseEvent("onBeforeInput", [
    "compositionend",
    "keypress",
    "textInput",
    "paste"
  ]);
  registerTwoPhaseEvent("onCompositionEnd", "compositionend focusout keydown keypress keyup mousedown".split(" "));
  registerTwoPhaseEvent("onCompositionStart", "compositionstart focusout keydown keypress keyup mousedown".split(" "));
  registerTwoPhaseEvent("onCompositionUpdate", "compositionupdate focusout keydown keypress keyup mousedown".split(" "));
  mediaEventTypes = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" ");
  nonDelegatedEvents = new Set("beforetoggle cancel close invalid load scroll scrollend toggle".split(" ").concat(mediaEventTypes));
  listeningMarker = "_reactListening" + Math.random().toString(36).slice(2);
  NORMALIZE_NEWLINES_REGEX = /\r\n?/g;
  NORMALIZE_NULL_AND_REPLACEMENT_REGEX = /\u0000|\uFFFD/g;
  scheduleTimeout = typeof setTimeout === "function" ? setTimeout : undefined;
  cancelTimeout = typeof clearTimeout === "function" ? clearTimeout : undefined;
  localPromise = typeof Promise === "function" ? Promise : undefined;
  scheduleMicrotask = typeof queueMicrotask === "function" ? queueMicrotask : typeof localPromise !== "undefined" ? function(callback) {
    return localPromise.resolve(null).then(callback).catch(handleErrorInNextTick);
  } : scheduleTimeout;
  preloadPropsMap = new Map;
  preconnectsSet = new Set;
  previousDispatcher = ReactDOMSharedInternals.d;
  ReactDOMSharedInternals.d = {
    f: flushSyncWork,
    r: requestFormReset$1,
    D: prefetchDNS$1,
    C: preconnect$1,
    L: preload$1,
    m: preloadModule$1,
    X: preinitScript,
    S: preinitStyle,
    M: preinitModuleScript
  };
  globalDocument = typeof document === "undefined" ? null : document;
  HostTransitionContext = {
    $$typeof: REACT_CONTEXT_TYPE,
    Provider: null,
    Consumer: null,
    _currentValue: sharedNotPendingObject,
    _currentValue2: sharedNotPendingObject,
    _threadCount: 0
  };
  queuedPointers = new Map;
  queuedPointerCaptures = new Map;
  queuedExplicitHydrationTargets = [];
  discreteReplayableEvents = "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset".split(" ");
  ReactDOMHydrationRoot.prototype.render = ReactDOMRoot.prototype.render = function(children) {
    var root2 = this._internalRoot;
    if (root2 === null)
      throw Error(formatProdErrorMessage(409));
    var current = root2.current, lane = requestUpdateLane();
    updateContainerImpl(current, lane, children, root2, null, null);
  };
  ReactDOMHydrationRoot.prototype.unmount = ReactDOMRoot.prototype.unmount = function() {
    var root2 = this._internalRoot;
    if (root2 !== null) {
      this._internalRoot = null;
      var container = root2.containerInfo;
      updateContainerImpl(root2.current, 2, null, root2, null, null);
      flushSyncWork$1();
      container[internalContainerInstanceKey] = null;
    }
  };
  ReactDOMHydrationRoot.prototype.unstable_scheduleHydration = function(target) {
    if (target) {
      var updatePriority = resolveUpdatePriority();
      target = { blockedOn: null, target, priority: updatePriority };
      for (var i = 0;i < queuedExplicitHydrationTargets.length && updatePriority !== 0 && updatePriority < queuedExplicitHydrationTargets[i].priority; i++)
        ;
      queuedExplicitHydrationTargets.splice(i, 0, target);
      i === 0 && attemptExplicitHydrationTarget(target);
    }
  };
  isomorphicReactPackageVersion$jscomp$inline_2138 = React.version;
  if (isomorphicReactPackageVersion$jscomp$inline_2138 !== "19.2.7")
    throw Error(formatProdErrorMessage(527, isomorphicReactPackageVersion$jscomp$inline_2138, "19.2.7"));
  ReactDOMSharedInternals.findDOMNode = function(componentOrElement) {
    var fiber = componentOrElement._reactInternals;
    if (fiber === undefined) {
      if (typeof componentOrElement.render === "function")
        throw Error(formatProdErrorMessage(188));
      componentOrElement = Object.keys(componentOrElement).join(",");
      throw Error(formatProdErrorMessage(268, componentOrElement));
    }
    componentOrElement = findCurrentFiberUsingSlowPath(fiber);
    componentOrElement = componentOrElement !== null ? findCurrentHostFiberImpl(componentOrElement) : null;
    componentOrElement = componentOrElement === null ? null : componentOrElement.stateNode;
    return componentOrElement;
  };
  internals$jscomp$inline_2658 = {
    bundleType: 0,
    version: "19.2.7",
    rendererPackageName: "react-dom",
    currentDispatcherRef: ReactSharedInternals,
    reconcilerVersion: "19.2.7"
  };
  if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== "undefined") {
    hook$jscomp$inline_2659 = __REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!hook$jscomp$inline_2659.isDisabled && hook$jscomp$inline_2659.supportsFiber)
      try {
        rendererID = hook$jscomp$inline_2659.inject(internals$jscomp$inline_2658), injectedHook = hook$jscomp$inline_2659;
      } catch (err) {}
  }
  $__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = {
    d: {
      f: noop$1,
      r: function() {
        throw Error(formatProdErrorMessage(522));
      },
      D: noop$1,
      C: noop$1,
      L: noop$1,
      m: noop$1,
      X: noop$1,
      S: noop$1,
      M: noop$1
    },
    p: 0,
    findDOMNode: null
  };
  typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== "undefined" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop === "function" && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(Error());
});

// ../../node_modules/react-dom/profiling.js
var require_profiling = __commonJS((exports, module) => {
  init_react_dom_profiling_profiling();
  function checkDCE() {
    if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ === "undefined" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE !== "function") {
      return;
    }
    if (false) {}
    try {
      __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(checkDCE);
    } catch (err) {
      console.error(err);
    }
  }
  if (true) {
    checkDCE();
    module.exports = exports_react_dom_profiling_profiling;
  }
});

// src/main.tsx
var import_client = __toESM(require_profiling(), 1);

// src/App.tsx
var import_react24 = __toESM(require_react(), 1);

// src/lib/rpc-client.ts
class RpcClientClosedError extends Error {
  constructor() {
    super("RPC client closed");
    this.name = "RpcClientClosedError";
  }
}

class RpcCommandError extends Error {
  code;
  command;
  constructor(command, message, code) {
    super(`${command}: ${message}`);
    this.name = "RpcCommandError";
    this.command = command;
    this.code = code;
  }
}

class RpcIncompatibleError extends Error {
  constructor(message = "This omp is too old, restart it") {
    super(message);
    this.name = "RpcIncompatibleError";
  }
}

class RpcTimeoutError extends Error {
  constructor(command) {
    super(`${command}: timed out`);
    this.name = "RpcTimeoutError";
  }
}
var MAX_RPC_FRAME_BYTES = 1024 * 1024;
var MAX_RPC_REASSEMBLED_BYTES = 64 * 1024 * 1024;
var RPC_CHUNK_PAYLOAD_BYTES = 256 * 1024;
function isRpcChunkFrame(value) {
  return typeof value === "object" && value !== null && value.type === "rpc_chunk";
}
function isSafeInt(n) {
  return Number.isSafeInteger(n);
}

class BrowserFrameDecoder {
  #pending;
  push(value) {
    if (!isRpcChunkFrame(value)) {
      if (this.#pending)
        throw new Error("rpc chunk sequence interrupted");
      if (typeof value !== "object" || value === null)
        throw new Error("rpc frame must be an object");
      return value;
    }
    const { chunkId, index: index2, count, byteLength, data } = value;
    if (typeof chunkId !== "string" || chunkId.length === 0 || !isSafeInt(index2) || !isSafeInt(count) || !isSafeInt(byteLength) || index2 < 0 || count < 2 || count > Math.ceil(MAX_RPC_REASSEMBLED_BYTES / RPC_CHUNK_PAYLOAD_BYTES) || index2 >= count || byteLength < MAX_RPC_FRAME_BYTES || byteLength > MAX_RPC_REASSEMBLED_BYTES)
      throw new Error("invalid rpc chunk metadata");
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0;i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    if (bytes.byteLength > RPC_CHUNK_PAYLOAD_BYTES)
      throw new Error("rpc chunk payload exceeds the transport limit");
    if (!this.#pending) {
      if (index2 !== 0)
        throw new Error("rpc chunk sequence must start at index 0");
      this.#pending = {
        chunkId,
        count,
        byteLength,
        nextIndex: 0,
        chunks: [],
        receivedBytes: 0
      };
    }
    const pending = this.#pending;
    if (pending.chunkId !== chunkId || pending.count !== count || pending.byteLength !== byteLength || pending.nextIndex !== index2)
      throw new Error("rpc chunk sequence mismatch");
    pending.chunks.push(bytes);
    pending.receivedBytes += bytes.byteLength;
    pending.nextIndex++;
    if (pending.receivedBytes > pending.byteLength)
      throw new Error("rpc chunk sequence exceeds declared length");
    if (pending.nextIndex < pending.count)
      return;
    if (pending.receivedBytes !== pending.byteLength)
      throw new Error("rpc chunk sequence length mismatch");
    this.#pending = undefined;
    const merged = new Uint8Array(pending.receivedBytes);
    let offset = 0;
    for (const chunk of pending.chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(merged);
    const frame = JSON.parse(decoded);
    if (typeof frame !== "object" || frame === null)
      throw new Error("rpc frame must be an object");
    return frame;
  }
}
var DEFAULT_TIMEOUT_MS = 30000;
var DEDUPE_ALLOWLIST = {
  get_state: true,
  get_session_stats: true,
  get_subagents: true,
  get_plan_state: true,
  get_model_roles: true,
  get_model_browser: true,
  get_agents: true,
  get_login_status: true,
  get_available_commands: true
};
function dedupeKey(command) {
  const { id: _, ...params } = command;
  return JSON.stringify(params);
}
var SETTLED_ID_LIMIT = 256;

class RpcWebClient {
  #opts;
  #state = "closed";
  #ws = null;
  #lineBuffer = "";
  #frameDecoder = new BrowserFrameDecoder;
  #requestId = 0;
  #pending = new Map;
  #eventListeners = [];
  #stateListeners = [];
  #resyncListeners = [];
  #lateErrorListeners = [];
  #settledIds = new Set;
  #dedupeInflight = new Map;
  #sessionState = null;
  #intentionalClose = false;
  #reconnectTimer;
  #reconnectAttempt = 0;
  constructor(opts) {
    this.#opts = opts;
  }
  get state() {
    return this.#state;
  }
  get sessionState() {
    return this.#sessionState;
  }
  get reconnectAttempt() {
    return this.#reconnectAttempt;
  }
  get attemptCount() {
    return this.#reconnectAttempt;
  }
  connect() {
    if (this.#state === "incompatible") {
      return Promise.reject(new RpcIncompatibleError("Client is in incompatible state"));
    }
    if (this.#state !== "closed") {
      return Promise.reject(new Error("already connected or connecting"));
    }
    this.#intentionalClose = false;
    this.#reconnectAttempt = 0;
    return this.#openSocket(false);
  }
  reconnectNow() {
    if (this.#reconnectTimer !== undefined) {
      clearTimeout(this.#reconnectTimer);
      this.#reconnectTimer = undefined;
    }
    if (this.#state === "incompatible") {
      return;
    }
    if (this.#state === "closed") {
      this.#intentionalClose = false;
      this.#reconnectAttempt = 0;
      this.#openSocket(true).catch(() => {});
    } else if (this.#state === "reconnecting") {
      this.#openSocket(true).catch(() => {});
    }
  }
  #openSocket(isReconnect) {
    if (!isReconnect || this.#sessionState === null) {
      this.#setState("connecting");
    }
    const { promise, resolve, reject } = Promise.withResolvers();
    const ws = this.#opts.createSocket ? this.#opts.createSocket(this.#opts.url) : new WebSocket(this.#opts.url);
    this.#ws = ws;
    this.#lineBuffer = "";
    this.#frameDecoder = new BrowserFrameDecoder;
    let readyReceived = false;
    ws.addEventListener("message", (ev) => {
      const text = typeof ev.data === "string" ? ev.data : String(ev.data);
      this.#lineBuffer += text;
      const lines = this.#lineBuffer.split(`
`);
      this.#lineBuffer = lines.pop();
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length === 0)
          continue;
        let parsed;
        try {
          parsed = JSON.parse(trimmed);
        } catch {
          continue;
        }
        if (!readyReceived) {
          if (typeof parsed === "object" && parsed !== null && parsed.type === "ready") {
            readyReceived = true;
            this.#runAttachSequence(parsed, isReconnect).then(resolve, (err) => {
              if (this.#state === "incompatible") {
                if (isReconnect) {
                  resolve();
                } else {
                  reject(err);
                }
                return;
              }
              if (this.#opts.reconnect?.enabled) {
                this.#scheduleReconnect();
                resolve();
              } else {
                this.#cleanup();
                reject(err);
              }
            });
          }
          continue;
        }
        let frame;
        try {
          frame = this.#frameDecoder.push(parsed);
        } catch {
          continue;
        }
        if (frame)
          this.#dispatchFrame(frame);
      }
    });
    ws.addEventListener("error", () => {
      if (this.#state === "incompatible")
        return;
      if (!readyReceived) {
        if (this.#opts.reconnect?.enabled) {
          this.#scheduleReconnect();
          resolve();
        } else {
          this.#cleanup();
          reject(new Error("WebSocket error before ready"));
        }
      }
    });
    ws.addEventListener("close", () => {
      if (this.#state === "incompatible")
        return;
      if (!readyReceived) {
        if (this.#opts.reconnect?.enabled) {
          this.#scheduleReconnect();
          resolve();
        } else {
          this.#cleanup();
          reject(new Error("WebSocket closed before ready"));
        }
      } else {
        this.#handleUnexpectedClose();
      }
    });
    return promise;
  }
  close() {
    this.#intentionalClose = true;
    if (this.#reconnectTimer !== undefined) {
      clearTimeout(this.#reconnectTimer);
      this.#reconnectTimer = undefined;
    }
    if (this.#ws) {
      this.#ws.close();
    }
    this.#cleanup();
  }
  request(command, timeoutMs = DEFAULT_TIMEOUT_MS) {
    if (this.#state === "closed" || !this.#ws) {
      return Promise.reject(new RpcClientClosedError);
    }
    if (DEDUPE_ALLOWLIST[command.type]) {
      const key = dedupeKey(command);
      const inflight = this.#dedupeInflight.get(key);
      if (inflight)
        return inflight;
      const result = this.#sendRequest(command, timeoutMs);
      this.#dedupeInflight.set(key, result);
      const cleanup = () => {
        this.#dedupeInflight.delete(key);
      };
      result.then(cleanup, cleanup);
      return result;
    }
    return this.#sendRequest(command, timeoutMs);
  }
  #sendRequest(command, timeoutMs) {
    const id = String(++this.#requestId);
    const payload = { ...command, id };
    this.#ws.send(JSON.stringify(payload) + `
`);
    const { promise, resolve, reject } = Promise.withResolvers();
    const timer = timeoutMs > 0 ? setTimeout(() => {
      this.#pending.delete(id);
      reject(new RpcTimeoutError(command.type));
    }, timeoutMs) : undefined;
    this.#pending.set(id, {
      resolve,
      reject,
      timer
    });
    return promise;
  }
  history(opts = {}) {
    const command = {
      type: "history",
      ...opts.before !== undefined ? { before: opts.before } : {},
      ...opts.after !== undefined ? { after: opts.after } : {},
      ...opts.leafId !== undefined ? { leafId: opts.leafId } : {},
      ...opts.limit !== undefined ? { limit: opts.limit } : {}
    };
    return this.request(command).then((resp) => {
      const historyResp = resp;
      return historyResp.data;
    });
  }
  onEvent(listener) {
    this.#eventListeners.push(listener);
    return () => {
      const idx = this.#eventListeners.indexOf(listener);
      if (idx !== -1)
        this.#eventListeners.splice(idx, 1);
    };
  }
  onStateChange(listener) {
    this.#stateListeners.push(listener);
    return () => {
      const idx = this.#stateListeners.indexOf(listener);
      if (idx !== -1)
        this.#stateListeners.splice(idx, 1);
    };
  }
  onResync(listener) {
    this.#resyncListeners.push(listener);
    return () => {
      const idx = this.#resyncListeners.indexOf(listener);
      if (idx !== -1)
        this.#resyncListeners.splice(idx, 1);
    };
  }
  onLateError(listener) {
    this.#lateErrorListeners.push(listener);
    return () => {
      const idx = this.#lateErrorListeners.indexOf(listener);
      if (idx !== -1)
        this.#lateErrorListeners.splice(idx, 1);
    };
  }
  #rememberSettled(id) {
    this.#settledIds.add(id);
    if (this.#settledIds.size > SETTLED_ID_LIMIT) {
      const oldest = this.#settledIds.values().next().value;
      if (oldest !== undefined)
        this.#settledIds.delete(oldest);
    }
  }
  async#runAttachSequence(readyFrame, isReconnect) {
    const ready = readyFrame;
    const supportsV3 = Array.isArray(ready?.supportedProtocolVersions) && ready.supportedProtocolVersions.includes(3);
    if (!supportsV3) {
      const err = new RpcIncompatibleError("Host does not support protocol version 3");
      this.#handleIncompatible(err);
      throw err;
    }
    try {
      await this.request({
        type: "negotiate_protocol",
        protocolVersion: 3
      });
    } catch (err) {
      if (err instanceof RpcCommandError) {
        const error = new RpcIncompatibleError(err.message);
        this.#handleIncompatible(error);
        throw error;
      }
      throw err;
    }
    this.#setState("ready");
    const stateResp = await this.request({
      type: "get_state"
    });
    const typedStateResp = stateResp;
    this.#sessionState = typedStateResp.data;
    this.request(SUBAGENT_SUBSCRIBE_COMMAND).catch(() => {});
    if (isReconnect) {
      this.#reconnectAttempt = 0;
      for (const listener of this.#resyncListeners) {
        listener(this.#sessionState);
      }
    }
  }
  #handleIncompatible(err) {
    if (this.#reconnectTimer !== undefined) {
      clearTimeout(this.#reconnectTimer);
      this.#reconnectTimer = undefined;
    }
    this.#setState("incompatible");
    if (this.#ws) {
      this.#ws.close();
      this.#ws = null;
    }
    for (const entry of this.#pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(err);
    }
    this.#pending.clear();
    this.#dedupeInflight.clear();
  }
  #dispatchFrame(frame) {
    const record = frame;
    if (record.type === "response") {
      const resp = frame;
      const id = resp.id;
      if (id != null) {
        const entry = this.#pending.get(id);
        if (entry) {
          this.#pending.delete(id);
          if (entry.timer)
            clearTimeout(entry.timer);
          this.#rememberSettled(id);
          if (resp.success === false) {
            entry.reject(new RpcCommandError(resp.command, resp.error, resp.code));
          } else {
            entry.resolve(resp);
          }
          return;
        }
        if (resp.success === false && this.#settledIds.has(id)) {
          const err = new RpcCommandError(resp.command, resp.error, resp.code);
          for (const listener of this.#lateErrorListeners)
            listener(err);
        }
      }
      return;
    }
    if (record.type === "ready")
      return;
    for (const listener of this.#eventListeners) {
      listener(frame);
    }
  }
  #setState(state) {
    if (this.#state === state)
      return;
    this.#state = state;
    for (const listener of this.#stateListeners) {
      listener(state);
    }
  }
  #cleanup() {
    this.#ws = null;
    this.#lineBuffer = "";
    if (this.#state !== "incompatible") {
      this.#setState("closed");
    }
    const err = new RpcClientClosedError;
    for (const entry of this.#pending.values()) {
      if (entry.timer)
        clearTimeout(entry.timer);
      entry.reject(err);
    }
    this.#pending.clear();
    this.#dedupeInflight.clear();
  }
  #handleUnexpectedClose() {
    if (this.#state === "incompatible")
      return;
    const err = new RpcClientClosedError;
    for (const entry of this.#pending.values()) {
      if (entry.timer)
        clearTimeout(entry.timer);
      entry.reject(err);
    }
    this.#pending.clear();
    this.#dedupeInflight.clear();
    this.#ws = null;
    this.#lineBuffer = "";
    if (this.#intentionalClose) {
      this.#setState("closed");
      return;
    }
    const rc = this.#opts.reconnect;
    if (!rc || !rc.enabled) {
      this.#setState("closed");
      return;
    }
    if (this.#sessionState !== null) {
      this.#setState("reconnecting");
    } else {
      this.#setState("connecting");
    }
    this.#scheduleReconnect();
  }
  #scheduleReconnect() {
    if (this.#state === "incompatible")
      return;
    if (this.#intentionalClose) {
      this.#setState("closed");
      return;
    }
    if (this.#reconnectTimer !== undefined)
      return;
    const rc = this.#opts.reconnect;
    const base = rc.baseDelayMs ?? 500;
    const max = rc.maxDelayMs ?? 15000;
    const delay = Math.min(max, base * 2 ** this.#reconnectAttempt) * (0.5 + Math.random() * 0.5);
    this.#reconnectAttempt++;
    this.#reconnectTimer = setTimeout(() => {
      this.#reconnectTimer = undefined;
      if (this.#intentionalClose || this.#state === "incompatible") {
        return;
      }
      this.#openSocket(true).catch(() => {});
    }, delay);
  }
}

// src/lib/transcript-cache.ts
var DB_NAME = "webgui-transcripts";
var STORE_NAME = "transcripts";
var INDEX_KEY = "webgui.transcriptIndex";
var MAX_SESSIONS = 10;
var MAX_ENTRIES_PER_SESSION = 200;
var MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
var WRITE_THROTTLE_MS = 2000;
var MAX_SESSION_BYTES = 2 * 1024 * 1024;
var MAX_NO_CACHE_SESSIONS = 500;
function parseIndex(raw) {
  if (!raw) {
    return { byInstance: {}, bySession: {}, noCache: [] };
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      byInstance: parsed.byInstance && typeof parsed.byInstance === "object" ? parsed.byInstance : {},
      bySession: parsed.bySession && typeof parsed.bySession === "object" ? parsed.bySession : {},
      noCache: Array.isArray(parsed.noCache) ? parsed.noCache.filter((id) => typeof id === "string") : []
    };
  } catch {
    return { byInstance: {}, bySession: {}, noCache: [] };
  }
}
function writeIndex(payload) {
  try {
    browserWindow.localStorage?.setItem(INDEX_KEY, JSON.stringify(payload));
  } catch {}
}
function getIndex() {
  try {
    return parseIndex(browserWindow.localStorage?.getItem(INDEX_KEY) ?? null);
  } catch {
    return { byInstance: {}, bySession: {}, noCache: [] };
  }
}
function createTranscriptCache(options2 = {}) {
  const { dbName = DB_NAME, now: now2 = Date.now, listenLifecycle = true } = options2;
  let store = null;
  const pendingSaves = new Map;
  const dropGenerations = new Map;
  let throttleTimer;
  function getDbStore() {
    store ??= createStore(dbName, STORE_NAME);
    return store;
  }
  function pruneIndexKeys(index2, validSessionIds) {
    let changed = false;
    for (const sid of Object.keys(index2.bySession)) {
      if (!validSessionIds.has(sid)) {
        delete index2.bySession[sid];
        changed = true;
      }
    }
    for (const [inst, mapping] of Object.entries(index2.byInstance)) {
      if (!validSessionIds.has(mapping.sessionId)) {
        delete index2.byInstance[inst];
        changed = true;
      }
    }
    return changed;
  }
  async function evictOverflow(targetStore, currentTime) {
    try {
      const all = await entries(targetStore);
      const valid = [];
      for (const [key, value] of all) {
        if (typeof key !== "string")
          continue;
        if (!value || typeof value !== "object") {
          await del(key, targetStore).catch(() => {});
          continue;
        }
        const item = value;
        const savedAt = typeof item.savedAt === "number" ? item.savedAt : 0;
        if (currentTime - savedAt > MAX_AGE_MS) {
          await del(key, targetStore).catch(() => {});
        } else {
          valid.push({ sessionId: key, savedAt });
        }
      }
      if (valid.length > MAX_SESSIONS) {
        valid.sort((a, b) => a.savedAt - b.savedAt);
        const toRemove = valid.slice(0, valid.length - MAX_SESSIONS);
        for (const item of toRemove) {
          await del(item.sessionId, targetStore).catch(() => {});
        }
        const remainingIds = new Set(valid.slice(valid.length - MAX_SESSIONS).map((v) => v.sessionId));
        const index2 = getIndex();
        if (pruneIndexKeys(index2, remainingIds)) {
          writeIndex(index2);
        }
      } else {
        const remainingIds = new Set(valid.map((v) => v.sessionId));
        const index2 = getIndex();
        if (pruneIndexKeys(index2, remainingIds)) {
          writeIndex(index2);
        }
      }
    } catch {}
  }
  async function flush() {
    if (throttleTimer !== undefined) {
      clearTimeout(throttleTimer);
      throttleTimer = undefined;
    }
    if (pendingSaves.size === 0)
      return;
    const target = getDbStore();
    const saves = Array.from(pendingSaves.entries());
    pendingSaves.clear();
    const currentTime = now2();
    for (const [sessionId, { data, instanceId }] of saves) {
      if (getIndex().noCache.includes(sessionId))
        continue;
      const dropGenBefore = dropGenerations.get(sessionId) ?? 0;
      const totalEntries = data.entries.length;
      let trimmedEntries = data.entries;
      let trimmedHasMore = data.hasMore;
      if (totalEntries > MAX_ENTRIES_PER_SESSION) {
        trimmedEntries = data.entries.slice(totalEntries - MAX_ENTRIES_PER_SESSION);
        trimmedHasMore = true;
      }
      const record = {
        leafId: data.leafId,
        entries: trimmedEntries,
        hasMore: trimmedHasMore,
        savedAt: currentTime
      };
      try {
        const serialized = JSON.stringify(record);
        if (serialized.length > MAX_SESSION_BYTES) {
          continue;
        }
        await set(sessionId, record, target);
        const dropGenAfter = dropGenerations.get(sessionId) ?? 0;
        if (dropGenAfter !== dropGenBefore) {
          await del(sessionId, target).catch(() => {});
          continue;
        }
        const index2 = getIndex();
        index2.bySession[sessionId] = data.leafId;
        if (instanceId) {
          index2.byInstance[instanceId] = { sessionId, leafId: data.leafId };
        }
        writeIndex(index2);
      } catch {}
    }
    await evictOverflow(target, currentTime);
  }
  if (listenLifecycle) {
    browserWindow.addEventListener?.("pagehide", () => void flush());
    browserWindow.document?.addEventListener?.("visibilitychange", () => {
      if (browserWindow.document?.visibilityState === "hidden") {
        flush();
      }
    });
  }
  const api = {
    readIndex(key) {
      const index2 = getIndex();
      if (key.instanceId && index2.byInstance[key.instanceId]) {
        const info = index2.byInstance[key.instanceId];
        if (index2.noCache.includes(info.sessionId))
          return null;
        return { sessionId: info.sessionId, leafId: info.leafId };
      }
      if (key.sessionId && index2.noCache.includes(key.sessionId))
        return null;
      if (key.sessionId && Object.prototype.hasOwnProperty.call(index2.bySession, key.sessionId)) {
        return { sessionId: key.sessionId, leafId: index2.bySession[key.sessionId] ?? null };
      }
      return null;
    },
    setIndex(mapping) {
      const index2 = getIndex();
      if (index2.noCache.includes(mapping.sessionId))
        return;
      index2.bySession[mapping.sessionId] = mapping.leafId;
      if (mapping.instanceId) {
        index2.byInstance[mapping.instanceId] = {
          sessionId: mapping.sessionId,
          leafId: mapping.leafId
        };
      }
      writeIndex(index2);
    },
    deleteIndex(key) {
      const index2 = getIndex();
      let changed = false;
      if (key.instanceId && index2.byInstance[key.instanceId]) {
        delete index2.byInstance[key.instanceId];
        changed = true;
      }
      if (key.sessionId && Object.prototype.hasOwnProperty.call(index2.bySession, key.sessionId)) {
        delete index2.bySession[key.sessionId];
        for (const [inst, val] of Object.entries(index2.byInstance)) {
          if (val.sessionId === key.sessionId) {
            delete index2.byInstance[inst];
          }
        }
        changed = true;
      }
      if (changed) {
        writeIndex(index2);
      }
    },
    async loadSession(sessionId) {
      try {
        const target = getDbStore();
        const raw = await get(sessionId, target);
        if (!raw || typeof raw !== "object") {
          const index2 = getIndex();
          let changed = false;
          if (Object.prototype.hasOwnProperty.call(index2.bySession, sessionId)) {
            delete index2.bySession[sessionId];
            changed = true;
          }
          for (const [inst, val] of Object.entries(index2.byInstance)) {
            if (val.sessionId === sessionId) {
              delete index2.byInstance[inst];
              changed = true;
            }
          }
          if (changed)
            writeIndex(index2);
          return null;
        }
        const item = raw;
        const savedAt = typeof item.savedAt === "number" ? item.savedAt : 0;
        if (now2() - savedAt > MAX_AGE_MS) {
          await del(sessionId, target).catch(() => {});
          const index2 = getIndex();
          let changed = false;
          if (Object.prototype.hasOwnProperty.call(index2.bySession, sessionId)) {
            delete index2.bySession[sessionId];
            changed = true;
          }
          for (const [inst, val] of Object.entries(index2.byInstance)) {
            if (val.sessionId === sessionId) {
              delete index2.byInstance[inst];
              changed = true;
            }
          }
          if (changed)
            writeIndex(index2);
          return null;
        }
        if (!Array.isArray(item.entries))
          return null;
        return {
          leafId: typeof item.leafId === "string" || item.leafId === null ? item.leafId : null,
          entries: item.entries,
          hasMore: Boolean(item.hasMore),
          savedAt
        };
      } catch {
        return null;
      }
    },
    saveSessionThrottled(sessionId, data, instanceId) {
      if (getIndex().noCache.includes(sessionId))
        return;
      pendingSaves.set(sessionId, { data, instanceId });
      if (throttleTimer === undefined) {
        throttleTimer = setTimeout(() => {
          throttleTimer = undefined;
          flush();
        }, WRITE_THROTTLE_MS);
      }
    },
    async markNoCache(sessionId, instanceId) {
      const index2 = getIndex();
      if (!index2.noCache.includes(sessionId)) {
        index2.noCache.push(sessionId);
        if (index2.noCache.length > MAX_NO_CACHE_SESSIONS) {
          index2.noCache.splice(0, index2.noCache.length - MAX_NO_CACHE_SESSIONS);
        }
        writeIndex(index2);
      }
      await api.dropSession(sessionId, instanceId);
    },
    async dropSession(sessionId, instanceId) {
      dropGenerations.set(sessionId, (dropGenerations.get(sessionId) ?? 0) + 1);
      pendingSaves.delete(sessionId);
      const index2 = getIndex();
      delete index2.bySession[sessionId];
      if (instanceId) {
        delete index2.byInstance[instanceId];
      }
      for (const [inst, val] of Object.entries(index2.byInstance)) {
        if (val.sessionId === sessionId) {
          delete index2.byInstance[inst];
        }
      }
      writeIndex(index2);
      try {
        const target = getDbStore();
        await del(sessionId, target);
      } catch {}
    },
    flush
  };
  return api;
}
var defaultTranscriptCache = createTranscriptCache();

// src/lib/session-store.ts
var FOCUS_POLL_MS = 3000;
var FOCUS_EVENT_POLL_MS = 150;
var HISTORY_PAGE_LIMIT = 50;
function createSessionStore(client, options2 = {}) {
  const { instanceId, cache = defaultTranscriptCache } = options2;
  const listeners = new Set;
  let transcript = emptyTranscriptState();
  let subagents = EMPTY_SUBAGENT_STATE;
  let hub = EMPTY_AGENT_HUB_STATE;
  let hubOpen = false;
  let pinnedOpen = false;
  let rosterSubscribed = false;
  let focus = null;
  let focusReady = false;
  let focusWatch = { sawLive: false };
  let focusSeq = 0;
  let focusSubscribeToken = 0;
  let focusError = null;
  let focusDetach = null;
  let focusPollInFlight = false;
  let focusPollDirty = false;
  let focusPollTimer;
  let focusEventTimer;
  let deferredFocus;
  let connection = client.state;
  let sessionState = client.sessionState;
  let sessionStateResolved = false;
  let stats = null;
  let commands = [];
  let roles = null;
  let agents = null;
  let browser = null;
  let loginStatus = null;
  let login = null;
  let historyLoaded = false;
  let disposed = false;
  let restoredDraft = null;
  let planState = null;
  let planReview = null;
  let btw2 = null;
  let cachedSessionId;
  let cachedLoadPromise = null;
  let sawSecrets = false;
  function noteSecrets() {
    sawSecrets = true;
    const sid = sessionState?.sessionId ?? cachedSessionId;
    if (sid)
      cache.markNoCache(sid, instanceId);
  }
  function persistCache() {
    if (!sessionStateResolved || transcript.needsReload || !historyLoaded)
      return;
    const sid = sessionState?.sessionId;
    if (!sid || transcript.entries.length === 0)
      return;
    if (sawSecrets) {
      cache.markNoCache(sid, instanceId);
      return;
    }
    cache.saveSessionThrottled(sid, {
      leafId: transcript.leafId,
      entries: transcript.entries,
      hasMore: transcript.hasMore
    }, instanceId);
  }
  let lastErrorMsg = "";
  let snapshot;
  snapshot = buildSnapshot();
  let focusTodoSource;
  let focusTodoPhases = [];
  function focusedTodoPhases(entries2) {
    if (entries2 !== focusTodoSource) {
      focusTodoSource = entries2;
      focusTodoPhases = getLatestTodoPhasesFromEntries(entries2);
    }
    return focusTodoPhases;
  }
  function buildSnapshot() {
    const streaming = transcript.working || (sessionState?.isStreaming ?? false);
    let currentFocus = null;
    if (focus) {
      const todoPhases = focusedTodoPhases(focus.transcript.entries);
      if (snapshot && snapshot.focus && snapshot.focus.agentId === focus.agentId && snapshot.focus.transcript === focus.transcript && snapshot.focus.ready === focusReady && snapshot.focus.loaded === focus.loaded && snapshot.focus.error === focusError && snapshot.focus.todoPhases === todoPhases) {
        currentFocus = snapshot.focus;
      } else {
        currentFocus = {
          agentId: focus.agentId,
          transcript: focus.transcript,
          ready: focusReady,
          loaded: focus.loaded,
          error: focusError,
          todoPhases
        };
      }
    }
    if (snapshot && snapshot.historyLoaded === historyLoaded && snapshot.connection === connection && snapshot.transcript === transcript && snapshot.subagents === subagents && snapshot.hub === hub && snapshot.focus === currentFocus && snapshot.focusDetach === focusDetach && snapshot.sessionState === sessionState && snapshot.stats === stats && snapshot.commands === commands && snapshot.streaming === streaming && snapshot.roles === roles && snapshot.agents === agents && snapshot.browser === browser && snapshot.loginStatus === loginStatus && snapshot.login === login && snapshot.restoredDraft === restoredDraft && snapshot.planState === planState && snapshot.planReview === planReview && snapshot.btw === btw2) {
      return snapshot;
    }
    return {
      historyLoaded,
      connection,
      transcript,
      subagents,
      hub,
      focus: currentFocus,
      focusDetach,
      sessionState,
      stats,
      commands,
      streaming,
      roles,
      agents,
      browser,
      loginStatus,
      login,
      restoredDraft,
      planState,
      planReview,
      btw: btw2
    };
  }
  let notifyScheduled = false;
  function flushNotifications() {
    if (!notifyScheduled)
      return;
    notifyScheduled = false;
    for (const fn of listeners)
      fn();
  }
  function emit() {
    const nextSnapshot = buildSnapshot();
    if (nextSnapshot === snapshot)
      return;
    snapshot = nextSnapshot;
    if (notifyScheduled || disposed)
      return;
    notifyScheduled = true;
    if (typeof globalThis.requestAnimationFrame === "function") {
      globalThis.requestAnimationFrame(flushNotifications);
    } else {
      queueMicrotask(flushNotifications);
    }
  }
  function notifyOnce(msg) {
    if (msg !== lastErrorMsg) {
      lastErrorMsg = msg;
      notify("error", msg);
    }
  }
  function fetchStats() {
    if (disposed)
      return;
    client.request({ type: "get_session_stats" }).then((resp) => {
      if (disposed)
        return;
      stats = resp.data;
      emit();
    }).catch((err) => {
      if (!disposed)
        notifyOnce(err.message);
    });
  }
  function fetchCommands() {
    if (disposed)
      return;
    client.request({ type: "get_available_commands" }).then((resp) => {
      if (disposed)
        return;
      commands = resp.data.commands;
      emit();
    }).catch((err) => {
      if (!disposed)
        notifyOnce(err.message);
    });
  }
  function fetchSubagents(merge = false) {
    if (disposed)
      return;
    client.request({ type: "get_subagents" }).then((resp) => {
      if (disposed)
        return;
      subagents = merge ? mergeSubagentSnapshots(subagents, resp.data.subagents) : subagentTreeFromSnapshots(resp.data.subagents);
      emit();
    }).catch((err) => {
      if (!disposed)
        notifyOnce(err.message);
    });
  }
  function rosterWanted() {
    return hubOpen || pinnedOpen || focus !== null;
  }
  function startHub(force = false) {
    if (disposed || !rosterWanted() || client.state !== "ready")
      return Promise.resolve();
    if (!rosterSubscribed || force) {
      rosterSubscribed = true;
      client.request({ type: "set_agent_roster_subscription", enabled: true }).catch((err) => {
        if (!disposed)
          notifyOnce(err.message);
      });
    }
    return client.request({ type: "get_agent_roster" }).then((resp) => {
      if (disposed || !rosterWanted())
        return;
      hub = applyRoster(hub, resp.data.agents);
      emit();
      checkFocusWatch();
    }).catch((err) => {
      if (!disposed)
        notifyOnce(err.message);
    });
  }
  function releaseRoster() {
    if (rosterWanted() || !rosterSubscribed)
      return;
    rosterSubscribed = false;
    if (client.state === "ready") {
      client.request({ type: "set_agent_roster_subscription", enabled: false }).catch(() => {});
    }
  }
  function setHubOpen(open) {
    if (open === hubOpen || disposed)
      return;
    hubOpen = open;
    if (open) {
      startHub();
      return;
    }
    releaseRoster();
  }
  function setPinnedOpen(open) {
    if (open === pinnedOpen || disposed)
      return;
    pinnedOpen = open;
    if (open) {
      startHub();
      return;
    }
    releaseRoster();
  }
  function stopFocusTimers() {
    if (focusPollTimer !== undefined)
      clearInterval(focusPollTimer);
    if (focusEventTimer !== undefined)
      clearTimeout(focusEventTimer);
    focusPollTimer = undefined;
    focusEventTimer = undefined;
  }
  function resetSubagentSubscription() {
    if (client.state === "ready") {
      client.request({ type: "set_subagent_subscription", level: "progress" }).catch(() => {});
    }
  }
  function subscribeFocusEvents(agentId) {
    const token = ++focusSubscribeToken;
    client.request({ type: "set_subagent_subscription", level: "events", ids: [agentId] }).then((resp) => {
      if (disposed || !focus || token !== focusSubscribeToken || focus.agentId !== agentId)
        return;
      const snapshot2 = resp.data?.snapshots?.[agentId];
      if (!snapshot2)
        return;
      focus = applyFocusSnapshot(focus, snapshot2);
      emit();
    }).catch((err) => {
      if (!disposed)
        notifyOnce(err.message);
    });
  }
  function clearFocus() {
    const wasReady = focusReady;
    stopFocusTimers();
    focusSubscribeToken++;
    focus = null;
    deferredFocus = undefined;
    focusReady = false;
    focusError = null;
    focusPollDirty = false;
    if (wasReady)
      resetSubagentSubscription();
    releaseRoster();
  }
  function detachFocus(agentId, message) {
    clearFocus();
    focusDetach = { agentId, message, nonce: (focusDetach?.nonce ?? 0) + 1 };
    notify("info", message);
    emit();
  }
  function checkFocusWatch() {
    if (!focus || !focusReady)
      return;
    const next = watchFocusedAgent(focusWatch, hub.agents.get(focus.agentId));
    focusWatch = next.watch;
    if (next.detach)
      detachFocus(focus.agentId, detachMessage(focus.agentId, next.detach));
  }
  async function pollFocus() {
    const seq = focus?.seq;
    if (seq === undefined || !focusReady || disposed)
      return;
    if (focusPollInFlight) {
      focusPollDirty = true;
      return;
    }
    focusPollInFlight = true;
    try {
      do {
        focusPollDirty = false;
        const current = focus;
        if (!current || current.seq !== seq)
          return;
        const resp = await client.request({
          type: "get_subagent_messages",
          subagentId: current.agentId,
          fromByte: current.cursor.nextByte,
          fileId: current.cursor.fileId,
          sentinel: current.cursor.sentinel
        });
        if (disposed || !focus || focus.seq !== seq)
          return;
        focus = applyFocusChunk(focus, resp.data);
        focusError = null;
        if (focus.cursor.nextByte === 0 && resp.data.fromByte !== 0)
          focusPollDirty = true;
        emit();
      } while (focusPollDirty);
    } catch (err) {
      if (!disposed && focus?.seq === seq) {
        focusError = err instanceof Error ? err.message : String(err);
        focus = { ...focus, loaded: true };
        emit();
      }
    } finally {
      focusPollInFlight = false;
    }
  }
  function scheduleFocusPoll() {
    if (focusEventTimer !== undefined)
      return;
    focusEventTimer = setTimeout(() => {
      focusEventTimer = undefined;
      pollFocus();
    }, FOCUS_EVENT_POLL_MS);
  }
  function failFocus(agentId, message) {
    clearFocus();
    focusDetach = { agentId, message, nonce: (focusDetach?.nonce ?? 0) + 1 };
    notify("error", message);
    emit();
  }
  async function focusAgent(id) {
    if (disposed)
      return;
    if (id === MAIN_AGENT_ID) {
      unfocus();
      return;
    }
    if (focus?.agentId === id && focusReady) {
      focusSeq++;
      focus = { ...focus, seq: focusSeq };
      return;
    }
    const request = ++focusSeq;
    stopFocusTimers();
    if (focusReady)
      resetSubagentSubscription();
    focusReady = false;
    focusError = null;
    focusDetach = null;
    focusSubscribeToken++;
    focus = startFocus(id, request, hub.agents.get(id)?.status === "running");
    emit();
    if (client.state !== "ready") {
      deferredFocus = id;
      return;
    }
    await startHub();
    if (request === focusSeq && !disposed && !hub.loaded) {
      failFocus(id, "Agent roster unavailable");
      return;
    }
    if (request !== focusSeq || disposed)
      return;
    const entry = hub.agents.get(id);
    if (!entry || !isFocusable(entry)) {
      const why = entry === undefined ? `Agent ${id} is gone` : entry.kind !== "sub" ? `Agent ${id} is read-only; open it in the Agent Hub` : `Agent ${id} is aborted`;
      failFocus(id, why);
      return;
    }
    if (entry.status === "parked") {
      try {
        await client.request({ type: "revive_agent", agentId: id });
      } catch (err) {
        if (request !== focusSeq || disposed)
          return;
        failFocus(id, err instanceof Error ? err.message : String(err));
        return;
      }
      if (request !== focusSeq || disposed)
        return;
    }
    const live = hub.agents.get(id);
    focusWatch = initialFocusWatch(live);
    focus = { ...focus, transcript: { ...focus.transcript, working: live?.status === "running" } };
    focusReady = true;
    subscribeFocusEvents(id);
    focusPollTimer = setInterval(() => void pollFocus(), FOCUS_POLL_MS);
    notify("info", viewingMessage(id));
    emit();
    pollFocus();
  }
  function unfocus() {
    focusSeq++;
    if (!focus)
      return;
    clearFocus();
    notify("info", "Returned to main session");
    emit();
  }
  function fetchSessionState() {
    if (disposed)
      return;
    client.request({ type: "get_state" }).then((resp) => {
      if (disposed)
        return;
      sessionStateResolved = true;
      const prevSessionId = sessionState?.sessionId;
      sessionState = resp.data;
      const currentSid = sessionState?.sessionId;
      const mismatch = cachedSessionId !== undefined && currentSid !== undefined && currentSid !== cachedSessionId || prevSessionId !== undefined && currentSid !== undefined && currentSid !== prevSessionId;
      if (mismatch) {
        if (cachedSessionId) {
          cache.dropSession(cachedSessionId, instanceId);
        }
        if (prevSessionId && prevSessionId !== currentSid) {
          cache.dropSession(prevSessionId, instanceId);
        }
        cachedSessionId = currentSid;
        cachedLoadPromise = null;
        triggerReload();
      } else if (currentSid) {
        cachedSessionId = currentSid;
        if (!mismatch) {
          persistCache();
        }
      }
      emit();
    }).catch((err) => {
      if (!disposed)
        notifyOnce(err.message);
    });
  }
  function fetchRoles() {
    if (disposed)
      return;
    client.request({ type: "get_model_roles" }).then((resp) => {
      if (disposed)
        return;
      roles = resp.data;
      emit();
    }).catch((err) => {
      if (!disposed)
        notifyOnce(err.message);
    });
  }
  function fetchAgentsConfig() {
    if (disposed)
      return;
    client.request({ type: "get_agents" }).then((resp) => {
      if (disposed)
        return;
      agents = resp.data;
      emit();
    }).catch((err) => {
      if (!disposed)
        notifyOnce(err.message);
    });
  }
  function fetchBrowser() {
    if (disposed)
      return;
    client.request({ type: "get_model_browser" }).then((resp) => {
      if (disposed)
        return;
      browser = resp.data;
      emit();
    }).catch((err) => {
      if (!disposed)
        notifyOnce(err.message);
    });
  }
  function fetchLoginStatus() {
    if (disposed)
      return;
    client.request({ type: "get_login_status" }).then((resp) => {
      if (disposed)
        return;
      loginStatus = resp.data;
      emit();
    }).catch((err) => {
      if (!disposed)
        notifyOnce(err.message);
    });
  }
  function fetchPlanState() {
    if (disposed)
      return;
    client.request({ type: "get_plan_state" }).then((resp) => {
      if (disposed)
        return;
      if (resp.data) {
        planState = resp.data.state ?? null;
        planReview = resp.data.review ?? null;
        emit();
      }
    }).catch((err) => {
      if (err instanceof RpcCommandError && err.message.endsWith("Unknown command: get_plan_state"))
        return;
      if (!disposed)
        notifyOnce(err.message);
    });
  }
  let statsTimer;
  function scheduleStatsRefresh() {
    if (statsTimer !== undefined)
      return;
    statsTimer = setTimeout(() => {
      statsTimer = undefined;
      fetchStats();
    }, 500);
  }
  let modelDataRequested = false;
  let agentsRequested = false;
  let loginStatusRequested = false;
  function ensureModelData() {
    if (modelDataRequested || disposed || client.state !== "ready")
      return;
    modelDataRequested = true;
    fetchRoles();
    fetchBrowser();
  }
  function ensureAgents() {
    if (agentsRequested || disposed || client.state !== "ready")
      return;
    agentsRequested = true;
    fetchAgentsConfig();
  }
  function ensureLoginStatus() {
    if (loginStatusRequested || disposed || client.state !== "ready")
      return;
    loginStatusRequested = true;
    fetchLoginStatus();
  }
  let commandsPushed = false;
  let postHistoryPending = false;
  function attach() {
    postHistoryPending = true;
    if (transcript.entries.length === 0) {
      const indexEntry = instanceId ? cache.readIndex({ instanceId }) : sessionState?.sessionId ? cache.readIndex({ sessionId: sessionState.sessionId }) : null;
      if (indexEntry?.sessionId && indexEntry.leafId) {
        cachedSessionId = indexEntry.sessionId;
        cachedLoadPromise = cache.loadSession(indexEntry.sessionId);
      }
    }
    triggerReload();
    fetchSessionState();
    fetchStats();
    fetchPlanState();
    fetchSubagents();
    startHub();
    if (deferredFocus !== undefined) {
      const id = deferredFocus;
      deferredFocus = undefined;
      focusAgent(id);
    }
  }
  function afterFirstHistory() {
    if (!postHistoryPending)
      return;
    postHistoryPending = false;
    if (!commandsPushed)
      fetchCommands();
  }
  const V3_EVENT_TYPES = {
    msg_start: true,
    block_start: true,
    delta: true,
    block_end: true,
    msg_end: true,
    entry: true,
    branch: true,
    tool_output: true
  };
  function isV3Event(event) {
    return event.type in V3_EVENT_TYPES;
  }
  let activeLoadId = 0;
  let reloadInProgress = false;
  let reloadPending = false;
  function triggerReload() {
    historyLoaded = false;
    const loadId = ++activeLoadId;
    if (reloadInProgress) {
      reloadPending = true;
      return;
    }
    doReload(loadId);
  }
  async function fetchHistoryPage(opts) {
    let request = opts;
    for (;; ) {
      try {
        const page = await client.history(request);
        if (page.secrets)
          noteSecrets();
        return page;
      } catch (err) {
        const limit = request.limit ?? HISTORY_PAGE_LIMIT;
        const tooLarge = err instanceof Error && err.message.includes("exceeded the transport limit");
        if (!tooLarge || limit <= 1 || disposed)
          throw err;
        request = { ...request, limit: Math.max(1, Math.floor(limit / 2)) };
      }
    }
  }
  async function runHistoryCycle(loadId) {
    if (disposed || loadId !== activeLoadId)
      return;
    const inMemoryLeaf = !transcript.needsReload && transcript.entries.length > 0 ? transcript.leafId : null;
    if (inMemoryLeaf) {
      let page;
      try {
        page = await fetchHistoryPage({ after: inMemoryLeaf });
      } catch (err) {
        if (disposed || loadId !== activeLoadId)
          return;
        const isBranchChanged = err instanceof RpcCommandError && err.code === "branch_changed" || err instanceof Error && err.message.includes("branch_changed");
        if (isBranchChanged) {
          const sid = sessionState?.sessionId ?? cachedSessionId;
          if (sid)
            cache.dropSession(sid, instanceId);
          await fetchNewestPage(loadId);
          return;
        }
        notifyOnce(err instanceof Error ? err.message : String(err));
        emit();
        afterFirstHistory();
        return;
      }
      if (disposed || loadId !== activeLoadId)
        return;
      if (page.after !== undefined) {
        if (page.after !== inMemoryLeaf) {
          await fetchNewestPage(loadId);
          return;
        }
        transcript = applyHistoryPage(transcript, page, { older: false });
        historyLoaded = true;
        emit();
        afterFirstHistory();
        persistCache();
        return;
      }
      transcript = applyHistoryPage(transcript, page, { older: false });
      historyLoaded = true;
      emit();
      afterFirstHistory();
      persistCache();
      return;
    }
    const indexEntry = instanceId ? cache.readIndex({ instanceId }) : sessionState?.sessionId ? cache.readIndex({ sessionId: sessionState.sessionId }) : null;
    if (indexEntry?.leafId) {
      const cachedLeaf = indexEntry.leafId;
      if (indexEntry.sessionId) {
        cachedSessionId = indexEntry.sessionId;
      }
      const loadP = cachedLoadPromise ?? (cachedLoadPromise = cache.loadSession(indexEntry.sessionId));
      let deltaPage;
      try {
        deltaPage = await fetchHistoryPage({ after: cachedLeaf });
      } catch (err) {
        if (disposed || loadId !== activeLoadId)
          return;
        const isBranchChanged = err instanceof RpcCommandError && err.code === "branch_changed" || err instanceof Error && err.message.includes("branch_changed");
        if (isBranchChanged) {
          const sid = sessionState?.sessionId ?? cachedSessionId;
          if (sid)
            cache.dropSession(sid, instanceId);
          await fetchNewestPage(loadId);
          return;
        }
        notifyOnce(err instanceof Error ? err.message : String(err));
        emit();
        afterFirstHistory();
        return;
      }
      if (disposed || loadId !== activeLoadId)
        return;
      if (deltaPage.after !== undefined) {
        const { promise: timeoutP, resolve: resolveTimeout } = Promise.withResolvers();
        const idbTimer = setTimeout(() => resolveTimeout(null), 500);
        const cachedData = await Promise.race([loadP, timeoutP]).catch(() => null).finally(() => {
          clearTimeout(idbTimer);
        });
        if (disposed || loadId !== activeLoadId)
          return;
        if (cachedData && cachedData.entries.length > 0 && cachedData.leafId === cachedLeaf && deltaPage.after === cachedLeaf) {
          const deltaIds = new Set(deltaPage.entries.map((e) => e.id));
          const allCovered = transcript.entries.length === 0 || transcript.entries.every((e) => deltaIds.has(e.id));
          if (allCovered) {
            transcript = {
              ...transcript,
              entries: cachedData.entries,
              leafId: cachedData.leafId,
              hasMore: cachedData.hasMore
            };
          }
          transcript = applyHistoryPage(transcript, deltaPage, { older: false });
          historyLoaded = true;
          emit();
          afterFirstHistory();
          persistCache();
          return;
        }
        await fetchNewestPage(loadId);
        return;
      }
      transcript = applyHistoryPage(transcript, deltaPage, { older: false });
      historyLoaded = true;
      emit();
      afterFirstHistory();
      persistCache();
      return;
    }
    await fetchNewestPage(loadId);
  }
  async function fetchNewestPage(loadId) {
    let newestPage;
    try {
      newestPage = await fetchHistoryPage({});
    } catch (err) {
      if (disposed || loadId !== activeLoadId)
        return;
      notifyOnce(err instanceof Error ? err.message : String(err));
      emit();
      afterFirstHistory();
      return;
    }
    if (disposed || loadId !== activeLoadId)
      return;
    transcript = applyHistoryPage(transcript, newestPage, { older: false });
    historyLoaded = true;
    emit();
    afterFirstHistory();
    persistCache();
  }
  async function doReload(loadId) {
    reloadInProgress = true;
    try {
      await runHistoryCycle(loadId);
    } finally {
      reloadInProgress = false;
      if (reloadPending && !disposed) {
        reloadPending = false;
        const nextLoadId = ++activeLoadId;
        doReload(nextLoadId);
      }
    }
  }
  let olderInFlight;
  async function fetchOlderPage() {
    const loadId = activeLoadId;
    if (disposed || reloadInProgress || transcript.needsReload || !transcript.hasMore)
      return;
    const before = oldestEntryId(transcript);
    if (!before)
      return;
    const leafId = currentLeafId(transcript) ?? undefined;
    let olderPage;
    try {
      olderPage = await fetchHistoryPage({ before, leafId, limit: HISTORY_PAGE_LIMIT });
    } catch (err) {
      if (disposed || loadId !== activeLoadId)
        return;
      const isBranchChanged = err instanceof RpcCommandError && err.code === "branch_changed" || err instanceof Error && err.message.includes("branch_changed");
      if (isBranchChanged) {
        const sid = sessionState?.sessionId ?? cachedSessionId;
        if (sid)
          cache.dropSession(sid, instanceId);
        transcript = { ...transcript, needsReload: true };
        triggerReload();
        return;
      }
      notifyOnce(err instanceof Error ? err.message : String(err));
      return;
    }
    if (disposed || loadId !== activeLoadId || oldestEntryId(transcript) !== before)
      return;
    const loadedIds = new Set(transcript.entries.map((e) => e.id));
    const overlap = olderPage.entries.find((e) => e.id === before || loadedIds.has(e.id));
    if (overlap) {
      notifyOnce(`History page before ${before} overlaps loaded entry ${overlap.id}`);
      return;
    }
    transcript = applyHistoryPage(transcript, olderPage, { older: true });
    emit();
    persistCache();
  }
  let initialLoaded = false;
  if (client.state === "ready") {
    initialLoaded = true;
    attach();
  }
  const unsubEvent = client.onEvent((event) => {
    const frame = event;
    const prevTranscript = transcript;
    const prevSubagents = subagents;
    const prevHub = hub;
    const prevFocus = focus;
    const prevFocusReady = focusReady;
    const prevFocusError = focusError;
    const prevFocusDetach = focusDetach;
    const prevSessionState = sessionState;
    const prevStats = stats;
    const prevCommands = commands;
    const prevRoles = roles;
    const prevAgents = agents;
    const prevBrowser = browser;
    const prevLoginStatus = loginStatus;
    const prevLogin = login;
    const prevRestoredDraft = restoredDraft;
    const prevPlanState = planState;
    const prevPlanReview = planReview;
    const prevBtw = btw2;
    if (frame.type === "available_commands_update" && frame.commands) {
      commands = frame.commands;
      commandsPushed = true;
    }
    if (frame.type === "agent_start") {
      if (sessionState)
        sessionState = { ...sessionState, isStreaming: true };
    }
    if (frame.type === "agent_end") {
      if (sessionState)
        sessionState = { ...sessionState, isStreaming: false };
    }
    if (frame.type === "auto_compaction_start") {
      if (sessionState)
        sessionState = { ...sessionState, isCompacting: true };
    }
    if (frame.type === "auto_compaction_end") {
      if (sessionState)
        sessionState = { ...sessionState, isCompacting: false };
    }
    if (frame.type === "login_event") {
      const loginFrame = event;
      if (login && login.loginId === loginFrame.loginId) {
        const ev = loginFrame.event;
        if (ev.kind === "auth") {
          login = {
            ...login,
            url: ev.url,
            instructions: ev.instructions
          };
        } else if (ev.kind === "progress") {
          login = {
            ...login,
            progress: [...login.progress, ev.message]
          };
        } else if (ev.kind === "prompt") {
          login = {
            ...login,
            pending: {
              requestId: ev.requestId,
              kind: "prompt",
              message: ev.message,
              placeholder: ev.placeholder,
              secret: ev.secret,
              allowEmpty: ev.allowEmpty
            }
          };
        } else if (ev.kind === "manual_input") {
          login = {
            ...login,
            pending: {
              requestId: ev.requestId,
              kind: "manual_input"
            }
          };
        } else if (ev.kind === "done") {
          login = {
            ...login,
            pending: undefined,
            result: {
              kind: "done",
              identity: ev.identity
            }
          };
        } else if (ev.kind === "failed") {
          login = {
            ...login,
            pending: undefined,
            result: {
              kind: "failed",
              error: ev.error,
              cancelled: ev.cancelled
            }
          };
        }
      }
    }
    if (frame.type === "btw_delta") {
      const deltaFrame = event;
      if (btw2 && btw2.recordId === deltaFrame.recordId) {
        btw2 = {
          ...btw2,
          answer: btw2.answer + deltaFrame.delta
        };
      }
    }
    if (frame.type === "btw_record") {
      const recordFrame = event;
      const rec = recordFrame.record;
      if (btw2 && btw2.recordId === rec.id) {
        btw2 = {
          ...btw2,
          question: rec.question,
          answer: rec.answer,
          status: rec.status,
          ...rec.error ? { error: rec.error } : {}
        };
      }
    }
    if (isV3Event(event)) {
      const wasNeedsReload = transcript.needsReload;
      transcript = applyV3Event(transcript, event);
      if (frame.type === "branch" || !wasNeedsReload && transcript.needsReload) {
        const sid = sessionState?.sessionId ?? cachedSessionId;
        if (sid)
          cache.dropSession(sid, instanceId);
        historyLoaded = false;
        triggerReload();
      } else if (frame.type === "entry") {
        if (event.type === "entry" && event.secrets)
          noteSecrets();
        else
          persistCache();
      }
    } else {
      transcript = applyTranscriptEvent(transcript, event);
    }
    subagents = applySubagentEvent(subagents, event);
    if (event.type === "agent_registry") {
      hub = applyRegistryFrame(hub, event);
    } else if (hub.loaded && event.type === "subagent_progress") {
      hub = applySubagentProgress(hub, event.payload);
    } else if (hub.loaded && event.type === "subagent_lifecycle") {
      hub = applySubagentLifecycle(hub, event.payload);
    }
    const registryId = event.type === "agent_registry" ? event.op === "removed" ? event.id : event.agent.id : undefined;
    if (event.type === "subagent_event" && focus && focusReady && event.payload.id === focus.agentId) {
      focus = applyFocusEvent(focus, event.payload.event);
      if (eventPersistsEntries(event.payload.event))
        scheduleFocusPoll();
    }
    const pushedPhases = extractTodoPhasesFromEvent(event);
    if (pushedPhases !== undefined) {
      if (sessionState)
        sessionState = { ...sessionState, todoPhases: pushedPhases };
    }
    if (frame.type === "plan_state") {
      planState = frame.state;
    }
    if (frame.type === "plan_review") {
      planReview = frame.review;
    }
    if (prevTranscript !== transcript || prevSubagents !== subagents || prevHub !== hub || prevFocus !== focus || prevFocusReady !== focusReady || prevFocusError !== focusError || prevFocusDetach !== focusDetach || prevSessionState !== sessionState || prevStats !== stats || prevCommands !== commands || prevRoles !== roles || prevAgents !== agents || prevBrowser !== browser || prevLoginStatus !== loginStatus || prevLogin !== login || prevRestoredDraft !== restoredDraft || prevPlanState !== planState || prevPlanReview !== planReview || prevBtw !== btw2) {
      emit();
    }
    if (registryId !== undefined && registryId === focus?.agentId)
      checkFocusWatch();
    if (frame.type === "turn_end" || frame.type === "agent_end") {
      scheduleStatsRefresh();
      fetchSessionState();
      fetchSubagents(true);
      fetchPlanState();
    }
    if (frame.type === "model_changed" || frame.type === "thinking_level_changed" || frame.type === "session_info_update") {
      fetchSessionState();
      if (frame.type === "model_changed" && modelDataRequested) {
        fetchRoles();
      }
    }
    if (frame.type === "config_update") {
      fetchSessionState();
      const cu = frame;
      if (modelDataRequested && (cu.models || cu.modelRoles || cu.model))
        fetchRoles();
      if (modelDataRequested && (cu.models || cu.modelRoles))
        fetchBrowser();
      if (agentsRequested && (cu.agents || cu.model))
        fetchAgentsConfig();
      if (loginStatusRequested && cu.models)
        fetchLoginStatus();
    }
  });
  const unsubState = client.onStateChange((state) => {
    connection = state;
    emit();
    if (!initialLoaded && state === "ready") {
      initialLoaded = true;
      attach();
    }
  });
  const unsubResync = client.onResync((state) => {
    if (state) {
      sessionState = state;
      sessionStateResolved = true;
    }
    if (login && !login.result) {
      login = {
        ...login,
        pending: undefined,
        result: { kind: "failed", error: "Connection lost", cancelled: true }
      };
      emit();
    }
    historyLoaded = false;
    transcript = resetTranscriptForResync(transcript);
    commandsPushed = false;
    const hadModelData = modelDataRequested;
    const hadAgents = agentsRequested;
    const hadLoginStatus = loginStatusRequested;
    modelDataRequested = false;
    agentsRequested = false;
    loginStatusRequested = false;
    postHistoryPending = true;
    triggerReload();
    fetchSubagents();
    fetchStats();
    fetchPlanState();
    rosterSubscribed = false;
    startHub(true);
    if (focus && focusReady) {
      focus = resetFocusCursor(focus);
      subscribeFocusEvents(focus.agentId);
      pollFocus();
    }
    if (hadModelData)
      ensureModelData();
    if (hadAgents)
      ensureAgents();
    if (hadLoginStatus)
      ensureLoginStatus();
  });
  return {
    loadOlder() {
      olderInFlight ??= fetchOlderPage().finally(() => {
        olderInFlight = undefined;
      });
      return olderInFlight;
    },
    flushNotifications,
    ensureModelData,
    ensureAgents,
    setHubOpen,
    setPinnedOpen,
    focusAgent,
    unfocus,
    ensureLoginStatus,
    getSnapshot() {
      return snapshot;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    echoUser(text, images) {
      if (focus)
        focus = { ...focus, transcript: addPendingUser(focus.transcript, text, images) };
      else
        transcript = addPendingUser(transcript, text, images);
      emit();
    },
    clearPendingUser() {
      if (focus)
        focus = { ...focus, transcript: clearPendingUser(focus.transcript) };
      else
        transcript = clearPendingUser(transcript);
      emit();
    },
    clearAllPendingUser() {
      if (focus)
        focus = { ...focus, transcript: clearAllPendingUser(focus.transcript) };
      else
        transcript = clearAllPendingUser(transcript);
      emit();
    },
    restoreDraft(draft) {
      restoredDraft = draft;
      emit();
    },
    clearRestoredDraft() {
      if (!restoredDraft)
        return;
      restoredDraft = null;
      emit();
    },
    refreshModelConfig() {
      modelDataRequested = true;
      agentsRequested = true;
      fetchRoles();
      fetchAgentsConfig();
      fetchBrowser();
    },
    refreshSessionState() {
      fetchSessionState();
      fetchPlanState();
    },
    refreshPlanState() {
      fetchPlanState();
    },
    applyRoles(result) {
      roles = result;
      emit();
    },
    applyAgent(info) {
      if (!agents)
        return;
      agents = {
        ...agents,
        agents: agents.agents.map((a) => a.name === info.name ? info : a)
      };
      emit();
    },
    applyBrowser(result) {
      browser = result;
      emit();
    },
    beginLogin(state) {
      login = {
        loginId: state.loginId,
        providerId: state.providerId,
        progress: []
      };
      emit();
    },
    clearLogin() {
      login = null;
      emit();
    },
    startBtw(state) {
      btw2 = {
        recordId: state.recordId,
        question: state.question,
        answer: state.initialAnswer ?? "",
        status: state.status ?? "running"
      };
      emit();
    },
    updateBtwFromRecord(record) {
      btw2 = {
        recordId: record.id,
        question: record.question,
        answer: record.answer,
        status: record.status,
        ...record.error ? { error: record.error } : {}
      };
      emit();
    },
    clearBtw() {
      btw2 = null;
      emit();
    },
    applyLoginStatus(result) {
      loginStatus = result;
      emit();
    },
    refreshLoginStatus() {
      loginStatusRequested = true;
      fetchLoginStatus();
    },
    async setTodos(phases) {
      if (disposed)
        return;
      if (sessionState) {
        sessionState = { ...sessionState, todoPhases: phases };
        emit();
      }
      try {
        const resp = await client.request({ type: "set_todos", phases });
        if (resp.data?.todoPhases) {
          if (sessionState) {
            sessionState = { ...sessionState, todoPhases: resp.data.todoPhases };
          }
          emit();
        }
      } catch (err) {
        notifyOnce(err instanceof Error ? err.message : String(err));
        throw err;
      } finally {
        fetchSessionState();
      }
    },
    async setPlanMode(enabled) {
      if (disposed)
        return;
      try {
        const resp = await client.request({ type: "set_plan_mode", enabled });
        if (resp.data?.state) {
          planState = resp.data.state;
          emit();
        }
      } catch (err) {
        notifyOnce(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    async approvePlan(reviewId, action, feedback) {
      if (disposed)
        return;
      try {
        const resp = await client.request(feedback !== undefined ? { type: "approve_plan", reviewId, action, feedback } : { type: "approve_plan", reviewId, action });
        if (resp.data?.state) {
          planState = resp.data.state;
          emit();
        }
      } catch (err) {
        notifyOnce(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    dispose() {
      disposed = true;
      stopFocusTimers();
      activeLoadId++;
      if (statsTimer !== undefined) {
        clearTimeout(statsTimer);
        statsTimer = undefined;
      }
      unsubEvent();
      unsubState();
      unsubResync();
      listeners.clear();
    }
  };
}

// src/lib/route.ts
var PREFIX = "#/s/";
var FOCUS_TODOS_SUFFIX = "/todos";
function decodeAgentId(raw) {
  try {
    return decodeURIComponent(raw);
  } catch {
    return "";
  }
}
function parseRoute(hash) {
  if (!hash.startsWith(PREFIX))
    return { kind: "sessions" };
  const rest = hash.slice(PREFIX.length);
  if (!rest)
    return { kind: "sessions" };
  const slash = rest.indexOf("/");
  if (slash === -1)
    return { kind: "session", id: rest, panel: null };
  const id = rest.slice(0, slash);
  if (!id)
    return { kind: "sessions" };
  const suffix2 = rest.slice(slash + 1);
  if (suffix2 === "agents")
    return { kind: "session", id, panel: "hub" };
  if (suffix2 === "info")
    return { kind: "session", id, panel: "info" };
  if (suffix2 === "models")
    return { kind: "session", id, panel: "models" };
  if (suffix2 === "todos")
    return { kind: "session", id, panel: "todos" };
  if (suffix2 === "usage")
    return { kind: "session", id, panel: "usage" };
  if (suffix2 === "hub")
    return { kind: "session", id, panel: "hub" };
  if (suffix2 === "subagents")
    return { kind: "session", id, panel: "subagents" };
  if (suffix2.startsWith("hub/")) {
    const agent = decodeAgentId(suffix2.slice(4));
    return agent ? { kind: "session", id, panel: "hub", agent } : { kind: "session", id, panel: "hub" };
  }
  if (suffix2.startsWith("agent/")) {
    let raw = suffix2.slice(6);
    const todos = raw.endsWith(FOCUS_TODOS_SUFFIX);
    if (todos)
      raw = raw.slice(0, -FOCUS_TODOS_SUFFIX.length);
    const agent = decodeAgentId(raw);
    if (!agent)
      return { kind: "session", id, panel: null };
    return todos ? { kind: "session", id, panel: "agent", agent, todos: true } : { kind: "session", id, panel: "agent", agent };
  }
  return { kind: "session", id, panel: null };
}
function routeHash(route) {
  if (route.kind === "sessions")
    return "#/";
  const base = `${PREFIX}${route.id}`;
  if (route.panel === null)
    return base;
  if (route.panel === "hub" && route.agent)
    return `${base}/hub/${encodeURIComponent(route.agent)}`;
  if (route.panel === "agent") {
    if (!route.agent)
      return base;
    return `${base}/agent/${encodeURIComponent(route.agent)}${route.todos ? FOCUS_TODOS_SUFFIX : ""}`;
  }
  return `${base}/${route.panel}`;
}
function navigate(route) {
  browserWindow.location.hash = routeHash(route);
}

// src/components/shell/AppShell.tsx
var import_react = __toESM(require_react(), 1);
var jsx_runtime = __toESM(require_jsx_runtime(), 1);
var SIDEBAR_KEY = "webgui.sidebarCollapsed";
var INSPECTOR_KEY = "webgui.inspectorCollapsed";
function readCollapsed(key) {
  try {
    return browserWindow.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
function useCollapsed(key) {
  const [collapsed, setCollapsed] = import_react.useState(() => readCollapsed(key));
  const toggle = import_react.useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        if (next)
          browserWindow.localStorage.setItem(key, "1");
        else
          browserWindow.localStorage.removeItem(key);
      } catch {}
      return next;
    });
  }, [key]);
  return [collapsed, toggle];
}
function AppShell({ topbar, sidebar, inspector, statusStrip, composer, children }) {
  const [sidebarCollapsed, toggleSidebar] = useCollapsed(SIDEBAR_KEY);
  const [inspectorCollapsed, toggleInspector] = useCollapsed(INSPECTOR_KEY);
  const classes = ["sh-app"];
  if (!sidebar && !inspector)
    classes.push("sh-app--solo");
  else if (!inspector)
    classes.push("sh-app--no-inspector");
  if (sidebar && sidebarCollapsed)
    classes.push("sh-app--sidebar-collapsed");
  if (inspector && inspectorCollapsed)
    classes.push("sh-app--inspector-collapsed");
  const sidebarToggle = /* @__PURE__ */ jsx_runtime.jsx("button", {
    type: "button",
    className: "sh-col-toggle",
    onClick: toggleSidebar,
    "aria-label": sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar",
    "aria-expanded": !sidebarCollapsed,
    title: sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar",
    children: /* @__PURE__ */ jsx_runtime.jsx(PanelLeft, {
      size: 18
    })
  });
  const inspectorToggle = /* @__PURE__ */ jsx_runtime.jsx("button", {
    type: "button",
    className: "sh-col-toggle",
    onClick: toggleInspector,
    "aria-label": inspectorCollapsed ? "Expand panel" : "Collapse panel",
    "aria-expanded": !inspectorCollapsed,
    title: inspectorCollapsed ? "Expand panel" : "Collapse panel",
    children: /* @__PURE__ */ jsx_runtime.jsx(PanelRight, {
      size: 18
    })
  });
  return /* @__PURE__ */ jsx_runtime.jsxs("div", {
    className: classes.join(" "),
    children: [
      /* @__PURE__ */ jsx_runtime.jsx("div", {
        className: "sh-topbar",
        children: topbar
      }),
      sidebar && /* @__PURE__ */ jsx_runtime.jsxs("div", {
        className: "sh-sidebar",
        children: [
          (sidebarCollapsed || typeof sidebar !== "function") && /* @__PURE__ */ jsx_runtime.jsxs("div", {
            className: "sh-col-head sh-col-head--left",
            children: [
              /* @__PURE__ */ jsx_runtime.jsx("span", {
                className: "sh-col-title",
                children: "ompgui"
              }),
              sidebarToggle
            ]
          }),
          /* @__PURE__ */ jsx_runtime.jsx("div", {
            className: "sh-col-body",
            children: typeof sidebar === "function" ? sidebar(sidebarToggle) : sidebar
          })
        ]
      }),
      /* @__PURE__ */ jsx_runtime.jsxs("div", {
        className: "sh-main",
        children: [
          /* @__PURE__ */ jsx_runtime.jsx("div", {
            className: "sh-transcript",
            children
          }),
          statusStrip && /* @__PURE__ */ jsx_runtime.jsx("div", {
            className: "sh-status-strip",
            children: statusStrip
          })
        ]
      }),
      /* @__PURE__ */ jsx_runtime.jsx("div", {
        className: "sh-composer",
        children: composer
      }),
      inspector && /* @__PURE__ */ jsx_runtime.jsxs("div", {
        className: "sh-inspector",
        children: [
          (inspectorCollapsed || typeof inspector !== "function") && /* @__PURE__ */ jsx_runtime.jsx("div", {
            className: "sh-col-head sh-col-head--right",
            children: inspectorToggle
          }),
          /* @__PURE__ */ jsx_runtime.jsx("div", {
            className: "sh-col-body",
            children: typeof inspector === "function" ? inspector(inspectorToggle) : inspector
          })
        ]
      })
    ]
  });
}

// src/components/shell/TopBar.tsx
var import_react2 = __toESM(require_react(), 1);

// src/lib/layout.ts
var BP_LG = 1100;

// src/components/shell/TopBar.tsx
var jsx_runtime2 = __toESM(require_jsx_runtime(), 1);
var CONNECTION_LABELS = {
  ready: "Connected",
  connecting: "Connecting",
  reconnecting: "Reconnecting",
  closed: "Disconnected"
};
function dotClass(conn) {
  if (conn === "reconnecting")
    return "tb-dot tb-dot-connecting";
  return `tb-dot tb-dot-${conn}`;
}
function TopBar({
  title,
  connection,
  route,
  subagentCount,
  sessionState,
  streaming,
  sink,
  onReconnect,
  onRename
}) {
  const [connPopoverOpen, setConnPopoverOpen] = import_react2.useState(false);
  const [menuOpen, setMenuOpen] = import_react2.useState(false);
  const [confirmModal, setConfirmModal] = import_react2.useState(null);
  const [actionPending, setActionPending] = import_react2.useState(false);
  const [renaming, setRenaming] = import_react2.useState(false);
  const [editName, setEditName] = import_react2.useState(title);
  const instanceId = route.kind === "session" ? route.id : null;
  const panel = route.kind === "session" ? route.panel : null;
  const isStreaming = streaming ?? sessionState?.isStreaming ?? false;
  const isCompacting = sessionState?.isCompacting ?? false;
  const isBusy = isStreaming || isCompacting;
  import_react2.useEffect(() => {
    if (!menuOpen && !confirmModal)
      return;
    const handleKeyDown = (e) => {
      if (e !== null && typeof e === "object" && "key" in e && e.key === "Escape") {
        if (confirmModal) {
          setConfirmModal(null);
        } else if (menuOpen) {
          setMenuOpen(false);
        }
      }
    };
    browserWindow.addEventListener("keydown", handleKeyDown);
    return () => {
      browserWindow.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen, confirmModal]);
  const openConfirm = import_react2.useCallback((action) => {
    setMenuOpen(false);
    switch (action) {
      case "compact":
        setConfirmModal({
          action: "compact",
          title: "Compact context",
          description: "Summarize and compact current conversation history? This effect is shared with the TUI.",
          confirmLabel: "Compact"
        });
        break;
      case "handoff":
        setConfirmModal({
          action: "handoff",
          title: "Handoff session",
          description: "Produce a handoff summary for this session? This effect is shared with the TUI.",
          confirmLabel: "Handoff"
        });
        break;
      case "clear":
        setConfirmModal({
          action: "clear",
          title: "Clear context",
          description: "Reset session context and drop all conversation history? This effect is shared with the TUI.",
          confirmLabel: "Clear context",
          isDestructive: true
        });
        break;
      case "new_session":
        setConfirmModal({
          action: "new_session",
          title: "New session",
          description: "Start a new session? This effect is shared with the TUI.",
          confirmLabel: "New session"
        });
        break;
    }
  }, []);
  const handleExecuteAction = import_react2.useCallback(async () => {
    if (!confirmModal || !sink) {
      setConfirmModal(null);
      return;
    }
    const { action } = confirmModal;
    setActionPending(true);
    try {
      switch (action) {
        case "compact":
          await compact(sink);
          notify("info", "Compaction started");
          break;
        case "handoff":
          await handoff(sink);
          notify("info", "Handoff completed");
          break;
        case "clear":
          await clearContext(sink);
          notify("info", "Context cleared");
          break;
        case "new_session":
          await newSession(sink);
          notify("info", "New session started");
          break;
      }
    } catch (err) {
      notify("error", err instanceof Error ? err.message : String(err));
    } finally {
      setActionPending(false);
      setConfirmModal(null);
    }
  }, [confirmModal, sink]);
  if (route.kind === "sessions") {
    return /* @__PURE__ */ jsx_runtime2.jsx("span", {
      className: "tb-title",
      children: title
    });
  }
  const toggleInfo = () => {
    if (route.kind === "session") {
      navigate({
        kind: "session",
        id: route.id,
        panel: panel === "info" ? null : "info"
      });
    }
  };
  const toggleAgents = () => {
    if (route.kind !== "session")
      return;
    const target = browserWindow.matchMedia(`(min-width: ${BP_LG}px)`).matches ? "hub" : "subagents";
    navigate({
      kind: "session",
      id: route.id,
      panel: panel === "hub" || panel === "subagents" ? null : target
    });
  };
  const toggleModels = () => {
    if (route.kind === "session") {
      navigate({
        kind: "session",
        id: route.id,
        panel: panel === "models" ? null : "models"
      });
    }
  };
  return /* @__PURE__ */ jsx_runtime2.jsxs(jsx_runtime2.Fragment, {
    children: [
      /* @__PURE__ */ jsx_runtime2.jsx("button", {
        type: "button",
        className: "tb-back",
        onClick: () => route.kind === "session" && route.panel !== null ? navigate({ kind: "session", id: route.id, panel: null }) : navigate({ kind: "sessions" }),
        "aria-label": route.kind === "session" && route.panel !== null ? "Back to Main" : "Back to sessions",
        children: "←"
      }),
      /* @__PURE__ */ jsx_runtime2.jsxs("button", {
        type: "button",
        className: "tb-title-btn",
        onClick: () => {
          setEditName(title);
          setRenaming(true);
        },
        title: "Tap to rename session",
        "aria-label": `Session: ${title}. Tap to rename.`,
        children: [
          /* @__PURE__ */ jsx_runtime2.jsx("span", {
            className: "tb-title",
            children: title
          }),
          onRename && /* @__PURE__ */ jsx_runtime2.jsx(Pencil, {
            size: 12,
            className: "tb-title-edit-icon"
          })
        ]
      }),
      /* @__PURE__ */ jsx_runtime2.jsx("div", {
        className: "tb-spacer"
      }),
      /* @__PURE__ */ jsx_runtime2.jsx("button", {
        type: "button",
        className: "tb-icon-btn tb-info-btn",
        "data-active": panel === "info" ? "true" : undefined,
        onClick: toggleInfo,
        title: "Session info",
        "aria-label": "Toggle info panel",
        children: /* @__PURE__ */ jsx_runtime2.jsx(Info, {
          size: 16
        })
      }),
      /* @__PURE__ */ jsx_runtime2.jsxs("div", {
        className: "tb-conn-anchor",
        children: [
          /* @__PURE__ */ jsx_runtime2.jsxs("button", {
            type: "button",
            className: "tb-conn-btn",
            "data-active": connPopoverOpen ? "true" : undefined,
            onClick: () => setConnPopoverOpen((prev) => !prev),
            title: `Connection: ${CONNECTION_LABELS[connection] ?? connection}. Tap for status.`,
            "aria-label": `Connection: ${CONNECTION_LABELS[connection] ?? connection}`,
            children: [
              /* @__PURE__ */ jsx_runtime2.jsx("span", {
                className: dotClass(connection)
              }),
              /* @__PURE__ */ jsx_runtime2.jsx("span", {
                className: `tb-conn-label tb-conn-label--${connection}`,
                children: CONNECTION_LABELS[connection] ?? connection
              })
            ]
          }),
          connPopoverOpen && /* @__PURE__ */ jsx_runtime2.jsxs(jsx_runtime2.Fragment, {
            children: [
              /* @__PURE__ */ jsx_runtime2.jsx("div", {
                className: "tb-popover-backdrop",
                onClick: () => setConnPopoverOpen(false)
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("div", {
                className: "tb-conn-popover",
                role: "dialog",
                "aria-label": "Connection Status",
                children: [
                  /* @__PURE__ */ jsx_runtime2.jsxs("div", {
                    className: "tb-popover-header",
                    children: [
                      /* @__PURE__ */ jsx_runtime2.jsx("span", {
                        className: "tb-popover-title",
                        children: "Connection"
                      }),
                      /* @__PURE__ */ jsx_runtime2.jsx("button", {
                        type: "button",
                        className: "tb-popover-close",
                        onClick: () => setConnPopoverOpen(false),
                        "aria-label": "Close",
                        children: /* @__PURE__ */ jsx_runtime2.jsx(X, {
                          size: 14
                        })
                      })
                    ]
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsxs("div", {
                    className: "tb-popover-body",
                    children: [
                      /* @__PURE__ */ jsx_runtime2.jsxs("div", {
                        className: "tb-popover-row",
                        children: [
                          /* @__PURE__ */ jsx_runtime2.jsx("span", {
                            className: "tb-popover-label",
                            children: "Status"
                          }),
                          /* @__PURE__ */ jsx_runtime2.jsxs("span", {
                            className: "tb-popover-val",
                            children: [
                              /* @__PURE__ */ jsx_runtime2.jsx("span", {
                                className: dotClass(connection)
                              }),
                              CONNECTION_LABELS[connection] ?? connection
                            ]
                          })
                        ]
                      }),
                      /* @__PURE__ */ jsx_runtime2.jsxs("div", {
                        className: "tb-popover-row",
                        children: [
                          /* @__PURE__ */ jsx_runtime2.jsx("span", {
                            className: "tb-popover-label",
                            children: "Transport"
                          }),
                          /* @__PURE__ */ jsx_runtime2.jsx("span", {
                            className: "tb-popover-val",
                            children: "WebSocket"
                          })
                        ]
                      }),
                      instanceId && /* @__PURE__ */ jsx_runtime2.jsxs("div", {
                        className: "tb-popover-row",
                        children: [
                          /* @__PURE__ */ jsx_runtime2.jsx("span", {
                            className: "tb-popover-label",
                            children: "Instance"
                          }),
                          /* @__PURE__ */ jsx_runtime2.jsx("span", {
                            className: "tb-popover-val tb-popover-mono",
                            children: instanceId
                          })
                        ]
                      })
                    ]
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsx("div", {
                    className: "tb-popover-actions",
                    children: /* @__PURE__ */ jsx_runtime2.jsxs("button", {
                      type: "button",
                      className: "tb-popover-btn",
                      onClick: () => {
                        onReconnect?.();
                        setConnPopoverOpen(false);
                      },
                      children: [
                        /* @__PURE__ */ jsx_runtime2.jsx(RefreshCw, {
                          size: 13
                        }),
                        /* @__PURE__ */ jsx_runtime2.jsx("span", {
                          children: connection === "ready" ? "Reconnect" : "Reconnect now"
                        })
                      ]
                    })
                  })
                ]
              })
            ]
          })
        ]
      }),
      /* @__PURE__ */ jsx_runtime2.jsx("button", {
        type: "button",
        className: "tb-panel-btn tb-models-btn",
        "data-active": panel === "models" ? "true" : undefined,
        onClick: toggleModels,
        "aria-label": "Toggle models panel",
        title: "Models",
        children: /* @__PURE__ */ jsx_runtime2.jsx(SlidersHorizontal, {
          size: 18
        })
      }),
      /* @__PURE__ */ jsx_runtime2.jsxs("button", {
        type: "button",
        className: "tb-panel-btn tb-agents-btn",
        "data-active": panel === "hub" || panel === "subagents" ? "true" : undefined,
        onClick: toggleAgents,
        "aria-label": "Toggle agent hub",
        title: subagentCount && subagentCount > 0 ? `Agent Hub (${subagentCount}) - Alt+A` : "Agent Hub - Alt+A",
        children: [
          /* @__PURE__ */ jsx_runtime2.jsx(Bot, {
            size: 18
          }),
          subagentCount !== undefined && subagentCount > 0 ? /* @__PURE__ */ jsx_runtime2.jsx("span", {
            className: "tb-badge",
            children: subagentCount
          }) : null
        ]
      }),
      /* @__PURE__ */ jsx_runtime2.jsxs("div", {
        className: "tb-menu-anchor",
        children: [
          /* @__PURE__ */ jsx_runtime2.jsx("button", {
            type: "button",
            className: "tb-panel-btn tb-menu-btn",
            "data-active": menuOpen ? "true" : undefined,
            disabled: isBusy,
            onClick: () => setMenuOpen((prev) => !prev),
            "aria-label": "Session actions",
            title: isBusy ? "Session actions (disabled while busy)" : "Session actions",
            children: /* @__PURE__ */ jsx_runtime2.jsx(EllipsisVertical, {
              size: 18
            })
          }),
          menuOpen && /* @__PURE__ */ jsx_runtime2.jsxs(jsx_runtime2.Fragment, {
            children: [
              /* @__PURE__ */ jsx_runtime2.jsx("div", {
                className: "tb-popover-backdrop",
                onClick: () => setMenuOpen(false)
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("div", {
                className: "tb-context-menu",
                role: "menu",
                "aria-label": "Session actions",
                children: [
                  /* @__PURE__ */ jsx_runtime2.jsx("button", {
                    type: "button",
                    role: "menuitem",
                    className: "tb-menu-item",
                    onClick: () => {
                      setMenuOpen(false);
                      if (instanceId) {
                        navigate({ kind: "session", id: instanceId, panel: "usage" });
                      }
                    },
                    children: "Usage"
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsx("div", {
                    className: "tb-menu-sep"
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsx("button", {
                    type: "button",
                    role: "menuitem",
                    className: "tb-menu-item",
                    onClick: () => openConfirm("compact"),
                    children: "Compact"
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsx("button", {
                    type: "button",
                    role: "menuitem",
                    className: "tb-menu-item",
                    onClick: () => openConfirm("handoff"),
                    children: "Handoff"
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsx("button", {
                    type: "button",
                    role: "menuitem",
                    className: "tb-menu-item tb-menu-item--destructive",
                    onClick: () => openConfirm("clear"),
                    children: "Clear context"
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsx("div", {
                    className: "tb-menu-sep"
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsx("button", {
                    type: "button",
                    role: "menuitem",
                    className: "tb-menu-item",
                    onClick: () => openConfirm("new_session"),
                    children: "New session"
                  })
                ]
              })
            ]
          })
        ]
      }),
      confirmModal && /* @__PURE__ */ jsx_runtime2.jsxs(jsx_runtime2.Fragment, {
        children: [
          /* @__PURE__ */ jsx_runtime2.jsx("div", {
            className: "tb-popover-backdrop",
            onClick: () => !actionPending && setConfirmModal(null)
          }),
          /* @__PURE__ */ jsx_runtime2.jsxs("div", {
            className: "tb-confirm-dialog",
            role: "dialog",
            "aria-modal": "true",
            "aria-label": confirmModal.title,
            children: [
              /* @__PURE__ */ jsx_runtime2.jsx("div", {
                className: "tb-confirm-title",
                children: confirmModal.title
              }),
              /* @__PURE__ */ jsx_runtime2.jsx("div", {
                className: "tb-confirm-desc",
                children: confirmModal.description
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("div", {
                className: "tb-confirm-actions",
                children: [
                  /* @__PURE__ */ jsx_runtime2.jsx("button", {
                    type: "button",
                    className: "tb-confirm-btn tb-confirm-btn--cancel",
                    disabled: actionPending,
                    onClick: () => setConfirmModal(null),
                    children: "Cancel"
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsx("button", {
                    type: "button",
                    className: `tb-confirm-btn ${confirmModal.isDestructive ? "tb-confirm-btn--destructive" : "tb-confirm-btn--primary"}`,
                    disabled: actionPending,
                    onClick: handleExecuteAction,
                    children: actionPending ? "Processing..." : confirmModal.confirmLabel
                  })
                ]
              })
            ]
          })
        ]
      }),
      renaming && /* @__PURE__ */ jsx_runtime2.jsxs(jsx_runtime2.Fragment, {
        children: [
          /* @__PURE__ */ jsx_runtime2.jsx("div", {
            className: "tb-popover-backdrop",
            onClick: () => setRenaming(false)
          }),
          /* @__PURE__ */ jsx_runtime2.jsx("div", {
            className: "tb-rename-dialog",
            role: "dialog",
            "aria-label": "Rename session",
            children: /* @__PURE__ */ jsx_runtime2.jsxs("form", {
              onSubmit: async (e) => {
                e.preventDefault();
                const trimmed = editName.trim();
                if (trimmed && trimmed !== title) {
                  await onRename?.(trimmed);
                }
                setRenaming(false);
              },
              children: [
                /* @__PURE__ */ jsx_runtime2.jsx("div", {
                  className: "tb-rename-title",
                  children: "Rename Session"
                }),
                /* @__PURE__ */ jsx_runtime2.jsx("input", {
                  type: "text",
                  className: "tb-rename-input",
                  value: editName,
                  autoFocus: true,
                  onChange: (e) => setEditName(e.target.value),
                  placeholder: "Session name"
                }),
                /* @__PURE__ */ jsx_runtime2.jsxs("div", {
                  className: "tb-rename-actions",
                  children: [
                    /* @__PURE__ */ jsx_runtime2.jsx("button", {
                      type: "button",
                      className: "tb-rename-btn tb-rename-btn--cancel",
                      onClick: () => {
                        setEditName(title);
                        setRenaming(false);
                      },
                      children: "Cancel"
                    }),
                    /* @__PURE__ */ jsx_runtime2.jsx("button", {
                      type: "submit",
                      className: "tb-rename-btn tb-rename-btn--save",
                      disabled: !editName.trim(),
                      children: "Save"
                    })
                  ]
                })
              ]
            })
          })
        ]
      })
    ]
  });
}

// ../utils/src/format.ts
var SEC = 1000;
var MIN = 60 * SEC;
var HOUR = 60 * MIN;
var DAY = 24 * HOUR;
function formatNumber(n) {
  if (n < 1000)
    return n.toString();
  if (n < 1e4)
    return `${trim1(n / 1000)}K`;
  if (n < 1e6)
    return `${Math.round(n / 1000)}K`;
  if (n < 1e7)
    return `${trim1(n / 1e6)}M`;
  if (n < 1e9)
    return `${Math.round(n / 1e6)}M`;
  if (n < 10000000000)
    return `${trim1(n / 1e9)}B`;
  return `${Math.round(n / 1e9)}B`;
}
function trim1(n) {
  const s = n.toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

// src/lib/context-usage.ts
function formatContextUsage(usage) {
  if (!usage || usage.contextWindow == null || !Number.isFinite(usage.contextWindow) || usage.contextWindow <= 0) {
    return null;
  }
  const percent = usage.percent ?? (usage.tokens != null ? usage.tokens / usage.contextWindow * 100 : 0);
  const pctStr = percent < 1 ? `${percent.toFixed(1)}%` : `${Math.round(percent)}%`;
  return `${pctStr} / ${formatNumber(usage.contextWindow)}`;
}
function contextLevel(percent) {
  if (percent >= 50)
    return "danger";
  if (percent >= 25)
    return "warning";
  if (percent >= 10)
    return "notice";
  return "normal";
}

// src/components/shell/VoiceToggle.tsx
var import_react3 = __toESM(require_react(), 1);
var jsx_runtime3 = __toESM(require_jsx_runtime(), 1);
function VoiceToggle() {
  const state = import_react3.useSyncExternalStore(subscribeWren, getWrenState, getWrenState);
  const onClick = import_react3.useCallback(() => {
    if (getWrenState().enabled)
      disableVoice();
    else
      enableVoice();
  }, []);
  const title = state.error ?? (state.enabled ? state.active ? "this device has voice" : "another device has voice" : "Voice off");
  const on = state.enabled && state.active;
  return /* @__PURE__ */ jsx_runtime3.jsx("button", {
    type: "button",
    className: `ss-voice${on ? " ss-voice--on" : ""}${state.error ? " ss-voice--err" : ""}`,
    onClick,
    "aria-pressed": state.enabled,
    "aria-label": state.enabled ? "Disable voice" : "Enable voice",
    title,
    children: state.enabled ? /* @__PURE__ */ jsx_runtime3.jsx(Volume2, {
      size: 16,
      "aria-hidden": "true"
    }) : /* @__PURE__ */ jsx_runtime3.jsx(VolumeX, {
      size: 16,
      "aria-hidden": "true"
    })
  });
}

// src/components/shell/StatusStrip.tsx
var jsx_runtime4 = __toESM(require_jsx_runtime(), 1);
function formatCost(cost) {
  if (cost < 0.01)
    return "<$0.01";
  return `$${cost.toFixed(2)}`;
}
function TodoChip({ phases, onOpen }) {
  const progress = countTodoProgress(phases);
  if (progress.total === 0)
    return null;
  return /* @__PURE__ */ jsx_runtime4.jsxs(jsx_runtime4.Fragment, {
    children: [
      /* @__PURE__ */ jsx_runtime4.jsx("span", {
        className: "ss-sep"
      }),
      /* @__PURE__ */ jsx_runtime4.jsxs("button", {
        type: "button",
        className: "ss-item ss-item--btn ss-todos",
        onClick: onOpen,
        title: `Todos: ${progress.closed}/${progress.total}`,
        "aria-label": `Todos: ${progress.closed} of ${progress.total} completed`,
        children: [
          /* @__PURE__ */ jsx_runtime4.jsx("span", {
            className: "ss-todo-icon",
            "aria-hidden": "true",
            children: "✓"
          }),
          /* @__PURE__ */ jsx_runtime4.jsxs("span", {
            children: [
              progress.closed,
              "/",
              progress.total
            ]
          })
        ]
      })
    ]
  });
}
function StatusStrip({
  sessionState,
  stats,
  streaming,
  expandAll,
  onToggleExpand,
  onPickModel,
  onPickThinking,
  onOpenTodos,
  planState,
  onTogglePlan
}) {
  const model = sessionState?.model;
  const ctxFormatted = formatContextUsage(sessionState?.contextUsage);
  const ctxLevel = sessionState?.contextUsage ? contextLevel(sessionState.contextUsage.percent ?? 0) : "normal";
  return /* @__PURE__ */ jsx_runtime4.jsxs("div", {
    className: "ss-strip",
    children: [
      /* @__PURE__ */ jsx_runtime4.jsxs("div", {
        className: "ss-group ss-group--left",
        children: [
          model && /* @__PURE__ */ jsx_runtime4.jsx("button", {
            type: "button",
            className: "ss-item ss-item--btn ss-model",
            onClick: onPickModel,
            title: model.name,
            children: model.name
          }),
          sessionState?.thinkingLevel && /* @__PURE__ */ jsx_runtime4.jsxs(jsx_runtime4.Fragment, {
            children: [
              /* @__PURE__ */ jsx_runtime4.jsx("span", {
                className: "ss-sep"
              }),
              /* @__PURE__ */ jsx_runtime4.jsx("button", {
                type: "button",
                className: "ss-item ss-item--btn ss-thinking",
                onClick: onPickThinking,
                children: sessionState.thinkingLevel
              })
            ]
          }),
          ctxFormatted && /* @__PURE__ */ jsx_runtime4.jsxs(jsx_runtime4.Fragment, {
            children: [
              /* @__PURE__ */ jsx_runtime4.jsx("span", {
                className: "ss-sep"
              }),
              /* @__PURE__ */ jsx_runtime4.jsx("span", {
                className: `ss-item ss-ctx ss-ctx--${ctxLevel}`,
                children: ctxFormatted
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime4.jsx(TodoChip, {
            phases: sessionState?.todoPhases,
            onOpen: onOpenTodos
          }),
          planState?.available && /* @__PURE__ */ jsx_runtime4.jsxs(jsx_runtime4.Fragment, {
            children: [
              /* @__PURE__ */ jsx_runtime4.jsx("span", {
                className: "ss-sep"
              }),
              /* @__PURE__ */ jsx_runtime4.jsx("button", {
                type: "button",
                className: `ss-item ss-item--btn ss-plan ${planState.enabled ? planState.paused ? "ss-plan--paused" : "ss-plan--on" : "ss-plan--off"}`,
                onClick: onTogglePlan,
                title: planState.enabled ? planState.paused ? "Plan mode: paused (click to disable)" : "Plan mode: on (click to disable)" : "Plan mode: off (click to enable)",
                "aria-label": planState.enabled ? planState.paused ? "Plan mode: paused" : "Plan mode: on" : "Plan mode: off",
                children: /* @__PURE__ */ jsx_runtime4.jsx("span", {
                  className: "ss-plan-label",
                  children: planState.enabled ? planState.paused ? "plan: paused" : "plan: on" : "plan: off"
                })
              })
            ]
          })
        ]
      }),
      /* @__PURE__ */ jsx_runtime4.jsxs("div", {
        className: "ss-group ss-group--right",
        children: [
          stats && /* @__PURE__ */ jsx_runtime4.jsx("span", {
            className: "ss-item ss-cost",
            children: formatCost(stats.cost)
          }),
          (streaming || sessionState?.isCompacting) && /* @__PURE__ */ jsx_runtime4.jsxs(jsx_runtime4.Fragment, {
            children: [
              /* @__PURE__ */ jsx_runtime4.jsx("span", {
                className: "ss-sep"
              }),
              /* @__PURE__ */ jsx_runtime4.jsxs("span", {
                className: "ss-item ss-indicator",
                children: [
                  /* @__PURE__ */ jsx_runtime4.jsx("span", {
                    className: "ss-dot"
                  }),
                  sessionState?.isCompacting ? "compacting" : "streaming"
                ]
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime4.jsx("span", {
            className: "ss-sep"
          }),
          /* @__PURE__ */ jsx_runtime4.jsxs("button", {
            type: "button",
            className: "ss-item ss-item--btn ss-tools",
            onClick: onToggleExpand,
            "aria-label": expandAll ? "Collapse all tools" : "Expand all tools",
            children: [
              expandAll ? "▼" : "▶",
              " tools"
            ]
          }),
          /* @__PURE__ */ jsx_runtime4.jsx(VoiceToggle, {})
        ]
      })
    ]
  });
}
function FocusStatusStrip({
  agentId,
  model,
  usage,
  cost,
  streaming,
  expandAll,
  onToggleExpand,
  todoPhases,
  onOpenTodos
}) {
  const ctxFormatted = formatContextUsage(usage);
  const ctxLevel = usage ? contextLevel(usage.percent ?? 0) : "normal";
  return /* @__PURE__ */ jsx_runtime4.jsxs("div", {
    className: "ss-strip ss-strip--focused",
    children: [
      /* @__PURE__ */ jsx_runtime4.jsxs("div", {
        className: "ss-group ss-group--left",
        children: [
          /* @__PURE__ */ jsx_runtime4.jsxs("span", {
            className: "ss-item ss-focus-id",
            title: `Viewing agent ${agentId}`,
            children: [
              /* @__PURE__ */ jsx_runtime4.jsx(Ghost, {
                size: 13,
                "aria-hidden": "true"
              }),
              agentId
            ]
          }),
          model && /* @__PURE__ */ jsx_runtime4.jsxs(jsx_runtime4.Fragment, {
            children: [
              /* @__PURE__ */ jsx_runtime4.jsx("span", {
                className: "ss-sep"
              }),
              /* @__PURE__ */ jsx_runtime4.jsx("span", {
                className: "ss-item ss-model",
                title: model,
                children: model
              })
            ]
          }),
          ctxFormatted && /* @__PURE__ */ jsx_runtime4.jsxs(jsx_runtime4.Fragment, {
            children: [
              /* @__PURE__ */ jsx_runtime4.jsx("span", {
                className: "ss-sep"
              }),
              /* @__PURE__ */ jsx_runtime4.jsx("span", {
                className: `ss-item ss-ctx ss-ctx--${ctxLevel}`,
                children: ctxFormatted
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime4.jsx(TodoChip, {
            phases: todoPhases,
            onOpen: onOpenTodos
          })
        ]
      }),
      /* @__PURE__ */ jsx_runtime4.jsxs("div", {
        className: "ss-group ss-group--right",
        children: [
          cost !== undefined && /* @__PURE__ */ jsx_runtime4.jsx("span", {
            className: "ss-item ss-cost",
            children: formatCost(cost)
          }),
          streaming && /* @__PURE__ */ jsx_runtime4.jsxs(jsx_runtime4.Fragment, {
            children: [
              /* @__PURE__ */ jsx_runtime4.jsx("span", {
                className: "ss-sep"
              }),
              /* @__PURE__ */ jsx_runtime4.jsxs("span", {
                className: "ss-item ss-indicator",
                children: [
                  /* @__PURE__ */ jsx_runtime4.jsx("span", {
                    className: "ss-dot"
                  }),
                  "streaming"
                ]
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime4.jsx("span", {
            className: "ss-sep"
          }),
          /* @__PURE__ */ jsx_runtime4.jsxs("button", {
            type: "button",
            className: "ss-item ss-item--btn ss-tools",
            onClick: onToggleExpand,
            "aria-label": expandAll ? "Collapse all tools" : "Expand all tools",
            children: [
              expandAll ? "▼" : "▶",
              " tools"
            ]
          }),
          /* @__PURE__ */ jsx_runtime4.jsx(VoiceToggle, {})
        ]
      })
    ]
  });
}

// src/components/shell/ConnectionBanner.tsx
var import_react4 = __toESM(require_react(), 1);
var jsx_runtime5 = __toESM(require_jsx_runtime(), 1);
var MESSAGES = {
  connecting: "Connecting to host...",
  reconnecting: "Reconnecting to host...",
  closed: "WebSocket disconnected from host",
  incompatible: "This omp is too old, restart it"
};
var DEFAULT_DELAY_MS = 1000;
function ConnectionBanner({
  connection,
  attempt,
  onReconnect,
  delayMs = DEFAULT_DELAY_MS
}) {
  const isImmediate = connection === "incompatible" || connection === "closed";
  const isDelayed = connection === "connecting" || connection === "reconnecting";
  const [delayedVisible, setDelayedVisible] = import_react4.useState(false);
  import_react4.useEffect(() => {
    if (!isDelayed) {
      setDelayedVisible(false);
      return;
    }
    if (delayMs <= 0) {
      setDelayedVisible(true);
      return;
    }
    const timer = setTimeout(() => {
      setDelayedVisible(true);
    }, delayMs);
    return () => {
      clearTimeout(timer);
    };
  }, [isDelayed, delayMs]);
  if (connection === "ready")
    return null;
  const isVisible = isImmediate || delayMs <= 0 || delayedVisible;
  if (!isVisible)
    return null;
  const msg = MESSAGES[connection] ?? "Connecting to host...";
  const suffix2 = connection !== "incompatible" && attempt && attempt > 1 ? ` (attempt ${attempt})` : "";
  return /* @__PURE__ */ jsx_runtime5.jsxs("div", {
    className: "conn-banner",
    children: [
      /* @__PURE__ */ jsx_runtime5.jsxs("span", {
        className: "conn-banner-text",
        children: [
          msg,
          suffix2
        ]
      }),
      onReconnect && connection !== "incompatible" && /* @__PURE__ */ jsx_runtime5.jsx("button", {
        type: "button",
        className: "conn-banner-btn",
        onClick: onReconnect,
        children: "Reconnect"
      })
    ]
  });
}

// src/components/shell/Toasts.tsx
var import_react5 = __toESM(require_react(), 1);
var jsx_runtime6 = __toESM(require_jsx_runtime(), 1);
function Toasts() {
  const notices = import_react5.useSyncExternalStore(subscribeNotices, getNotices);
  return /* @__PURE__ */ jsx_runtime6.jsx("div", {
    className: "toast-container",
    children: notices.map((n) => /* @__PURE__ */ jsx_runtime6.jsx(Toast, {
      notice: n
    }, n.id))
  });
}
function Toast({ notice }) {
  const timerRef = import_react5.useRef(null);
  import_react5.useEffect(() => {
    const delay = notice.kind === "info" ? 4000 : 8000;
    timerRef.current = setTimeout(() => {
      dismissNotice(notice.id);
    }, delay);
    return () => {
      clearTimeout(timerRef.current);
    };
  }, [notice.id, notice.kind]);
  return /* @__PURE__ */ jsx_runtime6.jsxs("div", {
    className: `toast toast-${notice.kind}`,
    children: [
      /* @__PURE__ */ jsx_runtime6.jsx("span", {
        children: notice.message
      }),
      /* @__PURE__ */ jsx_runtime6.jsx("button", {
        type: "button",
        className: "toast-dismiss",
        onClick: () => dismissNotice(notice.id),
        "aria-label": "Dismiss",
        children: /* @__PURE__ */ jsx_runtime6.jsx(X, {
          size: 14
        })
      })
    ]
  });
}

// src/components/composer/useComposerKeyboard.ts
function enterSubmits(event, fine) {
  if (event.isComposing)
    return false;
  if (event.key !== "Enter")
    return false;
  if (event.shiftKey)
    return false;
  return fine;
}
function historyNavDirection(opts) {
  if (opts.isComposing)
    return null;
  if (opts.altKey || opts.ctrlKey || opts.metaKey || opts.shiftKey)
    return null;
  if (opts.slashOpen)
    return null;
  if (opts.key === "ArrowUp") {
    const clamped = Math.max(0, Math.min(opts.selectionStart, opts.text.length));
    if (opts.text.lastIndexOf(`
`, clamped - 1) === -1) {
      return "up";
    }
  } else if (opts.key === "ArrowDown") {
    const clamped = Math.max(0, Math.min(opts.selectionEnd, opts.text.length));
    if (opts.text.indexOf(`
`, clamped) === -1) {
      return "down";
    }
  }
  return null;
}
function useComposerKeyboard() {
  if (typeof browserWindow.matchMedia !== "function") {
    return { enterSubmits: true };
  }
  const mq = browserWindow.matchMedia("(pointer: fine)");
  return { enterSubmits: mq?.matches ?? true };
}

// src/lib/prompt-history.ts
function extractMessageText(message) {
  if (typeof message !== "object" || message === null)
    return "";
  if ("content" in message) {
    const content = message.content;
    if (typeof content === "string")
      return content;
    if (Array.isArray(content)) {
      const texts = [];
      for (const block of content) {
        if (typeof block === "object" && block !== null && "type" in block) {
          if (block.type === "text" && "text" in block && typeof block.text === "string") {
            texts.push(block.text);
          }
        }
      }
      return texts.join(`
`);
    }
  }
  return "";
}
function dedupeConsecutive(items) {
  const result = [];
  for (const item of items) {
    if (result.length === 0 || result[result.length - 1] !== item) {
      result.push(item);
    }
  }
  return result;
}
function extractUserPrompts(state) {
  const raw = [];
  for (const entry of state.entries) {
    if (entry.type === "message" && entry.message.role === "user") {
      const text = extractMessageText(entry.message);
      if (text.length > 0) {
        raw.push(text);
      }
    }
  }
  for (const pending of state.pendingUser) {
    if (pending.text.length > 0) {
      raw.push(pending.text);
    }
  }
  return dedupeConsecutive(raw);
}
function createPromptHistoryNavigator(getHistory) {
  let index2 = -1;
  let draft = "";
  return {
    get index() {
      const history = getHistory();
      return index2 === -1 ? history.length : index2;
    },
    get draft() {
      return draft;
    },
    stepUp(currentText) {
      const history = getHistory();
      if (history.length === 0) {
        return currentText;
      }
      if (index2 === -1) {
        draft = currentText;
        index2 = history.length - 1;
        return history[index2];
      }
      if (index2 > 0) {
        index2 -= 1;
        return history[index2];
      }
      return history[0];
    },
    stepDown() {
      const history = getHistory();
      if (index2 === -1) {
        return draft;
      }
      if (index2 < history.length - 1) {
        index2 += 1;
        return history[index2];
      }
      index2 = -1;
      return draft;
    },
    onEdit(editedText) {
      draft = editedText;
      index2 = -1;
    },
    reset() {
      draft = "";
      index2 = -1;
    }
  };
}

// src/components/composer/Composer.tsx
var import_react7 = __toESM(require_react(), 1);

// src/components/composer/SlashAutocomplete.tsx
var import_react6 = __toESM(require_react(), 1);
var jsx_runtime7 = __toESM(require_jsx_runtime(), 1);
function matchingCommands(text, commands) {
  if (!text.startsWith("/") || text.includes(" "))
    return [];
  const prefix2 = text.slice(1).toLowerCase();
  return commands.filter((c) => c.name.toLowerCase().startsWith(prefix2));
}
function SlashAutocomplete({ text, commands, onSelect, onDismiss }) {
  const matches = matchingCommands(text, commands);
  const [index2, setIndex] = import_react6.useState(0);
  import_react6.useEffect(() => {
    setIndex(0);
  }, [matches.length]);
  const handleKeyDown = import_react6.useCallback((e) => {
    if (matches.length === 0)
      return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setIndex((i) => (i + 1) % matches.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setIndex((i) => (i - 1 + matches.length) % matches.length);
        break;
      case "Enter":
      case "Tab":
        e.preventDefault();
        onSelect(matches[index2].name);
        break;
      case "Escape":
        e.preventDefault();
        onDismiss();
        break;
    }
  }, [matches, index2, onSelect, onDismiss]);
  if (matches.length === 0)
    return null;
  return /* @__PURE__ */ jsx_runtime7.jsx("div", {
    className: "cmp-slash",
    role: "listbox",
    onKeyDownCapture: handleKeyDown,
    children: matches.map((cmd, i) => /* @__PURE__ */ jsx_runtime7.jsxs("button", {
      type: "button",
      role: "option",
      className: "cmp-slash-item" + (i === index2 ? " cmp-slash-active" : ""),
      "aria-selected": i === index2,
      onMouseDown: (e) => e.preventDefault(),
      onClick: () => onSelect(cmd.name),
      children: [
        /* @__PURE__ */ jsx_runtime7.jsxs("span", {
          className: "cmp-slash-name",
          children: [
            "/",
            cmd.name
          ]
        }),
        cmd.description && /* @__PURE__ */ jsx_runtime7.jsx("span", {
          className: "cmp-slash-desc",
          children: cmd.description
        })
      ]
    }, cmd.name))
  });
}

// src/components/composer/Composer.tsx
var jsx_runtime8 = __toESM(require_jsx_runtime(), 1);
function resolveSendMode(busy, busyMode) {
  return busy ? busyMode : "prompt";
}
function keepTextareaFocus(e) {
  e.preventDefault();
}
var MAX_ROWS = 8;
var Composer = import_react7.memo(function Composer2({
  busy,
  commands,
  promptHistory = [],
  onSend,
  onAbort,
  restoredDraft,
  onDraftRestored,
  onDraftChange,
  focusedAgentId,
  onExitFocus,
  draftKey: draftKey2
}) {
  const [text, setText] = import_react7.useState(() => draftKey2 ? readDraft(draftKey2).text : "");
  const [busyMode, setBusyMode] = import_react7.useState("steer");
  const [images, setImages] = import_react7.useState(() => draftKey2 ? readDraft(draftKey2).images : []);
  const [slashDismissed, setSlashDismissed] = import_react7.useState(false);
  const textareaRef = import_react7.useRef(null);
  const fileRef = import_react7.useRef(null);
  const { enterSubmits: enterSubmits2 } = useComposerKeyboard();
  const historyRef = import_react7.useRef(promptHistory);
  historyRef.current = promptHistory;
  const navRef = import_react7.useRef(createPromptHistoryNavigator(() => historyRef.current));
  const [loadedKey, setLoadedKey] = import_react7.useState(draftKey2);
  if (loadedKey !== draftKey2) {
    const next = draftKey2 ? readDraft(draftKey2) : { text: "", images: [] };
    setLoadedKey(draftKey2);
    setText(next.text);
    setImages(next.images);
    navRef.current.reset();
  }
  const trimmed = text.trim();
  const canSend = trimmed.length > 0 || images.length > 0;
  const handleSend = import_react7.useCallback(() => {
    if (!canSend) {
      if (focusedAgentId && busy)
        onAbort();
      return;
    }
    const mode = resolveSendMode(busy, busyMode);
    const accepted = onSend(trimmed, mode, images.length > 0 ? images : undefined);
    if (accepted === false)
      return;
    setText("");
    setImages([]);
    navRef.current.reset();
  }, [canSend, busy, busyMode, trimmed, images, onSend, onAbort, focusedAgentId]);
  import_react7.useEffect(() => {
    onDraftChange?.({ text, images });
  }, [text, images, onDraftChange]);
  import_react7.useEffect(() => {
    if (draftKey2)
      writeDraft(draftKey2, { text, images });
  }, [draftKey2, text, images]);
  const draftRef = import_react7.useRef({ text, images });
  draftRef.current = { text, images };
  import_react7.useEffect(() => {
    if (!draftKey2)
      return;
    return onDraftsHydrated(() => {
      if (draftRef.current.text !== "" || draftRef.current.images.length > 0)
        return;
      const saved = readDraft(draftKey2);
      setText(saved.text);
      setImages(saved.images);
    });
  }, [draftKey2]);
  import_react7.useEffect(() => {
    if (!restoredDraft)
      return;
    setText(restoredDraft.text);
    setImages(restoredDraft.images ? [...restoredDraft.images] : []);
    navRef.current.onEdit(restoredDraft.text);
    onDraftRestored?.();
  }, [restoredDraft, onDraftRestored]);
  const showSlash = !focusedAgentId && !slashDismissed && text.startsWith("/") && !text.includes(" ");
  function applyHistoryText(nextText) {
    setText(nextText);
    setSlashDismissed(false);
    const el = textareaRef.current;
    if (el) {
      el.value = nextText;
      autoGrow(el);
      const len = nextText.length;
      el.setSelectionRange(len, len);
    }
  }
  function handleHistoryUp() {
    const nextText = navRef.current.stepUp(text);
    applyHistoryText(nextText);
  }
  function handleHistoryDown() {
    const nextText = navRef.current.stepDown();
    applyHistoryText(nextText);
  }
  function handleKeyDown(e) {
    if (focusedAgentId && e.key === "Escape" && !showSlash && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (escapeAction(text, images.length) === "clear") {
        setText("");
        setImages([]);
        navRef.current.reset();
      } else {
        onExitFocus?.();
      }
      return;
    }
    const navDir = historyNavDirection({
      key: e.key,
      altKey: e.altKey,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      shiftKey: e.shiftKey,
      isComposing: e.nativeEvent.isComposing,
      slashOpen: showSlash,
      text,
      selectionStart: e.currentTarget.selectionStart,
      selectionEnd: e.currentTarget.selectionEnd
    });
    if (navDir === "up") {
      e.preventDefault();
      handleHistoryUp();
      return;
    }
    if (navDir === "down") {
      e.preventDefault();
      handleHistoryDown();
      return;
    }
    if (enterSubmits({
      key: e.key,
      shiftKey: e.shiftKey,
      isComposing: e.nativeEvent.isComposing
    }, enterSubmits2)) {
      e.preventDefault();
      handleSend();
    }
  }
  function autoGrow(el) {
    el.style.height = "auto";
    const lineHeight = 22;
    const maxHeight = lineHeight * MAX_ROWS;
    el.style.height = Math.min(el.scrollHeight, maxHeight) + "px";
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }
  import_react7.useEffect(() => {
    if (textareaRef.current)
      autoGrow(textareaRef.current);
  }, [text]);
  function handleChange(e) {
    const val = e.target.value;
    setText(val);
    navRef.current.onEdit(val);
    setSlashDismissed(false);
  }
  function handleSlashSelect(name) {
    setText("/" + name + " ");
    setSlashDismissed(false);
    textareaRef.current?.focus();
  }
  function handleSlashDismiss() {
    setSlashDismissed(true);
    textareaRef.current?.focus();
  }
  function readFiles(files) {
    for (const file of files) {
      if (!file.type.startsWith("image/"))
        continue;
      const reader = new FileReader;
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setImages((prev) => [...prev, reader.result]);
        }
      };
      reader.readAsDataURL(file);
    }
  }
  function handleFileChange(e) {
    if (e.target.files)
      readFiles(e.target.files);
    e.target.value = "";
  }
  function handlePaste(e) {
    const items = e.clipboardData?.items;
    if (!items)
      return;
    const imageFiles = [];
    for (let i = 0;i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file)
          imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      readFiles(imageFiles);
    }
  }
  function removeImage(idx) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }
  return /* @__PURE__ */ jsx_runtime8.jsxs("div", {
    className: "cmp-composer" + (focusedAgentId ? " cmp-composer--focused" : ""),
    children: [
      showSlash && /* @__PURE__ */ jsx_runtime8.jsx(SlashAutocomplete, {
        text,
        commands,
        onSelect: handleSlashSelect,
        onDismiss: handleSlashDismiss
      }),
      images.length > 0 && /* @__PURE__ */ jsx_runtime8.jsx("div", {
        className: "cmp-images",
        children: images.map((src, i) => /* @__PURE__ */ jsx_runtime8.jsxs("div", {
          className: "cmp-image-chip",
          children: [
            /* @__PURE__ */ jsx_runtime8.jsx("img", {
              src,
              alt: "",
              className: "cmp-image-thumb"
            }),
            /* @__PURE__ */ jsx_runtime8.jsx("button", {
              type: "button",
              className: "cmp-image-remove",
              onMouseDown: keepTextareaFocus,
              onClick: () => removeImage(i),
              "aria-label": "Remove image",
              children: "×"
            })
          ]
        }, i))
      }),
      /* @__PURE__ */ jsx_runtime8.jsxs("div", {
        className: "cmp-input-row",
        children: [
          /* @__PURE__ */ jsx_runtime8.jsxs("div", {
            className: "cmp-history-nav",
            role: "group",
            "aria-label": "Prompt history",
            children: [
              /* @__PURE__ */ jsx_runtime8.jsx("button", {
                type: "button",
                className: "cmp-history-btn",
                onMouseDown: keepTextareaFocus,
                onClick: handleHistoryUp,
                "aria-label": "Previous prompt",
                title: "Previous prompt",
                children: /* @__PURE__ */ jsx_runtime8.jsx(ChevronUp, {
                  size: 16
                })
              }),
              /* @__PURE__ */ jsx_runtime8.jsx("button", {
                type: "button",
                className: "cmp-history-btn",
                onMouseDown: keepTextareaFocus,
                onClick: handleHistoryDown,
                "aria-label": "Next prompt",
                title: "Next prompt",
                children: /* @__PURE__ */ jsx_runtime8.jsx(ChevronDown, {
                  size: 16
                })
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime8.jsx("textarea", {
            ref: textareaRef,
            className: "cmp-textarea",
            value: text,
            onChange: handleChange,
            onKeyDown: handleKeyDown,
            onPaste: handlePaste,
            placeholder: focusedAgentId ? `Message ${focusedAgentId}... (Esc returns to Main)` : busy ? "Steer or follow up..." : "Message the agent...",
            rows: 1,
            enterKeyHint: enterSubmits2 ? "send" : "enter"
          }),
          /* @__PURE__ */ jsx_runtime8.jsx("button", {
            type: "button",
            className: "cmp-attach",
            onClick: () => fileRef.current?.click(),
            disabled: focusedAgentId !== undefined,
            "aria-label": "Attach image",
            children: "+"
          }),
          /* @__PURE__ */ jsx_runtime8.jsx("input", {
            ref: fileRef,
            type: "file",
            accept: "image/*",
            multiple: true,
            className: "cmp-file-input",
            onChange: handleFileChange,
            tabIndex: -1
          }),
          /* @__PURE__ */ jsx_runtime8.jsx("button", {
            type: "button",
            className: "cmp-btn-primary",
            onMouseDown: keepTextareaFocus,
            onClick: handleSend,
            disabled: !canSend,
            children: busy ? busyMode === "steer" ? "Steer" : "Queue" : "Send"
          })
        ]
      }),
      busy && /* @__PURE__ */ jsx_runtime8.jsxs("div", {
        className: "cmp-actions",
        children: [
          /* @__PURE__ */ jsx_runtime8.jsxs("div", {
            className: "cmp-segmented",
            role: "radiogroup",
            "aria-label": "Send mode",
            children: [
              /* @__PURE__ */ jsx_runtime8.jsx("button", {
                type: "button",
                role: "radio",
                "aria-checked": busyMode === "steer",
                className: "cmp-seg-btn" + (busyMode === "steer" ? " cmp-seg-active" : ""),
                onMouseDown: keepTextareaFocus,
                onClick: () => setBusyMode("steer"),
                children: "Steer"
              }),
              /* @__PURE__ */ jsx_runtime8.jsx("button", {
                type: "button",
                role: "radio",
                "aria-checked": busyMode === "followUp",
                className: "cmp-seg-btn" + (busyMode === "followUp" ? " cmp-seg-active" : ""),
                onMouseDown: keepTextareaFocus,
                onClick: () => setBusyMode("followUp"),
                children: "Queue"
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime8.jsx("button", {
            type: "button",
            className: "cmp-btn-primary cmp-btn-stop",
            onMouseDown: keepTextareaFocus,
            onClick: onAbort,
            children: "Stop"
          })
        ]
      })
    ]
  });
});

// src/components/plan/PlanReviewSheet.tsx
var import_react8 = __toESM(require_react(), 1);
var jsx_runtime9 = __toESM(require_jsx_runtime(), 1);
function PlanReviewSheet({ review, sink, onApprove, onClose }) {
  const [inFlight, setInFlight] = import_react8.useState(false);
  const [showRefine, setShowRefine] = import_react8.useState(false);
  const [feedback, setFeedback] = import_react8.useState("");
  const textareaRef = import_react8.useRef(null);
  import_react8.useEffect(() => {
    setShowRefine(false);
    setFeedback("");
  }, [review?.reviewId]);
  import_react8.useEffect(() => {
    if (showRefine) {
      textareaRef.current?.focus();
    }
  }, [showRefine]);
  import_react8.useEffect(() => {
    if (!review)
      return;
    function handleKeyDown(e) {
      const evt = e;
      if (evt.key === "Escape") {
        if (showRefine) {
          setShowRefine(false);
        } else if (onClose) {
          onClose();
        }
      }
    }
    const win = browserWindow;
    win.addEventListener("keydown", handleKeyDown);
    return () => win.removeEventListener("keydown", handleKeyDown);
  }, [review, showRefine, onClose]);
  if (!review)
    return null;
  const handleAction = async (action, fbText) => {
    if (inFlight)
      return;
    setInFlight(true);
    try {
      const trimmed = fbText?.trim();
      const finalFb = trimmed && trimmed.length > 0 ? trimmed : undefined;
      if (onApprove) {
        await onApprove(review.reviewId, action, finalFb);
      } else if (sink) {
        await approvePlan(sink, review.reviewId, action, finalFb);
      }
    } catch (err) {
      notify("error", `Failed to approve plan: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setInFlight(false);
    }
  };
  return /* @__PURE__ */ jsx_runtime9.jsxs(jsx_runtime9.Fragment, {
    children: [
      /* @__PURE__ */ jsx_runtime9.jsx("div", {
        className: "plan-backdrop",
        onClick: onClose
      }),
      /* @__PURE__ */ jsx_runtime9.jsxs("div", {
        className: "plan-review-sheet",
        role: "dialog",
        "aria-label": review.title || "Plan Review",
        children: [
          /* @__PURE__ */ jsx_runtime9.jsxs("div", {
            className: "plan-review-header",
            children: [
              /* @__PURE__ */ jsx_runtime9.jsxs("div", {
                className: "plan-review-header-text",
                children: [
                  /* @__PURE__ */ jsx_runtime9.jsx("h2", {
                    className: "plan-review-title",
                    children: review.title || "Plan Review"
                  }),
                  review.planFilePath ? /* @__PURE__ */ jsx_runtime9.jsx("span", {
                    className: "plan-review-path",
                    title: review.planFilePath,
                    children: review.planFilePath
                  }) : null
                ]
              }),
              onClose ? /* @__PURE__ */ jsx_runtime9.jsx("button", {
                type: "button",
                className: "plan-review-close",
                "aria-label": "Close",
                onClick: onClose,
                disabled: inFlight,
                children: /* @__PURE__ */ jsx_runtime9.jsx(X, {
                  size: 18
                })
              }) : null
            ]
          }),
          /* @__PURE__ */ jsx_runtime9.jsx("div", {
            className: "plan-review-body",
            children: /* @__PURE__ */ jsx_runtime9.jsx(Markdown, {
              text: review.markdown
            })
          }),
          showRefine ? /* @__PURE__ */ jsx_runtime9.jsxs("div", {
            className: "plan-refine-section",
            children: [
              /* @__PURE__ */ jsx_runtime9.jsx("label", {
                className: "plan-refine-label",
                htmlFor: "plan-refine-textarea",
                children: "Feedback for refinement (optional):"
              }),
              /* @__PURE__ */ jsx_runtime9.jsx("textarea", {
                id: "plan-refine-textarea",
                ref: textareaRef,
                className: "plan-refine-input",
                value: feedback,
                onChange: (e) => setFeedback(e.target.value),
                placeholder: "Explain what to change in the plan...",
                rows: 3,
                disabled: inFlight,
                onKeyDown: (e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    handleAction("refine", feedback);
                  }
                }
              })
            ]
          }) : null,
          /* @__PURE__ */ jsx_runtime9.jsx("div", {
            className: "plan-review-footer",
            children: showRefine ? /* @__PURE__ */ jsx_runtime9.jsxs(jsx_runtime9.Fragment, {
              children: [
                /* @__PURE__ */ jsx_runtime9.jsx("button", {
                  type: "button",
                  className: "plan-btn plan-btn-primary",
                  onClick: () => handleAction("refine", feedback),
                  disabled: inFlight,
                  children: "Send feedback"
                }),
                /* @__PURE__ */ jsx_runtime9.jsx("button", {
                  type: "button",
                  className: "plan-btn plan-btn-secondary",
                  onClick: () => handleAction("execute"),
                  disabled: inFlight,
                  children: "Approve and execute"
                }),
                /* @__PURE__ */ jsx_runtime9.jsx("button", {
                  type: "button",
                  className: "plan-btn plan-btn-secondary",
                  onClick: () => handleAction("compact"),
                  disabled: inFlight,
                  children: "Approve and compact"
                }),
                /* @__PURE__ */ jsx_runtime9.jsx("button", {
                  type: "button",
                  className: "plan-btn plan-btn-cancel",
                  onClick: () => setShowRefine(false),
                  disabled: inFlight,
                  children: "Cancel"
                })
              ]
            }) : /* @__PURE__ */ jsx_runtime9.jsxs(jsx_runtime9.Fragment, {
              children: [
                /* @__PURE__ */ jsx_runtime9.jsx("button", {
                  type: "button",
                  className: "plan-btn plan-btn-primary",
                  onClick: () => handleAction("execute"),
                  disabled: inFlight,
                  children: "Approve and execute"
                }),
                /* @__PURE__ */ jsx_runtime9.jsx("button", {
                  type: "button",
                  className: "plan-btn plan-btn-secondary",
                  onClick: () => handleAction("compact"),
                  disabled: inFlight,
                  children: "Approve and compact"
                }),
                /* @__PURE__ */ jsx_runtime9.jsx("button", {
                  type: "button",
                  className: "plan-btn plan-btn-secondary plan-btn-refine",
                  onClick: () => setShowRefine(true),
                  disabled: inFlight,
                  children: "Refine"
                })
              ]
            })
          })
        ]
      })
    ]
  });
}

// src/components/btw/BtwSheet.tsx
var import_react9 = __toESM(require_react(), 1);
var jsx_runtime10 = __toESM(require_jsx_runtime(), 1);
function BtwSheet({
  btw: btw2,
  historyRecords = [],
  onCancel,
  onClose,
  onFollowUp,
  onSelectRecord,
  onLoadHistory
}) {
  const [followUpText, setFollowUpText] = import_react9.useState("");
  const [showHistory, setShowHistory] = import_react9.useState(false);
  const [copied, setCopied] = import_react9.useState(false);
  const handleKeyDown = import_react9.useCallback((e) => {
    const evt = e;
    if (evt.key === "Escape") {
      evt.preventDefault?.();
      if (showHistory) {
        setShowHistory(false);
        return;
      }
      if (btw2?.status === "running") {
        onCancel();
      } else {
        onClose();
      }
    }
  }, [btw2?.status, onCancel, onClose, showHistory]);
  import_react9.useEffect(() => {
    if (!btw2)
      return;
    browserWindow.addEventListener("keydown", handleKeyDown);
    return () => browserWindow.removeEventListener("keydown", handleKeyDown);
  }, [btw2, handleKeyDown]);
  if (!btw2)
    return null;
  const isRunning = btw2.status === "running";
  const currentRecordId = btw2.recordId;
  const activeRecord = historyRecords.find((r) => r.id === currentRecordId);
  const copyAnswer = () => {
    const textToCopy = btw2.answer || (activeRecord ? activeRecord.answer : "");
    if (!textToCopy)
      return;
    const clipboard = browserWindow.navigator?.clipboard;
    if (clipboard?.writeText) {
      clipboard.writeText(textToCopy).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };
  const submitFollowUp = (e) => {
    e?.preventDefault();
    const q = followUpText.trim();
    if (!q || isRunning)
      return;
    onFollowUp?.(q, currentRecordId);
    setFollowUpText("");
  };
  return /* @__PURE__ */ jsx_runtime10.jsxs(jsx_runtime10.Fragment, {
    children: [
      /* @__PURE__ */ jsx_runtime10.jsx("div", {
        className: "btw-backdrop",
        onClick: () => {
          if (isRunning)
            onCancel();
          else
            onClose();
        }
      }),
      /* @__PURE__ */ jsx_runtime10.jsxs("div", {
        className: "btw-sheet",
        role: "dialog",
        "aria-label": "Side question (/btw)",
        children: [
          /* @__PURE__ */ jsx_runtime10.jsxs("div", {
            className: "btw-header",
            children: [
              /* @__PURE__ */ jsx_runtime10.jsxs("div", {
                className: "btw-header-text",
                children: [
                  /* @__PURE__ */ jsx_runtime10.jsx("span", {
                    className: "btw-badge",
                    children: "/btw"
                  }),
                  /* @__PURE__ */ jsx_runtime10.jsx("span", {
                    className: "btw-question",
                    title: btw2.question,
                    children: btw2.question
                  })
                ]
              }),
              /* @__PURE__ */ jsx_runtime10.jsxs("div", {
                className: "btw-header-actions",
                children: [
                  onLoadHistory && /* @__PURE__ */ jsx_runtime10.jsxs("button", {
                    type: "button",
                    className: "btw-icon-btn",
                    title: "History",
                    onClick: () => {
                      if (!showHistory)
                        onLoadHistory();
                      setShowHistory(!showHistory);
                    },
                    children: [
                      /* @__PURE__ */ jsx_runtime10.jsx(RotateCcwClock, {
                        size: 14
                      }),
                      /* @__PURE__ */ jsx_runtime10.jsx("span", {
                        children: showHistory ? "Current" : "History"
                      })
                    ]
                  }),
                  /* @__PURE__ */ jsx_runtime10.jsx("button", {
                    type: "button",
                    className: "btw-close",
                    "aria-label": "Close",
                    onClick: isRunning ? onCancel : onClose,
                    children: /* @__PURE__ */ jsx_runtime10.jsx(X, {
                      size: 18
                    })
                  })
                ]
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime10.jsx("div", {
            className: "btw-body",
            children: showHistory ? /* @__PURE__ */ jsx_runtime10.jsxs("div", {
              className: "btw-history-view",
              children: [
                /* @__PURE__ */ jsx_runtime10.jsx("div", {
                  className: "btw-history-title",
                  children: "Saved /btw Conversations"
                }),
                historyRecords.length === 0 ? /* @__PURE__ */ jsx_runtime10.jsx("div", {
                  className: "btw-history-empty",
                  children: "No history recorded yet"
                }) : /* @__PURE__ */ jsx_runtime10.jsx("div", {
                  className: "btw-history-list",
                  children: historyRecords.map((rec) => /* @__PURE__ */ jsx_runtime10.jsxs("button", {
                    type: "button",
                    className: "btw-history-item",
                    onClick: () => {
                      onSelectRecord?.(rec);
                      setShowHistory(false);
                    },
                    children: [
                      /* @__PURE__ */ jsx_runtime10.jsx("div", {
                        className: "btw-history-item-q",
                        children: rec.question
                      }),
                      /* @__PURE__ */ jsx_runtime10.jsxs("div", {
                        className: "btw-history-item-meta",
                        children: [
                          /* @__PURE__ */ jsx_runtime10.jsx("span", {
                            children: rec.status
                          }),
                          rec.followUps && rec.followUps.length > 0 && /* @__PURE__ */ jsx_runtime10.jsxs("span", {
                            children: [
                              rec.followUps.length,
                              " follow-up(s)"
                            ]
                          }),
                          /* @__PURE__ */ jsx_runtime10.jsx("span", {
                            children: new Date(rec.createdAt).toLocaleTimeString()
                          })
                        ]
                      })
                    ]
                  }, rec.id))
                })
              ]
            }) : /* @__PURE__ */ jsx_runtime10.jsxs(jsx_runtime10.Fragment, {
              children: [
                activeRecord && activeRecord.followUps && activeRecord.followUps.length > 0 ? /* @__PURE__ */ jsx_runtime10.jsxs("div", {
                  className: "btw-turn",
                  children: [
                    /* @__PURE__ */ jsx_runtime10.jsxs("div", {
                      className: "btw-turn-q",
                      children: [
                        /* @__PURE__ */ jsx_runtime10.jsx("span", {
                          className: "btw-q-label",
                          children: "Q:"
                        }),
                        /* @__PURE__ */ jsx_runtime10.jsx("span", {
                          children: activeRecord.question
                        })
                      ]
                    }),
                    /* @__PURE__ */ jsx_runtime10.jsx("div", {
                      className: "btw-turn-a",
                      children: /* @__PURE__ */ jsx_runtime10.jsx(Markdown, {
                        text: activeRecord.answer
                      })
                    }),
                    activeRecord.followUps.map((fu, idx) => /* @__PURE__ */ jsx_runtime10.jsxs("div", {
                      className: "btw-turn",
                      children: [
                        /* @__PURE__ */ jsx_runtime10.jsxs("div", {
                          className: "btw-turn-q",
                          children: [
                            /* @__PURE__ */ jsx_runtime10.jsx("span", {
                              className: "btw-q-label",
                              children: "Q:"
                            }),
                            /* @__PURE__ */ jsx_runtime10.jsx("span", {
                              children: fu.question
                            })
                          ]
                        }),
                        /* @__PURE__ */ jsx_runtime10.jsx("div", {
                          className: "btw-turn-a",
                          children: idx === activeRecord.followUps.length - 1 && btw2.status === "running" ? btw2.answer ? /* @__PURE__ */ jsx_runtime10.jsx(Markdown, {
                            text: btw2.answer
                          }) : /* @__PURE__ */ jsx_runtime10.jsx("div", {
                            className: "btw-status",
                            children: "Thinking..."
                          }) : /* @__PURE__ */ jsx_runtime10.jsx(Markdown, {
                            text: fu.answer
                          })
                        })
                      ]
                    }, idx))
                  ]
                }) : /* @__PURE__ */ jsx_runtime10.jsx("div", {
                  className: "btw-turn",
                  children: /* @__PURE__ */ jsx_runtime10.jsx("div", {
                    className: "btw-turn-a",
                    children: btw2.answer ? /* @__PURE__ */ jsx_runtime10.jsx(Markdown, {
                      text: btw2.answer
                    }) : isRunning ? /* @__PURE__ */ jsx_runtime10.jsx("div", {
                      className: "btw-status",
                      children: "Thinking..."
                    }) : null
                  })
                }),
                btw2.status === "error" && /* @__PURE__ */ jsx_runtime10.jsxs("div", {
                  className: "btw-error",
                  children: [
                    "Error: ",
                    btw2.error || "An unknown error occurred"
                  ]
                }),
                btw2.status === "cancelled" && /* @__PURE__ */ jsx_runtime10.jsx("div", {
                  className: "btw-cancelled",
                  children: "Question cancelled."
                })
              ]
            })
          }),
          !showHistory && !isRunning && onFollowUp && btw2.status === "complete" && /* @__PURE__ */ jsx_runtime10.jsxs("form", {
            className: "btw-followup-form",
            onSubmit: submitFollowUp,
            children: [
              /* @__PURE__ */ jsx_runtime10.jsx("input", {
                type: "text",
                className: "btw-followup-input",
                placeholder: "Ask a follow-up question...",
                value: followUpText,
                onChange: (e) => setFollowUpText(e.target.value)
              }),
              /* @__PURE__ */ jsx_runtime10.jsx("button", {
                type: "submit",
                className: "btw-btn btw-btn-primary",
                disabled: !followUpText.trim() || isRunning,
                children: "Send"
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime10.jsxs("div", {
            className: "btw-footer",
            children: [
              /* @__PURE__ */ jsx_runtime10.jsx("div", {
                className: "btw-footer-left",
                children: btw2.answer && /* @__PURE__ */ jsx_runtime10.jsxs("button", {
                  type: "button",
                  className: "btw-btn btw-btn-secondary",
                  onClick: copyAnswer,
                  children: [
                    /* @__PURE__ */ jsx_runtime10.jsx(Copy, {
                      size: 14
                    }),
                    /* @__PURE__ */ jsx_runtime10.jsx("span", {
                      children: copied ? "Copied" : "Copy"
                    })
                  ]
                })
              }),
              /* @__PURE__ */ jsx_runtime10.jsx("div", {
                className: "btw-footer-right",
                children: isRunning ? /* @__PURE__ */ jsx_runtime10.jsx("button", {
                  type: "button",
                  className: "btw-btn btw-btn-secondary",
                  onClick: onCancel,
                  children: "Cancel"
                }) : /* @__PURE__ */ jsx_runtime10.jsx("button", {
                  type: "button",
                  className: "btw-btn btw-btn-primary",
                  onClick: onClose,
                  children: "Close"
                })
              })
            ]
          })
        ]
      })
    ]
  });
}

// src/components/models/useModelsHub.tsx
var import_react18 = __toESM(require_react(), 1);

// src/lib/model-selector.ts
function toSelector(provider, id, thinkingLevel) {
  const base = `${provider}/${id}`;
  return thinkingLevel ? `${base}:${thinkingLevel}` : base;
}

// src/components/models/ModelsScreen.tsx
var import_react15 = __toESM(require_react(), 1);

// src/components/models/ActiveSection.tsx
var jsx_runtime11 = __toESM(require_jsx_runtime(), 1);
function explainModelSource(source) {
  if (!source) {
    return "Session model";
  }
  switch (source.kind) {
    case "role":
      return source.role === "default" ? "Default role" : `Role ${source.role ?? ""}`.trim();
    case "temporary":
      return "Session override (/switch)";
    case "ephemeral":
      return "Ephemeral override";
    case "fallback":
      return `Fallback from ${source.fallbackFrom ?? "unknown"}`;
    default:
      return "Session model";
  }
}
function ActiveSection({ state, roles, streaming, onPick, onCycle }) {
  const model = state?.model;
  const modelName = model?.name ?? (model ? `${model.provider}/${model.id}` : "No model selected");
  const thinkingLevel = state?.thinkingLevel;
  const modelSource = state?.modelSource;
  const explanation = explainModelSource(modelSource);
  const cycleOrder = roles?.cycleOrder ?? [];
  const canCycle = cycleOrder.length >= 2;
  const activeRoleKey = (modelSource?.kind === "role" ? modelSource.role : undefined) ?? roles?.roles.find((r) => model && r.resolved?.provider === model.provider && r.resolved?.id === model.id)?.id;
  return /* @__PURE__ */ jsx_runtime11.jsx("section", {
    className: "md-section md-active-section",
    children: /* @__PURE__ */ jsx_runtime11.jsxs("div", {
      className: "md-active-card",
      children: [
        /* @__PURE__ */ jsx_runtime11.jsxs("div", {
          className: "md-active-header",
          children: [
            /* @__PURE__ */ jsx_runtime11.jsxs("div", {
              className: "md-active-info",
              children: [
                /* @__PURE__ */ jsx_runtime11.jsxs("div", {
                  className: "md-active-name-row",
                  children: [
                    /* @__PURE__ */ jsx_runtime11.jsx("span", {
                      className: "md-active-name",
                      children: modelName
                    }),
                    thinkingLevel !== undefined && /* @__PURE__ */ jsx_runtime11.jsxs("span", {
                      className: "md-active-thinking",
                      children: [
                        "thinking: ",
                        thinkingLevel
                      ]
                    })
                  ]
                }),
                /* @__PURE__ */ jsx_runtime11.jsx("div", {
                  className: "md-active-explanation",
                  children: explanation
                }),
                streaming && /* @__PURE__ */ jsx_runtime11.jsx("div", {
                  className: "md-active-hint",
                  children: "applies at next request"
                })
              ]
            }),
            /* @__PURE__ */ jsx_runtime11.jsxs("div", {
              className: "md-active-actions",
              children: [
                /* @__PURE__ */ jsx_runtime11.jsx("button", {
                  type: "button",
                  className: "md-btn md-btn--pick",
                  onClick: onPick,
                  children: "Pick"
                }),
                /* @__PURE__ */ jsx_runtime11.jsxs("div", {
                  className: "md-cycle-buttons",
                  children: [
                    /* @__PURE__ */ jsx_runtime11.jsx("button", {
                      type: "button",
                      className: "md-btn md-btn--icon",
                      disabled: !canCycle,
                      onClick: () => onCycle("backward"),
                      "aria-label": "Previous role in cycle",
                      title: "Previous role",
                      children: /* @__PURE__ */ jsx_runtime11.jsx(ChevronLeft, {
                        size: 16
                      })
                    }),
                    /* @__PURE__ */ jsx_runtime11.jsx("button", {
                      type: "button",
                      className: "md-btn md-btn--icon",
                      disabled: !canCycle,
                      onClick: () => onCycle("forward"),
                      "aria-label": "Next role in cycle",
                      title: "Next role",
                      children: /* @__PURE__ */ jsx_runtime11.jsx(ChevronRight, {
                        size: 16
                      })
                    })
                  ]
                })
              ]
            })
          ]
        }),
        cycleOrder.length > 0 && /* @__PURE__ */ jsx_runtime11.jsx("div", {
          className: "md-cycle-track",
          "aria-label": "Cycle order",
          children: cycleOrder.map((roleId) => {
            const roleObj = roles?.roles.find((r) => r.id === roleId);
            const label = roleObj?.name ?? roleId;
            const isActive = roleId === activeRoleKey;
            return /* @__PURE__ */ jsx_runtime11.jsx("span", {
              className: `md-cycle-chip ${isActive ? "md-cycle-chip--active" : ""}`,
              children: label
            }, roleId);
          })
        })
      ]
    })
  });
}

// src/components/models/RolesSection.tsx
var import_react12 = __toESM(require_react(), 1);

// src/components/models/RoleRow.tsx
var import_react10 = __toESM(require_react(), 1);
var jsx_runtime12 = __toESM(require_jsx_runtime(), 1);
function RoleRow({ role, storage, onClick, onClearRole, onDeleteRole, onSetTag }) {
  const [scopeArm, setScopeArm] = import_react10.useState(null);
  const [deleteArm, setDeleteArm] = import_react10.useState(false);
  const [editingTag, setEditingTag] = import_react10.useState(false);
  const [tagInput, setTagInput] = import_react10.useState(role.tag ?? "");
  const model = role.resolved ?? role.autoSelected;
  const isAuto = !role.resolved && !!role.autoSelected;
  const isConfigured = Boolean(role.configured);
  const handleScopeClick = (e) => {
    e.stopPropagation();
    if (!onClearRole)
      return;
    if (scopeArm === "project") {
      onClearRole(role.id, "project");
      setScopeArm(null);
    } else if (scopeArm === "global") {
      onClearRole(role.id, "global");
      setScopeArm(null);
    } else if (role.provenance === "project") {
      setScopeArm("project");
    } else if (role.provenance === "global") {
      setScopeArm("global");
    } else {
      setScopeArm("project");
    }
  };
  const handleDeleteClick = (e) => {
    e.stopPropagation();
    if (!onDeleteRole)
      return;
    if (deleteArm) {
      onDeleteRole(role.id);
      setDeleteArm(false);
    } else {
      setDeleteArm(true);
    }
  };
  const handleTagKeyDown = (e) => {
    if (e.key === "Enter") {
      e.stopPropagation();
      setEditingTag(false);
      const selector = role.resolved?.id ? `${role.resolved.provider}/${role.resolved.id}` : role.configured;
      if (selector && onSetTag) {
        const trimmed = tagInput.trim();
        onSetTag(selector, trimmed.length > 0 ? trimmed : null);
      }
    } else if (e.key === "Escape") {
      e.stopPropagation();
      setEditingTag(false);
      setTagInput(role.tag ?? "");
    }
  };
  const badgeType = role.provenance ?? (role.source === "active" ? "active" : role.source);
  const shouldShowBadge = badgeType && badgeType !== "default" && role.source !== "unset";
  let badgeText = badgeType;
  if (badgeType === "runtime") {
    badgeText = "session only";
  } else if (role.source === "fallback" && role.fallbackFrom) {
    badgeText = `fallback from ${role.fallbackFrom}`;
  }
  return /* @__PURE__ */ jsx_runtime12.jsxs("div", {
    className: "md-row md-role-row",
    onClick,
    role: "button",
    tabIndex: 0,
    onKeyDown: (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick();
      }
    },
    children: [
      /* @__PURE__ */ jsx_runtime12.jsxs("div", {
        className: "md-row-main",
        children: [
          /* @__PURE__ */ jsx_runtime12.jsx("span", {
            className: "md-row-name",
            children: role.name
          }),
          /* @__PURE__ */ jsx_runtime12.jsx("span", {
            className: "md-row-id",
            children: role.id
          }),
          role.tag && !editingTag && /* @__PURE__ */ jsx_runtime12.jsx("button", {
            type: "button",
            className: "md-tag-chip",
            title: "Click to edit tag",
            onClick: (e) => {
              e.stopPropagation();
              setEditingTag(true);
            },
            children: role.tag
          }),
          !role.tag && !editingTag && onSetTag && /* @__PURE__ */ jsx_runtime12.jsx("button", {
            type: "button",
            className: "md-tag-chip md-tag-chip--add",
            title: "Add tag",
            onClick: (e) => {
              e.stopPropagation();
              setEditingTag(true);
            },
            children: "+ tag"
          }),
          editingTag && /* @__PURE__ */ jsx_runtime12.jsx("input", {
            type: "text",
            className: "md-tag-input",
            value: tagInput,
            autoFocus: true,
            onClick: (e) => e.stopPropagation(),
            onChange: (e) => setTagInput(e.target.value),
            onKeyDown: handleTagKeyDown,
            onBlur: () => {
              setEditingTag(false);
              setTagInput(role.tag ?? "");
            },
            placeholder: "tag..."
          })
        ]
      }),
      /* @__PURE__ */ jsx_runtime12.jsxs("div", {
        className: "md-row-detail",
        children: [
          model ? /* @__PURE__ */ jsx_runtime12.jsxs(jsx_runtime12.Fragment, {
            children: [
              /* @__PURE__ */ jsx_runtime12.jsxs("span", {
                className: "md-row-model",
                children: [
                  model.name,
                  model.thinkingLevel ? ` (${model.thinkingLevel})` : ""
                ]
              }),
              isAuto ? /* @__PURE__ */ jsx_runtime12.jsx("span", {
                className: "md-badge md-badge--auto",
                children: "auto"
              }) : null
            ]
          }) : /* @__PURE__ */ jsx_runtime12.jsx("span", {
            className: "md-row-model md-row-unset",
            children: "unset"
          }),
          shouldShowBadge && /* @__PURE__ */ jsx_runtime12.jsx(jsx_runtime12.Fragment, {
            children: storage === "project" && isConfigured && onClearRole ? /* @__PURE__ */ jsx_runtime12.jsx("button", {
              type: "button",
              className: `md-badge md-badge--${badgeType} md-badge--scope-control`,
              onClick: handleScopeClick,
              title: "Click to change scope or clear",
              children: scopeArm ? `tap again to clear ${scopeArm}` : badgeText
            }) : /* @__PURE__ */ jsx_runtime12.jsx("span", {
              className: `md-badge md-badge--${badgeType}`,
              children: badgeText
            })
          }),
          role.custom && onDeleteRole && /* @__PURE__ */ jsx_runtime12.jsx("button", {
            type: "button",
            className: `md-role-delete-btn ${deleteArm ? "md-role-delete-btn--armed" : ""}`,
            onClick: handleDeleteClick,
            "aria-label": deleteArm ? `Tap again to delete ${role.id}` : `Delete ${role.id}`,
            title: deleteArm ? "Tap again to delete" : "Delete role",
            children: deleteArm ? "tap again to delete" : /* @__PURE__ */ jsx_runtime12.jsx(Trash, {
              size: 16
            })
          })
        ]
      }),
      role.warning && /* @__PURE__ */ jsx_runtime12.jsx("div", {
        className: "md-row-warn",
        children: role.warning
      })
    ]
  });
}

// src/components/models/CycleOrderEditor.tsx
var import_react11 = __toESM(require_react(), 1);
var jsx_runtime13 = __toESM(require_jsx_runtime(), 1);
function toggleCycleRole(order, roleId) {
  if (order.includes(roleId)) {
    return order.filter((id) => id !== roleId);
  }
  return [...order, roleId];
}
function moveCycleRole(order, roleId, delta) {
  const index2 = order.indexOf(roleId);
  if (index2 === -1)
    return order;
  const nextIndex = Math.max(0, Math.min(order.length - 1, index2 + delta));
  if (nextIndex === index2)
    return order;
  const next = [...order];
  const [item] = next.splice(index2, 1);
  next.splice(nextIndex, 0, item);
  return next;
}
function CycleOrderEditor({ roles, cycleOrder, onChange }) {
  const [expanded, setExpanded] = import_react11.useState(false);
  return /* @__PURE__ */ jsx_runtime13.jsxs("div", {
    className: "md-cycle-editor",
    children: [
      /* @__PURE__ */ jsx_runtime13.jsxs("button", {
        type: "button",
        className: "md-cycle-toggle",
        onClick: () => setExpanded((prev) => !prev),
        "aria-expanded": expanded,
        children: [
          /* @__PURE__ */ jsx_runtime13.jsx("span", {
            className: "md-cycle-title",
            children: "Quick-switch cycle"
          }),
          /* @__PURE__ */ jsx_runtime13.jsxs("span", {
            className: "md-cycle-count",
            children: [
              "(",
              cycleOrder.length,
              ")"
            ]
          }),
          expanded ? /* @__PURE__ */ jsx_runtime13.jsx(ChevronUp, {
            size: 16
          }) : /* @__PURE__ */ jsx_runtime13.jsx(ChevronDown, {
            size: 16
          })
        ]
      }),
      expanded && /* @__PURE__ */ jsx_runtime13.jsx("div", {
        className: "md-cycle-body",
        children: /* @__PURE__ */ jsx_runtime13.jsx("div", {
          className: "md-cycle-list",
          children: roles.map((role) => {
            const checked = cycleOrder.includes(role.id);
            return /* @__PURE__ */ jsx_runtime13.jsxs("div", {
              className: "md-cycle-item",
              children: [
                /* @__PURE__ */ jsx_runtime13.jsxs("label", {
                  className: "md-cycle-label",
                  children: [
                    /* @__PURE__ */ jsx_runtime13.jsx("input", {
                      type: "checkbox",
                      checked,
                      onChange: () => onChange(toggleCycleRole(cycleOrder, role.id))
                    }),
                    /* @__PURE__ */ jsx_runtime13.jsx("span", {
                      className: "md-cycle-name",
                      children: role.name
                    }),
                    /* @__PURE__ */ jsx_runtime13.jsx("span", {
                      className: "md-cycle-id",
                      children: role.id
                    })
                  ]
                }),
                checked && /* @__PURE__ */ jsx_runtime13.jsxs("div", {
                  className: "md-cycle-actions",
                  children: [
                    /* @__PURE__ */ jsx_runtime13.jsx("button", {
                      type: "button",
                      className: "md-cycle-btn",
                      "aria-label": `Move ${role.id} up`,
                      disabled: cycleOrder.indexOf(role.id) <= 0,
                      onClick: () => onChange(moveCycleRole(cycleOrder, role.id, -1)),
                      children: /* @__PURE__ */ jsx_runtime13.jsx(ChevronUp, {
                        size: 16
                      })
                    }),
                    /* @__PURE__ */ jsx_runtime13.jsx("button", {
                      type: "button",
                      className: "md-cycle-btn",
                      "aria-label": `Move ${role.id} down`,
                      disabled: cycleOrder.indexOf(role.id) >= cycleOrder.length - 1,
                      onClick: () => onChange(moveCycleRole(cycleOrder, role.id, 1)),
                      children: /* @__PURE__ */ jsx_runtime13.jsx(ChevronDown, {
                        size: 16
                      })
                    })
                  ]
                })
              ]
            }, role.id);
          })
        })
      })
    ]
  });
}

// src/components/models/RolesSection.tsx
var jsx_runtime14 = __toESM(require_jsx_runtime(), 1);
function sortedRoles(roles) {
  const chat = roles.roles.filter((r) => r.section === "chat");
  const kind = roles.roles.filter((r) => r.section === "kind");
  return [...chat, ...kind];
}
function validateRoleId(id, existing) {
  if (!id)
    return "Role ID cannot be empty";
  if (!/^[a-zA-Z][\w-]*$/.test(id)) {
    return "Role ID must start with a letter and contain only letters, numbers, underscores, and dashes";
  }
  if (existing.includes(id)) {
    return `Role "${id}" already exists`;
  }
  return null;
}
function RolesSection({
  roles,
  onPickRole,
  onClearRole,
  onCreateRole,
  onDeleteRole,
  onSetCycleOrder,
  onSetTag
}) {
  const [isAdding, setIsAdding] = import_react12.useState(false);
  const [newRoleId, setNewRoleId] = import_react12.useState("");
  const [validationError, setValidationError] = import_react12.useState(null);
  if (!roles) {
    return /* @__PURE__ */ jsx_runtime14.jsx("section", {
      className: "md-section md-roles-section",
      children: /* @__PURE__ */ jsx_runtime14.jsx("div", {
        className: "md-empty",
        children: "loading..."
      })
    });
  }
  const existingIds = roles.roles.map((r) => r.id);
  const orderedRoles = sortedRoles(roles);
  const handleCreateSubmit = () => {
    const trimmed = newRoleId.trim();
    const err = validateRoleId(trimmed, existingIds);
    if (err) {
      setValidationError(err);
      return;
    }
    onCreateRole(trimmed);
    setNewRoleId("");
    setValidationError(null);
    setIsAdding(false);
  };
  return /* @__PURE__ */ jsx_runtime14.jsxs("section", {
    className: "md-section md-roles-section",
    children: [
      /* @__PURE__ */ jsx_runtime14.jsx("div", {
        className: "md-list",
        children: orderedRoles.map((role) => /* @__PURE__ */ jsx_runtime14.jsx(RoleRow, {
          role,
          storage: roles.storage,
          onClick: () => onPickRole(role.id),
          onClearRole,
          onDeleteRole,
          onSetTag
        }, role.id))
      }),
      /* @__PURE__ */ jsx_runtime14.jsx("div", {
        className: "md-roles-footer",
        children: !isAdding ? /* @__PURE__ */ jsx_runtime14.jsxs("button", {
          type: "button",
          className: "md-new-role-btn",
          onClick: () => {
            setIsAdding(true);
            setValidationError(null);
          },
          children: [
            /* @__PURE__ */ jsx_runtime14.jsx(Plus, {
              size: 16
            }),
            /* @__PURE__ */ jsx_runtime14.jsx("span", {
              children: "New role"
            })
          ]
        }) : /* @__PURE__ */ jsx_runtime14.jsxs("div", {
          className: "md-new-role-form",
          children: [
            /* @__PURE__ */ jsx_runtime14.jsxs("div", {
              className: "md-new-role-input-row",
              children: [
                /* @__PURE__ */ jsx_runtime14.jsx("input", {
                  type: "text",
                  className: `md-new-role-input ${validationError ? "md-new-role-input--error" : ""}`,
                  value: newRoleId,
                  autoFocus: true,
                  onChange: (e) => {
                    setNewRoleId(e.target.value);
                    if (validationError) {
                      setValidationError(null);
                    }
                  },
                  onKeyDown: (e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreateSubmit();
                    } else if (e.key === "Escape") {
                      setIsAdding(false);
                      setNewRoleId("");
                      setValidationError(null);
                    }
                  },
                  placeholder: "role-id (e.g. planner)"
                }),
                /* @__PURE__ */ jsx_runtime14.jsx("button", {
                  type: "button",
                  className: "md-new-role-submit",
                  onClick: handleCreateSubmit,
                  children: "Create"
                }),
                /* @__PURE__ */ jsx_runtime14.jsx("button", {
                  type: "button",
                  className: "md-new-role-cancel",
                  onClick: () => {
                    setIsAdding(false);
                    setNewRoleId("");
                    setValidationError(null);
                  },
                  children: "Cancel"
                })
              ]
            }),
            validationError && /* @__PURE__ */ jsx_runtime14.jsx("div", {
              className: "md-new-role-error",
              role: "alert",
              children: validationError
            })
          ]
        })
      }),
      /* @__PURE__ */ jsx_runtime14.jsx(CycleOrderEditor, {
        roles: roles.roles,
        cycleOrder: roles.cycleOrder,
        onChange: onSetCycleOrder
      })
    ]
  });
}

// src/components/models/AgentRow.tsx
var import_react13 = __toESM(require_react(), 1);
var jsx_runtime15 = __toESM(require_jsx_runtime(), 1);
var tierOptions = [
  { label: "inherit (unset)", value: "" },
  { label: "inherit", value: "inherit" },
  { label: "none", value: "none" },
  { label: "auto", value: "auto" },
  { label: "default", value: "default" },
  { label: "flex", value: "flex" },
  { label: "scale", value: "scale" },
  { label: "priority", value: "priority" }
];
function prewalkSegment(prewalk) {
  if (!prewalk || prewalk.source === "none") {
    return "off";
  }
  const effective = prewalk.effective?.trim();
  if (!effective || effective === "off") {
    return "off";
  }
  if (effective === "@smol" || effective === "on") {
    return "on";
  }
  return "custom";
}
function describePrecedenceEntry(entry) {
  return `${entry.source}: ${entry.selector}`;
}
function AgentRow({
  agent,
  defaultExpanded = false,
  onPickAgent,
  onSetEnabled,
  onSetServiceTier,
  onSetPrewalk,
  onSetAdvisor
}) {
  const [expanded, setExpanded] = import_react13.useState(defaultExpanded);
  const [customPrewalk, setCustomPrewalk] = import_react13.useState("");
  const [customAdvisor, setCustomAdvisor] = import_react13.useState("");
  const isDimmed = agent.disabled;
  const prewalkSeg = prewalkSegment(agent.prewalk);
  const advisorSeg = prewalkSegment(agent.advisor);
  const resolvedModelName = agent.resolved?.name ?? (agent.patterns && agent.patterns.length > 0 ? agent.patterns[0] : "default");
  return /* @__PURE__ */ jsx_runtime15.jsxs("div", {
    className: `ag-row${isDimmed ? " ag-row--dimmed" : ""}`,
    children: [
      /* @__PURE__ */ jsx_runtime15.jsxs("div", {
        className: "ag-header",
        role: "button",
        tabIndex: 0,
        onClick: () => setExpanded(!expanded),
        onKeyDown: (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded(!expanded);
          }
        },
        children: [
          /* @__PURE__ */ jsx_runtime15.jsxs("div", {
            className: "ag-header-left",
            children: [
              /* @__PURE__ */ jsx_runtime15.jsx("span", {
                className: "ag-name",
                children: agent.name
              }),
              /* @__PURE__ */ jsx_runtime15.jsx("span", {
                className: "ag-badge ag-badge--source",
                children: agent.source
              }),
              agent.isDefaultTaskAgent && /* @__PURE__ */ jsx_runtime15.jsx("span", {
                className: "ag-badge ag-badge--default",
                children: "default task agent"
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime15.jsx("div", {
            className: "ag-header-right",
            children: /* @__PURE__ */ jsx_runtime15.jsx("button", {
              type: "button",
              role: "switch",
              "aria-checked": !agent.disabled,
              "aria-label": `Enable ${agent.name}`,
              className: "ag-toggle",
              onClick: (e) => {
                e.stopPropagation();
                onSetEnabled(agent.name, agent.disabled);
              },
              children: /* @__PURE__ */ jsx_runtime15.jsx("span", {
                className: "ag-toggle-thumb"
              })
            })
          })
        ]
      }),
      expanded && /* @__PURE__ */ jsx_runtime15.jsxs("div", {
        className: "ag-body",
        children: [
          /* @__PURE__ */ jsx_runtime15.jsxs("div", {
            className: "ag-field",
            children: [
              /* @__PURE__ */ jsx_runtime15.jsx("span", {
                className: "ag-field-label",
                children: "Model"
              }),
              /* @__PURE__ */ jsx_runtime15.jsxs("button", {
                type: "button",
                className: "ag-model-btn",
                onClick: () => onPickAgent(agent.name),
                children: [
                  /* @__PURE__ */ jsx_runtime15.jsx("span", {
                    className: "ag-model-name",
                    children: resolvedModelName
                  }),
                  agent.override && /* @__PURE__ */ jsx_runtime15.jsx("span", {
                    className: "ag-badge ag-badge--override",
                    children: "override"
                  }),
                  !agent.override && agent.declaredModel && agent.declaredModel.length > 0 && /* @__PURE__ */ jsx_runtime15.jsx("span", {
                    className: "ag-badge ag-badge--declared",
                    children: "declared"
                  })
                ]
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime15.jsxs("div", {
            className: "ag-field",
            children: [
              /* @__PURE__ */ jsx_runtime15.jsx("span", {
                className: "ag-field-label",
                children: "Service Tier"
              }),
              /* @__PURE__ */ jsx_runtime15.jsx("select", {
                className: "ag-select",
                value: agent.serviceTier ?? "",
                onChange: (e) => {
                  const val = e.target.value;
                  onSetServiceTier(agent.name, val === "" ? null : val);
                },
                children: tierOptions.map((opt) => /* @__PURE__ */ jsx_runtime15.jsx("option", {
                  value: opt.value,
                  children: opt.label
                }, opt.value))
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime15.jsxs("div", {
            className: "ag-field",
            children: [
              /* @__PURE__ */ jsx_runtime15.jsx("span", {
                className: "ag-field-label",
                children: "Prewalk"
              }),
              /* @__PURE__ */ jsx_runtime15.jsxs("div", {
                className: "ag-control-row",
                children: [
                  /* @__PURE__ */ jsx_runtime15.jsxs("div", {
                    className: "ag-control-meta",
                    children: [
                      /* @__PURE__ */ jsx_runtime15.jsx("span", {
                        className: "ag-control-effective",
                        children: agent.prewalk?.effective ?? "off"
                      }),
                      /* @__PURE__ */ jsx_runtime15.jsx("span", {
                        className: "ag-badge ag-badge--source",
                        children: agent.prewalk?.source ?? "none"
                      })
                    ]
                  }),
                  /* @__PURE__ */ jsx_runtime15.jsxs("div", {
                    className: "ag-control-actions",
                    children: [
                      /* @__PURE__ */ jsx_runtime15.jsxs("div", {
                        className: "ag-segmented",
                        role: "radiogroup",
                        children: [
                          /* @__PURE__ */ jsx_runtime15.jsx("button", {
                            type: "button",
                            className: `ag-segmented-btn${prewalkSeg === "on" ? " ag-segmented-btn--active" : ""}`,
                            onClick: () => onSetPrewalk(agent.name, "on"),
                            children: "On"
                          }),
                          /* @__PURE__ */ jsx_runtime15.jsx("button", {
                            type: "button",
                            className: `ag-segmented-btn${prewalkSeg === "off" ? " ag-segmented-btn--active" : ""}`,
                            onClick: () => onSetPrewalk(agent.name, "off"),
                            children: "Off"
                          }),
                          /* @__PURE__ */ jsx_runtime15.jsx("button", {
                            type: "button",
                            className: `ag-segmented-btn${prewalkSeg === "custom" ? " ag-segmented-btn--active" : ""}`,
                            onClick: () => {
                              if (prewalkSeg !== "custom") {
                                setCustomPrewalk(agent.prewalk?.effective ?? "");
                              }
                            },
                            children: "Custom"
                          })
                        ]
                      }),
                      prewalkSeg === "custom" && /* @__PURE__ */ jsx_runtime15.jsx("input", {
                        type: "text",
                        className: "ag-custom-input",
                        placeholder: "selector...",
                        value: customPrewalk || (agent.prewalk?.effective ?? ""),
                        onChange: (e) => setCustomPrewalk(e.target.value),
                        onKeyDown: (e) => {
                          if (e.key === "Enter") {
                            onSetPrewalk(agent.name, e.currentTarget.value);
                          }
                        }
                      }),
                      agent.prewalk?.source === "override" && /* @__PURE__ */ jsx_runtime15.jsx("button", {
                        type: "button",
                        className: "ag-btn-reset",
                        onClick: () => onSetPrewalk(agent.name, null),
                        children: "Reset"
                      })
                    ]
                  })
                ]
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime15.jsxs("div", {
            className: "ag-field",
            children: [
              /* @__PURE__ */ jsx_runtime15.jsx("span", {
                className: "ag-field-label",
                children: "Advisor"
              }),
              /* @__PURE__ */ jsx_runtime15.jsxs("div", {
                className: "ag-control-row",
                children: [
                  /* @__PURE__ */ jsx_runtime15.jsxs("div", {
                    className: "ag-control-meta",
                    children: [
                      /* @__PURE__ */ jsx_runtime15.jsx("span", {
                        className: "ag-control-effective",
                        children: agent.advisor?.effective ?? "off"
                      }),
                      /* @__PURE__ */ jsx_runtime15.jsx("span", {
                        className: "ag-badge ag-badge--source",
                        children: agent.advisor?.source ?? "none"
                      })
                    ]
                  }),
                  /* @__PURE__ */ jsx_runtime15.jsxs("div", {
                    className: "ag-control-actions",
                    children: [
                      /* @__PURE__ */ jsx_runtime15.jsxs("div", {
                        className: "ag-segmented",
                        role: "radiogroup",
                        children: [
                          /* @__PURE__ */ jsx_runtime15.jsx("button", {
                            type: "button",
                            className: `ag-segmented-btn${advisorSeg === "on" ? " ag-segmented-btn--active" : ""}`,
                            onClick: () => onSetAdvisor(agent.name, "on"),
                            children: "On"
                          }),
                          /* @__PURE__ */ jsx_runtime15.jsx("button", {
                            type: "button",
                            className: `ag-segmented-btn${advisorSeg === "off" ? " ag-segmented-btn--active" : ""}`,
                            onClick: () => onSetAdvisor(agent.name, "off"),
                            children: "Off"
                          }),
                          /* @__PURE__ */ jsx_runtime15.jsx("button", {
                            type: "button",
                            className: `ag-segmented-btn${advisorSeg === "custom" ? " ag-segmented-btn--active" : ""}`,
                            onClick: () => {
                              if (advisorSeg !== "custom") {
                                setCustomAdvisor(agent.advisor?.effective ?? "");
                              }
                            },
                            children: "Custom"
                          })
                        ]
                      }),
                      advisorSeg === "custom" && /* @__PURE__ */ jsx_runtime15.jsx("input", {
                        type: "text",
                        className: "ag-custom-input",
                        placeholder: "selector...",
                        value: customAdvisor || (agent.advisor?.effective ?? ""),
                        onChange: (e) => setCustomAdvisor(e.target.value),
                        onKeyDown: (e) => {
                          if (e.key === "Enter") {
                            onSetAdvisor(agent.name, e.currentTarget.value);
                          }
                        }
                      }),
                      agent.advisor?.source === "override" && /* @__PURE__ */ jsx_runtime15.jsx("button", {
                        type: "button",
                        className: "ag-btn-reset",
                        onClick: () => onSetAdvisor(agent.name, null),
                        children: "Reset"
                      })
                    ]
                  })
                ]
              })
            ]
          }),
          agent.precedence?.entries && agent.precedence.entries.length > 0 && /* @__PURE__ */ jsx_runtime15.jsxs("details", {
            className: "ag-precedence",
            open: true,
            children: [
              /* @__PURE__ */ jsx_runtime15.jsx("summary", {
                className: "ag-precedence-summary",
                children: "Model Precedence"
              }),
              /* @__PURE__ */ jsx_runtime15.jsx("ol", {
                className: "ag-precedence-list",
                children: agent.precedence.entries.map((entry, idx) => {
                  const isWinner = idx === agent.precedence.winner;
                  return /* @__PURE__ */ jsx_runtime15.jsxs("li", {
                    className: `ag-precedence-entry${isWinner ? " ag-precedence-entry--winner" : ""}`,
                    children: [
                      isWinner && /* @__PURE__ */ jsx_runtime15.jsx("span", {
                        className: "ag-precedence-marker",
                        children: "✓ "
                      }),
                      /* @__PURE__ */ jsx_runtime15.jsx("span", {
                        children: describePrecedenceEntry(entry)
                      })
                    ]
                  }, `${entry.source}-${entry.selector}-${idx}`);
                })
              })
            ]
          })
        ]
      })
    ]
  });
}

// src/components/models/AgentsSection.tsx
var jsx_runtime16 = __toESM(require_jsx_runtime(), 1);
function AgentsSection({
  agents,
  onPickAgent,
  onSetEnabled,
  onSetServiceTier,
  onSetPrewalk,
  onSetAdvisor
}) {
  if (!agents || agents.agents.length === 0) {
    return null;
  }
  return /* @__PURE__ */ jsx_runtime16.jsx("div", {
    className: "ag-section",
    children: agents.agents.map((agent) => /* @__PURE__ */ jsx_runtime16.jsx(AgentRow, {
      agent,
      onPickAgent,
      onSetEnabled,
      onSetServiceTier,
      onSetPrewalk,
      onSetAdvisor
    }, agent.name))
  });
}

// src/components/models/ProvidersSection.tsx
var import_react14 = __toESM(require_react(), 1);
var jsx_runtime17 = __toESM(require_jsx_runtime(), 1);
function relativeTime(ts, now2 = Date.now()) {
  const diffSec = Math.max(0, Math.floor((now2 - ts) / 1000));
  if (diffSec < 5) {
    return "just now";
  }
  if (diffSec < 60) {
    return `${diffSec}s ago`;
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) {
    return `${diffHour}h ago`;
  }
  const diffDays = Math.floor(diffHour / 24);
  return `${diffDays}d ago`;
}
function describeDiscovery(discovery, now2 = Date.now()) {
  if (!discovery) {
    return { text: "idle" };
  }
  const { status, fetchedAt, error } = discovery;
  let text = status;
  if (status === "cached" && typeof fetchedAt === "number") {
    text = `cached ${relativeTime(fetchedAt, now2)}`;
  } else if (status === "ok" && typeof fetchedAt === "number") {
    text = `updated ${relativeTime(fetchedAt, now2)}`;
  }
  return {
    text,
    error: error ? error : undefined
  };
}
function sortProviders(providers) {
  return [...providers].sort((a, b) => {
    if (a.authenticated !== b.authenticated) {
      return a.authenticated ? -1 : 1;
    }
    return a.id.localeCompare(b.id);
  });
}
function ProvidersSection({
  browser,
  loginStatus,
  refreshing,
  onRefresh,
  onLogin,
  onLogout
}) {
  const [confirmCredentialId, setConfirmCredentialId] = import_react14.useState(null);
  const isRefreshingAll = refreshing === "all";
  const isAnyRefreshing = refreshing !== null;
  return /* @__PURE__ */ jsx_runtime17.jsxs("section", {
    className: "mp-section",
    "aria-label": "Providers",
    children: [
      /* @__PURE__ */ jsx_runtime17.jsx("div", {
        className: "mp-header",
        children: /* @__PURE__ */ jsx_runtime17.jsxs("button", {
          type: "button",
          className: "mp-refresh-all",
          disabled: isAnyRefreshing,
          onClick: () => onRefresh(undefined),
          "aria-label": "Refresh all providers",
          children: [
            /* @__PURE__ */ jsx_runtime17.jsx(RotateCw, {
              size: 14,
              className: isRefreshingAll ? "mp-spinner" : undefined,
              "aria-hidden": "true"
            }),
            /* @__PURE__ */ jsx_runtime17.jsx("span", {
              children: "Refresh all"
            })
          ]
        })
      }),
      !browser ? /* @__PURE__ */ jsx_runtime17.jsx("div", {
        className: "mp-loading",
        role: "status",
        children: "Loading providers..."
      }) : /* @__PURE__ */ jsx_runtime17.jsx("div", {
        className: "mp-list",
        children: sortProviders(browser.providers).map((provider) => {
          const isProviderRefreshing = refreshing === provider.id;
          const isLocked = !provider.authenticated;
          const discoveryInfo = describeDiscovery(provider.discovery);
          const statusProvider = loginStatus?.providers.find((p) => p.id === provider.id || p.storeCredentialsAs === provider.id);
          const canLogin = isLocked && Boolean(statusProvider && onLogin);
          const mainContent = /* @__PURE__ */ jsx_runtime17.jsxs("div", {
            className: "mp-row-main",
            children: [
              /* @__PURE__ */ jsx_runtime17.jsxs("div", {
                className: "mp-row-top",
                children: [
                  /* @__PURE__ */ jsx_runtime17.jsx("span", {
                    className: "mp-provider-id",
                    children: provider.id
                  }),
                  /* @__PURE__ */ jsx_runtime17.jsxs("span", {
                    className: "mp-model-count",
                    children: [
                      provider.modelCount,
                      " ",
                      provider.modelCount === 1 ? "model" : "models"
                    ]
                  }),
                  /* @__PURE__ */ jsx_runtime17.jsx("span", {
                    className: `mp-auth-badge ${provider.authenticated ? "signed-in" : "no-key"}`,
                    children: provider.authenticated ? "signed in" : "no API key"
                  })
                ]
              }),
              /* @__PURE__ */ jsx_runtime17.jsxs("div", {
                className: "mp-row-sub",
                children: [
                  /* @__PURE__ */ jsx_runtime17.jsx("span", {
                    className: "mp-discovery-status",
                    children: discoveryInfo.text
                  }),
                  discoveryInfo.error ? /* @__PURE__ */ jsx_runtime17.jsx("span", {
                    className: "mp-discovery-error",
                    children: discoveryInfo.error
                  }) : null
                ]
              })
            ]
          });
          if (canLogin && statusProvider) {
            return /* @__PURE__ */ jsx_runtime17.jsx("button", {
              type: "button",
              className: "mp-row mp-row-locked mp-row-tappable",
              "data-provider-id": provider.id,
              "data-locked": "true",
              onClick: () => onLogin?.(statusProvider.id),
              children: mainContent
            }, provider.id);
          }
          const accounts = provider.authenticated && statusProvider?.accounts ? statusProvider.accounts : [];
          return /* @__PURE__ */ jsx_runtime17.jsxs("div", {
            className: `mp-row${isLocked ? " mp-row-locked" : ""}`,
            "data-provider-id": provider.id,
            "data-locked": isLocked ? "true" : undefined,
            children: [
              mainContent,
              provider.discoverable ? /* @__PURE__ */ jsx_runtime17.jsx("button", {
                type: "button",
                className: "mp-refresh-btn",
                disabled: isAnyRefreshing,
                onClick: () => onRefresh(provider.id),
                "aria-label": `Refresh ${provider.id}`,
                children: /* @__PURE__ */ jsx_runtime17.jsx(RotateCw, {
                  size: 16,
                  className: isProviderRefreshing ? "mp-spinner" : undefined,
                  "aria-hidden": "true"
                })
              }) : null,
              accounts.length > 0 ? /* @__PURE__ */ jsx_runtime17.jsx("div", {
                className: "mp-accounts-list",
                children: accounts.map((acc) => /* @__PURE__ */ jsx_runtime17.jsx("div", {
                  className: "mp-account-row",
                  children: confirmCredentialId === acc.credentialId ? /* @__PURE__ */ jsx_runtime17.jsxs("div", {
                    className: "mp-logout-confirm",
                    children: [
                      /* @__PURE__ */ jsx_runtime17.jsxs("span", {
                        className: "mp-logout-confirm-text",
                        children: [
                          "Log out ",
                          acc.label,
                          "?"
                        ]
                      }),
                      /* @__PURE__ */ jsx_runtime17.jsx("button", {
                        type: "button",
                        className: "mp-btn-confirm",
                        onClick: () => {
                          setConfirmCredentialId(null);
                          onLogout?.(statusProvider.id, acc.credentialId);
                        },
                        children: "Confirm"
                      }),
                      /* @__PURE__ */ jsx_runtime17.jsx("button", {
                        type: "button",
                        className: "mp-btn-keep",
                        onClick: () => setConfirmCredentialId(null),
                        children: "Keep"
                      })
                    ]
                  }) : /* @__PURE__ */ jsx_runtime17.jsxs("div", {
                    className: "mp-account-info",
                    children: [
                      /* @__PURE__ */ jsx_runtime17.jsx("span", {
                        className: "mp-account-label",
                        children: acc.label
                      }),
                      /* @__PURE__ */ jsx_runtime17.jsx("button", {
                        type: "button",
                        className: "mp-logout-btn",
                        onClick: () => setConfirmCredentialId(acc.credentialId),
                        children: "Log out"
                      })
                    ]
                  })
                }, acc.credentialId))
              }) : null
            ]
          }, provider.id);
        })
      })
    ]
  });
}

// src/components/models/ModelsScreen.tsx
var jsx_runtime18 = __toESM(require_jsx_runtime(), 1);
function ModelsScreen({
  active,
  roles,
  agents,
  providers,
  collapsed: controlledCollapsed,
  onToggleSection
}) {
  const [internalCollapsed, setInternalCollapsed] = import_react15.useState({
    active: false,
    roles: false,
    agents: false,
    providers: false
  });
  const collapsed = controlledCollapsed ?? internalCollapsed;
  const handleToggle = (section) => {
    if (onToggleSection) {
      onToggleSection(section);
    } else {
      setInternalCollapsed((prev) => ({ ...prev, [section]: !prev[section] }));
    }
  };
  return /* @__PURE__ */ jsx_runtime18.jsxs("div", {
    className: "md-screen",
    children: [
      /* @__PURE__ */ jsx_runtime18.jsxs("section", {
        className: "md-section-collapsible",
        children: [
          /* @__PURE__ */ jsx_runtime18.jsxs("button", {
            type: "button",
            className: "md-section-header",
            onClick: () => handleToggle("active"),
            "aria-expanded": !collapsed.active,
            children: [
              /* @__PURE__ */ jsx_runtime18.jsx("span", {
                className: "md-section-title",
                children: "Active"
              }),
              /* @__PURE__ */ jsx_runtime18.jsx("span", {
                className: "md-section-chevron",
                children: collapsed.active ? /* @__PURE__ */ jsx_runtime18.jsx(ChevronRight, {
                  size: 16
                }) : /* @__PURE__ */ jsx_runtime18.jsx(ChevronDown, {
                  size: 16
                })
              })
            ]
          }),
          !collapsed.active && /* @__PURE__ */ jsx_runtime18.jsx("div", {
            className: "md-section-body",
            children: /* @__PURE__ */ jsx_runtime18.jsx(ActiveSection, {
              ...active
            })
          })
        ]
      }),
      /* @__PURE__ */ jsx_runtime18.jsxs("section", {
        className: "md-section-collapsible",
        children: [
          /* @__PURE__ */ jsx_runtime18.jsxs("button", {
            type: "button",
            className: "md-section-header",
            onClick: () => handleToggle("roles"),
            "aria-expanded": !collapsed.roles,
            children: [
              /* @__PURE__ */ jsx_runtime18.jsx("span", {
                className: "md-section-title",
                children: "Roles"
              }),
              /* @__PURE__ */ jsx_runtime18.jsx("span", {
                className: "md-section-chevron",
                children: collapsed.roles ? /* @__PURE__ */ jsx_runtime18.jsx(ChevronRight, {
                  size: 16
                }) : /* @__PURE__ */ jsx_runtime18.jsx(ChevronDown, {
                  size: 16
                })
              })
            ]
          }),
          !collapsed.roles && /* @__PURE__ */ jsx_runtime18.jsx("div", {
            className: "md-section-body",
            children: /* @__PURE__ */ jsx_runtime18.jsx(RolesSection, {
              ...roles
            })
          })
        ]
      }),
      /* @__PURE__ */ jsx_runtime18.jsxs("section", {
        className: "md-section-collapsible",
        children: [
          /* @__PURE__ */ jsx_runtime18.jsxs("button", {
            type: "button",
            className: "md-section-header",
            onClick: () => handleToggle("agents"),
            "aria-expanded": !collapsed.agents,
            children: [
              /* @__PURE__ */ jsx_runtime18.jsx("span", {
                className: "md-section-title",
                children: "Agents"
              }),
              /* @__PURE__ */ jsx_runtime18.jsx("span", {
                className: "md-section-chevron",
                children: collapsed.agents ? /* @__PURE__ */ jsx_runtime18.jsx(ChevronRight, {
                  size: 16
                }) : /* @__PURE__ */ jsx_runtime18.jsx(ChevronDown, {
                  size: 16
                })
              })
            ]
          }),
          !collapsed.agents && /* @__PURE__ */ jsx_runtime18.jsx("div", {
            className: "md-section-body",
            children: /* @__PURE__ */ jsx_runtime18.jsx(AgentsSection, {
              ...agents
            })
          })
        ]
      }),
      /* @__PURE__ */ jsx_runtime18.jsxs("section", {
        className: "md-section-collapsible",
        children: [
          /* @__PURE__ */ jsx_runtime18.jsxs("button", {
            type: "button",
            className: "md-section-header",
            onClick: () => handleToggle("providers"),
            "aria-expanded": !collapsed.providers,
            children: [
              /* @__PURE__ */ jsx_runtime18.jsx("span", {
                className: "md-section-title",
                children: "Providers"
              }),
              /* @__PURE__ */ jsx_runtime18.jsx("span", {
                className: "md-section-chevron",
                children: collapsed.providers ? /* @__PURE__ */ jsx_runtime18.jsx(ChevronRight, {
                  size: 16
                }) : /* @__PURE__ */ jsx_runtime18.jsx(ChevronDown, {
                  size: 16
                })
              })
            ]
          }),
          !collapsed.providers && /* @__PURE__ */ jsx_runtime18.jsx("div", {
            className: "md-section-body",
            children: /* @__PURE__ */ jsx_runtime18.jsx(ProvidersSection, {
              ...providers
            })
          })
        ]
      })
    ]
  });
}

// src/components/models/ModelPickerSheet.tsx
var import_react16 = __toESM(require_react(), 1);

// ../agent/src/thinking.ts
var ThinkingLevel = {
  Inherit: "inherit",
  Off: "off",
  Minimal: "minimal" /* Minimal */,
  Low: "low" /* Low */,
  Medium: "medium" /* Medium */,
  High: "high" /* High */,
  XHigh: "xhigh" /* XHigh */,
  Max: "max" /* Max */
};

// src/components/models/ModelPickerSheet.tsx
var jsx_runtime19 = __toESM(require_jsx_runtime(), 1);
var LEVELS = [
  "auto",
  ThinkingLevel.Off,
  ThinkingLevel.Minimal,
  ThinkingLevel.Low,
  ThinkingLevel.Medium,
  ThinkingLevel.High,
  ThinkingLevel.XHigh,
  ThinkingLevel.Max
];
function filterBrowserModels(browser, options2) {
  if (!browser?.models)
    return [];
  let list = browser.models;
  if (options2.eligible && options2.eligible.length > 0) {
    const eligibleSet = new Set(options2.eligible);
    list = list.filter((m) => eligibleSet.has(m.selector) || eligibleSet.has(`${m.provider}/${m.id}`));
  }
  if (options2.kind && options2.kind !== "all") {
    list = list.filter((m) => m.kind === options2.kind);
  }
  const q = options2.query?.trim().toLowerCase();
  if (q) {
    list = list.filter((m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q) || m.tag && m.tag.toLowerCase().includes(q));
  }
  return list;
}
function groupPickerModels(models, browser) {
  if (!browser) {
    return { recent: [], groups: [] };
  }
  const modelBySelector = new Map;
  const modelByAltKey = new Map;
  for (const m of models) {
    modelBySelector.set(m.selector, m);
    modelByAltKey.set(`${m.provider}/${m.id}`, m);
  }
  const recent = [];
  const recentKeys = new Set;
  if (browser.mruOrder) {
    for (const sel of browser.mruOrder) {
      const m = modelBySelector.get(sel) ?? modelByAltKey.get(sel);
      if (m && !recentKeys.has(m.selector)) {
        recent.push(m);
        recentKeys.add(m.selector);
      }
    }
  }
  const remainingModelsByProvider = new Map;
  for (const m of models) {
    let list = remainingModelsByProvider.get(m.provider);
    if (!list) {
      list = [];
      remainingModelsByProvider.set(m.provider, list);
    }
    list.push(m);
  }
  const groups = [];
  const seenProviders = new Set;
  if (browser.providers) {
    for (const p of browser.providers) {
      const providerModels = remainingModelsByProvider.get(p.id);
      if (providerModels && providerModels.length > 0) {
        groups.push({ provider: p.id, models: providerModels });
        seenProviders.add(p.id);
      }
    }
  }
  for (const [providerId, providerModels] of remainingModelsByProvider.entries()) {
    if (!seenProviders.has(providerId) && providerModels.length > 0) {
      groups.push({ provider: providerId, models: providerModels });
    }
  }
  return { recent, groups };
}
function moveHighlight(index2, delta, count) {
  if (count <= 0)
    return -1;
  if (index2 < 0) {
    return delta >= 0 ? 0 : count - 1;
  }
  return (index2 + delta + count) % count;
}
function formatPerf(perf) {
  if (!perf)
    return null;
  const tps = `${Math.round(perf.tps)} tps`;
  let ttft = "";
  if (perf.ttftMs !== null && perf.ttftMs !== undefined) {
    if (perf.ttftMs >= 1000) {
      const s = (perf.ttftMs / 1000).toFixed(1).replace(/\.0$/, "");
      ttft = `${s}s`;
    } else {
      ttft = `${Math.round(perf.ttftMs)}ms`;
    }
  }
  return { tps, ttft };
}
function ModelPickerSheet({
  open,
  title,
  browser,
  eligible,
  current,
  mode,
  refreshing,
  onPick,
  onClear,
  onRefresh,
  onClose,
  onLogin
}) {
  const [selectedKind, setSelectedKind] = import_react16.useState("all");
  const [search, setSearch] = import_react16.useState("");
  const [selectedModel, setSelectedModel] = import_react16.useState(null);
  const [highlightedIndex, setHighlightedIndex] = import_react16.useState(-1);
  const [thinkingLevel, setThinkingLevel2] = import_react16.useState(undefined);
  const [persist, setPersist] = import_react16.useState(false);
  const [storage, setStorage] = import_react16.useState("project");
  const sheetRef = import_react16.useRef(null);
  const searchInputRef = import_react16.useRef(null);
  const highlightedRowRef = import_react16.useRef(null);
  import_react16.useEffect(() => {
    if (open) {
      setSelectedKind("all");
      setSearch("");
      setSelectedModel(null);
      setHighlightedIndex(-1);
      setThinkingLevel2(current?.thinkingLevel);
      setPersist(false);
      if (mode.kind === "role") {
        setStorage(mode.storage);
      }
    }
  }, [open, current?.thinkingLevel, mode]);
  const filteredModels = import_react16.useMemo(() => filterBrowserModels(browser, { kind: selectedKind, eligible, query: search }), [browser, selectedKind, eligible, search]);
  const { recent, groups } = import_react16.useMemo(() => groupPickerModels(filteredModels, browser), [filteredModels, browser]);
  const renderedRows = import_react16.useMemo(() => {
    const list = [];
    for (const m of recent) {
      list.push({ key: `recent-${m.selector}`, model: m, isRecent: true });
    }
    for (const g of groups) {
      for (const m of g.models) {
        list.push({ key: `${g.provider}-${m.selector}`, model: m, isRecent: false });
      }
    }
    return list;
  }, [recent, groups]);
  const chosen = import_react16.useMemo(() => {
    if (selectedModel)
      return selectedModel;
    if (!current || !browser?.models)
      return null;
    return browser.models.find((m) => m.provider === current.provider && m.id === current.id) ?? null;
  }, [selectedModel, current, browser?.models]);
  import_react16.useEffect(() => {
    if (highlightedRowRef.current) {
      highlightedRowRef.current.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);
  const providerMap = import_react16.useMemo(() => {
    const map = new Map;
    if (browser?.providers) {
      for (const p of browser.providers) {
        map.set(p.id, p);
      }
    }
    return map;
  }, [browser?.providers]);
  const handleConfirm = import_react16.useCallback((modelToPick) => {
    const target = modelToPick ?? chosen;
    if (!target || target.locked)
      return;
    const selection = {
      provider: target.provider,
      id: target.id,
      thinkingLevel,
      persist: mode.kind === "agent" ? true : persist,
      storage: mode.kind === "role" && mode.storage === "project" && persist ? storage : undefined
    };
    onPick(selection);
    onClose();
  }, [chosen, thinkingLevel, mode, persist, storage, onPick, onClose]);
  import_react16.useEffect(() => {
    if (!open)
      return;
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((idx) => moveHighlight(idx, 1, renderedRows.length));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((idx) => moveHighlight(idx, -1, renderedRows.length));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < renderedRows.length) {
          const target = renderedRows[highlightedIndex].model;
          if (!target.locked) {
            handleConfirm(target);
          } else if (onLogin) {
            onLogin(target.provider);
          }
        } else if (chosen && !chosen.locked) {
          handleConfirm(chosen);
        }
        return;
      }
      if (e.key === "Tab" && sheetRef.current) {
        const focusable = Array.from(sheetRef.current.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'));
        if (focusable.length > 0) {
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          const active = browserDocument.activeElement;
          if (e.shiftKey) {
            if (!active || active === first || !sheetRef.current.contains(active)) {
              e.preventDefault();
              last.focus();
            }
          } else {
            if (!active || active === last || !sheetRef.current.contains(active)) {
              e.preventDefault();
              first.focus();
            }
          }
        }
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && browserDocument.activeElement !== searchInputRef.current) {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          setSearch((prev) => prev + e.key);
          e.preventDefault();
        }
      }
    }
    const win = globalThis;
    win.addEventListener("keydown", handleKeyDown);
    return () => win.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, renderedRows, highlightedIndex, chosen, handleConfirm]);
  if (!open)
    return null;
  const isGlobalRefreshing = refreshing !== null;
  const kinds = browser?.kinds ?? [];
  const showKindTabs = kinds.length > 1;
  let clearLabel = null;
  if (mode.kind === "role") {
    clearLabel = "Reset to auto";
  } else if (mode.kind === "agent" && mode.agent.override) {
    clearLabel = "Clear override";
  }
  return /* @__PURE__ */ jsx_runtime19.jsxs(jsx_runtime19.Fragment, {
    children: [
      /* @__PURE__ */ jsx_runtime19.jsx("div", {
        className: "mps-backdrop",
        onClick: onClose
      }),
      /* @__PURE__ */ jsx_runtime19.jsxs("div", {
        className: "mps-sheet",
        role: "dialog",
        "aria-label": title,
        ref: sheetRef,
        children: [
          /* @__PURE__ */ jsx_runtime19.jsxs("div", {
            className: "mps-header",
            children: [
              /* @__PURE__ */ jsx_runtime19.jsx("div", {
                className: "mps-header-left",
                children: /* @__PURE__ */ jsx_runtime19.jsx("span", {
                  className: "mps-title",
                  children: title
                })
              }),
              /* @__PURE__ */ jsx_runtime19.jsxs("div", {
                className: "mps-header-actions",
                children: [
                  /* @__PURE__ */ jsx_runtime19.jsx("button", {
                    type: "button",
                    className: "mps-icon-btn",
                    "aria-label": "Refresh models",
                    disabled: isGlobalRefreshing,
                    onClick: () => onRefresh(),
                    children: /* @__PURE__ */ jsx_runtime19.jsx(RotateCw, {
                      size: 16,
                      className: isGlobalRefreshing ? "mps-icon-spin" : undefined
                    })
                  }),
                  /* @__PURE__ */ jsx_runtime19.jsx("button", {
                    type: "button",
                    className: "mps-icon-btn",
                    "aria-label": "Close",
                    onClick: onClose,
                    children: /* @__PURE__ */ jsx_runtime19.jsx(X, {
                      size: 18
                    })
                  })
                ]
              })
            ]
          }),
          showKindTabs && /* @__PURE__ */ jsx_runtime19.jsxs("div", {
            className: "mps-kinds",
            children: [
              /* @__PURE__ */ jsx_runtime19.jsx("button", {
                type: "button",
                className: "mps-kind-tab" + (selectedKind === "all" ? " mps-kind-tab--active" : ""),
                onClick: () => setSelectedKind("all"),
                children: "all"
              }),
              kinds.map((k) => /* @__PURE__ */ jsx_runtime19.jsx("button", {
                type: "button",
                className: "mps-kind-tab" + (selectedKind === k ? " mps-kind-tab--active" : ""),
                onClick: () => setSelectedKind(k),
                children: k
              }, k))
            ]
          }),
          /* @__PURE__ */ jsx_runtime19.jsx("input", {
            ref: searchInputRef,
            type: "text",
            className: "mps-search",
            placeholder: "Search models...",
            value: search,
            onChange: (e) => setSearch(e.target.value),
            autoFocus: true
          }),
          /* @__PURE__ */ jsx_runtime19.jsxs("div", {
            className: "mps-list",
            children: [
              renderedRows.length === 0 && /* @__PURE__ */ jsx_runtime19.jsx("div", {
                className: "mps-empty",
                children: "No models found"
              }),
              recent.length > 0 && /* @__PURE__ */ jsx_runtime19.jsxs("div", {
                className: "mps-group",
                "data-group": "recent",
                children: [
                  /* @__PURE__ */ jsx_runtime19.jsx("div", {
                    className: "mps-group-header",
                    children: /* @__PURE__ */ jsx_runtime19.jsx("span", {
                      className: "mps-group-label",
                      children: "Recent"
                    })
                  }),
                  recent.map((m) => {
                    const globalIndex = renderedRows.findIndex((r) => r.key === `recent-${m.selector}`);
                    const isHighlighted = globalIndex === highlightedIndex;
                    const isSelected = chosen !== null && chosen.provider === m.provider && chosen.id === m.id;
                    const perfData = formatPerf(m.perf);
                    return /* @__PURE__ */ jsx_runtime19.jsxs("button", {
                      ref: isHighlighted ? highlightedRowRef : undefined,
                      type: "button",
                      disabled: !onLogin && m.locked,
                      className: "mps-row" + (isSelected ? " mps-row--selected" : "") + (isHighlighted ? " mps-row--highlighted" : "") + (m.locked ? " mps-row--dimmed" : ""),
                      onClick: () => {
                        if (m.locked) {
                          onLogin?.(m.provider);
                        } else {
                          setSelectedModel(m);
                        }
                      },
                      children: [
                        /* @__PURE__ */ jsx_runtime19.jsxs("div", {
                          className: "mps-row-main",
                          children: [
                            /* @__PURE__ */ jsx_runtime19.jsxs("div", {
                              className: "mps-row-title-line",
                              children: [
                                /* @__PURE__ */ jsx_runtime19.jsx("span", {
                                  className: "mps-row-name",
                                  children: m.name
                                }),
                                m.tag && /* @__PURE__ */ jsx_runtime19.jsx("span", {
                                  className: "mps-tag",
                                  children: m.tag
                                }),
                                m.locked && /* @__PURE__ */ jsx_runtime19.jsx("span", {
                                  className: "mps-lock-icon",
                                  "aria-label": "locked",
                                  children: /* @__PURE__ */ jsx_runtime19.jsx(Lock, {
                                    size: 12
                                  })
                                })
                              ]
                            }),
                            /* @__PURE__ */ jsx_runtime19.jsx("span", {
                              className: "mps-row-id",
                              children: m.id
                            }),
                            m.roles && m.roles.length > 0 && /* @__PURE__ */ jsx_runtime19.jsx("div", {
                              className: "mps-role-chips",
                              children: m.roles.map((r) => /* @__PURE__ */ jsx_runtime19.jsxs("span", {
                                className: "mps-role-chip" + (r.auto ? " mps-role-chip--auto" : " mps-role-chip--configured"),
                                children: [
                                  /* @__PURE__ */ jsx_runtime19.jsx("span", {
                                    className: "mps-role-chip-dot " + (r.auto ? "mps-role-chip-dot--hollow" : "mps-role-chip-dot--filled")
                                  }),
                                  r.role
                                ]
                              }, r.role))
                            })
                          ]
                        }),
                        perfData && /* @__PURE__ */ jsx_runtime19.jsxs("div", {
                          className: "mps-perf-col",
                          children: [
                            /* @__PURE__ */ jsx_runtime19.jsx("span", {
                              className: "mps-perf-tps",
                              children: perfData.tps
                            }),
                            perfData.ttft && /* @__PURE__ */ jsx_runtime19.jsx("span", {
                              className: "mps-perf-ttft",
                              children: perfData.ttft
                            })
                          ]
                        }),
                        isSelected && /* @__PURE__ */ jsx_runtime19.jsx("span", {
                          className: "mps-check",
                          "aria-label": "selected",
                          children: "✓"
                        })
                      ]
                    }, `recent-${m.selector}`);
                  })
                ]
              }),
              groups.map((g) => {
                const provStatus = providerMap.get(g.provider);
                const isDiscoverable = provStatus?.discoverable === true;
                const isProvRefreshing = refreshing === g.provider || refreshing === "all";
                return /* @__PURE__ */ jsx_runtime19.jsxs("div", {
                  className: "mps-group",
                  "data-provider": g.provider,
                  children: [
                    /* @__PURE__ */ jsx_runtime19.jsxs("div", {
                      className: "mps-group-header",
                      children: [
                        /* @__PURE__ */ jsx_runtime19.jsx("span", {
                          className: "mps-group-label",
                          children: g.provider
                        }),
                        isDiscoverable && /* @__PURE__ */ jsx_runtime19.jsx("button", {
                          type: "button",
                          className: "mps-provider-refresh-btn",
                          "aria-label": `Refresh ${g.provider}`,
                          disabled: isProvRefreshing,
                          onClick: (e) => {
                            e.stopPropagation();
                            onRefresh(g.provider);
                          },
                          children: /* @__PURE__ */ jsx_runtime19.jsx(RotateCw, {
                            size: 12,
                            className: isProvRefreshing ? "mps-icon-spin" : undefined
                          })
                        })
                      ]
                    }),
                    g.models.map((m) => {
                      const globalIndex = renderedRows.findIndex((r) => r.key === `${g.provider}-${m.selector}`);
                      const isHighlighted = globalIndex === highlightedIndex;
                      const isSelected = chosen !== null && chosen.provider === m.provider && chosen.id === m.id;
                      const perfData = formatPerf(m.perf);
                      return /* @__PURE__ */ jsx_runtime19.jsxs("button", {
                        ref: isHighlighted ? highlightedRowRef : undefined,
                        type: "button",
                        disabled: !onLogin && m.locked,
                        className: "mps-row" + (isSelected ? " mps-row--selected" : "") + (isHighlighted ? " mps-row--highlighted" : "") + (m.locked ? " mps-row--dimmed" : ""),
                        onClick: () => {
                          if (m.locked) {
                            onLogin?.(m.provider);
                          } else {
                            setSelectedModel(m);
                          }
                        },
                        children: [
                          /* @__PURE__ */ jsx_runtime19.jsxs("div", {
                            className: "mps-row-main",
                            children: [
                              /* @__PURE__ */ jsx_runtime19.jsxs("div", {
                                className: "mps-row-title-line",
                                children: [
                                  /* @__PURE__ */ jsx_runtime19.jsx("span", {
                                    className: "mps-row-name",
                                    children: m.name
                                  }),
                                  m.tag && /* @__PURE__ */ jsx_runtime19.jsx("span", {
                                    className: "mps-tag",
                                    children: m.tag
                                  }),
                                  m.locked && /* @__PURE__ */ jsx_runtime19.jsx("span", {
                                    className: "mps-lock-icon",
                                    "aria-label": "locked",
                                    children: /* @__PURE__ */ jsx_runtime19.jsx(Lock, {
                                      size: 12
                                    })
                                  })
                                ]
                              }),
                              /* @__PURE__ */ jsx_runtime19.jsx("span", {
                                className: "mps-row-id",
                                children: m.id
                              }),
                              m.roles && m.roles.length > 0 && /* @__PURE__ */ jsx_runtime19.jsx("div", {
                                className: "mps-role-chips",
                                children: m.roles.map((r) => /* @__PURE__ */ jsx_runtime19.jsxs("span", {
                                  className: "mps-role-chip" + (r.auto ? " mps-role-chip--auto" : " mps-role-chip--configured"),
                                  children: [
                                    /* @__PURE__ */ jsx_runtime19.jsx("span", {
                                      className: "mps-role-chip-dot " + (r.auto ? "mps-role-chip-dot--hollow" : "mps-role-chip-dot--filled")
                                    }),
                                    r.role
                                  ]
                                }, r.role))
                              })
                            ]
                          }),
                          perfData && /* @__PURE__ */ jsx_runtime19.jsxs("div", {
                            className: "mps-perf-col",
                            children: [
                              /* @__PURE__ */ jsx_runtime19.jsx("span", {
                                className: "mps-perf-tps",
                                children: perfData.tps
                              }),
                              perfData.ttft && /* @__PURE__ */ jsx_runtime19.jsx("span", {
                                className: "mps-perf-ttft",
                                children: perfData.ttft
                              })
                            ]
                          }),
                          isSelected && /* @__PURE__ */ jsx_runtime19.jsx("span", {
                            className: "mps-check",
                            "aria-label": "selected",
                            children: "✓"
                          })
                        ]
                      }, `${g.provider}-${m.selector}`);
                    })
                  ]
                }, g.provider);
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime19.jsxs("div", {
            className: "mps-thinking",
            children: [
              /* @__PURE__ */ jsx_runtime19.jsx("span", {
                className: "mps-thinking-label",
                children: "Thinking"
              }),
              /* @__PURE__ */ jsx_runtime19.jsx("div", {
                className: "mps-thinking-levels",
                children: LEVELS.map((level) => /* @__PURE__ */ jsx_runtime19.jsx("button", {
                  type: "button",
                  className: "mps-level" + (thinkingLevel === level ? " mps-level--active" : ""),
                  onClick: () => setThinkingLevel2(level),
                  children: level
                }, level))
              })
            ]
          }),
          (mode.kind === "active" || mode.kind === "role") && /* @__PURE__ */ jsx_runtime19.jsxs("div", {
            className: "mps-scope-container",
            children: [
              /* @__PURE__ */ jsx_runtime19.jsxs("div", {
                className: "mps-segmented",
                children: [
                  /* @__PURE__ */ jsx_runtime19.jsx("button", {
                    type: "button",
                    className: "mps-segmented-btn" + (!persist ? " mps-segmented-btn--active" : ""),
                    onClick: () => setPersist(false),
                    children: "This session"
                  }),
                  /* @__PURE__ */ jsx_runtime19.jsx("button", {
                    type: "button",
                    className: "mps-segmented-btn" + (persist ? " mps-segmented-btn--active" : ""),
                    onClick: () => setPersist(true),
                    children: "Persist"
                  })
                ]
              }),
              mode.kind === "role" && mode.storage === "project" && persist && /* @__PURE__ */ jsx_runtime19.jsxs("div", {
                className: "mps-segmented mps-storage-segmented",
                children: [
                  /* @__PURE__ */ jsx_runtime19.jsx("button", {
                    type: "button",
                    className: "mps-segmented-btn" + (storage === "project" ? " mps-segmented-btn--active" : ""),
                    onClick: () => setStorage("project"),
                    children: "Project"
                  }),
                  /* @__PURE__ */ jsx_runtime19.jsx("button", {
                    type: "button",
                    className: "mps-segmented-btn" + (storage === "global" ? " mps-segmented-btn--active" : ""),
                    onClick: () => setStorage("global"),
                    children: "Global"
                  })
                ]
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime19.jsxs("div", {
            className: "mps-actions",
            children: [
              clearLabel && onClear && /* @__PURE__ */ jsx_runtime19.jsx("button", {
                type: "button",
                className: "mps-btn mps-btn--clear",
                onClick: () => {
                  onClear();
                  onClose();
                },
                children: clearLabel
              }),
              /* @__PURE__ */ jsx_runtime19.jsx("button", {
                type: "button",
                className: "mps-btn mps-btn--confirm",
                disabled: !chosen || chosen.locked,
                onClick: () => handleConfirm(null),
                children: "Confirm"
              })
            ]
          })
        ]
      })
    ]
  });
}

// src/components/models/LoginSheet.tsx
var import_react17 = __toESM(require_react(), 1);
var jsx_runtime20 = __toESM(require_jsx_runtime(), 1);
function LoginSheet({
  open,
  providerName,
  url,
  instructions,
  progress = [],
  pending,
  result,
  onSubmitInput,
  onCancel,
  onClose
}) {
  const sheetRef = import_react17.useRef(null);
  const [inputValue, setInputValue] = import_react17.useState("");
  const [copied, setCopied] = import_react17.useState(false);
  import_react17.useEffect(() => {
    setInputValue("");
  }, [pending?.requestId]);
  const handleCopy = import_react17.useCallback(() => {
    if (!url)
      return;
    browserWindow.navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, [url]);
  const handleSubmit = import_react17.useCallback(() => {
    if (!pending)
      return;
    if (pending.kind === "manual_input") {
      const trimmed = inputValue.trim();
      if (trimmed) {
        onSubmitInput(trimmed);
        setInputValue("");
      }
    } else if (pending.kind === "prompt") {
      if (pending.allowEmpty || inputValue.trim()) {
        onSubmitInput(inputValue);
        setInputValue("");
      }
    }
  }, [pending, inputValue, onSubmitInput]);
  const handleInputKeyDown = import_react17.useCallback((e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);
  import_react17.useEffect(() => {
    if (!open)
      return;
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (result) {
          onClose();
        } else {
          onCancel();
        }
        return;
      }
      if (e.key === "Tab" && sheetRef.current) {
        const focusable = Array.from(sheetRef.current.querySelectorAll('button:not([disabled]), input:not([disabled]), a:not([disabled]), [tabindex]:not([tabindex="-1"])'));
        if (focusable.length > 0) {
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          const active = browserDocument.activeElement;
          if (e.shiftKey) {
            if (!active || active === first || !sheetRef.current.contains(active)) {
              e.preventDefault();
              last.focus();
            }
          } else {
            if (!active || active === last || !sheetRef.current.contains(active)) {
              e.preventDefault();
              first.focus();
            }
          }
        }
      }
    }
    const win = globalThis;
    win.addEventListener("keydown", handleKeyDown);
    return () => win.removeEventListener("keydown", handleKeyDown);
  }, [open, result, onCancel, onClose]);
  if (!open)
    return null;
  const handleHeaderClose = () => {
    if (result) {
      onClose();
    } else {
      onCancel();
    }
  };
  const canSubmitPrompt = pending?.kind === "prompt" && (Boolean(pending.allowEmpty) || Boolean(inputValue.trim()));
  const canSubmitManual = pending?.kind === "manual_input" && Boolean(inputValue.trim());
  return /* @__PURE__ */ jsx_runtime20.jsxs(jsx_runtime20.Fragment, {
    children: [
      /* @__PURE__ */ jsx_runtime20.jsx("div", {
        className: "login-backdrop",
        onClick: handleHeaderClose
      }),
      /* @__PURE__ */ jsx_runtime20.jsxs("div", {
        className: "login-sheet",
        role: "dialog",
        "aria-label": `Log in to ${providerName}`,
        ref: sheetRef,
        children: [
          /* @__PURE__ */ jsx_runtime20.jsxs("div", {
            className: "login-header",
            children: [
              /* @__PURE__ */ jsx_runtime20.jsxs("span", {
                className: "login-title",
                children: [
                  "Log in to ",
                  providerName
                ]
              }),
              /* @__PURE__ */ jsx_runtime20.jsx("button", {
                type: "button",
                className: "login-close",
                "aria-label": "Close",
                onClick: handleHeaderClose,
                children: /* @__PURE__ */ jsx_runtime20.jsx(X, {
                  size: 18
                })
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime20.jsxs("div", {
            className: "login-body",
            children: [
              url ? /* @__PURE__ */ jsx_runtime20.jsxs("div", {
                className: "login-actions-row",
                children: [
                  /* @__PURE__ */ jsx_runtime20.jsx("a", {
                    href: url,
                    target: "_blank",
                    rel: "noopener noreferrer",
                    className: "login-btn-primary",
                    children: "Open sign-in page"
                  }),
                  /* @__PURE__ */ jsx_runtime20.jsx("button", {
                    type: "button",
                    className: "login-btn-secondary",
                    onClick: handleCopy,
                    children: copied ? "Copied!" : "Copy link"
                  })
                ]
              }) : null,
              instructions ? /* @__PURE__ */ jsx_runtime20.jsx("div", {
                className: "login-instructions",
                children: instructions
              }) : null,
              progress.length > 0 ? /* @__PURE__ */ jsx_runtime20.jsx("div", {
                className: "login-progress-list",
                children: progress.map((msg, index2) => /* @__PURE__ */ jsx_runtime20.jsxs("div", {
                  className: "login-progress-item",
                  children: [
                    /* @__PURE__ */ jsx_runtime20.jsx("span", {
                      className: "login-progress-dot",
                      "aria-hidden": "true"
                    }),
                    /* @__PURE__ */ jsx_runtime20.jsx("span", {
                      children: msg
                    })
                  ]
                }, index2))
              }) : null,
              pending?.kind === "manual_input" && !result ? /* @__PURE__ */ jsx_runtime20.jsxs("div", {
                className: "login-field",
                children: [
                  /* @__PURE__ */ jsx_runtime20.jsx("label", {
                    className: "login-field-label",
                    htmlFor: "login-manual-input",
                    children: "Paste the address of the page you landed on"
                  }),
                  /* @__PURE__ */ jsx_runtime20.jsx("div", {
                    className: "login-field-helper",
                    children: "After you sign in, the browser opens a page that cannot load. Copy its address and paste it here."
                  }),
                  /* @__PURE__ */ jsx_runtime20.jsx("input", {
                    id: "login-manual-input",
                    type: "text",
                    className: "login-input",
                    value: inputValue,
                    onChange: (e) => setInputValue(e.target.value),
                    onKeyDown: handleInputKeyDown,
                    autoFocus: true
                  }),
                  /* @__PURE__ */ jsx_runtime20.jsx("div", {
                    className: "login-footer",
                    children: /* @__PURE__ */ jsx_runtime20.jsx("button", {
                      type: "button",
                      className: "login-btn-primary",
                      disabled: !canSubmitManual,
                      onClick: handleSubmit,
                      children: "Submit"
                    })
                  })
                ]
              }) : null,
              pending?.kind === "prompt" && !result ? /* @__PURE__ */ jsx_runtime20.jsxs("div", {
                className: "login-field",
                children: [
                  /* @__PURE__ */ jsx_runtime20.jsx("label", {
                    className: "login-field-label",
                    htmlFor: "login-prompt-input",
                    children: pending.message
                  }),
                  /* @__PURE__ */ jsx_runtime20.jsx("input", {
                    id: "login-prompt-input",
                    type: pending.secret ? "password" : "text",
                    placeholder: pending.placeholder,
                    className: "login-input",
                    value: inputValue,
                    onChange: (e) => setInputValue(e.target.value),
                    onKeyDown: handleInputKeyDown,
                    autoFocus: true
                  }),
                  /* @__PURE__ */ jsx_runtime20.jsx("div", {
                    className: "login-footer",
                    children: /* @__PURE__ */ jsx_runtime20.jsx("button", {
                      type: "button",
                      className: "login-btn-primary",
                      disabled: !canSubmitPrompt,
                      onClick: handleSubmit,
                      children: "Submit"
                    })
                  })
                ]
              }) : null,
              result?.kind === "done" ? /* @__PURE__ */ jsx_runtime20.jsx("div", {
                className: "login-status-done",
                children: result.identity ? `Connected as ${result.identity}` : "Logged in successfully"
              }) : null,
              result?.kind === "failed" ? /* @__PURE__ */ jsx_runtime20.jsx("div", {
                className: "login-status-failed",
                children: result.cancelled ? "Login cancelled" : result.error
              }) : null,
              /* @__PURE__ */ jsx_runtime20.jsx("div", {
                className: "login-footer",
                children: !result ? /* @__PURE__ */ jsx_runtime20.jsx("button", {
                  type: "button",
                  className: "login-btn-cancel",
                  onClick: onCancel,
                  children: "Cancel"
                }) : result.kind === "done" ? /* @__PURE__ */ jsx_runtime20.jsx("button", {
                  type: "button",
                  className: "login-btn-primary",
                  onClick: onClose,
                  children: "Done"
                }) : /* @__PURE__ */ jsx_runtime20.jsx("button", {
                  type: "button",
                  className: "login-btn-secondary",
                  onClick: onClose,
                  children: "Close"
                })
              })
            ]
          })
        ]
      })
    ]
  });
}

// src/components/models/useModelsHub.tsx
var jsx_runtime21 = __toESM(require_jsx_runtime(), 1);
function useModelsHub({ sink, snap, store, routeKey }) {
  const [pickerOpen, setPickerOpen] = import_react18.useState(false);
  const [pickerMode, setPickerMode] = import_react18.useState({ kind: "active" });
  const [pickerTitle, setPickerTitle] = import_react18.useState("Model");
  const [pickerEligible, setPickerEligible] = import_react18.useState(undefined);
  const [pickerCurrent, setPickerCurrent] = import_react18.useState(undefined);
  const [loginOpen, setLoginOpen] = import_react18.useState(false);
  const [refreshing, setRefreshing] = import_react18.useState(null);
  const [collapsed, setCollapsed] = import_react18.useState({
    active: false,
    roles: false,
    agents: false,
    providers: false
  });
  const toggleSection = import_react18.useCallback((section) => {
    setCollapsed((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);
  const close = import_react18.useCallback(() => {
    setPickerOpen(false);
  }, []);
  import_react18.useEffect(() => {
    setPickerOpen(false);
    setLoginOpen(false);
  }, [routeKey]);
  import_react18.useEffect(() => {
    if (!pickerOpen || !store)
      return;
    store.ensureModelData();
    store.ensureLoginStatus();
  }, [pickerOpen, store]);
  const openActivePicker = import_react18.useCallback(() => {
    const ss = snap.sessionState;
    const m = ss?.model;
    setPickerMode({ kind: "active" });
    setPickerTitle("Model");
    setPickerEligible(undefined);
    setPickerCurrent(m ? { provider: m.provider, id: m.id, thinkingLevel: ss?.thinkingLevel } : undefined);
    setPickerOpen(true);
  }, [snap.sessionState]);
  const openRolePicker = import_react18.useCallback((roleId) => {
    const role = snap.roles?.roles.find((r) => r.id === roleId);
    if (!role)
      return;
    const storage = snap.roles?.storage ?? "global";
    setPickerMode({ kind: "role", role, storage });
    setPickerTitle(`Role: ${role.name}`);
    setPickerEligible(role.eligible.length > 0 ? role.eligible : undefined);
    setPickerCurrent(role.resolved ? {
      provider: role.resolved.provider,
      id: role.resolved.id,
      thinkingLevel: role.resolved.thinkingLevel
    } : undefined);
    setPickerOpen(true);
  }, [snap.roles]);
  const openAgentPicker = import_react18.useCallback((agentName) => {
    const agent = snap.agents?.agents.find((a) => a.name === agentName);
    if (!agent)
      return;
    setPickerMode({ kind: "agent", agent });
    setPickerTitle(`Agent: ${agent.name}`);
    setPickerEligible(undefined);
    setPickerCurrent(agent.resolved ? {
      provider: agent.resolved.provider,
      id: agent.resolved.id,
      thinkingLevel: agent.resolved.thinkingLevel
    } : undefined);
    setPickerOpen(true);
  }, [snap.agents]);
  const handleCreateRole = import_react18.useCallback((roleId) => {
    const storage = snap.roles?.storage ?? "global";
    const syntheticRole = {
      id: roleId,
      name: roleId,
      section: "chat",
      source: "unset",
      provenance: "default",
      custom: true,
      eligible: []
    };
    setPickerMode({ kind: "role", role: syntheticRole, storage });
    setPickerTitle(`Role: ${roleId}`);
    setPickerEligible(undefined);
    setPickerCurrent(undefined);
    setPickerOpen(true);
  }, [snap.roles?.storage]);
  const handledLoginIdRef = import_react18.useRef(null);
  import_react18.useEffect(() => {
    const login = snap.login;
    if (!login || !login.result)
      return;
    if (handledLoginIdRef.current === login.loginId)
      return;
    handledLoginIdRef.current = login.loginId;
    if (login.result.kind === "done") {
      const provider = snap.loginStatus?.providers.find((p) => p.id === login.providerId);
      const providerName = provider?.name ?? login.providerId;
      const identityText = login.result.identity ? ` as ${login.result.identity}` : "";
      notify("info", `Logged in to ${providerName}${identityText}`);
      store?.refreshLoginStatus();
    } else if (login.result.kind === "failed" && !login.result.cancelled) {
      notify("error", login.result.error);
    }
  }, [snap.login, snap.loginStatus?.providers, store]);
  const openLogin = import_react18.useCallback((providerId) => {
    if (!sink)
      return;
    loginStart(sink, providerId).then((resp) => {
      store?.beginLogin({ loginId: resp.data.loginId, providerId });
      setLoginOpen(true);
    }).catch((err) => {
      notify("error", `Failed to start login: ${err instanceof Error ? err.message : String(err)}`);
    });
  }, [sink, store]);
  const submitLoginInput = import_react18.useCallback((value) => {
    if (!sink || !snap.login?.pending)
      return;
    loginInput(sink, snap.login.loginId, snap.login.pending.requestId, value).catch((err) => {
      notify("error", `Failed to submit input: ${err instanceof Error ? err.message : String(err)}`);
    });
  }, [sink, snap.login]);
  const cancelLogin = import_react18.useCallback(() => {
    if (sink && snap.login) {
      loginCancel(sink, snap.login.loginId).catch(() => {});
    }
    setLoginOpen(false);
    store?.clearLogin();
  }, [sink, snap.login, store]);
  const closeLogin = import_react18.useCallback(() => {
    setLoginOpen(false);
    store?.clearLogin();
  }, [store]);
  const handleLogout = import_react18.useCallback((providerId, credentialId) => {
    if (!sink)
      return;
    logout(sink, providerId, credentialId).then(() => {
      store?.refreshLoginStatus();
      store?.refreshModelConfig();
      const provider = snap.loginStatus?.providers.find((p) => p.id === providerId);
      const providerName = provider?.name ?? providerId;
      notify("info", `Logged out from ${providerName}`);
    }).catch((err) => {
      notify("error", `Failed to log out: ${err instanceof Error ? err.message : String(err)}`);
    });
  }, [sink, store, snap.loginStatus?.providers]);
  const handlePick = import_react18.useCallback((selection) => {
    if (!sink)
      return;
    const browserModel = snap.browser?.models.find((m) => m.provider === selection.provider && m.id === selection.id);
    if (browserModel?.locked) {
      const isOAuthProvider = snap.loginStatus?.providers.some((p) => p.id === selection.provider || p.storeCredentialsAs === selection.provider);
      if (isOAuthProvider) {
        openLogin(selection.provider);
      } else {
        notify("error", `No API key for ${selection.provider}`);
      }
      return;
    }
    const selector = toSelector(selection.provider, selection.id, selection.thinkingLevel);
    if (pickerMode.kind === "active") {
      const rolesStorage = snap.roles?.storage;
      if (selection.persist && rolesStorage === "project") {
        setModelRole(sink, "default", selector, { storage: "project" }).then((resp) => {
          store?.refreshModelConfig();
          if (resp.data?.warning) {
            notify("info", resp.data.warning);
          }
          setPickerOpen(false);
        }).catch((err) => {
          notify("error", `Failed to set default role: ${err instanceof Error ? err.message : String(err)}`);
        });
      } else {
        setModel(sink, selection.provider, selection.id, {
          persist: selection.persist,
          thinkingLevel: selection.thinkingLevel
        }).then(() => {
          setPickerOpen(false);
        }).catch((err) => {
          notify("error", `Failed to set model: ${err instanceof Error ? err.message : String(err)}`);
        });
      }
    } else if (pickerMode.kind === "role") {
      setModelRole(sink, pickerMode.role.id, selector, {
        persist: selection.persist,
        storage: selection.storage
      }).then((resp) => {
        store?.refreshModelConfig();
        if (resp.data?.warning) {
          notify("info", resp.data.warning);
        }
        setPickerOpen(false);
      }).catch((err) => {
        notify("error", `Failed to set role: ${err instanceof Error ? err.message : String(err)}`);
      });
    } else if (pickerMode.kind === "agent") {
      setAgentModel(sink, pickerMode.agent.name, selector).then((resp) => {
        store?.applyAgent(resp.data);
        setPickerOpen(false);
      }).catch((err) => {
        notify("error", `Failed to set agent model: ${err instanceof Error ? err.message : String(err)}`);
      });
    }
  }, [sink, snap.browser?.models, snap.loginStatus?.providers, snap.roles?.storage, pickerMode, store, openLogin]);
  const handleClear = import_react18.useCallback(() => {
    if (!sink)
      return;
    if (pickerMode.kind === "role") {
      setModelRole(sink, pickerMode.role.id, null).then(() => {
        store?.refreshModelConfig();
        setPickerOpen(false);
      }).catch((err) => {
        notify("error", `Failed to clear role: ${err instanceof Error ? err.message : String(err)}`);
      });
    } else if (pickerMode.kind === "agent") {
      setAgentModel(sink, pickerMode.agent.name, null).then((resp) => {
        store?.applyAgent(resp.data);
        setPickerOpen(false);
      }).catch((err) => {
        notify("error", `Failed to clear agent override: ${err instanceof Error ? err.message : String(err)}`);
      });
    }
  }, [sink, pickerMode, store]);
  const handleRefresh = import_react18.useCallback((provider) => {
    if (!sink)
      return;
    setRefreshing(provider ?? "all");
    refreshModels(sink, provider).then((resp) => {
      store?.applyBrowser(resp.data);
    }).catch((err) => {
      notify("error", `Failed to refresh models: ${err instanceof Error ? err.message : String(err)}`);
    }).finally(() => {
      setRefreshing(null);
    });
  }, [sink, store]);
  const handleCycle = import_react18.useCallback((direction) => {
    if (!sink)
      return;
    cycleRoleModel(sink, direction).then(() => {}).catch((err) => {
      notify("error", `Failed to cycle role: ${err instanceof Error ? err.message : String(err)}`);
    });
  }, [sink]);
  const handleClearRole = import_react18.useCallback((roleId, storage) => {
    if (!sink)
      return;
    setModelRole(sink, roleId, null, { storage }).then(() => {
      store?.refreshModelConfig();
    }).catch((err) => {
      notify("error", `Failed to clear role: ${err instanceof Error ? err.message : String(err)}`);
    });
  }, [sink, store]);
  const handleDeleteRole = import_react18.useCallback((roleId) => {
    if (!sink)
      return;
    deleteModelRole(sink, roleId).then((resp) => {
      store?.applyRoles(resp.data);
    }).catch((err) => {
      notify("error", `Failed to delete role: ${err instanceof Error ? err.message : String(err)}`);
    });
  }, [sink, store]);
  const handleSetCycleOrder = import_react18.useCallback((order) => {
    if (!sink)
      return;
    setCycleOrder(sink, order).then((resp) => {
      store?.applyRoles(resp.data);
    }).catch((err) => {
      notify("error", `Failed to update cycle order: ${err instanceof Error ? err.message : String(err)}`);
    });
  }, [sink, store]);
  const handleSetTag = import_react18.useCallback((model, tag) => {
    if (!sink)
      return;
    setModelTag(sink, model, tag).then((resp) => {
      store?.applyRoles(resp.data);
    }).catch((err) => {
      notify("error", `Failed to set model tag: ${err instanceof Error ? err.message : String(err)}`);
    });
  }, [sink, store]);
  const handleSetEnabled = import_react18.useCallback((agentName, enabled) => {
    if (!sink)
      return;
    setAgentEnabled(sink, agentName, enabled).then((resp) => {
      store?.applyAgent(resp.data);
    }).catch((err) => {
      notify("error", `Failed to set agent enabled state: ${err instanceof Error ? err.message : String(err)}`);
    });
  }, [sink, store]);
  const handleSetServiceTier = import_react18.useCallback((agentName, tier) => {
    if (!sink)
      return;
    setAgentServiceTier(sink, agentName, tier).then((resp) => {
      store?.applyAgent(resp.data);
    }).catch((err) => {
      notify("error", `Failed to set agent service tier: ${err instanceof Error ? err.message : String(err)}`);
    });
  }, [sink, store]);
  const handleSetPrewalk = import_react18.useCallback((agentName, value) => {
    if (!sink)
      return;
    setAgentPrewalk(sink, agentName, value).then((resp) => {
      store?.applyAgent(resp.data);
    }).catch((err) => {
      notify("error", `Failed to set agent prewalk: ${err instanceof Error ? err.message : String(err)}`);
    });
  }, [sink, store]);
  const handleSetAdvisor = import_react18.useCallback((agentName, value) => {
    if (!sink)
      return;
    setAgentAdvisor(sink, agentName, value).then((resp) => {
      store?.applyAgent(resp.data);
    }).catch((err) => {
      notify("error", `Failed to set agent advisor: ${err instanceof Error ? err.message : String(err)}`);
    });
  }, [sink, store]);
  const activeProps = {
    state: snap.sessionState,
    roles: snap.roles,
    streaming: snap.streaming,
    onPick: openActivePicker,
    onCycle: handleCycle
  };
  const rolesProps = {
    roles: snap.roles,
    onPickRole: openRolePicker,
    onClearRole: handleClearRole,
    onCreateRole: handleCreateRole,
    onDeleteRole: handleDeleteRole,
    onSetCycleOrder: handleSetCycleOrder,
    onSetTag: handleSetTag
  };
  const agentsProps = {
    agents: snap.agents,
    onPickAgent: openAgentPicker,
    onSetEnabled: handleSetEnabled,
    onSetServiceTier: handleSetServiceTier,
    onSetPrewalk: handleSetPrewalk,
    onSetAdvisor: handleSetAdvisor
  };
  const providersProps = {
    browser: snap.browser,
    loginStatus: snap.loginStatus,
    refreshing,
    onRefresh: handleRefresh,
    onLogin: openLogin,
    onLogout: handleLogout
  };
  const screen = /* @__PURE__ */ jsx_runtime21.jsxs(jsx_runtime21.Fragment, {
    children: [
      /* @__PURE__ */ jsx_runtime21.jsx(ModelDataLoader, {
        store
      }),
      /* @__PURE__ */ jsx_runtime21.jsx(ModelsScreen, {
        snap,
        active: activeProps,
        roles: rolesProps,
        agents: agentsProps,
        providers: providersProps,
        collapsed,
        onToggleSection: toggleSection
      })
    ]
  });
  const sheetProps = {
    open: pickerOpen,
    title: pickerTitle,
    browser: snap.browser,
    eligible: pickerEligible,
    current: pickerCurrent,
    mode: pickerMode,
    refreshing,
    onPick: handlePick,
    onClear: pickerMode.kind !== "active" ? handleClear : undefined,
    onRefresh: handleRefresh,
    onClose: close,
    onLogin: openLogin
  };
  const sheet = /* @__PURE__ */ jsx_runtime21.jsx(ModelPickerSheet, {
    ...sheetProps
  });
  const loginProvider = snap.loginStatus?.providers.find((p) => p.id === snap.login?.providerId || p.storeCredentialsAs === snap.login?.providerId);
  const loginProviderName = loginProvider?.name ?? snap.login?.providerId ?? "";
  const loginSheet = /* @__PURE__ */ jsx_runtime21.jsx(LoginSheet, {
    open: loginOpen && snap.login !== null,
    providerName: loginProviderName,
    url: snap.login?.url,
    instructions: snap.login?.instructions,
    progress: snap.login?.progress,
    pending: snap.login?.pending,
    result: snap.login?.result,
    onSubmitInput: submitLoginInput,
    onCancel: cancelLogin,
    onClose: closeLogin
  });
  return {
    screen,
    sheet,
    loginSheet,
    openActivePicker,
    cycleRoleModel: handleCycle,
    close
  };
}
function ModelDataLoader({ store }) {
  import_react18.useEffect(() => {
    if (!store)
      return;
    store.ensureModelData();
    store.ensureAgents();
    store.ensureLoginStatus();
  }, [store]);
  return null;
}

// src/components/agents/PinnedSubagents.tsx
var jsx_runtime22 = __toESM(require_jsx_runtime(), 1);
function PinnedSubagents(props) {
  const { rows, onFocusAgent, onDismiss, onDismissAll, onOpenHub, onBack, leading } = props;
  const finishedIds = rows.filter((row) => row.status !== "running").map((row) => row.id);
  return /* @__PURE__ */ jsx_runtime22.jsxs("section", {
    className: onBack ? "pa-panel pa-panel--page" : "pa-panel",
    "aria-label": "Subagents",
    children: [
      /* @__PURE__ */ jsx_runtime22.jsxs("header", {
        className: onBack ? "pa-head sh-panel-header" : "pa-head",
        children: [
          onBack && /* @__PURE__ */ jsx_runtime22.jsx("button", {
            type: "button",
            className: "tb-back",
            onClick: onBack,
            "aria-label": "Back",
            children: "←"
          }),
          leading,
          /* @__PURE__ */ jsx_runtime22.jsx("h3", {
            className: "pa-title",
            children: "Subagents"
          }),
          onDismissAll && finishedIds.length > 0 && /* @__PURE__ */ jsx_runtime22.jsx("button", {
            type: "button",
            className: "pa-clear-btn",
            onClick: () => onDismissAll(finishedIds),
            title: "Dismiss every finished agent",
            children: "Clear all"
          }),
          /* @__PURE__ */ jsx_runtime22.jsx("button", {
            type: "button",
            className: "pa-hub-btn",
            onClick: onOpenHub,
            children: "Open Agent Hub"
          })
        ]
      }),
      rows.length === 0 ? /* @__PURE__ */ jsx_runtime22.jsx("div", {
        className: "pa-empty",
        children: "No subagents."
      }) : /* @__PURE__ */ jsx_runtime22.jsx("ul", {
        className: "pa-list",
        children: rows.map((row) => {
          const m = row.metrics;
          return /* @__PURE__ */ jsx_runtime22.jsxs("li", {
            className: row.status === "running" ? "pa-card" : "pa-card pa-card--dismissible",
            "data-status": row.status,
            children: [
              /* @__PURE__ */ jsx_runtime22.jsxs("button", {
                type: "button",
                className: "pa-row",
                "data-agent-id": row.id,
                onClick: () => onFocusAgent(row.id),
                title: `Focus ${row.label}`,
                children: [
                  /* @__PURE__ */ jsx_runtime22.jsxs("span", {
                    className: "pa-line",
                    children: [
                      /* @__PURE__ */ jsx_runtime22.jsx("span", {
                        className: `pa-dot pa-dot--${row.status}`,
                        title: row.status
                      }),
                      /* @__PURE__ */ jsx_runtime22.jsx("span", {
                        className: "pa-id",
                        children: row.label
                      }),
                      /* @__PURE__ */ jsx_runtime22.jsxs("span", {
                        className: "pa-kind",
                        children: [
                          row.role && /* @__PURE__ */ jsx_runtime22.jsx("span", {
                            className: "pa-role",
                            children: row.role
                          }),
                          row.role && row.model && /* @__PURE__ */ jsx_runtime22.jsx("span", {
                            className: "pa-sep",
                            children: " · "
                          }),
                          row.model && /* @__PURE__ */ jsx_runtime22.jsx("span", {
                            className: "pa-model",
                            children: row.model
                          }),
                          row.level && /* @__PURE__ */ jsx_runtime22.jsxs("span", {
                            className: "pa-level",
                            children: [
                              " ",
                              row.level
                            ]
                          })
                        ]
                      })
                    ]
                  }),
                  row.task && /* @__PURE__ */ jsx_runtime22.jsx("span", {
                    className: "pa-task",
                    children: row.task
                  }),
                  /* @__PURE__ */ jsx_runtime22.jsxs("span", {
                    className: "pa-metrics",
                    children: [
                      m && /* @__PURE__ */ jsx_runtime22.jsxs(jsx_runtime22.Fragment, {
                        children: [
                          /* @__PURE__ */ jsx_runtime22.jsx("span", {
                            children: fmtCost(m.cost)
                          }),
                          m.durationMs > 0 && /* @__PURE__ */ jsx_runtime22.jsx("span", {
                            children: fmtDuration(m.durationMs)
                          }),
                          /* @__PURE__ */ jsx_runtime22.jsxs("span", {
                            children: [
                              m.requests,
                              " req"
                            ]
                          }),
                          /* @__PURE__ */ jsx_runtime22.jsxs("span", {
                            children: [
                              m.tools,
                              " tools"
                            ]
                          }),
                          /* @__PURE__ */ jsx_runtime22.jsxs("span", {
                            children: [
                              fmtTokens(m.tokens),
                              " tok"
                            ]
                          })
                        ]
                      }),
                      /* @__PURE__ */ jsx_runtime22.jsx("span", {
                        children: relTime(row.lastActivity)
                      })
                    ]
                  })
                ]
              }),
              row.status !== "running" && /* @__PURE__ */ jsx_runtime22.jsx("button", {
                type: "button",
                className: "pa-dismiss",
                "aria-label": `Dismiss ${row.label}`,
                onClick: () => onDismiss(row.id),
                children: /* @__PURE__ */ jsx_runtime22.jsx(X, {
                  size: 14,
                  "aria-hidden": "true"
                })
              })
            ]
          }, row.id);
        })
      })
    ]
  });
}

// src/lib/pinned-subagents-model.ts
function shortModel(identity, resolved) {
  const model = identity ?? resolved;
  if (!model)
    return;
  return model.slice(model.lastIndexOf("/") + 1);
}
function oneLine(text) {
  const trimmed = text?.trim();
  return trimmed ? trimmed.replace(/\s*[\r\n]+\s*/g, " ") : undefined;
}
function progressMetrics(p) {
  return {
    tokens: p.tokens,
    requests: p.requests,
    tools: p.toolCount,
    cost: p.cost,
    durationMs: p.durationMs,
    contextTokens: p.contextTokens,
    contextWindow: p.contextWindow
  };
}
function fromRoster(entry) {
  const p = entry.progress;
  return {
    id: entry.id,
    label: agentIdLabel(entry.id),
    status: entry.status,
    role: entry.agent ?? p?.agent ?? entry.displayName,
    model: shortModel(p?.resolvedModelIdentity, p?.resolvedModel ?? entry.resolvedModel),
    level: p?.resolvedThinkingLevel,
    task: oneLine(p?.task ?? entry.task),
    metrics: entryMetrics(entry),
    lastActivity: entry.lastActivity
  };
}
function pinnedRows(hub, subagents, dismissed = new Set) {
  const shown = (id, status) => status === "running" || !dismissed.has(id);
  if (hub.loaded) {
    return [...hub.agents.values()].filter((e) => e.kind === "sub" && shown(e.id, e.status)).sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id)).map(fromRoster);
  }
  return [...subagents.agents.values()].filter((n) => n.snapshot.kind === "sub" && shown(n.snapshot.id, n.snapshot.status)).sort((a, b) => b.snapshot.createdAt - a.snapshot.createdAt || a.snapshot.id.localeCompare(b.snapshot.id)).map((n) => {
    const p = n.progress?.progress;
    return {
      id: n.snapshot.id,
      label: agentIdLabel(n.snapshot.id),
      status: n.snapshot.status,
      role: n.progress?.agent ?? p?.agent,
      model: shortModel(p?.resolvedModelIdentity, p?.resolvedModel),
      level: p?.resolvedThinkingLevel,
      task: oneLine(p?.task),
      metrics: p ? progressMetrics(p) : undefined,
      lastActivity: n.snapshot.lastActivity
    };
  });
}

// src/lib/pinned-dismissed.ts
var STORAGE_KEY = "webgui.pinnedDismissed";
var MAX_SESSIONS2 = 50;
function load() {
  try {
    const raw = browserWindow.localStorage.getItem(STORAGE_KEY);
    if (!raw)
      return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
      return {};
    const out = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (Array.isArray(v))
        out[k] = v.filter((id) => typeof id === "string");
    }
    return out;
  } catch {
    return {};
  }
}
function loadDismissed(sessionKey) {
  return new Set(load()[sessionKey] ?? []);
}
function saveDismissed(sessionKey, ids) {
  const map = load();
  delete map[sessionKey];
  map[sessionKey] = [...ids];
  const keys = Object.keys(map);
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_SESSIONS2)))
    delete map[key];
  try {
    browserWindow.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

// src/components/todos/TodoPanel.tsx
var import_react19 = __toESM(require_react(), 1);
var jsx_runtime23 = __toESM(require_jsx_runtime(), 1);
var STATUS_ICONS = {
  completed: "✓",
  in_progress: "→",
  abandoned: "✕",
  pending: "○",
  blocked: "⊘"
};
var STATUS_LABELS = {
  completed: "Done",
  in_progress: "In Progress",
  abandoned: "Dropped",
  pending: "Pending",
  blocked: "Blocked"
};
function TodoPanel({ phases, onUpdateTodos, readOnly = false }) {
  const [submitting, setSubmitting] = import_react19.useState(false);
  const progress = countTodoProgress(phases);
  async function handleCycle(phaseIndex, taskIndex) {
    if (readOnly || !onUpdateTodos || submitting)
      return;
    const phase = phases[phaseIndex];
    const task = phase?.tasks[taskIndex];
    if (!task)
      return;
    const nextStatus = cycleTaskStatus(task.status);
    setSubmitting(true);
    try {
      const updated = updateTaskStatus(phases, phaseIndex, taskIndex, nextStatus);
      await onUpdateTodos(updated);
    } finally {
      setSubmitting(false);
    }
  }
  async function handleSetStatus(phaseIndex, taskIndex, status, e) {
    e.stopPropagation();
    if (readOnly || !onUpdateTodos || submitting)
      return;
    setSubmitting(true);
    try {
      const updated = updateTaskStatus(phases, phaseIndex, taskIndex, status);
      await onUpdateTodos(updated);
    } finally {
      setSubmitting(false);
    }
  }
  if (phases.length === 0 || progress.total === 0) {
    return /* @__PURE__ */ jsx_runtime23.jsx("div", {
      className: "td-panel",
      children: /* @__PURE__ */ jsx_runtime23.jsxs("div", {
        className: "td-empty",
        children: [
          /* @__PURE__ */ jsx_runtime23.jsx("div", {
            className: "td-empty-title",
            children: "No todos"
          }),
          /* @__PURE__ */ jsx_runtime23.jsx("div", {
            className: "td-empty-desc",
            children: "Tasks and phases created by the agent or /todo commands will appear here."
          })
        ]
      })
    });
  }
  return /* @__PURE__ */ jsx_runtime23.jsxs("div", {
    className: readOnly ? "td-panel td-panel--readonly" : "td-panel",
    children: [
      /* @__PURE__ */ jsx_runtime23.jsxs("div", {
        className: "td-summary",
        children: [
          /* @__PURE__ */ jsx_runtime23.jsxs("div", {
            className: "td-summary-row",
            children: [
              /* @__PURE__ */ jsx_runtime23.jsxs("span", {
                className: "td-summary-counts",
                children: [
                  progress.closed,
                  " of ",
                  progress.total,
                  " tasks closed"
                ]
              }),
              /* @__PURE__ */ jsx_runtime23.jsxs("span", {
                className: "td-summary-percent",
                children: [
                  progress.percent,
                  "%"
                ]
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime23.jsx("div", {
            className: "td-progress-track",
            children: /* @__PURE__ */ jsx_runtime23.jsx("div", {
              className: "td-progress-fill",
              style: { width: `${progress.percent}%` }
            })
          })
        ]
      }),
      /* @__PURE__ */ jsx_runtime23.jsx("div", {
        className: "td-content",
        children: phases.map((phase, pIdx) => {
          const phaseClosed = phase.tasks.filter((t) => t.status === "completed" || t.status === "abandoned").length;
          const roman = formatRoman(pIdx + 1);
          return /* @__PURE__ */ jsx_runtime23.jsxs("div", {
            className: "td-phase",
            children: [
              /* @__PURE__ */ jsx_runtime23.jsxs("div", {
                className: "td-phase-header",
                children: [
                  /* @__PURE__ */ jsx_runtime23.jsxs("span", {
                    children: [
                      roman ? `${roman}. ` : "",
                      phase.name
                    ]
                  }),
                  /* @__PURE__ */ jsx_runtime23.jsxs("span", {
                    className: "td-phase-count",
                    children: [
                      phaseClosed,
                      "/",
                      phase.tasks.length
                    ]
                  })
                ]
              }),
              /* @__PURE__ */ jsx_runtime23.jsx("div", {
                className: "td-task-list",
                children: phase.tasks.map((task, tIdx) => {
                  const status = task.status;
                  return /* @__PURE__ */ jsx_runtime23.jsxs("div", {
                    className: `td-task-row td-task-row--${status}`,
                    onClick: readOnly ? undefined : () => handleCycle(pIdx, tIdx),
                    role: readOnly ? undefined : "button",
                    tabIndex: readOnly ? undefined : 0,
                    onKeyDown: readOnly ? undefined : (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleCycle(pIdx, tIdx);
                      }
                    },
                    "aria-label": readOnly ? `${task.content}: ${STATUS_LABELS[status]}` : `${task.content}: ${STATUS_LABELS[status]}. Tap to cycle status.`,
                    children: [
                      /* @__PURE__ */ jsx_runtime23.jsx("button", {
                        type: "button",
                        className: `td-status-btn td-status-btn--${status}`,
                        onClick: (e) => {
                          e.stopPropagation();
                          handleCycle(pIdx, tIdx);
                        },
                        title: readOnly ? `Status: ${STATUS_LABELS[status]}` : `Status: ${STATUS_LABELS[status]}. Tap to cycle.`,
                        "aria-label": readOnly ? STATUS_LABELS[status] : `Cycle status from ${STATUS_LABELS[status]}`,
                        disabled: submitting || readOnly,
                        children: STATUS_ICONS[status]
                      }),
                      /* @__PURE__ */ jsx_runtime23.jsxs("div", {
                        className: "td-task-body",
                        children: [
                          /* @__PURE__ */ jsx_runtime23.jsxs("div", {
                            className: "td-task-main",
                            children: [
                              /* @__PURE__ */ jsx_runtime23.jsx("span", {
                                className: "td-task-content",
                                children: task.content
                              }),
                              /* @__PURE__ */ jsx_runtime23.jsx("button", {
                                type: "button",
                                className: `td-task-badge td-task-badge--${status}`,
                                onClick: (e) => {
                                  handleSetStatus(pIdx, tIdx, cycleTaskStatus(status), e);
                                },
                                title: readOnly ? undefined : "Tap to change status",
                                disabled: submitting || readOnly,
                                children: STATUS_LABELS[status]
                              })
                            ]
                          }),
                          status === "blocked" && task.blocker && /* @__PURE__ */ jsx_runtime23.jsxs("div", {
                            className: "td-task-blocker",
                            children: [
                              /* @__PURE__ */ jsx_runtime23.jsx("span", {
                                children: "Blocked:"
                              }),
                              " ",
                              task.blocker
                            ]
                          }),
                          task.details && /* @__PURE__ */ jsx_runtime23.jsxs("div", {
                            className: "td-task-blocker",
                            children: [
                              /* @__PURE__ */ jsx_runtime23.jsx("span", {
                                children: "Note:"
                              }),
                              " ",
                              task.details
                            ]
                          }),
                          task.notes && task.notes.length > 0 && /* @__PURE__ */ jsx_runtime23.jsx("ul", {
                            className: "td-task-notes",
                            children: task.notes.map((note, nIdx) => /* @__PURE__ */ jsx_runtime23.jsx("li", {
                              children: note
                            }, `note-${nIdx}`))
                          })
                        ]
                      })
                    ]
                  }, `task-${pIdx}-${tIdx}-${task.content}`);
                })
              })
            ]
          }, phase.name || `phase-${pIdx}`);
        })
      })
    ]
  });
}

// src/components/sessions/SessionsScreen.tsx
var import_react22 = __toESM(require_react(), 1);

// src/lib/session-groups.ts
function displayName(entry) {
  if (entry.name)
    return entry.name;
  if (entry.firstUserMessage) {
    const msg = entry.firstUserMessage;
    if (msg.length <= 60)
      return msg;
    return msg.slice(0, 57) + "...";
  }
  return entry.id.length > 8 ? entry.id.slice(-8) : entry.id;
}
function shortCwd(cwd) {
  let display = cwd;
  if (display.startsWith("/Users/")) {
    const parts = display.split("/");
    if (parts.length >= 3) {
      display = "~/" + parts.slice(3).join("/");
    }
  } else if (display.startsWith("/home/")) {
    const parts = display.split("/");
    if (parts.length >= 3) {
      display = "~/" + parts.slice(3).join("/");
    }
  }
  const segments = display.split("/").filter(Boolean);
  if (segments.length <= 2)
    return display;
  return segments.slice(-2).join("/");
}
function dayLabel(ts, now2) {
  const d = new Date(ts);
  const n = new Date(now2);
  const dYear = d.getFullYear();
  const dMonth = d.getMonth();
  const dDay = d.getDate();
  const nYear = n.getFullYear();
  const nMonth = n.getMonth();
  const nDay = n.getDate();
  if (dYear === nYear && dMonth === nMonth && dDay === nDay)
    return "Today";
  const yesterday = new Date(nYear, nMonth, nDay - 1);
  if (dYear === yesterday.getFullYear() && dMonth === yesterday.getMonth() && dDay === yesterday.getDate()) {
    return "Yesterday";
  }
  const mm = String(dMonth + 1).padStart(2, "0");
  const dd = String(dDay).padStart(2, "0");
  return `${dYear}-${mm}-${dd}`;
}
function groupPast(entries2, now2) {
  const effectiveNow = now2 ?? Date.now();
  const sorted = [...entries2].sort((a, b) => b.modifiedAt - a.modifiedAt);
  const dayMap = new Map;
  const dayOrder = [];
  for (const s of sorted) {
    const label = dayLabel(s.modifiedAt, effectiveNow);
    let bucket = dayMap.get(label);
    if (!bucket) {
      bucket = [];
      dayMap.set(label, bucket);
      dayOrder.push(label);
    }
    bucket.push(s);
  }
  const result = [];
  for (const dl of dayOrder) {
    const sessions = dayMap.get(dl);
    const cwdMap = new Map;
    const cwdOrder = [];
    for (const s of sessions) {
      const key = s.cwd || "";
      let bucket = cwdMap.get(key);
      if (!bucket) {
        bucket = [];
        cwdMap.set(key, bucket);
        cwdOrder.push(key);
      }
      bucket.push(s);
    }
    const projects = cwdOrder.map((cwd) => ({
      label: cwd ? shortCwd(cwd) : "Unknown",
      cwd: cwd || null,
      sessions: cwdMap.get(cwd)
    }));
    result.push({ dayLabel: dl, projects });
  }
  return result;
}

// src/lib/unread.ts
var STORAGE_KEY2 = "webgui.seen";
function load2() {
  try {
    const raw = browserWindow.localStorage.getItem(STORAGE_KEY2);
    if (!raw)
      return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
      return {};
    const out = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "number" && Number.isFinite(v))
        out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}
function save(map) {
  try {
    browserWindow.localStorage.setItem(STORAGE_KEY2, JSON.stringify(map));
  } catch {}
}
function markSeen(sessionId, assistantCount) {
  if (sessionId === null)
    return;
  if (assistantCount === null)
    return;
  const map = load2();
  if (map[sessionId] === assistantCount)
    return;
  map[sessionId] = assistantCount;
  save(map);
}
function computeUnread(live, currentInstanceId) {
  const map = load2();
  const next = {};
  const result = new Map;
  for (const entry of live) {
    const count = entry.assistantCount;
    const sessionId = entry.sessionId;
    if (sessionId === null)
      continue;
    const stored = map[sessionId];
    if (count === null) {
      if (stored !== undefined)
        next[sessionId] = stored;
      result.set(sessionId, 0);
      continue;
    }
    const seen = entry.instanceId === currentInstanceId || stored === undefined ? count : stored;
    next[sessionId] = seen;
    result.set(sessionId, Math.max(0, count - seen));
  }
  const before = Object.keys(map);
  const changed = before.length !== Object.keys(next).length || before.some((k) => map[k] !== next[k]);
  if (changed)
    save(next);
  return result;
}
function sortByActivity(live) {
  return [...live].sort((a, b) => b.lastActivityAt - a.lastActivityAt);
}

// src/components/sessions/SessionRow.tsx
var import_react20 = __toESM(require_react(), 1);
var jsx_runtime24 = __toESM(require_jsx_runtime(), 1);
function relativeTime2(ts) {
  const delta = Date.now() - ts;
  const secs = Math.floor(delta / 1000);
  if (secs < 60)
    return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60)
    return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)
    return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
var SHUTDOWN_TIMEOUT_MS = 4000;
function liveSessionName(entry) {
  return entry.sessionName ?? entry.cwd.split("/").filter(Boolean).pop() ?? entry.instanceId;
}
function LiveSessionRow(props) {
  const { entry, current, onAttach, onShutdown, unread = 0 } = props;
  const [armed, setArmed] = import_react20.useState(false);
  const timerRef = import_react20.useRef(null);
  import_react20.useEffect(() => {
    if (!armed)
      return;
    timerRef.current = setTimeout(() => setArmed(false), SHUTDOWN_TIMEOUT_MS);
    return () => {
      clearTimeout(timerRef.current ?? undefined);
    };
  }, [armed]);
  import_react20.useEffect(() => {
    return () => {
      clearTimeout(timerRef.current ?? undefined);
    };
  }, []);
  const handleShutdown = import_react20.useCallback(() => {
    if (!armed) {
      setArmed(true);
      return;
    }
    clearTimeout(timerRef.current ?? undefined);
    timerRef.current = null;
    setArmed(false);
    onShutdown(entry.instanceId);
  }, [armed, entry.instanceId, onShutdown]);
  const name = liveSessionName(entry);
  return /* @__PURE__ */ jsx_runtime24.jsxs("div", {
    className: `ses-row ses-row--live${current ? " ses-row--current" : ""}`,
    children: [
      /* @__PURE__ */ jsx_runtime24.jsxs("button", {
        type: "button",
        className: "ses-row-main",
        onClick: () => onAttach(entry.instanceId),
        children: [
          /* @__PURE__ */ jsx_runtime24.jsxs("span", {
            className: "ses-row-name",
            children: [
              /* @__PURE__ */ jsx_runtime24.jsx("span", {
                className: "ses-busy-dot",
                title: "running"
              }),
              name,
              entry.origin === "gui" && /* @__PURE__ */ jsx_runtime24.jsx("span", {
                className: "ses-badge ses-badge--gui",
                children: "GUI"
              })
            ]
          }),
          entry.recap ? /* @__PURE__ */ jsx_runtime24.jsxs("span", {
            className: "ses-recap",
            children: [
              /* @__PURE__ */ jsx_runtime24.jsx("span", {
                className: "ses-recap-text",
                children: entry.recap.text
              }),
              /* @__PURE__ */ jsx_runtime24.jsxs("span", {
                className: "ses-recap-age",
                children: [
                  "recap ",
                  relativeTime2(entry.recap.createdAt)
                ]
              })
            ]
          }) : null,
          /* @__PURE__ */ jsx_runtime24.jsxs("span", {
            className: "ses-row-meta",
            children: [
              /* @__PURE__ */ jsx_runtime24.jsx("span", {
                className: "ses-row-cwd",
                children: shortCwd(entry.cwd)
              }),
              entry.model ? /* @__PURE__ */ jsx_runtime24.jsx("span", {
                children: entry.model
              }) : null,
              /* @__PURE__ */ jsx_runtime24.jsxs("span", {
                children: [
                  "active ",
                  relativeTime2(entry.lastActivityAt)
                ]
              })
            ]
          })
        ]
      }),
      unread > 0 && /* @__PURE__ */ jsx_runtime24.jsx("span", {
        className: "ses-unread",
        role: "status",
        "aria-label": `${unread} unread`,
        children: unread > 99 ? "99+" : unread
      }),
      /* @__PURE__ */ jsx_runtime24.jsx("button", {
        type: "button",
        className: `ses-menu-btn${armed ? " ses-menu-btn--armed" : ""}`,
        onClick: handleShutdown,
        "aria-label": armed ? "Confirm shut down" : "Shut down",
        children: armed ? "Confirm?" : "Stop"
      })
    ]
  });
}
function PastSessionRow(props) {
  const { entry, pending, onResume, onDelete } = props;
  const [armed, setArmed] = import_react20.useState(false);
  const timerRef = import_react20.useRef(null);
  import_react20.useEffect(() => {
    if (armed) {
      timerRef.current = setTimeout(() => setArmed(false), 4000);
    }
    return () => {
      clearTimeout(timerRef.current ?? undefined);
    };
  }, [armed]);
  const handleDelete = import_react20.useCallback((e) => {
    e.stopPropagation();
    if (!armed) {
      setArmed(true);
      return;
    }
    clearTimeout(timerRef.current ?? undefined);
    timerRef.current = null;
    setArmed(false);
    onDelete?.(entry.id);
  }, [armed, entry.id, onDelete]);
  return /* @__PURE__ */ jsx_runtime24.jsxs("div", {
    className: `ses-row ses-row--past${pending ? " ses-row--pending" : ""}`,
    children: [
      /* @__PURE__ */ jsx_runtime24.jsxs("button", {
        type: "button",
        className: "ses-row-main",
        onClick: () => onResume(entry.id),
        children: [
          /* @__PURE__ */ jsx_runtime24.jsx("span", {
            className: "ses-row-name",
            children: displayName(entry)
          }),
          /* @__PURE__ */ jsx_runtime24.jsxs("span", {
            className: "ses-row-meta",
            children: [
              /* @__PURE__ */ jsx_runtime24.jsx("span", {
                className: "ses-row-cwd",
                children: shortCwd(entry.cwd)
              }),
              /* @__PURE__ */ jsx_runtime24.jsx("span", {
                children: relativeTime2(entry.modifiedAt)
              })
            ]
          })
        ]
      }),
      pending && /* @__PURE__ */ jsx_runtime24.jsx("span", {
        className: "ses-row-pending-text",
        children: "Resuming..."
      }),
      onDelete && !pending && /* @__PURE__ */ jsx_runtime24.jsx("button", {
        type: "button",
        className: `ses-menu-btn${armed ? " ses-menu-btn--armed" : ""}`,
        onClick: handleDelete,
        "aria-label": armed ? "Confirm delete session" : "Delete session",
        children: armed ? "Confirm?" : "Delete"
      })
    ]
  });
}

// src/components/sessions/NewSession.tsx
var import_react21 = __toESM(require_react(), 1);
var jsx_runtime25 = __toESM(require_jsx_runtime(), 1);
function NewSession(props) {
  const { api, recentCwds, onAttach } = props;
  const [cwd, setCwd] = import_react21.useState("");
  const [pending, setPending] = import_react21.useState(false);
  const [error, setError] = import_react21.useState(null);
  const abortRef = import_react21.useRef(null);
  import_react21.useEffect(() => {
    if (cwd === "" && recentCwds.length > 0) {
      setCwd(recentCwds[0]);
    }
  }, [recentCwds]);
  import_react21.useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);
  const handleStart = import_react21.useCallback(async () => {
    const trimmed = cwd.trim();
    if (!trimmed || pending)
      return;
    const ac = new AbortController;
    abortRef.current?.abort();
    abortRef.current = ac;
    setPending(true);
    setError(null);
    try {
      const result = await api.launch(trimmed, ac.signal);
      if (ac.signal.aborted)
        return;
      if (result.instanceId) {
        setPending(false);
        onAttach(result.instanceId);
        return;
      }
      const startTime2 = Date.now();
      while (Date.now() - startTime2 < 20000) {
        if (ac.signal.aborted)
          return;
        await new Promise((resolve, reject) => {
          const id = setTimeout(resolve, 2000);
          ac.signal.addEventListener("abort", () => {
            clearTimeout(id);
            reject(new DOMException("Aborted", "AbortError"));
          }, { once: true });
        });
        if (ac.signal.aborted)
          return;
        const sessions = await api.listLive(ac.signal);
        const match = sessions.find((s) => s.cwd === trimmed && s.startedAt > startTime2);
        if (match) {
          setPending(false);
          onAttach(match.instanceId);
          return;
        }
      }
      setPending(false);
      setError("Session did not appear within 20 seconds");
    } catch (err) {
      if (ac.signal.aborted)
        return;
      setPending(false);
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      notify("error", message);
    }
  }, [api, cwd, pending, onAttach]);
  const datalistId = "ses-recent-cwds";
  return /* @__PURE__ */ jsx_runtime25.jsxs("div", {
    className: "ses-new-form",
    children: [
      /* @__PURE__ */ jsx_runtime25.jsx("h4", {
        className: "ses-new-form-title",
        children: "New session"
      }),
      /* @__PURE__ */ jsx_runtime25.jsx("input", {
        type: "text",
        className: "ses-cwd-input",
        value: cwd,
        placeholder: "Working directory",
        list: datalistId,
        onChange: (e) => {
          const target = e.target;
          if (target && typeof target === "object" && "value" in target) {
            setCwd(target.value);
          }
        },
        disabled: pending
      }),
      /* @__PURE__ */ jsx_runtime25.jsx("datalist", {
        id: datalistId,
        children: recentCwds.map((c) => /* @__PURE__ */ jsx_runtime25.jsx("option", {
          value: c
        }, c))
      }),
      /* @__PURE__ */ jsx_runtime25.jsx("button", {
        type: "button",
        className: "ses-start-btn",
        onClick: handleStart,
        disabled: pending || !cwd.trim(),
        children: pending ? "Starting..." : "Start"
      }),
      error != null && /* @__PURE__ */ jsx_runtime25.jsx("p", {
        className: "ses-new-error",
        children: error
      }),
      pending && /* @__PURE__ */ jsx_runtime25.jsx("p", {
        className: "ses-new-pending",
        children: "Waiting for session to appear..."
      })
    ]
  });
}

// src/components/sessions/SessionsScreen.tsx
var jsx_runtime26 = __toESM(require_jsx_runtime(), 1);
function SessionsScreen(props) {
  const { api, variant, currentInstanceId, currentSessionName, onAttach, collapseToggle } = props;
  const [polledLive, setLive] = import_react22.useState([]);
  const live = import_react22.useMemo(() => sortByActivity(currentSessionName ? polledLive.map((s) => s.instanceId === currentInstanceId && s.sessionName !== currentSessionName ? { ...s, sessionName: currentSessionName } : s) : polledLive), [polledLive, currentInstanceId, currentSessionName]);
  const [seenVersion, setSeenVersion] = import_react22.useState(0);
  const unread = import_react22.useMemo(() => computeUnread(live, currentInstanceId), [live, currentInstanceId, seenVersion]);
  const handleAttachLive = import_react22.useCallback((instanceId) => {
    const opened = live.find((s) => s.instanceId === instanceId);
    if (opened)
      markSeen(opened.sessionId, opened.assistantCount);
    setSeenVersion((v) => v + 1);
    onAttach(instanceId);
  }, [live, onAttach]);
  const [past, setPast] = import_react22.useState(null);
  const [pastOpen, setPastOpen] = import_react22.useState(false);
  const [pastError, setPastError] = import_react22.useState(null);
  const pastInflightRef = import_react22.useRef(false);
  const [loading, setLoading] = import_react22.useState(true);
  const [error, setError] = import_react22.useState(null);
  const [showNew, setShowNew] = import_react22.useState(false);
  const [resumingId, setResumingId] = import_react22.useState(null);
  const [collapsedProjects, setCollapsedProjects] = import_react22.useState(new Set);
  const abortRef = import_react22.useRef(null);
  const pollRef = import_react22.useRef(null);
  const fetchPast = import_react22.useCallback(async (signal) => {
    if (pastInflightRef.current)
      return;
    pastInflightRef.current = true;
    try {
      const p = await api.listPast({ all: true, signal });
      if (signal.aborted)
        return;
      setPast(p);
      setPastError(null);
    } catch (err) {
      if (signal.aborted)
        return;
      setPastError(err instanceof Error ? err.message : String(err));
    } finally {
      pastInflightRef.current = false;
    }
  }, [api]);
  const ensurePast = import_react22.useCallback(() => {
    const ac = abortRef.current;
    if (past !== null || !ac || ac.signal.aborted)
      return;
    fetchPast(ac.signal);
  }, [past, fetchPast]);
  const refreshPastIfLoaded = import_react22.useCallback(() => {
    const ac = abortRef.current;
    if (past === null || !ac || ac.signal.aborted)
      return;
    fetchPast(ac.signal);
  }, [past, fetchPast]);
  const loadLive = import_react22.useCallback(async (signal) => {
    try {
      const l = await api.listLive(signal);
      if (!signal.aborted) {
        setLive(l);
        setError(null);
      }
    } catch (err) {
      if (signal.aborted)
        return;
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      if (!signal.aborted)
        setLoading(false);
    }
  }, [api]);
  import_react22.useEffect(() => {
    const ac = new AbortController;
    abortRef.current = ac;
    loadLive(ac.signal);
    const onVisChange = () => {
      const doc = globalThis["document"];
      if (doc?.visibilityState === "visible") {
        loadLive(ac.signal);
      }
    };
    browserWindow.addEventListener("visibilitychange", onVisChange);
    return () => {
      ac.abort();
      browserWindow.removeEventListener("visibilitychange", onVisChange);
    };
  }, [loadLive]);
  import_react22.useEffect(() => {
    const ac = new AbortController;
    pollRef.current = setInterval(() => {
      const doc = globalThis["document"];
      if (doc && doc.visibilityState !== "visible")
        return;
      loadLive(ac.signal);
    }, 1e4);
    return () => {
      ac.abort();
      if (pollRef.current != null) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [loadLive]);
  const seenNameRef = import_react22.useRef(currentSessionName);
  import_react22.useEffect(() => {
    if (seenNameRef.current === currentSessionName)
      return;
    seenNameRef.current = currentSessionName;
    if (currentSessionName)
      refreshPastIfLoaded();
  }, [currentSessionName, refreshPastIfLoaded]);
  const handleShutdown = import_react22.useCallback(async (instanceId) => {
    try {
      await api.shutdown(instanceId);
      const ac = abortRef.current;
      if (ac && !ac.signal.aborted) {
        await loadLive(ac.signal);
        refreshPastIfLoaded();
      }
    } catch (err) {
      notify("error", err instanceof Error ? err.message : String(err));
    }
  }, [api, loadLive, refreshPastIfLoaded]);
  const handleResume = import_react22.useCallback(async (id) => {
    setResumingId(id);
    const ac = new AbortController;
    try {
      const result = await api.resume(id, ac.signal);
      if (ac.signal.aborted)
        return;
      if (result.instanceId) {
        setResumingId(null);
        onAttach(result.instanceId);
        return;
      }
      const entry = past?.find((s) => s.id === id);
      const cwdMatch = entry?.cwd;
      const startTime2 = Date.now();
      while (Date.now() - startTime2 < 20000) {
        if (ac.signal.aborted)
          return;
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, 2000);
          ac.signal.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(new DOMException("Aborted", "AbortError"));
          }, { once: true });
        });
        if (ac.signal.aborted)
          return;
        const sessions = await api.listLive(ac.signal);
        const match = sessions.find((s) => cwdMatch != null && s.cwd === cwdMatch && s.startedAt > startTime2);
        if (match) {
          setResumingId(null);
          onAttach(match.instanceId);
          return;
        }
      }
      setResumingId(null);
      notify("error", "Resumed session did not appear within 20 seconds");
    } catch (err) {
      if (ac.signal.aborted)
        return;
      setResumingId(null);
      notify("error", err instanceof Error ? err.message : String(err));
    }
  }, [api, past, onAttach]);
  const handleDeletePast = import_react22.useCallback(async (id) => {
    try {
      await api.deletePast(id);
      setPast((prev) => prev?.filter((p) => p.id !== id) ?? null);
      notify("info", "Session deleted");
    } catch (err) {
      notify("error", err instanceof Error ? err.message : String(err));
    }
  }, [api]);
  const dayGroups = import_react22.useMemo(() => groupPast(past ?? []), [past]);
  const recentCwds = import_react22.useMemo(() => {
    const seen = new Set;
    const result = [];
    for (const s of live) {
      if (!seen.has(s.cwd)) {
        seen.add(s.cwd);
        result.push(s.cwd);
      }
    }
    for (const s of past ?? []) {
      if (!seen.has(s.cwd)) {
        seen.add(s.cwd);
        result.push(s.cwd);
      }
    }
    return result;
  }, [live, past]);
  const toggleProject = import_react22.useCallback((key) => {
    setCollapsedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(key))
        next.delete(key);
      else
        next.add(key);
      return next;
    });
  }, []);
  const containerClass = variant === "page" ? "ses-page" : "ses-sidebar";
  const resumeToggle = /* @__PURE__ */ jsx_runtime26.jsx("button", {
    type: "button",
    className: `ses-new-btn ses-resume-btn${pastOpen ? " ses-new-btn--active" : ""}`,
    onClick: () => {
      if (!pastOpen)
        ensurePast();
      setPastOpen(!pastOpen);
    },
    "aria-label": pastOpen ? "Close past sessions" : "Resume session",
    title: pastOpen ? "Close past sessions" : "Resume session",
    children: pastOpen ? /* @__PURE__ */ jsx_runtime26.jsx(X, {
      size: 20,
      strokeWidth: 2.5,
      "aria-hidden": "true"
    }) : /* @__PURE__ */ jsx_runtime26.jsx(RotateCcwClock, {
      size: 20,
      strokeWidth: 2.5,
      "aria-hidden": "true"
    })
  });
  return /* @__PURE__ */ jsx_runtime26.jsxs("div", {
    className: containerClass,
    children: [
      variant === "sidebar" && /* @__PURE__ */ jsx_runtime26.jsx("nav", {
        className: "ses-rail",
        "aria-label": "Live sessions",
        children: live.map((entry) => {
          const name = liveSessionName(entry);
          const current = entry.instanceId === currentInstanceId;
          const unreadCount = entry.sessionId && unread.get(entry.sessionId) || 0;
          return /* @__PURE__ */ jsx_runtime26.jsxs("button", {
            type: "button",
            className: `ses-rail-item${current ? " ses-rail-item--current" : ""}`,
            onClick: () => handleAttachLive(entry.instanceId),
            title: name,
            "aria-label": name,
            "aria-current": current ? "page" : undefined,
            children: [
              name.trim().charAt(0).toUpperCase() || "?",
              /* @__PURE__ */ jsx_runtime26.jsx("span", {
                className: "ses-rail-dot",
                "aria-hidden": "true"
              }),
              unreadCount > 0 && /* @__PURE__ */ jsx_runtime26.jsx("span", {
                className: "ses-rail-unread",
                "aria-hidden": "true"
              })
            ]
          }, entry.instanceId);
        })
      }),
      (variant === "page" || collapseToggle) && /* @__PURE__ */ jsx_runtime26.jsxs("div", {
        className: variant === "page" ? "ses-page-header" : "ses-page-header ses-sidebar-head",
        children: [
          variant === "page" ? /* @__PURE__ */ jsx_runtime26.jsx("h2", {
            className: "ses-page-title",
            children: "Sessions"
          }) : /* @__PURE__ */ jsx_runtime26.jsx("span", {
            className: "ses-sidebar-title",
            children: "ompgui"
          }),
          /* @__PURE__ */ jsx_runtime26.jsxs("div", {
            className: "ses-header-actions",
            children: [
              resumeToggle,
              /* @__PURE__ */ jsx_runtime26.jsx("button", {
                type: "button",
                className: `ses-new-btn${showNew ? " ses-new-btn--active" : ""}`,
                onClick: () => {
                  if (!showNew)
                    ensurePast();
                  setShowNew(!showNew);
                },
                "aria-label": showNew ? "Close new session" : "New session",
                children: /* @__PURE__ */ jsx_runtime26.jsx("svg", {
                  width: "20",
                  height: "20",
                  viewBox: "0 0 24 24",
                  fill: "none",
                  stroke: "currentColor",
                  strokeWidth: "2.5",
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                  "aria-hidden": "true",
                  children: showNew ? /* @__PURE__ */ jsx_runtime26.jsxs(jsx_runtime26.Fragment, {
                    children: [
                      /* @__PURE__ */ jsx_runtime26.jsx("line", {
                        x1: "18",
                        y1: "6",
                        x2: "6",
                        y2: "18"
                      }),
                      /* @__PURE__ */ jsx_runtime26.jsx("line", {
                        x1: "6",
                        y1: "6",
                        x2: "18",
                        y2: "18"
                      })
                    ]
                  }) : /* @__PURE__ */ jsx_runtime26.jsxs(jsx_runtime26.Fragment, {
                    children: [
                      /* @__PURE__ */ jsx_runtime26.jsx("line", {
                        x1: "12",
                        y1: "5",
                        x2: "12",
                        y2: "19"
                      }),
                      /* @__PURE__ */ jsx_runtime26.jsx("line", {
                        x1: "5",
                        y1: "12",
                        x2: "19",
                        y2: "12"
                      })
                    ]
                  })
                })
              }),
              collapseToggle
            ]
          })
        ]
      }),
      showNew && /* @__PURE__ */ jsx_runtime26.jsx(NewSession, {
        api,
        recentCwds,
        onAttach
      }),
      loading && /* @__PURE__ */ jsx_runtime26.jsxs("p", {
        className: "ses-loading",
        children: [
          /* @__PURE__ */ jsx_runtime26.jsx("span", {
            className: "ses-spin",
            "aria-hidden": "true"
          }),
          "Loading sessions…"
        ]
      }),
      !loading && error && /* @__PURE__ */ jsx_runtime26.jsxs("div", {
        className: "ses-unreachable",
        children: [
          /* @__PURE__ */ jsx_runtime26.jsx("p", {
            className: "ses-unreachable-title",
            children: "Server unreachable"
          }),
          /* @__PURE__ */ jsx_runtime26.jsx("p", {
            className: "ses-unreachable-reason",
            children: error
          }),
          /* @__PURE__ */ jsx_runtime26.jsx("button", {
            type: "button",
            className: "ses-retry-btn",
            onClick: () => {
              setLoading(true);
              if (abortRef.current)
                abortRef.current.abort();
              const ac = new AbortController;
              abortRef.current = ac;
              loadLive(ac.signal);
            },
            children: "Retry"
          })
        ]
      }),
      !loading && !error && /* @__PURE__ */ jsx_runtime26.jsxs(jsx_runtime26.Fragment, {
        children: [
          /* @__PURE__ */ jsx_runtime26.jsxs("div", {
            className: "ses-section-label ses-section-label--live",
            children: [
              /* @__PURE__ */ jsx_runtime26.jsx("span", {
                className: "ses-busy-dot"
              }),
              "Live",
              live.length > 0 ? ` · ${live.length}` : ""
            ]
          }),
          live.length === 0 && /* @__PURE__ */ jsx_runtime26.jsx("p", {
            className: "ses-empty",
            children: "No live sessions"
          }),
          /* @__PURE__ */ jsx_runtime26.jsx("div", {
            className: "ses-live-grid",
            children: live.map((entry) => /* @__PURE__ */ jsx_runtime26.jsx(LiveSessionRow, {
              entry,
              current: entry.instanceId === currentInstanceId,
              unread: entry.sessionId && unread.get(entry.sessionId) || 0,
              onAttach: handleAttachLive,
              onShutdown: handleShutdown
            }, entry.instanceId))
          }),
          pastOpen && /* @__PURE__ */ jsx_runtime26.jsxs(jsx_runtime26.Fragment, {
            children: [
              /* @__PURE__ */ jsx_runtime26.jsx("div", {
                className: "ses-section-label",
                children: "Past"
              }),
              past === null && !pastError && /* @__PURE__ */ jsx_runtime26.jsxs("p", {
                className: "ses-loading",
                children: [
                  /* @__PURE__ */ jsx_runtime26.jsx("span", {
                    className: "ses-spin",
                    "aria-hidden": "true"
                  }),
                  "Loading past sessions…"
                ]
              }),
              past === null && pastError && /* @__PURE__ */ jsx_runtime26.jsxs("div", {
                className: "ses-unreachable",
                children: [
                  /* @__PURE__ */ jsx_runtime26.jsx("p", {
                    className: "ses-unreachable-reason",
                    children: pastError
                  }),
                  /* @__PURE__ */ jsx_runtime26.jsx("button", {
                    type: "button",
                    className: "ses-retry-btn",
                    onClick: ensurePast,
                    children: "Retry"
                  })
                ]
              }),
              past !== null && dayGroups.length === 0 && /* @__PURE__ */ jsx_runtime26.jsx("p", {
                className: "ses-empty",
                children: "No past sessions"
              }),
              dayGroups.map((dg) => /* @__PURE__ */ jsx_runtime26.jsxs("div", {
                children: [
                  /* @__PURE__ */ jsx_runtime26.jsx("div", {
                    className: "ses-day-label",
                    children: dg.dayLabel
                  }),
                  dg.projects.map((pg) => {
                    const projectKey = `${dg.dayLabel}:${pg.cwd ?? ""}`;
                    const collapsed = collapsedProjects.has(projectKey);
                    return /* @__PURE__ */ jsx_runtime26.jsxs("div", {
                      className: "ses-project-group",
                      children: [
                        dg.projects.length > 1 && /* @__PURE__ */ jsx_runtime26.jsxs("button", {
                          type: "button",
                          className: "ses-project-toggle",
                          onClick: () => toggleProject(projectKey),
                          children: [
                            /* @__PURE__ */ jsx_runtime26.jsx("svg", {
                              className: `ses-project-chevron${collapsed ? "" : " ses-project-chevron--open"}`,
                              viewBox: "0 0 12 12",
                              fill: "currentColor",
                              children: /* @__PURE__ */ jsx_runtime26.jsx("path", {
                                d: "M4 2l4 4-4 4z"
                              })
                            }),
                            pg.label
                          ]
                        }),
                        !collapsed && pg.sessions.map((entry) => /* @__PURE__ */ jsx_runtime26.jsx(PastSessionRow, {
                          entry,
                          pending: resumingId === entry.id,
                          onResume: handleResume,
                          onDelete: handleDeletePast
                        }, entry.id))
                      ]
                    }, projectKey);
                  })
                ]
              }, dg.dayLabel))
            ]
          })
        ]
      })
    ]
  });
}

// src/components/usage/UsageScreen.tsx
var import_react23 = __toESM(require_react(), 1);
var jsx_runtime27 = __toESM(require_jsx_runtime(), 1);
function formatResetsIn(resetsAtMs, now2 = Date.now()) {
  const diff = resetsAtMs - now2;
  if (diff <= 0)
    return "resets now";
  const totalSeconds = Math.floor(diff / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  if (days > 0) {
    const hours = totalHours % 24;
    return hours > 0 ? `resets in ${days}d ${hours}h` : `resets in ${days}d`;
  }
  if (totalHours > 0) {
    const minutes = totalMinutes % 60;
    return minutes > 0 ? `resets in ${totalHours}h ${minutes}m` : `resets in ${totalHours}h`;
  }
  if (totalMinutes > 0) {
    return `resets in ${totalMinutes}m`;
  }
  return `resets in ${Math.max(1, totalSeconds)}s`;
}
function formatReportAge(fetchedAtMs, now2 = Date.now()) {
  const diff = Math.max(0, now2 - fetchedAtMs);
  if (diff < 60000)
    return "just now";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60)
    return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)
    return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
function formatAccountLabel(metadata, fallback = "account") {
  if (!metadata)
    return fallback;
  const email = typeof metadata.email === "string" && metadata.email.trim() ? metadata.email.trim() : undefined;
  const orgName = typeof metadata.orgName === "string" && metadata.orgName.trim() ? metadata.orgName.trim() : undefined;
  const orgId = typeof metadata.orgId === "string" && metadata.orgId.trim() ? metadata.orgId.trim() : undefined;
  const org = orgName || orgId;
  const accountId = typeof metadata.accountId === "string" && metadata.accountId.trim() ? metadata.accountId.trim() : undefined;
  if (email)
    return org ? `${email} (${org})` : email;
  if (accountId)
    return org && org !== accountId ? `${accountId} (${org})` : accountId;
  if (org)
    return org;
  return fallback;
}
function getLimitUsedFraction(amount) {
  if (!amount)
    return 0;
  if (typeof amount.usedFraction === "number" && !Number.isNaN(amount.usedFraction)) {
    return amount.usedFraction;
  }
  if (typeof amount.used === "number" && typeof amount.limit === "number" && amount.limit > 0 && !Number.isNaN(amount.used)) {
    return amount.used / amount.limit;
  }
  if (amount.unit === "percent" && typeof amount.used === "number") {
    return amount.used / 100;
  }
  if (typeof amount.remainingFraction === "number" && !Number.isNaN(amount.remainingFraction)) {
    return Math.max(0, 1 - amount.remainingFraction);
  }
  return 0;
}
function UsageScreen({
  sink,
  sessionState,
  stats,
  onBack,
  initialReports,
  initialResetAccounts
}) {
  const [reports, setReports] = import_react23.useState(initialReports ?? []);
  const [resetAccounts, setResetAccounts] = import_react23.useState(initialResetAccounts ?? []);
  const [loading, setLoading] = import_react23.useState(false);
  const [redeemConfirm, setRedeemConfirm] = import_react23.useState(null);
  const [redeemPending, setRedeemPending] = import_react23.useState(false);
  const fetchUsage = import_react23.useCallback(async (refresh) => {
    if (!sink)
      return;
    setLoading(true);
    try {
      const [usageRes, resetRes] = await Promise.allSettled([
        getUsageReports(sink, refresh),
        getResetCredits(sink)
      ]);
      if (usageRes.status === "fulfilled") {
        setReports(usageRes.value.data.reports ?? []);
      } else {
        notify("error", usageRes.reason instanceof Error ? usageRes.reason.message : "Failed to load usage reports");
      }
      if (resetRes.status === "fulfilled") {
        setResetAccounts(resetRes.value.data.accounts ?? []);
      } else {
        notify("error", resetRes.reason instanceof Error ? resetRes.reason.message : "Failed to load reset credits");
      }
    } finally {
      setLoading(false);
    }
  }, [sink]);
  import_react23.useEffect(() => {
    if (sink && !initialReports && !initialResetAccounts) {
      fetchUsage(false);
    }
  }, [sink, fetchUsage, initialReports, initialResetAccounts]);
  const handleConfirmRedeem = import_react23.useCallback(async (account) => {
    if (!sink)
      return;
    setRedeemPending(true);
    try {
      const res = await redeemResetCredit(sink, account.target);
      notify(res.data.ok ? "info" : "error", res.data.message);
      setRedeemConfirm(null);
      await fetchUsage(true);
    } catch (err) {
      notify("error", err instanceof Error ? err.message : String(err));
    } finally {
      setRedeemPending(false);
    }
  }, [sink, fetchUsage]);
  const contextUsage = sessionState?.contextUsage ?? stats?.contextUsage;
  const contextWindow = contextUsage?.contextWindow ?? 0;
  const contextTokens = contextUsage?.tokens ?? 0;
  const hasValidContext = contextWindow > 0;
  const contextPercent = hasValidContext ? contextUsage?.percent ?? contextTokens / contextWindow * 100 : 0;
  const clampedContextPercent = Math.min(100, Math.max(0, contextPercent));
  const currentContextLevel = contextLevel(clampedContextPercent);
  const formattedContextStr = formatContextUsage(contextUsage);
  const groupedProviders = import_react23.useMemo(() => {
    const groups = {};
    for (const r of reports) {
      const list = groups[r.provider] ?? [];
      list.push(r);
      groups[r.provider] = list;
    }
    const result = [];
    for (const [provider, list] of Object.entries(groups)) {
      list.sort((a, b) => {
        if (a.active !== b.active) {
          return a.active ? -1 : 1;
        }
        const labelA = formatAccountLabel(a.metadata);
        const labelB = formatAccountLabel(b.metadata);
        return labelA.localeCompare(labelB);
      });
      result.push({ provider, reports: list });
    }
    return result;
  }, [reports]);
  const newestFetchedAt = import_react23.useMemo(() => {
    let max = 0;
    for (const r of reports) {
      if (r.fetchedAt && r.fetchedAt > max) {
        max = r.fetchedAt;
      }
    }
    return max;
  }, [reports]);
  return /* @__PURE__ */ jsx_runtime27.jsxs("div", {
    className: "sh-panel-body",
    children: [
      /* @__PURE__ */ jsx_runtime27.jsxs("div", {
        className: "sh-panel-header",
        children: [
          onBack && /* @__PURE__ */ jsx_runtime27.jsx("button", {
            type: "button",
            className: "tb-back",
            onClick: onBack,
            "aria-label": "Back",
            children: "←"
          }),
          /* @__PURE__ */ jsx_runtime27.jsx("span", {
            className: "sh-panel-title",
            children: "Usage"
          }),
          /* @__PURE__ */ jsx_runtime27.jsxs("button", {
            type: "button",
            className: "us-refresh-btn",
            onClick: () => fetchUsage(true),
            disabled: loading,
            "aria-label": "Refresh",
            children: [
              /* @__PURE__ */ jsx_runtime27.jsx(RefreshCw, {
                size: 14,
                className: loading ? "us-spinning" : "us-refresh-icon"
              }),
              /* @__PURE__ */ jsx_runtime27.jsx("span", {
                children: "Refresh"
              })
            ]
          })
        ]
      }),
      /* @__PURE__ */ jsx_runtime27.jsxs("div", {
        className: "us-screen",
        children: [
          /* @__PURE__ */ jsx_runtime27.jsxs("section", {
            className: "us-section",
            "aria-label": "Context usage",
            children: [
              /* @__PURE__ */ jsx_runtime27.jsxs("div", {
                className: "us-section-header",
                children: [
                  /* @__PURE__ */ jsx_runtime27.jsx("h2", {
                    className: "us-section-title",
                    children: "Context"
                  }),
                  formattedContextStr && /* @__PURE__ */ jsx_runtime27.jsx("span", {
                    className: "us-context-summary",
                    children: formattedContextStr
                  })
                ]
              }),
              hasValidContext ? /* @__PURE__ */ jsx_runtime27.jsxs(jsx_runtime27.Fragment, {
                children: [
                  /* @__PURE__ */ jsx_runtime27.jsx("div", {
                    className: "us-context-bar-wrap",
                    children: /* @__PURE__ */ jsx_runtime27.jsx("div", {
                      className: `us-context-bar us-level-${currentContextLevel}`,
                      style: { width: `${clampedContextPercent}%` },
                      role: "progressbar",
                      "aria-valuenow": Math.round(clampedContextPercent),
                      "aria-valuemin": 0,
                      "aria-valuemax": 100
                    })
                  }),
                  /* @__PURE__ */ jsx_runtime27.jsxs("div", {
                    className: "us-context-meta",
                    children: [
                      /* @__PURE__ */ jsx_runtime27.jsxs("span", {
                        children: [
                          formatNumber(contextTokens),
                          " / ",
                          formatNumber(contextWindow)
                        ]
                      }),
                      /* @__PURE__ */ jsx_runtime27.jsx("span", {
                        children: contextPercent < 1 && contextPercent > 0 ? `${contextPercent.toFixed(1)}%` : `${Math.round(contextPercent)}%`
                      })
                    ]
                  })
                ]
              }) : /* @__PURE__ */ jsx_runtime27.jsx("div", {
                className: "us-empty",
                children: "No context window data"
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime27.jsxs("section", {
            className: "us-section",
            "aria-label": "Session statistics",
            children: [
              /* @__PURE__ */ jsx_runtime27.jsx("div", {
                className: "us-section-header",
                children: /* @__PURE__ */ jsx_runtime27.jsx("h2", {
                  className: "us-section-title",
                  children: "Session"
                })
              }),
              /* @__PURE__ */ jsx_runtime27.jsxs("div", {
                className: "us-stats-grid",
                children: [
                  /* @__PURE__ */ jsx_runtime27.jsxs("div", {
                    className: "us-stat-item",
                    children: [
                      /* @__PURE__ */ jsx_runtime27.jsx("span", {
                        className: "us-stat-label",
                        children: "Cost"
                      }),
                      /* @__PURE__ */ jsx_runtime27.jsxs("span", {
                        className: "us-stat-value",
                        children: [
                          "$",
                          (stats?.cost ?? 0).toFixed(2)
                        ]
                      })
                    ]
                  }),
                  /* @__PURE__ */ jsx_runtime27.jsxs("div", {
                    className: "us-stat-item",
                    children: [
                      /* @__PURE__ */ jsx_runtime27.jsx("span", {
                        className: "us-stat-label",
                        children: "Input tokens"
                      }),
                      /* @__PURE__ */ jsx_runtime27.jsx("span", {
                        className: "us-stat-value",
                        children: formatNumber(stats?.tokens?.input ?? 0)
                      })
                    ]
                  }),
                  /* @__PURE__ */ jsx_runtime27.jsxs("div", {
                    className: "us-stat-item",
                    children: [
                      /* @__PURE__ */ jsx_runtime27.jsx("span", {
                        className: "us-stat-label",
                        children: "Output tokens"
                      }),
                      /* @__PURE__ */ jsx_runtime27.jsx("span", {
                        className: "us-stat-value",
                        children: formatNumber(stats?.tokens?.output ?? 0)
                      })
                    ]
                  }),
                  /* @__PURE__ */ jsx_runtime27.jsxs("div", {
                    className: "us-stat-item",
                    children: [
                      /* @__PURE__ */ jsx_runtime27.jsx("span", {
                        className: "us-stat-label",
                        children: "Cache read"
                      }),
                      /* @__PURE__ */ jsx_runtime27.jsx("span", {
                        className: "us-stat-value",
                        children: formatNumber(stats?.tokens?.cacheRead ?? 0)
                      })
                    ]
                  }),
                  /* @__PURE__ */ jsx_runtime27.jsxs("div", {
                    className: "us-stat-item",
                    children: [
                      /* @__PURE__ */ jsx_runtime27.jsx("span", {
                        className: "us-stat-label",
                        children: "Cache write"
                      }),
                      /* @__PURE__ */ jsx_runtime27.jsx("span", {
                        className: "us-stat-value",
                        children: formatNumber(stats?.tokens?.cacheWrite ?? 0)
                      })
                    ]
                  }),
                  /* @__PURE__ */ jsx_runtime27.jsxs("div", {
                    className: "us-stat-item",
                    children: [
                      /* @__PURE__ */ jsx_runtime27.jsx("span", {
                        className: "us-stat-label",
                        children: "Premium requests"
                      }),
                      /* @__PURE__ */ jsx_runtime27.jsx("span", {
                        className: "us-stat-value",
                        children: stats?.premiumRequests ?? 0
                      })
                    ]
                  })
                ]
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime27.jsxs("section", {
            className: "us-section",
            "aria-label": "Provider rate limits",
            children: [
              /* @__PURE__ */ jsx_runtime27.jsxs("div", {
                className: "us-section-header",
                children: [
                  /* @__PURE__ */ jsx_runtime27.jsx("h2", {
                    className: "us-section-title",
                    children: "Providers"
                  }),
                  newestFetchedAt > 0 && /* @__PURE__ */ jsx_runtime27.jsxs("span", {
                    className: "us-report-age",
                    children: [
                      "Updated ",
                      formatReportAge(newestFetchedAt)
                    ]
                  })
                ]
              }),
              loading && reports.length === 0 ? /* @__PURE__ */ jsx_runtime27.jsx("div", {
                className: "us-loading",
                children: "Loading usage reports..."
              }) : groupedProviders.length === 0 ? /* @__PURE__ */ jsx_runtime27.jsx("div", {
                className: "us-empty",
                children: "No usage reports available"
              }) : /* @__PURE__ */ jsx_runtime27.jsx("div", {
                className: "us-providers-list",
                children: groupedProviders.map(({ provider, reports: providerReports }) => /* @__PURE__ */ jsx_runtime27.jsxs("div", {
                  className: "us-provider-group",
                  children: [
                    /* @__PURE__ */ jsx_runtime27.jsx("div", {
                      className: "us-provider-title",
                      children: provider
                    }),
                    /* @__PURE__ */ jsx_runtime27.jsx("div", {
                      className: "us-accounts-list",
                      children: providerReports.map((report, idx) => {
                        const accountLabel = formatAccountLabel(report.metadata, `Account ${idx + 1}`);
                        return /* @__PURE__ */ jsx_runtime27.jsxs("div", {
                          className: "us-account-card",
                          children: [
                            /* @__PURE__ */ jsx_runtime27.jsxs("div", {
                              className: "us-account-header",
                              children: [
                                /* @__PURE__ */ jsx_runtime27.jsx("span", {
                                  className: "us-account-label",
                                  children: accountLabel
                                }),
                                report.active && /* @__PURE__ */ jsx_runtime27.jsx("span", {
                                  className: "us-active-badge",
                                  children: "Active"
                                })
                              ]
                            }),
                            report.limits.length === 0 ? /* @__PURE__ */ jsx_runtime27.jsx("div", {
                              className: "us-empty",
                              children: "No limits reported"
                            }) : /* @__PURE__ */ jsx_runtime27.jsx("div", {
                              className: "us-limits-list",
                              children: report.limits.map((limit) => {
                                const fraction = getLimitUsedFraction(limit.amount);
                                const percent = Math.min(100, Math.max(0, fraction * 100));
                                const percentText = percent < 1 && percent > 0 ? `${percent.toFixed(1)}%` : `${Math.round(percent)}%`;
                                const status = limit.status ?? (fraction >= 1 ? "exhausted" : fraction >= 0.8 ? "warning" : "ok");
                                const resetText = limit.window?.resetsAt ? formatResetsIn(limit.window.resetsAt) : undefined;
                                return /* @__PURE__ */ jsx_runtime27.jsxs("div", {
                                  className: "us-limit-row",
                                  children: [
                                    /* @__PURE__ */ jsx_runtime27.jsxs("div", {
                                      className: "us-limit-header",
                                      children: [
                                        /* @__PURE__ */ jsx_runtime27.jsxs("div", {
                                          className: "us-limit-name",
                                          children: [
                                            /* @__PURE__ */ jsx_runtime27.jsx("span", {
                                              className: "us-limit-label",
                                              children: limit.label
                                            }),
                                            limit.window?.label && /* @__PURE__ */ jsx_runtime27.jsxs("span", {
                                              className: "us-limit-window",
                                              children: [
                                                "(",
                                                limit.window.label,
                                                ")"
                                              ]
                                            })
                                          ]
                                        }),
                                        /* @__PURE__ */ jsx_runtime27.jsxs("div", {
                                          className: "us-limit-meta",
                                          children: [
                                            /* @__PURE__ */ jsx_runtime27.jsx("span", {
                                              className: "us-limit-percent",
                                              children: percentText
                                            }),
                                            resetText && /* @__PURE__ */ jsx_runtime27.jsx("span", {
                                              className: "us-limit-reset",
                                              children: resetText
                                            })
                                          ]
                                        })
                                      ]
                                    }),
                                    /* @__PURE__ */ jsx_runtime27.jsx("div", {
                                      className: "us-limit-bar-track",
                                      children: /* @__PURE__ */ jsx_runtime27.jsx("div", {
                                        className: "us-limit-bar-fill",
                                        "data-status": status,
                                        style: { width: `${percent}%` },
                                        role: "progressbar",
                                        "aria-valuenow": Math.round(percent),
                                        "aria-valuemin": 0,
                                        "aria-valuemax": 100
                                      })
                                    }),
                                    limit.notes && limit.notes.length > 0 && /* @__PURE__ */ jsx_runtime27.jsx("div", {
                                      className: "us-limit-notes",
                                      children: limit.notes.map((note, noteIdx) => /* @__PURE__ */ jsx_runtime27.jsx("span", {
                                        className: "us-limit-note",
                                        children: note
                                      }, noteIdx))
                                    })
                                  ]
                                }, limit.id);
                              })
                            })
                          ]
                        }, `${provider}-${idx}-${accountLabel}`);
                      })
                    })
                  ]
                }, provider))
              })
            ]
          }),
          resetAccounts.length > 0 && /* @__PURE__ */ jsx_runtime27.jsxs("section", {
            className: "us-section",
            "aria-label": "Reset credits",
            children: [
              /* @__PURE__ */ jsx_runtime27.jsx("div", {
                className: "us-section-header",
                children: /* @__PURE__ */ jsx_runtime27.jsx("h2", {
                  className: "us-section-title",
                  children: "Reset Credits"
                })
              }),
              /* @__PURE__ */ jsx_runtime27.jsx("div", {
                className: "us-resets-list",
                children: resetAccounts.map((account) => /* @__PURE__ */ jsx_runtime27.jsxs("div", {
                  className: "us-reset-account",
                  children: [
                    /* @__PURE__ */ jsx_runtime27.jsx("div", {
                      className: "us-reset-header",
                      children: /* @__PURE__ */ jsx_runtime27.jsxs("div", {
                        className: "us-reset-identity",
                        children: [
                          /* @__PURE__ */ jsx_runtime27.jsx("span", {
                            className: "us-reset-label",
                            children: account.label
                          }),
                          /* @__PURE__ */ jsx_runtime27.jsxs("span", {
                            className: "us-reset-provider",
                            children: [
                              "(",
                              account.providerLabel,
                              ")"
                            ]
                          }),
                          account.active && /* @__PURE__ */ jsx_runtime27.jsx("span", {
                            className: "us-active-badge",
                            children: "Active"
                          })
                        ]
                      })
                    }),
                    /* @__PURE__ */ jsx_runtime27.jsxs("div", {
                      className: "us-reset-details",
                      children: [
                        /* @__PURE__ */ jsx_runtime27.jsxs("div", {
                          className: "us-reset-counts",
                          children: [
                            /* @__PURE__ */ jsx_runtime27.jsxs("span", {
                              children: [
                                "Available: ",
                                /* @__PURE__ */ jsx_runtime27.jsx("strong", {
                                  children: account.availableCount
                                })
                              ]
                            }),
                            /* @__PURE__ */ jsx_runtime27.jsxs("span", {
                              children: [
                                "Redeemable: ",
                                /* @__PURE__ */ jsx_runtime27.jsx("strong", {
                                  children: account.redeemableCount
                                })
                              ]
                            })
                          ]
                        }),
                        account.redeemableCount > 0 && /* @__PURE__ */ jsx_runtime27.jsx("button", {
                          type: "button",
                          className: "us-redeem-btn",
                          onClick: () => setRedeemConfirm(account),
                          children: "Redeem"
                        })
                      ]
                    }),
                    account.unavailableReason && /* @__PURE__ */ jsx_runtime27.jsx("div", {
                      className: "us-reset-reason",
                      children: account.unavailableReason
                    }),
                    account.error && /* @__PURE__ */ jsx_runtime27.jsx("div", {
                      className: "us-reset-error",
                      children: account.error
                    }),
                    account.expiresAt && /* @__PURE__ */ jsx_runtime27.jsxs("div", {
                      className: "us-reset-expiry",
                      children: [
                        "Expires ",
                        new Date(account.expiresAt).toLocaleDateString()
                      ]
                    })
                  ]
                }, `${account.provider}-${account.label}-${account.target.credentialId}`))
              })
            ]
          })
        ]
      }),
      redeemConfirm && /* @__PURE__ */ jsx_runtime27.jsxs(jsx_runtime27.Fragment, {
        children: [
          /* @__PURE__ */ jsx_runtime27.jsx("div", {
            className: "tb-popover-backdrop",
            onClick: () => !redeemPending && setRedeemConfirm(null)
          }),
          /* @__PURE__ */ jsx_runtime27.jsxs("div", {
            className: "tb-confirm-dialog",
            role: "dialog",
            "aria-modal": "true",
            "aria-label": "Redeem reset credit",
            children: [
              /* @__PURE__ */ jsx_runtime27.jsx("div", {
                className: "tb-confirm-title",
                children: "Redeem reset credit"
              }),
              /* @__PURE__ */ jsx_runtime27.jsxs("div", {
                className: "tb-confirm-desc",
                children: [
                  "Redeem a rate-limit reset credit for ",
                  redeemConfirm.providerLabel,
                  " (",
                  redeemConfirm.label,
                  ")?"
                ]
              }),
              /* @__PURE__ */ jsx_runtime27.jsxs("div", {
                className: "tb-confirm-actions",
                children: [
                  /* @__PURE__ */ jsx_runtime27.jsx("button", {
                    type: "button",
                    className: "tb-confirm-btn tb-confirm-btn--cancel",
                    disabled: redeemPending,
                    onClick: () => setRedeemConfirm(null),
                    children: "Cancel"
                  }),
                  /* @__PURE__ */ jsx_runtime27.jsx("button", {
                    type: "button",
                    className: "tb-confirm-btn tb-confirm-btn--primary",
                    disabled: redeemPending,
                    onClick: () => handleConfirmRedeem(redeemConfirm),
                    children: redeemPending ? "Redeeming..." : "Redeem"
                  })
                ]
              })
            ]
          })
        ]
      })
    ]
  });
}

// src/lib/sessions-api.ts
async function checkedJson(res) {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }
  return res.json();
}
async function checkedVoid(res) {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }
}
var REQUEST_TIMEOUT_MS = 1e4;
function combineSignal(signal) {
  const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  if (!signal)
    return timeoutSignal;
  return AbortSignal.any ? AbortSignal.any([timeoutSignal, signal]) : timeoutSignal;
}
function createSessionsApi(baseUrl, fetchImpl = fetch) {
  const request = async (url, init) => {
    const signal = combineSignal(init?.signal ?? undefined);
    try {
      return await fetchImpl(url, { ...init, signal });
    } catch (err) {
      if (err instanceof Error) {
        if (init?.signal?.aborted && (err.name === "AbortError" || init.signal.reason?.name === "AbortError")) {
          throw err;
        }
        if (err.name === "TimeoutError" || signal.reason?.name === "TimeoutError") {
          throw new Error("Request timed out", { cause: err });
        }
        if (signal.aborted) {
          throw err;
        }
        throw new Error(`Network error: ${err.message}`, { cause: err });
      }
      throw new Error(`Network error: ${String(err)}`);
    }
  };
  return {
    async listLive(signal) {
      const res = await request(`${baseUrl}/api/live`, { signal });
      return checkedJson(res);
    },
    async listPast(opts) {
      const params = new URLSearchParams;
      if (opts.cwd != null)
        params.set("cwd", opts.cwd);
      if (opts.all != null)
        params.set("all", String(opts.all));
      const qs = params.toString();
      const url = `${baseUrl}/api/past${qs ? `?${qs}` : ""}`;
      const res = await request(url, { signal: opts.signal });
      return checkedJson(res);
    },
    async launch(cwd, signal) {
      const res = await request(`${baseUrl}/api/launch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cwd }),
        signal
      });
      return checkedJson(res);
    },
    async resume(id, signal) {
      const res = await request(`${baseUrl}/api/past/${encodeURIComponent(id)}/resume`, {
        method: "POST",
        signal
      });
      return checkedJson(res);
    },
    async shutdown(instanceId, signal) {
      const res = await request(`${baseUrl}/api/live/${encodeURIComponent(instanceId)}/shutdown`, {
        method: "POST",
        signal
      });
      return checkedVoid(res);
    },
    async deletePast(id, signal) {
      const res = await request(`${baseUrl}/api/past/${encodeURIComponent(id)}`, {
        method: "DELETE",
        signal
      });
      return checkedVoid(res);
    }
  };
}

// src/App.tsx
var jsx_runtime28 = __toESM(require_jsx_runtime(), 1);
var AgentHubScreen = import_react24.lazy(() => import("./AgentHubScreen.hst87eza.js"));
function wsUrl(instanceId) {
  const proto = browserWindow.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${browserWindow.location.host}/ws/${instanceId}`;
}
var EMPTY_SNAPSHOT = {
  historyLoaded: false,
  connection: "closed",
  transcript: emptyTranscriptState(),
  subagents: EMPTY_SUBAGENT_STATE,
  hub: EMPTY_AGENT_HUB_STATE,
  focus: null,
  focusDetach: null,
  sessionState: null,
  stats: null,
  commands: [],
  streaming: false,
  roles: null,
  agents: null,
  browser: null,
  loginStatus: null,
  login: null,
  restoredDraft: null,
  planState: null,
  planReview: null,
  btw: null
};
var NOOP_UNSUBSCRIBE = () => {};
var EMPTY_COMMANDS = [];
function useRoute() {
  const [route, setRoute] = import_react24.useState(() => parseRoute(browserWindow.location.hash));
  import_react24.useEffect(() => {
    function onHashChange() {
      setRoute(parseRoute(browserWindow.location.hash));
    }
    browserWindow.addEventListener("hashchange", onHashChange);
    return () => browserWindow.removeEventListener("hashchange", onHashChange);
  }, []);
  return route;
}
function useViewportHeight() {
  import_react24.useEffect(() => {
    const vv = browserWindow.visualViewport;
    if (!vv)
      return;
    const root2 = browserDocument.documentElement;
    const style2 = root2.style;
    function update() {
      const tag = browserDocument.activeElement?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") {
        style2.setProperty("--viewport-height", `${vv.height}px`);
        style2.setProperty("--viewport-offset", `${vv.offsetTop}px`);
        root2.dataset.keyboard = "true";
      } else {
        style2.removeProperty("--viewport-height");
        style2.removeProperty("--viewport-offset");
        delete root2.dataset.keyboard;
      }
    }
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    browserDocument.addEventListener("focusin", update);
    browserDocument.addEventListener("focusout", update);
    update();
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      browserDocument.removeEventListener("focusin", update);
      browserDocument.removeEventListener("focusout", update);
    };
  }, []);
}
function App() {
  const route = useRoute();
  const instanceId = route.kind === "session" ? route.id : null;
  useViewportHeight();
  import_react24.useEffect(() => {
    const opts = { capture: true, passive: true };
    browserWindow.addEventListener("pointerdown", claimOnInput, opts);
    browserWindow.addEventListener("keydown", claimOnInput, opts);
    return () => {
      browserWindow.removeEventListener("pointerdown", claimOnInput, opts);
      browserWindow.removeEventListener("keydown", claimOnInput, opts);
    };
  }, []);
  const attachRef = import_react24.useRef(null);
  const lastPromptRef = import_react24.useRef(null);
  const [btwHistoryRecords, setBtwHistoryRecords] = import_react24.useState([]);
  const [attachKey, setAttachKey] = import_react24.useState(0);
  import_react24.useEffect(() => {
    if (attachRef.current) {
      attachRef.current.store.dispose();
      attachRef.current.client.close();
      attachRef.current = null;
    }
    if (instanceId === null) {
      setAttachKey((k) => k + 1);
      return;
    }
    const client = new RpcWebClient({
      url: wsUrl(instanceId),
      reconnect: { enabled: true }
    });
    const store = createSessionStore(client, { instanceId });
    attachRef.current = { client, store };
    setAttachKey((k) => k + 1);
    const unsubLateError = client.onLateError((err) => {
      if (err.command === "prompt" && lastPromptRef.current) {
        restoreFailedSend(store, lastPromptRef.current);
        lastPromptRef.current = null;
      }
      notify("error", `Failed: ${err.message}`);
    });
    let disposed = false;
    client.connect().catch((err) => {
      if (disposed)
        return;
      if (!(err instanceof RpcIncompatibleError)) {
        notify("error", "Failed to connect to session");
      }
    });
    return () => {
      disposed = true;
      unsubLateError();
      if (attachRef.current) {
        attachRef.current.store.dispose();
        attachRef.current.client.close();
        attachRef.current = null;
      }
    };
  }, [instanceId]);
  const currentStore = attachRef.current?.store ?? null;
  const subscribe = import_react24.useCallback((fn) => currentStore ? currentStore.subscribe(fn) : NOOP_UNSUBSCRIBE, [attachKey]);
  const getSnapshot = import_react24.useCallback(() => currentStore?.getSnapshot() ?? EMPTY_SNAPSHOT, [attachKey]);
  const snap = import_react24.useSyncExternalStore(subscribe, getSnapshot);
  const snapRef = import_react24.useRef(snap);
  snapRef.current = snap;
  const loadOlder = import_react24.useCallback(() => currentStore?.loadOlder() ?? Promise.resolve(), [attachKey]);
  const [expandAll, setExpandAll] = import_react24.useState(false);
  const dismissKey = snap.sessionState?.sessionId ?? (route.kind === "session" ? route.id : null);
  const [dismissed, setDismissed] = import_react24.useState({ key: null, ids: new Set });
  const storedDismissed = import_react24.useMemo(() => dismissKey ? loadDismissed(dismissKey) : new Set, [dismissKey]);
  const dismissedIds = dismissed.key === dismissKey ? dismissed.ids : storedDismissed;
  const dismissAgents = import_react24.useCallback((ids) => {
    if (!dismissKey || ids.length === 0)
      return;
    const next = new Set(dismissedIds);
    for (const id of ids)
      next.add(id);
    saveDismissed(dismissKey, next);
    setDismissed({ key: dismissKey, ids: next });
  }, [dismissKey, dismissedIds]);
  const dismissAgent = import_react24.useCallback((id) => dismissAgents([id]), [dismissAgents]);
  const routeKey = route.kind === "session" ? `${route.id}:${route.panel}` : route.kind;
  const hub = useModelsHub({
    sink: attachRef.current?.client ?? null,
    snap,
    store: attachRef.current?.store ?? null,
    routeKey
  });
  const composerModels = import_react24.useMemo(() => snap.browser ? snap.browser.models.map((m) => ({
    id: m.id,
    name: m.name,
    provider: { id: m.provider, name: m.provider }
  })) : [], [snap.browser?.models]);
  const promptHistory = import_react24.useMemo(() => extractUserPrompts({ entries: snap.transcript.entries, pendingUser: snap.transcript.pendingUser }), [snap.transcript.entries, snap.transcript.pendingUser]);
  const pinnedRowsList = import_react24.useMemo(() => pinnedRows(snap.hub, snap.subagents, dismissedIds), [snap.hub, snap.subagents, dismissedIds]);
  const apiRef = import_react24.useRef(createSessionsApi(browserWindow.location.origin));
  const composerDraftRef = import_react24.useRef({ text: "", images: [] });
  const [liveCwd, setLiveCwd] = import_react24.useState(null);
  import_react24.useEffect(() => {
    setLiveCwd(null);
    if (instanceId === null)
      return;
    const ctrl = new AbortController;
    apiRef.current.listLive(ctrl.signal).then((entries2) => setLiveCwd(entries2.find((e) => e.instanceId === instanceId)?.cwd ?? null)).catch(() => {});
    return () => ctrl.abort();
  }, [instanceId]);
  const isHubRoute = route.kind === "session" && route.panel === "hub";
  import_react24.useEffect(() => {
    if (!currentStore || !isHubRoute)
      return;
    currentStore.setHubOpen(true);
    return () => currentStore.setHubOpen(false);
  }, [currentStore, isHubRoute]);
  const [wide, setWide] = import_react24.useState(() => browserWindow.matchMedia(`(min-width: ${BP_LG}px)`).matches);
  import_react24.useEffect(() => {
    const update = () => setWide(browserWindow.matchMedia(`(min-width: ${BP_LG}px)`).matches);
    browserWindow.addEventListener("resize", update);
    return () => browserWindow.removeEventListener("resize", update);
  }, []);
  const pinnedVisible = route.kind === "session" && (route.panel === "subagents" || wide && !isHubRoute && route.panel !== "todos" && route.panel !== "models" && route.panel !== "usage");
  import_react24.useEffect(() => {
    if (!currentStore || !pinnedVisible)
      return;
    currentStore.setPinnedOpen(true);
    return () => currentStore.setPinnedOpen(false);
  }, [currentStore, pinnedVisible]);
  const toolHost = import_react24.useMemo(() => ({
    openAgent: (agent) => {
      if (instanceId !== null)
        navigate({ kind: "session", id: instanceId, panel: "agent", agent });
    }
  }), [instanceId]);
  const focusRouteAgent = route.kind === "session" && route.panel === "agent" ? route.agent : undefined;
  import_react24.useEffect(() => {
    if (!currentStore)
      return;
    if (focusRouteAgent !== undefined)
      currentStore.focusAgent(focusRouteAgent);
    else
      currentStore.unfocus();
  }, [currentStore, focusRouteAgent]);
  const detachNonce = snap.focusDetach?.nonce;
  import_react24.useEffect(() => {
    if (detachNonce === undefined || instanceId === null)
      return;
    const current = parseRoute(browserWindow.location.hash);
    if (current.kind === "session" && current.panel === "agent") {
      navigate({ kind: "session", id: instanceId, panel: null });
    }
  }, [detachNonce]);
  import_react24.useEffect(() => {
    if (focusRouteAgent === undefined || instanceId === null)
      return;
    function handleEscape(e) {
      const ev = e;
      if (ev.key !== "Escape" || ev.defaultPrevented || ev.target?.tagName !== "BODY")
        return;
      ev.preventDefault();
      navigate({ kind: "session", id: instanceId, panel: null });
    }
    browserWindow.addEventListener("keydown", handleEscape);
    return () => browserWindow.removeEventListener("keydown", handleEscape);
  }, [focusRouteAgent, instanceId]);
  import_react24.useEffect(() => {
    function handleHubKey(e) {
      const ev = e;
      if (!ev.altKey || ev.ctrlKey || ev.metaKey || ev.code !== "KeyA" || instanceId === null)
        return;
      ev.preventDefault();
      navigate({ kind: "session", id: instanceId, panel: isHubRoute ? null : "hub" });
    }
    browserWindow.addEventListener("keydown", handleHubKey);
    return () => browserWindow.removeEventListener("keydown", handleHubKey);
  }, [instanceId, isHubRoute]);
  import_react24.useEffect(() => {
    function handleKeyDown(e) {
      const ev = e;
      if ((ev.ctrlKey || ev.metaKey) && (ev.key === "p" || ev.key === "P")) {
        ev.preventDefault();
        ev.stopPropagation();
        if (focusRouteAgent !== undefined) {
          notify("info", "Model changes run in the main session; press Esc to return first");
          return;
        }
        hub.cycleRoleModel(ev.shiftKey ? "backward" : "forward");
      }
    }
    browserWindow.addEventListener("keydown", handleKeyDown);
    return () => browserWindow.removeEventListener("keydown", handleKeyDown);
  }, [hub, focusRouteAgent]);
  function handleAttach(id) {
    navigate({ kind: "session", id, panel: null });
  }
  const focus = snap.focus;
  const focusEntry = focus ? snap.hub.agents.get(focus.agentId) : undefined;
  const focusMetrics = focusEntry ? entryMetrics(focusEntry) : undefined;
  const focusStreaming = focus?.transcript.working ?? false;
  const exitFocus = import_react24.useCallback(() => {
    if (instanceId !== null)
      navigate({ kind: "session", id: instanceId, panel: null });
  }, [instanceId]);
  const handleSend = import_react24.useCallback((text, mode, images) => {
    const attached = attachRef.current;
    if (!attached)
      return;
    const { client } = attached;
    const curFocus = snapRef.current.focus;
    if (curFocus) {
      const gate = gateFocusedSubmit(text);
      if (gate.kind === "refuse") {
        notify("info", gate.message);
        return false;
      }
      if (gate.kind === "usage") {
        if (instanceId !== null)
          navigate({ kind: "session", id: instanceId, panel: "usage" });
        return;
      }
      if (gate.kind === "export") {
        if (instanceId === null)
          return;
        const agentId = curFocus.agentId;
        notify("info", "Exporting HTML...");
        fetch(`/api/live/${encodeURIComponent(instanceId)}/export`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ agentId })
        }).then(async (res) => {
          if (!res.ok) {
            const msg = await res.text();
            throw new Error(msg || `Export failed with HTTP ${res.status}`);
          }
          const blob = await res.blob();
          const disposition = res.headers.get("content-disposition") || "";
          const match = disposition.match(/filename[*]?=["']?([^"';\n]+)/i);
          const filename = match?.[1] || `${agentId}-${new Date().toISOString().slice(0, 10)}.html`;
          triggerBlobDownload(blob, filename);
          notify("info", `Exported to ${filename}`);
        }).catch((err) => {
          notify("error", `Export failed: ${err instanceof Error ? err.message : String(err)}`);
        });
        return;
      }
      attached.store.echoUser(text, images);
      steerAgent(client, curFocus.agentId, text, mode === "followUp" ? "followUp" : "steer", images).catch((err) => {
        attached.store.clearPendingUser();
        attached.store.restoreDraft({ text, images });
        notify("error", `Failed to send${err instanceof Error ? `: ${err.message}` : ""}`);
      });
      return;
    }
    const btwMatch = /^\/btw(?:\s+(.*))?$/s.exec(text);
    if (btwMatch) {
      const q = (btwMatch[1] ?? "").trim();
      if (!q) {
        notify("info", "Usage: /btw <question>");
        return;
      }
      btw(client, q).then((resp) => {
        if (resp.success && resp.data?.record) {
          attached.store.startBtw({
            recordId: resp.data.record.id,
            question: resp.data.record.question,
            initialAnswer: resp.data.record.answer,
            status: resp.data.record.status
          });
        }
      }).catch((err) => {
        notify("error", `Failed to start /btw: ${err instanceof Error ? err.message : String(err)}`);
      });
      return;
    }
    attached.store.echoUser(text, images);
    const promise = mode === "steer" ? steer(client, text, images) : mode === "followUp" ? followUp(client, text, images) : sendPrompt(client, text, { images, streamingBehavior: "steer" }).then((resp) => {
      if (resp.success && resp.data && resp.data.agentInvoked === false) {
        attached.store.clearPendingUser();
      }
    });
    if (mode === "prompt")
      lastPromptRef.current = { text, images };
    promise.catch((err) => {
      restoreFailedSend(attached.store, { text, images });
      notify("error", `Failed to send ${mode}${err instanceof Error ? `: ${err.message}` : ""}`);
    });
  }, [instanceId]);
  function restoreFailedSend(store, draft) {
    store.clearPendingUser();
    const current = composerDraftRef.current;
    store.restoreDraft({
      text: [draft.text, current.text].filter((t) => t.trim().length > 0).join(`

`),
      images: [...draft.images ?? [], ...current.images ?? []]
    });
  }
  const handleAbort = import_react24.useCallback(() => {
    const attached = attachRef.current;
    if (!attached)
      return;
    const { client, store } = attached;
    const curFocus = snapRef.current.focus;
    if (curFocus) {
      interruptAgent(client, curFocus.agentId).catch((err) => {
        notify("error", err instanceof Error ? err.message : "Failed to interrupt agent");
      });
      return;
    }
    abortAndRestoreQueue(client).then((resp) => {
      if (resp?.success && resp.data) {
        const cleared = [...resp.data.steering ?? [], ...resp.data.followUp ?? []];
        store.clearAllPendingUser();
        const newDraft = restoreClearedMessagesToDraft(composerDraftRef.current, cleared);
        store.restoreDraft(newDraft);
      }
    }).catch(() => {
      notify("error", "Failed to abort");
    });
  }, []);
  const handleReconnect = import_react24.useCallback(() => {
    const client = attachRef.current?.client;
    if (client) {
      notify("info", "Reconnecting to host...");
      client.reconnectNow();
    }
  }, []);
  const handleRename = import_react24.useCallback(async (newName) => {
    const attached = attachRef.current;
    if (!attached)
      return false;
    const { client, store } = attached;
    try {
      const res = await setSessionName(client, newName);
      if (res.success) {
        store.refreshSessionState();
        notify("info", "Session renamed");
        return true;
      }
    } catch (err) {
      notify("error", err instanceof Error ? err.message : String(err));
    }
    return false;
  }, []);
  const handleRewind = import_react24.useCallback(async (entryId) => {
    const attached = attachRef.current;
    if (!attached)
      return;
    const { client } = attached;
    try {
      await branch(client, entryId);
      notify("info", "Rewound session");
    } catch (err) {
      notify("error", err instanceof Error ? err.message : String(err));
    }
  }, []);
  const handleRetry = import_react24.useCallback(async () => {
    const attached = attachRef.current;
    if (!attached)
      return;
    const { client } = attached;
    try {
      await retry(client);
    } catch (err) {
      notify("error", err instanceof Error ? err.message : String(err));
    }
  }, []);
  const ss = snap.sessionState;
  const title = ss?.sessionName ?? liveCwd?.split("/").filter(Boolean).pop() ?? instanceId ?? "ompgui";
  const currentModel = import_react24.useMemo(() => ss?.model ? {
    id: ss.model.id,
    name: ss.model.name,
    provider: {
      id: ss.model.provider,
      name: ss.model.provider
    }
  } : undefined, [ss?.model]);
  const handleDraftRestored = import_react24.useCallback(() => {
    attachRef.current?.store.clearRestoredDraft();
  }, []);
  const handleDraftChange = import_react24.useCallback((d) => {
    composerDraftRef.current = d;
  }, []);
  const handleSetModel = import_react24.useCallback((p, id) => {
    const client = attachRef.current?.client;
    if (client)
      setModel(client, p, id).catch(() => notify("error", "Failed to set model"));
  }, []);
  const handleSetThinkingLevel = import_react24.useCallback((level) => {
    const client = attachRef.current?.client;
    if (client)
      setThinkingLevel(client, level).catch(() => notify("error", "Failed to set thinking level"));
  }, []);
  const sessionId = route.kind === "session" ? route.id : null;
  const handlePinnedFocusAgent = import_react24.useCallback((agent) => {
    if (sessionId !== null)
      navigate({ kind: "session", id: sessionId, panel: "agent", agent });
  }, [sessionId]);
  const handlePinnedOpenHub = import_react24.useCallback(() => {
    if (sessionId !== null)
      navigate({ kind: "session", id: sessionId, panel: "hub" });
  }, [sessionId]);
  const handlePinnedBack = import_react24.useCallback(() => {
    if (sessionId !== null)
      navigate({ kind: "session", id: sessionId, panel: null });
  }, [sessionId]);
  const narrowPanel = route.kind === "session" && route.panel !== null ? route.panel : null;
  const isSessionsPage = route.kind === "sessions";
  return /* @__PURE__ */ jsx_runtime28.jsxs(jsx_runtime28.Fragment, {
    children: [
      /* @__PURE__ */ jsx_runtime28.jsxs(AppShell, {
        topbar: /* @__PURE__ */ jsx_runtime28.jsx(TopBar, {
          title: isSessionsPage ? "ompgui" : title,
          connection: snap.connection === "reconnecting" ? "connecting" : snap.connection,
          route,
          subagentCount: snap.subagents.agents.size,
          sessionState: ss,
          streaming: snap.streaming,
          sink: attachRef.current?.client ?? null,
          onReconnect: handleReconnect,
          onRename: instanceId ? handleRename : undefined
        }),
        sidebar: isSessionsPage ? undefined : (collapseToggle) => /* @__PURE__ */ jsx_runtime28.jsx(SessionsScreen, {
          api: apiRef.current,
          variant: "sidebar",
          currentInstanceId: instanceId,
          currentSessionName: ss?.sessionName ?? null,
          onAttach: handleAttach,
          collapseToggle
        }),
        inspector: isHubRoute ? undefined : route.kind === "session" && route.panel === "todos" ? /* @__PURE__ */ jsx_runtime28.jsx(TodoPanel, {
          phases: snap.sessionState?.todoPhases ?? [],
          onUpdateTodos: (phases) => attachRef.current?.store.setTodos(phases) ?? Promise.resolve()
        }) : route.kind === "session" && route.panel !== "models" && route.panel !== "usage" ? (collapseToggle) => /* @__PURE__ */ jsx_runtime28.jsx(PinnedSubagents, {
          rows: pinnedRowsList,
          onFocusAgent: handlePinnedFocusAgent,
          onDismiss: dismissAgent,
          onDismissAll: dismissAgents,
          onOpenHub: handlePinnedOpenHub,
          leading: collapseToggle
        }) : route.kind === "session" && route.panel === "models" ? hub.screen : undefined,
        statusStrip: instanceId && !isHubRoute && focus ? /* @__PURE__ */ jsx_runtime28.jsx(FocusStatusStrip, {
          agentId: focus.agentId,
          model: focusEntry?.resolvedModel,
          usage: focusMetrics?.contextWindow ? { tokens: focusMetrics.contextTokens, contextWindow: focusMetrics.contextWindow } : undefined,
          cost: focusMetrics?.cost,
          streaming: focusStreaming,
          expandAll,
          onToggleExpand: () => setExpandAll((v) => !v),
          todoPhases: focus.todoPhases,
          onOpenTodos: () => {
            if (route.kind === "session" && route.panel === "agent" && route.agent) {
              navigate({ ...route, todos: true });
            }
          }
        }) : instanceId && !isHubRoute ? /* @__PURE__ */ jsx_runtime28.jsx(StatusStrip, {
          sessionState: ss,
          stats: snap.stats,
          streaming: snap.streaming,
          expandAll,
          onToggleExpand: () => setExpandAll((v) => !v),
          onPickModel: hub.openActivePicker,
          onPickThinking: hub.openActivePicker,
          onOpenTodos: () => {
            if (route.kind === "session") {
              navigate({ kind: "session", id: route.id, panel: "todos" });
            }
          },
          planState: snap.planState,
          onTogglePlan: () => {
            const client = attachRef.current?.client;
            const cur = snap.planState;
            if (!client || !cur)
              return;
            setPlanMode(client, !cur.enabled).catch((err) => {
              notify("error", `Failed to set plan mode: ${err instanceof Error ? err.message : String(err)}`);
            });
          }
        }) : undefined,
        composer: instanceId && !isHubRoute ? /* @__PURE__ */ jsx_runtime28.jsx(Composer, {
          busy: focus ? focusStreaming : snap.streaming,
          models: composerModels,
          currentModel,
          thinkingLevel: ss?.thinkingLevel,
          commands: focus ? EMPTY_COMMANDS : snap.commands,
          focusedAgentId: focus?.agentId,
          draftKey: draftKey(instanceId, focus?.agentId),
          onExitFocus: exitFocus,
          promptHistory,
          restoredDraft: snap.restoredDraft,
          onDraftRestored: handleDraftRestored,
          onDraftChange: handleDraftChange,
          onSend: handleSend,
          onAbort: handleAbort,
          onSetModel: handleSetModel,
          onSetThinkingLevel: handleSetThinkingLevel
        }) : /* @__PURE__ */ jsx_runtime28.jsx("div", {}),
        children: [
          currentStore && /* @__PURE__ */ jsx_runtime28.jsx(ConnectionBanner, {
            connection: snap.connection,
            onReconnect: handleReconnect
          }),
          isSessionsPage ? /* @__PURE__ */ jsx_runtime28.jsx(SessionsScreen, {
            api: apiRef.current,
            variant: "page",
            currentInstanceId: instanceId,
            onAttach: handleAttach
          }) : isHubRoute && route.kind === "session" ? /* @__PURE__ */ jsx_runtime28.jsx(import_react24.Suspense, {
            fallback: /* @__PURE__ */ jsx_runtime28.jsx("div", {
              className: "ah-empty",
              children: "Loading agent hub..."
            }),
            children: /* @__PURE__ */ jsx_runtime28.jsx(AgentHubScreen, {
              hub: snap.hub,
              sink: attachRef.current?.client ?? null,
              instanceId: route.id,
              focusAgentId: route.agent,
              onFocusAgent: (agent) => navigate({ kind: "session", id: route.id, panel: "agent", agent }),
              onClose: () => navigate({ kind: "session", id: route.id, panel: null })
            })
          }) : /* @__PURE__ */ jsx_runtime28.jsxs(jsx_runtime28.Fragment, {
            children: [
              focus && /* @__PURE__ */ jsx_runtime28.jsxs("div", {
                className: "fc-banner",
                role: "status",
                children: [
                  /* @__PURE__ */ jsx_runtime28.jsx(Ghost, {
                    size: 14,
                    "aria-hidden": "true"
                  }),
                  /* @__PURE__ */ jsx_runtime28.jsx("span", {
                    className: "fc-banner-id",
                    children: agentIdLabel(focus.agentId)
                  }),
                  /* @__PURE__ */ jsx_runtime28.jsx("span", {
                    className: "fc-banner-hint",
                    children: focus.ready ? "Esc returns to Main" : "Reviving agent..."
                  }),
                  focus.error && /* @__PURE__ */ jsx_runtime28.jsx("span", {
                    className: "fc-banner-err",
                    children: focus.error
                  }),
                  /* @__PURE__ */ jsx_runtime28.jsx("button", {
                    type: "button",
                    className: "fc-banner-back",
                    onClick: exitFocus,
                    children: "Main"
                  })
                ]
              }),
              /* @__PURE__ */ jsx_runtime28.jsx(TranscriptView, {
                toolHost,
                state: focus ? focus.transcript : snap.transcript,
                historyLoaded: focus ? focus.loaded : snap.historyLoaded,
                connection: snap.connection,
                streaming: focus ? focusStreaming : snap.streaming,
                expandAll,
                onLoadOlder: focus ? undefined : loadOlder,
                onRewind: focus ? undefined : handleRewind,
                onRetry: focus ? undefined : handleRetry
              }, focus ? `focus:${focus.agentId}` : "main")
            ]
          })
        ]
      }),
      route.kind === "session" && route.panel === "agent" && route.todos && focus && /* @__PURE__ */ jsx_runtime28.jsxs("div", {
        className: "sh-panel-overlay",
        children: [
          /* @__PURE__ */ jsx_runtime28.jsxs("div", {
            className: "sh-panel-header",
            children: [
              /* @__PURE__ */ jsx_runtime28.jsx("button", {
                type: "button",
                className: "tb-back",
                onClick: () => navigate({ kind: "session", id: route.id, panel: "agent", agent: route.agent }),
                "aria-label": "Back",
                children: "←"
              }),
              /* @__PURE__ */ jsx_runtime28.jsxs("span", {
                className: "sh-panel-title",
                children: [
                  "Todos: ",
                  focus.agentId
                ]
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime28.jsx("div", {
            className: "sh-panel-body",
            children: /* @__PURE__ */ jsx_runtime28.jsx(TodoPanel, {
              phases: focus.todoPhases,
              readOnly: true
            })
          })
        ]
      }),
      narrowPanel === "todos" && /* @__PURE__ */ jsx_runtime28.jsxs("div", {
        className: "sh-panel-overlay",
        children: [
          /* @__PURE__ */ jsx_runtime28.jsxs("div", {
            className: "sh-panel-header",
            children: [
              /* @__PURE__ */ jsx_runtime28.jsx("button", {
                type: "button",
                className: "tb-back",
                onClick: () => {
                  if (instanceId) {
                    navigate({ kind: "session", id: instanceId, panel: null });
                  }
                },
                "aria-label": "Back",
                children: "←"
              }),
              /* @__PURE__ */ jsx_runtime28.jsx("span", {
                className: "sh-panel-title",
                children: "Todos"
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime28.jsx("div", {
            className: "sh-panel-body",
            children: /* @__PURE__ */ jsx_runtime28.jsx(TodoPanel, {
              phases: snap.sessionState?.todoPhases ?? [],
              onUpdateTodos: (phases) => attachRef.current?.store.setTodos(phases) ?? Promise.resolve()
            })
          })
        ]
      }),
      narrowPanel === "info" && /* @__PURE__ */ jsx_runtime28.jsxs("div", {
        className: "sh-panel-overlay",
        children: [
          /* @__PURE__ */ jsx_runtime28.jsxs("div", {
            className: "sh-panel-header",
            children: [
              /* @__PURE__ */ jsx_runtime28.jsx("button", {
                type: "button",
                className: "tb-back",
                onClick: () => navigate({
                  kind: "session",
                  id: route.id,
                  panel: null
                }),
                "aria-label": "Back",
                children: "←"
              }),
              /* @__PURE__ */ jsx_runtime28.jsx("span", {
                className: "sh-panel-title",
                children: "Info"
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime28.jsx("div", {
            className: "sh-panel-body",
            children: /* @__PURE__ */ jsx_runtime28.jsx(SessionInfo, {
              title,
              sessionState: ss,
              stats: snap.stats,
              instanceId,
              onRename: instanceId ? handleRename : undefined
            })
          })
        ]
      }),
      narrowPanel === "models" && /* @__PURE__ */ jsx_runtime28.jsxs("div", {
        className: "sh-panel-overlay",
        children: [
          /* @__PURE__ */ jsx_runtime28.jsxs("div", {
            className: "sh-panel-header",
            children: [
              /* @__PURE__ */ jsx_runtime28.jsx("button", {
                type: "button",
                className: "tb-back",
                onClick: () => navigate({
                  kind: "session",
                  id: route.id,
                  panel: null
                }),
                "aria-label": "Back",
                children: "←"
              }),
              /* @__PURE__ */ jsx_runtime28.jsx("span", {
                className: "sh-panel-title",
                children: "Models"
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime28.jsx("div", {
            className: "sh-panel-body",
            children: hub.screen
          })
        ]
      }),
      narrowPanel === "subagents" && route.kind === "session" && /* @__PURE__ */ jsx_runtime28.jsx("div", {
        className: "sh-panel-overlay",
        children: /* @__PURE__ */ jsx_runtime28.jsx(PinnedSubagents, {
          rows: pinnedRowsList,
          onFocusAgent: handlePinnedFocusAgent,
          onDismiss: dismissAgent,
          onOpenHub: handlePinnedOpenHub,
          onBack: handlePinnedBack
        })
      }),
      narrowPanel === "usage" && /* @__PURE__ */ jsx_runtime28.jsx("div", {
        className: "sh-panel-overlay",
        children: /* @__PURE__ */ jsx_runtime28.jsx(UsageScreen, {
          sink: attachRef.current?.client ?? null,
          sessionState: ss,
          stats: snap.stats,
          onBack: () => {
            if (instanceId) {
              navigate({ kind: "session", id: instanceId, panel: null });
            }
          }
        })
      }),
      hub.sheet,
      hub.loginSheet,
      /* @__PURE__ */ jsx_runtime28.jsx(PlanReviewSheet, {
        review: snap.planReview,
        sink: attachRef.current?.client ?? null
      }),
      /* @__PURE__ */ jsx_runtime28.jsx(BtwSheet, {
        btw: snap.btw,
        historyRecords: btwHistoryRecords,
        onCancel: () => {
          if (snap.btw && attachRef.current?.client) {
            btwCancel(attachRef.current.client, snap.btw.recordId).catch(() => {});
          }
        },
        onClose: () => {
          attachRef.current?.store.clearBtw();
        },
        onLoadHistory: () => {
          const client = attachRef.current?.client;
          if (!client)
            return;
          getBtwHistory(client).then((resp) => {
            if (resp.success && resp.data) {
              setBtwHistoryRecords(resp.data.records);
            }
          }).catch(() => {});
        },
        onSelectRecord: (record) => {
          if (!snap.btw)
            return;
          attachRef.current?.store.startBtw({
            recordId: record.id,
            question: record.question,
            initialAnswer: record.answer,
            status: record.status
          });
        },
        onFollowUp: (question, recordId) => {
          const client = attachRef.current?.client;
          if (!client || !snap.btw)
            return;
          btw(client, question, recordId).then((resp) => {
            if (resp.success && resp.data?.record) {
              attachRef.current?.store.updateBtwFromRecord(resp.data.record);
            }
          }).catch((err) => {
            notify("error", `Failed to send follow-up: ${err instanceof Error ? err.message : String(err)}`);
          });
        }
      }),
      /* @__PURE__ */ jsx_runtime28.jsx(Toasts, {})
    ]
  });
}
function SessionInfo({
  title,
  sessionState,
  stats,
  instanceId,
  onRename
}) {
  const [editing, setEditing] = import_react24.useState(false);
  const [editTitle, setEditTitle] = import_react24.useState(title);
  if (!sessionState && !instanceId) {
    return /* @__PURE__ */ jsx_runtime28.jsx("div", {
      style: { padding: 16, color: "var(--fg-muted)" },
      children: "No session"
    });
  }
  const rows = [];
  if (title)
    rows.push(["Title", title]);
  if (instanceId)
    rows.push(["Instance", instanceId]);
  if (sessionState?.sessionId)
    rows.push(["Session ID", sessionState.sessionId]);
  if (sessionState?.sessionFile)
    rows.push(["Session file", sessionState.sessionFile]);
  if (sessionState?.model)
    rows.push(["Model", sessionState.model.name]);
  if (stats) {
    rows.push(["Messages", String(stats.totalMessages)]);
    rows.push(["Cost", `$${stats.cost.toFixed(2)}`]);
    rows.push(["Tokens", String(stats.tokens.total)]);
  }
  return /* @__PURE__ */ jsx_runtime28.jsx("div", {
    style: { padding: 16 },
    children: rows.map(([k, v]) => /* @__PURE__ */ jsx_runtime28.jsxs("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "8px 0",
        borderBottom: "1px solid var(--border)",
        fontSize: 14
      },
      children: [
        /* @__PURE__ */ jsx_runtime28.jsx("span", {
          style: { color: "var(--fg-muted)" },
          children: k
        }),
        k === "Title" && editing ? /* @__PURE__ */ jsx_runtime28.jsxs("form", {
          onSubmit: async (e) => {
            e.preventDefault();
            const trimmed = editTitle.trim();
            if (trimmed && trimmed !== title) {
              await onRename?.(trimmed);
            }
            setEditing(false);
          },
          style: { display: "flex", gap: 6, maxWidth: "70%" },
          children: [
            /* @__PURE__ */ jsx_runtime28.jsx("input", {
              type: "text",
              value: editTitle,
              autoFocus: true,
              onChange: (e) => setEditTitle(e.target.value),
              style: {
                padding: "2px 6px",
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                color: "var(--fg)",
                fontSize: 16,
                width: "140px"
              }
            }),
            /* @__PURE__ */ jsx_runtime28.jsx("button", {
              type: "submit",
              disabled: !editTitle.trim(),
              style: {
                padding: "2px 8px",
                background: "var(--accent)",
                color: "var(--accent-fg, #fff)",
                border: "none",
                borderRadius: "var(--radius-sm)",
                fontSize: 12,
                cursor: "pointer"
              },
              children: "Save"
            }),
            /* @__PURE__ */ jsx_runtime28.jsx("button", {
              type: "button",
              onClick: () => {
                setEditTitle(title);
                setEditing(false);
              },
              style: {
                padding: "2px 6px",
                background: "none",
                color: "var(--fg-muted)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                fontSize: 12,
                cursor: "pointer"
              },
              children: "✕"
            })
          ]
        }) : /* @__PURE__ */ jsx_runtime28.jsxs("span", {
          style: {
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            textAlign: "right",
            maxWidth: "60%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "inline-flex",
            alignItems: "center",
            gap: 6
          },
          children: [
            /* @__PURE__ */ jsx_runtime28.jsx("span", {
              style: { overflow: "hidden", textOverflow: "ellipsis" },
              children: v
            }),
            k === "Title" && onRename && /* @__PURE__ */ jsx_runtime28.jsx("button", {
              type: "button",
              onClick: () => {
                setEditTitle(title);
                setEditing(true);
              },
              style: {
                background: "none",
                border: "none",
                color: "var(--accent)",
                cursor: "pointer",
                fontSize: 12,
                padding: "2px 4px",
                textDecoration: "underline"
              },
              "aria-label": "Rename session",
              children: "Edit"
            })
          ]
        })
      ]
    }, k))
  });
}

// ../../node_modules/@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-400-normal.woff2
var atkinson_hyperlegible_next_latin_400_normal_default = "./atkinson-hyperlegible-next-latin-400-normal.1jhrs5ds.woff2";

// ../../node_modules/@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-500-normal.woff2
var atkinson_hyperlegible_next_latin_500_normal_default = "./atkinson-hyperlegible-next-latin-500-normal.vjr775bh.woff2";

// ../../node_modules/@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-600-normal.woff2
var atkinson_hyperlegible_next_latin_600_normal_default = "./atkinson-hyperlegible-next-latin-600-normal.yph89wev.woff2";

// ../../node_modules/@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-700-normal.woff2
var atkinson_hyperlegible_next_latin_700_normal_default = "./atkinson-hyperlegible-next-latin-700-normal.yxe4drqe.woff2";

// src/styles/fonts/IosevkaTerm-Bold.woff2
var IosevkaTerm_Bold_default = "./IosevkaTerm-Bold.rs89c7xm.woff2";

// src/styles/fonts/IosevkaTerm-Regular.woff2
var IosevkaTerm_Regular_default = "./IosevkaTerm-Regular.yq8ahjb5.woff2";

// src/lib/fonts.ts
var FACES = [
  ["Atkinson Hyperlegible Next", atkinson_hyperlegible_next_latin_400_normal_default, "400"],
  ["Atkinson Hyperlegible Next", atkinson_hyperlegible_next_latin_500_normal_default, "500"],
  ["Atkinson Hyperlegible Next", atkinson_hyperlegible_next_latin_600_normal_default, "600"],
  ["Atkinson Hyperlegible Next", atkinson_hyperlegible_next_latin_700_normal_default, "700"],
  ["IosevkaTerm Web", IosevkaTerm_Regular_default, "400"],
  ["IosevkaTerm Web", IosevkaTerm_Bold_default, "700"]
];
function registerFonts() {
  const { FontFace } = browserWindow;
  for (const [family, url, weight] of FACES) {
    browserDocument.fonts.add(new FontFace(family, `url("${url}") format("woff2")`, { weight, display: "swap" }));
  }
}

// src/main.tsx
var jsx_runtime29 = __toESM(require_jsx_runtime(), 1);
if (browserWindow.navigator.standalone === true || browserWindow.matchMedia("(display-mode: standalone)").matches) {
  browserDocument.documentElement.dataset.standalone = "true";
}
registerFonts();
var root2 = browserDocument.getElementById("root");
if (!root2)
  throw new Error("missing #root element");
import_client.createRoot(root2).render(/* @__PURE__ */ jsx_runtime29.jsx(App, {}));
hydrateDrafts();

//# debugId=CBF8B7827E59E5A164756E2164756E21
