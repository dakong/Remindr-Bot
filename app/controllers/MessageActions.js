var ReminderAction = require('../models/Reminder/ReminderActions.js'),
  fs = require('fs'),
  CronJob = require('cron').CronJob,
  moment = require('moment'),
  request = require('request'),
  config = require('config'),
  uuid = require('uuid');

var PAGE_ACCESS_TOKEN;
var NEWS_API_KEY;
if (process.env.LOCAL === 'true') {
  PAGE_ACCESS_TOKEN = config.get('pageAccessToken');
  NEWS_API_KEY = config.get('newsApiKey');
}
else {
  PAGE_ACCESS_TOKEN = process.env.pageAccessToken;
  NEWS_API_KEY = process.env.newsApiKey;
}

var exports = module.exports = {};
var cronHash = {};

var callSendAPI = function (messageData) {
  console.log(messageData);
  request({
    uri: 'https://graph.facebook.com/me/messages',
    qs: {
      access_token: PAGE_ACCESS_TOKEN
    },
    method: 'POST',
    json: messageData
  }, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      console.log('Call send api success');
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

    } else {
      console.error('Unable to send Message.');
      console.error(error);
    }
  })
};

exports.setWhiteList = function(){
  request({
    uri: 'https://graph.facebook.com/me/thread_settings',
    qs: {
      access_token: PAGE_ACCESS_TOKEN
    },
    method: 'POST',
    json: {
      setting_type: "domain_whitelisting",
      whitelisted_domains : ["https://www.techcrunch.com/", "https://www.cnn.com/", "https://www.buzzfeed.com/","https://www.businessinsider.com/", "https://www.theverge.com/"],
      domain_action_type : "add"
    }
  }, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      console.log('Validated white list');
    } else {
      console.error('Unable to validate white list.');
      console.error(error);
    }
  });
};

var sendNewsListAPI = function(listData){
  request({
    uri: 'https://graph.facebook.com/me/messages',
    qs: {
      access_token: PAGE_ACCESS_TOKEN
    },
    method: 'POST',
    json: listData
  }, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      console.log('Call send api success');
      var recipientId = body.recipient_id;
      var messageId = body.message_id;
    } else {
      console.error('Unable to send Message.');
      console.error(error);
    }
  })
};

/**
 * Function that forms the message that the bot will send as a reminder to the user
 * @param {Object} reminder
 */
var sendReminderMessage = function (reminder) {
  console.log('BOT IS SENDING A REMINDER and deleting: ', reminder._id);
  ReminderAction.delete(reminder._id, reminder.recipientId);
  var messageData = {
    recipient: {
      id: reminder.recipientId
    },
    message: {
      text: 'Hey I\'m reminding you to ' + reminder.name
    }
  };
  callSendAPI(messageData);
};

/**
 * When the server initializes, it will grab the cron jobs info from the database and create them.
 * @param {Object} reminder
 */
exports.setInitialData = function (reminder) {
  console.log('creating cron jobs from the database');
  reminder.forEach(function (element) {

    var cronDate = new Date(element.cronTime);
    console.log('creating cron job at ' + cronDate);
    cronHash[element.cronJobId] = new CronJob({
      cronTime: cronDate,
      onTick: function () {
        sendReminderMessage(element);
      },
      start: true,
      timeZone: 'America/Los_Angeles'
    });
    console.log('populating cron hash: ', cronHash);
  });
};

/**
 * Sends a list of all the reminders for the user.
 * @param {String} recipientId id of the user we want to send the list of reminder.
 */
exports.sendReminderList = function (recipientId) {
  return new Promise(function (resolve, reject) {
    var promise = new Promise(function (resolve, reject) {
      resolve(ReminderAction.getAll(recipientId));
    });
    promise.then(function (reminderArray) {
      var reminderList;
      var reminderNames = reminderArray.map(function (reminder) {
        return reminder.reminderCount + ') ' + reminder.name + ' on ' + reminder.time;
      });
      if (reminderNames.length) {
        reminderList = reminderNames.reduce(function (previousValue, currentValue) {
          return previousValue + '\n' + currentValue;
        });
      }
      else {
        reminderList = '';
      }
      console.log('getting all reminders: ' + reminderList);
      return resolve('\n' + reminderList);
    });
  });
};

/**
 * Adds a reminder task and saves the time, date, and recipientId to the database
 * @param {String} reminderTask
 * @param {String} time
 * @param {String} date
 * @param {String} recipientId
 */
exports.addReminder = function (reminderTask, time, date, recipientId) {
  new Promise(function (resolve, reject) {
    resolve(ReminderAction.create(reminderTask, time, date, recipientId));
  }).then(function (result) {
    addCronJob(result.success, result.reminder, date);
  });
};

var addCronJob = function (success, reminder, date) {
  if (success) {
    var cronId = uuid.v4();
    //create our cron job
    cronHash[cronId] = new CronJob({
      cronTime: new Date(date),
      onTick: function () {
        sendReminderMessage(reminder);
      },
      start: true,
      timeZone: 'America/Los_Angeles'
    });
    ReminderAction.addCronJob(reminder, cronId);
  }
};
/**
 *
 * @param {Number} reminderNumber
 * @param {String} recipientId
 */
exports.deleteReminder = function (reminderNumber, recipientId) {
  console.log('delete reminder: ', reminderNumber);
  var promise = new Promise(function (resolve, reject) {
    resolve(ReminderAction.getReminder(reminderNumber, recipientId));
  });
  promise.then(function (result) {
    console.log('reminder object: ', result);
    new Promise(function (resolve, reject) {
      resolve(ReminderAction.delete(result.id, result.recipientId));
    }).then(function () {
      cronHash[result.cronJobId].stop();
    })
  });
};

exports.fetchArticles = function(source, recipientId){
  var newsSource = source.toLowerCase();
  return fetch("https://newsapi.org/v1/articles?source=" + newsSource + "&sortBy=top&apiKey=" + NEWS_API_KEY,{
    method: 'get'
  }).then(function(response){
    return response.json();
  }).then(function(data){
    var articles = data.articles.slice(0,4);
    var articleList = toNewsList(articles, recipientId, data.source);
    sendNewsListAPI(articleList);
  }).catch(function(error){
    console.log('oops an error occurred :(');
  });
};

var toNewsList = function(listData, recipientId, source){
  var articleList = listData.map((article) => {
    var articleUrl;

    if(source === 'techcrunch'){
      articleUrl = article.url.replace('http://social.', 'https://www.');
    }
    else if(article.url.includes('https')){
      articleUrl = article.url;
    }
    else{
      articleUrl = article.url.replace("http", 'https');
    }
    console.log('article url ', articleUrl);

    return {
      title: article.title,
      image_url: article.urlToImage,
      subtitle: article.author,
      default_action: {
        type: "web_url",
        //url: article.url.replace("http://social.", 'https://'),
        url: articleUrl,
        messenger_extensions: true,
        webview_height_ratio: "tall",
        fallback_url : articleUrl
      },
      buttons : [
        {
          title: "View",
          type: "web_url",
          url: articleUrl,
          //url: article.url.replace("http://social.", 'https://'),
          messenger_extensions: true,
          webview_height_ratio: "tall",
          fallback_url : articleUrl
        }
      ]
    }
  });
  return {
    recipient: {
      id: recipientId
    },
    message : {
      attachment : {
        type: "template",
        payload : {
          template_type: "list",
          top_element_style: "compact",
          elements : articleList
        }
      }
    }
  };
};

/**
 *
 * @param {String} recipientId
 */
exports.clearReminders = function (recipientId) {
  for (var jobId in cronHash) {
    if (cronHash.hasOwnProperty(jobId)) {
      cronHash[jobId].stop();
    }
  }
  ReminderAction.clear(recipientId);
};


