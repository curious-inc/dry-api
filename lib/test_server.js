"use strict";

var _ = require('dry-underscore');
var express = require('express');
var dry_api = require('./');

var server = null;

var access_manager = exports.access_manager = test_access_manager();
var api_manager = exports.api_manager = test_api_manager();

var config = exports.config = {
    port: 9999,
    url: "/api",
    host: "http://localhost"
};

function test_api_manager(role, f){

    role = role || "public"

    var api_manager = new dry_api.api_manager();
    api_manager.context_prepper(access_manager.context_prepper());

    var api = api_manager.api("test", true);

    api[role]("echo", function(callback){
        if(f){ f.apply(this, arguments); }
        var args = _.a(arguments); 
        args.shift();
        args.unshift(null);
        callback.apply(this, args);
    });

    api[role]("tags", function(callback, expected_tags){
        try{
            _.test.eq(expected_tags, this.tags);
        }catch(e){
            return callback(null, false);
        }
        return callback(null, true);
    });

    api[role]("named", function(callback){
        if(f){ f.apply(this, arguments); }
        var args = _.a(arguments); 
        args.shift();
        args.unshift(null);
        callback.apply(this, args);
    }).params('one', 'two', 'three');

    api[role]("named_back", function(callback){
        if(f){ f.apply(this, arguments); }
        var args = _.a(arguments); 
        args.shift();
        args.unshift(null);
        callback.apply(this, args);
    }).params('one', 'two', 'three').callback('one', 'two', 'three');

    api.public("roles", function(callback){
        callback(null, "public", this.roles);
    }).callback('api_role', 'roles');

    api.user("roles", function(callback){
        callback(null, "user", this.roles);
    }).callback('api_role', 'roles');

    api.admin("roles", function(callback){
        callback(null, "admin", this.roles);
    }).callback('api_role', 'roles');

    return api_manager;
}

function test_access_manager(){

    var access_manager = new dry_api.access_manager();

    access_manager.create("admin_token", null, ['user', 'admin'], { extra: "admin" }, _.noop);

    access_manager.create("user_token", null, ['user'], { extra: "user" }, _.noop);

    access_manager.create("expired", _.timestamp()-100, ['public'], { extra: "expired" }, _.noop);

    return(access_manager);
};

function start_server(callback){

    var app = express();

    var provider = new dry_api.providers.http_rpc(api_manager, app, config.url);

    provider.mount();

    app.get("/ping", function(req, res){
        res.end("pong");
    });

    function server_callback(){
        _.log.info("server listening on: ", config.port);
        callback();
    }

    if(config.tls){
        run_https_server(config, app, server_callback);
    }else{
        run_http_server(config, app, server_callback);
    }
};

function run_https_server(config, app, callback){

    var https = require('https');

    var ssl_info = _.tls.hash(config.tls.key_path, config.tls.cert_path, config.tls.ca_path);

    server = https.createServer(ssl_info, app);

    server.listen(config.port, function(){
        callback();
    });
}

function run_http_server(config, app, callback){

    var http = require('http');

    server = http.createServer(app);

    server.listen(config.port, function(){ callback(); });
}


function stop_server(callback){
    server.close(); 
    callback();
};


exports.start_server = start_server;
exports.stop_server = stop_server;
