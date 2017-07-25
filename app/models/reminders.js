let mongoose = require('mongoose'),
  Schema = mongoose.Schema,
  moment = require('moment'),
  ReminderCount = require('./userReminderCount.js');

//Schema for our Reminders
let ReminderSchema = new Schema({
  name: String,
  time: String,
  cronJobId: String,
  cronTime: Date,
  recipientId: String,
  reminderCount: Number
});

let Reminder = mongoose.model("Reminders", ReminderSchema);
module.exports.actions = {};

/**
 * Creates a new Reminder object with the correct populated fields
 * @param text of the action that is to be reminded
 * @param time when the reminder should be sent out
 * @param date of when the reminder should be sent out
 * @param recipientId the id of the user that should be reminded
 */
function CreateReminder(text, time, date, recipientId) {

  let reminder = new Reminder();

  reminder.cronTime = date;
  reminder.name = text;
  reminder.time = time;
  reminder.recipientId = recipientId;

  return reminder;
}

/**
 * Create a Reminder and save it to our Database
 * @param {Object} reminderData
 * @returns {Promise}
 */
module.exports.actions.create = function (reminderData) {

  return new Promise(function(resolve, reject) {
    Reminder.findOne({
      "name": reminderData.reminder,
      "time": reminderData.time
    }).exec().then(function (result) {

      if(result === null) {
        let reminder = CreateReminder(reminderData.reminder,
          reminderData.time, reminderData.date,
          reminderData.recipientId);

        reminder.save().then(function(res){
          resolve({'success': true, 'reminder': res});

        },function(){
          reject(Error("It Broke"));
        });
      }
      else{
        resolve({'msg': "Duplicate Reminder", 'success': false});
      }

    }, function () {
      reject(Error("It Broke"));
    });
  });
};

/**
 * Returns a list of all Reminders
 * @returns {Promise}
 */
module.exports.actions.getAll = function (recipientId) {
  return new Promise(function (resolve, reject) {
    Reminder
      .find({recipientId: recipientId})
      .sort({reminderCount: 'asc'})
      .exec()
      .then(function (reminders) {
        resolve({'success': true, 'reminders': reminders});
       }, function(){
        reject({'success': false, 'msg': "Error listing reminders"});
      });
  });
};


/**
 * Returns a JavaScript Reminder Object given the number of the reminder
 * @param reminderNumber
 * @param recipientId
 * @returns {Promise}
 */
module.exports.actions.getReminder = function (reminderNumber, recipientId) {
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
 * @param jobId
 */
module.exports.actions.addCronJob = function (reminder, jobId) {
  console.log('adding cronjob!!');
  console.log('adding cronJob: ' + jobId);
  Reminder.findOneAndUpdate({
    "name": reminder.name
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

module.exports.actions.delete = function (reminderId, recipientId) {
  console.log('reminder id: ', reminderId, 'recipientId', recipientId);
  Reminder.findOneAndRemove({"_id": reminderId, "recipientId": recipientId}, function (err, removed) {
    if (err) {
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
module.exports.actions.clear = function (recipientId) {
  console.log('clearing db for recipient: ', recipientId);
  //Reminder.find({}, function (err, reminder) {
  //  if (err) {
  //    console.log(err);
  //  } else {
  //    reminder.forEach(function (element) {
  //      stopCronJobs(element.cronJobId);
  //    });
  //  }
  //});
  Reminder.collection.remove({'recipientId': recipientId});
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

let sortReminders = function (recipientId) {
  Reminder.find({recipientId: recipientId}).sort({cronTime: 'asc'}).exec(function (err, reminders) {
    for (var i = 0, len = reminders.length; i < len; i++) {
      reminders[i].reminderCount = i + 1;
      reminders[i].save();
    }
  })
};