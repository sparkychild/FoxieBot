'use strict';

let helpEntries = require("../help.js").help;

exports.commands = {
    seen: function(target, room, user) {
        this.can("set");
        target = toId(target);
        let lastSeen = Db("seen").get(target, null);
        if (!lastSeen) return this.send("**" + target + "** was never seen before.");
        let seenRoom = Db("settings").get([toId(lastSeen[1]), "isPrivate"], false) && ((!user.isDev() && !user.isStaff) || room) ? "a private room" : lastSeen[1];
        this.send("**" + target + "** was last seen " + Tools.getTimeAgo(lastSeen[0]) + " ago in " + seenRoom + ".");
    },
    uptime: function(target, room, user) {
        this.can("set");
        let startTime = Date.now() - (process.uptime() * 1000);
        this.send("The bot's uptime is: " + Tools.getTimeAgo(startTime));
    },
    help: function(target, room, user) {
        if (!target) return this.parse("/guide"); 
        target = target.toLowerCase();
        this.can("say");
        if(!helpEntries[target]) return false;
        helpEntries[target].forEach(function(e){
            this.send(e.replace(/^\//i, room ? room.commandCharacter[0] : Config.defaultCharacter));
        }.bind(this));
    },
    guide: function(target, room, user) {
        this.can("set");
        let useCommandCharacter = room ? room.commandCharacter[0] : Config.defaultCharacter[0];
        let hastebin = Object.keys(helpEntries).sort().map(function(entry){
            return helpEntries[entry].join("\n").replace(/^\//i, useCommandCharacter).replace(/\n\//i, useCommandCharacter);
        }.bind(this)).join("\n\n");
        Tools.uploadToHastebin("Bot Commands: \n\n" + hastebin, function(link){
            this.send("Bot Guide: " + link);
        }.bind(this));
        
    }
};