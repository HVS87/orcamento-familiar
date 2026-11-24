/* ============================================================
   Suite de QA — sincronização, dois ecrãs e instalação (2.1)

   Carregue-a na aplicação como as outras e espere por window.__QASINC
   (é assíncrona: a cifra e a rede não respondem na hora). Com
   window.__QASINC_REDE = false salta a troca real pelo serviço público.

   Prova que:
   - juntar a três guarda o que cada lado mudou, apaga o que foi apagado,
     e só escolhe quando os dois mexeram na mesma coisa;
   - dois e três aparelhos acabam iguais, com mensagens perdidas, fora de
     ordem, anexos expirados e aparelhos desligados a meio;
   - a cifra não deixa passar texto às claras, nem aceita bytes adulterados;
   - o código QR tem a estrutura certa;
   - a página liga, desliga e emparelha pela ligação do QR;
   - a janela companheira segue a principal e recebe os detalhes;
   - «Instalar como app» aparece onde deve.
   Devolve o armazenamento como o encontrou, ao byte.
   ============================================================ */
(function(){
"use strict";
var falhas = [], passes = 0, grupo = "";
function G(n){ grupo = n; }
function ok(c, nome, det){ if (c){ passes++; return true; } falhas.push({grupo: grupo, teste: nome, detalhe: det == null ? "" : String(det)}); return false; }
function eq(a, b, nome){ return ok(a === b, nome, "obtido " + JSON.stringify(a) + ", esperado " + JSON.stringify(b)); }
var dormir = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };

/* O armazenamento como estava, para o devolver no fim */
var disco = {};
for (var i = 0; i < localStorage.length; i++){ var k = localStorage.key(i); disco[k] = localStorage.getItem(k); }
var S0 = JSON.stringify(S), MES0 = MES, VIEW0 = VIEW, ui0 = JSON.stringify(ui);
var transporteOriginal = transporteNtfy;
var SINC0 = SINC;
if (SINC){ SINC.desligar(); SINC = null; }

/* Um gerador com semente: o mesmo teste falha sempre da mesma maneira */
function aleatorio(semente){
  var s = semente >>> 0 || 1;
  return function(){ s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
function estadoBase(){
  var e = normalizar(estadoVazio());
  e.movimentos = [];
  return e;
}
function mov(id, desc, valor){
  return {id: id, tipo: "despesa", data: "2026-11-0" + (1 + (id.length % 8)), descricao: desc, valor: valor, categoriaId: S.categorias[0] ? S.categorias[0].id : "", membroId: ""};
}

/* Uma caixa de passagem em memória, com as maldades da rede real à mão */
function caixaFalsa(){
  var c = {msgs: [], anexos: {}, seq: 0, ouvintes: [], pausado: false, falhar: false, baralhar: false};
  function entregar(m){
    c.ouvintes.forEach(function(o){
      if (c.pausado || !o.ativo) return;
      setTimeout(function(){ if (o.ativo) o.aoMsg(m); }, c.baralhar ? Math.floor(Math.random() * 25) : 0);
    });
  }
  c.transporte = function(){
    return {
      publicarEstado: function(bytes, meta){
        if (c.falhar) return Promise.reject(new Error("sem rede"));
        var id = "m" + (++c.seq);
        c.anexos[id] = bytes;
        var m = {id: id, event: "message", time: Date.now(), message: meta, attachment: {url: "falso://" + id}};
        c.msgs.push(m); entregar(m);
        return Promise.resolve(m);
      },
      publicarTexto: function(meta){
        if (c.falhar) return Promise.reject(new Error("sem rede"));
        var m = {id: "m" + (++c.seq), event: "message", time: Date.now(), message: meta};
        c.msgs.push(m); entregar(m);
        return Promise.resolve();
      },
      desde: function(desde){
        if (c.falhar) return Promise.reject(new Error("sem rede"));
        var i = c.msgs.findIndex(function(m){ return m.id === desde; });
        return Promise.resolve(c.msgs.slice(i + 1));
      },
      baixar: function(url){
        var id = String(url).replace("falso://", "");
        if (c.falhar || !c.anexos[id]) return Promise.reject(new Error("404"));
        return Promise.resolve(c.anexos[id]);
      },
      escutar: function(desde, aoMsg, aoEstado){
        var o = {aoMsg: aoMsg, ativo: true};
        c.ouvintes.push(o); aoEstado(true);
        return function(){ o.ativo = false; };
      },
    };
  };
  c.expirarAnexos = function(){ c.anexos = {}; };
  return c;
}
/* Um aparelho de faz-de-conta: estado próprio, base própria, o motor verdadeiro */
function aparelho(nome, chave, caixa, inicial){
  var a = {nome: nome, S: inicial || estadoBase(), versoes: {}, meta: {}, aplicacoes: 0};
  a.motor = criarSinc({
    chave: chave, eu: {id: nome, nome: nome}, transporte: caixa.transporte(nome), atraso: 4, intervaloPedidos: 0,
    ler: function(){ return estadoParaSinc(a.S); },
    aplicar: function(M, info){ a.S = normalizar(JSON.parse(JSON.stringify(M))); a.aplicacoes++; if (info.concluir) info.concluir(); },
    vazio: function(x){ return semDadosProprios(x, false); },
    normalizar: function(M){ return estadoParaSinc(normalizar(JSON.parse(JSON.stringify(M)))); },
    meta: {ler: function(){ return a.meta; }, gravar: function(p){ Object.assign(a.meta, p); }},
    versoes: {ler: function(){ return a.versoes; }, gravar: function(v){ a.versoes = v; }},
    aoMudar: function(){},
  });
  a.editar = function(fn){ fn(a.S); a.motor.mudou(); };
  a.json = function(){ return jsonEstavel(estadoParaSinc(a.S)); };
  return a;
}
/** Espera que a conversa acalme: nenhuma mensagem nova e as filas vazias. */
async function calma(caixa, aps, limite){
  var fim = Date.now() + (limite || 8000), n = -1, estavel = 0;
  while (Date.now() < fim){
    await Promise.all(aps.map(function(a){ return a.motor._fila(); }));
    await dormir(40);
    if (caixa.msgs.length === n) { if (++estavel >= 3) return true; }
    else { estavel = 0; n = caixa.msgs.length; }
  }
  return false;
}

async function correr(){
var chave = (await sincChaves("ABCDE-FGHJK-MNPQR-STVWX-YZ012")).chave;

G("JSON estável");
eq(jsonEstavel({b: 1, a: [1, {d: 2, c: 3}]}), jsonEstavel({a: [1, {c: 3, d: 2}], b: 1}), "a ordem das chaves não conta");
eq(jsonEstavel({a: undefined, b: null}), '{"b":null}', "indefinido não se escreve; nulo sim");
eq(jsonEstavel([undefined]), "[null]", "indefinido numa lista é nulo, como no JSON");
ok(jsonEstavel({a: 1}) !== jsonEstavel({a: "1"}), "número e texto distinguem-se");
eq(jsonEstavel(NaN), "null", "NaN escreve-se nulo");

G("peças e versões");
var est = {movimentos: [{id: "a", valor: 1}, {id: "b", valor: 2}], fiscal: {taxa: 10, dep: 1}, notas: {"2026-01": "x"}, cenarios: [{nome: "c"}], version: 1,
  patrimonioHist: [{mes: "2026-01", ativo: 1}], regrasCategoria: [{padrao: "LIDL", categoriaId: "k"}], alertasAdiados: {"nov|um.dois/três": "2027-01-01"}};
var un = unidades(est);
ok(un.has("movimentos/a") && un.has("movimentos/b") && un.has("movimentos#"), "cada movimento é uma peça, e a ordem outra");
ok(un.has("fiscal.taxa") && un.has("notas.2026-01"), "cada entrada dos mapas é uma peça");
ok(un.has("cenarios") && un.has("version"), "listas sem chave e valores simples são uma peça inteira");
ok(un.has("patrimonioHist/2026-01") && un.has("regrasCategoria/LIDL"), "o património vai pelo mês e as regras pelo padrão");
ok(un.has("alertasAdiados.nov|um.dois/três"), "chaves com pontos e barras não confundem");
eq(jsonEstavel(montar(un)), jsonEstavel(est), "partir e voltar a montar dá o mesmo estado");
var semOrdem = new Map(un); semOrdem.delete("movimentos#");
eq(montar(semOrdem).movimentos.map(function(m){ return m.id; }).join(""), "ab", "sem a ordem, os registos ficam pela chave");
var dupl = {movimentos: [{id: "a"}, {id: "a"}]};
ok(unidades(dupl).has("movimentos"), "ids repetidos: a lista é uma peça só, para não se perder nada");
ok(marca("abc") === marca("abc") && marca("abc") !== marca("abd") && marca("") !== marca(" "), "impressões digitais estáveis e distintas");
ok(compararVersao([2, "a"], [1, "z"]) > 0 && compararVersao([1, "b"], [1, "a"]) > 0 && compararVersao(undefined, [0, ""]) < 0, "ganha a mais recente; no empate, o aparelho");

G("juntar — casos");
function V(e, t, de){ var o = {}; unidades(e).forEach(function(v, n){ o[n] = [t, de, marcaDe(v)]; }); return o; }
var base = {movimentos: [{id: "a", valor: 1}, {id: "b", valor: 2}], fiscal: {taxa: 10, dep: 1}};
var VB = V(base, 10, "X");
var L1 = JSON.parse(JSON.stringify(base)); L1.movimentos[0].valor = 5;
var VL1 = Object.assign({}, VB, {"movimentos/a": [20, "L", marcaDe(L1.movimentos[0])]});
var R1 = JSON.parse(JSON.stringify(base)); R1.fiscal.taxa = 12;
var VR1 = Object.assign({}, VB, {"fiscal.taxa": [21, "R", marcaDe(12)]});
var m1 = fundirVersoes(L1, VL1, R1, VR1);
ok(m1.M.movimentos[0].valor === 5 && m1.M.fiscal.taxa === 12, "cada lado mudou uma coisa diferente: ficam as duas", JSON.stringify(m1.M));
var m1b = fundirVersoes(R1, VR1, L1, VL1);
eq(jsonEstavel(m1b.M), jsonEstavel(m1.M), "visto do outro lado, o mesmo resultado");
eq(jsonEstavel(m1b.VM), jsonEstavel(m1.VM), "e as mesmas versões");
var R2 = JSON.parse(JSON.stringify(base)); R2.movimentos[0].valor = 9;
var VR2 = Object.assign({}, VB, {"movimentos/a": [25, "R", marcaDe(R2.movimentos[0])]});
eq(fundirVersoes(L1, VL1, R2, VR2).M.movimentos[0].valor, 9, "a mesma coisa nos dois: ganha a alteração mais recente");
eq(fundirVersoes(R2, VR2, L1, VL1).M.movimentos[0].valor, 9, "… seja qual for o lado");
var L3 = {movimentos: [base.movimentos[1]], fiscal: base.fiscal};
var VL3 = Object.assign({}, VB, {"movimentos/a": [30, "L", null], "movimentos#": [30, "L", marcaDe(["b"])]});
var m3 = fundirVersoes(L3, VL3, base, VB);
ok(m3.M.movimentos.length === 1 && m3.M.movimentos[0].id === "b", "apagado aqui depois da última alteração de lá: fica apagado");
ok(m3.VM["movimentos/a"] && m3.VM["movimentos/a"][2] === null, "e a marca de apagado viaja");
var m3b = fundirVersoes(base, VB, L3, VL3);
ok(m3b.M.movimentos.length === 1, "uma mensagem velha de lá não o faz voltar");
var R4 = JSON.parse(JSON.stringify(base)); R4.movimentos[0].valor = 77;
var VR4 = Object.assign({}, VB, {"movimentos/a": [40, "R", marcaDe(R4.movimentos[0])]});
ok(fundirVersoes(L3, VL3, R4, VR4).M.movimentos.some(function(m){ return m.id === "a" && m.valor === 77; }), "apagado aqui mas mudado lá depois: volta, com a mudança");
var L5 = {movimentos: base.movimentos.concat([{id: "c"}]), fiscal: base.fiscal};
var VL5 = Object.assign({}, VB, {"movimentos/c": [50, "L", marcaDe({id: "c"})], "movimentos#": [50, "L", marcaDe(["a", "b", "c"])]});
var R5 = {movimentos: base.movimentos.concat([{id: "d"}]), fiscal: base.fiscal};
var VR5 = Object.assign({}, VB, {"movimentos/d": [51, "R", marcaDe({id: "d"})], "movimentos#": [51, "R", marcaDe(["a", "b", "d"])]});
var m5 = fundirVersoes(L5, VL5, R5, VR5), m5b = fundirVersoes(R5, VR5, L5, VL5);
eq(m5.M.movimentos.map(function(m){ return m.id; }).join(""), "abdc", "criados dos dois lados: ficam todos, pela ordem mais recente e o resto no fim");
eq(jsonEstavel(m5.M), jsonEstavel(m5b.M), "com a mesma ordem dos dois lados");
var idem = fundirVersoes(m5.M, m5.VM, m5.M, m5.VM);
eq(jsonEstavel(idem.M), jsonEstavel(m5.M), "juntar consigo próprio não muda nada");

G("juntar — propriedades, ao acaso");
(function(){
  var rnd = aleatorio(4242);
  function replica(de, t0){
    var e = {movimentos: [], notas: {}, fiscal: {dep: 0}}, Vr = {}, t = t0;
    return {de: de, e: e, V: Vr, mexer: function(){
      t += 1 + Math.floor(rnd() * 3);
      var r = rnd();
      if (r < 0.5){ var id = de + t; e.movimentos.push({id: id, v: t}); }
      else if (r < 0.7 && e.movimentos.length){ e.movimentos[Math.floor(rnd() * e.movimentos.length)].v = t; }
      else if (r < 0.85 && e.movimentos.length){ e.movimentos.splice(Math.floor(rnd() * e.movimentos.length), 1); }
      else e.notas["m" + Math.floor(rnd() * 3)] = de + t;
      var u = unidades(e);
      u.forEach(function(v, n){ var h = marcaDe(v); if (!Vr[n] || Vr[n][2] !== h) Vr[n] = [t, de, h]; });
      Object.keys(Vr).forEach(function(n){ if (!u.has(n) && Vr[n][2] !== null) Vr[n] = [t, de, null]; });
    }};
  }
  var falhou = {com: 0, ass: 0, idem: 0};
  /* A ordem realizada depois de juntar ganha versão nova no motor (uma volta
     a mais de mensagens); aqui, sem motor, compara-se o conteúdo. */
  function semOrdem(e){ var o = JSON.parse(JSON.stringify(e)); o.movimentos.sort(function(x, y){ return x.id < y.id ? -1 : 1; }); return o; }
  for (var k = 0; k < 60; k++){
    var a = replica("a", 0), b = replica("b", 1), c = replica("c", 2);
    for (var i = 0; i < 12; i++){ [a, b, c][Math.floor(rnd() * 3)].mexer(); }
    var ab = fundirVersoes(a.e, a.V, b.e, b.V), ba = fundirVersoes(b.e, b.V, a.e, a.V);
    if (jsonEstavel(ab.M) !== jsonEstavel(ba.M) || jsonEstavel(ab.VM) !== jsonEstavel(ba.VM)) falhou.com++;
    var ab_c = fundirVersoes(ab.M, ab.VM, c.e, c.V);
    var bc = fundirVersoes(b.e, b.V, c.e, c.V), a_bc = fundirVersoes(a.e, a.V, bc.M, bc.VM);
    if (jsonEstavel(semOrdem(ab_c.M)) !== jsonEstavel(semOrdem(a_bc.M))) falhou.ass++;
    var aa = fundirVersoes(ab.M, ab.VM, ab.M, ab.VM);
    if (jsonEstavel(aa.M) !== jsonEstavel(ab.M)) falhou.idem++;
  }
  eq(falhou.com, 0, "comutativa: A com B dá o mesmo que B com A (60 casos)");
  eq(falhou.ass, 0, "associativa no conteúdo: (A com B) com C dá o mesmo que A com (B com C)");
  eq(falhou.idem, 0, "idempotente: juntar outra vez o mesmo não muda nada");
})();

G("identificadores alinhados");
var cats = function(pref){ return [{id: pref + "1", nome: "Alimentação", tipo: "despesa"}, {id: pref + "2", nome: "Vencimento", tipo: "rendimento"}]; };
var LL = {categorias: cats("cat-b"), movimentos: [{id: "m1", categoriaId: "cat-b1"}], limites: {"cat-b1": 300}};
var RR = {categorias: cats("cat-a").concat([{id: "cat-a9", nome: "Só lá", tipo: "despesa"}]), movimentos: [{id: "m2", categoriaId: "cat-a1"}], limites: {}};
var mp = alinharIds(LL, RR);
eq(mp.get("cat-b1"), "cat-a1", "a mesma categoria fica com um id só (o menor)");
eq(alinharIds(RR, LL).get("cat-b1"), "cat-a1", "e do outro lado escolhe-se o mesmo");
var LLc = trocarIds(LL, mp);
ok(LLc.movimentos[0].categoriaId === "cat-a1" && LLc.limites["cat-a1"] === 300 && !("cat-b1" in LLc.limites), "os movimentos e os limites seguem-na");
var VLL = trocarIdsVersoes({"categorias/cat-b1": [5, "L", "x"], "limites.cat-b1": [6, "L", "y"], "categorias/cat-a1": [9, "R", "z"]}, mp);
ok(VLL["limites.cat-a1"] && VLL["categorias/cat-a1"][0] === 9 && !VLL["categorias/cat-b1"], "as versões mudam de nome, e na colisão fica a mais recente", JSON.stringify(VLL));
ok(trocarIds(LL, new Map()) === LL, "sem nada para alinhar, não copia");

G("o que é de cada aparelho");

var comTema = normalizar(estadoVazio()); comTema.paleta = "areia"; comTema.texto = "grande"; comTema.exemploDemo = true;
var viaja = estadoParaSinc(comTema);
ok(!("paleta" in viaja) && !("texto" in viaja) && !("exemploDemo" in viaja) && !("tutorialVisto" in viaja), "paleta, texto, exemplo e visita não viajam");
ok("movimentos" in viaja && "fiscal" in viaja && "categorias" in viaja, "os dados viajam");
ok(semDadosProprios(estadoParaSinc(estadoVazio())), "um estado novo não tem dados próprios");
ok(!semDadosProprios({movimentos: [{id: 1}]}), "com um movimento já tem");
ok(semDadosProprios({movimentos: [{id: 1}]}, true), "o exemplo conta como não ter");

G("código de ligação e cifra");
var cod = codigoNovo();
ok(/^[0-9A-Z]{5}(-[0-9A-Z]{5}){4}$/.test(cod), "o código tem cinco grupos de cinco", cod);
ok(!/[ILOU]/.test(cod), "sem letras que se confundam", cod);
ok(codigoNovo() !== cod, "dois códigos novos são diferentes");
eq(limparCodigo("abcde fghjk-mnpqr stvwx yz012"), "ABCDEFGHJKMNPQRSTVWXYZ012", "aceita minúsculas e espaços");
eq(limparCodigo("O1IL0"), "01110", "O vira 0; I e L viram 1");
ok(codigoValido("ABCDE-FGHJK-MNPQR-STVWX-YZ012"), "válido com 25");
ok(!codigoValido("ABCDE-FGHJK"), "inválido curto");
var k1 = await sincChaves(cod), k2 = await sincChaves(cod.toLowerCase().replace(/-/g, " ")), k3 = await sincChaves(codigoNovo());
eq(k1.topico, k2.topico, "o mesmo código, escrito de outra maneira, dá a mesma caixa");
ok(k1.topico !== k3.topico, "códigos diferentes dão caixas diferentes");
ok(/^of-[0-9a-f]{32}$/.test(k1.topico), "o nome da caixa não revela o código", k1.topico);
var segredo = "Supermercado QA ção 💶 " + "x".repeat(3000);
var cifrado = await cifrar(k1.chave, await comprimir(segredo));
eq(await descomprimir(await decifrar(k1.chave, cifrado)), segredo, "cifrar, comprimir e voltar dá o mesmo texto");
ok(new TextDecoder("latin1").decode(cifrado).indexOf("Supermercado") < 0, "os bytes cifrados não contêm o texto");
ok(cifrado.length < segredo.length / 4, "comprimido ocupa bem menos", cifrado.length);
var cifrado2 = await cifrar(k1.chave, await comprimir(segredo));
ok(b64u.de(cifrado) !== b64u.de(cifrado2), "cifrar duas vezes dá bytes diferentes (vetor novo)");
var errou = false; try { await decifrar(k3.chave, cifrado); } catch(e){ errou = true; }
ok(errou, "com outra chave não decifra");
var adulterado = cifrado.slice(); adulterado[40] ^= 1;
errou = false; try { await decifrar(k1.chave, adulterado); } catch(e){ errou = true; }
ok(errou, "um byte mudado é recusado");
var bs = crypto.getRandomValues(new Uint8Array(1000));
eq(b64u.para(b64u.de(bs)).join(","), bs.join(","), "base64url de ida e volta");
ok(!/[+/=]/.test(b64u.de(bs)), "base64url sem + / =");

G("código QR — estrutura");
[["A", 1], ["x".repeat(14), 1], ["x".repeat(15), 2], [sincLinkLigacao.call ? PAGINA_ONLINE + "#ligar=0123456789ABCDEFGHJKMNPQR" : "", 0]].forEach(function(p){
  if (!p[0]) return;
  var m = qrMatriz(p[0]);
  if (p[1]) eq((m.length - 17) / 4, p[1], "versão " + p[1] + " para " + p[0].length + " bytes");
  ok(m.length === m[0].length, "matriz quadrada");
  var fim = m.length - 1;
  var loc = function(x, y){ return m[y][x] && m[y][x + 6] && m[y + 6][x] && m[y + 6][x + 6] && !m[y + 1][x + 1] && m[y + 3][x + 3]; };
  ok(loc(0, 0) && loc(fim - 6, 0) && loc(0, fim - 6), "três localizadores nos cantos");
  var temporizacao = true;
  for (var t = 8; t < fim - 7; t++) if (m[6][t] !== (t % 2 === 0)) temporizacao = false;
  ok(temporizacao, "linha de temporização alternada");
  ok(m[fim - 7][8] === true, "módulo escuro fixo");
});
var link = PAGINA_ONLINE + "#ligar=0123456789ABCDEFGHJKMNPQR&s=" + encodeURIComponent("https://ntfy.exemplo.pt");
var mq = qrMatriz(link);
ok(mq.length >= 41 && mq.length <= 57, "a ligação com servidor próprio cabe numa versão pequena", mq.length);
var lanca = false; try { qrMatriz("x".repeat(400)); } catch(e){ lanca = true; }
ok(lanca, "texto demasiado longo é recusado em vez de dar um QR estragado");
var svg = qrSVG("teste", "Rótulo QR");
ok(/^<svg class="qr"/.test(svg) && svg.indexOf('aria-label="Rótulo QR"') > 0 && svg.indexOf('fill="#fff"') > 0, "o SVG tem rótulo e fundo branco");

G("dois aparelhos — o essencial");
var cx = caixaFalsa();
var A = aparelho("A", chave, cx), Bp = aparelho("B", chave, cx);
await A.motor.ligar(); await Bp.motor.ligar();
A.editar(function(s){ s.movimentos.push(mov("m1", "Pão", 2)); });
await calma(cx, [A, Bp]);
eq(Bp.S.movimentos.length, 1, "o movimento criado em A chega a B");
eq(A.json(), Bp.json(), "e ficam iguais");
Bp.editar(function(s){ s.movimentos[0].valor = 3; s.notas["2026-11"] = "férias"; });
await calma(cx, [A, Bp]);
ok(A.S.movimentos[0].valor === 3 && A.S.notas["2026-11"] === "férias", "a alteração de B chega a A");
var antes = cx.msgs.length;
await calma(cx, [A, Bp]);
eq(cx.msgs.length, antes, "parados, não ficam a trocar mensagens");
A.editar(function(s){ s.movimentos.push(mov("m2", "Luz", 40)); });
Bp.editar(function(s){ s.movimentos.push(mov("m3", "Água", 20)); });
await calma(cx, [A, Bp]);
ok(A.S.movimentos.length === 3 && Bp.S.movimentos.length === 3, "criações ao mesmo tempo dos dois lados: ficam as duas", A.S.movimentos.length + "/" + Bp.S.movimentos.length);
eq(A.json(), Bp.json(), "iguais depois de criações simultâneas");
A.editar(function(s){ s.movimentos = s.movimentos.filter(function(m){ return m.id !== "m2"; }); });
await calma(cx, [A, Bp]);
ok(!Bp.S.movimentos.some(function(m){ return m.id === "m2"; }), "apagar em A apaga em B (não ressuscita)");
A.editar(function(s){ s.movimentos[0].descricao = "Pão de A"; });
Bp.editar(function(s){ s.movimentos[0].valor = 99; });
await calma(cx, [A, Bp]);
ok(A.S.movimentos[0].valor === 99 && A.S.movimentos[0].descricao === "Pão", "o mesmo movimento mexido nos dois: fica a alteração mais recente, inteira", JSON.stringify(A.S.movimentos[0]));
eq(A.json(), Bp.json(), "e iguais");
A.motor.desligar(); Bp.motor.desligar();

G("dois aparelhos — o que corre mal na rede");
cx = caixaFalsa();
A = aparelho("A", chave, cx); Bp = aparelho("B", chave, cx);
await A.motor.ligar(); await Bp.motor.ligar();
cx.pausado = true;   // B «adormeceu»: as mensagens ficam na caixa mas não lhe chegam
A.editar(function(s){ s.movimentos.push(mov("p1", "Em pausa", 5)); });
await calma(cx, [A, Bp]);
eq(Bp.S.movimentos.length, 0, "com a ligação em baixo, nada chega");
cx.pausado = false;
await Bp.motor.agora(false);
await calma(cx, [A, Bp]);
eq(Bp.S.movimentos.length, 1, "ao acordar, vai à caixa buscar o que perdeu");
cx.pausado = true;
A.editar(function(s){ s.movimentos.push(mov("p2", "Anexo expira", 6)); });
await calma(cx, [A, Bp]);
cx.expirarAnexos();   // passaram as horas: os anexos foram-se
cx.pausado = false;
await Bp.motor.agora(false);
await calma(cx, [A, Bp]);
ok(Bp.S.movimentos.some(function(m){ return m.id === "p2"; }), "anexo expirado: pede-se o estado atual e chega na mesma");
cx.falhar = true;
A.editar(function(s){ s.movimentos.push(mov("p3", "Sem rede", 7)); });
await dormir(60);
cx.falhar = false;
await A.motor.agora(false);
await calma(cx, [A, Bp]);
ok(Bp.S.movimentos.some(function(m){ return m.id === "p3"; }), "um envio falhado repete-se quando a rede volta");
var outra = await sincChaves(codigoNovo());
var C = aparelho("C", outra.chave, cx);
await C.motor.ligar();
C.editar(function(s){ s.movimentos.push(mov("intruso", "De outra família", 1)); });
await calma(cx, [A, Bp, C]);
ok(!A.S.movimentos.some(function(m){ return m.id === "intruso"; }), "mensagens com outra chave são ignoradas");
C.motor.desligar(); A.motor.desligar(); Bp.motor.desligar();

G("mensagens fora de ordem e edições a meio");
cx = caixaFalsa();
A = aparelho("A", chave, cx); Bp = aparelho("B", chave, cx);
await A.motor.ligar(); await Bp.motor.ligar();
A.editar(function(s){ s.movimentos.push(mov("v1", "um", 1)); });
await calma(cx, [A, Bp]);
A.editar(function(s){ s.movimentos.push(mov("v2", "dois", 2)); });
await calma(cx, [A, Bp]);
var envios = cx.msgs.filter(function(m){ return m.attachment; });
var velho = envios[0];
await Bp.motor._processar({id: "repetido-" + velho.id, event: "message", message: velho.message, attachment: velho.attachment});
await Bp.motor._fila();
ok(Bp.S.movimentos.some(function(m){ return m.id === "v2"; }), "um envio velho a chegar depois não apaga o que veio a seguir");
var lento = caixaFalsa();
var A2 = aparelho("A2", chave, lento), B2 = aparelho("B2", chave, lento);
await A2.motor.ligar(); await B2.motor.ligar();
var baixarOrig = null;
A2.editar(function(s){ s.movimentos.push(mov("w1", "de A2", 1)); });
await calma(lento, [A2, B2]);
/* B2 cria uma coisa no instante em que está a juntar uma vinda de A2 */
var tB = lento.transporte();
var baixa = tB.baixar;
lento.transporte = (function(orig){ return function(){ var t = orig(); var b = t.baixar; t.baixar = function(u){ return b(u).then(function(x){ return new Promise(function(r){ setTimeout(function(){ r(x); }, 60); }); }); }; return t; }; })(lento.transporte);
var B3 = aparelho("B3", chave, lento, JSON.parse(JSON.stringify(B2.S)));
B3.versoes = JSON.parse(JSON.stringify(B2.versoes)); B3.meta = JSON.parse(JSON.stringify(B2.meta));
B2.motor.desligar();
await B3.motor.ligar();
A2.editar(function(s){ s.movimentos.push(mov("w2", "de A2 outra vez", 2)); });
await dormir(30);
B3.S.movimentos.push(mov("w3", "criado a meio", 3));
await calma(lento, [A2, B3]);
ok(B3.S.movimentos.some(function(m){ return m.id === "w3"; }), "o que se criou durante a junção não se perde");
ok(B3.S.movimentos.some(function(m){ return m.id === "w2"; }), "e o que chegou também entra");
A.motor.desligar(); Bp.motor.desligar(); A2.motor.desligar(); B3.motor.desligar();

G("primeiro encontro");
cx = caixaFalsa();
var cheio = estadoBase(); cheio.movimentos = [mov("x1", "Antigo", 10), mov("x2", "Antigo 2", 20)];
A = aparelho("A", chave, cx, cheio); Bp = aparelho("B", chave, cx);
await A.motor.ligar(); await Bp.motor.ligar();
await calma(cx, [A, Bp]);
eq(Bp.S.movimentos.length, 2, "o aparelho novo recebe tudo do que já tinha dados");
eq(A.S.movimentos.length, 2, "e o que tinha não perde nada");
A.motor.desligar(); Bp.motor.desligar();
cx = caixaFalsa();
var cheio2 = estadoBase(); cheio2.movimentos = [mov("y1", "Do telemóvel", 1)];
var daCasa = function(e){ var c = e.categorias.find(function(x){ return x.nome === "Alimentação"; }); e.movimentos.forEach(function(m){ m.categoriaId = c.id; }); };
daCasa(cheio); daCasa(cheio2);
ok(cheio.categorias[0].id !== cheio2.categorias[0].id, "(os dois nascem com ids de categoria diferentes)");
A = aparelho("A", chave, cx, JSON.parse(JSON.stringify(cheio))); Bp = aparelho("B", chave, cx, cheio2);
await A.motor.ligar(); await Bp.motor.ligar();
await calma(cx, [A, Bp]);
ok(A.S.movimentos.length === 3 && Bp.S.movimentos.length === 3, "dois aparelhos com dados: juntam-se, nada se apaga", A.S.movimentos.length + "/" + Bp.S.movimentos.length);
var nomes = A.S.categorias.map(function(c){ return c.tipo + c.nome; });
eq(nomes.length, new Set(nomes).size, "e as categorias por omissão, nascidas com ids diferentes, não ficam em dobro");
ok(A.S.movimentos.every(function(m){ return A.S.categorias.some(function(c){ return c.id === m.categoriaId; }); }), "todos os movimentos apontam para uma categoria que existe");
eq(A.json(), Bp.json(), "e os dois ficam iguais");
A.motor.desligar(); Bp.motor.desligar();

G("convergência ao acaso (dois e três aparelhos)");
for (var semente = 1; semente <= 12; semente++){
  var rnd = aleatorio(semente * 7919);
  var n = semente % 3 === 0 ? 3 : 2;
  cx = caixaFalsa(); cx.baralhar = semente % 2 === 0;
  var aps = [];
  for (var j = 0; j < n; j++) aps.push(aparelho("D" + j, chave, cx));
  for (j = 0; j < n; j++) await aps[j].motor.ligar();
  var criados = {}, apagados = {}, prox = 0;
  for (var passo = 0; passo < 40; passo++){
    var a = aps[Math.floor(rnd() * n)];
    var r = rnd();
    if (r < 0.4){
      var id = "s" + semente + "-" + (prox++);
      criados[id] = true;
      a.editar(function(s){ s.movimentos.push(mov(id, "auto " + id, Math.round(rnd() * 100))); });
    } else if (r < 0.6 && a.S.movimentos.length){
      var alvo = a.S.movimentos[Math.floor(rnd() * a.S.movimentos.length)];
      a.editar(function(s){ s.movimentos.forEach(function(m){ if (m.id === alvo.id) m.valor = Math.round(rnd() * 1000) / 10; }); });
    } else if (r < 0.72 && a.S.movimentos.length){
      var morto = a.S.movimentos[Math.floor(rnd() * a.S.movimentos.length)].id;
      apagados[morto] = true;
      a.editar(function(s){ s.movimentos = s.movimentos.filter(function(m){ return m.id !== morto; }); });
    } else if (r < 0.82){
      a.editar(function(s){ s.notas["2026-" + String(1 + Math.floor(rnd() * 12)).padStart(2, "0")] = "nota " + passo; });
    } else if (r < 0.9){
      a.editar(function(s){ s.fiscal.dependentes = Math.floor(rnd() * 4); });
    } else if (r < 0.95){
      cx.pausado = !cx.pausado;
    } else {
      cx.expirarAnexos();
    }
    if (rnd() < 0.3) await dormir(Math.floor(rnd() * 15));
  }
  cx.pausado = false;
  for (j = 0; j < n; j++) await aps[j].motor.agora(true);
  var calmou = await calma(cx, aps, 15000);
  ok(calmou, "semente " + semente + ": a conversa acaba", cx.msgs.length + " mensagens");
  var jsons = aps.map(function(x){ return x.json(); });
  ok(jsons.every(function(x){ return x === jsons[0]; }), "semente " + semente + ": os " + n + " aparelhos ficam iguais",
    aps.map(function(x){ return x.S.movimentos.length; }).join("/"));
  var perdidos = Object.keys(criados).filter(function(id){ return !apagados[id] && !aps[0].S.movimentos.some(function(m){ return m.id === id; }); });
  ok(perdidos.length === 0, "semente " + semente + ": nenhum movimento criado e nunca apagado se perde", perdidos.join(","));
  ok(cx.msgs.length < 40 * n * 6, "semente " + semente + ": sem tempestade de mensagens", cx.msgs.length);
  aps.forEach(function(x){ x.motor.desligar(); });
}

G("a página — ligar, emparelhar, desligar");
var caixaPagina = caixaFalsa();
transporteNtfy = function(){ return caixaPagina.transporte(); };
localStorage.removeItem(SINC_KEY); localStorage.removeItem(SINC_VERSOES_KEY);
S = normalizar(estadoVazio()); guardar();
irPagina("config");
var cartao = $("#cfgSinc");
ok(cartao && /Criar código/.test(cartao.textContent), "desligada: oferece criar um código");
ok(cartao && $("#sincCodigo") != null, "… e um campo para quem já tem um");
ok($("#estadoSinc").hidden, "desligada: nada no cabeçalho");
$("#sincCodigo").value = "curto";
ACOES.sincEntrar();
eq($("#sincCodigo").getAttribute("aria-invalid"), "true", "um código curto marca o campo como inválido");
ACOES.sincCriar();
await dormir(300);
ok(document.querySelector("#cfgSinc details.sincLigar") && document.querySelector("#cfgSinc details.sincLigar").open, "sem nenhum aparelho ligado, o QR aparece aberto");
var cfg = sincCfg();
ok(codigoValido(cfg.codigo), "criar guarda um código válido");
ok(SINC != null, "e põe o motor a andar");
ok($("#cfgSinc svg.qr") != null, "mostra o QR");
ok($("#cfgSinc .codigoSinc") && $("#cfgSinc .codigoSinc").textContent === cfg.codigo, "e o código por baixo");
ok(!$("#estadoSinc").hidden && /à espera|sincronizado|a ligar|a enviar/.test($("#estadoSinc").textContent), "o cabeçalho diz o estado", $("#estadoSinc").textContent);
ok(sincLinkLigacao().indexOf("#ligar=" + limparCodigo(cfg.codigo)) > 0, "a ligação leva o código");
var outroApar = aparelho("telemovel", (await sincChaves(cfg.codigo)).chave, caixaPagina);
await outroApar.motor.ligar();
outroApar.editar(function(s){ s.movimentos.push(mov("tm1", "Do telemóvel", 12.5)); });
await calma(caixaPagina, [outroApar], 4000);
await SINC._fila(); await dormir(200); await SINC._fila();
ok(S.movimentos.some(function(m){ return m.id === "tm1"; }), "o que o «telemóvel» cria aparece na página");
ok(podeDesfazer() && /sincroniza/.test(historico.atras[historico.atras.length - 1].rotulo), "e pode desfazer-se como «sincronização»");
alterar(function(){ S.movimentos.push(mov("pc1", "Do computador", 30)); }, "teste");
await dormir(2900); await SINC._fila();
await calma(caixaPagina, [outroApar], 4000);
ok(outroApar.S.movimentos.some(function(m){ return m.id === "pc1"; }), "o que se cria na página chega ao «telemóvel»");
S.paleta = "areia"; guardar();
await dormir(2900); await SINC._fila();
eq(outroApar.S.paleta === "areia", false, "a paleta não viaja");
/* Alteração a chegar enquanto se escreve: espera */
irPagina("config");
var campo = $("#sincNome"), nomeAntes = campo.value;
campo.closest("details").open = true;   // fechado, o campo não recebe foco
campo.focus(); campo.value = "a meio";
ok(document.activeElement === campo, "(o campo tem o foco)");
outroApar.editar(function(s){ s.movimentos.push(mov("tm2", "Enquanto escrevia", 1)); });
await calma(caixaPagina, [outroApar], 3000); await SINC._fila();
ok(!S.movimentos.some(function(m){ return m.id === "tm2"; }), "a escrever num campo, a alteração de fora espera");
ok($("#sincNome") === campo && campo.value === "a meio", "e o que se escrevia não se perde");
campo.value = nomeAntes; campo.blur();
await dormir(1500);
ok(S.movimentos.some(function(m){ return m.id === "tm2"; }), "ao sair do campo, entra");
/* Apagar tudo com a sincronização ligada não apaga no outro */
ACOES.limpar();
var sim = $('#modalHost [data-dlg="yes"]');
ok(sim && /desligada antes/.test($("#modalHost").textContent), "«Apagar tudo» avisa que desliga a sincronização antes");
if (sim) sim.click();
await dormir(3000);
ok(!sincCfg().codigo && SINC === null, "e desliga-a mesmo");
ok(outroApar.S.movimentos.length >= 2, "o outro aparelho fica com os dados dele", outroApar.S.movimentos.length);
outroApar.motor.desligar();
/* Emparelhar pela ligação do QR */
var cod2 = codigoNovo();
history.replaceState(null, "", location.pathname + location.search + "#ligar=" + limparCodigo(cod2));
sincLerLigacao();
ok(location.hash === "", "a ligação sai logo da barra de endereço");
var dlg = $("#modalHost .dialog");
ok(dlg && /Ligar este aparelho/.test(dlg.textContent), "pergunta antes de ligar");
$('#modalHost [data-dlg="no"]').click();
ok(!sincCfg().codigo, "«Agora não» não liga");
history.replaceState(null, "", location.pathname + location.search + "#ligar=" + limparCodigo(cod2));
sincLerLigacao();
$('#modalHost [data-dlg="yes"]').click();
await dormir(200);
eq(limparCodigo(sincCfg().codigo), limparCodigo(cod2), "«Ligar» liga com o código da ligação");
history.replaceState(null, "", location.pathname + location.search + "#ligar=" + limparCodigo(cod2));
sincLerLigacao();
ok(!$("#modalHost .dialog"), "a mesma ligação outra vez não volta a perguntar");
history.replaceState(null, "", location.pathname + location.search + "#ligar=ABC");
sincLerLigacao();
ok(!$("#modalHost .dialog"), "uma ligação estragada é ignorada");
irPagina("config");
ACOES.sincDesligar();
$('#modalHost [data-dlg="yes"]').click();
ok(!sincCfg().codigo && sincCfg().aparelho, "desligar esquece o código mas lembra o nome do aparelho");
ok($("#estadoSinc").hidden, "e o cabeçalho volta a calar-se");
transporteNtfy = transporteOriginal;

if (window.__QASINC_REDE !== false){
  G("troca real pelo serviço público (ntfy.sh)");
  try {
    var codReal = codigoNovo(), kr = await sincChaves(codReal);
    var caixaReal = {msgs: []};
    var real = function(nome){
      var a = {nome: nome, S: estadoBase(), versoes: {}, meta: {}};
      a.motor = criarSinc({
        chave: kr.chave, eu: {id: nome, nome: nome}, transporte: transporteNtfy(SINC_SERVIDOR, kr.topico), atraso: 10, intervaloPedidos: 0,
        ler: function(){ return estadoParaSinc(a.S); },
        aplicar: function(M, info){ a.S = normalizar(JSON.parse(JSON.stringify(M))); if (info.concluir) info.concluir(); },
        vazio: function(x){ return semDadosProprios(x, false); },
        normalizar: function(M){ return estadoParaSinc(normalizar(JSON.parse(JSON.stringify(M)))); },
        meta: {ler: function(){ return a.meta; }, gravar: function(p){ Object.assign(a.meta, p); }},
        versoes: {ler: function(){ return a.versoes; }, gravar: function(v){ a.versoes = v; }},
      });
      a.editar = function(fn){ fn(a.S); a.motor.mudou(); };
      return a;
    };
    var esperar = async function(cond, ms){ var fim = Date.now() + (ms || 20000); while (Date.now() < fim){ if (cond()) return true; await dormir(250); } return false; };
    var RA = real("pc-qa"), RB = real("tm-qa");
    await RA.motor.ligar(); await RB.motor.ligar();
    await dormir(1200);
    RA.editar(function(s){ s.movimentos.push(mov("r1", "Segredo-QA-continente", 45.9)); });
    ok(await esperar(function(){ return RB.S.movimentos.length === 1; }), "o movimento atravessa o serviço público", RB.S.movimentos.length);
    RB.editar(function(s){ s.movimentos[0].valor = 46.1; });
    ok(await esperar(function(){ return RA.S.movimentos[0] && RA.S.movimentos[0].valor === 46.1; }), "e a correção volta pelo mesmo caminho");
    RA.editar(function(s){ s.movimentos.push(mov("r2", "A", 1)); });
    RB.editar(function(s){ s.movimentos.push(mov("r3", "B", 2)); });
    ok(await esperar(function(){ return RA.S.movimentos.length === 3 && RB.S.movimentos.length === 3; }), "criações simultâneas juntam-se pela rede real");
    await dormir(800);
    eq(jsonEstavel(estadoParaSinc(RA.S)), jsonEstavel(estadoParaSinc(RB.S)), "os dois acabam iguais");
    var bruto = await (await fetch(SINC_SERVIDOR + "/" + kr.topico + "/json?poll=1&since=all")).text();
    ok(bruto.length > 0 && bruto.indexOf("Segredo-QA") < 0 && bruto.indexOf("continente") < 0, "o serviço só guarda texto cifrado");
    var linhas = bruto.split("\n").filter(Boolean).map(function(l){ return JSON.parse(l); }).filter(function(m){ return m.attachment; });
    ok(linhas.length > 0, "os estados viajam como anexos");
    if (linhas.length){
      var anexo = new Uint8Array(await (await fetch(linhas[linhas.length - 1].attachment.url)).arrayBuffer());
      ok(anexo[0] === 1 && new TextDecoder("latin1").decode(anexo).indexOf("Segredo") < 0, "o anexo é cifrado (formato 1, sem texto às claras)");
    }
    RA.motor.desligar(); RB.motor.desligar();
  } catch(e){ ok(false, "a troca real correu sem exceções", e && e.message); }
}

G("dois ecrãs — a principal fala com a companheira");
if (typeof BroadcastChannel === "undefined"){ ok(true, "sem BroadcastChannel: saltado"); }
else {
  localStorage.removeItem(ECRA2_KEY);
  var ouvido = [];
  var canal = new BroadcastChannel("orcamento-familiar-ecras");
  canal.onmessage = function(e){ ouvido.push(e.data); };
  ok(!painelAberto(), "sem companheira, a principal sabe que está sozinha");
  canal.postMessage({t: "ola"});
  await dormir(100);
  ok(painelAberto(), "a companheira diz olá: a principal sabe que ela está lá");
  ouvido = [];
  irPagina("movimentos");
  await dormir(80);
  var est = ouvido.filter(function(m){ return m.t === "estado"; }).pop();
  ok(est && est.pagina === "movimentos" && est.mes === MES, "ao mudar de página, avisa a companheira com a página e o mês", JSON.stringify(est));
  ouvido = [];
  render();
  await dormir(60);
  eq(ouvido.filter(function(m){ return m.t === "estado"; }).length, 0, "redesenhar sem mudar nada não repete o aviso");
  ouvido = [];
  abrirLateral("nota");
  await dormir(60);
  var lat = ouvido.filter(function(m){ return m.t === "lateral"; }).pop();
  ok(lat && lat.tipo === "nota", "a nota do mês abre no outro ecrã");
  ok(!ui.lateral, "e o painel lateral daqui fica fechado");
  ecra2Gravar({detalhes: false});
  abrirLateral("nota");
  ok(ui.lateral && ui.lateral.tipo === "nota", "com a opção desligada, abre aqui como antes");
  fecharLateral();
  ecra2Gravar({detalhes: true});
  irPagina("config");
  ok($("#cfgEcras") && /Fechar a janela companheira/.test($("#cfgEcras").textContent), "as definições oferecem fechá-la");
  canal.postMessage({t: "adeus"});
  await dormir(100);
  ok(!painelAberto(), "a companheira despede-se: a principal volta a estar sozinha");
  eq(paginaDoPainel("movimentos"), "limites", "o que completa os movimentos são os limites");
  eq(paginaDoPainel("ativos"), "creditos", "o que completa os ativos são os créditos");
  ecra2Gravar({modo: "espelho"});
  eq(paginaDoPainel("ativos"), "ativos", "em espelho, a mesma página");
  ecra2Gravar({modo: "fixo", pagina: "objetivos"});
  eq(paginaDoPainel("ativos"), "objetivos", "fixa, a página escolhida");
  localStorage.removeItem(ECRA2_KEY);
  Object.keys(COMPLEMENTO).forEach(function(k){ ok(!!PAGINAS[COMPLEMENTO[k]] && !!PAGINAS[k], "complemento de " + k + " é uma página que existe"); });
  canal.close();
}

G("dois ecrãs — uma janela companheira de verdade");
var w = null;
/* Só quando se pede (window.__QASINC_JANELA = true): há ambientes que abrem
   a «janela nova» por cima desta página, e a suite morreria a meio. */
if (window.__QASINC_JANELA === true && !DESKTOP && !aoToque()){
  try { w = window.open(location.pathname + "?janela=painel&qa=1", "orcamentoPainelQA", "popup=yes,width=900,height=700"); } catch(e){ w = null; }
}
if (!w){ ok(true, "janela real não pedida aqui: coberta pelos avisos acima e pelos testes da aplicação de secretária"); }
else {
  var pronta = false;
  for (var t = 0; t < 60 && !pronta; t++){ await dormir(100); try { pronta = !!(w.document && w.document.readyState === "complete" && w.EH_PAINEL !== undefined && w.render); } catch(e){} }
  ok(pronta, "a companheira carrega");
  if (pronta){
    ok(w.EH_PAINEL === true && w.document.documentElement.classList.contains("janelaPainel"), "e sabe que é a companheira");
    ok(w.document.getElementById("barraPainel") != null, "com a faixa de cima");
    await dormir(400);
    ok(painelAberto(), "a principal dá por ela");
    irPagina("ativos");
    await dormir(500);
    eq(w.paginaAtual(), "creditos", "a principal vai aos ativos, a companheira mostra os créditos");
    MES = mesShift(MES, -1); render();
    await dormir(400);
    eq(w.eval("MES"), MES, "e segue o mês");
    MES = MES0; render();
    var antesN = S.movimentos.length;
    w.eval('alterar(function(){ S.movimentos.push({id:"cmp1",tipo:"despesa",data:"2026-11-02",descricao:"Criado na companheira",valor:1,categoriaId:"",membroId:""}); }, "teste")');
    await dormir(500);
    eq(S.movimentos.length, antesN + 1, "o que se grava na companheira aparece na principal");
    ok(w.eval("SINC") === null, "a companheira não liga a sincronização (é a principal que fala)");
    w.close();
    await dormir(1500);
    ok(!painelAberto(), "fechada, a principal dá pela falta dela");
  }
}

G("instalar como app");
var uaOriginal = Object.getOwnPropertyDescriptor(navigator, "userAgent");
function comUA(ua, fn){
  Object.defineProperty(navigator, "userAgent", {value: ua, configurable: true});
  try { return fn(); } finally { if (uaOriginal) Object.defineProperty(navigator, "userAgent", uaOriginal); else delete navigator.userAgent; }
}
var android = comUA("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36", caminhoDeInstalacao);
ok(android.nome === "Chrome" && /ecrã principal/.test(android.passos.join(" ")), "Android: Menu ⋮ › Adicionar ao ecrã principal", JSON.stringify(android));
var samsung = comUA("Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36", caminhoDeInstalacao);
eq(samsung.nome, "Samsung Internet", "Samsung Internet tem o seu caminho");
var iphone = comUA("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", caminhoDeInstalacao);
ok(iphone.nome === "Safari" && /Adicionar ao ecrã principal/.test(iphone.passos.join(" ")), "iPhone: Partilhar › Adicionar ao ecrã principal");
var nomeTm = comUA("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", nomeDesteAparelho);
if (DESKTOP) ok(/^Computador/.test(nomeTm), "na aplicação de secretária, o aparelho chama-se «Computador»", nomeTm);
else eq(nomeTm, "Telemóvel", "um iPhone chama-se «Telemóvel» na sincronização");
if (!DESKTOP){
  ok(podeInstalar() === (!emAplicacao() && location.protocol.indexOf("http") === 0), "pode instalar-se quando servida e ainda não instalada");
  pintarMenuDefinicoes();
  eq($("#instalarMenu").hidden, !podeInstalar(), "o menu das definições rápidas mostra «Instalar como app» quando faz sentido");
  irPagina("config");
  var idx = Array.prototype.map.call(document.querySelectorAll(".indiceCfg .ficha"), function(b){ return b.textContent; });
  ok(idx.indexOf(podeInstalar() ? "Instalar como app" : "Aplicação") >= 0, "o índice das definições tem a entrada", idx.join(", "));
  ok(/Instalar como app|Já está instalada/.test($("#cfgAplicacao").textContent), "e o cartão chama-se assim");
  ACOES.appMenuInstalar();
  await dormir(50);
  eq(VIEW, "config", "o atalho do menu leva às definições (ou ao convite do navegador)");
} else {
  ok(!podeInstalar(), "na aplicação de secretária não se oferece instalar");
  irPagina("config");
  ok(/aplicação de secretária/.test($("#cfgAplicacao").textContent), "o cartão diz que é a aplicação de secretária");
  ok($('#cfgAplicacao [data-act="appPastaCopias"]') != null, "com a pasta das cópias diárias");
}
G("telemóvel — Android e iOS");
var vp = document.querySelector('meta[name="viewport"]');
ok(vp && /viewport-fit=cover/.test(vp.content), "a página chega às bordas (entalhe e barra de gestos)", vp && vp.content);
ok(!!document.querySelector('meta[name="mobile-web-app-capable"]') && !!document.querySelector('meta[name="apple-mobile-web-app-capable"]'), "declara-se app no Android e no iOS");
var regras = [];
Array.prototype.forEach.call(document.styleSheets, function(sh){
  try { Array.prototype.forEach.call(sh.cssRules, function(r){ regras.push(r.cssText); }); } catch(e){}
});
var css = regras.join("\n");
ok(/@media \(pointer: ?coarse\)[^@]*input, ?select, ?textarea \{ ?font-size: 16px/.test(css), "ao toque, os campos têm 16 px (o iOS não aproxima a página)");
ok(/safe-area-inset-left/.test(css) && /safe-area-inset-right/.test(css) && /safe-area-inset-bottom/.test(css), "as margens seguras contam à esquerda, à direita e em baixo");
ok(/100dvh/.test(css), "os diálogos medem-se pela altura visível (a barra do navegador não os corta)");
var lidoA = codigoDeTexto(PAGINA_ONLINE + "#ligar=0123456789ABCDEFGHJKMNPQR");
ok(lidoA && lidoA.codigo === "0123456789ABCDEFGHJKMNPQR" && lidoA.servidor === "", "um QR com a ligação dá o código");
var lidoB = codigoDeTexto(PAGINA_ONLINE + "#ligar=0123456789ABCDEFGHJKMNPQR&s=" + encodeURIComponent("https://ntfy.exemplo.pt"));
ok(lidoB && lidoB.servidor === "https://ntfy.exemplo.pt", "e o servidor próprio, quando o há");
ok(codigoDeTexto("ABCDE-FGHJK-MNPQR-STVWX-YZ012") && !codigoDeTexto("https://exemplo.pt/qualquer") && !codigoDeTexto(""), "um código sozinho também; outra coisa qualquer não");
/* Atalhos do ícone (Android) */
var manif = null;
try { manif = await (await fetch("./manifest.json", {cache: "no-store"})).json(); } catch(e){}
ok(manif && Array.isArray(manif.shortcuts) && manif.shortcuts.length >= 3, "o manifesto tem atalhos para o ícone", manif && JSON.stringify(manif.shortcuts || null).slice(0, 80));
if (manif && manif.shortcuts) manif.shortcuts.forEach(function(a){
  var at = new URL(a.url, location.href).searchParams.get("atalho");
  ok(!!ATALHOS_ICONE[at], "o atalho «" + a.short_name + "» é um que a página sabe cumprir");
  ok(a.icons && a.icons.length && /192/.test(a.icons[0].sizes), "e tem ícone de 192 px");
});
ok(manif && manif.launch_handler && manif.launch_handler.client_mode === "navigate-existing", "um atalho com a app já aberta usa a mesma janela");
var endereco = location.pathname + location.search + location.hash;
history.replaceState(null, "", location.pathname + "?atalho=movimentos");
ok(cumprirAtalho() && paginaAtual() === "movimentos", "?atalho=movimentos abre os movimentos");
ok(location.search === "", "e sai do endereço (recarregar não o repete)");
history.replaceState(null, "", location.pathname + "?atalho=registar&x=1");
cumprirAtalho();
ok(!!document.querySelector("#modalHost .overlay"), "?atalho=registar abre o registo");
eq(new URLSearchParams(location.search).get("x"), "1", "e deixa ficar o resto do endereço");
$("#modalHost").innerHTML = "";
history.replaceState(null, "", location.pathname + "?atalho=nada");
ok(!cumprirAtalho(), "um atalho desconhecido não faz nada");
history.replaceState(null, "", endereco);
/* Emparelhar no iPhone: o Safari e a app do ecrã principal guardam à parte */
var cfgAntes = localStorage.getItem(SINC_KEY);
localStorage.removeItem(SINC_KEY);
var IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
comUA(IPHONE, function(){
  ok(eIOS(), "reconhece o iPhone");
  var instAntes = _instalada; _instalada = false;
  history.replaceState(null, "", location.pathname + location.search + "#ligar=0123456789ABCDEFGHJKMNPQR");
  sincLerLigacao();
  var dlg = $("#modalHost .dialog");
  if (DESKTOP){ ok(dlg && !$("#dlgSincCodigo"), "na aplicação de secretária não há aviso do Safari"); }
  else {
    ok(dlg && /Usa a app no ecrã principal/.test(dlg.textContent), "no Safari do iPhone, avisa que a app guarda os dados à parte");
    ok($("#dlgSincCodigo") && $("#dlgSincCodigo").textContent === "01234-56789-ABCDE-FGHJK-MNPQR", "e mostra o código, em grupos, para escrever na app");
    ok(/Ligar o Safari/.test(dlg.textContent), "o botão diz o que liga");
  }
  $("#modalHost").innerHTML = "";
  _instalada = true;
  irPagina("config");
  if (!DESKTOP) ok(/escreva o código/.test($("#cfgSinc").textContent), "na app do iPhone, o cartão diz para escrever o código");
  _instalada = instAntes;
});
/* Ler o QR com a câmara: o leitor nativo e a câmara, de faz-de-conta */
var BDantes = window.BarcodeDetector, GUMantes = navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
var parado = 0, deteccoes = 0;
window.BarcodeDetector = function(){ this.detect = function(){ deteccoes++; return Promise.resolve(deteccoes < 3 ? [] : [{rawValue: PAGINA_ONLINE + "#ligar=ABCDE-FGHJK-MNPQR-STVWX-YZ012"}]); }; };
var tela = document.createElement("canvas"); tela.width = 64; tela.height = 64; tela.getContext("2d").fillRect(0, 0, 64, 64);
if (!navigator.mediaDevices) Object.defineProperty(navigator, "mediaDevices", {value: {}, configurable: true});
navigator.mediaDevices.getUserMedia = function(){
  var st = tela.captureStream(5);
  st.getTracks().forEach(function(t){ var p = t.stop.bind(t); t.stop = function(){ parado++; p(); }; });
  return Promise.resolve(st);
};
ok(podeLerQR(), "com leitor nativo e câmara, oferece ler o QR");
irPagina("config");
ok(!!$('#cfgSinc [data-act="sincLerQR"]'), "o cartão tem o botão «Ler o QR com a câmara»");
transporteNtfy = function(){ return caixaFalsa().transporte(); };
ACOES.sincLerQR();
await dormir(150);
ok(!!$("#leitorQR video"), "abre a imagem da câmara");
await dormir(1200);
eq(limparCodigo(sincCfg().codigo || ""), "ABCDEFGHJKMNPQRSTVWXYZ012", "lido o QR, fica ligado com esse código");
ok(!$("#leitorQR") && parado > 0, "e a câmara desliga-se logo");
sincParar();
navigator.mediaDevices.getUserMedia = function(){ return Promise.reject(new Error("recusado")); };
ACOES.sincLerQR();
await dormir(200);
ok($("#leitorQREstado") && /Sem acesso à câmara/.test($("#leitorQREstado").textContent), "sem licença para a câmara, diz o que fazer");
fecharLeitorQR();
window.BarcodeDetector = BDantes;
if (BDantes === undefined) delete window.BarcodeDetector;
if (GUMantes) navigator.mediaDevices.getUserMedia = GUMantes; else delete navigator.mediaDevices.getUserMedia;
transporteNtfy = transporteOriginal;
ok(podeLerQR() === (typeof window.BarcodeDetector === "function" && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)), "sem leitor nativo (Safari), o botão não aparece");
if (cfgAntes) localStorage.setItem(SINC_KEY, cfgAntes); else localStorage.removeItem(SINC_KEY);
render();

}

function arrumar(){
  try { if (SINC){ SINC.desligar(); SINC = null; } } catch(e){}
  transporteNtfy = transporteOriginal;
  var ks = []; for (var i = 0; i < localStorage.length; i++) ks.push(localStorage.key(i));
  ks.forEach(function(k){ if (!(k in disco)) localStorage.removeItem(k); });
  Object.keys(disco).forEach(function(k){ localStorage.setItem(k, disco[k]); });
  try { S = normalizar(JSON.parse(S0)); } catch(e){}
  MES = MES0; ui = Object.assign(ui, JSON.parse(ui0)); ui.lateral = null;
  try { $("#modalHost").innerHTML = ""; irPara(VIEW0); } catch(e){}
  if (typeof _sessaoT !== "undefined") clearTimeout(_sessaoT);
  if (typeof _copiaT !== "undefined") clearTimeout(_copiaT);
  Object.keys(disco).forEach(function(k){ localStorage.setItem(k, disco[k]); });
  if (SINC0 || sincCfg().codigo) sincArrancar();
}

window.__QASINC = null;
correr().catch(function(e){ falhas.push({grupo: grupo, teste: "a suite correu até ao fim", detalhe: e && (e.stack || e.message)}); })
  .then(function(){
    arrumar();
    window.__QASINC = {total: passes + falhas.length, passes: passes, falhas: falhas.length, detalhe: falhas};
    console.log("QA sinc:", passes + "/" + (passes + falhas.length), "falhas:", falhas.length);
  });
})();
