var viewport = document.body
var canvas = document.getElementById('canvas')
var context = canvas.getContext('2d')
var canvasHeight = canvas.height = ((32*1000)+768)-1//viewport.offsetHeight
var canvasWidth = canvas.width = viewport.offsetWidth

/**
 * buffer
 *
 * gap buffer
 *
 * [1, 2, 3, _, 5] init
 *           
 * [1, 2, 3, 4, 5] inset
 *
 * [1, 2, 3, _, _] remove
 *
 * [1, 2, _, 3, 5] move
 *
 * [1, 2, 3, _, _, _, _, _, 5] alloc larger(2N) buffer
 * 
 * @param {number} size
 * @param {number} width
 * @param {number} height
 *
 * @todo explore a Unsigned Typed Array of character codes
 * which would the speed of operations that happen before rendering
 * though using String.fromCharCode() when rendering might increase
 * the speed of operations when rendering,
 * but rendering is constant time (N) where N is the # of characters that can fit
 * in on the visible screen
 */
function Buffer (size, width, height) {
	// cursor
	this.pre = 0
	this.post = 0

	// buffer
	this.size = (size|0)+10
	this.buff = new Uint8Array(this.size)

	// dimension
	this.width = width|0
	this.height = height|0

	this.line = 1
	this.lines = 1
	this.column = 1
	this.length = 0

	// viewport
	this.x = 0
	this.y = 0
	this.i = 0
	this.o = []

	// selection
	this.select = []

	// history
	this.history = []
	this.timeline = 0

	// context
	this.context = null
}

Buffer.prototype = {
	// methods
	move: move,
	step: step,
	jump: jump,
	insert: insert,
	remove: remove,
	fill: fill,
	expand: expand,
	select: select,
	copy: copy,
	render: render,
	setup: setup,
	find: find,
	seek: seek,

	toString: toString,
	fromCharCode: String.fromCharCode,

	// static
	block: Math.round(13/1.666),
	font: 13,
	tab: 2,
	family: 'monospace'
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
					this.lines++
				default:
					this.length++
			}

			break
		// remove
		case 1:
			switch (code) {
				case 10:
					this.lines--
				default:
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
 * @return {void}
 */
function remove (value) {
	// retrieve unsigned integer
	var length = value|0
	var index = length < 0 ? ~length+1 : length

	// visitor
	while (index-- > 0)
		// shift
		if (value < 0)
			if (this.pre > 0)
				this.fill(this.buff[this.pre--], 1)
			else
				break
		// pop
		else
			if (this.post > 0)
				this.fill(this.buff[this.post--], 1)
			else
				break
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
	// get selection maps, visit every selection and copy characters
	// in a buffer, then return string version i.e like save .join('')
}

/**
 * setup
 *
 * @param {Node} canvas
 * @param {CanvasRenderingContext2D} context
 */
function setup (canvas, context) {	
	canvas.width = this.width
	canvas.height = this.height
	canvas.style.cursor = 'text'
	context.font = this.font+'px '+this.family
}

function seek (h, v) {
	var x = h|0
	var y = v|0
	var i = this.i

	if (y > this.font)
		// go to line
		while ((y -= this.font) > 0) 
			i = this.find(i, 10)

	if (x > 0)
		while ((x -= this.context.measureText(String.fromCharCode(this.buff[i])).width) > 0)
			i++

	var line = this.line
	this.jump(i)

	console.log(String.fromCharCode(this.buff[i]))
}

/**
 * find
 *
 * @param {number} index
 * @param {number} value
 */
function find (index, value) {
	var i = index|0

	while (i < this.size)
		if (value|0 >= 0)
			switch (this.buff[i++]) {
				case value|0:
					return i
			}
		else
			switch (this.buff[i++]) {
				case ~value+1:
					return i
			}

	return i
}

/**
 * render
 * 
 * @param {number} xAxis
 * @param {number} yAxix
 * @return {void}
 *
 * @todo only render the parts that are visible
 *
 * 1. we could get to the visible area by calculating the delta
 *    coming from opposite ends(line by line) till we reach the middle –> x <–
 *    such that x <= visible viewport height at this paint we just paint the remaing lines
 *
 *    possible optimization could be added to start from the closest anchors from both sides
 *    if possible.
 *
 *    this assumes handling scrolling as well.
 *
 * 2. for the most part the same as 1. but instead of just grow the canvas as needed
 *    let the native runtime handle scroll, and only update the parts of visible viewport like 1.
 *
 * 3. potentially the fastest render method for small insert/delete ops be a 1-1 binding, 
 *     insert->draw insertion
 *     delete->create insertion
 *    but that involes alot of bookkeeping to do syntax highlighting in canvas
 *
 * 4. [current choice] do #1 except we already know the which character are visible in the viewport
 * 		so we render all of them +1 extra line on the top and one the bottom to buffer the scrolling intersaction 
 *
 * @todo
 *   draw from right->left, bottom->top
 *   allows for some optimizations in syntax highlighting and general rendering
 *
 * I think option 1. is the best modal for the most control and constant time rendering
 * proportortional to the dimensions of the visible viewport regardless of the size
 * of the file.
 *
 * The cursor will be draw at the gap
 * the cursor will render in a separate step
 * but we will update the position to draw the cursor
 * when after we render the world if the position is within the viewport
 * and the cursor will only render when it the gap is part of the viewport
 */
function render () {
	var context = this.context

	if (context === null)
		return

	this.setup(context.canvas, context)

	var buff = this.buff
	var pre = this.pre
	var post = this.post
	var size = this.size
	var length = this.length

	var line = this.line
	var lines = this.lines
	var column = this.column

	var font = this.font
	var block = this.block
	var tab = this.tab

	var height = this.height+font
	var width = this.width+block

	var i = this.i
	var h = font
	var w = 0
	var j = 0

	var offset = 1
	var code = 0
	var index = 0

	var token = ''
	var bytes = new Array((height/font|0)<<1)

	while (index < length && h < height && i < size)
		switch (code = buff[i === pre ? (i = size-post, i++) : i++]) {
			case 10:
				h += font
			case 32:
				if (token.length > 0)
					bytes[j++] = token

				bytes[j++] = String.fromCharCode(code)
				token = ''
				break
			default:
				token += String.fromCharCode(code)
		}

	length = j
	h = font
	i = 0

	while (i < length) {
		switch (token = bytes[i++]) {
			case '\n':
				h += font
				w = 0
				break
			default: 
				if (w > width)
					break

				context.fillText(token, w, h)
				w += context.measureText(token).width
		}
	}		
}

var stop = false;
var begin = 0;
var start = 0;

(function demo(){
	var input = ''
	var i = 0
	var template = `This is a stress test where every single line is being rendered with as much text, see console\n`

	while (i++<3000) {
		input += template;
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
		
		console.log('insert + move + render + save:', performance.now()-start, 'ms')
		console.log('')
		console.log('*move = moving from the very bottom to the top,')
		console.log(`stats:${heap.length} chars, ${heap.lines} lines`)
	}

	var heap = new Buffer(input.length, window.innerWidth, window.innerHeight)
	heap.context = context
	begin = start = performance.now()

	body()

	// requestAnimationFrame(function loop () {
		// heap.scroll(20)
		// heap.insert(input)
		
	canvas.addEventListener('mousedown', function (e) {
		heap.seek(e.x, e.y)
		heap.render()
	})

		// setTimeout(loop, 1000)
	// })
})()
