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
	this.size = size|0
	this.buff = new Uint8Array(this.size)

	// selection
	this.select = new Array(0)

	// dimension
	this.width = width|0
	this.height = height|0

	// viewport
	this.x1 = 0
	this.x2 = (this.block/width)|0

	this.y1 = 0
	this.y2 = (this.font/height)|0
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
	fromCharCode: String.fromCharCode,

	// static
	block: Math.round(13/1.666),
	font: 13,
	tab: 2,
	family: 'monospace'
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
			this.fill(string.charCodeAt(i))
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
		vertical < 0 ? this.up(0) : this.down(0)

	// horizontal
	while (x-- > 0)
		horizontal < 0 ? this.left(0) : this.right(0)
}

/**
 * up
 * 
 * @param {number} y
 */
function up () {
	// move head up
	if (y|0 <= 0)
		while (this.y1 > 0)
			if (this.buff[this.y1 = this.y1-- < this.post && this.y1 === this.post ? this.pre-1 : this.y1] === 10)
				break

	// move tail up
	if (y|0 >= 0)
		while (this.y2 > 0)
			if (this.buff[this.y2 = this.y1-- < this.post && this.y1 === this.post ? this.pre-1 : this.y2] === 10)
				break
}

/**
 * down
 * 
 * @param {number} y
 */
function down (y) {
	// move head down
	if (y|0 <= 0)
		while (this.y1 < this.size)
			if (this.buff[this.y1 = this.y1++ < this.pre && this.y1 === this.pre ? this.post+1 : this.y1] === 10)
				break

	// move tail down
	if (y|0 >= 0)
		while (this.y2 < this.size)
			if (this.buff[this.y2 = this.y1++ < this.pre && this.y1 === this.pre ? this.post+1 : this.y2] === 10)
				break
}

/**
 * left
 * 
 * @param {number} x
 */
function left (x) {
	// move head left
	if (x|0 <= 0 && this.x1-- > this.post && this.x1 === this.post)
		this.x1 = this.pre-1

	// move tail left
	if (x|0 >= 0 && this.x2-- > this.post && this.x2 === this.post)
		this.x2 = this.pre-1
}

/**
 * right
 * 
 * @param {number} x
 */
function right (x) {
	// move head right
	if (x|0 <= 0 && this.x1++ < this.pre && this.x1 === this.pre)
		this.x1 = this.post+1
		
	// move tail right
	if (x|0 >= 0 && this.x2++ < this.pre && this.x2 === this.pre)
		this.x2 = this.post+1	
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
				output += this.fromCharCode(this.buff[(travel--, caret++)])
			// out of range
			else
				break

	// tailing characters
	if (this.post > 0 && (caret = this.size-this.post) > 0)
		// visitor
		while (caret < this.size)
			// within range
			if (travel > 0)
				output += this.fromCharCode(this.buff[(travel--, caret++)])
			else
			// out of range
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
	var buff = this.buff
	var pre = this.pre
	var post = this.post
	var size = this.size
	var length = pre

	var font = this.font
	var block = this.block
	var tab = this.tab
	var x = xAxis|0
	var y = yAxis|0+this.font

	var i = 0
	var offset = 0
	var code = 0
	var gap = 0	
	var breadth = 0

	// setup
	if (this.width*this.height > 0)
		context.clearRect(0, 0, this.width, this.height)

	context.font = font+'px '+this.family

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

		switch (code = buff[(offset = 0, i++)]) {
			// carriage
			case 13:
				continue
			// newline
			case 10:
				y += font
				x = 0
				continue
			// tab
			case 9:
				offset = tab*block
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

		context.fillText(this.fromCharCode(code), x, y)

		x += offset+block
	}

	if (y >= canvasHeight)
		(stop = true, console.log('done - ' + ' ' + this.pre+this.post + ' characters printed'))
}

var stop = false;

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
			heap.insert('\n')
			console.log(heap.save(0, heap.pre+heap.post), heap)

			var begin = performance.now()

			setTimeout(function loop () {
				// here i'm just testing the performance of
				// parsing the whole world vs rendering the whole world
				// ~ 32,000 lines
				// ~ 17,000,000 characters
				// 
				// note on implementation detail
				// - we won't actually render the whole world
				// we will however need to parse the whole world
				// so it's great this is a strong suit
				// - when loading a file we will only need to render
				// the view(how many characters can fit in the visible view)
				// which is way smaller than 17 million characters
				if (heap.pre+heap.post >= 1734110) {
					stop = true
					// ~46ms
					console.log('parsed in', performance.now()-begin, 'ms')
					begin = performance.now()
					// ~977ms
					heap.render()
					console.log('rendered in', performance.now()-begin, 'ms')
				}
				else
					// console.log(heap.pre+heap.post, 1734110, heap.pre+heap.post >= 1734110)
				// this is a stress test, expect fans to spin
				// var start = performance.now()
				var i = 0
				// insert 50 lines
				while (i++<50)
					heap.insert('This is a stress test everything is being render with every newline, see console for more info\n')

				// console.log('time it takes to insert lines of characters', performance.now()-start, 'ms')
				// var start = performance.now()
				// heap.render()
				// console.log('time it takes to render everything', performance.now()-start, 'ms')

				// if you look at the console you will see that inserting
				// new characters operates at a constant time
				// while rendering the whole world grows with time
				// which leads itself the idea of rendering just the visible 
				// viewport at any given time
				if (stop === false)
					loop()
					// requestAnimationFrame(loop)
					// setTimeout(loop, 1000/16)
			}, 0)
		}, 0)
	}, 0)
})()
