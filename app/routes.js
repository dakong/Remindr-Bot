var ReminderBot = require('./controllers/WitMessage.js');
var APIWrapper = require('./APIWrapper.js');

module.exports = function (app) {
  //Reminder Bot api
  app.get('/api', ReminderBot.validateToken);
  app.post('/api', ReminderBot.userSentMessage);

  app.get('/getNews/:source', APIWrapper.getNews);
  app.get('/whitelist', APIWrapper.getWhiteList);
  app.post('/clearwhitelist', APIWrapper.removeWhiteList);
  app.delete('/clearAll/:recipientId', APIWrapper.clearAll);

};