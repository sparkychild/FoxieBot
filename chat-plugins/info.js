'use strict';
const http = require("http");
let helpEntries = require("../help.js").help;
let formatsData = require("../data/pokemon.js").BattleFormatsData;

function getData(link, callback, https) {
    http.get(link, function(res) {
        var data = '';
        res.on('data', function(part) {
            data += part;
        });
        res.on('end', function(end) {
            callback(data);
        });
    });
}

exports.commands = {
    seen: function(target, room, user) {
        if(!target) return this.parse("/help seen");
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
        if (!helpEntries[target]) return false;
        helpEntries[target].forEach(function(e) {
            this.send(e.replace(/^\//i, room ? room.commandCharacter[0] : Config.defaultCharacter));
        }.bind(this));
    },
    guide: function(target, room, user) {
        this.can("set");
        let useCommandCharacter = room ? room.commandCharacter[0] : Config.defaultCharacter[0];
        let hastebin = Object.keys(helpEntries).sort().map(function(entry) {
            return helpEntries[entry].join("\n").replace(/^\//i, useCommandCharacter).replace(/\n\//i, useCommandCharacter);
        }.bind(this)).join("\n\n");
        Tools.uploadToHastebin("Bot Commands: \n\n" + hastebin, function(link) {
            this.send("Bot Guide: " + link);
        }.bind(this));

    },
    git: function(target, room, user) {
        this.can("set");
        this.send(Monitor.username + "'s github repository: " + "https://github.com/sparkychild/FoxieBot");
    },
    usage: function(target, room, user) {
        let baseLink = "http://www.smogon.com/stats/2015-12/";
        if (!target) return this.send(baseLink);
        
        //get stats
        let parts = target.split(",");
        
        if (!formatsData[toId(parts[0])]) return this.send("Invalid Pokémon.");
        
        let tier = toId(parts[1]) || toId(formatsData[toId(parts[0])].tier).replace("nfe", "pu");
        let mon = toId(parts[0]);
        
        if (!mon || !tier) return this.parse("/help usage");

        let self = this;

        function parseUsageData(data) {
            let monData;
            let placement = {};
            for (let tMon in data) {
                if (toId(tMon) === mon) {
                    monData = {
                        "name": tMon,
                        "data": data[tMon]
                    };
                }
                placement[toId(tMon)] = data[tMon].usage;
            }
            if (!monData) return self.send("Invalid Pokémon.");
            monData.placement = Object.keys(placement).sort(function(a, b) {
                if (placement[a] > placement[b]) return -1;
                return 1;
            }).indexOf(mon) + 1;
            self.send(monData.name + " - #" + monData.placement + " in " + tier.toUpperCase() + " | Usage: " + monData.data.usage * 100 + "% | Raw Count: " + monData.data["Raw count"] + ".");
        }

        getData(baseLink + "chaos/" + tier + "-1500.json", function(data) {
            try {
                data = JSON.parse(data).data;
            }
            catch (e) {
                return this.send("Unable to parse JSON data/Invalid tier.");
            }
            parseUsageData(data);
        }.bind(this));
    },
};