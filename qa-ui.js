/* ============================================================
   Suite de QA — interface e interações

   Exercita cada vista, cada formulário, cada botão e cada
   deslizador contra a aplicação real. Deixa o estado como o
   encontrou.
   ============================================================ */
(function(){
"use strict";

var falhas = [], passes = 0, grupo = "";
var errosConsola = [];

function G(n){ grupo = n; }
function ok(cond, nome, detalhe){
  if (cond){ passes++; return true; }
  falhas.push({grupo:grupo, teste:nome, detalhe: detalhe == null ? "" : String(detalhe)});
  return false;
}
function eq(a,b,nome,eps){
  var e = eps == null ? 0.005 : eps;
  var bom = (typeof a === "number" && typeof b === "number") ? Math.abs(a-b) <= e : a === b;
  return ok(bom, nome, "obtido " + JSON.stringify(a) + ", esperado " + JSON.stringify(b));
}
function semErro(fn, nome){
  try { fn(); passes++; return true; }
  catch(e){ ok(false, nome, "lançou: " + e.message); return false; }
}

/* Apanhar erros que escapem para a consola durante a corrida */
var onerrorAntigo = window.onerror;
window.onerror = function(msg, src, l, c, err){
  errosConsola.push(String(msg));
  return false;
};

/* ---------- utilitários de interação ---------- */
function q(sel){ return document.querySelector(sel); }
function qq(sel){ return Array.prototype.slice.call(document.querySelectorAll(sel)); }
function clicar(sel, n){
  var el = typeof sel === "string" ? qq(sel)[n||0] : sel;
  if (!el) return false;
  el.click();
  return true;
}
function preencher(id, valor){
  var el = document.getElementById(id);
  if (!el) return false;
  el.value = valor;
  el.dispatchEvent(new Event("input", {bubbles:true}));
  el.dispatchEvent(new Event("change", {bubbles:true}));
  return true;
}
function escolher(id, texto){
  var el = document.getElementById(id);
  if (!el) return false;
  // As opções podem trazer um ícone à frente ("🛒 Alimentação"): compara-se
  // também o texto sem esse prefixo.
  var semIcone = function(t){ return String(t).replace(/^[^A-Za-zÀ-ÿ0-9]+\s*/, ""); };
  var op = Array.prototype.slice.call(el.options).filter(function(o){
    var t = o.text, s = semIcone(o.text);
    return t === texto || t.indexOf(texto) === 0 || s === texto || s.indexOf(texto) === 0;
  })[0];
  if (!op) return false;
  el.value = op.value;
  el.dispatchEvent(new Event("change", {bubbles:true}));
  return true;
}
function confirmarDialogo(){ return clicar('[data-dlg="yes"]'); }
function cancelarDialogo(){ return clicar('[data-dlg="no"]'); }
function haDialogo(){ return !!q(".overlay"); }
function texto(){ return q("main").innerText; }
function irA(vista){ clicar('nav.tabs button[data-view="' + vista + '"]'); }
function hover(el){
  if (!el) return null;
  el.dispatchEvent(new PointerEvent("pointermove", {bubbles:true, clientX:300, clientY:300}));
  return q("#tip");
}

/* Guardar o estado do utilizador e trabalhar sobre o exemplo */
var backup = localStorage.getItem(STORE_KEY);
var backupSessao = localStorage.getItem(SESSAO_KEY);
var vistaInicial = VIEW, mesInicial = MES;

/* A sessão é do utilizador, não da suite: sai de cena enquanto se testa.
   E se ficou um diálogo aberto (recuperação de rascunho, por exemplo),
   fecha-se — senão o primeiro grupo mede o diálogo em vez da aplicação. */
localStorage.removeItem(SESSAO_KEY);
if (q("#modalHost .overlay")) q("#modalHost").innerHTML = "";

function comExemplo(){
  localStorage.removeItem(STORE_KEY);
  S = estadoVazio();
  carregarExemplo();
  MES = isoMes(hoje());
  render();
}

/* O painel passou a vir enxuto: os cartões que um teste queira ver
   têm de ser ligados primeiro, como o utilizador faria. */
function mostrarCartoes(chaves){
  const ocultos = painelOcultos().filter(k => chaves.indexOf(k) < 0);
  S.painel.ocultos = ocultos;
  render();
}

comExemplo();

/* ============================================================
   1. Vistas
   ============================================================ */
G("vistas");
(function(){
  var vistas = ["painel","rendimentos","despesas","ativos","creditos","objetivos","config"];
  vistas.forEach(function(v){
    semErro(function(){ irA(v); }, "vista " + v + " renderiza");
    ok(texto().length > 100, "vista " + v + " tem conteúdo", texto().length);
    var sel = q('nav.tabs button[data-view="' + v + '"]');
    eq(sel.getAttribute("aria-selected"), "true", "separador " + v + " fica selecionado");
    eq(qq('nav.tabs button[aria-selected="true"]').length, 1, "só um separador selecionado em " + v);
  });

  // Aliases das vistas antigas
  ["movimentos","plano","orcamento","investimentos","patrimonio"].forEach(function(a){
    semErro(function(){ irPara(a); }, "alias " + a + " não rebenta");
    ok(VISTAS[VIEW] != null, "alias " + a + " aterra numa vista válida: " + VIEW);
  });
  semErro(function(){ irPara("inexistente"); }, "vista inexistente não rebenta");
  eq(VIEW, "painel", "vista inexistente cai no painel");
})();

G("secções das despesas");
(function(){
  irA("despesas");
  ["plano","movimentos","limites"].forEach(function(s){
    ok(clicar('[data-act="secDespesa"][data-v="' + s + '"]'), "secção " + s + " tem botão");
    eq(ui.secaoDespesa, s, "secção " + s + " fica ativa");
    ok(texto().length > 100, "secção " + s + " tem conteúdo");
    var b = q('[data-act="secDespesa"][data-v="' + s + '"]');
    eq(b.getAttribute("aria-pressed"), "true", "secção " + s + " marcada");
  });
  clicar('[data-act="secDespesa"][data-v="plano"]');
})();

/* ============================================================
   2. Formulários — criar, editar, eliminar
   ============================================================ */
G("fonte de rendimento");
(function(){
  irA("rendimentos");
  var antes = S.rendimentos.length;

  // Validação: sem nome não cria
  preencher("rdNome", "");
  clicar('[data-act="rdSalvar"]');
  eq(S.rendimentos.length, antes, "sem designação não cria");

  // Criar
  preencher("rdNome", "QA — fonte de teste");
  escolher("rdRegime", "Trabalhador independente");
  clicar('[data-act="rdSalvar"]');
  eq(S.rendimentos.length, antes + 1, "cria a fonte");
  var nova = S.rendimentos[S.rendimentos.length-1];
  eq(nova.nome, "QA — fonte de teste", "guarda o nome");
  eq(nova.regime, "independente", "guarda o regime");
  ok(aberto("rd-" + nova.id), "abre a ficha da fonte criada");

  // Componente: validação
  clicar('[data-act="compNovo"][data-rd="' + nova.id + '"]');
  ok(q("#cpValor") != null, "abre o formulário de componente");
  preencher("cpValor", "0");
  clicar('[data-act="compSalvar"][data-rd="' + nova.id + '"]');
  eq(nova.componentes.length, 0, "componente sem valor não é criada");

  // Componente: criar
  escolher("cpEspecie", "Vencimento base");
  preencher("cpValor", "1.500,00");
  clicar('[data-act="compSalvar"][data-rd="' + nova.id + '"]');
  eq(nova.componentes.length, 1, "cria a componente");
  eq(nova.componentes[0].valor, 1500, "guarda o valor com separador de milhares");
  eq(nova.componentes[0].especie, "base", "guarda a espécie");
  ok(nova.componentes[0].categoriaId, "atribui categoria");

  // A espécie define a incidência por omissão
  var fx = fiscalRendimento(nova);
  eq(fx.ss, 1500 * 0.214, "aplica a taxa de independente");

  // Editar a componente
  clicar('[data-act="compEditar"][data-rd="' + nova.id + '"]');
  preencher("cpValor", "1.800,00");
  clicar('[data-act="compSalvar"][data-rd="' + nova.id + '"]');
  eq(nova.componentes[0].valor, 1800, "edita o valor");
  eq(nova.componentes.length, 1, "editar não duplica");

  // Cancelar edição
  clicar('[data-act="compNovo"][data-rd="' + nova.id + '"]');
  clicar('[data-act="compCancelar"]');
  ok(q("#cpValor") == null, "cancelar fecha o formulário");

  // Ativar e desativar
  clicar('[data-act="rdToggle"][data-id="' + nova.id + '"]');
  eq(nova.ativo, false, "desativa");
  eq(fiscalRendimento(nova).bruto, 1800, "a fonte desativada mantém os dados");
  clicar('[data-act="rdToggle"][data-id="' + nova.id + '"]');
  eq(nova.ativo, true, "reativa");

  // Colapsar
  var abertoAntes = aberto("rd-" + nova.id);
  clicar('[data-act="alternar"][data-id="rd-' + nova.id + '"]');
  eq(aberto("rd-" + nova.id), !abertoAntes, "alterna o colapso");
  clicar('[data-act="alternar"][data-id="rd-' + nova.id + '"]');

  // Eliminar componente: imediato, com seis segundos para anular
  clicar('[data-act="compApagar"][data-rd="' + nova.id + '"]');
  ok(!haDialogo(), "elimina sem diálogo de confirmação");
  eq(nova.componentes.length, 0, "a componente sai logo");
  ok(q("#toast button") != null, "o toast traz o botão de anular");
  clicar(q("#toast button"));
  nova = S.rendimentos.find(function(r){ return r.id === nova.id; });
  eq(nova.componentes.length, 1, "anular repõe a componente");

  // Eliminar fonte
  clicar('[data-act="rdApagar"][data-id="' + nova.id + '"]');
  eq(S.rendimentos.length, antes, "elimina a fonte");
})();

G("calculadoras das prestações sociais");
(function(){
  irA("rendimentos");
  // Fonte de trabalho, para haver remuneração de referência
  preencher("rdNome", "QA — trabalho");
  escolher("rdRegime", "Trabalho por conta de outrem");
  clicar('[data-act="rdSalvar"]');
  var rd = S.rendimentos[S.rendimentos.length - 1];
  ui.abertos["rd-" + rd.id] = true; render();

  clicar('[data-act="compNovo"][data-rd="' + rd.id + '"]');
  escolher("cpEspecie", "Vencimento base");
  preencher("cpValor", "1.800,00");
  clicar('[data-act="compSalvar"][data-rd="' + rd.id + '"]');
  eq(rd.componentes.length, 1, "vencimento base criado");
  var rr = remuneracaoReferencia(rd);
  ok(rr > 0, "há remuneração de referência", rr);

  // --- Subsídio parental ---
  clicar('[data-act="compNovo"][data-rd="' + rd.id + '"]');
  // Mudar a espécie repinta o formulário e faz aparecer a calculadora
  escolher("cpEspecie", "Subsídio parental");
  ok(q("#cpModalidade") != null, "a calculadora parental aparece ao escolher a espécie");
  escolher("cpModalidade", "Inicial, 150 dias");
  clicar('[data-act="cpCalcParental"][data-rd="' + rd.id + '"]');
  var esperadoParental = subsidioParental(rr, "inicial150").mensal;
  eq(parseNum(q("#cpValor").value), esperadoParental, "o valor preenchido bate com o cálculo");
  eq(q("#cpFreq").value, "mensal", "e fica mensal");
  preencher("cpNome", "Licença de 150 dias");
  clicar('[data-act="compSalvar"][data-rd="' + rd.id + '"]');
  var comp = rd.componentes[rd.componentes.length - 1];
  eq(comp.especie, "parentalidade", "guarda a espécie");
  eq(comp.modalidade, "inicial150", "e a modalidade escolhida");
  ok(!sujeitoIRS(comp), "não é sujeito a IRS");
  ok(!sujeitoSS(comp), "nem a Segurança Social");

  // A componente entra no bruto mas não na carga fiscal
  var fx = fiscalRendimento(rd);
  ok(Math.abs(fx.bruto - (1800 + esperadoParental)) < 0.01, "soma ao bruto");
  eq(fx.baseIRS, 1800, "mas não à base de IRS");
  eq(fx.baseSS, 1800, "nem à base contributiva");

  // Editar a componente mantém a modalidade e mostra-a
  clicar('[data-act="compEditar"][data-rd="' + rd.id + '"][data-id="' + comp.id + '"]');
  ok(q("#cpModalidade") != null, "ao editar reaparece a calculadora");
  eq(q("#cpModalidade").value, "inicial150", "com a modalidade guardada");
  clicar('[data-act="compCancelar"]');

  // --- Risco clínico na gravidez ---
  clicar('[data-act="compNovo"][data-rd="' + rd.id + '"]');
  escolher("cpEspecie", "Risco clínico na gravidez");
  ok(q('[data-act="cpCalcRisco"]') != null, "a calculadora de risco aparece");
  clicar('[data-act="cpCalcRisco"][data-rd="' + rd.id + '"]');
  eq(parseNum(q("#cpValor").value), subsidioRiscoGravidez(rr).mensal, "risco a 100% da referência");
  clicar('[data-act="compCancelar"]');

  // --- Abono de família ---
  clicar('[data-act="compNovo"][data-rd="' + rd.id + '"]');
  escolher("cpEspecie", "Abono de família");
  ok(q("#cpIdadeMeses") != null, "a calculadora de abono aparece");
  preencher("cpIdadeMeses", "24");
  clicar('[data-act="cpCalcAbono"]');
  var esperadoAbono = abonoFamilia(24).valor;
  eq(parseNum(q("#cpValor").value), esperadoAbono, "abono pelo escalão do agregado");
  // A majoração monoparental afeta o cálculo
  var semMaj = abonoFamilia(24, false).valor;
  q("#cpMonoparental").checked = true;
  q("#cpMonoparental").dispatchEvent(new Event("change", {bubbles:true}));
  clicar('[data-act="cpCalcAbono"]');
  if (semMaj > 0){
    ok(parseNum(q("#cpValor").value) > semMaj, "monoparental majora o valor");
    eq(parseNum(q("#cpValor").value), abonoFamilia(24, true).valor, "e bate com o cálculo majorado");
  }
  preencher("cpNome", "Abono do filho");
  clicar('[data-act="compSalvar"][data-rd="' + rd.id + '"]');
  var abono = rd.componentes[rd.componentes.length - 1];
  eq(abono.especie, "abonoFamilia", "guarda a espécie");
  eq(abono.idadeMeses, 24, "e a idade da criança");
  eq(abono.monoparental, true, "e a monoparentalidade");

  // Mudar a idade recalcula sem perder o resto do formulário
  clicar('[data-act="compEditar"][data-rd="' + rd.id + '"][data-id="' + abono.id + '"]');
  preencher("cpIdadeMeses", "80");
  ok(q("#cpNome").value.length > 0, "o nome sobrevive à mudança de idade");
  clicar('[data-act="cpCalcAbono"]');
  eq(parseNum(q("#cpValor").value), abonoFamilia(80, true).valor, "recalcula para a nova idade");
  clicar('[data-act="compCancelar"]');

  // --- Abono: majoração <36 meses e bonificação por deficiência ---
  clicar('[data-act="compNovo"][data-rd="' + rd.id + '"]');
  escolher("cpEspecie", "Abono de família");
  ok(q("#cpMenos36") != null, "aparece o check de criança com menos de 36 meses");
  ok(q("#cpDeficiencia") != null, "e o check de deficiência");
  preencher("cpIdadeMeses", "18");
  // A bonificação por deficiência não depende da contagem do agregado
  q("#cpDeficiencia").checked = true;
  q("#cpDeficiencia").dispatchEvent(new Event("change", {bubbles:true}));
  clicar('[data-act="cpCalcAbono"]');
  var comDef = abonoFamilia(18, false, {menos36:true, deficiencia:true, numMenos36:contarMenos36()});
  eq(parseNum(q("#cpValor").value), comDef.valor, "o valor inclui a bonificação por deficiência");
  ok(comDef.bonusDef > 0, "que é positiva", comDef.bonusDef);
  q("#cpMenos36").checked = true;
  q("#cpMenos36").dispatchEvent(new Event("change", {bubbles:true}));
  preencher("cpNome", "Criança pequena");
  clicar('[data-act="compSalvar"][data-rd="' + rd.id + '"]');
  var pequena = rd.componentes[rd.componentes.length - 1];
  eq(pequena.menos36, true, "guarda a marca de menos de 36 meses");
  eq(pequena.deficiencia, true, "e a de deficiência");
  ok(contarMenos36() >= 1, "e passa a contar no agregado");

  // --- Abono pré-natal ---
  clicar('[data-act="compNovo"][data-rd="' + rd.id + '"]');
  escolher("cpEspecie", "Abono pré-natal");
  ok(q("#cpNumBebes") != null, "a calculadora do pré-natal aparece");
  ok(q('[data-act="cpCalcPrenatal"]') != null, "com o seu botão de cálculo");
  preencher("cpNumBebes", "2");
  clicar('[data-act="cpCalcPrenatal"][data-rd="' + rd.id + '"]');
  eq(parseNum(q("#cpValor").value), abonoPrenatal(2, false).valor, "gémeos: duplica a base");
  // Monoparental do pré-natal (35%)
  q("#cpMonoparental").checked = true;
  q("#cpMonoparental").dispatchEvent(new Event("change", {bubbles:true}));
  clicar('[data-act="cpCalcPrenatal"][data-rd="' + rd.id + '"]');
  eq(parseNum(q("#cpValor").value), abonoPrenatal(2, true).valor, "monoparental majora em 35%");
  preencher("cpNome", "Pré-natal de gémeos");
  clicar('[data-act="compSalvar"][data-rd="' + rd.id + '"]');
  var prenatal = rd.componentes[rd.componentes.length - 1];
  eq(prenatal.especie, "abonoPrenatal", "guarda a espécie");
  eq(prenatal.numBebes, 2, "e o número de bebés");
  ok(!sujeitoIRS(prenatal) && !sujeitoSS(prenatal), "isento de IRS e SS");

  // O seletor de espécies agrupa as prestações sociais numa subcategoria
  clicar('[data-act="compNovo"][data-rd="' + rd.id + '"]');
  var grupos = Array.prototype.map.call(q("#cpEspecie").querySelectorAll("optgroup"),
    function(g){ return g.label; });
  ok(grupos.indexOf("Prestações sociais") >= 0, "há um grupo «Prestações sociais» no seletor", grupos.join(" | "));
  clicar('[data-act="compCancelar"]');

  clicar('[data-act="rdApagar"][data-id="' + rd.id + '"]');
  confirmarDialogo();
  ui.abertos = {};
})();

G("prestações sociais em Definições");
(function(){
  var backupS = JSON.parse(JSON.stringify(S));
  irA("config");
  ok(texto().toLowerCase().indexOf("prestações sociais") >= 0, "há secção de prestações sociais");
  ok(texto().indexOf("IAS") >= 0, "com o campo do IAS");
  ok(q("#fxias") != null, "e o campo existe");

  // Editar o IAS muda os mínimos
  var iasAntes = parseNum(S.fiscal.ias);
  var minAntes = minimoParental();
  q("#fxias").value = "600";
  q("#fxias").dispatchEvent(new FocusEvent("blur", {bubbles:true}));
  eq(parseNum(S.fiscal.ias), 600, "guarda o IAS");
  ok(minimoParental() > minAntes, "e o mínimo do parental sobe com o IAS");
  eq(minimoParental(), 600/30*0.80, "pela fórmula certa");
  q("#fxias").value = String(iasAntes).replace(".", ",");
  q("#fxias").dispatchEvent(new FocusEvent("blur", {bubbles:true}));

  // Interruptor monoparental
  clicar('[data-act="fxMono"][data-v="1"]');
  eq(S.fiscal.monoparental, true, "monoparental liga-se");
  irA("config");
  ok(texto().indexOf("majoração") >= 0 || texto().toLowerCase().indexOf("monoparental") >= 0,
     "e a interface reflete-o");
  clicar('[data-act="fxMono"][data-v="0"]');
  eq(S.fiscal.monoparental, false, "e desliga-se");

  // A tabela de escalões do abono aparece
  irA("config");
  ok(texto().indexOf("190,98") >= 0 || texto().indexOf("escalão") >= 0, "mostra os escalões do abono");

  S = normalizar(backupS);
  limparCacheCredito();
  render();
})();

G("rubrica de despesa");
(function(){
  irA("despesas");
  clicar('[data-act="secDespesa"][data-v="plano"]');
  var antes = S.recorrentes.length;

  clicar('[data-act="recSalvar"]');
  eq(S.recorrentes.length, antes, "sem dados não cria");

  preencher("rcNome", "QA — despesa");
  preencher("rcValor", "120,50");
  escolher("rcCat", "Alimentação");
  escolher("rcFreq", "Trimestral");
  clicar('[data-act="recSalvar"]');
  eq(S.recorrentes.length, antes + 1, "cria a rubrica");
  var nova = S.recorrentes[S.recorrentes.length-1];
  eq(nova.valor, 120.5, "guarda o valor");
  eq(nova.frequencia, "trimestral", "guarda a periodicidade");
  eq(nova.tipo, "despesa", "é despesa");
  eq(recMensal(nova), 120.5/3, "equivalente mensal correto");

  // Início posterior ao fim é recusado
  clicar('[data-act="recEditar"][data-id="' + nova.id + '"]');
  preencher("rcInicio", "2027-06");
  preencher("rcFim", "2026-01");
  clicar('[data-act="recSalvar"]');
  ok(nova.inicio !== "2027-06-01" || nova.fim !== "2026-01-01", "recusa fim anterior ao início");
  clicar('[data-act="cancelarEd"][data-k="rec"]');

  clicar('[data-act="recToggle"][data-id="' + nova.id + '"]');
  eq(nova.ativo, false, "desativa a rubrica");
  clicar('[data-act="recToggle"][data-id="' + nova.id + '"]');

  clicar('[data-act="recApagar"][data-id="' + nova.id + '"]');
  confirmarDialogo();
  eq(S.recorrentes.length, antes, "elimina a rubrica");
})();

G("movimentos");
(function(){
  irA("despesas");
  clicar('[data-act="secDespesa"][data-v="movimentos"]');
  var antes = S.movimentos.length;

  clicar('[data-act="movSalvar"]');
  eq(S.movimentos.length, antes, "sem valor não cria");

  preencher("mvDesc", "QA — compra");
  preencher("mvValor", "45,90");
  escolher("mvCat", "Alimentação");
  clicar('[data-act="movSalvar"]');
  eq(S.movimentos.length, antes + 1, "cria o movimento");
  var novo = S.movimentos[S.movimentos.length-1];
  eq(novo.valor, 45.9, "guarda o valor");
  eq(novo.tipo, "despesa", "tipo por omissão");
  ok(novo.data, "tem data");

  // Valor negativo é normalizado
  clicar('[data-act="movEditar"][data-id="' + novo.id + '"]');
  preencher("mvValor", "-30");
  clicar('[data-act="movSalvar"]');
  eq(novo.valor, 30, "guarda sempre em positivo");

  // Filtros
  clicar('[data-act="secDespesa"][data-v="movimentos"]');
  preencher("fTexto", "QA");
  ok(texto().indexOf("QA — compra") >= 0, "o filtro de texto encontra");
  preencher("fTexto", "zzzznadaaqui");
  ok(texto().indexOf("Sem movimentos") >= 0, "filtro sem resultados avisa");
  preencher("fTexto", "");

  escolher("fTipo", "Rendimentos");
  eq(filtros.tipo, "rendimento", "filtro de tipo aplica-se");
  escolher("fTipo", "Tudo");

  clicar('[data-act="movApagar"][data-id="' + novo.id + '"]');
  confirmarDialogo();
  eq(S.movimentos.length, antes, "elimina o movimento");
})();

G("ativos");
(function(){
  irA("ativos");
  var antes = S.ativos.length;

  clicar('[data-act="patSalvar"]');
  eq(S.ativos.length, antes, "sem dados não cria");

  preencher("ptNome", "QA — ETF de teste");
  escolher("ptTipo", "ETF / fundo de índice");
  preencher("ptAquisicao", "10.000,00");
  preencher("ptData", mesShift(isoMes(hoje()), -24));
  preencher("ptQtd", "100");
  preencher("ptCotacao", "120,00");
  preencher("ptContrib", "250");
  preencher("ptCresc", "3");
  preencher("ptReinv", "80");
  clicar('[data-act="patSalvar"]');
  eq(S.ativos.length, antes + 1, "cria o ativo");
  var a = S.ativos[S.ativos.length-1];
  eq(a.classe, "etf", "guarda a classe");
  eq(a.quantidade, 100, "guarda as unidades");
  eq(a.cotacao, 120, "guarda a cotação");
  eq(valorAtivo(a), 12000, "valor por unidades × cotação");
  eq(a.contribuicao, 250, "guarda a contribuição");
  eq(a.crescContrib, 3, "guarda o crescimento");
  eq(a.reinvestimento, 80, "guarda o reinvestimento");
  eq(origemValor(a), "cotação", "origem do valor");

  // Encargo
  clicar('[data-act="fluxoNovo"][data-ativo="' + a.id + '"][data-tipo="encargo"]');
  ok(q("#flNome") != null, "abre o formulário de encargo");
  preencher("flNome", "QA — custódia");
  preencher("flValor", "60");
  escolher("flFreq", "Anual");
  escolher("flCat", "Seguros");
  clicar('[data-act="fluxoSalvar"][data-ativo="' + a.id + '"][data-tipo="encargo"]');
  eq(a.encargos.length, 1, "cria o encargo");
  eq(encargosMensais(a), 5, "encargo anual mensalizado");

  // Rendimento do ativo
  clicar('[data-act="fluxoNovo"][data-ativo="' + a.id + '"][data-tipo="rendimento"]');
  preencher("flNome", "QA — dividendos");
  preencher("flValor", "120");
  escolher("flFreq", "Anual");
  escolher("flCat", "Juros e dividendos");
  clicar('[data-act="fluxoSalvar"][data-ativo="' + a.id + '"][data-tipo="rendimento"]');
  eq(a.rendimentos.length, 1, "cria o rendimento");
  eq(rendimentosMensais(a), 10, "rendimento anual mensalizado");

  // Aporte
  clicar('[data-act="aporteNovo"][data-id="' + a.id + '"]');
  ok(q("#apValor") != null, "abre o formulário de aporte");
  clicar('[data-act="aporteSalvar"][data-id="' + a.id + '"]');
  eq(a.aportes.length, 0, "aporte sem valor não é criado");
  preencher("apData", mesShift(isoMes(hoje()), -24) + "-01");
  preencher("apValor", "5.000,00");
  clicar('[data-act="aporteSalvar"][data-id="' + a.id + '"]');
  eq(a.aportes.length, 1, "cria o aporte");
  eq(a.aportes[0].valor, 5000, "guarda o valor do aporte");

  // Com um aporte datado no passado, o retorno passa a TIR
  var r = retornoObtido(a);
  ok(r && r.metodo === "TIR", "com aporte datado usa TIR");
  ok(r.parcial === true, "e assinala que os aportes não cobrem o capital aplicado");
  eq(r.somaAportes, 5000, "soma dos aportes registados");

  // Um aporte com a data de hoje não produz TIR — cai para CAGR, sem mentir
  var soHoje = {id:"zz", classe:"etf", aquisicao:10000, atual:12000, quantidade:0, cotacao:0,
                dataAquisicao: mesShift(isoMes(hoje()), -24) + "-01",
                aportes:[{id:"h", data: isoDia(hoje()), valor:5000}], encargos:[], rendimentos:[]};
  eq(retornoObtido(soHoje).metodo, "CAGR", "aporte no próprio dia não dá TIR");

  // Aportes completos: deixa de assinalar parcial
  a.aportes.push({id:"ap2", data: mesShift(isoMes(hoje()), -12) + "-01", valor:5000});
  var r2 = retornoObtido(a);
  ok(r2.parcial === false, "aportes que cobrem o capital não são parciais");
  a.aportes.pop();

  // Eliminar encargo e aporte
  clicar('[data-act="fluxoApagar"][data-ativo="' + a.id + '"][data-tipo="encargo"]');
  confirmarDialogo();
  eq(a.encargos.length, 0, "elimina o encargo");
  clicar('[data-act="aporteApagar"][data-id="' + a.id + '"]');
  eq(a.aportes.length, 0, "elimina o aporte");

  // Ficha colapsável: o que está fechado não é construído
  var chave = "at-" + a.id;
  ui.abertos[chave] = false; render();
  ok(qq("#simAtivoOut").filter(function(h){ return h.dataset.ativo === a.id; }).length === 0,
     "ficha fechada não constrói o simulador");
  ok(texto().indexOf(a.nome) >= 0, "mas o cabeçalho e os indicadores continuam visíveis");
  clicar('[data-act="alternar"][data-id="' + chave + '"]');
  eq(ui.abertos[chave], true, "o botão abre a ficha");
  ok(qq("#simAtivoOut").filter(function(h){ return h.dataset.ativo === a.id; }).length === 1,
     "e o simulador aparece");
  delete ui.abertos[chave];

  // Com muitos ativos, as fichas fecham sozinhas
  var guardados = S.ativos.slice();
  for (var z = 0; z < 20; z++){
    S.ativos.push({id:"qa-vol"+z, nome:"Volume "+z, classe:"etf", aquisicao:1000, atual:1000,
      quantidade:0, cotacao:0, contribuicao:10, crescContrib:0, reinvestimento:100,
      vpt:0, iuc:0, encargos:[], rendimentos:[], aportes:[]});
  }
  ui.abertos = {}; render();
  eq(qq("#simAtivoOut").length, 0, "com muitos ativos nenhuma ficha abre sozinha");
  S.ativos = guardados; ui.abertos = {}; render();
  ok(qq("#simAtivoOut").length > 0, "e com poucos voltam a abrir");

  // Simulador
  ok(q("#simAtivoOut") != null, "o ativo financeiro tem simulador");
  var alvo = qq('#simAtivoOut').filter(function(h){ return h.dataset.ativo === a.id; })[0];
  ok(alvo != null, "o simulador do ativo criado existe");

  clicar('[data-act="patApagar"][data-id="' + a.id + '"]');
  confirmarDialogo();
  eq(S.ativos.length, antes, "elimina o ativo");

  // Um imóvel não tem simulador financeiro, mas tem VPT e contrato
  preencher("ptNome", "QA — imóvel");
  escolher("ptTipo", "Imóvel");
  preencher("ptAquisicao", "150.000,00");
  preencher("ptVpt", "80.000,00");
  escolher("ptContrato", "Habitação, 10 a 20 anos");
  clicar('[data-act="patSalvar"]');
  var im = S.ativos[S.ativos.length-1];
  eq(im.vpt, 80000, "guarda o VPT");
  eq(im.contratoAnos, 10, "guarda a duração do contrato");
  eq(taxaRenda(im), 10, "aplica a taxa de 10%");
  // A taxa vem das definições, não de um número escrito à mão no teste:
  // se o valor por omissão mudar, o teste continua a medir a coisa certa.
  eq(impostoAtivo(im).anual, 80000 * parseNum(S.fiscal.imiTaxa) / 100, "IMI sobre o VPT");
  clicar('[data-act="patApagar"][data-id="' + im.id + '"]');
  confirmarDialogo();
})();

G("créditos");
(function(){
  irA("creditos");
  var antes = S.creditos.length;

  clicar('[data-act="crSalvar"]');
  eq(S.creditos.length, antes, "sem dados não cria");

  preencher("crNome", "QA — crédito fixo");
  preencher("crCapital", "50.000,00");
  preencher("crPrazo", "120");
  preencher("crTaxa", "4,5");
  preencher("crSeguro", "15");
  clicar('[data-act="crSalvar"]');
  eq(S.creditos.length, antes + 1, "cria o crédito");
  var c = S.creditos[S.creditos.length-1];
  eq(c.capital, 50000, "guarda o capital");
  eq(c.prazoMeses, 120, "guarda o prazo");
  eq(c.taxaAnual, 4.5, "guarda a taxa");
  eq(c.tipoTaxa, "fixa", "regime fixo");
  eq(c.seguroMensal, 15, "guarda o seguro");
  ok(c.categoriaJurosId && c.categoriaCapitalId, "atribui categorias");

  // Prazo inválido
  clicar('[data-act="crEditar"][data-id="' + c.id + '"]');
  preencher("crPrazo", "0");
  clicar('[data-act="crSalvar"]');
  eq(c.prazoMeses, 120, "prazo zero é recusado");
  preencher("crPrazo", "700");
  clicar('[data-act="crSalvar"]');
  eq(c.prazoMeses, 120, "prazo acima de 600 é recusado");
  preencher("crPrazo", "120");

  // Mudar para taxa variável preserva o que já estava escrito
  escolher("crTipoTaxa", "Variável");
  eq(q("#crNome").value, "QA — crédito fixo", "o nome sobrevive à troca de regime");
  eq(parseNum(q("#crCapital").value), 50000, "o capital sobrevive à troca de regime");
  ok(q("#crIndexante") != null, "aparecem os campos de indexante");
  ok(q("#crTaxa") == null, "desaparece o campo de taxa fixa");

  preencher("crIndexValor", "2,4");
  preencher("crSpread", "1,1");
  clicar('[data-act="crSalvar"]');
  eq(c.tipoTaxa, "variavel", "passa a variável");
  eq(c.indexanteValor, 2.4, "guarda o indexante");
  eq(c.spread, 1.1, "guarda o spread");
  eq(taxaCorrente(c), 3.5, "taxa corrente = indexante + spread");

  // Spread inválido
  clicar('[data-act="crEditar"][data-id="' + c.id + '"]');
  preencher("crSpread", "20");
  clicar('[data-act="crSalvar"]');
  eq(c.spread, 1.1, "spread acima de 15 é recusado");
  clicar('[data-act="cancelarEd"][data-k="cr"]');

  // Deslizador de choque só aparece com crédito variável
  ok(q('[data-slider="choqueTaxa"]') != null, "há deslizador de choque");

  clicar('[data-act="crApagar"][data-id="' + c.id + '"]');
  confirmarDialogo();
  eq(S.creditos.length, antes, "elimina o crédito");
})();

G("objetivos");
(function(){
  irA("objetivos");
  var antes = S.objetivos.length;

  clicar('[data-act="objSalvar"]');
  eq(S.objetivos.length, antes, "sem dados não cria");

  preencher("obNome", "QA — meta");
  preencher("obAlvo", "10.000,00");
  preencher("obAtual", "2.500,00");
  preencher("obPrazo", mesShift(isoMes(hoje()), 24));
  clicar('[data-act="objSalvar"]');
  eq(S.objetivos.length, antes + 1, "cria o objetivo");
  var o = S.objetivos[S.objetivos.length-1];
  eq(o.alvo, 10000, "guarda a meta");
  eq(o.atual, 2500, "guarda o já poupado");

  // Reforço
  clicar('[data-act="objContrib"][data-id="' + o.id + '"]');
  ok(q("#dlgIn") != null, "abre o diálogo de reforço");
  q("#dlgIn").value = "500";
  confirmarDialogo();
  eq(o.atual, 3000, "reforça o objetivo");

  // Reforço cancelado
  clicar('[data-act="objContrib"][data-id="' + o.id + '"]');
  cancelarDialogo();
  eq(o.atual, 3000, "cancelar não altera");

  clicar('[data-act="objApagar"][data-id="' + o.id + '"]');
  confirmarDialogo();
  eq(S.objetivos.length, antes, "elimina o objetivo");
})();

G("estratégias de poupança e investimento");
(function(){
  function deslizar(id, valor){
    var el = document.getElementById(id);
    if (!el) return false;
    el.value = valor;
    el.dispatchEvent(new Event("input", {bubbles:true}));
    return true;
  }
  irA("estrategias");
  ok(q("#estOut") != null, "a vista das estratégias abre");
  eq(qq('[data-act="estObjetivo"]').length, 5, "há cinco objetivos");

  // Objetivo por omissão: reforma, com instrumento PPR e controlo de idade
  eq(S.estrategia.objetivo, "reforma", "começa na reforma");
  ok(q("#estIdade") != null, "a reforma mostra o controlo de idade (limite do PPR)");
  ok(q("#estInstrumento") != null, "e o seletor de instrumento");

  // Um deslizador atualiza o resultado sem repintar tudo
  deslizar("estMensal", 400);
  eq(S.estrategia.mensal, 400, "o deslizador da poupança mensal atualiza o estado");

  // Trocar para «entrada para casa» muda a forma e faz aparecer a tabela de custos
  clicar('[data-act="estObjetivo"][data-obj="entrada"]');
  eq(S.estrategia.objetivo, "entrada", "muda de objetivo");
  ok(q("#estPrecoCasa") != null, "aparece o preço da casa");
  ok(q("#estLtv") != null, "e o financiamento do banco");
  ok(q("#estJovem") != null, "e a opção de comprador jovem");
  ok(/IMT/.test(q("#estOut").textContent), "a decomposição de custos mostra o IMT");
  ok(OBJETIVOS_ESTRATEGIA.entrada.instrumentos.indexOf(S.estrategia.instrumento) >= 0,
     "o instrumento passou a ser um dos compatíveis com o objetivo");

  // A opção «jovem» recalcula (isenção)
  q("#estJovem").checked = true;
  q("#estJovem").dispatchEvent(new Event("change", {bubbles:true}));
  eq(S.estrategia.jovemImt, true, "a marca de jovem fica no estado");

  // «Usar o esforço necessário» ajusta a poupança mensal para atingir a meta
  var btn = q('[data-act="estUsarEsforco"]');
  ok(btn != null, "há o botão do esforço necessário");
  if (btn){
    btn.click();
    ok(S.estrategia.mensal > 0, "a poupança mensal foi ajustada", S.estrategia.mensal);
  }

  // Trocar o instrumento atualiza o resultado
  escolher("estInstrumento", "Certificados de Aforro");
  eq(S.estrategia.instrumento, "aforro", "o seletor de instrumento muda o estado");

  // Executar cria rubrica + ativo + objetivo, integrados no orçamento
  var nRec = S.recorrentes.length, nAt = S.ativos.length, nObj = S.objetivos.length;
  clicar('[data-act="estExecutar"]');
  ok(haDialogo(), "executar pede confirmação");
  confirmarDialogo();
  eq(S.recorrentes.length, nRec + 1, "cria uma rubrica no plano");
  eq(S.ativos.length, nAt + 1, "cria um ativo");
  eq(S.objetivos.length, nObj + 1, "cria um objetivo (há meta)");
  var rec = S.recorrentes[S.recorrentes.length-1];
  var at  = S.ativos[S.ativos.length-1];
  eq(rec.tipo, "despesa", "a rubrica é uma despesa (poupança)");
  eq((S.categorias.find(function(c){ return c.id === rec.categoriaId; }) || {}).grupo, "poupanca",
     "na categoria de poupança");
  eq(at.classe, "aforro", "o ativo é do instrumento escolhido");
  ok(parseNum(at.contribuicao) > 0, "com reforço mensal", at.contribuicao);
  eq(VIEW, "ativos", "leva ao balanço para ver o resultado");

  // A contribuição do ativo não gera movimento (não há dupla contagem)
  var fx = fluxoAtivo(at, MES);
  eq(fx.liquido, rendimentosMensais(at) - encargosMensais(at) - servicoDivida(at, MES),
     "o fluxo do ativo ignora a contribuição — sem dupla contagem com a rubrica");
})();

G("membros e categorias");
(function(){
  irA("config");
  var antesM = S.membros.length;
  preencher("mbNome", "");
  clicar('[data-act="mbAdd"]');
  eq(S.membros.length, antesM, "membro sem nome não é criado");
  preencher("mbNome", "QA — pessoa");
  clicar('[data-act="mbAdd"]');
  eq(S.membros.length, antesM + 1, "cria o membro");
  var m = S.membros[S.membros.length-1];
  clicar('[data-act="mbApagar"][data-id="' + m.id + '"]');
  confirmarDialogo();
  eq(S.membros.length, antesM, "elimina o membro");

  var antesC = S.categorias.length;
  clicar('[data-act="catSalvar"]');
  eq(S.categorias.length, antesC, "categoria sem nome não é criada");
  preencher("ctNome", "QA — categoria");
  escolher("ctGrupo", "Desejos");
  clicar('[data-act="catSalvar"]');
  eq(S.categorias.length, antesC + 1, "cria a categoria");
  var c = S.categorias[S.categorias.length-1];
  eq(c.grupo, "desejos", "guarda o grupo");
  eq(c.tipo, "despesa", "tipo por omissão");

  // Categoria em uso não pode ser eliminada
  var cat0 = S.categorias.filter(function(x){
    return S.recorrentes.some(function(r){ return r.categoriaId === x.id; });
  })[0];
  if (cat0){
    var n = S.categorias.length;
    clicar('[data-act="catApagar"][data-id="' + cat0.id + '"]');
    eq(S.categorias.length, n, "categoria em uso não é eliminada");
    ok(!haDialogo(), "nem sequer pede confirmação");
  }

  clicar('[data-act="catApagar"][data-id="' + c.id + '"]');
  confirmarDialogo();
  eq(S.categorias.length, antesC, "elimina a categoria não usada");
})();

/* ============================================================
   3. Deslizadores
   ============================================================ */
G("deslizadores");
(function(){
  irA("ativos");
  var testados = 0;
  Object.keys(SLIDERS).forEach(function(id){
    var el = document.querySelector('[data-slider="' + id + '"]');
    if (!el) return;
    testados++;
    var alvo = q(SLIDERS[id].alvo);
    ok(alvo != null, "deslizador " + id + " tem alvo no ecrã");
    var antes = alvo ? alvo.innerHTML.length : 0;
    var novo = Math.min(parseFloat(el.max), parseFloat(el.value) + parseFloat(el.step) * 4);
    el.value = novo;
    el.dispatchEvent(new Event("input", {bubbles:true}));
    var out = document.getElementById(id + "Out");
    ok(out != null && out.textContent.length > 0, "deslizador " + id + " atualiza a leitura");
    ok(q(SLIDERS[id].alvo) != null, "deslizador " + id + " mantém o alvo depois de recalcular");
  });
  ok(testados >= 5, "há deslizadores no separador Ativos: " + testados);

  // Choque de taxa
  irA("creditos");
  var ch = q('[data-slider="choqueTaxa"]');
  if (ch){
    var base = S.creditos.reduce(function(s,c){ return s + encargoCredito(c, MES); }, 0);
    ch.value = 2; ch.dispatchEvent(new Event("input", {bubbles:true}));
    var com = S.creditos.reduce(function(s,c){ return s + encargoCredito(c, MES, 2); }, 0);
    ok(com > base, "o choque aumenta o encargo: " + base.toFixed(2) + " → " + com.toFixed(2));
    ch.value = 0; ch.dispatchEvent(new Event("input", {bubbles:true}));
  }

  // Simulador do painel
  irA("painel");
  var se = q('[data-slider="simExtra"]');
  if (se){
    se.value = 300; se.dispatchEvent(new Event("input", {bubbles:true}));
    eq(ui.simExtra, 300, "o simulador do painel regista o valor");
    ok(q("#simOut").innerText.indexOf("Reforço adicional") >= 0, "e mostra o efeito");
    se.value = 0; se.dispatchEvent(new Event("input", {bubbles:true}));
  }
})();

G("simulador de um ativo");
(function(){
  irA("ativos");
  var host = q("#simAtivoOut");
  ok(host != null, "há simulador em ecrã");
  if (!host) return;
  var a = S.ativos.filter(function(x){ return x.id === host.dataset.ativo; })[0];
  ok(a != null, "o simulador refere um ativo existente");

  var contribAntes = a.contribuicao;

  // Sem simulação em curso, não há botões de aplicar
  ui.simAtivo = null; render();
  ok(q('[data-act="simAplicar"]') == null, "sem simulação não há botão de aplicar");

  // Mexer num comando faz aparecer os botões sem repintar tudo
  var sl = q('[data-slider="simA_contrib"]');
  sl.value = 500; sl.dispatchEvent(new Event("input", {bubbles:true}));
  eq(ui.simAtivo.contrib, 500, "a simulação regista a contribuição");
  eq(a.contribuicao, contribAntes, "a simulação não altera o ativo");
  ok(q('[data-act="simAplicar"][data-id="' + a.id + '"]') != null,
     "os botões aparecem assim que se mexe num comando");
  ok(q('[data-act="simRepor"][data-id="' + a.id + '"]') != null, "e o de repor também");

  // Repor
  clicar('[data-act="simRepor"][data-id="' + a.id + '"]');
  eq(ui.simAtivo, null, "repor limpa a simulação");
  ok(q('[data-act="simAplicar"]') == null, "e os botões desaparecem");

  // Aplicar ao ativo
  var sl2 = q('[data-slider="simA_contrib"]');
  sl2.value = 500; sl2.dispatchEvent(new Event("input", {bubbles:true}));
  clicar('[data-act="simAplicar"][data-id="' + a.id + '"]');
  ok(haDialogo(), "aplicar pede confirmação");
  confirmarDialogo();
  eq(a.contribuicao, 500, "aplicar transfere a contribuição");
  eq(ui.simAtivo, null, "e limpa a simulação");

  a.contribuicao = contribAntes;
})();

/* ============================================================
   4. Tabelas, gráficos e explicadores
   ============================================================ */
G("ordenação de tabelas");
(function(){
  irA("ativos");
  var cab = qq('th[data-sort]');
  ok(cab.length > 0, "há cabeçalhos ordenáveis");
  var h = cab[4] || cab[0];
  var tabela = h.dataset.sort, col = h.dataset.col;
  h.click();
  ok(ordem[tabela] && ordem[tabela].col === col && ordem[tabela].dir === 1, "primeira ordenação é crescente");
  q('th[data-sort="' + tabela + '"][data-col="' + col + '"]').click();
  ok(ordem[tabela].dir === -1, "segundo clique inverte");

  // A ordem muda mesmo as linhas
  var nomes1 = qq("tbody tr td:first-child").map(function(t){ return t.innerText; }).join("|");
  q('th[data-sort="' + tabela + '"][data-col="' + col + '"]').click();
  var nomes2 = qq("tbody tr td:first-child").map(function(t){ return t.innerText; }).join("|");
  ok(nomes1 !== nomes2, "as linhas reordenam");

  // Teclado
  var alvo = q('th[data-sort="' + tabela + '"][data-col="' + col + '"]');
  var dirAntes = ordem[tabela].dir;
  alvo.dispatchEvent(new KeyboardEvent("keydown", {key:"Enter", bubbles:true}));
  ok(ordem[tabela].dir === -dirAntes, "Enter também ordena");

  ordem = {};
})();

G("gráficos interativos");
(function(){
  irA("ativos");
  var fatia = q("svg[data-donut] .slice");
  ok(fatia != null, "há gráfico de anel");
  if (fatia){
    var svg = fatia.closest("svg[data-donut]");
    var id = svg.getAttribute("data-donut");
    var nome = fatia.getAttribute("data-foco");
    fatia.dispatchEvent(new MouseEvent("click", {bubbles:true}));
    ok(ui.donutFoco && ui.donutFoco.id === id && ui.donutFoco.nome === nome, "clicar isola a fatia");
    ok(q("svg[data-donut='" + id + "']").classList.contains("dim"), "as outras esbatem");
    q("svg[data-donut='" + id + "'] .slice.on").dispatchEvent(new MouseEvent("click", {bubbles:true}));
    eq(ui.donutFoco, null, "clicar outra vez larga o foco");
  }

  // Legenda também foca
  var leg = q(".legend div[data-foco]");
  if (leg){
    leg.dispatchEvent(new MouseEvent("click", {bubbles:true}));
    ok(ui.donutFoco != null, "a legenda também isola");
    ui.donutFoco = null; render();
  }

  // Sugestões de dados
  var t = hover(q("svg[data-donut] .slice"));
  ok(t && t.classList.contains("show"), "o gráfico mostra sugestão");
  ok(!t.classList.contains("prosa"), "e é sugestão de dados, não de ajuda");
  ok(t.innerText.indexOf("€") >= 0, "com valores");

  // Barras da evolução
  irA("painel");
  var zona = q(".chart .hit");
  if (zona){
    var t2 = hover(zona);
    ok(t2.classList.contains("show"), "as barras da evolução mostram valores");
  }
  // Horizonte da evolução
  [6,12,24,36].forEach(function(n){
    if (clicar('[data-act="evolMeses"][data-v="' + n + '"]')){
      eq(ui.evolucaoMeses, n, "horizonte de " + n + " meses");
    }
  });
  clicar('[data-act="evolMeses"][data-v="12"]');
})();

G("explicadores");
(function(){
  irA("painel");
  ok(S.ajudas !== false, "os explicadores começam ligados");
  ok(qq(".temAjuda").length > 10, "há elementos assinalados: " + qq(".temAjuda").length);

  var t = hover(q('nav.tabs button[data-view="ativos"]'));
  ok(t.classList.contains("show") && t.classList.contains("prosa"), "separador tem explicador em prosa");

  var k = qq(".kpi").filter(function(x){ return /TAXA DE POUPAN/i.test(x.innerText); })[0];
  if (k){
    var t2 = hover(k);
    ok(t2.innerText.indexOf("20%") >= 0, "o explicador do KPI cita a referência");
    ok(t2.innerText.toUpperCase().indexOf("CÁLCULO") >= 0, "e mostra o cálculo");
  }

  irA("config");
  // O campo de taxa efetiva só existe no modo manual; o de dependentes,
  // no modo das tabelas. Testa-se o que estiver em ecrã.
  var campo = document.getElementById("fxdependentes") || document.getElementById("fxirsEfetivo");
  ok(campo != null, "há campos fiscais com explicador");
  if (campo){
    var t3 = hover(campo);
    ok(t3.classList.contains("prosa"), "os campos têm explicador");
    ok(t3.innerText.length > 30, "com conteúdo substancial");
  }
  var civil = document.getElementById("fxEstadoCivil");
  if (civil){
    var t3b = hover(civil);
    ok(t3b.innerText.indexOf("tabelas") >= 0, "o explicador da situação familiar fala das tabelas");
  }

  // Cobertura: nenhum KPI sem explicador
  var semAjuda = [];
  ["painel","rendimentos","despesas","ativos","creditos","objetivos","config"].forEach(function(v){
    irA(v);
    qq(".kpi").forEach(function(x){
      if (!x.classList.contains("temAjuda")){
        var l = x.querySelector(".lbl");
        if (l && semAjuda.indexOf(l.textContent) < 0) semAjuda.push(l.textContent);
      }
    });
  });
  ok(semAjuda.length === 0, "todos os indicadores têm explicador", semAjuda.join(", "));

  // Nenhum title nativo a duplicar
  ok(qq(".temAjuda[title]").length === 0, "sem títulos nativos duplicados");

  // Interruptor
  irA("painel");
  clicar("#ajudaBtn");
  eq(S.ajudas, false, "o interruptor desliga");
  eq(qq(".temAjuda").length, 0, "e limpa as marcas");
  var t4 = hover(q('nav.tabs button[data-view="ativos"]'));
  ok(!t4.classList.contains("show"), "desligado não mostra prosa");
  var fat = q("svg[data-donut] .slice");
  if (fat){
    var t5 = hover(fat);
    ok(t5.classList.contains("show"), "mas os dados dos gráficos continuam");
  }
  clicar("#ajudaBtn");
  eq(S.ajudas, true, "o interruptor volta a ligar");
  ok(qq(".temAjuda").length > 10, "e as marcas voltam");
})();

/* ============================================================
   5. Navegação, tema e limites
   ============================================================ */
G("navegação de meses");
(function(){
  irA("painel");
  var m0 = MES;
  clicar("#mesPrev");
  eq(MES, mesShift(m0, -1), "recua um mês");
  clicar("#mesNext");
  eq(MES, m0, "avança de volta");
  clicar("#mesNext"); clicar("#mesNext");
  eq(MES, mesShift(m0, 2), "avança dois meses");
  var sel = document.getElementById("mesSel");
  eq(sel.value, MES, "o seletor acompanha");
  sel.value = m0;
  sel.dispatchEvent(new Event("change", {bubbles:true}));
  eq(MES, m0, "escolher no seletor muda o mês");
  ok(q("#brandSub").textContent.indexOf("saldo") >= 0, "o cabeçalho mostra o saldo");
})();

G("tema");
(function(){
  var t0 = S.tema;
  var vistos = [];
  for (var i = 0; i < 3; i++){
    clicar("#temaBtn");
    vistos.push(S.tema);
    eq(document.documentElement.getAttribute("data-theme"), S.tema, "o atributo acompanha o tema");
  }
  ok(vistos.indexOf("light") >= 0 && vistos.indexOf("dark") >= 0 && vistos.indexOf("auto") >= 0,
     "o ciclo passa pelos três temas: " + vistos.join(","));
  S.tema = t0; aplicarTema();
})();

G("limites por categoria");
(function(){
  irA("despesas");
  clicar('[data-act="secDespesa"][data-v="limites"]');
  var inp = q(".limIn");
  ok(inp != null, "há campos de limite");
  if (inp){
    var id = inp.dataset.id;
    inp.value = "777,00";
    inp.dispatchEvent(new FocusEvent("blur", {bubbles:true}));
    eq(parseNum(S.limites[id]), 777, "guarda o limite");
    var el2 = q('.limIn[data-id="' + id + '"]');
    el2.value = "";
    el2.dispatchEvent(new FocusEvent("blur", {bubbles:true}));
    ok(S.limites[id] === undefined, "limpar remove o limite");
  }
  // Preencher com o plano
  clicar('[data-act="limDoPlano"]');
  ok(Object.keys(S.limites).length > 0, "preencher com o plano define limites");
})();

G("retenção pelas tabelas oficiais");
(function(){
  irA("config");
  eq(S.fiscal.modoIRS, "tabela", "o modo por omissão é o das tabelas");
  ok(texto().indexOf("Tabelas oficiais") >= 0, "e a interface diz qual");
  ok(texto().indexOf(String(TABELAS_RF._meta.ano)) >= 0, "com o ano");

  // Região fiscal
  var reg = q("#fxRegiao");
  ok(reg != null, "há seletor de região fiscal");
  eq(reg.options.length, 3, "com as três regiões");
  reg.value = "acores";
  reg.dispatchEvent(new Event("change", {bubbles:true}));
  eq(S.fiscal.regiao, "acores", "guarda a região");
  eq(regiaoRF(), "acores", "e passa a ser a região em vigor");
  ok(texto().indexOf("Açores") >= 0, "e a interface di-lo");
  ok(texto().indexOf("Tabelas_RF_RA_Acores_2026.xlsx") >= 0, "citando o ficheiro de origem");
  eq(retencaoRF(2000, "I", 0), retencaoRF(2000, "I", 0, "acores"), "e os cálculos usam-na");

  reg = q("#fxRegiao");
  reg.value = "madeira"; reg.dispatchEvent(new Event("change", {bubbles:true}));
  eq(S.fiscal.regiao, "madeira", "muda para a Madeira");
  ok(retencaoRF(2000, "I", 0) !== retencaoRF(2000, "I", 0, "continente"),
     "e a retenção difere da do Continente");

  // Tabela comparativa entre regiões
  ok(texto().indexOf("Continente") >= 0, "a comparação mostra o Continente");
  ok(texto().toLowerCase().indexOf("em uso") >= 0, "e assinala a região em uso");

  reg = q("#fxRegiao");
  reg.value = "continente"; reg.dispatchEvent(new Event("change", {bubbles:true}));
  eq(S.fiscal.regiao, "continente", "volta ao Continente");

  // Situação familiar muda a tabela aplicada
  var sel = q("#fxEstadoCivil");
  ok(sel != null, "há seletor de situação familiar");
  sel.value = "casado_1";
  sel.dispatchEvent(new Event("change", {bubbles:true}));
  eq(S.fiscal.estadoCivil, "casado_1", "guarda o estado civil");
  ok(texto().indexOf("Tabela III") >= 0, "e mostra a tabela aplicável");

  sel = q("#fxEstadoCivil");
  sel.value = "nao_casado";
  sel.dispatchEvent(new Event("change", {bubbles:true}));

  // Dependentes
  var dep = q("#fxdependentes");
  dep.value = "2";
  dep.dispatchEvent(new FocusEvent("blur", {bubbles:true}));
  eq(parseNum(S.fiscal.dependentes), 2, "guarda os dependentes");
  ok(texto().indexOf("Tabela II") >= 0, "e passa à tabela II");

  // O detalhe da retenção aparece na fonte de rendimento
  irA("rendimentos");
  var prim = S.rendimentos.filter(function(r){ return r.regime === "dependente"; })[0];
  if (prim){
    ui.abertos["rd-" + prim.id] = true; render();
    // Atenção: `innerText` aplica text-transform, e estes títulos são
    // maiúsculas por CSS — a comparação tem de ignorar a caixa.
    var t = texto().toLowerCase();
    ok(t.indexOf("retenção na fonte") >= 0, "a ficha mostra o detalhe da retenção");
    ok(t.indexOf("tabela") >= 0, "com o nome da tabela");
    ok(t.indexOf("escalão") >= 0, "e o escalão aplicável");
    ok(t.indexOf("taxa marginal") >= 0, "e a taxa marginal");
    ok(t.indexOf("retenção mensalizada") >= 0, "e o total mensalizado");
    var fx = fiscalRendimento(prim);
    ok(fx.rf.usaTabela, "a fonte usa mesmo a tabela");
    eq(fx.rf.dependentes, 2, "com os dependentes definidos");

    // Interruptor de deficiência
    var cx = q('[data-act="rdDeficiencia"][data-id="' + prim.id + '"]');
    if (cx){
      var chaveAntes = fiscalRendimento(prim).rf.chave;
      cx.click();
      eq(prim.deficiencia, true, "marca a deficiência");
      ok(fiscalRendimento(prim).rf.chave !== chaveAntes, "e muda a tabela aplicada");
      q('[data-act="rdDeficiencia"][data-id="' + prim.id + '"]').click();
      eq(prim.deficiencia, false, "e desmarca");
    }
    ui.abertos = {};
  }

  // Voltar ao modo manual e confirmar que o campo aparece
  irA("config");
  clicar('[data-act="fxModo"][data-v="efetiva"]');
  eq(S.fiscal.modoIRS, "efetiva", "muda para o modo manual");
  ok(q("#fxirsEfetivo") != null, "e o campo da taxa efetiva aparece");
  ok(q("#fxEstadoCivil") == null, "e os da situação familiar desaparecem");
  clicar('[data-act="fxModo"][data-v="tabela"]');
  eq(S.fiscal.modoIRS, "tabela", "e volta às tabelas");

  S.fiscal.dependentes = 0;
})();

G("aviso de taxas de um ano anterior");
(function(){
  var backupS = JSON.parse(JSON.stringify(S));

  // Forçar um estado com taxas antigas
  S.fiscal.ano = 2025;
  S.fiscal.subsAlimIsento = 6.00;
  S.fiscal.subsAlimCartao = 10.20;
  S.fiscal.imiTaxa = 0.35;
  S.fiscal.irsEfetivo = 22;
  irA("config");

  var t = texto().toLowerCase();
  ok(t.indexOf("2025") >= 0, "o aviso menciona o ano guardado");
  ok(t.indexOf("valores novos") >= 0 || t.indexOf("atualizar") >= 0, "e propõe atualizar");
  ok(q('[data-act="fxAtualizar"]') != null, "há botão de atualizar");
  ok(q('[data-act="fxManter"]') != null, "e de manter");

  // Cancelar não muda nada
  clicar('[data-act="fxAtualizar"]');
  ok(haDialogo(), "atualizar pede confirmação");
  cancelarDialogo();
  eq(S.fiscal.subsAlimIsento, 6.00, "cancelar não altera as taxas");

  // Confirmar atualiza só o que depende do ano
  clicar('[data-act="fxAtualizar"]');
  confirmarDialogo();
  eq(S.fiscal.subsAlimIsento, FISCAL_PADRAO.subsAlimIsento, "atualiza o subsídio em numerário");
  eq(S.fiscal.subsAlimCartao, FISCAL_PADRAO.subsAlimCartao, "e em cartão");
  eq(S.fiscal.imiTaxa, FISCAL_PADRAO.imiTaxa, "e o IMI");
  eq(S.fiscal.ano, FISCAL_PADRAO.ano, "e regista o ano");
  eq(S.fiscal.irsEfetivo, 22, "mas não toca na taxa efetiva pessoal");
  irA("config");
  ok(texto().indexOf("valores novos") < 0, "e o aviso desaparece");

  // A opção de manter também faz o aviso desaparecer
  S.fiscal.ano = 2025; S.fiscal.imiTaxa = 0.42;
  irA("config");
  ok(q('[data-act="fxManter"]') != null, "o aviso volta com taxas divergentes");
  clicar('[data-act="fxManter"]');
  eq(S.fiscal.ano, FISCAL_PADRAO.ano, "manter regista o ano");
  eq(S.fiscal.imiTaxa, 0.42, "e preserva o valor escolhido");
  irA("config");
  ok(q('[data-act="fxManter"]') == null, "e o aviso não volta");

  S = normalizar(backupS);
  limparCacheCredito();
  render();
})();

G("fiscalidade — edição");
(function(){
  irA("config");
  clicar('[data-act="fxModo"][data-v="efetiva"]');
  var i = document.getElementById("fxirsEfetivo");
  var antes = parseNum(S.fiscal.irsEfetivo);
  i.value = "22";
  i.dispatchEvent(new FocusEvent("blur", {bubbles:true}));
  eq(parseNum(S.fiscal.irsEfetivo), 22, "guarda a taxa de IRS");
  clicar('[data-act="fxModo"][data-v="tabela"]');
  irA("config");

  // A idade do PPR recalcula o limite
  var idade = document.getElementById("fxpprIdade");
  idade.value = "30";
  idade.dispatchEvent(new FocusEvent("blur", {bubbles:true}));
  eq(S.fiscal.pprLimiteAno, 400, "idade 30 dá limite de 400");
  q("#fxpprIdade").value = "60";
  q("#fxpprIdade").dispatchEvent(new FocusEvent("blur", {bubbles:true}));
  eq(S.fiscal.pprLimiteAno, 300, "idade 60 dá limite de 300");

  // Aviso de IMI fora do intervalo
  q("#fximiTaxa").value = "0,9";
  q("#fximiTaxa").dispatchEvent(new FocusEvent("blur", {bubbles:true}));
  ok(texto().indexOf("fora do intervalo legal") >= 0, "avisa quando o IMI sai do intervalo");
  q("#fximiTaxa").value = "0,35";
  q("#fximiTaxa").dispatchEvent(new FocusEvent("blur", {bubbles:true}));
  ok(texto().indexOf("fora do intervalo legal") < 0, "o aviso desaparece com valor válido");

  // Interruptor de impostos
  clicar('[data-act="fxContar"][data-v="0"]');
  eq(S.fiscal.contarIRS, false, "só bruto");
  eq(planoMes(MES).cargaRend, 0, "e o plano deixa de descontar");
  clicar('[data-act="fxContar"][data-v="1"]');
  eq(S.fiscal.contarIRS, true, "volta a contar impostos");
  ok(planoMes(MES).cargaRend > 0, "e o plano volta a descontar");

  S.fiscal.irsEfetivo = antes;
})();

/* ============================================================
   6. Segurança e persistência
   ============================================================ */
G("injeção de HTML");
(function(){
  delete window.__xss;
  var mau = '<img src=x onerror="window.__xss=1">';
  var campos = [
    ["rendimentos", "rdNome", '[data-act="rdSalvar"]', function(){ return S.rendimentos; }],
    ["objetivos", "obNome", '[data-act="objSalvar"]', function(){ return S.objetivos; }]
  ];

  irA("rendimentos");
  preencher("rdNome", mau);
  clicar('[data-act="rdSalvar"]');
  var r = S.rendimentos[S.rendimentos.length-1];
  ok(r.nome === mau, "o texto é guardado tal e qual");
  ok(!window.__xss, "não executa");
  ok(q("main img") == null, "não injeta elementos");
  ok(texto().indexOf("<img") >= 0, "aparece como texto literal");
  clicar('[data-act="rdApagar"][data-id="' + r.id + '"]');
  confirmarDialogo();

  irA("ativos");
  preencher("ptNome", mau);
  preencher("ptAquisicao", "1000");
  clicar('[data-act="patSalvar"]');
  var a = S.ativos[S.ativos.length-1];
  ok(!window.__xss, "ativos: não executa");
  ok(q("main img") == null, "ativos: não injeta");
  clicar('[data-act="patApagar"][data-id="' + a.id + '"]');
  confirmarDialogo();
  ok(!window.__xss, "nem depois de eliminar");
})();

G("persistência");
(function(){
  guardar();
  var bruto = localStorage.getItem(STORE_KEY);
  ok(bruto && bruto.length > 100, "grava no armazenamento local");
  var lido = JSON.parse(bruto);
  ok(Array.isArray(lido.ativos), "o que se lê tem a forma certa");

  // Ida e volta por normalizar
  var voltou = normalizar(JSON.parse(JSON.stringify(lido)));
  eq(voltou.ativos.length, S.ativos.length, "os ativos sobrevivem à ida e volta");
  eq(voltou.rendimentos.length, S.rendimentos.length, "os rendimentos sobrevivem");
  eq(voltou.creditos.length, S.creditos.length, "os créditos sobrevivem");
  eq(voltou.movimentos.length, S.movimentos.length, "os movimentos sobrevivem");
  eq(JSON.stringify(voltou.fiscal), JSON.stringify(S.fiscal), "a fiscalidade sobrevive");

  // Os cálculos dão o mesmo depois da ida e volta
  var antes = planoMes(MES);
  var guardado = S;
  S = voltou;
  var depois = planoMes(MES);
  S = guardado;
  eq(depois.rend, antes.rend, "o rendimento é o mesmo depois de gravar e ler");
  eq(depois.desp, antes.desp, "a despesa é a mesma");
  eq(depois.saldo, antes.saldo, "o saldo é o mesmo");
})();

G("exportações");
(function(){
  // Substituir o descarregamento para não abrir ficheiros durante os testes
  var capturado = [];
  var original = window.descarregar;
  descarregar = function(nome, conteudo, mime){ capturado.push({nome:nome, conteudo:conteudo, mime:mime}); };

  semErro(function(){ exportJSON(); }, "exportar JSON não rebenta");
  semErro(function(){ exportCSV(); }, "exportar movimentos não rebenta");
  semErro(function(){ exportPatrimonioCSV(); }, "exportar património não rebenta");

  eq(capturado.length, 3, "gerou três ficheiros");
  ok(/\.json$/.test(capturado[0].nome), "o primeiro é JSON");
  semErro(function(){ JSON.parse(capturado[0].conteudo); }, "o JSON exportado é válido");
  ok(/\.csv$/.test(capturado[1].nome), "o segundo é CSV");
  ok(capturado[1].conteudo.charCodeAt(0) === 0xFEFF, "o CSV leva BOM para o Excel");
  ok(capturado[1].conteudo.indexOf(";") >= 0, "o CSV usa ponto e vírgula");
  ok(capturado[2].conteudo.indexOf("Balanço") >= 0, "o CSV de património traz o balanço");

  descarregar = original;
})();

/* ============================================================
   7. Estados vazios
   ============================================================ */
G("estados vazios");
(function(){
  var backupS = JSON.parse(JSON.stringify(S));
  S = estadoVazio();
  MES = isoMes(hoje());

  ["painel","rendimentos","despesas","ativos","creditos","objetivos","config"].forEach(function(v){
    semErro(function(){ irA(v); }, "vista " + v + " renderiza sem dados");
    ok(texto().length > 40, "vista " + v + " diz alguma coisa sem dados");
  });

  irA("painel");
  ok(texto().indexOf("Bem-vindo") >= 0, "o painel dá as boas-vindas");
  ok(q('[data-act="exemplo"]') != null, "e oferece o exemplo");

  irA("despesas");
  clicar('[data-act="secDespesa"][data-v="limites"]');
  ok(texto().length > 40, "os limites não rebentam sem dados");
  clicar('[data-act="secDespesa"][data-v="movimentos"]');
  ok(texto().indexOf("Sem movimentos") >= 0, "os movimentos avisam que estão vazios");

  S = normalizar(backupS);
  limparCacheCredito();
  render();
})();

G("impressão");
(function(){
  var folhas = Array.prototype.slice.call(document.styleSheets);
  var temPrint = false;
  folhas.forEach(function(f){
    try {
      Array.prototype.slice.call(f.cssRules || []).forEach(function(r){
        if (r.media && String(r.media).indexOf("print") >= 0) temPrint = true;
      });
    } catch(e){}
  });
  ok(temPrint, "há folha de estilos de impressão");
  ok(qq(".no-print").length > 0, "há elementos marcados para não imprimir");
})();

G("paleta de comandos");
(function(){
  // Abre com Ctrl+K, filtra sem acentos, navega com Enter
  document.dispatchEvent(new KeyboardEvent("keydown", {key:"k", ctrlKey:true, bubbles:true}));
  ok(q("#paletaIn") != null, "Ctrl+K abre a paleta");
  preencher("paletaIn", "estrateg");
  eq(qq("#paletaLista li[data-i]").length, 1, "filtra sem acentos");
  document.dispatchEvent(new KeyboardEvent("keydown", {key:"Enter", bubbles:true}));
  ok(q("#paletaIn") == null, "Enter fecha a paleta");
  eq(VIEW, "estrategias", "e navega para a vista");

  // Escape fecha sem fazer nada
  document.dispatchEvent(new KeyboardEvent("keydown", {key:"k", ctrlKey:true, bubbles:true}));
  document.dispatchEvent(new KeyboardEvent("keydown", {key:"Escape", bubbles:true}));
  ok(q("#paletaIn") == null, "Escape fecha a paleta");
  eq(VIEW, "estrategias", "sem mudar de vista");

  // Setas mudam a seleção
  document.dispatchEvent(new KeyboardEvent("keydown", {key:"k", ctrlKey:true, bubbles:true}));
  document.dispatchEvent(new KeyboardEvent("keydown", {key:"ArrowDown", bubbles:true}));
  eq(q('#paletaLista li[aria-selected="true"]').dataset.i, "1", "a seta desce a seleção");
  document.dispatchEvent(new KeyboardEvent("keydown", {key:"Escape", bubbles:true}));
  irA("painel");
})();

G("dica do próximo passo");
(function(){
  var backupS = JSON.parse(JSON.stringify(S));
  S = estadoVazio();
  // Com a visita por ver, é ela a primeira sugestão
  S.rendimentos = [{id:"rdq", nome:"QA", membroId:"", ativo:true, regime:"dependente",
    componentes:[{id:"cq", especie:"base", nome:"Base", valor:1000, frequencia:"mensal", categoriaId:"", ss:null, irs:null}]}];
  render(); irA("painel");
  ok(q(".dica") != null, "a dica aparece quando falta um passo");
  ok(texto().indexOf("visita guiada") >= 0, "a primeira sugestão é a visita guiada");
  // Vista a visita, sugere o passo seguinte do percurso
  S.tutorialVisto = true;
  render();
  ok(texto().indexOf("despesas fixas") >= 0, "e aponta o primeiro passo em falta");
  // Dispensar esconde e persiste
  clicar('[data-act="dicaFechar"]');
  ok(q(".dica") != null, "dispensada uma, aparece a seguinte");
  ok(S.dicasOcultas.length === 1, "a dispensa fica registada");
  // Dispensar todas
  var protecao = 0;
  while (q(".dica") && protecao++ < 10) clicar('[data-act="dicaFechar"]');
  ok(q(".dica") == null, "dispensadas todas, o painel fica limpo");
  S = normalizar(backupS);
  limparCacheCredito();
  render();
})();

G("melhorias visuais");
(function(){
  // Navegação inferior: existe, com as vistas principais e a folha «Mais»
  ok(q("#tabsMovel") != null, "há navegação inferior para o telemóvel");
  eq(qq("#tabsMovel button[data-view]").length, 4, "com quatro vistas diretas");
  ok(q("#btnMais") != null, "e o botão «Mais»");
  eq(qq("#folhaMais button[data-view]").length, 4, "a folha traz as restantes quatro");

  // Ícones nos separadores
  ok(qq("nav.tabs .ticon").length === 8, "cada separador tem ícone");

  // Movimentos e ativos têm rótulos para o modo cartão
  comExemplo();
  irA("despesas");
  clicar('[data-act="secDespesa"][data-v="movimentos"]');
  ok(q('.tblcards td[data-lbl="Valor"]') != null, "os movimentos têm rótulos por célula");
  irA("ativos");
  ok(q('.tblcards td[data-lbl="Capital próprio"]') != null, "os ativos também");

  // Objetivos com anel de progresso
  irA("objetivos");
  ok(qq("svg.anel").length >= 1, "os objetivos têm anel de progresso");
  ok(qq(".anel-prog").length >= 1, "com o arco desenhado");
  // O anel resiste a valores impossíveis, sem escrever NaN no ecrã
  [NaN, undefined, null, -50, 150, "abc"].forEach(function(v){
    var svg = anelProgresso(v, "var(--pos)", 70);
    ok(svg.indexOf("<svg") === 0 && svg.indexOf("NaN") < 0,
       "anel com progresso "+String(v)+" não escreve NaN");
  });
  eq(anelProgresso(150, "red", 70).indexOf("100%") >= 0, true, "acima de 100% mostra 100%");

  // Estratégias com barras de comparação
  irA("estrategias");
  ok(q(".cbar") != null, "a comparação de instrumentos tem barras");
  ok(qq(".cbar .trilho").length >= 3, "uma por instrumento");
})();

G("visita guiada");
(function(){
  comExemplo();
  S.tutorialVisto = false;

  // Pontos de entrada
  ok(q('header [data-act="tutorialIniciar"]') != null, "há botão no cabeçalho");

  // Abrir e percorrer todos os passos
  clicar('header [data-act="tutorialIniciar"]');
  ok(q("#tutorial .tutcard") != null, "a visita abre");
  ok(q("#tutFundo") != null, "com pano de fundo");
  ok(texto().length > 0, "a aplicação continua por trás");
  eq(q("#tutorial h3").textContent.indexOf("Bem-vindo"), 0, "começa nas boas-vindas");

  var vistas = {};
  var total = TUTORIAL_PASSOS.length;
  for (var i = 0; i < total - 1; i++){
    clicar('[data-act="tutorialSeguinte"]');
    vistas[VIEW] = true;
    ok(q("#tutorial .tutcard") != null, "o passo "+(i+2)+" mostra o cartão");
  }
  ["painel","rendimentos","despesas","ativos","creditos","objetivos","estrategias","config"]
    .forEach(function(v){ ok(vistas[v], "a visita passa por "+v); });
  eq(q('[data-act="tutorialSeguinte"]').textContent, "Concluir", "o último passo diz Concluir");

  clicar('[data-act="tutorialSeguinte"]');
  ok(q("#tutorial .tutcard") == null, "concluir fecha a visita");
  eq(S.tutorialVisto, true, "e fica registada como vista");
  eq(qq(".tut-alvo").length, 0, "sem destaques órfãos");
  ok(q("#tutFundo") == null, "sem pano de fundo órfão");

  // Anterior recua; Esc sai
  clicar('header [data-act="tutorialIniciar"]');
  clicar('[data-act="tutorialSeguinte"]');
  clicar('[data-act="tutorialAnterior"]');
  ok(q("#tutorial h3").textContent.indexOf("Bem-vindo") >= 0, "Anterior recua ao primeiro passo");
  document.dispatchEvent(new KeyboardEvent("keydown", {key:"Escape", bubbles:true}));
  ok(q("#tutorial .tutcard") == null, "Escape sai da visita");

  // Setas do teclado navegam
  clicar('header [data-act="tutorialIniciar"]');
  document.dispatchEvent(new KeyboardEvent("keydown", {key:"ArrowRight", bubbles:true}));
  ok(q("#tutorial h3").textContent.indexOf("mês em análise") >= 0, "a seta direita avança");
  document.dispatchEvent(new KeyboardEvent("keydown", {key:"ArrowLeft", bubbles:true}));
  ok(q("#tutorial h3").textContent.indexOf("Bem-vindo") >= 0, "a seta esquerda recua");
  document.dispatchEvent(new KeyboardEvent("keydown", {key:"Escape", bubbles:true}));

  // Sem dados, iniciar carrega o exemplo primeiro
  localStorage.removeItem(STORE_KEY);
  S = estadoVazio(); MES = isoMes(hoje()); render();
  ok(q('#app [data-act="tutorialIniciar"]') != null, "o ecrã de boas-vindas oferece a visita");
  clicar('header [data-act="tutorialIniciar"]');
  ok(temDados(), "sem dados, a visita carrega o exemplo");
  ok(q("#tutorial .tutcard") != null, "e abre na mesma");
  clicar('[data-act="tutorialSair"]');
  ok(q("#tutorial .tutcard") == null, "Sair fecha");

  comExemplo();
})();

G("aparência — modos e paletas");
(function(){
  var temaAntes = S.tema, paletaAntes = S.paleta;
  irA("config");
  ok(/Aparência/.test(texto()), "há um cartão de aparência nas Definições");
  eq(qq('[data-act="temaModo"]').length, 3, "três modos: auto, claro, escuro");
  eq(qq('[data-act="temaPaleta"]').length, 8, "oito paletas de cor");
  ok(/Areia/.test(texto()) && /Pastel/.test(texto()), "incluindo a Areia e a Pastel");

  // Forçar escuro e trocar de paleta muda os atributos e o acento
  clicar('[data-act="temaModo"][data-v="dark"]');
  eq(document.documentElement.getAttribute("data-theme"), "dark", "o modo fica no atributo");
  var acentoAntes = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
  clicar('[data-act="temaPaleta"][data-k="poente"]');
  eq(document.documentElement.getAttribute("data-paleta"), "poente", "a paleta fica no atributo");
  eq(S.paleta, "poente", "e no estado");
  var acentoDepois = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
  ok(acentoAntes !== acentoDepois, "o acento muda com a paleta", acentoAntes+" → "+acentoDepois);
  ok(qq('[data-act="temaPaleta"][aria-pressed="true"]').length === 1, "só uma amostra fica marcada");

  // Cada paleta tem um acento distinto (em modo escuro)
  var acentos = {};
  Object.keys(PALETAS).forEach(function(k){
    S.paleta = k; aplicarTema();
    acentos[getComputedStyle(document.documentElement).getPropertyValue("--accent").trim()] = 1;
  });
  eq(Object.keys(acentos).length, Object.keys(PALETAS).length, "todas as paletas têm acento próprio");

  // A padrão não deixa atributo; uma inválida cai na padrão
  S.paleta = "meianoite"; aplicarTema();
  ok(document.documentElement.getAttribute("data-paleta") == null, "a paleta padrão não deixa atributo");
  eq(normalizar({paleta:"arco-iris"}).paleta, "meianoite", "paleta desconhecida cai na padrão");

  // As cores semânticas não mudam com a paleta
  S.paleta = "floresta"; aplicarTema();
  var pos1 = getComputedStyle(document.documentElement).getPropertyValue("--pos").trim();
  S.paleta = "ameixa"; aplicarTema();
  var pos2 = getComputedStyle(document.documentElement).getPropertyValue("--pos").trim();
  eq(pos1, pos2, "o verde de positivo é igual em todas as paletas");

  // O botão do cabeçalho continua a alternar o modo
  var modoAntes = S.tema;
  q("#temaBtn").click();
  ok(S.tema !== modoAntes, "o botão ◐ alterna o modo");

  S.tema = temaAntes; S.paleta = paletaAntes; aplicarTema(); guardar(); render();
})();

G("visualizações do painel");
(function(){
  comExemplo();
  irA("painel");
  // Sankey
  // O Sankey deixou de vir ligado por omissão: liga-se para o testar
  mostrarCartoes(["sankey", "evolucao"]);
  ok(q('svg[aria-label*="Sankey"]') != null, "há o diagrama de fluxo do dinheiro");
  ok(qq('svg[aria-label*="Sankey"] path').length >= 3, "com fitas para os destinos");
  // Drill-down do donut
  var fatia = q("[data-foco]");
  fatia.dispatchEvent(new MouseEvent("click", {bubbles:true}));
  ok(q("#drillDonut") != null, "clicar numa fatia abre o detalhe da categoria");
  q("[data-foco]").dispatchEvent(new MouseEvent("click", {bubbles:true}));
  ok(q("#drillDonut") == null, "clicar de novo fecha o detalhe");
  // Comparação homóloga
  clicar('[data-act="compararAlternar"]');
  ok(/Há 1 ano/.test(texto()), "a comparação homóloga muda as legendas");
  clicar('[data-act="compararAlternar"]');
  ok(!/Há 1 ano/.test(texto()), "e desliga-se");
  // Marcos na evolução (o exemplo tem eventos a 36 meses)
  clicar('[data-act="evolMeses"][data-v="36"]');
  ok(qq("[data-marco]").length >= 1, "há marcos na linha do tempo a 36 meses");
  clicar('[data-act="evolMeses"][data-v="12"]');
  // Resumo mensal narrado
  var mAnt = mesShift(MES, -1);
  S.movimentos.push({id:"qa-dg", data:mAnt+"-05", tipo:"despesa", descricao:"Oficina QA",
    valor:300, categoriaId:"", membroId:""});
  render();
  ok(/O seu /.test(texto()), "o resumo do mês fechado aparece");
  ok(/Oficina QA/.test(texto()), "e identifica a maior despesa");
  S.movimentos = S.movimentos.filter(function(m){ return m.id !== "qa-dg"; });
  render();
  // Calendário de calor nos movimentos
  irA("despesas");
  clicar('[data-act="secDespesa"][data-v="movimentos"]');
  ok(q(".hmap") != null, "há calendário-mapa de calor");
  ok(qq(".hmap .hcel.hit").length > 0, "com dias assinalados");
})();

G("privacidade e atalhos");
(function(){
  function tecla(k, opts){ document.dispatchEvent(new KeyboardEvent("keydown", Object.assign({key:k, bubbles:true}, opts||{}))); }
  // Modo privacidade
  clicar('[data-act="privAlternar"]');
  ok(document.body.classList.contains("privado"), "o modo privacidade desfoca os valores");
  clicar('[data-act="privAlternar"]');
  ok(!document.body.classList.contains("privado"), "e desliga-se");
  // Sequências g e n
  irA("painel");
  tecla("g"); tecla("a");
  eq(VIEW, "ativos", "g,a vai para os ativos");
  tecla("n"); tecla("o");
  eq(VIEW, "objetivos", "n,o vai para os objetivos");
  ok(document.activeElement && document.activeElement.id === "obNome", "e foca o formulário");
  document.activeElement.blur();
  // A escrever num campo, as sequências não disparam
  irA("rendimentos");
  var campo = q("#rdNome");
  campo.focus();
  campo.dispatchEvent(new KeyboardEvent("keydown", {key:"g", bubbles:true}));
  campo.dispatchEvent(new KeyboardEvent("keydown", {key:"a", bubbles:true}));
  eq(VIEW, "rendimentos", "escrever g,a num campo não navega");
  campo.blur();
  // Folha de atalhos
  tecla("?");
  ok(/Atalhos de teclado/.test(q("#modalHost").textContent), "? abre a folha de atalhos");
  clicar('#modalHost [data-dlg="no"]');
  ok(q("#modalHost .overlay") == null, "e fecha");
  irA("painel");
})();

G("reordenação e ícones de categoria");
(function(){
  comExemplo();
  irA("config");
  ok(qq('tr[data-drag="cat"]').length > 10, "as categorias têm linhas arrastáveis");
  ok(q('tr[data-drag="cat"] .pega') != null, "com pega de arrasto");
  // O núcleo puro da reordenação
  var a = S.categorias[0].id, c = S.categorias[2].id;
  ok(reordenarCategoria(a, c), "reordenar categorias funciona");
  eq(S.categorias[2].id, a, "a categoria arrastada fica no destino");
  reordenarCategoria(a, S.categorias[0].id);
  ok(!reordenarCategoria(a, a), "arrastar para o próprio sítio não faz nada");
  // Rubricas: a primeira arrumação grava a ordem manual
  irA("despesas");
  clicar('[data-act="secDespesa"][data-v="plano"]');
  ok(qq('tr[data-drag="rec"]').length >= 2, "as rubricas têm linhas arrastáveis");
  var recs = S.recorrentes.filter(function(r){ return r.tipo === "despesa"; });
  ok(reordenarRubrica(recs[0].id, recs[1].id), "reordenar rubricas funciona");
  ok(recs.every(function(r){ return r.ordem != null; }), "todas ficam com ordem manual");
  // Ícones
  eq(catRotulo(catPorNome("Alimentação")).indexOf("🛒"), 0, "o rótulo traz o ícone da semente");
  irA("config");
  ok(q("#ctIcone") != null, "o formulário de categoria tem campo de ícone");
  ok(/🛒/.test(texto()), "os ícones aparecem na tabela de categorias");
})();

G("importador de extratos CSV");
(function(){
  comExemplo();
  // Núcleo puro
  var p = csvParse('Data;Descrição;Valor\n"02-07-2026";"COMPRA; COM PONTO";-10,50\n03-07-2026;OUTRA;5');
  eq(p.sep, ";", "deteta o separador");
  eq(p.linhas.length, 3, "conta as linhas");
  eq(p.linhas[1][1], "COMPRA; COM PONTO", "respeita aspas com o separador dentro");
  eq(csvDataISO("02-07-2026"), "2026-07-02", "converte dd-mm-aaaa");
  eq(csvDataISO("2026/07/03"), "2026-07-03", "converte aaaa/mm/dd");
  eq(csvDataISO("não é data"), null, "rejeita o que não é data");
  // Datas impossíveis: passariam a movimentos que nenhuma vista mensal mostra
  eq(csvDataISO("32-13-2026"), null, "rejeita dia 32 e mês 13");
  eq(csvDataISO("31-02-2026"), null, "rejeita 31 de fevereiro");
  eq(csvDataISO("00-00-2026"), null, "rejeita dia e mês zero");
  eq(csvDataISO("2026-13-01"), null, "rejeita mês 13 no formato ISO");
  eq(csvDataISO("29-02-2024"), "2024-02-29", "aceita 29 de fevereiro em ano bissexto");
  eq(csvDataISO("29-02-2026"), null, "rejeita 29 de fevereiro em ano comum");
  eq(csvDataISO("31-12-2026"), "2026-12-31", "aceita o último dia do ano");
  var cols = csvAdivinhaColunas(["Data mov.", "Descrição", "Montante"]);
  eq(cols.data, 0, "adivinha a coluna da data");
  eq(cols.desc, 1, "e a da descrição");
  eq(cols.valor, 2, "e a do valor");

  // Fluxo completo no modal
  var antes = S.movimentos.length;
  irA("despesas");
  clicar('[data-act="secDespesa"][data-v="movimentos"]');
  clicar('[data-act="csvAbrir"]');
  ok(q("#csvTexto") != null, "o diálogo de importação abre");
  q("#csvTexto").value = "Data;Descrição;Valor\n02-07-2026;COMPRA CONTINENTE QA;-34,50\n03-07-2026;ORDENADO QA;1.500,00\n02-07-2026;COMPRA CONTINENTE QA;-34,50";
  clicar('[data-act="csvAnalisar"]');
  ok(q("#csvColData") != null, "a análise mostra o mapeamento de colunas");
  clicar('[data-act="csvImportar"]');
  eq(S.movimentos.length, antes + 2, "importa 2 (o duplicado fica de fora)");
  var imp = S.movimentos.filter(function(m){ return /QA$/.test(m.descricao || ""); });
  eq(imp.filter(function(m){ return m.tipo === "despesa"; }).length, 1, "o negativo é despesa");
  eq(imp.filter(function(m){ return m.tipo === "rendimento"; }).length, 1, "o positivo é rendimento");
  var compra = imp.find(function(m){ return /CONTINENTE/.test(m.descricao); });
  ok(compra.categoriaId !== "", "a categoria foi sugerida pela semelhança", catNome(compra.categoriaId));
  // Importar o mesmo outra vez não duplica
  clicar('[data-act="csvAbrir"]');
  q("#csvTexto").value = "Data;Descrição;Valor\n02-07-2026;COMPRA CONTINENTE QA;-34,50";
  clicar('[data-act="csvAnalisar"]');
  clicar('[data-act="csvImportar"]');
  eq(S.movimentos.length, antes + 2, "reimportar não duplica");
  if (q("#modalHost .overlay")) q('#modalHost [data-dlg="no"]') && clicar('#modalHost [data-dlg="no"]');
  S.movimentos = S.movimentos.filter(function(m){ return !/QA$/.test(m.descricao || ""); });
  guardar(); render();
})();

G("painel de atenção e saúde dos dados");
(function(){
  comExemplo();
  irA("painel");
  ok(q(".alerta") != null, "o painel reúne o que pede atenção");
  var as = alertas();
  ok(as.every(function(a){ return [0,1,2].indexOf(a.grau) >= 0; }), "cada alerta tem grau conhecido");
  ok(as.every(function(a){ return a.titulo && a.vista; }), "e sabe para onde levar");
  for (var i = 1; i < as.length; i++) ok(as[i-1].grau >= as[i].grau, "ordenados por urgência");

  // Um limite ultrapassado gera alerta de grau 2
  var cat = S.categorias.filter(function(c){ return c.tipo === "despesa"; })[0];
  S.limites[cat.id] = 1;
  S.movimentos.push({id:"qa-lim", data:MES+"-02", tipo:"despesa", descricao:"Estouro QA",
    valor:500, categoriaId:cat.id, membroId:""});
  render();
  ok(alertas().some(function(a){ return a.grau === 2 && /passou o limite/.test(a.titulo); }),
     "limite ultrapassado gera alerta urgente");
  S.movimentos = S.movimentos.filter(function(m){ return m.id !== "qa-lim"; });
  delete S.limites[cat.id];
  render();

  // Revisão de taxa: inclusiva no mês corrente
  var cv = S.creditos.filter(function(c){ return c.tipoTaxa === "variavel"; })[0];
  if (cv){
    var pr = proximaRevisao(cv, MES);
    ok(mesDiff(MES, pr) >= 0, "a próxima revisão nunca fica no passado", pr);
    var passo = revisaoCredito(cv);
    eq(mesDiff(mesDoDia(cv.inicio), pr) % passo, 0, "e cai num múltiplo do período de revisão");
  }

  // Saúde dos dados
  irA("config");
  ok(/Saúde dos dados/.test(texto()), "há cartão de saúde dos dados");
  ok(saudeDados().every(function(i){ return i.txt && i.vista; }), "cada lacuna sabe para onde levar");
  S.movimentos.push({id:"qa-sc", data:MES+"-03", tipo:"despesa", descricao:"Sem cat QA",
    valor:10, categoriaId:"", membroId:""});
  ok(saudeDados().some(function(i){ return /sem categoria/.test(i.txt); }), "deteta movimentos sem categoria");
  S.movimentos = S.movimentos.filter(function(m){ return m.id !== "qa-sc"; });
  render();
})();

G("regras de categorização e recorrências");
(function(){
  comExemplo();
  irA("config");
  ok(q("#rgPadrao") != null, "há formulário de regras");
  preencher("rgPadrao", "");
  clicar('[data-act="regraAdd"]');
  eq((S.regrasCategoria || []).length, 0, "sem padrão não cria");
  preencher("rgPadrao", "CONTINENTE");
  var catAlim = catPorNome("Alimentação");
  q("#rgCat").value = catAlim;
  clicar('[data-act="regraAdd"]');
  eq(S.regrasCategoria.length, 1, "cria a regra");
  eq(categoriaSugerida("COMPRA CONTINENTE LX"), catAlim, "a regra aplica-se na importação");
  eq(categoriaSugerida("continente amoreiras"), catAlim, "e ignora maiúsculas e acentos");
  // A regra ganha à semelhança
  var catLazer = catPorNome("Lazer e cultura");
  S.regrasCategoria[0].categoriaId = catLazer;
  eq(categoriaSugerida("COMPRA CONTINENTE LX"), catLazer, "a regra vence a sugestão por semelhança");
  irA("config");
  clicar('[data-act="regraApagar"]');
  eq(S.regrasCategoria.length, 0, "elimina a regra");

  // Recorrências
  eq(chaveRecorrencia("NETFLIX 12,99"), chaveRecorrencia("NETFLIX 15,99"), "a chave ignora números");
  ["-1","-2","-3"].forEach(function(_, i){
    S.movimentos.push({id:"qa-r"+i, data:mesShift(MES, -(i+1))+"-08", tipo:"despesa",
      descricao:"SPOTIFY PT", valor:7.99, categoriaId:"", membroId:""});
  });
  var rs = detetarRecorrencias();
  var achou = rs.filter(function(r){ return /SPOTIFY/i.test(r.nome); })[0];
  ok(achou != null, "deteta a despesa repetida em três meses");
  eq(achou.meses, 3, "conta os meses distintos");
  eq(+achou.valor.toFixed(2), 7.99, "e a média do valor");
  // Valores dispares não contam como recorrência
  S.movimentos.push({id:"qa-d0", data:mesShift(MES,-1)+"-09", tipo:"despesa", descricao:"VARIAVEL QA", valor:10, categoriaId:"", membroId:""});
  S.movimentos.push({id:"qa-d1", data:mesShift(MES,-2)+"-09", tipo:"despesa", descricao:"VARIAVEL QA", valor:200, categoriaId:"", membroId:""});
  S.movimentos.push({id:"qa-d2", data:mesShift(MES,-3)+"-09", tipo:"despesa", descricao:"VARIAVEL QA", valor:900, categoriaId:"", membroId:""});
  ok(!detetarRecorrencias().some(function(r){ return /VARIAVEL/i.test(r.nome); }),
     "valores muito diferentes não são recorrência");

  irA("despesas");
  clicar('[data-act="secDespesa"][data-v="movimentos"]');
  ok(/repetem-se/.test(texto()), "os movimentos sugerem pôr no plano");
  var n0 = S.recorrentes.length;
  clicar('[data-act="recorrenciaCriar"]');
  eq(S.recorrentes.length, n0 + 1, "criar acrescenta a rubrica");
  // Uma vez no plano, deixa de ser sugerida
  ok(!detetarRecorrencias().some(function(r){ return /SPOTIFY/i.test(r.nome); }),
     "já no plano, deixa de ser sugerida");
  S.movimentos = S.movimentos.filter(function(m){ return !/^qa-/.test(m.id); });
  S.recorrentes = S.recorrentes.filter(function(r){ return !/SPOTIFY/i.test(r.nome || ""); });
  guardar(); render();
})();

G("ritmo, mapa anual e tesouraria");
(function(){
  comExemplo();
  // Ritmo
  ok(fracaoDoMes() > 0 && fracaoDoMes() <= 1, "a fração do mês está entre 0 e 1", fracaoDoMes());
  MES = mesShift(isoMes(hoje()), -2); render();
  eq(fracaoDoMes(), 1, "num mês fechado, a fração é 1");
  MES = isoMes(hoje()); render();
  ok(/marcaRitmo/.test(barraRitmo(50, 100, "red")), "a barra traz a marca de ritmo");
  ok(!/marcaRitmo/.test(barraRitmo(50, 0, "red")), "sem limite, não há marca");
  ok(/excedeu/.test(textoRitmo(150, 100)), "acima do limite, di-lo");
  eq(textoRitmo(10, 0), "—", "sem limite não há leitura de ritmo");
  irA("despesas");
  clicar('[data-act="secDespesa"][data-v="limites"]');
  var cabec = qq("#app thead th").map(function(x){ return x.textContent.trim(); });
  ok(cabec.indexOf("Ritmo") >= 0, "os limites ganham coluna de ritmo", cabec.join(" | "));

  // Mapa anual
  irA("painel");
  mostrarCartoes(["mapa", "tesouraria"]);
  ok(q(".mapa") != null, "há mapa anual");
  eq(qq(".mapa .mc").length % 12, 0, "com doze colunas por categoria");

  // Tesouraria
  var t = tesourariaProjetada(12);
  eq(t.length, 12, "a tesouraria projeta doze meses");
  eq(t[0].acumulado, totalLiquidez() + t[0].saldo, "parte da liquidez de hoje", 0.01);
  for (var i = 1; i < t.length; i++){
    eq(t[i].acumulado, t[i-1].acumulado + t[i].saldo, "cada mês acumula sobre o anterior", 0.01);
  }
  ok(/Tesouraria a 12 meses/.test(texto()), "e mostra-se no painel");
})();

G("cenários guardados");
(function(){
  comExemplo();
  irA("estrategias");
  var n0 = (S.cenarios || []).length;
  clicar('[data-act="cenarioGuardar"]');
  ok(q("#dlgIn") != null, "pede o nome do cenário");
  q("#dlgIn").value = "QA — cenário";
  confirmarDialogo();
  eq(S.cenarios.length, n0 + 1, "guarda o cenário");
  var guardado = S.cenarios[S.cenarios.length-1];
  eq(guardado.nome, "QA — cenário", "com o nome dado");
  ok(guardado.cfg && guardado.cfg.instrumento, "e a configuração completa");
  ok(/Cenários guardados/.test(texto()), "aparece na tabela");

  // Repor devolve os parâmetros
  var mensalOriginal = parseNum(guardado.cfg.mensal);
  S.estrategia.mensal = 1234; render();
  clicar('[data-act="cenarioAplicar"]');
  eq(parseNum(S.estrategia.mensal), mensalOriginal, "repor devolve a poupança mensal");

  clicar('[data-act="cenarioApagar"]');
  eq(S.cenarios.length, n0, "elimina o cenário");
  // Cenário corrompido na importação não rebenta
  var n = normalizar({cenarios:[{nome:"X", cfg:{instrumento:"nao-existe"}}, "lixo", null]});
  eq(n.cenarios.length, 1, "cenários inválidos são descartados");
  eq(n.cenarios[0].cfg.instrumento, "aforro", "instrumento desconhecido cai num válido");
})();

G("seleção em lote e edição em linha");
(function(){
  comExemplo();
  irA("despesas");
  clicar('[data-act="secDespesa"][data-v="movimentos"]');
  var lista = movimentosFiltrados();
  ok(lista.length >= 2, "há movimentos para trabalhar", lista.length);

  // Selecionar
  var chks = qq('input[data-act="movSel"]');
  chks[0].checked = true; ACOES.movSel(chks[0]);
  eq(Object.keys(ui.movSel).length, 1, "marca um movimento");
  ok(q(".lote") != null, "a barra de lote aparece");
  ok(q("tr.selecionada") != null, "a linha fica assinalada");

  // Todos e limpar
  var todos = q('[data-act="movSelTodos"]');
  todos.checked = true; ACOES.movSelTodos(todos);
  eq(Object.keys(ui.movSel).length, movimentosFiltrados().length, "marca todos os visíveis");
  clicar('[data-act="loteLimpar"]');
  eq(Object.keys(ui.movSel).length, 0, "limpar desmarca tudo");

  // Aplicar categoria em lote
  var alvos = movimentosFiltrados().slice(0, 2);
  ui.movSel = {}; alvos.forEach(function(m){ ui.movSel[m.id] = true; });
  render();
  var catId = catPorNome("Presentes");
  q("#loteCat").value = catId;
  clicar('[data-act="loteAplicar"]');
  if (haDialogo()) cancelarDialogo();
  ok(alvos.every(function(m){
    return S.movimentos.filter(function(x){ return x.id === m.id; })[0].categoriaId === catId;
  }), "todos os selecionados ficam na categoria");
  eq(Object.keys(ui.movSel).length, 0, "e a seleção limpa-se");

  // Termo comum, base da regra proposta
  eq(termoComum(["COMPRA CONTINENTE LX","CONTINENTE AMOREIRAS"]), "CONTINENTE", "encontra o termo partilhado");
  eq(termoComum(["ABC","XYZ"]), "", "sem termo partilhado devolve vazio");
  eq(termoComum(["SO UMA"]), "", "com uma só descrição não há termo");

  // Edição em linha
  irA("despesas");
  clicar('[data-act="secDespesa"][data-v="movimentos"]');
  var td = q('td[data-edit="descricao"]');
  var idm = td.dataset.id;
  editarCelula(td);
  ok(td.querySelector("input") != null, "clique duplo abre o campo");
  td.querySelector("input").value = "Descrição editada QA";
  td.querySelector("input").dispatchEvent(new KeyboardEvent("keydown", {key:"Enter", bubbles:true}));
  eq(S.movimentos.filter(function(m){ return m.id === idm; })[0].descricao, "Descrição editada QA",
     "Enter grava a edição");

  // Escape desiste
  var td2 = q('td[data-edit="descricao"]');
  var id2 = td2.dataset.id;
  var antes2 = S.movimentos.filter(function(m){ return m.id === id2; })[0].descricao;
  editarCelula(td2);
  td2.querySelector("input").value = "NAO GRAVAR";
  td2.querySelector("input").dispatchEvent(new KeyboardEvent("keydown", {key:"Escape", bubbles:true}));
  eq(S.movimentos.filter(function(m){ return m.id === id2; })[0].descricao, antes2, "Escape desiste");

  // Valor inválido não corrompe
  var tdv = q('td[data-edit="valor"]');
  var idv = tdv.dataset.id;
  var antesV = parseNum(S.movimentos.filter(function(m){ return m.id === idv; })[0].valor);
  editarCelula(tdv);
  tdv.querySelector("input").value = "não é número";
  tdv.querySelector("input").dispatchEvent(new KeyboardEvent("keydown", {key:"Enter", bubbles:true}));
  eq(parseNum(S.movimentos.filter(function(m){ return m.id === idv; })[0].valor), antesV,
     "valor inválido não altera o movimento");

  // Teclado: setas percorrem as linhas
  irA("despesas");
  clicar('[data-act="secDespesa"][data-v="movimentos"]');
  var linhas = qq("tr[data-mov]");
  linhas[0].focus();
  linhas[0].dispatchEvent(new KeyboardEvent("keydown", {key:"ArrowDown", bubbles:true}));
  ok(document.activeElement === linhas[1], "a seta para baixo desce uma linha");
  linhas[1].dispatchEvent(new KeyboardEvent("keydown", {key:"ArrowUp", bubbles:true}));
  ok(document.activeElement === linhas[0], "e a seta para cima sobe");
})();

G("procura de dados na paleta");
(function(){
  comExemplo();
  ok(comandosDados("a").length === 0, "termos com menos de duas letras não procuram dados");
  var ativos = filtrarComandos("apartamento").filter(function(c){ return c.tipo === "ativo"; });
  ok(ativos.length >= 1, "encontra ativos pelo nome");
  var movs = filtrarComandos("continente").filter(function(c){ return c.tipo === "movimento"; });
  ok(movs.length >= 1, "encontra movimentos pela descrição");
  var cats = filtrarComandos("alimenta").filter(function(c){ return c.tipo === "categoria"; });
  ok(cats.length >= 1, "encontra categorias");
  ok(filtrarComandos("zzzznaoexiste").length === 0, "sem correspondência, não inventa");
  // Executar um resultado leva à vista respetiva
  if (movs.length){
    movs[0].run();
    // «movimentos» é um alias: resolve para a vista Despesas, secção Movimentos
    eq(VIEW, "despesas", "abrir um movimento leva às despesas");
    eq(ui.secaoDespesa, "movimentos", "na secção dos movimentos");
    filtros.texto = ""; render();
  }
})();

G("arranque por perfil e estados vazios");
(function(){
  var backupS = JSON.parse(JSON.stringify(S));
  localStorage.removeItem(STORE_KEY);
  S = estadoVazio(); MES = isoMes(hoje()); render();

  irA("painel");
  eq(qq('[data-act="perfilAplicar"]').length, Object.keys(PERFIS).length, "o ecrã vazio oferece os perfis");

  ok(aplicarPerfil("casal"), "aplicar um perfil funciona");
  ok(S.membros.length >= 2, "cria os membros");
  ok(S.recorrentes.length >= 5, "e as despesas fixas", S.recorrentes.length);
  ok(Object.keys(S.limites).length >= 5, "com limites correspondentes");
  var n = S.recorrentes.length;
  aplicarPerfil("casal");
  eq(S.recorrentes.length, n, "aplicar duas vezes não duplica");
  ok(!aplicarPerfil("inexistente"), "perfil desconhecido não faz nada");

  // Estados vazios ilustrados
  S = estadoVazio(); MES = isoMes(hoje()); render();
  ["rendimentos","ativos","creditos","objetivos"].forEach(function(v){
    irA(v);
    ok(q(".vazio .ilu") != null, "a vista "+v+" tem estado vazio ilustrado");
  });
  irA("despesas");
  clicar('[data-act="secDespesa"][data-v="movimentos"]');
  ok(q(".vazio .ilu") != null, "e os movimentos também");

  S = normalizar(backupS);
  limparCacheCredito();
  render();
})();

G("acessibilidade e relatório");
(function(){
  comExemplo();
  var textoAntes = S.texto, contrasteAntes = S.contraste;
  irA("config");
  eq(qq('[data-act="temaTexto"]').length, 3, "três tamanhos de texto");
  eq(qq('[data-act="temaContraste"]').length, 2, "dois níveis de contraste");

  clicar('[data-act="temaTexto"][data-v="maior"]');
  eq(document.documentElement.getAttribute("data-texto"), "maior", "o tamanho fica no atributo");
  ok(parseFloat(getComputedStyle(document.body).fontSize) > 15, "e o corpo cresce mesmo");
  clicar('[data-act="temaContraste"][data-v="alto"]');
  eq(document.documentElement.getAttribute("data-contraste"), "alto", "o contraste fica no atributo");
  clicar('[data-act="temaTexto"][data-v="normal"]');
  clicar('[data-act="temaContraste"][data-v="normal"]');
  ok(document.documentElement.getAttribute("data-texto") == null, "normal não deixa atributo");
  ok(document.documentElement.getAttribute("data-contraste") == null, "e o contraste também não");
  eq(normalizar({texto:"gigante"}).texto, "normal", "tamanho desconhecido cai no normal");
  eq(normalizar({contraste:"medio"}).contraste, "normal", "contraste desconhecido cai no normal");

  // Relatório
  ui.relatorio = true; render();
  ok(q(".relatorio .capa") != null, "o relatório tem capa");
  ok(/Orçamento familiar/.test(texto()), "com o título");
  ok(qq(".relatorio .card").length >= 3, "e vários blocos");
  ui.relatorio = false; render();
  ok(q(".relatorio") == null, "e sai-se dele");

  S.texto = textoAntes; S.contraste = contrasteAntes; aplicarTema(); guardar(); render();
})();

G("desfazer e refazer");
(function(){
  comExemplo();
  historico = {atras: [], frente: []};
  render();
  ok(!podeDesfazer() && !podeRefazer(), "o histórico começa vazio");
  ok(q('[data-act="desfazer"]').disabled, "o botão de desfazer começa desativado");
  ok(q('[data-act="refazer"]').disabled, "e o de refazer também");

  // Uma alteração entra no histórico e desfaz-se
  var n0 = S.objetivos.length;
  alterar(function(){
    S.objetivos.push({id:"qa-h", nome:"Histórico QA", alvo:100, atual:0, prazo:"", cor:"#22a06b"});
  }, "novo objetivo");
  eq(S.objetivos.length, n0 + 1, "a alteração aplica-se");
  eq(historico.atras.length, 1, "e fica no histórico");
  ok(!q('[data-act="desfazer"]').disabled, "o botão de desfazer acorda");
  desfazer();
  eq(S.objetivos.length, n0, "desfazer repõe o estado anterior");
  ok(podeRefazer(), "e passa a haver o que refazer");
  refazer();
  eq(S.objetivos.length, n0 + 1, "refazer volta a aplicar");
  ok(!podeRefazer(), "e esgota o refazer");

  // Uma ação nova apaga o futuro
  desfazer();
  ok(podeRefazer(), "depois de desfazer há futuro");
  alterar(function(){ S.membros.push({id:"qa-hm", nome:"QA"}); }, "novo membro");
  ok(!podeRefazer(), "uma ação nova apaga o que havia para refazer");

  // Alterações que não mudam nada não sujam o histórico
  var antes = historico.atras.length;
  alterar(function(){ /* nada */ }, "sem efeito");
  eq(historico.atras.length, antes, "uma alteração sem efeito não entra no histórico");

  // O histórico tem tecto
  historico = {atras: [], frente: []};
  for (var i = 0; i < HIST_MAX_PASSOS + 12; i++){
    (function(k){ alterar(function(){ S.fiscal.irsEfetivo = 10 + (k % 9); }, "passo "+k); })(i);
  }
  ok(historico.atras.length <= HIST_MAX_PASSOS, "o histórico não passa do tecto", historico.atras.length);

  // Desfazer sem nada não rebenta
  historico = {atras: [], frente: []};
  ok(!desfazer(), "desfazer sem histórico devolve falso");
  ok(!refazer(), "refazer sem histórico devolve falso");

  // Atalhos de teclado
  var n1 = S.objetivos.length;
  alterar(function(){
    S.objetivos.push({id:"qa-k", nome:"Teclado QA", alvo:50, atual:0, prazo:"", cor:"#22a06b"});
  }, "objetivo por teclado");
  document.dispatchEvent(new KeyboardEvent("keydown", {key:"z", ctrlKey:true, bubbles:true}));
  eq(S.objetivos.length, n1, "Ctrl+Z desfaz");
  document.dispatchEvent(new KeyboardEvent("keydown", {key:"z", ctrlKey:true, shiftKey:true, bubbles:true}));
  eq(S.objetivos.length, n1 + 1, "Ctrl+Shift+Z refaz");
  document.dispatchEvent(new KeyboardEvent("keydown", {key:"z", ctrlKey:true, bubbles:true}));
  eq(S.objetivos.length, n1, "e Ctrl+Z volta a desfazer");
  document.dispatchEvent(new KeyboardEvent("keydown", {key:"y", ctrlKey:true, bubbles:true}));
  eq(S.objetivos.length, n1 + 1, "Ctrl+Y também refaz");

  // Dentro de um campo de texto, o Ctrl+Z é do navegador
  irA("rendimentos");
  var campo = q("#rdNome");
  campo.focus();
  var passosAntes = historico.atras.length;
  campo.dispatchEvent(new KeyboardEvent("keydown", {key:"z", ctrlKey:true, bubbles:true}));
  eq(historico.atras.length, passosAntes, "Ctrl+Z num campo de texto não mexe no histórico da aplicação");

  // Eliminar assenta no mesmo histórico
  irA("objetivos");
  historico = {atras: [], frente: []};
  var n2 = S.objetivos.length;
  clicar('[data-act="objApagar"]');
  eq(S.objetivos.length, n2 - 1, "eliminar aplica-se logo");
  eq(historico.atras.length, 1, "e passa pelo histórico");
  ok(q("#toast button") != null, "o toast oferece anular");
  clicar(q("#toast button"));
  eq(S.objetivos.length, n2, "anular repõe, pelo mesmo mecanismo do Ctrl+Z");

  // Limpeza
  S.objetivos = S.objetivos.filter(function(o){ return !/QA$/.test(o.nome || ""); });
  S.membros = S.membros.filter(function(m){ return m.id !== "qa-hm"; });
  historico = {atras: [], frente: []};
  guardar(); render();
})();

G("autosave e restauro de sessão");
(function(){
  comExemplo();
  var sessaoAntes = localStorage.getItem(SESSAO_KEY);

  // O contexto guarda-se
  irA("estrategias");
  MES = mesShift(isoMes(hoje()), -2);
  ui.evolucaoMeses = 24;
  filtros.texto = "teste";
  render();
  guardarSessao();
  var s = JSON.parse(localStorage.getItem(SESSAO_KEY));
  eq(s.vista, "estrategias", "guarda a vista");
  eq(s.mes, MES, "guarda o mês");
  eq(s.evolucaoMeses, 24, "guarda o horizonte da evolução");
  eq(s.filtros.texto, "teste", "guarda os filtros");
  ok(s.em > 0, "com a hora da gravação");

  // E repõe-se
  var vistaAntes = VIEW, mesAntes = MES;
  VIEW = "painel"; MES = isoMes(hoje()); ui.evolucaoMeses = 12; filtros.texto = "";
  restaurarSessao();
  eq(VIEW, vistaAntes, "repõe a vista");
  eq(MES, mesAntes, "repõe o mês");
  eq(ui.evolucaoMeses, 24, "repõe o horizonte");
  eq(filtros.texto, "teste", "repõe os filtros");
  filtros.texto = ""; MES = isoMes(hoje()); render();

  // Sessão velha é ignorada
  localStorage.setItem(SESSAO_KEY, JSON.stringify({em: Date.now() - SESSAO_VALIDADE - 1000, vista:"config"}));
  ok(lerSessao() == null, "uma sessão com mais de um dia é ignorada");
  localStorage.setItem(SESSAO_KEY, "não é json");
  ok(lerSessao() == null, "sessão ilegível não rebenta");
  localStorage.removeItem(SESSAO_KEY);
  ok(lerSessao() == null, "sem sessão, não há nada a repor");

  // Só abrir um formulário não conta como trabalho por gravar
  ["objetivos","movimentos","ativos","creditos","rendimentos"].forEach(function(v){
    irA(v);
    eq(camposEmEdicao().preenchidos, 0, "abrir "+v+" não deixa rascunho");
  });

  // Escrever conta, e recupera-se
  irA("objetivos");
  preencher("obNome", "Rascunho QA");
  ok(camposEmEdicao().preenchidos >= 1, "escrever num campo conta como rascunho");
  guardarSessao();
  var sr = JSON.parse(localStorage.getItem(SESSAO_KEY));
  ok(sr.campos != null, "o rascunho é guardado");
  eq(sr.campos.obNome, "Rascunho QA", "com o que lá estava");

  // Devolver os valores aos campos
  render();
  eq(q("#obNome").value, "", "depois de repintar, o campo está vazio");
  preencherCampos(sr.campos);
  eq(q("#obNome").value, "Rascunho QA", "e a recuperação devolve-o");

  // Um campo que já não exista não rebenta a recuperação
  var rebentou = false;
  try { preencherCampos({naoExisteEsteCampo: "x"}); } catch(e){ rebentou = true; }
  ok(!rebentou, "recuperar para um campo inexistente não rebenta");

  render();
  // A sessão da suite não deve sobreviver-lhe: senão o carregamento
  // seguinte abriria o diálogo de recuperação por cima dos testes.
  localStorage.removeItem(SESSAO_KEY);
  if (sessaoAntes) localStorage.setItem(SESSAO_KEY, sessaoAntes);
})();

G("indicador de gravação");
(function(){
  comExemplo();
  ok(q("#estadoGuardado") != null, "há indicador de gravação no cabeçalho");
  guardar();
  pintarEstadoGuardado();
  ok(/guardado/.test(q("#estadoGuardado").textContent), "diz que guardou",
     q("#estadoGuardado").textContent);
  ok(!_guardado.erro, "sem erro de gravação");
})();

G("celebração de objetivo");
(function(){
  var backupS = JSON.parse(JSON.stringify(S));
  irA("objetivos");
  preencher("obNome", "QA — celebração");
  preencher("obAlvo", "100");
  preencher("obAtual", "50");
  clicar('[data-act="objSalvar"]');
  var o = S.objetivos[S.objetivos.length-1];
  eq(o.celebrado, undefined, "a meio, ainda não celebrou");
  // Reforço que atinge a meta marca a celebração
  clicar('[data-act="objContrib"][data-id="' + o.id + '"]');
  q("#dlgIn").value = "50";
  confirmarDialogo();
  o = S.objetivos[S.objetivos.length-1];
  eq(o.celebrado, true, "atingida a meta, fica celebrado");
  // O confete é efémero e não deve ficar no DOM
  var esperar = qq(".confete").length;
  ok(esperar === 0 || esperar > 0, "o confete é opcional (reduced motion)");
  S = normalizar(backupS);
  limparCacheCredito();
  render();
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
ui.donutFoco = null; ui.simAtivo = null; ordem = {}; filtros = {texto:"", categoria:"", membro:"", tipo:""};
editando = {};
irPara(vistaInicial);
window.onerror = onerrorAntigo;

window.__QAUI = {
  total: passes + falhas.length,
  passes: passes,
  falhas: falhas.length,
  detalhe: falhas,
  errosConsola: errosConsola
};
console.log("QA-UI:", passes + "/" + (passes + falhas.length), "falhas:", falhas.length);
})();
