"use strict";

const assert = require("@nodeguy/assert");
const Channel = require("../lib");
const stream = require("stream");

const assertRejects = async (callback, reason) => {
  try {
    await callback();
  } catch (exception) {
    if (reason) {
      assert.deepEqual(exception, reason);
    }

    return;
  }

  assert.fail(null, reason, `Missing expected rejection.`);
};

describe(`Channel`, function() {
  it(`allows the use of new`, function() {
    return new Channel();
  });

  it(`is frozen`, function() {
    assert.throws(() => {
      Channel.frozen = false;
    });
  });

  it(`creates a frozen object`, function() {
    assert.throws(() => {
      Channel().frozen = false;
    });
  });

  it(`creates a buffered channel`, async function() {
    const channel = Channel(3);
    await channel.push(0);
    await channel.push(1);
    await channel.push(2);
    await channel.close();
    assert.deepEqual(await channel.values(), [0, 1, 2]);
  });

  describe(`from`, function() {
    it(`callback`, async function() {
      let counter = 0;
      const callback = () => (counter < 3 ? counter++ : undefined);
      assert.deepEqual(await Channel.from(callback).values(), [0, 1, 2]);
    });

    it(`iterable`, async function() {
      assert.deepEqual(await Channel.from([0, 1, 2]).values(), [0, 1, 2]);
    });

    it(`Node.js's stream.readOnly`, async function() {
      const readOnly = stream.PassThrough({ objectMode: true });
      readOnly.write(0);
      readOnly.write(1);
      readOnly.end(2);
      assert.deepEqual(await Channel.from(readOnly).values(), [0, 1, 2]);
    });
  });

  it(`isChannel`, function() {
    assert(Channel.isChannel(Channel.of(0, 1, 2)));
    assert(!Channel.isChannel(Array.of(0, 1, 2)));
    assert(Channel.isChannel(Channel().readOnly()));
    assert(Channel.isChannel(Channel().writeOnly()));
  });

  it(`of`, async function() {
    assert.deepEqual(await Channel.of(0, 1, 2).values(), [0, 1, 2]);
  });

  describe(`select`, function() {
    it(`miscellaneous`, async function() {
      const a = Channel();
      const b = Channel();
      (async () => {
        await b.push(0);
        await a.push(1);
        await a.shift();
      })();

      assert.equal(await Channel.select([a.shift(), b.shift()]), b);
      assert.equal(b.value(), 0);
      assert.equal(await a.shift(), 1);
      assert.equal(await Channel.select([a.push(0), b.shift()]), a);
    });
  });

  it(`allows for non-blocking selects`, async function() {
    const a = Channel();
    const b = Channel();

    switch (await Channel.select([
      a.shift(),
      b.push(0),
      Channel.of().shift()
    ])) {
      case a:
        assert(false);
        break;

      case b:
        assert(false);
        break;

      default:
        assert(true);
        break;
    }
  });

  it(`cancel`, async function() {
    const channel = Channel();
    Channel.select([channel.push(`cancelled`)]).cancel();
    const closed = Channel.of();
    assert.equal(
      await Channel.select([channel.shift(), closed.shift()]),
      closed
    );
  });

  it(`complains when given non-channel method promises`, function() {
    return assertRejects(async () => {
      await Channel.select([Promise.resolve()]);
    }, new TypeError(`Channel.select accepts only promises returned by push & shift.`));
  });

  it(`complains if not given an array`, function() {
    return assertRejects(async () => {
      await Channel.select(Channel.of(0).shift(), Channel.of(1).shift());
    }, new TypeError(`Channel.select: Argument must be an array.`));
  });
});

describe(`functional interface`, async function() {
  it(`shift`, async function() {
    assert.equal(await Channel.shift(Channel.of(0)), 0);
  });

  describe(`slice`, function() {
    it(`full application`, async function() {
      assert.deepEqual(
        await Channel.slice(1, 4, Channel.of(0, 1, 2, 3, 4)).values(),
        [1, 2, 3]
      );
    });

    it(`single argument application`, async function() {
      assert.deepEqual(
        await Channel.slice(1)(4)(Channel.of(0, 1, 2, 3, 4)).values(),
        [1, 2, 3]
      );
    });

    it(`double argument application`, async function() {
      assert.deepEqual(
        await Channel.slice(1, 4)(Channel.of(0, 1, 2, 3, 4)).values(),
        [1, 2, 3]
      );
    });
  });
});

describe(`Channel object`, function() {
  describe(`close`, function() {
    it(`can't close an already closed channel`, function() {
      const channel = Channel();
      channel.close();

      return assertRejects(async () => {
        await channel.close();
      }, new Error(`Can't close an already-closed channel.`));
    });

    it(`can't push to a closed channel`, async function() {
      const channel = Channel();
      channel.close();

      return assertRejects(async () => {
        await channel.push(0);
      }, new Error(`Can't push to closed channel.`));
    });

    it(`returns 'undefined' immediately from shift`, async function() {
      const channel = Channel();
      channel.close();
      assert.strictEqual(await channel.shift(), undefined);
    });
  });

  it(`every`, async function() {
    const even = number => number % 2 === 0;
    assert(!await Channel.of(0, 1, 2).every(even));
    assert(await Channel.of(0, 2, 4).every(even));
  });

  it(`filter`, async function() {
    assert.deepEqual(
      await Channel.of(0, 1, 2, 3, 4, 5)
        .filter(value => value % 2 !== 0)
        .values(),
      [1, 3, 5]
    );
  });

  it(`forEach`, async function() {
    const output = Channel();
    (async () => {
      await Channel.of(0, 1, 2).forEach(output.push);
      output.close();
    })();

    assert.deepEqual(await output.values(), [0, 1, 2]);
  });

  it(`join`, async function() {
    assert.equal(await Channel.of(`a`, `b`, `c`).join(), `a,b,c`);
  });

  it(`length`, function() {
    assert.equal(Channel(42).length, 42);
  });

  it(`map`, async function() {
    assert.deepEqual(
      await Channel.of(`a`, `b`, `c`)
        .map(value => value.toUpperCase())
        .values(),
      [`A`, `B`, `C`]
    );
  });

  describe(`push`, function() {
    it(`with shift`, async function() {
      const channel = Channel();
      (async () => {
        await channel.push(0);
      })();

      assert.equal(await channel.shift(), 0);
    });

    describe(`undefined`, function() {
      it(`outside select`, function() {
        const channel = Channel();

        return assertRejects(async () => {
          await channel.push(undefined);
        }, new TypeError(`Can't push 'undefined' to channel, use close instead.`));
      });

      it(`inside select`, function() {
        const channel = Channel();

        return assertRejects(async () => {
          await Channel.select([channel.push(undefined)]);
        }, new TypeError(`Can't push 'undefined' to channel, use close instead.`));
      });
    });

    it(`disallows multiple values`, function() {
      const channel = Channel();

      return assertRejects(async () => {
        await channel.push(0, 1, 2);
      }, new Error(`Can't push more than one value at a time.`));
    });

    it(`returns a frozen promise`, function() {
      assert.throws(() => {
        Channel().push(0).frozen = false;
      });
    });
  });

  it(`readOnly`, async function() {
    const channel = Channel();
    const readOnly = channel.readOnly();

    assert.throws(() => {
      readOnly.close();
    });

    assert.throws(() => {
      readOnly.push(0);
    });

    assert.throws(() => {
      readOnly.writeOnly();
    });
    (async () => {
      await channel.push(1);
    })();

    assert.equal(readOnly.readOnly(), readOnly);
    assert.equal(await readOnly.shift(), 1);
    assert.equal(readOnly.value(), 1);

    assert.throws(() => {
      readOnly.frozen = false;
    });
  });

  describe(`reduce`, function() {
    it(`callbackfn only`, async function() {
      assert.equal(await Channel.of(0, 1, 2).reduce(Math.max), 2);
    });

    it(`initialValue`, async function() {
      assert.equal(await Channel.of(0, 1, 2).reduce(Math.max, 10), 10);
    });

    it(`no values without initialValue`, function() {
      return assertRejects(async () => {
        await Channel.of().reduce(Math.max);
      }, new TypeError(`No values in channel and initialValue wasn't provided.`));
    });
  });

  describe(`shift`, function() {
    it(`with push`, async function() {
      const channel = Channel();
      (async () => {
        await channel.push(0);
      })();

      assert.equal(await channel.shift(), 0);
    });

    it(`returns a frozen promise`, function() {
      assert.throws(() => {
        Channel().shift().frozen = false;
      });
    });
  });

  describe(`slice`, function() {
    it(`start`, async function() {
      assert.deepEqual(
        await Channel.of(0, 1, 2)
          .slice(1)
          .values(),
        [1, 2]
      );
    });

    it(`end`, async function() {
      assert.deepEqual(
        await Channel.of(0, 1, 2, 3, 4)
          .slice(1, 4)
          .values(),
        [1, 2, 3]
      );
    });
  });

  it(`some`, async function() {
    const even = value => value % 2 === 0;
    const channel = Channel.of(0, 1, 2);
    assert(await channel.some(even));
    assert.deepEqual(await channel.values(), [1, 2]);
    assert(!await Channel.of(1, 3, 5).some(even));
  });

  it(`toString`, function() {
    assert.equal(Channel(10).toString(), `Channel(10)`);
  });

  it(`value`, async function() {
    const channel = Channel(1);
    await channel.push(null);
    await channel.shift();
    assert.equal(channel.value(), null);
    channel.close();
    await channel.shift();
    assert.equal(channel.value(), undefined);
  });

  it(`values`, async function() {
    assert.deepEqual(await Channel.of(0, 1, 2).values(), [0, 1, 2]);
  });

  describe(`writeOnly`, function() {
    it(`provides only write methods`, async function() {
      const channel = Channel();
      const writeOnly = channel.writeOnly();

      assert.throws(() => {
        writeOnly.readOnly();
      });

      assert.throws(() => {
        writeOnly.shift();
      });

      assert.equal(writeOnly.value, undefined);
      (async () => {
        await channel.shift();
      })();

      await writeOnly.push(0);
      writeOnly.close();

      assert.throws(() => {
        writeOnly.frozen = false;
      });
    });
  });
});
