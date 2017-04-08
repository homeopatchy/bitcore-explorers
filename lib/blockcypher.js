'use strict';

var request = require('request');
var async = require('async');

var bitcore = require('bitcore-lib');
var _ = bitcore.deps._;

var $ = bitcore.util.preconditions;
var Address = bitcore.Address;
var JSUtil = bitcore.util.js;
var Networks = bitcore.Networks;
var Transaction = bitcore.Transaction;
var UnspentOutput = Transaction.UnspentOutput;
var AddressInfo = require('./models/addressinfo');
var FeeEstimation = require('./models/feeestimation');
var errors = require('./errors');

var OPTS = '?unspentOnly=true&includeScript=true';

/**
 * @param {string=} url the url of the Blockcypher server
 * @param {Network=} network whether to use livenet or testnet
 * @constructor
 */
function Blockcypher(token, url, network) {
  if (!url && !network) {
    return new Blockcypher(token, Networks.defaultNetwork);
  }
  if (Networks.get(url)) {
    network = Networks.get(url);
    url = 'https://api.blockcypher.com/v1/btc/' + (
      network === Networks.livenet ? 'main' : 'test3'
    )
  }
  this.token = token;
  this.url = url;
  this.network = Networks.get(network) || Networks.defaultNetwork;
  this.request = request;
  return this;
}

/**
 * @callback Blockcypher.GetUnspentUtxosCallback
 * @param {Error} err
 * @param {Array.UnspentOutput} utxos
 */

/**
 * Retrieve a list of unspent outputs associated with an address or set of addresses
 * @param {Address|string|Array.Address|Array.string} addresses
 * @param {GetUnspentUtxosCallback} callback
 */
Blockcypher.prototype.getUnspentUtxos = function(addresses, callback) {
  var self = this;
  $.checkArgument(_.isFunction(callback));
  if (!_.isArray(addresses)) {
    addresses = [addresses];
  }
  addresses = _.map(addresses, function(address) {
    return new Address(address);
  });

  async.map(addresses, function(address, cb) {
    self._getAddress(address, cb)
  }, function(err, results) {
    if (err) {
      return callback(err);
    }
    return callback(null, _.flatten(results));
  });
};

function getMaybeArray(array) {
  return _.isArray(array) ? array : [];
}

function blockcypherToBitcoreOutputFormat(output) {
  return {
    txId: output.tx_hash,
    outputIndex: output.tx_output_n,
    satoshis: output.value,
    script: output.script,
    address: new bitcore.Address(new bitcore.Script(output.script))
  };
}

function processAddressInfoIntoOutputs(rawInfo) {
  rawInfo = JSON.parse(rawInfo)
  var txs = getMaybeArray(rawInfo.txrefs);
  var unconfirmed = getMaybeArray(rawInfo.unconfirmed_txrefs);

  return txs.concat(unconfirmed)
    .map(blockcypherToBitcoreOutputFormat)
    .map(bitcore.Transaction.UnspentOutput);
}

Blockcypher.prototype._getAddress = function(address, cb) {
  var query = OPTS + (this.token ? '&token=' + this.token : '')
  this.requestGet('/addrs/' + address.toString() + query, function(err, res, body) {
    if (err || res.statusCode !== 200) {
      return cb(err || body);
    }
    return cb(null, processAddressInfoIntoOutputs(body))
  });
};

/**
 * @callback Blockcypher.BroadcastCallback
 * @param {Error} err
 * @param {string} txid
 */

/**
 * Broadcast a transaction to the bitcoin network
 * @param {transaction|string} transaction
 * @param {BroadcastCallback} callback
 */
Blockcypher.prototype.broadcast = function(transaction, callback) {
  $.checkArgument(JSUtil.isHexa(transaction) || transaction instanceof Transaction);
  $.checkArgument(_.isFunction(callback));
  if (transaction instanceof Transaction) {
    transaction = transaction.serialize(true);
  }

  var query = this.token ? '?token=' + this.token : ''
  this.requestPost('/txs/push' + query, {
    tx: transaction
  }, function(err, res, body) {
    if (err || res.statusCode !== 201) {
      if (!err && body.error.indexOf('already exists') > -1) {
        return callback(new errors.AlreadyBroadcastedError(body.error));
      }
      return callback(err || body);
    }
    return callback(null, body ? body.tx.hash : null);
  });
};

/**
 * @callback Blockcypher.FeeEstimationCallback
 * @param {Error} err
 * @param {FeeEstimation} estimation
 */

/**
 * Retrieve information about fee estimation
 * @param {BlockCount|number} withinBlocks
 * @param {FeeEstimationCallback} callback
 */
Blockcypher.prototype.feeEstimation = function(withinBlocks, callback) {
  $.checkArgument(_.isFunction(callback));
  $.checkArgument(_.isNumber(withinBlocks) && withinBlocks >= 0);
  withinBlocks = parseInt(withinBlocks, 10);

  var query = this.token ? '?token=' + this.token : ''
  this.requestGet('/' + query, function(err, res, body) {
    if (err || res.statusCode !== 200) {
      return callback(err || body);
    }
    var estimation;
    try {
      estimation = FeeEstimation.fromBlockcypher(body);
      estimation = withinBlocks < 3
        ? estimation.high
        : withinBlocks < 7
          ? estimation.medium
          : estimation.low
    } catch (e) {
      if (e instanceof SyntaxError) {
        return callback(e);
      }
      throw e;
    }
    return callback(null, estimation);
  });
};


/**
 * Internal function to make a post request to the server
 * @param {string} path
 * @param {?} data
 * @param {function} callback
 * @private
 */
Blockcypher.prototype.requestPost = function(path, data, callback) {
  $.checkArgument(_.isString(path));
  $.checkArgument(_.isFunction(callback));
  this.request({
    method: 'POST',
    url: this.url + path,
    headers: { 'Content-Type': 'application/json' },
    json: data
  }, callback);
};

/**
 * Internal function to make a get request with no params to the server
 * @param {string} path
 * @param {function} callback
 * @private
 */
Blockcypher.prototype.requestGet = function(path, callback) {
  $.checkArgument(_.isString(path));
  $.checkArgument(_.isFunction(callback));
  this.request({
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    url: this.url + path
  }, callback);
};

module.exports = Blockcypher;
