'use strict';
//data is saved into Db("moderation");
const DEFAULT_MONITOR = {
    room: 40,
    user: 12,
    alertRoom: 10,
    pattern: 8,
    moderate: function(userid, points) {
        if (points > 5) {
            Monitor.ban(userid);
        }
        else if (points === 5) {
            if (Monitor.isBanned(userid) !== "ban") Monitor.lock(userid);
        }
        else {
            let conversionChart = {
                1: 7,
                2: 60,
                3: 180,
                4: 720,
            };
            // avoid downgrading punishments.
            if (Monitor.isBanned(userid) === "mute" || !Monitor.isBanned(userid)) {
                Monitor.mute(userid, conversionChart[points]);
            } else {
                // lock goes to ban
                Monitor.ban(userid);
            }
        }
        delete Monitor.users[userid];
        clearQueue(userid);
    }
};

class ResourceMonitor {
    constructor() {
        this.username;
        this.rooms = {};
        this.users = {};
        this.history = [];
        this.count = 0;
        this.warnings = {};
        this.pattern = [];
        this.lockdown = false;
        this.alertRooms = {};
        this.settings = DEFAULT_MONITOR;
        this.init();
    }
    init() {
        setInterval(function() {
            this.clean();
        }.bind(this), 60000);
    }
    clean() {
        this.users = {};
        this.rooms = {};
        if (this.history.length > 60) {
            this.history.shift();
        }
        this.history.push(this.count);
        this.count = 0;
    }
    setPattern(command) {
        this.pattern.push(command);
        if (this.pattern.length > 5) {
            log("monitor", "[LOCKDOWN]")
            this.lockdown = true;
        }
        setTimeout(function() {
            this.pattern.shift();
            if (this.pattern.length < 5) {
                this.lockdown = false;
                log("monitor", "[ENDLOCKDOWN]")
            }
        }.bind(this), 1800000);
    }
    run(user, room, command, pm) {
        if (user.isDev()) return false;
        if (command in Config.whitelistCommands) return false;
        //set up the objects
        //room
        if (room) {
            if (!this.rooms[room.id]) this.rooms[room.id] = 0;
            this.rooms[room.id]++;
        }
        else {
            room = {
                id: null,
            };
        }
        //user
        if (!this.users[user.userid]) this.users[user.userid] = {};
        if (!this.users[user.userid][command]) this.users[user.userid][command] = 0;
        //add the counts
        this.count++;
        this.users[user.userid][command]++;
        //set mark room as spam
        if (this.rooms[room.id] > this.settings.room && !this.alertRooms[room.id]) {
            this.alertRooms[room.id] = 1;
            log("monitor", "[ROOM - " + room.id + "] high usage.");
            setTimeout(function() {
                delete this.alertRooms[room.id];
            }.bind(this), 3600000);
        }
        //moderate spammy rooms harshly
        if (this.alertRooms[room.id] && Object.values(this.users[user.userid]).sum() > this.settings.alertRoom) {
            log("monitor", "[USER: " + user.userid + "] spamming commands in high alert " + (!pm ? " room - " + room.id : " pms") + ".");
            this.warnings[user.userid]++;
            this.settings.moderate(user.userid, this.warnings[user.userid]);
            //search for patterns
            for (var cmd in this.users[user.userid]) {
                if (this.users[user.userid][cmd] > 6) {
                    this.setPattern(cmd);
                }
            }
        }
        //catching pm spammers
        if (this.lockdown && pm && Object.values(this.users[user.userid]).sum() >= 4) {
            log("monitor", "[USER: " + user.userid + "] PM spamming commands during bot lockdown.");
            this.warnings[user.userid]++;
            this.settings.moderate(user.userid, this.warnings[user.userid]);
            //dont search for patterns
        }
        //general users
        //moderating for patterns
        for (var cmd in this.users[user.userid]) {
            if (this.users[user.userid][cmd] >= this.settings.pattern && this.pattern.includes(cmd)) {
                log("monitor", "[USER: " + user.userid + "] Abuse of " + cmd + " command.")
                this.setPattern(cmd);
                this.warnings[user.userid]++;
                this.settings.moderate(user.userid, this.warnings[user.userid]);
            }
        }
        //general
        if (Object.values(this.users[user.userid]).sum() >= this.settings.user) {
            log("monitor", "[USER: " + user.userid + "] spamming commands in" + (!pm ? " room - " + room.id : " pms") + ".");
            this.warnings[user.userid]++;
            this.settings.moderate(user.userid, this.warnings[user.userid]);
            //search for patterns
            for (var cmd in this.users[user.userid]) {
                if (this.users[user.userid][cmd] > 6) {
                    this.setPattern(cmd);
                }
            }
        }
    }

    transferRecords(oldId, newId) {
        //transfer current data
        if (this.users[oldId]) {
            this.users[newId] = this.users[oldId];
            delete this.users[oldId];
        }
        //transfer warnings
        if (this.warnings[oldId]) {
            this.warnings[newId] = this.warnings[oldId];
        }
        //transfer mutes, locks, bans
        if (this.isBanned[oldId]) {
            Db("moderation").set(newId, Db("moderation").get(oldId));
        }
    }
    release(userid) {
        if (Db("moderation").get(userid)) Db("moderation").set(userid, null);
        delete this.users[userid];
    }
    ban(userid) {
        Db("moderation").set(userid, "ban-");
    }
    lock(userid) {
        Db("moderation").set(userid, "lock-");
    }
    mute(userid, duration) {
        if (!duration) duration = 7;
        let release = Date.now() + (duration * 60000);
        Db("moderation").set(userid, "mute-" + release);
    }
    isBanned(userid) {
        let moderation = Db("moderation").get(userid, null);
        if (moderation) {
            if (moderation.split("-")[0] === "mute") {
                if (Date.now() >= moderation.split("-")[1]) {
                    this.release(userid);
                    return false;
                }
                return "mute";
            }
            return moderation.replace(/[^a-z]/g, "");
        }
        return false;
    }
}

exports.Monitor = new ResourceMonitor();