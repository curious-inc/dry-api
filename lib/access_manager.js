"use strict";

var _ = require('dry-underscore');
var crypto = require('crypto');

var roles_class = require('./roles.js');
var method_class = require('./method.js');
var api_class = require('./api.js');

function access_manager(store, log){

    if(!store){ _.fatal("access_manager must be passed a store"); }

    this._store = store;
    this._log = log || _.log;
    this._token_bytes = 128;
}

_.hook(access_manager.prototype);

access_manager.prototype.log = _.r("_log");
access_manager.prototype.store = _.r("_store");

access_manager.prototype.get = function(access_token, callback){
    var self = this;

    self.store().get(access_token, _.plumb(function(record){
        if(!record){ return callback(null, null, false); }

        if(record.expires === null || record.expires === false){
            return callback(null, record, false);
        }

        var expires = _.n(record.expires);

        if(!expires){
            self.log().error("Bad expiration value in access table, returning no record for safety: ", record);
            return callback(null, null, false);
        }

        if(expires >= _.timestamp()){
            return callback(null, record, false);
        }else{
            return callback(null, null, true);
        }

    }, callback));
};

access_manager.prototype.make_token = function(){
    var token = crypto.pseudoRandomBytes(this._token_bytes).toString('base64');
    return(token);
};

access_manager.prototype.save = function(access_token, expires, roles, extra, callback){
    if(!access_token){ access_token = this.make_token(); }
    if(!_.isArray(roles)){ roles = [roles]; }
    var record = _.extend({}, extra, { access_token: access_token, roles: roles, expires: expires });
    return this.store().save(access_token, record, callback);
};

function in_memory_store(){ this._records = {}; }
in_memory_store.prototype.get = function(access_token, callback){
    return callback(null, this._records[access_token] || null);
};

in_memory_store.prototype.save = function(access_token, record, callback){
    this._records[access_token] = record;
    return callback(null, access_token);
};

access_manager.in_memory_store = function(){ return new in_memory_store(); };

module.exports = access_manager;

