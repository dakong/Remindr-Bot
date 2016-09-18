const
  express = require('express'),
  bodyParser = require('body-parser'),
  config = require('config'),
  https = require('https'),
  mongoose = require('mongoose'),
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
require('./app/Routes')(app);

mongoose.connect(DB_URL);
app.listen(port);

console.log('Listening on port ' + port);
