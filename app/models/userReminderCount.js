var mongoose = require('mongoose'),
  Schema = mongoose.Schema;

var userReminderCountSchema = new Schema({
  recipientId: String,
  numberOfReminders: Number
});

var UserReminderCount = mongoose.model("Reminder Count", userReminderCountSchema);

module.exports.actions = {};


module.exports.actions.findRecipient = function(recipientId){

};

module.exports.actions.clearCount = function(recipientId){
  console.log('=== clearing count ===');
  UserReminderCount.findOne({"recipientId": recipientId})
    .exec()
    .then(function (recipientEntry) {
      console.log('recipient entry', recipientEntry);
      recipientEntry.numberOfReminders = 0;
      recipientEntry.save();
    });
};

module.exports.actions.getCount = function(recipientId){
  return new Promise(function(resolve,reject) {
    UserReminderCount.findOne({"recipientId": recipientId})
      .exec()
      .then(function (recipientEntry) {
        console.log('recipientEntry: ' + recipientEntry);
        if (recipientEntry != null) {
          resolve(recipientEntry.numberOfReminders);
        }
      });
  }).then(function(numberOfReminders){
    console.log('number of entries: ' + numberOfReminders);
    return numberOfReminders;
  });
};

module.exports.actions.incrementCount = function(recipientId){
  UserReminderCount.findOne({"recipientId": recipientId})
    .exec()
    .then(function(recipientEntry){
      if(recipientEntry == null){
        var newRecipient = new UserReminderCount();
        newRecipient.recipientId = recipientId;
        newRecipient.numberOfReminders = 1;
        newRecipient.save();
      }
      else{
        console.log('incrementing recipient Id');
        recipientEntry.numberOfReminders++;
        recipientEntry.save();
      }
  });
};

module.exports.actions.decrementCount = function(recipientId){
  UserReminderCount.findOne({"recipientId": recipientId}).exec().then(function(recipientEntry){
    if(recipientEntry.numberOfReminders > 0){
      recipientEntry.numberOfReminders--;
      recipientEntry.save();
    }
    else{
      console.log('Error: trying to decrement a count that is already 0!!!');
    }

  });
};



