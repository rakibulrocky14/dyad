# Troubleshooting File Operations Issue

## Problem Description

**Issue**: When the agent processes multiple TODOs and generates multiple files, only the last file gets saved to disk, even though all files appear correctly in the chat interface.

**Symptoms**:

- Agent generates complete code for multiple files in chat
- All `<dyad-write>` tags appear correctly in the response
- Only the final file from the response is actually written to disk
- Previous files in the same response are missing from the filesystem

## Analysis: Is This Related to One-TODO Enforcement?

**Short Answer**: **NO** - The one-TODO enforcement system does NOT cause this issue.

**Detailed Explanation**:

1. **Enforcement Scope**: The one-TODO enforcement only affects agent workflow metadata (TODO status updates), not file operations
2. **Response Content**: The full response with all `<dyad-write>` tags passes through unchanged to the file writing system
3. **File Writing Logic**: File operations happen in `processFullResponseActions()` which runs AFTER enforcement
4. **Verification**: The response text is never modified by the enforcement logic

## System Flow Analysis

Here's the actual flow when processing agent responses:

```
1. Agent generates response with multiple <dyad-write> tags
2. processAgentStreamResult() - Handles TODO enforcement (metadata only)
3. processFullResponseActions() - Processes <dyad-write> tags and writes files
```

The enforcement happens at step 2, but file writing happens at step 3 with the original, unmodified response.

## Troubleshooting Steps

### Step 1: Verify File Writing Logic is Working

Run the test script to verify basic file operations:

```bash
cd dyad
node scripts/test-file-operations.js
```

This will test:

- Synchronous file writing (like the current system)
- Concurrent file writing
- Agent behavior simulation

### Step 2: Enable Debug Logging

Add temporary debug logging to see what's happening:

1. Open `dyad/src/ipc/processors/response_processor.ts`
2. Find the line `const dyadWriteTags = getDyadWriteTags(fullResponse);` (around line 114)
3. Add after it:

```javascript
console.log(`[DEBUG] Found ${dyadWriteTags.length} dyad-write tags:`);
dyadWriteTags.forEach((tag, index) => {
  console.log(
    `[DEBUG] Tag ${index + 1}: ${tag.path} (${tag.content.length} chars)`,
  );
});
```

### Step 3: Check for Directory Creation Issues

The issue might be related to directory creation on Windows. Check if:

1. Parent directories are being created correctly
2. Path separators are handled properly
3. File permissions allow writing

### Step 4: Monitor File System in Real Time

1. Open Windows Explorer to your app directory
2. Trigger the agent to generate multiple files
3. Watch the directory during execution to see if files appear and then disappear

## Potential Root Causes

### 1. Race Condition in Directory Creation

**Symptoms**: Files in the same directory work, but files in different directories fail
**Cause**: Multiple `fs.mkdirSync()` calls might interfere with each other
**Solution**: Add proper error handling around directory creation

### 2. Windows File System Locking

**Symptoms**: Intermittent failures, works sometimes but not others
**Cause**: Windows file locking can cause write failures if multiple operations happen too quickly
**Solution**: Add small delays between file operations or use async operations with proper queuing

### 3. Path Separator Issues

**Symptoms**: Files with Unix-style paths fail, Windows-style paths work
**Cause**: Mixed path separators causing invalid paths
**Solution**: Ensure consistent path normalization

### 4. Synchronous Operation Blocking

**Symptoms**: Only the last operation completes
**Cause**: Synchronous `fs.writeFileSync()` operations might be blocking each other
**Solution**: Switch to asynchronous operations with proper sequencing

## Quick Fixes to Try

### Fix 1: Add Error Handling to File Writing

In `response_processor.ts`, replace the file writing section with:

```javascript
// Write file content with error handling
try {
  fs.writeFileSync(fullFilePath, content);
  logger.log(`Successfully wrote file: ${fullFilePath}`);

  // Verify the file was actually written
  if (fs.existsSync(fullFilePath)) {
    const writtenSize = fs.statSync(fullFilePath).size;
    logger.log(`File verified: ${fullFilePath} (${writtenSize} bytes)`);
  } else {
    logger.error(`File write failed - file does not exist: ${fullFilePath}`);
  }

  writtenFiles.push(filePath);
} catch (writeError) {
  logger.error(`Failed to write file: ${fullFilePath}`, writeError);
  errors.push({
    message: `Failed to write file: ${filePath}`,
    error: writeError,
  });
}
```

### Fix 2: Add Sequential Processing with Delays

Add a small delay between file operations:

```javascript
// Add after each file write
await new Promise((resolve) => setTimeout(resolve, 10)); // 10ms delay
```

### Fix 3: Switch to Asynchronous Operations

Replace the synchronous operations with async ones:

```javascript
// Replace fs.mkdirSync with:
await fs.promises.mkdir(dirPath, { recursive: true });

// Replace fs.writeFileSync with:
await fs.promises.writeFile(fullFilePath, content);
```

## Verification Steps

After implementing any fixes:

1. **Test with multiple files**: Create a simple test that generates 3-4 files in different directories
2. **Verify all files exist**: Check that all files are written to disk, not just the last one
3. **Check file contents**: Ensure file contents are correct and complete
4. **Test on different systems**: Verify the fix works on both Windows and other platforms

## Additional Debugging Information

### Log Analysis

Look for these patterns in the logs:

- **Good**: Multiple "Successfully wrote file:" messages
- **Bad**: Only one "Successfully wrote file:" message
- **Warning**: Any error messages during directory creation
- **Critical**: Any JavaScript errors during file operations

### File System Monitoring

Use Windows Resource Monitor to watch:

- File handles being created/released
- Disk activity during agent execution
- Any permission errors

## Conclusion

The one-TODO enforcement system is **NOT** the cause of this file saving issue. The problem is likely in the file system operations themselves, potentially related to:

1. Windows-specific file system behavior
2. Race conditions in directory creation
3. Synchronous operation blocking
4. Path separator or permission issues

The troubleshooting steps above should help identify and fix the root cause.

## Need Help?

If the issue persists after trying these steps:

1. Run the test script and share the results
2. Enable debug logging and share the log output
3. Test with a simple case (2 files in the same directory)
4. Check if the issue happens in build mode too, not just agent mode

This will help narrow down whether it's a system-wide file operation issue or specifically related to the agent workflow.
