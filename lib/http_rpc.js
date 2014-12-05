"use strict";

var _ = require('dry-underscore');

var method = require('./method.js');
var dummy_method = new method();

function http_rpc(api_manager, access_manager, express, route){

    this._api_manager = api_manager;
    this._access_manager = access_manager;
    this._express = express;
    this._route = route;

    this.errors = _.bind(api_manager.errors, api_manager);

    this.limits = { body_size: 1e6 };

    this.development = false;

    this._middleware = [];

}

http_rpc.prototype.api_manager = _.r("_api_manager");
http_rpc.prototype.access_manager = _.r("_access_manager");
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

    _.p("error: ", err);
    var res_hash = {};

    if(err.type !== 'error'){
        _.log.error("dry-api: swallowed error: ", err);
        err = this.api_manager().errors().error()
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

    function error_handler(err){ return self.error_handler(err, req, res, next); }

    if(err){ return error_handler(err); }

    if(!req.body){ return error_handler(self.errors().malformed_call("no data.")); }

    try{ var hash = _.parse(req.body); }
    catch(e){ return error_handler(self.errors().malformed_call("request parse error.")); }

    if(!_.isString(hash.method)){ return error_handler(self.errors().malformed_call("no method name defined, or it isn't a string.")); }

    var context = {
        _req: req,
        _res: res
    };

    self.access_manager().get(hash.access_token, _.plumb(function(security_context){

        context = _.extend(context, security_context);

        self.api_manager().call(hash.method, context, hash, function(err){
            // we do this so we can use arguments in all it's glory below
            if(err){ return error_handler(err); }

            var args = _.a(arguments);

            self.api_manager().find_method(hash.method, context, _.plumb(function(method){

                method.parameters_to_hash(args, _.plumb(function(hash){                                                      

                    res.write(_.stringify(hash));
                    res.end();

                }, error_handler));

            }, error_handler));

        });

    }, error_handler));
};

module.exports = http_rpc;

