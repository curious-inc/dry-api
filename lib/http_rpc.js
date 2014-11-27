"use strict";

var _ = require('dry-underscore');

var method = require('./method.js');
var dummy_method = new method();

function http_rpc(manager, express, route){

    this._manager = manager;
    this._express = express;
    this._route = route;

    this.errors = _.bind(manager.errors, manager);

    this.limits = { body_size: 1e6 };

    this.development = false;

    this._middleware = [];

}

http_rpc.prototype.manager = _.r("_manager");
http_rpc.prototype.express = _.r("_express");
http_rpc.prototype.route = _.r("_route");

http_rpc.prototype.mount = function(){
    this.express().get("/ping", function(req, res){
        res.write("pong");
        res.end();
    });
    this.express().post(this.route(), 
        // _.middleware.noCache(), 
        // _.middleware.receiveBody(this.limits.body_size), 
        // this._middleware, 
        function(err, req, res, next){ req.error = err; next(); },
        _.bind(this.route_handler, this)
   ); 
};


http_rpc.prototype.handle_error = function(err, req, res, next){

    var res_hash = {};

    if(err.type !== 'error'){
        _.log.error("dry-api: swallowed error: ", err);
        err = this.manager().errors().error()
    }

    if(!this.development){ 
        delete err.stack;
        delete err.path;
    }

    dummy_method.parameters_to_hash([err], function(e, hash){
        res_hash = hash;
    });

    res.write(_.stringify(res_hash));
    res.end();
};

http_rpc.prototype.route_handler = function(req, res, next){ 
    var err = req.error;

    var self = this;

    function handle_error(err){ return self.handle_error(err, req, res, next); }

    if(err){ return handle_error(err); }

    if(!req.body){ return handle_error(self.errors().malformed_call("no data.")); }

    try{ var hash = _.parse(req.body); }
    catch(e){ return handle_error(self.errors().malformed_call("request parse error.")); }

    if(!_.isString(hash.method)){ return handle_error(self.errors().malformed_call("no method name defined, or it isn't a string.")); }

    var context = {
        req: req,
        res: res
    };

    this.manager().call(hash.method, context, hash, function(err){
        if(err){ return handle_error(err); }

        var args = _.a(arguments);

        this.manager().find_method(hash.method, context, _.plumb(function(method){

            method.parameters_to_hash(args, _.plumb(function(hash){                                                      
                res.write(_.stringify(hash));
                res.end();
            }, handle_error));

        }, handle_error));
    });
};

module.exports = http_rpc;

