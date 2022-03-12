function createCanvas(width, height) {
  return Object.assign(document.createElement('canvas'), {
  	width: width * devicePixelRatio,
  	height: width * devicePixelRatio,
  	style: `width:${width};height:${height};`
  })
}

const worker = new Worker('gap.js', {type: 'module'})
const viewport = Int16Array.from([innerWidth, innerHeight, devicePixelRatio])
const canvas = document.body.appendChild(createCanvas(innerWidth, innerHeight))
const context = canvas.transferControlToOffscreen()
const dispatch = (entries, options) => worker.postMessage(entries, options)

{
	dispatch(['viewport', context, viewport], [context])
	dispatch(['keydown', 'hello world', 0], null)
	addEventListener('keydown', event => dispatch([event.type, event.key, event.keyCode], null))
}
