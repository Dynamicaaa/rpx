/**
 * RPickleX - Complete Python Pickle Parser for JavaScript
 * Supports pickle protocols 0-5 with all opcodes
 */

(function(global) {
    'use strict';

    class RPickleX {
        constructor() {
            this.HIGHEST_PROTOCOL = 5;
            this.opcodes = this._initOpcodes();
            this.dispatch = {};
            this._initDispatchTable();
        }

        _initOpcodes() {
            return {
                // Protocol 0
                MARK: 0x28,           // '('
                STOP: 0x2e,           // '.'
                POP: 0x30,            // '0'
                POP_MARK: 0x31,       // '1'
                DUP: 0x32,            // '2'
                FLOAT: 0x46,          // 'F'
                INT: 0x49,            // 'I'
                BININT: 0x4a,         // 'J'
                BININT1: 0x4b,        // 'K'
                LONG: 0x4c,           // 'L'
                BININT2: 0x4d,        // 'M'
                NONE: 0x4e,           // 'N'
                PERSID: 0x50,         // 'P'
                BINPERSID: 0x51,      // 'Q'
                REDUCE: 0x52,         // 'R'
                STRING: 0x53,         // 'S'
                BINSTRING: 0x54,      // 'T'
                SHORT_BINSTRING: 0x55, // 'U'
                UNICODE: 0x56,        // 'V'
                BINUNICODE: 0x58,     // 'X'
                APPEND: 0x61,         // 'a'
                BUILD: 0x62,          // 'b'
                GLOBAL: 0x63,         // 'c'
                DICT: 0x64,           // 'd'
                EMPTY_DICT: 0x7d,     // '}'
                APPENDS: 0x65,        // 'e'
                GET: 0x67,            // 'g'
                BINGET: 0x68,         // 'h'
                INST: 0x69,           // 'i'
                LONG_BINGET: 0x6a,    // 'j'
                LIST: 0x6c,           // 'l'
                EMPTY_LIST: 0x5d,     // ']'
                OBJ: 0x6f,            // 'o'
                PUT: 0x70,            // 'p'
                BINPUT: 0x71,         // 'q'
                LONG_BINPUT: 0x72,    // 'r'
                SETITEM: 0x73,        // 's'
                TUPLE: 0x74,          // 't'
                EMPTY_TUPLE: 0x29,    // ')'
                SETITEMS: 0x75,       // 'u'
                BINFLOAT: 0x47,       // 'G'

                // Protocol 1
                TRUE: 0x88,           // '\x88'
                FALSE: 0x89,          // '\x89'
                LONG1: 0x8a,          // '\x8a'
                LONG4: 0x8b,          // '\x8b'

                // Protocol 2
                PROTO: 0x80,          // '\x80'
                NEWOBJ: 0x81,         // '\x81'
                EXT1: 0x82,           // '\x82'
                EXT2: 0x83,           // '\x83'
                EXT4: 0x84,           // '\x84'
                TUPLE1: 0x85,         // '\x85'
                TUPLE2: 0x86,         // '\x86'
                TUPLE3: 0x87,         // '\x87'
                NEWTRUE: 0x88,        // '\x88'
                NEWFALSE: 0x89,       // '\x89'

                // Protocol 3
                BINBYTES: 0x42,       // 'B'
                SHORT_BINBYTES: 0x43, // 'C'

                // Protocol 4
                SHORT_BINUNICODE: 0x8c, // '\x8c'
                BINUNICODE8: 0x8d,    // '\x8d'
                BINBYTES8: 0x8e,      // '\x8e'
                EMPTY_SET: 0x8f,      // '\x8f'
                ADDITEMS: 0x90,       // '\x90'
                FROZENSET: 0x91,      // '\x91'
                NEWOBJ_EX: 0x92,      // '\x92'
                STACK_GLOBAL: 0x93,   // '\x93'
                MEMOIZE: 0x94,        // '\x94'
                FRAME: 0x95,          // '\x95'

                // Protocol 5
                BYTEARRAY8: 0x96,     // '\x96'
                NEXT_BUFFER: 0x97,    // '\x97'
                READONLY_BUFFER: 0x98 // '\x98'
            };
        }

        _initDispatchTable() {
            const ops = this.opcodes;

            // Protocol 0
            this.dispatch[ops.MARK] = '_loadMark';
            this.dispatch[ops.STOP] = '_loadStop';
            this.dispatch[ops.POP] = '_loadPop';
            this.dispatch[ops.POP_MARK] = '_loadPopMark';
            this.dispatch[ops.DUP] = '_loadDup';
            this.dispatch[ops.FLOAT] = '_loadFloat';
            this.dispatch[ops.INT] = '_loadInt';
            this.dispatch[ops.BININT] = '_loadBinInt';
            this.dispatch[ops.BININT1] = '_loadBinInt1';
            this.dispatch[ops.LONG] = '_loadLong';
            this.dispatch[ops.BININT2] = '_loadBinInt2';
            this.dispatch[ops.NONE] = '_loadNone';
            this.dispatch[ops.PERSID] = '_loadPersId';
            this.dispatch[ops.BINPERSID] = '_loadBinPersId';
            this.dispatch[ops.REDUCE] = '_loadReduce';
            this.dispatch[ops.STRING] = '_loadString';
            this.dispatch[ops.BINSTRING] = '_loadBinString';
            this.dispatch[ops.SHORT_BINSTRING] = '_loadShortBinString';
            this.dispatch[ops.UNICODE] = '_loadUnicode';
            this.dispatch[ops.BINUNICODE] = '_loadBinUnicode';
            this.dispatch[ops.APPEND] = '_loadAppend';
            this.dispatch[ops.BUILD] = '_loadBuild';
            this.dispatch[ops.GLOBAL] = '_loadGlobal';
            this.dispatch[ops.DICT] = '_loadDict';
            this.dispatch[ops.EMPTY_DICT] = '_loadEmptyDict';
            this.dispatch[ops.APPENDS] = '_loadAppends';
            this.dispatch[ops.GET] = '_loadGet';
            this.dispatch[ops.BINGET] = '_loadBinGet';
            this.dispatch[ops.INST] = '_loadInst';
            this.dispatch[ops.LONG_BINGET] = '_loadLongBinGet';
            this.dispatch[ops.LIST] = '_loadList';
            this.dispatch[ops.EMPTY_LIST] = '_loadEmptyList';
            this.dispatch[ops.OBJ] = '_loadObj';
            this.dispatch[ops.PUT] = '_loadPut';
            this.dispatch[ops.BINPUT] = '_loadBinPut';
            this.dispatch[ops.LONG_BINPUT] = '_loadLongBinPut';
            this.dispatch[ops.SETITEM] = '_loadSetItem';
            this.dispatch[ops.TUPLE] = '_loadTuple';
            this.dispatch[ops.EMPTY_TUPLE] = '_loadEmptyTuple';
            this.dispatch[ops.SETITEMS] = '_loadSetItems';
            this.dispatch[ops.BINFLOAT] = '_loadBinFloat';

            // Protocol 1
            this.dispatch[ops.TRUE] = '_loadTrue';
            this.dispatch[ops.FALSE] = '_loadFalse';
            this.dispatch[ops.LONG1] = '_loadLong1';
            this.dispatch[ops.LONG4] = '_loadLong4';

            // Protocol 2
            this.dispatch[ops.PROTO] = '_loadProto';
            this.dispatch[ops.NEWOBJ] = '_loadNewObj';
            this.dispatch[ops.EXT1] = '_loadExt1';
            this.dispatch[ops.EXT2] = '_loadExt2';
            this.dispatch[ops.EXT4] = '_loadExt4';
            this.dispatch[ops.TUPLE1] = '_loadTuple1';
            this.dispatch[ops.TUPLE2] = '_loadTuple2';
            this.dispatch[ops.TUPLE3] = '_loadTuple3';

            // Protocol 3
            this.dispatch[ops.BINBYTES] = '_loadBinBytes';
            this.dispatch[ops.SHORT_BINBYTES] = '_loadShortBinBytes';

            // Protocol 4
            this.dispatch[ops.SHORT_BINUNICODE] = '_loadShortBinUnicode';
            this.dispatch[ops.BINUNICODE8] = '_loadBinUnicode8';
            this.dispatch[ops.BINBYTES8] = '_loadBinBytes8';
            this.dispatch[ops.EMPTY_SET] = '_loadEmptySet';
            this.dispatch[ops.ADDITEMS] = '_loadAddItems';
            this.dispatch[ops.FROZENSET] = '_loadFrozenSet';
            this.dispatch[ops.NEWOBJ_EX] = '_loadNewObjEx';
            this.dispatch[ops.STACK_GLOBAL] = '_loadStackGlobal';
            this.dispatch[ops.MEMOIZE] = '_loadMemoize';
            this.dispatch[ops.FRAME] = '_loadFrame';

            // Protocol 5
            this.dispatch[ops.BYTEARRAY8] = '_loadByteArray8';
            this.dispatch[ops.NEXT_BUFFER] = '_loadNextBuffer';
            this.dispatch[ops.READONLY_BUFFER] = '_loadReadOnlyBuffer';
        }

        loads(data) {
            if (typeof data === 'string') {
                data = this._stringToBytes(data);
            }
            
            const unpickler = new Unpickler(data, this);
            return unpickler.load();
        }

        _stringToBytes(str) {
            const bytes = new Uint8Array(str.length);
            for (let i = 0; i < str.length; i++) {
                bytes[i] = str.charCodeAt(i);
            }
            return bytes;
        }
    }

    class Unpickler {
        constructor(data, pickler) {
            this.data = data;
            this.pickler = pickler;
            this.pos = 0;
            this.stack = [];
            this.metastack = [];
            this.memo = {};
            this.mark = null;
            this.proto = 0;
        }

        load() {
            while (this.pos < this.data.length) {
                const opcode = this.data[this.pos++];
                const methodName = this.pickler.dispatch[opcode];

                if (!methodName) {
                    throw new Error(`Unknown opcode: 0x${opcode.toString(16)}`);
                }

                const handler = this[methodName];
                if (!handler) {
                    throw new Error(`Missing handler method: ${methodName}`);
                }

                const result = handler.call(this);
                if (result === 'STOP') {
                    if (this.stack.length !== 1) {
                        throw new Error('Unpickling stack error');
                    }
                    return this.stack[0];
                }
            }
            throw new Error('Pickle truncated');
        }

        read(n) {
            if (this.pos + n > this.data.length) {
                throw new Error('Pickle truncated');
            }
            const result = this.data.slice(this.pos, this.pos + n);
            this.pos += n;
            return result;
        }

        readLine() {
            const start = this.pos;
            while (this.pos < this.data.length && this.data[this.pos] !== 0x0a) {
                this.pos++;
            }
            if (this.pos >= this.data.length) {
                throw new Error('Pickle truncated');
            }
            const line = this.data.slice(start, this.pos);
            this.pos++; // Skip newline
            return line;
        }

        readInt(n) {
            const bytes = this.read(n);
            let result = 0;
            for (let i = 0; i < n; i++) {
                result |= bytes[i] << (8 * i);
            }
            return result;
        }

        readInt32() {
            const bytes = this.read(4);
            return (bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24)) >>> 0;
        }

        _getMarkObject() {
            const items = [];
            let k = this.stack.length - 1;
            while (k >= 0 && this.stack[k] !== this.mark) {
                k--;
            }
            if (k < 0) {
                throw new Error('Mark not found');
            }
            const marked = this.stack.splice(k);
            marked.shift(); // Remove mark
            return marked;
        }

        // Protocol 0 handlers
        _loadMark() {
            this.stack.push(this.mark);
        }

        _loadStop() {
            return 'STOP';
        }

        _loadPop() {
            if (this.stack.length === 0) {
                throw new Error('Stack underflow');
            }
            this.stack.pop();
        }

        _loadPopMark() {
            const k = this.stack.lastIndexOf(this.mark);
            if (k < 0) {
                throw new Error('Mark not found');
            }
            this.stack.splice(k);
        }

        _loadDup() {
            if (this.stack.length === 0) {
                throw new Error('Stack underflow');
            }
            const item = this.stack[this.stack.length - 1];
            this.stack.push(item);
        }

        _loadFloat() {
            const line = this.readLine();
            const str = String.fromCharCode(...line);
            this.stack.push(parseFloat(str));
        }

        _loadInt() {
            const line = this.readLine();
            const str = String.fromCharCode(...line).trim();
            
            if (str === '00') {
                this.stack.push(false);
            } else if (str === '01') {
                this.stack.push(true);
            } else {
                let val = parseInt(str, 10);
                if (str.endsWith('L')) {
                    val = parseInt(str.slice(0, -1), 10);
                }
                this.stack.push(val);
            }
        }

        _loadBinInt() {
            const bytes = this.read(4);
            const val = (bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24)) | 0;
            this.stack.push(val);
        }

        _loadBinInt1() {
            this.stack.push(this.read(1)[0]);
        }

        _loadBinInt2() {
            const bytes = this.read(2);
            this.stack.push(bytes[0] | (bytes[1] << 8));
        }

        _loadLong() {
            const line = this.readLine();
            let str = String.fromCharCode(...line).trim();
            if (str.endsWith('L')) {
                str = str.slice(0, -1);
            }
            // JavaScript doesn't have native bigint in older versions, store as string for large numbers
            const val = parseInt(str, 10);
            this.stack.push(val);
        }

        _loadNone() {
            this.stack.push(null);
        }

        _loadPersId() {
            const line = this.readLine();
            const pid = String.fromCharCode(...line).slice(0, -1);
            this.stack.push(this._persistentLoad(pid));
        }

        _loadBinPersId() {
            const pid = this.stack.pop();
            this.stack.push(this._persistentLoad(pid));
        }

        _persistentLoad(pid) {
            throw new Error(`Unsupported persistent id: ${pid}`);
        }

        _loadReduce() {
            const args = this.stack.pop();
            const func = this.stack.pop();
            this.stack.push(this._reduce(func, args));
        }

        _reduce(func, args) {
            // Simple object construction
            if (func.__module__ && func.__name__) {
                const cls = func;
                const instance = { __class__: cls };
                if (args && args.length) {
                    Object.assign(instance, args[0]);
                }
                return instance;
            }
            return { __reduce__: [func, args] };
        }

        _loadString() {
            const line = this.readLine();
            let str = String.fromCharCode(...line);
            
            // Handle quoted strings
            if ((str[0] === "'" || str[0] === '"') && str[0] === str[str.length - 2]) {
                str = str.slice(1, -2);
                // Unescape
                str = str.replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => 
                    String.fromCharCode(parseInt(h, 16)));
                str = str.replace(/\\(.)/g, (_, c) => {
                    const escapes = { 'n': '\n', 't': '\t', 'r': '\r', '\\': '\\' };
                    return escapes[c] || c;
                });
            }
            
            this.stack.push(str);
        }

        _loadBinString() {
            const len = this.readInt32();
            const bytes = this.read(len);
            this.stack.push(String.fromCharCode(...bytes));
        }

        _loadShortBinString() {
            const len = this.read(1)[0];
            const bytes = this.read(len);
            this.stack.push(String.fromCharCode(...bytes));
        }

        _loadUnicode() {
            const line = this.readLine();
            let str = String.fromCharCode(...line);
            
            // Remove quotes and unescape
            if ((str[0] === "'" || str[0] === '"') && str[0] === str[str.length - 2]) {
                str = str.slice(1, -2);
            }
            
            // Decode unicode escapes
            str = str.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => 
                String.fromCharCode(parseInt(h, 16)));
            
            this.stack.push(str);
        }

        _loadBinUnicode() {
            const len = this.readInt32();
            const bytes = this.read(len);
            const str = new TextDecoder('utf-8').decode(bytes);
            this.stack.push(str);
        }

        _loadAppend() {
            const value = this.stack.pop();
            const list = this.stack[this.stack.length - 1];
            list.push(value);
        }

        _loadBuild() {
            const state = this.stack.pop();
            const obj = this.stack[this.stack.length - 1];
            
            if (obj.__setstate__) {
                obj.__setstate__(state);
            } else if (state instanceof Object) {
                Object.assign(obj, state);
            }
        }

        _loadGlobal() {
            const module = String.fromCharCode(...this.readLine()).slice(0, -1);
            const name = String.fromCharCode(...this.readLine()).slice(0, -1);
            this.stack.push({ __module__: module, __name__: name });
        }

        _loadDict() {
            const items = this._getMarkObject();
            const dict = {};
            for (let i = 0; i < items.length; i += 2) {
                dict[items[i]] = items[i + 1];
            }
            this.stack.push(dict);
        }

        _loadEmptyDict() {
            this.stack.push({});
        }

        _loadAppends() {
            const items = this._getMarkObject();
            const list = this.stack[this.stack.length - 1];
            for (const item of items) {
                list.push(item);
            }
        }

        _loadGet() {
            const line = this.readLine();
            const idx = parseInt(String.fromCharCode(...line), 10);
            this.stack.push(this.memo[idx]);
        }

        _loadBinGet() {
            const idx = this.read(1)[0];
            this.stack.push(this.memo[idx]);
        }

        _loadInst() {
            const module = String.fromCharCode(...this.readLine()).slice(0, -1);
            const name = String.fromCharCode(...this.readLine()).slice(0, -1);
            const cls = { __module__: module, __name__: name };
            const args = this._getMarkObject();
            this.stack.push(this._instantiate(cls, args));
        }

        _instantiate(cls, args) {
            return { __class__: cls, __args__: args };
        }

        _loadLongBinGet() {
            const idx = this.readInt32();
            this.stack.push(this.memo[idx]);
        }

        _loadList() {
            const items = this._getMarkObject();
            this.stack.push(items);
        }

        _loadEmptyList() {
            this.stack.push([]);
        }

        _loadObj() {
            const args = this._getMarkObject();
            const cls = args.shift();
            this.stack.push(this._instantiate(cls, args));
        }

        _loadPut() {
            const line = this.readLine();
            const idx = parseInt(String.fromCharCode(...line), 10);
            this.memo[idx] = this.stack[this.stack.length - 1];
        }

        _loadBinPut() {
            const idx = this.read(1)[0];
            this.memo[idx] = this.stack[this.stack.length - 1];
        }

        _loadLongBinPut() {
            const idx = this.readInt32();
            this.memo[idx] = this.stack[this.stack.length - 1];
        }

        _loadSetItem() {
            const value = this.stack.pop();
            const key = this.stack.pop();
            const dict = this.stack[this.stack.length - 1];
            dict[key] = value;
        }

        _loadTuple() {
            const items = this._getMarkObject();
            this.stack.push(items);
        }

        _loadEmptyTuple() {
            this.stack.push([]);
        }

        _loadSetItems() {
            const items = this._getMarkObject();
            const dict = this.stack[this.stack.length - 1];
            for (let i = 0; i < items.length; i += 2) {
                dict[items[i]] = items[i + 1];
            }
        }

        _loadBinFloat() {
            const bytes = this.read(8);
            const view = new DataView(new ArrayBuffer(8));
            for (let i = 0; i < 8; i++) {
                view.setUint8(7 - i, bytes[i]);
            }
            this.stack.push(view.getFloat64(0));
        }

        // Protocol 1 handlers
        _loadTrue() {
            this.stack.push(true);
        }

        _loadFalse() {
            this.stack.push(false);
        }

        _loadLong1() {
            const n = this.read(1)[0];
            const bytes = this.read(n);
            let val = 0;
            for (let i = 0; i < n; i++) {
                val |= bytes[i] << (8 * i);
            }
            this.stack.push(val);
        }

        _loadLong4() {
            const n = this.readInt32();
            const bytes = this.read(n);
            let val = 0;
            for (let i = 0; i < Math.min(n, 6); i++) { // Limit to JavaScript safe integer
                val |= bytes[i] << (8 * i);
            }
            this.stack.push(val);
        }

        // Protocol 2 handlers
        _loadProto() {
            const proto = this.read(1)[0];
            if (proto > 5) {
                throw new Error(`Unsupported protocol: ${proto}`);
            }
            this.proto = proto;
        }

        _loadNewObj() {
            const args = this.stack.pop();
            const cls = this.stack.pop();
            this.stack.push(this._instantiate(cls, args));
        }

        _loadExt1() {
            const code = this.read(1)[0];
            this._getExtension(code);
        }

        _loadExt2() {
            const code = this.readInt(2);
            this._getExtension(code);
        }

        _loadExt4() {
            const code = this.readInt32();
            this._getExtension(code);
        }

        _getExtension(code) {
            // Extension mechanism - not typically used
            this.stack.push({ __extension__: code });
        }

        _loadTuple1() {
            const item = this.stack.pop();
            this.stack.push([item]);
        }

        _loadTuple2() {
            const item2 = this.stack.pop();
            const item1 = this.stack.pop();
            this.stack.push([item1, item2]);
        }

        _loadTuple3() {
            const item3 = this.stack.pop();
            const item2 = this.stack.pop();
            const item1 = this.stack.pop();
            this.stack.push([item1, item2, item3]);
        }

        // Protocol 3 handlers
        _loadBinBytes() {
            const len = this.readInt32();
            const bytes = this.read(len);
            this.stack.push(bytes);
        }

        _loadShortBinBytes() {
            const len = this.read(1)[0];
            const bytes = this.read(len);
            this.stack.push(bytes);
        }

        // Protocol 4 handlers
        _loadShortBinUnicode() {
            const len = this.read(1)[0];
            const bytes = this.read(len);
            const str = new TextDecoder('utf-8').decode(bytes);
            this.stack.push(str);
        }

        _loadBinUnicode8() {
            const lenBytes = this.read(8);
            let len = 0;
            for (let i = 0; i < 8; i++) {
                len |= lenBytes[i] << (8 * i);
            }
            const bytes = this.read(len);
            const str = new TextDecoder('utf-8').decode(bytes);
            this.stack.push(str);
        }

        _loadBinBytes8() {
            const lenBytes = this.read(8);
            let len = 0;
            for (let i = 0; i < 8; i++) {
                len |= lenBytes[i] << (8 * i);
            }
            const bytes = this.read(len);
            this.stack.push(bytes);
        }

        _loadEmptySet() {
            this.stack.push(new Set());
        }

        _loadAddItems() {
            const items = this._getMarkObject();
            const set = this.stack[this.stack.length - 1];
            for (const item of items) {
                set.add(item);
            }
        }

        _loadFrozenSet() {
            const items = this._getMarkObject();
            const set = new Set(items);
            set.__frozen__ = true;
            this.stack.push(set);
        }

        _loadNewObjEx() {
            const kwargs = this.stack.pop();
            const args = this.stack.pop();
            const cls = this.stack.pop();
            const obj = this._instantiate(cls, args);
            if (kwargs) {
                Object.assign(obj, kwargs);
            }
            this.stack.push(obj);
        }

        _loadStackGlobal() {
            const name = this.stack.pop();
            const module = this.stack.pop();
            this.stack.push({ __module__: module, __name__: name });
        }

        _loadMemoize() {
            const memo_len = Object.keys(this.memo).length;
            this.memo[memo_len] = this.stack[this.stack.length - 1];
        }

        _loadFrame() {
            const frameSize = this.read(8);
            // Frames are used for optimization, we can ignore them
        }

        // Protocol 5 handlers
        _loadByteArray8() {
            const lenBytes = this.read(8);
            let len = 0;
            for (let i = 0; i < 8; i++) {
                len |= lenBytes[i] << (8 * i);
            }
            const bytes = this.read(len);
            this.stack.push(new Uint8Array(bytes));
        }

        _loadNextBuffer() {
            // Buffer protocol support
            this.stack.push({ __buffer__: true });
        }

        _loadReadOnlyBuffer() {
            // Read-only buffer
            const buffer = this.stack[this.stack.length - 1];
            buffer.__readonly__ = true;
        }
    }

    // Helper functions
    RPickleX.prototype.dumps = function(obj, protocol) {
        throw new Error('Pickling (dumps) not implemented - this is a parser only');
    };

    // Create global instance
    const rpicklex = new RPickleX();

    // Export for different environments
    if (typeof module !== 'undefined' && module.exports) {
        // Node.js
        module.exports = RPickleX;
        module.exports.RPickleX = RPickleX;
        module.exports.default = RPickleX;
        module.exports.rpicklex = rpicklex;
    } else if (typeof define === 'function' && define.amd) {
        // AMD
        define(function() {
            return RPickleX;
        });
    } else {
        // Browser global
        global.RPickleX = RPickleX;
        global.rpicklex = rpicklex;
    }

    // Additional utility functions and constants
    RPickleX.PickleError = class extends Error {
        constructor(message) {
            super(message);
            this.name = 'PickleError';
        }
    };

    // Protocol version constants
    RPickleX.PROTOCOL_0 = 0;
    RPickleX.PROTOCOL_1 = 1;
    RPickleX.PROTOCOL_2 = 2;
    RPickleX.PROTOCOL_3 = 3;
    RPickleX.PROTOCOL_4 = 4;
    RPickleX.PROTOCOL_5 = 5;

    // ES6 export for compatibility
    if (typeof module !== 'undefined' && module.exports) {
        // For ES modules compatibility
        module.exports.default = RPickleX;
    }

    // Convenience method for loading from different input types
    RPickleX.prototype.load = function(input) {
        if (input instanceof ArrayBuffer) {
            return this.loads(new Uint8Array(input));
        } else if (input instanceof Uint8Array) {
            return this.loads(input);
        } else if (typeof input === 'string') {
            // Try base64 decode first
            try {
                const decoded = atob(input);
                const bytes = new Uint8Array(decoded.length);
                for (let i = 0; i < decoded.length; i++) {
                    bytes[i] = decoded.charCodeAt(i);
                }
                return this.loads(bytes);
            } catch (e) {
                // If not base64, treat as raw bytes
                return this.loads(input);
            }
        } else if (Buffer && input instanceof Buffer) {
            // Node.js Buffer support
            return this.loads(new Uint8Array(input));
        } else {
            throw new TypeError('Invalid input type for unpickling');
        }
    };

    // Utility to convert pickle data to hex string for debugging
    RPickleX.prototype.toHexString = function(data) {
        if (typeof data === 'string') {
            data = this._stringToBytes(data);
        }

        return Array.from(data)
            .map(byte => ('0' + byte.toString(16)).slice(-2))
            .join(' ')
            .toUpperCase();
    };

    // Debug mode for tracing opcodes
    RPickleX.prototype.enableDebug = function() {
        const original = this.loads;
        this.loads = function(data) {
            console.log('=== RPickleX Debug Mode ===');
            console.log('Input data length:', data.length);
            console.log('Hex dump:', this.toHexString(data).substring(0, 200) + '...');

            // Wrap unpickler to trace opcodes
            const unpickler = new Unpickler(data, this);
            const originalLoad = unpickler.load.bind(unpickler);

            unpickler.load = function() {
                const opcodeNames = {};
                for (const [name, value] of Object.entries(this.pickler.opcodes)) {
                    opcodeNames[value] = name;
                }

                while (this.pos < this.data.length) {
                    const opcode = this.data[this.pos];
                    const opcodeName = opcodeNames[opcode] || 'UNKNOWN';
                    console.log(`Position ${this.pos}: Opcode 0x${opcode.toString(16)} (${opcodeName})`);
                    console.log('  Stack:', JSON.stringify(this.stack).substring(0, 100));

                    this.pos++;
                    const methodName = this.pickler.dispatch[opcode];
                    const handler = this[methodName];

                    if (!handler) {
                        throw new Error(`Unknown opcode: 0x${opcode.toString(16)}`);
                    }

                    const result = handler.call(this);
                    if (result === 'STOP') {
                        console.log('=== Unpickling Complete ===');
                        if (this.stack.length !== 1) {
                            throw new Error('Unpickling stack error');
                        }
                        return this.stack[0];
                    }
                }
                throw new Error('Pickle truncated');
            };

            return unpickler.load();
        }.bind(this);
    };

    // Disable debug mode
    RPickleX.prototype.disableDebug = function() {
        delete this.loads;
    };

    // Get protocol version from pickle data
    RPickleX.prototype.getProtocolVersion = function(data) {
        if (typeof data === 'string') {
            data = this._stringToBytes(data);
        }

        // Check for PROTO opcode (0x80)
        if (data.length >= 2 && data[0] === 0x80) {
            return data[1];
        }

        // Default to protocol 0
        return 0;
    };

    // Validate pickle data
    RPickleX.prototype.validate = function(data) {
        try {
            if (typeof data === 'string') {
                data = this._stringToBytes(data);
            }

            // Check minimum length
            if (data.length < 2) {
                return { valid: false, error: 'Data too short' };
            }

            // Check for STOP opcode
            let hasStop = false;
            for (let i = 0; i < data.length; i++) {
                if (data[i] === this.opcodes.STOP) {
                    hasStop = true;
                    break;
                }
            }

            if (!hasStop) {
                return { valid: false, error: 'Missing STOP opcode' };
            }

            // Try to actually parse it
            this.loads(data);
            return { valid: true, protocol: this.getProtocolVersion(data) };

        } catch (e) {
            return { valid: false, error: e.message };
        }
    };

    // Get opcode statistics from pickle data
    RPickleX.prototype.getOpcodeStats = function(data) {
        if (typeof data === 'string') {
            data = this._stringToBytes(data);
        }

        const stats = {};
        const opcodeNames = {};

        for (const [name, value] of Object.entries(this.opcodes)) {
            opcodeNames[value] = name;
        }

        for (let i = 0; i < data.length; i++) {
            const opcode = data[i];
            const name = opcodeNames[opcode] || `UNKNOWN_0x${opcode.toString(16)}`;
            stats[name] = (stats[name] || 0) + 1;
        }

        return stats;
    };

    // Quick test function
    RPickleX.test = function() {
        console.log('Testing RPickleX...');

        const picklex = new RPickleX();

        // Test simple pickle (protocol 0): None
        const nonePickle = new Uint8Array([0x4e, 0x2e]); // NONE, STOP
        console.log('Test 1 (None):', picklex.loads(nonePickle) === null ? 'PASS' : 'FAIL');

        // Test integer (protocol 0)
        const intPickle = new Uint8Array([0x49, 0x34, 0x32, 0x0a, 0x2e]); // INT "42\n", STOP
        console.log('Test 2 (Int 42):', picklex.loads(intPickle) === 42 ? 'PASS' : 'FAIL');

        // Test empty list
        const emptyListPickle = new Uint8Array([0x5d, 0x2e]); // EMPTY_LIST, STOP
        const list = picklex.loads(emptyListPickle);
        console.log('Test 3 (Empty list):', Array.isArray(list) && list.length === 0 ? 'PASS' : 'FAIL');

        // Test empty dict
        const emptyDictPickle = new Uint8Array([0x7d, 0x2e]); // EMPTY_DICT, STOP
        const dict = picklex.loads(emptyDictPickle);
        console.log('Test 4 (Empty dict):', typeof dict === 'object' && Object.keys(dict).length === 0 ? 'PASS' : 'FAIL');

        // Test protocol 2 with True
        const truePickle = new Uint8Array([0x80, 0x02, 0x88, 0x2e]); // PROTO 2, TRUE, STOP
        console.log('Test 5 (True):', picklex.loads(truePickle) === true ? 'PASS' : 'FAIL');

        console.log('Basic tests complete!');
    };

})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);

// Usage example comment
/*
// Example usage:

// In Node.js:
const RPickleX = require('./rpicklex.js');
const picklex = new RPickleX();

// Load pickle data from file
const fs = require('fs');
const pickleData = fs.readFileSync('data.pickle');
const obj = picklex.loads(pickleData);

// In browser:
// <script src="rpicklex.js"></script>
// const picklex = new RPickleX();
// const obj = picklex.loads(pickleData);

// Load from base64 string
// const obj = picklex.load('gASVBAAAAAAAAEsBLg==');

// Enable debug mode
// picklex.enableDebug();
// const obj = picklex.loads(data);

// Get protocol version
// const version = picklex.getProtocolVersion(data);

// Validate pickle data
// const result = picklex.validate(data);
// if (result.valid) {
//     console.log('Valid pickle, protocol:', result.protocol);
// }

// Get opcode statistics
// const stats = picklex.getOpcodeStats(data);
// console.log('Opcode usage:', stats);
*/