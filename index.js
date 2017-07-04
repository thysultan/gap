;(function () {
	'use strict'

	var viewport = document.body
	var canvas = document.getElementById('canvas')
	var context = canvas.getContext('2d')
	var canvasHeight = canvas.height = viewport.offsetHeight
	var canvasWidth = canvas.width = viewport.offsetWidth

	/**
	 * Grammer: UintArray(256)
	 *
	 * 00 - other(noop)
	 * 01 - other(whitespace(tab))
	 * 02 - other(whitespace(space))
	 * 03 - other(whitespace(newline))
	 *
	 * 10 - comment(other)
	 * 11 - comment(line) line comments
	 * 12 - comment(block) multi-line comments like /* and <!-- 
	 *
	 * 20 - invalid(other)
	 * 21 - invalid(illegal)
	 * 22 - invalid(deprecated)
	 *
	 * 30 - string(other)
	 * 31 - string(quoted single) ''
	 * 32 - string(quoted double) ""
	 * 33 - string(template) ``
	 * 34 - string(quoted triple) """ """/``` ```/''' '''
	 * 35 - string(unquoted)
	 * 36 - string(interpolated) “evaluated” strings i.e ${a} in `${a}`
	 * 37 - string(regex) regular expressions: /(\w+)/
	 *
	 * 40 - constant(other)
	 * 41 - constant(numeric) 0-9
	 * 42 - constant(escape) represent characters, e.g. &lt;, \e, \031.
	 * 43 - constant(language) special constants provided by the language i.e true, false, null
	 *
	 * 53 - variable(other)
	 * 51 - variable(parameter)
	 * 52 - variable(special) i.e this, super
	 *
	 * 60 - support(other)
	 * 61 - support(function) framework/library provided functions
	 * 62 - support(class) framework/library provides classes
	 * 63 - support(type) framework/library provided types
	 * 64 - support(constant) framework/library provided magic values
	 * 65 - support(variable) framework/library provided variables
	 *
	 * 70 - storage(other)
	 * 71 - storage(type) class, function, int, var, etc
	 * 72 - storage(modifier) static, final, abstract, etc
	 *
	 * 80 - keyword(other) other keywords
	 * 81 - keyword(control) flow control i.e continue, while, return, etc
	 * 82 - keyword(operator) textual/character operators
	 *
	 * 090 - 172 namespace(hidden) allows for code folding
	 * 172 - 254 namespace(underline) ?
	 *
	 * ...
	 */

	/**
	 * Buffer
	 *
	 * @desc text editor data-structure
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
		// gap
		this.pre = 0
		this.post = 0

		// buffer
		this.size = size|0
		this.buff = new Uint8Array(this.size)

		// stats
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
		this.i = 0

		// style
		this.caret = [0]
		this.style = new Uint8Array(0)
		this.syntax = 'text'

		// notes: undo/redo
		// 
		// @todo split this into immediate and timeline
		// immediate will store all immediate events
		// after some time this will them be remove from immediate
		// and moved to timeline which is grouped into sets
		// i.e when i type `sets` and click undo i don't want to step
		// back character by character by the who `sets` word
		// essentially this is a stack of generational data
		// once a certain generation the immediate history
		// state is moved and collected into a single history object
		// describing that type of action that happened in that generation
		// so we could say describe `sets`
		// into [insert s, insert e, insert t, insert s]
		// compact that into an array view using subarray
		// commit = history.subarray(start, end)
		// note subarray does not create a new array which is thus
		// very fast since it's just a view into a specific window of an array
		// 
		// to add to that will try to be as lazy as possible when it comes to storage
		// and only grow memory allocation when needed
		// this is why we start with an empty Uint8Array array
		// when we need more space grow into larger one, when we need more
		// bytes per element grow into a better representation, i.e Uint16Array->Uint32Array
		this.history = new Uint8Array(0)
		this.commit = 0

		// context
		this.context = null
	}

	Buffer.prototype = {
		// static
		fontWidth: Math.round(13/1.666),
		fontSize: 13,
		lineHeight: 13*1.5,
		tabSize: 2,
		fontFamily: 'monospace',

		// buffer
		forward: forward,
		backward: backward,
		move: move,
		find: find,
		jump: jump,
		push: push,
		pop: pop,
		insert: insert,
		remove: remove,
		expand: expand,
		toString: toString,
		toBytes: toBytes,
		fromCharCode: String.fromCharCode,

		// async
		write: write,
		read: read,

		// utilities
		select: select,
		copy: copy,
		peek: peek,

		// events
		handleEvent: handleEvent,
		addEventListener: addEventListener,

		// view
		tokenize: tokenize,
		render: render,
		scope: new Uint8Array(256),
		grammer: Object.create(null, {js: {value: javascriptGrammer}}),
		rule: {
			noop: 0,
			comment: {other: 10, line: 11, block: 12},
			invalid: {other: 20, illegal: 21, deprecated: 21},
			string: {other: 30, single: 31, double: 32, template: 33, triple: 34, unquoted: 35, interpolated: 36, regex: 37},
			constant: {other: 40, numeric: 41, escape: 42, language: 43},
			variable: {other: 50, parameter: 51, special: 52},
			support: {other: 60, function: 61, class: 62, type: 63, constant: 64, variable: 65},
			storage: {other: 70, type: 71, modifier: 72},
			keyword: {other: 80, control: 81, operator: 82}
		},

		// @todo, on idle time build cache of suggestion keywords
		state: {
			// lastTime: 0
			// lastLength: 0,
		}
	}

	/**
	 * forward
	 *
	 * @desc move cursor forward
	 * @private
	 * 
	 * @return {void}
	 */
	function forward () {
		if (this.post > 0)
			switch (this.buff[this.pre++] = this.buff[this.size-this.post--]) {
				case 10:
					this.line++
			}
	}

	/**
	 * backward
	 *
	 * @desc move cursor backward
	 * @private
	 * 
	 * @return {void}
	 */
	function backward () {
		if (this.pre > 0)
			switch (this.buff[this.size-(this.post++)-1] = this.buff[(this.pre--)-1]) {
				case 10:
					this.line--
			}
	}

	/**
	 * move
	 *
	 * @desc move cursor forward/backward by a specific length
	 * @public
	 * 
	 * @param {number} value
	 * @return {void}
	 */
	function move (value) {
		var length = value|0
		var index = length < 0 ? ~length+1 : length

		// forward
		if (length > 0)
			// visitor
			while (index-- > 0)
				this.forward()
		// backward
		else
			// visitor
			while (index-- > 0)
				this.backward()
	}

	/**
	 * jump
	 *
	 * @desc move the cursor to a specific index
	 * @public
	 * 
	 * @param {number} index
	 * @return {void}
	 */
	function jump (index) {
		this.move((index|0)-this.pre)
	}

	/**
	 * find
	 *
	 * @desc regular expression primitive
	 * @public
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
	 * push
	 *
	 * @desc insert a single character
	 * @private
	 * 
	 * @param {number} code
	 * @return {void}
	 */
	function push (code) {
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
	}

	/**
	 * pop
	 *
	 * @desc remove a single character
	 * @private
	 * 
	 * @param {number} code
	 * @return {void}
	 */
	function pop (code) {
		switch (code|0) {
			case 10:
				this.line--
				this.lines--
				this.column = 1
			default:
				this.column--
				this.length--
		}
	}

	/**
	 * insert
	 *
	 * @desc insert a single/multiple characters
	 * @public
	 * 
	 * @param {string} string
	 * @return {void}
	 */
	function insert (string) {
		// more than one character
		if (string.length > 0)
			for (var i = 0, j = 0, l = string.length; i < l; i++)
				this.push(string.charCodeAt(i))
		// single character
		else
			this.push(string.charCodeAt(0))
	}

	/**
	 * remove
	 *
	 * @desc remove a character from the position of the caret
	 * in either the forward/backward direction
	 * @public
	 * 
	 * @param {number} value
	 * @return {number}
	 */
	function remove (value) {
		var length = value|0
		var index = length < 0 ? ~length+1 : length
		var code = 0

		// visitor
		while (index-- > 0)
			// shift
			if (value < 0)
				if (this.pre > 0)
					this.pop(code = this.buff[this.pre--])
				else
					break
			// pop
			else
				if (this.post > 0)
					this.pop(code = this.buff[this.post--])
				else
					break

		return code
	}

	/**
	 * expand
	 *
	 * @desc allocate more memory
	 * @private
	 * 
	 * @return {void}
	 */
	function expand () {
		var size = (this.size+10)*2
		var buff = new Uint8Array(size)

		// copy leading characters
		for (var i = 0; i < this.pre; i++)
			buff[i] = this.buff[i]

		// copy tailing characters
		for (var i = 0; i < this.post; i++)
			buff[size-i-1] = this.buff[this.size-i-1]

		this.buff = buff
		this.size = size
	}

	/**
	 * toString
	 *
	 * @desc returns buffer as string
	 * @public
	 *
	 * @return {string}
	 */
	function toString () {
		var index = 0
		var output = ''

		// leading characters
		if (this.pre > 0)
			// visitor
			while (index < this.pre)
				output += this.fromCharCode(this.buff[index++])

		// tailing characters
		if (this.post > 0 && (index = this.size-this.post) > 0)
			// visitor
			while (index < this.size)
				output += this.fromCharCode(this.buff[index++])

		return output
	}

	/**
	 * toBytes
	 *
	 * @desc return continues uint8[] of character codes
	 * @public
	 *
	 * @return {Uint8Array}
	 */
	function toBytes () {
		var index = 0
		var output = new Uint8Array(this.length)

		if (this.pre > 0)
			output.set(this.buff.subarray(0, this.pre))
		
		if (this.post > 0)
			output.set(this.buff.subarray(this.size-this.post))

		return output
	}

	/**
	 * write
	 *
	 * @desc write a buffer of bytes into the buffer asynchronous-ly
	 * @public
	 * 
	 * @param {Readable} stream
	 * @param {Promise}
	 */
	function write (stream) {
		return new Promise(function (resolve, reject) {
			// @todo read stream buffer as raw uint8 bytes
			resolve()
		})
	}

	/**
	 * read
	 *
	 * @desc read from the buffer as a Readable stream
	 * @public
	 * 
	 * @return {Stream}
	 */
	function read () {
		// @todo Readable stream
	}

	/**
	 * peek
	 *
	 * @desc retrieve character index at coordinates {x, y} 
	 * @todo ... figure out what this should do?
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

	/**
	 * addEventListener
	 *
	 * @desc add event listerner
	 *
	 * @param handler
	 * @return {void}
	 */
	function addEventListener (handler) {
		if (this.context !== null)
			// @todo add to one pool of event->handler
			this.context.canvas.addEventListener('mousewheel', this, {passive: true})
	}

	/**
	 * select
	 *
	 * @desc select
	 * 
	 * @param {number} index
	 * @param {number} length
	 * @return {void}
	 */
	function select (index, length) {
		// @todo
	}

	/**
	 * copy
	 *
	 * @desc copy selection/line
	 * 
	 * @return {string}
	 */
	function copy () {
		// @todo copy line
		if (select.length === 0)
			return ''
		// @todo ...
	}

	/**
	 * cut
	 *
	 * @desc cut selection/line
	 * 
	 * @return {string}
	 */
	function cut () {
		// this.copy()
		// this.remove() all copied characters	
	}

	/**
	 * javascriptGrammer Example
	 *
	 * @todo add unlimited lookbehind feature
	 * 
	 * @param {number} currentChar
	 * @param {number} previousChar
	 * @param {number} currentToken
	 * @param {number} previousToken
	 * @param {number} currentIndex
	 * @param {Uint8Array} stylePool
	 * @param {Uint8Array(256)} scopePool
	 * @param {Object} grammer
	 * @param {Object} rule
	 * @return {number}
	 */
	function javascriptGrammer (
		currentChar, 
		previousChar, 
		currentToken, 
		previousToken, 
		currentIndex, 
		stylePool,
		scopePool,
		grammer,
		rule
	) {
		switch (currentChar) {
			// quotes
			case 34:
			case 39:
			case 96:
				switch (scopePool[currentChar]) {
					case 0:
						switch(scopePool[currentChar]++) {
							case 34: return rule.string.single
							case 39: return rule.string.double
							case 96: return rule.string.single
						}
					break
				default:
					return scopePool[currentChar]--, rule.keyword.other
				}
				break
			// operators
			case 33:
			case 40:
			case 41:
			case 43:
			case 45:
			case 46:
			case 58:
			case 62:
			case 91:
			case 93:
			case 123:
			case 125:
				if (scopePool[34] + scopePool[39] + scopePool[96] === 0) {
					return rule.keyword.operator
				}
				break			
			// *
			case 42:
				// comment(block)
				switch (previousChar) {
					case 47:
						return rule.comment.block
				}
				break
			// /
			case 47:
				switch (previousChar) {
					// /
					case 47:
						switch (currentToken) {
							// comment(line)
							case rule.keyword.other:
								return rule.comment.line;						
						}
				}
				break
		}

		switch (currentToken) {
			// terminate comment(line)
			case rule.comment.line:
				if (currentChar === 10)
				switch (currentChar) {
					case 10:
						return rule.keyword.other
				}
				break
			// terminate comment(block)
			case rule.comment.block:
				switch (currentChar<<previousChar) {
					case 48128:
						return rule.keyword.other
				}
				break
		}

		return currentToken
	}

	/**
	 * tokenize
	 *
	 * @desc tokenize characters
	 * 
	 * @return {void}
	 */
	function tokenize () {
		// data
		var buff = this.buff
		var pre = this.pre
		var post = this.post
		var size = this.size
		var length = this.length

		// viewport
		var steps = this.lineHeight
		var limit = this.height
		var height = 0

		// memory
		var style = this.style
		var scope = this.scope
		var rule = this.rule
		var grammer = this.grammer
		var language = grammer[this.syntax]

		// character
		var head = 0	
		var tail = 0

		// tokens
		var prev = 0
		var next = 0
		var token = style[this.i]

		scope.fill(0)

		if (length > style.length)
			style = new Uint8Array((length+10)*2),
			style.set(this.style)

		visitor: for (var index = 0, caret = 0; index < length; index++) {
			tail = head
			head = buff[caret++]
			
			switch (head) {
				case 10:
					height += steps

					// this is an optimizations, when we are > height of viewport
					// we bail out, it's commented out because of the stress test
					// if (height > limit)
						// break visitor
			}

			next = language(head, tail, token, prev, index, style, scope, grammer, rule)
			prev = token
			token = next
			style[index] = token

			switch (caret) {
				case pre:
					caret = size-post
			}
		}

		this.style = style

		return index

		// notes:
		// 
		// the tozenizer should consistantly at most take ~4ms
		// the renderer will pick up from here and start
		// drawing the to the screen from bottom up uptil it reaches the hight of the screen
		// this should consistantly take at most ~4ms
		// which means we have 8ms more left to do any other work
		// 
		// the render piple line would resemble
		// 
		// X -> tokenize() -> render()
		// 
		// where X is any operation that changes the state of what is displayed on the screen
		// for example
		// 
		// 1. event(scroll) -> X
		// 2. event(keydown) -> insert()/remove() -> X
		// 
		// It look like alot of work since even the smallest change(scrolling) causes a re-render
		// but since we can archive the tokenize() -> render() phase in < 6ms
		// we have alot of time(10ms) on our hands for off-screen ops before this
	}

	/**
	 * render
	 *
	 * @desc render visible viewport
	 *
	 * @todo use new defined grammer for new render
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

		return;

		// var start = performance.now()

		while (index < length && i < size) { //  && h <= height
			code = buff[i++]
				
			if ((code < 91 && code > 64) || (code < 123 && code > 96)) {
				chars += this.fromCharCode(code)
			} else {
				// if (chars.length > 0) {
			// 		token[index++] = chars
			// 		chars = ''
				// }

				if (code === 10) {
					if (k === 0) {
						z = h >= y ? (h = 0, k = 1, z = z > 0 ? z + 1 : z) : index
					}
					h += lineHeight
				}

			// 	token[index++] = this.fromCharCode(code)
			}

			if (i === pre) {
				i = size-post
			}
		}

		// console.log(z, i, this.pre)

		return;

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

	;(function demo(){
		var i = 0
		var begin = 0;
		// ~20 lines
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
	}`.trim()
	var input = ''
	while (i++<(6000*2)) {
	// while (i++<(3000*2)) {
	// while (i++<1) {
		input += template+'\n';
	}
		function body () {
			heap.insert(input)

			// insert(document): cold
			console.log('insert(cold):', performance.now()-begin, 'ms')

			// move(document): cold
			begin = performance.now()
			heap.move(-(heap.pre+heap.post))
			console.log('move(cold):', performance.now()-begin, 'ms')

			// warmup
			heap.move(-(heap.pre+heap.post))
			heap.move((heap.pre+heap.post))
			heap.move(-(heap.pre+heap.post))
			heap.move((heap.pre+heap.post))
			heap.move(-(heap.pre+heap.post))

			// move(document): warm
			begin = performance.now()
			heap.move(-(heap.pre+heap.post))
			console.log('move(warm):', performance.now()-begin, 'ms')


			console.log('')
						console.log('note: above operations traverse the whole document')
						console.log('')
			// tokenize: cold
			begin = performance.now()
			heap.tokenize()
			console.log('tokenize(cold):', performance.now()-begin, 'ms')

			// warmup
			heap.tokenize()
			heap.tokenize()
			heap.tokenize()
			heap.tokenize()
			heap.tokenize()

			// tokenize: warm
			begin = performance.now()
			heap.tokenize()
			console.log('tokenize(warm):', performance.now()-begin, 'ms')

			console.log('')

			// render
			// begin = performance.now()
			// heap.render()
			// console.log('render:', performance.now()-begin, 'ms')

			// save the whole document
			begin = performance.now();
			var output = heap.toString();
			console.log('save(string):', performance.now()-begin, 'ms')
				
			// save the whole document with a stream buffer
			begin = performance.now();
			var output = heap.toBytes();		
			console.log('save(stream):', performance.now()-begin, 'ms')

			console.log('')
			console.log('note: all the above operate on the entire document\nwith no specific viewport optimization.')

			console.log('')
			console.log(`document stats: ${heap.length} chars, ${heap.lines} lines, ~${heap.length*1e-6} MB`)
		}

		var heap = new Buffer(1, 0, 0, window.innerWidth, window.innerHeight)
		// var heap = new Buffer(input.length, 0, (13*1.5), window.innerWidth, window.innerHeight)
		// var heap = new Buffer(input.length, 0, ((13*1.5)*2), window.innerWidth, window.innerHeight)
		// var heap = new Buffer(input.length, 0, ((13*1.5)*3), window.innerWidth, window.innerHeight)
		// var heap = new Buffer(input.length, 0, ((13*1.5)*4), window.innerWidth, window.innerHeight)
		// var heap = new Buffer(input.length, 0, ((13*1.5)*5), window.innerWidth, window.innerHeight)

		heap.context = context
		heap.syntax = 'js'

		begin = performance.now()

		console.log('note: this is a stress test')
		console.log('')

		body()

		// setTimeout(function loop () {
			// heap.y+=2
			// heap.render()
			// setTimeout(loop, 1000)
		// }, 500)
		// heap.addEventListener('wheel')
	})()
})();
