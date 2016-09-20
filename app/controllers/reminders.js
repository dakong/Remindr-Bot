var Reminders = require('../models/reminders.js'),
  messageActions = require('./MessageActions.js'),
  config = require('config');

const VALIDATION_TOKEN = config.get('validationToken');
const REMIND_OPTIONS = {
  "add": ["remind me to"]
};

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
        if (messagingEvent.optin) {
          receivedAuthentication(messagingEvent);
        } else if (messagingEvent.message) {
          receivedMessage(messagingEvent);
        } else if (messagingEvent.delivery) {
          receivedDeliveryConfirmation(messagingEvent);
        } else {
          console.log("Webhook received unknown messagingEvent: ", messagingEvent);
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
      ////var containsAdd = messageText.substring(REMIND_OPTIONS.add[0]);
      //var containsAddReminder= messageText.indexOf(REMIND_OPTIONS.add[0]);
      //
      //if(containsAddReminder){
      //  //Get the index of the last character of the string we are matching.
      //  reminder =  messageText.slice(containsAddReminder + REMIND_OPTIONS.add[0].length + 1);
      //  console.log(reminder);
      //
      //}
      switch (messageText) {
        case 'list my reminders':
          messageActions.sendReminderList(senderId);
          break;
        default:
          messageActions.sendDefault(senderId);
      }
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