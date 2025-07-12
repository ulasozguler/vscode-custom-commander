const vscode = require("vscode")
const path = require("path")
const fs = require("fs")

let customCommands = new Map()
let customCommandDisposables = []
let userCommandsModule = null
let recentlyUsedCommands = []

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  loadCustomCommands()

  // Register built-in commands
  const createCommandsFileDisposable = vscode.commands.registerCommand(
    "custom-commander.createCommandsFile",
    createCommandsFile
  )

  const reloadCommandsDisposable = vscode.commands.registerCommand("custom-commander.reloadCommands", reloadCommands)

  context.subscriptions.push(createCommandsFileDisposable, reloadCommandsDisposable)

  // Register custom commands
  registerCustomCommands(context)

  // Watch for changes to the commands file
  const commandsPath = getCommandsFilePath()
  if (commandsPath) {
    const watcher = vscode.workspace.createFileSystemWatcher(commandsPath)
    watcher.onDidChange(() => {
      reloadCommands()
    })
    watcher.onDidCreate(() => {
      reloadCommands()
    })
    watcher.onDidDelete(() => {
      customCommands.clear()
      registerCustomCommands(context)
    })
    context.subscriptions.push(watcher)
  }
}

/**
 * Get the path to the commands file
 */
function getCommandsFilePath() {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
  if (!workspaceFolder) {
    return null
  }
  return path.join(workspaceFolder.uri.fsPath, ".vscode", "custom-commander.js")
}

/**
 * Create a sample commands file
 */
async function createCommandsFile() {
  const commandsPath = getCommandsFilePath()
  if (!commandsPath) {
    vscode.window.showErrorMessage("No workspace folder found")
    return
  }

  // Create .vscode directory if it doesn't exist
  const vscodeDir = path.dirname(commandsPath)
  if (!fs.existsSync(vscodeDir)) {
    fs.mkdirSync(vscodeDir, { recursive: true })
  }

  // Check if file already exists
  if (fs.existsSync(commandsPath)) {
    const choice = await vscode.window.showWarningMessage(
      "custom-commander.js already exists. Do you want to overwrite it?",
      "Yes",
      "No"
    )
    if (choice !== "Yes") {
      return
    }
  }

  // Read template content
  try {
    const templatePath = path.join(__dirname, "custom-commander.template.js")
    const sampleContent = fs.readFileSync(templatePath, "utf8")
    fs.writeFileSync(commandsPath, sampleContent)
  } catch (error) {
    vscode.window.showErrorMessage(`Error creating template file: ${error.message}`)
    return
  }

  // Open the file
  const document = await vscode.workspace.openTextDocument(commandsPath)
  await vscode.window.showTextDocument(document)

  // Reload commands
  await reloadCommands()
}

/**
 * Reload commands from the commands file
 */
async function reloadCommands(silent = false) {
  // Clear module cache
  const commandsPath = getCommandsFilePath()
  if (commandsPath && require.cache[commandsPath]) {
    delete require.cache[commandsPath]
  }

  loadCustomCommands()

  // Re-register commands
  const context = { subscriptions: [] }
  registerCustomCommands(context)

  if (!silent) {
    vscode.window.setStatusBarMessage(`Reloaded ${customCommands.size} custom commands`, 2000)
  }
}

function extractMetaFromFunction(funcName, func) {
  const paramPrefix = "// ~"
  const allowedMeta = ["name", "description"]
  const foundMeta = func
    .toString()
    .split("\n")
    .map((x) => x.trim())
    .filter((x) => x.startsWith(paramPrefix) && x.includes(": "))
    .map((x) => x.replace(paramPrefix, "").split(": "))
    .reduce((acc, [key, value]) => {
      acc[key] = value
      return acc
    }, {})

  const name = foundMeta.name || funcName.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())
  return {
    name: name,
    description: foundMeta.description || `Execute ${name} function`,
  }
}

/**
 * Load custom commands from .vscode/custom-commander.js
 */
function loadCustomCommands() {
  const commandsPath = getCommandsFilePath()

  customCommands.clear()
  userCommandsModule = null

  if (!commandsPath || !fs.existsSync(commandsPath)) {
    return
  }

  try {
    // Load the user's commands module
    userCommandsModule = require(commandsPath)

    // Create commands for each exported function
    for (const [funcName, func] of Object.entries(userCommandsModule)) {
      if (typeof func === "function") {
        const commandId = `custom-commander.custom.${funcName}`
        customCommands.set(commandId, {
          func: func,
          ...extractMetaFromFunction(funcName, func),
        })
      }
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Error loading custom-commander.js: ${error.message}`)
  }
}

/**
 * Execute a custom command
 */
async function executeCustomCommand(commandId) {
  const command = customCommands.get(commandId)
  if (!command) {
    vscode.window.showErrorMessage("Custom command not found")
    return
  }

  updateRecentlyUsedCommands(commandId)

  const editor = vscode.window.activeTextEditor
  const selection = editor?.selection
  const selectedText = editor?.document.getText(selection)

  try {
    const result = await command.func(selectedText)
    if (result === undefined) return
    const { popup, replace, clipboard } = result

    // Show popup message
    if (popup !== undefined) {
      vscode.window.showInformationMessage(String(popup))
    }

    // Replace selected text
    if (replace !== undefined && editor) {
      await editor.edit((editBuilder) => {
        editBuilder.replace(selection, String(replace))
      })
    }

    // Copy to clipboard
    if (clipboard !== undefined) {
      await vscode.env.clipboard.writeText(String(clipboard))
      vscode.window.setStatusBarMessage(`Copied to clipboard: ${String(clipboard).substring(0, 20)}`, 2000)
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Error in "${command.name}": ${error.message}`)
  }
}

/**
 * Update recently used commands list
 */
function updateRecentlyUsedCommands(commandId) {
  // Remove if already exists
  const existingIndex = recentlyUsedCommands.indexOf(commandId)
  if (existingIndex > -1) {
    recentlyUsedCommands.splice(existingIndex, 1)
  }

  // Add to top
  recentlyUsedCommands.unshift(commandId)

  reloadCommands(true)
}

/**
 * Register all custom commands
 */
function registerCustomCommands(context) {
  // Clear existing custom command disposables
  customCommandDisposables.forEach((disposable) => {
    disposable.dispose()
  })
  customCommandDisposables = []

  // Sort all commands by recently used index (recently used first)
  const orderedCommandIds = Array.from(customCommands.keys()).sort((a, b) => {
    const aIndex = recentlyUsedCommands.indexOf(a)
    const bIndex = recentlyUsedCommands.indexOf(b)

    // If both are in recent list, sort by their position in recent list
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex
    }

    // If only one is in recent list, prioritize it
    if (aIndex !== -1) return -1
    if (bIndex !== -1) return 1

    // If neither is in recent list, maintain original order
    return 0
  })

  // Register each custom command in order
  for (const commandId of orderedCommandIds) {
    const disposable = vscode.commands.registerCommand(commandId, () => executeCustomCommand(commandId))

    customCommandDisposables.push(disposable)
  }

  // Always register the command picker
  const pickerDisposable = vscode.commands.registerCommand("custom-commander.pickCustomCommand", async function () {
    // Handle empty commands case
    if (customCommands.size === 0) {
      const quickPickItems = [
        {
          label: "$(file-add) Create Commands File",
          description: "Create a new custom-commander.js file with sample functions",
          commandId: "create-commands-file",
        },
      ]

      const selected = await vscode.window.showQuickPick(quickPickItems, {
        placeHolder: "No custom functions found. Create a commands file to get started.",
      })

      if (selected && selected.commandId === "create-commands-file") {
        await createCommandsFile()
      }
      return
    }

    // Use the same ordering for the picker
    const quickPickItems = orderedCommandIds.map((id) => {
      const data = customCommands.get(id)
      const isRecent = recentlyUsedCommands.includes(id)
      return {
        label: `${isRecent ? "$(clock) " : ""}${data.name}`,
        description: data.description,
        commandId: id,
      }
    })

    const selected = await vscode.window.showQuickPick(quickPickItems, {
      placeHolder: "Select a custom command to run",
    })

    if (selected) {
      await executeCustomCommand(selected.commandId)
    }
  })

  customCommandDisposables.push(pickerDisposable)
}

function deactivate() {
  // Clean up custom command disposables
  customCommandDisposables.forEach((disposable) => disposable.dispose())
}

module.exports = {
  activate,
  deactivate,
}
