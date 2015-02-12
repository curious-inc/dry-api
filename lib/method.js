"use strict";

var _ = require('dry-underscore');
var whitelist = require('./whitelist.js');
var message_format = require('./message_format.js');
var type_expector = require('./expectation_validators/type_expector.js');

function method(api, role, name, method, expects, log, max_params_length){
    this._api = api || null;
    this.hook_parent(this.api());

    this._log = log || _.log;
    this._name = name;
    this._method = method || null;
    this._role = role || null;
    this._expects = expects || [];
    this._incoming_parameters = null;
    this._outgoing_parameters = null;
    this._max_params_length = max_params_length || 12;

    if(!this.method()){ _.fatal("you must pass a method to the method constructor. method_name: " + this.name()); }

    whitelist.init(this);

    this.prepare_arguments_timeout = 1000 * 20;
    this.validate_arguments_timeout = 1000 * 20;

    this.expectation_validator(type_expector);

    this._init_errors();
}

_.hook(method.prototype);

whitelist.mixin(method.prototype);

method.prototype._init_errors = function(){
    var errors = this.errors();

    errors.add("error", "error.");
    errors.add("invalid_arguments", "invalid arguments.");
    errors.add("method_error", "method error.");

    this.whitelist(errors.error());
    this.whitelist(errors.invalid_arguments());
}

method.dummy = function(){ return new method(null, "", "noop", _.noop); };

method.prototype.api = _.r("_api");
method.prototype.log = _.r("_log");
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


method.prototype.self_whitelisted = method.prototype.whitelisted;

method.prototype.whitelisted = function(err){
    if(this.self_whitelisted(err)){ return(true); }
    else if(this.api() && this.api().whitelisted(err)){ return(true); }
    else{ return(false); }
};

method.prototype.client_error = function(err, is_validation_error){

    var client_error = this.errors().error(); 

    if(is_validation_error){
        client_error = this.errors().invalid_arguments(err.message);
    }

    if(this.whitelisted(err)){ 
        client_error = err;
        err.whitelisted = true;
    }

    // send a simple error back, even if it's whitelisted
    return({ code: client_error.code, message: client_error.message });
};

method.prototype.arguments_prepper = _.hook.event_function("prepare_arguments");
method.prototype.prepare_arguments = function(args, callback){
    this.bite("prepare_arguments", [args], callback, this.prepare_arguments_timeout);
};

method.prototype.arguments_validator = _.hook.event_function("validate_arguments");
method.prototype.validate_arguments = function(args, callback){
    var self = this;
    args = _.clone(args);
    this.bite("validate_arguments", [this, args], function(err, method, args){ 
        if(_.isString(err)){ 
            return callback(self.errors().invalid_arguments(err));
        } else{ return callback(err); }
    }, this.validate_arguments_timeout);
};

method.prototype.expectation_validator = _.hook.event_function("validate_expectations");
method.prototype.validate_expectations = function(args, callback){

    var self = this;
    if(!self.expects()){ return callback(null); }

    _.each.async(self.expects(), function(expectations, i, next, done){
        self.validate_argument_expectations(i, args[i], expectations, function(err){
            if(err){ return callback(err); }
            next();
        });
    }, function(){ callback(null); });
};

method.prototype.validate_argument_expectations = function(index, arg, expectations, callback){

    var self = this;

    var valid = false;

    function is_valid(flag){ if(flag === undefined){ flag = true; } valid = flag; }

    if(!_.isArray(expectations)){ expectations = [expectations]; }

    self.bite("validate_expectations", [arg, expectations, is_valid], function(err){ 
        if(err){ return callback(err); }

        if(valid){ return callback(null); }
        else{ return callback(self.errors().invalid_arguments("parameter[" + index + "]: value(" + _.stringify(arg) + ") did not meet expectations: " + expectations)); }
    });
};

method.prototype.encode_error = function(err, is_validation_error, message){
    message = message || new message_format({});
    var client_error = this.client_error(err, is_validation_error);
    var result = message.encode_error(client_error);
    return(result);
};

method.prototype.call = function(context, hash, callback){
    var self = this;

    if(!_.isFunction(callback)){ _.fatal("you must pass a callback to method.call."); }

    var message = new message_format(hash, this.max_params_length);

    function handle_error(err, is_validation_error){
        var result = self.encode_error(err, is_validation_error, message);
        return callback(err, result);
    }

    message.decode_arguments(self.incoming_parameters(), function(err, args){
        if(err){ return handle_error(err); }

        self.prepare_arguments(args, function(err, args){
            if(err){ return handle_error(err); }

            self.validate_expectations(args, function(err){
                if(err){ return handle_error(err); }

                self.validate_arguments(args, function(err){
                    if(err){ return handle_error(err, true); }
                           
                    self._apply_arguments(context, args, function(err){
                        if(err){ return handle_error(err); }

                        message.encode_arguments(self.outgoing_parameters(), arguments, callback);
                    });
                });
            });
        });
    });
};

method.prototype._apply_arguments = function(context, args, callback){

    // we use nextTick because if we didn't and callback threw an error, 
    // we would wind up passing the error right back to callback, 
    // which doesn't make any sense. I learned this the hard way.

    try{ 
        this.method().apply(context, _.concat(function(){  
            var result_args = arguments;
            _.nextTick(function(){ callback.apply(null, result_args); });
        }, args)); 
    }catch(e){ 
        if(!e || _.undef(e.type) || _.undef(e.code)){ e = this.errors().method_error(e.message, e); }
        e.thrown = true;
        return callback(e);
    }
    
};

module.exports = method;
