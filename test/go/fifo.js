// Copyright 2009 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Test that unbuffered channels act as pure fifos.

"use strict";

const Channel = require(`../../lib`);

it(`fifo`, function() {
  const N = 10;

  const AsynchFifo = async () => {
    const ch = Channel(10);

    for (let i = 0; i < N; i++) {
      await ch.push(i);
    }

    for (let i = 0; i < N; i++) {
      if ((await ch.shift()) !== i) {
        throw new Error(`bad receive`);
      }
    }
  };

  const Chain = async (ch, val, input, output) => {
    await input.shift();

    if ((await ch.shift()) !== val) {
      throw new Error(val);
    }

    await output.push(1);
  };

  // thread together a daisy chain to read the elements in sequence
  const SynchFifo = async () => {
    const ch = Channel();
    let input = Channel();
    let start = input;

    for (let i = 0; i < N; i++) {
      const output = Channel();
      Chain(ch, i, input, output);
      input = output;
    }

    await start.push(0);

    for (let i = 0; i < N; i++) {
      await ch.push(i);
    }

    await input.shift();
  };

  AsynchFifo();
  SynchFifo();
});
