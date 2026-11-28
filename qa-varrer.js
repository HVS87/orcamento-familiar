/* ============================================================
   Varredura de desenho — corre numa janela já dimensionada

   Percorre todas as páginas, as três vistas dos movimentos, os menus, o
   painel lateral (ferramentas e detalhes) e os diálogos, nos dois modos,
   e procura o que os testes de unidade não veem: página a andar de lado,
   lixo no ecrã, identificadores repetidos, botões sem nome, alvos de
   toque pequenos e menus fora do ecrã. Trabalha sobre o exemplo e devolve
   os dados de quem a corre, como as outras suites.

   Uso: com a janela no tamanho a medir, injetar este ficheiro e ler
   window.__QAVARRER.
   ============================================================ */
(function(){
"use strict";
var problemas = [], medidas = 0;
var errosConsola = [];
var onerrorAntigo = window.onerror;
window.onerror = function(msg){ errosConsola.push(String(msg)); return false; };

var backup = localStorage.getItem(STORE_KEY);
var backupSessao = localStorage.getItem(SESSAO_KEY);
var temaAntes = S.tema, mesAntes = MES, vistaAntes = VIEW;
var secD = ui.secaoDespesa, secE = ui.secaoEstrategia, movVista = ui.movVista;
var ultima = JSON.parse(JSON.stringify(ui.ultimaPagina || {}));
var sincAntes = localStorage.getItem(SINC_KEY), ecra2Antes = localStorage.getItem(ECRA2_KEY);

var LIXO = /\bNaN\b|\bundefined\b|\[object Object\]|\bnull\b|Infinity/;
var raiz = document.documentElement;
var compacto = raiz.getAttribute("data-layout") === "compacto";
var tam = window.innerWidth + "×" + window.innerHeight;

function visivel(el){
  if (!el || !el.getClientRects().length) return false;
  var cs = getComputedStyle(el);
  return cs.visibility !== "hidden" && cs.display !== "none" && parseFloat(cs.opacity) > 0;
}
function nomeAcessivel(el){
  return (el.getAttribute("aria-label") || el.getAttribute("title") || el.getAttribute("aria-labelledby") ||
          el.textContent || "").trim();
}
function medir(onde){
  medidas++;
  var de = document.documentElement;
  if (de.scrollWidth > de.clientWidth + 1)
    problemas.push(tam + " " + onde + ": a página anda de lado (" + de.scrollWidth + " > " + de.clientWidth + ")");
  var zonas = ["#app", "#painelLateral", "#modalHost", "#paleta", "header", "#destinos"];
  zonas.forEach(function(z){
    var e = document.querySelector(z);
    if (e && visivel(e) && LIXO.test(e.innerText)){
      var m = e.innerText.match(new RegExp(".{0,30}(" + LIXO.source + ").{0,30}"));
      problemas.push(tam + " " + onde + ": lixo em " + z + " — «" + (m ? m[0] : "") + "»");
    }
  });
  var ids = {}, rep = [];
  Array.prototype.forEach.call(document.querySelectorAll("[id]"), function(e){
    if (ids[e.id]) rep.push(e.id); ids[e.id] = 1;
  });
  if (rep.length) problemas.push(tam + " " + onde + ": ids repetidos — " + rep.slice(0, 5).join(", "));
  Array.prototype.forEach.call(document.querySelectorAll("button, a[href], [role=button], [role=menuitem]"), function(b){
    if (!visivel(b)) return;
    if (!nomeAcessivel(b)) problemas.push(tam + " " + onde + ": botão sem nome — " + b.outerHTML.slice(0, 90));
    /* Alvo mínimo de 24 px (WCAG 2.5.8). Ligações dentro de texto corrido e
       células de calendário pequenas de propósito ficam de fora. */
    var r = b.getBoundingClientRect();
    if (r.width > 0 && (r.width < 24 || r.height < 24) && !b.closest(".note, p, .hmap:not(.grande)") &&
        !b.classList.contains("saberMais"))
      problemas.push(tam + " " + onde + ": alvo pequeno (" + Math.round(r.width) + "×" + Math.round(r.height) + ") — " +
        (b.dataset.act || b.id || b.className || b.textContent.trim().slice(0, 20)));
  });
  /* O que a aplicação escondeu tem de estar escondido: uma classe com display
     próprio sobrepunha-se ao atributo hidden e mostrava-o na mesma. */
  Array.prototype.forEach.call(document.querySelectorAll("[hidden]"), function(h){
    if (h.getClientRects().length) problemas.push(tam + " " + onde + ": escondido mas à vista — " + (h.id || h.className || h.tagName));
  });
  Array.prototype.forEach.call(document.querySelectorAll(".popover:not([hidden]), #painelLateral:not([hidden]), #modalHost .dialog"), function(p){
    if (!visivel(p)) return;
    var r = p.getBoundingClientRect();
    if (r.left < -1 || r.right > document.documentElement.clientWidth + 1 || r.top < -1)
      problemas.push(tam + " " + onde + ": " + (p.id || p.className) + " sai do ecrã (" +
        Math.round(r.left) + "," + Math.round(r.top) + "," + Math.round(r.right) + ")");
  });
}

try {
  localStorage.removeItem(SESSAO_KEY);
  S = estadoVazio(); carregarExemplo(); MES = isoMes(hoje());
  ["light", "dark"].forEach(function(modo){
    S.tema = modo; aplicarTema();
    Object.keys(PAGINAS).forEach(function(p){
      ui.lateral = null; fecharMenus();
      irPagina(p); medir(modo + " " + p);
    });
    ["calendario", "agenda", "lista"].forEach(function(v){
      ui.movVista = v; irPagina("movimentos"); medir(modo + " movimentos/" + v);
    });
    ui.personalizarPainel = true; irPagina("analises"); medir(modo + " análises a escolher cartões");
    ui.personalizarPainel = false;
    // Menus
    irPagina("painel");
    [["mesBtn","menuMes"], ["ajudaMenuBtn","menuAjuda"], ["definicoesBtn","menuDefinicoes"]].forEach(function(par){
      fecharMenus(); document.getElementById(par[0]).click(); medir(modo + " menu " + par[1]);
    });
    fecharMenus();
    irPagina("movimentos"); var mm = document.getElementById("movMaisBtn");
    if (mm){ mm.click(); medir(modo + " menu ⋮ dos movimentos"); fecharMenus(); }
    // Painel lateral
    Object.keys(LATERAIS).forEach(function(k){ abrirLateral(k); render(); medir(modo + " lateral " + k); });
    if (S.ativos[0]){ abrirLateral("ativo", {id: S.ativos[0].id}); render(); medir(modo + " detalhe de ativo"); }
    if (S.creditos[0]){ abrirLateral("credito", {id: S.creditos[0].id}); render(); medir(modo + " detalhe de crédito"); }
    fecharLateral();
    // Diálogos
    abrirDados(); medir(modo + " diálogo de cópias"); document.getElementById("modalHost").innerHTML = "";
    abrirRapido(); medir(modo + " diálogo Criar"); document.getElementById("modalHost").innerHTML = "";
    abrirPaleta(); var pi = document.getElementById("paletaIn");
    pi.value = "45,90 continente ontem"; pi.dispatchEvent(new Event("input", {bubbles:true}));
    medir(modo + " pesquisa com frase"); fecharPaleta();
    // Boas-vindas, nos três passos
    var guarda = S; S = estadoVazio(); ui.boasPasso = 1; ui.perfil = {agregado:null, habitacao:"propria", regime:"credito"};
    irPagina("painel"); medir(modo + " boas-vindas 1");
    ui.perfil.agregado = "familia"; ui.boasPasso = 2; render(); medir(modo + " boas-vindas 2");
    ui.boasPasso = 3; render(); medir(modo + " boas-vindas 3");
    S = guarda; ui.boasPasso = 1;
    // Sincronização: por ligar, à espera do outro aparelho (QR aberto) e ligada a dois
    localStorage.removeItem(SINC_KEY); irPagina("config"); medir(modo + " sincronizar por ligar");
    localStorage.setItem(SINC_KEY, JSON.stringify({codigo: "ABCDE-FGHJK-MNPQR-STVWX-YZ012", servidor: SINC_SERVIDOR,
      aparelho: {id: "qa", nome: "Computador (Windows)"}, pares: {}}));
    render(); var sv = document.getElementById("cfgSinc"); if (sv) sv.scrollIntoView();
    medir(modo + " sincronizar com o QR");
    sincGravarCfg({pares: {t1: {nome: "Telemóvel", visto: Date.now() - 90000}, t2: {nome: "Tablet da sala com um nome comprido", visto: Date.now() - 7200000}}});
    render(); medir(modo + " sincronizar ligada a dois");
    var av = document.querySelector("#cfgSinc details:not(.sincLigar)"); if (av){ av.open = true; medir(modo + " sincronizar, avançado"); }
    localStorage.removeItem(SINC_KEY); render();
    // Acessibilidade: o cartão em cada visão, e o resumo com as cores de duas delas
    var visaoAntes = S.visao, focoAntes = S.foco, ligAntes = S.ligacoes;
    ["protanopia", "deuteranopia", "tritanopia", "acromatopsia", "padrao"].forEach(function(v){
      S.visao = v; aplicarTema(); irPagina("config");
      var ca = document.getElementById("cfgAcessibilidade"); if (ca) ca.scrollIntoView();
      medir(modo + " acessibilidade " + v);
    });
    S.visao = "tritanopia"; S.foco = "forte"; S.ligacoes = "sublinhadas"; aplicarTema(); irPagina("analises"); medir(modo + " análises em tritanopia, foco reforçado");
    S.visao = "acromatopsia"; aplicarTema(); irPagina("painel"); medir(modo + " resumo sem cores");
    S.visao = visaoAntes; S.foco = focoAntes; S.ligacoes = ligAntes; aplicarTema();
    // Atualizações: cada estado da secção
    var atualAntes = localStorage.getItem(ATUAL_KEY);
    [{estado: "disponivel", versao: "9.9.9", em: Date.now()}, {estado: "reinstalar", versao: "9.9.9", descarregar: "https://github.com/HVS87/orcamento-familiar/releases", em: Date.now()},
     {estado: "erro", erro: "o servidor não respondeu a tempo", em: Date.now()}, {estado: "ma", versao: "9.9.9", em: Date.now()}].forEach(function(st){
      localStorage.setItem(ATUAL_KEY, JSON.stringify(st)); irPagina("config");
      var ca = document.getElementById("cfgAtualizacoes"); if (ca) ca.scrollIntoView();
      medir(modo + " atualizações: " + st.estado);
    });
    if (atualAntes) localStorage.setItem(ATUAL_KEY, atualAntes); else localStorage.removeItem(ATUAL_KEY);
    // Emparelhar no Safari do iPhone: o aviso de que a app guarda à parte, com o código
    var uaD = Object.getOwnPropertyDescriptor(navigator, "userAgent");
    Object.defineProperty(navigator, "userAgent", {value: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1", configurable: true});
    try {
      history.replaceState(null, "", location.pathname + location.search + "#ligar=0123456789ABCDEFGHJKMNPQR");
      sincLerLigacao(); medir(modo + " emparelhar no iPhone");
    } finally {
      document.getElementById("modalHost").innerHTML = "";
      if (uaD) Object.defineProperty(navigator, "userAgent", uaD); else delete navigator.userAgent;
    }
    // Dois ecrãs: o cartão com a companheira aberta, e a própria companheira
    _painelVivo = Date.now(); irPagina("config"); medir(modo + " dois ecrãs com a companheira aberta"); _painelVivo = 0;
    raiz.classList.add("janelaPainel"); pintarBarraPainel(); irPagina("limites"); medir(modo + " companheira (limites)");
    ecra2Gravar({modo: "fixo", pagina: "objetivos"}); pintarBarraPainel(); medir(modo + " companheira, página fixa");
    raiz.classList.add("apresentacao"); irPagina("painel"); medir(modo + " companheira em apresentação");
    raiz.classList.remove("apresentacao", "janelaPainel");
    var bp = document.getElementById("barraPainel"); if (bp) bp.remove();
    localStorage.removeItem(ECRA2_KEY);
  });
} catch (e) {
  problemas.push(tam + ": a varredura parou — " + ((e && e.stack) || e));
}

// Repor
if (backup) localStorage.setItem(STORE_KEY, backup); else localStorage.removeItem(STORE_KEY);
if (backupSessao) localStorage.setItem(SESSAO_KEY, backupSessao); else localStorage.removeItem(SESSAO_KEY);
if (sincAntes) localStorage.setItem(SINC_KEY, sincAntes); else localStorage.removeItem(SINC_KEY);
if (ecra2Antes) localStorage.setItem(ECRA2_KEY, ecra2Antes); else localStorage.removeItem(ECRA2_KEY);
raiz.classList.remove("apresentacao", "janelaPainel"); _painelVivo = 0;
var bpx = document.getElementById("barraPainel"); if (bpx) bpx.remove();
S = backup ? normalizar(JSON.parse(backup)) : estadoVazio();
limparCacheCredito();
S.tema = temaAntes; aplicarTema();
MES = mesAntes; ui.secaoDespesa = secD; ui.secaoEstrategia = secE; ui.movVista = movVista;
ui.ultimaPagina = ultima; ui.lateral = null; ui.perfil = null;
fecharMenus(); fecharPaleta(); document.getElementById("modalHost").innerHTML = "";
irPara(vistaAntes);
if (typeof guardarT !== "undefined") clearTimeout(guardarT);
if (typeof _sessaoT !== "undefined") clearTimeout(_sessaoT);
window.onerror = onerrorAntigo;

window.__QAVARRER = {tamanho: tam, compacto: compacto, medidas: medidas, problemas: problemas, errosConsola: errosConsola};
console.log("Varredura " + tam + ": " + medidas + " estados, " + problemas.length + " problemas");
})();
