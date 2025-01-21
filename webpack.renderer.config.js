/* eslint-disable @typescript-eslint/no-var-requires */
const config = require("./webpack.base.config");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const path = require("path");

const rendererConfig = { ...config };

// Cible Electron Renderer
rendererConfig.target = "electron-renderer";

// Points d'entrée pour Webpack
rendererConfig.entry = {
  renderer: "./src/renderer/renderer.ts",
};

// Plugins HTML pour générer les fichiers HTML
rendererConfig.plugins.push(
  new HtmlWebpackPlugin({
    template: "./src/renderer/index.html",
    filename: path.join(__dirname, "./dist/renderer/index.html"),
    chunks: ["renderer"],
    publicPath: "",
    inject: false,
  })
);

rendererConfig.plugins.push(
  new HtmlWebpackPlugin({
    template: "./src/renderer/osr.html",
    filename: path.join(__dirname, "./dist/renderer/osr.html"),
    inject: false,
  })
);

// Plugin pour copier le fichier JSON dans le répertoire `dist/renderer/config`
rendererConfig.plugins.push(
  new CopyWebpackPlugin({
    patterns: [
      {
        from: path.join(__dirname, "./src/browser/config/spotify.json"), // Chemin source
        to: path.join(__dirname, "./dist/renderer/config/spotify.json"), // Chemin destination dans `dist`
      },
    ],
  })
);


// Push de l'icon
rendererConfig.plugins.push(
  new CopyWebpackPlugin({
    patterns: [
      {
        from: path.join(__dirname, "./src/renderer/img/icon.png"), // Chemin source
        to: path.join(__dirname, "./dist/renderer/img/icon.png"), // Chemin destination dans `dist`
      },
    ],
  })
);

// Push de l'icon params
rendererConfig.plugins.push(
  new CopyWebpackPlugin({
    patterns: [
      {
        from: path.join(__dirname, "./src/renderer/img/settings-icon.png"), // Chemin source
        to: path.join(__dirname, "./dist/renderer/img/settings-icon.png"), // Chemin destination dans `dist`
      },
    ],
  })
);

// Résolution des extensions
rendererConfig.resolve = {
  extensions: [".ts", ".tsx", ".js", ".json"], // Inclure `.json` pour supporter les fichiers JSON
};

module.exports = rendererConfig;
