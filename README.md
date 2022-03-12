# Gap

An extendable gap buffer based text editor written in JavaScript run in a web worker, rendering to canvas through offscreen canvas completely of the main thread.

The goal is to write the fastest, smallest(3-4kb), most memory efficent extendable code editor written in JavaScript.

The previous [Demo](https://rawgit.com/thysultan/gap.js/master/index.html) used to stress test using `300,000` lines, `5,556,000` characters or around `5.5MB` which was all rendered in 4ms.

The previous demo use to render on the main thread not using offscreen canvas. There's currently no benchmark for the current work in progress, that said rendering is a constant time operation so the number of lines or characters in a document do not have much meaning except if you have a 300,000 "pixel" 79 meter tall display: which in present-tense(2022) doesn't exist.

