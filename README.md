# Introduction

This is an idiomatic, minimally-opinionated `Channel` type for JavaScript that's
inspired by [Go's channels](https://golang.org/ref/spec#Channel_types).  It
works in browsers and in Node.js.  If you know how to use an `Array` then you
already know most of how to use a `Channel`.

## Why

Go's use of channels for concurrency is amazing and with JavaScript's
async/await feature we have the basis for it as well.  All that's missing is a
solid `Channel` type.  There are existing libraries but I wanted an idiomatic
`Channel` type that's more simple and minimally-opinionated.

This document assumes you're familiar with Go's channels and why you'd want to
use them.  For explanatory background, read my [blog
article](https://www.nodeguy.com/channels-for-javascript/) on the subject.

## Requirements

ES 2017

## Installation

```shell
$ npm install @nodeguy/channel
```

## Basic Use

Create a channel with `Channel()`.

To send an value to a channel, use `push`.  To receive an value from a channel,
use `shift`.  Always precede the method calls with `await`:

```JavaScript
const assert = require(`assert`)
const Channel = require(`@nodeguy/channel`)

const channel = Channel()

;(async () => {
  await channel.push(42)
})()

;(async () => {
  assert.equal(await channel.shift(), 42)
})()
```

The `push` and `shift` methods are usually called in different async functions.
They represent the two different ends of the channel and act to synchronize the
behavior of the async functions.

# API

## New Properties

The following properties don't have equivalents in `Array`.

### close() -> async

Closes the channel so that no more values can be pushed to it.  Returns a
promise that resolves when any remaining pushes in flight complete.

Attempting to push to a closed channel will throw an exception and shifting from
a closed channel will immediately return `undefined`.

### readOnly() -> Channel

Returns a version of the channel that provides only read methods.

### value

Set to the most recently `shift`ed value.  This is useful when used in
combination with `select`.

### writeOnly() -> Channel

Returns a version of the channel that provides only write methods.

### Channel.select(methods) -> async channel

`Channel.select` attempts to call multiple channel `methods` in parallel and
returns the channel of the first one that succeeds.  Only the winning method is
executed to completion—the other methods have no effect.

#### Examples

Imagine you're at a party and your next conversation depends on whom you run
into first: Alice, Bob, or Charlie.

```JavaScript
switch (await Channel.select(alice.shift(), bob.shift(), charlie.push(`Hi!`)) {
  case alice:
    console.log(`Alice said ${alice.value}.`)
    break

  case bob:
    console.log(`Bob said ${bob.value}.`)
    break

  case charlie:
    console.log(`I said "hi" to Charlie.`)
    break
}
```

Be careful of unintended side effects, however.  Even though only one value is
pushed in the following example, the counter is incremented twice.

```JavaScript
let counter = 0

const increment = () => {
  counter++
  return counter
}

await Channel.select(alice.push(increment()), bob.push(increment()))
assert.equal(counter, 2)
```

Sometimes you don't want to wait until a method completes.  You can use a closed
channel to return immediately even if no methods are ready:

```JavaScript
const closed = Channel()
closed.close()

switch (await Channel.select(alice.shift(), bob.shift(), closed.shift()) {
  case alice:
    console.log(`Alice said ${alice.value}.`)
    break

  case bob:
    console.log(`Bob said ${bob.value}.`)
    break

  default:
    console.log(`No one has anything to say yet.`)
}
```

You can also arrange it so that the select completes within a timeout:

```JavaScript
const timeout = Channel()
setTimeout(timeout.close, 1000)

switch (await Channel.select(alice.shift(), bob.shift(), timeout.shift()) {
  case alice:
    console.log(`Alice said ${alice.value}.`)
    break

  case bob:
    console.log(`Bob said ${bob.value}.`)
    break

  default:
    console.log(`I stopped listening after one second.`)
}
```

## Array-like Methods

These methods are similar to the equivalently named methods of `Array`.

### Channel

#### Channel([bufferLength = 0]) -> Channel

Create a new `Channel` with an optional buffer.

#### Channel.of(...values) -> Channel

#### Channel.from(iterable | stream.Readable) -> Channel

Create a new `Channel` from an iterable or a [Node.js readable stream](https://nodejs.org/api/stream.html#stream_readable_streams).

### Channel Object

#### every (callbackfn[, thisArg]) -> async Boolean

`callbackfn` should be a function that accepts one argument and returns a value
that is coercible to the Boolean values `true` or `false`.  `every` calls
`callbackfn` once for each value present in the channel until it finds one where
`callbackfn` returns `false`. If such a value is found, every immediately
returns `false`. Otherwise, if `callbackfn` returned `true` for all elements,
`every` will return `true`.

If a `thisArg` parameter is provided, it will be used as the `this` value for
each invocation of `callbackfn`. If it is not provided, `undefined` is used
instead.

Unlike in the Array version of `every`, `callbackfn` is called with only one
argument.

#### filter(callbackfn[, thisArg]) -> Channel
#### forEach(callbackfn[, thisArg]) -> async

The promise returned by `forEach` resolves when the channel is closed:

```JavaScript
const toArray = async (channel) => {
  const array = []

  await channel.forEach((value) => {
    array.push(value)
  })

  return array
}
```

If `callbackfn` is async then `forEach` will wait for it before iterating to the
next value:

```JavaScript
const pipe = async (source, sink) => {
  await source.forEach(sink.push)
  sink.close()
}
```

#### join(separator) -> async String
#### map(callbackfn[, thisArg]) -> Channel
#### push(value) -> async bufferLength

Unlike `Array`'s method, `push` accepts only one `value` at a time.

Sends the value into the channel and returns a promise that resolves when the
value has been shifted out or placed in the buffer.

* Throws a `TypeError` when attempting to push to a closed channel.
* Throws a `TypeError` when attempting to push `undefined` because it's a
  reserved value used to indicate a closed channel.

#### reduce(callbackfn[, initialValue])
#### shift() -> Promise

Returns a promise that resolves when an value is received from the channel.
Closed channels always return `undefined` immediately.

#### slice(start, end) -> Channel

### Functional API

There is a parallel API to support functional-style programming.  Every channel
method is also available as an independent function in the `Channel` namespace
that takes a channel as the final argument.  For example, `slice` can be called
in either of the following two ways:

```JavaScript
// method
channel.slice(10)

// function
Channel.slice(10, Infinity, channel)
```

You can also use partial application to pass the channel in later:

```JavaScript
const skipTen = Channel.slice(10, Infinity)
skipTen(channel)
```

# Contributing

Please [submit an issue](https://github.com/NodeGuy/channel/issues/new) if you
would like me to make `Channel` more `Array`-like (e.g., by adding another
`Array` method).

# Similar Projects

* [Channel](https://github.com/gozala/channel)
* [cochan](https://github.com/skozin/cochan)
* [js-csp](https://github.com/ubolonton/js-csp)
* [node-csp](https://github.com/olahol/node-csp)

# Copyright

Copyright 2017 [David Braun](https://www.NodeGuy.com/)

Licensed under the Apache License, Version 2.0 (the "License"); you may not use
these files except in compliance with the License.  You may obtain a copy of the
License at `http://www.apache.org/licenses/LICENSE-2.0`.  Unless required by
applicable law or agreed to in writing, software distributed under the License
is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the specific language
governing permissions and limitations under the License.
