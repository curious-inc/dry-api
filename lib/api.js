"use strict";


// TODO: swap format for the one below
// param_map becomes params
// params always holds map to parameters
// if you don't have named parameters
// you use numbers

var _in = { 
    id: "id_uuid",
    method: "user.get", 
    params: ["user_id"],
    user_id: "some_user_id"
}

var _in = { 
    id: "id_uuid",
    method: "user.get", 
    params: [0],
    "0": "some_user_id"
}

var _out = {
    id: "id_uuid",
    params: ["error", "user"]
    error: null,
    user: {
        email: "kendrick@example.com",
        first_name: "Kendrick",
        last_name: "Taylor"
    }
};

var _out = {
    id: "id_uuid",
    params: ["error", "0"];
    error: null,
    "0": {
        email: "kendrick@example.com",
        first_name: "Kendrick",
        last_name: "Taylor"
    }
}


/*
    TODO:
        - ability to convert the whole request into an object, instead of params
            - api.public("make_call", funcition(callback, call){ call.some_method(); }).deserialize(dry.call);
            - this is a one off however, to support twilio like api calls (which seem to be popular).
            - we can allow any object that takes a hash as the first (and only) parameter
        - the rest of the time, we'll just deserialize all the parameters, which makes for uglier api calls,
            - but better in language apis. 
            - { last_call: { type: 'call', to: '555-555-5555' }, 
                history: [ 
                    { type: "call", from: '...' }, 
                    { type: "call", from: '...' },
                ],
                params_map: ['last_call', 'history']
              }
        - this doesn't need to be done right now.

*/

/*
 
maybe api_manager.load. create a blank from api_manager.api(“user”).

use api.lock() and api_manager.lock() to prevent mutation, and spelling mistakes? I think it might be overkill.

method.params(“string”, “times”).documentation(“blah, blah, blah”)

maybe not on the documentation? although we should automate that in some way.

*/

var _ = require('dry-underscore');

var method_class = require('./method.js');
var type_expector_class = require('./expectors/type_expector.js');

function api(name, access_manager, log){

    if(!access_manager){ _.fatal("api must be provided an access_manager"); }

    this._parent = null;
    this._name = name || "default";
    this._methods = {};
    this._access_manager = access_manager;
    this._log = log || _.log;
    this._expectors = _.fchain();

    var type_expector = new type_expector_class();

    this.expector(_.bind(type_expector.match, type_expector));

    this.context_timeout = 1000 * 20;
    this.prepare_arguments_timeout = 1000 * 20;

    whitelist.init(this);
    this._init_errors();
    this._init_role_functions();
}

_.hook(api.prototype);

api.prototype._set_parent = function(p){ this._parent = p; };
api.prototype.parent = _.r("_parent");

api.prototype.context = _.hook.event_function("context");
api.prototype.prepare_arguments = _.hook.event_function("prepare_arguments");
api.prototype.expector = function(f){
    this._expectors.add(f);
};

api.prototype.log = _.r("_log");
api.prototype.name = _.r("_name");
api.prototype.errors = _.r("_errors");
api.prototype.access_manager = _.r("_access_manager");
api.prototype.roles = function(){ return(this.access_manager().roles()); };

api.prototype._init_errors = function(){
    var errors = this.errors();

    errors.add("error", "error");
    errors.add("unknown_api", "unknown api");
    errors.add("unknown_method", "unknown method");
    errors.add("malformed_call", "malformed call");
    errors.add("method_error", "method error");
    errors.add("down_for_maintenance", "down for maintenance");
    errors.add("permission_error", "permission error");

    this.whitelist(errors.error());
    this.whitelist(errors.unknown_api());
    this.whitelist(errors.unknown_method());
    this.whitelist(errors.malformed_call());
    this.whitelist(errors.down_for_maintenance());
    this.whitelist(errors.permission_error());
};

whitelist.mixin(api.prototype);

api.prototype.hash = function(include_local){
    var self = this;

    var hash = {};

    var roles = self.access_manager().roles().hash();

    _.each(self._methods, function(methods, role_name){
        _.each(methods, function(method, method_name){
            if(roles[role_name].serve === false && !include_local){ return; }

            if(!hash[role_name]){ hash[role_name] = {}; }
            hash[role_name][method.name()] = method.hash();
        });
    });

    return(hash);
};

api.prototype._init_role_functions = function(){
    var self = this;

    _.each(self.roles().array(), function(role){
        var role_name = role.role;

        if(self[role_name]){ _.fatal("The names of properties of the api class must not be used as role names. You attempted to use the role name: " + role.role); }
        if(!self._methods[role_name]){ self._methods[role_name] = {}; }

        self[role_name] = function(name, method, expects){
            self._methods[role_name][name] = new method_class(role_name, name, method, expects);
            return(self._methods[role_name][name]);
        };
    });
};

api.prototype.method = function(role, method_name){
    return(this._methods[role][method_name] || null);
};

api.prototype.call_expectors = function(arg, expectations, callback){
   this._expectors.call(arg, expectations, callback);
};

// TODO: HACK: right now we only "look" like we support async expectors, we don't.
// if we want to support async expectors, we need to change _.beach to each.async
// we also need to change _.fchain to something that supports async calling
// we built it like this so we could move that way in the future 
// but not spend time somewhere we didn't need to

api.prototype.validate_argument = function(index, arg, expectations, callback){

    if(!_.isArray(expectations)){ expectations = [expectations]; }

    var error = null;
    var is_valid = false;

    if(this.parent()){
        this.parent().call_expectors(arg, expectations, function(err, valid){
            if(err){ error = err; return(false); }
            if(valid){ is_valid = true; return(false); }
        });
    }

    if(!error && !is_valid){
        this.call_expectors(arg, expectations, function(err, valid){
            if(err){ error = err; return(false); }
            if(valid){ is_valid = true; return(false); }
        });
    }
        
    if(error){ return callback(error); }
    else if(!is_valid){ return callback(_.error("bad_parameter", "parameter: " + index + " did not meet expectations: " + expectations)); }
    else{ callback(null); }
};

api.prototype.validate_expectations = function(method, args, callback){
    var self = this;

    if(!method.expects()){ return callback(null); }

    _.each.async(method.expects(), function(expectations, i, next, done){
        self.validate_argument(i, args[i], expectations, function(err){
            if(err){ return callback(err); }
            next();
        });

    }, function(){ callback(null); });
};

api.prototype.process_context = function(context){

    if(!context){ context = {}; }

    if(!context.roles){ context.roles = []; }

    if(context.local === undefined){
        context.local = false;
    }

    return(context);
};

api.prototype.get_context = function(context, callback){
    var self = this;

    function get_context_self(context){
        self.bite("context", [context], callback, self.context_timeout);
    }

    if(self.parent()){
        self.parent().get_context(context, function(err, context){
            if(err){ return callback(err); }
            else{ get_context_self(context); }
        });
    }else{
        get_context_self(context);
    }
};

api.prototype.find_method = function(method_name, context, callback){

    var self = this;

    if(!method_name){ _.fatal("api.find_method: must pass a method_name."); }
    if(!callback){ _.fatal("api.find_method: must pass a callback."); }
 
    var method = null;
    var has_access = false;
    var method_exists = false;

    _.beach(self.roles().array(), function(role){

        var role_name = role.role;

        method = null;
        has_access = false;

        if(self.method(role_name, method_name) && (role.serve === true || context.local === true)){
            method_exists = true;
            method = self.method(role_name, method_name);
        }

        if(method && (_.contains(context.roles, role_name) || role.anon)){
            has_access = true;
        }

        if(method && has_access){ return(false); }
    });

    if(!method_exists){
        return callback(self.errors().unknown_method());
    }
        
    if(!has_access){
        return callback(self.errors().permission_error());
    }

    // method exists, and we have access

    callback(null, method);
};

api.prototype.get_prepared_arguments = function(args, callback){

    var self = this;

    function get_prepared_arguments_self(args){
        self.bite("prepare_arguments", [args], callback, self.prepare_arguments_timeout);
    }

    if(self.parent()){
        self.parent().get_prepared_arguments(args, function(err, args){
            if(err){ return callback(err); }
            else{ get_prepared_arguments_self(args); }
        });
    }else{
        get_prepared_arguments_self(args);
    }
};

api.prototype.call = function(method_name, context, args, callback){

    var self = this;

    if(!method_name){ _.fatal("api.call: must pass a method_name."); }
    if(!args){ _.fatal("api.call: must pass args for method call."); }
    if(!callback){ _.fatal("api.call: must pass a callback."); }

    // this shallow copies the context
    context = self.process_context(context);

    self.access_manager().get(context.access_token, _.plumb(function(security_context){

        context = _.extend(context, security_context);

        self.get_context(context, _.plumb(function(context){

            self.find_method(method_name, context, _.plumb(function(method){

                self.get_prepared_arguments(args, _.plumb(function(args){

                    self.validate_expectations(method, args, _.plumb(function(){
                       
                        // assertions throw errors
                        if(self.testing){ return method.apply(context, args, callback);  }

                        try{ return method.apply(context, args, callback); }
                        catch(e){ return callback(self.errors().method_error(e)); }

                    }, callback));

                }, callback));

            }, callback));

        }, callback));

     }, callback));
};

module.exports = api;


