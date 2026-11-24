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
var filtrosIniciais = JSON.parse(JSON.stringify(filtros));
var secaoInicial = ui.secaoDespesa;
var secaoEstrInicial = ui.secaoEstrategia;

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

  /* Rostos por vezes em falta de propósito: um orçamento vindo de uma versão
     anterior tem membros sem emoji nem cor, e é `normalizar` que lhos dá. */
  var nm = esc(4);
  for (i = 0; i < nm; i++) S.membros.push(rnd() < 0.3
    ? {id:"m"+i, nome:"M"+i}
    : {id:"m"+i, nome:"M"+i, icone: umDe(EMOJIS_MEMBRO), cor:"#4a75db"});

  var nr = esc(5);
  for (i = 0; i < nr; i++) S.rendimentos.push({id:"rd"+i, nome:"R"+i,
    membroId: nm ? "m"+esc(nm) : "", regime: rnd() < 0.5 ? "dependente" : "independente",
    ativo: rnd() < 0.9, deficiencia: rnd() < 0.15,
    componentes:[{id:"c"+i, nome:"C"+i, especie: umDe(especies), valor: num(),
      frequencia: umDe(freqs), categoriaId: umDe(catsR).id}]});

  /* O dia do mês entra com valores hostis à mistura — 0, 31, 40, texto — e
     em boa parte das rubricas fica vazio, que é o estado de quem nunca o
     preencheu. */
  var nd = esc(9);
  for (i = 0; i < nd; i++) S.recorrentes.push({id:"r"+i, tipo:"despesa", nome:"D"+i,
    valor: num(), frequencia: umDe(freqs), ativo: rnd() < 0.85, categoriaId: umDe(cats).id, membroId:"",
    dia: rnd() < 0.45 ? "" : umDe([1, 5, 15, 28, 29, 30, 31, 0, 40, -3, "abc", null]),
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

  /* Notas, meses fechados e instantâneos do património — com meses
     inválidos e valores impossíveis pelo meio, que é o que um ficheiro
     editado à mão traz. */
  var nn = esc(8);
  for (i = 0; i < nn; i++){
    var mesNota = rnd() < 0.15 ? umDe(["2026-13", "abc", "", "2026-1"]) : mesShift(MES, -esc(18));
    S.notas[mesNota] = rnd() < 0.1 ? "" : "Nota "+i+(rnd() < 0.1 ? new Array(400).join("x") : "");
  }
  var nf = esc(8);
  for (i = 0; i < nf; i++){
    var mesF = rnd() < 0.15 ? umDe(["2026-13", "xx", ""]) : mesShift(MES, -(i+1));
    S.fechados[mesF] = rnd() < 0.2 ? {} : {em: isoDia(hoje())};
  }
  var nh = esc(14);
  for (i = 0; i < nh; i++) S.patrimonioHist.push({
    mes: rnd() < 0.12 ? umDe(["2026-13", "", "abc"]) : mesShift(MES, -(i+1)),
    ativo: num(), divida: num(), liquido: num()});

  cats.forEach(function(c){ if (rnd() < 0.4) S.limites[c.id] = num(); });
  S.fiscal.regiao = umDe(["continente","acores","madeira"]);
  S.fiscal.estadoCivil = umDe(["nao_casado","casado_unico","casado_dois"]);
  S.fiscal.dependentes = esc(5);
  S.fiscal.contarIRS = rnd() < 0.8;
  return {membros:nm, rendimentos:nr, rubricas:nd, movimentos:nv, ativos:na,
          creditos:nc, objetivos:no, planeadas:np, notas:nn, fechados:nf, instantaneos:nh};
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

    // 4b. As funcionalidades do mês por dentro, sob dados hostis
    try {
      var ev = eventosDoMes(MES);
      var ultimoDia = new Date(+MES.split("-")[0], +MES.split("-")[1], 0).getDate();
      ok(ev.dias.every(function(d){ return d.dia >= 1 && d.dia <= ultimoDia; }),
         etq + ": a linha do mês nunca sai do mês", ultimoDia);
      ok(ev.dias.every(function(d){ return isFinite(d.despesa) && isFinite(d.rendimento); }),
         etq + ": e os totais de cada dia são finitos");
      ok(isFinite(ev.totalDespesa) && isFinite(ev.totalRendimento), etq + ": totais da linha do mês finitos");
      for (var d2 = 1; d2 < ev.dias.length; d2++)
        ok(ev.dias[d2-1].dia < ev.dias[d2].dia, etq + ": os dias saem por ordem e sem repetidos");

      var prox = proximoPagamento();
      if (prox) ok(prox.dia >= hoje().getDate() && prox.faltam >= 0,
        etq + ": o próximo pagamento não está no passado");

      var f = preverFechoMes();
      if (f){
        ok(isFinite(f.despPrev) && isFinite(f.rendPrev) && isFinite(f.saldoPrev),
           etq + ": a previsão dá números finitos");
        ok(Math.abs((f.rendPrev - f.despPrev) - f.saldoPrev) <= 0.02,
           etq + ": e o saldo previsto fecha as contas");
        ok(f.despPrev >= realMes(MES).desp - 0.02,
           etq + ": a despesa prevista nunca é menor do que a já feita",
           f.despPrev + " vs " + realMes(MES).desp);
        ok(f.margem >= 0 && isFinite(f.margem), etq + ": a margem é finita e não negativa");
        ok(f.ritmoDia >= 0 && isFinite(f.ritmoDia), etq + ": o ritmo diário não é negativo");
        // Cada rubrica conta uma vez: ou está lançada, ou está por pagar
        var lanc = rubricasLancadas(MES);
        var mensais = S.recorrentes.filter(function(x){ return recAtiva(x, MES) && x.frequencia === "mensal"; });
        ok(lanc.size <= mensais.length, etq + ": não há mais rubricas lançadas do que rubricas");
      }
    } catch(e){ ok(false, etq + ": o mês por dentro não rebenta", e.message); }

    // 4b2. Provisões, saúde financeira e alavancas do défice
    try {
      var pr = provisoes(MES);
      ok(isFinite(pr.devia) && pr.devia >= 0, etq + ": o que devia estar de parte é finito e não negativo", pr.devia);
      ok(isFinite(pr.porMes) && pr.porMes >= 0, etq + ": e a quota mensal também");
      pr.linhas.forEach(function(x){
        ok(x.devia >= 0 && x.devia <= x.total + 0.01,
           etq + ": provisão de «" + x.rec.nome + "» dentro do total", x.devia + " de " + x.total);
        ok(x.faltam >= 0 && x.faltam < x.passo + 1, etq + ": meses em falta dentro do ciclo", x.faltam);
        ok(mesValido(x.proximo), etq + ": a próxima ocorrência é um mês válido", x.proximo);
        ok(x.proximo >= MES, etq + ": e nunca está no passado", x.proximo);
      });
      ok(pr.disponivel <= pr.liquidez + 0.01, etq + ": o disponível nunca passa a liquidez");

      var sf = saudeFinanceira();
      ok(sf.total >= 0 && sf.total <= 100, etq + ": a saúde financeira fica entre 0 e 100", sf.total);
      sf.partes.forEach(function(x){
        ok(x.nota >= 0 && x.nota <= 1, etq + ": nota de «" + x.lbl + "» entre 0 e 1", x.nota);
        ok(x.pontos <= x.peso + 0.01, etq + ": e os pontos não passam o peso");
        ok(typeof x.txt === "string" && !LIXO.test(x.txt), etq + ": com texto sem lixo", x.txt);
      });
      ok(!sf.melhor || (sf.melhor.sugestao && sf.melhor.ganho > 0),
         etq + ": a sugestão de melhoria tem texto e ganho");

      var ad = alavancasDefice();
      if (ad){
        ok(ad.falta > 0, etq + ": só há alavancas quando falta mesmo dinheiro", ad.falta);
        ad.alavancas.forEach(function(a){
          ok(isFinite(a.valor) && a.valor >= 0, etq + ": alavanca com valor finito", a.valor);
          ok(a.txt && a.det && !LIXO.test(a.txt + a.det), etq + ": e com texto legível");
        });
      }
    } catch(e){ ok(false, etq + ": provisões e saúde não rebentam", e.message); }

    // 4b3. Eventos de vida — simular nunca pode tocar nos dados
    try {
      var antesSim = JSON.stringify(S);
      var chaves = Object.keys(EVENTOS_VIDA);
      var cenario = [
        {tipo: umDe(chaves), mes: mesShift(MES, esc(6)), params: null},
        {tipo: umDe(chaves), mes: mesShift(MES, esc(12)), params: null},
      ].map(function(x){ x.params = paramsEvento(x.tipo); return x; });

      var cc = compararCenario(cenario, umDe([12, 24, 36]));
      ok(JSON.stringify(S) === antesSim, etq + ": simular não altera o orçamento");
      ok(isFinite(cc.saldoDepois) && isFinite(cc.rendDepois) && isFinite(cc.despDepois),
         etq + ": o cenário dá números finitos");
      ok(Math.abs((cc.rendDepois - cc.despDepois) - cc.saldoDepois) <= 0.02,
         etq + ": e as contas do cenário fecham");
      ok(cc.cen.length === cc.real.length, etq + ": as duas séries têm o mesmo comprimento");
      for (var z = 1; z < cc.cen.length; z++)
        ok(Math.abs(cc.cen[z].acumulado - (cc.cen[z-1].acumulado + cc.cen[z].saldo)) <= 0.02,
           etq + ": a tesouraria do cenário acumula no mês " + z);
      ok(cc.pontualTotal >= 0 && isFinite(cc.pontualTotal),
         etq + ": os encargos pontuais não são negativos", cc.pontualTotal);
      ok(mesValido(cc.mesRegime), etq + ": o mês de regime é válido", cc.mesRegime);
      cc.detalhe.forEach(function(d){
        ok(d.nome && isFinite(d.valor), etq + ": cada linha do detalhe tem nome e valor finito");
      });
      // Um pontual cai uma vez só em todo o horizonte
      chaves.forEach(function(k){
        var so = [{tipo:k, mes: mesShift(MES, 2), params: paramsEvento(k)}];
        var comPontual = 0;
        for (var mm = 0; mm < 12; mm++)
          if (planoComEventos(mesShift(MES, mm), so).pontual > 0) comPontual++;
        ok(comPontual <= 1, etq + ": «" + k + "» não repete o encargo pontual", comPontual);
      });
    } catch(e){ ok(false, etq + ": os eventos de vida não rebentam", e.message); }

    // 4c. Insight e rituais
    try {
      anomaliasMes(MES).forEach(function(a){
        ok(isFinite(a.pct) && isFinite(a.dif) && isFinite(a.esperado),
           etq + ": anomalia de «" + a.cat.nome + "» com números finitos");
        ok(Math.abs(a.pct) >= ANOMALIA_PCT && Math.abs(a.dif) >= ANOMALIA_EUR,
           etq + ": e passa as duas fasquias");
        ok(BASE_ANOMALIA[a.base] != null, etq + ": com base conhecida", a.base);
      });
      subscricoes().forEach(function(x){
        ok(isFinite(x.anual) && Math.abs(x.anual - x.mensal * 12) <= 0.02,
           etq + ": subscrição anual = mensal × 12");
      });
      var inf = inflacaoPessoal(MES);
      if (inf) ok(isFinite(inf.taxa), etq + ": inflação pessoal finita", inf.taxa);
      sequencias().forEach(function(s){
        ok(Number.isInteger(s.n) && s.n >= 0, etq + ": sequência com contagem inteira", s.n);
        ok(typeof s.txt === "string" && s.txt.length > 0, etq + ": e com texto");
      });
      var pf = passosFecho(mesShift(MES, -1));
      ok(pf.passos.length === 4, etq + ": o fecho tem quatro passos");
      ok(pf.passos.every(function(x){ return typeof x.d === "string" && !LIXO.test(x.d); }),
         etq + ": e nenhum passo escreve lixo");
      [60, 500, 99999].forEach(function(meta){
        var pc = planoDeCorte(meta);
        if (!pc) return;
        ok(pc.conseguido <= pc.meta + 0.5, etq + ": o corte nunca passa a meta", pc.conseguido);
        ok(pc.linhas.every(function(x){ return x.corte <= x.gasto * CORTE_MAX_FRACAO + 0.01; }),
           etq + ": nem deixa categoria abaixo de metade");
        ok(pc.linhas.every(function(x){ return (x.cat.grupo || "") !== "poupanca"; }),
           etq + ": nem toca na poupança");
        ok(pc.linhas.every(function(x){ return CATS_NAO_CORTAVEIS.indexOf(x.cat.nome) < 0; }),
           etq + ": nem em juros, prestações ou impostos");
      });
    } catch(e){ ok(false, etq + ": insight e rituais não rebentam", e.message); }

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

G("ida e volta pelo disco");
(function(){
  /* Gravar e reler tem de devolver exatamente o mesmo. A comparação é
     feita sobre a *forma canónica* — a que a aplicação grava — porque
     `normalizar` preenche omissões e reordena chaves de propósito. */
  for (var sem = 700; sem < 720; sem++){
    agregadoAleatorio(sem);
    S = normalizar(JSON.parse(JSON.stringify(S)));
    var canonico = JSON.stringify(S);
    var etq = "semente " + sem;

    guardar();
    S = estadoVazio();
    ok(carregar(), etq + ": carregar() encontra o que se gravou");
    ok(JSON.stringify(S) === canonico, etq + ": a forma canónica roda igual");

    // Carregar um estado já atual não o regrava — a migração convergiu
    var disco = localStorage.getItem(STORE_KEY);
    carregar();
    ok(localStorage.getItem(STORE_KEY) === disco, etq + ": reler não regrava sem motivo");

    // E normalizar é ponto fixo
    ok(JSON.stringify(normalizar(JSON.parse(canonico))) === canonico,
       etq + ": normalizar é ponto fixo da forma canónica");
  }
})();

G("desfazer tudo devolve o princípio");
(function(){
  /* A promessa do histórico: seja qual for a sequência de ações, desfazer
     até ao fim devolve o estado inicial — ao byte. As escolhas de
     aparência ficam de fora por opção: não gastam passos do histórico,
     para não empurrarem alterações de dados para fora dos 40 guardados. */
  var APARENCIA = ["tema","paleta","densidade","texto","contraste","ajudas"];
  function semAparencia(x){
    var o = JSON.parse(JSON.stringify(x));
    APARENCIA.forEach(function(k){ delete o[k]; });
    return JSON.stringify(o);
  }
  var PROIBIDOS = ["limpar","importJSON","exportJSON","exportCSV","exportPatrimonioCSV",
                   "imprimir","tutorialIniciar"];
  var vistas = ["painel","despesas","ativos","creditos","objetivos"];

  for (var c = 0; c < 8; c++){
    var sem = 800 + c;
    agregadoAleatorio(sem);
    S = normalizar(JSON.parse(JSON.stringify(S)));
    historico.atras.length = 0; historico.frente.length = 0;
    var inicial = semAparencia(S);
    var etq = "corrida " + sem;
    MES = isoMes(hoje()); ui.secaoDespesa = "plano"; irPara("painel");

    for (var passo = 0; passo < 16; passo++){
      irPara(umDe(vistas));
      var botoes = Array.prototype.slice.call(document.querySelectorAll("#app button"))
        .filter(function(b){ return PROIBIDOS.indexOf(b.dataset.act || "") < 0 && !b.disabled; });
      if (!botoes.length) continue;
      try {
        botoes[esc(botoes.length)].click();
        var sim = document.querySelector('[data-dlg="yes"]'); if (sim) sim.click();
      } catch(e){ /* o macaco já cobre os rebentões; aqui interessa o histórico */ }
      var mh = document.getElementById("modalHost"); if (mh) mh.innerHTML = "";
    }

    var voltas = 0;
    while (podeDesfazer() && voltas < 80){ desfazer(); voltas++; }
    ok(semAparencia(S) === inicial,
       etq + ": desfazer tudo devolve o estado inicial", voltas + " passos desfeitos");

    // Refazer tem de repor tantos passos quantos desfez, e desfazer outra vez converge
    var noFundo = semAparencia(S), frente = 0;
    while (podeRefazer() && frente < 80){ refazer(); frente++; }
    ok(frente === voltas, etq + ": refazer repõe todos os passos", frente + " de " + voltas);
    var v2 = 0;
    while (podeDesfazer() && v2 < 80){ desfazer(); v2++; }
    ok(semAparencia(S) === noFundo, etq + ": a segunda volta de desfazer não diverge");
  }
})();

G("migração de formas antigas e malformadas");
(function(){
  /* O que pode chegar de um ficheiro exportado por uma versão anterior, ou
     de um ficheiro editado à mão. Nada disto deve rebentar, e o resultado
     tem de ser um estado utilizável. */
  var ENTRADAS = [
    {},
    {membros:"não é lista", categorias:{}, movimentos:null, limites:[]},
    {categorias:[]},
    {patrimonio:[{id:"p1", nome:"Casa velha", classe:"imovel", atual:200000}]},
    {investimentos:[{id:"i1", nome:"ETF", classe:"depositos", investido:1000, atual:1200}]},
    {painel:{ocultos:["inexistente","atencao"], ordem:["lixo"], fechados:null}},
    {objetivos:[{id:"o1", nome:"X", alvo:100, atual:50, ativoId:"desaparecido"}]},
    {planeadas:[{id:"pl1", nome:"P", valor:"800", horizonte:99, mes:"2026-13", objetivoId:"não existe"}]},
    {planeadas:"não é lista"},
    {planeadas:[{nome:"sem id"}, null, {id:"ok", nome:"Bom", valor:100}]},
    {fiscal:{ias:"abc", capitais:null}, estrategia:{instrumento:"inventado", mensal:"500"}},
    {projecao:{anos:"abc"}},
    {cenarios:[{nome:"C", cfg:{instrumento:"desconhecido"}}, {semCfg:true}, null]},
    {regrasCategoria:[{padrao:"  "}, {padrao:"luz", categoriaId:5}, null]},
    {paleta:"inexistente", densidade:"gigante", texto:"enorme", contraste:"médio"},
    {version:999, criadoEm:"data inválida", tema:"arco-íris"},
    {recorrenciasIgnoradas:"x", dicasOcultas:{}, tutorialVisto:"sim"},
    {limites:{"cat-inexistente":"abc"}},
    // Campos das funcionalidades novas, malformados
    {notas:{"2026-13":"mês que não existe", "abc":"chave inválida", "2026-06":"   ",
            "2026-05":"boa nota"}},
    {notas:"não é objeto"},
    {notas:{"2026-05": new Array(500).join("x")}},
    {fechados:{"xx":{em:"?"}, "2026-06":{em:"2026-07-01"}, "2026-04":null}},
    {fechados:[1,2,3]},
    {patrimonioHist:[{mes:"2026-13", ativo:1}, {mes:"2026-05", ativo:"abc", divida:null, liquido:NaN},
                     {mes:"2026-05", ativo:2, divida:1, liquido:1}, null, {semMes:true}]},
    {patrimonioHist:"não é lista"},
    {membros:[{id:"m1", nome:"Sem rosto"}, {id:"m2", nome:"Com", icone:"👩", cor:"#fff"}]},
    {recorrentes:[{id:"r1", nome:"Dia impossível", valor:10, frequencia:"mensal", dia:40},
                  {id:"r2", nome:"Dia texto", valor:10, frequencia:"mensal", dia:"abc"},
                  {id:"r3", nome:"Dia zero", valor:10, frequencia:"mensal", dia:0},
                  {id:"r4", nome:"Dia bom", valor:10, frequencia:"mensal", dia:"15"}]},
  ];
  var LISTAS = ["membros","categorias","rendimentos","recorrentes","movimentos",
                "objetivos","creditos","ativos","planeadas","cenarios","regrasCategoria"];
  var vazio = estadoVazio();

  ENTRADAS.forEach(function(d, i){
    var etq = "entrada " + i;
    var st = null;
    try { st = normalizar(JSON.parse(JSON.stringify(d))); }
    catch(e){ ok(false, etq + ": normalizar não rebenta", e.message); return; }
    passes++;   // não rebentou

    LISTAS.forEach(function(k){ ok(Array.isArray(st[k]), etq + ": " + k + " é lista"); });
    ok(st.categorias.length > 0, etq + ": não fica sem categorias");
    ok(st.limites && typeof st.limites === "object" && !Array.isArray(st.limites),
       etq + ": os limites são um mapa, não uma lista");
    ok(!!PALETAS[st.paleta], etq + ": a paleta é válida", st.paleta);
    ok(["conforto","compacta"].indexOf(st.densidade) >= 0, etq + ": densidade válida", st.densidade);
    ok(["normal","grande","maior"].indexOf(st.texto) >= 0, etq + ": tamanho de texto válido", st.texto);
    ok(["normal","alto"].indexOf(st.contraste) >= 0, etq + ": contraste válido", st.contraste);
    ok(!("patrimonio" in st), etq + ": o nome antigo dos ativos desaparece");

    // Os padrões não se perdem por vir um objeto parcial no ficheiro
    Object.keys(vazio.projecao).forEach(function(k){
      ok(st.projecao[k] !== undefined, etq + ": projecao." + k + " tem valor"); });
    Object.keys(vazio.estrategia).forEach(function(k){
      ok(st.estrategia[k] !== undefined, etq + ": estrategia." + k + " tem valor"); });

    st.planeadas.forEach(function(p, j){
      ok(!!p.id, etq + ": planeada " + j + " tem id");
      ok([3,6,12,24].indexOf(p.horizonte) >= 0, etq + ": horizonte saneado", p.horizonte);
      ok(!p.mes || /^\d{4}-(0[1-9]|1[0-2])$/.test(p.mes), etq + ": mês saneado", p.mes);
      ok(typeof p.valor === "number", etq + ": valor numérico", typeof p.valor);
      ok(!p.objetivoId || st.objetivos.some(function(o){ return o.id === p.objetivoId; }),
         etq + ": sem reservas órfãs");
    });
    st.painel.ocultos.concat(st.painel.ordem, st.painel.fechados).forEach(function(k){
      ok(!!CARTOES_PAINEL[k], etq + ": o painel só cita cartões que existem", k); });

    // Os campos das funcionalidades novas saem saneados
    ok(st.notas && typeof st.notas === "object" && !Array.isArray(st.notas),
       etq + ": as notas são um mapa");
    Object.keys(st.notas).forEach(function(m){
      ok(/^\d{4}-(0[1-9]|1[0-2])$/.test(m), etq + ": nota com mês válido", m);
      ok(typeof st.notas[m] === "string" && st.notas[m].trim().length > 0,
         etq + ": nota com texto a sério");
      ok(st.notas[m].length <= NOTA_MAX, etq + ": nota dentro do tecto", st.notas[m].length);
    });
    ok(st.fechados && typeof st.fechados === "object" && !Array.isArray(st.fechados),
       etq + ": os meses fechados são um mapa");
    Object.keys(st.fechados).forEach(function(m){
      ok(/^\d{4}-(0[1-9]|1[0-2])$/.test(m), etq + ": mês fechado válido", m);
      ok(typeof st.fechados[m].em === "string", etq + ": com data de fecho em texto");
    });
    ok(Array.isArray(st.patrimonioHist), etq + ": o histórico do património é lista");
    st.patrimonioHist.forEach(function(x, j){
      ok(/^\d{4}-(0[1-9]|1[0-2])$/.test(x.mes), etq + ": instantâneo com mês válido", x.mes);
      ok(isFinite(x.ativo) && isFinite(x.divida) && isFinite(x.liquido),
         etq + ": instantâneo com números finitos");
      if (j > 0) ok(st.patrimonioHist[j-1].mes < x.mes,
        etq + ": instantâneos por ordem e sem meses repetidos");
    });
    st.membros.forEach(function(mb){
      ok(!!mb.icone && !!mb.cor, etq + ": todo o membro sai com rosto e cor");
    });
    st.recorrentes.forEach(function(rc){
      ok(rc.dia === "" || (Number.isInteger(rc.dia) && rc.dia >= 1 && rc.dia <= 31),
         etq + ": o dia da rubrica é vazio ou 1–31", rc.dia);
    });

    // E tem de renderizar
    S = st; limparCacheCredito(); MES = isoMes(hoje());
    VISTAS_TODAS.forEach(function(v){
      try {
        irPara(v);
        ok(!LIXO.test(document.getElementById("app").innerText), etq + " " + v + ": sem lixo no ecrã");
      } catch(e){ ok(false, etq + " " + v + ": renderiza", e.message); }
    });
  });
})();

G("aparência: paletas, densidade, texto e contraste");
(function(){
  /* Toda a matriz de aparência, em todas as vistas: nada transborda na
     horizontal e nada escreve lixo. Um transbordo aqui é o género de coisa
     que só aparece na combinação — texto «maior» com densidade compacta
     numa paleta de contraste alto. */
  agregadoAleatorio(900);
  S.painel.ocultos = [];
  var paletas = Object.keys(PALETAS);
  var combinacoes = 0;
  /* Medir transbordo numa janela sem largura não quer dizer nada: qualquer
     conteúdo «transborda» zero pixels. Acontece quando a página corre num
     separador oculto ou num painel recolhido — aí verifica-se só que
     renderiza e não escreve lixo, e diz-se que a medida ficou de fora. */
  var podeMedir = window.innerWidth > 100;
  ok(true, podeMedir
    ? "a janela tem largura para medir transbordos ("+window.innerWidth+"px)"
    : "janela sem largura ("+window.innerWidth+"px): a medida de transbordo fica de fora");
  paletas.forEach(function(pal){
    ["conforto","compacta"].forEach(function(den){
      ["normal","grande","maior"].forEach(function(txt){
        ["normal","alto"].forEach(function(con){
          S.paleta = pal; S.densidade = den; S.texto = txt; S.contraste = con;
          var etq = pal + "/" + den + "/" + txt + "/" + con;
          try { aplicarTema(); } catch(e){ ok(false, etq + ": aplicarTema", e.message); return; }
          VISTAS_TODAS.forEach(function(v){
            if (v === "despesas") ui.secaoDespesa = "planear";
            try { irPara(v); } catch(e){ ok(false, etq + " " + v + ": renderiza", e.message); return; }
            if (podeMedir)
              ok(document.documentElement.scrollWidth <= window.innerWidth + 1,
                 etq + " " + v + ": não transborda na horizontal",
                 document.documentElement.scrollWidth + " > " + window.innerWidth);
            ok(!LIXO.test(document.getElementById("app").innerText), etq + " " + v + ": sem lixo no ecrã");
          });
          combinacoes++;
        });
      });
    });
  });
  ok(combinacoes === paletas.length * 2 * 3 * 2,
     "percorreu a matriz de aparência inteira", combinacoes + " combinações");
  S.paleta = "meianoite"; S.densidade = "conforto"; S.texto = "normal"; S.contraste = "normal";
  try { aplicarTema(); } catch(e){}
})();

/* Repor o que era do utilizador */
S = estadoVazio();
if (backup){ try { S = normalizar(JSON.parse(backup)); } catch(e){} localStorage.setItem(STORE_KEY, backup); }
else localStorage.removeItem(STORE_KEY);
if (backupSessao) localStorage.setItem(SESSAO_KEY, backupSessao);
else localStorage.removeItem(SESSAO_KEY);
limparCacheCredito();
MES = mesInicial; VIEW = vistaInicial;
/* O contexto volátil também é do utilizador. O macaco carrega em tudo, e
   ações como «ver movimento» de uma compra planeada escrevem no filtro de
   texto — sem isto, quem corresse a suite ficava com a lista filtrada pelo
   nome de uma compra inventada ao acaso. */
filtros.texto = filtrosIniciais.texto; filtros.categoria = filtrosIniciais.categoria;
filtros.membro = filtrosIniciais.membro; filtros.tipo = filtrosIniciais.tipo;
editando = {};
ui.relatorio = false; ui.simAtivo = null; ui.donutFoco = null; ui.movSel = {};
ui.essencial = false; ui.privado = false; ui.fechoDispensado = null;
ui.corteAlvo = 0; ui.corteAjustes = {}; ui.planPrefill = null;
ui.secaoDespesa = secaoInicial;
ui.secaoEstrategia = secaoEstrInicial;
document.body.classList.remove("privado");
var _mh = document.getElementById("modalHost"); if (_mh) _mh.innerHTML = "";
var _pl = document.getElementById("paleta"); if (_pl) _pl.innerHTML = "";
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
