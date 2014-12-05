"use strict";

var _ = require('dry-underscore');

var manager_class = require('./api_manager.js');
var access_manager_class = require('./access_manager.js');

var eq = _.test.eq;
var ok = _.test.ok;

suite('api_manager');

function test_manager(role, f){

    role = role || "public";

    var access_manager = new access_manager_class(access_manager_class.in_memory_store());
    var manager = new manager_class(null, access_manager);

    var api = manager.api("test", true);

    api.testing = true;

    api[role]("echo", function(callback, a, b){
        if(f){ f.apply(this, arguments); }
        callback(null, a, b);
    });

    return(manager);
};

test("malformed_call", function(done){
    var manager = test_manager();
    manager.call("unknown", null, [1, 2], function(err, one, two){
        eq(_.code(err), "malformed_call");
        done();
    });
});


test("unknown_api", function(done){
    var manager = test_manager();
    manager.call("unknown.echo", null, [1, 2], function(err, one, two){
        eq(_.code(err), "unknown_api");
        done();
    });
});


test("array call", function(done){

    var manager = test_manager();

    manager.call("test.echo", null, [1, 2], function(err, one, two){
        ok(!err);
        eq(one, 1);
        eq(two, 2);
        done();
    });

});

test("hash method", function(done){

    var manager = test_manager();

    manager.call("test.echo", null, { params: [1, 2] }, function(err, one, two){
        ok(!err);
        eq(one, 1);
        eq(two, 2);
        done();
    });
});

test("simple context", function(done){

    var extra_called = false;
    var api = test_manager("public", function(){
        extra_called = true;
        ok(!this.local);
        eq(this.test_context, "test_context");
    });

    api.context(function(next, context){
        context.test_context = "test_context";
        next();
    });

    api.call("test.echo", null, [1, 2, 3], function(err, one, two){
        ok(!err);
        eq(one, 1);
        eq(two, 2);
        ok(extra_called);
        done();
    });
});

function test_api_special_expector(){
    var manager = test_manager();

    manager.api("test").method("public", "echo").expects(['number', 'special'], 'number');

    return(manager);
}

test("expector good", function(done){

    var api = test_api_special_expector();

    api.call("test.echo", null, [1, 1], function(err, one, two){
        if(err){ throw(err); }
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
        if(err){ throw(err); }
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


