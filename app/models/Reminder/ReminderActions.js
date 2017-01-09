var mongoose = require('mongoose'),
  moment = require('moment'),
  ReminderCount = require('./../ReminderCount/ReminderCountActions.js'),
  ReminderSchema = require('./ReminderSchema.js');

var Reminder = ReminderSchema.Model;
module.exports = {};

/**
 * Create a Reminder and save it to our Database
 * @param text
 * @param time
 * @param date
 * @param recipientId
 */
module.exports.create = function (text, time, date, recipientId) {
  return new Promise(function (resolve, reject) {
    Reminder.findOne({
      "name": text,
      "time": time
    }).exec().then(function (reminders) {

      if (reminders === null) {
        var reminder = new Reminder();
        reminder.cronTime = date;
        reminder.name = text;
        reminder.time = time;
        reminder.recipientId = recipientId;

        new Promise(function (resolve, reject) {
          resolve(ReminderCount.getCount(recipientId));
        }).then(function (reminderCount) {

          reminder.reminderCount = reminderCount + 1;
          reminder.save(function (err, reminder) {
            if (err) {
              //return resolve({'success': false, 'msg': 'Error saving reminder ' + text});
              return next(err);
            }
            else {
              console.log('Reminder successfully created: ', reminder);
              ReminderCount.incrementCount(recipientId);
              sortReminders(recipientId);
              return resolve({'success': true, 'reminder': reminder});
            }
          });
        });
      }
      else {
        return resolve({'success': false, 'msg': 'Error saving reminder ' + text});
      }
    });
  });
};

/**
 * Returns a JavaScript Reminder Object given the number of the reminder
 * @param reminderNumber
 * @param recipientId
 * @returns {Promise}
 */
module.exports.getReminder = function (reminderNumber, recipientId) {
  return new Promise(function (resolve, reject) {
    Reminder.findOne({
      reminderCount: reminderNumber,
      recipientId: recipientId
    }, '_id name time reminderCount recipientId cronJobId', function (err, reminder) {

      if(err){
        return next(err);
      }
      return resolve({
        id: reminder._id,
        name: reminder.name,
        time: reminder.time,
        reminderCount: reminder.reminderCount,
        recipientId: reminder.recipientId,
        cronJobId: reminder.cronJobId
      });
    });
  });
};

/**
 * Add a cronJob to a reminder
 * @param reminder
 * @param time
 * @param jobId
 */
module.exports.addCronJob = function (reminder, jobId) {
  console.log('adding cronjob!!');
  console.log('adding cronJob: ' + jobId);
  Reminder.findOneAndUpdate({
    "name": reminder.name
  }, {
    "cronJobId": jobId
  }, function (err) {
    if (err) {
      return next(err);
    }
    else {
      console.log('successfully added!');
    }
  })
};
/**
 * Returns a list of all Reminders
 * @returns {Promise}
 */
module.exports.getAll = function (recipientId) {
  return new Promise(function (resolve, reject) {
    var promise = Reminder.find({recipientId: recipientId}).sort({reminderCount: 'asc'}).exec();
    promise.then(function (reminders) {
      return resolve(reminders);
    });
  });
};

module.exports.delete = function (reminderId, recipientId) {
  console.log('reminder id: ', reminderId, 'recipientId', recipientId);
  Reminder.findOneAndRemove({"_id": reminderId, "recipientId": recipientId}, function (err, removed) {
    if (err) {
      return next(err);
    }
    console.log('removed object: ', removed);
    ReminderCount.decrementCount(recipientId);
    sortReminders(recipientId);
  });
};

/**
 * Clears all reminders from database, and stops their cron jobs
 * @param stopCronJobs
 * @param recipientId
 */
module.exports.clear = function (recipientId) {
  Reminder.collection.remove({'recipientId': recipientId});
  ReminderCount.clearCount(recipientId);
};

// module.exports.getOne = function (req, res) {
//   Reminder.findOne({
//     "_id": req.params.reminder_id
//   }, function (err, reminder) {
//     if (err) {
//       res.send(err);
//     }
//     res.send(reminder);
//   });
// };

var sortReminders = function (recipientId) {
  Reminder.find({recipientId: recipientId}).sort({cronTime: 'asc'}).exec(function (err, reminders) {
    for (var i = 0, len = reminders.length; i < len; i++) {
      reminders[i].reminderCount = i + 1;
      reminders[i].save();
    }
  })
};