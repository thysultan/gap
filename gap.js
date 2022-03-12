var mmap = Int16Array
var char = String.fromCharCode
var font = 24 // font size
var span = 0 // monospace character width
var move = 0 // -------------------------
var node = null // canvas object
var draw = null // canvas context
var head = 0 // head of cursor
var tail = 0 // tail of cursor
var size = 2 ** 10 // memory size
var page = new mmap(size) // memory page
var port = self.onmessage = event => handle(event.data)

function insert(string) {
	var length = string.length
	if (head + tail + length >= size) expand(size * 2 + length, page)
	for (var index = 0; index < length; ++index) page[head++] = string.charCodeAt(index)
}
function remove(length) {
	if (head > 0) --head
}
function cursor(length) {
	if (length < 0 && head > 0) while (length++) page[size - 1 - (tail++)] = page[(head--) - 1]
	else if (length > 0 && tail > 0) while (length--) page[head++] = page[size - (tail--)]
}
function expand(length, buffer) {
	page = new mmap(length)
	page.set(buffer.subarray(0, head), 0)
	page.set(buffer, size - tail)
	size = length
}
function render() {
	span = font/(10/6)
	draw.fillStyle = '#' + Math.floor(Math.random() * 16777215).toString(16)
	draw.clearRect(0, 0, node.width, node.width)
	const a = char(...page.subarray(0, head))
	const b = char(...page.subarray(size - tail))
	draw.fillText(a, 0, 0)
	draw.fillRect(move = span * a.length - 1, 0, 1, font)
	draw.fillText(b, span * a.length, 0)
}
function handle([type, value, state]) {
	switch (type) {
		case 'keydown':
			switch (state) {
				// shift
				case 16:
				// control
				case 17:
				// option
				case 18:
				// command
				case 91:
					break
				// right
				case 39: cursor(1)
					break
				// left
				case 37: cursor(-1)
					break
				// up
				case 38:
				// down
				case 40:
					break
				// backspace
				case 8: remove(1)
					break
				// tab
				case 9:
					break
				// new line
				case 13: value = '\n'
				default: insert(value)
			}
			break
		case 'viewport':
			node = value
			draw = node.getContext('2d')
			// size
			node.width = state[0] * state[2]
			node.height = state[1] * state[2]
			draw.scale(state[2], state[2])
			// text
			draw.font = font + 'px monospace'
			draw.textBaseline = 'top'
			break
	}
	render()
}
