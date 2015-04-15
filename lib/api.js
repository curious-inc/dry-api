"use strict";


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
    params: ["error", "user"],
    error: null,
    user: {
        email: "kendrick@example.com",
        first_name: "Kendrick",
        last_name: "Taylor"
    }
};

var _out = {
    id: "id_uuid",
    params: ["error", "0"],
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

var whitelist = require('./whitelist.js');
var method_class = require('./method.js');
var roles_class = require('./roles.js');

function api(api_manager, name, roles, log){

    roles = roles || api.default_roles;
    this._roles = new roles_class(roles);

    this._api_manager = api_manager;

    this.hook_parent(this.api_manager());

    this._name = name || "default";
    this._methods = {};
    this._log = log || _.log;

    this.context_timeout = 1000 * 20;

    this._dummy_method = new method_class(this, "", "dummy", _.noop);

    whitelist.init(this, this._api_manager);

    this._init_errors();
    this._init_role_functions();
}

api.default_roles = { 
    server: { priority: 100, serve : false }, 
    admin: 200, 
    user: 300, 
    public: { priority: 400, anon: true } 
};

whitelist.mixin(api.prototype);

_.hook(api.prototype);
api.prototype.arguments_prepper = _.hook.event_function("prepare_arguments");
api.prototype.arguments_validator = _.hook.event_function("validate_arguments");
api.prototype.expectation_validator = _.hook.event_function("validate_expectations");

api.prototype.context_prepper = _.hook.event_function("prepare_context");
api.prototype.prepare_context = function(context, hash, callback){
    this.bite("prepare_context", [context, hash], callback, this.context_timeout);
};

api.prototype.api_manager = _.r("_api_manager");

api.prototype.log = _.r("_log");
api.prototype.name = _.r("_name");
api.prototype.roles = _.r("_roles"); 


api.prototype._init_errors = function(){

    var errors = this.errors();

    errors.add("error", "error.");
    errors.add("unknown_api", "unknown api.");
    errors.add("unknown_method", "unknown method.");
    errors.add("malformed_call", "malformed call.");
    errors.add("method_error", "method error.");
    errors.add("down_for_maintenance", "down for maintenance.");
    errors.add("permission_error", "permission error.");

    this.whitelist(errors.error());
    this.whitelist(errors.unknown_api());
    this.whitelist(errors.unknown_method());
    this.whitelist(errors.malformed_call());
    this.whitelist(errors.down_for_maintenance());
    this.whitelist(errors.permission_error());
};

api.prototype.encode_error = function(err){
    return this._dummy_method.encode_error(err);
};

api.prototype.hash = function(include_local){
    var self = this;

    var hash = {};

    var roles = self.roles().hash();

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
            self._methods[role_name][name] = new method_class(self, role_name, name, method, expects, self.log().child(role_name + "." + name));
            return(self._methods[role_name][name]);
        };
    });
};

api.prototype.method = function(role, method_name){
    return(this._methods[role][method_name] || null);
};

api.prototype.process_context = function(context, hash){

    if(!context){ context = {}; }

    if(!context.roles){ context.roles = []; }

    var tags = {};

    if(context.tags){ tags = _.extend(tags, context.tags); }
    if(hash.tags){ tags = _.extend(tags, hash.tags); }

    if(hash.method){ 
        context.method = hash.method;
        _.p(context.method);
    }

    context.tags = tags;

    if(context.local === undefined){
        context.local = false;
    }

    return(context);
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

// this handles errors with a hash
api.prototype.call = function(method_name, context, hash, callback){

    var self = this;

    if(!method_name){ _.fatal("api.call: must pass a method_name."); }
    if(!hash){ _.fatal("api.call: must pass hash for method call."); }
    if(!callback){ _.fatal("api.call: must pass a callback."); }

    // this shallow copies the context
    context = self.process_context(context, hash);

    self.prepare_context(context, hash, function(err, context){
        if(err){ return callback(err, self.encode_error(err)); }

        self.find_method(method_name, context, function(err, method){
            if(err){ return callback(err, self.encode_error(err)); }

            return method.call(context, hash, callback);

        });
    });
};

module.exports = api;


