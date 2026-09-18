import {
  __commonJS,
  __esm,
  __export,
  __require,
  __toESM
} from "./main.5hz6q5qz.js";

// ../../node_modules/react/cjs/react.production.js
var exports_react_production = {};
__export(exports_react_production, {
  version: () => $version,
  useTransition: () => $useTransition,
  useSyncExternalStore: () => $useSyncExternalStore,
  useState: () => $useState,
  useRef: () => $useRef,
  useReducer: () => $useReducer,
  useOptimistic: () => $useOptimistic,
  useMemo: () => $useMemo,
  useLayoutEffect: () => $useLayoutEffect,
  useInsertionEffect: () => $useInsertionEffect,
  useImperativeHandle: () => $useImperativeHandle,
  useId: () => $useId,
  useEffectEvent: () => $useEffectEvent,
  useEffect: () => $useEffect,
  useDeferredValue: () => $useDeferredValue,
  useDebugValue: () => $useDebugValue,
  useContext: () => $useContext,
  useCallback: () => $useCallback,
  useActionState: () => $useActionState,
  use: () => $use,
  unstable_useCacheRefresh: () => $unstable_useCacheRefresh,
  startTransition: () => $startTransition,
  memo: () => $memo,
  lazy: () => $lazy,
  isValidElement: () => $isValidElement,
  forwardRef: () => $forwardRef,
  createRef: () => $createRef,
  createElement: () => $createElement,
  createContext: () => $createContext,
  cloneElement: () => $cloneElement,
  cacheSignal: () => $cacheSignal,
  cache: () => $cache,
  __COMPILER_RUNTIME: () => $__COMPILER_RUNTIME,
  __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: () => $__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,
  Suspense: () => $Suspense,
  StrictMode: () => $StrictMode,
  PureComponent: () => $PureComponent,
  Profiler: () => $Profiler,
  Fragment: () => $Fragment,
  Component: () => $Component,
  Children: () => $Children,
  Activity: () => $Activity
});
function getIteratorFn(maybeIterable) {
  if (maybeIterable === null || typeof maybeIterable !== "object")
    return null;
  maybeIterable = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable["@@iterator"];
  return typeof maybeIterable === "function" ? maybeIterable : null;
}
function Component(props, context, updater) {
  this.props = props;
  this.context = context;
  this.refs = emptyObject;
  this.updater = updater || ReactNoopUpdateQueue;
}
function ComponentDummy() {}
function PureComponent(props, context, updater) {
  this.props = props;
  this.context = context;
  this.refs = emptyObject;
  this.updater = updater || ReactNoopUpdateQueue;
}
function noop() {}
function ReactElement(type, key, props) {
  var refProp = props.ref;
  return {
    $$typeof: REACT_ELEMENT_TYPE,
    type,
    key,
    ref: refProp !== undefined ? refProp : null,
    props
  };
}
function cloneAndReplaceKey(oldElement, newKey) {
  return ReactElement(oldElement.type, newKey, oldElement.props);
}
function isValidElement(object) {
  return typeof object === "object" && object !== null && object.$$typeof === REACT_ELEMENT_TYPE;
}
function escape(key) {
  var escaperLookup = { "=": "=0", ":": "=2" };
  return "$" + key.replace(/[=:]/g, function(match) {
    return escaperLookup[match];
  });
}
function getElementKey(element, index) {
  return typeof element === "object" && element !== null && element.key != null ? escape("" + element.key) : index.toString(36);
}
function resolveThenable(thenable) {
  switch (thenable.status) {
    case "fulfilled":
      return thenable.value;
    case "rejected":
      throw thenable.reason;
    default:
      switch (typeof thenable.status === "string" ? thenable.then(noop, noop) : (thenable.status = "pending", thenable.then(function(fulfilledValue) {
        thenable.status === "pending" && (thenable.status = "fulfilled", thenable.value = fulfilledValue);
      }, function(error) {
        thenable.status === "pending" && (thenable.status = "rejected", thenable.reason = error);
      })), thenable.status) {
        case "fulfilled":
          return thenable.value;
        case "rejected":
          throw thenable.reason;
      }
  }
  throw thenable;
}
function mapIntoArray(children, array, escapedPrefix, nameSoFar, callback) {
  var type = typeof children;
  if (type === "undefined" || type === "boolean")
    children = null;
  var invokeCallback = false;
  if (children === null)
    invokeCallback = true;
  else
    switch (type) {
      case "bigint":
      case "string":
      case "number":
        invokeCallback = true;
        break;
      case "object":
        switch (children.$$typeof) {
          case REACT_ELEMENT_TYPE:
          case REACT_PORTAL_TYPE:
            invokeCallback = true;
            break;
          case REACT_LAZY_TYPE:
            return invokeCallback = children._init, mapIntoArray(invokeCallback(children._payload), array, escapedPrefix, nameSoFar, callback);
        }
    }
  if (invokeCallback)
    return callback = callback(children), invokeCallback = nameSoFar === "" ? "." + getElementKey(children, 0) : nameSoFar, isArrayImpl(callback) ? (escapedPrefix = "", invokeCallback != null && (escapedPrefix = invokeCallback.replace(userProvidedKeyEscapeRegex, "$&/") + "/"), mapIntoArray(callback, array, escapedPrefix, "", function(c) {
      return c;
    })) : callback != null && (isValidElement(callback) && (callback = cloneAndReplaceKey(callback, escapedPrefix + (callback.key == null || children && children.key === callback.key ? "" : ("" + callback.key).replace(userProvidedKeyEscapeRegex, "$&/") + "/") + invokeCallback)), array.push(callback)), 1;
  invokeCallback = 0;
  var nextNamePrefix = nameSoFar === "" ? "." : nameSoFar + ":";
  if (isArrayImpl(children))
    for (var i = 0;i < children.length; i++)
      nameSoFar = children[i], type = nextNamePrefix + getElementKey(nameSoFar, i), invokeCallback += mapIntoArray(nameSoFar, array, escapedPrefix, type, callback);
  else if (i = getIteratorFn(children), typeof i === "function")
    for (children = i.call(children), i = 0;!(nameSoFar = children.next()).done; )
      nameSoFar = nameSoFar.value, type = nextNamePrefix + getElementKey(nameSoFar, i++), invokeCallback += mapIntoArray(nameSoFar, array, escapedPrefix, type, callback);
  else if (type === "object") {
    if (typeof children.then === "function")
      return mapIntoArray(resolveThenable(children), array, escapedPrefix, nameSoFar, callback);
    array = String(children);
    throw Error("Objects are not valid as a React child (found: " + (array === "[object Object]" ? "object with keys {" + Object.keys(children).join(", ") + "}" : array) + "). If you meant to render a collection of children, use an array instead.");
  }
  return invokeCallback;
}
function mapChildren(children, func, context) {
  if (children == null)
    return children;
  var result = [], count = 0;
  mapIntoArray(children, result, "", "", function(child) {
    return func.call(context, child, count++);
  });
  return result;
}
function lazyInitializer(payload) {
  if (payload._status === -1) {
    var ctor = payload._result;
    ctor = ctor();
    ctor.then(function(moduleObject) {
      if (payload._status === 0 || payload._status === -1)
        payload._status = 1, payload._result = moduleObject;
    }, function(error) {
      if (payload._status === 0 || payload._status === -1)
        payload._status = 2, payload._result = error;
    });
    payload._status === -1 && (payload._status = 0, payload._result = ctor);
  }
  if (payload._status === 1)
    return payload._result.default;
  throw payload._result;
}
var REACT_ELEMENT_TYPE, REACT_PORTAL_TYPE, REACT_FRAGMENT_TYPE, REACT_STRICT_MODE_TYPE, REACT_PROFILER_TYPE, REACT_CONSUMER_TYPE, REACT_CONTEXT_TYPE, REACT_FORWARD_REF_TYPE, REACT_SUSPENSE_TYPE, REACT_MEMO_TYPE, REACT_LAZY_TYPE, REACT_ACTIVITY_TYPE, MAYBE_ITERATOR_SYMBOL, ReactNoopUpdateQueue, assign, emptyObject, pureComponentPrototype, isArrayImpl, ReactSharedInternals, hasOwnProperty, userProvidedKeyEscapeRegex, reportGlobalError, Children, $Activity, $Children, $Component, $Fragment, $Profiler, $PureComponent, $StrictMode, $Suspense, $__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, $__COMPILER_RUNTIME, $cache = function(fn) {
  return function() {
    return fn.apply(null, arguments);
  };
}, $cacheSignal = function() {
  return null;
}, $cloneElement = function(element, config, children) {
  if (element === null || element === undefined)
    throw Error("The argument must be a React element, but you passed " + element + ".");
  var props = assign({}, element.props), key = element.key;
  if (config != null)
    for (propName in config.key !== undefined && (key = "" + config.key), config)
      !hasOwnProperty.call(config, propName) || propName === "key" || propName === "__self" || propName === "__source" || propName === "ref" && config.ref === undefined || (props[propName] = config[propName]);
  var propName = arguments.length - 2;
  if (propName === 1)
    props.children = children;
  else if (1 < propName) {
    for (var childArray = Array(propName), i = 0;i < propName; i++)
      childArray[i] = arguments[i + 2];
    props.children = childArray;
  }
  return ReactElement(element.type, key, props);
}, $createContext = function(defaultValue) {
  defaultValue = {
    $$typeof: REACT_CONTEXT_TYPE,
    _currentValue: defaultValue,
    _currentValue2: defaultValue,
    _threadCount: 0,
    Provider: null,
    Consumer: null
  };
  defaultValue.Provider = defaultValue;
  defaultValue.Consumer = {
    $$typeof: REACT_CONSUMER_TYPE,
    _context: defaultValue
  };
  return defaultValue;
}, $createElement = function(type, config, children) {
  var propName, props = {}, key = null;
  if (config != null)
    for (propName in config.key !== undefined && (key = "" + config.key), config)
      hasOwnProperty.call(config, propName) && propName !== "key" && propName !== "__self" && propName !== "__source" && (props[propName] = config[propName]);
  var childrenLength = arguments.length - 2;
  if (childrenLength === 1)
    props.children = children;
  else if (1 < childrenLength) {
    for (var childArray = Array(childrenLength), i = 0;i < childrenLength; i++)
      childArray[i] = arguments[i + 2];
    props.children = childArray;
  }
  if (type && type.defaultProps)
    for (propName in childrenLength = type.defaultProps, childrenLength)
      props[propName] === undefined && (props[propName] = childrenLength[propName]);
  return ReactElement(type, key, props);
}, $createRef = function() {
  return { current: null };
}, $forwardRef = function(render) {
  return { $$typeof: REACT_FORWARD_REF_TYPE, render };
}, $isValidElement, $lazy = function(ctor) {
  return {
    $$typeof: REACT_LAZY_TYPE,
    _payload: { _status: -1, _result: ctor },
    _init: lazyInitializer
  };
}, $memo = function(type, compare) {
  return {
    $$typeof: REACT_MEMO_TYPE,
    type,
    compare: compare === undefined ? null : compare
  };
}, $startTransition = function(scope) {
  var prevTransition = ReactSharedInternals.T, currentTransition = {};
  ReactSharedInternals.T = currentTransition;
  try {
    var returnValue = scope(), onStartTransitionFinish = ReactSharedInternals.S;
    onStartTransitionFinish !== null && onStartTransitionFinish(currentTransition, returnValue);
    typeof returnValue === "object" && returnValue !== null && typeof returnValue.then === "function" && returnValue.then(noop, reportGlobalError);
  } catch (error) {
    reportGlobalError(error);
  } finally {
    prevTransition !== null && currentTransition.types !== null && (prevTransition.types = currentTransition.types), ReactSharedInternals.T = prevTransition;
  }
}, $unstable_useCacheRefresh = function() {
  return ReactSharedInternals.H.useCacheRefresh();
}, $use = function(usable) {
  return ReactSharedInternals.H.use(usable);
}, $useActionState = function(action, initialState, permalink) {
  return ReactSharedInternals.H.useActionState(action, initialState, permalink);
}, $useCallback = function(callback, deps) {
  return ReactSharedInternals.H.useCallback(callback, deps);
}, $useContext = function(Context) {
  return ReactSharedInternals.H.useContext(Context);
}, $useDebugValue = function() {}, $useDeferredValue = function(value, initialValue) {
  return ReactSharedInternals.H.useDeferredValue(value, initialValue);
}, $useEffect = function(create, deps) {
  return ReactSharedInternals.H.useEffect(create, deps);
}, $useEffectEvent = function(callback) {
  return ReactSharedInternals.H.useEffectEvent(callback);
}, $useId = function() {
  return ReactSharedInternals.H.useId();
}, $useImperativeHandle = function(ref, create, deps) {
  return ReactSharedInternals.H.useImperativeHandle(ref, create, deps);
}, $useInsertionEffect = function(create, deps) {
  return ReactSharedInternals.H.useInsertionEffect(create, deps);
}, $useLayoutEffect = function(create, deps) {
  return ReactSharedInternals.H.useLayoutEffect(create, deps);
}, $useMemo = function(create, deps) {
  return ReactSharedInternals.H.useMemo(create, deps);
}, $useOptimistic = function(passthrough, reducer) {
  return ReactSharedInternals.H.useOptimistic(passthrough, reducer);
}, $useReducer = function(reducer, initialArg, init) {
  return ReactSharedInternals.H.useReducer(reducer, initialArg, init);
}, $useRef = function(initialValue) {
  return ReactSharedInternals.H.useRef(initialValue);
}, $useState = function(initialState) {
  return ReactSharedInternals.H.useState(initialState);
}, $useSyncExternalStore = function(subscribe, getSnapshot, getServerSnapshot) {
  return ReactSharedInternals.H.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}, $useTransition = function() {
  return ReactSharedInternals.H.useTransition();
}, $version = "19.2.7";
var init_react_production = __esm(() => {
  REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element");
  REACT_PORTAL_TYPE = Symbol.for("react.portal");
  REACT_FRAGMENT_TYPE = Symbol.for("react.fragment");
  REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode");
  REACT_PROFILER_TYPE = Symbol.for("react.profiler");
  REACT_CONSUMER_TYPE = Symbol.for("react.consumer");
  REACT_CONTEXT_TYPE = Symbol.for("react.context");
  REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref");
  REACT_SUSPENSE_TYPE = Symbol.for("react.suspense");
  REACT_MEMO_TYPE = Symbol.for("react.memo");
  REACT_LAZY_TYPE = Symbol.for("react.lazy");
  REACT_ACTIVITY_TYPE = Symbol.for("react.activity");
  MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
  ReactNoopUpdateQueue = {
    isMounted: function() {
      return false;
    },
    enqueueForceUpdate: function() {},
    enqueueReplaceState: function() {},
    enqueueSetState: function() {}
  };
  assign = Object.assign;
  emptyObject = {};
  Component.prototype.isReactComponent = {};
  Component.prototype.setState = function(partialState, callback) {
    if (typeof partialState !== "object" && typeof partialState !== "function" && partialState != null)
      throw Error("takes an object of state variables to update or a function which returns an object of state variables.");
    this.updater.enqueueSetState(this, partialState, callback, "setState");
  };
  Component.prototype.forceUpdate = function(callback) {
    this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
  };
  ComponentDummy.prototype = Component.prototype;
  pureComponentPrototype = PureComponent.prototype = new ComponentDummy;
  pureComponentPrototype.constructor = PureComponent;
  assign(pureComponentPrototype, Component.prototype);
  pureComponentPrototype.isPureReactComponent = true;
  isArrayImpl = Array.isArray;
  ReactSharedInternals = { H: null, A: null, T: null, S: null };
  hasOwnProperty = Object.prototype.hasOwnProperty;
  userProvidedKeyEscapeRegex = /\/+/g;
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
  Children = {
    map: mapChildren,
    forEach: function(children, forEachFunc, forEachContext) {
      mapChildren(children, function() {
        forEachFunc.apply(this, arguments);
      }, forEachContext);
    },
    count: function(children) {
      var n = 0;
      mapChildren(children, function() {
        n++;
      });
      return n;
    },
    toArray: function(children) {
      return mapChildren(children, function(child) {
        return child;
      }) || [];
    },
    only: function(children) {
      if (!isValidElement(children))
        throw Error("React.Children.only expected to receive a single React element child.");
      return children;
    }
  };
  $Activity = REACT_ACTIVITY_TYPE;
  $Children = Children;
  $Component = Component;
  $Fragment = REACT_FRAGMENT_TYPE;
  $Profiler = REACT_PROFILER_TYPE;
  $PureComponent = PureComponent;
  $StrictMode = REACT_STRICT_MODE_TYPE;
  $Suspense = REACT_SUSPENSE_TYPE;
  $__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = ReactSharedInternals;
  $__COMPILER_RUNTIME = {
    __proto__: null,
    c: function(size) {
      return ReactSharedInternals.H.useMemoCache(size);
    }
  };
  $isValidElement = isValidElement;
});

// ../../node_modules/react/index.js
var require_react = __commonJS((exports, module) => {
  init_react_production();
  if (true) {
    module.exports = exports_react_production;
  }
});

// ../../node_modules/react/cjs/react-jsx-runtime.production.js
var exports_react_jsx_runtime_production = {};
__export(exports_react_jsx_runtime_production, {
  jsxs: () => $jsxs,
  jsx: () => $jsx,
  Fragment: () => $Fragment2
});
function jsxProd(type, config, maybeKey) {
  var key = null;
  maybeKey !== undefined && (key = "" + maybeKey);
  config.key !== undefined && (key = "" + config.key);
  if ("key" in config) {
    maybeKey = {};
    for (var propName in config)
      propName !== "key" && (maybeKey[propName] = config[propName]);
  } else
    maybeKey = config;
  config = maybeKey.ref;
  return {
    $$typeof: REACT_ELEMENT_TYPE2,
    type,
    key,
    ref: config !== undefined ? config : null,
    props: maybeKey
  };
}
var REACT_ELEMENT_TYPE2, REACT_FRAGMENT_TYPE2, $Fragment2, $jsx, $jsxs;
var init_react_jsx_runtime_production = __esm(() => {
  REACT_ELEMENT_TYPE2 = Symbol.for("react.transitional.element");
  REACT_FRAGMENT_TYPE2 = Symbol.for("react.fragment");
  $Fragment2 = REACT_FRAGMENT_TYPE2;
  $jsx = jsxProd;
  $jsxs = jsxProd;
});

// ../../node_modules/react/jsx-runtime.js
var require_jsx_runtime = __commonJS((exports, module) => {
  init_react_jsx_runtime_production();
  if (true) {
    module.exports = exports_react_jsx_runtime_production;
  }
});

// ../../node_modules/react-dom/cjs/react-dom.production.js
var exports_react_dom_production = {};
__export(exports_react_dom_production, {
  version: () => $version2,
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
  flushSync: () => $flushSync,
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
function noop2() {}
function createPortal$1(children, containerInfo, implementation) {
  var key = 3 < arguments.length && arguments[3] !== undefined ? arguments[3] : null;
  return {
    $$typeof: REACT_PORTAL_TYPE2,
    key: key == null ? null : "" + key,
    children,
    containerInfo,
    implementation
  };
}
function getCrossOriginStringAs(as, input) {
  if (as === "font")
    return "";
  if (typeof input === "string")
    return input === "use-credentials" ? input : "";
}
var React, Internals, REACT_PORTAL_TYPE2, ReactSharedInternals2, $__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, $createPortal = function(children, container) {
  var key = 2 < arguments.length && arguments[2] !== undefined ? arguments[2] : null;
  if (!container || container.nodeType !== 1 && container.nodeType !== 9 && container.nodeType !== 11)
    throw Error(formatProdErrorMessage(299));
  return createPortal$1(children, container, null, key);
}, $flushSync = function(fn) {
  var previousTransition = ReactSharedInternals2.T, previousUpdatePriority = Internals.p;
  try {
    if (ReactSharedInternals2.T = null, Internals.p = 2, fn)
      return fn();
  } finally {
    ReactSharedInternals2.T = previousTransition, Internals.p = previousUpdatePriority, Internals.d.f();
  }
}, $preconnect = function(href, options) {
  typeof href === "string" && (options ? (options = options.crossOrigin, options = typeof options === "string" ? options === "use-credentials" ? options : "" : undefined) : options = null, Internals.d.C(href, options));
}, $prefetchDNS = function(href) {
  typeof href === "string" && Internals.d.D(href);
}, $preinit = function(href, options) {
  if (typeof href === "string" && options && typeof options.as === "string") {
    var as = options.as, crossOrigin = getCrossOriginStringAs(as, options.crossOrigin), integrity = typeof options.integrity === "string" ? options.integrity : undefined, fetchPriority = typeof options.fetchPriority === "string" ? options.fetchPriority : undefined;
    as === "style" ? Internals.d.S(href, typeof options.precedence === "string" ? options.precedence : undefined, {
      crossOrigin,
      integrity,
      fetchPriority
    }) : as === "script" && Internals.d.X(href, {
      crossOrigin,
      integrity,
      fetchPriority,
      nonce: typeof options.nonce === "string" ? options.nonce : undefined
    });
  }
}, $preinitModule = function(href, options) {
  if (typeof href === "string")
    if (typeof options === "object" && options !== null) {
      if (options.as == null || options.as === "script") {
        var crossOrigin = getCrossOriginStringAs(options.as, options.crossOrigin);
        Internals.d.M(href, {
          crossOrigin,
          integrity: typeof options.integrity === "string" ? options.integrity : undefined,
          nonce: typeof options.nonce === "string" ? options.nonce : undefined
        });
      }
    } else
      options == null && Internals.d.M(href);
}, $preload = function(href, options) {
  if (typeof href === "string" && typeof options === "object" && options !== null && typeof options.as === "string") {
    var as = options.as, crossOrigin = getCrossOriginStringAs(as, options.crossOrigin);
    Internals.d.L(href, as, {
      crossOrigin,
      integrity: typeof options.integrity === "string" ? options.integrity : undefined,
      nonce: typeof options.nonce === "string" ? options.nonce : undefined,
      type: typeof options.type === "string" ? options.type : undefined,
      fetchPriority: typeof options.fetchPriority === "string" ? options.fetchPriority : undefined,
      referrerPolicy: typeof options.referrerPolicy === "string" ? options.referrerPolicy : undefined,
      imageSrcSet: typeof options.imageSrcSet === "string" ? options.imageSrcSet : undefined,
      imageSizes: typeof options.imageSizes === "string" ? options.imageSizes : undefined,
      media: typeof options.media === "string" ? options.media : undefined
    });
  }
}, $preloadModule = function(href, options) {
  if (typeof href === "string")
    if (options) {
      var crossOrigin = getCrossOriginStringAs(options.as, options.crossOrigin);
      Internals.d.m(href, {
        as: typeof options.as === "string" && options.as !== "script" ? options.as : undefined,
        crossOrigin,
        integrity: typeof options.integrity === "string" ? options.integrity : undefined
      });
    } else
      Internals.d.m(href);
}, $requestFormReset = function(form) {
  Internals.d.r(form);
}, $unstable_batchedUpdates = function(fn, a) {
  return fn(a);
}, $useFormState = function(action, initialState, permalink) {
  return ReactSharedInternals2.H.useFormState(action, initialState, permalink);
}, $useFormStatus = function() {
  return ReactSharedInternals2.H.useHostTransitionStatus();
}, $version2 = "19.2.7";
var init_react_dom_production = __esm(() => {
  React = __toESM(require_react(), 1);
  Internals = {
    d: {
      f: noop2,
      r: function() {
        throw Error(formatProdErrorMessage(522));
      },
      D: noop2,
      C: noop2,
      L: noop2,
      m: noop2,
      X: noop2,
      S: noop2,
      M: noop2
    },
    p: 0,
    findDOMNode: null
  };
  REACT_PORTAL_TYPE2 = Symbol.for("react.portal");
  ReactSharedInternals2 = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  $__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = Internals;
});

// ../../node_modules/react-dom/index.js
var require_react_dom = __commonJS((exports, module) => {
  init_react_dom_production();
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
    module.exports = exports_react_dom_production;
  }
});

// src/lib/dom.ts
var browserWindow = globalThis;
var browserDocument = browserWindow.document;
function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = browserDocument.createElement("a");
  a.href = url;
  a.download = filename;
  browserDocument.body.appendChild(a);
  a.click();
  browserDocument.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1e4);
}

// src/lib/subagent-model.ts
var EMPTY_SUBAGENT_STATE = {
  agents: new Map
};
var SUBAGENT_SUBSCRIBE_COMMAND = {
  type: "set_subagent_subscription",
  level: "progress"
};
function parentFromAgentId(id) {
  const dot = id.lastIndexOf(".");
  return dot > 0 ? id.slice(0, dot) : undefined;
}
function snapshotStatus(status) {
  switch (status) {
    case "started":
      return "running";
    case "completed":
      return "parked";
    case "failed":
      return "aborted";
    case "aborted":
      return "aborted";
  }
}
function progressSnapshotStatus(status) {
  if (status === "pending" || status === "running")
    return "running";
  return status === "completed" ? "parked" : "aborted";
}
function applyLifecycle(state, frame) {
  const p = frame.payload;
  const existing = state.agents.get(p.id);
  const now = Date.now();
  const snapshot = existing ? {
    ...existing.snapshot,
    status: snapshotStatus(p.status),
    lastActivity: now
  } : {
    id: p.id,
    displayName: p.description ?? p.agent,
    kind: "sub",
    parentId: parentFromAgentId(p.id),
    status: snapshotStatus(p.status),
    hasSessionFile: p.sessionFile !== undefined,
    createdAt: now,
    lastActivity: now
  };
  const next = new Map(state.agents);
  next.set(p.id, {
    snapshot,
    lifecycle: p,
    progress: existing?.progress
  });
  return { agents: next };
}
function applyProgress(state, frame) {
  const p = frame.payload;
  const id = p.progress.id;
  const existing = state.agents.get(id);
  const now = Date.now();
  const snapshot = existing ? {
    ...existing.snapshot,
    status: progressSnapshotStatus(p.progress.status),
    lastActivity: now
  } : {
    id,
    displayName: p.agent,
    kind: "sub",
    parentId: parentFromAgentId(id),
    status: progressSnapshotStatus(p.progress.status),
    hasSessionFile: p.sessionFile !== undefined,
    createdAt: now,
    lastActivity: now
  };
  const next = new Map(state.agents);
  next.set(id, {
    snapshot,
    lifecycle: existing?.lifecycle,
    progress: p
  });
  return { agents: next };
}
function applySubagentEvent(state, event) {
  switch (event.type) {
    case "subagent_lifecycle":
      return applyLifecycle(state, event);
    case "subagent_progress":
      return applyProgress(state, event);
    default:
      return state;
  }
}
function subagentTreeFromSnapshots(snapshots) {
  const agents = new Map;
  for (let i = 0;i < snapshots.length; i++) {
    const s = snapshots[i];
    const agentSnapshot = {
      id: s.id,
      displayName: s.description ?? s.agent,
      kind: "sub",
      parentId: parentFromAgentId(s.id),
      status: progressSnapshotStatus(s.status),
      hasSessionFile: s.sessionFile !== undefined,
      createdAt: s.lastUpdate,
      lastActivity: s.lastUpdate
    };
    agents.set(s.id, {
      snapshot: agentSnapshot,
      lifecycle: undefined,
      progress: s.progress ? {
        index: i,
        agent: s.agent,
        task: s.task ?? "",
        assignment: s.assignment,
        parentToolCallId: s.parentToolCallId,
        sessionFile: s.sessionFile,
        progress: s.progress
      } : undefined
    });
  }
  return { agents };
}
function mergeSubagentSnapshots(prev, snapshots) {
  const fresh = subagentTreeFromSnapshots(snapshots);
  const agents = new Map(fresh.agents);
  for (const [id, node] of prev.agents) {
    if (!agents.has(id) && node.snapshot.status !== "running")
      agents.set(id, node);
  }
  return { agents };
}

// src/lib/agent-hub-model.ts
var MAIN_AGENT_ID = "Main";
function agentIdLabel(id) {
  return id.split(".").join(">");
}
var EMPTY_AGENT_HUB_STATE = { agents: new Map, loaded: false };
function entryMetrics(entry) {
  const p = entry.progress;
  if (p) {
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
  return entry.metrics;
}
function applyRoster(state, entries) {
  const agents = new Map;
  for (const entry of entries)
    agents.set(entry.id, entry);
  for (const [id, prev] of state.agents) {
    if (!agents.has(id) && prev.status !== "running" && prev.kind !== "main")
      agents.set(id, prev);
  }
  return { agents, loaded: true };
}
function applyRegistryFrame(state, frame) {
  const agents = new Map(state.agents);
  if (frame.op === "removed") {
    if (!agents.delete(frame.id))
      return state;
    return { agents, loaded: state.loaded };
  }
  const prev = agents.get(frame.agent.id);
  agents.set(frame.agent.id, prev && !frame.agent.progress && prev.progress ? { ...frame.agent, progress: prev.progress } : frame.agent);
  return { agents, loaded: true };
}
function statusFromProgress(status) {
  if (status === "pending" || status === "running")
    return "running";
  return status === "completed" ? "parked" : "aborted";
}
function statusFromLifecycle(status) {
  return status === "started" ? "running" : status === "completed" ? "parked" : "aborted";
}
function newSubEntry(id, agent, now) {
  return {
    id,
    displayName: id.slice(id.lastIndexOf(".") + 1),
    kind: "sub",
    parentId: parentFromAgentId(id) ?? MAIN_AGENT_ID,
    status: "running",
    agent,
    createdAt: now,
    lastActivity: now
  };
}
function applySubagentProgress(state, payload, now = Date.now()) {
  const id = payload.progress.id;
  const prev = state.agents.get(id) ?? newSubEntry(id, payload.agent, now);
  const p = payload.progress;
  const status = p.status === "pending" || p.status === "running" ? "running" : prev.status === "idle" ? "idle" : statusFromProgress(p.status);
  const next = {
    ...prev,
    status,
    agent: prev.agent ?? payload.agent,
    description: prev.description ?? p.description,
    task: prev.task ?? payload.progress.task,
    activity: p.currentTool ?? p.lastIntent ?? prev.activity,
    sessionFile: prev.sessionFile ?? payload.sessionFile,
    lastActivity: now,
    detached: payload.detached ?? prev.detached,
    progress: p
  };
  const agents = new Map(state.agents);
  agents.set(id, next);
  return { agents, loaded: state.loaded };
}
function applySubagentLifecycle(state, payload, now = Date.now()) {
  const prev = state.agents.get(payload.id) ?? newSubEntry(payload.id, payload.agent, now);
  const status = statusFromLifecycle(payload.status);
  const agents = new Map(state.agents);
  agents.set(payload.id, {
    ...prev,
    status: status === "parked" && prev.status === "idle" ? "idle" : status,
    description: prev.description ?? payload.description,
    sessionFile: prev.sessionFile ?? payload.sessionFile,
    detached: payload.detached ?? prev.detached,
    lastActivity: now
  });
  return { agents, loaded: state.loaded };
}
function resolveParents(agents) {
  const direct = new Map;
  for (const [id, entry] of agents) {
    if (entry.kind === "main" || id === MAIN_AGENT_ID) {
      direct.set(id, undefined);
      continue;
    }
    let parent = entry.parentId ?? parentFromAgentId(id) ?? MAIN_AGENT_ID;
    if (parent === id || !agents.has(parent)) {
      const prefix = parentFromAgentId(id);
      parent = prefix !== undefined && agents.has(prefix) && prefix !== id ? prefix : MAIN_AGENT_ID;
    }
    direct.set(id, parent !== id && agents.has(parent) ? parent : undefined);
  }
  const resolved = new Map;
  for (const [id, parent] of direct) {
    let cursor = parent;
    let inCycle = false;
    for (let hops = 0;cursor !== undefined && hops <= direct.size; hops++) {
      if (cursor === id) {
        inCycle = true;
        break;
      }
      cursor = direct.get(cursor);
    }
    resolved.set(id, inCycle ? undefined : parent);
  }
  return resolved;
}
function byCreated(a, b) {
  if (a.kind !== b.kind)
    return a.kind === "main" ? -1 : 1;
  return a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
function matchesFilter(entry, query) {
  const q = query.trim().toLowerCase();
  if (q === "")
    return true;
  const hay = [
    entry.id,
    entry.displayName,
    entry.agent,
    entry.description,
    entry.task,
    entry.status,
    entry.resolvedModel
  ].filter((v) => typeof v === "string").join(`
`).toLowerCase();
  return hay.includes(q);
}
function buildHubRows(agents, opts) {
  const filter = opts.filter ?? "";
  const parents = resolveParents(agents);
  const children = new Map;
  const roots = [];
  for (const entry of agents.values()) {
    const parent = parents.get(entry.id);
    if (parent === undefined) {
      roots.push(entry);
      continue;
    }
    const list = children.get(parent);
    if (list)
      list.push(entry);
    else
      children.set(parent, [entry]);
  }
  if (!opts.tree) {
    const flat = [...agents.values()].filter((e) => matchesFilter(e, filter));
    flat.sort((a, b) => b.lastActivity - a.lastActivity || byCreated(a, b));
    return flat.map((entry) => ({
      entry,
      depth: 0,
      hasChildren: false,
      childCount: children.get(entry.id)?.length ?? 0
    }));
  }
  const visible = new Set;
  if (filter.trim() === "") {
    for (const id of agents.keys())
      visible.add(id);
  } else {
    for (const entry of agents.values()) {
      if (!matchesFilter(entry, filter))
        continue;
      for (let id = entry.id;id !== undefined && !visible.has(id); id = parents.get(id)) {
        visible.add(id);
      }
    }
  }
  roots.sort(byCreated);
  const rows = [];
  const walk = (entry, depth) => {
    if (!visible.has(entry.id))
      return;
    const kids = (children.get(entry.id) ?? []).filter((k) => visible.has(k.id)).sort(byCreated);
    rows.push({ entry, depth, hasChildren: kids.length > 0, childCount: kids.length });
    for (const kid of kids)
      walk(kid, depth + 1);
  };
  for (const root of roots)
    walk(root, 0);
  return rows;
}
function childrenOf(agents, id) {
  const parents = resolveParents(agents);
  const out = [];
  for (const entry of agents.values())
    if (parents.get(entry.id) === id)
      out.push(entry);
  return out.sort(byCreated);
}
function parentOf(agents, id) {
  const parent = resolveParents(agents).get(id);
  return parent === undefined ? undefined : agents.get(parent);
}
function computeTotals(agents) {
  const totals = {
    cost: 0,
    requests: 0,
    tools: 0,
    tokens: 0,
    counts: { running: 0, idle: 0, parked: 0, aborted: 0 }
  };
  for (const entry of agents.values()) {
    totals.counts[entry.status]++;
    const m = entryMetrics(entry);
    if (!m)
      continue;
    totals.cost += m.cost;
    totals.requests += m.requests;
    totals.tools += m.tools;
    totals.tokens += m.tokens;
  }
  return totals;
}
function emptyHubTranscript(agentId) {
  return { agentId, sessionFile: undefined, nextByte: 0, entries: [] };
}
function applyTranscriptChunk(state, chunk) {
  if (chunk.reset || state.sessionFile !== chunk.sessionFile) {
    if (chunk.fromByte !== 0) {
      return { ...state, sessionFile: undefined, nextByte: 0, fileId: undefined, sentinel: undefined };
    }
    return {
      ...state,
      sessionFile: chunk.sessionFile,
      nextByte: chunk.nextByte,
      fileId: chunk.fileId,
      sentinel: chunk.sentinel,
      entries: chunk.entries
    };
  }
  if (chunk.fromByte !== state.nextByte)
    return state;
  if (chunk.entries.length === 0 && chunk.nextByte === state.nextByte) {
    if (chunk.fileId === state.fileId && chunk.sentinel === state.sentinel)
      return state;
    return { ...state, fileId: chunk.fileId, sentinel: chunk.sentinel };
  }
  return {
    ...state,
    nextByte: chunk.nextByte,
    fileId: chunk.fileId,
    sentinel: chunk.sentinel,
    entries: [...state.entries, ...chunk.entries]
  };
}

// src/lib/format.ts
function fmtTokens(n) {
  if (!Number.isFinite(n) || n <= 0)
    return "0";
  if (n < 1000)
    return String(Math.round(n));
  if (n < 1e6) {
    const k = n / 1000;
    return `${k >= 100 ? Math.round(k) : k.toFixed(1)}k`;
  }
  const m = n / 1e6;
  return `${m >= 100 ? Math.round(m) : m.toFixed(1)}M`;
}
function fmtCost(usd) {
  if (!Number.isFinite(usd) || usd <= 0)
    return "$0.00";
  return `$${usd >= 1 ? usd.toFixed(2) : usd.toFixed(3)}`;
}
function fmtDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0)
    return "0ms";
  if (ms < 1000)
    return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 60)
    return `${s.toFixed(1)}s`;
  const min = Math.floor(s / 60);
  if (min < 60)
    return `${min}m${String(Math.round(s % 60)).padStart(2, "0")}s`;
  const h = Math.floor(min / 60);
  return `${h}h${String(min % 60).padStart(2, "0")}m`;
}
function relTime(tsMs) {
  if (!Number.isFinite(tsMs))
    return "";
  const delta = Date.now() - tsMs;
  if (delta < 1e4)
    return "now";
  const s = Math.floor(delta / 1000);
  if (s < 60)
    return `${s}s ago`;
  const min = Math.floor(s / 60);
  if (min < 60)
    return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24)
    return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// src/lib/session-actions.ts
function dataUrlToImage(url) {
  const m = /^data:([^;,]+);base64,(.+)$/.exec(url);
  return m ? { type: "image", data: m[2], mimeType: m[1] } : null;
}
function toImages(urls) {
  if (!urls || urls.length === 0)
    return;
  const out = [];
  for (const u of urls) {
    const img = dataUrlToImage(u);
    if (img)
      out.push(img);
  }
  return out.length > 0 ? out : undefined;
}
function sendPrompt(sink, text, opts) {
  return sink.request({
    type: "prompt",
    message: text,
    ...opts?.streamingBehavior ? { streamingBehavior: opts.streamingBehavior } : undefined,
    ...toImages(opts?.images) ? { images: toImages(opts?.images) } : undefined
  });
}
function steer(sink, text, images) {
  const imgs = toImages(images);
  return sink.request({ type: "steer", message: text, ...imgs ? { images: imgs } : undefined });
}
function followUp(sink, text, images) {
  const imgs = toImages(images);
  return sink.request({ type: "follow_up", message: text, ...imgs ? { images: imgs } : undefined });
}
function abortAndRestoreQueue(sink) {
  return sink.request({ type: "abort_and_restore_queue" });
}
function restoreClearedMessagesToDraft(currentDraft, cleared) {
  if (cleared.length === 0)
    return currentDraft;
  const queuedText = cleared.map((e) => e.text).filter((t) => t.trim().length > 0).join(`

`);
  const currentText = currentDraft.text ?? "";
  const combinedText = [queuedText, currentText].filter((t) => t.trim().length > 0).join(`

`);
  const restoredImages = [];
  for (const msg of cleared) {
    if (msg.images) {
      for (const img of msg.images) {
        const mime = img.mimeType || "image/png";
        restoredImages.push(`data:${mime};base64,${img.data}`);
      }
    }
  }
  const currentImages = currentDraft.images ?? [];
  const combinedImages = [...restoredImages, ...currentImages];
  return {
    text: combinedText,
    images: combinedImages
  };
}
function setModel(sink, provider, modelId, opts) {
  return sink.request({ type: "set_model", provider, modelId, ...opts });
}
function setThinkingLevel(sink, level) {
  return sink.request({ type: "set_thinking_level", level });
}
function setModelRole(sink, role, selector, opts) {
  return sink.request({ type: "set_model_role", role, selector, ...opts });
}
function deleteModelRole(sink, role) {
  return sink.request({ type: "delete_model_role", role });
}
function setCycleOrder(sink, order) {
  return sink.request({ type: "set_cycle_order", order });
}
function setModelTag(sink, model, tag) {
  return sink.request({ type: "set_model_tag", model, tag });
}
function refreshModels(sink, provider) {
  return sink.request(provider !== undefined ? { type: "refresh_models", provider } : { type: "refresh_models" });
}
function cycleRoleModel(sink, direction) {
  return sink.request(direction !== undefined ? { type: "cycle_role_model", direction } : { type: "cycle_role_model" });
}
function setAgentModel(sink, agent, selector) {
  return sink.request({ type: "set_agent_model", agent, selector });
}
function setAgentEnabled(sink, agent, enabled) {
  return sink.request({ type: "set_agent_enabled", agent, enabled });
}
function setAgentServiceTier(sink, agent, tier) {
  return sink.request({ type: "set_agent_service_tier", agent, tier });
}
function setAgentPrewalk(sink, agent, value) {
  return sink.request({ type: "set_agent_prewalk", agent, value });
}
function setAgentAdvisor(sink, agent, value) {
  return sink.request({ type: "set_agent_advisor", agent, value });
}
function loginStart(sink, providerId) {
  return sink.request({ type: "login_start", providerId });
}
function loginInput(sink, loginId, requestId, value) {
  return sink.request({ type: "login_input", loginId, requestId, value });
}
function loginCancel(sink, loginId) {
  return sink.request({ type: "login_cancel", loginId });
}
function btw(sink, question, recordId) {
  return sink.request({
    type: "btw",
    question,
    ...recordId ? { recordId } : {}
  });
}
function btwCancel(sink, recordId) {
  return sink.request({
    type: "btw_cancel",
    ...recordId ? { recordId } : {}
  });
}
function getBtwHistory(sink) {
  return sink.request({ type: "get_btw_history" });
}
function logout(sink, providerId, credentialId) {
  return sink.request({ type: "logout", providerId, credentialId });
}
function setSessionName(sink, name) {
  return sink.request({ type: "set_session_name", name });
}
function branch(sink, entryId) {
  return sink.request({ type: "branch", entryId });
}
function compact(sink, customInstructions) {
  return sink.request(customInstructions !== undefined ? { type: "compact", customInstructions } : { type: "compact" });
}
function handoff(sink, customInstructions) {
  return sink.request(customInstructions !== undefined ? { type: "handoff", customInstructions } : { type: "handoff" });
}
function newSession(sink, parentSession) {
  return sink.request(parentSession !== undefined ? { type: "new_session", parentSession } : { type: "new_session" });
}
function clearContext(sink) {
  return sink.request({ type: "prompt", message: "/clear" });
}
function retry(sink) {
  return sink.request({ type: "prompt", message: "/retry" });
}
function getUsageReports(sink, refresh) {
  return sink.request(refresh !== undefined ? { type: "get_usage_reports", refresh } : { type: "get_usage_reports" });
}
function getResetCredits(sink) {
  return sink.request({ type: "get_reset_credits" });
}
function redeemResetCredit(sink, target) {
  return sink.request({ type: "redeem_reset_credit", target });
}
function setPlanMode(sink, enabled) {
  return sink.request({ type: "set_plan_mode", enabled });
}
function approvePlan(sink, reviewId, action, feedback) {
  return sink.request(feedback !== undefined && feedback.length > 0 ? { type: "approve_plan", reviewId, action, feedback } : { type: "approve_plan", reviewId, action });
}
function killAgent(sink, agentId) {
  return sink.request({ type: "kill_agent", agentId });
}
function reviveAgent(sink, agentId) {
  return sink.request({ type: "revive_agent", agentId });
}
function steerAgent(sink, agentId, message, mode, images) {
  const imgs = toImages(images);
  return sink.request({
    type: "steer_agent",
    agentId,
    message,
    ...mode !== undefined ? { mode } : undefined,
    ...imgs ? { images: imgs } : undefined
  });
}
function interruptAgent(sink, agentId) {
  return sink.request({ type: "interrupt_agent", agentId });
}
function getSubagentMessages(sink, agentId, fromByte, fileId, sentinel) {
  return sink.request({ type: "get_subagent_messages", subagentId: agentId, fromByte, fileId, sentinel });
}

// ../utils/src/fetch-retry.ts
var {scheduler} = (() => ({}));

// ../ai/src/error/classes.ts
var MAX_ANTHROPIC_ERROR_BODY_BYTES = 64 * 1024;

// ../ai/src/error/rate-limit.ts
var QUOTA_EXHAUSTED_BACKOFF_MS = 30 * 60 * 1000;
var RATE_LIMIT_EXCEEDED_BACKOFF_MS = 30 * 1000;
var CONCURRENT_LIMIT_BACKOFF_MS = 5 * 1000;
var MODEL_CAPACITY_BASE_MS = 45 * 1000;
var MODEL_CAPACITY_JITTER_MS = 30 * 1000;
var SERVER_ERROR_BACKOFF_MS = 20 * 1000;
var LONG_RATE_LIMIT_DELAY_MS = 5 * 60 * 1000;

// ../ai/src/error/flags.ts
var Flag = {
  Class: 4096,
  ThinkingLoop: 65536,
  Transient: 131072,
  Timeout: 262144,
  UsageLimit: 524288,
  StaleResponsesItem: 1048576,
  MalformedFunctionCall: 2097152,
  ProviderFinishError: 4194304,
  EmptyResponse: 8192,
  ContentBlocked: 32768,
  AccountPolicy: 16384,
  ContextOverflow: 8388608,
  AuthFailed: 16777216,
  SilentAbort: 33554432,
  UserInterrupt: 67108864,
  Abort: 134217728,
  Grammar: 268435456,
  FastModeUnsupported: 536870912,
  OAuthExpiry: 1073741824,
  PayloadRejected: 2147483648
};
var KIND_MASK = Flag.ThinkingLoop | Flag.Transient | Flag.Timeout | Flag.UsageLimit | Flag.StaleResponsesItem | Flag.MalformedFunctionCall | Flag.ProviderFinishError | Flag.EmptyResponse | Flag.ContentBlocked | Flag.AccountPolicy | Flag.ContextOverflow | Flag.AuthFailed | Flag.PayloadRejected | Flag.SilentAbort | Flag.UserInterrupt | Flag.Abort | Flag.Grammar | Flag.FastModeUnsupported | Flag.OAuthExpiry;
var RETRIABLE_KINDS = Flag.Transient | Flag.UsageLimit | Flag.ThinkingLoop | Flag.StaleResponsesItem | Flag.ProviderFinishError | Flag.EmptyResponse;
var CONTEXT_OVERFLOW_EVIDENCE_PATTERNS = [
  /prompt is too long/i,
  /input is too long for requested model/i,
  /exceeds the context window/i,
  /input token count.*exceeds the maximum/i,
  /maximum prompt length is \d+/i,
  /reduce the length of the messages/i,
  /maximum context length is \d+ tokens/i,
  /exceeds the available context size/i,
  /\bprompt\s*\(\s*\d+\s+tokens\s*\)\s*\+\s*max\s+tokens\s*\(\s*\d+\s*\)\s+exceeds\s+the\s+context\s*\(\s*\d+\s*\)/i,
  /\bprompt\s*\(\s*\d+\s+tokens\s*\)\s+leaves\s+no\s+room\s+to\s+answer\s+in\s+the\s+context\s*\(\s*\d+\s*\)/i,
  /requested tokens?.*exceed.*context (window|length|size)/i,
  /context (window|length|size).*(exceeded|overflow|too small)/i,
  /(prompt|input).*(too long|too large).*(context|n_ctx)/i,
  /requested tokens?.*(exceeds?|greater than).*(n_ctx|context)/i,
  /greater than the context length/i,
  /context window exceeds limit/i,
  /exceeded model token limit/i,
  /context[_ ]length[_ ]exceeded/i,
  /too many tokens/i,
  /token limit exceeded/i,
  /request_too_large[^\n]*\btokens?\b/i,
  /\btokens?\b[^\n]*request_too_large/i,
  /model_context_window_exceeded/i,
  /prompt filled the context window/i,
  /exceeds the limit of \d+ tokens?\b/i,
  /chat history exceeds the \d+-message limit/i
];
var GENERIC_LIMIT_OVERFLOW_PATTERN = /exceeds the limit of \d+/i;
var OVERFLOW_PATTERNS = [...CONTEXT_OVERFLOW_EVIDENCE_PATTERNS, GENERIC_LIMIT_OVERFLOW_PATTERN];
var ERROR_KIND_LABELS = [
  [Flag.ThinkingLoop, "thinking-loop"],
  [Flag.Transient, "transient"],
  [Flag.Timeout, "timeout"],
  [Flag.UsageLimit, "usage-limit"],
  [Flag.StaleResponsesItem, "stale-responses-item"],
  [Flag.MalformedFunctionCall, "malformed-function-call"],
  [Flag.ProviderFinishError, "provider-finish-error"],
  [Flag.EmptyResponse, "empty-response"],
  [Flag.ContentBlocked, "content-blocked"],
  [Flag.AccountPolicy, "account-policy"],
  [Flag.ContextOverflow, "context-overflow"],
  [Flag.PayloadRejected, "payload-rejected"],
  [Flag.AuthFailed, "auth-failed"],
  [Flag.SilentAbort, "silent-abort"],
  [Flag.UserInterrupt, "user-interrupt"],
  [Flag.Abort, "abort"]
];
function is(id, flag) {
  return ((id ?? 0) & flag) !== 0;
}

// ../tui/src/chat/reaction.ts
var MAX_REACTION_UNITS = 32;
var REACTION_HEAD_RE = /^(?:\p{RGI_Emoji}|\p{Extended_Pictographic}\uFE0F?)/v;
var EMOJI_EXTENSION_RE = /^(?:[\p{Emoji_Modifier}\u{E0020}-\u{E007F}]|\uFE0F|\u200D|\u20E3)/u;
var REACTION_PREFIX_RE = /^(?:[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}\u{E0020}-\u{E007F}]|\uFE0F|\u200D|\u20E3)*[ \t]*$/u;
var NEXT_WHITESPACE_RE = /^[ \t]*\r?\n|^[ \t]+/;
function splitReaction(text) {
  const start = text.length - text.trimStart().length;
  const head = text.slice(start);
  if (head.length === 0) {
    return { body: text, pending: true };
  }
  const match = head.match(REACTION_HEAD_RE);
  if (match) {
    const rest = head.slice(match[0].length);
    if (head.length <= MAX_REACTION_UNITS && EMOJI_EXTENSION_RE.test(rest)) {
      return { body: text, pending: true };
    }
    const wsMatch = rest.match(NEXT_WHITESPACE_RE);
    const body = rest.slice(wsMatch ? wsMatch[0].length : 0);
    return { emoji: match[0], body, pending: false };
  }
  return { body: text, pending: head.length <= MAX_REACTION_UNITS && REACTION_PREFIX_RE.test(head) };
}

// src/lib/transcript-model.ts
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
function getBlocks(message) {
  if (typeof message === "object" && message !== null && "content" in message && Array.isArray(message.content)) {
    return [...message.content];
  }
  return [];
}
function withBlocks(message, content) {
  return {
    ...message,
    content
  };
}
function isSilentAbort(message) {
  return "errorId" in message && typeof message.errorId === "number" && is(message.errorId, Flag.SilentAbort) || "errorMessage" in message && message.errorMessage === "__omp.silent_abort__";
}
function isFailedTurn(message) {
  return "stopReason" in message && (message.stopReason === "error" || message.stopReason === "aborted") && !isSilentAbort(message);
}
function emptyTranscriptState() {
  return {
    entries: [],
    live: new Map,
    activeTools: new Map,
    working: false,
    pendingUser: [],
    needsReload: false,
    hasMore: false,
    leafId: null,
    entryKeys: new Map,
    epoch: 0
  };
}
function oldestEntryId(state) {
  return state.entries.length > 0 ? state.entries[0].id : undefined;
}
function currentLeafId(state) {
  return state.leafId;
}
function addPendingUser(state, itemOrText, images) {
  const item = typeof itemOrText === "string" ? { text: itemOrText, ...images && images.length > 0 ? { images } : {} } : itemOrText;
  return { ...state, pendingUser: [...state.pendingUser, item] };
}
function clearPendingUser(state) {
  if (state.pendingUser.length === 0)
    return state;
  return { ...state, pendingUser: state.pendingUser.slice(1) };
}
function clearAllPendingUser(state) {
  if (state.pendingUser.length === 0)
    return state;
  return { ...state, pendingUser: [] };
}
function resetTranscriptForResync(state) {
  const savedIds = new Set(state.entries.map((e) => e.id));
  const nextEntryKeys = new Map;
  for (const [id, key] of state.entryKeys) {
    if (savedIds.has(id)) {
      nextEntryKeys.set(id, key);
    }
  }
  return {
    ...state,
    epoch: (state.epoch ?? 0) + 1,
    entryKeys: nextEntryKeys,
    live: new Map,
    working: false,
    activeTools: new Map,
    pendingUser: []
  };
}
function applyHistoryPage(state, page, opts) {
  if (!opts.older) {
    const nextLive = new Map;
    if (page.live) {
      for (const item of page.live) {
        nextLive.set(item.sid, {
          message: item.message,
          frozen: false,
          epoch: state.epoch
        });
      }
    }
    if (page.after !== undefined) {
      const existingById2 = new Map;
      for (const entry of state.entries) {
        existingById2.set(entry.id, entry);
      }
      const reconciledDelta = page.entries.map((e) => existingById2.get(e.id) ?? e);
      const deltaIds = new Set(reconciledDelta.map((e) => e.id));
      const afterIdx = page.after ? state.entries.findIndex((e) => e.id === page.after) : -1;
      let nextEntries2;
      if (afterIdx !== -1) {
        const prefix = state.entries.slice(0, afterIdx + 1);
        const suffix = state.entries.slice(afterIdx + 1).filter((e) => !deltaIds.has(e.id));
        nextEntries2 = [...prefix, ...reconciledDelta, ...suffix];
      } else {
        const remaining = state.entries.filter((e) => !deltaIds.has(e.id));
        nextEntries2 = [...reconciledDelta, ...remaining];
      }
      const finalLeafId = nextEntries2.length > 0 && nextEntries2[nextEntries2.length - 1].id !== page.leafId ? nextEntries2[nextEntries2.length - 1].id : page.leafId;
      return {
        ...state,
        entries: nextEntries2,
        live: nextLive,
        leafId: finalLeafId,
        hasMore: state.hasMore,
        needsReload: false,
        working: state.working || nextLive.size > 0
      };
    }
    if (page.entries.length === 0) {
      const finalEntries2 = state.entries.length === 0 ? state.entries : [];
      const nextEntryKeys2 = finalEntries2.length === 0 && state.entryKeys.size > 0 ? new Map : state.entryKeys;
      return {
        ...state,
        entries: finalEntries2,
        entryKeys: nextEntryKeys2,
        live: nextLive,
        leafId: page.leafId,
        hasMore: page.hasMore,
        needsReload: false,
        working: state.working || nextLive.size > 0
      };
    }
    const existingById = new Map;
    for (const entry of state.entries) {
      existingById.set(entry.id, entry);
    }
    const reconciledPageEntries = page.entries.map((e) => existingById.get(e.id) ?? e);
    let connects = false;
    let matchIndex = -1;
    if (!state.needsReload && state.entries.length > 0) {
      const oldestPageEntry = page.entries[0];
      matchIndex = state.entries.findIndex((e) => e.id === oldestPageEntry.id);
      if (matchIndex !== -1) {
        if (matchIndex === 0) {
          connects = true;
        } else {
          const precedingEntry = state.entries[matchIndex - 1];
          if (oldestPageEntry.parentId === precedingEntry.id) {
            connects = true;
          }
        }
      }
    }
    let nextEntries;
    let nextHasMore;
    if (connects) {
      const olderKept = matchIndex > 0 ? state.entries.slice(0, matchIndex) : [];
      nextEntries = olderKept.length > 0 ? [...olderKept, ...reconciledPageEntries] : reconciledPageEntries;
      nextHasMore = matchIndex > 0 ? state.hasMore : page.hasMore;
    } else {
      nextEntries = reconciledPageEntries;
      nextHasMore = page.hasMore;
    }
    let finalEntries = nextEntries;
    if (nextEntries.length === state.entries.length) {
      let identical = true;
      for (let i = 0;i < nextEntries.length; i++) {
        if (nextEntries[i] !== state.entries[i]) {
          identical = false;
          break;
        }
      }
      if (identical) {
        finalEntries = state.entries;
      }
    }
    let nextEntryKeys = state.entryKeys;
    const keptIds = new Set(finalEntries.map((e) => e.id));
    let hasDropped = false;
    for (const id of state.entryKeys.keys()) {
      if (!keptIds.has(id)) {
        hasDropped = true;
        break;
      }
    }
    if (hasDropped) {
      const filtered = new Map;
      for (const [id, key] of state.entryKeys) {
        if (keptIds.has(id))
          filtered.set(id, key);
      }
      nextEntryKeys = filtered;
    }
    return {
      ...state,
      entries: finalEntries,
      entryKeys: nextEntryKeys,
      live: nextLive,
      leafId: page.leafId,
      hasMore: nextHasMore,
      needsReload: false,
      working: state.working || nextLive.size > 0
    };
  }
  if (page.entries.length === 0) {
    return {
      ...state,
      hasMore: page.hasMore
    };
  }
  const existingIds = new Set(state.entries.map((e) => e.id));
  const olderEntries = page.entries.filter((e) => !existingIds.has(e.id));
  return {
    ...state,
    entries: [...olderEntries, ...state.entries],
    hasMore: page.hasMore
  };
}
function applyV3Event(state, ev) {
  switch (ev.type) {
    case "msg_start": {
      if (ev.message.role !== "assistant") {
        return state;
      }
      const nextLive = new Map;
      for (const [sid, stream] of state.live) {
        if (!(stream.frozen && isFailedTurn(stream.message)))
          nextLive.set(sid, stream);
      }
      const content = getBlocks(ev.message);
      const message = withBlocks(ev.message, content);
      nextLive.set(ev.sid, { message, frozen: false, epoch: state.epoch });
      return { ...state, live: nextLive, working: true };
    }
    case "block_start": {
      const current = state.live.get(ev.sid);
      if (!current)
        return state;
      let blockContent;
      switch (ev.start.type) {
        case "text":
          blockContent = { type: "text", text: "" };
          break;
        case "thinking":
          blockContent = { type: "thinking", thinking: "" };
          break;
        case "redactedThinking":
          blockContent = { type: "redactedThinking", data: ev.start.data };
          break;
        case "toolCall":
          blockContent = {
            type: "toolCall",
            id: ev.start.id,
            name: ev.start.name,
            arguments: {}
          };
          break;
        default:
          return state;
      }
      const content = getBlocks(current.message);
      const existing = content[ev.block];
      if (typeof existing === "object" && existing !== null && "type" in existing && existing.type === ev.start.type) {
        return state;
      }
      if (ev.block < content.length) {
        content[ev.block] = blockContent;
      } else {
        while (content.length < ev.block) {
          content.push(null);
        }
        content.push(blockContent);
      }
      const nextMsg = withBlocks(current.message, content);
      const nextLive = new Map(state.live);
      nextLive.set(ev.sid, { ...current, message: nextMsg });
      return { ...state, live: nextLive };
    }
    case "delta": {
      const current = state.live.get(ev.sid);
      if (!current)
        return state;
      const content = getBlocks(current.message);
      if (ev.block < 0 || ev.block >= content.length) {
        return state;
      }
      const targetBlock = content[ev.block];
      if (typeof targetBlock !== "object" || targetBlock === null) {
        return state;
      }
      let updatedBlock;
      if ("type" in targetBlock && targetBlock.type === "text" && "text" in targetBlock && typeof targetBlock.text === "string") {
        updatedBlock = { ...targetBlock, text: targetBlock.text + ev.text };
      } else if ("type" in targetBlock && targetBlock.type === "thinking" && "thinking" in targetBlock && typeof targetBlock.thinking === "string") {
        updatedBlock = { ...targetBlock, thinking: targetBlock.thinking + ev.text };
      } else {
        return state;
      }
      content[ev.block] = updatedBlock;
      const nextMsg = withBlocks(current.message, content);
      const nextLive = new Map(state.live);
      nextLive.set(ev.sid, { ...current, message: nextMsg });
      return { ...state, live: nextLive };
    }
    case "block_end": {
      const current = state.live.get(ev.sid);
      if (!current)
        return state;
      const content = getBlocks(current.message);
      if (ev.block < content.length) {
        content[ev.block] = ev.content;
      } else {
        while (content.length < ev.block) {
          content.push(null);
        }
        content.push(ev.content);
      }
      const nextMsg = withBlocks(current.message, content);
      const nextLive = new Map(state.live);
      nextLive.set(ev.sid, { ...current, message: nextMsg });
      return { ...state, live: nextLive };
    }
    case "msg_end": {
      if (ev.message.role !== "assistant") {
        return state;
      }
      const nextLive = new Map(state.live);
      const current = state.live.get(ev.sid);
      nextLive.set(ev.sid, { message: ev.message, frozen: true, epoch: current?.epoch ?? state.epoch });
      return { ...state, live: nextLive };
    }
    case "entry": {
      const entryExists = state.entries.some((e) => e.id === ev.entry.id);
      const entries = entryExists ? state.entries : [...state.entries, ev.entry];
      let nextLive = state.live;
      let nextEntryKeys = state.entryKeys;
      if (ev.sid !== undefined) {
        if (state.live.has(ev.sid)) {
          const liveCopy = new Map(state.live);
          liveCopy.delete(ev.sid);
          nextLive = liveCopy;
        }
        const entryKeysCopy = new Map(state.entryKeys);
        entryKeysCopy.set(ev.entry.id, `live:${state.epoch}:${ev.sid}`);
        nextEntryKeys = entryKeysCopy;
      }
      let nextPending = state.pendingUser;
      if (ev.entry.type === "message") {
        const msg = ev.entry.message;
        if (msg.role === "user" && state.pendingUser.length > 0) {
          const entryText = extractMessageText(msg).trim();
          const matchIdx = state.pendingUser.findIndex((item) => item.text.trim() === entryText);
          if (matchIdx >= 0) {
            nextPending = [...state.pendingUser.slice(0, matchIdx), ...state.pendingUser.slice(matchIdx + 1)];
          } else {
            nextPending = state.pendingUser.slice(1);
          }
        }
      }
      let nextActiveTools = state.activeTools;
      if (ev.entry.type === "message") {
        const msg = ev.entry.message;
        if (msg.role === "toolResult" && "toolCallId" in msg && typeof msg.toolCallId === "string" && state.activeTools.has(msg.toolCallId)) {
          const activeToolsCopy = new Map(state.activeTools);
          activeToolsCopy.delete(msg.toolCallId);
          nextActiveTools = activeToolsCopy;
        }
      }
      return {
        ...state,
        entries,
        live: nextLive,
        entryKeys: nextEntryKeys,
        pendingUser: nextPending,
        activeTools: nextActiveTools,
        leafId: ev.entry.id
      };
    }
    case "branch": {
      return {
        ...state,
        leafId: ev.leafId,
        needsReload: true
      };
    }
    case "tool_output": {
      const toolResultExists = state.entries.some((e) => {
        if (e.type === "message" && e.message.role === "toolResult") {
          return "toolCallId" in e.message && e.message.toolCallId === ev.toolCallId;
        }
        return false;
      });
      if (toolResultExists)
        return state;
      const nextActiveTools = new Map(state.activeTools);
      const prev = nextActiveTools.get(ev.toolCallId);
      if (prev) {
        const prevText = typeof prev.partialResult === "string" ? prev.partialResult : "";
        nextActiveTools.set(ev.toolCallId, {
          ...prev,
          partialResult: ev.replace ? ev.text : prevText + ev.text,
          liveDetails: ev.details !== undefined ? ev.details : prev.liveDetails
        });
      } else {
        nextActiveTools.set(ev.toolCallId, {
          toolCallId: ev.toolCallId,
          toolName: "",
          args: undefined,
          partialResult: ev.text,
          liveDetails: ev.details,
          startedAt: Date.now()
        });
      }
      return { ...state, activeTools: nextActiveTools };
    }
    default:
      return state;
  }
}
function applyTranscriptEvent(state, event) {
  switch (event.type) {
    case "msg_start":
    case "block_start":
    case "delta":
    case "block_end":
    case "msg_end":
    case "entry":
    case "branch":
    case "tool_output":
      return applyV3Event(state, event);
    case "agent_start":
      return { ...state, working: true };
    case "agent_end": {
      let nextLive = state.live;
      if (state.live.size > 0) {
        const filtered = new Map;
        for (const [sid, stream] of state.live) {
          if (!stream.frozen || isFailedTurn(stream.message)) {
            filtered.set(sid, stream);
          }
        }
        if (filtered.size !== state.live.size) {
          nextLive = filtered;
        }
      }
      return { ...state, live: nextLive, working: false };
    }
    case "turn_start":
      return state;
    case "turn_end":
      return state;
    case "tool_execution_start": {
      if (!("toolCallId" in event) || typeof event.toolCallId !== "string" || !("toolName" in event) || typeof event.toolName !== "string") {
        return state;
      }
      const toolCallId = event.toolCallId;
      const toolName = event.toolName;
      const args = "args" in event ? event.args : undefined;
      const intent = "intent" in event && typeof event.intent === "string" ? event.intent : undefined;
      const next = new Map(state.activeTools);
      const existing = next.get(toolCallId);
      next.set(toolCallId, {
        toolCallId,
        toolName,
        args,
        intent,
        partialResult: existing?.partialResult,
        liveDetails: existing?.liveDetails,
        startedAt: existing?.startedAt ?? Date.now()
      });
      return { ...state, activeTools: next };
    }
    case "tool_execution_end": {
      if (!("toolCallId" in event) || typeof event.toolCallId !== "string") {
        return state;
      }
      if (!state.activeTools.has(event.toolCallId))
        return state;
      const next = new Map(state.activeTools);
      next.delete(event.toolCallId);
      return { ...state, activeTools: next };
    }
    case "command_output": {
      if (!("text" in event) || typeof event.text !== "string")
        return state;
      const text = event.text;
      const id = `cmd-out-${state.entries.length}-${Date.now()}`;
      const entry = {
        id,
        parentId: state.leafId ?? null,
        timestamp: new Date().toISOString(),
        type: "message",
        message: {
          role: "developer",
          content: text,
          timestamp: Date.now()
        }
      };
      return {
        ...state,
        entries: [...state.entries, entry],
        pendingUser: state.pendingUser.length > 0 ? state.pendingUser.slice(1) : state.pendingUser
      };
    }
    case "prompt_result": {
      if ("agentInvoked" in event && event.agentInvoked === false && state.pendingUser.length > 0) {
        return { ...state, pendingUser: state.pendingUser.slice(1) };
      }
      return state;
    }
    default:
      return state;
  }
}
var finishedEntryCache = new WeakMap;
function flattenAssistant(items, msg, results, activeTools, pending, baseId, toolCallIds, hasUserTarget = false) {
  const content = "content" in msg && Array.isArray(msg.content) ? msg.content : [];
  const openingTextIndex = content.findIndex((block) => block && typeof block === "object" && block.type === "text" && typeof block.text === "string" && block.text.length > 0);
  let reaction;
  for (let i = 0;i < content.length; i++) {
    const block = content[i];
    if (!block || typeof block !== "object")
      continue;
    switch (block.type) {
      case "thinking":
        items.push({
          kind: "thinking",
          text: typeof block.thinking === "string" ? block.thinking : "",
          redacted: false,
          id: `${baseId}-t${i}`
        });
        break;
      case "redactedThinking":
        items.push({ kind: "thinking", text: "", redacted: true, id: `${baseId}-rt${i}` });
        break;
      case "text": {
        const rawText = typeof block.text === "string" ? block.text : "";
        let displayText = rawText;
        if (i === openingTextIndex && hasUserTarget) {
          const split = splitReaction(rawText);
          if (split.emoji !== undefined) {
            reaction = split.emoji;
            displayText = split.body;
          } else if (split.pending && pending) {
            displayText = "";
          }
        }
        items.push({
          kind: "assistant-text",
          text: displayText,
          id: `${baseId}-txt${i}`
        });
        break;
      }
      case "toolCall": {
        const id = typeof block.id === "string" ? block.id : "";
        const name = typeof block.name === "string" ? block.name : "";
        if (toolCallIds && id)
          toolCallIds.push(id);
        const act = activeTools?.get(id);
        const result = results?.get(id);
        items.push({
          kind: "tool-call",
          toolCallId: id,
          name,
          args: act?.args ?? block.arguments,
          intent: (typeof block.intent === "string" ? block.intent : undefined) ?? act?.intent,
          result,
          running: !result && (act !== undefined || pending),
          partialResult: act?.partialResult,
          liveDetails: act?.liveDetails,
          startedAt: act?.startedAt,
          id: `${baseId}-tc-${id}`
        });
        break;
      }
      case "image": {
        if ("source" in block && block.source && typeof block.source === "object") {
          items.push({
            kind: "assistant-image",
            source: block.source,
            id: `${baseId}-img${i}`
          });
        }
        break;
      }
      default:
        break;
    }
  }
  const stopReason = "stopReason" in msg && typeof msg.stopReason === "string" ? msg.stopReason : undefined;
  const errorMessage = "errorMessage" in msg && typeof msg.errorMessage === "string" ? msg.errorMessage : undefined;
  if (!pending && (stopReason === "error" || stopReason === "aborted") && !isSilentAbort(msg)) {
    items.push({
      kind: "stop",
      reason: stopReason,
      errorMessage,
      id: `${baseId}-stop`
    });
  }
  return reaction;
}
function getFinishedEntryItems(entry, entryKey, results, activeTools, hasUserTarget = false) {
  const cached = finishedEntryCache.get(entry);
  if (cached !== undefined && cached.key === entryKey && cached.hasUserTarget === hasUserTarget) {
    if (cached.toolCallIds.length === 0) {
      return { items: cached.items, reaction: cached.reaction };
    }
    const hasActiveNow = cached.toolCallIds.some((id) => activeTools.has(id));
    if (!cached.hadActiveTools && !hasActiveNow) {
      let resultsMatch = true;
      for (let i = 0;i < cached.toolCallIds.length; i++) {
        if (results.get(cached.toolCallIds[i]) !== cached.resultsSnapshot[i]) {
          resultsMatch = false;
          break;
        }
      }
      if (resultsMatch) {
        return { items: cached.items, reaction: cached.reaction };
      }
    }
  }
  const items = [];
  const toolCallIds = [];
  let reaction;
  switch (entry.type) {
    case "message": {
      const msg = entry.message;
      switch (msg.role) {
        case "user": {
          const userContent = msg.content;
          items.push({
            kind: "user",
            content: userContent,
            timestamp: entry.timestamp,
            id: entryKey,
            entryId: entry.id
          });
          break;
        }
        case "assistant": {
          reaction = flattenAssistant(items, msg, results, activeTools, false, entryKey, toolCallIds, hasUserTarget);
          break;
        }
        case "developer": {
          const devMsg = msg;
          const devContent = typeof devMsg.content === "string" ? devMsg.content : Array.isArray(devMsg.content) ? devMsg.content.map((b) => typeof b === "object" && b && ("text" in b) ? String(b.text) : "").join("") : "";
          items.push({
            kind: "developer",
            content: devContent,
            timestamp: entry.timestamp,
            id: entryKey
          });
          break;
        }
      }
      break;
    }
    case "compaction": {
      items.push({
        kind: "divider",
        label: `context compacted -- ${fmtTokens(entry.tokensBefore)} tokens`,
        detail: entry.shortSummary ?? entry.summary,
        id: entryKey
      });
      break;
    }
    case "branch_summary": {
      items.push({
        kind: "divider",
        label: "branch summary",
        detail: entry.summary,
        id: entryKey
      });
      break;
    }
    case "model_change": {
      items.push({
        kind: "marker",
        text: `model: ${entry.model}`,
        id: entryKey
      });
      break;
    }
    case "thinking_level_change": {
      items.push({
        kind: "marker",
        text: `thinking: ${entry.thinkingLevel ?? "off"}`,
        id: entryKey
      });
      break;
    }
    case "ttsr_injection": {
      items.push({
        kind: "marker",
        text: `rules: ${entry.injectedRules.join(", ")}`,
        id: entryKey
      });
      break;
    }
    case "custom_message": {
      if (entry.customType !== "ttsr-injection")
        break;
      const details = entry.details;
      const rules = details && typeof details === "object" && "rules" in details && Array.isArray(details.rules) ? details.rules.filter((r) => typeof r === "string") : [];
      items.push({
        kind: "developer",
        label: `rule interrupt: ${rules.join(", ")}`,
        content: typeof entry.content === "string" ? entry.content : entry.content.map((block) => block.type === "text" ? block.text : "").join(""),
        timestamp: entry.timestamp,
        id: entryKey
      });
      break;
    }
  }
  const hadActiveTools = toolCallIds.some((id) => activeTools.has(id));
  const resultsSnapshot = toolCallIds.map((id) => results.get(id));
  finishedEntryCache.set(entry, {
    key: entryKey,
    items,
    toolCallIds,
    resultsSnapshot,
    hadActiveTools,
    hasUserTarget,
    reaction
  });
  return { items, reaction };
}
function coalesceTodoRuns(items) {
  const out = [];
  let currentTodo = null;
  let pendingThinking = [];
  const flushGroup = () => {
    if (currentTodo !== null) {
      out.push(currentTodo);
      currentTodo = null;
    }
    if (pendingThinking.length > 0) {
      for (const t of pendingThinking)
        out.push(t);
      pendingThinking = [];
    }
  };
  for (const item of items) {
    if (item.kind === "tool-call" && item.name === "todo") {
      if (currentTodo === null) {
        if (pendingThinking.length > 0) {
          for (const t of pendingThinking)
            out.push(t);
          pendingThinking = [];
        }
        currentTodo = {
          ...item,
          groupCount: 1
        };
      } else {
        pendingThinking = [];
        currentTodo = {
          ...item,
          id: currentTodo.id,
          groupCount: (currentTodo.groupCount ?? 1) + 1
        };
      }
    } else if (item.kind === "thinking") {
      if (currentTodo !== null) {
        pendingThinking.push(item);
      } else {
        out.push(item);
      }
    } else {
      flushGroup();
      out.push(item);
    }
  }
  flushGroup();
  return out;
}
function flattenEntries(entries, results, activeTools, live, working, pendingUser, entryKeys, epoch = 0) {
  const items = [];
  const renderedToolIds = new Set;
  let lastUserItemIndex = -1;
  let hasSeenAssistantSinceUser = false;
  let prevEntry;
  for (const entry of entries) {
    const followsInterrupt = entry.type === "ttsr_injection" && prevEntry?.type === "custom_message" && prevEntry.customType === "ttsr-injection";
    prevEntry = entry;
    if (followsInterrupt)
      continue;
    const entryKey = entryKeys.get(entry.id) ?? entry.id;
    let hasUserTarget = false;
    if (entry.type === "message" && entry.message.role === "assistant") {
      if (lastUserItemIndex !== -1 && !hasSeenAssistantSinceUser) {
        hasUserTarget = true;
        hasSeenAssistantSinceUser = true;
      }
    }
    const { items: entryItems, reaction } = getFinishedEntryItems(entry, entryKey, results, activeTools, hasUserTarget);
    if (reaction !== undefined && lastUserItemIndex !== -1) {
      const targetUser = items[lastUserItemIndex];
      items[lastUserItemIndex] = { ...targetUser, reaction };
    }
    for (const item of entryItems) {
      items.push(item);
      if (item.kind === "user") {
        lastUserItemIndex = items.length - 1;
        hasSeenAssistantSinceUser = false;
      }
      if (item.kind === "tool-call") {
        renderedToolIds.add(item.toolCallId);
      }
    }
  }
  if (live.size > 0) {
    const sortedLive = Array.from(live.entries()).sort(([a], [b]) => a - b);
    for (const [sid, stream] of sortedLive) {
      const streamEpoch = stream.epoch ?? epoch;
      const baseId = `live:${streamEpoch}:${sid}`;
      let hasUserTarget = false;
      if (lastUserItemIndex !== -1 && !hasSeenAssistantSinceUser) {
        hasUserTarget = true;
        hasSeenAssistantSinceUser = true;
      }
      const reaction = flattenAssistant(items, stream.message, results, activeTools, !stream.frozen, baseId, undefined, hasUserTarget);
      if (reaction !== undefined && lastUserItemIndex !== -1) {
        const targetUser = items[lastUserItemIndex];
        items[lastUserItemIndex] = { ...targetUser, reaction };
      }
    }
  }
  for (const item of items) {
    if (item.kind === "tool-call")
      renderedToolIds.add(item.toolCallId);
  }
  for (const tool of activeTools.values()) {
    if (!renderedToolIds.has(tool.toolCallId)) {
      items.push({
        kind: "tool-call",
        toolCallId: tool.toolCallId,
        name: tool.toolName,
        args: tool.args,
        intent: tool.intent,
        running: true,
        partialResult: tool.partialResult,
        liveDetails: tool.liveDetails,
        startedAt: tool.startedAt,
        id: `tail-${tool.toolCallId}`
      });
    }
  }
  for (let i = 0;i < pendingUser.length; i++) {
    const pendingItem = pendingUser[i];
    let content;
    if (pendingItem.images && pendingItem.images.length > 0) {
      const parts = [];
      if (pendingItem.text.length > 0) {
        parts.push({ type: "text", text: pendingItem.text });
      }
      for (const imgUrl of pendingItem.images) {
        const img = dataUrlToImage(imgUrl);
        if (img)
          parts.push(img);
      }
      content = parts;
    } else {
      content = pendingItem.text;
    }
    items.push({ kind: "user", content, timestamp: "", id: `pending-${i}`, pending: true });
  }
  if ((working || pendingUser.length > 0) && live.size === 0 && activeTools.size === 0) {
    items.push({ kind: "shimmer", id: "shimmer" });
  }
  return coalesceTodoRuns(items);
}
function extractToolResults(entries) {
  const map = new Map;
  for (const entry of entries) {
    if (entry.type === "message" && entry.message.role === "toolResult") {
      const tr = entry.message;
      map.set(tr.toolCallId, tr);
    }
  }
  return map;
}

// src/lib/focus-model.ts
function startFocus(agentId, seq, running) {
  return {
    agentId,
    seq,
    cursor: emptyHubTranscript(agentId),
    transcript: { ...emptyTranscriptState(), working: running },
    loaded: false,
    nextSid: 1
  };
}
function resetFocusCursor(state) {
  return { ...state, cursor: emptyHubTranscript(state.agentId) };
}
function fieldOf(value, key) {
  if (typeof value !== "object" || value === null || !(key in value))
    return;
  const record = { ...value };
  return record[key];
}
function textOf(content, separator) {
  if (typeof content === "string")
    return content;
  if (!Array.isArray(content))
    return "";
  const parts = [];
  for (const block of content) {
    const text = fieldOf(block, "text");
    if (fieldOf(block, "type") === "text" && typeof text === "string")
      parts.push(text);
  }
  return parts.join(separator);
}
function messageText(message) {
  return textOf(fieldOf(message, "content"), `
`);
}
function dropSettledPending(pending, added) {
  let next = pending;
  for (const entry of added) {
    if (next.length === 0)
      break;
    if (entry.type !== "message" || entry.message.role !== "user")
      continue;
    const text = messageText(entry.message).trim();
    const at = next.findIndex((p) => p.text.trim() === text);
    next = at >= 0 ? [...next.slice(0, at), ...next.slice(at + 1)] : next.slice(1);
  }
  return next;
}
function dropSavedLive(live) {
  let out;
  for (const [sid, stream] of live) {
    if (!stream.frozen)
      continue;
    const stopReason = fieldOf(stream.message, "stopReason");
    if (stopReason === "error" || stopReason === "aborted")
      continue;
    out ??= new Map(live);
    out.delete(sid);
  }
  return out ?? live;
}
function applyFocusChunk(state, chunk) {
  const cursor = applyTranscriptChunk(state.cursor, chunk);
  if (cursor === state.cursor)
    return state.loaded ? state : { ...state, loaded: true };
  const entries = cursor.entries.filter((e) => e.type !== "session");
  const before = state.transcript.entries;
  const replaced = entries.length < before.length || before.length > 0 && entries[0]?.id !== before[0]?.id;
  const added = replaced ? entries : entries.slice(before.length);
  const grew = added.length > 0 || replaced;
  return {
    ...state,
    cursor,
    loaded: true,
    transcript: grew ? {
      ...state.transcript,
      entries,
      live: dropSavedLive(state.transcript.live),
      pendingUser: dropSettledPending(state.transcript.pendingUser, added)
    } : state.transcript
  };
}
function toolText(partial) {
  return typeof partial === "string" ? partial : textOf(fieldOf(partial, "content"), "");
}
function replaceLiveAssistant(state, message) {
  const t = state.transcript;
  let liveSid;
  for (const [sid, stream] of t.live)
    if (!stream.frozen)
      liveSid = sid;
  if (liveSid === undefined) {
    const sid = state.nextSid;
    const started = applyV3Event(t, { type: "msg_start", sid, message });
    return { ...state, nextSid: sid + 1, transcript: started };
  }
  const live = new Map(t.live);
  live.set(liveSid, { ...t.live.get(liveSid), message });
  return { ...state, transcript: { ...t, live, working: true } };
}
function applyFocusEvent(state, event) {
  const t = state.transcript;
  switch (event.type) {
    case "message_start": {
      if (event.message.role !== "assistant")
        return state;
      const sid = state.nextSid;
      return {
        ...state,
        nextSid: sid + 1,
        transcript: applyV3Event(t, { type: "msg_start", sid, message: event.message })
      };
    }
    case "message_update": {
      if (event.message.role !== "assistant")
        return state;
      return replaceLiveAssistant(state, event.message);
    }
    case "message_end": {
      if (event.message.role !== "assistant")
        return state;
      let liveSid;
      for (const [sid, stream] of t.live)
        if (!stream.frozen)
          liveSid = sid;
      if (liveSid === undefined)
        return state;
      return { ...state, transcript: applyV3Event(t, { type: "msg_end", sid: liveSid, message: event.message }) };
    }
    case "tool_execution_update": {
      const base = t.activeTools.has(event.toolCallId) ? t : applyTranscriptEvent(t, {
        type: "tool_execution_start",
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        args: event.args
      });
      return {
        ...state,
        transcript: applyV3Event(base, {
          type: "tool_output",
          toolCallId: event.toolCallId,
          text: toolText(event.partialResult),
          replace: true,
          details: fieldOf(event.partialResult, "details")
        })
      };
    }
    case "tool_execution_start": {
      const hasResult = t.entries.some((e) => e.type === "message" && e.message.role === "toolResult" && ("toolCallId" in e.message) && e.message.toolCallId === event.toolCallId);
      if (hasResult)
        return state;
      return { ...state, transcript: applyTranscriptEvent(t, event) };
    }
    case "tool_execution_end":
    case "agent_start":
      return { ...state, transcript: applyTranscriptEvent(t, event) };
    case "agent_end":
      return { ...state, transcript: { ...t, working: false, activeTools: new Map } };
    default:
      return state;
  }
}
function applyFocusSnapshot(state, snapshot) {
  let next = state;
  if (snapshot.streamMessage)
    next = replaceLiveAssistant(next, snapshot.streamMessage);
  if (snapshot.activeToolStarts) {
    for (const start of snapshot.activeToolStarts)
      next = applyFocusEvent(next, start);
  }
  for (const update of snapshot.activeToolUpdates)
    next = applyFocusEvent(next, update);
  return next;
}
function eventPersistsEntries(event) {
  return event.type === "message_end" || event.type === "tool_execution_end" || event.type === "turn_end" || event.type === "agent_end";
}
function isFocusable(entry) {
  if (!entry || entry.id === MAIN_AGENT_ID || entry.kind !== "sub")
    return false;
  return entry.status !== "aborted";
}
function initialFocusWatch(entry) {
  return { sawLive: entry?.status === "running" || entry?.status === "idle" };
}
function watchFocusedAgent(watch, entry) {
  if (!entry)
    return { watch, detach: "gone" };
  if (entry.status === "aborted")
    return { watch, detach: "aborted" };
  if (entry.status === "parked")
    return { watch, detach: watch.sawLive ? "parked" : null };
  return { watch: watch.sawLive ? watch : { sawLive: true }, detach: null };
}
function detachMessage(agentId, reason) {
  return `Agent ${agentId} is ${reason}; returned to main session`;
}
function viewingMessage(agentId) {
  return `Viewing agent ${agentId}`;
}
var FOCUSED_VIEW_COMMANDS = ["export", "usage"];
var FOCUSED_REFUSAL = `Only ${FOCUSED_VIEW_COMMANDS.map((n) => `/${n}`).join(", ")} run here; other commands run in the main session, press Esc to return first`;
function gateFocusedSubmit(text) {
  if (text.startsWith("/")) {
    const match = /^\/(\S+)(?:\s+(.*))?$/s.exec(text);
    const name = match?.[1];
    const args = (match?.[2] ?? "").trim();
    if (name === "usage" && (args === "" || args === "show"))
      return { kind: "usage" };
    if (name === "export")
      return { kind: "export" };
    return { kind: "refuse", message: FOCUSED_REFUSAL };
  }
  if (text.startsWith("!"))
    return { kind: "refuse", message: FOCUSED_REFUSAL };
  return { kind: "send" };
}
function escapeAction(text, imageCount) {
  return text.length > 0 || imageCount > 0 ? "clear" : "exit";
}

// src/lib/notify.ts
var nextId = 1;
var notices = [];
var listeners = new Set;
function emit() {
  for (const fn of listeners)
    fn();
}
function notify(kind, message) {
  if (notices.some((n) => n.kind === kind && n.message === message))
    return;
  const trimmed = notices.length >= 3 ? notices.slice(notices.length - 2) : notices;
  notices = [...trimmed, { id: nextId++, kind, message }];
  emit();
}
function subscribeNotices(fn) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
function getNotices() {
  return notices;
}
function dismissNotice(id) {
  notices = notices.filter((n) => n.id !== id);
  emit();
}

// ../../node_modules/lucide-react/dist/esm/createLucideIcon.mjs
var import_react3 = __toESM(require_react(), 1);

// ../../node_modules/lucide-react/dist/esm/shared/src/utils/toKebabCase.mjs
var toKebabCase = (string) => string?.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

// ../../node_modules/lucide-react/dist/esm/shared/src/utils/toLucideIconData.mjs
function toLucideIconData(iconName, iconNode, aliases = []) {
  if (iconNode == null) {
    throw new Error("[lucide]: iconNode is required when icon name is used");
  }
  return {
    name: toKebabCase(iconName),
    size: 24,
    node: iconNode,
    ...aliases.length > 0 ? { aliases } : {}
  };
}

// ../../node_modules/lucide-react/dist/esm/shared/src/utils/toCamelCase.mjs
var toCamelCase = (string) => {
  let out = "";
  let upperNext = false;
  for (const ch of string) {
    if (ch === "-" || ch === "_" || ch <= " ") {
      upperNext = out.length > 0;
      continue;
    }
    if (out.length === 0) {
      out += ch.toLowerCase();
    } else {
      out += upperNext ? ch.toUpperCase() : ch;
    }
    upperNext = false;
  }
  return out;
};

// ../../node_modules/lucide-react/dist/esm/shared/src/utils/toPascalCase.mjs
var toPascalCase = (string) => {
  const camelCase = toCamelCase(string);
  return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
};

// ../../node_modules/lucide-react/dist/esm/Icon.mjs
var import_react2 = __toESM(require_react(), 1);

// ../../node_modules/lucide-react/dist/esm/shared/src/utils/mergeClasses.mjs
var mergeClasses = (...classes) => classes.filter((className, index, array) => {
  return Boolean(className) && className.trim() !== "" && array.indexOf(className) === index;
}).join(" ").trim();

// ../../node_modules/lucide-react/dist/esm/shared/src/build/defaultAttributes.mjs
var defaultAttributes = {
  xmlns: "http://www.w3.org/2000/svg",
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": 2,
  "stroke-linecap": "round",
  "stroke-linejoin": "round"
};

// ../../node_modules/lucide-react/dist/esm/shared/src/build/buildLucideIconNode.mjs
function isDefined(value) {
  return value !== null && value !== undefined;
}
function buildLucideIconNode(icon, params = {}) {
  const attributeNames = params.attributeNames ?? {};
  const getAttributeName = (attributeName) => attributeNames[attributeName] ?? attributeName;
  const viewBoxWidth = icon.size ?? icon.width ?? defaultAttributes["width"];
  const viewBoxHeight = icon.size ?? icon.height ?? defaultAttributes["height"];
  const aliasClassNames = icon.aliases?.filter((alias) => typeof alias === "string" && alias.trim() !== "").map((alias) => `lucide-${alias}`) ?? [];
  const iconClassNames = [...icon.name ? [`lucide-${icon.name}`] : [], ...aliasClassNames];
  const classNamesFromClassName = params.className?.split(" ").filter(Boolean) ?? [];
  const className = params.includeDefaultClasses === false ? mergeClasses(...classNamesFromClassName) : mergeClasses("lucide", ...iconClassNames, ...classNamesFromClassName);
  const calculatedStrokeWidth = params.absoluteStrokeWidth ? Number(params.strokeWidth ?? defaultAttributes["stroke-width"]) * Number(icon.size ?? icon.width ?? defaultAttributes["width"]) / Number(params.size ?? params.width ?? defaultAttributes["width"]) : params.strokeWidth ?? defaultAttributes["stroke-width"];
  const attributes = {
    ...Object.entries(defaultAttributes).reduce((attrs, [attrName, value]) => {
      attrs[getAttributeName(attrName)] = value;
      return attrs;
    }, {}),
    ..."color" in params && params.color && {
      [getAttributeName("stroke")]: params.color
    },
    ..."size" in params && isDefined(params.size) && {
      [getAttributeName("width")]: params.size,
      [getAttributeName("height")]: params.size
    },
    ..."width" in params && isDefined(params.width) && {
      [getAttributeName("width")]: params.width
    },
    ..."height" in params && isDefined(params.height) && {
      [getAttributeName("height")]: params.height
    },
    [getAttributeName("stroke-width")]: calculatedStrokeWidth,
    ...className && {
      [getAttributeName("class")]: className
    },
    [getAttributeName("viewBox")]: `0 0 ${viewBoxWidth} ${viewBoxHeight}`,
    ...params.hasA11yProp === false ? {
      [getAttributeName("aria-hidden")]: "true"
    } : {},
    ..."attributes" in params && params.attributes
  };
  return [
    "svg",
    attributes,
    icon.node.map((child) => {
      const [name, attrs, children] = child;
      const nextAttrs = params.nonScalingStroke ? { [getAttributeName("vector-effect")]: "non-scaling-stroke", ...attrs } : attrs;
      return children ? [name, nextAttrs, children] : [name, nextAttrs];
    })
  ];
}

// ../../node_modules/lucide-react/dist/esm/shared/src/build/buildLucideIconForReact.mjs
function buildLucideIconForReact(icon, params = {}) {
  return buildLucideIconNode(icon, {
    ...params,
    attributeNames: {
      ...params.attributeNames,
      class: "className",
      "stroke-width": "strokeWidth",
      "stroke-linecap": "strokeLinecap",
      "stroke-linejoin": "strokeLinejoin",
      "vector-effect": "vectorEffect"
    }
  });
}

// ../../node_modules/lucide-react/dist/esm/shared/src/utils/hasA11yProp.mjs
var hasA11yProp = (props) => {
  for (const prop in props) {
    if (prop.startsWith("aria-") || prop === "role" || prop === "title") {
      return true;
    }
  }
  return false;
};

// ../../node_modules/lucide-react/dist/esm/context.mjs
var import_react = __toESM(require_react(), 1);
"use client";
var LucideContext = import_react.createContext({});
var useLucideContext = () => import_react.useContext(LucideContext);

// ../../node_modules/lucide-react/dist/esm/Icon.mjs
"use client";
var Icon = import_react2.forwardRef(({
  color,
  size,
  width,
  height,
  strokeWidth,
  absoluteStrokeWidth,
  nonScalingStroke,
  className = "",
  children,
  iconNode = [],
  icon = {
    node: iconNode,
    aliases: [],
    size: 24
  },
  ...rest
}, ref) => {
  const {
    size: contextSize = 24,
    strokeWidth: contextStrokeWidth = 2,
    absoluteStrokeWidth: contextAbsoluteStrokeWidth = false,
    nonScalingStroke: contextNonScalingStroke = false,
    color: contextColor = "currentColor",
    className: contextClass = ""
  } = useLucideContext() ?? {};
  const hasAccessibleProp = Boolean(children) || hasA11yProp(rest);
  const [name, svgAttributes, builtIconNode = []] = buildLucideIconForReact(icon, {
    color: color ?? contextColor,
    width: width ?? size ?? contextSize,
    height: height ?? size ?? contextSize,
    strokeWidth: strokeWidth ?? contextStrokeWidth,
    absoluteStrokeWidth: absoluteStrokeWidth ?? contextAbsoluteStrokeWidth,
    nonScalingStroke: nonScalingStroke ?? contextNonScalingStroke,
    className: mergeClasses(contextClass, className),
    hasA11yProp: hasAccessibleProp,
    attributes: rest
  });
  return import_react2.createElement(name, {
    ref,
    ...svgAttributes
  }, [
    ...builtIconNode.map(([tag, attrs]) => import_react2.createElement(tag, attrs)),
    ...Array.isArray(children) ? children : [children]
  ]);
});

// ../../node_modules/lucide-react/dist/esm/createLucideIcon.mjs
function createLucideIcon(iconDataOrName, iconNode = [], aliases = []) {
  const iconData = typeof iconDataOrName === "string" ? toLucideIconData(iconDataOrName, iconNode, aliases) : iconDataOrName;
  const Component2 = import_react3.forwardRef(({ className, ...props }, ref) => import_react3.createElement(Icon, {
    ref,
    icon: iconData,
    className,
    ...props
  }));
  if (iconData.name) {
    Component2.displayName = toPascalCase(iconData.name);
  }
  return Component2;
}

// ../../node_modules/lucide-react/dist/esm/icons/x.mjs
var __iconData = {
  name: "x",
  size: 24,
  node: [
    ["path", { d: "M18 6 6 18", key: "1bl5f8" }],
    ["path", { d: "m6 6 12 12", key: "d8bk6v" }]
  ]
};
__iconData.node;
var X = createLucideIcon(__iconData);
// ../../node_modules/lucide-react/dist/esm/icons/ellipsis-vertical.mjs
var __iconData2 = {
  name: "ellipsis-vertical",
  size: 24,
  node: [
    ["circle", { cx: "12", cy: "12", r: "1", key: "41hilf" }],
    ["circle", { cx: "12", cy: "5", r: "1", key: "gxeob9" }],
    ["circle", { cx: "12", cy: "19", r: "1", key: "lyex9k" }]
  ],
  aliases: ["more-vertical"]
};
__iconData2.node;
var EllipsisVertical = createLucideIcon(__iconData2);
// ../../node_modules/lucide-react/dist/esm/icons/panel-left.mjs
var __iconData3 = {
  name: "panel-left",
  size: 24,
  node: [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M9 3v18", key: "fh3hqa" }]
  ],
  aliases: ["sidebar"]
};
__iconData3.node;
var PanelLeft = createLucideIcon(__iconData3);
// ../../node_modules/lucide-react/dist/esm/icons/rotate-ccw-clock.mjs
var __iconData4 = {
  name: "rotate-ccw-clock",
  size: 24,
  node: [
    ["path", { d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8", key: "1357e3" }],
    ["path", { d: "M3 3v5h5", key: "1xhq8a" }],
    ["path", { d: "M12 7v5l4 2", key: "1fdv2h" }]
  ],
  aliases: ["history"]
};
__iconData4.node;
var RotateCcwClock = createLucideIcon(__iconData4);
// ../../node_modules/lucide-react/dist/esm/icons/trash.mjs
var __iconData5 = {
  name: "trash",
  size: 24,
  node: [
    ["path", { d: "M10 11v6", key: "nco0om" }],
    ["path", { d: "M14 11v6", key: "outv1u" }],
    ["path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6", key: "miytrc" }],
    ["path", { d: "M3 6h18", key: "d0wm0j" }],
    ["path", { d: "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2", key: "e791ji" }]
  ],
  aliases: ["trash-2"]
};
__iconData5.node;
var Trash = createLucideIcon(__iconData5);
// ../../node_modules/lucide-react/dist/esm/icons/arrow-down.mjs
var __iconData6 = {
  name: "arrow-down",
  size: 24,
  node: [
    ["path", { d: "M12 5v14", key: "s699le" }],
    ["path", { d: "m19 12-7 7-7-7", key: "1idqje" }]
  ]
};
__iconData6.node;
var ArrowDown = createLucideIcon(__iconData6);
// ../../node_modules/lucide-react/dist/esm/icons/bot.mjs
var __iconData7 = {
  name: "bot",
  size: 24,
  node: [
    ["path", { d: "M12 8V4H8", key: "hb8ula" }],
    ["rect", { width: "16", height: "12", x: "4", y: "8", rx: "2", key: "enze0r" }],
    ["path", { d: "M2 14h2", key: "vft8re" }],
    ["path", { d: "M20 14h2", key: "4cs60a" }],
    ["path", { d: "M15 13v2", key: "1xurst" }],
    ["path", { d: "M9 13v2", key: "rq6x2g" }]
  ]
};
__iconData7.node;
var Bot = createLucideIcon(__iconData7);
// ../../node_modules/lucide-react/dist/esm/icons/check.mjs
var __iconData8 = {
  name: "check",
  size: 24,
  node: [["path", { d: "M20 6 9 17l-5-5", key: "1gmf2c" }]]
};
__iconData8.node;
var Check = createLucideIcon(__iconData8);
// ../../node_modules/lucide-react/dist/esm/icons/chevron-down.mjs
var __iconData9 = {
  name: "chevron-down",
  size: 24,
  node: [["path", { d: "m6 9 6 6 6-6", key: "qrunsl" }]]
};
__iconData9.node;
var ChevronDown = createLucideIcon(__iconData9);
// ../../node_modules/lucide-react/dist/esm/icons/chevron-left.mjs
var __iconData10 = {
  name: "chevron-left",
  size: 24,
  node: [["path", { d: "m15 18-6-6 6-6", key: "1wnfg3" }]]
};
__iconData10.node;
var ChevronLeft = createLucideIcon(__iconData10);
// ../../node_modules/lucide-react/dist/esm/icons/chevron-right.mjs
var __iconData11 = {
  name: "chevron-right",
  size: 24,
  node: [["path", { d: "m9 18 6-6-6-6", key: "mthhwq" }]]
};
__iconData11.node;
var ChevronRight = createLucideIcon(__iconData11);
// ../../node_modules/lucide-react/dist/esm/icons/chevron-up.mjs
var __iconData12 = {
  name: "chevron-up",
  size: 24,
  node: [["path", { d: "m18 15-6-6-6 6", key: "153udz" }]]
};
__iconData12.node;
var ChevronUp = createLucideIcon(__iconData12);
// ../../node_modules/lucide-react/dist/esm/icons/copy.mjs
var __iconData13 = {
  name: "copy",
  size: 24,
  node: [
    ["rect", { width: "14", height: "14", x: "8", y: "8", rx: "2", ry: "2", key: "17jyea" }],
    ["path", { d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2", key: "zix9uf" }]
  ]
};
__iconData13.node;
var Copy = createLucideIcon(__iconData13);
// ../../node_modules/lucide-react/dist/esm/icons/ghost.mjs
var __iconData14 = {
  name: "ghost",
  size: 24,
  node: [
    ["path", { d: "M15 10v1", key: "oj8wfp" }],
    [
      "path",
      {
        d: "M7.528 20.472a1.6 1.6 0 012.277 0l1.057 1.056a1.6 1.6 0 002.276 0l1.057-1.056a1.6 1.6 0 012.277 0l1.114 1.114a1.4 1.4 0 002.414-1V10a8 8 0 00-16 0v10.586a1.4 1.4 0 002.414 1z",
        key: "13lou3"
      }
    ],
    ["path", { d: "M9 10v1", key: "1e14fa" }]
  ]
};
__iconData14.node;
var Ghost = createLucideIcon(__iconData14);
// ../../node_modules/lucide-react/dist/esm/icons/info.mjs
var __iconData15 = {
  name: "info",
  size: 24,
  node: [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "M12 16v-4", key: "1dtifu" }],
    ["path", { d: "M12 8h.01", key: "e9boi3" }]
  ]
};
__iconData15.node;
var Info = createLucideIcon(__iconData15);
// ../../node_modules/lucide-react/dist/esm/icons/lock.mjs
var __iconData16 = {
  name: "lock",
  size: 24,
  node: [
    ["rect", { width: "18", height: "11", x: "3", y: "11", rx: "2", ry: "2", key: "1w4ew1" }],
    ["path", { d: "M7 11V7a5 5 0 0 1 10 0v4", key: "fwvmzm" }]
  ]
};
__iconData16.node;
var Lock = createLucideIcon(__iconData16);
// ../../node_modules/lucide-react/dist/esm/icons/panel-right.mjs
var __iconData17 = {
  name: "panel-right",
  size: 24,
  node: [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M15 3v18", key: "14nvp0" }]
  ]
};
__iconData17.node;
var PanelRight = createLucideIcon(__iconData17);
// ../../node_modules/lucide-react/dist/esm/icons/pencil.mjs
var __iconData18 = {
  name: "pencil",
  size: 24,
  node: [
    [
      "path",
      {
        d: "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",
        key: "1a8usu"
      }
    ],
    ["path", { d: "m15 5 4 4", key: "1mk7zo" }]
  ]
};
__iconData18.node;
var Pencil = createLucideIcon(__iconData18);
// ../../node_modules/lucide-react/dist/esm/icons/plus.mjs
var __iconData19 = {
  name: "plus",
  size: 24,
  node: [
    ["path", { d: "M5 12h14", key: "1ays0h" }],
    ["path", { d: "M12 5v14", key: "s699le" }]
  ]
};
__iconData19.node;
var Plus = createLucideIcon(__iconData19);
// ../../node_modules/lucide-react/dist/esm/icons/refresh-cw.mjs
var __iconData20 = {
  name: "refresh-cw",
  size: 24,
  node: [
    ["path", { d: "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8", key: "v9h5vc" }],
    ["path", { d: "M21 3v5h-5", key: "1q7to0" }],
    ["path", { d: "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16", key: "3uifl3" }],
    ["path", { d: "M8 16H3v5", key: "1cv678" }]
  ]
};
__iconData20.node;
var RefreshCw = createLucideIcon(__iconData20);
// ../../node_modules/lucide-react/dist/esm/icons/rotate-ccw.mjs
var __iconData21 = {
  name: "rotate-ccw",
  size: 24,
  node: [
    ["path", { d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8", key: "1357e3" }],
    ["path", { d: "M3 3v5h5", key: "1xhq8a" }]
  ]
};
__iconData21.node;
var RotateCcw = createLucideIcon(__iconData21);
// ../../node_modules/lucide-react/dist/esm/icons/rotate-cw.mjs
var __iconData22 = {
  name: "rotate-cw",
  size: 24,
  node: [
    ["path", { d: "M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8", key: "1p45f6" }],
    ["path", { d: "M21 3v5h-5", key: "1q7to0" }]
  ]
};
__iconData22.node;
var RotateCw = createLucideIcon(__iconData22);
// ../../node_modules/lucide-react/dist/esm/icons/sliders-horizontal.mjs
var __iconData23 = {
  name: "sliders-horizontal",
  size: 24,
  node: [
    ["path", { d: "M10 5H3", key: "1qgfaw" }],
    ["path", { d: "M12 19H3", key: "yhmn1j" }],
    ["path", { d: "M14 3v4", key: "1sua03" }],
    ["path", { d: "M16 17v4", key: "1q0r14" }],
    ["path", { d: "M21 12h-9", key: "1o4lsq" }],
    ["path", { d: "M21 19h-5", key: "1rlt1p" }],
    ["path", { d: "M21 5h-7", key: "1oszz2" }],
    ["path", { d: "M8 10v4", key: "tgpxqk" }],
    ["path", { d: "M8 12H3", key: "a7s4jb" }]
  ]
};
__iconData23.node;
var SlidersHorizontal = createLucideIcon(__iconData23);
// ../../node_modules/lucide-react/dist/esm/icons/square.mjs
var __iconData24 = {
  name: "square",
  size: 24,
  node: [["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }]]
};
__iconData24.node;
var Square = createLucideIcon(__iconData24);
// ../../node_modules/lucide-react/dist/esm/icons/volume-2.mjs
var __iconData25 = {
  name: "volume-2",
  size: 24,
  node: [
    [
      "path",
      {
        d: "M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z",
        key: "uqj9uw"
      }
    ],
    ["path", { d: "M16 9a5 5 0 0 1 0 6", key: "1q6k2b" }],
    ["path", { d: "M19.364 18.364a9 9 0 0 0 0-12.728", key: "ijwkga" }]
  ]
};
__iconData25.node;
var Volume2 = createLucideIcon(__iconData25);
// ../../node_modules/lucide-react/dist/esm/icons/volume-x.mjs
var __iconData26 = {
  name: "volume-x",
  size: 24,
  node: [
    [
      "path",
      {
        d: "M11 4.702a.7.7 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.7.7 0 0 0 11 19.298z",
        key: "1p7khw"
      }
    ],
    ["path", { d: "m16.5 14.5 5-5", key: "cul3yw" }],
    ["path", { d: "m16.5 9.5 5 5", key: "1akey5" }]
  ]
};
__iconData26.node;
var VolumeX = createLucideIcon(__iconData26);
// ../../node_modules/idb-keyval/dist/index.js
function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.oncomplete = request.onsuccess = () => resolve(request.result);
    request.onabort = request.onerror = () => reject(request.error);
  });
}
function createStore(dbName, storeName) {
  let dbp;
  const getDB = () => {
    if (dbp)
      return dbp;
    const request = indexedDB.open(dbName);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    dbp = promisifyRequest(request);
    dbp.then((db) => {
      db.onclose = () => dbp = undefined;
    }, () => {
      dbp = undefined;
    });
    return dbp;
  };
  return (txMode, callback) => getDB().then((db) => callback(db.transaction(storeName, txMode).objectStore(storeName)));
}
var defaultGetStoreFunc;
function defaultGetStore() {
  if (!defaultGetStoreFunc) {
    defaultGetStoreFunc = createStore("keyval-store", "keyval");
  }
  return defaultGetStoreFunc;
}
function get(key, customStore = defaultGetStore()) {
  return customStore("readonly", (store) => promisifyRequest(store.get(key)));
}
function set(key, value, customStore = defaultGetStore()) {
  return customStore("readwrite", (store) => {
    store.put(value, key);
    return promisifyRequest(store.transaction);
  });
}
function del(key, customStore = defaultGetStore()) {
  return customStore("readwrite", (store) => {
    store.delete(key);
    return promisifyRequest(store.transaction);
  });
}
function eachCursor(store, callback) {
  store.openCursor().onsuccess = function() {
    if (!this.result)
      return;
    callback(this.result);
    this.result.continue();
  };
  return promisifyRequest(store.transaction);
}
function entries(customStore = defaultGetStore()) {
  return customStore("readonly", (store) => {
    if (store.getAll && store.getAllKeys) {
      return Promise.all([
        promisifyRequest(store.getAllKeys()),
        promisifyRequest(store.getAll())
      ]).then(([keys, values]) => keys.map((key, i) => [key, values[i]]));
    }
    const items = [];
    return eachCursor(store, (cursor) => items.push([cursor.key, cursor.value])).then(() => items);
  });
}

// src/lib/drafts.ts
var SAVE_DELAY_MS = 300;
var MAX_AGE_MS = 24 * 60 * 60 * 1000;
var MAX_DRAFTS = 20;
var EMPTY = { text: "", images: [] };
function draftKey(instanceId, agentId) {
  return `${instanceId}:${agentId ?? "Main"}`;
}
function createDraftStore(options = {}) {
  const { dbName = "webgui-drafts", now = Date.now, listenLifecycle = true } = options;
  const drafts = new Map;
  const dirty = new Set;
  const hydratedListeners = new Set;
  let store = null;
  let saveTimer;
  function evictOverflow() {
    if (drafts.size <= MAX_DRAFTS)
      return;
    const oldest = [...drafts].sort((a, b) => a[1].updatedAt - b[1].updatedAt);
    for (const [key] of oldest.slice(0, drafts.size - MAX_DRAFTS)) {
      drafts.delete(key);
      dirty.add(key);
    }
  }
  function flushDrafts() {
    clearTimeout(saveTimer);
    saveTimer = undefined;
    const target = store;
    if (!target)
      return;
    for (const key of dirty) {
      const entry = drafts.get(key);
      if (!entry) {
        del(key, target).catch(() => {});
        continue;
      }
      const { draft, updatedAt } = entry;
      if (draft.images.length === 0) {
        set(key, { text: draft.text, images: [], updatedAt }, target).catch(() => {});
        continue;
      }
      Promise.all(draft.images.map(dataUrlToBlob)).then((images) => {
        if (drafts.get(key) !== entry)
          return;
        return set(key, { text: draft.text, images, updatedAt }, target);
      }).catch(() => {});
    }
    dirty.clear();
  }
  return {
    readDraft(key) {
      return drafts.get(key)?.draft ?? EMPTY;
    },
    writeDraft(key, draft) {
      const prev = drafts.get(key)?.draft ?? EMPTY;
      if (draft.text === prev.text && draft.images === prev.images)
        return;
      if (draft.text.trim() === "" && draft.images.length === 0) {
        if (!drafts.has(key))
          return;
        drafts.delete(key);
      } else {
        drafts.set(key, { draft, updatedAt: now() });
        evictOverflow();
      }
      dirty.add(key);
      if (!store)
        return;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(flushDrafts, SAVE_DELAY_MS);
    },
    onDraftsHydrated(listener) {
      hydratedListeners.add(listener);
      return () => hydratedListeners.delete(listener);
    },
    flushDrafts,
    async hydrateDrafts() {
      if (store)
        return;
      const at = now();
      try {
        store = createStore(dbName, "drafts");
        const stored = await entries(store);
        const decoded = await Promise.all(stored.map(async ([key, value]) => ({
          key,
          entry: await decodeStored(value, at).catch(() => null),
          legacy: !(value && typeof value === "object" && ("updatedAt" in value))
        })));
        for (const { key, entry, legacy } of decoded) {
          if (typeof key !== "string")
            continue;
          if (dirty.has(key))
            continue;
          if (!entry) {
            dirty.add(key);
            continue;
          }
          drafts.set(key, entry);
          if (legacy)
            dirty.add(key);
        }
        evictOverflow();
      } catch {
        store = null;
        return;
      }
      if (listenLifecycle) {
        browserWindow.addEventListener("pagehide", flushDrafts);
        browserDocument.addEventListener("visibilitychange", () => {
          if (browserDocument.visibilityState === "hidden")
            flushDrafts();
        });
      }
      if (dirty.size > 0)
        flushDrafts();
      for (const listener of hydratedListeners)
        listener();
    }
  };
}
async function dataUrlToBlob(dataUrl) {
  return (await fetch(dataUrl)).blob();
}
function blobToDataUrl(blob) {
  const { promise, resolve, reject } = Promise.withResolvers();
  const reader = new FileReader;
  reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("not text"));
  reader.onerror = () => reject(new Error("read failed"));
  reader.readAsDataURL(blob);
  return promise;
}
async function decodeStored(value, now) {
  if (typeof value === "string")
    return value.trim() === "" ? null : { draft: { text: value, images: [] }, updatedAt: now };
  if (!value || typeof value !== "object" || !("text" in value) || !("images" in value))
    return null;
  const { text, images } = value;
  if (typeof text !== "string" || !Array.isArray(images))
    return null;
  const updatedAt = "updatedAt" in value && typeof value.updatedAt === "number" ? value.updatedAt : now;
  if (now - updatedAt > MAX_AGE_MS)
    return null;
  const blobs = images.filter((b) => b instanceof Blob);
  return { draft: { text, images: await Promise.all(blobs.map(blobToDataUrl)) }, updatedAt };
}
var defaultStore = createDraftStore();
var { readDraft, writeDraft, onDraftsHydrated, hydrateDrafts } = defaultStore;

// src/lib/wren.ts
var WREN_BASE_URL = "https://pq9.time-phrygian.ts.net:8765";
var STORAGE_KEY_CHANNEL = "webgui.wrenChannel";
function delay(ms) {
  const { promise, resolve } = Promise.withResolvers();
  setTimeout(resolve, ms);
  return promise;
}
function extractErrorMessage(payload, fallback) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const err = payload.error;
    if (err && typeof err === "object" && "message" in err && typeof err.message === "string") {
      return err.message;
    }
  }
  return fallback;
}
function generateChannelId() {
  const rand = Math.random().toString(36).slice(2, 10);
  return `webgui-${rand}`.slice(0, 32);
}
function getOrCreateChannelId() {
  if (typeof globalThis.localStorage === "undefined") {
    return generateChannelId();
  }
  try {
    const raw = browserWindow.localStorage.getItem(STORAGE_KEY_CHANNEL);
    const existing = raw && /^[a-z0-9_-]{1,32}$/.test(raw.trim().toLowerCase()) ? raw.trim().toLowerCase() : null;
    if (existing)
      return existing;
    const generated = generateChannelId();
    browserWindow.localStorage.setItem(STORAGE_KEY_CHANNEL, generated);
    return generated;
  } catch {
    return generateChannelId();
  }
}

class WrenController {
  #enabled = false;
  #active = false;
  #speaking = false;
  #error = null;
  #ctx = null;
  #running = false;
  #pollAbort = null;
  #lastSeq = -1;
  #lastEpoch = -1;
  #playedSeq = -1;
  #nextTime = 0;
  #scheduled = [];
  #reportTimer = null;
  #channel = "";
  #claimCheckAt = 0;
  #claimCheckInFlight = false;
  #listeners = new Set;
  #visibilityAttached = false;
  #cachedState = {
    enabled: false,
    active: false,
    speaking: false,
    error: null
  };
  constructor() {
    this.#channel = getOrCreateChannelId();
    this.#updateSnapshot();
  }
  #updateSnapshot() {
    this.#cachedState = {
      enabled: this.#enabled,
      active: this.#active,
      speaking: this.#speaking,
      error: this.#error
    };
  }
  #notify() {
    this.#updateSnapshot();
    for (const listener of this.#listeners) {
      try {
        listener();
      } catch {}
    }
  }
  getState() {
    return this.#cachedState;
  }
  subscribe(listener) {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }
  #attachVisibility() {
    if (this.#visibilityAttached || typeof browserDocument === "undefined")
      return;
    this.#visibilityAttached = true;
    browserDocument.addEventListener("visibilitychange", () => {
      if (browserDocument.visibilityState === "visible" && this.#enabled) {
        this.#handleVisibilityResume();
      }
    });
  }
  async#handleVisibilityResume() {
    if (!this.#enabled)
      return;
    try {
      if (this.#ctx && this.#ctx.state !== "running" && this.#ctx.state !== "closed") {
        await this.#ctx.resume();
      }
    } catch {}
    if (!this.#running) {
      this.#running = true;
      this.#loop();
    }
  }
  async enable() {
    this.#enabled = true;
    this.#attachVisibility();
    this.#error = null;
    const nav = globalThis.navigator;
    if (nav && typeof nav === "object" && "audioSession" in nav) {
      const session = nav.audioSession;
      if (session && typeof session === "object" && "type" in session)
        session.type = "playback";
    }
    const holder = globalThis;
    const ctor = holder.AudioContext;
    if (!this.#ctx && typeof ctor === "function") {
      const AudioContextCtor = ctor;
      this.#ctx = new AudioContextCtor;
    }
    if (this.#ctx && this.#ctx.state !== "running") {
      try {
        await this.#ctx.resume();
      } catch (err) {
        this.#error = err instanceof Error ? err.message : String(err);
      }
    }
    if (!this.#running) {
      this.#running = true;
      this.#loop();
    }
    this.#notify();
    await this.claimActive();
  }
  disable() {
    this.#enabled = false;
    this.#active = false;
    this.#running = false;
    this.#error = null;
    if (this.#pollAbort) {
      this.#pollAbort.abort();
      this.#pollAbort = null;
    }
    this.flush();
    if (this.#reportTimer) {
      clearInterval(this.#reportTimer);
      this.#reportTimer = null;
    }
    this.#speaking = false;
    if (this.#ctx) {
      try {
        if (this.#ctx.state !== "closed") {
          this.#ctx.suspend();
        }
      } catch {}
    }
    this.#notify();
  }
  #label() {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const device = /iPhone|iPad|Android|Macintosh|Windows|Linux/.exec(ua)?.[0] ?? "browser";
    return `webgui ${device} audio:${this.#ctx?.state ?? "none"}`;
  }
  async claimActive() {
    const url = `${WREN_BASE_URL}/clients/active`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          channel: this.#channel,
          label: this.#label()
        })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        this.#error = extractErrorMessage(body, `Claim failed with HTTP ${res.status}`);
        this.#active = false;
        this.#notify();
        return;
      }
      this.#active = true;
      this.#error = null;
      this.#notify();
    } catch (err) {
      this.#error = err instanceof Error ? err.message : String(err);
      this.#active = false;
      this.#notify();
    }
  }
  claimOnInput() {
    if (!this.#enabled || this.#claimCheckInFlight)
      return Promise.resolve();
    const now = Date.now();
    if (now - this.#claimCheckAt < 2000)
      return Promise.resolve();
    this.#claimCheckAt = now;
    this.#claimCheckInFlight = true;
    return this.#claimIfNotActive().finally(() => {
      this.#claimCheckInFlight = false;
    });
  }
  async#claimIfNotActive() {
    try {
      const res = await fetch(`${WREN_BASE_URL}/health`);
      const body = await res.json();
      const client = body && typeof body === "object" && "active_client" in body ? body.active_client : null;
      const active = client && typeof client === "object" && "channel" in client ? client.channel : null;
      if (active === this.#channel) {
        if (!this.#active) {
          this.#active = true;
          this.#notify();
        }
        return;
      }
    } catch {}
    await this.claimActive();
  }
  async speakText(text) {
    if (!this.#enabled) {
      await this.enable();
    }
    const url = `${WREN_BASE_URL}/speak`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text,
        channel: this.#channel,
        append: false
      })
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const msg = extractErrorMessage(body, `Speak failed with HTTP ${res.status}`);
      this.#error = msg;
      this.#notify();
      throw new Error(msg);
    }
  }
  async stopSpeaking() {
    const url = `${WREN_BASE_URL}/stop`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        channel: this.#channel
      })
    });
    this.flush();
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const msg = extractErrorMessage(body, `Stop failed with HTTP ${res.status}`);
      this.#error = msg;
      this.#notify();
      throw new Error(msg);
    }
  }
  flush() {
    const now = this.#ctx?.currentTime ?? 0;
    for (const s of this.#scheduled) {
      if (!s.stopped) {
        this.#stopEntry(s, now);
      }
    }
    this.#scheduled = [];
    this.#nextTime = 0;
    if (this.#speaking) {
      this.#speaking = false;
      this.#notify();
    }
  }
  #stopEntry(s, when) {
    const t = when || (this.#ctx?.currentTime ?? 0);
    try {
      s.gain.gain.setValueAtTime(s.gain.gain.value, t);
      s.gain.gain.linearRampToValueAtTime(0, t + 0.005);
      s.source.stop(t + 0.005);
    } catch {}
    s.stopped = true;
  }
  #makeSource(buf, when, offset) {
    if (!this.#ctx)
      throw new Error("AudioContext missing");
    const gain = this.#ctx.createGain();
    gain.connect(this.#ctx.destination);
    const src = this.#ctx.createBufferSource();
    src.buffer = buf;
    src.connect(gain);
    src.start(when, offset);
    return { source: src, gain };
  }
  #schedule(buf, block, seq) {
    if (!this.#ctx)
      throw new Error("AudioContext missing");
    const now = this.#ctx.currentTime;
    const when = Math.max(now, this.#nextTime);
    const { source, gain } = this.#makeSource(buf, when, 0);
    const dur = buf.duration;
    const entry = {
      source,
      gain,
      block,
      seq,
      start: when,
      end: when + dur,
      stopped: false
    };
    source.onended = () => {
      entry.stopped = true;
    };
    this.#scheduled.push(entry);
    this.#nextTime = entry.end;
    this.#ensureReport();
    return entry;
  }
  #ensureReport() {
    if (this.#reportTimer)
      return;
    this.#reportTimer = setInterval(() => this.#report(), 250);
    this.#report();
  }
  #report() {
    const now = this.#ctx?.currentTime ?? 0;
    for (const s of this.#scheduled) {
      if (s.end <= now && s.seq > this.#playedSeq) {
        this.#playedSeq = s.seq;
      }
    }
    this.#scheduled = this.#scheduled.filter((s) => !s.stopped && s.end > now);
    const wasSpeaking = this.#speaking;
    this.#speaking = this.#scheduled.length > 0;
    if (this.#speaking !== wasSpeaking) {
      this.#notify();
    }
    if (this.#scheduled.length === 0) {
      if (this.#reportTimer) {
        clearInterval(this.#reportTimer);
        this.#reportTimer = null;
      }
    }
  }
  async#loop() {
    while (this.#running) {
      const ac = new AbortController;
      this.#pollAbort = ac;
      const url = `${WREN_BASE_URL}/segment?channel=${encodeURIComponent(this.#channel)}&after=${this.#lastSeq}&played=${this.#playedSeq}&timeout=20`;
      try {
        const res = await fetch(url, { signal: ac.signal });
        if (!this.#running)
          break;
        const epochHeader = res.headers.get("X-Epoch");
        const seqHeader = res.headers.get("X-Seq");
        const epoch = epochHeader != null ? parseInt(epochHeader, 10) : -1;
        const seq = seqHeader != null ? parseInt(seqHeader, 10) : -1;
        if (res.status === 204) {
          if (epoch >= 0 && this.#lastEpoch >= 0 && epoch !== this.#lastEpoch) {
            this.flush();
            this.#lastEpoch = epoch;
            this.#lastSeq = -1;
            this.#playedSeq = -1;
          } else if (epoch >= 0 && this.#lastEpoch < 0) {
            this.#lastEpoch = epoch;
          }
          if (this.#error) {
            this.#error = null;
            this.#notify();
          }
          continue;
        }
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          const msg = extractErrorMessage(body, `Segment poll returned HTTP ${res.status}`);
          this.#error = msg;
          this.#notify();
          const delayMs = res.status === 401 ? 5000 : res.status === 503 ? 2000 : 1000;
          await delay(delayMs);
          continue;
        }
        if (this.#error) {
          this.#error = null;
          this.#notify();
        }
        const blockHeader = res.headers.get("X-Block");
        const blocks = blockHeader ? blockHeader.split(",").map(Number).filter((n) => !Number.isNaN(n)) : [];
        const block = blocks.length > 0 ? blocks : null;
        if (this.#lastEpoch >= 0 && epoch !== this.#lastEpoch) {
          this.flush();
          this.#lastSeq = -1;
          this.#playedSeq = -1;
        }
        if (epoch >= 0) {
          this.#lastEpoch = epoch;
        }
        if (seq >= 0) {
          this.#lastSeq = seq;
        }
        const data = await res.arrayBuffer();
        if (!this.#running)
          break;
        if (this.#ctx) {
          const raw = await this.#ctx.decodeAudioData(data);
          this.#schedule(raw, block, seq);
        }
      } catch (err) {
        const errorName = err instanceof Error ? err.name : "";
        if (errorName === "AbortError") {
          continue;
        }
        if (!this.#running)
          break;
        this.#error = err instanceof Error ? err.message : String(err);
        this.#notify();
        await delay(1000);
      }
    }
    this.#pollAbort = null;
  }
  _testHooks() {
    return {
      setChannel: (ch) => {
        this.#channel = ch;
      },
      getChannel: () => this.#channel,
      getLastSeq: () => this.#lastSeq,
      getLastEpoch: () => this.#lastEpoch,
      getPlayedSeq: () => this.#playedSeq,
      getScheduled: () => this.#scheduled,
      setAudioContext: (ctx) => {
        this.#ctx = ctx;
      },
      triggerLoop: () => this.#loop(),
      handleEpochChange: (newEpoch) => {
        if (this.#lastEpoch >= 0 && newEpoch !== this.#lastEpoch) {
          this.flush();
          this.#lastSeq = -1;
          this.#playedSeq = -1;
        }
        this.#lastEpoch = newEpoch;
      },
      setActive: (active) => {
        this.#active = active;
        this.#updateSnapshot();
      },
      setEnabled: (enabled) => {
        this.#enabled = enabled;
      }
    };
  }
}
var instance = null;
function getController() {
  if (!instance) {
    instance = new WrenController;
  }
  return instance;
}
function getWrenState() {
  return getController().getState();
}
function subscribeWren(listener) {
  return getController().subscribe(listener);
}
async function enableVoice() {
  await getController().enable();
}
function disableVoice() {
  getController().disable();
}
function claimOnInput() {
  return getController().claimOnInput();
}
async function speakText(text) {
  await getController().speakText(text);
}
async function stopSpeaking() {
  await getController().stopSpeaking();
}

// ../../node_modules/@tanstack/react-virtual/dist/esm/index.js
var React2 = __toESM(require_react(), 1);
var import_react_dom = __toESM(require_react_dom(), 1);

// ../../node_modules/@tanstack/virtual-core/dist/esm/lazy-measurements.js
function getMeasurementKey(item) {
  return typeof item === "object" ? item.key : item;
}
function createLazyMeasurementsView(cache, flat) {
  const count = cache.length;
  return new Proxy(cache, {
    get(target, prop, receiver) {
      if (typeof prop === "string") {
        const c = prop.charCodeAt(0);
        if (c >= 48 && c <= 57) {
          const i = +prop;
          if (Number.isInteger(i) && i >= 0 && i < count) {
            let v = target[i];
            if (typeof v !== "object") {
              const s = flat[i * 2];
              v = target[i] = {
                index: i,
                key: v,
                start: s,
                size: flat[i * 2 + 1],
                end: s + flat[i * 2 + 1],
                lane: 0
              };
            }
            return v;
          }
        }
        if (prop === "length")
          return count;
      }
      return Reflect.get(target, prop, receiver);
    }
  });
}

// ../../node_modules/@tanstack/virtual-core/dist/esm/utils.js
function memo(getDeps, fn, opts) {
  let deps = opts.initialDeps ?? [];
  let result;
  let isInitial = true;
  function memoizedFunction() {
    var _a;
    const debugEnabled = false;
    let depTime = 0;
    if (debugEnabled)
      depTime = Date.now();
    const newDeps = getDeps();
    const depsChanged = newDeps.length !== deps.length || newDeps.some((dep, index2) => deps[index2] !== dep);
    if (!depsChanged) {
      return result;
    }
    deps = newDeps;
    let resultTime = 0;
    if (debugEnabled)
      resultTime = Date.now();
    result = fn(...newDeps);
    if (debugEnabled) {
      const depEndTime = Math.round((Date.now() - depTime) * 100) / 100;
      const resultEndTime = Math.round((Date.now() - resultTime) * 100) / 100;
      const resultFpsPercentage = resultEndTime / 16;
      const pad = (str, num) => {
        str = String(str);
        while (str.length < num) {
          str = " " + str;
        }
        return str;
      };
      console.info(`%c⏱ ${pad(resultEndTime, 5)} /${pad(depEndTime, 5)} ms`, `
            font-size: .6rem;
            font-weight: bold;
            color: hsl(${Math.max(0, Math.min(120 - 120 * resultFpsPercentage, 120))}deg 100% 31%);`, opts == null ? undefined : opts.key);
    }
    if ((opts == null ? undefined : opts.onChange) && !(isInitial && opts.skipInitialOnChange)) {
      opts.onChange(result);
    }
    isInitial = false;
    return result;
  }
  memoizedFunction.updateDeps = (newDeps) => {
    deps = newDeps;
  };
  return memoizedFunction;
}
function notUndefined(value, msg) {
  if (value === undefined) {
    throw new Error(`Unexpected undefined${msg ? `: ${msg}` : ""}`);
  } else {
    return value;
  }
}
var approxEqual = (a, b) => Math.abs(a - b) < 1.01;
var debounce = (targetWindow, fn, ms) => {
  let timeoutId;
  return Object.assign(function(...args) {
    targetWindow.clearTimeout(timeoutId);
    timeoutId = targetWindow.setTimeout(() => fn.apply(this, args), ms);
  }, {
    cancel: () => {
      targetWindow.clearTimeout(timeoutId);
    }
  });
};

// ../../node_modules/@tanstack/virtual-core/dist/esm/index.js
var _isIOSResult;
var isIOSWebKit = () => {
  if (_isIOSResult !== undefined)
    return _isIOSResult;
  if (typeof navigator === "undefined")
    return _isIOSResult = false;
  if (/iP(hone|od|ad)/.test(navigator.userAgent))
    return _isIOSResult = true;
  const mtp = navigator.maxTouchPoints;
  return _isIOSResult = navigator.platform === "MacIntel" && mtp !== undefined && mtp > 0;
};
var getRect = (element) => {
  const { offsetWidth, offsetHeight } = element;
  return { width: offsetWidth, height: offsetHeight };
};
var defaultKeyExtractor = (index2) => index2;
var defaultRangeExtractor = (range) => {
  const start = Math.max(range.startIndex - range.overscan, 0);
  const end = Math.min(range.endIndex + range.overscan, range.count - 1);
  const len = end - start + 1;
  const arr = new Array(len);
  for (let i = 0;i < len; i++) {
    arr[i] = start + i;
  }
  return arr;
};
var observeElementRect = (instance2, cb) => {
  const element = instance2.scrollElement;
  if (!element) {
    return;
  }
  const targetWindow = instance2.targetWindow;
  if (!targetWindow) {
    return;
  }
  const handler = (rect) => {
    const { width, height } = rect;
    cb({ width: Math.round(width), height: Math.round(height) });
  };
  handler(getRect(element));
  if (!targetWindow.ResizeObserver) {
    return () => {};
  }
  const observer = new targetWindow.ResizeObserver((entries2) => {
    const run = () => {
      const entry = entries2[0];
      if (entry == null ? undefined : entry.borderBoxSize) {
        const box = entry.borderBoxSize[0];
        if (box) {
          handler({ width: box.inlineSize, height: box.blockSize });
          return;
        }
      }
      handler(getRect(element));
    };
    instance2.options.useAnimationFrameWithResizeObserver ? requestAnimationFrame(run) : run();
  });
  observer.observe(element, { box: "border-box" });
  return () => {
    observer.unobserve(element);
  };
};
var addEventListenerOptions = {
  passive: true
};
var supportsScrollend = typeof window == "undefined" ? true : ("onscrollend" in window);
var observeOffset = (instance2, cb, readOffset) => {
  const element = instance2.scrollElement;
  if (!element) {
    return;
  }
  const targetWindow = instance2.targetWindow;
  if (!targetWindow) {
    return;
  }
  const registerScrollendEvent = instance2.options.useScrollendEvent && supportsScrollend;
  let offset = 0;
  const fallback = registerScrollendEvent ? null : debounce(targetWindow, () => cb(readOffset(element), false), instance2.options.isScrollingResetDelay);
  const createHandler = (isScrolling) => () => {
    offset = readOffset(element);
    fallback == null || fallback();
    cb(offset, isScrolling);
  };
  const handler = createHandler(true);
  const endHandler = createHandler(false);
  element.addEventListener("scroll", handler, addEventListenerOptions);
  if (registerScrollendEvent) {
    element.addEventListener("scrollend", endHandler, addEventListenerOptions);
  }
  return () => {
    element.removeEventListener("scroll", handler);
    if (registerScrollendEvent) {
      element.removeEventListener("scrollend", endHandler);
    }
    fallback == null || fallback.cancel();
  };
};
var observeElementOffset = (instance2, cb) => observeOffset(instance2, cb, (el) => {
  const { horizontal, isRtl } = instance2.options;
  return horizontal ? el.scrollLeft * (isRtl && -1 || 1) : el.scrollTop;
});
var measureElement = (element, entry, instance2) => {
  if (instance2.options.useCachedMeasurements) {
    const index2 = instance2.indexFromElement(element);
    const key = instance2.options.getItemKey(index2);
    return instance2.itemSizeCache.get(key) ?? instance2.options.estimateSize(index2);
  }
  if (entry == null ? undefined : entry.borderBoxSize) {
    const box = entry.borderBoxSize[0];
    if (box) {
      const size = Math.round(box[instance2.options.horizontal ? "inlineSize" : "blockSize"]);
      return size;
    }
  }
  if (!entry) {
    const index2 = instance2.indexFromElement(element);
    const key = instance2.options.getItemKey(index2);
    const cachedSize = instance2.itemSizeCache.get(key);
    if (cachedSize !== undefined) {
      return cachedSize;
    }
  }
  return element[instance2.options.horizontal ? "offsetWidth" : "offsetHeight"];
};
var scrollWithAdjustments = (offset, {
  adjustments = 0,
  behavior
}, instance2) => {
  var _a, _b;
  (_b = (_a = instance2.scrollElement) == null ? undefined : _a.scrollTo) == null || _b.call(_a, {
    [instance2.options.horizontal ? "left" : "top"]: offset + adjustments,
    behavior
  });
};
var elementScroll = scrollWithAdjustments;
function isAppendWithTrim(prevCount, nextCount, getPreviousKey, getNextKey) {
  if (nextCount === 0)
    return false;
  const firstKey = getNextKey(0);
  const removedKeys = /* @__PURE__ */ new Set;
  let removedCount = 0;
  while (removedCount < prevCount) {
    const key = getPreviousKey(removedCount);
    if (key === firstKey)
      break;
    removedKeys.add(key);
    removedCount++;
  }
  const retainedCount = prevCount - removedCount;
  if (retainedCount === 0 || retainedCount >= nextCount)
    return false;
  for (let i = 0;i < retainedCount; i++) {
    if (getNextKey(i) !== getPreviousKey(removedCount + i))
      return false;
  }
  for (let i = retainedCount;i < nextCount; i++) {
    if (removedKeys.has(getNextKey(i)))
      return false;
  }
  return true;
}

class Virtualizer {
  constructor(opts) {
    this.unsubs = [];
    this.scrollElement = null;
    this.targetWindow = null;
    this.isScrolling = false;
    this.scrollState = null;
    this.measurementsCache = [];
    this._singleLaneMeasurements = null;
    this.itemSizeCache = /* @__PURE__ */ new Map;
    this.itemSizeCacheVersion = 0;
    this.laneAssignments = /* @__PURE__ */ new Map;
    this.pendingMin = null;
    this.prevLanes = undefined;
    this.lanesChangedFlag = false;
    this.lanesSettling = false;
    this.pendingScrollAnchor = null;
    this.scrollRect = null;
    this.scrollOffset = null;
    this.scrollDirection = null;
    this.scrollAdjustments = 0;
    this._iosDeferredAdjustment = 0;
    this._iosTouching = false;
    this._iosJustTouchEnded = false;
    this._iosTouchEndTimerId = null;
    this._intendedScrollOffset = null;
    this._clampedAdjustment = null;
    this.elementsCache = /* @__PURE__ */ new Map;
    this.now = () => {
      var _a, _b, _c;
      return ((_c = (_b = (_a = this.targetWindow) == null ? undefined : _a.performance) == null ? undefined : _b.now) == null ? undefined : _c.call(_b)) ?? Date.now();
    };
    this.observer = /* @__PURE__ */ (() => {
      let _ro = null;
      const get2 = () => {
        if (_ro) {
          return _ro;
        }
        if (!this.targetWindow || !this.targetWindow.ResizeObserver) {
          return null;
        }
        return _ro = new this.targetWindow.ResizeObserver((entries2) => {
          entries2.forEach((entry) => {
            const run = () => {
              const node = entry.target;
              const index2 = this.indexFromElement(node);
              if (!node.isConnected) {
                this.observer.unobserve(node);
                for (const [cacheKey, cachedNode] of this.elementsCache) {
                  if (cachedNode === node) {
                    this.elementsCache.delete(cacheKey);
                    break;
                  }
                }
                return;
              }
              if (!this.isIndexInRange(index2))
                return;
              if (this.shouldMeasureDuringScroll(index2)) {
                this.resizeItem(index2, this.options.measureElement(node, entry, this));
              }
            };
            this.options.useAnimationFrameWithResizeObserver ? requestAnimationFrame(run) : run();
          });
        });
      };
      return {
        disconnect: () => {
          var _a;
          (_a = get2()) == null || _a.disconnect();
          _ro = null;
        },
        observe: (target) => {
          var _a;
          return (_a = get2()) == null ? undefined : _a.observe(target, { box: "border-box" });
        },
        unobserve: (target) => {
          var _a;
          return (_a = get2()) == null ? undefined : _a.unobserve(target);
        }
      };
    })();
    this.range = null;
    this.setOptions = (opts2) => {
      var _a;
      const merged = {
        debug: false,
        initialOffset: 0,
        overscan: 1,
        paddingStart: 0,
        paddingEnd: 0,
        scrollPaddingStart: 0,
        scrollPaddingEnd: 0,
        horizontal: false,
        getItemKey: defaultKeyExtractor,
        rangeExtractor: defaultRangeExtractor,
        onChange: () => {},
        measureElement,
        initialRect: { width: 0, height: 0 },
        scrollMargin: 0,
        gap: 0,
        indexAttribute: "data-index",
        initialMeasurementsCache: [],
        lanes: 1,
        anchorTo: "start",
        followOnAppend: false,
        scrollEndThreshold: 1,
        isScrollingResetDelay: 150,
        enabled: true,
        isRtl: false,
        useScrollendEvent: false,
        useAnimationFrameWithResizeObserver: false,
        laneAssignmentMode: "estimate",
        useCachedMeasurements: false
      };
      for (const key in opts2) {
        const v = opts2[key];
        if (v !== undefined)
          merged[key] = v;
      }
      const prevOptions = this.options;
      let anchor = null;
      let followOnAppend = null;
      let edgeKeysChanged = false;
      if (prevOptions !== undefined && prevOptions.enabled && merged.enabled && merged.anchorTo === "end" && this.scrollElement !== null) {
        const prevCount = prevOptions.count;
        const nextCount = merged.count;
        const measurements = this.getMeasurements();
        const previousItems = ((_a = this._singleLaneMeasurements) == null ? undefined : _a.items) ?? measurements;
        const getPreviousKey = (index2) => getMeasurementKey(previousItems[index2]);
        const prevFirstKey = prevCount > 0 ? getPreviousKey(0) : null;
        const prevLastKey = prevCount > 0 ? getPreviousKey(prevCount - 1) : null;
        const didCountChange = nextCount !== prevCount;
        const didEdgeKeysChange = didCountChange || prevCount > 0 && nextCount > 0 && (merged.getItemKey(0) !== prevFirstKey || merged.getItemKey(nextCount - 1) !== prevLastKey);
        if (didEdgeKeysChange) {
          edgeKeysChanged = true;
          const item = prevCount > 0 ? this.getVirtualItemForOffset(this.getScrollOffset()) ?? measurements[0] : null;
          if (item) {
            anchor = [item.key, this.getScrollOffset() - item.start];
          }
          const behavior = merged.followOnAppend === true ? "auto" : merged.followOnAppend || null;
          if (behavior && nextCount > 0 && this.isAtEnd(prevOptions.scrollEndThreshold) && (prevCount === 0 || merged.getItemKey(nextCount - 1) !== prevLastKey)) {
            if (nextCount > prevCount || isAppendWithTrim(prevCount, nextCount, getPreviousKey, merged.getItemKey)) {
              followOnAppend = behavior;
            }
          }
        }
      }
      this.options = merged;
      if (edgeKeysChanged) {
        this.pendingMin = 0;
        this.itemSizeCacheVersion++;
      }
      let anchorResolved = false;
      let anchorDelta = 0;
      if (anchor && this.scrollOffset !== null) {
        const [anchorKey, anchorOffset] = anchor;
        const newMeasurements = this.getMeasurements();
        const { count, getItemKey } = this.options;
        let idx = 0;
        while (idx < count && getItemKey(idx) !== anchorKey) {
          idx++;
        }
        if (idx < count) {
          const anchorItem = newMeasurements[idx];
          if (anchorItem) {
            const newOffset = Math.max(0, anchorItem.start + anchorOffset);
            if (!followOnAppend && newOffset !== this.scrollOffset) {
              anchorDelta = newOffset - this.scrollOffset;
              this.scrollOffset = newOffset;
              anchorResolved = true;
            }
          }
        }
      }
      if (anchorResolved || followOnAppend) {
        this.pendingScrollAnchor = [
          anchorResolved ? anchor[0] : null,
          anchorResolved ? anchor[1] : 0,
          followOnAppend,
          anchorDelta
        ];
      }
    };
    this.notify = (sync) => {
      var _a, _b;
      (_b = (_a = this.options).onChange) == null || _b.call(_a, this, sync);
    };
    this.maybeNotify = memo(() => {
      this.calculateRange();
      return [
        this.isScrolling,
        this.range ? this.range.startIndex : null,
        this.range ? this.range.endIndex : null
      ];
    }, (isScrolling) => {
      this.notify(isScrolling);
    }, {
      key: false,
      debug: () => this.options.debug,
      initialDeps: [
        this.isScrolling,
        this.range ? this.range.startIndex : null,
        this.range ? this.range.endIndex : null
      ]
    });
    this.cleanup = () => {
      this.unsubs.filter(Boolean).forEach((d) => d());
      this.unsubs = [];
      this.observer.disconnect();
      if (this.rafId != null && this.targetWindow) {
        this.targetWindow.cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      this.scrollState = null;
      this.isScrolling = false;
      this.scrollDirection = null;
      this._iosDeferredAdjustment = 0;
      this._iosTouching = false;
      this._iosJustTouchEnded = false;
      this._clampedAdjustment = null;
      this.scrollElement = null;
      this.targetWindow = null;
    };
    this._didMount = () => {
      return () => {
        this.cleanup();
      };
    };
    this._willUpdate = () => {
      var _a, _b;
      const scrollElement = this.options.enabled ? this.options.getScrollElement() : null;
      if (this.scrollElement !== scrollElement) {
        this.cleanup();
        if (!scrollElement) {
          this.maybeNotify();
          return;
        }
        this.scrollElement = scrollElement;
        if (this.scrollElement && "ownerDocument" in this.scrollElement) {
          this.targetWindow = this.scrollElement.ownerDocument.defaultView;
        } else {
          this.targetWindow = ((_a = this.scrollElement) == null ? undefined : _a.window) ?? null;
        }
        this.elementsCache.forEach((cached) => {
          this.observer.observe(cached);
        });
        this.unsubs.push(this.options.observeElementRect(this, (rect) => {
          this.scrollRect = rect;
          this.maybeNotify();
        }));
        this.unsubs.push(this.options.observeElementOffset(this, (offset, isScrolling) => {
          if (isScrolling && this._intendedScrollOffset === null && offset === this.scrollOffset) {
            return;
          }
          if (this._intendedScrollOffset !== null && Math.abs(offset - this._intendedScrollOffset) < 1.5) {
            offset = this._intendedScrollOffset;
          }
          this._intendedScrollOffset = null;
          if (this._clampedAdjustment !== null && Math.abs(offset - this._clampedAdjustment.maxAtWrite) >= 1.5) {
            this._clampedAdjustment = null;
          }
          this.scrollAdjustments = 0;
          const prevOffset = this.getScrollOffset();
          this.scrollDirection = isScrolling ? prevOffset === offset ? this.scrollDirection : prevOffset < offset ? "forward" : "backward" : null;
          this.scrollOffset = offset;
          this.isScrolling = isScrolling;
          this._flushIosDeferredIfReady();
          if (this.scrollState) {
            this.scheduleScrollReconcile();
          }
          this.maybeNotify();
        }));
        if ("addEventListener" in this.scrollElement) {
          const scrollEl = this.scrollElement;
          const onTouchStart = () => {
            this._iosTouching = true;
            this._iosJustTouchEnded = false;
            if (this._iosTouchEndTimerId !== null && this.targetWindow != null) {
              this.targetWindow.clearTimeout(this._iosTouchEndTimerId);
              this._iosTouchEndTimerId = null;
            }
          };
          const onTouchEnd = () => {
            this._iosTouching = false;
            if (!isIOSWebKit() || this.targetWindow == null) {
              return;
            }
            this._iosJustTouchEnded = true;
            this._iosTouchEndTimerId = this.targetWindow.setTimeout(() => {
              this._iosJustTouchEnded = false;
              this._iosTouchEndTimerId = null;
              this._flushIosDeferredIfReady();
            }, 150);
          };
          scrollEl.addEventListener("touchstart", onTouchStart, addEventListenerOptions);
          scrollEl.addEventListener("touchend", onTouchEnd, addEventListenerOptions);
          this.unsubs.push(() => {
            scrollEl.removeEventListener("touchstart", onTouchStart);
            scrollEl.removeEventListener("touchend", onTouchEnd);
            if (this._iosTouchEndTimerId !== null && this.targetWindow != null) {
              this.targetWindow.clearTimeout(this._iosTouchEndTimerId);
              this._iosTouchEndTimerId = null;
            }
          });
        }
        this._scrollToOffset(this.getScrollOffset(), {
          adjustments: undefined,
          behavior: undefined
        });
      }
      const anchor = this.pendingScrollAnchor;
      this.pendingScrollAnchor = null;
      if (anchor && this.scrollElement && this.options.enabled) {
        const [key, _offset, followOnAppend, anchorDelta] = anchor;
        if (key !== null && !followOnAppend) {
          if (isIOSWebKit() && (this.isScrolling || this._iosTouching || this._iosJustTouchEnded)) {
            if (anchorDelta !== 0) {
              this._iosDeferredAdjustment += anchorDelta;
            }
          } else if (((_b = this.scrollState) == null ? undefined : _b.behavior) === "smooth" && !approxEqual(this.getScrollOffset() - anchorDelta, this.scrollState.lastTargetOffset))
            ;
          else {
            this._scrollToOffset(this.getScrollOffset(), {
              adjustments: undefined,
              behavior: undefined
            });
          }
        }
        if (followOnAppend) {
          this.scrollToEnd({ behavior: followOnAppend });
        }
      }
      this._retryClampedAdjustment();
    };
    this._retryClampedAdjustment = () => {
      if (this._clampedAdjustment === null || !this.scrollElement || !this.options.enabled) {
        return;
      }
      const { target, maxAtWrite } = this._clampedAdjustment;
      const max = this.getMaxScrollOffset();
      if (max > maxAtWrite + 0.5) {
        this._clampedAdjustment = target > max + 0.5 ? { target, maxAtWrite: max } : null;
        this._scrollToOffset(target, {
          adjustments: undefined,
          behavior: undefined
        });
      }
    };
    this._flushIosDeferredIfReady = () => {
      if (this._iosDeferredAdjustment === 0)
        return;
      if (this.isScrolling)
        return;
      if (this._iosTouching)
        return;
      if (this._iosJustTouchEnded)
        return;
      const cur = this.getScrollOffset();
      const max = this.getMaxScrollOffset();
      if (cur < 0 || cur > max)
        return;
      if (this._iosDeferredAdjustment < 0 && cur >= max - 1) {
        this._iosDeferredAdjustment = 0;
        return;
      }
      const delta = this._iosDeferredAdjustment;
      this._iosDeferredAdjustment = 0;
      this._scrollToOffset(cur, {
        adjustments: this.scrollAdjustments += delta,
        behavior: undefined
      });
    };
    this.rafId = null;
    this.getSize = () => {
      if (!this.options.enabled) {
        this.scrollRect = null;
        return 0;
      }
      this.scrollRect = this.scrollRect ?? this.options.initialRect;
      return this.scrollRect[this.options.horizontal ? "width" : "height"];
    };
    this.getScrollOffset = () => {
      if (!this.options.enabled) {
        this.scrollOffset = null;
        return 0;
      }
      this.scrollOffset = this.scrollOffset ?? (typeof this.options.initialOffset === "function" ? this.options.initialOffset() : this.options.initialOffset);
      return this.scrollOffset;
    };
    this.getMeasurementOptions = memo(() => [
      this.options.count,
      this.options.paddingStart,
      this.options.scrollMargin,
      this.options.getItemKey,
      this.options.enabled,
      this.options.lanes,
      this.options.laneAssignmentMode,
      this.options.gap
    ], (count, paddingStart, scrollMargin, getItemKey, enabled, lanes, laneAssignmentMode, gap) => {
      const lanesChanged = this.prevLanes !== undefined && this.prevLanes !== lanes;
      if (lanesChanged) {
        this.lanesChangedFlag = true;
      }
      this.prevLanes = lanes;
      this.pendingMin = null;
      return {
        count,
        paddingStart,
        scrollMargin,
        getItemKey,
        enabled,
        lanes,
        laneAssignmentMode,
        gap
      };
    }, {
      key: false
    });
    this.isIndexInRange = (index2) => index2 >= 0 && index2 < this.options.count;
    this.getMeasurements = memo(() => [this.getMeasurementOptions(), this.itemSizeCacheVersion], ({
      count,
      paddingStart,
      scrollMargin,
      getItemKey,
      enabled,
      lanes,
      laneAssignmentMode,
      gap
    }, _itemSizeCacheVersion) => {
      var _a;
      const itemSizeCache = this.itemSizeCache;
      if (!enabled) {
        this.measurementsCache = [];
        this._singleLaneMeasurements = null;
        this.itemSizeCache.clear();
        this.laneAssignments.clear();
        return [];
      }
      if (this.laneAssignments.size > count) {
        for (const index2 of this.laneAssignments.keys()) {
          if (index2 >= count) {
            this.laneAssignments.delete(index2);
          }
        }
      }
      if (this.lanesChangedFlag) {
        this.lanesChangedFlag = false;
        this.lanesSettling = true;
        this.measurementsCache = [];
        this._singleLaneMeasurements = null;
        this.itemSizeCache.clear();
        this.laneAssignments.clear();
        this.pendingMin = null;
      }
      if (this.measurementsCache.length === 0 && !this.lanesSettling) {
        this.measurementsCache = this.options.initialMeasurementsCache;
        this.measurementsCache.forEach((item) => {
          this.itemSizeCache.set(item.key, item.size);
        });
      }
      const min = this.lanesSettling ? 0 : this.pendingMin ?? 0;
      this.pendingMin = null;
      if (this.lanesSettling && this.measurementsCache.length === count) {
        this.lanesSettling = false;
      }
      if (lanes === 1) {
        const need = count * 2;
        let flat = (_a = this._singleLaneMeasurements) == null ? undefined : _a.flat;
        if (!flat || flat.length < need) {
          const next = new Float64Array(need);
          if (flat && min > 0)
            next.set(flat.subarray(0, min * 2));
          flat = next;
        }
        const items = min === 0 ? new Array(count) : this._singleLaneMeasurements.items.slice();
        let runningStart;
        if (min === 0) {
          runningStart = paddingStart + scrollMargin;
        } else {
          const prevIdx = min - 1;
          runningStart = flat[prevIdx * 2] + flat[prevIdx * 2 + 1] + gap;
        }
        for (let i = min;i < count; i++) {
          const key = getItemKey(i);
          items[i] = key;
          const measuredSize = itemSizeCache.get(key);
          const size = typeof measuredSize === "number" ? measuredSize : this.options.estimateSize(i);
          flat[i * 2] = runningStart;
          flat[i * 2 + 1] = size;
          runningStart += size + gap;
        }
        this._singleLaneMeasurements = { flat, items };
        const view = createLazyMeasurementsView(items, flat);
        this.measurementsCache = view;
        return view;
      }
      const measurements = this.measurementsCache.slice(0, min);
      const laneLastIndex = new Array(lanes).fill(undefined);
      const laneEnds = new Float64Array(lanes);
      let filledLanes = 0;
      for (let m = 0;m < min; m++) {
        const item = measurements[m];
        if (item) {
          if (laneLastIndex[item.lane] === undefined)
            filledLanes++;
          laneLastIndex[item.lane] = m;
          laneEnds[item.lane] = item.end;
        }
      }
      for (let i = min;i < count; i++) {
        const key = getItemKey(i);
        const cachedLane = this.laneAssignments.get(i);
        let lane;
        let start;
        const shouldCacheLane = laneAssignmentMode === "estimate" || itemSizeCache.has(key);
        if (cachedLane !== undefined && this.options.lanes > 1) {
          lane = cachedLane;
          const prevIndex = laneLastIndex[lane];
          const prevInLane = prevIndex !== undefined ? measurements[prevIndex] : undefined;
          start = prevInLane ? prevInLane.end + gap : paddingStart + scrollMargin;
        } else if (filledLanes === lanes) {
          let bestLane = 0;
          let bestEnd = laneEnds[0];
          let bestIdx = laneLastIndex[0];
          for (let l = 1;l < lanes; l++) {
            const e = laneEnds[l];
            if (e < bestEnd || e === bestEnd && laneLastIndex[l] < bestIdx) {
              bestLane = l;
              bestEnd = e;
              bestIdx = laneLastIndex[l];
            }
          }
          lane = bestLane;
          start = bestEnd + gap;
          if (shouldCacheLane) {
            this.laneAssignments.set(i, lane);
          }
        } else {
          lane = i % this.options.lanes;
          start = paddingStart + scrollMargin;
          if (shouldCacheLane) {
            this.laneAssignments.set(i, lane);
          }
        }
        const measuredSize = itemSizeCache.get(key);
        const size = typeof measuredSize === "number" ? measuredSize : this.options.estimateSize(i);
        const end = start + size;
        measurements[i] = {
          index: i,
          start,
          size,
          end,
          key,
          lane
        };
        if (laneLastIndex[lane] === undefined)
          filledLanes++;
        laneLastIndex[lane] = i;
        laneEnds[lane] = end;
      }
      this.measurementsCache = measurements;
      return measurements;
    }, {
      key: false,
      debug: () => this.options.debug
    });
    this.calculateRange = memo(() => [
      this.getMeasurements(),
      this.getSize(),
      this.getScrollOffset(),
      this.options.lanes
    ], (measurements, outerSize, scrollOffset, lanes) => {
      if (measurements.length === 0 || outerSize === 0) {
        this.range = null;
        return null;
      }
      this.range = calculateRangeImpl(measurements, outerSize, scrollOffset, lanes, lanes === 1 && this._singleLaneMeasurements !== null ? this._singleLaneMeasurements.flat : null);
      return this.range;
    }, {
      key: false,
      debug: () => this.options.debug
    });
    this.getVirtualIndexes = memo(() => {
      let startIndex = null;
      let endIndex = null;
      const range = this.calculateRange();
      if (range) {
        startIndex = range.startIndex;
        endIndex = range.endIndex;
      }
      this.maybeNotify.updateDeps([this.isScrolling, startIndex, endIndex]);
      return [
        this.options.rangeExtractor,
        this.options.overscan,
        this.options.count,
        startIndex,
        endIndex
      ];
    }, (rangeExtractor, overscan, count, startIndex, endIndex) => {
      return startIndex === null || endIndex === null ? [] : rangeExtractor({
        startIndex,
        endIndex,
        overscan,
        count
      });
    }, {
      key: false,
      debug: () => this.options.debug
    });
    this.indexFromElement = (node) => {
      const attributeName = this.options.indexAttribute;
      const indexStr = node.getAttribute(attributeName);
      if (!indexStr) {
        console.warn(`Missing attribute name '${attributeName}={index}' on measured element.`);
        return -1;
      }
      return parseInt(indexStr, 10);
    };
    this.shouldMeasureDuringScroll = (index2) => {
      var _a;
      if (!this.scrollState || this.scrollState.behavior !== "smooth") {
        return true;
      }
      const scrollIndex = this.scrollState.index ?? ((_a = this.getVirtualItemForOffset(this.scrollState.lastTargetOffset)) == null ? undefined : _a.index);
      if (scrollIndex !== undefined && this.range) {
        const bufferSize = Math.max(this.options.overscan, Math.ceil((this.range.endIndex - this.range.startIndex) / 2));
        const minIndex = Math.max(0, scrollIndex - bufferSize);
        const maxIndex = Math.min(this.options.count - 1, scrollIndex + bufferSize);
        return index2 >= minIndex && index2 <= maxIndex;
      }
      return true;
    };
    this.measureElement = (node) => {
      if (!node) {
        this.elementsCache.forEach((cached, key2) => {
          if (!cached.isConnected) {
            this.observer.unobserve(cached);
            this.elementsCache.delete(key2);
          }
        });
        return;
      }
      const index2 = this.indexFromElement(node);
      if (!this.isIndexInRange(index2))
        return;
      const key = this.options.getItemKey(index2);
      const prevNode = this.elementsCache.get(key);
      if (prevNode !== node) {
        if (prevNode) {
          this.observer.unobserve(prevNode);
        }
        this.observer.observe(node);
        this.elementsCache.set(key, node);
      }
      if ((!this.isScrolling || this.scrollState) && this.shouldMeasureDuringScroll(index2)) {
        this.resizeItem(index2, this.options.measureElement(node, undefined, this));
      }
    };
    this.resizeItem = (index2, size) => {
      var _a, _b, _c;
      if (!this.isIndexInRange(index2))
        return;
      let cachedSize;
      let itemStart;
      let key;
      const flat = (_a = this._singleLaneMeasurements) == null ? undefined : _a.flat;
      if (this.options.lanes === 1 && flat != null) {
        key = this.options.getItemKey(index2);
        itemStart = flat[index2 * 2];
        cachedSize = flat[index2 * 2 + 1];
      } else {
        const item = this.measurementsCache[index2];
        if (!item)
          return;
        key = item.key;
        itemStart = item.start;
        cachedSize = item.size;
      }
      const itemSize = this.itemSizeCache.get(key) ?? cachedSize;
      const delta = size - itemSize;
      if (delta !== 0) {
        const wasAtEnd = this.options.anchorTo === "end" && ((_b = this.scrollState) == null ? undefined : _b.behavior) !== "smooth" && this.getVirtualDistanceFromEnd() <= this.options.scrollEndThreshold;
        const prevTotalSize = wasAtEnd ? this.getTotalSize() : 0;
        const scrollOffsetWithAdj = this.getScrollOffset() + this.scrollAdjustments;
        const isFirstMeasure = !this.itemSizeCache.has(key);
        const defaultShouldAdjust = isFirstMeasure ? itemStart < scrollOffsetWithAdj : itemStart + itemSize <= scrollOffsetWithAdj && this.scrollDirection !== "backward";
        const shouldAdjustScroll = ((_c = this.scrollState) == null ? undefined : _c.behavior) !== "smooth" && (this.shouldAdjustScrollPositionOnItemSizeChange !== undefined ? this.shouldAdjustScrollPositionOnItemSizeChange(this.measurementsCache[index2] ?? {
          index: index2,
          key,
          start: itemStart,
          size: cachedSize,
          end: itemStart + cachedSize,
          lane: 0
        }, delta, this) : defaultShouldAdjust);
        if (this.pendingMin === null || index2 < this.pendingMin) {
          this.pendingMin = index2;
        }
        this.itemSizeCache.set(key, size);
        this.itemSizeCacheVersion++;
        let adjustedSync = false;
        if (wasAtEnd) {
          adjustedSync = this.applyScrollAdjustment(this.getTotalSize() - prevTotalSize);
        } else if (shouldAdjustScroll) {
          adjustedSync = this.applyScrollAdjustment(delta);
        }
        this.notify(adjustedSync);
        this._retryClampedAdjustment();
      }
    };
    this.getVirtualItems = memo(() => [this.getVirtualIndexes(), this.getMeasurements()], (indexes, measurements) => {
      const virtualItems = [];
      for (let k = 0, len = indexes.length;k < len; k++) {
        const i = indexes[k];
        const measurement = measurements[i];
        virtualItems.push(measurement);
      }
      return virtualItems;
    }, {
      key: false,
      debug: () => this.options.debug
    });
    this.getVirtualItemForOffset = (offset) => {
      var _a;
      const measurements = this.getMeasurements();
      if (measurements.length === 0) {
        return;
      }
      const flat = (_a = this._singleLaneMeasurements) == null ? undefined : _a.flat;
      const useFlat = this.options.lanes === 1 && flat != null;
      const idx = findNearestBinarySearch(0, measurements.length - 1, useFlat ? (i) => flat[i * 2] : (i) => notUndefined(measurements[i]).start, offset);
      return notUndefined(measurements[idx]);
    };
    this.getMaxScrollOffset = () => {
      if (!this.scrollElement)
        return 0;
      if ("scrollHeight" in this.scrollElement) {
        return this.options.horizontal ? this.scrollElement.scrollWidth - this.scrollElement.clientWidth : this.scrollElement.scrollHeight - this.scrollElement.clientHeight;
      } else {
        const doc = this.scrollElement.document.documentElement;
        return this.options.horizontal ? doc.scrollWidth - this.scrollElement.innerWidth : doc.scrollHeight - this.scrollElement.innerHeight;
      }
    };
    this.getVirtualDistanceFromEnd = () => {
      return Math.max(this.getTotalSize() - this.getSize() - this.getScrollOffset(), 0);
    };
    this.getDistanceFromEnd = () => {
      return Math.max(this.getMaxScrollOffset() - this.getScrollOffset(), 0);
    };
    this.isAtEnd = (threshold = this.options.scrollEndThreshold) => {
      return this.getDistanceFromEnd() <= threshold;
    };
    this.getOffsetForAlignment = (toOffset, align, itemSize = 0) => {
      if (!this.scrollElement)
        return 0;
      const size = this.getSize();
      const scrollOffset = this.getScrollOffset();
      if (align === "auto") {
        align = toOffset >= scrollOffset + size ? "end" : "start";
      }
      if (align === "center") {
        toOffset += (itemSize - size) / 2;
      } else if (align === "end") {
        toOffset -= size;
      }
      const maxOffset = this.getMaxScrollOffset();
      return Math.max(Math.min(maxOffset, toOffset), 0);
    };
    this.getOffsetForIndex = (index2, align = "auto") => {
      index2 = Math.max(0, Math.min(index2, this.options.count - 1));
      const size = this.getSize();
      const scrollOffset = this.getScrollOffset();
      const item = this.measurementsCache[index2];
      if (!item)
        return;
      if (align === "auto") {
        if (item.end >= scrollOffset + size - this.options.scrollPaddingEnd) {
          align = "end";
        } else if (item.start <= scrollOffset + this.options.scrollPaddingStart) {
          align = "start";
        } else {
          return [scrollOffset, align];
        }
      }
      if (align === "end" && index2 === this.options.count - 1) {
        return [this.getMaxScrollOffset(), align];
      }
      const toOffset = align === "end" ? item.end + this.options.scrollPaddingEnd : item.start - this.options.scrollPaddingStart;
      return [
        this.getOffsetForAlignment(toOffset, align, item.size),
        align
      ];
    };
    this.scrollToOffset = (toOffset, { align = "start", behavior = "auto" } = {}) => {
      this._iosDeferredAdjustment = 0;
      const offset = this.getOffsetForAlignment(toOffset, align);
      const now = this.now();
      this.scrollState = {
        index: null,
        align,
        behavior,
        startedAt: now,
        lastTargetOffset: offset,
        stableFrames: 0
      };
      this._scrollToOffset(offset, { adjustments: undefined, behavior });
      this.scheduleScrollReconcile();
    };
    this.scrollToIndex = (index2, {
      align: initialAlign = "auto",
      behavior = "auto"
    } = {}) => {
      this._iosDeferredAdjustment = 0;
      index2 = Math.max(0, Math.min(index2, this.options.count - 1));
      const offsetInfo = this.getOffsetForIndex(index2, initialAlign);
      if (!offsetInfo) {
        return;
      }
      const [offset, align] = offsetInfo;
      const now = this.now();
      this.scrollState = {
        index: index2,
        align,
        behavior,
        startedAt: now,
        lastTargetOffset: offset,
        stableFrames: 0
      };
      this._scrollToOffset(offset, { adjustments: undefined, behavior });
      this.scheduleScrollReconcile();
    };
    this.scrollBy = (delta, { behavior = "auto" } = {}) => {
      const offset = this.getScrollOffset() + delta;
      const now = this.now();
      this.scrollState = {
        index: null,
        align: "start",
        behavior,
        startedAt: now,
        lastTargetOffset: offset,
        stableFrames: 0
      };
      this._scrollToOffset(offset, { adjustments: undefined, behavior });
      this.scheduleScrollReconcile();
    };
    this.scrollToEnd = ({ behavior = "auto" } = {}) => {
      if (this.options.count > 0) {
        this.scrollToIndex(this.options.count - 1, {
          align: "end",
          behavior
        });
        return;
      }
      this.scrollToOffset(Math.max(this.getTotalSize() - this.getSize(), 0), {
        behavior
      });
    };
    this.getTotalSize = () => {
      var _a, _b;
      const measurements = this.getMeasurements();
      let end;
      if (measurements.length === 0) {
        end = this.options.paddingStart;
      } else if (this.options.lanes === 1) {
        const lastIdx = measurements.length - 1;
        const flat = (_a = this._singleLaneMeasurements) == null ? undefined : _a.flat;
        if (flat != null) {
          end = flat[lastIdx * 2] + flat[lastIdx * 2 + 1];
        } else {
          end = ((_b = measurements[lastIdx]) == null ? undefined : _b.end) ?? 0;
        }
      } else {
        const endByLane = Array(this.options.lanes).fill(null);
        let endIndex = measurements.length - 1;
        while (endIndex >= 0 && endByLane.some((val) => val === null)) {
          const item = measurements[endIndex];
          if (endByLane[item.lane] === null) {
            endByLane[item.lane] = item.end;
          }
          endIndex--;
        }
        end = Math.max(...endByLane.filter((val) => val !== null));
      }
      return Math.max(end - this.options.scrollMargin + this.options.paddingEnd, 0);
    };
    this.takeSnapshot = () => {
      const snapshot = [];
      if (this.itemSizeCache.size === 0)
        return snapshot;
      const m = this.getMeasurements();
      for (const item of m) {
        if (item && this.itemSizeCache.has(item.key)) {
          snapshot.push({
            index: item.index,
            key: item.key,
            start: item.start,
            size: item.size,
            end: item.end,
            lane: item.lane
          });
        }
      }
      return snapshot;
    };
    this._scrollToOffset = (offset, {
      adjustments,
      behavior
    }) => {
      this._intendedScrollOffset = offset + (adjustments ?? 0);
      this.options.scrollToFn(offset, { behavior, adjustments }, this);
    };
    this.measure = () => {
      this.pendingMin = null;
      this.itemSizeCache.clear();
      this.laneAssignments.clear();
      this.itemSizeCacheVersion++;
      this.notify(false);
    };
    this.setOptions(opts);
  }
  applyScrollAdjustment(delta, behavior) {
    if (delta === 0)
      return false;
    if (false) {}
    if (isIOSWebKit() && (this.isScrolling || this._iosTouching || this._iosJustTouchEnded)) {
      this._iosDeferredAdjustment += delta;
      return false;
    } else {
      const target = this.getScrollOffset() + this.scrollAdjustments + delta;
      const el = this.scrollElement;
      const maxAtWrite = el !== null && (("scrollHeight" in el) || ("document" in el)) ? this.getMaxScrollOffset() : null;
      this._clampedAdjustment = maxAtWrite !== null && target > maxAtWrite + 0.5 ? { target, maxAtWrite } : null;
      this._scrollToOffset(this.getScrollOffset(), {
        adjustments: this.scrollAdjustments += delta,
        behavior
      });
      if (this.scrollOffset !== null) {
        this.scrollOffset += this.scrollAdjustments;
        if (this.scrollOffset < 0)
          this.scrollOffset = 0;
        this.scrollAdjustments = 0;
      }
      return true;
    }
  }
  scheduleScrollReconcile() {
    if (!this.targetWindow) {
      this.scrollState = null;
      return;
    }
    if (this.rafId != null)
      return;
    this.rafId = this.targetWindow.requestAnimationFrame(() => {
      this.rafId = null;
      this.reconcileScroll();
    });
  }
  reconcileScroll() {
    if (!this.scrollState)
      return;
    const el = this.scrollElement;
    if (!el)
      return;
    const MAX_RECONCILE_MS = 5000;
    if (this.now() - this.scrollState.startedAt > MAX_RECONCILE_MS) {
      this.scrollState = null;
      return;
    }
    const offsetInfo = this.scrollState.index != null ? this.getOffsetForIndex(this.scrollState.index, this.scrollState.align) : undefined;
    const targetOffset = offsetInfo ? offsetInfo[0] : this.scrollState.lastTargetOffset;
    const STABLE_FRAMES = 1;
    const targetChanged = targetOffset !== this.scrollState.lastTargetOffset;
    if (!targetChanged && approxEqual(targetOffset, this.getScrollOffset())) {
      this.scrollState.stableFrames++;
      if (this.scrollState.stableFrames >= STABLE_FRAMES) {
        if (this.getScrollOffset() !== targetOffset) {
          this._scrollToOffset(targetOffset, {
            adjustments: undefined,
            behavior: "auto"
          });
        }
        this.scrollState = null;
        return;
      }
    } else {
      this.scrollState.stableFrames = 0;
      if (targetChanged) {
        const viewport = this.getSize() || 600;
        const distance = Math.abs(targetOffset - this.getScrollOffset());
        const keepSmooth = this.scrollState.behavior === "smooth" && distance > viewport;
        this.scrollState.lastTargetOffset = targetOffset;
        if (!keepSmooth) {
          this.scrollState.behavior = "auto";
        }
        this._scrollToOffset(targetOffset, {
          adjustments: undefined,
          behavior: keepSmooth ? "smooth" : "auto"
        });
      }
    }
    this.scheduleScrollReconcile();
  }
}
var findNearestBinarySearch = (low, high, getCurrentValue, value) => {
  while (low <= high) {
    const middle = (low + high) / 2 | 0;
    const currentValue = getCurrentValue(middle);
    if (currentValue < value) {
      low = middle + 1;
    } else if (currentValue > value) {
      high = middle - 1;
    } else {
      return middle;
    }
  }
  if (low > 0) {
    return low - 1;
  } else {
    return 0;
  }
};
function findNearestBinarySearchFlat(flat, high, value) {
  let low = 0;
  while (low <= high) {
    const middle = (low + high) / 2 | 0;
    const currentValue = flat[middle * 2];
    if (currentValue < value) {
      low = middle + 1;
    } else if (currentValue > value) {
      high = middle - 1;
    } else {
      return middle;
    }
  }
  return low > 0 ? low - 1 : 0;
}
function calculateRangeImpl(measurements, outerSize, scrollOffset, lanes, flat) {
  const lastIndex = measurements.length - 1;
  if (measurements.length <= lanes) {
    return { startIndex: 0, endIndex: lastIndex };
  }
  if (lanes === 1 && flat !== null) {
    const startIndex2 = findNearestBinarySearchFlat(flat, lastIndex, scrollOffset);
    let endIndex2 = startIndex2;
    const limit = scrollOffset + outerSize;
    while (endIndex2 < lastIndex && flat[endIndex2 * 2] + flat[endIndex2 * 2 + 1] < limit) {
      endIndex2++;
    }
    return { startIndex: startIndex2, endIndex: endIndex2 };
  }
  const getStart = (index2) => measurements[index2].start;
  let startIndex = findNearestBinarySearch(0, lastIndex, getStart, scrollOffset);
  let endIndex = startIndex;
  if (lanes === 1) {
    while (endIndex < lastIndex && measurements[endIndex].end < scrollOffset + outerSize) {
      endIndex++;
    }
  } else if (lanes > 1) {
    const endPerLane = Array(lanes).fill(0);
    while (endIndex < lastIndex && endPerLane.some((pos) => pos < scrollOffset + outerSize)) {
      const item = measurements[endIndex];
      endPerLane[item.lane] = item.end;
      endIndex++;
    }
    const startPerLane = Array(lanes).fill(scrollOffset + outerSize);
    while (startIndex >= 0 && startPerLane.some((pos) => pos >= scrollOffset)) {
      const item = measurements[startIndex];
      startPerLane[item.lane] = item.start;
      startIndex--;
    }
    startIndex = Math.max(0, startIndex - startIndex % lanes);
    endIndex = Math.min(lastIndex, endIndex + (lanes - 1 - endIndex % lanes));
  }
  return { startIndex, endIndex };
}

// ../../node_modules/@tanstack/react-virtual/dist/esm/index.js
var useIsomorphicLayoutEffect = typeof document !== "undefined" ? React2.useLayoutEffect : React2.useEffect;
function useVirtualizerBase({
  useFlushSync = true,
  directDomUpdates = false,
  directDomUpdatesMode = "transform",
  ...options
}) {
  const rerender = React2.useReducer((x) => x + 1, 0)[1];
  const directRef = React2.useRef({
    enabled: directDomUpdates,
    mode: directDomUpdatesMode,
    container: null,
    lastSize: null,
    lastPositions: /* @__PURE__ */ new WeakMap,
    prevRange: null
  });
  directRef.current.enabled = directDomUpdates;
  directRef.current.mode = directDomUpdatesMode;
  const measuringFromRef = React2.useRef(false);
  const applyContainerSize = (instance22) => {
    const state = directRef.current;
    if (!state.enabled || !state.container)
      return;
    const totalSize = instance22.getTotalSize();
    if (totalSize !== state.lastSize) {
      state.lastSize = totalSize;
      const sizeAxis = instance22.options.horizontal ? "width" : "height";
      state.container.style[sizeAxis] = `${totalSize}px`;
    }
  };
  const applyDirectStyles = (instance22) => {
    const state = directRef.current;
    if (!state.enabled || !state.container)
      return;
    applyContainerSize(instance22);
    const horizontal = !!instance22.options.horizontal;
    const useTransform = state.mode === "transform";
    const posAxis = horizontal ? "left" : "top";
    const scrollMargin = instance22.options.scrollMargin;
    const items = instance22.getVirtualItems();
    for (const item of items) {
      const next = item.start - scrollMargin;
      const el = instance22.elementsCache.get(item.key);
      if (!el)
        continue;
      if (state.lastPositions.get(el) === next)
        continue;
      state.lastPositions.set(el, next);
      if (useTransform) {
        el.style.transform = horizontal ? `translate3d(${next}px, 0, 0)` : `translate3d(0, ${next}px, 0)`;
      } else {
        el.style[posAxis] = `${next}px`;
      }
    }
  };
  const resolvedOptions = {
    ...options,
    onChange: (instance22, sync) => {
      var _a;
      const state = directRef.current;
      let shouldRerender = true;
      if (state.enabled) {
        applyDirectStyles(instance22);
        const range = instance22.range;
        const prev = state.prevRange;
        shouldRerender = !prev || prev.isScrolling !== instance22.isScrolling || prev.startIndex !== (range == null ? undefined : range.startIndex) || prev.endIndex !== (range == null ? undefined : range.endIndex);
        if (shouldRerender) {
          state.prevRange = range ? {
            startIndex: range.startIndex,
            endIndex: range.endIndex,
            isScrolling: instance22.isScrolling
          } : null;
        }
      }
      if (shouldRerender) {
        if (useFlushSync && sync && !measuringFromRef.current) {
          import_react_dom.flushSync(rerender);
        } else {
          rerender();
        }
      }
      (_a = options.onChange) == null || _a.call(options, instance22, sync);
    }
  };
  const [instance2] = React2.useState(() => {
    const v = new Virtualizer(resolvedOptions);
    const measureElement2 = v.measureElement;
    v.measureElement = (node) => {
      measuringFromRef.current = true;
      try {
        measureElement2(node);
      } finally {
        measuringFromRef.current = false;
      }
    };
    return Object.assign(v, {
      containerRef: (node) => {
        const state = directRef.current;
        state.container = node;
        state.lastSize = null;
        if (node && state.enabled) {
          const total = v.getTotalSize();
          state.lastSize = total;
          const axis = v.options.horizontal ? "width" : "height";
          node.style[axis] = `${total}px`;
        }
      }
    });
  });
  instance2.setOptions(resolvedOptions);
  useIsomorphicLayoutEffect(() => {
    return instance2._didMount();
  }, []);
  useIsomorphicLayoutEffect(() => {
    applyContainerSize(instance2);
    return instance2._willUpdate();
  });
  useIsomorphicLayoutEffect(() => {
    applyDirectStyles(instance2);
  });
  return instance2;
}
function useVirtualizer(options) {
  return useVirtualizerBase({
    observeElementRect,
    observeElementOffset,
    scrollToFn: elementScroll,
    ...options
  });
}

// src/components/transcript/Transcript.tsx
var import_react15 = __toESM(require_react(), 1);

// ../utils/src/marked/inline-closers.ts
var PUNCTUATION = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/;
function escapedAt(src, index2) {
  let at = index2 - 1;
  while (at >= 0 && src.charCodeAt(at) === 92)
    at--;
  return (index2 - 1 - at) % 2 === 1;
}
function canOpenDelimiter(src, index2, width, marker, previous = `
`) {
  const before = index2 === 0 ? previous : src[index2 - 1];
  if (index2 === 0 && before === marker)
    return false;
  const after = src[index2 + width];
  if (after === undefined || /\s/.test(after))
    return false;
  if (marker === "_" && /[\p{L}\p{N}]/u.test(before) && /[\p{L}\p{N}]/u.test(after))
    return false;
  return true;
}
function canCloseDelimiter(src, index2, marker) {
  const before = src[index2 - 1];
  const after = src[index2 + 1] ?? `
`;
  if (before === undefined || /\s/.test(before))
    return false;
  if (marker === "_" && /[\p{L}\p{N}]/u.test(before) && /[\p{L}\p{N}]/u.test(after))
    return false;
  return !PUNCTUATION.test(before) || /\s/.test(after) || PUNCTUATION.test(after);
}
function lowerBound(values, target) {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const mid = low + high >>> 1;
    if (values[mid] < target)
      low = mid + 1;
    else
      high = mid;
  }
  return low;
}

class ClosersByDepth {
  #offsets = new Map;
  add(depth, offset) {
    let offsets = this.#offsets.get(depth);
    if (!offsets)
      this.#offsets.set(depth, offsets = []);
    offsets.push(offset);
  }
  first(depth, from) {
    const offsets = this.#offsets.get(depth);
    if (!offsets)
      return -1;
    const at = lowerBound(offsets, from);
    return at === offsets.length ? -1 : offsets[at];
  }
}

class BracketDepths {
  #depth;
  #closers = new ClosersByDepth;
  #all = [];
  constructor(src, open, close) {
    const depth = new Int32Array(src.length + 1);
    let level = 0;
    for (let i = 0;i < src.length; i++) {
      depth[i] = level;
      const code = src.charCodeAt(i);
      if (code === 92) {
        depth[++i] = level;
      } else if (code === open) {
        level++;
      } else if (code === close) {
        this.#closers.add(level, i);
        this.#all.push(i);
        level--;
      }
    }
    depth[src.length] = level;
    this.#depth = depth;
  }
  closeAfter(start) {
    return this.#closers.first(this.#depth[start], start);
  }
  closesWithin(from, to) {
    const at = lowerBound(this.#all, from);
    return at < this.#all.length && this.#all[at] < to;
  }
}

class EmphasisDelimiters {
  #src;
  #marker;
  #width;
  #at = [];
  #depth = [];
  #closers = new ClosersByDepth;
  constructor(src, marker, width) {
    this.#src = src;
    this.#marker = marker;
    this.#width = width;
    let level = 0;
    for (let run = src.indexOf(marker);run !== -1; ) {
      let end = run + 1;
      while (src[end] === marker)
        end++;
      for (let at = escapedAt(src, run) ? run + width : run;at + width <= end; at += width) {
        this.#at.push(at);
        this.#depth.push(level);
        if (canCloseDelimiter(src, at, marker)) {
          this.#closers.add(level, at);
          level--;
        } else if (canOpenDelimiter(src, at, width, marker)) {
          level++;
        }
      }
      run = src.indexOf(marker, end);
    }
  }
  closeFor(opener, end) {
    const src = this.#src;
    const marker = this.#marker;
    const width = this.#width;
    const walk = opener + width;
    if (width === 2 && src[walk] === marker && src[walk + 1] === marker)
      return walk + width <= end ? walk : -1;
    const next = lowerBound(this.#at, walk);
    if (next === this.#at.length)
      return -1;
    const close = this.#closers.first(this.#depth[next], this.#at[next]);
    return close !== -1 && close + width <= end ? close : -1;
  }
}

class CodeRuns {
  #starts = [];
  #ends = [];
  #escaped = [];
  #widest;
  #leaves;
  constructor(src) {
    const widths = [];
    for (let at = src.indexOf("`");at !== -1; ) {
      let end = at + 1;
      while (src.charCodeAt(end) === 96)
        end++;
      const escaped = escapedAt(src, at);
      this.#starts.push(at);
      this.#ends.push(end);
      this.#escaped.push(escaped);
      widths.push(escaped ? end - at >> 1 : end - at);
      at = src.indexOf("`", end);
    }
    let leaves = 1;
    while (leaves < widths.length)
      leaves <<= 1;
    const widest = new Int32Array(2 * leaves);
    for (let run = 0;run < widths.length; run++)
      widest[leaves + run] = widths[run];
    for (let node = leaves - 1;node >= 1; node--)
      widest[node] = Math.max(widest[2 * node], widest[2 * node + 1]);
    this.#widest = widest;
    this.#leaves = leaves;
  }
  endOf(at) {
    return this.#ends[lowerBound(this.#starts, at + 1) - 1];
  }
  closerAfter(from, width) {
    const run = this.#firstHolding(lowerBound(this.#starts, from), width);
    return run === -1 ? -1 : this.#starts[run] + (this.#escaped[run] ? width : 0);
  }
  #firstHolding(first, width) {
    if (first >= this.#starts.length)
      return -1;
    const widest = this.#widest;
    const leaves = this.#leaves;
    let node = leaves + first;
    if (widest[node] >= width)
      return first;
    for (;; ) {
      if (node === 1)
        return -1;
      if ((node & 1) === 0 && widest[node + 1] >= width)
        break;
      node >>= 1;
    }
    node++;
    while (node < leaves)
      node = widest[2 * node] >= width ? 2 * node : 2 * node + 1;
    return node - leaves;
  }
}

class CloserIndexes {
  #src;
  #square;
  #round;
  #emphasis = new Map;
  #tagEnds;
  #commentEnds;
  #escapes;
  #codeRuns;
  #space = -1;
  #angle = -1;
  constructor(src) {
    this.#src = src;
  }
  get square() {
    return this.#square ??= new BracketDepths(this.#src, 91, 93);
  }
  get round() {
    return this.#round ??= new BracketDepths(this.#src, 40, 41);
  }
  emphasis(marker, width) {
    const key = marker.repeat(width);
    let delimiters = this.#emphasis.get(key);
    if (!delimiters)
      this.#emphasis.set(key, delimiters = new EmphasisDelimiters(this.#src, marker, width));
    return delimiters;
  }
  get tagEnds() {
    if (this.#tagEnds)
      return this.#tagEnds;
    const src = this.#src;
    const ends = new Int32Array(src.length + 1);
    ends[src.length] = -1;
    let nextDouble = -1;
    let nextSingle = -1;
    for (let at = src.length - 1;at >= 0; at--) {
      const code = src.charCodeAt(at);
      if (code === 62) {
        ends[at] = at;
      } else if (code === 34) {
        ends[at] = nextDouble === -1 ? -1 : ends[nextDouble + 1];
        nextDouble = at;
      } else if (code === 39) {
        ends[at] = nextSingle === -1 ? -1 : ends[nextSingle + 1];
        nextSingle = at;
      } else {
        ends[at] = ends[at + 1];
      }
    }
    return this.#tagEnds = ends;
  }
  get commentEnds() {
    if (this.#commentEnds)
      return this.#commentEnds;
    const src = this.#src;
    const ends = [];
    for (let at = src.indexOf("-->");at !== -1; at = src.indexOf("-->", at + 1))
      ends.push(at);
    return this.#commentEnds = ends;
  }
  get codeRuns() {
    return this.#codeRuns ??= new CodeRuns(this.#src);
  }
  spaceOrAngleFrom(from) {
    const src = this.#src;
    if (this.#space < from) {
      const at = src.indexOf(" ", from);
      this.#space = at === -1 ? Infinity : at;
    }
    if (this.#angle < from) {
      const at = src.indexOf(">", from);
      this.#angle = at === -1 ? Infinity : at;
    }
    return Math.min(this.#space, this.#angle);
  }
  get escapes() {
    if (this.#escapes)
      return this.#escapes;
    const src = this.#src;
    const escapes = [];
    for (let at = src.indexOf("\\");at !== -1; at = src.indexOf("\\", at + 1)) {
      if (PUNCTUATION.test(src[at + 1] ?? ""))
        escapes.push(at);
    }
    return this.#escapes = escapes;
  }
}

class InlineClosers {
  #indexes;
  end;
  constructor(indexes, end) {
    this.#indexes = indexes;
    this.end = end;
  }
  nested(rest, end) {
    return new InlineClosers(this.#indexes, this.end - rest.length + end);
  }
  closeSquare(rest, start) {
    return this.#close(this.#indexes.square, rest, start);
  }
  closeRound(rest, start) {
    return this.#close(this.#indexes.round, rest, start);
  }
  squareCloserWithin(rest, from, to) {
    const pos = this.end - rest.length;
    return this.#indexes.square.closesWithin(pos + from, pos + to);
  }
  escapeWithin(rest, from, to) {
    const pos = this.end - rest.length;
    const escapes = this.#indexes.escapes;
    const at = lowerBound(escapes, pos + from);
    return at < escapes.length && escapes[at] + 1 < pos + to;
  }
  closeEmphasis(rest, marker, width) {
    const pos = this.end - rest.length;
    const close = this.#indexes.emphasis(marker, width).closeFor(pos, this.end);
    return close === -1 ? -1 : close - pos;
  }
  codeOpenerWidth(rest) {
    const pos = this.end - rest.length;
    return Math.min(this.#indexes.codeRuns.endOf(pos), this.end) - pos;
  }
  closeCode(rest, width) {
    const pos = this.end - rest.length;
    const close = this.#indexes.codeRuns.closerAfter(pos + width, width);
    return close === -1 || close + width > this.end ? -1 : close - pos;
  }
  closeUrlAutolink(rest, from) {
    const pos = this.end - rest.length;
    const close = this.#indexes.spaceOrAngleFrom(pos + from) - pos;
    return close > from && rest.charCodeAt(close) === 62 ? close : -1;
  }
  closeTag(rest) {
    const pos = this.end - rest.length;
    const close = this.#indexes.tagEnds[pos + 1];
    return close === -1 || close >= this.end ? -1 : close - pos;
  }
  closeComment(rest) {
    const pos = this.end - rest.length;
    const ends = this.#indexes.commentEnds;
    const at = lowerBound(ends, pos + 4);
    return at === ends.length || ends[at] + 3 > this.end ? -1 : ends[at] - pos;
  }
  #close(depths, rest, start) {
    const pos = this.end - rest.length;
    const close = depths.closeAfter(pos + start);
    return close === -1 || close >= this.end ? -1 : close - pos;
  }
}

// ../utils/src/marked/inline-text.ts
var TOKEN_START_CHAR = /[\\`<[!*_~\n]/g;
var BARE_URL_SCHEME = /https?:\/\/|ftp:\/\/|www\./gi;
var DOTTED_DOMAIN = /[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+/iy;
var UNSEARCHED = -1;
function isMailLocalChar(code) {
  return code >= 97 && code <= 122 || code >= 65 && code <= 90 || code >= 48 && code <= 57 || code === 46 || code === 95 || code === 43 || code === 45;
}
function askStartFrom(extension, startFrom, lexer, src, from) {
  const found = startFrom.call({ lexer }, src, from);
  if (found !== undefined && !(typeof found === "number" && found >= from)) {
    throw new Error(`inline extension "${extension.name}": startFrom returned ${found} for offset ${from}`);
  }
  return found ?? Infinity;
}

class RootTextStops {
  #src;
  #tokenChar = UNSEARCHED;
  #scheme = UNSEARCHED;
  #schemeEnd = UNSEARCHED;
  #mail = UNSEARCHED;
  #mailAt = UNSEARCHED;
  #hardBreak = UNSEARCHED;
  #hardBreakAt = UNSEARCHED;
  #extensionStarts;
  constructor(src) {
    this.#src = src;
  }
  tokenCharFrom(from) {
    if (this.#tokenChar < from) {
      TOKEN_START_CHAR.lastIndex = from;
      this.#tokenChar = TOKEN_START_CHAR.test(this.#src) ? TOKEN_START_CHAR.lastIndex - 1 : Infinity;
    }
    return this.#tokenChar;
  }
  schemeFrom(from, end) {
    if (this.#scheme < from) {
      BARE_URL_SCHEME.lastIndex = from;
      const match = BARE_URL_SCHEME.exec(this.#src);
      this.#scheme = match ? match.index : Infinity;
      this.#schemeEnd = match ? BARE_URL_SCHEME.lastIndex : Infinity;
    }
    return this.#schemeEnd <= end ? this.#scheme : Infinity;
  }
  get mailAt() {
    return this.#mailAt;
  }
  mailFrom(from, end) {
    if (this.#mail < from)
      this.#mail = from < this.#mailAt ? from : this.#seekMail(from);
    return this.#mailAt < end ? this.#mail : Infinity;
  }
  hardBreakFrom(from, end) {
    if (this.#hardBreak < from)
      this.#hardBreak = this.#seekHardBreak(from);
    return this.#hardBreakAt < end ? this.#hardBreak : Infinity;
  }
  startFrom(extension, startFrom, lexer, from) {
    const starts = this.#extensionStarts ??= new Map;
    const cached = starts.get(extension) ?? UNSEARCHED;
    if (cached >= from)
      return cached;
    const start = askStartFrom(extension, startFrom, lexer, this.#src, from);
    starts.set(extension, start);
    return start;
  }
  #seekMail(from) {
    const src = this.#src;
    for (let at = src.indexOf("@", from + 1);at !== -1; at = src.indexOf("@", at + 1)) {
      let start = at;
      while (start > from && isMailLocalChar(src.charCodeAt(start - 1)))
        start--;
      if (start < at) {
        this.#mailAt = at;
        return start;
      }
    }
    return Infinity;
  }
  #seekHardBreak(from) {
    const src = this.#src;
    for (let end = src.indexOf(`
`, from + 1);end !== -1; end = src.indexOf(`
`, end + 1)) {
      let start = end;
      while (start > from && src.charCodeAt(start - 1) === 32)
        start--;
      if (end - start < 2) {
        if (src.charCodeAt(end - 1) !== 92)
          continue;
        start = end - 1;
      }
      this.#hardBreakAt = end;
      return start;
    }
    return Infinity;
  }
}

class TextStops {
  #src;
  #lexer;
  #root;
  #start;
  #end;
  #isRoot;
  #domainAt = UNSEARCHED;
  #dottedDomain = false;
  #extensionStarts;
  constructor(src, lexer, root, end = src.length) {
    this.#src = src;
    this.#lexer = lexer;
    this.#root = root ?? new RootTextStops(src);
    this.#start = end - src.length;
    this.#end = end;
    this.#isRoot = root === undefined;
  }
  nested(src, end) {
    return new TextStops(src, this.#lexer, this.#root, end);
  }
  bareUrlCanStart(pos) {
    const root = this.#root;
    const at = this.#start + pos;
    if (root.schemeFrom(at, this.#end) === at)
      return true;
    if (root.mailFrom(at, this.#end) !== at)
      return false;
    const mailAt = root.mailAt - this.#start;
    if (this.#domainAt !== mailAt) {
      this.#domainAt = mailAt;
      DOTTED_DOMAIN.lastIndex = mailAt + 1;
      this.#dottedDomain = DOTTED_DOMAIN.test(this.#src);
    }
    return this.#dottedDomain;
  }
  textLength(rest) {
    const root = this.#root;
    const end = this.#end;
    const pos = this.#src.length - rest.length;
    const at = this.#start + pos;
    const from = at + 1;
    let next = Math.min(end, root.tokenCharFrom(from), root.schemeFrom(from, end), root.mailFrom(from, end), root.hardBreakFrom(from, end)) - at;
    const lexer = this.#lexer;
    const extensions = lexer.extensions.inline;
    if (extensions.length !== 0) {
      for (const extension of extensions) {
        const hint = extension.startFrom ? this.#startFrom(extension, extension.startFrom, pos) - pos : extension.start?.call({ lexer }, rest);
        if (typeof hint === "number" && hint > 0 && hint < next)
          next = hint;
      }
    }
    return Math.trunc(next);
  }
  #startFrom(extension, startFrom, pos) {
    const root = this.#root;
    const lexer = this.#lexer;
    if (this.#isRoot)
      return root.startFrom(extension, startFrom, lexer, pos);
    const starts = this.#extensionStarts ??= new Map;
    const cached = starts.get(extension) ?? UNSEARCHED;
    if (cached >= pos)
      return cached;
    const candidate = root.startFrom(extension, startFrom, lexer, this.#start + pos) - this.#start;
    const start = candidate < this.#src.length ? askStartFrom(extension, startFrom, lexer, this.#src, candidate) : Infinity;
    starts.set(extension, start);
    return start;
  }
}

class TextRun {
  #src;
  #token;
  #start = 0;
  #end = 0;
  #value = "";
  constructor(src) {
    this.#src = src;
  }
  append(tokens, start, end) {
    if (end <= start)
      return;
    const previous = tokens.at(-1);
    if (previous?.type === "text" && previous.tokens === undefined && previous.escaped === false) {
      if (previous === this.#token && start === this.#end && previous.raw === this.#value && previous.text === this.#value) {
        this.#end = end;
        this.#value = this.#src.slice(this.#start, end);
        previous.raw = this.#value;
        previous.text = this.#value;
        return;
      }
      const raw2 = this.#src.slice(start, end);
      previous.raw += raw2;
      previous.text += raw2;
      return;
    }
    const raw = this.#src.slice(start, end);
    this.#token = { type: "text", raw, text: raw, escaped: false };
    this.#start = start;
    this.#end = end;
    this.#value = raw;
    tokens.push(this.#token);
  }
}

// ../utils/src/marked/core.ts
function isKnownToken(token) {
  switch (token.type) {
    case "blockquote":
    case "br":
    case "checkbox":
    case "code":
    case "codespan":
    case "def":
    case "del":
    case "em":
    case "escape":
    case "heading":
    case "hr":
    case "html":
    case "image":
    case "link":
    case "list":
    case "list_item":
    case "paragraph":
    case "space":
    case "strong":
    case "table":
    case "text":
      return true;
    default:
      return false;
  }
}
var DEFAULTS = {
  async: false,
  breaks: false,
  gfm: true,
  pedantic: false,
  silent: false,
  tokenizer: null,
  renderer: null,
  walkTokens: null,
  extensions: null
};
function tokenList(links = Object.create(null)) {
  const list = [];
  list.links = links;
  return list;
}
function normalizeSource(src) {
  return src.replace(/\r\n|\r/g, `
`).replace(/\t/g, "    ");
}
function unescapeMarkdown(value) {
  return value.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, "$1");
}
function cleanUrl(value) {
  return unescapeMarkdown(value.trim().replace(/^<|>$/g, ""));
}
function escapeHtml(value, encode = true) {
  let out = value.replace(/&(?!(?:#\d+|#x[\da-f]+|\w+);)/gi, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  if (!encode)
    out = out.replace(/&amp;(#\d+|#x[\da-f]+|\w+);/gi, "&$1;");
  return out;
}
function findDelimiter(src, delimiter, from) {
  let at = src.indexOf(delimiter, from);
  while (at !== -1 && escapedAt(src, at))
    at = src.indexOf(delimiter, at + delimiter.length);
  return at;
}
function autolinkPrefix(src, closers) {
  const scheme = /^<(?:https?:\/\/|ftp:\/\/)/i.exec(src);
  if (!scheme)
    return /^<[^ <>@]+@[^ <>@]+>/.exec(src)?.[0];
  const close = closers.closeUrlAutolink(src, scheme[0].length);
  return close === -1 ? undefined : src.slice(0, close + 1);
}
function inlineHtmlPrefix(src, closers) {
  if (src.startsWith("<!--")) {
    const end2 = closers.closeComment(src);
    return end2 === -1 ? undefined : src.slice(0, end2 + 3);
  }
  if (!/^<\/?[A-Za-z][A-Za-z0-9-]*(?:\s|\/?>)/.test(src))
    return;
  const end = closers.closeTag(src);
  return end === -1 ? undefined : src.slice(0, end + 1);
}

class Tokenizer {
  options;
  lexer;
  constructor(options = {}) {
    this.options = options;
  }
  del(src) {
    if (!src.startsWith("~~") || /\s/.test(src[2] ?? ""))
      return;
    const end = findDelimiter(src, "~~", 2);
    if (end < 2 || /\s/.test(src[end - 1] ?? ""))
      return;
    const text = src.slice(2, end);
    return { type: "del", raw: src.slice(0, end + 2), text, tokens: this.lexer.inlineTokens(text) };
  }
}
var offered;
function openInlineSource(src, lexer, output) {
  const offer = offered;
  offered = undefined;
  const shared = offer?.lexer === lexer && offer.nested.src === src ? offer : undefined;
  const closers = shared ? shared.nested.closers : new InlineClosers(new CloserIndexes(src), src.length);
  return {
    src,
    lexer,
    output,
    closers,
    stops: shared ? shared.outer.stops.nested(src, closers.end) : new TextStops(src, lexer),
    textRun: new TextRun(src),
    context: shared ? shared.outer.context : { lexer, source: src, end: src.length },
    rest: src
  };
}
function hasDefinitions(links) {
  if (Object.getPrototypeOf(links) !== null)
    return true;
  for (const _label in links)
    return true;
  return false;
}
function matchLink(src, lexer, closers) {
  const image = src.startsWith("![");
  if (!(image || src.startsWith("[")))
    return;
  const labelStart = image ? 2 : 1;
  const labelEnd = closers.closeSquare(src, labelStart);
  if (labelEnd === -1)
    return;
  const label = src.slice(labelStart, labelEnd);
  if (src[labelEnd + 1] === "(") {
    const destinationEnd = closers.closeRound(src, labelEnd + 2);
    if (destinationEnd === -1)
      return;
    const inside = src.slice(labelEnd + 2, destinationEnd).trim();
    let href = inside;
    let title = null;
    const titleMatch = /^(<[^>]*>|\S+?)(?:\s+(?:"([\s\S]*)"|'([\s\S]*)'|\(([\s\S]*)\)))?$/.exec(inside);
    if (!titleMatch)
      return;
    href = cleanUrl(titleMatch[1]);
    title = titleMatch[2] ?? titleMatch[3] ?? titleMatch[4] ?? null;
    const raw2 = src.slice(0, destinationEnd + 1);
    return {
      token: image ? {
        type: "image",
        raw: raw2,
        href,
        title,
        text: closers.escapeWithin(src, labelStart, labelEnd) ? unescapeMarkdown(label) : label,
        tokens: []
      } : { type: "link", raw: raw2, href, title, text: label, tokens: [] },
      src: label,
      closers: closers.nested(src, labelEnd)
    };
  }
  let rawEnd = labelEnd + 1;
  let refStart = labelStart;
  let refEnd = labelEnd;
  if (src[rawEnd] === "[") {
    const end = closers.closeSquare(src, rawEnd + 1);
    if (end === -1)
      return;
    if (end > rawEnd + 1) {
      refStart = rawEnd + 1;
      refEnd = end;
    }
    rawEnd = end + 1;
  }
  const links = lexer.tokens.links;
  if (!hasDefinitions(links) || closers.squareCloserWithin(src, refStart, refEnd))
    return;
  const def = links[src.slice(refStart, refEnd).replace(/\s+/g, " ").toLowerCase()];
  if (!def)
    return;
  const raw = src.slice(0, rawEnd);
  return {
    token: image ? {
      type: "image",
      raw,
      href: def.href,
      title: def.title ?? null,
      text: closers.escapeWithin(src, labelStart, labelEnd) ? unescapeMarkdown(label) : label,
      tokens: []
    } : { type: "link", raw, href: def.href, title: def.title ?? null, text: label, tokens: [] },
    src: label,
    closers: closers.nested(src, labelEnd)
  };
}
function matchEmphasis(rest, output, closers) {
  const marker = rest[0];
  const previous = output.at(-1)?.raw.at(-1) ?? `
`;
  if (marker !== "*" && marker !== "_")
    return;
  if (rest.startsWith(marker.repeat(3)) && canOpenDelimiter(rest, 0, 3, marker, previous)) {
    const end2 = findDelimiter(rest, marker.repeat(3), 3);
    if (end2 !== -1 && canCloseDelimiter(rest, end2, marker)) {
      const text2 = rest.slice(1, end2 + 2);
      return {
        token: { type: "em", raw: rest.slice(0, end2 + 3), text: text2, tokens: [] },
        src: text2,
        closers: closers.nested(rest, end2 + 2)
      };
    }
  }
  const width = rest[1] === marker ? 2 : 1;
  if (!canOpenDelimiter(rest, 0, width, marker, previous))
    return;
  const end = closers.closeEmphasis(rest, marker, width);
  if (end === -1)
    return;
  const raw = rest.slice(0, end + width);
  const text = rest.slice(width, end);
  return {
    token: width === 2 ? { type: "strong", raw, text, tokens: [] } : { type: "em", raw, text, tokens: [] },
    src: text,
    closers: closers.nested(rest, end)
  };
}
function trimBareUrl(candidate) {
  let end = candidate.length;
  while (end > 0 && ".,:;!?".includes(candidate[end - 1]))
    end--;
  let out = candidate.slice(0, end);
  let opens = 0;
  let closes = 0;
  for (const char of out) {
    if (char === "(")
      opens++;
    else if (char === ")")
      closes++;
  }
  while (closes > opens && out.endsWith(")")) {
    out = out.slice(0, -1);
    closes--;
  }
  return out;
}
function inlineTokens(src, lexer, output) {
  const lex = openInlineSource(src, lexer, output);
  for (let nested = lexToNested(lex);nested; nested = lexToNested(lex)) {
    offered = { lexer, nested, outer: lex };
    nested.token.tokens = lexer.inlineTokens(nested.src);
    offered = undefined;
    output.push(nested.token);
  }
  return output;
}
function lexToNested(lex) {
  const { src, lexer, output, closers, stops, textRun, context } = lex;
  context.end = closers.end;
  let rest = lex.rest;
  while (rest !== "") {
    let custom;
    for (const extension of lexer.extensions.inline) {
      custom = extension.tokenizer.call(context, rest, output);
      if (custom?.raw)
        break;
    }
    if (custom?.raw) {
      output.push(custom);
      rest = rest.slice(custom.raw.length);
      continue;
    }
    const escaped = /^\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/.exec(rest);
    if (escaped) {
      output.push({ type: "escape", raw: escaped[0], text: escaped[1] });
      rest = rest.slice(2);
      continue;
    }
    const br = lexer.options.breaks ? /^(?: {2,}|\\)?\n/.exec(rest) : /^(?: {2,}|\\)\n/.exec(rest);
    if (br) {
      output.push({ type: "br", raw: br[0] });
      rest = rest.slice(br[0].length);
      continue;
    }
    if (rest[0] === "`") {
      const width = closers.codeOpenerWidth(rest);
      const end = closers.closeCode(rest, width);
      if (end !== -1) {
        const raw = rest.slice(0, end + width);
        let text = rest.slice(width, end).replace(/\n/g, " ");
        if (/^ .* $/.test(text) && text.trim() !== "")
          text = text.slice(1, -1);
        output.push({ type: "codespan", raw, text });
        rest = rest.slice(raw.length);
        continue;
      }
    }
    const auto = autolinkPrefix(rest, closers);
    if (auto) {
      const text = auto.slice(1, -1);
      const href = text.includes("@") && !/^[a-z][a-z+.-]*:\/\//i.test(text) ? `mailto:${text}` : text;
      output.push({ type: "link", raw: auto, text, href, tokens: [{ type: "text", raw: text, text }] });
      rest = rest.slice(auto.length);
      continue;
    }
    const html = inlineHtmlPrefix(rest, closers);
    if (html) {
      output.push({ type: "html", raw: html, inLink: false, inRawBlock: false, block: false, text: html });
      rest = rest.slice(html.length);
      continue;
    }
    const nested = matchLink(rest, lexer, closers) ?? matchEmphasis(rest, output, closers);
    if (nested) {
      lex.rest = rest.slice(nested.token.raw.length);
      return nested;
    }
    if (rest.startsWith("~~")) {
      let del2;
      const override = lexer.tokenizerOverrides.del;
      if (override)
        del2 = override.call(lexer.tokenizer, rest, rest);
      if (del2 === false || !override)
        del2 = lexer.tokenizer.del(rest);
      if (del2) {
        output.push(del2);
        rest = rest.slice(del2.raw.length);
        continue;
      }
    }
    const pos = src.length - rest.length;
    let url;
    const urlOverride = lexer.tokenizerOverrides.url;
    if (urlOverride)
      url = urlOverride.call(lexer.tokenizer, rest);
    if (!urlOverride || url === false) {
      const match = stops.bareUrlCanStart(pos) ? /^(?:(?:https?:\/\/|ftp:\/\/|www\.)[^\s<]+|[A-Za-z0-9._+-]+@[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+)/i.exec(rest) : null;
      if (match) {
        const text = trimBareUrl(match[0]);
        const href = text.includes("@") && !text.includes("://") ? `mailto:${text}` : text.startsWith("www.") ? `http://${text}` : text;
        url = { type: "link", raw: text, text, href, tokens: [{ type: "text", raw: text, text }] };
      }
    }
    if (url) {
      output.push(url);
      rest = rest.slice(url.raw.length);
      continue;
    }
    const next = stops.textLength(rest);
    textRun.append(output, pos, pos + next);
    rest = rest.slice(next);
  }
  lex.rest = rest;
  return;
}
function splitTableRow(line) {
  let value = line.trim();
  if (value.startsWith("|"))
    value = value.slice(1);
  if (value.endsWith("|") && !value.endsWith("\\|"))
    value = value.slice(0, -1);
  const cells = [];
  let cell = "";
  for (let i = 0;i < value.length; i++) {
    const char = value[i];
    if (char === "|" && value[i - 1] !== "\\") {
      cells.push(cell.trim());
      cell = "";
    } else
      cell += char;
  }
  cells.push(cell.trim());
  return cells.map((entry) => entry.replace(/\\\|/g, "|"));
}
function isFence(line) {
  return /^ {0,3}(`{3,}|~{3,})(.*?)(?:\n|$)$/.exec(line);
}
function isHeading(line) {
  return /^ {0,3}#{1,6}(?:\s|$)/.test(line);
}
function isHr(line) {
  return /^ {0,3}((?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})(?:\n|$)$/.test(line);
}
function isList(line) {
  return /^( {0,3})((?:[*+-])|(?:\d{1,9}[.)]))(?:[ \t]+|(?=\n|$))(.*?)(?:\n|$)$/.exec(line);
}
function isBlockquote(line) {
  return /^ {0,3}>/.test(line);
}
function isDefinition(line) {
  return /^ {0,3}\[[^\]]+\]:/.test(line);
}
function isHtmlStart(line) {
  return /^ {0,3}(?:<!--|<(?:script|pre|style|textarea|address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:\s|\/?>))/i.test(line);
}
function isBlockStart(lines, index2) {
  const line = lines[index2] ?? "";
  if (/^\n+$/.test(line))
    return true;
  if (isFence(line) || isHeading(line) || isHr(line) || isList(line) || isBlockquote(line) || isDefinition(line) || isHtmlStart(line) || /^ {4}\S/.test(line))
    return true;
  if (index2 + 1 < lines.length && /^ {0,3}(?:=+|-+)[ \t]*(?:\n|$)$/.test(lines[index2 + 1]))
    return true;
  if (index2 + 1 < lines.length && line.includes("|") && splitTableRow(lines[index2 + 1]).every((c) => /^:?-{1,}:?$/.test(c)))
    return true;
  return false;
}
function lineArray(src) {
  return src.match(/[^\n]*(?:\n|$)/g)?.filter((line, index2, all) => line !== "" || index2 < all.length - 1) ?? [];
}
function stripFinalNewline(value) {
  return value.endsWith(`
`) ? value.slice(0, -1) : value;
}
function makeTable(lines, index2, lexer) {
  if (index2 + 1 >= lines.length)
    return;
  const headerValues = splitTableRow(stripFinalNewline(lines[index2]));
  const delimiterValues = splitTableRow(stripFinalNewline(lines[index2 + 1]));
  if (!lines[index2].includes("|") || headerValues.length !== delimiterValues.length || !delimiterValues.every((c) => /^:?-{1,}:?$/.test(c)))
    return;
  const align = delimiterValues.map((cell2) => cell2.startsWith(":") && cell2.endsWith(":") ? "center" : cell2.startsWith(":") ? "left" : cell2.endsWith(":") ? "right" : null);
  let count = 2;
  const body = [];
  while (index2 + count < lines.length && !/^\s*\n?$/.test(lines[index2 + count])) {
    const cells = splitTableRow(stripFinalNewline(lines[index2 + count]));
    if (cells.length === 1 && !lines[index2 + count].includes("|"))
      break;
    while (cells.length < headerValues.length)
      cells.push("");
    body.push(cells.slice(0, headerValues.length));
    count++;
  }
  const cell = (text, column, header) => {
    const tokens = [];
    lexer.inline(text, tokens);
    return { text, tokens, header, align: align[column] };
  };
  return {
    token: {
      type: "table",
      raw: lines.slice(index2, index2 + count).join(""),
      header: headerValues.map((text, column) => cell(text, column, true)),
      align,
      rows: body.map((row) => row.map((text, column) => cell(text, column, false)))
    },
    count
  };
}
function parseList(lines, index2, lexer) {
  const first = isList(lines[index2]);
  if (!first)
    return;
  const ordered = /^\d/.test(first[2]);
  const delimiter = ordered ? first[2].at(-1) : first[2];
  const start = ordered ? Number.parseInt(first[2], 10) : "";
  const rawItems = [];
  let cursor = index2;
  while (cursor < lines.length) {
    const match = isList(lines[cursor]);
    if (!match || /^\d/.test(match[2]) !== ordered || (ordered ? match[2].at(-1) !== delimiter : match[2] !== delimiter))
      break;
    const itemStart = cursor;
    const markerWidth = match[1].length + match[2].length + 1;
    let text = match[3] ?? "";
    if (lines[cursor].endsWith(`
`))
      text += `
`;
    cursor++;
    while (cursor < lines.length) {
      const next = lines[cursor];
      const indent = /^ */.exec(next)[0].length;
      if (!/^\s*\n?$/.test(next) && indent <= first[1].length && isBlockStart(lines, cursor))
        break;
      if (!/^\s/.test(next) && !/^\n$/.test(next))
        break;
      if (/^\s*\n$/.test(next)) {
        let lookahead = cursor + 1;
        while (lookahead < lines.length && /^\s*\n$/.test(lines[lookahead]))
          lookahead++;
        if (lookahead >= lines.length)
          break;
        const following = lines[lookahead];
        const followingIndent = /^ */.exec(following)[0].length;
        if (followingIndent <= first[1].length) {
          const followingList = isList(following);
          const compatible = followingList !== null && /^\d/.test(followingList[2]) === ordered && (ordered ? followingList[2].at(-1) === delimiter : followingList[2] === delimiter);
          if (!compatible)
            break;
        }
        text += next;
      } else {
        const remove = Math.min(indent, markerWidth);
        text += next.slice(remove);
      }
      cursor++;
      if (/\n\s*\n$/.test(text) && cursor < lines.length && !/^\s/.test(lines[cursor]))
        break;
    }
    let raw2 = lines.slice(itemStart, cursor).join("");
    if (cursor === lines.length || cursor < lines.length && /^\s*\n$/.test(lines[cursor]))
      raw2 = stripFinalNewline(raw2);
    let taskRaw;
    let checked;
    const task = /^\[([ xX])\][ \t]+/.exec(text);
    if (task) {
      taskRaw = task[0];
      checked = task[1].toLowerCase() === "x";
      text = text.slice(task[0].length);
    }
    rawItems.push({ raw: raw2, text: stripFinalNewline(text), taskRaw, checked });
  }
  if (rawItems.length === 0)
    return;
  const raw = lines.slice(index2, cursor).join("");
  const loose = rawItems.some((item) => /\n\s*\n/.test(item.raw)) || /\n\s*\n/.test(raw);
  const items = rawItems.map((item) => {
    let tokens = lexer.blockTokens(item.text, []);
    if (!loose)
      tokens = tokens.map((token) => token.type === "paragraph" ? { type: "text", raw: token.raw, text: token.text, tokens: token.tokens } : token);
    if (item.taskRaw !== undefined)
      tokens.unshift({ type: "checkbox", raw: item.taskRaw, checked: item.checked === true });
    const listItem = {
      type: "list_item",
      raw: item.raw,
      task: item.taskRaw !== undefined,
      loose,
      text: item.text,
      tokens
    };
    if (item.checked !== undefined)
      listItem.checked = item.checked;
    return listItem;
  });
  return { token: { type: "list", raw, ordered, start, loose, items }, count: cursor - index2 };
}
function blockTokens(src, lexer, output) {
  const lines = lineArray(src);
  let i = 0;
  while (i < lines.length) {
    const remaining = lines.slice(i).join("");
    let custom;
    for (const extension of lexer.extensions.block) {
      custom = extension.tokenizer.call({ lexer }, remaining, output);
      if (custom?.raw)
        break;
    }
    if (custom?.raw) {
      output.push(custom);
      let consumed = custom.raw.length;
      while (i < lines.length && consumed > 0) {
        consumed -= lines[i].length;
        i++;
      }
      continue;
    }
    const line = lines[i];
    if (/^\s*\n$/.test(line)) {
      let raw2 = "";
      while (i < lines.length && /^\s*\n$/.test(lines[i]))
        raw2 += lines[i++];
      if (output.length > 0) {
        const previous = output.at(-1);
        if (previous.raw.endsWith(`
`))
          previous.raw = previous.raw.slice(0, -1);
        raw2 = `
${raw2}`;
      }
      if (raw2.length > 1)
        output.push({ type: "space", raw: raw2 });
      continue;
    }
    const fence = isFence(line);
    if (fence) {
      const marker = fence[1];
      let raw2 = line;
      let text2 = "";
      i++;
      while (i < lines.length) {
        const next = lines[i++];
        if (new RegExp(`^ {0,3}${marker[0]}{${marker.length},}[ \\t]*(?:\\n|$)$`).test(next)) {
          raw2 += next;
          break;
        }
        raw2 += next;
        text2 += next;
      }
      text2 = stripFinalNewline(text2);
      const rawToken = i < lines.length && /^\s*\n$/.test(lines[i]) ? stripFinalNewline(raw2) : raw2;
      output.push({ type: "code", raw: rawToken, lang: fence[2].trim(), text: text2 });
      continue;
    }
    if (/^ {4}/.test(line)) {
      let raw2 = "";
      let text2 = "";
      while (i < lines.length && /^ {4}/.test(lines[i])) {
        raw2 += lines[i];
        text2 += lines[i].slice(4);
        i++;
        if (i < lines.length && /^\s*\n$/.test(lines[i]) && i + 1 < lines.length && /^ {4}/.test(lines[i + 1])) {
          raw2 += lines[i];
          text2 += lines[i];
          i++;
        }
      }
      if (i < lines.length && /^\s*\n$/.test(lines[i])) {
        raw2 = stripFinalNewline(raw2);
        text2 = stripFinalNewline(text2);
      }
      output.push({ type: "code", raw: raw2, codeBlockStyle: "indented", text: text2.replace(/\n+$/, `
`) });
      continue;
    }
    const heading = /^ {0,3}(#{1,6})(?:[ \t]+|$)(.*?)(?:\n|$)$/.exec(line);
    if (heading) {
      const text2 = heading[2].replace(/[ \t]+#+[ \t]*$/, "").trim();
      const raw2 = i + 1 < lines.length && /^\s*\n$/.test(lines[i + 1]) ? stripFinalNewline(line) : line;
      const tokens2 = [];
      lexer.inline(text2, tokens2);
      output.push({ type: "heading", raw: raw2, depth: heading[1].length, text: text2, tokens: tokens2 });
      i++;
      continue;
    }
    if (isHr(line)) {
      output.push({ type: "hr", raw: line });
      i++;
      continue;
    }
    if (isBlockquote(line)) {
      let raw2 = "";
      let text2 = "";
      while (i < lines.length) {
        const next = lines[i];
        if (isBlockquote(next)) {
          raw2 += next;
          text2 += next.replace(/^ {0,3}>[ \t]?/, "");
          i++;
          continue;
        }
        if (!/^\s*\n$/.test(next) && !isBlockStart(lines, i)) {
          raw2 += next;
          text2 += next;
          i++;
          continue;
        }
        break;
      }
      text2 = stripFinalNewline(text2);
      output.push({ type: "blockquote", raw: raw2, tokens: lexer.blockTokens(text2, []), text: text2 });
      continue;
    }
    const list = parseList(lines, i, lexer);
    if (list) {
      output.push(list.token);
      i += list.count;
      continue;
    }
    if (isHtmlStart(line)) {
      let raw2 = line;
      const tag = /^ {0,3}<([A-Za-z][\w-]*)/.exec(line)?.[1]?.toLowerCase();
      i++;
      if (line.trimStart().startsWith("<!--")) {
        while (!raw2.includes("-->") && i < lines.length)
          raw2 += lines[i++];
      } else if (tag && !new RegExp(`</${tag}>`, "i").test(raw2)) {
        while (i < lines.length) {
          raw2 += lines[i++];
          if (new RegExp(`</${tag}>`, "i").test(raw2))
            break;
        }
      }
      const value = i < lines.length && /^\s*\n$/.test(lines[i]) ? stripFinalNewline(raw2) : raw2;
      output.push({
        type: "html",
        block: true,
        raw: value,
        pre: tag === "pre" || tag === "script" || tag === "style",
        text: value
      });
      continue;
    }
    const def = /^ {0,3}\[([^\]]+)\]:[ \t]*(?:<([^>]+)>|(\S+))(?:[ \t]+(?:"([^"]*)"|'([^']*)'|\(([^)]*)\)))?[ \t]*(?:\n|$)$/.exec(line);
    if (def) {
      const tag = def[1].replace(/\s+/g, " ").toLowerCase();
      const href = cleanUrl(def[2] ?? def[3] ?? "");
      const title = def[4] ?? def[5] ?? def[6];
      lexer.tokens.links[tag] = { href, title: title ?? null };
      const token = { type: "def", tag, raw: line, href };
      if (title !== undefined)
        token.title = title;
      output.push(token);
      i++;
      continue;
    }
    const table = makeTable(lines, i, lexer);
    if (table) {
      output.push(table.token);
      i += table.count;
      continue;
    }
    if (i + 1 < lines.length && /^ {0,3}(=+|-+)[ \t]*(?:\n|$)$/.test(lines[i + 1])) {
      let fallback;
      const override = lexer.tokenizerOverrides.lheading;
      if (override)
        fallback = override.call(lexer.tokenizer, remaining);
      if (!override || fallback === false) {
        const raw2 = line + lines[i + 1];
        const text2 = stripFinalNewline(line);
        const tokens2 = [];
        lexer.inline(text2, tokens2);
        output.push({ type: "heading", raw: raw2, depth: lines[i + 1].trimStart()[0] === "=" ? 1 : 2, text: text2, tokens: tokens2 });
        i += 2;
        continue;
      }
      if (fallback) {
        output.push(fallback);
        i += Math.max(1, lineArray(fallback.raw).length);
        continue;
      }
    }
    let raw = line;
    i++;
    let prevBlankish = false;
    while (i < lines.length) {
      const next = lines[i];
      const indented = next.trim() !== "" && /^ {4}/.test(next);
      if (indented ? prevBlankish : isBlockStart(lines, i))
        break;
      prevBlankish = next.trim() === "";
      raw += next;
      i++;
    }
    const text = stripFinalNewline(raw);
    const tokens = [];
    lexer.inline(text, tokens);
    output.push({ type: "paragraph", raw, text, tokens });
  }
  return output;
}
var BLOCK_RULES = {
  normal: {
    blockquote: /^ {0,3}>/,
    code: /^ {4}/,
    def: /^ {0,3}\[/,
    fences: /^ {0,3}(?:```|~~~)/,
    heading: /^ {0,3}#/,
    hr: /^ {0,3}(?:\*|_|-)/,
    html: /^ {0,3}</,
    lheading: /^/,
    list: /^ {0,3}(?:[*+-]|\d+[.)])/,
    newline: /^\n+/,
    paragraph: /^/,
    table: /^/,
    text: /^[^\n]+/
  },
  gfm: {},
  pedantic: {}
};
BLOCK_RULES.gfm = { ...BLOCK_RULES.normal };
BLOCK_RULES.pedantic = { ...BLOCK_RULES.normal };
var INLINE_RULES = {
  normal: {
    _backpedal: /^/,
    anyPunctuation: PUNCTUATION,
    autolink: /^</,
    blockSkip: /^/,
    br: /^(?: {2,}|\\)\n/,
    code: /^`+/,
    del: /^~~/,
    delLDelim: /^~~/,
    delRDelim: /^~~/,
    emStrongLDelim: /^[*_]/,
    emStrongRDelimAst: /\*/,
    emStrongRDelimUnd: /_/,
    escape: /^\\/,
    link: /^!?\[/,
    nolink: /^\[/,
    punctuation: PUNCTUATION,
    reflink: /^\[/,
    reflinkSearch: /\[/,
    tag: /^</,
    text: /^[\s\S]/,
    url: /^(?:https?:|ftp:|www\.)/
  },
  gfm: {},
  breaks: {},
  pedantic: {}
};
INLINE_RULES.gfm = { ...INLINE_RULES.normal };
INLINE_RULES.breaks = { ...INLINE_RULES.normal };
INLINE_RULES.pedantic = { ...INLINE_RULES.normal };

class Lexer {
  tokens;
  options;
  state = { inLink: false, inRawBlock: false, top: true };
  inlineQueue = [];
  tokenizer;
  tokenizerOverrides;
  extensions;
  constructor(options = {}) {
    this.options = { ...DEFAULTS, ...options };
    this.tokens = tokenList();
    this.extensions = options.extensions ?? { block: [], inline: [], renderers: {}, childTokens: {} };
    this.tokenizer = options.tokenizer instanceof Tokenizer ? options.tokenizer : new Tokenizer(this.options);
    this.tokenizer.lexer = this;
    this.tokenizerOverrides = options.tokenizerOverrides ?? (options.tokenizer instanceof Tokenizer ? {} : options.tokenizer ?? {});
  }
  static get rules() {
    return { block: BLOCK_RULES, inline: INLINE_RULES };
  }
  static lex(src, options = {}) {
    return new Lexer(options).lex(src);
  }
  static lexInline(src, options = {}) {
    return new Lexer(options).inlineTokens(src);
  }
  lex(src) {
    this.tokens = tokenList();
    this.inlineQueue = [];
    this.blockTokens(normalizeSource(src), this.tokens);
    for (const queued of this.inlineQueue)
      this.inlineTokens(queued.src, queued.tokens);
    this.inlineQueue = [];
    return this.tokens;
  }
  blockTokens(src, tokens = this.tokens) {
    return blockTokens(src, this, tokens);
  }
  inline(src, tokens = []) {
    this.inlineQueue.push({ src, tokens });
    return tokens;
  }
  inlineTokens(src, tokens = []) {
    return inlineTokens(src, this, tokens);
  }
}

class Renderer {
  options;
  parser;
  overrides;
  constructor(options = {}, overrides = {}) {
    this.options = options;
    this.overrides = overrides;
  }
  space(_token) {
    return "";
  }
  code({ text, lang, escaped }) {
    const code = escaped ? text : escapeHtml(text);
    const language = (lang ?? "").match(/^\S*/)?.[0] ?? "";
    return `<pre><code${language ? ` class="language-${escapeHtml(language)}"` : ""}>${code}${text.endsWith(`
`) ? "" : `
`}</code></pre>
`;
  }
  blockquote({ tokens }) {
    return `<blockquote>
${this.parser.parse(tokens)}</blockquote>
`;
  }
  html({ text }) {
    return text;
  }
  def(_token) {
    return "";
  }
  heading({ tokens, depth }) {
    return `<h${depth}>${this.parser.parseInline(tokens)}</h${depth}>
`;
  }
  hr(_token) {
    return `<hr>
`;
  }
  list(token) {
    const tag = token.ordered ? "ol" : "ul";
    const start = token.ordered && token.start !== 1 ? ` start="${token.start}"` : "";
    return `<${tag}${start}>
${token.items.map((item) => this.parser.renderListItem(item)).join("")}</${tag}>
`;
  }
  listitem(item) {
    return `<li>${this.parser.parse(item.tokens)}</li>
`;
  }
  checkbox({ checked }) {
    return `<input${checked ? ' checked=""' : ""} disabled="" type="checkbox">`;
  }
  paragraph({ tokens }) {
    return `<p>${this.parser.parseInline(tokens)}</p>
`;
  }
  table(token) {
    const row = (cells) => `<tr>
${cells.map((cell) => this.tablecell(cell)).join("")}</tr>
`;
    return `<table>
<thead>
${row(token.header)}</thead>
${token.rows.length ? `<tbody>${token.rows.map(row).join("")}</tbody>` : ""}</table>
`;
  }
  tablerow(text) {
    return `<tr>
${text}</tr>
`;
  }
  tablecell(token) {
    const tag = token.header ? "th" : "td";
    return `<${tag}${token.align ? ` align="${token.align}"` : ""}>${this.parser.parseInline(token.tokens)}</${tag}>
`;
  }
  strong({ tokens }) {
    return `<strong>${this.parser.parseInline(tokens)}</strong>`;
  }
  em({ tokens }) {
    return `<em>${this.parser.parseInline(tokens)}</em>`;
  }
  codespan({ text }) {
    return `<code>${escapeHtml(text)}</code>`;
  }
  br(_token) {
    return "<br>";
  }
  del({ tokens }) {
    return `<del>${this.parser.parseInline(tokens)}</del>`;
  }
  link({ href, title, tokens }) {
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
    return `<a href="${escapeHtml(encodeURI(href))}"${titleAttr}>${this.parser.parseInline(tokens)}</a>`;
  }
  image({ href, title, text }) {
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
    return `<img src="${escapeHtml(encodeURI(href))}" alt="${escapeHtml(text)}"${titleAttr}>`;
  }
  text({ text }) {
    return escapeHtml(text, false);
  }
}

class Parser {
  options;
  renderer;
  extensions;
  constructor(options = {}) {
    this.options = options;
    this.extensions = options.extensions ?? { block: [], inline: [], renderers: {}, childTokens: {} };
    const rendererOption = options.renderer;
    this.renderer = rendererOption instanceof Renderer ? rendererOption : new Renderer(options, rendererOption ?? {});
    this.renderer.parser = this;
  }
  static parse(tokens, options = {}) {
    return new Parser(options).parse(tokens);
  }
  static parseInline(tokens, options = {}) {
    return new Parser(options).parseInline(tokens);
  }
  parse(tokens) {
    let out = "";
    for (const token of tokens) {
      const extension = this.extensions.renderers[token.type];
      if (extension) {
        const rendered = extension.call({ parser: this }, token);
        if (rendered !== false && rendered !== undefined) {
          out += rendered;
          continue;
        }
      }
      if (!isKnownToken(token)) {
        out += this.parseInline([token]);
        continue;
      }
      switch (token.type) {
        case "space":
          out += this.call("space", token, () => this.renderer.space(token));
          break;
        case "checkbox":
          out += `${this.renderer.checkbox(token)} `;
          break;
        case "hr":
          out += this.call("hr", token, () => this.renderer.hr(token));
          break;
        case "heading":
          out += this.call("heading", token, () => this.renderer.heading(token));
          break;
        case "code":
          out += this.call("code", token, () => this.renderer.code(token));
          break;
        case "blockquote":
          out += this.call("blockquote", token, () => this.renderer.blockquote(token));
          break;
        case "html":
          out += this.call("html", token, () => this.renderer.html(token));
          break;
        case "def":
          out += this.renderer.def(token);
          break;
        case "list":
          out += this.call("list", token, () => this.renderer.list(token));
          break;
        case "paragraph":
          out += this.call("paragraph", token, () => this.renderer.paragraph(token));
          break;
        case "table":
          out += this.renderer.table(token);
          break;
        case "text":
          out += token.tokens ? this.parseInline(token.tokens) : this.renderer.text(token);
          break;
        default:
          out += this.parseInline([token]);
      }
    }
    return out;
  }
  parseInline(tokens) {
    let out = "";
    for (const token of tokens) {
      const extension = this.extensions.renderers[token.type];
      if (extension) {
        const rendered = extension.call({ parser: this }, token);
        if (rendered !== false && rendered !== undefined) {
          out += rendered;
          continue;
        }
      }
      if (!isKnownToken(token)) {
        if (token.tokens)
          out += this.parseInline(token.tokens);
        else if (typeof token.text === "string")
          out += escapeHtml(token.text);
        continue;
      }
      switch (token.type) {
        case "escape":
        case "text":
          out += this.call("text", token, () => this.renderer.text(token));
          break;
        case "checkbox":
          out += `${this.renderer.checkbox(token)} `;
          break;
        case "html":
          out += this.call("html", token, () => this.renderer.html(token));
          break;
        case "link":
          out += this.call("link", token, () => this.renderer.link(token));
          break;
        case "image":
          out += this.call("image", token, () => this.renderer.image(token));
          break;
        case "strong":
          out += this.call("strong", token, () => this.renderer.strong(token));
          break;
        case "em":
          out += this.call("em", token, () => this.renderer.em(token));
          break;
        case "codespan":
          out += this.call("codespan", token, () => this.renderer.codespan(token));
          break;
        case "br":
          out += this.call("br", token, () => this.renderer.br(token));
          break;
        case "del":
          out += this.call("del", token, () => this.renderer.del(token));
          break;
        default:
          if ("tokens" in token && token.tokens)
            out += this.parseInline(token.tokens);
          else if ("text" in token && typeof token.text === "string")
            out += escapeHtml(token.text);
      }
    }
    return out;
  }
  renderListItem(item) {
    return this.call("listitem", item, () => this.renderer.listitem(item));
  }
  call(name, token, fallback) {
    const override = this.renderer.overrides[name];
    if (override) {
      const value = override.call(this.renderer, token);
      if (value !== false)
        return value;
    }
    return fallback();
  }
}
function freshExtensions() {
  return { block: [], inline: [], renderers: {}, childTokens: {} };
}
function mergeExtensions(current, additions) {
  const registry = current ?? freshExtensions();
  for (const extension of additions ?? []) {
    if ("tokenizer" in extension) {
      registry[extension.level].unshift(extension);
      if (extension.childTokens)
        registry.childTokens[extension.name] = extension.childTokens;
    }
    if ("renderer" in extension)
      registry.renderers[extension.name] = extension.renderer;
  }
  return registry;
}
function walkTokenTree(tokens, callback, registry) {
  const values = [];
  for (const token of tokens) {
    values.push(callback(token));
    const children = [];
    if ("tokens" in token && token.tokens)
      children.push(token.tokens);
    if (isKnownToken(token)) {
      if (token.type === "list")
        for (const item of token.items)
          children.push([item]);
      if (token.type === "table") {
        for (const cell of token.header)
          children.push(cell.tokens);
        for (const row of token.rows)
          for (const cell of row)
            children.push(cell.tokens);
      }
    }
    for (const key of registry.childTokens[token.type] ?? []) {
      const value = Reflect.get(token, key);
      if (Array.isArray(value))
        children.push(value);
    }
    for (const child of children)
      values.push(...walkTokenTree(child, callback, registry));
  }
  return values;
}

class Marked {
  defaults;
  constructor(...extensions) {
    this.defaults = { ...DEFAULTS, extensions: freshExtensions() };
    if (extensions.length)
      this.use(...extensions);
  }
  options(options) {
    return this.setOptions(options);
  }
  setOptions(options) {
    this.defaults = { ...this.defaults, ...options, extensions: options.extensions ?? this.defaults.extensions };
    return this;
  }
  use(...extensions) {
    for (const extension of extensions) {
      this.defaults.extensions = mergeExtensions(this.defaults.extensions, extension.extensions);
      if (extension.tokenizer) {
        if (this.defaults.tokenizer instanceof Tokenizer) {
          this.defaults.tokenizerOverrides = { ...this.defaults.tokenizerOverrides, ...extension.tokenizer };
        } else {
          this.defaults.tokenizer = { ...this.defaults.tokenizer, ...extension.tokenizer };
        }
      }
      if (extension.renderer)
        this.defaults.renderer = {
          ...this.defaults.renderer instanceof Renderer ? {} : this.defaults.renderer,
          ...extension.renderer
        };
      if (extension.walkTokens) {
        const previous = this.defaults.walkTokens;
        this.defaults.walkTokens = previous ? (token) => {
          previous(token);
          return extension.walkTokens?.(token);
        } : extension.walkTokens;
      }
      for (const key of ["async", "breaks", "gfm", "pedantic", "silent"])
        if (extension[key] !== undefined)
          this.defaults[key] = extension[key];
    }
    return this;
  }
  lexer(src, options = {}) {
    return Lexer.lex(src, {
      ...this.defaults,
      ...options,
      extensions: options.extensions ?? this.defaults.extensions
    });
  }
  parser(tokens, options = {}) {
    return Parser.parse(tokens, {
      ...this.defaults,
      ...options,
      extensions: options.extensions ?? this.defaults.extensions
    });
  }
  walkTokens(tokens, callback) {
    return walkTokenTree(tokens, callback, this.defaults.extensions ?? freshExtensions());
  }
  parse(src, options = null) {
    const merged = { ...this.defaults, ...options, extensions: options?.extensions ?? this.defaults.extensions };
    const tokens = Lexer.lex(src, merged);
    const walked = merged.walkTokens ? walkTokenTree(tokens, merged.walkTokens, merged.extensions ?? freshExtensions()) : [];
    if (merged.async)
      return Promise.all(walked).then(() => Parser.parse(tokens, merged));
    return Parser.parse(tokens, merged);
  }
  parseInline(src, options = {}) {
    const merged = { ...this.defaults, ...options, extensions: options.extensions ?? this.defaults.extensions };
    return Parser.parseInline(Lexer.lexInline(src, merged), merged);
  }
}
var shared = new Marked;
var lexer = Lexer.lex;
var parser = Parser.parse;
// ../utils/src/math-delimiters.ts
var MATH_BLOCK_DOLLAR = / {0,3}\$\$[ \t]*\r?\n([\s\S]+?)\r?\n {0,3}\$\$[ \t]*(?:\r?\n|$)/y;
var MATH_BLOCK_BRACKET = / {0,3}\\\[[ \t]*\r?\n([\s\S]+?)\r?\n {0,3}\\\][ \t]*(?:\r?\n|$)/y;
function mathStartIndex(source, from = 0) {
  for (let at = from;at < source.length; at++) {
    if (mathOpenerAt(source, at) !== undefined)
      return at;
  }
  return;
}
function mathOpenerAt(source, at) {
  const first = source.charCodeAt(at);
  if (first === 36)
    return source.charCodeAt(at + 1) === 36 ? "$$" : "$";
  if (first !== 92)
    return;
  const second = source.charCodeAt(at + 1);
  if (second === 40)
    return "\\(";
  if (second === 91)
    return "\\[";
  return;
}
function mathSpanAt(source, at, from = 0) {
  const opener = mathOpenerAt(source, at);
  if (opener === undefined || escapedAt2(source, at, from))
    return;
  const bodyStart = at + opener.length;
  return spanOf(source, opener, bodyStart, opener === "$" ? scanDollar(source, at).close : closerIndex(source, opener, bodyStart));
}

class MathSpans {
  #source;
  #dollarOpen = -1;
  #dollarStop = -1;
  #dollarClose = -1;
  #dollarSolid = -1;
  #searchedFrom = {
    $$: Infinity,
    "\\(": Infinity,
    "\\[": Infinity
  };
  #closer = { $$: -1, "\\(": -1, "\\[": -1 };
  constructor(source) {
    this.#source = source;
  }
  spanAt(at, end = this.#source.length) {
    const source = this.#source;
    const opener = mathOpenerAt(source, at);
    if (opener === undefined)
      return;
    const bodyStart = at + opener.length;
    const close = opener === "$" ? this.#dollarCloser(at) : this.#closerFrom(opener, bodyStart);
    if (close === -1 || close + opener.length > end)
      return;
    return spanOf(source, opener, bodyStart, close);
  }
  #dollarCloser(open) {
    const source = this.#source;
    if (this.#dollarOpen < open && open < this.#dollarStop) {
      if (this.#dollarClose === -1 || !dollarOpens(source, open))
        return -1;
      return this.#dollarSolid > open ? this.#dollarClose : -1;
    }
    const { close, stop } = scanDollar(source, open);
    this.#dollarOpen = open;
    this.#dollarStop = stop;
    this.#dollarClose = close;
    if (close !== -1) {
      let solid = close - 1;
      while (WHITESPACE.test(source[solid]))
        solid--;
      this.#dollarSolid = solid;
    }
    return close;
  }
  #closerFrom(opener, bodyStart) {
    const found = this.#closer[opener];
    if (this.#searchedFrom[opener] <= bodyStart && (found === -1 || bodyStart <= found))
      return found;
    const close = closerIndex(this.#source, opener, bodyStart);
    this.#searchedFrom[opener] = bodyStart;
    this.#closer[opener] = close;
    return close;
  }
}
var spansByContext = new WeakMap;
function spanOf(source, opener, bodyStart, closeAt) {
  if (closeAt === -1)
    return;
  const body = source.slice(bodyStart, closeAt);
  if (opener === "$$" && body.trim() === "")
    return;
  return { opener, display: opener === "$$" || opener === "\\[", end: closeAt + opener.length, body };
}
function mathBlockAt(source) {
  MATH_BLOCK_DOLLAR.lastIndex = 0;
  MATH_BLOCK_BRACKET.lastIndex = 0;
  return blockOf(MATH_BLOCK_DOLLAR.exec(source) ?? MATH_BLOCK_BRACKET.exec(source));
}
function blockOf(match) {
  return match === null || match[1].trim() === "" ? undefined : { raw: match[0], body: match[1] };
}
var MATH_BLOCK_OPENER_LINE_RE = / {0,3}(\$\$|\\\[)[ \t]*(\r?\n|$)/y;

class MathBlockScan {
  #source;
  #unclosedDollarFrom = Number.POSITIVE_INFINITY;
  #unclosedBracketFrom = Number.POSITIVE_INFINITY;
  constructor(source) {
    this.#source = source;
  }
  at(from) {
    MATH_BLOCK_OPENER_LINE_RE.lastIndex = from;
    const line = MATH_BLOCK_OPENER_LINE_RE.exec(this.#source);
    if (line === null || line[2] === "")
      return;
    const dollar = line[1] === "$$";
    if (from >= (dollar ? this.#unclosedDollarFrom : this.#unclosedBracketFrom))
      return;
    const grammar = dollar ? MATH_BLOCK_DOLLAR : MATH_BLOCK_BRACKET;
    grammar.lastIndex = from;
    const match = grammar.exec(this.#source);
    if (match === null) {
      if (dollar)
        this.#unclosedDollarFrom = from;
      else
        this.#unclosedBracketFrom = from;
    }
    return blockOf(match);
  }
}
function closerIndex(source, opener, from) {
  const closer = opener === "\\(" ? "\\)" : opener === "\\[" ? "\\]" : opener;
  for (let at = source.indexOf(closer, from);at !== -1; at = source.indexOf(closer, at + 1)) {
    if (!escapedAt2(source, at, from))
      return at;
  }
  return -1;
}
function escapedAt2(source, index2, from) {
  let backslashes = 0;
  for (let at = index2 - 1;at >= from && source.charCodeAt(at) === 92; at--)
    backslashes++;
  return backslashes % 2 === 1;
}
var WHITESPACE = /\s/;
function dollarOpens(source, open) {
  const after = source[open + 1];
  return !(after === undefined || after === " " || after === "\t" || after === `
` || after === "$");
}
function scanDollar(source, open) {
  if (!dollarOpens(source, open))
    return { close: -1, stop: open + 1 };
  for (let at = open + 1;at < source.length; at++) {
    const char = source[at];
    if (char === "\\") {
      at++;
      continue;
    }
    if (char === `
`)
      return { close: -1, stop: at };
    if (char !== "$")
      continue;
    const before = source[at - 1];
    if (before === " " || before === "\t")
      return { close: -1, stop: at };
    const next = source[at + 1];
    if (next !== undefined && next >= "0" && next <= "9")
      continue;
    return { close: source.slice(open + 1, at).trim().length > 0 ? at : -1, stop: at };
  }
  return { close: -1, stop: source.length };
}

// src/components/transcript/Markdown.tsx
var import_react5 = __toESM(require_react(), 1);

// src/lib/magic-words.ts
var MAGIC_WORDS = [
  { word: "ultrathink", hue: [0, 330] },
  { word: "orchestrate", hue: [150, 280] },
  { word: "workflowz", hue: [30, 150] },
  { word: "jevify", hue: [300, 420] }
];
var MAGIC_RE = new RegExp(`(?<![\\p{L}\\p{N}_./\\\\-])(?<!::)(${MAGIC_WORDS.map((w) => w.word).join("|")})(?![\\p{L}\\p{N}_/\\\\-])(?!\\.[\\p{L}\\p{N}_-])(?!\\()`, "gu");
var STOPS = 14;
function gradientFor([from, to]) {
  const stops = [];
  for (let i = 0;i <= STOPS * 2; i++) {
    const t = i <= STOPS ? i / STOPS : (STOPS * 2 - i) / STOPS;
    stops.push(`hsl(${(from + t * (to - from)) % 360} 90% 62%)`);
  }
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}
var SPAN_BY_WORD = Object.fromEntries(MAGIC_WORDS.map((w) => [
  w.word,
  `<span class="magic-word" style="background-image: ${gradientFor(w.hue)}">${w.word}</span>`
]));
var TAG_RE = /<(\/?)([a-zA-Z][\w-]*)[^>]*>/g;
var SKIP_TAGS = { code: true, pre: true, a: true, script: true, style: true, math: true };
function highlightMagicWords(html) {
  MAGIC_RE.lastIndex = 0;
  if (!MAGIC_RE.test(html))
    return html;
  let out = "";
  let last = 0;
  let skipDepth = 0;
  const wrap = (text) => skipDepth > 0 ? text : text.replace(MAGIC_RE, (w) => SPAN_BY_WORD[w] ?? w);
  for (const m of html.matchAll(TAG_RE)) {
    const start = m.index ?? 0;
    out += wrap(html.slice(last, start)) + m[0];
    last = start + m[0].length;
    if (SKIP_TAGS[m[2].toLowerCase()])
      skipDepth += m[1] ? -1 : 1;
    if (skipDepth < 0)
      skipDepth = 0;
  }
  return out + wrap(html.slice(last));
}

// src/components/transcript/MermaidViewer.tsx
var import_react4 = __toESM(require_react(), 1);
var import_react_dom2 = __toESM(require_react_dom(), 1);
var jsx_runtime = __toESM(require_jsx_runtime(), 1);
function MermaidViewer({ svg, onClose }) {
  const viewportRef = import_react4.useRef(null);
  const stageRef = import_react4.useRef(null);
  import_react4.useEffect(() => {
    const stage = stageRef.current;
    const viewport = viewportRef.current;
    if (!stage || !viewport)
      return;
    let pz = null;
    let cancelled = false;
    const onWheel = (e) => {
      const wheel = e;
      pz?.zoomWithWheel(wheel);
    };
    import("./panzoom.es.zh172vr7.js").then(({ default: Panzoom }) => {
      if (cancelled)
        return;
      pz = Panzoom(stage, { maxScale: 8, minScale: 0.5, canvas: true });
      viewport.addEventListener("wheel", onWheel, { passive: false });
    });
    const onKey = (e) => {
      if (e !== null && typeof e === "object" && "key" in e && e.key === "Escape")
        onClose();
    };
    browserWindow.addEventListener("keydown", onKey);
    return () => {
      cancelled = true;
      viewport.removeEventListener("wheel", onWheel);
      browserWindow.removeEventListener("keydown", onKey);
      pz?.destroy();
    };
  }, [onClose]);
  return import_react_dom2.createPortal(/* @__PURE__ */ jsx_runtime.jsxs("div", {
    className: "mmv-overlay",
    role: "dialog",
    "aria-label": "Diagram",
    children: [
      /* @__PURE__ */ jsx_runtime.jsx("button", {
        type: "button",
        className: "mmv-close",
        "aria-label": "Close diagram",
        onClick: onClose,
        children: /* @__PURE__ */ jsx_runtime.jsx(X, {
          size: 22
        })
      }),
      /* @__PURE__ */ jsx_runtime.jsx("div", {
        className: "mmv-viewport",
        ref: viewportRef,
        children: /* @__PURE__ */ jsx_runtime.jsx("div", {
          className: "mmv-stage",
          ref: stageRef,
          dangerouslySetInnerHTML: { __html: svg }
        })
      })
    ]
  }), browserDocument.body);
}

// src/components/transcript/format.ts
function escapeHtml2(s) {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function messageText2(m) {
  if (typeof m === "string")
    return m;
  if (m === null || m === undefined)
    return "";
  if (Array.isArray(m)) {
    const parts = [];
    for (const block of m) {
      if (typeof block === "string") {
        parts.push(block);
        continue;
      }
      if (block && typeof block === "object") {
        const rec = block;
        if (typeof rec.text === "string")
          parts.push(rec.text);
        else if (typeof rec.thinking === "string")
          parts.push(rec.thinking);
      }
    }
    return parts.join(`
`);
  }
  if (typeof m === "object") {
    const rec = m;
    if (typeof rec.text === "string")
      return rec.text;
    if ("content" in rec)
      return messageText2(rec.content);
  }
  return "";
}

// src/components/transcript/Markdown.tsx
var jsx_runtime2 = __toESM(require_jsx_runtime(), 1);
var renderKatex = null;
var katexLoading = null;
var katexListeners = new Set;
function ensureKatex() {
  if (renderKatex !== null || katexLoading !== null)
    return;
  katexLoading = import("./katex.5jvptvwk.js").then((mod) => {
    renderKatex = mod.renderToString;
    for (const fn of katexListeners)
      fn();
  });
}
function subscribeKatex(fn) {
  katexListeners.add(fn);
  return () => {
    katexListeners.delete(fn);
  };
}
function katexReady() {
  return renderKatex !== null;
}
var MERMAID_CACHE_MAX = 100;
var mermaidLoading = null;
var mermaidSeq = 0;
var mermaidVersion = 0;
var mermaidListeners = new Set;
var mermaidCache = new Map;
var mermaidPending = new Set;
function loadMermaid() {
  mermaidLoading ??= import("./mermaid.core.w0zzynnk.js").then((mod) => {
    const api = mod.default;
    api.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "dark",
      suppressErrorRendering: true,
      layout: "dagre"
    });
    return api;
  });
  return mermaidLoading;
}
function settleMermaid(source, svg) {
  mermaidPending.delete(source);
  if (mermaidCache.size >= MERMAID_CACHE_MAX) {
    const oldest = mermaidCache.keys().next().value;
    if (oldest !== undefined)
      mermaidCache.delete(oldest);
  }
  mermaidCache.set(source, svg);
  mermaidVersion++;
  for (const fn of mermaidListeners)
    fn();
}
function requestMermaid(source) {
  if (mermaidCache.has(source) || mermaidPending.has(source))
    return;
  mermaidPending.add(source);
  loadMermaid().then((api) => api.render(`tr-mermaid-${++mermaidSeq}`, source)).then(({ svg }) => settleMermaid(source, svg), () => settleMermaid(source, null));
}
function subscribeMermaid(fn) {
  mermaidListeners.add(fn);
  return () => {
    mermaidListeners.delete(fn);
  };
}
function mermaidSnapshot() {
  return mermaidVersion;
}
function fenceClosed(raw) {
  const end = raw.trimEnd();
  return end.length > 3 && (end.endsWith("```") || end.endsWith("~~~"));
}
function unescapeHtml(raw) {
  const parseCodePoint = (value) => {
    if (Number.isFinite(value) && value >= 0 && value <= 1114111) {
      try {
        return String.fromCodePoint(value);
      } catch {}
    }
    return "";
  };
  return raw.replace(/&(amp|lt|gt|quot|apos|nbsp|#\d+|#x[0-9a-fA-F]+);/gi, (match, entity) => {
    const lower = entity.toLowerCase();
    switch (lower) {
      case "nbsp":
        return " ";
      case "lt":
        return "<";
      case "gt":
        return ">";
      case "quot":
        return '"';
      case "apos":
        return "'";
      case "amp":
        return "&";
      default: {
        if (lower.startsWith("#x"))
          return parseCodePoint(Number.parseInt(lower.slice(2), 16));
        if (lower.startsWith("#"))
          return parseCodePoint(Number(lower.slice(1)));
        return match;
      }
    }
  });
}
function safeHref(href) {
  const trimmed = href.trim();
  let protocol;
  try {
    ({ protocol } = new URL(trimmed, "https://relative.invalid/"));
  } catch {
    return null;
  }
  if (protocol === "https:" || protocol === "http:" || protocol === "mailto:")
    return trimmed;
  return null;
}
function typesettable(span) {
  return !span.body.includes("`");
}
function renderMath(token) {
  if (token.type !== "math" || typeof token.text !== "string" || typeof token.display !== "boolean")
    return false;
  const raw = escapeHtml2(typeof token.raw === "string" ? token.raw : token.text);
  if (renderKatex === null) {
    ensureKatex();
    return raw;
  }
  try {
    const math = renderKatex(token.text, {
      displayMode: token.display,
      output: "mathml",
      throwOnError: false,
      strict: false,
      trust: false
    });
    return token.display ? `<span class="tr-math">${math}</span>` : math;
  } catch {
    return raw;
  }
}
var mathExtension = {
  extensions: [
    {
      name: "math",
      level: "block",
      tokenizer(source) {
        const block = mathBlockAt(source);
        if (!block)
          return;
        return { type: "math", raw: block.raw, text: block.body, display: true };
      },
      renderer: renderMath
    },
    {
      name: "math",
      level: "inline",
      start: mathStartIndex,
      tokenizer(source) {
        const span = mathSpanAt(source, 0);
        if (!span || !typesettable(span))
          return;
        return { type: "math", raw: source.slice(0, span.end), text: span.body, display: span.display };
      },
      renderer: renderMath
    }
  ]
};
var tableExtension = {
  extensions: [
    {
      name: "table",
      level: "block",
      renderer(token) {
        const html = Renderer.prototype.table.call(this.parser.renderer, token);
        return `<div class="tr-table-wrap">${html}</div>`;
      }
    }
  ]
};
var md = new Marked({
  gfm: true,
  renderer: {
    html({ text }) {
      const cleaned = text.replace(/<\/?(?:advisory|span|text)\b(?:\s[^>]*)?\s*\/?>/gi, "");
      if (cleaned === "")
        return "";
      return escapeHtml2(unescapeHtml(cleaned));
    },
    code({ text, lang, raw, codeBlockStyle }) {
      if (lang?.trim().toLowerCase() === "mermaid" && fenceClosed(raw)) {
        const svg = mermaidCache.get(text);
        if (svg)
          return `<div class="tr-mermaid">${svg}</div>`;
        if (svg === undefined)
          requestMermaid(text);
        return false;
      }
      if (codeBlockStyle === "indented")
        return false;
      const langClass = lang ? ` class="language-${escapeHtml2(lang.trim().split(/\s+/)[0])}"` : "";
      const copyBtn = `<button type="button" class="tr-copy-btn tr-copy-btn--fence" aria-label="Copy" title="Copy"><svg class="tr-copy-icon tr-copy-icon--copy" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg><svg class="tr-copy-icon tr-copy-icon--check" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg><span class="tr-copy-label">Copy</span><span class="tr-copy-label tr-copy-label--copied">Copied</span></button>`;
      return `<div class="tr-fence-wrap">${copyBtn}<pre><code${langClass}>${escapeHtml2(text)}
</code></pre></div>`;
    },
    link({ href, title, tokens }) {
      const inner = this.parser.parseInline(tokens);
      const url = safeHref(href);
      if (url === null)
        return inner;
      const titleAttr = title ? ` title="${escapeHtml2(title)}"` : "";
      return `<a href="${escapeHtml2(url)}"${titleAttr} target="_blank" rel="noopener">${inner}</a>`;
    }
  },
  breaks: true
});
md.use(tableExtension);
md.use(mathExtension);
function renderMarkdown(text) {
  try {
    return md.parse(text, { async: false });
  } catch {
    return escapeHtml2(text);
  }
}
var Markdown = import_react5.memo(function Markdown2({
  text,
  magicWords = false
}) {
  const ready = import_react5.useSyncExternalStore(subscribeKatex, katexReady, katexReady);
  const diagrams = import_react5.useSyncExternalStore(subscribeMermaid, mermaidSnapshot, mermaidSnapshot);
  const html = import_react5.useMemo(() => {
    const rendered = renderMarkdown(text);
    return magicWords ? highlightMagicWords(rendered) : rendered;
  }, [text, magicWords, ready, diagrams]);
  const [openSvg, setOpenSvg] = import_react5.useState(null);
  const copyTimers = import_react5.useRef(new Map);
  const close = import_react5.useCallback(() => setOpenSvg(null), []);
  import_react5.useEffect(() => {
    const timers = copyTimers.current;
    return () => {
      for (const id of timers.values()) {
        clearTimeout(id);
      }
      timers.clear();
    };
  }, []);
  const onClick = (e) => {
    const target = e.target;
    const copyBtn = target.closest(".tr-copy-btn--fence");
    if (copyBtn) {
      e.stopPropagation();
      const wrap = copyBtn.closest(".tr-fence-wrap");
      const codeEl = wrap?.querySelector("pre > code");
      const textToCopy = codeEl ? (codeEl.textContent ?? "").replace(/\n$/, "") : "";
      const clipboard = browserWindow.navigator?.clipboard;
      if (clipboard?.writeText) {
        clipboard.writeText(textToCopy).then(() => {
          copyBtn.classList.add("tr-copy-btn--copied");
          copyBtn.setAttribute("aria-label", "Copied");
          copyBtn.setAttribute("title", "Copied");
          const existing = copyTimers.current.get(copyBtn);
          if (existing !== undefined)
            clearTimeout(existing);
          const id = setTimeout(() => {
            copyBtn.classList.remove("tr-copy-btn--copied");
            copyBtn.setAttribute("aria-label", "Copy");
            copyBtn.setAttribute("title", "Copy");
            copyTimers.current.delete(copyBtn);
          }, 1500);
          copyTimers.current.set(copyBtn, id);
        }).catch(() => {});
      }
      return;
    }
    const diagram = target.closest(".tr-mermaid");
    if (diagram)
      setOpenSvg(diagram.innerHTML);
  };
  return /* @__PURE__ */ jsx_runtime2.jsxs(jsx_runtime2.Fragment, {
    children: [
      /* @__PURE__ */ jsx_runtime2.jsx("div", {
        className: "tr-md",
        onClick,
        dangerouslySetInnerHTML: { __html: html }
      }),
      openSvg !== null && /* @__PURE__ */ jsx_runtime2.jsx(MermaidViewer, {
        svg: openSvg,
        onClose: close
      })
    ]
  });
});

// src/components/transcript/ToolCard.tsx
var import_react10 = __toESM(require_react(), 1);
// ../wire/src/index.ts
var INTENT_FIELD = "i";

// src/components/transcript/tool-views/ToolView.tsx
var import_react9 = __toESM(require_react(), 1);

// src/components/transcript/tool-views/parts.tsx
var import_react7 = __toESM(require_react(), 1);

// src/components/transcript/CopyButton.tsx
var import_react6 = __toESM(require_react(), 1);
var jsx_runtime3 = __toESM(require_jsx_runtime(), 1);
function CopyButton({ text, className, title = "Copy" }) {
  const [copied, setCopied] = import_react6.useState(false);
  const timerRef = import_react6.useRef(null);
  import_react6.useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);
  const handleCopy = import_react6.useCallback((e) => {
    e.stopPropagation();
    const payload = typeof text === "function" ? text() : text;
    const clipboard = browserWindow.navigator?.clipboard;
    if (!clipboard?.writeText)
      return;
    clipboard.writeText(payload).then(() => {
      setCopied(true);
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        setCopied(false);
        timerRef.current = null;
      }, 1500);
    }).catch(() => {});
  }, [text]);
  const baseClass = "tr-copy-btn";
  const fullClass = className ? `${baseClass} ${className}` : baseClass;
  return /* @__PURE__ */ jsx_runtime3.jsx("button", {
    type: "button",
    className: fullClass,
    onClick: handleCopy,
    "aria-label": copied ? "Copied" : title,
    title: copied ? "Copied" : title,
    children: copied ? /* @__PURE__ */ jsx_runtime3.jsxs(jsx_runtime3.Fragment, {
      children: [
        /* @__PURE__ */ jsx_runtime3.jsx(Check, {
          size: 13,
          className: "tr-copy-icon",
          "aria-hidden": "true"
        }),
        /* @__PURE__ */ jsx_runtime3.jsx("span", {
          className: "tr-copy-label",
          children: "Copied"
        })
      ]
    }) : /* @__PURE__ */ jsx_runtime3.jsxs(jsx_runtime3.Fragment, {
      children: [
        /* @__PURE__ */ jsx_runtime3.jsx(Copy, {
          size: 13,
          className: "tr-copy-icon",
          "aria-hidden": "true"
        }),
        /* @__PURE__ */ jsx_runtime3.jsx("span", {
          className: "tr-copy-label",
          children: "Copy"
        })
      ]
    })
  });
}

// src/components/transcript/tool-views/util.ts
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function str(value) {
  return typeof value === "string" ? value : null;
}
function num(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function display(value) {
  if (value == null)
    return "";
  if (typeof value === "string")
    return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return String(value);
  }
}
function shortenPath(p) {
  for (const prefix of ["/Users/", "/home/"]) {
    if (p.startsWith(prefix)) {
      const rest = p.slice(prefix.length);
      const slash = rest.indexOf("/");
      return slash < 0 ? "~" : `~${rest.slice(slash)}`;
    }
  }
  return p;
}
function scopePaths(args) {
  const raw = args.path ?? args.paths;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed) && parsed.every((p) => typeof p === "string")) {
          return parsed;
        }
      } catch {}
    }
    return [raw];
  }
  if (Array.isArray(raw))
    return raw.filter((p) => typeof p === "string");
  return [];
}
function truncate(s, maxLen = 100) {
  return s.length <= maxLen ? s : `${s.slice(0, maxLen)}…`;
}
function normalizeWs(s) {
  return s.replace(/\s+/g, " ").trim();
}
function replaceTabs(s) {
  return s.replace(/\t/g, "   ");
}
var ANSI_RE = /\x1b(?:\[[0-9;?]*[ -/]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\))/g;
function stripAnsi(s) {
  return s.replace(ANSI_RE, "");
}
var EXT_TO_LANG = {
  ts: "typescript",
  tsx: "typescript",
  mts: "typescript",
  cts: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  py: "python",
  rb: "ruby",
  rs: "rust",
  go: "go",
  java: "java",
  kt: "kotlin",
  swift: "swift",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  hpp: "cpp",
  cs: "csharp",
  php: "php",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  fish: "bash",
  sql: "sql",
  html: "html",
  css: "css",
  scss: "scss",
  less: "less",
  json: "json",
  jsonc: "json",
  json5: "json",
  yaml: "yaml",
  yml: "yaml",
  toml: "ini",
  ini: "ini",
  xml: "xml",
  svg: "xml",
  md: "markdown",
  mdx: "markdown",
  dockerfile: "dockerfile",
  lua: "lua",
  zig: "zig",
  diff: "diff",
  patch: "diff"
};
function languageFromPath(filePath) {
  const base = filePath.split("/").pop() ?? "";
  if (/^dockerfile$/i.test(base))
    return "dockerfile";
  const ext = base.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_LANG[ext] ?? null;
}
function resultTextOf(result) {
  if (!result)
    return "";
  const parts = [];
  for (const block of result.content) {
    if (block.type === "text" && typeof block.text === "string") {
      parts.push(block.text);
    }
  }
  return parts.join(`
`);
}
function resultImagesOf(result) {
  if (!result)
    return [];
  const images = [];
  for (const block of result.content) {
    const img = block;
    if (block.type === "image" && typeof img.data === "string" && typeof img.mimeType === "string") {
      images.push(img);
    }
  }
  return images;
}
function detailsRecord(result) {
  return result && isRecord(result.details) ? result.details : null;
}
function argsDigest(args, maxLen = 96) {
  if (args == null)
    return "";
  if (isRecord(args) && Object.keys(args).length === 0)
    return "";
  return truncate(normalizeWs(display(args)), maxLen);
}
function getHljs() {
  const candidate = globalThis.hljs;
  return candidate && typeof candidate.highlight === "function" ? candidate : null;
}

// src/components/transcript/tool-views/parts.tsx
var jsx_runtime4 = __toESM(require_jsx_runtime(), 1);
function Badge({ children, tone }) {
  if (children == null || children === "" || children === false)
    return null;
  return /* @__PURE__ */ jsx_runtime4.jsx("span", {
    className: `tv-badge${tone ? ` tv-badge--${tone}` : ""}`,
    children
  });
}
function Badges({ items }) {
  const visible = items.filter((item) => item != null && item !== "" && item !== false);
  if (visible.length === 0)
    return null;
  return /* @__PURE__ */ jsx_runtime4.jsx("span", {
    className: "tv-badges",
    children: visible.map((item, i) => /* @__PURE__ */ jsx_runtime4.jsx(Badge, {
      children: item
    }, i))
  });
}
function PathText({
  path,
  from,
  to,
  sel
}) {
  let range = "";
  if (from != null || to != null) {
    const start = from ?? 1;
    range = to != null ? `:${start}-${to}` : `:${start}`;
  }
  return /* @__PURE__ */ jsx_runtime4.jsxs("span", {
    className: "tv-path",
    children: [
      shortenPath(path),
      range && /* @__PURE__ */ jsx_runtime4.jsx("span", {
        className: "tv-lines",
        children: range
      }),
      sel && /* @__PURE__ */ jsx_runtime4.jsxs("span", {
        className: "tv-lines",
        children: [
          ":",
          sel
        ]
      })
    ]
  });
}
function KvGrid({ children }) {
  return /* @__PURE__ */ jsx_runtime4.jsx("div", {
    className: "tv-kv",
    children
  });
}
function Kv({ k, children }) {
  if (children == null || children === "" || children === false)
    return null;
  return /* @__PURE__ */ jsx_runtime4.jsxs(jsx_runtime4.Fragment, {
    children: [
      /* @__PURE__ */ jsx_runtime4.jsx("span", {
        className: "tv-kv-key",
        children: k
      }),
      /* @__PURE__ */ jsx_runtime4.jsx("span", {
        className: "tv-kv-val",
        children
      })
    ]
  });
}
function useHighlight(code, lang) {
  return import_react7.useMemo(() => {
    if (!lang)
      return null;
    const hljs = getHljs();
    if (!hljs)
      return null;
    try {
      if (!hljs.getLanguage(lang))
        return null;
      return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
    } catch {
      return null;
    }
  }, [code, lang]);
}
function Output({ text, maxLines = 10, lang, error, variant = "plain", title, bare }) {
  const [expanded, setExpanded] = import_react7.useState(false);
  const clean = import_react7.useMemo(() => replaceTabs(stripAnsi(text)).replace(/\n+$/, ""), [text]);
  const lines = import_react7.useMemo(() => clean.split(`
`), [clean]);
  const collapsible = lines.length > maxLines + 1;
  const shown = collapsible && !expanded ? lines.slice(0, maxLines).join(`
`) : clean;
  const html = useHighlight(shown, error ? null : lang);
  const classes = ["tv-pre"];
  if (variant === "plain")
    classes.push("tv-pre--wrap");
  if (error)
    classes.push("tv-pre--error");
  if (bare)
    classes.push("tv-pre--bare");
  return /* @__PURE__ */ jsx_runtime4.jsxs("div", {
    className: "tv-out",
    children: [
      /* @__PURE__ */ jsx_runtime4.jsxs("div", {
        className: "tv-out-header",
        children: [
          title && /* @__PURE__ */ jsx_runtime4.jsx("div", {
            className: "tv-out-title",
            children: title
          }),
          /* @__PURE__ */ jsx_runtime4.jsx(CopyButton, {
            text: clean,
            className: "tv-out-copy"
          })
        ]
      }),
      html !== null ? /* @__PURE__ */ jsx_runtime4.jsx("pre", {
        className: classes.join(" "),
        dangerouslySetInnerHTML: { __html: html }
      }) : /* @__PURE__ */ jsx_runtime4.jsx("pre", {
        className: classes.join(" "),
        children: shown
      }),
      collapsible && /* @__PURE__ */ jsx_runtime4.jsx("button", {
        type: "button",
        className: "tv-expand",
        onClick: () => setExpanded((v) => !v),
        children: expanded ? "collapse" : `⋯ ${lines.length - maxLines} more lines`
      })
    ]
  });
}
function CodeBlock({
  code,
  lang,
  title,
  maxLines = 14
}) {
  if (!code)
    return null;
  return /* @__PURE__ */ jsx_runtime4.jsx(Output, {
    text: code,
    lang,
    maxLines,
    variant: "code",
    title
  });
}
function ResultText({
  result,
  maxLines = 10,
  lang,
  variant,
  title
}) {
  const text = resultTextOf(result).trim();
  if (!text)
    return null;
  return /* @__PURE__ */ jsx_runtime4.jsx(Output, {
    text,
    maxLines,
    lang: result?.isError ? null : lang,
    error: result?.isError === true,
    variant: variant ?? (lang ? "code" : "plain"),
    title
  });
}
function openImage(img) {
  try {
    const bin = atob(img.data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0;i < bin.length; i++)
      bytes[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: img.mimeType }));
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch {}
}
function ResultImages({ result }) {
  const images = resultImagesOf(result);
  if (images.length === 0)
    return null;
  return /* @__PURE__ */ jsx_runtime4.jsx("div", {
    className: "tv-imgs",
    children: images.map((img, i) => /* @__PURE__ */ jsx_runtime4.jsx("button", {
      type: "button",
      style: { all: "unset", display: "inline-flex" },
      onClick: () => openImage(img),
      "aria-label": `Open tool result image ${i + 1}`,
      children: /* @__PURE__ */ jsx_runtime4.jsx("img", {
        className: "tv-img",
        src: `data:${img.mimeType};base64,${img.data}`,
        alt: `tool result ${i + 1}`
      })
    }, i))
  });
}
function Note({ tone, children }) {
  if (children == null || children === "" || children === false)
    return null;
  return /* @__PURE__ */ jsx_runtime4.jsx("div", {
    className: `tv-note${tone ? ` tv-note--${tone}` : ""}`,
    children
  });
}
function Row({ k, children }) {
  return /* @__PURE__ */ jsx_runtime4.jsxs("div", {
    className: "tv-row",
    children: [
      k != null && k !== "" && /* @__PURE__ */ jsx_runtime4.jsx("span", {
        className: "tv-row-key",
        children: k
      }),
      /* @__PURE__ */ jsx_runtime4.jsx("span", {
        className: "tv-row-val",
        children
      })
    ]
  });
}
function InvalidArg({ what }) {
  return /* @__PURE__ */ jsx_runtime4.jsxs("span", {
    className: "tv-err-text",
    children: [
      "[invalid ",
      what ?? "arg",
      "]"
    ]
  });
}
function DiffBlock({ diff, maxLines = 80 }) {
  const [expanded, setExpanded] = import_react7.useState(false);
  const clean = import_react7.useMemo(() => replaceTabs(stripAnsi(diff)).replace(/\n+$/, ""), [diff]);
  const lines = import_react7.useMemo(() => clean.split(`
`), [clean]);
  const collapsible = lines.length > maxLines + 1;
  const shown = collapsible && !expanded ? lines.slice(0, maxLines) : lines;
  const newSideText = import_react7.useMemo(() => {
    return lines.filter((line) => !line.startsWith("-") && !line.startsWith("@@") && !line.startsWith("---") && !line.startsWith("+++")).map((line) => line.startsWith("+") ? line.slice(1) : line).join(`
`).replace(/\n+$/, "");
  }, [lines]);
  return /* @__PURE__ */ jsx_runtime4.jsxs("div", {
    className: "tv-out",
    children: [
      /* @__PURE__ */ jsx_runtime4.jsx("div", {
        className: "tv-out-header",
        children: /* @__PURE__ */ jsx_runtime4.jsx(CopyButton, {
          text: newSideText,
          className: "tv-out-copy"
        })
      }),
      /* @__PURE__ */ jsx_runtime4.jsx("div", {
        className: "tv-diff",
        children: shown.map((line, i) => {
          let cls = "";
          if (line.trim().length === 0)
            cls = "--gap";
          else if (line.startsWith("+"))
            cls = "--add";
          else if (line.startsWith("-"))
            cls = "--del";
          else if (line.startsWith("@@"))
            cls = "--hunk";
          return /* @__PURE__ */ jsx_runtime4.jsx("div", {
            className: `tv-diff-row${cls ? ` tv-diff-row${cls}` : ""}`,
            children: line.trim().length === 0 ? "…" : line
          }, i);
        })
      }),
      collapsible && /* @__PURE__ */ jsx_runtime4.jsx("button", {
        type: "button",
        className: "tv-expand",
        onClick: () => setExpanded((v) => !v),
        children: expanded ? "collapse" : `⋯ ${lines.length - maxLines} more lines`
      })
    ]
  });
}
function AgentLink({
  id,
  host,
  children
}) {
  const clickable = host?.openAgent !== undefined && (host.hasAgent === undefined || host.hasAgent(id));
  if (!clickable)
    return /* @__PURE__ */ jsx_runtime4.jsx(Badge, {
      tone: "accent",
      children: children ?? id
    });
  return /* @__PURE__ */ jsx_runtime4.jsxs("button", {
    type: "button",
    className: "tv-badge tv-badge--accent tv-agent-link",
    onClick: () => host.openAgent?.(id),
    children: [
      children ?? id,
      /* @__PURE__ */ jsx_runtime4.jsx("span", {
        className: "tv-agent-link-arrow",
        "aria-hidden": "true",
        children: " ↗"
      })
    ]
  });
}

// src/components/transcript/tool-views/generic.tsx
var jsx_runtime5 = __toESM(require_jsx_runtime(), 1);
function Summary({ args }) {
  return /* @__PURE__ */ jsx_runtime5.jsx("span", {
    children: argsDigest(args)
  });
}
function Body({ args, result }) {
  let argText = "";
  try {
    argText = JSON.stringify(args, null, 2) ?? "";
  } catch {
    argText = String(args);
  }
  return /* @__PURE__ */ jsx_runtime5.jsxs(jsx_runtime5.Fragment, {
    children: [
      argText && argText !== "{}" && /* @__PURE__ */ jsx_runtime5.jsx(Output, {
        text: argText,
        lang: "json",
        variant: "code",
        maxLines: 12,
        title: "args"
      }),
      /* @__PURE__ */ jsx_runtime5.jsx(ResultImages, {
        result
      }),
      /* @__PURE__ */ jsx_runtime5.jsx(ResultText, {
        result,
        maxLines: 10
      })
    ]
  });
}
var genericRenderer = { Summary, Body };

// src/components/transcript/tool-views/tools/ask.tsx
var jsx_runtime6 = __toESM(require_jsx_runtime(), 1);
var RECOMMENDED_SUFFIX = " (Recommended)";
function stripRecommended(label) {
  return label.endsWith(RECOMMENDED_SUFFIX) ? label.slice(0, -RECOMMENDED_SUFFIX.length) : label;
}
function normalizeOptions(raw) {
  if (!Array.isArray(raw))
    return [];
  const out = [];
  for (const entry of raw) {
    if (typeof entry === "string") {
      out.push({ label: entry });
      continue;
    }
    if (!isRecord(entry))
      continue;
    const label = str(entry.label);
    if (label === null)
      continue;
    const description = str(entry.description);
    out.push(description !== null ? { label, description } : { label });
  }
  return out;
}
function normalizeQuestions(raw) {
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw))
    return [];
  const out = [];
  for (const entry of raw) {
    if (!isRecord(entry))
      continue;
    out.push({
      id: str(entry.id) ?? "?",
      question: str(entry.question) ?? "",
      options: normalizeOptions(entry.options),
      multi: entry.multi === true,
      recommended: num(entry.recommended) ?? undefined
    });
  }
  return out;
}
function questionsOf(args) {
  const questions = normalizeQuestions(args.questions);
  if (questions.length > 0)
    return questions;
  const question = str(args.question);
  if (question === null)
    return [];
  return [
    {
      id: "?",
      question,
      options: normalizeOptions(args.options),
      multi: args.multi === true,
      recommended: num(args.recommended) ?? undefined
    }
  ];
}
function answerOf(rec) {
  const selectedOptions = [];
  if (Array.isArray(rec.selectedOptions)) {
    for (const entry of rec.selectedOptions) {
      const label = str(entry);
      if (label !== null)
        selectedOptions.push(stripRecommended(label));
    }
  }
  return {
    id: str(rec.id) ?? undefined,
    selectedOptions,
    customInput: str(rec.customInput) ?? undefined,
    note: str(rec.note) ?? undefined,
    timedOut: rec.timedOut === true
  };
}
function answersOf(details) {
  if (!details)
    return null;
  if (Array.isArray(details.results)) {
    const out = [];
    for (const entry of details.results)
      if (isRecord(entry))
        out.push(answerOf(entry));
    return out.length > 0 ? out : null;
  }
  if (details.question !== undefined || details.selectedOptions !== undefined || details.customInput !== undefined) {
    return [answerOf(details)];
  }
  return null;
}
function questionsFromDetails(details) {
  const source = Array.isArray(details.results) ? details.results : [details];
  const out = [];
  for (const entry of source) {
    if (!isRecord(entry))
      continue;
    const question = str(entry.question);
    if (question === null)
      continue;
    out.push({
      id: str(entry.id) ?? "?",
      question,
      options: normalizeOptions(entry.options),
      multi: entry.multi === true
    });
  }
  return out;
}
function Summary2({ args }) {
  const questions = questionsOf(args);
  const first = questions[0];
  if (!first)
    return /* @__PURE__ */ jsx_runtime6.jsx(InvalidArg, {
      what: "questions"
    });
  return /* @__PURE__ */ jsx_runtime6.jsxs(jsx_runtime6.Fragment, {
    children: [
      /* @__PURE__ */ jsx_runtime6.jsx("span", {
        children: truncate(normalizeWs(first.question), 70)
      }),
      questions.length > 1 && /* @__PURE__ */ jsx_runtime6.jsxs(Badge, {
        children: [
          questions.length,
          " questions"
        ]
      })
    ]
  });
}
function QuestionBlock({ q, answer }) {
  const selected = new Set(answer?.selectedOptions);
  return /* @__PURE__ */ jsx_runtime6.jsxs("div", {
    className: "tv-list",
    children: [
      /* @__PURE__ */ jsx_runtime6.jsxs(Row, {
        children: [
          q.id !== "?" && /* @__PURE__ */ jsx_runtime6.jsxs("span", {
            className: "tv-faint",
            children: [
              "[",
              q.id,
              "] "
            ]
          }),
          q.question ? /* @__PURE__ */ jsx_runtime6.jsx("span", {
            children: q.question
          }) : /* @__PURE__ */ jsx_runtime6.jsx(InvalidArg, {
            what: "question"
          }),
          q.multi && /* @__PURE__ */ jsx_runtime6.jsx(Badge, {
            children: "multi"
          })
        ]
      }),
      q.options.map((opt, i) => {
        const isSelected = selected.has(stripRecommended(opt.label));
        const marker = q.multi ? isSelected ? "■" : "□" : isSelected ? "●" : "○";
        return /* @__PURE__ */ jsx_runtime6.jsxs(Row, {
          k: /* @__PURE__ */ jsx_runtime6.jsx("span", {
            className: isSelected ? "tv-ok-text" : undefined,
            children: marker
          }),
          children: [
            /* @__PURE__ */ jsx_runtime6.jsx("span", {
              className: answer && !isSelected ? "tv-muted" : undefined,
              children: opt.label
            }),
            i === q.recommended && /* @__PURE__ */ jsx_runtime6.jsx(Badge, {
              tone: "accent",
              children: "recommended"
            }),
            opt.description && /* @__PURE__ */ jsx_runtime6.jsxs("span", {
              className: "tv-muted",
              children: [
                " — ",
                opt.description
              ]
            })
          ]
        }, i);
      }),
      answer?.customInput !== undefined && /* @__PURE__ */ jsx_runtime6.jsx(Row, {
        k: "✎",
        children: /* @__PURE__ */ jsx_runtime6.jsx("span", {
          className: "tv-ok-text",
          children: answer.customInput
        })
      }),
      answer?.note !== undefined && /* @__PURE__ */ jsx_runtime6.jsx(Row, {
        k: "note:",
        children: /* @__PURE__ */ jsx_runtime6.jsx("span", {
          className: "tv-muted",
          children: answer.note
        })
      }),
      answer && answer.selectedOptions.length === 0 && answer.customInput === undefined && /* @__PURE__ */ jsx_runtime6.jsx(Row, {
        k: "—",
        children: /* @__PURE__ */ jsx_runtime6.jsx("span", {
          className: "tv-warn-text",
          children: "no selection"
        })
      }),
      answer?.timedOut && /* @__PURE__ */ jsx_runtime6.jsx(Note, {
        tone: "warn",
        children: "auto-selected after timeout — not a user choice"
      })
    ]
  });
}
function Body2({ args, result }) {
  const details = detailsRecord(result);
  const answers = answersOf(details);
  let questions = questionsOf(args);
  if (questions.length === 0 && details)
    questions = questionsFromDetails(details);
  return /* @__PURE__ */ jsx_runtime6.jsxs(jsx_runtime6.Fragment, {
    children: [
      questions.map((q, i) => {
        const answer = answers ? answers.find((a) => a.id !== undefined && a.id === q.id) ?? answers[i] : undefined;
        return /* @__PURE__ */ jsx_runtime6.jsx(QuestionBlock, {
          q,
          answer
        }, i);
      }),
      questions.length === 0 && !result && /* @__PURE__ */ jsx_runtime6.jsx(InvalidArg, {
        what: "questions"
      }),
      !answers && /* @__PURE__ */ jsx_runtime6.jsx(ResultText, {
        result,
        maxLines: 10
      })
    ]
  });
}
var askRenderer = { Summary: Summary2, Body: Body2 };

// src/components/transcript/tool-views/tools/ast-edit.tsx
var jsx_runtime7 = __toESM(require_jsx_runtime(), 1);
function pathsOf(args) {
  if (!Array.isArray(args.paths))
    return [];
  const paths = [];
  for (const p of args.paths) {
    const s = str(p);
    if (s)
      paths.push(s);
  }
  return paths;
}
function opsOf(args) {
  if (!Array.isArray(args.ops))
    return [];
  const ops = [];
  for (const op of args.ops) {
    if (!isRecord(op))
      continue;
    ops.push({ pat: str(op.pat) ?? "", out: str(op.out) ?? "" });
  }
  return ops;
}
function detailsOf(result) {
  const d = detailsRecord(result);
  if (!d)
    return null;
  const fileReplacements = [];
  if (Array.isArray(d.fileReplacements)) {
    for (const fr of d.fileReplacements) {
      if (!isRecord(fr))
        continue;
      const path = str(fr.path);
      if (path)
        fileReplacements.push({ path, count: num(fr.count) });
    }
  }
  const parseErrors = [];
  if (Array.isArray(d.parseErrors)) {
    for (const e of d.parseErrors) {
      const s = str(e);
      if (s)
        parseErrors.push(s);
    }
  }
  return {
    totalReplacements: num(d.totalReplacements),
    filesTouched: num(d.filesTouched),
    filesSearched: num(d.filesSearched),
    limitReached: d.limitReached === true,
    scopePath: str(d.scopePath),
    fileReplacements,
    parseErrors,
    parseErrorsTotal: num(d.parseErrorsTotal),
    displayContent: str(d.displayContent)
  };
}
function Summary3({ args, result }) {
  const paths = pathsOf(args);
  const first = paths[0];
  const opCount = Array.isArray(args.ops) ? args.ops.length : 0;
  const details = detailsOf(result);
  const total = details?.totalReplacements;
  return /* @__PURE__ */ jsx_runtime7.jsxs(jsx_runtime7.Fragment, {
    children: [
      first ? /* @__PURE__ */ jsx_runtime7.jsx(PathText, {
        path: first
      }) : /* @__PURE__ */ jsx_runtime7.jsx(InvalidArg, {
        what: "paths"
      }),
      paths.length > 1 && /* @__PURE__ */ jsx_runtime7.jsxs("span", {
        className: "tv-faint",
        children: [
          "+",
          paths.length - 1,
          " more"
        ]
      }),
      /* @__PURE__ */ jsx_runtime7.jsxs(Badge, {
        tone: "accent",
        children: [
          opCount,
          " op",
          opCount === 1 ? "" : "s"
        ]
      }),
      total != null && /* @__PURE__ */ jsx_runtime7.jsxs(Badge, {
        tone: total > 0 ? "ok" : "warn",
        children: [
          total,
          " replacement",
          total === 1 ? "" : "s"
        ]
      }),
      details?.limitReached && /* @__PURE__ */ jsx_runtime7.jsx(Badge, {
        tone: "warn",
        children: "limit"
      })
    ]
  });
}
function OpCell({ op, lang }) {
  return /* @__PURE__ */ jsx_runtime7.jsxs("div", {
    className: "tv-cell",
    children: [
      op.pat ? /* @__PURE__ */ jsx_runtime7.jsx(CodeBlock, {
        code: op.pat,
        lang,
        title: "pattern",
        maxLines: 10
      }) : /* @__PURE__ */ jsx_runtime7.jsx(InvalidArg, {
        what: "pattern"
      }),
      op.out ? /* @__PURE__ */ jsx_runtime7.jsx(CodeBlock, {
        code: op.out,
        lang,
        title: "replacement",
        maxLines: 10
      }) : /* @__PURE__ */ jsx_runtime7.jsx("div", {
        className: "tv-muted",
        children: "deletion — matched code is removed"
      })
    ]
  });
}
function Body3({ args, result }) {
  const paths = pathsOf(args);
  const first = paths[0];
  const ops = opsOf(args);
  const details = result?.isError ? null : detailsOf(result);
  const lang = first ? languageFromPath(first) : null;
  const parseErrorsTotal = details ? details.parseErrorsTotal ?? details.parseErrors.length : 0;
  return /* @__PURE__ */ jsx_runtime7.jsxs(jsx_runtime7.Fragment, {
    children: [
      paths.length > 1 && /* @__PURE__ */ jsx_runtime7.jsx("div", {
        className: "tv-list",
        children: paths.map((p, i) => /* @__PURE__ */ jsx_runtime7.jsx(Row, {
          children: /* @__PURE__ */ jsx_runtime7.jsx(PathText, {
            path: p
          })
        }, i))
      }),
      ops.length > 0 && /* @__PURE__ */ jsx_runtime7.jsx("div", {
        className: "tv-cells",
        children: ops.map((op, i) => /* @__PURE__ */ jsx_runtime7.jsx(OpCell, {
          op,
          lang
        }, i))
      }),
      details && /* @__PURE__ */ jsx_runtime7.jsxs("span", {
        className: "tv-badges",
        children: [
          details.totalReplacements != null && /* @__PURE__ */ jsx_runtime7.jsxs(Badge, {
            tone: details.totalReplacements > 0 ? "ok" : "warn",
            children: [
              details.totalReplacements,
              " replacement",
              details.totalReplacements === 1 ? "" : "s"
            ]
          }),
          details.filesTouched != null && /* @__PURE__ */ jsx_runtime7.jsxs(Badge, {
            children: [
              details.filesTouched,
              " file",
              details.filesTouched === 1 ? "" : "s"
            ]
          }),
          details.filesSearched != null && /* @__PURE__ */ jsx_runtime7.jsxs(Badge, {
            children: [
              "searched ",
              details.filesSearched
            ]
          }),
          details.scopePath && /* @__PURE__ */ jsx_runtime7.jsxs(Badge, {
            children: [
              "in ",
              shortenPath(details.scopePath)
            ]
          }),
          details.limitReached && /* @__PURE__ */ jsx_runtime7.jsx(Badge, {
            tone: "warn",
            children: "limit reached"
          })
        ]
      }),
      details && details.fileReplacements.length > 0 && /* @__PURE__ */ jsx_runtime7.jsx("div", {
        className: "tv-list",
        children: details.fileReplacements.map((fr, i) => /* @__PURE__ */ jsx_runtime7.jsx(Row, {
          k: fr.count != null ? `×${fr.count}` : undefined,
          children: /* @__PURE__ */ jsx_runtime7.jsx(PathText, {
            path: fr.path
          })
        }, i))
      }),
      details?.limitReached && /* @__PURE__ */ jsx_runtime7.jsx(Note, {
        tone: "warn",
        children: "limit reached; narrow path"
      }),
      details && details.parseErrors.length > 0 && /* @__PURE__ */ jsx_runtime7.jsx(Output, {
        text: details.parseErrors.join(`
`),
        maxLines: 6,
        title: `parse issues (${parseErrorsTotal})`,
        variant: "plain"
      }),
      details?.displayContent ? /* @__PURE__ */ jsx_runtime7.jsx(DiffBlock, {
        diff: details.displayContent,
        maxLines: 40
      }) : /* @__PURE__ */ jsx_runtime7.jsx(ResultText, {
        result,
        maxLines: 12
      })
    ]
  });
}
var astEditRenderer = { Summary: Summary3, Body: Body3 };

// src/components/transcript/tool-views/tools/ast-grep.tsx
var jsx_runtime8 = __toESM(require_jsx_runtime(), 1);
function patternsOf(args) {
  if (typeof args.pat === "string")
    return [args.pat];
  if (Array.isArray(args.pat))
    return args.pat.filter((p) => typeof p === "string");
  return [];
}
function Summary4({ args }) {
  const patterns = patternsOf(args);
  const paths = scopePaths(args);
  const lang = str(args.lang);
  return /* @__PURE__ */ jsx_runtime8.jsxs(jsx_runtime8.Fragment, {
    children: [
      /* @__PURE__ */ jsx_runtime8.jsx("span", {
        className: "tv-pattern",
        children: patterns.length ? truncate(normalizeWs(patterns[0]), 64) : "?"
      }),
      patterns.length > 1 && /* @__PURE__ */ jsx_runtime8.jsxs("span", {
        className: "tv-faint",
        children: [
          "+",
          patterns.length - 1
        ]
      }),
      paths.length > 0 && /* @__PURE__ */ jsx_runtime8.jsx(PathText, {
        path: paths[0]
      }),
      paths.length > 1 && /* @__PURE__ */ jsx_runtime8.jsxs("span", {
        className: "tv-faint",
        children: [
          "+",
          paths.length - 1
        ]
      }),
      lang && /* @__PURE__ */ jsx_runtime8.jsx(Badge, {
        tone: "accent",
        children: lang
      })
    ]
  });
}
function Body4({ args, result }) {
  const patterns = patternsOf(args);
  const paths = scopePaths(args);
  const lang = str(args.lang);
  const glob = str(args.glob);
  const sel = str(args.sel);
  const skip = num(args.skip);
  const details = detailsRecord(result);
  const matchCount = num(details?.matchCount);
  const fileCount = num(details?.fileCount);
  const filesSearched = num(details?.filesSearched);
  const limitReached = details?.limitReached === true;
  const scopePath = str(details?.scopePath);
  const parseErrors = Array.isArray(details?.parseErrors) ? details.parseErrors.filter((e) => typeof e === "string") : [];
  const parseErrorsTotal = num(details?.parseErrorsTotal) ?? parseErrors.length;
  const argBadges = [
    lang && /* @__PURE__ */ jsx_runtime8.jsx(Badge, {
      tone: "accent",
      children: lang
    }, "lang"),
    glob && /* @__PURE__ */ jsx_runtime8.jsxs(Badge, {
      children: [
        "glob=",
        glob
      ]
    }, "glob"),
    sel && /* @__PURE__ */ jsx_runtime8.jsxs(Badge, {
      children: [
        "sel=",
        sel
      ]
    }, "sel"),
    skip !== null && skip > 0 && /* @__PURE__ */ jsx_runtime8.jsxs(Badge, {
      children: [
        "skip:",
        skip
      ]
    }, "skip")
  ];
  const resultBadges = result && !result.isError ? [
    matchCount !== null && /* @__PURE__ */ jsx_runtime8.jsxs(Badge, {
      tone: matchCount === 0 ? "warn" : "ok",
      children: [
        matchCount,
        " ",
        matchCount === 1 ? "match" : "matches"
      ]
    }, "matches"),
    fileCount !== null && fileCount > 0 && /* @__PURE__ */ jsx_runtime8.jsxs(Badge, {
      children: [
        fileCount,
        " ",
        fileCount === 1 ? "file" : "files"
      ]
    }, "files"),
    filesSearched !== null && /* @__PURE__ */ jsx_runtime8.jsxs(Badge, {
      children: [
        "searched ",
        filesSearched
      ]
    }, "searched"),
    limitReached && /* @__PURE__ */ jsx_runtime8.jsx(Badge, {
      tone: "warn",
      children: "limit reached"
    }, "limit")
  ] : [];
  return /* @__PURE__ */ jsx_runtime8.jsxs(jsx_runtime8.Fragment, {
    children: [
      /* @__PURE__ */ jsx_runtime8.jsx(Badges, {
        items: [...argBadges, ...resultBadges]
      }),
      patterns.length === 0 ? /* @__PURE__ */ jsx_runtime8.jsx(InvalidArg, {
        what: "pat"
      }) : patterns.map((pat, i) => /* @__PURE__ */ jsx_runtime8.jsx(CodeBlock, {
        code: pat,
        lang: lang ?? undefined,
        title: patterns.length > 1 ? `pattern ${i + 1}` : "pattern",
        maxLines: 12
      }, i)),
      (paths.length > 0 || scopePath) && /* @__PURE__ */ jsx_runtime8.jsxs(KvGrid, {
        children: [
          paths.length > 0 && /* @__PURE__ */ jsx_runtime8.jsx(Kv, {
            k: paths.length === 1 ? "path" : "paths",
            children: paths.map((p, i) => /* @__PURE__ */ jsx_runtime8.jsxs("span", {
              children: [
                i > 0 && ", ",
                /* @__PURE__ */ jsx_runtime8.jsx(PathText, {
                  path: p
                })
              ]
            }, i))
          }),
          scopePath && /* @__PURE__ */ jsx_runtime8.jsx(Kv, {
            k: "scope",
            children: /* @__PURE__ */ jsx_runtime8.jsx(PathText, {
              path: scopePath
            })
          })
        ]
      }),
      parseErrors.length > 0 && /* @__PURE__ */ jsx_runtime8.jsx(Output, {
        text: parseErrors.join(`
`),
        maxLines: 6,
        title: parseErrorsTotal > parseErrors.length ? `parse issues (${parseErrorsTotal} total)` : "parse issues"
      }),
      /* @__PURE__ */ jsx_runtime8.jsx(ResultText, {
        result,
        maxLines: 12
      })
    ]
  });
}
var astGrepRenderer = { Summary: Summary4, Body: Body4 };

// src/components/transcript/tool-views/tools/bash.tsx
var jsx_runtime9 = __toESM(require_jsx_runtime(), 1);
var SHELL_SAFE = /^[\w@%+=:,./-]+$/;
var ARTIFACT_NOTICE = /\[raw output: artifact:\/\/([\w-]+)\]/;
function envPrefix(env) {
  const parts = [];
  for (const k in env) {
    const v = display(env[k]);
    parts.push(`${k}=${SHELL_SAFE.test(v) ? v : JSON.stringify(v)}`);
  }
  return parts.join(" ");
}
function asyncDetailsOf(details) {
  if (!details || !isRecord(details.async))
    return null;
  const state = str(details.async.state);
  return state ? { state, jobId: str(details.async.jobId) } : null;
}
function Summary5({ args, result }) {
  const command = args.command === undefined ? "…" : str(args.command);
  if (command === null)
    return /* @__PURE__ */ jsx_runtime9.jsx(InvalidArg, {
      what: "command"
    });
  const text = truncate(normalizeWs(command) || "…", 80);
  return result?.isError ? /* @__PURE__ */ jsx_runtime9.jsx("span", {
    className: "tv-err-text",
    children: text
  }) : /* @__PURE__ */ jsx_runtime9.jsx("span", {
    children: text
  });
}
function Body5({ args, result }) {
  const command = args.command === undefined ? "…" : str(args.command);
  const prefix = isRecord(args.env) ? envPrefix(args.env) : "";
  const cwd = str(args.cwd);
  const head = num(args.head);
  const tail = num(args.tail);
  const details = detailsRecord(result);
  const exitCode = num(details?.exitCode);
  const wallTimeMs = num(details?.wallTimeMs);
  const timeoutSeconds = num(args.timeout) ?? num(details?.timeoutSeconds);
  const requestedTimeoutSeconds = num(details?.requestedTimeoutSeconds);
  const job = asyncDetailsOf(details);
  const artifactId = ARTIFACT_NOTICE.exec(resultTextOf(result))?.[1] ?? null;
  const stats = [];
  if (wallTimeMs !== null) {
    stats.push(wallTimeMs < 1000 ? `wall ${Math.round(wallTimeMs)}ms` : `wall ${(wallTimeMs / 1000).toFixed(1)}s`);
  }
  if (requestedTimeoutSeconds !== null && requestedTimeoutSeconds !== timeoutSeconds) {
    stats.push(`requested timeout ${requestedTimeoutSeconds}s clamped`);
  }
  if (job?.jobId)
    stats.push(`job ${job.jobId}`);
  if (artifactId)
    stats.push(`artifact ${artifactId}`);
  return /* @__PURE__ */ jsx_runtime9.jsxs(jsx_runtime9.Fragment, {
    children: [
      /* @__PURE__ */ jsx_runtime9.jsxs("div", {
        className: "tv-cmd",
        children: [
          /* @__PURE__ */ jsx_runtime9.jsx("span", {
            className: "tv-cmd-prompt",
            children: "$"
          }),
          /* @__PURE__ */ jsx_runtime9.jsxs("span", {
            className: "tv-cmd-text",
            children: [
              prefix && /* @__PURE__ */ jsx_runtime9.jsx("span", {
                className: "tv-cmd-env",
                children: `${prefix} `
              }),
              command ?? /* @__PURE__ */ jsx_runtime9.jsx(InvalidArg, {
                what: "command"
              })
            ]
          })
        ]
      }),
      /* @__PURE__ */ jsx_runtime9.jsx(Badges, {
        items: [
          cwd && /* @__PURE__ */ jsx_runtime9.jsxs(Badge, {
            children: [
              "cwd=",
              shortenPath(cwd)
            ]
          }),
          timeoutSeconds !== null && /* @__PURE__ */ jsx_runtime9.jsxs(Badge, {
            children: [
              "timeout=",
              timeoutSeconds,
              "s"
            ]
          }),
          args.pty === true && /* @__PURE__ */ jsx_runtime9.jsx(Badge, {
            tone: "accent",
            children: "pty"
          }),
          !job && args.async === true && /* @__PURE__ */ jsx_runtime9.jsx(Badge, {
            tone: "accent",
            children: "async"
          }),
          head !== null && /* @__PURE__ */ jsx_runtime9.jsxs(Badge, {
            children: [
              "head=",
              head
            ]
          }),
          tail !== null && /* @__PURE__ */ jsx_runtime9.jsxs(Badge, {
            children: [
              "tail=",
              tail
            ]
          }),
          exitCode !== null && /* @__PURE__ */ jsx_runtime9.jsxs(Badge, {
            tone: "err",
            children: [
              "exit ",
              exitCode
            ]
          }),
          job && /* @__PURE__ */ jsx_runtime9.jsxs(Badge, {
            tone: job.state === "failed" ? "err" : job.state === "running" ? "accent" : "ok",
            children: [
              "async ",
              job.state
            ]
          })
        ]
      }),
      /* @__PURE__ */ jsx_runtime9.jsx(ResultImages, {
        result
      }),
      /* @__PURE__ */ jsx_runtime9.jsx(ResultText, {
        result,
        maxLines: 12
      }),
      stats.length > 0 && /* @__PURE__ */ jsx_runtime9.jsx(Row, {
        children: stats.join(" · ")
      })
    ]
  });
}
var bashRenderer = { Summary: Summary5, Body: Body5 };

// src/components/transcript/tool-views/tools/browser.tsx
var jsx_runtime10 = __toESM(require_jsx_runtime(), 1);
function detailsOf2(result) {
  const d = detailsRecord(result);
  return {
    action: d ? str(d.action) : null,
    name: d ? str(d.name) : null,
    url: d ? str(d.url) : null,
    browser: d ? str(d.browser) : null
  };
}
function appOf(args) {
  if (!isRecord(args.app))
    return null;
  return { path: str(args.app.path), cdpUrl: str(args.app.cdp_url), target: str(args.app.target) };
}
function actionTone(action) {
  switch (action) {
    case "open":
      return "ok";
    case "run":
      return "accent";
    case "close":
      return "warn";
    default:
      return;
  }
}
function describeBrowser(app, details) {
  if (app?.cdpUrl)
    return `connected ${app.cdpUrl}`;
  if (app?.path)
    return `spawned ${shortenPath(app.path)}`;
  return details.browser;
}
function Summary6({ args, result }) {
  const details = detailsOf2(result);
  const action = str(args.action) ?? details.action ?? "?";
  const closeAll = action === "close" && (args.all === true || str(args.name) === null && details.name === null);
  const tab = details.name ?? str(args.name) ?? "main";
  const url = details.url ?? str(args.url);
  return /* @__PURE__ */ jsx_runtime10.jsxs(jsx_runtime10.Fragment, {
    children: [
      /* @__PURE__ */ jsx_runtime10.jsx(Badge, {
        tone: actionTone(action),
        children: action
      }),
      /* @__PURE__ */ jsx_runtime10.jsx("span", {
        children: closeAll ? "all tabs" : tab
      }),
      args.kill === true && /* @__PURE__ */ jsx_runtime10.jsx(Badge, {
        tone: "err",
        children: "kill"
      }),
      url && /* @__PURE__ */ jsx_runtime10.jsx("span", {
        className: "tv-faint",
        children: truncate(shortenPath(url), 72)
      })
    ]
  });
}
function Body6({ args, result }) {
  const details = detailsOf2(result);
  const action = str(args.action) ?? details.action;
  const app = appOf(args);
  const tab = details.name ?? str(args.name);
  const url = details.url ?? str(args.url);
  const browserDesc = describeBrowser(app, details);
  const viewport = isRecord(args.viewport) ? args.viewport : null;
  const vpWidth = viewport ? num(viewport.width) : null;
  const vpHeight = viewport ? num(viewport.height) : null;
  const vpScale = viewport ? num(viewport.scale) : null;
  const code = str(args.code);
  return /* @__PURE__ */ jsx_runtime10.jsxs(jsx_runtime10.Fragment, {
    children: [
      /* @__PURE__ */ jsx_runtime10.jsxs("span", {
        className: "tv-badges",
        children: [
          tab !== null && /* @__PURE__ */ jsx_runtime10.jsxs(Badge, {
            children: [
              "tab ",
              tab
            ]
          }),
          url && /* @__PURE__ */ jsx_runtime10.jsx(Badge, {
            tone: "accent",
            children: truncate(shortenPath(url), 120)
          }),
          browserDesc && /* @__PURE__ */ jsx_runtime10.jsx(Badge, {
            children: browserDesc
          }),
          app?.target && /* @__PURE__ */ jsx_runtime10.jsxs(Badge, {
            children: [
              "target ",
              app.target
            ]
          }),
          args.all === true && /* @__PURE__ */ jsx_runtime10.jsx(Badge, {
            tone: "warn",
            children: "all"
          }),
          args.kill === true && /* @__PURE__ */ jsx_runtime10.jsx(Badge, {
            tone: "err",
            children: "kill"
          }),
          vpWidth !== null && vpHeight !== null && /* @__PURE__ */ jsx_runtime10.jsxs(Badge, {
            children: [
              vpWidth,
              "×",
              vpHeight,
              vpScale !== null ? `@${vpScale}x` : ""
            ]
          })
        ]
      }),
      action === "run" && code !== null && /* @__PURE__ */ jsx_runtime10.jsx(CodeBlock, {
        code: code.replace(/\s+$/, ""),
        lang: "javascript"
      }),
      /* @__PURE__ */ jsx_runtime10.jsx(ResultImages, {
        result
      }),
      /* @__PURE__ */ jsx_runtime10.jsx(ResultText, {
        result,
        maxLines: 10
      })
    ]
  });
}
var browserRenderer = { Summary: Summary6, Body: Body6 };

// src/components/transcript/tool-views/tools/debug.tsx
var jsx_runtime11 = __toESM(require_jsx_runtime(), 1);
function snapshotOf(result) {
  const rec = detailsRecord(result);
  if (!rec || !isRecord(rec.snapshot))
    return null;
  const snap = rec.snapshot;
  const source = isRecord(snap.source) ? snap.source : null;
  return {
    id: str(snap.id) ?? (num(snap.id) !== null ? String(snap.id) : null),
    adapter: str(snap.adapter),
    status: str(snap.status),
    program: str(snap.program),
    stopReason: str(snap.stopReason),
    frameName: str(snap.frameName),
    sourcePath: source ? str(source.path) : null,
    line: num(snap.line),
    column: num(snap.column),
    exitCode: num(snap.exitCode),
    needsConfigurationDone: snap.needsConfigurationDone === true
  };
}
function actionOf(props) {
  const action = str(props.args.action) ?? str(detailsRecord(props.result)?.action);
  return action ? action.replace(/_/g, " ") : "request";
}
function targetTextOf(args) {
  return str(args.function) ?? str(args.expression) ?? str(args.command) ?? str(args.memory_reference) ?? str(args.instruction_reference) ?? str(args.data_id) ?? str(args.name);
}
function Summary7(props) {
  const { args } = props;
  const program = str(args.program);
  const file = str(args.file);
  const line = num(args.line);
  const target = targetTextOf(args);
  return /* @__PURE__ */ jsx_runtime11.jsxs(jsx_runtime11.Fragment, {
    children: [
      /* @__PURE__ */ jsx_runtime11.jsx(Badge, {
        tone: "accent",
        children: actionOf(props)
      }),
      program !== null ? /* @__PURE__ */ jsx_runtime11.jsx(PathText, {
        path: program
      }) : file !== null ? /* @__PURE__ */ jsx_runtime11.jsx(PathText, {
        path: file,
        from: line ?? undefined
      }) : target !== null ? /* @__PURE__ */ jsx_runtime11.jsx("span", {
        children: truncate(normalizeWs(target), 80)
      }) : null
    ]
  });
}
var SCALAR_ARGS = [
  ["adapter", "adapter"],
  ["cwd", "cwd"],
  ["function", "function"],
  ["name", "name"],
  ["condition", "condition"],
  ["hit_condition", "hit condition"],
  ["context", "context"],
  ["frame_id", "frame id"],
  ["scope_id", "scope id"],
  ["variable_ref", "variable ref"],
  ["pid", "pid"],
  ["host", "host"],
  ["port", "port"],
  ["levels", "levels"],
  ["memory_reference", "memory ref"],
  ["instruction_reference", "instruction ref"],
  ["instruction_count", "instruction count"],
  ["instruction_offset", "instruction offset"],
  ["offset", "offset"],
  ["count", "count"],
  ["data", "data"],
  ["data_id", "data id"],
  ["access_type", "access"],
  ["command", "command"],
  ["resolve_symbols", "resolve symbols"],
  ["allow_partial", "allow partial"],
  ["start_module", "start module"],
  ["module_count", "module count"],
  ["timeout", "timeout"]
];
function Body7(props) {
  const { args, result } = props;
  const program = str(args.program);
  const file = str(args.file);
  const line = num(args.line);
  const expression = str(args.expression);
  const programArgs = Array.isArray(args.args) ? args.args.filter((a) => typeof a === "string") : [];
  const argRows = [];
  if (program !== null) {
    argRows.push(/* @__PURE__ */ jsx_runtime11.jsx(Kv, {
      k: "program",
      children: /* @__PURE__ */ jsx_runtime11.jsx(PathText, {
        path: program
      })
    }, "program"));
  }
  if (programArgs.length > 0) {
    argRows.push(/* @__PURE__ */ jsx_runtime11.jsx(Kv, {
      k: "args",
      children: truncate(programArgs.join(" "), 160)
    }, "args"));
  }
  if (file !== null) {
    argRows.push(/* @__PURE__ */ jsx_runtime11.jsx(Kv, {
      k: "file",
      children: /* @__PURE__ */ jsx_runtime11.jsx(PathText, {
        path: file,
        from: line ?? undefined
      })
    }, "file"));
  } else if (line !== null) {
    argRows.push(/* @__PURE__ */ jsx_runtime11.jsx(Kv, {
      k: "line",
      children: line
    }, "line"));
  }
  for (const [key, label] of SCALAR_ARGS) {
    const value = args[key];
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean")
      continue;
    argRows.push(/* @__PURE__ */ jsx_runtime11.jsx(Kv, {
      k: label,
      children: truncate(display(value), 120)
    }, key));
  }
  let customArgsJson = "";
  if (isRecord(args.arguments)) {
    try {
      customArgsJson = JSON.stringify(args.arguments, null, 2) ?? "";
    } catch {
      customArgsJson = "";
    }
  }
  const snapshot = snapshotOf(result);
  return /* @__PURE__ */ jsx_runtime11.jsxs(jsx_runtime11.Fragment, {
    children: [
      argRows.length > 0 && /* @__PURE__ */ jsx_runtime11.jsx(KvGrid, {
        children: argRows
      }),
      expression !== null && /* @__PURE__ */ jsx_runtime11.jsx(CodeBlock, {
        code: expression,
        title: "expression",
        maxLines: 8
      }),
      customArgsJson && /* @__PURE__ */ jsx_runtime11.jsx(CodeBlock, {
        code: customArgsJson,
        lang: "json",
        title: "arguments",
        maxLines: 10
      }),
      snapshot && /* @__PURE__ */ jsx_runtime11.jsxs(KvGrid, {
        children: [
          snapshot.id !== null && /* @__PURE__ */ jsx_runtime11.jsx(Kv, {
            k: "session",
            children: snapshot.id
          }),
          snapshot.adapter !== null && /* @__PURE__ */ jsx_runtime11.jsx(Kv, {
            k: "adapter",
            children: snapshot.adapter
          }),
          snapshot.status !== null && /* @__PURE__ */ jsx_runtime11.jsx(Kv, {
            k: "status",
            children: /* @__PURE__ */ jsx_runtime11.jsx(Badge, {
              tone: snapshot.status === "exited" ? "warn" : "ok",
              children: snapshot.status
            })
          }),
          snapshot.program !== null && /* @__PURE__ */ jsx_runtime11.jsx(Kv, {
            k: "program",
            children: /* @__PURE__ */ jsx_runtime11.jsx(PathText, {
              path: snapshot.program
            })
          }),
          snapshot.stopReason !== null && /* @__PURE__ */ jsx_runtime11.jsx(Kv, {
            k: "stop reason",
            children: snapshot.stopReason
          }),
          snapshot.frameName !== null && /* @__PURE__ */ jsx_runtime11.jsx(Kv, {
            k: "frame",
            children: snapshot.frameName
          }),
          snapshot.sourcePath !== null && snapshot.line !== null && /* @__PURE__ */ jsx_runtime11.jsx(Kv, {
            k: "location",
            children: /* @__PURE__ */ jsx_runtime11.jsx(PathText, {
              path: snapshot.sourcePath,
              sel: snapshot.column !== null ? `${snapshot.line}:${snapshot.column}` : String(snapshot.line)
            })
          }),
          snapshot.exitCode !== null && /* @__PURE__ */ jsx_runtime11.jsx(Kv, {
            k: "exit code",
            children: snapshot.exitCode
          }),
          snapshot.needsConfigurationDone && /* @__PURE__ */ jsx_runtime11.jsx(Kv, {
            k: "configuration",
            children: "pending configurationDone — set breakpoints, then continue"
          })
        ]
      }),
      /* @__PURE__ */ jsx_runtime11.jsx(ResultText, {
        result,
        maxLines: 10
      })
    ]
  });
}
var debugRenderer = { Summary: Summary7, Body: Body7 };

// src/components/transcript/tool-views/tools/edit.tsx
var jsx_runtime12 = __toESM(require_jsx_runtime(), 1);
function headerPath(line) {
  const trimmed = line.trimEnd();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]"))
    return null;
  let body = trimmed.slice(1, -1).trim();
  const hash = /#[0-9a-fA-F]{4}$/.exec(body);
  if (hash)
    body = body.slice(0, hash.index);
  if (body.length >= 2) {
    const first = body[0];
    if ((first === '"' || first === "'") && first === body[body.length - 1])
      body = body.slice(1, -1);
  }
  return body.length > 0 ? body : null;
}
var APPLY_PATCH_HEADER_RE = /^\*{3} (?:Update|Add|Delete) File:\s*(.+)$/;
function inputPaths(input) {
  const stripped = input.startsWith("\uFEFF") ? input.slice(1) : input;
  const paths = [];
  for (const rawLine of stripped.split(`
`)) {
    const line = rawLine.replace(/\r$/, "");
    const fromHashline = headerPath(line);
    if (fromHashline) {
      paths.push(fromHashline);
      continue;
    }
    const fromApplyPatch = APPLY_PATCH_HEADER_RE.exec(line.trim());
    if (fromApplyPatch)
      paths.push(fromApplyPatch[1].trim());
  }
  return paths;
}
var OP_HEADER_RE = /^(?:replace|insert|delete)\b/;
function countOps(input) {
  let count = 0;
  for (const line of input.split(`
`))
    if (OP_HEADER_RE.test(line))
      count++;
  return count;
}
function diffStats(diff) {
  let added = 0;
  let removed = 0;
  for (const line of diff.split(`
`)) {
    if (line.startsWith("+"))
      added++;
    else if (line.startsWith("-"))
      removed++;
  }
  return { added, removed };
}
function fileEntry(d) {
  const diag = isRecord(d.diagnostics) ? d.diagnostics : null;
  const messages = [];
  if (diag && Array.isArray(diag.messages)) {
    for (const m of diag.messages)
      if (typeof m === "string")
        messages.push(m);
  }
  return {
    path: str(d.path),
    diff: str(d.diff),
    firstChangedLine: num(d.firstChangedLine),
    op: str(d.op),
    move: str(d.move),
    isError: d.isError === true,
    errorText: str(d.displayErrorText) ?? str(d.errorText),
    diagnostics: diag ? { summary: str(diag.summary), messages, errored: diag.errored === true } : null
  };
}
function Summary8({ args, result }) {
  const input = str(args.input) ?? str(args._input);
  const paths = input ? inputPaths(input) : [];
  const argPath = str(args.file_path) ?? str(args.path);
  if (paths.length === 0 && argPath)
    paths.push(argPath);
  if (paths.length === 0 && Array.isArray(args.edits)) {
    for (const e of args.edits) {
      const p = isRecord(e) ? str(e.path) : null;
      if (p && !paths.includes(p))
        paths.push(p);
    }
  }
  const opCount = input ? countOps(input) : 0;
  const details = detailsRecord(result);
  const diff = details && result?.isError !== true ? str(details.diff) : null;
  const stats = diff ? diffStats(diff) : null;
  const firstLine = input ? truncate(normalizeWs(input.split(`
`, 1)[0] ?? ""), 80) : "";
  return /* @__PURE__ */ jsx_runtime12.jsxs(jsx_runtime12.Fragment, {
    children: [
      paths.length > 0 ? /* @__PURE__ */ jsx_runtime12.jsx(PathText, {
        path: paths[0]
      }) : /* @__PURE__ */ jsx_runtime12.jsx("span", {
        children: firstLine
      }),
      paths.length > 1 && /* @__PURE__ */ jsx_runtime12.jsxs(jsx_runtime12.Fragment, {
        children: [
          " ",
          /* @__PURE__ */ jsx_runtime12.jsxs(Badge, {
            children: [
              "+",
              paths.length - 1,
              " more"
            ]
          })
        ]
      }),
      opCount > 0 && /* @__PURE__ */ jsx_runtime12.jsxs(jsx_runtime12.Fragment, {
        children: [
          " ",
          /* @__PURE__ */ jsx_runtime12.jsxs(Badge, {
            children: [
              opCount,
              " op",
              opCount === 1 ? "" : "s"
            ]
          })
        ]
      }),
      stats !== null && stats.added > 0 && /* @__PURE__ */ jsx_runtime12.jsxs(jsx_runtime12.Fragment, {
        children: [
          " ",
          /* @__PURE__ */ jsx_runtime12.jsxs(Badge, {
            tone: "ok",
            children: [
              "+",
              stats.added
            ]
          })
        ]
      }),
      stats !== null && stats.removed > 0 && /* @__PURE__ */ jsx_runtime12.jsxs(jsx_runtime12.Fragment, {
        children: [
          " ",
          /* @__PURE__ */ jsx_runtime12.jsxs(Badge, {
            tone: "err",
            children: [
              "−",
              stats.removed
            ]
          })
        ]
      }),
      result?.isError === true && /* @__PURE__ */ jsx_runtime12.jsxs(jsx_runtime12.Fragment, {
        children: [
          " ",
          /* @__PURE__ */ jsx_runtime12.jsx(Badge, {
            tone: "err",
            children: "failed"
          })
        ]
      })
    ]
  });
}
function FileSection({ entry, fallbackPath }) {
  const path = entry.path ?? fallbackPath ?? null;
  const op = entry.op === "create" || entry.op === "delete" ? entry.op : null;
  const diag = entry.diagnostics;
  return /* @__PURE__ */ jsx_runtime12.jsxs("div", {
    children: [
      (path !== null || op !== null || entry.move !== null) && /* @__PURE__ */ jsx_runtime12.jsx("div", {
        className: "tv-row",
        children: /* @__PURE__ */ jsx_runtime12.jsxs("span", {
          className: "tv-row-val",
          children: [
            path !== null && /* @__PURE__ */ jsx_runtime12.jsx(PathText, {
              path,
              from: entry.isError ? null : entry.firstChangedLine
            }),
            entry.move !== null && /* @__PURE__ */ jsx_runtime12.jsxs(jsx_runtime12.Fragment, {
              children: [
                " → ",
                /* @__PURE__ */ jsx_runtime12.jsx(PathText, {
                  path: entry.move
                })
              ]
            }),
            op !== null && /* @__PURE__ */ jsx_runtime12.jsxs(jsx_runtime12.Fragment, {
              children: [
                " ",
                /* @__PURE__ */ jsx_runtime12.jsx(Badge, {
                  tone: op === "delete" ? "err" : "ok",
                  children: op
                })
              ]
            }),
            entry.isError && /* @__PURE__ */ jsx_runtime12.jsxs(jsx_runtime12.Fragment, {
              children: [
                " ",
                /* @__PURE__ */ jsx_runtime12.jsx(Badge, {
                  tone: "err",
                  children: "failed"
                })
              ]
            })
          ]
        })
      }),
      entry.isError ? entry.errorText !== null && /* @__PURE__ */ jsx_runtime12.jsx(Output, {
        text: entry.errorText,
        error: true,
        maxLines: 10
      }) : entry.diff !== null && entry.diff.length > 0 && /* @__PURE__ */ jsx_runtime12.jsx(DiffBlock, {
        diff: entry.diff,
        maxLines: 40
      }),
      diag?.summary && /* @__PURE__ */ jsx_runtime12.jsx(Note, {
        tone: diag.errored ? "err" : "warn",
        children: diag.summary
      }),
      diag !== null && diag.messages.length > 0 && /* @__PURE__ */ jsx_runtime12.jsx(Output, {
        text: diag.messages.join(`
`),
        maxLines: 6
      })
    ]
  });
}
function Body8({ args, result }) {
  const input = str(args.input) ?? str(args._input);
  const details = detailsRecord(result);
  const perFile = [];
  if (details && Array.isArray(details.perFileResults)) {
    for (const f of details.perFileResults)
      if (isRecord(f))
        perFile.push(fileEntry(f));
  }
  const fallbackPath = str(args.file_path) ?? str(args.path) ?? (input ? inputPaths(input)[0] ?? null : null);
  let outcome;
  if (perFile.length > 0) {
    outcome = perFile.map((f, i) => /* @__PURE__ */ jsx_runtime12.jsx(FileSection, {
      entry: f
    }, `${f.path ?? ""}:${i}`));
  } else if (result?.isError === true) {
    outcome = /* @__PURE__ */ jsx_runtime12.jsx(ResultText, {
      result,
      maxLines: 15
    });
  } else if (details) {
    const top = fileEntry(details);
    outcome = top.diff !== null || top.diagnostics !== null || top.move !== null ? /* @__PURE__ */ jsx_runtime12.jsx(FileSection, {
      entry: top,
      fallbackPath
    }) : /* @__PURE__ */ jsx_runtime12.jsx(ResultText, {
      result,
      maxLines: 8
    });
  } else {
    outcome = /* @__PURE__ */ jsx_runtime12.jsx(ResultText, {
      result,
      maxLines: 8
    });
  }
  return /* @__PURE__ */ jsx_runtime12.jsxs(jsx_runtime12.Fragment, {
    children: [
      outcome,
      Array.isArray(args.edits) && args.edits.length > 0 && /* @__PURE__ */ jsx_runtime12.jsx(KvGrid, {
        children: args.edits.map((e, i) => isRecord(e) ? /* @__PURE__ */ jsx_runtime12.jsx(Kv, {
          k: str(e.op) ?? "edit",
          children: str(e.sel) ?? str(e.path) ?? str(e.rename) ?? str(e.move) ?? "?"
        }, `${i}`) : /* @__PURE__ */ jsx_runtime12.jsx(Kv, {
          k: "edit",
          children: /* @__PURE__ */ jsx_runtime12.jsx(InvalidArg, {
            what: "edit"
          })
        }, `${i}`))
      }),
      input !== null && input.length > 0 && /* @__PURE__ */ jsx_runtime12.jsx(Output, {
        text: input,
        variant: "code",
        maxLines: 10,
        title: "input"
      }),
      input === null && (args.input !== undefined || args._input !== undefined) && /* @__PURE__ */ jsx_runtime12.jsx(InvalidArg, {
        what: "input"
      })
    ]
  });
}
var editRenderer = { Summary: Summary8, Body: Body8 };

// src/components/transcript/tool-views/tools/eval.tsx
var jsx_runtime13 = __toESM(require_jsx_runtime(), 1);
var HLJS_LANG = {
  py: "python",
  js: "javascript",
  ts: "typescript",
  rb: "ruby",
  jl: "julia"
};
function evalLangAlias(token) {
  const t = (token ?? "").toUpperCase();
  if (t === "PY" || t === "PYTHON" || t === "IPY" || t === "IPYTHON")
    return "py";
  if (t === "JS" || t === "JAVASCRIPT")
    return "js";
  if (t === "TS" || t === "TYPESCRIPT")
    return "ts";
  if (t === "RB" || t === "RUBY")
    return "rb";
  if (t === "JL" || t === "JULIA")
    return "jl";
  return null;
}
function tokenizeCellAttrs(input) {
  const tokens = [];
  let i = 0;
  while (i < input.length) {
    while (i < input.length && /\s/.test(input[i]))
      i++;
    if (i >= input.length)
      break;
    let tok = "";
    while (i < input.length && !/\s/.test(input[i])) {
      const ch = input[i];
      if (ch === '"' || ch === "'") {
        tok += ch;
        i++;
        while (i < input.length && input[i] !== ch) {
          tok += input[i];
          i++;
        }
        if (i < input.length) {
          tok += input[i];
          i++;
        }
      } else {
        tok += ch;
        i++;
      }
    }
    tokens.push(tok);
  }
  return tokens;
}
function parseEvalCellsCell(text) {
  const CELL = /^\*{2,}\s*Cell\b\s*(.*)$/i;
  const END = /^\*{2,}\s*End\b.*$/i;
  const ATTR = /^([a-zA-Z][\w-]*)(?::(?:"([^"]*)"|'([^']*)'|(.*)))?$/;
  const DUR = /^\d+(?:ms|s|m)?$/;
  const ID_KEYS = ["id", "title", "name", "cell", "file", "label"];
  const T_KEYS = ["t", "timeout", "duration", "time"];
  const RST_KEYS = ["rst", "reset"];
  const lines = text.split(`
`);
  if (lines.length > 0 && lines[lines.length - 1] === "")
    lines.pop();
  const cells = [];
  let i = 0;
  while (i < lines.length && lines[i].trim() === "")
    i++;
  while (i < lines.length) {
    const m = CELL.exec(lines[i]);
    if (!m) {
      i++;
      continue;
    }
    const tokens = tokenizeCellAttrs(m[1] ?? "");
    let lang = null;
    let title = "";
    const attrs = [];
    let bareReset = false;
    const titleParts = [];
    for (const tok of tokens) {
      if (RST_KEYS.includes(tok.toLowerCase())) {
        bareReset = true;
        continue;
      }
      const am = ATTR.exec(tok);
      if (am && tok.includes(":")) {
        const key = am[1].toLowerCase();
        const value = am[2] ?? am[3] ?? am[4] ?? "";
        const lc2 = evalLangAlias(key);
        if (lc2) {
          if (!lang)
            lang = lc2;
          if (!title && value)
            title = value;
          continue;
        }
        if (ID_KEYS.includes(key)) {
          if (!title)
            title = value;
          continue;
        }
        if (T_KEYS.includes(key)) {
          attrs.push(`t=${value}`);
          continue;
        }
        if (RST_KEYS.includes(key))
          attrs.push("rst");
        continue;
      }
      const lc = evalLangAlias(tok);
      if (lc && !lang) {
        lang = lc;
        continue;
      }
      if (DUR.test(tok)) {
        attrs.push(`t=${tok}`);
        continue;
      }
      titleParts.push(tok);
    }
    if (!title && titleParts.length > 0)
      title = titleParts.join(" ");
    if (bareReset)
      attrs.push("rst");
    i++;
    const codeLines = [];
    while (i < lines.length) {
      if (END.test(lines[i])) {
        i++;
        break;
      }
      if (CELL.test(lines[i]))
        break;
      codeLines.push(lines[i]);
      i++;
    }
    while (codeLines.length > 0 && codeLines[codeLines.length - 1].trim() === "")
      codeLines.pop();
    cells.push({ lang: lang ?? "py", title, attrs, code: codeLines.join(`
`) });
    while (i < lines.length && lines[i].trim() === "")
      i++;
  }
  return cells;
}
function parseEvalCellsBegin(text) {
  const BEGIN = /^\*{2,}\s*Begin\b\s*(\S+)?\s*$/i;
  const END = /^\*{2,}\s*End\b.*$/i;
  const TITLE = /^\*{2,}\s*Title\s*:\s*(.+?)\s*$/i;
  const TIMEOUT = /^\*{2,}\s*Timeout\s*:\s*(\S+)\s*$/i;
  const RESET = /^\*{2,}\s*Reset\s*$/i;
  const lines = text.split(`
`);
  if (lines.length > 0 && lines[lines.length - 1] === "")
    lines.pop();
  const cells = [];
  let i = 0;
  while (i < lines.length && lines[i].trim() === "")
    i++;
  while (i < lines.length) {
    const beginMatch = BEGIN.exec(lines[i]);
    if (!beginMatch) {
      i++;
      continue;
    }
    const lang = evalLangAlias(beginMatch[1]) ?? "py";
    i++;
    let title = "";
    const attrs = [];
    while (i < lines.length) {
      const tm = TITLE.exec(lines[i]);
      if (tm) {
        if (!title)
          title = tm[1];
        i++;
        continue;
      }
      const to = TIMEOUT.exec(lines[i]);
      if (to) {
        attrs.push(`t=${to[1]}`);
        i++;
        continue;
      }
      if (RESET.test(lines[i])) {
        attrs.push("rst");
        i++;
        continue;
      }
      break;
    }
    const codeLines = [];
    while (i < lines.length) {
      if (END.test(lines[i])) {
        i++;
        break;
      }
      if (BEGIN.test(lines[i]))
        break;
      codeLines.push(lines[i]);
      i++;
    }
    while (codeLines.length > 0 && codeLines[codeLines.length - 1].trim() === "")
      codeLines.pop();
    cells.push({ lang, title, attrs, code: codeLines.join(`
`) });
    while (i < lines.length && lines[i].trim() === "")
      i++;
  }
  return cells;
}
function parseEvalCellsLegacy(input) {
  const HEADER = /^={5,}\s*(.*?)\s*={5,}\s*$/;
  const lines = input.split(`
`);
  const cells = [];
  let inheritedLang = "py";
  let current = null;
  for (const line of lines) {
    const m = HEADER.exec(line);
    if (m) {
      if (current)
        cells.push(current);
      const info = m[1] ?? "";
      let lang = inheritedLang;
      let title = "";
      const langMatch = info.match(/^(py|js|ts|rb|jl)(?::"([^"]*)")?/);
      if (langMatch) {
        lang = langMatch[1];
        if (langMatch[2])
          title = langMatch[2];
      }
      if (!title) {
        const idMatch = info.match(/id:"([^"]*)"/);
        if (idMatch)
          title = idMatch[1];
      }
      inheritedLang = lang;
      const attrs = [];
      const tMatch = info.match(/(?:^|\s)t:(\S+)/);
      if (tMatch)
        attrs.push(`t=${tMatch[1]}`);
      if (/(?:^|\s)rst(?:\s|$)/.test(info))
        attrs.push("rst");
      current = { lang, title, attrs, code: "" };
    } else {
      if (!current)
        current = { lang: inheritedLang, title: "", attrs: [], code: "" };
      current.code += (current.code ? `
` : "") + line;
    }
  }
  if (current)
    cells.push(current);
  return cells.map((c) => ({ ...c, code: c.code.replace(/\s+$/, "") }));
}
function parseEvalCells(input) {
  if (/^\*{2,}\s*Cell\b/im.test(input))
    return parseEvalCellsCell(input);
  if (/^\*{2,}\s*Begin\b/im.test(input))
    return parseEvalCellsBegin(input);
  return parseEvalCellsLegacy(input);
}
function cellsFromArgs(args, name) {
  const raw = args.cells;
  if (Array.isArray(raw)) {
    const out = [];
    for (const item of raw) {
      if (!isRecord(item))
        continue;
      const attrs = [];
      const timeout = num(item.timeout);
      if (timeout !== null)
        attrs.push(`t=${timeout}s`);
      if (item.reset === true)
        attrs.push("rst");
      out.push({
        lang: evalLangAlias(str(item.language) ?? undefined) ?? "py",
        title: str(item.title) ?? "",
        attrs,
        code: str(item.code) ?? ""
      });
    }
    return out;
  }
  const input = str(args.input);
  if (input !== null)
    return parseEvalCells(input).filter((c) => c.code !== "" || c.title !== "");
  const code = str(args.code);
  if (code !== null) {
    const attrs = [];
    const timeout = num(args.timeout);
    if (timeout !== null)
      attrs.push(`t=${timeout}s`);
    if (args.reset === true)
      attrs.push("rst");
    const lang = evalLangAlias(str(args.language) ?? undefined) ?? (name === "js" ? "js" : "py");
    return [{ lang, title: str(args.title) ?? "", attrs, code }];
  }
  return [];
}
function detailCellsOf(details) {
  const raw = details?.cells;
  if (!Array.isArray(raw))
    return [];
  const out = [];
  for (let i = 0;i < raw.length; i++) {
    const item = raw[i];
    if (!isRecord(item))
      continue;
    const language = str(item.language);
    out.push({
      index: num(item.index) ?? i,
      title: str(item.title) ?? "",
      code: str(item.code) ?? "",
      lang: language !== null ? evalLangAlias(language) ?? "py" : null,
      output: str(item.output) ?? "",
      status: str(item.status) ?? "",
      durationMs: num(item.durationMs),
      exitCode: num(item.exitCode)
    });
  }
  return out;
}
function renderCells(args, name, detailCells) {
  const cells = cellsFromArgs(args, name);
  if (cells.length > 0)
    return cells;
  return detailCells.map((c) => ({ lang: c.lang ?? "py", title: c.title, attrs: [], code: c.code }));
}
function Summary9({ name, args, result }) {
  const cells = renderCells(args, name, detailCellsOf(detailsRecord(result)));
  if (cells.length === 0)
    return /* @__PURE__ */ jsx_runtime13.jsx("span", {
      className: "tv-muted",
      children: argsDigest(args)
    });
  const first = cells[0];
  const label = first.title || normalizeWs(first.code.split(`
`).find((l) => l.trim() !== "") ?? "");
  const langs = [...new Set(cells.map((c) => c.lang))];
  return /* @__PURE__ */ jsx_runtime13.jsxs(jsx_runtime13.Fragment, {
    children: [
      label && /* @__PURE__ */ jsx_runtime13.jsx("span", {
        children: truncate(label, 72)
      }),
      /* @__PURE__ */ jsx_runtime13.jsx(Badges, {
        items: [cells.length > 1 ? `${cells.length} cells` : null, ...langs]
      })
    ]
  });
}
function Body9({ name, args, result }) {
  const details = detailsRecord(result);
  const detailCells = detailCellsOf(details);
  const cells = renderCells(args, name, detailCells);
  if (cells.length === 0) {
    const badArgs = !Array.isArray(args.cells) && str(args.input) === null && str(args.code) === null;
    return /* @__PURE__ */ jsx_runtime13.jsxs(jsx_runtime13.Fragment, {
      children: [
        badArgs && /* @__PURE__ */ jsx_runtime13.jsx(InvalidArg, {
          what: "cells"
        }),
        /* @__PURE__ */ jsx_runtime13.jsx(ResultImages, {
          result
        }),
        /* @__PURE__ */ jsx_runtime13.jsx(ResultText, {
          result,
          maxLines: 12
        })
      ]
    });
  }
  const jsonOutputs = Array.isArray(details?.jsonOutputs) ? details.jsonOutputs : [];
  const jsonText = jsonOutputs.map((v) => {
    try {
      return JSON.stringify(v, null, 2) ?? String(v);
    } catch {
      return String(v);
    }
  }).join(`
`);
  const notice = str(details?.notice);
  return /* @__PURE__ */ jsx_runtime13.jsxs(jsx_runtime13.Fragment, {
    children: [
      /* @__PURE__ */ jsx_runtime13.jsx("div", {
        className: "tv-cells",
        children: cells.map((cell, i) => {
          const dc = detailCells.find((c) => c.index === i) ?? detailCells[i];
          const titleParts = [];
          if (cell.title)
            titleParts.push(cell.title);
          titleParts.push(cell.lang);
          titleParts.push(...cell.attrs);
          if (dc) {
            if (dc.durationMs !== null) {
              const ms = dc.durationMs;
              titleParts.push(ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`);
            }
            if (dc.status === "error")
              titleParts.push(dc.exitCode !== null ? `error (exit ${dc.exitCode})` : "error");
          }
          return /* @__PURE__ */ jsx_runtime13.jsxs("div", {
            className: "tv-cell",
            children: [
              /* @__PURE__ */ jsx_runtime13.jsx(CodeBlock, {
                code: cell.code,
                lang: HLJS_LANG[cell.lang] ?? null,
                title: titleParts.join(" · ")
              }),
              dc && dc.output !== "" && /* @__PURE__ */ jsx_runtime13.jsx(Output, {
                text: dc.output,
                maxLines: 12,
                error: dc.status === "error"
              })
            ]
          }, `c${i}`);
        })
      }),
      jsonText && /* @__PURE__ */ jsx_runtime13.jsx(Output, {
        text: jsonText,
        lang: "json",
        variant: "code",
        maxLines: 12,
        title: "display"
      }),
      notice && /* @__PURE__ */ jsx_runtime13.jsx(Note, {
        children: notice
      }),
      /* @__PURE__ */ jsx_runtime13.jsx(ResultImages, {
        result
      }),
      detailCells.length === 0 && /* @__PURE__ */ jsx_runtime13.jsx(ResultText, {
        result,
        maxLines: 12
      })
    ]
  });
}
var evalRenderer = { Summary: Summary9, Body: Body9 };

// src/components/transcript/tool-views/tools/fetch.tsx
var jsx_runtime14 = __toESM(require_jsx_runtime(), 1);
function fetchDetails(record) {
  if (!record)
    return null;
  const notes = [];
  if (Array.isArray(record.notes)) {
    for (const note of record.notes) {
      const text = str(note);
      if (text)
        notes.push(text);
    }
  }
  return {
    url: str(record.url),
    finalUrl: str(record.finalUrl),
    contentType: str(record.contentType),
    method: str(record.method),
    truncated: record.truncated === true,
    notes
  };
}
function Summary10({ args, result }) {
  const url = str(args.url) ?? str(args.path);
  const method = (str(args.method) ?? "").toUpperCase();
  const details = fetchDetails(detailsRecord(result));
  return /* @__PURE__ */ jsx_runtime14.jsxs(jsx_runtime14.Fragment, {
    children: [
      url ? /* @__PURE__ */ jsx_runtime14.jsx("span", {
        className: "tv-path",
        children: truncate(url, 90)
      }) : /* @__PURE__ */ jsx_runtime14.jsx(InvalidArg, {
        what: "url"
      }),
      method && method !== "GET" && /* @__PURE__ */ jsx_runtime14.jsxs(jsx_runtime14.Fragment, {
        children: [
          " ",
          /* @__PURE__ */ jsx_runtime14.jsx(Badge, {
            tone: "accent",
            children: method
          })
        ]
      }),
      args.raw === true && /* @__PURE__ */ jsx_runtime14.jsxs(jsx_runtime14.Fragment, {
        children: [
          " ",
          /* @__PURE__ */ jsx_runtime14.jsx(Badge, {
            children: "raw"
          })
        ]
      }),
      details?.truncated && /* @__PURE__ */ jsx_runtime14.jsxs(jsx_runtime14.Fragment, {
        children: [
          " ",
          /* @__PURE__ */ jsx_runtime14.jsx(Badge, {
            tone: "warn",
            children: "truncated"
          })
        ]
      })
    ]
  });
}
function Body10({ args, result }) {
  const url = str(args.url) ?? str(args.path);
  const method = (str(args.method) ?? "").toUpperCase();
  const timeout = num(args.timeout);
  const details = fetchDetails(detailsRecord(result));
  const redirected = Boolean(details?.finalUrl && details.url && details.finalUrl !== details.url);
  return /* @__PURE__ */ jsx_runtime14.jsxs(jsx_runtime14.Fragment, {
    children: [
      /* @__PURE__ */ jsx_runtime14.jsxs(KvGrid, {
        children: [
          /* @__PURE__ */ jsx_runtime14.jsx(Kv, {
            k: "url",
            children: url ?? /* @__PURE__ */ jsx_runtime14.jsx(InvalidArg, {
              what: "url"
            })
          }),
          /* @__PURE__ */ jsx_runtime14.jsx(Kv, {
            k: "method",
            children: method && method !== "GET" && /* @__PURE__ */ jsx_runtime14.jsx(Badge, {
              tone: "accent",
              children: method
            })
          }),
          /* @__PURE__ */ jsx_runtime14.jsx(Kv, {
            k: "raw",
            children: args.raw === true && /* @__PURE__ */ jsx_runtime14.jsx(Badge, {
              children: "raw"
            })
          }),
          /* @__PURE__ */ jsx_runtime14.jsx(Kv, {
            k: "timeout",
            children: timeout != null && `${timeout}s`
          }),
          /* @__PURE__ */ jsx_runtime14.jsx(Kv, {
            k: "final url",
            children: redirected && details?.finalUrl
          }),
          /* @__PURE__ */ jsx_runtime14.jsx(Kv, {
            k: "content-type",
            children: details?.contentType
          }),
          /* @__PURE__ */ jsx_runtime14.jsx(Kv, {
            k: "via",
            children: details?.method
          }),
          /* @__PURE__ */ jsx_runtime14.jsx(Kv, {
            k: "notes",
            children: details && details.notes.length > 0 && details.notes.join("; ")
          }),
          /* @__PURE__ */ jsx_runtime14.jsx(Kv, {
            k: "truncated",
            children: details?.truncated && /* @__PURE__ */ jsx_runtime14.jsx(Badge, {
              tone: "warn",
              children: "output truncated"
            })
          })
        ]
      }),
      /* @__PURE__ */ jsx_runtime14.jsx(ResultText, {
        result,
        maxLines: 12,
        lang: "markdown"
      })
    ]
  });
}
var fetchRenderer = { Summary: Summary10, Body: Body10 };

// src/components/transcript/tool-views/tools/generate-image.tsx
var jsx_runtime15 = __toESM(require_jsx_runtime(), 1);
function withDetailImages(result) {
  const details = detailsRecord(result);
  if (!result || !details || !Array.isArray(details.images))
    return result;
  const extra = [];
  for (const img of details.images) {
    if (isRecord(img) && typeof img.data === "string" && typeof img.mimeType === "string") {
      extra.push({ type: "image", data: img.data, mimeType: img.mimeType });
    }
  }
  if (extra.length === 0)
    return result;
  return { content: [...result.content, ...extra], details: result.details, isError: result.isError };
}
function Summary11({ args }) {
  const subject = str(args.subject);
  const aspect = str(args.aspect_ratio);
  const changes = Array.isArray(args.changes) ? args.changes.length : 0;
  return /* @__PURE__ */ jsx_runtime15.jsxs(jsx_runtime15.Fragment, {
    children: [
      subject ? /* @__PURE__ */ jsx_runtime15.jsx("span", {
        children: truncate(normalizeWs(subject), 80)
      }) : args.subject !== undefined && /* @__PURE__ */ jsx_runtime15.jsx(InvalidArg, {
        what: "subject"
      }),
      " ",
      aspect && /* @__PURE__ */ jsx_runtime15.jsx(Badge, {
        children: aspect
      }),
      changes > 0 && /* @__PURE__ */ jsx_runtime15.jsxs(Badge, {
        tone: "accent",
        children: [
          "edit ×",
          changes
        ]
      })
    ]
  });
}
var PROMPT_FIELDS = [
  ["subject", "subject"],
  ["action", "action"],
  ["scene", "scene"],
  ["composition", "composition"],
  ["lighting", "lighting"],
  ["style", "style"],
  ["text", "text"],
  ["aspect_ratio", "aspect"],
  ["image_size", "size"]
];
function Body11({ args, result }) {
  const changes = Array.isArray(args.changes) ? args.changes : null;
  const inputs = Array.isArray(args.input) ? args.input : null;
  const details = detailsRecord(result);
  const provider = str(details?.provider);
  const model = str(details?.model);
  const revised = str(details?.revisedPrompt);
  const paths = [];
  if (details && Array.isArray(details.imagePaths)) {
    for (const p of details.imagePaths) {
      if (typeof p === "string")
        paths.push(p);
    }
  }
  const merged = withDetailImages(result);
  const hasImages = resultImagesOf(merged).length > 0;
  return /* @__PURE__ */ jsx_runtime15.jsxs(jsx_runtime15.Fragment, {
    children: [
      /* @__PURE__ */ jsx_runtime15.jsx(KvGrid, {
        children: PROMPT_FIELDS.map(([arg, label]) => {
          const value = args[arg];
          return /* @__PURE__ */ jsx_runtime15.jsx(Kv, {
            k: label,
            children: value === undefined ? null : str(value) ?? /* @__PURE__ */ jsx_runtime15.jsx(InvalidArg, {
              what: label
            })
          }, arg);
        })
      }),
      changes && changes.length > 0 && /* @__PURE__ */ jsx_runtime15.jsx("div", {
        className: "tv-list",
        children: changes.map((change, i) => /* @__PURE__ */ jsx_runtime15.jsx(Row, {
          k: i === 0 ? "changes" : undefined,
          children: typeof change === "string" ? change : /* @__PURE__ */ jsx_runtime15.jsx(InvalidArg, {
            what: "change"
          })
        }, i))
      }),
      inputs && inputs.length > 0 && /* @__PURE__ */ jsx_runtime15.jsx("div", {
        className: "tv-list",
        children: inputs.map((input, i) => {
          const path = isRecord(input) ? str(input.path) : null;
          const mime = isRecord(input) ? str(input.mime_type) : null;
          return /* @__PURE__ */ jsx_runtime15.jsx(Row, {
            k: i === 0 ? "input" : undefined,
            children: !isRecord(input) ? /* @__PURE__ */ jsx_runtime15.jsx(InvalidArg, {
              what: "input"
            }) : path ? /* @__PURE__ */ jsx_runtime15.jsx(PathText, {
              path
            }) : `base64 image${mime ? ` (${mime})` : ""}`
          }, i);
        })
      }),
      (provider || model) && /* @__PURE__ */ jsx_runtime15.jsx(Badges, {
        items: [provider, model]
      }),
      revised && /* @__PURE__ */ jsx_runtime15.jsxs(Note, {
        children: [
          "revised: ",
          truncate(revised, 400)
        ]
      }),
      /* @__PURE__ */ jsx_runtime15.jsx(ResultImages, {
        result: merged
      }),
      paths.length > 0 && /* @__PURE__ */ jsx_runtime15.jsx("div", {
        className: "tv-list",
        children: paths.map((p, i) => /* @__PURE__ */ jsx_runtime15.jsx(Row, {
          k: i === 0 ? "saved" : undefined,
          children: /* @__PURE__ */ jsx_runtime15.jsx(PathText, {
            path: p
          })
        }, i))
      }),
      !hasImages && /* @__PURE__ */ jsx_runtime15.jsx(ResultText, {
        result,
        maxLines: 8
      })
    ]
  });
}
var generateImageRenderer = { Summary: Summary11, Body: Body11 };

// src/components/transcript/tool-views/tools/github.tsx
var jsx_runtime16 = __toESM(require_jsx_runtime(), 1);
var SUCCESS_CONCLUSIONS = { success: true, neutral: true, skipped: true };
var FAILURE_CONCLUSIONS = {
  failure: true,
  timed_out: true,
  cancelled: true,
  action_required: true,
  startup_failure: true
};
var RUNNING_STATUSES = { in_progress: true };
function issueId(value) {
  const trimmed = value.trim();
  if (!trimmed)
    return null;
  if (/^\d+$/.test(trimmed))
    return `#${trimmed}`;
  const match = trimmed.match(/\/(?:issues|pull)\/(\d+)/);
  if (match)
    return `#${match[1]}`;
  return truncate(trimmed, 40);
}
function formatPr(pr) {
  if (typeof pr === "string")
    return issueId(pr);
  if (!Array.isArray(pr))
    return null;
  const parts = [];
  for (const item of pr) {
    if (typeof item !== "string")
      continue;
    const id = issueId(item);
    if (id)
      parts.push(id);
  }
  if (parts.length === 0)
    return null;
  if (parts.length > 3)
    return `${parts.slice(0, 3).join(", ")}, +${parts.length - 3} more`;
  return parts.join(", ");
}
function shortSha(sha) {
  return /^[0-9a-f]{12,}$/i.test(sha) ? sha.slice(0, 7) : sha;
}
function Salient({ args }) {
  const op = str(args.op) ?? "";
  const repo = str(args.repo);
  if (op.startsWith("search_")) {
    const query = str(args.query);
    return /* @__PURE__ */ jsx_runtime16.jsxs(jsx_runtime16.Fragment, {
      children: [
        query && /* @__PURE__ */ jsx_runtime16.jsx("span", {
          className: "tv-pattern",
          children: truncate(normalizeWs(query), 60)
        }),
        repo && /* @__PURE__ */ jsx_runtime16.jsx("span", {
          className: "tv-muted",
          children: repo
        })
      ]
    });
  }
  if (op === "pr_checkout" || op === "pr_push") {
    const target = formatPr(args.pr) ?? str(args.branch);
    return /* @__PURE__ */ jsx_runtime16.jsxs(jsx_runtime16.Fragment, {
      children: [
        target && /* @__PURE__ */ jsx_runtime16.jsx("span", {
          children: target
        }),
        repo && /* @__PURE__ */ jsx_runtime16.jsx("span", {
          className: "tv-muted",
          children: repo
        })
      ]
    });
  }
  if (op === "pr_create") {
    const title = str(args.title);
    if (title)
      return /* @__PURE__ */ jsx_runtime16.jsx("span", {
        children: truncate(normalizeWs(title), 60)
      });
    return args.fill === true ? /* @__PURE__ */ jsx_runtime16.jsx("span", {
      className: "tv-muted",
      children: "fill from commits"
    }) : null;
  }
  if (op === "run_watch") {
    const run = str(args.run);
    const branch3 = str(args.branch);
    if (run)
      return /* @__PURE__ */ jsx_runtime16.jsxs("span", {
        children: [
          "run ",
          truncate(run, 50)
        ]
      });
    return /* @__PURE__ */ jsx_runtime16.jsxs("span", {
      className: "tv-muted",
      children: [
        branch3 ?? "HEAD",
        " workflow runs"
      ]
    });
  }
  const branch2 = str(args.branch);
  return /* @__PURE__ */ jsx_runtime16.jsxs(jsx_runtime16.Fragment, {
    children: [
      repo && /* @__PURE__ */ jsx_runtime16.jsx("span", {
        children: repo
      }),
      branch2 && /* @__PURE__ */ jsx_runtime16.jsx("span", {
        className: "tv-muted",
        children: branch2
      })
    ]
  });
}
function Summary12(props) {
  const op = str(props.args.op);
  return /* @__PURE__ */ jsx_runtime16.jsxs(jsx_runtime16.Fragment, {
    children: [
      op ? /* @__PURE__ */ jsx_runtime16.jsx(Badge, {
        tone: "accent",
        children: op
      }) : /* @__PURE__ */ jsx_runtime16.jsx(Badge, {
        tone: "warn",
        children: "no op"
      }),
      " ",
      /* @__PURE__ */ jsx_runtime16.jsx(Salient, {
        args: props.args
      })
    ]
  });
}
function argValue(value) {
  if (typeof value === "string")
    return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (Array.isArray(value)) {
    const parts = [];
    for (const item of value) {
      if (typeof item === "string" || typeof item === "number")
        parts.push(String(item));
    }
    return parts.join(", ");
  }
  return /* @__PURE__ */ jsx_runtime16.jsx(InvalidArg, {});
}
function ArgsGrid({ args }) {
  const rows = [];
  for (const key in args) {
    if (key === "op" || key === "body")
      continue;
    const value = args[key];
    if (value === undefined || value === null)
      continue;
    rows.push(/* @__PURE__ */ jsx_runtime16.jsx(Kv, {
      k: key,
      children: argValue(value)
    }, key));
  }
  return rows.length > 0 ? /* @__PURE__ */ jsx_runtime16.jsx(KvGrid, {
    children: rows
  }) : null;
}
function jobVisual(job) {
  const conclusion = str(job.conclusion);
  const status = str(job.status);
  if (conclusion && SUCCESS_CONCLUSIONS[conclusion])
    return { icon: "✓", cls: "tv-ok-text" };
  if (conclusion && FAILURE_CONCLUSIONS[conclusion])
    return { icon: "✕", cls: "tv-err-text" };
  if (status && RUNNING_STATUSES[status])
    return { icon: "●", cls: "tv-warn-text" };
  return { icon: "○", cls: "tv-faint" };
}
function RunBlock({ run }) {
  const label = str(run.workflowName) ?? str(run.displayTitle) ?? "GitHub Actions";
  const meta = [];
  const branch2 = str(run.branch);
  const sha = str(run.headSha);
  if (branch2)
    meta.push(branch2);
  else if (sha)
    meta.push(shortSha(sha));
  const id = num(run.id);
  if (id !== null)
    meta.push(`#${id}`);
  const conclusion = str(run.conclusion);
  const status = str(run.status);
  const tone = conclusion && SUCCESS_CONCLUSIONS[conclusion] ? "ok" : conclusion && FAILURE_CONCLUSIONS[conclusion] ? "err" : status && RUNNING_STATUSES[status] ? "warn" : undefined;
  const jobs = Array.isArray(run.jobs) ? run.jobs : [];
  return /* @__PURE__ */ jsx_runtime16.jsxs("div", {
    className: "tv-list",
    children: [
      /* @__PURE__ */ jsx_runtime16.jsxs(Row, {
        children: [
          /* @__PURE__ */ jsx_runtime16.jsx("span", {
            children: label
          }),
          " ",
          /* @__PURE__ */ jsx_runtime16.jsx("span", {
            className: "tv-muted",
            children: meta.join("  ")
          }),
          " ",
          (conclusion || status) && /* @__PURE__ */ jsx_runtime16.jsx(Badge, {
            tone,
            children: conclusion ?? status
          })
        ]
      }),
      jobs.length === 0 && /* @__PURE__ */ jsx_runtime16.jsx(Row, {
        children: /* @__PURE__ */ jsx_runtime16.jsx("span", {
          className: "tv-faint",
          children: "waiting for workflow jobs…"
        })
      }),
      jobs.map((job, index2) => {
        if (!isRecord(job))
          return null;
        const visual = jobVisual(job);
        const duration = num(job.durationSeconds);
        return /* @__PURE__ */ jsx_runtime16.jsxs(Row, {
          children: [
            /* @__PURE__ */ jsx_runtime16.jsx("span", {
              className: visual.cls,
              children: visual.icon
            }),
            " ",
            /* @__PURE__ */ jsx_runtime16.jsx("span", {
              children: str(job.name) ?? "job"
            }),
            duration !== null && /* @__PURE__ */ jsx_runtime16.jsxs("span", {
              className: "tv-faint",
              children: [
                " ",
                duration,
                "s"
              ]
            })
          ]
        }, num(job.id) ?? index2);
      })
    ]
  });
}
function WatchView({ watch }) {
  const repo = str(watch.repo) ?? "";
  const watching = str(watch.state) === "watching";
  const run = isRecord(watch.run) ? watch.run : null;
  const runId = run ? num(run.id) : null;
  let header;
  if (str(watch.mode) === "run" && runId !== null) {
    header = `${watching ? "watching " : ""}run #${runId} on ${repo}`;
  } else {
    const sha = str(watch.headSha);
    const target = sha ? shortSha(sha) : "this commit";
    header = watching ? `watching ${target} on ${repo}` : `workflow runs for ${target} on ${repo}`;
  }
  const note = str(watch.note);
  const runs = [];
  if (run)
    runs.push(run);
  else if (Array.isArray(watch.runs)) {
    for (const item of watch.runs) {
      if (isRecord(item))
        runs.push(item);
    }
  }
  const failedLogs = Array.isArray(watch.failedLogs) ? watch.failedLogs : [];
  return /* @__PURE__ */ jsx_runtime16.jsxs(jsx_runtime16.Fragment, {
    children: [
      /* @__PURE__ */ jsx_runtime16.jsx("div", {
        className: "tv-muted",
        children: header
      }),
      note && /* @__PURE__ */ jsx_runtime16.jsx("div", {
        className: "tv-faint",
        children: note
      }),
      runs.length === 0 && /* @__PURE__ */ jsx_runtime16.jsx("div", {
        className: "tv-faint",
        children: "waiting for workflow runs…"
      }),
      runs.map((item, index2) => /* @__PURE__ */ jsx_runtime16.jsx(RunBlock, {
        run: item
      }, num(item.id) ?? index2)),
      failedLogs.map((entry, index2) => {
        if (!isRecord(entry))
          return null;
        const jobName = str(entry.jobName) ?? "job";
        const workflow = str(entry.workflowName);
        const failedRunId = num(entry.runId);
        const context = workflow ?? "run";
        const title = `${jobName} — ${context}${failedRunId !== null ? ` #${failedRunId}` : ""}`;
        const tail = str(entry.tail);
        if (!tail || entry.available === false) {
          return /* @__PURE__ */ jsx_runtime16.jsxs(Note, {
            tone: "warn",
            children: [
              title,
              ": log tail unavailable"
            ]
          }, index2);
        }
        return /* @__PURE__ */ jsx_runtime16.jsx(Output, {
          text: tail,
          maxLines: 12,
          error: true,
          title
        }, index2);
      })
    ]
  });
}
function CheckoutRows({ checkouts }) {
  return /* @__PURE__ */ jsx_runtime16.jsx("div", {
    className: "tv-list",
    children: checkouts.map((entry, index2) => {
      if (!isRecord(entry))
        return null;
      const prNumber = num(entry.prNumber);
      const worktree = str(entry.worktreePath);
      return /* @__PURE__ */ jsx_runtime16.jsxs(Row, {
        k: prNumber !== null ? `#${prNumber}` : "PR",
        children: [
          /* @__PURE__ */ jsx_runtime16.jsx("span", {
            children: str(entry.branch) ?? ""
          }),
          worktree && /* @__PURE__ */ jsx_runtime16.jsxs("span", {
            className: "tv-muted",
            children: [
              " ",
              shortenPath(worktree)
            ]
          }),
          entry.reused === true && /* @__PURE__ */ jsx_runtime16.jsx(Badge, {
            children: "reused"
          })
        ]
      }, prNumber ?? index2);
    })
  });
}
var DETAIL_KEYS = [
  "repo",
  "branch",
  "worktreePath",
  "remote",
  "remoteBranch",
  "headSha",
  "runId",
  "status",
  "conclusion"
];
function DetailsGrid({ details }) {
  const rows = [];
  for (const key of DETAIL_KEYS) {
    const value = details[key];
    if (typeof value === "number") {
      rows.push(/* @__PURE__ */ jsx_runtime16.jsx(Kv, {
        k: key,
        children: String(value)
      }, key));
    } else if (typeof value === "string" && value) {
      const text = key === "worktreePath" ? shortenPath(value) : key === "headSha" ? shortSha(value) : value;
      rows.push(/* @__PURE__ */ jsx_runtime16.jsx(Kv, {
        k: key,
        children: text
      }, key));
    }
  }
  if (Array.isArray(details.runIds)) {
    const ids = [];
    for (const id of details.runIds) {
      if (typeof id === "number")
        ids.push(`#${id}`);
    }
    if (ids.length > 0) {
      rows.push(/* @__PURE__ */ jsx_runtime16.jsx(Kv, {
        k: "runs",
        children: ids.join(", ")
      }, "runs"));
    }
  }
  if (Array.isArray(details.failedJobs)) {
    const jobs = [];
    for (const job of details.failedJobs) {
      if (typeof job === "string")
        jobs.push(job);
    }
    if (jobs.length > 0) {
      rows.push(/* @__PURE__ */ jsx_runtime16.jsx(Kv, {
        k: "failedJobs",
        children: /* @__PURE__ */ jsx_runtime16.jsx("span", {
          className: "tv-err-text",
          children: jobs.join(", ")
        })
      }, "failedJobs"));
    }
  }
  return rows.length > 0 ? /* @__PURE__ */ jsx_runtime16.jsx(KvGrid, {
    children: rows
  }) : null;
}
function Body12({ args, result }) {
  const details = detailsRecord(result);
  const watch = details && isRecord(details.watch) ? details.watch : null;
  const checkouts = details && Array.isArray(details.checkouts) ? details.checkouts : null;
  const bodyText = str(args.body);
  return /* @__PURE__ */ jsx_runtime16.jsxs(jsx_runtime16.Fragment, {
    children: [
      /* @__PURE__ */ jsx_runtime16.jsx(ArgsGrid, {
        args
      }),
      bodyText && /* @__PURE__ */ jsx_runtime16.jsx(Output, {
        text: bodyText,
        maxLines: 8,
        title: "body"
      }),
      watch && /* @__PURE__ */ jsx_runtime16.jsx(WatchView, {
        watch
      }),
      checkouts && checkouts.length > 0 && /* @__PURE__ */ jsx_runtime16.jsx(CheckoutRows, {
        checkouts
      }),
      details && !watch && /* @__PURE__ */ jsx_runtime16.jsx(DetailsGrid, {
        details
      }),
      /* @__PURE__ */ jsx_runtime16.jsx(ResultText, {
        result,
        maxLines: 12,
        lang: "markdown"
      })
    ]
  });
}
var githubRenderer = { Summary: Summary12, Body: Body12 };

// src/components/transcript/tool-views/tools/glob.tsx
var jsx_runtime17 = __toESM(require_jsx_runtime(), 1);
function Summary13({ args }) {
  const raw = args.path ?? args.paths;
  if (raw !== undefined && typeof raw !== "string" && !Array.isArray(raw))
    return /* @__PURE__ */ jsx_runtime17.jsx(InvalidArg, {
      what: "path"
    });
  const globs = scopePaths(args).map(shortenPath).join(", ");
  return /* @__PURE__ */ jsx_runtime17.jsx("span", {
    className: "tv-pattern",
    children: truncate(globs || "*", 120)
  });
}
function Body13({ args, result }) {
  const details = detailsRecord(result);
  const limit = num(args.limit);
  const timeout = num(args.timeout);
  const fileCount = num(details?.fileCount);
  const resultLimit = num(details?.resultLimitReached);
  const scopePath = str(details?.scopePath);
  const error = str(details?.error);
  const meta = details && isRecord(details.meta) ? details.meta : null;
  const limits = meta && isRecord(meta.limits) ? meta.limits : null;
  const truncated = Boolean(details?.truncated) || resultLimit !== null || details !== null && isRecord(details.truncation) || meta !== null && isRecord(meta.truncation) || Boolean(limits?.resultLimit);
  const missing = Array.isArray(details?.missingPaths) ? details.missingPaths.filter((p) => typeof p === "string") : [];
  return /* @__PURE__ */ jsx_runtime17.jsxs(jsx_runtime17.Fragment, {
    children: [
      /* @__PURE__ */ jsx_runtime17.jsx(Badges, {
        items: [
          limit !== null && /* @__PURE__ */ jsx_runtime17.jsxs(Badge, {
            children: [
              "limit ",
              limit
            ]
          }),
          args.gitignore === false && /* @__PURE__ */ jsx_runtime17.jsx(Badge, {
            children: "no-gitignore"
          }),
          args.hidden === false && /* @__PURE__ */ jsx_runtime17.jsx(Badge, {
            children: "no-hidden"
          }),
          timeout !== null && /* @__PURE__ */ jsx_runtime17.jsxs(Badge, {
            children: [
              "timeout ",
              timeout,
              "s"
            ]
          }),
          fileCount !== null && /* @__PURE__ */ jsx_runtime17.jsxs(Badge, {
            tone: "accent",
            children: [
              fileCount,
              " file",
              fileCount === 1 ? "" : "s"
            ]
          }),
          scopePath !== null && /* @__PURE__ */ jsx_runtime17.jsxs(Badge, {
            children: [
              "in ",
              shortenPath(scopePath)
            ]
          }),
          truncated && /* @__PURE__ */ jsx_runtime17.jsx(Badge, {
            tone: "warn",
            children: resultLimit !== null ? `truncated at ${resultLimit}` : "truncated"
          })
        ]
      }),
      missing.length > 0 && /* @__PURE__ */ jsx_runtime17.jsxs(Note, {
        tone: "warn",
        children: [
          "skipped missing: ",
          missing.map(shortenPath).join(", ")
        ]
      }),
      error !== null && !result?.isError && /* @__PURE__ */ jsx_runtime17.jsx(Note, {
        tone: "err",
        children: error
      }),
      /* @__PURE__ */ jsx_runtime17.jsx(ResultText, {
        result,
        maxLines: 12
      })
    ]
  });
}
var globRenderer = { Summary: Summary13, Body: Body13 };

// src/components/transcript/tool-views/tools/goal.tsx
var jsx_runtime18 = __toESM(require_jsx_runtime(), 1);
function goalOf(details) {
  const g = details?.goal;
  if (!isRecord(g))
    return null;
  const objective = str(g.objective);
  const status = str(g.status);
  if (objective === null || status === null)
    return null;
  return {
    objective,
    status,
    tokenBudget: num(g.tokenBudget),
    tokensUsed: num(g.tokensUsed),
    timeUsedSeconds: num(g.timeUsedSeconds)
  };
}
function describeOp(op) {
  switch (op) {
    case "create":
      return "set";
    case "get":
      return "check";
    default:
      return op ?? "?";
  }
}
function statusTone(status) {
  switch (status) {
    case "complete":
      return "ok";
    case "budget-limited":
      return "warn";
    case "paused":
    case "dropped":
      return;
    default:
      return "accent";
  }
}
function fmtNum(n) {
  if (n < 1000)
    return `${n}`;
  const scaled = (v) => {
    const s = v < 10 ? v.toFixed(1) : `${Math.round(v)}`;
    return s.endsWith(".0") ? s.slice(0, -2) : s;
  };
  if (n < 1e6)
    return `${scaled(n / 1000)}K`;
  if (n < 1e9)
    return `${scaled(n / 1e6)}M`;
  return `${scaled(n / 1e9)}B`;
}
function fmtDuration2(seconds) {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60)
    return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60)
    return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 48)
    return `${h}h`;
  return `${Math.round(h / 24)}d`;
}
function tokensLine(goal) {
  const used = fmtNum(goal.tokensUsed ?? 0);
  if (goal.tokenBudget === null)
    return `${used} tokens`;
  const left = Math.max(0, goal.tokenBudget - (goal.tokensUsed ?? 0));
  return `${used} / ${fmtNum(goal.tokenBudget)} tokens (${fmtNum(left)} left)`;
}
function Summary14({ args, result }) {
  const details = detailsRecord(result);
  const goal = goalOf(details);
  const op = str(details?.op) ?? str(args.op);
  const objective = goal?.objective ?? str(args.objective);
  const budget = num(args.token_budget);
  return /* @__PURE__ */ jsx_runtime18.jsxs(jsx_runtime18.Fragment, {
    children: [
      op === null && args.op !== undefined ? /* @__PURE__ */ jsx_runtime18.jsx(InvalidArg, {
        what: "op"
      }) : /* @__PURE__ */ jsx_runtime18.jsx("span", {
        children: describeOp(op)
      }),
      goal && /* @__PURE__ */ jsx_runtime18.jsx(Badge, {
        tone: statusTone(goal.status),
        children: goal.status
      }),
      objective !== null && objective.trim() !== "" && /* @__PURE__ */ jsx_runtime18.jsxs("span", {
        className: "tv-muted",
        children: [
          "“",
          truncate(normalizeWs(objective), 64),
          "”"
        ]
      }),
      budget !== null && /* @__PURE__ */ jsx_runtime18.jsxs("span", {
        className: "tv-faint",
        children: [
          "budget ",
          fmtNum(budget)
        ]
      })
    ]
  });
}
function Body14({ args, result }) {
  const details = detailsRecord(result);
  const goal = goalOf(details);
  const op = str(details?.op) ?? str(args.op);
  const objective = goal?.objective ?? str(args.objective);
  const budgetArg = num(args.token_budget);
  const report = str(details?.completionBudgetReport);
  const hasTokens = goal !== null && (goal.tokensUsed !== null || goal.tokenBudget !== null);
  return /* @__PURE__ */ jsx_runtime18.jsxs(jsx_runtime18.Fragment, {
    children: [
      /* @__PURE__ */ jsx_runtime18.jsxs(KvGrid, {
        children: [
          /* @__PURE__ */ jsx_runtime18.jsx(Kv, {
            k: "op",
            children: describeOp(op)
          }),
          goal && /* @__PURE__ */ jsx_runtime18.jsx(Kv, {
            k: "status",
            children: /* @__PURE__ */ jsx_runtime18.jsx(Badge, {
              tone: statusTone(goal.status),
              children: goal.status
            })
          }),
          objective !== null && objective.trim() !== "" && /* @__PURE__ */ jsx_runtime18.jsx(Kv, {
            k: "objective",
            children: objective.trim()
          }),
          hasTokens && goal ? /* @__PURE__ */ jsx_runtime18.jsx(Kv, {
            k: "tokens",
            children: tokensLine(goal)
          }) : budgetArg !== null && /* @__PURE__ */ jsx_runtime18.jsxs(Kv, {
            k: "budget",
            children: [
              fmtNum(budgetArg),
              " tokens"
            ]
          }),
          goal !== null && goal.timeUsedSeconds !== null && goal.timeUsedSeconds > 0 && /* @__PURE__ */ jsx_runtime18.jsx(Kv, {
            k: "elapsed",
            children: fmtDuration2(goal.timeUsedSeconds)
          })
        ]
      }),
      details !== null && goal === null && !result?.isError && /* @__PURE__ */ jsx_runtime18.jsx(Note, {
        tone: "warn",
        children: "no active goal"
      }),
      report !== null && report !== "" && /* @__PURE__ */ jsx_runtime18.jsx(Output, {
        text: report,
        title: "Report",
        maxLines: 12
      }),
      (goal === null || result?.isError) && /* @__PURE__ */ jsx_runtime18.jsx(ResultText, {
        result,
        maxLines: 10
      })
    ]
  });
}
var goalRenderer = { Summary: Summary14, Body: Body14 };

// src/components/transcript/tool-views/tools/grep.tsx
var jsx_runtime19 = __toESM(require_jsx_runtime(), 1);
function pathsOf2(args) {
  const list = scopePaths(args).map(shortenPath);
  return list.length ? list : ["."];
}
function argBadges(args) {
  const badges = [];
  const glob = str(args.glob);
  if (glob)
    badges.push(`glob=${glob}`);
  const type = str(args.type);
  if (type)
    badges.push(`type=${type}`);
  if (args.i === true)
    badges.push("i");
  if (args.multiline === true)
    badges.push("multiline");
  if (args.gitignore === false)
    badges.push("no-gitignore");
  const skip = num(args.skip);
  if (skip !== null && skip > 0)
    badges.push(`skip=${skip}`);
  return badges;
}
function Pattern({ args }) {
  const pattern = str(args.pattern);
  if (pattern === null)
    return /* @__PURE__ */ jsx_runtime19.jsx(InvalidArg, {
      what: "pattern"
    });
  return /* @__PURE__ */ jsx_runtime19.jsxs("span", {
    className: "tv-pattern",
    children: [
      "/",
      pattern,
      "/"
    ]
  });
}
function Summary15({ args }) {
  return /* @__PURE__ */ jsx_runtime19.jsxs("span", {
    children: [
      /* @__PURE__ */ jsx_runtime19.jsx(Pattern, {
        args
      }),
      " ",
      /* @__PURE__ */ jsx_runtime19.jsx("span", {
        className: "tv-muted",
        children: "in"
      }),
      " ",
      /* @__PURE__ */ jsx_runtime19.jsx("span", {
        className: "tv-path",
        children: pathsOf2(args).join(", ")
      }),
      " ",
      /* @__PURE__ */ jsx_runtime19.jsx(Badges, {
        items: argBadges(args)
      })
    ]
  });
}
function Body15({ args, result }) {
  const details = detailsRecord(result);
  const matchCount = num(details?.matchCount);
  const fileCount = num(details?.fileCount);
  const truncated = details?.truncated === true;
  const error = str(details?.error);
  const missing = [];
  if (details && Array.isArray(details.missingPaths)) {
    for (const p of details.missingPaths) {
      if (typeof p === "string")
        missing.push(shortenPath(p));
    }
  }
  const badges = argBadges(args);
  if (matchCount !== null)
    badges.push(`${matchCount} ${matchCount === 1 ? "match" : "matches"}`);
  if (fileCount !== null)
    badges.push(`${fileCount} ${fileCount === 1 ? "file" : "files"}`);
  return /* @__PURE__ */ jsx_runtime19.jsxs(jsx_runtime19.Fragment, {
    children: [
      /* @__PURE__ */ jsx_runtime19.jsxs("div", {
        children: [
          /* @__PURE__ */ jsx_runtime19.jsx(Pattern, {
            args
          }),
          " ",
          /* @__PURE__ */ jsx_runtime19.jsx("span", {
            className: "tv-muted",
            children: "in"
          }),
          " ",
          /* @__PURE__ */ jsx_runtime19.jsx("span", {
            className: "tv-path",
            children: pathsOf2(args).join(", ")
          }),
          " ",
          /* @__PURE__ */ jsx_runtime19.jsx(Badges, {
            items: badges
          }),
          truncated && /* @__PURE__ */ jsx_runtime19.jsxs(jsx_runtime19.Fragment, {
            children: [
              " ",
              /* @__PURE__ */ jsx_runtime19.jsx(Badge, {
                tone: "warn",
                children: "truncated"
              })
            ]
          })
        ]
      }),
      missing.length > 0 && /* @__PURE__ */ jsx_runtime19.jsxs(Note, {
        tone: "warn",
        children: [
          "skipped missing: ",
          missing.join(", ")
        ]
      }),
      error !== null && !resultTextOf(result).trim() && /* @__PURE__ */ jsx_runtime19.jsx(Note, {
        tone: "err",
        children: error
      }),
      /* @__PURE__ */ jsx_runtime19.jsx(ResultText, {
        result,
        maxLines: 14,
        variant: "code"
      })
    ]
  });
}
var grepRenderer = { Summary: Summary15, Body: Body15 };

// src/components/transcript/tool-views/tools/irc.tsx
var jsx_runtime20 = __toESM(require_jsx_runtime(), 1);
function parseReceipts(value) {
  if (!Array.isArray(value))
    return [];
  const out = [];
  for (const item of value) {
    if (!isRecord(item))
      continue;
    const to = str(item.to);
    const outcome = str(item.outcome);
    if (to === null || outcome === null)
      continue;
    out.push({ to, outcome, error: str(item.error) ?? undefined });
  }
  return out;
}
function parseMsg(value) {
  if (!isRecord(value))
    return null;
  const from = str(value.from);
  const body = str(value.body);
  if (from === null || body === null)
    return null;
  return { from, body, replyTo: str(value.replyTo) ?? undefined };
}
function parseInbox(value) {
  if (!Array.isArray(value))
    return [];
  const out = [];
  for (const item of value) {
    const msg = parseMsg(item);
    if (msg)
      out.push(msg);
  }
  return out;
}
var PEER_STATUS_ORDER = { running: 0, idle: 1, parked: 2 };
function parsePeers(value) {
  if (!Array.isArray(value))
    return [];
  const out = [];
  for (const item of value) {
    if (!isRecord(item))
      continue;
    const id = str(item.id);
    if (id === null)
      continue;
    out.push({
      id,
      kind: str(item.kind) ?? "?",
      status: str(item.status) ?? "?",
      parentId: str(item.parentId) ?? undefined,
      unread: typeof item.unread === "number" && Number.isFinite(item.unread) ? item.unread : 0
    });
  }
  return out.sort((a, b) => (PEER_STATUS_ORDER[a.status] ?? 9) - (PEER_STATUS_ORDER[b.status] ?? 9));
}
function outcomeTone(outcome) {
  switch (outcome) {
    case "woken":
      return "ok";
    case "revived":
      return "warn";
    case "injected":
      return "accent";
    case "failed":
      return "err";
    default:
      return;
  }
}
function statusTone2(status) {
  switch (status) {
    case "running":
      return "accent";
    case "idle":
      return "ok";
    case "parked":
      return;
    default:
      return "err";
  }
}
function Summary16({ args, result }) {
  const op = str(args.op) ?? "?";
  const d = detailsRecord(result);
  const opBadge = /* @__PURE__ */ jsx_runtime20.jsx(Badge, {
    tone: result?.isError ? "err" : op === "send" ? "accent" : undefined,
    children: op
  });
  if (op === "send") {
    const to = str(args.to);
    const message = str(args.message);
    return /* @__PURE__ */ jsx_runtime20.jsxs(jsx_runtime20.Fragment, {
      children: [
        opBadge,
        " ",
        to && /* @__PURE__ */ jsx_runtime20.jsxs("span", {
          className: "tv-pattern",
          children: [
            "→ ",
            to
          ]
        }),
        " ",
        message && /* @__PURE__ */ jsx_runtime20.jsx("span", {
          className: "tv-muted",
          children: truncate(normalizeWs(message), 80)
        })
      ]
    });
  }
  if (op === "wait") {
    const waited = d ? parseMsg(d.waited) : null;
    if (waited) {
      return /* @__PURE__ */ jsx_runtime20.jsxs(jsx_runtime20.Fragment, {
        children: [
          opBadge,
          " ",
          /* @__PURE__ */ jsx_runtime20.jsxs("span", {
            className: "tv-pattern",
            children: [
              "← ",
              waited.from
            ]
          }),
          " ",
          /* @__PURE__ */ jsx_runtime20.jsx("span", {
            className: "tv-muted",
            children: truncate(normalizeWs(waited.body), 80)
          })
        ]
      });
    }
    const from = str(args.from);
    return /* @__PURE__ */ jsx_runtime20.jsxs(jsx_runtime20.Fragment, {
      children: [
        opBadge,
        " ",
        /* @__PURE__ */ jsx_runtime20.jsxs("span", {
          className: "tv-pattern",
          children: [
            "← ",
            from ?? "anyone"
          ]
        }),
        d?.waited === null && /* @__PURE__ */ jsx_runtime20.jsxs(jsx_runtime20.Fragment, {
          children: [
            " ",
            /* @__PURE__ */ jsx_runtime20.jsx(Badge, {
              tone: "warn",
              children: "timed out"
            })
          ]
        })
      ]
    });
  }
  if (op === "inbox") {
    const inbox = d ? parseInbox(d.inbox) : [];
    return /* @__PURE__ */ jsx_runtime20.jsxs(jsx_runtime20.Fragment, {
      children: [
        opBadge,
        " ",
        args.peek === true && /* @__PURE__ */ jsx_runtime20.jsx(Badge, {
          children: "peek"
        }),
        " ",
        d && /* @__PURE__ */ jsx_runtime20.jsx("span", {
          className: "tv-muted",
          children: inbox.length === 0 ? "empty" : `${inbox.length} ${inbox.length === 1 ? "message" : "messages"}`
        })
      ]
    });
  }
  if (op === "list") {
    const peers = d ? parsePeers(d.peers) : [];
    let unread = 0;
    for (const peer of peers)
      unread += peer.unread;
    return /* @__PURE__ */ jsx_runtime20.jsxs(jsx_runtime20.Fragment, {
      children: [
        opBadge,
        " ",
        d && /* @__PURE__ */ jsx_runtime20.jsx("span", {
          className: "tv-muted",
          children: peers.length === 1 ? "1 peer" : `${peers.length} peers`
        }),
        unread > 0 && /* @__PURE__ */ jsx_runtime20.jsxs(jsx_runtime20.Fragment, {
          children: [
            " ",
            /* @__PURE__ */ jsx_runtime20.jsxs(Badge, {
              tone: "warn",
              children: [
                unread,
                " unread"
              ]
            })
          ]
        })
      ]
    });
  }
  return opBadge;
}
function Body16({ args, result }) {
  const op = str(args.op);
  const to = str(args.to);
  const from = str(args.from);
  const message = str(args.message);
  const d = detailsRecord(result);
  const receipts = parseReceipts(d?.receipts);
  const waited = d ? parseMsg(d.waited) : null;
  const timedOut = d ? d.waited === null : false;
  const inbox = parseInbox(d?.inbox);
  const peers = parsePeers(d?.peers);
  const structured = receipts.length > 0 || waited !== null || timedOut || inbox.length > 0 || peers.length > 0;
  return /* @__PURE__ */ jsx_runtime20.jsxs(jsx_runtime20.Fragment, {
    children: [
      /* @__PURE__ */ jsx_runtime20.jsx(Badges, {
        items: [
          op ?? "?",
          to && `to ${to}`,
          op === "wait" && from && `from ${from}`,
          to === "all" && "broadcast",
          args.await === true && "await reply",
          str(args.replyTo) && "reply",
          args.peek === true && "peek"
        ]
      }),
      message && /* @__PURE__ */ jsx_runtime20.jsx(Note, {
        children: message
      }),
      receipts.length > 0 && /* @__PURE__ */ jsx_runtime20.jsx("div", {
        className: "tv-list",
        children: receipts.map((receipt, i) => /* @__PURE__ */ jsx_runtime20.jsxs(Row, {
          k: receipt.to,
          children: [
            /* @__PURE__ */ jsx_runtime20.jsx(Badge, {
              tone: outcomeTone(receipt.outcome),
              children: receipt.outcome
            }),
            receipt.error && /* @__PURE__ */ jsx_runtime20.jsxs("span", {
              className: "tv-err-text",
              children: [
                " — ",
                receipt.error
              ]
            })
          ]
        }, i))
      }),
      waited && /* @__PURE__ */ jsx_runtime20.jsx("div", {
        className: "tv-list",
        children: /* @__PURE__ */ jsx_runtime20.jsxs(Row, {
          k: `← ${waited.from}`,
          children: [
            waited.body,
            waited.replyTo && /* @__PURE__ */ jsx_runtime20.jsxs(jsx_runtime20.Fragment, {
              children: [
                " ",
                /* @__PURE__ */ jsx_runtime20.jsx(Badge, {
                  children: "reply"
                })
              ]
            })
          ]
        })
      }),
      timedOut && /* @__PURE__ */ jsx_runtime20.jsx(Note, {
        tone: "warn",
        children: "No reply yet — they may answer later; check inbox or wait again."
      }),
      inbox.length > 0 && /* @__PURE__ */ jsx_runtime20.jsx("div", {
        className: "tv-list",
        children: inbox.map((msg, i) => /* @__PURE__ */ jsx_runtime20.jsxs(Row, {
          k: msg.from,
          children: [
            msg.body,
            msg.replyTo && /* @__PURE__ */ jsx_runtime20.jsxs(jsx_runtime20.Fragment, {
              children: [
                " ",
                /* @__PURE__ */ jsx_runtime20.jsx(Badge, {
                  children: "reply"
                })
              ]
            })
          ]
        }, i))
      }),
      peers.length > 0 && /* @__PURE__ */ jsx_runtime20.jsx("div", {
        className: "tv-list",
        children: peers.map((peer) => /* @__PURE__ */ jsx_runtime20.jsxs(Row, {
          k: peer.id,
          children: [
            /* @__PURE__ */ jsx_runtime20.jsx(Badge, {
              tone: statusTone2(peer.status),
              children: peer.status
            }),
            " ",
            /* @__PURE__ */ jsx_runtime20.jsx("span", {
              className: "tv-faint",
              children: peer.parentId ? `${peer.kind} · of ${peer.parentId}` : peer.kind
            }),
            peer.unread > 0 && /* @__PURE__ */ jsx_runtime20.jsxs(jsx_runtime20.Fragment, {
              children: [
                " ",
                /* @__PURE__ */ jsx_runtime20.jsxs(Badge, {
                  tone: "warn",
                  children: [
                    peer.unread,
                    " unread"
                  ]
                })
              ]
            })
          ]
        }, peer.id))
      }),
      (!structured || result?.isError) && /* @__PURE__ */ jsx_runtime20.jsx(ResultText, {
        result,
        maxLines: 8
      })
    ]
  });
}
var ircRenderer = { Summary: Summary16, Body: Body16 };

// src/components/transcript/tool-views/tools/job.tsx
var jsx_runtime21 = __toESM(require_jsx_runtime(), 1);
function idList(value) {
  if (!Array.isArray(value))
    return [];
  const out = [];
  for (const item of value) {
    const id = str(item);
    if (id)
      out.push(id);
  }
  return out;
}
function pollIds(args) {
  const poll = idList(args.poll);
  if (poll.length > 0)
    return poll;
  const jobs = idList(args.jobs);
  return jobs.length > 0 ? jobs : idList(args.jobIds);
}
function cancelIds(args) {
  const cancel = idList(args.cancel);
  if (cancel.length > 0)
    return cancel;
  const single = str(args.jobId);
  return single ? [single] : [];
}
function groupLabel(verb, ids) {
  return ids.length <= 2 ? `${verb} ${ids.join(", ")}` : `${verb} ${ids.length}`;
}
function jobOf(value) {
  if (!isRecord(value))
    return null;
  const id = str(value.id);
  if (!id)
    return null;
  return {
    id,
    type: str(value.type) ?? "",
    status: str(value.status) ?? "",
    label: str(value.label) ?? "",
    durationMs: num(value.durationMs) ?? 0,
    resultText: str(value.resultText) ?? "",
    errorText: str(value.errorText) ?? ""
  };
}
function jobsOf(details) {
  const raw = details?.jobs;
  if (!Array.isArray(raw))
    return [];
  const out = [];
  for (const item of raw) {
    const job = jobOf(item);
    if (job)
      out.push(job);
  }
  return out;
}
function cancelOutcomesOf(details) {
  const raw = details?.cancelled;
  if (!Array.isArray(raw))
    return [];
  const out = [];
  for (const item of raw) {
    if (!isRecord(item))
      continue;
    const id = str(item.id);
    if (id)
      out.push({ id, status: str(item.status) ?? "" });
  }
  return out;
}
function statusTone3(status) {
  switch (status) {
    case "completed":
      return "ok";
    case "failed":
      return "err";
    case "cancelled":
      return "warn";
    case "running":
      return "accent";
    default:
      return;
  }
}
var STATUS_ORDER = { running: 0, failed: 1, cancelled: 2, completed: 3 };
function formatDuration(ms) {
  if (ms < 1000)
    return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 60)
    return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.round(s % 60)}s`;
}
function stripTaskResultEnvelope(text) {
  if (!text.startsWith("<task-result"))
    return text;
  const body = /<(output|preview)(?:\s[^>]*)?>\n?([\s\S]*?)\n?<\/\1>/.exec(text)?.[2];
  return body?.trim() || text;
}
function JobRow({ job }) {
  const tone = statusTone3(job.status);
  const label = normalizeWs(job.label) || "(no label)";
  const showId = label !== job.id;
  const rawPreview = job.errorText.trim() || job.resultText.trim();
  const preview = rawPreview ? truncate(normalizeWs(stripTaskResultEnvelope(rawPreview)), 160) : "";
  return /* @__PURE__ */ jsx_runtime21.jsxs(Row, {
    k: /* @__PURE__ */ jsx_runtime21.jsx(Badge, {
      tone,
      children: job.status || "?"
    }),
    children: [
      job.type && /* @__PURE__ */ jsx_runtime21.jsx(Badge, {
        tone,
        children: job.type
      }),
      showId && /* @__PURE__ */ jsx_runtime21.jsxs("span", {
        className: "tv-path",
        children: [
          " ",
          job.id
        ]
      }),
      /* @__PURE__ */ jsx_runtime21.jsxs("span", {
        children: [
          " ",
          truncate(label, 80)
        ]
      }),
      job.durationMs > 0 && /* @__PURE__ */ jsx_runtime21.jsxs("span", {
        className: "tv-faint",
        children: [
          " ",
          formatDuration(job.durationMs)
        ]
      }),
      preview && /* @__PURE__ */ jsx_runtime21.jsxs("span", {
        className: job.errorText ? "tv-err-text" : "tv-faint",
        children: [
          " — ",
          preview
        ]
      })
    ]
  });
}
function Summary17({ args }) {
  const poll = pollIds(args);
  const cancel = cancelIds(args);
  const items = [];
  if (args.list === true) {
    items.push(/* @__PURE__ */ jsx_runtime21.jsx(Badge, {
      tone: "accent",
      children: "list"
    }, "list"));
  }
  if (cancel.length > 0) {
    items.push(/* @__PURE__ */ jsx_runtime21.jsx(Badge, {
      tone: "warn",
      children: groupLabel("cancel", cancel)
    }, "cancel"));
  }
  if (poll.length > 0) {
    items.push(/* @__PURE__ */ jsx_runtime21.jsx(Badge, {
      tone: "accent",
      children: groupLabel("poll", poll)
    }, "poll"));
  }
  if (items.length === 0)
    return /* @__PURE__ */ jsx_runtime21.jsx("span", {
      className: "tv-muted",
      children: "all running jobs"
    });
  return /* @__PURE__ */ jsx_runtime21.jsx(Badges, {
    items
  });
}
function Body17({ args, result }) {
  const poll = pollIds(args);
  const cancel = cancelIds(args);
  const details = detailsRecord(result);
  const jobs = jobsOf(details);
  const badOutcomes = cancelOutcomesOf(details).filter((o) => o.status !== "cancelled" && o.status !== "");
  let running = 0;
  let completed = 0;
  let failed = 0;
  let cancelledCount = 0;
  for (const job of jobs) {
    if (job.status === "running")
      running++;
    else if (job.status === "completed")
      completed++;
    else if (job.status === "failed")
      failed++;
    else if (job.status === "cancelled")
      cancelledCount++;
  }
  const sorted = [...jobs].sort((a, b) => {
    const diff = (STATUS_ORDER[a.status] ?? 4) - (STATUS_ORDER[b.status] ?? 4);
    return diff !== 0 ? diff : b.durationMs - a.durationMs;
  });
  return /* @__PURE__ */ jsx_runtime21.jsxs(jsx_runtime21.Fragment, {
    children: [
      (args.list === true || poll.length > 0 || cancel.length > 0) && /* @__PURE__ */ jsx_runtime21.jsxs("div", {
        className: "tv-list",
        children: [
          args.list === true && /* @__PURE__ */ jsx_runtime21.jsx(Row, {
            k: "list",
            children: "all jobs"
          }),
          poll.length > 0 && /* @__PURE__ */ jsx_runtime21.jsx(Row, {
            k: "poll",
            children: poll.join(", ")
          }),
          cancel.length > 0 && /* @__PURE__ */ jsx_runtime21.jsx(Row, {
            k: "cancel",
            children: cancel.join(", ")
          })
        ]
      }),
      jobs.length > 0 && /* @__PURE__ */ jsx_runtime21.jsxs(jsx_runtime21.Fragment, {
        children: [
          /* @__PURE__ */ jsx_runtime21.jsx(Badges, {
            items: [
              running > 0 && /* @__PURE__ */ jsx_runtime21.jsx(Badge, {
                tone: "accent",
                children: running === jobs.length ? `waiting on ${running}` : `waiting on ${running} of ${jobs.length}`
              }, "running"),
              completed > 0 && /* @__PURE__ */ jsx_runtime21.jsxs(Badge, {
                tone: "ok",
                children: [
                  completed,
                  " done"
                ]
              }, "done"),
              failed > 0 && /* @__PURE__ */ jsx_runtime21.jsxs(Badge, {
                tone: "err",
                children: [
                  failed,
                  " failed"
                ]
              }, "failed"),
              cancelledCount > 0 && /* @__PURE__ */ jsx_runtime21.jsxs(Badge, {
                tone: "warn",
                children: [
                  cancelledCount,
                  " cancelled"
                ]
              }, "cancelled")
            ]
          }),
          /* @__PURE__ */ jsx_runtime21.jsx("div", {
            className: "tv-list",
            children: sorted.map((job) => /* @__PURE__ */ jsx_runtime21.jsx(JobRow, {
              job
            }, job.id))
          })
        ]
      }),
      badOutcomes.length > 0 && /* @__PURE__ */ jsx_runtime21.jsx(Note, {
        tone: "warn",
        children: badOutcomes.map((o) => `${o.id}: ${o.status.replace(/_/g, " ")}`).join(" · ")
      }),
      /* @__PURE__ */ jsx_runtime21.jsx(ResultText, {
        result,
        maxLines: 10,
        title: jobs.length > 0 ? "snapshot" : undefined
      })
    ]
  });
}
var jobRenderer = { Summary: Summary17, Body: Body17 };

// src/components/transcript/tool-views/tools/hub.tsx
var jsx_runtime22 = __toESM(require_jsx_runtime(), 1);
var LAUNCH_OPS = new Set(["start", "ps", "logs", "stop", "restart", "describe"]);
function familyOf({ args, result }) {
  const details = detailsRecord(result);
  if (details) {
    if ("daemon" in details || "daemons" in details || "terminalRows" in details || "spec" in details || "state" in details || "cursor" in details) {
      return "launch";
    }
    if (Array.isArray(details.jobs) || Array.isArray(details.agents))
      return "jobs";
    if ("receipts" in details || "waited" in details || "inbox" in details || "peers" in details) {
      return "messaging";
    }
  }
  const op = typeof args.op === "string" ? args.op : "";
  if (LAUNCH_OPS.has(op))
    return "launch";
  const name = typeof args.name === "string" && args.name.length > 0;
  const to = typeof args.to === "string" && args.to.length > 0;
  const from = typeof args.from === "string" && args.from.length > 0;
  if ((op === "send" || op === "wait") && name && !to && !from)
    return "launch";
  if (op === "jobs" || op === "cancel")
    return "jobs";
  if (op === "wait" && !from)
    return "jobs";
  return "messaging";
}
function toJobProps(props) {
  const op = typeof props.args.op === "string" ? props.args.op : "";
  const args = op === "cancel" ? { cancel: props.args.ids } : op === "jobs" ? { list: true } : { poll: props.args.ids };
  return { ...props, args };
}
function Summary18(props) {
  switch (familyOf(props)) {
    case "launch":
      return /* @__PURE__ */ jsx_runtime22.jsx(genericRenderer.Summary, {
        ...props
      });
    case "jobs": {
      const jobProps = toJobProps(props);
      return /* @__PURE__ */ jsx_runtime22.jsx(jobRenderer.Summary, {
        ...jobProps
      });
    }
    default:
      return /* @__PURE__ */ jsx_runtime22.jsx(ircRenderer.Summary, {
        ...props
      });
  }
}
function Body18(props) {
  switch (familyOf(props)) {
    case "launch":
      return genericRenderer.Body ? /* @__PURE__ */ jsx_runtime22.jsx(genericRenderer.Body, {
        ...props
      }) : null;
    case "jobs": {
      const jobProps = toJobProps(props);
      return jobRenderer.Body ? /* @__PURE__ */ jsx_runtime22.jsx(jobRenderer.Body, {
        ...jobProps
      }) : null;
    }
    default:
      return ircRenderer.Body ? /* @__PURE__ */ jsx_runtime22.jsx(ircRenderer.Body, {
        ...props
      }) : null;
  }
}
var hubRenderer = { Summary: Summary18, Body: Body18 };

// src/components/transcript/tool-views/tools/lsp.tsx
var jsx_runtime23 = __toESM(require_jsx_runtime(), 1);
var DIAG_RE = /^(.*):(\d+):(\d+)\s+\[(\w+)\]\s*(.*)$/;
var LOC_RE = /^(.+):(\d+):(\d+)$/;
var LOCATION_ACTIONS = {
  definition: true,
  references: true,
  type_definition: true,
  implementation: true
};
var MAX_ROWS = 24;
function parseDiagnostics(text) {
  const rows = [];
  for (const raw of text.split(`
`)) {
    const m = raw.trim().match(DIAG_RE);
    if (m)
      rows.push({ file: m[1], line: m[2], col: m[3], severity: m[4].toLowerCase(), message: normalizeWs(m[5]) });
  }
  return rows;
}
function parseLocations(text) {
  const rows = [];
  for (const raw of text.split(`
`)) {
    const m = raw.trim().match(LOC_RE);
    if (m)
      rows.push({ file: m[1], line: m[2], col: m[3] });
  }
  return rows;
}
function severityTone(severity) {
  switch (severity) {
    case "error":
      return "err";
    case "warning":
      return "warn";
    case "info":
      return "accent";
    default:
      return;
  }
}
function ArgKv({ k, raw, val }) {
  if (raw === undefined)
    return null;
  return /* @__PURE__ */ jsx_runtime23.jsx(Kv, {
    k,
    children: val == null || val === false ? /* @__PURE__ */ jsx_runtime23.jsx(InvalidArg, {
      what: k
    }) : val
  });
}
function DiagnosticRows({ text, rows }) {
  const errMatch = text.match(/(\d+)\s+error\(s\)/);
  const warnMatch = text.match(/(\d+)\s+warning\(s\)/);
  const shown = rows.slice(0, MAX_ROWS);
  return /* @__PURE__ */ jsx_runtime23.jsxs(jsx_runtime23.Fragment, {
    children: [
      (errMatch || warnMatch) && /* @__PURE__ */ jsx_runtime23.jsxs("span", {
        className: "tv-badges",
        children: [
          errMatch && /* @__PURE__ */ jsx_runtime23.jsxs(Badge, {
            tone: "err",
            children: [
              errMatch[1],
              " error",
              errMatch[1] === "1" ? "" : "s"
            ]
          }),
          warnMatch && /* @__PURE__ */ jsx_runtime23.jsxs(Badge, {
            tone: "warn",
            children: [
              warnMatch[1],
              " warning",
              warnMatch[1] === "1" ? "" : "s"
            ]
          })
        ]
      }),
      /* @__PURE__ */ jsx_runtime23.jsxs("div", {
        className: "tv-list",
        children: [
          shown.map((d, i) => /* @__PURE__ */ jsx_runtime23.jsxs(Row, {
            k: /* @__PURE__ */ jsx_runtime23.jsx(Badge, {
              tone: severityTone(d.severity),
              children: d.severity
            }),
            children: [
              /* @__PURE__ */ jsx_runtime23.jsx(PathText, {
                path: d.file,
                sel: `${d.line}:${d.col}`
              }),
              d.message && /* @__PURE__ */ jsx_runtime23.jsxs("span", {
                className: "tv-muted",
                children: [
                  " ",
                  truncate(d.message, 160)
                ]
              })
            ]
          }, i)),
          rows.length > shown.length && /* @__PURE__ */ jsx_runtime23.jsx(Row, {
            children: /* @__PURE__ */ jsx_runtime23.jsxs("span", {
              className: "tv-faint",
              children: [
                "… ",
                rows.length - shown.length,
                " more"
              ]
            })
          })
        ]
      })
    ]
  });
}
function LocationRows({ text, rows }) {
  const refMatch = text.match(/(\d+)\s+reference\(s\)/);
  const shown = rows.slice(0, MAX_ROWS);
  return /* @__PURE__ */ jsx_runtime23.jsxs(jsx_runtime23.Fragment, {
    children: [
      refMatch && /* @__PURE__ */ jsx_runtime23.jsx("span", {
        className: "tv-badges",
        children: /* @__PURE__ */ jsx_runtime23.jsxs(Badge, {
          tone: "accent",
          children: [
            refMatch[1],
            " reference",
            refMatch[1] === "1" ? "" : "s"
          ]
        })
      }),
      /* @__PURE__ */ jsx_runtime23.jsxs("div", {
        className: "tv-list",
        children: [
          shown.map((l, i) => /* @__PURE__ */ jsx_runtime23.jsx(Row, {
            children: /* @__PURE__ */ jsx_runtime23.jsx(PathText, {
              path: l.file,
              sel: `${l.line}:${l.col}`
            })
          }, i)),
          rows.length > shown.length && /* @__PURE__ */ jsx_runtime23.jsx(Row, {
            children: /* @__PURE__ */ jsx_runtime23.jsxs("span", {
              className: "tv-faint",
              children: [
                "… ",
                rows.length - shown.length,
                " more"
              ]
            })
          })
        ]
      })
    ]
  });
}
function Summary19({ args }) {
  const action = str(args.action);
  const file = str(args.file);
  const line = num(args.line);
  const symbol = str(args.symbol);
  const query = str(args.query);
  const newName = str(args.new_name);
  return /* @__PURE__ */ jsx_runtime23.jsxs(jsx_runtime23.Fragment, {
    children: [
      /* @__PURE__ */ jsx_runtime23.jsx(Badge, {
        tone: "accent",
        children: action ? action.replace(/_/g, " ") : "request"
      }),
      file === "*" && /* @__PURE__ */ jsx_runtime23.jsx(Badge, {
        children: "workspace"
      }),
      file && file !== "*" && /* @__PURE__ */ jsx_runtime23.jsx(PathText, {
        path: file,
        from: line
      }),
      !file && line != null && /* @__PURE__ */ jsx_runtime23.jsxs("span", {
        className: "tv-faint",
        children: [
          "line ",
          line
        ]
      }),
      symbol && /* @__PURE__ */ jsx_runtime23.jsx("span", {
        className: "tv-pattern",
        children: truncate(normalizeWs(symbol), 48)
      }),
      query && /* @__PURE__ */ jsx_runtime23.jsx("span", {
        className: "tv-muted",
        children: truncate(normalizeWs(query), 48)
      }),
      newName && /* @__PURE__ */ jsx_runtime23.jsxs("span", {
        className: "tv-muted",
        children: [
          "→ ",
          truncate(normalizeWs(newName), 48)
        ]
      })
    ]
  });
}
function Body19({ args, result }) {
  const details = detailsRecord(result);
  const file = str(args.file);
  const line = num(args.line);
  const symbol = str(args.symbol);
  const query = str(args.query);
  const newName = str(args.new_name);
  const apply = typeof args.apply === "boolean" ? args.apply : null;
  const timeout = num(args.timeout);
  const payload = str(args.payload);
  const serverName = details ? str(details.serverName) : null;
  const action = str(args.action) ?? (details ? str(details.action) : null);
  const text = result && !result.isError ? resultTextOf(result) : "";
  const diags = text ? parseDiagnostics(text) : [];
  const locs = diags.length === 0 && text && (action != null && LOCATION_ACTIONS[action] || /\d+\s+reference\(s\)/.test(text)) ? parseLocations(text) : [];
  return /* @__PURE__ */ jsx_runtime23.jsxs(jsx_runtime23.Fragment, {
    children: [
      /* @__PURE__ */ jsx_runtime23.jsxs(KvGrid, {
        children: [
          /* @__PURE__ */ jsx_runtime23.jsx(ArgKv, {
            k: "action",
            raw: args.action,
            val: str(args.action)?.replace(/_/g, " ")
          }),
          /* @__PURE__ */ jsx_runtime23.jsx(ArgKv, {
            k: "file",
            raw: args.file,
            val: file === "*" ? /* @__PURE__ */ jsx_runtime23.jsx(Badge, {
              children: "workspace"
            }) : file && /* @__PURE__ */ jsx_runtime23.jsx(PathText, {
              path: file,
              from: line
            })
          }),
          !file && /* @__PURE__ */ jsx_runtime23.jsx(ArgKv, {
            k: "line",
            raw: args.line,
            val: line
          }),
          /* @__PURE__ */ jsx_runtime23.jsx(ArgKv, {
            k: "symbol",
            raw: args.symbol,
            val: symbol && truncate(normalizeWs(symbol), 120)
          }),
          /* @__PURE__ */ jsx_runtime23.jsx(ArgKv, {
            k: "query",
            raw: args.query,
            val: query && truncate(normalizeWs(query), 120)
          }),
          /* @__PURE__ */ jsx_runtime23.jsx(ArgKv, {
            k: "new name",
            raw: args.new_name,
            val: newName && truncate(normalizeWs(newName), 120)
          }),
          /* @__PURE__ */ jsx_runtime23.jsx(ArgKv, {
            k: "apply",
            raw: args.apply,
            val: apply == null ? null : apply ? "yes" : "no"
          }),
          /* @__PURE__ */ jsx_runtime23.jsx(ArgKv, {
            k: "timeout",
            raw: args.timeout,
            val: timeout != null && `${timeout}s`
          }),
          args.payload !== undefined && payload == null && /* @__PURE__ */ jsx_runtime23.jsx(Kv, {
            k: "payload",
            children: /* @__PURE__ */ jsx_runtime23.jsx(InvalidArg, {
              what: "payload"
            })
          }),
          serverName && /* @__PURE__ */ jsx_runtime23.jsx(Kv, {
            k: "server",
            children: serverName
          })
        ]
      }),
      payload && /* @__PURE__ */ jsx_runtime23.jsx(Output, {
        text: payload,
        lang: "json",
        variant: "code",
        maxLines: 8,
        title: "payload"
      }),
      diags.length > 0 ? /* @__PURE__ */ jsx_runtime23.jsx(DiagnosticRows, {
        text,
        rows: diags
      }) : locs.length > 0 ? /* @__PURE__ */ jsx_runtime23.jsx(LocationRows, {
        text,
        rows: locs
      }) : /* @__PURE__ */ jsx_runtime23.jsx(ResultText, {
        result,
        maxLines: 12
      })
    ]
  });
}
var lspRenderer = { Summary: Summary19, Body: Body19 };

// src/components/transcript/tool-views/tools/memory-recall.tsx
var jsx_runtime24 = __toESM(require_jsx_runtime(), 1);
function foundCount(props) {
  const { result } = props;
  if (!result || result.isError)
    return null;
  const match = resultTextOf(result).match(/^Found (\d+) relevant/);
  return match ? Number(match[1]) : 0;
}
function Summary20(props) {
  const query = str(props.args.query);
  const found = foundCount(props);
  return /* @__PURE__ */ jsx_runtime24.jsxs(jsx_runtime24.Fragment, {
    children: [
      query !== null ? /* @__PURE__ */ jsx_runtime24.jsx("span", {
        children: truncate(normalizeWs(query), 96)
      }) : /* @__PURE__ */ jsx_runtime24.jsx(InvalidArg, {
        what: "query"
      }),
      found !== null && /* @__PURE__ */ jsx_runtime24.jsxs(jsx_runtime24.Fragment, {
        children: [
          " ",
          found > 0 ? /* @__PURE__ */ jsx_runtime24.jsxs(Badge, {
            tone: "accent",
            children: [
              found,
              " found"
            ]
          }) : /* @__PURE__ */ jsx_runtime24.jsx(Badge, {
            tone: "warn",
            children: "no matches"
          })
        ]
      })
    ]
  });
}
function parseEntry(raw) {
  let text = raw.replace(/^-\s+/, "").trim();
  let date = null;
  let type = null;
  const dateMatch = text.match(/\s\(([^()]+)\)$/);
  if (dateMatch) {
    date = dateMatch[1] ?? null;
    text = text.slice(0, -dateMatch[0].length);
  }
  const typeMatch = text.match(/\s\[([^[\]]+)\]$/);
  if (typeMatch) {
    type = typeMatch[1] ?? null;
    text = text.slice(0, -typeMatch[0].length);
  }
  return { text, type, date };
}
function Body20(props) {
  const { args, result } = props;
  const query = str(args.query) ?? "";
  const text = resultTextOf(result);
  const found = foundCount(props);
  let asOf = null;
  let entries2 = [];
  if (found !== null && found > 0) {
    asOf = text.match(/\(as of ([^()]+) UTC\)/)?.[1] ?? null;
    entries2 = text.replace(/^[^\n]*\n+/, "").split(/\n{2,}/).map(parseEntry).filter((entry) => entry.text.length > 0);
  }
  return /* @__PURE__ */ jsx_runtime24.jsxs(jsx_runtime24.Fragment, {
    children: [
      query && /* @__PURE__ */ jsx_runtime24.jsx(Output, {
        text: query,
        title: "query",
        maxLines: 4
      }),
      entries2.length > 0 ? /* @__PURE__ */ jsx_runtime24.jsxs(jsx_runtime24.Fragment, {
        children: [
          asOf && /* @__PURE__ */ jsx_runtime24.jsx(Badges, {
            items: [`as of ${asOf} UTC`]
          }),
          /* @__PURE__ */ jsx_runtime24.jsx("div", {
            className: "tv-list",
            children: entries2.map((entry, i) => /* @__PURE__ */ jsx_runtime24.jsxs(Row, {
              children: [
                /* @__PURE__ */ jsx_runtime24.jsx("span", {
                  children: entry.text
                }),
                (entry.type !== null || entry.date !== null) && /* @__PURE__ */ jsx_runtime24.jsx(Badges, {
                  items: [entry.type, entry.date]
                })
              ]
            }, i))
          })
        ]
      }) : /* @__PURE__ */ jsx_runtime24.jsx(ResultText, {
        result,
        maxLines: 12
      })
    ]
  });
}
var recallRenderer = { Summary: Summary20, Body: Body20 };

// src/components/transcript/tool-views/tools/memory-reflect.tsx
var jsx_runtime25 = __toESM(require_jsx_runtime(), 1);
function Summary21({ args }) {
  const query = str(args.query);
  return /* @__PURE__ */ jsx_runtime25.jsx("span", {
    children: query ? truncate(normalizeWs(query), 96) : ""
  });
}
function Body21({ args, result }) {
  const query = str(args.query) ?? "";
  const context = str(args.context) ?? "";
  const failedSilently = result?.isError === true && !resultTextOf(result);
  return /* @__PURE__ */ jsx_runtime25.jsxs(jsx_runtime25.Fragment, {
    children: [
      query && /* @__PURE__ */ jsx_runtime25.jsx(Output, {
        text: query,
        title: "query",
        maxLines: 4
      }),
      context && /* @__PURE__ */ jsx_runtime25.jsx(Output, {
        text: context,
        title: "context",
        maxLines: 6
      }),
      failedSilently ? /* @__PURE__ */ jsx_runtime25.jsx(Note, {
        tone: "err",
        children: "Reflect failed"
      }) : /* @__PURE__ */ jsx_runtime25.jsx(ResultText, {
        result,
        maxLines: 12
      })
    ]
  });
}
var reflectRenderer = { Summary: Summary21, Body: Body21 };

// src/components/transcript/tool-views/tools/memory-retain.tsx
var jsx_runtime26 = __toESM(require_jsx_runtime(), 1);
function retainItems(args) {
  const raw = args.items;
  if (raw === undefined)
    return [];
  if (!Array.isArray(raw))
    return null;
  const items = [];
  for (const entry of raw) {
    if (!isRecord(entry))
      continue;
    const content = replaceTabs((str(entry.content) ?? "").trim());
    if (!content)
      continue;
    items.push({ content, context: str(entry.context) });
  }
  return items;
}
function Summary22({ args, result }) {
  const items = retainItems(args);
  if (items === null)
    return /* @__PURE__ */ jsx_runtime26.jsx(InvalidArg, {
      what: "items"
    });
  const count = num(detailsRecord(result)?.count) ?? items.length;
  const first = items[0] ? truncate(normalizeWs(items[0].content), 80) : "";
  return /* @__PURE__ */ jsx_runtime26.jsxs(jsx_runtime26.Fragment, {
    children: [
      /* @__PURE__ */ jsx_runtime26.jsx(Badge, {
        tone: "accent",
        children: count === 1 ? "1 memory" : `${count} memories`
      }),
      first && /* @__PURE__ */ jsx_runtime26.jsx("span", {
        className: "tv-trunc",
        children: first
      })
    ]
  });
}
function Body22({ args, result }) {
  const items = retainItems(args);
  const count = num(detailsRecord(result)?.count);
  let confirmation = null;
  if (result && result.isError !== true) {
    const text = resultTextOf(result).trim().replace(/\.$/, "");
    confirmation = text || (count !== null ? `${count === 1 ? "1 memory" : `${count} memories`} retained` : null);
  }
  return /* @__PURE__ */ jsx_runtime26.jsxs(jsx_runtime26.Fragment, {
    children: [
      items === null ? /* @__PURE__ */ jsx_runtime26.jsx(InvalidArg, {
        what: "items"
      }) : items.length > 0 && /* @__PURE__ */ jsx_runtime26.jsx("div", {
        className: "tv-list",
        children: items.map((item, i) => /* @__PURE__ */ jsx_runtime26.jsxs(Row, {
          children: [
            item.content,
            item.context && /* @__PURE__ */ jsx_runtime26.jsxs("span", {
              className: "tv-faint",
              children: [
                " — ",
                item.context
              ]
            })
          ]
        }, i))
      }),
      confirmation ? /* @__PURE__ */ jsx_runtime26.jsx("div", {
        children: /* @__PURE__ */ jsx_runtime26.jsx(Badge, {
          tone: "ok",
          children: confirmation
        })
      }) : /* @__PURE__ */ jsx_runtime26.jsx(ResultText, {
        result,
        maxLines: 6
      })
    ]
  });
}
var retainRenderer = { Summary: Summary22, Body: Body22 };

// src/components/transcript/tool-views/tools/read.tsx
var jsx_runtime27 = __toESM(require_jsx_runtime(), 1);
function readDetails(details) {
  const suffix = details && isRecord(details.suffixResolution) ? details.suffixResolution : null;
  const summary = details && isRecord(details.summary) ? details.summary : null;
  return {
    resolvedPath: details ? str(details.resolvedPath) : null,
    suffixTo: suffix ? str(suffix.to) : null,
    suffixFrom: suffix ? str(suffix.from) : null,
    elidedSpans: summary ? num(summary.elidedSpans) : null,
    conflictCount: details ? num(details.conflictCount) : null,
    truncated: details ? isRecord(details.truncation) : false
  };
}
var SEL_CHUNK_RE = /^(raw|conflicts|\d+(?:[-+]\d*)?(?:,\d+(?:[-+]\d*)?)*)$/i;
function splitPathSel(rawPath) {
  let path = rawPath;
  const chunks = [];
  for (let i = 0;i < 2; i++) {
    const idx = path.lastIndexOf(":");
    if (idx <= 0 || !SEL_CHUNK_RE.test(path.slice(idx + 1)))
      break;
    chunks.unshift(path.slice(idx + 1));
    path = path.slice(0, idx);
  }
  return { path, sel: chunks.length > 0 ? chunks.join(":") : null };
}
function readArgs(args) {
  const rawPath = str(args.path) ?? str(args.file_path) ?? "";
  const split = splitPathSel(rawPath);
  const sel = str(args.sel) ?? split.sel;
  const offset = num(args.offset);
  const limit = num(args.limit);
  const from = offset !== null || limit !== null ? offset ?? 1 : null;
  const to = from !== null && limit !== null ? from + limit - 1 : null;
  return { path: split.path || rawPath, sel, from, to };
}
function Summary23(props) {
  const { path, sel, from, to } = readArgs(props.args);
  return /* @__PURE__ */ jsx_runtime27.jsx(PathText, {
    path: path || "…",
    from,
    to,
    sel
  });
}
function Body23({ args, result }) {
  const { path } = readArgs(args);
  const d = readDetails(detailsRecord(result));
  const conflictBadge = d.conflictCount !== null && d.conflictCount > 0 && /* @__PURE__ */ jsx_runtime27.jsxs(Badge, {
    tone: "warn",
    children: [
      d.conflictCount,
      " conflict",
      d.conflictCount === 1 ? "" : "s"
    ]
  });
  const elidedBadge = d.elidedSpans !== null && d.elidedSpans > 0 && /* @__PURE__ */ jsx_runtime27.jsxs(Badge, {
    children: [
      d.elidedSpans,
      " elided span",
      d.elidedSpans === 1 ? "" : "s"
    ]
  });
  const truncatedBadge = d.truncated && /* @__PURE__ */ jsx_runtime27.jsx(Badge, {
    tone: "warn",
    children: "truncated"
  });
  const resolved = d.suffixTo ?? d.resolvedPath;
  return /* @__PURE__ */ jsx_runtime27.jsxs(jsx_runtime27.Fragment, {
    children: [
      (resolved !== null || d.suffixFrom !== null) && /* @__PURE__ */ jsx_runtime27.jsxs(KvGrid, {
        children: [
          resolved !== null && /* @__PURE__ */ jsx_runtime27.jsx(Kv, {
            k: "resolved",
            children: /* @__PURE__ */ jsx_runtime27.jsx(PathText, {
              path: resolved
            })
          }),
          d.suffixFrom !== null && /* @__PURE__ */ jsx_runtime27.jsx(Kv, {
            k: "corrected from",
            children: shortenPath(d.suffixFrom)
          })
        ]
      }),
      /* @__PURE__ */ jsx_runtime27.jsx(Badges, {
        items: [conflictBadge, elidedBadge, truncatedBadge]
      }),
      /* @__PURE__ */ jsx_runtime27.jsx(ResultImages, {
        result
      }),
      /* @__PURE__ */ jsx_runtime27.jsx(ResultText, {
        result,
        maxLines: 12,
        lang: languageFromPath(path),
        variant: "code"
      })
    ]
  });
}
var readRenderer = { Summary: Summary23, Body: Body23 };

// src/components/transcript/tool-views/tools/report-tool-issue.tsx
var jsx_runtime28 = __toESM(require_jsx_runtime(), 1);
function Summary24({ args }) {
  const tool = str(args.tool);
  const report = str(args.report);
  if (!tool && !report)
    return /* @__PURE__ */ jsx_runtime28.jsx(InvalidArg, {
      what: "report"
    });
  return /* @__PURE__ */ jsx_runtime28.jsxs("span", {
    children: [
      tool && /* @__PURE__ */ jsx_runtime28.jsx(Badge, {
        tone: "warn",
        children: tool
      }),
      report && /* @__PURE__ */ jsx_runtime28.jsxs("span", {
        children: [
          " ",
          truncate(normalizeWs(report), 80)
        ]
      })
    ]
  });
}
function Body24({ args, result }) {
  const report = str(args.report);
  return /* @__PURE__ */ jsx_runtime28.jsxs(jsx_runtime28.Fragment, {
    children: [
      report && /* @__PURE__ */ jsx_runtime28.jsx(Note, {
        tone: "warn",
        children: report
      }),
      /* @__PURE__ */ jsx_runtime28.jsx(ResultText, {
        result,
        maxLines: 4
      })
    ]
  });
}
var reportToolIssueRenderer = { Summary: Summary24, Body: Body24 };

// src/components/transcript/tool-views/tools/resolve.tsx
var jsx_runtime29 = __toESM(require_jsx_runtime(), 1);
var KIND_WORD = { apply: "apply", discard: "discard", propose: "propose" };
var KIND_TRANSITION = {
  apply: "proposed → resolved",
  discard: "proposed → rejected",
  propose: "plan proposed"
};
var KIND_TONE = { apply: "ok", discard: "warn", propose: "accent" };
function cardModel({ name, args, result }) {
  const details = detailsRecord(result);
  const explicit = str(details?.action) ?? str(args.action);
  const kind = explicit === "apply" || explicit === "discard" ? explicit : name === "propose" ? "propose" : name === "reject" ? "discard" : "apply";
  const extra = isRecord(args.extra) ? args.extra : details && isRecord(details.extra) ? details.extra : null;
  return {
    kind,
    tone: result?.isError ? "err" : KIND_TONE[kind],
    reason: str(details?.reason) ?? str(args.reason),
    sourceToolName: str(details?.sourceToolName) ?? str(args.sourceToolName),
    label: str(details?.label) ?? str(args.label),
    title: str(details?.title) ?? str(args.title),
    planFilePath: str(details?.planFilePath) ?? str(args.planFilePath),
    extra
  };
}
function Summary25(props) {
  const card = cardModel(props);
  const trailing = card.kind === "propose" ? card.title : card.reason;
  return /* @__PURE__ */ jsx_runtime29.jsxs(jsx_runtime29.Fragment, {
    children: [
      /* @__PURE__ */ jsx_runtime29.jsx(Badge, {
        tone: card.tone,
        children: KIND_WORD[card.kind]
      }),
      " ",
      trailing && /* @__PURE__ */ jsx_runtime29.jsx("span", {
        children: truncate(normalizeWs(trailing), 100)
      })
    ]
  });
}
function Body25(props) {
  const { result } = props;
  const card = cardModel(props);
  const extraRows = [];
  if (card.extra) {
    for (const k in card.extra) {
      const v = card.extra[k];
      let text;
      if (typeof v === "string")
        text = v;
      else {
        try {
          text = JSON.stringify(v) ?? String(v);
        } catch {
          text = String(v);
        }
      }
      extraRows.push(/* @__PURE__ */ jsx_runtime29.jsx(Kv, {
        k,
        children: truncate(normalizeWs(text), 200)
      }, k));
    }
  }
  return /* @__PURE__ */ jsx_runtime29.jsxs(jsx_runtime29.Fragment, {
    children: [
      /* @__PURE__ */ jsx_runtime29.jsx(Badges, {
        items: [
          /* @__PURE__ */ jsx_runtime29.jsx(Badge, {
            tone: card.tone,
            children: KIND_TRANSITION[card.kind]
          }, "action"),
          card.sourceToolName && /* @__PURE__ */ jsx_runtime29.jsx(Badge, {
            children: card.sourceToolName
          }, "source"),
          card.label && /* @__PURE__ */ jsx_runtime29.jsx("span", {
            children: truncate(normalizeWs(card.label), 120)
          }, "label"),
          card.kind === "propose" && card.title && /* @__PURE__ */ jsx_runtime29.jsx("span", {
            children: truncate(normalizeWs(card.title), 120)
          }, "title")
        ]
      }),
      card.kind !== "propose" && card.reason && /* @__PURE__ */ jsx_runtime29.jsx(Note, {
        children: card.reason
      }),
      card.kind === "propose" && card.planFilePath && /* @__PURE__ */ jsx_runtime29.jsx(KvGrid, {
        children: /* @__PURE__ */ jsx_runtime29.jsx(Kv, {
          k: "plan",
          children: card.planFilePath
        })
      }),
      extraRows.length > 0 && /* @__PURE__ */ jsx_runtime29.jsx(KvGrid, {
        children: extraRows
      }),
      /* @__PURE__ */ jsx_runtime29.jsx(ResultText, {
        result,
        maxLines: 6
      })
    ]
  });
}
var resolveRenderer = { Summary: Summary25, Body: Body25 };

// src/components/transcript/tool-views/tools/task.tsx
var import_react8 = __toESM(require_react(), 1);
var jsx_runtime30 = __toESM(require_jsx_runtime(), 1);
var MISSING_YIELD_PREFIX = "SYSTEM WARNING: Subagent exited without calling yield tool";
function taskItems(args) {
  const raw = args.tasks;
  if (Array.isArray(raw)) {
    const items = [];
    for (const entry of raw) {
      if (!isRecord(entry))
        continue;
      items.push({
        id: str(entry.id),
        description: str(entry.description),
        assignment: str(entry.assignment),
        isolated: entry.isolated === true
      });
    }
    return items;
  }
  const flat = {
    id: str(args.id),
    description: str(args.description),
    assignment: str(args.assignment),
    isolated: args.isolated === true
  };
  return flat.id || flat.description || flat.assignment ? [flat] : [];
}
function taskIdLabel(id) {
  return id.includes(".") ? id.split(".").join(">") : id;
}
function fmtDuration3(ms) {
  if (ms < 1000)
    return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 60)
    return `${s < 10 ? s.toFixed(1) : Math.round(s)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}
function fmtCount(n) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}
function resultStatus(res) {
  if (res.aborted === true)
    return { label: "aborted", tone: "err" };
  if (num(res.exitCode) === 0) {
    return str(res.error) ? { label: "merge failed", tone: "warn" } : { label: "done", tone: "ok" };
  }
  return { label: "failed", tone: "err" };
}
function Summary26({ args }) {
  const agent = str(args.agent);
  const resume = str(args.resume);
  const tasks = taskItems(args);
  const first = tasks.length > 0 ? tasks[0] : null;
  const label = first ? first.description ?? first.id : null;
  return /* @__PURE__ */ jsx_runtime30.jsxs(jsx_runtime30.Fragment, {
    children: [
      agent && /* @__PURE__ */ jsx_runtime30.jsx(Badge, {
        tone: "accent",
        children: agent
      }),
      !agent && resume && /* @__PURE__ */ jsx_runtime30.jsxs(Badge, {
        children: [
          "resume ",
          resume
        ]
      }),
      label && /* @__PURE__ */ jsx_runtime30.jsx("span", {
        className: "tv-muted",
        children: truncate(normalizeWs(label), 72)
      }),
      tasks.length > 1 && /* @__PURE__ */ jsx_runtime30.jsxs(Badge, {
        children: [
          tasks.length,
          " tasks"
        ]
      })
    ]
  });
}
function AgentResult({ res, host }) {
  const { label, tone } = resultStatus(res);
  const id = str(res.id) ?? "agent";
  const description = str(res.description);
  const stats = [];
  const tokens = num(res.tokens);
  if (tokens)
    stats.push(`${fmtCount(tokens)} tok`);
  const requests = num(res.requests);
  if (requests)
    stats.push(`${requests} req`);
  const durationMs = num(res.durationMs);
  if (durationMs != null)
    stats.push(fmtDuration3(durationMs));
  const model = str(res.resolvedModel);
  if (model)
    stats.push(model);
  let output = str(res.output) ?? "";
  let warning = null;
  const nl = output.indexOf(`
`);
  const firstLine = (nl === -1 ? output : output.slice(0, nl)).trim();
  if (firstLine.startsWith(MISSING_YIELD_PREFIX)) {
    warning = firstLine;
    output = nl === -1 ? "" : output.slice(nl + 1).replace(/^\s*\n+/, "");
  }
  const error = str(res.error);
  const aborted = res.aborted === true;
  const abortReason = str(res.abortReason);
  const patchPath = str(res.patchPath);
  const branchName = str(res.branchName);
  return /* @__PURE__ */ jsx_runtime30.jsxs(jsx_runtime30.Fragment, {
    children: [
      /* @__PURE__ */ jsx_runtime30.jsxs(Row, {
        k: /* @__PURE__ */ jsx_runtime30.jsx(AgentLink, {
          id,
          host,
          children: taskIdLabel(id)
        }),
        children: [
          /* @__PURE__ */ jsx_runtime30.jsx(Badge, {
            tone,
            children: label
          }),
          " ",
          res.truncated === true && /* @__PURE__ */ jsx_runtime30.jsx(Badge, {
            tone: "warn",
            children: "truncated"
          }),
          " ",
          description && /* @__PURE__ */ jsx_runtime30.jsx("span", {
            children: truncate(normalizeWs(description), 96)
          }),
          " ",
          stats.length > 0 && /* @__PURE__ */ jsx_runtime30.jsx("span", {
            className: "tv-faint",
            children: stats.join(" · ")
          })
        ]
      }),
      warning && /* @__PURE__ */ jsx_runtime30.jsx(Note, {
        tone: "warn",
        children: warning
      }),
      aborted && abortReason && /* @__PURE__ */ jsx_runtime30.jsx(Note, {
        tone: "err",
        children: abortReason
      }),
      output.trim() !== "" && /* @__PURE__ */ jsx_runtime30.jsx(Output, {
        text: output,
        maxLines: 6,
        error: tone === "err"
      }),
      error && !aborted && error !== abortReason && /* @__PURE__ */ jsx_runtime30.jsx(Note, {
        tone: tone === "warn" ? "warn" : "err",
        children: error
      }),
      patchPath && /* @__PURE__ */ jsx_runtime30.jsxs("div", {
        className: "tv-faint",
        children: [
          "patch: ",
          patchPath
        ]
      }),
      !patchPath && branchName && /* @__PURE__ */ jsx_runtime30.jsxs("div", {
        className: "tv-faint",
        children: [
          "branch: ",
          branchName
        ]
      })
    ]
  });
}
var COLLAPSED_AGENT_LIMIT = 4;
var MAX_NESTED_DEPTH = 8;
function detailsArray(value) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}
function NestedTaskTree({
  snapshots,
  host,
  depth,
  path
}) {
  const [expanded, setExpanded] = import_react8.useState(false);
  const rows = [];
  let total = 0;
  const entries2 = [];
  snapshots.forEach((details, i) => {
    if (path.includes(details)) {
      entries2.push({ key: `cycle-${i}`, count: 0, node: () => /* @__PURE__ */ jsx_runtime30.jsx(Note, {
        children: "… nested task progress already shown"
      }) });
      return;
    }
    if (depth >= MAX_NESTED_DEPTH) {
      entries2.push({ key: `depth-${i}`, count: 0, node: () => /* @__PURE__ */ jsx_runtime30.jsx(Note, {
        children: "… nested task depth limit reached"
      }) });
      return;
    }
    const results = detailsArray(details.results);
    const progress = detailsArray(details.progress);
    const childPath = [...path, details];
    const items = results.length > 0 ? results : progress;
    if (items.length === 0)
      return;
    total += items.length;
    entries2.push({
      key: `d-${i}`,
      count: items.length,
      node: (limit2) => {
        const visible = limit2 ? items.slice(-COLLAPSED_AGENT_LIMIT) : items;
        return /* @__PURE__ */ jsx_runtime30.jsx(jsx_runtime30.Fragment, {
          children: visible.map((item, j) => results.length > 0 ? /* @__PURE__ */ jsx_runtime30.jsx(AgentResult, {
            res: item,
            host
          }, str(item.id) ?? j) : /* @__PURE__ */ jsx_runtime30.jsx(AgentProgressRow, {
            p: item,
            host,
            depth: depth + 1,
            path: childPath
          }, str(item.id) ?? j))
        });
      }
    });
  });
  const limit = !expanded;
  for (const entry of entries2)
    rows.push(/* @__PURE__ */ jsx_runtime30.jsx("div", {
      children: entry.node(limit)
    }, entry.key));
  const hidden = limit ? entries2.reduce((n, e) => n + Math.max(0, e.count - COLLAPSED_AGENT_LIMIT), 0) : 0;
  if (rows.length === 0)
    return null;
  return /* @__PURE__ */ jsx_runtime30.jsxs("div", {
    className: "tv-nested",
    children: [
      rows,
      hidden > 0 && /* @__PURE__ */ jsx_runtime30.jsx("button", {
        type: "button",
        className: "tv-faint",
        onClick: () => setExpanded(true),
        children: `… ${hidden} more ${hidden === 1 ? "agent" : "agents"}`
      }),
      expanded && total > COLLAPSED_AGENT_LIMIT && /* @__PURE__ */ jsx_runtime30.jsx("button", {
        type: "button",
        className: "tv-faint",
        onClick: () => setExpanded(false),
        children: "show less"
      })
    ]
  });
}
function AgentProgressRow({
  p,
  host,
  depth = 0,
  path = []
}) {
  const status = str(p.status) ?? "running";
  const tone = status === "completed" ? "ok" : status === "failed" || status === "aborted" ? "err" : status === "running" ? "accent" : undefined;
  const id = str(p.id) ?? "agent";
  const description = str(p.description);
  const intent = str(p.lastIntent) ?? str(p.currentTool);
  const bits = [];
  const toolCount = num(p.toolCount);
  if (toolCount)
    bits.push(`${toolCount} tools`);
  const tokens = num(p.tokens);
  if (tokens)
    bits.push(`${fmtCount(tokens)} tok`);
  const durationMs = num(p.durationMs);
  if (durationMs)
    bits.push(fmtDuration3(durationMs));
  const extracted = isRecord(p.extractedToolData) ? detailsArray(p.extractedToolData.task) : [];
  const snapshots = isRecord(p.inflightTaskDetails) ? [...extracted, p.inflightTaskDetails] : extracted;
  return /* @__PURE__ */ jsx_runtime30.jsxs(jsx_runtime30.Fragment, {
    children: [
      /* @__PURE__ */ jsx_runtime30.jsxs(Row, {
        k: /* @__PURE__ */ jsx_runtime30.jsx(AgentLink, {
          id,
          host,
          children: taskIdLabel(id)
        }),
        children: [
          /* @__PURE__ */ jsx_runtime30.jsx(Badge, {
            tone,
            children: status
          }),
          " ",
          description && /* @__PURE__ */ jsx_runtime30.jsx("span", {
            children: truncate(normalizeWs(description), 96)
          }),
          " ",
          intent && /* @__PURE__ */ jsx_runtime30.jsx("span", {
            className: "tv-muted",
            children: truncate(normalizeWs(intent), 64)
          }),
          " ",
          bits.length > 0 && /* @__PURE__ */ jsx_runtime30.jsx("span", {
            className: "tv-faint",
            children: bits.join(" · ")
          })
        ]
      }),
      snapshots.length > 0 && /* @__PURE__ */ jsx_runtime30.jsx(NestedTaskTree, {
        snapshots,
        host,
        depth,
        path
      })
    ]
  });
}
function Body26({ args, result, host }) {
  const resume = str(args.resume);
  const context = str(args.context);
  const tasks = taskItems(args);
  const details = detailsRecord(result);
  const results = details && Array.isArray(details.results) ? details.results.filter(isRecord) : [];
  const progress = details && Array.isArray(details.progress) ? details.progress.filter(isRecord) : [];
  const showProgress = results.length === 0 && progress.length > 0;
  let footer = null;
  if (results.length > 0) {
    let ok = 0;
    let mergeFailed = 0;
    let aborted = 0;
    let failed = 0;
    for (const res of results) {
      const { label } = resultStatus(res);
      if (label === "done")
        ok++;
      else if (label === "merge failed")
        mergeFailed++;
      else if (label === "aborted")
        aborted++;
      else
        failed++;
    }
    const total = details ? num(details.totalDurationMs) : null;
    footer = /* @__PURE__ */ jsx_runtime30.jsxs(Row, {
      children: [
        ok > 0 && /* @__PURE__ */ jsx_runtime30.jsxs(Badge, {
          tone: "ok",
          children: [
            ok,
            " succeeded"
          ]
        }),
        " ",
        mergeFailed > 0 && /* @__PURE__ */ jsx_runtime30.jsxs(Badge, {
          tone: "warn",
          children: [
            mergeFailed,
            " merge failed"
          ]
        }),
        " ",
        failed > 0 && /* @__PURE__ */ jsx_runtime30.jsxs(Badge, {
          tone: "err",
          children: [
            failed,
            " failed"
          ]
        }),
        " ",
        aborted > 0 && /* @__PURE__ */ jsx_runtime30.jsxs(Badge, {
          tone: "err",
          children: [
            aborted,
            " aborted"
          ]
        }),
        " ",
        total != null && /* @__PURE__ */ jsx_runtime30.jsx("span", {
          className: "tv-faint",
          children: fmtDuration3(total)
        })
      ]
    });
  }
  const ordered = [...results].sort((a, b) => (num(a.durationMs) ?? 0) - (num(b.durationMs) ?? 0) || (num(a.index) ?? 0) - (num(b.index) ?? 0));
  return /* @__PURE__ */ jsx_runtime30.jsxs(jsx_runtime30.Fragment, {
    children: [
      resume && /* @__PURE__ */ jsx_runtime30.jsxs(Badge, {
        children: [
          "resume ",
          resume
        ]
      }),
      context && /* @__PURE__ */ jsx_runtime30.jsx(Output, {
        text: context,
        maxLines: 4,
        title: "context"
      }),
      tasks.length > 0 && /* @__PURE__ */ jsx_runtime30.jsx("div", {
        className: "tv-list",
        children: tasks.map((t, i) => /* @__PURE__ */ jsx_runtime30.jsxs("div", {
          children: [
            /* @__PURE__ */ jsx_runtime30.jsxs(Row, {
              k: t.id ? /* @__PURE__ */ jsx_runtime30.jsx(AgentLink, {
                id: t.id,
                host,
                children: taskIdLabel(t.id)
              }) : /* @__PURE__ */ jsx_runtime30.jsx(Badge, {
                tone: "accent",
                children: `#${i + 1}`
              }),
              children: [
                t.isolated && /* @__PURE__ */ jsx_runtime30.jsx(Badge, {
                  children: "isolated"
                }),
                " ",
                t.description && /* @__PURE__ */ jsx_runtime30.jsx("span", {
                  children: truncate(normalizeWs(t.description), 120)
                })
              ]
            }),
            t.assignment && /* @__PURE__ */ jsx_runtime30.jsx(Output, {
              text: t.assignment,
              maxLines: 6,
              title: "assignment"
            })
          ]
        }, t.id ?? i))
      }),
      ordered.length > 0 && /* @__PURE__ */ jsx_runtime30.jsxs("div", {
        className: "tv-list",
        children: [
          ordered.map((res, i) => /* @__PURE__ */ jsx_runtime30.jsx(AgentResult, {
            res,
            host
          }, str(res.id) ?? i)),
          footer
        ]
      }),
      showProgress && /* @__PURE__ */ jsx_runtime30.jsx("div", {
        className: "tv-list",
        children: progress.map((p, i) => /* @__PURE__ */ jsx_runtime30.jsx(AgentProgressRow, {
          p,
          host
        }, str(p.id) ?? i))
      }),
      ordered.length === 0 && !showProgress && /* @__PURE__ */ jsx_runtime30.jsx(ResultText, {
        result,
        maxLines: 12
      })
    ]
  });
}
var taskRenderer = { Summary: Summary26, Body: Body26 };

// src/lib/todo-model.ts
function isTodoStatus(val) {
  return val === "pending" || val === "in_progress" || val === "completed" || val === "abandoned" || val === "blocked";
}
function isTodoItem(val) {
  if (!val || typeof val !== "object")
    return false;
  const item = val;
  return typeof item.content === "string" && isTodoStatus(item.status);
}
function isTodoPhase(val) {
  if (!val || typeof val !== "object")
    return false;
  const phase = val;
  return typeof phase.name === "string" && Array.isArray(phase.tasks) && phase.tasks.every(isTodoItem);
}
function isTodoPhaseArray(val) {
  return Array.isArray(val) && val.every(isTodoPhase);
}
function isClosedTodo(status) {
  return status === "completed" || status === "abandoned";
}
var ROMAN_NUMERALS = [
  [1000, "M"],
  [900, "CM"],
  [500, "D"],
  [400, "CD"],
  [100, "C"],
  [90, "XC"],
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"]
];
function formatRoman(n) {
  if (n <= 0)
    return "";
  let out = "";
  let rem = n;
  for (const [val, sym] of ROMAN_NUMERALS) {
    while (rem >= val) {
      out += sym;
      rem -= val;
    }
  }
  return out;
}
function selectActivePhaseIndex(phases) {
  if (phases.length === 0)
    return -1;
  const inProgIdx = phases.findIndex((p) => p.tasks.some((t) => t.status === "in_progress"));
  if (inProgIdx !== -1)
    return inProgIdx;
  const openIdx = phases.findIndex((p) => p.tasks.some((t) => t.status === "pending"));
  if (openIdx !== -1)
    return openIdx;
  return phases.length - 1;
}
function cloneTodoPhases(phases) {
  return phases.map((phase) => ({
    name: phase.name,
    tasks: phase.tasks.map((task) => ({
      content: task.content,
      status: task.status,
      ...task.blocker !== undefined ? { blocker: task.blocker } : {},
      ...task.details !== undefined ? { details: task.details } : {},
      ...task.notes !== undefined ? { notes: [...task.notes] } : {}
    }))
  }));
}
function countTodoProgress(phases = []) {
  let closed = 0;
  let total = 0;
  let completed = 0;
  let inProgress = 0;
  let pending = 0;
  let abandoned = 0;
  let blocked = 0;
  for (const phase of phases) {
    for (const task of phase.tasks) {
      total++;
      switch (task.status) {
        case "completed":
          completed++;
          closed++;
          break;
        case "abandoned":
          abandoned++;
          closed++;
          break;
        case "in_progress":
          inProgress++;
          break;
        case "pending":
          pending++;
          break;
        case "blocked":
          blocked++;
          break;
      }
    }
  }
  const percent = total > 0 ? Math.round(closed / total * 100) : 0;
  return { closed, total, completed, inProgress, pending, abandoned, blocked, percent };
}
function cycleTaskStatus(status) {
  switch (status) {
    case "pending":
      return "in_progress";
    case "in_progress":
      return "completed";
    case "completed":
      return "abandoned";
    case "abandoned":
      return "pending";
    case "blocked":
      return "in_progress";
    default:
      return "pending";
  }
}
function updateTaskStatus(phases, phaseIndex, taskIndex, newStatus) {
  return phases.map((phase, pIdx) => {
    if (pIdx !== phaseIndex)
      return phase;
    return {
      ...phase,
      tasks: phase.tasks.map((task, tIdx) => {
        if (tIdx !== taskIndex)
          return task;
        return { ...task, status: newStatus };
      })
    };
  });
}
function extractTodoPhasesFromEvent(event) {
  if (!event || typeof event !== "object")
    return;
  const ev = event;
  if (ev.type === "tool_execution_end" && ev.toolName === "todo" && !ev.isError) {
    const result = ev.result;
    const details = result?.details;
    if (details && isTodoPhaseArray(details.phases)) {
      return cloneTodoPhases(details.phases);
    }
  }
  if (ev.type === "entry") {
    const entry = ev.entry;
    if (entry?.type === "message") {
      const msg = entry.message;
      if (msg?.role === "toolResult" && msg?.toolName === "todo") {
        const details = msg.details;
        if (details && isTodoPhaseArray(details.phases)) {
          return cloneTodoPhases(details.phases);
        }
      }
    }
    if (entry?.type === "custom" && entry.customType === "user_todo_edit") {
      const data = entry.data;
      if (data && isTodoPhaseArray(data.phases)) {
        return cloneTodoPhases(data.phases);
      }
    }
  }
  return;
}
var USER_TODO_EDIT_CUSTOM_TYPE = "user_todo_edit";
function canonicalEntryPhases(entry) {
  if (!entry || typeof entry !== "object")
    return;
  const e = entry;
  if (e.type === "custom" && e.customType === USER_TODO_EDIT_CUSTOM_TYPE) {
    const phases2 = e.data?.phases;
    return Array.isArray(phases2) ? phases2 : undefined;
  }
  if (e.type !== "message")
    return;
  const msg = e.message;
  if (!msg || msg.role !== "toolResult" || msg.toolName !== "todo" || msg.isError)
    return;
  if (msg.details?.op === "view")
    return;
  const phases = msg.details?.phases;
  return Array.isArray(phases) ? phases : undefined;
}
function getLatestTodoPhasesFromEntries(entries2) {
  for (let i = entries2.length - 1;i >= 0; i--) {
    const phases = canonicalEntryPhases(entries2[i]);
    if (phases)
      return isTodoPhaseArray(phases) ? cloneTodoPhases(phases) : [];
  }
  return [];
}

// src/components/transcript/tool-views/tools/todo.tsx
var jsx_runtime31 = __toESM(require_jsx_runtime(), 1);
function toOps(args) {
  if (Array.isArray(args.ops))
    return args.ops;
  return typeof args.op === "string" ? [args] : [];
}
function Summary27({ args, groupCount }) {
  const ops = toOps(args);
  const counts = {};
  const order = [];
  let firstTask = null;
  for (const entry of ops) {
    if (!isRecord(entry))
      continue;
    const op = str(entry.op) ?? "update";
    if (counts[op] === undefined) {
      counts[op] = 0;
      order.push(op);
    }
    counts[op]++;
    if (firstTask === null) {
      firstTask = str(entry.task) ?? str(entry.phase);
      if (firstTask === null && Array.isArray(entry.list)) {
        const head = entry.list.find(isRecord);
        if (head && Array.isArray(head.items))
          firstTask = str(head.items[0]);
      }
    }
  }
  const countBadge = groupCount !== undefined && groupCount > 1 ? `${groupCount} updates` : null;
  const labels = countBadge !== null ? [countBadge] : order.map((op) => counts[op] > 1 ? `${op}×${counts[op]}` : op);
  return /* @__PURE__ */ jsx_runtime31.jsxs(jsx_runtime31.Fragment, {
    children: [
      /* @__PURE__ */ jsx_runtime31.jsx(Badges, {
        items: labels.length > 0 ? labels : ["update"]
      }),
      firstTask !== null && /* @__PURE__ */ jsx_runtime31.jsxs("span", {
        children: [
          " ",
          truncate(normalizeWs(firstTask), 60)
        ]
      })
    ]
  });
}
function toPhases(raw) {
  if (!Array.isArray(raw))
    return null;
  const phases = [];
  for (const p of raw) {
    if (!isRecord(p))
      continue;
    const name = str(p.name) ?? "";
    const rawTasks = Array.isArray(p.tasks) ? p.tasks : [];
    const tasks = [];
    for (const t of rawTasks) {
      if (!isRecord(t))
        continue;
      const content = str(t.content) ?? "";
      const rawStatus = str(t.status);
      const status = isTodoStatus(rawStatus) ? rawStatus : "pending";
      const blocker = str(t.blocker) ?? undefined;
      tasks.push({
        content,
        status,
        ...blocker ? { blocker } : {}
      });
    }
    phases.push({ name, tasks });
  }
  return phases.length > 0 ? phases : null;
}
function TodoTree({ phases }) {
  const activeIdx = selectActivePhaseIndex(phases);
  return /* @__PURE__ */ jsx_runtime31.jsxs("div", {
    className: "tv-todo-tree",
    children: [
      /* @__PURE__ */ jsx_runtime31.jsx("div", {
        className: "tv-todo-tree-root",
        children: "TODO"
      }),
      phases.map((phase, pIdx) => {
        const closed = phase.tasks.filter((t) => isClosedTodo(t.status)).length;
        const total = phase.tasks.length;
        const roman = formatRoman(pIdx + 1);
        const displayName = roman ? `${roman}. ${phase.name}` : phase.name;
        const progress = ` · ${closed}/${total}`;
        const isActive = pIdx === activeIdx;
        if (!isActive) {
          return /* @__PURE__ */ jsx_runtime31.jsxs("div", {
            className: "tv-todo-row",
            children: [
              /* @__PURE__ */ jsx_runtime31.jsx("span", {
                className: "tv-todo-rail tv-todo-rail--outer",
                children: " ├─ "
              }),
              /* @__PURE__ */ jsx_runtime31.jsxs("span", {
                className: "tv-todo-content tv-todo-phase--dim",
                children: [
                  displayName,
                  progress
                ]
              })
            ]
          }, phase.name || `p-${pIdx}`);
        }
        return /* @__PURE__ */ jsx_runtime31.jsxs("div", {
          className: "tv-todo-active-phase",
          children: [
            /* @__PURE__ */ jsx_runtime31.jsxs("div", {
              className: "tv-todo-row",
              children: [
                /* @__PURE__ */ jsx_runtime31.jsx("span", {
                  className: "tv-todo-rail tv-todo-rail--outer",
                  children: " ├─ "
                }),
                /* @__PURE__ */ jsx_runtime31.jsxs("span", {
                  className: "tv-todo-content tv-todo-phase--active",
                  children: [
                    displayName,
                    progress
                  ]
                })
              ]
            }),
            phase.tasks.map((task, tIdx) => {
              const isLast = tIdx === phase.tasks.length - 1;
              const rail = ` │   ${isLast ? "└─ " : "├─ "}`;
              const marker = task.status === "completed" ? "☑" : "☐";
              const suffix = task.status === "in_progress" ? " (in progress)" : task.status === "blocked" ? task.blocker ? ` (blocked: ${task.blocker})` : " (blocked)" : null;
              return /* @__PURE__ */ jsx_runtime31.jsxs("div", {
                className: `tv-todo-row tv-todo-task--${task.status}`,
                children: [
                  /* @__PURE__ */ jsx_runtime31.jsx("span", {
                    className: `tv-todo-rail tv-todo-rail--outer${isLast ? "" : " tv-todo-rail--inner"}`,
                    children: rail
                  }),
                  /* @__PURE__ */ jsx_runtime31.jsxs("span", {
                    className: "tv-todo-content",
                    children: [
                      /* @__PURE__ */ jsx_runtime31.jsx("span", {
                        className: "tv-todo-marker",
                        children: marker
                      }),
                      " ",
                      /* @__PURE__ */ jsx_runtime31.jsx("span", {
                        className: "tv-todo-task-text",
                        children: task.content
                      }),
                      suffix && /* @__PURE__ */ jsx_runtime31.jsx("span", {
                        className: "tv-todo-task-suffix",
                        children: suffix
                      })
                    ]
                  })
                ]
              }, task.content || `t-${tIdx}`);
            })
          ]
        }, phase.name || `p-${pIdx}`);
      }),
      /* @__PURE__ */ jsx_runtime31.jsx("div", {
        className: "tv-todo-row",
        children: /* @__PURE__ */ jsx_runtime31.jsx("span", {
          className: "tv-todo-rail",
          children: " └──"
        })
      })
    ]
  });
}
function Body27({ result }) {
  const rec = detailsRecord(result);
  const phases = rec && Array.isArray(rec.phases) && !result?.isError ? toPhases(rec.phases) : null;
  if (result?.isError || phases === null) {
    return /* @__PURE__ */ jsx_runtime31.jsx(ResultText, {
      result,
      maxLines: 8
    });
  }
  return /* @__PURE__ */ jsx_runtime31.jsx(TodoTree, {
    phases
  });
}
var todoRenderer = {
  Summary: Summary27,
  Body: Body27,
  defaultOpen: true
};

// src/components/transcript/tool-views/tools/web-search.tsx
var jsx_runtime32 = __toESM(require_jsx_runtime(), 1);
function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
function formatAge(seconds) {
  const s = num(seconds);
  if (s === null || s < 0)
    return "";
  const m = Math.floor(s / 60);
  if (m < 60)
    return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)
    return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 365)
    return `${d}d ago`;
  return `${Math.floor(d / 365)}y ago`;
}
function Summary28({ args }) {
  const query = str(args.query);
  const recency = str(args.recency);
  return /* @__PURE__ */ jsx_runtime32.jsxs(jsx_runtime32.Fragment, {
    children: [
      query === null ? /* @__PURE__ */ jsx_runtime32.jsx(InvalidArg, {
        what: "query"
      }) : /* @__PURE__ */ jsx_runtime32.jsx("span", {
        className: "tv-pattern",
        children: truncate(normalizeWs(query), 80)
      }),
      recency && /* @__PURE__ */ jsx_runtime32.jsx(Badge, {
        children: recency
      })
    ]
  });
}
function SourceRow({ source, index: index2 }) {
  const url = str(source.url) ?? "";
  const title = str(source.title)?.trim() || url || "Untitled";
  const domain = url ? getDomain(url) : "";
  const age = formatAge(source.ageSeconds) || (str(source.publishedDate) ?? "");
  return /* @__PURE__ */ jsx_runtime32.jsxs(Row, {
    k: String(index2 + 1),
    children: [
      url ? /* @__PURE__ */ jsx_runtime32.jsx("a", {
        href: url,
        rel: "noreferrer",
        target: "_blank",
        children: title
      }) : title,
      domain && /* @__PURE__ */ jsx_runtime32.jsxs("span", {
        className: "tv-faint",
        children: [
          " (",
          domain,
          ")"
        ]
      }),
      age && /* @__PURE__ */ jsx_runtime32.jsxs("span", {
        className: "tv-muted",
        children: [
          " · ",
          age
        ]
      })
    ]
  });
}
function Body28({ args, result }) {
  const query = str(args.query);
  const recency = str(args.recency);
  const limit = num(args.limit);
  const numResults = num(args.num_search_results);
  const details = detailsRecord(result);
  const response = details && isRecord(details.response) ? details.response : null;
  const errorMsg = details ? str(details.error) : null;
  const provider = response ? str(response.provider) : null;
  const model = response ? str(response.model) : null;
  const authMode = response ? str(response.authMode) : null;
  const sources = response && Array.isArray(response.sources) ? response.sources.filter(isRecord) : [];
  let providerInfo = model && provider ? `${model} @ ${provider}` : model ?? provider ?? "";
  if (providerInfo && authMode) {
    providerInfo += ` (${authMode === "oauth" ? "OAuth" : authMode === "api_key" ? "API" : authMode})`;
  }
  const usage = response && isRecord(response.usage) ? response.usage : null;
  const usageParts = [];
  if (usage) {
    const inTok = num(usage.inputTokens);
    const outTok = num(usage.outputTokens);
    const totalTok = num(usage.totalTokens);
    const searchReqs = num(usage.searchRequests);
    if (inTok !== null)
      usageParts.push(`in ${inTok}`);
    if (outTok !== null)
      usageParts.push(`out ${outTok}`);
    if (totalTok !== null)
      usageParts.push(`total ${totalTok}`);
    if (searchReqs !== null)
      usageParts.push(`search ${searchReqs}`);
  }
  return /* @__PURE__ */ jsx_runtime32.jsxs(jsx_runtime32.Fragment, {
    children: [
      /* @__PURE__ */ jsx_runtime32.jsx(Badges, {
        items: [
          recency && `recency=${recency}`,
          limit !== null && `limit=${limit}`,
          numResults !== null && `results=${numResults}`,
          response && `${sources.length} source${sources.length === 1 ? "" : "s"}`
        ]
      }),
      (query !== null || providerInfo || usageParts.length > 0) && /* @__PURE__ */ jsx_runtime32.jsxs(KvGrid, {
        children: [
          query !== null && /* @__PURE__ */ jsx_runtime32.jsx(Kv, {
            k: "query",
            children: query
          }),
          providerInfo && /* @__PURE__ */ jsx_runtime32.jsx(Kv, {
            k: "provider",
            children: providerInfo
          }),
          usageParts.length > 0 && /* @__PURE__ */ jsx_runtime32.jsx(Kv, {
            k: "usage",
            children: usageParts.join(" · ")
          })
        ]
      }),
      errorMsg && !resultTextOf(result) && /* @__PURE__ */ jsx_runtime32.jsx(Note, {
        tone: "err",
        children: errorMsg
      }),
      /* @__PURE__ */ jsx_runtime32.jsx(ResultText, {
        result,
        maxLines: 14,
        lang: "markdown"
      }),
      sources.length > 0 && /* @__PURE__ */ jsx_runtime32.jsx("div", {
        className: "tv-list",
        children: sources.map((source, i) => /* @__PURE__ */ jsx_runtime32.jsx(SourceRow, {
          source,
          index: i
        }, str(source.url) ?? i))
      })
    ]
  });
}
var webSearchRenderer = { Summary: Summary28, Body: Body28 };

// src/components/transcript/tool-views/tools/write.tsx
var jsx_runtime33 = __toESM(require_jsx_runtime(), 1);
function diagnosticsOf(details) {
  if (!details || !isRecord(details.diagnostics))
    return null;
  const d = details.diagnostics;
  const messages = [];
  if (Array.isArray(d.messages)) {
    for (const m of d.messages)
      if (typeof m === "string")
        messages.push(m);
  }
  const summary = str(d.summary);
  if (messages.length === 0 && !summary)
    return null;
  return { server: str(d.server) ?? undefined, messages, summary, errored: d.errored === true };
}
function Summary29({ args }) {
  const path = str(args.file_path ?? args.path);
  const content = str(args.content);
  const lines = content ? content.split(`
`).length : 0;
  return /* @__PURE__ */ jsx_runtime33.jsxs(jsx_runtime33.Fragment, {
    children: [
      path === null ? /* @__PURE__ */ jsx_runtime33.jsx(InvalidArg, {
        what: "path"
      }) : /* @__PURE__ */ jsx_runtime33.jsx(PathText, {
        path
      }),
      lines > 1 && /* @__PURE__ */ jsx_runtime33.jsxs(jsx_runtime33.Fragment, {
        children: [
          " ",
          /* @__PURE__ */ jsx_runtime33.jsxs(Badge, {
            children: [
              lines,
              " lines"
            ]
          })
        ]
      })
    ]
  });
}
function Body29({ args, result }) {
  const path = str(args.file_path ?? args.path);
  const content = str(args.content);
  const details = detailsRecord(result);
  const diagnostics = diagnosticsOf(details);
  return /* @__PURE__ */ jsx_runtime33.jsxs(jsx_runtime33.Fragment, {
    children: [
      /* @__PURE__ */ jsx_runtime33.jsx(Badges, {
        items: [
          details?.madeExecutable === true && /* @__PURE__ */ jsx_runtime33.jsx(Badge, {
            tone: "ok",
            children: "made executable"
          }),
          diagnostics?.summary && /* @__PURE__ */ jsx_runtime33.jsxs(Badge, {
            tone: diagnostics.errored ? "err" : "warn",
            children: [
              diagnostics.server ? `${diagnostics.server}: ` : "",
              diagnostics.summary
            ]
          })
        ]
      }),
      content === null ? /* @__PURE__ */ jsx_runtime33.jsxs(Note, {
        tone: "err",
        children: [
          /* @__PURE__ */ jsx_runtime33.jsx(InvalidArg, {
            what: "content"
          }),
          " — expected string"
        ]
      }) : content && /* @__PURE__ */ jsx_runtime33.jsx(CodeBlock, {
        code: content,
        lang: path ? languageFromPath(path) : null,
        maxLines: 12
      }),
      /* @__PURE__ */ jsx_runtime33.jsx(ResultText, {
        result,
        maxLines: 4
      }),
      diagnostics && diagnostics.messages.length > 0 && /* @__PURE__ */ jsx_runtime33.jsx(Output, {
        text: diagnostics.messages.join(`
`),
        title: "diagnostics",
        error: diagnostics.errored,
        maxLines: 8
      })
    ]
  });
}
var writeRenderer = { Summary: Summary29, Body: Body29 };

// src/components/transcript/tool-views/tools/yield.tsx
var jsx_runtime34 = __toESM(require_jsx_runtime(), 1);
function Summary30({ args }) {
  return /* @__PURE__ */ jsx_runtime34.jsx("span", {
    children: argsDigest(args.data ?? args)
  });
}
function Body30({ args, result }) {
  let dataText = "";
  if (args.data !== undefined) {
    try {
      dataText = JSON.stringify(args.data, null, 2) ?? "";
    } catch {
      dataText = String(args.data);
    }
  }
  return /* @__PURE__ */ jsx_runtime34.jsxs(jsx_runtime34.Fragment, {
    children: [
      dataText && /* @__PURE__ */ jsx_runtime34.jsx(Output, {
        text: dataText,
        lang: "json",
        variant: "code",
        maxLines: 12
      }),
      /* @__PURE__ */ jsx_runtime34.jsx(ResultText, {
        result,
        maxLines: 6
      })
    ]
  });
}
var yieldRenderer = { Summary: Summary30, Body: Body30 };

// src/components/transcript/tool-views/registry.ts
var RENDERERS = {
  ask: askRenderer,
  ast_edit: astEditRenderer,
  ast_grep: astGrepRenderer,
  bash: bashRenderer,
  browser: browserRenderer,
  puppeteer: browserRenderer,
  debug: debugRenderer,
  edit: editRenderer,
  apply_patch: editRenderer,
  eval: evalRenderer,
  js: evalRenderer,
  python: evalRenderer,
  notebook: evalRenderer,
  fetch: fetchRenderer,
  glob: globRenderer,
  find: globRenderer,
  generate_image: generateImageRenderer,
  github: githubRenderer,
  goal: goalRenderer,
  hub: hubRenderer,
  irc: ircRenderer,
  job: jobRenderer,
  await: jobRenderer,
  poll: jobRenderer,
  cancel_job: jobRenderer,
  lsp: lspRenderer,
  recall: recallRenderer,
  reflect: reflectRenderer,
  retain: retainRenderer,
  read: readRenderer,
  report_tool_issue: reportToolIssueRenderer,
  resolve: resolveRenderer,
  reject: resolveRenderer,
  propose: resolveRenderer,
  grep: grepRenderer,
  search: grepRenderer,
  task: taskRenderer,
  todo: todoRenderer,
  web_search: webSearchRenderer,
  write: writeRenderer,
  yield: yieldRenderer
};
function resolveToolRenderer(name) {
  return RENDERERS[name] ?? genericRenderer;
}

// src/components/transcript/tool-views/ToolView.tsx
var jsx_runtime35 = __toESM(require_jsx_runtime(), 1);
function normalizeArgs(raw) {
  if (!isRecord(raw))
    return { args: {}, intent: undefined };
  const intent = typeof raw[INTENT_FIELD] === "string" ? raw[INTENT_FIELD].trim() : undefined;
  if (!(INTENT_FIELD in raw))
    return { args: raw, intent };
  const args = {};
  for (const k in raw) {
    if (k !== INTENT_FIELD)
      args[k] = raw[k];
  }
  return { args, intent };
}
function executeXdevDispatch(props) {
  if (props.name !== "write" || props.result?.isError === true || !isRecord(props.result?.details))
    return null;
  const xdev = props.result.details.xdev;
  if (!isRecord(xdev) || xdev.mode !== "execute" || typeof xdev.tool !== "string")
    return null;
  return { tool: xdev.tool, args: isRecord(xdev.args) ? xdev.args : {}, inner: xdev.inner };
}
function ToolView(props) {
  const xdev = executeXdevDispatch(props);
  const { args, intent: argIntent } = normalizeArgs(props.args);
  const intent = props.intent?.trim() || argIntent;
  const name = xdev?.tool ?? props.name;
  const live = props.running && !props.result && props.liveDetails !== undefined;
  const result = xdev ? { content: props.result.content, details: xdev.inner, isError: props.result.isError } : live ? { content: [], details: props.liveDetails } : props.result;
  const renderer = resolveToolRenderer(name);
  const [override, setOverride] = import_react9.useState(null);
  const base = props.defaultOpen ?? renderer.defaultOpen ?? false;
  const open = override !== null && override.base === base ? override.open : base;
  const setOpen = (fn) => setOverride({ base, open: fn(open) });
  const renderProps = {
    name,
    args: xdev?.args ?? args,
    result,
    running: props.running,
    host: props.host,
    groupCount: props.groupCount
  };
  const isError = props.result?.isError === true;
  const status = props.running ? "run" : isError ? "err" : props.result ? "ok" : "pending";
  const partial = props.running && !props.result && props.partial ? stripAnsi(replaceTabs(props.partial)) : "";
  return /* @__PURE__ */ jsx_runtime35.jsxs("div", {
    className: `tv-card${isError ? " tv-card--error" : ""}`,
    children: [
      /* @__PURE__ */ jsx_runtime35.jsxs("button", {
        type: "button",
        className: "tv-head",
        "aria-expanded": open,
        onClick: () => setOpen((v) => !v),
        title: intent || undefined,
        children: [
          status === "run" ? /* @__PURE__ */ jsx_runtime35.jsx("span", {
            className: "tv-spin",
            "aria-label": "running"
          }) : /* @__PURE__ */ jsx_runtime35.jsx("span", {
            className: `tv-status tv-status--${status}`,
            "aria-hidden": "true"
          }),
          /* @__PURE__ */ jsx_runtime35.jsx("span", {
            className: "tv-name",
            children: xdev ? `xd://${name}` : name
          }),
          /* @__PURE__ */ jsx_runtime35.jsx("span", {
            className: "tv-sum",
            children: /* @__PURE__ */ jsx_runtime35.jsx(renderer.Summary, {
              ...renderProps
            })
          }),
          /* @__PURE__ */ jsx_runtime35.jsx("span", {
            className: "tv-chev",
            "aria-hidden": "true"
          })
        ]
      }),
      open && /* @__PURE__ */ jsx_runtime35.jsxs("div", {
        className: "tv-body",
        children: [
          intent && /* @__PURE__ */ jsx_runtime35.jsx("div", {
            className: "tv-intent",
            children: intent
          }),
          renderer.Body ? /* @__PURE__ */ jsx_runtime35.jsx(renderer.Body, {
            ...renderProps
          }) : null
        ]
      }),
      partial && /* @__PURE__ */ jsx_runtime35.jsx("pre", {
        className: "tv-partial",
        children: partial.length > 2048 ? `…${partial.slice(-2048)}` : partial
      })
    ]
  });
}
// src/components/transcript/ToolCard.tsx
var jsx_runtime36 = __toESM(require_jsx_runtime(), 1);
var ToolCard = import_react10.memo(function ToolCard2(props) {
  const { name, intent, args, result, running, partialResult, liveDetails, host, expandAll, groupCount } = props;
  const partial = running && !result ? typeof partialResult === "string" ? partialResult : messageText2(partialResult) : "";
  return /* @__PURE__ */ jsx_runtime36.jsx(ToolView, {
    name,
    args,
    result,
    running,
    intent,
    liveDetails,
    partial: partial || undefined,
    host,
    defaultOpen: expandAll ? true : undefined,
    groupCount
  });
});

// src/components/transcript/rows/DeveloperRow.tsx
var import_react11 = __toESM(require_react(), 1);
var jsx_runtime37 = __toESM(require_jsx_runtime(), 1);
var DeveloperRow = import_react11.memo(function DeveloperRow2({
  content,
  timestamp,
  label
}) {
  const [open, setOpen] = import_react11.useState(false);
  const preview = content.length > 120 ? content.slice(0, 120) + "..." : content;
  return /* @__PURE__ */ jsx_runtime37.jsxs("div", {
    className: "tr-row tr-row--developer",
    title: timestamp,
    children: [
      /* @__PURE__ */ jsx_runtime37.jsxs("button", {
        type: "button",
        className: "tr-developer-toggle",
        "aria-expanded": open,
        onClick: () => setOpen((v) => !v),
        children: [
          /* @__PURE__ */ jsx_runtime37.jsx("span", {
            className: "tr-developer-label",
            children: label ?? "system"
          }),
          !open && label === undefined && /* @__PURE__ */ jsx_runtime37.jsx("span", {
            className: "tr-developer-preview",
            children: preview
          })
        ]
      }),
      open && /* @__PURE__ */ jsx_runtime37.jsx("pre", {
        className: "tr-developer-body",
        children: content
      })
    ]
  });
});

// src/components/transcript/rows/ThinkingRow.tsx
var import_react12 = __toESM(require_react(), 1);
var jsx_runtime38 = __toESM(require_jsx_runtime(), 1);
var ThinkingRow = import_react12.memo(function ThinkingRow2({
  text,
  redacted,
  expandAll
}) {
  const [open, setOpen] = import_react12.useState(false);
  const expanded = expandAll || open;
  return /* @__PURE__ */ jsx_runtime38.jsxs("div", {
    className: "tr-thinking",
    children: [
      /* @__PURE__ */ jsx_runtime38.jsxs("button", {
        type: "button",
        className: "tr-think-head",
        "aria-expanded": expanded,
        onClick: () => setOpen((v) => !v),
        children: [
          /* @__PURE__ */ jsx_runtime38.jsx(ChevronRight, {
            size: 14,
            className: `tr-chev${expanded ? " tr-chev--open" : ""}`
          }),
          redacted ? "thinking (redacted)" : "thinking"
        ]
      }),
      expanded && !redacted && text.length > 0 && /* @__PURE__ */ jsx_runtime38.jsx("div", {
        className: "tr-think-body",
        children: text
      })
    ]
  });
});

// src/components/transcript/rows/UserRow.tsx
var import_react14 = __toESM(require_react(), 1);

// src/components/transcript/SpeakButton.tsx
var import_react13 = __toESM(require_react(), 1);
var jsx_runtime39 = __toESM(require_jsx_runtime(), 1);
var SpeakButton = import_react13.memo(function SpeakButton2({ text, className }) {
  const state = import_react13.useSyncExternalStore(subscribeWren, getWrenState, getWrenState);
  const ownRef = import_react13.useRef(false);
  const showStop = state.speaking && ownRef.current;
  if (!state.speaking)
    ownRef.current = false;
  const handleClick = import_react13.useCallback((e) => {
    e.stopPropagation();
    if (showStop) {
      stopSpeaking();
      return;
    }
    ownRef.current = true;
    speakText(text);
  }, [showStop, text]);
  const label = showStop ? "Stop speaking" : state.error ?? "Speak";
  return /* @__PURE__ */ jsx_runtime39.jsx("button", {
    type: "button",
    className: className ? `tr-copy-btn tr-speak-btn ${className}` : "tr-copy-btn tr-speak-btn",
    onClick: handleClick,
    "aria-label": showStop ? "Stop speaking" : "Speak",
    title: label,
    children: showStop ? /* @__PURE__ */ jsx_runtime39.jsx(Square, {
      size: 13,
      className: "tr-copy-icon",
      "aria-hidden": "true"
    }) : /* @__PURE__ */ jsx_runtime39.jsx(Volume2, {
      size: 13,
      className: "tr-copy-icon",
      "aria-hidden": "true"
    })
  });
});

// src/components/transcript/rows/UserRow.tsx
var jsx_runtime40 = __toESM(require_jsx_runtime(), 1);
function MsgContent({ content }) {
  if (typeof content === "string")
    return /* @__PURE__ */ jsx_runtime40.jsx(Markdown, {
      text: content,
      magicWords: true
    });
  const parts = [];
  for (let i = 0;i < content.length; i++) {
    const block = content[i];
    if (block.type === "text") {
      parts.push(/* @__PURE__ */ jsx_runtime40.jsx(Markdown, {
        text: block.text,
        magicWords: true
      }, i));
    } else if (block.type === "image") {
      const src = "data" in block && typeof block.data === "string" ? `data:${block.mimeType ?? "image/png"};base64,${block.data}` : undefined;
      if (src)
        parts.push(/* @__PURE__ */ jsx_runtime40.jsx("img", {
          className: "tr-msg-img",
          src,
          alt: ""
        }, i));
    }
  }
  return /* @__PURE__ */ jsx_runtime40.jsx(jsx_runtime40.Fragment, {
    children: parts
  });
}
var UserRow = import_react14.memo(function UserRow2({
  content,
  timestamp,
  pending,
  entryId,
  reaction,
  onRewind,
  canRewind = true
}) {
  const [armed, setArmed] = import_react14.useState(false);
  const timerRef = import_react14.useRef(null);
  import_react14.useEffect(() => {
    if (armed) {
      timerRef.current = setTimeout(() => setArmed(false), 4000);
    }
    return () => {
      clearTimeout(timerRef.current ?? undefined);
    };
  }, [armed]);
  const speakable = typeof content === "string" ? content : content.filter((b) => b.type === "text").map((b) => b.text).join(`

`);
  const handleRewind = import_react14.useCallback((e) => {
    e.stopPropagation();
    if (!canRewind || !entryId || !onRewind)
      return;
    if (!armed) {
      setArmed(true);
      return;
    }
    clearTimeout(timerRef.current ?? undefined);
    timerRef.current = null;
    setArmed(false);
    onRewind(entryId);
  }, [armed, canRewind, entryId, onRewind]);
  return /* @__PURE__ */ jsx_runtime40.jsx("div", {
    className: pending ? "tr-row tr-row--user tr-row--pending" : "tr-row tr-row--user",
    title: timestamp,
    children: /* @__PURE__ */ jsx_runtime40.jsxs("div", {
      className: "tr-user-wrapper",
      children: [
        /* @__PURE__ */ jsx_runtime40.jsxs("div", {
          className: "tr-body",
          children: [
            /* @__PURE__ */ jsx_runtime40.jsx(MsgContent, {
              content
            }),
            !pending && reaction && /* @__PURE__ */ jsx_runtime40.jsx("span", {
              className: "tr-reaction",
              role: "img",
              "aria-label": `Agent reacted ${reaction}`,
              children: reaction
            })
          ]
        }),
        !pending && (speakable.trim() || entryId && onRewind) && /* @__PURE__ */ jsx_runtime40.jsxs("div", {
          className: "tr-user-actions",
          children: [
            speakable.trim() && /* @__PURE__ */ jsx_runtime40.jsx(SpeakButton, {
              text: speakable
            }),
            entryId && onRewind && /* @__PURE__ */ jsx_runtime40.jsxs("button", {
              type: "button",
              className: `tr-rewind-btn${armed ? " tr-rewind-btn--armed" : ""}`,
              onClick: handleRewind,
              disabled: !canRewind,
              "aria-label": armed ? "Confirm rewind to this message" : "Rewind to this message",
              title: armed ? "Tap again to confirm rewind" : "Rewind to this message",
              children: [
                /* @__PURE__ */ jsx_runtime40.jsx(RotateCcw, {
                  size: 13
                }),
                /* @__PURE__ */ jsx_runtime40.jsx("span", {
                  children: armed ? "Confirm rewind?" : "Rewind"
                })
              ]
            })
          ]
        })
      ]
    })
  });
});

// src/components/transcript/Transcript.tsx
var jsx_runtime41 = __toESM(require_jsx_runtime(), 1);
var RowRenderer = import_react15.memo(function RowRenderer2({
  item,
  expandAll,
  onRewind,
  canRewind,
  onRetry,
  host,
  canRetry
}) {
  switch (item.kind) {
    case "user":
      return /* @__PURE__ */ jsx_runtime41.jsx(UserRow, {
        content: item.content,
        timestamp: item.timestamp,
        pending: item.pending,
        entryId: item.entryId,
        reaction: item.reaction,
        onRewind,
        canRewind
      });
    case "assistant-text":
      if (!item.text)
        return null;
      return /* @__PURE__ */ jsx_runtime41.jsxs("div", {
        className: "tr-row tr-row--assistant",
        children: [
          /* @__PURE__ */ jsx_runtime41.jsx("div", {
            className: "tr-body",
            children: /* @__PURE__ */ jsx_runtime41.jsx(Markdown, {
              text: item.text
            })
          }),
          /* @__PURE__ */ jsx_runtime41.jsx("div", {
            className: "tr-assistant-actions",
            children: /* @__PURE__ */ jsx_runtime41.jsx(SpeakButton, {
              text: item.text
            })
          })
        ]
      });
    case "assistant-image": {
      const src = item.source;
      const data = typeof src.data === "string" ? src.data : "";
      const mime = typeof src.media_type === "string" ? src.media_type : "image/png";
      const imgSrc = data ? `data:${mime};base64,${data}` : undefined;
      return imgSrc ? /* @__PURE__ */ jsx_runtime41.jsx("div", {
        className: "tr-row tr-row--assistant",
        children: /* @__PURE__ */ jsx_runtime41.jsx("div", {
          className: "tr-body",
          children: /* @__PURE__ */ jsx_runtime41.jsx("img", {
            className: "tr-msg-img",
            src: imgSrc,
            alt: ""
          })
        })
      }) : null;
    }
    case "thinking":
      return /* @__PURE__ */ jsx_runtime41.jsx(ThinkingRow, {
        text: item.text,
        redacted: item.redacted,
        expandAll
      });
    case "tool-call":
      return /* @__PURE__ */ jsx_runtime41.jsx("div", {
        className: "tr-row tr-row--assistant",
        children: /* @__PURE__ */ jsx_runtime41.jsx("div", {
          className: "tr-body",
          children: /* @__PURE__ */ jsx_runtime41.jsx(ToolCard, {
            toolCallId: item.toolCallId,
            name: item.name,
            args: item.args,
            intent: item.intent,
            result: item.result,
            running: item.running,
            partialResult: item.partialResult,
            liveDetails: item.liveDetails,
            expandAll,
            host,
            groupCount: item.groupCount
          })
        })
      });
    case "developer":
      return /* @__PURE__ */ jsx_runtime41.jsx(DeveloperRow, {
        content: item.content,
        timestamp: item.timestamp,
        label: item.label
      });
    case "divider":
      return /* @__PURE__ */ jsx_runtime41.jsx("div", {
        className: "tr-divider",
        title: item.detail,
        children: /* @__PURE__ */ jsx_runtime41.jsx("span", {
          children: item.label
        })
      });
    case "marker":
      return /* @__PURE__ */ jsx_runtime41.jsx("div", {
        className: "tr-row tr-row--marker",
        children: /* @__PURE__ */ jsx_runtime41.jsx("span", {
          className: "tr-marker",
          children: item.text
        })
      });
    case "stop":
      return /* @__PURE__ */ jsx_runtime41.jsxs("div", {
        className: "tr-stop",
        children: [
          /* @__PURE__ */ jsx_runtime41.jsx("span", {
            className: `tr-chip ${item.reason === "error" ? "tr-chip--err" : "tr-chip--warn"}`,
            children: item.reason
          }),
          item.errorMessage !== undefined && item.errorMessage.length > 0 && /* @__PURE__ */ jsx_runtime41.jsx("span", {
            className: "tr-stop-msg",
            children: item.errorMessage
          }),
          onRetry && (item.reason === "error" || item.reason === "aborted") && /* @__PURE__ */ jsx_runtime41.jsx("button", {
            type: "button",
            className: "tr-retry-btn",
            onClick: onRetry,
            disabled: !canRetry,
            "aria-label": "Retry failed turn",
            children: "Retry"
          })
        ]
      });
    case "shimmer":
      return /* @__PURE__ */ jsx_runtime41.jsx("div", {
        className: "tr-row tr-row--assistant",
        children: /* @__PURE__ */ jsx_runtime41.jsx("div", {
          className: "tr-shimmer",
          children: "thinking..."
        })
      });
  }
});
var LOAD_OLDER_THRESHOLD_PX = 1500;
function shouldAdjustScrollOnItemSizeChange(item, hasCachedSize, scrollOffset, scrollAdjustments, scrollDirection) {
  if (!hasCachedSize) {
    return false;
  }
  const scrollOffsetWithAdj = scrollOffset + scrollAdjustments;
  return item.end <= scrollOffsetWithAdj && scrollDirection !== "backward";
}
function TranscriptView({
  state,
  historyLoaded = true,
  connection = "ready",
  streaming,
  expandAll,
  onLoadOlder,
  onRewind,
  onRetry,
  toolHost
}) {
  const { entries: entries2, live, activeTools, working, pendingUser, entryKeys } = state;
  const results = import_react15.useMemo(() => extractToolResults(entries2), [entries2]);
  const isWorking = working || streaming;
  const items = import_react15.useMemo(() => flattenEntries(entries2, results, activeTools, live, isWorking, pendingUser, entryKeys), [entries2, results, activeTools, live, isWorking, pendingUser, entryKeys]);
  const parentRef = import_react15.useRef(null);
  const atBottomRef = import_react15.useRef(true);
  const loadingOlderRef = import_react15.useRef(false);
  const [isLoadingOlder, setIsLoadingOlder] = import_react15.useState(false);
  const [unreadCount, setUnreadCount] = import_react15.useState(0);
  const prevItemCountRef = import_react15.useRef(items.length);
  const prevFirstItemIdRef = import_react15.useRef(items[0]?.id);
  const itemsRef = import_react15.useRef(items);
  itemsRef.current = items;
  const getItemKey = import_react15.useCallback((index2) => itemsRef.current[index2]?.id ?? index2, []);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120,
    getItemKey,
    anchorTo: "end",
    overscan: 8,
    paddingEnd: 16,
    scrollPaddingEnd: 16,
    useAnimationFrameWithResizeObserver: true
  });
  virtualizer.shouldAdjustScrollPositionOnItemSizeChange = (item, _delta, instance2) => shouldAdjustScrollOnItemSizeChange(item, instance2.itemSizeCache.has(item.key), instance2.scrollOffset ?? 0, instance2.scrollAdjustments, instance2.scrollDirection);
  const checkAtBottom = import_react15.useCallback(() => {
    const el = parentRef.current;
    if (!el)
      return;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    const wasAtBottom = atBottomRef.current;
    atBottomRef.current = gap <= 60;
    if (atBottomRef.current && !wasAtBottom) {
      setUnreadCount(0);
    }
  }, []);
  const prevPendingCountRef = import_react15.useRef(pendingUser.length);
  import_react15.useEffect(() => {
    const userSentMessage = pendingUser.length > prevPendingCountRef.current;
    prevPendingCountRef.current = pendingUser.length;
    if (userSentMessage) {
      atBottomRef.current = true;
      setUnreadCount(0);
    }
    const totalAdded = items.length - prevItemCountRef.current;
    const prependIndex = prevFirstItemIdRef.current !== undefined ? items.findIndex((it) => it.id === prevFirstItemIdRef.current) : -1;
    const prependedCount = prependIndex > 0 ? prependIndex : 0;
    const appendedCount = Math.max(0, totalAdded - prependedCount);
    const countChanged = items.length !== prevItemCountRef.current;
    if (atBottomRef.current && items.length > 0) {
      if (countChanged || userSentMessage) {
        virtualizer.scrollToIndex(items.length - 1, { align: "end" });
        requestAnimationFrame(() => {
          if (parentRef.current && atBottomRef.current) {
            parentRef.current.scrollTop = parentRef.current.scrollHeight;
          }
        });
      }
    } else if (appendedCount > 0 && !atBottomRef.current) {
      setUnreadCount((c) => c + appendedCount);
    }
    prevItemCountRef.current = items.length;
    prevFirstItemIdRef.current = items[0]?.id;
  }, [items.length, pendingUser.length, virtualizer]);
  const totalSize = virtualizer.getTotalSize();
  import_react15.useEffect(() => {
    const el = parentRef.current;
    if (el && atBottomRef.current)
      el.scrollTop = Number.MAX_SAFE_INTEGER;
  }, [totalSize]);
  const hasMore = state.hasMore;
  const requestOlder = import_react15.useCallback(() => {
    if (!onLoadOlder || !hasMore || loadingOlderRef.current)
      return;
    loadingOlderRef.current = true;
    setIsLoadingOlder(true);
    onLoadOlder().finally(() => {
      loadingOlderRef.current = false;
      setIsLoadingOlder(false);
    });
  }, [onLoadOlder, hasMore]);
  import_react15.useEffect(() => {
    const el = parentRef.current;
    if (!el || !onLoadOlder)
      return;
    const handler = () => {
      checkAtBottom();
      if (el.scrollTop <= LOAD_OLDER_THRESHOLD_PX)
        requestOlder();
    };
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, [onLoadOlder, checkAtBottom, requestOlder]);
  import_react15.useEffect(() => {
    const el = parentRef.current;
    if (el && el.scrollHeight <= el.clientHeight)
      requestOlder();
  }, [items.length, hasMore, requestOlder]);
  import_react15.useEffect(() => {
    if (onLoadOlder)
      return;
    const el = parentRef.current;
    if (!el)
      return;
    const handler = () => checkAtBottom();
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, [onLoadOlder, checkAtBottom]);
  const jumpToBottom = import_react15.useCallback(() => {
    virtualizer.scrollToIndex(items.length - 1, { align: "end" });
    atBottomRef.current = true;
    setUnreadCount(0);
  }, [virtualizer, items.length]);
  const virtualItems = virtualizer.getVirtualItems();
  return /* @__PURE__ */ jsx_runtime41.jsxs("div", {
    className: "tr-root",
    ref: parentRef,
    children: [
      isLoadingOlder && /* @__PURE__ */ jsx_runtime41.jsx("div", {
        className: "tr-loading-older",
        role: "status",
        "aria-label": "Loading older messages",
        children: /* @__PURE__ */ jsx_runtime41.jsx("span", {
          className: "tr-spin",
          "aria-hidden": "true"
        })
      }),
      items.length === 0 && (historyLoaded ? /* @__PURE__ */ jsx_runtime41.jsx("div", {
        className: "tr-empty",
        children: "no activity yet"
      }) : /* @__PURE__ */ jsx_runtime41.jsxs("div", {
        className: "tr-empty tr-empty--loading",
        role: "status",
        "aria-live": "polite",
        children: [
          /* @__PURE__ */ jsx_runtime41.jsx("span", {
            className: "tr-spin tr-spin--lg",
            "aria-hidden": "true"
          }),
          /* @__PURE__ */ jsx_runtime41.jsx("span", {
            children: connection === "ready" ? "Loading history…" : "Connecting…"
          })
        ]
      })),
      /* @__PURE__ */ jsx_runtime41.jsx("div", {
        className: "tr-virtual-space",
        style: { height: `${totalSize}px` },
        children: virtualItems.map((virtualRow) => {
          const item = items[virtualRow.index];
          return /* @__PURE__ */ jsx_runtime41.jsx("div", {
            "data-index": virtualRow.index,
            ref: virtualizer.measureElement,
            className: "tr-virtual-row",
            style: { transform: `translateY(${virtualRow.start}px)` },
            children: /* @__PURE__ */ jsx_runtime41.jsx(RowRenderer, {
              item,
              expandAll,
              host: toolHost,
              onRewind,
              canRewind: !isWorking,
              onRetry,
              canRetry: !isWorking
            })
          }, item.id);
        })
      }),
      !atBottomRef.current && unreadCount > 0 && /* @__PURE__ */ jsx_runtime41.jsxs("button", {
        type: "button",
        className: "tr-jump-bottom",
        onClick: jumpToBottom,
        "aria-label": "Jump to bottom",
        children: [
          /* @__PURE__ */ jsx_runtime41.jsx(ArrowDown, {
            size: 16
          }),
          unreadCount > 0 && /* @__PURE__ */ jsx_runtime41.jsx("span", {
            className: "tr-jump-count",
            children: unreadCount
          })
        ]
      })
    ]
  });
}

export { require_react, require_react_dom, browserWindow, browserDocument, triggerBlobDownload, EMPTY_SUBAGENT_STATE, SUBAGENT_SUBSCRIBE_COMMAND, applySubagentEvent, subagentTreeFromSnapshots, mergeSubagentSnapshots, MAIN_AGENT_ID, agentIdLabel, EMPTY_AGENT_HUB_STATE, entryMetrics, applyRoster, applyRegistryFrame, applySubagentProgress, applySubagentLifecycle, buildHubRows, childrenOf, parentOf, computeTotals, emptyHubTranscript, applyTranscriptChunk, fmtTokens, fmtCost, fmtDuration, relTime, sendPrompt, steer, followUp, abortAndRestoreQueue, restoreClearedMessagesToDraft, setModel, setThinkingLevel, setModelRole, deleteModelRole, setCycleOrder, setModelTag, refreshModels, cycleRoleModel, setAgentModel, setAgentEnabled, setAgentServiceTier, setAgentPrewalk, setAgentAdvisor, loginStart, loginInput, loginCancel, btw, btwCancel, getBtwHistory, logout, setSessionName, branch, compact, handoff, newSession, clearContext, retry, getUsageReports, getResetCredits, redeemResetCredit, setPlanMode, approvePlan, killAgent, reviveAgent, steerAgent, interruptAgent, getSubagentMessages, emptyTranscriptState, oldestEntryId, currentLeafId, addPendingUser, clearPendingUser, clearAllPendingUser, resetTranscriptForResync, applyHistoryPage, applyV3Event, applyTranscriptEvent, startFocus, resetFocusCursor, applyFocusChunk, applyFocusEvent, applyFocusSnapshot, eventPersistsEntries, isFocusable, initialFocusWatch, watchFocusedAgent, detachMessage, viewingMessage, gateFocusedSubmit, escapeAction, createStore, get, set, del, entries, notify, subscribeNotices, getNotices, dismissNotice, formatRoman, countTodoProgress, cycleTaskStatus, updateTaskStatus, extractTodoPhasesFromEvent, getLatestTodoPhasesFromEntries, EllipsisVertical, PanelLeft, RotateCcwClock, Trash, Bot, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Copy, Ghost, Info, Lock, PanelRight, Pencil, Plus, RefreshCw, RotateCw, SlidersHorizontal, Volume2, VolumeX, X, draftKey, readDraft, writeDraft, onDraftsHydrated, hydrateDrafts, require_jsx_runtime, getWrenState, subscribeWren, enableVoice, disableVoice, claimOnInput, useVirtualizer, Markdown, TranscriptView };

//# debugId=CB6BD0A3DA2D482D64756E2164756E21
