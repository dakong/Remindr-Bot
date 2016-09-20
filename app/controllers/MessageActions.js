var Reminders = require('../models/Reminders.js'),
  CronJob = require('cron').CronJob,
  moment = require('moment'),
  request = require('request'),
  config = require('config');

const PAGE_ACCESS_TOKEN = config.get('pageAccessToken');

var exports = module.exports = {};


callSendAPI = function (messageData) {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: {
      access_token: PAGE_ACCESS_TOKEN
    },
    method: 'POST',
    json: messageData
  }, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      console.log('Call send api success');
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

    } else {
      console.error('Unable to send Message.');
      console.error(error);
    }
  })
};

sendTextMessage = function (recipientId, messageText) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText
    }
  };
  callSendAPI(messageData);
};

/**
 * Function that forms the message that the bot will send as a reminder to the user
 */
sendReminderMessage = function(recipientId, reminder){
  console.log('BOT IS SENDING A REMINDER');
  Reminders.actions.deleteThroughBot(reminder, function () {
    var messageData = {
      recipient: {
        id: recipientId
      },
      message: {
        text: 'Hey I\'m reminding you to ' + reminder
      }
    };
    callSendAPI(messageData);
  });
};


getCurrentDate = function(time){
  var d = moment(time, "HH:mm A");
  return new Date(d.format());
};




/**
 * Sends a list of all the reminders for the user.
 * @param recipientId id of the user we want to send the list of reminder.
 */
exports.sendReminderList = function (recipientId) {
  Reminders.actions.getAllThroughBot(function (err, reminder) {
    var reminderList;
    if (err) {
      console.log(err)
    } else {
      var reminderNames = reminder.map(function (el) {
        return el.name + ' at ' + el.time;
      });

      if (reminderNames.length) {
        reminderList = "Here are your current reminders: \n" +
          reminderNames.reduce(function (previousValue, currentValue, currentIndex, array) {
            return previousValue + '\n' + currentValue;
          });
      } else {
        reminderList = "You have no reminders set!";
      }

      console.log(reminderList);
      var messageData = {
        recipient: {
          id: recipientId
        },
        message: {
          text: reminderList
        }
      };
      callSendAPI(messageData);
    }
  });

};

/**
 * This function will create the reminder and add it to the database.
 * @param reminder The task we want to remind the user
 * @param time The time we want to send our reminder to the user
 * @param recipientId The id we want to send the user too
 */
exports.commandLineAddReminder = function (reminder, time, recipientId) {
  var msg;
  if (reminder === null || time === null) {
    //handle case
    return;
  }

  Reminders.actions.createThroughBot(reminder, time, function (returnMsg) {
    console.log(returnMsg);
    if (returnMsg.success) {
      msg = 'I\'ll remind you to ' + reminder + ' at ' + time;
      var date = getCurrentDate(time);
      console.log('creating new job at: ' + date);
      var job = new CronJob(date, function(){sendReminderMessage(recipientId, reminder)}, true, 'America/Los_Angeles');
      sendTextMessage(recipientId, msg);
    }
    else if (returnMsg.msg === 'duplicate') {
      msg = 'That reminder already exists!';
      sendTextMessage(recipientId, msg);
    }
  });
};

/**
 * Function will edit an exist reminder and add it to the database.
 * @param reminder the item we want to edit.
 * @param time the new time we want to set the reminder to.
 * @param recipientId id of the user we want to edit the reminder for.
 */
exports.commandLineUpdateReminder = function (reminder, time, recipientId) {
  var msg;
  if (reminder === null || time === null) {
    //throw an error
    return;
  }
  Reminders.actions.edit(reminder, time, function (returnMsg) {
    if (returnMsg.success) {
      console.log('edit returned true');
      msg = 'I\'ll remind you to ' + reminder + ' at ' + time + ' instead';
    }
    else {
      msg = returnMsg.msg;
    }
    sendTextMessage(recipientId, msg);
  });
};

/**
 * This will form the message to send back to the user, after they have chosen to delete a reminder.
 * @param reminder the reminder the user wants removed.
 * @param recipientId the id of the user we want to delete the reminder from.
 */
exports.commandLineDeleteReminder = function (reminder, recipientId) {
  Reminders.actions.deleteThroughBot(reminder, function () {
    var messageData = {
      recipient: {
        id: recipientId
      },
      message: {
        text: "Deleted reminder: " + reminder
      }
    };
    callSendAPI(messageData);
  });
};

/**
 * Forms the help message to send to the user.
 * @param recipientId id of the user we want to send help to.
 */
exports.commandLineHelpOptions = function (recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: "Here is a list of Remind commands:\n-add \n-time \n-delete \n-clear \n-update \n-list "
    }
  };
  callSendAPI(messageData);
};

/**
 * Clears all reminders from the database
 * @param recipientId id of the user we want to clear messages for
 */
exports.commandLineClear = function (recipientId) {
  var msg = "Reminder List has been cleared";
  Reminders.actions.clear();
  sendTextMessage(recipientId, msg);
};

/**
 * Default message to send when there is an unrecognized command
 * @param recipientId id of the user we want to send the message to
 */
exports.sendDefault = function (recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: "Unrecognized command: \nPlease use the -help option to show list of commands"
    }
  };
  callSendAPI(messageData);
};
