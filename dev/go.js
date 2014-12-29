/**
 * Ancient @izs magic to run a bunch of servers in child processes neatly.
 */

var config = require('../config')
var touch = require('touch')
var spawn = require('child_process').spawn
var once = require('once')

// flow control is fun!
function queue () {
  var args = [].slice.call(arguments)
  var cb = args.pop()
  go(args.shift())
  function go (fn) {
    if (!fn) return cb()
    fn(function (er) {
      if (er) return cb(er)
      go(args.shift())
    })
  }
}

var children = []
function exec (cmd, args, wait, cb) {
  console.log("Running %j %j",cmd,args)
  if (typeof wait === 'function') cb = wait, wait = 200
  cb = once(cb)

  var opts = {stdio:'inherit'}
  // windows is kind of a jerk sometimes.
  if (process.platform === 'win32') {
    args = ['/c', '"' + cmd + '"'].concat(args)
    cmd = 'cmd'
    opts.windowsVerbatimArguments = true
  }
  var child = spawn(cmd, args, opts)

  var timer = setTimeout(cb, wait)

  child.on('exit', function (code) {
    clearTimeout(timer)
    var er
    if (code) {
      msg = cmd + ' ' + args.join(' ') + ' fell over: '+code
      console.error(msg)
      er = new Error(msg)
    }
    cb(er)
  })
  children.push(child)
}

// try to shut down stuff nicely on ctrl-C
process.on('exit', function() {
  children.forEach(function(child) {
    try {
      child.kill('SIGKILL')
    } catch (er) {}
  })
})

queue(function (cb) {
  // first, make sure that we have the databases, or replicate will fail
  touch('/usr/local/var/lib/couchdb/registry.couch', cb)

}, function (cb) {
  touch('/usr/local/var/lib/couchdb/public_users.couch', cb)

}, function (cb) {
  touch('/usr/local/var/lib/couchdb/downloads.couch', cb)

}, function (cb) {
  // wait 10 seconds for couch to start and download some data
  // otherwise the site is pretty empty.
  setTimeout(function() {
    exec(process.execPath, [require.resolve('./replicate.js')], 5000, cb)
  },10000)

}, function (cb) {
  // by now, elastic search is probably up
  exec(process.execPath, [
    './node_modules/npm2es/bin/npm2es.js'
    , '--couch=' + config.couch.url
    , '--es=' + config.search.url
  ], function (code) {
    console.error('did npm2es', code)
    cb(code)
  })

}, function (cb) {
  // wait 5 seconds to start the server
  //  // otherwise the site is pretty empty.
  setTimeout(function() {
    exec(process.execPath, [require.resolve('../server.js')], 5000, cb)
  }, 5000)
 
}, function (cb) {
  // by now, elastic search is probably up
  exec(process.execPath, [
    './node_modules/numbat-collector/bin/run-server.js'
    , 'numbat-config.js'
  ], cb)

}, function(er) {
  if(er) throw er
})
