"use strict";

var _ = require('dry-underscore');

function method(role, name, method, expects){
    this._name = name;
    this._method = method || null;
    this._role = role || null;
    this._expects = expects || [];
    this._incoming_parameters = null;
    this._outgoing_parameters = null;
    this._override_args_name = "params";
    this._fallback_args_map_name = "params_map";
    this._reserved_words = [
        'method',
        'access_token',
        this._override_args_name,
        this._fallback_args_map_name
    ];
}

method.prototype.role = _.r("_role");
method.prototype.name = _.r("_name");
method.prototype.method = _.r("_method");

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

method.prototype.parameters = array_function("_incoming_parameters", function(args){
    _.each(this._reserved_words, function(word){
        if(_.contains(args, word)){ _.fatal('you can not have a parameter named "' + word + '".'); }
    });
});

method.prototype.params = method.prototype.parameters;

method.prototype.callback = array_function("_outgoing_parameters");

method.prototype.get_params_map = function(hash, callback, allow_map_params){

    var used_fallback = false;
    var fallback_map_name = this._fallback_args_map_name;

    var params = this.params();

    if(params){ return callback(null, params, used_fallback); }

    if(!allow_map_params){ return callback(_.error("no_support", "method does not support named parameters.")); }

    if(_.isArray(hash[fallback_map_name])){
        params = hash[fallback_map_name];
        used_fallback = true;
    }else{
        return callback(_.error("no_support", "method does not support named parameters, and you did not include an arguments map named: " + fallback_map_name + "."));
    }
    
    return callback(null, params, used_fallback);
};

method.prototype.hash_to_parameters = function(hash, callback, allow_map_params){

    if(hash[this._override_args_name]){
        if(_.isArray(hash[this._override_args_name])){
            return callback(null, hash[this._override_args_name], true, false);
        }else{
            return callback(_.error("malformed_call", "you have a key named \"" + this._override_args_name + "\" in your request, but it's not an array."));
        }
    }

    this.get_params_map(hash, _.plumb(function(params_map, used_fallback){

        var args = _.map(params_map, function(p){ return(hash[p]); });
        callback(null, args, false, used_fallback);

    }, callback), allow_map_params);

};

method.prototype.parameters_to_hash = function(results, callback){

    var result_map = this.callback();

    var hash = { };

    if(results[0]){ 
        if(result_map){
            hash.error = results[0];
            hash.params_map = ['error'];
            return callback(null, hash, true);
        }else{
            hash.params = [results[0]];
            return callback(null, hash, false);
        }
    }

    if(!result_map){ return callback(null, { params: results }, false); }

    _.each(result_map, function(key, i){ hash[key] = results[i+1]; });

    hash.params_map = _.concat('error', result_map);

    return callback(null, hash, true);
};

method.prototype.call = function(context){

    var args = _.a(arguments);
    var callback = args.pop();
    args.shift();

    return(this.apply(context, args, callback));
};

method.prototype.apply = function(context, args, callback, allow_map_params){
    var self = this;

    if(!_.isFunction(callback)){ _.fatal("you must pass a callback to method.call or method.apply."); }

    if(!self.method()){ return callback(_.error("no_method", "tried to call undefined method: " + self.name())); }

    if(_.isArray(args)){ return(self.method().apply(context, _.concat(callback, args))); }

    self.hash_to_parameters(args, _.plumb(function(args, used_override, used_fallback){

        return(self.apply(context, args, callback));

    }, callback), allow_map_params);

};

module.exports = method;
