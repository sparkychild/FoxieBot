'use strict';
class Context {
    constructor(target, user, room, command, levelsDeep) {
        this.user = user;
        this.room = room;
        this.command = command;
        this.target = target;
        this.targetUser = this.getTargetUser();
        this.canBroadcast = this.can(command, " ");
        this.levelsDeep = levelsDeep;
    }

    getTargetUser() {
        if (!this.target || !toId(this.target)) return this.targetUser = null;
        let targetId = toId(this.target.split(",")[0]);
        if (Users.users.has(targetId)) {
            return this.targetUser = Users.get(targetId);
        }
        return targetId;
    }

    send(message) {
        if (this.canBroadcast && this.room) {
            this.room.send(this.user.userid, message, this.user.isDev());
        }
        else {
            this.user.sendTo(message);
        }
    }

    can(command, details) {
        this.canBroadcast = this.user.can(command, this.room, this.targetUser, details);
        return this.canBroadcast;
    }

    run(original) {
        let success;
        if (Commands[this.command]) {
            success = Commands[this.command].call(this, this.target, this.room, this.user, original);
        }
        success = !(success === false);
        return success;
    }
    parse(post) {
        return commandParser(post.replace(/^\//i, this.room ? this.room.commandCharacter[0] : Config.defaultCharacter[0]), this.user, this.room, true, this.levelsDeep + 1);
    }
}

exports.commandParser = function(message, user, room, bypassMonitor, levelsDeep) {
    if (user.userid === toId(Monitor.username)) return false;
    if (!message || (room && !room.commandCharacter.includes(message.charAt(0))) || (!room && !Config.defaultCharacter.includes(message.charAt(0)))) return false;
    let userIsBanned = Monitor.isBanned(user.userid);
    //get command
    let originalCommand = toId(message.split(" ")[0]);
    let command = originalCommand;
    let target = message.split(" ").slice(1).join(" ");
    
    // limit recursion to prevent endless loops alias and addcom.
    if (!levelsDeep) levelsDeep = 0;
    if (levelsDeep > 10) {
        return log("error", "Message: " + message + "\n              Too much recursion.");
    }
    
    //get actual command
    if (Commands[command]) {
        if (typeof Commands[command] === "string") command = Commands[command];
        //check for ban
        if ((userIsBanned === "ban" || (userIsBanned && !Config.lockedCommands[command])) && !user.isDev()) return false;
        let context = new Context(target, user, room, command, levelsDeep);
        let success;
        try {
            success = context.run(originalCommand);
        }
        catch (e) {
            console.log("");
            console.log(e.stack);
            console.log("");
            console.log("   User: " + user.name);
            console.log("   Room: " + (room ? room.name : "PMs"));
            console.log("Message: " + message);
            console.log("   Date: " + getEST());
            console.log("");
        }
        if (success && !bypassMonitor) {
            //run the monitor
            Monitor.run(user, room, command, !room);
        }
        return;
    }
    //run custom commands
    let globalCCon, roomCCon;
    globalCCon = Db("customcommands").get(["global", command], null);
    if (room) {
        roomCCon = Db("customcommands").get([room.id, command], null);
    }
    let customCommand = roomCCon || globalCCon;
    if (customCommand && (!userIsBanned || user.isDev())) {
        Plugins.runCustomCommand(target, room, user, customCommand, !room, levelsDeep);
        Monitor.run(user, room, "customcommand", !room);
        return;
    }
}
