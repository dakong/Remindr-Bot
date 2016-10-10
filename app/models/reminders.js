var mongoose = require('mongoose'),
  Schema = mongoose.Schema,
  moment = require('moment'),
  uuid = require('uuid'),
  ReminderCount = require('./userReminderCount.js');
/**
 * Schema for our Reminders
 */
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
  }).exec().then(function(reminders){
    if (reminders === null) {
      var reminder = new Reminder();
      reminder.cronTime = date;
      reminder.name = text;
      reminder.time = time;
      reminder.recipientId = recipientId;

      new Promise(function(resolve,reject){
        resolve(ReminderCount.actions.getCount(recipientId));
      }).then(function (reminderCount) {
        reminder.reminderCount = reminderCount + 1;
        reminder.save(function (err) {
          if (err) {
            sendMessage({'success': false, 'msg': 'Error saving reminder ' + text});
          }
          else {
            console.log('Reminder successfully created');
            ReminderCount.actions.incrementCount(recipientId);
            sortReminders(recipientId);
            sendMessage({'success': true});
          }
        });
      });
    }
    else {
      sendMessage({'success': false, 'msg': 'Reminder already exists'})
    }
  });
};

module.exports.actions.addCronJob = function(reminder, time, jobId){
  console.log('adding cronJob: ' + jobId);
  Reminder.findOneAndUpdate({
    "name": reminder
  }, {
    "cronJobId": jobId
  }, function(err){
    if(err){
      console.log('error');
    }
    else{
      console.log('successfully added!');
    }
  })
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


//TODO Get reminders for recipients. We need to specify the recipient we are getting the reminder list.

module.exports.actions.getAll = function () {
  return new Promise(function(resolve,reject) {
    var reminderList;
    var promise = Reminder.find({}).sort({reminderCount: 'asc'}).exec();
    promise.then(function (reminders) {
      console.log('mongoose promises');
      var reminderNames = reminders.map(function (el) {
        return el.reminderCount + ') ' + el.name + ' at ' + el.time;
      });
      if (reminderNames.length) {
        reminderList = reminderNames.reduce(function (previousValue, currentValue, currentIndex, array) {
          return previousValue + '\n' + currentValue;
        });
      }
      else {
        reminderList = '';
      }
      console.log(reminderList);
      return resolve(reminderList);
    });
  });
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

module.exports.actions.delete = function (reminderNumber, sendMessage) {
  Reminder.findOne({
    "reminderCount": reminderNumber
  }, 'name cronJobId recipientId', function (err, reminder) {

    console.log('removing reminder: ', reminderw);
    Reminder.remove({
      "name": reminder.name
    }).exec().then(function (err) {
      if (err) {
        console.log(err);
      }
      ReminderCount.actions.decrementCount(reminder.recipientId).exec().then(function(){
        sortReminders(reminder.recipientId);
        });
      sendMessage(reminder.cronJobId);
    });
  });
};

sortReminders = function(recipientId){
  Reminder.find({recipientId: recipientId}).sort({cronTime: 'asc'}).exec(function(err,reminders) {
    for(var i = 0, len = reminders.length; i < len; i++){
      reminders[i].reminderCount = i + 1;
      reminders[i].save();
    }
  })

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

module.exports.actions.clear = function (stopCronJobs, recipientId) {
  console.log('clearing db');
  Reminder.find({},function(err, reminder){
    if(err){
      console.log(err);
    }else{
      reminder.forEach(function(element){
        stopCronJobs(element.cronJobId);
      });
    }
  });
  Reminder.collection.remove({});
  ReminderCount.actions.clearCount(recipientId);
};
