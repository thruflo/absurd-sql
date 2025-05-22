# Bugs and Issues in absurd-sql

This document outlines potential bugs and issues found in the absurd-sql codebase, prioritized by severity and potential impact.

## High Priority Issues (Data Integrity & Crashes)

### 1. Race Condition in flush() Method
**File:** `src/indexeddb/file-ops-fallback.js`
**Issue:** In the `flush()` method, `this.writeQueue` is set to an empty array before the write operation completes. This could lead to data loss if new writes are queued during this time.

```javascript
flush() {
  if (this.writeQueue.length > 0) {
    this.persistance.write(
      this.writeQueue,
      this.cachedFirstBlock,
      this.lockType > LOCK_TYPES.SHARED
    );
    this.writeQueue = []; // <-- Potential race condition here
  }
  this.cachedFirstBlock = null;
}
```

**Fix:** Modify the method to await the completion of the write operation before resetting the queue:

```javascript
async flush() {
  if (this.writeQueue.length > 0) {
    const queue = this.writeQueue;
    this.writeQueue = [];
    await this.persistance.write(
      queue,
      this.cachedFirstBlock,
      this.lockType > LOCK_TYPES.SHARED
    );
  }
  this.cachedFirstBlock = null;
}
```

### 2. Improper Buffer Handling in write Method
**File:** `src/sqlite-file.js`
**Issue:** The `write` method doesn't properly validate if `buffer.byteLength` is less than `offset`, which could lead to buffer overruns or data corruption.

```javascript
length = Math.min(length, buffer.byteLength - offset);
```

**Fix:** Add proper validation to handle this case:

```javascript
if (buffer.byteLength <= offset) {
  return 0;
}
length = Math.min(length, buffer.byteLength - offset);
```

### 3. Potential Name Collisions in getStoreName()
**File:** `src/indexeddb/file-ops.js`
**Issue:** The `getStoreName()` method simply replaces forward slashes with hyphens, which could lead to name collisions if different paths result in the same transformed name.

```javascript
getStoreName() {
  return this.filename.replace(/\//g, '-');
}
```

**Fix:** Implement a more collision-resistant approach:

```javascript
getStoreName() {
  // Use a more unique transformation that preserves path structure
  return this.filename.replace(/\//g, '--').replace(/\./g, '-dot-');
}
```

## Medium Priority Issues (Performance & Reliability)

### 4. Missing Timeout Handling in waitWrite
**File:** `src/indexeddb/shared-channel.js`
**Issue:** The `waitWrite` method doesn't handle timeouts when `useAtomics` is false, potentially leading to deadlocks.

```javascript
waitWrite(name, timeout = null) {
  if (this.useAtomics) {
    // Timeout handling exists here
  } else {
    if (this.atomicView[0] !== READABLE) {
      throw new Error('`waitWrite` expected array to be readable');
    }
  }
}
```

**Fix:** Add timeout handling for the non-atomic case:

```javascript
waitWrite(name, timeout = null) {
  if (this.useAtomics) {
    // Existing code
  } else {
    if (timeout !== null) {
      const startTime = Date.now();
      while (this.atomicView[0] !== READABLE) {
        if (Date.now() - startTime > timeout) {
          throw new Error('timeout');
        }
      }
    } else if (this.atomicView[0] !== READABLE) {
      throw new Error('`waitWrite` expected array to be readable');
    }
  }
}
```

### 5. Hardcoded SharedArrayBuffer Size
**File:** `src/indexeddb/file-ops.js`
**Issue:** The SharedArrayBuffer size is hardcoded to 4096 * 9, which might be too small for large operations.

```javascript
open() {
  let argBuffer = new SharedArrayBuffer(4096 * 9);
  // ...
  let resultBuffer = new SharedArrayBuffer(4096 * 9);
  // ...
}
```

**Fix:** Make the buffer size configurable or dynamically sized:

```javascript
open(bufferSize = 4096 * 9) {
  let argBuffer = new SharedArrayBuffer(bufferSize);
  // ...
  let resultBuffer = new SharedArrayBuffer(bufferSize);
  // ...
}
```

### 6. Improper Empty Chunks Handling in readChunks
**File:** `src/sqlite-file.js`
**Issue:** The `readChunks` function doesn't properly handle the case when chunks are empty.

**Fix:** Add validation to handle empty chunks:

```javascript
export function readChunks(chunks, start, end) {
  if (!chunks || chunks.length === 0) {
    return new ArrayBuffer(end - start);
  }
  
  // Rest of the function
}
```

## Low Priority Issues (Code Quality)

### 7. Debug Logging in Production Code
**File:** `src/indexeddb/worker.js`
**Issue:** The `handleReadMeta` function contains console.log statements that should be removed in production code.

```javascript
async function handleReadMeta(writer, name) {
  return withTransaction(name, 'readonly', async trans => {
    try {
      console.log('Reading meta...'); // <-- Debug logging
      let res = await trans.get(-1);
      console.log(`Got meta for ${name}:`, res); // <-- Debug logging
      // ...
    }
  });
}
```

**Fix:** Remove or conditionally include these logs:

```javascript
async function handleReadMeta(writer, name) {
  return withTransaction(name, 'readonly', async trans => {
    try {
      if (process.env.NODE_ENV !== 'production') {
        console.log('Reading meta...');
      }
      let res = await trans.get(-1);
      if (process.env.NODE_ENV !== 'production') {
        console.log(`Got meta for ${name}:`, res);
      }
      // ...
    }
  });
}
```

### 8. Incomplete Initialization in Profile Methods
**File:** `src/indexeddb/backend.js`
**Issue:** The `startProfile` and `stopProfile` methods iterate over `this._files`, but `this._files` is only initialized in non-production environments.

```javascript
startProfile() {
  perf.start();
  for (let file of this._files) {
    // ...
  }
}
```

**Fix:** Add a check to ensure `this._files` exists:

```javascript
startProfile() {
  perf.start();
  if (this._files) {
    for (let file of this._files) {
      // ...
    }
  }
}
```

### 9. Truncated Code in worker.js
**File:** `src/indexeddb/worker.js`
**Issue:** There appears to be truncated code in the `closeDb` function, which might indicate an incomplete implementation.

**Fix:** Review and complete the implementation of the `closeDb` function.

### 10. Commented-Out Tests
**File:** `src/indexeddb/shared-channel.test.js`
**Issue:** There are commented-out tests, suggesting incomplete test coverage.

**Fix:** Uncomment and fix the tests to ensure proper test coverage.

## Additional Recommendations

1. **Implement Comprehensive Error Handling**: Many functions lack proper error handling, which could lead to silent failures or unexpected behavior.

2. **Add Type Checking**: Consider using TypeScript or JSDoc annotations to improve type safety and catch potential issues at compile time.

3. **Improve Documentation**: Add more detailed documentation to explain the purpose and behavior of complex functions, especially those related to concurrency and locking.

4. **Enhance Test Coverage**: Expand the test suite to cover edge cases and ensure all components work correctly together.

5. **Performance Optimization**: Review the code for performance bottlenecks, especially in the IndexedDB operations, and optimize where possible.

