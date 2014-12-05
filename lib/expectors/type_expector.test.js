var _ = require('dry-underscore');

var type_expector_class = require('./type_expector.js');

var eq = _.test.eq;
var ok = _.test.ok;

suite('type_expector');

test("type expector", function(){

    var te = new type_expector_class();

    function test(val, expect_array, is_valid){
        te.match(val, expect_array, function(err, valid){
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


