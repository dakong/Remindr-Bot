var Reminder = require('./models/Reminders.js');
var ReminderBot = require('./controllers/Reminders.js');

module.exports = function (app) {

  //Reminders API
  app.post('/reminders', Reminder.actions.create);
  app.get('/reminders', Reminder.actions.getAll);
  app.get('/reminders/:reminder_id', Reminder.actions.getOne);
  app.put('/reminders/:reminder_id', Reminder.actions.update);
  app.delete('/reminders/:reminder_id', Reminder.actions.delete);

  //Reminder Bot api
  app.get('/api', ReminderBot.validateToken);
  app.post('/api', ReminderBot.userSentMessage);
}
