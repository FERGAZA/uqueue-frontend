var socket
var reconnect = true
const tasks = []

const connectionChecker = () => setInterval(() => {
  if (!socket.connected && !socket.connecting && reconnect){
    socket.connect()
    console.log("Trying to reconnect to the socket server")
  }
}, 2000)

const initIo = callback => {
  const uri = `${location.protocol}//${location.host}`
  const setting = {
    forceNew: true
  }

  socket = io.connect(uri, setting)
  tasks.push({name: 'connectionChecker', id: connectionChecker()})
  socket.on('connect', () => {
    if (callback) callback()
    console.log("Sockets initialized")
  })
}

const socketDisconnect = () => {
  reconnect = false
  socket.disconnect()
}

const socketOnSendPlaylist = callback => {
  socket.on('send-queue', callback)
}

const socketOnGetVideoTime = callback => {
  socket.on('get-time', callback)
}

const socketOnUpdatePlaylist = callback => {
  socket.on('update-queue', callback)
}