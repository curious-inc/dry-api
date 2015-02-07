
var _ = require('dry-underscore');

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

        if(_.isArray(params)){ 
            var params_map = [];
            _.each(params, function(val, i){
                request[i] = val;
                params_map.push(val);
            });
            request.params = params_map;
        }else if(_.isObject(params)){ 
            _.extend(request, params, request);
        }

       return(request);
    };

    client.prototype.call = function(method_name, params, callback){
        var self = this;

        if(!method_name){ _.fatal("you must pass a method name to api_client.call"); }

        params = params || {};
        callback = callback || _.noop;
    
        var req = self.request(method_name, self.access_token(), params);

        self.bite("prepare_request", [req], function(err){
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

                // TODO: allow context manipulation, just like on the server side
                self.log().debug("arguments before perpare_arguments:", result);
                self.bite("prepare_arguments", [result], function(err){
                    if(err){ 
                        self.log().debug("prepare_arguments (err):", err);
                        return callback(err);
                    }
                    self.log().debug("arguments after prepare_arguments:", result);

                    var context = { access_token: self.access_token() };

                    var params = [];
                    if(result.params){
                        if(!_.isArray(result.params)){ return callback(self.errors().malformed_reply("params is not an array.")); }

                        params = _.map(result.params, function(key){ return(result[key]); });
                    }else{ return callback(self.errors().malformed_reply("reply lacks params")); }


                    self.log().debug("callback (context):", context);
                    self.log().debug("callback (params):", params);
                    self.log().debug("callback:", callback.toString());
                    callback.apply(context, params);
                });
            });
        });
    };

    function smart_client(cli, hash){
        this._client = cli
        this.configure(hash);
    }

    smart_client.prototype.access_token = function(at){
        if(at){ 
            this._client.access_token(at);
            return(this);
        }else{
            return(this._client.access_token());
        }
    };

    smart_client.prototype.configure = function(hash){
        var self = this;

        var api_functions = {};
        _.each(hash, function(roles, api_name){ 
            var funs = [];
            _.each(roles, function(fun_info){
                funs = _.concat(funs, _.keys(fun_info));
            });
            api_functions[api_name] =  _.uniq(funs);
        });

        _.each(api_functions, function(function_names, api_name){ 
            var api = {};
            self[api_name] = function(){ return(api); };
            _.each(function_names, function(function_name){
                api[function_name] = function(){
                    var args = _.a(arguments);
                    var callback = args.pop();
                    if(!_.isFunction(callback)){
                        args.push(callback);
                        callback = null;
                    }
                    args = [api_name + "." + function_name, args, callback];
                    self._client.call.apply(self._client, args);
                };
            });
        });
    };

    client.prototype.smart_client = function(hash){
        return(new smart_client(this, hash));
    };

    client.prototype.smart_client_code = function(url, hash){
        var client_code = "";

        client_code += "var api = null;";
        client_code += "(function(){"
        client_code += client.library.toString();
        client_code += "var client = library();";
        client_code += "api = new client('" + url + "').smart_client(" + _.stringify(hash) + ");";
        client_code += "})();"

        return(client_code);
    };

    client.library = library;

    return(client);
};

module.exports = library();
