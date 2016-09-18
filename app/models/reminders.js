var mongoose = require('mongoose'),
  Schema = mongoose.Schema;

var ReminderSchema = new Schema({
  name: String,
  time: String
});

var Reminder = mongoose.model("Reminders", ReminderSchema);
module.exports.actions = {};

module.exports.actions.create = function (req, res) {
  var reminder = new Reminder();
  reminder.name = req.body.name;
  console.log(reminder.name);
  reminder.save(function (err) {
    console.log('Saving');
    if (err) {
      console.log('error');
      res.send(err);
    }
    else {
      console.log('Reminder successfully created');
      res.json({message: 'Reminder created!'});
    }
  });
};

module.exports.actions.createThroughBot = function (text, time, sendMessage) {
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
        reminder.name = text;
        reminder.time = time;

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

module.exports.actions.edit = function(reminder, time, sendMessage){
  Reminder.findOneAndUpdate({
    "name": reminder
  },{
    "time": time
  }, function(err){
    if(err){
      sendMessage({'success': false, 'msg': 'Error editing ' + reminder});
    }
    else{
      console.log('Reminder successfully edited');
      sendMessage({'success':true});
    }
  });
  //Reminder.findOne({
  //  "name": reminder
  //}, function(err, reminder){
  //  if(err){
  //    sendMessage({'success': false, 'msg': 'Error editing ' + reminder});
  //  }else{
  //    if(reminder === null){
  //      sendMessage({'success':false, 'msg': 'Error reminder: ' + reminder + ' doest not exist'});
  //    }
  //    else{
  //
  //    }
  //  }
  //});
};

module.exports.actions.getAll = function (req, res) {
  Reminder.find(function (err, reminders) {
    if (err) {
      res.send(err);
    }
    console.log(reminders);
    res.json(reminders);
  });
};

module.exports.actions.getAllThroughBot = function (callBack) {
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

module.exports.actions.delete = function (req, res) {
  Reminder.remove({
    "_id": req.params.reminder_id
  }, function (err, reminder) {
    if (err) {
      res.send(err);
    }
    res.send({message: 'reminder ' + req.params.reminder_id + ' succesfully deleted'});
  });
};


module.exports.actions.deleteThroughBot = function (reminder, callBack) {
  console.log(reminder);
  Reminder.remove({
    "name": reminder
  }, function (err, reminder) {
    if (err) {
      console.log(err);
    }
    console.log('deleting', reminder);
    callBack();
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

module.exports.actions.clear = function(){
  Reminder.collection.remove({});
};
