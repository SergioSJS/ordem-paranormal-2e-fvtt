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

### Curva do problema matemático no hack técnico (spec §7.3)

O texto só dá a direção: quanto maior o resultado, mais fácil o problema.

**Decisão:** fica como ferramenta de mestre (timer + banco de perguntas) na fase 3, sem
curva automática.

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
