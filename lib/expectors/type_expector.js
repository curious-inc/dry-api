
var _ = require('dry-underscore');

function type_expector(){ 
    this._types = {
        'string' : _.isString,
        'number' : _.isNumber,
        'null' : _.isNull,
        'object' : _.isObject,
        'array' : _.isArray,
        '*' : function(){ return(true); }
    };
}

type_expector.prototype.match = function(val, valid_types, callback){

    var self = this;
    var is_valid = false;

    _.beach(valid_types, function(type){
        if(self._types[type]){
            is_valid = self._types[type](val);
        }else if(_.isNull(type) && _.isNull(val)){
            is_valid = true;
        }

        if(is_valid){ return(false); }
    });

    return callback(null, is_valid);
};

module.exports = type_expector;
