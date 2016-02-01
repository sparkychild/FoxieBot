'use strict';
let receiveMail = function (user) {
    let myMail = Db("mail").get(user.userid, []);
    if (!myMail.length) return false;
    myMail.forEach(function(m) {
        user.sendTo("[" + getEST(m.date) + " EST] " + m.from + ": " + m.message);
    });
    Db("mail").set(user.userid, []);
    return true;
}

let sendMail = function (user, targetuserid, message) {
    //count mail
    let targetMail = Db("mail").get(targetuserid, []);
    //parse patterns
    let patternCount = 0
    targetMail.forEach(function(m) {
        if (Tools.matchText(m.message, message) > 90) patternCount++;
        if (patternCount >= 3 && !user.isStaff) {
            Monitor.mute(user.userid, 30);
            log("monitor", user.name + " was caught for suspected mail spam.");
        }
    });

    targetMail.push({
        "from": user.name,
        "date": Date.now(),
        "message": message
    });
    Db("mail").set(targetuserid, targetMail);

    user.mailCount++;
    setTimeout(function() {
        user.mailCount--;
        if (user.mailCount < 0) user.mailCount === 0;
    }.bind(this), 60000);
}

Plugins.mail = {
    "receive": receiveMail,
    "send": sendMail,
}

exports.commands = {
    mail: function(target, room, user) {
        if (!target) return this.parse("/help mail");
        let message = target.split(",").slice(1).join(",");
        if (!message || message.length > 250) return this.parse("/help mail");
        if(!user.mailCount) user.mailCount = 0;
        if (user.mailCount > 5 && !user.isStaff) return false;
        try {
            sendMail(user, this.targetUser.userid || this.targetUser, message.trim());
        }
        catch (e) {
            user.sendTo("ERROR: unable to send mail.");
        }
        user.sendTo("Swish, mail has been sent to " + (this.targetUser.name || this.targetUser));
    },
    checkmail: function(target, room, user) {
        let mail = receiveMail(user);
        if (!mail) return user.sendTo("You have no mail!");
    }
};
