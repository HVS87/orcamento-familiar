/* ============================================================
   Suite de QA — registar com menos esforço (2.4)

   Carregue-a na aplicação como as outras e espere por window.__QAREG.
   Prova que:
   - as sete categorias novas existem para quem começa e chegam uma vez
     aos orçamentos antigos, sem duplicar nem voltar depois de apagadas;
   - numa lista, uma letra salta para a categoria que começa por ela e
     carregar outra vez corre as seguintes (sem contar o emoji nem acentos);
   - a descrição completa-se com o que já se escreveu, e a categoria vem
     atrás, pelas regras, pelo histórico ou pelas palavras dos bancos;
   - as rubricas em dias da semana contam quantas vezes cabem em cada mês;
   - o seletor de cor do agregado abre e grava;
   - o agregado tem adultos e crianças, com ano de nascimento, e as
     crianças passam para os dependentes do IRS;
   - as boas-vindas perguntam os nomes e as crianças, e ajustam o plano;
   - a poupança regular conta à parte, tem página própria e dá aportes;
   - o importador sugere categorias e reconhece duplicados.
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
var qa = function(s){ return Array.prototype.slice.call(document.querySelectorAll(s)); };
var mudar = function(el, v){ if (v !== undefined) el.value = v; el.dispatchEvent(new Event("change", {bubbles: true})); };
var nomeCat = function(id){ var c = cat(id); return c ? c.nome : ""; };

var disco = {};
for (var i = 0; i < localStorage.length; i++){ var k = localStorage.key(i); disco[k] = localStorage.getItem(k); }
var S0 = JSON.stringify(S), VIEW0 = VIEW, MES0 = MES, EDIT0 = JSON.stringify(editando);
var toastOrig = toast, confirmarOrig = confirmar, avisoOrig = typeof avisarUsoResponsavel === "function" ? avisarUsoResponsavel : null;
var toasts = [];
toast = function(t){ toasts.push(String(t)); };

var NOVAS = ["Limpeza e Manutenção da Casa", "Estética e Cuidados Pessoais", "Lavandaria", "Nanny e Babysitting",
             "Ginásios e Fitness", "Brinquedos", "Comissões Bancárias"];
function vazio(){ S = normalizar(estadoVazio()); }

async function correr(){
G("categorias novas");
var seed = categoriasSeed().map(function(c){ return c.nome; });
ok(NOVAS.every(function(n){ return seed.indexOf(n) >= 0; }), "as sete estão nas categorias de quem começa");
ok(NOVAS.every(function(n){ return categoriasSeed().some(function(c){ return c.nome === n && c.tipo === "despesa" && c.icone; }); }), "todas de despesa e com ícone");
var antigo = estadoVazio(); delete antigo.migracoes;
antigo.categorias = antigo.categorias.filter(function(c){ return NOVAS.indexOf(c.nome) < 0; });
var migrado = normalizar(JSON.parse(JSON.stringify(antigo)));
ok(NOVAS.every(function(n){ return migrado.categorias.filter(function(c){ return c.nome === n; }).length === 1; }), "um orçamento antigo recebe-as, uma vez cada");
ok(migrado.migracoes.indexOf("cat-2.4") >= 0, "e fica marcado");
var outraVez = normalizar(JSON.parse(JSON.stringify(migrado)));
eq(outraVez.categorias.length, migrado.categorias.length, "normalizar outra vez não duplica");
var apagada = JSON.parse(JSON.stringify(migrado));
apagada.categorias = apagada.categorias.filter(function(c){ return c.nome !== "Brinquedos"; });
ok(!normalizar(apagada).categorias.some(function(c){ return c.nome === "Brinquedos"; }), "uma categoria nova apagada não volta");
var comAcento = JSON.parse(JSON.stringify(antigo));
comAcento.categorias.push({id: "cat-x", nome: "lavandaria", tipo: "despesa", grupo: "necessidades", cor: "#888888", icone: ""});
eq(normalizar(comAcento).categorias.filter(function(c){ return semAcento(c.nome) === "lavandaria"; }).length, 1, "não duplica uma que já existia com outra grafia");
ok(normalizar({}).migracoes.indexOf("cat-2.4") >= 0, "um estado sem nada fica com elas e marcado");

G("escrever uma letra numa lista");
irPagina("plano");
var sel = q("#rcCat");
ok(sel != null, "a lista de categorias está no formulário");
eq(rotuloSemEmoji("🧹 Limpeza e Manutenção da Casa"), "limpeza e manutencao da casa", "o emoji e os acentos não contam");
var tecla = function(el, k){ var e = new KeyboardEvent("keydown", {key: k, bubbles: true, cancelable: true}); el.dispatchEvent(e); return e; };
sel.focus();
sel.selectedIndex = 0;
var vistos = [];
for (var t = 0; t < 4; t++){ tecla(sel, "l"); vistos.push(rotuloSemEmoji(sel.options[sel.selectedIndex].textContent)); await dormir(5); }
ok(vistos.every(function(v){ return v.charAt(0) === "l"; }), "«l» só passa por categorias começadas por L", vistos.join(", "));
ok(vistos[0] !== vistos[1], "carregar outra vez corre para a seguinte", vistos.join(", "));
var comL = Array.prototype.filter.call(sel.options, function(o){ return o.value && rotuloSemEmoji(o.textContent).charAt(0) === "l"; }).length;
ok(comL < 2 || vistos.slice(0, comL).filter(function(v, i, a){ return a.indexOf(v) === i; }).length === Math.min(comL, 4), "e passa por todas antes de dar a volta");
await dormir(950);
tecla(sel, "e"); tecla(sel, "s");
eq(rotuloSemEmoji(sel.options[sel.selectedIndex].textContent).slice(0, 2), "es", "duas letras seguidas procuram o começo («es» → Estética)");
eq(sel.dataset.escolhidaAMao, "1", "e a escolha conta como feita à mão");
await dormir(950);
var e2 = tecla(sel, "z");
ok(!e2.defaultPrevented, "uma letra sem categoria deixa a lista em paz");
var e3 = new KeyboardEvent("keydown", {key: "l", ctrlKey: true, bubbles: true, cancelable: true}); sel.dispatchEvent(e3);
ok(!e3.defaultPrevented, "com Ctrl, a tecla é do navegador");

G("escrita preditiva e categoria pela descrição");
var mvAntes = S.movimentos.length;
S.movimentos.push({id: "mv-qa-pred1", data: MES + "-03", tipo: "despesa", descricao: "Wakeboard Qwerty QA", valor: 12, categoriaId: catPorNome("Alimentação"), membroId: ""});
S.movimentos.push({id: "mv-qa-pred2", data: MES + "-04", tipo: "despesa", descricao: "Wakeboard Qwerty QA", valor: 15, categoriaId: catPorNome("Alimentação"), membroId: ""});
eq(preverDescricao("wakeb"), "Wakeboard Qwerty QA", "completa sem ligar a maiúsculas");
eq(preverDescricao("c"), null, "com uma letra só ainda não adivinha");
eq(preverDescricao("Wakeboard Qwerty QA"), null, "o que já está completo não se completa");
ok(descricoesConhecidas().indexOf("Wakeboard Qwerty QA") >= 0, "as descrições conhecidas vêm dos movimentos");
irPagina("movimentos");
if (q("#mvDesc") == null && q('[data-act="abrirForm"]')) q('[data-act="abrirForm"]').click();
var desc = q("#mvDesc"), mvCat = q("#mvCat");
if (ok(desc != null && mvCat != null, "o formulário do movimento tem descrição e categoria")){
  mvCat.value = ""; delete mvCat.dataset.escolhidaAMao;
  desc.value = "Wake"; desc.setSelectionRange(4, 4);
  desc.dispatchEvent(new InputEvent("input", {bubbles: true, inputType: "insertText", data: "t"}));
  eq(desc.value, "Wakeboard Qwerty QA", "a escrita completa-se");
  eq([desc.selectionStart, desc.selectionEnd].join("-"), "4-19", "com o resto selecionado, para continuar a escrever por cima");
  tecla(desc, "Tab");
  eq(desc.selectionStart, desc.value.length, "Tab aceita a sugestão");
  eq(nomeCat(mvCat.value), "Alimentação", "e a categoria vem atrás, pelo histórico");
  desc.value = "Wakex"; desc.setSelectionRange(5, 5);
  desc.dispatchEvent(new InputEvent("input", {bubbles: true, inputType: "insertText", data: "x"}));
  eq(desc.value, "Wakex", "sem nada parecido, fica o que se escreveu");
  desc.value = "Wakeboard Qwerty Q"; desc.setSelectionRange(18, 18);
  desc.dispatchEvent(new InputEvent("input", {bubbles: true, inputType: "deleteContentBackward"}));
  eq(desc.value, "Wakeboard Qwerty Q", "apagar não completa");
  mvCat.value = catPorNome("Saúde"); mvCat.dataset.escolhidaAMao = "1";
  desc.value = "Wakeboard Qwerty QA"; categoriaPelaDescricao(desc);
  eq(nomeCat(mvCat.value), "Saúde", "uma categoria escolhida à mão não é trocada");
}
eq(nomeCat(categoriaPorPalavras("COMPRA PINGO DOCE LISBOA")), "Alimentação", "palavras dos bancos: supermercado");
eq(nomeCat(categoriaPorPalavras("GALP ENERGIA SA")), "Eletricidade e gás", "a Galp Energia é luz e gás");
eq(nomeCat(categoriaPorPalavras("GALP AREEIRO")), "Transportes", "e o posto da Galp é transporte");
eq(nomeCat(categoriaPorPalavras("COMISSAO DE MANUTENCAO DE CONTA")), "Comissões Bancárias", "comissões do banco");
eq(nomeCat(categoriaPorPalavras("Holmes Place Saldanha")), "Ginásios e Fitness", "ginásio");
eq(nomeCat(categoriaPorPalavras("Cabeleireiro Rita")), "Estética e Cuidados Pessoais", "cabeleireiro");
eq(nomeCat(categoriaPorPalavras("Lavandaria 5 a sec")), "Lavandaria", "lavandaria");
eq(nomeCat(categoriaPorPalavras("Babysitting Joana")), "Nanny e Babysitting", "babysitting");
eq(categoriaPorPalavras("XYZ 123"), "", "sem palavra conhecida, nenhuma");
S.movimentos = S.movimentos.filter(function(m){ return !/^mv-qa-pred/.test(m.id); });
eq(S.movimentos.length, mvAntes, "(arrumado)");

G("despesas em dias da semana");
eq(vezesNoMes("2026-11", [2, 4]), 8, "terças e quintas de novembro de 2026: 8");
eq(vezesNoMes("2026-12", [2, 4]), 10, "de dezembro de 2026: 10");
eq(diasDaSemanaNoMes("2026-11", [6]).join(","), "7,14,21,28", "os sábados de novembro de 2026");
eq(vezesNoMes("2026-02", [0, 1, 2, 3, 4, 5, 6]), 28, "todos os dias de fevereiro de 2026: 28");
eq(rotuloDiasSemana([2, 4]), "Todas as terças e quintas", "o rótulo diz os dias por extenso");
eq(rotuloDiasSemana([6]), "Todos os sábados", "e no masculino quando é o caso");
eq(rotuloDiasSemana([0, 1, 2, 3, 4, 5, 6]), "Todos os dias", "todos os dias");
var rds = {id: "rec-qa-ds", tipo: "despesa", nome: "Explicações QA", valor: 15, frequencia: "diasSemana", diasSemana: [2, 4], categoriaId: catPorNome("Educação"), ativo: true};
eq(recMensal(rds, "2026-11"), 120, "15 € às terças e quintas: 120 € em novembro");
eq(recMensal(rds, "2026-12"), 150, "e 150 € em dezembro");
var antesPlano = calcularPlanoMes("2026-12").desp;
S.recorrentes.push(rds);
ok(Math.abs(calcularPlanoMes("2026-12").desp - antesPlano - 150) < 0.01, "o plano do mês conta as vezes desse mês");
S.recorrentes = S.recorrentes.filter(function(r){ return r.id !== "rec-qa-ds"; });
var norm = normalizar({recorrentes: [{id: "r1", tipo: "despesa", nome: "x", valor: 1, frequencia: "diasSemana", diasSemana: ["2", 9, 4, 4], dia: 12}]}).recorrentes[0];
eq(JSON.stringify(norm.diasSemana), "[2,4]", "normalizar guarda só dias válidos, por ordem");
eq(norm.dia, "", "e sem dia do mês");
irPagina("plano"); editando.rec = null; render();
mudar(q("#rcFreq"), "diasSemana");
ok(!q("#rcDiasBox").hidden && q("#rcDiaBox").hidden, "escolher dias da semana mostra os dias e esconde o dia do mês");
eq(q("#rcValorRot").textContent, "Valor por vez (€)", "e o valor passa a ser por vez");
q("#rcNome").value = "Natação QA"; q("#rcValor").value = "12"; mudar(q("#rcCat"), catPorNome("Lazer e cultura") || q("#rcCat").options[1].value);
var nRec = S.recorrentes.length;
q('[data-act="recSalvar"]').click();
eq(S.recorrentes.length, nRec, "sem dias escolhidos não grava");
qa('input[name="rcDiaSem"]').forEach(function(c){ c.checked = c.value === "6"; });
q("#rcValor").dispatchEvent(new Event("input", {bubbles: true}));
ok(/\d+ (vez|vezes)/.test(q("#rcDiasCalc").textContent), "o cálculo do mês aparece ao escolher", q("#rcDiasCalc").textContent);
q('[data-act="recSalvar"]').click();
var nat = S.recorrentes.find(function(r){ return r.nome === "Natação QA"; });
ok(nat && nat.frequencia === "diasSemana" && nat.diasSemana.join() === "6", "grava com os sábados");
ok(qa("td").some(function(td){ return /Todos os sábados/.test(td.textContent) && /× este mês/.test(td.textContent); }), "a lista diz «Todos os sábados» e quantas vezes este mês");
S.recorrentes = S.recorrentes.filter(function(r){ return r.nome !== "Natação QA"; }); render();

G("o agregado: cor, adultos e crianças");
vazio();
S.membros.push({id: "mb-qa1", nome: "Ana", papel: "adulto", nascimento: "", icone: "👩", cor: "#2f5fd0"});
irPagina("config");
ok(q(".pessoas .pessoa") != null, "cada pessoa é um cartão à vista");
var cor = q('input.corPessoa[data-id="mb-qa1"]');
var clique = new MouseEvent("click", {bubbles: true, cancelable: true});
cor.dispatchEvent(clique);
ok(!clique.defaultPrevented, "clicar na cor deixa a paleta abrir");
mudar(cor, "#ff0000");
eq(membro("mb-qa1").cor, "#ff0000", "e escolher uma cor grava-a");
var cliqueSel = new MouseEvent("click", {bubbles: true, cancelable: true});
q('select[data-act="mbIcone"]').dispatchEvent(cliqueSel);
ok(!cliqueSel.defaultPrevented, "clicar no rosto deixa a lista abrir");
q("#mbNome").value = "Tomás";
q('[data-act="mbAdd"][data-v="crianca"]').click();
var tomas = S.membros.find(function(m){ return m.nome === "Tomás"; });
ok(tomas && tomas.papel === "crianca", "«Adicionar criança» acrescenta uma criança");
q("#mbNome").value = "";
var nM = S.membros.length;
q('[data-act="mbAdd"][data-v="adulto"]').click();
eq(S.membros.length, nM, "sem nome não acrescenta");
var ano = document.getElementById("mbAno-" + tomas.id);
mudar(ano, "2018");
eq(membro(tomas.id).nascimento, 2018, "o ano de nascimento grava");
ok(/\d+ anos/.test(q('.pessoa .pessoaAno .muted') ? qa(".pessoaAno").map(function(e){ return e.textContent; }).join(" ") : ""), "e a idade aparece");
ano = document.getElementById("mbAno-" + tomas.id);
mudar(ano, "1700");
eq(membro(tomas.id).nascimento, 2018, "um ano impossível não grava");
mudar(q('.nomePessoa[data-id="' + tomas.id + '"]'), "Tomás Silva");
eq(membro(tomas.id).nome, "Tomás Silva", "o nome muda no próprio cartão");
mudar(q('.nomePessoa[data-id="' + tomas.id + '"]'), "   ");
eq(membro(tomas.id).nome, "Tomás Silva", "um nome vazio não apaga o que lá estava");
S.fiscal.dependentes = 0; render();
ok(q('[data-act="mbDependentes"]') != null, "com 1 criança e 0 dependentes, oferece acertar o IRS");
q('[data-act="mbDependentes"]').click();
eq(S.fiscal.dependentes, 1, "e acerta");
ok(q('[data-act="mbDependentes"]') == null, "depois disso a sugestão desaparece");
q('[data-act="mbPapel"][data-id="' + tomas.id + '"][data-v="adulto"]').click();
eq(membro(tomas.id).papel, "adulto", "o botão Adulto/Criança troca o papel");
S.membros = []; S.fiscal.dependentes = 2; render();
ok(q('[data-act="mbDependentes"]') == null, "sem crianças no agregado, não sugere zerar os dependentes");
var nm = normalizar({membros: [{id: "a", nome: "X"}, {id: "b", nome: "Y", papel: "crianca", nascimento: "1800"}, {id: "c", nome: "Z", papel: "outro", nascimento: "2015"}]}).membros;
eq(nm.map(function(m){ return m.papel; }).join(), "adulto,crianca,adulto", "normalizar: adulto por omissão");
eq(nm.map(function(m){ return m.nascimento; }).join(), ",,2015", "e só anos possíveis");

G("boas-vindas: nomes e crianças");
vazio(); ui.perfil = null; ui.boasPasso = 1; editando = {};
irPagina("painel");
q('[data-act="perfilAgregado"][data-k="familia"]').click();
eq(qa('[id^="boasAdulto"]').length, 2, "a família pede o nome dos dois adultos");
eq(qa('[id^="boasFilhoN"]').length, 2, "e começa com duas crianças");
q("#boasAdulto0").value = "Rita"; q("#boasAdulto1").value = "Nuno";
q('[data-act="boasFilhos"][data-v="1"]').click();
eq(qa('[id^="boasFilhoN"]').length, 3, "«+» acrescenta uma criança");
eq(q("#boasAdulto0").value, "Rita", "sem perder o que já se escreveu");
q("#boasFilhoN0").value = "Leonor"; q("#boasFilhoA0").value = "2019";
q('[data-act="boasFilhos"][data-v="-1"]').click();
eq(qa('[id^="boasFilhoN"]').length, 2, "«−» tira uma");
eq(q("#boasFilhoN0").value, "Leonor", "a primeira continua com o nome");
q('[data-act="perfilAgregado"][data-k="sozinho"]').click();
eq(qa('[id^="boasAdulto"]').length, 1, "sozinho pede um nome");
eq(qa('[id^="boasFilhoN"]').length, 2, "e quem já mexeu nas crianças fica com elas");
q('[data-act="perfilAgregado"][data-k="familia"]').click();
q('[data-act="boasPasso"][data-v="2"]').click();
eq(ui.boasPasso, 2, "«Seguinte» passa ao segundo passo");
var lrs = PERFIS_AGREGADO.familia.rubricas;
ok(rubricasDoAgregado("familia", 2) === lrs, "com as duas crianças do perfil, o plano é o do perfil");
var tres = rubricasDoAgregado("familia", 3, 2).map(function(r){ return r[0] + "=" + r[2]; }).join("|");
ok(/\(3\)=420/.test(tres), "com três, as despesas das crianças são por três", tres);
ok(rubricasDoAgregado("familia", 0, 2).every(function(r){ return !/crian|escola|Creche/i.test(r[0]); }), "sem crianças, nada de escola");
ok(rubricasDoAgregado("sozinho", 1, 1).some(function(r){ return /Creche/.test(r[0]); }), "um adulto com uma criança também tem escola");
vazio();
aplicarPerfil("familia", "arrendada", "credito", {adultos: ["Rita", ""], filhos: [{nome: "Leonor", ano: "2019"}, {nome: "", ano: ""}, {nome: "Rui", ano: "3000"}]});
eq(S.membros.map(function(m){ return m.nome; }).join(), "Rita,Adulto 2,Leonor,Criança 2,Rui".replace("Adulto 2", PERFIS_AGREGADO.familia.membros[1]), "aplica os nomes, com os do perfil onde ficou em branco");
eq(S.membros.filter(function(m){ return m.papel === "crianca"; }).length, 3, "três crianças");
eq(S.membros.find(function(m){ return m.nome === "Leonor"; }).nascimento, 2019, "com o ano de nascimento");
eq(S.membros.find(function(m){ return m.nome === "Rui"; }).nascimento, "", "um ano impossível fica em branco");
eq(S.fiscal.dependentes, 3, "e as crianças são os dependentes do IRS");
ok(S.recorrentes.some(function(r){ return /\(3\)/.test(r.nome); }), "e o plano conta três crianças");
vazio(); ui.perfil = null;

G("poupança e investimento regular");
vazio();
S.ativos.push({id: "pt-qa-etf", nome: "ETF mundial QA", classe: "etf", aquisicao: 1000, atual: 1100, aportes: [], encargos: [], rendimentos: [], contribuicao: 0});
S.recorrentes.push({id: "rec-qa-luz", tipo: "despesa", nome: "Luz QA", valor: 60, frequencia: "mensal", categoriaId: catPorNome("Eletricidade e gás"), ativo: true});
var p0 = calcularPlanoMes(MES);
eq(p0.poup, 0, "sem poupança regular, nada à parte");
irPagina("poupanca");
ok(q("#ppNome") != null, "a página «Poupança regular» tem o seu formulário");
ok(DESTINOS.find(function(d){ return d.k === "orcamento"; }).paginas.indexOf("poupanca") >= 0, "e está no Orçamento");
ok(CRIAVEIS.some(function(c){ return c.pag === "poupanca"; }), "e no menu Criar");
mudar(q("#ppInstrumento"), "etf");
eq(nomeCat(q("#ppCat").value), "Investimentos", "um ETF vai para Investimentos");
eq(q("#ppAtivo").value, "pt-qa-etf", "e sugere o ativo da mesma classe");
mudar(q("#ppInstrumento"), "aforro");
eq(nomeCat(q("#ppCat").value), "Poupança programada", "Certificados de Aforro vão para Poupança programada");
eq(q("#ppAtivo").value, "", "e sem ativo da mesma classe, sem ligação");
mudar(q("#ppInstrumento"), "etf");
q("#ppNome").value = ""; q("#ppValor").value = "200";
var nR = S.recorrentes.length;
q('[data-act="ppSalvar"]').click();
eq(S.recorrentes.length, nR, "sem designação não grava");
q("#ppNome").value = "ETF todos os meses"; q("#ppValor").value = "0";
q('[data-act="ppSalvar"]').click();
eq(S.recorrentes.length, nR, "sem valor não grava");
q("#ppValor").value = "200"; q("#ppDia").value = "8";
q('[data-act="ppSalvar"]').click();
var pp = S.recorrentes.find(function(r){ return r.nome === "ETF todos os meses"; });
ok(pp && pp.poupanca && pp.instrumento === "etf" && pp.ativoId === "pt-qa-etf" && pp.tipo === "despesa" && pp.dia === 8, "grava como poupança, com instrumento, ativo e dia", JSON.stringify(pp));
eq(S.ativos[0].contribuicao, 200, "o ativo sem reforço previsto passa a ter este");
var p1 = calcularPlanoMes(MES);
ok(Math.abs(p1.poup - 200) < 0.01, "o plano conta 200 € de poupança à parte");
ok(Math.abs(p1.desp - p0.desp - 200) < 0.01, "e continuam a sair do saldo");
eq(q(".ppItem") != null, true, "a página lista a entrega");
ok(/10 anos/.test(q("#conteudo, main, body").textContent), "e projeta 10 anos");
irPagina("plano");
ok(!qa("td").some(function(td){ return td.textContent === "ETF todos os meses"; }), "as despesas fixas não a mostram");
ok(qa(".note").some(function(n){ return /poupança regular/.test(n.textContent); }), "mas dizem onde está");
S.rendimentos.push({id: "rd-qa", nome: "Salário QA", membroId: "", ativo: true, componentes: [{id: "c1", nome: "Base", especie: "outro", valor: 2000, frequencia: "mensal", ss: false, irs: false}]});
var pr = calcularPlanoMes(MES);
ok(pr.rend > 0, "(com rendimento)");
var taxaSem = pr.saldo / pr.rend * 100, taxaCom = (pr.saldo + pr.poup) / pr.rend * 100;
ok(taxaCom - taxaSem > 9, "a poupança regular entra na taxa de poupança", taxaSem.toFixed(1) + " → " + taxaCom.toFixed(1));
eq(Math.round(valorFuturoMensal(100, 0, 1)), 1200, "valor futuro sem retorno: o que se entregou");
ok(valorFuturoMensal(100, 7, 10) > 12000 * 1.3, "com 7%/ano em 10 anos, bastante mais");
aporteDaPoupanca(pp, MES + "-08", 200);
aporteDaPoupanca(pp, MES + "-08", 200);
eq(S.ativos[0].aportes.length, 1, "o lançamento dá um aporte no ativo, uma só vez por data");
eq(S.ativos[0].aquisicao, 1200, "e soma ao capital aplicado");
S.movimentos.push({id: "mv-qa-pp", data: MES + "-08", tipo: "despesa", descricao: "ETF", valor: 200, categoriaId: pp.categoriaId, poupanca: true});
eq(realMes(MES).poup, 200, "os movimentos marcados contam como poupança real");
var np = normalizar({ativos: [], recorrentes: [{id: "a", tipo: "despesa", poupanca: 1, instrumento: "lixo", ativoId: "nao-existe", nome: "x", valor: 1, frequencia: "mensal"},
  {id: "b", tipo: "despesa", nome: "y", valor: 1, frequencia: "mensal", instrumento: "etf", ativoId: "z"}]}).recorrentes;
var na = np.find(function(r){ return r.id === "a"; }), nb = np.find(function(r){ return r.id === "b"; });
ok(na && na.poupanca === true && na.tipo === "despesa" && na.instrumento === "outros" && na.ativoId === "", "normalizar: instrumento e ativo inválidos ficam limpos", JSON.stringify(na));
ok(nb && !("instrumento" in nb) && !("ativoId" in nb), "e uma despesa normal não leva campos de poupança");
irPagina("poupanca");
q('[data-act="ppEditar"]').click();
eq(q("#ppNome").value, "ETF todos os meses", "editar abre a entrega no formulário");
q("#ppValor").value = "250"; q('[data-act="ppSalvar"]').click();
eq(S.recorrentes.find(function(r){ return r.id === pp.id; }).valor, 250, "e grava a alteração no mesmo sítio");

G("importar extrato: categorias e duplicados");
vazio();
S.movimentos.push({id: "mv-qa-x1", data: "2026-10-10", tipo: "despesa", descricao: "Continente compras", valor: 42.3, categoriaId: catPorNome("Alimentação"), membroId: ""});
S.movimentos.push({id: "mv-qa-x2", data: "2026-10-01", tipo: "despesa", descricao: "Gasolina", valor: 55, categoriaId: catPorNome("Transportes"), membroId: "",
  extrato: "2026-10-02|55.00|galp areeiro"});
S.movimentos.push({id: "mv-qa-x3", data: "2026-09-15", tipo: "despesa", descricao: "Farmácia Central", valor: 8, categoriaId: catPorNome("Saúde"), membroId: ""});
ACOES.csvAbrir();
q("#csvTexto").value = "Data;Descrição;Valor\n" +
  "11-10-2026;COMPRA CONTINENTE MATOSINHOS;-42,30\n" +   // provável duplicado (feito à mão no dia 10)
  "02-10-2026;GALP AREEIRO;-55,00\n" +                    // já importado (descrição mudada depois)
  "12-10-2026;FARMACIA CENTRAL;-12,00\n" +                // nova, categoria pelo histórico
  "13-10-2026;ORDENADO EMPRESA;2.100,00\n" +              // rendimento
  "13-10-2026;XPTO LOJA;-9,99\n" +                        // sem sugestão
  "20-10-2026;XPTO LOJA;-5,00\n" +                        // o mesmo comerciante
  "14-10-2026;COMISSAO MANUTENCAO CONTA;-6,24\n" +        // palavra do banco
  "14-10-2026;COMISSAO MANUTENCAO CONTA;-6,24\n" +        // repetida no extrato
  "lixo;;";
ACOES.csvAnalisar();
var L = _csv.linhas;
eq(L.length, 9, "uma linha de revisão por linha do extrato");
eq(L.map(function(x){ return x.estado; }).join(","), "provavel,duplicado,novo,novo,novo,novo,novo,repetido,invalida", "cada linha com o seu estado");
eq(L.map(function(x){ return x.incluir ? 1 : 0; }).join(""), "001111100", "os duplicados e prováveis chegam desmarcados");
eq(nomeCat(L[2].categoriaId) + "/" + L[2].origem, "Saúde/historico", "a farmácia vai para Saúde, como antes");
eq(nomeCat(L[3].categoriaId) + "/" + L[3].tipo, "Vencimento/rendimento", "o ordenado é um rendimento de Vencimento");
eq(nomeCat(L[6].categoriaId) + "/" + L[6].origem, "Comissões Bancárias/palavra", "a comissão vem pelas palavras do banco");
eq(L[4].categoriaId + "/" + L[4].origem, "/", "o desconhecido fica sem sugestão");
ok(/talvez já exista/.test(q("#csvRevisao").textContent) && /já importada/.test(q("#csvRevisao").textContent), "a revisão diz porque cada linha ficou de fora");
ok(/parecida com «Continente compras»/.test(q("#csvRevisao").textContent), "e com que movimento se parece");
eq(q('#csvPasso2 [data-act="csvImportar"]').textContent, "Importar 5 movimento(s)", "o botão diz quantas vão entrar");
var s4 = q('select[data-csv="cat"][data-linha="4"]');
mudar(s4, catPorNome("Brinquedos"));
eq(nomeCat(L[5].categoriaId) + "/" + L[5].origem, "Brinquedos/igual", "mudar a categoria muda a do mesmo comerciante");
eq(nomeCat(q('select[data-csv="cat"][data-linha="5"]').value), "Brinquedos", "também na lista");
var inc = q('input[data-csv="incl"][data-linha="0"]'); inc.checked = true; mudar(inc);
eq(q('#csvPasso2 [data-act="csvImportar"]').textContent, "Importar 6 movimento(s)", "marcar um provável duplicado conta-o");
inc.checked = false; mudar(inc);
q('[data-act="csvTodas"][data-v="nenhuma"]').click();
ok(_csv.linhas.every(function(x){ return !x.incluir; }), "«nenhuma» desmarca tudo");
eq(nomeCat(_csv.linhas[5].categoriaId), "Brinquedos", "sem perder as categorias escolhidas");
q('[data-act="csvTodas"][data-v="novas"]').click();
eq(_csv.linhas.filter(function(x){ return x.incluir; }).length, 5, "«só as novas» volta ao normal");
var antesImp = S.movimentos.length;
q('#csvPasso2 [data-act="csvImportar"]').click();
eq(S.movimentos.length, antesImp + 5, "importa as cinco marcadas");
var imp = S.movimentos.slice(antesImp);
ok(imp.every(function(m){ return /\|/.test(m.extrato || ""); }), "cada movimento guarda de que linha do extrato veio");
eq(imp.filter(function(m){ return /XPTO/.test(m.descricao); }).map(function(m){ return nomeCat(m.categoriaId); }).join(), "Brinquedos,Brinquedos", "com as categorias da revisão");
ok((S.regrasCategoria || []).some(function(r){ return r.padrao === "xpto loja"; }), "e a escolha fica como regra");
var farm = imp.find(function(m){ return /FARMACIA/.test(m.descricao); });
farm.descricao = "Farmácia (editada)";
ACOES.csvAbrir();
q("#csvTexto").value = "Data;Descrição;Valor\n12-10-2026;FARMACIA CENTRAL;-12,00\n25-10-2026;XPTO LOJA OUTRA;-3,00";
ACOES.csvAnalisar();
eq(_csv.linhas[0].estado, "duplicado", "reimportar reconhece a linha, mesmo com a descrição mudada");
eq(nomeCat(_csv.linhas[1].categoriaId) + "/" + _csv.linhas[1].origem, "Brinquedos/regra", "e a regra aprendida já sugere a categoria");
q("#csvAprender").checked = false;
mudar(q('select[data-csv="cat"][data-linha="1"]'), catPorNome("Lazer e cultura") || "");
var nRegras = S.regrasCategoria.length;
q('#csvPasso2 [data-act="csvImportar"]').click();
eq(S.regrasCategoria.length, nRegras, "sem «Lembrar», não acrescenta regras");
ACOES.csvAbrir();
q("#csvTexto").value = "Data;Descrição;Valor\n12-10-2026;FARMACIA CENTRAL;-12,00";
ACOES.csvAnalisar();
var nada = S.movimentos.length;
ok(q('#csvPasso2 [data-act="csvImportar"]').disabled, "só duplicados: o botão de importar fica desligado");
ACOES.csvImportar();
eq(S.movimentos.length, nada, "e não importa nada");
ok(toasts.some(function(t){ return /Nada para importar/.test(t); }), "e diz porquê");
if (q("#modalHost .overlay")) q("#modalHost").innerHTML = "";
eq(chaveComerciante("COMPRA C/DEB 1234 CONTINENTE MATOSINHOS"), "continente matosinhos", "o comerciante sem o que o banco acrescenta");
ok(descricoesParecidas("Continente", "COMPRA CONTINENTE MATOSINHOS"), "descrições parecidas: o nome contido");
ok(!descricoesParecidas("Farmácia", "Galp Areeiro"), "e diferentes quando nada tem a ver");
}

function arrumar(){
  toast = toastOrig; confirmar = confirmarOrig;
  if (q("#modalHost")) q("#modalHost").innerHTML = "";
  _csv = null; ui.perfil = null;
  try { editando = JSON.parse(EDIT0); } catch(e){ editando = {}; }
  var ks = []; for (var i = 0; i < localStorage.length; i++) ks.push(localStorage.key(i));
  ks.forEach(function(k){ if (!(k in disco)) localStorage.removeItem(k); });
  Object.keys(disco).forEach(function(k){ localStorage.setItem(k, disco[k]); });
  try { S = normalizar(JSON.parse(S0)); } catch(e){}
  MES = MES0;
  try { irPara(VIEW0); } catch(e){}
  if (typeof _sessaoT !== "undefined") clearTimeout(_sessaoT);
  Object.keys(disco).forEach(function(k){ localStorage.setItem(k, disco[k]); });
}
window.__QAREG = null;
correr().catch(function(e){ falhas.push({grupo: grupo, teste: "a suite correu até ao fim", detalhe: e && (e.stack || e.message)}); })
  .then(function(){
    arrumar();
    window.__QAREG = {total: passes + falhas.length, passes: passes, falhas: falhas.length, detalhe: falhas};
    console.log("QA registo:", passes + "/" + (passes + falhas.length));
  });
})();
