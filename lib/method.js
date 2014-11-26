"use strict";

var _ = require('dry-underscore');

function method(role, name, method, expects){
    this._name = name;
    this._method = method || null;
    this._role = role || null;
    this._expects = expects || [];
}

method.prototype.role = _.r("_role");
method.prototype.name = _.r("_name");
method.prototype.method = _.r("_method");

method.prototype.expects = function(){
    if(!arguments.length){ return(this._expects); }
    this._expects = _.a(arguments);
    return(this);
};

method.prototype.call = function(context){
    if(!this.method()){
        _.fatal("tried to call undefined method: " + this.name());
    }
    var args = _.a(arguments);
    args.shift();
    return(this.method().apply(context, args));
};

method.prototype.apply = function(context, args){
    if(!this.method()){
        _.fatal("tried to call undefined method: " + this.name());
    }
    return(this.method().apply(context, args));
};


module.exports = method;
