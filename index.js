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

	// fill
	this.fill = new Array(size)

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
	push: push,
	expand: expand,
	select: select,
	copy: copy,
	find: find,
	peek: peek,

	// static
	block: Math.round(13/1.666),
	font: 13,
	tab: 2,
	family: 'monospace',

	// memory
	bytes: new Array(1000),
	bits: new Uint8Array(1000),
	data: new Uint8Array(1000),

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
 * peek
 *
 * @desc retrieve character index at coordinates {x, y} 
 * 
 * @param {Object} value
 * @return {number}
 */
function peek (value) {
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
 * push
 * 
 * @param {number} code
 * @param {number} length
 * @return {void}
 */
function push (code, length) {
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
			this.push(string.charCodeAt(i), 0)
	// single character
	else
		this.push(string.charCodeAt(0), 0)
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
				this.push(code = this.buff[this.pre--], 1)
			else
				break
		// pop
		else
			if (this.post > 0)
				this.push(code = this.buff[this.post--], 1)
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
	var tail = -1

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
		switch (code = buff[i === pre ? (i = size-post, i++) : i++]) {
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
						tail = head+1,
						head = index+1
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
	h = 0 - (j-d)
	
	// draw
	while (tail < head)
		// non-viewport
		if (w > width)
			break
		else
			context.fillText(token = bytes[tail++], w, h),
			w += context.measureText(token).width

	w = 0

	while (index < length)
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



var example = []

// v, a, r
// example[118] = []
// example[118][97] = []
// example[118][97][114] = []

function hash () {
  var hash = 0
  var i = 0 
  var code = 0


  hash = ((hash << 5) - hash) + code;
  return hash |= 0; // convert to 32bit integer
}

/**
 * tokenize
 *
 * @desc 
 * 		given a start index and length
 *   	create tokenized set of the data
 * 
 * ?
 * 
 * a - token
 * b - after operator: (, ), <, >, [, }, 
 * c - after string character ?
 *
 * optimization, only tokenize the delta
 * 
 * @param {number} idx
 * @param {number} len
 * @return {number}
 */
function tokenize (idx, len) {
	if (this.size > this.data.length)
		this.data = new Int8Array(size)

	var data = this.data

	var pre = this.pre
	var post = this.post
	var size = this.size

	var code = 0
	var i = idx|0
	var length = len|0

	while (length-- > 0) {
		code = data[i++]

		if (i === pre)
			i = post+1
	}
}

/**
 * notes for a fast tokenizer system
 *
 * 1. start position === dirty slot (slot where the old tokenized data has become obsolete)
 * 2. end position === clean slot (slot where old tokenized data is still valid)
 * 3. we then only ever tokenize the delta between 1 & 2
 * 
 * fill is a 1-1 set instructions of how to style the characters
 * when it is invalidated a tokenizations sweep is run to update the delta
 *
 * chars [v, a, r, , =, a]
 * codes [118, 97, 114, 32, 61, 32, 91]
 * style [100, 0, 0, 0, 0, 20, 0, 0, 10]
 *
 * psuedo
 *  draw `var ` - #100
 *  draw `=` #20
 *  draw `a` #10
 *
 * ------------------------------------
 * 
 * or maybe have a simple approach
 *
 * and let the different tokenizes implement their
 * own logic based on these primitives
 *
 * where tokenz are either
 *
 * 1. operatores: [^A-z0-9]
 * 2. words/letters: key frame new
 * 3. numbers 0-9
 * 
 * (
 * 		previousToken<string>, 
 * 		currentToken<string>, 
 * 		nextToken<string>, 
 * 		tokenIndex<number>, 
 * 		Uint8Array<255>
 * ): this = tokens[]
 *
 * for example
 *
 * foo.key
 * 
 * (NULL, 'foo', '.', 0)
 * ('foo', '.', 'key', 1)
 * ('.', 'key', NULL, 2)
 *
 * //
 *
 * (NULL, '/', '/')
 * ('/', '/', NULL)
 *
 * the tokenIndex allows you to look behind/head further at future/previous tokens
 * incase more context is required.
 *
 * The Uint8Array<255> can be used to store state between tokens
 *
 * i.e
 *
 * `Hello ${a}`
 *
 * (NULL, '`', 'H')
 *
 * ` char code is 96 so we can do the following when the 
 * first instance of ` appears
 *
 * Uint8Array[96] = 1
 *
 * then remove it with the second instance
 *
 * Uint8Array[96] = 0
 *
 * This allows us to tokenize tokens in strings/string literals
 *
 *
 * the return value of the tokenizer would be the type of the current token
 * this type will be an address between 0-50 increments that represents the tokens type
 *
 * this means that
 * 
 * 1-50 is equal to
 * 51-100 
 * 101-150 as is
 * 151-200 and
 * 201-250
 *
 * This allows us store meta an extra piece of meta data into one return value
 * by returning a value from a specific group that carries the same meaning
 *
 * i.e say 1 represents variables token
 * 
 * 51 would also represent variables tokens but also displayed with a strike over them
 * 101 would also represent variables but also displayed with an underline below them
 * 151 would also represent variables but also displayed with a stroked rect drawn around it
 * 201 would also represent varialbes but also displayed with a filled rect drawn behind it
 *
 * 0, 251-255 might represent special meta data
 *
 * we could also add a sign into the mix to represent 3 pieces of meta data
 * with the one value
 *
 * i.e -1
 *
 * using primitive data types like numbers makes this all very good for performance and memory
 */

/**
 *
 * general
 *
 * @desc
 * 		given a Int8Array with all the characters to render and meta data about how to render them, 
 * 		this function will paint the corrosponding image on a canvas of your choosing, fast
 *
 * @meta
 * 		fill code 	      
 * 			-1, -201
 * 		
 * 		meta info: 
 * 			-202, -254
 * 			
 * 			-202: draw stroke rect
 * 			-203: draw filled rect
 * 			-204: draw under line
 *    	-205: draw stroke
 * 
 * @param {number} idx
 * @param {number} len
 * @param {number} w
 * @param {number} h
 * @param {number} lineHeight
 * @param {number} xAxis
 * @param {number} yAxisg
 */
function general (idx, len, w, h, lineHeight, xAxis, yAxis) {
	var context = this.context
	var data = this.data
	var fill = this.fill

	var rgb = ''
	var set = ''

	var code = 0
	var i = idx|0
	var length = len|0

	var width = w|0
	var height = h|0
	var line = lineHeight|0
	var x = xAxis|0
	var y = yaxis|0

	while (y < height && i < length) {
		code = data[i++]

		// meta
		if (code < -0)
			// fill
			if (code > -202)
				context.fillStyle = (rgb = fill[~code+1], code = data[++i], rgb)
			// stroke/background/other
			if (code < 202 && code > -255)
				switch (code) {
					// stroke rect
					case -202:
					// fill rect
					case -203:
					// under line
					case -204:
					// stroke line 
					case -205:
				}

		switch (code) {
			// paint
			case -255:
				// boundary
				if (x < width)
					context.fillText(set, x, y),
					x += context.measureText(set).width|0
				set = ''
				break
			// newline
			case 10:
				y += line
				break
			// palette
			default:
				set += String.fromCharCode(code)
		}
	}
}

function tokenizeString (startIndex, dataSize, charCode, escadeCode, supportNewLine) {
	var data = this.data

	var i = startIndex|0
	var type = charCode|0
	var escape = escadeCode|0
	var exclude = supportNewLine|0
	var length = dataSize|0

	var code = 0
	var tail = 0

	while (i < length) {
		switch (tail = code, code = data[i++]) {
			case exclude:
				length = i
				break
			case type:
				if (tail !== escape)
					length = i
				break
		}
	}

	return i
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

	var heap = new Buffer(input.length, 0, (13*2)+9)
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
