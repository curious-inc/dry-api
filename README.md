# Documentation TODO
*smart_client format changed*
*whitelisting errors*
*make sure context function is correct*
*local clients (include maxSockets info)*
*require('http').globalAgent.maxSockets = 200;*
*wire format changed*


# dry: core api

## Installing

To install: 

    npm install dry-api


## Introduction

This package provides the core api libraries for the dry framework. Dry api's are elegant to write, and feature role based, declaritive security and validations. 

They are transport agnostic, and protocol agnostic. You can run them REST over HTTP, you can run JsonRPC over TCP or HTTP.

## Clients

JavaScript: the client runs both browser side, and node side, with identical semantics.

Swift Client: <https://github.com/curious-inc/dry-api-swift>

## The look

```
// server side

var api = api_manager.api("example_api", true);

api.public("hello_messages", function(callback, name, age){

    var name_message = "Hello " + name + ".";
    var age_message =  "You're " + age + " years old.";

    callback(null,   "You're " + age + " years old.");

});

// node or browser side

client.example_api().hello_messages("Kendrick", 30, function(err, name_message_response, age_message_response){
    if(err){ throw(err); }

    console.log(name_message_response); // "Hello Kendrick."
    console.log(age_message_response); // "You're 30 years old."

});

// iOS side

client.call("example_api.hello_messages", "Kendrick", 30, { (err, name_message_response: String?, age_message_response: String?) in
    if(err){ return println("\(err)"); }

    println(name_message_response); // "Hello Kendrick."
    println(age_message_response); // "You're 30 years old."

});


```

## Defining an API

### Roles

An api is a set of functions. Each api function has a name, and a "role" that can access it. There are a set of default security roles, but you can define your own if you like.
The default roles are: "server", "admin", "user", and "public". 
Functions marked with the "server" role are never served across the network. They can only be accessed through loopback.
Functions marked with the "public" role can be accessed by anyone. There is no access validation performed.
Functions marked with the "user" or "admin" role can only be accessed by users with those roles.
You can think of roles as a thing a user has, an array of strings `var user = { ..., roles: ["user", "admin"], ... }`.
If a user is an admin, you should assign them the "admin" role, for example.
You can connect your existing security methodology to this api very easily, or you can use ours.
You can learn more about roles, and security below in the section "Bring Your Own Security".

Api's are defined as groups of functions in a namespace. Imagine an api that looks like: 

api_functions : {
    post: {
        get(id) -> (err, post), // everyone can access this.
        save(post) -> (err, new_id) // only users, can access this
    },
    example: {
        echo(message) -> (err, message) // anyone can access this
        hello(name, age) -> (err, messaeg, age_plus_one) // anyone can access this
    }
}

```javascript

// server side

var dry_api = require('dry-api');

var access_manager = new dry_api.access_manager();
var api_manager = new dry_api.api_manager(access_manager);

var example_api = api_manager.api("example", true); // create an api named "example"

// this function can be called by anyone because it has the role "public"
example_api.public("echo", function(callback, message){
    callback(null, message);
});

// this function can be called by anyone because it has the role "public"
example_api.public("hello", function(callback, name, age){
    callback(null, "Hello " + name, age+1);
});


var post_api = api_manager.api("post", true); // create an api named "post"

// this function can be called by anyone because it has the role "public"
post_api.public("get", function(callback, id){

    // this an imagined db library
    db.posts.find_one({ id: id }, function(err, post){
        if(err){ return callback(err); }
        else{ return callback(null, post); }
    });
});

// this function can only be called by users with the role "user"
post_api.user("save", function(callback, post){

    // "this" gets information added to it by the api classes,
    // you can add to it too, it's common to add the calling user to it.
    post.author_id = this.user.id;

    // this an imagined db library
    db.posts.save(post, function(err, new_id){
        if(err){ return callback(err); }
        else{ return callback(null, new_id); }
    });
});


// client side

<script>

    var client = new dry_api.client("/api");

    client.call("example.echo", "echo message!", function(err, message){
        if(err){ return console.log("error: ", err); }
        console.log(message); // "echo message!"
    });

    client.call("example.hello", "kendrick", 30, function(err, message, age_plus_one){
        if(err){ return console.log("error: ", err); }
        console.log(message); // "Hello kendrick!"
        console.log(age_plus_one); // 31
    });

    client.call("post.get", "some_post_id", function(err, post){
        if(err){ return console.log("error: ", err); }
        // do something with post
    });

    client.call("post.save", { title: "some title", text: "this is text }, function(err, new_id){
        if(err){ return console.log("error: ", err); }
        // do something with new_id
    });

    // there are smarter clients we'll get to.

    client.example.echo("echo message!", function(err, message){
        if(err){ return console.log("error: ", err); }
        console.log(message); // "echo message!"
    });

    // or call the client "api" on the client side
    api.example.hello("kendrick", 30, function(err, message, age_plus_one){
        if(err){ return console.log("error: ", err); }
        console.log(message); // "Hello kendrick!"
        console.log(age_plus_one); // 31
    });

    api.posts.save({ title: "some title", text: "this is text" }, function(err, new_id){
        if(err){ return console.log("error: ", err); }
        // do something with new_id
    });

    api.posts.get({ title: "some title", text: "this is text" }, function(err, new_id){
        if(err){ return console.log("error: ", err); }
        // do something with new_id
    });

</script>

```

## Validations

Each function can have type validations on the parameters:

```javascript

// server side

var example_api = api_manager.api("example", true); // create an api called "example"

// if you don't call it with a string, and a number, you'll get an error, and the function will never even be run

example_api.public("hello", function(calback, name, age){
    if(_.isString(age)){ age = age-0; }

    callback(null, "Hello " + name  + "!", age+1);

}).expects('string', ['number', 'string']);


// client side

api.example.hello(null, 30, function(err, message, age_plus_one){
    console.log(err); // "parameter: 0 did not meet expectations: ['string']"
    console.log(message); // undefined
    console.log(age_plus_one); // undefined
});

api.example.hello("kendrick", null, function(err, message, age_plus_one){
    console.log(err); // "parameter: 1 did not meet expectations: ['number', 'string']"
    console.log(message); // undefined
    console.log(age_plus_one); // undefined
});

api.example.hello("kendrick", 30, function(err, message, age_plus_one){
    // no error
    ...
}); 

api.example.hello("kendrick", "30", function(err, message, age_plus_one){
     // no error
     ...
});

```

# Documentation past this point it not up to date. Some of it is close.

## Serving an API

These API's are transport agnostic, and protocol agnostic. You can run them rest over http, you can run jsonrpc over tcp or http.

```javascript
var server = express();

var dry_api = require('dry-api');

var access_manager = new dry_api.access_manager(new dry_api.stores.memory_store());
var api_manager = new dry_api.api_manager(access_manager);

var api = api_manager.api("test", true);
// or, if you combined it with the example above, you could add example_api like so:
// api_manager.api("example", example_api);

api.public("echo", function(callback, arg1, arg2){
    var args = _.a(arguments);
    args.shift();
    args.unshift(null);
    // args === [null, arg1, arg2, ...]
    callback.apply(this, args);
});

api.user("role", function(callback){
    callback(null, "user");
});

api.admin("role", function(callback){
    callback(null, "admin");
});

function create_access_records(callback){
    var expires = null;

    access_manager.create("admin_token", expires, ['user', 'admin'], { foo: "foo", bar: "bar" }, function(err){
        if(err){ return callback(err); }

        access_manager.create("user_token", expires, ['user'], { foo: "foo", bar: "bar" }, function(err){
            if(err){ return callback(err); }
        });
    });
}

function start_server(callback){

    var app = express();

    create_access_records(function(err){
        if(err){ return callback(err); }

        var provider = new dry_api.providers.http_rpc(api_manager, app, config.url);

        provider.mount();

        app.listen(8000);

        callback();
    });
};

start_server(function(err){
    if(err){ throw(err); }
});

```


## Consuming an API


With all this meta information, we can produce smart clients for a variety of languages. The first one we tackled is js, we produce one for the server and one for the client.

This is an example of a basic call, without a smart client:

```javascript
var api = new dry_api.client("http://localhost:8000/api");

api.call("example.hello", ["kendrick", 30], function(err, message, age_plus_ten){
    console.log("message: ", message);
    console.log("age_plus_ten: ", age_plus_ten);
});

api.call("example.hello_named_parameters", ["kendrick", 30], function(err, message, age_plus_ten){
    console.log("message: ", message);
    console.log("age_plus_ten: ", age_plus_ten);
});
```

If we output a hash from the api_manager class we can create a smart client, that knows the names of our api functions.

```javascript
var api = new dry_api.client("http://localhost:8000/api").smart_client(manager.hash());

api.example.hello("kendrick", 30, function(err, message, age_plus_ten){
    console.log("message: ", message);
    console.log("age_plus_ten: ", age_plus_ten);
});

api.example.hello_named_parameters("kendrick", 30, function(err, message, age_plus_ten){
    console.log("message: ", message);
    console.log("age_plus_ten: ", age_plus_ten);
});
```

We can also have `dry_api.client` produce a file for consumption on the client side.

```javascript
// server side

var code = new dry_api.client().smart_client_code("/api", manager.hash());
fs.writeFileSync("./my_api_client.js", code);

```

```javascript
// client side

<script src="dry.underscore.js"></script>
<script src="my_api_client.js"></script>

<script>

    api.example.hello("kendrick", 30, function(err, message, age_plus_ten){
        console.log("message: ", message);
        console.log("age_plus_ten: ", age_plus_ten);
    });

    api.example.hello_named_parameters("kendrick", 30, function(err, message, age_plus_ten){
        console.log("message: ", message);
        console.log("age_plus_ten: ", age_plus_ten);
    });

</script>
```


## Securing an API

You can define "apis" as local only, that is they can only be accessed in memory. Clients won't even know they exist. They get "unknown_method" errors, instead of "permission_error" errors.

The more you method.expects, the better. The api will validate the input before it ever gets to you.

## Access Table

The api knows about a request parameter called "access_token", it will interact with the access_manager class you see, above to fetch a record from the store that contains authentication information.

You can provide it to your client like so:

```javascript
var api = new dry_api.client("/api");

api.access_token("user_token");

api.call("example.role", function(err, role){
    console.log(role); // "user"
});

api.access_token("admin_token");

api.call("example.role", function(err, role){
    console.log(role); // "admin"
});

```


## Bring Your Own Security

This example works with the http_rpc provider, because the req, and res object are made available on the context object. The context object has a property called "roles". 
"roles" is what the api looks at to determine what access the current caller has, and as a result what function they should have access to, if any. Appending context is also how you would make the current "user" available to your api functions.
I'm assuming you have session enabled, and you're storing the current users user_id in the session.

```javascript
api_manager.context(function(next, context){

    var user_id = null;
    if(this.req.session && this.req.session.user_id){
        user_id = req.session.user_id;
    }

    if(!user_id){ return next(); }

    // this db call is fictionalized
    db.user.select({ id: user_id }, function(err, user){
        if(err){ return next(err); }
        // if err, it gets passed back to the client before we ever get to the api function

        // context.roles already exists, 
        // if a valid access_token was passed from the client, 
        // it will be filled with whatever is stored it the access_manager
        console.log(context.roles); // "[]"

        // overwrite any access_token access
        // use the roles from your database
        context.roles = user.roles;

        // make user available to the api functions on "this";
        context.user = user;
        context.more_random_stuff = "hello!";
    });
});


var api = api_manager.api("example");

// if context.roles contains "user" we get this function
api.user("context_example", function(callback){
    var user = this.user; // BAM! we got the user from the context hook
    var roles = this.roles;
    var more_random_stuff = context.more_random_stuff;

});

// if context.roles contains "admin" we get this function
api.admin("context_example", function(callback){
    var user = this.user; // BAM! we got the user from the context hook
    var roles = this.roles;
    var more_random_stuff = context.more_random_stuff;
});

```

What role gets priority if, say context.roles  === ["user", "admin"] can be seen in access_manager.roles().hash();
You can create your own roles if you want, when you create your access_manager;

### Parameters, Callbacks, Request Formats

Optionally a set of parameter validations.
the simplest way to call the api is with a method name, and an array of parameters:

```javascript
var example_api = new api_class();

example_api.public("hello", function(callback, name, age){

    callback(null, "Hello " + name + ", you're " + age + " years old.", age + 10);

}).expects('string', 'number');

// post: { method: "example.hello_named_parameters", params: ["0", "1"], "0": "kendrick", "1": 30 }
// recv: { params: [null, "Hello kendrick, you're 30 years old.", 40] }
```

if the api supports named parameters, you can make prettier requests:

```javascript
var example_api = new api_class();

example_api.public("hello_named_parameters", function(callback, name, age){

    callback(null, "Hello " + name + ", you're " + age + " years old.", age + 10);

}).expects('string', 'number').parameters('name', 'age').callback('message', 'age_plus_ten');

// post { method: "example.hello_named_parameters", name: "kendrick", age: 30 }
// error shown for clarity, but if there isn't one we don't send it
// recv: { /* error: null, */ params_map: ['error', 'message', 'age_plus_ten'], message: "Hello kendrick, you're 30 years old.", age_plus_ten: 40 }
```

you can fake named parameters if the api you're consuming doesn't support them, by adding a map_params array in your request.

```javascript
var example_api = new api_class();

example_api.public("hello_named_parameters", function(callback, name, age){

    callback(null, "Hello " + name + ", you're " + age + " years old.", age + 10);

}).expects('string', 'number').callback('message', 'age_plus_ten');

// post { method: "example.hello_named_parameters", name: "kendrick", age: 30, params_map: ['name', 'age'] }
// recv: { params_map: ['error', 'message', 'age_plus_ten'], message: "Hello kendrick, you're 30 years old.", age_plus_ten: 40 }
```

A request and reply should either have a params array, or a params_map, never both. 
A malformed reply may have both, but a params array will always take prescedence.
A malformed request may have both, but a params array always will take prescedence.



## License

See the LICENSE file in the root of the repo for license information.

