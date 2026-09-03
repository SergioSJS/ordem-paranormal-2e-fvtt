# Lacunas do playtest

O documento se autodeclara parcial e, em alguns pontos, se contradiz. Onde isso acontece
o sistema **não escolhe por você**: expõe um setting com o default recomendado.

Regra da casa: se a fonte é ambígua, o default segue o **texto normativo** (o corpo do
texto) e não a tabela-resumo, porque é o texto que explica a intenção.

## Contradições explícitas

### Compartilhar: Pesquisar ou Intuição? (spec §6.5)

O corpo do texto diz que o aliado faz um teste de **Pesquisar (DT 10)**. A tabela-resumo
de ações de investigação diz **Intuição**.

**Default:** `pesquisar`. Setting `compartilharPericia`.
Vale reportar no formulário de feedback do playtest.

### Sobrecarga mental na rodada 9+ (spec §7.6)

A diagramação da linha "9 ou mais" comporta mais de uma leitura. A mais provável é
`2d4`, mas não é inequívoca.

**Default:** `2d4`, com a tabela inteira editável por cena.

## Regras não definidas

### Examinar revela uma ou várias informações? (spec §6.3.1)

O texto diz "recebe essa informação", no singular, sem dizer qual quando várias DTs
ficam abaixo do total.

**Default adotado:** todas as informações da perícia com DT ≤ soma rolada — a mesma
leitura da coluna DT que o Investigar faz com o tamanho do dado. O custo de 1 PD não
muda: só é cobrado quando nada novo é revelado.

### Crítico no Examinar (spec §4.3 + §6.3.1)

O crítico "passa automaticamente, ignorando a DT" e em investigação "concede
informação adicional", sem definir o que isso significa em um quadro com várias DTs.

**Default adotado:** o crítico ignora a DT e revela todas as informações que faltam
daquela perícia naquele POI. É a leitura mais direta de "informação adicional".

### Escopo do aumento de passo da Ajuda (spec §4.7)

O texto diz que a ajuda concede "um aumento de passo", sem dizer em qual dado.

**Default:** o dado da **perícia** — é a leitura mais natural, já que a ajuda é
justificada pela perícia do ajudante. Setting `ajudaAlvo`.

### Crítico e dados descartados (spec §4.5)

Rolam-se até 4 dados, somam-se 3. O texto não diz se os descartados alimentam a detecção
de crítico e a leitura de RA/RB.

**Default adotado:** o crítico varre **todos os dados rolados**; RA e RB olham **só os
contabilizados**. Racional: o crítico é um evento da rolagem inteira, enquanto RA/RB são
leituras do resultado. Setting `escopoCritico` controla o lado do crítico.

### Consequência da falha no teste de trauma (spec §8.3)

O texto diz morte, mas avisa que na versão final não será tão fácil morrer por perda de
PD — virão traumas persistentes.

**Default:** `morte`, conforme o playtest. Setting `falhaTrauma`.

### Cura e recuperação (spec §11)

Não publicada. Inclui quando zerar `testesFerimento` e `testesTrauma`.

**Decisão:** os contadores são editáveis na ficha e não zeram sozinhos. Sem automação
até a regra sair.

### PV e PD (spec §11)

Sem fórmula publicada — vêm prontos nas fichas dos personagens do playtest.

**Decisão:** campos livres, sem cálculo derivado.

### Progressão por nível e NEX (spec §11)

Não publicadas. Os campos existem na ficha; nenhuma mecânica os consome.

### Lista de habilidades (spec §2.1, §11)

O playtest cita que o personagem começa com duas habilidades — uma do perfil, outra da
ocupação — e que ganha mais por nível ou treino. Mas **não publica a lista**: as
habilidades só aparecem preenchidas nas fichas dos personagens prontos, que são conteúdo
da aventura.

**Decisão:** o sistema não distribui compêndio de habilidades. O tipo de Item
`habilidade` é funcional e cobre o que o motor sabe aplicar (aumento de passo e dado
extra); o resto é texto livre. Quem tiver o material cria os itens na sua mesa, ou usa um
*adventure module* separado.

### Progressão por nível não publicada (spec §11)

Quantas habilidades por nível, e quais, não está no playtest. O campo `nivel` existe e
não dispara nada.

### Hackear dispositivos: curva, timer e banco de perguntas (spec §7.3)

A spec é explícita que os dois hacks (técnico e social) "exigem input humano" e pede
"ferramenta de GM (timer + banco de perguntas), não automação" — mas não define a
curva do problema matemático nem o formato do timer nem onde mora o banco de perguntas.

**Decisão — automatizado:** só o teste em si (Tecnologia/Intuição vs `dtObjeto`, mesmo
padrão de Arrombar) e o gate "falha só libera nova tentativa na rodada seguinte" (regra
explícita, spec §7.3). O resto é manual, no espírito do que a spec pede:

- **Hack técnico:** sem curva automática — o card mostra o resultado do teste (quanto
  maior, mais fácil deveria ser o problema que o mestre escolhe) e um timer visual de
  10s que o mestre inicia na ficha do desafio, cliente-only, sem persistência.
- **Hack social:** "chances de erro" segue literal a fórmula publicada — 1 base + 1 a
  cada 3 pontos de excedente sobre a DT (o texto não diz a base; 1 é o mínimo que faz
  "ganha uma chance adicional" fazer sentido gramatical). O banco de perguntas
  (pergunta + resposta) mora no próprio `desafio-acesso`, editável na ficha — mesmo
  padrão de `informacoes` do POI e `conjuntos` do Rádio. Contar acertos/erros contra
  `respostasNecessarias` é manual (botão "marcar resolvido"), porque comparar a
  resposta *falada* do jogador com o gabarito é julgamento de mesa, não string match.
- **Bloqueio/alarme na falha** ("depende do dispositivo", spec): fica como texto livre
  no card, decidido pela mesa — mesmo tratamento que Sustentar já dá pro "o que
  acontece ao soltar".

### Alcançar seguro: o que acontece entre as duas ações? (spec §7.4)

O texto pede "duas ações em sequência", sem dizer o que pode interromper a segunda —
outro personagem agir no meio, o cenário mudar, etc.

**Decisão M1:** as duas ações resolvem em sequência imediata na mesma chamada
(`alcancar()`, `module/cena/acoes-desafio.mjs`); a segunda só roda se a primeira passar.
Sem gancho para intercalar outra coisa entre elas.

### Sustentar: o que é sustentado e o que acontece ao soltar? (spec §7.5)

O texto não modela o objeto sustentado nem a consequência de soltar — só a fadiga
cumulativa do teste.

**Decisão:** `estado.sustentando` guarda só `ativo` e `fadiga` no ator. O card de chat
avisa quando alguém solta; o que isso significa na cena é narrativo, decidido pela mesa.

### Resultado do uso de ferramenta não fica gravado no personagem (spec §9)

Investigar/Examinar gravam `infosReveladas` no ator porque a revelação é por
informação, reaproveitável entre cenas. Uma ferramenta não tem "informações"
discretas — só um texto de reação por POI.

**Decisão:** o resultado só vai para o chat (sussurro dono + mestre), igual
Interagir. Usar a mesma ferramenta duas vezes no mesmo POI manda o card de novo,
sem controle de repetição — nada na spec pede isso.

### EMF e Compêndio não têm mecânica automatizável (spec §9)

O Medidor EMF depende de o mestre mandar um áudio e o jogador comparar a mão com
formas de onda do Compêndio — é combinação humana, não regra. O Compêndio é só
documento de referência.

**Decisão:** as duas entram como `ferramenta` funcional (aparecem na lista, têm
ficha), mas sem handler de uso automatizado — o texto de `descricao` é onde o
conteúdo de referência vive; comparação de áudio fica com a mesa.

### Laser de Varredura também é slot reativo de POI, além da ação de cena (Fase 2 → 3)

O schema de `ponto-interesse` (Fase 2) já tratava `ferramentas.laser` como mais um
campo de texto igual câmera/infravermelho/etc. A spec (§9) descreve o Laser só
como ação de ambiente ("revela quais POIs reagem"), sem reação própria por POI.

**Decisão:** manteve-se os dois caminhos. `usarFerramenta(ator, poi, "laser")`
funciona como qualquer outra ferramenta (lê o texto daquele campo, se o mestre
preencheu); `usarLaser(ator)` é a ação de cena da spec. Não são contraditórios —
o segundo não substitui o primeiro, só soma.

### Tamanho do dado da senha de Destrancar não publicado (spec §7.1)

O texto fala em "N dados" sem dizer quantas faces. Mastermind clássico usa uma
faixa pequena e fixa de valores.

**Default:** d6 por posição (`facesSenha`, configurável por desafio no Item — o
mestre pode subir para d8/d10/d12 numa fechadura mais complexa).

### Teto de tentativas por rodada de Destrancar não implementado (spec §7.1)

A spec liga tentativas-por-rodada ao valor de Crime (d4=1 … d12=5). Isso exige
saber, por ator, quantas tentativas já gastou *nesta rodada específica* — um
contador a mais, cruzando ator × desafio × rodada, que o tracker de rodadas atual
não modela em lugar nenhum.

**Decisão M3:** só o teto global (`maxTentativas`/`quebrado`, o mesmo de Arrombar)
é aplicado. O teto por rodada fica de fora até haver necessidade real de jogo —
registrar aqui se algum playtest sentir falta.

### Modelo de conteúdo do Rádio Modificado não publicado (spec §9.2)

A spec descreve o resultado (teste de Tecnologia remove N conjuntos falsos, tabela
de faixas) mas não como o mestre cadastra os "conjuntos de palavras" nem como o
sistema sabe qual é a ordem certa de cada um.

**Decisão:** cada conjunto guarda `verdadeiro` (bool) e `frase` (string — as palavras
corretas, em ordem, separadas por espaço). O app embaralha as palavras de cada
conjunto que sobrar depois do teste e o jogador reordena; comparar a resposta é só
comparar contra `frase.split(/\s+/)` de novo — não precisa de estrutura mais rica.

**Quais falsos saem no teste:** a spec não diz *quais* dentre os falsos são
removidos quando o total não cobre todos. Sem critério narrativo para escolher um em
vez de outro, a decisão foi remover sempre os primeiros falsos na ordem em que o
mestre cadastrou — determinístico e testável, sem overhead de mesa.

**Fora de escopo:** a spec não descreve o sistema "julgando" se o jogador identificou
os falsos restantes (os que o teste não removeu) — isso é interpretação de mesa, como
o resto do jogo. O app só cuida da parte objetiva: quantos somem e se a ordem das
palavras dos que sobraram bate com a frase certa.

## Como adicionar uma lacuna nova

1. Documente aqui: o que a fonte diz, onde é ambígua, e o default escolhido com o motivo.
2. Registre o setting em `module/settings/register.mjs`.
3. Traduza `OP2.Config.<chave>.name` e `.hint` nos dois arquivos de idioma.
4. Cite a seção da spec no comentário do código que lê o setting.


## Nome do Item de desafio (decisão de projeto)

A spec chama a §7 de "Desafios de acesso", mas a seção mistura Destrancar/Arrombar/
Hackear com Alcançar, Sustentar e a sobrecarga mental — não é só acesso. Com a abordagem
genérica, o mesmo Item cobre uma tábua pregada (Atletismo) ou um portão enferrujado
(Máquinas).

**Decisão:** o rótulo é **Desafio** em toda a interface. O id do tipo de documento segue
`desafio-acesso`: renomear tipo migra mundo, e um mundo já em uso não vale o risco por
um nome. Se algum dia houver migração de schema por outro motivo, o rename pega carona.

## Empate em teste oposto (spec §4.6)

O texto diz "maior resultado vence" e não trata empate. **Decisão:** empate não move
nada — ninguém vence, ninguém causa dano. Preserva o status quo, que é o que a mesa
narra naturalmente.

## "Empunhando arma" (spec §8.1)

O dano é RA com arma e RB desarmado, mas o playtest não define o que conta como
empunhar, e o inventário não tem estado de "na mão". **Decisão:** o sistema pergunta na
hora do ataque, em vez de deduzir do inventário.

## Zerar os contadores de ferimento e trauma (spec §8.2)

O playtest não define cura nem descanso. **Decisão:** `game.op2.zerarContadoresDeQueda(ator)`
existe como ferramenta de mestre, e nada os zera sozinho — nem encerrar a cena, que só
limpa reduções temporárias e revelações.

## Barra de Ímpeto

Não está na spec: veio das fichas prontas do Ato I, onde é habilidade de perfil do
Executor (Alan e Edgar têm; Eloísa, Kênia e Victor não). **Decisão:** o campo é
`impeto.espacos`, com 0 como padrão — quem tem a barra é quem a declara na ficha, sem
o sistema amarrar a mecânica ao perfil. Preencher na falha é botão no card, não
automático, pela mesma regra de sempre: a mesa às vezes reinterpreta o que foi falha.

## Redistribuição dos arquivos do Ato I

Os arquivos públicos do Ato I (handouts, mapas, tokens, músicas) são material da
editora, liberado de graça para o playtest. **Decisão:** não vão no repositório nem no
pacote do sistema — mesma política do PDF. Os compêndios trazem só os dados e apontam
para `systems/ordem-paranormal-2e/assets/ato-i/` no User Data; `npm run ato-i` copia os arquivos para lá na máquina de
quem já os tem.


## Quais habilidades são de perfil e quais de ocupação

A spec diz que perfil concede uma habilidade e ocupação concede outra (§2.1), mas não
publica o mapa. As fichas do Ato I resolvem por repetição: os dois Executores dividem
**Ímpeto**, as duas Analistas dividem **Avaliação** — essas são de perfil, e a habilidade
restante de cada um é da ocupação (Cientista → Foco Mental, Operário → Esforço e Suor,
Artista → Foco Emocional, Profissional de escritório → Conhecimento Técnico).

Victor é o único Vigilante, então não há repetição que decida entre **Prontidão** e
**Mentoria**. **Decisão:** Prontidão é do perfil (agir antes de todos combina com
vigilância) e Mentoria é do Professor (ensinar é fazer o outro acertar). Se o playtest
publicar outra coisa, é trocar `origem` nas duas habilidades do compêndio.

## Ocupação como Item

O texto trata ocupação como campo livre. **Decisão:** o campo da ficha continua texto, e
o Item `ocupacao` é um atalho de catálogo — guarda a ocupação com a habilidade dela e,
arrastado para um personagem, preenche o campo e traz a habilidade. Não vira item de
inventário: ninguém carrega a própria profissão.


## Grade da cena do Porão

Os mapas do Ato I não vêm com a grade declarada. O duto de ventilação mede ~92px de
largura no arquivo, o que o coloca em uma casa; as portas ficam na mesma ordem de
grandeza. **Decisão:** grade de 100px, distância 1,5 m. Se a sua leitura da arte for
outra, o alinhamento se ajusta na configuração da cena sem mexer nas paredes.

## Paredes do Porão

`gerar-cena.py` deriva paredes da diferença entre os três arquivos publicados: sai exato
no perímetro e na fronteira entre porão, sala secreta e duto, e não enxerga as divisórias
*internas* — os dois lados delas são a mesma área em todos os arquivos.

**Decisão:** a cena do compêndio é a que foi murada à mão dentro do Foundry (39 paredes,
6 portas secretas) e trazida por `npm run ato-i:cena`. O gerador fica como ponto de
partida para outros mapas, e se recusa a sobrescrever a cena existente sem `--forcar`.

## Fundo de cena em compêndio (v14)

No v14 o mapa de fundo é um documento de **nível** (`!scenes.levels!…`), não um campo da
cena. Compêndio não carrega esses registros: testado com id próprio e com
`defaultLevel0000`, o Foundry ignora e sintetiza um nível padrão — a cena importa em
branco. **Decisão:** a fonte do compêndio guarda o campo legado `background` no registro
da cena, que o v14 migra para o nível ao carregar. É o único caminho que funciona hoje.

## Caixas do Ato I: o que virou dado e o que é decisão

Todas as caixas de acesso do porão têm campo no `desafio-acesso`:

- **Painel Elétrico e Computador (Hack Técnico)** — `hackTecnico.tabela` guarda a tabela
  do livro. O total do teste escolhe a faixa; a faixa diz qual conta o painel devolve
  (o painel) ou quantos segundos o jogador tem para resolver a conta impressa (o
  computador). Com tabela, o teste não resolve o desafio sozinho: quem confere a
  resposta é o mestre, pelo botão do card.
- **Celular de Gustavo (Hack Social)** — as seis perguntas e respostas do livro entram
  em `hackSocial.perguntas`, com `respostasNecessarias: 4`.
- **Estante de Livros** — abordagem `sustentar`, com a DT do obstáculo e o texto do que
  acontece a quem falhar. O enigma dos livros continua sendo mesa: o sistema não modela
  "puxar os livros certos".
- **Porta de Saída** — **decisão, não lacuna**: a senha é impressa no livro (160322).
  Não é o minigame de Destrancar, que sorteia; vira informação na descrição de mestre do
  ponto, e o desafio não existe.

- **A Dívida Precisa Ser Paga** — a investigação ganhou `eventos` (rodada, narração,
  efeito). `avancarRodada()` põe a narração no card da rodada que começa e o efeito só
  para o mestre; o painel lista o roteiro com a próxima rodada em destaque. O que não
  cabe em campo (ativação, "A Dívida Foi Paga", "Ídolo Quebrado") vira o diário de
  mestre "A Maldição do Ídolo de Pedra".
- **Linhas condicionais** ("apenas Victor", "se o ídolo for quebrado") entram como
  rascunho: Examinar não as alcança, o mestre libera quando a condição acontece. "ou
  Tecnologia" é perícia alternativa e segue descobrível — o sistema testa uma perícia
  por linha, a alternativa fica no texto.

O que segue fora: o Ato II (outro capítulo do playtest, com os próprios pontos e as
reações de ferramenta) não é gerado — o compêndio cobre o Ato I.
