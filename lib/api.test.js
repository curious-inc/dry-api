"use strict";

var _ = require('dry-underscore');

var api_class = require('./api.js');
var access_manager_class = require('./access_manager.js');

var eq = _.test.eq;
var ok = _.test.ok;

suite('api');

function test_access_manager(){

    // this works because we're using the in memory store

    var am = new access_manager_class();

    am.create("user_token", null, ["user"], null, _.noop);
    am.create("admin_token", null, ["user", "admin"], null, _.noop);

    return(am);
}

function test_api(role, f){

    role = role || "public";

    var api = new api_class("test_api", test_access_manager());

    api.testing = true;

    api[role]("echo", function(callback, arg1, arg2, arg3){
        if(f){ f.apply(this, arguments); }
        var args = _.a(arguments);
        var callback = args.shift();
        args.unshift(null);
        // args = [null, "echo", arg1, arg2, arg3];
        callback.apply(null, args);
    });

    api[role]("method_error", function(callback){
        throw(_.error("test_throw", "message"));
    });

    api['user']("role", function(callback){
        callback(null, "user", this.roles);
    });

    api['admin']("role", function(callback){
        callback(null, "admin", this.roles);
    });


    return(api);
};

function args_to_message(a, err){
    var message = {
        params: []
    };

    if(err !== undefined){
        message.error = err;
        message.params.unshift("error");
    }

    _.each(a, function(val, i){
        message.params.push(_.s(i+1));
        message[i+1] = val;
    });

    return(message);
}

test("simple method", function(done){

    var api = test_api();

    var expected = args_to_message([1, 2, 3], null);

    api.call("echo", null, args_to_message([1, 2, 3]), function(err, result){
        if(err){ throw(err); }
        eq(expected, result);
        done();
    });
});

test("simple context", function(done){

    var extra_called = false;
    var api = test_api("public", function(){
        extra_called = true;
        ok(!this.local);
        eq(this.test_context, "test_context");
    });

    api.context(function(next, context){
        context.test_context = "test_context";
        next();
    });


    api.call("echo", null, [1, 2, 3], function(err, one, two, three){
        ok(!err);
        eq(one, 1);
        eq(two, 2);
        eq(three, 3);
        ok(extra_called);
        done();
    });
});

/*
test("context changes roles error", function(done){

    var extra_called = false;
    var api = test_api();

    api.context(function(next, context){
        next();
    });


    api.call("role", null, [], function(err, role){
        eq(_.code(err), "permission_error");
        done();
    });
});

test("context changes roles user", function(done){

    var extra_called = false;
    var api = test_api();

    api.context(function(next, context){
        context.roles.push("user");
        next();
    });

    api.call("role", null, [], function(err, role){
        ok(!err);
        eq(role, "user");
        done();
    });
});

test("context changes roles admin", function(done){

    var extra_called = false;
    var api = test_api();

    api.context(function(next, context){
        context.roles.push("admin");
        next();
    });

    api.call("role", null, [], function(err, role){
        ok(!err);
        eq(role, "admin");
        done();
    });
});

test("user access_token", function(done){

    var extra_called = false;
    var api = test_api();

    api.call("role", { access_token: "user_token" }, [], function(err, role){
        ok(!err);
        eq(role, "user");
        done();
    });
});

test("admin access_token", function(done){

    var extra_called = false;
    var api = test_api();

    api.call("role", { access_token: "user_token" }, [], function(err, role){
        ok(!err);
        eq(role, "user");
        done();
    });
});



test("no_method", function(done){

    var api = test_api();

    api.call("no_method", null, [1, 2, 3], function(err, one, two, three){
        ok(_.code(err, "unknown_method"));
        eq(arguments.length, 1);
        done();
    });
});

test("method throws", function(done){

    var api = test_api();

    // setup the api to catch errors
    api.testing = false;

    api.call("method_error", null, [1, 2, 3], function(err, one, two, three){
        ok(_.code(err, "method_error"));
        eq(arguments.length, 1);
        done();
    });
});


test("bad role", function(done){

    var api = new test_api("admin");

    api.call("echo", { role: "user" }, [1, 2, 3], function(err, one, two, three){
        ok(_.code(err, "permission_error"));
        done();
    });

});


test("good roles", function(done){

    var api = new test_api("admin");

    api.call("echo", { roles: ["admin"] }, [1, 2, 3], function(err, one, two, three){
        ok(!err);
        done();
    });
});

test("good roles", function(done){

    var api = new test_api("admin");

    api.call("echo", { roles: ["user", "admin"] }, [1, 2, 3], function(err, one, two, three){
        ok(!err);
        done();
    });
});

test("local bad", function(done){

    var api = new test_api("server");

    api.call("echo", { roles: ["server"] }, [1, 2, 3], function(err, one, two, three){
        eq(_.code(err), "unknown_method");
        done();
    });
});

test("local good", function(done){

    var api = new test_api("server");

    api.call("echo", { local: true, roles: ["server"] }, [1, 2, 3], function(err, one, two, three){
        ok(!err);
        eq(one, 1);
        eq(two, 2);
        done();
    });
});

test("local bad", function(done){

    var api = new test_api("server");

    api.call("echo", { local: true, roles: ["admin"] }, [1, 2, 3], function(err, one, two, three){
        eq(_.code(err), "permission_error");
        done();
    });
});

test("overload upper", function(done){

    var api = new test_api("public");

    api.admin("echo", function(callback){
        callback(null, "admin");
    });

    api.call("echo", { local: true, roles: ["admin"] }, [1, 2, 3], function(err, one, two, three){
        ok(!err);
        eq(one, "admin");
        eq(arguments.length, 2);
        done();
    });
});

test("overload lower", function(done){

    var api = new test_api("public");

    api.admin("echo", function(callback){
        callback(null, "admin");
    });

    api.call("echo", { local: true, roles: ["user"] }, [1, 2, 3], function(err, one, two, three){
        ok(!err);
        eq(one, 1);
        eq(arguments.length, 4);
        done();
    });
});


test("local overload upper", function(done){

    var api = new test_api("server");

    api.admin("echo", function(callback){
        callback(null, "admin");
    });

    api.call("echo", { local: true, roles: ["server"] }, [1, 2, 3], function(err, one, two, three){
        ok(!err);
        eq(one, 1);
        eq(two, 2);
        done();
    });
});

test("named parameters", function(done){

    var api = new test_api("server");

    api.public("params", function(callback, first, second){
        callback(null, first, second);
    }).params('first', 'second');

    api.call("params", null, { first: 'first_test', second: 'second_test' }, function(err, first, second){
        ok(!err);
        eq(first, 'first_test');
        eq(second, 'second_test');
        done();
    });

});

test("whitelisted", function(){

    var api = test_api();

    var good = _.error("good", "ok error.");
    var bad = _.error("bad", "ok error.");
    
    ok(!api.whitelisted(bad));
    ok(!api.whitelisted(good));
    api.whitelist(good);
    ok(api.whitelisted(good));
    ok(!api.whitelisted(bad));

});


*/
