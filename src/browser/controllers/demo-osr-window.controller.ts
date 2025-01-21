import fs from "fs";
import path from "path";
import express, { Request, Response } from "express";
import querystring from "querystring";
import fetch from "node-fetch";
import { ipcMain } from "electron";
import {
  OverlayBrowserWindow,
  OverlayWindowOptions,
} from "@overwolf/ow-electron-packages-types";
import { OverlayService } from "../services/overlay.service";
import exp from "constants";

interface SpotifyAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface SpotifyConfig {
  clientId: string;
  clientSecret: string;
  login_successful: boolean;
}

export class DemoOSRWindowController {
  private overlayWindow: OverlayBrowserWindow = null;
  private isVisible: boolean = false;
  private spotifyToken: string = "";
  private clientId: string = "";
  private clientSecret: string = "";
  private redirectUri: string = "http://localhost:8888/callback";
  private app: express.Application;
  private pause = false;
  private configPath: string = path.join(__dirname, "../renderer/config/spotify.json");

  constructor(private readonly overlayService: OverlayService) {
    this.loadSpotifyConfig();
    this.app = express();
    this.app.use(express.json());
    this.setupAuthRoutes();
    this.setupIpcListeners();
  }

  /**
   * Charge les détails Spotify depuis spotify.json
   */
  private loadSpotifyConfig(): void {
    try {
      const rawConfig = fs.readFileSync(this.configPath, "utf-8");
      const config: SpotifyConfig = JSON.parse(rawConfig);

      this.clientId = config.clientId;
      this.clientSecret = config.clientSecret;
      console.log("Détails Spotify chargés depuis spotify.json");
    } catch (error) {
      console.error(
        "Erreur lors de la lecture du fichier spotify.json :",
        error
      );
    }
  }

  private setupAuthRoutes() {
    this.app.get("/login", (req, res) => {
      const state = this.generateRandomString(16);
      const scope =
        "user-read-private user-read-playback-state user-modify-playback-state";
      const authUrl =
        "https://accounts.spotify.com/authorize?" +
        querystring.stringify({
          response_type: "code",
          client_id: this.clientId,
          scope: scope,
          redirect_uri: this.redirectUri,
          state: state,
        });

      res.redirect(authUrl); // Redirige l'utilisateur vers Spotify pour autorisation
    });

    this.app.get("/callback", async (req, res) => {
      const code = req.query.code;
      if (code) {
        await this.fetchAccessToken(code as string);
        // Met à jour le booléen login_successful dans spotify.json
        this.updateLoginStatus(true);

        // Redirige l'utilisateur vers la route /index
        res.redirect("/index");
      } else {
        res.send("Authentication failed. No code received.");
      }
    });

    // Route POST pour sauvegarder les nouvelles informations dans config.json
    this.app.post("/edit_config", (req, res) => {
      
      const { clientId, clientSecret } = req.body;

      // Vérifier que les deux champs sont présents
      if (!clientId || !clientSecret) {
        res.status(400).send("clientId and clientSecret are required");
        return;
      }

      // Mettre à jour le contenu du fichier config.json
      const updatedConfig = { clientId, clientSecret, login_successful: false };
      fs.writeFile(
        this.configPath,
        JSON.stringify(updatedConfig, null, 2),
        (err) => {
          if (err) {
            res.status(500).send("Error saving config file");
            return;
          }
          res.status(200).send("Config saved successfully");
          return;
        }
      );
    });

    this.app.get("/index", (req, res) => {
      const indexPath = path.join(__dirname, "../renderer/index.html");
      res.sendFile(indexPath);
    });

    this.app.use(
      "/img",
      express.static(path.join(__dirname, "../renderer/img"))
    );

    this.app.use(
      "/config",
      express.static(path.join(__dirname, "../renderer/config"))
    );

    this.app.listen(8888, async () => {
      console.log("Server is running on http://localhost:8888/login");

      // Attente active tant que le token n'est pas valide
      while (!this.spotifyToken || this.spotifyToken.trim() === "") {
        console.log(
          "Spotify token not retrieved yet. Waiting for authentication..."
        );
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Attendre 1 seconde avant de vérifier à nouveau
      }

      console.log("Token Spotify récupéré :", this.spotifyToken);

      // Met à jour le booléen login_successful dans spotify.json
      this.updateLoginStatus(true);

      // Crée et affiche la fenêtre après la récupération du token
      await this.createIfNotExists();
    });
  }

  /**
   * Met à jour le statut de login_successful dans le fichier spotify.json
   */
  private updateLoginStatus(success: boolean): void {
    try {
      const rawConfig = fs.readFileSync(this.configPath, "utf-8");
      const config: SpotifyConfig = JSON.parse(rawConfig);

      config.login_successful = success;

      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
      console.log(
        "Statut login_successful mis à jour dans spotify.json :",
        success
      );
    } catch (error) {
      console.error(
        "Erreur lors de la mise à jour du fichier spotify.json :",
        error
      );
    }
  }

  /**
   * Génère une chaîne aléatoire pour l'état de l'authentification
   */
  private generateRandomString(length: number): string {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Échange le code d'autorisation contre un access token
   */
  private async fetchAccessToken(code: string): Promise<void> {
    try {
      const response = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: code,
          redirect_uri: this.redirectUri,
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as SpotifyAuthResponse;
        this.spotifyToken = data.access_token;
        console.log("Token récupéré :", this.spotifyToken);
      } else {
        console.error(
          "Erreur lors de la récupération du token :",
          await response.text()
        );
      }
    } catch (error) {
      console.error("Erreur lors de la requête pour le token :", error);
    }
  }

  /**
   * Crée et prépare la fenêtre OSR.
   */
  public async createIfNotExists(showDevTools: boolean = false) {
    if (this.overlayWindow) return;

    if (!this.spotifyToken) {
      console.log("Le token Spotify est nécessaire pour afficher l'overlay.");
      return;
    }

    const options: OverlayWindowOptions = {
      name: "spotify-osr",
      height: 300,
      width: 400,
      show: false,
      transparent: true,
      resizable: false,
      webPreferences: {
        devTools: showDevTools,
        nodeIntegration: true,
        contextIsolation: false,
      },
    };

    this.overlayWindow = await this.overlayService.createNewOsrWindow(options);
    await this.overlayWindow.window.loadURL(
      path.join(__dirname, "../renderer/osr.html")
    );
    console.log("OSR window created");

    this.startSpotifyMonitoring();
  }

  private startSpotifyMonitoring() {
    setInterval(async () => {
      const songInfo = await this.fetchCurrentlyPlaying();
      if (songInfo) {
        this.updateOSR(songInfo);
      }
    }, 2000); // Vérifie toutes les 2 secondes
  }

  private async fetchCurrentlyPlaying(): Promise<any> {
    if (!this.spotifyToken) {
      console.log("Spotify token is missing");
      return null;
    }

    try {
      const response = await fetch("https://api.spotify.com/v1/me/player", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.spotifyToken}`,
        },
      });

      if (response.ok) {
        return response.json();
      } else {
        console.error(
          "Error fetching currently playing track",
          await response.text()
        );
        return null;
      }
    } catch (error) {
      console.error("Error fetching currently playing track", error);
      return null;
    }
  }

  private updateOSR(songInfo: any) {
    const artist = songInfo.item?.artists?.[0]?.name || "Artist Unknown";
    const track = songInfo.item?.name || "No Track";
    const albumImage =
      songInfo.item?.album?.images?.[0]?.url ||
      "https://via.placeholder.com/60";

    const browserWindow = this.overlayWindow.window;
    browserWindow.webContents.executeJavaScript(`(
      function(){
        document.querySelector(".details h3").innerText = \`${track}\`;
        document.querySelector(".details p").innerText = \`${artist}\`;
        document.querySelector("img").src = \`${albumImage}\`;
      })()`); // Met à jour l'interface de l'OSR
  }

  private setupIpcListeners() {
    ipcMain.on("spotify:playPause", async () => {
      await this.togglePlayPause();
    });

    ipcMain.on("spotify:next", async () => {
      await this.playNextTrack();
    });

    ipcMain.on("spotify:previous", async () => {
      await this.playPreviousTrack();
    });
  }

  private async togglePlayPause() {
    if (!this.spotifyToken) {
      console.log("Spotify token is missing, cannot toggle play/pause");
      return;
    }

    try {
      const url = this.pause
        ? "https://api.spotify.com/v1/me/player/play"
        : "https://api.spotify.com/v1/me/player/pause";

      const response = await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${this.spotifyToken}`,
        },
      });

      if (response.ok) {
        this.pause = !this.pause;
        console.log(this.pause ? "Paused" : "Playing");
      } else {
        console.error("Error toggling play/pause", await response.text());
      }
    } catch (error) {
      console.error("Error toggling play/pause", error);
    }
  }

  private async playNextTrack() {
    if (!this.spotifyToken) {
      console.log("Spotify token is missing, cannot skip track");
      return;
    }

    try {
      const response = await fetch(
        "https://api.spotify.com/v1/me/player/next",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.spotifyToken}`,
          },
        }
      );

      if (response.ok) {
        console.log("Skipped to next track");
      } else {
        console.error("Error skipping to next track", await response.text());
      }
    } catch (error) {
      console.error("Error skipping to next track", error);
    }
  }

  private async playPreviousTrack() {
    if (!this.spotifyToken) {
      console.log("Spotify token is missing, cannot go to previous track");
      return;
    }

    try {
      const response = await fetch(
        "https://api.spotify.com/v1/me/player/previous",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.spotifyToken}`,
          },
        }
      );

      if (response.ok) {
        console.log("Went to previous track");
      } else {
        console.error("Error going to previous track", await response.text());
      }
    } catch (error) {
      console.error("Error going to previous track", error);
    }
  }

  // Méthode pour fermer et désenregistrer les raccourcis
  public close() {
    if (this.overlayWindow) {
      this.overlayWindow.window.close();
      this.overlayWindow = null;
    }

  }

  /**
   * Méthode pour masquer l'overlay
   */
  public hide() {
    if (this.overlayWindow) {
      this.overlayWindow.window.hide();
      this.isVisible = false;
    }
  }

  /**
   * Méthode pour afficher l'overlay
   */
  public show() {
    if (this.overlayWindow) {
      this.overlayWindow.window.show();
      this.isVisible = true;
    }
  }
}
