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
   o que estivesse carregado, para que a ordem de execução não importe. */
var estadoUtilizador = JSON.parse(JSON.stringify(S));
var vistaInicial = VIEW, mesInicial = MES;
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
try { irPara(vistaInicial); } catch(e){ falhas.push({grupo:"limpeza", teste:"render final", detalhe:e.message}); }

window.__QA = {
  total: passes + falhas.length,
  passes: passes,
  falhas: falhas.length,
  detalhe: falhas
};
console.log("QA:", window.__QA.passes + "/" + window.__QA.total, "falhas:", window.__QA.falhas);
})();
