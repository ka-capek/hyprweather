const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const root = __dirname;
app.setName('weather-animation-lab');
app.setPath('userData', path.join(root, '.electron-profile'));
const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const capture = arg('capture');
const suite = process.argv.includes('--verify');
let server;
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.bin': 'application/octet-stream' };
app.whenReady().then(async () => {
  const dist = path.join(root, 'dist');
  server = http.createServer((req, res) => {
    let file;
    try { file = path.resolve(dist, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname)); }
    catch { res.writeHead(400).end(); return; }
    if (file === dist) file = path.join(dist, 'index.html');
    if (!file.startsWith(dist + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const win = new BrowserWindow({ width: 1316, height: 1396, useContentSize: true,
    frame: false, show: !capture && !suite, backgroundColor: '#111b2b', title: 'Atmosphere · Animation Lab',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false, offscreen: Boolean(capture || suite) } });
  win.setMenu(null);
  win.webContents.on('console-message', event => console.log(`renderer[${event.level}] ${event.message}`));
  let latestPaint;
  win.webContents.on('paint', (_event, _dirty, image) => { latestPaint = image; });
  if (capture || suite) win.webContents.setFrameRate(60);
  win.webContents.on('render-process-gone', (_event, details) => { console.error(details); app.exit(1); });
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'Escape') { event.preventDefault(); win.close(); }
    if (input.key === 'F12') { event.preventDefault(); win.webContents.toggleDevTools(); }
  });
  const initial = arg('scene') || 'sunset';
  await win.loadURL(`http://127.0.0.1:${server.address().port}/?scene=${encodeURIComponent(initial)}`);
  if (capture || suite) {
    try {
      const deadline = Date.now() + 90000;
      while (!(await win.webContents.executeJavaScript('Boolean(window.lab?.ready)'))) {
        const error = await win.webContents.executeJavaScript('window.labError || null');
        if (error) throw new Error(error);
        if (Date.now() > deadline) throw new Error('Renderer startup timeout');
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      const scenes = suite ? ['sunset', 'sunrise', 'storm', 'snow'] : [initial];
      for (const scene of scenes) {
        await win.webContents.executeJavaScript(`window.lab.setScene(${JSON.stringify(scene)}, true)`);
        await new Promise(resolve => setTimeout(resolve, 3500));
        const result = await win.webContents.executeJavaScript('window.lab.diagnostics()');
        console.log(JSON.stringify({ scene, ...result }));
        if (result.errors.length || result.scroll || result.frames < 5) throw new Error('Scene verification failed');
        const target = suite ? path.join(root, 'captures', `${scene}.png`) : path.resolve(root, capture);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        if (!latestPaint) throw new Error('No rendered frame received');
        fs.writeFileSync(target, latestPaint.toPNG());
        if (scene === 'storm' && suite) {
          await win.webContents.executeJavaScript('window.lab.flash(); window.lab.freezeFlash = true');
          await new Promise(resolve => setTimeout(resolve, 150));
          fs.writeFileSync(path.join(root, 'captures', 'lightning.png'), latestPaint.toPNG());
          await win.webContents.executeJavaScript('window.lab.freezeFlash = false');
        }
      }
      if (suite) {
        const before = await win.webContents.executeJavaScript(`(() => {
          document.getElementById('pause').click();
          document.getElementById('overlay').click();
          window.dispatchEvent(new KeyboardEvent('keydown', {key:'h'}));
          return {elapsed:window.lab.diagnostics().elapsed, paused:window.lab.diagnostics().paused,
            overlay:!document.getElementById('weather').classList.contains('hidden'), clean:document.body.classList.contains('clean')};
        })()`);
        await new Promise(resolve => setTimeout(resolve, 300));
        const after = await win.webContents.executeJavaScript('window.lab.diagnostics().elapsed');
        if (!before.paused || !before.overlay || !before.clean || before.elapsed !== after) throw new Error('Pause/overlay controls failed');
        await win.webContents.executeJavaScript(`(() => {
          document.getElementById('pause').click();
          const sun=document.getElementById('sun'); sun.value='8'; sun.dispatchEvent(new Event('input',{bubbles:true}));
          const cloud=document.getElementById('clouds'); cloud.value='.25'; cloud.dispatchEvent(new Event('input',{bubbles:true}));
        })()`);
        await new Promise(resolve => setTimeout(resolve, 400));
        const controls = await win.webContents.executeJavaScript(`({sun:document.getElementById('sun-value').textContent,cloud:document.getElementById('cloud-value').textContent,elapsed:window.lab.diagnostics().elapsed})`);
        if (controls.sun !== '8.0°' || controls.cloud !== '25%' || controls.elapsed <= after) throw new Error('Slider/resume controls failed');
        console.log('Controls verified: scene selection, sliders, pause/resume, overlay, clean view');
      }
      console.log('GPU', JSON.stringify(app.getGPUFeatureStatus()));
      app.quit();
    } catch (error) { console.error(error); app.exit(1); }
  }
});
app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => server?.close());
