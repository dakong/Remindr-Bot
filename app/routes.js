var Reminder = require('./models/reminders.js');
var ReminderBot = require('./controllers/reminders.js');
var apiReminder = require('./APIWrapper.js');

module.exports = function (app) {

  //Reminders API
  app.post('/reminders', apiReminder.actions.create);
  app.get('/reminders/:recipientId', apiReminder.actions.getAll);
  app.get('/reminders/:recipientId/:reminderCount', apiReminder.actions.getReminder);
  app.put('/reminders/:reminder_id', apiReminder.actions.update);
  app.delete('/reminders/:reminder_id', apiReminder.actions.delete);

  //Reminder Bot api
  app.get('/api', ReminderBot.validateToken);
  app.post('/api', ReminderBot.userSentMessage);
};
