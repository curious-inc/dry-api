"use strict";

var _ = require('dry-underscore');

// _.log.level("debug");

var config = {
    port: 9999,
    url: "/api",
    host: "http://localhost"
};

var express = require('express');

var dry_api = require('./');

var client = new dry_api.client(config.host + ":" + config.port + config.url);

var eq = _.test.eq;
var ok = _.test.ok;

var api_hash = null;

function test_api_manager(role, f){

    role = role || "public"

    var access_manager = test_access_manager();

    var api_manager = new dry_api.api_manager(access_manager);

    var api = api_manager.api("test", true);

    api[role]("echo", function(callback){
        if(f){ f.apply(this, arguments); }
        var args = _.a(arguments); 
        args.shift();
        args.unshift(null);
        callback.apply(this, args);
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

suite('server');

var server = null;

function start_server(callback){

    var app = express();

    var api_manager = test_api_manager();
    api_hash = api_manager.hash(true);

    var provider = new dry_api.providers.http_rpc(api_manager, app, config.url);

    provider.mount();

    server = app.listen(config.port);

    callback();
};

function stop_server(callback){
    server.close(); 
    callback();
};

before(start_server);
after(stop_server);

test("client.call echo", function(done){
    client.call("test.echo", [1, 2, 3], function(err, one, two, three){
        if(err){ throw(err); }
        eq(this.access_token, null);
        eq(err, null);
        eq(one, 1);
        eq(two, 2);
        eq(three, 3);

        done();
    });
});

test("client.call named", function(done){
    client.call("test.named", { one: 1, two: 2, three: 3 }, function(err, one, two, three){
        if(err){ throw(err); }
        eq(this.access_token, null);
        ok(!err);
        eq(one, 1);
        eq(two, 2);
        eq(three, 3);

        done();
    });
});

test("client.call named_back", function(done){
    client.call("test.named_back", { one: 1, two: 2, three: 3 }, function(err, one, two, three){
        if(err){ throw(err); }
        eq(this.access_token, null);
        ok(!err);
        eq(one, 1);
        eq(two, 2);
        eq(three, 3);

        done();
    });
});

test("client.call roles public", function(done){
    client.access_token(null).call("test.roles", [], function(err, api_role, roles){
        if(err){ throw(err); }
        eq(this.access_token, null);
        eq(api_role, "public");
        eq(roles, []);

        done();
    });
});

test("client.call roles user", function(done){
    client.access_token("user_token").call("test.roles", [], function(err, api_role, roles){
        if(err){ throw(err); }
        eq(this.access_token, "user_token");
        eq(api_role, "user");
        eq(roles, ["user"]);

        done();
    });
});

test("client.call roles admin", function(done){
    client.access_token("admin_token").call("test.roles", [], function(err, api_role, roles){
        if(err){ throw(err); }
        eq(this.access_token, "admin_token");
        eq(api_role, "admin");
        eq(roles, ["user", "admin"]);

        done();
    });
});

test("smart_client roles admin", function(done){
    var smart_client = client.smart_client(api_hash);
    smart_client.access_token("admin_token").test().roles(function(err, api_role, roles){
        if(err){ throw(err); }
        eq(this.access_token, "admin_token");
        eq(api_role, "admin");
        eq(roles, ["user", "admin"]);

        done();
    });
});

test("smart_client echo", function(done){
    var smart_client = client.smart_client(api_hash);
    smart_client.access_token("admin_token").test().echo(1, 2, 4, function(err, one, two, four){
        if(err){ throw(err); }
        eq(this.access_token, "admin_token");
        eq(one, 1);
        eq(two, 2);
        eq(four, 4);

        done();
    });
});

test("smart_client echo nothing", function(done){
    var smart_client = client.smart_client(api_hash);
    smart_client.access_token("admin_token").test().echo(function(err){
        if(err){ throw(err); }
        eq(arguments.length, 1);
        done();
    });
});


/*
test("smart_client write_code", function(done){
    var smart_client_code = client.smart_client_code(api_hash);
    _.fs.writeFile("./smart_client_code_test.js", smart_client_code, done);
});
*/