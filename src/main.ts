import _ = require('lodash');
import Config = require('lib/Configuration');
import Trace = require('lib/Trace');
import Game = require('world/Game');
import RoomTerrainMap = require('./world/RoomTerrainMap');
import World = Game.World;
import Room = Game.Room;
declare var Memory:any;

Trace.resetEpoch();
Trace.info('Starting cycle for {0}.', Game.currentPlayer.username);

// Engine.
import Engine = require('engines/tests/TestDeployCreepAssignment');

var engine = new Engine();
engine.run();

// Optional tasks

{ // Clear memory of dead creeps and spawns


    var creeps = World.getOwnedCreepsMap();
    Memory.creeps = _.omit(Memory.creeps, (v,k:string) => !creeps[k]);

    var spawns = World.getOwnedSpawnsMap();
    Memory.spawns = _.omit(Memory.spawns, (v,k:string) => !spawns[k]);
}

// Save terrain maps.
_.forEach(World.getVisibleRooms(), (room:Room) => { RoomTerrainMap.getTerrainMap(room).save(); });

// TODO: Think of a good way to divide remaining time amongst interesting tasks.

// TODO: Convert this into a behavior.
{ // Spend remaining time expanding terrain maps.
    var timeLimit = Config.game.timeLimit - 1;

    if (Trace.relTime() < timeLimit) {
        Trace.debug("Spending remaining time mapping terrain.");

        var rooms = World.getVisibleRooms();
        var index = 0;
        while (Trace.relTime() < timeLimit && index != rooms.length) {
            var terrainMap = RoomTerrainMap.getTerrainMap(rooms[index]);

            var maxLookups = (timeLimit - Trace.relTime()) / 0.4;
            var actLookups = terrainMap.updateAll(false, maxLookups);

            terrainMap.save();

            if (Math.abs(actLookups - maxLookups) > 1) {
                index++;
            }
        }
    }
}

Trace.info('Finished cycle in {0} msec.', Trace.relTime(). toFixed(3));