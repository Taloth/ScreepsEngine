import _ = require('lodash');
import Trace = require('../../lib/Trace');
import Game = require('../../world/Game');
import Engine = require('../Engine');
import CreepBehaviors = require('../../behaviors/CreepBehaviors');
import DeployCreepAssignment = require('../../missions/DeployCreepAssignment');
import World = Game.World;
import Room = Game.Room;
import Flag = Game.Flag;
import Spawn = Game.Spawn;
import Creep = Game.Creep;

/** For each Flag 'SpawnTest1', this engine will create a DeployCreepAssignment and ensure a Carrier4 creep is deployed,
 *  it will replace the creep in a timely manner to ensure as little 'downtime' as possible.
 **/
class TestEngine extends Engine.EngineBase {
    creepTemplate = new Game.CreepTemplate('Carrier4');

    run():void {

        // We're testing respawn logic, so I rather have these creeps die quickly.
        new CreepBehaviors.EarlySuicide(50).applyWorld();

        _.forEach(World.getSpawnRooms(), this.processRoom, this);
    }

    processRoom(room:Room):void {
        var spawns = room.getOwnedSpawns();
        var creeps = room.getOwnedCreeps();
        var flags = room.getOwnedFlags();

        // Create assignments
        var assignments = _(flags)
            .where({ namePrefix: 'SpawnTest' })
            .map((flag:Flag) => new DeployCreepAssignment('deployCreep-flag-' + flag.id, flag.pos))
            .indexBy('assignmentId')
            .value();

        // Creep assignment housekeeping.
        _.forEach(creeps, (creep:Creep) => {
            if (creep.memory.currentAssignment && !assignments[creep.memory.currentAssignment]) {
                creep.memory.currentAssignment = undefined;
            }
        });

        var freeCreeps = _.filter(creeps, (creep:Creep) => !creep.memory.currentAssignment);
        var creepIndex = _.groupBy(creeps, (creep:Creep) => creep.memory.currentAssignment);

        _.forEach(assignments, (assignment:DeployCreepAssignment) => {
            Trace.debug('Checking {0}.', assignment.assignmentId);

            var spawnPath = _(spawns)
                .map((spawn:Spawn) => ({ spawn: spawn, path: spawn.spawnPos.findPathTo(assignment.deployPos, { ignoreCreeps: true }) }))
                .sortBy((v) => v.path.movementCost)
                .first();
            var spawn = spawnPath.spawn;
            var path = spawnPath.path;

            var curCreeps:Creep[] = creepIndex[assignment.assignmentId] || (creepIndex[assignment.assignmentId] = []);

            var ticksToLive = _(curCreeps).pluck<number>('ticksToLive').max().value();
            var activeCreep = _.where(curCreeps, (creep:Creep) => creep.pos.equalsTo(assignment.deployPos))[0];

            Trace.debug('{0} creeps, ticksToLive={1} active={2} spawnPath={3}', curCreeps.length, ticksToLive, activeCreep, path.movementCost);

            var spawnDeployDelay = this.creepTemplate.getMoveDuration(path) + this.creepTemplate.spawnDelay;

            var creepDeploy = _(freeCreeps)
                .map((v:Creep) => {
                    var path = v.pos.findPathTo(assignment.deployPos, { ignoreCreeps: true });
                    return { creep: v, path: path, moveDuration: this.creepTemplate.getMoveDuration(path) };
                })
                .sortBy('moveDuration')
                .first();

            var deployDelay = creepDeploy ? Math.max(spawnDeployDelay, creepDeploy.moveDuration) : spawnDeployDelay;

            if (ticksToLive <= deployDelay) {
                if (creepDeploy) {
                    creepDeploy.creep.memory.currentAssignment = assignment.assignmentId;
                    _.remove(freeCreeps, (c:Creep) => c.name == creepDeploy.creep.name);
                    curCreeps.push(creepDeploy.creep);
                } else if (!spawn.spawning) {
                    spawn.createCreep(this.creepTemplate, { currentAssignment: assignment.assignmentId });
                }
            }

            _.forEach(curCreeps, (curCreep:Creep) => {
                if (!curCreep.pos.equalsTo(assignment.deployPos) && !curCreep.spawning) {
                    if (curCreep.pos.isNearTo(assignment.deployPos)) {
                        curCreep.move(curCreep.pos.getDirectionTo(assignment.deployPos));
                        if (activeCreep && activeCreep.ticksToLive <= 1) {
                            // A bit of code to cause the creep to move away while it's dying.
                            activeCreep.move(assignment.deployPos.getDirectionTo(curCreep.pos));
                        }
                    } else {
                        curCreep.moveTo(assignment.deployPos);
                    }
                }

                var energy = <Game.Energy[]>curCreep.pos.findInRange(Game.RoomFindType.DroppedEnergy, 1);
                if (energy.length && !curCreep.energy.isFull) {
                    curCreep.pickup(energy[0]);
                }
            });
        });
    }
}

export = TestEngine;