var Reminder = require('./models/Reminder/ReminderActions.js');
var ReminderBot = require('./controllers/reminders.js');
var apiReminder = require('./APIWrapper.js');

module.exports = function (app) {

  //Reminder Bot api
  app.get('/api', ReminderBot.validateToken);
  app.post('/api', ReminderBot.userSentMessage);

  app.get('/getNews/:source', ReminderBot.getNews);
  app.get('/whitelist', ReminderBot.getWhiteList);
  app.post('/clearwhitelist', ReminderBot.removeWhiteList);
  app.delete('/clearAll/:recipientId', apiReminder.api.clearAll);

};