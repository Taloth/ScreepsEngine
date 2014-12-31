import _ = require('lodash');
import Screeps = require('./Screeps');
declare var Memory:any;

if (!Memory.config) {
    Memory.config = {};
}

export enum BreakpointType {
    None = <any>'none',
    Warn = <any>'warn',
    Break = <any>'break',
    Throw = <any>'throw'
}

export interface Configuration {
    game: {
        timeLimit:number
    };
    diagnostics: {
        logLevel:string;
        onGameError:BreakpointType;
    };
}

var defaultsDeep = _.partialRight(_.merge, function deep(value, other) {
    return _.merge(value, other, deep);
});

defaultsDeep(Memory.config, {
    game: {
        timeLimit: 30
    },
    diagnostics: {
        logLevel: 'I',
        onGameError: BreakpointType.Break
    }
});

export var config:Configuration = Memory.config;

export var game = config.game;

export var diagnostics = config.diagnostics;