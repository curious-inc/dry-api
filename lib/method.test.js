"use strict";

var _ = require('dry-underscore');

var method = require('./method.js');

var eq = _.test.eq;
var ok = _.test.ok;

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


suite('method');

test('getters/setters', function(){

    function f(){};
    var m = new method(null, "public", "get_user", f);

    eq(m.method(), f);
    eq(m.expects(), []);
    eq(m.incoming_parameters(), null);
    eq(m.params(), null);
    eq(m.callback(), null);
    eq(m.outgoing_parameters(), null);
    eq(m.role(), "public");

    m.expects(['string', 'number'], 'function');
    m.params('a', 'cb'). callback('a');

    eq(m.method(), f);
    eq(m.expects(), [['string', 'number'], 'function']);
    eq(m.params(), ['a', 'cb']);
    eq(m.incoming_parameters(), ['a', 'cb']);
    eq(m.callback(), ['a']);
    eq(m.outgoing_parameters(), ['a']);
    eq(m.role(), "public");

});

function error_method(err, f){
    var m = new method(null, "public", "error", function(cb, a){ 
        if(f){ f.apply(this); }
        cb.apply(null, [err, "should be truncated", "should be truncated"]);
    });

    return(m);
}

function echo_method(f){
    var m = new method(null, "public", "echo", function(cb, a){ 
        if(f){ f.apply(this); }
        var args = _.a(arguments);
        args.shift();
        args.unshift(null);
        cb.apply(null, args);
    });

    m.testing = true;

    return(m);
}

test("_apply_arguments", function(done){

    var m = echo_method(function(){ eq(this, null); });

    m._apply_arguments(null, ["a", "b", "c"], function(err, a, b, c){
        eq(err, null);
        eq(a, "a");
        eq(b, "b");
        eq(c, "c");
        done();
    });
});

test("apply", function(done){

    var m = echo_method(function(){ 
        eq(this.foo, "foo");
    });

    var message_in = {
        id: 10, 
        params: ["0", 1, "2"], 
        "0": "a",
        "1": "b",
        "2": "c" 
    };

    var expected = {
        id: 10, 
        params: ["error", "1", "2", "3"], 
        error: null,
        "1": "a",
        "2": "b",
        "3": "c" 
    }

    m.apply({ foo: "foo" }, message_in, function(err, result){
        eq(null, err);
        eq(result, expected);
        done();
    });
});

test("no method", function(done){

    _.test.throws(function(){
        var m = new method();
    });

    done();
});

function client_error_reply(err, extra){
    err = err || { code: "error", message: "error." };
    extra = extra || {};
    return(_.extend({
        params: ["error"],
        error: { code: err.code, message: err.message }
    }, extra));

};

test("no params, no support", function(done){

    var m = echo_method();

    var expected = client_error_reply();

    m.apply(null, { third: '3', first: '1', second: '2' }, function(err, result){
        eq(_.code(err), "no_support");
        eq(result, expected);
        done();
    });
});

test("malformed_call params", function(done){

    var m = echo_method();

    var expected = client_error_reply();

    m.apply(null, { params: "string" }, function(err, result){
        eq(_.code(err), "malformed_call");
        eq(result, expected);
        done();
    });
});

test("use request params", function(done){

    var m = echo_method();

    var expected = {
        params: ["error", "1", "2", "3"],
        error: null,
        "1": "3",
        "2": "1",
        "3": "2"
    };

    m.apply(null, { third: '3', first: '1', second: '2', params: ['third', 'first', 'second'] }, function(err, result){
        eq(err, null);
        eq(result, expected);
        done();
    });
});

test("use named params", function(done){

    var m = echo_method();
    m.params('first', 'second', 'third');

    var expected = {
        params: ["error", "1", "2", "3"],
        error: null,
        "1": "1",
        "2": undefined,
        "3": 3
    };

    m.apply(null, { third: 3, first: '1', not_an_arg: 'invalid' }, function(err, result){
        eq(err, null);
        eq(result, expected);
        done();
    });
});

test("override named params", function(done){

    var m = echo_method();
    m.params('first', 'second', 'third');

    var expected = {
        params: ["error", "1", "2", "3"],
        error: null,
        "1": 3,
        "2": undefined,
        "3": "1"
    };

    m.apply(null, { third: 3, first: '1', not_an_arg: 'invalid', params: ["third", "second", "first"] }, function(err, result){
        eq(err, null);
        eq(result, expected);
        done();
    });
});


test("use request params, with undefined and unused", function(done){

    var m = echo_method();

    var expected = {
        params: ["error", "1", "2", "3"],
        error: null,
        "1": "1",
        "2": undefined,
        "3": 3
    };

    m.apply(null, { one: '1', three: 3, invalid: 'invalid', params: ['one', '', 'three'] }, function(err, result){
        eq(err, null);
        eq(result, expected);
        done();
    });

});

test("test invalid reserved words in incoming and outgoing params", function(){

    var m = echo_method();

    function test_word(word){
        _.test.throws(function(){
            m.params('first', word, 'third');
        });

        _.test.throws(function(){
            m.callback('first', word, 'third');
        });
    }

    test_word("id");
    test_word("method");
    test_word("params");
    test_word("error");
    test_word("access_token");
});

test("results to error hash ", function(){

    var m = error_method({ code: "TestError", message: "this is a test error." }).callback('one', 'two');
    
    var expected = client_error_reply(null, { id: 15 });

    m.apply(null, { id: 15, "1": "one", params: ["1"] }, function(err, result){
        eq(_.code(err), "TestError");
        eq(result, expected);
    });
});

test("throws", function(){

    var m = echo_method(function(){
        throw _.error("ThrownError", "this was thrown.");
    });

    m.testing = false;
    
    var expected = client_error_reply(null, { id: 15 });

    m.apply(null, { id: 15, "1": "one", params: ["1"] }, function(err, result){
        eq(_.code(err), "ThrownError");
        eq(result, expected);
    });
});

test("thrown whitelist", function(){

    var m = echo_method(function(){
        throw _.error("ThrownError", "this was thrown.");
    });

    m.testing = false;

    m.whitelist("ThrownError");
    
    var expected = client_error_reply({ code: "ThrownError", message: "this was thrown." }, { id: 15 });

    m.apply(null, { id: 15, "1": "one", params: ["1"] }, function(err, result){
        eq(_.code(err), "ThrownError");
        eq(result, expected);
    });
});

test("parent whitelist", function(){

    var m = echo_method(function(){
        throw _.error("ThrownError", "this was thrown.");
    });

    m.testing = false;

    m._api = {
        whitelisted: function(e){
            return(e.code === "ThrownError")
        }
    };

    var expected = client_error_reply({ code: "ThrownError", message: "this was thrown." }, { id: 15 });

    m.apply(null, { id: 15, "1": "one", params: ["1"] }, function(err, result){
        eq(_.code(err), "ThrownError");
        eq(result, expected);
    });
});

test("results to hash with hash", function(){

    var m = echo_method().callback('one', 'two');
    
    var message_in = {
        id: 10, 
        params: ["0", "1", "2", "3"], 
        "0": "1",
        "1": "2",
        "2": "3",
        "3": "4" 
    };

    var expected = {
        id: 10,
        params: ["error", "one", "two"],
        error: null,
        "one": "1",
        "two": "2",
    };

    m.apply(null, message_in, function(err, result){
        eq(err, null);
        eq(result, expected);
    });
});


test("prepare_arguments error", function(done){

    var m = echo_method();

    m.arguments_prepper(function(next, args){
        args.unshift("modified");
        next(_.error("args_error", "error preparing arguments."));
    });


    m.apply(null, { params:[] }, function(err, result){
        eq(_.code(err), "args_error");
        eq(client_error_reply(), result);
        done();
    });
});

test("prepare_arguments", function(done){

    var m = echo_method();

    m.arguments_prepper(function(next, args){
        args.unshift("modified");
        args[1] = 3;
        next();
    });

    var message_in = args_to_message([1, 2, 3]);

    var expected = args_to_message(["modified", 3, 2, 3], null);

    m.apply(null, message_in, function(err, result){
        eq(err, null);
        eq(result, expected);
        done();
    });
});

function validation_error(message){ return({ code: "invalid_arguments", message: message }); }

test("validate_arguments string", function(done){
    var m = echo_method();

    var error_message = "my validation message.";

    m.arguments_validator(function(next, method, args){
        eq(args, [1, 2, 3]);
        next(error_message);
    });

    var message_in = args_to_message([1, 2, 3]);

    var expected = args_to_message([], validation_error(error_message));

    m.apply(null, message_in, function(err, result){
        eq(_.code(err), _.code(validation_error(error_message)));
        eq(err.message, error_message);
        eq(result, expected);
        done();
    });
});

test("validate_arguments object", function(done){
    var m = echo_method();

    var error_message = "my validation message.";

    m.arguments_validator(function(next, method, args){
        eq(args, [1, 2, 3]);
        next(_.error("some_code", error_message));
    });

    var message_in = args_to_message([1, 2, 3]);

    var expected = args_to_message([], validation_error(error_message));

    m.apply(null, message_in, function(err, result){
        eq(_.code(err), "some_code");
        eq(err.message, error_message);
        eq(result, expected);
        done();
    });
});

test("expects good", function(done){

    var m = echo_method();

    m.expects('number', 'number');

    m.apply(null, args_to_message([1, 2]), function(err, result){
        eq(err, null);
        eq(result, args_to_message([1, 2], null));
        done();
    });

});

test("expects better", function(done){

    var m = echo_method();

    m.expects('number', ['number', 'string']);

    m.apply(null, args_to_message([1, ""]), function(err, result){
        eq(err, null);
        args_to_message(result, args_to_message([1, ""], null));
        done();
    });
});

test("expects bad", function(done){

    var m = echo_method();

    m.expects('number', 'number');

    m.apply(null, args_to_message([1, ""]), function(err, result){
        ok(err);
        eq(result, args_to_message([], { code: "invalid_arguments", message: 'parameter[1]: value("") did not meet expectations: number' }));
        eq(_.code(err), "invalid_arguments");
        done();
    });
});

function test_method_special_expector(){
    var m = echo_method();

    m.expects(['number', 'special'], 'number');

    return(m);
}

test("expector good", function(done){

    var m = test_method_special_expector();

    m.apply(null, args_to_message([1, 1]), function(err, result){
        ok(!err);
        eq(result, args_to_message([1, 1], null));
        done();
    });
});

test("expector bad", function(done){

    var m = test_method_special_expector();

    m.apply(null, args_to_message(['special', 1]), function(err, result){
        eq(_.code(err), "invalid_arguments");
        done();
    });
});

test("expector bad now good", function(done){

    var m = test_method_special_expector();

    m.expectation_validator(function(next, arg, expectations, is_valid){
        if(_.contains(expectations, 'special') && arg === 'special'){
            is_valid(true);
        }
        next();
    });

    m.apply(null, args_to_message(['special', 2]), function(err, result){
        eq(err, null);
        eq(result, args_to_message(["special", 2], null));
        done();
    });
});

test("expector test error", function(done){

    var m = test_method_special_expector();

    m.expectation_validator(function(next, arg, expectations, is_valid){
        next(_.error("test_error", "test error."));
    });

    m.apply(null, args_to_message(['bad_parameter', 2]), function(err, result){
        eq(_.code(err), "test_error");
        eq(result, args_to_message([], { code: "error", message: "error." }));
        done();
    });
});



