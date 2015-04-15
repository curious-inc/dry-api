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

    var api = new api_class(null, "test_api");
    api.context_prepper(test_access_manager().context_prepper());

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

    api[role]("wrap_error", function(callback){
        throw(new Error("wrap_error message"));
    });

    api['public']("public_role", function(callback){
        callback(null, "public", this.roles);
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

    api.context_prepper(function(next, context){
        context.test_context = "test_context";
        next();
    });


    api.call("echo", null, args_to_message([1, 2, 3]), function(err, result){
        eq(null, err);
        eq(result, args_to_message([1, 2, 3], null));
        ok(extra_called);
        done();
    });
});

test("context changes roles error", function(done){

    var api = test_api();

    api.context_prepper(function(next, context){
        next();
    });

    api.call("role", null, args_to_message([]), function(err, result){
        eq(_.code(err), "permission_error");
        eq(result, args_to_message([], _.omit(api.errors().permission_error(), "stack", "type")));
        done();
    });
});

test("context changes roles user", function(done){

    var api = test_api();

    api.context_prepper(function(next, context){
        context.roles.push("user");
        next();
    });

    api.call("role", null, args_to_message([]), function(err, result){
        eq(err, null);
        eq(result, args_to_message(["user", ["user"]], null));
        done();
    });
});

test("context changes roles admin", function(done){

    var api = test_api();

    api.context_prepper(function(next, context){
        context.roles.push("admin");
        next();
    });

    api.call("role", null, args_to_message([]), function(err, result){
        eq(err, null);
        eq(result, args_to_message(["admin", ["admin"]], null));
        done();
    });
});

test("bad access_token", function(done){

    var api = test_api();

    api.call("public_role", null, { tags: { access_token: "bad_token" }, params: [] }, function(err, result){
        eq(err, null);
        eq(result, args_to_message(["public", []], null));
        done();
    });
});

test("user access_token", function(done){

    var api = test_api();

    api.call("role", null, { tags: { access_token: "user_token" }, params: [] }, function(err, result){
        eq(err, null);
        eq(result, args_to_message(["user", ["user"]], null));
        done();
    });
});

test("admin access_token", function(done){

    var api = test_api();

    api.call("role", null, { tags: { access_token: "admin_token" }, params: [] }, function(err, result){
        eq(err, null);
        eq(result, args_to_message(["admin", ["user", "admin"]], null));
        done();
    });
});

test("no_method", function(done){

    var api = test_api();

    api.call("no_method", null, args_to_message([1, 2, 3]), function(err, result){
        eq(_.code(err), "unknown_method");
        eq(result, args_to_message([], _.omit(api.errors().unknown_method(), "stack", "type")));
        done();
    });
});

test("method throws", function(done){

    var api = test_api();

    api.call("method_error", null, args_to_message([1, 2, 3]), function(err, result){
        eq(_.code(err), "test_throw");
        eq(err.thrown, true);
        eq(result, args_to_message([], _.omit(api.errors().error(), "stack", "type")));
        done();
    });
});

test("wrap method throws", function(done){

    var api = test_api();

    api.call("wrap_error", null, args_to_message([1, 2, 3]), function(err, result){
        eq(_.code(err), "method_error");
        eq(err.thrown, true);
        eq(err.message, "wrap_error message");
        eq(result, args_to_message([], _.omit(api.errors().error(), "stack", "type")));
        done();
    });
});

test("bad role", function(done){

    var api = new test_api("admin");

    api.call("echo", { role: "user" }, args_to_message([1, 2, 3]), function(err, result){
        eq(_.code(err), "permission_error");
        eq(result, args_to_message([], _.omit(api.errors().permission_error(), "stack", "type")));
        done();
    });
});


test("good single role", function(done){

    var api = new test_api("admin");

    api.call("echo", { roles: ["admin"] }, args_to_message([1, 2, 3]), function(err, result){
        ok(!err);
        eq(result, args_to_message([1, 2, 3], null));
        done();
    });
});

test("good multiple roles", function(done){

    var api = new test_api("admin");

    api.call("echo", { roles: ["user", "admin"] }, args_to_message([1, 2, 3]), function(err, result){
        ok(!err);
        eq(result, args_to_message([1, 2, 3], null));
        done();
    });
});

test("local bad no local", function(done){

    var api = new test_api("server");

    api.call("echo", { roles: ["server"] }, args_to_message([1, 2, 3]), function(err, result){
        eq(_.code(err), "unknown_method");
        eq(result, args_to_message([], _.omit(api.errors().unknown_method(), "stack", "type")));
        done();
    });
});

test("local good", function(done){

    var api = new test_api("server");

    api.call("echo", { local: true, roles: ["server"] }, args_to_message([1, 2, 3]), function(err, result){
        ok(!err);
        eq(result, args_to_message([1, 2, 3], null));
        done();
    });
});

test("local bad role", function(done){

    var api = new test_api("server");

    api.call("echo", { local: true, roles: ["admin"] }, args_to_message([1, 2, 3]), function(err, result){
        eq(_.code(err), "permission_error");
        eq(result, args_to_message([], _.omit(api.errors().permission_error(), "stack", "type")));
        done();
    });
});

test("overload upper", function(done){

    var api = new test_api("public");

    api.admin("echo", function(callback){
        callback(null, "admin");
    });

    api.call("echo", { local: true, roles: ["admin"] }, args_to_message([1, 2, 3]), function(err, result){
        eq(err, null);
        eq(result, args_to_message(["admin"], null));
        done();
    });
});

test("overload lower", function(done){

    var api = new test_api("public");

    api.admin("echo", function(callback){
        callback(null, "admin");
    });

    api.call("echo", { local: true, roles: ["user"] }, args_to_message([1, 2, 3]), function(err, result){
        eq(err, null);
        eq(result, args_to_message([1, 2, 3], null));
        done();
    });
});

test("local overload upper", function(done){

    var api = new test_api("server");

    api.admin("echo", function(callback){
        callback(null, "admin");
    });

    api.call("echo", { local: true, roles: ["server"] }, args_to_message([1, 2, 3]), function(err, result){
        eq(err, null);
        eq(result, args_to_message([1, 2, 3], null));
        done();
    });
});

test("named parameters", function(done){

    var api = new test_api("server");

    api.public("params", function(callback, first, second){
        callback(null, first, second);
    }).params('first', 'second');

    api.call("params", null, { first: 'first_test', second: 'second_test' }, function(err, result){
        ok(!err);
        eq(result, args_to_message(['first_test', 'second_test'], null));
        done();
    });

});

test("named callback", function(done){

    var api = new test_api("server");

    api.public("params", function(callback, first, second){
        callback(null, first, second);
    }).params('first', 'second').callback('first_back', 'second_back');

    api.call("params", null, { first: 'first_test', second: 'second_test' }, function(err, result){
        ok(!err);
        eq(result, { error: null, first_back: 'first_test', second_back: 'second_test', params:["error", "first_back", "second_back"] });
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

function validation_error(message){ return({ code: "invalid_arguments", message: message }); }

test("validate_arguments object", function(done){
    var api = test_api();

    var error_message = "my validation message.";

    api.arguments_validator(function(next, method, args){
        eq(args, [1, 2, 3]);
        next(_.error("some_code", error_message));
    });

    var message_in = args_to_message([1, 2, 3]);

    var expected = args_to_message([], validation_error(error_message));

    api.call("echo", null, message_in, function(err, result){
        eq(_.code(err), "some_code");
        eq(err.message, error_message);
        eq(result, expected);
        done();
    });
});

