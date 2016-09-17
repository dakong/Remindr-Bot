var Reminders = require('../models/reminders.js'),
  request = require('request'),
  config = require('config');

const VALIDATION_TOKEN = config.get('validationToken');
const PAGE_ACCESS_TOKEN = config.get('pageAccessToken');

module.exports = {};

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
        } else if (messagingEvent.postback) {
          receivedPostback(messagingEvent);
        } else {
          console.log("Webhook received unknown messagingEvent: ", messagingEvent);
        }
      });
    });
    res.sendStatus(200);
  }
};

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

    if (messageText.startsWith('reminder')) {

      var messageArray = messageText.toLowerCase().match(/(?:[^\s"]+|"[^"]*")+/g);
      var options = messageArray[1];

      switch (options) {

        case '-add':
          reminder = messageArray[2].slice(1, -1);
          time = messageArray[4].slice(1, -1);
          console.log(messageArray);
          console.log(reminder, time);
          if (messageArray[3] === '-time' && messageArray.length === 5) {
            commandLineAddReminder(reminder, time, senderId);
          }
          else {
            sendDefault(senderId);
          }

          break;

        case '-delete':
          reminder = messageArray[2].slice(1, -1);
          commandLineDeleteReminder(reminder, senderId);
          break;

        //We could probably handle this case in add
        case '-edit':
          //commandLineEditReminder(messageArray[2],messageArray[3], senderId);
          break;

        case '-list':
          sendReminderList(senderId);
          break;

        case '-help':
          commandLineHelpOptions(senderId);
          break;

        case '-clear':
          commandLineClear(senderId);
          break;

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
          /*if (!message.is_echo) {
           Reminders.actions.createThroughBot(messageText);
           }
           sendTextMessage(senderId, messageText);*/
          sendDefault(senderId);
      }
    }
  }
}

function receivedDeliveryConfirmation(event) {
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

function receivedPostback(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfPostback = event.timestamp;

  // The 'payload' param is a developer-defined field which is set in a postback
  // button for Structured Messages.
  var payload = event.postback.payload;

  console.log("Received postback for user %d and page %d with payload '%s' " +
    "at %d", senderID, recipientID, payload, timeOfPostback);

  // When a postback is called, we'll send a message back to the sender to
  // let them know it was successful
  sendTextMessage(senderID, "Postback called");
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
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

    } else {
      console.error('Unable to send Message.');
      console.error(error);
    }
  })
}

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

//Command line functions
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

function commandLineHelpOptions(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: "Here is a list of Remind commands:\n-add \n-time \n-delete \n-clear \n-edit \n-list "
    }
  };
  callSendAPI(messageData);
}

function commandLineClear(recipientId){
  var msg = "Reminder List has been cleared";
  Reminders.actions.clear();
  sendTextMessage(recipientId, msg);
}