"use strict";

/*
 
   - next
        - param(eter)s("name", "age").callback("message", "age_plus_ten");
        - serve it.
        - build a client

*/

/*
 
no need to have an api.load I don’t think. just create a blank from api_manager.api(“user”).

use
api.lock()
api_manager.lock()
to prevent mutation, and spelling mistakes? I think it might be overkill.

named parameters? or sugar up rpc format: { method: “system.echo”, string: “hello”, times: 2 }

echo(obj){ obj.string, obj.times }

vs { method: “system.echo”, params: [“hello”, 2] }

vs { call: “system.echo(“hello”, 2)” }

.params(“string”, “times”).documentation(“blah, blah, blah”)

maybe not on the documentation?
although we should automate that in some way.

we would not want to connect the actual argument names to the api names, 
a level of redirection is preferable to avoid unintended consequences, 
and match usual expectations that argument names don’t matter outside the function.

“you appear to be using named parameters with a function that doesn’t support it”


*/

var _ = require('dry-underscore');

var roles_class = require('./roles.js');
var method_class = require('./method.js');

function api(name, roles){

    roles = roles || { 
        server: { priority: 100, serve : false }, 
        admin: 200, user: 300, 
        public: { priority: 400, anon: true } 
    };

    this._name = name || "default";
    this._methods = {};
    this._roles = new roles_class(roles);
    this._expectors = _.fchain();

    this.expector(this.type_expector);

    this.context_timeout = 1000;

    this._init_role_functions();

}

_.hook(api.prototype);

api.prototype.context = _.hook.event_function("context");
api.prototype.expector = function(f){
    this._expectors.add(f);
};

var type_expector_hash = {
    'string' : _.isString,
    'number' : _.isNumber,
    'null' : _.isNull,
    'object' : _.isObject,
    'array' : _.isArray,
    '*' : function(){ return(true); }
};


api.prototype.type_expector = function(val, valid_types, callback){

    var is_valid = false;

    _.beach(valid_types, function(type){
        if(type_expector_hash[type]){
            is_valid = type_expector_hash[type](val);
        }else if(_.isNull(type) && _.isNull(val)){
            is_valid = true;
        }

        if(is_valid){ return(false); }
    });

    return callback(null, is_valid);
};

api.prototype.roles = _.r("_roles");
api.prototype.name = _.r("_name");
api.prototype.errors = _.r("_errors");

var errors = _.errors();

errors.add("failure", "failure");
errors.add("error", "error");
errors.add("unknown_api", "unknown api");
errors.add("unknown_method", "unknown method");
errors.add("malformed_call", "malformed call");
errors.add("method_error", "method error");
errors.add("down_for_maintenance", "down for maintenance");
errors.add("permission_error", "permission error");


api.prototype._errors = errors;

api.prototype._init_role_functions = function(){
    var self = this;

    _.each(this.roles().array(), function(role){
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

// TODO: HACK: right now we only "look" like we support async expectors, we don't.
// if we want to support async expectors, we need to change _.beach to each.async
// we also need to change _.fchain to something that supports async calling
// we built it like this so we could move that way in the future 
// but not spend time somewhere we didn't need to

api.prototype.validate_argument = function(index, arg, expectations, callback){

    if(!_.isArray(expectations)){ expectations = [expectations]; }

    var error = null;
    var is_valid = false;

    this._expectors.call(arg, expectations, function(err, valid){
        if(err){ error = err; return(false); }
        if(valid){ is_valid = true; return(false); }
    });
    
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

    if(!context){
        context = {};
    }else{
        context = _.jclone(context);
    }

    if(context.role){
        context.roles = [context.role];
    }

    if(!context.roles){
        context.roles = [];
    }

    if(context.local === undefined){
        context.local = false;
    }

    return(context);
};

api.prototype.call = function(method_name, context, args, callback){

    var self = this;

    if(!method_name){ _.fatal("api.call: must pass a method_name."); }
    if(!args){ _.fatal("api.call: must pass args for method call."); }
    if(!callback){ _.fatal("api.call: must pass a callback."); }

    // this copies the context
    context = self.process_context(context);
 
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

    self.bite("context", [context], _.plumb(function(){


        self.validate_expectations(method, args, function(err){

            if(err){ return callback(err); }
           
            // assertions throw errors
            if(self.testing){ return method.apply(context, args, callback);  }

            try{ return method.apply(context, args, callback); }
            catch(e){ return callback(self.errors().method_error(e)); }

        });
    
    }, callback), self.context_timeout);

};

module.exports = api;

function api_manager(){}

api_manager.prototype.call = function(ns_method_name, context, args, callback){

    if(!ns_method_name){ throw(self.statusCodes().malformedCall("A call needs an api name and function name")); }

    var ns_method_name = ns_method_name.split(".");
    if(ns_method_name.length <= 1){ throw(self.statusCodes().malformedCall("A call needs an api name and function name")); }

    var apiName = ns_method_name.shift();
    var methodName = ns_method_name.shift();
    var incomingRoles = options.roles;
        
    var workingApi = self[apiName];

    if(!workingApi){ throw(self.statusCodes().unknownApi()); }

    var hasAccess = false;
    var hasMethod = false;
    var method = null;
    
    for(var i = 0; i < self._rolesArray.length; i++){
        var roleInfo = self._rolesArray[i];
        if(workingApi[roleInfo.role] && workingApi[roleInfo.role][methodName] && (roleInfo.serve === true || options.local === true)){
            hasMethod = true;
            method = workingApi[roleInfo.role][methodName];
        }else{
            method = null;
        }
        if(method && (_.contains(incomingRoles, roleInfo.role) || roleInfo.anon)){
            hasAccess = true;
        }else{
            hasAccess = false;
        }
        if(method && hasAccess){ break; }
    }

    if(!hasMethod){
        throw(self.statusCodes().unknownMethod());
    }else if(hasMethod && !hasAccess){
        throw(self.statusCodes().permissionError());
    }else{
        // remove options and fns
        var args = Array.prototype.slice.call(arguments, 2);
        try{
            return method.apply(workingApi, args);
        }catch(e){
            throw(self.statusCodes().methodError(e));
        }
    }

};

/*
api_manager.prototype.load = function(f){
    var m = "";


};
*/



/* 
test("load simple", function(){

    api_manager.load.args = ["a", "b"];

    await{ api_manager.load_file("user.api.tjs", _.plumb(defer())); }
    api_manager.load(function(a, b, api, callback){
        eq(a, "a");
        eq(b, "b");

        api.public("test", function(one, two, three, cb){

            eq(one, 1);
            eq(two, 2);
            eq(three, 3);
            cb(one, two, three);

        }).expects(['user', 'admin'], 'string');

    });

    var called = false;
    api.call("test", null, [1, 2, 3], function(){
        called = true;
    });

    ok(called);

});
*/
