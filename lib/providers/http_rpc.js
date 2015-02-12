"use strict";

var _ = require('dry-underscore');

function http_rpc(api_manager, express, route, outside_error_handler){

    this._api_manager = api_manager;
    this._express = express;
    this._route = route;
    this._outside_error_handler = outside_error_handler || _.noop;

    this.errors = _.bind(api_manager.errors, api_manager);

    this.limits = { body_size: 1e6 };

    this.development = false;

    this._middleware = [];
}

_.event_emitter(http_rpc.prototype);

http_rpc.prototype.api_manager = _.r("_api_manager");
http_rpc.prototype.express = _.r("_express");
http_rpc.prototype.route = _.r("_route");

http_rpc.prototype.mount = function(){
    this.express().post(this.route(), 
        _.middleware.noCache(), 
        _.middleware.receiveBody(this.limits.body_size), 
        this._middleware, 
        function(err, req, res, next){ req.error = err; next(); },
        _.bind(this.route_handler, this)
   ); 
};


http_rpc.prototype.error_handler = function(err, req, res, next){

    var self = this;

    var hash = self.api_manager().encode_error(err);

    self.handle_results(res, err, result_hash);
};

http_rpc.prototype.handle_results = function(res, err, result_hash){

    res.write(_.stringify(result_hash));
    res.end();

    this.emit("sent", result_hash);
    if(err){ return this.emit("error", err, result_hash); }
};

http_rpc.prototype.route_handler = function(req, res, next){ 

    var self = this;

    function error_handler(err){ return self.error_handler(err, req, res, next); }

    if(req.error){ return error_handler(req.error); }

    if(!req.body){ return error_handler(self.errors().malformed_call("no data.")); }

    try{ var hash = _.parse(req.body); }
    catch(e){ return error_handler(self.errors().malformed_call("request parse error.")); }

    if(!_.isString(hash.method)){ return error_handler(self.errors().malformed_call("no method name defined, or it isn't a string.")); }
    if(hash.access_token && !_.isString(hash.access_token)){ return error_handler(self.errors().malformed_call("access_token is defined, but it isn't a string.")); }

    if(!hash.access_token && req.session && req.session.access_token){
        hash.access_token = req.session.access_token;
    }

    var context = {
        req: req,
        res: res,
        access_token: hash.access_token
    };

    if(self.trace){ _.log.error("calling: ", hash.method); }

    self.api_manager().call(hash.method, context, hash, function(err, result_hash){
        self.handle_results(res, err, result_hash);
    });
};

module.exports = http_rpc;

