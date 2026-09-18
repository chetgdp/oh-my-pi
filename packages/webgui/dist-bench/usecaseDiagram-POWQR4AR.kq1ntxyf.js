import {
  getDiagramElement
} from "./main.5hz5w69k.js";
import {
  getRegisteredLayoutAlgorithm,
  render
} from "./main.121dz2jd.js";
import {
  setupViewPortForSVG
} from "./main.vrhqq75x.js";
import"./main.a0d2qkjp.js";
import"./main.f14a3m6m.js";
import"./main.bbv1vxf8.js";
import"./main.nz9j4bh7.js";
import"./main.355gmh91.js";
import"./main.qk7vkn75.js";
import"./main.et147x61.js";
import {
  hasPalette,
  isColorTheme,
  paletteSlotCount,
  safeLook
} from "./main.0650d635.js";
import {
  markdownToLines
} from "./main.3sfjnb2j.js";
import"./main.a3f4eb3v.js";
import {
  utils_default
} from "./main.e59dxsqf.js";
import"./main.3b4ykqkz.js";
import {
  clear,
  defaultConfig_default,
  getAccDescription,
  getAccTitle,
  getConfig,
  getConfig2,
  getDiagramTitle,
  sanitizeText,
  setAccDescription,
  setAccTitle,
  setDiagramTitle
} from "./main.rtmrfd4t.js";
import {
  log,
  select_default
} from "./main.c4pgnk9s.js";
import {
  __name
} from "./main.y98k7yqz.js";
import {
  __export
} from "./main.5hz6q5qz.js";
// ../../node_modules/lodash-es/_freeGlobal.js
var freeGlobal = typeof global == "object" && global && global.Object === Object && global;
var _freeGlobal_default = freeGlobal;

// ../../node_modules/lodash-es/_root.js
var freeSelf = typeof self == "object" && self && self.Object === Object && self;
var root = _freeGlobal_default || freeSelf || Function("return this")();
var _root_default = root;

// ../../node_modules/lodash-es/_Symbol.js
var Symbol = _root_default.Symbol;
var _Symbol_default = Symbol;

// ../../node_modules/lodash-es/_getRawTag.js
var objectProto = Object.prototype;
var hasOwnProperty = objectProto.hasOwnProperty;
var nativeObjectToString = objectProto.toString;
var symToStringTag = _Symbol_default ? _Symbol_default.toStringTag : undefined;
function getRawTag(value) {
  var isOwn = hasOwnProperty.call(value, symToStringTag), tag = value[symToStringTag];
  try {
    value[symToStringTag] = undefined;
    var unmasked = true;
  } catch (e) {}
  var result = nativeObjectToString.call(value);
  if (unmasked) {
    if (isOwn) {
      value[symToStringTag] = tag;
    } else {
      delete value[symToStringTag];
    }
  }
  return result;
}
var _getRawTag_default = getRawTag;

// ../../node_modules/lodash-es/_objectToString.js
var objectProto2 = Object.prototype;
var nativeObjectToString2 = objectProto2.toString;
function objectToString(value) {
  return nativeObjectToString2.call(value);
}
var _objectToString_default = objectToString;

// ../../node_modules/lodash-es/_baseGetTag.js
var nullTag = "[object Null]";
var undefinedTag = "[object Undefined]";
var symToStringTag2 = _Symbol_default ? _Symbol_default.toStringTag : undefined;
function baseGetTag(value) {
  if (value == null) {
    return value === undefined ? undefinedTag : nullTag;
  }
  return symToStringTag2 && symToStringTag2 in Object(value) ? _getRawTag_default(value) : _objectToString_default(value);
}
var _baseGetTag_default = baseGetTag;

// ../../node_modules/lodash-es/isObject.js
function isObject(value) {
  var type = typeof value;
  return value != null && (type == "object" || type == "function");
}
var isObject_default = isObject;

// ../../node_modules/lodash-es/isFunction.js
var asyncTag = "[object AsyncFunction]";
var funcTag = "[object Function]";
var genTag = "[object GeneratorFunction]";
var proxyTag = "[object Proxy]";
function isFunction(value) {
  if (!isObject_default(value)) {
    return false;
  }
  var tag = _baseGetTag_default(value);
  return tag == funcTag || tag == genTag || tag == asyncTag || tag == proxyTag;
}
var isFunction_default = isFunction;

// ../../node_modules/lodash-es/_coreJsData.js
var coreJsData = _root_default["__core-js_shared__"];
var _coreJsData_default = coreJsData;

// ../../node_modules/lodash-es/_isMasked.js
var maskSrcKey = function() {
  var uid = /[^.]+$/.exec(_coreJsData_default && _coreJsData_default.keys && _coreJsData_default.keys.IE_PROTO || "");
  return uid ? "Symbol(src)_1." + uid : "";
}();
function isMasked(func) {
  return !!maskSrcKey && maskSrcKey in func;
}
var _isMasked_default = isMasked;

// ../../node_modules/lodash-es/_toSource.js
var funcProto = Function.prototype;
var funcToString = funcProto.toString;
function toSource(func) {
  if (func != null) {
    try {
      return funcToString.call(func);
    } catch (e) {}
    try {
      return func + "";
    } catch (e) {}
  }
  return "";
}
var _toSource_default = toSource;

// ../../node_modules/lodash-es/_baseIsNative.js
var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;
var reIsHostCtor = /^\[object .+?Constructor\]$/;
var funcProto2 = Function.prototype;
var objectProto3 = Object.prototype;
var funcToString2 = funcProto2.toString;
var hasOwnProperty2 = objectProto3.hasOwnProperty;
var reIsNative = RegExp("^" + funcToString2.call(hasOwnProperty2).replace(reRegExpChar, "\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$");
function baseIsNative(value) {
  if (!isObject_default(value) || _isMasked_default(value)) {
    return false;
  }
  var pattern = isFunction_default(value) ? reIsNative : reIsHostCtor;
  return pattern.test(_toSource_default(value));
}
var _baseIsNative_default = baseIsNative;

// ../../node_modules/lodash-es/_getValue.js
function getValue(object, key) {
  return object == null ? undefined : object[key];
}
var _getValue_default = getValue;

// ../../node_modules/lodash-es/_getNative.js
function getNative(object, key) {
  var value = _getValue_default(object, key);
  return _baseIsNative_default(value) ? value : undefined;
}
var _getNative_default = getNative;

// ../../node_modules/lodash-es/_defineProperty.js
var defineProperty = function() {
  try {
    var func = _getNative_default(Object, "defineProperty");
    func({}, "", {});
    return func;
  } catch (e) {}
}();
var _defineProperty_default = defineProperty;

// ../../node_modules/lodash-es/_baseAssignValue.js
function baseAssignValue(object, key, value) {
  if (key == "__proto__" && _defineProperty_default) {
    _defineProperty_default(object, key, {
      configurable: true,
      enumerable: true,
      value,
      writable: true
    });
  } else {
    object[key] = value;
  }
}
var _baseAssignValue_default = baseAssignValue;

// ../../node_modules/lodash-es/eq.js
function eq(value, other) {
  return value === other || value !== value && other !== other;
}
var eq_default = eq;

// ../../node_modules/lodash-es/_assignValue.js
var objectProto4 = Object.prototype;
var hasOwnProperty3 = objectProto4.hasOwnProperty;
function assignValue(object, key, value) {
  var objValue = object[key];
  if (!(hasOwnProperty3.call(object, key) && eq_default(objValue, value)) || value === undefined && !(key in object)) {
    _baseAssignValue_default(object, key, value);
  }
}
var _assignValue_default = assignValue;

// ../../node_modules/lodash-es/_copyObject.js
function copyObject(source, props, object, customizer) {
  var isNew = !object;
  object || (object = {});
  var index = -1, length = props.length;
  while (++index < length) {
    var key = props[index];
    var newValue = customizer ? customizer(object[key], source[key], key, object, source) : undefined;
    if (newValue === undefined) {
      newValue = source[key];
    }
    if (isNew) {
      _baseAssignValue_default(object, key, newValue);
    } else {
      _assignValue_default(object, key, newValue);
    }
  }
  return object;
}
var _copyObject_default = copyObject;

// ../../node_modules/lodash-es/identity.js
function identity(value) {
  return value;
}
var identity_default = identity;

// ../../node_modules/lodash-es/_apply.js
function apply(func, thisArg, args) {
  switch (args.length) {
    case 0:
      return func.call(thisArg);
    case 1:
      return func.call(thisArg, args[0]);
    case 2:
      return func.call(thisArg, args[0], args[1]);
    case 3:
      return func.call(thisArg, args[0], args[1], args[2]);
  }
  return func.apply(thisArg, args);
}
var _apply_default = apply;

// ../../node_modules/lodash-es/_overRest.js
var nativeMax = Math.max;
function overRest(func, start, transform) {
  start = nativeMax(start === undefined ? func.length - 1 : start, 0);
  return function() {
    var args = arguments, index = -1, length = nativeMax(args.length - start, 0), array = Array(length);
    while (++index < length) {
      array[index] = args[start + index];
    }
    index = -1;
    var otherArgs = Array(start + 1);
    while (++index < start) {
      otherArgs[index] = args[index];
    }
    otherArgs[start] = transform(array);
    return _apply_default(func, this, otherArgs);
  };
}
var _overRest_default = overRest;

// ../../node_modules/lodash-es/constant.js
function constant(value) {
  return function() {
    return value;
  };
}
var constant_default = constant;

// ../../node_modules/lodash-es/_baseSetToString.js
var baseSetToString = !_defineProperty_default ? identity_default : function(func, string) {
  return _defineProperty_default(func, "toString", {
    configurable: true,
    enumerable: false,
    value: constant_default(string),
    writable: true
  });
};
var _baseSetToString_default = baseSetToString;

// ../../node_modules/lodash-es/_shortOut.js
var HOT_COUNT = 800;
var HOT_SPAN = 16;
var nativeNow = Date.now;
function shortOut(func) {
  var count = 0, lastCalled = 0;
  return function() {
    var stamp = nativeNow(), remaining = HOT_SPAN - (stamp - lastCalled);
    lastCalled = stamp;
    if (remaining > 0) {
      if (++count >= HOT_COUNT) {
        return arguments[0];
      }
    } else {
      count = 0;
    }
    return func.apply(undefined, arguments);
  };
}
var _shortOut_default = shortOut;

// ../../node_modules/lodash-es/_setToString.js
var setToString = _shortOut_default(_baseSetToString_default);
var _setToString_default = setToString;

// ../../node_modules/lodash-es/_baseRest.js
function baseRest(func, start) {
  return _setToString_default(_overRest_default(func, start, identity_default), func + "");
}
var _baseRest_default = baseRest;

// ../../node_modules/lodash-es/isLength.js
var MAX_SAFE_INTEGER = 9007199254740991;
function isLength(value) {
  return typeof value == "number" && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}
var isLength_default = isLength;

// ../../node_modules/lodash-es/isArrayLike.js
function isArrayLike(value) {
  return value != null && isLength_default(value.length) && !isFunction_default(value);
}
var isArrayLike_default = isArrayLike;

// ../../node_modules/lodash-es/_isIndex.js
var MAX_SAFE_INTEGER2 = 9007199254740991;
var reIsUint = /^(?:0|[1-9]\d*)$/;
function isIndex(value, length) {
  var type = typeof value;
  length = length == null ? MAX_SAFE_INTEGER2 : length;
  return !!length && (type == "number" || type != "symbol" && reIsUint.test(value)) && (value > -1 && value % 1 == 0 && value < length);
}
var _isIndex_default = isIndex;

// ../../node_modules/lodash-es/_isIterateeCall.js
function isIterateeCall(value, index, object) {
  if (!isObject_default(object)) {
    return false;
  }
  var type = typeof index;
  if (type == "number" ? isArrayLike_default(object) && _isIndex_default(index, object.length) : type == "string" && (index in object)) {
    return eq_default(object[index], value);
  }
  return false;
}
var _isIterateeCall_default = isIterateeCall;

// ../../node_modules/lodash-es/_createAssigner.js
function createAssigner(assigner) {
  return _baseRest_default(function(object, sources) {
    var index = -1, length = sources.length, customizer = length > 1 ? sources[length - 1] : undefined, guard = length > 2 ? sources[2] : undefined;
    customizer = assigner.length > 3 && typeof customizer == "function" ? (length--, customizer) : undefined;
    if (guard && _isIterateeCall_default(sources[0], sources[1], guard)) {
      customizer = length < 3 ? undefined : customizer;
      length = 1;
    }
    object = Object(object);
    while (++index < length) {
      var source = sources[index];
      if (source) {
        assigner(object, source, index, customizer);
      }
    }
    return object;
  });
}
var _createAssigner_default = createAssigner;

// ../../node_modules/lodash-es/_isPrototype.js
var objectProto5 = Object.prototype;
function isPrototype(value) {
  var Ctor = value && value.constructor, proto = typeof Ctor == "function" && Ctor.prototype || objectProto5;
  return value === proto;
}
var _isPrototype_default = isPrototype;

// ../../node_modules/lodash-es/_baseTimes.js
function baseTimes(n, iteratee) {
  var index = -1, result = Array(n);
  while (++index < n) {
    result[index] = iteratee(index);
  }
  return result;
}
var _baseTimes_default = baseTimes;

// ../../node_modules/lodash-es/isObjectLike.js
function isObjectLike(value) {
  return value != null && typeof value == "object";
}
var isObjectLike_default = isObjectLike;

// ../../node_modules/lodash-es/_baseIsArguments.js
var argsTag = "[object Arguments]";
function baseIsArguments(value) {
  return isObjectLike_default(value) && _baseGetTag_default(value) == argsTag;
}
var _baseIsArguments_default = baseIsArguments;

// ../../node_modules/lodash-es/isArguments.js
var objectProto6 = Object.prototype;
var hasOwnProperty4 = objectProto6.hasOwnProperty;
var propertyIsEnumerable = objectProto6.propertyIsEnumerable;
var isArguments = _baseIsArguments_default(function() {
  return arguments;
}()) ? _baseIsArguments_default : function(value) {
  return isObjectLike_default(value) && hasOwnProperty4.call(value, "callee") && !propertyIsEnumerable.call(value, "callee");
};
var isArguments_default = isArguments;

// ../../node_modules/lodash-es/isArray.js
var isArray = Array.isArray;
var isArray_default = isArray;

// ../../node_modules/lodash-es/isBuffer.js
var exports_isBuffer = {};
__export(exports_isBuffer, {
  default: () => isBuffer_default
});

// ../../node_modules/lodash-es/stubFalse.js
function stubFalse() {
  return false;
}
var stubFalse_default = stubFalse;

// ../../node_modules/lodash-es/isBuffer.js
var freeExports = typeof exports_isBuffer == "object" && exports_isBuffer && !exports_isBuffer.nodeType && exports_isBuffer;
var freeModule = freeExports && typeof module_isBuffer == "object" && module_isBuffer && !module_isBuffer.nodeType && module_isBuffer;
var moduleExports = freeModule && freeModule.exports === freeExports;
var Buffer = moduleExports ? _root_default.Buffer : undefined;
var nativeIsBuffer = Buffer ? Buffer.isBuffer : undefined;
var isBuffer = nativeIsBuffer || stubFalse_default;
var isBuffer_default = isBuffer;

// ../../node_modules/lodash-es/_baseIsTypedArray.js
var argsTag2 = "[object Arguments]";
var arrayTag = "[object Array]";
var boolTag = "[object Boolean]";
var dateTag = "[object Date]";
var errorTag = "[object Error]";
var funcTag2 = "[object Function]";
var mapTag = "[object Map]";
var numberTag = "[object Number]";
var objectTag = "[object Object]";
var regexpTag = "[object RegExp]";
var setTag = "[object Set]";
var stringTag = "[object String]";
var weakMapTag = "[object WeakMap]";
var arrayBufferTag = "[object ArrayBuffer]";
var dataViewTag = "[object DataView]";
var float32Tag = "[object Float32Array]";
var float64Tag = "[object Float64Array]";
var int8Tag = "[object Int8Array]";
var int16Tag = "[object Int16Array]";
var int32Tag = "[object Int32Array]";
var uint8Tag = "[object Uint8Array]";
var uint8ClampedTag = "[object Uint8ClampedArray]";
var uint16Tag = "[object Uint16Array]";
var uint32Tag = "[object Uint32Array]";
var typedArrayTags = {};
typedArrayTags[float32Tag] = typedArrayTags[float64Tag] = typedArrayTags[int8Tag] = typedArrayTags[int16Tag] = typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] = typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] = typedArrayTags[uint32Tag] = true;
typedArrayTags[argsTag2] = typedArrayTags[arrayTag] = typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] = typedArrayTags[dataViewTag] = typedArrayTags[dateTag] = typedArrayTags[errorTag] = typedArrayTags[funcTag2] = typedArrayTags[mapTag] = typedArrayTags[numberTag] = typedArrayTags[objectTag] = typedArrayTags[regexpTag] = typedArrayTags[setTag] = typedArrayTags[stringTag] = typedArrayTags[weakMapTag] = false;
function baseIsTypedArray(value) {
  return isObjectLike_default(value) && isLength_default(value.length) && !!typedArrayTags[_baseGetTag_default(value)];
}
var _baseIsTypedArray_default = baseIsTypedArray;

// ../../node_modules/lodash-es/_baseUnary.js
function baseUnary(func) {
  return function(value) {
    return func(value);
  };
}
var _baseUnary_default = baseUnary;

// ../../node_modules/lodash-es/_nodeUtil.js
var exports__nodeUtil = {};
__export(exports__nodeUtil, {
  default: () => _nodeUtil_default
});
var freeExports2 = typeof exports__nodeUtil == "object" && exports__nodeUtil && !exports__nodeUtil.nodeType && exports__nodeUtil;
var freeModule2 = freeExports2 && typeof module__nodeUtil == "object" && module__nodeUtil && !module__nodeUtil.nodeType && module__nodeUtil;
var moduleExports2 = freeModule2 && freeModule2.exports === freeExports2;
var freeProcess = moduleExports2 && _freeGlobal_default.process;
var nodeUtil = function() {
  try {
    var types = freeModule2 && freeModule2.require && freeModule2.require("util").types;
    if (types) {
      return types;
    }
    return freeProcess && freeProcess.binding && freeProcess.binding("util");
  } catch (e) {}
}();
var _nodeUtil_default = nodeUtil;

// ../../node_modules/lodash-es/isTypedArray.js
var nodeIsTypedArray = _nodeUtil_default && _nodeUtil_default.isTypedArray;
var isTypedArray = nodeIsTypedArray ? _baseUnary_default(nodeIsTypedArray) : _baseIsTypedArray_default;
var isTypedArray_default = isTypedArray;

// ../../node_modules/lodash-es/_arrayLikeKeys.js
var objectProto7 = Object.prototype;
var hasOwnProperty5 = objectProto7.hasOwnProperty;
function arrayLikeKeys(value, inherited) {
  var isArr = isArray_default(value), isArg = !isArr && isArguments_default(value), isBuff = !isArr && !isArg && isBuffer_default(value), isType = !isArr && !isArg && !isBuff && isTypedArray_default(value), skipIndexes = isArr || isArg || isBuff || isType, result = skipIndexes ? _baseTimes_default(value.length, String) : [], length = result.length;
  for (var key in value) {
    if ((inherited || hasOwnProperty5.call(value, key)) && !(skipIndexes && (key == "length" || isBuff && (key == "offset" || key == "parent") || isType && (key == "buffer" || key == "byteLength" || key == "byteOffset") || _isIndex_default(key, length)))) {
      result.push(key);
    }
  }
  return result;
}
var _arrayLikeKeys_default = arrayLikeKeys;

// ../../node_modules/lodash-es/_overArg.js
function overArg(func, transform) {
  return function(arg) {
    return func(transform(arg));
  };
}
var _overArg_default = overArg;

// ../../node_modules/lodash-es/_nativeKeys.js
var nativeKeys = _overArg_default(Object.keys, Object);
var _nativeKeys_default = nativeKeys;

// ../../node_modules/lodash-es/_baseKeys.js
var objectProto8 = Object.prototype;
var hasOwnProperty6 = objectProto8.hasOwnProperty;
function baseKeys(object) {
  if (!_isPrototype_default(object)) {
    return _nativeKeys_default(object);
  }
  var result = [];
  for (var key in Object(object)) {
    if (hasOwnProperty6.call(object, key) && key != "constructor") {
      result.push(key);
    }
  }
  return result;
}
var _baseKeys_default = baseKeys;

// ../../node_modules/lodash-es/keys.js
function keys(object) {
  return isArrayLike_default(object) ? _arrayLikeKeys_default(object) : _baseKeys_default(object);
}
var keys_default = keys;

// ../../node_modules/lodash-es/assign.js
var objectProto9 = Object.prototype;
var hasOwnProperty7 = objectProto9.hasOwnProperty;
var assign = _createAssigner_default(function(object, source) {
  if (_isPrototype_default(source) || isArrayLike_default(source)) {
    _copyObject_default(source, keys_default(source), object);
    return;
  }
  for (var key in source) {
    if (hasOwnProperty7.call(source, key)) {
      _assignValue_default(object, key, source[key]);
    }
  }
});
var assign_default = assign;
// ../../node_modules/lodash-es/_listCacheClear.js
function listCacheClear() {
  this.__data__ = [];
  this.size = 0;
}
var _listCacheClear_default = listCacheClear;

// ../../node_modules/lodash-es/_assocIndexOf.js
function assocIndexOf(array, key) {
  var length = array.length;
  while (length--) {
    if (eq_default(array[length][0], key)) {
      return length;
    }
  }
  return -1;
}
var _assocIndexOf_default = assocIndexOf;

// ../../node_modules/lodash-es/_listCacheDelete.js
var arrayProto = Array.prototype;
var splice = arrayProto.splice;
function listCacheDelete(key) {
  var data = this.__data__, index = _assocIndexOf_default(data, key);
  if (index < 0) {
    return false;
  }
  var lastIndex = data.length - 1;
  if (index == lastIndex) {
    data.pop();
  } else {
    splice.call(data, index, 1);
  }
  --this.size;
  return true;
}
var _listCacheDelete_default = listCacheDelete;

// ../../node_modules/lodash-es/_listCacheGet.js
function listCacheGet(key) {
  var data = this.__data__, index = _assocIndexOf_default(data, key);
  return index < 0 ? undefined : data[index][1];
}
var _listCacheGet_default = listCacheGet;

// ../../node_modules/lodash-es/_listCacheHas.js
function listCacheHas(key) {
  return _assocIndexOf_default(this.__data__, key) > -1;
}
var _listCacheHas_default = listCacheHas;

// ../../node_modules/lodash-es/_listCacheSet.js
function listCacheSet(key, value) {
  var data = this.__data__, index = _assocIndexOf_default(data, key);
  if (index < 0) {
    ++this.size;
    data.push([key, value]);
  } else {
    data[index][1] = value;
  }
  return this;
}
var _listCacheSet_default = listCacheSet;

// ../../node_modules/lodash-es/_ListCache.js
function ListCache(entries) {
  var index = -1, length = entries == null ? 0 : entries.length;
  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}
ListCache.prototype.clear = _listCacheClear_default;
ListCache.prototype["delete"] = _listCacheDelete_default;
ListCache.prototype.get = _listCacheGet_default;
ListCache.prototype.has = _listCacheHas_default;
ListCache.prototype.set = _listCacheSet_default;
var _ListCache_default = ListCache;

// ../../node_modules/lodash-es/_stackClear.js
function stackClear() {
  this.__data__ = new _ListCache_default;
  this.size = 0;
}
var _stackClear_default = stackClear;

// ../../node_modules/lodash-es/_stackDelete.js
function stackDelete(key) {
  var data = this.__data__, result = data["delete"](key);
  this.size = data.size;
  return result;
}
var _stackDelete_default = stackDelete;

// ../../node_modules/lodash-es/_stackGet.js
function stackGet(key) {
  return this.__data__.get(key);
}
var _stackGet_default = stackGet;

// ../../node_modules/lodash-es/_stackHas.js
function stackHas(key) {
  return this.__data__.has(key);
}
var _stackHas_default = stackHas;

// ../../node_modules/lodash-es/_Map.js
var Map2 = _getNative_default(_root_default, "Map");
var _Map_default = Map2;

// ../../node_modules/lodash-es/_nativeCreate.js
var nativeCreate = _getNative_default(Object, "create");
var _nativeCreate_default = nativeCreate;

// ../../node_modules/lodash-es/_hashClear.js
function hashClear() {
  this.__data__ = _nativeCreate_default ? _nativeCreate_default(null) : {};
  this.size = 0;
}
var _hashClear_default = hashClear;

// ../../node_modules/lodash-es/_hashDelete.js
function hashDelete(key) {
  var result = this.has(key) && delete this.__data__[key];
  this.size -= result ? 1 : 0;
  return result;
}
var _hashDelete_default = hashDelete;

// ../../node_modules/lodash-es/_hashGet.js
var HASH_UNDEFINED = "__lodash_hash_undefined__";
var objectProto10 = Object.prototype;
var hasOwnProperty8 = objectProto10.hasOwnProperty;
function hashGet(key) {
  var data = this.__data__;
  if (_nativeCreate_default) {
    var result = data[key];
    return result === HASH_UNDEFINED ? undefined : result;
  }
  return hasOwnProperty8.call(data, key) ? data[key] : undefined;
}
var _hashGet_default = hashGet;

// ../../node_modules/lodash-es/_hashHas.js
var objectProto11 = Object.prototype;
var hasOwnProperty9 = objectProto11.hasOwnProperty;
function hashHas(key) {
  var data = this.__data__;
  return _nativeCreate_default ? data[key] !== undefined : hasOwnProperty9.call(data, key);
}
var _hashHas_default = hashHas;

// ../../node_modules/lodash-es/_hashSet.js
var HASH_UNDEFINED2 = "__lodash_hash_undefined__";
function hashSet(key, value) {
  var data = this.__data__;
  this.size += this.has(key) ? 0 : 1;
  data[key] = _nativeCreate_default && value === undefined ? HASH_UNDEFINED2 : value;
  return this;
}
var _hashSet_default = hashSet;

// ../../node_modules/lodash-es/_Hash.js
function Hash(entries) {
  var index = -1, length = entries == null ? 0 : entries.length;
  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}
Hash.prototype.clear = _hashClear_default;
Hash.prototype["delete"] = _hashDelete_default;
Hash.prototype.get = _hashGet_default;
Hash.prototype.has = _hashHas_default;
Hash.prototype.set = _hashSet_default;
var _Hash_default = Hash;

// ../../node_modules/lodash-es/_mapCacheClear.js
function mapCacheClear() {
  this.size = 0;
  this.__data__ = {
    hash: new _Hash_default,
    map: new (_Map_default || _ListCache_default),
    string: new _Hash_default
  };
}
var _mapCacheClear_default = mapCacheClear;

// ../../node_modules/lodash-es/_isKeyable.js
function isKeyable(value) {
  var type = typeof value;
  return type == "string" || type == "number" || type == "symbol" || type == "boolean" ? value !== "__proto__" : value === null;
}
var _isKeyable_default = isKeyable;

// ../../node_modules/lodash-es/_getMapData.js
function getMapData(map, key) {
  var data = map.__data__;
  return _isKeyable_default(key) ? data[typeof key == "string" ? "string" : "hash"] : data.map;
}
var _getMapData_default = getMapData;

// ../../node_modules/lodash-es/_mapCacheDelete.js
function mapCacheDelete(key) {
  var result = _getMapData_default(this, key)["delete"](key);
  this.size -= result ? 1 : 0;
  return result;
}
var _mapCacheDelete_default = mapCacheDelete;

// ../../node_modules/lodash-es/_mapCacheGet.js
function mapCacheGet(key) {
  return _getMapData_default(this, key).get(key);
}
var _mapCacheGet_default = mapCacheGet;

// ../../node_modules/lodash-es/_mapCacheHas.js
function mapCacheHas(key) {
  return _getMapData_default(this, key).has(key);
}
var _mapCacheHas_default = mapCacheHas;

// ../../node_modules/lodash-es/_mapCacheSet.js
function mapCacheSet(key, value) {
  var data = _getMapData_default(this, key), size = data.size;
  data.set(key, value);
  this.size += data.size == size ? 0 : 1;
  return this;
}
var _mapCacheSet_default = mapCacheSet;

// ../../node_modules/lodash-es/_MapCache.js
function MapCache(entries) {
  var index = -1, length = entries == null ? 0 : entries.length;
  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}
MapCache.prototype.clear = _mapCacheClear_default;
MapCache.prototype["delete"] = _mapCacheDelete_default;
MapCache.prototype.get = _mapCacheGet_default;
MapCache.prototype.has = _mapCacheHas_default;
MapCache.prototype.set = _mapCacheSet_default;
var _MapCache_default = MapCache;

// ../../node_modules/lodash-es/_stackSet.js
var LARGE_ARRAY_SIZE = 200;
function stackSet(key, value) {
  var data = this.__data__;
  if (data instanceof _ListCache_default) {
    var pairs = data.__data__;
    if (!_Map_default || pairs.length < LARGE_ARRAY_SIZE - 1) {
      pairs.push([key, value]);
      this.size = ++data.size;
      return this;
    }
    data = this.__data__ = new _MapCache_default(pairs);
  }
  data.set(key, value);
  this.size = data.size;
  return this;
}
var _stackSet_default = stackSet;

// ../../node_modules/lodash-es/_Stack.js
function Stack(entries) {
  var data = this.__data__ = new _ListCache_default(entries);
  this.size = data.size;
}
Stack.prototype.clear = _stackClear_default;
Stack.prototype["delete"] = _stackDelete_default;
Stack.prototype.get = _stackGet_default;
Stack.prototype.has = _stackHas_default;
Stack.prototype.set = _stackSet_default;
var _Stack_default = Stack;

// ../../node_modules/lodash-es/_arrayEach.js
function arrayEach(array, iteratee) {
  var index = -1, length = array == null ? 0 : array.length;
  while (++index < length) {
    if (iteratee(array[index], index, array) === false) {
      break;
    }
  }
  return array;
}
var _arrayEach_default = arrayEach;

// ../../node_modules/lodash-es/_baseAssign.js
function baseAssign(object, source) {
  return object && _copyObject_default(source, keys_default(source), object);
}
var _baseAssign_default = baseAssign;

// ../../node_modules/lodash-es/_nativeKeysIn.js
function nativeKeysIn(object) {
  var result = [];
  if (object != null) {
    for (var key in Object(object)) {
      result.push(key);
    }
  }
  return result;
}
var _nativeKeysIn_default = nativeKeysIn;

// ../../node_modules/lodash-es/_baseKeysIn.js
var objectProto12 = Object.prototype;
var hasOwnProperty10 = objectProto12.hasOwnProperty;
function baseKeysIn(object) {
  if (!isObject_default(object)) {
    return _nativeKeysIn_default(object);
  }
  var isProto = _isPrototype_default(object), result = [];
  for (var key in object) {
    if (!(key == "constructor" && (isProto || !hasOwnProperty10.call(object, key)))) {
      result.push(key);
    }
  }
  return result;
}
var _baseKeysIn_default = baseKeysIn;

// ../../node_modules/lodash-es/keysIn.js
function keysIn(object) {
  return isArrayLike_default(object) ? _arrayLikeKeys_default(object, true) : _baseKeysIn_default(object);
}
var keysIn_default = keysIn;

// ../../node_modules/lodash-es/_baseAssignIn.js
function baseAssignIn(object, source) {
  return object && _copyObject_default(source, keysIn_default(source), object);
}
var _baseAssignIn_default = baseAssignIn;

// ../../node_modules/lodash-es/_cloneBuffer.js
var exports__cloneBuffer = {};
__export(exports__cloneBuffer, {
  default: () => _cloneBuffer_default
});
var freeExports3 = typeof exports__cloneBuffer == "object" && exports__cloneBuffer && !exports__cloneBuffer.nodeType && exports__cloneBuffer;
var freeModule3 = freeExports3 && typeof module__cloneBuffer == "object" && module__cloneBuffer && !module__cloneBuffer.nodeType && module__cloneBuffer;
var moduleExports3 = freeModule3 && freeModule3.exports === freeExports3;
var Buffer2 = moduleExports3 ? _root_default.Buffer : undefined;
var allocUnsafe = Buffer2 ? Buffer2.allocUnsafe : undefined;
function cloneBuffer(buffer, isDeep) {
  if (isDeep) {
    return buffer.slice();
  }
  var length = buffer.length, result = allocUnsafe ? allocUnsafe(length) : new buffer.constructor(length);
  buffer.copy(result);
  return result;
}
var _cloneBuffer_default = cloneBuffer;

// ../../node_modules/lodash-es/_copyArray.js
function copyArray(source, array) {
  var index = -1, length = source.length;
  array || (array = Array(length));
  while (++index < length) {
    array[index] = source[index];
  }
  return array;
}
var _copyArray_default = copyArray;

// ../../node_modules/lodash-es/_arrayFilter.js
function arrayFilter(array, predicate) {
  var index = -1, length = array == null ? 0 : array.length, resIndex = 0, result = [];
  while (++index < length) {
    var value = array[index];
    if (predicate(value, index, array)) {
      result[resIndex++] = value;
    }
  }
  return result;
}
var _arrayFilter_default = arrayFilter;

// ../../node_modules/lodash-es/stubArray.js
function stubArray() {
  return [];
}
var stubArray_default = stubArray;

// ../../node_modules/lodash-es/_getSymbols.js
var objectProto13 = Object.prototype;
var propertyIsEnumerable2 = objectProto13.propertyIsEnumerable;
var nativeGetSymbols = Object.getOwnPropertySymbols;
var getSymbols = !nativeGetSymbols ? stubArray_default : function(object) {
  if (object == null) {
    return [];
  }
  object = Object(object);
  return _arrayFilter_default(nativeGetSymbols(object), function(symbol) {
    return propertyIsEnumerable2.call(object, symbol);
  });
};
var _getSymbols_default = getSymbols;

// ../../node_modules/lodash-es/_copySymbols.js
function copySymbols(source, object) {
  return _copyObject_default(source, _getSymbols_default(source), object);
}
var _copySymbols_default = copySymbols;

// ../../node_modules/lodash-es/_arrayPush.js
function arrayPush(array, values) {
  var index = -1, length = values.length, offset = array.length;
  while (++index < length) {
    array[offset + index] = values[index];
  }
  return array;
}
var _arrayPush_default = arrayPush;

// ../../node_modules/lodash-es/_getPrototype.js
var getPrototype = _overArg_default(Object.getPrototypeOf, Object);
var _getPrototype_default = getPrototype;

// ../../node_modules/lodash-es/_getSymbolsIn.js
var nativeGetSymbols2 = Object.getOwnPropertySymbols;
var getSymbolsIn = !nativeGetSymbols2 ? stubArray_default : function(object) {
  var result = [];
  while (object) {
    _arrayPush_default(result, _getSymbols_default(object));
    object = _getPrototype_default(object);
  }
  return result;
};
var _getSymbolsIn_default = getSymbolsIn;

// ../../node_modules/lodash-es/_copySymbolsIn.js
function copySymbolsIn(source, object) {
  return _copyObject_default(source, _getSymbolsIn_default(source), object);
}
var _copySymbolsIn_default = copySymbolsIn;

// ../../node_modules/lodash-es/_baseGetAllKeys.js
function baseGetAllKeys(object, keysFunc, symbolsFunc) {
  var result = keysFunc(object);
  return isArray_default(object) ? result : _arrayPush_default(result, symbolsFunc(object));
}
var _baseGetAllKeys_default = baseGetAllKeys;

// ../../node_modules/lodash-es/_getAllKeys.js
function getAllKeys(object) {
  return _baseGetAllKeys_default(object, keys_default, _getSymbols_default);
}
var _getAllKeys_default = getAllKeys;

// ../../node_modules/lodash-es/_getAllKeysIn.js
function getAllKeysIn(object) {
  return _baseGetAllKeys_default(object, keysIn_default, _getSymbolsIn_default);
}
var _getAllKeysIn_default = getAllKeysIn;

// ../../node_modules/lodash-es/_DataView.js
var DataView = _getNative_default(_root_default, "DataView");
var _DataView_default = DataView;

// ../../node_modules/lodash-es/_Promise.js
var Promise2 = _getNative_default(_root_default, "Promise");
var _Promise_default = Promise2;

// ../../node_modules/lodash-es/_Set.js
var Set2 = _getNative_default(_root_default, "Set");
var _Set_default = Set2;

// ../../node_modules/lodash-es/_WeakMap.js
var WeakMap = _getNative_default(_root_default, "WeakMap");
var _WeakMap_default = WeakMap;

// ../../node_modules/lodash-es/_getTag.js
var mapTag2 = "[object Map]";
var objectTag2 = "[object Object]";
var promiseTag = "[object Promise]";
var setTag2 = "[object Set]";
var weakMapTag2 = "[object WeakMap]";
var dataViewTag2 = "[object DataView]";
var dataViewCtorString = _toSource_default(_DataView_default);
var mapCtorString = _toSource_default(_Map_default);
var promiseCtorString = _toSource_default(_Promise_default);
var setCtorString = _toSource_default(_Set_default);
var weakMapCtorString = _toSource_default(_WeakMap_default);
var getTag = _baseGetTag_default;
if (_DataView_default && getTag(new _DataView_default(new ArrayBuffer(1))) != dataViewTag2 || _Map_default && getTag(new _Map_default) != mapTag2 || _Promise_default && getTag(_Promise_default.resolve()) != promiseTag || _Set_default && getTag(new _Set_default) != setTag2 || _WeakMap_default && getTag(new _WeakMap_default) != weakMapTag2) {
  getTag = function(value) {
    var result = _baseGetTag_default(value), Ctor = result == objectTag2 ? value.constructor : undefined, ctorString = Ctor ? _toSource_default(Ctor) : "";
    if (ctorString) {
      switch (ctorString) {
        case dataViewCtorString:
          return dataViewTag2;
        case mapCtorString:
          return mapTag2;
        case promiseCtorString:
          return promiseTag;
        case setCtorString:
          return setTag2;
        case weakMapCtorString:
          return weakMapTag2;
      }
    }
    return result;
  };
}
var _getTag_default = getTag;

// ../../node_modules/lodash-es/_initCloneArray.js
var objectProto14 = Object.prototype;
var hasOwnProperty11 = objectProto14.hasOwnProperty;
function initCloneArray(array) {
  var length = array.length, result = new array.constructor(length);
  if (length && typeof array[0] == "string" && hasOwnProperty11.call(array, "index")) {
    result.index = array.index;
    result.input = array.input;
  }
  return result;
}
var _initCloneArray_default = initCloneArray;

// ../../node_modules/lodash-es/_Uint8Array.js
var Uint8Array = _root_default.Uint8Array;
var _Uint8Array_default = Uint8Array;

// ../../node_modules/lodash-es/_cloneArrayBuffer.js
function cloneArrayBuffer(arrayBuffer) {
  var result = new arrayBuffer.constructor(arrayBuffer.byteLength);
  new _Uint8Array_default(result).set(new _Uint8Array_default(arrayBuffer));
  return result;
}
var _cloneArrayBuffer_default = cloneArrayBuffer;

// ../../node_modules/lodash-es/_cloneDataView.js
function cloneDataView(dataView, isDeep) {
  var buffer = isDeep ? _cloneArrayBuffer_default(dataView.buffer) : dataView.buffer;
  return new dataView.constructor(buffer, dataView.byteOffset, dataView.byteLength);
}
var _cloneDataView_default = cloneDataView;

// ../../node_modules/lodash-es/_cloneRegExp.js
var reFlags = /\w*$/;
function cloneRegExp(regexp) {
  var result = new regexp.constructor(regexp.source, reFlags.exec(regexp));
  result.lastIndex = regexp.lastIndex;
  return result;
}
var _cloneRegExp_default = cloneRegExp;

// ../../node_modules/lodash-es/_cloneSymbol.js
var symbolProto = _Symbol_default ? _Symbol_default.prototype : undefined;
var symbolValueOf = symbolProto ? symbolProto.valueOf : undefined;
function cloneSymbol(symbol) {
  return symbolValueOf ? Object(symbolValueOf.call(symbol)) : {};
}
var _cloneSymbol_default = cloneSymbol;

// ../../node_modules/lodash-es/_cloneTypedArray.js
function cloneTypedArray(typedArray, isDeep) {
  var buffer = isDeep ? _cloneArrayBuffer_default(typedArray.buffer) : typedArray.buffer;
  return new typedArray.constructor(buffer, typedArray.byteOffset, typedArray.length);
}
var _cloneTypedArray_default = cloneTypedArray;

// ../../node_modules/lodash-es/_initCloneByTag.js
var boolTag2 = "[object Boolean]";
var dateTag2 = "[object Date]";
var mapTag3 = "[object Map]";
var numberTag2 = "[object Number]";
var regexpTag2 = "[object RegExp]";
var setTag3 = "[object Set]";
var stringTag2 = "[object String]";
var symbolTag = "[object Symbol]";
var arrayBufferTag2 = "[object ArrayBuffer]";
var dataViewTag3 = "[object DataView]";
var float32Tag2 = "[object Float32Array]";
var float64Tag2 = "[object Float64Array]";
var int8Tag2 = "[object Int8Array]";
var int16Tag2 = "[object Int16Array]";
var int32Tag2 = "[object Int32Array]";
var uint8Tag2 = "[object Uint8Array]";
var uint8ClampedTag2 = "[object Uint8ClampedArray]";
var uint16Tag2 = "[object Uint16Array]";
var uint32Tag2 = "[object Uint32Array]";
function initCloneByTag(object, tag, isDeep) {
  var Ctor = object.constructor;
  switch (tag) {
    case arrayBufferTag2:
      return _cloneArrayBuffer_default(object);
    case boolTag2:
    case dateTag2:
      return new Ctor(+object);
    case dataViewTag3:
      return _cloneDataView_default(object, isDeep);
    case float32Tag2:
    case float64Tag2:
    case int8Tag2:
    case int16Tag2:
    case int32Tag2:
    case uint8Tag2:
    case uint8ClampedTag2:
    case uint16Tag2:
    case uint32Tag2:
      return _cloneTypedArray_default(object, isDeep);
    case mapTag3:
      return new Ctor;
    case numberTag2:
    case stringTag2:
      return new Ctor(object);
    case regexpTag2:
      return _cloneRegExp_default(object);
    case setTag3:
      return new Ctor;
    case symbolTag:
      return _cloneSymbol_default(object);
  }
}
var _initCloneByTag_default = initCloneByTag;

// ../../node_modules/lodash-es/_baseCreate.js
var objectCreate = Object.create;
var baseCreate = function() {
  function object() {}
  return function(proto) {
    if (!isObject_default(proto)) {
      return {};
    }
    if (objectCreate) {
      return objectCreate(proto);
    }
    object.prototype = proto;
    var result = new object;
    object.prototype = undefined;
    return result;
  };
}();
var _baseCreate_default = baseCreate;

// ../../node_modules/lodash-es/_initCloneObject.js
function initCloneObject(object) {
  return typeof object.constructor == "function" && !_isPrototype_default(object) ? _baseCreate_default(_getPrototype_default(object)) : {};
}
var _initCloneObject_default = initCloneObject;

// ../../node_modules/lodash-es/_baseIsMap.js
var mapTag4 = "[object Map]";
function baseIsMap(value) {
  return isObjectLike_default(value) && _getTag_default(value) == mapTag4;
}
var _baseIsMap_default = baseIsMap;

// ../../node_modules/lodash-es/isMap.js
var nodeIsMap = _nodeUtil_default && _nodeUtil_default.isMap;
var isMap = nodeIsMap ? _baseUnary_default(nodeIsMap) : _baseIsMap_default;
var isMap_default = isMap;

// ../../node_modules/lodash-es/_baseIsSet.js
var setTag4 = "[object Set]";
function baseIsSet(value) {
  return isObjectLike_default(value) && _getTag_default(value) == setTag4;
}
var _baseIsSet_default = baseIsSet;

// ../../node_modules/lodash-es/isSet.js
var nodeIsSet = _nodeUtil_default && _nodeUtil_default.isSet;
var isSet = nodeIsSet ? _baseUnary_default(nodeIsSet) : _baseIsSet_default;
var isSet_default = isSet;

// ../../node_modules/lodash-es/_baseClone.js
var CLONE_DEEP_FLAG = 1;
var CLONE_FLAT_FLAG = 2;
var CLONE_SYMBOLS_FLAG = 4;
var argsTag3 = "[object Arguments]";
var arrayTag2 = "[object Array]";
var boolTag3 = "[object Boolean]";
var dateTag3 = "[object Date]";
var errorTag2 = "[object Error]";
var funcTag3 = "[object Function]";
var genTag2 = "[object GeneratorFunction]";
var mapTag5 = "[object Map]";
var numberTag3 = "[object Number]";
var objectTag3 = "[object Object]";
var regexpTag3 = "[object RegExp]";
var setTag5 = "[object Set]";
var stringTag3 = "[object String]";
var symbolTag2 = "[object Symbol]";
var weakMapTag3 = "[object WeakMap]";
var arrayBufferTag3 = "[object ArrayBuffer]";
var dataViewTag4 = "[object DataView]";
var float32Tag3 = "[object Float32Array]";
var float64Tag3 = "[object Float64Array]";
var int8Tag3 = "[object Int8Array]";
var int16Tag3 = "[object Int16Array]";
var int32Tag3 = "[object Int32Array]";
var uint8Tag3 = "[object Uint8Array]";
var uint8ClampedTag3 = "[object Uint8ClampedArray]";
var uint16Tag3 = "[object Uint16Array]";
var uint32Tag3 = "[object Uint32Array]";
var cloneableTags = {};
cloneableTags[argsTag3] = cloneableTags[arrayTag2] = cloneableTags[arrayBufferTag3] = cloneableTags[dataViewTag4] = cloneableTags[boolTag3] = cloneableTags[dateTag3] = cloneableTags[float32Tag3] = cloneableTags[float64Tag3] = cloneableTags[int8Tag3] = cloneableTags[int16Tag3] = cloneableTags[int32Tag3] = cloneableTags[mapTag5] = cloneableTags[numberTag3] = cloneableTags[objectTag3] = cloneableTags[regexpTag3] = cloneableTags[setTag5] = cloneableTags[stringTag3] = cloneableTags[symbolTag2] = cloneableTags[uint8Tag3] = cloneableTags[uint8ClampedTag3] = cloneableTags[uint16Tag3] = cloneableTags[uint32Tag3] = true;
cloneableTags[errorTag2] = cloneableTags[funcTag3] = cloneableTags[weakMapTag3] = false;
function baseClone(value, bitmask, customizer, key, object, stack) {
  var result, isDeep = bitmask & CLONE_DEEP_FLAG, isFlat = bitmask & CLONE_FLAT_FLAG, isFull = bitmask & CLONE_SYMBOLS_FLAG;
  if (customizer) {
    result = object ? customizer(value, key, object, stack) : customizer(value);
  }
  if (result !== undefined) {
    return result;
  }
  if (!isObject_default(value)) {
    return value;
  }
  var isArr = isArray_default(value);
  if (isArr) {
    result = _initCloneArray_default(value);
    if (!isDeep) {
      return _copyArray_default(value, result);
    }
  } else {
    var tag = _getTag_default(value), isFunc = tag == funcTag3 || tag == genTag2;
    if (isBuffer_default(value)) {
      return _cloneBuffer_default(value, isDeep);
    }
    if (tag == objectTag3 || tag == argsTag3 || isFunc && !object) {
      result = isFlat || isFunc ? {} : _initCloneObject_default(value);
      if (!isDeep) {
        return isFlat ? _copySymbolsIn_default(value, _baseAssignIn_default(result, value)) : _copySymbols_default(value, _baseAssign_default(result, value));
      }
    } else {
      if (!cloneableTags[tag]) {
        return object ? value : {};
      }
      result = _initCloneByTag_default(value, tag, isDeep);
    }
  }
  stack || (stack = new _Stack_default);
  var stacked = stack.get(value);
  if (stacked) {
    return stacked;
  }
  stack.set(value, result);
  if (isSet_default(value)) {
    value.forEach(function(subValue) {
      result.add(baseClone(subValue, bitmask, customizer, subValue, value, stack));
    });
  } else if (isMap_default(value)) {
    value.forEach(function(subValue, key2) {
      result.set(key2, baseClone(subValue, bitmask, customizer, key2, value, stack));
    });
  }
  var keysFunc = isFull ? isFlat ? _getAllKeysIn_default : _getAllKeys_default : isFlat ? keysIn_default : keys_default;
  var props = isArr ? undefined : keysFunc(value);
  _arrayEach_default(props || value, function(subValue, key2) {
    if (props) {
      key2 = subValue;
      subValue = value[key2];
    }
    _assignValue_default(result, key2, baseClone(subValue, bitmask, customizer, key2, value, stack));
  });
  return result;
}
var _baseClone_default = baseClone;

// ../../node_modules/lodash-es/clone.js
var CLONE_SYMBOLS_FLAG2 = 4;
function clone(value) {
  return _baseClone_default(value, CLONE_SYMBOLS_FLAG2);
}
var clone_default = clone;
// ../../node_modules/lodash-es/compact.js
function compact(array) {
  var index = -1, length = array == null ? 0 : array.length, resIndex = 0, result = [];
  while (++index < length) {
    var value = array[index];
    if (value) {
      result[resIndex++] = value;
    }
  }
  return result;
}
var compact_default = compact;
// ../../node_modules/lodash-es/defaults.js
var objectProto15 = Object.prototype;
var hasOwnProperty12 = objectProto15.hasOwnProperty;
var defaults = _baseRest_default(function(object, sources) {
  object = Object(object);
  var index = -1;
  var length = sources.length;
  var guard = length > 2 ? sources[2] : undefined;
  if (guard && _isIterateeCall_default(sources[0], sources[1], guard)) {
    length = 1;
  }
  while (++index < length) {
    var source = sources[index];
    var props = keysIn_default(source);
    var propsIndex = -1;
    var propsLength = props.length;
    while (++propsIndex < propsLength) {
      var key = props[propsIndex];
      var value = object[key];
      if (value === undefined || eq_default(value, objectProto15[key]) && !hasOwnProperty12.call(object, key)) {
        object[key] = source[key];
      }
    }
  }
  return object;
});
var defaults_default = defaults;
// ../../node_modules/lodash-es/_setCacheAdd.js
var HASH_UNDEFINED3 = "__lodash_hash_undefined__";
function setCacheAdd(value) {
  this.__data__.set(value, HASH_UNDEFINED3);
  return this;
}
var _setCacheAdd_default = setCacheAdd;

// ../../node_modules/lodash-es/_setCacheHas.js
function setCacheHas(value) {
  return this.__data__.has(value);
}
var _setCacheHas_default = setCacheHas;

// ../../node_modules/lodash-es/_SetCache.js
function SetCache(values) {
  var index = -1, length = values == null ? 0 : values.length;
  this.__data__ = new _MapCache_default;
  while (++index < length) {
    this.add(values[index]);
  }
}
SetCache.prototype.add = SetCache.prototype.push = _setCacheAdd_default;
SetCache.prototype.has = _setCacheHas_default;
var _SetCache_default = SetCache;

// ../../node_modules/lodash-es/_baseFindIndex.js
function baseFindIndex(array, predicate, fromIndex, fromRight) {
  var length = array.length, index = fromIndex + (fromRight ? 1 : -1);
  while (fromRight ? index-- : ++index < length) {
    if (predicate(array[index], index, array)) {
      return index;
    }
  }
  return -1;
}
var _baseFindIndex_default = baseFindIndex;

// ../../node_modules/lodash-es/_baseIsNaN.js
function baseIsNaN(value) {
  return value !== value;
}
var _baseIsNaN_default = baseIsNaN;

// ../../node_modules/lodash-es/_strictIndexOf.js
function strictIndexOf(array, value, fromIndex) {
  var index = fromIndex - 1, length = array.length;
  while (++index < length) {
    if (array[index] === value) {
      return index;
    }
  }
  return -1;
}
var _strictIndexOf_default = strictIndexOf;

// ../../node_modules/lodash-es/_baseIndexOf.js
function baseIndexOf(array, value, fromIndex) {
  return value === value ? _strictIndexOf_default(array, value, fromIndex) : _baseFindIndex_default(array, _baseIsNaN_default, fromIndex);
}
var _baseIndexOf_default = baseIndexOf;

// ../../node_modules/lodash-es/_arrayIncludes.js
function arrayIncludes(array, value) {
  var length = array == null ? 0 : array.length;
  return !!length && _baseIndexOf_default(array, value, 0) > -1;
}
var _arrayIncludes_default = arrayIncludes;

// ../../node_modules/lodash-es/_arrayIncludesWith.js
function arrayIncludesWith(array, value, comparator) {
  var index = -1, length = array == null ? 0 : array.length;
  while (++index < length) {
    if (comparator(value, array[index])) {
      return true;
    }
  }
  return false;
}
var _arrayIncludesWith_default = arrayIncludesWith;

// ../../node_modules/lodash-es/_arrayMap.js
function arrayMap(array, iteratee) {
  var index = -1, length = array == null ? 0 : array.length, result = Array(length);
  while (++index < length) {
    result[index] = iteratee(array[index], index, array);
  }
  return result;
}
var _arrayMap_default = arrayMap;

// ../../node_modules/lodash-es/_cacheHas.js
function cacheHas(cache, key) {
  return cache.has(key);
}
var _cacheHas_default = cacheHas;

// ../../node_modules/lodash-es/_baseDifference.js
var LARGE_ARRAY_SIZE2 = 200;
function baseDifference(array, values, iteratee, comparator) {
  var index = -1, includes = _arrayIncludes_default, isCommon = true, length = array.length, result = [], valuesLength = values.length;
  if (!length) {
    return result;
  }
  if (iteratee) {
    values = _arrayMap_default(values, _baseUnary_default(iteratee));
  }
  if (comparator) {
    includes = _arrayIncludesWith_default;
    isCommon = false;
  } else if (values.length >= LARGE_ARRAY_SIZE2) {
    includes = _cacheHas_default;
    isCommon = false;
    values = new _SetCache_default(values);
  }
  outer:
    while (++index < length) {
      var value = array[index], computed = iteratee == null ? value : iteratee(value);
      value = comparator || value !== 0 ? value : 0;
      if (isCommon && computed === computed) {
        var valuesIndex = valuesLength;
        while (valuesIndex--) {
          if (values[valuesIndex] === computed) {
            continue outer;
          }
        }
        result.push(value);
      } else if (!includes(values, computed, comparator)) {
        result.push(value);
      }
    }
  return result;
}
var _baseDifference_default = baseDifference;

// ../../node_modules/lodash-es/_isFlattenable.js
var spreadableSymbol = _Symbol_default ? _Symbol_default.isConcatSpreadable : undefined;
function isFlattenable(value) {
  return isArray_default(value) || isArguments_default(value) || !!(spreadableSymbol && value && value[spreadableSymbol]);
}
var _isFlattenable_default = isFlattenable;

// ../../node_modules/lodash-es/_baseFlatten.js
function baseFlatten(array, depth, predicate, isStrict, result) {
  var index = -1, length = array.length;
  predicate || (predicate = _isFlattenable_default);
  result || (result = []);
  while (++index < length) {
    var value = array[index];
    if (depth > 0 && predicate(value)) {
      if (depth > 1) {
        baseFlatten(value, depth - 1, predicate, isStrict, result);
      } else {
        _arrayPush_default(result, value);
      }
    } else if (!isStrict) {
      result[result.length] = value;
    }
  }
  return result;
}
var _baseFlatten_default = baseFlatten;

// ../../node_modules/lodash-es/isArrayLikeObject.js
function isArrayLikeObject(value) {
  return isObjectLike_default(value) && isArrayLike_default(value);
}
var isArrayLikeObject_default = isArrayLikeObject;

// ../../node_modules/lodash-es/difference.js
var difference = _baseRest_default(function(array, values) {
  return isArrayLikeObject_default(array) ? _baseDifference_default(array, _baseFlatten_default(values, 1, isArrayLikeObject_default, true)) : [];
});
var difference_default = difference;
// ../../node_modules/lodash-es/_baseSlice.js
function baseSlice(array, start, end) {
  var index = -1, length = array.length;
  if (start < 0) {
    start = -start > length ? 0 : length + start;
  }
  end = end > length ? length : end;
  if (end < 0) {
    end += length;
  }
  length = start > end ? 0 : end - start >>> 0;
  start >>>= 0;
  var result = Array(length);
  while (++index < length) {
    result[index] = array[index + start];
  }
  return result;
}
var _baseSlice_default = baseSlice;

// ../../node_modules/lodash-es/_trimmedEndIndex.js
var reWhitespace = /\s/;
function trimmedEndIndex(string) {
  var index = string.length;
  while (index-- && reWhitespace.test(string.charAt(index))) {}
  return index;
}
var _trimmedEndIndex_default = trimmedEndIndex;

// ../../node_modules/lodash-es/_baseTrim.js
var reTrimStart = /^\s+/;
function baseTrim(string) {
  return string ? string.slice(0, _trimmedEndIndex_default(string) + 1).replace(reTrimStart, "") : string;
}
var _baseTrim_default = baseTrim;

// ../../node_modules/lodash-es/isSymbol.js
var symbolTag3 = "[object Symbol]";
function isSymbol(value) {
  return typeof value == "symbol" || isObjectLike_default(value) && _baseGetTag_default(value) == symbolTag3;
}
var isSymbol_default = isSymbol;

// ../../node_modules/lodash-es/toNumber.js
var NAN = 0 / 0;
var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;
var reIsBinary = /^0b[01]+$/i;
var reIsOctal = /^0o[0-7]+$/i;
var freeParseInt = parseInt;
function toNumber(value) {
  if (typeof value == "number") {
    return value;
  }
  if (isSymbol_default(value)) {
    return NAN;
  }
  if (isObject_default(value)) {
    var other = typeof value.valueOf == "function" ? value.valueOf() : value;
    value = isObject_default(other) ? other + "" : other;
  }
  if (typeof value != "string") {
    return value === 0 ? value : +value;
  }
  value = _baseTrim_default(value);
  var isBinary = reIsBinary.test(value);
  return isBinary || reIsOctal.test(value) ? freeParseInt(value.slice(2), isBinary ? 2 : 8) : reIsBadHex.test(value) ? NAN : +value;
}
var toNumber_default = toNumber;

// ../../node_modules/lodash-es/toFinite.js
var INFINITY = 1 / 0;
var MAX_INTEGER = 179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000;
function toFinite(value) {
  if (!value) {
    return value === 0 ? value : 0;
  }
  value = toNumber_default(value);
  if (value === INFINITY || value === -INFINITY) {
    var sign = value < 0 ? -1 : 1;
    return sign * MAX_INTEGER;
  }
  return value === value ? value : 0;
}
var toFinite_default = toFinite;

// ../../node_modules/lodash-es/toInteger.js
function toInteger(value) {
  var result = toFinite_default(value), remainder = result % 1;
  return result === result ? remainder ? result - remainder : result : 0;
}
var toInteger_default = toInteger;

// ../../node_modules/lodash-es/drop.js
function drop(array, n, guard) {
  var length = array == null ? 0 : array.length;
  if (!length) {
    return [];
  }
  n = guard || n === undefined ? 1 : toInteger_default(n);
  return _baseSlice_default(array, n < 0 ? 0 : n, length);
}
var drop_default = drop;
// ../../node_modules/lodash-es/dropRight.js
function dropRight(array, n, guard) {
  var length = array == null ? 0 : array.length;
  if (!length) {
    return [];
  }
  n = guard || n === undefined ? 1 : toInteger_default(n);
  n = length - n;
  return _baseSlice_default(array, 0, n < 0 ? 0 : n);
}
var dropRight_default = dropRight;
// ../../node_modules/lodash-es/_arrayEvery.js
function arrayEvery(array, predicate) {
  var index = -1, length = array == null ? 0 : array.length;
  while (++index < length) {
    if (!predicate(array[index], index, array)) {
      return false;
    }
  }
  return true;
}
var _arrayEvery_default = arrayEvery;

// ../../node_modules/lodash-es/_createBaseFor.js
function createBaseFor(fromRight) {
  return function(object, iteratee, keysFunc) {
    var index = -1, iterable = Object(object), props = keysFunc(object), length = props.length;
    while (length--) {
      var key = props[fromRight ? length : ++index];
      if (iteratee(iterable[key], key, iterable) === false) {
        break;
      }
    }
    return object;
  };
}
var _createBaseFor_default = createBaseFor;

// ../../node_modules/lodash-es/_baseFor.js
var baseFor = _createBaseFor_default();
var _baseFor_default = baseFor;

// ../../node_modules/lodash-es/_baseForOwn.js
function baseForOwn(object, iteratee) {
  return object && _baseFor_default(object, iteratee, keys_default);
}
var _baseForOwn_default = baseForOwn;

// ../../node_modules/lodash-es/_createBaseEach.js
function createBaseEach(eachFunc, fromRight) {
  return function(collection, iteratee) {
    if (collection == null) {
      return collection;
    }
    if (!isArrayLike_default(collection)) {
      return eachFunc(collection, iteratee);
    }
    var length = collection.length, index = fromRight ? length : -1, iterable = Object(collection);
    while (fromRight ? index-- : ++index < length) {
      if (iteratee(iterable[index], index, iterable) === false) {
        break;
      }
    }
    return collection;
  };
}
var _createBaseEach_default = createBaseEach;

// ../../node_modules/lodash-es/_baseEach.js
var baseEach = _createBaseEach_default(_baseForOwn_default);
var _baseEach_default = baseEach;

// ../../node_modules/lodash-es/_baseEvery.js
function baseEvery(collection, predicate) {
  var result = true;
  _baseEach_default(collection, function(value, index, collection2) {
    result = !!predicate(value, index, collection2);
    return result;
  });
  return result;
}
var _baseEvery_default = baseEvery;

// ../../node_modules/lodash-es/_arraySome.js
function arraySome(array, predicate) {
  var index = -1, length = array == null ? 0 : array.length;
  while (++index < length) {
    if (predicate(array[index], index, array)) {
      return true;
    }
  }
  return false;
}
var _arraySome_default = arraySome;

// ../../node_modules/lodash-es/_equalArrays.js
var COMPARE_PARTIAL_FLAG = 1;
var COMPARE_UNORDERED_FLAG = 2;
function equalArrays(array, other, bitmask, customizer, equalFunc, stack) {
  var isPartial = bitmask & COMPARE_PARTIAL_FLAG, arrLength = array.length, othLength = other.length;
  if (arrLength != othLength && !(isPartial && othLength > arrLength)) {
    return false;
  }
  var arrStacked = stack.get(array);
  var othStacked = stack.get(other);
  if (arrStacked && othStacked) {
    return arrStacked == other && othStacked == array;
  }
  var index = -1, result = true, seen = bitmask & COMPARE_UNORDERED_FLAG ? new _SetCache_default : undefined;
  stack.set(array, other);
  stack.set(other, array);
  while (++index < arrLength) {
    var arrValue = array[index], othValue = other[index];
    if (customizer) {
      var compared = isPartial ? customizer(othValue, arrValue, index, other, array, stack) : customizer(arrValue, othValue, index, array, other, stack);
    }
    if (compared !== undefined) {
      if (compared) {
        continue;
      }
      result = false;
      break;
    }
    if (seen) {
      if (!_arraySome_default(other, function(othValue2, othIndex) {
        if (!_cacheHas_default(seen, othIndex) && (arrValue === othValue2 || equalFunc(arrValue, othValue2, bitmask, customizer, stack))) {
          return seen.push(othIndex);
        }
      })) {
        result = false;
        break;
      }
    } else if (!(arrValue === othValue || equalFunc(arrValue, othValue, bitmask, customizer, stack))) {
      result = false;
      break;
    }
  }
  stack["delete"](array);
  stack["delete"](other);
  return result;
}
var _equalArrays_default = equalArrays;

// ../../node_modules/lodash-es/_mapToArray.js
function mapToArray(map) {
  var index = -1, result = Array(map.size);
  map.forEach(function(value, key) {
    result[++index] = [key, value];
  });
  return result;
}
var _mapToArray_default = mapToArray;

// ../../node_modules/lodash-es/_setToArray.js
function setToArray(set) {
  var index = -1, result = Array(set.size);
  set.forEach(function(value) {
    result[++index] = value;
  });
  return result;
}
var _setToArray_default = setToArray;

// ../../node_modules/lodash-es/_equalByTag.js
var COMPARE_PARTIAL_FLAG2 = 1;
var COMPARE_UNORDERED_FLAG2 = 2;
var boolTag4 = "[object Boolean]";
var dateTag4 = "[object Date]";
var errorTag3 = "[object Error]";
var mapTag6 = "[object Map]";
var numberTag4 = "[object Number]";
var regexpTag4 = "[object RegExp]";
var setTag6 = "[object Set]";
var stringTag4 = "[object String]";
var symbolTag4 = "[object Symbol]";
var arrayBufferTag4 = "[object ArrayBuffer]";
var dataViewTag5 = "[object DataView]";
var symbolProto2 = _Symbol_default ? _Symbol_default.prototype : undefined;
var symbolValueOf2 = symbolProto2 ? symbolProto2.valueOf : undefined;
function equalByTag(object, other, tag, bitmask, customizer, equalFunc, stack) {
  switch (tag) {
    case dataViewTag5:
      if (object.byteLength != other.byteLength || object.byteOffset != other.byteOffset) {
        return false;
      }
      object = object.buffer;
      other = other.buffer;
    case arrayBufferTag4:
      if (object.byteLength != other.byteLength || !equalFunc(new _Uint8Array_default(object), new _Uint8Array_default(other))) {
        return false;
      }
      return true;
    case boolTag4:
    case dateTag4:
    case numberTag4:
      return eq_default(+object, +other);
    case errorTag3:
      return object.name == other.name && object.message == other.message;
    case regexpTag4:
    case stringTag4:
      return object == other + "";
    case mapTag6:
      var convert = _mapToArray_default;
    case setTag6:
      var isPartial = bitmask & COMPARE_PARTIAL_FLAG2;
      convert || (convert = _setToArray_default);
      if (object.size != other.size && !isPartial) {
        return false;
      }
      var stacked = stack.get(object);
      if (stacked) {
        return stacked == other;
      }
      bitmask |= COMPARE_UNORDERED_FLAG2;
      stack.set(object, other);
      var result = _equalArrays_default(convert(object), convert(other), bitmask, customizer, equalFunc, stack);
      stack["delete"](object);
      return result;
    case symbolTag4:
      if (symbolValueOf2) {
        return symbolValueOf2.call(object) == symbolValueOf2.call(other);
      }
  }
  return false;
}
var _equalByTag_default = equalByTag;

// ../../node_modules/lodash-es/_equalObjects.js
var COMPARE_PARTIAL_FLAG3 = 1;
var objectProto16 = Object.prototype;
var hasOwnProperty13 = objectProto16.hasOwnProperty;
function equalObjects(object, other, bitmask, customizer, equalFunc, stack) {
  var isPartial = bitmask & COMPARE_PARTIAL_FLAG3, objProps = _getAllKeys_default(object), objLength = objProps.length, othProps = _getAllKeys_default(other), othLength = othProps.length;
  if (objLength != othLength && !isPartial) {
    return false;
  }
  var index = objLength;
  while (index--) {
    var key = objProps[index];
    if (!(isPartial ? key in other : hasOwnProperty13.call(other, key))) {
      return false;
    }
  }
  var objStacked = stack.get(object);
  var othStacked = stack.get(other);
  if (objStacked && othStacked) {
    return objStacked == other && othStacked == object;
  }
  var result = true;
  stack.set(object, other);
  stack.set(other, object);
  var skipCtor = isPartial;
  while (++index < objLength) {
    key = objProps[index];
    var objValue = object[key], othValue = other[key];
    if (customizer) {
      var compared = isPartial ? customizer(othValue, objValue, key, other, object, stack) : customizer(objValue, othValue, key, object, other, stack);
    }
    if (!(compared === undefined ? objValue === othValue || equalFunc(objValue, othValue, bitmask, customizer, stack) : compared)) {
      result = false;
      break;
    }
    skipCtor || (skipCtor = key == "constructor");
  }
  if (result && !skipCtor) {
    var objCtor = object.constructor, othCtor = other.constructor;
    if (objCtor != othCtor && (("constructor" in object) && ("constructor" in other)) && !(typeof objCtor == "function" && objCtor instanceof objCtor && typeof othCtor == "function" && othCtor instanceof othCtor)) {
      result = false;
    }
  }
  stack["delete"](object);
  stack["delete"](other);
  return result;
}
var _equalObjects_default = equalObjects;

// ../../node_modules/lodash-es/_baseIsEqualDeep.js
var COMPARE_PARTIAL_FLAG4 = 1;
var argsTag4 = "[object Arguments]";
var arrayTag3 = "[object Array]";
var objectTag4 = "[object Object]";
var objectProto17 = Object.prototype;
var hasOwnProperty14 = objectProto17.hasOwnProperty;
function baseIsEqualDeep(object, other, bitmask, customizer, equalFunc, stack) {
  var objIsArr = isArray_default(object), othIsArr = isArray_default(other), objTag = objIsArr ? arrayTag3 : _getTag_default(object), othTag = othIsArr ? arrayTag3 : _getTag_default(other);
  objTag = objTag == argsTag4 ? objectTag4 : objTag;
  othTag = othTag == argsTag4 ? objectTag4 : othTag;
  var objIsObj = objTag == objectTag4, othIsObj = othTag == objectTag4, isSameTag = objTag == othTag;
  if (isSameTag && isBuffer_default(object)) {
    if (!isBuffer_default(other)) {
      return false;
    }
    objIsArr = true;
    objIsObj = false;
  }
  if (isSameTag && !objIsObj) {
    stack || (stack = new _Stack_default);
    return objIsArr || isTypedArray_default(object) ? _equalArrays_default(object, other, bitmask, customizer, equalFunc, stack) : _equalByTag_default(object, other, objTag, bitmask, customizer, equalFunc, stack);
  }
  if (!(bitmask & COMPARE_PARTIAL_FLAG4)) {
    var objIsWrapped = objIsObj && hasOwnProperty14.call(object, "__wrapped__"), othIsWrapped = othIsObj && hasOwnProperty14.call(other, "__wrapped__");
    if (objIsWrapped || othIsWrapped) {
      var objUnwrapped = objIsWrapped ? object.value() : object, othUnwrapped = othIsWrapped ? other.value() : other;
      stack || (stack = new _Stack_default);
      return equalFunc(objUnwrapped, othUnwrapped, bitmask, customizer, stack);
    }
  }
  if (!isSameTag) {
    return false;
  }
  stack || (stack = new _Stack_default);
  return _equalObjects_default(object, other, bitmask, customizer, equalFunc, stack);
}
var _baseIsEqualDeep_default = baseIsEqualDeep;

// ../../node_modules/lodash-es/_baseIsEqual.js
function baseIsEqual(value, other, bitmask, customizer, stack) {
  if (value === other) {
    return true;
  }
  if (value == null || other == null || !isObjectLike_default(value) && !isObjectLike_default(other)) {
    return value !== value && other !== other;
  }
  return _baseIsEqualDeep_default(value, other, bitmask, customizer, baseIsEqual, stack);
}
var _baseIsEqual_default = baseIsEqual;

// ../../node_modules/lodash-es/_baseIsMatch.js
var COMPARE_PARTIAL_FLAG5 = 1;
var COMPARE_UNORDERED_FLAG3 = 2;
function baseIsMatch(object, source, matchData, customizer) {
  var index = matchData.length, length = index, noCustomizer = !customizer;
  if (object == null) {
    return !length;
  }
  object = Object(object);
  while (index--) {
    var data = matchData[index];
    if (noCustomizer && data[2] ? data[1] !== object[data[0]] : !(data[0] in object)) {
      return false;
    }
  }
  while (++index < length) {
    data = matchData[index];
    var key = data[0], objValue = object[key], srcValue = data[1];
    if (noCustomizer && data[2]) {
      if (objValue === undefined && !(key in object)) {
        return false;
      }
    } else {
      var stack = new _Stack_default;
      if (customizer) {
        var result = customizer(objValue, srcValue, key, object, source, stack);
      }
      if (!(result === undefined ? _baseIsEqual_default(srcValue, objValue, COMPARE_PARTIAL_FLAG5 | COMPARE_UNORDERED_FLAG3, customizer, stack) : result)) {
        return false;
      }
    }
  }
  return true;
}
var _baseIsMatch_default = baseIsMatch;

// ../../node_modules/lodash-es/_isStrictComparable.js
function isStrictComparable(value) {
  return value === value && !isObject_default(value);
}
var _isStrictComparable_default = isStrictComparable;

// ../../node_modules/lodash-es/_getMatchData.js
function getMatchData(object) {
  var result = keys_default(object), length = result.length;
  while (length--) {
    var key = result[length], value = object[key];
    result[length] = [key, value, _isStrictComparable_default(value)];
  }
  return result;
}
var _getMatchData_default = getMatchData;

// ../../node_modules/lodash-es/_matchesStrictComparable.js
function matchesStrictComparable(key, srcValue) {
  return function(object) {
    if (object == null) {
      return false;
    }
    return object[key] === srcValue && (srcValue !== undefined || (key in Object(object)));
  };
}
var _matchesStrictComparable_default = matchesStrictComparable;

// ../../node_modules/lodash-es/_baseMatches.js
function baseMatches(source) {
  var matchData = _getMatchData_default(source);
  if (matchData.length == 1 && matchData[0][2]) {
    return _matchesStrictComparable_default(matchData[0][0], matchData[0][1]);
  }
  return function(object) {
    return object === source || _baseIsMatch_default(object, source, matchData);
  };
}
var _baseMatches_default = baseMatches;

// ../../node_modules/lodash-es/_isKey.js
var reIsDeepProp = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/;
var reIsPlainProp = /^\w*$/;
function isKey(value, object) {
  if (isArray_default(value)) {
    return false;
  }
  var type = typeof value;
  if (type == "number" || type == "symbol" || type == "boolean" || value == null || isSymbol_default(value)) {
    return true;
  }
  return reIsPlainProp.test(value) || !reIsDeepProp.test(value) || object != null && value in Object(object);
}
var _isKey_default = isKey;

// ../../node_modules/lodash-es/memoize.js
var FUNC_ERROR_TEXT = "Expected a function";
function memoize(func, resolver) {
  if (typeof func != "function" || resolver != null && typeof resolver != "function") {
    throw new TypeError(FUNC_ERROR_TEXT);
  }
  var memoized = function() {
    var args = arguments, key = resolver ? resolver.apply(this, args) : args[0], cache = memoized.cache;
    if (cache.has(key)) {
      return cache.get(key);
    }
    var result = func.apply(this, args);
    memoized.cache = cache.set(key, result) || cache;
    return result;
  };
  memoized.cache = new (memoize.Cache || _MapCache_default);
  return memoized;
}
memoize.Cache = _MapCache_default;
var memoize_default = memoize;

// ../../node_modules/lodash-es/_memoizeCapped.js
var MAX_MEMOIZE_SIZE = 500;
function memoizeCapped(func) {
  var result = memoize_default(func, function(key) {
    if (cache.size === MAX_MEMOIZE_SIZE) {
      cache.clear();
    }
    return key;
  });
  var cache = result.cache;
  return result;
}
var _memoizeCapped_default = memoizeCapped;

// ../../node_modules/lodash-es/_stringToPath.js
var rePropName = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g;
var reEscapeChar = /\\(\\)?/g;
var stringToPath = _memoizeCapped_default(function(string) {
  var result = [];
  if (string.charCodeAt(0) === 46) {
    result.push("");
  }
  string.replace(rePropName, function(match, number, quote, subString) {
    result.push(quote ? subString.replace(reEscapeChar, "$1") : number || match);
  });
  return result;
});
var _stringToPath_default = stringToPath;

// ../../node_modules/lodash-es/_baseToString.js
var INFINITY2 = 1 / 0;
var symbolProto3 = _Symbol_default ? _Symbol_default.prototype : undefined;
var symbolToString = symbolProto3 ? symbolProto3.toString : undefined;
function baseToString(value) {
  if (typeof value == "string") {
    return value;
  }
  if (isArray_default(value)) {
    return _arrayMap_default(value, baseToString) + "";
  }
  if (isSymbol_default(value)) {
    return symbolToString ? symbolToString.call(value) : "";
  }
  var result = value + "";
  return result == "0" && 1 / value == -INFINITY2 ? "-0" : result;
}
var _baseToString_default = baseToString;

// ../../node_modules/lodash-es/toString.js
function toString(value) {
  return value == null ? "" : _baseToString_default(value);
}
var toString_default = toString;

// ../../node_modules/lodash-es/_castPath.js
function castPath(value, object) {
  if (isArray_default(value)) {
    return value;
  }
  return _isKey_default(value, object) ? [value] : _stringToPath_default(toString_default(value));
}
var _castPath_default = castPath;

// ../../node_modules/lodash-es/_toKey.js
var INFINITY3 = 1 / 0;
function toKey(value) {
  if (typeof value == "string" || isSymbol_default(value)) {
    return value;
  }
  var result = value + "";
  return result == "0" && 1 / value == -INFINITY3 ? "-0" : result;
}
var _toKey_default = toKey;

// ../../node_modules/lodash-es/_baseGet.js
function baseGet(object, path) {
  path = _castPath_default(path, object);
  var index = 0, length = path.length;
  while (object != null && index < length) {
    object = object[_toKey_default(path[index++])];
  }
  return index && index == length ? object : undefined;
}
var _baseGet_default = baseGet;

// ../../node_modules/lodash-es/get.js
function get(object, path, defaultValue) {
  var result = object == null ? undefined : _baseGet_default(object, path);
  return result === undefined ? defaultValue : result;
}
var get_default = get;

// ../../node_modules/lodash-es/_baseHasIn.js
function baseHasIn(object, key) {
  return object != null && key in Object(object);
}
var _baseHasIn_default = baseHasIn;

// ../../node_modules/lodash-es/_hasPath.js
function hasPath(object, path, hasFunc) {
  path = _castPath_default(path, object);
  var index = -1, length = path.length, result = false;
  while (++index < length) {
    var key = _toKey_default(path[index]);
    if (!(result = object != null && hasFunc(object, key))) {
      break;
    }
    object = object[key];
  }
  if (result || ++index != length) {
    return result;
  }
  length = object == null ? 0 : object.length;
  return !!length && isLength_default(length) && _isIndex_default(key, length) && (isArray_default(object) || isArguments_default(object));
}
var _hasPath_default = hasPath;

// ../../node_modules/lodash-es/hasIn.js
function hasIn(object, path) {
  return object != null && _hasPath_default(object, path, _baseHasIn_default);
}
var hasIn_default = hasIn;

// ../../node_modules/lodash-es/_baseMatchesProperty.js
var COMPARE_PARTIAL_FLAG6 = 1;
var COMPARE_UNORDERED_FLAG4 = 2;
function baseMatchesProperty(path, srcValue) {
  if (_isKey_default(path) && _isStrictComparable_default(srcValue)) {
    return _matchesStrictComparable_default(_toKey_default(path), srcValue);
  }
  return function(object) {
    var objValue = get_default(object, path);
    return objValue === undefined && objValue === srcValue ? hasIn_default(object, path) : _baseIsEqual_default(srcValue, objValue, COMPARE_PARTIAL_FLAG6 | COMPARE_UNORDERED_FLAG4);
  };
}
var _baseMatchesProperty_default = baseMatchesProperty;

// ../../node_modules/lodash-es/_baseProperty.js
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}
var _baseProperty_default = baseProperty;

// ../../node_modules/lodash-es/_basePropertyDeep.js
function basePropertyDeep(path) {
  return function(object) {
    return _baseGet_default(object, path);
  };
}
var _basePropertyDeep_default = basePropertyDeep;

// ../../node_modules/lodash-es/property.js
function property(path) {
  return _isKey_default(path) ? _baseProperty_default(_toKey_default(path)) : _basePropertyDeep_default(path);
}
var property_default = property;

// ../../node_modules/lodash-es/_baseIteratee.js
function baseIteratee(value) {
  if (typeof value == "function") {
    return value;
  }
  if (value == null) {
    return identity_default;
  }
  if (typeof value == "object") {
    return isArray_default(value) ? _baseMatchesProperty_default(value[0], value[1]) : _baseMatches_default(value);
  }
  return property_default(value);
}
var _baseIteratee_default = baseIteratee;

// ../../node_modules/lodash-es/every.js
function every(collection, predicate, guard) {
  var func = isArray_default(collection) ? _arrayEvery_default : _baseEvery_default;
  if (guard && _isIterateeCall_default(collection, predicate, guard)) {
    predicate = undefined;
  }
  return func(collection, _baseIteratee_default(predicate, 3));
}
var every_default = every;
// ../../node_modules/lodash-es/_baseFilter.js
function baseFilter(collection, predicate) {
  var result = [];
  _baseEach_default(collection, function(value, index, collection2) {
    if (predicate(value, index, collection2)) {
      result.push(value);
    }
  });
  return result;
}
var _baseFilter_default = baseFilter;

// ../../node_modules/lodash-es/filter.js
function filter(collection, predicate) {
  var func = isArray_default(collection) ? _arrayFilter_default : _baseFilter_default;
  return func(collection, _baseIteratee_default(predicate, 3));
}
var filter_default = filter;
// ../../node_modules/lodash-es/_createFind.js
function createFind(findIndexFunc) {
  return function(collection, predicate, fromIndex) {
    var iterable = Object(collection);
    if (!isArrayLike_default(collection)) {
      var iteratee = _baseIteratee_default(predicate, 3);
      collection = keys_default(collection);
      predicate = function(key) {
        return iteratee(iterable[key], key, iterable);
      };
    }
    var index = findIndexFunc(collection, predicate, fromIndex);
    return index > -1 ? iterable[iteratee ? collection[index] : index] : undefined;
  };
}
var _createFind_default = createFind;

// ../../node_modules/lodash-es/findIndex.js
var nativeMax2 = Math.max;
function findIndex(array, predicate, fromIndex) {
  var length = array == null ? 0 : array.length;
  if (!length) {
    return -1;
  }
  var index = fromIndex == null ? 0 : toInteger_default(fromIndex);
  if (index < 0) {
    index = nativeMax2(length + index, 0);
  }
  return _baseFindIndex_default(array, _baseIteratee_default(predicate, 3), index);
}
var findIndex_default = findIndex;

// ../../node_modules/lodash-es/find.js
var find = _createFind_default(findIndex_default);
var find_default = find;
// ../../node_modules/lodash-es/head.js
function head(array) {
  return array && array.length ? array[0] : undefined;
}
var head_default = head;
// ../../node_modules/lodash-es/_baseMap.js
function baseMap(collection, iteratee) {
  var index = -1, result = isArrayLike_default(collection) ? Array(collection.length) : [];
  _baseEach_default(collection, function(value, key, collection2) {
    result[++index] = iteratee(value, key, collection2);
  });
  return result;
}
var _baseMap_default = baseMap;

// ../../node_modules/lodash-es/map.js
function map(collection, iteratee) {
  var func = isArray_default(collection) ? _arrayMap_default : _baseMap_default;
  return func(collection, _baseIteratee_default(iteratee, 3));
}
var map_default = map;

// ../../node_modules/lodash-es/flatMap.js
function flatMap(collection, iteratee) {
  return _baseFlatten_default(map_default(collection, iteratee), 1);
}
var flatMap_default = flatMap;
// ../../node_modules/lodash-es/flatten.js
function flatten(array) {
  var length = array == null ? 0 : array.length;
  return length ? _baseFlatten_default(array, 1) : [];
}
var flatten_default = flatten;
// ../../node_modules/lodash-es/_castFunction.js
function castFunction(value) {
  return typeof value == "function" ? value : identity_default;
}
var _castFunction_default = castFunction;

// ../../node_modules/lodash-es/forEach.js
function forEach(collection, iteratee) {
  var func = isArray_default(collection) ? _arrayEach_default : _baseEach_default;
  return func(collection, _castFunction_default(iteratee));
}
var forEach_default = forEach;
// ../../node_modules/lodash-es/_arrayAggregator.js
function arrayAggregator(array, setter, iteratee, accumulator) {
  var index = -1, length = array == null ? 0 : array.length;
  while (++index < length) {
    var value = array[index];
    setter(accumulator, value, iteratee(value), array);
  }
  return accumulator;
}
var _arrayAggregator_default = arrayAggregator;

// ../../node_modules/lodash-es/_baseAggregator.js
function baseAggregator(collection, setter, iteratee, accumulator) {
  _baseEach_default(collection, function(value, key, collection2) {
    setter(accumulator, value, iteratee(value), collection2);
  });
  return accumulator;
}
var _baseAggregator_default = baseAggregator;

// ../../node_modules/lodash-es/_createAggregator.js
function createAggregator(setter, initializer) {
  return function(collection, iteratee) {
    var func = isArray_default(collection) ? _arrayAggregator_default : _baseAggregator_default, accumulator = initializer ? initializer() : {};
    return func(collection, setter, _baseIteratee_default(iteratee, 2), accumulator);
  };
}
var _createAggregator_default = createAggregator;

// ../../node_modules/lodash-es/groupBy.js
var objectProto18 = Object.prototype;
var hasOwnProperty15 = objectProto18.hasOwnProperty;
var groupBy = _createAggregator_default(function(result, value, key) {
  if (hasOwnProperty15.call(result, key)) {
    result[key].push(value);
  } else {
    _baseAssignValue_default(result, key, [value]);
  }
});
var groupBy_default = groupBy;
// ../../node_modules/lodash-es/_baseHas.js
var objectProto19 = Object.prototype;
var hasOwnProperty16 = objectProto19.hasOwnProperty;
function baseHas(object, key) {
  return object != null && hasOwnProperty16.call(object, key);
}
var _baseHas_default = baseHas;

// ../../node_modules/lodash-es/has.js
function has(object, path) {
  return object != null && _hasPath_default(object, path, _baseHas_default);
}
var has_default = has;
// ../../node_modules/lodash-es/isString.js
var stringTag5 = "[object String]";
function isString(value) {
  return typeof value == "string" || !isArray_default(value) && isObjectLike_default(value) && _baseGetTag_default(value) == stringTag5;
}
var isString_default = isString;

// ../../node_modules/lodash-es/_baseValues.js
function baseValues(object, props) {
  return _arrayMap_default(props, function(key) {
    return object[key];
  });
}
var _baseValues_default = baseValues;

// ../../node_modules/lodash-es/values.js
function values(object) {
  return object == null ? [] : _baseValues_default(object, keys_default(object));
}
var values_default = values;

// ../../node_modules/lodash-es/includes.js
var nativeMax3 = Math.max;
function includes(collection, value, fromIndex, guard) {
  collection = isArrayLike_default(collection) ? collection : values_default(collection);
  fromIndex = fromIndex && !guard ? toInteger_default(fromIndex) : 0;
  var length = collection.length;
  if (fromIndex < 0) {
    fromIndex = nativeMax3(length + fromIndex, 0);
  }
  return isString_default(collection) ? fromIndex <= length && collection.indexOf(value, fromIndex) > -1 : !!length && _baseIndexOf_default(collection, value, fromIndex) > -1;
}
var includes_default = includes;
// ../../node_modules/lodash-es/indexOf.js
var nativeMax4 = Math.max;
function indexOf(array, value, fromIndex) {
  var length = array == null ? 0 : array.length;
  if (!length) {
    return -1;
  }
  var index = fromIndex == null ? 0 : toInteger_default(fromIndex);
  if (index < 0) {
    index = nativeMax4(length + index, 0);
  }
  return _baseIndexOf_default(array, value, index);
}
var indexOf_default = indexOf;
// ../../node_modules/lodash-es/isEmpty.js
var mapTag7 = "[object Map]";
var setTag7 = "[object Set]";
var objectProto20 = Object.prototype;
var hasOwnProperty17 = objectProto20.hasOwnProperty;
function isEmpty(value) {
  if (value == null) {
    return true;
  }
  if (isArrayLike_default(value) && (isArray_default(value) || typeof value == "string" || typeof value.splice == "function" || isBuffer_default(value) || isTypedArray_default(value) || isArguments_default(value))) {
    return !value.length;
  }
  var tag = _getTag_default(value);
  if (tag == mapTag7 || tag == setTag7) {
    return !value.size;
  }
  if (_isPrototype_default(value)) {
    return !_baseKeys_default(value).length;
  }
  for (var key in value) {
    if (hasOwnProperty17.call(value, key)) {
      return false;
    }
  }
  return true;
}
var isEmpty_default = isEmpty;
// ../../node_modules/lodash-es/_baseIsRegExp.js
var regexpTag5 = "[object RegExp]";
function baseIsRegExp(value) {
  return isObjectLike_default(value) && _baseGetTag_default(value) == regexpTag5;
}
var _baseIsRegExp_default = baseIsRegExp;

// ../../node_modules/lodash-es/isRegExp.js
var nodeIsRegExp = _nodeUtil_default && _nodeUtil_default.isRegExp;
var isRegExp = nodeIsRegExp ? _baseUnary_default(nodeIsRegExp) : _baseIsRegExp_default;
var isRegExp_default = isRegExp;
// ../../node_modules/lodash-es/isUndefined.js
function isUndefined(value) {
  return value === undefined;
}
var isUndefined_default = isUndefined;
// ../../node_modules/lodash-es/last.js
function last(array) {
  var length = array == null ? 0 : array.length;
  return length ? array[length - 1] : undefined;
}
var last_default = last;
// ../../node_modules/lodash-es/noop.js
function noop() {}
var noop_default = noop;
// ../../node_modules/lodash-es/_baseSet.js
function baseSet(object, path, value, customizer) {
  if (!isObject_default(object)) {
    return object;
  }
  path = _castPath_default(path, object);
  var index = -1, length = path.length, lastIndex = length - 1, nested = object;
  while (nested != null && ++index < length) {
    var key = _toKey_default(path[index]), newValue = value;
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      return object;
    }
    if (index != lastIndex) {
      var objValue = nested[key];
      newValue = customizer ? customizer(objValue, key, nested) : undefined;
      if (newValue === undefined) {
        newValue = isObject_default(objValue) ? objValue : _isIndex_default(path[index + 1]) ? [] : {};
      }
    }
    _assignValue_default(nested, key, newValue);
    nested = nested[key];
  }
  return object;
}
var _baseSet_default = baseSet;

// ../../node_modules/lodash-es/_basePickBy.js
function basePickBy(object, paths, predicate) {
  var index = -1, length = paths.length, result = {};
  while (++index < length) {
    var path = paths[index], value = _baseGet_default(object, path);
    if (predicate(value, path)) {
      _baseSet_default(result, _castPath_default(path, object), value);
    }
  }
  return result;
}
var _basePickBy_default = basePickBy;

// ../../node_modules/lodash-es/pickBy.js
function pickBy(object, predicate) {
  if (object == null) {
    return {};
  }
  var props = _arrayMap_default(_getAllKeysIn_default(object), function(prop) {
    return [prop];
  });
  predicate = _baseIteratee_default(predicate);
  return _basePickBy_default(object, props, function(value, path) {
    return predicate(value, path[0]);
  });
}
var pickBy_default = pickBy;
// ../../node_modules/lodash-es/_arrayReduce.js
function arrayReduce(array, iteratee, accumulator, initAccum) {
  var index = -1, length = array == null ? 0 : array.length;
  if (initAccum && length) {
    accumulator = array[++index];
  }
  while (++index < length) {
    accumulator = iteratee(accumulator, array[index], index, array);
  }
  return accumulator;
}
var _arrayReduce_default = arrayReduce;

// ../../node_modules/lodash-es/_baseReduce.js
function baseReduce(collection, iteratee, accumulator, initAccum, eachFunc) {
  eachFunc(collection, function(value, index, collection2) {
    accumulator = initAccum ? (initAccum = false, value) : iteratee(accumulator, value, index, collection2);
  });
  return accumulator;
}
var _baseReduce_default = baseReduce;

// ../../node_modules/lodash-es/reduce.js
function reduce(collection, iteratee, accumulator) {
  var func = isArray_default(collection) ? _arrayReduce_default : _baseReduce_default, initAccum = arguments.length < 3;
  return func(collection, _baseIteratee_default(iteratee, 4), accumulator, initAccum, _baseEach_default);
}
var reduce_default = reduce;
// ../../node_modules/lodash-es/negate.js
var FUNC_ERROR_TEXT2 = "Expected a function";
function negate(predicate) {
  if (typeof predicate != "function") {
    throw new TypeError(FUNC_ERROR_TEXT2);
  }
  return function() {
    var args = arguments;
    switch (args.length) {
      case 0:
        return !predicate.call(this);
      case 1:
        return !predicate.call(this, args[0]);
      case 2:
        return !predicate.call(this, args[0], args[1]);
      case 3:
        return !predicate.call(this, args[0], args[1], args[2]);
    }
    return !predicate.apply(this, args);
  };
}
var negate_default = negate;

// ../../node_modules/lodash-es/reject.js
function reject(collection, predicate) {
  var func = isArray_default(collection) ? _arrayFilter_default : _baseFilter_default;
  return func(collection, negate_default(_baseIteratee_default(predicate, 3)));
}
var reject_default = reject;
// ../../node_modules/lodash-es/_baseSome.js
function baseSome(collection, predicate) {
  var result;
  _baseEach_default(collection, function(value, index, collection2) {
    result = predicate(value, index, collection2);
    return !result;
  });
  return !!result;
}
var _baseSome_default = baseSome;

// ../../node_modules/lodash-es/some.js
function some(collection, predicate, guard) {
  var func = isArray_default(collection) ? _arraySome_default : _baseSome_default;
  if (guard && _isIterateeCall_default(collection, predicate, guard)) {
    predicate = undefined;
  }
  return func(collection, _baseIteratee_default(predicate, 3));
}
var some_default = some;
// ../../node_modules/lodash-es/_createSet.js
var INFINITY4 = 1 / 0;
var createSet = !(_Set_default && 1 / _setToArray_default(new _Set_default([, -0]))[1] == INFINITY4) ? noop_default : function(values2) {
  return new _Set_default(values2);
};
var _createSet_default = createSet;

// ../../node_modules/lodash-es/_baseUniq.js
var LARGE_ARRAY_SIZE3 = 200;
function baseUniq(array, iteratee, comparator) {
  var index = -1, includes2 = _arrayIncludes_default, length = array.length, isCommon = true, result = [], seen = result;
  if (comparator) {
    isCommon = false;
    includes2 = _arrayIncludesWith_default;
  } else if (length >= LARGE_ARRAY_SIZE3) {
    var set = iteratee ? null : _createSet_default(array);
    if (set) {
      return _setToArray_default(set);
    }
    isCommon = false;
    includes2 = _cacheHas_default;
    seen = new _SetCache_default;
  } else {
    seen = iteratee ? [] : result;
  }
  outer:
    while (++index < length) {
      var value = array[index], computed = iteratee ? iteratee(value) : value;
      value = comparator || value !== 0 ? value : 0;
      if (isCommon && computed === computed) {
        var seenIndex = seen.length;
        while (seenIndex--) {
          if (seen[seenIndex] === computed) {
            continue outer;
          }
        }
        if (iteratee) {
          seen.push(computed);
        }
        result.push(value);
      } else if (!includes2(seen, computed, comparator)) {
        if (seen !== result) {
          seen.push(computed);
        }
        result.push(value);
      }
    }
  return result;
}
var _baseUniq_default = baseUniq;

// ../../node_modules/lodash-es/uniq.js
function uniq(array) {
  return array && array.length ? _baseUniq_default(array) : [];
}
var uniq_default = uniq;
// ../../node_modules/@chevrotain/utils/lib/src/print.js
function PRINT_ERROR(msg) {
  if (console && console.error) {
    console.error(`Error: ${msg}`);
  }
}
function PRINT_WARNING(msg) {
  if (console && console.warn) {
    console.warn(`Warning: ${msg}`);
  }
}
// ../../node_modules/@chevrotain/utils/lib/src/timer.js
function timer(func) {
  const start = new Date().getTime();
  const val = func();
  const end = new Date().getTime();
  const total = end - start;
  return { time: total, value: val };
}
// ../../node_modules/@chevrotain/utils/lib/src/to-fast-properties.js
function toFastProperties(toBecomeFast) {
  function FakeConstructor() {}
  FakeConstructor.prototype = toBecomeFast;
  const fakeInstance = new FakeConstructor;
  function fakeAccess() {
    return typeof fakeInstance.bar;
  }
  fakeAccess();
  fakeAccess();
  if (1)
    return toBecomeFast;
  (0, eval)(toBecomeFast);
}
// ../../node_modules/@chevrotain/gast/lib/src/model.js
function tokenLabel(tokType) {
  if (hasTokenLabel(tokType)) {
    return tokType.LABEL;
  } else {
    return tokType.name;
  }
}
function hasTokenLabel(obj) {
  return isString_default(obj.LABEL) && obj.LABEL !== "";
}

class AbstractProduction {
  get definition() {
    return this._definition;
  }
  set definition(value) {
    this._definition = value;
  }
  constructor(_definition) {
    this._definition = _definition;
  }
  accept(visitor) {
    visitor.visit(this);
    forEach_default(this.definition, (prod) => {
      prod.accept(visitor);
    });
  }
}

class NonTerminal extends AbstractProduction {
  constructor(options) {
    super([]);
    this.idx = 1;
    assign_default(this, pickBy_default(options, (v) => v !== undefined));
  }
  set definition(definition) {}
  get definition() {
    if (this.referencedRule !== undefined) {
      return this.referencedRule.definition;
    }
    return [];
  }
  accept(visitor) {
    visitor.visit(this);
  }
}

class Rule extends AbstractProduction {
  constructor(options) {
    super(options.definition);
    this.orgText = "";
    assign_default(this, pickBy_default(options, (v) => v !== undefined));
  }
}

class Alternative extends AbstractProduction {
  constructor(options) {
    super(options.definition);
    this.ignoreAmbiguities = false;
    assign_default(this, pickBy_default(options, (v) => v !== undefined));
  }
}

class Option extends AbstractProduction {
  constructor(options) {
    super(options.definition);
    this.idx = 1;
    assign_default(this, pickBy_default(options, (v) => v !== undefined));
  }
}

class RepetitionMandatory extends AbstractProduction {
  constructor(options) {
    super(options.definition);
    this.idx = 1;
    assign_default(this, pickBy_default(options, (v) => v !== undefined));
  }
}

class RepetitionMandatoryWithSeparator extends AbstractProduction {
  constructor(options) {
    super(options.definition);
    this.idx = 1;
    assign_default(this, pickBy_default(options, (v) => v !== undefined));
  }
}

class Repetition extends AbstractProduction {
  constructor(options) {
    super(options.definition);
    this.idx = 1;
    assign_default(this, pickBy_default(options, (v) => v !== undefined));
  }
}

class RepetitionWithSeparator extends AbstractProduction {
  constructor(options) {
    super(options.definition);
    this.idx = 1;
    assign_default(this, pickBy_default(options, (v) => v !== undefined));
  }
}

class Alternation extends AbstractProduction {
  get definition() {
    return this._definition;
  }
  set definition(value) {
    this._definition = value;
  }
  constructor(options) {
    super(options.definition);
    this.idx = 1;
    this.ignoreAmbiguities = false;
    this.hasPredicates = false;
    assign_default(this, pickBy_default(options, (v) => v !== undefined));
  }
}

class Terminal {
  constructor(options) {
    this.idx = 1;
    assign_default(this, pickBy_default(options, (v) => v !== undefined));
  }
  accept(visitor) {
    visitor.visit(this);
  }
}
function serializeGrammar(topRules) {
  return map_default(topRules, serializeProduction);
}
function serializeProduction(node) {
  function convertDefinition(definition) {
    return map_default(definition, serializeProduction);
  }
  if (node instanceof NonTerminal) {
    const serializedNonTerminal = {
      type: "NonTerminal",
      name: node.nonTerminalName,
      idx: node.idx
    };
    if (isString_default(node.label)) {
      serializedNonTerminal.label = node.label;
    }
    return serializedNonTerminal;
  } else if (node instanceof Alternative) {
    return {
      type: "Alternative",
      definition: convertDefinition(node.definition)
    };
  } else if (node instanceof Option) {
    return {
      type: "Option",
      idx: node.idx,
      definition: convertDefinition(node.definition)
    };
  } else if (node instanceof RepetitionMandatory) {
    return {
      type: "RepetitionMandatory",
      idx: node.idx,
      definition: convertDefinition(node.definition)
    };
  } else if (node instanceof RepetitionMandatoryWithSeparator) {
    return {
      type: "RepetitionMandatoryWithSeparator",
      idx: node.idx,
      separator: serializeProduction(new Terminal({ terminalType: node.separator })),
      definition: convertDefinition(node.definition)
    };
  } else if (node instanceof RepetitionWithSeparator) {
    return {
      type: "RepetitionWithSeparator",
      idx: node.idx,
      separator: serializeProduction(new Terminal({ terminalType: node.separator })),
      definition: convertDefinition(node.definition)
    };
  } else if (node instanceof Repetition) {
    return {
      type: "Repetition",
      idx: node.idx,
      definition: convertDefinition(node.definition)
    };
  } else if (node instanceof Alternation) {
    return {
      type: "Alternation",
      idx: node.idx,
      definition: convertDefinition(node.definition)
    };
  } else if (node instanceof Terminal) {
    const serializedTerminal = {
      type: "Terminal",
      name: node.terminalType.name,
      label: tokenLabel(node.terminalType),
      idx: node.idx
    };
    if (isString_default(node.label)) {
      serializedTerminal.terminalLabel = node.label;
    }
    const pattern = node.terminalType.PATTERN;
    if (node.terminalType.PATTERN) {
      serializedTerminal.pattern = isRegExp_default(pattern) ? pattern.source : pattern;
    }
    return serializedTerminal;
  } else if (node instanceof Rule) {
    return {
      type: "Rule",
      name: node.name,
      orgText: node.orgText,
      definition: convertDefinition(node.definition)
    };
  } else {
    throw Error("non exhaustive match");
  }
}
// ../../node_modules/@chevrotain/gast/lib/src/visitor.js
class GAstVisitor {
  visit(node) {
    const nodeAny = node;
    switch (nodeAny.constructor) {
      case NonTerminal:
        return this.visitNonTerminal(nodeAny);
      case Alternative:
        return this.visitAlternative(nodeAny);
      case Option:
        return this.visitOption(nodeAny);
      case RepetitionMandatory:
        return this.visitRepetitionMandatory(nodeAny);
      case RepetitionMandatoryWithSeparator:
        return this.visitRepetitionMandatoryWithSeparator(nodeAny);
      case RepetitionWithSeparator:
        return this.visitRepetitionWithSeparator(nodeAny);
      case Repetition:
        return this.visitRepetition(nodeAny);
      case Alternation:
        return this.visitAlternation(nodeAny);
      case Terminal:
        return this.visitTerminal(nodeAny);
      case Rule:
        return this.visitRule(nodeAny);
      default:
        throw Error("non exhaustive match");
    }
  }
  visitNonTerminal(node) {}
  visitAlternative(node) {}
  visitOption(node) {}
  visitRepetition(node) {}
  visitRepetitionMandatory(node) {}
  visitRepetitionMandatoryWithSeparator(node) {}
  visitRepetitionWithSeparator(node) {}
  visitAlternation(node) {}
  visitTerminal(node) {}
  visitRule(node) {}
}
// ../../node_modules/@chevrotain/gast/lib/src/helpers.js
function isSequenceProd(prod) {
  return prod instanceof Alternative || prod instanceof Option || prod instanceof Repetition || prod instanceof RepetitionMandatory || prod instanceof RepetitionMandatoryWithSeparator || prod instanceof RepetitionWithSeparator || prod instanceof Terminal || prod instanceof Rule;
}
function isOptionalProd(prod, alreadyVisited = []) {
  const isDirectlyOptional = prod instanceof Option || prod instanceof Repetition || prod instanceof RepetitionWithSeparator;
  if (isDirectlyOptional) {
    return true;
  }
  if (prod instanceof Alternation) {
    return some_default(prod.definition, (subProd) => {
      return isOptionalProd(subProd, alreadyVisited);
    });
  } else if (prod instanceof NonTerminal && includes_default(alreadyVisited, prod)) {
    return false;
  } else if (prod instanceof AbstractProduction) {
    if (prod instanceof NonTerminal) {
      alreadyVisited.push(prod);
    }
    return every_default(prod.definition, (subProd) => {
      return isOptionalProd(subProd, alreadyVisited);
    });
  } else {
    return false;
  }
}
function isBranchingProd(prod) {
  return prod instanceof Alternation;
}
function getProductionDslName(prod) {
  if (prod instanceof NonTerminal) {
    return "SUBRULE";
  } else if (prod instanceof Option) {
    return "OPTION";
  } else if (prod instanceof Alternation) {
    return "OR";
  } else if (prod instanceof RepetitionMandatory) {
    return "AT_LEAST_ONE";
  } else if (prod instanceof RepetitionMandatoryWithSeparator) {
    return "AT_LEAST_ONE_SEP";
  } else if (prod instanceof RepetitionWithSeparator) {
    return "MANY_SEP";
  } else if (prod instanceof Repetition) {
    return "MANY";
  } else if (prod instanceof Terminal) {
    return "CONSUME";
  } else {
    throw Error("non exhaustive match");
  }
}
// ../../node_modules/chevrotain/lib/src/parse/grammar/rest.js
class RestWalker {
  walk(prod, prevRest = []) {
    forEach_default(prod.definition, (subProd, index) => {
      const currRest = drop_default(prod.definition, index + 1);
      if (subProd instanceof NonTerminal) {
        this.walkProdRef(subProd, currRest, prevRest);
      } else if (subProd instanceof Terminal) {
        this.walkTerminal(subProd, currRest, prevRest);
      } else if (subProd instanceof Alternative) {
        this.walkFlat(subProd, currRest, prevRest);
      } else if (subProd instanceof Option) {
        this.walkOption(subProd, currRest, prevRest);
      } else if (subProd instanceof RepetitionMandatory) {
        this.walkAtLeastOne(subProd, currRest, prevRest);
      } else if (subProd instanceof RepetitionMandatoryWithSeparator) {
        this.walkAtLeastOneSep(subProd, currRest, prevRest);
      } else if (subProd instanceof RepetitionWithSeparator) {
        this.walkManySep(subProd, currRest, prevRest);
      } else if (subProd instanceof Repetition) {
        this.walkMany(subProd, currRest, prevRest);
      } else if (subProd instanceof Alternation) {
        this.walkOr(subProd, currRest, prevRest);
      } else {
        throw Error("non exhaustive match");
      }
    });
  }
  walkTerminal(terminal, currRest, prevRest) {}
  walkProdRef(refProd, currRest, prevRest) {}
  walkFlat(flatProd, currRest, prevRest) {
    const fullOrRest = currRest.concat(prevRest);
    this.walk(flatProd, fullOrRest);
  }
  walkOption(optionProd, currRest, prevRest) {
    const fullOrRest = currRest.concat(prevRest);
    this.walk(optionProd, fullOrRest);
  }
  walkAtLeastOne(atLeastOneProd, currRest, prevRest) {
    const fullAtLeastOneRest = [
      new Option({ definition: atLeastOneProd.definition })
    ].concat(currRest, prevRest);
    this.walk(atLeastOneProd, fullAtLeastOneRest);
  }
  walkAtLeastOneSep(atLeastOneSepProd, currRest, prevRest) {
    const fullAtLeastOneSepRest = restForRepetitionWithSeparator(atLeastOneSepProd, currRest, prevRest);
    this.walk(atLeastOneSepProd, fullAtLeastOneSepRest);
  }
  walkMany(manyProd, currRest, prevRest) {
    const fullManyRest = [
      new Option({ definition: manyProd.definition })
    ].concat(currRest, prevRest);
    this.walk(manyProd, fullManyRest);
  }
  walkManySep(manySepProd, currRest, prevRest) {
    const fullManySepRest = restForRepetitionWithSeparator(manySepProd, currRest, prevRest);
    this.walk(manySepProd, fullManySepRest);
  }
  walkOr(orProd, currRest, prevRest) {
    const fullOrRest = currRest.concat(prevRest);
    forEach_default(orProd.definition, (alt) => {
      const prodWrapper = new Alternative({ definition: [alt] });
      this.walk(prodWrapper, fullOrRest);
    });
  }
}
function restForRepetitionWithSeparator(repSepProd, currRest, prevRest) {
  const repSepRest = [
    new Option({
      definition: [
        new Terminal({ terminalType: repSepProd.separator })
      ].concat(repSepProd.definition)
    })
  ];
  const fullRepSepRest = repSepRest.concat(currRest, prevRest);
  return fullRepSepRest;
}

// ../../node_modules/chevrotain/lib/src/parse/grammar/first.js
function first(prod) {
  if (prod instanceof NonTerminal) {
    return first(prod.referencedRule);
  } else if (prod instanceof Terminal) {
    return firstForTerminal(prod);
  } else if (isSequenceProd(prod)) {
    return firstForSequence(prod);
  } else if (isBranchingProd(prod)) {
    return firstForBranching(prod);
  } else {
    throw Error("non exhaustive match");
  }
}
function firstForSequence(prod) {
  let firstSet = [];
  const seq = prod.definition;
  let nextSubProdIdx = 0;
  let hasInnerProdsRemaining = seq.length > nextSubProdIdx;
  let currSubProd;
  let isLastInnerProdOptional = true;
  while (hasInnerProdsRemaining && isLastInnerProdOptional) {
    currSubProd = seq[nextSubProdIdx];
    isLastInnerProdOptional = isOptionalProd(currSubProd);
    firstSet = firstSet.concat(first(currSubProd));
    nextSubProdIdx = nextSubProdIdx + 1;
    hasInnerProdsRemaining = seq.length > nextSubProdIdx;
  }
  return uniq_default(firstSet);
}
function firstForBranching(prod) {
  const allAlternativesFirsts = map_default(prod.definition, (innerProd) => {
    return first(innerProd);
  });
  return uniq_default(flatten_default(allAlternativesFirsts));
}
function firstForTerminal(terminal) {
  return [terminal.terminalType];
}

// ../../node_modules/chevrotain/lib/src/parse/constants.js
var IN = "_~IN~_";

// ../../node_modules/chevrotain/lib/src/parse/grammar/follow.js
class ResyncFollowsWalker extends RestWalker {
  constructor(topProd) {
    super();
    this.topProd = topProd;
    this.follows = {};
  }
  startWalking() {
    this.walk(this.topProd);
    return this.follows;
  }
  walkTerminal(terminal, currRest, prevRest) {}
  walkProdRef(refProd, currRest, prevRest) {
    const followName = buildBetweenProdsFollowPrefix(refProd.referencedRule, refProd.idx) + this.topProd.name;
    const fullRest = currRest.concat(prevRest);
    const restProd = new Alternative({ definition: fullRest });
    const t_in_topProd_follows = first(restProd);
    this.follows[followName] = t_in_topProd_follows;
  }
}
function computeAllProdsFollows(topProductions) {
  const reSyncFollows = {};
  forEach_default(topProductions, (topProd) => {
    const currRefsFollow = new ResyncFollowsWalker(topProd).startWalking();
    assign_default(reSyncFollows, currRefsFollow);
  });
  return reSyncFollows;
}
function buildBetweenProdsFollowPrefix(inner, occurenceInParent) {
  return inner.name + occurenceInParent + IN;
}

// ../../node_modules/@chevrotain/regexp-to-ast/lib/src/utils.js
function cc(char) {
  return char.charCodeAt(0);
}
function insertToSet(item, set) {
  if (Array.isArray(item)) {
    item.forEach(function(subItem) {
      set.push(subItem);
    });
  } else {
    set.push(item);
  }
}
function addFlag(flagObj, flagKey) {
  if (flagObj[flagKey] === true) {
    throw "duplicate flag " + flagKey;
  }
  const x = flagObj[flagKey];
  flagObj[flagKey] = true;
}
function ASSERT_EXISTS(obj) {
  if (obj === undefined) {
    throw Error("Internal Error - Should never get here!");
  }
  return true;
}
function ASSERT_NEVER_REACH_HERE() {
  throw Error("Internal Error - Should never get here!");
}
function isCharacter(obj) {
  return obj["type"] === "Character";
}

// ../../node_modules/@chevrotain/regexp-to-ast/lib/src/character-classes.js
var digitsCharCodes = [];
for (let i = cc("0");i <= cc("9"); i++) {
  digitsCharCodes.push(i);
}
var wordCharCodes = [cc("_")].concat(digitsCharCodes);
for (let i = cc("a");i <= cc("z"); i++) {
  wordCharCodes.push(i);
}
for (let i = cc("A");i <= cc("Z"); i++) {
  wordCharCodes.push(i);
}
var whitespaceCodes = [
  cc(" "),
  cc("\f"),
  cc(`
`),
  cc("\r"),
  cc("\t"),
  cc("\v"),
  cc("\t"),
  cc(" "),
  cc(" "),
  cc(" "),
  cc(" "),
  cc(" "),
  cc(" "),
  cc(" "),
  cc(" "),
  cc(" "),
  cc(" "),
  cc(" "),
  cc(" "),
  cc(" "),
  cc("\u2028"),
  cc("\u2029"),
  cc(" "),
  cc(" "),
  cc("　"),
  cc("\uFEFF")
];

// ../../node_modules/@chevrotain/regexp-to-ast/lib/src/regexp-parser.js
var hexDigitPattern = /[0-9a-fA-F]/;
var decimalPattern = /[0-9]/;
var decimalPatternNoZero = /[1-9]/;

class RegExpParser {
  constructor() {
    this.idx = 0;
    this.input = "";
    this.groupIdx = 0;
  }
  saveState() {
    return {
      idx: this.idx,
      input: this.input,
      groupIdx: this.groupIdx
    };
  }
  restoreState(newState) {
    this.idx = newState.idx;
    this.input = newState.input;
    this.groupIdx = newState.groupIdx;
  }
  pattern(input) {
    this.idx = 0;
    this.input = input;
    this.groupIdx = 0;
    this.consumeChar("/");
    const value = this.disjunction();
    this.consumeChar("/");
    const flags = {
      type: "Flags",
      loc: { begin: this.idx, end: input.length },
      global: false,
      ignoreCase: false,
      multiLine: false,
      unicode: false,
      sticky: false
    };
    while (this.isRegExpFlag()) {
      switch (this.popChar()) {
        case "g":
          addFlag(flags, "global");
          break;
        case "i":
          addFlag(flags, "ignoreCase");
          break;
        case "m":
          addFlag(flags, "multiLine");
          break;
        case "u":
          addFlag(flags, "unicode");
          break;
        case "y":
          addFlag(flags, "sticky");
          break;
      }
    }
    if (this.idx !== this.input.length) {
      throw Error("Redundant input: " + this.input.substring(this.idx));
    }
    return {
      type: "Pattern",
      flags,
      value,
      loc: this.loc(0)
    };
  }
  disjunction() {
    const alts = [];
    const begin = this.idx;
    alts.push(this.alternative());
    while (this.peekChar() === "|") {
      this.consumeChar("|");
      alts.push(this.alternative());
    }
    return { type: "Disjunction", value: alts, loc: this.loc(begin) };
  }
  alternative() {
    const terms = [];
    const begin = this.idx;
    while (this.isTerm()) {
      terms.push(this.term());
    }
    return { type: "Alternative", value: terms, loc: this.loc(begin) };
  }
  term() {
    if (this.isAssertion()) {
      return this.assertion();
    } else {
      return this.atom();
    }
  }
  assertion() {
    const begin = this.idx;
    switch (this.popChar()) {
      case "^":
        return {
          type: "StartAnchor",
          loc: this.loc(begin)
        };
      case "$":
        return { type: "EndAnchor", loc: this.loc(begin) };
      case "\\":
        switch (this.popChar()) {
          case "b":
            return {
              type: "WordBoundary",
              loc: this.loc(begin)
            };
          case "B":
            return {
              type: "NonWordBoundary",
              loc: this.loc(begin)
            };
        }
        throw Error("Invalid Assertion Escape");
      case "(":
        this.consumeChar("?");
        let type;
        switch (this.popChar()) {
          case "=":
            type = "Lookahead";
            break;
          case "!":
            type = "NegativeLookahead";
            break;
          case "<": {
            switch (this.popChar()) {
              case "=":
                type = "Lookbehind";
                break;
              case "!":
                type = "NegativeLookbehind";
            }
            break;
          }
        }
        ASSERT_EXISTS(type);
        const disjunction = this.disjunction();
        this.consumeChar(")");
        return {
          type,
          value: disjunction,
          loc: this.loc(begin)
        };
    }
    return ASSERT_NEVER_REACH_HERE();
  }
  quantifier(isBacktracking = false) {
    let range = undefined;
    const begin = this.idx;
    switch (this.popChar()) {
      case "*":
        range = {
          atLeast: 0,
          atMost: Infinity
        };
        break;
      case "+":
        range = {
          atLeast: 1,
          atMost: Infinity
        };
        break;
      case "?":
        range = {
          atLeast: 0,
          atMost: 1
        };
        break;
      case "{":
        const atLeast = this.integerIncludingZero();
        switch (this.popChar()) {
          case "}":
            range = {
              atLeast,
              atMost: atLeast
            };
            break;
          case ",":
            let atMost;
            if (this.isDigit()) {
              atMost = this.integerIncludingZero();
              range = {
                atLeast,
                atMost
              };
            } else {
              range = {
                atLeast,
                atMost: Infinity
              };
            }
            this.consumeChar("}");
            break;
        }
        if (isBacktracking === true && range === undefined) {
          return;
        }
        ASSERT_EXISTS(range);
        break;
    }
    if (isBacktracking === true && range === undefined) {
      return;
    }
    if (ASSERT_EXISTS(range)) {
      if (this.peekChar(0) === "?") {
        this.consumeChar("?");
        range.greedy = false;
      } else {
        range.greedy = true;
      }
      range.type = "Quantifier";
      range.loc = this.loc(begin);
      return range;
    }
  }
  atom() {
    let atom;
    const begin = this.idx;
    switch (this.peekChar()) {
      case ".":
        atom = this.dotAll();
        break;
      case "\\":
        atom = this.atomEscape();
        break;
      case "[":
        atom = this.characterClass();
        break;
      case "(":
        atom = this.group();
        break;
    }
    if (atom === undefined && this.isPatternCharacter()) {
      atom = this.patternCharacter();
    }
    if (ASSERT_EXISTS(atom)) {
      atom.loc = this.loc(begin);
      if (this.isQuantifier()) {
        atom.quantifier = this.quantifier();
      }
      return atom;
    }
    return ASSERT_NEVER_REACH_HERE();
  }
  dotAll() {
    this.consumeChar(".");
    return {
      type: "Set",
      complement: true,
      value: [cc(`
`), cc("\r"), cc("\u2028"), cc("\u2029")]
    };
  }
  atomEscape() {
    this.consumeChar("\\");
    switch (this.peekChar()) {
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
      case "7":
      case "8":
      case "9":
        return this.decimalEscapeAtom();
      case "d":
      case "D":
      case "s":
      case "S":
      case "w":
      case "W":
        return this.characterClassEscape();
      case "f":
      case "n":
      case "r":
      case "t":
      case "v":
        return this.controlEscapeAtom();
      case "c":
        return this.controlLetterEscapeAtom();
      case "0":
        return this.nulCharacterAtom();
      case "x":
        return this.hexEscapeSequenceAtom();
      case "u":
        return this.regExpUnicodeEscapeSequenceAtom();
      default:
        return this.identityEscapeAtom();
    }
  }
  decimalEscapeAtom() {
    const value = this.positiveInteger();
    return { type: "GroupBackReference", value };
  }
  characterClassEscape() {
    let set;
    let complement = false;
    switch (this.popChar()) {
      case "d":
        set = digitsCharCodes;
        break;
      case "D":
        set = digitsCharCodes;
        complement = true;
        break;
      case "s":
        set = whitespaceCodes;
        break;
      case "S":
        set = whitespaceCodes;
        complement = true;
        break;
      case "w":
        set = wordCharCodes;
        break;
      case "W":
        set = wordCharCodes;
        complement = true;
        break;
    }
    if (ASSERT_EXISTS(set)) {
      return { type: "Set", value: set, complement };
    }
    return ASSERT_NEVER_REACH_HERE();
  }
  controlEscapeAtom() {
    let escapeCode;
    switch (this.popChar()) {
      case "f":
        escapeCode = cc("\f");
        break;
      case "n":
        escapeCode = cc(`
`);
        break;
      case "r":
        escapeCode = cc("\r");
        break;
      case "t":
        escapeCode = cc("\t");
        break;
      case "v":
        escapeCode = cc("\v");
        break;
    }
    if (ASSERT_EXISTS(escapeCode)) {
      return { type: "Character", value: escapeCode };
    }
    return ASSERT_NEVER_REACH_HERE();
  }
  controlLetterEscapeAtom() {
    this.consumeChar("c");
    const letter = this.popChar();
    if (/[a-zA-Z]/.test(letter) === false) {
      throw Error("Invalid ");
    }
    const letterCode = letter.toUpperCase().charCodeAt(0) - 64;
    return { type: "Character", value: letterCode };
  }
  nulCharacterAtom() {
    this.consumeChar("0");
    return { type: "Character", value: cc("\x00") };
  }
  hexEscapeSequenceAtom() {
    this.consumeChar("x");
    return this.parseHexDigits(2);
  }
  regExpUnicodeEscapeSequenceAtom() {
    this.consumeChar("u");
    return this.parseHexDigits(4);
  }
  identityEscapeAtom() {
    const escapedChar = this.popChar();
    return { type: "Character", value: cc(escapedChar) };
  }
  classPatternCharacterAtom() {
    switch (this.peekChar()) {
      case `
`:
      case "\r":
      case "\u2028":
      case "\u2029":
      case "\\":
      case "]":
        throw Error("TBD");
      default:
        const nextChar = this.popChar();
        return { type: "Character", value: cc(nextChar) };
    }
  }
  characterClass() {
    const set = [];
    let complement = false;
    this.consumeChar("[");
    if (this.peekChar(0) === "^") {
      this.consumeChar("^");
      complement = true;
    }
    while (this.isClassAtom()) {
      const from = this.classAtom();
      const isFromSingleChar = from.type === "Character";
      if (isCharacter(from) && this.isRangeDash()) {
        this.consumeChar("-");
        const to = this.classAtom();
        const isToSingleChar = to.type === "Character";
        if (isCharacter(to)) {
          if (to.value < from.value) {
            throw Error("Range out of order in character class");
          }
          set.push({ from: from.value, to: to.value });
        } else {
          insertToSet(from.value, set);
          set.push(cc("-"));
          insertToSet(to.value, set);
        }
      } else {
        insertToSet(from.value, set);
      }
    }
    this.consumeChar("]");
    return { type: "Set", complement, value: set };
  }
  classAtom() {
    switch (this.peekChar()) {
      case "]":
      case `
`:
      case "\r":
      case "\u2028":
      case "\u2029":
        throw Error("TBD");
      case "\\":
        return this.classEscape();
      default:
        return this.classPatternCharacterAtom();
    }
  }
  classEscape() {
    this.consumeChar("\\");
    switch (this.peekChar()) {
      case "b":
        this.consumeChar("b");
        return { type: "Character", value: cc("\b") };
      case "d":
      case "D":
      case "s":
      case "S":
      case "w":
      case "W":
        return this.characterClassEscape();
      case "f":
      case "n":
      case "r":
      case "t":
      case "v":
        return this.controlEscapeAtom();
      case "c":
        return this.controlLetterEscapeAtom();
      case "0":
        return this.nulCharacterAtom();
      case "x":
        return this.hexEscapeSequenceAtom();
      case "u":
        return this.regExpUnicodeEscapeSequenceAtom();
      default:
        return this.identityEscapeAtom();
    }
  }
  group() {
    let capturing = true;
    this.consumeChar("(");
    switch (this.peekChar(0)) {
      case "?":
        this.consumeChar("?");
        this.consumeChar(":");
        capturing = false;
        break;
      default:
        this.groupIdx++;
        break;
    }
    const value = this.disjunction();
    this.consumeChar(")");
    const groupAst = {
      type: "Group",
      capturing,
      value
    };
    if (capturing) {
      groupAst["idx"] = this.groupIdx;
    }
    return groupAst;
  }
  positiveInteger() {
    let number = this.popChar();
    if (decimalPatternNoZero.test(number) === false) {
      throw Error("Expecting a positive integer");
    }
    while (decimalPattern.test(this.peekChar(0))) {
      number += this.popChar();
    }
    return parseInt(number, 10);
  }
  integerIncludingZero() {
    let number = this.popChar();
    if (decimalPattern.test(number) === false) {
      throw Error("Expecting an integer");
    }
    while (decimalPattern.test(this.peekChar(0))) {
      number += this.popChar();
    }
    return parseInt(number, 10);
  }
  patternCharacter() {
    const nextChar = this.popChar();
    switch (nextChar) {
      case `
`:
      case "\r":
      case "\u2028":
      case "\u2029":
      case "^":
      case "$":
      case "\\":
      case ".":
      case "*":
      case "+":
      case "?":
      case "(":
      case ")":
      case "[":
      case "|":
        throw Error("TBD");
      default:
        return { type: "Character", value: cc(nextChar) };
    }
  }
  isRegExpFlag() {
    switch (this.peekChar(0)) {
      case "g":
      case "i":
      case "m":
      case "u":
      case "y":
        return true;
      default:
        return false;
    }
  }
  isRangeDash() {
    return this.peekChar() === "-" && this.isClassAtom(1);
  }
  isDigit() {
    return decimalPattern.test(this.peekChar(0));
  }
  isClassAtom(howMuch = 0) {
    switch (this.peekChar(howMuch)) {
      case "]":
      case `
`:
      case "\r":
      case "\u2028":
      case "\u2029":
        return false;
      default:
        return true;
    }
  }
  isTerm() {
    return this.isAtom() || this.isAssertion();
  }
  isAtom() {
    if (this.isPatternCharacter()) {
      return true;
    }
    switch (this.peekChar(0)) {
      case ".":
      case "\\":
      case "[":
      case "(":
        return true;
      default:
        return false;
    }
  }
  isAssertion() {
    switch (this.peekChar(0)) {
      case "^":
      case "$":
        return true;
      case "\\":
        switch (this.peekChar(1)) {
          case "b":
          case "B":
            return true;
          default:
            return false;
        }
      case "(":
        return this.peekChar(1) === "?" && (this.peekChar(2) === "=" || this.peekChar(2) === "!" || this.peekChar(2) === "<" && (this.peekChar(3) === "=" || this.peekChar(3) === "!"));
      default:
        return false;
    }
  }
  isQuantifier() {
    const prevState = this.saveState();
    try {
      return this.quantifier(true) !== undefined;
    } catch (e) {
      return false;
    } finally {
      this.restoreState(prevState);
    }
  }
  isPatternCharacter() {
    switch (this.peekChar()) {
      case "^":
      case "$":
      case "\\":
      case ".":
      case "*":
      case "+":
      case "?":
      case "(":
      case ")":
      case "[":
      case "|":
      case "/":
      case `
`:
      case "\r":
      case "\u2028":
      case "\u2029":
        return false;
      default:
        return true;
    }
  }
  parseHexDigits(howMany) {
    let hexString = "";
    for (let i = 0;i < howMany; i++) {
      const hexChar = this.popChar();
      if (hexDigitPattern.test(hexChar) === false) {
        throw Error("Expecting a HexDecimal digits");
      }
      hexString += hexChar;
    }
    const charCode = parseInt(hexString, 16);
    return { type: "Character", value: charCode };
  }
  peekChar(howMuch = 0) {
    return this.input[this.idx + howMuch];
  }
  popChar() {
    const nextChar = this.peekChar(0);
    this.consumeChar(undefined);
    return nextChar;
  }
  consumeChar(char) {
    if (char !== undefined && this.input[this.idx] !== char) {
      throw Error("Expected: '" + char + "' but found: '" + this.input[this.idx] + "' at offset: " + this.idx);
    }
    if (this.idx >= this.input.length) {
      throw Error("Unexpected end of input");
    }
    this.idx++;
  }
  loc(begin) {
    return { begin, end: this.idx };
  }
}
// ../../node_modules/@chevrotain/regexp-to-ast/lib/src/base-regexp-visitor.js
class BaseRegExpVisitor {
  visitChildren(node) {
    for (const key in node) {
      const child = node[key];
      if (node.hasOwnProperty(key)) {
        if (child.type !== undefined) {
          this.visit(child);
        } else if (Array.isArray(child)) {
          child.forEach((subChild) => {
            this.visit(subChild);
          }, this);
        }
      }
    }
  }
  visit(node) {
    switch (node.type) {
      case "Pattern":
        this.visitPattern(node);
        break;
      case "Flags":
        this.visitFlags(node);
        break;
      case "Disjunction":
        this.visitDisjunction(node);
        break;
      case "Alternative":
        this.visitAlternative(node);
        break;
      case "StartAnchor":
        this.visitStartAnchor(node);
        break;
      case "EndAnchor":
        this.visitEndAnchor(node);
        break;
      case "WordBoundary":
        this.visitWordBoundary(node);
        break;
      case "NonWordBoundary":
        this.visitNonWordBoundary(node);
        break;
      case "Lookahead":
        this.visitLookahead(node);
        break;
      case "NegativeLookahead":
        this.visitNegativeLookahead(node);
        break;
      case "Lookbehind":
        this.visitLookbehind(node);
        break;
      case "NegativeLookbehind":
        this.visitNegativeLookbehind(node);
        break;
      case "Character":
        this.visitCharacter(node);
        break;
      case "Set":
        this.visitSet(node);
        break;
      case "Group":
        this.visitGroup(node);
        break;
      case "GroupBackReference":
        this.visitGroupBackReference(node);
        break;
      case "Quantifier":
        this.visitQuantifier(node);
        break;
    }
    this.visitChildren(node);
  }
  visitPattern(node) {}
  visitFlags(node) {}
  visitDisjunction(node) {}
  visitAlternative(node) {}
  visitStartAnchor(node) {}
  visitEndAnchor(node) {}
  visitWordBoundary(node) {}
  visitNonWordBoundary(node) {}
  visitLookahead(node) {}
  visitNegativeLookahead(node) {}
  visitLookbehind(node) {}
  visitNegativeLookbehind(node) {}
  visitCharacter(node) {}
  visitSet(node) {}
  visitGroup(node) {}
  visitGroupBackReference(node) {}
  visitQuantifier(node) {}
}
// ../../node_modules/chevrotain/lib/src/scan/reg_exp_parser.js
var regExpAstCache = {};
var regExpParser = new RegExpParser;
function getRegExpAst(regExp) {
  const regExpStr = regExp.toString();
  if (regExpAstCache.hasOwnProperty(regExpStr)) {
    return regExpAstCache[regExpStr];
  } else {
    const regExpAst = regExpParser.pattern(regExpStr);
    regExpAstCache[regExpStr] = regExpAst;
    return regExpAst;
  }
}
function clearRegExpParserCache() {
  regExpAstCache = {};
}

// ../../node_modules/chevrotain/lib/src/scan/reg_exp.js
var complementErrorMessage = "Complement Sets are not supported for first char optimization";
var failedOptimizationPrefixMsg = `Unable to use "first char" lexer optimizations:
`;
function getOptimizedStartCodesIndices(regExp, ensureOptimizations = false) {
  try {
    const ast = getRegExpAst(regExp);
    const firstChars = firstCharOptimizedIndices(ast.value, {}, ast.flags.ignoreCase);
    return firstChars;
  } catch (e) {
    if (e.message === complementErrorMessage) {
      if (ensureOptimizations) {
        PRINT_WARNING(`${failedOptimizationPrefixMsg}` + `	Unable to optimize: < ${regExp.toString()} >
` + `	Complement Sets cannot be automatically optimized.
` + `	This will disable the lexer's first char optimizations.
` + "\tSee: https://chevrotain.io/docs/guide/resolving_lexer_errors.html#COMPLEMENT for details.");
      }
    } else {
      let msgSuffix = "";
      if (ensureOptimizations) {
        msgSuffix = `
	This will disable the lexer's first char optimizations.
` + "\tSee: https://chevrotain.io/docs/guide/resolving_lexer_errors.html#REGEXP_PARSING for details.";
      }
      PRINT_ERROR(`${failedOptimizationPrefixMsg}
` + `	Failed parsing: < ${regExp.toString()} >
` + `	Using the @chevrotain/regexp-to-ast library
` + "\tPlease open an issue at: https://github.com/chevrotain/chevrotain/issues" + msgSuffix);
    }
  }
  return [];
}
function firstCharOptimizedIndices(ast, result, ignoreCase) {
  switch (ast.type) {
    case "Disjunction":
      for (let i = 0;i < ast.value.length; i++) {
        firstCharOptimizedIndices(ast.value[i], result, ignoreCase);
      }
      break;
    case "Alternative":
      const terms = ast.value;
      for (let i = 0;i < terms.length; i++) {
        const term = terms[i];
        switch (term.type) {
          case "EndAnchor":
          case "GroupBackReference":
          case "Lookahead":
          case "NegativeLookahead":
          case "Lookbehind":
          case "NegativeLookbehind":
          case "StartAnchor":
          case "WordBoundary":
          case "NonWordBoundary":
            continue;
        }
        const atom = term;
        switch (atom.type) {
          case "Character":
            addOptimizedIdxToResult(atom.value, result, ignoreCase);
            break;
          case "Set":
            if (atom.complement === true) {
              throw Error(complementErrorMessage);
            }
            forEach_default(atom.value, (code) => {
              if (typeof code === "number") {
                addOptimizedIdxToResult(code, result, ignoreCase);
              } else {
                const range = code;
                if (ignoreCase === true) {
                  for (let rangeCode = range.from;rangeCode <= range.to; rangeCode++) {
                    addOptimizedIdxToResult(rangeCode, result, ignoreCase);
                  }
                } else {
                  for (let rangeCode = range.from;rangeCode <= range.to && rangeCode < minOptimizationVal; rangeCode++) {
                    addOptimizedIdxToResult(rangeCode, result, ignoreCase);
                  }
                  if (range.to >= minOptimizationVal) {
                    const minUnOptVal = range.from >= minOptimizationVal ? range.from : minOptimizationVal;
                    const maxUnOptVal = range.to;
                    const minOptIdx = charCodeToOptimizedIndex(minUnOptVal);
                    const maxOptIdx = charCodeToOptimizedIndex(maxUnOptVal);
                    for (let currOptIdx = minOptIdx;currOptIdx <= maxOptIdx; currOptIdx++) {
                      result[currOptIdx] = currOptIdx;
                    }
                  }
                }
              }
            });
            break;
          case "Group":
            firstCharOptimizedIndices(atom.value, result, ignoreCase);
            break;
          default:
            throw Error("Non Exhaustive Match");
        }
        const isOptionalQuantifier = atom.quantifier !== undefined && atom.quantifier.atLeast === 0;
        if (atom.type === "Group" && isWholeOptional(atom) === false || atom.type !== "Group" && isOptionalQuantifier === false) {
          break;
        }
      }
      break;
    default:
      throw Error("non exhaustive match!");
  }
  return values_default(result);
}
function addOptimizedIdxToResult(code, result, ignoreCase) {
  const optimizedCharIdx = charCodeToOptimizedIndex(code);
  result[optimizedCharIdx] = optimizedCharIdx;
  if (ignoreCase === true) {
    handleIgnoreCase(code, result);
  }
}
function handleIgnoreCase(code, result) {
  const char = String.fromCharCode(code);
  const upperChar = char.toUpperCase();
  if (upperChar !== char) {
    const optimizedCharIdx = charCodeToOptimizedIndex(upperChar.charCodeAt(0));
    result[optimizedCharIdx] = optimizedCharIdx;
  } else {
    const lowerChar = char.toLowerCase();
    if (lowerChar !== char) {
      const optimizedCharIdx = charCodeToOptimizedIndex(lowerChar.charCodeAt(0));
      result[optimizedCharIdx] = optimizedCharIdx;
    }
  }
}
function findCode(setNode, targetCharCodes) {
  return find_default(setNode.value, (codeOrRange) => {
    if (typeof codeOrRange === "number") {
      return includes_default(targetCharCodes, codeOrRange);
    } else {
      const range = codeOrRange;
      return find_default(targetCharCodes, (targetCode) => range.from <= targetCode && targetCode <= range.to) !== undefined;
    }
  });
}
function isWholeOptional(ast) {
  const quantifier = ast.quantifier;
  if (quantifier && quantifier.atLeast === 0) {
    return true;
  }
  if (!ast.value) {
    return false;
  }
  return isArray_default(ast.value) ? every_default(ast.value, isWholeOptional) : isWholeOptional(ast.value);
}

class CharCodeFinder extends BaseRegExpVisitor {
  constructor(targetCharCodes) {
    super();
    this.targetCharCodes = targetCharCodes;
    this.found = false;
  }
  visitChildren(node) {
    if (this.found === true) {
      return;
    }
    switch (node.type) {
      case "Lookahead":
        this.visitLookahead(node);
        return;
      case "NegativeLookahead":
        this.visitNegativeLookahead(node);
        return;
      case "Lookbehind":
        this.visitLookbehind(node);
        return;
      case "NegativeLookbehind":
        this.visitNegativeLookbehind(node);
        return;
    }
    super.visitChildren(node);
  }
  visitCharacter(node) {
    if (includes_default(this.targetCharCodes, node.value)) {
      this.found = true;
    }
  }
  visitSet(node) {
    if (node.complement) {
      if (findCode(node, this.targetCharCodes) === undefined) {
        this.found = true;
      }
    } else {
      if (findCode(node, this.targetCharCodes) !== undefined) {
        this.found = true;
      }
    }
  }
}
function canMatchCharCode(charCodes, pattern) {
  if (pattern instanceof RegExp) {
    const ast = getRegExpAst(pattern);
    const charCodeFinder = new CharCodeFinder(charCodes);
    charCodeFinder.visit(ast);
    return charCodeFinder.found;
  } else {
    return find_default(pattern, (char) => {
      return includes_default(charCodes, char.charCodeAt(0));
    }) !== undefined;
  }
}

// ../../node_modules/chevrotain/lib/src/scan/lexer.js
var PATTERN = "PATTERN";
var DEFAULT_MODE = "defaultMode";
var MODES = "modes";
function analyzeTokenTypes(tokenTypes, options) {
  options = defaults_default(options, {
    debug: false,
    safeMode: false,
    positionTracking: "full",
    lineTerminatorCharacters: ["\r", `
`],
    tracer: (msg, action) => action()
  });
  const tracer = options.tracer;
  tracer("initCharCodeToOptimizedIndexMap", () => {
    initCharCodeToOptimizedIndexMap();
  });
  let onlyRelevantTypes;
  tracer("Reject Lexer.NA", () => {
    onlyRelevantTypes = reject_default(tokenTypes, (currType) => {
      return currType[PATTERN] === Lexer.NA;
    });
  });
  let hasCustom = false;
  let allTransformedPatterns;
  tracer("Transform Patterns", () => {
    hasCustom = false;
    allTransformedPatterns = map_default(onlyRelevantTypes, (currType) => {
      const currPattern = currType[PATTERN];
      if (isRegExp_default(currPattern)) {
        const regExpSource = currPattern.source;
        if (regExpSource.length === 1 && regExpSource !== "^" && regExpSource !== "$" && regExpSource !== "." && !currPattern.ignoreCase) {
          return regExpSource;
        } else if (regExpSource.length === 2 && regExpSource[0] === "\\" && !includes_default([
          "d",
          "D",
          "s",
          "S",
          "t",
          "r",
          "n",
          "t",
          "0",
          "c",
          "b",
          "B",
          "f",
          "v",
          "w",
          "W"
        ], regExpSource[1])) {
          return regExpSource[1];
        } else {
          return addStickyFlag(currPattern);
        }
      } else if (isFunction_default(currPattern)) {
        hasCustom = true;
        return { exec: currPattern };
      } else if (typeof currPattern === "object") {
        hasCustom = true;
        return currPattern;
      } else if (typeof currPattern === "string") {
        if (currPattern.length === 1) {
          return currPattern;
        } else {
          const escapedRegExpString = currPattern.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
          const wrappedRegExp = new RegExp(escapedRegExpString);
          return addStickyFlag(wrappedRegExp);
        }
      } else {
        throw Error("non exhaustive match");
      }
    });
  });
  let patternIdxToType;
  let patternIdxToGroup;
  let patternIdxToLongerAltIdxArr;
  let patternIdxToPushMode;
  let patternIdxToPopMode;
  tracer("misc mapping", () => {
    patternIdxToType = map_default(onlyRelevantTypes, (currType) => currType.tokenTypeIdx);
    patternIdxToGroup = map_default(onlyRelevantTypes, (clazz) => {
      const groupName = clazz.GROUP;
      if (groupName === Lexer.SKIPPED) {
        return;
      } else if (isString_default(groupName)) {
        return groupName;
      } else if (isUndefined_default(groupName)) {
        return false;
      } else {
        throw Error("non exhaustive match");
      }
    });
    patternIdxToLongerAltIdxArr = map_default(onlyRelevantTypes, (clazz) => {
      const longerAltType = clazz.LONGER_ALT;
      if (longerAltType) {
        const longerAltIdxArr = isArray_default(longerAltType) ? map_default(longerAltType, (type) => indexOf_default(onlyRelevantTypes, type)) : [indexOf_default(onlyRelevantTypes, longerAltType)];
        return longerAltIdxArr;
      }
    });
    patternIdxToPushMode = map_default(onlyRelevantTypes, (clazz) => clazz.PUSH_MODE);
    patternIdxToPopMode = map_default(onlyRelevantTypes, (clazz) => has_default(clazz, "POP_MODE"));
  });
  let patternIdxToCanLineTerminator;
  tracer("Line Terminator Handling", () => {
    const lineTerminatorCharCodes = getCharCodes(options.lineTerminatorCharacters);
    patternIdxToCanLineTerminator = map_default(onlyRelevantTypes, (tokType) => false);
    if (options.positionTracking !== "onlyOffset") {
      patternIdxToCanLineTerminator = map_default(onlyRelevantTypes, (tokType) => {
        if (has_default(tokType, "LINE_BREAKS")) {
          return !!tokType.LINE_BREAKS;
        } else {
          return checkLineBreaksIssues(tokType, lineTerminatorCharCodes) === false && canMatchCharCode(lineTerminatorCharCodes, tokType.PATTERN);
        }
      });
    }
  });
  let patternIdxToIsCustom;
  let patternIdxToShort;
  let emptyGroups;
  let patternIdxToConfig;
  tracer("Misc Mapping #2", () => {
    patternIdxToIsCustom = map_default(onlyRelevantTypes, isCustomPattern);
    patternIdxToShort = map_default(allTransformedPatterns, isShortPattern);
    emptyGroups = reduce_default(onlyRelevantTypes, (acc, clazz) => {
      const groupName = clazz.GROUP;
      if (isString_default(groupName) && !(groupName === Lexer.SKIPPED)) {
        acc[groupName] = [];
      }
      return acc;
    }, {});
    patternIdxToConfig = map_default(allTransformedPatterns, (x, idx) => {
      return {
        pattern: allTransformedPatterns[idx],
        longerAlt: patternIdxToLongerAltIdxArr[idx],
        canLineTerminator: patternIdxToCanLineTerminator[idx],
        isCustom: patternIdxToIsCustom[idx],
        short: patternIdxToShort[idx],
        group: patternIdxToGroup[idx],
        push: patternIdxToPushMode[idx],
        pop: patternIdxToPopMode[idx],
        tokenTypeIdx: patternIdxToType[idx],
        tokenType: onlyRelevantTypes[idx]
      };
    });
  });
  let canBeOptimized = true;
  let charCodeToPatternIdxToConfig = [];
  if (!options.safeMode) {
    tracer("First Char Optimization", () => {
      charCodeToPatternIdxToConfig = reduce_default(onlyRelevantTypes, (result, currTokType, idx) => {
        if (typeof currTokType.PATTERN === "string") {
          const charCode = currTokType.PATTERN.charCodeAt(0);
          const optimizedIdx = charCodeToOptimizedIndex(charCode);
          addToMapOfArrays(result, optimizedIdx, patternIdxToConfig[idx]);
        } else if (isArray_default(currTokType.START_CHARS_HINT)) {
          let lastOptimizedIdx;
          forEach_default(currTokType.START_CHARS_HINT, (charOrInt) => {
            const charCode = typeof charOrInt === "string" ? charOrInt.charCodeAt(0) : charOrInt;
            const currOptimizedIdx = charCodeToOptimizedIndex(charCode);
            if (lastOptimizedIdx !== currOptimizedIdx) {
              lastOptimizedIdx = currOptimizedIdx;
              addToMapOfArrays(result, currOptimizedIdx, patternIdxToConfig[idx]);
            }
          });
        } else if (isRegExp_default(currTokType.PATTERN)) {
          if (currTokType.PATTERN.unicode) {
            canBeOptimized = false;
            if (options.ensureOptimizations) {
              PRINT_ERROR(`${failedOptimizationPrefixMsg}` + `	Unable to analyze < ${currTokType.PATTERN.toString()} > pattern.
` + `	The regexp unicode flag is not currently supported by the regexp-to-ast library.
` + `	This will disable the lexer's first char optimizations.
` + "\tFor details See: https://chevrotain.io/docs/guide/resolving_lexer_errors.html#UNICODE_OPTIMIZE");
            }
          } else {
            const optimizedCodes = getOptimizedStartCodesIndices(currTokType.PATTERN, options.ensureOptimizations);
            if (isEmpty_default(optimizedCodes)) {
              canBeOptimized = false;
            }
            forEach_default(optimizedCodes, (code) => {
              addToMapOfArrays(result, code, patternIdxToConfig[idx]);
            });
          }
        } else {
          if (options.ensureOptimizations) {
            PRINT_ERROR(`${failedOptimizationPrefixMsg}` + `	TokenType: <${currTokType.name}> is using a custom token pattern without providing <start_chars_hint> parameter.
` + `	This will disable the lexer's first char optimizations.
` + "\tFor details See: https://chevrotain.io/docs/guide/resolving_lexer_errors.html#CUSTOM_OPTIMIZE");
          }
          canBeOptimized = false;
        }
        return result;
      }, []);
    });
  }
  return {
    emptyGroups,
    patternIdxToConfig,
    charCodeToPatternIdxToConfig,
    hasCustom,
    canBeOptimized
  };
}
function validatePatterns(tokenTypes, validModesNames) {
  let errors = [];
  const missingResult = findMissingPatterns(tokenTypes);
  errors = errors.concat(missingResult.errors);
  const invalidResult = findInvalidPatterns(missingResult.valid);
  const validTokenTypes = invalidResult.valid;
  errors = errors.concat(invalidResult.errors);
  errors = errors.concat(validateRegExpPattern(validTokenTypes));
  errors = errors.concat(findInvalidGroupType(validTokenTypes));
  errors = errors.concat(findModesThatDoNotExist(validTokenTypes, validModesNames));
  errors = errors.concat(findUnreachablePatterns(validTokenTypes));
  return errors;
}
function validateRegExpPattern(tokenTypes) {
  let errors = [];
  const withRegExpPatterns = filter_default(tokenTypes, (currTokType) => isRegExp_default(currTokType[PATTERN]));
  errors = errors.concat(findEndOfInputAnchor(withRegExpPatterns));
  errors = errors.concat(findStartOfInputAnchor(withRegExpPatterns));
  errors = errors.concat(findUnsupportedFlags(withRegExpPatterns));
  errors = errors.concat(findDuplicatePatterns(withRegExpPatterns));
  errors = errors.concat(findEmptyMatchRegExps(withRegExpPatterns));
  return errors;
}
function findMissingPatterns(tokenTypes) {
  const tokenTypesWithMissingPattern = filter_default(tokenTypes, (currType) => {
    return !has_default(currType, PATTERN);
  });
  const errors = map_default(tokenTypesWithMissingPattern, (currType) => {
    return {
      message: "Token Type: ->" + currType.name + "<- missing static 'PATTERN' property",
      type: LexerDefinitionErrorType.MISSING_PATTERN,
      tokenTypes: [currType]
    };
  });
  const valid = difference_default(tokenTypes, tokenTypesWithMissingPattern);
  return { errors, valid };
}
function findInvalidPatterns(tokenTypes) {
  const tokenTypesWithInvalidPattern = filter_default(tokenTypes, (currType) => {
    const pattern = currType[PATTERN];
    return !isRegExp_default(pattern) && !isFunction_default(pattern) && !has_default(pattern, "exec") && !isString_default(pattern);
  });
  const errors = map_default(tokenTypesWithInvalidPattern, (currType) => {
    return {
      message: "Token Type: ->" + currType.name + "<- static 'PATTERN' can only be a RegExp, a" + " Function matching the {CustomPatternMatcherFunc} type or an Object matching the {ICustomPattern} interface.",
      type: LexerDefinitionErrorType.INVALID_PATTERN,
      tokenTypes: [currType]
    };
  });
  const valid = difference_default(tokenTypes, tokenTypesWithInvalidPattern);
  return { errors, valid };
}
var end_of_input = /[^\\][$]/;
function findEndOfInputAnchor(tokenTypes) {

  class EndAnchorFinder extends BaseRegExpVisitor {
    constructor() {
      super(...arguments);
      this.found = false;
    }
    visitEndAnchor(node) {
      this.found = true;
    }
  }
  const invalidRegex = filter_default(tokenTypes, (currType) => {
    const pattern = currType.PATTERN;
    try {
      const regexpAst = getRegExpAst(pattern);
      const endAnchorVisitor = new EndAnchorFinder;
      endAnchorVisitor.visit(regexpAst);
      return endAnchorVisitor.found;
    } catch (e) {
      return end_of_input.test(pattern.source);
    }
  });
  const errors = map_default(invalidRegex, (currType) => {
    return {
      message: `Unexpected RegExp Anchor Error:
` + "\tToken Type: ->" + currType.name + `<- static 'PATTERN' cannot contain end of input anchor '$'
` + "\tSee chevrotain.io/docs/guide/resolving_lexer_errors.html#ANCHORS" + "\tfor details.",
      type: LexerDefinitionErrorType.EOI_ANCHOR_FOUND,
      tokenTypes: [currType]
    };
  });
  return errors;
}
function findEmptyMatchRegExps(tokenTypes) {
  const matchesEmptyString = filter_default(tokenTypes, (currType) => {
    const pattern = currType.PATTERN;
    return pattern.test("");
  });
  const errors = map_default(matchesEmptyString, (currType) => {
    return {
      message: "Token Type: ->" + currType.name + "<- static 'PATTERN' must not match an empty string",
      type: LexerDefinitionErrorType.EMPTY_MATCH_PATTERN,
      tokenTypes: [currType]
    };
  });
  return errors;
}
var start_of_input = /[^\\[][\^]|^\^/;
function findStartOfInputAnchor(tokenTypes) {

  class StartAnchorFinder extends BaseRegExpVisitor {
    constructor() {
      super(...arguments);
      this.found = false;
    }
    visitStartAnchor(node) {
      this.found = true;
    }
  }
  const invalidRegex = filter_default(tokenTypes, (currType) => {
    const pattern = currType.PATTERN;
    try {
      const regexpAst = getRegExpAst(pattern);
      const startAnchorVisitor = new StartAnchorFinder;
      startAnchorVisitor.visit(regexpAst);
      return startAnchorVisitor.found;
    } catch (e) {
      return start_of_input.test(pattern.source);
    }
  });
  const errors = map_default(invalidRegex, (currType) => {
    return {
      message: `Unexpected RegExp Anchor Error:
` + "\tToken Type: ->" + currType.name + `<- static 'PATTERN' cannot contain start of input anchor '^'
` + "\tSee https://chevrotain.io/docs/guide/resolving_lexer_errors.html#ANCHORS" + "\tfor details.",
      type: LexerDefinitionErrorType.SOI_ANCHOR_FOUND,
      tokenTypes: [currType]
    };
  });
  return errors;
}
function findUnsupportedFlags(tokenTypes) {
  const invalidFlags = filter_default(tokenTypes, (currType) => {
    const pattern = currType[PATTERN];
    return pattern instanceof RegExp && (pattern.multiline || pattern.global);
  });
  const errors = map_default(invalidFlags, (currType) => {
    return {
      message: "Token Type: ->" + currType.name + "<- static 'PATTERN' may NOT contain global('g') or multiline('m')",
      type: LexerDefinitionErrorType.UNSUPPORTED_FLAGS_FOUND,
      tokenTypes: [currType]
    };
  });
  return errors;
}
function findDuplicatePatterns(tokenTypes) {
  const found = [];
  let identicalPatterns = map_default(tokenTypes, (outerType) => {
    return reduce_default(tokenTypes, (result, innerType) => {
      if (outerType.PATTERN.source === innerType.PATTERN.source && !includes_default(found, innerType) && innerType.PATTERN !== Lexer.NA) {
        found.push(innerType);
        result.push(innerType);
        return result;
      }
      return result;
    }, []);
  });
  identicalPatterns = compact_default(identicalPatterns);
  const duplicatePatterns = filter_default(identicalPatterns, (currIdenticalSet) => {
    return currIdenticalSet.length > 1;
  });
  const errors = map_default(duplicatePatterns, (setOfIdentical) => {
    const tokenTypeNames = map_default(setOfIdentical, (currType) => {
      return currType.name;
    });
    const dupPatternSrc = head_default(setOfIdentical).PATTERN;
    return {
      message: `The same RegExp pattern ->${dupPatternSrc}<-` + `has been used in all of the following Token Types: ${tokenTypeNames.join(", ")} <-`,
      type: LexerDefinitionErrorType.DUPLICATE_PATTERNS_FOUND,
      tokenTypes: setOfIdentical
    };
  });
  return errors;
}
function findInvalidGroupType(tokenTypes) {
  const invalidTypes = filter_default(tokenTypes, (clazz) => {
    if (!has_default(clazz, "GROUP")) {
      return false;
    }
    const group = clazz.GROUP;
    return group !== Lexer.SKIPPED && group !== Lexer.NA && !isString_default(group);
  });
  const errors = map_default(invalidTypes, (currType) => {
    return {
      message: "Token Type: ->" + currType.name + "<- static 'GROUP' can only be Lexer.SKIPPED/Lexer.NA/A String",
      type: LexerDefinitionErrorType.INVALID_GROUP_TYPE_FOUND,
      tokenTypes: [currType]
    };
  });
  return errors;
}
function findModesThatDoNotExist(tokenTypes, validModes) {
  const invalidModes = filter_default(tokenTypes, (clazz) => {
    return clazz.PUSH_MODE !== undefined && !includes_default(validModes, clazz.PUSH_MODE);
  });
  const errors = map_default(invalidModes, (tokType) => {
    const msg = `Token Type: ->${tokType.name}<- static 'PUSH_MODE' value cannot refer to a Lexer Mode ->${tokType.PUSH_MODE}<-` + `which does not exist`;
    return {
      message: msg,
      type: LexerDefinitionErrorType.PUSH_MODE_DOES_NOT_EXIST,
      tokenTypes: [tokType]
    };
  });
  return errors;
}
function findUnreachablePatterns(tokenTypes) {
  const errors = [];
  const canBeTested = reduce_default(tokenTypes, (result, tokType, idx) => {
    const pattern = tokType.PATTERN;
    if (pattern === Lexer.NA) {
      return result;
    }
    if (isString_default(pattern)) {
      result.push({ str: pattern, idx, tokenType: tokType });
    } else if (isRegExp_default(pattern) && noMetaChar(pattern)) {
      result.push({ str: pattern.source, idx, tokenType: tokType });
    }
    return result;
  }, []);
  forEach_default(tokenTypes, (aTokType, aIdx) => {
    forEach_default(canBeTested, ({ str: bStr, idx: bIdx, tokenType: bTokType }) => {
      if (aIdx < bIdx && tryToMatchStrToPattern(bStr, aTokType.PATTERN)) {
        const msg = `Token: ->${bTokType.name}<- can never be matched.
` + `Because it appears AFTER the Token Type ->${aTokType.name}<-` + `in the lexer's definition.
` + `See https://chevrotain.io/docs/guide/resolving_lexer_errors.html#UNREACHABLE`;
        errors.push({
          message: msg,
          type: LexerDefinitionErrorType.UNREACHABLE_PATTERN,
          tokenTypes: [aTokType, bTokType]
        });
      }
    });
  });
  return errors;
}
function tryToMatchStrToPattern(str, pattern) {
  if (isRegExp_default(pattern)) {
    if (usesLookAheadOrBehind(pattern)) {
      return false;
    }
    const regExpArray = pattern.exec(str);
    return regExpArray !== null && regExpArray.index === 0;
  } else if (isFunction_default(pattern)) {
    return pattern(str, 0, [], {});
  } else if (has_default(pattern, "exec")) {
    return pattern.exec(str, 0, [], {});
  } else if (typeof pattern === "string") {
    return pattern === str;
  } else {
    throw Error("non exhaustive match");
  }
}
function noMetaChar(regExp) {
  const metaChars = [
    ".",
    "\\",
    "[",
    "]",
    "|",
    "^",
    "$",
    "(",
    ")",
    "?",
    "*",
    "+",
    "{"
  ];
  return find_default(metaChars, (char) => regExp.source.indexOf(char) !== -1) === undefined;
}
function usesLookAheadOrBehind(regExp) {
  return /(\(\?=)|(\(\?!)|(\(\?<=)|(\(\?<!)/.test(regExp.source);
}
function addStickyFlag(pattern) {
  const flags = pattern.ignoreCase ? "iy" : "y";
  return new RegExp(`${pattern.source}`, flags);
}
function performRuntimeChecks(lexerDefinition, trackLines, lineTerminatorCharacters) {
  const errors = [];
  if (!has_default(lexerDefinition, DEFAULT_MODE)) {
    errors.push({
      message: "A MultiMode Lexer cannot be initialized without a <" + DEFAULT_MODE + `> property in its definition
`,
      type: LexerDefinitionErrorType.MULTI_MODE_LEXER_WITHOUT_DEFAULT_MODE
    });
  }
  if (!has_default(lexerDefinition, MODES)) {
    errors.push({
      message: "A MultiMode Lexer cannot be initialized without a <" + MODES + `> property in its definition
`,
      type: LexerDefinitionErrorType.MULTI_MODE_LEXER_WITHOUT_MODES_PROPERTY
    });
  }
  if (has_default(lexerDefinition, MODES) && has_default(lexerDefinition, DEFAULT_MODE) && !has_default(lexerDefinition.modes, lexerDefinition.defaultMode)) {
    errors.push({
      message: `A MultiMode Lexer cannot be initialized with a ${DEFAULT_MODE}: <${lexerDefinition.defaultMode}>` + `which does not exist
`,
      type: LexerDefinitionErrorType.MULTI_MODE_LEXER_DEFAULT_MODE_VALUE_DOES_NOT_EXIST
    });
  }
  if (has_default(lexerDefinition, MODES)) {
    forEach_default(lexerDefinition.modes, (currModeValue, currModeName) => {
      forEach_default(currModeValue, (currTokType, currIdx) => {
        if (isUndefined_default(currTokType)) {
          errors.push({
            message: `A Lexer cannot be initialized using an undefined Token Type. Mode:` + `<${currModeName}> at index: <${currIdx}>
`,
            type: LexerDefinitionErrorType.LEXER_DEFINITION_CANNOT_CONTAIN_UNDEFINED
          });
        } else if (has_default(currTokType, "LONGER_ALT")) {
          const longerAlt = isArray_default(currTokType.LONGER_ALT) ? currTokType.LONGER_ALT : [currTokType.LONGER_ALT];
          forEach_default(longerAlt, (currLongerAlt) => {
            if (!isUndefined_default(currLongerAlt) && !includes_default(currModeValue, currLongerAlt)) {
              errors.push({
                message: `A MultiMode Lexer cannot be initialized with a longer_alt <${currLongerAlt.name}> on token <${currTokType.name}> outside of mode <${currModeName}>
`,
                type: LexerDefinitionErrorType.MULTI_MODE_LEXER_LONGER_ALT_NOT_IN_CURRENT_MODE
              });
            }
          });
        }
      });
    });
  }
  return errors;
}
function performWarningRuntimeChecks(lexerDefinition, trackLines, lineTerminatorCharacters) {
  const warnings = [];
  let hasAnyLineBreak = false;
  const allTokenTypes = compact_default(flatten_default(values_default(lexerDefinition.modes)));
  const concreteTokenTypes = reject_default(allTokenTypes, (currType) => currType[PATTERN] === Lexer.NA);
  const terminatorCharCodes = getCharCodes(lineTerminatorCharacters);
  if (trackLines) {
    forEach_default(concreteTokenTypes, (tokType) => {
      const currIssue = checkLineBreaksIssues(tokType, terminatorCharCodes);
      if (currIssue !== false) {
        const message = buildLineBreakIssueMessage(tokType, currIssue);
        const warningDescriptor = {
          message,
          type: currIssue.issue,
          tokenType: tokType
        };
        warnings.push(warningDescriptor);
      } else {
        if (has_default(tokType, "LINE_BREAKS")) {
          if (tokType.LINE_BREAKS === true) {
            hasAnyLineBreak = true;
          }
        } else {
          if (canMatchCharCode(terminatorCharCodes, tokType.PATTERN)) {
            hasAnyLineBreak = true;
          }
        }
      }
    });
  }
  if (trackLines && !hasAnyLineBreak) {
    warnings.push({
      message: `Warning: No LINE_BREAKS Found.
` + `	This Lexer has been defined to track line and column information,
` + `	But none of the Token Types can be identified as matching a line terminator.
` + `	See https://chevrotain.io/docs/guide/resolving_lexer_errors.html#LINE_BREAKS 
` + "\tfor details.",
      type: LexerDefinitionErrorType.NO_LINE_BREAKS_FLAGS
    });
  }
  return warnings;
}
function cloneEmptyGroups(emptyGroups) {
  const clonedResult = {};
  const groupKeys = keys_default(emptyGroups);
  forEach_default(groupKeys, (currKey) => {
    const currGroupValue = emptyGroups[currKey];
    if (isArray_default(currGroupValue)) {
      clonedResult[currKey] = [];
    } else {
      throw Error("non exhaustive match");
    }
  });
  return clonedResult;
}
function isCustomPattern(tokenType) {
  const pattern = tokenType.PATTERN;
  if (isRegExp_default(pattern)) {
    return false;
  } else if (isFunction_default(pattern)) {
    return true;
  } else if (has_default(pattern, "exec")) {
    return true;
  } else if (isString_default(pattern)) {
    return false;
  } else {
    throw Error("non exhaustive match");
  }
}
function isShortPattern(pattern) {
  if (isString_default(pattern) && pattern.length === 1) {
    return pattern.charCodeAt(0);
  } else {
    return false;
  }
}
var LineTerminatorOptimizedTester = {
  test: function(text) {
    const len = text.length;
    for (let i = this.lastIndex;i < len; i++) {
      const c = text.charCodeAt(i);
      if (c === 10) {
        this.lastIndex = i + 1;
        return true;
      } else if (c === 13) {
        if (text.charCodeAt(i + 1) === 10) {
          this.lastIndex = i + 2;
        } else {
          this.lastIndex = i + 1;
        }
        return true;
      }
    }
    return false;
  },
  lastIndex: 0
};
function checkLineBreaksIssues(tokType, lineTerminatorCharCodes) {
  if (has_default(tokType, "LINE_BREAKS")) {
    return false;
  } else {
    if (isRegExp_default(tokType.PATTERN)) {
      try {
        canMatchCharCode(lineTerminatorCharCodes, tokType.PATTERN);
      } catch (e) {
        return {
          issue: LexerDefinitionErrorType.IDENTIFY_TERMINATOR,
          errMsg: e.message
        };
      }
      return false;
    } else if (isString_default(tokType.PATTERN)) {
      return false;
    } else if (isCustomPattern(tokType)) {
      return { issue: LexerDefinitionErrorType.CUSTOM_LINE_BREAK };
    } else {
      throw Error("non exhaustive match");
    }
  }
}
function buildLineBreakIssueMessage(tokType, details) {
  if (details.issue === LexerDefinitionErrorType.IDENTIFY_TERMINATOR) {
    return `Warning: unable to identify line terminator usage in pattern.
` + `	The problem is in the <${tokType.name}> Token Type
` + `	 Root cause: ${details.errMsg}.
` + "\tFor details See: https://chevrotain.io/docs/guide/resolving_lexer_errors.html#IDENTIFY_TERMINATOR";
  } else if (details.issue === LexerDefinitionErrorType.CUSTOM_LINE_BREAK) {
    return `Warning: A Custom Token Pattern should specify the <line_breaks> option.
` + `	The problem is in the <${tokType.name}> Token Type
` + "\tFor details See: https://chevrotain.io/docs/guide/resolving_lexer_errors.html#CUSTOM_LINE_BREAK";
  } else {
    throw Error("non exhaustive match");
  }
}
function getCharCodes(charsOrCodes) {
  const charCodes = map_default(charsOrCodes, (numOrString) => {
    if (isString_default(numOrString)) {
      return numOrString.charCodeAt(0);
    } else {
      return numOrString;
    }
  });
  return charCodes;
}
function addToMapOfArrays(map2, key, value) {
  if (map2[key] === undefined) {
    map2[key] = [value];
  } else {
    map2[key].push(value);
  }
}
var minOptimizationVal = 256;
var charCodeToOptimizedIdxMap = [];
function charCodeToOptimizedIndex(charCode) {
  return charCode < minOptimizationVal ? charCode : charCodeToOptimizedIdxMap[charCode];
}
function initCharCodeToOptimizedIndexMap() {
  if (isEmpty_default(charCodeToOptimizedIdxMap)) {
    charCodeToOptimizedIdxMap = new Array(65536);
    for (let i = 0;i < 65536; i++) {
      charCodeToOptimizedIdxMap[i] = i > 255 ? 255 + ~~(i / 255) : i;
    }
  }
}

// ../../node_modules/chevrotain/lib/src/scan/tokens.js
function tokenStructuredMatcher(tokInstance, tokConstructor) {
  const instanceType = tokInstance.tokenTypeIdx;
  if (instanceType === tokConstructor.tokenTypeIdx) {
    return true;
  } else {
    return tokConstructor.isParent === true && tokConstructor.categoryMatchesMap[instanceType] === true;
  }
}
function tokenStructuredMatcherNoCategories(token, tokType) {
  return token.tokenTypeIdx === tokType.tokenTypeIdx;
}
var tokenShortNameIdx = 1;
var tokenIdxToClass = {};
function augmentTokenTypes(tokenTypes) {
  const tokenTypesAndParents = expandCategories(tokenTypes);
  assignTokenDefaultProps(tokenTypesAndParents);
  assignCategoriesMapProp(tokenTypesAndParents);
  assignCategoriesTokensProp(tokenTypesAndParents);
  forEach_default(tokenTypesAndParents, (tokType) => {
    tokType.isParent = tokType.categoryMatches.length > 0;
  });
}
function expandCategories(tokenTypes) {
  let result = clone_default(tokenTypes);
  let categories = tokenTypes;
  let searching = true;
  while (searching) {
    categories = compact_default(flatten_default(map_default(categories, (currTokType) => currTokType.CATEGORIES)));
    const newCategories = difference_default(categories, result);
    result = result.concat(newCategories);
    if (isEmpty_default(newCategories)) {
      searching = false;
    } else {
      categories = newCategories;
    }
  }
  return result;
}
function assignTokenDefaultProps(tokenTypes) {
  forEach_default(tokenTypes, (currTokType) => {
    if (!hasShortKeyProperty(currTokType)) {
      tokenIdxToClass[tokenShortNameIdx] = currTokType;
      currTokType.tokenTypeIdx = tokenShortNameIdx++;
    }
    if (hasCategoriesProperty(currTokType) && !isArray_default(currTokType.CATEGORIES)) {
      currTokType.CATEGORIES = [currTokType.CATEGORIES];
    }
    if (!hasCategoriesProperty(currTokType)) {
      currTokType.CATEGORIES = [];
    }
    if (!hasExtendingTokensTypesProperty(currTokType)) {
      currTokType.categoryMatches = [];
    }
    if (!hasExtendingTokensTypesMapProperty(currTokType)) {
      currTokType.categoryMatchesMap = {};
    }
  });
}
function assignCategoriesTokensProp(tokenTypes) {
  forEach_default(tokenTypes, (currTokType) => {
    currTokType.categoryMatches = [];
    forEach_default(currTokType.categoryMatchesMap, (val, key) => {
      currTokType.categoryMatches.push(tokenIdxToClass[key].tokenTypeIdx);
    });
  });
}
function assignCategoriesMapProp(tokenTypes) {
  forEach_default(tokenTypes, (currTokType) => {
    singleAssignCategoriesToksMap([], currTokType);
  });
}
function singleAssignCategoriesToksMap(path, nextNode) {
  forEach_default(path, (pathNode) => {
    nextNode.categoryMatchesMap[pathNode.tokenTypeIdx] = true;
  });
  forEach_default(nextNode.CATEGORIES, (nextCategory) => {
    const newPath = path.concat(nextNode);
    if (!includes_default(newPath, nextCategory)) {
      singleAssignCategoriesToksMap(newPath, nextCategory);
    }
  });
}
function hasShortKeyProperty(tokType) {
  return has_default(tokType, "tokenTypeIdx");
}
function hasCategoriesProperty(tokType) {
  return has_default(tokType, "CATEGORIES");
}
function hasExtendingTokensTypesProperty(tokType) {
  return has_default(tokType, "categoryMatches");
}
function hasExtendingTokensTypesMapProperty(tokType) {
  return has_default(tokType, "categoryMatchesMap");
}
function isTokenType(tokType) {
  return has_default(tokType, "tokenTypeIdx");
}

// ../../node_modules/chevrotain/lib/src/scan/lexer_errors_public.js
var defaultLexerErrorProvider = {
  buildUnableToPopLexerModeMessage(token) {
    return `Unable to pop Lexer Mode after encountering Token ->${token.image}<- The Mode Stack is empty`;
  },
  buildUnexpectedCharactersMessage(fullText, startOffset, length, line, column, mode) {
    return `unexpected character: ->${fullText.charAt(startOffset)}<- at offset: ${startOffset},` + ` skipped ${length} characters.`;
  }
};

// ../../node_modules/chevrotain/lib/src/scan/lexer_public.js
var LexerDefinitionErrorType;
(function(LexerDefinitionErrorType2) {
  LexerDefinitionErrorType2[LexerDefinitionErrorType2["MISSING_PATTERN"] = 0] = "MISSING_PATTERN";
  LexerDefinitionErrorType2[LexerDefinitionErrorType2["INVALID_PATTERN"] = 1] = "INVALID_PATTERN";
  LexerDefinitionErrorType2[LexerDefinitionErrorType2["EOI_ANCHOR_FOUND"] = 2] = "EOI_ANCHOR_FOUND";
  LexerDefinitionErrorType2[LexerDefinitionErrorType2["UNSUPPORTED_FLAGS_FOUND"] = 3] = "UNSUPPORTED_FLAGS_FOUND";
  LexerDefinitionErrorType2[LexerDefinitionErrorType2["DUPLICATE_PATTERNS_FOUND"] = 4] = "DUPLICATE_PATTERNS_FOUND";
  LexerDefinitionErrorType2[LexerDefinitionErrorType2["INVALID_GROUP_TYPE_FOUND"] = 5] = "INVALID_GROUP_TYPE_FOUND";
  LexerDefinitionErrorType2[LexerDefinitionErrorType2["PUSH_MODE_DOES_NOT_EXIST"] = 6] = "PUSH_MODE_DOES_NOT_EXIST";
  LexerDefinitionErrorType2[LexerDefinitionErrorType2["MULTI_MODE_LEXER_WITHOUT_DEFAULT_MODE"] = 7] = "MULTI_MODE_LEXER_WITHOUT_DEFAULT_MODE";
  LexerDefinitionErrorType2[LexerDefinitionErrorType2["MULTI_MODE_LEXER_WITHOUT_MODES_PROPERTY"] = 8] = "MULTI_MODE_LEXER_WITHOUT_MODES_PROPERTY";
  LexerDefinitionErrorType2[LexerDefinitionErrorType2["MULTI_MODE_LEXER_DEFAULT_MODE_VALUE_DOES_NOT_EXIST"] = 9] = "MULTI_MODE_LEXER_DEFAULT_MODE_VALUE_DOES_NOT_EXIST";
  LexerDefinitionErrorType2[LexerDefinitionErrorType2["LEXER_DEFINITION_CANNOT_CONTAIN_UNDEFINED"] = 10] = "LEXER_DEFINITION_CANNOT_CONTAIN_UNDEFINED";
  LexerDefinitionErrorType2[LexerDefinitionErrorType2["SOI_ANCHOR_FOUND"] = 11] = "SOI_ANCHOR_FOUND";
  LexerDefinitionErrorType2[LexerDefinitionErrorType2["EMPTY_MATCH_PATTERN"] = 12] = "EMPTY_MATCH_PATTERN";
  LexerDefinitionErrorType2[LexerDefinitionErrorType2["NO_LINE_BREAKS_FLAGS"] = 13] = "NO_LINE_BREAKS_FLAGS";
  LexerDefinitionErrorType2[LexerDefinitionErrorType2["UNREACHABLE_PATTERN"] = 14] = "UNREACHABLE_PATTERN";
  LexerDefinitionErrorType2[LexerDefinitionErrorType2["IDENTIFY_TERMINATOR"] = 15] = "IDENTIFY_TERMINATOR";
  LexerDefinitionErrorType2[LexerDefinitionErrorType2["CUSTOM_LINE_BREAK"] = 16] = "CUSTOM_LINE_BREAK";
  LexerDefinitionErrorType2[LexerDefinitionErrorType2["MULTI_MODE_LEXER_LONGER_ALT_NOT_IN_CURRENT_MODE"] = 17] = "MULTI_MODE_LEXER_LONGER_ALT_NOT_IN_CURRENT_MODE";
})(LexerDefinitionErrorType || (LexerDefinitionErrorType = {}));
var DEFAULT_LEXER_CONFIG = {
  deferDefinitionErrorsHandling: false,
  positionTracking: "full",
  lineTerminatorsPattern: /\n|\r\n?/g,
  lineTerminatorCharacters: [`
`, "\r"],
  ensureOptimizations: false,
  safeMode: false,
  errorMessageProvider: defaultLexerErrorProvider,
  traceInitPerf: false,
  skipValidations: false,
  recoveryEnabled: true
};
Object.freeze(DEFAULT_LEXER_CONFIG);

class Lexer {
  constructor(lexerDefinition, config = DEFAULT_LEXER_CONFIG) {
    this.lexerDefinition = lexerDefinition;
    this.lexerDefinitionErrors = [];
    this.lexerDefinitionWarning = [];
    this.patternIdxToConfig = {};
    this.charCodeToPatternIdxToConfig = {};
    this.modes = [];
    this.emptyGroups = {};
    this.trackStartLines = true;
    this.trackEndLines = true;
    this.hasCustom = false;
    this.canModeBeOptimized = {};
    this.TRACE_INIT = (phaseDesc, phaseImpl) => {
      if (this.traceInitPerf === true) {
        this.traceInitIndent++;
        const indent = new Array(this.traceInitIndent + 1).join("\t");
        if (this.traceInitIndent < this.traceInitMaxIdent) {
          console.log(`${indent}--> <${phaseDesc}>`);
        }
        const { time, value } = timer(phaseImpl);
        const traceMethod = time > 10 ? console.warn : console.log;
        if (this.traceInitIndent < this.traceInitMaxIdent) {
          traceMethod(`${indent}<-- <${phaseDesc}> time: ${time}ms`);
        }
        this.traceInitIndent--;
        return value;
      } else {
        return phaseImpl();
      }
    };
    if (typeof config === "boolean") {
      throw Error(`The second argument to the Lexer constructor is now an ILexerConfig Object.
` + "a boolean 2nd argument is no longer supported");
    }
    this.config = assign_default({}, DEFAULT_LEXER_CONFIG, config);
    const traceInitVal = this.config.traceInitPerf;
    if (traceInitVal === true) {
      this.traceInitMaxIdent = Infinity;
      this.traceInitPerf = true;
    } else if (typeof traceInitVal === "number") {
      this.traceInitMaxIdent = traceInitVal;
      this.traceInitPerf = true;
    }
    this.traceInitIndent = -1;
    this.TRACE_INIT("Lexer Constructor", () => {
      let actualDefinition;
      let hasOnlySingleMode = true;
      this.TRACE_INIT("Lexer Config handling", () => {
        if (this.config.lineTerminatorsPattern === DEFAULT_LEXER_CONFIG.lineTerminatorsPattern) {
          this.config.lineTerminatorsPattern = LineTerminatorOptimizedTester;
        } else {
          if (this.config.lineTerminatorCharacters === DEFAULT_LEXER_CONFIG.lineTerminatorCharacters) {
            throw Error(`Error: Missing <lineTerminatorCharacters> property on the Lexer config.
` + "\tFor details See: https://chevrotain.io/docs/guide/resolving_lexer_errors.html#MISSING_LINE_TERM_CHARS");
          }
        }
        if (config.safeMode && config.ensureOptimizations) {
          throw Error('"safeMode" and "ensureOptimizations" flags are mutually exclusive.');
        }
        this.trackStartLines = /full|onlyStart/i.test(this.config.positionTracking);
        this.trackEndLines = /full/i.test(this.config.positionTracking);
        if (isArray_default(lexerDefinition)) {
          actualDefinition = {
            modes: { defaultMode: clone_default(lexerDefinition) },
            defaultMode: DEFAULT_MODE
          };
        } else {
          hasOnlySingleMode = false;
          actualDefinition = clone_default(lexerDefinition);
        }
      });
      if (this.config.skipValidations === false) {
        this.TRACE_INIT("performRuntimeChecks", () => {
          this.lexerDefinitionErrors = this.lexerDefinitionErrors.concat(performRuntimeChecks(actualDefinition, this.trackStartLines, this.config.lineTerminatorCharacters));
        });
        this.TRACE_INIT("performWarningRuntimeChecks", () => {
          this.lexerDefinitionWarning = this.lexerDefinitionWarning.concat(performWarningRuntimeChecks(actualDefinition, this.trackStartLines, this.config.lineTerminatorCharacters));
        });
      }
      actualDefinition.modes = actualDefinition.modes ? actualDefinition.modes : {};
      forEach_default(actualDefinition.modes, (currModeValue, currModeName) => {
        actualDefinition.modes[currModeName] = reject_default(currModeValue, (currTokType) => isUndefined_default(currTokType));
      });
      const allModeNames = keys_default(actualDefinition.modes);
      forEach_default(actualDefinition.modes, (currModDef, currModName) => {
        this.TRACE_INIT(`Mode: <${currModName}> processing`, () => {
          this.modes.push(currModName);
          if (this.config.skipValidations === false) {
            this.TRACE_INIT(`validatePatterns`, () => {
              this.lexerDefinitionErrors = this.lexerDefinitionErrors.concat(validatePatterns(currModDef, allModeNames));
            });
          }
          if (isEmpty_default(this.lexerDefinitionErrors)) {
            augmentTokenTypes(currModDef);
            let currAnalyzeResult;
            this.TRACE_INIT(`analyzeTokenTypes`, () => {
              currAnalyzeResult = analyzeTokenTypes(currModDef, {
                lineTerminatorCharacters: this.config.lineTerminatorCharacters,
                positionTracking: config.positionTracking,
                ensureOptimizations: config.ensureOptimizations,
                safeMode: config.safeMode,
                tracer: this.TRACE_INIT
              });
            });
            this.patternIdxToConfig[currModName] = currAnalyzeResult.patternIdxToConfig;
            this.charCodeToPatternIdxToConfig[currModName] = currAnalyzeResult.charCodeToPatternIdxToConfig;
            this.emptyGroups = assign_default({}, this.emptyGroups, currAnalyzeResult.emptyGroups);
            this.hasCustom = currAnalyzeResult.hasCustom || this.hasCustom;
            this.canModeBeOptimized[currModName] = currAnalyzeResult.canBeOptimized;
          }
        });
      });
      this.defaultMode = actualDefinition.defaultMode;
      if (!isEmpty_default(this.lexerDefinitionErrors) && !this.config.deferDefinitionErrorsHandling) {
        const allErrMessages = map_default(this.lexerDefinitionErrors, (error) => {
          return error.message;
        });
        const allErrMessagesString = allErrMessages.join(`-----------------------
`);
        throw new Error(`Errors detected in definition of Lexer:
` + allErrMessagesString);
      }
      forEach_default(this.lexerDefinitionWarning, (warningDescriptor) => {
        PRINT_WARNING(warningDescriptor.message);
      });
      this.TRACE_INIT("Choosing sub-methods implementations", () => {
        if (hasOnlySingleMode) {
          this.handleModes = noop_default;
        }
        if (this.trackStartLines === false) {
          this.computeNewColumn = identity_default;
        }
        if (this.trackEndLines === false) {
          this.updateTokenEndLineColumnLocation = noop_default;
        }
        if (/full/i.test(this.config.positionTracking)) {
          this.createTokenInstance = this.createFullToken;
        } else if (/onlyStart/i.test(this.config.positionTracking)) {
          this.createTokenInstance = this.createStartOnlyToken;
        } else if (/onlyOffset/i.test(this.config.positionTracking)) {
          this.createTokenInstance = this.createOffsetOnlyToken;
        } else {
          throw Error(`Invalid <positionTracking> config option: "${this.config.positionTracking}"`);
        }
        if (this.hasCustom) {
          this.addToken = this.addTokenUsingPush;
          this.handlePayload = this.handlePayloadWithCustom;
        } else {
          this.addToken = this.addTokenUsingMemberAccess;
          this.handlePayload = this.handlePayloadNoCustom;
        }
      });
      this.TRACE_INIT("Failed Optimization Warnings", () => {
        const unOptimizedModes = reduce_default(this.canModeBeOptimized, (cannotBeOptimized, canBeOptimized, modeName) => {
          if (canBeOptimized === false) {
            cannotBeOptimized.push(modeName);
          }
          return cannotBeOptimized;
        }, []);
        if (config.ensureOptimizations && !isEmpty_default(unOptimizedModes)) {
          throw Error(`Lexer Modes: < ${unOptimizedModes.join(", ")} > cannot be optimized.
` + `	 Disable the "ensureOptimizations" lexer config flag to silently ignore this and run the lexer in an un-optimized mode.
` + "\t Or inspect the console log for details on how to resolve these issues.");
        }
      });
      this.TRACE_INIT("clearRegExpParserCache", () => {
        clearRegExpParserCache();
      });
      this.TRACE_INIT("toFastProperties", () => {
        toFastProperties(this);
      });
    });
  }
  tokenize(text, initialMode = this.defaultMode) {
    if (!isEmpty_default(this.lexerDefinitionErrors)) {
      const allErrMessages = map_default(this.lexerDefinitionErrors, (error) => {
        return error.message;
      });
      const allErrMessagesString = allErrMessages.join(`-----------------------
`);
      throw new Error(`Unable to Tokenize because Errors detected in definition of Lexer:
` + allErrMessagesString);
    }
    return this.tokenizeInternal(text, initialMode);
  }
  tokenizeInternal(text, initialMode) {
    let i, j, k, matchAltImage, longerAlt, matchedImage, payload, altPayload, imageLength, group, tokType, newToken, errLength, msg, match;
    const orgText = text;
    const orgLength = orgText.length;
    let offset = 0;
    let matchedTokensIndex = 0;
    const guessedNumberOfTokens = this.hasCustom ? 0 : Math.floor(text.length / 10);
    const matchedTokens = new Array(guessedNumberOfTokens);
    const errors = [];
    let line = this.trackStartLines ? 1 : undefined;
    let column = this.trackStartLines ? 1 : undefined;
    const groups = cloneEmptyGroups(this.emptyGroups);
    const trackLines = this.trackStartLines;
    const lineTerminatorPattern = this.config.lineTerminatorsPattern;
    let currModePatternsLength = 0;
    let patternIdxToConfig = [];
    let currCharCodeToPatternIdxToConfig = [];
    const modeStack = [];
    const emptyArray = [];
    Object.freeze(emptyArray);
    let isOptimizedMode = false;
    const pop_mode = (popToken) => {
      if (modeStack.length === 1 && popToken.tokenType.PUSH_MODE === undefined) {
        const msg2 = this.config.errorMessageProvider.buildUnableToPopLexerModeMessage(popToken);
        errors.push({
          offset: popToken.startOffset,
          line: popToken.startLine,
          column: popToken.startColumn,
          length: popToken.image.length,
          message: msg2
        });
      } else {
        modeStack.pop();
        const newMode = last_default(modeStack);
        patternIdxToConfig = this.patternIdxToConfig[newMode];
        currCharCodeToPatternIdxToConfig = this.charCodeToPatternIdxToConfig[newMode];
        currModePatternsLength = patternIdxToConfig.length;
        const modeCanBeOptimized = this.canModeBeOptimized[newMode] && this.config.safeMode === false;
        if (currCharCodeToPatternIdxToConfig && modeCanBeOptimized) {
          isOptimizedMode = true;
        } else {
          isOptimizedMode = false;
        }
      }
    };
    function push_mode(newMode) {
      modeStack.push(newMode);
      currCharCodeToPatternIdxToConfig = this.charCodeToPatternIdxToConfig[newMode];
      patternIdxToConfig = this.patternIdxToConfig[newMode];
      currModePatternsLength = patternIdxToConfig.length;
      currModePatternsLength = patternIdxToConfig.length;
      const modeCanBeOptimized = this.canModeBeOptimized[newMode] && this.config.safeMode === false;
      if (currCharCodeToPatternIdxToConfig && modeCanBeOptimized) {
        isOptimizedMode = true;
      } else {
        isOptimizedMode = false;
      }
    }
    push_mode.call(this, initialMode);
    let currConfig;
    const recoveryEnabled = this.config.recoveryEnabled;
    while (offset < orgLength) {
      matchedImage = null;
      imageLength = -1;
      const nextCharCode = orgText.charCodeAt(offset);
      let chosenPatternIdxToConfig;
      if (isOptimizedMode) {
        const optimizedCharIdx = charCodeToOptimizedIndex(nextCharCode);
        const possiblePatterns = currCharCodeToPatternIdxToConfig[optimizedCharIdx];
        chosenPatternIdxToConfig = possiblePatterns !== undefined ? possiblePatterns : emptyArray;
      } else {
        chosenPatternIdxToConfig = patternIdxToConfig;
      }
      const chosenPatternsLength = chosenPatternIdxToConfig.length;
      for (i = 0;i < chosenPatternsLength; i++) {
        currConfig = chosenPatternIdxToConfig[i];
        const currPattern = currConfig.pattern;
        payload = null;
        const singleCharCode = currConfig.short;
        if (singleCharCode !== false) {
          if (nextCharCode === singleCharCode) {
            imageLength = 1;
            matchedImage = currPattern;
          }
        } else if (currConfig.isCustom === true) {
          match = currPattern.exec(orgText, offset, matchedTokens, groups);
          if (match !== null) {
            matchedImage = match[0];
            imageLength = matchedImage.length;
            if (match.payload !== undefined) {
              payload = match.payload;
            }
          } else {
            matchedImage = null;
          }
        } else {
          currPattern.lastIndex = offset;
          imageLength = this.matchLength(currPattern, text, offset);
        }
        if (imageLength !== -1) {
          longerAlt = currConfig.longerAlt;
          if (longerAlt !== undefined) {
            matchedImage = text.substring(offset, offset + imageLength);
            const longerAltLength = longerAlt.length;
            for (k = 0;k < longerAltLength; k++) {
              const longerAltConfig = patternIdxToConfig[longerAlt[k]];
              const longerAltPattern = longerAltConfig.pattern;
              altPayload = null;
              if (longerAltConfig.isCustom === true) {
                match = longerAltPattern.exec(orgText, offset, matchedTokens, groups);
                if (match !== null) {
                  matchAltImage = match[0];
                  if (match.payload !== undefined) {
                    altPayload = match.payload;
                  }
                } else {
                  matchAltImage = null;
                }
              } else {
                longerAltPattern.lastIndex = offset;
                matchAltImage = this.match(longerAltPattern, text, offset);
              }
              if (matchAltImage && matchAltImage.length > matchedImage.length) {
                matchedImage = matchAltImage;
                imageLength = matchAltImage.length;
                payload = altPayload;
                currConfig = longerAltConfig;
                break;
              }
            }
          }
          break;
        }
      }
      if (imageLength !== -1) {
        group = currConfig.group;
        if (group !== undefined) {
          matchedImage = matchedImage !== null ? matchedImage : text.substring(offset, offset + imageLength);
          tokType = currConfig.tokenTypeIdx;
          newToken = this.createTokenInstance(matchedImage, offset, tokType, currConfig.tokenType, line, column, imageLength);
          this.handlePayload(newToken, payload);
          if (group === false) {
            matchedTokensIndex = this.addToken(matchedTokens, matchedTokensIndex, newToken);
          } else {
            groups[group].push(newToken);
          }
        }
        if (trackLines === true && currConfig.canLineTerminator === true) {
          let numOfLTsInMatch = 0;
          let foundTerminator;
          let lastLTEndOffset;
          lineTerminatorPattern.lastIndex = 0;
          do {
            matchedImage = matchedImage !== null ? matchedImage : text.substring(offset, offset + imageLength);
            foundTerminator = lineTerminatorPattern.test(matchedImage);
            if (foundTerminator === true) {
              lastLTEndOffset = lineTerminatorPattern.lastIndex - 1;
              numOfLTsInMatch++;
            }
          } while (foundTerminator === true);
          if (numOfLTsInMatch !== 0) {
            line = line + numOfLTsInMatch;
            column = imageLength - lastLTEndOffset;
            this.updateTokenEndLineColumnLocation(newToken, group, lastLTEndOffset, numOfLTsInMatch, line, column, imageLength);
          } else {
            column = this.computeNewColumn(column, imageLength);
          }
        } else {
          column = this.computeNewColumn(column, imageLength);
        }
        offset = offset + imageLength;
        this.handleModes(currConfig, pop_mode, push_mode, newToken);
      } else {
        const errorStartOffset = offset;
        const errorLine = line;
        const errorColumn = column;
        let foundResyncPoint = recoveryEnabled === false;
        while (foundResyncPoint === false && offset < orgLength) {
          offset++;
          for (j = 0;j < currModePatternsLength; j++) {
            const currConfig2 = patternIdxToConfig[j];
            const currPattern = currConfig2.pattern;
            const singleCharCode = currConfig2.short;
            if (singleCharCode !== false) {
              if (orgText.charCodeAt(offset) === singleCharCode) {
                foundResyncPoint = true;
              }
            } else if (currConfig2.isCustom === true) {
              foundResyncPoint = currPattern.exec(orgText, offset, matchedTokens, groups) !== null;
            } else {
              currPattern.lastIndex = offset;
              foundResyncPoint = currPattern.exec(text) !== null;
            }
            if (foundResyncPoint === true) {
              break;
            }
          }
        }
        errLength = offset - errorStartOffset;
        column = this.computeNewColumn(column, errLength);
        msg = this.config.errorMessageProvider.buildUnexpectedCharactersMessage(orgText, errorStartOffset, errLength, errorLine, errorColumn, last_default(modeStack));
        errors.push({
          offset: errorStartOffset,
          line: errorLine,
          column: errorColumn,
          length: errLength,
          message: msg
        });
        if (recoveryEnabled === false) {
          break;
        }
      }
    }
    if (!this.hasCustom) {
      matchedTokens.length = matchedTokensIndex;
    }
    return {
      tokens: matchedTokens,
      groups,
      errors
    };
  }
  handleModes(config, pop_mode, push_mode, newToken) {
    if (config.pop === true) {
      const pushMode = config.push;
      pop_mode(newToken);
      if (pushMode !== undefined) {
        push_mode.call(this, pushMode);
      }
    } else if (config.push !== undefined) {
      push_mode.call(this, config.push);
    }
  }
  updateTokenEndLineColumnLocation(newToken, group, lastLTIdx, numOfLTsInMatch, line, column, imageLength) {
    let lastCharIsLT, fixForEndingInLT;
    if (group !== undefined) {
      lastCharIsLT = lastLTIdx === imageLength - 1;
      fixForEndingInLT = lastCharIsLT ? -1 : 0;
      if (!(numOfLTsInMatch === 1 && lastCharIsLT === true)) {
        newToken.endLine = line + fixForEndingInLT;
        newToken.endColumn = column - 1 + -fixForEndingInLT;
      }
    }
  }
  computeNewColumn(oldColumn, imageLength) {
    return oldColumn + imageLength;
  }
  createOffsetOnlyToken(image, startOffset, tokenTypeIdx, tokenType) {
    return {
      image,
      startOffset,
      tokenTypeIdx,
      tokenType
    };
  }
  createStartOnlyToken(image, startOffset, tokenTypeIdx, tokenType, startLine, startColumn) {
    return {
      image,
      startOffset,
      startLine,
      startColumn,
      tokenTypeIdx,
      tokenType
    };
  }
  createFullToken(image, startOffset, tokenTypeIdx, tokenType, startLine, startColumn, imageLength) {
    return {
      image,
      startOffset,
      endOffset: startOffset + imageLength - 1,
      startLine,
      endLine: startLine,
      startColumn,
      endColumn: startColumn + imageLength - 1,
      tokenTypeIdx,
      tokenType
    };
  }
  addTokenUsingPush(tokenVector, index, tokenToAdd) {
    tokenVector.push(tokenToAdd);
    return index;
  }
  addTokenUsingMemberAccess(tokenVector, index, tokenToAdd) {
    tokenVector[index] = tokenToAdd;
    index++;
    return index;
  }
  handlePayloadNoCustom(token, payload) {}
  handlePayloadWithCustom(token, payload) {
    if (payload !== null) {
      token.payload = payload;
    }
  }
  match(pattern, text, offset) {
    const found = pattern.test(text);
    if (found === true) {
      return text.substring(offset, pattern.lastIndex);
    }
    return null;
  }
  matchLength(pattern, text, offset) {
    const found = pattern.test(text);
    if (found === true) {
      return pattern.lastIndex - offset;
    }
    return -1;
  }
}
Lexer.SKIPPED = "This marks a skipped Token pattern, this means each token identified by it will " + "be consumed and then thrown into oblivion, this can be used to for example to completely ignore whitespace.";
Lexer.NA = /NOT_APPLICABLE/;

// ../../node_modules/chevrotain/lib/src/scan/tokens_public.js
function tokenLabel2(tokType) {
  if (hasTokenLabel2(tokType)) {
    return tokType.LABEL;
  } else {
    return tokType.name;
  }
}
function hasTokenLabel2(obj) {
  return isString_default(obj.LABEL) && obj.LABEL !== "";
}
var PARENT = "parent";
var CATEGORIES = "categories";
var LABEL = "label";
var GROUP = "group";
var PUSH_MODE = "push_mode";
var POP_MODE = "pop_mode";
var LONGER_ALT = "longer_alt";
var LINE_BREAKS = "line_breaks";
var START_CHARS_HINT = "start_chars_hint";
function createToken(config) {
  return createTokenInternal(config);
}
function createTokenInternal(config) {
  const pattern = config.pattern;
  const tokenType = {};
  tokenType.name = config.name;
  if (!isUndefined_default(pattern)) {
    tokenType.PATTERN = pattern;
  }
  if (has_default(config, PARENT)) {
    throw `The parent property is no longer supported.
` + "See: https://github.com/chevrotain/chevrotain/issues/564#issuecomment-349062346 for details.";
  }
  if (has_default(config, CATEGORIES)) {
    tokenType.CATEGORIES = config[CATEGORIES];
  }
  augmentTokenTypes([tokenType]);
  if (has_default(config, LABEL)) {
    tokenType.LABEL = config[LABEL];
  }
  if (has_default(config, GROUP)) {
    tokenType.GROUP = config[GROUP];
  }
  if (has_default(config, POP_MODE)) {
    tokenType.POP_MODE = config[POP_MODE];
  }
  if (has_default(config, PUSH_MODE)) {
    tokenType.PUSH_MODE = config[PUSH_MODE];
  }
  if (has_default(config, LONGER_ALT)) {
    tokenType.LONGER_ALT = config[LONGER_ALT];
  }
  if (has_default(config, LINE_BREAKS)) {
    tokenType.LINE_BREAKS = config[LINE_BREAKS];
  }
  if (has_default(config, START_CHARS_HINT)) {
    tokenType.START_CHARS_HINT = config[START_CHARS_HINT];
  }
  return tokenType;
}
var EOF = createToken({ name: "EOF", pattern: Lexer.NA });
augmentTokenTypes([EOF]);
function createTokenInstance(tokType, image, startOffset, endOffset, startLine, endLine, startColumn, endColumn) {
  return {
    image,
    startOffset,
    endOffset,
    startLine,
    endLine,
    startColumn,
    endColumn,
    tokenTypeIdx: tokType.tokenTypeIdx,
    tokenType: tokType
  };
}
function tokenMatcher(token, tokType) {
  return tokenStructuredMatcher(token, tokType);
}

// ../../node_modules/chevrotain/lib/src/parse/errors_public.js
var defaultParserErrorProvider = {
  buildMismatchTokenMessage({ expected, actual, previous, ruleName }) {
    const hasLabel = hasTokenLabel2(expected);
    const expectedMsg = hasLabel ? `--> ${tokenLabel2(expected)} <--` : `token of type --> ${expected.name} <--`;
    const msg = `Expecting ${expectedMsg} but found --> '${actual.image}' <--`;
    return msg;
  },
  buildNotAllInputParsedMessage({ firstRedundant, ruleName }) {
    return "Redundant input, expecting EOF but found: " + firstRedundant.image;
  },
  buildNoViableAltMessage({ expectedPathsPerAlt, actual, previous, customUserDescription, ruleName }) {
    const errPrefix = "Expecting: ";
    const actualText = head_default(actual).image;
    const errSuffix = `
but found: '` + actualText + "'";
    if (customUserDescription) {
      return errPrefix + customUserDescription + errSuffix;
    } else {
      const allLookAheadPaths = reduce_default(expectedPathsPerAlt, (result, currAltPaths) => result.concat(currAltPaths), []);
      const nextValidTokenSequences = map_default(allLookAheadPaths, (currPath) => `[${map_default(currPath, (currTokenType) => tokenLabel2(currTokenType)).join(", ")}]`);
      const nextValidSequenceItems = map_default(nextValidTokenSequences, (itemMsg, idx) => `  ${idx + 1}. ${itemMsg}`);
      const calculatedDescription = `one of these possible Token sequences:
${nextValidSequenceItems.join(`
`)}`;
      return errPrefix + calculatedDescription + errSuffix;
    }
  },
  buildEarlyExitMessage({ expectedIterationPaths, actual, customUserDescription, ruleName }) {
    const errPrefix = "Expecting: ";
    const actualText = head_default(actual).image;
    const errSuffix = `
but found: '` + actualText + "'";
    if (customUserDescription) {
      return errPrefix + customUserDescription + errSuffix;
    } else {
      const nextValidTokenSequences = map_default(expectedIterationPaths, (currPath) => `[${map_default(currPath, (currTokenType) => tokenLabel2(currTokenType)).join(",")}]`);
      const calculatedDescription = `expecting at least one iteration which starts with one of these possible Token sequences::
  ` + `<${nextValidTokenSequences.join(" ,")}>`;
      return errPrefix + calculatedDescription + errSuffix;
    }
  }
};
Object.freeze(defaultParserErrorProvider);
var defaultGrammarResolverErrorProvider = {
  buildRuleNotFoundError(topLevelRule, undefinedRule) {
    const msg = "Invalid grammar, reference to a rule which is not defined: ->" + undefinedRule.nonTerminalName + `<-
` + "inside top level rule: ->" + topLevelRule.name + "<-";
    return msg;
  }
};
var defaultGrammarValidatorErrorProvider = {
  buildDuplicateFoundError(topLevelRule, duplicateProds) {
    function getExtraProductionArgument(prod) {
      if (prod instanceof Terminal) {
        return prod.terminalType.name;
      } else if (prod instanceof NonTerminal) {
        return prod.nonTerminalName;
      } else {
        return "";
      }
    }
    const topLevelName = topLevelRule.name;
    const duplicateProd = head_default(duplicateProds);
    const index = duplicateProd.idx;
    const dslName = getProductionDslName(duplicateProd);
    const extraArgument = getExtraProductionArgument(duplicateProd);
    const hasExplicitIndex = index > 0;
    let msg = `->${dslName}${hasExplicitIndex ? index : ""}<- ${extraArgument ? `with argument: ->${extraArgument}<-` : ""}
                  appears more than once (${duplicateProds.length} times) in the top level rule: ->${topLevelName}<-.                  
                  For further details see: https://chevrotain.io/docs/FAQ.html#NUMERICAL_SUFFIXES 
                  `;
    msg = msg.replace(/[ \t]+/g, " ");
    msg = msg.replace(/\s\s+/g, `
`);
    return msg;
  },
  buildNamespaceConflictError(rule) {
    const errMsg = `Namespace conflict found in grammar.
` + `The grammar has both a Terminal(Token) and a Non-Terminal(Rule) named: <${rule.name}>.
` + `To resolve this make sure each Terminal and Non-Terminal names are unique
` + `This is easy to accomplish by using the convention that Terminal names start with an uppercase letter
` + `and Non-Terminal names start with a lower case letter.`;
    return errMsg;
  },
  buildAlternationPrefixAmbiguityError(options) {
    const pathMsg = map_default(options.prefixPath, (currTok) => tokenLabel2(currTok)).join(", ");
    const occurrence = options.alternation.idx === 0 ? "" : options.alternation.idx;
    const errMsg = `Ambiguous alternatives: <${options.ambiguityIndices.join(" ,")}> due to common lookahead prefix
` + `in <OR${occurrence}> inside <${options.topLevelRule.name}> Rule,
` + `<${pathMsg}> may appears as a prefix path in all these alternatives.
` + `See: https://chevrotain.io/docs/guide/resolving_grammar_errors.html#COMMON_PREFIX
` + `For Further details.`;
    return errMsg;
  },
  buildAlternationAmbiguityError(options) {
    const occurrence = options.alternation.idx === 0 ? "" : options.alternation.idx;
    const isEmptyPath = options.prefixPath.length === 0;
    let currMessage = `Ambiguous Alternatives Detected: <${options.ambiguityIndices.join(" ,")}> in <OR${occurrence}>` + ` inside <${options.topLevelRule.name}> Rule,
`;
    if (isEmptyPath) {
      currMessage += `These alternatives are all empty (match no tokens), making them indistinguishable.
` + `Only the last alternative may be empty.
`;
    } else {
      const pathMsg = map_default(options.prefixPath, (currtok) => tokenLabel2(currtok)).join(", ");
      currMessage += `<${pathMsg}> may appears as a prefix path in all these alternatives.
`;
    }
    currMessage += `See: https://chevrotain.io/docs/guide/resolving_grammar_errors.html#AMBIGUOUS_ALTERNATIVES
` + `For Further details.`;
    return currMessage;
  },
  buildEmptyRepetitionError(options) {
    let dslName = getProductionDslName(options.repetition);
    if (options.repetition.idx !== 0) {
      dslName += options.repetition.idx;
    }
    const errMsg = `The repetition <${dslName}> within Rule <${options.topLevelRule.name}> can never consume any tokens.
` + `This could lead to an infinite loop.`;
    return errMsg;
  },
  buildTokenNameError(options) {
    return "deprecated";
  },
  buildEmptyAlternationError(options) {
    const errMsg = `Ambiguous empty alternative: <${options.emptyChoiceIdx + 1}>` + ` in <OR${options.alternation.idx}> inside <${options.topLevelRule.name}> Rule.
` + `Only the last alternative may be an empty alternative.`;
    return errMsg;
  },
  buildTooManyAlternativesError(options) {
    const errMsg = `An Alternation cannot have more than 256 alternatives:
` + `<OR${options.alternation.idx}> inside <${options.topLevelRule.name}> Rule.
 has ${options.alternation.definition.length + 1} alternatives.`;
    return errMsg;
  },
  buildLeftRecursionError(options) {
    const ruleName = options.topLevelRule.name;
    const pathNames = map_default(options.leftRecursionPath, (currRule) => currRule.name);
    const leftRecursivePath = `${ruleName} --> ${pathNames.concat([ruleName]).join(" --> ")}`;
    const errMsg = `Left Recursion found in grammar.
` + `rule: <${ruleName}> can be invoked from itself (directly or indirectly)
` + `without consuming any Tokens. The grammar path that causes this is: 
 ${leftRecursivePath}
` + ` To fix this refactor your grammar to remove the left recursion.
` + `see: https://en.wikipedia.org/wiki/LL_parser#Left_factoring.`;
    return errMsg;
  },
  buildInvalidRuleNameError(options) {
    return "deprecated";
  },
  buildDuplicateRuleNameError(options) {
    let ruleName;
    if (options.topLevelRule instanceof Rule) {
      ruleName = options.topLevelRule.name;
    } else {
      ruleName = options.topLevelRule;
    }
    const errMsg = `Duplicate definition, rule: ->${ruleName}<- is already defined in the grammar: ->${options.grammarName}<-`;
    return errMsg;
  }
};

// ../../node_modules/chevrotain/lib/src/parse/grammar/resolver.js
function resolveGrammar(topLevels, errMsgProvider) {
  const refResolver = new GastRefResolverVisitor(topLevels, errMsgProvider);
  refResolver.resolveRefs();
  return refResolver.errors;
}

class GastRefResolverVisitor extends GAstVisitor {
  constructor(nameToTopRule, errMsgProvider) {
    super();
    this.nameToTopRule = nameToTopRule;
    this.errMsgProvider = errMsgProvider;
    this.errors = [];
  }
  resolveRefs() {
    forEach_default(values_default(this.nameToTopRule), (prod) => {
      this.currTopLevel = prod;
      prod.accept(this);
    });
  }
  visitNonTerminal(node) {
    const ref = this.nameToTopRule[node.nonTerminalName];
    if (!ref) {
      const msg = this.errMsgProvider.buildRuleNotFoundError(this.currTopLevel, node);
      this.errors.push({
        message: msg,
        type: ParserDefinitionErrorType.UNRESOLVED_SUBRULE_REF,
        ruleName: this.currTopLevel.name,
        unresolvedRefName: node.nonTerminalName
      });
    } else {
      node.referencedRule = ref;
    }
  }
}

// ../../node_modules/chevrotain/lib/src/parse/grammar/interpreter.js
class AbstractNextPossibleTokensWalker extends RestWalker {
  constructor(topProd, path) {
    super();
    this.topProd = topProd;
    this.path = path;
    this.possibleTokTypes = [];
    this.nextProductionName = "";
    this.nextProductionOccurrence = 0;
    this.found = false;
    this.isAtEndOfPath = false;
  }
  startWalking() {
    this.found = false;
    if (this.path.ruleStack[0] !== this.topProd.name) {
      throw Error("The path does not start with the walker's top Rule!");
    }
    this.ruleStack = clone_default(this.path.ruleStack).reverse();
    this.occurrenceStack = clone_default(this.path.occurrenceStack).reverse();
    this.ruleStack.pop();
    this.occurrenceStack.pop();
    this.updateExpectedNext();
    this.walk(this.topProd);
    return this.possibleTokTypes;
  }
  walk(prod, prevRest = []) {
    if (!this.found) {
      super.walk(prod, prevRest);
    }
  }
  walkProdRef(refProd, currRest, prevRest) {
    if (refProd.referencedRule.name === this.nextProductionName && refProd.idx === this.nextProductionOccurrence) {
      const fullRest = currRest.concat(prevRest);
      this.updateExpectedNext();
      this.walk(refProd.referencedRule, fullRest);
    }
  }
  updateExpectedNext() {
    if (isEmpty_default(this.ruleStack)) {
      this.nextProductionName = "";
      this.nextProductionOccurrence = 0;
      this.isAtEndOfPath = true;
    } else {
      this.nextProductionName = this.ruleStack.pop();
      this.nextProductionOccurrence = this.occurrenceStack.pop();
    }
  }
}

class NextAfterTokenWalker extends AbstractNextPossibleTokensWalker {
  constructor(topProd, path) {
    super(topProd, path);
    this.path = path;
    this.nextTerminalName = "";
    this.nextTerminalOccurrence = 0;
    this.nextTerminalName = this.path.lastTok.name;
    this.nextTerminalOccurrence = this.path.lastTokOccurrence;
  }
  walkTerminal(terminal, currRest, prevRest) {
    if (this.isAtEndOfPath && terminal.terminalType.name === this.nextTerminalName && terminal.idx === this.nextTerminalOccurrence && !this.found) {
      const fullRest = currRest.concat(prevRest);
      const restProd = new Alternative({ definition: fullRest });
      this.possibleTokTypes = first(restProd);
      this.found = true;
    }
  }
}

class AbstractNextTerminalAfterProductionWalker extends RestWalker {
  constructor(topRule, occurrence) {
    super();
    this.topRule = topRule;
    this.occurrence = occurrence;
    this.result = {
      token: undefined,
      occurrence: undefined,
      isEndOfRule: undefined
    };
  }
  startWalking() {
    this.walk(this.topRule);
    return this.result;
  }
}

class NextTerminalAfterManyWalker extends AbstractNextTerminalAfterProductionWalker {
  walkMany(manyProd, currRest, prevRest) {
    if (manyProd.idx === this.occurrence) {
      const firstAfterMany = head_default(currRest.concat(prevRest));
      this.result.isEndOfRule = firstAfterMany === undefined;
      if (firstAfterMany instanceof Terminal) {
        this.result.token = firstAfterMany.terminalType;
        this.result.occurrence = firstAfterMany.idx;
      }
    } else {
      super.walkMany(manyProd, currRest, prevRest);
    }
  }
}

class NextTerminalAfterManySepWalker extends AbstractNextTerminalAfterProductionWalker {
  walkManySep(manySepProd, currRest, prevRest) {
    if (manySepProd.idx === this.occurrence) {
      const firstAfterManySep = head_default(currRest.concat(prevRest));
      this.result.isEndOfRule = firstAfterManySep === undefined;
      if (firstAfterManySep instanceof Terminal) {
        this.result.token = firstAfterManySep.terminalType;
        this.result.occurrence = firstAfterManySep.idx;
      }
    } else {
      super.walkManySep(manySepProd, currRest, prevRest);
    }
  }
}

class NextTerminalAfterAtLeastOneWalker extends AbstractNextTerminalAfterProductionWalker {
  walkAtLeastOne(atLeastOneProd, currRest, prevRest) {
    if (atLeastOneProd.idx === this.occurrence) {
      const firstAfterAtLeastOne = head_default(currRest.concat(prevRest));
      this.result.isEndOfRule = firstAfterAtLeastOne === undefined;
      if (firstAfterAtLeastOne instanceof Terminal) {
        this.result.token = firstAfterAtLeastOne.terminalType;
        this.result.occurrence = firstAfterAtLeastOne.idx;
      }
    } else {
      super.walkAtLeastOne(atLeastOneProd, currRest, prevRest);
    }
  }
}

class NextTerminalAfterAtLeastOneSepWalker extends AbstractNextTerminalAfterProductionWalker {
  walkAtLeastOneSep(atleastOneSepProd, currRest, prevRest) {
    if (atleastOneSepProd.idx === this.occurrence) {
      const firstAfterfirstAfterAtLeastOneSep = head_default(currRest.concat(prevRest));
      this.result.isEndOfRule = firstAfterfirstAfterAtLeastOneSep === undefined;
      if (firstAfterfirstAfterAtLeastOneSep instanceof Terminal) {
        this.result.token = firstAfterfirstAfterAtLeastOneSep.terminalType;
        this.result.occurrence = firstAfterfirstAfterAtLeastOneSep.idx;
      }
    } else {
      super.walkAtLeastOneSep(atleastOneSepProd, currRest, prevRest);
    }
  }
}
function possiblePathsFrom(targetDef, maxLength, currPath = []) {
  currPath = clone_default(currPath);
  let result = [];
  let i = 0;
  function remainingPathWith(nextDef) {
    return nextDef.concat(drop_default(targetDef, i + 1));
  }
  function getAlternativesForProd(definition) {
    const alternatives = possiblePathsFrom(remainingPathWith(definition), maxLength, currPath);
    return result.concat(alternatives);
  }
  while (currPath.length < maxLength && i < targetDef.length) {
    const prod = targetDef[i];
    if (prod instanceof Alternative) {
      return getAlternativesForProd(prod.definition);
    } else if (prod instanceof NonTerminal) {
      return getAlternativesForProd(prod.definition);
    } else if (prod instanceof Option) {
      result = getAlternativesForProd(prod.definition);
    } else if (prod instanceof RepetitionMandatory) {
      const newDef = prod.definition.concat([
        new Repetition({
          definition: prod.definition
        })
      ]);
      return getAlternativesForProd(newDef);
    } else if (prod instanceof RepetitionMandatoryWithSeparator) {
      const newDef = [
        new Alternative({ definition: prod.definition }),
        new Repetition({
          definition: [new Terminal({ terminalType: prod.separator })].concat(prod.definition)
        })
      ];
      return getAlternativesForProd(newDef);
    } else if (prod instanceof RepetitionWithSeparator) {
      const newDef = prod.definition.concat([
        new Repetition({
          definition: [new Terminal({ terminalType: prod.separator })].concat(prod.definition)
        })
      ]);
      result = getAlternativesForProd(newDef);
    } else if (prod instanceof Repetition) {
      const newDef = prod.definition.concat([
        new Repetition({
          definition: prod.definition
        })
      ]);
      result = getAlternativesForProd(newDef);
    } else if (prod instanceof Alternation) {
      forEach_default(prod.definition, (currAlt) => {
        if (isEmpty_default(currAlt.definition) === false) {
          result = getAlternativesForProd(currAlt.definition);
        }
      });
      return result;
    } else if (prod instanceof Terminal) {
      currPath.push(prod.terminalType);
    } else {
      throw Error("non exhaustive match");
    }
    i++;
  }
  result.push({
    partialPath: currPath,
    suffixDef: drop_default(targetDef, i)
  });
  return result;
}
function nextPossibleTokensAfter(initialDef, tokenVector, tokMatcher, maxLookAhead) {
  const EXIT_NON_TERMINAL = "EXIT_NONE_TERMINAL";
  const EXIT_NON_TERMINAL_ARR = [EXIT_NON_TERMINAL];
  const EXIT_ALTERNATIVE = "EXIT_ALTERNATIVE";
  let foundCompletePath = false;
  const tokenVectorLength = tokenVector.length;
  const minimalAlternativesIndex = tokenVectorLength - maxLookAhead - 1;
  const result = [];
  const possiblePaths = [];
  possiblePaths.push({
    idx: -1,
    def: initialDef,
    ruleStack: [],
    occurrenceStack: []
  });
  while (!isEmpty_default(possiblePaths)) {
    const currPath = possiblePaths.pop();
    if (currPath === EXIT_ALTERNATIVE) {
      if (foundCompletePath && last_default(possiblePaths).idx <= minimalAlternativesIndex) {
        possiblePaths.pop();
      }
      continue;
    }
    const currDef = currPath.def;
    const currIdx = currPath.idx;
    const currRuleStack = currPath.ruleStack;
    const currOccurrenceStack = currPath.occurrenceStack;
    if (isEmpty_default(currDef)) {
      continue;
    }
    const prod = currDef[0];
    if (prod === EXIT_NON_TERMINAL) {
      const nextPath = {
        idx: currIdx,
        def: drop_default(currDef),
        ruleStack: dropRight_default(currRuleStack),
        occurrenceStack: dropRight_default(currOccurrenceStack)
      };
      possiblePaths.push(nextPath);
    } else if (prod instanceof Terminal) {
      if (currIdx < tokenVectorLength - 1) {
        const nextIdx = currIdx + 1;
        const actualToken = tokenVector[nextIdx];
        if (tokMatcher(actualToken, prod.terminalType)) {
          const nextPath = {
            idx: nextIdx,
            def: drop_default(currDef),
            ruleStack: currRuleStack,
            occurrenceStack: currOccurrenceStack
          };
          possiblePaths.push(nextPath);
        }
      } else if (currIdx === tokenVectorLength - 1) {
        result.push({
          nextTokenType: prod.terminalType,
          nextTokenOccurrence: prod.idx,
          ruleStack: currRuleStack,
          occurrenceStack: currOccurrenceStack
        });
        foundCompletePath = true;
      } else {
        throw Error("non exhaustive match");
      }
    } else if (prod instanceof NonTerminal) {
      const newRuleStack = clone_default(currRuleStack);
      newRuleStack.push(prod.nonTerminalName);
      const newOccurrenceStack = clone_default(currOccurrenceStack);
      newOccurrenceStack.push(prod.idx);
      const nextPath = {
        idx: currIdx,
        def: prod.definition.concat(EXIT_NON_TERMINAL_ARR, drop_default(currDef)),
        ruleStack: newRuleStack,
        occurrenceStack: newOccurrenceStack
      };
      possiblePaths.push(nextPath);
    } else if (prod instanceof Option) {
      const nextPathWithout = {
        idx: currIdx,
        def: drop_default(currDef),
        ruleStack: currRuleStack,
        occurrenceStack: currOccurrenceStack
      };
      possiblePaths.push(nextPathWithout);
      possiblePaths.push(EXIT_ALTERNATIVE);
      const nextPathWith = {
        idx: currIdx,
        def: prod.definition.concat(drop_default(currDef)),
        ruleStack: currRuleStack,
        occurrenceStack: currOccurrenceStack
      };
      possiblePaths.push(nextPathWith);
    } else if (prod instanceof RepetitionMandatory) {
      const secondIteration = new Repetition({
        definition: prod.definition,
        idx: prod.idx
      });
      const nextDef = prod.definition.concat([secondIteration], drop_default(currDef));
      const nextPath = {
        idx: currIdx,
        def: nextDef,
        ruleStack: currRuleStack,
        occurrenceStack: currOccurrenceStack
      };
      possiblePaths.push(nextPath);
    } else if (prod instanceof RepetitionMandatoryWithSeparator) {
      const separatorGast = new Terminal({
        terminalType: prod.separator
      });
      const secondIteration = new Repetition({
        definition: [separatorGast].concat(prod.definition),
        idx: prod.idx
      });
      const nextDef = prod.definition.concat([secondIteration], drop_default(currDef));
      const nextPath = {
        idx: currIdx,
        def: nextDef,
        ruleStack: currRuleStack,
        occurrenceStack: currOccurrenceStack
      };
      possiblePaths.push(nextPath);
    } else if (prod instanceof RepetitionWithSeparator) {
      const nextPathWithout = {
        idx: currIdx,
        def: drop_default(currDef),
        ruleStack: currRuleStack,
        occurrenceStack: currOccurrenceStack
      };
      possiblePaths.push(nextPathWithout);
      possiblePaths.push(EXIT_ALTERNATIVE);
      const separatorGast = new Terminal({
        terminalType: prod.separator
      });
      const nthRepetition = new Repetition({
        definition: [separatorGast].concat(prod.definition),
        idx: prod.idx
      });
      const nextDef = prod.definition.concat([nthRepetition], drop_default(currDef));
      const nextPathWith = {
        idx: currIdx,
        def: nextDef,
        ruleStack: currRuleStack,
        occurrenceStack: currOccurrenceStack
      };
      possiblePaths.push(nextPathWith);
    } else if (prod instanceof Repetition) {
      const nextPathWithout = {
        idx: currIdx,
        def: drop_default(currDef),
        ruleStack: currRuleStack,
        occurrenceStack: currOccurrenceStack
      };
      possiblePaths.push(nextPathWithout);
      possiblePaths.push(EXIT_ALTERNATIVE);
      const nthRepetition = new Repetition({
        definition: prod.definition,
        idx: prod.idx
      });
      const nextDef = prod.definition.concat([nthRepetition], drop_default(currDef));
      const nextPathWith = {
        idx: currIdx,
        def: nextDef,
        ruleStack: currRuleStack,
        occurrenceStack: currOccurrenceStack
      };
      possiblePaths.push(nextPathWith);
    } else if (prod instanceof Alternation) {
      for (let i = prod.definition.length - 1;i >= 0; i--) {
        const currAlt = prod.definition[i];
        const currAltPath = {
          idx: currIdx,
          def: currAlt.definition.concat(drop_default(currDef)),
          ruleStack: currRuleStack,
          occurrenceStack: currOccurrenceStack
        };
        possiblePaths.push(currAltPath);
        possiblePaths.push(EXIT_ALTERNATIVE);
      }
    } else if (prod instanceof Alternative) {
      possiblePaths.push({
        idx: currIdx,
        def: prod.definition.concat(drop_default(currDef)),
        ruleStack: currRuleStack,
        occurrenceStack: currOccurrenceStack
      });
    } else if (prod instanceof Rule) {
      possiblePaths.push(expandTopLevelRule(prod, currIdx, currRuleStack, currOccurrenceStack));
    } else {
      throw Error("non exhaustive match");
    }
  }
  return result;
}
function expandTopLevelRule(topRule, currIdx, currRuleStack, currOccurrenceStack) {
  const newRuleStack = clone_default(currRuleStack);
  newRuleStack.push(topRule.name);
  const newCurrOccurrenceStack = clone_default(currOccurrenceStack);
  newCurrOccurrenceStack.push(1);
  return {
    idx: currIdx,
    def: topRule.definition,
    ruleStack: newRuleStack,
    occurrenceStack: newCurrOccurrenceStack
  };
}

// ../../node_modules/chevrotain/lib/src/parse/grammar/lookahead.js
var PROD_TYPE;
(function(PROD_TYPE2) {
  PROD_TYPE2[PROD_TYPE2["OPTION"] = 0] = "OPTION";
  PROD_TYPE2[PROD_TYPE2["REPETITION"] = 1] = "REPETITION";
  PROD_TYPE2[PROD_TYPE2["REPETITION_MANDATORY"] = 2] = "REPETITION_MANDATORY";
  PROD_TYPE2[PROD_TYPE2["REPETITION_MANDATORY_WITH_SEPARATOR"] = 3] = "REPETITION_MANDATORY_WITH_SEPARATOR";
  PROD_TYPE2[PROD_TYPE2["REPETITION_WITH_SEPARATOR"] = 4] = "REPETITION_WITH_SEPARATOR";
  PROD_TYPE2[PROD_TYPE2["ALTERNATION"] = 5] = "ALTERNATION";
})(PROD_TYPE || (PROD_TYPE = {}));
function getProdType(prod) {
  if (prod instanceof Option || prod === "Option") {
    return PROD_TYPE.OPTION;
  } else if (prod instanceof Repetition || prod === "Repetition") {
    return PROD_TYPE.REPETITION;
  } else if (prod instanceof RepetitionMandatory || prod === "RepetitionMandatory") {
    return PROD_TYPE.REPETITION_MANDATORY;
  } else if (prod instanceof RepetitionMandatoryWithSeparator || prod === "RepetitionMandatoryWithSeparator") {
    return PROD_TYPE.REPETITION_MANDATORY_WITH_SEPARATOR;
  } else if (prod instanceof RepetitionWithSeparator || prod === "RepetitionWithSeparator") {
    return PROD_TYPE.REPETITION_WITH_SEPARATOR;
  } else if (prod instanceof Alternation || prod === "Alternation") {
    return PROD_TYPE.ALTERNATION;
  } else {
    throw Error("non exhaustive match");
  }
}
function buildLookaheadFuncForOr(occurrence, ruleGrammar, maxLookahead, hasPredicates, dynamicTokensEnabled, laFuncBuilder) {
  const lookAheadPaths = getLookaheadPathsForOr(occurrence, ruleGrammar, maxLookahead);
  const tokenMatcher2 = areTokenCategoriesNotUsed(lookAheadPaths) ? tokenStructuredMatcherNoCategories : tokenStructuredMatcher;
  return laFuncBuilder(lookAheadPaths, hasPredicates, tokenMatcher2, dynamicTokensEnabled);
}
function buildLookaheadFuncForOptionalProd(occurrence, ruleGrammar, k, dynamicTokensEnabled, prodType, lookaheadBuilder) {
  const lookAheadPaths = getLookaheadPathsForOptionalProd(occurrence, ruleGrammar, prodType, k);
  const tokenMatcher2 = areTokenCategoriesNotUsed(lookAheadPaths) ? tokenStructuredMatcherNoCategories : tokenStructuredMatcher;
  return lookaheadBuilder(lookAheadPaths[0], tokenMatcher2, dynamicTokensEnabled);
}
function buildAlternativesLookAheadFunc(alts, hasPredicates, tokenMatcher2, dynamicTokensEnabled) {
  const numOfAlts = alts.length;
  const areAllOneTokenLookahead = every_default(alts, (currAlt) => {
    return every_default(currAlt, (currPath) => {
      return currPath.length === 1;
    });
  });
  if (hasPredicates) {
    return function(orAlts) {
      const predicates = map_default(orAlts, (currAlt) => currAlt.GATE);
      for (let t = 0;t < numOfAlts; t++) {
        const currAlt = alts[t];
        const currNumOfPaths = currAlt.length;
        const currPredicate = predicates[t];
        if (currPredicate !== undefined && currPredicate.call(this) === false) {
          continue;
        }
        nextPath:
          for (let j = 0;j < currNumOfPaths; j++) {
            const currPath = currAlt[j];
            const currPathLength = currPath.length;
            for (let i = 0;i < currPathLength; i++) {
              const nextToken = this.LA(i + 1);
              if (tokenMatcher2(nextToken, currPath[i]) === false) {
                continue nextPath;
              }
            }
            return t;
          }
      }
      return;
    };
  } else if (areAllOneTokenLookahead && !dynamicTokensEnabled) {
    const singleTokenAlts = map_default(alts, (currAlt) => {
      return flatten_default(currAlt);
    });
    const choiceToAlt = reduce_default(singleTokenAlts, (result, currAlt, idx) => {
      forEach_default(currAlt, (currTokType) => {
        if (!has_default(result, currTokType.tokenTypeIdx)) {
          result[currTokType.tokenTypeIdx] = idx;
        }
        forEach_default(currTokType.categoryMatches, (currExtendingType) => {
          if (!has_default(result, currExtendingType)) {
            result[currExtendingType] = idx;
          }
        });
      });
      return result;
    }, {});
    return function() {
      const nextToken = this.LA(1);
      return choiceToAlt[nextToken.tokenTypeIdx];
    };
  } else {
    return function() {
      for (let t = 0;t < numOfAlts; t++) {
        const currAlt = alts[t];
        const currNumOfPaths = currAlt.length;
        nextPath:
          for (let j = 0;j < currNumOfPaths; j++) {
            const currPath = currAlt[j];
            const currPathLength = currPath.length;
            for (let i = 0;i < currPathLength; i++) {
              const nextToken = this.LA(i + 1);
              if (tokenMatcher2(nextToken, currPath[i]) === false) {
                continue nextPath;
              }
            }
            return t;
          }
      }
      return;
    };
  }
}
function buildSingleAlternativeLookaheadFunction(alt, tokenMatcher2, dynamicTokensEnabled) {
  const areAllOneTokenLookahead = every_default(alt, (currPath) => {
    return currPath.length === 1;
  });
  const numOfPaths = alt.length;
  if (areAllOneTokenLookahead && !dynamicTokensEnabled) {
    const singleTokensTypes = flatten_default(alt);
    if (singleTokensTypes.length === 1 && isEmpty_default(singleTokensTypes[0].categoryMatches)) {
      const expectedTokenType = singleTokensTypes[0];
      const expectedTokenUniqueKey = expectedTokenType.tokenTypeIdx;
      return function() {
        return this.LA(1).tokenTypeIdx === expectedTokenUniqueKey;
      };
    } else {
      const choiceToAlt = reduce_default(singleTokensTypes, (result, currTokType, idx) => {
        result[currTokType.tokenTypeIdx] = true;
        forEach_default(currTokType.categoryMatches, (currExtendingType) => {
          result[currExtendingType] = true;
        });
        return result;
      }, []);
      return function() {
        const nextToken = this.LA(1);
        return choiceToAlt[nextToken.tokenTypeIdx] === true;
      };
    }
  } else {
    return function() {
      nextPath:
        for (let j = 0;j < numOfPaths; j++) {
          const currPath = alt[j];
          const currPathLength = currPath.length;
          for (let i = 0;i < currPathLength; i++) {
            const nextToken = this.LA(i + 1);
            if (tokenMatcher2(nextToken, currPath[i]) === false) {
              continue nextPath;
            }
          }
          return true;
        }
      return false;
    };
  }
}

class RestDefinitionFinderWalker extends RestWalker {
  constructor(topProd, targetOccurrence, targetProdType) {
    super();
    this.topProd = topProd;
    this.targetOccurrence = targetOccurrence;
    this.targetProdType = targetProdType;
  }
  startWalking() {
    this.walk(this.topProd);
    return this.restDef;
  }
  checkIsTarget(node, expectedProdType, currRest, prevRest) {
    if (node.idx === this.targetOccurrence && this.targetProdType === expectedProdType) {
      this.restDef = currRest.concat(prevRest);
      return true;
    }
    return false;
  }
  walkOption(optionProd, currRest, prevRest) {
    if (!this.checkIsTarget(optionProd, PROD_TYPE.OPTION, currRest, prevRest)) {
      super.walkOption(optionProd, currRest, prevRest);
    }
  }
  walkAtLeastOne(atLeastOneProd, currRest, prevRest) {
    if (!this.checkIsTarget(atLeastOneProd, PROD_TYPE.REPETITION_MANDATORY, currRest, prevRest)) {
      super.walkOption(atLeastOneProd, currRest, prevRest);
    }
  }
  walkAtLeastOneSep(atLeastOneSepProd, currRest, prevRest) {
    if (!this.checkIsTarget(atLeastOneSepProd, PROD_TYPE.REPETITION_MANDATORY_WITH_SEPARATOR, currRest, prevRest)) {
      super.walkOption(atLeastOneSepProd, currRest, prevRest);
    }
  }
  walkMany(manyProd, currRest, prevRest) {
    if (!this.checkIsTarget(manyProd, PROD_TYPE.REPETITION, currRest, prevRest)) {
      super.walkOption(manyProd, currRest, prevRest);
    }
  }
  walkManySep(manySepProd, currRest, prevRest) {
    if (!this.checkIsTarget(manySepProd, PROD_TYPE.REPETITION_WITH_SEPARATOR, currRest, prevRest)) {
      super.walkOption(manySepProd, currRest, prevRest);
    }
  }
}

class InsideDefinitionFinderVisitor extends GAstVisitor {
  constructor(targetOccurrence, targetProdType, targetRef) {
    super();
    this.targetOccurrence = targetOccurrence;
    this.targetProdType = targetProdType;
    this.targetRef = targetRef;
    this.result = [];
  }
  checkIsTarget(node, expectedProdName) {
    if (node.idx === this.targetOccurrence && this.targetProdType === expectedProdName && (this.targetRef === undefined || node === this.targetRef)) {
      this.result = node.definition;
    }
  }
  visitOption(node) {
    this.checkIsTarget(node, PROD_TYPE.OPTION);
  }
  visitRepetition(node) {
    this.checkIsTarget(node, PROD_TYPE.REPETITION);
  }
  visitRepetitionMandatory(node) {
    this.checkIsTarget(node, PROD_TYPE.REPETITION_MANDATORY);
  }
  visitRepetitionMandatoryWithSeparator(node) {
    this.checkIsTarget(node, PROD_TYPE.REPETITION_MANDATORY_WITH_SEPARATOR);
  }
  visitRepetitionWithSeparator(node) {
    this.checkIsTarget(node, PROD_TYPE.REPETITION_WITH_SEPARATOR);
  }
  visitAlternation(node) {
    this.checkIsTarget(node, PROD_TYPE.ALTERNATION);
  }
}
function initializeArrayOfArrays(size) {
  const result = new Array(size);
  for (let i = 0;i < size; i++) {
    result[i] = [];
  }
  return result;
}
function pathToHashKeys(path) {
  let keys2 = [""];
  for (let i = 0;i < path.length; i++) {
    const tokType = path[i];
    const longerKeys = [];
    for (let j = 0;j < keys2.length; j++) {
      const currShorterKey = keys2[j];
      longerKeys.push(currShorterKey + "_" + tokType.tokenTypeIdx);
      for (let t = 0;t < tokType.categoryMatches.length; t++) {
        const categoriesKeySuffix = "_" + tokType.categoryMatches[t];
        longerKeys.push(currShorterKey + categoriesKeySuffix);
      }
    }
    keys2 = longerKeys;
  }
  return keys2;
}
function isUniquePrefixHash(altKnownPathsKeys, searchPathKeys, idx) {
  for (let currAltIdx = 0;currAltIdx < altKnownPathsKeys.length; currAltIdx++) {
    if (currAltIdx === idx) {
      continue;
    }
    const otherAltKnownPathsKeys = altKnownPathsKeys[currAltIdx];
    for (let searchIdx = 0;searchIdx < searchPathKeys.length; searchIdx++) {
      const searchKey = searchPathKeys[searchIdx];
      if (otherAltKnownPathsKeys[searchKey] === true) {
        return false;
      }
    }
  }
  return true;
}
function lookAheadSequenceFromAlternatives(altsDefs, k) {
  const partialAlts = map_default(altsDefs, (currAlt) => possiblePathsFrom([currAlt], 1));
  const finalResult = initializeArrayOfArrays(partialAlts.length);
  const altsHashes = map_default(partialAlts, (currAltPaths) => {
    const dict = {};
    forEach_default(currAltPaths, (item) => {
      const keys2 = pathToHashKeys(item.partialPath);
      forEach_default(keys2, (currKey) => {
        dict[currKey] = true;
      });
    });
    return dict;
  });
  let newData = partialAlts;
  for (let pathLength = 1;pathLength <= k; pathLength++) {
    const currDataset = newData;
    newData = initializeArrayOfArrays(currDataset.length);
    for (let altIdx = 0;altIdx < currDataset.length; altIdx++) {
      const currAltPathsAndSuffixes = currDataset[altIdx];
      for (let currPathIdx = 0;currPathIdx < currAltPathsAndSuffixes.length; currPathIdx++) {
        const currPathPrefix = currAltPathsAndSuffixes[currPathIdx].partialPath;
        const suffixDef = currAltPathsAndSuffixes[currPathIdx].suffixDef;
        const prefixKeys = pathToHashKeys(currPathPrefix);
        const isUnique = isUniquePrefixHash(altsHashes, prefixKeys, altIdx);
        if (isUnique || isEmpty_default(suffixDef) || currPathPrefix.length === k) {
          const currAltResult = finalResult[altIdx];
          if (containsPath(currAltResult, currPathPrefix) === false) {
            currAltResult.push(currPathPrefix);
            for (let j = 0;j < prefixKeys.length; j++) {
              const currKey = prefixKeys[j];
              altsHashes[altIdx][currKey] = true;
            }
          }
        } else {
          const newPartialPathsAndSuffixes = possiblePathsFrom(suffixDef, pathLength + 1, currPathPrefix);
          newData[altIdx] = newData[altIdx].concat(newPartialPathsAndSuffixes);
          forEach_default(newPartialPathsAndSuffixes, (item) => {
            const prefixKeys2 = pathToHashKeys(item.partialPath);
            forEach_default(prefixKeys2, (key) => {
              altsHashes[altIdx][key] = true;
            });
          });
        }
      }
    }
  }
  return finalResult;
}
function getLookaheadPathsForOr(occurrence, ruleGrammar, k, orProd) {
  const visitor = new InsideDefinitionFinderVisitor(occurrence, PROD_TYPE.ALTERNATION, orProd);
  ruleGrammar.accept(visitor);
  return lookAheadSequenceFromAlternatives(visitor.result, k);
}
function getLookaheadPathsForOptionalProd(occurrence, ruleGrammar, prodType, k) {
  const insideDefVisitor = new InsideDefinitionFinderVisitor(occurrence, prodType);
  ruleGrammar.accept(insideDefVisitor);
  const insideDef = insideDefVisitor.result;
  const afterDefWalker = new RestDefinitionFinderWalker(ruleGrammar, occurrence, prodType);
  const afterDef = afterDefWalker.startWalking();
  const insideFlat = new Alternative({ definition: insideDef });
  const afterFlat = new Alternative({ definition: afterDef });
  return lookAheadSequenceFromAlternatives([insideFlat, afterFlat], k);
}
function containsPath(alternative, searchPath) {
  compareOtherPath:
    for (let i = 0;i < alternative.length; i++) {
      const otherPath = alternative[i];
      if (otherPath.length !== searchPath.length) {
        continue;
      }
      for (let j = 0;j < otherPath.length; j++) {
        const searchTok = searchPath[j];
        const otherTok = otherPath[j];
        const matchingTokens = searchTok === otherTok || otherTok.categoryMatchesMap[searchTok.tokenTypeIdx] !== undefined;
        if (matchingTokens === false) {
          continue compareOtherPath;
        }
      }
      return true;
    }
  return false;
}
function isStrictPrefixOfPath(prefix, other) {
  return prefix.length < other.length && every_default(prefix, (tokType, idx) => {
    const otherTokType = other[idx];
    return tokType === otherTokType || otherTokType.categoryMatchesMap[tokType.tokenTypeIdx];
  });
}
function areTokenCategoriesNotUsed(lookAheadPaths) {
  return every_default(lookAheadPaths, (singleAltPaths) => every_default(singleAltPaths, (singlePath) => every_default(singlePath, (token) => isEmpty_default(token.categoryMatches))));
}

// ../../node_modules/chevrotain/lib/src/parse/grammar/checks.js
function validateLookahead(options) {
  const lookaheadValidationErrorMessages = options.lookaheadStrategy.validate({
    rules: options.rules,
    tokenTypes: options.tokenTypes,
    grammarName: options.grammarName
  });
  return map_default(lookaheadValidationErrorMessages, (errorMessage) => Object.assign({ type: ParserDefinitionErrorType.CUSTOM_LOOKAHEAD_VALIDATION }, errorMessage));
}
function validateGrammar(topLevels, tokenTypes, errMsgProvider, grammarName) {
  const duplicateErrors = flatMap_default(topLevels, (currTopLevel) => validateDuplicateProductions(currTopLevel, errMsgProvider));
  const termsNamespaceConflictErrors = checkTerminalAndNoneTerminalsNameSpace(topLevels, tokenTypes, errMsgProvider);
  const tooManyAltsErrors = flatMap_default(topLevels, (curRule) => validateTooManyAlts(curRule, errMsgProvider));
  const duplicateRulesError = flatMap_default(topLevels, (curRule) => validateRuleDoesNotAlreadyExist(curRule, topLevels, grammarName, errMsgProvider));
  return duplicateErrors.concat(termsNamespaceConflictErrors, tooManyAltsErrors, duplicateRulesError);
}
function validateDuplicateProductions(topLevelRule, errMsgProvider) {
  const collectorVisitor = new OccurrenceValidationCollector;
  topLevelRule.accept(collectorVisitor);
  const allRuleProductions = collectorVisitor.allProductions;
  const productionGroups = groupBy_default(allRuleProductions, identifyProductionForDuplicates);
  const duplicates = pickBy_default(productionGroups, (currGroup) => {
    return currGroup.length > 1;
  });
  const errors = map_default(values_default(duplicates), (currDuplicates) => {
    const firstProd = head_default(currDuplicates);
    const msg = errMsgProvider.buildDuplicateFoundError(topLevelRule, currDuplicates);
    const dslName = getProductionDslName(firstProd);
    const defError = {
      message: msg,
      type: ParserDefinitionErrorType.DUPLICATE_PRODUCTIONS,
      ruleName: topLevelRule.name,
      dslName,
      occurrence: firstProd.idx
    };
    const param = getExtraProductionArgument(firstProd);
    if (param) {
      defError.parameter = param;
    }
    return defError;
  });
  return errors;
}
function identifyProductionForDuplicates(prod) {
  return `${getProductionDslName(prod)}_#_${prod.idx}_#_${getExtraProductionArgument(prod)}`;
}
function getExtraProductionArgument(prod) {
  if (prod instanceof Terminal) {
    return prod.terminalType.name;
  } else if (prod instanceof NonTerminal) {
    return prod.nonTerminalName;
  } else {
    return "";
  }
}

class OccurrenceValidationCollector extends GAstVisitor {
  constructor() {
    super(...arguments);
    this.allProductions = [];
  }
  visitNonTerminal(subrule) {
    this.allProductions.push(subrule);
  }
  visitOption(option) {
    this.allProductions.push(option);
  }
  visitRepetitionWithSeparator(manySep) {
    this.allProductions.push(manySep);
  }
  visitRepetitionMandatory(atLeastOne) {
    this.allProductions.push(atLeastOne);
  }
  visitRepetitionMandatoryWithSeparator(atLeastOneSep) {
    this.allProductions.push(atLeastOneSep);
  }
  visitRepetition(many) {
    this.allProductions.push(many);
  }
  visitAlternation(or) {
    this.allProductions.push(or);
  }
  visitTerminal(terminal) {
    this.allProductions.push(terminal);
  }
}
function validateRuleDoesNotAlreadyExist(rule, allRules, className, errMsgProvider) {
  const errors = [];
  const occurrences = reduce_default(allRules, (result, curRule) => {
    if (curRule.name === rule.name) {
      return result + 1;
    }
    return result;
  }, 0);
  if (occurrences > 1) {
    const errMsg = errMsgProvider.buildDuplicateRuleNameError({
      topLevelRule: rule,
      grammarName: className
    });
    errors.push({
      message: errMsg,
      type: ParserDefinitionErrorType.DUPLICATE_RULE_NAME,
      ruleName: rule.name
    });
  }
  return errors;
}
function validateRuleIsOverridden(ruleName, definedRulesNames, className) {
  const errors = [];
  let errMsg;
  if (!includes_default(definedRulesNames, ruleName)) {
    errMsg = `Invalid rule override, rule: ->${ruleName}<- cannot be overridden in the grammar: ->${className}<-` + `as it is not defined in any of the super grammars `;
    errors.push({
      message: errMsg,
      type: ParserDefinitionErrorType.INVALID_RULE_OVERRIDE,
      ruleName
    });
  }
  return errors;
}
function validateNoLeftRecursion(topRule, currRule, errMsgProvider, path = []) {
  const errors = [];
  const nextNonTerminals = getFirstNoneTerminal(currRule.definition);
  if (isEmpty_default(nextNonTerminals)) {
    return [];
  } else {
    const ruleName = topRule.name;
    const foundLeftRecursion = includes_default(nextNonTerminals, topRule);
    if (foundLeftRecursion) {
      errors.push({
        message: errMsgProvider.buildLeftRecursionError({
          topLevelRule: topRule,
          leftRecursionPath: path
        }),
        type: ParserDefinitionErrorType.LEFT_RECURSION,
        ruleName
      });
    }
    const validNextSteps = difference_default(nextNonTerminals, path.concat([topRule]));
    const errorsFromNextSteps = flatMap_default(validNextSteps, (currRefRule) => {
      const newPath = clone_default(path);
      newPath.push(currRefRule);
      return validateNoLeftRecursion(topRule, currRefRule, errMsgProvider, newPath);
    });
    return errors.concat(errorsFromNextSteps);
  }
}
function getFirstNoneTerminal(definition) {
  let result = [];
  if (isEmpty_default(definition)) {
    return result;
  }
  const firstProd = head_default(definition);
  if (firstProd instanceof NonTerminal) {
    result.push(firstProd.referencedRule);
  } else if (firstProd instanceof Alternative || firstProd instanceof Option || firstProd instanceof RepetitionMandatory || firstProd instanceof RepetitionMandatoryWithSeparator || firstProd instanceof RepetitionWithSeparator || firstProd instanceof Repetition) {
    result = result.concat(getFirstNoneTerminal(firstProd.definition));
  } else if (firstProd instanceof Alternation) {
    result = flatten_default(map_default(firstProd.definition, (currSubDef) => getFirstNoneTerminal(currSubDef.definition)));
  } else if (firstProd instanceof Terminal) {} else {
    throw Error("non exhaustive match");
  }
  const isFirstOptional = isOptionalProd(firstProd);
  const hasMore = definition.length > 1;
  if (isFirstOptional && hasMore) {
    const rest = drop_default(definition);
    return result.concat(getFirstNoneTerminal(rest));
  } else {
    return result;
  }
}

class OrCollector extends GAstVisitor {
  constructor() {
    super(...arguments);
    this.alternations = [];
  }
  visitAlternation(node) {
    this.alternations.push(node);
  }
}
function validateEmptyOrAlternative(topLevelRule, errMsgProvider) {
  const orCollector = new OrCollector;
  topLevelRule.accept(orCollector);
  const ors = orCollector.alternations;
  const errors = flatMap_default(ors, (currOr) => {
    const exceptLast = dropRight_default(currOr.definition);
    return flatMap_default(exceptLast, (currAlternative, currAltIdx) => {
      const possibleFirstInAlt = nextPossibleTokensAfter([currAlternative], [], tokenStructuredMatcher, 1);
      if (isEmpty_default(possibleFirstInAlt)) {
        return [
          {
            message: errMsgProvider.buildEmptyAlternationError({
              topLevelRule,
              alternation: currOr,
              emptyChoiceIdx: currAltIdx
            }),
            type: ParserDefinitionErrorType.NONE_LAST_EMPTY_ALT,
            ruleName: topLevelRule.name,
            occurrence: currOr.idx,
            alternative: currAltIdx + 1
          }
        ];
      } else {
        return [];
      }
    });
  });
  return errors;
}
function validateAmbiguousAlternationAlternatives(topLevelRule, globalMaxLookahead, errMsgProvider) {
  const orCollector = new OrCollector;
  topLevelRule.accept(orCollector);
  let ors = orCollector.alternations;
  ors = reject_default(ors, (currOr) => currOr.ignoreAmbiguities === true);
  const errors = flatMap_default(ors, (currOr) => {
    const currOccurrence = currOr.idx;
    const actualMaxLookahead = currOr.maxLookahead || globalMaxLookahead;
    const alternatives = getLookaheadPathsForOr(currOccurrence, topLevelRule, actualMaxLookahead, currOr);
    const altsAmbiguityErrors = checkAlternativesAmbiguities(alternatives, currOr, topLevelRule, errMsgProvider);
    const altsPrefixAmbiguityErrors = checkPrefixAlternativesAmbiguities(alternatives, currOr, topLevelRule, errMsgProvider);
    return altsAmbiguityErrors.concat(altsPrefixAmbiguityErrors);
  });
  return errors;
}

class RepetitionCollector extends GAstVisitor {
  constructor() {
    super(...arguments);
    this.allProductions = [];
  }
  visitRepetitionWithSeparator(manySep) {
    this.allProductions.push(manySep);
  }
  visitRepetitionMandatory(atLeastOne) {
    this.allProductions.push(atLeastOne);
  }
  visitRepetitionMandatoryWithSeparator(atLeastOneSep) {
    this.allProductions.push(atLeastOneSep);
  }
  visitRepetition(many) {
    this.allProductions.push(many);
  }
}
function validateTooManyAlts(topLevelRule, errMsgProvider) {
  const orCollector = new OrCollector;
  topLevelRule.accept(orCollector);
  const ors = orCollector.alternations;
  const errors = flatMap_default(ors, (currOr) => {
    if (currOr.definition.length > 255) {
      return [
        {
          message: errMsgProvider.buildTooManyAlternativesError({
            topLevelRule,
            alternation: currOr
          }),
          type: ParserDefinitionErrorType.TOO_MANY_ALTS,
          ruleName: topLevelRule.name,
          occurrence: currOr.idx
        }
      ];
    } else {
      return [];
    }
  });
  return errors;
}
function validateSomeNonEmptyLookaheadPath(topLevelRules, maxLookahead, errMsgProvider) {
  const errors = [];
  forEach_default(topLevelRules, (currTopRule) => {
    const collectorVisitor = new RepetitionCollector;
    currTopRule.accept(collectorVisitor);
    const allRuleProductions = collectorVisitor.allProductions;
    forEach_default(allRuleProductions, (currProd) => {
      const prodType = getProdType(currProd);
      const actualMaxLookahead = currProd.maxLookahead || maxLookahead;
      const currOccurrence = currProd.idx;
      const paths = getLookaheadPathsForOptionalProd(currOccurrence, currTopRule, prodType, actualMaxLookahead);
      const pathsInsideProduction = paths[0];
      if (isEmpty_default(flatten_default(pathsInsideProduction))) {
        const errMsg = errMsgProvider.buildEmptyRepetitionError({
          topLevelRule: currTopRule,
          repetition: currProd
        });
        errors.push({
          message: errMsg,
          type: ParserDefinitionErrorType.NO_NON_EMPTY_LOOKAHEAD,
          ruleName: currTopRule.name
        });
      }
    });
  });
  return errors;
}
function checkAlternativesAmbiguities(alternatives, alternation, rule, errMsgProvider) {
  const foundAmbiguousPaths = [];
  const identicalAmbiguities = reduce_default(alternatives, (result, currAlt, currAltIdx) => {
    if (alternation.definition[currAltIdx].ignoreAmbiguities === true) {
      return result;
    }
    forEach_default(currAlt, (currPath) => {
      const altsCurrPathAppearsIn = [currAltIdx];
      forEach_default(alternatives, (currOtherAlt, currOtherAltIdx) => {
        if (currAltIdx !== currOtherAltIdx && containsPath(currOtherAlt, currPath) && alternation.definition[currOtherAltIdx].ignoreAmbiguities !== true) {
          altsCurrPathAppearsIn.push(currOtherAltIdx);
        }
      });
      if (altsCurrPathAppearsIn.length > 1 && !containsPath(foundAmbiguousPaths, currPath)) {
        foundAmbiguousPaths.push(currPath);
        result.push({
          alts: altsCurrPathAppearsIn,
          path: currPath
        });
      }
    });
    return result;
  }, []);
  const currErrors = map_default(identicalAmbiguities, (currAmbDescriptor) => {
    const ambgIndices = map_default(currAmbDescriptor.alts, (currAltIdx) => currAltIdx + 1);
    const currMessage = errMsgProvider.buildAlternationAmbiguityError({
      topLevelRule: rule,
      alternation,
      ambiguityIndices: ambgIndices,
      prefixPath: currAmbDescriptor.path
    });
    return {
      message: currMessage,
      type: ParserDefinitionErrorType.AMBIGUOUS_ALTS,
      ruleName: rule.name,
      occurrence: alternation.idx,
      alternatives: currAmbDescriptor.alts
    };
  });
  return currErrors;
}
function checkPrefixAlternativesAmbiguities(alternatives, alternation, rule, errMsgProvider) {
  const pathsAndIndices = reduce_default(alternatives, (result, currAlt, idx) => {
    const currPathsAndIdx = map_default(currAlt, (currPath) => {
      return { idx, path: currPath };
    });
    return result.concat(currPathsAndIdx);
  }, []);
  const errors = compact_default(flatMap_default(pathsAndIndices, (currPathAndIdx) => {
    const alternativeGast = alternation.definition[currPathAndIdx.idx];
    if (alternativeGast.ignoreAmbiguities === true) {
      return [];
    }
    const targetIdx = currPathAndIdx.idx;
    const targetPath = currPathAndIdx.path;
    const prefixAmbiguitiesPathsAndIndices = filter_default(pathsAndIndices, (searchPathAndIdx) => {
      return alternation.definition[searchPathAndIdx.idx].ignoreAmbiguities !== true && searchPathAndIdx.idx < targetIdx && isStrictPrefixOfPath(searchPathAndIdx.path, targetPath);
    });
    const currPathPrefixErrors = map_default(prefixAmbiguitiesPathsAndIndices, (currAmbPathAndIdx) => {
      const ambgIndices = [currAmbPathAndIdx.idx + 1, targetIdx + 1];
      const occurrence = alternation.idx === 0 ? "" : alternation.idx;
      const message = errMsgProvider.buildAlternationPrefixAmbiguityError({
        topLevelRule: rule,
        alternation,
        ambiguityIndices: ambgIndices,
        prefixPath: currAmbPathAndIdx.path
      });
      return {
        message,
        type: ParserDefinitionErrorType.AMBIGUOUS_PREFIX_ALTS,
        ruleName: rule.name,
        occurrence,
        alternatives: ambgIndices
      };
    });
    return currPathPrefixErrors;
  }));
  return errors;
}
function checkTerminalAndNoneTerminalsNameSpace(topLevels, tokenTypes, errMsgProvider) {
  const errors = [];
  const tokenNames = map_default(tokenTypes, (currToken) => currToken.name);
  forEach_default(topLevels, (currRule) => {
    const currRuleName = currRule.name;
    if (includes_default(tokenNames, currRuleName)) {
      const errMsg = errMsgProvider.buildNamespaceConflictError(currRule);
      errors.push({
        message: errMsg,
        type: ParserDefinitionErrorType.CONFLICT_TOKENS_RULES_NAMESPACE,
        ruleName: currRuleName
      });
    }
  });
  return errors;
}

// ../../node_modules/chevrotain/lib/src/parse/grammar/gast/gast_resolver_public.js
function resolveGrammar2(options) {
  const actualOptions = defaults_default(options, {
    errMsgProvider: defaultGrammarResolverErrorProvider
  });
  const topRulesTable = {};
  forEach_default(options.rules, (rule) => {
    topRulesTable[rule.name] = rule;
  });
  return resolveGrammar(topRulesTable, actualOptions.errMsgProvider);
}
function validateGrammar2(options) {
  options = defaults_default(options, {
    errMsgProvider: defaultGrammarValidatorErrorProvider
  });
  return validateGrammar(options.rules, options.tokenTypes, options.errMsgProvider, options.grammarName);
}

// ../../node_modules/chevrotain/lib/src/parse/exceptions_public.js
var MISMATCHED_TOKEN_EXCEPTION = "MismatchedTokenException";
var NO_VIABLE_ALT_EXCEPTION = "NoViableAltException";
var EARLY_EXIT_EXCEPTION = "EarlyExitException";
var NOT_ALL_INPUT_PARSED_EXCEPTION = "NotAllInputParsedException";
var RECOGNITION_EXCEPTION_NAMES = [
  MISMATCHED_TOKEN_EXCEPTION,
  NO_VIABLE_ALT_EXCEPTION,
  EARLY_EXIT_EXCEPTION,
  NOT_ALL_INPUT_PARSED_EXCEPTION
];
Object.freeze(RECOGNITION_EXCEPTION_NAMES);
function isRecognitionException(error) {
  return includes_default(RECOGNITION_EXCEPTION_NAMES, error.name);
}

class RecognitionException extends Error {
  constructor(message, token) {
    super(message);
    this.token = token;
    this.resyncedTokens = [];
    Object.setPrototypeOf(this, new.target.prototype);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

class MismatchedTokenException extends RecognitionException {
  constructor(message, token, previousToken) {
    super(message, token);
    this.previousToken = previousToken;
    this.name = MISMATCHED_TOKEN_EXCEPTION;
  }
}

class NoViableAltException extends RecognitionException {
  constructor(message, token, previousToken) {
    super(message, token);
    this.previousToken = previousToken;
    this.name = NO_VIABLE_ALT_EXCEPTION;
  }
}

class NotAllInputParsedException extends RecognitionException {
  constructor(message, token) {
    super(message, token);
    this.name = NOT_ALL_INPUT_PARSED_EXCEPTION;
  }
}

class EarlyExitException extends RecognitionException {
  constructor(message, token, previousToken) {
    super(message, token);
    this.previousToken = previousToken;
    this.name = EARLY_EXIT_EXCEPTION;
  }
}

// ../../node_modules/chevrotain/lib/src/parse/parser/traits/recoverable.js
var EOF_FOLLOW_KEY = {};
var IN_RULE_RECOVERY_EXCEPTION = "InRuleRecoveryException";

class InRuleRecoveryException extends Error {
  constructor(message) {
    super(message);
    this.name = IN_RULE_RECOVERY_EXCEPTION;
  }
}

class Recoverable {
  initRecoverable(config) {
    this.firstAfterRepMap = {};
    this.resyncFollows = {};
    this.recoveryEnabled = has_default(config, "recoveryEnabled") ? config.recoveryEnabled : DEFAULT_PARSER_CONFIG.recoveryEnabled;
    if (this.recoveryEnabled) {
      this.attemptInRepetitionRecovery = attemptInRepetitionRecovery;
    }
  }
  getTokenToInsert(tokType) {
    const tokToInsert = createTokenInstance(tokType, "", NaN, NaN, NaN, NaN, NaN, NaN);
    tokToInsert.isInsertedInRecovery = true;
    return tokToInsert;
  }
  canTokenTypeBeInsertedInRecovery(tokType) {
    return true;
  }
  canTokenTypeBeDeletedInRecovery(tokType) {
    return true;
  }
  tryInRepetitionRecovery(grammarRule, grammarRuleArgs, lookAheadFunc, expectedTokType) {
    const reSyncTokType = this.findReSyncTokenType();
    const savedLexerState = this.exportLexerState();
    const resyncedTokens = [];
    let passedResyncPoint = false;
    const nextTokenWithoutResync = this.LA(1);
    let currToken = this.LA(1);
    const generateErrorMessage = () => {
      const previousToken = this.LA(0);
      const msg = this.errorMessageProvider.buildMismatchTokenMessage({
        expected: expectedTokType,
        actual: nextTokenWithoutResync,
        previous: previousToken,
        ruleName: this.getCurrRuleFullName()
      });
      const error = new MismatchedTokenException(msg, nextTokenWithoutResync, this.LA(0));
      error.resyncedTokens = dropRight_default(resyncedTokens);
      this.SAVE_ERROR(error);
    };
    while (!passedResyncPoint) {
      if (this.tokenMatcher(currToken, expectedTokType)) {
        generateErrorMessage();
        return;
      } else if (lookAheadFunc.call(this)) {
        generateErrorMessage();
        grammarRule.apply(this, grammarRuleArgs);
        return;
      } else if (this.tokenMatcher(currToken, reSyncTokType)) {
        passedResyncPoint = true;
      } else {
        currToken = this.SKIP_TOKEN();
        this.addToResyncTokens(currToken, resyncedTokens);
      }
    }
    this.importLexerState(savedLexerState);
  }
  shouldInRepetitionRecoveryBeTried(expectTokAfterLastMatch, nextTokIdx, notStuck) {
    if (notStuck === false) {
      return false;
    }
    if (this.tokenMatcher(this.LA(1), expectTokAfterLastMatch)) {
      return false;
    }
    if (this.isBackTracking()) {
      return false;
    }
    if (this.canPerformInRuleRecovery(expectTokAfterLastMatch, this.getFollowsForInRuleRecovery(expectTokAfterLastMatch, nextTokIdx))) {
      return false;
    }
    return true;
  }
  getFollowsForInRuleRecovery(tokType, tokIdxInRule) {
    const grammarPath = this.getCurrentGrammarPath(tokType, tokIdxInRule);
    const follows = this.getNextPossibleTokenTypes(grammarPath);
    return follows;
  }
  tryInRuleRecovery(expectedTokType, follows) {
    if (this.canRecoverWithSingleTokenInsertion(expectedTokType, follows)) {
      const tokToInsert = this.getTokenToInsert(expectedTokType);
      return tokToInsert;
    }
    if (this.canRecoverWithSingleTokenDeletion(expectedTokType)) {
      const nextTok = this.SKIP_TOKEN();
      this.consumeToken();
      return nextTok;
    }
    throw new InRuleRecoveryException("sad sad panda");
  }
  canPerformInRuleRecovery(expectedToken, follows) {
    return this.canRecoverWithSingleTokenInsertion(expectedToken, follows) || this.canRecoverWithSingleTokenDeletion(expectedToken);
  }
  canRecoverWithSingleTokenInsertion(expectedTokType, follows) {
    if (!this.canTokenTypeBeInsertedInRecovery(expectedTokType)) {
      return false;
    }
    if (isEmpty_default(follows)) {
      return false;
    }
    const mismatchedTok = this.LA(1);
    const isMisMatchedTokInFollows = find_default(follows, (possibleFollowsTokType) => {
      return this.tokenMatcher(mismatchedTok, possibleFollowsTokType);
    }) !== undefined;
    return isMisMatchedTokInFollows;
  }
  canRecoverWithSingleTokenDeletion(expectedTokType) {
    if (!this.canTokenTypeBeDeletedInRecovery(expectedTokType)) {
      return false;
    }
    const isNextTokenWhatIsExpected = this.tokenMatcher(this.LA(2), expectedTokType);
    return isNextTokenWhatIsExpected;
  }
  isInCurrentRuleReSyncSet(tokenTypeIdx) {
    const followKey = this.getCurrFollowKey();
    const currentRuleReSyncSet = this.getFollowSetFromFollowKey(followKey);
    return includes_default(currentRuleReSyncSet, tokenTypeIdx);
  }
  findReSyncTokenType() {
    const allPossibleReSyncTokTypes = this.flattenFollowSet();
    let nextToken = this.LA(1);
    let k = 2;
    while (true) {
      const foundMatch = find_default(allPossibleReSyncTokTypes, (resyncTokType) => {
        const canMatch = tokenMatcher(nextToken, resyncTokType);
        return canMatch;
      });
      if (foundMatch !== undefined) {
        return foundMatch;
      }
      nextToken = this.LA(k);
      k++;
    }
  }
  getCurrFollowKey() {
    if (this.RULE_STACK.length === 1) {
      return EOF_FOLLOW_KEY;
    }
    const currRuleShortName = this.getLastExplicitRuleShortName();
    const currRuleIdx = this.getLastExplicitRuleOccurrenceIndex();
    const prevRuleShortName = this.getPreviousExplicitRuleShortName();
    return {
      ruleName: this.shortRuleNameToFullName(currRuleShortName),
      idxInCallingRule: currRuleIdx,
      inRule: this.shortRuleNameToFullName(prevRuleShortName)
    };
  }
  buildFullFollowKeyStack() {
    const explicitRuleStack = this.RULE_STACK;
    const explicitOccurrenceStack = this.RULE_OCCURRENCE_STACK;
    return map_default(explicitRuleStack, (ruleName, idx) => {
      if (idx === 0) {
        return EOF_FOLLOW_KEY;
      }
      return {
        ruleName: this.shortRuleNameToFullName(ruleName),
        idxInCallingRule: explicitOccurrenceStack[idx],
        inRule: this.shortRuleNameToFullName(explicitRuleStack[idx - 1])
      };
    });
  }
  flattenFollowSet() {
    const followStack = map_default(this.buildFullFollowKeyStack(), (currKey) => {
      return this.getFollowSetFromFollowKey(currKey);
    });
    return flatten_default(followStack);
  }
  getFollowSetFromFollowKey(followKey) {
    if (followKey === EOF_FOLLOW_KEY) {
      return [EOF];
    }
    const followName = followKey.ruleName + followKey.idxInCallingRule + IN + followKey.inRule;
    return this.resyncFollows[followName];
  }
  addToResyncTokens(token, resyncTokens) {
    if (!this.tokenMatcher(token, EOF)) {
      resyncTokens.push(token);
    }
    return resyncTokens;
  }
  reSyncTo(tokType) {
    const resyncedTokens = [];
    let nextTok = this.LA(1);
    while (this.tokenMatcher(nextTok, tokType) === false) {
      nextTok = this.SKIP_TOKEN();
      this.addToResyncTokens(nextTok, resyncedTokens);
    }
    return dropRight_default(resyncedTokens);
  }
  attemptInRepetitionRecovery(prodFunc, args, lookaheadFunc, dslMethodIdx, prodOccurrence, nextToksWalker, notStuck) {}
  getCurrentGrammarPath(tokType, tokIdxInRule) {
    const pathRuleStack = this.getHumanReadableRuleStack();
    const pathOccurrenceStack = clone_default(this.RULE_OCCURRENCE_STACK);
    const grammarPath = {
      ruleStack: pathRuleStack,
      occurrenceStack: pathOccurrenceStack,
      lastTok: tokType,
      lastTokOccurrence: tokIdxInRule
    };
    return grammarPath;
  }
  getHumanReadableRuleStack() {
    return map_default(this.RULE_STACK, (currShortName) => this.shortRuleNameToFullName(currShortName));
  }
}
function attemptInRepetitionRecovery(prodFunc, args, lookaheadFunc, dslMethodIdx, prodOccurrence, nextToksWalker, notStuck) {
  const key = this.getKeyForAutomaticLookahead(dslMethodIdx, prodOccurrence);
  let firstAfterRepInfo = this.firstAfterRepMap[key];
  if (firstAfterRepInfo === undefined) {
    const currRuleName = this.getCurrRuleFullName();
    const ruleGrammar = this.getGAstProductions()[currRuleName];
    const walker = new nextToksWalker(ruleGrammar, prodOccurrence);
    firstAfterRepInfo = walker.startWalking();
    this.firstAfterRepMap[key] = firstAfterRepInfo;
  }
  let expectTokAfterLastMatch = firstAfterRepInfo.token;
  let nextTokIdx = firstAfterRepInfo.occurrence;
  const isEndOfRule = firstAfterRepInfo.isEndOfRule;
  if (this.RULE_STACK.length === 1 && isEndOfRule && expectTokAfterLastMatch === undefined) {
    expectTokAfterLastMatch = EOF;
    nextTokIdx = 1;
  }
  if (expectTokAfterLastMatch === undefined || nextTokIdx === undefined) {
    return;
  }
  if (this.shouldInRepetitionRecoveryBeTried(expectTokAfterLastMatch, nextTokIdx, notStuck)) {
    this.tryInRepetitionRecovery(prodFunc, args, lookaheadFunc, expectTokAfterLastMatch);
  }
}

// ../../node_modules/chevrotain/lib/src/parse/grammar/keys.js
var BITS_FOR_METHOD_TYPE = 4;
var BITS_FOR_OCCURRENCE_IDX = 8;
var BITS_FOR_ALT_IDX = 8;
var OR_IDX = 1 << BITS_FOR_OCCURRENCE_IDX;
var OPTION_IDX = 2 << BITS_FOR_OCCURRENCE_IDX;
var MANY_IDX = 3 << BITS_FOR_OCCURRENCE_IDX;
var AT_LEAST_ONE_IDX = 4 << BITS_FOR_OCCURRENCE_IDX;
var MANY_SEP_IDX = 5 << BITS_FOR_OCCURRENCE_IDX;
var AT_LEAST_ONE_SEP_IDX = 6 << BITS_FOR_OCCURRENCE_IDX;
function getKeyForAutomaticLookahead(ruleIdx, dslMethodIdx, occurrence) {
  return occurrence | dslMethodIdx | ruleIdx;
}
var BITS_START_FOR_ALT_IDX = 32 - BITS_FOR_ALT_IDX;

// ../../node_modules/chevrotain/lib/src/parse/grammar/llk_lookahead.js
class LLkLookaheadStrategy {
  constructor(options) {
    var _a;
    this.maxLookahead = (_a = options === null || options === undefined ? undefined : options.maxLookahead) !== null && _a !== undefined ? _a : DEFAULT_PARSER_CONFIG.maxLookahead;
  }
  validate(options) {
    const leftRecursionErrors = this.validateNoLeftRecursion(options.rules);
    if (isEmpty_default(leftRecursionErrors)) {
      const emptyAltErrors = this.validateEmptyOrAlternatives(options.rules);
      const ambiguousAltsErrors = this.validateAmbiguousAlternationAlternatives(options.rules, this.maxLookahead);
      const emptyRepetitionErrors = this.validateSomeNonEmptyLookaheadPath(options.rules, this.maxLookahead);
      const allErrors = [
        ...leftRecursionErrors,
        ...emptyAltErrors,
        ...ambiguousAltsErrors,
        ...emptyRepetitionErrors
      ];
      return allErrors;
    }
    return leftRecursionErrors;
  }
  validateNoLeftRecursion(rules) {
    return flatMap_default(rules, (currTopRule) => validateNoLeftRecursion(currTopRule, currTopRule, defaultGrammarValidatorErrorProvider));
  }
  validateEmptyOrAlternatives(rules) {
    return flatMap_default(rules, (currTopRule) => validateEmptyOrAlternative(currTopRule, defaultGrammarValidatorErrorProvider));
  }
  validateAmbiguousAlternationAlternatives(rules, maxLookahead) {
    return flatMap_default(rules, (currTopRule) => validateAmbiguousAlternationAlternatives(currTopRule, maxLookahead, defaultGrammarValidatorErrorProvider));
  }
  validateSomeNonEmptyLookaheadPath(rules, maxLookahead) {
    return validateSomeNonEmptyLookaheadPath(rules, maxLookahead, defaultGrammarValidatorErrorProvider);
  }
  buildLookaheadForAlternation(options) {
    return buildLookaheadFuncForOr(options.prodOccurrence, options.rule, options.maxLookahead, options.hasPredicates, options.dynamicTokensEnabled, buildAlternativesLookAheadFunc);
  }
  buildLookaheadForOptional(options) {
    return buildLookaheadFuncForOptionalProd(options.prodOccurrence, options.rule, options.maxLookahead, options.dynamicTokensEnabled, getProdType(options.prodType), buildSingleAlternativeLookaheadFunction);
  }
}

// ../../node_modules/chevrotain/lib/src/parse/parser/traits/looksahead.js
class LooksAhead {
  initLooksAhead(config) {
    this.dynamicTokensEnabled = has_default(config, "dynamicTokensEnabled") ? config.dynamicTokensEnabled : DEFAULT_PARSER_CONFIG.dynamicTokensEnabled;
    this.maxLookahead = has_default(config, "maxLookahead") ? config.maxLookahead : DEFAULT_PARSER_CONFIG.maxLookahead;
    this.lookaheadStrategy = has_default(config, "lookaheadStrategy") ? config.lookaheadStrategy : new LLkLookaheadStrategy({ maxLookahead: this.maxLookahead });
    this.lookAheadFuncsCache = new Map;
  }
  preComputeLookaheadFunctions(rules) {
    forEach_default(rules, (currRule) => {
      this.TRACE_INIT(`${currRule.name} Rule Lookahead`, () => {
        const { alternation, repetition, option, repetitionMandatory, repetitionMandatoryWithSeparator, repetitionWithSeparator } = collectMethods(currRule);
        forEach_default(alternation, (currProd) => {
          const prodIdx = currProd.idx === 0 ? "" : currProd.idx;
          this.TRACE_INIT(`${getProductionDslName(currProd)}${prodIdx}`, () => {
            const laFunc = this.lookaheadStrategy.buildLookaheadForAlternation({
              prodOccurrence: currProd.idx,
              rule: currRule,
              maxLookahead: currProd.maxLookahead || this.maxLookahead,
              hasPredicates: currProd.hasPredicates,
              dynamicTokensEnabled: this.dynamicTokensEnabled
            });
            const key = getKeyForAutomaticLookahead(this.fullRuleNameToShort[currRule.name], OR_IDX, currProd.idx);
            this.setLaFuncCache(key, laFunc);
          });
        });
        forEach_default(repetition, (currProd) => {
          this.computeLookaheadFunc(currRule, currProd.idx, MANY_IDX, "Repetition", currProd.maxLookahead, getProductionDslName(currProd));
        });
        forEach_default(option, (currProd) => {
          this.computeLookaheadFunc(currRule, currProd.idx, OPTION_IDX, "Option", currProd.maxLookahead, getProductionDslName(currProd));
        });
        forEach_default(repetitionMandatory, (currProd) => {
          this.computeLookaheadFunc(currRule, currProd.idx, AT_LEAST_ONE_IDX, "RepetitionMandatory", currProd.maxLookahead, getProductionDslName(currProd));
        });
        forEach_default(repetitionMandatoryWithSeparator, (currProd) => {
          this.computeLookaheadFunc(currRule, currProd.idx, AT_LEAST_ONE_SEP_IDX, "RepetitionMandatoryWithSeparator", currProd.maxLookahead, getProductionDslName(currProd));
        });
        forEach_default(repetitionWithSeparator, (currProd) => {
          this.computeLookaheadFunc(currRule, currProd.idx, MANY_SEP_IDX, "RepetitionWithSeparator", currProd.maxLookahead, getProductionDslName(currProd));
        });
      });
    });
  }
  computeLookaheadFunc(rule, prodOccurrence, prodKey, prodType, prodMaxLookahead, dslMethodName) {
    this.TRACE_INIT(`${dslMethodName}${prodOccurrence === 0 ? "" : prodOccurrence}`, () => {
      const laFunc = this.lookaheadStrategy.buildLookaheadForOptional({
        prodOccurrence,
        rule,
        maxLookahead: prodMaxLookahead || this.maxLookahead,
        dynamicTokensEnabled: this.dynamicTokensEnabled,
        prodType
      });
      const key = getKeyForAutomaticLookahead(this.fullRuleNameToShort[rule.name], prodKey, prodOccurrence);
      this.setLaFuncCache(key, laFunc);
    });
  }
  getKeyForAutomaticLookahead(dslMethodIdx, occurrence) {
    const currRuleShortName = this.getLastExplicitRuleShortName();
    return getKeyForAutomaticLookahead(currRuleShortName, dslMethodIdx, occurrence);
  }
  getLaFuncFromCache(key) {
    return this.lookAheadFuncsCache.get(key);
  }
  setLaFuncCache(key, value) {
    this.lookAheadFuncsCache.set(key, value);
  }
}

class DslMethodsCollectorVisitor extends GAstVisitor {
  constructor() {
    super(...arguments);
    this.dslMethods = {
      option: [],
      alternation: [],
      repetition: [],
      repetitionWithSeparator: [],
      repetitionMandatory: [],
      repetitionMandatoryWithSeparator: []
    };
  }
  reset() {
    this.dslMethods = {
      option: [],
      alternation: [],
      repetition: [],
      repetitionWithSeparator: [],
      repetitionMandatory: [],
      repetitionMandatoryWithSeparator: []
    };
  }
  visitOption(option) {
    this.dslMethods.option.push(option);
  }
  visitRepetitionWithSeparator(manySep) {
    this.dslMethods.repetitionWithSeparator.push(manySep);
  }
  visitRepetitionMandatory(atLeastOne) {
    this.dslMethods.repetitionMandatory.push(atLeastOne);
  }
  visitRepetitionMandatoryWithSeparator(atLeastOneSep) {
    this.dslMethods.repetitionMandatoryWithSeparator.push(atLeastOneSep);
  }
  visitRepetition(many) {
    this.dslMethods.repetition.push(many);
  }
  visitAlternation(or) {
    this.dslMethods.alternation.push(or);
  }
}
var collectorVisitor = new DslMethodsCollectorVisitor;
function collectMethods(rule) {
  collectorVisitor.reset();
  rule.accept(collectorVisitor);
  const dslMethods = collectorVisitor.dslMethods;
  collectorVisitor.reset();
  return dslMethods;
}

// ../../node_modules/chevrotain/lib/src/parse/cst/cst.js
function setNodeLocationOnlyOffset(currNodeLocation, newLocationInfo) {
  if (isNaN(currNodeLocation.startOffset) === true) {
    currNodeLocation.startOffset = newLocationInfo.startOffset;
    currNodeLocation.endOffset = newLocationInfo.endOffset;
  } else if (currNodeLocation.endOffset < newLocationInfo.endOffset === true) {
    currNodeLocation.endOffset = newLocationInfo.endOffset;
  }
}
function setNodeLocationFull(currNodeLocation, newLocationInfo) {
  if (isNaN(currNodeLocation.startOffset) === true) {
    currNodeLocation.startOffset = newLocationInfo.startOffset;
    currNodeLocation.startColumn = newLocationInfo.startColumn;
    currNodeLocation.startLine = newLocationInfo.startLine;
    currNodeLocation.endOffset = newLocationInfo.endOffset;
    currNodeLocation.endColumn = newLocationInfo.endColumn;
    currNodeLocation.endLine = newLocationInfo.endLine;
  } else if (currNodeLocation.endOffset < newLocationInfo.endOffset === true) {
    currNodeLocation.endOffset = newLocationInfo.endOffset;
    currNodeLocation.endColumn = newLocationInfo.endColumn;
    currNodeLocation.endLine = newLocationInfo.endLine;
  }
}
function addTerminalToCst(node, token, tokenTypeName) {
  if (node.children[tokenTypeName] === undefined) {
    node.children[tokenTypeName] = [token];
  } else {
    node.children[tokenTypeName].push(token);
  }
}
function addNoneTerminalToCst(node, ruleName, ruleResult) {
  if (node.children[ruleName] === undefined) {
    node.children[ruleName] = [ruleResult];
  } else {
    node.children[ruleName].push(ruleResult);
  }
}

// ../../node_modules/chevrotain/lib/src/lang/lang_extensions.js
var NAME = "name";
function defineNameProp(obj, nameValue) {
  Object.defineProperty(obj, NAME, {
    enumerable: false,
    configurable: true,
    writable: false,
    value: nameValue
  });
}

// ../../node_modules/chevrotain/lib/src/parse/cst/cst_visitor.js
function defaultVisit(ctx, param) {
  const childrenNames = keys_default(ctx);
  const childrenNamesLength = childrenNames.length;
  for (let i = 0;i < childrenNamesLength; i++) {
    const currChildName = childrenNames[i];
    const currChildArray = ctx[currChildName];
    const currChildArrayLength = currChildArray.length;
    for (let j = 0;j < currChildArrayLength; j++) {
      const currChild = currChildArray[j];
      if (currChild.tokenTypeIdx === undefined) {
        this[currChild.name](currChild.children, param);
      }
    }
  }
}
function createBaseSemanticVisitorConstructor(grammarName, ruleNames) {
  const derivedConstructor = function() {};
  defineNameProp(derivedConstructor, grammarName + "BaseSemantics");
  const semanticProto = {
    visit: function(cstNode, param) {
      if (isArray_default(cstNode)) {
        cstNode = cstNode[0];
      }
      if (isUndefined_default(cstNode)) {
        return;
      }
      return this[cstNode.name](cstNode.children, param);
    },
    validateVisitor: function() {
      const semanticDefinitionErrors = validateVisitor(this, ruleNames);
      if (!isEmpty_default(semanticDefinitionErrors)) {
        const errorMessages = map_default(semanticDefinitionErrors, (currDefError) => currDefError.msg);
        throw Error(`Errors Detected in CST Visitor <${this.constructor.name}>:
	` + `${errorMessages.join(`

`).replace(/\n/g, `
	`)}`);
      }
    }
  };
  derivedConstructor.prototype = semanticProto;
  derivedConstructor.prototype.constructor = derivedConstructor;
  derivedConstructor._RULE_NAMES = ruleNames;
  return derivedConstructor;
}
function createBaseVisitorConstructorWithDefaults(grammarName, ruleNames, baseConstructor) {
  const derivedConstructor = function() {};
  defineNameProp(derivedConstructor, grammarName + "BaseSemanticsWithDefaults");
  const withDefaultsProto = Object.create(baseConstructor.prototype);
  forEach_default(ruleNames, (ruleName) => {
    withDefaultsProto[ruleName] = defaultVisit;
  });
  derivedConstructor.prototype = withDefaultsProto;
  derivedConstructor.prototype.constructor = derivedConstructor;
  return derivedConstructor;
}
var CstVisitorDefinitionError;
(function(CstVisitorDefinitionError2) {
  CstVisitorDefinitionError2[CstVisitorDefinitionError2["REDUNDANT_METHOD"] = 0] = "REDUNDANT_METHOD";
  CstVisitorDefinitionError2[CstVisitorDefinitionError2["MISSING_METHOD"] = 1] = "MISSING_METHOD";
})(CstVisitorDefinitionError || (CstVisitorDefinitionError = {}));
function validateVisitor(visitorInstance, ruleNames) {
  const missingErrors = validateMissingCstMethods(visitorInstance, ruleNames);
  return missingErrors;
}
function validateMissingCstMethods(visitorInstance, ruleNames) {
  const missingRuleNames = filter_default(ruleNames, (currRuleName) => {
    return isFunction_default(visitorInstance[currRuleName]) === false;
  });
  const errors = map_default(missingRuleNames, (currRuleName) => {
    return {
      msg: `Missing visitor method: <${currRuleName}> on ${visitorInstance.constructor.name} CST Visitor.`,
      type: CstVisitorDefinitionError.MISSING_METHOD,
      methodName: currRuleName
    };
  });
  return compact_default(errors);
}

// ../../node_modules/chevrotain/lib/src/parse/parser/traits/tree_builder.js
class TreeBuilder {
  initTreeBuilder(config) {
    this.CST_STACK = [];
    this.outputCst = config.outputCst;
    this.nodeLocationTracking = has_default(config, "nodeLocationTracking") ? config.nodeLocationTracking : DEFAULT_PARSER_CONFIG.nodeLocationTracking;
    if (!this.outputCst) {
      this.cstInvocationStateUpdate = noop_default;
      this.cstFinallyStateUpdate = noop_default;
      this.cstPostTerminal = noop_default;
      this.cstPostNonTerminal = noop_default;
      this.cstPostRule = noop_default;
    } else {
      if (/full/i.test(this.nodeLocationTracking)) {
        if (this.recoveryEnabled) {
          this.setNodeLocationFromToken = setNodeLocationFull;
          this.setNodeLocationFromNode = setNodeLocationFull;
          this.cstPostRule = noop_default;
          this.setInitialNodeLocation = this.setInitialNodeLocationFullRecovery;
        } else {
          this.setNodeLocationFromToken = noop_default;
          this.setNodeLocationFromNode = noop_default;
          this.cstPostRule = this.cstPostRuleFull;
          this.setInitialNodeLocation = this.setInitialNodeLocationFullRegular;
        }
      } else if (/onlyOffset/i.test(this.nodeLocationTracking)) {
        if (this.recoveryEnabled) {
          this.setNodeLocationFromToken = setNodeLocationOnlyOffset;
          this.setNodeLocationFromNode = setNodeLocationOnlyOffset;
          this.cstPostRule = noop_default;
          this.setInitialNodeLocation = this.setInitialNodeLocationOnlyOffsetRecovery;
        } else {
          this.setNodeLocationFromToken = noop_default;
          this.setNodeLocationFromNode = noop_default;
          this.cstPostRule = this.cstPostRuleOnlyOffset;
          this.setInitialNodeLocation = this.setInitialNodeLocationOnlyOffsetRegular;
        }
      } else if (/none/i.test(this.nodeLocationTracking)) {
        this.setNodeLocationFromToken = noop_default;
        this.setNodeLocationFromNode = noop_default;
        this.cstPostRule = noop_default;
        this.setInitialNodeLocation = noop_default;
      } else {
        throw Error(`Invalid <nodeLocationTracking> config option: "${config.nodeLocationTracking}"`);
      }
    }
  }
  setInitialNodeLocationOnlyOffsetRecovery(cstNode) {
    cstNode.location = {
      startOffset: NaN,
      endOffset: NaN
    };
  }
  setInitialNodeLocationOnlyOffsetRegular(cstNode) {
    cstNode.location = {
      startOffset: this.LA(1).startOffset,
      endOffset: NaN
    };
  }
  setInitialNodeLocationFullRecovery(cstNode) {
    cstNode.location = {
      startOffset: NaN,
      startLine: NaN,
      startColumn: NaN,
      endOffset: NaN,
      endLine: NaN,
      endColumn: NaN
    };
  }
  setInitialNodeLocationFullRegular(cstNode) {
    const nextToken = this.LA(1);
    cstNode.location = {
      startOffset: nextToken.startOffset,
      startLine: nextToken.startLine,
      startColumn: nextToken.startColumn,
      endOffset: NaN,
      endLine: NaN,
      endColumn: NaN
    };
  }
  cstInvocationStateUpdate(fullRuleName) {
    const cstNode = {
      name: fullRuleName,
      children: Object.create(null)
    };
    this.setInitialNodeLocation(cstNode);
    this.CST_STACK.push(cstNode);
  }
  cstFinallyStateUpdate() {
    this.CST_STACK.pop();
  }
  cstPostRuleFull(ruleCstNode) {
    const prevToken = this.LA(0);
    const loc = ruleCstNode.location;
    if (loc.startOffset <= prevToken.startOffset === true) {
      loc.endOffset = prevToken.endOffset;
      loc.endLine = prevToken.endLine;
      loc.endColumn = prevToken.endColumn;
    } else {
      loc.startOffset = NaN;
      loc.startLine = NaN;
      loc.startColumn = NaN;
    }
  }
  cstPostRuleOnlyOffset(ruleCstNode) {
    const prevToken = this.LA(0);
    const loc = ruleCstNode.location;
    if (loc.startOffset <= prevToken.startOffset === true) {
      loc.endOffset = prevToken.endOffset;
    } else {
      loc.startOffset = NaN;
    }
  }
  cstPostTerminal(key, consumedToken) {
    const rootCst = this.CST_STACK[this.CST_STACK.length - 1];
    addTerminalToCst(rootCst, consumedToken, key);
    this.setNodeLocationFromToken(rootCst.location, consumedToken);
  }
  cstPostNonTerminal(ruleCstResult, ruleName) {
    const preCstNode = this.CST_STACK[this.CST_STACK.length - 1];
    addNoneTerminalToCst(preCstNode, ruleName, ruleCstResult);
    this.setNodeLocationFromNode(preCstNode.location, ruleCstResult.location);
  }
  getBaseCstVisitorConstructor() {
    if (isUndefined_default(this.baseCstVisitorConstructor)) {
      const newBaseCstVisitorConstructor = createBaseSemanticVisitorConstructor(this.className, keys_default(this.gastProductionsCache));
      this.baseCstVisitorConstructor = newBaseCstVisitorConstructor;
      return newBaseCstVisitorConstructor;
    }
    return this.baseCstVisitorConstructor;
  }
  getBaseCstVisitorConstructorWithDefaults() {
    if (isUndefined_default(this.baseCstVisitorWithDefaultsConstructor)) {
      const newConstructor = createBaseVisitorConstructorWithDefaults(this.className, keys_default(this.gastProductionsCache), this.getBaseCstVisitorConstructor());
      this.baseCstVisitorWithDefaultsConstructor = newConstructor;
      return newConstructor;
    }
    return this.baseCstVisitorWithDefaultsConstructor;
  }
  getLastExplicitRuleShortName() {
    const ruleStack = this.RULE_STACK;
    return ruleStack[ruleStack.length - 1];
  }
  getPreviousExplicitRuleShortName() {
    const ruleStack = this.RULE_STACK;
    return ruleStack[ruleStack.length - 2];
  }
  getLastExplicitRuleOccurrenceIndex() {
    const occurrenceStack = this.RULE_OCCURRENCE_STACK;
    return occurrenceStack[occurrenceStack.length - 1];
  }
}

// ../../node_modules/chevrotain/lib/src/parse/parser/traits/lexer_adapter.js
class LexerAdapter {
  initLexerAdapter() {
    this.tokVector = [];
    this.tokVectorLength = 0;
    this.currIdx = -1;
  }
  set input(newInput) {
    if (this.selfAnalysisDone !== true) {
      throw Error(`Missing <performSelfAnalysis> invocation at the end of the Parser's constructor.`);
    }
    this.reset();
    this.tokVector = newInput;
    this.tokVectorLength = newInput.length;
  }
  get input() {
    return this.tokVector;
  }
  SKIP_TOKEN() {
    if (this.currIdx <= this.tokVector.length - 2) {
      this.consumeToken();
      return this.LA(1);
    } else {
      return END_OF_FILE;
    }
  }
  LA(howMuch) {
    const soughtIdx = this.currIdx + howMuch;
    if (soughtIdx < 0 || this.tokVectorLength <= soughtIdx) {
      return END_OF_FILE;
    } else {
      return this.tokVector[soughtIdx];
    }
  }
  consumeToken() {
    this.currIdx++;
  }
  exportLexerState() {
    return this.currIdx;
  }
  importLexerState(newState) {
    this.currIdx = newState;
  }
  resetLexerState() {
    this.currIdx = -1;
  }
  moveToTerminatedState() {
    this.currIdx = this.tokVector.length - 1;
  }
  getLexerPosition() {
    return this.exportLexerState();
  }
}

// ../../node_modules/chevrotain/lib/src/parse/parser/traits/recognizer_api.js
class RecognizerApi {
  ACTION(impl) {
    return impl.call(this);
  }
  consume(idx, tokType, options) {
    return this.consumeInternal(tokType, idx, options);
  }
  subrule(idx, ruleToCall, options) {
    return this.subruleInternal(ruleToCall, idx, options);
  }
  option(idx, actionORMethodDef) {
    return this.optionInternal(actionORMethodDef, idx);
  }
  or(idx, altsOrOpts) {
    return this.orInternal(altsOrOpts, idx);
  }
  many(idx, actionORMethodDef) {
    return this.manyInternal(idx, actionORMethodDef);
  }
  atLeastOne(idx, actionORMethodDef) {
    return this.atLeastOneInternal(idx, actionORMethodDef);
  }
  CONSUME(tokType, options) {
    return this.consumeInternal(tokType, 0, options);
  }
  CONSUME1(tokType, options) {
    return this.consumeInternal(tokType, 1, options);
  }
  CONSUME2(tokType, options) {
    return this.consumeInternal(tokType, 2, options);
  }
  CONSUME3(tokType, options) {
    return this.consumeInternal(tokType, 3, options);
  }
  CONSUME4(tokType, options) {
    return this.consumeInternal(tokType, 4, options);
  }
  CONSUME5(tokType, options) {
    return this.consumeInternal(tokType, 5, options);
  }
  CONSUME6(tokType, options) {
    return this.consumeInternal(tokType, 6, options);
  }
  CONSUME7(tokType, options) {
    return this.consumeInternal(tokType, 7, options);
  }
  CONSUME8(tokType, options) {
    return this.consumeInternal(tokType, 8, options);
  }
  CONSUME9(tokType, options) {
    return this.consumeInternal(tokType, 9, options);
  }
  SUBRULE(ruleToCall, options) {
    return this.subruleInternal(ruleToCall, 0, options);
  }
  SUBRULE1(ruleToCall, options) {
    return this.subruleInternal(ruleToCall, 1, options);
  }
  SUBRULE2(ruleToCall, options) {
    return this.subruleInternal(ruleToCall, 2, options);
  }
  SUBRULE3(ruleToCall, options) {
    return this.subruleInternal(ruleToCall, 3, options);
  }
  SUBRULE4(ruleToCall, options) {
    return this.subruleInternal(ruleToCall, 4, options);
  }
  SUBRULE5(ruleToCall, options) {
    return this.subruleInternal(ruleToCall, 5, options);
  }
  SUBRULE6(ruleToCall, options) {
    return this.subruleInternal(ruleToCall, 6, options);
  }
  SUBRULE7(ruleToCall, options) {
    return this.subruleInternal(ruleToCall, 7, options);
  }
  SUBRULE8(ruleToCall, options) {
    return this.subruleInternal(ruleToCall, 8, options);
  }
  SUBRULE9(ruleToCall, options) {
    return this.subruleInternal(ruleToCall, 9, options);
  }
  OPTION(actionORMethodDef) {
    return this.optionInternal(actionORMethodDef, 0);
  }
  OPTION1(actionORMethodDef) {
    return this.optionInternal(actionORMethodDef, 1);
  }
  OPTION2(actionORMethodDef) {
    return this.optionInternal(actionORMethodDef, 2);
  }
  OPTION3(actionORMethodDef) {
    return this.optionInternal(actionORMethodDef, 3);
  }
  OPTION4(actionORMethodDef) {
    return this.optionInternal(actionORMethodDef, 4);
  }
  OPTION5(actionORMethodDef) {
    return this.optionInternal(actionORMethodDef, 5);
  }
  OPTION6(actionORMethodDef) {
    return this.optionInternal(actionORMethodDef, 6);
  }
  OPTION7(actionORMethodDef) {
    return this.optionInternal(actionORMethodDef, 7);
  }
  OPTION8(actionORMethodDef) {
    return this.optionInternal(actionORMethodDef, 8);
  }
  OPTION9(actionORMethodDef) {
    return this.optionInternal(actionORMethodDef, 9);
  }
  OR(altsOrOpts) {
    return this.orInternal(altsOrOpts, 0);
  }
  OR1(altsOrOpts) {
    return this.orInternal(altsOrOpts, 1);
  }
  OR2(altsOrOpts) {
    return this.orInternal(altsOrOpts, 2);
  }
  OR3(altsOrOpts) {
    return this.orInternal(altsOrOpts, 3);
  }
  OR4(altsOrOpts) {
    return this.orInternal(altsOrOpts, 4);
  }
  OR5(altsOrOpts) {
    return this.orInternal(altsOrOpts, 5);
  }
  OR6(altsOrOpts) {
    return this.orInternal(altsOrOpts, 6);
  }
  OR7(altsOrOpts) {
    return this.orInternal(altsOrOpts, 7);
  }
  OR8(altsOrOpts) {
    return this.orInternal(altsOrOpts, 8);
  }
  OR9(altsOrOpts) {
    return this.orInternal(altsOrOpts, 9);
  }
  MANY(actionORMethodDef) {
    this.manyInternal(0, actionORMethodDef);
  }
  MANY1(actionORMethodDef) {
    this.manyInternal(1, actionORMethodDef);
  }
  MANY2(actionORMethodDef) {
    this.manyInternal(2, actionORMethodDef);
  }
  MANY3(actionORMethodDef) {
    this.manyInternal(3, actionORMethodDef);
  }
  MANY4(actionORMethodDef) {
    this.manyInternal(4, actionORMethodDef);
  }
  MANY5(actionORMethodDef) {
    this.manyInternal(5, actionORMethodDef);
  }
  MANY6(actionORMethodDef) {
    this.manyInternal(6, actionORMethodDef);
  }
  MANY7(actionORMethodDef) {
    this.manyInternal(7, actionORMethodDef);
  }
  MANY8(actionORMethodDef) {
    this.manyInternal(8, actionORMethodDef);
  }
  MANY9(actionORMethodDef) {
    this.manyInternal(9, actionORMethodDef);
  }
  MANY_SEP(options) {
    this.manySepFirstInternal(0, options);
  }
  MANY_SEP1(options) {
    this.manySepFirstInternal(1, options);
  }
  MANY_SEP2(options) {
    this.manySepFirstInternal(2, options);
  }
  MANY_SEP3(options) {
    this.manySepFirstInternal(3, options);
  }
  MANY_SEP4(options) {
    this.manySepFirstInternal(4, options);
  }
  MANY_SEP5(options) {
    this.manySepFirstInternal(5, options);
  }
  MANY_SEP6(options) {
    this.manySepFirstInternal(6, options);
  }
  MANY_SEP7(options) {
    this.manySepFirstInternal(7, options);
  }
  MANY_SEP8(options) {
    this.manySepFirstInternal(8, options);
  }
  MANY_SEP9(options) {
    this.manySepFirstInternal(9, options);
  }
  AT_LEAST_ONE(actionORMethodDef) {
    this.atLeastOneInternal(0, actionORMethodDef);
  }
  AT_LEAST_ONE1(actionORMethodDef) {
    return this.atLeastOneInternal(1, actionORMethodDef);
  }
  AT_LEAST_ONE2(actionORMethodDef) {
    this.atLeastOneInternal(2, actionORMethodDef);
  }
  AT_LEAST_ONE3(actionORMethodDef) {
    this.atLeastOneInternal(3, actionORMethodDef);
  }
  AT_LEAST_ONE4(actionORMethodDef) {
    this.atLeastOneInternal(4, actionORMethodDef);
  }
  AT_LEAST_ONE5(actionORMethodDef) {
    this.atLeastOneInternal(5, actionORMethodDef);
  }
  AT_LEAST_ONE6(actionORMethodDef) {
    this.atLeastOneInternal(6, actionORMethodDef);
  }
  AT_LEAST_ONE7(actionORMethodDef) {
    this.atLeastOneInternal(7, actionORMethodDef);
  }
  AT_LEAST_ONE8(actionORMethodDef) {
    this.atLeastOneInternal(8, actionORMethodDef);
  }
  AT_LEAST_ONE9(actionORMethodDef) {
    this.atLeastOneInternal(9, actionORMethodDef);
  }
  AT_LEAST_ONE_SEP(options) {
    this.atLeastOneSepFirstInternal(0, options);
  }
  AT_LEAST_ONE_SEP1(options) {
    this.atLeastOneSepFirstInternal(1, options);
  }
  AT_LEAST_ONE_SEP2(options) {
    this.atLeastOneSepFirstInternal(2, options);
  }
  AT_LEAST_ONE_SEP3(options) {
    this.atLeastOneSepFirstInternal(3, options);
  }
  AT_LEAST_ONE_SEP4(options) {
    this.atLeastOneSepFirstInternal(4, options);
  }
  AT_LEAST_ONE_SEP5(options) {
    this.atLeastOneSepFirstInternal(5, options);
  }
  AT_LEAST_ONE_SEP6(options) {
    this.atLeastOneSepFirstInternal(6, options);
  }
  AT_LEAST_ONE_SEP7(options) {
    this.atLeastOneSepFirstInternal(7, options);
  }
  AT_LEAST_ONE_SEP8(options) {
    this.atLeastOneSepFirstInternal(8, options);
  }
  AT_LEAST_ONE_SEP9(options) {
    this.atLeastOneSepFirstInternal(9, options);
  }
  RULE(name, implementation, config = DEFAULT_RULE_CONFIG) {
    if (includes_default(this.definedRulesNames, name)) {
      const errMsg = defaultGrammarValidatorErrorProvider.buildDuplicateRuleNameError({
        topLevelRule: name,
        grammarName: this.className
      });
      const error = {
        message: errMsg,
        type: ParserDefinitionErrorType.DUPLICATE_RULE_NAME,
        ruleName: name
      };
      this.definitionErrors.push(error);
    }
    this.definedRulesNames.push(name);
    const ruleImplementation = this.defineRule(name, implementation, config);
    this[name] = ruleImplementation;
    return ruleImplementation;
  }
  OVERRIDE_RULE(name, impl, config = DEFAULT_RULE_CONFIG) {
    const ruleErrors = validateRuleIsOverridden(name, this.definedRulesNames, this.className);
    this.definitionErrors = this.definitionErrors.concat(ruleErrors);
    const ruleImplementation = this.defineRule(name, impl, config);
    this[name] = ruleImplementation;
    return ruleImplementation;
  }
  BACKTRACK(grammarRule, args) {
    return function() {
      this.isBackTrackingStack.push(1);
      const orgState = this.saveRecogState();
      try {
        grammarRule.apply(this, args);
        return true;
      } catch (e) {
        if (isRecognitionException(e)) {
          return false;
        } else {
          throw e;
        }
      } finally {
        this.reloadRecogState(orgState);
        this.isBackTrackingStack.pop();
      }
    };
  }
  getGAstProductions() {
    return this.gastProductionsCache;
  }
  getSerializedGastProductions() {
    return serializeGrammar(values_default(this.gastProductionsCache));
  }
}

// ../../node_modules/chevrotain/lib/src/parse/parser/traits/recognizer_engine.js
class RecognizerEngine {
  initRecognizerEngine(tokenVocabulary, config) {
    this.className = this.constructor.name;
    this.shortRuleNameToFull = {};
    this.fullRuleNameToShort = {};
    this.ruleShortNameIdx = 256;
    this.tokenMatcher = tokenStructuredMatcherNoCategories;
    this.subruleIdx = 0;
    this.definedRulesNames = [];
    this.tokensMap = {};
    this.isBackTrackingStack = [];
    this.RULE_STACK = [];
    this.RULE_OCCURRENCE_STACK = [];
    this.gastProductionsCache = {};
    if (has_default(config, "serializedGrammar")) {
      throw Error(`The Parser's configuration can no longer contain a <serializedGrammar> property.
` + `	See: https://chevrotain.io/docs/changes/BREAKING_CHANGES.html#_6-0-0
` + "\tFor Further details.");
    }
    if (isArray_default(tokenVocabulary)) {
      if (isEmpty_default(tokenVocabulary)) {
        throw Error(`A Token Vocabulary cannot be empty.
` + `	Note that the first argument for the parser constructor
` + "\tis no longer a Token vector (since v4.0).");
      }
      if (typeof tokenVocabulary[0].startOffset === "number") {
        throw Error(`The Parser constructor no longer accepts a token vector as the first argument.
` + `	See: https://chevrotain.io/docs/changes/BREAKING_CHANGES.html#_4-0-0
` + "\tFor Further details.");
      }
    }
    if (isArray_default(tokenVocabulary)) {
      this.tokensMap = reduce_default(tokenVocabulary, (acc, tokType) => {
        acc[tokType.name] = tokType;
        return acc;
      }, {});
    } else if (has_default(tokenVocabulary, "modes") && every_default(flatten_default(values_default(tokenVocabulary.modes)), isTokenType)) {
      const allTokenTypes2 = flatten_default(values_default(tokenVocabulary.modes));
      const uniqueTokens = uniq_default(allTokenTypes2);
      this.tokensMap = reduce_default(uniqueTokens, (acc, tokType) => {
        acc[tokType.name] = tokType;
        return acc;
      }, {});
    } else if (isObject_default(tokenVocabulary)) {
      this.tokensMap = clone_default(tokenVocabulary);
    } else {
      throw new Error("<tokensDictionary> argument must be An Array of Token constructors," + " A dictionary of Token constructors or an IMultiModeLexerDefinition");
    }
    this.tokensMap["EOF"] = EOF;
    const allTokenTypes = has_default(tokenVocabulary, "modes") ? flatten_default(values_default(tokenVocabulary.modes)) : values_default(tokenVocabulary);
    const noTokenCategoriesUsed = every_default(allTokenTypes, (tokenConstructor) => isEmpty_default(tokenConstructor.categoryMatches));
    this.tokenMatcher = noTokenCategoriesUsed ? tokenStructuredMatcherNoCategories : tokenStructuredMatcher;
    augmentTokenTypes(values_default(this.tokensMap));
  }
  defineRule(ruleName, impl, config) {
    if (this.selfAnalysisDone) {
      throw Error(`Grammar rule <${ruleName}> may not be defined after the 'performSelfAnalysis' method has been called'
` + `Make sure that all grammar rule definitions are done before 'performSelfAnalysis' is called.`);
    }
    const resyncEnabled = has_default(config, "resyncEnabled") ? config.resyncEnabled : DEFAULT_RULE_CONFIG.resyncEnabled;
    const recoveryValueFunc = has_default(config, "recoveryValueFunc") ? config.recoveryValueFunc : DEFAULT_RULE_CONFIG.recoveryValueFunc;
    const shortName = this.ruleShortNameIdx << BITS_FOR_METHOD_TYPE + BITS_FOR_OCCURRENCE_IDX;
    this.ruleShortNameIdx++;
    this.shortRuleNameToFull[shortName] = ruleName;
    this.fullRuleNameToShort[ruleName] = shortName;
    let invokeRuleWithTry;
    if (this.outputCst === true) {
      invokeRuleWithTry = function invokeRuleWithTry2(...args) {
        try {
          this.ruleInvocationStateUpdate(shortName, ruleName, this.subruleIdx);
          impl.apply(this, args);
          const cst = this.CST_STACK[this.CST_STACK.length - 1];
          this.cstPostRule(cst);
          return cst;
        } catch (e) {
          return this.invokeRuleCatch(e, resyncEnabled, recoveryValueFunc);
        } finally {
          this.ruleFinallyStateUpdate();
        }
      };
    } else {
      invokeRuleWithTry = function invokeRuleWithTryCst(...args) {
        try {
          this.ruleInvocationStateUpdate(shortName, ruleName, this.subruleIdx);
          return impl.apply(this, args);
        } catch (e) {
          return this.invokeRuleCatch(e, resyncEnabled, recoveryValueFunc);
        } finally {
          this.ruleFinallyStateUpdate();
        }
      };
    }
    const wrappedGrammarRule = Object.assign(invokeRuleWithTry, { ruleName, originalGrammarAction: impl });
    return wrappedGrammarRule;
  }
  invokeRuleCatch(e, resyncEnabledConfig, recoveryValueFunc) {
    const isFirstInvokedRule = this.RULE_STACK.length === 1;
    const reSyncEnabled = resyncEnabledConfig && !this.isBackTracking() && this.recoveryEnabled;
    if (isRecognitionException(e)) {
      const recogError = e;
      if (reSyncEnabled) {
        const reSyncTokType = this.findReSyncTokenType();
        if (this.isInCurrentRuleReSyncSet(reSyncTokType)) {
          recogError.resyncedTokens = this.reSyncTo(reSyncTokType);
          if (this.outputCst) {
            const partialCstResult = this.CST_STACK[this.CST_STACK.length - 1];
            partialCstResult.recoveredNode = true;
            return partialCstResult;
          } else {
            return recoveryValueFunc(e);
          }
        } else {
          if (this.outputCst) {
            const partialCstResult = this.CST_STACK[this.CST_STACK.length - 1];
            partialCstResult.recoveredNode = true;
            recogError.partialCstResult = partialCstResult;
          }
          throw recogError;
        }
      } else if (isFirstInvokedRule) {
        this.moveToTerminatedState();
        return recoveryValueFunc(e);
      } else {
        throw recogError;
      }
    } else {
      throw e;
    }
  }
  optionInternal(actionORMethodDef, occurrence) {
    const key = this.getKeyForAutomaticLookahead(OPTION_IDX, occurrence);
    return this.optionInternalLogic(actionORMethodDef, occurrence, key);
  }
  optionInternalLogic(actionORMethodDef, occurrence, key) {
    let lookAheadFunc = this.getLaFuncFromCache(key);
    let action;
    if (typeof actionORMethodDef !== "function") {
      action = actionORMethodDef.DEF;
      const predicate = actionORMethodDef.GATE;
      if (predicate !== undefined) {
        const orgLookaheadFunction = lookAheadFunc;
        lookAheadFunc = () => {
          return predicate.call(this) && orgLookaheadFunction.call(this);
        };
      }
    } else {
      action = actionORMethodDef;
    }
    if (lookAheadFunc.call(this) === true) {
      return action.call(this);
    }
    return;
  }
  atLeastOneInternal(prodOccurrence, actionORMethodDef) {
    const laKey = this.getKeyForAutomaticLookahead(AT_LEAST_ONE_IDX, prodOccurrence);
    return this.atLeastOneInternalLogic(prodOccurrence, actionORMethodDef, laKey);
  }
  atLeastOneInternalLogic(prodOccurrence, actionORMethodDef, key) {
    let lookAheadFunc = this.getLaFuncFromCache(key);
    let action;
    if (typeof actionORMethodDef !== "function") {
      action = actionORMethodDef.DEF;
      const predicate = actionORMethodDef.GATE;
      if (predicate !== undefined) {
        const orgLookaheadFunction = lookAheadFunc;
        lookAheadFunc = () => {
          return predicate.call(this) && orgLookaheadFunction.call(this);
        };
      }
    } else {
      action = actionORMethodDef;
    }
    if (lookAheadFunc.call(this) === true) {
      let notStuck = this.doSingleRepetition(action);
      while (lookAheadFunc.call(this) === true && notStuck === true) {
        notStuck = this.doSingleRepetition(action);
      }
    } else {
      throw this.raiseEarlyExitException(prodOccurrence, PROD_TYPE.REPETITION_MANDATORY, actionORMethodDef.ERR_MSG);
    }
    this.attemptInRepetitionRecovery(this.atLeastOneInternal, [prodOccurrence, actionORMethodDef], lookAheadFunc, AT_LEAST_ONE_IDX, prodOccurrence, NextTerminalAfterAtLeastOneWalker);
  }
  atLeastOneSepFirstInternal(prodOccurrence, options) {
    const laKey = this.getKeyForAutomaticLookahead(AT_LEAST_ONE_SEP_IDX, prodOccurrence);
    this.atLeastOneSepFirstInternalLogic(prodOccurrence, options, laKey);
  }
  atLeastOneSepFirstInternalLogic(prodOccurrence, options, key) {
    const action = options.DEF;
    const separator = options.SEP;
    const firstIterationLookaheadFunc = this.getLaFuncFromCache(key);
    if (firstIterationLookaheadFunc.call(this) === true) {
      action.call(this);
      const separatorLookAheadFunc = () => {
        return this.tokenMatcher(this.LA(1), separator);
      };
      while (this.tokenMatcher(this.LA(1), separator) === true) {
        this.CONSUME(separator);
        action.call(this);
      }
      this.attemptInRepetitionRecovery(this.repetitionSepSecondInternal, [
        prodOccurrence,
        separator,
        separatorLookAheadFunc,
        action,
        NextTerminalAfterAtLeastOneSepWalker
      ], separatorLookAheadFunc, AT_LEAST_ONE_SEP_IDX, prodOccurrence, NextTerminalAfterAtLeastOneSepWalker);
    } else {
      throw this.raiseEarlyExitException(prodOccurrence, PROD_TYPE.REPETITION_MANDATORY_WITH_SEPARATOR, options.ERR_MSG);
    }
  }
  manyInternal(prodOccurrence, actionORMethodDef) {
    const laKey = this.getKeyForAutomaticLookahead(MANY_IDX, prodOccurrence);
    return this.manyInternalLogic(prodOccurrence, actionORMethodDef, laKey);
  }
  manyInternalLogic(prodOccurrence, actionORMethodDef, key) {
    let lookaheadFunction = this.getLaFuncFromCache(key);
    let action;
    if (typeof actionORMethodDef !== "function") {
      action = actionORMethodDef.DEF;
      const predicate = actionORMethodDef.GATE;
      if (predicate !== undefined) {
        const orgLookaheadFunction = lookaheadFunction;
        lookaheadFunction = () => {
          return predicate.call(this) && orgLookaheadFunction.call(this);
        };
      }
    } else {
      action = actionORMethodDef;
    }
    let notStuck = true;
    while (lookaheadFunction.call(this) === true && notStuck === true) {
      notStuck = this.doSingleRepetition(action);
    }
    this.attemptInRepetitionRecovery(this.manyInternal, [prodOccurrence, actionORMethodDef], lookaheadFunction, MANY_IDX, prodOccurrence, NextTerminalAfterManyWalker, notStuck);
  }
  manySepFirstInternal(prodOccurrence, options) {
    const laKey = this.getKeyForAutomaticLookahead(MANY_SEP_IDX, prodOccurrence);
    this.manySepFirstInternalLogic(prodOccurrence, options, laKey);
  }
  manySepFirstInternalLogic(prodOccurrence, options, key) {
    const action = options.DEF;
    const separator = options.SEP;
    const firstIterationLaFunc = this.getLaFuncFromCache(key);
    if (firstIterationLaFunc.call(this) === true) {
      action.call(this);
      const separatorLookAheadFunc = () => {
        return this.tokenMatcher(this.LA(1), separator);
      };
      while (this.tokenMatcher(this.LA(1), separator) === true) {
        this.CONSUME(separator);
        action.call(this);
      }
      this.attemptInRepetitionRecovery(this.repetitionSepSecondInternal, [
        prodOccurrence,
        separator,
        separatorLookAheadFunc,
        action,
        NextTerminalAfterManySepWalker
      ], separatorLookAheadFunc, MANY_SEP_IDX, prodOccurrence, NextTerminalAfterManySepWalker);
    }
  }
  repetitionSepSecondInternal(prodOccurrence, separator, separatorLookAheadFunc, action, nextTerminalAfterWalker) {
    while (separatorLookAheadFunc()) {
      this.CONSUME(separator);
      action.call(this);
    }
    this.attemptInRepetitionRecovery(this.repetitionSepSecondInternal, [
      prodOccurrence,
      separator,
      separatorLookAheadFunc,
      action,
      nextTerminalAfterWalker
    ], separatorLookAheadFunc, AT_LEAST_ONE_SEP_IDX, prodOccurrence, nextTerminalAfterWalker);
  }
  doSingleRepetition(action) {
    const beforeIteration = this.getLexerPosition();
    action.call(this);
    const afterIteration = this.getLexerPosition();
    return afterIteration > beforeIteration;
  }
  orInternal(altsOrOpts, occurrence) {
    const laKey = this.getKeyForAutomaticLookahead(OR_IDX, occurrence);
    const alts = isArray_default(altsOrOpts) ? altsOrOpts : altsOrOpts.DEF;
    const laFunc = this.getLaFuncFromCache(laKey);
    const altIdxToTake = laFunc.call(this, alts);
    if (altIdxToTake !== undefined) {
      const chosenAlternative = alts[altIdxToTake];
      return chosenAlternative.ALT.call(this);
    }
    this.raiseNoAltException(occurrence, altsOrOpts.ERR_MSG);
  }
  ruleFinallyStateUpdate() {
    this.RULE_STACK.pop();
    this.RULE_OCCURRENCE_STACK.pop();
    this.cstFinallyStateUpdate();
    if (this.RULE_STACK.length === 0 && this.isAtEndOfInput() === false) {
      const firstRedundantTok = this.LA(1);
      const errMsg = this.errorMessageProvider.buildNotAllInputParsedMessage({
        firstRedundant: firstRedundantTok,
        ruleName: this.getCurrRuleFullName()
      });
      this.SAVE_ERROR(new NotAllInputParsedException(errMsg, firstRedundantTok));
    }
  }
  subruleInternal(ruleToCall, idx, options) {
    let ruleResult;
    try {
      const args = options !== undefined ? options.ARGS : undefined;
      this.subruleIdx = idx;
      ruleResult = ruleToCall.apply(this, args);
      this.cstPostNonTerminal(ruleResult, options !== undefined && options.LABEL !== undefined ? options.LABEL : ruleToCall.ruleName);
      return ruleResult;
    } catch (e) {
      throw this.subruleInternalError(e, options, ruleToCall.ruleName);
    }
  }
  subruleInternalError(e, options, ruleName) {
    if (isRecognitionException(e) && e.partialCstResult !== undefined) {
      this.cstPostNonTerminal(e.partialCstResult, options !== undefined && options.LABEL !== undefined ? options.LABEL : ruleName);
      delete e.partialCstResult;
    }
    throw e;
  }
  consumeInternal(tokType, idx, options) {
    let consumedToken;
    try {
      const nextToken = this.LA(1);
      if (this.tokenMatcher(nextToken, tokType) === true) {
        this.consumeToken();
        consumedToken = nextToken;
      } else {
        this.consumeInternalError(tokType, nextToken, options);
      }
    } catch (eFromConsumption) {
      consumedToken = this.consumeInternalRecovery(tokType, idx, eFromConsumption);
    }
    this.cstPostTerminal(options !== undefined && options.LABEL !== undefined ? options.LABEL : tokType.name, consumedToken);
    return consumedToken;
  }
  consumeInternalError(tokType, nextToken, options) {
    let msg;
    const previousToken = this.LA(0);
    if (options !== undefined && options.ERR_MSG) {
      msg = options.ERR_MSG;
    } else {
      msg = this.errorMessageProvider.buildMismatchTokenMessage({
        expected: tokType,
        actual: nextToken,
        previous: previousToken,
        ruleName: this.getCurrRuleFullName()
      });
    }
    throw this.SAVE_ERROR(new MismatchedTokenException(msg, nextToken, previousToken));
  }
  consumeInternalRecovery(tokType, idx, eFromConsumption) {
    if (this.recoveryEnabled && eFromConsumption.name === "MismatchedTokenException" && !this.isBackTracking()) {
      const follows = this.getFollowsForInRuleRecovery(tokType, idx);
      try {
        return this.tryInRuleRecovery(tokType, follows);
      } catch (eFromInRuleRecovery) {
        if (eFromInRuleRecovery.name === IN_RULE_RECOVERY_EXCEPTION) {
          throw eFromConsumption;
        } else {
          throw eFromInRuleRecovery;
        }
      }
    } else {
      throw eFromConsumption;
    }
  }
  saveRecogState() {
    const savedErrors = this.errors;
    const savedRuleStack = clone_default(this.RULE_STACK);
    return {
      errors: savedErrors,
      lexerState: this.exportLexerState(),
      RULE_STACK: savedRuleStack,
      CST_STACK: this.CST_STACK
    };
  }
  reloadRecogState(newState) {
    this.errors = newState.errors;
    this.importLexerState(newState.lexerState);
    this.RULE_STACK = newState.RULE_STACK;
  }
  ruleInvocationStateUpdate(shortName, fullName, idxInCallingRule) {
    this.RULE_OCCURRENCE_STACK.push(idxInCallingRule);
    this.RULE_STACK.push(shortName);
    this.cstInvocationStateUpdate(fullName);
  }
  isBackTracking() {
    return this.isBackTrackingStack.length !== 0;
  }
  getCurrRuleFullName() {
    const shortName = this.getLastExplicitRuleShortName();
    return this.shortRuleNameToFull[shortName];
  }
  shortRuleNameToFullName(shortName) {
    return this.shortRuleNameToFull[shortName];
  }
  isAtEndOfInput() {
    return this.tokenMatcher(this.LA(1), EOF);
  }
  reset() {
    this.resetLexerState();
    this.subruleIdx = 0;
    this.isBackTrackingStack = [];
    this.errors = [];
    this.RULE_STACK = [];
    this.CST_STACK = [];
    this.RULE_OCCURRENCE_STACK = [];
  }
}

// ../../node_modules/chevrotain/lib/src/parse/parser/traits/error_handler.js
class ErrorHandler {
  initErrorHandler(config) {
    this._errors = [];
    this.errorMessageProvider = has_default(config, "errorMessageProvider") ? config.errorMessageProvider : DEFAULT_PARSER_CONFIG.errorMessageProvider;
  }
  SAVE_ERROR(error) {
    if (isRecognitionException(error)) {
      error.context = {
        ruleStack: this.getHumanReadableRuleStack(),
        ruleOccurrenceStack: clone_default(this.RULE_OCCURRENCE_STACK)
      };
      this._errors.push(error);
      return error;
    } else {
      throw Error("Trying to save an Error which is not a RecognitionException");
    }
  }
  get errors() {
    return clone_default(this._errors);
  }
  set errors(newErrors) {
    this._errors = newErrors;
  }
  raiseEarlyExitException(occurrence, prodType, userDefinedErrMsg) {
    const ruleName = this.getCurrRuleFullName();
    const ruleGrammar = this.getGAstProductions()[ruleName];
    const lookAheadPathsPerAlternative = getLookaheadPathsForOptionalProd(occurrence, ruleGrammar, prodType, this.maxLookahead);
    const insideProdPaths = lookAheadPathsPerAlternative[0];
    const actualTokens = [];
    for (let i = 1;i <= this.maxLookahead; i++) {
      actualTokens.push(this.LA(i));
    }
    const msg = this.errorMessageProvider.buildEarlyExitMessage({
      expectedIterationPaths: insideProdPaths,
      actual: actualTokens,
      previous: this.LA(0),
      customUserDescription: userDefinedErrMsg,
      ruleName
    });
    throw this.SAVE_ERROR(new EarlyExitException(msg, this.LA(1), this.LA(0)));
  }
  raiseNoAltException(occurrence, errMsgTypes) {
    const ruleName = this.getCurrRuleFullName();
    const ruleGrammar = this.getGAstProductions()[ruleName];
    const lookAheadPathsPerAlternative = getLookaheadPathsForOr(occurrence, ruleGrammar, this.maxLookahead);
    const actualTokens = [];
    for (let i = 1;i <= this.maxLookahead; i++) {
      actualTokens.push(this.LA(i));
    }
    const previousToken = this.LA(0);
    const errMsg = this.errorMessageProvider.buildNoViableAltMessage({
      expectedPathsPerAlt: lookAheadPathsPerAlternative,
      actual: actualTokens,
      previous: previousToken,
      customUserDescription: errMsgTypes,
      ruleName: this.getCurrRuleFullName()
    });
    throw this.SAVE_ERROR(new NoViableAltException(errMsg, this.LA(1), previousToken));
  }
}

// ../../node_modules/chevrotain/lib/src/parse/parser/traits/context_assist.js
class ContentAssist {
  initContentAssist() {}
  computeContentAssist(startRuleName, precedingInput) {
    const startRuleGast = this.gastProductionsCache[startRuleName];
    if (isUndefined_default(startRuleGast)) {
      throw Error(`Rule ->${startRuleName}<- does not exist in this grammar.`);
    }
    return nextPossibleTokensAfter([startRuleGast], precedingInput, this.tokenMatcher, this.maxLookahead);
  }
  getNextPossibleTokenTypes(grammarPath) {
    const topRuleName = head_default(grammarPath.ruleStack);
    const gastProductions = this.getGAstProductions();
    const topProduction = gastProductions[topRuleName];
    const nextPossibleTokenTypes = new NextAfterTokenWalker(topProduction, grammarPath).startWalking();
    return nextPossibleTokenTypes;
  }
}

// ../../node_modules/chevrotain/lib/src/parse/parser/traits/gast_recorder.js
var RECORDING_NULL_OBJECT = {
  description: "This Object indicates the Parser is during Recording Phase"
};
Object.freeze(RECORDING_NULL_OBJECT);
var HANDLE_SEPARATOR = true;
var MAX_METHOD_IDX = Math.pow(2, BITS_FOR_OCCURRENCE_IDX) - 1;
var RFT = createToken({ name: "RECORDING_PHASE_TOKEN", pattern: Lexer.NA });
augmentTokenTypes([RFT]);
var RECORDING_PHASE_TOKEN = createTokenInstance(RFT, `This IToken indicates the Parser is in Recording Phase
	` + "" + "See: https://chevrotain.io/docs/guide/internals.html#grammar-recording for details", -1, -1, -1, -1, -1, -1);
Object.freeze(RECORDING_PHASE_TOKEN);
var RECORDING_PHASE_CSTNODE = {
  name: `This CSTNode indicates the Parser is in Recording Phase
	` + "See: https://chevrotain.io/docs/guide/internals.html#grammar-recording for details",
  children: {}
};

class GastRecorder {
  initGastRecorder(config) {
    this.recordingProdStack = [];
    this.RECORDING_PHASE = false;
  }
  enableRecording() {
    this.RECORDING_PHASE = true;
    this.TRACE_INIT("Enable Recording", () => {
      for (let i = 0;i < 10; i++) {
        const idx = i > 0 ? i : "";
        this[`CONSUME${idx}`] = function(arg1, arg2) {
          return this.consumeInternalRecord(arg1, i, arg2);
        };
        this[`SUBRULE${idx}`] = function(arg1, arg2) {
          return this.subruleInternalRecord(arg1, i, arg2);
        };
        this[`OPTION${idx}`] = function(arg1) {
          return this.optionInternalRecord(arg1, i);
        };
        this[`OR${idx}`] = function(arg1) {
          return this.orInternalRecord(arg1, i);
        };
        this[`MANY${idx}`] = function(arg1) {
          this.manyInternalRecord(i, arg1);
        };
        this[`MANY_SEP${idx}`] = function(arg1) {
          this.manySepFirstInternalRecord(i, arg1);
        };
        this[`AT_LEAST_ONE${idx}`] = function(arg1) {
          this.atLeastOneInternalRecord(i, arg1);
        };
        this[`AT_LEAST_ONE_SEP${idx}`] = function(arg1) {
          this.atLeastOneSepFirstInternalRecord(i, arg1);
        };
      }
      this[`consume`] = function(idx, arg1, arg2) {
        return this.consumeInternalRecord(arg1, idx, arg2);
      };
      this[`subrule`] = function(idx, arg1, arg2) {
        return this.subruleInternalRecord(arg1, idx, arg2);
      };
      this[`option`] = function(idx, arg1) {
        return this.optionInternalRecord(arg1, idx);
      };
      this[`or`] = function(idx, arg1) {
        return this.orInternalRecord(arg1, idx);
      };
      this[`many`] = function(idx, arg1) {
        this.manyInternalRecord(idx, arg1);
      };
      this[`atLeastOne`] = function(idx, arg1) {
        this.atLeastOneInternalRecord(idx, arg1);
      };
      this.ACTION = this.ACTION_RECORD;
      this.BACKTRACK = this.BACKTRACK_RECORD;
      this.LA = this.LA_RECORD;
    });
  }
  disableRecording() {
    this.RECORDING_PHASE = false;
    this.TRACE_INIT("Deleting Recording methods", () => {
      const that = this;
      for (let i = 0;i < 10; i++) {
        const idx = i > 0 ? i : "";
        delete that[`CONSUME${idx}`];
        delete that[`SUBRULE${idx}`];
        delete that[`OPTION${idx}`];
        delete that[`OR${idx}`];
        delete that[`MANY${idx}`];
        delete that[`MANY_SEP${idx}`];
        delete that[`AT_LEAST_ONE${idx}`];
        delete that[`AT_LEAST_ONE_SEP${idx}`];
      }
      delete that[`consume`];
      delete that[`subrule`];
      delete that[`option`];
      delete that[`or`];
      delete that[`many`];
      delete that[`atLeastOne`];
      delete that.ACTION;
      delete that.BACKTRACK;
      delete that.LA;
    });
  }
  ACTION_RECORD(impl) {}
  BACKTRACK_RECORD(grammarRule, args) {
    return () => true;
  }
  LA_RECORD(howMuch) {
    return END_OF_FILE;
  }
  topLevelRuleRecord(name, def) {
    try {
      const newTopLevelRule = new Rule({ definition: [], name });
      newTopLevelRule.name = name;
      this.recordingProdStack.push(newTopLevelRule);
      def.call(this);
      this.recordingProdStack.pop();
      return newTopLevelRule;
    } catch (originalError) {
      if (originalError.KNOWN_RECORDER_ERROR !== true) {
        try {
          originalError.message = originalError.message + `
	 This error was thrown during the "grammar recording phase" For more info see:
	` + "https://chevrotain.io/docs/guide/internals.html#grammar-recording";
        } catch (mutabilityError) {
          throw originalError;
        }
      }
      throw originalError;
    }
  }
  optionInternalRecord(actionORMethodDef, occurrence) {
    return recordProd.call(this, Option, actionORMethodDef, occurrence);
  }
  atLeastOneInternalRecord(occurrence, actionORMethodDef) {
    recordProd.call(this, RepetitionMandatory, actionORMethodDef, occurrence);
  }
  atLeastOneSepFirstInternalRecord(occurrence, options) {
    recordProd.call(this, RepetitionMandatoryWithSeparator, options, occurrence, HANDLE_SEPARATOR);
  }
  manyInternalRecord(occurrence, actionORMethodDef) {
    recordProd.call(this, Repetition, actionORMethodDef, occurrence);
  }
  manySepFirstInternalRecord(occurrence, options) {
    recordProd.call(this, RepetitionWithSeparator, options, occurrence, HANDLE_SEPARATOR);
  }
  orInternalRecord(altsOrOpts, occurrence) {
    return recordOrProd.call(this, altsOrOpts, occurrence);
  }
  subruleInternalRecord(ruleToCall, occurrence, options) {
    assertMethodIdxIsValid(occurrence);
    if (!ruleToCall || has_default(ruleToCall, "ruleName") === false) {
      const error = new Error(`<SUBRULE${getIdxSuffix(occurrence)}> argument is invalid` + ` expecting a Parser method reference but got: <${JSON.stringify(ruleToCall)}>` + `
 inside top level rule: <${this.recordingProdStack[0].name}>`);
      error.KNOWN_RECORDER_ERROR = true;
      throw error;
    }
    const prevProd = last_default(this.recordingProdStack);
    const ruleName = ruleToCall.ruleName;
    const newNoneTerminal = new NonTerminal({
      idx: occurrence,
      nonTerminalName: ruleName,
      label: options === null || options === undefined ? undefined : options.LABEL,
      referencedRule: undefined
    });
    prevProd.definition.push(newNoneTerminal);
    return this.outputCst ? RECORDING_PHASE_CSTNODE : RECORDING_NULL_OBJECT;
  }
  consumeInternalRecord(tokType, occurrence, options) {
    assertMethodIdxIsValid(occurrence);
    if (!hasShortKeyProperty(tokType)) {
      const error = new Error(`<CONSUME${getIdxSuffix(occurrence)}> argument is invalid` + ` expecting a TokenType reference but got: <${JSON.stringify(tokType)}>` + `
 inside top level rule: <${this.recordingProdStack[0].name}>`);
      error.KNOWN_RECORDER_ERROR = true;
      throw error;
    }
    const prevProd = last_default(this.recordingProdStack);
    const newNoneTerminal = new Terminal({
      idx: occurrence,
      terminalType: tokType,
      label: options === null || options === undefined ? undefined : options.LABEL
    });
    prevProd.definition.push(newNoneTerminal);
    return RECORDING_PHASE_TOKEN;
  }
}
function recordProd(prodConstructor, mainProdArg, occurrence, handleSep = false) {
  assertMethodIdxIsValid(occurrence);
  const prevProd = last_default(this.recordingProdStack);
  const grammarAction = isFunction_default(mainProdArg) ? mainProdArg : mainProdArg.DEF;
  const newProd = new prodConstructor({ definition: [], idx: occurrence });
  if (handleSep) {
    newProd.separator = mainProdArg.SEP;
  }
  if (has_default(mainProdArg, "MAX_LOOKAHEAD")) {
    newProd.maxLookahead = mainProdArg.MAX_LOOKAHEAD;
  }
  this.recordingProdStack.push(newProd);
  grammarAction.call(this);
  prevProd.definition.push(newProd);
  this.recordingProdStack.pop();
  return RECORDING_NULL_OBJECT;
}
function recordOrProd(mainProdArg, occurrence) {
  assertMethodIdxIsValid(occurrence);
  const prevProd = last_default(this.recordingProdStack);
  const hasOptions = isArray_default(mainProdArg) === false;
  const alts = hasOptions === false ? mainProdArg : mainProdArg.DEF;
  const newOrProd = new Alternation({
    definition: [],
    idx: occurrence,
    ignoreAmbiguities: hasOptions && mainProdArg.IGNORE_AMBIGUITIES === true
  });
  if (has_default(mainProdArg, "MAX_LOOKAHEAD")) {
    newOrProd.maxLookahead = mainProdArg.MAX_LOOKAHEAD;
  }
  const hasPredicates = some_default(alts, (currAlt) => isFunction_default(currAlt.GATE));
  newOrProd.hasPredicates = hasPredicates;
  prevProd.definition.push(newOrProd);
  forEach_default(alts, (currAlt) => {
    const currAltFlat = new Alternative({ definition: [] });
    newOrProd.definition.push(currAltFlat);
    if (has_default(currAlt, "IGNORE_AMBIGUITIES")) {
      currAltFlat.ignoreAmbiguities = currAlt.IGNORE_AMBIGUITIES;
    } else if (has_default(currAlt, "GATE")) {
      currAltFlat.ignoreAmbiguities = true;
    }
    this.recordingProdStack.push(currAltFlat);
    currAlt.ALT.call(this);
    this.recordingProdStack.pop();
  });
  return RECORDING_NULL_OBJECT;
}
function getIdxSuffix(idx) {
  return idx === 0 ? "" : `${idx}`;
}
function assertMethodIdxIsValid(idx) {
  if (idx < 0 || idx > MAX_METHOD_IDX) {
    const error = new Error(`Invalid DSL Method idx value: <${idx}>
	` + `Idx value must be a none negative value smaller than ${MAX_METHOD_IDX + 1}`);
    error.KNOWN_RECORDER_ERROR = true;
    throw error;
  }
}

// ../../node_modules/chevrotain/lib/src/parse/parser/traits/perf_tracer.js
class PerformanceTracer {
  initPerformanceTracer(config) {
    if (has_default(config, "traceInitPerf")) {
      const userTraceInitPerf = config.traceInitPerf;
      const traceIsNumber = typeof userTraceInitPerf === "number";
      this.traceInitMaxIdent = traceIsNumber ? userTraceInitPerf : Infinity;
      this.traceInitPerf = traceIsNumber ? userTraceInitPerf > 0 : userTraceInitPerf;
    } else {
      this.traceInitMaxIdent = 0;
      this.traceInitPerf = DEFAULT_PARSER_CONFIG.traceInitPerf;
    }
    this.traceInitIndent = -1;
  }
  TRACE_INIT(phaseDesc, phaseImpl) {
    if (this.traceInitPerf === true) {
      this.traceInitIndent++;
      const indent = new Array(this.traceInitIndent + 1).join("\t");
      if (this.traceInitIndent < this.traceInitMaxIdent) {
        console.log(`${indent}--> <${phaseDesc}>`);
      }
      const { time, value } = timer(phaseImpl);
      const traceMethod = time > 10 ? console.warn : console.log;
      if (this.traceInitIndent < this.traceInitMaxIdent) {
        traceMethod(`${indent}<-- <${phaseDesc}> time: ${time}ms`);
      }
      this.traceInitIndent--;
      return value;
    } else {
      return phaseImpl();
    }
  }
}

// ../../node_modules/chevrotain/lib/src/parse/parser/utils/apply_mixins.js
function applyMixins(derivedCtor, baseCtors) {
  baseCtors.forEach((baseCtor) => {
    const baseProto = baseCtor.prototype;
    Object.getOwnPropertyNames(baseProto).forEach((propName) => {
      if (propName === "constructor") {
        return;
      }
      const basePropDescriptor = Object.getOwnPropertyDescriptor(baseProto, propName);
      if (basePropDescriptor && (basePropDescriptor.get || basePropDescriptor.set)) {
        Object.defineProperty(derivedCtor.prototype, propName, basePropDescriptor);
      } else {
        derivedCtor.prototype[propName] = baseCtor.prototype[propName];
      }
    });
  });
}

// ../../node_modules/chevrotain/lib/src/parse/parser/parser.js
var END_OF_FILE = createTokenInstance(EOF, "", NaN, NaN, NaN, NaN, NaN, NaN);
Object.freeze(END_OF_FILE);
var DEFAULT_PARSER_CONFIG = Object.freeze({
  recoveryEnabled: false,
  maxLookahead: 3,
  dynamicTokensEnabled: false,
  outputCst: true,
  errorMessageProvider: defaultParserErrorProvider,
  nodeLocationTracking: "none",
  traceInitPerf: false,
  skipValidations: false
});
var DEFAULT_RULE_CONFIG = Object.freeze({
  recoveryValueFunc: () => {
    return;
  },
  resyncEnabled: true
});
var ParserDefinitionErrorType;
(function(ParserDefinitionErrorType2) {
  ParserDefinitionErrorType2[ParserDefinitionErrorType2["INVALID_RULE_NAME"] = 0] = "INVALID_RULE_NAME";
  ParserDefinitionErrorType2[ParserDefinitionErrorType2["DUPLICATE_RULE_NAME"] = 1] = "DUPLICATE_RULE_NAME";
  ParserDefinitionErrorType2[ParserDefinitionErrorType2["INVALID_RULE_OVERRIDE"] = 2] = "INVALID_RULE_OVERRIDE";
  ParserDefinitionErrorType2[ParserDefinitionErrorType2["DUPLICATE_PRODUCTIONS"] = 3] = "DUPLICATE_PRODUCTIONS";
  ParserDefinitionErrorType2[ParserDefinitionErrorType2["UNRESOLVED_SUBRULE_REF"] = 4] = "UNRESOLVED_SUBRULE_REF";
  ParserDefinitionErrorType2[ParserDefinitionErrorType2["LEFT_RECURSION"] = 5] = "LEFT_RECURSION";
  ParserDefinitionErrorType2[ParserDefinitionErrorType2["NONE_LAST_EMPTY_ALT"] = 6] = "NONE_LAST_EMPTY_ALT";
  ParserDefinitionErrorType2[ParserDefinitionErrorType2["AMBIGUOUS_ALTS"] = 7] = "AMBIGUOUS_ALTS";
  ParserDefinitionErrorType2[ParserDefinitionErrorType2["CONFLICT_TOKENS_RULES_NAMESPACE"] = 8] = "CONFLICT_TOKENS_RULES_NAMESPACE";
  ParserDefinitionErrorType2[ParserDefinitionErrorType2["INVALID_TOKEN_NAME"] = 9] = "INVALID_TOKEN_NAME";
  ParserDefinitionErrorType2[ParserDefinitionErrorType2["NO_NON_EMPTY_LOOKAHEAD"] = 10] = "NO_NON_EMPTY_LOOKAHEAD";
  ParserDefinitionErrorType2[ParserDefinitionErrorType2["AMBIGUOUS_PREFIX_ALTS"] = 11] = "AMBIGUOUS_PREFIX_ALTS";
  ParserDefinitionErrorType2[ParserDefinitionErrorType2["TOO_MANY_ALTS"] = 12] = "TOO_MANY_ALTS";
  ParserDefinitionErrorType2[ParserDefinitionErrorType2["CUSTOM_LOOKAHEAD_VALIDATION"] = 13] = "CUSTOM_LOOKAHEAD_VALIDATION";
})(ParserDefinitionErrorType || (ParserDefinitionErrorType = {}));
class Parser {
  static performSelfAnalysis(parserInstance) {
    throw Error("The **static** `performSelfAnalysis` method has been deprecated." + `	
Use the **instance** method with the same name instead.`);
  }
  performSelfAnalysis() {
    this.TRACE_INIT("performSelfAnalysis", () => {
      let defErrorsMsgs;
      this.selfAnalysisDone = true;
      const className = this.className;
      this.TRACE_INIT("toFastProps", () => {
        toFastProperties(this);
      });
      this.TRACE_INIT("Grammar Recording", () => {
        try {
          this.enableRecording();
          forEach_default(this.definedRulesNames, (currRuleName) => {
            const wrappedRule = this[currRuleName];
            const originalGrammarAction = wrappedRule["originalGrammarAction"];
            let recordedRuleGast;
            this.TRACE_INIT(`${currRuleName} Rule`, () => {
              recordedRuleGast = this.topLevelRuleRecord(currRuleName, originalGrammarAction);
            });
            this.gastProductionsCache[currRuleName] = recordedRuleGast;
          });
        } finally {
          this.disableRecording();
        }
      });
      let resolverErrors = [];
      this.TRACE_INIT("Grammar Resolving", () => {
        resolverErrors = resolveGrammar2({
          rules: values_default(this.gastProductionsCache)
        });
        this.definitionErrors = this.definitionErrors.concat(resolverErrors);
      });
      this.TRACE_INIT("Grammar Validations", () => {
        if (isEmpty_default(resolverErrors) && this.skipValidations === false) {
          const validationErrors = validateGrammar2({
            rules: values_default(this.gastProductionsCache),
            tokenTypes: values_default(this.tokensMap),
            errMsgProvider: defaultGrammarValidatorErrorProvider,
            grammarName: className
          });
          const lookaheadValidationErrors = validateLookahead({
            lookaheadStrategy: this.lookaheadStrategy,
            rules: values_default(this.gastProductionsCache),
            tokenTypes: values_default(this.tokensMap),
            grammarName: className
          });
          this.definitionErrors = this.definitionErrors.concat(validationErrors, lookaheadValidationErrors);
        }
      });
      if (isEmpty_default(this.definitionErrors)) {
        if (this.recoveryEnabled) {
          this.TRACE_INIT("computeAllProdsFollows", () => {
            const allFollows = computeAllProdsFollows(values_default(this.gastProductionsCache));
            this.resyncFollows = allFollows;
          });
        }
        this.TRACE_INIT("ComputeLookaheadFunctions", () => {
          var _a, _b;
          (_b = (_a = this.lookaheadStrategy).initialize) === null || _b === undefined || _b.call(_a, {
            rules: values_default(this.gastProductionsCache)
          });
          this.preComputeLookaheadFunctions(values_default(this.gastProductionsCache));
        });
      }
      if (!Parser.DEFER_DEFINITION_ERRORS_HANDLING && !isEmpty_default(this.definitionErrors)) {
        defErrorsMsgs = map_default(this.definitionErrors, (defError) => defError.message);
        throw new Error(`Parser Definition Errors detected:
 ${defErrorsMsgs.join(`
-------------------------------
`)}`);
      }
    });
  }
  constructor(tokenVocabulary, config) {
    this.definitionErrors = [];
    this.selfAnalysisDone = false;
    const that = this;
    that.initErrorHandler(config);
    that.initLexerAdapter();
    that.initLooksAhead(config);
    that.initRecognizerEngine(tokenVocabulary, config);
    that.initRecoverable(config);
    that.initTreeBuilder(config);
    that.initContentAssist();
    that.initGastRecorder(config);
    that.initPerformanceTracer(config);
    if (has_default(config, "ignoredIssues")) {
      throw new Error(`The <ignoredIssues> IParserConfig property has been deprecated.
	` + `Please use the <IGNORE_AMBIGUITIES> flag on the relevant DSL method instead.
	` + `See: https://chevrotain.io/docs/guide/resolving_grammar_errors.html#IGNORING_AMBIGUITIES
	` + "For further details.");
    }
    this.skipValidations = has_default(config, "skipValidations") ? config.skipValidations : DEFAULT_PARSER_CONFIG.skipValidations;
  }
}
Parser.DEFER_DEFINITION_ERRORS_HANDLING = false;
applyMixins(Parser, [
  Recoverable,
  LooksAhead,
  TreeBuilder,
  LexerAdapter,
  RecognizerEngine,
  RecognizerApi,
  ErrorHandler,
  ContentAssist,
  GastRecorder,
  PerformanceTracer
]);

class CstParser extends Parser {
  constructor(tokenVocabulary, config = DEFAULT_PARSER_CONFIG) {
    const configClone = clone_default(config);
    configClone.outputCst = true;
    super(tokenVocabulary, configClone);
  }
}
// ../../node_modules/mermaid/dist/chunks/mermaid.core/usecaseDiagram-POWQR4AR.mjs
function runChevrotainParse(config, input) {
  const lexResult = config.lexer.tokenize(input);
  if (lexResult.errors.length > 0) {
    const lexError = lexResult.errors[0];
    const start = Number.isFinite(lexError.offset) ? lexError.offset : input.length;
    const end = start + (Number.isFinite(lexError.length) ? lexError.length : 0);
    throw new Error(`Error lexing ${config.diagramType} diagram: ${lexError.message} at line ${lexError.line ?? 1}, column ${lexError.column ?? 1} [${start},${end})`);
  }
  config.parser.input = lexResult.tokens;
  const cst = config.entry();
  if (config.parser.errors.length > 0) {
    throw new Error(`Error parsing ${config.diagramType} diagram: ${config.parser.errors[0].message}`);
  }
  config.visit(cst);
}
__name(runChevrotainParse, "runChevrotainParse");
var ARROW_TYPE = {
  SOLID_ARROW: 0,
  BACK_ARROW: 1,
  LINE_SOLID: 2,
  CIRCLE_ARROW: 3,
  CROSS_ARROW: 4,
  CIRCLE_ARROW_REVERSED: 5,
  CROSS_ARROW_REVERSED: 6
};
var DEFAULT_DIRECTION = "LR";
var DEFAULT_USECASE_CONFIG = defaultConfig_default.usecase;
var createModel = /* @__PURE__ */ __name(() => ({
  actors: /* @__PURE__ */ new Map,
  useCases: /* @__PURE__ */ new Map,
  systemBoundaries: /* @__PURE__ */ new Map,
  relationships: [],
  notes: /* @__PURE__ */ new Map,
  jsonNodes: /* @__PURE__ */ new Map,
  classDefs: /* @__PURE__ */ new Map,
  symbols: /* @__PURE__ */ new Map,
  direction: DEFAULT_DIRECTION,
  relationshipCounter: 0,
  noteCounter: 0,
  accTitle: "",
  accDescription: "",
  ast: undefined,
  config: structuredClone(DEFAULT_USECASE_CONFIG)
}), "createModel");
var assertCompleteModel = /* @__PURE__ */ __name((model) => {
  if (!(model.actors instanceof Map) || !(model.useCases instanceof Map) || !(model.systemBoundaries instanceof Map) || !Array.isArray(model.relationships) || !(model.notes instanceof Map) || !(model.jsonNodes instanceof Map) || !(model.classDefs instanceof Map) || !(model.symbols instanceof Map) || !["TB", "TD", "BT", "RL", "LR"].includes(model.direction) || !Number.isSafeInteger(model.relationshipCounter) || model.relationshipCounter < 0 || !Number.isSafeInteger(model.noteCounter) || model.noteCounter < 0 || typeof model.accTitle !== "string" || typeof model.accDescription !== "string" || !model.config) {
    throw new Error("Cannot commit an incomplete usecase model");
  }
}, "assertCompleteModel");
var state = createModel();
var getConfig3 = /* @__PURE__ */ __name(() => structuredClone(state.config), "getConfig");
var getAST = /* @__PURE__ */ __name(() => state.ast, "getAST");
var commit = /* @__PURE__ */ __name((model) => {
  const nextState = structuredClone(model);
  assertCompleteModel(nextState);
  const previousAccTitle = getAccTitle();
  const previousAccDescription = getAccDescription();
  try {
    setAccTitle(nextState.accTitle);
    setAccDescription(nextState.accDescription);
    state = nextState;
  } catch (error) {
    setAccTitle(previousAccTitle);
    setAccDescription(previousAccDescription);
    throw error;
  }
}, "commit");
var clear2 = /* @__PURE__ */ __name(() => {
  state = createModel();
  clear();
}, "clear");
var getActors = /* @__PURE__ */ __name(() => state.actors, "getActors");
var getActor = /* @__PURE__ */ __name((id) => state.actors.get(id), "getActor");
var getUseCases = /* @__PURE__ */ __name(() => state.useCases, "getUseCases");
var getUseCase = /* @__PURE__ */ __name((id) => state.useCases.get(id), "getUseCase");
var getSystemBoundaries = /* @__PURE__ */ __name(() => state.systemBoundaries, "getSystemBoundaries");
var getSystemBoundary = /* @__PURE__ */ __name((id) => state.systemBoundaries.get(id), "getSystemBoundary");
var getRelationships = /* @__PURE__ */ __name(() => state.relationships, "getRelationships");
var getNotes = /* @__PURE__ */ __name(() => state.notes, "getNotes");
var getNote = /* @__PURE__ */ __name((id) => state.notes.get(id), "getNote");
var getJsonNodes = /* @__PURE__ */ __name(() => state.jsonNodes, "getJsonNodes");
var getJsonNode = /* @__PURE__ */ __name((id) => state.jsonNodes.get(id), "getJsonNode");
var getClassDefs = /* @__PURE__ */ __name(() => state.classDefs, "getClassDefs");
var getClassDef = /* @__PURE__ */ __name((id) => state.classDefs.get(id), "getClassDef");
var getDirection = /* @__PURE__ */ __name(() => state.direction, "getDirection");
var getCompiledStyles = /* @__PURE__ */ __name((classNames2) => {
  const compiled = /* @__PURE__ */ new Map;
  for (const className of ["default", ...classNames2]) {
    const definition = state.classDefs.get(className);
    if (!definition) {
      continue;
    }
    for (const rawStyle of definition.styles) {
      const style = rawStyle.trim();
      const separator = style.indexOf(":");
      const property2 = (separator === -1 ? style : style.slice(0, separator)).trim();
      if (property2) {
        compiled.set(property2, style);
      }
    }
  }
  return [...compiled.values()];
}, "getCompiledStyles");
var escapeJsonPointerPart = /* @__PURE__ */ __name((part) => part.replaceAll("~", "~0").replaceAll("/", "~1"), "escapeJsonPointerPart");
var displayJsonScalar = /* @__PURE__ */ __name((value) => typeof value === "string" ? value : value === null ? "null" : String(value), "displayJsonScalar");
var flattenJsonRows = /* @__PURE__ */ __name((value, propertyOrder, sanitize = (cell) => cell) => {
  const rows = [];
  const append = /* @__PURE__ */ __name((key, accessibleKey, cellValue) => {
    rows.push({
      key: sanitize(key),
      accessibleKey: sanitize(accessibleKey),
      value: sanitize(cellValue)
    });
  }, "append");
  const visit = /* @__PURE__ */ __name((current, path, pointer) => {
    if (Array.isArray(current)) {
      if (current.length === 0) {
        append(path, path, "[]");
        return;
      }
      const scalarArray = current.every((item) => item === null || ["string", "number", "boolean"].includes(typeof item));
      if (scalarArray) {
        for (const [index, element] of current.entries()) {
          append(index === 0 ? path : "", path, displayJsonScalar(element));
        }
        return;
      }
      for (const [index, element] of current.entries()) {
        visit(element, `${path}[${index}]`, `${pointer}/${index}`);
      }
      return;
    }
    if (current !== null && typeof current === "object") {
      const object = current;
      const keys2 = propertyOrder[pointer] ?? Object.keys(object);
      if (keys2.length === 0) {
        append(path, path, "{}");
        return;
      }
      for (const key of keys2) {
        const childPath = path ? `${path}.${key}` : key;
        visit(object[key], childPath, `${pointer}/${escapeJsonPointerPart(key)}`);
      }
      return;
    }
    append(path, path, displayJsonScalar(current));
  }, "visit");
  visit(value, "", "");
  return rows;
}, "flattenJsonRows");
var actorShape = /* @__PURE__ */ __name((actor) => {
  switch (actor.type) {
    case "hollow":
      return "usecaseActorHollow";
    case "awesome":
      return "usecaseActorAwesome";
    case "icon":
      return "usecaseActorIcon";
    case "normal":
      return "usecaseActor";
  }
}, "actorShape");
var useCaseShape = /* @__PURE__ */ __name((useCase) => {
  if (useCase.shape === "ellipse") {
    return useCase.business ? "usecaseBusiness" : "usecaseEllipse";
  }
  return useCase.shape;
}, "useCaseShape");
var associationMarkers = /* @__PURE__ */ __name((arrowType) => {
  switch (arrowType) {
    case ARROW_TYPE.SOLID_ARROW:
      return { arrowTypeStart: "none", arrowTypeEnd: "arrow_point" };
    case ARROW_TYPE.BACK_ARROW:
      return { arrowTypeStart: "arrow_point", arrowTypeEnd: "none" };
    case ARROW_TYPE.CIRCLE_ARROW:
      return { arrowTypeStart: "none", arrowTypeEnd: "arrow_circle" };
    case ARROW_TYPE.CROSS_ARROW:
      return { arrowTypeStart: "none", arrowTypeEnd: "arrow_cross" };
    case ARROW_TYPE.CIRCLE_ARROW_REVERSED:
      return { arrowTypeStart: "arrow_circle", arrowTypeEnd: "none" };
    case ARROW_TYPE.CROSS_ARROW_REVERSED:
      return { arrowTypeStart: "arrow_cross", arrowTypeEnd: "none" };
    case ARROW_TYPE.LINE_SOLID:
      return { arrowTypeStart: "none", arrowTypeEnd: "none" };
  }
}, "associationMarkers");
var relationshipVisuals = /* @__PURE__ */ __name((relationship) => {
  switch (relationship.type) {
    case "include":
    case "extend":
      return {
        arrowTypeStart: "none",
        arrowTypeEnd: "arrow_point",
        pattern: "dotted",
        label: relationship.type,
        labelType: "text"
      };
    case "generalization":
      return {
        arrowTypeStart: "none",
        arrowTypeEnd: "extension",
        pattern: "solid"
      };
    case "association":
      return {
        ...associationMarkers(relationship.arrowType),
        pattern: "solid",
        ...relationship.label ? { label: relationship.label } : {},
        ...relationship.labelType ? { labelType: relationship.labelType } : {}
      };
  }
}, "relationshipVisuals");
var animationClasses = /* @__PURE__ */ __name((relationship) => relationship.animate || relationship.animation ? [`edge-animation-${relationship.animation ?? "fast"}`] : [], "animationClasses");
var classNames = /* @__PURE__ */ __name((...names) => names.filter((name) => Boolean(name)).join(" "), "classNames");
var getData = /* @__PURE__ */ __name(() => {
  const globalConfig = getConfig2();
  const config = {
    ...state.config,
    ...globalConfig.usecase
  };
  const sanitize = /* @__PURE__ */ __name((value) => sanitizeText(value, globalConfig), "sanitize");
  const endpointLabel = /* @__PURE__ */ __name((id) => sanitize(state.actors.get(id)?.label ?? state.useCases.get(id)?.label ?? state.jsonNodes.get(id)?.id ?? state.notes.get(id)?.label ?? id), "endpointLabel");
  const nodes = [];
  const edges = [];
  let colorIndex = 0;
  let boundaryColorIndex = 0;
  for (const actor of state.actors.values()) {
    nodes.push({
      id: actor.id,
      label: sanitize(actor.label),
      labelType: actor.labelType,
      shape: actorShape(actor),
      isGroup: false,
      padding: 10,
      look: globalConfig.look,
      colorIndex: colorIndex++,
      cssClasses: classNames("default", "usecase-actor", `usecase-actor-${actor.type}`, actor.business && "usecase-business", ...actor.classes),
      cssStyles: [...actor.styles],
      cssCompiledStyles: getCompiledStyles(actor.classes),
      actorType: actor.type,
      business: actor.business,
      ...actor.icon ? { icon: actor.icon } : {},
      ...actor.stereotype ? { stereotype: sanitize(actor.stereotype) } : {},
      ...actor.parentId ? { parentId: actor.parentId } : {}
    });
  }
  for (const useCase of state.useCases.values()) {
    nodes.push({
      id: useCase.id,
      label: sanitize(useCase.label),
      labelType: useCase.labelType,
      shape: useCaseShape(useCase),
      isGroup: false,
      padding: useCase.shape === "ellipse" ? 20 : 10,
      look: globalConfig.look,
      colorIndex: colorIndex++,
      cssClasses: classNames("default", "usecase-element", `usecase-${useCase.shape}`, useCase.business && "usecase-business", ...useCase.classes),
      cssStyles: [...useCase.styles],
      cssCompiledStyles: getCompiledStyles(useCase.classes),
      business: useCase.business,
      ...useCase.stereotype ? { stereotype: sanitize(useCase.stereotype) } : {},
      ...useCase.parentId ? { parentId: useCase.parentId } : {}
    });
  }
  for (const note of state.notes.values()) {
    nodes.push({
      id: note.id,
      label: sanitize(note.label),
      labelType: note.labelType,
      shape: "note",
      isGroup: false,
      padding: 10,
      look: globalConfig.look,
      cssClasses: "default usecase-note",
      cssStyles: [],
      cssCompiledStyles: getCompiledStyles([]),
      noteTarget: note.target,
      noteTargetLabel: sanitize(state.actors.get(note.target)?.label ?? state.useCases.get(note.target)?.label ?? state.jsonNodes.get(note.target)?.id ?? note.target)
    });
  }
  for (const json of state.jsonNodes.values()) {
    nodes.push({
      id: json.id,
      label: sanitize(json.id),
      labelType: "text",
      shape: "usecaseJsonTable",
      isGroup: false,
      padding: 10,
      look: globalConfig.look,
      cssClasses: classNames("default", "usecase-json-table", ...json.classes),
      cssStyles: [...json.styles],
      cssCompiledStyles: getCompiledStyles(json.classes),
      jsonRows: flattenJsonRows(json.value, json.propertyOrder, sanitize)
    });
  }
  for (const boundary of state.systemBoundaries.values()) {
    nodes.push({
      id: boundary.id,
      label: sanitize(boundary.label),
      labelType: boundary.labelType,
      shape: "usecaseSystemBoundary",
      isGroup: true,
      padding: 20,
      look: globalConfig.look,
      colorIndex: boundaryColorIndex++,
      cssClasses: classNames("default", "system-boundary", `system-boundary-${boundary.type}`, ...boundary.classes),
      cssStyles: [...boundary.styles],
      cssCompiledStyles: getCompiledStyles(boundary.classes),
      boundaryType: boundary.type
    });
  }
  for (const relationship of state.relationships) {
    const { label: rawLabel, ...visual } = relationshipVisuals(relationship);
    edges.push({
      id: relationship.id,
      start: relationship.source,
      end: relationship.target,
      source: relationship.source,
      target: relationship.target,
      sourceLabel: endpointLabel(relationship.source),
      targetLabel: endpointLabel(relationship.target),
      type: "edge",
      relationshipType: relationship.type,
      internal: false,
      ...visual,
      ...rawLabel !== undefined ? { label: sanitize(rawLabel) } : {},
      labelpos: "c",
      classes: classNames("default", "relationship", `relationship-${relationship.type}`, ...relationship.classes, ...animationClasses(relationship)),
      style: [...relationship.styles],
      cssCompiledStyles: getCompiledStyles(relationship.classes),
      animate: relationship.animate,
      ...relationship.animation ? { animation: relationship.animation } : {},
      look: globalConfig.look,
      thickness: "normal",
      minlen: relationship.minlen,
      isUserDefinedId: relationship.explicitId
    });
  }
  for (const note of state.notes.values()) {
    edges.push({
      id: `${note.id}-edge`,
      start: note.id,
      end: note.target,
      source: note.id,
      target: note.target,
      type: "edge",
      relationshipType: "note",
      sourceLabel: endpointLabel(note.id),
      targetLabel: endpointLabel(note.target),
      internal: true,
      pattern: "dotted",
      arrowTypeStart: "none",
      arrowTypeEnd: "none",
      labelpos: "c",
      classes: "default relationship relationship-note",
      style: [],
      cssCompiledStyles: getCompiledStyles([]),
      animate: false,
      look: globalConfig.look,
      thickness: "normal",
      minlen: 1,
      isUserDefinedId: false
    });
  }
  for (const node of nodes) {
    node.wrappingWidth ??= config.wrappingWidth;
    if (!node.isGroup && !node.shape.startsWith("usecaseActor")) {
      node.minWidth ??= config.minNodeWidth;
    }
    if (node.shape === "usecaseEllipse" || node.shape === "usecaseBusiness") {
      node.spreadPorts = true;
    }
  }
  return {
    nodes,
    edges,
    config: globalConfig,
    type: "usecase",
    layoutAlgorithm: "dagre",
    direction: getDirection(),
    nodeSpacing: config.nodeSpacing,
    rankSpacing: config.rankSpacing,
    actorFontSize: config.actorFontSize,
    actorFontFamily: config.actorFontFamily,
    actorFontWeight: config.actorFontWeight,
    usecaseFontSize: config.usecaseFontSize,
    usecaseFontFamily: config.usecaseFontFamily,
    usecaseFontWeight: config.usecaseFontWeight,
    diagramPadding: config.diagramPadding,
    useMaxWidth: config.useMaxWidth,
    markers: ["point", "circle", "cross", "extension"]
  };
}, "getData");
var db = {
  getConfig: getConfig3,
  createModel,
  commit,
  getAST,
  clear: clear2,
  setDiagramTitle,
  getDiagramTitle,
  setAccTitle,
  getAccTitle,
  setAccDescription,
  getAccDescription,
  getActors,
  getActor,
  getUseCases,
  getUseCase,
  getSystemBoundaries,
  getSystemBoundary,
  getRelationships,
  getNotes,
  getNote,
  getJsonNodes,
  getJsonNode,
  getClassDefs,
  getClassDef,
  getDirection,
  getData
};
function customMatch(text, offset, image) {
  const match = [image];
  match.index = offset;
  match.input = text;
  return match;
}
__name(customMatch, "customMatch");
var matchMarkdownString = /* @__PURE__ */ __name((text, offset) => {
  if (text[offset] !== '"' || text[offset + 1] !== "`") {
    return null;
  }
  for (let index = offset + 2;index < text.length - 1; index++) {
    if (text[index] === "`" && text[index + 1] === '"') {
      return customMatch(text, offset, text.slice(offset, index + 2));
    }
  }
  return null;
}, "matchMarkdownString");
var matchComment = /* @__PURE__ */ __name((text, offset) => {
  if (text[offset] !== "%" || text[offset + 1] !== "%") {
    return null;
  }
  for (let index = offset - 1;index >= 0; index--) {
    const character = text[index];
    if (character === `
` || character === "\r") {
      break;
    }
    if (character !== " " && character !== "\t") {
      return null;
    }
  }
  let end = offset + 2;
  while (end < text.length && text[end] !== `
` && text[end] !== "\r") {
    end++;
  }
  return customMatch(text, offset, text.slice(offset, end));
}, "matchComment");
var isIndentedLineStart = /* @__PURE__ */ __name((text, offset) => {
  for (let index = offset - 1;index >= 0; index--) {
    const character = text[index];
    if (character === `
` || character === "\r") {
      return true;
    }
    if (character !== " " && character !== "\t") {
      return false;
    }
  }
  return true;
}, "isIndentedLineStart");
var matchAccessibilityLine = /* @__PURE__ */ __name((text, offset, pattern) => {
  if (!isIndentedLineStart(text, offset)) {
    return null;
  }
  const match = pattern.exec(text.slice(offset));
  return match ? customMatch(text, offset, match[0]) : null;
}, "matchAccessibilityLine");
var matchAccDescrBlock = /* @__PURE__ */ __name((text, offset) => {
  if (!isIndentedLineStart(text, offset)) {
    return null;
  }
  const opening = /^accDescr[\t ]*{/.exec(text.slice(offset));
  if (!opening) {
    return null;
  }
  const end = text.indexOf("}", offset + opening[0].length);
  return end === -1 ? null : customMatch(text, offset, text.slice(offset, end + 1));
}, "matchAccDescrBlock");
var matchJsonObject = /* @__PURE__ */ __name((text, offset) => {
  if (text[offset] !== "{") {
    return null;
  }
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = offset;index < text.length; index++) {
    const character = text[index];
    if (quoted) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        quoted = false;
      }
      continue;
    }
    if (character === '"') {
      quoted = true;
    } else if (character === "{") {
      depth++;
    } else if (character === "}" && --depth === 0) {
      return customMatch(text, offset, text.slice(offset, index + 1));
    }
  }
  return null;
}, "matchJsonObject");
var matchStereotypeText = /* @__PURE__ */ __name((text, offset) => {
  const end = text.indexOf(">>", offset);
  if (end === -1 || /[\n\r]/.test(text.slice(offset, end))) {
    return null;
  }
  const image = text.slice(offset, end);
  return image.trim() ? customMatch(text, offset, image) : null;
}, "matchStereotypeText");
var LabelText = createToken({ name: "LABEL_TEXT", pattern: Lexer.NA });
var Word = createToken({ name: "WORD", pattern: Lexer.NA, categories: LabelText });
var NumberLiteral = createToken({
  name: "NUMBER",
  pattern: /(?:\d+\.\d+|\d+|\.\d+)(?:[A-Za-z]+)?/,
  categories: LabelText
});
var Identifier = createToken({
  name: "IDENTIFIER",
  pattern: /\w+/,
  longer_alt: NumberLiteral,
  categories: Word
});
var WhiteSpace = createToken({
  name: "HWS",
  pattern: /[\t ]+/,
  group: Lexer.SKIPPED
});
var MarkdownString = createToken({
  name: "MARKDOWN_STRING",
  pattern: matchMarkdownString,
  start_chars_hint: ['"'],
  line_breaks: true
});
var UnclosedMarkdownString = createToken({
  name: "UNCLOSED_MARKDOWN_STRING",
  pattern: /"`[^]*/,
  line_breaks: true
});
var Comment = createToken({
  name: "COMMENT",
  pattern: matchComment,
  start_chars_hint: ["%"],
  line_breaks: false
});
var NewLine = createToken({
  name: "NEWLINE",
  pattern: /\r\n|\n|\r/,
  line_breaks: true
});
var AccDescrBlock = createToken({
  name: "ACC_DESCR_BLOCK",
  pattern: matchAccDescrBlock,
  start_chars_hint: ["a"],
  line_breaks: true
});
var accTitleLinePattern = /^accTitle[\t ]*:[^\n\r]*/;
var accDescrLinePattern = /^accDescr[\t ]*:[^\n\r]*/;
var AccTitleLine = createToken({
  name: "ACC_TITLE_LINE",
  pattern: /* @__PURE__ */ __name((text, offset) => matchAccessibilityLine(text, offset, accTitleLinePattern), "pattern"),
  start_chars_hint: ["a"],
  line_breaks: false
});
var AccDescrLine = createToken({
  name: "ACC_DESCR_LINE",
  pattern: /* @__PURE__ */ __name((text, offset) => matchAccessibilityLine(text, offset, accDescrLinePattern), "pattern"),
  start_chars_hint: ["a"],
  line_breaks: false
});
var JsonDeclarationStart = createToken({
  name: "JSON_DECLARATION_START",
  pattern: /json[\t ]+\w+[\t ]*@[\t ]*(?={)/,
  push_mode: "jsonBody"
});
var JsonObjectLiteral = createToken({
  name: "JSON_OBJECT_LITERAL",
  pattern: matchJsonObject,
  start_chars_hint: ["{"],
  line_breaks: true,
  pop_mode: true
});
var UnclosedJsonObjectLiteral = createToken({
  name: "UNCLOSED_JSON_OBJECT_LITERAL",
  pattern: /{[^]*/,
  line_breaks: true,
  pop_mode: true
});
var keyword = /* @__PURE__ */ __name((name, pattern) => createToken({ name, pattern, longer_alt: Identifier, categories: Word }), "keyword");
var Usecase = keyword("USECASE", /usecase-beta/);
var Actor = keyword("ACTOR", /actor/);
var SystemBoundary = keyword("SYSTEM_BOUNDARY", /systemBoundary/);
var End = keyword("END", /end/);
var Direction = keyword("DIRECTION", /direction/);
var Td = keyword("TD", /TD/);
var Tb = keyword("TB", /TB/);
var Bt = keyword("BT", /BT/);
var Lr = keyword("LR", /LR/);
var Rl = keyword("RL", /RL/);
var Note = keyword("NOTE", /note/);
var For = keyword("FOR", /for/);
var Json = keyword("JSON", /json/);
var ClassDef = keyword("CLASS_DEF", /classDef/);
var Class = keyword("CLASS", /class/);
var Style = keyword("STYLE", /style/);
var Include = keyword("INCLUDE", /include/i);
var Extend = keyword("EXTEND", /extend/i);
var True = keyword("TRUE", /true/);
var False = keyword("FALSE", /false/);
var Generalization = createToken({ name: "GENERALIZATION", pattern: /--\|>/ });
var DependencyArrow = createToken({ name: "DEPENDENCY_ARROW", pattern: /\.\.>/ });
var StereotypeStart = createToken({
  name: "STEREOTYPE_START",
  pattern: /<</,
  push_mode: "stereotype"
});
var StereotypeEnd = createToken({
  name: "STEREOTYPE_END",
  pattern: />>/,
  pop_mode: true
});
var StereotypeText = createToken({
  name: "STEREOTYPE_TEXT",
  pattern: matchStereotypeText,
  line_breaks: false
});
var UnclosedStereotypeText = createToken({
  name: "UNCLOSED_STEREOTYPE_TEXT",
  pattern: /[^\n\r]+/,
  line_breaks: false,
  pop_mode: true
});
var ClassSeparator = createToken({ name: "CLASS_SEPARATOR", pattern: /:::/ });
var ForwardSolid = createToken({ name: "FORWARD_SOLID", pattern: /--+>/ });
var BackwardSolid = createToken({ name: "BACKWARD_SOLID", pattern: /<--+/ });
var ForwardCircle = createToken({ name: "FORWARD_CIRCLE", pattern: /--o/ });
var BackwardCircle = createToken({ name: "BACKWARD_CIRCLE", pattern: /o--/ });
var ForwardCross = createToken({ name: "FORWARD_CROSS", pattern: /--x/ });
var BackwardCross = createToken({ name: "BACKWARD_CROSS", pattern: /x--/ });
var MarkerlessSolid = createToken({ name: "MARKERLESS_SOLID", pattern: /--+/ });
var MetadataStart = createToken({ name: "METADATA_START", pattern: /@{/ });
var At = createToken({ name: "AT", pattern: /@/, categories: LabelText });
var LeftBrace = createToken({ name: "LBRACE", pattern: /{/ });
var RightBrace = createToken({ name: "RBRACE", pattern: /}/ });
var LeftBracket = createToken({ name: "LBRACKET", pattern: /\[/ });
var RightBracket = createToken({ name: "RBRACKET", pattern: /]/ });
var LeftParen = createToken({ name: "LPAREN", pattern: /\(/ });
var RightParen = createToken({ name: "RPAREN", pattern: /\)/ });
var Comma = createToken({ name: "COMMA", pattern: /,/, categories: LabelText });
var Colon = createToken({ name: "COLON", pattern: /:/, categories: LabelText });
var HashColor = createToken({
  name: "HASH_COLOR",
  pattern: /#[\dA-Fa-f]+/,
  categories: LabelText
});
var PlainString = createToken({
  name: "PLAIN_STRING",
  pattern: /"[^\n\r"]*"|'[^\n\r']*'/
});
var CssIdentifier = createToken({
  name: "CSS_IDENTIFIER",
  pattern: /--[A-Z_a-z][\w-]*|[A-Z_a-z]\w*(?:-\w+)+/,
  categories: LabelText
});
var CssEscapedComma = createToken({
  name: "CSS_ESCAPED_COMMA",
  pattern: /\\,/,
  categories: LabelText
});
var Dash = createToken({ name: "DASH", pattern: /-/, categories: LabelText });
var Dot = createToken({ name: "DOT", pattern: /\./, categories: LabelText });
var Percent = createToken({ name: "PERCENT", pattern: /%/, categories: LabelText });
var CssPunctuation = createToken({
  name: "CSS_PUNCTUATION",
  pattern: /[!#$&*+/=?^_|~]/,
  categories: LabelText
});
var LabelPunctuation = createToken({
  name: "LABEL_PUNCTUATION",
  pattern: /[;<>\\`]/,
  categories: LabelText
});
var LabelSymbol = createToken({
  name: "LABEL_SYMBOL",
  pattern: /[^\t\n\r !-~]+/,
  categories: LabelText
});
var defaultModeTokens = [
  LabelText,
  Word,
  WhiteSpace,
  MarkdownString,
  UnclosedMarkdownString,
  Comment,
  NewLine,
  AccDescrBlock,
  AccTitleLine,
  AccDescrLine,
  JsonDeclarationStart,
  Usecase,
  Actor,
  SystemBoundary,
  End,
  Direction,
  Td,
  Tb,
  Bt,
  Lr,
  Rl,
  Note,
  For,
  Json,
  ClassDef,
  Class,
  Style,
  Include,
  Extend,
  True,
  False,
  Generalization,
  DependencyArrow,
  StereotypeStart,
  ClassSeparator,
  ForwardSolid,
  BackwardSolid,
  ForwardCircle,
  BackwardCircle,
  ForwardCross,
  BackwardCross,
  MarkerlessSolid,
  MetadataStart,
  At,
  LeftBrace,
  RightBrace,
  LeftBracket,
  RightBracket,
  LeftParen,
  RightParen,
  Comma,
  Colon,
  HashColor,
  PlainString,
  CssIdentifier,
  Identifier,
  NumberLiteral,
  CssEscapedComma,
  Dash,
  Dot,
  Percent,
  CssPunctuation,
  LabelPunctuation,
  LabelSymbol
];
var usecaseLexerModes = {
  defaultMode: "defaultMode",
  modes: {
    defaultMode: [...defaultModeTokens],
    jsonBody: [JsonObjectLiteral, UnclosedJsonObjectLiteral],
    stereotype: [StereotypeEnd, StereotypeText, UnclosedStereotypeText]
  }
};
var usecaseTokens = [
  ...defaultModeTokens,
  JsonObjectLiteral,
  UnclosedJsonObjectLiteral,
  StereotypeEnd,
  StereotypeText,
  UnclosedStereotypeText
];
var usecaseLexer = new Lexer(usecaseLexerModes);
var isLabelToken = /* @__PURE__ */ __name((token) => tokenMatcher(token, LabelText) || token.tokenType === PlainString || token.tokenType === MarkdownString, "isLabelToken");
var forbiddenPlantUmlStatements = {
  allowmixing: true,
  newpage: true,
  package: true,
  rectangle: true,
  skinparam: true
};
var UsecaseParser = class extends CstParser {
  static {
    __name(this, "UsecaseParser");
  }
  constructor() {
    super(usecaseTokens, { nodeLocationTracking: "full" });
    this.RULE("start", () => {
      this.CONSUME(Usecase);
      this.SUBRULE(this.lineEnd);
      this.MANY(() => this.SUBRULE(this.line));
    });
    this.RULE("line", () => {
      this.OR([
        { ALT: /* @__PURE__ */ __name(() => this.SUBRULE(this.blankLine), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.SUBRULE(this.commentLine), "ALT") },
        {
          GATE: /* @__PURE__ */ __name(() => this.isStatementStart(), "GATE"),
          ALT: /* @__PURE__ */ __name(() => this.SUBRULE(this.statement), "ALT")
        }
      ]);
    });
    this.RULE("statement", () => {
      this.OR([
        { ALT: /* @__PURE__ */ __name(() => this.SUBRULE(this.accTitleStatement), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.SUBRULE(this.accDescrStatement), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.SUBRULE(this.directionStatement), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.SUBRULE(this.actorStatement), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.SUBRULE(this.systemBoundaryStatement), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.SUBRULE(this.noteStatement), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.SUBRULE(this.jsonStatement), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.SUBRULE(this.classDefStatement), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.SUBRULE(this.classStatement), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.SUBRULE(this.styleStatement), "ALT") },
        {
          GATE: /* @__PURE__ */ __name(() => this.isMetadataAssignment(), "GATE"),
          ALT: /* @__PURE__ */ __name(() => this.SUBRULE(this.metadataAssignmentStatement), "ALT")
        },
        {
          GATE: /* @__PURE__ */ __name(() => !this.isForbiddenPlantUmlStatement(), "GATE"),
          ALT: /* @__PURE__ */ __name(() => this.SUBRULE(this.entityStatement), "ALT")
        }
      ]);
    });
    this.RULE("lineEnd", () => {
      this.OR([{ ALT: /* @__PURE__ */ __name(() => this.CONSUME(NewLine), "ALT") }, { ALT: /* @__PURE__ */ __name(() => this.CONSUME(EOF), "ALT") }]);
    });
    this.RULE("blankLine", () => {
      this.CONSUME(NewLine);
    });
    this.RULE("commentLine", () => {
      this.CONSUME(Comment);
      this.SUBRULE(this.lineEnd);
    });
    this.RULE("accTitleStatement", () => {
      this.CONSUME(AccTitleLine);
      this.SUBRULE(this.lineEnd);
    });
    this.RULE("accDescrStatement", () => {
      this.OR([
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME(AccDescrLine), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME(AccDescrBlock), "ALT") }
      ]);
      this.SUBRULE(this.lineEnd);
    });
    this.RULE("actorStatement", () => {
      this.CONSUME(Actor);
      this.SUBRULE(this.actorItem);
      this.OPTION(() => {
        this.OR([
          {
            ALT: /* @__PURE__ */ __name(() => this.AT_LEAST_ONE(() => {
              this.CONSUME(Comma);
              this.SUBRULE2(this.actorItem);
            }), "ALT")
          },
          { ALT: /* @__PURE__ */ __name(() => this.SUBRULE(this.relationTail), "ALT") }
        ]);
      });
      this.SUBRULE(this.lineEnd);
    });
    this.RULE("actorItem", () => {
      this.SUBRULE(this.actorName);
      this.OPTION(() => this.SUBRULE(this.metadata));
      this.OPTION2(() => this.SUBRULE(this.stereotype));
      this.OPTION3(() => this.SUBRULE(this.classSuffix));
    });
    this.RULE("actorName", () => {
      this.OR([
        {
          ALT: /* @__PURE__ */ __name(() => {
            this.CONSUME(Identifier);
            this.OPTION(() => {
              this.CONSUME(LeftParen);
              this.SUBRULE(this.nodeLabel);
              this.CONSUME(RightParen);
            });
          }, "ALT")
        },
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME(PlainString), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME(MarkdownString), "ALT") }
      ]);
    });
    this.RULE("actorDeclarationOnly", () => {
      this.CONSUME(Actor);
      this.SUBRULE(this.actorItem);
      this.MANY(() => {
        this.CONSUME(Comma);
        this.SUBRULE2(this.actorItem);
      });
      this.SUBRULE(this.lineEnd);
    });
    this.RULE("entityStatement", () => {
      this.SUBRULE(this.entityName);
      this.OPTION(() => this.SUBRULE(this.relationTail));
      this.SUBRULE(this.lineEnd);
    });
    this.RULE("entityName", () => {
      this.OR([
        {
          ALT: /* @__PURE__ */ __name(() => {
            this.CONSUME(Identifier);
            this.OPTION(() => {
              this.OR2([
                {
                  ALT: /* @__PURE__ */ __name(() => {
                    this.CONSUME(LeftParen);
                    this.SUBRULE(this.nodeLabel);
                    this.CONSUME(RightParen);
                  }, "ALT")
                },
                {
                  ALT: /* @__PURE__ */ __name(() => {
                    this.CONSUME(LeftBracket);
                    this.SUBRULE2(this.nodeLabel);
                    this.CONSUME(RightBracket);
                  }, "ALT")
                }
              ]);
            });
          }, "ALT")
        },
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME(PlainString), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME(MarkdownString), "ALT") }
      ]);
      this.OPTION2(() => this.SUBRULE(this.useCaseMetadata));
      this.OPTION3(() => this.SUBRULE(this.stereotype));
      this.OPTION4(() => this.SUBRULE(this.classSuffix));
    });
    this.RULE("nodeLabel", () => {
      this.OR([
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME(PlainString), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME(MarkdownString), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.AT_LEAST_ONE(() => this.CONSUME(LabelText)), "ALT") }
      ]);
    });
    this.RULE("useCaseMetadata", () => {
      this.SUBRULE(this.metadata);
    });
    this.RULE("relationTail", () => {
      this.OPTION({
        GATE: /* @__PURE__ */ __name(() => this.LA(1).tokenType === Identifier && this.LA(2).tokenType === At, "GATE"),
        DEF: /* @__PURE__ */ __name(() => {
          this.CONSUME(Identifier);
          this.CONSUME(At);
        }, "DEF")
      });
      this.SUBRULE(this.arrow);
      this.SUBRULE(this.entityName);
    });
    this.RULE("arrow", () => {
      this.OR([
        { ALT: /* @__PURE__ */ __name(() => this.SUBRULE(this.semanticRelation), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.SUBRULE(this.forwardSolidOperator), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.SUBRULE(this.backwardSolidOperator), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.SUBRULE(this.markerlessSolidOperator), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.SUBRULE(this.forwardCircleOperator), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.SUBRULE(this.backwardCircleOperator), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.SUBRULE(this.forwardCrossOperator), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.SUBRULE(this.backwardCrossOperator), "ALT") }
      ]);
    });
    this.RULE("forwardSolidOperator", () => {
      this.CONSUME(ForwardSolid);
    });
    this.RULE("backwardSolidOperator", () => {
      this.CONSUME(BackwardSolid);
      this.OPTION({
        GATE: /* @__PURE__ */ __name(() => this.LA(0).image === "<--" && this.hasLabeledRight([MarkerlessSolid]), "GATE"),
        DEF: /* @__PURE__ */ __name(() => {
          this.SUBRULE(this.edgeLabel);
          this.CONSUME(MarkerlessSolid);
        }, "DEF")
      });
    });
    this.RULE("markerlessSolidOperator", () => {
      this.CONSUME(MarkerlessSolid);
      this.OPTION({
        GATE: /* @__PURE__ */ __name(() => this.LA(0).image === "--" && this.hasLabeledRight([ForwardSolid, MarkerlessSolid, ForwardCircle, ForwardCross]), "GATE"),
        DEF: /* @__PURE__ */ __name(() => {
          this.SUBRULE(this.edgeLabel);
          this.OR([
            { ALT: /* @__PURE__ */ __name(() => this.CONSUME(ForwardSolid), "ALT") },
            { ALT: /* @__PURE__ */ __name(() => this.CONSUME2(MarkerlessSolid), "ALT") },
            { ALT: /* @__PURE__ */ __name(() => this.CONSUME(ForwardCircle), "ALT") },
            { ALT: /* @__PURE__ */ __name(() => this.CONSUME(ForwardCross), "ALT") }
          ]);
        }, "DEF")
      });
    });
    this.RULE("forwardCircleOperator", () => {
      this.CONSUME(ForwardCircle);
    });
    this.RULE("backwardCircleOperator", () => {
      this.CONSUME(BackwardCircle);
      this.OPTION({
        GATE: /* @__PURE__ */ __name(() => this.hasLabeledRight([MarkerlessSolid]), "GATE"),
        DEF: /* @__PURE__ */ __name(() => {
          this.SUBRULE(this.edgeLabel);
          this.CONSUME(MarkerlessSolid);
        }, "DEF")
      });
    });
    this.RULE("forwardCrossOperator", () => {
      this.CONSUME(ForwardCross);
    });
    this.RULE("backwardCrossOperator", () => {
      this.CONSUME(BackwardCross);
      this.OPTION({
        GATE: /* @__PURE__ */ __name(() => this.hasLabeledRight([MarkerlessSolid]), "GATE"),
        DEF: /* @__PURE__ */ __name(() => {
          this.SUBRULE(this.edgeLabel);
          this.CONSUME(MarkerlessSolid);
        }, "DEF")
      });
    });
    this.RULE("edgeLabel", () => {
      this.OR([
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME(PlainString), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME(MarkdownString), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.AT_LEAST_ONE(() => this.CONSUME(LabelText)), "ALT") }
      ]);
    });
    this.RULE("semanticRelation", () => {
      this.OR([
        {
          ALT: /* @__PURE__ */ __name(() => {
            this.CONSUME(DependencyArrow);
            this.CONSUME(Colon);
            this.OR2([{ ALT: /* @__PURE__ */ __name(() => this.CONSUME(Include), "ALT") }, { ALT: /* @__PURE__ */ __name(() => this.CONSUME(Extend), "ALT") }]);
          }, "ALT")
        },
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME(Generalization), "ALT") }
      ]);
    });
    this.RULE("metadata", () => {
      this.CONSUME(MetadataStart);
      this.MANY(() => this.CONSUME(NewLine));
      this.OPTION(() => {
        this.SUBRULE(this.metadataProperty);
        this.MANY2(() => {
          this.SUBRULE(this.metadataSeparator);
          this.SUBRULE2(this.metadataProperty);
        });
        this.OPTION2(() => this.CONSUME(Comma));
        this.MANY3(() => this.CONSUME2(NewLine));
      });
      this.CONSUME(RightBrace);
    });
    this.RULE("metadataProperty", () => {
      this.OR([{ ALT: /* @__PURE__ */ __name(() => this.CONSUME(Identifier), "ALT") }, { ALT: /* @__PURE__ */ __name(() => this.CONSUME(PlainString), "ALT") }]);
      this.CONSUME(Colon);
      this.OR2([
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME2(Identifier), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME2(PlainString), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME(True), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME(False), "ALT") }
      ]);
    });
    this.RULE("metadataSeparator", () => {
      this.OR([
        {
          ALT: /* @__PURE__ */ __name(() => {
            this.CONSUME(Comma);
            this.MANY(() => this.CONSUME(NewLine));
          }, "ALT")
        },
        {
          ALT: /* @__PURE__ */ __name(() => {
            this.AT_LEAST_ONE(() => this.CONSUME2(NewLine));
            this.OPTION(() => this.CONSUME2(Comma));
            this.MANY2(() => this.CONSUME3(NewLine));
          }, "ALT")
        }
      ]);
    });
    this.RULE("systemBoundaryStatement", () => {
      this.CONSUME(SystemBoundary);
      this.SUBRULE(this.systemBoundaryName);
      this.OPTION(() => this.SUBRULE(this.metadata));
      this.OPTION2(() => this.SUBRULE(this.classSuffix));
      this.SUBRULE(this.lineEnd);
      this.SUBRULE(this.systemBoundaryContent);
      this.CONSUME(End);
      this.SUBRULE2(this.lineEnd);
    });
    this.RULE("systemBoundaryName", () => {
      this.OR([
        {
          ALT: /* @__PURE__ */ __name(() => {
            this.CONSUME(Identifier);
            this.OPTION(() => {
              this.OR2([
                {
                  ALT: /* @__PURE__ */ __name(() => {
                    this.CONSUME(LeftParen);
                    this.SUBRULE(this.nodeLabel);
                    this.CONSUME(RightParen);
                  }, "ALT")
                },
                {
                  ALT: /* @__PURE__ */ __name(() => {
                    this.CONSUME(LeftBracket);
                    this.SUBRULE2(this.nodeLabel);
                    this.CONSUME(RightBracket);
                  }, "ALT")
                }
              ]);
            });
          }, "ALT")
        },
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME(PlainString), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME(MarkdownString), "ALT") }
      ]);
    });
    this.RULE("systemBoundaryContent", () => {
      this.MANY(() => {
        this.OR([
          { ALT: /* @__PURE__ */ __name(() => this.SUBRULE(this.blankLine), "ALT") },
          { ALT: /* @__PURE__ */ __name(() => this.SUBRULE(this.commentLine), "ALT") },
          { ALT: /* @__PURE__ */ __name(() => this.SUBRULE(this.boundaryElement), "ALT") }
        ]);
      });
    });
    this.RULE("boundaryElement", () => {
      this.OR([
        { ALT: /* @__PURE__ */ __name(() => this.SUBRULE(this.actorDeclarationOnly), "ALT") },
        {
          ALT: /* @__PURE__ */ __name(() => {
            this.SUBRULE(this.entityName);
            this.SUBRULE(this.lineEnd);
          }, "ALT")
        }
      ]);
    });
    this.RULE("metadataAssignmentStatement", () => {
      this.SUBRULE(this.metadataAssignmentTarget);
      this.SUBRULE(this.metadata);
      this.SUBRULE(this.lineEnd);
    });
    this.RULE("metadataAssignmentTarget", () => {
      this.OR([
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME(Identifier), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME(PlainString), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME(MarkdownString), "ALT") }
      ]);
    });
    this.RULE("noteStatement", () => {
      this.CONSUME(Note);
      this.CONSUME(For);
      this.CONSUME(Identifier);
      this.SUBRULE(this.nodeLabel);
      this.SUBRULE(this.lineEnd);
    });
    this.RULE("stereotype", () => {
      this.CONSUME(StereotypeStart);
      this.CONSUME(StereotypeText);
      this.CONSUME(StereotypeEnd);
    });
    this.RULE("classSuffix", () => {
      this.CONSUME(ClassSeparator);
      this.CONSUME(Identifier);
      this.MANY(() => {
        this.CONSUME(Comma);
        this.CONSUME2(Identifier);
      });
    });
    this.RULE("jsonStatement", () => {
      this.CONSUME(JsonDeclarationStart);
      this.CONSUME(JsonObjectLiteral);
      this.OPTION(() => this.SUBRULE(this.classSuffix));
      this.SUBRULE(this.lineEnd);
    });
    this.RULE("directionStatement", () => {
      this.CONSUME(Direction);
      this.OR([
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME(Td), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME(Tb), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME(Bt), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME(Lr), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME(Rl), "ALT") }
      ]);
      this.SUBRULE(this.lineEnd);
    });
    this.RULE("classDefStatement", () => {
      this.CONSUME(ClassDef);
      this.CONSUME(Identifier);
      this.MANY(() => {
        this.CONSUME(Comma);
        this.CONSUME2(Identifier);
      });
      this.SUBRULE(this.styles);
      this.SUBRULE(this.lineEnd);
    });
    this.RULE("classStatement", () => {
      this.CONSUME(Class);
      this.CONSUME(Identifier);
      this.MANY(() => {
        this.CONSUME(Comma);
        this.CONSUME2(Identifier);
      });
      this.CONSUME3(Identifier);
      this.MANY2(() => {
        this.CONSUME2(Comma);
        this.CONSUME4(Identifier);
      });
      this.SUBRULE(this.lineEnd);
    });
    this.RULE("styleStatement", () => {
      this.CONSUME(Style);
      this.CONSUME(Identifier);
      this.SUBRULE(this.styles);
      this.SUBRULE(this.lineEnd);
    });
    this.RULE("styles", () => {
      this.SUBRULE(this.styleValue);
      this.MANY(() => {
        this.CONSUME(Comma);
        this.SUBRULE2(this.styleValue);
      });
    });
    this.RULE("styleValue", () => {
      this.OR([
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME(Word), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME(CssIdentifier), "ALT") },
        {
          ALT: /* @__PURE__ */ __name(() => {
            this.CONSUME(MarkerlessSolid);
            this.CONSUME2(Word);
          }, "ALT")
        }
      ]);
      this.CONSUME(Colon);
      this.AT_LEAST_ONE(() => this.SUBRULE(this.styleComponent));
    });
    this.RULE("styleComponent", () => {
      this.OR([
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME(Word), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME(PlainString), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME(NumberLiteral), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME(HashColor), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME(CssIdentifier), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME(CssEscapedComma), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME(Dash), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME(Dot), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME(Percent), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME(CssPunctuation), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME(Colon), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME(LeftParen), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME(RightParen), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME(LeftBracket), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME(RightBracket), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME(LeftBrace), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME(RightBrace), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME(At), "ALT") },
        { ALT: /* @__PURE__ */ __name(() => this.CONSUME(MarkerlessSolid), "ALT") }
      ]);
    });
    this.performSelfAnalysis();
  }
  isMetadataAssignment() {
    const target = this.LA(1).tokenType;
    return (target === Identifier || target === PlainString || target === MarkdownString) && this.LA(2).tokenType === MetadataStart;
  }
  isStatementStart() {
    const tokenType = this.LA(1).tokenType;
    return tokenType !== EOF && tokenType !== NewLine && tokenType !== Comment;
  }
  isForbiddenPlantUmlStatement() {
    return this.LA(1).tokenType === Identifier && forbiddenPlantUmlStatements[this.LA(1).image.toLowerCase()] === true;
  }
  hasLabeledRight(allowed) {
    if (!isLabelToken(this.LA(1))) {
      return false;
    }
    for (let index = 2;; index++) {
      const token = this.LA(index);
      if (allowed.includes(token.tokenType)) {
        return true;
      }
      if (!isLabelToken(token)) {
        return false;
      }
    }
  }
};
var usecaseParser = new UsecaseParser;
var UsecaseJsonError = class extends Error {
  constructor(message, line, column) {
    super(`${message} (line ${line}, column ${column})`);
    this.line = line;
    this.column = column;
    this.name = "UsecaseJsonError";
  }
  static {
    __name(this, "UsecaseJsonError");
  }
};
var locationAtOffset = /* @__PURE__ */ __name((text, offset, startLine, startColumn) => {
  let line = startLine;
  let column = startColumn;
  const end = Math.min(Math.max(offset, 0), text.length);
  for (let index = 0;index < end; index++) {
    const character = text[index];
    if (character === "\r") {
      line++;
      column = 1;
    } else if (character === `
`) {
      if (index === 0 || text[index - 1] !== "\r") {
        line++;
        column = 1;
      }
    } else {
      column++;
    }
  }
  return { line, column };
}, "locationAtOffset");
var locationFromErrorMessage = /* @__PURE__ */ __name((message, text, startLine, startColumn) => {
  const position = /\bposition (\d+)\b/u.exec(message);
  if (position) {
    return locationAtOffset(text, Number.parseInt(position[1], 10), startLine, startColumn);
  }
  const localLocation = /\bline (\d+) column (\d+)\b/u.exec(message);
  if (localLocation) {
    const localLine = Number.parseInt(localLocation[1], 10);
    const localColumn = Number.parseInt(localLocation[2], 10);
    return {
      line: startLine + localLine - 1,
      column: localLine === 1 ? startColumn + localColumn - 1 : localColumn
    };
  }
  if (/unexpected end|end of json input/iu.test(message)) {
    return locationAtOffset(text, text.length, startLine, startColumn);
  }
  return;
}, "locationFromErrorMessage");
var JsonWalkError = class extends Error {
  constructor(offset) {
    super("Invalid JSON token");
    this.offset = offset;
  }
  static {
    __name(this, "JsonWalkError");
  }
};
var PropertyOrderCollector = class {
  constructor(text) {
    this.text = text;
    this.offset = 0;
    this.propertyOrder = {};
  }
  static {
    __name(this, "PropertyOrderCollector");
  }
  collect() {
    this.skipWhitespace();
    this.collectValue("");
    this.skipWhitespace();
    if (this.offset !== this.text.length) {
      throw new JsonWalkError(this.offset);
    }
    return this.propertyOrder;
  }
  collectValue(pointer) {
    this.skipWhitespace();
    const character = this.text[this.offset];
    if (character === "{") {
      this.collectObject(pointer);
    } else if (character === "[") {
      this.collectArray(pointer);
    } else if (character === '"') {
      this.readString(false);
    } else if (character === "t") {
      this.consumeLiteral("true");
    } else if (character === "f") {
      this.consumeLiteral("false");
    } else if (character === "n") {
      this.consumeLiteral("null");
    } else if (character === "-" || character >= "0" && character <= "9") {
      this.consumeNumber();
    } else {
      throw new JsonWalkError(this.offset);
    }
  }
  collectObject(pointer) {
    this.offset++;
    const order = [];
    const seen = /* @__PURE__ */ new Set;
    this.propertyOrder[pointer] = order;
    this.skipWhitespace();
    if (this.text[this.offset] === "}") {
      this.offset++;
      return;
    }
    while (this.offset < this.text.length) {
      if (this.text[this.offset] !== '"') {
        throw new JsonWalkError(this.offset);
      }
      const property2 = this.readString(true);
      const propertyPointer = `${pointer}/${property2.replaceAll("~", "~0").replaceAll("/", "~1")}`;
      if (seen.has(property2)) {
        this.deletePointerSubtree(propertyPointer);
      } else {
        seen.add(property2);
        order.push(property2);
      }
      this.skipWhitespace();
      if (this.text[this.offset] !== ":") {
        throw new JsonWalkError(this.offset);
      }
      this.offset++;
      this.collectValue(propertyPointer);
      this.skipWhitespace();
      if (this.text[this.offset] === "}") {
        this.offset++;
        return;
      }
      if (this.text[this.offset] !== ",") {
        throw new JsonWalkError(this.offset);
      }
      this.offset++;
      this.skipWhitespace();
    }
    throw new JsonWalkError(this.offset);
  }
  collectArray(pointer) {
    this.offset++;
    this.skipWhitespace();
    if (this.text[this.offset] === "]") {
      this.offset++;
      return;
    }
    let index = 0;
    while (this.offset < this.text.length) {
      this.collectValue(`${pointer}/${index}`);
      index++;
      this.skipWhitespace();
      if (this.text[this.offset] === "]") {
        this.offset++;
        return;
      }
      if (this.text[this.offset] !== ",") {
        throw new JsonWalkError(this.offset);
      }
      this.offset++;
      this.skipWhitespace();
    }
    throw new JsonWalkError(this.offset);
  }
  readString(decode) {
    this.offset++;
    let value = "";
    while (this.offset < this.text.length) {
      const characterOffset = this.offset;
      const character = this.text[this.offset++];
      if (character === '"') {
        return value;
      }
      if (character.charCodeAt(0) < 32) {
        throw new JsonWalkError(characterOffset);
      }
      if (character !== "\\") {
        if (decode) {
          value += character;
        }
        continue;
      }
      const escapeOffset = this.offset;
      const escape = this.text[this.offset++];
      switch (escape) {
        case '"':
        case "\\":
        case "/":
          if (decode) {
            value += escape;
          }
          break;
        case "b":
          if (decode) {
            value += "\b";
          }
          break;
        case "f":
          if (decode) {
            value += "\f";
          }
          break;
        case "n":
          if (decode) {
            value += `
`;
          }
          break;
        case "r":
          if (decode) {
            value += "\r";
          }
          break;
        case "t":
          if (decode) {
            value += "\t";
          }
          break;
        case "u": {
          const codeUnit = this.text.slice(this.offset, this.offset + 4);
          if (!/^[\dA-Fa-f]{4}$/u.test(codeUnit)) {
            throw new JsonWalkError(this.offset);
          }
          if (decode) {
            value += String.fromCharCode(Number.parseInt(codeUnit, 16));
          }
          this.offset += 4;
          break;
        }
        default:
          throw new JsonWalkError(escapeOffset);
      }
    }
    throw new JsonWalkError(this.offset);
  }
  consumeLiteral(literal) {
    let index = 0;
    for (const element of literal) {
      if (this.text[this.offset + index] !== element) {
        throw new JsonWalkError(this.offset + index);
      }
      index++;
    }
    this.offset += literal.length;
  }
  consumeNumber() {
    if (this.text[this.offset] === "-") {
      this.offset++;
    }
    if (this.text[this.offset] === "0") {
      this.offset++;
    } else if (this.text[this.offset] >= "1" && this.text[this.offset] <= "9") {
      while (this.text[this.offset] >= "0" && this.text[this.offset] <= "9") {
        this.offset++;
      }
    } else {
      throw new JsonWalkError(this.offset);
    }
    if (this.text[this.offset] === ".") {
      this.offset++;
      if (this.text[this.offset] < "0" || this.text[this.offset] > "9") {
        throw new JsonWalkError(this.offset);
      }
      while (this.text[this.offset] >= "0" && this.text[this.offset] <= "9") {
        this.offset++;
      }
    }
    if (this.text[this.offset] === "e" || this.text[this.offset] === "E") {
      this.offset++;
      if (this.text[this.offset] === "+" || this.text[this.offset] === "-") {
        this.offset++;
      }
      if (this.text[this.offset] < "0" || this.text[this.offset] > "9") {
        throw new JsonWalkError(this.offset);
      }
      while (this.text[this.offset] >= "0" && this.text[this.offset] <= "9") {
        this.offset++;
      }
    }
  }
  skipWhitespace() {
    while (this.offset < this.text.length) {
      const character = this.text[this.offset];
      if (character !== " " && character !== "\t" && character !== `
` && character !== "\r") {
        return;
      }
      this.offset++;
    }
  }
  deletePointerSubtree(pointer) {
    const descendantPrefix = `${pointer}/`;
    for (const existingPointer of Object.keys(this.propertyOrder)) {
      if (existingPointer === pointer || existingPointer.startsWith(descendantPrefix)) {
        delete this.propertyOrder[existingPointer];
      }
    }
  }
};
function parseOrderedJsonObject(jsonText, startLine, startColumn) {
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    let location = locationFromErrorMessage(message, jsonText, startLine, startColumn);
    if (!location) {
      let invalidOffset = 0;
      try {
        new PropertyOrderCollector(jsonText).collect();
      } catch (walkError) {
        if (walkError instanceof JsonWalkError) {
          invalidOffset = walkError.offset;
        }
      }
      location = locationAtOffset(jsonText, invalidOffset, startLine, startColumn);
    }
    throw new UsecaseJsonError(`Invalid JSON: ${message}`, location.line, location.column);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new UsecaseJsonError("JSON value must have an object root", startLine, startColumn);
  }
  return {
    value: parsed,
    propertyOrder: new PropertyOrderCollector(jsonText).collect()
  };
}
__name(parseOrderedJsonObject, "parseOrderedJsonObject");
var actorNode = /* @__PURE__ */ __name((actor) => ({
  shape: actor.type === "normal" ? "actor" : actor.type === "hollow" ? "actor-hollow" : actor.type === "awesome" ? "actor-awesome" : "actor-icon",
  ...actor.label === actor.id ? {} : { label: actor.label },
  ...actor.classes.length ? { classes: [...actor.classes] } : {},
  ...actor.styles.length ? { styles: [...actor.styles] } : {},
  attrs: {
    kind: "actor",
    actorType: actor.type,
    business: actor.business,
    labelType: actor.labelType,
    ...actor.icon ? { icon: actor.icon } : {},
    ...actor.stereotype ? { stereotype: actor.stereotype } : {},
    ...actor.parentId ? { parentId: actor.parentId } : {}
  }
}), "actorNode");
var useCaseNode = /* @__PURE__ */ __name((useCase) => ({
  shape: useCase.shape,
  ...useCase.label === useCase.id ? {} : { label: useCase.label },
  ...useCase.classes.length ? { classes: [...useCase.classes] } : {},
  ...useCase.styles.length ? { styles: [...useCase.styles] } : {},
  attrs: {
    kind: "usecase",
    useCaseShape: useCase.shape,
    business: useCase.business,
    labelType: useCase.labelType,
    ...useCase.stereotype ? { stereotype: useCase.stereotype } : {},
    ...useCase.parentId ? { parentId: useCase.parentId } : {}
  }
}), "useCaseNode");
var noteNode = /* @__PURE__ */ __name((note) => ({
  label: note.label,
  shape: "note",
  attrs: { kind: "note", target: note.target, labelType: note.labelType }
}), "noteNode");
var jsonNode = /* @__PURE__ */ __name((json) => ({
  label: json.id,
  shape: "json-table",
  ...json.classes.length ? { classes: [...json.classes] } : {},
  ...json.styles.length ? { styles: [...json.styles] } : {},
  attrs: { kind: "json", value: json.value, propertyOrder: json.propertyOrder, labelType: "text" }
}), "jsonNode");
var relationshipEdge = /* @__PURE__ */ __name((relationship) => ({
  id: relationship.id,
  source: relationship.source,
  target: relationship.target,
  ...relationship.label ? { label: relationship.label } : {},
  ...relationship.classes.length ? { classes: [...relationship.classes] } : {},
  ...relationship.styles.length ? { styles: [...relationship.styles] } : {},
  attrs: {
    relationshipType: relationship.type,
    arrowType: relationship.arrowType,
    minlen: relationship.minlen,
    explicitId: relationship.explicitId,
    animate: relationship.animate,
    ...relationship.animation ? { animation: relationship.animation } : {},
    ...relationship.labelType ? { labelType: relationship.labelType } : {}
  }
}), "relationshipEdge");
var noteEdge = /* @__PURE__ */ __name((note) => ({
  id: `${note.id}-edge`,
  source: note.id,
  target: note.target,
  attrs: {
    relationshipType: "note",
    arrowType: ARROW_TYPE.LINE_SOLID,
    pattern: "dotted",
    minlen: 1,
    explicitId: false,
    animate: false,
    internal: true
  }
}), "noteEdge");
var buildUsecaseGraphAST = /* @__PURE__ */ __name((model, source, headerSpan, statements) => {
  const nodes = {};
  for (const actor of model.getActors().values()) {
    nodes[actor.id] = actorNode(actor);
  }
  for (const useCase of model.getUseCases().values()) {
    nodes[useCase.id] = useCaseNode(useCase);
  }
  for (const note of model.getNotes().values()) {
    nodes[note.id] = noteNode(note);
  }
  for (const json of model.getJsonNodes().values()) {
    nodes[json.id] = jsonNode(json);
  }
  const groups = {};
  for (const boundary of model.getSystemBoundaries().values()) {
    groups[boundary.id] = {
      ...boundary.label === boundary.id ? {} : { title: boundary.label },
      nodes: [...boundary.members],
      ...boundary.classes.length ? { classes: [...boundary.classes] } : {},
      ...boundary.styles.length ? { styles: [...boundary.styles] } : {},
      attrs: {
        kind: "systemBoundary",
        boundaryType: boundary.type,
        labelType: boundary.labelType
      }
    };
  }
  const classDefs = {};
  for (const definition of model.getClassDefs().values()) {
    classDefs[definition.id] = { styles: [...definition.styles] };
  }
  const direction = model.getDirection();
  return {
    version: 1,
    diagramType: "usecase",
    source,
    header: {
      keyword: "usecase",
      direction: direction === "TD" ? "TB" : direction,
      span: headerSpan
    },
    ...model.getAccTitle() ? { accTitle: model.getAccTitle() } : {},
    ...model.getAccDescription() ? { accDescr: model.getAccDescription() } : {},
    nodes,
    edges: [
      ...model.getRelationships().map(relationshipEdge),
      ...[...model.getNotes().values()].map(noteEdge)
    ],
    groups,
    classDefs,
    statements
  };
}, "buildUsecaseGraphAST");
var locationText = /* @__PURE__ */ __name((location) => `line ${location.line}, column ${location.column} [${location.span[0]},${location.span[1]})`, "locationText");
var labelSuffix = /* @__PURE__ */ __name((label) => label === undefined ? "" : ` (label "${label}")`, "labelSuffix");
var generatedFrom = /* @__PURE__ */ __name((origin) => origin.generated ? origin.label : undefined, "generatedFrom");
var pushUnique = /* @__PURE__ */ __name((target, values2) => {
  for (const value of values2) {
    if (!target.includes(value)) {
      target.push(value);
    }
  }
}, "pushUnique");
var UsecaseModelBuilder = class {
  constructor(db2) {
    this.db = db2;
    this.source = "";
    this.statements = [];
    this.elements = [];
    this.boundaries = [];
    this.jsonDrafts = [];
    this.relationshipDrafts = [];
    this.noteDrafts = [];
    this.metadataAssignments = [];
    this.classAssignments = [];
    this.styleAssignments = [];
    this.classDefinitions = [];
    this.directions = [];
    this.model = db2.createModel();
  }
  static {
    __name(this, "UsecaseModelBuilder");
  }
  reset(source) {
    this.model = this.db.createModel();
    this.source = source;
    this.statements = [];
    this.elements.length = 0;
    this.boundaries.length = 0;
    this.jsonDrafts.length = 0;
    this.relationshipDrafts.length = 0;
    this.noteDrafts.length = 0;
    this.metadataAssignments.length = 0;
    this.classAssignments.length = 0;
    this.styleAssignments.length = 0;
    this.classDefinitions.length = 0;
    this.directions.length = 0;
  }
  addElement(value) {
    this.elements.push(value);
  }
  addBoundary(value) {
    this.boundaries.push(value);
  }
  addJson(value) {
    this.jsonDrafts.push(value);
  }
  addRelationship(value) {
    this.relationshipDrafts.push(value);
  }
  addNote(value) {
    this.noteDrafts.push(value);
  }
  addMetadataAssignment(target, targetLocation, metadata, statement) {
    this.metadataAssignments.push({ target, targetLocation, metadata, statement });
  }
  addClassDef(ids, styles) {
    this.classDefinitions.push({ ids, styles });
  }
  addClassAssignment(targets, classes) {
    this.classAssignments.push({ targets, classes });
  }
  addStyleAssignment(target, location, styles) {
    this.styleAssignments.push({ target, location, styles });
  }
  setDirection(direction) {
    this.directions.push(direction === "TD" ? "TB" : direction);
  }
  setAccTitle(title) {
    this.model.accTitle = title;
  }
  setAccDescription(description) {
    this.model.accDescription = description;
  }
  setStatements(statements) {
    this.statements = statements;
  }
  getActors() {
    return this.model.actors;
  }
  getUseCases() {
    return this.model.useCases;
  }
  getSystemBoundaries() {
    return this.model.systemBoundaries;
  }
  getRelationships() {
    return this.model.relationships;
  }
  getNotes() {
    return this.model.notes;
  }
  getJsonNodes() {
    return this.model.jsonNodes;
  }
  getClassDefs() {
    return this.model.classDefs;
  }
  getDirection() {
    return this.model.direction;
  }
  getAccTitle() {
    return this.model.accTitle;
  }
  getAccDescription() {
    return this.model.accDescription;
  }
  finalize(headerSpan) {
    const symbols = /* @__PURE__ */ new Map;
    const elements = /* @__PURE__ */ new Map;
    const boundaries = /* @__PURE__ */ new Map;
    const first2 = /* @__PURE__ */ new Map;
    for (const relation of this.relationshipDrafts) {
      this.recordFirst(first2, relation.source.id, relation.source.location.span[0]);
      this.recordFirst(first2, relation.target.id, relation.target.location.span[0]);
    }
    for (const draft of this.elements) {
      this.recordFirst(first2, draft.id, draft.location.span[0]);
    }
    for (const draft of this.boundaries) {
      this.recordFirst(first2, draft.id, draft.location.span[0]);
    }
    for (const draft of this.jsonDrafts) {
      this.recordFirst(first2, draft.id, draft.location.span[0]);
    }
    const declarations = [
      ...this.elements.map((value) => ({
        offset: value.location.span[0],
        type: "element",
        value
      })),
      ...this.boundaries.map((value) => ({
        offset: value.location.span[0],
        type: "boundary",
        value
      })),
      ...this.jsonDrafts.map((value) => ({
        offset: value.location.span[0],
        type: "json",
        value
      })),
      ...this.relationshipDrafts.filter((value) => value.explicitId).map((value) => ({
        offset: value.explicitIdLocation.span[0],
        type: "edge",
        value
      }))
    ].sort((a, b) => a.offset - b.offset);
    for (const item of declarations) {
      if (item.type === "element") {
        this.collectElement(item.value, symbols, elements);
      } else if (item.type === "boundary") {
        this.collectBoundary(item.value, symbols, boundaries);
      } else if (item.type === "json") {
        this.registerUnique(symbols, item.value.id, "json", item.value.location, false);
      } else {
        this.registerUnique(symbols, item.value.explicitId, "edge", item.value.explicitIdLocation, false);
      }
    }
    this.materializeElements(elements, first2);
    this.materializeBoundaries(boundaries, first2);
    this.materializeJson(first2);
    const edges = this.materializeRelationships(symbols, elements, first2);
    this.reorderElements(elements, first2);
    this.applyMetadataAssignments(symbols, elements, boundaries, edges);
    this.validateAndRefreshElements(elements);
    this.refreshBoundaries(boundaries, elements);
    this.materializeNotes(symbols);
    this.applyClassDefinitions();
    this.applyClassesAndStyles(symbols, edges);
    this.model.direction = this.directions.at(-1) ?? this.model.direction;
    this.model.symbols = new Map([...symbols].map(([id, origin]) => [id, origin.kind]));
    const ast = buildUsecaseGraphAST(this, this.source, headerSpan, this.statements);
    this.model.ast = ast;
    this.db.commit(this.model);
    return ast;
  }
  collectElement(draft, symbols, states) {
    const origin = symbols.get(draft.id);
    const draftLabel = generatedFrom({ generated: draft.generated, label: draft.label.text });
    if (origin && origin.kind !== draft.kind) {
      this.conflict(`ID '${draft.id}' is declared as both ${origin.kind} and ${draft.kind}`, draft.location, origin.location, draftLabel, generatedFrom(origin));
    }
    if (origin && (origin.generated || draft.generated)) {
      this.conflict(`Generated ID '${draft.id}' collides with another declaration`, draft.location, origin.location, draftLabel, generatedFrom(origin));
    }
    const existing = states.get(draft.id);
    if (!existing) {
      const state2 = {
        kind: draft.kind,
        id: draft.id,
        label: draft.label,
        location: draft.location,
        generated: draft.generated,
        classes: [...draft.classes],
        ...draft.parentId ? { parentId: draft.parentId, parentLocation: draft.parentLocation } : {},
        ...draft.shape ? { shape: draft.shape } : {},
        ...draft.stereotype ? { stereotype: draft.stereotype, stereotypeLocation: draft.location } : {}
      };
      this.applyDeclarationMetadata(state2, draft.metadata);
      states.set(draft.id, state2);
      symbols.set(draft.id, {
        kind: draft.kind,
        location: draft.location,
        generated: draft.generated,
        label: draft.label.text
      });
      return;
    }
    if (existing.label.text !== draft.label.text || existing.label.type !== draft.label.type) {
      this.conflict(`ID '${draft.id}' has conflicting labels`, draft.location, existing.location);
    }
    if (draft.shape && existing.shape && draft.shape !== existing.shape) {
      this.conflict(`Use case '${draft.id}' has conflicting shapes`, draft.location, existing.location);
    }
    if (draft.parentId && existing.parentId && draft.parentId !== existing.parentId) {
      this.conflict(`Element '${draft.id}' belongs to more than one system boundary`, draft.parentLocation ?? draft.location, existing.parentLocation ?? existing.location);
    }
    if (draft.stereotype && existing.stereotype && draft.stereotype !== existing.stereotype) {
      this.conflict(`Element '${draft.id}' has conflicting stereotypes`, draft.location, existing.stereotypeLocation ?? existing.location);
    }
    existing.shape ??= draft.shape;
    existing.parentId ??= draft.parentId;
    existing.parentLocation ??= draft.parentLocation;
    existing.stereotype ??= draft.stereotype;
    existing.stereotypeLocation ??= draft.stereotype ? draft.location : undefined;
    pushUnique(existing.classes, draft.classes);
    this.applyDeclarationMetadata(existing, draft.metadata);
  }
  collectBoundary(draft, symbols, states) {
    const origin = symbols.get(draft.id);
    const draftLabel = generatedFrom({ generated: draft.generated, label: draft.label.text });
    if (origin && origin.kind !== "boundary") {
      this.conflict(`ID '${draft.id}' is declared as both ${origin.kind} and boundary`, draft.location, origin.location, draftLabel, generatedFrom(origin));
    }
    if (origin && (origin.generated || draft.generated)) {
      this.conflict(`Generated ID '${draft.id}' collides with another declaration`, draft.location, origin.location, draftLabel, generatedFrom(origin));
    }
    const existing = states.get(draft.id);
    if (existing) {
      if (existing.label.text !== draft.label.text || existing.label.type !== draft.label.type) {
        this.conflict(`Boundary '${draft.id}' has conflicting titles`, draft.location, existing.location);
      }
      pushUnique(existing.classes, draft.classes);
      return;
    }
    states.set(draft.id, {
      id: draft.id,
      label: draft.label,
      location: draft.location,
      generated: draft.generated,
      classes: [...draft.classes],
      styles: [],
      members: []
    });
    symbols.set(draft.id, {
      kind: "boundary",
      location: draft.location,
      generated: draft.generated,
      label: draft.label.text
    });
  }
  materializeElements(states, first2) {
    for (const state2 of [...states.values()].sort((a, b) => (first2.get(a.id) ?? 0) - (first2.get(b.id) ?? 0))) {
      this.setElementModel(state2);
    }
  }
  materializeBoundaries(states, first2) {
    for (const state2 of [...states.values()].sort((a, b) => (first2.get(a.id) ?? 0) - (first2.get(b.id) ?? 0))) {
      this.model.systemBoundaries.set(state2.id, {
        id: state2.id,
        label: state2.label.text,
        labelType: state2.label.type,
        type: state2.type ?? "rect",
        members: [],
        classes: [...state2.classes],
        styles: [...state2.styles]
      });
    }
  }
  materializeJson(first2) {
    for (const draft of [...this.jsonDrafts].sort((a, b) => (first2.get(a.id) ?? 0) - (first2.get(b.id) ?? 0))) {
      this.model.jsonNodes.set(draft.id, {
        id: draft.id,
        value: draft.value,
        propertyOrder: draft.propertyOrder,
        classes: [...draft.classes],
        styles: []
      });
    }
  }
  materializeRelationships(symbols, states, first2) {
    const edges = /* @__PURE__ */ new Map;
    let anonymous = 0;
    for (const draft of this.relationshipDrafts) {
      const sourceKind = this.resolveEndpoint(draft.source, symbols, states, first2);
      const targetKind = this.resolveEndpoint(draft.target, symbols, states, first2);
      this.validateRelationship(draft, sourceKind, targetKind, symbols);
      const id = draft.explicitId ?? `edge-${anonymous++}`;
      const relationship = {
        id,
        explicitId: Boolean(draft.explicitId),
        source: draft.source.id,
        target: draft.target.id,
        type: draft.type,
        arrowType: draft.arrowType,
        ...draft.label ? { label: draft.label.text, labelType: draft.label.type } : {},
        minlen: draft.minlen,
        classes: [],
        styles: [],
        animate: false
      };
      this.model.relationships.push(relationship);
      edges.set(id, { draft, relationship });
    }
    this.model.relationshipCounter = anonymous;
    return edges;
  }
  resolveEndpoint(endpoint, symbols, states, first2) {
    if (endpoint.classesOnReference && !endpoint.declaration) {
      throw new Error(`Relationship endpoint '${endpoint.id}' uses ::: without declaring the node at ${locationText(endpoint.location)}`);
    }
    const origin = symbols.get(endpoint.id);
    if (origin) {
      return origin.kind;
    }
    states.set(endpoint.id, {
      kind: "usecase",
      id: endpoint.id,
      label: endpoint.label,
      location: endpoint.location,
      generated: endpoint.generated,
      shape: "ellipse",
      classes: []
    });
    symbols.set(endpoint.id, {
      kind: "usecase",
      location: endpoint.location,
      generated: endpoint.generated,
      label: endpoint.label.text
    });
    this.recordFirst(first2, endpoint.id, endpoint.location.span[0]);
    return "usecase";
  }
  reorderElements(states, first2) {
    const actors = new Map(this.model.actors);
    const useCases = new Map(this.model.useCases);
    this.model.actors.clear();
    this.model.useCases.clear();
    for (const state2 of [...states.values()].sort((a, b) => (first2.get(a.id) ?? 0) - (first2.get(b.id) ?? 0))) {
      if (!actors.has(state2.id) && !useCases.has(state2.id)) {
        this.setElementModel(state2);
      }
      const actor = actors.get(state2.id) ?? this.model.actors.get(state2.id);
      const useCase = useCases.get(state2.id) ?? this.model.useCases.get(state2.id);
      if (actor) {
        this.model.actors.set(state2.id, actor);
      } else if (useCase) {
        this.model.useCases.set(state2.id, useCase);
      }
    }
  }
  applyMetadataAssignments(symbols, elements, boundaries, edges) {
    for (const assignment of this.metadataAssignments) {
      const origin = symbols.get(assignment.target);
      if (!origin) {
        const inferred = this.inferMetadataKind(assignment.metadata);
        throw new Error(`Metadata target '${assignment.target}' is unresolved${inferred ? ` (metadata implies ${inferred})` : ""} at ${locationText(assignment.targetLocation)}`);
      }
      if (origin.kind === "actor" || origin.kind === "usecase") {
        this.applyStandaloneElementMetadata(elements.get(assignment.target), assignment.metadata);
      } else if (origin.kind === "boundary") {
        const boundary = boundaries.get(assignment.target);
        for (const property2 of assignment.metadata.properties) {
          if (property2.key !== "type" || property2.value !== "rect" && property2.value !== "package") {
            this.invalidMetadata(assignment.target, origin.kind, property2);
          }
          boundary.type = property2.value;
        }
      } else if (origin.kind === "edge") {
        const edge = edges.get(assignment.target);
        if (!edge) {
          throw new Error(`Metadata target '${assignment.target}' is not an explicit edge at ${locationText(assignment.targetLocation)}`);
        }
        assignment.statement.kind = "edgeMetadata";
        assignment.statement.edges = [
          {
            id: assignment.target,
            span: assignment.statement.span,
            idSpan: assignment.targetLocation.span,
            ...assignment.statement.metadata ? { metadata: assignment.statement.metadata } : {}
          }
        ];
        delete assignment.statement.nodes;
        for (const property2 of assignment.metadata.properties) {
          if (property2.key === "animate" && typeof property2.value === "boolean") {
            edge.relationship.animate = property2.value;
          } else if (property2.key === "animation" && (property2.value === "fast" || property2.value === "slow")) {
            edge.relationship.animation = property2.value;
            edge.relationship.animate = true;
          } else {
            this.invalidMetadata(assignment.target, origin.kind, property2);
          }
        }
      } else {
        for (const property2 of assignment.metadata.properties) {
          this.invalidMetadata(assignment.target, origin.kind, property2);
        }
      }
    }
    for (const { relationship } of edges.values()) {
      if (relationship.animation) {
        relationship.animate = true;
      }
    }
  }
  applyStandaloneElementMetadata(state2, metadata) {
    for (const property2 of metadata.properties) {
      if (state2.kind === "actor") {
        this.applyActorProperty(state2, property2, true);
      } else if (property2.key === "business" && typeof property2.value === "boolean") {
        state2.business = property2.value;
      } else {
        this.invalidMetadata(state2.id, state2.kind, property2);
      }
    }
  }
  applyDeclarationMetadata(state2, metadata) {
    if (!metadata) {
      return;
    }
    for (const property2 of metadata.properties) {
      if (state2.kind === "actor") {
        this.applyActorProperty(state2, property2, false);
      } else if (property2.key === "business" && typeof property2.value === "boolean") {
        if (state2.business !== undefined && state2.business !== property2.value) {
          this.conflict(`Use case '${state2.id}' has conflicting business metadata`, property2.location, state2.location);
        }
        state2.business = property2.value;
      } else {
        this.invalidMetadata(state2.id, state2.kind, property2);
      }
    }
  }
  applyActorProperty(state2, property2, replace) {
    if (property2.key === "type" && (property2.value === "normal" || property2.value === "hollow" || property2.value === "awesome")) {
      if (!replace && state2.actorType !== undefined && state2.actorType !== property2.value) {
        this.conflict(`Actor '${state2.id}' has conflicting type metadata`, property2.location, state2.location);
      }
      state2.actorType = property2.value;
    } else if (property2.key === "icon" && typeof property2.value === "string") {
      if (!replace && state2.icon !== undefined && state2.icon !== property2.value) {
        this.conflict(`Actor '${state2.id}' has conflicting icon metadata`, property2.location, state2.location);
      }
      state2.icon = property2.value;
    } else if (property2.key === "business" && typeof property2.value === "boolean") {
      if (!replace && state2.business !== undefined && state2.business !== property2.value) {
        this.conflict(`Actor '${state2.id}' has conflicting business metadata`, property2.location, state2.location);
      }
      state2.business = property2.value;
    } else {
      this.invalidMetadata(state2.id, state2.kind, property2);
    }
  }
  validateAndRefreshElements(states) {
    for (const state2 of states.values()) {
      const type = state2.icon ? "icon" : state2.actorType ?? "normal";
      if (state2.kind === "actor") {
        if (state2.icon && state2.actorType && state2.actorType !== "normal") {
          throw new Error(`Actor '${state2.id}' cannot combine icon with type '${state2.actorType}' at ${locationText(state2.location)}`);
        }
        if (state2.business && (type === "icon" || type === "awesome")) {
          throw new Error(`Business actor '${state2.id}' must use normal or hollow geometry at ${locationText(state2.location)}`);
        }
      } else if ((state2.shape ?? "ellipse") === "rect" && state2.business) {
        throw new Error(`Rectangular use case '${state2.id}' cannot be a business use case at ${locationText(state2.location)}`);
      }
      this.setElementModel(state2);
    }
  }
  refreshBoundaries(boundaries, elements) {
    for (const boundary of boundaries.values()) {
      boundary.members.length = 0;
    }
    for (const draft of [...this.elements].sort((a, b) => a.location.span[0] - b.location.span[0])) {
      if (!draft.parentId) {
        continue;
      }
      const boundary = boundaries.get(draft.parentId);
      if (!boundary) {
        throw new Error(`Parent boundary '${draft.parentId}' for '${draft.id}' is unresolved at ${locationText(draft.parentLocation ?? draft.location)}`);
      }
      if (!boundary.members.includes(draft.id)) {
        boundary.members.push(draft.id);
      }
    }
    for (const state2 of elements.values()) {
      if (state2.parentId && !boundaries.has(state2.parentId)) {
        throw new Error(`Parent boundary '${state2.parentId}' for '${state2.id}' is unresolved at ${locationText(state2.parentLocation ?? state2.location)}`);
      }
    }
    for (const state2 of boundaries.values()) {
      const model = this.model.systemBoundaries.get(state2.id);
      model.type = state2.type ?? "rect";
      model.members = [...state2.members];
      model.classes = [...state2.classes];
      model.styles = [...state2.styles];
    }
  }
  materializeNotes(symbols) {
    let counter = 0;
    for (const draft of this.noteDrafts) {
      const origin = symbols.get(draft.target);
      if (!origin) {
        throw new Error(`Note target '${draft.target}' is unresolved at ${locationText(draft.targetLocation)}`);
      }
      if (origin.kind !== "actor" && origin.kind !== "usecase") {
        this.conflict(`Note target '${draft.target}' must be an actor or use case, not ${origin.kind}`, draft.targetLocation, origin.location);
      }
      const id = `note-${counter++}`;
      this.model.notes.set(id, {
        id,
        target: draft.target,
        label: draft.label.text,
        labelType: draft.label.type
      });
    }
    this.model.noteCounter = counter;
  }
  applyClassDefinitions() {
    for (const definition of this.classDefinitions) {
      for (const id of definition.ids) {
        this.model.classDefs.set(id, { id, styles: [...definition.styles] });
      }
    }
  }
  applyClassesAndStyles(symbols, edges) {
    for (const assignment of this.classAssignments) {
      for (const target of assignment.targets) {
        pushUnique(this.getStylable(target.id, symbols, edges, target.location).classes, assignment.classes);
      }
    }
    for (const assignment of this.styleAssignments) {
      this.getStylable(assignment.target, symbols, edges, assignment.location).styles.push(...assignment.styles);
    }
  }
  getStylable(id, symbols, edges, location) {
    const kind = symbols.get(id)?.kind;
    const target = kind === "actor" ? this.model.actors.get(id) : kind === "usecase" ? this.model.useCases.get(id) : kind === "boundary" ? this.model.systemBoundaries.get(id) : kind === "json" ? this.model.jsonNodes.get(id) : kind === "edge" ? edges.get(id)?.relationship : undefined;
    if (!target) {
      throw new Error(`Class/style target '${id}' is unresolved or anonymous at ${locationText(location)}`);
    }
    return target;
  }
  validateRelationship(draft, sourceKind, targetKind, symbols) {
    const allowed = /* @__PURE__ */ __name((kind) => kind === "actor" || kind === "usecase" || kind === "json", "allowed");
    if (!allowed(sourceKind)) {
      this.conflict(`Relationship source '${draft.source.id}' cannot be ${sourceKind}`, draft.source.location, symbols.get(draft.source.id).location);
    }
    if (!allowed(targetKind)) {
      this.conflict(`Relationship target '${draft.target.id}' cannot be ${targetKind}`, draft.target.location, symbols.get(draft.target.id).location);
    }
    if ((draft.type === "include" || draft.type === "extend") && (sourceKind !== "usecase" || targetKind !== "usecase")) {
      throw new Error(`${draft.type} relationship requires use-case endpoints at ${locationText(draft.location)}`);
    }
    if (draft.type === "generalization" && (sourceKind !== "actor" && sourceKind !== "usecase" || sourceKind !== targetKind)) {
      throw new Error(`Generalization requires actor-to-actor or use-case-to-use-case endpoints at ${locationText(draft.location)}`);
    }
    if (draft.type === "association" && (sourceKind === "json" || targetKind === "json") && ![0, 1, 2].includes(draft.arrowType)) {
      throw new Error(`JSON relationship '${draft.source.id}' to '${draft.target.id}' permits only point, reversed-point, or markerless solid association at ${locationText(draft.location)}`);
    }
  }
  setElementModel(state2) {
    if (state2.kind === "actor") {
      const type = state2.icon ? "icon" : state2.actorType ?? "normal";
      this.model.useCases.delete(state2.id);
      this.model.actors.set(state2.id, {
        id: state2.id,
        label: state2.label.text,
        labelType: state2.label.type,
        type,
        ...state2.icon ? { icon: state2.icon } : {},
        business: state2.business ?? false,
        ...state2.stereotype ? { stereotype: state2.stereotype } : {},
        ...state2.parentId ? { parentId: state2.parentId } : {},
        classes: [...state2.classes],
        styles: this.model.actors.get(state2.id)?.styles ?? []
      });
    } else {
      this.model.actors.delete(state2.id);
      this.model.useCases.set(state2.id, {
        id: state2.id,
        label: state2.label.text,
        labelType: state2.label.type,
        shape: state2.shape ?? "ellipse",
        business: state2.business ?? false,
        ...state2.stereotype ? { stereotype: state2.stereotype } : {},
        ...state2.parentId ? { parentId: state2.parentId } : {},
        classes: [...state2.classes],
        styles: this.model.useCases.get(state2.id)?.styles ?? []
      });
    }
  }
  inferMetadataKind(metadata) {
    const possible = /* @__PURE__ */ new Set(["actor", "usecase", "boundary", "edge"]);
    for (const property2 of metadata.properties) {
      if (property2.key === "icon") {
        possible.clear();
        possible.add("actor");
      } else if (property2.key === "animate" || property2.key === "animation") {
        possible.clear();
        possible.add("edge");
      } else if (property2.key === "type") {
        possible.clear();
        if (property2.value === "rect" || property2.value === "package") {
          possible.add("boundary");
        } else if (property2.value === "normal" || property2.value === "hollow" || property2.value === "awesome") {
          possible.add("actor");
        }
      } else if (property2.key === "business") {
        possible.delete("boundary");
        possible.delete("edge");
      } else {
        return;
      }
    }
    return possible.size === 1 ? [...possible][0] : undefined;
  }
  invalidMetadata(id, kind, property2) {
    throw new Error(`Metadata property '${property2.key}' is invalid for ${kind} '${id}' at ${locationText(property2.location)}`);
  }
  registerUnique(symbols, id, kind, location, generated) {
    const previous = symbols.get(id);
    if (previous) {
      this.conflict(`ID '${id}' is declared more than once (${previous.kind} and ${kind})`, location, previous.location, undefined, generatedFrom(previous));
    }
    symbols.set(id, { kind, location, generated });
  }
  recordFirst(map2, id, offset) {
    const previous = map2.get(id);
    if (previous === undefined || offset < previous) {
      map2.set(id, offset);
    }
  }
  conflict(message, current, previous, currentLabel, previousLabel) {
    throw new Error(`${message} at ${locationText(current)}${labelSuffix(currentLabel)}; previous declaration at ${locationText(previous)}${labelSuffix(previousLabel)}`);
  }
};
var BaseVisitor = usecaseParser.getBaseCstVisitorConstructor();
var UsecaseVisitor = class extends BaseVisitor {
  constructor() {
    super();
    this.builder = new UsecaseModelBuilder(db);
    this.source = "";
    this.anonymousEdge = 0;
    this.anonymousNote = 0;
    this.validateVisitor();
  }
  static {
    __name(this, "UsecaseVisitor");
  }
  build(cst, source) {
    this.source = source;
    this.parentBoundary = undefined;
    this.anonymousEdge = 0;
    this.anonymousNote = 0;
    this.builder.reset(source);
    this.visit(cst);
  }
  start(ctx) {
    const header = this.tokens(ctx, "USECASE")[0];
    const statements = [];
    for (const line of this.nodes(ctx, "line")) {
      statements.push(this.visit(line));
    }
    this.builder.setStatements(statements);
    this.builder.finalize(this.tokenSpan(header));
  }
  line(ctx) {
    const child = this.firstNode(ctx, "blankLine", "commentLine", "statement");
    return this.wrap(child, this.visit(child));
  }
  statement(ctx) {
    return this.visit(this.firstNode(ctx, "accTitleStatement", "accDescrStatement", "directionStatement", "actorStatement", "systemBoundaryStatement", "noteStatement", "jsonStatement", "classDefStatement", "classStatement", "styleStatement", "metadataAssignmentStatement", "entityStatement"));
  }
  lineEnd(_ctx) {
    return;
  }
  blankLine(ctx) {
    return { kind: "blank", span: this.tokenSpan(this.tokens(ctx, "NEWLINE")[0]) };
  }
  commentLine(ctx) {
    return { kind: "comment", span: this.tokenSpan(this.tokens(ctx, "COMMENT")[0]) };
  }
  accTitleStatement(ctx) {
    const image = this.tokens(ctx, "ACC_TITLE_LINE")[0].image;
    this.builder.setAccTitle(image.slice(image.indexOf(":") + 1).trim());
    return { kind: "accTitle", span: [0, 0] };
  }
  accDescrStatement(ctx) {
    const line = this.tokens(ctx, "ACC_DESCR_LINE")[0];
    const block = this.tokens(ctx, "ACC_DESCR_BLOCK")[0];
    const description = line ? line.image.slice(line.image.indexOf(":") + 1).trim() : block.image.slice(block.image.indexOf("{") + 1, block.image.lastIndexOf("}")).trim();
    this.builder.setAccDescription(description);
    return { kind: "accDescr", span: [0, 0] };
  }
  actorStatement(ctx) {
    const nodes = this.nodes(ctx, "actorItem");
    const items = nodes.map((node) => this.visit(node));
    const relationNode = this.nodes(ctx, "relationTail")[0];
    const occurrences = items.map((item, index) => this.actorOccurrence(nodes[index], item, true));
    for (const item of items) {
      this.builder.addElement(this.actorDraft(item));
    }
    if (!relationNode) {
      return { kind: "node", span: [0, 0], nodes: occurrences };
    }
    const relation = this.visit(relationNode);
    if (relation.target.explicitDeclaration) {
      this.builder.addElement(this.entityDraft(relation.target));
    }
    const draft = this.relationshipDraft(items[0], relation, this.nodeLocation(relationNode));
    this.builder.addRelationship(draft);
    const id = draft.explicitId ?? `edge-${this.anonymousEdge++}`;
    occurrences.push(this.entityOccurrence(this.nodes(relationNode.children, "entityName")[0], relation.target, relation.target.explicitDeclaration));
    return {
      kind: "edge",
      span: [0, 0],
      nodes: occurrences,
      edges: [
        {
          id,
          span: [0, 0],
          ...draft.explicitIdLocation ? { idSpan: draft.explicitIdLocation.span } : {},
          ...draft.label ? { labelSpan: draft.label.span } : {}
        }
      ]
    };
  }
  actorItem(ctx) {
    const base = this.visit(this.nodes(ctx, "actorName")[0]);
    const metadataNode = this.nodes(ctx, "metadata")[0];
    const stereotypeNode = this.nodes(ctx, "stereotype")[0];
    const classNode = this.nodes(ctx, "classSuffix")[0];
    const classes = classNode ? this.visit(classNode) : { classes: [], spans: [] };
    return {
      ...base,
      ...metadataNode ? { metadata: this.visit(metadataNode) } : {},
      ...stereotypeNode ? { stereotype: this.visit(stereotypeNode) } : {},
      classes: classes.classes,
      classSpans: classes.spans
    };
  }
  actorName(ctx) {
    const identifier = this.tokens(ctx, "IDENTIFIER")[0];
    const string = this.tokens(ctx, "PLAIN_STRING")[0] ?? this.tokens(ctx, "MARKDOWN_STRING")[0];
    if (identifier) {
      const labelNode = this.nodes(ctx, "nodeLabel")[0];
      const label2 = labelNode ? this.visit(labelNode) : this.tokenLabel(identifier);
      return {
        id: identifier.image,
        label: label2,
        location: this.tokenLocation(identifier),
        generated: false,
        classes: [],
        classSpans: []
      };
    }
    const label = this.tokenLabel(string);
    return {
      id: this.generateId(label.text),
      label,
      location: this.tokenLocation(string),
      generated: true,
      classes: [],
      classSpans: []
    };
  }
  actorDeclarationOnly(ctx) {
    const nodes = this.nodes(ctx, "actorItem");
    const items = nodes.map((node) => this.visit(node));
    for (const item of items) {
      this.builder.addElement(this.actorDraft(item));
    }
    return {
      kind: "node",
      span: [0, 0],
      nodes: items.map((item, index) => this.actorOccurrence(nodes[index], item, true))
    };
  }
  entityStatement(ctx) {
    const entityNodes = this.nodes(ctx, "entityName");
    const source = this.visit(entityNodes[0]);
    const relationNode = this.nodes(ctx, "relationTail")[0];
    if (!relationNode) {
      source.explicitDeclaration = true;
      source.shape ??= "ellipse";
      this.builder.addElement(this.entityDraft(source));
      return {
        kind: "node",
        span: [0, 0],
        nodes: [this.entityOccurrence(entityNodes[0], source, true)]
      };
    }
    if (source.explicitDeclaration) {
      this.builder.addElement(this.entityDraft(source));
    }
    const relation = this.visit(relationNode);
    if (relation.target.explicitDeclaration) {
      this.builder.addElement(this.entityDraft(relation.target));
    }
    const draft = {
      source: this.endpoint(source),
      target: this.endpoint(relation.target),
      location: this.nodeLocation(relationNode),
      ...relation.explicitId ? { explicitId: relation.explicitId, explicitIdLocation: relation.explicitIdLocation } : {},
      ...relation.arrow
    };
    this.builder.addRelationship(draft);
    const id = draft.explicitId ?? `edge-${this.anonymousEdge++}`;
    return {
      kind: "edge",
      span: [0, 0],
      nodes: [
        this.entityOccurrence(entityNodes[0], source, source.explicitDeclaration),
        this.entityOccurrence(this.nodes(relationNode.children, "entityName")[0], relation.target, relation.target.explicitDeclaration)
      ],
      edges: [
        {
          id,
          span: [0, 0],
          ...draft.explicitIdLocation ? { idSpan: draft.explicitIdLocation.span } : {},
          ...draft.label ? { labelSpan: draft.label.span } : {}
        }
      ]
    };
  }
  entityName(ctx) {
    const identifier = this.tokens(ctx, "IDENTIFIER")[0];
    const string = this.tokens(ctx, "PLAIN_STRING")[0] ?? this.tokens(ctx, "MARKDOWN_STRING")[0];
    const labelNode = this.nodes(ctx, "nodeLabel")[0];
    const metadataNode = this.nodes(ctx, "useCaseMetadata")[0];
    const stereotypeNode = this.nodes(ctx, "stereotype")[0];
    const classNode = this.nodes(ctx, "classSuffix")[0];
    const classes = classNode ? this.visit(classNode) : { classes: [], spans: [] };
    if (identifier) {
      const label2 = labelNode ? this.visit(labelNode) : this.tokenLabel(identifier);
      const shape = labelNode ? this.tokens(ctx, "LBRACKET").length ? "rect" : "ellipse" : undefined;
      return {
        id: identifier.image,
        label: label2,
        location: this.tokenLocation(identifier),
        generated: false,
        ...shape ? { shape } : {},
        ...metadataNode ? { metadata: this.visit(metadataNode) } : {},
        ...stereotypeNode ? { stereotype: this.visit(stereotypeNode) } : {},
        classes: classes.classes,
        classSpans: classes.spans,
        explicitDeclaration: Boolean(shape || metadataNode || stereotypeNode)
      };
    }
    const label = this.tokenLabel(string);
    return {
      id: this.generateId(label.text),
      label,
      location: this.tokenLocation(string),
      generated: true,
      ...metadataNode ? { metadata: this.visit(metadataNode) } : {},
      ...stereotypeNode ? { stereotype: this.visit(stereotypeNode) } : {},
      classes: classes.classes,
      classSpans: classes.spans,
      explicitDeclaration: Boolean(metadataNode || stereotypeNode)
    };
  }
  nodeLabel(ctx) {
    const tokens = this.allTokens(ctx);
    if (tokens.length === 1 && (tokens[0].tokenType.name === "PLAIN_STRING" || tokens[0].tokenType.name === "MARKDOWN_STRING")) {
      return this.tokenLabel(tokens[0]);
    }
    const span = [
      tokens[0].startOffset,
      (tokens.at(-1).endOffset ?? tokens.at(-1).startOffset) + 1
    ];
    return { text: this.source.slice(span[0], span[1]), type: "text", span };
  }
  useCaseMetadata(ctx) {
    return this.visit(this.nodes(ctx, "metadata")[0]);
  }
  relationTail(ctx) {
    const explicitId = this.tokens(ctx, "IDENTIFIER")[0];
    return {
      ...explicitId ? { explicitId: explicitId.image, explicitIdLocation: this.tokenLocation(explicitId) } : {},
      arrow: this.visit(this.nodes(ctx, "arrow")[0]),
      target: this.visit(this.nodes(ctx, "entityName")[0])
    };
  }
  arrow(ctx) {
    return this.visit(this.firstNode(ctx, "semanticRelation", "forwardSolidOperator", "backwardSolidOperator", "markerlessSolidOperator", "forwardCircleOperator", "backwardCircleOperator", "forwardCrossOperator", "backwardCrossOperator"));
  }
  edgeLabel(ctx) {
    return this.nodeLabel(ctx);
  }
  semanticRelation(ctx) {
    if (this.tokens(ctx, "GENERALIZATION").length) {
      return { type: "generalization", arrowType: ARROW_TYPE.SOLID_ARROW, minlen: 1 };
    }
    const type = this.tokens(ctx, "INCLUDE").length ? "include" : "extend";
    const token = this.tokens(ctx, type === "include" ? "INCLUDE" : "EXTEND")[0];
    return {
      type,
      arrowType: ARROW_TYPE.SOLID_ARROW,
      label: { text: type, type: "text", span: this.tokenSpan(token) },
      minlen: 1
    };
  }
  metadata(ctx) {
    return {
      properties: this.nodes(ctx, "metadataProperty").map((node) => this.visit(node)),
      location: this.ctxLocation(ctx)
    };
  }
  metadataProperty(ctx) {
    const tokens = this.allTokens(ctx).filter((token) => token.tokenType.name !== "COLON");
    const keyToken = tokens[0];
    const valueToken = tokens[1];
    const value = valueToken.tokenType.name === "TRUE" ? true : valueToken.tokenType.name === "FALSE" ? false : this.decodePlain(valueToken);
    const span = [keyToken.startOffset, (valueToken.endOffset ?? valueToken.startOffset) + 1];
    return {
      key: this.decodePlain(keyToken),
      value,
      span,
      keySpan: this.contentSpan(keyToken),
      valueSpan: this.contentSpan(valueToken),
      location: this.tokenLocation(keyToken)
    };
  }
  metadataSeparator(_ctx) {
    return;
  }
  systemBoundaryStatement(ctx) {
    const boundary = this.visit(this.nodes(ctx, "systemBoundaryName")[0]);
    const classNode = this.nodes(ctx, "classSuffix")[0];
    const classes = classNode ? this.visit(classNode) : { classes: [], spans: [] };
    boundary.classes = classes.classes;
    this.builder.addBoundary(boundary);
    const previous = this.parentBoundary;
    this.parentBoundary = { id: boundary.id, location: boundary.location };
    const contentNode = this.nodes(ctx, "systemBoundaryContent")[0];
    const children = contentNode ? this.visit(contentNode) : [];
    this.parentBoundary = previous;
    const end = this.tokens(ctx, "END")[0];
    const metadataNode = this.nodes(ctx, "metadata")[0];
    const metadata = metadataNode ? this.visit(metadataNode) : undefined;
    const statement = {
      kind: "group",
      span: [0, 0],
      group: boundary.id,
      idSpan: boundary.location.span,
      titleSpan: boundary.label.span,
      endSpan: this.tokenSpan(end),
      classSpans: classes.spans,
      ...metadata ? {
        metadata: metadata.properties.map(({ key, span, keySpan, valueSpan }) => ({
          key,
          span,
          keySpan,
          valueSpan
        }))
      } : {},
      ...children.length ? { children } : {}
    };
    if (metadata) {
      this.builder.addMetadataAssignment(boundary.id, boundary.location, metadata, statement);
    }
    return statement;
  }
  systemBoundaryName(ctx) {
    const identifier = this.tokens(ctx, "IDENTIFIER")[0];
    if (identifier) {
      const labelNode = this.nodes(ctx, "nodeLabel")[0];
      return {
        id: identifier.image,
        label: labelNode ? this.visit(labelNode) : this.tokenLabel(identifier),
        location: this.tokenLocation(identifier),
        generated: false,
        classes: []
      };
    }
    const token = this.tokens(ctx, "PLAIN_STRING")[0] ?? this.tokens(ctx, "MARKDOWN_STRING")[0];
    const label = this.tokenLabel(token);
    return {
      id: this.generateId(label.text),
      label,
      location: this.tokenLocation(token),
      generated: true,
      classes: []
    };
  }
  systemBoundaryContent(ctx) {
    const children = [
      ...this.nodes(ctx, "blankLine"),
      ...this.nodes(ctx, "commentLine"),
      ...this.nodes(ctx, "boundaryElement")
    ].sort((a, b) => (a.location?.startOffset ?? 0) - (b.location?.startOffset ?? 0));
    return children.map((node) => this.wrap(node, this.visit(node)));
  }
  boundaryElement(ctx) {
    const actorNode2 = this.nodes(ctx, "actorDeclarationOnly")[0];
    if (actorNode2) {
      return this.visit(actorNode2);
    }
    const entityNode = this.nodes(ctx, "entityName")[0];
    const entity = this.visit(entityNode);
    entity.explicitDeclaration = true;
    entity.shape ??= "ellipse";
    this.builder.addElement(this.entityDraft(entity));
    return { kind: "node", span: [0, 0], nodes: [this.entityOccurrence(entityNode, entity, true)] };
  }
  metadataAssignmentStatement(ctx) {
    const target = this.visit(this.nodes(ctx, "metadataAssignmentTarget")[0]);
    const metadata = this.visit(this.nodes(ctx, "metadata")[0]);
    const statement = {
      kind: "metadata",
      span: [0, 0],
      nodes: [{ id: target.id, span: target.location.span, idSpan: target.location.span }],
      metadata: metadata.properties.map(({ key, span, keySpan, valueSpan }) => ({
        key,
        span,
        keySpan,
        valueSpan
      }))
    };
    this.builder.addMetadataAssignment(target.id, target.location, metadata, statement);
    return statement;
  }
  metadataAssignmentTarget(ctx) {
    const token = this.allTokens(ctx)[0];
    const label = this.tokenLabel(token);
    return {
      id: token.tokenType.name === "IDENTIFIER" ? token.image : this.generateId(label.text),
      location: this.tokenLocation(token)
    };
  }
  noteStatement(ctx) {
    const target = this.tokens(ctx, "IDENTIFIER")[0];
    const label = this.visit(this.nodes(ctx, "nodeLabel")[0]);
    this.builder.addNote({
      target: target.image,
      targetLocation: this.tokenLocation(target),
      label,
      location: this.ctxLocation(ctx)
    });
    return {
      kind: "note",
      span: [0, 0],
      ref: `note-${this.anonymousNote++}`,
      refSpan: label.span,
      nodes: [{ id: target.image, span: this.tokenSpan(target), idSpan: this.tokenSpan(target) }]
    };
  }
  stereotype(ctx) {
    const token = this.tokens(ctx, "STEREOTYPE_TEXT")[0];
    return { value: token.image.trim(), span: this.tokenSpan(token) };
  }
  classSuffix(ctx) {
    const tokens = this.tokens(ctx, "IDENTIFIER");
    return {
      classes: tokens.map((token) => token.image),
      spans: tokens.map((token) => this.tokenSpan(token))
    };
  }
  jsonStatement(ctx) {
    const start = this.tokens(ctx, "JSON_DECLARATION_START")[0];
    const literal = this.tokens(ctx, "JSON_OBJECT_LITERAL")[0];
    const match = /^json[\t ]+(\w+)/.exec(start.image);
    const id = match[1];
    const relative = match[0].length - id.length;
    const idLocation = {
      span: [start.startOffset + relative, start.startOffset + relative + id.length],
      line: start.startLine ?? 1,
      column: (start.startColumn ?? 1) + relative
    };
    const parsed = parseOrderedJsonObject(literal.image, literal.startLine ?? 1, literal.startColumn ?? 1);
    const classNode = this.nodes(ctx, "classSuffix")[0];
    const classes = classNode ? this.visit(classNode) : { classes: [], spans: [] };
    const draft = {
      id,
      value: parsed.value,
      propertyOrder: parsed.propertyOrder,
      location: idLocation,
      classes: classes.classes
    };
    this.builder.addJson(draft);
    return {
      kind: "json",
      span: [0, 0],
      nodes: [
        {
          id,
          span: idLocation.span,
          idSpan: idLocation.span,
          defines: true,
          classSpans: classes.spans
        }
      ],
      classSpans: classes.spans
    };
  }
  directionStatement(ctx) {
    const token = this.allTokens(ctx).find((value) => ["TD", "TB", "BT", "RL", "LR"].includes(value.tokenType.name));
    this.builder.setDirection(token.image);
    return { kind: "direction", span: [0, 0] };
  }
  classDefStatement(ctx) {
    const ids = this.tokens(ctx, "IDENTIFIER");
    const styles = this.visit(this.nodes(ctx, "styles")[0]);
    this.builder.addClassDef(ids.map((token) => token.image), styles);
    return { kind: "classDef", span: [0, 0], ref: ids[0].image, refSpan: this.tokenSpan(ids[0]) };
  }
  classStatement(ctx) {
    const ids = this.tokens(ctx, "IDENTIFIER");
    let split = 1;
    for (;split < ids.length; split++) {
      const between = this.source.slice((ids[split - 1].endOffset ?? ids[split - 1].startOffset) + 1, ids[split].startOffset);
      if (!between.includes(",")) {
        break;
      }
    }
    const targets = ids.slice(0, split).map((token) => ({ id: token.image, location: this.tokenLocation(token) }));
    const classes = ids.slice(split).map((token) => token.image);
    this.builder.addClassAssignment(targets, classes);
    return {
      kind: "classAssign",
      span: [0, 0],
      ref: classes[0],
      refSpan: this.tokenSpan(ids[split]),
      nodes: targets.map(({ id, location }) => ({
        id,
        span: location.span,
        idSpan: location.span
      }))
    };
  }
  styleStatement(ctx) {
    const target = this.tokens(ctx, "IDENTIFIER")[0];
    const styles = this.visit(this.nodes(ctx, "styles")[0]);
    this.builder.addStyleAssignment(target.image, this.tokenLocation(target), styles);
    return {
      kind: "style",
      span: [0, 0],
      nodes: [{ id: target.image, span: this.tokenSpan(target), idSpan: this.tokenSpan(target) }]
    };
  }
  styles(ctx) {
    return this.nodes(ctx, "styleValue").map((node) => this.visit(node));
  }
  styleValue(ctx) {
    const tokens = this.allTokens(ctx);
    const span = [
      tokens[0].startOffset,
      (tokens.at(-1).endOffset ?? tokens.at(-1).startOffset) + 1
    ];
    return this.source.slice(span[0], span[1]).replaceAll("\\,", ",");
  }
  styleComponent(ctx) {
    return this.allTokens(ctx).map((token) => token.image).join("");
  }
  forwardSolidOperator(ctx) {
    const token = this.tokens(ctx, "FORWARD_SOLID")[0];
    return {
      type: "association",
      arrowType: ARROW_TYPE.SOLID_ARROW,
      minlen: this.solidMinlen(token)
    };
  }
  backwardSolidOperator(ctx) {
    const token = this.tokens(ctx, "BACKWARD_SOLID")[0];
    const labelNode = this.nodes(ctx, "edgeLabel")[0];
    const lengthToken = labelNode ? this.tokens(ctx, "MARKERLESS_SOLID").at(-1) : token;
    return {
      type: "association",
      arrowType: ARROW_TYPE.BACK_ARROW,
      minlen: this.solidMinlen(lengthToken),
      ...labelNode ? { label: this.visit(labelNode) } : {}
    };
  }
  markerlessSolidOperator(ctx) {
    const labelNode = this.nodes(ctx, "edgeLabel")[0];
    const tokens = this.allTokens(ctx);
    if (!labelNode) {
      return {
        type: "association",
        arrowType: ARROW_TYPE.LINE_SOLID,
        minlen: this.solidMinlen(this.tokens(ctx, "MARKERLESS_SOLID")[0])
      };
    }
    const last2 = tokens.at(-1);
    const arrowType = last2.tokenType.name === "FORWARD_SOLID" ? ARROW_TYPE.SOLID_ARROW : last2.tokenType.name === "FORWARD_CIRCLE" ? ARROW_TYPE.CIRCLE_ARROW : last2.tokenType.name === "FORWARD_CROSS" ? ARROW_TYPE.CROSS_ARROW : ARROW_TYPE.LINE_SOLID;
    return {
      type: "association",
      arrowType,
      label: this.visit(labelNode),
      minlen: arrowType === ARROW_TYPE.SOLID_ARROW || arrowType === ARROW_TYPE.LINE_SOLID ? this.solidMinlen(last2) : 1
    };
  }
  forwardCircleOperator(_ctx) {
    return { type: "association", arrowType: ARROW_TYPE.CIRCLE_ARROW, minlen: 1 };
  }
  backwardCircleOperator(ctx) {
    const labelNode = this.nodes(ctx, "edgeLabel")[0];
    return {
      type: "association",
      arrowType: ARROW_TYPE.CIRCLE_ARROW_REVERSED,
      minlen: 1,
      ...labelNode ? { label: this.visit(labelNode) } : {}
    };
  }
  forwardCrossOperator(_ctx) {
    return { type: "association", arrowType: ARROW_TYPE.CROSS_ARROW, minlen: 1 };
  }
  backwardCrossOperator(ctx) {
    const labelNode = this.nodes(ctx, "edgeLabel")[0];
    return {
      type: "association",
      arrowType: ARROW_TYPE.CROSS_ARROW_REVERSED,
      minlen: 1,
      ...labelNode ? { label: this.visit(labelNode) } : {}
    };
  }
  actorDraft(item) {
    return {
      id: item.id,
      kind: "actor",
      label: item.label,
      location: item.location,
      generated: item.generated,
      ...this.parentBoundary ? { parentId: this.parentBoundary.id, parentLocation: this.parentBoundary.location } : {},
      ...item.metadata ? { metadata: item.metadata } : {},
      ...item.stereotype ? { stereotype: item.stereotype.value, stereotypeSpan: item.stereotype.span } : {},
      classes: item.classes
    };
  }
  entityDraft(entity) {
    return {
      id: entity.id,
      kind: "usecase",
      label: entity.label,
      location: entity.location,
      generated: entity.generated,
      ...this.parentBoundary ? { parentId: this.parentBoundary.id, parentLocation: this.parentBoundary.location } : {},
      ...entity.shape ? { shape: entity.shape } : {},
      ...entity.metadata ? { metadata: entity.metadata } : {},
      ...entity.stereotype ? { stereotype: entity.stereotype.value, stereotypeSpan: entity.stereotype.span } : {},
      classes: entity.classes
    };
  }
  endpoint(entity, declaration = entity.explicitDeclaration ?? true) {
    return {
      id: entity.id,
      label: entity.label,
      location: entity.location,
      generated: entity.generated,
      declaration,
      classesOnReference: entity.classes.length > 0
    };
  }
  relationshipDraft(source, tail, location) {
    return {
      source: this.endpoint(source, true),
      target: this.endpoint(tail.target),
      location,
      ...tail.explicitId ? { explicitId: tail.explicitId, explicitIdLocation: tail.explicitIdLocation } : {},
      ...tail.arrow
    };
  }
  actorOccurrence(node, item, defines) {
    return {
      id: item.id,
      span: this.nodeSpan(node),
      idSpan: item.location.span,
      labelSpan: item.label.span,
      ...defines ? { defines: true } : {},
      ...item.stereotype ? { stereotypeSpan: item.stereotype.span } : {},
      ...item.metadata ? {
        metadata: item.metadata.properties.map(({ key, span, keySpan, valueSpan }) => ({
          key,
          span,
          keySpan,
          valueSpan
        }))
      } : {},
      ...item.classSpans.length ? { classSpans: item.classSpans } : {}
    };
  }
  entityOccurrence(node, item, defines) {
    return this.actorOccurrence(node, item, defines);
  }
  wrap(node, statement) {
    if (statement.kind === "blank" || statement.kind === "comment") {
      return statement;
    }
    statement.span = this.nodeSpan(node);
    for (const edge of statement.edges ?? []) {
      edge.span = statement.span;
    }
    return statement;
  }
  tokenLabel(token) {
    const type = token.tokenType.name === "MARKDOWN_STRING" ? "markdown" : "text";
    const trim = type === "markdown" ? 2 : token.tokenType.name === "PLAIN_STRING" ? 1 : 0;
    const span = this.tokenSpan(token, trim);
    return { text: this.source.slice(span[0], span[1]), type, span };
  }
  decodePlain(token) {
    return token.tokenType.name === "PLAIN_STRING" ? token.image.slice(1, -1) : token.image;
  }
  contentSpan(token) {
    return this.tokenSpan(token, token.tokenType.name === "PLAIN_STRING" ? 1 : token.tokenType.name === "MARKDOWN_STRING" ? 2 : 0);
  }
  generateId(label) {
    return label.replace(/\W/g, "_");
  }
  solidMinlen(token) {
    return Math.max(1, (token.image.match(/-/g)?.length ?? 2) - 1);
  }
  nodeLocation(node) {
    const first2 = this.allTokens(node.children)[0];
    return {
      span: this.nodeSpan(node),
      line: first2.startLine ?? 1,
      column: first2.startColumn ?? 1
    };
  }
  ctxLocation(ctx) {
    const tokens = this.allTokens(ctx).filter((token) => token.tokenType.name !== "NEWLINE" && token.tokenType.name !== "EOF");
    const first2 = tokens[0];
    const last2 = tokens.at(-1);
    return {
      span: [
        first2.startOffset,
        Math.min(this.source.length, (last2.endOffset ?? last2.startOffset + last2.image.length - 1) + 1)
      ],
      line: first2.startLine ?? 1,
      column: first2.startColumn ?? 1
    };
  }
  tokenLocation(token) {
    const trim = token.tokenType.name === "PLAIN_STRING" ? 1 : token.tokenType.name === "MARKDOWN_STRING" ? 2 : 0;
    return {
      span: this.tokenSpan(token, trim),
      line: token.startLine ?? 1,
      column: (token.startColumn ?? 1) + trim
    };
  }
  nodeSpan(node) {
    const tokens = this.allTokens(node.children).filter((token) => token.tokenType.name !== "NEWLINE" && token.tokenType.name !== "EOF");
    const first2 = tokens[0];
    const last2 = tokens.at(-1);
    if (!first2 || !last2) {
      throw new Error("Usecase CST node has no source token");
    }
    return [
      first2.startOffset,
      Math.min(this.source.length, (last2.endOffset ?? last2.startOffset + last2.image.length - 1) + 1)
    ];
  }
  tokenSpan(token, trim = 0) {
    return [
      token.startOffset + trim,
      Math.min(this.source.length, (token.endOffset ?? token.startOffset + token.image.length - 1) + 1 - trim)
    ];
  }
  nodes(ctx, key) {
    return (ctx[key] ?? []).filter((item) => ("children" in item));
  }
  tokens(ctx, key) {
    return (ctx[key] ?? []).filter((item) => ("tokenTypeIdx" in item));
  }
  firstNode(ctx, ...keys2) {
    for (const key of keys2) {
      const node = this.nodes(ctx, key)[0];
      if (node) {
        return node;
      }
    }
    throw new Error(`Usecase CST is missing one of: ${keys2.join(", ")}`);
  }
  allTokens(ctx) {
    const result = [];
    for (const values2 of Object.values(ctx)) {
      for (const value of values2) {
        if ("tokenTypeIdx" in value) {
          result.push(value);
        } else {
          result.push(...this.allTokens(value.children));
        }
      }
    }
    return result.sort((a, b) => a.startOffset - b.startOffset);
  }
};
var usecaseVisitor = new UsecaseVisitor;
var parser = {
  parse: /* @__PURE__ */ __name(async (input) => {
    db.clear();
    usecaseParser.input = [];
    try {
      runChevrotainParse({
        diagramType: "usecase",
        lexer: usecaseLexer,
        parser: usecaseParser,
        entry: /* @__PURE__ */ __name(() => usecaseParser.start(), "entry"),
        visit: /* @__PURE__ */ __name((cst) => usecaseVisitor.build(cst, input), "visit")
      }, input);
    } catch (error) {
      db.clear();
      const parseError = usecaseParser.errors[0];
      if (parseError) {
        const { token } = parseError;
        const start = Number.isFinite(token.startOffset) ? token.startOffset : input.length;
        const end = typeof token.endOffset === "number" && Number.isFinite(token.endOffset) ? token.endOffset + 1 : start;
        const line = token.startLine ?? input.slice(0, start).split(/\r\n|\r|\n/).length;
        const lineStart = Math.max(input.lastIndexOf(`
`, start - 1), input.lastIndexOf("\r", start - 1));
        const column = token.startColumn ?? start - lineStart;
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`${message} at line ${line}, column ${column} [${start},${end})`);
      }
      throw error;
    }
  }, "parse")
};
var USECASE_MARKERS = [
  "point",
  "circle",
  "cross",
  "extension"
];
var ACTOR_SHAPES = {
  usecaseActor: true,
  usecaseActorHollow: true,
  usecaseActorAwesome: true,
  usecaseActorIcon: true
};
var usecaseDomId = /* @__PURE__ */ __name((diagramId, modelId) => {
  const [safeDiagramId, safeModelId] = [diagramId, modelId].map((value) => value.replace(/[^\w-]+/g, "_").replace(/^_+|_+$/g, "") || "element");
  return `usecase-${safeDiagramId}-${safeModelId}`;
}, "usecaseDomId");
var usecaseNodeDomId = /* @__PURE__ */ __name((modelId) => `usecase-${modelId.replace(/[^\w-]+/g, "_").replace(/^_+|_+$/g, "") || "element"}`, "usecaseNodeDomId");
var getAccessibleLabel = /* @__PURE__ */ __name((label, labelType) => {
  if (labelType !== "markdown") {
    return label;
  }
  return markdownToLines(label).map((line) => line.map((word) => word.content).join(" ")).join(`
`);
}, "getAccessibleLabel");
var getUsecaseNodeAccessibleName = /* @__PURE__ */ __name((node) => {
  const label = getAccessibleLabel(node.label ?? node.id, node.labelType);
  if (ACTOR_SHAPES[node.shape]) {
    const variant = node.actorType && node.actorType !== "normal" ? `${node.actorType} ` : "";
    const business = node.business ? "business " : "";
    const stereotype2 = node.stereotype ? `, stereotype ${node.stereotype}` : "";
    return `${business}${variant}actor ${label}${stereotype2}`;
  }
  if (node.shape === "note") {
    return `Note for ${node.noteTargetLabel ?? node.noteTarget ?? ""}: ${label}`;
  }
  if (node.shape === "usecaseJsonTable") {
    const rows = (node.jsonRows ?? []).map((row) => `${row.accessibleKey}: ${row.value}`).join("; ");
    return rows ? `${label}: ${rows}` : label;
  }
  const stereotype = node.stereotype ? `, stereotype ${node.stereotype}` : "";
  return `${node.business ? "business " : ""}use case ${label}${stereotype}`;
}, "getUsecaseNodeAccessibleName");
var getUsecaseBoundaryAccessibleName = /* @__PURE__ */ __name((boundary) => `${boundary.boundaryType} system boundary ${getAccessibleLabel(boundary.label ?? boundary.id, boundary.labelType)}`, "getUsecaseBoundaryAccessibleName");
var getUsecaseEdgeAccessibleName = /* @__PURE__ */ __name((edge) => {
  if (edge.relationshipType === "note") {
    return "";
  }
  const relation = edge.relationshipType === "association" && edge.label ? `association ${getAccessibleLabel(edge.label, edge.labelType)}` : edge.relationshipType;
  return `${relation} from ${edge.sourceLabel} to ${edge.targetLabel}`;
}, "getUsecaseEdgeAccessibleName");
var escapePlainLabel = /* @__PURE__ */ __name((label) => label.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"), "escapePlainLabel");
var escapeMarkdownMarkers = /* @__PURE__ */ __name((label) => label.replace(/([*[\\\]_`])/g, "\\$1"), "escapeMarkdownMarkers");
var prepareUsecaseLayoutData = /* @__PURE__ */ __name((data, diagramId) => {
  data.diagramId = diagramId;
  data.markers = [...USECASE_MARKERS];
  for (const node of data.nodes) {
    const renderingNode = node;
    renderingNode.domId = usecaseNodeDomId(node.id);
    if (node.label !== undefined && node.labelType === "text") {
      node.label = escapePlainLabel(node.label);
    }
    if (node.stereotype) {
      node.stereotype = escapePlainLabel(node.stereotype);
    }
    if (!node.isGroup && node.shape === "usecaseJsonTable") {
      node.jsonRows = node.jsonRows?.map((row) => ({
        ...row,
        key: escapePlainLabel(row.key),
        value: escapePlainLabel(row.value)
      }));
    }
    if (!node.isGroup && (node.shape === "usecaseEllipse" || node.shape === "rect") && node.stereotype) {
      const label = node.label ?? escapePlainLabel(node.id);
      node.label = `«${escapeMarkdownMarkers(node.stereotype)}»<br/>${node.labelType === "text" ? escapeMarkdownMarkers(label) : label}`;
      node.labelType = "markdown";
      renderingNode.hasFoldedStereotype = true;
      delete node.stereotype;
    }
  }
  for (const edge of data.edges) {
    if (edge.label !== undefined && edge.labelType === "text") {
      edge.label = escapePlainLabel(edge.label);
    }
  }
  return data;
}, "prepareUsecaseLayoutData");
var annotateUsecaseElements = /* @__PURE__ */ __name((svg, data, accessibleNames) => {
  for (const node of data.nodes) {
    const stableDomId = typeof node.domId === "string" ? node.domId : usecaseDomId(data.diagramId, node.id);
    const element = svg.select(`#${stableDomId}`);
    const kind = node.isGroup ? "boundary" : ACTOR_SHAPES[node.shape] ? "actor" : node.shape === "note" ? "note" : node.shape === "usecaseJsonTable" ? "json" : "usecase";
    const accessibleName = accessibleNames.nodes.get(node.id) ?? node.id;
    element.attr("data-usecase-id", node.id).attr("data-usecase-kind", kind).attr("role", "img").attr("aria-label", accessibleName);
    if (!node.isGroup && (node.shape === "usecaseEllipse" || node.shape === "rect") && "hasFoldedStereotype" in node && node.hasFoldedStereotype === true) {
      const root2 = element.node();
      const htmlLabel = root2?.querySelector(".nodeLabel");
      const container = htmlLabel?.querySelector("p") ?? htmlLabel;
      const firstLabelNode = container?.firstChild;
      if (container && firstLabelNode?.nodeType === 3) {
        const stereotype = container.ownerDocument.createElement("span");
        stereotype.className = "usecase-stereotype";
        container.insertBefore(stereotype, firstLabelNode);
        stereotype.appendChild(firstLabelNode);
      } else {
        root2?.querySelector(".label tspan tspan, .label tspan")?.classList.add("usecase-stereotype");
      }
    }
  }
  const edgesById = new Map(data.edges.map((edge) => [edge.id, edge]));
  svg.selectAll('path[data-et="edge"]').each(function() {
    const edge = edgesById.get(this.getAttribute("data-id") ?? "");
    if (!edge) {
      return;
    }
    const path = select_default(this);
    path.attr("id", usecaseDomId(data.diagramId, edge.id)).attr("data-usecase-id", edge.id).attr("data-usecase-kind", edge.internal ? "note-connector" : "relationship");
    if (edge.internal) {
      path.attr("aria-hidden", "true");
    } else {
      path.attr("role", "img").attr("aria-label", accessibleNames.edges.get(edge.id) ?? edge.id);
    }
  });
}, "annotateUsecaseElements");
var applyUsecaseFonts = /* @__PURE__ */ __name((svg, data) => {
  svg.style("--mermaid-usecase-actor-font-size", `${data.actorFontSize}px`).style("--mermaid-usecase-actor-font-family", data.actorFontFamily).style("--mermaid-usecase-actor-font-weight", data.actorFontWeight).style("--mermaid-usecase-font-size", `${data.usecaseFontSize}px`).style("--mermaid-usecase-font-family", data.usecaseFontFamily).style("--mermaid-usecase-font-weight", data.usecaseFontWeight);
}, "applyUsecaseFonts");
var draw = /* @__PURE__ */ __name(async (_text, id, _version, diag) => {
  log.info("Drawing usecase diagram (unified)", id);
  const { layout } = getConfig2();
  const usecaseDb = diag.db;
  const data4Layout = usecaseDb.getData();
  const accessibleLabels = new Map(data4Layout.nodes.map((node) => [
    node.id,
    getAccessibleLabel(node.label ?? node.id, node.labelType)
  ]));
  const accessibleNames = {
    nodes: new Map(data4Layout.nodes.map((node) => [
      node.id,
      node.isGroup ? getUsecaseBoundaryAccessibleName(node) : getUsecaseNodeAccessibleName(node.shape === "note" ? { ...node, noteTargetLabel: accessibleLabels.get(node.noteTarget ?? "") } : node)
    ])),
    edges: new Map(data4Layout.edges.map((edge) => [
      edge.id,
      getUsecaseEdgeAccessibleName({
        ...edge,
        sourceLabel: accessibleLabels.get(edge.source) ?? edge.sourceLabel,
        targetLabel: accessibleLabels.get(edge.target) ?? edge.targetLabel
      })
    ]))
  };
  const svg = getDiagramElement(id, data4Layout.config.securityLevel);
  data4Layout.layoutAlgorithm = getRegisteredLayoutAlgorithm(layout);
  prepareUsecaseLayoutData(data4Layout, id);
  applyUsecaseFonts(svg, data4Layout);
  await render(data4Layout, svg);
  annotateUsecaseElements(svg, data4Layout, accessibleNames);
  const padding = data4Layout.diagramPadding;
  utils_default.insertTitle(svg, "usecaseDiagramTitleText", 0, usecaseDb.getDiagramTitle?.() ?? "");
  setupViewPortForSVG(svg, padding, "usecaseDiagram", data4Layout.useMaxWidth);
  applyUsecaseFonts(svg, data4Layout);
}, "draw");
var renderer = { draw };
var roleColors = /* @__PURE__ */ __name((options) => ({
  actorBkg: options.usecaseActorBkg ?? options.actorBkg ?? options.mainBkg,
  actorBorder: options.usecaseActorBorder ?? options.actorBorder ?? options.primaryColor,
  bkg: options.usecaseBkg ?? options.mainBkg,
  border: options.usecaseBorder ?? options.nodeBorder ?? options.primaryColor,
  boundaryBkg: options.usecaseBoundaryBkg ?? options.clusterBkg,
  boundaryBorder: options.usecaseBoundaryBorder ?? options.clusterBorder,
  includeLine: options.usecaseIncludeLine ?? options.lineColor,
  extendLine: options.usecaseExtendLine ?? options.lineColor
}), "roleColors");
var genColor = /* @__PURE__ */ __name((options) => {
  const { theme, bkgColorArray, borderColorArray } = options;
  if (!isColorTheme(theme, borderColorArray)) {
    return "";
  }
  const rotate = getConfig().usecase?.colorScheme === "rotate";
  const look = safeLook(options.look);
  const isHandDrawn = look === "handDrawn";
  const hasBkgColors = hasPalette(bkgColorArray);
  let sections = "";
  for (let i = 0;i < paletteSlotCount(borderColorArray); i++) {
    const borderColor = borderColorArray[i];
    const fill = hasBkgColors ? `fill: ${bkgColorArray[i % bkgColorArray.length]};` : "";
    const slot = `[data-look="${look}"][data-color-id="color-${i}"]`;
    sections += `

    & ${slot}.system-boundary rect.boundary-body,
    & ${slot}.system-boundary rect.boundary-tab,
    & ${slot}.system-boundary .boundary-body path,
    & ${slot}.system-boundary .boundary-tab path {
      stroke: ${borderColor};
      ${fill}
    }
    `;
    if (!rotate) {
      continue;
    }
    sections += `

    /* Use case bodies -- \`.usecase-element\` covers the ellipse form, the \`[Rect]\` form and
       the business variant.

       Element selectors only, never a bare \`path\`. Under the handDrawn look roughjs draws
       the body as a *pair* of paths, an outline stroked in the border colour and a hachure
       fill stroked in the background colour, with no class to tell them apart. Stroking
       both repaints the fill lines as border colour and the shape collapses into a solid
       block -- which is what \`.usecase-element path\` did. So handDrawn bodies keep the
       theme's uniform colours, exactly as handDrawn flowchart nodes do. */
    & ${slot}.usecase-element ellipse,
    & ${slot}.usecase-element rect {
      stroke: ${borderColor};
      ${fill}
    }

    /* The business marker is a single classed path, so it can be reached safely by name --
       without it the marker keeps the uniform border beside a palette-coloured body. No
       \`fill\`: the marker is drawn with \`fill="none"\` and has to stay that way. */
    & ${slot}.usecase-element .usecase-business-marker {
      stroke: ${borderColor};
    }

    /* Actor glyphs, mirroring the uniform rule further down. The fill goes on the glyph
       group, never on its children, so the hollow variant's own \`fill="none"\` keeps
       winning and a hollow actor stays hollow. Same reason as above for not descending
       into the handDrawn paths. */
    & ${slot}.usecase-actor .usecase-actor-shape,
    & ${slot}.usecase-actor .usecase-actor-hollow,
    & ${slot}.usecase-actor .usecase-actor-awesome,
    & ${slot}.usecase-actor .usecase-actor-icon {
      stroke: ${borderColor};
      ${fill}
    }
${isHandDrawn ? "" : `
    /* The group rule above reaches the glyph by inheritance, which the neo look breaks: it
       ships a \`[data-look="neo"].node path { stroke }\` rule that hits the glyph's own paths,
       and a value set directly on the child always beats one inherited from the parent,
       whatever the parent rule's specificity. So name the children too.

       Emitted for every look *except* handDrawn, where roughjs draws the glyph as an
       outline path plus a hachure fill path stroked in the fill colour, indistinguishable
       in CSS -- stroking both turns a hollow actor into a solid disc. Deliberately no
       \`fill\` either way, so the hollow variant's own \`fill="none"\` keeps winning. */
    & ${slot}.usecase-actor .usecase-actor-glyph path,
    & ${slot}.usecase-actor .usecase-actor-glyph circle {
      stroke: ${borderColor};
    }
`}
    `;
  }
  return sections;
}, "genColor");
var getStyles = /* @__PURE__ */ __name((options) => {
  const role = roleColors(options);
  const isHandDrawn = safeLook(options.look) === "handDrawn";
  return `
  ${genColor(options)}
  & .usecase-actor {
    color: ${options.actorTextColor ?? options.primaryTextColor};
  }

  & .usecase-actor-shape,
  & .usecase-actor-hollow,
  & .usecase-actor-awesome,
  & .usecase-actor-icon {
    fill: ${role.actorBkg};
    stroke: ${role.actorBorder};
    stroke-width: 2px;
  }
${isHandDrawn ? "" : `
  /* The rule above colours the glyph group and lets its children inherit, which the neo
     look breaks: it ships a \`[data-look="neo"].node path { stroke }\` rule that lands on
     the glyph's own paths, and a value set directly on a child always beats one inherited
     from its parent, whatever the parent rule's specificity. Since neo is the default look,
     without this every actor renders in the node border colour rather than the actor
     colour the rule above asks for.

     \`.node\` is in the selector to outrank that neo rule rather than tie with it: both
     would otherwise be one attribute plus one class plus one element, leaving the winner to
     depend on which stylesheet is concatenated last.

     Stroke only: the hollow variant's own \`fill="none"\` has to keep winning. */
  & .node.usecase-actor .usecase-actor-glyph path,
  & .node.usecase-actor .usecase-actor-glyph circle {
    stroke: ${role.actorBorder};
  }
`}
  & .usecase-actor .nodeLabel,
  & .actor-label {
    color: ${options.actorTextColor ?? options.primaryTextColor};
    fill: ${options.actorTextColor ?? options.primaryTextColor};
    font-family: var(--mermaid-usecase-actor-font-family, ${options.fontFamily});
    font-size: var(--mermaid-usecase-actor-font-size, 14px);
    font-weight: var(--mermaid-usecase-actor-font-weight, normal);
  }

  & .usecase-element ellipse,
  & .usecase-element rect,
  & .usecase-business ellipse,
  & .usecase-business rect {
    fill: ${role.bkg};
    stroke: ${role.border};
    stroke-width: 2px;
  }
${isHandDrawn ? "" : `
  /* The same interception the actor glyph hits, one element down: neo ships
     \`[data-look="neo"].node rect { stroke: nodeBorder }\`, which outranks the plain
     \`.usecase-element rect\` above, so a use case written in the \`[Rect]\` form kept the node
     border colour while its ellipse siblings took the role colour. An \`<ellipse>\` has no
     equivalent neo rule and is already correct; restating it here costs nothing and means
     the two forms cannot drift apart again.

     Qualified with \`[data-look]\` *and* \`.node\` to land strictly above that rule rather than
     tie with it -- on a tie the later stylesheet would win, which is how neo took this in
     the first place. Skipped under handDrawn, where roughjs draws paths and neither element
     exists. */
  & [data-look="${safeLook(options.look)}"].node.usecase-element ellipse,
  & [data-look="${safeLook(options.look)}"].node.usecase-element rect {
    fill: ${role.bkg};
    stroke: ${role.border};
  }

  /* The business marker is a \`<path>\`, so it loses to \`[data-look="neo"].node path\` the same
     way. No \`fill\`: the marker is drawn with \`fill="none"\` and has to stay that way. */
  & [data-look="${safeLook(options.look)}"].node.usecase-element .usecase-business-marker {
    stroke: ${role.border};
  }
`}
  & .usecase-element .nodeLabel,
  & .usecase-label {
    color: ${options.primaryTextColor};
    fill: ${options.primaryTextColor};
    font-family: var(--mermaid-usecase-font-family, ${options.fontFamily});
    font-size: var(--mermaid-usecase-font-size, 12px);
    font-weight: var(--mermaid-usecase-font-weight, normal);
  }

  & .usecase-stereotype,
  & .usecase-business-marker {
    color: ${options.primaryTextColor};
    fill: ${options.primaryTextColor};
    stroke: ${role.border};
  }

  & .system-boundary rect.boundary-body,
  & .system-boundary rect.boundary-tab,
  & .system-boundary-package-tab {
    fill: ${role.boundaryBkg};
    stroke: ${role.boundaryBorder};
    stroke-width: 1px;
  }

  & .system-boundary-title text {
    fill: ${options.titleColor ?? options.primaryTextColor};
  }

  /* Only the span, never the <p> inside it: the renderer puts a user-supplied
     'color' on the span, and that has to stay inheritable by its children. */
  & .system-boundary-title span {
    color: ${options.titleColor ?? options.primaryTextColor};
  }

  & .usecase-note {
    fill: ${options.noteBkgColor};
    stroke: ${options.noteBorderColor};
    color: ${options.noteTextColor};
  }

  & .usecase-note .nodeLabel {
    color: ${options.noteTextColor};
    fill: ${options.noteTextColor};
  }

  & .usecase-json-table,
  & .usecase-json-table rect,
  & .usecase-json-cell {
    fill: ${options.mainBkg};
    stroke: ${options.nodeBorder ?? options.primaryColor};
  }

  & .usecase-json-title,
  & .usecase-json-key,
  & .usecase-json-value {
    color: ${options.primaryTextColor};
    fill: ${options.primaryTextColor};
  }

  & .relationship {
    fill: none;
    stroke: ${options.lineColor};
  }

  & .relationship-include,
  & .relationship-extend,
  & .relationship-note {
    stroke-dasharray: 3;
  }

  /* Include and extend are both dashed, which is a weak distinction at small sizes. The
     tokens default to \`lineColor\`, so a theme that does not set them is unchanged. */
  & .relationship-include {
    stroke: ${role.includeLine};
  }

  & .relationship-extend {
    stroke: ${role.extendLine};
  }

  & .relationship.edge-animation-fast,
  & .relationship.edge-animation-slow {
    stroke-linecap: round;
  }

  & .edgeLabel,
  & .edgeLabel p {
    background-color: ${options.edgeLabelBackground};
  }

  & .labelBkg {
    background-color: ${options.edgeLabelBackground};
    padding: 0 2px;
  }

  & .edgeLabel .label rect {
    fill: ${options.edgeLabelBackground};
  }

  & .relationship-label,
  & .edgeLabel {
    color: ${options.primaryTextColor};
    fill: ${options.primaryTextColor};
    font-family: ${options.fontFamily};
    font-size: 10px;
    font-weight: normal;
  }

  & .marker,
  & .marker.point,
  & .marker.circle,
  & .marker.cross {
    fill: ${options.lineColor};
    stroke: ${options.lineColor};
  }

  & .marker.extension {
    fill: ${options.mainBkg};
    stroke: ${options.lineColor};
  }
`;
}, "getStyles");
var styles_default = getStyles;
var diagram = {
  parser,
  db,
  renderer,
  styles: styles_default
};
export {
  diagram
};

//# debugId=6FB6EE20E2A6885064756E2164756E21
