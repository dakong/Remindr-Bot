const
  express = require('express'),
  bodyParser = require('body-parser'),
  config = require('config'),
  https = require('https'),
  mongoose = require('mongoose'),
  cronJob = require('cron'),
  MessageActions = require('./app/controllers/MessageActions.js');
  app = express();

const port = process.env.PORT || 8080,
  DB_URL = config.get('dbURL');


app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

app.use(function(req,res,next){
  console.log('something is happening');
  next();
});

//Reminders routes
require('./app/routes')(app);

mongoose.connect(DB_URL);
var Reminder = mongoose.model("Reminders");
Reminder.find({}, function(err, reminder){
  if(err){
    console.log('Error initializing data');
  }else{
    MessageActions.setInitialData(reminder);
    app.listen(port);
    console.log('Listening on port ' + port);
  }
});


