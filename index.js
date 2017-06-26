var viewport = document.body
var canvas = document.getElementById('canvas')
var context = canvas.getContext('2d')
var canvasHeight = canvas.height = viewport.offsetHeight
var canvasWidth = canvas.width = viewport.offsetWidth

// settings
var fontSize = 13
var fontFamily = 'monospace'
var byteBlock = fontSize/1.66640
var lineHeight = fontSize
var tabSize = 2

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
function Buffer (size) {
	this.lead = 0
	this.tail = 0

	// entire buffer
	this.buff = Array(this.size = size|0)

	// selection coordinates
	this.maps = Array(0)

	// visible dimension
	this.width = 0
	this.height = 0

	// visible coordinate
	this.x = 0
	this.y = 0
}

Buffer.prototype = {
	move: move,
	jump: jump,
	insert: insert,
	remove: remove,
	fill: fill,
	expand: expand,
	select: select,
	copy: copy,
	save: save,
	render: render
}

/**
 * move
 * 
 * @param {number}
 * @return {void}
 */
function move (distance) {
	var caret = distance < 0 ? ~distance+1 : distance|0

	while (caret-- > 0)
		distance > 0 ? 
			(this.tail > 0 ? this.buff[this.lead++] = this.buff[this.size-this.tail++] : caret = 0) :
			(this.lead > 0 ? this.buff[this.size-(this.tail++)-1] = this.buff[(this.lead--)-1] : caret = 0)
}

/**
 * jump
 * 
 * @param {number}
 * @return {void}
 */
function jump (location) {
	this.move(location|0-this.lead)
}

/**
 * insert
 * 
 * @param {string} string
 * @return {void}
 */
function insert (string) {
	if (string.length > 0)
		for (var i = 0; i < string.length; i++)
			this.fill(string.charAt(i))
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
	var caret = distance < 0 ? ~distance+1 : distance|0

	while (caret-- > 0)
		distance < 0 ? 
			(this.lead > 0 ? this.lead-- : caret = 0) :
			(this.tail > 0 ? this.tail-- : caret = 0)
 }

/**
 * fill
 * 
 * @param {string} char
 * @return {void}
 */
function fill (char) {
	if (this.lead + this.tail === this.size)
		this.expand()

	this.buff[this.lead++] = char
}

/**
 * expand
 * 
 * @return {void}
 */
function expand () {
	var size = this.size*2
	var buff = Array(size)

	for (var i = 0; i < this.lead; i++)
		buff[i] = this.buff[i]

	for (var i = 0; i < this.tail; i++)
		buff[size-i-1] = this.buff[this.size-i-1]

	this.buff = buff
	this.size = size
}

/**
 * select
 * 
 * @return {void}
 */
function select (x1, y1, x2, y2) {
	// select coordiates, add to this.maps
	if (x1|0 !== x2|0)
		0
	// unselect all selections
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
 * save
 *
 * @param {number} location
 * @param {number} distance
 * @return {string}
 */
function save (location, distance) {
	var caret = location|0
	var travel = distance|0
	var output = ''

	if (this.lead > 0)
		while (caret < this.lead)
			if (travel > 0)
				output += this.buff[(travel--, caret++)]
			else
				break

	if (this.tail > 0 && (caret = this.size-this.tail) > 0)
		while (caret < this.size)
			if (travel > 0)
				output += this.buff[(travel--, caret++)]
			else
				break

	return output
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
 * @todo
 *   draw from right->left, bottom->top
 *   allows for some optimizations in syntax highlighting and general rendering
 *
 * I think option 1. is the best modal for the most control and constant time rendering
 * proportortional to the dimensions of the visible viewport regardless of the size
 * of the file.
 * 
 */
function render (xAxis, yAxis) {
	var byte = ''
	var buff = this.buff
	var lead = this.lead
	var tail = this.tail
	var size = this.size
	var length = lead

	var line = lineHeight
	var space = byteBlock
	var tab = tabSize
	var x = xAxis|0
	var y = yAxis|0+fontSize

	var i = 0
	var offset = 0
	var code = 0
	var gap = 0

	var cols = canvasWidth
	var rows = canvasHeight
	
	var width = 0
	var height = lineHeight

	// setup
	if (cols*rows > 0)
		context.clearRect(0, 0, cols, rows)

	context.font = fontSize+'px '+fontFamily

	// visitor
	while (true) {
		// x-axis breadth
		if (x > width)
			width = x

		// eof
		if (i === length) {
			if (tail === 0 || gap++ > 0)
				break
			else
				i = (length = size)-tail
		}

		// syntax highlighting in this case becomes much cheaper than an array of strings data-structure
		// 1. numbers, operators etc are universal so we can archive that at no cost
		// 2. lazily peak operator keywards to archive syntax highlighting on others
		// 3. use some binary state to track when inside comments and strings 
		switch (code = (byte = buff[i++]).charCodeAt(offset = 0)) {
			// carriage
			case 13:
				continue
			// newline
			case 10:
				// y-axis height
				height = y += line
				x = 0
				continue
			// tab
			case 9:
				offset = tab*space
				break
			// operators
			case 45:
				// set default fill `context.fillStyle` 
		}

		context.fillText(byte, x, y)
		x += offset+space
	}

	this.width = width|0
	this.height = height|0

	console.log(this.width, this.height)
}

(function demo(){
	var string = 'hello world'
	var heap = new Buffer(string.length)

	heap.insert(string)
	heap.render(0, 0)

	setTimeout(() => {
		heap.move(-2)
		heap.insert('.')
		heap.render(0, 0)

		setTimeout(()=> {
			// -5 will remove the last 5 characters, 5 will remove next 5 characters
			// heap.remove(5)
			heap.render(0)
			console.log(heap.save(0, heap.lead+heap.tail), heap.buff)
		}, 200)
	}, 200)
})()
