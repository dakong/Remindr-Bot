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
 * @param {Object} AIResult the result key from the API.AI return object
 * @returns {*} A promise if the action is valid and complete. It will return
 * an object otherwise.
 * @constructor
 */
function HandleAction(AIResult) {

  // When the action is incomplete, return default from API.Ai
  if (AIResult.actionIncomplete) {
    return {
      success: true, incomplete: true
    }
  }

  //Statements to handle the different actions our message bot can take
  switch (AIResult.action) {

    case ACTIONS.ADD_REMINDER:
      return AddReminder(AIResult);

    case ACTIONS.LIST_REMINDERS:
      break;

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
 * @param {Object} AIResult
 * @returns {Promise}
 * @constructor
 */
function AddReminder(AIResult) {

  return new Promise(function (resolve, reject) {

    if(AIResult.parameters.date === "TODAY"){
      AIResult.parameters.date = moment().format("YYYY-M-D");
    }

    let reminderToBeSaved = Object.assign(AIResult.parameters,
      { recipientId: DEV_RECIPIENT_ID });

    Reminders.actions.create(reminderToBeSaved)
      .then(function (result) {
        resolve(result);
      })
      .catch(function (err) {
        reject(err);
      });
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

  ProcessQuery(msg, options)
    .then(function (queryResponse) {
      return Promise.all([queryResponse, HandleAction(queryResponse.result)]);
    })
    .then(function (result) {
      console.log(result);
      if (result[1].success) {
        res.status(200).send(result[0].result.fulfillment.speech);
      }
      else {
        res.status(200).send(result[1].msg);
      }
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
function ProcessQuery(text, options) {
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