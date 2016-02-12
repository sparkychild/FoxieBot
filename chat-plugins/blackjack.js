'use strict';
const values = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const cardTypes = ["D", "C", "H", "S"];
const symbols = {
    "D": "♦",
    "H": "♥",
    "S": "♠",
    "C": "♣",
};

class blackjackGame extends Rooms.botGame {
    constructor(room) {
        super(room);
        
        this.currentPlayer = null;
        this.allowJoins = true;
        this.state = "signups";
        this.gameId = "blackjack";
        this.gameName = "Blackjack";
        this.answerCommand = "special";
        this.dealer = new blackjackGamePlayer({name: "Blackjack Game Dealer", userid: "blackjackgamedealer"});
    }
    
    onJoin (user) {
        if(!this.allowJoins || this.state !== "signups") return;
        if(this.userList.includes(user.userid)) return user.sendTo("You have already joined!");
        this.users[user.userid] = new blackjackGamePlayer(user);
        this.userList.push(user.userid);
        user.sendTo("You have joined the game of " + this.gameName + ".");
    }
    shuffleDeck () {
        let deck = [];
        values.forEach((v) =>{
            cardTypes.forEach((t) => {
                deck.push({"value": v, "type": t});
            });
        });
        return this.deck = deck.randomize();
    }
    
    onStart () {
        if(this.userList.length < 1 || this.state === "started") return false;
        this.state = "started";
        
        this.shuffleDeck();
        let cardQueue = this.userList.concat(this.userList);
        let self = this;
        
        // give dealer two cards
        this.giveCard("blackjackgamedealer");
        this.giveCard("blackjackgamedealer");
        
        // deal 2 cards for each player;
        cardQueue.forEach((u, index) => {
            self.giveCard(toId(u), index < this.userList.length);
        });
        this.sendRoom("Dealer's top card: [" + symbols[this.dealer.hand[0].type] + this.dealer.hand[0].value + "].");
        this.setNextPlayer();
        this.initTurn();
    }
    
    initTurn () {
        let player = this.users[this.currentPlayer];
        player.sendHand();
        this.sendRoom(player.name + "'s turn. (" + this.room.commandCharacter[0] + "hit or " + this.room.commandCharacter[0] + "stay.)");
        let self = this;
        this.timer = setTimeout(() => {
            this.users[this.currentPlayer].completedTurn = true;
            if (self.eliminate()) {
                self.initTurn();
            }
        }, 90000);
    }
    
    giveCard (userid, announce) {
        let card = this.deck.shift();
        if (!this.deck.length) this.shuffleDeck();
        let player = userid === "blackjackgamedealer" ? this.dealer : this.users[userid];
        player.receiveCard(card);
        if (announce) this.sendRoom(player.name + "'s top card: [" + symbols[card.type] + card.value + "].");
    }
    
    onHit (user) {
        if (this.state !== "started" || user.userid !== this.currentPlayer) return false;
        let player = this.users[user.userid];
        this.giveCard(user.userid);
        player.sendHand();
        if (player.total > 21) {
            this.sendRoom(player.name + " has busted with " + player.total + ".");
            this.onTurnEnd(user);
        }
    }
    
    onTurnEnd (user) {
        if (this.state !== "started" || (user && user.userid !== this.currentPlayer)) return false;
        this.users[this.currentPlayer].completedTurn = true;
        clearTimeout(this.timer);
        if (!this.setNextPlayer()) return this.onEnd();
        this.initTurn();
    }
    
    setNextPlayer () {
        if(this.userList.length === 0) return false;
        // get first player in the list
        this.currentPlayer = this.userList.shift();
        // put current player at the end of the list
        this.userList.push(this.currentPlayer);
        // check if all players have moved
        if (this.users[this.currentPlayer].completedTurn) return false;
        return true;
    }
    
    onEnd () {
        // sum up dealer
        while (this.dealer.total < 17) {
            this.giveCard("blackjackgamedealer");
        }
        
        this.sendRoom("The dealer has " + (this.dealer.total > 21 ? "busted with " : "") + "a total of " + this.dealer.total + ".");
        
        // sum up players
        let passingPlayers = [];
        for(var p in this.users) {
            // ignore the dealer's data
            if(this.users[p].userid === "blackjackgamedealer" || this.users[p].total > 21) continue;
            if(this.users[p].total > this.dealer.total || this.dealer.total > 21) {
                passingPlayers.push(this.users[p].name);
            }
        }
        if(!passingPlayers.length) {
            this.sendRoom("Sorry, no winners this time!");
        } else {
            this.sendRoom("The winner" + (passingPlayers.length > 1 ? "s are" : " is") + ": " + passingPlayers.join(",") + ".");
        }
        this.destroy();
    }
    
    eliminate (userid) {
        userid = userid || this.currentPlayer;
        //remove players
        delete this.users[userid];
        this.userList.splice(this.userList.indexOf(userid), 1);
        
        if (!this.setNextPlayer()) {
            this.onEnd();
            return false;
        }
        return true;
    }
    
    buildPlayerList () {
        let self = this;
        let list = this.userList.map((f) => {
            return self.users[f].name;
        }).sort().join(", ");
        return "Players (" + this.userList.length + "): " + list;
    }
}

class blackjackGamePlayer extends Rooms.botGamePlayer {
    constructor (user, game) {
        super (user);
        
        this.hand = [];
        this.total = 0;
        this.completedTurn = false;
    }
    
    sendHand () {
        // build hand
        let hand = this.hand.sort((a, b) => {
            // sort by value first
            if(values.indexOf(a.value) > values.indexOf(b.value)) return 1;
            if(values.indexOf(a.value) < values.indexOf(b.value)) return -1;
            // if values are the same, sort by suit
            if(cardTypes.indexOf(a.type) > cardTypes.indexOf(b.type)) return 1;
            return -1;
        }).map((c) => {
            return "[" + symbols[c.type] + c.value + "]";
        }).join(", ");
        this.user.sendTo("Your hand: " + hand + ". Total: " + this.total);
    }
    
    receiveCard (card) {
        this.hand.push(card);
        this.getHandTotal();
    }
    
    getHandTotal () {
        let aceCount = 0;
        let total = 0;
        this.hand.forEach((c) => {
            let value = c.value;
            if(value === "A") {
                aceCount++;
                value = 11;
            }
            if (["J", "Q", "K"].includes(value)) {
                value = 10;
            }
            total += parseInt(value);
        });
        while (total > 21 && aceCount > 0) {
            total -= 10;
            aceCount -= 1;
        }
        return this.total = total;
    }
}

exports.commands = {
    blackjack: function (target, room, user) {
        if (!room || !this.can("games")) return false;
        if(room.game) return this.send("There is already a game going on in this room! (" + room.game.gameName + ")");
        room.game = new blackjackGame(room);
        this.send("A new game of Blackjack is starting. ``" + room.commandCharacter[0] + "join`` to join the game.");
    },
    blackjackstart: function (target, room, user) {
        if (!room || !this.can("games") || !room.game || room.game.gameId !== "blackjack") return false;
        room.game.onStart();
    },
    blackjackplayers: function (target, room, user) {
        if (!room || !this.can("games") || !room.game || room.game.gameId !== "blackjack") return false;
        this.send(room.game.buildPlayerList());
    },
    blackjackend: function (target, room, user) {
        if (!room || !this.can("games") || !room.game || room.game.gameId !== "blackjack") return false;
        room.game.destroy();
        this.send("The game of blackjack was forcibly ended.");
    },
    hit: function (target, room, user) {
        if (!room || !room.game || room.game.gameId !== "blackjack") return false;
        room.game.onHit(user);
    },
    blackjackjoin: function (target, room, user) {
        if (!room || !room.game || room.game.gameId !== "blackjack") return false;
        room.game.onJoin(user);
    },
    blackjackleave: function (target, room, user) {
        if (!room || !room.game || room.game.gameId !== "blackjack") return false;
        room.game.onLeave(user);
    },
    stay: function (target, room, user) {
        if (!room || !room.game || room.game.gameId !== "blackjack") return false;
        room.game.onTurnEnd(user);        
    },
};