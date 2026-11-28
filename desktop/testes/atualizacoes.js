/* Testes de unidade das atualizações da aplicação de secretária (atualizacoes.js),
   em Node, sem Electron: uma «Release» de faz-de-conta em memória, pastas
   temporárias, e o relógio do prazo de arranque encurtado. */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path"), crypto = require("crypto");
const {criarAtualizacoes, compararVersoes, versaoDoHtml, shellMinimaDoHtml} = require("../atualizacoes");

let passes = 0;
const falhas = [];
const ok = (c, nome, det) => { if (c) passes++; else { falhas.push(nome + (det != null ? " — " + det : "")); console.log("  FALHOU: " + nome + (det != null ? " — " + det : "")); } };
const dormir = (ms) => new Promise(r => setTimeout(r, ms));
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");

const pagina = (v, shellMin, extra) => '<!doctype html><script>const VERSAO_APP = "' + v + '";\nconst VERSAO_SHELL_MINIMA = "' + (shellMin || "2.3.0") + '";' + (extra || "") + "</script>";
function release(versao, opts){
  opts = opts || {};
  const html = Buffer.from(opts.html || pagina(versao, opts.shellMin));
  const nome = "orcamento-familiar-" + versao + ".html";
  const somas = (opts.somaErrada ? "0".repeat(64) : sha(html)) + "  " + nome + "\n" + sha(Buffer.from("x")) + "  outro.zip\n";
  const assets = [
    {name: nome, browser_download_url: "mem://" + nome},
    {name: "SHA256SUMS-" + versao + ".txt", browser_download_url: "mem://somas"},
    {name: "Orcamento-Familiar-" + versao + "-instalador.exe", browser_download_url: "https://github.com/HVS87/orcamento-familiar/releases/download/v" + versao + "/Orcamento-Familiar-" + versao + "-instalador.exe"},
    {name: "Orcamento-Familiar-" + versao + "-portatil.exe", browser_download_url: "https://github.com/HVS87/orcamento-familiar/releases/download/v" + versao + "/Orcamento-Familiar-" + versao + "-portatil.exe"},
    {name: "Orcamento-Familiar-" + versao + "-mac-arm64.dmg", browser_download_url: "https://github.com/HVS87/orcamento-familiar/releases/download/v" + versao + "/Orcamento-Familiar-" + versao + "-mac-arm64.dmg"},
    {name: "Orcamento-Familiar-" + versao + "-mac-x64.dmg", browser_download_url: "https://github.com/HVS87/orcamento-familiar/releases/download/v" + versao + "/Orcamento-Familiar-" + versao + "-mac-x64.dmg"},
    {name: "Orcamento-Familiar-" + versao + "-linux-x86_64.AppImage", browser_download_url: "https://github.com/HVS87/orcamento-familiar/releases/download/v" + versao + "/Orcamento-Familiar-" + versao + "-linux-x86_64.AppImage"},
  ].filter(a => !(opts.semHtml && a.name === nome));
  return {json: JSON.stringify({tag_name: "v" + versao, html_url: "https://github.com/HVS87/orcamento-familiar/releases/tag/v" + versao, assets}),
    ficheiros: {["mem://" + nome]: html, "mem://somas": Buffer.from(somas)}};
}
function montar(embutida, shell, rel, extra){
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "orc-atual-"));
  const raiz = path.join(base, "app"); fs.mkdirSync(path.join(raiz, "icones"), {recursive: true});
  fs.writeFileSync(path.join(raiz, "orcamento-familiar.html"), pagina(embutida));
  fs.writeFileSync(path.join(raiz, "manifest.json"), "{}");
  fs.writeFileSync(path.join(raiz, "icones", "i.png"), "png");
  const dados = path.join(base, "dados");
  /* Cada recarga imita uma página a abrir: diz que arrancou, menos as partidas */
  const estado = {rel, recargas: 0, pedidos: 0, partidas: new Set()};
  let at = null;
  const net = {fetch: async (url) => {
    estado.pedidos++;
    if (url === "fonte") return new Response(estado.rel.json, {status: 200});
    const b = estado.rel.ficheiros[url];
    return b ? new Response(b, {status: 200}) : new Response("não", {status: 404});
  }};
  at = criarAtualizacoes(Object.assign({app: {getVersion: () => shell}, net, raizEmbutida: raiz, pastaDados: () => dados, fonte: "fonte",
    portatil: false, prazoArranque: 150, aoMudarRaiz: () => {
      estado.recargas++;
      setTimeout(() => { const v = at.versoes().ativa; if (!estado.partidas.has(v)) at.arrancou(v); }, 10);
    }}, extra || {}));
  return {at, estado, raiz, dados, base};
}

(async () => {
  console.log("— versões");
  ok(compararVersoes("2.10.0", "2.9.0") > 0 && compararVersoes("2.3", "2.3.0") === 0 && compararVersoes("1.0.0", "1.0.1") < 0, "compara versões por números");
  ok(versaoDoHtml(pagina("2.4.0")) === "2.4.0" && shellMinimaDoHtml(pagina("2.4.0", "2.3.5")) === "2.3.5", "lê a versão e a aplicação mínima da página");
  ok(shellMinimaDoHtml("<html>") === "0", "uma página antiga, sem mínimo, corre em qualquer aplicação");

  console.log("— procurar");
  let t = montar("2.3.0", "2.3.0", release("2.3.0"));
  let r = await t.at.procurar();
  ok(r.estado === "atual" && r.atual === "2.3.0", "a mesma versão na Release: está em dia", JSON.stringify(r));
  t.estado.rel = release("2.4.0");
  r = await t.at.procurar();
  ok(r.estado === "disponivel" && r.versao === "2.4.0", "versão maior: disponível", JSON.stringify(r));
  ok(!("_html" in r) && !("_assets" in r), "o que vai para a página não leva endereços internos");
  t.estado.rel = release("2.2.0");
  ok((await t.at.procurar()).estado === "atual", "uma Release mais antiga não é «nova»");
  t.estado.rel = release("2.4.0", {semHtml: true});
  r = await t.at.procurar();
  ok(r.estado === "reinstalar" && /instalador\.exe$/.test(r.descarregar), "sem a página na Release: oferece o instalador para este sistema", r.descarregar);

  console.log("— instalar e aplicar");
  t.estado.rel = release("2.4.0");
  r = await t.at.instalar();
  ok(r.estado === "pronta" && r.versao === "2.4.0", "descarrega, confere e fica pronta", JSON.stringify(r));
  ok(fs.existsSync(path.join(t.dados, "atualizacoes", "2.4.0", "orcamento-familiar.html")), "a página fica na pasta de dados");
  ok(!fs.existsSync(path.join(t.dados, "atualizacoes", "2.4.0", "orcamento-familiar.html.parcial")), "sem ficheiros a meio");
  ok(t.at.versoes().ativa === "2.4.0", "e passa a ser a ativa");
  ok(t.at.ficheiro("orcamento-familiar.html").indexOf(path.join("atualizacoes", "2.4.0")) >= 0, "o protocolo serve a página nova");
  ok(t.at.ficheiro("manifest.json") === path.join(t.raiz, "manifest.json") && t.at.ficheiro(path.join("icones", "i.png")), "os ícones e o manifesto vêm do que está instalado");
  ok(t.at.ficheiro("../../segredo") === null, "e nada fora das pastas se serve");
  t.at.aplicar();
  ok(t.estado.recargas === 1, "aplicar recarrega as janelas");
  t.at.arrancou("2.4.0");
  await dormir(300);
  ok(t.at.versoes().ativa === "2.4.0" && t.estado.recargas === 1, "a página disse que arrancou: fica");

  console.log("— o que não se instala");
  t.estado.rel = release("2.5.0", {somaErrada: true});
  r = await t.at.instalar().catch(e => ({estado: "erro", erro: e.message}));
  ok(r.estado === "erro" && /SHA256/.test(r.erro), "soma errada: recusa", r.erro);
  ok(t.at.versoes().ativa === "2.4.0" && !fs.existsSync(path.join(t.dados, "atualizacoes", "2.5.0")), "e não toca em nada");
  t.estado.rel = release("2.5.0", {html: pagina("2.4.9")});
  r = await t.at.instalar().catch(e => ({estado: "erro", erro: e.message}));
  ok(r.estado === "erro" && /não é da versão/.test(r.erro), "uma página com outra versão lá dentro: recusa", r.erro);
  t.estado.rel = release("2.6.0", {shellMin: "3.0.0"});
  r = await t.at.instalar();
  ok(r.estado === "reinstalar" && r.shellMinima === "3.0.0" && /instalador\.exe$/.test(r.descarregar), "pede uma aplicação mais nova: não instala, oferece o instalador", JSON.stringify(r));
  ok(t.at.versoes().ativa === "2.4.0", "e continua na que estava");

  console.log("— uma página que não arranca");
  t.estado.rel = release("2.7.0");
  r = await t.at.instalar();
  ok(r.estado === "pronta", "instala-se como qualquer outra");
  t.estado.partidas.add("2.7.0");
  t.at.aplicar();
  ok(t.at.versoes().ativa === "2.7.0", "passa a ativa");
  await dormir(400);   // não diz que arrancou
  ok(t.at.versoes().ativa === "2.4.0", "não disse que arrancou: volta à anterior", t.at.versoes().ativa);
  ok(t.at.versoes().falhou === "2.7.0", "e regista qual falhou");
  ok(t.estado.recargas >= 3, "recarregando as janelas outra vez");
  ok((await t.at.procurar()).estado === "ma", "procurar outra vez não volta a oferecer a má");
  t.at.arrancou("2.4.0");

  console.log("— reinstalar uma versão mais recente");
  let t2 = montar("2.3.0", "2.3.0", release("2.4.0"));
  await t2.at.instalar();
  ok(t2.at.versoes().ativa === "2.4.0", "com uma atualização instalada");
  fs.writeFileSync(path.join(t2.raiz, "orcamento-familiar.html"), pagina("2.5.0"));   // o executável novo traz a 2.5.0
  const t3 = criarAtualizacoes({app: {getVersion: () => "2.5.0"}, net: {fetch: async () => new Response("{}")}, raizEmbutida: t2.raiz,
    pastaDados: () => t2.dados, fonte: "fonte", prazoArranque: 150, aoMudarRaiz: () => {}});
  ok(t3.versoes().ativa === "2.5.0", "a do executável, mais nova, ganha");
  ok(!fs.existsSync(path.join(t2.dados, "atualizacoes", "2.4.0")), "e a atualização velha é apagada");
  ok(t3.raizAtiva() === t2.raiz, "servindo-se do que veio instalado");

  console.log("— uma atualização que pede mais do que a aplicação tem");
  const t4 = montar("2.3.0", "2.3.0", release("2.3.0"));
  fs.mkdirSync(path.join(t4.dados, "atualizacoes", "2.9.0"), {recursive: true});
  fs.writeFileSync(path.join(t4.dados, "atualizacoes", "2.9.0", "orcamento-familiar.html"), pagina("2.9.0", "9.0.0"));
  fs.writeFileSync(path.join(t4.dados, "atualizacoes", "atual.json"), JSON.stringify({versao: "2.9.0"}));
  ok(t4.at.versoes().ativa === "2.3.0", "mesmo que esteja na pasta, não se usa");

  [t, t2, t4].forEach(x => { try { fs.rmSync(x.base, {recursive: true, force: true}); } catch(e){} });
  console.log("\nAtualizações: " + passes + "/" + (passes + falhas.length));
  process.exit(falhas.length ? 1 : 0);
})().catch(e => { console.log("REBENTOU: " + (e.stack || e)); process.exit(1); });
