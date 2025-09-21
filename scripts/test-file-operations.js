#!/usr/bin/env node

/**
 * File Operations Test Script
 *
 * This script tests file writing operations independently of the agent system
 * to verify that multiple files can be written successfully without interference.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Create a temporary test directory
const testDir = path.join(os.tmpdir(), 'dyad-file-test-' + Date.now());

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function createTestFiles() {
  const testFiles = [
    {
      path: 'src/components/TodoItem.tsx',
      content: `import React from 'react';

interface TodoItemProps {
  id: string;
  text: string;
  completed: boolean;
}

export function TodoItem({ id, text, completed }: TodoItemProps) {
  return (
    <div className="todo-item">
      <input type="checkbox" checked={completed} />
      <span>{text}</span>
    </div>
  );
}
`
    },
    {
      path: 'src/components/TodoList.tsx',
      content: `import React from 'react';
import { TodoItem } from './TodoItem';

interface Todo {
  id: string;
  text: string;
  completed: boolean;
}

interface TodoListProps {
  todos: Todo[];
}

export function TodoList({ todos }: TodoListProps) {
  return (
    <div className="todo-list">
      {todos.map(todo => (
        <TodoItem key={todo.id} {...todo} />
      ))}
    </div>
  );
}
`
    },
    {
      path: 'src/styles/todos.css',
      content: `.todo-item {
  display: flex;
  align-items: center;
  padding: 8px;
  border-bottom: 1px solid #eee;
}

.todo-item input {
  margin-right: 8px;
}

.todo-list {
  max-width: 400px;
  margin: 0 auto;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
`
    },
    {
      path: 'src/hooks/useTodos.ts',
      content: `import { useState, useCallback } from 'react';

interface Todo {
  id: string;
  text: string;
  completed: boolean;
}

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>([]);

  const addTodo = useCallback((text: string) => {
    const newTodo: Todo = {
      id: Date.now().toString(),
      text,
      completed: false
    };
    setTodos(prev => [...prev, newTodo]);
  }, []);

  const toggleTodo = useCallback((id: string) => {
    setTodos(prev =>
      prev.map(todo =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  }, []);

  const deleteTodo = useCallback((id: string) => {
    setTodos(prev => prev.filter(todo => todo.id !== id));
  }, []);

  return { todos, addTodo, toggleTodo, deleteTodo };
}
`
    }
  ];

  return testFiles;
}

async function writeFilesSynchronously(files) {
  log('Testing synchronous file writing...');

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fullPath = path.join(testDir, file.path);

    log(`Writing file ${i + 1}/${files.length}: ${file.path}`);

    // Ensure directory exists
    const dirPath = path.dirname(fullPath);
    fs.mkdirSync(dirPath, { recursive: true });

    // Write file
    fs.writeFileSync(fullPath, file.content);

    // Verify immediately
    if (fs.existsSync(fullPath)) {
      const writtenContent = fs.readFileSync(fullPath, 'utf8');
      const expectedSize = file.content.length;
      const actualSize = writtenContent.length;

      if (actualSize === expectedSize) {
        log(`✅ File ${file.path} written successfully (${actualSize} bytes)`);
      } else {
        log(`❌ File ${file.path} size mismatch. Expected: ${expectedSize}, Got: ${actualSize}`);
      }
    } else {
      log(`❌ File ${file.path} was not created!`);
    }
  }
}

async function writeFilesConcurrently(files) {
  log('Testing concurrent file writing...');

  const promises = files.map(async (file, index) => {
    const fullPath = path.join(testDir, file.path);

    log(`Starting concurrent write ${index + 1}/${files.length}: ${file.path}`);

    // Ensure directory exists
    const dirPath = path.dirname(fullPath);
    await fs.promises.mkdir(dirPath, { recursive: true });

    // Write file
    await fs.promises.writeFile(fullPath, file.content);

    log(`✅ Concurrent write completed: ${file.path}`);

    return { path: file.path, size: file.content.length };
  });

  const results = await Promise.all(promises);

  // Verify all files
  for (const result of results) {
    const fullPath = path.join(testDir, result.path);
    if (fs.existsSync(fullPath)) {
      const actualSize = fs.statSync(fullPath).size;
      if (actualSize === result.size) {
        log(`✅ Concurrent file ${result.path} verified (${actualSize} bytes)`);
      } else {
        log(`❌ Concurrent file ${result.path} size mismatch. Expected: ${result.size}, Got: ${actualSize}`);
      }
    } else {
      log(`❌ Concurrent file ${result.path} does not exist!`);
    }
  }
}

function verifyAllFiles(files) {
  log('Verifying all files exist and have correct content...');

  const results = {
    total: files.length,
    found: 0,
    missing: [],
    corrupted: []
  };

  for (const file of files) {
    const fullPath = path.join(testDir, file.path);

    if (fs.existsSync(fullPath)) {
      results.found++;

      const writtenContent = fs.readFileSync(fullPath, 'utf8');
      if (writtenContent === file.content) {
        log(`✅ ${file.path}: Content matches perfectly`);
      } else {
        log(`❌ ${file.path}: Content corruption detected`);
        results.corrupted.push(file.path);
      }
    } else {
      log(`❌ ${file.path}: File not found`);
      results.missing.push(file.path);
    }
  }

  return results;
}

async function simulateAgentBehavior(files) {
  log('Simulating agent-like file operations...');

  // Simulate the exact sequence that happens in the agent system
  log('Step 1: Parse dyad-write tags (simulated)');
  const dyadWriteTags = files;

  log('Step 2: Process each dyad-write tag in sequence');
  const writtenFiles = [];

  for (const tag of dyadWriteTags) {
    const filePath = tag.path;
    const content = tag.content;
    const fullFilePath = path.join(testDir, filePath);

    log(`Processing dyad-write tag: ${filePath}`);

    // Ensure directory exists (same as response_processor.ts)
    const dirPath = path.dirname(fullFilePath);
    fs.mkdirSync(dirPath, { recursive: true });

    // Write file content (same as response_processor.ts)
    fs.writeFileSync(fullFilePath, content);
    log(`Successfully wrote file: ${fullFilePath}`);
    writtenFiles.push(filePath);
  }

  log(`Step 3: All files processed. Total: ${writtenFiles.length}`);
  return writtenFiles;
}

function cleanup() {
  log('Cleaning up test directory...');
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
    log('✅ Cleanup completed');
  } catch (error) {
    log(`❌ Cleanup failed: ${error.message}`);
  }
}

async function runTests() {
  log('🧪 Starting File Operations Test Suite');
  log(`Test directory: ${testDir}`);

  try {
    // Create test directory
    fs.mkdirSync(testDir, { recursive: true });

    const testFiles = createTestFiles();
    log(`Created ${testFiles.length} test files for verification`);

    // Test 1: Synchronous writing (like the current system)
    log('\n' + '='.repeat(50));
    log('TEST 1: Synchronous File Writing');
    log('='.repeat(50));

    await writeFilesSynchronously(testFiles);
    const syncResults = verifyAllFiles(testFiles);

    // Clean up for next test
    fs.rmSync(testDir, { recursive: true, force: true });
    fs.mkdirSync(testDir, { recursive: true });

    // Test 2: Concurrent writing
    log('\n' + '='.repeat(50));
    log('TEST 2: Concurrent File Writing');
    log('='.repeat(50));

    await writeFilesConcurrently(testFiles);
    const concurrentResults = verifyAllFiles(testFiles);

    // Clean up for next test
    fs.rmSync(testDir, { recursive: true, force: true });
    fs.mkdirSync(testDir, { recursive: true });

    // Test 3: Agent simulation
    log('\n' + '='.repeat(50));
    log('TEST 3: Agent Behavior Simulation');
    log('='.repeat(50));

    const writtenFiles = await simulateAgentBehavior(testFiles);
    const agentResults = verifyAllFiles(testFiles);

    // Summary
    log('\n' + '='.repeat(60));
    log('TEST RESULTS SUMMARY');
    log('='.repeat(60));

    log(`Synchronous Test: ${syncResults.found}/${syncResults.total} files written`);
    if (syncResults.missing.length > 0) {
      log(`  Missing: ${syncResults.missing.join(', ')}`);
    }
    if (syncResults.corrupted.length > 0) {
      log(`  Corrupted: ${syncResults.corrupted.join(', ')}`);
    }

    log(`Concurrent Test: ${concurrentResults.found}/${concurrentResults.total} files written`);
    if (concurrentResults.missing.length > 0) {
      log(`  Missing: ${concurrentResults.missing.join(', ')}`);
    }
    if (concurrentResults.corrupted.length > 0) {
      log(`  Corrupted: ${concurrentResults.corrupted.join(', ')}`);
    }

    log(`Agent Simulation: ${agentResults.found}/${agentResults.total} files written`);
    if (agentResults.missing.length > 0) {
      log(`  Missing: ${agentResults.missing.join(', ')}`);
    }
    if (agentResults.corrupted.length > 0) {
      log(`  Corrupted: ${agentResults.corrupted.join(', ')}`);
    }

    // Determine if there's an issue
    const allTestsPassed =
      syncResults.found === syncResults.total &&
      concurrentResults.found === concurrentResults.total &&
      agentResults.found === agentResults.total &&
      syncResults.corrupted.length === 0 &&
      concurrentResults.corrupted.length === 0 &&
      agentResults.corrupted.length === 0;

    if (allTestsPassed) {
      log('\n🎉 ALL TESTS PASSED - File operations are working correctly');
      log('The issue is likely not in the file writing system itself.');
    } else {
      log('\n⚠️  SOME TESTS FAILED - There may be an issue with file operations');
      log('This could explain why only the last file is being saved.');
    }

    return allTestsPassed ? 0 : 1;

  } catch (error) {
    log(`❌ Test suite failed with error: ${error.message}`);
    log(`Stack trace: ${error.stack}`);
    return 1;
  } finally {
    cleanup();
  }
}

// Run the tests if this script is executed directly
if (require.main === module) {
  runTests().then(exitCode => {
    process.exit(exitCode);
  }).catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { runTests, createTestFiles, simulateAgentBehavior };
