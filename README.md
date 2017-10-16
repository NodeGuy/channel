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

To send a value to a channel use `push`.  To receive a value from a channel use
`shift`.  Always precede the method calls with `await`.  Close the channel when
there are no more values to push.

```JavaScript
const assert = require(`assert`)
const Channel = require(`@nodeguy/channel`)

const channel = Channel()

const send = async () => {
  await channel.push(42)
  await channel.close()
}

const receive = async () => {
  assert.equal(await channel.shift(), 42)
  assert.equal(await channel.shift(), undefined)
}

send()
receive()
```

The `push` and `shift` methods are usually called in different async functions.
They represent the two different ends of the channel and act to synchronize the
behavior of the async functions.

# API

The [API](doc/API.md) is in the `doc` directory.

# Contributing

Please [submit an issue](https://github.com/NodeGuy/channel/issues/new) if you
have a suggestion for how to make `Channel` more `Array`-like (e.g., by adding
another `Array` method).

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
