///<references path='../../extern/lodash.d.ts'/>
declare function require(module:string):any;
import _ = require('lodash');
export import Config = require('../lib/Configuration');
export import Trace = require('../lib/Trace');
export import Utils = require('../lib/Utils');
export import Naming = require('../lib/Naming');
export import Screeps = require('../lib/Screeps');
declare var Game:Screeps.GameFunctions;
export var Native:Screeps.GameFunctions = Game;

export import GameCode = Screeps.GameCode;
export import Direction = Screeps.Direction;
export import ExitDirection = Screeps.ExitDirection;
export import RoomFindType = Screeps.RoomFindType;
export import BodyPartType = Screeps.BodyPartType;
export import StructureType = Screeps.StructureType;

// TODO: need custom replacements for this.
export import FindOptions = Screeps.FindOptions;
export import FindPathOptions = Screeps.FindPathOptions;
export import FindClosestOptions = Screeps.FindClosestOptions;

/** Interface to inspect the World or a specific Room. These methods use caching to optimize multiple calls. */
export interface WorldInspection {
    getOwnedCreeps():Creep[];
    getOwnedCreepsMap():{ [name:string]:Creep };

    getOwnedSpawns():Spawn[];
    getOwnedSpawnsMap():{ [name:string]:Spawn };

    getOwnedStructures():Structure[];
    getOwnedStructuresMap():{ [id:string]:Structure };

    getOwnedFlags():Flag[];
    getOwnedFlagsMap():{ [name:string]:Flag };
}

export class WorldInspectionCache<TValue> {
    worldMap:{ [name:string]:TValue };
    world:TValue[];
    roomMap:{ [roomName:string]:{ [name:string]:TValue } };
    room:{ [roomName:string]:TValue[] };

    constructor(items:{ [name:string]:TValue }) {
        this.worldMap = items;
        this.world = _.values(items);
        this.room = _.groupBy(this.world, (v:any) => v.roomName || v.room.name);
        this.roomMap = _.mapValues(this.room, (v:any) => <_.Dictionary<TValue>>_.indexBy(v, (d:any) => d.name || d.id));
    }

    get(roomName?:string):TValue[] {
        return roomName ? this.room[roomName] : this.world;
    }

    getMap(roomName?:string):{ [name:string]:TValue } {
        return roomName ? this.roomMap[roomName] : this.worldMap;
    }
}

export class LookAtResult {
    instances:Screeps.LookAtResult[];

    creeps:Creep[];
    energy:Energy;
    flags:Flag[];
    exit:Exit;
    source:Source;
    spawn:Spawn;
    structures:Structure[];
    terrain:string;

    constructor(instances:Screeps.LookAtResult[]) {
        this.instances = instances;

        this.creeps = [];
        this.flags = [];
        this.structures = [];

        _.forEach(instances, (instance:Screeps.LookAtResult) => {
            if (instance.type == 'creep') {
                this.creeps.push(<Creep>World.roomObjectCache.get(instance.creep));
            } else if (instance.type == 'energy') {
                this.energy = <Energy>World.roomObjectCache.get(instance.energy);
            } else if (instance.type == 'flag') {
                this.flags.push(<Flag>World.roomObjectCache.get(instance.flag));
            } else if (instance.type == 'exit') {
                this.exit = <Exit>World.roomObjectCache.get(instance.exit);
            } else if (instance.type == 'source') {
                this.source = <Source>World.roomObjectCache.get(instance.source);
            } else if (instance.type == 'spawn') {
                this.spawn = <Spawn>World.roomObjectCache.get(instance.spawn);
            } else if (instance.type == 'structure') {
                this.structures.push(<Spawn>World.roomObjectCache.get(instance.structure));
            } else if (instance.type == 'terrain') {
                this.terrain = instance.terrain;
            } else {
                Trace.error("Room.lookAt encountered unknown type {0}, ignoring result.", instance.type);
                Trace.verboseObject(instance);
            }
        });
    }
}

class Leg {
    direction:Screeps.Direction;
    dx:number;
    dy:number;
    x:number;
    y:number;
    movementCost:number;

    constructor(step:Screeps.FindStep, movementCost:number) {
        this.direction = step.direction;
        this.dx = step.dx;
        this.dy = step.dy;
        this.x = step.x;
        this.y = step.y;
        this.movementCost = movementCost;
    }
}

export class FindPathResult {
    start:RoomPosition;
    end:RoomPosition;
    options:Screeps.FindPathOptions;
    steps:Screeps.FindStep[];

    private _movementCost:number;
    private _legs:Leg[];

    constructor(start:RoomPosition, end:RoomPosition, options:Screeps.FindPathOptions, steps:Screeps.FindStep[]) {
        this.start = start;
        this.end = end;
        this.options = options;
        this.steps = steps;
    }

    get movementCost():number {
        if (this._movementCost === void 0) {
            this.analyse();
        }

        return this._movementCost;
    }

    get legs():Leg[] {
        if (this._legs === void 0) {
            this.analyse();
        }

        return this._legs;
    }

    private analyse():void {
        this._legs = [];
        this._movementCost = 0;

        var room = World.getRoom(this.start.roomName);

        var leg:Leg;
        _.forEach(this.steps, (step:Screeps.FindStep) => {
            var movementCost = this.getMovementCost(room, step.x, step.y);
            this._movementCost += movementCost;
            if (!leg || step.direction != leg.direction) {
                leg = new Leg(step, movementCost);
                this._legs.push(leg);
            } else {
                leg.dx += step.dx;
                leg.dy += step.dy;
                leg.x = step.x;
                leg.y = step.y;
                leg.movementCost += movementCost;
            }
        });
    }

    private getMovementCost(room:Room, x:number, y:number):number {
        if (!room) {
            return void 0;
        }

        var RoomTerrainMap:any = require('./RoomTerrainMap');
        var terrainMap = RoomTerrainMap.getTerrainMap(room);

        return terrainMap.get(x, y).movementCost;
    }
}

export class Room implements WorldInspection {
    instance:Screeps.Room;

    constructor(instance:Screeps.Room) {
        this.instance = instance;
        this.name = instance.name;
    }

    /* Screeps proxy */

    /** The name of the room. */
    name:string;

    /** Create new ConstructionSite at the specified location. */
    createConstructionSite(pos:RoomPosition, structureType:StructureType): GameCode {
        var result = this.instance.createConstructionSite(pos.instance, structureType);
        return World.CheckResult(result, "Room.createConstructionSite");
    }

    /** Create new Flag at the specified location. */
    createFlag(pos:RoomPosition, name?:string): GameCode {
        var result = this.instance.createFlag(pos.instance, name);
        return World.CheckResult(result, "Room.createFlag");
    }

    /** Find all objects of the specified type in the room. */
    find(type:RoomFindType, opts?:FindOptions): RoomObject[] {
        var result = this.instance.find(type, opts);

        return _.map(result, (r) => World.roomObjectCache.get(r));
    }

    /** Find an optimal path between fromPos and toPos using A* search algorithm. */
    findPath(fromPos:RoomPosition, toPos:RoomPosition, opts?:FindPathOptions): FindPathResult {
        var result = this.instance.findPath(fromPos.instance, toPos.instance, opts);

        return new FindPathResult(fromPos, toPos, opts, result);
    }

    /** Creates a RoomPosition object at the specified location. Returns null if the position cannot be obtained. */
    getPositionAt(x:number, y:number): RoomPosition {
        return new RoomPosition(this.instance.getPositionAt(x, y));
    }

    /** Get the list of objects at the specified room position. */
    lookAt(target:RoomPosition): LookAtResult {
        var result = new LookAtResult(this.instance.lookAt(target.instance));
        //this.terrainMap.update(target.x, target.y, result);
        return result;
    }

    /** Create a room snapshot with all objects currently present in the room. Room snapshots are saved in your account so that you can later check out if something happened in the game when you were offline. Not available in the Simulation Room. */
    makeSnapshot(description?:string): void {
        this.instance.makeSnapshot(description);
    }

    /* World Inspection */

    getOwnedCreeps():Creep[] {
        return World.getOwnedCreeps(this.name);
    }
    getOwnedCreepsMap():{ [name:string]:Creep } {
        return World.getOwnedCreepsMap(this.name);
    }

    getOwnedSpawns():Spawn[] {
        return World.getOwnedSpawns(this.name);
    }
    getOwnedSpawnsMap():{ [name:string]:Spawn } {
        return World.getOwnedSpawnsMap(this.name);
    }

    getOwnedStructures():Structure[] {
        return World.getOwnedStructures(this.name);
    }
    getOwnedStructuresMap():{ [id:string]:Structure } {
        return World.getOwnedStructuresMap(this.name);
    }

    getOwnedFlags():Flag[] {
        return World.getOwnedFlags(this.name);
    }
    getOwnedFlagsMap():{ [name:string]:Flag } {
        return World.getOwnedFlagsMap(this.name);
    }

    /* Extensions */

    pos(x:number, y:number):RoomPosition {
        return this.getPositionAt(x, y);
    }
}

export interface PositionEntity {
    instance:Screeps.PositionEntity;

    pos?:RoomPosition;
    roomName?:string;
    x?:number;
    y?:number;
}

export class RoomPosition implements PositionEntity {
    instance:Screeps.RoomPosition;

    constructor(instance:Screeps.RoomPosition) {
        this.instance = instance;
        this.roomName = instance.roomName;
        this.x = instance.x;
        this.y = instance.y;
    }

    /* Screeps proxy */

    /** The name of the room. */
    roomName:string;

    /** X position in the room. */
    x:number;

    /** Y position in the room. */
    y:number;

    /** Check whether this position is the same as the specified position. */
    equalsTo(target:PositionEntity) {
        return this.instance.equalsTo(target.instance);
    }

    /** Find an object with the shortest path. */
    findClosest(type:RoomFindType, opts?:FindClosestOptions): RoomObject;
    /** Find an object with the shortest path. */
    findClosest(type:PositionEntity[], opts?:FindClosestOptions): RoomObject;
    findClosest(type:any, opts?:FindClosestOptions): RoomObject {
        var result:Screeps.RoomObject;
        if (typeof type == 'number') {
            result = this.instance.findClosest(type, opts);
        } else {
            result = this.instance.findClosest(_.pluck(type, 'instance'), opts);
        }
        return result ? World.roomObjectCache.get(result) : null;
    }

    /** Find all objects in the specified linear range. */
    findInRange(type:RoomFindType, range:number, opts?:FindOptions): RoomObject[];
    /** Find all objects in the specified linear range. */
    findInRange(type:PositionEntity[], range:number, opts?:FindOptions): RoomObject[];
    findInRange(type:any, range:number, opts?:FindOptions): RoomObject[] {
        var result:Screeps.RoomObject[];
        if (typeof type == 'number') {
            result = this.instance.findInRange(type, range, opts);
        } else {
            result = this.instance.findInRange(_.pluck(type, 'instance'), range, opts);
        }
        return _.map(result, (r) => World.roomObjectCache.get(r));
    }

    // Deprecated
    //findNearest(type:RoomFindType, opts?:FindClosestOptions): Entity;
    //findNearest(type:PositionEntity[], opts?:FindClosestOptions): Entity;

    /** Find an optimal path to the specified position */
    findPathTo(target:PositionEntity, opts?:FindPathOptions):FindPathResult {
        var pos = RoomPosition.getRoomPosition(target);
        return this.room.findPath(this, pos, opts);
    }

    /** Get linear direction to the specified position. */
    getDirectionTo(target:PositionEntity): Direction {
        return this.instance.getDirectionTo(target.instance);
    }

    /** Check whether this position is in the given range of another position. */
    inRangeTo(toPos:RoomPosition, range:number): boolean {
        return this.instance.inRangeTo(toPos.instance, range);
    }

    /** Check whether this position is on the adjacent square to the specified position. The same as inRangeTo(target, 1). */
    isNearTo(target:PositionEntity): boolean {
        return this.instance.isNearTo(target.instance);
    }

    /* Extensions */

    get room():Room {
        return World.getRoom(this.roomName);
    }

    getOffsetPosition(dx:number, dy:number):RoomPosition {
        return this.room.getPositionAt(this.x + dx, this.y + dy);
    }

    static getRoomPosition(target:PositionEntity):RoomPosition {
        return target.pos ? target.pos : <RoomPosition>target;
    }
}

export class RoomObject implements PositionEntity {
    instance:Screeps.RoomObject;

    constructor(instance:Screeps.RoomObject) {
        this.instance = instance;
        this.id = instance.id;
        this.pos = new RoomPosition(instance.pos);

    }

    /* Screeps proxy */

    /** A unique object identificator. */
    id:string;

    /** An object representing the position of this object in a room. */
    pos:RoomPosition;

    get room():Room {
        return World.roomCache.get(this.instance.room);
    }

    /* Extensions */
}

export class OwnedObject extends RoomObject {
    instance:Screeps.OwnedObject;

    constructor(instance:Screeps.OwnedObject) {
        super(instance);
        this.my = instance.my;
    }

    /* Screeps proxy */

    /** Whether it is owned by you. */
    my:boolean;

    get owner():Player {
        return World.playerCache.get(this.instance.owner);
    }

    /* Extensions */
}

export class HealthLevel {
    current:number;
    maximum:number;

    constructor(entity:Screeps.AttackableEntity) {
        this.current = entity.hits;
        this.maximum = entity.hitsMax;
    }

    get isDestroyed():boolean {
        return this.current === 0;
    }

    get isUndamaged():boolean {
        return this.current == this.maximum;
    }

    get damage():number {
        return this.maximum - this.current;
    }

    toString():string {
        return this.current + "/" + this.maximum;
    }
}

export interface AttackableEntity {
    instance:Screeps.AttackableEntity;

    health:HealthLevel;
}

export class EnergyLevel {
    current:number;
    capacity:number;

    constructor(entity:Screeps.EnergyEntity) {
        this.current = entity.energy;
        this.capacity = entity.energyCapacity;
    }

    get isEmpty():boolean {
        return this.current === 0;
    }

    get isFull():boolean {
        return this.current == this.capacity;
    }

    get free():number {
        return this.capacity - this.current;
    }

    toString():string {
        return this.current + "/" + this.capacity;
    }
}

export interface EnergyEntity {
    instance:Screeps.EnergyEntity;

    energy: EnergyLevel;
}


export class Creep extends OwnedObject implements AttackableEntity, EnergyEntity {
    instance:Screeps.Creep;

    constructor(instance:Screeps.Creep) {
        super(instance);
        this.body = instance.body;
        this.energy = new EnergyLevel(instance);
        this.fatigue = instance.fatigue;
        this.health = new HealthLevel(instance);
        this.name = instance.name;
        this.spawning = instance.spawning;
        this.ticksToLive = instance.ticksToLive;

        this.namePrefix = Naming.getNamePrefix(this.name);
    }

    toString():string {
        return "creep " + (this.name || this.id);
    }

    /* Screeps proxy */

    body: {
        /** One of the body parts constants. */
        type:Screeps.BodyPartType;
        /** The remaining amount of hit points of this body part. */
        hits:number;
    }[];

    /** The energy storage level and capacity in the creep. */
    energy:EnergyLevel;

    /** The movement fatigue indicator. If it is greater than zero, the creep cannot move. */
    fatigue:number;

    /** The amount of remaining and maximum health for the creep. */
    health:HealthLevel;

    get memory():any {
        return this.instance.memory;
    }

    /** Creep’s name. You can choose the name while creating a new creep, and it cannot be changed later. */
    name:string;

    /** Whether this creep is still being spawned. */
    spawning:boolean;

    /** The remaining amount of game ticks after which the creep will die. */
    ticksToLive:number;

    /** Attack another creep or structure in a short-ranged attack. Needs the ATTACK body part. If the target is inside a rampart, then the rampart is attacked instead. */
    attack(target:AttackableEntity): GameCode {
        var result = this.instance.attack(target.instance);
        return World.CheckResult(result, "Creep.attack");
    }

    /** Build a structure at the target construction site using carried energy. Needs WORK and CARRY body parts. The target has to be at adjacent square to the creep. */
    build(target:ConstructionSite): GameCode {
        var result = this.instance.build(target.instance);
        return World.CheckResult(result, "Creep.build");
    }

    /** Drop a piece of energy on the ground. */
    dropEnergy(amount?:number): GameCode {
        var result = this.instance.dropEnergy(amount);
        return World.CheckResult(result, "Creep.dropEnergy");
    }

    /** Get the quantity of live body parts of the given type. Fully damaged parts do not count. */
    getActiveBodyparts(type:BodyPartType): number {
        return this.instance.getActiveBodyparts(type);
    }

    /** Harvest energy from the source. Needs the WORK body part. If the creep has an empty CARRY body part, the harvested energy is put into it; otherwise it is dropped on the ground. The target has to be at adjacent square to the creep. */
    harvest(target:Source): GameCode {
        var result = this.instance.harvest(target.instance);
        return World.CheckResult(result, "Creep.harvest");
    }

    /** Heal another creep. It will restore the target creep’s damaged body parts function and increase the hits counter. Needs the HEAL body part. The target has to be at adjacent square to the creep. */
    heal(target:Creep): GameCode {
        var result = this.instance.heal(target.instance);
        return World.CheckResult(result, "Creep.heal");
    }

    /** Move the creep one square in the specified direction. Needs the MOVE body part. */
    move(direction:Direction): GameCode {
        var result = this.instance.move(direction);
        return World.CheckResult(result, "Creep.move");
    }

    /** Find the optimal path to the target within the same room and move to it. A shorthand to consequent calls of pos.findPathTo() and move() methods. Needs the MOVE body part. */
    moveTo(target:RoomPosition, opts?:FindPathOptions): GameCode {
        var result = this.instance.moveTo(target.instance, opts);
        return World.CheckResult(result, "Creep.moveTo");
    }

    /** Pick up an item (a dropped piece of energy). Needs the CARRY body part. The target has to be at adjacent square to the creep or at the same square. */
    pickup(target:Energy): GameCode {
        var result = this.instance.pickup(target.instance);
        return World.CheckResult(result, "Creep.pickup");
    }

    /** A ranged attack against another creep or structure. Needs the RANGED_ATTACK body part. If the target is inside a rampart, the rampart is attacked instead. The target has to be within 3 squares range of the creep. */
    rangedAttack(target:AttackableEntity): GameCode {
        var result = this.instance.rangedAttack(target.instance);
        return World.CheckResult(result, "Creep.rangedAttack");
    }

    /** Heal another creep at a distance. It will restore the target creep’s damaged body parts function and increase the hits counter. Needs the HEAL body part. The target has to be within 3 squares range of the creep. */
    rangedHeal(target:Creep): GameCode {
        var result = this.instance.rangedHeal(target.instance);
        return World.CheckResult(result, "Creep.rangedHeal");
    }

    /** Repair a damaged structure (spawn, extension, rampart, or road) using carried energy. Needs the WORK and CARRY body parts. The target has to be at adjacent square to the creep or at the same square. */
    repair(target:Structure): GameCode {
        var result = this.instance.repair(target.instance);
        return World.CheckResult(result, "Creep.repair");
    }

    /** Kill the creep immediately. */
    suicide(): GameCode {
        var result = this.instance.suicide();
        return World.CheckResult(result, "Creep.suicide");
    }

    /** Transfer energy from the creep to another object which can contain energy. The target has to be at adjacent square to the creep. */
    transferEnergy(target:EnergyEntity, amount?:number): GameCode {
        var result = this.instance.transferEnergy(target.instance, amount);
        return World.CheckResult(result, "Creep.transferEnergy");
    }

    /* Extensions */

    /** The prefix of the name. */
    namePrefix:string;
}

export class CreepTemplate {
    private static _bodyCodeParts = {
        'W': BodyPartType.Work,
        'M': BodyPartType.Move,
        'C': BodyPartType.Carry,
        'A': BodyPartType.Attack,
        'R': BodyPartType.RangedAttack,
        'H': BodyPartType.Heal,
        'T': BodyPartType.Tough
    };

    private static _templates = {
        'Carrier2': { bodyCode: 'CM' },
        'Carrier4': { bodyCode: 'CMCM' },

        'Miner5w': { bodyCode: 'WWWCM' },
        'Miner5c': { bodyCode: 'WWCCM' }
    };

    unitType:string;
    bodyCode:string;
    bodyTemplate:BodyPartType[];

    bodyCost:number;

    moveParts:number;
    carryParts:number;
    otherParts:number;

    spawnDelay:number;

    energyCapacity:number;

    constructor(unitType:string, bodyCode?:string) {
        var unitTemplate = CreepTemplate._templates[unitType];

        this.unitType = unitType;
        this.bodyCode = bodyCode || unitTemplate.bodyCode;
        this.bodyTemplate = CreepTemplate.getBodyTemplate(this.bodyCode);

        this.bodyCost = CreepTemplate.getBodyCost(this.bodyCode);

        this.moveParts = this.bodyCode.length - _.without(this.bodyCode, 'M').length;
        this.carryParts = this.bodyCode.length - _.without(this.bodyCode, 'C').length;
        this.otherParts = this.bodyCode.length - this.moveParts - this.carryParts;

        this.spawnDelay = Screeps.Constants.CREEP_SPAWN_TIME + this.bodyCode.length;

        this.energyCapacity = this.carryParts * Screeps.Constants.CARRY_CAPACITY;
    }

    getMoveDuration(path:FindPathResult, whileFull:boolean = false) {

        if (this.moveParts === 0) {
            return 1000000;
        }

        var weight = (this.otherParts + (whileFull ? this.carryParts : 0));

        if (weight === 0) {
            return path.steps.length;
        }

        return Math.max(1, Math.ceil(path.movementCost * weight / this.moveParts));
    }

    private static getBodyTemplate(bodyCode:string):BodyPartType[] {
        return _.map(bodyCode.split(''), CreepTemplate.convertBodyPart);
    }

    private static convertBodyPart(bodyCodePart:string):BodyPartType {
        return CreepTemplate._bodyCodeParts[bodyCodePart];
    }

    private static getBodyCost(bodyCode:string):number {
        var cost:number = 0;

        for (var i = 0; i < bodyCode.length;i++) {
            if ( i < 5) {
                var part = CreepTemplate.convertBodyPart(bodyCode.charAt(i));
                cost += Screeps.Constants.BODYPART_COST[part];
            } else {
                cost += Screeps.Constants.EXTENSION_ENERGY_COST;
            }
        }

        return cost;
    }
}

export class Structure extends OwnedObject implements AttackableEntity {
    instance:Screeps.Structure;

    constructor(instance:Screeps.Structure) {
        super(instance);
        this.health = new HealthLevel(this.instance);
        this.structureType = this.instance.structureType;
    }

    /* Screeps proxy */

    /** The amount of remaining and maximum health for the structure. */
    health:HealthLevel;

    /** Type of the structure. */
    structureType:StructureType;

    /* Extensions */
}

export class Spawn extends Structure implements EnergyEntity {
    instance:Screeps.Spawn;

    constructor(instance:Screeps.Spawn) {
        super(instance);
        this.name = instance.name;
        this.spawning = instance.spawning;
        this.energy = new EnergyLevel(instance);

        this.spawnPos = this.pos.getOffsetPosition(0,-1);
    }

    /* Screeps proxy */

    /** The energy storage level and capacity in the spawn. */
    energy:EnergyLevel;

    /** Spawn’s name. You choose the name upon creating a new spawn, and it cannot be changed later. This name is a hash key to access the spawn via the Game.spawns object. */
    name:string;

    /** A shorthand to Memory.spawns[spawn.name]. You can use it for quick access the spawn’s specific memory data object. */
    get memory():any {
        return this.instance.memory;
    }

    /** If the spawn is in process of spawning a new creep, this object will contain the new creep’s information, or null otherwise. */
    spawning:{ name:string; needTime:number; remainingTime:number; };

    /** Start the creep spawning process. */
    createCreep(creepTemplate:CreepTemplate, name:string, memory?:any): GameCode;
    createCreep(creepTemplate:CreepTemplate, memory?:any): GameCode;
    createCreep(bodyCode:string, name:string, memory?:any): GameCode;
    createCreep(bodyCode:string, memory?:any): GameCode;
    createCreep(body:BodyPartType[], name:string, memory?:any): GameCode;
    createCreep(bodyCode:string, memory?:any): GameCode;
    createCreep(body:any, name?:any, memory?:any): GameCode {
        var bodyTemplate:BodyPartType[];
        var creepName:string;
        var creepMemory:any;

        if (typeof name == 'string') {
            creepName = name;
            creepMemory = memory;
        } else if (typeof name != 'string') {
            creepName = null;
            creepMemory = name;
        }

        if (body instanceof CreepTemplate) {
            var creepTemplate = <CreepTemplate>body;
            bodyTemplate = creepTemplate.bodyTemplate;
            creepName = creepName || Naming.newName(creepTemplate.unitType);
        } else if (typeof body == 'string') {
            bodyTemplate = new CreepTemplate("Creep", body).bodyTemplate;
            creepName = creepName || Naming.newName();
        } else {
            bodyTemplate = body;
            creepName = creepName || Naming.newName();
        }

        var result = this.instance.createCreep(bodyTemplate, creepName, creepMemory);
        return World.CheckResult(result, "Spawn.createCreep");
    }

    /** Transfer the energy from the spawn to a creep. */
    transferEnergy(target:Creep, amount?:number): GameCode {
        var result = this.instance.transferEnergy(target.instance, amount);
        return World.CheckResult(result, "Spawn.transferEnergy");
    }

    /* Extensions */

    /** Position at which creeps will ordinarily spawn. */
    spawnPos:RoomPosition;
}

export class Extension extends Structure implements EnergyEntity {
    instance:Screeps.Extension;

    constructor(instance:Screeps.Extension) {
        super(instance);
        this.energy = new EnergyLevel(instance);
    }

    /* Screeps proxy */

    /** The energy storage level and capacity in the extension. */
    energy:EnergyLevel;

    /* Extensions */
}

export class ConstructionSite extends OwnedObject {
    instance:Screeps.ConstructionSite;

    constructor(instance:Screeps.ConstructionSite) {
        super(instance);
        this.progress = instance.progress;
        this.progressTotal = instance.progressTotal;
        this.structureType = instance.structureType;
        this.ticksToLive = instance.ticksToLive;
    }

    /* Screeps proxy */

    /** The current construction progress. */
    progress:number;

    /** The total construction progress needed for the structure to be built. */
    progressTotal:number;

    /** Type of the structure being built. */
    structureType:StructureType;

    /** The remaining amount of game ticks after which the construction site will decay. The counter is refreshed on each build action. */
    ticksToLive:number;

    remove(): GameCode {
        var result = this.instance.remove();
        return World.CheckResult(result, "ConstructionSite.remove");
    }

    /* Extensions */
}

export class Energy extends RoomObject {
    instance:Screeps.Energy;

    constructor(instance:Screeps.Energy) {
        super(instance);
        this.energy = instance.energy;
    }

    /* Screeps proxy */

    /** The amount of energy contained. */
    energy:number;

    /* Extensions */
}

export class Exit extends RoomObject {
    instance:Screeps.Exit;

    constructor(instance:Screeps.Exit) {
        super(instance);
        this.exit = instance.exit;
    }

    toString():string {
        return "exit " + ExitDirection[this.exit];
    }

    /* Screeps proxy */

    /** The direction of the exit */
    exit:ExitDirection;

    /* Extensions */
}

export class Flag extends RoomObject {
    instance:Screeps.Flag;

    constructor(instance:Screeps.Flag) {
        super(instance);
        this.name = instance.name;
        this.roomName = instance.roomName;

        this.namePrefix = Naming.getNamePrefix(instance.name);
    }

    toString():string {
        return "flag " + this.name;
    }

    /* Screeps proxy */

    /** Flag’s name. You can choose the name while creating a new flag, and it cannot be changed later. This name is a hash key to access the spawn via the Game.flags object. */
    name:string;

    /** The name of the room in which this flag is in. May be required if the flag is placed in a room which you do not have access to. */
    roomName:string;

    /** Remove the flag. */
    remove(): GameCode {
        var result = this.instance.remove();
        return World.CheckResult(result, 'Flag.remove');
    }

    /* Extensions */

    /** Returns the prefix of the name. */
    namePrefix:string;
}

export class Source extends RoomObject implements EnergyEntity {
    instance:Screeps.Source;

    constructor(instance:Screeps.Source) {
        super(instance);
        this.energy = new EnergyLevel(instance);
        this.ticksToRegeneration = instance.ticksToRegeneration;
    }

    /* Screeps proxy */

    /** The energy storage level and capacity in the source. */
    energy:EnergyLevel;

    /** The remaining time after which the source will be refilled. */
    ticksToRegeneration:number;

    /* Extensions */
}

/** The idea behind this class it to serve a central point for tracking other players. Statistics, known territories, average team sizes/strengths and strategy analysis.
 *  That way you can tailor defenses and strategies accordingly.
 *  For example, you need to build adequate defenses against a player known to blob & siege, but a roaming defense force
 *  might be suffice against nearby starter players, allowing you to focus on resources.
 **/
export class Player {
    instance:Screeps.Owner;

    constructor(instance:Screeps.Owner) {
        this.instance = instance;
        this.username = instance.username;
    }

    /* Screeps proxy */

    username:string;

    /* Extensions */

    /** Returns whether the other player is friendly. Just a thought about alliances/cease-fires */
    get isFriendly():boolean {
        return false; // TODO
    }
}

/** This class provides caching and helper functions */
class WorldInternal implements WorldInspection {
    playerCache:Utils.CacheProvider<Screeps.Owner,Player>;
    roomCache:Utils.CacheProvider<Screeps.Room,Room>;
    roomObjectCache:Utils.CacheProvider<Screeps.RoomObject,RoomObject>;

    private _ownedCreeps:WorldInspectionCache<Creep>;
    private _ownedSpawns:WorldInspectionCache<Spawn>;
    private _ownedStructures:WorldInspectionCache<Structure>;
    private _ownedFlags:WorldInspectionCache<Flag>;

    private _spawnRooms:Room[];
    private _visibleRooms:Room[];

    warnOnError:boolean = true;
    breakOnError:boolean = true;
    throwOnError:boolean = false;

    constructor() {
        this.playerCache = new Utils.CacheProvider<Screeps.Owner, Player>((owner:Screeps.Owner) => owner.username, (k:Screeps.Owner) => new Player(k));
        this.roomCache = new Utils.CacheProvider<Screeps.Room, Room>((room:Screeps.Room) => room.name, (r:Screeps.Room) => new Room(r));
        this.roomObjectCache = new Utils.CacheProvider<Screeps.RoomObject, RoomObject>((t:Screeps.RoomObject) => t.id, WorldInternal.loadRoomObject);
    }

    preloadCaches():void {
        this._ownedCreeps = new WorldInspectionCache<Creep>(_.mapValues(Game.creeps, (creep) => <Creep>this.roomObjectCache.get(creep)));
        this._ownedSpawns = new WorldInspectionCache<Spawn>(_.mapValues(Game.spawns, (spawn) => <Spawn>this.roomObjectCache.get(spawn)));
        this._ownedStructures = new WorldInspectionCache<Structure>(_.mapValues(Game.structures, (structure) => <Structure>this.roomObjectCache.get(structure)));
        this._ownedFlags = new WorldInspectionCache<Flag>(_.mapValues(Game.flags, (flag) => <Flag>this.roomObjectCache.get(flag)));
    }

    private static loadRoomObject(roomObject:Screeps.RoomObject):RoomObject {
        var target:any = roomObject;

        // Identify the object type
        if (target.structureType) {
            if (target.ticksToLive && target.remove) {
                return new ConstructionSite(target);
            }
            switch (target.structureType) {
                case Screeps.StructureType.Extension:
                    return new Extension(target);
                case Screeps.StructureType.Spawn:
                    return new Spawn(target);
                default:
                    return new Structure(target);
            }
        } else if (target.body && target.suicide) {
            return new Creep(target);
        } else if (target.ticksToRegeneration) {
            return new Source(target);
        } else if (target.exit) {
            return new Exit(target);
        } else if (target.energy) {
            return new Energy(target);
        } else if (target.name && target.roomName && target.remove) {
            return new Flag(target);
        }

        debugger;
        throw new Error("Unknown RoomObject");
    }

    getOwnedCreeps(roomName?:string):Creep[] {
        if (!this._ownedCreeps) {
            this.preloadCaches();
        }

        return this._ownedCreeps.get(roomName);
    }

    getOwnedCreepsMap(roomName?:string):{ [name:string]:Creep } {
        if (!this._ownedCreeps) {
            this.preloadCaches();
        }

        return this._ownedCreeps.getMap(roomName);
    }

    getOwnedSpawns(roomName?:string):Spawn[] {
        if (!this._ownedSpawns) {
            this.preloadCaches();
        }

        return this._ownedSpawns.get(roomName);
    }

    getOwnedSpawnsMap(roomName?:string):{ [name:string]:Spawn } {
        if (!this._ownedSpawns) {
            this.preloadCaches();
        }

        return this._ownedSpawns.getMap(roomName);
    }

    getOwnedStructures(roomName?:string):Structure[] {
        if (!this._ownedStructures) {
            this.preloadCaches();
        }

        return this._ownedStructures.get(roomName);
    }

    getOwnedStructuresMap(roomName?:string):{ [name:string]:Structure } {
        if (!this._ownedStructures) {
            this.preloadCaches();
        }

        return this._ownedStructures.getMap(roomName);
    }

    getOwnedFlags(roomName?:string):Flag[] {
        if (!this._ownedFlags) {
            this.preloadCaches();
        }

        return this._ownedFlags.get(roomName);
    }

    getOwnedFlagsMap(roomName?:string):{ [name:string]:Flag } {
        if (!this._ownedFlags) {
            this.preloadCaches();
        }

        return this._ownedFlags.getMap(roomName);
    }


    /** Returns only the Rooms which contain an owned Spawn. */
    getSpawnRooms():Room[] {
        if (!this._spawnRooms) {
            this._spawnRooms = _.uniq(_.pluck(this.getOwnedSpawns(), 'room'));
        }

        return this._spawnRooms;
    }

    /** Returns all the Rooms that are visible by Spawns, Creeps and Structures. */
    getVisibleRooms():Room[] {
        if (!this._visibleRooms) {
            var rooms:Room[] = [].concat(
                _.map(this.getOwnedSpawns(), (v) => v.room),
                _.map(this.getOwnedCreeps(), (v) => v.room),
                _.map(this.getOwnedStructures(), (v) => v.room));

            this._visibleRooms = _.uniq(rooms);
        }

        return this._visibleRooms;
    }

    getRoom(roomName:string):Room {
        var room = this.roomCache.tryGet(roomName);

        if (room) {
            return room;
        }

        var gameRoom = Game.getRoom(roomName);

        if (!gameRoom) {
            return null;
        }

        room = new Room(gameRoom);

        this.roomCache.set(room.name, room);

        return room;
    }

    CheckResult(result:GameCode, caller:string = "unknown"):GameCode {
        if (typeof result == 'number' && result < 0) {
            var message = Utils.format("API call {0} returned {1}.", caller, GameCode[result]);
            if (Config.diagnostics.onGameError == Config.BreakpointType.Warn) {
                Trace.warn(message);
            } else if (Config.diagnostics.onGameError == Config.BreakpointType.Break) {
                Trace.warn(message);
                debugger;
            } else if (Config.diagnostics.onGameError == Config.BreakpointType.Throw) {
                Trace.warn(message);
                debugger;
                throw new Error(message);
            }
        }
        return result;
    }
}

export var World = new WorldInternal();

World.preloadCaches();

export var currentPlayer:Player;

var ownedObject:OwnedObject = World.getOwnedCreeps()[0] || World.getOwnedSpawns()[0] || World.getOwnedStructures()[0];
if (ownedObject) {
    currentPlayer = ownedObject.owner;
} else {
    currentPlayer = new Player({ username: '[unknown player]' });
}