"use strict";

var _ = require('dry-underscore');

var method_class = require('./method.js');
var api_class = require('./api.js');

var whitelist = require('./whitelist.js');

function api_manager(access_manager){

    this._apis = {};
    this._access_manager = access_manager;

    whitelist.init(this);

    var dummy_api = new api_class(this, "dummy", access_manager);

    this.encode_error = _.bind(dummy_api.encode_error, dummy_api);

    // do same error init as api
    api_class.prototype._init_errors.call(this);
}

whitelist.mixin(api_manager.prototype);

/*
var api_manager = new api_manager(api_manager.http(server, "/api"), api_manager.json_rpc());

api_manager.api("example", example_api);

api_manager.mount();
*/

_.hook(api_manager.prototype);
api_manager.prototype.arguments_prepper = _.hook.event_function("prepare_arguments");
api_manager.prototype.arguments_validator = _.hook.event_function("validate_arguments");
api_manager.prototype.expectation_validator = _.hook.event_function("validate_expectations");
api_manager.prototype.context_prepper = _.hook.event_function("prepare_context");

api_manager.prototype.access_manager = _.r("_access_manager");

api_manager.prototype.call = function(ns_method_name, context, hash, callback){

    var self = this;

    self.find_api(ns_method_name, function(err, api, api_name, method_name){
        if(err){ return callback(err, self.encode_error(err)); }
        api.call(method_name, context, hash, function(err, result_hash){
            return callback(err, result_hash);
        });
    });
};

api_manager.prototype.find_api = function(ns_method_name, callback){
    var self = this;

    if(!ns_method_name){ return callback(self.errors().malformed_call("A call needs an api name and function name in the format: api_name.method_name")); }

    var ns_method_name = ns_method_name.split(".");
    if(ns_method_name.length <= 1){ return callback(self.errors().malformed_call("A call needs an api name and function name in the format: api_name.method_name")); }

    var api_name = ns_method_name.shift();
    var method_name = ns_method_name.shift();

    var api = self.api(api_name);

    if(!api){ return callback(self.errors().unknown_api("unknown api: " + api_name)); }

    return callback(null, api, api_name, method_name);
};

api_manager.prototype.find_method = function(ns_method_name, context, callback){

    this.find_api(ns_method_name, _.plumb(function(api, api_name, method_name){
        api.find_method(method_name, context, callback);
    }, callback));
};

api_manager.prototype.api = function(api_name, create){

    if(this._apis[api_name]){ return(this._apis[api_name]); }

    if(create){ 
        var api = _.isObject(create) ? create : new api_class(this, api_name, this.access_manager());
        if(this.testing){ api.testing = true; }
        this._apis[api_name] = api;
    }

    return(this._apis[api_name]);
};

api_manager.prototype.hash = function(include_local){

    var hash = {};

    _.each(this._apis, function(api, api_name){
        var api_hash = api.hash(include_local);
        if(_.keys(api_hash).length){
            hash[api_name] = api_hash;
        }
    });

    return(hash);
};

module.exports = api_manager;

