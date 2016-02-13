"use strict";

class kuncGame extends Rooms.botGame {
    constructor (room, scorecap) {
        super(room);
        
        this.targetPokemon = null;
        this.targetMoveset = null;
        this.allowJoins = false;
        this.gameId = "kunc";
        this.gameName = "Kunc";
        this.roundNumber = 0;
        this.scorecap = parseInt(scorecap) || 5;
        this.init();
    }
    
    init () {
        this.state = "started";
        if (this.scorecap <= 0) this.scorecap = 5;
        this.sendRoom("Starting a new game of Kunc.  Simply use ``" + this.room.commandCharacter[0] + "g`` to guess the Pokémon that the moveset belongs to. First to " + this.scorecap + " points wins.");
        this.initRound();
    }
    
    onReceive (user, answer) {
        if (!answer || toId(answer) !== toId(this.targetPokemon)) return;
        if (!(user.userid in this.users)) {
            this.users[user.userid] = new Rooms.botGamePlayer(user);
            this.users[user.userid].points = 0;
            this.userList.push(user.userid);
        }
        this.users[user.userid].points++;
        if (this.users[user.userid].points >= this.scorecap) {
            this.sendRoom(user.name + " has won the game!");
            this.destroy();
            return;
        }
        this.sendRoom(user.name + " got the correct answer - ``" + this.targetPokemon + "`` - and has " + this.users[user.userid].points + " points.");
        this.initRound();
    }
    
    initRound () {
        this.roundNumber++;
        this.determineQuestion();
        this.sendRoom("Round " + this.roundNumber + " | ``" + this.targetMoveset + ".``");
    }
    
    determineQuestion () {
        // determine a pokemon
        let pokemon = null;
        let pokemonId
        // make sure there is a valid mon.
        while (!pokemon || !pokemon.randomBattleMoves || !pokemon.tier || ["NFE", "LC"].includes(pokemon.tier)) {
            pokemonId = Object.keys(Tools.Formats).randomize()[0]
            pokemon = Tools.Formats[pokemonId];
        }
        this.targetPokemon = Tools.Pokedex[pokemonId].species;
        let moves = pokemon.randomBattleMoves.randomize();
        let moveset = [];
        let moveTypes = [];
        let rand = Math.random();
        let attackerType, boostingMove, healingMove, stabMove;
        // determine boosting move
        moves.forEach((m) => {
            // boosting move
            if (Tools.Movedex[m].boosts && (rand >= 0.65 || rand <= 0.25) && (Tools.Movedex[m].boosts["atk"] || Tools.Movedex[m].boosts["spa"])) {
                attackerType = attackerType || (Tools.Movedex[m].boosts["atk"] ? "Physical" : "Special");
                boostingMove = boostingMove || Tools.Movedex[m].name;
            }
            // healing move
            if ((m === "wish" || m === "rest" || Tools.Movedex[m].heal) && rand >= 0.5) {
                healingMove = healingMove || Tools.Movedex[m].name;
            }
            // get a STAB attack
            if (Tools.Pokedex[pokemonId].types.includes(Tools.Movedex[m].type) && (!attackerType || (attackerType && attackerType === Tools.Movedex[m].category))) {
                stabMove = stabMove || Tools.Movedex[m].name;
                moveTypes[0] = moveTypes[0] || Tools.Movedex[m].type;
                attackerType = attackerType || (Tools.Movedex[m].category !== "Status" ? Tools.Movedex[m].category : null);
            }
        });
        
        if (boostingMove) moveset.push(boostingMove);
        if (healingMove) moveset.push(healingMove);
        if (stabMove) moveset.push(stabMove);

        // wish protect
        if (moveset.includes("Wish") && moves.includes("protect") && rand >= 0.65) moveset.push("Protect");
        // rest talk
        if (moveset.includes("Rest") && moves.includes("sleeptalk") && rand >= 0.7) moveset.push("Sleep Talk");
        let minIterations = moves.length;
        let index = -1;
        let hiddenPowerCheck = false;
        // check for 4 moves, or when it's out of moves
        while (moveset.length < 4 && moves.length !== moveset.length) {
            index++;
            let tMove = Tools.Movedex[moves[index % minIterations]];
            // set exceptions for situational moves
            if ((!moveset.includes("Rest") && tMove.name === "Sleep Talk") || tMove.name === "Dream Eater") continue;
            // each move once only
            if (moveset.includes(tMove.name)) continue;
            // reject status moves
            if (tMove.category === "Status" && index < minIterations) continue;
            // reject boosting moves
            if (tMove.boosts && index < minIterations * 3) continue;
            // reject moves of that overlap typwise
            if (moveTypes.includes(tMove.type) && index < minIterations * 2) continue;
            // reject moves of a different attacking category
            if (attackerType && tMove.category !== attackerType && index < minIterations) continue;
            if (tMove.name.indexOf("Hidden Power") === 0) {
                if (hiddenPowerCheck) continue;
                hiddenPowerCheck = true;
            } 
            moveset.push(tMove.name);
            moveTypes.push(tMove.type);
            attackerType = attackerType || (tMove.category !== "Status" ? tMove.category : null);
        }
        return this.targetMoveset = moveset.randomize().join(", ");
    }
    
    getScoreBoard () {
        let self = this;
        return "Points: " + Object.keys(this.users).sort().map((u) => {
            return self.users[u].name + " (" + self.users[u].points + ")";
        }).join(", ");
    }
}

exports.commands = {
    kunc: function (target, room, user) {
        if (!room || !this.can("games")) return false;
        if(room.game) return this.send("There is already a game going on in this room! (" + room.game.gameName + ")");
        room.game = new kuncGame(room, target);
    },
    kuncstart: function (target, room, user) {
        if (!room || !this.can("games") || !room.game || room.game.gameId !== "kunc") return false;
        room.game.onStart();
    },
    kuncscore: function (target, room, user) {
        if (!room || !this.can("games") || !room.game || room.game.gameId !== "kunc") return false;
        this.send(room.game.getScoreBoard());
    },
    kuncguess: function (target, room, user) {
        if(!room || !room.game || room.game.gameId !== "kunc" || !target) return false;
        room.game.onReceive(user, target);
    },
    kuncend: function (target, room, user) {
        if (!room || !this.can("games") || !room.game || room.game.gameId !== "kunc") return false;
        this.send("The game of kunc was forcibly ended. The correct answer was: " + room.game.targetPokemon);
        room.game.destroy();
    },
    kuncjoin: function (target, room, user) {
        if (!room || !room.game || room.game.gameId !== "kunc") return false;
        room.game.onJoin(user);
    },
    kuncleave: function (target, room, user) {
        if (!room || !room.game || room.game.gameId !== "kunc") return false;
        room.game.onLeave(user);
    },
    kuncskip: function (target, room, user) {
        if (!room || !this.can("games") || !room.game || room.game.gameId !== "kunc") return false;
        this.send("The correct answer was: " + room.game.targetPokemon);
        room.game.initRound();        
    },
    kuncrepost: function (target, room, user) {
        if (!room || !this.can("games") || !room.game || room.game.gameId !== "kunc") return false;
        this.send("Repost - Round " + room.game.roundNumber + " | ``" + room.game.targetMoveset + ".``");
    },
};