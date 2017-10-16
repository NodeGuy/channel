// Copyright 2009 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Test the situation in which two cases of a select can
// both end up running. See http://codereview.appspot.com/180068.

"use strict";

const Channel = require("../../lib");

it(`doubleselect`, async function() {
  this.timeout(10 * 1000);
  const iterations = 100000; // number of iterations

  // sender sends a counter to one of four different channels. If two cases both
  // end up running in the same iteration, the same value will be sent to two
  // different channels.
  const sender = async (n, c1, c2, c3, c4) => {
    for (let i = 0; i < n; i++) {
      await Channel.select(c1.push(i), c2.push(i), c3.push(i), c4.push(i));
    }

    c1.close();
    c2.close();
    c3.close();
    c4.close();
  };

  // mux receives the values from sender and forwards them onto another channel.
  // It would be simpler to just have sender's four cases all be the same
  // channel, but this doesn't actually trigger the bug.
  const mux = async (output, input, done) => {
    await input.forEach(async value => {
      await output.push(value);
    });

    await done.push(true);
  };

  // recver gets a steam of values from the four mux's and checks for
  // duplicates.
  const recver = input => {
    const seen = new Map();

    input.forEach(v => {
      if (seen.has(v)) {
        throw new Error(`got duplicate value: ${v}`);
      }

      seen.set(v, true);
    });
  };

  const c1 = Channel();
  const c2 = Channel();
  const c3 = Channel();
  const c4 = Channel();
  const done = Channel();
  const cmux = Channel();
  sender(iterations, c1, c2, c3, c4);
  mux(cmux, c1, done);
  mux(cmux, c2, done);
  mux(cmux, c3, done);
  mux(cmux, c4, done);

  // We keep the recver because it might catch more bugs in the future.
  // However, the result of the bug linked to at the top is that we'll
  // end up panicking with: "throw: bad g->status in ready".
  recver(cmux);

  await done.shift();
  await done.shift();
  await done.shift();
  await done.shift();
  cmux.close();
});
