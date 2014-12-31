import _ = require('lodash');
import Screeps = require('./Screeps');
declare var Game:Screeps.GameFunctions;
declare var Memory:any;

class Naming {
    private _reservedNames:{ [name:string]: string } = {};

    newName(prefix:string = 'Creep'):string {
        var naming = Memory.naming || (Memory.naming = {});

        var lastId = naming[prefix] || 0;

        var nextName:string;

        do {
            lastId++;
            nextName = prefix + '-' + lastId;
        }
        while (Game.creeps[nextName] || Game.flags[nextName] || Game.spawns[nextName] || this._reservedNames[nextName]);

        naming[prefix] = lastId;

        this._reservedNames[nextName] = nextName;

        return nextName;
    }

    getNamePrefix(name:string):string {
        return name.replace(/^([a-z0-9]+?)(?:-.*|\d+)$/ig, '$1');
    }
}

var naming = new Naming();

export = naming;

