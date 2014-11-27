
*dry: core api*

**Installing**

To install: 

    npm install dry-api


**Introduction**

This package provides the core api libraries for the dry framework. Dry api's are elegant to write, and feature role based, declaritive security. 

They are transport agnostic, and protocol agnostic. You can run them rest over http, you can run jsonrpc over tcp or http.


**Defining an API**

An api is a set of functions. each function has a name, a secuirty role that can access it, and optionally a set of parameter validations.

the simplest way to call the api is with a method name, and an array of parameters:

```
var example_api = new api_class();

example_api.public("hello", function(callback, name, age){

    callback(null, "Hello " + name + ", you're " + age + " years old.", age + 10);

}).expects('string', 'number');

// post: { method: "example.hello_named_parameters", params: ["kendrick", 30] }
// recv: { params: [null, "Hello kendrick, you're 30 years old.", 40] }
```

if the api supports named parameters, you can make prettier requests:

```
var example_api = new api_class();

example_api.public("hello_named_parameters", function(callback, name, age){

    callback(null, "Hello " + name + ", you're " + age + " years old.", age + 10);

}).expects('string', 'number').parameters('name', 'age').callback('message', 'age_plus_ten');

// post { method: "example.hello_named_parameters", name: "kendrick", age: 30 }
// error shown for clarity, but if there isn't one we don't send it
// recv: { /* error: null, */ params_map: ['error', 'message', 'age_plus_ten'], message: "Hello kendrick, you're 30 years old.", age_plus_ten: 40 }
```

you can fake named parameters if the api you're consuming doesn't support them, by adding a map_params array in your request.

```
var example_api = new api_class();

example_api.public("hello_named_parameters", function(callback, name, age){

    callback(null, "Hello " + name + ", you're " + age + " years old.", age + 10);

}).expects('string', 'number').callback('message', 'age_plus_ten');

// post { method: "example.hello_named_parameters", name: "kendrick", age: 30, params_map: ['name', 'age'] }
// recv: { params_map: ['error', 'message', 'age_plus_ten'], message: "Hello kendrick, you're 30 years old.", age_plus_ten: 40 }
```



**Serving an API**

These API's are transport agnostic, and protocol agnostic. You can run them rest over http, you can run jsonrpc over tcp or http.

```
var server = express();

var api_manager = new api_manager_class(api_manger.http(server, "/api"), api_manager.json_rpc());

api_manager.api("example", example_api);

api_manager.mount();

server.listen(8000);
```


**Consuming an API**


With all this meta information, we can produce smart clients for a variety of languages. The first one we tackled is js, we produce one for the server and one for the client.

```
var api = api_client();

api.hello("kendrick", 30, function(err, message, age_plus_ten){
    console.log("message: ", message);
    console.log("age_plus_ten: ", age_plus_ten);
});

api.hello_named_parameters("kendrick", 30, function(err, message, age_plus_ten){
    console.log("message: ", message);
    console.log("age_plus_ten: ", age_plus_ten);
});
```

**Securing an API**

You can define "apis" as local only, that is they can only be accessed in memory. Clients won't even know they exist. They get "unknown_method" errors, instead of "permission_error" errors.

The more you method.expects, the better. The api will validate the input before it ever gets to you.


**License**

See the LICENSE file in the root of the repo for license information.

