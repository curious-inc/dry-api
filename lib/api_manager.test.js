"use strict";

var _ = require('dry-underscore');

var api_manager_class = require('./api_manager.js');
var access_manager_class = require('./access_manager.js');

var eq = _.test.eq;
var ok = _.test.ok;

suite('api_manager');


function test_access_manager(){

    // this works because we're using the in memory store

    var am = new access_manager_class();

    am.create("user_token", null, ["user"], null, _.noop);
    am.create("admin_token", null, ["user", "admin"], null, _.noop);

    return(am);
}

function test_api_manager(role, f){

    role = role || "public";

    var manager = new api_manager_class(test_access_manager());

    manager.testing = true;

    var api = manager.api("test", true);


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

    return(manager);
};

test("simple method", function(done){

    var api = test_api_manager();

    api.call("test.echo", null, [1, 2, 3], function(err, one, two, three){
        if(err){ throw(err); }
        eq(one, 1);
        eq(two, 2);
        eq(three, 3);
        done();
    });
});

test("prepare_arguments error", function(done){

    var api = test_api_manager();

    api.prepare_arguments(function(next, args){
        args.unshift("modified");
        next(_.error("args_error", "error preparing arguments."));
    });


    api.call("test.echo", null, [1, 2, 3], function(err, modified, one, two, three){
        ok(err);
        eq(_.code(err), "args_error");
        eq(modified, undefined);
        done();
    });
});

test("prepare_arguments", function(done){

    var api = test_api_manager();

    api.prepare_arguments(function(next, args){
        args.unshift("modified");
        args[1] = 3;
        next();
    });


    api.call("test.echo", null, [1, 2, 3], function(err, modified, one, two, three){
        ok(!err);
        eq(modified, "modified");
        eq(one, 3);
        eq(two, 2);
        eq(three, 3);
        done();
    });
});

test("simple context", function(done){

    var extra_called = false;
    var api = test_api_manager("public", function(){
        extra_called = true;
        ok(!this.local);
        eq(this.test_context, "test_context");
    });

    api.context(function(next, context){
        context.test_context = "test_context";
        next();
    });

    api.call("test.echo", null, [1, 2, 3], function(err, one, two, three){
        ok(!err);
        eq(one, 1);
        eq(two, 2);
        eq(three, 3);
        ok(extra_called);
        done();
    });
});

test("context changes roles error", function(done){

    var extra_called = false;
    var api = test_api_manager();

    api.context(function(next, context){
        next();
    });

    api.call("test.role", null, [], function(err, role){
        eq(_.code(err), "permission_error");
        done();
    });
});

test("context changes roles user", function(done){

    var extra_called = false;
    var api = test_api_manager();

    api.context(function(next, context){
        context.roles.push("user");
        next();
    });

    api.call("test.role", null, [], function(err, role){
        ok(!err);
        eq(role, "user");
        done();
    });
});

test("context changes roles admin", function(done){

    var extra_called = false;
    var api = test_api_manager();

    api.context(function(next, context){
        context.roles.push("admin");
        next();
    });

    api.call("test.role", null, [], function(err, role){
        ok(!err);
        eq(role, "admin");
        done();
    });
});

test("user access_token", function(done){

    var extra_called = false;
    var api = test_api_manager();

    api.call("test.role", { access_token: "user_token" }, [], function(err, role){
        ok(!err);
        eq(role, "user");
        done();
    });
});

test("admin access_token", function(done){

    var extra_called = false;
    var api = test_api_manager();

    api.call("test.role", { access_token: "user_token" }, [], function(err, role){
        ok(!err);
        eq(role, "user");
        done();
    });
});

test("no_method", function(done){

    var api = test_api_manager();

    api.call("test.no_method", null, [1, 2, 3], function(err, one, two, three){
        ok(_.code(err, "unknown_method"));
        eq(arguments.length, 1);
        done();
    });
});

test("method throws", function(done){

    var api = test_api_manager();

    // setup the api to catch errors
    api.testing = false;
    api.api("test").testing = false;

    api.call("test.method_error", null, [1, 2, 3], function(err, one, two, three){
        ok(_.code(err, "method_error"));
        eq(arguments.length, 1);
        done();
    });
});

test("expects good", function(done){

    var api = test_api_manager();

    api.api("test").method("public", "echo").expects('number', 'number');

    api.call("test.echo", null, [1, 2], function(err, one, two){
        done();
    });

});

test("expects better", function(done){

    var api = test_api_manager();

    api.api("test").method("public", "echo").expects('number', ['number', 'string']);

    api.call("test.echo", null, [1, ""], function(err, one, two){
        ok(!err);
        done();
    });
});


test("expects bad", function(done){

    var api = test_api_manager();

    api.api("test").method("public", "echo").expects('number', 'number');

    api.call("test.echo", null, [1, ""], function(err, one, two){
        ok(err);
        eq(_.code(err), "bad_parameter");
        done();
    });
});

function test_api_special_expector(){
    var api = test_api_manager();

    api.api("test").method("public", "echo").expects(['number', 'special'], 'number');

    return(api);
}

test("expector good", function(done){

    var api = test_api_special_expector();

    api.call("test.echo", null, [1, 1], function(err, one, two){
        ok(!err);
        done();
    });

});

test("expector bad", function(done){

    var api = test_api_special_expector();

    api.call("test.echo", null, ['special', 1], function(err, one, two){
        ok(_.code(err, "bad_parameter"));
        done();
    });

});

test("expector bad now good", function(done){

    var api = test_api_special_expector();

    api.expector(function(val, expected, callback){
        callback(null, _.contains(expected, 'special') && val === 'special');
    });

    api.call("test.echo", null, ['special', 2], function(err, one, two){
        ok(!err);
        done();
    });

});

test("expector test error", function(done){

    var api = test_api_special_expector();

    api.expector(function(val, expected, callback){
        callback(_.error("test_error", "test error."));
    });

    api.call("test.echo", null, ['bad_parameter', 2], function(err, one, two){
        eq(_.code(err), "test_error");
        done();
    });
});

test("bad role", function(done){

    var api = new test_api_manager("admin");

    api.call("test.echo", { role: "user" }, [1, 2, 3], function(err, one, two, three){
        ok(_.code(err, "permission_error"));
        done();
    });

});


test("good roles", function(done){

    var api = new test_api_manager("admin");

    api.call("test.echo", { roles: ["admin"] }, [1, 2, 3], function(err, one, two, three){
        ok(!err);
        done();
    });
});

test("good roles", function(done){

    var api = new test_api_manager("admin");

    api.call("test.echo", { roles: ["user", "admin"] }, [1, 2, 3], function(err, one, two, three){
        ok(!err);
        done();
    });
});

test("local bad", function(done){

    var api = new test_api_manager("server");

    api.call("test.echo", { roles: ["server"] }, [1, 2, 3], function(err, one, two, three){
        eq(_.code(err), "unknown_method");
        done();
    });
});

test("local good", function(done){

    var api = new test_api_manager("server");

    api.call("test.echo", { local: true, roles: ["server"] }, [1, 2, 3], function(err, one, two, three){
        ok(!err);
        eq(one, 1);
        eq(two, 2);
        done();
    });
});

test("local bad", function(done){

    var api = new test_api_manager("server");

    api.call("test.echo", { local: true, roles: ["admin"] }, [1, 2, 3], function(err, one, two, three){
        eq(_.code(err), "permission_error");
        done();
    });
});

test("overload upper", function(done){

    var api = new test_api_manager("public");

    api.api("test").admin("echo", function(callback){
        callback(null, "admin");
    });

    api.call("test.echo", { local: true, roles: ["admin"] }, [1, 2, 3], function(err, one, two, three){
        ok(!err);
        eq(one, "admin");
        eq(arguments.length, 2);
        done();
    });
});

test("overload lower", function(done){

    var api = new test_api_manager("public");

    api.api("test").admin("echo", function(callback){
        callback(null, "admin");
    });

    api.call("test.echo", { local: true, roles: ["user"] }, [1, 2, 3], function(err, one, two, three){
        ok(!err);
        eq(one, 1);
        eq(arguments.length, 4);
        done();
    });
});

test("local overload upper", function(done){

    var api = new test_api_manager("server");

    api.api("test").admin("echo", function(callback){
        callback(null, "admin");
    });

    api.call("test.echo", { local: true, roles: ["server"] }, [1, 2, 3], function(err, one, two, three){
        ok(!err);
        eq(one, 1);
        eq(two, 2);
        done();
    });
});

test("named parameters", function(done){

    var api = new test_api_manager("server");

    api.api("test").public("params", function(callback, first, second){
        callback(null, first, second);
    }).params('first', 'second');

    api.call("test.params", null, { first: 'first_test', second: 'second_test' }, function(err, first, second){
        ok(!err);
        eq(first, 'first_test');
        eq(second, 'second_test');
        done();
    });

});
