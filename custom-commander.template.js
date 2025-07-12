// Custom Commander Functions
// Each exported function becomes a custom command
// Functions receive selectedText as parameter

// ALL functions must return an object with these optional keys:
// - popup: show in popup message
// - replace: replace selected text with this value
// - clipboard: copy this value to clipboard
// Use any combination of these keys

function toUpperCase(selectedText) {
  return {
    popup: "Converted to uppercase: " + selectedText.toUpperCase(),
    replace: selectedText.toUpperCase(),
  }
}

async function getNowFromAPI() {
  // ~name: Get Now
  // ~description: Get current date and time from a remote API
  try {
    const response = await fetch("https://postman-echo.com/time/now")
    const result = await response.text()

    return {
      popup: "Date now: " + result,
      clipboard: result,
    }
  } catch (error) {
    return {
      popup: "Error: " + error.message,
    }
  }
}

// Export functions to make them available as commands
module.exports = {
  toUpperCase,
  getNowFromAPI,
}
