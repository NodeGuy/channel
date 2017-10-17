<!-- TOC -->

- [New Properties](#new-properties)
  - [close() -> async](#close---async)
  - [readOnly() -> Channel](#readonly---channel)
  - [writeOnly() -> Channel](#writeonly---channel)
  - [Channel.select(promises) -> async channel](#channelselectpromises---async-channel)
    - [Examples](#examples)
  - [value](#value)
- [Array-like Properties](#array-like-properties)
  - [Channel](#channel)
    - [Channel([bufferLength = 0]) -> Channel](#channelbufferlength--0---channel)
    - [Channel.isChannel(value) -> Boolean](#channelischannelvalue---boolean)
    - [Channel.of(...values) -> Channel](#channelofvalues---channel)
    - [Channel.from(iterable | stream.Readable) -> Channel](#channelfromiterable--streamreadable---channel)
  - [Channel Object](#channel-object)
    - [every (callbackfn[, thisArg]) -> async Boolean](#every-callbackfn-thisarg---async-boolean)
    - [filter(callbackfn[, thisArg]) -> Channel](#filtercallbackfn-thisarg---channel)
    - [forEach(callbackfn[, thisArg]) -> async](#foreachcallbackfn-thisarg---async)
    - [join(separator) -> async String](#joinseparator---async-string)
    - [map(callbackfn[, thisArg]) -> Channel](#mapcallbackfn-thisarg---channel)
    - [push(value) -> async bufferLength](#pushvalue---async-bufferlength)
    - [reduce(callbackfn[, initialValue])](#reducecallbackfn-initialvalue)
    - [shift() -> async](#shift---async)
    - [slice(start, end) -> Channel](#slicestart-end---channel)
- [Functional API](#functional-api)

<!-- /TOC -->

# New Properties

The following properties don't have equivalents in `Array`.

## close() -> async

Close the channel so that no more values can be pushed to it.  Return a promise
that resolves when any remaining pushes in flight complete.

Attempting to push to a closed channel will throw an exception and shifting from
a closed channel will immediately return `undefined`.

## readOnly() -> Channel

Return a version of the channel that provides only read methods.

## writeOnly() -> Channel

Return a version of the channel that provides only write methods.

## Channel.select(promises) -> async channel

Wait for the first channel method promise to succeed and then cancel the rest.
Return the channel of the winning promise.

All of the promises can be cancelled before completion by calling `cancel` on
the promise returned by `select`.

### Examples

Imagine you're at a party and your next conversation depends on whom you run
into first: Alice, Bob, or Charlie.

```JavaScript
switch (await Channel.select([
  alice.shift(),
  bob.shift(),
  charlie.push(`Hi!`)
])) {
  case alice:
    console.log(`Alice said ${alice.value}.`);
    break;

  case bob:
    console.log(`Bob said ${bob.value}.`);
    break;

  case charlie:
    console.log(`I said "hi" to Charlie.`);
    break;
}
```

Be careful of unintended side effects, however.  Even though only one value is
pushed in the following example, the counter is incremented twice.

```JavaScript
let counter = 0;

const increment = () => {
  counter++;
  return counter;
};

await Channel.select([alice.push(increment()), bob.push(increment())]);
assert.equal(counter, 2);
```

Sometimes you don't want to wait until a method completes.  You can use a closed
channel to return immediately even if no other channels are ready:

```JavaScript
const closed = Channel();
closed.close();

switch (await Channel.select([alice.shift(), bob.shift(), closed.shift())]) {
  case alice:
    console.log(`Alice said ${alice.value}.`);
    break;

  case bob:
    console.log(`Bob said ${bob.value}.`);
    break;

  default:
    console.log(`No one has anything to say yet.`);
}
```

You can also arrange it so that the `select` completes within a timeout:

```JavaScript
const timeout = Channel();
setTimeout(timeout.close, 1000);

switch (await Channel.select([alice.shift(), bob.shift(), timeout.shift())]) {
  case alice:
    console.log(`Alice said ${alice.value}.`);
    break;

  case bob:
    console.log(`Bob said ${bob.value}.`);
    break;

  default:
    console.log(`I stopped listening after one second.`);
}
```

## value

Set to the most recently `shift`ed value.  This is useful when used in
combination with `select`.

# Array-like Properties

These methods are similar to the equivalently named methods of `Array`.

## Channel

### Channel([bufferLength = 0]) -> Channel

Create a new `Channel` with an optional buffer.  This allows an async function
to push up to `bufferLength` values before blocking.

### Channel.isChannel(value) -> Boolean

Return `true` if `value` is a channel, `false` otherwise.

### Channel.of(...values) -> Channel

Push `values` into a new channel and then close it.

### Channel.from(iterable | stream.Readable) -> Channel

Create a new `Channel` from an iterable or a [Node.js readable stream](https://nodejs.org/api/stream.html#stream_readable_streams).

## Channel Object

### every (callbackfn[, thisArg]) -> async Boolean

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

### filter(callbackfn[, thisArg]) -> Channel

`callbackfn` should be a function that accepts an argument and returns a value
that is coercible to the Boolean values `true` or `false`.  `filter` calls
`callbackfn` once for each value in the channel and constructs a new channel of
all the values for which `callbackfn` returns true.

If a `thisArg` parameter is provided, it will be used as the `this` value for
each invocation of `callbackfn`. If it is not provided, `undefined` is used
instead.

Unlike in the Array version of `filter`, `callbackfn` is called with only one
argument.

### forEach(callbackfn[, thisArg]) -> async

The promise returned by `forEach` resolves when the channel is closed:

```JavaScript
const toArray = async channel => {
  const array = [];

  await channel.forEach(value => {
    array.push(value);
  });

  return array;
};
```

If `callbackfn` is async then `forEach` will wait for it before iterating to the
next value:

```JavaScript
const pipe = async (source, sink) => {
  await source.forEach(sink.push);
  sink.close();
};
```

### join(separator) -> async String

The values of the channel are converted to Strings, and these Strings are then
concatenated, separated by occurrences of the separator. If no separator is
provided, a single comma is used as the separator.

### map(callbackfn[, thisArg]) -> Channel

`callbackfn` should be a function that accepts one argument. `map` calls
`callbackfn` once for each value in the channel and constructs a new Channel
from the results.

If a `thisArg` parameter is provided, it will be used as the `this` value for
each invocation of `callbackfn`. If it is not provided, `undefined` is used
instead.

Unlike `Array`'s method, `callbackfn` is called with only one argument.

### push(value) -> async bufferLength

Send the value into the channel and return a promise that resolves when the
value has been shifted or placed in the buffer.

* Throw a `TypeError` when attempting to push to a closed channel.
* Throw a `TypeError` when attempting to push `undefined` because it's a
  reserved value used to indicate a closed channel.

The push can be cancelled before completion by calling `cancel` on the
returned promise.

Unlike `Array`'s method, accept only one `value` at a time.

### reduce(callbackfn[, initialValue])

`callbackfn` should be a function that takes two arguments (unlike `Array`'s
version which takes four). `reduce` calls the callback, as a function, once for
each value after the first value present in the channel.

`callbackfn` is called with two arguments: the `previousValue` (value from the
previous call to `callbackfn`) and the `currentValue`. The first time that
callback is called, the `previousValue` and `currentValue` can be one of two
values. If an `initialValue` was provided in the call to `reduce`, then
`previousValue` will be equal to `initialValue` and `currentValue` will be equal
to the first value in the channel. If no `initialValue` was provided, then
`previousValue` will be equal to the first value in the channel and
`currentValue` will be equal to the second. It is a `TypeError` if the channel
contains no values and `initialValue` is not provided.

### shift() -> async

Return a promise that resolves when an value is received from the channel.
Closed channels always return `undefined` immediately.

The shift can be cancelled before completion by calling `cancel` on the
returned promise.

### slice(start, end) -> Channel

# Functional API

There is a parallel API to support functional-style programming.  Every channel
method is also available as an independent function in the `Channel` namespace
that takes a channel as the final argument.  For example, `slice` can be called
in either of the following two ways:

```JavaScript
// method
channel.slice(10);

// function
Channel.slice(10, Infinity, channel);
```

You can also use partial application:

```JavaScript
Channel.slice(10, Infinity)(channel);
Channel.slice(10)(Infinity)(channel);
```
