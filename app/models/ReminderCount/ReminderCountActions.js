var ReminderCount = require('./ReminderCountSchema');

var UserReminderCount = ReminderCount.Model;

module.exports = {};
module.exports.findRecipient = function (recipientId) {
};

module.exports.clearCount = function (recipientId) {
  console.log('=== clearing count ===');
  UserReminderCount.findOne({"recipientId": recipientId})
    .exec()
    .then(function (recipientEntry) {
      console.log('recipient entry', recipientEntry);
      recipientEntry.numberOfReminders = 0;
      recipientEntry.save();
    });
};

module.exports.getCount = function (recipientId) {
  return new Promise(function (resolve, reject) {
    UserReminderCount.findOne({"recipientId": recipientId})
      .exec()
      .then(function (recipientEntry) {
        console.log('recipientEntry: ' + recipientEntry);
        if (recipientEntry != null) {
          resolve(recipientEntry.numberOfReminders);
        }
      });
  }).then(function (numberOfReminders) {
    console.log('number of entries: ' + numberOfReminders);
    return numberOfReminders;
  });
};

module.exports.incrementCount = function (recipientId) {
  UserReminderCount.findOne({"recipientId": recipientId})
    .exec()
    .then(function (recipientEntry) {
      if (recipientEntry == null) {
        var newRecipient = new UserReminderCount();
        newRecipient.recipientId = recipientId;
        newRecipient.numberOfReminders = 1;
        newRecipient.save();
      }
      else {
        console.log('incrementing recipient Id');
        recipientEntry.numberOfReminders++;
        recipientEntry.save();
      }
    });
};

module.exports.decrementCount = function (recipientId) {
  UserReminderCount.findOne({"recipientId": recipientId}).exec().then(function (recipientEntry) {
    if (recipientEntry.numberOfReminders > 0) {
      recipientEntry.numberOfReminders--;
      recipientEntry.save();
    }
    else {
      console.log('Error: trying to decrement a count that is already 0!!!');
    }

  });
};



