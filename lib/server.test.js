"use strict";

var _ = require('dry-underscore');

var express = require('express');

var manager_class = require('./manager.js');
var providers = require('./providers.js');

var request = require('dry-request');

var eq = _.test.eq;
var ok = _.test.ok;

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

suite('server');

var server = null;

function start_server(callback){

    var app = express();

    var manager = test_manager();

    var provider = new providers.http_rpc(manager, app, "/api");

    provider.mount();

    server = app.listen(9999);

    callback();
};

function stop_server(callback){
    server.close(); 
    callback();
};

before(start_server);
after(stop_server);

test("ping", function(done){
    request.get("http://localhost:9999/ping", function(error, res, body){
        eq(body, 'pong');
        done();
    });
});
 
test("call", function(done){
    request.post("http://localhost:9999/api", "{}", function(err, res, body){
        // _.p("err: ", err);
        // _.p("body: ", _.parse(body));
        body = _.parse(body);
        var params = body.params;
        // if(params[0]){ _.p(params[0].stack); }

        done();
    });
});

   /*
    var manager = test_manager();
    manager.call("unknown", null, [1, 2], function(err, one, two){
        eq(_.code(err), "malformed_call");
        done();
    });
    */

