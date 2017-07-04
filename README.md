# Gap

A highlight extendable text edtor written in JavaScript rendering to a Canvas context.

The goal is to write a highlighy extendable editor that any other editor could in theory be built out of.

Demo – [https://rawgit.com/thysultan/gap.js/master/index.html](https://rawgit.com/thysultan/gap.js/master/index.html).

The current demo is a stress test using `300,000` lines, `5,556,000` characters which lands around `5.5MB`. 

It stree tests

1. Time it takes to insert the whole document into the buffer.
2. Time it takes to move the cursor from the end to the beginning of the document
3. Time it takes to tokenize the whole document
4. Time it takes to convert the whole document back into a string
5. Time it takes to convert the whole document into an array of bytes

All the tests are run twice, once in a cold(first function call) run the second time after running the respective
functions 5 times.

For the purpose of the stress test the test intentionally avoids vieport based optimizations like draw distance.

With the draw distance optimization enabled tokenization takes 0.160(warm) ms 8.049(cold) ms
Rendering to canvas takes ~4ms(cold), haven't yet benched a warm run for rendering.

## Todos

1. Implement common editor features
2. Implement more complex editor features
3. Expose an unlimited lookbehind primitive for syntax highlighters
4. Expose other primitives to make creating syntax highlighters easier

## Code

The editor is at it's core one class that can be extended to build an editor or used as a default editor.

Time will tell how long it will take to reach feature parity with popular editors,
though at the moment many of the building block primitives for what is expected of modern text editor is in some way taken into consideration at the core of it.

## Contributions

Any contributions welcome 
