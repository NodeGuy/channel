"use strict";

// An order represents a pending push or shift.
const Order = channel => {
  let order;
  const preonFulfilleds = [];

  const promise = new Promise((resolve, reject) => {
    order = {
      resolve: value => {
        preonFulfilleds.forEach(preonFulfilled => {
          preonFulfilled(value);
        });

        resolve(value);
      },

      reject
    };
  });

  Object.assign(promise, {
    cancel: () => {
      order.cancelled = true;
    },

    channel,

    prethen: onFulfilled => {
      preonFulfilleds.push(onFulfilled);
    }
  });

  return { order, promise };
};

const prototype = {};

const Channel = function(length = 0) {
  let buffered = 0;
  let closed = false;
  let lastValue;
  let resolvedIndex = 0;
  const pushes = [];
  const shifts = [];

  // Process the push and shift queues like an order book, looking for matches.
  const processOrders = () => {
    const index = { push: 0, shift: 0 };

    // Match pushes and shifts.
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
        buffered = Math.max(0, buffered - 1);
        index.push++;
        index.shift++;
      }
    }

    // Resolve push promises up to the end of the buffer.
    for (
      ;
      resolvedIndex < index.push ||
      (resolvedIndex < pushes.length && buffered < length);
      resolvedIndex++
    ) {
      const { cancelled, resolve } = pushes[resolvedIndex];

      if (!cancelled) {
        if (resolvedIndex > index.push) {
          buffered++;
        }

        resolve(length);
      }
    }

    // If the channel is closed then resolve 'undefined' to remaining shifts.
    if (closed) {
      for (; index.shift < shifts.length; index.shift++) {
        const { cancelled, resolve } = shifts[index.shift];

        if (!cancelled) {
          lastValue = undefined;
          resolve(lastValue);
        }
      }
    }

    pushes.splice(0, index.push);
    shifts.splice(0, index.shift);
    resolvedIndex -= index.push;
  };

  const readOnly = Object.freeze(
    Object.assign(Object.create(prototype), {
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

      filter: (callbackfn, thisArg) => {
        const output = Channel();
        (async () => {
          for (;;) {
            const value = await readOnly.shift();

            if (value === undefined) {
              await output.close();
              break;
            } else if (callbackfn.call(thisArg, value)) {
              await output.push(value);
            }
          }
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

      join: async separator => {
        const elements = [];

        await readOnly.forEach(element => {
          elements.push(element);
        });

        return elements.join(separator);
      },

      map: (callbackfn, thisArg) => {
        const output = Channel();
        (async () => {
          await readOnly.forEach(value => {
            output.push(callbackfn.call(thisArg, value));
          });

          output.close();
        })();

        return output;
      },

      readOnly: () => readOnly,

      reduce: async (callbackfn, ...initialValue) => {
        let previousValue = initialValue[0];
        let previousValueDefined = initialValue.length > 0;

        await readOnly.forEach(currentValue => {
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
        setImmediate(processOrders);
        return Object.freeze(promise);
      },

      slice: (start, end = Infinity) => {
        const output = Channel();
        (async () => {
          for (let index = 0; index < start; index++) {
            const value = await readOnly.shift();

            if (value === undefined) {
              break;
            }
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

        await readOnly.forEach(item => {
          array.push(item);
        });

        return array;
      }
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
            setImmediate(resolve);
          }
        }),

      length,

      push: function(value) {
        const { order, promise } = Order(this);
        order.value = value;

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
          setImmediate(processOrders);
        }

        return Object.freeze(promise);
      },

      writeOnly: () => writeOnly
    })
  );

  return Object.freeze(
    Object.assign(Object.create(prototype), readOnly, writeOnly)
  );
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
        // Node.js stream.readable
        values.on("readable", async () => {
          while (true) {
            const data = values.read();

            if (data === null) {
              break;
            } else {
              await channel.push(data);
            }
          }
        });

        values.once("end", channel.close);
      }
    }
  })();

  return (mapfn ? channel.map(mapfn, thisArg) : channel).readOnly();
};

Channel.of = (...values) => Channel.from(values);
Channel.isChannel = arg => Object.getPrototypeOf(arg) === prototype;

Channel.select = methodPromises =>
  Object.assign(
    new Promise((resolve, reject) => {
      try {
        methodPromises.forEach(async promise => {
          try {
            promise.prethen(() => {
              // We've been given a heads-up that this method will complete first
              // so cancel the other method calls.
              methodPromises.forEach(other => {
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
      } catch (exception) {
        reject(new TypeError(`Channel.select: Argument must be an array.`));
      }
    }),
    {
      cancel: () => Promise.all(methodPromises.map(promise => promise.cancel()))
    }
  );

// functional interface allowing full or partial application
//
// Channel.slice(10, Infinity, channel)
// Channel.slice(10, Infinity)(channel)
// Channel.slice(10)(Infinity)(channel)

const channel = Channel();

const methods = Object.keys(channel).filter(
  method => typeof channel[method] === `function`
);

methods.forEach(method => {
  const bound = function(...args) {
    const arity = method === `slice` ? 2 : channel[method].length;

    return args.length > arity
      ? args[arity][method](...args.slice(0, arity))
      : bound.bind(this, ...args);
  };

  Channel[method] = bound;
});

module.exports = Object.freeze(Channel);
