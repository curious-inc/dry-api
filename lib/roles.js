"use strict";

var _ = require('dry-underscore');

function roles(hash){
    this._hash = {};
    this._array = [];
    this._name = [];

    this._set(hash);
}

roles.prototype.hash = function(){
    return(_.jclone(this._hash));
};

roles.prototype.array = function(){
    return(_.jclone(this._array));
};

roles.prototype.names = function(){
    return(_.jclone(this._names));
};

roles.prototype._set = function(hash){

    var self = this;
    hash = _.jclone(hash);

    self._hash = {};
    self._array = [];

    _.each(hash, function(val, role_name){
        delete val.role;

        var role = { 
            role: role_name,
            anon: false,
            serve: true
        };

        if(_.isNumber(val)){ role.priority = val; }
        else if(_.isObject(val)){ _.extend(role, val); }
        else{ _.fatal("expected number or object in roles hash for key: " + role_name); }

        if(_.undef(role.priority)){ _.fatal("priority undefined for role: " + role_name); }

        self._hash[role_name] = role;
        self._array.push(role);
    });

    self._array.sort(function(a, b){ return(a.priority - b.priority); });
    self._names = _.map(self._array, function(val, key){ return(val.role); });

    return(self);
}

module.exports = roles;


