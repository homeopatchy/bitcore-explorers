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

/**
 * @param {string=} url the url of the Smoogs server
 * @param {Network=} network whether to use livenet or testnet
 * @constructor
 */
function Smoogs(url, network) {
  if (!url && !network) {
    return new Smoogs(Networks.defaultNetwork);
  }
  if (Networks.get(url)) {
    network = Networks.get(url);
    url = 'https://smoogs.io/api/' + (
      network === Networks.livenet ? 'v1' : 'testing'
    ) + '/blockchain'
  }
  this.url = url;
  this.network = Networks.get(network) || Networks.defaultNetwork;
  this.request = request;
  return this;
}

/**
 * @callback Smoogs.GetTransactionCallback
 * @param {Error} err
 * @param {Object} transaction
 */

/**
 * Get transaction by txid
 * @param {string} txid
 * @param {GetTransactionCallback} callback
 */
Smoogs.prototype.getTransaction = function(txid, callback) {
  $.checkArgument(_.isFunction(callback));
  $.checkArgument(_.isString(txid));
  $.checkArgument(txid.length === 64);

  this.requestGet('/tx/' + txid, function(err, res, body) {
    if (err || res.statusCode !== 200) {
      return callback(err || res);
    }
    var tx = new Transaction(body);

    return callback(null, tx);
  });
};

/**
 * @callback Smoogs.GetUnspentUtxosCallback
 * @param {Error} err
 * @param {Array.UnspentOutput} utxos
 */

/**
 * Retrieve a list of unspent outputs associated with an address or set of addresses
 * @param {Address|string|Array.Address|Array.string} addresses
 * @param {GetUnspentUtxosCallback} callback
 */
Smoogs.prototype.getUnspentUtxos = function(addresses, callback) {
  $.checkArgument(_.isFunction(callback));
  if (!_.isArray(addresses)) {
    addresses = [addresses];
  }
  addresses = _.map(addresses, function(address) {
    return new Address(address);
  });

  this.requestGet('/utxos?addresses=' + (
    _.map(addresses, function(address) {
      return address.toString();
    }).join(',')
  ), function(err, res, unspent) {
    if (err || res.statusCode !== 200) {
      return callback(err || res);
    }
    try {
      unspent = _.map(unspent, UnspentOutput);
    } catch (ex) {
      if (ex instanceof bitcore.errors.InvalidArgument) {
        return callback(ex);
      }
    }

    return callback(null, unspent);
  });
};

/**
 * @callback Smoogs.BroadcastCallback
 * @param {Error} err
 * @param {string} txid
 */

/**
 * Broadcast a transaction to the bitcoin network
 * @param {transaction|string} transaction
 * @param {BroadcastCallback} callback
 */
Smoogs.prototype.broadcast = function(transaction, callback) {
  $.checkArgument(JSUtil.isHexa(transaction) || transaction instanceof Transaction);
  $.checkArgument(_.isFunction(callback));
  if (transaction instanceof Transaction) {
    transaction = transaction.serialize();
  }

  this.requestPost('/broadcast', {
    rawtx: transaction
  }, function(err, res, body) {
    if (err || res.statusCode !== 200) {
      return callback(err || body);
    }
    return callback(null, body ? body.txid : null);
  });
};

/**
 * @callback Smoogs.FeeEstimationCallback
 * @param {Error} err
 * @param {FeeEstimation} estimation
 */

/**
 * Retrieve information about fee estimation
 * @param {BlockCount|number} withinBlocks
 * @param {FeeEstimationCallback} callback
 */
Smoogs.prototype.feeEstimation = function(withinBlocks, callback) {
  $.checkArgument(_.isFunction(callback));
  $.checkArgument(_.isNumber(withinBlocks) && withinBlocks >= 0);
  withinBlocks = parseInt(withinBlocks, 10);

  this.requestGet('/fee/' + withinBlocks, function(err, res, body) {
    if (err || res.statusCode !== 200) {
      return callback(err || feePerKb);
    }
    var feePerKb = body.feePerKb;
    var estimation;
    try {
      estimation = {
        withinBlocks: withinBlocks,
        feePerKb: feePerKb
      };
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
Smoogs.prototype.requestPost = function(path, data, callback) {
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
Smoogs.prototype.requestGet = function(path, callback) {
  $.checkArgument(_.isString(path));
  $.checkArgument(_.isFunction(callback));
  this.request({
    method: 'GET',
    url: this.url + path,
    json: true
  }, callback);
};

module.exports = Smoogs;
