"use strict";

var _ = require('dry-underscore');

var express = require('express');

var manager_class = require('./manager.js');
var providers = require('./providers.js');

function test_manager(role, f){

    role = role || "public"

    var manager = new manager_class();

    var api = manager.api("test", true);

    api.testing = true;

    api[role]("echo", function(callback, a, b){
        if(f){ f.apply(this, arguments); }
        callback(null, a, b);
    });

    return(manager);
}

var server = null;

function start_server(callback){

    var app = express();

    var manager = test_manager();

    var provider = new providers.http_rpc(manager, app, "/api");

    provider.mount();

    server = app.listen(9999);

    _.p("listening on port: " + 9999);

    callback();
};

function stop_server(callback){
    server.close(); 
    callback();
};

start_server(_.noop);


