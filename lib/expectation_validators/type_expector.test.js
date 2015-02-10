var _ = require('dry-underscore');

var type_expector = require('./type_expector.js');

var eq = _.test.eq;
var ok = _.test.ok;

suite('type_expector');

test("type expector", function(){

    var te = type_expector;

    function test(arg, expectations, expected_valid){
        var called_next = false;
        var set_valid = false;

        var next = function(err){ ok(!err); called_next = true; };
        var is_valid_callback = function(flag){ if(_.undef(flag)){ flag = true; } set_valid = flag; };

        te(next, arg, expectations, is_valid_callback);
        eq(expected_valid, set_valid);
        ok(called_next);
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


