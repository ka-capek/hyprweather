/*
 * Most k trvalému úložišti.
 *
 * Chromium neuchová localStorage pro vlastní schéma `app://` mezi spuštěními —
 * zápisy skončí v Session Storage a po restartu jsou pryč. Cache počasí
 * a zapamatované město proto drží hlavní proces v JSON souboru.
 *
 * `get` je synchronní schválně: kód v aplikaci se ptá na uložený stav při
 * startu a nemá smysl kvůli tomu dělat celou vrstvu asynchronní.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('appStore', {
  get: function (key) { return ipcRenderer.sendSync('store:get', key); },
  set: function (key, value) { ipcRenderer.send('store:set', key, value); },
});
