// errorcheck

// Copyright 2009 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Test various correct and incorrect permutations of send-only,
// receive-only, and bidirectional channels.

"use strict";

const assert = require(`@nodeguy/assert`);
const Channel = require("../../lib");

it(`perm`, function() {
  const c = Channel();
  const cr = Channel().readOnly();
  const cs = Channel().writeOnly();

  const n = 0;

  assert.throws(() => {
    Channel.shift(n); // ERROR "receive from non-chan"
  });

  assert.throws(() => {
    Channel.push(2, n); // ERROR "send to non-chan"
  });

  c.push(0); // ok
  c.shift(); // ok

  assert.throws(() => {
    cr.push(0); // ERROR "send"
  });

  cr.shift(); // ok

  cs.push(0); // ok

  assert.throws(() => {
    cs.shift(); // ERROR "receive"
  });

  Channel.select([
    c.push(0), // ok
    c.shift() // ok
  ]);

  assert.throws(() => {
    Channel.select([
      cr.push(0) // ERROR "send"
    ]);
  });

  Channel.select([cr.shift()]); // ok

  Channel.select([cs.push(0)]); // ok

  assert.throws(() => {
    Channel.select([cs.shift()]); // ERROR "receive"
  });

  assert.throws(() => {
    cs.forEach(() => {}); // ERROR "receive"
  });

  c.close();
  cs.close();

  assert.throws(() => {
    cr.close(); // ERROR "receive"
  });

  assert.throws(() => {
    Channel.close(n); // ERROR "invalid operation.*non-chan type"
  });
});
