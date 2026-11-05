const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const fsp = require('fs/promises')

app.disableHardwareAcceleration()
app.setName('ShanGuo')
if (process.platform === 'win32') {
  app.setAppUserModelId('com.pll.shanguo')
}

function logCrash(err) {
  try {
    const file = path.join(app.getPath('userData'), 'crash.log')
    fs.mkdirSync(app.getPath('userData'), { recursive: true })
    fs.appendFileSync(file, `[${new Date().toISOString()}] ${err?.stack || err}\n`)
  } catch {}
}

process.on('uncaughtException', (err) => {
  logCrash(err)
  dialog.showErrorBox('闪过', String(err?.message || err))
})
process.on('unhandledRejection', (err) => logCrash(err))

let mainWindow = null

function storePath() {
  return path.join(app.getPath('userData'), 'books.json')
}

function emptyState() {
  return { books: [], favorites: [], favCursor: 0, favPageSize: 10 }
}

async function loadState() {
  try {
    const raw = await fsp.readFile(storePath(), 'utf8')
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
  await fsp.mkdir(app.getPath('userData'), { recursive: true })
  const next = {
    books: state.books || [],
    favorites: state.favorites || [],
    favCursor: state.favCursor || 0,
    favPageSize: state.favPageSize || 10,
  }
  await fsp.writeFile(storePath(), JSON.stringify(next, null, 2), 'utf8')
  return next
}

function dictCandidates() {
  const appPath = app.getAppPath()
  return [
    path.join(appPath, 'dist', 'dicts', 'kaoyanshanguo2025.json'),
    path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'dicts', 'kaoyanshanguo2025.json'),
    path.join(__dirname, '..', 'public', 'dicts', 'kaoyanshanguo2025.json'),
    path.join(__dirname, '..', 'dist', 'dicts', 'kaoyanshanguo2025.json'),
  ]
}

async function loadDict() {
  for (const file of dictCandidates()) {
    try {
      const raw = await fsp.readFile(file, 'utf8')
      return JSON.parse(raw)
    } catch {}
  }
  throw new Error('词库文件未找到')
}

function resolveIndexHtml() {
  const appPath = app.getAppPath()
  const candidates = [
    path.join(appPath, 'dist', 'index.html'),
    path.join(__dirname, '..', 'dist', 'index.html'),
  ]
  return candidates.find((p) => fs.existsSync(p)) || candidates[0]
}

function createWindow() {
  const icon = path.join(__dirname, '..', 'build', 'icon.png')
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 760,
    minHeight: 620,
    backgroundColor: '#F4F7F8',
    title: '闪过',
    icon: fs.existsSync(icon) ? icon : undefined,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  const html = resolveIndexHtml()
  mainWindow.loadFile(html).catch((err) => {
    logCrash(err)
    dialog.showErrorBox('闪过', '无法加载界面：' + html)
  })
}

ipcMain.handle('state:load', () => loadState())
ipcMain.handle('state:save', (_e, state) => saveState(state))
ipcMain.handle('dict:load', () => loadDict())

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })
  app.whenReady().then(createWindow)
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})