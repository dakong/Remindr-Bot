const Reminders = require('../models/reminders.js'),
  messageActions = require('./MessageActions.js'),
  config = require('config'),
  {Wit, log} = require('node-wit'),
  moment = require('moment');

var WIT_TOKEN;
var VALIDATION_TOKEN;
var FB_PAGE_TOKEN;
var NEWS_API_KEY;
//Get our Tokens
if (process.env.LOCAL === 'true') {
  WIT_TOKEN = config.get('witToken');
  VALIDATION_TOKEN = config.get('validationToken');
  FB_PAGE_TOKEN = config.get('pageAccessToken');
  NEWS_API_KEY = config.get('newsApiKey');
}
else {
  WIT_TOKEN = process.env.witToken;
  console.log(WIT_TOKEN);
  VALIDATION_TOKEN = process.env.validationToken;
  FB_PAGE_TOKEN = process.env.pageAccessToken;
  NEWS_API_KEY = process.env.newsApiKey;
}

const DEBUG = 1;

// Print out information about a wit ai actions
function printWitLogs(sessionId, recipientId, text, context, entities) {
  "use strict";
  console.log(`Session ${sessionId} received ${text}`);
  console.log(`RecipientId ${recipientId}`);
  console.log(`The current context is ${JSON.stringify(context)}`);
  console.log(`Wit extracted ${JSON.stringify(entities)}`);
}

module.exports = {};

/**
 * Validate our WebHook and Token with FaceBook.
 * @param req
 * @param res
 */
module.exports.validateToken = function (req, res) {
  if (req.query['hub.mode'] === 'subscribe' &&
    req.query['hub.verify_token'] === VALIDATION_TOKEN) {
    console.log("Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);
  }
};

// ----------------------------------------------------------------------------
// Wit.ai bot specific code

// This will contain all user sessions.
// Each session has an entry:
// sessionId -> {fbid: facebookUserId, context: sessionState}
const sessions = {};

const findOrCreateSession = (fbid) => {
  let sessionId;
  // Let's see if we already have a session for the user fbid
  Object.keys(sessions).forEach(k => {
    if (sessions[k].fbid === fbid) {
      // Yep, got it!
      sessionId = k;
    }
  });
  if (!sessionId) {
    // No session found for user fbid, let's create a new one
    sessionId = new Date().toISOString();
    sessions[sessionId] = {fbid: fbid, context: {}};
  }
  return sessionId;
};

const firstEntityValue = (entities, entity) => {
  const val = entities && entities[entity] &&
      Array.isArray(entities[entity]) &&
      entities[entity].length > 0 &&
      entities[entity][0].value
    ;
  if (!val) {
    return null;
  }
  return typeof val === 'object' ? val.value : val;
};

//Format our FB message and make our API call to FB messenger
const fbMessage = (id, text) => {
  const body = JSON.stringify({
    recipient: {id},
    message: {text}
  });
  const qs = 'access_token=' + FB_PAGE_TOKEN;
  return fetch('https://graph.facebook.com/me/messages?' + qs, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body
  })
    .then(rsp => rsp.json())
    .then(json => {
      if (json.error && json.error.message) {
        throw new Error(json.error.message);
      }
      return json;
    });
};

//Our Wit.AI Bot Actions
const actions = {
  send({sessionId}, {text}) {
    // Our bot has something to say!
    // Let's retrieve the Facebook user whose session belongs to
    const recipientId = sessions[sessionId].fbid;
    console.log('recipient id in send ' + recipientId);
    console.log('our text: ', text);
    if (recipientId) {
      // Yay, we found our recipient!
      // Let's forward our bot response to her.
      // We return a promise to let our bot know when we're done sending
      return fbMessage(recipientId, text)
        .then(() => null)
        .catch((err) => {
          console.error(
            'Oops! An error occurred while forwarding the response to',
            recipientId,
            ':',
            err.stack || err
          );
        });
    } else {
      console.error('Oops! Couldn\'t find user for session:', sessionId);
      // Giving the wheel back to our bot
      return Promise.resolve()
    }
  },
  // Action to add a reminder
  addReminder({context, entities, sessionId, text}){
    const recipientId = sessions[sessionId].fbid;
    if (DEBUG) printWitLogs(sessionId, recipientId,  text, context, entities);
    return new Promise(function (resolve, reject) {
      if (entities.datetime !== undefined) {
        var reminder = context.missingTime ? context.reminder : entities.reminder[0].value,
          cronDate,
          reminderTime,
          date = entities.datetime[0].value;

        if(date !== undefined){
          cronDate = date;
          reminderTime = moment(date).utcOffset('-0800').format('MMMM Do, h:mm a');
        }
        else if(entities.datetime[0].values[0].to !== undefined || entities.datetime[0].values[0].from !== undefined){
          var dateRangeTo = new Date(entities.datetime[0].values[0].to.value),
            dateRangeFrom = new Date(entities.datetime[0].values[0].from.value);
          cronDate = (dateRangeTo.getTime() + dateRangeFrom.getTime())/2;
          reminderTime = moment(cronDate).utcOffset('-0800').format('MMMM Do, h:mm a');
        }
        messageActions.addReminder(reminder, reminderTime, cronDate, recipientId);
        context.time = reminderTime;
        context.done = true;
        delete context.missingTime;
      }
      else {
        context.missingTime = true;
        context.reminder = entities.reminder[0].value;
        delete context.time;
      }
      return resolve(context);
    });
  },
  //Action to list the current user's reminder
  listReminders({context, sessionId, text, entities}){
    const recipientId = sessions[sessionId].fbid;

    if (DEBUG) printWitLogs(sessionId, recipientId, text, context, entities);
    return new Promise(function (resolve, reject) {
      var promise = new Promise(function (resolve, reject) {
        resolve(messageActions.sendReminderList(recipientId));
      });
      promise.then(function (result) {
        context.listOfReminders = result;
        context.done = true;
        return resolve(context);
      });
    });
  },
  //Action to delete a specific reminder
  deleteReminder({context, sessionId, text, entities}){
    const recipientId = sessions[sessionId].fbid;

    if (DEBUG) printWitLogs(sessionId, recipientId,  text, context, entities);

    return new Promise(function (resolve, reject) {
      var reminderNumber = entities.number[0].value;
      messageActions.deleteReminder(reminderNumber, recipientId);
      context.done = true;
      return resolve(context);
    });
  },
  //Action to generate a thank you response
  generateThankYou({context, sessionId, text}){
    const recipientId = sessions[sessionId].fbid;
    return new Promise(function (resolve, reject) {
      const randomOption = Math.floor((Math.random() * 3) + 1);
      switch (randomOption) {
        case 1:
          context.responseOne = true;
          delete context.responseTwo;
          delete context.responseThree;
          break;
        case 2:
          context.responseTwo = true;
          delete context.responseOne;
          delete context.responseThree;
          break;
        case 3:
          context.responseThree = true;
          delete context.responseTwo;
          delete context.responseOne;
          break;
      }
      context.done = true;
      return resolve(context);
    });
  }
};

//create our wit object
const wit = new Wit({
  accessToken: WIT_TOKEN,
  actions,
  logger: new log.Logger(log.INFO)
});

/**
 * Handles what the Chat bot should send back when we receive a message / event from a user.
 * @param req
 * @param res
 */
module.exports.userSentMessage = function (req, res) {
  var data = req.body;
  console.log('user sent message');
  // Make sure this is a page subscription
  if (data.object == 'page') {
    // Iterate over each entry
    data.entry.forEach(function (pageEntry) {
      var pageID = pageEntry.id;
      var timeOfEvent = pageEntry.time;
      // Iterate over each messaging event
      pageEntry.messaging.forEach(function (messagingEvent) {
        if (messagingEvent.message) {
          const {text} = messagingEvent.message;
          const sender = messagingEvent.sender.id;
          const sessionId = findOrCreateSession(sender);
          //console.log('find or create session');
          //console.log(sessions);
          if (text) {
            // Let's forward the message to the Wit.ai Bot Engine
            // This will run all actions until our bot has nothing left to do
            wit.runActions(
              sessionId, // the user's current session
              text, // the user's message
              sessions[sessionId].context // the user's current session state
            ).then((context) => {
              //If the task is done, then we delete the session. Otherwise we keep the context.
              if (context['done']) {
                delete sessions[sessionId];
              }
              else {
                sessions[sessionId].context = context;
              }
            })
              .catch((err) => {
                console.error('Oops! Got an error from Wit: ', err.stack || err);
              });
          } else if (messagingEvent.delivery) {
            receivedDeliveryConfirmation(messagingEvent);
          } else {
            console.log("Webhook received unknown messagingEvent: ", messagingEvent);
          }
        }
      });
    });
    res.sendStatus(200);
  }
};

/**
 * Handles when we received delivery confirmation. When the user sees the message.
 * @param event
 */
function receivedDeliveryConfirmation(event) {
  console.log('inside received delivery confirmation event');
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var delivery = event.delivery;
  var messageIDs = delivery.mids;
  var watermark = delivery.watermark;
  var sequenceNumber = delivery.seq;

  if (messageIDs) {
    messageIDs.forEach(function (messageID) {
      console.log("Received delivery confirmation for message ID: %s",
        messageID);
    });
  }

  console.log("All message before %d were delivered.", watermark);
}

function receivedAuthentication(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfAuth = event.timestamp;

  // The 'ref' field is set in the 'Send to Messenger' plugin, in the 'data-ref'
  // The developer can set this to an arbitrary value to associate the
  // authentication callback with the 'Send to Messenger' click event. This is
  // a way to do account linking when the user clicks the 'Send to Messenger'
  // plugin.
  var passThroughParam = event.optin.ref;

  console.log("Received authentication for user %d and page %d with pass " +
    "through param '%s' at %d", senderID, recipientID, passThroughParam,
    timeOfAuth);

  //comment for now`
  /*messageActions.sendTextMessage(senderID, "Authentication successful");*/
}

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