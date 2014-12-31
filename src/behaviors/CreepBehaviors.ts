import _ = require('lodash');
import Game = require('../world/Game');
import Behaviors = require('./Behaviors');
import World = Game.World;
import Room = Game.Room;
import Creep = Game.Creep;

export class CreepBehaviorBase implements Behaviors.WorldBehavior, Behaviors.RoomBehavior, Behaviors.CreepBehavior {

    applyWorld():void {
        this.applyCreeps(World.getOwnedCreeps());
    }

    applyRooms(rooms:Room[]):void {
        _.forEach(rooms, this.applyRoom, this);
    }

    applyRoom(room:Room):void {
        this.applyCreeps(room.getOwnedCreeps());
    }

    applyCreeps(targets:Creep[]):void {
        _.forEach(targets, this.applyCreep, this);
    }

    applyCreep(target:Creep):void {

    }
}

/** Fakes an early death by modifying the ticksToLive field and calling suicide. */
export class EarlySuicide extends CreepBehaviorBase {
    maxAge:number;

    constructor(maxAge:number) {
        super();
        this.maxAge = maxAge;
    }

    applyCreep(target:Creep):void {
        target.ticksToLive = target.instance.ticksToLive + this.maxAge - Game.Screeps.Constants.CREEP_LIFE_TIME;

        if (target.ticksToLive <= 1) {
            target.suicide();
        }
    }
}