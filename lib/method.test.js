"use strict";

var _ = require('dry-underscore');

var method = require('./method.js');

var eq = _.test.eq;
var ok = _.test.ok;

suite('method');

test("explicit define", function(){

    var m = new method("public", "get_user", function(a, cb){ 
        ok(this === null);
        cb(a);
    });
    m.expects(['string', 'number'], 'function');

    var called = false;
    m.call(null, "a", function(a){
        eq(a, "a");
        called = true;
    });

    ok(called);
    eq(m.expects(), [['string', 'number'], 'function']);
    eq(m.role(), "public");

});

test("constructor define", function(){

    var m = new method("public", "get_user", function(a, cb){
        eq(this.foo, "foo");
        cb(a); 
    }).expects(['string', 'number'], 'function');

    var called = false;
    m.apply({ foo: "foo" }, ["a", function(a){
        eq(a, "a");
        called = true;
    }]);

    ok(called);
    eq(m.expects(), [['string', 'number'], 'function']);
    eq(m.role(), "public");

});




