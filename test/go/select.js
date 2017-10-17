// Copyright 2009 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Test simple select.

"use strict";

const Channel = require("../../lib");

it(`select`, async function() {
  const closed = Channel();
  closed.close();
  let counter = 0;
  let shift = 0;

  const GetValue = () => {
    counter++;
    return 1 << shift;
  };

  const Send = async (a, b) => {
    let done = false;
    let i = 0;

    do {
      switch (await Channel.select([
        a.push(GetValue()),
        b.push(GetValue()),
        closed.shift()
      ])) {
        case a:
          i++;
          a = Channel();
          break;

        case b:
          i++;
          b = Channel();
          break;

        default:
          done = true;
      }

      shift++;
    } while (!done);

    return i;
  };

  let a = Channel(1);
  let b = Channel(1);
  let v = await Send(a, b);

  if (v !== 2) {
    throw new Error(`Send returned ${v} !== 2`);
  }

  const av = await a.shift();
  const bv = await b.shift();

  if ((av | bv) !== 3) {
    throw new Error(`bad values ${av} ${bv}`);
  }

  v = await Send(a, Channel());

  if (v !== 1) {
    throw new Error(`Send returned ${v} !== 1`);
  }

  if (counter !== 10) {
    throw new Error(`counter is ${counter} !== 10`);
  }
});
