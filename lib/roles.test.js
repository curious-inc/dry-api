"use strict";

var _ = require('dry-underscore');

var ok = _.test.ok;
var eq = _.test.eq;

var roles = require('./roles.js');

suite('roles');

test("simple", function(){

    var input_roles = { 
        role: 100,
        blah: { role : 'admin', priority: 200, serve : false, anon : true },
    };

    var expected_roles = { 
        role: { role : 'role', priority: 100, serve : true, anon : false },
        blah: { role : 'blah', priority: 200, serve : false, anon : true },
    };


    var expected_array = [
        { role : 'role', priority: 100, serve : true, anon : false }, 
        { role : 'blah', priority: 200, serve : false, anon : true },
    ];
 
    var r = new roles(input_roles);

    _.test.eq(r.hash(), expected_roles);
    _.test.eq(r.array(), expected_array);
});

test("complex", function(){

    var input_roles = {
        ten_no_serve : { priority: 10, serve: false },
        twenty_anon : { priority: 20, anon: true },
        thirty : 30,
        forty : 40
    };

    var expected_roles = { 
        thirty: { role : 'thirty', priority: 30, serve : true, anon : false }, 
        ten_no_serve: { role : 'ten_no_serve', priority: 10, serve : false, anon : false }, 
        twenty_anon: { role : 'twenty_anon', priority: 20, serve : true, anon : true }, 
        forty: { role : 'forty', priority: 40, serve : true, anon : false }, 
    };

    var expected_array = [
        { role : 'ten_no_serve', priority: 10, serve : false, anon : false }, 
        { role : 'twenty_anon', priority: 20, serve : true, anon : true }, 
        { role : 'thirty', priority: 30, serve : true, anon : false }, 
        { role : 'forty', priority: 40, serve : true, anon : false }, 
    ];

    var expected_names = ["ten_no_serve", "twenty_anon", "thirty", "forty"];
 
    var r = new roles(input_roles);

    _.test.eq(r.hash(), expected_roles);
    _.test.eq(r.array(), expected_array);
    _.test.eq(r.names(), expected_names);
});

