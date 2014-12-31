import _ = require('lodash');
import Utils = require('./Utils');
import Config = require('./Configuration');
import Screeps = require('./Screeps');
declare var Game:Screeps.GameFunctions;

class Trace {

    static padding:number = 10;

    prefix:string;
    epoch:number;

    constructor(prefix?:string) {
        this.prefix = prefix || "";
        this.resetEpoch();
    }

    resetEpoch():void {
        this.epoch = this.absTime();
    }

    absTime():number {
        if (performance.now) {
            return performance.now();
        } else {
            return new Date().getTime();
        }
    }

    relTime():number {
        return this.absTime() - this.epoch;
    }

    log(level:string, message:string, color?:string):void {
        color = color || '#eee';

        var fullMessage = Utils.format('<span style="white-space: pre-wrap; color: {0};"><span class="timestamp">[{1} - {2}] [{3}]</span> {4}{5}</span>',
                                        color, Game.time, Utils.padLeft(this.relTime().toFixed(2), 6), level, this.prefix, message);

        console.log(fullMessage);
    }

    error(message:string, ...args:any[]):void {
        message = Utils.format.apply(null, arguments);
        if (this.isLoglevel('EWIDV')) {
            this.log('E', message, "#e00");
        }
    }

    warn(message:string, ...args:any[]):void {
        message = Utils.format.apply(null, arguments);
        if (this.isLoglevel('WIDV')) {
            this.log('W', message, "#ee0");
        }
    }

    info(message:string, ...args:any[]):void {
        message = Utils.format.apply(null, arguments);
        if (this.isLoglevel('IDV')) {
            this.log('I', message, "#eee");
        }
    }

    debug(message:string, ...args:any[]):void {
        message = Utils.format.apply(null, arguments);
        if (this.isLoglevel('DV')) {
            this.log('D', message, "#999");
        }
    }

    verbose(message:string, ...args:any[]):void {
        message = Utils.format.apply(null, arguments);
        if (this.isLoglevel('V')) {
            this.log('V', message, "#555");
        }
    }

    verboseObject(target:any):void {
        this.verbose("Object Dump: " + this.htmlEntities(this.dumpObject(target,3)));
    }

    private isLoglevel(loglevels:string) {
        var loglevel = Config.diagnostics.logLevel || 'I';

        return loglevels.indexOf(loglevel) >= 0;
    }

    private dumpObject(target, maxLevel:number = 3, level:number = 0) {
        var result = "";

        var padding = "";
        for (var j = 0; j < level + 1; j++) {
            padding += "    ";
        }

        switch (typeof(target)) {
            case 'undefined':
                result += "undefined";
                break;
            case 'boolean':
                result += target.toString();
                break;
            case 'number':
                result += target.toString();
                break;
            case 'string':
                result += '"' + target.toString().replace(/\r/g, '\\r').replace(/\\n/g, '\\n').replace(/"/g, '\\"') + '"';
                break;
            case 'function':
                result += "function { ... }";
                break;
            default:

                if (level >= maxLevel) {
                    return "...";
                }

                if (target.constructor == Array) {
                    result += "[\n";
                } else {
                    result += "{\n";
                }

                _.forOwn(target, (value,key) => result += Utils.format("{0} '{1}': {2},\n", padding, key, this.dumpObject(value, maxLevel, level + 1)));

                if (target.constructor === Array) {
                    result += padding + "]";
                } else {
                    result += padding + "}";
                }
                break;
        }

        return result;
    }

    private htmlEntities(str:string) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    static create(prefix?:string) {
        return new Trace(prefix);
    }
}

var trace = new Trace(Utils.repeat(' ', Trace.padding) + ': ');

export = trace;
