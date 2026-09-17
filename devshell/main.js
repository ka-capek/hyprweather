/*
 * Vývojový Electron obal pro Etapu 1.
 *
 * Účel: ukázat prototyp jako samostatné okno v přesné cílové velikosti,
 * bez adresního řádku, záložek, menu a rámečku.
 *
 * NENÍ to rozhodnutí o technologii aplikace. Výběr desktopového obalu
 * a rendereru patří do Etapy 3, až bude vzhled schválený.
 *
 * Stránku vybírá --page=<cesta relativně ke kořeni projektu>.
 *
 * Klávesy:  1 aplikace · 2 galerie tvarů · 3 kódování intenzity
 *           4 tvary ve skutečném panelu
 *           Esc / Ctrl+Q zavřít · F5 / Ctrl+R znovu načíst · F12 devtools
 */
const { app, BrowserWindow, protocol, net, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');

// Wayland: nativní okno místo XWayland. Ve vývoji totéž dělá run.sh.
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
  app.commandLine.appendSwitch('enable-features', 'WaylandWindowDecorations');
}

/*
 * Stránka se servíruje přes vlastní schéma `app://`, ne přes file://.
 * Důvod: pod file:// je origin neprůhledný a Chromium localStorage mezi
 * spuštěními nezachová — cache počasí ani zapamatované město by tiše
 * nefungovaly. `app://` je stálý origin s trvalým úložištěm.
 */
protocol.registerSchemesAsPrivileged([{
  scheme: 'app',
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
}]);

function serveFromRoot(request) {
  const url = new URL(request.url);
  let rel = decodeURIComponent(url.pathname);
  if (rel === '' || rel === '/') rel = '/index.html';

  const full = path.normalize(path.join(ROOT, rel));
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) {
    return new Response('Forbidden', { status: 403 });
  }

  // V balíčku leží scéna oblohy mimo asar (asarUnpack) — 36 MB dat načítaných
  // z iframu. Co je rozbalené, čti z app.asar.unpacked, zbytek z archivu.
  const onDisk = full.replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
  const source = onDisk !== full && fs.existsSync(onDisk) ? onDisk : full;
  return net.fetch(pathToFileURL(source).toString());
}

/* --- Trvalé úložiště ------------------------------------------- */

let storePath = null;
let store = {};
let writeTimer = null;

function loadStore() {
  storePath = path.join(app.getPath('userData'), 'store.json');
  try {
    const loaded = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    store = loaded && typeof loaded === 'object' && !Array.isArray(loaded) ? loaded : {};
  } catch (err) {
    store = {};        // chybějící nebo poškozený soubor není chyba
  }
}

function flushStore() {
  clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeTimer = null;
    try {
      fs.writeFileSync(storePath, JSON.stringify(store));
    } catch (err) {
      console.error('store zapis selhal:', err.message);
    }
  }, 250);
}

ipcMain.on('store:get', (event, key) => {
  event.returnValue = Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
});

ipcMain.on('store:set', (event, key, value) => {
  if (value === null || value === undefined) delete store[key];
  else store[key] = value;
  flushStore();
});

function pageURL(page) {
  return 'app://local/' + String(page).replace(/^\/+/, '');
}
const WIDTH = 1316;
const HEIGHT = 1396;

// --capture=<soubor>: vykreslí okno mimo obrazovku, uloží PNG a skončí.
const captureArg = process.argv.find((a) => a.startsWith('--capture='));

// Stránky přepínatelné klávesami 1/2/3 — laboratoře se tak dají prohlížet
// ve skutečné velikosti okna, ne v prohlížeči.
const PAGES = {
  1: 'index.html',
  2: 'lab/bar-shapes.html',
  3: 'lab/precip-styles.html',
  4: 'lab/shapes-in-app.html',
};

const pageArg = process.argv.find((a) => a.startsWith('--page='));
let startPage = pageArg ? pageArg.slice('--page='.length) : PAGES[1];
let startQuery = '';
const qIndex = startPage.indexOf('?');
if (qIndex !== -1) {
  startQuery = startPage.slice(qIndex + 1);
  startPage = startPage.slice(0, qIndex);
}

function createWindow() {
  const win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    useContentSize: true,        // rozměr platí pro obsah, ne včetně rámu
    frame: false,
    show: !captureArg,
    resizable: true,
    backgroundColor: '#0D131C',
    autoHideMenuBar: true,
    title: 'Weather',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  win.loadURL(pageURL(startPage) + (startQuery ? '?' + startQuery : ''));

  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const key = (input.key || '').toLowerCase();
    if (key === 'escape') {
      event.preventDefault();
      win.webContents.executeJavaScript(`(() => { const dialog=document.querySelector('dialog[open]'); if(!dialog)return false; dialog.close(); return true; })()`)
        .then(handled => { if(!handled && !win.isDestroyed())win.close(); });
      return;
    }
    if (input.control && key === 'q') win.close();
    else if (key === 'f5' || (input.control && key === 'r')) win.reload();
    else if (key === 'f12') win.webContents.toggleDevTools({ mode: 'detach' });
    else if (!app.isPackaged && PAGES[key]) {
      win.webContents.executeJavaScript(`Boolean(document.querySelector('dialog[open]') || document.activeElement?.matches('input, textarea, select, [contenteditable]'))`)
        .then(editing => { if(!editing && !win.isDestroyed())win.loadURL(pageURL(PAGES[key])); });
      return;
    }
    else return;
    event.preventDefault();
  });

  if (captureArg) {
    const out = captureArg.slice('--capture='.length);
    win.webContents.once('did-finish-load', () => {
      // Krátká prodleva na dokreslení fontu a pozadí.
      setTimeout(async () => {
        try {
          const image = await win.capturePage();
          fs.writeFileSync(out, image.toPNG());
          console.log(out);
        } catch (err) {
          console.error('capture failed:', err.message);
          process.exitCode = 1;
        }
        app.quit();
      }, +(process.env.CAPTURE_DELAY || 1200));
    });
  }
}

app.whenReady().then(() => {
  loadStore();
  protocol.handle('app', serveFromRoot);
  createWindow();
});

// Před ukončením dopiš, co ještě čeká ve frontě.
app.on('before-quit', () => {
  if (!writeTimer || !storePath) return;
  clearTimeout(writeTimer);
  try { fs.writeFileSync(storePath, JSON.stringify(store)); } catch (err) { /* konec stejně */ }
});
app.on('window-all-closed', () => app.quit());
