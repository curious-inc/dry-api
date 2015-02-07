"use strict";

var _ = require('dry-underscore');

var method = require('./method.js');

var eq = _.test.eq;
var ok = _.test.ok;

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

    return(m);
}

test("call", function(done){

    var m = echo_method(function(){ eq(this, null); });

    m.apply_array(null, ["a", "b", "c"], function(err, a, b, c){
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

    m.whitelist("ThrownError");
    
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


