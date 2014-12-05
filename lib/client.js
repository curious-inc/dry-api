
var _ = require('dry-underscore');
// var request = require('dry-request');
//
// TODO: move dry-request to _.http
//  - http connectivity is something you need to do as a basic functionality
//  - move the docs to underscore readme.
//  - figure out how to mix dry-test and expresso
//  - refactor mixin() to library(), and library.library it's a much better construct
//  - write client _.http client

function library(){

    function client(url, access_token){
        this._url = url || null;
        this._access_token = access_token || null;
        this._errors = _.errors();
    };
    
    _.hook(client.prototype);

    client.prototype.url = _.rw("_url");
    client.prototype.access_token = _.rw("_access_token");

    client.prototype.log = _.r("_log"); 
    client.prototype._log = _.log.child("rpc.client");

    client.prototype.errors = _.r("_errors");

    client.prototype._init_errors = function(){
        this.errors().add("internal", "internal rpc client error.");
        this.errors().add("request", "error with request.");
        this.errors().add("reply", "error with reply.");
        this.errors().add("malformed_reply", "malformed reply.");
    };


    client.prototype.request = function(method, access_token, params){
        var request = {
            "method" : method,
            "access_token": access_token || null
        };

        if(_.isArray(params)){ request.params = params; }
        else if(_.isObject(params)){ _.extend(request, params, request); }

       return(request);
    };

    client.prototype.call = function(method_name, params, callback){
        var self = this;

        if(!method_name){ _.fatal("you must pass a method name to api_client.call"); }

        params = params || {};
        callback = callback || _.noop;
    
        var req = self.request(method_name, self.access_token(), params);

        self.bite("request.prepare", [req], function(err){
            if(err){ return callback(err); }

            try{ var data = _.stringify(req); }
            catch(e){ return callback(_.error("parse_error", "Error parsing request.", e)); }

            // self.log().debug("url:", self.url());
            // self.log().debug("client request is string: ", _.isString(data));
            self.log().debug("client request:", data);

            _.http.post(self.url(), data, function(err, res, body){
                if(err){ return callback(err); }

                if(res.status != 200){ 
                    return callback(_.error("server_error", "server status code: " + res.status + " message: " + res.body));
                }

                self.log().debug("recieved:'" + res.body + "'");
                try{ var result = _.parse(res.body); }
                catch(e){ return callback(_.error("parse_error", "error parsing response: " + res.body, e)); }

                self.log().debug("client response:", result);
                if(result.access_token){ self._access_token = result.access_token; }

                // TODO: allow context manipulation, just like on the server side
                self.bite("result.prepare", result, function(err){
                    if(err){ return callback(err); }

                    var context = { access_token: self.access_token() };

                    var params = [];
                    if(result.params){
                        params = result.params;
                    }else if(result.params_map){
                        params = _.map(result.params_map, function(key){ return(result[key]); });
                    }else{ return callback(self.errors().malformed_reply("reply lacks params, or params_map")); }

                    if(!_.isArray(params)){ return callback(self.errors().malformed_reply("params is not an array.")); }

                    callback.apply(context, params);
                });
            });
        });
    };

    client.library = library;

    return(client);
};

module.exports = library();
