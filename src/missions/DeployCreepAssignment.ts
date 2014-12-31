import Game = require('../world/Game');
import MissionAssignment = require('./MissionAssignment');
import RoomPosition = Game.RoomPosition;

class DeployCreepAssignment extends MissionAssignment {
    deployPos:RoomPosition;

    constructor(assignmentId:string, deployPos:RoomPosition) {
        super(assignmentId);
        this.deployPos = deployPos;
    }
}

export = DeployCreepAssignment;