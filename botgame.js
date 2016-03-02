'use strict';

class botGame {
    constructor(room) {
        this.room = room;
        this.users = {};
        this.userList = [];
        this.gameId = "game";
        this.gameName = "Game";
        this.allowJoins = false;
        this.state = null;
        this.answerCommand = "standard";
    }
    
    onRename (oldId, newName) {
        if(!this.userList.includes(oldId)) return false;
        let newId = toId(newName);
        this.users[newId] = this.users[oldId];
        delete this.users[oldId];
        this.userList.splice(this.userList.indexOf(oldId), 1, newId);
        this.users[newId].rename(newName);
        if(this.currentPlayer && this.currentPlayer === oldId) this.currentPlayer = newId;
    }
    
    sendRoom (message) {
        this.room.send(null, message);
    }
    
    onJoin (user) {
        if(!this.allowJoins || this.state !== "signups") return;
        if(this.userList.includes(user.userid)) return user.sendTo("You have already joined!");
        this.users[user.userid] = new botGamePlayer(user);
        this.userList.push(user.userid);
        user.sendTo("You have joined the game of " + this.gameName + ".");
    }
    
    onLeave (user) {
        if(!this.allowJoins || this.state !== "signups" || !this.userList.includes(user.userid)) return;
        delete this.users[user.userid];
        this.userList.splice(this.userList.indexOf(user.userid), 1);
        return true;
    }
    
    destroy () {
        if(this.timer) clearTimeout(this.timer);
        delete this.room.game;
    }
}

class botGamePlayer {
    constructor (user) {
        this.name = user.name;
        this.userid = user.userid;
        this.user = user;
    }
    
    rename (name) {
        this.userid = toId(name);
        this.user = Users.get(this.userid);
        this.name = this.user.name;
    }
}

module.exports = {
    game: botGame,
    player: botGamePlayer,
};
