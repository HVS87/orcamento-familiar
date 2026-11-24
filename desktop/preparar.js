/* Copia a página e o que ela usa para desktop/app, de onde o empacotador a leva.
   Em Node, para correr igual no Windows, no Mac e no Linux. */
"use strict";
const fs = require("fs"), path = require("path");
const raiz = path.join(__dirname, "..");
const destino = path.join(__dirname, "app");
fs.rmSync(destino, {recursive: true, force: true});
fs.mkdirSync(path.join(destino, "icones"), {recursive: true});
["orcamento-familiar.html", "manifest.json"].forEach(f => fs.copyFileSync(path.join(raiz, f), path.join(destino, f)));
fs.readdirSync(path.join(raiz, "icones")).forEach(f => fs.copyFileSync(path.join(raiz, "icones", f), path.join(destino, "icones", f)));
const pkg = require("./package.json");
const html = fs.readFileSync(path.join(destino, "orcamento-familiar.html"), "utf8");
const m = /const VERSAO_APP = "([^"]+)"/.exec(html);
if (!m || m[1] !== pkg.version){
  console.error("A versão da página (" + (m && m[1]) + ") não é a do pacote (" + pkg.version + ").");
  process.exit(1);
}
console.log("app/ pronta — versão " + pkg.version);
