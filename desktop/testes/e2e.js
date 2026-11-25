/* ============================================================
   Testes de ponta a ponta da aplicação de secretária

   Arranca a aplicação (em desenvolvimento, ou um executável dado em
   ORCAMENTO_EXE), finge dois ecrãs, e conduz as janelas pelo protocolo
   de depuração do Chromium: corre as seis suites dentro da janela
   principal, e prova o que só existe aqui — a janela companheira no
   segundo ecrã, a troca de ecrãs, um ecrã a desligar-se e a ligar-se,
   a abertura sozinha, a cópia diária, os dados que ficam entre
   arranques, a janela que se lembra de onde estava e a instância única.

   Uso:  node testes/e2e.js            (desenvolvimento)
         ORCAMENTO_EXE=caminho node testes/e2e.js   (executável)
         ORCAMENTO_RAPIDO=1 …           (só as suites curtas)
   ============================================================ */
"use strict";
const {spawn} = require("child_process");
const fs = require("fs"), path = require("path"), os = require("os");

const RAIZ = path.join(__dirname, "..", "..");
const PORTA = 9339 + Math.floor(Math.random() * 400);
const DADOS = fs.mkdtempSync(path.join(os.tmpdir(), "orcamento-e2e-"));
const ECRA1 = {x: 0, y: 0, width: 1536, height: 864};
const ECRA2 = {x: 1536, y: 0, width: 1280, height: 1024};
const dormir = (ms) => new Promise(r => setTimeout(r, ms));

let passes = 0;
const falhas = [];
let grupo = "";
const G = (g) => { grupo = g; console.log("\n— " + g); };
function ok(c, nome, det){
  if (c){ passes++; return true; }
  falhas.push(grupo + " | " + nome + (det != null ? " | " + String(det).slice(0, 300) : ""));
  console.log("   FALHOU: " + nome + (det != null ? " — " + String(det).slice(0, 200) : ""));
  return false;
}

/* ---------- arrancar e ligar ---------- */
function arrancar(extraEnv, args){
  const env = Object.assign({}, process.env, {
    ORCAMENTO_ECRAS_TESTE: JSON.stringify([ECRA1, ECRA2]),
    ORCAMENTO_DADOS: DADOS,
  }, extraEnv || {});
  delete env.ELECTRON_RUN_AS_NODE;
  const exe = process.env.ORCAMENTO_EXE;
  const bin = exe || require("electron");
  const argv = (exe ? [] : [path.join(__dirname, "..")]).concat(["--remote-debugging-port=" + PORTA], args || []);
  const p = spawn(bin, argv, {env, stdio: ["ignore", "pipe", "pipe"]});
  p.stderr.on("data", (d) => { const t = String(d); if (/error/i.test(t) && !/DevTools|GPU|gpu_|Autofill/i.test(t)) process.stderr.write("   [app] " + t); });
  return p;
}
async function alvos(){
  try { return await (await fetch("http://127.0.0.1:" + PORTA + "/json/list")).json(); }
  catch(e){ return []; }
}
async function janela(filtro, ms){
  const fim = Date.now() + (ms || 20000);
  while (Date.now() < fim){
    const t = (await alvos()).find(x => x.type === "page" && filtro(x.url));
    if (t) return ligarWS(t.webSocketDebuggerUrl);
    await dormir(200);
  }
  throw new Error("janela não apareceu");
}
function ligarWS(url){
  const ws = new WebSocket(url);
  let id = 0;
  const pend = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)){ pend.get(m.id)(m); pend.delete(m.id); }
  };
  return new Promise((res, rej) => {
    ws.onerror = () => rej(new Error("ligação CDP falhou"));
    ws.onopen = () => res({
      enviar(method, params){
        return new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({id: i, method, params})); });
      },
      async v(expr){
        const r = await this.enviar("Runtime.evaluate", {expression: expr, awaitPromise: true, returnByValue: true});
        if (r.error) throw new Error(r.error.message);
        if (r.result.exceptionDetails) throw new Error((r.result.exceptionDetails.exception || {}).description || JSON.stringify(r.result.exceptionDetails).slice(0, 400));
        return r.result.result.value;
      },
      fechar(){ try { ws.close(); } catch(e){} },
    });
  });
}
/* Pronta quando a página acabou de carregar; se ainda estiver a nascer (o
   contexto troca a meio), tenta-se outra vez. */
async function pronta(w){
  for (let i = 0; i < 80; i++){
    try { if (await w.v("typeof render === \"function\" && document.readyState === \"complete\"")){ await dormir(300); return true; } }
    catch(e){}
    await dormir(250);
  }
  throw new Error("a página não ficou pronta");
}
async function esperar(w, expr, ms){
  const fim = Date.now() + (ms || 8000);
  while (Date.now() < fim){
    try { if (await w.v(expr)) return true; } catch(e){}
    await dormir(150);
  }
  return false;
}
async function suite(w, ficheiro, global, ms){
  const texto = fs.readFileSync(path.join(RAIZ, ficheiro), "utf8");
  await w.v("window." + global + " = undefined; 0");
  await w.v(texto + "\n;0");
  const fim = Date.now() + (ms || 600000);
  while (Date.now() < fim){
    const r = await w.v("window." + global + " ? JSON.stringify({p: window." + global + ".passes, t: window." + global + ".total, d: (window." + global + ".detalhe || []).slice(0, 6)}) : null");
    if (r) return JSON.parse(r);
    await dormir(500);
  }
  return null;
}
const memoria = (w) => w.v(`JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)]))`);

(async () => {
  const t0 = Date.now();
  console.log("Dados de teste em " + DADOS + (process.env.ORCAMENTO_EXE ? "\nExecutável: " + process.env.ORCAMENTO_EXE : ""));
  let app = arrancar();
  try {
    const P = await janela(u => u.startsWith("app://orcamento/") && u.indexOf("janela=painel") < 0);
    await pronta(P);

    G("arranque");
    const info = JSON.parse(await P.v(`(async () => JSON.stringify({origem: location.origin, segura: isSecureContext, cifra: !!(crypto && crypto.subtle),
      versao: VERSAO_APP, desktop: !!window.orcamentoDesktop, vDesktop: window.orcamentoDesktop && window.orcamentoDesktop.versao,
      plataforma: window.orcamentoDesktop && window.orcamentoDesktop.plataforma, ecras: (window.orcamentoDesktop.ecras() || []).length,
      node: typeof require, ua: navigator.userAgent, manifesto: await fetch("./manifest.json").then(r => r.ok, () => false), sw: !!navigator.serviceWorker && !!navigator.serviceWorker.controller, titulo: document.title,
      bc: typeof BroadcastChannel, locks: !!(navigator.locks && navigator.locks.request)}))()`));
    ok(info.origem === "app://orcamento", "a página vem do protocolo próprio, com origem verdadeira", info.origem);
    ok(info.segura && info.cifra, "contexto seguro, com a cifra disponível (precisa-a a sincronização)");
    ok(info.versao === require("../package.json").version && info.vDesktop === info.versao, "versão da página = versão da aplicação", info.versao + " / " + info.vDesktop);
    ok(info.desktop && info.plataforma === process.platform, "a ponte com o processo principal está lá");
    ok(info.node === "undefined", "a página não vê o Node (isolamento ligado)");
    ok(/^[ -~]+$/.test(info.ua), "o identificador do navegador só tem ASCII (cabe num cabeçalho)", info.ua);
    ok(info.manifesto, "os ficheiros da aplicação leem-se com fetch pelo protocolo próprio");
    eq2(info.ecras, 2, "vê os dois ecrãs (simulados)");
    ok(!info.sw, "sem service worker: não faz falta fora do navegador");
    ok(info.bc === "function" && info.locks, "BroadcastChannel e Web Locks disponíveis (duas janelas, um só a sincronizar)");
    const doDesktop = JSON.parse(await P.v(`JSON.stringify({instalar: podeInstalar(), titulo: (irPagina("config"), (document.querySelector("#cfgAplicacao h2") || {}).textContent),
      ecras: !!document.querySelector("#cfgEcras"), pasta: !!document.querySelector('#cfgAplicacao [data-act="appPastaCopias"]')})`));
    ok(!doDesktop.instalar && doDesktop.titulo === "Aplicação de secretária", "não oferece «instalar»: já é a aplicação", JSON.stringify(doDesktop));
    ok(doDesktop.ecras && doDesktop.pasta, "tem o cartão dos dois ecrãs e o da pasta das cópias");

    G("as suites dentro da aplicação");
    const lista = process.env.ORCAMENTO_RAPIDO
      ? [["qa.js", "__QA"], ["qa-sinc.js", "__QASINC"]]
      : [["qa.js", "__QA"], ["qa-ui.js", "__QAUI"], ["qa-limites.js", "__QALIM"], ["qa-fuzz.js", "__QAFUZZ"], ["qa-sinc.js", "__QASINC"], ["qa-varrer.js", "__QAVARRER"]];
    await P.v(`(carregarExemplo(), document.querySelector('#modalHost [data-dlg="yes"]') && document.querySelector('#modalHost [data-dlg="yes"]').click(), 0)`);
    const antes = await memoria(P);
    for (const [f, g] of lista){
      const r = await suite(P, f, g);
      if (g === "__QAVARRER"){
        const v = JSON.parse(await P.v("JSON.stringify(window.__QAVARRER)"));
        ok(v && v.problemas.length === 0, f + ": " + (v ? v.medidas + " estados a " + v.tamanho + ", " + v.problemas.length + " problemas" : "sem resultado"), v && v.problemas.slice(0, 4).join(" ; "));
        console.log("   " + f + ": " + (v ? v.medidas + " estados, " + v.problemas.length + " problemas" : "?"));
        continue;
      }
      ok(r && r.p === r.t, f + ": " + (r ? r.p + "/" + r.t : "sem resultado"), r && JSON.stringify(r.d));
      console.log("   " + f + ": " + (r ? r.p + "/" + r.t : "sem resultado"));
    }
    const depois = await memoria(P);
    const dif = (() => {
      const A = Object.fromEntries(JSON.parse(antes)), D = Object.fromEntries(JSON.parse(depois));
      return Object.keys(Object.assign({}, A, D)).filter(k => A[k] !== D[k]).map(k => k + (k in A ? "" : " (nova)") + (k in D ? "" : " (apagada)") +
        (k in A && k in D ? " [" + String(A[k]).length + "→" + String(D[k]).length + " car.; 1.ª diferença em " + [...String(A[k])].findIndex((c, i) => c !== String(D[k])[i]) + ": …" + String(D[k]).slice(Math.max(0, [...String(A[k])].findIndex((c, i) => c !== String(D[k])[i]) - 40), [...String(A[k])].findIndex((c, i) => c !== String(D[k])[i]) + 60) + "…]" : ""));
    })();
    ok(depois === antes, "o armazenamento fica igual ao byte depois de todas as suites", dif.join(" ; "));

    G("janela companheira no segundo ecrã");
    await P.v(`localStorage.removeItem(ECRA2_KEY); irPagina("painel"); 0`);
    await P.v(`abrirSegundoEcra().then(() => 1)`);
    const C = await janela(u => u.indexOf("janela=painel") >= 0);
    await pronta(C);
    ok(await C.v("EH_PAINEL === true && document.documentElement.classList.contains('janelaPainel') && !!document.getElementById('barraPainel')"), "abre a companheira, que sabe que o é");
    let jan = await P.v("window.orcamentoDesktop._testeJanelas()");
    ok(jan.companheira && jan.companheira.ecra === 2, "e põe-na no segundo ecrã", JSON.stringify(jan.companheira));
    ok(jan.principal && jan.principal.ecra === 1, "com a principal no primeiro", JSON.stringify(jan.principal));
    ok(await esperar(P, "painelAberto()"), "a principal dá pela companheira");
    await P.v(`irPagina("movimentos"); 0`);
    ok(await esperar(C, `paginaAtual() === "limites"`), "a principal vai aos movimentos; a companheira mostra os limites");
    await P.v(`irPagina("ativos"); 0`);
    ok(await esperar(C, `paginaAtual() === "creditos"`), "ativos aqui, créditos lá");
    await P.v(`MES = mesShift(MES, -2); render(); 0`);
    ok(await esperar(C, `MES === ${JSON.stringify(await P.v("MES"))}`), "e segue o mês");
    await P.v(`MES = isoMes(hoje()); render(); 0`);
    await P.v(`abrirLateral("nota"); 0`);
    ok(await esperar(C, `ui.lateral && ui.lateral.tipo === "nota"`), "a nota do mês abre na companheira");
    ok(!(await P.v("!!ui.lateral")), "e a principal fica com a página inteira");
    const nAntes = await P.v("S.movimentos.length");
    await C.v(`alterar(() => { S.movimentos.push({id: "e2e1", tipo: "despesa", data: isoDia(hoje()), descricao: "Na companheira", valor: 12, categoriaId: S.categorias[0].id, membroId: ""}); }, "teste"); 0`);
    ok(await esperar(P, `S.movimentos.length === ${nAntes + 1} && S.movimentos.some(m => m.id === "e2e1")`), "o que se grava na companheira aparece na principal");
    await P.v(`alterar(() => { S.movimentos = S.movimentos.filter(m => m.id !== "e2e1"); }, "teste"); 0`);
    ok(await esperar(C, `!S.movimentos.some(m => m.id === "e2e1")`), "e o que se apaga na principal some da companheira");
    ok(await C.v("SINC === null"), "a companheira não abre a sincronização (só a principal fala com a rede)");
    await C.v(`document.getElementById("ecra2Modo").value = "fixo"; document.getElementById("ecra2Modo").dispatchEvent(new Event("change", {bubbles: true})); 0`);
    ok(await esperar(C, `!!document.getElementById("ecra2Pagina")`), "em página fixa, escolhe-se a página");
    await C.v(`document.getElementById("ecra2Pagina").value = "objetivos"; document.getElementById("ecra2Pagina").dispatchEvent(new Event("change", {bubbles: true})); 0`);
    ok(await esperar(C, `paginaAtual() === "objetivos"`), "e fica nela");
    await C.v(`ecra2Gravar({modo: "contexto"}); 0`);

    G("apresentação e troca de ecrãs");
    await C.v(`ACOES.ecra2Apresentacao(); 0`);
    ok(await esperar(C, `document.documentElement.classList.contains("apresentacao")`), "o modo apresentação liga");
    await dormir(700);
    jan = await P.v("window.orcamentoDesktop._testeJanelas()");
    ok(jan.companheira.full, "e põe a companheira em ecrã inteiro", JSON.stringify(jan.companheira));
    await C.v(`ACOES.ecra2Apresentacao(); 0`);
    await dormir(700);
    jan = await P.v("window.orcamentoDesktop._testeJanelas()");
    ok(!jan.companheira.full && !(await C.v(`document.documentElement.classList.contains("apresentacao")`)), "e desliga, saindo do ecrã inteiro");
    const antesTroca = jan;
    await C.v(`ACOES.ecra2Trocar(); 0`);
    await dormir(600);
    jan = await P.v("window.orcamentoDesktop._testeJanelas()");
    ok(jan.principal.ecra === antesTroca.companheira.ecra && jan.companheira.ecra === antesTroca.principal.ecra, "«Trocar de ecrã» troca as duas janelas", JSON.stringify([antesTroca.principal.ecra, antesTroca.companheira.ecra, jan.principal.ecra, jan.companheira.ecra]));
    await C.v(`ACOES.ecra2Trocar(); 0`);
    await dormir(600);

    G("ecrãs que se desligam e se ligam");
    await P.v(`window.orcamentoDesktop._testeEcras(${JSON.stringify([ECRA1])})`);
    await dormir(600);
    jan = await P.v("window.orcamentoDesktop._testeJanelas()");
    ok(jan.companheira && jan.companheira.ecra === 1, "desligado o segundo ecrã, a companheira vem para o primeiro", JSON.stringify(jan.companheira));
    ok(jan.companheira && jan.companheira.bounds.width <= ECRA1.width / 2 + 2, "ocupando metade, ao lado da principal", JSON.stringify(jan.companheira.bounds));
    ok(await esperar(P, `_ecras === 1`), "a principal sabe que ficou um ecrã");
    await P.v(`window.orcamentoDesktop._testeEcras(${JSON.stringify([ECRA1, ECRA2])})`);
    await dormir(600);
    jan = await P.v("window.orcamentoDesktop._testeJanelas()");
    ok(jan.companheira && jan.companheira.ecra === 2, "ligado outra vez, a companheira volta ao segundo", JSON.stringify(jan.companheira));
    await P.v(`fecharSegundoEcra(); 0`);
    await dormir(800);
    ok(!(await alvos()).some(t => t.url.indexOf("janela=painel") >= 0), "fechar fecha a janela");
    ok(await esperar(P, "!painelAberto()"), "e a principal volta a abrir o detalhe ao lado");
    C.fechar();

    G("abrir sozinha quando se liga um ecrã");
    await P.v(`window.orcamentoDesktop._testeEcras(${JSON.stringify([ECRA1])})`);
    await P.v(`window.orcamentoDesktop.definirAuto(true)`);
    await dormir(300);
    await P.v(`window.orcamentoDesktop._testeEcras(${JSON.stringify([ECRA1, ECRA2])})`);
    let auto = null;
    try { auto = await janela(u => u.indexOf("janela=painel") >= 0, 6000); } catch(e){}
    ok(!!auto, "com «Abrir sozinha», ligar o segundo ecrã abre a companheira");
    if (auto){ await P.v(`fecharSegundoEcra(); 0`); auto.fechar(); }
    await P.v(`window.orcamentoDesktop.definirAuto(false)`);
    await P.v(`window.orcamentoDesktop._testeEcras(${JSON.stringify([ECRA1])})`);
    await dormir(300);
    await P.v(`window.orcamentoDesktop._testeEcras(${JSON.stringify([ECRA1, ECRA2])})`);
    await dormir(1200);
    ok(!(await alvos()).some(t => t.url.indexOf("janela=painel") >= 0), "sem a opção, só avisa");
    ok(await P.v(`/segundo ecrã/.test(document.getElementById("toast").textContent)`), "com um aviso e o botão «Usar os dois»");

    G("cópia diária e dados entre arranques");
    await P.v(`alterar(() => { S.movimentos.push({id: "e2e-fica", tipo: "despesa", data: isoDia(hoje()), descricao: "Para ficar", valor: 3, categoriaId: S.categorias[0].id, membroId: ""}); }, "teste"); 0`);
    const pastaCopias = await P.v("window.orcamentoDesktop.pastaCopias()");
    const hoje = new Date().toISOString().slice(0, 10);
    let copia = null;
    // A cópia de hoje já existia (das suites): espera-se que passe a ter a alteração
    for (let i = 0; i < 40 && !(copia && copia.movimentos.some(m => m.id === "e2e-fica")); i++){
      await dormir(250);
      try { copia = JSON.parse(fs.readFileSync(path.join(pastaCopias, "orcamento-" + hoje + ".json"), "utf8")); } catch(e){}
    }
    ok(copia && copia.movimentos.some(m => m.id === "e2e-fica"), "a cópia do dia fica na pasta, com a última alteração",
      pastaCopias + " — " + (fs.existsSync(pastaCopias) ? fs.readdirSync(pastaCopias).join(",") : "sem pasta") + " — na página: " +
      (await P.v("JSON.stringify({tem: S.movimentos.some(m => m.id === \"e2e-fica\"), t: typeof _copiaT})")));
    await P.v(`(()=>{ const w = window; w.__bounds = null; return 0; })()`);
    // A acessibilidade escolhida aqui tem de sobreviver ao fecho
    await P.v(`ACOES.acessVisao({dataset: {v: "tritanopia"}}); ACOES.acessFoco({dataset: {v: "forte"}}); ACOES.acessMovimento({dataset: {v: "reduzido"}}); 0`);
    const janAntes = await P.v("window.orcamentoDesktop._testeJanelas()");
    /* Fecha-se como fecha uma pessoa: a janela. E para provar que a gravação
       já está no disco mesmo sem isso, a segunda volta mata o processo. */
    const saida = new Promise(r => app.on("exit", r));
    await P.v("setTimeout(() => window.close(), 50), 0").catch(() => {});
    P.fechar();
    await Promise.race([saida, dormir(8000)]);
    await dormir(500);

    app = arrancar();
    const P2 = await janela(u => u.startsWith("app://orcamento/") && u.indexOf("janela=painel") < 0);
    await pronta(P2);
    ok(await P2.v(`S.movimentos.some(m => m.id === "e2e-fica")`), "os dados ficam de um arranque para o outro");

    G("acessibilidade entre arranques");
    const ac = JSON.parse(await P2.v(`JSON.stringify({visao: document.documentElement.dataset.visao, foco: document.documentElement.dataset.foco,
      mov: document.documentElement.dataset.movimento, reduz: reduzMovimento(), pal: paletaDaVisao(), esperada: VISOES.tritanopia[modoEfetivo() === "dark" ? "escuro" : "claro"],
      pos: getComputedStyle(document.documentElement).getPropertyValue("--pos").trim()})`));
    ok(ac.visao === "tritanopia" && ac.foco === "forte" && ac.mov === "reduzido" && ac.reduz, "a visão, o foco e o movimento escolhidos voltam com a aplicação", JSON.stringify(ac));
    ok(JSON.stringify(ac.pal) === JSON.stringify(ac.esperada), "e os gráficos voltam com a paleta dessa visão");
    ok(/^#(2c6e85|5fd6d6)$/i.test(ac.pos), "com o positivo próprio da tritanopia", ac.pos);
    await P2.v(`ACOES.acessVisao({dataset: {v: "padrao"}}); ACOES.acessFoco({dataset: {v: "normal"}}); ACOES.acessMovimento({dataset: {v: "auto"}}); 0`);
    const janDepois = await P2.v("window.orcamentoDesktop._testeJanelas()");
    ok(janDepois.principal && Math.abs(janDepois.principal.bounds.x - janAntes.principal.bounds.x) < 4 &&
       Math.abs(janDepois.principal.bounds.width - janAntes.principal.bounds.width) < 4, "e a janela volta ao sítio e ao tamanho em que estava",
       JSON.stringify([janAntes.principal.bounds, janDepois.principal.bounds]));

    G("uma instância só");
    const segunda = arrancar({}, []);
    const saiu = await new Promise(r => { const t = setTimeout(() => r(false), 8000); segunda.on("exit", () => { clearTimeout(t); r(true); }); });
    ok(saiu, "uma segunda abertura sai logo e devolve o foco à primeira");
    const paginas = (await alvos()).filter(t => t.type === "page" && t.url.startsWith("app://"));
    ok(paginas.length === 1, "continua a haver uma janela só", paginas.length);
    await P2.v(`alterar(() => { S.movimentos = S.movimentos.filter(m => m.id !== "e2e-fica"); }, "teste"); 0`);

    G("um fecho à força não leva a última alteração");
    await P2.v(`alterar(() => { S.movimentos.push({id: "e2e-forca", tipo: "despesa", data: isoDia(hoje()), descricao: "Antes do corte", valor: 1, categoriaId: S.categorias[0].id, membroId: ""}); }, "teste"); 0`);
    await dormir(1200);
    P2.fechar();
    app.kill("SIGKILL");
    await dormir(1500);
    app = arrancar();
    const P3 = await janela(u => u.startsWith("app://orcamento/") && u.indexOf("janela=painel") < 0);
    await pronta(P3);
    ok(await P3.v(`S.movimentos.some(m => m.id === "e2e-forca")`), "a alteração de um segundo antes do corte está lá");
    await P3.v(`alterar(() => { S.movimentos = S.movimentos.filter(m => m.id !== "e2e-forca"); }, "teste"); 0`);
    P3.fechar();
  } catch(e){
    ok(false, "o teste correu até ao fim", e && e.stack);
  } finally {
    try { app.kill(); } catch(e){}
    await dormir(800);
    try { fs.rmSync(DADOS, {recursive: true, force: true}); } catch(e){}
  }
  console.log("\nE2E: " + passes + "/" + (passes + falhas.length) + " em " + Math.round((Date.now() - t0) / 1000) + " s");
  if (falhas.length){ console.log("Falhas:\n  " + falhas.join("\n  ")); process.exit(1); }
  process.exit(0);
})();

function eq2(a, b, nome){ return ok(a === b, nome, "obtido " + JSON.stringify(a) + ", esperado " + JSON.stringify(b)); }
