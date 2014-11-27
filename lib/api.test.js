"use strict";

var _ = require('dry-underscore');

var api_class = require('./api.js');

var eq = _.test.eq;
var ok = _.test.ok;

suite('api');

/*
api.public("echo", function(){

    var args = _.a(arguments);
    var callback = args.pop();
    args.unshift("echo");
    args.unshift(null);
    // args = [null, "echo", arg1, arg2, arg3];
    cb.apply(null, args);

}, ['string', 'string']);

*/

function test_api(role, f){

    role = role || "public";

    var api = new api_class("test_api");

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

    return(api);
};

test("simple method", function(done){

    var api = test_api();

    api.call("echo", null, [1, 2, 3], function(err, one, two, three){
        ok(!err);
        eq(one, 1);
        eq(two, 2);
        eq(three, 3);
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


test("type expector", function(){

    var api = test_api();

    function test(val, expect_array, is_valid){
        api.type_expector(val, expect_array, function(err, valid){
            ok(!err); eq(is_valid, valid);
        });
    }

    test("foo", ["string"], true);

    test(3, ["number"], true);
    test(3, ["string", "number"], true); 

    test(3, ["string"], false);

    test(3, ["*"], true);

    test("foo", ["*"], true); 
    test(null, ["*"], true); 

    test("null", [null], false); 

    test(null, [null], true); 
    test(null, ["null"], true); 

});


test("expects good", function(done){

    var api = test_api();

    api.method("public", "echo").expects('number', 'number');

    api.call("echo", null, [1, 2], function(err, one, two){
        done();
    });

});

test("expects better", function(done){

    var api = test_api();

    api.method("public", "echo").expects('number', ['number', 'string']);

    api.call("echo", null, [1, ""], function(err, one, two){
        ok(!err);
        done();
    });
});


test("expects bad", function(done){

    var api = test_api();

    api.method("public", "echo").expects('number', 'number');

    api.call("echo", null, [1, ""], function(err, one, two){
        ok(err);
        eq(_.code(err), "bad_parameter");
        done();
    });
});

function test_api_special_expector(){
    var api = test_api();

    api.method("public", "echo").expects(['number', 'special'], 'number');

    return(api);
}

test("expector good", function(done){

    var api = test_api_special_expector();

    api.call("echo", null, [1, 1], function(err, one, two){
        ok(!err);
        done();
    });

});

test("expector bad", function(done){

    var api = test_api_special_expector();

    api.call("echo", null, ['special', 1], function(err, one, two){
        ok(_.code(err, "bad_parameter"));
        done();
    });

});

test("expector bad now good", function(done){

    var api = test_api_special_expector();

    api.expector(function(val, expected, callback){
        callback(null, _.contains(expected, 'special') && val === 'special');
    });

    api.call("echo", null, ['special', 2], function(err, one, two){
        ok(!err);
        done();
    });

});

test("expector test error", function(done){

    var api = test_api_special_expector();

    api.expector(function(val, expected, callback){
        callback(_.error("test_error", "test error."));
    });

    api.call("echo", null, ['bad_parameter', 2], function(err, one, two){
        eq(_.code(err), "test_error");
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


test("good role", function(done){

    var api = new test_api("admin");

    api.call("echo", { role: "admin" }, [1, 2, 3], function(err, one, two, three){
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

/*
test("named parameters", function(done){

    var api = new test_api("server");

    api.public("params", function(first, second, callback){
        callback(null, first, second);
    }).params('first', 'second');

    api.call_with_hash("params", null, { first: 'first_test', second: 'second_test' }, function(err, first, second){
        ok(!err);
        eq(first, 'first_test');
        eq(second, 'second_test');
        done();
    });

});

/*
test("named parameters", function(done){

    var api = new test_api("server");

    api.public("params", function(first, second, callback){
        callback(null, first, second);
    }).params('first', 'second');

    api.call_with_hash("params", null, { first: 'first_test', second: 'second_test' }, function(err, first, second){
        ok(!err);
        eq(first, 'first_test');
        eq(second, 'second_test');
        done();
    });
});
*/





