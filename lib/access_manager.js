"use strict";

var _ = require('dry-underscore');
var crypto = require('crypto');

var memory_store_class = require('./access_stores/memory_store.js');

function access_manager(store, log){

    this._store = store || new memory_store_class();

    this._log = log || _.log;

    this._token_bytes = 128;
}

// _.hook(access_manager.prototype);

access_manager.prototype.log = _.r("_log");
access_manager.prototype.store = _.r("_store");

access_manager.prototype.make_token = function(){
    var token = crypto.pseudoRandomBytes(this._token_bytes).toString('base64');
    return(token);
};

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

access_manager.prototype.ensure_format = function(access_token, hash){
    hash.access_token = access_token;
    if(hash.roles && !_.isArray(hash.roles)){ hash.roles = [hash.roles]; }
    return(hash);
};

access_manager.prototype.create = function(access_token, expires, roles, extra, callback){
    if(!access_token){ access_token = this.make_token(); }
    var record = _.extend({}, extra, { access_token: access_token, roles: roles, expires: expires });
    record = this.ensure_format(access_token, record);
    return this.store().create(access_token, record, callback);
};

access_manager.prototype.update = function(access_token, record, callback){
    record = this.ensure_format(access_token, record);
    return this.store().update(access_token, record, callback);
};

access_manager.prototype.extend = function(access_token, record, callback){
    record = this.ensure_format(access_token, record);
    return this.store().extend(access_token, record, callback);
};

access_manager.prototype.context_prepper = function(){
    
    var self = this;

    return(function(next, context){
        if(context.tags.access_token){
            self.get(_.s(context.tags.access_token), function(err, record, expired){
                if(err){ return next(err); }
                else if(record && record.roles){
                    context.roles = record.roles;
                    return next();
                }
            });
        }else{ next(); }
    });
};

module.exports = access_manager;

