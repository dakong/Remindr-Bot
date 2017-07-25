var Reminder = require('./models/reminders.js');
//var ReminderBot = require('./controllers/APIAI.js');
var apiReminder = require('./APIWrapper.js');
let API_AI = require('./controllers/APIAI.js');

module.exports = function (app) {

  app.post('/SendMessage', API_AI.HandleMessage);
  //Reminder Bot api
  //app.get('/api', ReminderBot.validateToken);
  //app.post('/api', ReminderBot.userSentMessage);
  //app.get('/getNews/:source', ReminderBot.getNews);
  //app.delete('/clearAll/:recipientId', apiReminder.api.clearAll);

};
