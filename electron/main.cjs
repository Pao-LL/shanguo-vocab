const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs/promises')

let mainWindow

function storePath() {
  return path.join(app.getPath('userData'), 'books.json')
}

function emptyState() {
  return { books: [], favorites: [], favCursor: 0, favPageSize: 10 }
}

async function loadState() {
  try {
    const raw = await fs.readFile(storePath(), 'utf8')
    const data = JSON.parse(raw)
    return {
      books: Array.isArray(data.books) ? data.books : [],
      favorites: Array.isArray(data.favorites) ? data.favorites : [],
      favCursor: Number(data.favCursor) || 0,
      favPageSize: [5, 10, 20].includes(data.favPageSize) ? data.favPageSize : 10,
    }
  } catch {
    return emptyState()
  }
}

async function saveState(state) {
  await fs.mkdir(app.getPath('userData'), { recursive: true })
  const next = {
    books: state.books || [],
    favorites: state.favorites || [],
    favCursor: state.favCursor || 0,
    favPageSize: state.favPageSize || 10,
  }
  await fs.writeFile(storePath(), JSON.stringify(next, null, 2), 'utf8')
  return next
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 760,
    minHeight: 620,
    backgroundColor: '#F4F7F8',
    title: '考研闪过单词本',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

ipcMain.handle('state:load', () => loadState())
ipcMain.handle('state:save', (_e, state) => saveState(state))

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
  app.whenReady().then(createWindow)
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
