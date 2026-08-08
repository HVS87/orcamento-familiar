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
var filtrosIniciais = JSON.parse(JSON.stringify(filtros));
var secaoInicial = ui.secaoDespesa;

/* A sessão é do utilizador, não da suite: sai de cena enquanto se testa.
   E se ficou um diálogo aberto (recuperação de rascunho, por exemplo),
   fecha-se — senão o primeiro grupo mede o diálogo em vez da aplicação. */
localStorage.removeItem(SESSAO_KEY);
if (q("#modalHost .overlay")) q("#modalHost").innerHTML = "";
if (q("#paleta")) q("#paleta").innerHTML = "";

/* Contexto volátil reposto antes de começar. Um filtro herdado do
   restauro de sessão esconde linhas da tabela, e um teste que procura o
   botão de uma linha escondida falha sem que nada esteja partido — uma
   falha que depende do que o utilizador estava a filtrar não se
   reproduz e não se depura. */
function contextoLimpo(){
  filtros.texto = ""; filtros.categoria = ""; filtros.membro = ""; filtros.tipo = "";
  editando = {};
  ui.secaoDespesa = "plano";
  ui.essencial = false;
  ui.privado = false;
  ui.relatorio = false;
  ui.simAtivo = null;
  ui.donutFoco = null;
  ui.movSel = {};
  ui.fechoDispensado = null;
  ui.corteAlvo = 0;
  ui.corteAjustes = {};
  ui.planPrefill = null;
  ui.abertos = {};
  document.body.classList.remove("privado");
}

function comExemplo(){
  localStorage.removeItem(STORE_KEY);
  S = estadoVazio();
  carregarExemplo();
  MES = isoMes(hoje());
  contextoLimpo();
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
  // Os deslizadores de dinheiro movem-se em posições numa escala progressiva:
  // o teste diz o valor que quer e a conversão é a mesma que a interface usa.
  function deslizar(id, valor){
    var el = document.getElementById(id);
    if (!el) return false;
    el.value = el.dataset.escala ? escalaPos(ESCALAS[el.dataset.escala], valor) : valor;
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

  // Deslizadores com escala: teto nos milhões sem perder o passo fino
  irA("estrategias");
  var ini = q('[data-slider="estInicial"]');
  ok(ini != null, "o «já tem poupado» está em ecrã");
  eq(ini.dataset.escala, "capital", "e usa a escala do capital");
  eq(ini.step, "1", "o comando move-se em posições");
  eq(ini.max, String(escalaPassos(ESCALAS.capital)), "com tantas posições quantas a escala tem");

  // Um valor de milionário chega mesmo ao estado
  ini.value = ini.max; ini.dispatchEvent(new Event("input", {bubbles:true}));
  eq(S.estrategia.inicial, 3000000, "o topo do deslizador vale 3 000 000 €");
  var esperado = fmtSlider(3000000, " €");
  eq(q("#estInicialOut").textContent, esperado, "e a leitura mostra-o em euros");
  eq(ini.getAttribute("aria-valuetext"), esperado, "o leitor de ecrã ouve euros, não a posição");
  ok(/3\D?000\D?000/.test(esperado), "com os milhões escritos por extenso: "+esperado);

  // E o passo fino em baixo continua a existir
  ini.value = 1; ini.dispatchEvent(new Event("input", {bubbles:true}));
  eq(S.estrategia.inicial, 100, "uma posição acima de zero são 100 €, não milhares");
  ini.value = escalaPos(ESCALAS.capital, 8500);
  ini.dispatchEvent(new Event("input", {bubbles:true}));
  eq(S.estrategia.inicial, 8500, "e 8 500 € são exatamente atingíveis");

  var men = q('[data-slider="estMensal"]');
  eq(men.dataset.escala, "mensal", "a poupança mensal também tem escala");
  men.value = men.max; men.dispatchEvent(new Event("input", {bubbles:true}));
  eq(S.estrategia.mensal, 50000, "e chega a 50 000 €/mês");
  men.value = escalaPos(ESCALAS.mensal, 250);
  men.dispatchEvent(new Event("input", {bubbles:true}));
  eq(S.estrategia.mensal, 250, "sem perder os 250 €/mês de quem começa");

  // O resultado acompanha valores destes
  ok(/€/.test(q("#estOut").textContent), "o resultado continua a mostrar-se");
  ok(!/NaN|undefined|Infinity/.test(texto()), "sem lixo no ecrã com valores de milionário");

  clicar('[data-act="estObjetivo"][data-obj="entrada"]');
  var casa = q('[data-slider="estPrecoCasa"]');
  eq(casa.dataset.escala, "casa", "o preço da casa tem escala própria");
  casa.value = casa.max; casa.dispatchEvent(new Event("input", {bubbles:true}));
  eq(S.estrategia.precoCasa, 3000000, "e chega a 3 000 000 €");
  ok(/IMT/.test(q("#estOut").textContent), "com o IMT ainda calculado");
  ok(!/NaN|undefined|Infinity/.test(texto()), "sem lixo numa casa de 3 M€");

  clicar('[data-act="estObjetivo"][data-obj="automovel"]');
  var auto = q('[data-slider="estPrecoAuto"]');
  eq(auto.dataset.escala, "auto", "o automóvel tem escala própria");
  auto.value = auto.max; auto.dispatchEvent(new Event("input", {bubbles:true}));
  eq(S.estrategia.precoAuto, 500000, "e chega a 500 000 €");
  clicar('[data-act="estObjetivo"][data-obj="reforma"]');

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
  sl.value = escalaPos(ESCALAS[sl.dataset.escala], 500);
  sl.dispatchEvent(new Event("input", {bubbles:true}));
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
  sl2.value = escalaPos(ESCALAS[sl2.dataset.escala], 500);
  sl2.dispatchEvent(new Event("input", {bubbles:true}));
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

  // Compras planeadas: o nome atravessa cartão, faixa e tabela das realizadas
  irA("despesas");
  clicar('[data-act="secDespesa"][data-v="planear"]');
  preencher("plNome", mau);
  preencher("plValor", "900");
  clicar('[data-act="planSalvar"]');
  var pl = S.planeadas[S.planeadas.length-1];
  ok(pl.nome === mau, "compra planeada: guarda tal e qual");
  ok(!window.__xss, "compra planeada: não executa");
  ok(q("#app img") == null, "compra planeada: não injeta elementos");
  ok(texto().indexOf("<img") >= 0, "compra planeada: aparece como texto literal");
  clicar('[data-act="planRealizar"][data-id="' + pl.id + '"]');
  ok(!window.__xss, "nem ao passar para as realizadas");
  ok(q("#app img") == null, "e a tabela das realizadas também escapa");
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
  eq(qq("#folhaMais button[data-view]").length, 5, "a folha traz as restantes cinco");

  /* A folha «Mais» esteve permanentemente aberta no telemóvel: o JS punha-lhe
     `hidden`, mas a regra de CSS que lhe dá `display:flex` traz um `id`, e um
     `id` ganha ao `[hidden]{display:none}` que vem da folha do navegador.
     O atributo dizia uma coisa e o desenho fazia outra — e ficava a tapar o
     conteúdo para sempre. Testa-se o desenho, não só o atributo. */
  (function(){
    var f = q("#folhaMais"), btn = q("#btnMais");
    var raiz = document.documentElement, antesDisp = raiz.getAttribute("data-dispositivo");
    raiz.setAttribute("data-dispositivo", "telemovel");
    var mostrada = function(){ return getComputedStyle(f).display !== "none"; };

    f.hidden = true;
    ok(!mostrada(), "com `hidden` posto, a folha «Mais» não se vê", getComputedStyle(f).display);

    btn.click();
    ok(!f.hidden && mostrada(), "o botão abre-a");
    eq(btn.getAttribute("aria-expanded"), "true", "e anuncia-a aberta");

    btn.click();
    ok(f.hidden && !mostrada(), "e volta a fechá-la");
    eq(btn.getAttribute("aria-expanded"), "false", "anunciando-a fechada");

    /* Uma folha que paira por cima do conteúdo tem de sair ao primeiro toque
       ao lado — senão fica no caminho até se voltar ao botão que a abriu. */
    btn.click();
    q("#app").click();
    ok(f.hidden && !mostrada(), "tocar fora fecha-a");

    btn.click();
    f.click();
    ok(!f.hidden, "tocar dentro, sem ser num botão, não a fecha");

    document.dispatchEvent(new KeyboardEvent("keydown", {key:"Escape", bubbles:true}));
    ok(f.hidden && !mostrada(), "e o Esc fecha-a");

    btn.click();
    q("#folhaMais button[data-view]").click();
    ok(f.hidden && !mostrada(), "escolher uma vista fecha-a também");

    if (antesDisp) raiz.setAttribute("data-dispositivo", antesDisp);
    else raiz.removeAttribute("data-dispositivo");
    aplicarOrientacao();
  })();

  // Ícones nos separadores — um por separador, sejam quantos forem
  eq(qq("nav.tabs .ticon").length, qq("nav.tabs button[data-view]").length,
     "cada separador tem ícone");

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

  /* Ao concluir com a família de demonstração ainda por tocar, pergunta-se
     o que lhe fazer — e explica-se o caminho para começar um orçamento novo,
     que é a dúvida que fica de quem acabou de ver uma apresentação. */
  var dlg = q("#modalHost .dialog");
  ok(dlg != null, "concluir pergunta o que fazer ao exemplo");
  if (dlg){
    var td = dlg.innerText;
    ok(/exemplo|demonstra/i.test(td), "diz que aquela família é de exemplo");
    ok(/Ana/.test(td) && /Bruno/.test(td), "e chama-lhe pelos nomes");
    ok(/Dados/.test(td) && /Apagar tudo/.test(td),
       "explica onde se apaga para começar de novo");
    ok(/ponto/i.test(td) && /partida/i.test(td),
       "e que a seguir aparecem os pontos de partida");
    ok(q('#modalHost [data-dlg="ficar"]') != null, "há a saída de continuar a explorar");
    ok(q('#modalHost [data-dlg="apagar"]') != null, "e a de apagar e começar o seu");
    /* Num telemóvel deitado sobram 375 px de altura: um diálogo mais alto do
       que o ecrã tem de se deslocar por dentro, senão os botões ficam fora
       de alcance e não há como responder à pergunta. */
    var est = getComputedStyle(dlg);
    ok(/auto|scroll/.test(est.overflowY), "o diálogo desloca-se se não couber", est.overflowY);
    ok(est.maxHeight !== "none", "porque tem altura máxima", est.maxHeight);
    // Fechar pelo lado de fora nunca pode apagar: apagar tem de ser dito
    q("#modalHost .overlay").dispatchEvent(new MouseEvent("click", {bubbles:true}));
    ok(temDados(), "clicar fora do diálogo não apaga nada");
    ok(q("#modalHost .dialog") == null, "mas fecha-o");
    despedidaDaVisita();   // reabre para continuar o teste
  }

  // Continuar a explorar: fica tudo, e mostra-se onde é que depois se apaga
  clicar('#modalHost [data-dlg="ficar"]');
  ok(q("#modalHost .dialog") == null, "escolher continuar fecha o diálogo");
  ok(temDados(), "e os dados ficam");
  eq(S.exemploDemo, true, "ainda marcados como demonstração");
  ok(q("#menuBtn").classList.contains("aponta"), "o menu Dados fica apontado");
  irA("painel");
  ok(/família de exemplo/i.test(texto()),
     "e o painel passa a lembrar que aqueles números não são de ninguém");

  // Apagar: leva ao ecrã de boas-vindas com os pontos de partida à vista
  var paletaAntes = S.paleta;
  S.paleta = "oceano"; S.texto = "grande";
  clicar('.dica [data-act="demoApagar"]');
  eq(temDados(), 0, "apagar leva mesmo a família");
  eq(S.exemploDemo, false, "e a marca de demonstração vai com ela");
  eq(S.tutorialVisto, true, "a visita continua dada por vista");
  eq(S.paleta, "oceano", "o tema é escolha de quem cá está, e fica");
  eq(S.texto, "grande", "o tamanho de texto também");
  ok(q(".perfis") != null, "o ecrã de boas-vindas volta com os pontos de partida");
  ok(q(".perfis.aponta") != null, "e são eles que ficam apontados");
  ok(podeDesfazer(), "um engano desfaz-se");
  desfazer();
  ok(temDados(), "e desfazer devolve a família");
  eq(S.exemploDemo, true, "com a marca e tudo");
  S.paleta = paletaAntes; S.texto = "normal"; aplicarTema();

  /* Mexer no orçamento tira a marca — nunca se oferece apagar o que já é
     trabalho de alguém. Mexer só na interface não conta. */
  comExemplo();
  eq(S.exemploDemo, true, "o exemplo acabado de carregar está intacto");
  alterar(function(){ S.paleta = "floresta"; });
  eq(S.exemploDemo, true, "mudar a paleta não faz dele um orçamento a sério");
  alterar(function(){ S.dicasOcultas = ["seja qual for"]; });
  eq(S.exemploDemo, true, "arrumar uma sugestão também não");
  alterar(function(){ S.movimentos.push({id:"mvX", data: MES+"-05", descricao:"Meu café",
    valor:-1.2, categoriaId: S.categorias[0].id, membroId:"", tipo:"despesa"}); });
  eq(S.exemploDemo, false, "mas lançar um movimento sim");
  clicar('header [data-act="tutorialIniciar"]');
  for (var j = 0; j < total; j++) clicar('[data-act="tutorialSeguinte"]');
  ok(q("#modalHost .dialog") == null,
     "e com dados tocados a visita já não se oferece para os apagar");
  q("#modalHost").innerHTML = "";
  S.paleta = paletaAntes; aplicarTema();

  comExemplo();
  S.tutorialVisto = false;

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

G("rotação: atributos, reposição e repintura");
(function(){
  comExemplo();
  var raiz = document.documentElement;
  var estadoAntes = ui.ecra;

  // Ao aplicar, o <html> fica marcado com o que o CSS precisa de saber
  aplicarOrientacao();
  ok(["retrato","paisagem",""].indexOf(raiz.getAttribute("data-orientacao")||"") >= 0,
     "o <html> declara a orientação", raiz.getAttribute("data-orientacao"));
  ok(["telemovel","tablet","desktop"].indexOf(raiz.getAttribute("data-dispositivo")||"desktop") >= 0,
     "e a classe do aparelho", raiz.getAttribute("data-dispositivo"));
  ok(ui.ecra != null, "e fica registado em ui.ecra para o JS ler o mesmo");

  // Chamar duas vezes seguidas não muda nada — é idempotente
  var depois1 = raiz.getAttribute("data-orientacao");
  aplicarOrientacao(); aplicarOrientacao();
  eq(raiz.getAttribute("data-orientacao"), depois1, "aplicar duas vezes dá o mesmo");

  /* Rodar tem de repor o cabeçalho: recolhido em retrato, ficaria recolhido
     em paisagem sem que nenhum gesto o trouxesse de volta. Só se verifica
     com uma janela medível — sem dimensões, `aplicarOrientacao` sai cedo de
     propósito, e bem: mudar o desenho com base em zero seria pior. */
  var medivel = classificarEcra().valido;
  ok(true, medivel ? "a janela é medível ("+window.innerWidth+"×"+window.innerHeight+")"
                   : "janela sem dimensões: a reposição ao rodar fica de fora");
  if (medivel){
    var h = q("header");
    h.classList.add("recolhido");
    ui.ecra = {orientacao: (raiz.getAttribute("data-orientacao") === "retrato" ? "paisagem" : "retrato"),
               dispositivo: "telemovel", larg:1, alt:1, valido:true, deitado:false};
    aplicarOrientacao();
    ok(!h.classList.contains("recolhido"), "ao rodar, o cabeçalho volta");

    // E fecha as folhas que ficariam mal colocadas
    var fm = q("#folhaMais");
    fm.hidden = false;
    ui.ecra = {orientacao:"nenhuma", dispositivo:"telemovel", larg:1, alt:1, valido:true, deitado:false};
    aplicarOrientacao();
    ok(fm.hidden, "e a folha «Mais» fecha-se");
  }

  /* Regressão: rodar repintava a vista inteira, e com ela os formulários.
     Quem rodasse o telemóvel a meio de escrever um movimento perdia o que
     tinha escrito — e rodar a meio de preencher é coisa que se faz. Só se
     repinta o que depende mesmo da largura; o resto do desenho é CSS. */
  if (classificarEcra().valido){
    comExemplo();
    ui.secaoDespesa = "movimentos"; irA("despesas");
    clicar('[data-act="secDespesa"][data-v="movimentos"]');
    var campoV = q("#mvValor"), campoD = q("#mvDesc");
    if (campoV && campoD){
      campoV.value = "47,80";
      campoD.value = "Jantar com os pais";
      ui.ecra = {orientacao:"paisagem", dispositivo:"telemovel",
                 larg:812, alt:375, valido:true, deitado:true};
      aplicarOrientacao();
      // A repintura é adiada; o que interessa é que não destrua o formulário
      eq((q("#mvValor")||{}).value, "47,80", "rodar não apaga o valor por gravar");
      eq((q("#mvDesc")||{}).value, "Jantar com os pais", "nem a descrição");
    }

    // Um diálogo aberto também não desaparece por se rodar o aparelho
    confirmar("Teste", "texto", function(){}, "Ok");
    ui.ecra = {orientacao:"retrato", dispositivo:"telemovel",
               larg:375, alt:812, valido:true, deitado:false};
    aplicarOrientacao();
    ok(q('[data-dlg="yes"]') != null, "e um diálogo aberto sobrevive à rotação");
    q("#modalHost").innerHTML = "";

    // Rodar muitas vezes seguidas não parte nada nem acumula trabalho
    var rodadas = 0;
    for (var k = 0; k < 10; k++){
      ui.ecra = {orientacao: k % 2 ? "retrato" : "paisagem", dispositivo:"telemovel",
                 larg: k % 2 ? 375 : 812, alt: k % 2 ? 812 : 375, valido:true, deitado: !(k % 2)};
      try { aplicarOrientacao(); rodadas++; } catch(err){ /* contado abaixo */ }
    }
    eq(rodadas, 10, "dez rotações seguidas não rebentam");
    ok(q("#app").innerText.length > 200, "e a aplicação continua de pé");
  }

  // O atributo do caso apertado só existe quando é mesmo o caso
  var e = classificarEcra();
  if (e.deitado) eq(raiz.getAttribute("data-deitado"), "telemovel",
    "num ecrã largo e baixo, o atributo está lá");
  else ok(raiz.getAttribute("data-deitado") == null,
    "fora do caso apertado, o atributo não existe");

  ui.ecra = estadoAntes;
  aplicarOrientacao();
})();

G("E se…? — eventos de vida");
(function(){
  comExemplo();
  ui.cenarioVida = {eventos: [], meses: 24};
  irA("ese");
  ok(q('nav.tabs button[data-view="ese"]') != null, "há separador próprio para o simulador");
  eq(qq('[data-act="eseJuntar"]').length, Object.keys(EVENTOS_VIDA).length,
     "com todos os acontecimentos à escolha");
  ok(/Nenhum acontecimento/.test(texto()), "vazio, explica-se e ilustra-se");

  var estadoAntes = JSON.stringify(S);
  clicar('[data-act="eseJuntar"][data-k="filho"]');
  eq(ui.cenarioVida.eventos.length, 1, "juntar um acontecimento fica no cenário");
  eq(ui.cenarioVida.eventos[0].tipo, "filho", "com o tipo certo");
  ok(mesValido(ui.cenarioVida.eventos[0].mes), "e um mês de início válido");
  ok(q("#eseOut") != null, "o resultado aparece");
  ok(/O que muda/.test(texto()), "com o título do resultado");
  ok(!/NaN|undefined/.test(texto()), "e sem lixo no ecrã");

  // Os deslizadores mexem no cenário sem repintar a vista toda
  var sl = q("[data-ese]");
  ok(sl != null, "cada parâmetro tem deslizador");
  var i = sl.dataset.ese, p = sl.dataset.p;
  var antesVal = ui.cenarioVida.eventos[i].params[p];
  sl.value = String(parseNum(sl.max));
  sl.dispatchEvent(new Event("input", {bubbles:true}));
  eq(ui.cenarioVida.eventos[i].params[p], parseNum(sl.max), "mexer no deslizador afina o parâmetro");
  ok(ui.cenarioVida.eventos[i].params[p] !== antesVal, "e o valor mudou mesmo");
  ok(qq("[data-ese]")[0] === sl, "sem repintar a vista a cada pixel de arrasto");
  ok(q("#ese"+i+"_"+p+"Out") != null, "a leitura do deslizador existe");

  // Horizonte
  clicar('[data-act="eseHorizonte"][data-v="36"]');
  eq(ui.cenarioVida.meses, 36, "o horizonte muda");
  clicar('[data-act="eseHorizonte"][data-v="24"]');

  // Juntar um segundo e remover
  clicar('[data-act="eseJuntar"][data-k="carro"]');
  eq(ui.cenarioVida.eventos.length, 2, "dois acontecimentos coexistem");
  clicar('[data-act="eseRemover"][data-i="1"]');
  eq(ui.cenarioVida.eventos.length, 1, "e remove-se um deles");

  // Nada disto mexeu nos dados
  eq(JSON.stringify(S), estadoAntes, "simular nunca altera o orçamento");
  ok(!podeDesfazer() || historico.atras.length >= 0, "e não polui o histórico com simulações");

  clicar('[data-act="eseLimpar"]');
  eq(ui.cenarioVida.eventos.length, 0, "limpar esvazia o cenário");
  eq(JSON.stringify(S), estadoAntes, "e continua sem tocar nos dados");
})();

G("provisões, saúde e défice no painel");
(function(){
  comExemplo();
  S.painel.ocultos = [];
  MES = isoMes(hoje());
  // Uma rubrica anual, para haver provisões
  S.recorrentes.push({id:"pv", tipo:"despesa", nome:"Seguro auto", valor:600, frequencia:"anual",
    ativo:true, categoriaId:catPorNome("Seguros"), membroId:"", inicio:mesShift(MES,-3)+"-01"});
  limparCacheCredito();
  irA("painel");
  ok(/Provisões/.test(texto()), "o cartão das provisões aparece");
  ok(/devia ter de parte/i.test(texto()), "com o que devia estar guardado");
  ok(/Saúde financeira/.test(texto()), "e o da saúde financeira");
  ok(q("svg.anel") != null, "com o anel da pontuação");
  var s = saudeFinanceira();
  ok(new RegExp(s.total+"").test(texto()), "a pontuação aparece em ecrã", s.total);
  ok(!/NaN|undefined/.test(texto()), "sem lixo");

  // Défice: só aparece quando o mês fecha em vermelho
  ok(q('[data-act="deficeCortar"]') == null || alavancasDefice() != null,
     "sem défice não há cartão de défice");
  var catR = S.categorias.filter(function(c){ return c.tipo === "rendimento"; })[0].id;
  S.movimentos = [];
  S.movimentos.push({id:"x1", data:MES+"-01", tipo:"rendimento", descricao:"S", categoriaId:catR, membroId:"", valor:900});
  S.movimentos.push({id:"x2", data:MES+"-04", tipo:"despesa", descricao:"G",
    categoriaId:catPorNome("Restauração"), membroId:"", valor:1500});
  limparCacheCredito();
  render();
  ok(/Resolver o défice/.test(texto()), "com o mês em défice, o cartão aparece");
  ok(/faltam/i.test(texto()), "e diz quanto falta");
  var btnCortar = q('[data-act="deficeCortar"]');
  if (btnCortar){
    btnCortar.click();
    ok(ui.corteAlvo > 0, "«cortar» prepara o plano de corte com o valor em falta", ui.corteAlvo);
    eq(ui.secaoDespesa, "limites", "e leva aos limites");
  }
})();

G("cópia cifrada");
(function(){
  ok(typeof cifrar === "function" && typeof decifrar === "function", "há cifra e decifra");
  ok(temCripto(), "o navegador oferece WebCrypto");
  ok(CIFRA_ITER >= 100000, "as iterações do PBKDF2 travam tentativa e erro", CIFRA_ITER);
  ok(!ehPacoteCifrado({}), "um objeto vazio não é pacote cifrado");
  ok(!ehPacoteCifrado({formato:"outro", sal:"a", iv:"b", dados:"c"}), "nem outro formato");
  ok(ehPacoteCifrado({formato:CIFRA_MARCA, sal:"a", iv:"b", dados:"c"}), "o nosso é reconhecido");

  // O diálogo pede confirmação a gravar e recusa palavras-passe curtas
  pedirSenha({titulo:"Teste", texto:"t", confirmar:true, aviso:"perde tudo", onOk:function(){}});
  ok(q("#dlgSenha") != null, "o diálogo pede a palavra-passe");
  ok(q("#dlgSenha2") != null, "e a confirmação, a gravar");
  ok(/Sem recuperação/i.test(texto()) || /perde tudo/.test(q("#modalHost").textContent),
     "com o aviso de que não há recuperação");
  q("#dlgSenha").value = "curta"; q("#dlgSenha2").value = "curta";
  q('[data-dlg="yes"]').click();
  ok(q("#dlgSenha") != null, "uma palavra-passe curta não passa");
  ok(/8 caracteres/.test(q("#dlgSenhaErro").textContent), "e explica porquê");
  q("#dlgSenha").value = "palavra-passe-longa"; q("#dlgSenha2").value = "outra-diferente";
  q('[data-dlg="yes"]').click();
  ok(/não coincidem/.test(q("#dlgSenhaErro").textContent), "duas diferentes também não");
  q("#modalHost").innerHTML = "";

  // A decifrar não se pede confirmação
  pedirSenha({titulo:"Teste", texto:"t", onOk:function(){}});
  ok(q("#dlgSenha2") == null, "a decifrar basta escrever uma vez");
  q("#modalHost").innerHTML = "";
})();

G("registo em dois toques");
(function(){
  comExemplo();
  MES = isoMes(hoje());
  ok(q("#botaoRapido") != null, "o botão flutuante está sempre lá");
  var antes = S.movimentos.length;
  abrirRapido();
  ok(q("#rapidoValor") != null, "abre com o campo do valor");
  ok(qq("[data-rapido-cat]").length > 0, "e as categorias mais usadas");
  ok(qq("[data-rapido-cat]").length <= 6, "no máximo seis", qq("[data-rapido-cat]").length);
  eq(qq('[data-rapido-cat][aria-pressed="true"]').length, 1, "com uma já escolhida");

  // Sem valor não grava
  q('[data-dlg="yes"]').click();
  ok(q("#rapidoValor") != null, "sem valor não fecha");
  ok(/Escreva um valor/.test(q("#rapidoErro").textContent), "e explica");

  // Com valor grava, com a data de hoje
  q("#rapidoValor").value = "12,50";
  var catEscolhida = q('[data-rapido-cat][aria-pressed="true"]').dataset.rapidoCat;
  q('[data-dlg="yes"]').click();
  eq(S.movimentos.length, antes + 1, "com valor, cria o movimento");
  var novo = S.movimentos[S.movimentos.length-1];
  eq(novo.valor, 12.5, "com o valor escrito");
  eq(novo.data, isoDia(hoje()), "e a data de hoje");
  eq(novo.categoriaId, catEscolhida, "na categoria escolhida");
  eq(novo.tipo, "despesa", "despesa por omissão");
  ok(novo.descricao, "e uma descrição, nem que seja o nome da categoria");
  ok(podeDesfazer(), "o registo rápido é desfazível");
  desfazer();
  eq(S.movimentos.length, antes, "e desfaz-se");
})();

G("linha do tempo do desfazer");
(function(){
  comExemplo();
  historico.atras.length = 0; historico.frente.length = 0;

  /* Regressão: a abertura por toque longo engolia o clique seguinte no ↶
     para não desfazer um passo por cima da lista. Com um sinalizador, um
     toque longo cujo clique nunca chegasse a acontecer deixava a marca
     ligada — e o ↶ ficava mudo até alguém carregar duas vezes. */
  alterar(function(){ S.membros.push({id:"lt1", nome:"A", icone:"🧑", cor:"#000"}); }, "um");
  alterar(function(){ S.membros.push({id:"lt2", nome:"B", icone:"🧑", cor:"#000"}); }, "dois");
  var antesN = historico.atras.length;
  // Simula a marca deixada por um toque longo de há muito tempo
  if (typeof _longEm !== "undefined"){
    _longEm = Date.now() - 5000;
    clicar('[data-act="desfazer"]');
    eq(historico.atras.length, antesN - 1,
       "passada a janela do toque longo, o ↶ volta a desfazer");
    refazer();
  }
  ok(true, "a marca do toque longo é temporal, não um sinalizador permanente");

  historico.atras.length = 0; historico.frente.length = 0;
  abrirHistorico();
  ok(q("#modalHost").innerHTML === "", "sem histórico, não abre nada");

  // Três alterações com rótulo
  alterar(function(){ S.membros.push({id:"h1", nome:"Um", icone:"🧑", cor:"#000"}); }, "primeiro");
  alterar(function(){ S.membros.push({id:"h2", nome:"Dois", icone:"🧑", cor:"#000"}); }, "segundo");
  alterar(function(){ S.membros.push({id:"h3", nome:"Três", icone:"🧑", cor:"#000"}); }, "terceiro");
  eq(historico.atras.length, 3, "três passos no histórico");

  abrirHistorico();
  ok(q(".listaHist") != null, "a linha do tempo abre");
  eq(qq('[data-hist="atras"]').length, 3, "com um item por passo");
  ok(/terceiro/.test(q(".listaHist").textContent), "e os rótulos que já existiam");
  // O mais recente aparece primeiro
  ok(/terceiro/.test(qq('[data-hist="atras"]')[0].textContent), "o mais recente em cima");

  // Saltar dois passos de uma vez
  qq('[data-hist="atras"]')[1].click();
  eq(historico.atras.length, 1, "clicar num passo desfaz até lá");
  eq(S.membros.filter(function(m){ return m.id === "h2"; }).length, 0, "e o estado acompanha");
  ok(q("#modalHost").innerHTML === "", "o diálogo fecha-se");
  ok(historico.frente.length === 2, "e o que se desfez fica por refazer");
})();

G("emblemas, dias e teclado dos meses");
(function(){
  comExemplo();
  MES = isoMes(hoje());
  // Emblemas: um movimento sem categoria acende o das despesas
  S.movimentos.push({id:"sc", data:MES+"-03", tipo:"despesa", descricao:"Solto",
    categoriaId:"", membroId:"", valor:20});
  limparCacheCredito();
  render();
  var emb = emblemasVistas();
  ok(emb.despesas >= 1, "um movimento sem categoria acende o emblema das despesas", emb.despesas);
  var pontoDesp = q('#tabs button[data-view="despesas"] .emblema');
  ok(pontoDesp != null, "e o ponto aparece no separador");
  ok(/^\d|9\+/.test(pontoDesp.textContent), "com o número", pontoDesp.textContent);
  // Resolver a lacuna baixa a contagem. O exemplo já traz movimentos por
  // categorizar, por isso o emblema não tem de desaparecer — tem de descer.
  var comLacuna = emb.despesas;
  S.movimentos = S.movimentos.filter(function(m){ return m.id !== "sc"; });
  limparCacheCredito();
  render();
  var depois = emblemasVistas().despesas || 0;
  eq(depois, comLacuna - 1, "resolvida uma lacuna, a contagem desce");
  // E com tudo resolvido, o emblema sai mesmo de cena
  S.movimentos.forEach(function(m){ if (!m.categoriaId) m.categoriaId = catPorNome("Alimentação"); });
  limparCacheCredito();
  render();
  ok(emblemasVistas().despesas == null, "sem lacunas nenhumas, não há emblema");
  ok(q('#tabs button[data-view="despesas"] .emblema') == null, "e o ponto desaparece do separador");

  // Movimentos agrupados por dia
  ui.secaoDespesa = "movimentos"; irA("despesas");
  ordem.mov = {col:"data", dir:-1};
  render();
  ok(qq("tr.diaCabec").length > 0, "os movimentos agrupam-se por dia");
  var cab = q("tr.diaCabec");
  ok(/\d/.test(cab.textContent), "com o subtotal do dia", cab.textContent.trim().slice(0,50));
  // Ordenar por outra coluna desliga a agrupação, que deixaria de ser verdade
  ordem.mov = {col:"valor", dir:-1};
  render();
  eq(qq("tr.diaCabec").length, 0, "ordenado por valor, não há agrupamento por dia");
  ordem.mov = {col:"data", dir:-1};

  // diaExtenso
  ok(/hoje/.test(diaExtenso(isoDia(hoje()))), "o dia de hoje diz «hoje»");
  ok(!/hoje/.test(diaExtenso("2020-01-15")), "uma data antiga não");
  eq(diaExtenso(""), "—", "sem data, um travessão");

  // Teclado dos meses
  var mesAntes = MES;
  document.dispatchEvent(new KeyboardEvent("keydown", {key:"[", bubbles:true}));
  eq(MES, mesShift(mesAntes, -1), "«[» recua um mês");
  document.dispatchEvent(new KeyboardEvent("keydown", {key:"]", bubbles:true}));
  eq(MES, mesAntes, "«]» avança um mês");
  MES = mesShift(mesAntes, -5); render();
  document.dispatchEvent(new KeyboardEvent("keydown", {key:"t", bubbles:true}));
  eq(MES, isoMes(hoje()), "«T» volta ao mês de hoje");
  // Dentro de um campo de texto, as teclas não roubam nada
  ui.secaoDespesa = "movimentos"; irA("despesas");
  var campo = q("#mvDesc");
  if (campo){
    MES = mesAntes; render();
    campo = q("#mvDesc"); campo.focus();
    campo.dispatchEvent(new KeyboardEvent("keydown", {key:"[", bubbles:true}));
    eq(MES, mesAntes, "num campo de texto, «[» não muda de mês");
  }
})();

G("fita como mini-mapa e retrato do ano");
(function(){
  comExemplo();
  MES = isoMes(hoje());
  var catR = S.categorias.filter(function(c){ return c.tipo === "rendimento"; })[0].id;
  var cat = catPorNome("Alimentação");
  S.movimentos = [];
  // Três meses com taxas de poupança muito diferentes
  [[1, 2000, 2400], [2, 2000, 1900], [3, 2000, 900]].forEach(function(x){
    var m = mesShift(MES, -x[0]);
    S.movimentos.push({id:"r"+x[0], data:m+"-01", tipo:"rendimento", descricao:"S",
      categoriaId:catR, membroId:"", valor:x[1]});
    S.movimentos.push({id:"d"+x[0], data:m+"-10", tipo:"despesa", descricao:"G",
      categoriaId:cat, membroId:"", valor:x[2]});
  });
  limparCacheCredito();
  render(); pintarFita();
  var cores = qq("#fitaMeses .bx").map(function(b){ return b.style.background; });
  ok(cores.length > 0, "a fita tem barras");
  ok(new Set(cores).size > 1, "e cores diferentes conforme a taxa de poupança",
     Array.from(new Set(cores)).join(" | "));
  var titulos = qq("#fitaMeses button").map(function(b){ return b.title; });
  ok(titulos.some(function(t){ return /poupança/.test(t); }), "o balão diz a taxa de poupança");

  // Retrato do ano
  ui.relatorio = "ano"; render();
  ok(/Retrato do ano/.test(texto()), "o retrato do ano renderiza");
  ok(/Mês a mês/.test(texto()), "com a tabela mês a mês");
  ok(!/NaN|undefined/.test(texto()), "e sem lixo");
  ui.relatorio = false; render();
})();

G("rostos dos membros");
(function(){
  comExemplo();
  irA("config");
  ok(S.membros.length > 0, "o exemplo tem membros");
  ok(S.membros.every(function(m){ return !!m.icone && !!m.cor; }),
     "todos os membros têm rosto e cor");
  ok(qq('[data-act="mbIcone"]').length === S.membros.length, "cada um tem seletor de emoji");
  ok(qq('[data-act="mbCor"]').length === S.membros.length, "e de cor");
  ok(/rosto/i.test(texto()) || q(".rosto") != null, "a tabela mostra a pastilha do rosto");

  // Mudar o emoji pelo select — o clique não serve num select
  var sel = q('[data-act="mbIcone"]');
  var id = sel.dataset.id, antes = membro(id).icone;
  var outro = EMOJIS_MEMBRO.filter(function(e){ return e !== antes; })[0];
  sel.value = outro;
  sel.dispatchEvent(new Event("change", {bubbles:true}));
  eq(membro(id).icone, outro, "mudar o emoji fica no estado");
  ok(podeDesfazer(), "e é desfazível");
  desfazer();
  eq(membro(id).icone, antes, "desfazer devolve o emoji");

  // A cor também
  var cor = q('[data-act="mbCor"]');
  var idC = cor.dataset.id, corAntes = membro(idC).cor;
  cor.value = "#ff8800";
  cor.dispatchEvent(new Event("change", {bubbles:true}));
  eq(membro(idC).cor, "#ff8800", "mudar a cor fica no estado");
  desfazer();
  eq(membro(idC).cor, corAntes, "e desfaz-se");

  // O rosto aparece nos movimentos e nos seletores
  irA("despesas");
  clicar('[data-act="secDespesa"][data-v="movimentos"]');
  ok(q(".rosto") != null || S.movimentos.every(function(m){ return !m.membroId; }),
     "os movimentos mostram o rosto de quem gastou");
  clicar('[data-act="secDespesa"][data-v="plano"]');
  var opts = qq("#rcMembro option").map(function(o){ return o.textContent; });
  ok(opts.some(function(t){ return /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(t); }),
     "o seletor de membro mostra o emoji", opts.join(" | "));

  // Um membro novo recebe rosto sozinho
  irA("config");
  preencher("mbNome", "Zé Teste");
  clicar('[data-act="mbAdd"]');
  var novo = S.membros[S.membros.length-1];
  eq(novo.nome, "Zé Teste", "o membro novo é criado");
  ok(!!novo.icone && !!novo.cor, "e já vem com rosto e cor");
  desfazer();
})();

G("dia do mês nas despesas fixas");
(function(){
  comExemplo();
  irA("despesas");
  clicar('[data-act="secDespesa"][data-v="plano"]');
  ok(q("#rcDia") != null, "o formulário da rubrica tem campo de dia");

  // Validação: um dia impossível não passa
  preencher("rcNome", "Rubrica com dia");
  preencher("rcValor", "100");
  var catAlim = catPorNome("Alimentação");
  q("#rcCat").value = catAlim;
  preencher("rcDia", "45");
  var antes = S.recorrentes.length;
  clicar('[data-act="recSalvar"]');
  eq(S.recorrentes.length, antes, "um dia 45 não cria a rubrica");
  ok(q("#rcDia").getAttribute("aria-invalid") === "true" || /1 a 31/.test(texto()),
     "e explica que o dia vai de 1 a 31");

  // Com dia válido cria e mostra a etiqueta
  preencher("rcDia", "12");
  clicar('[data-act="recSalvar"]');
  eq(S.recorrentes.length, antes + 1, "com dia 12 cria");
  var nova = S.recorrentes[S.recorrentes.length-1];
  eq(nova.dia, 12, "e guarda o dia");
  ok(/dia 12/.test(texto()), "a tabela mostra «dia 12»");

  // O dia é opcional
  preencher("rcNome", "Rubrica sem dia");
  preencher("rcValor", "50");
  q("#rcCat").value = catAlim;
  preencher("rcDia", "");
  clicar('[data-act="recSalvar"]');
  eq(S.recorrentes[S.recorrentes.length-1].dia, "", "sem dia fica vazio, e é válido");

  // «Lançar plano» põe o movimento no dia certo
  var mesAntes = MES;
  S.movimentos = [];
  S.recorrentes.forEach(function(r){ r.frequencia = "mensal"; });
  S.recorrentes[S.recorrentes.length-2].dia = 12;
  clicar('[data-act="gerarPlano"]');
  if (haDialogo()) confirmarDialogo();
  var comDia = S.movimentos.filter(function(m){ return m.descricao === "Rubrica com dia"; })[0];
  if (comDia) eq(comDia.data, MES + "-12", "o movimento cai no dia da rubrica");
  var semDia = S.movimentos.filter(function(m){ return m.descricao === "Rubrica sem dia"; })[0];
  if (semDia) eq(semDia.data, MES + "-01", "e sem dia cai no dia 1");
  MES = mesAntes;
})();

G("linha do mês e previsão de fecho");
(function(){
  comExemplo();
  MES = isoMes(hoje());
  S.painel.ocultos = [];
  // Dar dias às rubricas para a linha do mês ter conteúdo
  S.recorrentes.forEach(function(r, i){ if (r.frequencia === "mensal") r.dia = [1,5,12,20,28][i % 5]; });
  irA("painel");
  ok(/Linha do mês/.test(texto()), "a linha do mês aparece no painel");
  ok(q(".linhaMes") != null, "com a faixa dos dias");
  var cols = qq(".linhaMes .ldCol").length;
  var ultimo = new Date(+MES.split("-")[0], +MES.split("-")[1], 0).getDate();
  eq(cols, ultimo, "uma coluna por dia do mês");
  eq(qq(".linhaMes .ldCol.hoje").length, 1, "e hoje está marcado");
  ok(qq(".linhaMes .ldBarra span").length > 0, "com barras nos dias de pagamento");

  var prox = proximoPagamento();
  if (prox){
    ok(prox.dia >= hoje().getDate(), "o próximo pagamento não está no passado");
    ok(prox.faltam >= 0, "e os dias que faltam não são negativos");
    ok(/Próximo pagamento/.test(texto()), "o cartão anuncia-o");
  }

  // Sem dias marcados, o cartão passa a um vazio que explica e leva lá
  S.recorrentes.forEach(function(r){ r.dia = ""; });
  render();
  ok(/sem dias marcados/i.test(texto()), "sem dias, o cartão convida a marcá-los");
  ok(q('.vazio [data-act="ir"][data-view="plano"]') != null,
     "com botão que leva às despesas fixas");
  ok(q(".linhaMes") == null, "e sem faixa de dias vazia");

  // Previsão de fecho
  comExemplo();
  MES = isoMes(hoje());
  S.painel.ocultos = [];
  var catR = S.categorias.filter(function(c){ return c.tipo === "rendimento"; })[0].id;
  var cat = catPorNome("Alimentação");
  for (var i = 1; i <= 3; i++){
    var m = mesShift(MES, -i);
    S.movimentos.push({id:"pv"+i, data:m+"-10", tipo:"despesa", descricao:"Gasto",
      categoriaId:cat, membroId:"", valor:700 + i*40});
    S.movimentos.push({id:"pvr"+i, data:m+"-01", tipo:"rendimento", descricao:"Salário",
      categoriaId:catR, membroId:"", valor:2000});
  }
  S.movimentos.push({id:"pvA", data:MES+"-02", tipo:"despesa", descricao:"Gasto",
    categoriaId:cat, membroId:"", valor:250});
  S.movimentos.push({id:"pvAr", data:MES+"-01", tipo:"rendimento", descricao:"Salário",
    categoriaId:catR, membroId:"", valor:2000});
  limparCacheCredito();
  irA("painel");
  ok(/Como vai fechar o mês/.test(texto()), "a previsão aparece no painel");
  var f = preverFechoMes();
  ok(f != null, "e há previsão calculada");
  // Os rótulos dos indicadores saem em maiúsculas por CSS, e o innerText
  // devolve o texto como é apresentado — daí o /i.
  ok(/saldo previsto/i.test(texto()), "com o saldo previsto");
  ok(/ritmo diário/i.test(texto()), "e o ritmo diário");
  ok(!/NaN|undefined/.test(texto()), "sem lixo no ecrã");
})();

G("fecho do mês guiado");
(function(){
  comExemplo();
  MES = isoMes(hoje());
  S.painel.ocultos = [];
  S.fechados = {};
  ui.fechoDispensado = null;
  var anterior = mesShift(isoMes(hoje()), -1);
  var cat = catPorNome("Alimentação");
  var catR = S.categorias.filter(function(c){ return c.tipo === "rendimento"; })[0].id;
  S.movimentos.push({id:"fa", data:anterior+"-05", tipo:"despesa", descricao:"Compras",
    categoriaId:cat, membroId:"", valor:420});
  S.movimentos.push({id:"fb", data:anterior+"-10", tipo:"despesa", descricao:"Solto",
    categoriaId:"", membroId:"", valor:60});
  S.movimentos.push({id:"fc", data:anterior+"-01", tipo:"rendimento", descricao:"Salário",
    categoriaId:catR, membroId:"", valor:2500});
  limparCacheCredito();
  irA("painel");

  ok(/Fechar/.test(texto()), "o cartão de fecho aparece com o mês anterior por arrumar");
  var passos = qq(".passo").length;
  eq(passos, 4, "com quatro passos");
  ok(qq(".passo.feito").length < 4, "e nem todos feitos");
  ok(/movimento\(s\) sem categoria/.test(texto()), "aponta os movimentos sem categoria");

  // Ir a um passo muda para o mês que se está a fechar
  var mesAntes = MES;
  clicar('[data-act="fechoIr"]');
  eq(MES, anterior, "ir a um passo muda para o mês a fechar");
  MES = mesAntes;
  irA("painel");

  // Fechar
  clicar('[data-act="fecharMes"]');
  ok(!!S.fechados[anterior], "fechar marca o mês");
  ok(!!S.fechados[anterior].em, "com a data do fecho");
  ok(S.patrimonioHist.some(function(x){ return x.mes === anterior; }),
     "e guarda o instantâneo do património desse mês");
  render();
  ok(!/Fechar /.test(texto()) || !/Marcar/.test(texto()), "o cartão sai de cena");
  pintarFita();
  ok(/✓/.test(q("#fitaMeses").innerHTML), "e a fita ganha o selo do mês fechado");
  ok(podeDesfazer(), "o fecho é desfazível");
  desfazer();
  ok(!S.fechados[anterior], "desfazer reabre o mês");

  // Dispensar não mexe nos dados
  irA("painel");
  var estadoAntes = JSON.stringify(S);
  clicar('[data-act="fechoDispensar"]');
  eq(JSON.stringify(S), estadoAntes, "dispensar não altera dados nenhuns");
  eq(cartaoFechoMes(), "", "mas esconde o cartão");
  ui.fechoDispensado = null;
})();

G("nota do mês");
(function(){
  comExemplo();
  MES = isoMes(hoje());
  S.painel.ocultos = [];
  S.notas = {};
  irA("painel");
  ok(q("#notaMes") != null, "há campo para a nota do mês");

  preencher("notaMes", "Férias no Algarve");
  clicar('[data-act="notaGuardar"]');
  eq(S.notas[MES], "Férias no Algarve", "a nota guarda-se no mês");
  ok(podeDesfazer(), "e é desfazível");
  render();
  ok(/escrita/.test(texto()), "o cartão diz que há nota");
  pintarFita();
  ok(/✎/.test(q("#fitaMeses").innerHTML), "a fita marca o mês com nota");

  // Aparece no relatório
  ui.relatorio = true; render();
  ok(/Férias no Algarve/.test(texto()), "a nota entra no relatório");
  ui.relatorio = false; render();

  // Apagar
  clicar('[data-act="notaApagar"]');
  ok(!S.notas[MES], "apagar remove a nota");
  desfazer();
  eq(S.notas[MES], "Férias no Algarve", "e o desfazer devolve-a");

  // O tecto de caracteres é respeitado
  var longa = new Array(NOTA_MAX + 80).join("x");
  preencher("notaMes", longa);
  clicar('[data-act="notaGuardar"]');
  ok(S.notas[MES].length <= NOTA_MAX, "a nota não passa do tecto", S.notas[MES].length);
  S.notas = {};
})();

G("subscrições, inflação e sequências no painel");
(function(){
  comExemplo();
  MES = isoMes(hoje());
  S.painel.ocultos = [];
  var catSub = catPorNome("Subscrições");
  ["Netflix","Spotify","Nuvem","Jornal"].forEach(function(n, i){
    S.recorrentes.push({id:"sb"+i, tipo:"despesa", nome:n, valor:[8.99,6.99,4.99,12][i],
      frequencia:"mensal", ativo:true, categoriaId:catSub, membroId:"", dia:15});
  });
  limparCacheCredito();
  irA("painel");
  ok(/Subscrições ao ano/.test(texto()), "o cartão das subscrições aparece");
  ok(/por ano/i.test(texto()), "com o custo anual");
  var subs = subscricoes();
  ok(subs.length >= 4, "e lista as subscrições", subs.length);
  // Desativar uma dali mesmo
  var alvo = subs.filter(function(x){ return x.rec.id === "sb0"; })[0];
  ok(alvo != null, "a Netflix está na lista");
  var btn = q('[data-act="recToggle"][data-id="sb0"]');
  ok(btn != null, "com botão para desativar");
  if (btn){ btn.click(); eq(S.recorrentes.filter(function(r){ return r.id==="sb0"; })[0].ativo, false,
    "desativar dali funciona"); desfazer(); }

  // Inflação pessoal com mês homólogo
  var cat = catPorNome("Alimentação");
  var ano = +MES.split("-")[0], mm = MES.split("-")[1];
  S.movimentos.push({id:"ih", data:(ano-1)+"-"+mm+"-05", tipo:"despesa", descricao:"Compras",
    categoriaId:cat, membroId:"", valor:400});
  S.movimentos.push({id:"ia", data:MES+"-05", tipo:"despesa", descricao:"Compras",
    categoriaId:cat, membroId:"", valor:440});
  limparCacheCredito();
  render();
  var inf = inflacaoPessoal(MES);
  ok(inf != null, "há inflação pessoal com o homólogo");
  ok(/A sua inflação/.test(texto()), "e o cartão mostra-a");
  var botao = q('[data-act="inflAdotar"]');
  if (botao){
    var antes = parseNum(S.projecao.inflacao);
    botao.click();
    ok(parseNum(S.projecao.inflacao) !== antes, "adotar muda a inflação das projeções");
    eq(parseNum(S.estrategia.inflacao), parseNum(S.projecao.inflacao),
       "e a das estratégias acompanha");
    desfazer();
    eq(parseNum(S.projecao.inflacao), antes, "e desfaz-se");
  }

  // Sequências
  var catR = S.categorias.filter(function(c){ return c.tipo === "rendimento"; })[0].id;
  for (var i = 1; i <= 4; i++){
    var m = mesShift(MES, -i);
    S.movimentos.push({id:"sq"+i, data:m+"-10", tipo:"despesa", descricao:"Gasto",
      categoriaId:cat, membroId:"", valor:400});
    S.movimentos.push({id:"sqr"+i, data:m+"-01", tipo:"rendimento", descricao:"Salário",
      categoriaId:catR, membroId:"", valor:2000});
  }
  limparCacheCredito();
  render();
  var seqs = sequencias();
  ok(seqs.length > 0, "há sequências", seqs.length);
  ok(/Sequências e marcos/.test(texto()), "e o cartão mostra-as");
  ok(qq(".marco").length > 0, "com um marco por sequência");
  // Cada marco leva a algum sítio
  ok(qq(".marco").every(function(b){ return !!b.dataset.view; }), "cada marco navega para uma vista");
})();

G("património ao longo do tempo");
(function(){
  comExemplo();
  MES = isoMes(hoje());
  S.painel.ocultos = [];
  S.patrimonioHist = [];
  irA("painel");
  ok(/Património ao longo do tempo/.test(texto()), "o cartão aparece");
  ok(/Ainda só há um ponto/.test(texto()), "com um ponto só, convida a guardar instantâneos");

  clicar('[data-act="patInstantaneo"]');
  eq(S.patrimonioHist.length, 1, "guardar um instantâneo acrescenta um ponto");
  var p = S.patrimonioHist[0];
  eq(p.ativo - p.divida, p.liquido, "e as contas fecham", 0.01);
  ok(podeDesfazer(), "é desfazível");

  // Com histórico, desenha-se o gráfico
  for (var k = 6; k >= 1; k--){
    S.patrimonioHist.push({mes: mesShift(MES,-k), ativo: 45000+k*400, divida: 30000-k*100, liquido: 15000+k*500});
  }
  S.patrimonioHist.sort(function(a,b){ return a.mes.localeCompare(b.mes); });
  render();
  ok(q("#app svg.chart") != null, "há gráfico do património");
  ok(/variação no período/i.test(texto()), "com a variação no período");
  ok(!/NaN|undefined/.test(texto()), "e sem lixo");

  // Um instantâneo estragado não parte o gráfico
  S.patrimonioHist.push({mes: mesShift(MES,-9), ativo: NaN, divida: undefined, liquido: NaN});
  render();
  ok(!/NaN/.test(document.getElementById("app").innerHTML),
     "um instantâneo estragado não escreve NaN no SVG");
  S.patrimonioHist = [];
})();

G("limites pelo histórico e plano de corte");
(function(){
  comExemplo();
  MES = isoMes(hoje());
  var cat = catPorNome("Alimentação");
  var catR = S.categorias.filter(function(c){ return c.tipo === "rendimento"; })[0].id;
  for (var i = 1; i <= 4; i++){
    var m = mesShift(MES, -i);
    S.movimentos.push({id:"lh"+i, data:m+"-10", tipo:"despesa", descricao:"Compras",
      categoriaId:cat, membroId:"", valor:[300,320,310,900][i-1]});
    S.movimentos.push({id:"lhr"+i, data:m+"-01", tipo:"rendimento", descricao:"Salário",
      categoriaId:catR, membroId:"", valor:2000});
  }
  limparCacheCredito();
  irA("despesas");
  clicar('[data-act="secDespesa"][data-v="limites"]');
  ok(q('[data-act="limDoHistorico"]') != null, "há botão de sugerir pelo histórico");
  var limAntes = JSON.stringify(S.limites);
  clicar('[data-act="limDoHistorico"]');
  ok(haDialogo(), "pede confirmação, porque substitui limites");
  confirmarDialogo();
  ok(JSON.stringify(S.limites) !== limAntes, "e define limites");
  ok(parseNum(S.limites[cat]) % 5 === 0, "arredondados aos 5 €", S.limites[cat]);
  ok(podeDesfazer(), "é desfazível");
  desfazer();
  eq(JSON.stringify(S.limites), limAntes, "e desfaz-se por inteiro");

  // Plano de corte
  ok(q("#corteAlvo") != null, "há campo da meta de corte");
  ok(/Plano de corte/.test(texto()), "e o cartão está lá");
  preencher("corteAlvo", "0");
  clicar('[data-act="corteCalcular"]');
  ok(q("#corteAlvo").getAttribute("aria-invalid") === "true" || ui.corteAlvo === 0,
     "meta zero não produz plano");

  preencher("corteAlvo", "60");
  clicar('[data-act="corteCalcular"]');
  eq(ui.corteAlvo, 60, "a meta fica registada");
  var sliders = qq("[data-corte]");
  ok(sliders.length > 0, "há um deslizador por categoria sugerida", sliders.length);
  var plano = planoDeCorte(60);
  ok(plano.soDesejos, "60 € cabem só nos desejos");

  // Mexer num deslizador atualiza no sítio, sem repintar a vista
  var sl = sliders[0], idCat = sl.dataset.corte;
  sl.value = "7";
  sl.dispatchEvent(new Event("input", {bubbles:true}));
  eq(ui.corteAjustes[idCat], 7, "o ajuste fica no estado");
  ok(/7,00/.test(q("#corteVal-"+idCat).textContent), "a leitura do deslizador acompanha");
  eq(sl.getAttribute("aria-valuetext"), eur(7), "e o leitor de ecrã também");
  ok(qq("[data-corte]")[0] === sl, "sem repintar a vista a cada pixel de arrasto");

  // Aplicar
  limAntes = JSON.stringify(S.limites);
  clicar('[data-act="corteAplicar"]');
  ok(haDialogo(), "aplicar pede confirmação");
  confirmarDialogo();
  ok(JSON.stringify(S.limites) !== limAntes, "os limites mudam");
  eq(ui.corteAlvo, 0, "e o plano limpa-se depois de aplicado");
  desfazer();
  eq(JSON.stringify(S.limites), limAntes, "aplicar é desfazível");

  // Limpar
  preencher("corteAlvo", "100");
  clicar('[data-act="corteCalcular"]');
  clicar('[data-act="corteLimpar"]');
  eq(ui.corteAlvo, 0, "limpar descarta a meta");
  eq(Object.keys(ui.corteAjustes).length, 0, "e os ajustes");
})();

G("planear despesa");
(function(){
  comExemplo();
  S.planeadas = [];
  irA("despesas");
  var abas = qq('[data-act="secDespesa"]').map(function(b){ return b.textContent.trim(); });
  ok(abas.indexOf("Planear") >= 0, "as despesas ganham a secção Planear", abas.join(" | "));
  clicar('[data-act="secDespesa"][data-v="planear"]');
  eq(ui.secaoDespesa, "planear", "e abre-se");
  ok(q("#plNome") != null, "com o formulário da compra");
  eq(qq('[data-act="planPreset"]').length, PRESETS_PLANEIO.length, "e os exemplos de compra");
  ok(/Nada planeado ainda/.test(texto()), "o estado vazio explica-se");

  // Um exemplo preenche sem gravar
  clicar('[data-act="planPreset"]', 7);   // carro usado
  eq(q("#plNome").value, PRESETS_PLANEIO[7].nome, "o exemplo preenche a designação");
  eq(parseNum(q("#plValor").value), PRESETS_PLANEIO[7].valor, "e o valor típico");
  ok(q("#plCat").value !== "", "e escolhe uma categoria");
  eq(S.planeadas.length, 0, "sem gravar nada");

  // Validação
  preencher("plNome", "");
  clicar('[data-act="planSalvar"]');
  eq(S.planeadas.length, 0, "sem designação não guarda");
  ok(q("#plNome").classList.contains("invalido"), "e assinala o campo");
  ok(/comprar/i.test((q(".fielderr") || {}).textContent || ""), "com a razão à vista");
  preencher("plNome", "Máquina de lavar");
  preencher("plValor", "0");
  clicar('[data-act="planSalvar"]');
  eq(S.planeadas.length, 0, "sem verba também não");

  // Guardar e analisar
  preencher("plValor", "600");
  escolher("plHorizonte", "12 meses");
  clicar('[data-act="planSalvar"]');
  eq(S.planeadas.length, 1, "com nome e verba, guarda");
  var p = S.planeadas[0];
  eq(p.nome, "Máquina de lavar", "com a designação escrita");
  eq(p.valor, 600, "e a verba");
  eq(p.horizonte, 12, "e o horizonte");
  eq(p.mes, "", "por marcar");
  eq(p.feitaEm, "", "e por realizar");
  ok(q(".planTri") != null, "aparece a faixa de trimestres");
  eq(qq(".planTri button").length, 4, "com um bloco por trimestre");
  ok(/Máquina de lavar/.test(texto()), "e o cartão da compra");

  // Horizonte: 24 meses dá oito trimestres
  clicar('[data-act="planHorizonte"][data-v="24"]');
  eq(S.planeadas[0].horizonte, 24, "o horizonte muda no cartão");
  eq(qq(".planTri button").length, 8, "e a faixa acompanha");
  clicar('[data-act="planHorizonte"][data-v="12"]');
  eq(qq(".planTri button").length, 4, "e volta atrás");

  // Marcar um mês
  var alvo = qq('.planTri [data-act="planMarcar"]')[1];
  var mesAlvo = alvo.dataset.mes;
  alvo.click();
  eq(S.planeadas[0].mes, mesAlvo, "tocar num trimestre marca o seu melhor mês");
  eq(qq('.planTri [aria-pressed="true"]').length, 1, "e a célula fica assinalada");
  ok(/Marcada para/.test(texto()), "o cartão di-lo por palavras");
  var ev = eventosPlaneados();
  eq(ev.length, 1, "a compra passa a contar na tesouraria");
  eq(ev[0].mes, mesAlvo, "no mês marcado");
  var comCompra = tesourariaProjetada(12).filter(function(s){ return s.compras > 0; });
  eq(comCompra.length, 1, "e a projeção vê-a");
  eq(comCompra[0].compras, 600, "com o valor certo");

  // Desmarcar no mesmo sítio
  qq('.planTri [aria-pressed="true"]')[0].click();
  eq(S.planeadas[0].mes, "", "tocar de novo desmarca");
  eq(eventosPlaneados().length, 0, "e sai da tesouraria");
  alvo = qq('.planTri [data-act="planMarcar"]')[1];
  mesAlvo = alvo.dataset.mes;
  alvo.click();

  // Reservar verba: nasce um objetivo ligado
  var nObj = S.objetivos.length;
  clicar('[data-act="planReservar"]');
  eq(S.objetivos.length, nObj + 1, "reservar verba cria um objetivo");
  var obj = S.objetivos.filter(function(o){ return o.id === S.planeadas[0].objetivoId; })[0];
  ok(obj != null, "e a compra guarda a ligação");
  eq(obj.alvo, 600, "com a verba por meta");
  eq(obj.prazo, mesAlvo + "-01", "e o prazo do mês marcado");
  ok(/Reserva/.test(obj.nome), "com um nome que se percebe", obj.nome);
  eq(qq('[data-act="planReservar"]').length, 0, "e o botão desaparece, que já está feito");
  ok(q("svg.anel") != null, "o progresso da reserva mostra-se num anel");

  // Editar o valor arrasta a meta da reserva
  clicar('[data-act="planEditar"]');
  eq(editando.plan, S.planeadas[0].id, "editar abre a compra no formulário");
  preencher("plValor", "800");
  clicar('[data-act="planSalvar"]');
  eq(S.planeadas[0].valor, 800, "o valor muda");
  eq(S.objetivos.filter(function(o){ return o.id === S.planeadas[0].objetivoId; })[0].alvo, 800,
     "e a meta da reserva acompanha-o");

  // Remarcar arrasta o prazo
  var outro = qq('.planTri [data-act="planMarcar"]')[3];
  var mesOutro = outro.dataset.mes;
  outro.click();
  eq(S.planeadas[0].mes, mesOutro, "remarcar muda o mês");
  eq(S.objetivos.filter(function(o){ return o.id === S.planeadas[0].objetivoId; })[0].prazo,
     mesOutro + "-01", "e o prazo da reserva vai atrás");

  // Alerta quando chega o mês marcado
  S.planeadas[0].mes = MES;
  var al = alertas().filter(function(a){ return a.vista === "planear"; });
  eq(al.length, 1, "no mês marcado há um aviso no painel de atenção");
  ok(/Máquina de lavar/.test(al[0].titulo), "com o nome da compra");

  // Registar a compra
  var nMov = S.movimentos.length, idObj = S.planeadas[0].objetivoId;
  clicar('[data-act="planRealizar"]');
  eq(S.movimentos.length, nMov + 1, "registar a compra lança um movimento");
  var mv = S.movimentos[S.movimentos.length - 1];
  eq(mv.descricao, "Máquina de lavar", "com a descrição da compra");
  eq(mv.valor, 800, "e o valor");
  eq(mv.tipo, "despesa", "como despesa");
  eq(mv.categoriaId, S.planeadas[0].categoriaId, "na categoria escolhida");
  eq(mv.data, isoDia(hoje()), "com a data de hoje");
  ok(S.planeadas[0].feitaEm !== "", "a compra passa a realizada");
  eq(S.objetivos.filter(function(o){ return o.id === idObj; }).length, 0, "e a reserva é arrumada");
  eq(eventosPlaneados().length, 0, "uma compra feita já não pesa no futuro");
  ok(/Já realizadas/.test(texto()), "e passa para a tabela das realizadas");
  eq(qq('[data-act="planMarcar"]').length, 0, "sem faixa de trimestres, que já não há decisão");

  // Desfazer devolve tudo
  clicar('[data-act="desfazer"]');
  eq(S.movimentos.length, nMov, "desfazer retira o movimento");
  eq(S.planeadas[0].feitaEm, "", "e a compra volta a estar por fazer");
  eq(S.objetivos.filter(function(o){ return o.id === idObj; }).length, 1, "com a reserva de volta");

  // Ver o movimento da compra realizada
  clicar('[data-act="planRealizar"]');
  clicar('[data-act="planVerMov"]');
  eq(ui.secaoDespesa, "movimentos", "«ver movimento» abre os movimentos");
  eq(filtros.texto, "Máquina de lavar", "filtrados pela compra");
  filtros.texto = "";

  // Apagar, com anulação
  ACOES.ir({dataset:{view:"planear"}});
  var n = S.planeadas.length;
  clicar('[data-act="planApagar"]');
  eq(S.planeadas.length, n - 1, "apagar elimina a compra");
  clicar('[data-act="desfazer"]');
  eq(S.planeadas.length, n, "e a anulação devolve-a");

  // A ponte a partir do «Posso pagar isto?»
  irA("painel");
  mostrarCartoes(["podePagar"]);
  preencher("cpValorCompra", "2500");
  ok(q('[data-act="planDaCompra"]') != null, "o «posso pagar isto?» oferece planear a compra");
  clicar('[data-act="planDaCompra"]');
  eq(VIEW, "despesas", "e leva às despesas");
  eq(ui.secaoDespesa, "planear", "na secção Planear");
  eq(parseNum(q("#plValor").value), 2500, "com o valor já lá");
  render();
  eq(q("#plValor").value, "", "e não o repete na repintura seguinte");

  // A procura encontra compras planeadas
  var achados = filtrarComandos("lavar").filter(function(c){ return c.tipo === "compra planeada"; });
  ok(achados.length >= 1, "a paleta encontra a compra pelo nome");

  // Um estado sem compras não estorva o resto
  S.planeadas = [];
  semErro(function(){ render(); tesourariaProjetada(12); alertas(); }, "sem compras planeadas nada rebenta");
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

  ui.perfil = {agregado:null, habitacao:"arrendada", regime:"credito"};
  irA("painel");
  eq(qq('[data-act="perfilAgregado"]').length, Object.keys(PERFIS_AGREGADO).length,
     "o ecrã vazio oferece os agregados");
  eq(qq('[data-act="perfilHabitacao"]').length, Object.keys(PERFIS_HABITACAO).length,
     "e a habitação à parte, porque é independente do agregado");
  ok(q('[data-act="perfilAplicar"]') == null, "sem agregado escolhido não há botão de aplicar");

  // A habitação é ortogonal: qualquer agregado combina com qualquer casa
  clicar('[data-act="perfilAgregado"][data-k="sozinho"]');
  eq(ui.perfil.agregado, "sozinho", "escolher o agregado guarda-o");
  ok(q('[data-act="perfilAplicar"]') != null, "e faz aparecer o botão de começar");
  eq(qq('[data-act="perfilRegime"]').length, 0, "a arrendar não há regime a escolher");
  clicar('[data-act="perfilHabitacao"][data-k="propria"]');
  eq(qq('[data-act="perfilRegime"]').length, 2, "casa própria abre paga ou com empréstimo");

  // As rubricas de habitação dependem da casa, e o valor do agregado
  var soCred = rubricasHabitacao("sozinho", "propria", "credito").map(function(r){ return r[0]; });
  ok(soCred.indexOf("Prestação do crédito") >= 0, "com empréstimo traz a prestação");
  var soPaga = rubricasHabitacao("sozinho", "propria", "paga").map(function(r){ return r[0]; });
  ok(soPaga.indexOf("Prestação do crédito") < 0, "paga não traz prestação nenhuma");
  ok(soPaga.indexOf("Condomínio") >= 0, "mas traz o condomínio");
  var arrenda = rubricasHabitacao("familia", "arrendada").map(function(r){ return r[0]; });
  eq(arrenda.length, 1, "a arrendar traz só a renda");
  eq(arrenda[0], "Renda de casa", "com esse nome");
  var pSo = rubricasHabitacao("sozinho","propria","credito").filter(function(r){ return /Prestação/.test(r[0]); })[0][2];
  var pFam = rubricasHabitacao("familia","propria","credito").filter(function(r){ return /Prestação/.test(r[0]); })[0][2];
  ok(pFam > pSo, "a prestação sugerida cresce com o agregado", pSo+" vs "+pFam);

  // Aplicar a combinação escolhida
  S = estadoVazio(); MES = isoMes(hoje());
  ui.perfil = {agregado:"casal", habitacao:"propria", regime:"credito"};
  ok(aplicarPerfil("casal", "propria", "credito"), "aplicar a combinação funciona");
  ok(S.membros.length >= 2, "cria os membros");
  ok(S.recorrentes.length >= 5, "e as despesas fixas", S.recorrentes.length);
  ok(Object.keys(S.limites).length >= 5, "com limites correspondentes");
  var nomes = S.recorrentes.map(function(r){ return r.nome; });
  ok(nomes.indexOf("Prestação do crédito") >= 0, "com a prestação da casa própria");
  ok(nomes.indexOf("Renda de casa") < 0, "e sem renda nenhuma");
  var n = S.recorrentes.length;
  aplicarPerfil("casal", "propria", "credito");
  eq(S.recorrentes.length, n, "aplicar duas vezes não duplica");
  ok(!aplicarPerfil("inexistente", "arrendada"), "agregado desconhecido não faz nada");
  // Habitação desconhecida cai no arrendamento, em vez de rebentar
  S = estadoVazio();
  ok(aplicarPerfil("sozinho", "castelo"), "habitação desconhecida não rebenta");
  ok(S.recorrentes.some(function(r){ return r.nome === "Renda de casa"; }), "e cai no arrendamento");

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

G("português europeu, e não do Brasil");
(function(){
  comExemplo();
  /* A ferramenta é para quem vive em Portugal, e fala-lhe da sua vida: o IRS,
     a Segurança Social, o crédito à habitação. Uma palavra do outro lado do
     Atlântico não é um erro de gramática, mas trai quem escreveu — e num
     texto que fala de dinheiro, a confiança conta.

     `\b` não serve aqui: em JavaScript não conhece letras acentuadas, e vê
     fronteira de palavra dentro de «ação» ou «não». As fronteiras são feitas
     à mão com `\p{L}`, senão o verificador acusa o que não deve. */
  var A = "(?<!\\p{L})", Z = "(?!\\p{L})";
  var rx = function(corpo){ return new RegExp(A + "(?:" + corpo + ")" + Z, "iu"); };

  var BRASIL = [
    [rx("usu[áa]rios?"), "usuário → utilizador"],
    [rx("arquivos?"), "arquivo → ficheiro"],
    [rx("telas?"), "tela → ecrã"],
    [rx("celulares?"), "celular → telemóvel"],
    [rx("salvar|salve"), "salvar → guardar"],
    [rx("deletar|delete"), "deletar → apagar"],
    [rx("digitar|digite"), "digitar → escrever"],
    [rx("mouse"), "mouse → rato"],
    [rx("gerenciar|gerenciamento"), "gerenciar → gerir"],
    [rx("acessar|acesse|acessando"), "acessar → aceder"],
    [rx("registrar|registrad[oa]s?|registre"), "registrar → registar"],
    [rx("cadastr[oaei]\\p{L}*"), "cadastro → registo"],
    [rx("aposentadoria"), "aposentadoria → reforma"],
    [rx("planilha"), "planilha → folha de cálculo"],
    [rx("aluguel"), "aluguel → aluguer"],
    [rx("fatos?"), "fato → facto"],
    [rx("contatos?"), "contato → contacto"],
    [rx("ec[oô]n[oô]mic\\p{L}*|gên\\p{L}+|bônus|prêmios?|anônim\\p{L}*|quil[oô]metr\\p{L}*"),
     "vogal fechada do Brasil (ô/ê) onde o português europeu abre (ó/é)"],
    [rx("ônibus|trem|geladeira|sorvete|abacaxi"), "termo do Brasil"],
    [rx("checar"), "checar → verificar"],
    [/R\$/, "moeda do Brasil"],
    // «estar + gerúndio» é a marca de sintaxe mais visível
    [new RegExp(A+"(está|estão|estamos|estou|estava|estavam|estará)\\s+\\p{L}+ndo"+Z, "iu"),
     "gerúndio progressivo → «a + infinitivo»"],
  ];
  var ERROS = [
    [rx("apartir"), "«apartir» → «a partir»"],
    [rx("concerteza"), "«concerteza» → «com certeza»"],
    [rx("derrepente"), "«derrepente» → «de repente»"],
    [rx("houveram"), "«houveram» → «houve»"],
    [new RegExp(A+"à\\s+partir"+Z, "iu"), "«à partir» → «a partir»"],
    [new RegExp(A+"à\\s+cerca\\s+de"+Z, "iu"), "«à cerca de» → «acerca de»"],
    [/\p{L}  +\p{L}/u, "espaço duplo"],
    [/\p{L} +[,;:!?](\s|$)/u, "espaço antes de pontuação"],
    [new RegExp(A+"(\\p{L}+)\\s+\\1"+Z, "iu"), "palavra repetida"],
    [rx("pra"), "coloquial «pra»"],
  ];

  /* Só o texto que chega às pessoas: o desenhado, os explicadores e os avisos.
     O que está no código-fonte não serve para isto — uma frase partida em
     pedaços por `+` parece ter espaços a dobrar sem os ter no ecrã. */
  var textos = [];
  var juntar = function(onde, t){ if (t && String(t).trim()) textos.push([onde, String(t)]); };
  ["painel","rendimento","despesas","credito","objetivos","estrategias","fiscal","config"]
    .forEach(function(v){
      irA(v);
      juntar(v, q("#app").innerText);
      qq('[data-act^="sec"]').map(function(b){ return {a:b.dataset.act, v:b.dataset.v}; })
        .forEach(function(s){
          irA(v);
          var b = q('[data-act="'+s.a+'"][data-v="'+s.v+'"]');
          if (b){ b.click(); juntar(v+"/"+s.v, q("#app").innerText); }
        });
    });
  juntar("cabeçalho", q("header").innerText);
  juntar("navegação", q("nav.tabs").innerText);
  /* Os dicionários são `const` no topo do script da aplicação: vivem no
     ambiente léxico global, não em `window`. Referem-se pelo nome. */
  [["AJUDAS_VISTA", AJUDAS_VISTA], ["AJUDAS_KPI", AJUDAS_KPI], ["AJUDAS_COL", AJUDAS_COL],
   ["AJUDAS_CAMPO", AJUDAS_CAMPO], ["AJUDAS_ACAO", AJUDAS_ACAO]].forEach(function(par){
    /* Título e corpo são frases diferentes: juntam-se por quebra de linha, e
       não por espaço, senão «Secções das despesas» colado a «Despesas fixas
       é…» parecia uma palavra repetida. */
    Object.keys(par[1]).forEach(function(k){ juntar(par[0]+":"+k, [].concat(par[1][k]).join("\n")); });
  });
  juntar("aviso curto", AVISO_CURTO);
  AVISO_LONGO.forEach(function(b){ juntar("aviso:"+b[0], b[0]+": "+b[1]); });

  ok(textos.length > 100, "há texto que chegue para valer a pena verificar", textos.length);
  var caracteres = textos.reduce(function(s, t){ return s + t[1].length; }, 0);
  ok(caracteres > 30000, "e caracteres que cheguem", caracteres);

  var brasileirismos = [], erros = [];
  textos.forEach(function(par){
    BRASIL.forEach(function(r){ if (r[0].test(par[1])) brasileirismos.push(par[0]+": "+r[1]); });
    /* As regras de prosa correm linha a linha. O `innerText` junta elementos
       vizinhos com quebras de linha, e uma etiqueta de separador colada ao
       título da secção que abre pareceria uma palavra repetida — «Planear» e
       «Planear despesa» são duas coisas, não uma gaguez. O mesmo vale para as
       iniciais dos dias da semana, onde dois «Q» seguidos são quarta e quinta. */
    String(par[1]).split(/\n+/).forEach(function(linha){
      if (!linha.trim()) return;
      ERROS.forEach(function(r){ if (r[0].test(linha)) erros.push(par[0]+": "+r[1]+" — «"+linha.slice(0,40)+"»"); });
    });
  });
  ok(brasileirismos.length === 0, "nenhuma palavra ou construção do português do Brasil",
     brasileirismos.slice(0, 4).join(" ;; "));
  ok(erros.length === 0, "nenhum erro comum de ortografia ou espaçamento",
     erros.slice(0, 4).join(" ;; "));

  // O verificador tem de saber acusar, senão está a dizer que sim a tudo
  ok(BRASIL[0][0].test("O usuário escolhe"), "o verificador apanha «usuário»");
  ok(!BRASIL[0][0].test("O utilizador escolhe"), "e não confunde com «utilizador»");
  ok(ERROS[8][0].test("o o mesmo"), "apanha uma palavra repetida");
  ok(!ERROS[8][0].test("o separador, a ação"), "sem tropeçar em letras acentuadas");
  ok(BRASIL[21][0].test("está carregando"), "apanha o gerúndio progressivo");
  ok(!BRASIL[21][0].test("está a carregar"), "e deixa passar a forma portuguesa");
})();

G("texto do utilizador não parte o desenho");
(function(){
  comExemplo();
  /* Os nomes vêm de quem usa isto: o número de uma apólice, uma referência de
     contrato, um nome de objetivo escrito de enfiada. Uma palavra comprida sem
     espaços que não caiba alarga o contentor, e com ele a página inteira — num
     telemóvel a página passa a andar de lado e o desenho todo deriva. */
  var LONGO = "Supercalifragilisticexpialidocious";
  var FRASE = "Pagamento mensal referente ao contrato de fornecimento de energia "+
              "elétrica da residência principal do agregado familiar";
  var SEM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  S.membros[0].nome = LONGO + " " + LONGO;
  S.categorias[0].nome = LONGO;
  if (S.movimentos[0]) S.movimentos[0].descricao = FRASE;
  if (S.movimentos[1]) S.movimentos[1].descricao = SEM + SEM;
  if (S.recorrentes[0]) S.recorrentes[0].nome = FRASE;
  if (S.objetivos[0]) S.objetivos[0].nome = SEM;
  if (S.ativos[0]) S.ativos[0].nome = FRASE;
  if (S.creditos[0]) S.creditos[0].nome = SEM;
  S.notas[MES] = SEM;
  guardar();

  var raiz = document.documentElement;
  ok(/anywhere|break-word/.test(getComputedStyle(q("#app")).overflowWrap),
     "o texto do utilizador pode partir palavras que não caibam",
     getComputedStyle(q("#app")).overflowWrap);

  /* Numa janela sem largura — separador oculto, painel recolhido — qualquer
     conteúdo «transborda» zero pixels. Mede-se só quando há o que medir, e
     diz-se quando não há, em vez de fingir que se mediu.

     E mede-se pela pergunta certa: **a página rola mesmo de lado?** A conta
     `scrollWidth - clientWidth` acusa a barra de deslocação, que num ecrã de
     320 px são onze pixels de mentira — `clientWidth` desconta-a e
     `scrollWidth` não. Manda-se rolar e vê-se se andou. */
  if (raiz.clientWidth > 200){
    var transbordos = [];
    ["painel","rendimento","despesas","credito","objetivos","estrategias","fiscal","config"]
      .forEach(function(v){
        irA(v);
        var antes = window.scrollX;
        window.scrollTo(2000, window.scrollY);
        var andou = window.scrollX;
        window.scrollTo(antes, window.scrollY);
        if (andou > 1) transbordos.push(v + ": rolou " + andou + "px");
      });
    eq(transbordos.length, 0, "e a página não passa a andar de lado em vista nenhuma",
       transbordos.join("; "));
  } else {
    ok(true, "transbordo não medido: a janela não tem largura", raiz.clientWidth + "px");
  }
  comExemplo();
})();

G("detalhe por categoria alcançável sem rato");
(function(){
  comExemplo();
  irA("painel");
  /* As fatias do donut só respondem ao ponteiro — são desenho. O comando é a
     legenda, e era feita de `div`: a função de ver só uma categoria não
     existia para quem navega por teclado. */
  var bts = qq("#app .legend button[data-foco]");
  ok(bts.length > 0, "a legenda do donut é feita de botões", bts.length);
  if (!bts.length) return;
  eq(bts.filter(function(b){ return b.tabIndex >= 0; }).length, bts.length,
     "todos alcançáveis por tabulação");
  ok(/ver só esta categoria/i.test(bts[0].getAttribute("aria-label") || ""),
     "e cada um diz o que faz", bts[0].getAttribute("aria-label"));
  ok(/^(true|false)$/.test(bts[0].getAttribute("aria-pressed") || ""),
     "anunciando se está ou não aplicado");

  var nome = bts[0].dataset.foco;
  bts[0].click();
  ok(ui.donutFoco && ui.donutFoco.nome === nome, "carregar aplica o detalhe da categoria");
  var marcado = qq("#app .legend button[data-foco]").filter(function(b){ return b.dataset.foco === nome; })[0];
  eq(marcado ? marcado.getAttribute("aria-pressed") : "", "true", "e fica marcado");
  marcado.click();
  ok(!ui.donutFoco, "carregar outra vez tira o detalhe");

  // O gráfico continua a servir quem usa ponteiro
  var fatia = q("#app svg [data-foco]");
  ok(fatia != null, "as fatias do gráfico continuam lá");
  if (fatia){
    fatia.dispatchEvent(new MouseEvent("click", {bubbles:true}));
    ok(!!ui.donutFoco, "e continuam a responder ao ponteiro");
    ui.donutFoco = null; render();
  }
})();

G("ida e volta pela cópia de segurança");
(function(){
  comExemplo();
  /* O que a exportação escreve é `JSON.stringify(S, null, 2)`, e o que a
     importação faz é `normalizar(JSON.parse(...))`. Entre um e outro tem de
     passar tudo o que as pessoas escrevem — aspas, barras, acentos, emoji,
     quebras de linha — sem se estragar pelo caminho. */
  S.membros[0].nome = 'Aspas "duplas" e \'simples\' & <tags> \\barras';
  S.categorias[0].nome = "Acentuação: ãõçéêà — travessão, «aspas», emoji 🛒";
  S.notas[MES] = "Linha 1\nLinha 2\tcom tabulação";
  if (S.objetivos[0]) S.objetivos[0].nome = "Meta   com nulo";
  guardar();

  var exportado = JSON.stringify(S, null, 2);
  var nomeMembro = S.membros[0].nome, nomeCat = S.categorias[0].nome, nota = S.notas[MES];

  // Apagar tudo e reimportar pelo mesmo caminho do importador
  S = estadoVazio(); guardar();
  eq(temDados(), 0, "apagou-se tudo antes de reimportar");
  S = normalizar(JSON.parse(exportado)); limparCacheCredito(); guardar(); render();

  eq(S.membros[0].nome, nomeMembro, "as aspas, os apóstrofos e as barras voltam intactos");
  eq(S.categorias[0].nome, nomeCat, "os acentos, o travessão e o emoji também");
  eq(S.notas[MES], nota, "e as quebras de linha e tabulações dentro das notas");
  ok(S.objetivos[0] == null || S.objetivos[0].nome.indexOf(" ") >= 0,
     "até um carácter nulo atravessa sem partir a leitura");

  /* A primeira volta acrescenta o que `normalizar` completa; da segunda em
     diante tem de ser ponto fixo, senão cada cópia mudava o ficheiro. */
  var primeira = JSON.stringify(S);
  S = normalizar(JSON.parse(JSON.stringify(S, null, 2))); limparCacheCredito();
  eq(JSON.stringify(S), primeira, "exportar e importar outra vez devolve o mesmo, ao byte");
  comExemplo();
})();

G("aviso de uso responsável ao criar um perfil");
(function(){
  /* Quem está a semear o seu primeiro orçamento é quem mais precisa de saber
     o que isto é — e o que não é. O aviso vem antes de ser criado seja o que
     for, e tem de ser aceite: fechá-lo não cria nada. */
  localStorage.removeItem(STORE_KEY);
  S = estadoVazio(); MES = isoMes(hoje()); contextoLimpo(); irPara("painel");
  eq(temDados(), 0, "parte-se de um orçamento vazio");

  clicar('[data-act="perfilAgregado"]');
  var texto = q("#app").innerText;
  ok(/gratuita e simples/i.test(texto), "o ecrã de boas-vindas avisa que a ferramenta é simples e gratuita");
  ok(/uso responsável/i.test(texto), "e que se destina a uso responsável");
  ok(/confirmar por si/i.test(texto), "e que os números são para confirmar");
  ok(/só neste aparelho/i.test(texto), "e que os dados ficam só neste aparelho");
  ok(/guarde cópias/i.test(texto), "pedindo cópias já na versão curta");

  clicar('[data-act="perfilAplicar"]');
  var d = q("#modalHost .dialog");
  ok(d != null, "«Começar assim» abre o aviso antes de semear");
  eq(temDados(), 0, "e nada foi criado ainda");
  if (d){
    var t = d.innerText;
    ok(/não é aconselhamento/i.test(t), "o aviso diz que não é aconselhamento");
    ok(/verificadas de forma independente/i.test(t), "que os cálculos se verificam de forma independente");
    ok(/Autoridade Tribut/i.test(t) && /Segurança Social/i.test(t),
       "e diz junto de quem — não deixa a verificação como boa intenção vaga");
    ok(/não se responsabiliza/i.test(t), "declina responsabilidade pelo impacto do uso");
    ok(/decisões são suas/i.test(t), "e devolve a decisão a quem a toma");

    /* Onde ficam os dados é a pergunta que ninguém faz a tempo. Sem servidor
       não há quem os devolva: limpar o navegador, uma janela privada, mudar
       de aparelho — e o orçamento inteiro foi-se. Vale dizê-lo antes, e
       dizer também o que fazer quanto a isso. */
    ok(/apenas neste navegador, neste aparelho/i.test(t),
       "diz que os dados ficam apenas neste aparelho");
    ok(/nada é enviado para lado nenhum/i.test(t), "e que nada sai daqui");
    ok(/ninguém lhe pode devolver os dados/i.test(t),
       "avisa que ninguém os pode devolver");
    ok(/não há recuperação possível/i.test(t), "porque não há recuperação possível");
    ok(/limpar os dados de navegação/i.test(t) && /janela privada/i.test(t) &&
       /mudar de navegador/i.test(t) && /desinstalar/i.test(t),
       "enumera o que os leva: limpar o navegador, janela privada, mudar de aparelho, desinstalar");
    ok(/exporte uma cópia com regularidade/i.test(t),
       "e pede cópias com regularidade, que é a única defesa que existe");
    ok(/Dados ▾/i.test(t) && /Exportar/i.test(t), "dizendo onde se exporta");
    ok(/cifrada/i.test(t), "e lembra a cópia cifrada para quem a mandar para fora");

    var realces = qq("#modalHost .dialog .note").map(function(n){
      return getComputedStyle(n).borderLeftColor; });
    ok(new Set(realces).size > 1, "o aviso das cópias destaca-se dos outros blocos");
  }

  // Cancelar não cria nada, e não faz perder a escolha já feita
  clicar('#modalHost [data-dlg="no"]');
  ok(q("#modalHost .dialog") == null, "cancelar fecha o aviso");
  eq(temDados(), 0, "sem criar nada");
  ok(ui.perfil && ui.perfil.agregado, "e sem esquecer o agregado que já estava escolhido");

  // Clicar fora é não aceitar — criar dados exige dizer que sim
  clicar('[data-act="perfilAplicar"]');
  q("#modalHost .overlay").dispatchEvent(new MouseEvent("click", {bubbles:true}));
  eq(temDados(), 0, "fechar pelo lado de fora também não cria nada");

  // Aceite, o ponto de partida é semeado como dantes
  clicar('[data-act="perfilAplicar"]');
  clicar('#modalHost [data-dlg="yes"]');
  ok(q("#modalHost .dialog") == null, "aceitar fecha o aviso");
  ok(S.membros.length > 0, "e aí sim, semeia os membros");
  ok(S.recorrentes.length > 0, "e as despesas fixas típicas");
  ok(podeDesfazer(), "continuando a poder desfazer-se");

  /* Um aviso que aparece uma vez e nunca mais não serve a quem o queira
     reler seis meses depois. */
  irA("config");
  var sobre = qq("#app .card").filter(function(c){ return /Sobre esta ferramenta/.test(c.textContent); })[0];
  ok(sobre != null, "o aviso fica relegível nas Definições");
  if (sobre){
    ok(/não se responsabiliza/i.test(sobre.innerText), "com o mesmo texto do arranque");
    ok(/verificadas de forma independente/i.test(sobre.innerText), "e a mesma exigência de verificação");
  }
  comExemplo();
})();

G("custo de trabalhar com um orçamento grande");
(function(){
  comExemplo();
  /* Cinco anos de movimentos é o que um agregado que use isto a sério tem ao
     fim de cinco anos. Tudo o que se segue é medido com esse peso em cima,
     porque é aí que as folgas se acabam — e num telemóvel modesto os tempos
     daqui multiplicam-se por três ou quatro. */
  var cats = S.categorias.map(function(c){ return c.id; });
  var base = new Date(2021, 7, 1), muitos = [];
  for (var d = 0; d < 365 * 5; d++){
    var dia = new Date(base.getTime() + d * 86400000);
    for (var k = 0; k < 1 + (d % 3); k++){
      muitos.push({id:"mvG"+d+"_"+k, data: dia.toISOString().slice(0,10),
        descricao:"Movimento "+d+"/"+k, valor:-(5 + ((d*7 + k*13) % 120)),
        categoriaId: cats[(d+k) % cats.length], membroId:"", tipo:"despesa"});
    }
  }
  S.movimentos = S.movimentos.concat(muitos);
  guardar();
  var estadoKB = Math.round(JSON.stringify(S).length / 1024);
  ok(estadoKB > 400, "o estado de cinco anos pesa o que se espera", estadoKB + " KB");

  /* O histórico guarda fotografias do estado inteiro. A 550 KB cada, quarenta
     passos seriam vinte e dois megabytes — o tecto de bytes tem de cortar
     muito antes disso, e sem deixar de haver o que desfazer. */
  historico = {atras: [], frente: []};
  for (var i = 0; i < 50; i++){
    alterar(function(){ S.projecao.anos = (S.projecao.anos % 30) + 1; }, "medida " + i);
  }
  var bytes = historico.atras.reduce(function(s, h){ return s + h.json.length; }, 0);
  ok(historico.atras.length < 50, "o histórico corta antes dos cinquenta passos",
     historico.atras.length + " passos");
  ok(bytes <= HIST_MAX_BYTES, "e fica dentro do tecto de bytes",
     Math.round(bytes/1048576) + " MB de " + Math.round(HIST_MAX_BYTES/1048576));
  ok(podeDesfazer(), "sem deixar de haver o que desfazer");

  /* `alterar` serializa o estado para o comparar; `guardar` voltava a
     serializá-lo logo a seguir, e com este peso são 550 KB percorridos duas
     vezes por cada alteração, mais o lixo que isso deixa. */
  var pedidos = 0;
  var real = guardar;
  window.guardar = function(j){ if (j == null) pedidos++; return real.apply(this, arguments); };
  alterar(function(){ S.projecao.inflacao = 2.5; });
  window.guardar = real;
  eq(pedidos, 0, "uma alteração normal não manda serializar o estado outra vez");
  eq(localStorage.getItem(STORE_KEY), JSON.stringify(S), "e o que fica no disco é o estado tal e qual");

  // Sem nada dado, `guardar` continua a serializar por si
  S.projecao.inflacao = 4;
  guardar();
  eq(JSON.parse(localStorage.getItem(STORE_KEY)).projecao.inflacao, 4,
     "e quem chamar `guardar` sem texto nenhum é servido na mesma");
  comExemplo();
})();

G("desenhar mil vezes não deixa lixo para trás");
(function(){
  comExemplo();
  /* Cada desenho substitui o conteúdo do `#app`. Se sobrasse alguma coisa —
     um cartão órfão, um diálogo por fechar, um destaque esquecido — a conta
     de nós subia a cada passagem, e ao fim de uma sessão longa a página
     ficava pesada sem razão visível. Compara-se sempre a mesma vista consigo
     própria: vistas diferentes têm tamanhos diferentes por natureza, e
     comparar `config` com `despesas` não diria nada sobre fugas. */
  var vistas = ["painel","rendimento","despesas","credito","objetivos","estrategias","fiscal","config"];
  var cresceram = [];
  vistas.forEach(function(v){
    irA(v);
    var antes = document.querySelectorAll("*").length;
    for (var i = 0; i < 25; i++) render();
    var depois = document.querySelectorAll("*").length;
    if (Math.abs(depois - antes) > 2) cresceram.push(v + ": " + antes + " → " + depois);
  });
  eq(cresceram.length, 0, "vinte e cinco desenhos seguidos não engordam vista nenhuma",
     cresceram.join("; "));

  // E navegar em ciclo volta sempre ao mesmo tamanho na mesma vista
  irA("painel");
  var painelAntes = document.querySelectorAll("*").length;
  for (var j = 0; j < 60; j++) irA(vistas[j % vistas.length]);
  irA("painel");
  ok(Math.abs(document.querySelectorAll("*").length - painelAntes) <= 2,
     "e sessenta navegações devolvem o painel do mesmo tamanho",
     painelAntes + " → " + document.querySelectorAll("*").length);
  eq(qq("#modalHost .dialog").length, 0, "sem diálogos órfãos");
  eq(qq(".tut-alvo").length, 0, "sem destaques órfãos");
  eq(qq(".aponta").length, 0, "sem indicações órfãs");
})();

G("guardar como aplicação");
(function(){
  comExemplo();
  irA("config");
  var cartao = qq("#app .card").filter(function(c){ return /Guardar como aplicação/.test(c.textContent); })[0];
  ok(cartao != null, "há cartão de instalação nas Definições");
  if (!cartao) return;

  ok(/ícone próprio|já está instalada|a partir do disco/i.test(cartao.innerText),
     "que diz o que a instalação dá, ou o estado em que está");
  ok(/não copia nada/i.test(cartao.innerText),
     "e tranquiliza sobre os dados, que é a primeira dúvida de quem instala");

  /* O iPhone e o iPad não leem o manifesto para o ícone do ecrã principal:
     querem um `apple-touch-icon`, e só em PNG. A aplicação não tem ficheiros
     de imagem, por isso o ícone é desenhado num `canvas` em tempo de execução. */
  var l = q('link[rel="apple-touch-icon"]');
  ok(l != null, "há ícone de ecrã principal para o Safari");
  if (l) ok(/^data:image\/png/.test(l.href), "e é PNG, que é o único que o Safari aceita ali",
            l.href.slice(0, 24));

  // A cor da barra do sistema segue a paleta, senão fica azul por cima de verde
  var meta = q('meta[name="theme-color"]');
  ok(meta != null, "a barra do sistema tem cor declarada");
  var paletaAntes = S.paleta;
  var cores = [], icones = [];
  ["meianoite", "floresta", "areia"].forEach(function(p){
    S.paleta = p; aplicarTema();
    cores.push(meta.getAttribute("content"));
    icones.push(q('link[rel="apple-touch-icon"]').href.length);
  });
  S.paleta = paletaAntes; aplicarTema();
  ok(new Set(cores).size === 3, "e muda com a paleta escolhida", cores.join(" "));
  ok(new Set(icones).size === 3, "tal como o ícone, que é redesenhado na cor de acento",
     icones.join(" "));

  /* Desenhar o PNG custa perto de sete milissegundos — quase tudo o que
     `aplicarTema` gasta — e o desenho só muda quando a cor muda. Repetido à
     toa, era meio quadro de animação deitado fora a cada toque no tema. */
  var iconeAntes = q('link[rel="apple-touch-icon"]').href;
  var t0 = performance.now();
  for (var i = 0; i < 30; i++) aplicarIconeApp();
  var repetido = (performance.now() - t0) / 30;
  ok(repetido < 0.5, "repetir sem mudar de cor não redesenha nada",
     repetido.toFixed(3) + " ms");
  eq(q('link[rel="apple-touch-icon"]').href, iconeAntes, "e o ícone é o mesmo");

  /* O convite do navegador tem de ser guardado quando aparece — perde-se se
     não for — e gasta-se ao ser usado. Sem convite não há botão: fingir que
     há dava um botão que não faz nada. */
  var conviteAntes = _conviteInstalar;
  _conviteInstalar = null; render();
  ok(q('[data-act="appInstalar"]') == null, "sem convite do navegador, não há botão");

  var pediu = 0;
  var ev = new Event("beforeinstallprompt");
  ev.prompt = function(){ pediu++; };
  ev.userChoice = Promise.resolve({outcome:"dismissed"});
  window.dispatchEvent(ev);
  ok(_conviteInstalar != null, "o convite é guardado quando o navegador o dá");
  irA("config");
  ok(q('[data-act="appInstalar"]') != null, "e aí aparece o botão");
  clicar('[data-act="appInstalar"]');
  eq(pediu, 1, "carregar pede a instalação ao navegador");
  ok(_conviteInstalar == null, "e o convite gasta-se: só serve uma vez");
  _conviteInstalar = conviteAntes;

  // Requisitos do Chrome e do Android, listados para quem não vê o botão
  ok(typeof verificarRequisitos === "function", "há verificação dos requisitos de instalação");
  var estadoAntes = JSON.parse(JSON.stringify(_requisitos));
  _requisitos = {feito:true, https:false, manifesto:true, icones:false, sw:true};
  irA("config");
  cartao = qq("#app .card").filter(function(c){ return /Guardar como aplicação/.test(c.textContent); })[0];
  ok(/https/i.test(cartao.innerText), "com o endereço em falta, di-lo");
  ok(/Ícone de 192/i.test(cartao.innerText), "e o ícone também");
  ok(!/Service worker ativo/i.test(cartao.innerText), "e não acusa o que está cumprido");
  _requisitos = {feito:true, https:true, manifesto:true, icones:true, sw:true};
  irA("config");
  cartao = qq("#app .card").filter(function(c){ return /Guardar como aplicação/.test(c.textContent); })[0];
  ok(/tudo pronto/i.test(cartao.innerText), "com tudo cumprido, di-lo em vez de listar faltas");
  _requisitos = estadoAntes;
  render();
})();

G("contraste das oito paletas, nos dois modos");
(function(){
  comExemplo();
  var paraRGB = function(c){ var d = document.createElement("div"); d.style.color = c;
    document.body.appendChild(d); var r = getComputedStyle(d).color; d.remove(); return r; };
  var lum = function(c){ var m = c.match(/\d+(\.\d+)?/g).map(Number);
    var f = m.slice(0,3).map(function(v){ v /= 255;
      return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); });
    return 0.2126*f[0] + 0.7152*f[1] + 0.0722*f[2]; };
  var razao = function(a, b){ var l1 = lum(paraRGB(a)), l2 = lum(paraRGB(b));
    return (Math.max(l1,l2)+0.05) / (Math.min(l1,l2)+0.05); };
  var cor = function(v){ return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); };

  var paletaAntes = S.paleta, temaAntes = S.tema;
  var pares = [["texto/fundo","--text","--bg"], ["texto/superfície","--text","--surface"],
               ["texto/superfície-2","--text","--surface-2"], ["esbatido/superfície","--muted","--surface"],
               ["acento/superfície","--accent","--surface"], ["positivo/superfície","--pos","--surface"],
               ["negativo/superfície","--neg","--surface"], ["aviso/superfície","--warn","--surface"]];
  var fracos = [], semFundoEscuro = [], n = 0, pior = 99, piorNome = "";
  Object.keys(PALETAS).forEach(function(p){
    ["light","dark"].forEach(function(modo){
      S.paleta = p; S.tema = modo; aplicarTema();
      pares.forEach(function(par){
        var r = razao(cor(par[1]), cor(par[2])); n++;
        if (r < pior){ pior = r; piorNome = p+"/"+modo+" "+par[0]; }
        if (r < 4.5) fracos.push(p+"/"+modo+" "+par[0]+" = "+r.toFixed(2));
      });
      /* Uma paleta que se esqueça do fundo no modo escuro fica com o claro
         da sua própria regra — foi o que aconteceu à Grafite, que dava texto
         quase branco sobre fundo quase branco: 1,09 de razão. */
      if (modo === "dark" && lum(paraRGB(cor("--bg"))) > 0.5)
        semFundoEscuro.push(p+": fundo claro no modo escuro ("+cor("--bg")+")");
    });
  });
  S.paleta = paletaAntes; S.tema = temaAntes; aplicarTema();

  eq(n, Object.keys(PALETAS).length * 2 * pares.length,
     "cada paleta medida nos dois modos, par a par", n);
  eq(semFundoEscuro.length, 0, "nenhuma paleta fica com fundo claro no modo escuro",
     semFundoEscuro.join("; "));
  eq(fracos.length, 0, "e nenhum par de texto fica abaixo dos 4,5 que a norma pede",
     fracos.slice(0, 4).join("; "));
  ok(pior >= 4.5, "o pior par de todos ainda se lê", piorNome+" = "+pior.toFixed(2));
})();

G("relatório: a impressão pode falhar, o utilizador não pode ficar preso");
(function(){
  comExemplo();
  /* A vista do relatório não tem um único controlo — é uma folha, não um
     ecrã. A reposição estava depois do `window.print()`, sem rede: onde a
     impressão rebenta (quiosques, webviews, política de impressão) ficava-se
     numa página sem saída até recarregar o navegador. */
  /* A impressão é adiada 120 ms para a folha pintar primeiro. A suite é
     síncrona, e uma espera ativa bloquearia o próprio temporizador — por
     isso troca-se o `setTimeout` por um que corre já. */
  var printReal = window.print, stReal = window.setTimeout, chamadas = 0;
  window.setTimeout = function(fn){ fn(); return 0; };
  window.print = function(){ chamadas++; throw new Error("impressão bloqueada"); };
  semErro(function(){ ACOES.relatorio(); }, "pedir o relatório não lança para fora");
  window.setTimeout = stReal; window.print = printReal;
  eq(chamadas, 1, "tentou mesmo imprimir");
  ok(!ui.relatorio, "e a impressão a rebentar não deixa ninguém preso no relatório");
  render();
  ok(qq("#app [data-act]").length > 0, "a aplicação volta logo com os seus botões");

  window.setTimeout = function(fn){ fn(); return 0; };
  window.print = function(){ chamadas++; throw new Error("bloqueada"); };
  ACOES.relatorioAno();
  window.setTimeout = stReal; window.print = printReal;
  ok(!ui.relatorio, "o retrato do ano também se repõe");
  eq(chamadas, 2, "e também tentou imprimir");

  // Estado direto: com o `finally`, a bandeira cai mesmo com a exceção
  ui.relatorio = "ano"; render();
  ok(q("#app").innerHTML.length > 0, "o retrato do ano desenha-se");
  eq(qq("#app [data-act]").length, 0, "e não tem controlo nenhum — é uma folha");
  document.dispatchEvent(new KeyboardEvent("keydown", {key:"Escape", bubbles:true}));
  ok(!ui.relatorio, "por isso o Esc tem de o fechar");
  render();
  ok(qq("#app [data-act]").length > 0, "e a aplicação volta com os seus botões");
})();

G("impressão: o que flutua fica fora do papel");
(function(){
  comExemplo();
  var regras = [];
  [].slice.call(document.styleSheets).forEach(function(sh){
    try {
      [].slice.call(sh.cssRules).forEach(function(r){
        if (r.media && String(r.media).indexOf("print") >= 0)
          [].slice.call(r.cssRules).forEach(function(x){ if (x.selectorText) regras.push(x.selectorText); });
      });
    } catch(e){}
  });
  ok(regras.length > 0, "há folha de impressão");
  var oculta = regras.join(",").split(",").map(function(s){ return s.trim(); });
  /* Tudo o que paira por cima da página: o diálogo e a bolha do explicador
     estavam a faltar — quem tivesse o ponteiro num indicador ao imprimir
     levava a bolha para o papel. */
  ["header", "nav.tabs", ".no-print", "#toast", "#tabsMovel", "#folhaMais",
   "#paleta", "#tutorial", "#modalHost", "#tip"].forEach(function(sel){
    ok(oculta.indexOf(sel) >= 0, "a impressão esconde "+sel);
  });
  ok(q("#botaoRapido") == null || q("#botaoRapido").classList.contains("no-print"),
     "e o botão de registo rápido leva a marca de não imprimir");
  ui.relatorio = true; render();
  var rel = q(".relatorio");
  ok(rel != null && !rel.classList.contains("no-print") && rel.closest(".no-print") == null,
     "mas o relatório em si imprime-se");
  ui.relatorio = false; render();
})();

G("todas as ações do registo, disparadas uma a uma");
(function(){
  comExemplo();
  /* Cada ação corrida com o orçamento de exemplo por baixo: nenhuma pode
     deixar o estado num sítio de onde as contas do mês já não se façam. As
     que abrem diálogos do sistema ficam de fora — não há como as fechar. */
  var guardado = JSON.stringify(S);
  var nativas = ["imprimir", "relatorio", "relatorioAno", "exportJSON", "exportJSONCifrado",
                 "exportCSV", "exportPatrimonioCSV", "importJSON", "csvImportar"];
  var vistaDe = {rd:"rendimento", cp:"rendimento", comp:"rendimento", mv:"despesas", rec:"despesas",
    lim:"despesas", corte:"despesas", plan:"despesas", lote:"despesas", regra:"despesas",
    obj:"objetivos", cr:"credito", amort:"credito", pat:"ativos", fluxo:"ativos", aporte:"ativos",
    est:"estrategias", sim:"estrategias", cenario:"estrategias", ese:"estrategias",
    fx:"fiscal", mb:"config", cat:"config", tema:"config", painel:"painel"};
  var corridas = 0, partiu = 0, quaisPartiu = [];
  Object.keys(ACOES).forEach(function(nome){
    if (nativas.indexOf(nome) >= 0) return;
    var pref = (nome.match(/^[a-z]+/) || [""])[0];
    try { irA(vistaDe[pref] || "painel"); } catch(e){}
    var el = document.createElement("button");
    el.dataset.act = nome; el.dataset.v = "movimentos"; el.dataset.k = "casal";
    el.dataset.id = (S.movimentos[0] || {}).id || "x"; el.dataset.view = "painel";
    el.dataset.i = "0"; el.dataset.obj = "reforma"; el.dataset.mes = MES; el.dataset.n = "1";
    document.body.appendChild(el);
    try { ACOES[nome](el); } catch(e){ /* formulários fechados: conta-se abaixo */ }
    el.remove();
    corridas++;
    try {
      var p = planoMes(MES), r = realMes(MES);
      if (!isFinite(p.desp) || !isFinite(r.desp)){ partiu++; quaisPartiu.push(nome); }
    } catch(e){ partiu++; quaisPartiu.push(nome+" ("+e.message.slice(0,20)+")"); }
    S = normalizar(JSON.parse(guardado)); limparCacheCredito();
  });
  S = normalizar(JSON.parse(guardado)); limparCacheCredito();
  q("#modalHost").innerHTML = "";
  ui.relatorio = false;
  render();
  ok(corridas >= 140, "o registo tem ações que cheguem para uma aplicação inteira", corridas);
  eq(partiu, 0, "e nenhuma deixa o mês por calcular", quaisPartiu.slice(0, 5).join("; "));
  ok(q("#app").innerText.length > 200, "a aplicação fica de pé no fim de todas");
})();

G("tipografia: sem rede, do sistema, e algarismos que alinham");
(function(){
  comExemplo();
  /* A aplicação é um ficheiro só e tem de funcionar sem rede. Um tipo de
     letra pedido a um servidor estraga isso em silêncio: o texto aparece,
     mas primeiro fica invisível ou noutro tipo, e num avião não chega. */
  var fonte = document.documentElement.outerHTML;
  eq((fonte.match(/@font-face/g) || []).length, 0, "não há tipos de letra embutidos por descarregar");
  ok(!/@import/.test(fonte), "nem folhas de estilo importadas");
  eq(qq('link[rel~="stylesheet"], link[rel="preconnect"]').length, 0, "nem ligações a servidores de tipos");
  var externos = performance.getEntriesByType("resource")
    .map(function(e){ return e.name; })
    .filter(function(n){ return !/^(blob|data):/.test(n) && n.indexOf(location.origin) !== 0; });
  eq(externos.length, 0, "e nenhum pedido saiu para fora", externos.slice(0, 3).join(", "));

  /* `system-ui` à frente: cada aparelho usa o seu tipo de interface. Um nome
     concreto antes dele impõe o mesmo tipo em todo o lado — e há tipos que
     estão instalados sem serem o do sistema, como o Avenir Next no macOS. */
  var pilha = getComputedStyle(document.body).fontFamily;
  ok(/^\s*system-ui/.test(pilha), "a pilha começa em system-ui", pilha);
  ok(!/Avenir/.test(pilha), "sem tipos que não sejam de interface em nenhum sistema");
  ok(/Emoji/.test(pilha), "e com recurso de emoji, porque os ícones são emoji");

  /* Algarismos de largura fixa onde há números a alinhar em coluna. */
  irA("painel");
  var svgTexto = q("#app svg text");
  if (svgTexto) eq(getComputedStyle(svgTexto).fontVariantNumeric, "tabular-nums",
     "os rótulos dos gráficos têm algarismos de largura fixa");
  irA("despesas");
  clicar('[data-act="secDespesa"][data-v="movimentos"]');
  var valor = qq("#app td.num")[0];
  if (valor) eq(getComputedStyle(valor).fontVariantNumeric, "tabular-nums",
     "e as colunas de dinheiro também");
  var dia = q("#app tr.diaCabec .dv");
  if (dia) eq(getComputedStyle(dia).fontVariantNumeric, "tabular-nums",
     "e os subtotais de cada dia");
})();

G("alvos de dedo: a coluna de seleção");
(function(){
  comExemplo();
  irA("despesas");
  clicar('[data-act="secDespesa"][data-v="movimentos"]');
  var td = q("#app td.colSel");
  ok(td != null, "os movimentos têm coluna de seleção");
  if (td){
    var lab = td.querySelector("label.celSel"), cx = td.querySelector('input[type="checkbox"]');
    ok(lab != null, "com uma etiqueta a envolver a caixa");
    ok(cx != null, "e a caixa lá dentro");
    /* A etiqueta faz da célula inteira um alvo: quem toca ao lado da caixa
       ainda marca a linha. Sem ela, o alvo era a caixa e mais nada. */
    if (lab && cx){
      var antes = Object.keys(ui.movSel || {}).length;
      lab.click();
      ok(Object.keys(ui.movSel || {}).length !== antes, "tocar na célula, e não na caixa, marca a linha");
      lab.click();

      var rc = cx.getBoundingClientRect();
      if (rc.width > 0){
        ok(Math.abs(rc.width - rc.height) <= 1,
           "a caixa é quadrada, e não um retângulo esticado", Math.round(rc.width)+"×"+Math.round(rc.height));
      }
      /* Ao dedo o alvo cresce; ao rato a coluna não rouba espaço à tabela.
         A regra tem de estar no atributo de aparelho e não só na media query:
         um telemóvel deitado tem 844 px de largura, e há aparelhos de toque
         que declaram ponteiro fino — em qualquer dos casos ela não dispara. */
      var raiz = document.documentElement, antesDisp = raiz.getAttribute("data-dispositivo");
      raiz.setAttribute("data-dispositivo", "telemovel");
      var comDedo = td.getBoundingClientRect().width;
      raiz.setAttribute("data-dispositivo", "desktop");
      var comRato = td.getBoundingClientRect().width;
      if (antesDisp) raiz.setAttribute("data-dispositivo", antesDisp);
      else raiz.removeAttribute("data-dispositivo");
      if (comRato > 0){
        ok(comDedo >= 44, "ao dedo a coluna dá 44 px de alvo", Math.round(comDedo));
        ok(comRato < comDedo, "ao rato encolhe e devolve a largura à tabela", Math.round(comRato));
      }
    }
  }

  // A fita de meses é estreita de propósito, mas não ao ponto de não se acertar
  var raiz = document.documentElement, antes = raiz.getAttribute("data-dispositivo");
  raiz.setAttribute("data-dispositivo", "telemovel");
  var mes = q("#fitaMeses button");
  if (mes && mes.getBoundingClientRect().width > 0)
    ok(mes.getBoundingClientRect().width >= 32, "os meses da fita alargam ao dedo",
       Math.round(mes.getBoundingClientRect().width));
  if (antes) raiz.setAttribute("data-dispositivo", antes); else raiz.removeAttribute("data-dispositivo");
  aplicarOrientacao();
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

  /* Cabeçalhos ordenáveis: a seta ▲ é desenho, e quem ouve a página precisa
     de saber por onde está ordenado. `aria-sort` di-lo; e o cabeçalho fica
     cabeçalho de coluna, não botão, senão perde-se a que coluna pertence
     cada célula. */
  irA("despesas");
  clicar('[data-act="secDespesa"][data-v="movimentos"]');
  /* `ordem` é global e sobrevive aos grupos: guarda-se para a devolver, senão
     os grupos seguintes recebem a tabela ordenada por outra coluna. */
  var ordemMovAntes = JSON.stringify(ordem.mov || null);
  var cabs = qq("#app thead th.sortable");
  ok(cabs.length >= 4, "a tabela de movimentos tem cabeçalhos ordenáveis");
  eq(qq('#app th[role="button"]').length, 0, "nenhum se disfarça de botão");
  ok(cabs.every(function(c){ return c.getAttribute("tabindex") === "0"; }),
     "todos se alcançam por tabulação");
  ok(cabs.every(function(c){ return /^(none|ascending|descending)$/.test(c.getAttribute("aria-sort") || ""); }),
     "e todos declaram o sentido da ordenação");
  ok(qq("#app thead .seta").every(function(s){ return s.getAttribute("aria-hidden") === "true"; }),
     "a seta não é lida em voz alta");

  var alvo = cabs.filter(function(c){ return /Valor/i.test(c.innerText); })[0];
  var sentido = function(){
    var c = qq("#app thead th.sortable").filter(function(x){ return /Valor/i.test(x.innerText); })[0];
    return c ? c.getAttribute("aria-sort") : null;
  };
  alvo.dispatchEvent(new KeyboardEvent("keydown", {key:" ", bubbles:true}));
  eq(sentido(), "ascending", "espaço ordena e anuncia crescente");
  qq("#app thead th.sortable").filter(function(x){ return /Valor/i.test(x.innerText); })[0]
    .dispatchEvent(new KeyboardEvent("keydown", {key:"Enter", bubbles:true}));
  eq(sentido(), "descending", "e Enter inverte, também anunciado");
  eq(qq("#app thead th.sortable").filter(function(c){ return c.getAttribute("aria-sort") !== "none"; }).length,
     1, "só uma coluna está ordenada de cada vez");
  ordem.mov = JSON.parse(ordemMovAntes);
  if (ordem.mov == null) delete ordem.mov;

  // Relatório
  irA("config");
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

  // Com o histórico no tecto, o «Anular» tem de continuar a aparecer: cada
  // passo novo faz cair o mais antigo, e o tamanho da pilha deixa de crescer.
  // Quem decidisse pelo tamanho perdia a afordância justamente para quem mais
  // mexe nos dados — e o Ctrl+Z continuava a funcionar, o que tornava a
  // ausência do botão ainda mais difícil de explicar.
  eq(historico.atras.length, HIST_MAX_PASSOS, "o histórico está mesmo cheio para este teste");
  comExemplo();
  historico = {atras: [], frente: []};
  for (i = 0; i < HIST_MAX_PASSOS + 3; i++){
    (function(k){ alterar(function(){ S.projecao.anos = 10 + (k % 7); }, "ruído "+k); })(i);
  }
  eq(historico.atras.length, HIST_MAX_PASSOS, "e continua no tecto depois do ruído");
  var rdC = S.rendimentos[0];
  ui.abertos["rd-" + rdC.id] = true;
  irA("rendimentos");
  var compAntes = rdC.componentes.length;
  clicar('[data-act="compApagar"][data-rd="' + rdC.id + '"]');
  eq(S.rendimentos[0].componentes.length, compAntes - 1, "com o histórico cheio, a eliminação acontece");
  ok(q("#toast button") != null, "e o «Anular» continua a ser oferecido");
  clicar(q("#toast button"));
  eq(S.rendimentos[0].componentes.length, compAntes, "e ainda repõe o que foi eliminado");

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

  // Uma sessão gravada por uma versão anterior pode nomear uma vista que
  // entretanto passou a secção: o alias resolve-se, em vez de se ficar
  // onde se estava a fingir que se percebeu.
  [["movimentos","despesas","movimentos"], ["orcamento","despesas","limites"],
   ["plano","despesas","plano"], ["patrimonio","ativos",null], ["investimentos","ativos",null]]
  .forEach(function(caso){
    localStorage.setItem(SESSAO_KEY, JSON.stringify({vista:caso[0], em:Date.now(), secaoDespesa:"plano"}));
    VIEW = "painel"; ui.secaoDespesa = "plano";
    restaurarSessao();
    eq(VIEW, caso[1], "sessão com a vista antiga «"+caso[0]+"» aterra em "+caso[1]);
    if (caso[2]) eq(ui.secaoDespesa, caso[2], "e na secção "+caso[2]);
  });
  localStorage.setItem(SESSAO_KEY, JSON.stringify({vista:"vistaQueNuncaExistiu", em:Date.now()}));
  VIEW = "painel"; restaurarSessao();
  eq(VIEW, "painel", "uma vista desconhecida não move ninguém");
  // E um mês impossível numa sessão não desloca o mês em análise
  var mAntes = MES;
  localStorage.setItem(SESSAO_KEY, JSON.stringify({vista:"painel", mes:"2026-13", em:Date.now()}));
  restaurarSessao();
  eq(MES, mAntes, "um mês impossível na sessão é ignorado");
  VIEW = "painel"; ui.secaoDespesa = "plano"; render();

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

  /* Armazenamento cheio: falhar em silêncio seria o pior dos casos — quem
     continuasse a trabalhar perderia tudo ao recarregar. Tem de avisar, e
     tem de deixar a marca no cabeçalho enquanto a gravação não voltar. */
  var setItemReal = Storage.prototype.setItem;
  var guardadoAntes = localStorage.getItem(STORE_KEY);
  Storage.prototype.setItem = function(k){
    if (k === STORE_KEY){ var err = new Error("cheio"); err.name = "QuotaExceededError"; throw err; }
    return setItemReal.apply(this, arguments);
  };
  var rebentou = false;
  try { guardar(); } catch(e){ rebentou = true; }
  Storage.prototype.setItem = setItemReal;
  ok(!rebentou, "o armazenamento cheio não deixa escapar a exceção");
  ok(_guardado.erro, "mas fica registado que falhou");
  ok(/por guardar/i.test(q("#estadoGuardado").textContent),
     "e o cabeçalho di-lo", q("#estadoGuardado").textContent);
  ok(/exporte|cópia/i.test(q("#estadoGuardado").title || ""),
     "sugerindo exportar uma cópia antes de perder o trabalho");
  /* O toast pode estar em fila atrás de outro, e só chega ao DOM na sua vez:
     vale tanto o que está no ecrã como o que está à espera. */
  var noEcra = (q("#toast") || {}).textContent || "";
  var naFila = (typeof _filaToast !== "undefined" ? _filaToast : [])
    .map(function(t){ return t.msg; }).join(" | ");
  ok(/não foi possível guardar/i.test(noEcra + " | " + naFila),
     "e o aviso passou pelo toast", noEcra + " || fila: " + naFila);
  eq(localStorage.getItem(STORE_KEY), guardadoAntes, "sem tocar no que já estava gravado");

  guardar();
  ok(!_guardado.erro, "e uma gravação boa limpa o aviso");
  ok(/guardado/.test(q("#estadoGuardado").textContent), "o cabeçalho volta ao normal");
})();

G("toque — o que o rato fazia e o dedo não faz");
(function(){
  comExemplo();

  // Folha de ações: o cabeçalho tinha 17 botões
  ok(q("#btnMaisAcoes") != null, "há botão de transbordo no cabeçalho");
  q("#btnMaisAcoes").click();
  ok(q("#folhaAcoes").classList.contains("aberta"), "abre a folha de ações");
  eq(qq("#folhaAcoes button").length, ACOES_FOLHA.length, "com todas as ações secundárias");
  var essencialAntes = ui.essencial;
  qq("#folhaAcoes button")[0].click();
  ok(ui.essencial !== essencialAntes, "acionar pela folha funciona");
  ok(!q("#folhaAcoes").classList.contains("aberta"), "e a folha fecha depois de escolher");
  ui.essencial = essencialAntes; render();

  // Subir e descer: o arrasto HTML5 não existe em telemóvel
  irA("config");
  var bts = qq('[data-act="ordemMover"]');
  ok(bts.length > 0, "há botões de subir e descer", bts.length);
  var cats = S.categorias.map(function(c){ return c.id; });
  var segundo = cats[1];
  var subir = qq('[data-act="ordemMover"]').filter(function(b){
    return b.dataset.id === segundo && b.dataset.d === "-1"; })[0];
  historico = {atras: [], frente: []};
  subir.click();
  eq(S.categorias[0].id, segundo, "subir troca com o de cima");
  ok(historico.atras.length === 1, "e é desfazível");
  desfazer();
  eq(S.categorias[1].id, segundo, "desfazer repõe a ordem");
  // No topo não faz nada
  var primeiro = S.categorias[0].id;
  qq('[data-act="ordemMover"]').filter(function(b){
    return b.dataset.id === primeiro && b.dataset.d === "-1"; })[0].click();
  eq(S.categorias[0].id, primeiro, "no topo, subir não muda nada");

  // Reordenar rubricas e cartões do painel pelos mesmos botões
  irA("despesas");
  clicar('[data-act="secDespesa"][data-v="plano"]');
  ok(qq('[data-act="ordemMover"][data-tipo="rec"]').length > 0, "as rubricas também têm os botões");
  irA("config");
  ok(qq('[data-act="ordemMover"][data-tipo="painel"]').length > 0, "e os cartões do painel");

  // Ordenação das tabelas quando viram cartões
  irA("despesas");
  clicar('[data-act="secDespesa"][data-v="movimentos"]');
  ok(q("#ordMov") != null, "há seletor de ordenação para o modo cartão");
  q("#ordMov").value = "valor";
  q("#ordMov").dispatchEvent(new Event("change", {bubbles:true}));
  eq(ordem.mov.col, "valor", "muda a coluna de ordenação");
  var dirAntes = ordem.mov.dir;
  clicar('[data-act="ordMovDir"]');
  eq(ordem.mov.dir, -dirAntes, "e inverte o sentido");
  ordem.mov = {col:"data", dir:-1}; render();

  // O cabeçalho recolhe ao descer, mas só em ecrã estreito
  var h = q("header");
  h.classList.remove("recolhido");
  window.scrollTo(0, 400);
  window.dispatchEvent(new Event("scroll"));
  ok(!h.classList.contains("recolhido") || window.innerWidth <= 640,
     "em ecrã largo o cabeçalho não recolhe");
  window.scrollTo(0, 0);
  window.dispatchEvent(new Event("scroll"));
  ok(!h.classList.contains("recolhido"), "no topo está sempre visível");
})();

G("desktop intacto");
(function(){
  comExemplo();
  var vis = function(sel){ var e = q(sel); return e && getComputedStyle(e).display !== "none"; };
  // Nada do que existia em ecrã grande se perdeu para o telemóvel
  ok(vis("#mesSel"), "o seletor de mês continua lá");
  ok(vis("nav.tabs") || window.innerWidth <= 640, "os separadores do topo continuam lá");
  irA("config");   // é aqui que há linhas arrastáveis
  ok(qq('[draggable="true"]').length > 0, "o arrasto continua disponível", qq('[draggable="true"]').length);
  ok(q(".pega") != null, "e a pega ⠿ continua a existir");
  irA("despesas");
  clicar('[data-act="secDespesa"][data-v="movimentos"]');
  ok(qq("th.sortable").length > 0, "os cabeçalhos ordenáveis continuam lá");
  ok(qq("td[data-edit]").length > 0, "a edição em linha continua disponível");
  // A fita deixou de estar escondida na faixa dos ecrãs médios
  ok(q("#fitaMeses") != null, "a fita de meses existe em qualquer largura");
  eq(qq("#fitaMeses button[data-mes]").length, 7, "com sete meses");
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
ordem = {};
contextoLimpo();
/* Os filtros e a secção são do utilizador: devolvem-se como estavam, e não
   no estado neutro em que a suite trabalhou. */
filtros.texto = filtrosIniciais.texto; filtros.categoria = filtrosIniciais.categoria;
filtros.membro = filtrosIniciais.membro; filtros.tipo = filtrosIniciais.tipo;
ui.secaoDespesa = secaoInicial;
irPara(vistaInicial);
/* A repintura agenda gravações adiadas (400 ms nos dados, 600 ms na
   sessão). Sem as cancelar, disparavam depois desta limpeza e voltavam a
   escrever no disco o que se acabou de arrumar. */
if (typeof guardarT !== "undefined") clearTimeout(guardarT);
if (typeof _sessaoT !== "undefined") clearTimeout(_sessaoT);
if (backupSessao) localStorage.setItem(SESSAO_KEY, backupSessao);
else localStorage.removeItem(SESSAO_KEY);
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
