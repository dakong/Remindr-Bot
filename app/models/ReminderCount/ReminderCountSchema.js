var mongoose = require('mongoose'),
  Schema = mongoose.Schema;

var userReminderCountSchema = new Schema({
  recipientId: String,
  numberOfReminders: Number
});

module.exports.Model = mongoose.model("Reminder Count", userReminderCountSchema);
