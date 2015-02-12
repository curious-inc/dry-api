
// TODO: finish docs

require('tamejs').register();

exports.api_manager = require('./api_manager.js');
exports.access_manager = require('./access_manager.js');

exports.test_server = require('./test_server.js');

exports.access_stores = {
    memory_store: require('./access_stores/memory_store.js')
};

exports.client = require('../clients/js/client.js');

exports.providers = {
    http_rpc: require('./providers/http_rpc.js')
};


