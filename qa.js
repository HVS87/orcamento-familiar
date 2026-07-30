/* ============================================================
   Suite de QA do Orçamento Familiar

   Carregue-a na aplicação (por exemplo pela consola:
     var s=document.createElement("script"); s.src="/qa.js"; document.head.appendChild(s);
   ) e leia o resultado em window.__QA.

   Não é código de produção: existe para provar que os cálculos
   fazem o que dizem fazer, e para o dizer alto quando não fazem.
   ============================================================ */
(function(){
"use strict";

var falhas = [], passes = 0, grupo = "";
var EPS = 0.005;

function G(nome){ grupo = nome; }
function ok(cond, nome, detalhe){
  if (cond) { passes++; return true; }
  falhas.push({grupo: grupo, teste: nome, detalhe: detalhe == null ? "" : String(detalhe)});
  return false;
}
function eq(a, b, nome, eps){
  var e = eps == null ? EPS : eps;
  var bom = (typeof a === "number" && typeof b === "number")
    ? Math.abs(a - b) <= e
    : a === b;
  return ok(bom, nome, "obtido " + JSON.stringify(a) + ", esperado " + JSON.stringify(b));
}
function finito(v, nome){
  return ok(typeof v === "number" && isFinite(v) && !isNaN(v), nome, "valor: " + v);
}
function lanca(fn, nome){
  try { fn(); ok(false, nome, "não lançou"); }
  catch(e){ passes++; }
}
function semLancar(fn, nome){
  try { fn(); passes++; return true; }
  catch(e){ ok(false, nome, "lançou: " + e.message); return false; }
}

/* Estado do utilizador, para o devolver intacto no fim.
   Os testes correm sobre um estado vazio e determinístico — nunca sobre
   o que estivesse carregado, para que a ordem de execução não importe.

   Guarda-se o que está *em disco*, e não só o que está em memória: há
   grupos que chamam `carregarExemplo()`, e essa função grava. Repor só a
   variável `S` deixava o exemplo escrito no localStorage — quem tivesse
   um orçamento a sério e recarregasse a página antes de mexer em alguma
   coisa encontrava o exemplo no lugar dele. */
var estadoUtilizador = JSON.parse(JSON.stringify(S));
var discoEstado = localStorage.getItem(STORE_KEY);
var discoSessao = localStorage.getItem(SESSAO_KEY);
var vistaInicial = VIEW, mesInicial = MES;

/* E a sessão sai de cena enquanto se testa: um rascunho por recuperar
   abriria o diálogo por cima dos testes. */
localStorage.removeItem(SESSAO_KEY);
function reporEstado(){ S = estadoVazio(); limparCacheCredito(); MES = isoMes(hoje()); }

/* ============================================================
   1. Utilitários numéricos e de data
   ============================================================ */
G("parseNum");
eq(parseNum("20.000"), 20000, "milhares com ponto");
eq(parseNum("1.234,56"), 1234.56, "pt-PT completo");
eq(parseNum("1234.56"), 1234.56, "decimal com ponto");
eq(parseNum("20,5"), 20.5, "decimal com vírgula");
eq(parseNum("20.5"), 20.5, "ponto decimal sem milhares");
eq(parseNum("1.234.567"), 1234567, "dois grupos de milhares");
eq(parseNum("-50,25"), -50.25, "negativo");
eq(parseNum("+30"), 30, "positivo explícito");
eq(parseNum(""), 0, "vazio");
eq(parseNum(null), 0, "nulo");
eq(parseNum(undefined), 0, "indefinido");
eq(parseNum("abc"), 0, "texto");
eq(parseNum("3 500,00"), 3500, "espaço como separador");
eq(parseNum("1.000 €"), 1000, "com símbolo de euro");
eq(parseNum(42), 42, "número passa direto");
eq(parseNum(NaN), 0, "NaN vira zero");
eq(parseNum(Infinity), 0, "infinito vira zero");
eq(parseNum("1.23"), 1.23, "ponto decimal com dois dígitos");
eq(parseNum("12.345"), 12345, "grupo de três é milhares");

G("aritmética de meses");
eq(mesShift("2026-01", 1), "2026-02", "avança um mês");
eq(mesShift("2026-12", 1), "2027-01", "transição de ano");
eq(mesShift("2026-01", -1), "2025-12", "recua sobre o ano");
eq(mesShift("2026-06", 12), "2027-06", "doze meses");
eq(mesShift("2026-03", -15), "2024-12", "recuo longo");
eq(mesDiff("2026-01", "2026-01"), 0, "mesmo mês");
eq(mesDiff("2026-01", "2027-01"), 12, "um ano");
eq(mesDiff("2027-01", "2026-01"), -12, "negativo");
eq(mesDiff("2025-11", "2026-02"), 3, "atravessa o ano");
eq(mesDoDia("2026-07-15"), "2026-07", "mês de um dia");
eq(mesLabel("2026-07"), "julho de 2026", "rótulo longo");
eq(mesLabel("2026-07", true), "jul/26", "rótulo curto");
eq(mesLabel(""), "—", "mês vazio");

G("frequências");
eq(freqFator("mensal"), 1, "mensal");
eq(freqFator("anual"), 1/12, "anual");
eq(freqFator("catorze"), 14/12, "catorze meses");
eq(freqFator("bimestral"), 0.5, "bimestral");
eq(freqFator("semestral"), 1/6, "semestral");
eq(freqFator("desconhecida"), 1, "desconhecida cai em mensal");
(function(){
  var soma = 0;
  Object.keys(FREQ).forEach(function(k){ soma += FREQ[k].f; });
  ok(soma > 0 && isFinite(soma), "todas as frequências são finitas", soma);
})();

/* ============================================================
   2. Crédito — tabela de amortização
   ============================================================ */
G("crédito de taxa fixa");
(function(){
  reporEstado();
  var cr = {id:"t1", nome:"Teste", capital:145000, prazoMeses:360, inicio:"2024-01-01",
            tipoTaxa:"fixa", taxaAnual:3.4, seguroMensal:0};
  S.creditos = [cr];
  limparCacheCredito();
  var t = tabelaCredito(cr);

  eq(t.length, 360, "uma linha por prestação");

  // Fórmula fechada da prestação constante
  var i = 3.4/100/12, n = 360, C = 145000;
  var A = C*i/(1 - Math.pow(1+i, -n));
  eq(t[0].prestacao, A, "prestação bate com a fórmula fechada", 0.01);

  // Identidades da tabela
  var somaCapital = 0, somaJuros = 0;
  for (var k = 0; k < t.length; k++){ somaCapital += t[k].capital; somaJuros += t[k].juros; }
  eq(somaCapital, C, "o capital amortizado soma ao capital mutuado", 0.5);
  eq(t[t.length-1].saldo, 0, "termina sem dívida", 0.01);
  ok(somaJuros > 0, "há juros a pagar", somaJuros);
  eq(jurosTotais(cr), somaJuros, "jurosTotais bate com a soma da tabela", 0.5);

  // Juros de cada período = saldo anterior × taxa mensal
  eq(t[0].juros, C*i, "juros da primeira prestação", 0.01);
  eq(t[1].juros, t[0].saldo*i, "juros da segunda prestação", 0.01);
  eq(t[100].juros, t[99].saldo*i, "juros a meio do prazo", 0.01);

  // A prestação é constante numa taxa fixa
  eq(t[0].prestacao, t[200].prestacao, "prestação constante", 0.01);

  // O capital amortizado cresce e os juros descem
  ok(t[300].capital > t[0].capital, "amortização cresce ao longo do prazo");
  ok(t[300].juros < t[0].juros, "juros descem ao longo do prazo");

  // custoTotalCredito
  eq(custoTotalCredito(cr), C + somaJuros, "custo total sem seguros", 0.5);
  cr.seguroMensal = 10;
  eq(custoTotalCredito(cr), C + somaJuros + 10*360, "custo total com seguros", 0.5);
  cr.seguroMensal = 0;
})();

G("crédito sem juros e casos-limite");
(function(){
  reporEstado();
  var cr = {id:"t2", capital:12000, prazoMeses:12, inicio:"2026-01-01", tipoTaxa:"fixa", taxaAnual:0};
  var t = tabelaCredito(cr);
  eq(t[0].prestacao, 1000, "taxa zero: capital a dividir pelo prazo");
  eq(t[0].juros, 0, "taxa zero não gera juros");
  eq(t[11].saldo, 0, "liquida no fim");

  eq(tabelaCredito({id:"t3", capital:0, prazoMeses:120, tipoTaxa:"fixa", taxaAnual:3}).length, 0, "capital zero dá tabela vazia");
  eq(tabelaCredito({id:"t4", capital:1000, prazoMeses:0, tipoTaxa:"fixa", taxaAnual:3}).length, 0, "prazo zero dá tabela vazia");
  eq(jurosTotais({id:"t5", capital:0, prazoMeses:0, tipoTaxa:"fixa", taxaAnual:0}), 0, "sem crédito não há juros");
})();

G("crédito de taxa variável");
(function(){
  reporEstado();
  var cr = {id:"v1", capital:100000, prazoMeses:240, inicio:"2026-01-01",
            tipoTaxa:"variavel", indexante:"euribor6m", indexanteValor:2.4, spread:1.0,
            revisaoMeses:"", seguroMensal:0};
  S.creditos = [cr];
  MES = "2026-01";
  limparCacheCredito();

  eq(taxaCorrente(cr), 3.4, "taxa corrente = indexante + spread");
  eq(revisaoCredito(cr), 6, "revisão herdada do indexante");
  cr.revisaoMeses = 12;
  eq(revisaoCredito(cr), 12, "revisão explícita prevalece");
  cr.revisaoMeses = "";
  limparCacheCredito();

  var t0 = tabelaCredito(cr, 0);
  var somaCapital = 0;
  for (var k = 0; k < t0.length; k++) somaCapital += t0[k].capital;
  eq(somaCapital, 100000, "capital amortizado soma ao mutuado", 0.5);
  eq(t0[t0.length-1].saldo, 0, "liquida no fim", 0.01);

  // Sem choque, a taxa não muda ao longo do prazo
  eq(t0[0].taxa, t0[100].taxa, "sem choque a taxa mantém-se");

  // Com choque, a prestação sobe e os juros aumentam
  var t2 = tabelaCredito(cr, 2);
  ok(t2[0].taxa === 5.4, "choque aplicado desde o mês corrente: " + t2[0].taxa);
  ok(t2[0].prestacao > t0[0].prestacao, "prestação sobe com o choque");
  ok(jurosTotais(cr, 2) > jurosTotais(cr, 0), "juros totais sobem com o choque");
  var somaCapital2 = 0;
  for (var j = 0; j < t2.length; j++) somaCapital2 += t2[j].capital;
  eq(somaCapital2, 100000, "com choque o capital continua a somar ao mutuado", 0.5);

  // Choque negativo desce a prestação
  var tn = tabelaCredito(cr, -1);
  ok(tn[0].prestacao < t0[0].prestacao, "choque negativo baixa a prestação");

  // Um crédito de taxa fixa ignora o choque
  var fixo = {id:"v2", capital:100000, prazoMeses:240, inicio:"2026-01-01", tipoTaxa:"fixa", taxaAnual:3.4};
  eq(tabelaCredito(fixo, 3)[0].prestacao, tabelaCredito(fixo, 0)[0].prestacao,
     "taxa fixa não reage ao choque", 0.001);

  // O choque não é retroativo: só a partir do mês em análise
  cr.inicio = "2020-01-01"; MES = "2026-01"; limparCacheCredito();
  var tr = tabelaCredito(cr, 2);
  eq(tr[0].taxa, 3.4, "prestações anteriores ao mês em análise mantêm a taxa antiga");
  var kChoque = mesDiff("2020-01", "2026-01");
  ok(tr[kChoque].taxa === 5.4, "a taxa muda a partir do mês em análise: " + tr[kChoque].taxa);
})();

G("estado do crédito ao longo do tempo");
(function(){
  reporEstado();
  var cr = {id:"e1", capital:12000, prazoMeses:12, inicio:"2026-01-01", tipoTaxa:"fixa", taxaAnual:0, seguroMensal:5};
  S.creditos = [cr]; MES = "2026-06"; limparCacheCredito();

  ok(creditoAtivo(cr, "2026-01"), "ativo no primeiro mês");
  ok(creditoAtivo(cr, "2026-12"), "ativo no último mês");
  ok(!creditoAtivo(cr, "2025-12"), "inativo antes do início");
  ok(!creditoAtivo(cr, "2027-01"), "inativo depois do fim");

  eq(pagasAte(cr, "2026-01"), 1, "uma prestação paga no primeiro mês");
  eq(pagasAte(cr, "2026-06"), 6, "seis a meio");
  eq(pagasAte(cr, "2027-06"), 12, "não passa do prazo");
  eq(pagasAte(cr, "2025-01"), 0, "zero antes do início");

  eq(saldoDevedorMes(cr, "2026-06"), 6000, "metade paga, metade em dívida");
  eq(saldoDevedorMes(cr, "2026-12"), 0, "liquidado no fim");
  eq(saldoDevedorMes(cr, "2025-06"), 12000, "antes do início deve tudo");
  eq(saldoDevedorMes(cr, "2030-01"), 0, "muito depois do fim não deve nada");

  var p = parcelaMes(cr, "2026-06");
  ok(p !== null, "há parcela no mês ativo");
  eq(p.juros + p.capital, p.prestacao, "prestação = juros + capital");
  eq(p.total, p.prestacao + 5, "total inclui o seguro");
  eq(parcelaMes(cr, "2030-01"), null, "sem parcela fora do prazo");
  eq(encargoCredito(cr, "2030-01"), 0, "encargo nulo fora do prazo");

  // Mapa anual
  var anos = amortizacaoAnual(cr);
  eq(anos.length, 1, "doze meses cabem num ano civil");
  eq(anos[0].capital, 12000, "o ano soma todo o capital", 0.5);
})();

/* ============================================================
   3. TIR e retorno obtido
   ============================================================ */
G("TIR");
(function(){
  var d = 86400000;
  var t0 = Math.round(Date.UTC(2020,0,1)/d);
  var umAno = Math.round(365.25);

  eq(tir([{t:t0, v:-1000}, {t:t0+umAno, v:1100}]), 10, "10% num ano", 0.05);
  eq(tir([{t:t0, v:-1000}, {t:t0+2*umAno, v:1210}]), 10, "10% em dois anos", 0.05);
  eq(tir([{t:t0, v:-1000}, {t:t0+umAno, v:1000}]), 0, "sem ganho, 0%", 0.05);
  ok(tir([{t:t0, v:-1000}, {t:t0+umAno, v:900}]) < 0, "perda dá TIR negativa");

  // Vários aportes: a TIR fica entre os extremos plausíveis
  var r = tir([{t:t0, v:-1000}, {t:t0+umAno, v:-1000}, {t:t0+2*umAno, v:2200}]);
  ok(r > 0 && r < 20, "TIR de série com reforço é plausível: " + r);

  // Degenerados
  eq(tir([{t:t0, v:-1000}]), null, "um só fluxo não tem TIR");
  eq(tir([{t:t0, v:-1000}, {t:t0+umAno, v:-500}]), null, "só saídas não tem TIR");
  eq(tir([{t:t0, v:1000}, {t:t0+umAno, v:500}]), null, "só entradas não tem TIR");
  eq(tir([]), null, "série vazia");
  eq(tir(null), null, "série nula");

  // VPL à TIR é aproximadamente zero — a definição
  var fl = [{t:t0, v:-5000}, {t:t0+umAno, v:-2000}, {t:t0+3*umAno, v:8500}];
  var taxa = tir(fl);
  ok(Math.abs(vpl(fl, taxa/100)) < 0.01, "o VPL à TIR anula-se: " + vpl(fl, taxa/100));
})();

G("retorno obtido de um ativo");
(function(){
  reporEstado();
  // Sem aportes: cai no CAGR
  var a = {id:"a1", classe:"etf", aquisicao:10000, atual:14641,
           dataAquisicao: mesShift(isoMes(hoje()), -48) + "-01", aportes:[]};
  var r = retornoObtido(a);
  ok(r && r.metodo === "CAGR", "sem aportes usa CAGR");
  eq(r.taxa, 10, "CAGR de 10% em quatro anos", 0.2);

  // Histórico curto não é fiável
  var curto = {id:"a2", classe:"etf", aquisicao:1000, atual:1100,
               dataAquisicao: mesShift(isoMes(hoje()), -2) + "-01", aportes:[]};
  eq(retornoObtido(curto), null, "menos de seis meses não devolve retorno");

  // Com aportes datados: passa a TIR
  var comAportes = {id:"a3", classe:"etf", aquisicao:10000, atual:12000, aportes:[
    {id:"x1", data: mesShift(isoMes(hoje()), -36) + "-01", valor:5000},
    {id:"x2", data: mesShift(isoMes(hoje()), -12) + "-01", valor:5000}
  ], dataAquisicao: mesShift(isoMes(hoje()), -36) + "-01"};
  var r2 = retornoObtido(comAportes);
  ok(r2 && r2.metodo === "TIR", "com aportes usa TIR");
  eq(r2.n, 2, "conta os aportes");

  // A TIR castiga o reforço tardio face ao CAGR ingénuo
  var tardio = {id:"a4", classe:"etf", aquisicao:10000, atual:11000, aportes:[
    {id:"y1", data: mesShift(isoMes(hoje()), -36) + "-01", valor:1000},
    {id:"y2", data: mesShift(isoMes(hoje()), -1) + "-01", valor:9000}
  ], dataAquisicao: mesShift(isoMes(hoje()), -36) + "-01"};
  var rt = retornoObtido(tardio);
  var cagrIngenuo = (Math.pow(11000/10000, 1/3) - 1) * 100;
  ok(rt.taxa > cagrIngenuo, "TIR reconhece que o dinheiro esteve pouco tempo aplicado: " +
     rt.taxa.toFixed(2) + " vs CAGR " + cagrIngenuo.toFixed(2));

  eq(retornoObtido({id:"a5", classe:"etf", aquisicao:0, atual:0, aportes:[]}), null, "ativo vazio não tem retorno");
})();

/* ============================================================
   4. Fiscalidade
   ============================================================ */
G("valores fiscais portugueses");
(function(){
  var f = FISCAL_PADRAO;
  eq(f.ssTrabalhador, 11, "TSU do trabalhador por conta de outrem");
  eq(f.ssIndependente, 21.4, "TSU dos independentes");
  eq(f.capitais, 28, "taxa liberatória sobre capitais");
  eq(f.rendas, 25, "categoria F, habitação até 5 anos");
  // Portaria n.º 51-B/2026/1, com efeitos a 1 de janeiro de 2026
  eq(f.subsAlimIsento, 6.15, "subsídio de alimentação em numerário");
  eq(f.subsAlimCartao, 10.46, "subsídio de alimentação em cartão");
  // O limite em cartão é 70% acima do de numerário
  ok(Math.abs(f.subsAlimCartao - f.subsAlimIsento * 1.7) < 0.01,
     "o limite em cartão é 1,7× o de numerário", f.subsAlimIsento * 1.7);
  eq(f.pprBeneficio, 20, "dedução à coleta do PPR");
  eq(f.pprSaida, 8, "PPR: taxa à saída nas condições");
  eq(f.pprSaidaFora, 21.5, "PPR: taxa fora das condições");
  eq(f.ano, 2026, "ano de referência declarado");
  eq(f.rendaModerada, 10, "renda moderada da Lei n.º 9-A/2026");
  eq(f.limiteRendaModerada, 2300, "teto da renda moderada");
  ok(f.imiTaxa >= 0.3 && f.imiTaxa <= 0.45, "IMI dentro do intervalo legal: " + f.imiTaxa);
  eq(f.imiTaxa, 0.30, "IMI por omissão na taxa mínima, a mais comum nos municípios");
  // O ano das outras taxas coincide com o das tabelas de retenção
  eq(f.ano, TABELAS_RF._meta.ano, "todas as taxas se referem ao mesmo ano");

  eq(LIMITES_LEGAIS.imiTaxa.min, 0.3, "limite inferior do IMI urbano");
  eq(LIMITES_LEGAIS.imiTaxa.max, 0.45, "limite superior do IMI urbano");

  eq(REGIMES_SS.dependente.taxa, 11, "regime dependente");
  eq(REGIMES_SS.independente.taxa, 21.4, "regime independente");
  eq(REGIMES_SS.pensao.taxa, 0, "pensões não contribuem");
})();

G("tabelas oficiais de retenção na fonte");
(function(){
  reporEstado();
  eq(TABELAS_RF._meta.ano, 2026, "ano das tabelas");

  var regioes = Object.keys(TABELAS_RF.regioes);
  eq(regioes.length, 3, "três regiões fiscais");
  ok(regioes.indexOf("continente") >= 0, "Continente");
  ok(regioes.indexOf("acores") >= 0, "Açores");
  ok(regioes.indexOf("madeira") >= 0, "Madeira");

  regioes.forEach(function(reg){
    var R = TABELAS_RF.regioes[reg];
    ok(R.lbl && R.lbl.length > 3, reg + ": tem rótulo");
    ok(/\.xlsx$/.test(R.fonte), reg + ": declara o ficheiro de origem", R.fonte);

    var chaves = Object.keys(R.t);
    eq(chaves.length, 11, reg + ": onze tabelas");
    eq(chaves.filter(function(k){ return R.t[k].cat === "A"; }).length, 7, reg + ": sete de trabalho dependente");
    eq(chaves.filter(function(k){ return R.t[k].cat === "H"; }).length, 4, reg + ": quatro de pensões");

    // Coerência estrutural de cada tabela
    chaves.forEach(function(k){
      var t = R.t[k];
      ok(t.e.length >= 6, reg + "/" + k + ": tem escalões", t.e.length);
      ok(t.e[t.e.length-1].sup === 1, reg + "/" + k + ": o último escalão é «superior a»");
      eq(t.e.filter(function(x){ return x.sup; }).length, 1, reg + "/" + k + ": só um «superior a»");
      eq(t.e[0].t, 0, reg + "/" + k + ": o primeiro escalão não retém");
      for (var i = 1; i < t.e.length - 1; i++){
        ok(t.e[i].a > t.e[i-1].a, reg + "/" + k + ": limites crescentes no escalão " + i,
           t.e[i-1].a + " → " + t.e[i].a);
      }
      for (var j = 1; j < t.e.length; j++){
        ok(t.e[j].t >= t.e[j-1].t - 1e-9, reg + "/" + k + ": taxa não decresce no escalão " + j,
           t.e[j-1].t + " → " + t.e[j].t);
        ok(t.e[j].t >= 0 && t.e[j].t < 1, reg + "/" + k + ": taxa entre 0 e 1 no escalão " + j, t.e[j].t);
      }
      if (t.dep){
        var deps = t.e.slice(1).map(function(x){ return x.d; });
        ok(deps.every(function(d){ return d === deps[0]; }),
           reg + "/" + k + ": parcela por dependente constante", deps.join(","));
      }
    });
  });

  /* A prova decisiva: cada ficheiro publica a taxa efetiva no limite de
     cada escalão. Recalculá-la com a fórmula e comparar valida, de uma só
     vez, a transcrição dos números e a implementação da fórmula — em todas
     as tabelas de todas as regiões. */
  /* Uma exceção conhecida, e documentada em vez de escondida:
     nos Açores, Tabela VII, escalão «até 6916 €», a taxa efetiva publicada
     (9,8%) é INFERIOR à do escalão anterior (9,9%) — impossível numa tabela
     progressiva. A taxa marginal (20,17%) e a parcela a abater (702,75 €)
     publicadas dão 10,009%. O cálculo segue a taxa e a parcela, que são o
     que a lei manda aplicar; a coluna da taxa efetiva é meramente
     informativa. Se uma versão corrigida do ficheiro chegar, este teste
     falha e avisa. */
  var EXCECOES_EF = [
    {reg:"acores", tab:"VII", i:3,
     motivo:"taxa efetiva publicada inconsistente com a taxa marginal e a parcela"}
  ];
  function excecao(reg, k, i){
    return EXCECOES_EF.some(function(e){ return e.reg === reg && e.tab === k && e.i === i; });
  }

  var conferidos = 0, discrepantes = [];
  regioes.forEach(function(reg){
    var R = TABELAS_RF.regioes[reg];
    Object.keys(R.t).forEach(function(k){
      R.t[k].e.forEach(function(x, i){
        if (x.ef == null || x.sup) return;
        var calculada = taxaRF(x.a, k, 0, reg) / 100;
        var bate = Math.abs(calculada - x.ef) <= 0.0006;
        if (excecao(reg, k, i)){
          ok(!bate, reg + "/" + k + " escalão " + i + ": exceção conhecida continua a divergir",
             "se passou a bater, o ficheiro foi corrigido — retire a exceção");
          discrepantes.push(reg + "/" + k + "#" + i);
          return;
        }
        conferidos++;
        ok(bate, reg + "/" + k + " escalão " + i + " (até " + x.a + "): taxa efetiva bate com a publicada",
           "calculada " + (calculada*100).toFixed(3) + "% vs publicada " + (x.ef*100).toFixed(1) + "%");
      });
    });
  });
  ok(conferidos > 250, "conferidos os escalões das três regiões: " + conferidos);
  ok(discrepantes.length === EXCECOES_EF.length,
     "só as exceções documentadas divergem", discrepantes.join(", "));

  /* A taxa efetiva publicada nunca desce de escalão para escalão — exceto
     na linha já documentada. É a mesma verificação, vista pelo outro lado. */
  regioes.forEach(function(reg){
    var R = TABELAS_RF.regioes[reg];
    Object.keys(R.t).forEach(function(k){
      var anterior = -1;
      R.t[k].e.forEach(function(x, i){
        if (x.ef == null || x.sup) return;
        if (!excecao(reg, k, i)){
          ok(x.ef >= anterior - 1e-9, reg + "/" + k + ": taxa efetiva publicada não desce no escalão " + i,
             anterior + " → " + x.ef);
        }
        anterior = x.ef;
      });
    });
  });

  /* As Regiões Autónomas retêm menos do que o Continente. */
  [1200, 2000, 3500, 8000].forEach(function(R){
    var c = retencaoRF(R, "I", 0, "continente");
    var a = retencaoRF(R, "I", 0, "acores");
    var m = retencaoRF(R, "I", 0, "madeira");
    ok(a <= c + 0.01, "Açores não retêm mais que o Continente a " + R + " €: " + a.toFixed(2) + " vs " + c.toFixed(2));
    ok(m <= c + 0.01, "Madeira não retém mais que o Continente a " + R + " €: " + m.toFixed(2) + " vs " + c.toFixed(2));
  });
  ok(retencaoRF(2000, "I", 0, "acores") < retencaoRF(2000, "I", 0, "continente"),
     "e a diferença é real, não empate");

  /* A região em vigor é respeitada por omissão. */
  S.fiscal.regiao = "madeira";
  eq(retencaoRF(2000, "I", 0), retencaoRF(2000, "I", 0, "madeira"), "usa a região definida no estado");
  eq(regiaoRF(), "madeira", "regiaoRF devolve a região em vigor");
  S.fiscal.regiao = "inexistente";
  eq(regiaoRF(), "continente", "região inválida cai no Continente");
  S.fiscal.regiao = "continente";
  eq(tabRF("I").nome, "Tabela I", "tabRF resolve na região em vigor");
  eq(tabRF("INEXISTENTE"), undefined, "tabela inexistente devolve indefinido");

  /* Casos trabalhados à mão sobre a Tabela I do Continente */
  S.fiscal.regiao = "continente";
  eq(retencaoRF(900, "I", 0), 0, "abaixo do mínimo não há retenção");
  eq(retencaoRF(920, "I", 0), 0, "no limite do primeiro escalão ainda é zero");
  // 1000 € cai no escalão «até 1042»: parcela = 0,125 × 2,6 × (1273,85 − 1000)
  eq(retencaoRF(1000, "I", 0), 1000*0.125 - 0.125*2.6*(1273.85-1000), "escalão de parcela variável", 0.01);
  // 2000 € cai no escalão «até 2119», taxa 0,311, parcela 320,66
  eq(retencaoRF(2000, "I", 0), 2000*0.311 - 320.66, "escalão de parcela fixa", 0.01);
  // Dependentes abatem 21,43 cada
  eq(retencaoRF(2000, "I", 2), 2000*0.311 - 320.66 - 2*21.43, "dois dependentes abatem", 0.01);
  // Acima do último limite aplica-se o escalão «superior a»
  eq(retencaoRF(30000, "I", 0), 30000*0.4717 - 1272.31, "escalão superior", 0.01);

  ok(retencaoRF(950, "I", 5) >= 0, "muitos dependentes não geram retenção negativa");
  eq(retencaoRF(0, "I", 0), 0, "remuneração zero");
  eq(retencaoRF(-500, "I", 0), 0, "remuneração negativa");
  eq(retencaoRF(1000, "INEXISTENTE", 0), 0, "tabela inexistente devolve zero");

  // A retenção cresce com a remuneração, sem saltos para trás — em todas
  // as tabelas de todas as regiões. Uma inversão indicaria um escalão mal
  // transcrito, e é o tipo de erro que passa despercebido a olho.
  Object.keys(TABELAS_RF.regioes).forEach(function(reg){
    Object.keys(TABELAS_RF.regioes[reg].t).forEach(function(k){
      var anterior = -1, mono = true, ondeQuebra = 0;
      for (var R = 300; R <= 30000; R += 97){
        var r = retencaoRF(R, k, 0, reg);
        if (r < anterior - 0.01) { mono = false; ondeQuebra = R; break; }
        anterior = r;
      }
      ok(mono, reg + "/" + k + ": a retenção nunca desce quando a remuneração sobe",
         ondeQuebra ? "quebra aos " + ondeQuebra + " €" : "");

      var excede = false, ondeExcede = 0;
      for (var R2 = 100; R2 <= 30000; R2 += 211){
        if (retencaoRF(R2, k, 0, reg) > R2) { excede = true; ondeExcede = R2; break; }
      }
      ok(!excede, reg + "/" + k + ": a retenção nunca ultrapassa a remuneração",
         ondeExcede ? "excede aos " + ondeExcede + " €" : "");
    });
  });
})();

G("escolha da tabela pela situação familiar");
(function(){
  reporEstado();
  eq(tabelaRF("A", "nao_casado", 0, false), "I", "não casado sem dependentes");
  eq(tabelaRF("A", "nao_casado", 2, false), "II", "não casado com dependentes");
  eq(tabelaRF("A", "casado_2", 0, false), "I", "casado dois titulares");
  eq(tabelaRF("A", "casado_2", 3, false), "I", "casado dois titulares com dependentes");
  eq(tabelaRF("A", "casado_1", 0, false), "III", "casado único titular");
  eq(tabelaRF("A", "casado_1", 2, false), "III", "casado único titular com dependentes");

  eq(tabelaRF("A", "nao_casado", 0, true), "IV", "deficiência, sem dependentes");
  eq(tabelaRF("A", "nao_casado", 1, true), "V", "deficiência, não casado com dependentes");
  eq(tabelaRF("A", "casado_2", 0, true), "IV", "deficiência, casado dois titulares sem dependentes");
  eq(tabelaRF("A", "casado_2", 1, true), "VI", "deficiência, casado dois titulares com dependentes");
  eq(tabelaRF("A", "casado_1", 0, true), "VII", "deficiência, casado único titular");

  eq(tabelaRF("H", "nao_casado", 0, false), "VIII", "pensão, não casado");
  eq(tabelaRF("H", "casado_2", 0, false), "VIII", "pensão, casado dois titulares");
  eq(tabelaRF("H", "casado_1", 0, false), "IX", "pensão, casado único titular");
  eq(tabelaRF("H", "nao_casado", 0, true), "X", "pensão com deficiência");
  eq(tabelaRF("H", "casado_1", 0, true), "XI", "pensão com deficiência, único titular");

  eq(tabelaRF("A", "estado-inexistente", 0, false), "I", "estado civil inválido cai no não casado");

  // As tabelas de pensões não abatem por dependente, em nenhuma região
  Object.keys(TABELAS_RF.regioes).forEach(function(reg){
    eq(retencaoRF(2000, "VIII", 3, reg), retencaoRF(2000, "VIII", 0, reg),
       reg + ": pensões não abatem por dependente");
    ok(TABELAS_RF.regioes[reg].t.X.dep === "fa",
       reg + ": tabela X tem parcela de Deficiente das Forças Armadas");
    eq(retencaoRF(2500, "X", 1, reg), retencaoRF(2500, "X", 0, reg),
       reg + ": essa parcela não é por dependente");
  });
})();

G("retenção aplicada a uma fonte de rendimento");
(function(){
  reporEstado();
  S.fiscal = Object.assign({}, FISCAL_PADRAO, {modoIRS:"tabela", estadoCivil:"nao_casado", dependentes:0});
  var cp = function(e,v,f){ return {id:e+v, especie:e, nome:e, valor:v, frequencia:f, categoriaId:"", ss:null, irs:null}; };

  // Só vencimento mensal: a tabela aplica-se uma vez
  var rd = {id:"t1", nome:"T", ativo:true, regime:"dependente", componentes:[cp("base",2000,"mensal")]};
  var fx = fiscalRendimento(rd);
  eq(fx.irs, retencaoRF(2000, "I", 0), "vencimento mensal");
  ok(fx.rf.usaTabela, "usa a tabela");
  eq(fx.rf.chave, "I", "e é a tabela I");

  // Com subsídios: cada um é um pagamento autónomo, mensalizado
  rd.componentes = [cp("base",2000,"mensal"), cp("ferias",2000,"anual"), cp("natal",2000,"anual")];
  fx = fiscalRendimento(rd);
  var esperado = retencaoRF(2000,"I",0) + retencaoRF(2000,"I",0)/12 + retencaoRF(2000,"I",0)/12;
  eq(fx.irs, esperado, "subsídios sofrem retenção autónoma", 0.01);
  ok(fx.irs < retencaoRF(2000 + 2000/12 + 2000/12, "I", 0),
     "e retêm menos do que se tudo fosse somado ao mês, que é o ponto");

  // Trabalho suplementar mensal soma-se à remuneração do mês
  rd.componentes = [cp("base",2000,"mensal"), cp("extraordinario",300,"mensal")];
  fx = fiscalRendimento(rd);
  eq(fx.irs, retencaoRF(2300, "I", 0), "componentes mensais somam antes da tabela");

  // Subsídio de alimentação dentro do limite não entra
  rd.componentes = [cp("base",2000,"mensal"), cp("alimentacao",150,"mensal")];
  fx = fiscalRendimento(rd);
  eq(fx.irs, retencaoRF(2000, "I", 0), "alimentação isenta não entra na retenção");

  // Acima do limite, só o excedente entra
  rd.componentes = [cp("base",2000,"mensal"), cp("alimentacao",300,"mensal")];
  fx = fiscalRendimento(rd);
  var limite = FISCAL_PADRAO.subsAlimCartao * FISCAL_PADRAO.diasUteis;
  eq(fx.irs, retencaoRF(2000 + (300 - limite), "I", 0), "só o excedente da alimentação entra", 0.01);

  // Dependentes reduzem a retenção
  S.fiscal.dependentes = 2; S.fiscal.estadoCivil = "nao_casado";
  rd.componentes = [cp("base",2000,"mensal")];
  fx = fiscalRendimento(rd);
  eq(fx.rf.chave, "II", "com dependentes muda para a tabela II");
  ok(fx.irs < retencaoRF(2000, "I", 0), "e a retenção desce");
  S.fiscal.dependentes = 0;

  // Pensão usa a categoria H
  rd.regime = "pensao";
  rd.componentes = [cp("pensao",1500,"mensal")];
  fx = fiscalRendimento(rd);
  eq(fx.rf.chave, "VIII", "pensão usa a tabela VIII");
  eq(fx.irs, retencaoRF(1500, "VIII", 0), "e o valor bate");
  eq(fx.ss, 0, "pensão não paga TSU");

  // Deficiência escolhe a tabela própria
  rd.regime = "dependente"; rd.deficiencia = true;
  rd.componentes = [cp("base",2500,"mensal")];
  fx = fiscalRendimento(rd);
  eq(fx.rf.chave, "IV", "deficiência usa a tabela IV");
  ok(fx.irs < retencaoRF(2500, "I", 0), "e retém menos do que a tabela geral");
  rd.deficiencia = false;

  // Independentes não têm tabela: cai na taxa efetiva
  rd.regime = "independente";
  fx = fiscalRendimento(rd);
  ok(!fx.rf.usaTabela, "independentes não usam estas tabelas");
  eq(fx.irs, 2500 * parseNum(S.fiscal.irsEfetivo) / 100, "e aplicam a taxa efetiva");
  rd.regime = "dependente";

  // Modo manual desliga as tabelas
  S.fiscal.modoIRS = "efetiva";
  fx = fiscalRendimento(rd);
  ok(!fx.rf.usaTabela, "modo manual não usa tabelas");
  eq(fx.irs, 2500 * parseNum(S.fiscal.irsEfetivo) / 100, "aplica a taxa efetiva");
  S.fiscal.modoIRS = "tabela";

  // O bruto continua a fechar com o líquido mais a carga
  rd.componentes = [cp("base",2000,"mensal"), cp("ferias",2000,"anual"), cp("alimentacao",150,"mensal")];
  fx = fiscalRendimento(rd);
  eq(fx.liquido + fx.carga, fx.bruto, "bruto = líquido + carga");
  ok(fx.irs >= 0, "retenção não negativa");
})();

G("taxas guardadas de um ano anterior");
(function(){
  reporEstado();
  // Cópia gravada antes da atualização: os valores antigos persistem
  var antigo = {version:1, membros:[], categorias:[], recorrentes:[], movimentos:[], limites:{},
    objetivos:[], creditos:[], ativos:[], rendimentos:[],
    fiscal:{ano:2025, ssTrabalhador:11, irsEfetivo:22, capitais:28, rendas:25,
            imiTaxa:0.35, subsAlimIsento:6.00, subsAlimCartao:10.20, diasUteis:20,
            pprBeneficio:20, pprIdade:55, pprLimiteAno:300, pprSaida:8, contarIRS:true}};
  var guardado = S;
  S = normalizar(JSON.parse(JSON.stringify(antigo)));

  eq(S.fiscal.ano, 2025, "o ano guardado mantém-se");
  eq(S.fiscal.subsAlimIsento, 6.00, "e as taxas antigas também");

  var velhas = taxasDesatualizadas();
  ok(velhas.length >= 3, "deteta as taxas desatualizadas: " + velhas.length);
  ok(velhas.some(function(t){ return t.k === "subsAlimIsento"; }), "inclui o subsídio em numerário");
  ok(velhas.some(function(t){ return t.k === "subsAlimCartao"; }), "inclui o subsídio em cartão");
  ok(velhas.some(function(t){ return t.k === "imiTaxa"; }), "inclui o IMI");
  ok(velhas.every(function(t){ return t.antigo !== t.novo; }), "só lista as que diferem");
  ok(!velhas.some(function(t){ return t.k === "irsEfetivo"; }), "não mexe na taxa efetiva de IRS");
  ok(!velhas.some(function(t){ return t.k === "diasUteis"; }), "nem nos dias de subsídio");
  ok(!velhas.some(function(t){ return t.k === "pprIdade"; }), "nem na idade");

  // Aplicar a atualização
  velhas.forEach(function(t){ S.fiscal[t.k] = FISCAL_PADRAO[t.k]; });
  S.fiscal.ano = FISCAL_PADRAO.ano;
  eq(taxasDesatualizadas().length, 0, "depois de atualizar não há nada por atualizar");
  eq(S.fiscal.subsAlimIsento, 6.15, "o subsídio passa ao valor novo");
  eq(S.fiscal.irsEfetivo, 22, "e a taxa efetiva pessoal mantém-se");
  eq(S.fiscal.diasUteis, 20, "e os dias de subsídio também");
  eq(S.fiscal.pprIdade, 55, "e a idade também");

  // Um estado já no ano corrente não gera aviso
  S = estadoVazio();
  eq(taxasDesatualizadas().length, 0, "estado novo não tem taxas desatualizadas");
  // Nem um estado de um ano futuro
  S.fiscal.ano = FISCAL_PADRAO.ano + 1;
  eq(taxasDesatualizadas().length, 0, "ano posterior também não gera aviso");

  S = guardado;
})();

G("limite da dedução do PPR por idade");
eq(limitePPR(20), 400, "abaixo dos 35");
eq(limitePPR(35), 400, "exatamente 35 ainda é o escalão de cima");
eq(limitePPR(36), 350, "acima de 35");
eq(limitePPR(50), 350, "exatamente 50");
eq(limitePPR(51), 300, "acima de 50");
eq(limitePPR(80), 300, "muito acima");
eq(limitePPR(0), 400, "idade não indicada usa o limite máximo");

G("renda moderada — Lei n.º 9-A/2026");
(function(){
  reporEstado();
  S.fiscal = Object.assign({}, FISCAL_PADRAO);
  var comRenda = function(valor, extra){
    return Object.assign({id:"rm", classe:"imovel", aquisicao:100000, atual:100000,
      quantidade:0, cotacao:0, encargos:[],
      rendimentos:[{id:"r", nome:"Renda", valor:valor, frequencia:"mensal", categoriaId:""}],
      aportes:[]}, extra || {});
  };

  // Dentro do teto: 10%
  var bom = comRenda(1200, {contratoModerada:true, contratoAnos:3});
  ok(elegivelRendaModerada(bom), "renda dentro do teto é elegível");
  eq(taxaRenda(bom), 10, "e é tributada a 10%");
  eq(regimeRenda(bom), "Habitação, renda moderada", "com o regime certo");

  // No limite exato ainda é elegível
  var limite = comRenda(2300, {contratoModerada:true, contratoAnos:3});
  ok(elegivelRendaModerada(limite), "no teto exato ainda é elegível");
  eq(taxaRenda(limite), 10, "e mantém os 10%");

  // Acima do teto: o benefício cai, aplica-se a duração
  var alto = comRenda(2500, {contratoModerada:true, contratoAnos:3});
  ok(!elegivelRendaModerada(alto), "acima do teto não é elegível");
  eq(taxaRenda(alto), 25, "e volta à taxa da duração do contrato");
  ok(regimeRenda(alto).indexOf("moderada") < 0, "e o regime deixa de dizer moderada");

  // Não habitacional nunca é elegível, mesmo com renda baixa
  var comercial = comRenda(500, {contratoModerada:true, contratoNaoHabitacional:true});
  ok(!elegivelRendaModerada(comercial), "não habitacional não é elegível");
  eq(taxaRenda(comercial), 28, "e mantém os 28%");

  // Sem a opção marcada, nada muda
  var normal = comRenda(1000, {contratoAnos:10});
  ok(!elegivelRendaModerada(normal), "sem a opção não é elegível");
  eq(taxaRenda(normal), 10, "mas a duração de 10 anos já dava 10%");

  // Sem rendas registadas, a elegibilidade não rebenta
  var semRenda = {id:"sr", classe:"imovel", aquisicao:1000, atual:1000, quantidade:0, cotacao:0,
                  contratoModerada:true, encargos:[], rendimentos:[], aportes:[]};
  ok(elegivelRendaModerada(semRenda), "sem rendas, zero está dentro do teto");
  finito(taxaRenda(semRenda), "e a taxa é finita");

  // O plano usa a taxa certa
  MES = isoMes(hoje());
  S.ativos = [bom]; S.creditos = []; S.rendimentos = []; S.recorrentes = [];
  var p = planoMes(MES);
  eq(p.rendaAtivos, 1200, "a renda entra");
  eq(p.impostoRendas, 120, "e é tributada a 10%");
  S.ativos = [alto];
  eq(planoMes(MES).impostoRendas, 2500 * 0.25, "acima do teto, a 25%");
})();

G("taxa da categoria F por duração do contrato");
(function(){
  reporEstado();
  eq(taxaRenda({contratoAnos:0}), 25, "até 5 anos");
  eq(taxaRenda({contratoAnos:4}), 25, "quatro anos");
  eq(taxaRenda({contratoAnos:5}), 15, "cinco anos");
  eq(taxaRenda({contratoAnos:9}), 15, "nove anos");
  eq(taxaRenda({contratoAnos:10}), 10, "dez anos");
  eq(taxaRenda({contratoAnos:19}), 10, "dezanove anos");
  eq(taxaRenda({contratoAnos:20}), 5, "vinte anos");
  eq(taxaRenda({contratoAnos:30}), 5, "trinta anos");
  eq(taxaRenda({contratoNaoHabitacional:true}), 28, "não habitacional");
  eq(taxaRenda({contratoNaoHabitacional:true, contratoAnos:20}), 28, "não habitacional ignora a duração");
  eq(taxaRenda({}), 25, "sem indicação usa a taxa base");
  eq(taxaRenda(null), 25, "ativo nulo não rebenta");
})();

G("decomposição fiscal de uma fonte de rendimento");
(function(){
  reporEstado();
  // Este grupo testa a mecânica das bases de incidência, não as tabelas:
  // fixa a taxa efetiva para que os valores esperados sejam verificáveis à mão.
  S.fiscal = Object.assign({}, FISCAL_PADRAO, {modoIRS:"efetiva"});

  var rd = {id:"r1", nome:"Teste", ativo:true, regime:"dependente", componentes:[
    {id:"c1", especie:"base", nome:"Base", valor:2000, frequencia:"mensal", ss:null, irs:null},
  ]};
  var fx = fiscalRendimento(rd);
  eq(fx.bruto, 2000, "bruto");
  eq(fx.baseSS, 2000, "base contributiva");
  eq(fx.ss, 220, "SS a 11%");
  eq(fx.irs, 300, "IRS a 15%");
  eq(fx.liquido, 1480, "líquido");
  eq(fx.taxaEfetiva, 26, "carga efetiva");

  // Subsídios anuais mensalizados
  rd.componentes.push({id:"c2", especie:"ferias", nome:"Férias", valor:2000, frequencia:"anual", ss:null, irs:null});
  fx = fiscalRendimento(rd);
  eq(fx.bruto, 2000 + 2000/12, "subsídio anual entra mensalizado");
  eq(fx.baseSS, 2000 + 2000/12, "e conta para a SS");

  // Subsídio de alimentação: isento até ao limite
  rd.componentes = [{id:"c3", especie:"alimentacao", nome:"Alimentação", valor:150, frequencia:"mensal", ss:null, irs:null}];
  fx = fiscalRendimento(rd);
  var limite = FISCAL_PADRAO.subsAlimCartao * FISCAL_PADRAO.diasUteis;   // 10,46 × 22 = 230,12
  eq(fx.isento, 150, "abaixo do limite fica todo isento");
  eq(fx.baseSS, 0, "não entra na base contributiva");
  eq(fx.ss, 0, "não gera SS");
  eq(fx.irs, 0, "não gera IRS");

  // Acima do limite, o excedente é tributado
  rd.componentes = [{id:"c4", especie:"alimentacao", nome:"Alimentação", valor:300, frequencia:"mensal", ss:null, irs:null}];
  fx = fiscalRendimento(rd);
  eq(fx.isento, limite, "isento só até ao limite");
  eq(fx.baseSS, 300 - limite, "o excedente entra na base");
  eq(fx.ss, (300 - limite) * 0.11, "SS só sobre o excedente");

  // Regimes de Segurança Social
  rd.componentes = [{id:"c5", especie:"base", nome:"Base", valor:1000, frequencia:"mensal", ss:null, irs:null}];
  rd.regime = "dependente";  eq(fiscalRendimento(rd).ss, 110, "dependente: 11%");
  rd.regime = "independente";eq(fiscalRendimento(rd).ss, 214, "independente: 21,4%");
  rd.regime = "pensao";      eq(fiscalRendimento(rd).ss, 0, "pensão não contribui");
  rd.regime = "isento";      eq(fiscalRendimento(rd).ss, 0, "isento não contribui");
  rd.regime = "dependente";

  // A pensão continua sujeita a IRS
  rd.componentes = [{id:"c6", especie:"pensao", nome:"Pensão", valor:1000, frequencia:"mensal", ss:null, irs:null}];
  rd.regime = "pensao";
  fx = fiscalRendimento(rd);
  eq(fx.ss, 0, "pensão sem SS");
  eq(fx.irs, 150, "pensão com IRS");
  rd.regime = "dependente";

  // Incidência sobreposta manualmente
  rd.componentes = [{id:"c7", especie:"base", nome:"Base", valor:1000, frequencia:"mensal", ss:false, irs:true}];
  fx = fiscalRendimento(rd);
  eq(fx.ss, 0, "SS desligada à mão");
  eq(fx.irs, 150, "IRS mantém-se");

  // Tributação autónoma
  rd.componentes = [{id:"c8", especie:"capitais", nome:"Juros", valor:1200, frequencia:"anual", ss:null, irs:null}];
  fx = fiscalRendimento(rd);
  eq(fx.bruto, 100, "juros mensalizados");
  eq(fx.ss, 0, "capitais não pagam SS");
  eq(fx.irs, 0, "capitais não entram na retenção de trabalho");
  eq(fx.autonomo, 28, "capitais a 28%");

  // Fonte desativada não conta no total
  S.rendimentos = [{id:"r9", nome:"Off", ativo:false, regime:"dependente",
                    componentes:[{id:"c9", especie:"base", valor:5000, frequencia:"mensal", ss:null, irs:null}]}];
  eq(fiscalTotal().bruto, 0, "fonte inativa não soma");
  S.rendimentos[0].ativo = true;
  eq(fiscalTotal().bruto, 5000, "fonte ativa soma");

  // Fonte sem componentes
  S.rendimentos = [{id:"r10", nome:"Vazia", ativo:true, regime:"dependente", componentes:[]}];
  fx = fiscalTotal();
  eq(fx.bruto, 0, "fonte vazia dá bruto zero");
  eq(fx.taxaEfetiva, 0, "e carga efetiva zero, sem dividir por zero");
})();

G("aviso de dupla contagem");
(function(){
  reporEstado();
  var comp = function(e,v,f){ return {id:e, especie:e, nome:e, valor:v, frequencia:f, categoriaId:"", ss:null, irs:null}; };

  // 14× por ano com subsídios à parte: tem de avisar
  var mau = {id:"d1", nome:"Duplicado", ativo:true, regime:"dependente", componentes:[
    comp("base",1500,"catorze"), comp("ferias",1500,"anual"), comp("natal",1500,"anual")]};
  ok(avisoDuplicacao(mau).length > 0, "avisa quando há 14× e subsídios à parte");
  ok(avisoDuplicacao(mau).indexOf("dupla contagem") >= 0, "e diz-lhe o nome");
  eq(fiscalRendimento(mau).bruto, 1500*14/12 + 125 + 125, "e o bruto está mesmo inflacionado");

  // Mensal com subsídios: correto, não avisa
  var bom = {id:"d2", nome:"Correto", ativo:true, regime:"dependente", componentes:[
    comp("base",1500,"mensal"), comp("ferias",1500,"anual"), comp("natal",1500,"anual")]};
  eq(avisoDuplicacao(bom), "", "não avisa quando o vencimento é mensal");
  eq(fiscalRendimento(bom).bruto, 1750, "e o bruto está certo");

  // 14× sozinho: também é uma forma legítima
  var so14 = {id:"d3", nome:"Só 14x", ativo:true, regime:"dependente", componentes:[comp("base",1500,"catorze")]};
  eq(avisoDuplicacao(so14), "", "não avisa quando só há o 14×");
  eq(fiscalRendimento(so14).bruto, 1500*14/12, "e o bruto equivale aos 14 meses");

  // Sem componentes
  eq(avisoDuplicacao({id:"d4", componentes:[]}), "", "fonte vazia não avisa");
  eq(avisoDuplicacao({id:"d5"}), "", "fonte sem lista de componentes não rebenta");
})();

G("prestações de parentalidade");
(function(){
  reporEstado();
  S.fiscal = Object.assign({}, FISCAL_PADRAO);

  // Valores de referência de 2026
  eq(S.fiscal.ias, 537.13, "IAS de 2026");
  eq(minimoParental(), 537.13/30*0.80, "mínimo diário do parental: 80% de 1/30 do IAS");
  /* Os mínimos derivam do IAS, e é por isso que se testam pela derivação e
     não por um literal: com o IAS de 2026 (537,13 €) dão 14,32 € e 7,16 €,
     que são os valores publicados. Um literal ficaria errado no ano em que
     o IAS mudasse — foi o que aconteceu ao 6,97 €, que é o valor de 2025. */
  ok(Math.abs(minimoParental() - 14.32) < 0.01, "que dá os 14,32 € publicados para 2026", minimoParental());
  ok(Math.abs(minimoAlargado() - 7.16) < 0.01, "e 7,16 € no alargado", minimoAlargado());
  eq(minimoAlargado(), parseNum(S.fiscal.ias)/30*0.40, "o alargado é 40% de 1/30 do IAS");

  // Modalidades: durações e percentagens
  var esperado = {inicial120:[120,100], inicial150:[150,80], partilhada150:[150,100],
                  partilhada180:[180,83], partilhada180pai:[180,90], pai:[35,100],
                  alargado:[90,30], alargadoAmbos:[90,40], alargadoParcial:[90,20]};
  Object.keys(esperado).forEach(function(k){
    var m = modalidadeParental(k);
    eq(m.dias, esperado[k][0], k + ": duração");
    eq(m.pct, esperado[k][1], k + ": percentagem");
  });
  eq(modalidadeParental("inexistente").k, "inicial120", "modalidade inválida cai na inicial de 120 dias");
  eq(PARENTALIDADE.riscoPct, 100, "risco clínico a 100%");

  // Remuneração de referência: mensal a dividir por 30, sem isentos nem anuais
  var cp = function(e,v,f){ return {id:e+v, especie:e, nome:e, valor:v, frequencia:f, categoriaId:"", ss:null, irs:null}; };
  var rd = {id:"p1", nome:"P", ativo:true, regime:"dependente", componentes:[
    cp("base", 1800, "mensal"),
    cp("ferias", 1800, "anual"),              // subsídios não entram
    cp("alimentacao", 150, "mensal"),         // isento não entra
    cp("extraordinario", 300, "mensal")]};
  eq(remuneracaoReferencia(rd), (1800+300)/30, "referência diária = mensais tributáveis ÷ 30");

  // Subsídio parental sobre essa referência
  var rr = remuneracaoReferencia(rd);      // 70 €/dia
  var s = subsidioParental(rr, "inicial120");
  eq(s.diario, 70, "120 dias a 100%");
  eq(s.mensal, 2100, "mensalizado");
  eq(s.total, 70*120, "total da licença");
  ok(!s.noMinimo, "acima do mínimo");

  eq(subsidioParental(rr, "inicial150").diario, 56, "150 dias a 80%");
  eq(subsidioParental(rr, "partilhada180").diario, 70*0.83, "180 dias partilhados a 83%", 0.01);
  eq(subsidioParental(rr, "alargado").diario, 21, "alargado a 30%");
  eq(subsidioParental(rr, "alargadoAmbos").diario, 28, "alargado a 40% quando ambos gozam");

  // O mínimo legal é respeitado
  var baixo = subsidioParental(5, "inicial120");
  eq(baixo.diario, minimoParental(), "referência baixa é elevada ao mínimo");
  ok(baixo.noMinimo, "e fica assinalado");
  var baixoAlargado = subsidioParental(5, "alargado");
  eq(baixoAlargado.diario, minimoAlargado(), "no alargado o mínimo é o próprio");

  // Risco clínico
  var risco = subsidioRiscoGravidez(rr);
  eq(risco.diario, 70, "risco clínico a 100% da referência");
  eq(risco.mensal, 2100, "mensalizado");
  eq(subsidioRiscoGravidez(2).diario, minimoParental(), "e respeita o mínimo");

  // Casos-limite
  eq(remuneracaoReferencia(null), 0, "fonte nula não rebenta");
  eq(remuneracaoReferencia({componentes:[]}), 0, "fonte sem componentes");
  finito(subsidioParental(0, "inicial120").mensal, "referência zero dá número finito");
  ok(subsidioParental(0, "inicial120").diario > 0, "e nunca zero, por causa do mínimo");
})();

G("abono de família");
(function(){
  reporEstado();
  S.fiscal = Object.assign({}, FISCAL_PADRAO, {dependentes:0, monoparental:false});
  S.rendimentos = [];

  // Escalões pelos limites publicados
  eq(escalaoAbono(0).n, 1, "rendimento nulo: 1.º escalão");
  eq(escalaoAbono(3759.91).n, 1, "no limite exato do 1.º");
  eq(escalaoAbono(3759.92).n, 2, "acima passa ao 2.º");
  eq(escalaoAbono(7519.82).n, 2, "limite do 2.º");
  eq(escalaoAbono(7519.83).n, 3, "3.º escalão");
  eq(escalaoAbono(12783.69).n, 3, "limite do 3.º");
  eq(escalaoAbono(12783.70).n, 4, "4.º escalão");
  eq(escalaoAbono(18799.55).n, 4, "limite do 4.º");
  eq(escalaoAbono(18799.56).n, 5, "5.º escalão");
  eq(escalaoAbono(1e9).n, 5, "rendimento muito alto continua no 5.º");

  // Valores por idade, 1.º escalão
  eq(ABONO_FAMILIA.escaloes[0].ate36, 190.98, "1.º escalão até 36 meses");
  eq(ABONO_FAMILIA.escaloes[1].ate36, 161.65, "2.º escalão até 36 meses");
  eq(ABONO_FAMILIA.escaloes[2].ate36, 132.07, "3.º escalão até 36 meses");
  eq(ABONO_FAMILIA.escaloes[3].ate36, 88.43, "4.º escalão até 36 meses");
  eq(ABONO_FAMILIA.escaloes[4].ate36, 0, "5.º escalão não recebe");

  // Os valores nunca sobem com o escalão nem com a idade
  for (var i = 1; i < ABONO_FAMILIA.escaloes.length; i++){
    ["ate36","ate72","mais72"].forEach(function(f){
      ok(ABONO_FAMILIA.escaloes[i][f] <= ABONO_FAMILIA.escaloes[i-1][f] + 1e-9,
         "escalão " + (i+1) + " não recebe mais do que o " + i + " em " + f);
    });
  }
  ABONO_FAMILIA.escaloes.forEach(function(e){
    ok(e.ate72 <= e.ate36 + 1e-9, "escalão " + e.n + ": dos 36 aos 72 não sobe");
    ok(e.mais72 <= e.ate72 + 1e-9, "escalão " + e.n + ": acima dos 72 não sobe");
  });

  // Rendimento de referência: anual a dividir por titulares + 1
  var cp = function(e,v,f){ return {id:e+v, especie:e, nome:e, valor:v, frequencia:f, categoriaId:"", ss:null, irs:null}; };
  S.rendimentos = [{id:"a1", ativo:true, regime:"dependente", componentes:[cp("base", 1000, "mensal")]}];
  S.fiscal.dependentes = 0;
  eq(rendimentoReferenciaAbono(), 12000, "sem dependentes: anual ÷ 1");
  S.fiscal.dependentes = 1;
  eq(rendimentoReferenciaAbono(), 6000, "com um dependente: anual ÷ 2");
  S.fiscal.dependentes = 3;
  eq(rendimentoReferenciaAbono(), 3000, "com três: anual ÷ 4");

  // As prestações sociais não contam para o rendimento de referência
  S.fiscal.dependentes = 0;
  S.rendimentos[0].componentes.push(cp("abonoFamilia", 200, "mensal"));
  eq(rendimentoReferenciaAbono(), 12000, "o próprio abono não entra na referência");
  S.rendimentos[0].componentes.push(cp("parentalidade", 1500, "mensal"));
  eq(rendimentoReferenciaAbono(), 12000, "nem o subsídio parental");
  S.rendimentos[0].componentes = [cp("base", 1000, "mensal")];

  // Cálculo do abono
  S.fiscal.dependentes = 1;   // referência 6000 → 2.º escalão
  var a = abonoFamilia(12);
  eq(a.escalao.n, 2, "escalão apurado do rendimento");
  eq(a.valor, 161.65, "valor até 36 meses");
  eq(abonoFamilia(50).valor, 75.13, "dos 36 aos 72");
  eq(abonoFamilia(100).valor, 75.13, "acima dos 72");
  eq(abonoFamilia(36).valor, 161.65, "36 meses ainda é o escalão de baixo");
  eq(abonoFamilia(37).valor, 75.13, "37 já não");
  eq(abonoFamilia(72).valor, 75.13, "72 meses");

  // Majoração monoparental
  eq(abonoFamilia(12, true).valor, 161.65 * 1.5, "monoparental acresce 50%");
  S.fiscal.monoparental = true;
  eq(abonoFamilia(12).valor, 161.65 * 1.5, "a definição do agregado é usada por omissão");
  eq(abonoFamilia(12, false).valor, 161.65, "e pode ser sobreposta na componente");
  S.fiscal.monoparental = false;

  // Sem direito
  S.rendimentos = [{id:"a2", ativo:true, regime:"dependente", componentes:[cp("base", 5000, "mensal")]}];
  S.fiscal.dependentes = 0;   // 60 000 → 5.º escalão
  var semDireito = abonoFamilia(12);
  eq(semDireito.escalao.n, 5, "rendimento alto cai no 5.º escalão");
  eq(semDireito.valor, 0, "e não há abono");
  ok(semDireito.semDireito, "e fica assinalado");

  // Casos-limite
  finito(abonoFamilia(-5).valor, "idade negativa não rebenta");
  finito(abonoFamilia(1e6).valor, "idade absurda não rebenta");
  finito(abonoFamilia(null).valor, "idade nula não rebenta");
  S.rendimentos = [];
  eq(rendimentoReferenciaAbono(), 0, "sem rendimentos, referência zero");
  eq(abonoFamilia(12).escalao.n, 1, "que dá o 1.º escalão");
})();

G("majoração de crianças com menos de 36 meses");
(function(){
  reporEstado();
  S.fiscal = Object.assign({}, FISCAL_PADRAO, {dependentes:0, monoparental:false});
  S.rendimentos = [];   // 1.º escalão

  // Valores de 2026, confirmados em três fontes
  eq(acrescimoMenos36(1, 1), 0, "uma criança não tem majoração");
  eq(acrescimoMenos36(2, 1), 64.96, "duas crianças, 1.º escalão");
  eq(acrescimoMenos36(2, 2), 57.64, "duas crianças, 2.º escalão");
  eq(acrescimoMenos36(2, 3), 54.35, "duas crianças, 3.º escalão");
  eq(acrescimoMenos36(2, 4), 39.28, "duas crianças, 4.º escalão");
  eq(acrescimoMenos36(2, 5), 0, "5.º escalão não tem majoração");
  eq(acrescimoMenos36(3, 1), 106.96, "mais de duas, 1.º escalão");
  eq(acrescimoMenos36(3, 4), 55.70, "mais de duas, 4.º escalão");
  eq(acrescimoMenos36(5, 1), 106.96, "cinco crianças usam o escalão de «mais de duas»");
  eq(acrescimoMenos36(0, 1), 0, "zero crianças");

  // Aplicada ao abono: só a crianças que são efetivamente < 36 meses
  var a2 = abonoFamilia(20, false, {menos36:true, numMenos36:2});
  eq(a2.acrescimo36, 64.96, "criança de 20 meses com duas no agregado recebe o acréscimo");
  eq(a2.valor, a2.base + 64.96, "somado à base");
  var aVelha = abonoFamilia(50, false, {menos36:false, numMenos36:2});
  eq(aVelha.acrescimo36, 0, "criança de 50 meses não recebe o acréscimo, ainda que o agregado tenha duas <36m");
  var aUma = abonoFamilia(20, false, {menos36:true, numMenos36:1});
  eq(aUma.acrescimo36, 0, "com uma só criança <36m não há majoração");

  // Contagem no agregado
  var cp = function(e,v,extra){ return Object.assign({id:e+Math.random(), especie:e, nome:e, valor:v,
    frequencia:"mensal", categoriaId:"", ss:null, irs:null}, extra||{}); };
  S.rendimentos = [{id:"ag", ativo:true, regime:"isento", componentes:[
    cp("abonoFamilia", 100, {idadeMeses:10, menos36:true}),
    cp("abonoFamilia", 100, {idadeMeses:20, menos36:true}),
    cp("abonoFamilia", 100, {idadeMeses:50, menos36:false})]}];
  eq(contarMenos36(), 2, "conta as crianças marcadas <36m no agregado");
  eq(contarMenos36(S.rendimentos[0].componentes[0].id), 1, "excluindo uma, conta uma");
})();

G("bonificação por deficiência");
(function(){
  reporEstado();
  S.fiscal = Object.assign({}, FISCAL_PADRAO);
  eq(bonificacaoDeficiencia(6*12, false), 74.19, "até aos 14 anos");
  eq(bonificacaoDeficiencia(14*12, false), 74.19, "exatamente 14 anos");
  eq(bonificacaoDeficiencia(15*12, false), 108.06, "dos 14 aos 18");
  eq(bonificacaoDeficiencia(18*12, false), 108.06, "exatamente 18");
  eq(bonificacaoDeficiencia(20*12, false), 144.63, "dos 18 aos 24");
  eq(bonificacaoDeficiencia(24*12, false), 144.63, "exatamente 24");
  eq(bonificacaoDeficiencia(25*12, false), 0, "acima dos 24 já não há");
  eq(bonificacaoDeficiencia(6*12, true), 74.19 * 1.5, "monoparental majora em 50%");

  // Somada no abono
  var a = abonoFamilia(10, false, {deficiencia:true, numMenos36:0});
  eq(a.bonusDef, 74.19, "o abono inclui a bonificação");
  eq(a.valor, a.base + 74.19, "somada à base");
  var semDef = abonoFamilia(10, false, {deficiencia:false});
  eq(semDef.bonusDef, 0, "sem deficiência não há bonificação");
})();

G("abono composto — todas as majorações juntas");
(function(){
  reporEstado();
  S.fiscal = Object.assign({}, FISCAL_PADRAO, {dependentes:0});
  S.rendimentos = [];   // 1.º escalão, ate36 = 190.98
  // Criança de 20 meses, monoparental, agregado com 2 <36m, com deficiência
  var a = abonoFamilia(20, true, {menos36:true, deficiencia:true, numMenos36:2});
  eq(a.base, 190.98, "base do 1.º escalão até 36 meses");
  eq(a.majMono, 190.98 * 0.5, "majoração monoparental sobre a base");
  eq(a.acrescimo36, 64.96, "acréscimo de duas crianças <36m");
  eq(a.bonusDef, 74.19 * 1.5, "bonificação por deficiência, majorada por monoparentalidade");
  eq(a.valor, 190.98 + 190.98*0.5 + 64.96 + 74.19*1.5, "o total soma as quatro parcelas", 0.01);
  ok(a.valor > 0, "e é positivo");
})();

G("abono pré-natal");
(function(){
  reporEstado();
  S.fiscal = Object.assign({}, FISCAL_PADRAO, {dependentes:0, monoparental:false});
  S.rendimentos = [];   // 1.º escalão

  var um = abonoPrenatal(1, false);
  eq(um.base, 190.98, "um bebé: base do 1.º escalão");
  eq(um.valor, 190.98, "sem majoração");
  eq(um.bebes, 1, "um bebé");

  var gemeos = abonoPrenatal(2, false);
  eq(gemeos.base, 190.98 * 2, "gémeos duplicam");
  eq(gemeos.bebes, 2, "dois bebés");

  var trigemeos = abonoPrenatal(3, false);
  eq(trigemeos.base, 190.98 * 3, "trigémeos triplicam");

  // Majoração monoparental própria: 35%, não 50%
  var mono = abonoPrenatal(1, true);
  eq(mono.valor, 190.98 * 1.35, "monoparental do pré-natal é 35%");
  ok(Math.abs(ABONO_FAMILIA.majoracaoPrenatalMonoparental - 35) < 1e-9, "e a constante é 35");
  ok(ABONO_FAMILIA.majoracaoPrenatalMonoparental !== ABONO_FAMILIA.majoracaoMonoparental,
     "diferente da majoração do abono das crianças (50%)");

  var gemeosMono = abonoPrenatal(2, true);
  eq(gemeosMono.valor, 190.98 * 2 * 1.35, "gémeos monoparental");

  // Casos-limite
  eq(abonoPrenatal(0, false).bebes, 1, "zero bebés conta como um");
  finito(abonoPrenatal(null, false).valor, "número nulo não rebenta");
  // 5.º escalão não recebe
  S.rendimentos = [{id:"alto", ativo:true, regime:"dependente",
    componentes:[{id:"c", especie:"base", valor:5000, frequencia:"mensal", categoriaId:"", ss:null, irs:null}]}];
  eq(abonoPrenatal(1, false).valor, 0, "5.º escalão não recebe pré-natal");
})();

G("licença parental — parto múltiplo e prematuridade");
(function(){
  reporEstado();
  S.fiscal = Object.assign({}, FISCAL_PADRAO);
  var rr = 70;   // €/dia

  // Sem extensões
  var base = subsidioParental(rr, "inicial120");
  eq(base.diasBase, 120, "120 dias sem extensões");
  eq(base.diasInternamento, 0, "sem internamento");
  eq(base.diasTotal, 120, "total igual à base");
  eq(base.total, 70*120, "montante da licença");

  // Parto múltiplo: +30 dias por bebé além do primeiro
  var gemeos = subsidioParental(rr, "inicial120", {numBebes:2});
  eq(gemeos.diasBase, 150, "gémeos acrescentam 30 dias");
  eq(gemeos.diasTotal, 150, "ao total");
  var trigemeos = subsidioParental(rr, "inicial120", {numBebes:3});
  eq(trigemeos.diasBase, 180, "trigémeos acrescentam 60 dias");

  // Internamento: internamento + 30 dias, a 100%
  var intern = subsidioParental(rr, "inicial150", {internamento:20});
  eq(intern.diasBase, 150, "a base da modalidade mantém-se");
  eq(intern.diasInternamento, 50, "internamento de 20 + 30 dias após a alta");
  eq(intern.diasTotal, 200, "somados à base");
  // A modalidade inicial150 paga 80%, mas o internamento é a 100%
  eq(intern.mensal, 70*0.80*30, "o valor mensal é o da modalidade (80%)");
  eq(intern.total, 70*0.80*150 + 70*150/150*50, "os dias de internamento pagam-se a 100%", 0.01);
  // Confirmar a aritmética do internamento a 100%
  eq(intern.total, 70*0.80*150 + 70*50, "150 dias a 80% mais 50 a 100%", 0.01);

  // Sem internamento não há dias de internamento
  eq(subsidioParental(rr, "inicial120", {numBebes:1, internamento:0}).diasInternamento, 0, "internamento zero");

  // Combinado: gémeos internados
  var comb = subsidioParental(rr, "inicial120", {numBebes:2, internamento:15});
  eq(comb.diasBase, 150, "gémeos: 150 de base");
  eq(comb.diasInternamento, 45, "15 + 30 de internamento");
  eq(comb.diasTotal, 195, "total");

  // Casos-limite
  finito(subsidioParental(rr, "inicial120", {numBebes:0}).total, "zero bebés não rebenta");
  finito(subsidioParental(rr, "inicial120", {internamento:-5}).total, "internamento negativo não rebenta");
  eq(subsidioParental(rr, "inicial120", {internamento:-5}).diasInternamento, 0, "internamento negativo dá zero");
})();

G("prestações sociais no orçamento");
(function(){
  reporEstado();
  S.fiscal = Object.assign({}, FISCAL_PADRAO);
  MES = isoMes(hoje());
  var cp = function(e,v,f,cat){ return {id:e+v, especie:e, nome:e, valor:v, frequencia:f,
    categoriaId: catPorNome(cat || "Subsídios e abonos"), ss:null, irs:null}; };

  // Uma fonte só com prestações sociais: entra no rendimento, sem carga fiscal
  S.rendimentos = [{id:"s1", nome:"Prestações", ativo:true, regime:"isento", componentes:[
    cp("parentalidade", 1400, "mensal", "Parentalidade"),
    cp("abonoFamilia", 132.07, "mensal"),
    cp("riscoGravidez", 0, "mensal", "Parentalidade")]}];
  var fx = fiscalRendimento(S.rendimentos[0]);
  eq(fx.bruto, 1532.07, "somam ao bruto");
  eq(fx.ss, 0, "não pagam Segurança Social");
  eq(fx.irs, 0, "nem IRS");
  eq(fx.isento, 1532.07, "e contam como isento");
  eq(fx.liquido, fx.bruto, "líquido igual ao bruto");
  eq(fx.taxaEfetiva, 0, "carga fiscal nula");

  // No plano, entram como rendimento nas categorias respetivas
  S.recorrentes = []; S.ativos = []; S.creditos = []; limparCacheCredito();
  var p = planoMes(MES);
  eq(p.rend, 1532.07, "o plano conta-as no rendimento");
  eq(p.cargaRend, 0, "sem carga fiscal");
  eq(p.porCat[catPorNome("Parentalidade")], 1400, "parentalidade na sua categoria");
  eq(p.porCat[catPorNome("Subsídios e abonos")], 132.07, "abono na sua");

  // As categorias continuam a fechar
  var somaR = 0;
  Object.keys(p.porCat).forEach(function(id){
    var c = cat(id);
    if (c && c.tipo === "rendimento") somaR += p.porCat[id];
  });
  eq(somaR, p.rend, "as categorias de rendimento fecham");

  // Misturadas com trabalho, só o trabalho é tributado
  S.rendimentos = [{id:"s2", nome:"Mista", ativo:true, regime:"dependente", componentes:[
    cp("base", 2000, "mensal", "Vencimento"),
    cp("parentalidade", 800, "mensal", "Parentalidade"),
    cp("abonoFamilia", 88.43, "mensal")]}];
  fx = fiscalRendimento(S.rendimentos[0]);
  eq(fx.bruto, 2888.43, "bruto soma tudo");
  eq(fx.baseSS, 2000, "só o vencimento entra na base contributiva");
  eq(fx.baseIRS, 2000, "e na de IRS");
  eq(fx.ss, 220, "SS só sobre o vencimento");
  eq(fx.rf.mensal, 2000, "a retenção também só vê o vencimento");
  eq(fx.liquido + fx.carga, fx.bruto, "bruto = líquido + carga");

  // A remuneração de referência ignora as prestações
  eq(remuneracaoReferencia(S.rendimentos[0]), 2000/30, "a referência exclui as prestações sociais");

  // Uma prestação social a zero é registável: documenta a ausência de
  // direito (5.º escalão, criança sem abono), o que é informação.
  var abonoZero = {id:"z1", ativo:true, regime:"isento", componentes:[
    cp("abonoFamilia", 0, "mensal")]};
  ok(especieDe("abonoFamilia").social, "o abono é marcado como prestação social");
  ok(especieDe("parentalidade").social, "e o parental também");
  ok(especieDe("riscoGravidez").social, "e o risco clínico");
  ok(!especieDe("base").social, "o vencimento não é prestação social");
  var fxZero = fiscalRendimento(abonoZero);
  eq(fxZero.bruto, 0, "uma prestação a zero não soma");
  finito(fxZero.taxaEfetiva, "e não divide por zero");
})();

G("impostos sobre ativos");
(function(){
  reporEstado();
  S.fiscal = Object.assign({}, FISCAL_PADRAO);

  // A taxa vem das definições: o teste mede a regra, não um número fixo.
  var tIMI = parseNum(S.fiscal.imiTaxa) / 100;
  var casa = {id:"i1", classe:"imovel", aquisicao:200000, atual:200000, vpt:100000, encargos:[], rendimentos:[], aportes:[]};
  var imp = impostoAtivo(casa);
  eq(imp.nome, "IMI", "imóvel paga IMI");
  eq(imp.anual, 100000 * tIMI, "IMI = VPT × taxa");
  eq(imp.estimado, false, "com VPT não é estimativa");

  var semVpt = Object.assign({}, casa, {vpt:0});
  ok(impostoAtivo(semVpt).estimado === true, "sem VPT sinaliza estimativa");
  eq(impostoAtivo(semVpt).anual, 200000 * tIMI, "sem VPT estima sobre o valor de mercado");

  var carro = {id:"i2", classe:"automovel", aquisicao:20000, atual:10000, iuc:180, encargos:[], rendimentos:[], aportes:[]};
  eq(impostoAtivo(carro).nome, "IUC", "veículo paga IUC");
  eq(impostoAtivo(carro).anual, 180, "IUC é o valor indicado");

  var ppr = {id:"i3", classe:"ppr", aquisicao:10000, atual:12000, encargos:[], rendimentos:[], aportes:[]};
  eq(impostoAtivo(ppr).anual, 0, "PPR não tem imposto anual");

  var etf = {id:"i4", classe:"etf", aquisicao:10000, atual:12000, encargos:[], rendimentos:[], aportes:[]};
  eq(impostoAtivo(etf).anual, 0, "ETF não paga imposto anual em dinheiro");

  var arte = {id:"i5", classe:"arte", aquisicao:5000, atual:6000, encargos:[], rendimentos:[], aportes:[]};
  eq(impostoAtivo(arte).anual, 0, "arte não tem imposto anual");
})();

G("retorno líquido de imposto");
(function(){
  reporEstado();
  S.fiscal = Object.assign({}, FISCAL_PADRAO);
  eq(retornoLiquido({classe:"aforro", valorizacao:2.5}), 2.5*0.72, "certificados: 28% na fonte");
  eq(retornoLiquido({classe:"etf", valorizacao:7}), 7*0.72, "ETF: 28% na fonte");
  eq(retornoLiquido({classe:"ppr", valorizacao:4}), 4, "PPR não é tributado na acumulação");
  eq(retornoLiquido({classe:"imovel", valorizacao:2}), 2, "valorização imobiliária não é tributada até vender");
  eq(retornoLiquido({classe:"automovel", valorizacao:-15}), -15, "retorno negativo não é tributado");
  eq(retornoLiquido({classe:"corrente", valorizacao:0}), 0, "conta à ordem sem juros");
})();

G("benefício fiscal do PPR");
(function(){
  reporEstado();
  S.fiscal = Object.assign({}, FISCAL_PADRAO, {pprIdade:30});
  S.ativos = [{id:"p1", classe:"ppr", aquisicao:0, atual:1000, contribuicao:100,
               encargos:[], rendimentos:[], aportes:[]}];
  var b = beneficioPPR();
  eq(b.entregas, 1200, "entregas anuais");
  eq(b.limite, 400, "limite aos 30 anos");
  eq(b.beneficio, 240, "20% de 1200, abaixo do limite");
  ok(!b.limitado, "não está limitado");

  S.ativos[0].contribuicao = 300;   // 3600/ano → 720 > 400
  b = beneficioPPR();
  eq(b.beneficio, 400, "corta no limite");
  ok(b.limitado, "sinaliza que está limitado");

  S.fiscal.pprIdade = 55;
  eq(beneficioPPR().limite, 300, "limite aos 55 anos");
  eq(beneficioPPR().beneficio, 300, "corta no limite mais baixo");

  S.ativos = [];
  eq(beneficioPPR().entregas, 0, "sem PPR não há entregas");
  eq(beneficioPPR().beneficio, 0, "nem benefício");
})();

/* ============================================================
   5. Ativos
   ============================================================ */
G("valor de um ativo");
(function(){
  reporEstado();
  var base = {classe:"etf", aquisicao:10000, dataAquisicao:"2020-01-01",
              encargos:[], rendimentos:[], aportes:[]};

  var porCotacao = Object.assign({}, base, {quantidade:100, cotacao:50, atual:9999});
  eq(valorAtivo(porCotacao), 5000, "unidades × cotação tem prioridade");
  eq(origemValor(porCotacao), "cotação", "origem: cotação");

  var manual = Object.assign({}, base, {quantidade:0, cotacao:0, atual:12345});
  eq(valorAtivo(manual), 12345, "valor indicado quando não há cotação");
  eq(origemValor(manual), "indicado", "origem: indicado");

  var estimado = Object.assign({}, base, {quantidade:0, cotacao:0, atual:0, valorizacao:10,
                                          dataAquisicao: mesShift(isoMes(hoje()), -24) + "-01"});
  eq(valorAtivo(estimado), 10000*1.21, "estimado pela taxa em dois anos", 1);
  eq(origemValor(estimado), "estimado", "origem: estimado");

  // Quantidade sem cotação não conta
  var meio = Object.assign({}, base, {quantidade:100, cotacao:0, atual:777});
  eq(valorAtivo(meio), 777, "quantidade sem cotação cai para o valor indicado");

  // Sem data de aquisição, a estimativa é o próprio capital
  var semData = {classe:"etf", aquisicao:5000, dataAquisicao:"", atual:0, quantidade:0, cotacao:0,
                 encargos:[], rendimentos:[], aportes:[]};
  eq(valorAtivo(semData), 5000, "sem data não valoriza");

  // Depreciação não passa a negativo
  var carro = {classe:"automovel", aquisicao:30000, atual:0, quantidade:0, cotacao:0,
               dataAquisicao: mesShift(isoMes(hoje()), -360) + "-01",
               encargos:[], rendimentos:[], aportes:[]};
  ok(valorAtivo(carro) >= 0, "valor nunca fica negativo: " + valorAtivo(carro));
})();

G("classes de ativo");
(function(){
  Object.keys(CLASSES).forEach(function(k){
    var c = CLASSES[k];
    ok(typeof c.lbl === "string" && c.lbl.length > 0, "classe " + k + " tem rótulo");
    ok(c.nat === "financeiro" || c.nat === "real", "classe " + k + " tem natureza válida");
    ok(GRUPOS_ATIVO[c.grupo] != null, "classe " + k + " tem grupo conhecido: " + c.grupo);
    ok(typeof c.ret === "number" && isFinite(c.ret), "classe " + k + " tem retorno numérico");
    ok(c.queda >= 0 && c.queda <= 100, "classe " + k + " tem queda entre 0 e 100");
    ok(["capitais","imovel","automovel","ppr","nenhum"].indexOf(c.fiscal) >= 0,
       "classe " + k + " tem regime fiscal conhecido: " + c.fiscal);
    ok(/^#[0-9a-f]{6}$/i.test(c.cor), "classe " + k + " tem cor válida");
  });
  eq(classeDe("inexistente"), CLASSES.outros, "classe desconhecida cai em outros");
  eq(classeDe("corrente").ret, 0, "conta à ordem não rende");
  ok(CLASSES.poupanca.ret > 0, "conta poupança rende");
  eq(CLASSES.corrente.grupo, "liquidez", "conta à ordem é liquidez");
  eq(CLASSES.poupanca.grupo, "liquidez", "conta poupança é liquidez");
  ok(CLASSES.automovel.ret < 0, "automóvel deprecia");
  ok(!temSimulador("corrente"), "conta à ordem não tem simulador");
  ok(temSimulador("ppr"), "PPR tem simulador");
  ok(temSimulador("etf"), "ETF tem simulador");
  ok(!temSimulador("imovel"), "imóvel não tem simulador financeiro");
})();

G("fluxo e rendibilidade de um ativo");
(function(){
  reporEstado();
  S.fiscal = Object.assign({}, FISCAL_PADRAO);
  MES = isoMes(hoje());

  var t1 = {id:"f1", classe:"imovel", aquisicao:100000, atual:120000, quantidade:0, cotacao:0,
            vpt:60000, contratoAnos:0,
            encargos:[{id:"e1", nome:"Condomínio", valor:50, frequencia:"mensal", categoriaId:""}],
            rendimentos:[{id:"r1", nome:"Renda", valor:600, frequencia:"mensal", categoriaId:""}],
            aportes:[]};
  S.ativos = [t1]; S.creditos = [];

  eq(rendimentosMensais(t1), 600, "rendas mensais");
  eq(encargosMensais(t1), 50 + 60000*(parseNum(S.fiscal.imiTaxa)/100)/12, "encargos incluem o IMI mensalizado");
  eq(dividaDoAtivo(t1), 0, "sem crédito não há dívida");
  eq(capitalProprio(t1), 120000, "capital próprio é o valor todo");

  var fx = fluxoAtivo(t1);
  eq(fx.receita, 600, "receita");
  eq(fx.liquido, 600 - encargosMensais(t1), "fluxo líquido");

  var rb = rendibilidade(t1);
  eq(rb.bruta, 600*12/120000*100, "rendibilidade bruta");
  eq(rb.liquida, (600*12 - encargosMensais(t1)*12)/120000*100, "rendibilidade líquida");
  eq(rb.propria, fx.liquido*12/120000*100, "cash-on-cash sem alavancagem iguala a líquida");

  // Com crédito, a cash-on-cash separa-se da líquida
  var cr = {id:"c1", nome:"Hipoteca", capital:80000, prazoMeses:240, inicio: mesShift(MES,-12)+"-01",
            tipoTaxa:"fixa", taxaAnual:3, seguroMensal:0, ativoId:"f1"};
  S.creditos = [cr]; limparCacheCredito();

  ok(dividaDoAtivo(t1) > 0, "com crédito há dívida");
  ok(capitalProprio(t1) < 120000, "capital próprio desce");
  var rb2 = rendibilidade(t1);
  eq(rb2.liquida, rb.liquida, "a rendibilidade líquida não muda com o financiamento");
  ok(rb2.propria !== rb.propria, "a cash-on-cash muda com o financiamento");
  ok(rb2.capitalProprio === capitalProprio(t1), "cash-on-cash usa o capital próprio");

  // Capital próprio negativo não produz uma percentagem enganadora
  t1.atual = 10000;
  eq(rendibilidade(t1).propria, null, "capital próprio negativo não devolve percentagem");
  t1.atual = 120000;

  // Ativo sem valor não divide por zero
  var vazio = {id:"f2", classe:"arte", aquisicao:0, atual:0, quantidade:0, cotacao:0,
               encargos:[], rendimentos:[], aportes:[]};
  var rv = rendibilidade(vazio);
  eq(rv.bruta, 0, "sem valor, rendibilidade zero");
  ok(rv.propria === null || isFinite(rv.propria), "sem valor não devolve infinito");
})();

G("projeção de um ativo");
(function(){
  reporEstado();
  S.projecao = Object.assign({}, S.projecao, {inflacao:0});

  var a = {id:"pj1", classe:"etf", aquisicao:10000, atual:10000, quantidade:0, cotacao:0,
           contribuicao:0, crescContrib:0, reinvestimento:100,
           encargos:[], rendimentos:[], aportes:[]};

  // Sem contribuição, juro composto puro
  var p = projetarAtivo(a, 10, {contrib:0, cresc:0, taxa:7, reinv:100});
  eq(p.fim.valor, 10000*Math.pow(1.07, 10), "capitalização composta a 10 anos", 5);
  eq(p.fim.aportado, 0, "sem aportes");

  // Sem retorno, só contribuições
  p = projetarAtivo(a, 5, {contrib:100, cresc:0, taxa:0, reinv:100});
  eq(p.fim.valor, 10000 + 100*60, "sem retorno o valor é capital mais contribuições");
  eq(p.fim.aportado, 6000, "contribuições acumuladas");

  // Contribuição crescente
  p = projetarAtivo(a, 3, {contrib:100, cresc:10, taxa:0, reinv:100});
  eq(p.contribFinal, 100*1.1*1.1, "contribuição cresce uma vez por ano", 0.01);
  eq(p.fim.aportado, 100*12 + 110*12 + 121*12, "aportes com crescimento", 0.5);

  // Reinvestimento parcial: o que não é reinvestido não capitaliza
  var cheio = projetarAtivo(a, 10, {contrib:0, cresc:0, taxa:7, reinv:100});
  var metade = projetarAtivo(a, 10, {contrib:0, cresc:0, taxa:7, reinv:50});
  ok(metade.fim.valor < cheio.fim.valor, "reinvestir menos deixa menos no ativo");
  ok(metade.fim.distribuido > 0, "há distribuição");
  eq(cheio.fim.distribuido, 0, "com 100% nada é distribuído");

  // A série tem uma entrada por ano, mais o ponto de partida
  eq(p.serie.length, 4, "série anual de três anos tem quatro pontos");
  eq(p.serie[0].ano, 0, "começa no ano zero");
  eq(p.serie[0].valor, 10000, "começa no valor atual");

  // Inflação desconta o valor real
  S.projecao.inflacao = 2;
  p = projetarAtivo(a, 10, {contrib:0, cresc:0, taxa:7, reinv:100});
  eq(p.fim.real, p.fim.valor/Math.pow(1.02, 10), "valor real desconta a inflação", 1);
  S.projecao.inflacao = 0;

  // Retorno muito negativo não rebenta
  semLancar(function(){ projetarAtivo(a, 10, {contrib:0, cresc:0, taxa:-99, reinv:100}); },
            "retorno de -99% não rebenta");
  semLancar(function(){ projetarAtivo(a, 40, {contrib:2000, cresc:15, taxa:15, reinv:100}); },
            "cenário extremo não rebenta");
  // Horizonte mínimo
  var curto = projetarAtivo(a, 1, {contrib:0, cresc:0, taxa:7, reinv:100});
  eq(curto.serie.length, 2, "um ano dá dois pontos");
})();

G("balanço patrimonial");
(function(){
  reporEstado();
  MES = isoMes(hoje());
  S.ativos = [
    {id:"b1", classe:"corrente", aquisicao:1000, atual:1000, quantidade:0, cotacao:0, encargos:[], rendimentos:[], aportes:[]},
    {id:"b2", classe:"etf", aquisicao:5000, atual:6000, quantidade:0, cotacao:0, encargos:[], rendimentos:[], aportes:[]},
    {id:"b3", classe:"imovel", aquisicao:100000, atual:100000, quantidade:0, cotacao:0, vpt:0, encargos:[], rendimentos:[], aportes:[]}
  ];
  S.creditos = [{id:"bc1", capital:50000, prazoMeses:120, inicio: mesShift(MES,-12)+"-01",
                 tipoTaxa:"fixa", taxaAnual:3, seguroMensal:0, ativoId:"b3"}];
  limparCacheCredito();

  var b = balanco();
  eq(b.carteira, 7000, "financeiros somam");
  eq(b.bens, 100000, "reais somam");
  eq(b.ativos, 107000, "total de ativos");
  eq(b.ativos, b.carteira + b.bens, "identidade do total");
  eq(b.liquido, b.ativos - b.divida, "identidade do líquido");
  ok(b.divida > 0 && b.divida < 50000, "dívida entre zero e o capital: " + b.divida);

  eq(totalLiquidez(), 1000, "liquidez só conta o grupo liquidez");
  eq(financeiros().length, 2, "dois ativos financeiros");
  eq(reais().length, 1, "um ativo real");

  // Sem nada, o balanço é zero e não rebenta
  S.ativos = []; S.creditos = []; limparCacheCredito();
  var vazio = balanco();
  eq(vazio.ativos, 0, "balanço vazio");
  eq(vazio.liquido, 0, "líquido vazio");
  eq(retornoCarteira(), 0, "retorno de carteira vazia não divide por zero");
  eq(carteiraAposCorrecao(), 0, "correção de carteira vazia");
})();

/* ============================================================
   6. Plano mensal — integração de tudo
   ============================================================ */
G("plano mensal");
(function(){
  reporEstado();
  MES = isoMes(hoje());
  // Taxa efetiva fixa, para que os totais do plano sejam conferíveis à mão.
  S.fiscal = Object.assign({}, FISCAL_PADRAO, {modoIRS:"efetiva"});
  S.rendimentos = [{id:"pr1", nome:"Salário", ativo:true, regime:"dependente", componentes:[
    {id:"pc1", especie:"base", nome:"Base", valor:2000, frequencia:"mensal",
     categoriaId: catPorNome("Vencimento"), ss:null, irs:null}]}];
  S.recorrentes = [{id:"pd1", tipo:"despesa", nome:"Renda", valor:600, frequencia:"mensal",
                    categoriaId: catPorNome("Habitação"), ativo:true, membroId:""}];
  S.ativos = []; S.creditos = []; limparCacheCredito();

  var p = planoMes(MES);
  eq(p.brutoRend, 2000, "bruto do plano");
  eq(p.rend, 2000, "rendimento entra bruto");
  eq(p.cargaRend, 220 + 300, "carga fiscal do rendimento");
  eq(p.desp, 600 + 520, "despesa inclui a carga fiscal");
  eq(p.saldo, 2000 - 1120, "saldo");

  // Identidade: as categorias somam ao que dizem somar
  var somaRend = 0, somaDesp = 0;
  Object.keys(p.porCat).forEach(function(id){
    var c = cat(id);
    if (!c) return;
    if (c.tipo === "rendimento") somaRend += p.porCat[id]; else somaDesp += p.porCat[id];
  });
  eq(somaRend, p.rend, "as categorias de rendimento somam ao rendimento");
  eq(somaDesp, p.desp, "as categorias de despesa somam à despesa");

  // Modo "só bruto"
  S.fiscal.contarIRS = false;
  var pb = planoMes(MES);
  eq(pb.rend, 2000, "só bruto: rendimento igual");
  eq(pb.desp, 600, "só bruto: sem carga fiscal na despesa");
  eq(pb.cargaRend, 0, "só bruto: carga zero");
  S.fiscal.contarIRS = true;

  // Crédito decomposto
  var cr = {id:"pcr", nome:"Crédito", capital:100000, prazoMeses:240, inicio: mesShift(MES,-12)+"-01",
            tipoTaxa:"fixa", taxaAnual:3, seguroMensal:20, ativoId:"",
            categoriaJurosId:"", categoriaCapitalId:"", categoriaSeguroId:""};
  S.creditos = [cr]; limparCacheCredito();
  p = planoMes(MES);
  var parc = parcelaMes(cr, MES);
  eq(p.porCat[catPorNome("Juros de crédito")], parc.juros, "juros na categoria certa");
  eq(p.porCat[catPorNome("Amortização de capital")], parc.capital, "amortização na categoria certa");
  eq(p.porCat[catPorNome("Seguros de crédito")], parc.seguro, "seguros na categoria certa");

  somaDesp = 0;
  Object.keys(p.porCat).forEach(function(id){
    var c = cat(id);
    if (c && c.tipo === "despesa") somaDesp += p.porCat[id];
  });
  eq(somaDesp, p.desp, "com crédito, as categorias continuam a somar à despesa");

  // A amortização conta como poupança na regra 50/30/20
  eq(cat(catPorNome("Amortização de capital")).grupo, "poupanca", "amortização é poupança");
  eq(cat(catPorNome("Juros de crédito")).grupo, "necessidades", "juros são necessidade");

  // Rendas de ativos, tributadas à taxa do contrato
  S.creditos = []; limparCacheCredito();
  S.ativos = [{id:"pa1", classe:"imovel", aquisicao:100000, atual:100000, quantidade:0, cotacao:0,
               vpt:50000, contratoAnos:10, encargos:[],
               rendimentos:[{id:"pr", nome:"Renda", valor:500, frequencia:"mensal", categoriaId:""}],
               aportes:[]}];
  p = planoMes(MES);
  eq(p.rendaAtivos, 500, "renda do ativo entra");
  eq(p.impostoRendas, 500*0.10, "renda de contrato de 10 anos tributada a 10%");
  eq(p.impostosAtivos, 50000*(parseNum(S.fiscal.imiTaxa)/100)/12, "IMI mensalizado");

  somaDesp = 0; somaRend = 0;
  Object.keys(p.porCat).forEach(function(id){
    var c = cat(id);
    if (!c) return;
    if (c.tipo === "rendimento") somaRend += p.porCat[id]; else somaDesp += p.porCat[id];
  });
  eq(somaRend, p.rend, "com rendas, as categorias de rendimento fecham");
  eq(somaDesp, p.desp, "com rendas e IMI, as categorias de despesa fecham");

  // Rubricas com início e fim
  S.recorrentes = [{id:"pd2", tipo:"despesa", nome:"Temporária", valor:100, frequencia:"mensal",
                    categoriaId: catPorNome("Habitação"), ativo:true, membroId:"",
                    inicio: mesShift(MES, 1)+"-01", fim:""}];
  ok(!recAtiva(S.recorrentes[0], MES), "rubrica que começa no mês seguinte não conta");
  ok(recAtiva(S.recorrentes[0], mesShift(MES,1)), "conta a partir do início");
  S.recorrentes[0].inicio = ""; S.recorrentes[0].fim = mesShift(MES,-1)+"-01";
  ok(!recAtiva(S.recorrentes[0], MES), "rubrica terminada não conta");
  S.recorrentes[0].ativo = false; S.recorrentes[0].fim = "";
  ok(!recAtiva(S.recorrentes[0], MES), "rubrica desativada não conta");
})();

G("plano sem dados");
(function(){
  // Estado explicitamente vazio: o teste não pode depender do que estava
  // carregado quando a suite arrancou.
  S = estadoVazio();
  limparCacheCredito();
  var p = planoMes(MES);
  eq(p.rend, 0, "sem dados, rendimento zero");
  eq(p.desp, 0, "sem dados, despesa zero");
  eq(p.saldo, 0, "sem dados, saldo zero");
  var r = realMes(MES);
  eq(r.rend, 0, "sem movimentos, real zero");
  var g = porGrupo(MES);
  eq(g.necessidades, 0, "sem movimentos, grupos a zero");
  ok(!temDados(), "temDados diz que não há dados");
})();

/* ============================================================
   7. Persistência e migração
   ============================================================ */
G("normalização e migração");
(function(){
  // Estado vazio é coerente
  var v = estadoVazio();
  ["membros","categorias","rendimentos","recorrentes","movimentos","objetivos","creditos","ativos"]
    .forEach(function(k){ ok(Array.isArray(v[k]), "estadoVazio: " + k + " é lista"); });
  ok(v.categorias.length > 0, "estadoVazio traz categorias-semente");
  ok(v.fiscal != null, "estadoVazio traz fiscalidade");

  // Objeto vazio não rebenta
  var n = normalizar({});
  ok(Array.isArray(n.ativos), "normalizar {} devolve listas");
  ok(n.fiscal.ssTrabalhador === 11, "normalizar {} traz taxas por omissão");

  // Migração da versão com investimentos e património
  var antigo = {
    version:1, membros:[{id:"m1", nome:"Ana"}], categorias:[], limites:{}, objetivos:[], movimentos:[],
    recorrentes:[
      {id:"r1", tipo:"rendimento", nome:"Vencimento Ana", valor:1500, frequencia:"catorze", membroId:"m1", ativo:true, categoriaId:""},
      {id:"r2", tipo:"rendimento", nome:"Subsídio de alimentação", valor:140, frequencia:"mensal", membroId:"m1", ativo:true, categoriaId:""},
      {id:"r3", tipo:"despesa", nome:"Supermercado", valor:500, frequencia:"mensal", ativo:true, categoriaId:""}
    ],
    investimentos:[
      {id:"iv1", nome:"ETF", classe:"fundos", investido:5000, atual:6000, quantidade:0, cotacao:0,
       reforcoMensal:100, retorno:"", queda:"", inicio:"2022-01-01"},
      {id:"iv2", nome:"DP", classe:"depositos", investido:3000, atual:3100, quantidade:0, cotacao:0,
       reforcoMensal:0, retorno:"", queda:"", inicio:"2023-01-01"}
    ],
    patrimonio:[{id:"pt1", nome:"Casa", tipo:"imovel", aquisicao:100000, dataAquisicao:"2020-01-01",
                 valorizacao:"", atual:0, creditoId:"cr1"}],
    creditos:[{id:"cr1", nome:"Hipoteca", capital:80000, taxaAnual:3, prazoMeses:300, inicio:"2020-01-01"}]
  };
  var m = normalizar(JSON.parse(JSON.stringify(antigo)));

  ok(m.investimentos === undefined, "a coleção investimentos desaparece");
  ok(m.patrimonio === undefined, "a coleção patrimonio desaparece");
  eq(m.ativos.length, 3, "os três ativos ficam numa só lista");
  eq(m.ativos.filter(function(a){return a.classe === "deposito";}).length, 1, "depositos renomeado para deposito");
  ok(m.ativos.every(function(a){ return Array.isArray(a.encargos) && Array.isArray(a.aportes); }),
     "todos os ativos ganham as coleções que faltavam");
  ok(m.ativos.every(function(a){ return a.tipo === undefined; }), "o campo tipo é substituído por classe");
  eq(m.creditos[0].ativoId, "pt1", "a ligação bem→crédito inverte-se");
  eq(m.creditos[0].tipoTaxa, "fixa", "créditos antigos ficam de taxa fixa");
  ok(m.ativos.every(function(a){ return a.creditoId === undefined; }), "creditoId removido do ativo");

  eq(m.rendimentos.length, 1, "os rendimentos agrupam-se por membro");
  eq(m.rendimentos[0].componentes.length, 2, "duas componentes migradas");
  eq(m.rendimentos[0].componentes[0].especie, "base", "vencimento reconhecido como base");
  eq(m.rendimentos[0].componentes[1].especie, "alimentacao", "subsídio de alimentação reconhecido");
  eq(m.rendimentos[0].regime, "dependente", "regime por omissão");
  eq(m.recorrentes.length, 1, "só a despesa fica nas rubricas");
  eq(m.recorrentes[0].tipo, "despesa", "e é mesmo despesa");

  ["Juros de crédito","Amortização de capital","Seguros de crédito","IRS e Segurança Social",
   "Manutenção e reparações","Vencimento"].forEach(function(nome){
    ok(m.categorias.some(function(c){ return c.nome === nome; }), "categoria acrescentada: " + nome);
  });

  eq(m.fiscal.pprLimiteAno, limitePPR(m.fiscal.pprIdade), "limite do PPR coerente com a idade");

  // Adivinhação de espécies
  eq(adivinhaEspecie("Subsídio de férias"), "ferias", "férias");
  eq(adivinhaEspecie("Subsidio de Natal"), "natal", "Natal sem acento");
  eq(adivinhaEspecie("Horas extra"), "extraordinario", "trabalho suplementar");
  eq(adivinhaEspecie("Prémio anual"), "premio", "prémio");
  eq(adivinhaEspecie("Comissões de vendas"), "comissao", "comissões");
  eq(adivinhaEspecie("Renda do T2"), "renda", "renda");
  eq(adivinhaEspecie("Juros do depósito"), "capitais", "juros");
  eq(adivinhaEspecie("Salário base"), "base", "salário");
  eq(adivinhaEspecie("Coisa qualquer"), "outro", "desconhecido");

  // Idempotência: normalizar duas vezes dá o mesmo
  var m2 = normalizar(JSON.parse(JSON.stringify(m)));
  eq(JSON.stringify(m2.ativos.length), JSON.stringify(m.ativos.length), "normalizar é idempotente nos ativos");
  eq(m2.rendimentos.length, m.rendimentos.length, "normalizar é idempotente nos rendimentos");
})();

G("planear despesa — a melhor altura");
(function(){
  reporEstado();
  // Um agregado simples e determinístico: 2000 € de rendimento, 1500 € de
  // despesa fixa, 500 € de saldo por mês, e 1000 € de liquidez inicial.
  var cat = S.categorias.filter(function(c){ return c.tipo === "despesa"; })[0].id;
  var catRend = S.categorias.filter(function(c){ return c.tipo === "rendimento"; })[0].id;
  S.membros.push({id:"m1", nome:"Ana"});
  S.rendimentos.push({id:"rd1", nome:"Vencimento", membroId:"m1", regime:"dependente", ativo:true,
    componentes:[{id:"c1", nome:"Base", especie:"base", valor:2000, frequencia:"mensal", categoriaId:catRend}]});
  S.fiscal.contarIRS = false;   // só bruto: a conta do teste fica à vista
  S.recorrentes.push({id:"r1", tipo:"despesa", nome:"Fixas", valor:1500, frequencia:"mensal",
    ativo:true, categoriaId:cat});
  S.ativos.push({id:"a1", nome:"Conta", classe:"corrente", aquisicao:1000, atual:1000,
    aportes:[], encargos:[], rendimentos:[]});

  var liq = totalLiquidez();
  var saldo = planoMes(MES).saldo;
  ok(saldo > 0, "o cenário de teste tem saldo positivo", saldo);

  // Sem valor não há análise
  eq(analisarPlaneada(0, 12), null, "sem verba não há análise");
  eq(analisarPlaneada(-50, 12), null, "verba negativa também não");

  var an = analisarPlaneada(1000, 12);
  eq(an.meses.length, 12, "analisa mês a mês o horizonte pedido");
  eq(an.trimestres.length, 4, "agrupados em trimestres");
  eq(an.horizonte, 12, "guarda o horizonte");
  eq(analisarPlaneada(1000, 7).horizonte, 12, "horizonte fora da lista cai nos 12 meses");
  eq(analisarPlaneada(1000, 24).trimestres.length, 8, "24 meses são oito trimestres");
  eq(analisarPlaneada(1000, 3).trimestres.length, 1, "3 meses são um trimestre");

  // A folga do mês i é o mínimo do acumulado de i em diante, menos a compra
  var t = tesourariaProjetada(12, []);
  var minSuf = t[t.length-1].acumulado;
  for (var j = t.length-1; j >= 0; j--) minSuf = Math.min(minSuf, t[j].acumulado);
  eq(an.meses[0].folga, Math.min.apply(null, t.map(function(s){ return s.acumulado; })) - 1000,
     "a folga do primeiro mês é o mínimo de toda a projeção menos a compra", 0.01);
  eq(an.meses[11].folga, t[11].acumulado - 1000, "a do último mês olha só para o último acumulado", 0.01);

  // Com saldo positivo o acumulado cresce, e a folga com ele
  var cresce = an.meses.every(function(m, i){ return i === 0 || m.folga >= an.meses[i-1].folga - 0.001; });
  ok(cresce, "com saldo positivo a folga nunca decresce ao longo do horizonte");

  // Cabe já: 1000 € contra 1000 € de liquidez e 500 €/mês de saldo
  eq(an.meses[0].folga, liq + saldo - 1000, "o primeiro mês já inclui o saldo desse mês", 0.01);
  ok(an.jaCabe === (an.meses[0].grau === 0), "«já cabe» é o primeiro mês estar verde");

  // Uma compra impossível não tem melhor altura
  var caro = analisarPlaneada(999999, 12);
  eq(caro.melhor, null, "o que não cabe em nenhum mês não tem melhor altura");
  ok(caro.trimestres.every(function(x){ return x.grau === 2; }), "e todos os trimestres ficam a vermelho");
  eq(veredictoPlaneada(caro).grau, 2, "o veredicto diz que não cabe");
  ok(/não cabe/i.test(veredictoPlaneada(caro).txt), "e diz-lo por palavras");

  // Uma compra que só cabe lá para a frente: o melhor mês é o primeiro verde
  var meio = analisarPlaneada(liq + saldo * 6, 24);
  if (ok(meio.melhor != null, "uma compra grande encontra altura num horizonte largo")){
    ok(!meio.jaCabe, "mas não cabe já");
    var iMelhor = meio.meses.indexOf(meio.melhor);
    ok(meio.meses.slice(0, iMelhor).every(function(m){ return m.grau > meio.melhor.grau; }),
       "não há mês anterior tão bom como o escolhido");
  }

  // Os graus: vermelho não cabe, amarelo cabe mas deixa menos de 3 meses de despesa
  var desp = planoMes(MES).desp;
  meio.meses.forEach(function(m){
    var esperado = m.folga < 0 ? 2 : (m.folga / desp) < 3 ? 1 : 0;
    eq(m.grau, esperado, "o grau segue a folga e a cobertura");
  });

  // O trimestre herda o melhor dos seus meses
  an.trimestres.forEach(function(tr){
    eq(tr.grau, Math.min.apply(null, tr.meses.map(function(m){ return m.grau; })),
       "o trimestre vale pelo seu melhor mês");
    ok(tr.meses.indexOf(tr.melhor) >= 0, "e o melhor mês pertence-lhe");
    eq(tr.de, tr.meses[0].mes, "com o primeiro mês do bloco");
    eq(tr.ate, tr.meses[tr.meses.length-1].mes, "e o último");
  });

  // Compras já marcadas gastam o mesmo dinheiro uma só vez
  S.planeadas.push({id:"pl1", nome:"Carro", valor:5000, categoriaId:cat, horizonte:12,
    mes: mesShift(MES, 2), objetivoId:"", feitaEm:"", membroId:"", criadoEm:""});
  eq(eventosPlaneados().length, 1, "uma compra marcada é um evento de tesouraria");
  eq(eventosPlaneados("pl1").length, 0, "menos quando é ela própria a ser analisada");
  var comCarro = tesourariaProjetada(12);
  eq(comCarro[2].compras, 5000, "a compra pesa no mês em que está marcada");
  eq(comCarro[2].saldo, comCarro[1].saldo - 5000, "e sai do saldo desse mês", 0.01);
  eq(comCarro[11].acumulado, tesourariaProjetada(12, [])[11].acumulado - 5000,
     "o acumulado final fica 5000 € abaixo", 0.01);
  var outra = analisarPlaneada(1000, 12, null);
  ok(outra.meses[11].folga < an.meses[11].folga - 4999,
     "outra compra vê a primeira já descontada", outra.meses[11].folga+" vs "+an.meses[11].folga);

  // Marcada mas já realizada deixa de contar
  S.planeadas[0].feitaEm = isoDia(hoje());
  eq(eventosPlaneados().length, 0, "uma compra realizada já não pesa no futuro");
  S.planeadas[0].feitaEm = "";
  // Sem mês marcado também não
  S.planeadas[0].mes = "";
  eq(eventosPlaneados().length, 0, "nem uma compra sem data");
  S.planeadas[0].mes = mesShift(MES, 2);

  // Reserva mensal: o que falta, dividido pelos meses até lá
  var p = S.planeadas[0];
  eq(reservaMensalPlaneada(p), 5000 / 2, "a reserva mensal divide pela distância ao mês marcado", 0.01);
  eq(reservaMensalPlaneada(p, mesShift(MES, 10)), 500, "e acompanha outra data que se lhe dê", 0.01);
  eq(reservaMensalPlaneada({valor:1000, mes:""}), 0, "sem data não há reserva mensal");
  eq(reservaMensalPlaneada({valor:1000, mes:MES}), 1000, "marcada para este mês, é tudo de uma vez");
  // Com objetivo ligado, só falta o que ainda não está lá
  S.objetivos.push({id:"ob1", nome:"Reserva: Carro", alvo:5000, atual:3000, ativoId:"", prazo:"", cor:"#000"});
  p.objetivoId = "ob1";
  eq(reservaMensalPlaneada(p), 1000, "o já poupado desconta-se do esforço mensal", 0.01);
  S.objetivos[0].atual = 9000;
  eq(reservaMensalPlaneada(p), 0, "e nunca fica negativo");

  // Um objetivo que desapareceu não deixa a compra a apontar para o vazio
  var norm = normalizar(JSON.parse(JSON.stringify(Object.assign({}, S, {objetivos: []}))));
  eq(norm.planeadas[0].objetivoId, "", "normalizar limpa a reserva órfã");
  eq(norm.planeadas.length, 1, "sem perder a compra");

  // Normalização das compras planeadas
  var n2 = normalizar({planeadas:[
    {id:"x", nome:"", valor:"1.234,50", horizonte:"6", mes:"2026-13", objetivoId:5},
    {nome:"sem id"},
    {id:"y", horizonte:99, mes:"2027-03"},
  ]});
  eq(n2.planeadas.length, 2, "uma compra sem id não sobrevive");
  eq(n2.planeadas[0].valor, 1234.5, "o valor passa por parseNum");
  eq(n2.planeadas[0].nome, "Compra planeada", "e um nome vazio ganha um nome");
  eq(n2.planeadas[0].horizonte, 6, "o horizonte em texto é aceite");
  eq(n2.planeadas[0].mes, "", "um mês impossível é descartado");
  eq(n2.planeadas[1].horizonte, 12, "um horizonte fora da lista cai nos 12");
  eq(n2.planeadas[1].mes, "2027-03", "e um mês válido mantém-se");
  ok(mesValido("2026-01") && mesValido("2026-12"), "janeiro e dezembro são meses");
  ok(!mesValido("2026-00") && !mesValido("2026-13") && !mesValido("2026-99"),
     "zero, treze e noventa e nove não são");
  ok(!mesValido("") && !mesValido(null) && !mesValido("2026") && !mesValido("2026-1"),
     "nem o vazio, o nulo ou a forma truncada");
  ok(normalizar({}).planeadas.length === 0, "sem compras a lista existe na mesma");
  ok(Array.isArray(estadoVazio().planeadas), "e o estado vazio já a traz");

  // O veredicto fala consoante o caso — de novo sem nada marcado, que a
  // esta altura já há um carro de 5000 € a ocupar a tesouraria. E com
  // liquidez a sério: com 1000 € na conta, nem 10 € «cabem» à vontade,
  // porque a folga que interessa é a que sobra, não a que passa.
  S.planeadas = [];
  S.ativos[0].atual = 20000;
  var pequena = analisarPlaneada(10, 12);
  eq(veredictoPlaneada(pequena).grau, 0, "o que cabe hoje é verde");
  ok(/cabe hoje/i.test(veredictoPlaneada(pequena).txt), "e diz que cabe hoje");
  ok(pequena.jaCabe, "e é mesmo do caso «já cabe»");
  // Com pouca liquidez, uma ninharia deixa de ser confortável: 1000 € na
  // conta contra 1500 € de despesa mensal não dá os 3 meses de referência
  S.ativos[0].atual = 1000;
  eq(analisarPlaneada(10, 12).meses[0].grau, 1, "com reserva curta, até o barato fica a amarelo");
  ok(!analisarPlaneada(10, 12).jaCabe, "e não conta como «já cabe»");

  reporEstado();
})();

G("passe de cálculo");
(function(){
  reporEstado();
  S = estadoVazio(); carregarExemplo(); MES = isoMes(hoje());

  // Fora de uma passagem não há cache: cada chamada recalcula
  var n = 0;
  var orig = calcularPlanoMes;
  calcularPlanoMes = function(m){ n++; return orig(m); };
  planoMes(MES); planoMes(MES); planoMes(MES);
  eq(n, 3, "fora de uma passagem, cada chamada recalcula");

  // Dentro de uma passagem, o mesmo mês só é calculado uma vez
  n = 0;
  emPasse(function(){ planoMes(MES); planoMes(MES); planoMes(MES); });
  eq(n, 1, "dentro de uma passagem, o mesmo mês calcula-se uma só vez");

  // Meses diferentes continuam a ser calculados separadamente
  n = 0;
  emPasse(function(){ planoMes(MES); planoMes(mesShift(MES,-1)); planoMes(mesShift(MES,-2)); });
  eq(n, 3, "meses diferentes calculam-se separadamente");

  // E o resultado é o mesmo com e sem cache
  var semCache = orig(MES);
  var comCache = emPasse(function(){ return planoMes(MES); });
  eq(comCache.rend, semCache.rend, "a cache não altera o rendimento");
  eq(comCache.desp, semCache.desp, "nem a despesa");
  eq(comCache.saldo, semCache.saldo, "nem o saldo");
  calcularPlanoMes = orig;

  /* O mesmo para os movimentos reais: o painel pede o mesmo mês dezenas
     de vezes (tesouraria e mapa anual pedem doze cada), e sem cache cada
     pedido varria a lista inteira de movimentos. */
  var semCacheReal = (function(){
    var r = null;
    // Fora do passe não há cache — serve de referência
    r = realMes(MES);
    return {rend: r.rend, desp: r.desp, saldo: r.saldo, itens: r.itens.length};
  })();
  var comCacheReal = emPasse(function(){
    realMes(MES); realMes(MES);            // segunda e terceira vêm da cache
    var r = realMes(MES);
    return {rend: r.rend, desp: r.desp, saldo: r.saldo, itens: r.itens.length};
  });
  eq(comCacheReal.rend, semCacheReal.rend, "a cache dos movimentos não altera o rendimento");
  eq(comCacheReal.desp, semCacheReal.desp, "nem a despesa");
  eq(comCacheReal.saldo, semCacheReal.saldo, "nem o saldo");
  eq(comCacheReal.itens, semCacheReal.itens, "nem o número de movimentos");

  // Meses diferentes não se confundem dentro do mesmo passe
  emPasse(function(){
    var a = realMes(MES), b = realMes(mesShift(MES, -1));
    ok(a !== b, "meses diferentes têm resultados distintos na cache");
  });

  // A cache não sobrevive ao passe: um movimento novo é visto logo a seguir
  emPasse(function(){ realMes(MES); });
  var despAntes = realMes(MES).desp;
  S.movimentos.push({id:"qa-cache", data: MES+"-01", tipo:"despesa", descricao:"Cache QA",
    valor: 123.45, categoriaId:"", membroId:""});
  eq(realMes(MES).desp, despAntes + 123.45, "fora do passe, a cache não esconde movimentos novos", 0.001);
  S.movimentos = S.movimentos.filter(function(m){ return m.id !== "qa-cache"; });

  // A passagem fecha-se mesmo quando o corpo lança
  var lancou = false;
  try { emPasse(function(){ throw new Error("teste"); }); } catch(e){ lancou = true; }
  ok(lancou, "a exceção propaga-se");
  n = 0;
  var orig2 = calcularPlanoMes;
  calcularPlanoMes = function(m){ n++; return orig2(m); };
  planoMes(MES); planoMes(MES);
  eq(n, 2, "e a passagem ficou fechada, sem cache pendurada");
  calcularPlanoMes = orig2;

  // Passagens aninhadas não fecham a cache do nível de cima cedo demais
  n = 0;
  var orig3 = calcularPlanoMes;
  calcularPlanoMes = function(m){ n++; return orig3(m); };
  emPasse(function(){
    planoMes(MES);
    emPasse(function(){ planoMes(MES); });
    planoMes(MES);
  });
  eq(n, 1, "passagens aninhadas partilham a mesma cache");
  calcularPlanoMes = orig3;

  // Alterar o estado entre passagens produz valores novos
  var antes = emPasse(function(){ return planoMes(MES).desp; });
  S.recorrentes.push({id:"novo", tipo:"despesa", nome:"X", valor:500, frequencia:"mensal",
                      categoriaId: catPorNome("Habitação"), ativo:true, membroId:""});
  var depois = emPasse(function(){ return planoMes(MES).desp; });
  ok(Math.abs(depois - antes - 500) < 0.01, "uma passagem nova vê o estado novo",
     antes + " → " + depois);

  // O mesmo para a fiscalidade e para o valor dos ativos
  var rd = S.rendimentos[0];
  var f1 = emPasse(function(){ return fiscalRendimento(rd); });
  var f2 = emPasse(function(){ return fiscalRendimento(rd); });
  eq(f2.bruto, f1.bruto, "fiscalRendimento é estável entre passagens");
  ok(f1 !== f2, "e cada passagem produz o seu próprio objeto");

  var a = S.ativos[0];
  var v1 = emPasse(function(){ return valorAtivo(a); });
  a.atual = parseNum(a.atual) + 1000;
  var v2 = emPasse(function(){ return valorAtivo(a); });
  ok(v2 !== v1, "valorAtivo acompanha alterações entre passagens", v1 + " → " + v2);
})();

G("dia do mês e linha do mês");
(function(){
  eq(diaDoMesValido(5), 5, "o dia 5 é válido");
  eq(diaDoMesValido("12"), 12, "e aceita texto");
  eq(diaDoMesValido(0), "", "o dia 0 não existe");
  eq(diaDoMesValido(32), "", "nem o 32");
  eq(diaDoMesValido("abc"), "", "nem letras");
  eq(diaDoMesValido(null), "", "nem nada");
  eq(diaDoMesValido(15.6), 16, "arredonda ao dia mais próximo");

  // Um dia 31 encosta ao último dia do mês, como faz o banco
  eq(diaNoMes(31, "2026-02"), 28, "o dia 31 em fevereiro é 28");
  eq(diaNoMes(31, "2024-02"), 29, "e 29 num ano bissexto");
  eq(diaNoMes(31, "2026-04"), 30, "e 30 em abril");
  eq(diaNoMes(15, "2026-07"), 15, "um dia que existe fica igual");
  eq(diaNoMes("", "2026-07"), 0, "sem dia não há dia");

  var guardado = JSON.stringify(S);
  S = estadoVazio(); MES = isoMes(hoje());
  var cat = catPorNome("Alimentação");
  S.recorrentes.push({id:"r1", tipo:"despesa", nome:"Renda", valor:600, frequencia:"mensal",
    ativo:true, categoriaId:cat, membroId:"", dia:1});
  S.recorrentes.push({id:"r2", tipo:"despesa", nome:"Luz", valor:60, frequencia:"mensal",
    ativo:true, categoriaId:cat, membroId:"", dia:12});
  S.recorrentes.push({id:"r3", tipo:"despesa", nome:"Sem dia", valor:99, frequencia:"mensal",
    ativo:true, categoriaId:cat, membroId:"", dia:""});
  S.recorrentes.push({id:"r4", tipo:"rendimento", nome:"Salário", valor:1500, frequencia:"mensal",
    ativo:true, categoriaId:cat, membroId:"", dia:23});
  var ev = eventosDoMes(MES);
  eq(ev.dias.length, 3, "só as rubricas com dia entram na linha do mês");
  eq(ev.dias[0].dia, 1, "ordenadas por dia");
  eq(ev.dias[0].despesa, 600, "com o valor do dia");
  eq(ev.totalDespesa, 660, "e o total só conta as despesas", 0.01);
  eq(ev.totalRendimento, 1500, "os rendimentos contam à parte", 0.01);
  ok(ev.dias.every(function(d){ return d.dia >= 1 && d.dia <= ev.ultimo; }),
     "nenhum dia cai fora do mês");

  // Uma compra planeada marcada entra no último dia
  S.planeadas.push({id:"p1", nome:"Sofá", valor:800, categoriaId:cat, horizonte:12,
    mes:MES, objetivoId:"", feitaEm:"", membroId:"", criadoEm:""});
  var ev2 = eventosDoMes(MES);
  var ultimoDia = ev2.dias[ev2.dias.length-1];
  eq(ultimoDia.dia, ev2.ultimo, "a compra planeada cai no último dia do mês");
  ok(ultimoDia.itens.some(function(i){ return /Sofá/.test(i.nome); }), "com o nome da compra");
  // Uma compra já realizada não entra
  S.planeadas[0].feitaEm = isoDia(hoje());
  eq(eventosDoMes(MES).dias.length, 3, "uma compra já feita sai da linha do mês");

  S = JSON.parse(guardado); limparCacheCredito();
})();

G("previsão de fecho do mês");
(function(){
  var guardado = JSON.stringify(S);
  var mesGuardado = MES;
  S = estadoVazio(); MES = isoMes(hoje());
  var cat = catPorNome("Alimentação");
  var catR = S.categorias.filter(function(c){ return c.tipo === "rendimento"; })[0].id;

  // Sem movimentos não se prevê nada — melhor calar do que inventar
  ok(preverFechoMes() === null, "sem movimentos não há previsão");

  // Um mês a decorrer, com histórico regular atrás
  for (var i = 1; i <= 4; i++){
    var m = mesShift(MES, -i);
    S.movimentos.push({id:"h"+i, data:m+"-10", tipo:"despesa", descricao:"Gasto",
      categoriaId:cat, membroId:"", valor:800});
    S.movimentos.push({id:"hr"+i, data:m+"-01", tipo:"rendimento", descricao:"Salário",
      categoriaId:catR, membroId:"", valor:2000});
  }
  S.movimentos.push({id:"a1", data:MES+"-02", tipo:"despesa", descricao:"Gasto",
    categoriaId:cat, membroId:"", valor:300});
  S.movimentos.push({id:"a2", data:MES+"-01", tipo:"rendimento", descricao:"Salário",
    categoriaId:catR, membroId:"", valor:2000});
  limparCacheCredito();

  var f = preverFechoMes();
  ok(f != null, "com movimentos há previsão");
  ok(f.dia >= 1 && f.dia <= f.ultimo, "o dia está dentro do mês", f.dia+"/"+f.ultimo);
  eq(f.rendPrev - f.despPrev, f.saldoPrev, "o saldo previsto fecha as contas", 0.01);
  ok(f.despPrev >= realMes(MES).desp - 0.01, "a despesa prevista nunca é menor do que a já feita");
  ok(f.decorrido > 0 && f.decorrido <= 1, "a fração decorrida está entre 0 e 1", f.decorrido);
  ok(f.margem >= 0, "a margem não é negativa", f.margem);
  ok(f.mesesHistorico >= 2, "usou o histórico para a margem", f.mesesHistorico);
  ok(isFinite(f.ritmoDia) && f.ritmoDia >= 0, "o ritmo diário é um número não negativo", f.ritmoDia);

  // Num mês que não é o corrente não há previsão: o mês está fechado
  MES = mesShift(isoMes(hoje()), -1);
  ok(preverFechoMes() === null, "um mês passado não se prevê");
  MES = mesShift(isoMes(hoje()), 1);
  ok(preverFechoMes() === null, "nem um mês futuro");

  MES = mesGuardado; S = JSON.parse(guardado); limparCacheCredito();
})();

G("previsão: rubricas já lançadas não contam duas vezes");
(function(){
  /* «Lançar plano deste mês» cria um movimento por rubrica. Sem ligar o
     movimento à rubrica, a previsão somava a rubrica outra vez ao que ela
     própria gerou, e ainda tomava esse movimento por despesa variável —
     inflando o ritmo diário. Era o caso de quem usa o botão de lançar. */
  var guardado = JSON.stringify(S);
  var mesGuardado = MES;
  S = estadoVazio(); MES = isoMes(hoje());
  var cat = catPorNome("Alimentação"), rest = catPorNome("Restauração");
  var catR = S.categorias.filter(function(c){ return c.tipo === "rendimento"; })[0].id;
  var hj = hoje().getDate();
  var ultimo = new Date(+MES.split("-")[0], +MES.split("-")[1], 0).getDate();
  var diaPassado = Math.max(1, hj - 3), diaFuturo = Math.min(ultimo, hj + 5);

  S.recorrentes.push({id:"rp", tipo:"despesa", nome:"Já saiu", valor:200, frequencia:"mensal",
    ativo:true, categoriaId:cat, membroId:"", dia:diaPassado});
  S.recorrentes.push({id:"rf", tipo:"despesa", nome:"Ainda falta", valor:300, frequencia:"mensal",
    ativo:true, categoriaId:cat, membroId:"", dia:diaFuturo});
  S.recorrentes.push({id:"rs", tipo:"despesa", nome:"Sem dia nenhum", valor:80, frequencia:"mensal",
    ativo:true, categoriaId:cat, membroId:"", dia:""});
  for (var i = 1; i <= 3; i++){
    var m = mesShift(MES, -i);
    S.movimentos.push({id:"h"+i, data:m+"-10", tipo:"despesa", descricao:"G",
      categoriaId:cat, membroId:"", valor:500});
    S.movimentos.push({id:"hr"+i, data:m+"-01", tipo:"rendimento", descricao:"S",
      categoriaId:catR, membroId:"", valor:2000});
  }
  S.movimentos.push({id:"rend", data:MES+"-01", tipo:"rendimento", descricao:"Salário",
    categoriaId:catR, membroId:"", valor:2000});
  limparCacheCredito();

  // Antes de lançar: as três rubricas contam, incluindo a que não tem dia
  var f1 = preverFechoMes();
  eq(f1.fixasPorSair, 580, "por sair conta as três rubricas, com dia ou sem ele", 0.01);
  eq(f1.despPrev, 580, "e a despesa prevista é a soma delas", 0.01);
  eq(rubricasLancadas(MES).size, 0, "nenhuma está lançada ainda");

  // Depois de lançar: os movimentos existem, e nada é contado duas vezes
  S.movimentos.push({id:"m1", data:MES+"-"+String(diaPassado).padStart(2,"0"), tipo:"despesa",
    descricao:"Já saiu", categoriaId:cat, membroId:"", valor:200});
  S.movimentos.push({id:"m2", data:MES+"-"+String(diaFuturo).padStart(2,"0"), tipo:"despesa",
    descricao:"Ainda falta", categoriaId:cat, membroId:"", valor:300});
  S.movimentos.push({id:"m3", data:MES+"-02", tipo:"despesa",
    descricao:"Sem dia nenhum", categoriaId:cat, membroId:"", valor:80});
  limparCacheCredito();

  eq(rubricasLancadas(MES).size, 3, "as três rubricas ficam ligadas aos seus movimentos");
  var f2 = preverFechoMes();
  eq(realMes(MES).desp, 580, "a despesa real é a soma dos movimentos", 0.01);
  eq(f2.fixasPorSair, 0, "já não falta sair nada");
  eq(f2.ritmoDia, 0, "e nada disto é despesa variável");
  eq(f2.despPrev, 580, "a previsão continua a dizer 580 €, não 1160 €", 0.01);

  // Lançamento parcial: só a renda lançada, e jantares por fora
  S = estadoVazio(); MES = isoMes(hoje());
  S.recorrentes.push({id:"r1", tipo:"despesa", nome:"Renda", valor:600, frequencia:"mensal",
    ativo:true, categoriaId:cat, membroId:"", dia:1});
  S.recorrentes.push({id:"r2", tipo:"despesa", nome:"Luz", valor:90, frequencia:"mensal",
    ativo:true, categoriaId:cat, membroId:"", dia:20});
  for (i = 1; i <= 3; i++){
    S.movimentos.push({id:"g"+i, data:mesShift(MES,-i)+"-10", tipo:"despesa", descricao:"G",
      categoriaId:cat, membroId:"", valor:800});
    S.movimentos.push({id:"gr"+i, data:mesShift(MES,-i)+"-01", tipo:"rendimento", descricao:"S",
      categoriaId:catR, membroId:"", valor:2000});
  }
  S.movimentos.push({id:"p1", data:MES+"-01", tipo:"despesa", descricao:"Renda",
    categoriaId:cat, membroId:"", valor:600});
  S.movimentos.push({id:"p2", data:MES+"-05", tipo:"despesa", descricao:"Jantares",
    categoriaId:rest, membroId:"", valor:150});
  S.movimentos.push({id:"p3", data:MES+"-01", tipo:"rendimento", descricao:"Salário",
    categoriaId:catR, membroId:"", valor:2000});
  limparCacheCredito();

  var lanc = rubricasLancadas(MES);
  ok(lanc.has("r1"), "a renda lançada fica ligada");
  ok(!lanc.has("r2"), "a luz por lançar continua por lançar");
  var f3 = preverFechoMes();
  eq(f3.fixasPorSair, 90, "falta sair só a luz", 0.01);
  eq(f3.ritmoDia * hj, 150, "e a despesa variável são só os jantares", 0.5);
  eq(f3.rendPrev - f3.despPrev, f3.saldoPrev, "as contas fecham", 0.01);

  // O casamento é por descrição e valor: um valor diferente não casa
  S.movimentos.push({id:"p4", data:MES+"-07", tipo:"despesa", descricao:"Luz",
    categoriaId:cat, membroId:"", valor:45});
  limparCacheCredito();
  ok(!rubricasLancadas(MES).has("r2"), "um movimento com o mesmo nome mas outro valor não casa");

  // E cada movimento casa com uma rubrica só
  S.movimentos.push({id:"p5", data:MES+"-08", tipo:"despesa", descricao:"Renda",
    categoriaId:cat, membroId:"", valor:600});
  limparCacheCredito();
  var l2 = rubricasLancadas(MES);
  eq(l2.get("r1"), 600, "a renda conta uma vez, mesmo com dois movimentos iguais");
  eq(l2.size, 1, "e não aparecem rubricas a mais");

  // Uma rubrica de valor negativo não faz o mês fechar abaixo do já gasto
  S = estadoVazio(); MES = isoMes(hoje());
  S.recorrentes.push({id:"neg", tipo:"despesa", nome:"Estranha", valor:-5000,
    frequencia:"mensal", ativo:true, categoriaId:cat, membroId:"", dia:""});
  S.movimentos.push({id:"n1", data:MES+"-03", tipo:"despesa", descricao:"Real",
    categoriaId:cat, membroId:"", valor:900});
  S.movimentos.push({id:"n2", data:MES+"-01", tipo:"rendimento", descricao:"S",
    categoriaId:catR, membroId:"", valor:2000});
  limparCacheCredito();
  var f4 = preverFechoMes();
  ok(f4.fixasPorSair >= 0, "o que falta sair nunca é negativo", f4.fixasPorSair);
  ok(f4.despPrev >= realMes(MES).desp - 0.01,
     "e a previsão nunca fica abaixo do que já se gastou",
     f4.despPrev + " vs " + realMes(MES).desp);

  MES = mesGuardado; S = JSON.parse(guardado); limparCacheCredito();
})();

G("anomalias com sazonalidade");
(function(){
  var guardado = JSON.stringify(S);
  var mesGuardado = MES;
  S = estadoVazio();
  // Julho, para o homólogo cair sempre no mesmo mês do calendário
  MES = "2026-07";
  var luz = catPorNome("Eletricidade e gás");
  var catR = S.categorias.filter(function(c){ return c.tipo === "rendimento"; })[0].id;

  // Três anos de luz sazonal: 120 € no inverno, 55 € no verão. Três, e não
  // dois, porque a base «sazonal» exige dois meses homólogos — com só um, a
  // referência passa a «misto» de propósito, e é isso que se testa a seguir.
  for (var k = 1; k <= 38; k++){
    var m = mesShift(MES, -k);
    var mes = parseInt(m.split("-")[1], 10);
    var inverno = (mes <= 3 || mes >= 11);
    S.movimentos.push({id:"lz"+k, data:m+"-12", tipo:"despesa", descricao:"Luz",
      categoriaId:luz, membroId:"", valor: inverno ? 120 : 55});
    S.movimentos.push({id:"rd"+k, data:m+"-01", tipo:"rendimento", descricao:"Salário",
      categoriaId:catR, membroId:"", valor:2000});
  }
  // Julho corrente: 58 €, praticamente igual aos julhos anteriores
  S.movimentos.push({id:"lzA", data:MES+"-12", tipo:"despesa", descricao:"Luz",
    categoriaId:luz, membroId:"", valor:58});
  S.movimentos.push({id:"rdA", data:MES+"-01", tipo:"rendimento", descricao:"Salário",
    categoriaId:catR, membroId:"", valor:2000});
  limparCacheCredito();

  var ref = esperadoCategoria(luz, MES);
  ok(ref != null, "há referência para a categoria");
  eq(ref.base, "sazonal", "com dois julhos anteriores, a base é sazonal");
  eq(ref.esperado, 55, "e o esperado é o julho típico, não a média do ano");
  ok(ref.n >= 2, "com pelo menos duas observações", ref.n);

  // A mediana ingénua dos últimos seis meses misturaria o inverno
  var recentes = [];
  for (k = 1; k <= 6; k++){
    var rr = realMes(mesShift(MES, -k));
    if (rr.rend > 0 || rr.desp > 0) recentes.push(rr.porCat[luz] || 0);
  }
  var medIngenua = mediana(recentes);
  ok(medIngenua > ref.esperado, "a mediana recente é enviesada pelo inverno",
     medIngenua + " vs " + ref.esperado);

  // E por isso a luz de verão não é anomalia — era com a mediana ingénua
  var an = anomaliasMes(MES);
  ok(!an.some(function(a){ return a.cat.id === luz; }),
     "a luz de verão não é anomalia com sazonalidade");
  ok(Math.abs((58 - medIngenua) / medIngenua * 100) >= ANOMALIA_PCT,
     "mas seria falso alarme sem ela",
     Math.round((58 - medIngenua) / medIngenua * 100) + "%");

  // Num mês de inverno, o inverno também é normal. O ciclo acima já pôs
  // 120 € em janeiro de 2026 — não se acrescenta nada, senão somava-se ao
  // que já lá está e o mês passava a ser mesmo uma anomalia.
  MES = "2026-01";
  eq(realMes(MES).porCat[luz], 120, "janeiro tem a luz de inverno que o ciclo criou");
  var refI = esperadoCategoria(luz, MES);
  eq(refI.base, "sazonal", "em janeiro a base também é sazonal");
  eq(refI.esperado, 120, "e o esperado é o janeiro típico");
  ok(!anomaliasMes(MES).some(function(a){ return a.cat.id === luz; }),
     "a luz de inverno também não é anomalia");

  // Uma categoria que dobra a sério é anomalia
  MES = "2026-07";
  var rest = catPorNome("Restauração");
  for (k = 1; k <= 38; k++){
    S.movimentos.push({id:"rs"+k, data:mesShift(MES,-k)+"-20", tipo:"despesa",
      descricao:"Jantar", categoriaId:rest, membroId:"", valor:90});
  }
  S.movimentos.push({id:"rsA", data:MES+"-20", tipo:"despesa", descricao:"Jantares",
    categoriaId:rest, membroId:"", valor:210});
  limparCacheCredito();
  var an2 = anomaliasMes(MES);
  var aRest = an2.filter(function(a){ return a.cat.id === rest; })[0];
  ok(aRest != null, "uma categoria que mais que dobra é anomalia");
  if (aRest){
    ok(aRest.acima, "marcada como acima do habitual");
    ok(aRest.pct > 100, "com o desvio calculado", Math.round(aRest.pct)+"%");
    eq(aRest.gasto, 210, "o gasto é o real");
    eq(aRest.esperado, 90, "e o esperado é o habitual do mês");
  }
  // A dupla fasquia: muita percentagem em poucos euros não conta
  var cafe = catPorNome("Restauração");
  ok(ANOMALIA_EUR >= 10, "há uma fasquia absoluta em euros", ANOMALIA_EUR);
  ok(ANOMALIA_PCT >= 20, "e uma fasquia relativa", ANOMALIA_PCT);
  ok(an2.every(function(a){ return Math.abs(a.dif) >= ANOMALIA_EUR; }),
     "toda a anomalia passa a fasquia em euros");
  ok(an2.every(function(a){ return Math.abs(a.pct) >= ANOMALIA_PCT; }),
     "e a fasquia em percentagem");
  // Ordenadas pelo que mais pesa em euros
  for (var i = 1; i < an2.length; i++){
    ok(Math.abs(an2[i-1].dif) >= Math.abs(an2[i].dif), "ordenadas por desvio absoluto");
  }
  // Com um único mês homólogo, a base é «misto»: um ano não faz padrão
  // sazonal, mas é informação a mais e entra na mistura.
  S = estadoVazio(); MES = "2026-07";
  for (k = 1; k <= 14; k++){
    S.movimentos.push({id:"u"+k, data:mesShift(MES,-k)+"-12", tipo:"despesa", descricao:"Luz",
      categoriaId:luz, membroId:"", valor: 60});
    S.movimentos.push({id:"ur"+k, data:mesShift(MES,-k)+"-01", tipo:"rendimento", descricao:"Salário",
      categoriaId:catR, membroId:"", valor:2000});
  }
  S.movimentos.push({id:"uA", data:MES+"-12", tipo:"despesa", descricao:"Luz",
    categoriaId:luz, membroId:"", valor:62});
  limparCacheCredito();
  var refM = esperadoCategoria(luz, MES);
  eq(refM.base, "misto", "com um só homólogo a base é misto");
  ok(refM.n > 2, "e usa mais observações do que o homólogo sozinho", refM.n);
  ok(BASE_ANOMALIA[refM.base] != null, "cada base tem descrição em palavras");
  Object.keys(BASE_ANOMALIA).forEach(function(b){
    ok(typeof BASE_ANOMALIA[b] === "string" && BASE_ANOMALIA[b].length > 5,
       "a base «"+b+"» explica-se em palavras");
  });

  // Sem histórico não há referência, e portanto não há anomalia
  S = estadoVazio(); MES = isoMes(hoje());
  S.movimentos.push({id:"so1", data:MES+"-05", tipo:"despesa", descricao:"Único",
    categoriaId:luz, membroId:"", valor:500});
  limparCacheCredito();
  ok(esperadoCategoria(luz, MES) === null, "sem meses anteriores não há esperado");
  eq(anomaliasMes(MES).length, 0, "e sem esperado não há anomalias");

  MES = mesGuardado; S = JSON.parse(guardado); limparCacheCredito();
})();

G("subscrições, inflação pessoal e medianas");
(function(){
  var guardado = JSON.stringify(S);
  var mesGuardado = MES;

  // Mediana
  eq(mediana([]), 0, "a mediana de nada é zero");
  eq(mediana([5]), 5, "de um só valor é ele próprio");
  eq(mediana([1,3]), 2, "de dois é a média deles");
  eq(mediana([1,2,3]), 2, "de três ímpares é o do meio");
  eq(mediana([1,2,3,10]), 2.5, "e não se deixa arrastar pelo extremo");
  eq(mediana([3,1,2]), 2, "ordena antes de escolher");
  eq(mediana([1,NaN,3]), 2, "ignora o que não é número");

  S = estadoVazio(); MES = isoMes(hoje());
  var catSub = catPorNome("Subscrições");
  ["Netflix","Spotify","Nuvem"].forEach(function(n, i){
    S.recorrentes.push({id:"s"+i, tipo:"despesa", nome:n, valor:[8.99,6.99,4.99][i],
      frequencia:"mensal", ativo:true, categoriaId:catSub, membroId:"", dia:15});
  });
  // Uma despesa grande não é subscrição
  S.recorrentes.push({id:"big", tipo:"despesa", nome:"Renda", valor:700,
    frequencia:"mensal", ativo:true, categoriaId:catPorNome("Habitação"), membroId:"", dia:1});
  // Nem uma anual
  S.recorrentes.push({id:"an", tipo:"despesa", nome:"Seguro", valor:40,
    frequencia:"anual", ativo:true, categoriaId:catPorNome("Seguros"), membroId:"", dia:""});
  limparCacheCredito();

  var subs = subscricoes();
  eq(subs.length, 3, "só as mensais pequenas contam como subscrição");
  ok(subs.every(function(x){ return x.mensal <= SUBSCRICAO_TETO; }), "todas abaixo do tecto");
  eq(subs[0].anual, subs[0].mensal * 12, "o anual é o mensal × 12", 0.01);
  ok(subs[0].anual >= subs[subs.length-1].anual, "ordenadas pelo custo anual");
  var totalAno = subs.reduce(function(s,x){ return s + x.anual; }, 0);
  eq(totalAno, (8.99+6.99+4.99)*12, "o total ao ano soma as três", 0.01);

  // Inflação pessoal
  S = estadoVazio(); MES = "2026-07";
  var cat = catPorNome("Alimentação");
  var catR = S.categorias.filter(function(c){ return c.tipo === "rendimento"; })[0].id;
  ok(inflacaoPessoal(MES) === null, "sem mês homólogo não há inflação pessoal");
  S.movimentos.push({id:"i1", data:"2025-07-05", tipo:"despesa", descricao:"Compras",
    categoriaId:cat, membroId:"", valor:400});
  S.movimentos.push({id:"i2", data:"2026-07-05", tipo:"despesa", descricao:"Compras",
    categoriaId:cat, membroId:"", valor:440});
  S.movimentos.push({id:"i3", data:"2025-07-01", tipo:"rendimento", descricao:"Salário",
    categoriaId:catR, membroId:"", valor:2000});
  limparCacheCredito();
  var inf = inflacaoPessoal(MES);
  ok(inf != null, "com os dois meses há inflação pessoal");
  eq(inf.taxa, 10, "400 € para 440 € é 10%", 0.01);
  eq(inf.mesAnterior, "2025-07", "compara com o mesmo mês do ano anterior");
  eq(inf.nCategorias, 1, "com uma categoria em comum");
  // Uma categoria só num dos meses não entra: não há variação a medir
  S.movimentos.push({id:"i4", data:"2026-07-06", tipo:"despesa", descricao:"Nova",
    categoriaId:catPorNome("Restauração"), membroId:"", valor:100});
  limparCacheCredito();
  eq(inflacaoPessoal(MES).nCategorias, 1, "uma categoria nova não entra na inflação");

  // A ponderação é pelo peso: a categoria maior manda mais
  S = estadoVazio(); MES = "2026-07";
  var c1 = catPorNome("Alimentação"), c2 = catPorNome("Restauração");
  S.movimentos.push({id:"p1", data:"2025-07-05", tipo:"despesa", descricao:"A", categoriaId:c1, membroId:"", valor:900});
  S.movimentos.push({id:"p2", data:"2026-07-05", tipo:"despesa", descricao:"A", categoriaId:c1, membroId:"", valor:900});
  S.movimentos.push({id:"p3", data:"2025-07-06", tipo:"despesa", descricao:"B", categoriaId:c2, membroId:"", valor:50});
  S.movimentos.push({id:"p4", data:"2026-07-06", tipo:"despesa", descricao:"B", categoriaId:c2, membroId:"", valor:100});
  limparCacheCredito();
  var inf2 = inflacaoPessoal(MES);
  ok(inf2.taxa < 20, "a categoria pequena a dobrar não dobra a inflação toda", inf2.taxa);
  ok(inf2.taxa > 0, "mas também não a ignora", inf2.taxa);

  MES = mesGuardado; S = JSON.parse(guardado); limparCacheCredito();
})();

G("sequências, património no tempo e plano de corte");
(function(){
  var guardado = JSON.stringify(S);
  var mesGuardado = MES;
  S = estadoVazio(); MES = isoMes(hoje());
  var cat = catPorNome("Alimentação");
  var catR = S.categorias.filter(function(c){ return c.tipo === "rendimento"; })[0].id;

  eq(sequencias().length, 0, "sem dados não há sequências");

  // Cinco meses com saldo positivo
  for (var i = 1; i <= 5; i++){
    var m = mesShift(MES, -i);
    S.movimentos.push({id:"s"+i, data:m+"-10", tipo:"despesa", descricao:"Gasto",
      categoriaId:cat, membroId:"", valor:500});
    S.movimentos.push({id:"r"+i, data:m+"-01", tipo:"rendimento", descricao:"Salário",
      categoriaId:catR, membroId:"", valor:1500});
  }
  limparCacheCredito();
  var seqs = sequencias();
  var saldo = seqs.filter(function(s){ return /saldo positivo/.test(s.txt); })[0];
  ok(saldo != null, "há sequência de saldo positivo");
  eq(saldo.n, 5, "com cinco meses");

  // Um mês negativo pelo meio quebra a contagem
  S.movimentos.push({id:"neg", data:mesShift(MES,-3)+"-15", tipo:"despesa",
    descricao:"Estouro", categoriaId:cat, membroId:"", valor:3000});
  limparCacheCredito();
  var saldo2 = sequencias().filter(function(s){ return /saldo positivo/.test(s.txt); })[0];
  eq(saldo2.n, 2, "um mês em défice interrompe a sequência");

  // Meses fechados de seguida
  S.fechados[mesShift(MES,-1)] = {em: isoDia(hoje())};
  S.fechados[mesShift(MES,-2)] = {em: isoDia(hoje())};
  var fech = sequencias().filter(function(s){ return /fechados/.test(s.txt); })[0];
  ok(fech != null, "há sequência de meses fechados");
  eq(fech.n, 2, "com dois meses");
  // Um buraco quebra
  delete S.fechados[mesShift(MES,-1)];
  ok(!sequencias().some(function(s){ return /fechados/.test(s.txt); }),
     "um mês por fechar quebra a sequência");

  // Objetivos atingidos entram como marco
  S.objetivos.push({id:"o1", nome:"Fundo", alvo:1000, atual:1000, ativoId:"", prazo:"", cor:"#000", celebrado:true});
  ok(sequencias().some(function(s){ return /objetivo/.test(s.txt); }), "um objetivo atingido é marco");

  // Património: instantâneos e a linha do stock
  var d = registarPatrimonio(MES);
  eq(d.mes, MES, "o instantâneo é do mês pedido");
  eq(d.ativo - d.divida, d.liquido, "e fecha: ativo − dívida = líquido", 0.01);
  eq(S.patrimonioHist.length, 1, "guardou um instantâneo");
  registarPatrimonio(MES);
  eq(S.patrimonioHist.length, 1, "guardar duas vezes no mesmo mês não duplica");
  registarPatrimonio(mesShift(MES, -1));
  eq(S.patrimonioHist.length, 2, "um mês diferente acrescenta");
  ok(S.patrimonioHist[0].mes < S.patrimonioHist[1].mes, "e ficam por ordem de mês");

  // Plano de corte
  S = estadoVazio(); MES = isoMes(hoje());
  var desejo1 = catPorNome("Restauração"), desejo2 = catPorNome("Lazer e cultura");
  var neces = catPorNome("Alimentação"), juros = catPorNome("Juros de crédito");
  var poup = S.categorias.filter(function(c){ return c.grupo === "poupanca" && c.tipo === "despesa"; })[0];
  S.movimentos.push({id:"d1", data:MES+"-05", tipo:"despesa", descricao:"Jantares", categoriaId:desejo1, membroId:"", valor:200});
  S.movimentos.push({id:"d2", data:MES+"-06", tipo:"despesa", descricao:"Cinema", categoriaId:desejo2, membroId:"", valor:100});
  S.movimentos.push({id:"n1", data:MES+"-07", tipo:"despesa", descricao:"Compras", categoriaId:neces, membroId:"", valor:600});
  S.movimentos.push({id:"j1", data:MES+"-08", tipo:"despesa", descricao:"Juros", categoriaId:juros, membroId:"", valor:300});
  if (poup) S.movimentos.push({id:"pp", data:MES+"-09", tipo:"despesa", descricao:"Poupança", categoriaId:poup.id, membroId:"", valor:250});
  S.movimentos.push({id:"rr", data:MES+"-01", tipo:"rendimento", descricao:"Salário", categoriaId:catR, membroId:"", valor:2500});
  limparCacheCredito();

  ok(planoDeCorte(0) === null, "cortar zero não é plano");
  ok(planoDeCorte(-50) === null, "nem cortar negativo");

  var p60 = planoDeCorte(60);
  ok(p60 != null, "há plano para 60 €");
  eq(p60.conseguido, 60, "que atinge a meta", 0.5);
  ok(p60.atingivel, "e diz que é atingível");
  ok(p60.soDesejos, "60 € cabem só nos desejos");
  ok(p60.linhas.every(function(x){ return x.cat.grupo === "desejos"; }), "nenhuma necessidade tocada");

  var p400 = planoDeCorte(400);
  ok(!p400.soDesejos, "400 € já exigem necessidades");
  ok(p400.bolsasUsadas.indexOf("desejos") === 0, "mas os desejos vêm primeiro");
  var iNec = p400.linhas.findIndex(function(x){ return x.cat.grupo === "necessidades"; });
  var iDes = p400.linhas.findIndex(function(x){ return x.cat.grupo === "desejos"; });
  ok(iDes >= 0 && iDes < iNec, "e aparecem antes na lista", iDes+" < "+iNec);

  // Nunca corta poupança, juros, prestações ou impostos
  [p60, p400, planoDeCorte(5000)].forEach(function(p){
    ok(p.linhas.every(function(x){ return (x.cat.grupo || "") !== "poupanca"; }),
       "o plano nunca corta poupança");
    ok(p.linhas.every(function(x){ return CATS_NAO_CORTAVEIS.indexOf(x.cat.nome) < 0; }),
       "nem juros, prestações ou impostos");
    ok(p.linhas.every(function(x){ return x.corte <= x.gasto * CORTE_MAX_FRACAO + 0.01; }),
       "nem deixa nenhuma categoria abaixo de metade");
    ok(p.conseguido <= p.meta + 0.5, "nem corta mais do que a meta", p.conseguido+" vs "+p.meta);
  });

  // Uma meta impossível é reportada como impossível, não fingida
  var pImp = planoDeCorte(100000);
  ok(!pImp.atingivel, "uma meta impossível não se finge atingida");
  ok(pImp.conseguido > 0, "mas mostra-se quanto dá", pImp.conseguido);

  // Limites pelo histórico
  S = estadoVazio(); MES = isoMes(hoje());
  ok(medianaCategoria(cat, 6) === null, "sem dois meses não há mediana de categoria");
  for (i = 1; i <= 4; i++){
    S.movimentos.push({id:"m"+i, data:mesShift(MES,-i)+"-10", tipo:"despesa",
      descricao:"Compras", categoriaId:cat, membroId:"", valor:[300,320,310,900][i-1]});
  }
  limparCacheCredito();
  var med = medianaCategoria(cat, 6);
  ok(med != null, "com quatro meses há mediana");
  eq(med.n, 4, "de quatro observações");
  eq(med.valor, 315, "e o mês de 900 € não a arrasta", med.valor);

  MES = mesGuardado; S = JSON.parse(guardado); limparCacheCredito();
})();

G("provisões, saúde financeira e alavancas do défice");
(function(){
  var guardado = JSON.stringify(S), mesGuardado = MES;
  S = estadoVazio(); MES = "2026-07";
  var cat = catPorNome("Seguros");
  var catR = S.categorias.filter(function(c){ return c.tipo === "rendimento"; })[0].id;

  // Próxima ocorrência de uma rubrica não mensal
  var anual = {id:"a1", tipo:"despesa", nome:"Seguro auto", valor:600, frequencia:"anual",
    ativo:true, categoriaId:cat, membroId:"", inicio:"2026-03-01"};
  S.recorrentes.push(anual);
  eq(proximaOcorrencia(anual, "2026-03"), "2026-03", "no mês da âncora, é esse mês");
  eq(proximaOcorrencia(anual, "2026-04"), "2027-03", "no mês seguinte, é daqui a onze");
  eq(proximaOcorrencia(anual, "2026-09"), "2027-03", "a meio do ciclo, o próximo março");
  var trim = {id:"t1", tipo:"despesa", nome:"Água", valor:90, frequencia:"trimestral",
    ativo:true, categoriaId:cat, membroId:"", inicio:"2026-01-01"};
  S.recorrentes.push(trim);
  eq(proximaOcorrencia(trim, "2026-02"), "2026-04", "trimestral salta de três em três");
  eq(proximaOcorrencia(trim, "2026-04"), "2026-04", "e acerta no mês do ciclo");
  var mensal = {id:"m1", tipo:"despesa", nome:"Renda", valor:700, frequencia:"mensal",
    ativo:true, categoriaId:cat, membroId:""};
  eq(proximaOcorrencia(mensal, "2026-05"), "2026-05", "uma mensal é sempre este mês");

  var pr = provisoes("2026-07");
  ok(pr.linhas.length === 2, "só as não mensais entram nas provisões", pr.linhas.length);
  ok(pr.linhas.every(function(x){ return x.devia >= 0 && x.devia <= x.total + 0.01; }),
     "o provisionado nunca passa o total da rubrica nem fica negativo");
  ok(pr.linhas.every(function(x){ return x.porMes > 0 && x.porMes <= x.total; }),
     "a quota mensal é positiva e menor do que o total");
  eq(pr.porMes, 600/12 + 90/3, "a provisão mensal soma as quotas de cada rubrica", 0.01);
  eq(pr.doze, 600 + 90*4, "e o custo anual soma as ocorrências do ano", 0.01);
  ok(pr.devia <= pr.linhas.reduce(function(s,x){ return s + x.total; }, 0) + 0.01,
     "o total a ter de parte nunca passa a soma das rubricas");
  ok(pr.disponivel <= pr.liquidez + 0.01, "o disponível nunca passa a liquidez");

  // Saúde financeira
  S = estadoVazio(); MES = isoMes(hoje());
  var s0 = saudeFinanceira();
  ok(s0.total >= 0 && s0.total <= 100, "a pontuação vive entre 0 e 100", s0.total);
  eq(COMPONENTES_SAUDE.reduce(function(a,c){ return a + c.peso; }, 0), 100,
     "os pesos dos componentes somam 100");
  ok(s0.partes.length === COMPONENTES_SAUDE.length, "todos os componentes são medidos");
  ok(s0.partes.every(function(x){ return x.nota >= 0 && x.nota <= 1; }),
     "cada nota fica entre 0 e 1");
  ok(s0.partes.every(function(x){ return x.pontos <= x.peso + 0.01; }),
     "e nenhum componente dá mais pontos do que o seu peso");
  ok(["Sólida","Razoável","Frágil","Em risco"].indexOf(s0.nivel.lbl) >= 0,
     "o nível tem nome", s0.nivel.lbl);

  // Um orçamento saudável pontua mais do que um em apuros
  S = estadoVazio(); MES = isoMes(hoje());
  var catAli = catPorNome("Alimentação");
  S.ativos.push({id:"liq", nome:"Conta", classe:"corrente", atual:20000, aquisicao:20000,
    encargos:[], rendimentos:[], aportes:[]});
  S.movimentos.push({id:"r1", data:MES+"-01", tipo:"rendimento", descricao:"S", categoriaId:catR, membroId:"", valor:3000});
  S.movimentos.push({id:"d1", data:MES+"-05", tipo:"despesa", descricao:"G", categoriaId:catAli, membroId:"", valor:1500});
  limparCacheCredito();
  var bom = saudeFinanceira().total;
  S.ativos = [];
  S.movimentos = S.movimentos.filter(function(m){ return m.id !== "d1"; });
  S.movimentos.push({id:"d2", data:MES+"-05", tipo:"despesa", descricao:"G", categoriaId:catAli, membroId:"", valor:2950});
  limparCacheCredito();
  var mau = saudeFinanceira().total;
  ok(bom > mau, "um orçamento com reserva e poupança pontua mais", bom+" vs "+mau);

  // A taxa de esforço até 20% não penaliza
  var comp = COMPONENTES_SAUDE.filter(function(c){ return c.k === "esforco"; })[0];
  ok(comp != null, "há componente de esforço com créditos");

  // Alavancas do défice
  S = estadoVazio(); MES = isoMes(hoje());
  S.movimentos.push({id:"rr", data:MES+"-01", tipo:"rendimento", descricao:"S", categoriaId:catR, membroId:"", valor:1000});
  S.movimentos.push({id:"dd", data:MES+"-05", tipo:"despesa", descricao:"G", categoriaId:catPorNome("Restauração"), membroId:"", valor:1600});
  limparCacheCredito();
  var al = alavancasDefice();
  ok(al != null, "com o mês em défice há alavancas");
  if (al){
    ok(al.falta > 0, "e um valor em falta", al.falta);
    ok(al.alavancas.length > 0, "com pelo menos uma alavanca");
    ok(al.alavancas.every(function(x){ return x.valor >= 0 && isFinite(x.valor); }),
       "cada alavanca vale um número não negativo");
    for (var i = 1; i < al.alavancas.length; i++)
      ok(al.alavancas[i-1].valor >= al.alavancas[i].valor, "ordenadas pela que mais rende");
  }
  // Com saldo positivo não há cartão nenhum
  S.movimentos = S.movimentos.filter(function(m){ return m.id !== "dd"; });
  limparCacheCredito();
  ok(alavancasDefice() === null, "sem défice não há alavancas a propor");

  MES = mesGuardado; S = JSON.parse(guardado); limparCacheCredito();
})();

G("orientação e classe de aparelho");
(function(){
  /* A largura sozinha não distingue um telemóvel deitado (812×375) de um
     tablet de pé (768×1024): ambos são «largos». O que os distingue é o
     lado menor, que não muda ao rodar. */
  var casos = [
    {n:"telemóvel de pé",        larg:375,  alt:812,  toque:true,  d:"telemovel", o:"retrato",  deitado:false},
    {n:"telemóvel deitado",      larg:812,  alt:375,  toque:true,  d:"telemovel", o:"paisagem", deitado:true},
    {n:"telemóvel pequeno de pé",larg:320,  alt:568,  toque:true,  d:"telemovel", o:"retrato",  deitado:false},
    {n:"telemóvel pequeno deit.",larg:568,  alt:320,  toque:true,  d:"telemovel", o:"paisagem", deitado:true},
    {n:"tablet de pé",           larg:768,  alt:1024, toque:true,  d:"tablet",    o:"retrato",  deitado:false},
    {n:"tablet deitado",         larg:1024, alt:768,  toque:true,  d:"tablet",    o:"paisagem", deitado:false},
    {n:"tablet grande de pé",    larg:834,  alt:1194, toque:true,  d:"tablet",    o:"retrato",  deitado:false},
    {n:"computador",             larg:1440, alt:900,  toque:false, d:"desktop",   o:"paisagem", deitado:false},
    {n:"janela estreita, rato",  larg:700,  alt:900,  toque:false, d:"desktop",   o:"retrato",  deitado:false},
  ];
  casos.forEach(function(c){
    var e = classificarEcra(c);
    eq(e.dispositivo, c.d, c.n+": é "+c.d);
    eq(e.orientacao, c.o, c.n+": está em "+c.o);
    eq(e.deitado, c.deitado, c.n+": "+(c.deitado ? "é o caso apertado" : "não é o caso apertado"));
    ok(e.valido, c.n+": a medição é válida");
    eq(e.menor, Math.min(c.larg, c.alt), c.n+": o lado menor é o que classifica");
  });

  // O lado menor não muda ao rodar — é essa a razão de ser dele
  ["telemovel","tablet"].forEach(function(tipo){
    var pe = tipo === "telemovel" ? {larg:390, alt:844, toque:true} : {larg:820, alt:1180, toque:true};
    var deitado = {larg: pe.alt, alt: pe.larg, toque:true};
    eq(classificarEcra(pe).dispositivo, classificarEcra(deitado).dispositivo,
       tipo+": rodar não muda a classe do aparelho");
    ok(classificarEcra(pe).orientacao !== classificarEcra(deitado).orientacao,
       tipo+": mas muda a orientação");
  });

  // Um ecrã quadrado conta como retrato — não há razão para o contrário,
  // e uma regra arbitrária é melhor do que uma indefinida
  eq(classificarEcra({larg:800, alt:800, toque:true}).orientacao, "retrato",
     "um ecrã quadrado conta como retrato");

  // Sem dimensões não se classifica nada: mudar o desenho com base em zero
  // seria pior do que deixar como está
  var nulo = classificarEcra({larg:0, alt:0, toque:false});
  ok(!nulo.valido, "uma janela sem dimensões não é válida");
  eq(nulo.orientacao, "", "e não tem orientação");
  eq(nulo.deitado, false, "nem é o caso apertado");

  // As fronteiras dos limiares
  eq(classificarEcra({larg:LIMIAR_TELEMOVEL-1, alt:900, toque:true}).dispositivo, "telemovel",
     "mesmo abaixo do limiar, é telemóvel");
  eq(classificarEcra({larg:LIMIAR_TELEMOVEL, alt:900, toque:true}).dispositivo, "tablet",
     "no limiar, já é tablet");
  eq(classificarEcra({larg:LIMIAR_TABLET, alt:1200, toque:true}).dispositivo, "desktop",
     "acima do limiar do tablet, é computador");
  ok(LIMIAR_TELEMOVEL < LIMIAR_TABLET, "os limiares estão por ordem");

  // O caso apertado é da altura, não da largura: um tablet deitado tem
  // altura de sobra e não entra nele
  ok(!classificarEcra({larg:1024, alt:768, toque:true}).deitado,
     "um tablet deitado tem altura de sobra");
  ok(classificarEcra({larg:900, alt:440, toque:true}).deitado,
     "mas um ecrã largo e baixo é o caso apertado");
})();

G("saúde financeira: melhorar nunca baixa a nota");
(function(){
  /* A propriedade que dá sentido à pontuação: se um componente melhora e
     nada mais muda, a nota não pode descer. Uma fórmula que falhe isto
     manda a pessoa na direção errada. */
  var guardado = JSON.stringify(S), mesGuardado = MES;
  var catAli, catR;

  function cenarioBase(){
    S = estadoVazio(); MES = isoMes(hoje());
    catAli = catPorNome("Alimentação");
    catR = S.categorias.filter(function(c){ return c.tipo === "rendimento"; })[0].id;
    S.movimentos.push({id:"r", data:MES+"-01", tipo:"rendimento", descricao:"S",
      categoriaId:catR, membroId:"", valor:2000});
    S.movimentos.push({id:"d", data:MES+"-05", tipo:"despesa", descricao:"G",
      categoriaId:catAli, membroId:"", valor:1800});
    limparCacheCredito();
  }

  // Mais reserva não pode baixar a nota
  cenarioBase();
  var semReserva = saudeFinanceira().total;
  S.ativos.push({id:"liq", nome:"Conta", classe:"corrente", atual:12000, aquisicao:12000,
    encargos:[], rendimentos:[], aportes:[]});
  limparCacheCredito();
  var comReserva = saudeFinanceira().total;
  ok(comReserva >= semReserva, "juntar reserva não baixa a nota", semReserva+" → "+comReserva);
  ok(comReserva > semReserva, "e melhora-a mesmo", semReserva+" → "+comReserva);

  // Poupar mais não pode baixar a nota
  cenarioBase();
  var poucaPoupanca = saudeFinanceira().total;
  S.movimentos = S.movimentos.filter(function(m){ return m.id !== "d"; });
  S.movimentos.push({id:"d2", data:MES+"-05", tipo:"despesa", descricao:"G",
    categoriaId:catAli, membroId:"", valor:1400});
  limparCacheCredito();
  ok(saudeFinanceira().total >= poucaPoupanca, "gastar menos não baixa a nota",
     poucaPoupanca+" → "+saudeFinanceira().total);

  // Menos crédito não pode baixar a nota
  cenarioBase();
  S.creditos.push({id:"cr", nome:"C", capital:100000, prazoMeses:360, inicio:mesShift(MES,-12)+"-01",
    tipoTaxa:"fixa", taxaAnual:4, seguroMensal:20, ativoId:"",
    categoriaJurosId:"", categoriaCapitalId:"", categoriaSeguroId:""});
  limparCacheCredito();
  var comCredito = saudeFinanceira().total;
  S.creditos = [];
  limparCacheCredito();
  ok(saudeFinanceira().total >= comCredito, "sem créditos a nota não desce",
     comCredito+" → "+saudeFinanceira().total);

  // Definir limites não pode baixar a nota
  cenarioBase();
  var semLimites = saudeFinanceira().total;
  S.categorias.filter(function(c){ return c.tipo === "despesa"; })
    .forEach(function(c){ S.limites[c.id] = 500; });
  limparCacheCredito();
  ok(saudeFinanceira().total >= semLimites, "definir limites não baixa a nota",
     semLimites+" → "+saudeFinanceira().total);

  // A taxa de esforço até 20% tem nota cheia — o cartão dos créditos chama
  // «dentro do razoável» a 33%, e penalizar desde 0% contradizia-o
  cenarioBase();
  var esf = COMPONENTES_SAUDE.filter(function(c){ return c.k === "esforco"; })[0];
  S.creditos.push({id:"c2", nome:"C", capital:20000, prazoMeses:120, inicio:mesShift(MES,-6)+"-01",
    tipoTaxa:"fixa", taxaAnual:3, seguroMensal:0, ativoId:"",
    categoriaJurosId:"", categoriaCapitalId:"", categoriaSeguroId:""});
  limparCacheCredito();
  var m = esf.medir();
  ok(m.valor > 0, "há taxa de esforço a medir", m.valor);
  if (m.valor <= 20) eq(m.nota, 1, "até 20% de esforço, a nota é cheia");
  ok(m.nota >= 0 && m.nota <= 1, "e sempre entre 0 e 1");

  MES = mesGuardado; S = JSON.parse(guardado); limparCacheCredito();
})();

G("cifra: base64 em blocos e falha fechada");
(function(){
  /* Regressão: `String.fromCharCode.apply` com o array inteiro rebentava a
     pilha, e um orçamento com anos de movimentos chega lá — falhava
     justamente a quem mais dados tem para proteger. */
  var grande = new Uint8Array(600000);
  for (var i = 0; i < grande.length; i++) grande[i] = i % 256;
  var texto;
  try { texto = b64.para(grande.buffer); }
  catch(e){ ok(false, "base64 de 600 KB não rebenta a pilha", e.message); texto = ""; }
  ok(texto.length > 0, "base64 de um buffer grande produz texto", texto.length);
  var volta = b64.de(texto);
  eq(volta.length, grande.length, "e volta com o mesmo comprimento");
  var igual = true;
  for (i = 0; i < grande.length; i += 997) if (volta[i] !== grande[i]) igual = false;
  ok(igual, "com os mesmos bytes");

  // Buffers pequenos e vazios continuam a funcionar
  eq(b64.de(b64.para(new Uint8Array([]).buffer)).length, 0, "um buffer vazio roda vazio");
  var tres = new Uint8Array([0, 127, 255]);
  var t2 = b64.de(b64.para(tres.buffer));
  ok(t2[0] === 0 && t2[1] === 127 && t2[2] === 255, "e os extremos de byte sobrevivem");

  // O pacote declara o que é, e não deixa passar o que não é
  ok(!ehPacoteCifrado(null), "nulo não é pacote");
  ok(!ehPacoteCifrado({formato:CIFRA_MARCA}), "sem sal nem dados também não");
  ok(ehPacoteCifrado({formato:CIFRA_MARCA, sal:"a", iv:"b", dados:"c"}), "com tudo, é");
})();

G("eventos de vida — o orçamento noutra vida");
(function(){
  var guardado = JSON.stringify(S), mesGuardado = MES;
  S = estadoVazio(); MES = isoMes(hoje());
  var catR = S.categorias.filter(function(c){ return c.tipo === "rendimento"; })[0].id;
  var catAli = catPorNome("Alimentação");
  S.recorrentes.push({id:"rd", tipo:"rendimento", nome:"Salário", valor:2500, frequencia:"mensal",
    ativo:true, categoriaId:catR, membroId:""});
  S.recorrentes.push({id:"dp", tipo:"despesa", nome:"Compras", valor:600, frequencia:"mensal",
    ativo:true, categoriaId:catAli, membroId:""});
  S.ativos.push({id:"liq", nome:"Conta", classe:"corrente", atual:15000, aquisicao:15000,
    encargos:[], rendimentos:[], aportes:[]});
  limparCacheCredito();
  var base = planoMes(MES);

  // Todos os eventos têm a forma esperada
  Object.keys(EVENTOS_VIDA).forEach(function(k){
    var ev = EVENTOS_VIDA[k];
    ok(typeof ev.lbl === "string" && ev.lbl.length > 0, k+": tem nome");
    ok(typeof ev.icone === "string" && ev.icone.length > 0, k+": tem ícone");
    ok(typeof ev.desc === "string" && ev.desc.length > 10, k+": explica-se");
    ok(Array.isArray(ev.params) && ev.params.length > 0, k+": tem parâmetros");
    ev.params.forEach(function(p){
      ok(p.k && p.lbl, k+"."+p.k+": parâmetro identificado");
      ok(p.valor >= p.min && p.valor <= p.max, k+"."+p.k+": o valor por omissão está no intervalo",
         p.valor+" em ["+p.min+","+p.max+"]");
      ok(p.passo > 0, k+"."+p.k+": tem passo positivo");
    });
    // Montar não rebenta e devolve mexidas com tipo conhecido
    var mex = ev.montar(paramsEvento(k), mesShift(MES, 1));
    ok(Array.isArray(mex) && mex.length > 0, k+": montar produz mexidas");
    mex.forEach(function(m){
      ok(["despesa","rendimento","rendimentoFixo","pontual","fim"].indexOf(m.tipo) >= 0,
         k+": mexida de tipo conhecido", m.tipo);
    });
  });

  // Sem eventos, o cenário é o plano
  var p0 = planoComEventos(MES, []);
  eq(p0.rend, base.rend, "sem eventos o rendimento é o mesmo", 0.01);
  eq(p0.desp, base.desp, "e a despesa também", 0.01);
  eq(p0.pontual, 0, "e não há pontuais");

  // Um evento antes de começar não mexe em nada
  var evs = [{tipo:"filho", mes: mesShift(MES, 3), params: paramsEvento("filho")}];
  var antes = planoComEventos(MES, evs);
  eq(antes.desp, base.desp, "antes do mês de início, a despesa não muda", 0.01);
  var depois = planoComEventos(mesShift(MES, 3), evs);
  ok(depois.desp > base.desp, "no mês do início, a despesa sobe", depois.desp+" vs "+base.desp);
  eq(depois.rend - depois.desp, depois.saldo, "e o saldo do cenário fecha", 0.01);

  // Tempo parcial corta a percentagem certa
  var tp = [{tipo:"tempoParcial", mes: MES, params:{percentagem: 80}}];
  var cp = planoComEventos(MES, tp);
  eq(base.rend - cp.rend, base.rend * 0.2, "80% de trabalho tira 20% do rendimento", 0.01);

  // Desemprego acaba quando acaba
  var de = [{tipo:"desemprego", mes: MES, params:{meses: 3, subsidio: 800}}];
  var m0 = planoComEventos(MES, de);
  var m4 = planoComEventos(mesShift(MES, 4), de);
  ok(m0.rend < base.rend, "durante o desemprego o rendimento cai");
  eq(m4.rend, base.rend, "e ao quarto mês volta ao normal", 0.01);

  // Os pontuais caem uma vez só, no mês certo
  var carro = [{tipo:"carro", mes: mesShift(MES,1), params: paramsEvento("carro")}];
  eq(planoComEventos(MES, carro).pontual, 0, "o pontual não cai antes do mês");
  ok(planoComEventos(mesShift(MES,1), carro).pontual > 0, "cai no mês do evento");
  eq(planoComEventos(mesShift(MES,2), carro).pontual, 0, "e não se repete no mês seguinte");

  // A tesouraria do cenário acumula, como a real
  var t = tesourariaCenario(24, evs);
  eq(t.length, 24, "a tesouraria do cenário projeta o horizonte pedido");
  for (var i = 1; i < t.length; i++)
    ok(Math.abs(t[i].acumulado - (t[i-1].acumulado + t[i].saldo)) < 0.02,
       "e acumula mês a mês");
  ok(t.every(function(x){ return isFinite(x.acumulado); }), "com números finitos");

  // A comparação usa o mês em que o cenário está em pleno
  var c = compararCenario(evs, 24);
  eq(c.mesRegime, mesShift(MES, 3), "o regime é o mais tardio dos inícios");
  eq(c.rendDepois - c.despDepois, c.saldoDepois, "as contas do cenário fecham", 0.01);
  eq(c.real.length, c.cen.length, "as duas séries têm o mesmo comprimento");
  ok(c.detalhe.length > 0, "e há detalhe do que muda");
  ok(c.detalhe.every(function(d){ return d.nome && isFinite(d.valor); }),
     "cada linha do detalhe tem nome e valor");

  // Dois eventos somam-se
  var dois = [{tipo:"filho", mes: MES, params: paramsEvento("filho")},
              {tipo:"carro", mes: MES, params: paramsEvento("carro")}];
  var c2 = compararCenario(dois, 24);
  var so1 = compararCenario([dois[0]], 24);
  ok(c2.pontualTotal > so1.pontualTotal, "dois eventos trazem mais encargos pontuais");

  // Nada disto toca nos dados
  var estadoAgora = JSON.stringify(S);
  compararCenario(dois, 36);
  eq(JSON.stringify(S), estadoAgora, "simular não altera o estado");

  MES = mesGuardado; S = JSON.parse(guardado); limparCacheCredito();
})();

G("retrato do ano");
(function(){
  var guardado = JSON.stringify(S), mesGuardado = MES;
  S = estadoVazio(); MES = "2026-07";
  var catR = S.categorias.filter(function(c){ return c.tipo === "rendimento"; })[0].id;
  var cat = catPorNome("Alimentação");

  var vazio = dadosAno("2026");
  eq(vazio.comDados.length, 0, "um ano sem movimentos não tem meses com dados");
  eq(vazio.rend, 0, "nem rendimento");

  // Seis meses de 2026 e os mesmos de 2025, para comparar
  [1,2,3,4,5,6].forEach(function(m){
    var mm = "2026-"+String(m).padStart(2,"0");
    S.movimentos.push({id:"a"+m, data:mm+"-10", tipo:"despesa", descricao:"G", categoriaId:cat, membroId:"", valor:400});
    S.movimentos.push({id:"ar"+m, data:mm+"-01", tipo:"rendimento", descricao:"S", categoriaId:catR, membroId:"", valor:2000});
    var m5 = "2025-"+String(m).padStart(2,"0");
    S.movimentos.push({id:"b"+m, data:m5+"-10", tipo:"despesa", descricao:"G", categoriaId:cat, membroId:"", valor:320});
    S.movimentos.push({id:"br"+m, data:m5+"-01", tipo:"rendimento", descricao:"S", categoriaId:catR, membroId:"", valor:1900});
  });
  S.notas["2026-03"] = "Férias";
  S.fechados["2026-02"] = {em:"2026-03-01"};
  limparCacheCredito();

  var d = dadosAno("2026");
  eq(d.comDados.length, 6, "seis meses com movimentos");
  eq(d.rend, 12000, "o rendimento do ano soma os seis meses", 0.01);
  eq(d.desp, 2400, "e a despesa também", 0.01);
  eq(d.saldo, d.rend - d.desp, "o saldo fecha", 0.01);
  eq(d.taxa, (d.rend - d.desp) / d.rend * 100, "a taxa de poupança é o saldo sobre o rendimento", 0.01);
  eq(d.notas.length, 1, "as notas do ano são recolhidas");
  eq(d.fechados, 1, "e os meses fechados contados");
  eq(d.linhas.length, 12, "as doze linhas existem sempre");
  ok(d.linhas.filter(function(x){ return !x.temDados; }).length === 6, "seis sem dados");

  var ali = d.cats.filter(function(x){ return x.cat.id === cat; })[0];
  ok(ali != null, "a categoria com gasto aparece");
  eq(ali.total, 2400, "com o total do ano", 0.01);
  eq(ali.antes, 1920, "e o do ano anterior", 0.01);
  eq(ali.pct, (2400-1920)/1920*100, "a variação face ao ano anterior", 0.01);
  ok(d.melhor != null && d.pior != null, "há melhor e pior mês");

  MES = mesGuardado; S = JSON.parse(guardado); limparCacheCredito();
})();

G("escalas de dinheiro dos deslizadores");
(function(){
  /* Os tetos chegam aos milhões, mas o passo em baixo tem de continuar
     fino — é lá que vive a maioria dos orçamentos. */
  Object.keys(ESCALAS).forEach(function(nome){
    var esc = ESCALAS[nome];
    var passos = escalaPassos(esc);
    var min = esc[0][0], max = esc[esc.length-1][1];

    ok(passos > 0, nome+": tem posições", passos);
    ok(passos <= 700, nome+": e não são tantas que o arrasto se torne inútil", passos);
    eq(escalaValor(esc, 0), min, nome+": a posição zero é o mínimo");
    eq(escalaValor(esc, passos), max, nome+": a última posição é o máximo");

    // Monotonia estrita: cada posição vale mais do que a anterior
    var anterior = -Infinity, monotona = true;
    for (var p = 0; p <= passos; p++){
      var v = escalaValor(esc, p);
      if (!(v > anterior)) monotona = false;
      anterior = v;
    }
    ok(monotona, nome+": o valor cresce sempre com a posição");

    // Ida e volta: o que a interface mostra volta à mesma posição
    var voltas = true;
    for (p = 0; p <= passos; p++){
      if (escalaPos(esc, escalaValor(esc, p)) !== p) voltas = false;
    }
    ok(voltas, nome+": posição → valor → posição devolve o mesmo");

    // Fora dos limites não rebenta nem devolve lixo
    eq(escalaValor(esc, -50), min, nome+": posição negativa cai no mínimo");
    eq(escalaValor(esc, passos + 999), max, nome+": posição além do fim cai no máximo");
    eq(escalaPos(esc, max * 10), passos, nome+": valor acima do teto satura na última posição");
    ok(escalaPos(esc, min - 9999) >= 0, nome+": valor abaixo do mínimo não dá posição negativa");
    ok(Number.isFinite(escalaValor(esc, NaN)), nome+": posição inválida devolve um número");

    // Os tramos encaixam sem saltos nem sobreposições
    for (var i = 1; i < esc.length; i++){
      eq(esc[i][0], esc[i-1][1], nome+": o tramo "+i+" começa onde o anterior acabou");
      ok(esc[i][2] > esc[i-1][2], nome+": e com passo mais grosso");
      eq((esc[i][1] - esc[i][0]) % esc[i][2], 0, nome+": tramo "+i+" divisível pelo passo");
    }
    eq((esc[0][1] - esc[0][0]) % esc[0][2], 0, nome+": primeiro tramo divisível pelo passo");
  });

  // Os tetos que o utilizador pediu
  eq(ESCALAS.capital[ESCALAS.capital.length-1][1], 3000000, "o capital acumulado chega a 3 milhões");
  eq(ESCALAS.casa[ESCALAS.casa.length-1][1], 3000000, "o preço da casa também");
  ok(ESCALAS.mensal[ESCALAS.mensal.length-1][1] >= 50000, "a entrega mensal chega a 50 000 €");
  ok(ESCALAS.auto[ESCALAS.auto.length-1][1] >= 500000, "o automóvel chega a 500 000 €");
  // E o passo fino em baixo não se perdeu
  eq(ESCALAS.capital[0][2], 100, "no capital, os primeiros 10 000 € andam de 100 em 100");
  eq(ESCALAS.mensal[0][2], 10, "na entrega mensal, os primeiros 2 000 € andam de 10 em 10");
  eq(escalaValor(ESCALAS.capital, 1), 100, "a primeira posição do capital vale 100 €");
  eq(escalaValor(ESCALAS.mensal, 1), 10, "a primeira posição da mensal vale 10 €");

  // Uma estratégia com valores de milionário continua a fechar as contas
  var guardado = JSON.stringify(S.estrategia);
  S.estrategia.inicial = 2500000;
  S.estrategia.mensal = 40000;
  S.estrategia.anos = 20;
  S.estrategia.retornoBruto = 5;
  S.estrategia.modoFiscal = "mais_valias";
  var r = simularEstrategia(S.estrategia);
  ok(isFinite(r.valorBruto) && r.valorBruto > 0, "simula 2,5 M€ com 40 000 €/mês", r.valorBruto);
  ok(r.valorBruto > r.aportado, "e o capital cresce acima do que se entregou");
  eq(r.valorLiquido, r.valorBruto - r.imposto, "líquido = bruto − imposto", 0.01);
  ok(r.aportado >= 2500000 + 40000 * 12 * 20 - 1, "o aportado inclui a entrada e as entregas");

  // O limite legal do PPR não sobe com o teto do deslizador: é lei
  S.estrategia.modoFiscal = "ppr";
  S.estrategia.idade = 40;
  var pp = simularEstrategia(S.estrategia);
  var limite = limitePPR(40);
  ok(pp.beneficioPPR <= limite * 20 + 0.01,
     "a dedução do PPR continua limitada por lei ("+limite+" €/ano), mesmo com entregas enormes",
     pp.beneficioPPR);
  S.estrategia = JSON.parse(guardado);
})();

G("coerência do exemplo");
(function(){
  /* O exemplo é a primeira coisa que alguém vê. Se contradisser a si
     próprio — abono num escalão que não dá abono, dependentes a zero
     com creche paga — ensina o contrário do que a ferramenta faz. */
  S = estadoVazio(); carregarExemplo(); MES = isoMes(hoje());

  ok(S.fiscal.dependentes > 0, "o agregado declara os dependentes que tem", S.fiscal.dependentes);
  ok(ESTADOS_CIVIS[S.fiscal.estadoCivil] != null, "e uma situação familiar válida");

  // Cada componente de abono bate com o escalão do próprio agregado
  S.rendimentos.forEach(function(rd){
    (rd.componentes || []).forEach(function(c){
      if (c.especie !== "abonoFamilia") return;
      var esperado = abonoFamilia(c.idadeMeses, c.monoparental).valor;
      ok(Math.abs(parseNum(c.valor) - esperado) < 0.01,
         "o abono de «" + c.nome + "» bate com o escalão do agregado",
         parseNum(c.valor) + " vs " + esperado);
    });
  });

  // As componentes de parentalidade, se houver, têm modalidade válida
  S.rendimentos.forEach(function(rd){
    (rd.componentes || []).forEach(function(c){
      if (c.especie !== "parentalidade") return;
      ok(PARENTALIDADE.modalidades.some(function(m){ return m.k === c.modalidade; }),
         "modalidade válida em «" + c.nome + "»", c.modalidade);
    });
  });

  // Toda a componente aponta para uma categoria existente e do tipo certo
  S.rendimentos.forEach(function(rd){
    (rd.componentes || []).forEach(function(c){
      var ct = cat(c.categoriaId);
      ok(ct != null, "a componente «" + c.nome + "» tem categoria existente");
      if (ct) eq(ct.tipo, "rendimento", "e é de rendimento: " + ct.nome);
    });
  });

  // Idem para as rubricas de despesa, encargos e rendas dos ativos
  S.recorrentes.forEach(function(r){
    var ct = cat(r.categoriaId);
    ok(ct != null, "a rubrica «" + r.nome + "» tem categoria existente");
    if (ct) eq(ct.tipo, "despesa", "e é de despesa: " + ct.nome);
  });
  S.ativos.forEach(function(a){
    (a.encargos || []).forEach(function(e){
      var ct = cat(e.categoriaId);
      ok(ct != null, "o encargo «" + e.nome + "» tem categoria existente");
      if (ct) eq(ct.tipo, "despesa", "e é de despesa");
    });
    (a.rendimentos || []).forEach(function(x){
      var ct = cat(x.categoriaId);
      ok(ct != null, "a renda «" + x.nome + "» tem categoria existente");
      if (ct) eq(ct.tipo, "rendimento", "e é de rendimento");
    });
  });

  // Os créditos apontam para ativos que existem e para categorias válidas
  S.creditos.forEach(function(c){
    if (c.ativoId){
      ok(S.ativos.some(function(a){ return a.id === c.ativoId; }),
         "o crédito «" + c.nome + "» aponta para um ativo existente");
    }
    ["juros","capital","seguro"].forEach(function(p){
      ok(cat(catCredito(c, p)) != null, "o crédito «" + c.nome + "» tem categoria de " + p);
    });
  });

  // O exemplo produz um orçamento coerente
  var p = planoMes(MES);
  ok(p.rend > 0, "o exemplo tem rendimento", p.rend);
  ok(p.desp > 0, "e despesa", p.desp);
  eq(p.saldo, p.rend - p.desp, "e o saldo fecha");
  var b = balanco();
  ok(b.ativos > 0, "e património", b.ativos);
  eq(b.liquido, b.ativos - b.divida, "cujo líquido fecha");

  reporEstado();
})();

G("coerência estrutural do código");
(function(){
  /* Explicadores órfãos: uma entrada de ajuda para uma ação que já não
     existe é lixo silencioso — e foi assim que duas sobreviveram a uma
     vista removida. Este teste não deixa acontecer outra vez. */
  Object.keys(AJUDAS_ACAO).forEach(function(a){
    if (AJUDAS_ACAO[a] === null) return;           // `ir` é tratado à parte
    ok(typeof ACOES[a] === "function", "a ajuda de «" + a + "» refere uma ação que existe");
  });

  /* E o inverso, para as ações com nome próprio: as que merecem explicação
     devem tê-la. As de CRUD óbvio (salvar, editar, apagar) ficam de fora. */
  var obvias = /^(.*Salvar|.*Editar|.*Apagar|.*Cancelar|.*Novo|.*Add|.*Toggle|.*Adotar|.*Contrib|cancelarEd|ir)$/;
  var semAjuda = Object.keys(ACOES).filter(function(a){
    return !obvias.test(a) && !AJUDAS_ACAO[a];
  });
  ok(semAjuda.length === 0, "todas as ações não triviais têm explicador", semAjuda.join(", "));

  /* Cada entrada de ajuda tem título, texto e, quando há, fórmula. */
  [["AJUDAS_VISTA",AJUDAS_VISTA],["AJUDAS_KPI",AJUDAS_KPI],["AJUDAS_COL",AJUDAS_COL],
   ["AJUDAS_CAMPO",AJUDAS_CAMPO],["AJUDAS_ACAO",AJUDAS_ACAO]].forEach(function(par){
    Object.keys(par[1]).forEach(function(k){
      var a = par[1][k];
      if (a === null) return;
      ok(Array.isArray(a) && a.length === 3, par[0] + "." + k + ": tem três campos");
      ok(typeof a[0] === "string" && a[0].length > 2, par[0] + "." + k + ": tem título");
      ok(typeof a[1] === "string" && a[1].length > 15, par[0] + "." + k + ": tem texto substancial");
      ok(typeof a[2] === "string", par[0] + "." + k + ": o campo do cálculo é texto");
    });
  });

  /* Cada vista registada tem explicador e cada explicador tem vista. */
  Object.keys(VISTAS).forEach(function(v){
    ok(AJUDAS_VISTA[v] != null, "a vista " + v + " tem explicador");
  });
  Object.keys(AJUDAS_VISTA).forEach(function(v){
    ok(VISTAS[v] != null, "o explicador de vista " + v + " refere uma vista existente");
  });

  /* Os aliases apontam para vistas que existem. */
  Object.keys(ALIAS_VISTA).forEach(function(a){
    ok(VISTAS[ALIAS_VISTA[a].vista] != null, "o alias " + a + " aponta para uma vista existente");
  });

  /* Cada deslizador declarado tem alvo e produtor. */
  Object.keys(SLIDERS).forEach(function(s){
    var cfg = SLIDERS[s];
    ok(typeof cfg.set === "function", "deslizador " + s + ": tem setter");
    ok(typeof cfg.out === "function", "deslizador " + s + ": tem produtor de saída");
    ok(typeof cfg.alvo === "string" && cfg.alvo.charAt(0) === "#", "deslizador " + s + ": tem alvo");
  });

  /* Cada classe de ativo referida nos encargos típicos existe. */
  Object.keys(ENCARGOS_TIPICOS).forEach(function(k){
    ok(CLASSES[k] != null, "encargos típicos de " + k + " referem uma classe existente");
  });

  /* Cada categoria citada por nome no código existe nas categorias-semente. */
  var seed = categoriasSeed().map(function(c){ return c.nome; });
  ["Vencimento","Subsídios e abonos","Prémios e variáveis","Rendas recebidas",
   "Juros e dividendos","Outros rendimentos","Impostos","IRS e Segurança Social",
   "Manutenção e reparações","Juros de crédito","Amortização de capital",
   "Seguros de crédito","Condomínio","Seguros"].forEach(function(n){
    ok(seed.indexOf(n) >= 0, "a categoria «" + n + "» existe na semente");
  });
  Object.keys(CAT_CREDITO).forEach(function(p){
    ok(seed.indexOf(CAT_CREDITO[p]) >= 0, "a categoria do crédito para " + p + " existe");
  });
  Object.keys(ENCARGOS_TIPICOS).forEach(function(k){
    ENCARGOS_TIPICOS[k].forEach(function(e){
      ok(seed.indexOf(e.cat) >= 0, "o encargo típico «" + e.nome + "» aponta para categoria existente: " + e.cat);
    });
  });
})();

G("escape de HTML");
(function(){
  eq(esc("<script>"), "&lt;script&gt;", "abre e fecha etiquetas");
  eq(esc('a"b'), "a&quot;b", "aspas");
  eq(esc("a'b"), "a&#39;b", "plica");
  eq(esc("a&b"), "a&amp;b", "e comercial");
  eq(esc(null), "", "nulo dá vazio");
  eq(esc(undefined), "", "indefinido dá vazio");
  eq(esc(42), "42", "número");
  var mau = '<img src=x onerror="window.__xss=1">';
  ok(esc(mau).indexOf("<") < 0, "não sobra nenhum sinal de menor");
  ok(esc(mau).indexOf('"') < 0, "não sobram aspas");
})();

/* ============================================================
   8. Formatação
   ============================================================ */
G("formatação");
(function(){
  ok(/€/.test(eur(1000)), "euro tem símbolo");
  ok(/1/.test(eur(1000)) && /000/.test(eur(1000).replace(/\s/g,"")), "euro formata milhares");
  eq(eur(NaN), eur(0), "NaN formata como zero");
  eq(eur(undefined), eur(0), "indefinido formata como zero");
  ok(pct(15).indexOf("15") === 0, "percentagem");
  eq(pct(NaN), "0%", "percentagem de NaN");
  ok(pct(33.333).length <= 6, "percentagem arredondada: " + pct(33.333));
})();

/* ============================================================
   9. Estratégias de poupança e investimento
   ============================================================ */
G("compra de casa — IMT e custos (2026)");
(function(){
  reporEstado();
  // IMT habitação própria e permanente, Continente (Ofício Circulado 40129/2026)
  eq(imtCompra(100000, false), 0, "até 106 346 € é isento");
  eq(imtCompra(200000, false), 200000*0.07 - 10457.96, "escalão dos 7% com parcela a abater");
  eq(imtCompra(150000, false), 150000*0.05 - 6491.02, "escalão dos 5%");
  eq(imtCompra(700000, false), 700000*0.06, "acima de 660 982 € é taxa única de 6%");
  eq(imtCompra(1200000, false), 1200000*0.075, "acima de 1 150 853 € é taxa única de 7,5%");
  eq(imtCompra(300000, true), 0, "jovem até 35 anos, isento até 330 539 €");
  ok(imtCompra(400000, true) > 0, "jovem paga acima do limite de isenção");

  var c = custosCompraCasa(250000, 90, false);
  eq(c.entrada, 25000, "entrada de 10% com financiamento a 90%");
  eq(c.selo, 250000*0.008, "imposto de selo de 0,8%");
  eq(c.imt, 250000*0.07 - 10457.96, "IMT do preço");
  eq(c.total, c.entrada + c.imt + c.selo + c.escritura, "total = entrada + IMT + selo + escritura");
  var cj = custosCompraCasa(300000, 90, true);
  eq(cj.imt, 0, "jovem: IMT isento");
  eq(cj.selo, 0, "jovem: selo isento");
  eq(cj.entrada, 30000, "mas a entrada mantém-se");
  var c80 = custosCompraCasa(200000, 80, false);
  eq(c80.entrada, 40000, "financiamento a 80% exige 20% de entrada");
})();

G("regime fiscal dos instrumentos");
(function(){
  reporEstado();
  eq(modoFiscalEstrategia("ppr"), "ppr", "PPR tem regime próprio");
  eq(modoFiscalEstrategia("etf"), "mais_valias", "ETF: mais-valias");
  eq(modoFiscalEstrategia("acoes"), "mais_valias", "ações: mais-valias");
  eq(modoFiscalEstrategia("cripto"), "cripto", "cripto tem a regra dos 365 dias");
  eq(modoFiscalEstrategia("aforro"), "juro_anual", "aforro: juros anuais");
  eq(modoFiscalEstrategia("deposito"), "juro_anual", "depósito: juros anuais");
  eq(modoFiscalEstrategia("obrigacoes"), "juro_anual", "obrigações: juros anuais");
  ok(tratamentoFiscal("cripto").curto.indexOf("1 ano") >= 0, "a nota da cripto fala de 1 ano");
  ok(tratamentoFiscal("ppr").curto.indexOf("8%") >= 0, "a nota do PPR fala dos 8%");
})();

G("simulador de estratégia");
(function(){
  reporEstado();
  var e0 = estadoVazio().estrategia;
  function cfg(over, inst){ return cfgEstrategia(Object.assign({}, e0, over), null, inst); }

  // Juro anual (aforro): capitaliza ao líquido, sem imposto no resgate.
  var A = simularEstrategia(cfg({mensal:200, inicial:0, anos:10, inflacao:0}, "aforro"));
  eq(A.modo, "juro_anual", "aforro é juro anual");
  eq(A.aportado, 24000, "10 anos × 200 €/mês");
  eq(A.imposto, 0, "sem imposto de resgate (já retido nos juros)");
  ok(A.valorLiquido > A.aportado, "rende acima do aportado", A.valorLiquido);

  // Mais-valias (ETF): cresce ao bruto, 28% sobre o ganho no fim.
  var E = simularEstrategia(cfg({mensal:200, inicial:0, anos:10, inflacao:0}, "etf"));
  eq(E.modo, "mais_valias", "ETF é mais-valias");
  eq(E.aportado, 24000, "mesmo aportado");
  eq(E.imposto, E.ganho * parseNum(S.fiscal.capitais)/100, "imposto = 28% do ganho", 0.01);
  eq(E.valorLiquido, E.valorBruto - E.imposto, "líquido = bruto − imposto", 0.01);
  ok(E.valorBruto > A.valorLiquido, "ao bruto, o ETF acumula mais do que o aforro", E.valorBruto);

  // Cripto: isenta a partir de 1 ano (só o objetivo «investir» a admite).
  var C = simularEstrategia(cfg({objetivo:"investir", mensal:100, inicial:0, anos:5, inflacao:0}, "cripto"));
  eq(C.modo, "cripto", "cripto entra no regime próprio");
  ok(C.ganho > 0, "houve ganho", C.ganho);
  eq(C.imposto, 0, "detida ≥ 1 ano, isenta");

  // PPR: sem imposto na acumulação; 8% no resgate; dedução anual limitada.
  var P = simularEstrategia(cfg({mensal:200, inicial:0, anos:3, idade:40}, "ppr"));
  eq(P.modo, "ppr", "PPR");
  eq(P.imposto, P.ganho * parseNum(S.fiscal.pprSaida)/100, "8% sobre o ganho", 0.01);
  eq(P.beneficioPPR, Math.min(200*12*0.2, limitePPR(40)) * 3, "dedução limitada pela idade, 3 anos", 0.01);
  var Pjovem = simularEstrategia(cfg({mensal:200, inicial:0, anos:1, idade:30}, "ppr"));
  eq(Pjovem.beneficioPPR, Math.min(200*12*0.2, limitePPR(30)), "abaixo dos 35, limite mais alto", 0.01);

  // Monotonia: mais entrega mensal, mais capital final.
  var menos = simularEstrategia(cfg({mensal:100, anos:10}, "etf")).valorLiquido;
  var mais  = simularEstrategia(cfg({mensal:300, anos:10}, "etf")).valorLiquido;
  ok(mais > menos, "mais poupança dá mais capital");

  // Inflação corrói o valor real.
  var comInfl = simularEstrategia(cfg({mensal:200, anos:20, inflacao:3}, "etf"));
  ok(comInfl.real < comInfl.valorLiquido, "a preços de hoje vale menos que o nominal");

  // Capital inicial conta.
  var semIni = simularEstrategia(cfg({mensal:0, inicial:0, anos:5}, "aforro")).valorLiquido;
  var comIni = simularEstrategia(cfg({mensal:0, inicial:10000, anos:5}, "aforro")).valorLiquido;
  eq(semIni, 0, "sem entradas nem inicial, fica a zero");
  ok(comIni > 10000, "só o inicial já rende", comIni);

  // Casos-limite
  finito(simularEstrategia(cfg({mensal:-50, anos:5}, "etf")).valorLiquido, "mensal negativo não rebenta");
  finito(simularEstrategia(cfg({anos:1e6}, "etf")).valorLiquido, "horizonte absurdo é limitado, não rebenta");
})();

G("cenários e esforço para a meta");
(function(){
  reporEstado();
  var e0 = estadoVazio().estrategia;
  var cfg = cfgEstrategia(Object.assign({}, e0, {mensal:200, anos:15, inflacao:0}), null, "etf");

  var s = estrategiaSeries(cfg);
  eq(s.base[0].ano, 0, "a série começa em hoje");
  eq(s.base[s.base.length-1].ano, 15, "e termina no horizonte");
  ok(s.otimista[s.otimista.length-1].valor > s.base[s.base.length-1].valor, "otimista acima da base");
  ok(s.pessimista[s.pessimista.length-1].valor < s.base[s.base.length-1].valor, "pessimista abaixo da base");

  // Esforço mensal para uma meta: ao aplicá-lo, chega-se à meta.
  var cfgA = cfgEstrategia(Object.assign({}, e0, {anos:5, inflacao:0}), null, "aforro");
  var m = mensalParaMeta(cfgA, 20000);
  ok(m > 0, "há um esforço mensal", m);
  var atingido = simularEstrategia(Object.assign({}, cfgA, {mensal:m})).valorLiquido;
  eq(atingido, 20000, "aplicando esse esforço, atinge a meta", 1);
  eq(mensalParaMeta(cfgA, 0), 0, "meta nula não exige esforço");
  // Se o inicial já cobre a meta, o esforço é zero.
  var cfgCob = cfgEstrategia(Object.assign({}, e0, {anos:5, inicial:25000, inflacao:0}), null, "aforro");
  eq(mensalParaMeta(cfgCob, 20000), 0, "inicial que já chega dispensa esforço");

  // Renda sustentável: 4% ao ano.
  eq(rendaSustentavel(120000), 120000*0.04/12, "regra dos 4%");
  eq(rendaSustentavel(0), 0, "sem capital, sem renda");
})();

G("meta de cada objetivo");
(function(){
  reporEstado();
  var e0 = estadoVazio().estrategia;
  // Casa: meta = entrada + custos
  var mc = metaObjetivo(Object.assign({}, e0, {objetivo:"entrada", precoCasa:250000, ltv:90, jovemImt:false}));
  eq(mc.meta, custosCompraCasa(250000, 90, false).total, "casa: total a juntar");
  // Automóvel: meta = preço
  eq(metaObjetivo(Object.assign({}, e0, {objetivo:"automovel", precoAuto:18000})).meta, 18000, "automóvel: o preço");
  // Emergência: meses × despesa mensal do plano
  S.recorrentes.push({id:"d1", tipo:"despesa", nome:"Renda", categoriaId:"", membroId:"",
    valor:800, frequencia:"mensal", inicio:"", fim:"", ativo:true});
  var me = metaObjetivo(Object.assign({}, e0, {objetivo:"emergencia", mesesEmerg:6}));
  eq(me.meta, 6 * planoMes(MES).desp, "emergência: meses × despesa");
  ok(me.meta > 0, "com despesa no plano, a meta é positiva", me.meta);
  // Reforma / investir não têm meta fixa
  eq(metaObjetivo(Object.assign({}, e0, {objetivo:"reforma"})).meta, 0, "reforma não tem meta fixa");
  eq(metaObjetivo(Object.assign({}, e0, {objetivo:"investir"})).meta, 0, "investir não tem meta fixa");
})();

/* ============================================================
   Relatório
   ============================================================ */
S = normalizar(estadoUtilizador);
limparCacheCredito();
MES = mesInicial;
/* O disco fica como estava: nem o exemplo, nem os estados de teste. */
if (discoEstado !== null) localStorage.setItem(STORE_KEY, discoEstado);
else localStorage.removeItem(STORE_KEY);
if (discoSessao !== null) localStorage.setItem(SESSAO_KEY, discoSessao);
else localStorage.removeItem(SESSAO_KEY);
try { irPara(vistaInicial); } catch(e){ falhas.push({grupo:"limpeza", teste:"render final", detalhe:e.message}); }

/* A repintura acima agenda uma gravação da sessão (600 ms). Sem a cancelar,
   ela dispararia depois desta limpeza e voltaria a escrever no disco aquilo
   que se acabou de arrumar. */
if (typeof _sessaoT !== "undefined") clearTimeout(_sessaoT);
if (typeof guardarT !== "undefined") clearTimeout(guardarT);
if (discoSessao === null) localStorage.removeItem(SESSAO_KEY);

window.__QA = {
  total: passes + falhas.length,
  passes: passes,
  falhas: falhas.length,
  detalhe: falhas
};
console.log("QA:", window.__QA.passes + "/" + window.__QA.total, "falhas:", window.__QA.falhas);
})();
