/* Atualizações da aplicação de secretária, sem reinstalar.

   A aplicação de secretária é uma janela à volta de uma página. Quase todas
   as versões novas só mudam a página — por isso é ela que se atualiza:
   descarrega-se da Release do GitHub, confere-se pela soma SHA256 publicada
   ao lado, e guarda-se na pasta de dados (atualizacoes/<versão>/). Daí em
   diante o protocolo próprio serve essa página em vez da que veio com o
   executável. A origem continua a ser a mesma (app://orcamento), e por isso
   o armazenamento — orçamento, preferências, sincronização — fica onde está.

   - Funciona no portátil, no instalador, no Mac (mesmo sem assinatura de
     programador) e no Linux, porque não troca o executável.
   - A página que veio com o executável fica sempre de reserva: se uma página
     atualizada não disser que arrancou bem em 20 segundos, marca-se como má
     e volta-se à anterior.
   - Uma página pode pedir uma aplicação de secretária mais recente do que a
     instalada (VERSAO_SHELL_MINIMA). Aí não se instala: oferece-se o ficheiro
     certo para este sistema, para descarregar.
   - Reinstalar uma versão mais recente do que a atualização deixa a do
     executável ganhar, e as atualizações antigas são apagadas. */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const FONTE_OMISSAO = "https://api.github.com/repos/HVS87/orcamento-familiar/releases/latest";
const PRAZO_ARRANQUE = 20000;

const versaoDoHtml = (t) => { const m = /const VERSAO_APP = "([^"]+)"/.exec(t || ""); return m ? m[1] : null; };
const shellMinimaDoHtml = (t) => { const m = /const VERSAO_SHELL_MINIMA = "([^"]+)"/.exec(t || ""); return m ? m[1] : "0"; };
/** Compara versões x.y.z: negativo, zero ou positivo. Partes que faltem contam como 0. */
function compararVersoes(a, b){
  const pa = String(a || "0").split(/[.-]/).map(n => parseInt(n, 10) || 0);
  const pb = String(b || "0").split(/[.-]/).map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++){
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

function criarAtualizacoes(o){
  // o: {app, net, raizEmbutida, pastaDados(), fonte, portatil, aoMudarRaiz()}
  const pasta = () => path.join(o.pastaDados(), "atualizacoes");
  const ficheiroEstado = () => path.join(pasta(), "atual.json");
  const lerEstado = () => { try { return JSON.parse(fs.readFileSync(ficheiroEstado(), "utf8")) || {}; } catch(e){ return {}; } };
  const gravarEstado = (e) => { fs.mkdirSync(pasta(), {recursive: true}); fs.writeFileSync(ficheiroEstado(), JSON.stringify(e, null, 2)); };
  const htmlEmbutido = () => fs.readFileSync(path.join(o.raizEmbutida, "orcamento-familiar.html"), "utf8");
  const VERSAO_EMBUTIDA = versaoDoHtml(htmlEmbutido()) || o.app.getVersion();
  let aVerificar = null, tVerificar = null, ultimaProcura = null;

  /** A pasta de onde a página se serve agora: a atualização instalada, se for boa e mais recente. */
  function raizAtiva(){
    const e = lerEstado();
    if (!e.versao || (e.mas || []).indexOf(e.versao) >= 0) return o.raizEmbutida;
    if (compararVersoes(e.versao, VERSAO_EMBUTIDA) <= 0) return o.raizEmbutida;
    const p = path.join(pasta(), e.versao);
    const f = path.join(p, "orcamento-familiar.html");
    if (!fs.existsSync(f)) return o.raizEmbutida;
    if (compararVersoes(shellMinimaDoHtml(fs.readFileSync(f, "utf8")), o.app.getVersion()) > 0) return o.raizEmbutida;
    return p;
  }
  const versaoAtiva = () => {
    const r = raizAtiva();
    return r === o.raizEmbutida ? VERSAO_EMBUTIDA : path.basename(r);
  };
  /** Um ficheiro pedido pela página: primeiro na atualização, depois no que veio com o executável. */
  function ficheiro(rel){
    for (const raiz of [raizAtiva(), o.raizEmbutida]){
      const f = path.normalize(path.join(raiz, rel));
      if (f.startsWith(path.normalize(raiz + path.sep)) && fs.existsSync(f) && !fs.statSync(f).isDirectory()) return f;
    }
    return null;
  }
  /** Ao arrancar: uma reinstalação mais recente torna as atualizações velhas inúteis — apagam-se. */
  function arrumar(){
    try {
      const e = lerEstado();
      if (e.versao && compararVersoes(e.versao, VERSAO_EMBUTIDA) <= 0){
        fs.readdirSync(pasta()).filter(n => /^\d/.test(n)).forEach(n => fs.rmSync(path.join(pasta(), n), {recursive: true, force: true}));
        gravarEstado({mas: e.mas || []});
      }
    } catch(err){}
  }

  async function obter(url, comoTexto){
    const r = await o.net.fetch(url, {headers: {"Accept": "application/vnd.github+json, */*", "User-Agent": "OrcamentoFamiliar"}});
    if (!r.ok) throw new Error("o GitHub respondeu " + r.status);
    return comoTexto ? r.text() : Buffer.from(await r.arrayBuffer());
  }
  /** O ficheiro da aplicação de secretária certo para este sistema, para quando é preciso reinstalar. */
  function ficheiroDoSistema(assets){
    const nomes = assets.map(a => a.name);
    let re;
    if (process.platform === "win32") re = o.portatil ? /-portatil\.exe$/ : /-instalador\.exe$/;
    else if (process.platform === "darwin") re = process.arch === "arm64" ? /-mac-arm64\.dmg$/ : /-mac-x64\.dmg$/;
    else re = /\.AppImage$/;
    const n = nomes.find(x => re.test(x));
    const a = assets.find(x => x.name === n);
    return a ? a.browser_download_url : null;
  }

  async function procurar(){
    const fonte = o.fonte || FONTE_OMISSAO;
    const rel = JSON.parse(await obter(fonte, true));
    const versao = String(rel.tag_name || "").replace(/^v/, "");
    const assets = Array.isArray(rel.assets) ? rel.assets : [];
    const atual = versaoAtiva();
    const res = {versao, atual, notas: rel.html_url || "", em: Date.now()};
    if (!versao || compararVersoes(versao, atual) <= 0){ res.estado = "atual"; ultimaProcura = res; return res; }
    const html = assets.find(a => a.name === "orcamento-familiar-" + versao + ".html");
    const somas = assets.find(a => /^SHA256SUMS(-[\d.]+)?\.txt$/.test(a.name));
    if ((lerEstado().mas || []).indexOf(versao) >= 0){ res.estado = "ma"; ultimaProcura = res; return res; }
    if (!html || !somas){ res.estado = "reinstalar"; res.descarregar = ficheiroDoSistema(assets) || res.notas; ultimaProcura = res; return res; }
    res.estado = "disponivel";
    res._html = html.browser_download_url; res._somas = somas.browser_download_url; res._assets = assets;
    ultimaProcura = res;
    return limpo(res);
  }
  const limpo = (r) => { const c = Object.assign({}, r); delete c._html; delete c._somas; delete c._assets; return c; };

  /** Descarrega, confere e guarda. Não muda nada no que está a correr: isso é `aplicar`. */
  async function instalar(){
    // Procura sempre outra vez: entre o «há uma nova» e o «atualizar» pode ter saído outra
    const p = await procurar();
    if (!p || p.estado !== "disponivel") return limpo(p || {estado: "atual"});
    const p2 = ultimaProcura;
    const [html, somasTxt] = await Promise.all([obter(p2._html, false), obter(p2._somas, true)]);
    const nome = "orcamento-familiar-" + p2.versao + ".html";
    const linha = somasTxt.split(/\r?\n/).find(l => l.trim().endsWith(" " + nome) || l.trim().endsWith("*" + nome));
    const esperado = linha ? linha.trim().split(/\s+/)[0].toLowerCase() : null;
    const obtido = crypto.createHash("sha256").update(html).digest("hex");
    if (!esperado || esperado !== obtido) throw new Error("a soma SHA256 do ficheiro descarregado não confere — não se instalou nada");
    const txt = html.toString("utf8");
    if (versaoDoHtml(txt) !== p2.versao) throw new Error("o ficheiro descarregado não é da versão " + p2.versao);
    const shellMin = shellMinimaDoHtml(txt);
    if (compararVersoes(shellMin, o.app.getVersion()) > 0){
      return {estado: "reinstalar", versao: p2.versao, atual: p2.atual, shellMinima: shellMin,
        descarregar: ficheiroDoSistema(p2._assets) || p2.notas, notas: p2.notas};
    }
    const destino = path.join(pasta(), p2.versao);
    fs.mkdirSync(destino, {recursive: true});
    fs.writeFileSync(path.join(destino, "orcamento-familiar.html.parcial"), html);
    fs.renameSync(path.join(destino, "orcamento-familiar.html.parcial"), path.join(destino, "orcamento-familiar.html"));
    const e = lerEstado();
    const anterior = e.versao;
    gravarEstado({versao: p2.versao, anterior: anterior || null, instaladaEm: new Date().toISOString(), sha256: obtido, mas: e.mas || []});
    // Fica só a anterior (para voltar atrás se a nova falhar); o resto vai fora
    try {
      fs.readdirSync(pasta()).filter(n => /^\d/.test(n) && n !== p2.versao && n !== anterior)
        .forEach(n => fs.rmSync(path.join(pasta(), n), {recursive: true, force: true}));
    } catch(err){}
    return {estado: "pronta", versao: p2.versao, atual: p2.atual, notas: p2.notas};
  }

  /** Passa a usar a versão instalada: recarrega as janelas e espera que a página diga que arrancou. */
  function aplicar(){
    aVerificar = versaoAtiva();
    o.aoMudarRaiz();
    vigiar();
    return {estado: "a aplicar", versao: aVerificar};
  }
  function vigiar(){
    clearTimeout(tVerificar);
    if (raizAtiva() === o.raizEmbutida){ aVerificar = null; return; }
    aVerificar = versaoAtiva();
    tVerificar = setTimeout(() => {
      // Não disse que arrancou: esta página fica marcada como má e volta-se atrás
      const e = lerEstado();
      const mas = (e.mas || []).concat([aVerificar]);
      const anterior = e.anterior && mas.indexOf(e.anterior) < 0 && compararVersoes(e.anterior, VERSAO_EMBUTIDA) > 0 ? e.anterior : null;
      gravarEstado(Object.assign({}, e, {versao: anterior, anterior: null, mas, falhou: aVerificar}));
      aVerificar = null;
      o.aoMudarRaiz();
      if (raizAtiva() !== o.raizEmbutida) vigiar();
    }, o.prazoArranque || PRAZO_ARRANQUE);
  }
  function arrancou(versaoPagina){
    if (aVerificar && versaoPagina === aVerificar){ clearTimeout(tVerificar); aVerificar = null; }
  }
  const versoes = () => ({shell: o.app.getVersion(), embutida: VERSAO_EMBUTIDA, ativa: versaoAtiva(), falhou: lerEstado().falhou || null});

  arrumar();
  return {raizAtiva, ficheiro, procurar: async () => limpo(await procurar()), instalar, aplicar, arrancou, vigiar, versoes, _estado: lerEstado};
}

module.exports = {criarAtualizacoes, compararVersoes, versaoDoHtml, shellMinimaDoHtml};
