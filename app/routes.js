var Reminder = require('./models/reminders.js');
var ReminderBot = require('./controllers/reminders.js');
var apiReminder = require('./APIWrapper.js');

module.exports = function (app) {

  //Reminder Bot api
  app.get('/api', ReminderBot.validateToken);
  app.post('/api', ReminderBot.userSentMessage);
  app.delete('/clearAll/:recipientId', apiReminder.api.clearAll);
};
