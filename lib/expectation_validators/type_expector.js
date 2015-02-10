
var _ = require('dry-underscore');

var types = {
    'string' : _.isString,
    'number' : _.isNumber,
    'null' : _.isNull,
    'object' : _.isObject,
    'array' : _.isArray,
    '*' : function(){ return(true); }
};


function expectation_validator(next, arg, expectations, set_valid_flag){
    var self = this;
    var is_valid = false;

    _.beach(expectations, function(type){
        if(types[type]){
            is_valid = types[type](arg);
        }else if(_.isNull(type) && _.isNull(arg)){
            is_valid = true;
        }

        if(is_valid){ return(false); }
    });

    if(is_valid){ set_valid_flag(); }

    return next();
};

expectation_validator.types = types;

module.exports = expectation_validator;
