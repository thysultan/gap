var viewport = document.body
var canvas = document.getElementById('canvas')
var context = canvas.getContext('2d')
var canvasHeight = canvas.height = viewport.offsetHeight
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
 */
function Buffer (size, width, height) {
	// cursor
	this.pre = 0
	this.post = 0

	// buffer
	this.size = size|0
	this.buff = Array(this.size)

	// selection
	this.select = Array(0)

	// dimension
	this.width = width|0
	this.height = height|0

	// viewport
	this.x = this.width
	this.y = 0
}

Buffer.prototype = {
	// methods
	move: move,
	jump: jump,
	insert: insert,
	remove: remove,
	fill: fill,
	expand: expand,
	select: select,
	copy: copy,
	save: save,
	scroll: scroll,
	render: render,

	// static
	byteBlock: 13/1.66640,
	fontSize: 13,
	tabSize: 2,
	fontFamily: 'monospace'
}

/**
 * move
 * 
 * @param {number}
 * @return {void}
 */
function move (distance) {
	// retrieve unsigned integer
	var caret = distance < 0 ? ~distance+1 : distance|0

	// travel distance
	while (caret-- > 0)
		// backward
		if (distance > 0)
			// within bounds
			if (this.post > 0)
				this.buff[this.pre++] = this.buff[this.size-this.post++]
			// out of bounds
			else
				break
		// forward
		else
			// within bounds
			if (this.pre > 0)
				this.buff[this.size-(this.post++)-1] = this.buff[(this.pre--)-1]
			// out of bounds
			else
				break
}

/**
 * jump
 * 
 * @param {number}
 * @return {void}
 */
function jump (location) {
	this.move(location|0-this.pre)
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
			this.fill(string.charAt(i))
	// single character
	else
		this.fill(string)
}

/**
 * remove
 * 
 * @param {number} distance
 * @return {void}
 */
function remove (distance) {
	// retrieve unsigned integer
	var caret = distance < 0 ? ~distance+1 : distance|0

	// visitor
	while (caret-- > 0)
		// shift
		if (distance < 0)
			this.pre > 0 ? this.pre-- : caret = 0
		// pop
		else
			this.post > 0 ? this.post-- : caret = 0
 }

/**
 * fill
 * 
 * @param {string} char
 * @return {void}
 */
function fill (char) {
	// not enough space?
	if (this.pre + this.post === this.size)
		this.expand()

	// fill in character
	this.buff[this.pre++] = char
}

/**
 * expand
 * 
 * @return {void}
 */
function expand () {
	// exponatially grow, avoids frequent expansions
	var size = this.size*2
	var buff = Array(size)

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
 * scroll
 * 
 * @param {number} horizontal
 * @param {number} vertical
 */
function scroll (horizontal, vertical) {
	// retrieve unsigned integer
	var x = horizontal < 0 ? ~horizontal+1 : horizontal|0
	var y = vertical < 0 ? ~vertical+1 : vertical|0

	// vertical
	while (y-- > 0)
		// move viewport up
		if (vertical < 0)
			while (this.y > 0)
				if (this.buff[this.y--].charCodeAt(0) === 10)
					break
		// move viewport down
		else
			while (this.y < this.size)
				if (this.buff[this.y++].charCodeAt(0) === 10)
					break

	// horizontal
	while (x-- > 0)
		// move viewport left
		if (horizontal < 0)
			this.x--
		// move viewport right
		else
			this.x++
}

/**
 * save
 *
 * @param {number} location
 * @param {number} distance
 * @return {string}
 */
function save (location, distance) {
	// retrieve integer
	var caret = location|0
	var travel = distance|0
	
	// setup destination buffer
	var output = ''

	// leading characters
	if (this.pre > 0)
		// visitor
		while (caret < this.pre)
			// within range
			if (travel > 0)
				output += this.buff[(travel--, caret++)]
			// end of range
			else
				break

	// tailing characters
	if (this.post > 0 && (caret = this.size-this.post) > 0)
		// visitor
		while (caret < this.size)
			if (travel > 0)
				output += this.buff[(travel--, caret++)]
			else
				break

	return output
}

/**
 * select
 * 
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
function render (xAxis, yAxis) {
	var byte = ''
	var buff = this.buff
	var pre = this.pre
	var post = this.post
	var size = this.size
	var length = pre

	var line = this.lineHeight
	var space = this.byteBlock
	var tab = this.tabSize
	var x = xAxis|0
	var y = yAxis|0+this.fontSize

	var i = 0
	var offset = 0
	var code = 0
	var gap = 0	
	var breadth = 0

	// setup
	if (this.width*this.height > 0)
		context.clearRect(0, 0, this.width, this.height)

	context.font = this.fontSize+'px '+this.fontFamily

	// visitor
	while (true) {
		// x-axis breadth
		if (x > breadth)
			breadth = x

		// eof
		if (i === length) {
			if (post === 0 || gap++ > 0)
				break
			else
				i = (length = size)-post
		}

		switch (code = (byte = buff[i++]).charCodeAt(offset = 0)) {
			// carriage
			case 13:
				continue
			// newline
			case 10:
				y += line
				x = 0
				continue
			// tab
			case 9:
				offset = tab*space
				break
			// operators
			case 45:
				// set default fill `context.fillStyle`
			default:
				// syntax highlighting in this case becomes much cheaper than an array of strings data-structure
				// 1. numbers, operators etc are universal so we can archive that at no cost
				// 2. lazily peak operator keywards to archive syntax highlighting on others
				// 3. use some binary state to track when inside comments and strings 
		}

		context.fillText(byte, x, y)

		x += offset+space
	}
}

(function demo(){
	var string = 'hello world'
	var heap = new Buffer(string.length, canvasWidth, canvasHeight)

	heap.insert(string)
	heap.render(0, 0)

	setTimeout(() => {
		heap.move(-2)
		heap.insert('.')
		heap.render(0, 0)

		setTimeout(()=> {
			// -5 will remove the last 5 characters, 5 will remove next 5 characters
			heap.remove(5)
			heap.render(0)
			console.log(heap.save(0, heap.pre+heap.post), heap)
		}, 200)
	}, 200)
})()
