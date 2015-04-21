var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var bcrypt = require('bcrypt-nodejs');

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

// Express session authentication
app.use(cookieParser("derek's little secret"));
app.use(session({secret: '<mysecret>',
  saveUninitialized: true,
  resave: true}));

//Our restricting function
function restrict(req, res, next){
  if (req.session.user){
    next();
  } else {
    req.session.error = 'Access denied';
    res.redirect('/login');
  }
};



app.get('/', function(req, res) {
  res.render('index');
});

app.get('/create', restrict,
function(req, res) {
  res.render('index');
});

app.get('/links', restrict, function(req, res) {
  // Filter out for the user_id
  Links.reset()
  .query('where', 'user_id', '=', req.session.id)
  .fetch()
  .then(function(links) {
    res.send(200, links.models);
  });
});

app.post('/links', restrict, function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    // console.log(res.send(404));
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        console.log(req.session.user_id);
        var link = new Link({
          user_id: req.session.user_id,
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/

app.get('/logout', function(req, res) {
  req.session.destroy(function(){
    res.redirect('/login');
  });
});

app.get('/login', function(req, res){
  res.render('login');
})
app.get('/signup', function(req, res) {
  res.render('signup');
});

app.post('/login', function (req, res) {
  var username = req.body.username;
  var password = req.body.password;

  new User({username: username}).fetch().then(function (found){
    if (found) {
      console.log('USER WAS FOUND');
      bcrypt.hash(password, found.get('salt'), null, function (err, hash) {
        if (err) {
          res.redirect('/login');
        } else if(hash === found.get('hash')) {
          console.log('USER WAS AUTHENTICATED');
          req.session.regenerate(function(){
            req.session.user = found.get('username');
            req.session.user_id = found.get('id');
            res.redirect('/');
          });
        } else {
          res.redirect('/login');
        }
      });
    } else {
      res.redirect('/login');
    }
  });
});

app.post('/signup', function (req, res){
  var username = req.body.username;
  var password = req.body.password;
  new User({username: username}).fetch().then(function(found){
    if (found){
      console.log("USERNAME ALREADY TAKEN");
      res.redirect('/signup');
    } else {
      var user = new User({
        username: username,
        password: password
      });

      user.save().then(function(newUser) {
        Users.add(newUser);
        res.redirect('/login');
      });
    }
  });

});


/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
