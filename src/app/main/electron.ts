import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const electron = require('electron');

export const app = electron.app;
export const BrowserWindow = electron.BrowserWindow;
export const clipboard = electron.clipboard;
export const dialog = electron.dialog;
export const ipcMain = electron.ipcMain;
export const Menu = electron.Menu;
export const MenuItem = electron.MenuItem;
export const nativeImage = electron.nativeImage;
export const nativeTheme = electron.nativeTheme;
export const Notification = electron.Notification;
export const session = electron.session;
export const ShareMenu = electron.ShareMenu;
export const shell = electron.shell;
export const systemPreferences = electron.systemPreferences;
export const Tray = electron.Tray;

export type BrowserWindow = import('electron').BrowserWindow;
export type BrowserWindowConstructorOptions = import('electron').BrowserWindowConstructorOptions;
export type IpcMain = import('electron').IpcMain;
export type IpcMainInvokeEvent = import('electron').IpcMainInvokeEvent;
export type Menu = import('electron').Menu;
export type MenuItem = import('electron').MenuItem;
export type MessageBoxOptions = import('electron').MessageBoxOptions;
export type Notification = import('electron').Notification;
export type ShareMenu = import('electron').ShareMenu;
export type SharingItem = import('electron').SharingItem;
export type Tray = import('electron').Tray;
export type WebContents = import('electron').WebContents;
