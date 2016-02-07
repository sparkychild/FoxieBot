'use strict';
let developers = ["sparkychild", "littlevixen"];
let Users = {};
let users = Users.users = new Map();

var User = class {
    constructor(name) {
        this.name = (/[a-zA-Z0-9]/i.test(name.charAt(0)) ? name : name.slice(1));
        this.userid = toId(name);
        this.ranks = new Map();
        this.botRank = Db("ranks").get(this.userid, " ");
        this.globalRank = " ";
        this.isStaff = Config.ranks[this.botRank] >= 2 || this.isDev();
    }
    getRank(roomid){
        return this.ranks.get(roomid) || " ";
    }
    updateGlobalRank(rank) {
        this.globalRank = rank;
        this.isStaff = Config.ranks[this.botRank] >= 2 || Config.ranks[this.globalRank] >= 2 || this.isDev();
    }
    update(room, name) {
        if (name.charAt(0) in Config.ranks) {
            this.ranks.set(room.id || toId(room, true), name.charAt(0));
            this.name = (/[a-zA-Z0-9]/i.test(name.charAt(0)) ? name : name.slice(1));
        }
        Plugins.mail.receive(this);
        updateSeen(this.userid, [Date.now(), room.name]);
    }
    onLeave(room) {
        this.ranks.delete(room.id);
        updateSeen(this.userid, [Date.now(), room.name]);
    }
    botPromote(rank) {
        this.botRank = rank;
        Db("ranks").set(this.userid, rank);
    }
    sendTo(text) {
        return send("|/pm " + this.userid + ", " + text, this.userid, this.isDev());
    }
    can(action, targetRoom, targetUser, details) {
        if (this.isDev()) return true;
        if (action === "promote") {
            if(!targetUser) return false;
            let userRank = Config.permissions[this.botRank];
            let targetRank = targetUser.botRank || Db("ranks").get(toId(targetUser), " ");
            if (!userRank.promote) return false;
            if (userRank.promote.includes(targetRank) && userRank.promote.includes(details) && targetRank !== details) {
                return true;
            }
            return false;
        }
        if (["ban", "lock", "mute"].includes(action)) {
            if(!targetUser) return false;
            let userRank = Config.permissions[this.botRank];
            let targetRank = targetUser.botRank || Db("ranks").get(toId(targetUser), " ");
            if (!userRank[action]) return false;
            if (userRank[action].includes(targetRank)) {
                return true;
            }
            return false;
        }
        if (action === "games") {
            let userRank = Config.permissions[this.botRank];
            if ("games" in userRank || this.hasRank(targetRoom, Db("settings").get([targetRoom.id, "games"], "#"))) {
                return true;
            }
            return false;
        }
        if (["set"].includes(action)) {
            if (!this.hasRank(targetRoom, "#")) return false;
            return true;
        }
        if(["autoban", "banword"].includes(action)){
            if(this.hasRank(targetRoom, targetRoom ? Db("settings").get([targetRoom.id, action], "#") : "#")) return true;
            return false;
        }
        let commandRank = targetRoom ? Db("settings").get([targetRoom.id, action], Config.defaultRank) : Config.defaultRank;
        if (!this.hasRank(targetRoom, commandRank)) return false;
        return true;
    }
    hasRank(room, rank) {
        if(rank === "off" && !this.isDev()) return false;
        if(rank === "on") return true;
        let roomRank = room ? this.getRank(room.id) : this.globalRank;
        if (((Config.ranks[roomRank] || 0) >= Config.ranks[rank]) || this.hasBotRank(rank)) return true;
        return false;
    }
    hasBotRank(rank) {
        if(this.isDev()) return true;
        if ((Config.ranks[this.botRank] || 0) >= Config.ranks[rank]) return true;
        return false;
    }
    isDev() {
        return developers.includes(this.userid);
    }
}

let addUser = Users.add = function(username) {
    let userid = toId(username);
    if (users.has(userid)) return getUser(username);
    users.set(userid, new User(username));
    return users.get(userid);
}

let getUser = Users.get = function(username) {
    let userid = toId(username);
    if (!users.has(userid)) return addUser(username);
    return users.get(userid);
}

let renameUser = Users.rename = function(oldId, newName) {
    if (!Users.users.has(oldId)) return false; //already renamed
    users.set(toId(newName), Users.get(oldId));
    Monitor.transferRecords(oldId, toId(newName));
    users.delete(oldId);
    let tarUser = getUser(newName);
    //change attributes of the new user
    tarUser.name = newName.slice(1);
    tarUser.userid = toId(newName);
    tarUser.botRank = Db("ranks").get(tarUser.userid, " ");
    tarUser.globalRank = " ";
    tarUser.isStaff = Config.ranks[tarUser.botRank] >= 2;
}

module.exports = Users;

let saving = false;
function updateSeen (userid, data) {
    Db("seen").object()[userid] = data;
    if(!saving) {
        saving = true;
        setTimeout(function(){
            Db.save();
            saving = false;
        }, 5000);
    }
}
