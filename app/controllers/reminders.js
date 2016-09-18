var Reminders = require('../models/reminders.js'),
  request = require('request'),
  config = require('config');

const VALIDATION_TOKEN = config.get('validationToken');
const PAGE_ACCESS_TOKEN = config.get('pageAccessToken');

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
            commandLineAddReminder(reminder, time, senderId);
          }
          else {
            sendDefault(senderId);
          }
          break;

        //case for when a user wants to delete a reminder
        case '-delete':
          reminder = messageArray[2].slice(1, -1);
          commandLineDeleteReminder(reminder, senderId);
          break;

        //case for when a user wants to edit a reminder
        case '-update':
          reminder = messageArray[2].slice(1,-1);
          time = messageArray[4].slice(1,-1);
          console.log(messageArray);
          console.log(reminder, time);
          if(messageArray[3] === '-time' && messageArray.length === 5){
            commandLineUpdateReminder(reminder, time, senderId);
            //commandLineEditReminder(reminder,time, senderId);
          }
          else{
            sendDefault(senderId);
          }
          break;

        //List our reminders
        case '-list':
          sendReminderList(senderId);
          break;

        //Shows the command line options to the user
        case '-help':
          commandLineHelpOptions(senderId);
          break;

        //Removes all reminders from our database
        case '-clear':
          commandLineClear(senderId);
          break;

        //If the user inputs a malformed command
        default:
          commandLineHelpOptions(senderId);
      }
    }
    else {
      switch (messageText) {
        case 'list my reminders':
          sendReminderList(senderId);
          break;
        default:
          sendDefault(senderId);
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
  sendTextMessage(senderID, "Authentication successful");
}

function sendTextMessage(recipientId, messageText) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText
    }
  };
  callSendAPI(messageData);
}

function callSendAPI(messageData) {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
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
}

/*****************************************************************************
 ***************************** COMMAND LINE OPTIONS  *************************
 *****************************************************************************/

/**
 * Sends a list of all the reminders for the user.
 * @param recipientId id of the user we want to send the list of reminder.
 */
function sendReminderList(recipientId) {
  Reminders.actions.getAllThroughBot(function (err, reminder) {
    var reminderList;
    if (err) {
      console.log(err)
    } else {
      var reminderNames = reminder.map(function (el) {
        return el.name + ' at ' + el.time;
      });

      if (reminderNames.length) {
        reminderList = "Here are your current reminders: \n" +
          reminderNames.reduce(function (previousValue, currentValue, currentIndex, array) {
            return previousValue + '\n' + currentValue;
          });
      } else {
        reminderList = "You have no reminders set!";
      }

      console.log(reminderList);
      var messageData = {
        recipient: {
          id: recipientId
        },
        message: {
          text: reminderList
        }
      };
      callSendAPI(messageData);
    }
  });

}

/**
 * This function will create the reminder and add it to the database.
 * @param reminder The task we want to remind the user
 * @param time The time we want to send our reminder to the user
 * @param recipientId The id we want to send the user too
 */
function commandLineAddReminder(reminder, time, recipientId) {
  var msg;
  if (reminder === null || time === null) {
    //handle case
    return;
  }

  Reminders.actions.createThroughBot(reminder, time, function (returnMsg) {
    console.log(returnMsg);
    if (returnMsg.success) {
      msg = 'I\'ll remind you to ' + reminder + ' at ' + time;
      sendTextMessage(recipientId, msg);
    }
    else if (returnMsg.msg === 'duplicate') {
      msg = 'That reminder already exists!';
      sendTextMessage(recipientId, msg);
    }
  });
}

/**
 * Function will edit an exist reminder and add it to the database.
 * @param reminder the item we want to edit.
 * @param time the new time we want to set the reminder to.
 * @param recipientId id of the user we want to edit the reminder for.
 */
function commandLineUpdateReminder(reminder, time, recipientId){
  var msg;
  if(reminder === null || time === null){
    //throw an error
    return;
  }
  Reminders.actions.edit(reminder,time, function(returnMsg){
    if(returnMsg.success){
      console.log('edit returned true');
      msg = 'I\'ll remind you to ' + reminder + ' at ' + time + ' instead';
    }
    else{
      msg = returnMsg.msg;
    }
    sendTextMessage(recipientId, msg);
  });
}

/**
 * This will form the message to send back to the user, after they have chosen to delete a reminder.
 * @param reminder the reminder the user wants removed.
 * @param recipientId the id of the user we want to delete the reminder from.
 */
function commandLineDeleteReminder(reminder, recipientId) {
  Reminders.actions.deleteThroughBot(reminder, function () {
    var messageData = {
      recipient: {
        id: recipientId
      },
      message: {
        text: "Deleted reminder: " + reminder
      }
    };
    callSendAPI(messageData);
  });
}

/**
 * Forms the help message to send to the user.
 * @param recipientId id of the user we want to send help to.
 */
function commandLineHelpOptions(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: "Here is a list of Remind commands:\n-add \n-time \n-delete \n-clear \n-update \n-list "
    }
  };
  callSendAPI(messageData);
}

/**
 * Clears all reminders from the database
 * @param recipientId id of the user we want to clear messages for
 */
function commandLineClear(recipientId) {
  var msg = "Reminder List has been cleared";
  Reminders.actions.clear();
  sendTextMessage(recipientId, msg);
}

/**
 * Default message to send when there is an unrecognized command
 * @param recipientId id of the user we want to send the message to
 */
function sendDefault(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: "Unrecognized command: \nPlease use the -help option to show list of commands"
    }
  };
  callSendAPI(messageData);
}