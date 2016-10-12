var mongoose = require('mongoose'),
  Schema = mongoose.Schema,
  moment = require('moment'),
  uuid = require('uuid'),
  ReminderCount = require('./userReminderCount.js');

//Schema for our Reminders
var ReminderSchema = new Schema({
  name: String,
  time: String,
  cronJobId: String,
  cronTime: Date,
  recipientId: String,
  reminderCount: Number
});

var Reminder = mongoose.model("Reminders", ReminderSchema);
module.exports.actions = {};

/**
 * Create a Reminder and save it to our Database
 * @param text
 * @param time
 * @param date
 * @param recipientId
 * @param sendMessage
 */
module.exports.actions.create = function (text, time, date, recipientId, sendMessage) {
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
        resolve(ReminderCount.actions.getCount(recipientId));
      }).then(function (reminderCount) {
        reminder.reminderCount = reminderCount + 1;
        reminder.save(function (err, reminder) {
          if (err) {
            sendMessage({'success': false, 'msg': 'Error saving reminder ' + text});
          }
          else {
            console.log('Reminder successfully created: ', reminder);
            ReminderCount.actions.incrementCount(recipientId);
            sortReminders(recipientId);
            sendMessage({'success': true}, reminder);
          }
        });
      });
    }
    else {
      sendMessage({'success': false, 'msg': 'Reminder already exists'})
    }
  });
};

/**
 * Returns a JavaScript Reminder Object given the number of the reminder
 * @param reminderNumber
 * @param recipientId
 * @returns {Promise}
 */
module.exports.actions.getReminder = function (reminderNumber, recipientId) {
  console.log('==== Get Reminder ====');
  console.log('reminder number: ', reminderNumber, 'recipient id', recipientId);
  return new Promise(function (resolve, reject) {
    Reminder.findOne({
      reminderCount: reminderNumber,
      recipientId: recipientId
    }, '_id name time reminderCount recipientId cronJobId', function (err, reminder) {

      console.log('reminder object: ', reminder);
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
module.exports.actions.addCronJob = function (reminder, time, jobId) {
  console.log('adding cronJob: ' + jobId);
  Reminder.findOneAndUpdate({
    "name": reminder
  }, {
    "cronJobId": jobId
  }, function (err) {
    if (err) {
      console.log('error');
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
module.exports.actions.getAll = function (recipientId) {
  return new Promise(function (resolve, reject) {
    var promise = Reminder.find({recipientId: recipientId}).sort({reminderCount: 'asc'}).exec();
    promise.then(function (reminders) {
      return resolve(reminders);
    });
  });
};

module.exports.actions.delete = function (reminderId, recipientId) {
  console.log('==== deleting reminder ====');
  console.log('reminder id: ', reminderId, 'recipientId', recipientId);
  Reminder.findOneAndRemove({"_id": reminderId, "recipientId": recipientId}, function (err, removed) {
    if (err) {
      console.log('==== error in delete ====');
      console.log(err);
    }
    console.log('removed object: ', removed);
    ReminderCount.actions.decrementCount(recipientId);
    sortReminders(recipientId);
  });
};

module.exports.actions.edit = function (reminder, time, sendMessage) {
  Reminder.findOneAndUpdate({
    "name": reminder
  }, {
    "time": time
  }, function (err) {
    if (err) {
      sendMessage({'success': false, 'msg': 'Error editing ' + reminder});
    }
    else {
      console.log('Reminder successfully edited');
      sendMessage({'success': true});
    }
  });
};

module.exports.actions.update = function (req, res) {
  Reminder.findOne({
    "_id": req.params.reminder_id
  }, function (err, reminder) {

    if (err) {
      res.send(err);
    }

    reminder.name = req.body.name;
    reminder.save(function (err) {
      if (err) {
        res.send(err);
      }
      res.send({message: 'Reminder successfully updated to: ' + reminder.name});
    });
  });
};

/**
 * Clears all reminders from database, and stops their cron jobs
 * @param stopCronJobs
 * @param recipientId
 */
module.exports.actions.clear = function (recipientId, stopCronJobs) {
  console.log('clearing db');
  Reminder.find({}, function (err, reminder) {
    if (err) {
      console.log(err);
    } else {
      reminder.forEach(function (element) {
        stopCronJobs(element.cronJobId);
      });
    }
  });
  Reminder.collection.remove({});
  ReminderCount.actions.clearCount(recipientId);
};

module.exports.actions.getOne = function (req, res) {
  Reminder.findOne({
    "_id": req.params.reminder_id
  }, function (err, reminder) {
    if (err) {
      res.send(err);
    }
    res.send(reminder);
  });
};

sortReminders = function (recipientId) {
  Reminder.find({recipientId: recipientId}).sort({cronTime: 'asc'}).exec(function (err, reminders) {
    for (var i = 0, len = reminders.length; i < len; i++) {
      reminders[i].reminderCount = i + 1;
      reminders[i].save();
    }
  })
};