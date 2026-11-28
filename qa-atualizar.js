/* ============================================================
   Suite de QA — atualizações (2.3)

   Carregue-a na aplicação como as outras e espere por window.__QAATUAL.
   Prova que:
   - as versões se comparam bem (2.10 depois de 2.9);
   - «Procurar sempre atualizações ao iniciar» vem ligada, fica no aparelho
     e não viaja com a sincronização;
   - a secção das Definições tem o botão e a definição, e mostra cada estado;
   - na web, procurar lê a versão do servidor sem passar pela cache, e diz
     se há versão nova, se já está em dia, ou porque falhou;
   - atualizar envia primeiro o que a sincronização tiver por enviar;
   - as mensagens da sincronização levam o formato e a versão, e um formato
     mais novo é posto de lado em vez de ser juntado.
   O lado da aplicação de secretária (descarregar, conferir, voltar atrás)
   prova-se em desktop/testes/e2e.js e desktop/testes/atualizacoes.js.
   Devolve o armazenamento como o encontrou, ao byte.
   ============================================================ */
(function(){
"use strict";
var falhas = [], passes = 0, grupo = "";
function G(n){ grupo = n; }
function ok(c, nome, det){ if (c){ passes++; return true; } falhas.push({grupo: grupo, teste: nome, detalhe: det == null ? "" : String(det)}); return false; }
function eq(a, b, nome){ return ok(a === b, nome, "obtido " + JSON.stringify(a) + ", esperado " + JSON.stringify(b)); }
var dormir = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
var q = function(s){ return document.querySelector(s); };

var disco = {};
for (var i = 0; i < localStorage.length; i++){ var k = localStorage.key(i); disco[k] = localStorage.getItem(k); }
var S0 = JSON.stringify(S), VIEW0 = VIEW, MES0 = MES;
var fetchOrig = window.fetch;
var aplicarWebOrig = aplicarWeb, procurarOrig = procurarAtualizacoes, SINC0 = SINC;
var toastOrig = toast, toastBotaoOrig = toastComBotao;

async function correr(){
G("comparar versões");
eq(compararVersoes("2.10.0", "2.9.9"), 1, "2.10 vem depois de 2.9 (não é ordem de texto)");
eq(compararVersoes("2.3.0", "2.3"), 0, "partes que faltam contam como zero");
eq(compararVersoes("2.2.1", "2.3.0"), -1, "2.2.1 vem antes de 2.3.0");
eq(compararVersoes("3.0.0", "2.99.99"), 1, "a versão maior manda");
eq(compararVersoes("", "0.0.1"), -1, "nada é a mais antiga de todas");
ok(/^\d+\.\d+\.\d+$/.test(VERSAO_APP) && /^\d+\.\d+\.\d+$/.test(VERSAO_SHELL_MINIMA), "versão da página e da aplicação mínima bem escritas");
ok(compararVersoes(VERSAO_SHELL_MINIMA, VERSAO_APP) <= 0, "a página nunca pede uma aplicação de secretária mais nova do que ela própria");

G("a definição «Procurar sempre atualizações ao iniciar»");
eq(estadoVazio().procurarAtualizacoes, true, "vem ligada por omissão");
eq(normalizar({}).procurarAtualizacoes, true, "uma cópia antiga, sem a definição, fica ligada");
eq(normalizar(Object.assign(estadoVazio(), {procurarAtualizacoes: false})).procurarAtualizacoes, false, "desligada fica desligada");
ok(CHAVES_DO_APARELHO.indexOf("procurarAtualizacoes") >= 0, "fica em cada aparelho");
ok(!("procurarAtualizacoes" in estadoParaSinc(S)), "e não viaja com a sincronização");
ok(CHAVES_INTERFACE.indexOf("procurarAtualizacoes") >= 0, "e mudá-la não faz da família de exemplo um orçamento de alguém");

G("ao arrancar");
var agendou = 0;
procurarAtualizacoes = function(){ agendou++; return Promise.resolve(null); };
var timeoutOrig = window.setTimeout;
var agendados = [];
window.setTimeout = function(fn, ms){ if (ms === 4000){ agendados.push(fn); return 0; } return timeoutOrig.apply(window, arguments); };
try {
  S.procurarAtualizacoes = true;
  eq(verificarAoArrancar(), !EH_PAINEL, "ligada: agenda uma procura");
  agendados.forEach(function(f){ f(); });
  eq(agendou, EH_PAINEL ? 0 : 1, "que corre em silêncio, uns segundos depois de arrancar");
  agendou = 0; agendados = [];
  S.procurarAtualizacoes = false;
  eq(verificarAoArrancar(), false, "desligada: não procura");
  eq(agendados.length, 0, "nem agenda nada");
} finally { window.setTimeout = timeoutOrig; procurarAtualizacoes = procurarOrig; S.procurarAtualizacoes = true; }

G("a secção nas Definições");
localStorage.removeItem(ATUAL_KEY);
irPagina("config");
ok(q("#cfgAtualizacoes") != null, "há secção «Atualizações»");
ok(Array.prototype.some.call(document.querySelectorAll(".indiceCfg .ficha"), function(b){ return b.textContent === "Atualizações"; }), "com entrada no índice");
var btn = q('#cfgAtualizacoes [data-act="atualProcurar"]');
ok(btn && /Procurar atualizações/.test(btn.textContent), "com o botão «Procurar atualizações»");
ok(/Procurar sempre atualizações ao iniciar/.test(q("#cfgAtualizacoes").textContent), "e a definição de procurar ao iniciar");
eq((q('#cfgAtualizacoes [data-act="atualAuto"][data-v="sim"]') || {}).getAttribute && q('#cfgAtualizacoes [data-act="atualAuto"][data-v="sim"]').getAttribute("aria-pressed"), "true", "ligada à partida");
ok(q("#cfgAtualizacoes").textContent.indexOf(VERSAO_APP) >= 0, "mostra a versão em uso");
ok(/não envia dados seus/.test(q("#cfgAtualizacoes").textContent), "e diz que procurar não envia dados");
ACOES.atualAuto({dataset: {v: "nao"}});
eq(S.procurarAtualizacoes, false, "«Desligado» desliga");
eq(JSON.parse(localStorage.getItem(STORE_KEY)).procurarAtualizacoes, false, "e fica gravado");
eq(q('#cfgAtualizacoes [data-act="atualAuto"][data-v="nao"]').getAttribute("aria-pressed"), "true", "e a escolha vê-se");
ACOES.atualAuto({dataset: {v: "sim"}});
eq(S.procurarAtualizacoes, true, "«Ligado» volta a ligar");
var estados = [
  [{estado: "atual", versao: VERSAO_APP, em: Date.now()}, /versão mais recente/],
  [{estado: "disponivel", versao: "9.9.9", em: Date.now()}, /Há uma versão nova: 9\.9\.9/],
  [{estado: "reinstalar", versao: "9.9.9", descarregar: "https://github.com/HVS87/orcamento-familiar/releases/tag/v9.9.9", em: Date.now()}, /precisa de uma aplicação de secretária mais recente/],
  [{estado: "erro", erro: "sem rede", em: Date.now()}, /Não foi possível procurar: sem rede/],
  [{estado: "ma", versao: "9.9.9", em: Date.now()}, /não arrancou bem/],
];
estados.forEach(function(p){
  localStorage.setItem(ATUAL_KEY, JSON.stringify(p[0]));
  pintarAtualizacoes();
  ok(p[1].test(q("#cfgAtualizacoes").textContent), "o estado «" + p[0].estado + "» diz-se por palavras", q("#cfgAtualizacoes").textContent.slice(0, 160));
});
localStorage.setItem(ATUAL_KEY, JSON.stringify({estado: "disponivel", versao: "9.9.9"}));
pintarAtualizacoes();
ok(q('#cfgAtualizacoes [data-act="atualInstalar"]') != null, "com versão nova, há «Atualizar agora»");
localStorage.setItem(ATUAL_KEY, JSON.stringify({estado: "disponivel", versao: "0.0.1"}));
pintarAtualizacoes();
ok(!q('#cfgAtualizacoes [data-act="atualInstalar"]'), "uma «versão nova» mais velha do que esta (de antes de atualizar) não oferece nada");
localStorage.removeItem(ATUAL_KEY);

G("procurar, na web");
if (DESKTOP){ ok(true, "na aplicação de secretária quem procura é o processo principal — ver a e2e"); }
else if (location.protocol.indexOf("http") !== 0){
  var r0 = await procurarWeb();
  eq(r0.estado, "indisponivel", "aberta do disco, diz que não dá para procurar aqui");
} else {
  var pedidos = [];
  var resposta = function(versao){ return '<script>const VERSAO_APP = "' + versao + '";</script>'; };
  var modo = "nova";
  window.fetch = function(url, opts){
    pedidos.push({url: String(url), opts: opts || {}});
    if (String(url).indexOf("sem-cache=") < 0) return fetchOrig.apply(window, arguments);
    if (modo === "nova") return Promise.resolve(new Response(resposta("9.9.9")));
    if (modo === "igual") return Promise.resolve(new Response(resposta(VERSAO_APP)));
    if (modo === "404") return Promise.resolve(new Response("não há", {status: 404}));
    if (modo === "lixo") return Promise.resolve(new Response("<html>sem versão</html>"));
    return Promise.reject(new TypeError("Failed to fetch"));
  };
  var toasts = [], botoes = [];
  toast = function(m){ toasts.push(m); };
  toastComBotao = function(m, b){ toasts.push(m); botoes.push(b); };
  try {
    var r = await procurarAtualizacoes(false);
    eq(r.estado, "disponivel", "com uma versão maior no servidor, há atualização");
    eq(r.versao, "9.9.9", "e diz qual");
    var p = pedidos.filter(function(x){ return x.url.indexOf("sem-cache=") >= 0; })[0];
    ok(p && p.opts.cache === "no-store", "o pedido passa ao lado da cache do navegador");
    ok(p && p.url.indexOf(location.pathname) === 0, "e vai à própria página, no mesmo servidor");
    eq(atualCfg().estado, "disponivel", "o estado fica guardado para a secção");
    ok(atualCfg().em > Date.now() - 5000, "com a hora da procura");
    ok(/9\.9\.9/.test(toasts.pop()), "e avisa");
    modo = "igual";
    r = await procurarAtualizacoes(false);
    eq(r.estado, "atual", "com a mesma versão, está em dia");
    ok(/versão mais recente/.test(toasts.pop()), "e diz que está na mais recente");
    modo = "404";
    r = await procurarAtualizacoes(false);
    ok(r.estado === "erro" && /404/.test(r.erro), "um erro do servidor diz-se", r.erro);
    modo = "lixo";
    r = await procurarAtualizacoes(false);
    ok(r.estado === "erro" && /versão/.test(r.erro), "uma página sem versão também", r.erro);
    modo = "rede";
    r = await procurarAtualizacoes(false);
    ok(r.estado === "erro", "sem rede, falha sem rebentar", r.erro);
    toasts = []; botoes = [];
    modo = "igual";
    await procurarAtualizacoes(true);
    eq(toasts.length, 0, "em silêncio (ao arrancar) e sem novidade, não diz nada");
    modo = "nova";
    await procurarAtualizacoes(true);
    ok(botoes.length === 1 && /Atualizar/.test(botoes[0].textContent), "em silêncio e com novidade, avisa com o botão «Atualizar»");
    var duas = [procurarAtualizacoes(false), procurarAtualizacoes(false)];
    var rs = await Promise.all(duas);
    ok(rs[1] === null, "duas procuras ao mesmo tempo: a segunda não se mete");
  } finally { window.fetch = fetchOrig; toast = toastOrig; toastComBotao = toastBotaoOrig; }
  // Não fica nenhuma cópia «sem-cache» guardada pelo service worker
  if (window.caches){
    var ks = await caches.keys(), poluida = false;
    for (var c of ks){ var reqs = await (await caches.open(c)).keys(); if (reqs.some(function(r){ return r.url.indexOf("sem-cache") >= 0; })) poluida = true; }
    ok(!poluida, "o service worker não guarda as leituras de versão");
  }
}

G("atualizar: primeiro a sincronização, depois a página");
var ordem = [];
var falsoSinc = {
  _registar: function(){ ordem.push("registar"); },
  agora: function(){ ordem.push("enviar"); return new Promise(function(r){ setTimeout(function(){ ordem.push("enviado"); r(); }, 50); }); },
  desligar: function(){}, estado: {}, mudou: function(){},
};
SINC = falsoSinc;
aplicarWeb = async function(){ ordem.push("aplicar"); await sincAntesDeSair(); ordem.push("recarregar"); };
try {
  if (!DESKTOP){
    await atualizarAgora();
    ok(ordem.indexOf("registar") >= 0 && ordem.indexOf("enviado") >= 0, "a sincronização regista e envia o que tem", ordem.join(","));
    ok(ordem.indexOf("enviado") < ordem.indexOf("recarregar"), "e só depois a página recarrega", ordem.join(","));
  } else ok(true, "na aplicação de secretária: ver a e2e");
  ordem = [];
  falsoSinc.agora = function(){ ordem.push("enviar"); return new Promise(function(){}); };   // a rede encravou
  var t0 = Date.now();
  await sincAntesDeSair();
  ok(Date.now() - t0 < 9500 && Date.now() - t0 >= 7500, "se a rede encravar, espera no máximo 8 s e segue", (Date.now() - t0) + " ms");
} finally { SINC = SINC0; aplicarWeb = aplicarWebOrig; }

G("sincronização entre versões diferentes");
var chave = (await sincChaves("ABCDE-FGHJK-MNPQR-STVWX-YZ012")).chave;
var caixa = {msgs: [], anexos: {}};
var transp = {
  publicarEstado: function(b, m){ var id = "a" + caixa.msgs.length; caixa.anexos[id] = b; var x = {id: id, event: "message", message: m, attachment: {url: "falso://" + id}}; caixa.msgs.push(x); return Promise.resolve(x); },
  publicarTexto: function(m){ caixa.msgs.push({id: "t" + caixa.msgs.length, event: "message", message: m}); return Promise.resolve(); },
  desde: function(){ return Promise.resolve([]); },
  baixar: function(u){ return Promise.resolve(caixa.anexos[String(u).replace("falso://", "")]); },
  escutar: function(){ return function(){}; },
};
var dev = function(nome, versao){
  var d = {S: normalizar(estadoVazio()), versoes: {}, meta: {}};
  d.motor = criarSinc({chave: chave, eu: {id: nome, nome: nome}, versao: versao, transporte: transp, atraso: 1, intervaloPedidos: 0,
    ler: function(){ return estadoParaSinc(d.S); }, aplicar: function(M, info){ d.S = normalizar(JSON.parse(JSON.stringify(M))); if (info.concluir) info.concluir(); },
    vazio: function(x){ return semDadosProprios(x, false); }, normalizar: function(M){ return estadoParaSinc(normalizar(JSON.parse(JSON.stringify(M)))); },
    meta: {ler: function(){ return d.meta; }, gravar: function(p){ Object.assign(d.meta, p); }},
    versoes: {ler: function(){ return d.versoes; }, gravar: function(v){ d.versoes = v; }}});
  return d;
};
var pc = dev("pc", "2.3.0"), tm = dev("telemovel", "2.2.0");
await pc.motor.ligar();
pc.S.movimentos.push({id: "v1", tipo: "despesa", data: "2026-11-01", descricao: "x", valor: 1, categoriaId: "", membroId: ""});
pc.motor.mudou();
await dormir(400); await pc.motor._fila();
var envio = caixa.msgs.filter(function(m){ return m.attachment; }).pop();
ok(!!envio, "o computador envia");
var metaLida = JSON.parse(new TextDecoder().decode(await decifrar(chave, b64u.para(envio.message))));
eq(metaLida.fmt, FORMATO_SINC, "a mensagem diz o formato");
eq(metaLida.va, "2.3.0", "e a versão de quem a enviou");
await tm.motor.ligar();
await tm.motor._processar(envio); await tm.motor._fila();
ok(tm.S.movimentos.some(function(m){ return m.id === "v1"; }), "um aparelho com versão mais antiga, mas o mesmo formato, junta na mesma");
eq(tm.meta.pares.pc.va, "2.3.0", "e fica a saber a versão do outro");
var futuro = {t: "estado", de: "futuro", nome: "Tablet do futuro", em: Date.now(), h: "x", fmt: FORMATO_SINC + 1, va: "9.0.0"};
var msgFuturo = {id: "f1", event: "message", message: b64u.de(await cifrar(chave, new TextEncoder().encode(JSON.stringify(futuro)))), attachment: {url: "falso://nada"}};
var antesFuturo = jsonEstavel(estadoParaSinc(tm.S));
await tm.motor._processar(msgFuturo); await tm.motor._fila();
eq(jsonEstavel(estadoParaSinc(tm.S)), antesFuturo, "um formato mais novo do que o deste aparelho não se junta");
eq(tm.motor.estado.formatoNovo, "9.0.0", "e fica registado, para pedir que se atualize");
pc.motor.desligar(); tm.motor.desligar();
var cfgSincAntes = localStorage.getItem(SINC_KEY);
localStorage.setItem(SINC_KEY, JSON.stringify({codigo: "ABCDE-FGHJK-MNPQR-STVWX-YZ012", aparelho: {id: "qa", nome: "Este"},
  pares: {t: {nome: "Telemóvel", visto: Date.now(), va: "9.9.9"}}}));
irPagina("config");
ok(/Telemóvel tem a versão 9\.9\.9/.test(q("#cfgSinc").textContent), "o cartão da sincronização diz quando outro aparelho tem versão mais recente");
ok(q('#cfgSinc [data-act="atualProcurar"]') != null, "e oferece procurar atualizações ali mesmo");
if (cfgSincAntes) localStorage.setItem(SINC_KEY, cfgSincAntes); else localStorage.removeItem(SINC_KEY);
}

function arrumar(){
  window.fetch = fetchOrig; aplicarWeb = aplicarWebOrig; procurarAtualizacoes = procurarOrig; SINC = SINC0;
  toast = toastOrig; toastComBotao = toastBotaoOrig;
  var ks = []; for (var i = 0; i < localStorage.length; i++) ks.push(localStorage.key(i));
  ks.forEach(function(k){ if (!(k in disco)) localStorage.removeItem(k); });
  Object.keys(disco).forEach(function(k){ localStorage.setItem(k, disco[k]); });
  try { S = normalizar(JSON.parse(S0)); } catch(e){}
  MES = MES0;
  try { irPara(VIEW0); } catch(e){}
  if (typeof _sessaoT !== "undefined") clearTimeout(_sessaoT);
  Object.keys(disco).forEach(function(k){ localStorage.setItem(k, disco[k]); });
}
window.__QAATUAL = null;
correr().catch(function(e){ falhas.push({grupo: grupo, teste: "a suite correu até ao fim", detalhe: e && (e.stack || e.message)}); })
  .then(function(){
    arrumar();
    window.__QAATUAL = {total: passes + falhas.length, passes: passes, falhas: falhas.length, detalhe: falhas};
    console.log("QA atualizações:", passes + "/" + (passes + falhas.length));
  });
})();
