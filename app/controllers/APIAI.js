const Reminders      = require('../models/reminders.js'),
      apiai          = require('apiai'),
      messageActions = require('./MessageActions.js'),
      CronJob        = require('cron').CronJob,
      config         = require('config'),
      moment         = require('moment'),
      request        = require('request'),
      uuid           = require('uuid'),
      ACTIONS        = require('../constants/actions.js');

//Developer access token
const AI_ACCESS_TOKEN   = config.get("API_AI_ClientToken");
const app               = apiai(AI_ACCESS_TOKEN);
const PAGE_ACCESS_TOKEN = config.get('pageAccessToken');

let cronHash         = {};
let DEV_RECIPIENT_ID = '12345';


/* TODO: Need to add Facebook authentication for FB chat bot */

/**
 *
 * @param {Object} responseData the result key from the API.AI return object
 * @returns {*} A promise if the action is valid and complete. It will return
 * an object otherwise.
 */
function handleAction(responseData) {

  // When the action is incomplete, return default from API.Ai
  if (responseData.actionIncomplete) {
    return {
      success: true, incomplete: true
    }
  }

  //Handle the different actions our message bot can take
  switch (responseData.action) {

    case ACTIONS.ADD_REMINDER:
      return addReminder(responseData);

    case ACTIONS.LIST_REMINDERS:
      return listReminders(responseData);

    case ACTIONS.DELETE_REMINDER:
      break;

    default:
      return {
        success: true
      }
  }
}

/**
 * Handles the case for when a user wants to add a reminder.
 * @param {Object} responseData
 * @returns {Promise}
 */
function addReminder(responseData) {

  return new Promise(function (resolve, reject) {

    if (responseData.parameters.date === "TODAY") {
      responseData.parameters.date = moment().format("YYYY-M-D");
    }

    let reminderToBeSaved = Object.assign(responseData.parameters,
      {recipientId: DEV_RECIPIENT_ID});

    Reminders.actions.create(reminderToBeSaved)
      .then(function (result) {

        let res = {};
        if (result.success) {
          console.log('hello world');
          let reminder = responseData.parameters.reminder,
              date     = responseData.parameters.date,
              time     = responseData.parameters.time;

          //datetime used for cronjob
          let datetime = new Date(`${date} ${time}`);

          addCronJob(reminder, datetime);

          res = Object.assign(result,
            {msg: responseData.fulfillment.speech});
        }
        else {
          res = Object.assign({}, result);
        }

        resolve(res);
      })
      .catch(function (err) {
        reject(err);
      });
  });
}

function addCronJob(reminder, date) {

  let cronId       = uuid.v4();
  //create our cron job
  cronHash[cronId] = new CronJob({
    cronTime: new Date(date),
    onTick  : function () {
      sendReminderMessage(reminder);
    },
    start   : true,
    timeZone: 'America/Los_Angeles'
  });
  Reminders.actions.addCronJob(reminder, cronId);

}

/**
 * Function that forms the message that the bot will send as a reminder to the user
 * @param {Object} reminder
 */
function sendReminderMessage(reminder) {
  console.log('BOT IS SENDING A REMINDER and deleting: ', reminder._id);
  Reminders.actions.delete(reminder._id, reminder.recipientId);
  let messageData = {
    recipient: {
      id: reminder.recipientId
    },
    message  : {
      text: 'Hey I\'m reminding you to ' + reminder.name
    }
  };
  //callSendAPI(messageData);
}

let callSendAPI = function (messageData) {
  request({
    uri   : 'https://graph.facebook.com/v2.6/me/messages',
    qs    : {
      access_token: PAGE_ACCESS_TOKEN
    },
    method: 'POST',
    json  : messageData
  }, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      console.log('Call send api success');
      let recipientId = body.recipient_id;
      let messageId   = body.message_id;

    } else {
      console.error('Unable to send Message.');
      console.error(error);
    }
  })
};

/**
 * Handles the case when a user wants to view all their reminders
 * @param responseData
 * @returns {Promise}
 */
function listReminders(responseData) {
  return new Promise(function (resolve, reject) {
    Reminders.actions.getAll(DEV_RECIPIENT_ID)
      .then(function (result) {

        let listMsg = createListMsg(responseData.fulfillment.speech,
          result.reminders);

        let res = Object.assign(result, {msg: listMsg});

        resolve(res);
      })
      .catch(function (err) {
        reject(err);
      });
  });
}

/**
 * Formats the msg that is to be sent back to the user, for listing reminders
 * @param baseText
 * @param reminderArray
 * @returns {string}
 */
function createListMsg(baseText, reminderArray) {
  let reminderList = reminderArray.reduce(function (acc, curr) {
    return acc + '\n' + curr.name;
  }, "");
  return baseText + reminderList;
}

/**
 * Sends the text to API AI to process to query.
 * @param {String} text A message that needs to be processed.
 * @param {Object} options Holds the sessionID that is sent along with the message.
 */
function processQuery(text, options) {
  return new Promise(function (resolve, reject) {
    let request = app.textRequest(text, options);

    request.on('response', function (response) {
      resolve(response);
    });

    request.on('error', function (error) {
      reject(error);
    });
    request.end();
  });
}

/**
 * Given a user message execute the action returned by API.AI.
 * @param req
 * @param res
 */
function HandleMessage(req, res) {

  let msg       = req.body.msg;
  let sessionId = req.body.sessionId;

  let options = {
    sessionId: sessionId
  };

  processQuery(msg, options)
    .then(function (queryResponse) {
      return Promise.all([queryResponse, handleAction(queryResponse.result)]);
    })
    .then(function (result) {
      res.status(200).send(result[1].msg);
    })
    .catch(function (err) {
      console.log(err);
      res.status(500).send({msg: "Server Error"});
    });
}

module.exports = {HandleMessage};