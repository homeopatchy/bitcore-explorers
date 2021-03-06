'use strict';

var bitcore = require('bitcore-lib');

var _ = bitcore.deps._;
var $ = bitcore.util.preconditions;
var JSUtil = bitcore.util.js;

function FeeEstimation(param) {
  if (!(this instanceof FeeEstimation)) {
    return new FeeEstimation(param);
  }
  if (param instanceof FeeEstimation) {
    return param;
  }

  $.checkArgument(_.isNumber(param.withinBlocks));
  $.checkArgument(_.isNumber(param.feePerKb));

  JSUtil.defineImmutable(this, param);
}

FeeEstimation.fromInsight = function(param) {
  if (_.isString(param)) {
    param = JSON.parse(param);
  }

  var withinBlocks = Object.keys(param)[0]
  var feePerKb = param[withinBlocks] * 1e8

  return new FeeEstimation({
    withinBlocks: parseInt(withinBlocks, 10),
    feePerKb: parseInt(feePerKb, 10)
  });
};

FeeEstimation.fromBlockcypher = function(param) {
  if (_.isString(param)) {
    param = JSON.parse(param);
  }

  return {
    high: new FeeEstimation({
      withinBlocks: 0,
      feePerKb: parseInt(param.high_fee_per_kb, 10)
    }),
    medium: new FeeEstimation({
      withinBlocks: 3,
      feePerKb: parseInt(param.medium_fee_per_kb, 10)
    }),
    low: new FeeEstimation({
      withinBlocks: 7,
      feePerKb: parseInt(param.low_fee_per_kb, 10)
    })
  };
};

module.exports = FeeEstimation;
