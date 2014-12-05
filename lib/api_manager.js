"use strict";

var _ = require('dry-underscore');

var method_class = require('./method.js');
var api_class = require('./api.js');

function api_manager(access_manager){

    this._apis = {};
    this._access_manager = access_manager;
   
    // exploit the fact that api has already defined these functions
    // there is some tight coupling here. these are the functions the child needs
    var dummy_api = new api_class("dummy", access_manager);

    this.errors = _.bind(dummy_api.errors, dummy_api);
    this.context = _.bind(dummy_api.context, dummy_api);
    this.expector = _.bind(dummy_api.expector, dummy_api);
    this.prepare_arguments = _.bind(dummy_api.prepare_arguments, dummy_api);
    this.call_expectors = _.bind(dummy_api.call_expectors, dummy_api);
    this.get_context = _.bind(dummy_api.get_context, dummy_api);
    this.get_prepared_arguments = _.bind(dummy_api.get_prepared_arguments, dummy_api);

    this.dummy_api = dummy_api;
}

/*
var api_manager = new api_manager(api_manager.http(server, "/api"), api_manager.json_rpc());

api_manager.api("example", example_api);

api_manager.mount();
*/


// _.hook(api_manager.prototype);

api_manager.prototype.access_manager = _.r("_access_manager");

api_manager.prototype.call = function(ns_method_name, context, args, callback){

    this.find_api(ns_method_name, _.plumb(function(api, api_name, method_name){
        return api.call(method_name, context, args, callback);
    }, callback));
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
        var api = new api_class(api_name, this.access_manager());
        if(this.testing){ api.testing = true; }
        api._set_parent(this);
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

module.exports = api_manager;

