'use strict'

const libp2p = require('libp2p')
const TCP = require('libp2p-tcp')
const Mplex = require('libp2p-mplex')
const SECIO = require('libp2p-secio')
const PeerInfo = require('peer-info')
const MulticastDNS = require('libp2p-mdns')
const defaultsDeep = require('@nodeutils/defaults-deep')
const waterfall = require('async/waterfall')
const parallel = require('async/parallel')
const series = require('async/series')

const fs = require('fs')


class MyBundle extends libp2p {
  constructor (_options) {
    const defaults = {
      modules: {
        transport: [ TCP ],
        streamMuxer: [ Mplex ],
        connEncryption: [ SECIO ],
        peerDiscovery: [ MulticastDNS ]
      },
      config: {
        peerDiscovery: {
          mdns: {
            interval: 2000,
            enabled: true
          }
        },
        EXPERIMENTAL: {
          pubsub: true
        }
      }
    }

    super(defaultsDeep(_options, defaults))
  }
}

function blockSync(protocol, conn) {
    pull(conn, pull.map((v) => v.toString()), 
      pull.collect((err, array) => {
        fs.writeFile('newblock.txt', array, (err) => {})
      })
    )
}
  

function createNode (callback) {
  let node

  waterfall([
    (cb) => PeerInfo.create(cb),
    (peerInfo, cb) => {
      peerInfo.multiaddrs.add('/ip4/0.0.0.0/tcp/0')
      node = new MyBundle({
        peerInfo
      })
      node.handle('/blockSync', blockSync)
      node.start(cb)
    }
  ], (err) => callback(err, node))
}

parallel([
  (cb) => createNode(cb),
  (cb) => createNode(cb)
], (err, nodes) => {
  if (err) { throw err }

  const node1 = nodes[0]
  const node2 = nodes[1]

  series([
    (cb) => node1.once('peer:discovery', (peer) => node1.dial(peer, cb)),
    (cb) => setTimeout(cb, 500)
  ], (err) => {
    if (err) { throw err }

    // Subscribe to the topic 'news'
    /*
      function(err,msg){
        if (err) throw err
        node1.pubsub.subscribe('news',
         //(msg) => console.log(msg.from, msg.data.toString()),
          //Buffer.from(data),
        function(msg,data){
          console.log(data)
        },
        () => {
          setInterval(() => {  }, 1000)
        }
      )}

      */
     
      node1.pubsub.subscribe(
       'news',
        (msg) => fs.writeFile('test.txt',msg.data.toString()),
        (err)=>{}
      )
  })
})