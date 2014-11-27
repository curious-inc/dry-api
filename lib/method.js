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
    this._fallback_args_map_name = "map_params";
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
    if(_.contains(args, 'method')){ _.fatal('you can not have a parameter named "method".'); }
    if(_.contains(args, this._override_args_name)){ _.fatal('you can not have a parameter named "' + this._override_args_name + '".'); }
    if(_.contains(args, this._fallback_args_map_name)){ _.fatal('you can not have a parameter named "', this._fallback_args_map_name, '".'); }
});
method.prototype.params = method.prototype.parameters;

method.prototype.callback = array_function("_outgoing_parameters");

method.prototype.get_params_map = function(hash, callback, allow_fallback_map){

    var used_fallback = false;
    var fallback_map_name = this._fallback_args_map_name;

    var params = this.params();

    if(params){ return callback(null, params, used_fallback); }

    if(!allow_fallback_map){ return callback(_.error("no_support", "method does not support named parameters.")); }

    if(_.isArray(hash[fallback_map_name])){
        params = hash[fallback_map_name];
        used_fallback = true;
    }else{
        return callback(_.error("no_support", "method does not support named parameters, and you did not include an arguments map named: " + fallback_map_name + "."));
    }
    
    return callback(null, params, used_fallback);
};

method.prototype.hash_to_args = function(hash, callback, allow_fallback_map){

    if(_.isArray(hash[this._override_args_name])){
        return callback(null, hash[this._override_args_name], true, false);
    }

    this.get_params_map(hash, _.plumb(function(params_map, used_fallback){

        var args = _.map(params_map, function(p){ return(hash[p]); });
        callback(null, args, false, used_fallback);

    }, callback), allow_fallback_map);

};

method.prototype.call = function(context){

    var args = _.a(arguments);
    var callback = args.pop();
    args.shift();

    return(this.apply(context, args, callback));
};

method.prototype.apply = function(context, args, callback, allow_fallback_map){
    var self = this;

    if(!_.isFunction(callback)){ _.fatal("you must pass a callback to method.call or method.apply."); }

    if(!self.method()){ return callback(_.error("no_method", "tried to call undefined method: " + self.name())); }

    if(_.isArray(args)){ return(self.method().apply(context, _.concat(callback, args))); }

    self.hash_to_args(args, _.plumb(function(args, used_override, used_fallback){

        return(self.apply(context, args, callback));

    }, callback), allow_fallback_map);

};

module.exports = method;
