# Custom Commander Extension

A VS Code extension that allows you to execute custom JavaScript functions.

## Features

- **Custom JavaScript File**: Write and export functions in `.vscode/custom-commander.js`
- **Sync & Async Support**: Write both synchronous and asynchronous functions
- **Multiple Actions**: Functions can show popups, replace text, and copy to clipboard
- **Auto-Reload**: Changes to your commands file are automatically detected
- **Keyboard Shortcut**: Quick access with `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (macOS)

## How to Use

### Quick Start

Use `Cmd/Ctrl+Shift+R` to access your custom commands, or `Cmd/Ctrl+Shift+P` → "Run Custom Command".

### Writing Custom Functions

All functions must return an object with optional keys:
- `popup`: Show result in popup message
- `replace`: Replace selected text with this value  
- `clipboard`: Copy this value to clipboard

You can change name and description of a function by including these comments in the function:
```javascript
// ~name: My Little Function
// ~description: Whatever you want
```

**Examples:**
```javascript
// .vscode/custom-commander.js

function toUpperCase(selectedText) {
  return {
    popup: `Converted to uppercase: ${selectedText.toUpperCase()}`,
    replace: selectedText.toUpperCase()
  }
}

async function getNowFromAPI() {
  // ~name: Get Now
  // ~description: Fetch now from remote API.
  try {
    const response = await fetch("https://postman-echo.com/time/now")
    const result = await response.text()

    return {
      popup: `Date now: ${result}`,
      clipboard: result,
    }
  } catch (error) {
    return {
      popup: `Error: ${error.message}`,
    }
  }
}

// Export functions to make them available as commands
module.exports = {
  toUpperCase,
  getNowFromAPI,
}
```

### Function Actions

Each function can perform multiple actions by returning different keys:

- **Show popup only**: `return { popup: "Hello World" }`
- **Replace text**: `return { replace: "New Text" }`
- **Copy to clipboard**: `return { clipboard: "Copied Text" }`
- **All three**: `return { popup: "Done!", replace: "New Text", clipboard: "Copied Text" }`

### Environment

Your functions run in **full Node.js environment** with access to:
- All Node.js built-in modules (`fs`, `crypto`, `path`, `http`, etc.)
- NPM packages (if installed in your workspace)
- Network requests (`fetch`, `https`)
- File system operations
- Everything Node.js can do!
