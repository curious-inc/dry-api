"use strict";

var _ = require('dry-underscore');

var api_manager_class = require('./api_manager.js');
var access_manager_class = require('./access_manager.js');

var eq = _.test.eq;
var ok = _.test.ok;

suite('api_manager');

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

    var api = manager.api("test", true);

    api.whitelist(_.error("ApiWhitelisted", "whitelisted error."));
    manager.whitelist(_.error("ManagerWhitelisted", "whitelisted error."));

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

test('hash', function(){

    var manager = new api_manager_class(new access_manager_class());

    manager.api("foo", true).public("foo_method", _.noop).expects('string', 'bar').callback('foo', 'bar');
    manager.api("foo").public("bar_method", _.noop).expects('string', 'bar').callback('foo', 'bar');
    manager.api("foo").admin("bar_method", _.noop).expects('string', 'bar').callback('foo', 'bar').params('one', 'two');
    manager.api("bar", true).public("foo_method", _.noop).expects('string', 'bar').callback('foo', 'bar');
    manager.api("bar", true).server("bar_method", _.noop).expects('string', 'bar').callback('foo', 'bar');
    manager.api("only_server", true).server("bar_method", _.noop).expects('string', 'bar').callback('foo', 'bar');

    var expected_no_local = {
        foo: { 
            public: { 
                "foo_method": { role: 'public', name: "foo_method", expects: ['string', 'bar'], callback: ['foo', 'bar'], params: null },
                "bar_method": { role: 'public', name: "bar_method", expects: ['string', 'bar'], callback: ['foo', 'bar'], params: null } 
            },
            admin: {
                "bar_method": { role: 'admin', name: "bar_method", expects: ['string', 'bar'], callback: ['foo', 'bar'], params: ['one', 'two'] } 
            }
        },
        bar: {
            public: {
                "foo_method": { role: 'public', name: "foo_method", expects: ['string', 'bar'], callback: ['foo', 'bar'], params: null } 
            }
        }
    }

    eq(manager.hash(), expected_no_local);

    var expected_local = _.jclone(expected_no_local);

    expected_local.bar.server = { bar_method : { role: 'server', name: "bar_method", expects: ['string', 'bar'], callback: ['foo', 'bar'], params: null } };

    expected_local.only_server = {};
    expected_local.only_server.server = { bar_method : { role: 'server', name: "bar_method", expects: ['string', 'bar'], callback: ['foo', 'bar'], params: null } };

    eq(manager.hash(true), expected_local);

});

test("simple method", function(done){

    var api = test_api_manager();

    api.call("test.echo", null, args_to_message([1, 2, 3]), function(err, result){
        eq(err, null);
        eq(result, args_to_message([1, 2, 3], null));
        done();
    });
});

test("prepare_arguments error", function(done){

    var api = test_api_manager();

    api.arguments_prepper(function(next, args){
        args.unshift("modified");
        next(_.error("args_error", "error preparing arguments."));
    });


    api.call("test.echo", null, args_to_message([1, 2, 3]), function(err, result){
        ok(err);
        eq(_.code(err), "args_error");
        eq(result, args_to_message([], _.omit(api.errors().error(), "stack", "type")));
        done();
    });
});

test("prepare_arguments", function(done){

    var api = test_api_manager();

    api.arguments_prepper(function(next, args){
        args.unshift("modified");
        args[1] = 3;
        next();
    });


    api.call("test.echo", null, args_to_message([1, 2, 3]), function(err, result){
        eq(err, null);
        eq(result, args_to_message(["modified", 3, 2, 3], null));
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

    api.context_prepper(function(next, context){
        context.test_context = "test_context";
        next();
    });


    api.call("test.echo", null, args_to_message([1, 2, 3]), function(err, result){
        eq(null, err);
        eq(result, args_to_message([1, 2, 3], null));
        ok(extra_called);
        done();
    });
});

test("context changes roles error", function(done){

    var api = test_api_manager();

    api.context_prepper(function(next, context){
        next();
    });

    api.call("test.role", null, args_to_message([]), function(err, result){
        eq(_.code(err), "permission_error");
        eq(result, args_to_message([], _.omit(api.errors().permission_error(), "stack", "type")));
        done();
    });
});

test("context changes roles user", function(done){

    var api = test_api_manager();

    api.context_prepper(function(next, context){
        context.roles.push("user");
        next();
    });

    api.call("test.role", null, args_to_message([]), function(err, result){
        eq(err, null);
        eq(result, args_to_message(["user", ["user"]], null));
        done();
    });
});

test("context changes roles admin", function(done){

    var api = test_api_manager();

    api.context_prepper(function(next, context){
        context.roles.push("admin");
        next();
    });

    api.call("test.role", null, args_to_message([]), function(err, result){
        eq(err, null);
        eq(result, args_to_message(["admin", ["admin"]], null));
        done();
    });
});

test("user access_token", function(done){

    var api = test_api_manager();

    api.call("test.role", { access_token: "user_token" }, args_to_message([]), function(err, result){
        eq(err, null);
        eq(result, args_to_message(["user", ["user"]], null));
        done();
    });
});

test("admin access_token", function(done){

    var api = test_api_manager();

    api.call("test.role", { access_token: "admin_token" }, args_to_message([]), function(err, result){
        eq(err, null);
        eq(result, args_to_message(["admin", ["user", "admin"]], null));
        done();
    });
});

test("no_method", function(done){

    var api = test_api_manager();

    api.call("test.no_method", null, args_to_message([1, 2, 3]), function(err, result){
        eq(_.code(err), "unknown_method");
        eq(result, args_to_message([], _.omit(api.errors().unknown_method(), "stack", "type")));
        done();
    });
});

test("method throws", function(done){

    var api = test_api_manager();

    api.call("test.method_error", null, args_to_message([1, 2, 3]), function(err, result){
        eq(_.code(err), "test_throw");
        eq(result, args_to_message([], _.omit(api.errors().error(), "stack", "type")));
        done();
    });
});

test("method throws", function(done){

    var api = test_api_manager();

    api.call("test.method_error", null, args_to_message([1, 2, 3]), function(err, result){
        eq(_.code(err), "test_throw");
        done();
    });
});


test("expects good", function(done){

    var api = test_api_manager();

    api.api("test").method("public", "echo").expects('number', 'number');

    api.call("test.echo", null, args_to_message([1, 2]), function(err, one, two){
        done();
    });

});

test("expects better", function(done){

    var api = test_api_manager();

    api.api("test").method("public", "echo").expects('number', ['number', 'string']);

    api.call("test.echo", null, args_to_message([1, ""]), function(err, one, two){
        ok(!err);
        done();
    });
});


test("expects bad", function(done){

    var api = test_api_manager();

    api.api("test").method("public", "echo").expects('number', 'number');

    api.call("test.echo", null, args_to_message([1, ""]), function(err, one, two){
        ok(err);
        eq(_.code(err), "invalid_arguments");
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

    api.call("test.echo", null, args_to_message([1, 1]), function(err, one, two){
        ok(!err);
        done();
    });

});

test("expector bad", function(done){

    var api = test_api_special_expector();

    api.call("test.echo", null, args_to_message(['special', 1]), function(err, one, two){
        eq(_.code(err), "invalid_arguments");
        done();
    });

});

test("expector bad now good", function(done){

    var api = test_api_special_expector();

    api.expectation_validator(function(next, arg, expectations, is_valid){
        if(_.contains(expectations, 'special') && arg === 'special'){
            is_valid(true);
        }
        next();
    });

    api.call("test.echo", null, args_to_message(['special', 2]), function(err, one, two){
        eq(err, null);
        done();
    });

});

test("expector test error", function(done){

    var api = test_api_special_expector();

    api.expectation_validator(function(next, arg, expectations, callback){
        next(_.error("test_error", "test error."));
    });

    api.call("test.echo", null, args_to_message(['bad_parameter', 2]), function(err, one, two){
        eq(_.code(err), "test_error");
        done();
    });
});

test("bad role", function(done){

    var api = new test_api_manager("admin");

    api.call("test.echo", { role: "user" }, args_to_message([1, 2, 3]), function(err, result){
        eq(_.code(err), "permission_error");
        done();
    });

});


test("good roles", function(done){

    var api = new test_api_manager("admin");

    api.call("test.echo", { roles: ["admin"] }, args_to_message([1, 2, 3]), function(err, result){
        eq(err, null);
        done();
    });
});

test("good roles", function(done){

    var api = new test_api_manager("admin");

    api.call("test.echo", { roles: ["user", "admin"] }, args_to_message([1, 2, 3]), function(err, result){
        eq(err, null);
        done();
    });
});

test("local bad", function(done){

    var api = new test_api_manager("server");

    api.call("test.echo", { roles: ["server"] }, args_to_message([1, 2, 3]), function(err, result){
        eq(_.code(err), "unknown_method");
        done();
    });
});

test("local good", function(done){

    var api = new test_api_manager("server");

    api.call("test.echo", { local: true, roles: ["server"] }, args_to_message([1, 2, 3]), function(err, result){
        eq(err, null);
        eq(result, args_to_message([1, 2, 3], null));
        done();
    });
});

test("local bad", function(done){

    var api = new test_api_manager("server");

    api.call("test.echo", { local: true, roles: ["admin"] }, args_to_message([1, 2, 3]), function(err, result){
        eq(_.code(err), "permission_error");
        done();
    });
});

test("overload upper", function(done){

    var api = new test_api_manager("public");

    api.api("test").admin("echo", function(callback){
        callback(null, "admin");
    });

    api.call("test.echo", { local: true, roles: ["admin"] }, args_to_message([1, 2, 3]), function(err, result){
        eq(err, null);
        eq(result, args_to_message(["admin"], null));
        done();
    });
});

test("overload lower", function(done){

    var api = new test_api_manager("public");

    api.api("test").admin("echo", function(callback){
        callback(null, "admin");
    });

    api.call("test.echo", { local: true, roles: ["user"] }, args_to_message([1, 2, 3]), function(err, result){
        eq(err, null);
        eq(result, args_to_message([1, 2, 3], null));
        done();
    });
});

test("local overload upper", function(done){

    var api = new test_api_manager("server");

    api.api("test").admin("echo", function(callback){
        callback(null, "admin");
    });

    api.call("test.echo", { local: true, roles: ["server"] }, args_to_message([1, 2, 3]), function(err, result){
        eq(err, null);
        eq(result, args_to_message([1, 2, 3], null));
        done();
    });
});

test("named parameters", function(done){

    var api = new test_api_manager("server");

    api.api("test").public("params", function(callback, first, second){
        callback(null, first, second);
    }).params('first', 'second');

    api.call("test.params", null, { first: 'first_test', second: 'second_test' }, function(err, result){
        eq(err, null);
        eq(result, args_to_message(['first_test', 'second_test'], null));
        done();
    });

});

test("whitelisted", function(){

    var api = test_api_manager();

    var good = _.error("good", "ok error.");
    var bad = _.error("bad", "ok error.");
    
    
    // this one is added to the api on instantiation
    var api_err = _.error("ApiWhitelisted", "blah");
    ok(!api.whitelisted(api_err));
    ok(api.whitelisted(_.error("ManagerWhitelisted", "blah")));
    ok(!api.whitelisted(bad));
    ok(!api.whitelisted(good));
    api.whitelist(good);
    ok(api.whitelisted(good));
    ok(!api.whitelisted(bad));

});
