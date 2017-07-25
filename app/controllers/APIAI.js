const Reminders      = require('../models/reminders.js'),
      apiai          = require('apiai'),
      messageActions = require('./MessageActions.js'),
      config         = require('config'),
      moment         = require('moment'),
      ACTIONS        = require('../constants/actions.js');

//Developer access token
const AI_ACCESS_TOKEN = config.get("API_AI_ClientToken");
const app             = apiai(AI_ACCESS_TOKEN);
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
  console.log(responseData);
  return new Promise(function (resolve, reject) {

    if(responseData.parameters.date === "TODAY"){
      responseData.parameters.date = moment().format("YYYY-M-D");
    }

    let reminderToBeSaved = Object.assign(responseData.parameters,
      { recipientId: DEV_RECIPIENT_ID });

    Reminders.actions.create(reminderToBeSaved)
      .then(function (result) {

        let res = {};

        if(result.success){
          res = Object.assign(result,
            { msg: responseData.fulfillment.speech });
        }
        else{
          res = Object.assign({}, result);
        }

        resolve(res);
      })
      .catch(function (err) {
        reject(err);
      });
  });
}
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
function createListMsg(baseText, reminderArray){
  let reminderList = reminderArray.reduce(function(acc, curr) {
    return acc + '\n' + curr.name;
  }, "");
  return baseText + reminderList;
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

module.exports = {HandleMessage};