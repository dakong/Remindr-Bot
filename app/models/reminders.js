var mongoose = require('mongoose'),
      Schema = mongoose.Schema;

var ReminderSchema = new Schema({
  name : String
});

var Reminder = mongoose.model("Reminders", ReminderSchema);
module.exports.actions = {};

module.exports.actions.create = function(req,res){
  var reminder = new Reminder();
  reminder.name = req.body.name;
  console.log(reminder.name);
  reminder.save(function(err){
    console.log('Saving');
    if(err){
      console.log('error');
      res.send(err);
    }
    else{
      console.log('Reminder successfully created');
      res.json({ message: 'Reminder created!' });
    }
  });
}

module.exports.actions.createThroughBot = function(text, time){
  var reminder = new Reminder();
  reminder.name = text;
  reminder.time = time;
  console.log(reminder.name, reminder.time);
  reminder.save(function(err){
    console.log('Saving');
    if(err){
      console.log('error');
    }
    else{
      console.log('Reminder successfully created');
    }
  });
}

module.exports.actions.getAll = function(req,res){
  Reminder.find(function(err,reminders){
    if(err){
      res.send(err);
    }
    console.log(reminders);
    res.json(reminders);
  });
}

module.exports.actions.getAllThroughBot = function(callBack){
  Reminder.find(function(err,reminders){
    if(err){
      callBack(err, null);
    }else{
      callBack(null, reminders);
    }
  });


}

module.exports.actions.getOne = function(req,res){
  Reminder.findOne({
    "_id" : req.params.reminder_id
  }, function(err,reminder){
    if(err){
      res.send(err);
    }
    res.send(reminder);
  });
}

module.exports.actions.delete = function(req,res){
  Reminder.remove({
    "_id" : req.params.reminder_id
  },function(err,reminder){
    if(err){
      res.send(err);
    }
    res.send({message:'reminder ' + req.params.reminder_id + ' succesfully deleted'});
  });
}


module.exports.actions.deleteThroughBot = function(reminder){

  Reminder.remove({
    "name" : reminder
  }, function(err,reminder){
    if(err){
      res.send(err);
    }
    res.send(res.send({message:'reminder succesfully deleted'}));
  });
  /*Reminder.findOne({
    "name" : reminder
  }, function(err, reminder){
    if(err){
      res.send(err);
    }
    Reminder.remove({
      "_id" : reminder._id
    })
  })*/
}

module.exports.actions.update = function(req,res){
  Reminder.findOne({
    "_id" : req.params.reminder_id
  }, function(err,reminder){

    if(err){
      res.send(err);
    }

    reminder.name = req.body.name;
    reminder.save(function(err){
      if(err){
        res.send(err);
      }
      res.send({message: 'Reminder succesfully updated to: ' + reminder.name});
    });
  });
}
