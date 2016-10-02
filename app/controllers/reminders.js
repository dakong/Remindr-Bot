var Reminders = require('../models/reminders.js'),
  messageActions = require('./MessageActions.js'),
  config = require('config'),
  {Wit,log} = require('node-wit');
const WIT_TOKEN = config.get('witToken');
const VALIDATION_TOKEN = config.get('validationToken');
const FB_PAGE_TOKEN = config.get('pageAccessToken');
const REMIND_OPTIONS = {
  "add": ["remind me to"],
  "time": ["at"],
  "clear":["clear my reminder"],
  "list":["list my reminder"],
  "thanks":["thank","ty","thx"]
};
var moment = require('moment');
const DEBUG = 1;
//this is with the string 'at'
const REGEX_TIME_AT = /at\s(?:[0-9]|0[0-9]|1[0-9]|2[0-3])?:[0-5][0-9](?:am|pm)??$/i;
const REGEX_TIME = /(?:[0-9]|0[0-9]|1[0-9]|2[0-3])?:[0-5][0-9](?:am|pm)??$/i;
const REGEX_AM_PM = /(?:am|pm)??/i;

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

      var reminder = entities.reminder[0].value;
      var date = entities.datetime[0].value;
      var time = moment(entities.datetime[0].value).format('h:mm a');

      messageActions.addReminder(reminder, time, date, recipientId);
      context.time = time;
      return resolve(context);
    });
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
  listReminders({context,sessionId,text,entities}){
    console.log('=====list reminders=====');

    const recipientId = sessions[sessionId].fbid;
    if(DEBUG) printWitLogs(sessionId,text,recipientId, context, entities);

   new Promise(function(resolve, reject){
      resolve(messageActions.sendReminderList(recipientId));
    }).then(function(result){
     console.log('result from promise ' + result);
     return new Promise(function(resolve,reject){
       context.listOfReminders = result;
       delete context.list;
       delete context.clear;
       return resolve(context)
     });
   });

    //return new Promise(function(resolve, reject) {
    //  //context.listOfReminders = messageActions.sendReminderList(recipientId);
    //  //messageActions.clearReminders(recipientId);
    //  delete context.list;
    //  delete context.clear;
    //  return resolve(context)
    //});
  },
  deleteReminder(){

  },
  editReminder(){

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
                  // if (context['done']) {
                  //   delete sessions[sessionId];
                  // }

                  // Updating the user's current session state
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
 * Handles the case for when a user sends a text message to our application.
 * @param event
 */
function receivedMessage(event) {
  var senderId = event.sender.id;
  var recipientId = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;
  var reminder;
  var time;

  console.log("Received message for user %d and page %d at %d with message: ", senderId, recipientId, timeOfMessage);
  var messageText = message.text.toLowerCase();

  if (messageText) {

    //Handles the case when a user sends a message in command line format
    if (messageText.startsWith('reminder')) {
      console.log('starts with reminder');
      //Splits our message into an array
      var messageArray = messageText.toLowerCase().match(/(?:[^\s"]+|"[^"]*")+/g);

      //Second argument is the action that the user wants to execute
      var options = messageArray[1];

      switch (options) {

        //case for when a user wants to add a reminder
        case '-add':
          reminder = messageArray[2].slice(1, -1); //slice to ignore the quotation marks
          time = messageArray[4].slice(1, -1); //slice to ignore the quotation marks
          console.log(messageArray);
          console.log(reminder, time);

          //Makes sure that there is always a time option set
          if (messageArray[3] === '-time' && messageArray.length === 5) {
            messageActions.commandLineAddReminder(reminder, time, senderId);
          }
          else {
            messageActions.sendDefault(senderId);
          }
          break;

        //case for when a user wants to delete a reminder
        case '-delete':
          reminder = messageArray[2].slice(1, -1);
          messageActions.commandLineDeleteReminder(reminder, senderId);
          break;

        //case for when a user wants to edit a reminder
        case '-update':
          reminder = messageArray[2].slice(1, -1);
          time = messageArray[4].slice(1, -1);
          console.log(messageArray);
          console.log(reminder, time);
          if (messageArray[3] === '-time' && messageArray.length === 5) {
            messageActions.commandLineUpdateReminder(reminder, time, senderId);
            //commandLineEditReminder(reminder,time, senderId);
          }
          else {
            messageActions.sendDefault(senderId);
          }
          break;

        //List our reminders
        case '-list':
          messageActions.sendReminderList(senderId);
          break;

        //Shows the command line options to the user
        case '-help':
          messageActions.commandLineHelpOptions(senderId);
          break;

        //Removes all reminders from our database
        case '-clear':
          messageActions.commandLineClear(senderId);
          break;

        //If the user inputs a malformed command
        default:
          messageActions.commandLineHelpOptions(senderId);
      }
    }
    else {
      console.log('readable reminder');
      var containsAddReminder= messageText.indexOf(REMIND_OPTIONS.add[0]);
      var containsTime = REGEX_TIME.test(messageText);
      var containsClearReminder = messageText.indexOf(REMIND_OPTIONS.clear[0]);
      var containsListReminder = messageText.indexOf(REMIND_OPTIONS.list[0]);
      var containsThanks;

      for(var i = 0, len = REMIND_OPTIONS.thanks.length; i < len; i++){
        containsThanks = messageText.indexOf(REMIND_OPTIONS.list[i]);
        if(containsThanks != -1){
          break;
        }
      }

      if(containsAddReminder != -1 && containsTime){
        time = REGEX_TIME.exec(messageText)[0];
        //If user doesn't supply am or pm then we want to grab the time that is next
        if(!REGEX_AM_PM.test(messageText)){

        }

        //Get the lower and upper index of the reminder and time sub string
        var reminderIndexLowerBound = containsAddReminder + REMIND_OPTIONS.add[0].length + 1;
        var reminderIndexUpperBound = messageText.search(REGEX_TIME_AT) - 1;

        reminder =  messageText.slice(reminderIndexLowerBound, reminderIndexUpperBound);

        console.log('reminder ', reminder);
        console.log('time', time);
        messageActions.commandLineAddReminder(reminder, time, senderId);
      }
      else if(containsClearReminder != -1){
        messageActions.commandLineClear(senderId);
      }
      else if(containsListReminder != -1){
        messageActions.sendReminderList(senderId);
      }
      else if(containsThanks){
        messageActions.respondToThanks(senderId);
      }
      //switch (messageText) {
      //  case 'list my reminders':
      //    messageActions.sendReminderList(senderId);
      //    break;
      //  default:
      //    messageActions.sendDefault(senderId);
      //}
    }
  }
}

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