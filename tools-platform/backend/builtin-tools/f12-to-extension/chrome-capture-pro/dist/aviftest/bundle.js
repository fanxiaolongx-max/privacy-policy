/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./node_modules/lodash/_DataView.js":
/*!******************************************!*\
  !*** ./node_modules/lodash/_DataView.js ***!
  \******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var getNative = __webpack_require__(/*! ./_getNative */ "./node_modules/lodash/_getNative.js"),
    root = __webpack_require__(/*! ./_root */ "./node_modules/lodash/_root.js");

/* Built-in method references that are verified to be native. */
var DataView = getNative(root, 'DataView');

module.exports = DataView;


/***/ }),

/***/ "./node_modules/lodash/_Hash.js":
/*!**************************************!*\
  !*** ./node_modules/lodash/_Hash.js ***!
  \**************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var hashClear = __webpack_require__(/*! ./_hashClear */ "./node_modules/lodash/_hashClear.js"),
    hashDelete = __webpack_require__(/*! ./_hashDelete */ "./node_modules/lodash/_hashDelete.js"),
    hashGet = __webpack_require__(/*! ./_hashGet */ "./node_modules/lodash/_hashGet.js"),
    hashHas = __webpack_require__(/*! ./_hashHas */ "./node_modules/lodash/_hashHas.js"),
    hashSet = __webpack_require__(/*! ./_hashSet */ "./node_modules/lodash/_hashSet.js");

/**
 * Creates a hash object.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function Hash(entries) {
  var index = -1,
      length = entries == null ? 0 : entries.length;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}

// Add methods to `Hash`.
Hash.prototype.clear = hashClear;
Hash.prototype['delete'] = hashDelete;
Hash.prototype.get = hashGet;
Hash.prototype.has = hashHas;
Hash.prototype.set = hashSet;

module.exports = Hash;


/***/ }),

/***/ "./node_modules/lodash/_ListCache.js":
/*!*******************************************!*\
  !*** ./node_modules/lodash/_ListCache.js ***!
  \*******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var listCacheClear = __webpack_require__(/*! ./_listCacheClear */ "./node_modules/lodash/_listCacheClear.js"),
    listCacheDelete = __webpack_require__(/*! ./_listCacheDelete */ "./node_modules/lodash/_listCacheDelete.js"),
    listCacheGet = __webpack_require__(/*! ./_listCacheGet */ "./node_modules/lodash/_listCacheGet.js"),
    listCacheHas = __webpack_require__(/*! ./_listCacheHas */ "./node_modules/lodash/_listCacheHas.js"),
    listCacheSet = __webpack_require__(/*! ./_listCacheSet */ "./node_modules/lodash/_listCacheSet.js");

/**
 * Creates an list cache object.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function ListCache(entries) {
  var index = -1,
      length = entries == null ? 0 : entries.length;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}

// Add methods to `ListCache`.
ListCache.prototype.clear = listCacheClear;
ListCache.prototype['delete'] = listCacheDelete;
ListCache.prototype.get = listCacheGet;
ListCache.prototype.has = listCacheHas;
ListCache.prototype.set = listCacheSet;

module.exports = ListCache;


/***/ }),

/***/ "./node_modules/lodash/_Map.js":
/*!*************************************!*\
  !*** ./node_modules/lodash/_Map.js ***!
  \*************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var getNative = __webpack_require__(/*! ./_getNative */ "./node_modules/lodash/_getNative.js"),
    root = __webpack_require__(/*! ./_root */ "./node_modules/lodash/_root.js");

/* Built-in method references that are verified to be native. */
var Map = getNative(root, 'Map');

module.exports = Map;


/***/ }),

/***/ "./node_modules/lodash/_MapCache.js":
/*!******************************************!*\
  !*** ./node_modules/lodash/_MapCache.js ***!
  \******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var mapCacheClear = __webpack_require__(/*! ./_mapCacheClear */ "./node_modules/lodash/_mapCacheClear.js"),
    mapCacheDelete = __webpack_require__(/*! ./_mapCacheDelete */ "./node_modules/lodash/_mapCacheDelete.js"),
    mapCacheGet = __webpack_require__(/*! ./_mapCacheGet */ "./node_modules/lodash/_mapCacheGet.js"),
    mapCacheHas = __webpack_require__(/*! ./_mapCacheHas */ "./node_modules/lodash/_mapCacheHas.js"),
    mapCacheSet = __webpack_require__(/*! ./_mapCacheSet */ "./node_modules/lodash/_mapCacheSet.js");

/**
 * Creates a map cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function MapCache(entries) {
  var index = -1,
      length = entries == null ? 0 : entries.length;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}

// Add methods to `MapCache`.
MapCache.prototype.clear = mapCacheClear;
MapCache.prototype['delete'] = mapCacheDelete;
MapCache.prototype.get = mapCacheGet;
MapCache.prototype.has = mapCacheHas;
MapCache.prototype.set = mapCacheSet;

module.exports = MapCache;


/***/ }),

/***/ "./node_modules/lodash/_Promise.js":
/*!*****************************************!*\
  !*** ./node_modules/lodash/_Promise.js ***!
  \*****************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var getNative = __webpack_require__(/*! ./_getNative */ "./node_modules/lodash/_getNative.js"),
    root = __webpack_require__(/*! ./_root */ "./node_modules/lodash/_root.js");

/* Built-in method references that are verified to be native. */
var Promise = getNative(root, 'Promise');

module.exports = Promise;


/***/ }),

/***/ "./node_modules/lodash/_Set.js":
/*!*************************************!*\
  !*** ./node_modules/lodash/_Set.js ***!
  \*************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var getNative = __webpack_require__(/*! ./_getNative */ "./node_modules/lodash/_getNative.js"),
    root = __webpack_require__(/*! ./_root */ "./node_modules/lodash/_root.js");

/* Built-in method references that are verified to be native. */
var Set = getNative(root, 'Set');

module.exports = Set;


/***/ }),

/***/ "./node_modules/lodash/_Stack.js":
/*!***************************************!*\
  !*** ./node_modules/lodash/_Stack.js ***!
  \***************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var ListCache = __webpack_require__(/*! ./_ListCache */ "./node_modules/lodash/_ListCache.js"),
    stackClear = __webpack_require__(/*! ./_stackClear */ "./node_modules/lodash/_stackClear.js"),
    stackDelete = __webpack_require__(/*! ./_stackDelete */ "./node_modules/lodash/_stackDelete.js"),
    stackGet = __webpack_require__(/*! ./_stackGet */ "./node_modules/lodash/_stackGet.js"),
    stackHas = __webpack_require__(/*! ./_stackHas */ "./node_modules/lodash/_stackHas.js"),
    stackSet = __webpack_require__(/*! ./_stackSet */ "./node_modules/lodash/_stackSet.js");

/**
 * Creates a stack cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function Stack(entries) {
  var data = this.__data__ = new ListCache(entries);
  this.size = data.size;
}

// Add methods to `Stack`.
Stack.prototype.clear = stackClear;
Stack.prototype['delete'] = stackDelete;
Stack.prototype.get = stackGet;
Stack.prototype.has = stackHas;
Stack.prototype.set = stackSet;

module.exports = Stack;


/***/ }),

/***/ "./node_modules/lodash/_Symbol.js":
/*!****************************************!*\
  !*** ./node_modules/lodash/_Symbol.js ***!
  \****************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var root = __webpack_require__(/*! ./_root */ "./node_modules/lodash/_root.js");

/** Built-in value references. */
var Symbol = root.Symbol;

module.exports = Symbol;


/***/ }),

/***/ "./node_modules/lodash/_Uint8Array.js":
/*!********************************************!*\
  !*** ./node_modules/lodash/_Uint8Array.js ***!
  \********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var root = __webpack_require__(/*! ./_root */ "./node_modules/lodash/_root.js");

/** Built-in value references. */
var Uint8Array = root.Uint8Array;

module.exports = Uint8Array;


/***/ }),

/***/ "./node_modules/lodash/_WeakMap.js":
/*!*****************************************!*\
  !*** ./node_modules/lodash/_WeakMap.js ***!
  \*****************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var getNative = __webpack_require__(/*! ./_getNative */ "./node_modules/lodash/_getNative.js"),
    root = __webpack_require__(/*! ./_root */ "./node_modules/lodash/_root.js");

/* Built-in method references that are verified to be native. */
var WeakMap = getNative(root, 'WeakMap');

module.exports = WeakMap;


/***/ }),

/***/ "./node_modules/lodash/_arrayEach.js":
/*!*******************************************!*\
  !*** ./node_modules/lodash/_arrayEach.js ***!
  \*******************************************/
/***/ ((module) => {

/**
 * A specialized version of `_.forEach` for arrays without support for
 * iteratee shorthands.
 *
 * @private
 * @param {Array} [array] The array to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns `array`.
 */
function arrayEach(array, iteratee) {
  var index = -1,
      length = array == null ? 0 : array.length;

  while (++index < length) {
    if (iteratee(array[index], index, array) === false) {
      break;
    }
  }
  return array;
}

module.exports = arrayEach;


/***/ }),

/***/ "./node_modules/lodash/_arrayFilter.js":
/*!*********************************************!*\
  !*** ./node_modules/lodash/_arrayFilter.js ***!
  \*********************************************/
/***/ ((module) => {

/**
 * A specialized version of `_.filter` for arrays without support for
 * iteratee shorthands.
 *
 * @private
 * @param {Array} [array] The array to iterate over.
 * @param {Function} predicate The function invoked per iteration.
 * @returns {Array} Returns the new filtered array.
 */
function arrayFilter(array, predicate) {
  var index = -1,
      length = array == null ? 0 : array.length,
      resIndex = 0,
      result = [];

  while (++index < length) {
    var value = array[index];
    if (predicate(value, index, array)) {
      result[resIndex++] = value;
    }
  }
  return result;
}

module.exports = arrayFilter;


/***/ }),

/***/ "./node_modules/lodash/_arrayLikeKeys.js":
/*!***********************************************!*\
  !*** ./node_modules/lodash/_arrayLikeKeys.js ***!
  \***********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var baseTimes = __webpack_require__(/*! ./_baseTimes */ "./node_modules/lodash/_baseTimes.js"),
    isArguments = __webpack_require__(/*! ./isArguments */ "./node_modules/lodash/isArguments.js"),
    isArray = __webpack_require__(/*! ./isArray */ "./node_modules/lodash/isArray.js"),
    isBuffer = __webpack_require__(/*! ./isBuffer */ "./node_modules/lodash/isBuffer.js"),
    isIndex = __webpack_require__(/*! ./_isIndex */ "./node_modules/lodash/_isIndex.js"),
    isTypedArray = __webpack_require__(/*! ./isTypedArray */ "./node_modules/lodash/isTypedArray.js");

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Creates an array of the enumerable property names of the array-like `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @param {boolean} inherited Specify returning inherited property names.
 * @returns {Array} Returns the array of property names.
 */
function arrayLikeKeys(value, inherited) {
  var isArr = isArray(value),
      isArg = !isArr && isArguments(value),
      isBuff = !isArr && !isArg && isBuffer(value),
      isType = !isArr && !isArg && !isBuff && isTypedArray(value),
      skipIndexes = isArr || isArg || isBuff || isType,
      result = skipIndexes ? baseTimes(value.length, String) : [],
      length = result.length;

  for (var key in value) {
    if ((inherited || hasOwnProperty.call(value, key)) &&
        !(skipIndexes && (
           // Safari 9 has enumerable `arguments.length` in strict mode.
           key == 'length' ||
           // Node.js 0.10 has enumerable non-index properties on buffers.
           (isBuff && (key == 'offset' || key == 'parent')) ||
           // PhantomJS 2 has enumerable non-index properties on typed arrays.
           (isType && (key == 'buffer' || key == 'byteLength' || key == 'byteOffset')) ||
           // Skip index properties.
           isIndex(key, length)
        ))) {
      result.push(key);
    }
  }
  return result;
}

module.exports = arrayLikeKeys;


/***/ }),

/***/ "./node_modules/lodash/_arrayMap.js":
/*!******************************************!*\
  !*** ./node_modules/lodash/_arrayMap.js ***!
  \******************************************/
/***/ ((module) => {

/**
 * A specialized version of `_.map` for arrays without support for iteratee
 * shorthands.
 *
 * @private
 * @param {Array} [array] The array to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the new mapped array.
 */
function arrayMap(array, iteratee) {
  var index = -1,
      length = array == null ? 0 : array.length,
      result = Array(length);

  while (++index < length) {
    result[index] = iteratee(array[index], index, array);
  }
  return result;
}

module.exports = arrayMap;


/***/ }),

/***/ "./node_modules/lodash/_arrayPush.js":
/*!*******************************************!*\
  !*** ./node_modules/lodash/_arrayPush.js ***!
  \*******************************************/
/***/ ((module) => {

/**
 * Appends the elements of `values` to `array`.
 *
 * @private
 * @param {Array} array The array to modify.
 * @param {Array} values The values to append.
 * @returns {Array} Returns `array`.
 */
function arrayPush(array, values) {
  var index = -1,
      length = values.length,
      offset = array.length;

  while (++index < length) {
    array[offset + index] = values[index];
  }
  return array;
}

module.exports = arrayPush;


/***/ }),

/***/ "./node_modules/lodash/_assignValue.js":
/*!*********************************************!*\
  !*** ./node_modules/lodash/_assignValue.js ***!
  \*********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var baseAssignValue = __webpack_require__(/*! ./_baseAssignValue */ "./node_modules/lodash/_baseAssignValue.js"),
    eq = __webpack_require__(/*! ./eq */ "./node_modules/lodash/eq.js");

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Assigns `value` to `key` of `object` if the existing value is not equivalent
 * using [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
 * for equality comparisons.
 *
 * @private
 * @param {Object} object The object to modify.
 * @param {string} key The key of the property to assign.
 * @param {*} value The value to assign.
 */
function assignValue(object, key, value) {
  var objValue = object[key];
  if (!(hasOwnProperty.call(object, key) && eq(objValue, value)) ||
      (value === undefined && !(key in object))) {
    baseAssignValue(object, key, value);
  }
}

module.exports = assignValue;


/***/ }),

/***/ "./node_modules/lodash/_assocIndexOf.js":
/*!**********************************************!*\
  !*** ./node_modules/lodash/_assocIndexOf.js ***!
  \**********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var eq = __webpack_require__(/*! ./eq */ "./node_modules/lodash/eq.js");

/**
 * Gets the index at which the `key` is found in `array` of key-value pairs.
 *
 * @private
 * @param {Array} array The array to inspect.
 * @param {*} key The key to search for.
 * @returns {number} Returns the index of the matched value, else `-1`.
 */
function assocIndexOf(array, key) {
  var length = array.length;
  while (length--) {
    if (eq(array[length][0], key)) {
      return length;
    }
  }
  return -1;
}

module.exports = assocIndexOf;


/***/ }),

/***/ "./node_modules/lodash/_baseAssign.js":
/*!********************************************!*\
  !*** ./node_modules/lodash/_baseAssign.js ***!
  \********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var copyObject = __webpack_require__(/*! ./_copyObject */ "./node_modules/lodash/_copyObject.js"),
    keys = __webpack_require__(/*! ./keys */ "./node_modules/lodash/keys.js");

/**
 * The base implementation of `_.assign` without support for multiple sources
 * or `customizer` functions.
 *
 * @private
 * @param {Object} object The destination object.
 * @param {Object} source The source object.
 * @returns {Object} Returns `object`.
 */
function baseAssign(object, source) {
  return object && copyObject(source, keys(source), object);
}

module.exports = baseAssign;


/***/ }),

/***/ "./node_modules/lodash/_baseAssignIn.js":
/*!**********************************************!*\
  !*** ./node_modules/lodash/_baseAssignIn.js ***!
  \**********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var copyObject = __webpack_require__(/*! ./_copyObject */ "./node_modules/lodash/_copyObject.js"),
    keysIn = __webpack_require__(/*! ./keysIn */ "./node_modules/lodash/keysIn.js");

/**
 * The base implementation of `_.assignIn` without support for multiple sources
 * or `customizer` functions.
 *
 * @private
 * @param {Object} object The destination object.
 * @param {Object} source The source object.
 * @returns {Object} Returns `object`.
 */
function baseAssignIn(object, source) {
  return object && copyObject(source, keysIn(source), object);
}

module.exports = baseAssignIn;


/***/ }),

/***/ "./node_modules/lodash/_baseAssignValue.js":
/*!*************************************************!*\
  !*** ./node_modules/lodash/_baseAssignValue.js ***!
  \*************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var defineProperty = __webpack_require__(/*! ./_defineProperty */ "./node_modules/lodash/_defineProperty.js");

/**
 * The base implementation of `assignValue` and `assignMergeValue` without
 * value checks.
 *
 * @private
 * @param {Object} object The object to modify.
 * @param {string} key The key of the property to assign.
 * @param {*} value The value to assign.
 */
function baseAssignValue(object, key, value) {
  if (key == '__proto__' && defineProperty) {
    defineProperty(object, key, {
      'configurable': true,
      'enumerable': true,
      'value': value,
      'writable': true
    });
  } else {
    object[key] = value;
  }
}

module.exports = baseAssignValue;


/***/ }),

/***/ "./node_modules/lodash/_baseClone.js":
/*!*******************************************!*\
  !*** ./node_modules/lodash/_baseClone.js ***!
  \*******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var Stack = __webpack_require__(/*! ./_Stack */ "./node_modules/lodash/_Stack.js"),
    arrayEach = __webpack_require__(/*! ./_arrayEach */ "./node_modules/lodash/_arrayEach.js"),
    assignValue = __webpack_require__(/*! ./_assignValue */ "./node_modules/lodash/_assignValue.js"),
    baseAssign = __webpack_require__(/*! ./_baseAssign */ "./node_modules/lodash/_baseAssign.js"),
    baseAssignIn = __webpack_require__(/*! ./_baseAssignIn */ "./node_modules/lodash/_baseAssignIn.js"),
    cloneBuffer = __webpack_require__(/*! ./_cloneBuffer */ "./node_modules/lodash/_cloneBuffer.js"),
    copyArray = __webpack_require__(/*! ./_copyArray */ "./node_modules/lodash/_copyArray.js"),
    copySymbols = __webpack_require__(/*! ./_copySymbols */ "./node_modules/lodash/_copySymbols.js"),
    copySymbolsIn = __webpack_require__(/*! ./_copySymbolsIn */ "./node_modules/lodash/_copySymbolsIn.js"),
    getAllKeys = __webpack_require__(/*! ./_getAllKeys */ "./node_modules/lodash/_getAllKeys.js"),
    getAllKeysIn = __webpack_require__(/*! ./_getAllKeysIn */ "./node_modules/lodash/_getAllKeysIn.js"),
    getTag = __webpack_require__(/*! ./_getTag */ "./node_modules/lodash/_getTag.js"),
    initCloneArray = __webpack_require__(/*! ./_initCloneArray */ "./node_modules/lodash/_initCloneArray.js"),
    initCloneByTag = __webpack_require__(/*! ./_initCloneByTag */ "./node_modules/lodash/_initCloneByTag.js"),
    initCloneObject = __webpack_require__(/*! ./_initCloneObject */ "./node_modules/lodash/_initCloneObject.js"),
    isArray = __webpack_require__(/*! ./isArray */ "./node_modules/lodash/isArray.js"),
    isBuffer = __webpack_require__(/*! ./isBuffer */ "./node_modules/lodash/isBuffer.js"),
    isMap = __webpack_require__(/*! ./isMap */ "./node_modules/lodash/isMap.js"),
    isObject = __webpack_require__(/*! ./isObject */ "./node_modules/lodash/isObject.js"),
    isSet = __webpack_require__(/*! ./isSet */ "./node_modules/lodash/isSet.js"),
    keys = __webpack_require__(/*! ./keys */ "./node_modules/lodash/keys.js");

/** Used to compose bitmasks for cloning. */
var CLONE_DEEP_FLAG = 1,
    CLONE_FLAT_FLAG = 2,
    CLONE_SYMBOLS_FLAG = 4;

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    arrayTag = '[object Array]',
    boolTag = '[object Boolean]',
    dateTag = '[object Date]',
    errorTag = '[object Error]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]',
    mapTag = '[object Map]',
    numberTag = '[object Number]',
    objectTag = '[object Object]',
    regexpTag = '[object RegExp]',
    setTag = '[object Set]',
    stringTag = '[object String]',
    symbolTag = '[object Symbol]',
    weakMapTag = '[object WeakMap]';

var arrayBufferTag = '[object ArrayBuffer]',
    dataViewTag = '[object DataView]',
    float32Tag = '[object Float32Array]',
    float64Tag = '[object Float64Array]',
    int8Tag = '[object Int8Array]',
    int16Tag = '[object Int16Array]',
    int32Tag = '[object Int32Array]',
    uint8Tag = '[object Uint8Array]',
    uint8ClampedTag = '[object Uint8ClampedArray]',
    uint16Tag = '[object Uint16Array]',
    uint32Tag = '[object Uint32Array]';

/** Used to identify `toStringTag` values supported by `_.clone`. */
var cloneableTags = {};
cloneableTags[argsTag] = cloneableTags[arrayTag] =
cloneableTags[arrayBufferTag] = cloneableTags[dataViewTag] =
cloneableTags[boolTag] = cloneableTags[dateTag] =
cloneableTags[float32Tag] = cloneableTags[float64Tag] =
cloneableTags[int8Tag] = cloneableTags[int16Tag] =
cloneableTags[int32Tag] = cloneableTags[mapTag] =
cloneableTags[numberTag] = cloneableTags[objectTag] =
cloneableTags[regexpTag] = cloneableTags[setTag] =
cloneableTags[stringTag] = cloneableTags[symbolTag] =
cloneableTags[uint8Tag] = cloneableTags[uint8ClampedTag] =
cloneableTags[uint16Tag] = cloneableTags[uint32Tag] = true;
cloneableTags[errorTag] = cloneableTags[funcTag] =
cloneableTags[weakMapTag] = false;

/**
 * The base implementation of `_.clone` and `_.cloneDeep` which tracks
 * traversed objects.
 *
 * @private
 * @param {*} value The value to clone.
 * @param {boolean} bitmask The bitmask flags.
 *  1 - Deep clone
 *  2 - Flatten inherited properties
 *  4 - Clone symbols
 * @param {Function} [customizer] The function to customize cloning.
 * @param {string} [key] The key of `value`.
 * @param {Object} [object] The parent object of `value`.
 * @param {Object} [stack] Tracks traversed objects and their clone counterparts.
 * @returns {*} Returns the cloned value.
 */
function baseClone(value, bitmask, customizer, key, object, stack) {
  var result,
      isDeep = bitmask & CLONE_DEEP_FLAG,
      isFlat = bitmask & CLONE_FLAT_FLAG,
      isFull = bitmask & CLONE_SYMBOLS_FLAG;

  if (customizer) {
    result = object ? customizer(value, key, object, stack) : customizer(value);
  }
  if (result !== undefined) {
    return result;
  }
  if (!isObject(value)) {
    return value;
  }
  var isArr = isArray(value);
  if (isArr) {
    result = initCloneArray(value);
    if (!isDeep) {
      return copyArray(value, result);
    }
  } else {
    var tag = getTag(value),
        isFunc = tag == funcTag || tag == genTag;

    if (isBuffer(value)) {
      return cloneBuffer(value, isDeep);
    }
    if (tag == objectTag || tag == argsTag || (isFunc && !object)) {
      result = (isFlat || isFunc) ? {} : initCloneObject(value);
      if (!isDeep) {
        return isFlat
          ? copySymbolsIn(value, baseAssignIn(result, value))
          : copySymbols(value, baseAssign(result, value));
      }
    } else {
      if (!cloneableTags[tag]) {
        return object ? value : {};
      }
      result = initCloneByTag(value, tag, isDeep);
    }
  }
  // Check for circular references and return its corresponding clone.
  stack || (stack = new Stack);
  var stacked = stack.get(value);
  if (stacked) {
    return stacked;
  }
  stack.set(value, result);

  if (isSet(value)) {
    value.forEach(function(subValue) {
      result.add(baseClone(subValue, bitmask, customizer, subValue, value, stack));
    });

    return result;
  }

  if (isMap(value)) {
    value.forEach(function(subValue, key) {
      result.set(key, baseClone(subValue, bitmask, customizer, key, value, stack));
    });

    return result;
  }

  var keysFunc = isFull
    ? (isFlat ? getAllKeysIn : getAllKeys)
    : (isFlat ? keysIn : keys);

  var props = isArr ? undefined : keysFunc(value);
  arrayEach(props || value, function(subValue, key) {
    if (props) {
      key = subValue;
      subValue = value[key];
    }
    // Recursively populate clone (susceptible to call stack limits).
    assignValue(result, key, baseClone(subValue, bitmask, customizer, key, value, stack));
  });
  return result;
}

module.exports = baseClone;


/***/ }),

/***/ "./node_modules/lodash/_baseCreate.js":
/*!********************************************!*\
  !*** ./node_modules/lodash/_baseCreate.js ***!
  \********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var isObject = __webpack_require__(/*! ./isObject */ "./node_modules/lodash/isObject.js");

/** Built-in value references. */
var objectCreate = Object.create;

/**
 * The base implementation of `_.create` without support for assigning
 * properties to the created object.
 *
 * @private
 * @param {Object} proto The object to inherit from.
 * @returns {Object} Returns the new object.
 */
var baseCreate = (function() {
  function object() {}
  return function(proto) {
    if (!isObject(proto)) {
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
}());

module.exports = baseCreate;


/***/ }),

/***/ "./node_modules/lodash/_baseGetAllKeys.js":
/*!************************************************!*\
  !*** ./node_modules/lodash/_baseGetAllKeys.js ***!
  \************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var arrayPush = __webpack_require__(/*! ./_arrayPush */ "./node_modules/lodash/_arrayPush.js"),
    isArray = __webpack_require__(/*! ./isArray */ "./node_modules/lodash/isArray.js");

/**
 * The base implementation of `getAllKeys` and `getAllKeysIn` which uses
 * `keysFunc` and `symbolsFunc` to get the enumerable property names and
 * symbols of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Function} keysFunc The function to get the keys of `object`.
 * @param {Function} symbolsFunc The function to get the symbols of `object`.
 * @returns {Array} Returns the array of property names and symbols.
 */
function baseGetAllKeys(object, keysFunc, symbolsFunc) {
  var result = keysFunc(object);
  return isArray(object) ? result : arrayPush(result, symbolsFunc(object));
}

module.exports = baseGetAllKeys;


/***/ }),

/***/ "./node_modules/lodash/_baseGetTag.js":
/*!********************************************!*\
  !*** ./node_modules/lodash/_baseGetTag.js ***!
  \********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var Symbol = __webpack_require__(/*! ./_Symbol */ "./node_modules/lodash/_Symbol.js"),
    getRawTag = __webpack_require__(/*! ./_getRawTag */ "./node_modules/lodash/_getRawTag.js"),
    objectToString = __webpack_require__(/*! ./_objectToString */ "./node_modules/lodash/_objectToString.js");

/** `Object#toString` result references. */
var nullTag = '[object Null]',
    undefinedTag = '[object Undefined]';

/** Built-in value references. */
var symToStringTag = Symbol ? Symbol.toStringTag : undefined;

/**
 * The base implementation of `getTag` without fallbacks for buggy environments.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */
function baseGetTag(value) {
  if (value == null) {
    return value === undefined ? undefinedTag : nullTag;
  }
  return (symToStringTag && symToStringTag in Object(value))
    ? getRawTag(value)
    : objectToString(value);
}

module.exports = baseGetTag;


/***/ }),

/***/ "./node_modules/lodash/_baseIsArguments.js":
/*!*************************************************!*\
  !*** ./node_modules/lodash/_baseIsArguments.js ***!
  \*************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var baseGetTag = __webpack_require__(/*! ./_baseGetTag */ "./node_modules/lodash/_baseGetTag.js"),
    isObjectLike = __webpack_require__(/*! ./isObjectLike */ "./node_modules/lodash/isObjectLike.js");

/** `Object#toString` result references. */
var argsTag = '[object Arguments]';

/**
 * The base implementation of `_.isArguments`.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
 */
function baseIsArguments(value) {
  return isObjectLike(value) && baseGetTag(value) == argsTag;
}

module.exports = baseIsArguments;


/***/ }),

/***/ "./node_modules/lodash/_baseIsMap.js":
/*!*******************************************!*\
  !*** ./node_modules/lodash/_baseIsMap.js ***!
  \*******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var getTag = __webpack_require__(/*! ./_getTag */ "./node_modules/lodash/_getTag.js"),
    isObjectLike = __webpack_require__(/*! ./isObjectLike */ "./node_modules/lodash/isObjectLike.js");

/** `Object#toString` result references. */
var mapTag = '[object Map]';

/**
 * The base implementation of `_.isMap` without Node.js optimizations.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a map, else `false`.
 */
function baseIsMap(value) {
  return isObjectLike(value) && getTag(value) == mapTag;
}

module.exports = baseIsMap;


/***/ }),

/***/ "./node_modules/lodash/_baseIsNative.js":
/*!**********************************************!*\
  !*** ./node_modules/lodash/_baseIsNative.js ***!
  \**********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var isFunction = __webpack_require__(/*! ./isFunction */ "./node_modules/lodash/isFunction.js"),
    isMasked = __webpack_require__(/*! ./_isMasked */ "./node_modules/lodash/_isMasked.js"),
    isObject = __webpack_require__(/*! ./isObject */ "./node_modules/lodash/isObject.js"),
    toSource = __webpack_require__(/*! ./_toSource */ "./node_modules/lodash/_toSource.js");

/**
 * Used to match `RegExp`
 * [syntax characters](http://ecma-international.org/ecma-262/7.0/#sec-patterns).
 */
var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;

/** Used to detect host constructors (Safari). */
var reIsHostCtor = /^\[object .+?Constructor\]$/;

/** Used for built-in method references. */
var funcProto = Function.prototype,
    objectProto = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var funcToString = funcProto.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/** Used to detect if a method is native. */
var reIsNative = RegExp('^' +
  funcToString.call(hasOwnProperty).replace(reRegExpChar, '\\$&')
  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
);

/**
 * The base implementation of `_.isNative` without bad shim checks.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function,
 *  else `false`.
 */
function baseIsNative(value) {
  if (!isObject(value) || isMasked(value)) {
    return false;
  }
  var pattern = isFunction(value) ? reIsNative : reIsHostCtor;
  return pattern.test(toSource(value));
}

module.exports = baseIsNative;


/***/ }),

/***/ "./node_modules/lodash/_baseIsSet.js":
/*!*******************************************!*\
  !*** ./node_modules/lodash/_baseIsSet.js ***!
  \*******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var getTag = __webpack_require__(/*! ./_getTag */ "./node_modules/lodash/_getTag.js"),
    isObjectLike = __webpack_require__(/*! ./isObjectLike */ "./node_modules/lodash/isObjectLike.js");

/** `Object#toString` result references. */
var setTag = '[object Set]';

/**
 * The base implementation of `_.isSet` without Node.js optimizations.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a set, else `false`.
 */
function baseIsSet(value) {
  return isObjectLike(value) && getTag(value) == setTag;
}

module.exports = baseIsSet;


/***/ }),

/***/ "./node_modules/lodash/_baseIsTypedArray.js":
/*!**************************************************!*\
  !*** ./node_modules/lodash/_baseIsTypedArray.js ***!
  \**************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var baseGetTag = __webpack_require__(/*! ./_baseGetTag */ "./node_modules/lodash/_baseGetTag.js"),
    isLength = __webpack_require__(/*! ./isLength */ "./node_modules/lodash/isLength.js"),
    isObjectLike = __webpack_require__(/*! ./isObjectLike */ "./node_modules/lodash/isObjectLike.js");

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    arrayTag = '[object Array]',
    boolTag = '[object Boolean]',
    dateTag = '[object Date]',
    errorTag = '[object Error]',
    funcTag = '[object Function]',
    mapTag = '[object Map]',
    numberTag = '[object Number]',
    objectTag = '[object Object]',
    regexpTag = '[object RegExp]',
    setTag = '[object Set]',
    stringTag = '[object String]',
    weakMapTag = '[object WeakMap]';

var arrayBufferTag = '[object ArrayBuffer]',
    dataViewTag = '[object DataView]',
    float32Tag = '[object Float32Array]',
    float64Tag = '[object Float64Array]',
    int8Tag = '[object Int8Array]',
    int16Tag = '[object Int16Array]',
    int32Tag = '[object Int32Array]',
    uint8Tag = '[object Uint8Array]',
    uint8ClampedTag = '[object Uint8ClampedArray]',
    uint16Tag = '[object Uint16Array]',
    uint32Tag = '[object Uint32Array]';

/** Used to identify `toStringTag` values of typed arrays. */
var typedArrayTags = {};
typedArrayTags[float32Tag] = typedArrayTags[float64Tag] =
typedArrayTags[int8Tag] = typedArrayTags[int16Tag] =
typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] =
typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] =
typedArrayTags[uint32Tag] = true;
typedArrayTags[argsTag] = typedArrayTags[arrayTag] =
typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] =
typedArrayTags[dataViewTag] = typedArrayTags[dateTag] =
typedArrayTags[errorTag] = typedArrayTags[funcTag] =
typedArrayTags[mapTag] = typedArrayTags[numberTag] =
typedArrayTags[objectTag] = typedArrayTags[regexpTag] =
typedArrayTags[setTag] = typedArrayTags[stringTag] =
typedArrayTags[weakMapTag] = false;

/**
 * The base implementation of `_.isTypedArray` without Node.js optimizations.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
 */
function baseIsTypedArray(value) {
  return isObjectLike(value) &&
    isLength(value.length) && !!typedArrayTags[baseGetTag(value)];
}

module.exports = baseIsTypedArray;


/***/ }),

/***/ "./node_modules/lodash/_baseKeys.js":
/*!******************************************!*\
  !*** ./node_modules/lodash/_baseKeys.js ***!
  \******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var isPrototype = __webpack_require__(/*! ./_isPrototype */ "./node_modules/lodash/_isPrototype.js"),
    nativeKeys = __webpack_require__(/*! ./_nativeKeys */ "./node_modules/lodash/_nativeKeys.js");

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * The base implementation of `_.keys` which doesn't treat sparse arrays as dense.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function baseKeys(object) {
  if (!isPrototype(object)) {
    return nativeKeys(object);
  }
  var result = [];
  for (var key in Object(object)) {
    if (hasOwnProperty.call(object, key) && key != 'constructor') {
      result.push(key);
    }
  }
  return result;
}

module.exports = baseKeys;


/***/ }),

/***/ "./node_modules/lodash/_baseKeysIn.js":
/*!********************************************!*\
  !*** ./node_modules/lodash/_baseKeysIn.js ***!
  \********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var isObject = __webpack_require__(/*! ./isObject */ "./node_modules/lodash/isObject.js"),
    isPrototype = __webpack_require__(/*! ./_isPrototype */ "./node_modules/lodash/_isPrototype.js"),
    nativeKeysIn = __webpack_require__(/*! ./_nativeKeysIn */ "./node_modules/lodash/_nativeKeysIn.js");

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * The base implementation of `_.keysIn` which doesn't treat sparse arrays as dense.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function baseKeysIn(object) {
  if (!isObject(object)) {
    return nativeKeysIn(object);
  }
  var isProto = isPrototype(object),
      result = [];

  for (var key in object) {
    if (!(key == 'constructor' && (isProto || !hasOwnProperty.call(object, key)))) {
      result.push(key);
    }
  }
  return result;
}

module.exports = baseKeysIn;


/***/ }),

/***/ "./node_modules/lodash/_baseSet.js":
/*!*****************************************!*\
  !*** ./node_modules/lodash/_baseSet.js ***!
  \*****************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var assignValue = __webpack_require__(/*! ./_assignValue */ "./node_modules/lodash/_assignValue.js"),
    castPath = __webpack_require__(/*! ./_castPath */ "./node_modules/lodash/_castPath.js"),
    isIndex = __webpack_require__(/*! ./_isIndex */ "./node_modules/lodash/_isIndex.js"),
    isObject = __webpack_require__(/*! ./isObject */ "./node_modules/lodash/isObject.js"),
    toKey = __webpack_require__(/*! ./_toKey */ "./node_modules/lodash/_toKey.js");

/**
 * The base implementation of `_.set`.
 *
 * @private
 * @param {Object} object The object to modify.
 * @param {Array|string} path The path of the property to set.
 * @param {*} value The value to set.
 * @param {Function} [customizer] The function to customize path creation.
 * @returns {Object} Returns `object`.
 */
function baseSet(object, path, value, customizer) {
  if (!isObject(object)) {
    return object;
  }
  path = castPath(path, object);

  var index = -1,
      length = path.length,
      lastIndex = length - 1,
      nested = object;

  while (nested != null && ++index < length) {
    var key = toKey(path[index]),
        newValue = value;

    if (index != lastIndex) {
      var objValue = nested[key];
      newValue = customizer ? customizer(objValue, key, nested) : undefined;
      if (newValue === undefined) {
        newValue = isObject(objValue)
          ? objValue
          : (isIndex(path[index + 1]) ? [] : {});
      }
    }
    assignValue(nested, key, newValue);
    nested = nested[key];
  }
  return object;
}

module.exports = baseSet;


/***/ }),

/***/ "./node_modules/lodash/_baseTimes.js":
/*!*******************************************!*\
  !*** ./node_modules/lodash/_baseTimes.js ***!
  \*******************************************/
/***/ ((module) => {

/**
 * The base implementation of `_.times` without support for iteratee shorthands
 * or max array length checks.
 *
 * @private
 * @param {number} n The number of times to invoke `iteratee`.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the array of results.
 */
function baseTimes(n, iteratee) {
  var index = -1,
      result = Array(n);

  while (++index < n) {
    result[index] = iteratee(index);
  }
  return result;
}

module.exports = baseTimes;


/***/ }),

/***/ "./node_modules/lodash/_baseToString.js":
/*!**********************************************!*\
  !*** ./node_modules/lodash/_baseToString.js ***!
  \**********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var Symbol = __webpack_require__(/*! ./_Symbol */ "./node_modules/lodash/_Symbol.js"),
    arrayMap = __webpack_require__(/*! ./_arrayMap */ "./node_modules/lodash/_arrayMap.js"),
    isArray = __webpack_require__(/*! ./isArray */ "./node_modules/lodash/isArray.js"),
    isSymbol = __webpack_require__(/*! ./isSymbol */ "./node_modules/lodash/isSymbol.js");

/** Used as references for various `Number` constants. */
var INFINITY = 1 / 0;

/** Used to convert symbols to primitives and strings. */
var symbolProto = Symbol ? Symbol.prototype : undefined,
    symbolToString = symbolProto ? symbolProto.toString : undefined;

/**
 * The base implementation of `_.toString` which doesn't convert nullish
 * values to empty strings.
 *
 * @private
 * @param {*} value The value to process.
 * @returns {string} Returns the string.
 */
function baseToString(value) {
  // Exit early for strings to avoid a performance hit in some environments.
  if (typeof value == 'string') {
    return value;
  }
  if (isArray(value)) {
    // Recursively convert values (susceptible to call stack limits).
    return arrayMap(value, baseToString) + '';
  }
  if (isSymbol(value)) {
    return symbolToString ? symbolToString.call(value) : '';
  }
  var result = (value + '');
  return (result == '0' && (1 / value) == -INFINITY) ? '-0' : result;
}

module.exports = baseToString;


/***/ }),

/***/ "./node_modules/lodash/_baseUnary.js":
/*!*******************************************!*\
  !*** ./node_modules/lodash/_baseUnary.js ***!
  \*******************************************/
/***/ ((module) => {

/**
 * The base implementation of `_.unary` without support for storing metadata.
 *
 * @private
 * @param {Function} func The function to cap arguments for.
 * @returns {Function} Returns the new capped function.
 */
function baseUnary(func) {
  return function(value) {
    return func(value);
  };
}

module.exports = baseUnary;


/***/ }),

/***/ "./node_modules/lodash/_castPath.js":
/*!******************************************!*\
  !*** ./node_modules/lodash/_castPath.js ***!
  \******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var isArray = __webpack_require__(/*! ./isArray */ "./node_modules/lodash/isArray.js"),
    isKey = __webpack_require__(/*! ./_isKey */ "./node_modules/lodash/_isKey.js"),
    stringToPath = __webpack_require__(/*! ./_stringToPath */ "./node_modules/lodash/_stringToPath.js"),
    toString = __webpack_require__(/*! ./toString */ "./node_modules/lodash/toString.js");

/**
 * Casts `value` to a path array if it's not one.
 *
 * @private
 * @param {*} value The value to inspect.
 * @param {Object} [object] The object to query keys on.
 * @returns {Array} Returns the cast property path array.
 */
function castPath(value, object) {
  if (isArray(value)) {
    return value;
  }
  return isKey(value, object) ? [value] : stringToPath(toString(value));
}

module.exports = castPath;


/***/ }),

/***/ "./node_modules/lodash/_cloneArrayBuffer.js":
/*!**************************************************!*\
  !*** ./node_modules/lodash/_cloneArrayBuffer.js ***!
  \**************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var Uint8Array = __webpack_require__(/*! ./_Uint8Array */ "./node_modules/lodash/_Uint8Array.js");

/**
 * Creates a clone of `arrayBuffer`.
 *
 * @private
 * @param {ArrayBuffer} arrayBuffer The array buffer to clone.
 * @returns {ArrayBuffer} Returns the cloned array buffer.
 */
function cloneArrayBuffer(arrayBuffer) {
  var result = new arrayBuffer.constructor(arrayBuffer.byteLength);
  new Uint8Array(result).set(new Uint8Array(arrayBuffer));
  return result;
}

module.exports = cloneArrayBuffer;


/***/ }),

/***/ "./node_modules/lodash/_cloneBuffer.js":
/*!*********************************************!*\
  !*** ./node_modules/lodash/_cloneBuffer.js ***!
  \*********************************************/
/***/ ((module, exports, __webpack_require__) => {

/* module decorator */ module = __webpack_require__.nmd(module);
var root = __webpack_require__(/*! ./_root */ "./node_modules/lodash/_root.js");

/** Detect free variable `exports`. */
var freeExports =  true && exports && !exports.nodeType && exports;

/** Detect free variable `module`. */
var freeModule = freeExports && "object" == 'object' && module && !module.nodeType && module;

/** Detect the popular CommonJS extension `module.exports`. */
var moduleExports = freeModule && freeModule.exports === freeExports;

/** Built-in value references. */
var Buffer = moduleExports ? root.Buffer : undefined,
    allocUnsafe = Buffer ? Buffer.allocUnsafe : undefined;

/**
 * Creates a clone of  `buffer`.
 *
 * @private
 * @param {Buffer} buffer The buffer to clone.
 * @param {boolean} [isDeep] Specify a deep clone.
 * @returns {Buffer} Returns the cloned buffer.
 */
function cloneBuffer(buffer, isDeep) {
  if (isDeep) {
    return buffer.slice();
  }
  var length = buffer.length,
      result = allocUnsafe ? allocUnsafe(length) : new buffer.constructor(length);

  buffer.copy(result);
  return result;
}

module.exports = cloneBuffer;


/***/ }),

/***/ "./node_modules/lodash/_cloneDataView.js":
/*!***********************************************!*\
  !*** ./node_modules/lodash/_cloneDataView.js ***!
  \***********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var cloneArrayBuffer = __webpack_require__(/*! ./_cloneArrayBuffer */ "./node_modules/lodash/_cloneArrayBuffer.js");

/**
 * Creates a clone of `dataView`.
 *
 * @private
 * @param {Object} dataView The data view to clone.
 * @param {boolean} [isDeep] Specify a deep clone.
 * @returns {Object} Returns the cloned data view.
 */
function cloneDataView(dataView, isDeep) {
  var buffer = isDeep ? cloneArrayBuffer(dataView.buffer) : dataView.buffer;
  return new dataView.constructor(buffer, dataView.byteOffset, dataView.byteLength);
}

module.exports = cloneDataView;


/***/ }),

/***/ "./node_modules/lodash/_cloneRegExp.js":
/*!*********************************************!*\
  !*** ./node_modules/lodash/_cloneRegExp.js ***!
  \*********************************************/
/***/ ((module) => {

/** Used to match `RegExp` flags from their coerced string values. */
var reFlags = /\w*$/;

/**
 * Creates a clone of `regexp`.
 *
 * @private
 * @param {Object} regexp The regexp to clone.
 * @returns {Object} Returns the cloned regexp.
 */
function cloneRegExp(regexp) {
  var result = new regexp.constructor(regexp.source, reFlags.exec(regexp));
  result.lastIndex = regexp.lastIndex;
  return result;
}

module.exports = cloneRegExp;


/***/ }),

/***/ "./node_modules/lodash/_cloneSymbol.js":
/*!*********************************************!*\
  !*** ./node_modules/lodash/_cloneSymbol.js ***!
  \*********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var Symbol = __webpack_require__(/*! ./_Symbol */ "./node_modules/lodash/_Symbol.js");

/** Used to convert symbols to primitives and strings. */
var symbolProto = Symbol ? Symbol.prototype : undefined,
    symbolValueOf = symbolProto ? symbolProto.valueOf : undefined;

/**
 * Creates a clone of the `symbol` object.
 *
 * @private
 * @param {Object} symbol The symbol object to clone.
 * @returns {Object} Returns the cloned symbol object.
 */
function cloneSymbol(symbol) {
  return symbolValueOf ? Object(symbolValueOf.call(symbol)) : {};
}

module.exports = cloneSymbol;


/***/ }),

/***/ "./node_modules/lodash/_cloneTypedArray.js":
/*!*************************************************!*\
  !*** ./node_modules/lodash/_cloneTypedArray.js ***!
  \*************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var cloneArrayBuffer = __webpack_require__(/*! ./_cloneArrayBuffer */ "./node_modules/lodash/_cloneArrayBuffer.js");

/**
 * Creates a clone of `typedArray`.
 *
 * @private
 * @param {Object} typedArray The typed array to clone.
 * @param {boolean} [isDeep] Specify a deep clone.
 * @returns {Object} Returns the cloned typed array.
 */
function cloneTypedArray(typedArray, isDeep) {
  var buffer = isDeep ? cloneArrayBuffer(typedArray.buffer) : typedArray.buffer;
  return new typedArray.constructor(buffer, typedArray.byteOffset, typedArray.length);
}

module.exports = cloneTypedArray;


/***/ }),

/***/ "./node_modules/lodash/_copyArray.js":
/*!*******************************************!*\
  !*** ./node_modules/lodash/_copyArray.js ***!
  \*******************************************/
/***/ ((module) => {

/**
 * Copies the values of `source` to `array`.
 *
 * @private
 * @param {Array} source The array to copy values from.
 * @param {Array} [array=[]] The array to copy values to.
 * @returns {Array} Returns `array`.
 */
function copyArray(source, array) {
  var index = -1,
      length = source.length;

  array || (array = Array(length));
  while (++index < length) {
    array[index] = source[index];
  }
  return array;
}

module.exports = copyArray;


/***/ }),

/***/ "./node_modules/lodash/_copyObject.js":
/*!********************************************!*\
  !*** ./node_modules/lodash/_copyObject.js ***!
  \********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var assignValue = __webpack_require__(/*! ./_assignValue */ "./node_modules/lodash/_assignValue.js"),
    baseAssignValue = __webpack_require__(/*! ./_baseAssignValue */ "./node_modules/lodash/_baseAssignValue.js");

/**
 * Copies properties of `source` to `object`.
 *
 * @private
 * @param {Object} source The object to copy properties from.
 * @param {Array} props The property identifiers to copy.
 * @param {Object} [object={}] The object to copy properties to.
 * @param {Function} [customizer] The function to customize copied values.
 * @returns {Object} Returns `object`.
 */
function copyObject(source, props, object, customizer) {
  var isNew = !object;
  object || (object = {});

  var index = -1,
      length = props.length;

  while (++index < length) {
    var key = props[index];

    var newValue = customizer
      ? customizer(object[key], source[key], key, object, source)
      : undefined;

    if (newValue === undefined) {
      newValue = source[key];
    }
    if (isNew) {
      baseAssignValue(object, key, newValue);
    } else {
      assignValue(object, key, newValue);
    }
  }
  return object;
}

module.exports = copyObject;


/***/ }),

/***/ "./node_modules/lodash/_copySymbols.js":
/*!*********************************************!*\
  !*** ./node_modules/lodash/_copySymbols.js ***!
  \*********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var copyObject = __webpack_require__(/*! ./_copyObject */ "./node_modules/lodash/_copyObject.js"),
    getSymbols = __webpack_require__(/*! ./_getSymbols */ "./node_modules/lodash/_getSymbols.js");

/**
 * Copies own symbols of `source` to `object`.
 *
 * @private
 * @param {Object} source The object to copy symbols from.
 * @param {Object} [object={}] The object to copy symbols to.
 * @returns {Object} Returns `object`.
 */
function copySymbols(source, object) {
  return copyObject(source, getSymbols(source), object);
}

module.exports = copySymbols;


/***/ }),

/***/ "./node_modules/lodash/_copySymbolsIn.js":
/*!***********************************************!*\
  !*** ./node_modules/lodash/_copySymbolsIn.js ***!
  \***********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var copyObject = __webpack_require__(/*! ./_copyObject */ "./node_modules/lodash/_copyObject.js"),
    getSymbolsIn = __webpack_require__(/*! ./_getSymbolsIn */ "./node_modules/lodash/_getSymbolsIn.js");

/**
 * Copies own and inherited symbols of `source` to `object`.
 *
 * @private
 * @param {Object} source The object to copy symbols from.
 * @param {Object} [object={}] The object to copy symbols to.
 * @returns {Object} Returns `object`.
 */
function copySymbolsIn(source, object) {
  return copyObject(source, getSymbolsIn(source), object);
}

module.exports = copySymbolsIn;


/***/ }),

/***/ "./node_modules/lodash/_coreJsData.js":
/*!********************************************!*\
  !*** ./node_modules/lodash/_coreJsData.js ***!
  \********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var root = __webpack_require__(/*! ./_root */ "./node_modules/lodash/_root.js");

/** Used to detect overreaching core-js shims. */
var coreJsData = root['__core-js_shared__'];

module.exports = coreJsData;


/***/ }),

/***/ "./node_modules/lodash/_defineProperty.js":
/*!************************************************!*\
  !*** ./node_modules/lodash/_defineProperty.js ***!
  \************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var getNative = __webpack_require__(/*! ./_getNative */ "./node_modules/lodash/_getNative.js");

var defineProperty = (function() {
  try {
    var func = getNative(Object, 'defineProperty');
    func({}, '', {});
    return func;
  } catch (e) {}
}());

module.exports = defineProperty;


/***/ }),

/***/ "./node_modules/lodash/_freeGlobal.js":
/*!********************************************!*\
  !*** ./node_modules/lodash/_freeGlobal.js ***!
  \********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

/** Detect free variable `global` from Node.js. */
var freeGlobal = typeof __webpack_require__.g == 'object' && __webpack_require__.g && __webpack_require__.g.Object === Object && __webpack_require__.g;

module.exports = freeGlobal;


/***/ }),

/***/ "./node_modules/lodash/_getAllKeys.js":
/*!********************************************!*\
  !*** ./node_modules/lodash/_getAllKeys.js ***!
  \********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var baseGetAllKeys = __webpack_require__(/*! ./_baseGetAllKeys */ "./node_modules/lodash/_baseGetAllKeys.js"),
    getSymbols = __webpack_require__(/*! ./_getSymbols */ "./node_modules/lodash/_getSymbols.js"),
    keys = __webpack_require__(/*! ./keys */ "./node_modules/lodash/keys.js");

/**
 * Creates an array of own enumerable property names and symbols of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names and symbols.
 */
function getAllKeys(object) {
  return baseGetAllKeys(object, keys, getSymbols);
}

module.exports = getAllKeys;


/***/ }),

/***/ "./node_modules/lodash/_getAllKeysIn.js":
/*!**********************************************!*\
  !*** ./node_modules/lodash/_getAllKeysIn.js ***!
  \**********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var baseGetAllKeys = __webpack_require__(/*! ./_baseGetAllKeys */ "./node_modules/lodash/_baseGetAllKeys.js"),
    getSymbolsIn = __webpack_require__(/*! ./_getSymbolsIn */ "./node_modules/lodash/_getSymbolsIn.js"),
    keysIn = __webpack_require__(/*! ./keysIn */ "./node_modules/lodash/keysIn.js");

/**
 * Creates an array of own and inherited enumerable property names and
 * symbols of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names and symbols.
 */
function getAllKeysIn(object) {
  return baseGetAllKeys(object, keysIn, getSymbolsIn);
}

module.exports = getAllKeysIn;


/***/ }),

/***/ "./node_modules/lodash/_getMapData.js":
/*!********************************************!*\
  !*** ./node_modules/lodash/_getMapData.js ***!
  \********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var isKeyable = __webpack_require__(/*! ./_isKeyable */ "./node_modules/lodash/_isKeyable.js");

/**
 * Gets the data for `map`.
 *
 * @private
 * @param {Object} map The map to query.
 * @param {string} key The reference key.
 * @returns {*} Returns the map data.
 */
function getMapData(map, key) {
  var data = map.__data__;
  return isKeyable(key)
    ? data[typeof key == 'string' ? 'string' : 'hash']
    : data.map;
}

module.exports = getMapData;


/***/ }),

/***/ "./node_modules/lodash/_getNative.js":
/*!*******************************************!*\
  !*** ./node_modules/lodash/_getNative.js ***!
  \*******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var baseIsNative = __webpack_require__(/*! ./_baseIsNative */ "./node_modules/lodash/_baseIsNative.js"),
    getValue = __webpack_require__(/*! ./_getValue */ "./node_modules/lodash/_getValue.js");

/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */
function getNative(object, key) {
  var value = getValue(object, key);
  return baseIsNative(value) ? value : undefined;
}

module.exports = getNative;


/***/ }),

/***/ "./node_modules/lodash/_getPrototype.js":
/*!**********************************************!*\
  !*** ./node_modules/lodash/_getPrototype.js ***!
  \**********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var overArg = __webpack_require__(/*! ./_overArg */ "./node_modules/lodash/_overArg.js");

/** Built-in value references. */
var getPrototype = overArg(Object.getPrototypeOf, Object);

module.exports = getPrototype;


/***/ }),

/***/ "./node_modules/lodash/_getRawTag.js":
/*!*******************************************!*\
  !*** ./node_modules/lodash/_getRawTag.js ***!
  \*******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var Symbol = __webpack_require__(/*! ./_Symbol */ "./node_modules/lodash/_Symbol.js");

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var nativeObjectToString = objectProto.toString;

/** Built-in value references. */
var symToStringTag = Symbol ? Symbol.toStringTag : undefined;

/**
 * A specialized version of `baseGetTag` which ignores `Symbol.toStringTag` values.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the raw `toStringTag`.
 */
function getRawTag(value) {
  var isOwn = hasOwnProperty.call(value, symToStringTag),
      tag = value[symToStringTag];

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

module.exports = getRawTag;


/***/ }),

/***/ "./node_modules/lodash/_getSymbols.js":
/*!********************************************!*\
  !*** ./node_modules/lodash/_getSymbols.js ***!
  \********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var arrayFilter = __webpack_require__(/*! ./_arrayFilter */ "./node_modules/lodash/_arrayFilter.js"),
    stubArray = __webpack_require__(/*! ./stubArray */ "./node_modules/lodash/stubArray.js");

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Built-in value references. */
var propertyIsEnumerable = objectProto.propertyIsEnumerable;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeGetSymbols = Object.getOwnPropertySymbols;

/**
 * Creates an array of the own enumerable symbols of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of symbols.
 */
var getSymbols = !nativeGetSymbols ? stubArray : function(object) {
  if (object == null) {
    return [];
  }
  object = Object(object);
  return arrayFilter(nativeGetSymbols(object), function(symbol) {
    return propertyIsEnumerable.call(object, symbol);
  });
};

module.exports = getSymbols;


/***/ }),

/***/ "./node_modules/lodash/_getSymbolsIn.js":
/*!**********************************************!*\
  !*** ./node_modules/lodash/_getSymbolsIn.js ***!
  \**********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var arrayPush = __webpack_require__(/*! ./_arrayPush */ "./node_modules/lodash/_arrayPush.js"),
    getPrototype = __webpack_require__(/*! ./_getPrototype */ "./node_modules/lodash/_getPrototype.js"),
    getSymbols = __webpack_require__(/*! ./_getSymbols */ "./node_modules/lodash/_getSymbols.js"),
    stubArray = __webpack_require__(/*! ./stubArray */ "./node_modules/lodash/stubArray.js");

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeGetSymbols = Object.getOwnPropertySymbols;

/**
 * Creates an array of the own and inherited enumerable symbols of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of symbols.
 */
var getSymbolsIn = !nativeGetSymbols ? stubArray : function(object) {
  var result = [];
  while (object) {
    arrayPush(result, getSymbols(object));
    object = getPrototype(object);
  }
  return result;
};

module.exports = getSymbolsIn;


/***/ }),

/***/ "./node_modules/lodash/_getTag.js":
/*!****************************************!*\
  !*** ./node_modules/lodash/_getTag.js ***!
  \****************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var DataView = __webpack_require__(/*! ./_DataView */ "./node_modules/lodash/_DataView.js"),
    Map = __webpack_require__(/*! ./_Map */ "./node_modules/lodash/_Map.js"),
    Promise = __webpack_require__(/*! ./_Promise */ "./node_modules/lodash/_Promise.js"),
    Set = __webpack_require__(/*! ./_Set */ "./node_modules/lodash/_Set.js"),
    WeakMap = __webpack_require__(/*! ./_WeakMap */ "./node_modules/lodash/_WeakMap.js"),
    baseGetTag = __webpack_require__(/*! ./_baseGetTag */ "./node_modules/lodash/_baseGetTag.js"),
    toSource = __webpack_require__(/*! ./_toSource */ "./node_modules/lodash/_toSource.js");

/** `Object#toString` result references. */
var mapTag = '[object Map]',
    objectTag = '[object Object]',
    promiseTag = '[object Promise]',
    setTag = '[object Set]',
    weakMapTag = '[object WeakMap]';

var dataViewTag = '[object DataView]';

/** Used to detect maps, sets, and weakmaps. */
var dataViewCtorString = toSource(DataView),
    mapCtorString = toSource(Map),
    promiseCtorString = toSource(Promise),
    setCtorString = toSource(Set),
    weakMapCtorString = toSource(WeakMap);

/**
 * Gets the `toStringTag` of `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */
var getTag = baseGetTag;

// Fallback for data views, maps, sets, and weak maps in IE 11 and promises in Node.js < 6.
if ((DataView && getTag(new DataView(new ArrayBuffer(1))) != dataViewTag) ||
    (Map && getTag(new Map) != mapTag) ||
    (Promise && getTag(Promise.resolve()) != promiseTag) ||
    (Set && getTag(new Set) != setTag) ||
    (WeakMap && getTag(new WeakMap) != weakMapTag)) {
  getTag = function(value) {
    var result = baseGetTag(value),
        Ctor = result == objectTag ? value.constructor : undefined,
        ctorString = Ctor ? toSource(Ctor) : '';

    if (ctorString) {
      switch (ctorString) {
        case dataViewCtorString: return dataViewTag;
        case mapCtorString: return mapTag;
        case promiseCtorString: return promiseTag;
        case setCtorString: return setTag;
        case weakMapCtorString: return weakMapTag;
      }
    }
    return result;
  };
}

module.exports = getTag;


/***/ }),

/***/ "./node_modules/lodash/_getValue.js":
/*!******************************************!*\
  !*** ./node_modules/lodash/_getValue.js ***!
  \******************************************/
/***/ ((module) => {

/**
 * Gets the value at `key` of `object`.
 *
 * @private
 * @param {Object} [object] The object to query.
 * @param {string} key The key of the property to get.
 * @returns {*} Returns the property value.
 */
function getValue(object, key) {
  return object == null ? undefined : object[key];
}

module.exports = getValue;


/***/ }),

/***/ "./node_modules/lodash/_hashClear.js":
/*!*******************************************!*\
  !*** ./node_modules/lodash/_hashClear.js ***!
  \*******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var nativeCreate = __webpack_require__(/*! ./_nativeCreate */ "./node_modules/lodash/_nativeCreate.js");

/**
 * Removes all key-value entries from the hash.
 *
 * @private
 * @name clear
 * @memberOf Hash
 */
function hashClear() {
  this.__data__ = nativeCreate ? nativeCreate(null) : {};
  this.size = 0;
}

module.exports = hashClear;


/***/ }),

/***/ "./node_modules/lodash/_hashDelete.js":
/*!********************************************!*\
  !*** ./node_modules/lodash/_hashDelete.js ***!
  \********************************************/
/***/ ((module) => {

/**
 * Removes `key` and its value from the hash.
 *
 * @private
 * @name delete
 * @memberOf Hash
 * @param {Object} hash The hash to modify.
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function hashDelete(key) {
  var result = this.has(key) && delete this.__data__[key];
  this.size -= result ? 1 : 0;
  return result;
}

module.exports = hashDelete;


/***/ }),

/***/ "./node_modules/lodash/_hashGet.js":
/*!*****************************************!*\
  !*** ./node_modules/lodash/_hashGet.js ***!
  \*****************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var nativeCreate = __webpack_require__(/*! ./_nativeCreate */ "./node_modules/lodash/_nativeCreate.js");

/** Used to stand-in for `undefined` hash values. */
var HASH_UNDEFINED = '__lodash_hash_undefined__';

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Gets the hash value for `key`.
 *
 * @private
 * @name get
 * @memberOf Hash
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function hashGet(key) {
  var data = this.__data__;
  if (nativeCreate) {
    var result = data[key];
    return result === HASH_UNDEFINED ? undefined : result;
  }
  return hasOwnProperty.call(data, key) ? data[key] : undefined;
}

module.exports = hashGet;


/***/ }),

/***/ "./node_modules/lodash/_hashHas.js":
/*!*****************************************!*\
  !*** ./node_modules/lodash/_hashHas.js ***!
  \*****************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var nativeCreate = __webpack_require__(/*! ./_nativeCreate */ "./node_modules/lodash/_nativeCreate.js");

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Checks if a hash value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf Hash
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function hashHas(key) {
  var data = this.__data__;
  return nativeCreate ? (data[key] !== undefined) : hasOwnProperty.call(data, key);
}

module.exports = hashHas;


/***/ }),

/***/ "./node_modules/lodash/_hashSet.js":
/*!*****************************************!*\
  !*** ./node_modules/lodash/_hashSet.js ***!
  \*****************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var nativeCreate = __webpack_require__(/*! ./_nativeCreate */ "./node_modules/lodash/_nativeCreate.js");

/** Used to stand-in for `undefined` hash values. */
var HASH_UNDEFINED = '__lodash_hash_undefined__';

/**
 * Sets the hash `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf Hash
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the hash instance.
 */
function hashSet(key, value) {
  var data = this.__data__;
  this.size += this.has(key) ? 0 : 1;
  data[key] = (nativeCreate && value === undefined) ? HASH_UNDEFINED : value;
  return this;
}

module.exports = hashSet;


/***/ }),

/***/ "./node_modules/lodash/_initCloneArray.js":
/*!************************************************!*\
  !*** ./node_modules/lodash/_initCloneArray.js ***!
  \************************************************/
/***/ ((module) => {

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Initializes an array clone.
 *
 * @private
 * @param {Array} array The array to clone.
 * @returns {Array} Returns the initialized clone.
 */
function initCloneArray(array) {
  var length = array.length,
      result = new array.constructor(length);

  // Add properties assigned by `RegExp#exec`.
  if (length && typeof array[0] == 'string' && hasOwnProperty.call(array, 'index')) {
    result.index = array.index;
    result.input = array.input;
  }
  return result;
}

module.exports = initCloneArray;


/***/ }),

/***/ "./node_modules/lodash/_initCloneByTag.js":
/*!************************************************!*\
  !*** ./node_modules/lodash/_initCloneByTag.js ***!
  \************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var cloneArrayBuffer = __webpack_require__(/*! ./_cloneArrayBuffer */ "./node_modules/lodash/_cloneArrayBuffer.js"),
    cloneDataView = __webpack_require__(/*! ./_cloneDataView */ "./node_modules/lodash/_cloneDataView.js"),
    cloneRegExp = __webpack_require__(/*! ./_cloneRegExp */ "./node_modules/lodash/_cloneRegExp.js"),
    cloneSymbol = __webpack_require__(/*! ./_cloneSymbol */ "./node_modules/lodash/_cloneSymbol.js"),
    cloneTypedArray = __webpack_require__(/*! ./_cloneTypedArray */ "./node_modules/lodash/_cloneTypedArray.js");

/** `Object#toString` result references. */
var boolTag = '[object Boolean]',
    dateTag = '[object Date]',
    mapTag = '[object Map]',
    numberTag = '[object Number]',
    regexpTag = '[object RegExp]',
    setTag = '[object Set]',
    stringTag = '[object String]',
    symbolTag = '[object Symbol]';

var arrayBufferTag = '[object ArrayBuffer]',
    dataViewTag = '[object DataView]',
    float32Tag = '[object Float32Array]',
    float64Tag = '[object Float64Array]',
    int8Tag = '[object Int8Array]',
    int16Tag = '[object Int16Array]',
    int32Tag = '[object Int32Array]',
    uint8Tag = '[object Uint8Array]',
    uint8ClampedTag = '[object Uint8ClampedArray]',
    uint16Tag = '[object Uint16Array]',
    uint32Tag = '[object Uint32Array]';

/**
 * Initializes an object clone based on its `toStringTag`.
 *
 * **Note:** This function only supports cloning values with tags of
 * `Boolean`, `Date`, `Error`, `Map`, `Number`, `RegExp`, `Set`, or `String`.
 *
 * @private
 * @param {Object} object The object to clone.
 * @param {string} tag The `toStringTag` of the object to clone.
 * @param {boolean} [isDeep] Specify a deep clone.
 * @returns {Object} Returns the initialized clone.
 */
function initCloneByTag(object, tag, isDeep) {
  var Ctor = object.constructor;
  switch (tag) {
    case arrayBufferTag:
      return cloneArrayBuffer(object);

    case boolTag:
    case dateTag:
      return new Ctor(+object);

    case dataViewTag:
      return cloneDataView(object, isDeep);

    case float32Tag: case float64Tag:
    case int8Tag: case int16Tag: case int32Tag:
    case uint8Tag: case uint8ClampedTag: case uint16Tag: case uint32Tag:
      return cloneTypedArray(object, isDeep);

    case mapTag:
      return new Ctor;

    case numberTag:
    case stringTag:
      return new Ctor(object);

    case regexpTag:
      return cloneRegExp(object);

    case setTag:
      return new Ctor;

    case symbolTag:
      return cloneSymbol(object);
  }
}

module.exports = initCloneByTag;


/***/ }),

/***/ "./node_modules/lodash/_initCloneObject.js":
/*!*************************************************!*\
  !*** ./node_modules/lodash/_initCloneObject.js ***!
  \*************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var baseCreate = __webpack_require__(/*! ./_baseCreate */ "./node_modules/lodash/_baseCreate.js"),
    getPrototype = __webpack_require__(/*! ./_getPrototype */ "./node_modules/lodash/_getPrototype.js"),
    isPrototype = __webpack_require__(/*! ./_isPrototype */ "./node_modules/lodash/_isPrototype.js");

/**
 * Initializes an object clone.
 *
 * @private
 * @param {Object} object The object to clone.
 * @returns {Object} Returns the initialized clone.
 */
function initCloneObject(object) {
  return (typeof object.constructor == 'function' && !isPrototype(object))
    ? baseCreate(getPrototype(object))
    : {};
}

module.exports = initCloneObject;


/***/ }),

/***/ "./node_modules/lodash/_isIndex.js":
/*!*****************************************!*\
  !*** ./node_modules/lodash/_isIndex.js ***!
  \*****************************************/
/***/ ((module) => {

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  var type = typeof value;
  length = length == null ? MAX_SAFE_INTEGER : length;

  return !!length &&
    (type == 'number' ||
      (type != 'symbol' && reIsUint.test(value))) &&
        (value > -1 && value % 1 == 0 && value < length);
}

module.exports = isIndex;


/***/ }),

/***/ "./node_modules/lodash/_isKey.js":
/*!***************************************!*\
  !*** ./node_modules/lodash/_isKey.js ***!
  \***************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var isArray = __webpack_require__(/*! ./isArray */ "./node_modules/lodash/isArray.js"),
    isSymbol = __webpack_require__(/*! ./isSymbol */ "./node_modules/lodash/isSymbol.js");

/** Used to match property names within property paths. */
var reIsDeepProp = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/,
    reIsPlainProp = /^\w*$/;

/**
 * Checks if `value` is a property name and not a property path.
 *
 * @private
 * @param {*} value The value to check.
 * @param {Object} [object] The object to query keys on.
 * @returns {boolean} Returns `true` if `value` is a property name, else `false`.
 */
function isKey(value, object) {
  if (isArray(value)) {
    return false;
  }
  var type = typeof value;
  if (type == 'number' || type == 'symbol' || type == 'boolean' ||
      value == null || isSymbol(value)) {
    return true;
  }
  return reIsPlainProp.test(value) || !reIsDeepProp.test(value) ||
    (object != null && value in Object(object));
}

module.exports = isKey;


/***/ }),

/***/ "./node_modules/lodash/_isKeyable.js":
/*!*******************************************!*\
  !*** ./node_modules/lodash/_isKeyable.js ***!
  \*******************************************/
/***/ ((module) => {

/**
 * Checks if `value` is suitable for use as unique object key.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is suitable, else `false`.
 */
function isKeyable(value) {
  var type = typeof value;
  return (type == 'string' || type == 'number' || type == 'symbol' || type == 'boolean')
    ? (value !== '__proto__')
    : (value === null);
}

module.exports = isKeyable;


/***/ }),

/***/ "./node_modules/lodash/_isMasked.js":
/*!******************************************!*\
  !*** ./node_modules/lodash/_isMasked.js ***!
  \******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var coreJsData = __webpack_require__(/*! ./_coreJsData */ "./node_modules/lodash/_coreJsData.js");

/** Used to detect methods masquerading as native. */
var maskSrcKey = (function() {
  var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || '');
  return uid ? ('Symbol(src)_1.' + uid) : '';
}());

/**
 * Checks if `func` has its source masked.
 *
 * @private
 * @param {Function} func The function to check.
 * @returns {boolean} Returns `true` if `func` is masked, else `false`.
 */
function isMasked(func) {
  return !!maskSrcKey && (maskSrcKey in func);
}

module.exports = isMasked;


/***/ }),

/***/ "./node_modules/lodash/_isPrototype.js":
/*!*********************************************!*\
  !*** ./node_modules/lodash/_isPrototype.js ***!
  \*********************************************/
/***/ ((module) => {

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Checks if `value` is likely a prototype object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
 */
function isPrototype(value) {
  var Ctor = value && value.constructor,
      proto = (typeof Ctor == 'function' && Ctor.prototype) || objectProto;

  return value === proto;
}

module.exports = isPrototype;


/***/ }),

/***/ "./node_modules/lodash/_listCacheClear.js":
/*!************************************************!*\
  !*** ./node_modules/lodash/_listCacheClear.js ***!
  \************************************************/
/***/ ((module) => {

/**
 * Removes all key-value entries from the list cache.
 *
 * @private
 * @name clear
 * @memberOf ListCache
 */
function listCacheClear() {
  this.__data__ = [];
  this.size = 0;
}

module.exports = listCacheClear;


/***/ }),

/***/ "./node_modules/lodash/_listCacheDelete.js":
/*!*************************************************!*\
  !*** ./node_modules/lodash/_listCacheDelete.js ***!
  \*************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var assocIndexOf = __webpack_require__(/*! ./_assocIndexOf */ "./node_modules/lodash/_assocIndexOf.js");

/** Used for built-in method references. */
var arrayProto = Array.prototype;

/** Built-in value references. */
var splice = arrayProto.splice;

/**
 * Removes `key` and its value from the list cache.
 *
 * @private
 * @name delete
 * @memberOf ListCache
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function listCacheDelete(key) {
  var data = this.__data__,
      index = assocIndexOf(data, key);

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

module.exports = listCacheDelete;


/***/ }),

/***/ "./node_modules/lodash/_listCacheGet.js":
/*!**********************************************!*\
  !*** ./node_modules/lodash/_listCacheGet.js ***!
  \**********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var assocIndexOf = __webpack_require__(/*! ./_assocIndexOf */ "./node_modules/lodash/_assocIndexOf.js");

/**
 * Gets the list cache value for `key`.
 *
 * @private
 * @name get
 * @memberOf ListCache
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function listCacheGet(key) {
  var data = this.__data__,
      index = assocIndexOf(data, key);

  return index < 0 ? undefined : data[index][1];
}

module.exports = listCacheGet;


/***/ }),

/***/ "./node_modules/lodash/_listCacheHas.js":
/*!**********************************************!*\
  !*** ./node_modules/lodash/_listCacheHas.js ***!
  \**********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var assocIndexOf = __webpack_require__(/*! ./_assocIndexOf */ "./node_modules/lodash/_assocIndexOf.js");

/**
 * Checks if a list cache value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf ListCache
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function listCacheHas(key) {
  return assocIndexOf(this.__data__, key) > -1;
}

module.exports = listCacheHas;


/***/ }),

/***/ "./node_modules/lodash/_listCacheSet.js":
/*!**********************************************!*\
  !*** ./node_modules/lodash/_listCacheSet.js ***!
  \**********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var assocIndexOf = __webpack_require__(/*! ./_assocIndexOf */ "./node_modules/lodash/_assocIndexOf.js");

/**
 * Sets the list cache `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf ListCache
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the list cache instance.
 */
function listCacheSet(key, value) {
  var data = this.__data__,
      index = assocIndexOf(data, key);

  if (index < 0) {
    ++this.size;
    data.push([key, value]);
  } else {
    data[index][1] = value;
  }
  return this;
}

module.exports = listCacheSet;


/***/ }),

/***/ "./node_modules/lodash/_mapCacheClear.js":
/*!***********************************************!*\
  !*** ./node_modules/lodash/_mapCacheClear.js ***!
  \***********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var Hash = __webpack_require__(/*! ./_Hash */ "./node_modules/lodash/_Hash.js"),
    ListCache = __webpack_require__(/*! ./_ListCache */ "./node_modules/lodash/_ListCache.js"),
    Map = __webpack_require__(/*! ./_Map */ "./node_modules/lodash/_Map.js");

/**
 * Removes all key-value entries from the map.
 *
 * @private
 * @name clear
 * @memberOf MapCache
 */
function mapCacheClear() {
  this.size = 0;
  this.__data__ = {
    'hash': new Hash,
    'map': new (Map || ListCache),
    'string': new Hash
  };
}

module.exports = mapCacheClear;


/***/ }),

/***/ "./node_modules/lodash/_mapCacheDelete.js":
/*!************************************************!*\
  !*** ./node_modules/lodash/_mapCacheDelete.js ***!
  \************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var getMapData = __webpack_require__(/*! ./_getMapData */ "./node_modules/lodash/_getMapData.js");

/**
 * Removes `key` and its value from the map.
 *
 * @private
 * @name delete
 * @memberOf MapCache
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function mapCacheDelete(key) {
  var result = getMapData(this, key)['delete'](key);
  this.size -= result ? 1 : 0;
  return result;
}

module.exports = mapCacheDelete;


/***/ }),

/***/ "./node_modules/lodash/_mapCacheGet.js":
/*!*********************************************!*\
  !*** ./node_modules/lodash/_mapCacheGet.js ***!
  \*********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var getMapData = __webpack_require__(/*! ./_getMapData */ "./node_modules/lodash/_getMapData.js");

/**
 * Gets the map value for `key`.
 *
 * @private
 * @name get
 * @memberOf MapCache
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function mapCacheGet(key) {
  return getMapData(this, key).get(key);
}

module.exports = mapCacheGet;


/***/ }),

/***/ "./node_modules/lodash/_mapCacheHas.js":
/*!*********************************************!*\
  !*** ./node_modules/lodash/_mapCacheHas.js ***!
  \*********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var getMapData = __webpack_require__(/*! ./_getMapData */ "./node_modules/lodash/_getMapData.js");

/**
 * Checks if a map value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf MapCache
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function mapCacheHas(key) {
  return getMapData(this, key).has(key);
}

module.exports = mapCacheHas;


/***/ }),

/***/ "./node_modules/lodash/_mapCacheSet.js":
/*!*********************************************!*\
  !*** ./node_modules/lodash/_mapCacheSet.js ***!
  \*********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var getMapData = __webpack_require__(/*! ./_getMapData */ "./node_modules/lodash/_getMapData.js");

/**
 * Sets the map `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf MapCache
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the map cache instance.
 */
function mapCacheSet(key, value) {
  var data = getMapData(this, key),
      size = data.size;

  data.set(key, value);
  this.size += data.size == size ? 0 : 1;
  return this;
}

module.exports = mapCacheSet;


/***/ }),

/***/ "./node_modules/lodash/_memoizeCapped.js":
/*!***********************************************!*\
  !*** ./node_modules/lodash/_memoizeCapped.js ***!
  \***********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var memoize = __webpack_require__(/*! ./memoize */ "./node_modules/lodash/memoize.js");

/** Used as the maximum memoize cache size. */
var MAX_MEMOIZE_SIZE = 500;

/**
 * A specialized version of `_.memoize` which clears the memoized function's
 * cache when it exceeds `MAX_MEMOIZE_SIZE`.
 *
 * @private
 * @param {Function} func The function to have its output memoized.
 * @returns {Function} Returns the new memoized function.
 */
function memoizeCapped(func) {
  var result = memoize(func, function(key) {
    if (cache.size === MAX_MEMOIZE_SIZE) {
      cache.clear();
    }
    return key;
  });

  var cache = result.cache;
  return result;
}

module.exports = memoizeCapped;


/***/ }),

/***/ "./node_modules/lodash/_nativeCreate.js":
/*!**********************************************!*\
  !*** ./node_modules/lodash/_nativeCreate.js ***!
  \**********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var getNative = __webpack_require__(/*! ./_getNative */ "./node_modules/lodash/_getNative.js");

/* Built-in method references that are verified to be native. */
var nativeCreate = getNative(Object, 'create');

module.exports = nativeCreate;


/***/ }),

/***/ "./node_modules/lodash/_nativeKeys.js":
/*!********************************************!*\
  !*** ./node_modules/lodash/_nativeKeys.js ***!
  \********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var overArg = __webpack_require__(/*! ./_overArg */ "./node_modules/lodash/_overArg.js");

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeKeys = overArg(Object.keys, Object);

module.exports = nativeKeys;


/***/ }),

/***/ "./node_modules/lodash/_nativeKeysIn.js":
/*!**********************************************!*\
  !*** ./node_modules/lodash/_nativeKeysIn.js ***!
  \**********************************************/
/***/ ((module) => {

/**
 * This function is like
 * [`Object.keys`](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
 * except that it includes inherited enumerable properties.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function nativeKeysIn(object) {
  var result = [];
  if (object != null) {
    for (var key in Object(object)) {
      result.push(key);
    }
  }
  return result;
}

module.exports = nativeKeysIn;


/***/ }),

/***/ "./node_modules/lodash/_nodeUtil.js":
/*!******************************************!*\
  !*** ./node_modules/lodash/_nodeUtil.js ***!
  \******************************************/
/***/ ((module, exports, __webpack_require__) => {

/* module decorator */ module = __webpack_require__.nmd(module);
var freeGlobal = __webpack_require__(/*! ./_freeGlobal */ "./node_modules/lodash/_freeGlobal.js");

/** Detect free variable `exports`. */
var freeExports =  true && exports && !exports.nodeType && exports;

/** Detect free variable `module`. */
var freeModule = freeExports && "object" == 'object' && module && !module.nodeType && module;

/** Detect the popular CommonJS extension `module.exports`. */
var moduleExports = freeModule && freeModule.exports === freeExports;

/** Detect free variable `process` from Node.js. */
var freeProcess = moduleExports && freeGlobal.process;

/** Used to access faster Node.js helpers. */
var nodeUtil = (function() {
  try {
    // Use `util.types` for Node.js 10+.
    var types = freeModule && freeModule.require && freeModule.require('util').types;

    if (types) {
      return types;
    }

    // Legacy `process.binding('util')` for Node.js < 10.
    return freeProcess && freeProcess.binding && freeProcess.binding('util');
  } catch (e) {}
}());

module.exports = nodeUtil;


/***/ }),

/***/ "./node_modules/lodash/_objectToString.js":
/*!************************************************!*\
  !*** ./node_modules/lodash/_objectToString.js ***!
  \************************************************/
/***/ ((module) => {

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var nativeObjectToString = objectProto.toString;

/**
 * Converts `value` to a string using `Object.prototype.toString`.
 *
 * @private
 * @param {*} value The value to convert.
 * @returns {string} Returns the converted string.
 */
function objectToString(value) {
  return nativeObjectToString.call(value);
}

module.exports = objectToString;


/***/ }),

/***/ "./node_modules/lodash/_overArg.js":
/*!*****************************************!*\
  !*** ./node_modules/lodash/_overArg.js ***!
  \*****************************************/
/***/ ((module) => {

/**
 * Creates a unary function that invokes `func` with its argument transformed.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {Function} transform The argument transform.
 * @returns {Function} Returns the new function.
 */
function overArg(func, transform) {
  return function(arg) {
    return func(transform(arg));
  };
}

module.exports = overArg;


/***/ }),

/***/ "./node_modules/lodash/_root.js":
/*!**************************************!*\
  !*** ./node_modules/lodash/_root.js ***!
  \**************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var freeGlobal = __webpack_require__(/*! ./_freeGlobal */ "./node_modules/lodash/_freeGlobal.js");

/** Detect free variable `self`. */
var freeSelf = typeof self == 'object' && self && self.Object === Object && self;

/** Used as a reference to the global object. */
var root = freeGlobal || freeSelf || Function('return this')();

module.exports = root;


/***/ }),

/***/ "./node_modules/lodash/_stackClear.js":
/*!********************************************!*\
  !*** ./node_modules/lodash/_stackClear.js ***!
  \********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var ListCache = __webpack_require__(/*! ./_ListCache */ "./node_modules/lodash/_ListCache.js");

/**
 * Removes all key-value entries from the stack.
 *
 * @private
 * @name clear
 * @memberOf Stack
 */
function stackClear() {
  this.__data__ = new ListCache;
  this.size = 0;
}

module.exports = stackClear;


/***/ }),

/***/ "./node_modules/lodash/_stackDelete.js":
/*!*********************************************!*\
  !*** ./node_modules/lodash/_stackDelete.js ***!
  \*********************************************/
/***/ ((module) => {

/**
 * Removes `key` and its value from the stack.
 *
 * @private
 * @name delete
 * @memberOf Stack
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function stackDelete(key) {
  var data = this.__data__,
      result = data['delete'](key);

  this.size = data.size;
  return result;
}

module.exports = stackDelete;


/***/ }),

/***/ "./node_modules/lodash/_stackGet.js":
/*!******************************************!*\
  !*** ./node_modules/lodash/_stackGet.js ***!
  \******************************************/
/***/ ((module) => {

/**
 * Gets the stack value for `key`.
 *
 * @private
 * @name get
 * @memberOf Stack
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function stackGet(key) {
  return this.__data__.get(key);
}

module.exports = stackGet;


/***/ }),

/***/ "./node_modules/lodash/_stackHas.js":
/*!******************************************!*\
  !*** ./node_modules/lodash/_stackHas.js ***!
  \******************************************/
/***/ ((module) => {

/**
 * Checks if a stack value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf Stack
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function stackHas(key) {
  return this.__data__.has(key);
}

module.exports = stackHas;


/***/ }),

/***/ "./node_modules/lodash/_stackSet.js":
/*!******************************************!*\
  !*** ./node_modules/lodash/_stackSet.js ***!
  \******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var ListCache = __webpack_require__(/*! ./_ListCache */ "./node_modules/lodash/_ListCache.js"),
    Map = __webpack_require__(/*! ./_Map */ "./node_modules/lodash/_Map.js"),
    MapCache = __webpack_require__(/*! ./_MapCache */ "./node_modules/lodash/_MapCache.js");

/** Used as the size to enable large array optimizations. */
var LARGE_ARRAY_SIZE = 200;

/**
 * Sets the stack `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf Stack
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the stack cache instance.
 */
function stackSet(key, value) {
  var data = this.__data__;
  if (data instanceof ListCache) {
    var pairs = data.__data__;
    if (!Map || (pairs.length < LARGE_ARRAY_SIZE - 1)) {
      pairs.push([key, value]);
      this.size = ++data.size;
      return this;
    }
    data = this.__data__ = new MapCache(pairs);
  }
  data.set(key, value);
  this.size = data.size;
  return this;
}

module.exports = stackSet;


/***/ }),

/***/ "./node_modules/lodash/_stringToPath.js":
/*!**********************************************!*\
  !*** ./node_modules/lodash/_stringToPath.js ***!
  \**********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var memoizeCapped = __webpack_require__(/*! ./_memoizeCapped */ "./node_modules/lodash/_memoizeCapped.js");

/** Used to match property names within property paths. */
var rePropName = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g;

/** Used to match backslashes in property paths. */
var reEscapeChar = /\\(\\)?/g;

/**
 * Converts `string` to a property path array.
 *
 * @private
 * @param {string} string The string to convert.
 * @returns {Array} Returns the property path array.
 */
var stringToPath = memoizeCapped(function(string) {
  var result = [];
  if (string.charCodeAt(0) === 46 /* . */) {
    result.push('');
  }
  string.replace(rePropName, function(match, number, quote, subString) {
    result.push(quote ? subString.replace(reEscapeChar, '$1') : (number || match));
  });
  return result;
});

module.exports = stringToPath;


/***/ }),

/***/ "./node_modules/lodash/_toKey.js":
/*!***************************************!*\
  !*** ./node_modules/lodash/_toKey.js ***!
  \***************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var isSymbol = __webpack_require__(/*! ./isSymbol */ "./node_modules/lodash/isSymbol.js");

/** Used as references for various `Number` constants. */
var INFINITY = 1 / 0;

/**
 * Converts `value` to a string key if it's not a string or symbol.
 *
 * @private
 * @param {*} value The value to inspect.
 * @returns {string|symbol} Returns the key.
 */
function toKey(value) {
  if (typeof value == 'string' || isSymbol(value)) {
    return value;
  }
  var result = (value + '');
  return (result == '0' && (1 / value) == -INFINITY) ? '-0' : result;
}

module.exports = toKey;


/***/ }),

/***/ "./node_modules/lodash/_toSource.js":
/*!******************************************!*\
  !*** ./node_modules/lodash/_toSource.js ***!
  \******************************************/
/***/ ((module) => {

/** Used for built-in method references. */
var funcProto = Function.prototype;

/** Used to resolve the decompiled source of functions. */
var funcToString = funcProto.toString;

/**
 * Converts `func` to its source code.
 *
 * @private
 * @param {Function} func The function to convert.
 * @returns {string} Returns the source code.
 */
function toSource(func) {
  if (func != null) {
    try {
      return funcToString.call(func);
    } catch (e) {}
    try {
      return (func + '');
    } catch (e) {}
  }
  return '';
}

module.exports = toSource;


/***/ }),

/***/ "./node_modules/lodash/cloneDeep.js":
/*!******************************************!*\
  !*** ./node_modules/lodash/cloneDeep.js ***!
  \******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var baseClone = __webpack_require__(/*! ./_baseClone */ "./node_modules/lodash/_baseClone.js");

/** Used to compose bitmasks for cloning. */
var CLONE_DEEP_FLAG = 1,
    CLONE_SYMBOLS_FLAG = 4;

/**
 * This method is like `_.clone` except that it recursively clones `value`.
 *
 * @static
 * @memberOf _
 * @since 1.0.0
 * @category Lang
 * @param {*} value The value to recursively clone.
 * @returns {*} Returns the deep cloned value.
 * @see _.clone
 * @example
 *
 * var objects = [{ 'a': 1 }, { 'b': 2 }];
 *
 * var deep = _.cloneDeep(objects);
 * console.log(deep[0] === objects[0]);
 * // => false
 */
function cloneDeep(value) {
  return baseClone(value, CLONE_DEEP_FLAG | CLONE_SYMBOLS_FLAG);
}

module.exports = cloneDeep;


/***/ }),

/***/ "./node_modules/lodash/eq.js":
/*!***********************************!*\
  !*** ./node_modules/lodash/eq.js ***!
  \***********************************/
/***/ ((module) => {

/**
 * Performs a
 * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
 * comparison between two values to determine if they are equivalent.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'a': 1 };
 * var other = { 'a': 1 };
 *
 * _.eq(object, object);
 * // => true
 *
 * _.eq(object, other);
 * // => false
 *
 * _.eq('a', 'a');
 * // => true
 *
 * _.eq('a', Object('a'));
 * // => false
 *
 * _.eq(NaN, NaN);
 * // => true
 */
function eq(value, other) {
  return value === other || (value !== value && other !== other);
}

module.exports = eq;


/***/ }),

/***/ "./node_modules/lodash/isArguments.js":
/*!********************************************!*\
  !*** ./node_modules/lodash/isArguments.js ***!
  \********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var baseIsArguments = __webpack_require__(/*! ./_baseIsArguments */ "./node_modules/lodash/_baseIsArguments.js"),
    isObjectLike = __webpack_require__(/*! ./isObjectLike */ "./node_modules/lodash/isObjectLike.js");

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/** Built-in value references. */
var propertyIsEnumerable = objectProto.propertyIsEnumerable;

/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
 *  else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
var isArguments = baseIsArguments(function() { return arguments; }()) ? baseIsArguments : function(value) {
  return isObjectLike(value) && hasOwnProperty.call(value, 'callee') &&
    !propertyIsEnumerable.call(value, 'callee');
};

module.exports = isArguments;


/***/ }),

/***/ "./node_modules/lodash/isArray.js":
/*!****************************************!*\
  !*** ./node_modules/lodash/isArray.js ***!
  \****************************************/
/***/ ((module) => {

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

module.exports = isArray;


/***/ }),

/***/ "./node_modules/lodash/isArrayLike.js":
/*!********************************************!*\
  !*** ./node_modules/lodash/isArrayLike.js ***!
  \********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var isFunction = __webpack_require__(/*! ./isFunction */ "./node_modules/lodash/isFunction.js"),
    isLength = __webpack_require__(/*! ./isLength */ "./node_modules/lodash/isLength.js");

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null && isLength(value.length) && !isFunction(value);
}

module.exports = isArrayLike;


/***/ }),

/***/ "./node_modules/lodash/isBuffer.js":
/*!*****************************************!*\
  !*** ./node_modules/lodash/isBuffer.js ***!
  \*****************************************/
/***/ ((module, exports, __webpack_require__) => {

/* module decorator */ module = __webpack_require__.nmd(module);
var root = __webpack_require__(/*! ./_root */ "./node_modules/lodash/_root.js"),
    stubFalse = __webpack_require__(/*! ./stubFalse */ "./node_modules/lodash/stubFalse.js");

/** Detect free variable `exports`. */
var freeExports =  true && exports && !exports.nodeType && exports;

/** Detect free variable `module`. */
var freeModule = freeExports && "object" == 'object' && module && !module.nodeType && module;

/** Detect the popular CommonJS extension `module.exports`. */
var moduleExports = freeModule && freeModule.exports === freeExports;

/** Built-in value references. */
var Buffer = moduleExports ? root.Buffer : undefined;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeIsBuffer = Buffer ? Buffer.isBuffer : undefined;

/**
 * Checks if `value` is a buffer.
 *
 * @static
 * @memberOf _
 * @since 4.3.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a buffer, else `false`.
 * @example
 *
 * _.isBuffer(new Buffer(2));
 * // => true
 *
 * _.isBuffer(new Uint8Array(2));
 * // => false
 */
var isBuffer = nativeIsBuffer || stubFalse;

module.exports = isBuffer;


/***/ }),

/***/ "./node_modules/lodash/isFunction.js":
/*!*******************************************!*\
  !*** ./node_modules/lodash/isFunction.js ***!
  \*******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var baseGetTag = __webpack_require__(/*! ./_baseGetTag */ "./node_modules/lodash/_baseGetTag.js"),
    isObject = __webpack_require__(/*! ./isObject */ "./node_modules/lodash/isObject.js");

/** `Object#toString` result references. */
var asyncTag = '[object AsyncFunction]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]',
    proxyTag = '[object Proxy]';

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a function, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  if (!isObject(value)) {
    return false;
  }
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 9 which returns 'object' for typed arrays and other constructors.
  var tag = baseGetTag(value);
  return tag == funcTag || tag == genTag || tag == asyncTag || tag == proxyTag;
}

module.exports = isFunction;


/***/ }),

/***/ "./node_modules/lodash/isLength.js":
/*!*****************************************!*\
  !*** ./node_modules/lodash/isLength.js ***!
  \*****************************************/
/***/ ((module) => {

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This method is loosely based on
 * [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

module.exports = isLength;


/***/ }),

/***/ "./node_modules/lodash/isMap.js":
/*!**************************************!*\
  !*** ./node_modules/lodash/isMap.js ***!
  \**************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var baseIsMap = __webpack_require__(/*! ./_baseIsMap */ "./node_modules/lodash/_baseIsMap.js"),
    baseUnary = __webpack_require__(/*! ./_baseUnary */ "./node_modules/lodash/_baseUnary.js"),
    nodeUtil = __webpack_require__(/*! ./_nodeUtil */ "./node_modules/lodash/_nodeUtil.js");

/* Node.js helper references. */
var nodeIsMap = nodeUtil && nodeUtil.isMap;

/**
 * Checks if `value` is classified as a `Map` object.
 *
 * @static
 * @memberOf _
 * @since 4.3.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a map, else `false`.
 * @example
 *
 * _.isMap(new Map);
 * // => true
 *
 * _.isMap(new WeakMap);
 * // => false
 */
var isMap = nodeIsMap ? baseUnary(nodeIsMap) : baseIsMap;

module.exports = isMap;


/***/ }),

/***/ "./node_modules/lodash/isObject.js":
/*!*****************************************!*\
  !*** ./node_modules/lodash/isObject.js ***!
  \*****************************************/
/***/ ((module) => {

/**
 * Checks if `value` is the
 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return value != null && (type == 'object' || type == 'function');
}

module.exports = isObject;


/***/ }),

/***/ "./node_modules/lodash/isObjectLike.js":
/*!*********************************************!*\
  !*** ./node_modules/lodash/isObjectLike.js ***!
  \*********************************************/
/***/ ((module) => {

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return value != null && typeof value == 'object';
}

module.exports = isObjectLike;


/***/ }),

/***/ "./node_modules/lodash/isSet.js":
/*!**************************************!*\
  !*** ./node_modules/lodash/isSet.js ***!
  \**************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var baseIsSet = __webpack_require__(/*! ./_baseIsSet */ "./node_modules/lodash/_baseIsSet.js"),
    baseUnary = __webpack_require__(/*! ./_baseUnary */ "./node_modules/lodash/_baseUnary.js"),
    nodeUtil = __webpack_require__(/*! ./_nodeUtil */ "./node_modules/lodash/_nodeUtil.js");

/* Node.js helper references. */
var nodeIsSet = nodeUtil && nodeUtil.isSet;

/**
 * Checks if `value` is classified as a `Set` object.
 *
 * @static
 * @memberOf _
 * @since 4.3.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a set, else `false`.
 * @example
 *
 * _.isSet(new Set);
 * // => true
 *
 * _.isSet(new WeakSet);
 * // => false
 */
var isSet = nodeIsSet ? baseUnary(nodeIsSet) : baseIsSet;

module.exports = isSet;


/***/ }),

/***/ "./node_modules/lodash/isSymbol.js":
/*!*****************************************!*\
  !*** ./node_modules/lodash/isSymbol.js ***!
  \*****************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var baseGetTag = __webpack_require__(/*! ./_baseGetTag */ "./node_modules/lodash/_baseGetTag.js"),
    isObjectLike = __webpack_require__(/*! ./isObjectLike */ "./node_modules/lodash/isObjectLike.js");

/** `Object#toString` result references. */
var symbolTag = '[object Symbol]';

/**
 * Checks if `value` is classified as a `Symbol` primitive or object.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
 * @example
 *
 * _.isSymbol(Symbol.iterator);
 * // => true
 *
 * _.isSymbol('abc');
 * // => false
 */
function isSymbol(value) {
  return typeof value == 'symbol' ||
    (isObjectLike(value) && baseGetTag(value) == symbolTag);
}

module.exports = isSymbol;


/***/ }),

/***/ "./node_modules/lodash/isTypedArray.js":
/*!*********************************************!*\
  !*** ./node_modules/lodash/isTypedArray.js ***!
  \*********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var baseIsTypedArray = __webpack_require__(/*! ./_baseIsTypedArray */ "./node_modules/lodash/_baseIsTypedArray.js"),
    baseUnary = __webpack_require__(/*! ./_baseUnary */ "./node_modules/lodash/_baseUnary.js"),
    nodeUtil = __webpack_require__(/*! ./_nodeUtil */ "./node_modules/lodash/_nodeUtil.js");

/* Node.js helper references. */
var nodeIsTypedArray = nodeUtil && nodeUtil.isTypedArray;

/**
 * Checks if `value` is classified as a typed array.
 *
 * @static
 * @memberOf _
 * @since 3.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
 * @example
 *
 * _.isTypedArray(new Uint8Array);
 * // => true
 *
 * _.isTypedArray([]);
 * // => false
 */
var isTypedArray = nodeIsTypedArray ? baseUnary(nodeIsTypedArray) : baseIsTypedArray;

module.exports = isTypedArray;


/***/ }),

/***/ "./node_modules/lodash/keys.js":
/*!*************************************!*\
  !*** ./node_modules/lodash/keys.js ***!
  \*************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var arrayLikeKeys = __webpack_require__(/*! ./_arrayLikeKeys */ "./node_modules/lodash/_arrayLikeKeys.js"),
    baseKeys = __webpack_require__(/*! ./_baseKeys */ "./node_modules/lodash/_baseKeys.js"),
    isArrayLike = __webpack_require__(/*! ./isArrayLike */ "./node_modules/lodash/isArrayLike.js");

/**
 * Creates an array of the own enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects. See the
 * [ES spec](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
 * for more details.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keys(new Foo);
 * // => ['a', 'b'] (iteration order is not guaranteed)
 *
 * _.keys('hi');
 * // => ['0', '1']
 */
function keys(object) {
  return isArrayLike(object) ? arrayLikeKeys(object) : baseKeys(object);
}

module.exports = keys;


/***/ }),

/***/ "./node_modules/lodash/keysIn.js":
/*!***************************************!*\
  !*** ./node_modules/lodash/keysIn.js ***!
  \***************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var arrayLikeKeys = __webpack_require__(/*! ./_arrayLikeKeys */ "./node_modules/lodash/_arrayLikeKeys.js"),
    baseKeysIn = __webpack_require__(/*! ./_baseKeysIn */ "./node_modules/lodash/_baseKeysIn.js"),
    isArrayLike = __webpack_require__(/*! ./isArrayLike */ "./node_modules/lodash/isArrayLike.js");

/**
 * Creates an array of the own and inherited enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects.
 *
 * @static
 * @memberOf _
 * @since 3.0.0
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keysIn(new Foo);
 * // => ['a', 'b', 'c'] (iteration order is not guaranteed)
 */
function keysIn(object) {
  return isArrayLike(object) ? arrayLikeKeys(object, true) : baseKeysIn(object);
}

module.exports = keysIn;


/***/ }),

/***/ "./node_modules/lodash/memoize.js":
/*!****************************************!*\
  !*** ./node_modules/lodash/memoize.js ***!
  \****************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var MapCache = __webpack_require__(/*! ./_MapCache */ "./node_modules/lodash/_MapCache.js");

/** Error message constants. */
var FUNC_ERROR_TEXT = 'Expected a function';

/**
 * Creates a function that memoizes the result of `func`. If `resolver` is
 * provided, it determines the cache key for storing the result based on the
 * arguments provided to the memoized function. By default, the first argument
 * provided to the memoized function is used as the map cache key. The `func`
 * is invoked with the `this` binding of the memoized function.
 *
 * **Note:** The cache is exposed as the `cache` property on the memoized
 * function. Its creation may be customized by replacing the `_.memoize.Cache`
 * constructor with one whose instances implement the
 * [`Map`](http://ecma-international.org/ecma-262/7.0/#sec-properties-of-the-map-prototype-object)
 * method interface of `clear`, `delete`, `get`, `has`, and `set`.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Function
 * @param {Function} func The function to have its output memoized.
 * @param {Function} [resolver] The function to resolve the cache key.
 * @returns {Function} Returns the new memoized function.
 * @example
 *
 * var object = { 'a': 1, 'b': 2 };
 * var other = { 'c': 3, 'd': 4 };
 *
 * var values = _.memoize(_.values);
 * values(object);
 * // => [1, 2]
 *
 * values(other);
 * // => [3, 4]
 *
 * object.a = 2;
 * values(object);
 * // => [1, 2]
 *
 * // Modify the result cache.
 * values.cache.set(object, ['a', 'b']);
 * values(object);
 * // => ['a', 'b']
 *
 * // Replace `_.memoize.Cache`.
 * _.memoize.Cache = WeakMap;
 */
function memoize(func, resolver) {
  if (typeof func != 'function' || (resolver != null && typeof resolver != 'function')) {
    throw new TypeError(FUNC_ERROR_TEXT);
  }
  var memoized = function() {
    var args = arguments,
        key = resolver ? resolver.apply(this, args) : args[0],
        cache = memoized.cache;

    if (cache.has(key)) {
      return cache.get(key);
    }
    var result = func.apply(this, args);
    memoized.cache = cache.set(key, result) || cache;
    return result;
  };
  memoized.cache = new (memoize.Cache || MapCache);
  return memoized;
}

// Expose `MapCache`.
memoize.Cache = MapCache;

module.exports = memoize;


/***/ }),

/***/ "./node_modules/lodash/set.js":
/*!************************************!*\
  !*** ./node_modules/lodash/set.js ***!
  \************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var baseSet = __webpack_require__(/*! ./_baseSet */ "./node_modules/lodash/_baseSet.js");

/**
 * Sets the value at `path` of `object`. If a portion of `path` doesn't exist,
 * it's created. Arrays are created for missing index properties while objects
 * are created for all other missing properties. Use `_.setWith` to customize
 * `path` creation.
 *
 * **Note:** This method mutates `object`.
 *
 * @static
 * @memberOf _
 * @since 3.7.0
 * @category Object
 * @param {Object} object The object to modify.
 * @param {Array|string} path The path of the property to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns `object`.
 * @example
 *
 * var object = { 'a': [{ 'b': { 'c': 3 } }] };
 *
 * _.set(object, 'a[0].b.c', 4);
 * console.log(object.a[0].b.c);
 * // => 4
 *
 * _.set(object, ['x', '0', 'y', 'z'], 5);
 * console.log(object.x[0].y.z);
 * // => 5
 */
function set(object, path, value) {
  return object == null ? object : baseSet(object, path, value);
}

module.exports = set;


/***/ }),

/***/ "./node_modules/lodash/stubArray.js":
/*!******************************************!*\
  !*** ./node_modules/lodash/stubArray.js ***!
  \******************************************/
/***/ ((module) => {

/**
 * This method returns a new empty array.
 *
 * @static
 * @memberOf _
 * @since 4.13.0
 * @category Util
 * @returns {Array} Returns the new empty array.
 * @example
 *
 * var arrays = _.times(2, _.stubArray);
 *
 * console.log(arrays);
 * // => [[], []]
 *
 * console.log(arrays[0] === arrays[1]);
 * // => false
 */
function stubArray() {
  return [];
}

module.exports = stubArray;


/***/ }),

/***/ "./node_modules/lodash/stubFalse.js":
/*!******************************************!*\
  !*** ./node_modules/lodash/stubFalse.js ***!
  \******************************************/
/***/ ((module) => {

/**
 * This method returns `false`.
 *
 * @static
 * @memberOf _
 * @since 4.13.0
 * @category Util
 * @returns {boolean} Returns `false`.
 * @example
 *
 * _.times(2, _.stubFalse);
 * // => [false, false]
 */
function stubFalse() {
  return false;
}

module.exports = stubFalse;


/***/ }),

/***/ "./node_modules/lodash/toString.js":
/*!*****************************************!*\
  !*** ./node_modules/lodash/toString.js ***!
  \*****************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var baseToString = __webpack_require__(/*! ./_baseToString */ "./node_modules/lodash/_baseToString.js");

/**
 * Converts `value` to a string. An empty string is returned for `null`
 * and `undefined` values. The sign of `-0` is preserved.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to convert.
 * @returns {string} Returns the converted string.
 * @example
 *
 * _.toString(null);
 * // => ''
 *
 * _.toString(-0);
 * // => '-0'
 *
 * _.toString([1, 2, 3]);
 * // => '1,2,3'
 */
function toString(value) {
  return value == null ? '' : baseToString(value);
}

module.exports = toString;


/***/ }),

/***/ "./node_modules/lodash/uniqueId.js":
/*!*****************************************!*\
  !*** ./node_modules/lodash/uniqueId.js ***!
  \*****************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var toString = __webpack_require__(/*! ./toString */ "./node_modules/lodash/toString.js");

/** Used to generate unique IDs. */
var idCounter = 0;

/**
 * Generates a unique ID. If `prefix` is given, the ID is appended to it.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Util
 * @param {string} [prefix=''] The value to prefix the ID with.
 * @returns {string} Returns the unique ID.
 * @example
 *
 * _.uniqueId('contact_');
 * // => 'contact_104'
 *
 * _.uniqueId();
 * // => '105'
 */
function uniqueId(prefix) {
  var id = ++idCounter;
  return toString(prefix) + id;
}

module.exports = uniqueId;


/***/ }),

/***/ "./src/common/SettingsManager.ts":
/*!***************************************!*\
  !*** ./src/common/SettingsManager.ts ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var common_constants__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! common/constants */ "./src/common/constants.ts");
/* harmony import */ var _storage__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./storage */ "./src/common/storage.ts");


const localStorageSettingsKey = 'settings-sdhqw9dhq92^T@#!gwqyeq';

class SettingsManager {
  onSettingsUpdated = null;
  settings = common_constants__WEBPACK_IMPORTED_MODULE_0__.DEFAULT_SETTINGS;

  constructor(onSettingsUpdated = null, onInitialized = null) {
    this.setup(onSettingsUpdated, onInitialized);
  }

  setSettingsInLocalStorage = settings => {
    try {
      localStorage.setItem(localStorageSettingsKey, JSON.stringify(settings));
    } catch (e) {}
  };
  getSettingsFromLocalStorage = () => {
    try {
      return JSON.parse(localStorage.getItem(localStorageSettingsKey));
    } catch (e) {}

    return null;
  };
  setup = async (onSettingsUpdated, onInitialized) => {
    // console.log('cleared');
    // window.chrome.storage.sync.clear();
    this.onSettingsUpdated = onSettingsUpdated;
    let settings = this.getSettingsFromLocalStorage() || common_constants__WEBPACK_IMPORTED_MODULE_0__.DEFAULT_SETTINGS;
    this.setSettings({
      settings: settings
    });
    settings = await (0,_storage__WEBPACK_IMPORTED_MODULE_1__.getSettingsAsync)();
    this.setSettingsInLocalStorage(settings);
    this.setSettings({
      settings
    });
    onInitialized && onInitialized(settings);
    this.onChangeListener();
  };
  setSettings = ({
    settings
  }) => {
    if (settings == null) return;
    this.settings = settings;
    this.onSettingsUpdated && this.onSettingsUpdated(settings);
  };

  onChangeListener() {
    chrome.storage.onChanged.addListener(storage => {
      if (storage.settings) {
        this.setSettings({
          settings: storage.settings.newValue
        });
        this.setSettingsInLocalStorage(storage.settings.newValue);
      }
    });
  }

  stopListener = () => {
    chrome.storage.onChanged.removeListener(this.setSettings);
    this.onSettingsUpdated = null;
  };
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SettingsManager);

/***/ }),

/***/ "./src/common/canvas.ts":
/*!******************************!*\
  !*** ./src/common/canvas.ts ***!
  \******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   addFabricEditsToFrame: () => (/* binding */ addFabricEditsToFrame),
/* harmony export */   cloneCanvasSource: () => (/* binding */ cloneCanvasSource),
/* harmony export */   drawFrameDataOnCanvas: () => (/* binding */ drawFrameDataOnCanvas),
/* harmony export */   drawFrameOnCanvas: () => (/* binding */ drawFrameOnCanvas),
/* harmony export */   mergeCanvasEdits: () => (/* binding */ mergeCanvasEdits),
/* harmony export */   processFrameEditsToCanvas: () => (/* binding */ processFrameEditsToCanvas)
/* harmony export */ });
/* harmony import */ var _imageProcessing__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./imageProcessing */ "./src/common/imageProcessing.ts");


const getCanvas2DContext = canvas => {
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Unable to acquire 2D canvas context.');
  }

  return context;
};

const cloneCanvasSource = (source, width, height) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  getCanvas2DContext(canvas).drawImage(source, 0, 0, width, height);
  return canvas;
};

const mergeCanvasEdits = (existingEdits, appliedEdits, width, height) => {
  const mergedCanvas = cloneCanvasSource(existingEdits, width, height);
  getCanvas2DContext(mergedCanvas).drawImage(appliedEdits, 0, 0, width, height);
  return mergedCanvas;
};

async function drawFrameOnCanvas(frame, position, canvas = document.createElement('canvas'), outputWidth = canvas.width, outputHeight = canvas.height, signal) {
  return await drawFrameDataOnCanvas(frame.blob, undefined, frame.blobFormat, frame.width, frame.height, frame.edits, frame.zoom || position, canvas, outputWidth, outputHeight, signal);
}

async function drawFrameDataOnCanvas(blob, imageData, blobFormat, codedWidth, codedHeight, fabricEdits, position, canvas = document.createElement('canvas'), outputWidth = canvas.width, outputHeight = canvas.height, signal) {
  return new Promise(async (resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
    }

    let videoFrame;

    const abort = () => {
      videoFrame?.close();
      reject(signal.reason);
    };

    signal?.addEventListener('abort', abort);
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    videoFrame = new VideoFrame(imageData || (await blob.arrayBuffer()), {
      format: blobFormat || 'I420',
      codedHeight,
      codedWidth,
      timestamp: 0
    });
    const context = getCanvas2DContext(canvas);
    context.drawImage(videoFrame, position?.x || 0, position?.y || 0, position?.width || codedWidth, position?.height || codedHeight, 0, 0, outputWidth, outputHeight);
    videoFrame?.close();
    fabricEdits && addFabricEditsToFrameCanvas(fabricEdits, canvas, outputWidth, outputHeight);
    signal?.removeEventListener('abort', abort);
    resolve(canvas);
  });
}

async function processFrameEditsToCanvas(frame, fabricCanvas, width, height, imageCropPosition) {
  const canvas = frame.blob ? await drawFrameOnCanvas(frame, imageCropPosition, undefined, width, height) : await (0,_imageProcessing__WEBPACK_IMPORTED_MODULE_0__.dataUrlToCanvas)(frame.data, imageCropPosition);
  return fabricCanvas ? await addFabricEditsToFrameCanvas(fabricCanvas, canvas, width, height) : canvas;
}

const addFabricEditsToFrame = async (fabricCanvas, frame, width, height) => {
  const frameCanvas = await (0,_imageProcessing__WEBPACK_IMPORTED_MODULE_0__.dataUrlToCanvas)(frame.data);
  return addFabricEditsToFrameCanvas(fabricCanvas, frameCanvas, width, height);
};

const addFabricEditsToFrameCanvas = async (fabricCanvas, canvas, width = canvas.width, height = canvas.height) => {
  getCanvas2DContext(canvas).drawImage(fabricCanvas, 0, 0, width, height);
  return canvas;
};



/***/ }),

/***/ "./src/common/constants.ts":
/*!*********************************!*\
  !*** ./src/common/constants.ts ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ACTIONS: () => (/* binding */ ACTIONS),
/* harmony export */   API_STATUS: () => (/* binding */ API_STATUS),
/* harmony export */   BROWSER: () => (/* binding */ BROWSER),
/* harmony export */   BROWSERS: () => (/* binding */ BROWSERS),
/* harmony export */   BROWSER_ACTIONS: () => (/* binding */ BROWSER_ACTIONS),
/* harmony export */   CANVAS_ACTIONS: () => (/* binding */ CANVAS_ACTIONS),
/* harmony export */   CODEC: () => (/* binding */ CODEC),
/* harmony export */   COLOR: () => (/* binding */ COLOR),
/* harmony export */   COLOR_SCHEME: () => (/* binding */ COLOR_SCHEME),
/* harmony export */   COMMANDS: () => (/* binding */ COMMANDS),
/* harmony export */   DEFAULT_EDITOR_SETTINGS: () => (/* binding */ DEFAULT_EDITOR_SETTINGS),
/* harmony export */   DEFAULT_PREMIUM_SETTINGS: () => (/* binding */ DEFAULT_PREMIUM_SETTINGS),
/* harmony export */   DEFAULT_SETTINGS: () => (/* binding */ DEFAULT_SETTINGS),
/* harmony export */   DOWNLOAD_FILENAME: () => (/* binding */ DOWNLOAD_FILENAME),
/* harmony export */   EDITOR_SETTINGS: () => (/* binding */ EDITOR_SETTINGS),
/* harmony export */   FEATURES: () => (/* binding */ FEATURES),
/* harmony export */   FEEDBACK_FORM_URL: () => (/* binding */ FEEDBACK_FORM_URL),
/* harmony export */   FILE_ACCESS: () => (/* binding */ FILE_ACCESS),
/* harmony export */   FIREBASE_CONFIG: () => (/* binding */ FIREBASE_CONFIG),
/* harmony export */   FONT_FAMILIES: () => (/* binding */ FONT_FAMILIES),
/* harmony export */   FONT_STYLE: () => (/* binding */ FONT_STYLE),
/* harmony export */   FONT_WEIGHT: () => (/* binding */ FONT_WEIGHT),
/* harmony export */   FREE_ALTER_FRAMES_PER_SECOND: () => (/* binding */ FREE_ALTER_FRAMES_PER_SECOND),
/* harmony export */   FREE_FEATURES: () => (/* binding */ FREE_FEATURES),
/* harmony export */   FREE_UPDATE_END_DURATIONS: () => (/* binding */ FREE_UPDATE_END_DURATIONS),
/* harmony export */   GIF_DITHER_METHODS: () => (/* binding */ GIF_DITHER_METHODS),
/* harmony export */   IS_DEV_ENVIRONMENT: () => (/* binding */ IS_DEV_ENVIRONMENT),
/* harmony export */   KEYS: () => (/* binding */ KEYS),
/* harmony export */   LANGUAGE: () => (/* binding */ LANGUAGE),
/* harmony export */   LANGUAGE_LABEL: () => (/* binding */ LANGUAGE_LABEL),
/* harmony export */   MAX_LENGTH: () => (/* binding */ MAX_LENGTH),
/* harmony export */   MAX_RECORDING_DIMENSION_SIZE: () => (/* binding */ MAX_RECORDING_DIMENSION_SIZE),
/* harmony export */   NEW_PREMIUM_PRO_FEATURES: () => (/* binding */ NEW_PREMIUM_PRO_FEATURES),
/* harmony export */   PADDLE_CLIENT_SIDE_TOKEN: () => (/* binding */ PADDLE_CLIENT_SIDE_TOKEN),
/* harmony export */   PADDLE_PREMIUM_ANNUAL_PLAN_ID: () => (/* binding */ PADDLE_PREMIUM_ANNUAL_PLAN_ID),
/* harmony export */   PADDLE_PREMIUM_MONTHLY_PLAN_ID: () => (/* binding */ PADDLE_PREMIUM_MONTHLY_PLAN_ID),
/* harmony export */   PADDLE_PREMIUM_PRO_ANNUAL_PLAN_ID: () => (/* binding */ PADDLE_PREMIUM_PRO_ANNUAL_PLAN_ID),
/* harmony export */   PADDLE_PREMIUM_PRO_MONTHLY_PLAN_ID: () => (/* binding */ PADDLE_PREMIUM_PRO_MONTHLY_PLAN_ID),
/* harmony export */   PADDLE_PRODUCT_ID: () => (/* binding */ PADDLE_PRODUCT_ID),
/* harmony export */   PADDLE_SUBSCRIPTION_ANNUAL_TOKEN: () => (/* binding */ PADDLE_SUBSCRIPTION_ANNUAL_TOKEN),
/* harmony export */   PADDLE_VENDER_ID: () => (/* binding */ PADDLE_VENDER_ID),
/* harmony export */   PLAYBACK_SPEED: () => (/* binding */ PLAYBACK_SPEED),
/* harmony export */   PORT_NAME: () => (/* binding */ PORT_NAME),
/* harmony export */   PREMIUM_FEATURES: () => (/* binding */ PREMIUM_FEATURES),
/* harmony export */   PREMIUM_PRODUCT_ID: () => (/* binding */ PREMIUM_PRODUCT_ID),
/* harmony export */   PREMIUM_PRO_FEATURES: () => (/* binding */ PREMIUM_PRO_FEATURES),
/* harmony export */   RECORDING_CODEC: () => (/* binding */ RECORDING_CODEC),
/* harmony export */   REELIA_URL: () => (/* binding */ REELIA_URL),
/* harmony export */   REVIEW_URL: () => (/* binding */ REVIEW_URL),
/* harmony export */   SAVE_AS: () => (/* binding */ SAVE_AS),
/* harmony export */   SAVE_AS_SCREENSHOT: () => (/* binding */ SAVE_AS_SCREENSHOT),
/* harmony export */   SAVE_BY: () => (/* binding */ SAVE_BY),
/* harmony export */   SAVE_LOCATION: () => (/* binding */ SAVE_LOCATION),
/* harmony export */   SETTINGS: () => (/* binding */ SETTINGS),
/* harmony export */   SPECIAL_EFFECTS: () => (/* binding */ SPECIAL_EFFECTS),
/* harmony export */   STANDARD_RESOLUTIONS: () => (/* binding */ STANDARD_RESOLUTIONS),
/* harmony export */   STORE_BASE_URL: () => (/* binding */ STORE_BASE_URL),
/* harmony export */   STRIPE_ANNUAL_SUBSCRIPTION_PRICE_ID: () => (/* binding */ STRIPE_ANNUAL_SUBSCRIPTION_PRICE_ID),
/* harmony export */   STRIPE_MONTHLY_SUBSCRIPTION_PRICE_ID: () => (/* binding */ STRIPE_MONTHLY_SUBSCRIPTION_PRICE_ID),
/* harmony export */   SUBSCRIPTION_PLAN: () => (/* binding */ SUBSCRIPTION_PLAN)
/* harmony export */ });
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./types */ "./src/common/types.ts");

const isWorker = typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope;
const IS_DEV_ENVIRONMENT = Boolean(true);
const BROWSERS = {
  EDGE: 'edge',
  CHROME: 'chrome',
  FIREFOX: 'firefox'
};
const BROWSER = "chrome" || 0;
const FEATURES = {
  SUBSCRIPTION: true
};
const STRIPE_ANNUAL_SUBSCRIPTION_PRICE_ID = 'price_1R9NEvIkHRznDvz5JKPH1rtz';
const STRIPE_MONTHLY_SUBSCRIPTION_PRICE_ID = 'price_1R9NEvIkHRznDvz5C1k08uO8';
const SETTINGS = {
  SAVE_AS: 'saveAs',
  SAVE_AS_SCREENSHOT: 'saveAsScreenshot',
  DOWNLOAD_FILENAME: 'downloadFilename',
  FILE_ACCESS: 'fileAccess',
  MAX_LENGTH: 'maxLength',
  FRAMES: 'frames',
  SHOW_CURSOR: 'showCursor',
  CURSOR_COLOR: 'cursorColor',
  CURSOR_SIZE: 'cursorSize',
  SHOW_CLICK_INDICATOR: 'showClickIndicator',
  CLICK_INDICATOR_COLOR: 'clickIndicatorColor',
  CLICK_INDICATOR_SIZE: 'clickIndicatorSize',
  ENABLE_DRAWING: 'enableDrawing',
  DRAWING_COLOR: 'drawingColor',
  DRAWING_SIZE: 'drawingSize',
  SCREENSHOTS_TAKEN: 'screenshotsTaken',
  RECORDINGS_TAKEN: 'recordingsTaken',
  EDITOR: 'editor',
  REQUEST_RATING_THRESHOLD: 'requestRatingThreshold',
  DISABLE_REQUEST_RATING: 'disableRequestRating',
  RATING: 'rating',
  HAS_RATED: 'hasRated',
  HAS_SEEN_MAX_TIME_RECORDING_INFO: 'hasSeenMaxTimeRecordingInfo',
  SKIP_FULLSCREEN_INFO_MODAL: 'skipFullscreenInfoModal',
  MAX_RECORDING_DIMENSION_SIZE: 'maxRecordingDimensionSize',
  COLOR_SCHEME: 'colorScheme',
  DEFAULT_BROWSER_ACTION: 'defaultBrowserAction',
  GOOGLE_DRIVE_FOLDER_ID: 'googleDriveFolderId',
  ENABLE_NOTIFICATIONS: 'enableNotifications',
  LANGUAGE: 'language'
};
const EDITOR_SETTINGS = {
  FILL_COLOR: 'fillColor',
  FONT_FAMILY: 'fontFamily',
  FONT_WEIGHT: 'fontWeight',
  DRAW_SIZE: 'drawSize',
  PLAYBACK_SPEED: 'playbackSpeed',
  FRAME_SELECTOR_OPEN: 'frameSelectorOpen',
  PREMIUM_OPTIONS_OPEN: 'premiumOptionsOpen',
  COMPRESS_GIF: 'compressGif',
  SAVE_BY: 'saveBy',
  IS_UPLOADED_FILE_PUBLIC: 'isUploadedFilePublic'
};
var SAVE_AS_SCREENSHOT;

(function (SAVE_AS_SCREENSHOT) {
  SAVE_AS_SCREENSHOT["PNG"] = "png";
  SAVE_AS_SCREENSHOT["JPEG"] = "jpeg";
})(SAVE_AS_SCREENSHOT || (SAVE_AS_SCREENSHOT = {}));

const DOWNLOAD_FILENAME = {
  WEBSITE_NAME: 'website-name.gif',
  WEBSITE_TITLE: 'website-label.gif',
  WEBSITE_NAME_AND_DATE: 'website-name_yyyy-mm-dd.gif',
  WEBSITE_TITLE_AND_DATE: 'website-label_yyyy-mm-dd.gif',
  WEBSITE_NAME_AND_TIME: 'website-name_hh-mm-ss.gif',
  WEBSITE_TITLE_AND_TIME: 'website-label_hh-mm-ss.gif',
  DATE_AND_TIME: 'yyyy-mm-dd_hh-mm-ss.gif',
  CHROME_CAPTURE_AND_DATE: 'chrome-capture_yyyy-mm-dd.gif'
};
const FILE_ACCESS = {
  OPEN: 'open',
  DOWNLOAD: 'download',
  EDITOR: 'editor',
  COPY: 'copy'
};
const MAX_LENGTH = {
  5: 5,
  8: 8,
  10: 10,
  12: 12,
  15: 15,
  20: 20,
  30: 30,
  60: 60,
  NO_LIMIT: 'no-limit'
};
const MAX_RECORDING_DIMENSION_SIZE = {
  NO_LIMIT: 'no-limit',
  3840: 3840,
  // 4K
  1920: 1920,
  // Full HD
  1280: 1280,
  // HD
  1000: 1000,
  // Custom limit for premium users
  720: 720 // Standard HD

};
const STANDARD_RESOLUTIONS = {
  [_types__WEBPACK_IMPORTED_MODULE_0__.ResolutionName['480p']]: {
    name: _types__WEBPACK_IMPORTED_MODULE_0__.ResolutionName['480p'],
    width: 854,
    height: 480
  },
  [_types__WEBPACK_IMPORTED_MODULE_0__.ResolutionName['720p']]: {
    name: _types__WEBPACK_IMPORTED_MODULE_0__.ResolutionName['720p'],
    width: 1280,
    height: 720
  },
  [_types__WEBPACK_IMPORTED_MODULE_0__.ResolutionName['1080p']]: {
    name: _types__WEBPACK_IMPORTED_MODULE_0__.ResolutionName['1080p'],
    width: 1920,
    height: 1080
  },
  [_types__WEBPACK_IMPORTED_MODULE_0__.ResolutionName['4K']]: {
    name: _types__WEBPACK_IMPORTED_MODULE_0__.ResolutionName['4K'],
    width: 3840,
    height: 2160
  },
  [_types__WEBPACK_IMPORTED_MODULE_0__.ResolutionName['no-limit']]: {
    name: _types__WEBPACK_IMPORTED_MODULE_0__.ResolutionName['no-limit'],
    width: 6000,
    height: 6000
  }
};
const FONT_FAMILIES = {
  ARIAL: 'Arial',
  HELVETICA: 'Helvetica',
  TIMES_NEW_ROMAN: 'Times New Roman',
  COURIER_NEW: 'Courier New',
  VERDANA: 'Verdana',
  GEORGIA: 'Georgia',
  PALATINO: 'Palatino',
  GARAMOND: 'Garamond',
  COMIC_SANS_MS: 'Comic Sans MS',
  IMPACT: 'Impact',
  ROBOTO: 'Roboto'
};
const FONT_WEIGHT = {
  BOLD: 'bold',
  NORMAL: 'normal',
  400: 400,
  600: 600,
  800: 800
};
const FONT_STYLE = {
  ITALIC: 'italic',
  NORMAL: 'normal'
};
const PLAYBACK_SPEED = {
  3: 3,
  2.5: 2.5,
  2: 2,
  1.75: 1.75,
  1.5: 1.5,
  1.25: 1.25,
  NORMAL: 1,
  0.75: 0.75,
  0.5: 0.5,
  0.25: 0.25,
  0.1: 0.1
};
const SPECIAL_EFFECTS = {
  NONE: 'none',
  BOOMERRANG: 'boomerrang'
};
const GIF_DITHER_METHODS = {
  FLOYD_STEINBERG: 'FloydSteinberg',
  FALSE_FLOYD_STEINBERG: 'FalseFloydSteinberg',
  STUCKI: 'Stucki',
  ATKINSON: 'Atkinson',
  NONE: 'none'
};
const COMMANDS = {
  RECORD_TAB: 'record_tab',
  SCREENSHOT: 'screenshot',
  FULL_WEBPAGE_SCREENSHOT: 'full_webpage_screenshot',
  DESKTOP_SCREENSHOT: 'desktop_screenshot',
  OPEN_SNIPPING_TOOL: 'open_snipping_tool',
  RECORD_DESKTOP: 'record_desktop'
};
const ACTIONS = { ...COMMANDS,
  SHOW_ALERT: 'show_alert',
  COPY_TO_CLIPBOARD: 'copy_to_clipboard'
};
const PORT_NAME = {
  RECORDING: 'recording',
  FULL_WEBPAGE_SCREENSHOT: 'full_webpage_screenshot'
};
const COLOR_SCHEME = {
  LIGHT: 'light',
  DARK: 'dark'
};
const COLOR = {
  BLACK: '#212121',
  GREY: '#eeeeee',
  PURPLE: '#3f51b5',
  LIGHT_PURPLE: '#7388FF'
};
const BROWSER_ACTIONS = {
  POPUP: 'popup',
  SELECTED_AREA_CAPTURE: 'selected_area_capture'
};
var SUBSCRIPTION_PLAN;

(function (SUBSCRIPTION_PLAN) {
  SUBSCRIPTION_PLAN["PREMIUM"] = "PREMIUM";
  SUBSCRIPTION_PLAN["PREMIUM_PRO"] = "PREMIUM_PRO";
})(SUBSCRIPTION_PLAN || (SUBSCRIPTION_PLAN = {}));

var SAVE_BY;

(function (SAVE_BY) {
  SAVE_BY["DOWNLOAD"] = "download";
  SAVE_BY["GOOGLE_DRIVE"] = "googleDrive";
})(SAVE_BY || (SAVE_BY = {}));

var SAVE_LOCATION;

(function (SAVE_LOCATION) {
  SAVE_LOCATION["DOWNLOADS"] = "downloads";
  SAVE_LOCATION["DOWNLOADS_SUBFOLDER"] = "downloadsSubfolder";
  SAVE_LOCATION["MANUAL_SELECT"] = "manualSelect";
})(SAVE_LOCATION || (SAVE_LOCATION = {}));

var SAVE_AS;

(function (SAVE_AS) {
  SAVE_AS["WEBM"] = "webm";
  SAVE_AS["GIF"] = "gif";
  SAVE_AS["MP4"] = "mp4";
  SAVE_AS["AVIF"] = "avif";
  SAVE_AS["BOTH"] = "both";
})(SAVE_AS || (SAVE_AS = {}));

var LANGUAGE;

(function (LANGUAGE) {
  LANGUAGE["en"] = "en";
  LANGUAGE["ar"] = "ar";
  LANGUAGE["am"] = "am";
  LANGUAGE["bg"] = "bg";
  LANGUAGE["bn"] = "bn";
  LANGUAGE["ca"] = "ca";
  LANGUAGE["cs"] = "cs";
  LANGUAGE["da"] = "da";
  LANGUAGE["de"] = "de";
  LANGUAGE["el"] = "el";
  LANGUAGE["es"] = "es";
  LANGUAGE["et"] = "et";
  LANGUAGE["fa"] = "fa";
  LANGUAGE["fi"] = "fi";
  LANGUAGE["fr"] = "fr";
  LANGUAGE["gu"] = "gu";
  LANGUAGE["he"] = "he";
  LANGUAGE["hi"] = "hi";
  LANGUAGE["hr"] = "hr";
  LANGUAGE["hu"] = "hu";
  LANGUAGE["id"] = "id";
  LANGUAGE["it"] = "it";
  LANGUAGE["ja"] = "ja";
  LANGUAGE["kn"] = "kn";
  LANGUAGE["ko"] = "ko";
  LANGUAGE["lt"] = "lt";
  LANGUAGE["lv"] = "lv";
  LANGUAGE["ml"] = "ml";
  LANGUAGE["mr"] = "mr";
  LANGUAGE["ms"] = "ms";
  LANGUAGE["nl"] = "nl";
  LANGUAGE["no"] = "no";
  LANGUAGE["pl"] = "pl";
  LANGUAGE["ro"] = "ro";
  LANGUAGE["ru"] = "ru";
  LANGUAGE["sk"] = "sk";
  LANGUAGE["sl"] = "sl";
  LANGUAGE["sr"] = "sr";
  LANGUAGE["sv"] = "sv";
  LANGUAGE["sw"] = "sw";
  LANGUAGE["ta"] = "ta";
  LANGUAGE["te"] = "te";
  LANGUAGE["th"] = "th";
  LANGUAGE["tr"] = "tr";
  LANGUAGE["uk"] = "uk";
  LANGUAGE["vi"] = "vi";
  LANGUAGE["zh-CN"] = "zh-CN";
  LANGUAGE["zh-TW"] = "zh-TW";
  LANGUAGE["en-gb"] = "en-gb";
  LANGUAGE["pt-BR"] = "pt-BR";
  LANGUAGE["pt-PT"] = "pt-PT";
})(LANGUAGE || (LANGUAGE = {}));

var LANGUAGE_LABEL;

(function (LANGUAGE_LABEL) {
  LANGUAGE_LABEL["en"] = "English";
  LANGUAGE_LABEL["ar"] = "\u0627\u0644\u0639\u0631\u0628\u064A\u0629";
  LANGUAGE_LABEL["am"] = "\u12A0\u121B\u122D\u129B";
  LANGUAGE_LABEL["bg"] = "\u0431\u044A\u043B\u0433\u0430\u0440\u0441\u043A\u0438";
  LANGUAGE_LABEL["bn"] = "\u09AC\u09BE\u0982\u09B2\u09BE";
  LANGUAGE_LABEL["ca"] = "catal\xE0";
  LANGUAGE_LABEL["cs"] = "\u010De\u0161tina";
  LANGUAGE_LABEL["da"] = "dansk";
  LANGUAGE_LABEL["de"] = "Deutsch";
  LANGUAGE_LABEL["el"] = "\u0395\u03BB\u03BB\u03B7\u03BD\u03B9\u03BA\u03AC";
  LANGUAGE_LABEL["es"] = "espa\xF1ol";
  LANGUAGE_LABEL["et"] = "eesti";
  LANGUAGE_LABEL["fa"] = "\u0641\u0627\u0631\u0633\u06CC";
  LANGUAGE_LABEL["fi"] = "suomi";
  LANGUAGE_LABEL["fr"] = "Fran\xE7ais";
  LANGUAGE_LABEL["gu"] = "\u0A97\u0AC1\u0A9C\u0AB0\u0ABE\u0AA4\u0AC0";
  LANGUAGE_LABEL["he"] = "\u05E2\u05D1\u05E8\u05D9\u05EA";
  LANGUAGE_LABEL["hi"] = "\u0939\u093F\u0928\u094D\u0926\u0940";
  LANGUAGE_LABEL["hr"] = "hrvatski";
  LANGUAGE_LABEL["hu"] = "magyar";
  LANGUAGE_LABEL["id"] = "Bahasa Indonesia";
  LANGUAGE_LABEL["it"] = "italiano";
  LANGUAGE_LABEL["ja"] = "\u65E5\u672C\u8A9E";
  LANGUAGE_LABEL["kn"] = "\u0C95\u0CA8\u0CCD\u0CA8\u0CA1";
  LANGUAGE_LABEL["ko"] = "\uD55C\uAD6D\uC5B4";
  LANGUAGE_LABEL["lt"] = "lietuvi\u0173";
  LANGUAGE_LABEL["lv"] = "latvie\u0161u";
  LANGUAGE_LABEL["ml"] = "\u0D2E\u0D32\u0D2F\u0D3E\u0D33\u0D02";
  LANGUAGE_LABEL["mr"] = "\u092E\u0930\u093E\u0920\u0940";
  LANGUAGE_LABEL["ms"] = "Bahasa Melayu";
  LANGUAGE_LABEL["nl"] = "Nederlands";
  LANGUAGE_LABEL["no"] = "Norsk";
  LANGUAGE_LABEL["pl"] = "polski";
  LANGUAGE_LABEL["ro"] = "rom\xE2n\u0103";
  LANGUAGE_LABEL["ru"] = "\u0440\u0443\u0441\u0441\u043A\u0438\u0439";
  LANGUAGE_LABEL["sk"] = "slovensk\xFD";
  LANGUAGE_LABEL["sl"] = "sloven\u0161\u010Dina";
  LANGUAGE_LABEL["sr"] = "\u0421\u0440\u043F\u0441\u043A\u0438";
  LANGUAGE_LABEL["sv"] = "svenska";
  LANGUAGE_LABEL["sw"] = "Kiswahili";
  LANGUAGE_LABEL["ta"] = "\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD";
  LANGUAGE_LABEL["te"] = "\u0C24\u0C46\u0C32\u0C41\u0C17\u0C41";
  LANGUAGE_LABEL["th"] = "\u0E44\u0E17\u0E22";
  LANGUAGE_LABEL["tr"] = "T\xFCrk\xE7e";
  LANGUAGE_LABEL["uk"] = "\u0443\u043A\u0440\u0430\u0457\u043D\u0441\u044C\u043A\u0430";
  LANGUAGE_LABEL["vi"] = "Ti\u1EBFng Vi\u1EC7t";
  LANGUAGE_LABEL["zh-CN"] = "\u4E2D\u6587 (\u7B80\u4F53)";
  LANGUAGE_LABEL["zh-TW"] = "\u4E2D\u6587 (\u7E41\u9AD4)";
  LANGUAGE_LABEL["en-GB"] = "English (UK)";
  LANGUAGE_LABEL["pt-BR"] = "Portugu\xEAs (Brasil)";
  LANGUAGE_LABEL["pt-PT"] = "Portugu\xEAs (Portugal)";
})(LANGUAGE_LABEL || (LANGUAGE_LABEL = {}));

var CANVAS_ACTIONS;

(function (CANVAS_ACTIONS) {
  CANVAS_ACTIONS["RECTANGLE"] = "RECTANGLE";
  CANVAS_ACTIONS["ELLIPSE"] = "ELLIPSE";
  CANVAS_ACTIONS["ELLIPSE_SOLID"] = "ELLIPSE_SOLID";
  CANVAS_ACTIONS["RECTANGLE_SOLID"] = "RECTANGLE_SOLID";
  CANVAS_ACTIONS["RECTANGLE_BLUR"] = "RECTANGLE_BLUR";
  CANVAS_ACTIONS["SELECT"] = "SELECT";
  CANVAS_ACTIONS["PAN"] = "PAN";
  CANVAS_ACTIONS["DRAW"] = "DRAW";
  CANVAS_ACTIONS["TEXT"] = "TEXT";
  CANVAS_ACTIONS["ARROW"] = "ARROW";
  CANVAS_ACTIONS["LINE"] = "LINE";
  CANVAS_ACTIONS["SAVE"] = "SAVE";
  CANVAS_ACTIONS["COPY"] = "COPY";
  CANVAS_ACTIONS["RESTORE"] = "RESTORE";
  CANVAS_ACTIONS["UNDO"] = "UNDO";
  CANVAS_ACTIONS["REDO"] = "REDO";
  CANVAS_ACTIONS["SVG"] = "SVG";
  CANVAS_ACTIONS["CROP"] = "CROP";
  CANVAS_ACTIONS["ZOOM_CROP_FRAMES"] = "ZOOM_CROP_FRAMES";
  CANVAS_ACTIONS["HIGHLIGHT"] = "HIGHLIGHT";
  CANVAS_ACTIONS["NUMBERED_STEP"] = "NUMBERED_STEP";
})(CANVAS_ACTIONS || (CANVAS_ACTIONS = {}));

const DEFAULT_EDITOR_SETTINGS = {
  fillColor: COLOR.PURPLE,
  fontFamily: FONT_FAMILIES.ARIAL,
  fontWeight: 'normal',
  drawSize: 12,
  playbackSpeed: PLAYBACK_SPEED.NORMAL,
  frameSelectorOpen: true,
  premiumOptionsOpen: false,
  compressGif: true,
  isUploadedFilePublic: false,
  rectangleTool: CANVAS_ACTIONS.RECTANGLE,
  ellipseTool: CANVAS_ACTIONS.ELLIPSE,
  saveBy: SAVE_BY.DOWNLOAD
};
const DEFAULT_PREMIUM_SETTINGS = {
  showCursor: false,
  showClickIndicator: false,
  enableDrawing: false,
  frames:60,
  maxLength: 15,
  clickIndicatorColor: COLOR.PURPLE,
  drawingColor: COLOR.PURPLE,
  cursorColor: COLOR.PURPLE,
  clickIndicatorSize: 50,
  cursorSize: 12,
  drawingSize: 12,
  defaultRecordingOutputResolution: _types__WEBPACK_IMPORTED_MODULE_0__.ResolutionName['720p']
};
const DEFAULT_SETTINGS = { ...DEFAULT_PREMIUM_SETTINGS,
  saveAs: SAVE_AS.GIF,
  saveAsScreenshot: SAVE_AS_SCREENSHOT.PNG,
  downloadFilename: DOWNLOAD_FILENAME.CHROME_CAPTURE_AND_DATE,
  fileAccess: FILE_ACCESS.EDITOR,
  recorderLogic: 'default',
  recordingsTaken: 0,
  screenshotsTaken: 0,
  editor: DEFAULT_EDITOR_SETTINGS,
  requestRatingThreshold: 5,
  disableRequestRating: false,
  rating: undefined,
  hasRated: false,
  hasSeenMaxTimeRecordingInfo: false,
  skipFullscreenInfoModal: false,
  colorScheme: 'light',
  defaultBrowserAction: 'popup',
  enableNotifications: false,
  saveLocation: SAVE_LOCATION.DOWNLOADS,
  downloadsSubfolderName: 'captures/$date',
  language: LANGUAGE.en,
  openContainingFolderOnSave: false
};
const KEYS = {
  CTRL: 17,
  ESC: 27,
  ARROW_LEFT: 37,
  ARROW_UP: 38,
  ARROW_RIGHT: 39,
  ARROW_DOWN: 40,
  DELETE: 46,
  BACKSPACE: 8,
  R: 82
};
const PREMIUM_PRODUCT_ID = 'chrome_capture_premium';
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBpj3P7E9SR8c67F6irBVyrI4Gi9qf8bOc',
  authDomain: 'chrome-capture.firebaseapp.com',
  projectId: 'chrome-capture',
  storageBucket: 'chrome-capture.appspot.com',
  messagingSenderId: '810313614138',
  appId: '1:810313614138:web:76710dbc232c75b4600603',
  measurementId: 'G-02T6RVXWD2'
};
const PADDLE_PRODUCT_ID = 642846;
const PADDLE_PREMIUM_ANNUAL_PLAN_ID = 774826;
const PADDLE_PREMIUM_MONTHLY_PLAN_ID = 771458;
const PADDLE_PREMIUM_PRO_ANNUAL_PLAN_ID = 911602;
const PADDLE_PREMIUM_PRO_MONTHLY_PLAN_ID = 911603;
const PADDLE_VENDER_ID = 125444;
const PADDLE_CLIENT_SIDE_TOKEN = 'live_04b30ba843223070a9f7ba996f4';
const PADDLE_SUBSCRIPTION_ANNUAL_TOKEN = 'pri_01jahyb0jwr6azhakdrydtpc71';
const STORE_BASE_URL = BROWSER === BROWSERS.CHROME ? 'https://chromewebstore.google.com/detail/ggaabchcecdbomdcnbahdfddfikjmphe' : 'https://microsoftedge.microsoft.com/addons/detail/click-to-capture-screen/jmiocoejabdcdefolopebbhnkgnohgco';
const REVIEW_URL = `${STORE_BASE_URL}/reviews#:~:text=Rate%20this%20extension`;
const FEEDBACK_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfmXPCiHla2LAU35RTZ3zaNK77EqBBHhpyQDdK3kIt0sL-jBg/viewform?usp=header';
const REELIA_URL = BROWSER === BROWSERS.CHROME ? 'https://chrome.google.com/webstore/detail/reelia-screen-recorder-ed/ajhidbbpmnhjjffefekncbdbeopghnnn' : 'https://microsoftedge.microsoft.com/addons/detail/reelia-screen-recorder-/kahphinlmogiffapdbpdbadofkjbpapg';
var API_STATUS;

(function (API_STATUS) {
  API_STATUS["INITIAL"] = "initial";
  API_STATUS["SUCCESS"] = "success";
  API_STATUS["ERROR"] = "error";
  API_STATUS["PENDING"] = "pending";
})(API_STATUS || (API_STATUS = {}));

const CODEC = {
  VP8: {
    recorder: 'vp8',
    mux: 'vp8',
    demux: 'vp8'
  },
  VP9: {
    recorder: 'vp9',
    demux: 'vp09.03.10.10',
    mux: 'vp09.00.10.08'
  },
  AV1: {
    recorder: 'av01.0.08M.08.0.110.01.01.01.1',
    mux: 'av01.0.08M.08.0.110.01.01.01.1',
    demux: 'av01.0.08M.08.0.110.01.01.01.1'
  }
};
const RECORDING_CODEC = CODEC.VP9;
var FREE_FEATURES;

(function (FREE_FEATURES) {
  FREE_FEATURES["UPDATE_END_DURATION_LIMITED"] = "UPDATE_END_DURATION_LIMITED";
  FREE_FEATURES["ALTER_FRAMES_PER_SECOND_LIMITED"] = "ALTER_FRAMES_PER_SECOND_LIMITED";
})(FREE_FEATURES || (FREE_FEATURES = {}));

var PREMIUM_FEATURES;

(function (PREMIUM_FEATURES) {
  PREMIUM_FEATURES[PREMIUM_FEATURES["HIGHLIGHT"] = CANVAS_ACTIONS.HIGHLIGHT] = "HIGHLIGHT";
  PREMIUM_FEATURES[PREMIUM_FEATURES["CROP"] = CANVAS_ACTIONS.CROP] = "CROP";
  PREMIUM_FEATURES[PREMIUM_FEATURES["NUMBERED_STEP"] = CANVAS_ACTIONS.NUMBERED_STEP] = "NUMBERED_STEP";
  PREMIUM_FEATURES["UPDATE_EDITING_COLOR"] = "UPDATE_EDITING_COLOR";
  PREMIUM_FEATURES["UPDATE_EDITING_SIZE"] = "UPDATE_EDITING_SIZE";
  PREMIUM_FEATURES["UPDATE_EDITING_FONT"] = "UPDATE_EDITING_FONT";
  PREMIUM_FEATURES["APPLY_EDITS_TO_FRAMES"] = "APPLY_EDITS_TO_FRAMES";
  PREMIUM_FEATURES["DELETE_EVERY_SECOND_FRAME"] = "DELETE_EVERY_SECOND_FRAME";
  PREMIUM_FEATURES["ALTER_PLAYBACK_SPEED"] = "ALTER_PLAYBACK_SPEED";
  PREMIUM_FEATURES["ALTER_FRAMES_PER_SECOND"] = "ALTER_FRAMES_PER_SECOND";
  PREMIUM_FEATURES["UPDATE_END_DURATION"] = "UPDATE_END_DURATION";
  PREMIUM_FEATURES["UPDATE_DEFAULT_DIMENSION_SIZE"] = "UPDATE_DEFAULT_DIMENSION_SIZE";
  PREMIUM_FEATURES["COMPRESS_GIF"] = "COMPRESS_GIF";
})(PREMIUM_FEATURES || (PREMIUM_FEATURES = {}));

var PREMIUM_PRO_FEATURES;

(function (PREMIUM_PRO_FEATURES) {
  PREMIUM_PRO_FEATURES[PREMIUM_PRO_FEATURES["RECTANGLE_BLUR"] = CANVAS_ACTIONS.RECTANGLE_BLUR] = "RECTANGLE_BLUR";
  PREMIUM_PRO_FEATURES[PREMIUM_PRO_FEATURES["NUMBERED_STEP"] = CANVAS_ACTIONS.NUMBERED_STEP] = "NUMBERED_STEP";
  PREMIUM_PRO_FEATURES[PREMIUM_PRO_FEATURES["SVG"] = CANVAS_ACTIONS.SVG] = "SVG";
  PREMIUM_PRO_FEATURES["SPECIAL_EFFECT"] = "SPECIAL_EFFECT";
  PREMIUM_PRO_FEATURES["ALTER_FRAMES_PER_SECOND_30FPS"] = "ALTER_FRAMES_PER_SECOND_30FPS";
  PREMIUM_PRO_FEATURES["UPDATE_DEFAULT_DIMENSION_SIZE_4K"] = "UPDATE_DEFAULT_DIMENSION_SIZE_4K";
  PREMIUM_PRO_FEATURES["UPDATE_END_DURATION_NO_LIMIT"] = "UPDATE_END_DURATION_NO_LIMIT";
  PREMIUM_PRO_FEATURES["UPDATE_GIF_COMPRESSION_LOSS"] = "UPDATE_GIF_COMPRESSION_LOSS";
  PREMIUM_PRO_FEATURES["UPDATE_GIF_COMPRESSION_QUANTIZATION_ALGORITHM"] = "UPDATE_GIF_COMPRESSION_QUANTIZATION_ALGORITHM";
  PREMIUM_PRO_FEATURES["ZOOM_CROP_FRAMES"] = "ZOOM_CROP_FRAMES";
})(PREMIUM_PRO_FEATURES || (PREMIUM_PRO_FEATURES = {}));

const NEW_PREMIUM_PRO_FEATURES = [PREMIUM_PRO_FEATURES.RECTANGLE_BLUR, PREMIUM_PRO_FEATURES.UPDATE_GIF_COMPRESSION_LOSS, PREMIUM_PRO_FEATURES.UPDATE_GIF_COMPRESSION_QUANTIZATION_ALGORITHM, PREMIUM_PRO_FEATURES.NUMBERED_STEP, PREMIUM_PRO_FEATURES.ZOOM_CROP_FRAMES];
const FREE_UPDATE_END_DURATIONS = [MAX_LENGTH[10], MAX_LENGTH[12], MAX_LENGTH[15]];
const FREE_ALTER_FRAMES_PER_SECOND = [10, 12, 14];


/***/ }),

/***/ "./src/common/editing/avif.ts":
/*!************************************!*\
  !*** ./src/common/editing/avif.ts ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ArrayBufferTarget: () => (/* binding */ ArrayBufferTarget),
/* harmony export */   AvifMuxer: () => (/* binding */ AvifMuxer),
/* harmony export */   processFramesAsAvif: () => (/* binding */ processFramesAsAvif)
/* harmony export */ });
/* harmony import */ var _canvas__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../canvas */ "./src/common/canvas.ts");
/* harmony import */ var _constants__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../constants */ "./src/common/constants.ts");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../utils */ "./src/common/utils.ts");
/* harmony import */ var _util__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./util */ "./src/common/editing/util.ts");




/**
 * Animated AVIF muxer for browser / extension environments.
 *
 * Accepts AV1-encoded frames from the WebCodecs VideoEncoder API and produces
 * a MIAF-compliant animated AVIF file (avis brand, Baseline Profile MA1B).
 * The API mirrors mp4-muxer's ArrayBufferTarget pattern used in video.ts.
 *
 *   const muxer = new AvifMuxer({ width, height });
 *   encoder.output = (chunk, meta) => muxer.addVideoChunk(chunk, meta);
 *   // …encode all frames…
 *   muxer.finalize();
 *   const blob = new Blob([muxer.target.buffer], { type: 'image/avif' });
 *
 * File layout produced:
 *   ftyp  [major=avis, compat: avis avif mif1 msf1 miaf MA1B]
 *   meta  [FullBox — HEIF item metadata for the cover image]
 *     hdlr / pitm / iloc / iinf / iprp(ipco+ipma)
 *   moov  [pict-handler track with all frames]
 *     mvhd / trak(tkhd + mdia(mdhd + hdlr + minf(nmhd + dinf + stbl)))
 *   mdat  [raw AV1 sample data]
 */
// ─────────────────────────────────────────────────────────────────────────────
// Binary write utilities  (big-endian, as required by ISOBMFF)
// ─────────────────────────────────────────────────────────────────────────────

function concat(...arrays) {
  let total = 0;

  for (const a of arrays) total += a.byteLength;

  const out = new Uint8Array(total);
  let pos = 0;

  for (const a of arrays) {
    out.set(a, pos);
    pos += a.byteLength;
  }

  return out;
}

const u8 = n => new Uint8Array([n & 0xff]);

const u16 = n => new Uint8Array([n >> 8 & 0xff, n & 0xff]);

const u32 = n => new Uint8Array([n >>> 24 & 0xff, n >>> 16 & 0xff, n >>> 8 & 0xff, n & 0xff]);

const ascii = s => new Uint8Array(s.split('').map(c => c.charCodeAt(0)));

const zeros = n => new Uint8Array(n);
/** ISOBMFF box: [u32 size][4-char type][…body] */


function box(type, ...contents) {
  const body = concat(...contents);
  return concat(u32(8 + body.byteLength), ascii(type), body);
}
/** ISOBMFF FullBox: [u32 size][type][u8 version][u24 flags][…body] */


function fullBox(type, version, flags, ...contents) {
  const body = concat(...contents);
  return concat(u32(12 + body.byteLength), ascii(type), u8(version), u8(flags >>> 16 & 0xff), u8(flags >>> 8 & 0xff), u8(flags & 0xff), body);
} // ─────────────────────────────────────────────────────────────────────────────
// AV1 codec configuration record parser
// ─────────────────────────────────────────────────────────────────────────────


/**
 * Parses an AV1CodecConfigurationRecord received from WebCodecs
 * (EncodedVideoChunkMetadata.decoderConfig.description).
 *
 * Record byte layout:
 *   [0]  marker(1) | version(7) = 0x81
 *   [1]  seq_profile(3) | seq_level_idx_0(5)
 *   [2]  seq_tier_0(1) | high_bitdepth(1) | twelve_bit(1) | mono_chrome(1)
 *        | chroma_subsampling_x(1) | chroma_subsampling_y(1) | chroma_sample_position(2)
 *   [3]  initial_presentation_delay_present(1) | reserved(7)
 */
function parseAv1Config(description) {
  let bytes;

  if (description instanceof ArrayBuffer) {
    bytes = new Uint8Array(description);
  } else {
    const v = description;
    bytes = new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
  }

  if (bytes.length < 4) throw new Error('AV1CodecConfigurationRecord too short');
  const b2 = bytes[2];
  const highBitdepth = b2 >> 6 & 0x1;
  const twelveBit = b2 >> 5 & 0x1;
  const monochrome = b2 >> 4 & 0x1;
  return {
    bitDepth: highBitdepth ? twelveBit ? 12 : 10 : 8,
    numChannels: monochrome ? 1 : 3,
    configBytes: bytes
  };
} // ─────────────────────────────────────────────────────────────────────────────
// HEIF / AVIF item metadata boxes  (meta subtree)
// ─────────────────────────────────────────────────────────────────────────────

/** ftyp — 40 bytes: major_brand=avis + 6 compatible brands */


function writeFtyp() {
  return box('ftyp', ascii('avis'), // major_brand
  u32(0), // minor_version
  ascii('avis'), // ─── compatible brands ───
  ascii('avif'), ascii('mif1'), ascii('msf1'), ascii('miaf'), ascii('MA1B') // AVIF Baseline Profile
  );
}
/** hdlr — 33 bytes (shared by meta and mdia) */


function writeHdlr(handlerType) {
  return fullBox('hdlr', 0, 0, u32(0), // pre_defined
  ascii(handlerType), // handler_type (4 chars)
  zeros(12), // reserved[3]
  u8(0) // name: null-terminated empty string
  );
}
/** pitm — 14 bytes: primary_item_ID (v0 → 16-bit) */


function writePitm(itemId) {
  return fullBox('pitm', 0, 0, u16(itemId));
}
/**
 * iloc — 34 bytes: item location box (v0).
 * Stores one item / one extent at absolute file offset `baseOffset`.
 * Sizes: offset_size=4, length_size=4, base_offset_size=4.
 */


function writeIloc(itemId, baseOffset, extentLength) {
  return fullBox('iloc', 0, 0, u8(0x44), // offset_size=4 | length_size=4
  u8(0x40), // base_offset_size=4 | reserved=0
  u16(1), // item_count = 1
  u16(itemId), // item_ID
  u16(0), // data_reference_index (0 = same file)
  u32(baseOffset), // base_offset (absolute file position)
  u16(1), // extent_count = 1
  u32(0), // extent_offset (relative to base_offset)
  u32(extentLength) // extent_length
  );
}
/** infe — 21 bytes: item info entry (v2, item_type=av01) */


function writeInfe(itemId) {
  return fullBox('infe', 2, 0, u16(itemId), // item_ID
  u16(0), // item_protection_index
  ascii('av01'), // item_type
  u8(0) // item_name (null-terminated empty)
  );
}
/** iinf — 35 bytes: item information box (v0, one infe) */


function writeIinf(itemId) {
  return fullBox('iinf', 0, 0, u16(1), writeInfe(itemId));
}
/** av1C — AV1CodecConfigurationBox wrapping the raw config record */


function writeAv1C(configBytes) {
  return box('av1C', configBytes);
}
/** ispe — 20 bytes: ImageSpatialExtentsProperty */


function writeIspe(width, height) {
  return fullBox('ispe', 0, 0, u32(width), u32(height));
}
/** pixi — PixelInformationProperty (13–16 bytes depending on channel count) */


function writePixi(numChannels, bitDepth) {
  return fullBox('pixi', 0, 0, u8(numChannels), new Uint8Array(numChannels).fill(bitDepth));
}
/**
 * ipma — 22 bytes: ItemPropertyAssociation (v0, 7-bit property indices).
 * Associates one item with three properties:
 *   index 1 = av1C  (essential)
 *   index 2 = ispe
 *   index 3 = pixi
 */


function writeIpma(itemId) {
  return fullBox('ipma', 0, 0, u32(1), // entry_count
  u16(itemId), // item_ID
  u8(3), // association_count
  u8(0x80 | 1), // essential=1, property_index=1  (av1C)
  u8(0x00 | 2), // essential=0, property_index=2  (ispe)
  u8(0x00 | 3) // essential=0, property_index=3  (pixi)
  );
}
/** iprp — ItemPropertiesBox = ipco + ipma */


function writeIprp(configBytes, width, height, numChannels, bitDepth, itemId) {
  const ipco = box('ipco', writeAv1C(configBytes), // property 1
  writeIspe(width, height), // property 2
  writePixi(numChannels, bitDepth) // property 3
  );
  return box('iprp', ipco, writeIpma(itemId));
}
/**
 * meta — top-level HEIF metadata FullBox (~214 bytes for 4-byte AV1 config).
 * coverItemOffset: absolute file offset of the cover frame's AV1 data.
 * coverItemSize:   byte length of the cover frame.
 */


function writeMeta(configBytes, width, height, numChannels, bitDepth, itemId, coverItemOffset, coverItemSize) {
  return fullBox('meta', 0, 0, writeHdlr('pict'), writePitm(itemId), writeIloc(itemId, coverItemOffset, coverItemSize), writeIinf(itemId), writeIprp(configBytes, width, height, numChannels, bitDepth, itemId));
} // ─────────────────────────────────────────────────────────────────────────────
// ISOBMFF track boxes  (moov subtree)
// ─────────────────────────────────────────────────────────────────────────────

/** nmhd — 12 bytes: NullMediaHeaderBox (replaces vmhd for pict tracks) */


function writeNmhd() {
  return fullBox('nmhd', 0, 0);
}
/** dinf — 36 bytes: DataInformationBox with a self-contained url reference */


function writeDinf() {
  const url = fullBox('url ', 0, 1); // flags=1 = self-contained

  const dref = fullBox('dref', 0, 0, u32(1), url); // entry_count = 1

  return box('dinf', dref);
}
/** av01 — VisualSampleEntry (~98 bytes for 4-byte config) */


function writeAv01Entry(configBytes, width, height) {
  const body = concat(zeros(6), // reserved[6]
  u16(1), // data_reference_index
  u16(0), u16(0), // pre_defined, reserved
  zeros(12), // pre_defined[3]
  u16(width), u16(height), u32(0x00480000), // horiz_resolution = 72 dpi (16.16 fixed)
  u32(0x00480000), // vert_resolution  = 72 dpi (16.16 fixed)
  u32(0), // reserved
  u16(1), // frame_count
  zeros(32), // compressorname
  u16(0x0018), // depth = 24-bit colour
  new Uint8Array([0xff, 0xff]), // pre_defined = −1
  writeAv1C(configBytes));
  return concat(u32(8 + body.byteLength), ascii('av01'), body);
}
/** stsd — SampleDescriptionBox with one av01 entry */


function writeStsd(configBytes, width, height) {
  return fullBox('stsd', 0, 0, u32(1), writeAv01Entry(configBytes, width, height));
} // ── Sample info ───────────────────────────────────────────────────────────────


/** stts — TimeToSampleBox, run-length encoded durations */
function writeStts(samples) {
  const runs = [];

  for (const s of samples) {
    const delta = Math.max(1, s.durationMs);
    const last = runs[runs.length - 1];

    if (last && last.delta === delta) {
      last.count++;
    } else {
      runs.push({
        count: 1,
        delta
      });
    }
  }

  const body = new Uint8Array(4 + runs.length * 8);
  const dv = new DataView(body.buffer);
  dv.setUint32(0, runs.length);

  for (let i = 0; i < runs.length; i++) {
    dv.setUint32(4 + i * 8, runs[i].count);
    dv.setUint32(4 + i * 8 + 4, runs[i].delta);
  }

  return fullBox('stts', 0, 0, body);
}
/** stss — SyncSampleBox, 1-based indices of keyframes */


function writeStss(samples) {
  const keyframes = [];

  for (let i = 0; i < samples.length; i++) {
    if (samples[i].isKeyframe) keyframes.push(i + 1);
  }

  const body = new Uint8Array(4 + keyframes.length * 4);
  const dv = new DataView(body.buffer);
  dv.setUint32(0, keyframes.length);

  for (let i = 0; i < keyframes.length; i++) {
    dv.setUint32(4 + i * 4, keyframes[i]);
  }

  return fullBox('stss', 0, 0, body);
}
/** stsc — SampleToChunkBox: all N samples in one chunk */


function writeStsc(sampleCount) {
  return fullBox('stsc', 0, 0, u32(1), // entry_count
  u32(1), // first_chunk
  u32(sampleCount), // samples_per_chunk
  u32(1) // sample_description_index
  );
}
/** stsz — SampleSizeBox, variable per-sample sizes */


function writeStsz(samples) {
  const body = new Uint8Array(8 + samples.length * 4);
  const dv = new DataView(body.buffer);
  dv.setUint32(0, 0); // uniform sample_size = 0 (variable)

  dv.setUint32(4, samples.length); // sample_count

  for (let i = 0; i < samples.length; i++) {
    dv.setUint32(8 + i * 4, samples[i].size);
  }

  return fullBox('stsz', 0, 0, body);
}
/** stco — ChunkOffsetBox, single chunk at absolute file offset */


function writeStco(chunkOffset) {
  return fullBox('stco', 0, 0, u32(1), u32(chunkOffset));
}

function writeStbl(configBytes, width, height, samples, chunkOffset) {
  return box('stbl', writeStsd(configBytes, width, height), writeStts(samples), writeStss(samples), writeStsc(samples.length), writeStsz(samples), writeStco(chunkOffset));
}

function writeMinf(configBytes, width, height, samples, chunkOffset) {
  return box('minf', writeNmhd(), writeDinf(), writeStbl(configBytes, width, height, samples, chunkOffset));
}
/** mdhd — 32 bytes: MediaHeaderBox (v0, timescale=1000 ms) */


function writeMdhd(durationMs) {
  return fullBox('mdhd', 0, 0, u32(0), // creation_time
  u32(0), // modification_time
  u32(1000), // timescale = 1000
  u32(durationMs), u16(0x55c4), // language = 'und'  ((u-0x60)<<10|(n-0x60)<<5|(d-0x60))
  u16(0) // pre_defined
  );
}

function writeMdia(configBytes, width, height, samples, chunkOffset, durationMs) {
  return box('mdia', writeMdhd(durationMs), writeHdlr('pict'), writeMinf(configBytes, width, height, samples, chunkOffset));
}
/** tkhd — 92 bytes: TrackHeaderBox (v0, flags=3: enabled + in-movie) */


function writeTkhd(width, height, durationMs) {
  return fullBox('tkhd', 0, 3, u32(0), // creation_time
  u32(0), // modification_time
  u32(1), // track_id
  u32(0), // reserved
  u32(durationMs), // duration (in movie timescale = 1000)
  zeros(8), // reserved[2]
  u16(0), // layer
  u16(0), // alternate_group
  u16(0), // volume (0 for visual track)
  u16(0), // reserved
  u32(0x00010000), u32(0), u32(0), // identity matrix
  u32(0), u32(0x00010000), u32(0), u32(0), u32(0), u32(0x40000000), u32(width << 16), // width  (16.16 fixed-point)
  u32(height << 16) // height (16.16 fixed-point)
  );
}

function writeTrak(configBytes, width, height, samples, chunkOffset, durationMs) {
  return box('trak', writeTkhd(width, height, durationMs), writeMdia(configBytes, width, height, samples, chunkOffset, durationMs));
}
/** mvhd — 108 bytes: MovieHeaderBox (v0, timescale=1000 ms) */


function writeMvhd(durationMs) {
  return fullBox('mvhd', 0, 0, u32(0), // creation_time
  u32(0), // modification_time
  u32(1000), // timescale = 1000
  u32(durationMs), u32(0x00010000), // rate = 1.0
  u16(0x0100), // volume = 1.0
  zeros(10), // reserved (bit16 + uint32[2])
  u32(0x00010000), u32(0), u32(0), // identity matrix
  u32(0), u32(0x00010000), u32(0), u32(0), u32(0), u32(0x40000000), zeros(24), // pre_defined[6]
  u32(2) // next_track_ID
  );
}

function writeMoov(configBytes, width, height, samples, chunkOffset, durationMs) {
  return box('moov', writeMvhd(durationMs), writeTrak(configBytes, width, height, samples, chunkOffset, durationMs));
} // ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────


class ArrayBufferTarget {
  buffer = null;
}

/**
 * Derives an Av1Config from an AV1 WebCodecs codec string.
 * Format: av01.{profile}.{level}{tier}.{bitdepth}[…optional fields…]
 * Returns null if the string cannot be parsed.
 */
function av1ConfigFromCodecString(codec) {
  // e.g. "av01.0.04M.08" or "av01.0.04M.08.0.110.01.01.0.0"
  const match = /^av01\.([0-9]+)\.([0-9]{2})([MH])\.([0-9]{2})/.exec(codec);
  if (!match) return null;
  const profile = parseInt(match[1], 10);
  const levelIdx = parseInt(match[2], 10);
  const tier = match[3] === 'H' ? 1 : 0;
  const bitDepth = parseInt(match[4], 10);
  const highBitdepth = bitDepth >= 10 ? 1 : 0;
  const twelveBit = bitDepth >= 12 ? 1 : 0;
  const monochrome = 0; // assume color
  // Profile 1 = 4:4:4; all others default to 4:2:0

  const subsampX = profile === 1 ? 0 : 1;
  const subsampY = profile === 1 ? 0 : 1;
  const configBytes = new Uint8Array([0x81, // marker + version
  (profile & 0x7) << 5 | levelIdx & 0x1f, // seq_profile + seq_level_idx_0
  (tier & 0x1) << 7 | (highBitdepth & 0x1) << 6 | // seq_tier_0 + high_bitdepth
  (twelveBit & 0x1) << 5 | (monochrome & 0x1) << 4 | // twelve_bit + mono_chrome
  (subsampX & 0x1) << 3 | (subsampY & 0x1) << 2, // subsampling
  0x00 // initial_presentation_delay
  ]);
  return {
    bitDepth,
    numChannels: monochrome ? 1 : 3,
    configBytes
  };
}

/**
 * Collects AV1-encoded frames from WebCodecs VideoEncoder output and muxes
 * them into an animated AVIF file on finalize().
 */
class AvifMuxer {
  target = new ArrayBufferTarget();
  chunks = [];
  av1Config = null;

  constructor({
    width,
    height,
    codec
  }) {
    this.width = width;
    this.height = height;
    this.codec = codec;
  }

  addVideoChunk(chunk, meta) {
    if (!this.av1Config && meta?.decoderConfig?.description) {
      this.av1Config = parseAv1Config(meta.decoderConfig.description);
    }

    const data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);
    this.chunks.push({
      data,
      durationMs: Math.max(1, Math.round((chunk.duration ?? 0) / 1000)),
      isKeyframe: chunk.type === 'key'
    });
  }

  finalize() {
    if (!this.av1Config && this.codec) {
      this.av1Config = av1ConfigFromCodecString(this.codec);
    }

    if (!this.av1Config) {
      throw new Error('No AV1 decoder config found. ' + "Pass a codec string to AvifMuxerOptions (e.g. codec: 'av01.0.04M.08') " + 'or ensure EncodedVideoChunkMetadata is passed for the first keyframe chunk.');
    }

    if (this.chunks.length === 0) {
      throw new Error('No video chunks to mux.');
    }

    const {
      configBytes,
      numChannels,
      bitDepth
    } = this.av1Config;
    const {
      width,
      height
    } = this;
    const ITEM_ID = 1; // The AVIF cover image must be a sync (keyframe) sample.

    const firstKeyIdx = this.chunks.findIndex(c => c.isKeyframe);
    if (firstKeyIdx < 0) throw new Error('No keyframe found in encoded chunks.');
    const samples = this.chunks.map(c => ({
      size: c.data.byteLength,
      durationMs: c.durationMs,
      isKeyframe: c.isKeyframe
    }));
    const totalDurationMs = samples.reduce((sum, s) => sum + s.durationMs, 0); // ── Two-pass offset resolution ─────────────────────────────────────────
    //
    // iloc (in meta) and stco (in moov) store absolute file offsets into mdat.
    // Those offsets are:  sizeof(ftyp) + sizeof(meta) + sizeof(moov) + 8
    //
    // Replacing a u32 value never changes box size, so we can measure with
    // placeholder=0, compute the real offsets, then write the final boxes.

    const ftypBytes = writeFtyp(); // Byte position of firstKey's data within the mdat payload

    let coverOffsetInMdat = 0;

    for (let i = 0; i < firstKeyIdx; i++) coverOffsetInMdat += this.chunks[i].data.byteLength;

    const coverSize = this.chunks[firstKeyIdx].data.byteLength;
    const metaSize = writeMeta(configBytes, width, height, numChannels, bitDepth, ITEM_ID, 0, coverSize).byteLength;
    const moovSize = writeMoov(configBytes, width, height, samples, 0, totalDurationMs).byteLength; // mdat box header = 8 bytes (u32 size + 4-char type)

    const mdatDataStart = ftypBytes.byteLength + metaSize + moovSize + 8; // ── Final boxes with correct offsets ───────────────────────────────────

    const metaBytes = writeMeta(configBytes, width, height, numChannels, bitDepth, ITEM_ID, mdatDataStart + coverOffsetInMdat, // absolute file offset of cover frame
    coverSize);
    const moovBytes = writeMoov(configBytes, width, height, samples, mdatDataStart, // stco: chunk 1 starts here (all samples in one chunk)
    totalDurationMs); // ── mdat ───────────────────────────────────────────────────────────────

    const totalSampleBytes = this.chunks.reduce((s, c) => s + c.data.byteLength, 0);
    const mdatSize = 8 + totalSampleBytes;
    const mdatBytes = new Uint8Array(mdatSize);
    new DataView(mdatBytes.buffer).setUint32(0, mdatSize);
    mdatBytes[4] = 0x6d; // 'm'

    mdatBytes[5] = 0x64; // 'd'

    mdatBytes[6] = 0x61; // 'a'

    mdatBytes[7] = 0x74; // 't'

    let mdatPos = 8;

    for (const c of this.chunks) {
      mdatBytes.set(c.data, mdatPos);
      mdatPos += c.data.byteLength;
    }

    this.target.buffer = concat(ftypBytes, metaBytes, moovBytes, mdatBytes).buffer;
  }

} // ─────────────────────────────────────────────────────────────────────────────
// Frame encoder
// ─────────────────────────────────────────────────────────────────────────────

async function processFramesAsAvif(frames, fabricCanvas, imageCropPosition, framesPerSecond, playbackSpeed, width, height, progressUpdater, signal) {
  return new Promise(async (resolve, reject) => {
    try {
      const muxer = new AvifMuxer({
        width,
        height,
        codec: _constants__WEBPACK_IMPORTED_MODULE_0__.CODEC.AV1.mux
      });
      const videoEncoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: e => console.error(e)
      });
      videoEncoder.configure({
        codec: _constants__WEBPACK_IMPORTED_MODULE_0__.CODEC.AV1.mux,
        width,
        height,
        bitrate: (0,_util__WEBPACK_IMPORTED_MODULE_1__.getIdealVideoBitsPerSecond)(width, height, framesPerSecond)
      });
      let lastKeyFrame = 0;
      let proceededFrames = 0;
      let currentTime = 0;

      for (const frame of frames) {
        if (signal?.aborted) break;
        const canvas = await (0,_canvas__WEBPACK_IMPORTED_MODULE_2__.processFrameEditsToCanvas)(frame, fabricCanvas, width, height, imageCropPosition);
        const videoFrame = new VideoFrame(canvas, {
          timestamp: currentTime * 1000
        });
        const needsKeyFrame = currentTime - lastKeyFrame >= 5000;
        if (needsKeyFrame) lastKeyFrame = currentTime;
        currentTime += (0,_utils__WEBPACK_IMPORTED_MODULE_3__.getAlteredDelay)(framesPerSecond, playbackSpeed, frame.duration || 0);
        videoEncoder.encode(videoFrame, {
          keyFrame: needsKeyFrame
        });
        videoFrame.close();
        progressUpdater?.update(proceededFrames++ / frames.length * 0.9);
      }

      if (!signal?.aborted) {
        await videoEncoder.flush();
        videoEncoder.close();
        muxer.finalize();
        const {
          buffer
        } = muxer.target;
        if (!buffer) throw new Error('AvifMuxer produced no output');
        progressUpdater?.complete();
        resolve(new Blob([buffer], {
          type: 'image/avif'
        }));
      } else {
        videoEncoder.close();
        reject(signal.reason);
      }
    } catch (error) {
      reject(error);
    }
  });
}

/***/ }),

/***/ "./src/common/editing/util.ts":
/*!************************************!*\
  !*** ./src/common/editing/util.ts ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getIdealVideoBitsPerSecond: () => (/* binding */ getIdealVideoBitsPerSecond)
/* harmony export */ });
/**
 * Calculates an estimated ideal videoBitsPerSecond for MediaRecorder.
 *
 * @param width The width of the video frame in pixels.
 * @param height The height of the video frame in pixels.
 * @param fps The frames per second (defaults to 30, as per the request).
 * @param quality The desired quality preset.
 * @returns The estimated videoBitsPerSecond.
 *
 * Note: These are heuristic values. The "ideal" bitrate can vary based on
 * content complexity and the specific codec used by MediaRecorder (e.g., VP8, VP9, H.264).
 * Browsers might also clamp or ignore very high/low values. Always test.
 */
function getIdealVideoBitsPerSecond(width, height, fps = 30, quality = 'very-high') {
  if (width <= 0 || height <= 0 || fps <= 0) {
    console.warn('getIdealVideoBitsPerSecond: width, height, and fps must be positive.');
    return 8000000; // Return a default medium bitrate if inputs are invalid
  }

  const pixelsPerFrame = width * height;
  let bitsPerPixelFactor;

  switch (quality) {
    case 'low':
      bitsPerPixelFactor = 0.03; // Lower quality, smaller file size

      break;

    case 'medium':
      bitsPerPixelFactor = 0.07; // Good balance

      break;

    case 'high':
      bitsPerPixelFactor = 0.1; // Higher quality, larger file size

      break;

    case 'very-high':
      bitsPerPixelFactor = 0.15; // Excellent quality (e.g., for sharp text in screen recordings)

      break;

    default:
      // Should not happen with TypeScript, but as a fallback
      bitsPerPixelFactor = 0.07;
  }

  const calculatedBitrate = pixelsPerFrame * fps * bitsPerPixelFactor; // Apply some reasonable minimum and maximum caps
  // These caps prevent absurdly low or high bitrates for extreme resolutions.

  const minBitrate = 6_000_000;
  const maxBitrate = 25_000_000; // 25 Mbps (browsers might cap even lower)

  return Math.max(minBitrate, Math.min(Math.round(calculatedBitrate), maxBitrate));
}

/***/ }),

/***/ "./src/common/imageProcessing.ts":
/*!***************************************!*\
  !*** ./src/common/imageProcessing.ts ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   blobToImageBitmap: () => (/* binding */ blobToImageBitmap),
/* harmony export */   canvasToDataUrl: () => (/* binding */ canvasToDataUrl),
/* harmony export */   convertBlobToDataUrl: () => (/* binding */ convertBlobToDataUrl),
/* harmony export */   cropCanvas: () => (/* binding */ cropCanvas),
/* harmony export */   cropImage: () => (/* binding */ cropImage),
/* harmony export */   cropVideo: () => (/* binding */ cropVideo),
/* harmony export */   dataUrlToCanvas: () => (/* binding */ dataUrlToCanvas),
/* harmony export */   dataUrlToImage: () => (/* binding */ dataUrlToImage),
/* harmony export */   dataUrlToImageWorker: () => (/* binding */ dataUrlToImageWorker),
/* harmony export */   getCanvasBlob: () => (/* binding */ getCanvasBlob),
/* harmony export */   getDataUrlDimensions: () => (/* binding */ getDataUrlDimensions),
/* harmony export */   getRestrictedWidthAndHeight: () => (/* binding */ getRestrictedWidthAndHeight),
/* harmony export */   imageToCanvas: () => (/* binding */ imageToCanvas),
/* harmony export */   stitchImages: () => (/* binding */ stitchImages),
/* harmony export */   videoToCanvas: () => (/* binding */ videoToCanvas)
/* harmony export */ });
/* harmony import */ var common_SettingsManager__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! common/SettingsManager */ "./src/common/SettingsManager.ts");
/* harmony import */ var _constants__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./constants */ "./src/common/constants.ts");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./types */ "./src/common/types.ts");



const isWorker = typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope;
const settingsManager = !isWorker ? chrome.storage && new common_SettingsManager__WEBPACK_IMPORTED_MODULE_0__["default"]() : null;

function cropImage(image, position, devicePixelRatio = 1, bypassRestrictions = true, outputWidth, outputHeight) {
  const z = Math.round((devicePixelRatio + Number.EPSILON) * 1000) / 1000;
  const x = Math.round(position.x * z);
  const y = Math.round(position.y * z);
  let width = Math.floor((position.x2 - position.x) * z);
  let height = Math.floor((position.y2 - position.y) * z);
  const {
    restrictedWidth,
    restrictedHeight
  } = getRestrictedWidthAndHeight(outputWidth || width, outputHeight || height, bypassRestrictions);
  const canvas = isWorker ? new OffscreenCanvas(restrictedWidth, restrictedHeight) : document.createElement('canvas');
  canvas.width = restrictedWidth;
  canvas.height = restrictedHeight;
  canvas.getContext('2d').drawImage(image, x, y, width, height, 0, 0, restrictedWidth, restrictedHeight);
  return canvas;
}

function cropVideo(video, position, windowWidth, windowHeight, bypassRestrictions = false) {
  const videoWidth = video.videoWidth;
  const videoHeight = video.videoHeight;
  const widthRatio = videoWidth / windowWidth;
  const heightRatio = videoHeight / windowHeight;
  const bestRatio = Math.min(widthRatio, heightRatio);
  windowWidth = Math.round(windowWidth * bestRatio);
  windowHeight = Math.round(windowHeight * bestRatio);
  const letterBoxWidth = Math.floor((videoWidth - windowWidth) / 2);
  const letterBoxHeight = Math.floor((videoHeight - windowHeight) / 2);
  position.x2 = Math.floor(position.x2 * bestRatio + letterBoxWidth);
  position.x = Math.ceil(position.x * bestRatio + letterBoxWidth);
  position.y = Math.ceil(position.y * bestRatio + letterBoxHeight);
  position.y2 = Math.floor(position.y2 * bestRatio + letterBoxHeight);
  const width = Math.floor(position.x2 - position.x) - 1;
  const height = Math.floor(position.y2 - position.y) - 1;
  const {
    restrictedWidth,
    restrictedHeight
  } = getRestrictedWidthAndHeight(width, height, bypassRestrictions); // const canvas = new OffscreenCanvas(restrictedWidth, restrictedHeight);

  const canvas = document.createElement('canvas');
  canvas.width = restrictedWidth;
  canvas.height = restrictedHeight;
  canvas.getContext('2d').drawImage(video, position.x, position.y, width, height, 0, 0, restrictedWidth, restrictedHeight);
  return canvas;
}

function videoToCanvas(video, width, height, bypassRestrictions = false) {
  const videoWidth = video.videoWidth;
  const videoHeight = video.videoHeight;
  const widthRatio = videoWidth / width;
  const heightRatio = videoHeight / height;
  const bestRatio = Math.min(widthRatio, heightRatio);
  width = Math.round(width * bestRatio);
  height = Math.round(height * bestRatio);
  const letterBoxWidth = Math.round((videoWidth - width) / 2);
  const letterBoxHeight = Math.round((videoHeight - height) / 2);
  const {
    restrictedWidth,
    restrictedHeight
  } = getRestrictedWidthAndHeight(width || video.videoWidth, height || video.videoHeight, bypassRestrictions);
  const canvas = document.createElement('canvas');
  canvas.width = restrictedWidth;
  canvas.height = restrictedHeight;
  canvas.getContext('2d').drawImage(video, letterBoxWidth, letterBoxHeight, width, height, 0, 0, restrictedWidth, restrictedHeight);
  return canvas;
}

function imageToCanvas(image, bypassRestrictions = true) {
  const {
    restrictedWidth,
    restrictedHeight
  } = getRestrictedWidthAndHeight(image.width, image.height, bypassRestrictions);
  const canvas = document.createElement('canvas');
  canvas.width = restrictedWidth;
  canvas.height = restrictedHeight;
  canvas.getContext('2d').drawImage(image, 0, 0, image.width, image.height, 0, 0, restrictedWidth, restrictedHeight);
  return canvas;
}

async function dataUrlToImage(dataUrl) {
  const imageBlob = await fetch(dataUrl).then(r => r.blob());
  return await createImageBitmap(imageBlob);
}

async function dataUrlToImageWorker(dataUrl) {
  const imgblob = await fetch(dataUrl).then(r => r.blob());
  return await createImageBitmap(imgblob);
}

function getDataUrlDimensions(dataUrl) {
  return new Promise(function (resolved) {
    var image = new Image();

    image.onload = function () {
      const {
        width,
        height
      } = image;
      resolved({
        width,
        height
      });
    };

    image.src = dataUrl;
  });
}

async function convertBlobToDataUrl(blob) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);

    reader.onloadend = () => {
      const base64data = reader.result;
      resolve(base64data);
    };
  });
}

function dataUrlToCanvas(dataUrl, position, z = 1, bypassRestrictions = true) {
  return new Promise((resolve, reject) => {
    dataUrlToImage(dataUrl).then(image => resolve(position ? cropImage(image, position, z, bypassRestrictions) : imageToCanvas(image, bypassRestrictions)));
  });
}

async function blobToImageBitmap(blob, position) {
  const bitmap = await (position ? createImageBitmap(blob, position.x, position.y, position.width, position.height) : createImageBitmap(blob));
  return bitmap;
}

function getCanvasBlob(canvas) {
  return new Promise(function (resolve, reject) {
    canvas.toBlob(function (blob) {
      resolve(blob);
    });
  });
}

function getRestrictedWidthAndHeight(width, height, bypassRestrictions = false) {
  let restrictedWidth = width;
  let restrictedHeight = height;

  if (bypassRestrictions) {
    return {
      restrictedWidth,
      restrictedHeight
    };
  }

  const {
    defaultRecordingOutputResolution = _types__WEBPACK_IMPORTED_MODULE_1__.ResolutionName['720p']
  } = settingsManager.settings;
  const targetResolution = _constants__WEBPACK_IMPORTED_MODULE_2__.STANDARD_RESOLUTIONS[defaultRecordingOutputResolution];

  if (defaultRecordingOutputResolution !== _constants__WEBPACK_IMPORTED_MODULE_2__.MAX_RECORDING_DIMENSION_SIZE.NO_LIMIT && (width > targetResolution.width || height > targetResolution.height)) {
    const widthRatio = targetResolution.width / width;
    const heightRatio = targetResolution.height / height;
    const scale = Math.min(widthRatio, heightRatio);
    restrictedWidth = Math.floor(width * scale);
    restrictedHeight = Math.floor(height * scale);
  }

  return {
    restrictedWidth,
    restrictedHeight
  };
}

function stitchImages(images) {
  const width = images[0].width;
  const height = images.reduce((a, b) => a + b.height, 0);
  const canvas = new OffscreenCanvas(width, height);
  images.forEach((image, index) => {
    canvas.getContext('2d').drawImage(image, 0, images[0].height * index);
  });
  return canvas;
}

async function canvasToDataUrl(canvas) {
  if (typeof canvas.convertToBlob === 'function') {
    const blob = await canvas.convertToBlob();
    return await convertBlobToDataUrl(blob);
  } else {
    return canvas.toDataURL('image/jpeg');
  }
}

const cropCanvas = (sourceCanvas, left, top, width, height) => {
  const destCanvas = new OffscreenCanvas(width, height);
  destCanvas.getContext('2d').drawImage(sourceCanvas, left, top, width, height, // source rect with content to crop
  0, 0, width, height);
  return destCanvas;
};



/***/ }),

/***/ "./src/common/storage.ts":
/*!*******************************!*\
  !*** ./src/common/storage.ts ***!
  \*******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getCheckoutDetails: () => (/* binding */ getCheckoutDetails),
/* harmony export */   getPurchased: () => (/* binding */ getPurchased),
/* harmony export */   getPurchasedAsync: () => (/* binding */ getPurchasedAsync),
/* harmony export */   getSettings: () => (/* binding */ getSettings),
/* harmony export */   getSettingsAsync: () => (/* binding */ getSettingsAsync),
/* harmony export */   getSubscriptionInfo: () => (/* binding */ getSubscriptionInfo),
/* harmony export */   getUser: () => (/* binding */ getUser),
/* harmony export */   setCheckoutDetails: () => (/* binding */ setCheckoutDetails),
/* harmony export */   setPurchased: () => (/* binding */ setPurchased),
/* harmony export */   setSetting: () => (/* binding */ setSetting),
/* harmony export */   setSettingAsync: () => (/* binding */ setSettingAsync),
/* harmony export */   setSettings: () => (/* binding */ setSettings),
/* harmony export */   setSubscriptionInfo: () => (/* binding */ setSubscriptionInfo),
/* harmony export */   setUser: () => (/* binding */ setUser)
/* harmony export */ });
/* harmony import */ var lodash_set__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! lodash/set */ "./node_modules/lodash/set.js");
/* harmony import */ var lodash_set__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(lodash_set__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lodash/cloneDeep */ "./node_modules/lodash/cloneDeep.js");
/* harmony import */ var lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _constants__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./constants */ "./src/common/constants.ts");




function setSettings(settings) {
  if (chrome?.storage?.sync) {
    chrome.storage.sync.set({
      settings
    });
  } else if (chrome?.runtime?.sendMessage) {
    chrome.runtime.sendMessage({
      setSettings: true,
      settings
    });
  } else {
    navigator.serviceWorker.controller.postMessage({
      setSettings: true,
      settings
    });
  }
}

function setSetting(path, value) {
  getSettings(({
    settings = _constants__WEBPACK_IMPORTED_MODULE_2__.DEFAULT_SETTINGS
  }) => {
    chrome.storage.sync.set({
      settings: lodash_set__WEBPACK_IMPORTED_MODULE_0___default()(lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_1___default()(settings), path, value)
    });
  });
}

function getSettings(callback) {
  return chrome.storage.sync.get('settings', callback);
}

async function setSettingAsync(path, value) {
  const settings = (await getSettingsAsync()) || _constants__WEBPACK_IMPORTED_MODULE_2__.DEFAULT_SETTINGS;
  return new Promise(resolve => {
    chrome.storage.sync.set({
      settings: lodash_set__WEBPACK_IMPORTED_MODULE_0___default()(lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_1___default()(settings), path, value)
    }, resolve);
  });
}

async function getSettingsAsync() {
  return new Promise(resolve => {
    chrome.storage.sync.get('settings', ({
      settings
    }) => resolve(settings || _constants__WEBPACK_IMPORTED_MODULE_2__.DEFAULT_SETTINGS));
  });
}

async function getPurchased(callback) {
  const purchased = await getPurchasedAsync();
  callback(purchased);
}

async function getPurchasedAsync() {
  return new Promise(resolve => {
    chrome.storage.local.get('purchased', ({
      purchased = false
    }) => {
      resolve(purchased);
    });
  });
}

async function getSubscriptionInfo() {
  return new Promise(resolve => {
    chrome.storage.local.get('subscriptionInfo', ({
      subscriptionInfo
    }) => {
      resolve(subscriptionInfo);
    });
  });
}

function setSubscriptionInfo(subscriptionInfo) {
  chrome.storage.local.set({
    subscriptionInfo
  });
}

function setPurchased(purchased) {
  chrome.storage.local.set({
    purchased
  });
}

function setUser(user) {
  chrome.storage.sync.set({
    user
  });
}

async function getUser() {
  return new Promise(resolve => {
    chrome.storage.sync.get('user', ({
      user
    }) => resolve(user));
  });
}

function setCheckoutDetails(checkoutDetails) {
  chrome.storage.sync.set({
    checkoutDetails
  });
}

async function getCheckoutDetails() {
  return new Promise(resolve => {
    chrome.storage.sync.get('checkoutDetails', ({
      checkoutDetails
    }) => resolve(checkoutDetails));
  });
}



/***/ }),

/***/ "./src/common/types.ts":
/*!*****************************!*\
  !*** ./src/common/types.ts ***!
  \*****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ResolutionName: () => (/* binding */ ResolutionName)
/* harmony export */ });
let ResolutionName;

(function (ResolutionName) {
  ResolutionName["480p"] = "480p";
  ResolutionName["720p"] = "720p";
  ResolutionName["1080p"] = "1080p";
  ResolutionName["4K"] = "4K";
  ResolutionName["no-limit"] = "no-limit";
})(ResolutionName || (ResolutionName = {}));

/***/ }),

/***/ "./src/common/utils.ts":
/*!*****************************!*\
  !*** ./src/common/utils.ts ***!
  \*****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   MIN_GIF_DELAY_MS: () => (/* binding */ MIN_GIF_DELAY_MS),
/* harmony export */   bubbleAllIframeMouseMove: () => (/* binding */ bubbleAllIframeMouseMove),
/* harmony export */   copyBlobToClipboard: () => (/* binding */ copyBlobToClipboard),
/* harmony export */   copyCanvasToClipboard: () => (/* binding */ copyCanvasToClipboard),
/* harmony export */   filterFramesForGif: () => (/* binding */ filterFramesForGif),
/* harmony export */   formatCurrency: () => (/* binding */ formatCurrency),
/* harmony export */   getActiveTab: () => (/* binding */ getActiveTab),
/* harmony export */   getAlteredDelay: () => (/* binding */ getAlteredDelay),
/* harmony export */   getAlteredFrameDuration: () => (/* binding */ getAlteredFrameDuration),
/* harmony export */   getAlteredFramesPerSecond: () => (/* binding */ getAlteredFramesPerSecond),
/* harmony export */   getCanvasBlob: () => (/* binding */ getCanvasBlob),
/* harmony export */   getFileSaveHandle: () => (/* binding */ getFileSaveHandle),
/* harmony export */   getFilename: () => (/* binding */ getFilename),
/* harmony export */   getFolderPath: () => (/* binding */ getFolderPath),
/* harmony export */   getPlaybackSpeed: () => (/* binding */ getPlaybackSpeed),
/* harmony export */   getRandomInt: () => (/* binding */ getRandomInt),
/* harmony export */   getSubscriptionPlan: () => (/* binding */ getSubscriptionPlan),
/* harmony export */   hasPermission: () => (/* binding */ hasPermission),
/* harmony export */   isMobileDevice: () => (/* binding */ isMobileDevice),
/* harmony export */   isPlanIdPremiumPro: () => (/* binding */ isPlanIdPremiumPro),
/* harmony export */   isSaveTypeVideo: () => (/* binding */ isSaveTypeVideo),
/* harmony export */   mapFrameFromBlob: () => (/* binding */ mapFrameFromBlob),
/* harmony export */   mapFrameFromCanvas: () => (/* binding */ mapFrameFromCanvas),
/* harmony export */   mapFrameFromCanvas2: () => (/* binding */ mapFrameFromDataUrl),
/* harmony export */   mapFrameFromOffscreenCanvas: () => (/* binding */ mapFrameFromOffscreenCanvas),
/* harmony export */   mapLoadingFrame: () => (/* binding */ mapLoadingFrame),
/* harmony export */   openSettingsPage: () => (/* binding */ openSettingsPage),
/* harmony export */   requestPermission: () => (/* binding */ requestPermission),
/* harmony export */   resizeCanvas: () => (/* binding */ resizeCanvas),
/* harmony export */   setClarityDefaults: () => (/* binding */ setClarityDefaults),
/* harmony export */   setClarityValues: () => (/* binding */ setClarityValues),
/* harmony export */   videoFrameToCanvas: () => (/* binding */ videoFrameToCanvas)
/* harmony export */ });
/* harmony import */ var lodash_uniqueId__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! lodash/uniqueId */ "./node_modules/lodash/uniqueId.js");
/* harmony import */ var lodash_uniqueId__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(lodash_uniqueId__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var common_constants__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! common/constants */ "./src/common/constants.ts");
/* harmony import */ var common_imageProcessing__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! common/imageProcessing */ "./src/common/imageProcessing.ts");




function getFileSaveHandle(name, extension = '') {
  const options = {
    suggestedName: `${name}${extension}`,
    types: [{
      description: 'Capture Files',
      accept: {
        'image/gif': ['.gif'],
        'image/jpeg': ['.jpeg', '.jpg'],
        'image/png': ['.png'],
        'video/webm': ['.webm']
      }
    }]
  };
  return window.showSaveFilePicker?.(options);
}

function getFolderPath(folderPath) {
  return folderPath.replace('$date', getDateString());
}

function getCanvasBlob(canvas) {
  return new Promise(function (resolve, reject) {
    canvas.toBlob(function (blob) {
      resolve(blob);
    });
  });
}

async function copyBlobToClipboard(blob) {
  try {
    await navigator.clipboard.write([new window.ClipboardItem({
      [blob.type]: blob
    })]);
    return true;
  } catch (err) {
    console.error(err.name, err.message);
    return false;
  }
}

async function copyCanvasToClipboard(canvas) {
  const blob = await getCanvasBlob(canvas);
  return await copyBlobToClipboard(blob);
}

function openImage(image) {
  const newTab = window.open('');
  newTab.document.write(image.outerHTML);
}

function getDateString() {
  const today = new Date(); // Pad month and day with a leading zero if they are single digit

  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate().toString().padStart(2, '0');
  const date = `${today.getFullYear()}-${month}-${day}`;
  return date;
}

function getTimeString() {
  const today = new Date(); // Pad hours, minutes, and seconds with a leading zero if they are single digit

  const hours = today.getHours().toString().padStart(2, '0');
  const minutes = today.getMinutes().toString().padStart(2, '0');
  const seconds = today.getSeconds().toString().padStart(2, '0');
  const time = `${hours}-${minutes}-${seconds}`;
  return time;
}

async function getFilename(downloadFilename, isDesktop = false) {
  const sanitizeFilename = name => {
    const separatorRegex = /[\s–—―\•\/\?<>\\:\*\|":-]+/g;
    const trimHyphensRegex = /[-]+/g;
    const sanitized = name.replace(separatorRegex, '-').replace(trimHyphensRegex, '-');
    return sanitized;
  };

  const date = getDateString();
  const time = getTimeString();

  try {
    switch (downloadFilename) {
      case common_constants__WEBPACK_IMPORTED_MODULE_1__.DOWNLOAD_FILENAME.DATE_AND_TIME:
        return `${date}_${time}`;

      case common_constants__WEBPACK_IMPORTED_MODULE_1__.DOWNLOAD_FILENAME.CHROME_CAPTURE_AND_DATE:
        return `chrome-capture-${date}`;
    }

    const getWebsiteDetails = async () => {
      if (isDesktop) {
        return {
          name: 'desktop-capture',
          title: 'desktop-capture'
        };
      }

      const activeTab = await getActiveTabWithPermissions();

      if (activeTab) {
        const url = new URL(activeTab.url);
        let hostname = url.hostname;

        if (hostname.startsWith('www.')) {
          hostname = hostname.substring(4);
        }

        const name = hostname.substring(0, hostname.lastIndexOf('.')).replace(/\./g, '-');
        const title = activeTab.title;
        return {
          name: sanitizeFilename(name),
          title: sanitizeFilename(title)
        };
      } else {
        return {
          name: 'website-capture',
          title: 'website-capture'
        };
      }
    };

    const {
      name,
      title
    } = await getWebsiteDetails();
    const MAX_LENGTH = 80;

    switch (downloadFilename) {
      case common_constants__WEBPACK_IMPORTED_MODULE_1__.DOWNLOAD_FILENAME.WEBSITE_NAME:
        return name.substring(0, MAX_LENGTH) || 'chrome-capture';

      case common_constants__WEBPACK_IMPORTED_MODULE_1__.DOWNLOAD_FILENAME.WEBSITE_TITLE:
        return title.substring(0, MAX_LENGTH) || 'chrome-capture';

      case common_constants__WEBPACK_IMPORTED_MODULE_1__.DOWNLOAD_FILENAME.WEBSITE_NAME_AND_DATE:
        return `${name.substring(0, MAX_LENGTH)}_${date}`;

      case common_constants__WEBPACK_IMPORTED_MODULE_1__.DOWNLOAD_FILENAME.WEBSITE_TITLE_AND_DATE:
        return `${title.substring(0, MAX_LENGTH)}_${date}`;

      case common_constants__WEBPACK_IMPORTED_MODULE_1__.DOWNLOAD_FILENAME.WEBSITE_NAME_AND_TIME:
        return `${name.substring(0, MAX_LENGTH)}_${time}`;

      case common_constants__WEBPACK_IMPORTED_MODULE_1__.DOWNLOAD_FILENAME.WEBSITE_TITLE_AND_TIME:
        return `${title.substring(0, MAX_LENGTH)}_${time}`;

      default:
        return `chrome-capture-${date}`;
    }
  } catch (e) {
    console.log(e);
    return `chrome-capture-${date}`;
  }
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true
  });
  return tabs[0];
}

async function getActiveTabWithPermissions(shouldRequestPermission = false) {
  const hasTabPermission = (await hasPermission('tabs')) || (shouldRequestPermission ? await requestPermission('tabs') : false);

  if (!hasTabPermission) {
    return;
  }

  return await getActiveTab();
}

async function hasPermission(permission) {
  return new Promise((resolve, reject) => {
    chrome.permissions.contains({
      permissions: [permission]
    }, result => resolve(!!result));
  });
}

async function requestPermission(permission) {
  return new Promise((resolve, reject) => {
    chrome.permissions.request({
      permissions: [permission]
    }, result => resolve(!!result));
  });
}

function bubbleAllIframeMouseMove() {
  function bubbleIframeMouseMove(iframe) {
    try {
      const existingOnMouseMove = iframe.contentWindow.onmousemove;

      iframe.contentWindow.onmousemove = function (e) {
        if (existingOnMouseMove) existingOnMouseMove(e);
        const evt = document.createEvent('MouseEvents');
        const boundingClientRect = iframe.getBoundingClientRect();
        evt.initMouseEvent('mousemove', true, // bubbles
        false, // not cancelable
        window, e.detail, e.screenX, e.screenY, e.clientX + boundingClientRect.left, e.clientY + boundingClientRect.top, e.ctrlKey, e.altKey, e.shiftKey, e.metaKey, e.button, null // no related element
        );
        iframe.dispatchEvent(evt);
      };
    } catch (error) {
      return;
    }
  }

  const elements = Array.from(document.getElementsByTagName('iframe')).concat(Array.from(document.getElementsByTagName('embed')));

  for (var i = 0; i < elements.length; i++) {
    bubbleIframeMouseMove(elements[i]);
  }
}

function isMobileDevice() {
  const toMatch = [/Android/i, /webOS/i, /iPhone/i, /iPad/i, /iPod/i, /BlackBerry/i, /Windows Phone/i];
  return toMatch.some(toMatchItem => {
    return navigator.userAgent.match(toMatchItem);
  });
}

function getRandomInt(max) {
  return Math.floor(Math.random() * Math.floor(max));
}

function openSettingsPage() {
  window.chrome.runtime.sendMessage({
    openOptions: true
  });
}

const mapFrameFromCanvas = (canvas, index = 0, duration) => ({
  index,
  duration,
  id: lodash_uniqueId__WEBPACK_IMPORTED_MODULE_0___default()(),
  data: canvas.toDataURL('image/jpeg'),
  width: canvas.width,
  height: canvas.height
});

const mapFrameFromBlob = (blob, index = 0, width, height, duration) => ({
  index,
  blob,
  width,
  height,
  duration,
  id: lodash_uniqueId__WEBPACK_IMPORTED_MODULE_0___default()(),
  data: URL.createObjectURL(blob)
});

const mapLoadingFrame = (index = 0, width, height, duration) => ({
  index,
  width,
  height,
  duration,
  timestamp: index * duration,
  id: lodash_uniqueId__WEBPACK_IMPORTED_MODULE_0___default()(),
  isPlaceholder: true
});

const mapFrameFromOffscreenCanvas = async (canvas, index = 0, duration) => ({
  index,
  duration,
  id: lodash_uniqueId__WEBPACK_IMPORTED_MODULE_0___default()(),
  data: URL.createObjectURL(await canvas.convertToBlob()),
  width: canvas.width,
  height: canvas.height
});

const mapFrameFromDataUrl = async (dataUrl, index = 0, duration) => {
  const {
    width,
    height
  } = await (0,common_imageProcessing__WEBPACK_IMPORTED_MODULE_2__.getDataUrlDimensions)(dataUrl);
  return {
    index,
    duration,
    id: lodash_uniqueId__WEBPACK_IMPORTED_MODULE_0___default()(),
    data: dataUrl,
    width,
    height
  };
};

const resizeCanvas = async (canvasToResize, width, height) => {
  const canvas = document.createElement('canvas');
  const newWidth = width;
  const newHeight = height;
  canvas.width = newWidth;
  canvas.height = newHeight;
  canvas.getContext('2d').drawImage(canvasToResize, 0, 0, newWidth, newHeight);
  return canvas;
};

const getAlteredFramesPerSecond = (framesPerSecond, playbackSpeed) => framesPerSecond * getPlaybackSpeed(playbackSpeed);

const getAlteredFramesPerSecondGIF = (framesPerSecond, playbackSpeed) => Math.min(getAlteredFramesPerSecond(framesPerSecond, playbackSpeed), 50 // 50 is the max FPS for GIFs in Chrome
);

const getAlteredDelay = (framesPerSecond, playbackSpeed, duration) => duration ? getAlteredFrameDuration(duration, playbackSpeed) : 1000 / getAlteredFramesPerSecond(framesPerSecond, playbackSpeed); // limit to 20ms for gif creation instead of here


const getAlteredFrameDuration = (duration, playbackSpeed) => duration / getPlaybackSpeed(playbackSpeed);

const setClarityDefaults = () => {
  setClarityValues({
    version: chrome?.runtime?.getManifest?.()?.version
  });
};

const setClarityValues = values => {
  if (!window.clarity) {
    return;
  }

  Object.entries(values).forEach(([key, value]) => {
    window.clarity('set', key, String(value));
  });
};

const formatCurrency = (price, currency) => {
  if (!price || !currency) {
    return '';
  }

  const formatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency // These options are needed to round to whole numbers if that's what you want.
    //minimumFractionDigits: 0, // (this suffices for whole numbers, but will print 2500.10 as $2,500.1)
    //maximumFractionDigits: 0, // (causes 2500.99 to be printed as $2,501)

  });
  return formatter.format(price);
};

const videoFrameToCanvas = f => {
  const canvas = document.createElement('canvas');
  canvas.width = f.codedWidth;
  canvas.height = f.codedHeight;
  canvas.getContext('2d').drawImage(f, 0, 0, f.codedWidth, f.codedHeight);
  return canvas;
};

const getPlaybackSpeed = playbackSpeed => playbackSpeed === 'normal' ? 1 : Number(playbackSpeed);

const isSaveTypeVideo = saveType => saveType === common_constants__WEBPACK_IMPORTED_MODULE_1__.SAVE_AS.MP4 || saveType === common_constants__WEBPACK_IMPORTED_MODULE_1__.SAVE_AS.WEBM;

const isPlanIdPremiumPro = planId => Number(planId) === common_constants__WEBPACK_IMPORTED_MODULE_1__.PADDLE_PREMIUM_PRO_ANNUAL_PLAN_ID || Number(planId) === common_constants__WEBPACK_IMPORTED_MODULE_1__.PADDLE_PREMIUM_PRO_MONTHLY_PLAN_ID;

const getSubscriptionPlan = subscriptionInfo => subscriptionInfo?.hasPurchased || subscriptionInfo?.isSubscribed ? isPlanIdPremiumPro(subscriptionInfo.subscriptionPlanId) ? common_constants__WEBPACK_IMPORTED_MODULE_1__.SUBSCRIPTION_PLAN.PREMIUM_PRO : common_constants__WEBPACK_IMPORTED_MODULE_1__.SUBSCRIPTION_PLAN.PREMIUM : null;
/**
 * The minimum delay for a GIF frame in milliseconds. A value of 20ms (50 FPS)
 * is a safe, widely supported minimum.
 */


const MIN_GIF_DELAY_MS = 20;
/**
 * An internal interface to hold a frame and its calculated start time.
 * @typedef {object} FrameWithTimestamp
 * @property {Frame} frame - The original frame object.
 * @property {number} timestamp - The absolute start time of this frame in the animation (in ms).
 */

/**
 * Filters and resamples a frame array to ensure compliance with GIF minimum delay requirements.
 * This function correctly handles variable frame rates (VFR) by using each frame's own duration.
 * It returns a new array of new frame objects, each with an updated duration.
 *
 * @param {Frame[]} frames The original array of frame objects. Each must have a 'duration' property.
 * @param {number} playbackSpeed The speed multiplier (e.g., 2 for 2x speed).
 * @returns {Frame[]} A new array of frame objects, resampled and ready for encoding.
 */

function filterFramesForGif(frames, framesPerSecond, playbackSpeed) {
  // Return immediately if there are no frames to process.
  if (!frames || frames.length === 0) {
    return [];
  } // --- Step 1: Check if any filtering is needed at all ---


  const isFilteringRequired = frames.some(frame => getAlteredDelay(framesPerSecond, playbackSpeed, frame.duration) < MIN_GIF_DELAY_MS); // If no frame violates the minimum delay, we just adjust durations and return new objects.

  if (!isFilteringRequired) {
    return frames.map(frame => ({ ...frame,
      // Create a new object, copying properties from the original
      duration: getAlteredDelay(framesPerSecond, playbackSpeed, frame.duration) // Set the new, adjusted duration

    }));
  } // --- Step 2: Filtering is required. Build a timestamp map for the original frames. ---


  let currentTime = 0;
  const sourceFramesWithTimestamps = frames.map(frame => {
    const frameData = {
      frame: frame,
      timestamp: currentTime
    }; // The effective duration of this frame after applying speed adjustment.

    const effectiveDuration = getAlteredDelay(framesPerSecond, playbackSpeed, frame.duration);
    currentTime += effectiveDuration;
    return frameData;
  });
  const totalAnimationDuration = currentTime;
  const resampledFrames = []; // --- Step 3: Resample the animation at a constant interval (MIN_GIF_DELAY_MS) ---

  let sourceFrameIndex = 0;

  for (let targetTimestamp = 0; targetTimestamp < totalAnimationDuration; targetTimestamp += MIN_GIF_DELAY_MS) {
    // Find the source frame that should be displayed at the current targetTimestamp.
    // We advance the sourceFrameIndex until the *next* frame's timestamp is past our target.
    while (sourceFrameIndex < sourceFramesWithTimestamps.length - 1 && sourceFramesWithTimestamps[sourceFrameIndex + 1].timestamp <= targetTimestamp) {
      sourceFrameIndex++;
    } // The correct frame is the one at the current sourceFrameIndex.


    const sourceFrame = sourceFramesWithTimestamps[sourceFrameIndex].frame; // Create a new frame object for the output.

    const newFrame = { ...sourceFrame,
      // Copy all properties from the original source frame
      duration: MIN_GIF_DELAY_MS // Set the new, compliant duration

    };
    resampledFrames.push(newFrame);
  }

  return resampledFrames;
}



/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			id: moduleId,
/******/ 			loaded: false,
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/global */
/******/ 	(() => {
/******/ 		__webpack_require__.g = (function() {
/******/ 			if (typeof globalThis === 'object') return globalThis;
/******/ 			try {
/******/ 				return this || new Function('return this')();
/******/ 			} catch (e) {
/******/ 				if (typeof window === 'object') return window;
/******/ 			}
/******/ 		})();
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/node module decorator */
/******/ 	(() => {
/******/ 		__webpack_require__.nmd = (module) => {
/******/ 			module.paths = [];
/******/ 			if (!module.children) module.children = [];
/******/ 			return module;
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be in strict mode.
(() => {
"use strict";
/*!*******************************!*\
  !*** ./src/test/avif-test.ts ***!
  \*******************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var common_editing_avif__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! common/editing/avif */ "./src/common/editing/avif.ts");
/**
 * Animated AVIF muxer integration test.
 *
 * Open debugging/test-avif.html in Chrome after running `yarn watch`.
 * The page will encode 24 canvas frames as AV1 via WebCodecs, mux them with
 * AvifMuxer, and present a download link + inline <img> preview.
 */

const WIDTH = 320;
const HEIGHT = 180;
const FRAME_COUNT = 24;
const FRAME_DURATION_MS = 80; // ~12.5 fps

function log(msg) {
  const el = document.getElementById('log');
  el.textContent += msg + '\n';
  console.log(msg);
}

function appendOutput(el) {
  document.getElementById('output').appendChild(el);
}
/** Draw one animation frame onto a 2D canvas context. */


function drawFrame(ctx, index) {
  // Shifting hue background
  const hue = index / FRAME_COUNT * 360;
  ctx.fillStyle = `hsl(${hue}, 65%, 30%)`;
  ctx.fillRect(0, 0, WIDTH, HEIGHT); // Secondary colour band

  ctx.fillStyle = `hsl(${(hue + 120) % 360}, 60%, 20%)`;
  ctx.fillRect(0, HEIGHT * 0.6, WIDTH, HEIGHT * 0.4); // Bouncing circle

  const cx = 30 + index / (FRAME_COUNT - 1) * (WIDTH - 60);
  const cy = HEIGHT / 2 + Math.sin(index / FRAME_COUNT * Math.PI * 4) * (HEIGHT * 0.25);
  ctx.beginPath();
  ctx.arc(cx, cy, 22, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.fill(); // Frame counter

  ctx.font = 'bold 13px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText(`frame ${index + 1} / ${FRAME_COUNT}`, 8, HEIGHT - 8);
}

async function runTest() {
  log('AvifMuxer test starting…');
  log(`  ${FRAME_COUNT} frames  ·  ${WIDTH}×${HEIGHT}  ·  ${FRAME_DURATION_MS} ms/frame`);

  if (typeof VideoEncoder === 'undefined') {
    log('ERROR: VideoEncoder (WebCodecs) not available in this context.');
    log('Open this page from a Chrome Extension context or a secure (https) origin.');
    return;
  } // ── Encoder setup ─────────────────────────────────────────────────────────


  const pendingChunks = [];
  const pendingMetas = [];
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      pendingChunks.push(chunk);
      pendingMetas.push(meta ?? undefined);
    },
    error: e => log('VideoEncoder error: ' + e.message)
  }); // AV1 Baseline Profile level 2.0, 8-bit

  encoder.configure({
    codec: 'av01.0.04M.08',
    width: WIDTH,
    height: HEIGHT,
    bitrate: 800_000,
    framerate: Math.round(1000 / FRAME_DURATION_MS)
  }); // ── Encode frames ─────────────────────────────────────────────────────────

  log('Encoding frames…');

  for (let i = 0; i < FRAME_COUNT; i++) {
    const canvas = new OffscreenCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');
    drawFrame(ctx, i);
    const frame = new VideoFrame(canvas, {
      timestamp: i * FRAME_DURATION_MS * 1000,
      // µs
      duration: FRAME_DURATION_MS * 1000 // µs

    }); // Force a keyframe every 8 frames so the cover image is always a keyframe

    encoder.encode(frame, {
      keyFrame: i % 8 === 0
    });
    frame.close();
  }

  await encoder.flush();
  encoder.close();
  log(`Encoded → ${pendingChunks.length} chunks (${pendingChunks.filter(c => c.type === 'key').length} keyframes)`); // ── Mux ───────────────────────────────────────────────────────────────────

  log('Muxing…');
  const muxer = new common_editing_avif__WEBPACK_IMPORTED_MODULE_0__.AvifMuxer({
    width: WIDTH,
    height: HEIGHT,
    codec: 'av01.0.04M.08'
  });

  for (let i = 0; i < pendingChunks.length; i++) {
    muxer.addVideoChunk(pendingChunks[i], pendingMetas[i]);
  }

  muxer.finalize();
  const {
    buffer
  } = muxer.target;

  if (!buffer) {
    log('FAIL: muxer.target.buffer is null after finalize()');
    return;
  }

  const bytes = new Uint8Array(buffer);
  const sizeKB = (buffer.byteLength / 1024).toFixed(1); // ── Structural validation ─────────────────────────────────────────────────

  const ftypSize = new DataView(buffer).getUint32(0);
  const ftypType = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
  const majorBrand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  log(`Output: ${sizeKB} KB`);
  log(`ftyp box: size=${ftypSize}, type="${ftypType}", major="${majorBrand}"`);
  if (ftypType !== 'ftyp') log('FAIL: first box is not ftyp');else if (majorBrand !== 'avis') log(`FAIL: expected major brand "avis", got "${majorBrand}"`);else log('PASS: ftyp structure looks correct'); // Check for meta, moov, mdat boxes

  const expectedBoxes = ['meta', 'moov', 'mdat'];
  let offset = ftypSize;
  const foundBoxes = [];

  while (offset + 8 <= bytes.length) {
    const boxSize = new DataView(buffer, offset, 4).getUint32(0);
    const boxType = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
    foundBoxes.push(boxType);
    if (boxSize === 0) break;
    offset += boxSize;
  }

  log(`Top-level boxes after ftyp: [${foundBoxes.join(', ')}]`);
  const allFound = expectedBoxes.every(b => foundBoxes.includes(b));
  log(allFound ? 'PASS: meta, moov, mdat all present' : `FAIL: missing boxes (expected ${expectedBoxes.join(', ')})`); // ── Download + preview ────────────────────────────────────────────────────

  const blob = new Blob([buffer], {
    type: 'image/avif'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'test-animation.avif';
  a.textContent = `⬇ Download test-animation.avif (${sizeKB} KB)`;
  appendOutput(a);
  const note = document.createElement('p');
  note.textContent = 'Preview (animated AVIF — Chrome 113+ required):';
  appendOutput(note);
  const img = document.createElement('img');
  img.src = url;
  img.width = WIDTH;
  img.height = HEIGHT;
  img.alt = 'animated AVIF preview';

  img.onerror = () => log('WARN: browser could not decode the AVIF for preview (check the download manually).');

  appendOutput(img);
  log('Done.');
}

runTest().catch(err => {
  document.getElementById('log').textContent += '\nFATAL: ' + (err?.stack ?? err);
});
})();

/******/ })()
;
//# sourceMappingURL=bundle.map