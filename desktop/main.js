/* Orçamento Familiar — processo principal da aplicação de secretária.

   A página é a mesma da versão web (orcamento-familiar.html), servida por
   um protocolo próprio, app://orcamento, que lhe dá uma origem verdadeira:
   o armazenamento fica guardado entre arranques, e as duas janelas (a
   principal e a companheira do segundo ecrã) partilham-no e falam entre si
   pelo BroadcastChannel, tal como dois separadores do navegador.

   O que só a aplicação de secretária faz:
   - sabe onde estão os ecrãs, põe a janela companheira no outro, e reage
     quando um ecrã se liga ou desliga;
   - lembra-se de onde ficou cada janela, para cada arrumação de ecrãs;
   - guarda uma cópia diária dos dados numa pasta (as últimas 30);
   - na versão portátil, guarda tudo ao lado do executável. */
"use strict";
const {app, BrowserWindow, ipcMain, screen, shell, dialog, Menu, protocol, net, nativeTheme} = require("electron");
const fs = require("fs");
const path = require("path");
const {pathToFileURL} = require("url");
const {criarAtualizacoes} = require("./atualizacoes");

const ESQUEMA = "app";
const ANFITRIAO = "orcamento";
const PAGINA = ESQUEMA + "://" + ANFITRIAO + "/orcamento-familiar.html";
const PROJETO = "https://github.com/HVS87/orcamento-familiar";

/* ---------- onde vivem os dados ----------
   Portátil: numa pasta ao lado do .exe, para levar numa pen. Instalada: na
   pasta de dados do utilizador, como qualquer aplicação. */
const PORTATIL = process.env.PORTABLE_EXECUTABLE_DIR || null;
if (PORTATIL){
  const dir = path.join(PORTATIL, "Orçamento Familiar - dados");
  try { fs.mkdirSync(dir, {recursive: true}); app.setPath("userData", dir); } catch(e){}
}
if (process.env.ORCAMENTO_DADOS) app.setPath("userData", process.env.ORCAMENTO_DADOS);   // testes
const PASTA_COPIAS = () => path.join(app.getPath("userData"), "copias");
const FICHEIRO_JANELAS = () => path.join(app.getPath("userData"), "janelas.json");
const FICHEIRO_DEFS = () => path.join(app.getPath("userData"), "definicoes.json");

/* ---------- a pasta da página ----------
   Empacotada, vem em app/ (preparada por preparar.js). Em desenvolvimento
   serve-se diretamente da raiz do projeto, para não haver cópias velhas. */
const RAIZ = app.isPackaged ? path.join(__dirname, "app")
  : (fs.existsSync(path.join(__dirname, "app", "orcamento-familiar.html")) && process.env.ORCAMENTO_USAR_APP
    ? path.join(__dirname, "app") : path.join(__dirname, ".."));

protocol.registerSchemesAsPrivileged([{scheme: ESQUEMA,
  privileges: {standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true}}]);

/* ---------- ecrãs (com uma porta para os testes simularem dois) ---------- */
let ecrasFalsos = null;
try { if (process.env.ORCAMENTO_ECRAS_TESTE) ecrasFalsos = JSON.parse(process.env.ORCAMENTO_ECRAS_TESTE); } catch(e){}
function ecras(){
  if (ecrasFalsos) return ecrasFalsos.map((b, i) => ({id: i + 1, bounds: b, workArea: b, primario: i === 0}));
  const p = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map(d => ({id: d.id, bounds: d.bounds, workArea: d.workArea, primario: d.id === p}));
}
function ecraDe(win){
  const lista = ecras();
  if (!win || win.isDestroyed()) return lista[0];
  const b = win.getBounds(), cx = b.x + b.width / 2, cy = b.y + b.height / 2;
  return lista.find(e => cx >= e.bounds.x && cx < e.bounds.x + e.bounds.width && cy >= e.bounds.y && cy < e.bounds.y + e.bounds.height)
    || lista.find(e => e.primario) || lista[0];
}
/** Assinatura da arrumação de ecrãs: cada arrumação lembra-se das suas janelas. */
const assinatura = () => ecras().map(e => [e.bounds.x, e.bounds.y, e.bounds.width, e.bounds.height].join(",")).sort().join("|");

/* ---------- memória das janelas e definições ---------- */
const lerJSON = (f, omissao) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch(e){ return omissao; } };
const gravarJSON = (f, v) => { try { fs.mkdirSync(path.dirname(f), {recursive: true}); fs.writeFileSync(f, JSON.stringify(v, null, 2)); } catch(e){} };
function lembrar(qual, win){
  if (!win || win.isDestroyed() || win.isMinimized()) return;
  const todas = lerJSON(FICHEIRO_JANELAS(), {});
  const k = assinatura();
  todas[k] = todas[k] || {};
  todas[k][qual] = {bounds: win.getNormalBounds(), max: win.isMaximized(), ecra: ecraDe(win).id};
  gravarJSON(FICHEIRO_JANELAS(), todas);
}
function lembrado(qual){
  const r = (lerJSON(FICHEIRO_JANELAS(), {})[assinatura()] || {})[qual];
  if (!r || !r.bounds) return null;
  // Só vale se ainda cair dentro de algum ecrã
  const b = r.bounds;
  const visivel = ecras().some(e => b.x < e.bounds.x + e.bounds.width - 80 && b.x + b.width > e.bounds.x + 80 &&
    b.y < e.bounds.y + e.bounds.height - 60 && b.y + b.height > e.bounds.y);
  return visivel ? r : null;
}
const defs = () => Object.assign({painelAuto: false}, lerJSON(FICHEIRO_DEFS(), {}));

/* ---------- janelas ---------- */
let principal = null, companheira = null;
const corFundo = () => nativeTheme.shouldUseDarkColors ? "#0c1119" : "#f4f6fa";
/* Em modo de teste, uma janela tapada por outras não abranda os temporizadores
   (o Chromium dá-a como escondida e passa a acordá-los de minuto a minuto).
   Em uso normal o abrandamento fica: poupa bateria com a janela minimizada. */
const webPreferences = {preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: true,
  backgroundThrottling: !process.env.ORCAMENTO_ECRAS_TESTE};

function aplicarPolitica(win){
  // Ligações para fora abrem no navegador; dentro da aplicação, nada de janelas soltas
  win.webContents.setWindowOpenHandler(({url}) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return {action: "deny"};
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith(ESQUEMA + "://" + ANFITRIAO + "/")){ e.preventDefault(); if (/^https?:\/\//.test(url)) shell.openExternal(url); }
  });
}

function criarPrincipal(){
  const r = lembrado("principal");
  const ecra = ecras().find(e => e.primario) || ecras()[0];
  const wa = ecra.workArea;
  const larg = Math.min(1440, wa.width), alt = Math.min(940, wa.height);
  principal = new BrowserWindow(Object.assign({
    x: wa.x + Math.round((wa.width - larg) / 2), y: wa.y + Math.round((wa.height - alt) / 2), width: larg, height: alt,
  }, r ? r.bounds : {}, {
    minWidth: 360, minHeight: 480, show: false, backgroundColor: corFundo(),
    title: "Orçamento Familiar",
    icon: path.join(__dirname, "build", "icon.png"),
    autoHideMenuBar: process.platform !== "darwin",
    webPreferences,
  }));
  if (r && r.max) maximizar(principal, r.bounds);
  aplicarPolitica(principal);
  principal.once("ready-to-show", () => principal.show());
  principal.loadURL(PAGINA);
  const guardar = () => lembrar("principal", principal);
  principal.on("resize", guardar); principal.on("move", guardar);
  principal.on("closed", () => {
    principal = null;
    if (companheira && !companheira.isDestroyed()) companheira.close();
  });
}

/* Maximizar numa área. Com ecrãs simulados (testes), o sistema maximizava
   no ecrã verdadeiro mais próximo: aí ocupa-se a área à mão. */
function maximizar(w, area){
  if (ecrasFalsos){ if (area) w.setBounds(area); }
  else w.maximize();
}
/** O ecrã onde a companheira deve ficar: um que não seja o da principal. */
function ecraParaCompanheira(){
  const lista = ecras();
  if (lista.length < 2) return null;
  const daPrincipal = ecraDe(principal);
  return lista.find(e => e.id !== daPrincipal.id) || null;
}
function abrirCompanheira(){
  if (companheira && !companheira.isDestroyed()){ companheira.show(); companheira.focus(); return estadoEcras(); }
  const alvo = ecraParaCompanheira();
  const r = lembrado("companheira");
  let bounds;
  if (r && (!alvo || r.ecra === alvo.id)) bounds = r.bounds;
  else if (alvo) bounds = alvo.workArea;
  else {
    // Um ecrã só: ao lado da principal, com metade do espaço
    const wa = ecraDe(principal).workArea;
    bounds = {x: wa.x + Math.round(wa.width / 2), y: wa.y, width: Math.round(wa.width / 2), height: wa.height};
  }
  companheira = new BrowserWindow(Object.assign({}, bounds, {
    minWidth: 360, minHeight: 400, show: false, backgroundColor: corFundo(),
    title: "Orçamento Familiar — segundo ecrã",
    icon: path.join(__dirname, "build", "icon.png"),
    autoHideMenuBar: true,
    webPreferences,
  }));
  if (alvo && !r) maximizar(companheira, alvo.workArea);
  else if (r && r.max) maximizar(companheira, (alvo || ecraDe(principal)).workArea);
  aplicarPolitica(companheira);
  companheira.once("ready-to-show", () => companheira.showInactive ? companheira.showInactive() : companheira.show());
  companheira.loadURL(PAGINA + "?janela=painel");
  const guardar = () => lembrar("companheira", companheira);
  companheira.on("resize", guardar); companheira.on("move", guardar);
  companheira.on("closed", () => { companheira = null; avisar("painel-fechado", {}); });
  return estadoEcras();
}
function fecharCompanheira(){ if (companheira && !companheira.isDestroyed()) companheira.close(); }
/** Troca as duas janelas de ecrã — útil quando o ecrã grande é o de lado. */
function trocarEcras(){
  if (!principal || !companheira || companheira.isDestroyed()) return false;
  const a = {b: principal.getNormalBounds(), m: principal.isMaximized(), f: principal.isFullScreen()};
  const c = {b: companheira.getNormalBounds(), m: companheira.isMaximized(), f: companheira.isFullScreen()};
  [principal, companheira].forEach(w => { if (w.isFullScreen()) w.setFullScreen(false); if (w.isMaximized()) w.unmaximize(); });
  principal.setBounds(c.b); companheira.setBounds(a.b);
  if (c.m) maximizar(principal, c.b);
  if (a.m) maximizar(companheira, a.b);
  if (a.f) companheira.setFullScreen(true);
  return true;
}
const estadoEcras = () => ({ecras: ecras().length, aberta: !!(companheira && !companheira.isDestroyed())});
function avisar(canal, dados){
  [principal, companheira].forEach(w => { if (w && !w.isDestroyed()) w.webContents.send(canal, dados); });
}
/** Um ecrã ligou-se ou desligou-se. */
function ecrasMudaram(){
  const n = ecras().length;
  if (companheira && !companheira.isDestroyed()){
    const alvo = ecraParaCompanheira();
    if (!alvo){
      // Ficou um ecrã só: a companheira vem para metade dele, em vez de ficar perdida fora de vista
      if (companheira.isFullScreen()) companheira.setFullScreen(false);
      if (companheira.isMaximized()) companheira.unmaximize();
      const wa = ecraDe(principal).workArea;
      companheira.setBounds({x: wa.x + Math.round(wa.width / 2), y: wa.y, width: Math.round(wa.width / 2), height: wa.height});
    } else if (ecraDe(companheira).id === ecraDe(principal).id){
      companheira.setBounds(alvo.workArea); maximizar(companheira, alvo.workArea);
    }
  } else if (n > 1 && defs().painelAuto && principal){
    abrirCompanheira();
  }
  avisar("ecras-mudaram", n);
}

/* ---------- cópia diária ---------- */
let ultimaCopia = "";
function copiaDiaria(json){
  if (typeof json !== "string" || json.length < 20 || json.length > 50 * 1024 * 1024) return false;
  try { JSON.parse(json); } catch(e){ return false; }
  const hoje = new Date().toISOString().slice(0, 10);
  const pasta = PASTA_COPIAS();
  try {
    fs.mkdirSync(pasta, {recursive: true});
    fs.writeFileSync(path.join(pasta, "orcamento-" + hoje + ".json"), json);
    if (ultimaCopia !== hoje){
      ultimaCopia = hoje;
      const velhas = fs.readdirSync(pasta).filter(f => /^orcamento-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
      while (velhas.length > 30) fs.unlinkSync(path.join(pasta, velhas.shift()));
    }
    return true;
  } catch(e){ return false; }
}

/* ---------- atualizações ---------- */
let ATUAL = null;
const comErro = (fn) => async () => { try { return await fn(); } catch(e){ return {estado: "erro", erro: String(e && e.message || e)}; } };
ipcMain.handle("atualizacao-procurar", comErro(() => ATUAL.procurar()));
ipcMain.handle("atualizacao-instalar", comErro(() => ATUAL.instalar()));
ipcMain.handle("atualizacao-aplicar", comErro(() => ATUAL.aplicar()));
ipcMain.on("atualizacao-versoes", e => { e.returnValue = ATUAL ? ATUAL.versoes() : {}; });
ipcMain.on("arrancou", (e, versao) => { if (ATUAL) ATUAL.arrancou(String(versao || "")); });
/* Descarregar a aplicação nova (quando a página pede uma mais recente):
   só para o GitHub do projeto, no navegador de quem usa. */
ipcMain.handle("abrir-descarga", (e, url) => {
  if (typeof url === "string" && /^https:\/\/github\.com\/HVS87\/orcamento-familiar\//.test(url)){ shell.openExternal(url); return true; }
  return false;
});

/* ---------- ponte com a página ---------- */
ipcMain.on("versao", e => { e.returnValue = app.getVersion(); });
ipcMain.on("ecras", e => { e.returnValue = ecras(); });
ipcMain.on("defs", e => { e.returnValue = defs(); });
ipcMain.handle("painel-abrir", () => abrirCompanheira());
ipcMain.handle("painel-fechar", () => { fecharCompanheira(); return estadoEcras(); });
ipcMain.handle("painel-estado", () => estadoEcras());
ipcMain.handle("ecras-trocar", () => trocarEcras());
ipcMain.handle("ecra-inteiro", (e, on) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (w) w.setFullScreen(!!on);
  return !!on;
});
ipcMain.handle("definir-auto", (e, on) => { const d = defs(); d.painelAuto = !!on; gravarJSON(FICHEIRO_DEFS(), d); return d.painelAuto; });
ipcMain.handle("copia-diaria", (e, json) => copiaDiaria(json));
/* O armazenamento da página vai para o disco quando calha; depois de cada
   gravação pede-se que vá já. Assim um corte de luz ou um fecho à força
   não leva a última alteração. */
let tDisco = null;
ipcMain.on("gravado", (e) => {
  clearTimeout(tDisco);
  tDisco = setTimeout(() => { try { e.sender.session.flushStorageData(); } catch(err){} }, 300);
});
ipcMain.handle("pasta-copias", () => { fs.mkdirSync(PASTA_COPIAS(), {recursive: true}); return shell.openPath(PASTA_COPIAS()); });
ipcMain.on("pasta-copias-caminho", e => { e.returnValue = PASTA_COPIAS(); });
/* Só para os testes: simular um ecrã a ligar-se ou a desligar-se */
ipcMain.handle("teste-ecras", (e, lista) => {
  if (!process.env.ORCAMENTO_ECRAS_TESTE) return false;
  ecrasFalsos = lista; ecrasMudaram(); return true;
});
ipcMain.handle("teste-janelas", () => {
  if (!process.env.ORCAMENTO_ECRAS_TESTE) return null;
  const d = (w) => w && !w.isDestroyed() ? {bounds: w.getBounds(), max: w.isMaximized(), full: w.isFullScreen(), visivel: w.isVisible(), ecra: ecraDe(w).id} : null;
  return {principal: d(principal), companheira: d(companheira), dados: app.getPath("userData")};
});

/* ---------- menu ---------- */
function menu(){
  const mac = process.platform === "darwin";
  const t = [
    ...(mac ? [{label: "Orçamento Familiar", submenu: [
      {role: "about", label: "Acerca do Orçamento Familiar"}, {type: "separator"},
      {role: "hide", label: "Ocultar"}, {role: "hideOthers", label: "Ocultar os outros"}, {role: "unhide", label: "Mostrar tudo"},
      {type: "separator"}, {role: "quit", label: "Sair"}]}] : []),
    {label: "Ficheiro", submenu: [
      {label: "Abrir a pasta das cópias diárias", click: () => { fs.mkdirSync(PASTA_COPIAS(), {recursive: true}); shell.openPath(PASTA_COPIAS()); }},
      {type: "separator"},
      mac ? {role: "close", label: "Fechar a janela"} : {role: "quit", label: "Sair"}]},
    {label: "Editar", submenu: [
      {role: "undo", label: "Anular"}, {role: "redo", label: "Refazer"}, {type: "separator"},
      {role: "cut", label: "Cortar"}, {role: "copy", label: "Copiar"}, {role: "paste", label: "Colar"}, {role: "selectAll", label: "Selecionar tudo"}]},
    {label: "Ver", submenu: [
      {label: "Janela companheira (segundo ecrã)", accelerator: "CmdOrCtrl+Shift+2",
        click: () => { if (companheira && !companheira.isDestroyed()) fecharCompanheira(); else abrirCompanheira(); avisar("painel-mudou", estadoEcras()); }},
      {label: "Trocar as janelas de ecrã", accelerator: "CmdOrCtrl+Shift+X", click: () => trocarEcras()},
      {type: "separator"},
      {role: "resetZoom", label: "Tamanho real"}, {role: "zoomIn", label: "Aumentar"}, {role: "zoomOut", label: "Diminuir"},
      {type: "separator"},
      {role: "togglefullscreen", label: "Ecrã inteiro"},
      ...(app.isPackaged ? [] : [{type: "separator"}, {role: "reload", label: "Recarregar"}, {role: "toggleDevTools", label: "Ferramentas de programador"}])]},
    {label: "Janela", submenu: [{role: "minimize", label: "Minimizar"}, ...(mac ? [{role: "zoom", label: "Ampliar"}, {role: "front", label: "Trazer tudo para a frente"}] : [])]},
    {label: "Ajuda", submenu: [
      {label: "Página do projeto", click: () => shell.openExternal(PROJETO)},
      {label: "Versões e novidades", click: () => shell.openExternal(PROJETO + "/releases")},
      {type: "separator"},
      {label: "Sobre", click: () => dialog.showMessageBox(principal, {type: "info", title: "Orçamento Familiar",
        message: "Orçamento Familiar " + app.getVersion(),
        detail: "Aplicação de secretária. Os dados ficam neste computador" + (PORTATIL ? ", na pasta ao lado do executável." : ".") +
          "\nCópias diárias em: " + PASTA_COPIAS()})}]},
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(t));
}

/* ---------- arranque ---------- */
if (!app.requestSingleInstanceLock()){
  app.quit();
} else {
  app.on("second-instance", () => {
    if (principal){ if (principal.isMinimized()) principal.restore(); principal.focus(); }
  });
  /* O identificador do navegador leva o nome do produto, e «Orçamento» tem um
     carácter fora do ASCII: num cabeçalho HTTP isso rebenta (o protocolo
     próprio recusa o pedido). Fica só com letras simples. */
  app.userAgentFallback = app.userAgentFallback.replace(/[^\x20-\x7E]/g, (c) => ({"ç": "c", "Ç": "C"})[c] || "");
  app.whenReady().then(() => {
    ATUAL = criarAtualizacoes({
      app, net, raizEmbutida: RAIZ, pastaDados: () => app.getPath("userData"),
      fonte: process.env.ORCAMENTO_FONTE_ATUALIZACOES || null,
      prazoArranque: parseInt(process.env.ORCAMENTO_PRAZO_ARRANQUE || "0", 10) || undefined,
      portatil: !!PORTATIL,
      aoMudarRaiz: () => {
        [principal, companheira].forEach(w => { if (w && !w.isDestroyed()) w.webContents.reloadIgnoringCache(); });
      },
    });
    protocol.handle(ESQUEMA, (req) => {
      const u = new URL(req.url);
      if (u.host !== ANFITRIAO) return new Response("não encontrado", {status: 404});
      const rel = decodeURIComponent(u.pathname).replace(/^\/+/, "") || "orcamento-familiar.html";
      // A página atualizada, se houver; o resto (ícones, manifesto) cai no que veio com o executável
      const f = ATUAL.ficheiro(rel);
      if (!f) return new Response("não encontrado", {status: 404});
      return net.fetch(pathToFileURL(f).toString());
    });
    menu();
    criarPrincipal();
    ATUAL.vigiar();   // se arrancou numa página atualizada, ela tem de dizer que está bem
    screen.on("display-added", ecrasMudaram);
    screen.on("display-removed", ecrasMudaram);
    screen.on("display-metrics-changed", () => avisar("ecras-mudaram", ecras().length));
    app.on("activate", () => { if (!principal) criarPrincipal(); });
  });
  app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
}
