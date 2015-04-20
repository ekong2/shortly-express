var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');
var Link = require('./link.js');

var User = db.Model.extend({
  tableName: 'users',
  hasTimeStamps: true,
  links: function(){
    return this.hasMany(Link);
  },
  initialize: function(){
    this.on('creating', function(model, attr, options){
      var salt = bcrypt.genSaltSync(10); // Do not understand what parameter is
      var hash = bcrypt.hashSync(model.get('password'), salt);
      model.set('username', model.get('username'));
      model.set('password', '');
      model.set('salt', salt);
      model.set('hash', hash);
    });
  }
});

module.exports = User;
