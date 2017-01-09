var Reminders = require('./models/Reminder/ReminderActions.js');
var Actions = require('./controllers/MessageActions.js');
var request = require('request');

module.exports = {};

module.exports.getOne = function(req, res){
  Reminders.getReminder(req.param.reminderCount, req.param.recipientId);
};

module.exports.getAll = function (req, res){
  Reminders.getReminder(req.param.recipientId);
};

module.exports.create = function (req, res){
  //TODO Make it a Named callback so we can reuse.
  Reminders.create(req.body.text, req.body.time, req.body.date, req.body.recipientId,function(){});
};

module.exports.clearAll = function(req,res){
  //console.log('request in clear ', req);
  Actions.clear(req.params.recipientId);
  res.sendStatus(200);
};

module.exports.getNews = function (req,res) {
  var newsSource = req.params.source;
  return fetch("https://newsapi.org/v1/articles?source=" + newsSource + "&apiKey=" + NEWS_API_KEY,{
    method: 'get'
  }).then(function(response){
    return response.json();
  }).then(function(data){
    res.status(200).send(data);
  }).catch(function(error){
    console.log('oops an error occurred');
    res.status(404).send(error);
  });
};

module.exports.getWhiteList = function (req,res) {
  return fetch("https://graph.facebook.com/v2.6/me/thread_settings?fields=whitelisted_domains&access_token="+FB_PAGE_TOKEN, {
    method: 'get'
  }).then(function(response){
    return response.json();
  }).then(function(data){
    res.status(200).send(data);
  }).catch(function(error){
    console.log('oops an error occurred');
    res.status(404).send(error);
  });
};

module.exports.removeWhiteList = function (req,res) {
  request({
    uri: 'https://graph.facebook.com/me/thread_settings',
    qs: {
      access_token: FB_PAGE_TOKEN
    },
    method: 'POST',
    json: {
      setting_type: "domain_whitelisting",
      whitelisted_domains : [
      ],
      domain_action_type : "remove"
    }
  }, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      res.status(200).send(response);
    } else {
      console.error('Unable to clear white list.');
      console.error(error);
      res.status(404).send(error);
    }
  });
};
