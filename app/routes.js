var Reminder = require('./models/reminders.js');
var ReminderBot = require('./controllers/reminders.js');
var apiReminder = require('./APIWrapper.js');

module.exports = function (app) {

  //Reminders API
  app.post('/reminders', apiReminder.api.create);
  app.get('/reminders/:recipientId', apiReminder.api.getAll);
  app.get('/reminders/:recipientId/:reminderCount', apiReminder.api.getReminder);
  app.put('/reminders/:reminder_id', apiReminder.api.update);
  app.delete('/reminders/:reminder_id', apiReminder.api.delete);

  //Reminder Bot api
  app.get('/api', ReminderBot.validateToken);
  app.post('/api', ReminderBot.userSentMessage);
};
