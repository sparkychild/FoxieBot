'use strict';
exports.Plugins = {
    runCustomCommand: function(target, room, user, customCommand, pm, levelsDeep) {
        function broadcastCommand(message) {
            if (user.hasRank(room, customCommand.rank) && !pm) {
                room.send(user.userid, message);
            }
            else {
                user.sendTo(message);
            }
        }
        let broadcastText = customCommand.text;
        target = target.replace(/\, /g, ",").split(",");
        // for command aliases 
        if (broadcastText[0].indexOf("{parse}") === 0) {
            // command to parse
            let newCommand = broadcastText[0].slice(7).trim();
            return commandParser(newCommand.replace(/^\//i, (!pm ? room.commandCharacter[0] : Config.defaultCharacter[0])), user, room, !Config.monitorDefault, levelsDeep + 1);
        }
        broadcastText.forEach(function(returnText, postIndex) {
            // old custom command code from sparkyboTTT
            returnText = returnText.replace(/{arg}/g, '{arg[0]}').split('{');
            for (let i = 0; i < returnText.length; i++) {
                if (!returnText[i].replace(/ /g, '')) {
                    continue;
                }
                if (returnText[i].indexOf('}') === -1) {
                    if (i === 0 && broadcastText[postIndex].trim().charAt(0) !== '{') {
                        continue;
                    }
                    returnText[i] = '{' + returnText[i];
                    continue;
                }
                let tarRep = returnText[i].split('}')[0];
                //check if all the neccesary components are here
                if (tarRep.indexOf(']') !== tarRep.length - 1 || tarRep.indexOf('[') < 1) {
                    if (['arg', 'rand'].indexOf(tarRep.replace(/[^a-z]/g, '')) === 0 || toId(tarRep).substr(0, 6) === 'choose') {
                        returnText[i] = '{' + returnText[i];
                        continue;
                    }
                }
                let tarFunction = tarRep.split('}')[0].split('[')[0];
                //determine value of variable
                let value, rand;
                if (tarRep.indexOf(']') === tarRep.length - 1 && tarRep.indexOf('[') > 0 && tarRep.indexOf('[') < tarRep.indexOf(']')) {
                    value = tarRep.split('[')[1].split(']')[0];
                }
                //different things to do to differnet 'functions';
                switch (tarFunction) {
                    case 'arg':
                        if (!value) {
                            returnText[i] = '{' + returnText[i];
                            continue;
                        }
                        returnText[i] = returnText[i].replace(tarRep + '}', target[value] || '');
                        break;
                    case 'rand':
                        if (!value) {
                            returnText[i] = '{' + returnText[i];
                            continue;
                        }
                        rand = ~~(Math.random() * value) + 1;
                        returnText[i] = returnText[i].replace(tarRep + '}', rand);
                        break;
                    case 'choose':
                        if (!value) {
                            returnText[i] = '{' + returnText[i];
                            continue;
                        }
                        value = value.split(',');
                        rand = ~~(Math.random() * value.length);
                        returnText[i] = returnText[i].replace(tarRep + '}', value[rand].trim());
                        break;
                    case 'pick':
                        if (!arg[0]) {
                            returnText[i] = '';
                            continue;
                        }
                        rand = ~~(Math.random() * arg.length);
                        returnText[i] = returnText[i].replace(tarRep + '}', arg[rand])
                        break;
                    default:
                        returnText[i] = '{' + returnText[i];
                        break;
                }
            }
            returnText = returnText.join('');
            returnText = returnText.replace(/\{by\}/g, user.name);
            returnText = returnText.replace(/\{arg\/by\}/g, target[0] || user.name);
            returnText = removeCommand(returnText).replace('//me', '/me').replace('//declare', '/declare').replace('//wall', '/wall').replace('!!data', '!data').replace(' !dt', '!dt').replace('//tour', '/tour').replace('//poll', '/poll').replace(' !showimage', '!showimage').replace('//pdeclare', '/pdeclare').replace(' !pick', '!pick');
            broadcastCommand(returnText);
        });
    },
};
