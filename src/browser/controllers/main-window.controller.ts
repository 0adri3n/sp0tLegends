import { app as electronApp, ipcMain, BrowserWindow } from "electron";
import { GameEventsService } from "../services/gep.service";
import path from "path";
import { DemoOSRWindowController } from "./demo-osr-window.controller";
import { OverlayService } from "../services/overlay.service";
import { overwolf } from "@overwolf/ow-electron";
import { OverlayHotkeysService } from "../services/overlay-hotkeys.service";
import {
  ExclusiveHotKeyMode,
  OverlayInputService,
} from "../services/overlay-input.service";

const owElectronApp = electronApp as overwolf.OverwolfApp;

/**
 *
 */
export class MainWindowController {
  private browserWindow: BrowserWindow = null;

  /**
   *
   */
  constructor(
    private readonly gepService: GameEventsService,
    private readonly overlayService: OverlayService,
    private readonly createDemoOsrWinController: () => DemoOSRWindowController,
    private readonly overlayHotkeysService: OverlayHotkeysService,
    private readonly overlayInputService: OverlayInputService
  ) {

  }



  /**
   *
   */
  public createAndShow(showDevTools: boolean) {
    this.browserWindow = new BrowserWindow({
      width: 525,
      height: 300,
      autoHideMenuBar: true,
      show: true,
      icon: path.join(__dirname, "../renderer/img/icon.png"),
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        devTools: showDevTools,
      },
    });

    // Load the URL instead of a file
    this.browserWindow.loadFile(path.join(__dirname, "../renderer/img/settings-icon.png"));
    this.browserWindow.loadURL("http://localhost:8888/login");
  }

}
