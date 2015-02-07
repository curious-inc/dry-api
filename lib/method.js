"use strict";

var _ = require('dry-underscore');
var whitelist = require('./whitelist.js');

function method(api, role, name, method, expects, max_params_length){
    this._api = api || null;
    this._name = name;
    this._method = method || null;
    this._role = role || null;
    this._expects = expects || [];
    this._max_params_length = max_params_length || 12;
    this._incoming_parameters = null;
    this._outgoing_parameters = null;

    if(!this.method()){ _.fatal("you must pass a method to the method constructor. method_name: " + this.name()); }

    whitelist.init(this);

    this._init_errors();
}

method.prototype._init_errors = function(){
    var errors = _.errors();

    errors.add("error", "error");

    this.whitelist(errors.error());
}
 

method.dummy = function(){ return new method("", "noop", _.noop); };

method.prototype.errors = _.r("_errors");

method.prototype.api = _.r("_api");
method.prototype.role = _.r("_role");
method.prototype.name = _.r("_name");
method.prototype.method = _.r("_method");
method.prototype.max_params_length = _.r("_max_params_length");

method.prototype.hash = function(){
    return({ name: this.name(), role: this.role(), expects: this.expects(), params: this.params(), callback: this.callback() });
};

function array_function(key, f){
    return(function(){
        if(!arguments.length){ return(this[key]); }
        var args = _.a(arguments);
        if(f){ f.call(this, args); }
        this[key] = args;
        return(this);
    });
};

method.prototype.expects = array_function("_expects");

method.prototype.incoming_parameters = array_function("_incoming_parameters", function(args){
    var format = new message_format();
    _.each(format.reserved_words(), function(word){
        if(_.contains(args, word)){ _.fatal('you can not have a parameter named "' + word + '".'); }
    });
});
method.prototype.params = method.prototype.incoming_parameters;


method.prototype.outgoing_parameters = array_function("_outgoing_parameters", function(args){
    var format = new message_format();
    _.each(format.reserved_words(), function(word){
        if(_.contains(args, word)){ _.fatal('you can not have a parameter named "' + word + '".'); }
    });
});
method.prototype.callback = method.prototype.outgoing_parameters;


whitelist.mixin(method.prototype);
method.prototype.self_whitelisted = method.prototype.whitelisted;

method.prototype.whitelisted = function(err){
    if(this.self_whitelisted(err)){ return(true); }
    else if(this.api() && this.api().whitelisted(err)){ return(true); }
    else{ return(false); }
};

method.prototype.client_error = function(err){

    var client_error = _.error("error", "error.");

    if(this.whitelisted(err)){ 
        client_error = err;
        err.whitelisted = true;
    }

    // send a simple error back, even if it's whitelisted
    return({ code: client_error.code, message: client_error.message });
};

method.prototype.apply = function(context, hash, callback){
    var self = this;

    if(!_.isFunction(callback)){ _.fatal("you must pass a callback to method.apply."); }

    var message = new message_format(hash);

    function handle_error(err){
        var client_error = self.client_error(err);
        var result = message.encode_error(client_error);
        return callback(err, result);
    }

    message.decode_arguments(self.incoming_parameters(), function(err, args){
        if(err){ return handle_error(err); }

        self.apply_array(context, args, function(err){
            if(err){ return handle_error(err); }

            message.encode_arguments(self.outgoing_parameters(), arguments, callback);
        });
    });
};

method.prototype.apply_array = function(context, args, callback){
    try{
        return this.method().apply(context, _.concat(callback, args));
    }catch(e){ return callback(e); }
};

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
    return(['id', 'method', 'error', 'access_token', this.message_decode_map_name(), this.message_encode_map_name()]);
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

module.exports = method;
