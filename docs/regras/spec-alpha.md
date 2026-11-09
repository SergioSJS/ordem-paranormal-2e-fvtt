# Ordem Paranormal RPG 2 — Playtest Alpha
## Especificação técnica para implementação em Foundry VTT

> **Escopo deste documento.** Camada mecânica/funcional do playtest (regras, escalas, fórmulas, estruturas de dados). Não inclui a aventura *A Maldição do Ídolo de Pedra* (Atos I e II), textos de leitura, handouts, mapas, NPCs ou histórico dos personagens prontos — isso deve ser montado por você como *adventure module* / compendium separado, a partir do PDF original.
>
> **Fonte:** Playtest Alpha, Pacote #8, agosto/2026, v1.0. O documento se autodeclara parcial: combate completo, NEX, itens, progressão e traumas permanentes ficam para playtests futuros. Projete o system com pontos de extensão para isso.

---

## 1. Identidade do sistema — o que o Foundry precisa refletir

| Característica | Implicação técnica |
|---|---|
| Dados são *step dice* (d4→d12), não modificadores numéricos | Atributos e perícias são **tamanho de dado**, não `Number`. Todo o resto (bônus, ajuda, itens) opera como *step up/down*, não como `+N`. |
| Filosofia "WYSIWYG": resultado ≈ soma bruta dos dados | Praticamente nenhum modificador aditivo. Fórmula base é limpa. |
| Escala contida (DT padrão 7) | Não replicar a matemática de OP1/Tormenta20. |
| Assimetria de perfis | Habilidades de perfil/ocupação são *Items* com efeitos distintos, não bônus genéricos. |
| Investigação é pilar central, não coadjuvante | Precisa de UI própria: Pontos de Interesse, ações de investigação, contador de rodadas, sobrecarga mental. |
| Dois eixos de progressão: **Nível** (mundano) e **NEX** (paranormal), independentes | Modelar ambos os campos já agora; NEX fora do escopo do playtest mas previsto. |

---

## 2. Modelo de dados do Actor (personagem)

### 2.1 Campos da ficha

1. **Nome**
2. **Perfil** — enum: `executor` | `analista` | `vigilante`. Concede 1 habilidade.
3. **Ocupação** — texto livre. Concede 1 habilidade.
4. **Nível** — inteiro 1–10.
5. **Atributos** — 3, em step die.
6. **Perícias** — 20, em step die, cada uma com atributo-base.
7. **PV** e **PD** — recursos value/max.
8. **Habilidades** — Items. Personagem inicia com 2 (perfil + ocupação); ganha mais por nível ou treino.

> A ficha do playtest é explicitamente reduzida. A ficha definitiva virá depois. **Recomendação:** modele `template.json` com os campos acima e deixe seções colapsáveis/ocultas por flag para o que vier depois (NEX, inventário completo, traumas, defesas de combate).

### 2.2 Atributos

| Chave | Nome | Cobre |
|---|---|---|
| `fisico` | Físico | força, coordenação, velocidade, fôlego |
| `mente` | Mente | raciocínio, educação, percepção |
| `emocao` | Emoção | vontade, magnetismo social, instinto |

Escala descritiva (útil para tooltip/i18n):

| Dado | Descritor |
|---|---|
| d4 | Abaixo da média |
| d6 | Média humana |
| d8 | Acima da média |
| d10 | Muito acima da média |
| d12 | Ápice humano |
| d20 | Sobre-humano — **só via paranormal**, fora do escopo do playtest |

### 2.3 Perícias (20)

Escala: d4 destreinado · d6 treinado · d8 especialista · d10 mestre · d12 grão-mestre.

| Chave | Nome | Atributo-base |
|---|---|---|
| `acrobacia` | Acrobacia | Físico |
| `aptidao` | Aptidão (especializada) | Mente |
| `atletismo` | Atletismo | Físico |
| `crime` | Crime | Físico |
| `disciplina` | Disciplina | Emoção |
| `enganacao` | Enganação | Emoção |
| `furtividade` | Furtividade | Físico |
| `intimidar` | Intimidar | Emoção |
| `intuicao` | Intuição | Emoção |
| `luta` | Luta | Físico |
| `maquinas` | Máquinas | Mente |
| `medicina` | Medicina | Mente |
| `ocultismo` | Ocultismo | Mente |
| `percepcao` | Percepção | Mente |
| `persuasao` | Persuasão | Emoção |
| `pesquisar` | Pesquisar | Mente |
| `pontaria` | Pontaria | Físico |
| `sobrevivencia` | Sobrevivência | Mente |
| `tecnologia` | Tecnologia | Mente |
| `vigor` | Vigor | Físico |

**Aptidão é especial:** funciona como grupo de subperícias independentes, cada uma com seu próprio dado.

```
aptidao: {
  artes:       { die: "d4" },   // música, dança, escrita, pintura, atuação
  atualidades: { die: "d4" },   // esporte, entretenimento, cultura pop
  burocracia:  { die: "d4" },   // direito, política, economia, contabilidade, estruturas gov./corp.
  exatas:      { die: "d4" },   // matemática, física, química, biologia, astronomia, geologia
  humanas:     { die: "d4" },   // história, geografia, filosofia, sociologia, teologia, linguística
  tatica:      { die: "d4" }    // educação militar e estratégica
}
```

> **Extensível:** o texto usa "conhecimento em um campo específico", sugerindo que a lista pode crescer. Modele Aptidão como coleção dinâmica de chaves, não como 6 campos fixos.

**Atributo-base é sugestão, não trava.** O mestre pode determinar outro atributo para uma ação específica. O diálogo de rolagem **precisa** permitir trocar o atributo pareado com a perícia.

### 2.4 Esboço de `template.json`

```json
{
  "Actor": {
    "types": ["personagem", "npc"],
    "templates": {
      "base": {
        "perfil": "executor",
        "ocupacao": "",
        "nivel": 1,
        "nex": 0,
        "atributos": {
          "fisico": { "die": "d6" },
          "mente":  { "die": "d6" },
          "emocao": { "die": "d6" }
        },
        "recursos": {
          "pv": { "value": 10, "max": 10 },
          "pd": { "value": 10, "max": 10 }
        },
        "estado": {
          "testesFerimento": 0,
          "testesTrauma": 0,
          "reducoesTemporarias": { "fisico": 0, "mente": 0, "emocao": 0 }
        },
        "pericias": {
          "acrobacia": { "die": "d4", "atributo": "fisico" }
        },
        "aptidoes": {}
      }
    }
  }
}
```

`reducoesTemporarias` existe porque falhas críticas reduzem atributos "até o fim da cena" — precisa ser um contador zerável por evento de fim de cena, não um Active Effect com duração em rodadas.

---

## 3. Primitiva central: a escada de dados

```
d4 < d6 < d8 < d10 < d12   [ < d20 apenas via efeito paranormal explícito ]
```

Regras:
- **Aumento de passo:** sobe um degrau.
- **Redução de passo:** desce um degrau.
- Piso: **d4**. Não reduz abaixo disso.
- Teto normal: **d12**. Não sobe acima disso.
- **Exceção:** efeitos raros e explicitamente paranormais podem levar d12 → d20. O efeito precisa declarar isso. Trate como flag `allowD20: true` no efeito, não como comportamento padrão.

Implementação sugerida:

```js
const LADDER = ["d4", "d6", "d8", "d10", "d12"];

function stepDie(die, steps, { allowD20 = false } = {}) {
  if (die === "d20") return allowD20 && steps < 0 ? "d12" : "d20";
  let i = LADDER.indexOf(die) + steps;
  if (i >= LADDER.length) return allowD20 ? "d20" : "d12";
  return LADDER[Math.max(0, Math.min(i, LADDER.length - 1))];
}

const dieFaces = (die) => parseInt(die.slice(1), 10); // "valor" da perícia p/ investigação
```

`dieFaces()` importa: em cenas de investigação, o **tamanho do dado** (4/6/8/10/12) é comparado diretamente contra DT, sem rolagem. Ver §6.

---

## 4. Motor de testes

### 4.1 Resolução básica

1. Mestre define **atributo + perícia + DT**.
2. Jogador rola **os dois dados simultaneamente** e **soma**.
3. Soma ≥ DT → sucesso. Soma < DT → falha.

**DT padrão do playtest: 7**, salvo indicação em contrário.

Fórmula base: `1@atributo + 1@pericia` (ex.: `1d8 + 1d6`).

### 4.2 Rolagem Alta (RA) e Rolagem Baixa (RB)

Muitas mecânicas consomem **o maior valor individual rolado (RA)** ou **o menor (RB)** — não a soma, e **não** o dado de maior tamanho. Um d8 que tirou 3 e um d6 que tirou 6 → RA = 6, RB = 3.

**Isso é crítico para a implementação.** O objeto de resultado do roll precisa expor no mínimo:

```js
{
  total,        // soma dos dados contabilizados
  dice: [...],  // todos os dados rolados, com faces e resultado
  ra,           // max(resultados contabilizados)
  rb,           // min(resultados contabilizados)
  success, critical, fumble
}
```

Exponha `ra` e `rb` no chat card — várias mecânicas (arrombar, combate, alcançar) leem esses valores diretamente.

### 4.3 Críticos

**Sucesso crítico:** dois ou mais dados com **valor idêntico**, e esse valor **≥ 6**.
- Passa automaticamente, ignorando a DT.
- Em cenas de investigação, concede **informação adicional**.

**Falha crítica:** **todos** os dados resultaram **1**.
- Falha automática, ignorando a DT.
- Sofre penalidade adicional: escolha do mestre ou rolagem de `1d8`.

Ordem de precedência: crítico/falha crítica sobrepõem a comparação com DT.

> Consequência do design: com 2 dados, sucesso crítico exige par de 6+ — ou seja, um d4 nunca contribui para crítico. Isso é intencional e favorece dados maiores. O detector de crítico deve varrer **todos os dados rolados** (incluindo dados extras de habilidades) buscando repetição de valor ≥ 6.

### 4.4 Tabela de efeitos de falha crítica (`1d8`)

| 1d8 | Efeito | Implementação |
|---|---|---|
| 1 | **Vexame** — o jogador narra a ação de forma vergonhosa | Sem efeito mecânico. Chat card narrativo. |
| 2 | **Machucado** — Físico −1 passo até o fim da cena | Incrementa `reducoesTemporarias.fisico` |
| 3 | **Desatenção** — Mente −1 passo até o fim da cena | Incrementa `reducoesTemporarias.mente` |
| 4 | **Irritação** — Emoção −1 passo até o fim da cena | Incrementa `reducoesTemporarias.emocao` |
| 5 | **Acidente** — perde `1d4` PV | Aplica dano físico |
| 6 | **Frustração** — perde `1d4` PD | Aplica dano emocional |
| 7 | **Perda** — perde um item carregado ou um espaço de compra | Prompt ao mestre; não automatizar |
| 8 | Nenhum efeito adicional | — |

Se o efeito não fizer sentido na situação, o mestre escolhe outro. **Nunca aplique automaticamente sem confirmação do GM.**

### 4.5 Modificando testes — dados extras

Habilidades e itens podem conceder **dados adicionais**. Limites rígidos:

- **Máximo 4 dados rolados** por teste.
- **Máximo 3 dados somados** para o resultado.

Isso exige uma etapa de **seleção manual** entre rolagem e resultado: rolam-se até 4, o jogador escolhe quais 3 contam. Implemente como diálogo pós-rolagem (estilo "keep highest, mas com escolha"), porque a escolha ótima nem sempre é a soma máxima — RA e RB também importam para efeitos subsequentes.

> **Decisão de implementação pendente:** o texto não esclarece se RA/RB e a detecção de crítico consideram todos os dados rolados ou apenas os contabilizados. Recomendo: **crítico avalia todos os dados rolados; RA/RB avaliam apenas os contabilizados.** Deixe isso como *setting* do system para ajuste após feedback.

### 4.6 Testes opostos

Ambos os lados rolam seu teste; maior resultado vence. Sem DT.

### 4.7 Ajuda

- Custa **uma ação**.
- Requer perícia coerente com a ajuda e valor **mínimo d6** (com d4 não é possível ajudar).
- Efeito no teste do aliado:
  - perícia do ajudante **d6 ou d8** → **+1 passo**
  - perícia do ajudante **d10 ou d12** → **+2 passos**

Aplica-se ao dado da perícia do alvo (interpretação mais natural; confirme na sua mesa).

---

## 5. Estrutura de jogo

### 5.1 Cenas

Unidade estrutural básica. Não é unidade de tempo. Começa quando os personagens chegam a um novo lugar ou surge nova situação; termina quando saem ou resolvem a situação. Início e fim são declarados pelo mestre.

**Precisa existir no system:** um conceito de "cena ativa" com botão de GM **Encerrar cena**, que zera `reducoesTemporarias`, libera Recapitular/Compartilhar e zera o contador de rodadas de investigação.

### 5.2 Rodadas

Padrão: fluxo livre. Quando o mestre quiser estrutura, o jogo passa a rodadas.

- Sem iniciativa rolada. **Os jogadores decidem a ordem entre si** — quem sabe o que quer fazer age primeiro.
- Desempate sugerido: começa pelo jogador à esquerda do mestre, sentido horário (ou ordem das câmeras, em jogo online).
- **NPCs agem por último.**
- Ao fim da última ação, nova rodada se a cena não terminou.
- Combate terá regra própria de ordem — **ainda não publicada**.

**Implicação:** não use o Combat Tracker padrão com rolagem de iniciativa. Use um tracker de rodadas customizado, com ordem manual/arrastável e um slot fixo de NPCs ao final. Isso também serve de gancho para a sobrecarga mental (§7.6).

### 5.3 Ações

- **1 ação importante** por rodada (investigar, atacar, fugir).
- **Ações menores** ilimitadas dentro do razoável (falar poucas palavras, soltar algo).
- **Ação livre** existe como categoria explícita (o teste de Compartilhar é ação livre).

---

## 6. Cenas de investigação — o coração do playtest

### 6.1 Fluxo

1. Mestre descreve o ambiente e **lista os pontos de interesse**.
2. Na rodada de cada personagem, ele usa uma ação de investigação.
3. Ciclo se repete até os jogadores pararem — por satisfação, por medo da sobrecarga mental, ou por interrupção externa.

### 6.2 Ponto de Interesse (POI) — estrutura de dados

Três seções:

| Seção | Visibilidade | Conteúdo |
|---|---|---|
| **Cabeçalho** | Narrado ao usar Investigar | Nome + descrição básica |
| **Quadro de informações** | Revelado por linha | Tabela `Perícia · DT · Informação` |
| **Descrição contextual** | **Somente GM** | Explicação completa; resolve interações livres |

POIs podem conter benefícios (itens, recursos) e prejuízos (ex.: cortar-se em cacos, `d4` de dano). POIs podem ser **vazios de propósito** — parte do desafio é os jogadores identificarem o que é relevante.

Modelo sugerido — POI como Item de tipo `ponto-interesse` (ou JournalEntryPage com dados estruturados):

```json
{
  "name": "Quadro na Parede",
  "type": "ponto-interesse",
  "system": {
    "descricaoBasica": "...",
    "descricaoContextual": "...",
    "informacoes": [
      { "id": "i1", "pericia": "aptidao.artes", "dt": 6, "texto": "...", "revelado": false },
      { "id": "i2", "pericia": "percepcao",     "dt": 6, "texto": "...", "revelado": false },
      { "id": "i3", "pericia": "percepcao",     "dt": 8, "texto": "...", "revelado": false }
    ],
    "ferramentas": {
      "camera": null, "laboratorio": null, "lanternaUV": null,
      "laser": false, "infravermelho": null, "emf": null,
      "poRevelador": null, "radio": null, "termometro": "normal"
    },
    "reveladoPorLaser": false
  }
}
```

`revelado` precisa ser **por personagem**, não global — o texto especifica "uma informação que você ainda não tinha recebido". Use `flags` por actor ou uma matriz `reveladoPor: [actorId]`.

### 6.3 Ação: INVESTIGAR

Ação importante. Passo a passo:

1. Escolhe um POI.
2. Mestre narra a descrição básica (primeira vez; depois é opcional) e **lista as perícias disponíveis no quadro**.
3. Jogador **escolhe uma perícia e declara seu valor** (tamanho do dado).
4. Mestre entrega **todas as informações daquela perícia cuja DT ≤ valor da perícia**. **Sem rolagem.**
5. Em seguida, o jogador pode **Examinar** ou **Interagir**. Isso encerra a ação.
6. Em rodadas seguintes pode reinvestigar o mesmo POI com outra perícia — ou a mesma, para tentar examinar de novo.

> **Ponto de atenção para a implementação.** Há duas comparações distintas contra a mesma coluna DT:
> - **Passo 4 (automático):** compara `dieFaces(pericia)` — 4, 6, 8, 10, 12 — contra a DT. Determinístico.
> - **Examinar (rolado):** compara `soma dos dados` contra a DT.
>
> São camadas diferentes e ambas usam a mesma coluna. Um personagem com Percepção d8 já recebe de graça toda info de Percepção com DT ≤ 8, e rola para tentar as de DT 9+.

#### 6.3.1 Sub-ação: EXAMINAR

- Faz o **teste da perícia escolhida**.
- Se o resultado ≥ DT de uma informação **ainda não recebida**, recebe essa informação.
- **Se não receber nenhuma informação nova — por não atingir a DT ou por não haver mais nada — perde 1 PD.**

Essa penalidade é o coração econômico da investigação: examinar é uma aposta. O system deve deixar isso explícito na UI antes da confirmação.

#### 6.3.2 Sub-ação: INTERAGIR

- Jogador descreve uma ação simples com o POI (tirar o quadro da parede, abrir a gaveta).
- Mestre resolve pela **descrição contextual**.
- Sem teste, sem custo de PD.

Não automatize. Forneça um botão que abra a descrição contextual só para o GM.

### 6.4 Ação: RECAPITULAR

- Ação importante.
- Jogador deve **interpretar** a recapitulação de tudo que o grupo já descobriu.
- Se o mestre julgar coerente: teste de **Intuição, DT 10**.
- Sucesso → nova pista a critério do mestre.
- **Após um personagem ter sucesso, a ação fica bloqueada para o restante da cena** (para todos).

### 6.5 Ação: COMPARTILHAR

- Ação importante do compartilhador.
- Deve **interpretar** a explicação de uma pista descoberta *nesta cena* para um aliado.
- O aliado faz um teste de **Pesquisar, DT 10**, como **ação livre**.
- Sucesso → o aliado deduz uma nova pista a critério do mestre.
- **Bloqueia para o restante da cena após um sucesso.**

> ⚠️ **Inconsistência no documento fonte.** O corpo do texto diz **Pesquisar (DT 10)**; a tabela-resumo de ações de investigação diz **Intuição**. Recomendo implementar **Pesquisar** (texto normativo prevalece sobre resumo) e expor como *setting* configurável. Vale reportar no formulário de feedback do playtest.

### 6.6 Ação: USAR HABILIDADES E ITENS

Habilidades e itens podem ter efeitos em investigação, descritos neles. Jogadores podem propor usos criativos. **O mestre decide** se cabe e qual o efeito — o padrão sugerido é **um aumento de passo no teste em questão**.

### 6.7 Tabela-resumo

| Ação | Tipo | Teste | Custo/risco |
|---|---|---|---|
| Investigar | Importante | Nenhum (comparação por valor de perícia) | — |
| └ Examinar | Sub-ação | Perícia escolhida vs DT | **−1 PD se não obtiver info nova** |
| └ Interagir | Sub-ação | Nenhum | — |
| Recapitular | Importante | Intuição DT 10 | 1× por cena (grupo) |
| Compartilhar | Importante | Aliado: Pesquisar DT 10 (ação livre) | 1× por cena (grupo) |
| Usar habilidade/item | Importante | Variável | Conforme o item |

---

## 7. Desafios de acesso

Obstáculos que bloqueiam pistas. Vários deles são **minigames de mesa**, não rolagens — decida caso a caso se vale automatizar ou apenas fornecer ferramental de GM.

### 7.1 Destrancar (fechadura, técnica)

Minigame tipo *Mastermind*:

1. Mestre rola **N dados** (N varia com a complexidade da tranca) e **mantém ocultos**. A sequência, na ordem rolada, é a "senha".
2. Jogador pega N dados e **posiciona as faces manualmente** — sem rolar. É o palpite.
3. Mestre responde, posição por posição: **alto**, **baixo** ou **exato**.

**Tentativas por rodada, pelo valor de Crime:**

| Crime | Tentativas/rodada |
|---|---|
| d4 | 1 |
| d6 | 2 |
| d8 | 3 |
| d10 | 4 |
| d12 | 5 |

- A fechadura tem um **número máximo de tentativas** (definido pela missão / resistência).
- Excedido o máximo, a fechadura **quebra**: só resta arrombar na força bruta ou achar a chave.

*Variante de imersão:* substituir "baixo/alto/exato" por sons ("tic/toc/click"), forçando o jogador a deduzir qual som significa o quê.

**Implementação recomendada:** aplicativo dedicado (Dialog/ApplicationV2) com senha oculta em flag do GM, grade de dados clicáveis para o palpite, feedback automático alto/baixo/exato, contador de tentativas por rodada e contador global. Vale a pena — é a mecânica mais "cara" de rodar manualmente online.

### 7.2 Arrombar (fechadura, força bruta)

- Custo: **1 PV** por tentativa.
- Teste de **Atletismo** vs DT do objeto.
- Sucesso → acumula pontuação igual à **RA**.
- Precisa atingir uma **Pontuação Alvo (PA)** definida pelo objeto.
- Consequências possíveis: barulho (atrai atenção), dano ao conteúdo.

Precisa de tracker de pontuação acumulada por obstáculo.

### 7.3 Hackear dispositivos

Falha permite nova tentativa na rodada seguinte, mas **falhar pode bloquear o dispositivo, disparar alarme ou armadilha** — depende do dispositivo.

**Hack técnico:**
- Teste de **Tecnologia**.
- Jogador então resolve um **problema matemático em 10 segundos**.
- **Quanto maior o resultado do teste, mais fácil o problema.** (A curva exata não está tabelada no playtest — defina a sua e documente.)

**Hack social:**
- Teste de **Intuição**.
- Sucesso → o jogador responde perguntas sobre quem criou a senha (nome completo, o que a pessoa mais preza, ano de nascimento, nome de mãe/filho/cachorro/pessoa querida, etc.).
- Número de respostas corretas necessárias varia por missão.
- **A cada 3 pontos de excedente sobre a DT, ganha 1 chance adicional de errar.**

Ambos exigem input humano. Implemente como ferramenta de GM (timer + banco de perguntas), não como automação.

### 7.4 Alcançar

**Jeito seguro:**
- **Duas ações em sequência.**
- Teste de **Acrobacia** (DT do ambiente) em cada uma.
- Passar nos dois → alcança ao fim da segunda ação.
- Falhar em qualquer um → sofre dano igual à **RB** e recomeça do zero.

**Jeito arriscado:**
- **Uma ação.**
- Teste de **Acrobacia** contra **DT do ambiente + 3**.
- Sucesso → alcança.
- Falha → sofre dano igual à **RA**.

Note a inversão elegante: o caminho seguro machuca menos ao falhar (RB), o arriscado machuca mais (RA).

### 7.5 Sustentar

Erguer/empurrar algo pesado enquanto outro personagem age.

- Custo inicial: **1 PV** + teste de **Atletismo**.
- **Ao fim de cada rodada**, novo teste de Atletismo para continuar sustentando.
- Cada rodada aplica **redução de passo cumulativa** ao teste (fadiga).

Requer contador de rodadas de sustentação por actor, com penalidade progressiva.

### 7.6 Sobrecarga mental

Regra de atrito das cenas de investigação. **Ao fim de cada rodada**, todos os personagens sofrem dano emocional (PD) conforme a rodada. A progressão **varia por ambiente** — deve ser configurável por cena.

Progressão de referência (a do porão do Ato I/II):

| Rodada | Dano emocional |
|---|---|
| 1 | 0 |
| 2 | 0 |
| 3 | 1 |
| 4 | 1 |
| 5 | 1d4 |
| 6 | 1d4 |
| 7 | 1d6 |
| 8 | 1d6 |
| 9+ | 2d4 |

- Quando o dano for rolagem, **cada jogador rola o seu próprio**.
- Esta é a pressão que faz os jogadores decidirem quando parar de investigar.

> **Ambiguidade na fonte:** a linha "9 ou mais" está diagramada de forma que a leitura mais provável é **2d4**, mas não é inequívoca. Torne a tabela editável por cena e trate esse valor como default configurável.

**Implementação:** hook no avanço de rodada do tracker customizado. Aplique automaticamente a todos os actors com token na cena, com chat card por personagem. Botão de GM para pausar/desativar (nem toda cena de investigação usa sobrecarga).

---

## 8. Combate e ferimentos (versões simplificadas do playtest)

> ⚠️ Estas regras estão explicitamente marcadas como **simplificadas e temporárias**. O combate completo (incluindo ordem de ações própria) e ferimentos/traumas permanentes virão em playtests futuros. Isole esse módulo — ele vai ser substituído.

### 8.1 Combate corpo a corpo

- Ambos fazem **teste oposto de Luta**.
- Vencedor causa dano igual a:
  - **RA** se estiver empunhando arma
  - **RB** se estiver desarmado

**Esquiva:** o atacado pode optar por só se defender. Faz **Acrobacia** oposta ao teste de Luta do agressor, com **+d6** no seu teste. Se vencer, **não sofre nem causa dano**.

> Note: o "+d6" da esquiva é um dado adicional somado, não um step up — é a única exceção aditiva relevante do playtest.

**Múltiplos agressores:** um personagem só pode lutar (ou esquivar de) **um** oponente. Os demais fazem teste de **Luta contra DT 7**; se passarem, acertam.

### 8.2 Ferimentos (PV)

Ao ser reduzido a **0 PV**, ou sofrer dano já estando em 0 PV:

- Teste de **Vigor** vs **DT 7, +3 por teste de ferimento já realizado**.
- Sucesso → continua agindo.
- Falha → **morre**.

Progressão de DT: 7 → 10 → 13 → 16 → …

Requer contador persistente `estado.testesFerimento` por actor, zerado por cura/descanso (regra não definida no playtest — decida e documente).

### 8.3 Traumas (PD)

Ao ser reduzido a **0 PD**, ou sofrer dano emocional já estando em 0 PD:

- Teste de **Disciplina** vs **DT 7, +3 por teste de trauma já realizado**.
- Sucesso → continua agindo.
- Falha → **colapso mental e morte**.

Mesma mecânica de escalada, contador separado (`estado.testesTrauma`).

> O texto avisa que no jogo completo **não será tão fácil morrer por perda de PD** — a versão final trará traumas persistentes em vez de morte. Deixe a consequência da falha como configuração do system.

---

## 9. Ferramentas da Ordo Realitas

Disponíveis apenas para personagens **agentes** (não para "sobreviventes"). Cada ferramenta é um **minigame distinto** — essa é a expressão mais clara da "assimetria" do design. Modele cada uma como Item de tipo `ferramenta` com `subtype` que define o handler de uso.

| Ferramenta | Recurso | Mecânica |
|---|---|---|
| **Compêndio da Ordem** | — | Documento de referência. Um personagem o carrega; ele e quem ele permitir (no mesmo ambiente) podem consultar a qualquer momento. Base de comparação para identificar manifestações. |
| **Câmera Modificada** | Ilimitada | Mira num POI. Se houve evento paranormal imagético, o GM envia um handout (vislumbre do passado). |
| **Lanterna de Estouro UV** | **3 cargas** | Revela vestígios invisíveis à luz comum; alguns elementos paranormais reagem. Efeito definido por POI. **Uso como lanterna comum não consome carga.** |
| **Laboratório Portátil** | Ilimitada | Minigame de escada crescente — ver §9.1. |
| **Laser de Varredura** | Ilimitada | Ativado no ambiente (não em POI). Revela **quais POIs do ambiente reagem** às demais ferramentas. Ferramenta de economia de recursos. |
| **Leitor Infravermelho** | Ilimitada | Lê gradientes térmicos paranormais. Efeito por POI, exige interpretação. |
| **Medidor EMF** | Ilimitada | GM envia áudio de bipes; o jogador compara o padrão com as formas de onda do Compêndio para identificar a frequência. |
| **Pó Revelador** | **5 usos** | Aplicado em superfícies; reage em cores/formas por elemento. Efeito por POI. |
| **Rádio Modificado** | Ilimitada | Minigame de ordenação de palavras — ver §9.2. |
| **Termômetro Diferencial** | Ilimitada | Uso ilimitado. Retorna apenas: **mais quente / mais frio / igual** ao ambiente. |

### 9.1 Laboratório Portátil — escada crescente

Minigame de pressão com dados:

1. O POI define **quantos dados** rolar (4 a 6).
2. Rola-se **um dado por vez**, começando em **d4**, **subindo um passo a cada rolagem**.
3. O teto é o valor da perícia **Aptidão (Exatas)** do personagem — depois de atingido, repete-se esse dado.
4. **Para ter sucesso, cada rolagem deve ser ≥ à anterior.**
5. O jogador pode **rerrolar um número de dados igual à metade do valor do atributo Mente**.

Exemplo: Mente d6, Aptidão (Exatas) d10, POI exige 6 dados → sequência `d4, d6, d8, d10, d10, d10`, com direito a 3 rerrolagens quaisquer.

```js
function sequenciaLaboratorio(qtdDados, aptidaoExatas) {
  const teto = LADDER.indexOf(aptidaoExatas);
  return Array.from({ length: qtdDados },
    (_, i) => LADDER[Math.min(i, teto)]);
}
const rerrolagens = dieFaces(atributos.mente.die) / 2;
```

> Rerrolagem: "metade do atributo Mente" = metade das faces (d6 → 3). O texto não define arredondamento para d5-equivalentes; todos os tamanhos são pares, então não há problema prático.

Vale um app dedicado: rolagem sequencial revelada uma a uma, com estado de "quebrou a sequência" e botões de rerrolagem.

### 9.2 Rádio Modificado — ordenação de frases

Jogo de palavras: o GM entrega vários **conjuntos de palavras**; o jogador precisa ordená-los para formar frases. Nem todos os conjuntos são verdadeiros — alguns são falsos.

Ao usar em um POI apropriado, teste de **Tecnologia**. O resultado remove conjuntos falsos:

| Resultado | Conjuntos falsos removidos |
|---|---|
| ≤ 6 | Nenhum |
| 7–9 | 2 |
| 10–12 | 3 |
| ≥ 13 | Todos |

### 9.3 Setor de ferramentas nos POIs

Em cenários de agentes, **todo POI ganha um setor de ferramentas**. Regra de mesa importante para a UI:

> Mesmo que um POI tenha apenas leituras normais, **só revele isso depois que investigarem**. Uma leitura normal também é informação — e parte do desafio é descobrir o que é relevante.

Ou seja: o card de POI não deve exibir de antemão quais ferramentas têm reação. Modele `ferramentas.<chave>` com `null` = leitura normal/sem reação, e revele por interação.

---

## 10. Arquitetura sugerida para o system

### 10.1 Tipos de documento

| Documento | Tipo | Uso |
|---|---|---|
| Actor | `personagem` | Sobreviventes e agentes |
| Actor | `npc` | Ficha reduzida |
| Item | `habilidade` | Habilidades de perfil, ocupação, nível |
| Item | `ferramenta` | Ferramentas da Ordo Realitas (com `subtype` handler) |
| Item | `equipamento` | Itens genéricos |
| Item | `ponto-interesse` | POIs — ou JournalEntryPage customizada |
| Item | `desafio-acesso` | Fechaduras, dispositivos, obstáculos com estado |

> **Alternativa para POI:** usar `JournalEntryPage` com sheet customizada casa melhor com o fluxo de preparação de aventura do GM e com o *adventure module*. Usar Item facilita anexar ao token/cena e rastrear estado por personagem. Recomendo **JournalEntryPage** para o conteúdo e **flags na Scene** para o estado de revelação.

### 10.2 Peças a construir

1. **`StepDie` helper** — escada, `stepDie()`, `dieFaces()`. Base de tudo.
2. **`OP2Roll extends Roll`** — expõe `ra`, `rb`, `success`, `critical`, `fumble`; suporta N dados com seleção dos 3 contabilizados.
3. **Diálogo de teste** — escolhe perícia, permite **trocar o atributo pareado**, aplica passos (ajuda/itens/efeitos), mostra a fórmula final antes de rolar.
4. **Chat card de teste** — destaca soma, DT, RA, RB, crítico/falha crítica; botões contextuais (aplicar efeito de falha crítica, aplicar dano = RA/RB).
5. **Tracker de rodadas customizado** — sem iniciativa, ordem manual, NPCs por último, hook de fim de rodada.
6. **Módulo de sobrecarga mental** — tabela editável por cena, aplicação automática no fim da rodada.
7. **Painel de investigação** — lista de POIs da cena, ações (Investigar/Examinar/Interagir/Recapitular/Compartilhar), revelação progressiva por personagem, travas de "1× por cena".
8. **App de Destrancar** — Mastermind com senha oculta.
9. **Apps de ferramentas** — pelo menos Laboratório Portátil e Rádio Modificado.
10. **Botão "Encerrar cena"** — zera reduções temporárias, destrava Recapitular/Compartilhar, zera contador de rodadas.

### 10.3 Active Effects — cuidado

O padrão do Foundry é aditivo. Aqui quase tudo é **step**. Recomendação: implemente os efeitos como `custom` mode operando sobre o índice da escada, ou mantenha um pipeline próprio em `prepareDerivedData()` que soma `steps` e resolve o dado final. Não tente mapear "aumento de passo" para `ADD`.

```js
// prepareDerivedData
for (const [k, p] of Object.entries(this.system.pericias)) {
  p.dieEfetivo = stepDie(p.die, p.stepMod ?? 0);
  p.valor = dieFaces(p.dieEfetivo);
}
```

---

## 11. Lacunas e decisões pendentes

Itens que o playtest **não** define e que você precisa decidir (e idealmente expor como *settings*):

1. **Valores de PV/PD** — não há fórmula publicada; vêm prontos nas fichas dos personagens. Deixe como campo livre.
2. **Progressão por nível** — não publicada.
3. **NEX** — mencionado, mecânica não publicada.
4. **Combate completo e ordem de ações** — explicitamente adiado.
5. **Cura / recuperação de PV e PD** — não definida. Inclui: quando zerar `testesFerimento` / `testesTrauma`.
6. **Curva de dificuldade do problema matemático** (hack técnico) — só a direção é dada.
7. **Compartilhar: Pesquisar vs Intuição** — contradição interna do documento (§6.5).
8. **Sobrecarga na rodada 9+** — leitura provável 2d4, não inequívoca.
9. **Escopo do "aumento de passo" da Ajuda** — afeta o dado da perícia (interpretação adotada) ou o do atributo?
10. **Crítico e RA/RB com dados descartados** — ver §4.5.
11. **Outros tipos de cena** — o playtest cobre apenas investigação.

---

## 12. Glossário PT-BR → chaves i18n

| Termo | Chave sugerida |
|---|---|
| Teste | `OP2.Test` |
| Dificuldade (DT) | `OP2.DT` |
| Rolagem Alta (RA) | `OP2.HighRoll` |
| Rolagem Baixa (RB) | `OP2.LowRoll` |
| Aumento de passo | `OP2.StepUp` |
| Redução de passo | `OP2.StepDown` |
| Sucesso crítico | `OP2.Critical` |
| Falha crítica | `OP2.Fumble` |
| Perfil | `OP2.Profile` |
| Ocupação | `OP2.Occupation` |
| Ponto de Interesse | `OP2.POI` |
| Sobrecarga mental | `OP2.MentalOverload` |
| Desafio de acesso | `OP2.AccessChallenge` |
| Ferimento | `OP2.Wound` |
| Trauma | `OP2.Trauma` |
| Ação importante / menor / livre | `OP2.Action.Major` / `.Minor` / `.Free` |

Mantenha `pt-BR` como idioma primário e `en` como espelho — a comunidade internacional de Ordem é pequena, mas o Foundry exige `en` como fallback.
