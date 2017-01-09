const
  express = require('express'),
  bodyParser = require('body-parser'),
  config = require('config'),
  https = require('https'),
  mongoose = require('mongoose'),
  MessageActions = require('./app/controllers/MessageActions.js');

app = express();

var DB_URL;
const port = process.env.PORT || 8080;

//Configuration Variables
if (process.env.LOCAL === 'true') {
  DB_URL = config.get('dbURL');
}
else {
  DB_URL = process.env.dbURL;
}

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

app.use(function (req, res, next) {
  console.log('something is happening');
  next();
});

//Reminders routes
require('./app/routes')(app);

//Connect to our DB
mongoose.connect(DB_URL);

var Reminder = mongoose.model("Reminders");

//Sets initial Data when the App starts up
Reminder.find({}, function (err, reminder) {
  if (err) {
    console.log('Error initializing data');
  } else {
    MessageActions.setInitialData(reminder);
    app.listen(port);
    console.log('Listening on port ' + port);
    MessageActions.setWhiteList();
  }
});


