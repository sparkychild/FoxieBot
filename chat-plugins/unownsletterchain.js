'use strict';

class UnownsLetterChain extends Rooms.botGame {
    constructor(room) {
        super(room);
        
        this.currentPlayer = null;
        this.currentPlayerName = null;
        this.lastMon = null;
        this.allowJoins = true;
        this.answeredPokemon = [];
        this.state = "signups";
        this.gameId = "unownsletterchain";
        this.gameName = "Unown's Letter Chain"
        this.roundNumber = 1;
        this.timer = null;
    }
    
    sendRoom (message) {
        this.room.send(null, message);
    }
    
    onStart () {
        if(this.userList.length < 2) return false;
        //shuffle userlist
        this.userList = this.userList.randomize();
        
        // choose a random pokemon
        this.lastMon = Object.keys(Tools.Formats).randomize()[0];
        this.answeredPokemon.push(this.lastMon);
        
        // get the current player
        this.setNextPlayer();
        
        // get playerlist
        this.sendRoom("Round 1 | " + this.buildPlayerList());
        this.state = "started";
        
        // start the turn
        this.initNewTurn();
    }
    
    onReceive (user, answer) {
        if (this.state !== "started" || user.userid !== this.currentPlayer) return false;
        answer = toId(answer);
        // check if answer is valid and unchosen yet.
        if (this.answeredPokemon.includes(answer) || !(answer in Tools.Formats)) return false;
        
        // check if the answer can continue the chain
        if (answer.charAt(0) !== this.lastMon.charAt(this.lastMon.length - 1)) return false;
        
        // clear the last turn's timer
        clearTimeout(this.timer);
        
        // set new answered Pokémon
        this.lastMon = answer;
        this.answeredPokemon.push(answer);
        this.endTurn();
    }
    
    endTurn () {
        if(this.userList.length < this.answeredPokemon.length) {
            // all players have gone, starting next round
            this.newRound();
        } else {
            // get next player and start the new turn
            this.setNextPlayer();
            this.initNewTurn();
        }
    }
    
    initNewTurn () {
        this.sendRoom(this.currentPlayerName + "'s turn! Use " + this.room.commandCharacter[0] + "g to submit your answer. The Pokémon to chain is: " + Tools.Pokedex[this.lastMon].species);
        let self = this;
        this.timer = setTimeout(() => {
            if (self.eliminate()) {
                self.endTurn();
            }
        }, 14000);
    }
    
    newRound () {
        this.roundNumber++;
        this.sendRoom("Round " + this.roundNumber + " | " + this.buildPlayerList());
        this.answeredPokemon = [this.lastMon];
        this.setNextPlayer();
        this.initNewTurn();
    }
    
    eliminate (userid) {
        userid = userid || this.currentPlayer;
        //remove players
        delete this.users[userid];
        this.userList.splice(this.userList.indexOf(userid), 1);
        
        if (this.userList.length <= 1) {
            this.setNextPlayer();
            this.sendRoom(this.currentPlayerName + " has won the game!");
            this.destroy();
            return false;
        }
        return true;
    }
    
    setNextPlayer () {
        // get first player in the list
        this.currentPlayer = this.userList.shift();
        // get the current player's name
        this.currentPlayerName = this.users[this.currentPlayer].name;
        // put current player at the end of the list
        this.userList.push(this.currentPlayer);
    }
    
    buildPlayerList () {
        let self = this;
        let list = this.userList.sort().map((f) => {
            return self.users[f].name;
        }).join(", ");
        return "Players (" + this.userList.length + "): " + list;
    }
    
    destroy () {
        clearTimeout(this.timer);
        delete this.room.game;
    }
}

exports.commands = {
    unownsletterchain: function (target, room, user) {
        if(!room || !this.can("game")) return false;
        if(room.game) return this.send("There is already a game going on in this room! (" + room.game.gameName + ")");
        room.game = new UnownsLetterChain(room);
        this.send("A new game of Unown's Letter Chain is starting. ``" + room.commandCharacter[0] + "join`` to join the game.");
    },
    unownsletterchainjoin: function (target, room, user) {
        if(!room || !room.game || room.game.gameId !== "unownsletterchain") return false;
        room.game.onJoin(user);
    },
    unownsletterchainleave: function (target, room, user) {
        if(!room || !room.game || room.game.gameId !== "unownsletterchain") return false;
        room.game.onLeave(user);
    },
    unownsletterchainguess: function (target, room, user) {
        if(!room || !room.game || room.game.gameId !== "unownsletterchain" || !target) return false;
        room.game.onReceive(user, target);
    },
    unownsletterchainplayers: function (target, room, user) {
        if(!room || !this.can("game") || !room.game || room.game.gameId !== "unownsletterchain") return false;
        this.send(room.game.buildPlayerList());
    },
    unownsletterchainstart: function (target, room, user) {
        if(!room || !this.can("game") || !room.game || room.game.gameId !== "unownsletterchain") return false;
        room.game.onStart();
    },
    unownsletterchainend: function (target, room, user) {
        if(!room || !this.can("game") || !room.game || room.game.gameId !== "unownsletterchain") return false;
        this.send("The game was forcibly ended.");
        room.game.destroy();
    },
};