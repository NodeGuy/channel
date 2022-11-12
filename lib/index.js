"use strict";

// An order represents a pending push or shift.
const Order = (channel) => {
  let order;
  const preonFulfilleds = [];

  const promise = new Promise((resolve, reject) => {
    order = {
      resolve: (value) => {
        preonFulfilleds.forEach((preonFulfilled) => {
          preonFulfilled(value);
        });

        resolve(value);
      },

      reject,
    };
  });

  Object.assign(promise, {
    cancel: () => {
      order.cancelled = true;
    },

    channel,

    prethen: (onFulfilled) => {
      preonFulfilleds.push(onFulfilled);
    },
  });

  return { order, promise };
};

const prototype = {};

// Create a new channel with a buffer the size of "length".
const Channel = function(length = 0) {
  let buffered = 0;
  let closed = false;
  let lastValue;
  const pushes = [];
  const shifts = [];

  const matchPushesAndShifts = (index) => {
    while (index.push < pushes.length && index.shift < shifts.length) {
      const push = pushes[index.push];
      const shift = shifts[index.shift];

      if (push.cancelled) {
        index.push++;
      } else if (shift.cancelled) {
        index.shift++;
      } else {
        lastValue = push.value;
        shift.resolve(lastValue);
        index.shift++;
        push.resolve(length);
        index.push++;
        buffered = Math.max(0, buffered - 1);
      }
    }
  };

  // Resolve push promises up to the end of the buffer.
  const resolveBufferedPushes = (index) => {
    for (
      let resolvedIndex = index.push + buffered;
      resolvedIndex < pushes.length && buffered < length;
      resolvedIndex++
    ) {
      const { cancelled, resolve } = pushes[resolvedIndex];

      if (!cancelled) {
        buffered++;
        resolve(length);
      }
    }
  };

  const resolveClosedShifts = (index) => {
    for (; index.shift < shifts.length; index.shift++) {
      const { cancelled, resolve } = shifts[index.shift];

      if (!cancelled) {
        lastValue = undefined;
        resolve(lastValue);
      }
    }
  };

  // Process the push and shift queues like an order book, looking for matches.
  const processOrders = () => {
    const index = { push: 0, shift: 0 };
    matchPushesAndShifts(index);
    resolveBufferedPushes(index);

    // If the channel is closed then resolve 'undefined' to remaining shifts.
    if (closed) {
      resolveClosedShifts(index);
    }

    pushes.splice(0, index.push);
    shifts.splice(0, index.shift);
  };

  const readOnly = Object.freeze(
    Object.assign(Object.create(prototype), {
      concat: (first, ...rest) => {
        const output = Channel();

        (async () => {
          await readOnly.forEach(output.push);

          if (Channel.isChannel(first)) {
            await first.concat(...rest).forEach(output.push);
          } else {
            await output.push(first);
          }

          await output.close();
        })();

        return output;
      },

      every: async (callbackfn, thisArg) => {
        for (;;) {
          const value = await readOnly.shift();

          if (value === undefined) {
            return true;
          } else {
            if (!callbackfn.call(thisArg, value)) {
              return false;
            }
          }
        }
      },

      filter: (callbackfn, thisArg) =>
        readOnly.flatMap((value) =>
          callbackfn.call(thisArg, value) ? Channel.of(value) : Channel.of()
        ),

      flat: (depth) =>
        readOnly.flatMap((value) =>
          Channel.isChannel(value)
            ? depth > 1
              ? value.flat(depth - 1)
              : value
            : Channel.of(value)
        ),

      flatMap: (mapperFunction, thisArg) => {
        const output = Channel();

        (async () => {
          await readOnly.forEach(async (value) => {
            await mapperFunction.call(thisArg, value).forEach(output.push);
          });

          await output.close();
        })();

        return output;
      },

      forEach: async (callbackfn, thisArg) => {
        for (;;) {
          const value = await readOnly.shift();

          if (value === undefined) {
            break;
          } else {
            await callbackfn.call(thisArg, value);
          }
        }
      },

      join: async (separator) => (await readOnly.values()).join(separator),

      map: (callbackfn, thisArg) =>
        readOnly.flatMap((value) =>
          Channel.of(callbackfn.call(thisArg, value))
        ),

      readOnly: () => readOnly,

      reduce: async (callbackfn, ...initialValue) => {
        let previousValue = initialValue[0];
        let previousValueDefined = initialValue.length > 0;

        await readOnly.forEach((currentValue) => {
          if (previousValueDefined) {
            previousValue = callbackfn(previousValue, currentValue);
          } else {
            previousValue = currentValue;
            previousValueDefined = true;
          }
        });

        if (previousValueDefined) {
          return previousValue;
        } else {
          throw new TypeError(
            `No values in channel and initialValue wasn't provided.`
          );
        }
      },

      shift: function() {
        const { order, promise } = Order(this);
        shifts.push(order);
        queueMicrotask(processOrders);

        // Don't freeze promise because Bluebird expects it to be mutable.
        return promise;
      },

      slice: (start = 0, end = Infinity) => {
        const output = Channel();

        (async () => {
          // Consume values before the starting point.
          for (let index = 0; index < start; index++) {
            await readOnly.shift();
          }

          for (let index = start; index < end; index++) {
            const value = await readOnly.shift();

            if (value === undefined) {
              break;
            } else {
              await output.push(value);
            }
          }

          await output.close();
        })();

        return output;
      },

      some: async (callbackfn, thisArg) => {
        for (;;) {
          const value = await readOnly.shift();

          if (value === undefined) {
            return false;
          } else {
            if (callbackfn.call(thisArg, value)) {
              return true;
            }
          }
        }
      },

      toString: () => `Channel(${length})`,

      value: () => lastValue,

      values: async () => {
        const array = [];

        await readOnly.forEach((item) => {
          array.push(item);
        });

        return array;
      },
    })
  );

  const writeOnly = Object.freeze(
    Object.assign(Object.create(prototype), {
      close: () =>
        new Promise((resolve, reject) => {
          if (closed) {
            reject(new Error(`Can't close an already-closed channel.`));
          } else {
            closed = true;
            processOrders();

            // Give remaining orders in flight time to resolve before returning.
            queueMicrotask(resolve);
          }
        }),

      length,

      push: function(value) {
        const { order, promise } = Order(this);
        order.value = value;

        // If value is a promise that rejects, catch it in case there hasn't
        // been a matching shift yet in order to prevent an unhandledRejection
        // error.
        Promise.resolve(value).catch(() => {});

        if (closed) {
          order.reject(new Error(`Can't push to closed channel.`));
        } else if (value === undefined) {
          order.reject(
            new TypeError(
              `Can't push 'undefined' to channel, use close instead.`
            )
          );
        } else if (arguments.length > 1) {
          order.reject(new Error(`Can't push more than one value at a time.`));
        } else {
          pushes.push(order);
          queueMicrotask(processOrders);
        }

        // Don't freeze promise because Bluebird expects it to be mutable.
        return promise;
      },

      writeOnly: () => writeOnly,
    })
  );

  return Object.freeze(
    Object.assign(Object.create(prototype), readOnly, writeOnly)
  );
};

Channel.all = (channels) => {
  const output = Channel();

  (async () => {
    for (;;) {
      const values = await Promise.all(channels.map(Channel.shift));

      if (values.every((value) => value === undefined)) {
        break;
      } else {
        await output.push(values);
      }
    }

    await output.close();
  })();

  return output;
};

// Node.js stream.readable
const fromNodeStream = (channel, stream) => {
  stream.on(`readable`, async () => {
    for (;;) {
      const data = stream.read();

      if (data === null) {
        break;
      } else {
        await channel.push(data);
      }
    }
  });

  stream.once(`end`, channel.close);
};

Channel.from = (values, mapfn, thisArg) => {
  const channel = Channel();

  (async () => {
    // iterable
    try {
      for (let value of values) {
        await channel.push(value);
      }

      await channel.close();
    } catch (exception) {
      // callback function
      try {
        for (;;) {
          const value = values();

          if (value === undefined) {
            await channel.close();
            break;
          } else {
            await channel.push(value);
          }
        }
      } catch (exception) {
        fromNodeStream(channel, values);
      }
    }
  })();

  return (mapfn ? channel.map(mapfn, thisArg) : channel).readOnly();
};

Channel.of = (...values) => Channel.from(values);

Channel.isChannel = (value) =>
  value !== undefined &&
  value !== null &&
  Object.getPrototypeOf(value) === prototype;

Channel.select = (methodPromises) => {
  if (!Array.isArray(methodPromises)) {
    throw new TypeError(`Channel.select: Argument must be an array.`);
  }

  const selectPromise = new Promise((resolve, reject) => {
    methodPromises.forEach(async (promise) => {
      try {
        promise.prethen(() => {
          // We've been given a heads-up that this method will complete first
          // so cancel the other method calls.
          methodPromises.forEach((other) => {
            if (other !== promise) {
              other.cancel();
            }
          });
        });

        try {
          await promise;
        } catch (exception) {
          reject(exception);
        }

        resolve(promise.channel);
      } catch (exception) {
        reject(
          new TypeError(
            `Channel.select accepts only promises returned by push & shift.`
          )
        );
      }
    });
  });

  return Object.assign(selectPromise, {
    cancel: () => methodPromises.forEach((promise) => promise.cancel()),
  });
};

// functional interface allowing full or partial application
//
// Channel.slice(10, Infinity, channel)
// Channel.slice(10, Infinity)(channel)
// Channel.slice(10)(Infinity)(channel)

const channel = Channel();

const methods = Object.keys(channel).filter(
  (method) => typeof channel[method] === `function`
);

const arities = {
  reduce: 2,
  slice: 2,
};

methods.forEach((method) => {
  const bound = function(...args) {
    const arity = arities[method] || channel[method].length;

    return args.length > arity
      ? args[arity][method](...args.slice(0, arity))
      : bound.bind(this, ...args);
  };

  Channel[method] = bound;
});

Channel.default = Channel;

module.exports = Object.freeze(Channel);
