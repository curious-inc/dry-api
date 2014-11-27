"use strict";

var _ = require('dry-underscore');

var method = require('./method.js');

var eq = _.test.eq;
var ok = _.test.ok;

suite('method');

test('getters/setters', function(){

    function f(){};
    var m = new method("public", "get_user", f);

    eq(m.method(), f);
    eq(m.expects(), []);
    eq(m.parameters(), null);
    eq(m.params(), null);
    eq(m.params(), null);
    eq(m.callback(), null);
    eq(m.role(), "public");

    m.expects(['string', 'number'], 'function');
    m.params('a', 'cb'). callback('a');

    eq(m.method(), f);
    eq(m.expects(), [['string', 'number'], 'function']);
    eq(m.parameters(), ['a', 'cb']);
    eq(m.params(), ['a', 'cb']);
    eq(m.callback(), ['a']);
    eq(m.role(), "public");

});

test("call", function(done){

    var m = new method("public", "get_user", function(cb, a){ 
        ok(this === null);
        cb(null, a);
    });

    m.call(null, "a", function(err, a){
        eq(a, "a");
        done();
    });
});

test("apply", function(done){

    var m = new method("public", "get_user", function(cb, a){
        eq(this.foo, "foo");
        cb(null, a); 
    })

    m.apply({ foo: "foo" }, ["a"], function(err, a){
        eq(a, "a");
        done();
    });
});

test("no method", function(done){

    var m = new method();

    m.apply({ foo: "foo" }, ["a"], function(err){
        eq(_.code(err), "no_method");
        eq(arguments.length, 1);
        done();
    });
});


test("hash_to_args no params", function(done){

    var m = new method("public", "get_user", _.noop);

    m.hash_to_args({ third: '3', first: '1', second: '2' }, function(err, args){
        eq(_.code(err), "no_support");
        done();
    });
});

test("hash_to_args fallback", function(done){

    var m = new method("public", "get_user", _.noop);

    m.hash_to_args({ third: '3', first: '1', second: '2', map_params: ['third', 'first', 'second'] }, function(err, args){
        eq(args, ['3', '1', '2']);
        done();
    }, true);

});


test("hash_to_args good", function(done){

    var m = new method("public", "get_user", _.noop);
    m.params('first', 'second', 'third');

    m.hash_to_args({ third: 3, first: '1', not_an_arg: 'invalid' }, function(err, args){
        eq(args, ['1', undefined, 3]);
        done();
    });
});

test("apply_hash", function(done){

    var m = new method("public", "get_user", function(cb, first, second, third){
        eq(first, '1');
        eq(second, undefined);
        eq(third, 3);
        cb(null, first, second, third);
    }).params('first', 'second', 'third');

    m.apply(null, { third: 3, first: '1', not_an_arg: 'invalid' }, function(err, first, second, third){
        eq(first, '1');
        eq(second, undefined);
        eq(third, 3);
        done();
    }, true);

});

test("apply_hash fallback", function(done){

    var m = new method("public", "get_user", function(cb, first, second, third){
        eq(first, '1');
        eq(second, undefined);
        eq(third, 3);
        cb(null, first, second, third);
    });

    m.apply(null, { one: '1', three: 3, invalid: 'invalid', map_params: ['one', '', 'three'] }, function(err, first, second, third){
        eq(first, '1');
        eq(second, undefined);
        eq(third, 3);
        done();
    }, true);

});

test("apply_hash params override", function(done){

    var m = new method("public", "get_user", function(cb, first, second, third){
        eq(first, '1');
        eq(second, undefined);
        eq(third, 3);
        cb(null, first, second, third);
    });

    // uses params
    m.apply(null, { one: 'unused', three: 'unused', invalid: 'invalid', params:['1', undefined, 3], map_params: ['one', 'three'] }, function(err, first, second, third){
        eq(first, '1');
        eq(second, undefined);
        eq(third, 3);
        done();
    }, true);

});



test("paramters reserved word", function(){

    var m = new method("public", "get_user", _.noop);

    function test_word(word){
        var threw = false;
        try{
            m.params('first', word, 'third');
        }catch(e){
            threw = true
            eq(_.code(e), "Fatal");
        }

        ok(threw);
    }

    test_word("method");
    test_word("params");
    test_word("map_params");
    
});

