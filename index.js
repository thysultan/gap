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
	 * 12 - comment(block) multi-line comments i.e /* and <!-- 
	 *
	 * 20 - invalid(other)
	 * 21 - invalid(illegal)
	 * 22 - invalid(deprecated)
	 * 23 - invalid(syntax)
	 *
	 * 30 - string(other)
	 * 31 - string(quoted single) ''
	 * 32 - string(quoted double) ""
	 * 33 - string(quoted template) ``
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
	 * 090 - 172 namespace(hidden) i.e code folding
	 * 172 - 254 namespace(underline) i.e matching characters
	 *
	 * ...
	 */
	
	var grammer = {
		noop: 0,
		comment: {other: 10, line: 11, block: 12},
		invalid: {other: 20, illegal: 21, deprecated: 22, syntax: 23},
		string: {other: 30, single: 31, double: 32, template: 33, triple: 34, unquoted: 35, interpolated: 36, regex: 37},
		constant: {other: 40, numeric: 41, escape: 42, language: 43},
		variable: {other: 50, parameter: 51, special: 52},
		support: {other: 60, function: 61, class: 62, type: 63, constant: 64, variable: 65},
		storage: {other: 70, type: 71, modifier: 72},
		keyword: {other: 80, control: 81, operator: 82},
	};

	/**
	 * Gap
	 *
	 * @desc data-structure
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
	function Gap (size, x, y, width, height) {
		// gap
		this.pre = 0
		this.post = 0

		// buffer
		this.size = size === 0 ? 1 : size|0
		this.data = new Uint8Array(this.size)

		// dimension
		this.width = width|0
		this.height = height|0

		// canvas
		this.context = null
		
		// viewport
		this.x = x|0
		this.y = y|0

		// offset
		this.index = 0
		this.offset = 0

		// stats
		this.line = 1
		this.lines = 1
		this.column = 1
		this.length = 0
			
		// syntax
		this.syntax = noop
		this.theme = 'default-theme'
		this.state = [0]
	
		/* 
			notes: undo/redo
			
			@todo split this into immediate and timeline
			immediate will store all immediate events
			after some time this will them be remove from immediate
			and moved to timeline which is grouped into sets
			i.e when i type `sets` and click undo i don't want to step
			back character by character by the who `sets` word
			essentially this is a stack of generational data
			once a certain generation the immediate history
			state is moved and collected into a single history object
			describing that type of action that happened in that generation
			so we could say describe `sets`
			into [insert s, insert e, insert t, insert s]
			compact that into an array view using subarray
			commit = history.subarray(start, end)
			note subarray does not create a new array which is thus
			very fast since it's just a view into a specific window of an array
			
			to add to that will try to be as lazy as possible when it comes to storage
			and only grow memory allocation when needed
			this is why we start with an empty Uint8Array array
			when we need more space grow into larger one, when we need more
			bytes per element grow into a better representation, i.e Uint16Array->Uint32Array
		*/
		
		// history is a (method, argument) pair represented as a uint8 
		// this.history = new Uint8Array(0)

		// branches are a (index, length) pair represented as a uint8
		// used to represented a pair of actions in history
		// this.branch = new Uint8Array(0)

		// current branch index
		// this.commit = 0
	}

	/**
	 * Gap prototype
	 *
	 * @type {Object}
	 */
	Gap.prototype = {
		// static
		fontWidth: Math.round(13/1.666),
		fontSize: 13,
		lineHeight: (13*1.5)|0,
		tabSize: 2,
		fontFamily: 'monospace',

		// buffer
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
		write: write,
		read: read,
		set: set,
		use: use,
		fromCharCode: String.fromCharCode,
		charCodeAt: charCodeAt,
		charAt: charAt,

		select: select,
		copy: copy,
		peek: peek,

		// events
		handleEvent: handleEvent,
		addEventListener: addEventListener,

		// view
		tokenize: tokenize,
		render: render,
		anchor: anchor,

		// grammer
		grammer: grammer,
		scope: 0,

		// extensions
		package: {
			'default-theme': theme({
				comment: {
					other: 'gray'
				},
				string: {
					other: 'green',
					double: 'green'
				},
				keyword: {
					other: 'black',
					operator: 'red'
				},
				constant: {
					other: 'purple',
					numeric: 'blue'
				}
			})
		}
	}

	/**
	 * Gap utilities
	 * 
	 * @type {function}
	 */
	Gap.from = from
	Gap.theme = theme

	/**
	 * theme
	 *
	 * @desc creates a theme
	 * 
	 * @param {Object} style
	 * @return {Array<string>}
	 */
	function theme (style) {
		var output = []

		for (var key in style) {
			if (typeof grammer[key] !== 'object')
				continue

			var props = style[key]

			for (var name in props) {
				output[grammer[key][name]] = props[name]  
			}
		}

		return output
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

		var pre = this.pre
		var post = this.post
		var size = this.size
		var data = this.data

		// forward
		if (length > 0)
			// visitor
			while (index-- > 0)
				if (post > 0)
					data[pre++] = data[size-post--]
				else
					break
		// backward
		else
			// visitor
			while (index-- > 0)
				if (pre > 0)
					data[size-(post++)-1] = data[(pre--)-1]
				else
					break

		this.pre = pre
		this.post = post
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
		var pre = this.pre
		var post = this.post
		var size = this.size
		var data = this.data

		var i = index < 0 ? 0 : index|0
		var needle = value|0
		var haystack = length|0

		// forward
		if (haystack > 0)
			while (i < size && haystack-- > 0) {
				if (i === pre)
					i = size-post

				if (data[i++] === needle) 
					return i
			}
		// backward
		else 
			while (i > 0 && haystack++ < 0) {
				if (i === size-post)
					i = pre

				if (data[i--] === needle) 
					return i
			}

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
		switch (this.data[this.pre++] = code) {
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
			for (var i = 0; i < string.length; i++)
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

		var pre = this.pre
		var post = this.post
		var data = this.data

		// shift
		if (value < 0)
			while (index-- > 0)
				if (pre > 0)
					this.pop(code = data[pre--])
				else
					break
		// pop
		else
			while (index-- > 0)
				if (post > 0)
					this.pop(code = data[post--])
				else
					break

		this.pre = pre
		this.post = post

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
		var pre = this.pre
		var post = this.post
		var size = this.size
		var data = this.data

		var dble = (size+10)<<1
		var next = new Uint8Array(dble)

		// copy leading characters
		for (var i = 0; i < pre; i++)
			next[i] = data[i]

		// copy tailing characters
		for (var i = 0; i < post; i++)
			next[dble-i-1] = data[size-i-1]

		this.pre = pre
		this.post = post
		this.size = dble
		this.data = next
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

		var pre = this.pre
		var post = this.post
		var size = this.size
		var data = this.data

		// leading characters
		if (pre > 0)
			// visitor
			while (index < pre)
				output += this.fromCharCode(data[index++])

		// tailing characters
		if (post > 0 && (index = size-post) > 0)
			// visitor
			while (index < size)
				output += this.fromCharCode(data[index++])

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

		var pre = this.pre
		var post = this.post
		var size = this.size
		var data = this.data

		if (pre > 0)
			output.set(data.subarray(0, pre))
		
		if (post > 0)
			output.set(data.subarray(size-post))

		return output
	}

	/**
	 * charCodeAt
	 * 
	 * @param {number} value
	 * @return {number}
	 */
	function charCodeAt (value) {		
		var pre = this.pre
		var post = this.post
		var size = this.size
		var data = this.data
		var index = value|0

		if (pre === 0)
			return data[(size-1-post)+index]
		if (post === 0)
			return index < pre ? data[index] : NaN

		return data[(size-1-post-pre)+index]
	}

	/**
	 * charAt
	 * 
	 * @param {number} value
	 * @return {string}
	 */
	function charAt (value) {
		return this.fromCharCode(this.charCodeAt(value))
	}

	/**
	 * use
	 * 
	 * @param {string} name 
	 * @param {*} value
	 * @return {*}
	 */
	function use (name, value) {
		return this.package[name] = value
	}

	/**
	 * set
	 * 
	 * @param {string} name
	 * @param {*} value
	 */
	function set (name, value) {
		if (typeof name === 'object')
			for (var key in name)
				this.set(key, name[key])
		else
			switch (name) {
				case 'syntax':
					return this.syntax = value || this.syntax
				case 'theme':
					return this.theme = value || this.theme
				case 'context':
					return this.context = value || this.context
			}
	}

	/**
	 * noop
	 * 
	 * @return {number}
	 */
	function noop () {
		return this.noop
	}

	/**
	 * from
	 *
	 * @param {*} value
	 * @return {Gap}
	 */
	function from (value) {
		var varient

		if (value === null || value === void 0)
			return new Gap(0, 0, 0, 0, 0)
		else if (value instanceof this) {
			varient = new value.constructor(value.size, value.x, value.y, value.width, value.height)

			varient.data.set(this.data)

			varient.syntax = value.syntax
			varient.theme = value.theme
			varient.language = value.language

			return varient
		} else
			switch (value.constructor) {
				case String:
					return varient = new Gap(value.length, 0, 0, 0, 0), varient.insert(value), varient
			}
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
		while ((x -= this.context.measureText(this.fromCharCode(this.data[i])).width) > 0)
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
	 * @param {content} content
	 * @param {string} before
	 * @param {number} context
	 * @param {number} type
	 * @param {number} index
	 * @param {number} line
	 * @return {number}
	 */
	function javascriptGrammer (content, before, context, type, index, line) {
		var grammer = this.grammer
		var scope = this.scope

		var keyword = grammer.keyword
		var storage = grammer.storage
		var string = grammer.string
		var constant = grammer.constant

		if (type > -1) {
			switch (type) {
				case 39:
				case 34:
				case 96:
					switch (scope) {
						case type:
							if (before !== 92)
								this.scope = 0
							break
						default:
								this.scope = type
					}
					break
				case 48:
				case 49:
				case 50:
				case 51:
				case 52:
				case 53:
				case 54:
				case 55:
				case 56:
				case 57:
					if (context >= keyword.other)
						return constant.numeric
			}

			if (scope === 0)
				return keyword.operator
		}

		switch (scope) {
			case 39:
			case 34:
			case 96:
				return string.other
			default:
				return keyword.other
		}

		return context
	}

	/**
	 * anchor
	 *
	 * @desc anchor the index of the first visible character
	 *
	 * @return {number}
	 */
	function anchor () {
		var pre = this.pre
		var post = this.post
		var size = this.size
		var data = this.data

		var y = this.y
		var index = this.index
		var offset = this.offset
		var lineHeight = this.lineHeight

		// up
		if (y < offset)
			while (index > 0) {
				if (index === post)
					index = pre

				if (data[index--] === 10 && ((offset -= lineHeight) + lineHeight < y))
					break
			}
		// down
		else if (y >= offset+lineHeight)
			while (index < size) {
				if (index === pre)
					index = size-post

				if (data[index++] === 10 && (offset += lineHeight) + lineHeight > y)
					break
			}

		this.offset = offset
		this.index = index
		
		return index
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
		var pre = this.pre
		var post = this.post
		var size = this.size
		var data = this.data
		var length = this.length

		// settings
		var syntax = this.syntax
		var theme = this.theme
		var language = this.language

		// viewport
		var index = this.y === this.offset ? this.index : this.anchor()
		var x = this.x|0
		var y = this.y|0
		var offset = this.offset|0
		var lineHeight = this.lineHeight
		var tabSize = this.tabSize
		var fontWidth = this.fontWidth
		var height = this.height
		var width = this.width
		var delta = offset === 0 ? y : y%offset
		var vertical = 0 - delta
		var horizontal = 0

		// setup
		var content = ''
		var code = 0
		var eof = size-1

		// var line = (x/lineHeight)|0
		// var token = state[line-1]|0
		// var before = pre > 0 ? data[pre] : data[size-post]

		// context
		var context = this.context

		context.canvas.width = this.width
		context.canvas.height = this.height

		context.textBaseline = 'top'
		context.font = this.fontSize + 'px ' + this.fontFamily

		for (var i = index; i < size; i++) {
			switch (i) {
				case pre:
					code = data[i = size-post]
					break
				case eof:
					if (code !== 10)
						code = (content += this.fromCharCode(data[i]), 10)
					break
				default:
					code = data[i]
			}

			switch (code) {
				case 13:
					break
				case 10:
					context.fillText(content, horizontal, vertical)
					content = ''

					if ((code = -1, vertical += lineHeight) > height)
						size = i
					continue
				default:
					content += this.fromCharCode(code)
			}
		}
	}

	function render (context, content, token, x, y, width, height) {
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
					switch (this.data[this.pre++] = this.data[this.size-this.post--]) {
						case 10:
							this.line++
					}
				break
			// backward
			case 1:
				if (this.pre > 0)
					switch (this.data[this.size-(this.post++)-1] = this.data[(this.pre--)-1]) {
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
			console.log('')
			console.log('note: this is a stress test')
			console.log('')

			begin = performance.now()
			heap.insert(input.trim())

			// insert(document): cold
			console.log('insert(cold):', performance.now()-begin, 'ms')

			console.log('')

			// move(document): cold
			begin = performance.now()
			heap.move(-(heap.pre+heap.post))
			console.log('move(cold):', performance.now()-begin, 'ms')

			// warmup
			heap.move((heap.pre+heap.post))
			heap.move(-(heap.pre+heap.post))
			heap.move((heap.pre+heap.post))
			heap.move(-(heap.pre+heap.post))
			heap.move((heap.pre+heap.post))

			// move(document): warm
			begin = performance.now()
			heap.move(-(heap.pre+heap.post))
			console.log('move(warm):', performance.now()-begin, 'ms')

			console.log('')

			// search(document): warm
			begin = performance.now()
			heap.find(0, -1, heap.size)
			console.log('search(cold):', performance.now()-begin, 'ms')

			// warmup
			heap.find(0, -1, heap.size)
			heap.find(0, -1, heap.size)
			heap.find(0, -1, heap.size)
			heap.find(0, -1, heap.size)
			heap.find(0, -1, heap.size)

			begin = performance.now()
			heap.find(0, -1, heap.size)
			console.log('search(warm):', performance.now()-begin, 'ms')
			
			console.log('')

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

			// tokenize: cold
			// begin = performance.now()
			// heap.tokenize()
			// console.log('tokenize+render(cold):', performance.now()-begin, 'ms')

			// // warmup
			// heap.tokenize()
			// heap.tokenize()
			// heap.tokenize()
			// heap.tokenize()
			// heap.tokenize()

			// tokenize: warm
			begin = performance.now()
			heap.tokenize()
			console.log('tokenize+render(warm):', performance.now()-begin, 'ms')

			console.log('')

			// render
			// begin = performance.now()
			// heap.render()
			// console.log('render:', performance.now()-begin, 'ms')

			console.log('')
			console.log(`document stats: ${heap.length} chars, ${heap.lines} lines, ~${heap.length*1e-6} MB`)
			console.log('')
			console.log('note: type `speed++`, to increase the scroll speed and look at the fps meter in chrome')
		}

		var heap = new Gap(0, 0, 0, window.innerWidth, window.innerHeight)

		heap.set({
			context: context,
			language: 'js',
			syntax: javascriptGrammer
		})
		// heap.set('context', context)
		// heap.set('language', 'js')
		// heap.set('syntax', javascriptGrammer)

		heap.use('default', {
			keyword: ['#000'],
			comment: ['gray']
		})

		window.speed = 1

		console.log(heap)

		// var file = '.log/test.ts'
		// var file = '.log/checker.ts'
		// var file = '.log/sqlite3.c'
		var file = 'https://raw.githubusercontent.com/Microsoft/TypeScript/master/src/compiler/checker.ts'

		console.log('Fetching file: GET '+ file)
		console.log('...')

		fetch(file).then((data) => {
			data.text().then((v) => {
				input = v
				body()

				requestAnimationFrame(function loop () {
					heap.y += speed
					heap.tokenize()
					requestAnimationFrame(loop)
				})
			})
		})
	})()
})();

