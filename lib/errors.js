function AlreadyBroadcastedError (message) {
  if (!(this instanceof AlreadyBroadcastedError)) {
    return new AlreadyBroadcastedError(message);
  }
  this.name = 'AlreadyBroadcastedError'
  this.message = message
  this.stack = (new Error()).stack
}

module.exports = {
  AlreadyBroadcastedError: AlreadyBroadcastedError
}
