;(function () {
	'use strict'

	var viewport = document.body
	var canvas = document.getElementById('canvas')
	var context = canvas.getContext('2d')
	var canvasHeight = canvas.height = viewport.offsetHeight
	var canvasWidth = canvas.width = viewport.offsetWidth

	/**
	 * Grammer: Uint8Array(256)
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
	 * 090 - 172 namespace(hidden) i.e code folding?
	 * 172 - 254 namespace(underline) i.e matching tokens?
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

	function Node (prev, next) {
		this.token = [0]
		this.prev = prev
		this.next = next
		this.length = 0
	}

	/**
	 * Editor
	 * 
	 * @param {number} size
	 * @param {number} x
	 * @param {number} y
	 * @param {number} width
	 * @param {number} height
	 */
	function Editor (size, x, y, width, height) {
		// gap
		this.pre = 0
		this.post = 0

		// data
		this.size = size > 0 ? size|0 : 10
		this.data = new Uint32Array(this.size)

		// meta
		this.head = {token: [0], prev: null, next: null, length: 0}
		this.tail = this.head
		this.node = this.head
		this.node.next = this.node
		this.node.prev = this.node

		// stats
		this.line = 1
		this.lines = 1
		this.column = 1
		this.index = 0
		this.length = 0

		this.caret = {x: 0, y: 0}
		this.x = x|0
		this.y = y|0
		this.width = width|0
		this.height = height|0
		this.canvas = null
		this.context = null
	}

	/**
	 * Editor prototype
	 *
	 * @type {Object}
	 */
	Editor.prototype = {
		uint32: new Uint32Array(1),
		/**
		 * insert
		 * 
		 * @param {number} value
		 * @return {void}
		 */
		insert: function (value) {
			if (this.pre + this.post === this.size) {
				this.expand()
			}

			switch (this.data[(this.length++, this.node.length++, this.pre++)] = value) {
				case 10:
					this.node = {token: [0], prev: this.node, next: this.node.next, length: 0}
					this.node.next = this.node.next.prev = this.node
					this.index = this.pre
					this.line++
					this.lines++
					this.column = 1
					break
				default:
					this.column++
			}
		},
		/**
		 * remove
		 *
		 * @return {void}
		 */
		remove: function remove () {			
			if (this.pre > 0) {
				switch (this.data[(this.length--, this.node.length--, this.pre--)]) {
					case 10:
						this.node.prev.next = this.node.next
						this.node.next.prev = this.node.prev
						this.node = this.node.prev

						this.index = (this.pre+1)-this.node.length
						this.line--
						this.lines--
						break
				}
			}
		},
		/**
		 * backward
		 * 
		 * @return {void}
		 */
		backward: function backward () {
			if (this.pre > 0) {
				switch (this.data[this.size-(this.post++)-1] = this.data[(this.pre--)-1]) {
					case 10:
						this.node = this.node.prev
						this.column = this.node.length

						this.index = (this.pre+1)-this.column
						this.line--
						break
					default:
						this.column--
				}
			}
		},
		/**
		 * forward
		 * 
		 * @return {void}
		 */
		forward: function forward () {
			if (this.post > 0) {
				switch (this.data[this.pre++] = this.data[this.size-(this.post--)]) {
					case 10:
						this.node = this.node.next
						this.column = 1

						this.index = this.pre
						this.line++
						break
					default:
						this.column++
				}
			}
		},
		/**
		 * upward
		 * 
		 * @return {void}
		 */
		upward: function upward () {
			var line = this.line
			var column = this.column

			while (this.pre > 0 && (this.line === line || this.column > column)) {
				this.backward()
			}
		},
		/**
		 * downward
		 * 
		 * @return {void}
		 */
		downward: function downward (value) {
			var line = this.line
			var column = this.column

			while (this.post > 0 && (this.line === line || this.column < column)) {
				this.backward()
			}
		},
		/**
		 * inject
		 * 
		 * @param {string} value
		 * @return {void}
		 */
		inject: function inject (value) {
			if (value.length > 1) {
				for (var i = 0; i < value.length; i++) {
					this.insert(value.charCodeAt(i))
				}
			} else {
				this.insert(value.charCodeAt(0))
			}
		},
		/**
		 * move
		 * 
		 * @param {number} x
		 * @param {number} y
		 * @return {void}
		 */
		move: function move (x, y) {
			var xlen = x < 0 ? ~x+1 : x|0
			var ylen = y < 0 ? ~y+1 : y|0

			while (xlen-- > 0) {
				x < 0 ? this.backward() : this.forward()
			}

			while (ylen-- > 0) {
				y < 0 ? this.upward() : this.downward()
			}
		},
		/**
		 * jump
		 *
		 * @param {number} value
		 * @return {void}
		 */
		jump: function jump (value) {
			var index = (value|0)-this.pre

			if (index < 0) {
				this.backward(index)
			} else {
				this.forward(index)
			}
		},
		/**
		 * expand
		 * 
		 * @return {void}
		 */
		expand: function expand () {
			var pre = this.pre
			var post = this.post
			var size = this.size
			var data = this.data

			var dble = size*2
			var next = new Uint32Array(dble)

			// copy leading characters
			for (var i = 0; i < pre; i++) {
				next[i] = data[i]
			}

			// copy tailing characters
			for (var i = 0; i < post; i++) {
				next[dble-i-1] = data[size-i-1]
			}

			this.size = dble
			this.data = next
		},
		/**
		 * find
		 *
		 * @param {number} index
		 * @param {number} value
		 * @param {number} length
		 */
		find: function find (index, value, length) {
			var pre = this.pre
			var post = this.post
			var size = this.size
			var data = this.data

			var i = index < 0 ? 0 : index|0
			var needle = value|0
			var haystack = length|0

			// forward
			if (haystack > 0) {
				while (i < size && haystack-- > 0) {
					if (i === pre)
						i = size-post

					if (data[i++] === needle) 
						return i
				}
			// backward
			} else {
				while (i > 0 && haystack++ < 0) {
					if (i === size-post)
						i = pre

					if (data[i--] === needle) 
						return i
				}
			}
			return -1
		},
		/**
		 * toString
		 *
		 * @return {string}
		 */
		toString: function toString () {
			var index = 0
			var output = ''

			var pre = this.pre
			var post = this.post
			var size = this.size
			var data = this.data

			// leading characters
			if (pre > 0) {
				// visitor
				while (index < pre) {
					output += this.fromCharCode(data[index++])
				}
			}

			// tailing characters
			if (post > 0 && (index = size-post) > 0) {
				// visitor
				while (index < size) {
					output += this.fromCharCode(data[index++])
				}
			}

			return output
		},
		/**
		 * toBytes
		 *
		 * @return {Uint32Array}
		 */
		toBytes: function toBytes () {
			var pre = this.pre
			var post = this.post
			var size = this.size
			var data = this.data
			var output = new Uint32Array(pre+post)

			if (pre > 0) {
				output.set(data.subarray(0, pre))
			}
			
			if (post > 0) {
				output.set(data.subarray(size-post))
			}

			return output
		},
		/**
		 * fromCharCode
		 * 
		 * @param {number} value
		 * @return {string}
		 */
		fromCharCode: function fromCharCode (value) {
			if (value < 0x10000) {
				return String.fromCharCode(value)
			} else {
				return String.fromCodePoint(value)
			}
		},
		/**
		 * charCodeAt
		 * 
		 * @param {number} value
		 * @return {number}
		 */
		charCodeAt: function charCodeAt (value) {		
			var index = value|0
			var pre = this.pre
			var post = this.post
			var size = this.size
			var data = this.data

			if (pre === 0) {
				return data[(size-1-post)+index]
			}

			if (post === 0) {
				return index < pre ? data[index] : NaN
			}

			return data[(size-1-post-pre)+index]
		},
		/**
		 * charAt
		 * 
		 * @param {number} value
		 * @return {string}
		 */
		charAt: function charAt (value) {
			return this.fromCharCode(this.charCodeAt(value))
		},
		/**
		 * tokenize
		 *
		 * @return {void}
		 */
		tokenize: function tokenize () {
			var syntax = this.syntax = javascriptGrammer

			// data
			var pre = this.pre
			var post = this.post
			var size = this.size
			var data = this.data

			// setup
			var index = 0
			var hash = 0
			var code = 0
			var type = 0
			var length = 0
			var eof = size-1

			// meta
			var head = this.head
			var node = this.node
			var state = node.state
			var token = node.token
			var keys = []

			for (var i = this.index; i < size; i++) {
				code = data[i === pre ? (i = size-post) : i]

				if (i === eof || code < 65 || code > 122 || (code > 90 && code < 97)) {
					// alphabetic
					if (hash !== 0) {
						keys[index++] = hash >>> 0
						hash = 0
					}

					// whitespace/numeric/operators
					keys[index++] = code

					if (code === 10 || i === eof) {
						for (length = index, index = 0; index < length; index++) {
							type = token[index] = this.syntax(keys, type, keys[index], index)
						}

						if (token.length > index) {
							token.length = index
						}

						if (type === state) {
							break
						}

						node = node.next
						token = node.token
						state = node.state
						index = 0
						keys = []
					}
				} else {
					hash = ((hash << 5) - hash) + code
				}
			}
		},
		/**
		 * render
		 * 
		 * @return {void}
		 */
		render: function render () {
			if (this.context === null) {
				return
			} else {
				this.context.font = this.fontSize + 'px ' + this.fontFamily
				this.context.textBaseline = 'top'
			}

			// data
			var pre = this.pre
			var post = this.post
			var size = this.size
			var data = this.data
			var lineHeight = this.lineHeight
			var fontWidth = this.fontWidth
			var tabSize = this.tabSize

			// setup
			var index = 0
			var text = ''
			var code = 0
			var eof = size-1
			var y = 0
			var x = 0
			var node = this.node
			var token = node.token
			var caret = this.caret

			for (var i = 0; i < size; i++) {
				if (i !== pre) {
					code = data[i]
				} else {
					i = (size-post) + (code = -1)
				}

				if (i === eof || code < 65 || code > 122 || (code > 90 && code < 97)) {
					if (text.length > 0) {
						x += this.fillText(text, x, y, token[index++])
						text = ''
					}
					
					if (code === 10) {
						if ((y += lineHeight) > canvasHeight) {
							break
						} else {
							token = (index = 0, x = 0, node = node.next).token
						}
					} else {
						switch (code) {
							case -1:
								context.fillRect(x, y, 1, lineHeight);
								caret.x = x
								caret.y = y
								break
							case 9:
								x += tabSize*fontWidth
								break
							case 13:
								break
							default:
								x += this.fillText(this.fromCharCode(code), x, y, token[index])
						}
						index++
					}
				} else {
					text += this.fromCharCode(code)
				}
			}
		},
		fillText: function fillText (text, x, y, token) {
			this.context.fillText(text, x, y)
			return this.context.measureText(text).width
		},
		clearRect: function clearRect () {
			this.canvas.width = this.width
			this.canvas.height = this.height
		},
		/**
		 * set
		 * 
		 * @param {string} name
		 * @param {*} value
		 */
		set: function set (name, value) {
			if (typeof name === 'object') {
				for (var key in name) {
					this.set(key, name[key])
				}
			} else {
				switch (name) {
					case 'syntax':
						return this.syntax = value || this.syntax
					case 'theme':
						return this.theme = value || this.theme
				}
			}
		},
		/**
		 * use
		 * 
		 * @param {string} name 
		 * @param {*} value
		 * @return {*}
		 */
		use: function use (name, value) {
			return this.package[name] = value
		},

		// static
		fontWidth: Math.round(13/1.666),
		fontSize: 13,
		lineHeight: (13*1.5)|0,
		tabSize: 2,
		fontFamily: 'monospace',

		// extensions
		package: {
			// 	'default-theme': theme({
			// 		comment: {
			// 			other: 'gray'
			// 		},
			// 		string: {
			// 			other: 'green',
			// 			double: 'green'
			// 		},
			// 		keyword: {
			// 			other: 'black',
			// 			operator: 'red'
			// 		},
			// 		constant: {
			// 			other: 'purple',
			// 			numeric: 'blue'
			// 		}
			// 	})
		}
	}

	/**
	 * theme
	 * 
	 * @param {Object} style
	 * @return {Array<string>}
	 */
	function theme (style) {
		var output = []

		for (var key in style) {
			if (typeof grammer[key] !== 'object') {
				continue
			}

			var props = style[key]

			for (var name in props) {
				output[grammer[key][name]] = props[name]  
			}
		}

		return output
	}

	/**
	 * javascriptGrammer Example
	 * 
	 * @param {content} keys
	 * @param {number} type
	 * @param {number} hash
	 * @param {number} index
	 * @return {number}
	 */
	function javascriptGrammer (keys, type, hash, index) {
		var {keyword, storage, string, constant, variable, support} = grammer

		switch (this.mode) {
			case string.single:
				if (hash === string.single) {
					this.mode = 0
					return keyword.operator
				} else {
					return string.single
				}
		}

		switch (hash) {
			case 3559070:
				return variable.special
			case 3360570672:
			case 1380938712:
				return storage.type
			case 39:
				this.mode = string.single
			case 40:
			case 41:
			case 59:
			case 46:
			case 43:
			case 44:
				return keyword.operator
		}

		if (keys[index+1] === 40) {
			if (keys[index-1] === 46 && keys[index-2] === 2390824) {
				return support.function
			}
			return variable.other
		}

		return keyword.other
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
		if (y < offset) {
			while (index > 0) {
				if (index === post) {
					index = pre
				}

				if (data[index--] === 10 && ((offset -= lineHeight) + lineHeight < y)) {
					break
				}
			}
		// down
		} else if (y >= offset+lineHeight) {
			while (index < size) {
				if (index === pre) {
					index = size-post
				}

				if (data[index++] === 10 && (offset += lineHeight) + lineHeight > y) {
					break
				}
			}
		}

		this.offset = offset
		this.index = index
		
		return index
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
			{
				console.log('')
				console.log('note: this is a stress test')
				console.log('')
			}

			{
				begin = performance.now()
				heap.inject(input.trim())

				// inject(document): cold
				console.log('inject(cold):', performance.now()-begin, 'ms')

				console.log('')
			}

			{
				// move(document): cold
				begin = performance.now()
				// heap.backward(3)
				// console.log(heap.column)
				// throw 'end'
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
				heap.move(60)
			}

			{
				// search(document): cold
				begin = performance.now()
				heap.find(0, -1, heap.size)
				console.log('search(cold):', performance.now()-begin, 'ms')

				// warmup
				heap.find(0, -1, heap.size)
				heap.find(0, -1, heap.size)
				heap.find(0, -1, heap.size)
				heap.find(0, -1, heap.size)
				heap.find(0, -1, heap.size)

				// search(document): warm
				begin = performance.now()
				heap.find(0, -1, heap.size)
				console.log('search(warm):', performance.now()-begin, 'ms')
				
				console.log('')
			}

			{
				// tokenize: cold
				begin = performance.now()
				heap.tokenize()
				console.log('tokenize(cold):', performance.now()-begin, 'ms')

				// warmup
				// heap.tokenize()
				// heap.tokenize()
				// heap.tokenize()
				// heap.tokenize()
				// heap.tokenize()

				// // tokenize: warm
				// begin = performance.now()
				// heap.tokenize()
				// console.log('tokenize(warm):', performance.now()-begin, 'ms')
				console.log('')
			}

			{
				// render: cold
				begin = performance.now()
				heap.render()
				console.log('render(cold):', performance.now()-begin, 'ms')

				// warmup
				// heap.render()
				// heap.render()
				// heap.render()
				// heap.render()
				// heap.render()

				// // render: warm
				// begin = performance.now()
				// heap.render()
				// console.log('render(warm):', performance.now()-begin, 'ms')
				// console.log('')
			}

			{
				// save the whole document
				begin = performance.now();
				var output = heap.toString();
				console.log('save(string):', performance.now()-begin, 'ms')
					
				// save the whole document with a stream buffer
				begin = performance.now();
				var output = heap.toBytes();		
				console.log('save(stream):', performance.now()-begin, 'ms')
			}

			{
				console.log('')
				console.log('note: all the above operate on the entire document\nwith no specific viewport optimization.')
				console.log('')

				// render
				// begin = performance.now()
				// heap.render()
				// console.log('render:', performance.now()-begin, 'ms')

				console.log('')
				console.log(`document stats: ${heap.length} chars, ${heap.lines} lines, ~${heap.length*1e-6} MB`)
				console.log('')
			}
		}

		{
			var heap = new Editor(0, 0, 0, window.innerWidth, window.innerHeight)
			heap.context = context
			heap.canvas = canvas

			// heap.set({
				// language: 'js',
				// syntax: javascriptGrammer
			// })
			// heap.set('context', context)
			// heap.set('language', 'js')
			// heap.set('syntax', javascriptGrammer)

			heap.use('default', {
				keyword: ['#000'],
				comment: ['gray']
			})

			window.speed = 1

			console.log(heap)
		}

		{
			// var file = '.log/test.ts'
			var file = '.log/checker.ts'
			// var file = '.log/sqlite3.c'
			// var file = 'https://raw.githubusercontent.com/Microsoft/TypeScript/master/src/compiler/checker.ts'

			console.log('Fetching file: GET '+ file)
			console.log('...')

			fetch(file).then((data) => {
				data.text().then((v) => {
					input = v
					body()

					// requestAnimationFrame(function loop () {
					// 	heap.y += speed
					// 	heap.tokenize()
					// 	requestAnimationFrame(loop)
					// })
				})
			})
		}
	})()
})();
