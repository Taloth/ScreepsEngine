import _ = require('lodash');
import Game = require('../world/Game');
import World = Game.World;
import Room = Game.Room;
import Creep = Game.Creep;

export interface WorldBehavior {
    applyWorld():void;
}

export interface RoomBehavior {
    applyRooms(rooms:Room[]):void;
    applyRoom(room:Room):void;
}

export interface CreepBehavior {
    applyCreeps(creeps:Creep[]):void;
    applyCreep(creep:Creep):void;
}