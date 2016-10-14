const Reminders = require('../models/reminders.js'),
  messageActions = require('./MessageActions.js'),
  config = require('config'),
  {Wit,log} = require('node-wit'),
  moment = require('moment');

var WIT_TOKEN;
var VALIDATION_TOKEN;
var FB_PAGE_TOKEN;
/** Get our tokens **/
if(process.env.LOCAL === 'true'){
  WIT_TOKEN = config.get('witToken');
  VALIDATION_TOKEN = config.get('validationToken');
  FB_PAGE_TOKEN = config.get('pageAccessToken');
}
else{
  WIT_TOKEN = process.env.witToken;
  console.log(WIT_TOKEN);
  VALIDATION_TOKEN = process.env.validationToken;
  FB_PAGE_TOKEN = process.env.pageAccessToken;
}


const DEBUG = 1;

// ----------------------------------------------------------------------------
// Debug Function

// Print out information about a wit ai actions
function printWitLogs(sessionId, recipientId, text, context, entities){
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

const fbMessage = (id, text) => {
  const body = JSON.stringify({
    recipient: { id },
    message: { text }
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

//Our Bot Actions
const actions = {
  send({sessionId}, {text}) {
    // Our bot has something to say!
    // Let's retrieve the Facebook user whose session belongs to
    const recipientId = sessions[sessionId].fbid;
    console.log('recipient id in send ' + recipientId);
    console.log('our text: ',text);
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
  addReminder({context, entities, sessionId, text}){
    console.log('=====Adding reminders=====');
    const recipientId = sessions[sessionId].fbid;
    if(DEBUG) printWitLogs(sessionId,text,recipientId, context, entities);
    return new Promise(function(resolve, reject) {
      if(entities.datetime !== undefined) {
        console.log('not supposed to be here');
        var reminder = context.missingTime ? context.reminder : entities.reminder[0].value;
        var date = entities.datetime[0].value;
        var time = moment(entities.datetime[0].value).utcOffset('-0700').format('h:mm a');
        console.log('=====time in add reminder=====: ' + time);
        console.log('=====time in entity date time reminder=====: ' + entities.datetime[0].value);
        messageActions.addReminder(reminder, time, date, recipientId);
        context.time = time;
        context.finishedAdding = true;
        delete context.missingTime;
      }else{
        context.missingTime = true;
        context.reminder = entities.reminder[0].value;
        delete context.time;
      }
      return resolve(context);
    });
  },
  clearOrListReminders({context,sessionId,text,entities}){
    console.log('=====clear or list reminders=====');

    const recipientId = sessions[sessionId].fbid;
    if(DEBUG) printWitLogs(sessionId,text,recipientId, context, entities);

    return new Promise(function(resolve, reject){
      var action = firstEntityValue(entities, 'action');
      console.log('action: ' + action);
      if(action === 'list'){
        console.log('inside list');
        //context.listOfReminder = messageActions.sendReminderList(recipientId);
        context.list = true;
        delete context.clear;
      }
      else if(action === 'clear'){
        console.log('inside clear');
        context.clear = true;
        delete context.list;
      }
      console.log('context right before we return ', context);
      return resolve(context);
    })
  },
  clearReminders({context,sessionId,text,entities}){
    console.log('=====clearing reminders=====');

    const recipientId = sessions[sessionId].fbid;
    if(DEBUG) printWitLogs(sessionId,text,recipientId, context, entities);

    return new Promise(function(resolve, reject) {
      var option = entities.yes_no[0].value;
      if (option == 'yes') {
        console.log('reminders were cleared');
        messageActions.clearReminders(recipientId);
        delete context.clear;
        delete context.list;
      }
      return resolve(context);
    });
  },
  listReminders({context,sessionId,text,entities}){
    console.log('=====list reminders=====');

    const recipientId = sessions[sessionId].fbid;
    if(DEBUG) printWitLogs(sessionId,text,recipientId, context, entities);
    delete context.clear;
    delete context.list;

    return new Promise(function(resolve,reject){
      var promise = new Promise(function(resolve,reject){
        resolve(messageActions.sendReminderList(recipientId));
      });
      promise.then(function(result){
        context.listOfReminders = result;
        console.log('result in inner promise: ' + result);
        return resolve(context);
      });
    });
  },
  deleteReminder({context,sessionId,text,entities}){
    console.log('======= Delete Reminder =======');
    const recipientId = sessions[sessionId].fbid;
    return new Promise(function(resolve,reject){
      var reminderNumber = entities.reminder_number[0].value;
      console.log('reminder number: ', reminderNumber);
      messageActions.deleteReminder(reminderNumber, recipientId);
      return resolve(context);
    });
  },
  editReminder(){

  },
  generateThankYou({context,sessionId,text}){
    console.log('=====generating thank you=====');
    const recipientId = sessions[sessionId].fbid;

    return new Promise(function(resolve,reject) {
      var randomOption = Math.floor((Math.random() * 3) + 1);

      console.log(randomOption);
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

      return resolve(context);
    });
  }
};


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
    // There may be multiple if batched
    data.entry.forEach(function (pageEntry) {
      var pageID = pageEntry.id;
      var timeOfEvent = pageEntry.time;
      // Iterate over each messaging event
      pageEntry.messaging.forEach(function (messagingEvent) {
        if(messagingEvent.message) {
          const {text} = messagingEvent.message;
          const sender = messagingEvent.sender.id;
          const sessionId = findOrCreateSession(sender);
          console.log('find or create session');
          console.log(sessions);
          if (text) {
            // Let's forward the message to the Wit.ai Bot Engine
            // This will run all actions until our bot has nothing left to do
            wit.runActions(
                sessionId, // the user's current session
                text, // the user's message
                sessions[sessionId].context // the user's current session state
            ).then((context) => {
                  // Our bot did everything it has to do.
                  // Now it's waiting for further messages to proceed.
                  console.log('Waiting for next user messages');

                  // Based on the session state, you might want to reset the session.
                  // This depends heavily on the business logic of your bot.
                  // Example:
                  //if (context['done']) {
                  //   delete sessions[sessionId];
                  //}

                  // Updating the user's current session state
                  // todo might need to remove this, and keep the context, when adding case for when user doesn't specify time
                  if(context['finishedAdding']){
                    context = {};
                  }
                  console.log('context should be cleared: ',context);
                  sessions[sessionId].context = context;
                })
                .catch((err) => {
                  console.error('Oops! Got an error from Wit: ', err.stack || err);
                });
            //receivedMessage(messagingEvent);
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

  // When an authentication is received, we'll send a message back to the sender
  // to let them know it was successful.

  //comment for now`
  /*messageActions.sendTextMessage(senderID, "Authentication successful");*/
}