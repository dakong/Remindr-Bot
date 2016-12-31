var Reminders = require('../models/reminders.js'),
  fs = require('fs'),
  CronJob = require('cron').CronJob,
  moment = require('moment'),
  request = require('request'),
  config = require('config'),
  uuid = require('uuid');

var PAGE_ACCESS_TOKEN;
if (process.env.LOCAL === 'true') {
  PAGE_ACCESS_TOKEN = config.get('pageAccessToken');
}
else {
  PAGE_ACCESS_TOKEN = process.env.pageAccessToken;
}

var exports = module.exports = {};
var cronHash = {};

var callSendAPI = function (messageData) {
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

/**
 * Function that forms the message that the bot will send as a reminder to the user
 * @param {Object} reminder
 */
var sendReminderMessage = function (reminder) {
  console.log('BOT IS SENDING A REMINDER and deleting: ', reminder._id);
  Reminders.actions.delete(reminder._id, reminder.recipientId);
  var messageData = {
    recipient: {
      id: reminder.recipientId
    },
    message: {
      text: 'Hey I\'m reminding you to ' + reminder.name
    }
  };
  callSendAPI(messageData);
};

/**
 * When the server initializes, it will grab the cron jobs info from the database and create them.
 * @param {Object} reminder
 */
exports.setInitialData = function (reminder) {
  console.log('creating cron jobs from the database');
  reminder.forEach(function (element) {

    var cronDate = new Date(element.cronTime);
    console.log('creating cron job at ' + cronDate);
    cronHash[element.cronJobId] = new CronJob({
      cronTime: cronDate,
      onTick: function () {
        sendReminderMessage(element);
      },
      start: true,
      timeZone: 'America/Los_Angeles'
    });
    console.log('populating cron hash: ', cronHash);
  });
};

/**
 * Sends a list of all the reminders for the user.
 * @param {String} recipientId id of the user we want to send the list of reminder.
 */
exports.sendReminderList = function (recipientId) {
  return new Promise(function (resolve, reject) {
    var promise = new Promise(function (resolve, reject) {
      resolve(Reminders.actions.getAll(recipientId));
    });
    promise.then(function (reminderArray) {
      var reminderList;
      var reminderNames = reminderArray.map(function (reminder) {
        return reminder.reminderCount + ') ' + reminder.name + ' on ' + reminder.time;
      });
      if (reminderNames.length) {
        reminderList = reminderNames.reduce(function (previousValue, currentValue) {
          return previousValue + '\n' + currentValue;
        });
      }
      else {
        reminderList = '';
      }
      console.log('getting all reminders: ' + reminderList);
      return resolve('\n' + reminderList);
    });
  });
};

/**
 * Adds a reminder task and saves the time, date, and recipientId to the database
 * @param {String} reminderTask
 * @param {String} time
 * @param {String} date
 * @param {String} recipientId
 */
exports.addReminder = function (reminderTask, time, date, recipientId) {
  new Promise(function (resolve, reject) {
    resolve(Reminders.actions.create(reminderTask, time, date, recipientId));
  }).then(function (result) {
    addCronJob(result.success, result.reminder, date);
  });
};

var addCronJob = function (success, reminder, date) {
  if (success) {
    var cronId = uuid.v4();
    //create our cron job
    cronHash[cronId] = new CronJob({
      cronTime: new Date(date),
      onTick: function () {
        sendReminderMessage(reminder);
      },
      start: true,
      timeZone: 'America/Los_Angeles'
    });
    Reminders.actions.addCronJob(reminder, cronId);
  }
};
/**
 *
 * @param {Number} reminderNumber
 * @param {String} recipientId
 */
exports.deleteReminder = function (reminderNumber, recipientId) {
  console.log('delete reminder: ', reminderNumber);
  var promise = new Promise(function (resolve, reject) {
    resolve(Reminders.actions.getReminder(reminderNumber, recipientId));
  });
  promise.then(function (result) {
    console.log('reminder object: ', result);
    new Promise(function (resolve, reject) {
      resolve(Reminders.actions.delete(result.id, result.recipientId));
    }).then(function () {
      cronHash[result.cronJobId].stop();
    })
  });
};

/**
 *
 * @param {String} recipientId
 */
exports.clearReminders = function (recipientId) {
  for (var jobId in cronHash) {
    if (cronHash.hasOwnProperty(jobId)) {
      cronHash[jobId].stop();
    }
  }
  Reminders.actions.clear(recipientId);
};
