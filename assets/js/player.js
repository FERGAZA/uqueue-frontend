var player
var playlist = []
var tag = document.createElement('script')

const $ = e => document.querySelector(e)
const $$ = e => document.querySelectorAll(e)
const urlParams = new URLSearchParams(window.location.search)
const roomId = urlParams.get('id')

function drawElement(img, name){
    const base = `<div class="element"> <img src="${img}" /><p class="content">${name}</p></div>`
    $(".playlist").innerHTML += base
}

async function processData(queue){
  for (let uri of queue){
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${uri}`)
    const json = await res.json()
    playlist.push({ id: uri.replaceAll('https://www.youtube.com/watch?v=', ''), ...json, })
    drawElement(json.thumbnail_url, json.title)
  }
}

function clearPlaylist(){
  $('.playlist').innerHTML = ''
}

function setVideoTitle(str){
  $('.media-title').innerHTML = str
}

function manageVolumeFromLS(){
  const vol = localStorage.getItem('audio-level')
  
  if (vol) 
    player.setVolume(parseInt(vol))
}

document.addEventListener('DOMContentLoaded', () => {
  initIo()

  new Request(`/api/room/${roomId}`, "GET", e => {
    if (e.status == 200) {
      const json = JSON.parse(e.responseText)
      const queue = json.queue
      processData(queue).then(() => {
        tag.src = "https://www.youtube.com/iframe_api"

        var script = document.getElementsByTagName('script')[0]
        script.parentNode.insertBefore(tag, script)
      })
    }
    else alert(e.responseText)
  })

  const modal = new Modal("addPlaylistModal", { registerCloseEvent: true })

  $("#addPlaylistButton").addEventListener('click', () => modal.open())
  $("#addPlaylistModal form").addEventListener('submit', e => {
    const videos = $("#addPlaylistModal textarea").value
      .replaceAll('\n', '')
      .replaceAll(' ', '')
      .trim()
      .split(',')
    const tempPlaylist = [
      ...playlist.map(e => `https://www.youtube.com/watch?v=${e.id}`), 
      ...videos
    ]
    socket.emit('add-queue', { id: roomId, queue: tempPlaylist})
    modal.close()
  })
  
  $('#volumeManager').addEventListener('click', e => {
    $('#volumeManager').innerHTML = '<i class="' + (player.isMuted() ? 'icons-volume-full' : 'icons-volume-off') + '"></i>'
    toggleAudio()
  })
  
  socketOnSendPlaylist(data => {
    if (data.id != roomId) return

    while (playlist.length) playlist.pop()//Clear array
    clearPlaylist()
    processData(data.queue).then(() => {
      const video = playlist[0]
      if (video){
        player.loadVideoById(video.id)
        setVideoTitle(video.title)
      }
      else if (player) player.stopVideo()
    })
  })
  socketOnUpdatePlaylist(data => {
    if (data.id != roomId) return
    while (playlist.length) playlist.pop()//Clear array
    clearPlaylist()
    processData(data.queue).then(() => {
      const video = playlist[0]

      if (video){
        if (!player){
          onYouTubeIframeAPIReady()
        }
        const checkPlayerToPlayNewVideo = () => setInterval(() => {
          if (player && player.getPlayerState() != 1) {
            const taskId = tasks.find(task => task.name === 'player-checker-to-play-video').id

            player.loadVideoById(video.id)
            player.seekTo(0)
            setVideoTitle(video.title)

            tasks.splice(tasks.findIndex(e => e.id === taskId), 1)
            clearInterval(taskId)
          }
        }, 1000)
        tasks.push({name: 'player-checker-to-play-video', id: checkPlayerToPlayNewVideo()})
      }
    })
  })
})

function onYouTubeIframeAPIReady() {
  player = new YT.Player('player', {
    height: '540',
    width: '960',
    videoId: playlist[0].id,
    playerVars: {
      'playsinline': 1,
      'autoplay': 1, 
      'controls': 0,
      'mute': 1,
    },
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange
    }
  })
}

function onPlayerReady(event) {
  event.target.playVideo()
  manageVolumeFromLS()
  socketOnGetVideoTime(time => {
    const sendTime = () => setInterval(() => {
      if (player.getPlayerState() == 5){
        const taskId = tasks.find(task => task.name === 'send-time').id
        tasks.splice(tasks.findIndex(e => e.id === taskId), 1)
        clearInterval(taskId)
        return
      }
      else socket.emit('send-time', { room: roomId, time: parseInt(player.getCurrentTime()) })
    }, 500)
    player.seekTo(time)
    tasks.push({ name: 'send-time', id: sendTime()})
  })
  socket.emit('start-video', { room: roomId })
  setVideoTitle(playlist[0].title)
}

function onPlayerStateChange(event) {
  const state = player.getPlayerState()
  if (state === 5 || (state === 0 && playlist.length > 1)){
    if (!playlist.length) return
    
    playlist.shift()
    const video = playlist[0]

    if (video){
      console.log(video)
      player.loadVideoById(video.id)
    
      clearPlaylist()
      setVideoTitle(video.title)
      drawElement(video.thumbnail_url, video.title)
  
      player.seekTo(0)
    }
    else if (player) {
      clearPlaylist()
      player.stopVideo()
    }

    socket.emit('modify-queue', { id: roomId, queue: playlist.map(e => `https://www.youtube.com/watch?v=${e.id}`) })
    socket.emit('send-time', { room: roomId, time: parseInt(player.getCurrentTime()) })
  }
}

function stopVideo() {
  player.stopVideo()
}

function toggleAudio(){
  if (player.isMuted()) player.unMute()
  else player.mute()
}

function reduceAudio(){
  localStorage.setItem('audio-level', String(player.getVolume() -10))
  player.setVolume(player.getVolume() -10)
}

function increaseAudio(){
  localStorage.setItem('audio-level', String(player.getVolume() +10))
  player.setVolume(player.getVolume() +10)
}

function skipVideo(){
  player.stopVideo()
}