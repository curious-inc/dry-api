"use strict";

var _ = require('dry-underscore');

// _.log.level("debug");

var dry_api = require('./');

var test_server = require('./test_server.js');

// for self signed certs
_.http.unsafe = true;

var config = _.extend(test_server.config, {
    port: 9998,
    url: "/api",
    host: "https://localhost",
    tls: {
        key_path: "./keys/test.key",
        cert_path: "./keys/test.cert",
        bundle_path: ""
    }
});

var api_manager = test_server.api_manager;
var api_hash = api_manager.hash(true);

var http_endpoint = config.host + ":" + config.port + config.url

var client = new dry_api.client(http_endpoint);

var eq = _.test.eq;
var ok = _.test.ok;

suite('server');

before(test_server.start_server);
after(test_server.stop_server);

test("bad.call echo", function(done){
    _.http.post(http_endpoint, "", function(err, res, body){
        body = _.parse(body);
        eq(_.code(body.error), "malformed_call");
        done();
    });
});

test("client.call tags don't match", function(done){

    var tags_client = new dry_api.client(http_endpoint);

    tags_client.call("test.tags", [{ key_one: "val_one" }], function(err, tags_matched){
        if(err){ throw(err); }
        eq(tags_matched, false);
        done();
    });
});

test("client.call tags matched", function(done){

    var tags_client = new dry_api.client(http_endpoint);

    tags_client.tags("key_one", "val_one");
    tags_client.tags("key_two", "val_two");

    tags_client.call("test.tags", [{ key_one: "val_one", key_two: "val_two" }], function(err, tags_matched){
        if(err){ throw(err); }
        eq(tags_matched, true);

        done();
    });
});

test("client.call echo", function(done){
    client.call("test.echo", [1, 2, 3], function(err, one, two, three){
        if(err){ throw(err); }
        eq(this, {});
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
        eq(this, {});
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
        eq(this, {});
        ok(!err);
        eq(one, 1);
        eq(two, 2);
        eq(three, 3);

        done();
    });
});

test("client.call roles public", function(done){
    client.tags("access_token", null).call("test.roles", [], function(err, api_role, roles){
        if(err){ throw(err); }
        eq(this, {});
        eq(api_role, "public");
        eq(roles, []);

        done();
    });
});

test("client.call roles user", function(done){
    client.tags("access_token", "user_token").call("test.roles", [], function(err, api_role, roles){
        if(err){ throw(err); }
        eq(this, {});
        eq(api_role, "user");
        eq(roles, ["user"]);

        done();
    });
});

test("client.call roles admin", function(done){
    client.tags("access_token", "admin_token").call("test.roles", [], function(err, api_role, roles){
        if(err){ throw(err); }
        eq(this, {});
        eq(api_role, "admin");
        eq(roles, ["user", "admin"]);

        done();
    });
});

test("smart_client roles admin", function(done){
    var smart_client = client.smart_client(api_hash);
    smart_client.tags("access_token", "admin_token").test().roles(function(err, api_role, roles){
        if(err){ throw(err); }
        eq(this, {});
        eq(api_role, "admin");
        eq(roles, ["user", "admin"]);

        done();
    });
});

test("smart_client echo", function(done){
    var smart_client = client.smart_client(api_hash);
    smart_client.tags("access_token", "admin_token").test().echo(1, 2, 4, function(err, one, two, four){
        if(err){ throw(err); }
        eq(this, {});
        eq(one, 1);
        eq(two, 2);
        eq(four, 4);

        done();
    });
});

test("smart_client echo nothing", function(done){
    var smart_client = client.smart_client(api_hash);
    smart_client.tags("access_token", "admin_token").test().echo(function(err){
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
