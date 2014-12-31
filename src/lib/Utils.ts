import _ = require('lodash');

export function format(format:string, ...replacements:any[]):string {
    return format.replace(/{(\d+)}/g, function (match, number) {
        return replacements[number] === void 0 ? 'undefined' : replacements[number];
    });
}
export function repeat(str:string, length:number): string {
    return new Array(length + 1).join(str);
}

export function padLeft(subject:string, length:number, pad?:string):string {
    return Array(Math.max(0, length - subject.length + 1)).join(pad || ' ') + subject;
}

export function padRight(subject:string, length:number, pad?:string):string {
    return subject + Array(Math.max(0, length - subject.length + 1)).join(pad || " ");
}

export function encodeDuplexMap(t:{}):{} {
    _.forOwn(t, (v,k) => t[v] = k);
    return t;
}

export class CacheProvider<TKey,TValue> {
    private _cache:{ [id:string]: TValue };
    private _keySelector:(key:TKey) => string;
    private _factory:(key:TKey, id?:string) => TValue;

    constructor(keySelector:(key:TKey) => string, factory:(key:TKey, id?:string) => TValue) {
        this._cache = {};
        this._keySelector = keySelector;
        this._factory = factory;
    }

    all():TValue[] {
        return _.values(this._cache);
    }

    set(id:string, value:TValue) {
        this._cache[id] = value;
    }

    tryGet(id:string):TValue {
        return this._cache[id];
    }

    get(key:TKey):TValue {
        var id = this._keySelector(key);
        var value = this._cache[id];

        if (value === void 0) {
            this._cache[id] = value = this._factory(key, id);
        }

        return value;
    }
}