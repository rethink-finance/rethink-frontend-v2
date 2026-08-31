/**
 * Stands in for the `randomfill` CommonJS package, which crypto-browserify
 * pulls in for randomFill/randomFillSync.
 *
 * Rollup's CommonJS plugin mis-transforms that package: it rewrites the
 * `module.exports` branch of
 *
 *   crypto.getRandomValues ? (exports.randomFill = …) : (browser.randomFill = …)
 *
 * but leaves the `exports.` branch alone. A browser always takes the branch
 * that was left untouched, so the module throws "exports is not defined" as
 * soon as a chunk containing it evaluates — taking the whole route with it,
 * reported by Nuxt as an unresolvable component rather than as this.
 *
 * The real package is a Web Crypto wrapper with a Node-shaped signature, which
 * is small enough to keep honestly. crypto-browserify is otherwise untouched,
 * so anything relying on createHash and friends still works.
 */

const MAX_BYTES = 65536;

function assertOffsetAndSize(buf, offset, size) {
  if (typeof offset !== "number" || offset !== offset) {
    throw new TypeError("offset must be a number");
  }
  if (offset > 4294967295 || offset < 0) {
    throw new TypeError("offset must be a uint32");
  }
  if (offset > buf.length) {
    throw new RangeError("offset out of range");
  }

  if (typeof size !== "number" || size !== size) {
    throw new TypeError("size must be a number");
  }
  if (size > 4294967295 || size < 0) {
    throw new TypeError("size must be a uint32");
  }
  if (size + offset > buf.length) {
    throw new RangeError("buffer too small");
  }
}

function fill(buf, offset, size) {
  // A Buffer is a Uint8Array view over a larger pool, so the view has to be
  // built from byteOffset rather than from index 0.
  const view = new Uint8Array(
    buf.buffer ?? buf,
    (buf.byteOffset ?? 0) + offset,
    size,
  );

  // getRandomValues rejects anything over 64 KiB in one call.
  for (let filled = 0; filled < size; filled += MAX_BYTES) {
    globalThis.crypto.getRandomValues(
      view.subarray(filled, Math.min(filled + MAX_BYTES, size)),
    );
  }

  return buf;
}

export function randomFillSync(buf, offset = 0, size) {
  if (!(buf instanceof Uint8Array)) {
    throw new TypeError('"buf" argument must be a Buffer or Uint8Array');
  }
  if (size === undefined) size = buf.length - offset;
  assertOffsetAndSize(buf, offset, size);
  return fill(buf, offset, size);
}

export function randomFill(buf, offset, size, cb) {
  if (!(buf instanceof Uint8Array)) {
    throw new TypeError('"buf" argument must be a Buffer or Uint8Array');
  }

  // The Node signature lets offset and size each be omitted, with the callback
  // sliding into whichever position is free.
  if (typeof offset === "function") {
    cb = offset;
    offset = 0;
    size = buf.length;
  } else if (typeof size === "function") {
    cb = size;
    size = buf.length - offset;
  } else if (typeof cb !== "function") {
    throw new TypeError('"cb" argument must be a function');
  }

  assertOffsetAndSize(buf, offset, size);

  // Callers expect this to be asynchronous even though Web Crypto is not.
  Promise.resolve().then(() => {
    try {
      cb(null, fill(buf, offset, size));
    } catch (error) {
      cb(error);
    }
  });
}

export default { randomFill, randomFillSync };
