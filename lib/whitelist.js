
var _ = require('dry-underscore');

function init(self){
    self._errors = null;
    self._whitelist = [];
}

function mixin(pry){
    pry.whitelist = function(err){
        if(_.isString(err)){
            this._whitelist.push(err);
        }else if(_.isObject(err)){
            if(!err.code){ _.fatal("tried to whitelist error without a code."); }
            this._whitelist.push(err.code);
        }else{
            _.fatal("tried to whitelist error without providing an error or a code, you passed in: ", err);
        }
    };

    pry.whitelisted = function(err){
        if(!err.code){ return(false); }
        return(_.contains(this._whitelist, err.code));
    };
}

exports.init = init;
exports.mixin = mixin;
