
var _ = require('dry-underscore');

function memory_store(){ this._records = {}; }

memory_store.prototype.get = function(access_token, callback){
    return callback(null, this._records[access_token] || null);
};

memory_store.prototype.create = function(access_token, record, callback){
    if(this._records[access_token]){
        return callback(_.error("record_exists", "an access record with token:  " + access_token + "  already exists."));
    }
    return this.save(access_token, record, callback);
};

memory_store.prototype.update = function(access_token, record, callback){
    if(!this._records[access_token]){
        return callback(_.error("record_does_not_exists", "an access record with token:  " + access_token + "  does not exist."));
    }
    return this.save(access_token, record, callback);
};

memory_store.prototype.extend = function(access_token, extra, callback){
    if(!this._records[access_token]){
        return callback(_.error("record_does_not_exists", "an access record with token:  " + access_token + "  does not exist."));
    }
    var record = _.extend({}, this._records[access_token], extra);
    return this.update(access_token, record, callback);
};

memory_store.prototype.save = function(access_token, record, callback){
    var created = true;
    if(this._records[access_token]){ created = false; }
    this._records[access_token] = record;
    return callback(null, access_token, created);
};


module.exports = memory_store;
