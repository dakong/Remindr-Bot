var mongoose = require('mongoose'),
  Schema = mongoose.Schema;

//Schema for our Reminders
var ReminderSchema = new Schema({
  name: String,
  time: String,
  cronJobId: String,
  cronTime: Date,
  recipientId: String,
  reminderCount: Number
});

module.exports.Model = mongoose.model("Reminders", ReminderSchema);