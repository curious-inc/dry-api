"use strict";

var _ = require('dry-underscore');

function message_format(message, max_decode_map_length){
    this._message = message;
    this._max_decode_map_length = max_decode_map_length || -1;
    this._message_decode_map_name = "params";
    this._message_encode_map_name = "params";
}

message_format.prototype.message = _.r("_message");
message_format.prototype.message_decode_map_name = _.r("_message_decode_map_name");
message_format.prototype.message_encode_map_name = _.r("_message_encode_map_name");

message_format.prototype.max_decode_map_length = _.r("_max_decode_map_length");
message_format.prototype.reserved_words =  message_format.reserved_words = function(){
    return(['id', 'method', 'error', 'tags', this.message_decode_map_name(), this.message_encode_map_name()]);
};

message_format.prototype.get_message_decode_map = function(){
    var map = this.message()[this.message_decode_map_name()]

    if(!map){ return(null); }

    if(!_.isArray(map)){ 
        throw(_.error("malformed_call", 'you provided a arguments map named "' + this.message_decode_map_name() + '" in your request, but it\'s not an array.'));
    }

    if(this.max_decode_map_length() >= 0 && map.length > this.max_decode_map_length()){
        throw(_.error("malformed_call", this.message_decode_map_name() + '.length is greater than ' + this.max_decode_map_length() + '. That\'s not allowed.'));
    }

    return(map);
};

message_format.prototype.get_decode_map = function(fallback_map, callback){

    var decode_map = null;

    try{ decode_map = this.get_message_decode_map(); }
    catch(e){ return callback(e); }

    if(decode_map){ return callback(null, decode_map); }
    else if(fallback_map){ return callback(null, fallback_map); }
    else{ return callback(_.error("no_support", 'method does not support named parameters, and you did not include an arguments map named "' + this.message_decode_map_name() + '".')); }
};

message_format.prototype.decode_arguments = function(fallback_map, callback){
    var self = this;
    self.get_decode_map(fallback_map, _.plumb(function(decode_map){
        var args = _.map(decode_map, function(p){ return(self.message()[p]); });
        return callback(null, args);
    }, callback));
};

message_format.prototype.encode_arguments = function(arg_map, args, callback){

    var hash = this.encode_error(args[0]);

    if(hash.error){ return callback(null, hash); }

    if(arg_map){ arg_map = _.clone(arg_map); }
    else{ 
        arg_map = _.range(1, args.length);
        // convert integers to strings, to match the keys exactly
        arg_map = _.map(arg_map, function(n){ return(_.s(n)); });
    }

    _.each(arg_map, function(key, i){ 
        hash[key] = args[i+1];
    });

    hash[this.message_encode_map_name()] = _.concat(hash[this.message_encode_map_name()], arg_map);

    return callback(null, hash);
};

message_format.prototype.encode_error = function(err){

    var hash = {};

    if(this.message().id){ hash.id = this.message().id; }

    hash.error = err || null;
    hash[this.message_encode_map_name()] = ["error"];

    return(hash);
};

module.exports = message_format;
