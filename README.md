# Orçamento Familiar

Ferramenta de cálculo e gestão do **orçamento e do património** de um agregado familiar. Aplicação de **ficheiro único**, sem servidor e sem dependências externas: abre num browser, funciona offline e os dados nunca saem do computador.

Pensada para a realidade portuguesa — euros, formatação pt-PT, subsídios de férias/Natal (14 meses), certificados de aforro, taxa de esforço do crédito e mapa de amortização em regime de prestação constante.

## Três coisas, e só três

A ferramenta reduz-se a **Rendimentos**, **Despesas** e **Ativos**. Tudo o resto pendura-se destas três:

- Os **créditos** ligam-se ao ativo que financiam, e a prestação divide-se em juros (despesa), amortização (poupança) e seguros.
- As **poupanças são ativos** — a conta à ordem, a conta poupança, os certificados, o PPR e os ETFs estão na mesma lista que o apartamento e o carro, com as mesmas colunas.
- Os **impostos** que recaem sobre rendimentos e ativos entram nas categorias respetivas, em vez de ficarem à parte.

Cada nível abre para dentro sem se perder de vista: uma fonte de rendimento decompõe-se em vencimento base, subsídios e prémios; um ativo tem encargos, rendas, aportes e crédito. Mas no topo somam sempre a três números.

## 🎯 O que faz

### Painel

O painel **começa curto — cinco cartões** — e o resto liga-se em *Definições → Aparência → Cartões do painel*, onde também se reordena por arrasto. Cada cartão pode ser fechado no seu canto (fechado, nem chega a ser calculado), e o botão **◱** do cabeçalho liga um **modo essencial** que mostra só o indispensável sem mexer na configuração.

- **Precisa da sua atenção**: uma lista única, por urgência, do que os dados já dizem mas nunca foi dito num sítio só — limite ultrapassado ou perto, mês em défice, crédito com **revisão de taxa** à porta, taxa de esforço acima de 40%, objetivo fora de ritmo ou fora de prazo, liquidez abaixo de 3 meses, movimentos por categorizar, ativos com valor estimado há mais de um ano. Cada alerta leva ao sítio onde se resolve
- **Indicadores do mês**: rendimento, despesa, saldo e taxa de poupança — cada um com a **variação face ao mês anterior** e um **traço de tendência** dos últimos 6 meses; o botão **⇄** compara com o mês homólogo do ano anterior. Os valores **interpolam** ao mudar de mês, em vez de saltarem
- **Resumo narrado do mês fechado**: a maior despesa, a categoria que mais cresceu e a poupança face à média — gerado localmente
- **Tesouraria a 12 meses**: a liquidez de hoje mais o saldo de cada mês, com os encargos anuais e semestrais no mês em que caem — mostra *quando* o dinheiro aperta, e assinala o ponto mais baixo. As **compras planeadas** já marcadas aparecem como um losango no mês em que estão previstas
- **Mapa do ano**: categorias em linhas, os 12 meses em colunas, a despesa em intensidade de cor. A sazonalidade — energia no inverno, férias no verão — é invisível na vista mensal e óbvia aqui
- **Dica do próximo passo**: um cartão dispensável sugere o primeiro degrau do percurso ainda por dar (rendimentos → despesas fixas → ativos → limites → objetivos)
- **Previsto vs. real**: compara o plano com os movimentos efetivos e mostra o desvio de cada linha
- **Despesa por categoria**: gráfico de anel interativo — clique numa fatia para **abrir o detalhe** dos movimentos dessa categoria ali mesmo
- **Para onde vai o dinheiro**: diagrama de fluxo (Sankey) do rendimento bruto aos impostos, necessidades, desejos, poupança e sobra
- **Regra 50 / 30 / 20**: repartição do rendimento entre necessidades, desejos e poupança
- **Evolução**: barras de rendimento e despesa com linha de saldo, horizonte comutável entre 6, 12, 24 e 36 meses — com **marcos** (🏦 aquisições, 💳 inícios de crédito, 🎯 prazos de objetivos) assinalados na linha do tempo
- **Comparar dois meses** lado a lado, categoria a categoria, com a coluna de diferenças
- **Posso pagar isto?** — escreve-se um valor e a ferramenta responde com o que sabe: se cabe na liquidez, o que faz ao saldo do mês, que objetivos atrasa e o que já está marcado para sair. Se a resposta for «agora não», leva o valor para **Planear despesa**, que responde à pergunta seguinte: *quando* cabe
- **Património líquido** e **simulador «e se…»** com deslizadores que recalculam ao vivo

Clicar num indicador (rendimento, despesa, saldo, património) abre **a conta por trás do número** — as parcelas com que foi feito, este mês. No cabeçalho, uma **fita de meses** mostra o saldo de cada um em barras clicáveis, e no gráfico de evolução **arrasta-se para ampliar** um período.

Nos **Movimentos**, um **calendário-mapa de calor** mostra a despesa de cada dia em intensidade de cor — os padrões saltam à vista.

Nos **Créditos**, o cartão **«que dívida amortizar primeiro»** ordena por taxa (poupa mais juros) ou por saldo (livra-se de um crédito mais cedo), e diz o efeito real de um reforço: quantos meses antes fica paga e quantos juros poupa.

Nos **Limites**, a **mesada diária** reparte o que resta pelos dias que faltam, e cada categoria traz um **minigráfico** dos últimos seis meses.

### Interface
- **Desfazer e refazer (Ctrl+Z / Ctrl+Shift+Z)** — cada alteração aos dados guarda uma fotografia do estado anterior, até 40 passos. Os botões ↶ ↷ do cabeçalho dizem o que está prestes a desfazer-se; dentro de um campo de texto o Ctrl+Z continua a ser o do navegador, para não roubar o que se está a escrever. O botão «Anular» dos toasts de eliminação é um atalho para o mesmo mecanismo
- **Autosave e restauro de sessão** — os dados gravam-se a cada alteração (com indicador discreto no cabeçalho e aviso se o armazenamento falhar), e o *contexto* é retomado ao voltar: a vista, o mês, os filtros, as secções e as fontes abertas. Se ficou um **formulário por gravar**, a aplicação pergunta se o quer recuperar — e só pergunta quando houve mesmo texto escrito, não por um seletor de cor ter valor
- **Temas (Definições → Aparência)** — modo **automático/claro/escuro** e **oito paletas de cor**: Meia-noite (padrão), Oceano, Floresta, Pôr do sol, Ameixa, Grafite, **Areia** (bege quente, com superfícies e texto aquecidos) e **Pastel** (tons suaves rosados). Cada paleta redefine o acento e a temperatura das superfícies nos dois modos; as cores semânticas (verde positivo, vermelho negativo, âmbar de aviso) não mudam, para que os números se leiam sempre da mesma maneira. O botão ◐ do cabeçalho alterna o modo; a escolha persiste com os dados
- **Densidade** — Confortável ou Compacta (mais linhas por ecrã), em Definições → Aparência
- **Modo privacidade (👁)** — um clique no cabeçalho desfoca todos os valores, para mostrar o ecrã ou tirar capturas; os gráficos mantêm as formas
- **Atalhos de teclado** — `g` + letra navega (g p painel, g r rendimentos…), `n` + letra cria (n m movimento, n a ativo…), `?` mostra a folha de atalhos
- **Arrastar para reordenar** — categorias (Definições) e rubricas do plano têm pega ⠿; a primeira arrumação das rubricas fixa a ordem manual
- **Ícones por categoria** — cada categoria pode ter um emoji (a semente já os traz: 🛒 Alimentação, 🏠 Habitação…), visível nas tabelas, seletores e no donut
- **Importador de extratos (CSV)** — em Despesas → Movimentos: cola-se ou escolhe-se o ficheiro, a ferramenta deteta o separador e as colunas, converte datas e valores (rejeitando as impossíveis), **sugere a categoria** e ignora duplicados
- **Copiar o mês anterior** — repete os movimentos habituais com as mesmas datas e valores, sem duplicar os que já cá estão
- **Duplicar** movimento, rubrica, ativo ou crédito, com o botão ⧉
- **Campos que fazem contas** — escrever `43,20+18` ou `120*3` num campo de valor e ele resolve ao sair
- **Objetivos ligados a um ativo** — o «já poupado» deixa de se escrever à mão e passa a acompanhar a conta que financia a meta (a saúde dos dados assinala dois objetivos a seguir o mesmo ativo)
- **Regras de categorização** — «descrições com CONTINENTE → Alimentação», guardadas em Definições ou propostas ao categorizar em lote. Ganham à sugestão por semelhança, e fazem a segunda importação ser quase toda automática
- **Deteção de recorrências** — uma despesa que aparece em três ou mais meses com valor semelhante é proposta como rubrica do plano, com um clique para a criar
- **Seleção múltipla e ações em lote** — marque vários movimentos e atribua-lhes a mesma categoria (ou elimine-os) de uma vez; ao aplicar, oferece guardar o termo comum como regra
- **Edição em linha** — clique duplo numa célula de descrição, categoria ou valor e edite ali; Enter grava, Escape desiste
- **Navegação por teclado nas tabelas** — setas percorrem as linhas, Enter edita, Espaço seleciona, Delete elimina (com anulação)
- **A paleta procura dados** — o Ctrl+K encontra movimentos, ativos, créditos, objetivos, fontes e categorias pelo nome, não só vistas
- **Saúde dos dados** (Definições) — o que está por preencher ou por ligar: movimentos sem categoria, imóveis sem VPT, veículos sem IUC, créditos sem ativo, categorias sem limite
- **Limites com ritmo** — a barra ganha uma marca de onde se devia estar hoje, e a leitura em palavras: «no ritmo · 16,40 €/dia» ou «excedeu 38 €»
- **Cenários guardados** (Estratégias) — fotografe os parâmetros com um nome e compare «mudar de casa» com «comprar carro» na mesma tabela
- **Arranque por perfil** — no ecrã vazio, duas escolhas independentes: quem vive em casa (*vivo sozinho · casal · família com filhos*) e a habitação (*a arrendar · com casa própria*, esta com *paga* ou *com empréstimo*). A prévia diz quantos membros e que despesas vão nascer; semeia membros, despesas fixas típicas e limites, para ajustar (e com anulação imediata)
- **Estados vazios ilustrados** — cada vista vazia mostra um mini-diagrama do que ali vai: uma fonte a decompor-se em componentes, uma prestação a dividir-se em juros, capital e seguros
- **Relatório mensal** (Dados ▾) — uma folha desenhada para imprimir ou guardar em PDF: capa, indicadores, fluxo do dinheiro, desvios, despesa por categoria, património e objetivos
- **Acessibilidade** — três tamanhos de texto e um modo de **alto contraste** em Definições → Aparência
- **Visita guiada (🎓)** — um tutorial opcional de 14 passos que percorre todos os módulos, do painel às estratégias, destacando o elemento relevante de cada vista e explicando o que lá se faz. Começa no botão 🎓 do cabeçalho, no ecrã de boas-vindas, na paleta ou na primeira sugestão do painel; navega-se com as setas e sai-se com Esc. Sem dados, carrega o exemplo primeiro
- **Paleta de comandos (Ctrl+K)** — saltar para qualquer vista ou disparar uma ação rápida (novo movimento, novo ativo, exportar, imprimir) sem tirar as mãos do teclado; a procura ignora acentos
- **Eliminar com anulação** — apagar é imediato e o toast dá seis segundos para **Anular**; só o «Apagar tudo» mantém o diálogo de confirmação
- **Validação junto ao campo** — os erros aparecem por baixo do próprio campo, não num aviso genérico
- **Formulários faseados** — o formulário de ativo mostra só o essencial; o resto vive em «Mais opções», e os campos contextuais (VPT, IUC, arrendamento, cotação) só aparecem nas classes que os usam
- **Micro-movimento discreto** — barras que enchem, anéis que se desenham, confete único quando um objetivo chega aos 100% — tudo desligado com `prefers-reduced-motion`

#### No telemóvel

Tudo o que existe no computador existe no telemóvel: muda a forma de lá chegar, não o que se pode fazer. Três interações dependiam de rato — o duplo clique, o *hover* e o arrasto HTML5 — e cada uma ganhou um caminho paralelo, sem perder o original.

- **Alvos de 44 px** em toda a interface quando o ponteiro é grosso, ou o ecrã estreito: botões, campos, caixas de seleção e cabeçalhos de tabela. Eram 123 de 132 abaixo de 40 px
- **Cabeçalho que recolhe ao descer** e volta ao subir, devolvendo 190 px de um ecrã de 812. No topo, ou com um diálogo aberto, fica sempre visível
- **Ações secundárias numa folha (⋯)** — tema, explicadores, privacidade, modo essencial, visita e relatório saem do cabeçalho, que passa de 17 botões visíveis a 6
- **Navegação inferior fixa** com as quatro vistas principais e uma folha «Mais»
- **Fita de meses em toda a largura**, tocável, no lugar das setas ‹ ›; e **deslizar na horizontal** muda de mês
- **Toque simples edita** uma célula da tabela — o duplo toque está tomado pelo zoom do navegador; com rato mantém-se o duplo clique
- **Toque mostra o explicador**: sem *hover*, 87 explicadores ficariam inalcançáveis
- **Botões ↑ ↓ para reordenar** categorias, rubricas e cartões do painel, porque os navegadores móveis não disparam o arrasto HTML5. Com rato ficam escondidos, que aí a pega ⠿ é melhor
- **Tabelas em cartões** nos ecrãs estreitos, com um **seletor de ordenação** que devolve o que o cabeçalho ordenável fazia

### Rendimentos

Cada **fonte** (um vencimento, uma pensão, o conjunto dos apoios) decompõe-se em **componentes**, num nível colapsável:

| Espécie | Segurança Social | Retenção de IRS |
| --- | --- | --- |
| Vencimento base | sim | sim |
| Subsídio de férias | sim | sim |
| Subsídio de Natal | sim | sim |
| Subsídio de alimentação | só o excedente | só o excedente |
| Trabalho suplementar | sim | sim |
| Prémios e gratificações | sim | sim |
| Comissões | sim | sim |
| Ajudas de custo | não | não |
| Abonos e apoios sociais | não | não |
| Pensão | não | sim |
| Renda recebida | — | categoria F, autónoma |
| Juros e dividendos | — | taxa liberatória |

A incidência de cada componente é a da espécie, mas pode ser mudada caso a caso. O **subsídio de alimentação** respeita o limite de isenção diária (em cartão ou em numerário) e só tributa o excedente.

A ficha de cada fonte mostra a cascata **do bruto ao líquido**, com barra de repartição, e um anel com o peso de cada espécie — dá para ver de relance quanto do rendimento é fixo e quanto depende de prémios.

#### Prestações sociais

Uma **subcategoria dos rendimentos** — no seletor de espécies as prestações sociais aparecem agrupadas à parte do trabalho e das pensões, e o rendimento distingue numa linha própria «— do qual prestações sociais (abonos e subsídios)». Todas são pagas pela Segurança Social e por isso **isentas de IRS e de contribuições**:

**Subsídio parental.** Nove modalidades, com a duração e a percentagem da remuneração de referência de cada uma:

| Modalidade | Duração | % da referência |
| --- | --- | --- |
| Inicial | 120 dias | 100% |
| Inicial | 150 dias | 80% |
| Partilhada (120 + 30) | 150 dias | 100% |
| Partilhada (150 + 30) | 180 dias | 83% |
| Partilhada, pai 60 dias seguidos | 180 dias | 90% |
| Exclusivo do pai | 28 + 7 dias | 100% |
| Alargado | 3 meses | 30% |
| Alargado, ambos os progenitores | 3 meses cada | 40% |
| Alargado a tempo parcial | 3 meses | 20% |

O parental cobre ainda os apoios ao **parto múltiplo** e à **prematuridade**: gémeos, trigémeos e além acrescentam **30 dias por cada bebé além do primeiro**, e o internamento hospitalar do recém-nascido estende a licença pelo **período de internamento mais 30 dias após a alta**, pagos a 100% da referência. Ambos se indicam na própria calculadora e entram na duração e no montante.

**Subsídio por risco clínico durante a gravidez**: 100% da remuneração de referência, por todo o período de afastamento prescrito.

**Abono de família para crianças e jovens**: cinco escalões, por rendimento de referência do agregado e idade da criança, com majoração de 50% nas famílias monoparentais.

| Escalão | Rendimento de referência | Até 36 meses | 36 a 72 | Mais de 72 |
| --- | --- | --- | --- | --- |
| 1.º | até 3 759,91 € | 190,98 € | 75,13 € | 75,13 € |
| 2.º | até 7 519,82 € | 161,65 € | 75,13 € | 75,13 € |
| 3.º | até 12 783,69 € | 132,07 € | 59,33 € | 54,35 € |
| 4.º | até 18 799,55 € | 88,43 € | 44,77 € | — |
| 5.º | acima | — | — | — |

Sobre o abono acumulam-se três apoios opcionais, cada um assinalado por criança:

- **Majoração para crianças com menos de 36 meses** — quando o agregado tem **duas ou mais** crianças abaixo dessa idade, cada uma (a partir da segunda) recebe um acréscimo por escalão. A ferramenta conta as crianças marcadas em todo o agregado e só aplica a majoração quando há pelo menos duas.

  | Escalão | Duas crianças < 36 m | Mais de duas |
  | --- | --- | --- |
  | 1.º | 64,96 € | 106,96 € |
  | 2.º | 57,64 € | 92,32 € |
  | 3.º | 54,35 € | 85,76 € |
  | 4.º | 39,28 € | 55,70 € |
  | 5.º | — | — |

- **Bonificação por deficiência** — 74,19 € até aos 14 anos, 108,06 € dos 14 aos 18, 144,63 € dos 18 aos 24, ela própria majorada em 50% nas famílias monoparentais.

- **Abono pré-natal** — a partir da 13.ª semana de gestação, no valor do 1.º escalão de idade do abono para o rendimento de referência do agregado, **multiplicado pelo número de bebés esperados** (gémeos, trigémeos) e com majoração própria de **35%** nas famílias monoparentais.

**Cada uma tem calculadora**, e é aí que se liga ao resto. A **remuneração de referência** sai das componentes mensais tributáveis da própria fonte — se a licença é de quem ganha ali, o valor vem sozinho: no exemplo, 1850 € de vencimento dão 61,67 €/dia de referência, ou seja 1850 €/mês a 100% durante 120 dias, ou 1480 € a 80% durante 150. O **escalão do abono** sai do rendimento anual do agregado a dividir pelo número de titulares mais um, e as prestações sociais não contam para essa referência — o abono não conta para o escalão do próprio abono.

Os mínimos são indexados ao **IAS** (537,13 € em 2026): 14,32 €/dia no parental e no risco clínico, 7,16 € no alargado. Quando a referência fica abaixo, a ferramenta eleva ao mínimo e di-lo.

As calculadoras **preenchem o campo sem gravar** — quem decide se o número serve continua a ser quem está a preencher. A tabela de componentes mostra depois de onde veio cada valor: a modalidade, a duração, os bebés e o internamento no parental; o escalão, a idade e as majorações no abono.

### Despesas

Um separador com quatro secções: **Despesas fixas** (rubricas com qualquer periodicidade, convertidas para o equivalente mensal), **Movimentos** (o que entrou e saiu, com pesquisa e filtros), **Limites** (teto por categoria com barra de utilização) e **Planear** (as compras grandes que ainda podem escolher a data).

O botão **Lançar plano deste mês** cria os movimentos já decompostos — juros, amortização, seguros, encargos de cada ativo.

#### Planear despesa

Um eletrodoméstico, um portátil, mobília, uma mota, um carro: despesas com peso que, ao contrário de uma avaria, **podem escolher quando acontecem**. A pergunta deixa de ser «posso pagar isto?» e passa a ser **«quando é que isto cabe melhor?»**.

Indica-se a verba estimada — há exemplos com ordens de grandeza típicas, para ajustar — e um horizonte de **3, 6, 12 ou 24 meses**. A ferramenta simula a compra em cada mês desse horizonte e responde **por trimestre**:

- A **folga** de um mês não é o saldo desse mês: é o **mínimo da tesouraria projetada desse mês em diante**, já com a compra feita. Um mês bom seguido de um dezembro apertado não é um mês bom.
- Cada trimestre mostra o seu melhor mês, a folga que sobra e uma cor: **verde** (sobra mais de três meses de despesa), **âmbar** (cabe, mas deixa a reserva curta) e **vermelho** (não cabe).
- O veredicto vem em palavras: *«Melhor altura: junho de 2027 — depois da compra ficam 8 191,80 € (3,3 meses de despesa)»*.
- As compras já marcadas entram na base de cálculo das seguintes, para o mesmo dinheiro não ser gasto duas vezes.

Depois da decisão, três atalhos, cada um a reaproveitar o que já existe em vez de duplicar:

| Ação | O que faz |
| --- | --- |
| **Marcar o mês** | A compra passa a pesar na **tesouraria a 12 meses**, marcada com um losango, e no mês marcado surge um aviso no **painel de atenção** |
| **Reservar verba** | Cria um **objetivo de poupança** com a verba e o prazo — o progresso, os reforços e o ritmo vivem nos Objetivos, como qualquer meta. Editar o valor da compra arrasta a meta; remarcar a data arrasta o prazo |
| **Registar a compra** | Lança o movimento com a categoria e o valor, arruma o objetivo de reserva e passa a compra às realizadas (anulável com Ctrl+Z) |

Para esperas de um ano ou mais, **«Onde guardar a reserva →»** abre as Estratégias já afinadas para esta meta — deixar a verba a render enquanto se espera paga parte da compra. E o cartão **«Posso pagar isto?»** do painel oferece o caminho inverso: se a resposta foi «agora não», leva o valor direto para aqui.

### Ativos

Uma só lista para tudo o que tem valor, agrupada por natureza:

| Grupo | Classes |
| --- | --- |
| Liquidez | conta à ordem, conta poupança, depósito a prazo |
| Poupança | certificados de aforro, certificados do tesouro, obrigações |
| Reforma | PPR |
| Mercado | ETF, fundos, ações, REIT, ouro, criptomoedas |
| Reais | imóvel, terreno, automóvel, mota, arte, joias, coleções |

A **conta à ordem** distingue-se da **conta poupança**: a primeira é liquidez pura sem juros, a segunda tem taxa associada e capitaliza. O KPI de **liquidez imediata** diz quantos meses de despesa estão disponíveis sem vender nada — abaixo de três meses fica vermelho.

Cada ativo tem valor (por unidades × cotação, valor indicado ou estimativa), retorno esperado **bruto e líquido de imposto**, contribuição mensal, crescimento anual da contribuição, percentagem de reinvestimento, encargos, rendas, aportes datados e créditos associados.

#### Simulador por ativo

Cada ativo financeiro tem o seu painel de simulação, com cinco deslizadores que recalculam o gráfico ao vivo: **contribuição mensal**, **quanto cresce por ano**, **retorno anual**, **percentagem de reinvestimento** e **horizonte**. O gráfico mostra o cenário base com banda entre pessimista (−3 pp) e otimista (+2 pp), mais a linha do capital aportado.

É a mesma ferramenta para um PPR e para um ETF — muda o que se lê à volta:

- **PPR**: calcula o **benefício fiscal** das entregas (dedução à coleta, com o limite anual) e lembra a taxa aplicável à saída.
- **ETF**: a percentagem de reinvestimento distingue um ETF de acumulação (100%) de um de distribuição, e mostra quanto sai como distribuição em vez de capitalizar.
- **Poupança e certificados**: usa o retorno já líquido da taxa liberatória sobre juros.

O botão **Aplicar ao ativo** transfere os valores simulados para o ativo; **Repor** descarta-os. Há ainda uma **projeção agregada** de todos os ativos financeiros, com simulação de correção de mercado.

#### Rendibilidade

Para os ativos que rendem, três leituras lado a lado:

- **Bruta** — rendas sobre o valor.
- **Líquida** — descontados encargos e impostos, **não** o crédito. Mede o mérito do ativo, independentemente de como foi pago.
- **Sobre capital próprio (cash-on-cash)** — fluxo de caixa efetivo sobre o capital próprio investido. Inclui a alavancagem: é maior quando o crédito é barato e menor quando é caro.

### Objetivos de poupança
Metas com valor-alvo e prazo, cada uma com um **anel de progresso** e um **veredicto de ritmo** («No ritmo certo — reforce X €/mês × N meses» / «Apertado — não cabe no saldo previsto»). Calcula o que falta, o **esforço mensal necessário** e se esse esforço cabe no saldo previsto. Quando um objetivo chega aos 100%, há confete — uma vez só.

### Estratégias de poupança e investimento

Um separador de **simuladores interativos**, um por objetivo. Escolhe-se o objetivo, o instrumento, a poupança mensal e o horizonte, e a ferramenta projeta o resultado **líquido do imposto português de 2026** de cada instrumento — com deslizadores que recalculam ao vivo.

Cinco objetivos, cada um com os instrumentos que costumam fazer-lhe sentido:

| Objetivo | O que calcula | Instrumentos sugeridos |
| --- | --- | --- |
| 🏖️ **Reforma** | Capital acumulado, renda mensal sustentável (regra dos 4%) e poupança no IRS via PPR | PPR, ETF, ações, obrigações, aforro |
| 🏠 **Entrada para casa** | Entrada + IMT + Imposto de Selo + escritura, e o esforço mensal para lá chegar | Aforro, certificados do tesouro, depósito, obrigações, ETF |
| 🚗 **Comprar automóvel** | Meta e esforço mensal, privilegiando capital garantido | Aforro, depósito, tesouro, obrigações |
| 🛟 **Fundo de emergência** | Meses de despesa a cobrir (lidos do plano) e liquidez necessária | Depósito, poupança, aforro |
| 📈 **Fazer crescer o capital** | Valor final líquido, rendimento e imposto, sem meta fixa | ETF, ações, fundos, cripto, PPR, obrigações, aforro |

**A fiscalidade está no centro.** Cada instrumento é projetado com o seu regime real: os **juros** (depósitos, poupança, certificados de aforro Série F, obrigações) capitalizam ao líquido dos 28% retidos na fonte; as **mais-valias** (ETF, ações, fundos) crescem ao bruto e pagam 28% só no resgate; a **cripto** fica isenta a partir de um ano de detenção; o **PPR** não é tributado na acumulação, paga 8% no resgate e dá dedução à coleta de 20% até ao limite pela idade. Uma **tabela compara todos os instrumentos** do objetivo com a mesma poupança, mostrando o valor final líquido de cada um.

Na compra de casa, os **custos** decompõem-se pelas tabelas de IMT de 2026 (Continente, habitação própria e permanente), com o Imposto de Selo de 0,8% e a **isenção para jovens até 35 anos** (até 330 539 €).

**Executar a estratégia** integra-a no resto do orçamento de uma só vez: cria uma **rubrica de poupança** no plano mensal, um **ativo** que passa a crescer no balanço e nas projeções (e, sendo PPR, alimenta o benefício fiscal), e — havendo meta — um **objetivo** com prazo. É uma ferramenta de cálculo, não aconselhamento financeiro.

### Créditos

Cada empréstimo pode ser de **taxa fixa** ou de **taxa variável (indexada)**:

- **Fixa** — uma taxa anual, prestação constante até ao fim.
- **Variável** — indexante (Euribor a 3, 6 ou 12 meses, ou outro) + spread contratado, com o período de revisão. A prestação é recalculada em cada revisão sobre o capital e o prazo que restam, como no contrato.

Para cada crédito:
- **Encargo mensal decomposto** em juros, amortização de capital e seguros, com uma barra que mostra a repartição e para que categoria vai cada parte
- **Capital em dívida** à data e prestações já pagas
- **Juros do crédito**, custo total (capital + juros + seguros) e **juros ainda por pagar**
- **Mapa de amortização por ano** — com coluna de taxa, nos créditos indexados
- **Ativo financiado**, quando associado

E, transversalmente:
- **Taxa de esforço** face ao rendimento, com aviso acima de 33% e de 40%
- **«E se as taxas subirem?»** — um deslizador desloca o indexante entre −2 e +5 pontos percentuais a partir do mês em análise, e tudo recalcula ao vivo: prestação, dívida, juros futuros e taxa de esforço. Os créditos de taxa fixa não reagem, que é precisamente o que se quer ver ao comparar regimes.

### Investimentos

Carteira com onze classes de ativo — depósitos a prazo, certificados de aforro, certificados do tesouro, obrigações, PPR, fundos e ETFs, ações, imobiliário cotado, ouro e matérias-primas, criptomoedas e outros. Cada classe traz um retorno esperado e uma queda típica de referência, ambos substituíveis posição a posição.

Para cada posição:
- **Capital aplicado, valor atual e mais/menos-valia** em euros e em percentagem
- **Unidades × cotação** opcionais — prático para ações, ETFs e cripto; basta atualizar a cotação com o botão ↻
- **Retorno esperado vs. retorno obtido** (CAGR anualizado desde a data de entrada). Quando divergem, o botão **corrigir** adota o retorno real como nova expectativa nas projeções
- **Reforço mensal**, com aviso se o total não couber no saldo previsto e um botão para o levar ao plano mensal

E, ao nível da carteira:
- **Alocação por classe** em anel interativo
- **Teste de resistência**: valor da carteira se houver uma correção severa, classe a classe, e se mesmo assim ficaria acima do capital aplicado
- **Projeção** com juro composto mensal e reforços, em três cenários (pessimista −3 pp, base, otimista +2 pp), com banda entre extremos, linha do capital aportado e valores **a preços de hoje** descontada a inflação
- **Simulação de correção**: liga-se num interruptor e regula-se a severidade e o momento em deslizadores — o gráfico e a tabela acompanham em tempo real

### Fiscalidade portuguesa

> **Valores de 2026.** As tabelas de retenção na fonte vêm dos ficheiros oficiais das três regiões; as restantes taxas foram verificadas para 2026 e citam a base legal. Todas são editáveis em **Definições → Fiscalidade**.

### Retenção na fonte de IRS — tabelas oficiais de 2026

As **33 tabelas oficiais** (11 por região) estão transcritas na aplicação, a partir dos ficheiros publicados, que ficam em [`dados/`](dados/) para se poder auditar a transcrição:

| Região | Ficheiro |
| --- | --- |
| Continente | `Tabelas_RF_Continente_2026.xlsx` |
| Região Autónoma dos Açores | `Tabelas_RF_RA_Acores_2026.xlsx` |
| Região Autónoma da Madeira | `Tabelas_RF_RA_Madeira_2026.xlsx` |

**A região é uma escolha explícita** em Definições → Fiscalidade, porque as Regiões Autónomas retêm bastante menos: a 2000 € mensais, um solteiro sem dependentes retém 301,34 € no Continente, 196,43 € nos Açores e 205,89 € na Madeira. Aplicar as tabelas do Continente a um residente numa Região Autónoma sobrestimaria a retenção em mais de 30%. A interface mostra uma tabela comparativa das três regiões.

**A tabela aplicável** decorre da situação familiar e do tipo de rendimento:

| Situação | Trabalho dependente | Pensões |
| --- | --- | --- |
| Não casado, sem dependentes | I | VIII |
| Não casado, com dependentes | II | VIII |
| Casado, dois titulares | I | VIII |
| Casado, único titular | III | IX |
| Deficiência, sem dependentes | IV | X |
| Deficiência, não casado com dependentes | V | X |
| Deficiência, casado dois titulares com dependentes | VI | X |
| Deficiência, casado único titular | VII | XI |

**A retenção é calculada pagamento a pagamento**, como na realidade — e não sobre uma média anual:

- as componentes mensais somam-se numa remuneração mensal, e a tabela aplica-se uma vez a esse total;
- cada componente de outra periodicidade (subsídio de férias, de Natal, prémios anuais) é um **pagamento autónomo**: a tabela aplica-se ao seu próprio valor, e o resultado é mensalizado pela frequência;
- o excedente do subsídio de alimentação acima do limite de isenção entra na remuneração mensal.

Isto importa: somar os subsídios à média mensal empurraria o contribuinte para um escalão superior todos os meses, sobrestimando a retenção. A ficha de cada fonte mostra a decomposição — que tabela, que escalão, que taxa marginal, que parcela a abater — para se poder conferir contra o recibo de vencimento.

A fórmula oficial é `retenção = remuneração × taxa − parcela a abater − (parcela por dependente × nº)`, com a parcela a abater fixa na maioria dos escalões e, nos primeiros, dada por `coef × fator × (limiar − remuneração)`.

> **Uma inconsistência no ficheiro dos Açores.** Na Tabela VII (casado, único titular, pessoa com deficiência), escalão «até 6916 €», a taxa efetiva publicada é 9,8% — *inferior* à do escalão anterior (9,9%), o que é impossível numa tabela progressiva. A taxa marginal (20,17%) e a parcela a abater (702,75 €) publicadas dão 10,009%. A ferramenta segue a taxa e a parcela, que são o que a lei manda aplicar; a coluna da taxa efetiva é informativa. A suite de testes documenta esta exceção e avisa se um ficheiro corrigido a resolver.

Quem preferir pode desligar as tabelas e usar **uma taxa efetiva única**, lida do recibo — é exata para o mês em que a leu, mas não distingue subsídios nem acompanha mudanças de escalão.

### Restantes taxas

| Sobre o quê | Taxa em 2026 | Base legal |
| --- | --- | --- |
| Segurança Social, conta de outrem | 11% (entidade patronal 23,75%) | Código Contributivo art.º 53.º |
| Segurança Social, independentes | 21,4% | regime geral, sobre 70% do rendimento relevante |
| Subsídio de alimentação, cartão | **10,46 €/dia** isentos | 6,15 × 1,70 |
| Subsídio de alimentação, numerário | **6,15 €/dia** isentos | Portaria n.º 51-B/2026/1, efeitos a 01/01/2026 |
| IAS — Indexante dos Apoios Sociais | **537,13 €** | Portaria n.º 480-A/2025/1 |
| Subsídio parental, mínimo diário | 14,32 € | 80% de 1/30 do IAS |
| Parental alargado, mínimo diário | 7,16 € | 40% de 1/30 do IAS |
| Juros, dividendos, mais-valias | 28% | CIRS art.º 71.º, taxa liberatória |
| Rendas, **renda moderada** | **10%** | **Lei n.º 9-A/2026**, até 31/12/2029 |
| Rendas, habitação até 5 anos | 25% | CIRS art.º 72.º, Lei n.º 56/2023 |
| Rendas, 5 a 10 anos | 15% | Lei n.º 56/2023 |
| Rendas, 10 a 20 anos | 10% | Lei n.º 56/2023 |
| Rendas, 20 anos ou mais | 5% | Lei n.º 56/2023 |
| Rendas, não habitacional | 28% | CIRS art.º 72.º |
| IMI, prédios urbanos | 0,3% a 0,45% do VPT (0,3% por omissão) | CIMI art.º 112.º, fixada pelo município |
| PPR, dedução à coleta | 20% das entregas | EBF art.º 21.º |
| PPR, limite anual | 400 € / 350 € / 300 € | conforme a idade: até 35, 35–50, mais de 50 |
| PPR, taxa à saída | 8% nas condições, 21,5% fora | EBF art.º 21.º |
| IUC | por veículo | depende de cilindrada, emissões e ano |

**Renda moderada (novidade de 2026).** A Lei n.º 9-A/2026 criou uma taxa de 10% para rendimentos prediais de contratos de arrendamento habitacional com renda até **2 300 €/mês** e duração mínima de três anos, vigente até 31 de dezembro de 2029. Escolhe-se por imóvel; se a renda registada exceder o teto, a ferramenta avisa e aplica a taxa da duração do contrato em vez de fingir que o benefício se mantém.

**IMI: a taxa por omissão é 0,3%**, o mínimo legal, porque é o que 199 dos 308 municípios aplicam em 2026. Confirme a do seu concelho — Oeiras, por exemplo, subiu para o máximo de 0,45%.

**Cópias gravadas antes de uma atualização.** Uma cópia guardada mantém as taxas do ano em que foi gravada — é o comportamento certo, senão os ajustes de quem usa a ferramenta seriam apagados a cada atualização. Mas ficar em silêncio a orçamentar com valores antigos não serve. Quando o ano guardado é anterior ao da ferramenta, as Definições mostram uma tabela do que difere, com o valor antigo e o novo lado a lado, e dois botões: **atualizar** (substitui só as taxas que dependem do ano) ou **manter** (deixa como está e não volta a avisar). A taxa efetiva de IRS, a idade, os dias de subsídio, a situação familiar e a região nunca são tocadas — são escolhas pessoais, não do calendário.

**A duração do contrato é aplicada imóvel a imóvel**, não uma taxa única a todos: indique-a na ficha de cada arrendamento e a ferramenta usa a taxa correspondente.

**O regime de contribuições escolhe-se em cada fonte de rendimento** — uma pensão não paga TSU, um independente paga a taxa dele. Quando as fontes têm regimes diferentes, o indicador agregado mostra a taxa efetiva sobre o conjunto das bases, em vez de fingir uma taxa única.

**Onde cada imposto entra:** o IMI e o IUC são **pagos em dinheiro**, pelo que entram na despesa mensal e na categoria *Impostos*. Os impostos sobre juros e mais-valias são **retidos na fonte**, pelo que não aparecem como despesa: reduzem o retorno líquido do ativo, que é o valor usado nas projeções. Um certificado de aforro a 2,5% brutos rende 1,8% depois de imposto, e é 1,8% que a projeção usa.

O interruptor **Só bruto** desliga IRS e Segurança Social do orçamento, para quem prefere registar o vencimento já líquido nos movimentos.

#### O que não está modelado

- **O acerto anual do IRS.** As tabelas calculam a *retenção*, que é um adiantamento por conta. O imposto devido só se apura na declaração, com as deduções à coleta, o quociente familiar e o mínimo de existência — daí resultar reembolso ou pagamento. A ferramenta mostra o que sai do vencimento todos os meses, não o que se acerta em julho.
- **Deduções específicas e à coleta** além do PPR: saúde, educação, habitação, IVA de faturas.
- **Regimes especiais**: IRS Jovem, residente não habitual, mínimo de existência.
- **Englobamento obrigatório** de mais-valias de ativos detidos há menos de um ano, para quem esteja no escalão mais alto — nesses casos a taxa efetiva é superior aos 28%.
- **Prédios rústicos** (0,8%) e prédios em regime de avaliação anterior.
- **Imposto do Selo** sobre a contratação do crédito.

### Como tudo se liga às categorias

Nada fica fora do orçamento. Cada fluxo tem um destino explícito:

| Origem | Categoria de destino (por omissão) |
| --- | --- |
| Vencimento base | *Vencimento* |
| Subsídios e abonos | *Subsídios e abonos* |
| Prémios, comissões, trabalho suplementar | *Prémios e variáveis* |
| IRS, Segurança Social, imposto sobre rendas | *IRS e Segurança Social* |
| Juros da prestação | *Juros de crédito* (necessidades) |
| Amortização de capital | *Amortização de capital* (**poupança**) |
| Seguros do crédito | *Seguros de crédito* (necessidades) |
| IMI, IUC | *Impostos* |
| Condomínio | *Condomínio* |
| Seguros do ativo | *Seguros* |
| Manutenção e obras | *Manutenção e reparações* |
| Rendas recebidas | *Rendas recebidas* (rendimento) |

As categorias de destino de cada crédito e de cada encargo são escolhidas por si — as da tabela são apenas as sugestões iniciais.

A **amortização de capital conta como poupança**, não como consumo: não é dinheiro que desaparece, é rendimento convertido em património. Por isso entra nos 20% da regra 50/30/20, e é também por isso que a taxa de poupança sobe à medida que se amortiza. Os juros, esses, são o custo real de ter o crédito, e ficam nas necessidades.

O botão **Lançar plano deste mês**, em Movimentos, cria os movimentos já decompostos — um por juros, um por amortização, um por seguros, mais os encargos mensais de cada ativo.

### Definições
Membros do agregado, categorias (nome, tipo, grupo 50/30/20 e cor) e gestão de dados.

## 🚀 Como começar

### Uso local
Basta abrir `orcamento-familiar.html` num browser moderno — não é preciso instalar nada nem ter ligação à internet.

```bash
git clone https://github.com/seu-utilizador/orcamento-familiar.git
cd orcamento-familiar
# abra orcamento-familiar.html no browser
```

No primeiro arranque, o botão **Carregar exemplo** preenche um agregado fictício completo (dois vencimentos, despesas correntes, crédito habitação e dois objetivos) para explorar a ferramenta. Depois apague tudo em *Definições → Apagar tudo* e comece do zero.

### Instalação como app (PWA)
Servida por HTTP/HTTPS (por exemplo em GitHub Pages), a página é instalável:

1. Abrir no Chrome/Edge
2. Clicar em "Instalar" na barra de endereços
3. A app abre em janela própria e funciona offline

O `sw.js` coloca a aplicação em cache com estratégia *network-first* — atualiza quando há rede, funciona sem ela.

## 📖 Fluxo de trabalho sugerido

1. **Definições** → adicionar os membros do agregado e, em *Fiscalidade*, pôr a sua taxa efetiva de IRS (está no recibo de vencimento)
2. **Rendimentos** → criar uma fonte por vencimento e acrescentar as componentes: base, férias, Natal, alimentação, o que houver de variável
3. **Despesas → Despesas fixas** → registar as despesas recorrentes com a periodicidade real de cada uma
4. **Ativos** → registar tudo: contas, poupanças, PPR, ETFs, imóveis, carro. Aceitar os encargos típicos sugeridos e preencher os valores; indicar o VPT dos imóveis e o IUC dos veículos
5. **Créditos** → registar os empréstimos, associar cada um ao ativo que financia e escolher o regime de taxa
6. **Despesas → Limites** → *Preencher com o plano* e ajustar os tetos das categorias variáveis
7. **Objetivos** → definir metas com prazo
8. **Estratégias** → simular como poupar para cada objetivo (reforma, casa, automóvel) e, quando encaixar, executar a estratégia para o orçamento
9. Ao longo do mês, **Despesas → Movimentos** → lançar o que vai acontecendo
10. **Painel** → acompanhar o desvio face ao previsto e o património líquido

Passos 4 e 5 podem trocar de ordem: se criar o ativo primeiro, a ligação faz-se no formulário do crédito.

Manutenção periódica sugerida: atualizar cotações uma vez por mês ou por trimestre (botão ↻), registar cada aporte com a sua data para o retorno ser calculado por TIR, rever o valor dos imóveis uma vez por ano, e atualizar o indexante quando a Euribor se mexer.

## 🔐 Privacidade e cópias de segurança

Não existe servidor, conta ou envio de dados. Tudo é guardado no `localStorage` do browser, associado a esse browser e a esse computador.

> **Limpar os dados de navegação apaga o orçamento.** Exporte uma cópia com alguma regularidade.

Em *Definições → Dados* (ou no menu **Dados ▾** do cabeçalho):
- **Exportar JSON** — cópia completa, para guardar ou passar para outro computador
- **Importar JSON** — repõe uma cópia (substitui o conteúdo atual, com confirmação)
- **Movimentos (CSV)** — separador `;` e BOM UTF-8, abre diretamente no Excel em português
- **Património (CSV)** — carteira, bens e balanço num único ficheiro
- **Imprimir / PDF** — folha de estilos de impressão dedicada, sem botões nem controlos

## 🏗️ Arquitetura

- **Frontend**: JavaScript vanilla, sem bibliotecas nem CDN
- **Gráficos**: SVG gerado à mão (anel, barras, área de projeção) — sem Chart.js nem equivalentes
- **Ficheiro único**: `orcamento-familiar.html` contém marcação, estilos e lógica
- **Persistência**: `localStorage` (chave `orcamento-familiar-v1`), exportação manual para JSON/CSV
- **Segurança**: todo o texto introduzido pelo utilizador passa por `esc()` antes de ser interpolado em HTML

Organização do código dentro do `<script>`:

| Secção | Conteúdo |
| --- | --- |
| Utilitários | formatação pt-PT/EUR, parsing de números com vírgula, aritmética de meses |
| Constantes | `FREQ`, `GRUPOS`, `CLASSES` (ativos), `BENS`, `CENARIOS` |
| Estado inicial | categorias-semente e estrutura de dados |
| Persistência | `guardar` / `carregar` / `normalizar` |
| Consultas | `planoMes`, `realMes`, `porGrupo` |
| Planeamento | `tesourariaProjetada`, `eventosPlaneados`, `analisarPlaneada`, `veredictoPlaneada`, `reservaMensalPlaneada` |
| Fiscalidade | `fiscalRendimento`, `fiscalTotal`, `impostoAtivo`, `beneficioPPR`, `isencaoAlimentacao` |
| Crédito | `tabelaCredito`, `parcelaMes`, `saldoDevedorMes`, `amortizacaoAnual`, `taxaCorrente` |
| Retorno | `tir`, `vpl`, `fluxosCaixa`, `retornoObtido`, `retornoLiquido` |
| Ativos | `valorAtivo`, `projetarAtivo`, `dividaDoAtivo`, `capitalProprio`, `fluxoAtivo`, `rendibilidade`, `balanco` |
| Gráficos | `donut`, `barrasEvolucao`, `areaProjecao`, `barra` |
| Vistas | uma função por separador, devolvem HTML |
| Ações | mapa `ACOES`, ligado por delegação de eventos em `[data-act]` |
| Interatividade | `SLIDERS` (recálculo ao vivo), `ordenado`/`th` (tabelas), sugestões flutuantes |
| Explicadores | `AJUDAS_*` (dicionário), `ajudaDe` (resolução), `marcarAjudas` (afordância) |

### Testes

Quatro suites, 15 004 asserções, executadas dentro da própria aplicação. Para as correr, abra a app e cole na consola:

```js
["/qa.js","/qa-ui.js","/qa-limites.js","/qa-fuzz.js"].reduce((p,src)=>p.then(()=>new Promise(r=>{
  const s=document.createElement("script"); s.src=src+"?"+Date.now(); s.onload=r; document.head.appendChild(s);
})), Promise.resolve()).then(()=>console.log(__QA,__QAUI,__QALIM,__QAFUZZ));
```

| Ficheiro | O que cobre | Asserções |
| --- | --- | --- |
| `qa.js` | cálculo puro: parsing, aritmética de meses, amortização (incluindo reforço e ordem de amortização), TIR, tabelas de retenção, fiscalidade, prestações sociais (parental, risco, abono, majorações <36 meses, deficiência, pré-natal, parto múltiplo, prematuridade), estratégias de investimento (IMT/selo na compra, regime fiscal por instrumento, simulador, esforço para a meta), projeções, migração, passe de cálculo (plano e movimentos), planeamento de compras grandes (folga por trimestre, melhor altura), coerência do exemplo e do código | 3924 |
| `qa-ui.js` | interações: cada vista, formulário, validação em linha, deslizador, ordenação, gráfico, calculadoras de prestações, estratégias e a sua execução no orçamento, paleta de comandos e procura de dados, painel de atenção, saúde dos dados, regras e recorrências, ritmo dos limites, mapa anual, tesouraria, cenários, seleção em lote, edição em linha, navegação por teclado, arranque por perfil, estados vazios, acessibilidade, relatório, desfazer e refazer, autosave e restauro de sessão, eliminação com anulação, navegação móvel, objetivos, visita guiada, temas, Sankey, calendário de calor, importador CSV, painel personalizável, fita de meses, comparação de meses, amortização, «posso pagar isto?», duplicar, copiar mês, expressões nos campos, minigráficos, derivação dos números, toque (folha de ações, reordenar por botões, ordenação em modo cartão), planear despesa (analisar, marcar, reservar, realizar, anular), explicador, diálogo, exportação | 867 |
| `qa-limites.js` | casos adversos: valores absurdos, referências quebradas, fronteiras temporais, compras planeadas com datas impossíveis, volume, identidades contabilísticas | 6604 |
| `qa-fuzz.js` | estados aleatórios: 58 agregados inteiros gerados ao acaso (membros, rendimentos, rubricas, movimentos, ativos, créditos, objetivos e compras planeadas, com valores hostis à mistura) mais um **macaco** que dá 45 cliques ao acaso sobre 8 desses agregados, verificando as invariantes a cada passo | 3609 |

As suites repõem o estado do utilizador — e a sessão — no fim, e não deixam rasto: guardam o que está *em disco* (não só o que está em memória), cancelam as gravações adiadas que a última repintura agendou, e devolvem o `localStorage` byte a byte como o encontraram. Cada uma reporta em `window.__QA`, `window.__QAUI`, `window.__QALIM` e `window.__QAFUZZ`.

O fuzz é **determinístico**: cada agregado tem uma semente, e uma falha repete-se dando a mesma semente. É a única suite que testa aquilo em que ninguém pensou — as outras testam casos escolhidos, e por isso testam o que o autor já imaginou.

O que as suites verificam de mais útil não são os casos felizes, mas as **invariantes**:

- as categorias somam sempre ao total do plano, mês após mês;
- cada ativo conta exatamente uma vez no balanço;
- a tabela de amortização fecha no capital mutuado e termina a zero;
- o bruto de cada fonte é sempre o líquido mais a carga fiscal;
- a retenção nunca desce quando a remuneração sobe, nunca excede a remuneração, e nunca fica negativa por muitos dependentes — em todas as 33 tabelas;
- ganhar mais nunca deixa ninguém com menos líquido;
- cada escalão publicado bate com a taxa efetiva que o ficheiro oficial declara;
- **seja qual for o agregado** — e o fuzz gera-os aos milhares — o saldo é rendimento menos despesa, o balanço fecha, a tesouraria acumula mês a mês, nenhum número publicado é `NaN` ou infinito, e nenhuma vista deixa escapar `NaN` ou `undefined` para o ecrã.

É por aí que os erros aparecem. Dos bugs encontrados até hoje, os mais graves — ativos contados duas vezes no balanço, cache de crédito a ignorar o mês — vieram de invariantes, não de testar funcionalidades uma a uma.

Há ainda testes de **coerência estrutural**, que apanham lixo que se acumula com o tempo: explicadores para ações que já não existem, vistas sem explicador, deslizadores sem alvo, categorias citadas no código que não estão na semente.

E testes de **coerência do exemplo**, porque o exemplo é a primeira coisa que alguém vê: se contradisser a si próprio — abono num escalão que não dá abono, dependentes a zero com creche paga — ensina o contrário do que a ferramenta faz. Cada valor de abono tem de bater com o escalão do próprio agregado, cada componente tem de apontar para uma categoria do tipo certo, cada crédito para um ativo que existe.

### Explicadores

Passar o ponteiro sobre quase qualquer coisa mostra uma caixa a explicar o que é e, quando faz sentido, como se calcula. Cobre os separadores, os indicadores, os cabeçalhos ordenáveis, os campos dos formulários, os deslizadores e os botões de ação — mais de duzentos pontos na vista de Ativos.

O que tem explicação assinala-se pelo cursor de ajuda; as etiquetas dos campos ganham um sublinhado ponteado. O botão **?** no cabeçalho liga e desliga tudo, e a preferência fica guardada.

Não há `title=` espalhado pelo código. As explicações vivem num dicionário único — `AJUDAS_VISTA`, `AJUDAS_KPI`, `AJUDAS_COL`, `AJUDAS_CAMPO`, `AJUDAS_ACAO` — e são resolvidas em tempo de execução, subindo na árvore a partir do elemento sob o ponteiro: primeiro um `data-ajuda` explícito, depois o id do campo, o cabeçalho de coluna, o rótulo do indicador, o separador, a ação. Acrescentar uma explicação é acrescentar uma linha ao dicionário; a vista não muda.

Os valores dos gráficos têm prioridade sobre a prosa, e continuam a funcionar com os explicadores desligados — são informação, não ajuda.

### Passe de cálculo

Uma repintura chama `planoMes` uma vez por cada mês do gráfico de evolução — doze vezes — e cada uma dessas chamadas recalculava a fiscalidade de todas as fontes, que não depende do mês. No painel isso dava 42 cálculos fiscais idênticos por render; na vista de Ativos, 417 avaliações do valor dos ativos.

A solução é uma cache com **âmbito de passagem**: `render()` e os produtores dos deslizadores abrem uma passagem, e dentro dela `planoMes`, `realMes`, `fiscalRendimento` e `valorAtivo` memorizam. Fora de uma passagem não há cache nenhuma — o estado pode ter mudado entretanto, e devolver um valor guardado seria mentir.

O mesmo problema voltou quando o painel ganhou a tesouraria a 12 meses e o mapa do ano: `realMes` ficara de fora da passagem e varria a lista inteira de movimentos a cada chamada. O painel pede-o **59 vezes para 24 meses distintos** — 35 varreduras redundantes por repintura, que a cache eliminou (repintura 1,5× mais rápida com 5000 movimentos).

É por isso que a passagem é aberta e fechada explicitamente, em vez de invalidada por eventos: durante uma repintura síncrona o estado não pode mudar, o que torna a correção demonstrável em vez de esperada. Resultado: 42 cálculos fiscais passam a 6, e 417 avaliações de valor a 4.

As **fichas de ativo são colapsáveis**, e o que está fechado não é construído — não é apenas escondido. O critério de abertura por omissão é o número de simuladores, que é o que custa: cada um faz três projeções a 240 meses. Até dez, abre tudo; acima disso, fecha. Com 72 ativos a repintura passa de 97 ms para 24 ms, e a página deixa de ser uma parede de gráficos.

### Como funciona a interatividade

- **Deslizadores**: cada um declara em `SLIDERS` que parte do estado altera e que região regenera. Só essa região é reconstruída, para que o arrasto não seja interrompido; a gravação em `localStorage` é adiada 400 ms.
- **Tabelas ordenáveis**: `th(tabela, coluna, rótulo)` gera o cabeçalho e `ordenado(lista, tabela, extratores)` aplica a ordem — clique alterna crescente/decrescente, e funciona também por teclado.
- **Sugestões flutuantes**: os geradores de gráficos emitem `data-tip="título§rótulo=valor§…"`; um único ouvinte de `pointermove` desenha a caixa e posiciona-a dentro da janela.
- **Anéis interativos**: cada fatia tem `data-foco`; clicar isola-a (as restantes esbatem) e o centro passa a mostrar o seu valor e peso.

## 🧮 Notas de cálculo

- **Equivalente mensal**: valor × fator da periodicidade (anual = ÷12, 14× por ano = ×14/12, bimestral = ÷2, …). É provisionamento, não o encargo do mês em concreto.
- **Prestação**: `C · i / (1 − (1+i)^−n)`, com `i` = taxa anual ÷ 12 e `n` em meses. Taxa fixa; para crédito indexado (Euribor + spread) use a taxa em vigor — o resultado é uma estimativa.
- **Taxa de esforço**: prestações do mês ÷ rendimento. Referências habituais: até 33% confortável, acima de 40% arriscado.
- **Regra 50/30/20**: cada categoria de despesa pertence a um grupo (necessidades, desejos, poupança), editável em *Definições*.
- O painel usa os **movimentos reais** quando existem no mês; caso contrário, recorre ao plano.
- **Prestação e amortização**: a tabela é gerada mês a mês, o que trata taxa fixa e variável com o mesmo código. Numa taxa indexada, em cada revisão a prestação é recalculada como `C·i / (1 − (1+i)^−n)` sobre o **capital e o prazo que restam**, com `i = (indexante + spread)/12`.
- **Choque de taxa**: desloca o indexante a partir do mês em análise, não retroativamente — o histórico já pago não muda. Créditos de taxa fixa ignoram-no.
- **Fluxo de um ativo**: rendimentos − encargos de posse − serviço da dívida (prestação + seguros), tudo normalizado a mês.
- **Rendibilidade de um ativo**: bruta é `rendas anuais / valor atual`; líquida desconta os encargos de posse, mas **não** o crédito — o financiamento é uma decisão separada do mérito do ativo, e misturá-los faria uma casa comprada a pronto parecer melhor investimento do que a mesma casa com hipoteca.
- **Retorno obtido**: quando o ativo tem **aportes datados**, usa a **TIR** — resolve por bisseção a taxa que anula o valor presente dos fluxos, descontando cada entrada à sua própria data. Um reforço feito no mês passado deixa de inflacionar o resultado. Sem aportes registados, cai para o **CAGR** `(valor / aplicado)^(1/anos) − 1` sobre a entrada única, e a coluna diz qual dos dois métodos está em uso. Registe os aportes na ficha do ativo para passar a TIR.
- **Bisseção e não Newton-Raphson**: a bisseção é mais lenta mas converge sempre no intervalo onde há mudança de sinal; Newton diverge com fluxos irregulares, que são exatamente os que um agregado familiar tem.
- **Retorno líquido de um ativo**: retorno bruto × (1 − taxa liberatória), para as classes tributadas na fonte. O PPR não é tributado durante a acumulação, pelo que bruto e líquido coincidem.
- **Projeção de um ativo**: capitalização mensal, contribuição somada no fim de cada mês e aumentada uma vez por ano no aniversário. A parte do rendimento que não é reinvestida sai como distribuição e deixa de capitalizar.
- **Cash-on-cash**: fluxo de caixa anual (rendas − encargos − serviço da dívida) sobre o capital próprio (valor − capital em dívida). Fica indefinido se o capital próprio for nulo ou negativo.
- **Carga fiscal do rendimento**: SS = base contributiva × taxa; IRS = base de retenção × taxa efetiva. Ambas incidem sobre o bruto, como na retenção real. As componentes isentas não entram em nenhuma das bases.
- **Projeção**: capitalização mensal a `(1 + r)^(1/12) − 1` sobre o valor atual, com o reforço somado no fim de cada mês. Os valores «a preços de hoje» dividem por `(1 + inflação)^anos`.
- **Correção**: aplica de uma só vez, no mês escolhido, a queda típica de cada classe escalada pela severidade — 100% significa a queda típica completa (por exemplo −45% em ações, −70% em cripto).
- **Valorização de bens**: `aquisição × (1 + taxa)^anos`. Não substitui uma avaliação; para imóveis, corrija o valor manualmente quando tiver uma referência de mercado.

Os impostos estão contemplados com as taxas do regime português (ver a tabela acima), mas num modelo simplificado — sem escalões, sem quociente familiar, sem deduções específicas. Não estão contempladas comissões de corretagem ou custódia, nem a sequência real dos retornos. São estimativas para decidir, não para declarar.

## 📱 Compatibilidade

- Chrome/Edge 90+, Firefox 88+, Safari 15+, Opera 76+
- iOS Safari 15+ e Chrome Android 90+ (interface responsiva, tabelas com deslocamento horizontal)
- Respeita `prefers-color-scheme` e `prefers-reduced-motion`; tema claro/escuro/automático no botão ◐
- Gráficos com sugestões flutuantes ao ponteiro; em ecrãs táteis, tocar numa fatia isola-a
- Explicadores no botão **?**; em ecrãs sem ponteiro o cursor de ajuda é suprimido

## ⚠️ Aviso

Esta ferramenta faz aritmética sobre os números que lhe der. Não é aconselhamento financeiro, de investimento ou fiscal.

As taxas de retorno pré-preenchidas são referências históricas de longo prazo, não promessas.

As taxas fiscais são as do regime português em **2026**, com a base legal citada, mas a lei muda todos os anos e várias dependem de circunstâncias que a ferramenta não conhece — o município, a duração e o valor do contrato de arrendamento, a idade, a situação familiar. Confirme-as no recibo de vencimento, na nota de liquidação do IRS, na caderneta predial e nos avisos de IMI e IUC antes de decidir seja o que for com base nelas.

Para decisões com peso — comprar casa, escolher um PPR, concentrar a carteira, mudar de regime de taxa — fale com um profissional registado na CMVM ou na ASF, e com um contabilista certificado para a parte fiscal.

## 📄 Licença

Fornecido como está, para uso pessoal e familiar. Personalize à vontade.
