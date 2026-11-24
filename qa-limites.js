/* ============================================================
   Suite de QA — casos-limite e cenários adversos

   Aqui não se testa o caminho feliz: testa-se o que acontece
   quando os dados são absurdos, incoerentes ou simplesmente
   estão em falta. Uma ferramenta de orçamento tem de aguentar
   um utilizador distraído sem produzir números errados.
   ============================================================ */
(function(){
"use strict";

var falhas = [], passes = 0, grupo = "", avisos = [];
function G(n){ grupo = n; }
function ok(c, nome, det){
  if (c){ passes++; return true; }
  falhas.push({grupo:grupo, teste:nome, detalhe: det == null ? "" : String(det)});
  return false;
}
function eq(a,b,nome,eps){
  var e = eps == null ? 0.005 : eps;
  var bom = (typeof a === "number" && typeof b === "number") ? Math.abs(a-b) <= e : a === b;
  return ok(bom, nome, "obtido " + JSON.stringify(a) + ", esperado " + JSON.stringify(b));
}
function finito(v, nome){
  return ok(typeof v === "number" && isFinite(v) && !isNaN(v), nome, "valor: " + v);
}
function semErro(fn, nome){
  try { fn(); passes++; return true; }
  catch(e){ ok(false, nome, "lançou: " + e.message); return false; }
}

var backup = localStorage.getItem(STORE_KEY);
var backupSessao = localStorage.getItem(SESSAO_KEY);
var vistaInicial = VIEW, mesInicial = MES;
var filtrosIniciais = JSON.parse(JSON.stringify(filtros));
var secaoInicial = ui.secaoDespesa;
var secaoEstrInicial = ui.secaoEstrategia;

/* A sessão é do utilizador, não da suite. Sai de cena enquanto se testa —
   uma sessão com rascunho faz a aplicação abrir o diálogo de recuperação
   por cima dos testes, e o que falha a seguir não tem nada que ver com o
   que se estava a medir. */
localStorage.removeItem(SESSAO_KEY);
if (document.querySelector("#modalHost .overlay")) document.getElementById("modalHost").innerHTML = "";

function limpo(){ S = estadoVazio(); limparCacheCredito(); MES = isoMes(hoje()); }
function q(s){ return document.querySelector(s); }
function qq(s){ return Array.prototype.slice.call(document.querySelectorAll(s)); }

/* ============================================================
   1. Valores absurdos não produzem NaN nem Infinity
   ============================================================ */
G("robustez numérica");
(function(){
  limpo();
  var base = {atual:0, quantidade:0, cotacao:0, contribuicao:0, crescContrib:0,
              reinvestimento:100, valorizacao:"", queda:"", vpt:0, iuc:0,
              encargos:[], rendimentos:[], aportes:[]};

  var absurdos = [
    {nome:"zeros",           o:{classe:"etf", aquisicao:0, dataAquisicao:""}},
    {nome:"negativo",        o:{classe:"etf", aquisicao:-5000, atual:-1000}},
    {nome:"enorme",          o:{classe:"etf", aquisicao:1e12, atual:1e13}},
    {nome:"minúsculo",       o:{classe:"etf", aquisicao:0.001, atual:0.002}},
    {nome:"data futura",     o:{classe:"etf", aquisicao:1000, dataAquisicao:"2099-01-01"}},
    {nome:"data antiquíssima",o:{classe:"imovel", aquisicao:1000, dataAquisicao:"1900-01-01"}},
    {nome:"taxa absurda",    o:{classe:"etf", aquisicao:1000, valorizacao:9999}},
    {nome:"taxa -100%",      o:{classe:"etf", aquisicao:1000, valorizacao:-100}},
    {nome:"classe inválida", o:{classe:"nao-existe", aquisicao:1000, atual:1000}},
    {nome:"sem classe",      o:{aquisicao:1000, atual:1000}},
  ];

  absurdos.forEach(function(caso){
    var a = Object.assign({id:"x-"+caso.nome}, base, caso.o);
    finito(valorAtivo(a), caso.nome + ": valorAtivo é finito");
    ok(valorAtivo(a) >= 0, caso.nome + ": valorAtivo não é negativo", valorAtivo(a));
    finito(retornoAtivo(a), caso.nome + ": retorno é finito");
    finito(retornoLiquido(a), caso.nome + ": retorno líquido é finito");
    finito(quedaAtivo(a), caso.nome + ": queda é finita");
    finito(encargosMensais(a), caso.nome + ": encargos são finitos");
    finito(impostoAtivo(a).anual, caso.nome + ": imposto é finito");
    semErro(function(){ fluxoAtivo(a); }, caso.nome + ": fluxo não rebenta");
    semErro(function(){ rendibilidade(a); }, caso.nome + ": rendibilidade não rebenta");
    semErro(function(){ retornoObtido(a); }, caso.nome + ": retorno obtido não rebenta");
    semErro(function(){ projetarAtivo(a, 30); }, caso.nome + ": projeção não rebenta");
    var p = projetarAtivo(a, 30);
    finito(p.fim.valor, caso.nome + ": valor projetado é finito");
    finito(p.fim.real, caso.nome + ": valor real projetado é finito");
    var rb = rendibilidade(a);
    finito(rb.bruta, caso.nome + ": rendibilidade bruta é finita");
    finito(rb.liquida, caso.nome + ": rendibilidade líquida é finita");
    ok(rb.propria === null || isFinite(rb.propria), caso.nome + ": cash-on-cash é finita ou nula", rb.propria);
  });
})();

G("créditos absurdos");
(function(){
  limpo();
  var absurdos = [
    {nome:"capital zero",   c:{capital:0, prazoMeses:120, taxaAnual:3, tipoTaxa:"fixa"}},
    {nome:"prazo zero",     c:{capital:1000, prazoMeses:0, taxaAnual:3, tipoTaxa:"fixa"}},
    {nome:"capital negativo",c:{capital:-1000, prazoMeses:120, taxaAnual:3, tipoTaxa:"fixa"}},
    {nome:"taxa negativa",  c:{capital:1000, prazoMeses:120, taxaAnual:-5, tipoTaxa:"fixa"}},
    {nome:"taxa enorme",    c:{capital:1000, prazoMeses:120, taxaAnual:99, tipoTaxa:"fixa"}},
    {nome:"prazo enorme",   c:{capital:1000, prazoMeses:600, taxaAnual:3, tipoTaxa:"fixa"}},
    {nome:"sem início",     c:{capital:1000, prazoMeses:120, taxaAnual:3, tipoTaxa:"fixa", inicio:""}},
    {nome:"variável sem indexante", c:{capital:1000, prazoMeses:120, tipoTaxa:"variavel"}},
    {nome:"variável negativa", c:{capital:100000, prazoMeses:240, tipoTaxa:"variavel", indexanteValor:-1, spread:0.5}},
  ];
  absurdos.forEach(function(caso){
    var cr = Object.assign({id:"c-"+caso.nome, inicio:"2024-01-01", seguroMensal:0}, caso.c);
    semErro(function(){ tabelaCredito(cr); }, caso.nome + ": tabela não rebenta");
    var t = tabelaCredito(cr);
    ok(Array.isArray(t), caso.nome + ": tabela é uma lista");
    t.forEach(function(l, i){
      if (i > 300) return;
      finito(l.prestacao, caso.nome + ": prestação finita");
      ok(l.saldo >= -0.01, caso.nome + ": saldo não fica negativo", l.saldo);
      ok(l.juros >= -0.01, caso.nome + ": juros não ficam negativos", l.juros);
      ok(l.taxa >= 0, caso.nome + ": taxa não fica negativa", l.taxa);
    });
    finito(jurosTotais(cr), caso.nome + ": juros totais finitos");
    finito(custoTotalCredito(cr), caso.nome + ": custo total finito");
    finito(saldoDevedorMes(cr, MES), caso.nome + ": saldo devedor finito");
    semErro(function(){ amortizacaoAnual(cr); }, caso.nome + ": mapa anual não rebenta");
    semErro(function(){ parcelaMes(cr, MES); }, caso.nome + ": parcela não rebenta");
  });

  // Uma taxa negativa é forçada a zero, não produz juros a favor do devedor
  var neg = {id:"cneg", capital:10000, prazoMeses:12, taxaAnual:-5, tipoTaxa:"fixa", inicio:"2026-01-01", seguroMensal:0};
  var tn = tabelaCredito(neg);
  ok(tn.every(function(l){ return l.juros >= 0; }), "taxa negativa não gera juros negativos");
})();

G("rendimentos absurdos");
(function(){
  limpo();
  var casos = [
    {nome:"sem componentes", rd:{componentes:[]}},
    {nome:"componente a zero", rd:{componentes:[{id:"a", especie:"base", valor:0, frequencia:"mensal"}]}},
    {nome:"valor negativo", rd:{componentes:[{id:"b", especie:"base", valor:-1000, frequencia:"mensal"}]}},
    {nome:"espécie inválida", rd:{componentes:[{id:"c", especie:"zzz", valor:100, frequencia:"mensal"}]}},
    {nome:"frequência inválida", rd:{componentes:[{id:"d", especie:"base", valor:100, frequencia:"zzz"}]}},
    {nome:"regime inválido", rd:{regime:"zzz", componentes:[{id:"e", especie:"base", valor:1000, frequencia:"mensal"}]}},
    {nome:"valor enorme", rd:{componentes:[{id:"f", especie:"base", valor:1e9, frequencia:"mensal"}]}},
  ];
  casos.forEach(function(caso){
    var rd = Object.assign({id:"r-"+caso.nome, nome:caso.nome, ativo:true, regime:"dependente"}, caso.rd);
    semErro(function(){ fiscalRendimento(rd); }, caso.nome + ": não rebenta");
    var fx = fiscalRendimento(rd);
    finito(fx.bruto, caso.nome + ": bruto finito");
    finito(fx.ss, caso.nome + ": SS finita");
    finito(fx.irs, caso.nome + ": IRS finito");
    finito(fx.liquido, caso.nome + ": líquido finito");
    finito(fx.taxaEfetiva, caso.nome + ": taxa efetiva finita");
  });

  // Regime inválido cai no dependente, não em NaN
  var rd = {id:"rx", ativo:true, regime:"zzz", componentes:[{id:"z", especie:"base", valor:1000, frequencia:"mensal"}]};
  eq(fiscalRendimento(rd).ss, 110, "regime inválido usa a taxa de dependente");

  // Taxas fiscais absurdas — no modo manual, que é onde a taxa se aplica
  S.fiscal.modoIRS = "efetiva";
  S.fiscal.irsEfetivo = 200;
  var fx = fiscalRendimento(rd);
  finito(fx.liquido, "taxa de IRS de 200% ainda dá número finito");
  ok(fx.liquido < 0, "e o líquido fica negativo, como seria de esperar");
  S.fiscal = Object.assign({}, FISCAL_PADRAO);

  // Situação familiar absurda não rebenta a escolha da tabela
  [{ec:"zzz", d:-5}, {ec:null, d:1e6}, {ec:"casado_1", d:NaN}].forEach(function(caso){
    S.fiscal.estadoCivil = caso.ec; S.fiscal.dependentes = caso.d;
    semErro(function(){ fiscalRendimento(rd); }, "situação familiar inválida não rebenta");
    var t = tabelaRF("A", caso.ec, caso.d, false);
    ok(tabRF(t) != null, "escolhe sempre uma tabela existente: " + t);
    finito(retencaoRF(2000, t, caso.d), "e a retenção continua finita");
    ok(retencaoRF(2000, t, caso.d) >= 0, "e não negativa");
  });
  // Região inválida não rebenta nem escolhe uma tabela inexistente
  ["", null, "lisboa", 42, {}].forEach(function(r){
    S.fiscal.regiao = r;
    eq(regiaoRF(), "continente", "região inválida cai no Continente: " + JSON.stringify(r));
    finito(retencaoRF(2000, "I", 0), "e a retenção continua finita");
    semErro(function(){ fiscalRendimento(rd); }, "e o cálculo da fonte não rebenta");
  });
  S.fiscal = Object.assign({}, FISCAL_PADRAO);

  // Remunerações extremas em todas as tabelas de todas as regiões
  Object.keys(TABELAS_RF.regioes).forEach(function(reg){
    Object.keys(TABELAS_RF.regioes[reg].t).forEach(function(k){
      [0, -100, 0.01, 1e6, 1e9, NaN, Infinity].forEach(function(R){
        var v = retencaoRF(R, k, 0, reg);
        finito(v, reg + "/" + k + ": retenção finita para " + R);
        ok(v >= 0, reg + "/" + k + ": retenção não negativa para " + R, v);
      });
      // Muitos dependentes nunca geram retenção negativa
      ok(retencaoRF(1500, k, 99, reg) >= 0, reg + "/" + k + ": 99 dependentes não dão retenção negativa");
    });
  });
})();

G("retenção na fonte sob condições difíceis");
(function(){
  limpo();
  S.fiscal = Object.assign({}, FISCAL_PADRAO);
  var cp = function(e,v,f,extra){
    return Object.assign({id:e+v+f, especie:e, nome:e, valor:v, frequencia:f,
                          categoriaId:"", ss:null, irs:null}, extra || {});
  };

  /* Uma fonte com todas as espécies ao mesmo tempo, em todas as regiões
     e todas as situações familiares. Se alguma combinação rebentar ou
     produzir um número absurdo, aparece aqui. */
  var todasEspecies = Object.keys(ESPECIES).map(function(e,i){
    return cp(e, 100 + i*37, especieDe(e).freq);
  });
  var combinacoes = 0;
  Object.keys(TABELAS_RF.regioes).forEach(function(reg){
    Object.keys(ESTADOS_CIVIS).forEach(function(ec){
      [0, 1, 3, 10].forEach(function(dep){
        [false, true].forEach(function(def){
          ["dependente","independente","pensao","isento"].forEach(function(regime){
            S.fiscal.regiao = reg; S.fiscal.estadoCivil = ec; S.fiscal.dependentes = dep;
            var rd = {id:"x", nome:"X", ativo:true, regime:regime, deficiencia:def,
                      componentes:todasEspecies};
            combinacoes++;
            var fx;
            try { fx = fiscalRendimento(rd); }
            catch(e){ ok(false, "combinação " + [reg,ec,dep,def,regime].join("/") + " rebentou", e.message); return; }
            if (!finito(fx.irs, "IRS finito em " + [reg,ec,dep,def,regime].join("/"))) return;
            ok(fx.irs >= 0, "IRS não negativo em " + [reg,ec,dep,def,regime].join("/"), fx.irs);
            ok(fx.irs <= fx.bruto + 0.01, "IRS não excede o bruto em " + [reg,ec,dep,def,regime].join("/"),
               fx.irs + " vs " + fx.bruto);
            ok(Math.abs(fx.liquido + fx.carga - fx.bruto) < 0.01,
               "bruto fecha em " + [reg,ec,dep,def,regime].join("/"));
            finito(fx.taxaEfetiva, "taxa efetiva finita em " + [reg,ec,dep,def,regime].join("/"));
          });
        });
      });
    });
  });
  ok(combinacoes >= 200, "combinações exercitadas: " + combinacoes);

  /* Mais dependentes nunca aumentam a retenção. */
  S.fiscal = Object.assign({}, FISCAL_PADRAO, {estadoCivil:"nao_casado"});
  var base = {id:"d", nome:"D", ativo:true, regime:"dependente",
              componentes:[cp("base", 2500, "mensal")]};
  var anterior = Infinity;
  for (var d = 0; d <= 8; d++){
    S.fiscal.dependentes = d;
    var irs = fiscalRendimento(base).irs;
    ok(irs <= anterior + 0.01, "com " + d + " dependentes a retenção não sobe", irs + " vs " + anterior);
    anterior = irs;
  }
  S.fiscal.dependentes = 0;

  /* Mais rendimento nunca reduz o líquido — o teste que apanha um escalão
     mal transcrito melhor do que qualquer outro. */
  Object.keys(TABELAS_RF.regioes).forEach(function(reg){
    S.fiscal.regiao = reg;
    var liquidoAnterior = -Infinity, quebra = 0;
    for (var v = 600; v <= 12000; v += 173){
      var rd = {id:"m", ativo:true, regime:"dependente", componentes:[cp("base", v, "mensal")]};
      var fx = fiscalRendimento(rd);
      if (fx.liquido < liquidoAnterior - 0.01){ quebra = v; break; }
      liquidoAnterior = fx.liquido;
    }
    ok(!quebra, reg + ": ganhar mais nunca deixa ninguém com menos líquido",
       quebra ? "quebra aos " + quebra + " €" : "");
  });
  S.fiscal = Object.assign({}, FISCAL_PADRAO);

  /* Componentes com valores extremos */
  [0, -1000, 1e7, 0.001].forEach(function(v){
    var rd = {id:"e", ativo:true, regime:"dependente", componentes:[cp("base", v, "mensal")]};
    semErro(function(){ fiscalRendimento(rd); }, "componente de " + v + " não rebenta");
    var fx = fiscalRendimento(rd);
    finito(fx.irs, "IRS finito com componente de " + v);
    ok(fx.irs >= 0, "IRS não negativo com componente de " + v, fx.irs);
  });

  /* Fonte sem componentes sujeitas a IRS */
  var soIsento = {id:"i", ativo:true, regime:"dependente",
                  componentes:[cp("abono", 500, "mensal"), cp("ajudas", 300, "mensal")]};
  eq(fiscalRendimento(soIsento).irs, 0, "só componentes isentas não geram retenção");
  eq(fiscalRendimento(soIsento).liquido, 800, "e o líquido é o bruto");

  /* Detalhe da retenção é coerente com o total */
  var completa = {id:"c", ativo:true, regime:"dependente", componentes:[
    cp("base", 2000, "mensal"), cp("ferias", 2000, "anual"),
    cp("natal", 2000, "anual"), cp("premio", 1500, "anual")]};
  var rf = retencaoFonte(completa);
  ok(rf.usaTabela, "usa a tabela");
  var soma = rf.detalhe.reduce(function(s,d){ return s + d.retencao * d.fator; }, 0);
  ok(Math.abs(soma - rf.retencao) < 0.01, "o detalhe soma ao total da retenção",
     soma + " vs " + rf.retencao);
  ok(rf.detalhe.every(function(d){ return d.retencao >= 0; }), "nenhuma linha do detalhe é negativa");
  eq(rf.escalao, escalaoRF(rf.tabela, rf.mensal), "o escalão indicado é o da remuneração mensal");
})();

/* ============================================================
   2. Integridade referencial
   ============================================================ */
G("referências quebradas");
(function(){
  limpo();
  // Crédito a apontar para um ativo que não existe
  S.creditos = [{id:"cx", nome:"Órfão", capital:10000, prazoMeses:60, inicio: mesShift(MES,-6)+"-01",
                 tipoTaxa:"fixa", taxaAnual:3, seguroMensal:0, ativoId:"nao-existe",
                 categoriaJurosId:"", categoriaCapitalId:"", categoriaSeguroId:""}];
  semErro(function(){ planoMes(MES); }, "plano com crédito órfão não rebenta");
  semErro(function(){ balanco(); }, "balanço com crédito órfão não rebenta");
  ok(balanco().divida > 0, "a dívida do crédito órfão continua a contar");
  semErro(function(){ irPara("creditos"); }, "vista de créditos com órfão renderiza");
  semErro(function(){ irPara("ativos"); }, "vista de ativos com crédito órfão renderiza");

  // Movimento com categoria inexistente
  limpo();
  S.movimentos = [{id:"mx", data: MES+"-05", tipo:"despesa", descricao:"Órfão",
                   categoriaId:"nao-existe", membroId:"tambem-nao", valor:100}];
  eq(catNome("nao-existe"), "Sem categoria", "categoria inexistente tem nome de recurso");
  eq(membroNome("tambem-nao"), "", "membro inexistente dá vazio");
  semErro(function(){ realMes(MES); }, "totais reais com categoria órfã não rebentam");
  eq(realMes(MES).desp, 100, "o movimento continua a contar");
  semErro(function(){ porGrupo(MES); }, "grupos com categoria órfã não rebentam");
  eq(porGrupo(MES).desejos, 100, "sem categoria cai em desejos");
  semErro(function(){ irPara("despesas"); ui.secaoDespesa="movimentos"; render(); }, "vista renderiza");

  // Encargo de ativo com categoria inexistente
  limpo();
  S.ativos = [{id:"ax", classe:"imovel", aquisicao:1000, atual:1000, quantidade:0, cotacao:0, vpt:0,
               encargos:[{id:"e", nome:"X", valor:10, frequencia:"mensal", categoriaId:"nao-existe"}],
               rendimentos:[], aportes:[]}];
  semErro(function(){ planoMes(MES); }, "encargo com categoria órfã não rebenta");
  var p = planoMes(MES);
  ok(p.desp >= 10, "o encargo continua a contar", p.desp);

  // Eliminar um membro deixa os registos coerentes
  limpo();
  S.membros = [{id:"m1", nome:"Ana"}];
  S.movimentos = [{id:"m", data:MES+"-01", tipo:"despesa", categoriaId:"", membroId:"m1", valor:10}];
  S.recorrentes = [{id:"r", tipo:"despesa", nome:"X", valor:10, frequencia:"mensal", categoriaId:"", membroId:"m1", ativo:true}];
  guardar(); render();
  irPara("config");
  var btn = q('[data-act="mbApagar"][data-id="m1"]');
  if (btn){
    btn.click();
    var sim = q('[data-dlg="yes"]'); if (sim) sim.click();
    eq(S.membros.length, 0, "o membro é removido");
    eq(S.movimentos[0].membroId, "", "o movimento fica sem membro");
    eq(S.recorrentes[0].membroId, "", "a rubrica fica sem membro");
  }
})();

/* ============================================================
   3. Fronteiras temporais
   ============================================================ */
G("fronteiras de tempo");
(function(){
  limpo();
  var cr = {id:"ct", nome:"T", capital:12000, prazoMeses:12, inicio:"2026-06-01",
            tipoTaxa:"fixa", taxaAnual:0, seguroMensal:0, ativoId:"",
            categoriaJurosId:"", categoriaCapitalId:"", categoriaSeguroId:""};
  S.creditos = [cr]; limparCacheCredito();

  // Mês anterior ao início
  MES = "2026-05";
  eq(planoMes(MES).detalheCredito.length, 0, "antes do início não há prestação no plano");
  eq(saldoDevedorMes(cr, MES), 12000, "antes do início deve tudo");

  // Primeiro e último mês
  MES = "2026-06"; limparCacheCredito();
  eq(planoMes(MES).detalheCredito.length, 1, "no primeiro mês há prestação");
  MES = "2027-05"; limparCacheCredito();
  eq(planoMes(MES).detalheCredito.length, 1, "no último mês ainda há prestação");
  eq(saldoDevedorMes(cr, MES), 0, "e fica liquidado");
  MES = "2027-06"; limparCacheCredito();
  eq(planoMes(MES).detalheCredito.length, 0, "no mês seguinte já não há");

  // Transição de ano no seletor
  MES = "2026-12";
  eq(mesShift(MES, 1), "2027-01", "dezembro para janeiro");
  semErro(function(){ irPara("painel"); }, "painel renderiza em dezembro");
  MES = "2027-01";
  semErro(function(){ irPara("painel"); }, "painel renderiza em janeiro");

  // Doze meses de evolução atravessam o ano sem falhar
  MES = "2027-02";
  for (var k = 0; k < 36; k++){
    var m = mesShift(MES, -k);
    semErro(function(){ planoMes(m); realMes(m); }, "mês " + m + " calcula");
  }

  // Um ativo adquirido no próprio mês
  limpo();
  S.ativos = [{id:"an", classe:"etf", aquisicao:1000, atual:1000, quantidade:0, cotacao:0,
               dataAquisicao: isoMes(hoje())+"-01", encargos:[], rendimentos:[], aportes:[]}];
  eq(anosDesde(isoMes(hoje())+"-01"), 0, "zero anos desde este mês");
  eq(retornoObtido(S.ativos[0]), null, "sem histórico não há retorno");
  finito(valorAtivo(S.ativos[0]), "e o valor continua finito");
})();

/* ============================================================
   4. Repetição e estabilidade
   ============================================================ */
G("estabilidade");
(function(){
  localStorage.removeItem(STORE_KEY);
  S = estadoVazio(); carregarExemplo(); MES = isoMes(hoje());

  // Render repetido dá sempre o mesmo
  irPara("ativos");
  var h1 = q("main").innerHTML.length;
  render(); render(); render();
  var h2 = q("main").innerHTML.length;
  eq(h2, h1, "repintar não muda o conteúdo");

  // Os cálculos são estáveis entre chamadas
  var p1 = planoMes(MES), p2 = planoMes(MES);
  eq(p2.rend, p1.rend, "planoMes é determinístico no rendimento");
  eq(p2.desp, p1.desp, "planoMes é determinístico na despesa");
  var b1 = balanco(), b2 = balanco();
  eq(b2.liquido, b1.liquido, "balanco é determinístico");

  // A cache do crédito não devolve resultados errados após alteração
  var cr = S.creditos[0];
  var antes = prestacao(cr, MES);
  cr.capital = cr.capital * 2;
  limparCacheCredito();
  var depois = prestacao(cr, MES);
  ok(Math.abs(depois - antes*2) < 1, "dobrar o capital dobra a prestação: " + antes + " → " + depois);
  cr.capital = cr.capital / 2; limparCacheCredito();

  // Alterar sem limpar a cache seria um bug: alterar() limpa-a.
  // O campo que mexe na prestação depende do regime — num crédito indexado
  // é o indexante, não o `taxaAnual`, que é só uma referência guardada.
  var campo = cr.tipoTaxa === "variavel" ? "indexanteValor" : "taxaAnual";
  var antes2 = prestacao(cr, MES);
  alterar(function(){ cr[campo] = parseNum(cr[campo]) + 2; });
  var depois2 = prestacao(cr, MES);
  ok(depois2 > antes2, "alterar() invalida a cache do crédito",
     campo + ": " + antes2.toFixed(2) + " → " + depois2.toFixed(2));
  alterar(function(){ cr[campo] = parseNum(cr[campo]) - 2; });

  // A cache não pode ignorar o mês: o choque aplica-se a partir dele
  var cv = {id:"cache-mes", capital:100000, prazoMeses:240, inicio:"2020-01-01",
            tipoTaxa:"variavel", indexanteValor:2, spread:1, revisaoMeses:6, seguroMensal:0};
  var mesGuardado = MES;
  MES = "2026-01"; limparCacheCredito();
  var tA = tabelaCredito(cv, 2);
  var kA = mesDiff("2020-01", "2026-01");
  MES = "2030-01";                       // muda o mês sem limpar a cache
  var tB = tabelaCredito(cv, 2);
  eq(tB[kA].taxa, 3, "visto de 2030, a prestação de 2026 mantém a taxa antiga");
  eq(tB[mesDiff("2020-01","2030-01")].taxa, 5, "e o choque começa em 2030");
  ok(tA !== tB, "a cache distingue os dois meses");
  MES = mesGuardado; limparCacheCredito();

  // A cache não cresce sem limite
  for (var i = 0; i < 200; i++) tabelaCredito(cr, i * 0.01);
  semErro(function(){ tabelaCredito(cr, 0); }, "a cache aguenta muitas variantes");
})();

G("compras planeadas adversas");
(function(){
  limpo();
  var cat = S.categorias.filter(function(c){ return c.tipo === "despesa"; })[0].id;
  var mk = function(o){ return Object.assign({id:"pl"+Math.random().toString(36).slice(2),
    nome:"X", valor:100, categoriaId:cat, horizonte:12, mes:"", objetivoId:"", feitaEm:"",
    membroId:"", criadoEm:""}, o); };

  // Valores absurdos não produzem NaN nem paralisam a análise
  [1e9, 0.001, 1e-9].forEach(function(v){
    var an = analisarPlaneada(v, 12);
    if (an){
      an.meses.forEach(function(m){ finito(m.folga, "folga finita com verba "+v); });
      ok([0,1,2].indexOf(an.melhor ? an.melhor.grau : 0) >= 0, "grau válido com verba "+v);
    } else ok(v < 0.005, "só verbas nulas não têm análise", v);
  });
  // parseNum devolve 0 ao que não é número: infinitos e NaN morrem à porta,
  // em vez de contaminarem a projeção toda com Infinity
  eq(analisarPlaneada(Infinity, 12), null, "uma verba infinita não é verba");
  eq(analisarPlaneada(NaN, 12), null, "NaN também não");
  eq(analisarPlaneada("abc", 12), null, "nem texto");
  eq(analisarPlaneada("1.234,50", 12).valor, 1234.5, "mas um valor em português é aceite");

  // Uma cobertura sem despesa de referência não vira NaN
  limpo();
  var semDesp = analisarPlaneada(100, 12);
  semDesp.meses.forEach(function(m){
    ok(!isNaN(m.cobertura), "sem despesa a cobertura não é NaN", m.cobertura);
    ok([0,2].indexOf(m.grau) >= 0, "e o grau decide-se só pela folga", m.grau);
  });

  // Referências quebradas
  limpo();
  S.planeadas = [mk({categoriaId:"nao-existe", mes:"nao-e-mes", objetivoId:"fantasma"})];
  eq(catNome("nao-existe"), "Sem categoria", "a categoria órfã tem nome de recurso");
  semErro(function(){ irPara("planear"); }, "a vista renderiza com tudo partido");
  semErro(function(){ tesourariaProjetada(12); }, "e a tesouraria também");
  eq(eventosPlaneados().length, 0, "um mês inválido não vira evento de tesouraria");
  eq(reservaMensalPlaneada(S.planeadas[0]), 0, "nem produz reserva mensal");
  var n = normalizar(JSON.parse(JSON.stringify(S)));
  eq(n.planeadas[0].mes, "", "normalizar limpa o mês impossível");
  eq(n.planeadas[0].objetivoId, "", "e a reserva fantasma");

  // Um mês já passado continua legível
  limpo();
  S.planeadas = [mk({mes: mesShift(MES, -6)})];
  semErro(function(){ irPara("planear"); }, "uma compra marcada para trás renderiza");
  ok(/já passou/i.test(q("#app").innerText), "e diz que a data passou");
  eq(tesourariaProjetada(12).filter(function(s){ return s.compras > 0; }).length, 0,
     "sem pesar num futuro onde já não está");

  // Marcada para lá do horizonte da análise
  limpo();
  S.planeadas = [mk({mes: mesShift(MES, 30), horizonte:3})];
  semErro(function(){ irPara("planear"); }, "marcada para lá do horizonte renderiza");
  eq(qq('.planTri [aria-pressed="true"]').length, 0, "sem trimestre assinalado, que está fora da faixa");
  ok(/Marcada para/.test(q("#app").innerText), "mas a data continua à vista");

  // Duas compras no mesmo mês somam-se
  limpo();
  S.planeadas = [mk({valor:1000, mes: mesShift(MES,1)}), mk({valor:500, mes: mesShift(MES,1)})];
  eq(tesourariaProjetada(12)[1].compras, 1500, "duas compras no mesmo mês somam");
  eq(eventosPlaneados().length, 2, "e são dois eventos");

  // Volume: cinquenta compras não travam a vista
  limpo();
  for (var i = 0; i < 50; i++) S.planeadas.push(mk({nome:"Compra "+i, valor: 100*(i+1),
    mes: mesShift(MES, i % 24), horizonte: [3,6,12,24][i % 4]}));
  var t0 = performance.now();
  semErro(function(){ irPara("planear"); }, "cinquenta compras planeadas renderizam");
  var dt = performance.now() - t0;
  ok(dt < 4000, "e em menos de 4 segundos: " + dt.toFixed(0) + " ms");
  if (dt > 1500) avisos.push("render de 50 compras planeadas demorou " + dt.toFixed(0) + " ms");
  finito(tesourariaProjetada(24)[23].acumulado, "a tesouraria continua finita com tudo marcado");
})();

G("volume");
(function(){
  limpo();
  // Muitos movimentos
  for (var i = 0; i < 1200; i++){
    S.movimentos.push({id:"v"+i, data: mesShift(MES, -(i % 24)) + "-15", tipo: i%3 ? "despesa":"rendimento",
                       descricao:"Mov " + i, categoriaId: S.categorias[i % S.categorias.length].id,
                       membroId:"", valor: (i % 500) + 1});
  }
  var t0 = performance.now();
  semErro(function(){ realMes(MES); }, "1200 movimentos calculam");
  semErro(function(){ irPara("despesas"); ui.secaoDespesa = "movimentos"; render(); }, "e renderizam");
  var dt = performance.now() - t0;
  ok(dt < 3000, "1200 movimentos em menos de 3 segundos: " + dt.toFixed(0) + " ms");
  if (dt > 800) avisos.push("render de 1200 movimentos demorou " + dt.toFixed(0) + " ms");

  // Muitos ativos
  limpo();
  var classes = Object.keys(CLASSES);
  for (var j = 0; j < 60; j++){
    S.ativos.push({id:"a"+j, nome:"Ativo "+j, classe: classes[j % classes.length],
                   aquisicao: 1000*(j+1), atual: 1200*(j+1), quantidade:0, cotacao:0,
                   dataAquisicao: mesShift(MES, -36)+"-01", contribuicao: j*5,
                   crescContrib:0, reinvestimento:100, vpt: 500*(j+1), iuc: j,
                   encargos:[], rendimentos:[], aportes:[]});
  }
  var t1 = performance.now();
  semErro(function(){ irPara("ativos"); }, "60 ativos renderizam");
  var dt1 = performance.now() - t1;
  ok(dt1 < 6000, "60 ativos em menos de 6 segundos: " + dt1.toFixed(0) + " ms");
  if (dt1 > 2000) avisos.push("render de 60 ativos demorou " + dt1.toFixed(0) + " ms");

  finito(balanco().liquido, "balanço com 60 ativos é finito");
  semErro(function(){ projetarCarteira(40, {ajuste:0}); }, "projeção a 40 anos com 60 ativos");

  // Um crédito de prazo máximo
  limpo();
  S.creditos = [{id:"cl", capital:500000, prazoMeses:600, inicio: mesShift(MES,-1)+"-01",
                 tipoTaxa:"variavel", indexanteValor:3, spread:1, revisaoMeses:3, seguroMensal:0}];
  var t2 = performance.now();
  semErro(function(){ tabelaCredito(S.creditos[0], 0); }, "600 prestações com revisão trimestral");
  ok(performance.now() - t2 < 500, "e depressa: " + (performance.now()-t2).toFixed(0) + " ms");
})();

/* ============================================================
   5. Coerência das identidades contabilísticas
   ============================================================ */
G("identidades contabilísticas");
(function(){
  localStorage.removeItem(STORE_KEY);
  S = estadoVazio(); carregarExemplo(); MES = isoMes(hoje());

  // Sobre vários meses, as categorias fecham sempre
  for (var k = 0; k < 14; k++){
    var m = mesShift(MES, -k);
    var p = planoMes(m);
    var somaR = 0, somaD = 0;
    Object.keys(p.porCat).forEach(function(id){
      var c = cat(id);
      if (!c) return;
      if (c.tipo === "rendimento") somaR += p.porCat[id]; else somaD += p.porCat[id];
    });
    ok(Math.abs(somaR - p.rend) < 0.01, "mês " + m + ": rendimentos fecham", somaR + " vs " + p.rend);
    ok(Math.abs(somaD - p.desp) < 0.01, "mês " + m + ": despesas fecham", somaD + " vs " + p.desp);
    eq(p.saldo, p.rend - p.desp, "mês " + m + ": saldo é a diferença");
  }

  // Balanço
  var b = balanco();
  eq(b.ativos, b.carteira + b.bens, "ativos = financeiros + reais");
  eq(b.liquido, b.ativos - b.divida, "líquido = ativos − dívida");
  // Nenhum ativo é contado duas vezes
  var somaTodos = S.ativos.reduce(function(s,a){ return s + valorAtivo(a); }, 0);
  eq(b.ativos, somaTodos, "cada ativo conta exatamente uma vez");

  // Financeiros e reais particionam os ativos
  eq(financeiros().length + reais().length, S.ativos.length, "financeiros e reais particionam a lista");
  var idsF = financeiros().map(function(a){return a.id;});
  var idsR = reais().map(function(a){return a.id;});
  ok(idsF.every(function(id){ return idsR.indexOf(id) < 0; }), "sem sobreposição entre financeiros e reais");

  // A dívida do balanço é a soma das dívidas por ativo mais os créditos sem ativo
  var porAtivo = S.ativos.reduce(function(s,a){ return s + dividaDoAtivo(a); }, 0);
  var semAtivo = S.creditos.filter(function(c){
    return !c.ativoId || !S.ativos.some(function(a){ return a.id === c.ativoId; });
  }).reduce(function(s,c){ return s + saldoDevedorMes(c, MES); }, 0);
  eq(porAtivo + semAtivo, b.divida, "a dívida reparte-se sem sobras");

  // A tabela de amortização de cada crédito fecha
  S.creditos.forEach(function(c){
    var t = tabelaCredito(c);
    var somaCap = t.reduce(function(s,l){ return s + l.capital; }, 0);
    ok(Math.abs(somaCap - parseNum(c.capital)) < 1, "crédito " + c.nome + ": capital fecha", somaCap);
    ok(Math.abs(t[t.length-1].saldo) < 0.01, "crédito " + c.nome + ": termina a zero");
  });

  // A carga fiscal do plano bate com a soma das fontes
  var fx = fiscalTotal();
  var p = planoMes(MES);
  eq(p.brutoRend, fx.bruto, "o bruto do plano é o das fontes");
  ok(Math.abs(p.cargaRend - (fx.carga + p.impostoRendas)) < 0.01,
     "a carga do plano é a das fontes mais o imposto sobre rendas",
     p.cargaRend + " vs " + (fx.carga + p.impostoRendas));

  // Fiscal de cada fonte: bruto = líquido + carga
  S.rendimentos.forEach(function(rd){
    var x = fiscalRendimento(rd);
    eq(x.liquido + x.carga, x.bruto, "fonte " + rd.nome + ": bruto = líquido + carga");
    eq(x.ss + x.irs + x.autonomo, x.carga, "fonte " + rd.nome + ": as parcelas somam à carga");
    ok(x.baseSS <= x.bruto + 0.01, "fonte " + rd.nome + ": a base não excede o bruto");
  });

  // Projeção: o valor final nunca é menor que o aportado quando o retorno é positivo
  var proj = projetarCarteira(10, {ajuste:0});
  var fim = proj[proj.length-1];
  ok(fim.valor >= totalCarteira(), "com retorno positivo a carteira não encolhe");
  finito(fim.real, "o valor real é finito");
})();

/* ============================================================
   6. Interface sob condições difíceis
   ============================================================ */
G("interface com dados extremos");
(function(){
  limpo();
  var nomeLongo = "Ativo com um nome absurdamente comprido ".repeat(6);
  S.ativos = [{id:"nl", nome:nomeLongo, classe:"etf", aquisicao:1e9, atual:1e10,
               quantidade:0, cotacao:0, dataAquisicao: mesShift(MES,-120)+"-01",
               contribuicao:1e6, crescContrib:15, reinvestimento:100, vpt:0, iuc:0,
               encargos:[], rendimentos:[], aportes:[]}];
  semErro(function(){ irPara("ativos"); }, "nome longo e valores enormes renderizam");
  ok(q("main").innerText.indexOf("Ativo com um nome") >= 0, "o nome aparece");
  // Só é medível com uma janela real: num painel oculto o innerWidth é zero
  // e a comparação não diria nada.
  if (window.innerWidth > 0){
    ok(document.body.scrollWidth <= window.innerWidth + 2,
       "a página não passa a deslocar-se horizontalmente",
       document.body.scrollWidth + " vs " + window.innerWidth);
  } else {
    avisos.push("largura da janela não medível: teste de transbordo horizontal ignorado");
  }

  // Nome com caracteres de formatação
  S.ativos[0].nome = "Ativo\ncom\tquebras   e   espaços";
  semErro(function(){ render(); }, "quebras de linha no nome não rebentam");

  // Muitas componentes numa fonte
  limpo();
  var comps = [];
  for (var i = 0; i < 40; i++){
    comps.push({id:"c"+i, especie: Object.keys(ESPECIES)[i % Object.keys(ESPECIES).length],
                nome:"Componente "+i, valor: 100+i, frequencia:"mensal", categoriaId:"", ss:null, irs:null});
  }
  S.rendimentos = [{id:"rm", nome:"Muitas", ativo:true, regime:"dependente", componentes:comps}];
  ui.abertos["rd-rm"] = true;
  semErro(function(){ irPara("rendimentos"); }, "40 componentes renderizam");
  finito(fiscalRendimento(S.rendimentos[0]).liquido, "e o cálculo continua finito");
  ui.abertos = {};
})();

G("diálogos");
(function(){
  localStorage.removeItem(STORE_KEY);
  S = estadoVazio(); carregarExemplo(); MES = isoMes(hoje());
  irPara("objetivos");

  // Eliminar é imediato, com anulação em vez de diálogo
  var b = q('[data-act="objApagar"]');
  if (b){
    var n0 = S.objetivos.length;
    b.click();
    ok(q(".overlay") == null, "eliminar não abre diálogo");
    eq(S.objetivos.length, n0 - 1, "elimina de imediato");
    var anular = q("#toast button");
    ok(anular != null, "há botão de anular no toast");
    if (anular) anular.click();
    eq(S.objetivos.length, n0, "anular repõe o objetivo");
    ok(q("#toast button") == null, "o botão de anular desaparece depois de usado");
  }

  // Escape e clicar fora fecham o diálogo de valor (pedirValor)
  var o0 = S.objetivos[0];
  q('[data-act="objContrib"][data-id="' + o0.id + '"]').click();
  ok(q(".overlay") != null, "o diálogo de reforço abre");
  document.dispatchEvent(new KeyboardEvent("keydown", {key:"Escape", bubbles:true}));
  ok(q(".overlay") == null, "Escape fecha o diálogo");
  q('[data-act="objContrib"][data-id="' + o0.id + '"]').click();
  var ov = q(".overlay");
  ov.dispatchEvent(new MouseEvent("click", {bubbles:true}));
  ok(q(".overlay") == null, "clicar fora fecha o diálogo");

  // Diálogo de valor: entrada inválida não corrompe
  var o = S.objetivos[0];
  var antes = o.atual;
  q('[data-act="objContrib"][data-id="' + o.id + '"]').click();
  q("#dlgIn").value = "não é número";
  q('[data-dlg="yes"]').click();
  eq(o.atual, antes, "texto não numérico não altera o objetivo");

  // Enter confirma
  q('[data-act="objContrib"][data-id="' + o.id + '"]').click();
  q("#dlgIn").value = "100";
  q("#dlgIn").dispatchEvent(new KeyboardEvent("keydown", {key:"Enter", bubbles:true}));
  eq(o.atual, antes + 100, "Enter confirma o valor");
  o.atual = antes;
})();

G("importação defensiva");
(function(){
  var maus = [
    "não é json",
    "null",
    "[]",
    '{"ativos":"não é lista"}',
    '{"creditos":[{"capital":"muito"}]}',
    '{"rendimentos":[{"componentes":null}]}',
    '{"fiscal":"texto"}',
    '{"ativos":[{"classe":"inexistente"}]}'
  ];
  maus.forEach(function(txt){
    var d = null;
    try { d = JSON.parse(txt); } catch(e){ passes++; return; }   // JSON inválido é apanhado antes
    if (d == null || typeof d !== "object"){ passes++; return; }
    semErro(function(){
      var n = normalizar(d);
      // e o estado normalizado tem de ser utilizável
      var guardado = S;
      S = n;
      planoMes(MES); balanco(); fiscalTotal();
      S = guardado;
    }, "importar " + txt.slice(0,40) + " não rebenta");
  });
})();

/* ============================================================
   Limpeza e relatório
   ============================================================ */
if (backup) localStorage.setItem(STORE_KEY, backup);
else localStorage.removeItem(STORE_KEY);
if (backupSessao) localStorage.setItem(SESSAO_KEY, backupSessao);
else localStorage.removeItem(SESSAO_KEY);
S = backup ? normalizar(JSON.parse(backup)) : estadoVazio();
limparCacheCredito();
MES = mesInicial;
ui.donutFoco = null; ui.simAtivo = null; ui.abertos = {}; ordem = {};
ui.fechoDispensado = null; ui.corteAlvo = 0; ui.corteAjustes = {};
ui.secaoDespesa = secaoInicial;
ui.secaoEstrategia = secaoEstrInicial;
// Os filtros são do utilizador: devolvem-se como estavam, não vazios.
filtros.texto = filtrosIniciais.texto; filtros.categoria = filtrosIniciais.categoria;
filtros.membro = filtrosIniciais.membro; filtros.tipo = filtrosIniciais.tipo;
editando = {};
irPara(vistaInicial);
/* Cancelar as gravações adiadas que a repintura acima agendou, senão
   escrevem no disco depois desta limpeza. */
if (typeof guardarT !== "undefined") clearTimeout(guardarT);
if (typeof _sessaoT !== "undefined") clearTimeout(_sessaoT);
if (backupSessao) localStorage.setItem(SESSAO_KEY, backupSessao);
else localStorage.removeItem(SESSAO_KEY);

window.__QALIM = {
  total: passes + falhas.length, passes: passes, falhas: falhas.length,
  detalhe: falhas, avisos: avisos
};
console.log("QA-limites:", passes + "/" + (passes + falhas.length), "falhas:", falhas.length);
})();
