
// TODO: finish docs

require('tamejs').register();

exports.api_manager = require('./api_manager.js');
exports.access_manager = require('./access_manager.js');

exports.access_stores = {
    memory_store: require('./access_stores/memory_store.js')
};

exports.client = require('./client.js');

exports.providers = {
    http_rpc: require('./providers/http_rpc.js')
};


