var mongoose = require('mongoose'),
  Schema = mongoose.Schema,
  moment = require('moment'),
  uuid = require('uuid');
/**
 * Schema for our Reminders
 */
var ReminderSchema = new Schema({
  name: String,
  time: String,
  cronJobId: String,
  cronTime: Date,
  recipientId: String
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
  }, function (err, reminders) {
    if (err) {
      sendMessage({'success': false, 'msg': 'Error adding ' + text});
    }
    else {
      if (reminders === null) {

        var reminder = new Reminder();
        reminder.cronTime = date;
        reminder.name = text;
        reminder.time = time;
        reminder.recipientId = recipientId;

        reminder.save(function (err) {
          if (err) {
            sendMessage({'success': false, 'msg': 'Error saving reminder ' + text});
          }
          else {
            console.log('Reminder successfully created');
            sendMessage({'success': true});
          }
        });
      }
      else {
        sendMessage({'success': false, 'msg': 'Reminder already exists'})
      }
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

module.exports.actions.getAll = function (callBack) {
  Reminder.find(function (err, reminders) {
    if (err) {
      callBack(err, null);
    } else {
      callBack(null, reminders);
    }
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

module.exports.actions.delete = function (reminder, callBack) {
  console.log(reminder);
  Reminder.findOne({
    "name": reminder
  },'name cronJobId', function(err, reminder){
    console.log(reminder);
    console.log('reminder: ', reminder.name);

    Reminder.remove({
      "name": reminder.name
    }, function(err){
      if(err){
        console.log(err);
      }
      callBack(reminder.cronJobId);
    });
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

module.exports.actions.clear = function (stopCronJobs) {
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
};
