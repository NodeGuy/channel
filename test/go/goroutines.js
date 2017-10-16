// Copyright 2009 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Torture test for goroutines.
// Make a lot of goroutines, threaded together, and tear them down cleanly.

"use strict";

const Channel = require("../../lib");

it(`goroutines`, async function() {
  const f = async (left, right) => {
    await left.push(await right.shift());
  };

  const n = 10000;
  const leftmost = Channel();
  let right = leftmost;
  let left = leftmost;

  for (let i = 0; i < n; i++) {
    right = Channel();
    f(left, right);
    left = right;
  }

  (async c => {
    await c.push(1);
  })(right);

  await leftmost.shift();
});
