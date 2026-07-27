/* ============================================================
   Suite de QA — estados aleatórios (fuzz)

   As outras suites testam casos escolhidos por mim, e por isso
   testam aquilo em que eu já pensei. Esta gera agregados inteiros
   ao acaso — membros, rendimentos, rubricas, movimentos, ativos,
   créditos, objetivos e compras planeadas — e exige que, seja qual
   for o disparate, se mantenham verdadeiras as coisas que a
   aplicação promete: nenhum número publicado é NaN ou infinito, o
   saldo é sempre rendimento menos despesa, o balanço fecha, a
   tesouraria acumula, e nenhuma vista deixa escapar «NaN» ou
   «undefined» para o ecrã.

   O gerador é determinístico: cada caso tem uma semente, e uma
   falha repete-se dando a mesma semente.
   ============================================================ */
(function(){
"use strict";

var falhas = [], passes = 0, grupo = "";
function G(n){ grupo = n; }
function ok(c, nome, det){
  if (c){ passes++; return true; }
  falhas.push({grupo:grupo, teste:nome, detalhe: det == null ? "" : String(det)});
  return false;
}

var backup = localStorage.getItem(STORE_KEY);
var backupSessao = localStorage.getItem(SESSAO_KEY);
var vistaInicial = VIEW, mesInicial = MES;

/* Como nas outras suites: a sessão do utilizador sai de cena, para que um
   rascunho por recuperar não abra um diálogo por cima dos testes. */
localStorage.removeItem(SESSAO_KEY);
if (document.querySelector("#modalHost .overlay")) document.getElementById("modalHost").innerHTML = "";

/* Gerador congruencial linear: previsível de propósito. */
var _s = 1;
function semear(n){ _s = n >>> 0 || 1; }
function rnd(){ _s = (_s * 1103515245 + 12345) & 0x7fffffff; return _s / 0x7fffffff; }
function esc(n){ return Math.floor(rnd() * n); }
function umDe(lista){ return lista[esc(lista.length)]; }
/* Valores hostis com intenção: zeros, negativos, casas decimais
   minúsculas e ordens de grandeza absurdas, além dos plausíveis. */
function num(){
  var r = rnd();
  return r < 0.10 ? 0
       : r < 0.20 ? -Math.floor(rnd() * 5000)
       : r < 0.28 ? rnd() * 0.001
       : r < 0.33 ? Math.floor(rnd() * 1e7)
       : Math.floor(rnd() * 9000);
}

/** Um agregado inteiro ao acaso, a partir de uma semente. */
function agregadoAleatorio(sem){
  semear(sem);
  S = estadoVazio(); limparCacheCredito(); MES = isoMes(hoje());
  var cats  = S.categorias.filter(function(c){ return c.tipo === "despesa"; });
  var catsR = S.categorias.filter(function(c){ return c.tipo === "rendimento"; });
  var especies = Object.keys(ESPECIES), freqs = Object.keys(FREQ), classes = Object.keys(CLASSES);
  var i;

  var nm = esc(4);
  for (i = 0; i < nm; i++) S.membros.push({id:"m"+i, nome:"M"+i});

  var nr = esc(5);
  for (i = 0; i < nr; i++) S.rendimentos.push({id:"rd"+i, nome:"R"+i,
    membroId: nm ? "m"+esc(nm) : "", regime: rnd() < 0.5 ? "dependente" : "independente",
    ativo: rnd() < 0.9, deficiencia: rnd() < 0.15,
    componentes:[{id:"c"+i, nome:"C"+i, especie: umDe(especies), valor: num(),
      frequencia: umDe(freqs), categoriaId: umDe(catsR).id}]});

  var nd = esc(9);
  for (i = 0; i < nd; i++) S.recorrentes.push({id:"r"+i, tipo:"despesa", nome:"D"+i,
    valor: num(), frequencia: umDe(freqs), ativo: rnd() < 0.85, categoriaId: umDe(cats).id, membroId:"",
    inicio: rnd() < 0.3 ? mesShift(MES, -esc(24))+"-01" : "",
    fim:    rnd() < 0.2 ? mesShift(MES,  esc(24))+"-01" : ""});

  var nv = esc(30);
  for (i = 0; i < nv; i++) S.movimentos.push({id:"v"+i,
    data: mesShift(MES, -esc(6))+"-"+String(1 + esc(28)).padStart(2,"0"),
    tipo: rnd() < 0.7 ? "despesa" : "rendimento", descricao:"Mv"+i,
    categoriaId: rnd() < 0.9 ? umDe(cats).id : "nao-existe", membroId:"", valor: num()});

  var na = esc(6);
  for (i = 0; i < na; i++) S.ativos.push({id:"a"+i, nome:"A"+i, classe: umDe(classes),
    aquisicao: num(), atual: num(), quantidade: rnd() < 0.3 ? num() : 0, cotacao: rnd() < 0.3 ? num() : 0,
    vpt: num(), iuc: esc(300), dataAquisicao: mesShift(MES, -esc(60))+"-01",
    contribuicao: num(), crescContrib: esc(10), reinvestimento: esc(101),
    encargos:[], rendimentos:[], aportes:[]});

  var nc = esc(4);
  for (i = 0; i < nc; i++) S.creditos.push({id:"cr"+i, nome:"CR"+i, capital: num(),
    prazoMeses: 1 + esc(480), inicio: mesShift(MES, -esc(60))+"-01",
    tipoTaxa: rnd() < 0.5 ? "fixa" : "variavel", taxaAnual: rnd()*12,
    indexanteValor: rnd()*6, spread: rnd()*3, revisaoMeses: umDe([3,6,12]), seguroMensal: esc(60),
    ativoId: (na && rnd() < 0.6) ? "a"+esc(na) : "",
    categoriaJurosId:"", categoriaCapitalId:"", categoriaSeguroId:""});

  var no = esc(4);
  for (i = 0; i < no; i++) S.objetivos.push({id:"ob"+i, nome:"O"+i, alvo: num(), atual: num(),
    ativoId: (na && rnd() < 0.4) ? "a"+esc(na) : "",
    prazo: rnd() < 0.7 ? mesShift(MES, esc(36))+"-01" : "", cor:"#123456", celebrado:false});

  var np = esc(6);
  for (i = 0; i < np; i++) S.planeadas.push({id:"pl"+i, nome:"P"+i, valor: num(),
    categoriaId: umDe(cats).id, horizonte: umDe([3,6,12,24]),
    mes: rnd() < 0.6 ? mesShift(MES, esc(30)) : "",
    objetivoId: (no && rnd() < 0.4) ? "ob"+esc(no) : "",
    feitaEm: rnd() < 0.2 ? isoDia(hoje()) : "", membroId:"", criadoEm:""});

  cats.forEach(function(c){ if (rnd() < 0.4) S.limites[c.id] = num(); });
  S.fiscal.regiao = umDe(["continente","acores","madeira"]);
  S.fiscal.estadoCivil = umDe(["nao_casado","casado_unico","casado_dois"]);
  S.fiscal.dependentes = esc(5);
  S.fiscal.contarIRS = rnd() < 0.8;
  return {membros:nm, rendimentos:nr, rubricas:nd, movimentos:nv, ativos:na,
          creditos:nc, objetivos:no, planeadas:np};
}

var VISTAS_TODAS = ["painel","rendimentos","despesas","ativos","creditos","objetivos","estrategias","config"];
var SECOES = ["plano","movimentos","limites","planear"];
var LIXO = /NaN|undefined|\[object |Infinity/;

G("estados aleatórios — invariantes");
(function(){
  var SEMENTES = 40;
  for (var sem = 1; sem <= SEMENTES; sem++){
    var forma = agregadoAleatorio(sem);
    var etq = "semente " + sem;

    var p, r, b;
    try { p = planoMes(MES); r = realMes(MES); b = balanco(); }
    catch(e){ ok(false, etq + ": os totais calculam", e.message); continue; }

    // 1. Nada do que a aplicação publica pode ser NaN ou infinito
    [["plano.rend",p.rend],["plano.desp",p.desp],["plano.saldo",p.saldo],
     ["real.rend",r.rend],["real.desp",r.desp],["real.saldo",r.saldo],
     ["balanço.carteira",b.carteira],["balanço.bens",b.bens],["balanço.ativos",b.ativos],
     ["balanço.dívida",b.divida],["balanço.líquido",b.liquido],
     ["liquidez",totalLiquidez()]].forEach(function(par){
      ok(isFinite(par[1]), etq + ": " + par[0] + " é finito", par[1]);
    });

    // 2. As identidades que dão sentido aos números
    ok(Math.abs((p.rend - p.desp) - p.saldo) <= 0.02, etq + ": saldo do plano = rendimento − despesa",
       p.rend + " − " + p.desp + " ≠ " + p.saldo);
    ok(Math.abs((r.rend - r.desp) - r.saldo) <= 0.02, etq + ": saldo real = rendimento − despesa");
    ok(Math.abs((b.ativos - b.divida) - b.liquido) <= 0.02, etq + ": balanço fecha (ativos − dívida = líquido)",
       b.ativos + " − " + b.divida + " ≠ " + b.liquido);
    ok(Math.abs((b.carteira + b.bens) - b.ativos) <= 0.02, etq + ": carteira + bens = ativos",
       b.carteira + " + " + b.bens + " ≠ " + b.ativos);

    // 3. A tesouraria acumula, mês a mês, já com as compras marcadas
    var t;
    try { t = tesourariaProjetada(12); } catch(e){ ok(false, etq + ": tesouraria calcula", e.message); t = []; }
    ok(t.length === 12, etq + ": a tesouraria projeta doze meses");
    for (var k = 0; k < t.length; k++){
      if (!ok(isFinite(t[k].acumulado), etq + ": tesouraria finita no mês " + k, t[k].acumulado)) break;
      if (k > 0) ok(Math.abs(t[k].acumulado - (t[k-1].acumulado + t[k].saldo)) <= 0.02,
        etq + ": tesouraria acumula no mês " + k);
    }

    // 4. As compras planeadas continuam a produzir análises legíveis
    S.planeadas.forEach(function(pl){
      var an;
      try { an = analisarPlaneada(pl.valor, pl.horizonte, pl.id); }
      catch(e){ ok(false, etq + ": análise de «" + pl.nome + "» não rebenta", e.message); return; }
      if (!an){ ok(parseNum(pl.valor) <= 0, etq + ": só verbas nulas ficam sem análise", pl.valor); return; }
      ok(an.meses.every(function(m){ return isFinite(m.folga); }), etq + ": folgas finitas");
      ok(an.meses.every(function(m){ return [0,1,2].indexOf(m.grau) >= 0; }), etq + ": graus válidos");
      ok(an.trimestres.every(function(x){ return x.meses.indexOf(x.melhor) >= 0; }),
         etq + ": o melhor mês pertence ao seu trimestre");
      var ver = veredictoPlaneada(an);
      ok(typeof ver.txt === "string" && ver.txt.length > 10, etq + ": o veredicto tem texto");
      ok(!LIXO.test(ver.txt), etq + ": e o texto não traz lixo", ver.txt);
    });

    // 5. Gravar e reler devolve o mesmo agregado. Compara-se a partir do
    //    estado já normalizado: o estado cru sofre uma passagem legítima
    //    (o `painel.ocultos: null` resolve-se nos cartões por omissão).
    try {
      var uma  = JSON.stringify(normalizar(JSON.parse(JSON.stringify(S))));
      var duas = JSON.stringify(normalizar(JSON.parse(uma)));
      ok(uma === duas, etq + ": normalizar é idempotente",
         "formas: " + JSON.stringify(forma));
      // E sobrevive à ida e volta ao localStorage, que é o caminho real
      var ida = JSON.parse(uma);
      ok(JSON.stringify(normalizar(JSON.parse(JSON.stringify(ida)))) === uma,
         etq + ": sobrevive à gravação e à releitura");
    } catch(e){ ok(false, etq + ": normalização não rebenta", e.message); }
  }
})();

G("estados aleatórios — todas as vistas renderizam");
(function(){
  var SEMENTES = 12;
  for (var sem = 101; sem < 101 + SEMENTES; sem++){
    agregadoAleatorio(sem);
    var etq = "semente " + sem;
    VISTAS_TODAS.forEach(function(v){
      var lista = v === "despesas" ? SECOES : [null];
      lista.forEach(function(sec){
        var quem = etq + " · " + v + (sec ? "/" + sec : "");
        try {
          if (sec) ui.secaoDespesa = sec;
          irPara(v);
          var txt = document.getElementById("app").innerText;
          ok(txt.length > 0, quem + ": tem conteúdo");
          var m = txt.match(LIXO);
          ok(!m, quem + ": sem lixo no ecrã",
             m ? txt.slice(Math.max(0, txt.search(LIXO) - 50), txt.search(LIXO) + 50) : "");
        } catch(e){ ok(false, quem + ": renderiza", e.message); }
      });
    });
    // O relatório é outra montagem, e merece o mesmo escrutínio
    try {
      ui.relatorio = true; render();
      ok(!LIXO.test(document.getElementById("app").innerText), etq + " · relatório: sem lixo");
    } catch(e){ ok(false, etq + " · relatório: renderiza", e.message); }
    finally { ui.relatorio = false; }
  }
})();

G("estados aleatórios — meses extremos");
(function(){
  // O mesmo agregado visto de muito longe, para trás e para a frente
  for (var sem = 201; sem <= 206; sem++){
    agregadoAleatorio(sem);
    var raiz = isoMes(hoje());
    [-120, -13, -1, 0, 1, 13, 120].forEach(function(dm){
      MES = mesShift(raiz, dm);
      var quem = "semente " + sem + " · " + MES;
      try {
        var p = planoMes(MES), r = realMes(MES);
        ok(isFinite(p.saldo) && isFinite(r.saldo), quem + ": saldos finitos");
        irPara("painel");
        ok(!LIXO.test(document.getElementById("app").innerText), quem + ": painel sem lixo");
      } catch(e){ ok(false, quem + ": aguenta-se", e.message); }
    });
    MES = raiz;
  }
})();

G("macaco — sequências aleatórias de ações");
(function(){
  /* Um agregado ao acaso e, a partir dele, cliques ao acaso: cada passo
     escolhe um botão da vista onde está, carrega nele, e a seguir exige
     que o estado continue coerente e que a repintura não deixe lixo.
     É aqui que aparecem os erros que nenhum caso escolhido apanha —
     eliminar durante uma edição, desfazer no meio de um formulário,
     mudar de mês com a paleta aberta. */
  var PROIBIDOS = ["limpar","importJSON","exportJSON","exportCSV","exportPatrimonioCSV",
                   "imprimir","tutorialIniciar"];
  var CORRIDAS = 8, PASSOS = 45;

  for (var c = 0; c < CORRIDAS; c++){
    var sem = 500 + c;
    agregadoAleatorio(sem);
    // O gerador continua a servir de fonte de aleatoriedade, já semeado
    var etq = "corrida " + sem;
    var vistas = VISTAS_TODAS.slice();
    var historicoCliques = [];

    for (var passo = 0; passo < PASSOS; passo++){
      // de vez em quando muda de vista, de secção ou de mês
      var dado = rnd();
      try {
        if (dado < 0.12){ irPara(umDe(vistas)); }
        else if (dado < 0.18){ ui.secaoDespesa = umDe(SECOES); irPara("despesas"); }
        else if (dado < 0.24){ MES = mesShift(MES, esc(5) - 2); render(); }
      } catch(e){
        ok(false, etq + " passo " + passo + ": navegar não rebenta",
           e.message + " · últimos: " + historicoCliques.slice(-4).join(" › "));
        break;
      }

      var botoes = Array.prototype.slice.call(document.querySelectorAll("#app button"))
        .filter(function(b){ return PROIBIDOS.indexOf(b.dataset.act || "") < 0 && !b.disabled; });
      if (!botoes.length) continue;
      var b = botoes[esc(botoes.length)];
      var quem = (b.dataset.act || b.className.slice(0,12)) + (b.dataset.id ? "#"+b.dataset.id : "");
      historicoCliques.push(quem);

      try {
        b.click();
        // um diálogo aberto responde-se a favor, para o caminho ir até ao fim
        var sim = document.querySelector('[data-dlg="yes"]');
        if (sim) sim.click();
      } catch(e){
        ok(false, etq + " passo " + passo + " [" + quem + "]: o clique não rebenta",
           e.message + " · antes: " + historicoCliques.slice(-4).join(" › "));
        break;
      }

      // Invariantes depois de cada passo
      try {
        var p = planoMes(MES), bal = balanco();
        if (!ok(isFinite(p.saldo) && isFinite(bal.liquido),
                etq + " passo " + passo + ": os totais mantêm-se finitos",
                "saldo=" + p.saldo + " líquido=" + bal.liquido + " · " + historicoCliques.slice(-4).join(" › "))) break;
        if (!ok(Math.abs((p.rend - p.desp) - p.saldo) <= 0.02,
                etq + " passo " + passo + ": o saldo continua a fechar",
                historicoCliques.slice(-4).join(" › "))) break;
        var txt = document.getElementById("app").innerText;
        if (!ok(!LIXO.test(txt), etq + " passo " + passo + " [" + quem + "]: sem lixo no ecrã",
                txt.slice(Math.max(0, txt.search(LIXO) - 50), txt.search(LIXO) + 50) +
                " · " + historicoCliques.slice(-4).join(" › "))) break;
      } catch(e){
        ok(false, etq + " passo " + passo + ": o estado continua calculável",
           e.message + " · " + historicoCliques.slice(-4).join(" › "));
        break;
      }
      // limpar o que tenha ficado aberto, para o passo seguinte ser livre
      var mh = document.getElementById("modalHost"); if (mh) mh.innerHTML = "";
      var pal = document.getElementById("paleta"); if (pal) pal.innerHTML = "";
    }
    // Depois de tanta pancada, o estado tem de continuar a gravar e a reler
    try {
      var s1 = JSON.stringify(normalizar(JSON.parse(JSON.stringify(S))));
      ok(JSON.stringify(normalizar(JSON.parse(s1))) === s1,
         etq + ": o estado sobrevive intacto à ida e volta");
    } catch(e){ ok(false, etq + ": o estado final normaliza", e.message); }
  }
})();

/* Repor o que era do utilizador */
S = estadoVazio();
if (backup){ try { S = normalizar(JSON.parse(backup)); } catch(e){} localStorage.setItem(STORE_KEY, backup); }
else localStorage.removeItem(STORE_KEY);
if (backupSessao) localStorage.setItem(SESSAO_KEY, backupSessao);
else localStorage.removeItem(SESSAO_KEY);
limparCacheCredito();
MES = mesInicial; VIEW = vistaInicial; ui.relatorio = false;
try { render(); } catch(e){}
/* Cancelar as gravações adiadas que a repintura agendou, e repor a sessão
   depois delas: caso contrário voltavam a escrever no disco o que se
   acabou de arrumar. */
if (typeof guardarT !== "undefined") clearTimeout(guardarT);
if (typeof _sessaoT !== "undefined") clearTimeout(_sessaoT);
if (backupSessao) localStorage.setItem(SESSAO_KEY, backupSessao);
else localStorage.removeItem(SESSAO_KEY);

window.__QAFUZZ = {total: passes + falhas.length, passes: passes, falhas: falhas.length, detalhe: falhas};
console.log("QA fuzz:", passes + "/" + (passes + falhas.length), falhas.length ? falhas : "tudo verde");
})();
