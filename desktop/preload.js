/* A ponte entre a página e o processo principal. Só passa o que a página
   precisa, com o isolamento ligado: a página nunca vê o Node. */
"use strict";
const {contextBridge, ipcRenderer} = require("electron");

contextBridge.exposeInMainWorld("orcamentoDesktop", {
  versao: ipcRenderer.sendSync("versao"),
  plataforma: process.platform,
  ecras: () => ipcRenderer.sendSync("ecras"),
  definicoes: () => ipcRenderer.sendSync("defs"),
  abrirPainel: () => ipcRenderer.invoke("painel-abrir"),
  fecharPainel: () => ipcRenderer.invoke("painel-fechar"),
  estadoPainel: () => ipcRenderer.invoke("painel-estado"),
  trocarEcras: () => ipcRenderer.invoke("ecras-trocar"),
  ecraInteiro: (on) => ipcRenderer.invoke("ecra-inteiro", !!on),
  definirAuto: (on) => ipcRenderer.invoke("definir-auto", !!on),
  copiaDiaria: (json) => ipcRenderer.invoke("copia-diaria", String(json)),
  gravado: () => ipcRenderer.send("gravado"),
  abrirPastaCopias: () => ipcRenderer.invoke("pasta-copias"),
  pastaCopias: () => ipcRenderer.sendSync("pasta-copias-caminho"),
  aoMudarEcras: (cb) => { ipcRenderer.on("ecras-mudaram", (_e, n) => cb(n)); },
  aoMudarPainel: (cb) => {
    ipcRenderer.on("painel-fechado", () => cb({aberta: false}));
    ipcRenderer.on("painel-mudou", (_e, d) => cb(d));
  },
  procurarAtualizacao: () => ipcRenderer.invoke("atualizacao-procurar"),
  instalarAtualizacao: () => ipcRenderer.invoke("atualizacao-instalar"),
  aplicarAtualizacao: () => ipcRenderer.invoke("atualizacao-aplicar"),
  versoes: () => ipcRenderer.sendSync("atualizacao-versoes"),
  arrancou: (versao) => ipcRenderer.send("arrancou", String(versao || "")),
  abrirDescarga: (url) => ipcRenderer.invoke("abrir-descarga", String(url || "")),
  /* só respondem quando a aplicação arranca em modo de teste */
  _testeEcras: (lista) => ipcRenderer.invoke("teste-ecras", lista),
  _testeJanelas: () => ipcRenderer.invoke("teste-janelas"),
});
