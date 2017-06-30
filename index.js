var viewport = document.body
var canvas = document.getElementById('canvas')
var context = canvas.getContext('2d')
var canvasHeight = canvas.height = ((32*1000)+768)-1//viewport.offsetHeight
var canvasWidth = canvas.width = viewport.offsetWidth

/**
 * buffer
 *
 * @desc
 *
 * 	[1, 2, 3, _, 5] init
 *  [1, 2, 3, 4, 5] inset
 * 	[1, 2, 3, _, _] remove
 * 	[1, 2, _, 3, 5] move
 *  [1, 2, 3, _, _, _, _, _, 5] alloc larger(2N) buffer
 * 
 * @param {number} size
 * @param {number} x
 * @param {number} y
 */
function Buffer (size, x, y) {
	// cursor
	this.pre = 0
	this.post = 0

	// buffer
	this.size = (size|0)+100
	this.buff = new Uint8Array(this.size)

	// dimension
	this.width = 0
	this.height = 0

	// meta
	this.line = 1
	this.lines = 1
	this.column = 1
	this.length = 0

	// viewport
	this.x = x|0
	this.y = y|0

	// selection
	this.select = []

	// history
	this.history = []

	// context
	this.context = null
}

Buffer.prototype = {
	// method
	move: move,
	step: step,
	jump: jump,
	insert: insert,
	remove: remove,
	fill: fill,
	expand: expand,
	select: select,
	copy: copy,
	find: find,
	peak: peak,

	// static
	block: Math.round(13/1.666),
	font: 13,
	tab: 2,
	family: 'monospace',

	// memory
	bytes: new Array(1000),
	bits: new Uint8Array(1000),

	// paint
	render: render,

	// utilities
	toString: toString,
	fromCharCode: String.fromCharCode,

	// event
	handleEvent: handleEvent,
	addEventListener: addEventListener
}

/**
 * step
 * 
 * @param {number} value
 * @return {void}
 */
function step (value) {
	switch (value|0) {
		// forward
		case 0:
			if (this.post > 0)
				switch (this.buff[this.pre++] = this.buff[this.size-this.post--]) {
					case 10:
						this.line++
				}
			break
		// backward
		case 1:
			if (this.pre > 0)
				switch (this.buff[this.size-(this.post++)-1] = this.buff[(this.pre--)-1]) {
					case 10:
						this.line--
				}
	}
}

/**
 * move
 * 
 * @param {number} value
 * @return {void}
 */
function move (value) {
	// retrieve unsigned integer
	var length = value|0
	var index = length < 0 ? ~length+1 : length

	// forward
	if (length > 0)
		// visitor
		while (index-- > 0)
			this.step(0)
	// backward
	else
		// visitor
		while (index-- > 0)
			this.step(1)
}

/**
 * peak
 *
 * @desc retrieve character index at coordinates {x, y} 
 * 
 * @param {Object} value
 * @return {number}
 */
function peak (value) {
	var x = value.x|0
	var y = value.y|0
	var i = 0
	var line = y/this.font
	var block = this.block

	// reduce line distance
	while ((y = this.find(i, 10, -1)) < line);
		i = y

	// reduce column distance
	while ((x -= this.context.measureText(this.fromCharCode(this.buff[i])).width) > 0)
		i++

	return i
}

/**
 * find
 *
 * @desc regular expressions primitive
 * 
 * @param {number} index
 * @param {number} value
 * @param {number} length
 */
function find (index, value, length) {
	var i = index|0
	var x = length < 0 ? this.size : length|0

	if (value|0 > -1)
		while (i < this.size && x-- > 0)
			switch (this.buff[i++]) {
				case value|0:
					return i
			}
	else
		return ++i

	return -1
}

/**
 * jump
 * 
 * @param {number} index
 * @return {void}
 */
function jump (index) {
	this.move(index|0-this.pre)
}

/**
 * fill
 * 
 * @param {number} code
 * @param {number} length
 * @return {void}
 */
function fill (code, length) {
	switch (length|0) {
		// insert
		case 0: 
			// not enough space?
			if (this.pre + this.post === this.size)
				this.expand()

			// push
			switch (this.buff[this.pre++] = code) {
				case 10:
					this.line++
					this.lines++
					this.column = 1
				default:
					this.column++
					this.length++
			}

			break
		// remove
		case 1:
			switch (code) {
				case 10:
					this.line--
					this.lines--
					this.column = 1
				default:
					this.column--
					this.length--
			}

			break
	}
}

/**
 * insert
 * 
 * @param {string} string
 * @return {void}
 */
function insert (string) {
	// more than one character
	if (string.length > 0)
		// fill in each character
		for (var i = 0; i < string.length; i++)
			this.fill(string.charCodeAt(i), 0)
	// single character
	else
		this.fill(string.charCodeAt(0), 0)
}

/**
 * remove
 * 
 * @param {number} value
 * @return {number}
 */
function remove (value) {
	// retrieve unsigned integer
	var length = value|0
	var index = length < 0 ? ~length+1 : length
	var code = 0

	// visitor
	while (index-- > 0)
		// shift
		if (value < 0)
			if (this.pre > 0)
				this.fill(code = this.buff[this.pre--], 1)
			else
				break
		// pop
		else
			if (this.post > 0)
				this.fill(code = this.buff[this.post--], 1)
			else
				break

	return code
}

/**
 * expand
 * 
 * @return {void}
 */
function expand () {
	// exponatially grow, avoids frequent expansions
	var size = this.size*2
	var buff = new Uint8Array(size)

	// leading characters
	for (var i = 0; i < this.pre; i++)
		buff[i] = this.buff[i]

	// tailing characters
	for (var i = 0; i < this.post; i++)
		buff[size-i-1] = this.buff[this.size-i-1]

	this.buff = buff
	this.size = size
}

/**
 * toString
 *
 * @param {number} i
 * @param {number} value
 * @return {string}
 */
function toString (i, value) {
	// retrieve integer
	var length = typeof value === 'number' ? value|0 : this.length
	var index = i|0

	// setup destination buffer
	var output = ''

	// leading characters
	if (this.pre > 0)
		// visitor
		while (index < this.pre)
			// within range
			if (length > 0)
				output += this.fromCharCode(this.buff[(length--, index++)])
			// out of range
			else
				break

	// tailing characters
	if (this.post > 0 && (index = this.size-this.post) > 0)
		// visitor
		while (index < this.size)
			// within range
			if (length > 0)
				output += this.fromCharCode(this.buff[(length--, index++)])
			else
			// out of range
				break

	return output
}

/**
 * render
 * 
 * @return {void}
 */
function render () {
	var context = this.context

	if (context === null)
		return

	// canvas
	context.canvas.width = this.width = window.innerWidth
	context.canvas.height = this.height = window.innerHeight
	context.font = this.font+'px '+this.family

	// data
	var buff = this.buff
	var pre = this.pre
	var post = this.post
	var size = this.size
	var length = this.length

	// stats
	var line = this.line
	var lines = this.lines
	var column = this.column

	// units
	var font = this.font
	var block = this.block
	var tab = this.tab

	// bounds
	var height = this.height+font
	var width = this.width+block

	// meta
	var offset = 0
	var code = 0
	var index = 0
	var head = 0
	var tail = 0

	// memory
	var token = ''
	var bytes = this.bytes
	var bits = this.bits

	// viewport
	var j = this.y|0
	var d = j%block
	var x = this.x
	var y = d > 0 ? j - d : j

	var z = -1
	var i = 0

	// dimensions
	var w = 0
	var h = 0

	// tokenize(naive)
	// 
	// super tokenize
	// 
	// i.e tokenize var
	// 
	// tokens {
	// 	v: [v, a, r] // in character codes
	// }
	// 
	// token = tokens[currentCode]
	// 
	// if (token !== undefined)
	// 	index = 0
	// 	
	// 	outer: while (i < token.length-1)
	// 		switch (value = (token[index++])
	// 			case char++:
	// 			default: break outer
	// 
	// if (char++ === operator)
	// 	fill = tokens[char+1]
	// else
	// 	travel to next
	// 	
	// in this case
	// and syntax highlighter can be added by supplying a 
	// Uint8Array or maybe an object
	// 
	// with a map of `
	// first chararacter code: [
	// 	array of other character codes in keyword,
	// 	last character is the color code
	// ]`
	// 
	// then we can just iterate over all the matching characters
	// untill we reach the end of the map-1 if if find a false positve
	// bail out and move on to the next token(non-operator) index
	// if there are no false positives then the last is the fill
	// that the token should be filled with.
	// 
	// this will be both very fast and very extendable. 
	// 
	while (index < length && i < size && h < height)
		switch (tail = code, code = buff[i === pre ? (i = size-post, i++) : i++]) {
			// newline
			case 10:
				h += font
				// viewport head
				if (z < 0)
					if (h >= y)
						z = y, 
						d = h,
						h = font
					else
						head = index
			// tabs
			case 9:
			// space
			case 32:
				// push previous token
				if (token.length > 0)
					// if (tail === code)
						// token += this.fromCharCode(code)
					// else
						bytes[index++] = token

				// push newline token
				// if (tail !== code)
					bytes[index++] = this.fromCharCode((token = '', code))
				break
			// unknown
			default:
				// switch (tail) {
					// case 9:
					// case 10:
					// case 32:
						// if (token.length > 0)
							// bytes[index++] = token
							// token = ''
				// }

				token += this.fromCharCode(code)
		}

	// push tail token
	if (token.length > 0)
		bytes[index++] = token

	length = index
	index = head
	
	w = 0
	h = 0 - (j-d)

	// draw
	while (index < length) {
		switch (token = bytes[index++]) {
			case '\n':
				h += font
				w = 0
				break
			default:
				// non-viewport
				if (w > width)
					break

				context.fillText(token, w, h)
				w += context.measureText(token).width
		}
	}		
}

function handleEvent (e) {
	switch (e.type) {
		case 'wheel': {	
			// console.log(
			// 	'offset', e.offsetX, e.offsetY, 
			// 	'page', e.pageX, e.pageY, 
			// 	'screen', e.screenX, e.screenY, 
			// 	'wheelDelta', e.wheelDeltaX, e.wheelDeltaY, e.wheelDelta,
			// 	'x,y', e.x, e.y, 
			// 	'movement', e.movementX, e.movementY,
			// 	'client', e.clientX, e.clientY,
			// 	'layer', e.layerX, e.layerY
			// )
		}
	}
}

function addEventListener () {
	this.context.canvas.addEventListener('mousewheel', this, {passive: true})
}


/**
 * select
 *
 * @param {number} x1
 * @param {number} x2
 * @param {number} y1
 * @param {number} y2
 * @return {void}
 */
function select (x1, y1, x2, y2) {
	// select coordinates
	if (x1|0 !== x2|0)
		0
	// unselect coordinates
	else
		0
}

/**
 * copy
 * 
 * @return {string}
 */
function copy () {
	var select = this.select

	// @todo copy line
	if (select.length === 0)
		return ''
}

/**
 * cut
 * 
 * @return {string}
 */
function cut () {
	var select = this.select

	// @todo cut line
	if (select.length === 0)
		return ''
}






















(function demo(){
	var input = ''
	var i = 0
	var begin = 0;
	var template = `
/**
 * step
 * 
 * @param {number} value
 * @return {void}
 */
function step (value) {
	switch (value|0) {
		// forward
		case 0:
			if (this.post > 0)
				switch (this.buff[this.pre++] = this.buff[this.size-this.post--]) {
					case 10:
						this.line++
				}
			break
		// backward
		case 1:
			if (this.pre > 0)
				switch (this.buff[this.size-(this.post++)-1] = this.buff[(this.pre--)-1]) {
					case 10:
						this.line--
				}
	}
}
`

	while (i++<2000) {
		input += template.trim()+'\n\n';
	}

	function body () {
		heap.insert(input)

		// insert ~40ms
		console.log('insert:', performance.now()-begin, 'ms')

		// // move ~15ms
		begin = performance.now()
		heap.move(-(heap.pre+heap.post))
		console.log('move*:', performance.now()-begin, 'ms')

		// // render ~10ms
		begin = performance.now()
		heap.render()
		console.log('render:', performance.now()-begin, 'ms')

		// save ~ms
		begin = performance.now()
		heap.toString()
		console.log('save:', performance.now()-begin, 'ms')
		
		console.log('')
		console.log(`stats: ${heap.length} chars, ${heap.lines} lines`)
	}

	var heap = new Buffer(input.length, 0, (13*2)+2)
	heap.context = context

	begin = performance.now()
	body()

	setTimeout(function loop () {
		// heap.y+=2
		// heap.render()
		// setTimeout(loop, 1000)
	}, 500)

	heap.addEventListener('wheel')
})()
