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
 * @param {number} width
 * @param {number} height
 */
function Buffer (size, x, y, width, height) {
	// cursor
	this.pre = 0
	this.post = 0

	// buffer
	this.size = (size|0)+10
	this.buff = new Uint8Array(this.size)

	// meta
	this.line = 1
	this.lines = 1
	this.column = 1
	this.length = 0

	// dimension
	this.width = width|0
	this.height = height|0

	// viewport
	this.x = x|0
	this.y = y|0

	// state
	this.state = {
		bytes: new Uint8Array(256),
		token: new Array(256)
	}

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
	ratio: -1,
	fontWidth: Math.round(13/1.666),
	fontSize: 13,
	lineHeight: 13*1.5,
	tabSize: 2,
	fontFamily: 'monospace',

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
	var lineHeight = y/this.lineHeight

	// reduce line distance
	while ((y = this.find(i, 10, -1)) < lineHeight);
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
		for (var i = 0, j = 0, l = string.length; i < l; i++)
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
	if (this.context !== null)
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

function hash () {
  var hash = 0
  var i = 0 
  var code = 0


  hash = ((hash << 5) - hash) + code;
  return hash |= 0; // convert to 32bit integer
}

function tokenize (previous, current, next, index, state) {
	return 1
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

	// units
	var lineHeight = this.lineHeight
	var fontWidth = this.fontWidth
	var tabSize = this.tabSize

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

	// viewport
	var height = this.height|0
	var width = this.width|0

	// scroll
	var i = 0
	var k = 0
	var x = this.x|0
	var y = this.y|0
	var z = 0

	// dimensions
	var w = 0
	var h = 0

	// meta
	var offset = 0
	var code = 0
	var index = 0

	// memory
	var state = this.state
	var token = state.token
	var chars = ''

	var start = performance.now()

	while (index < length && i < size && h <= height) {
		code = buff[i++]
			
		if ((code < 91 && code > 64) || (code < 123 && code > 96)) {
			chars += this.fromCharCode(code)
		} else {
			if (chars.length > 0) {
				token[index++] = chars
				chars = ''
			}

			if (code === 10) {
				if (k === 0) {
					z = h >= y ? (h = 0, k = 1, z = z > 0 ? z + 1 : z) : index
				}
				h += lineHeight
			}

			token[index++] = this.fromCharCode(code)
		}

		if (i === pre) {
			i = size-post
		}
	}

	// canvas
	context.canvas.width = width
	context.canvas.height = height
	context.font = this.fontSize+'px '+this.fontFamily
	context.textBaseline = 'top'

	length = index
	i = z
	h = 0
	w = 0

	while (i < length) {
		switch (chars = token[i++]) {
			case ' ':
			case '\t':
				w += fontWidth
				break
			case '\n':
				h += lineHeight
				w = 0
				break
			default:
				// non-viewport
				if (w > width)
					break

				switch (tokenize.call(state, index)) {
					case 0:
						break
				}

				context.fillText(chars, w, h)
				w += context.measureText(chars).width|0
		}
	}

	var end = performance.now()

	console.log((end-start), 'is the time it takes to tokenize + render ' +  this.lines+' lines')
}

/**
 * UintArray(length)
 * 
 * 00 - unknown
 * 
 * 01 - comment(block) multi-line comments like /* and <!-- 
 * 02 - comment(line) line comments
 *
 * 03 - invalid(illegal)
 * 04 - invalid(deprecated)
 *
 * 05 - string(quoted single) ''
 * 06 - string(quoted double) ""
 * 07 - string(quoted triple) """ """/``` ```/''' '''
 * 08 - string(quoted other)
 * 09 - string(unquoted)
 * 10 - string(interpolated) “evaluated” strings i.e ${a} in `${a}`
 * 11 - string(regex) regular expressions: /(\w+)/
 * 12 - string(other)
 *
 * 13 - constant(numeric) 0-9
 * 14 - constant(escape) represent characters, e.g. &lt;, \e, \031.
 * 15 - constant(language) special constants provided by the language i.e true, false, null
 * 16 - constant(other)
 *
 * 17 - variable(parameter)
 * 18 - variable(special) i.e this, super
 * 19 - variable(other)
 *
 * 20 - storage(type) class, function, int, var...
 * 21 - storage(modifier) static, final, abstract
 * 
 * 22 - support(function) functions provided by the framework/library
 * 23 - support(class) when the framework/library provides classes
 * 24 - support(type) types provided by the framework/library
 * 25 - support(constant) constants (magic values) provided by the framework/library
 * 26 - support(variable) variables provided by the framework/library
 * 27 - support(other)
 * 
 * 28 - keyword(control) mainly related to flow control like continue, while, return, etc
 * 29 - keyword(operator) operators can either be textual (e.g. or) or be characters
 * 30 - keyword(other) other keywords
 *
 * 031 - 060 namespace(hidden)
 * 061 - 090 namespace(underline)
 * 091 - 120 ?
 * 121 - 150 ?
 * 151 - 180 ?
 * 181 - 210 ?
 * 211 - 240 ?
 * 241 - 255 ?
 */

// demo`

// ${function () {
// 	class A {

// 	}
// 	return 1
// }}

// `

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
 * i.e -201 could represent varialbes but also displayed with a filled rect drawn behind it 
 * to represent a syntax error
 *
 * i.e -1
 *
 * using primitive data types like numbers makes this all very good for performance and memory
 *
 * there should also be a way to say merge the current token with the last token
 *
 * i.e word_something
 *
 * `word` `_` `something`
 *
 * when `_` is passed
 *
 * it say to merge it with the previous and or next token type
 *
 * this will make it `word_something`
 *
 * or `word_` depending on what the tokenizer wants
 *
 * this allow a generic primitive to support syntax tokenizers for non ALGOL languages that support
 * dash case i.e `word-something` tokens
 */
(function demo(){
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
}`
var input = ''
// 40,000 lines
while (i++<2000) {
	input += template.trim()+'\n\n';
}
	function body () {
		heap.insert(input)

		// insert ~40ms
		console.log('insert:', performance.now()-begin, 'ms')

		// // move ~15ms
		// begin = performance.now()
		// heap.move(-(heap.pre+heap.post))
		// console.log('move*:', performance.now()-begin, 'ms')

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
	var heap = new Buffer(input.length, 0, 0, window.innerWidth, window.innerHeight)
	// var heap = new Buffer(input.length, 0, (13*1.5), window.innerWidth, window.innerHeight)
	// var heap = new Buffer(input.length, 0, ((13*1.5)*2), window.innerWidth, window.innerHeight)
	// var heap = new Buffer(input.length, 0, ((13*1.5)*3), window.innerWidth, window.innerHeight)
	// var heap = new Buffer(input.length, 0, ((13*1.5)*4), window.innerWidth, window.innerHeight)
	// var heap = new Buffer(input.length, 0, ((13*1.5)*5), window.innerWidth, window.innerHeight)
	heap.context = context

	begin = performance.now()
	body()
	// setTimeout(function loop () {
		// heap.y+=2
		// heap.render()
		// setTimeout(loop, 1000)
	// }, 500)
	// heap.addEventListener('wheel')
})()
