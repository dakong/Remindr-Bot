var Reminders = require('./models/reminders.js');

module.exports.api = {};

module.exports.api.getOne = function(req, res){
  Reminders.actions.getReminder(req.param.reminderCount, req.param.recipientId);
};

module.exports.api.getAll = function (req, res){
  Reminders.actions.getReminder(req.param.recipientId);
};

module.exports.api.create = function (req, res){
  //TODO Make it a Named callback so we can reuse.
  Reminders.actions.create(req.body.text, req.body.time, req.body.date, req.body.recipientId,function(){});
};

module.exports.api.delete = function(req,res){

};