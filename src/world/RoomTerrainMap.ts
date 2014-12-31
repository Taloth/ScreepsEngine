import _ = require('lodash');
import Trace = require('../lib/Trace');
import Utils = require('../lib/Utils');
import Config = require('../lib/Configuration');
import Game = require('Game');
declare var Memory:any;

import World = Game.World;
import StructureType = Game.StructureType;
import Structure = Game.Structure;
import Room = Game.Room;
import LookAtResult = Game.LookAtResult;

interface TerrainResult {
    terrain:string;
    hasRoad:boolean;
    hasRampart:boolean;
    hasStructure:boolean;
    movementCost:number;
}

var RoomTerrainFlags = {
    unknown: 0x00,
    plain: 0x01,
    swamp: 0x02,
    wall: 0x03,
    hasRoad: 0x04,
    hasRampart: 0x08,
    hasStructure: 0x10
};

class RoomTerrainMap {

    private static _codeMap = Utils.encodeDuplexMap({
        0x00: 'u', // unknown
        0x01: 'p', // plain
        0x02: 's', // swamp
        0x03: 'w', // wall
        0x05: 'h', // plain road
        0x06: 'r', // swamp road
        0x09: 'd', // plain rampart
        0x0a: 't', // swamp rampart
        0x0d: 'o', // plain road rampart
        0x0e: 'f', // swamp road rampart

        // structure
        0x11: 'P', // plain
        0x12: 'S', // swamp
        0x15: 'H', // plain road
        0x16: 'R', // swamp road
        0x19: 'D', // plain rampart
        0x1a: 'T', // swamp rampart
        0x1d: 'O', // plain road rampart
        0x1e: 'F'  // swamp road rampart
    });

    room: Room;
    roomName: string;
    terrain: number[];
    dirty: boolean;

    constructor(room:Room) {
        this.room = room;
        this.roomName = room.name;
        this.terrain = new Array(50*50);
        this.dirty = false;

        var compressedMap = Memory.terrain && Memory.terrain[this.roomName];

        if (compressedMap) {
            this.uncompressMap(compressedMap);
        } else {
            for (var i = 0; i < this.terrain.length; i++) {
                this.terrain[i] = RoomTerrainFlags.unknown;
            }
        }
    }

    save():void {
        if (this.dirty) {
            Trace.debug('Saving terrain map for room {0}', this.roomName);
            if (!Memory.terrain) {
                Memory.terrain = {};
            }

            Memory.terrain[this.roomName] = this.compressMap();
            this.dirty = false;
        }
    }

    get(x:number, y:number):TerrainResult {
        var code = this.terrain[x + y * 50];
        if (code == RoomTerrainFlags.unknown) {
            var lookAtResult = this.room.lookAt(this.room.getPositionAt(x, y));
            this.update(x, y, lookAtResult);
        }

        return this.peek(x, y);
    }

    peek(x:number, y:number):TerrainResult {
        var code = this.terrain[x + y * 50];
        if (code == RoomTerrainFlags.unknown) {
            return null;
        }

        var terrain = code & 0x03;
        var structures = code & 0xfc;

        var result = {
            terrain: terrain == RoomTerrainFlags.plain ? 'plain' : terrain == RoomTerrainFlags.swamp ? 'swamp' : terrain == RoomTerrainFlags.wall ? 'wall' : null,
            hasRoad: (structures & RoomTerrainFlags.hasRoad) != 0,
            hasRampart: (structures & RoomTerrainFlags.hasRampart) != 0,
            hasStructure: (structures & RoomTerrainFlags.hasStructure) != 0,
            movementCost: 0
        };

        result.movementCost = (result.hasStructure || result.terrain == 'wall') ? 1000000 :
                               result.hasRoad ? 1 : result.terrain == 'swamp' ? 10 : 2;

        return result;
    }

    update(x:number, y:number, lookAt:LookAtResult):void {
        var terrain = lookAt.terrain == 'plain' ? RoomTerrainFlags.plain :
            lookAt.terrain == 'swamp' ? RoomTerrainFlags.swamp :
                lookAt.terrain == 'wall' ? RoomTerrainFlags.wall :
                    RoomTerrainFlags.unknown;

        if (_.some(lookAt.structures, (v:Structure) => v.structureType !== StructureType.Road && v.structureType !== StructureType.Rampart)) {
            terrain |= RoomTerrainFlags.hasStructure;
        }
        else {
            if (_.some(lookAt.structures, (v:Structure) => v.structureType == StructureType.Road)) {
                terrain |= RoomTerrainFlags.hasRoad;
            }

            if (_.some(lookAt.structures, (v:Structure) => v.structureType == StructureType.Rampart)) {
                terrain |= RoomTerrainFlags.hasRampart;
            }
        }

        if (this.terrain[x + y * 50] != terrain) {
            this.terrain[x + y * 50] = terrain;
            this.dirty = true;
        }
    }

    updateAll(forceUpdate:boolean = false, maxLookups:number = 20):number {
        var lookups = 0;
        var room = World.getRoom(this.roomName);
        for (var y = 0; y < 50; y++) {
            for (var x = 0; x < 50; x++) {
                if (forceUpdate || this.terrain[x + y * 50] == RoomTerrainFlags.unknown) {
                    lookups++;
                    if (lookups > maxLookups) {
                        return lookups;
                    }
                    var pos = room.getPositionAt(x, y);
                    var lookAt = room.lookAt(pos);
                    this.update(x, y, lookAt);
                }
            }
        }

        return lookups;
    }

    uncompressMap(compressed:string):void {
        var curIndex = 0;

        compressed = compressed.replace(/\(([^)]+)\)(\d+)/g, function (m:string, p1:string, p2:string) { return Utils.repeat(p1, parseInt(p2)); });

        for (var i = 0; i < compressed.length; i++) {
            var code = compressed[i];
            var value = parseInt(compressed.substr(i, 4), 10);

            if (isNaN(value)) {
                var codeChar = RoomTerrainMap._codeMap[code];
                if (!codeChar) {
                    Trace.error("Unexpected terrain map character '{0}'.", code);
                    return;
                }
                this.terrain[curIndex++] = codeChar;
            } else {
                if (value >= 1000) {
                    i+=3;
                } else if (value >= 100) {
                    i+=2;
                } else if (value >= 10) {
                    i+=1;
                }

                for (var j = 1; j < value; j++) {
                    this.terrain[curIndex] = this.terrain[curIndex - 1];
                    curIndex++;
                }
            }
        }
    }

    compressMap():string {
        Trace.verbose("Compressing terrain map for room {0}", this.roomName);
        var compressed = '';
        var lastCode = '';
        var lastCount = 0;

        for (var i = 0; i < this.terrain.length; i++) {
            var code = RoomTerrainMap._codeMap[this.terrain[i]];
            if (lastCode == code) {
                lastCount++;
            } else {
                if (lastCount) {
                    compressed += lastCode + (lastCount === 1 ? '' : lastCount === 2 ? lastCode : lastCount.toString());
                }
                lastCode = code;
                lastCount = 1;
            }
        }

        if (lastCount !== 0) {
            compressed += lastCode + (lastCount === 1 ? '' : lastCount === 2 ? lastCode : lastCount.toString());
        }

        compressed = compressed.replace(/([a-z][a-z0-9]+?)(\1{2,})(?!\d)/g, function (m,p1,p2) { return '(' + p1 + ')' + (1 + p2.length / p1.length) });

        Trace.verbose("Compressed terrain map for room {0}: {1}", this.roomName, compressed);
        return compressed;
    }

    static getTerrainMap(room:Room):RoomTerrainMap;
    static getTerrainMap(roomName:string):RoomTerrainMap;
    static getTerrainMap(roomName:any):RoomTerrainMap {
        var room:any;
        if (typeof roomName == 'string') {
            room = World.getRoom(roomName);
        } else {
            room = roomName;
        }

        if (!room._mixinRoomTerrainMap) {
            room._mixinRoomTerrainMap = new RoomTerrainMap(roomName);
        }
        return room._mixinRoomTerrainMap;
    }
}

export = RoomTerrainMap;