"use strict";
const path = require("path");
const sys = require("sys");

Array.prototype.sum = function() {
    return this.reduce(function(pv, cv) {
        return pv + cv;
    }, 0);
}
Array.prototype.includes = function(item) {
    return this.indexOf(item) > -1;
}

function runNpm(command) {
    console.log("Running `npm " + command + "`...");

    var child_process = require("child_process");
    var npm = child_process.spawn("npm", [command]);

    npm.stdout.on("data", function(data) {
        process.stdout.write(data);
    });

    npm.stderr.on("data", function(data) {
        process.stderr.write(data);
    });

    npm.on("close", function(code) {
        if (!code) {
            child_process.fork("main.js").disconnect();
        }
    });
}

// Check if everything that is needed is available
try {
    require("sugar");
    require("colors");
}
catch (e) {
    console.log("Dependencies are not installed!");
    return runNpm("install");
}

if (!Object.select) {
    console.log("Node needs to be updated!");
    return runNpm("update");
}

global.fs = require("fs");
global.toId = function(text, id) {
    if (!text || typeof text !== "string") return "";
    if (id) return text.toLowerCase().replace(/[^a-z0-9\-]/g, "");
    return text.toLowerCase().replace(/[^a-z0-9]/g, "");
};

global.removeCommand = function(text) {
    return text.replace(/^\//i, "//").replace(/^\!/i, " !").replace(/^[\>]{2,}/i, ">");
};

global.getEST = function(date) {
    function isDst(tarDate) {
        var deezNuts = new Date(tarDate);
        var deezMonth = deezNuts.getMonth() + 1;
        var deezDay = deezNuts.getDate() + 1;
        var deezDayofWeek = deezNuts.getDay();
        if (deezMonth > 11 || deezMonth < 3) {
            return false;
        }
        if (deezMonth === 3) {
            if (deezDay - deezDayofWeek > 7) {
                return true;
            }
            return false;
        }
        if (deezMonth === 11) {
            if (deezDay - deezDayofWeek > 0) {
                return true
            }
            return false;
        }
        return true;
    }
    let d = (date ? date : Date.now()) + (new Date().getTimezoneOffset() * 60 * 1000) - (1000 * 60 * 60 * 5);
    if (isDst(d)) d += 3600000;
    return new Date(d).toLocaleString();
};

if (!fs.existsSync("./config/config.js")) {
	console.log("config.js not found! - Creating with default settings...");
	fs.writeFileSync("./config/config.js", fs.readFileSync('./config/config-example.js'));
}

global.Config = require("./config/config.js");
if (!Config.info.server || !Config.info.serverid || !Config.info.port) {
    log("error", "You need to fill out the config file!");
}
if (Config.defaultCharacter.length === 0) {
    Config.defaultCharacter.push("+");
}

global.log = function(item, text) {
    if (!Config.logging || (Config.logging !== true && (typeof Config.logging && !Config.logging.includes(item)))) return false;
    let d = getEST();
    let fontColours = {
        monitor: "red",
        ok: "green",
        error: "red",
        ">>": "yellow",
        "<<": "yellow",
        "join": "magenta",
        "left": "magenta",
    };
    console.log("[" + d + "] " + item.toUpperCase()[fontColours[item] || "blue"] + "        ".slice(item.length) + text);
}

//get the database
global.Db = require("origindb")("config/database-" + Config.info.serverid);


//check for bot auth;
if (!Object.keys(Db("ranks").object()).length) {
    if (process.argv[2]) {
        Db("ranks").set(toId(process.argv.slice(2).join("")), "~");
        log("monitor", "Promoted " + process.argv.slice(2).join("").yellow + " to BotAdmin.")
    }
    else {
        console.log("Please include the name of the bot admin. `node main.js [username]`");
        process.exit(-1);
    }
}

//globals

global.Parse = require("./parser.js").parse;
global.Tools = require("./tools.js").Tools;
global.Plugins = require("./plugins-parser").Plugins;
global.Monitor = require("./monitor.js").Monitor;
global.commandParser = require("./command-parser.js").commandParser;
global.Commands = require("./commands.js").commands;
global.Users = require("./users.js");
global.Rooms = require("./rooms.js");

function loadChatPlugins() {
    let loaded = [];
    let failed = [];
    fs.readdirSync("./chat-plugins/").forEach(function(f) {
        try {
            Object.merge(Commands, require("./chat-plugins/" + f).commands);
            loaded.push(f);
        }
        catch (e) {
            console.log(e.stack);
            failed.push(f)
        }
    })
    if (loaded.length) {
        log("info", "Loaded command files: " + loaded.join(", "));
    }
    if (failed.length) {
        log("error", "Failed to load: " + failed.join(", "));
    }
}
loadChatPlugins();

//globals

if (Config.watchConfig) {
    fs.watchFile(path.resolve(__dirname, "config/config.js"), function(curr, prev) {
        if (curr.mtime <= prev.mtime) return;
        try {
            delete require.cache[require.resolve("./config/config.js")];
            global.Config = require('./config/config.js');
            log("ok", 'Reloaded config/config.js');
        }
        catch (e) {}
    });
}

log("ok", "starting server");
let WebSocketClient = require("websocket").client;

let connection = null;
let sendQueue = [];
let dequeuing = false;
let lastSent = 0;

function dequeue() {
    if (sendQueue.length > 0) {
        dequeuing = false;
        let tempText = sendQueue.shift();
        send(tempText[0], tempText[1], false, true);
    }
}

global.send = function(text, user, priority, bypass) {
    if (!connection.connected || !text) return false;
    if (!user) {
        user = toId(Config.bot.name);
    }
    if (Date.now() - lastSent < 650 && !bypass) {
        if (!priority) {
            sendQueue.push([text, user]);
        }
        else {
            sendQueue = [
                [text, user]
            ].concat(sendQueue);
        }
        if (!dequeuing) {
            setTimeout(function() {
                dequeue();
            }, 650 - (Date.now() - lastSent));
            dequeuing = true;
        }
        return false;
    }
    log(">>", text);
    if (!Array.isArray(text)) text = [text.toString()];
    text = JSON.stringify(text);
    connection.send(text);
    lastSent = Date.now();
    if (sendQueue.length > 0) {
        setTimeout(function() {
            dequeue();
        }, 650);
        dequeuing = true;
    }
};


global.clearQueue = function(user) {
    if (!user) return false;
    user = toId(user);
    let newQueue = [];
    for (let i = 0; i < sendQueue.length; i++) {
        if (sendQueue[i][1] === user) {
            continue;
        }
        newQueue.push(sendQueue[i])
    }
    sendQueue = newQueue;
}



let connect = function(retry) {
    if (retry) {
        log("info", "retrying...");
    }

    let ws = new WebSocketClient();

    ws.on("connectFailed", function(err) {
        log("error", "Could not connect to server " + Config.info.server + ": " + sys.inspect(err));
        log("info", "retrying in 15 seconds");

        setTimeout(function() {
            connect(true);
        }, 15000);
    });

    ws.on("connect", function(con) {
        connection = con;
        log("ok", "connected to server " + Config.info.server);
        Parse.connectionDetails = {
            firstConnect: true,
            globallyBanned: false,
        };
        Rooms.rooms.forEach(function(value, key) {
            log("info", "Deleting Room object for " + key);
            Rooms.delete(key, true);
        })

        con.on("error", function(err) {
            log("error", "connection error: " + sys.inspect(err));
        });

        con.on("close", function() {
            // Is this always error or can this be intended...?
            log("error", "connection closed: " + sys.inspect(arguments));
            log("info", "retrying in one 15 seconds");

            setTimeout(function() {
                connect(true);
            }, 15000);
        });

        con.on("message", function(message) {
            if (message.type === "utf8") {
                Parse.parseData(message.utf8Data);
            }
        });
    });

    // The connection itself
    let id = ~~(Math.random() * 900) + 100;
    let chars = "abcdefghijklmnopqrstuvwxyz0123456789_";
    let str = "";
    for (let i = 0, l = chars.length; i < 8; i++) {
        str += chars.charAt(~~(Math.random() * l));
    }

    let conStr = "ws://" + Config.info.server + ":" + Config.info.port + "/showdown/" + id + "/" + str + "/websocket";
    log("info", "connecting to " + conStr + " - secondary protocols: " + sys.inspect(Config.secprotocols));
    ws.connect(conStr, Config.secprotocols);
};
connect();
