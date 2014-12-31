import _ = require('lodash');

/*  Written by Taloth Saldono (https://github.com/Taloth/)
    Inspired by work done by Ravadre (https://github.com/Ravadre/Screeps.Typescript)
    See http://screeps.com/docs for the official screeps documentation.
    - Updated to 2014-12-07 changes
    - Updated to 2014-12-18 changes
    - Updated to 2014-12-22 changes
 */

export enum GameCode {
    OK = 0,
    NotOwner = -1,
    NoPath = -2,
    NameExists = -3,
    Busy = -4,
    NotFound = -5,
    NotEnoughEnergy = -6,
    InvalidTarget = -7,
    Full = -8,
    NotInRange = -9,
    InvalidArgs = -10,
    Tired = -11,
    NoBodyPart = -12,
    NotEnoughExtensions = -13
}

export enum RoomFindType {
    Creeps = 1,
    MyCreeps = 2,
    HostileCreeps = 3,
    SourcesActive = 4,
    Sources = 5,
    DroppedEnergy = 6,
    Structures = 7,
    MyStructures = 8,
    HostileStructures = 9,
    Flags = 10,
    ConstructionSites = 11,
    MySpawns = 12,
    HostileSpawns = 13,
    ExitTop = 14,
    ExitRight = 15,
    ExitBottom = 16,
    ExitLeft = 17
}

export enum Direction {
    Top = 1,
    TopRight = 2,
    Right = 3,
    BottomRight = 4,
    Bottom = 5,
    BottomLeft = 6,
    Left = 7,
    TopLeft = 8
}

export enum ExitDirection {
    Top = 1,
    Right = 3,
    Bottom = 5,
    Left = 7
}

// Please note the '<any>' is a hack to cheat the ts compiler to accept string enums.
export enum BodyPartType {
    Work = <any>Game.WORK,
    Move = <any>Game.MOVE,
    Carry = <any>Game.CARRY,
    Attack = <any>Game.ATTACK,
    RangedAttack = <any>Game.RANGED_ATTACK,
    Heal = <any>Game.HEAL,
    Tough = <any>Game.TOUGH
}

export enum StructureType {
    Extension = <any>Game.STRUCTURE_EXTENSION,
    Rampart = <any>Game.STRUCTURE_RAMPART,
    Road = <any>Game.STRUCTURE_ROAD,
    Spawn = <any>Game.STRUCTURE_SPAWN,
    Wall = <any>Game.STRUCTURE_WALL
}

export enum PathfindingAlgorithm {
    AStar = <any>'astar',
    Dijkstra = <any>'dijkstra'
}

export interface PathfindingOptions {
    ignoreCreeps?: boolean;
    ignoreDestructibleStructures?: boolean;
    withinRampartsOnly?: boolean;
    ignore?:any[]; // Entity/RoomPosition[] Walkable
    avoid?:any[]; // Entity/RoomPosition[] Obstacle
    maxOps?: number;
    heuristicWeight?: number;
}

export interface FilterOptions extends PathfindingOptions {
    filter?(target:RoomObject);
}

export interface PathfindingAlgorithmOptions {
    algorithm?:PathfindingAlgorithm;
}

export interface FindOptions extends FilterOptions {

}

export interface FindPathOptions extends PathfindingOptions {

}

export interface FindClosestOptions extends PathfindingOptions, FilterOptions, PathfindingAlgorithmOptions {

}

export interface FindStep {
    x: number;
    y: number;
    dx: number;
    dy: number;
    direction: Direction;
}

export interface LookAtResult {
    type:string;
    creep?:Creep;
    energy?:Energy;
    flag?:Flag;
    exit?:Exit;
    source?:Source;
    spawn?:Spawn;
    structure?:Structure;
    terrain?:string;
}

/** An object with the creep’s owner info. */
export interface Owner {
    /** The name of the owner user. */
    username: string;
}

/** Represents a RoomPosition or an object containing a RoomPosition. */
export interface PositionEntity {
    pos?:RoomPosition;
    roomName?:string;
    x?:number;
    y?:number;
}

export interface RoomObject extends PositionEntity {
    /** A unique object identificator. */
    id: string;

    /** An object representing the position of this creep in a room. */
    pos: RoomPosition;

    /** The link to the Room object of this creep. */
    room: Room;
}

export interface OwnedObject extends RoomObject {
    /** Whether it is your creep or foe. */
    my: boolean;

    /** An object with the creep’s owner info. */
    owner: Owner;
}

export interface AttackableEntity {
    /** The current amount of hit points of the entity. */
    hits: number;

    /** The maximum amount of hit points of the entity. */
    hitsMax: number;
}

export interface EnergyEntity {
    /** The amount of energy containing in the entity. */
    energy: number;

    /** The total amount of energy the entity can contain */
    energyCapacity: number;
}

/* Actual objects returned by the various api calls */

/** @see {@link http://screeps.com/docs/ConstructionSite.php|Screeps Documentation} */
export interface ConstructionSite extends OwnedObject {
    progress: number;
    progressTotal: number;
    structureType: StructureType;
    ticksToLive: number;

    remove(): GameCode;
}

/** @see {@link http://screeps.com/docs/Creep.php|Screeps Documentation} */
export interface Creep extends OwnedObject, AttackableEntity, EnergyEntity {
    /** Creep’s name. You can choose the name while creating a new creep, and it cannot be changed later. This name is a hash key to access the creep via the Game.creeps object. */
    name: string;

    /** A shorthand to Memory.creeps[creep.name]. You can use it for quick access the creep’s specific memory data object. */
    memory: any;

    /** Whether this creep is still being spawned. */
    spawning: boolean;

    /** An array describing the creep’s body. */
    body: {
        /** One of the body parts constants. */
        type: BodyPartType;
        /** The remaining amount of hit points of this body part. */
        hits: number;
    }[];

    /** The amount of energy containing in the creep. */
    energy: number;

    /** The total amount of energy the creep can contain */
    energyCapacity: number;

    /** The remaining amount of game ticks after which the creep will die. */
    ticksToLive: number;

    /** The movement fatigue indicator. If it is greater than zero, the creep cannot move. */
    fatigue: number;

    /** Attack another creep or structure in a short-ranged attack. Needs the ATTACK body part. If the target is inside a rampart, then the rampart is attacked instead. */
    attack(target:AttackableEntity): GameCode;

    /** Build a structure at the target construction site using carried energy. Needs WORK and CARRY body parts. The target has to be at adjacent square to the creep. */
    build(target:ConstructionSite): GameCode;

    /** Drop a piece of energy on the ground. */
    dropEnergy(amount?:number): GameCode;

    /** Get the quantity of live body parts of the given type. Fully damaged parts do not count. */
    getActiveBodyparts(type:BodyPartType): number;

    /** Harvest energy from the source. Needs the WORK body part. If the creep has an empty CARRY body part, the harvested energy is put into it; otherwise it is dropped on the ground. The target has to be at adjacent square to the creep. */
    harvest(target:Source): GameCode;

    /** Heal another creep. It will restore the target creep’s damaged body parts function and increase the hits counter. Needs the HEAL body part. The target has to be at adjacent square to the creep. */
    heal(target:Creep): GameCode;

    /** Move the creep one square in the specified direction. Needs the MOVE body part. */
    move(direction:Direction): GameCode;

    /** Find the optimal path to the target within the same room and move to it. A shorthand to consequent calls of pos.findPathTo() and move() methods. Needs the MOVE body part. */
    moveTo(x:number, y:number): GameCode;
    /** Find the optimal path to the target within the same room and move to it. A shorthand to consequent calls of pos.findPathTo() and move() methods. Needs the MOVE body part. */
    moveTo(target:PositionEntity, opts?:FindPathOptions): GameCode;

    /** Pick up an item (a dropped piece of energy). Needs the CARRY body part. The target has to be at adjacent square to the creep or at the same square. */
    pickup(target:Energy): GameCode;

    /** A ranged attack against another creep or structure. Needs the RANGED_ATTACK body part. If the target is inside a rampart, the rampart is attacked instead. The target has to be within 3 squares range of the creep. */
    rangedAttack(target:AttackableEntity): GameCode;

    /** Heal another creep at a distance. It will restore the target creep’s damaged body parts function and increase the hits counter. Needs the HEAL body part. The target has to be within 3 squares range of the creep. */
    rangedHeal(target:Creep): GameCode;

    /** Repair a damaged structure (spawn, extension, rampart, or road) using carried energy. Needs the WORK and CARRY body parts. The target has to be at adjacent square to the creep or at the same square. */
    repair(target:Structure): GameCode;

    /** Kill the creep immediately. */
    suicide(): GameCode;

    /** Transfer energy from the creep to another object which can contain energy. The target has to be at adjacent square to the creep. */
    transferEnergy(target:EnergyEntity, amount?:number): GameCode;
}

/** @see {@link http://screeps.com/docs/Energy.php|Screeps Documentation} */
export interface Energy extends RoomObject {
    /** The amount of energy contained. */
    energy: number;
}

/** @see {@link http://screeps.com/docs/Exit.php|Screeps Documentation} */
export interface Exit extends RoomObject {
    /** The direction of the exit */
    exit: ExitDirection;
}

/** @see {@link http://screeps.com/docs/Flag.php|Screeps Documentation} */
export interface Flag extends RoomObject {
    /** Flag’s name. You can choose the name while creating a new flag, and it cannot be changed later. This name is a hash key to access the spawn via the Game.flags object. */
    name: string;

    /** The name of the room in which this flag is in. May be required if the flag is placed in a room which you do not have access to. */
    roomName: string;

    /** Remove the flag. */
    remove(): GameCode;
}

/** @see {@link http://screeps.com/docs/Room.php|Screeps Documentation} */
export interface Room {
    /** The name of the room. */
    name: string;

    /** Create new ConstructionSite at the specified location. */
    createConstructionSite(x:number, y:number, structureType:StructureType): GameCode;
    /** Create new ConstructionSite at the specified location. */
    createConstructionSite(pos:PositionEntity, structureType:StructureType): GameCode;

    /** Create new Flag at the specified location. */
    createFlag(x:number, y:number, name?:string): GameCode;
    /** Create new Flag at the specified location. */
    createFlag(pos:PositionEntity, name?:string): GameCode;

    /** Find all objects of the specified type in the room. */
    find(type:RoomFindType, opts?:FindOptions): RoomObject[];

    /** Find an optimal path between fromPos and toPos using A* search algorithm. */
    findPath(fromPos:RoomPosition, toPos:RoomPosition, opts?:FindPathOptions): FindStep[];

    /** Creates a RoomPosition object at the specified location. Returns null if the position cannot be obtained. */
    getPositionAt(x:number, y:number): RoomPosition;

    /** Get the list of objects at the specified room position. */
    lookAt(x:number, y:number): LookAtResult[];
    /** Get the list of objects at the specified room position. */
    lookAt(target:PositionEntity): LookAtResult[];

    /** Create a room snapshot with all objects currently present in the room. Room snapshots are saved in your account so that you can later check out if something happened in the game when you were offline. Not available in the Simulation Room. */
    makeSnapshot(description?:string): void;
}

/** @see {@link http://screeps.com/docs/RoomPosition.php|Screeps Documentation} */
export interface RoomPosition extends PositionEntity {
    /** The name of the room. */
    roomName: string;
    /** X position in the room. */
    x: number;
    /** Y position in the room. */
    y: number;

    /** Check whether this position is the same as the specified position. */
    equalsTo(x:number, y:number): boolean;
    /** Check whether this position is the same as the specified position. */
    equalsTo(target:PositionEntity): boolean;

    /** Find an object with the shortest path. */
    findClosest(type:RoomFindType, opts?:FindClosestOptions): RoomObject;
    /** Find an object with the shortest path. */
    findClosest(type:PositionEntity[], opts?:FindClosestOptions): RoomObject;

    /** Find all objects in the specified linear range. */
    findInRange(type:RoomFindType, range:number, opts?:FindOptions): RoomObject[];
    /** Find all objects in the specified linear range. */
    findInRange(type:PositionEntity[], range:number, opts?:FindOptions): RoomObject[];

    // Deprecated
    //findNearest(type:RoomFindType, opts?:FindClosestOptions): Entity;
    //findNearest(type:PositionEntity[], opts?:FindClosestOptions): Entity;

    /** Find an optimal path to the specified position */
    findPathTo(x:number, y:number): FindStep[];
    /** Find an optimal path to the specified position */
    findPathTo(target:PositionEntity, opts?:FindPathOptions): FindStep[];

    /** Get linear direction to the specified position. */
    getDirectionTo(x:number, y:number): Direction;
    /** Get linear direction to the specified position. */
    getDirectionTo(target:PositionEntity): Direction;

    /** Check whether this position is in the given range of another position. */
    inRangeTo(toPos:RoomPosition, range:number): boolean;

    /** Check whether this position is on the adjacent square to the specified position. The same as inRangeTo(target, 1). */
    isNearTo(x:number, y:number): boolean;
    /** Check whether this position is on the adjacent square to the specified position. The same as inRangeTo(target, 1). */
    isNearTo(target:PositionEntity): boolean;
}

/** @see {@link http://screeps.com/docs/Source.php|Screeps Documentation} */
export interface Source extends RoomObject, EnergyEntity {
    /** The remaining amount of energy. */
    energy: number;

    /** The total amount of energy in the source. Equals to 3000 in most cases. */
    energyCapacity: number;

    /** The remaining time after which the source will be refilled. */
    ticksToRegeneration: number;
}

/** @see {@link http://screeps.com/docs/Spawn.php|Screeps Documentation} */
export interface Spawn extends Structure, EnergyEntity {
    /** Spawn’s name. You choose the name upon creating a new spawn, and it cannot be changed later. This name is a hash key to access the spawn via the Game.spawns object. */
    name: string;

    /** A shorthand to Memory.spawns[spawn.name]. You can use it for quick access the spawn’s specific memory data object. */
    memory: any;

    /** If the spawn is in process of spawning a new creep, this object will contain the new creep’s information, or null otherwise. */
    spawning?: {
        name: string;
        needTime: number;
        remainingTime: number;
    }

    /** The amount of energy containing in the spawn. */
    energy: number;

    /** The total amount of energy the spawn can contain */
    energyCapacity: number;

    /** Start the creep missions process. */
    createCreep(body:BodyPartType[], name?:string, memory?:any): GameCode;

    /** Transfer the energy from the spawn to a creep. */
    transferEnergy(target:Creep, amount?:number): GameCode;
}

/** @see {@link http://screeps.com/docs/Structure.php|Screeps Documentation} */
export interface Structure extends OwnedObject, AttackableEntity {
    /** Type of this structure. */
    structureType: StructureType;
}

/** @see {@link http://screeps.com/docs/Structure.php#energy|Screeps Documentation} */
export interface Extension extends Structure, EnergyEntity {
    /** The amount of energy containing in the extension. */
    energy: number;

    /** The total amount of energy the extension can contain */
    energyCapacity: number;
}

/** @see {@link http://screeps.com/docs/Game.php|Screeps Documentation} */
export interface GameFunctions {
    creeps: { [name: string]: Creep };
    flags: { [name: string]: Flag };
    spawns: { [name: string]: Spawn };
    structures: { [name: string]: Structure };

    /** System game tick counter. It is automatically incremented on every tick. */
    time: number;

    /** Get an object with the specified unique ID. It may be a game object of any type. Only objects from the rooms which are visible to you can be accessed. */
    getObjectById(id:string): RoomObject;
    /** Get an instance object of the specified room. You can gain access to a room only if you have a creep, spawn, or extension within it. */
    getRoom(name:string): Room;

    /** Send a custom message at your profile email. This way, you can set up notifications to yourself on any occasion within the game. Not available in the Simulation Room. */
    notify(message:string): void;
}

export interface GameConstants {
    WORK: string;
    MOVE: string;
    CARRY: string;
    ATTACK: string;
    RANGED_ATTACK: string;
    HEAL: string;
    TOUGH: string;

    STRUCTURE_EXTENSION: string;
    STRUCTURE_RAMPART: string;
    STRUCTURE_ROAD: string;
    STRUCTURE_SPAWN: string;
    STRUCTURE_WALL: string;
}

export interface Game extends GameFunctions, GameConstants {

}

declare var Game:GameConstants;

/* UNOFFICIAL */

export var Constants = {
    CREEP_SPAWN_TIME: 9,
    CREEP_LIFE_TIME: 1800,
    ENERGY_REGEN_TIME: 300,
    ENERGY_REGEN_AMOUNT: 3000,
    ENERGY_DECAY: 1,
    CREEP_CORPSE_RATE: 0.2,
    REPAIR_COST: 0.1,
    RAMPART_DECAY_AMOUNT: 1,
    RAMPART_DECAY_TIME: 30,
    RAMPART_HITS: 1500,
    SPAWN_HITS: 5000,
    SPAWN_ENERGY_START: 1000,
    SPAWN_ENERGY_CAPACITY: 6000,
    SOURCE_ENERGY_CAPACITY: 3000,
    ROAD_HITS: 300,
    WALL_HITS: 2000,
    EXTENSION_HITS: 1000,
    EXTENSION_ENERGY_CAPACITY: 200,
    EXTENSION_ENERGY_COST: 200,
    CONSTRUCTION_DECAY_TIME: 3600,
    ROAD_WEAROUT: 1,
    BODYPART_COST: {
        move: 50,
        work: 20,
        attack: 80,
        carry: 50,
        heal: 200,
        ranged_attack: 150,
        tough: 5
    },
    CARRY_CAPACITY: 50,
    HARVEST_POWER: 2,
    REPAIR_POWER: 20,
    BUILD_POWER: 5,
    ATTACK_POWER: 30,
    RANGED_ATTACK_POWER: 10,
    HEAL_POWER: 12,
    RANGED_HEAL_POWER: 4,
    CONSTRUCTION_COST: {
        spawn: 5000,
        extension: 3000,
        road: 300,
        constructedWall: 500,
        rampart: 2000
    },
    CONSTRUCTION_COST_ROAD_SWAMP_RATIO: 5
};

// Load the actual constants from the Game object
_.forEach(Constants, (v,key) => {
    if (Game[key]) {
        Constants[key] = Game[key];
    } else {
        console.log('Game.' + key + ' does not exist, using default value.');
    }
});