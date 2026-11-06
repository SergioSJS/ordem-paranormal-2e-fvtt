# Ordem Paranormal RPG 2 — Playtest Beta ("Contos da Vigília")
## Especificação técnica para implementação em Foundry VTT

> **Escopo.** Camada mecânica do playtest beta, escrita com as nossas palavras. Não traz o
> texto do livro, narração, quadros de ponto de interesse nem ficha de criatura: isso fica
> em `jambo-arquivos/playtest2/v1/extraido/`, fora do repositório (`docs/README.md`).
>
> **Fonte.** Arquivos Secretos, Pacote #10, outubro/2026, v1.0, 76 páginas.
> `p. N` é a página do PDF, igual ao número impresso no rodapé.
>
> **É o modo de jogo Vigília.** O alpha segue valendo como modo moderno, em paralelo
> (`docs/regras/alpha-para-beta.md`).
>
> **Citação no código:** `beta §7.3`. A spec do alpha continua sendo `spec §N`.
>
> **O que está em aberto** (o livro se contradiz bastante nesta revisão) está em
> `docs/regras/LACUNAS.md`, seção "Playtest beta". O que muda em relação ao alpha e onde
> isso bate no código está em `docs/regras/alpha-para-beta.md`.

---

## 1. Identidade

- Ambientação: Irlanda da Idade das Trevas. Duas missões curtas, que começam já em conflito
  (p. 2, p. 4): *O Pântano dos Afogados* (gratuita) e *A Caverna de Cruachan* (assinantes).
- Foco declarado: **ação** — combate, perseguição, furtividade — mais uma amostra de
  relacionamento e medo (p. 2). O alpha era focado em investigação.
- Sem iniciativa nem ordem de turnos no combate: a rodada é dividida em fases por tipo de
  ação (p. 2, p. 18).
- Grupo de 4 a 6 pessoas: mestre + 3 a 5 jogadores (p. 5).

## 2. Ficha

### 2.1 Campos (p. 6–8)

Nome · Perfil (`executor`, `analista`, `vigilante`) · **Vocação** (substitui Ocupação: "o que
o personagem tem tendência a fazer bem") · Nível 1–10 · 3 atributos · 20 perícias · PV e PD ·
Habilidades · Equipamento · Relações (página de histórico; §9.2).

Atributos e escalas de dado iguais ao alpha (d4 a d12; d20 só com paranormal).

### 2.2 Perícias (p. 9)

| Perícia | Atributo-base | | Perícia | Atributo-base |
|---|---|---|---|---|
| Acrobacia | Físico | | Intimidar | Emoção |
| **Animais** (nova) | Emoção | | Intuição | Emoção |
| Aptidão (coleção) | Mente | | Luta | Físico |
| Atletismo | Físico | | Medicina | Mente |
| **Bruxaria** (= Ocultismo do alpha) | Mente | | **Metalurgia** (nova) | Mente |
| Crime | Físico | | Percepção | Mente |
| Disciplina | Emoção | | Persuasão | Emoção |
| Enganação | Emoção | | Pontaria | Físico |
| Furtividade | Físico | | Sobrevivência | Mente |
| **Inspecionar** (= Pesquisar do alpha) | Mente | | Vigor | Físico |

Fichas e quadros usam **Ocultismo** e **Ofício (metalurgia)**; a lista da p. 9 usa **Bruxaria** e
**Metalurgia** (lacuna). Máquinas e Tecnologia não aparecem nesta ambientação, e seguem existindo
no modo moderno. O atributo-base continua sendo sugestão: o mestre pode trocar.

**Aptidão:** Artes, Erudição, Folclore, Guerra, Nobreza, Religião. Personagem com menos de d6
em Erudição é **analfabeto** (p. 9), e isso tem efeito em ponto de interesse (p. 39).

### 2.3 Personagens prontos

Oito, todos nível 3: seis no zip da Missão 1, os mesmos seis mais dois no da Missão 2. As
páginas dos seis são idênticas nos dois PDFs de fichas. A ficha lista perícias como `dN + dM`
com o rótulo do atributo. Cormac tem três linhas de Aptidão (22 no total), os demais uma.

## 3. Testes

Iguais ao alpha, com estes acréscimos:

- Atributo + perícia, soma, DT padrão 7. Máximo de 4 dados rolados e 3 somados (p. 10, p. 12).
- **Crítico:** dois ou mais dados iguais com valor ≥ 6. Em **testes estendidos e ataques**
  soma também a segunda maior rolagem à pontuação ou ao dano (p. 11). Sai a "informação
  adicional" em investigação que o alpha dava.
- **Falha crítica:** todos os dados em 1; mesma tabela 1d8 do alpha (p. 11).
- **Ajuda:** gasta ação, exige perícia ≥ d6; +1 passo com d6/d8, +2 passos com d10/d12 (p. 11).
- **Modificadores numéricos passam a existir.** O livro continua dizendo que tudo é passo,
  mas imprime `+1 em testes de ataque`, `–2 em Vigor`, `+1 na rolagem de dano`, `+1d6`. Três
  categorias distintas que o motor precisa distinguir:
  - **passo** — anda na escada;
  - **dado bônus** (`+1d6`, `+d8`) — dado a mais, sujeito ao limite 4/3;
  - **modificador fixo** (`+1`, `–2`) — soma no resultado.

## 4. Estrutura

- Cena, rodada e ação como no alpha (p. 12). Fora de combate, os jogadores decidem a ordem;
  NPCs agem por último.
- Uma ação por rodada, mais ações menores/livres.

## 5. Investigação (p. 13–15)

Ação **Investigar** em três passos:

1. **Escolher o ponto.** O mestre narra a descrição básica.
2. **Investigar ou Interagir.**
   - *Investigar:* escolhe uma perícia do quadro, diz o dado; recebe de graça toda linha dela
     com DT ≤ faces do dado. Segue para o passo 3.
   - *Interagir:* ação simples (abrir gaveta, virar foto). O mestre dá informação **ou pede um
     teste**. Encerra o turno.
3. **Aprofundar**, só para quem investigou:
   - **Observar:** escolhe **outra** perícia do quadro e recebe as linhas pelo dado, como no
     passo 2. Sem teste, sem custo. **Novidade do beta.**
   - **Examinar:** testa a perícia do passo 2; recebe as linhas com DT ≤ resultado. Sem
     informação nova, perde 1 PD.

Outras ações: Recapitular (Intuição DT 10, 1× por cena após um sucesso), Compartilhar (aliado
testa DT 10 como ação livre; mesma trava), Usar habilidades e itens (normalmente +1 passo).

**Sobrecarga mental** é citada (p. 13) e não tem tabela nesta revisão. A pressão de tempo das
missões vem de limite de rodadas: a Cena 2 da Missão 2 tem 8, a Fase 2 da Missão 1 tem 3.

Ponto de interesse pode ter **pré-requisito na linha** (`apenas se alguém tiver encontrado X`;
ícone de cadeado, p. 62) e subpontos numerados (`4.1`, `5.2`), alcançáveis só depois de vencer o
desafio do ponto pai.

## 6. Desafios de acesso (p. 16–17)

| Desafio | Regra | Muda do alpha? |
|---|---|---|
| **Destrancar** | Senha de N dados; palpite posicionado; alto/baixo/exato. Crime d4/6/8/10/12 = 1/2/3/4/5 tentativas por rodada. Máximo de tentativas definido pela missão. | Não |
| **Arrombar** | 1 PV + Atletismo vs DT; acumula RA até a pontuação alvo. | Não |
| **Alcançar** | Seguro: 2 ações, teste em cada, falha = dano RB e recomeça. Arriscado: 1 ação, DT+3, falha = dano RA. | Perícia pode variar por ponto (Atletismo na p. 64) |
| **Sustentar** | 1 PV + Atletismo; novo teste por rodada, –1 passo acumulado. | Não |
| **Equilíbrio** | Rola 2d10, não soma: iguais ou diferença de 1 = equilibrado; senão começa a cair. Recebe dados de equilíbrio (d4) = faces de Acrobacia ÷ 2, gastos na travessia; cada um soma a um dos d10, à escolha. | **Novo** |
| **Escalar** (p. 41) | Acumula até 10: rápido (DT 8, soma RA) ou cauteloso (DT 6, soma RB). Falha = cai e sofre dano igual aos pontos acumulados. | **Novo** |
| **Equilibrar-se** (p. 66) | N sucessos de equilíbrio; falha = cai, d4 de dano, recomeça. | **Novo** |

Hackear não aparece. Sem as ferramentas da Ordo Realitas nesta ambientação.

## 7. Combate

### 7.1 Sequência (p. 18, p. 69)

Sem iniciativa. A rodada tem fases por tipo de ação; cada personagem tem **uma ação padrão**, e
agir numa fase impede agir nas seguintes (salvo efeito, como Prontidão). Quem não age em
nenhuma fase perde a rodada.

| Fase | Conteúdo |
|---|---|
| **Suporte** (Geral, Tática) | Ações gerais, habilidades e itens, preparar esquiva |
| **Ataques à distância** | Agredir à distância |
| **Ataques corpo a corpo** | Agredir, manobras |
| **Final** | Movimento puro, fuga, investigar durante a luta, ação não relacionada ao combate |

O livro imprime três fases nas regras e quatro nas missões (lacuna; adotamos as quatro).

Dentro de uma fase, a ordem é a habitual (esquerda do mestre, sentido horário), mas **tudo é
simultâneo**: quem morre na fase ainda resolve a ação daquela fase. Fases anteriores acontecem
antes: matar à distância impede o corpo a corpo do alvo.

### 7.2 Ações gerais (p. 18–19)

| Ação | Efeito |
|---|---|
| **Atrapalhar** | Alvo em alcance curto. Perícia coerente vs Percepção. Vence: alvo –1 passo em todos os testes até o fim da rodada. |
| **Defender-se** | Acrobacia +1d6 oposto a um ataque escolhido **antes** da rolagem (Luta no lugar de Acrobacia, se corpo a corpo). Vence: não sofre dano, e também não causa. |
| **Erguer-se** | Levanta. Pode ser ação livre: –1 passo em todos os testes da rodada. |
| **Fintar** | Enganação vs Intuição, alcance curto. Vence: +2 passos no próximo ataque contra o alvo até o fim da próxima rodada. |
| **Jogar-se no chão** | Ação livre. Benefícios e penalidades de caído a partir da próxima rodada. |
| **Mirar** | Alvo visível no alcance. Próxima rodada: +1d6 em ataques à distância contra ele. |
| **Preparar** | Declara ação + gatilho; ocorre como reação, **antes** da resolução do gatilho, e pode impedir o evento. Sem gatilho, perde a ação. |
| **Sacar ou guardar** | Pode ser ação livre: –1 passo em todos os testes da rodada. |
| **Usar habilidade ou item** | Conforme o item. |

### 7.3 Ataque (p. 19–21)

- **Agredir.** Corpo a corpo alcança curto; à distância alcança curto ou longo.
- **Teste:** Luta (corpo a corpo) ou Pontaria (distância). **DT 7**; alcance longo +3.
- **Atirar em corpo a corpo** (alvo que atacou ou foi atacado em corpo a corpo na rodada
  anterior): –2 passos, ou ignora a penalidade e rola 1d6: ímpar = resolve contra quem o alvo
  enfrentou (sorteia se forem vários).
- **Ataques corpo a corpo cruzados viram teste oposto:** maior resultado acerta; **empate, os
  dois acertam**; nos dois casos, é preciso atingir DT 7 (se ninguém somar 7, os dois erram).
- **Dano:** RA + modificador da arma. Crítico soma também a segunda maior rolagem.

### 7.4 Manobras (p. 20)

Substituem um ataque corpo a corpo. Teste de ataque oposto a Acrobacia ou Luta do alvo (ou ao
ataque dele, se ele atacou na mesma rodada).

| Manobra | Efeito | Vencendo por 5+ |
|---|---|---|
| **Agarrar** | Alvo imóvel, –1 passo em ataque, só armas pequenas. Solta-se com ação padrão e novo oposto. Exige ataque desarmado ou arma natural; ocupa a mão; agressor fica sobrecarregado e arrasta o alvo. Atirar em envolvidos: 50% de mirar errado. Pode trocar ataque por teste de agarrar: dano de impacto = RA. | — |
| **Derrubar** | Alvo caído. | Dano de impacto = RB |
| **Desarmar** | Alvo larga o item. | Pega o item ou arremessa |
| **Empurrar** | Alguns metros para trás. | Alvo –1 passo no próximo teste (até o fim da próxima rodada) |
| **Quebrar** | Causa o dano do ataque em item empunhado ou vestido. | — |

### 7.5 Situações (p. 21, p. 24)

| Situação | Efeito |
|---|---|
| **Caído** | –1 passo em testes físicos (Luta inclusive). Corpo a corpo contra ele: +1 passo. À distância contra ele: DT +3. |
| **Cobertura leve / total** | DT +3 / não pode ser atacado. |
| **Ocultação leve / total** | Atacante –1 / –2 passos. Vale para os dois lados, se ambos tiverem. |
| **Vantagem tática** | +1 passo no ataque (alvo caído, posição elevada, a critério do mestre). |

### 7.6 Movimento (p. 69)

Simplificado: atacar já inclui chegar ao alvo. Combate em **zonas** é só mencionado: corpo a
corpo restrito à mesma zona, ação para trocar de zona. Nenhuma cena das duas missões usa, e a
regra não está publicada. Os mapas não têm grade.

## 8. Dano

### 8.1 Físico, letal e não letal (p. 21, p. 23)

Físico reduz PV, emocional reduz PD. Não letal reduz PV igual, mas é anotado à parte; chegando
a 0 por soma de letal e não letal: +1d6 no teste de morte, e rola 2d20 ficando com o melhor na
tabela de lesão. Converter o tipo do ataque custa –2 passos.

### 8.2 Teste de lesão (p. 21–22)

Ao chegar a 0 PV, ou perder PV já em 0: **Físico + Vigor** vs DT 7, +3 por teste de lesão já feito
na cena.

| Resultado | Efeito |
|---|---|
| Crítico | +1 PV; sai de inconsciente/moribundo |
| Sucesso | **Inconsciente e moribundo** |
| Falha | **Lesão** (1d20) |
| Falha crítica | Morre |

**Moribundo:** no fim de cada rodada, menos a primeira, novo teste com DT crescente. **Lesão:**
1d20 + 1 por patamar acima de iniciante (veterano +1, elite +2, lenda +3). Depois de rolar, sai de
moribundo. Fim da cena com 0 PV, recupera 1.

| 1d20 | Lesão | Efeito |
|---|---|---|
| 1–4 | Morte súbita | Morre |
| 5–9 | Morte lenta | +1 PV, acorda, age na próxima rodada e morre ao fim dela |
| 10 | Laceração profunda | –2 PV máximos; acumula |
| 11 | Sem olho | –1 em Percepção e Pontaria |
| 12 | Sem mão | Só um item empunhado; –1 passo ou falha em tarefas de duas mãos |
| 13 | Sem pé | –2 passos em movimentar-se e perseguição a pé |
| 14 | Tendão | –2 em Acrobacia |
| 15 | Músculo | –2 em Atletismo |
| 16 | Órgão interno | –2 em Vigor |
| 17 | Órgão sensorial | –2 em Percepção |
| 18 | Cicatriz | –2 em Persuasão, +1 em Intimidar |
| 19 | Contusão | Físico –1 passo até o fim da cena |
| 20+ | Surto de adrenalina | +1 PV, sem sequela |

10 a 18 são permanentes; lesão repetida rola de novo, menos Laceração.

### 8.3 Teste de trauma (p. 23)

Ao chegar a 0 PD por efeito externo, ou sofrer dano emocional já em 0: **Emoção + Disciplina** vs DT 7,
+3 por teste de trauma na cena. Passou, nada. Falhou, 1d20 + bônus de patamar.

| 1d20 | Trauma | Efeito |
|---|---|---|
| 1–4 | Colapso total | Personagem perdido |
| 5–6 | Estresse pós-traumático | +1 em todo dano emocional sofrido |
| 7–8 | Degradação cognitiva | –1 em Mente |
| 9–10 | Mácula psíquica | –1 em Emoção |
| 11–12 | Chaga da alma | –2 PD máximos |
| 13–14 | Retração defensiva | –2 em Persuasão e Intuição |
| 15–17 | Pânico | Recebe dado de pavor |
| 18–19 | Estupor catatônico | Perde a próxima ação |
| 20+ | Injeção de ânimo | +1 PD, sem sequela |

5 a 14 duram até serem curados; trauma repetido rola de novo.

### 8.4 Pontos de armadura (p. 24)

Itens dão pontos. Ao sofrer dano, ação livre: gasta **1** ponto (só 1) para reduzir **10** do dano.
Não se recuperam neste playtest.

### 8.5 Redução de dano

Sem regra geral: aparece em criatura e objeto (`RD 5`), e armas especiais a ignoram (`ignora 5
pontos de RD`).

## 9. Medo e relações

### 9.1 Dado de pavor (p. 24)

Começa em d6 e rola junto em todo teste. Não soma; **anula os dados com resultado menor que ele**
(empate não anula). Todos anulados = falha crítica, valor 0. Receber de novo: +1 passo.

- **Vencendo:** se o dado de pavor der 1, o efeito termina.
- **Controlando:** antes do teste, 1 PD para –1 passo no dado de pavor.
- **Abraçando:** antes do teste, 5 PD para converter em dado bônus.

### 9.2 Relações (p. 24–25)

Na ficha: uma linha por personagem, rótulo livre (`AMIZADE`, `SUSPEITA`) e grau 0–3 em três círculos.
**Invocar** exige descrever o sentimento; **cada relação uma vez por missão**.

| Grau | Benefícios (um, à escolha) |
|---|---|
| **1 Afinidade** | +1d6 em teste ligado à pessoa, ou ao ajudar a pessoa |
| **2 Vínculo** | +1d8 em teste ligado, ou ao ajudar; ou ação para ela recuperar 2d4 PD |
| **3 Devoção** | +1d12 em teste ligado, ou ao ajudar; ou ação para ela recuperar 2d6 PD; ou, com a pessoa em perigo, uma ação extra para ajudá-la |

## 10. Perseguição (nas missões: p. 35, p. 73)

Não existe como regra geral: cada missão traz a sua. O que é comum vira modelo; o que varia é
parâmetro da cena.

**Comum.** Duração fixa em rodadas; testes de avançar acumulam **pontos de avanço**; a cada
rodada de corte, quem está abaixo do limiar sofre a consequência.

- **Fôlego:** no início, d6 = faces de Vigor ÷ 2 (Vigor d6 = 3d6), usados como dados bônus.
- **Avançar:** Atletismo DT 10. Passou, soma RA; falhou, soma RB. Outra perícia justificada: cada
  uma só uma vez.
- **Esforço extra:** +1 passo no avançar; perde 1d4 PV, e a perda cresce 1d4 a cada uso.
- **Outras ações:** a critério do mestre, impedem avançar na rodada.

| Parâmetro | Missão 1 | Missão 2 |
|---|---|---|
| Rodadas | 4 | 5 |
| Cortes (fim da rodada → mínimo) | 2→5, 3→15, 4→25 | 3→15, 4→20, 5→30 |
| Quem fica abaixo | Derrubado, não age mais, 1d6 de dano por rodada, restantes incluídas; chega ao destino mesmo assim | **Morre**: só o de menor pontuação em cada corte; empate, teste oposto entre eles |
| Fôlego usado em | Só avançar | Qualquer ação de perseguição |
| Ações próprias | **Carregar outro** (–1 passo; o carregado iguala a pontuação de quem carrega; pode voltar para buscá-lo) | **Recuperar fôlego** (+2 dados); **Sacrifício** (não avança, +1d6 nos aliados) |
| Evento por rodada | — | Dois alvos aleatórios: 1d6 físico e 1d6 emocional |
| Obstáculo | — | Na 1ª vez com 15+: Percepção ou Sobrevivência DT 10, falhou = –2 passos no avanço; quem passou pode avisar (+1 passo) |

## 11. Furtividade (na Missão 2: p. 55–59)

**Teste de esconderijo.** Furtividade (ou perícia justificada), mas sem somar: **os dados ficam
separados com o valor rolado** e são os *dados de esconderijo*. Com ao menos um, está escondido.
Crítico: rola um dado extra igual a um dos do teste.

**Rodada em duas fases.**

- **Personagens:** avançam pela área, ou usam ação especial:
  - *Esconder-se:* Furtividade DT 7, +3 por uso próprio na cena; passou, um dado do teste vira esconderijo.
  - *Distrair:* Enganação DT 7, +3 por uso **de qualquer um**; um dado vira esconderijo seu ou de aliado.
  - *Chamar atenção:* transfere um dado seu para aliado e descarta outro seu.
  - *Ação chamativa:* barulho ou correria descarta um dado.
- **Criaturas:** um jogador rola 1d10 na tabela da missão. "Procurar" = o mestre rola os dados indicados à
  vista de todos; quem tem esconderijo **de valor igual** a algum deles descarta aquele dado.
  Evento em um só personagem sorteia o alvo.

**Encontrado** (sem dados): 1d6 de dano no fim de cada rodada; pode seguir avançando.

**Áreas** somam avanços com ações próprias (bosque 4, rio 3, encosta 4), com teste e dano por ação. Quem
completou a área pode esperar sem perder dados, sem agir. A área seguinte só abre com todos prontos.
É tudo dado da cena, sem regra geral.

## 12. Habilidades e equipamento (fichas)

As **habilidades** ficam no compêndio com o texto nosso, como no alpha. Os recursos novos que
exigem suporte do motor:

| Habilidade | Mecânica |
|---|---|
| **Análise** (perfil analista) | Ação: +2 marcadores (máx. 4; somem no fim da cena). **Depois de rolar**, cada marcador muda um dado em ±1, até o máximo do dado. |
| Leitura de Combate | Defender-se dá 1 marcador. |
| **Prontidão** (perfil vigilante) | 1×/rodada, 2 PD: rerrola um dado que não tenha dado 1, seu ou de outro ser em alcance curto. Em combate, age na fase da ação **ou em posteriores**, depois de qualquer ação da fase já rolada. |
| **Ímpeto** (perfil executor) | Barra de 5; falha enche. Ação livre: 1 = +d4 num teste; 3 = +1 passo em atributo até o fim da cena; 3 = ação extra em conflito. Esvazia no fim da cena. |
| Ímpeto Fervilhante | +1 espaço no início de cada cena. |
| Antecipação Tática | Início do combate, 2 PD: uma rodada agindo antes de todos. |
| Sorrateiro | 3 PD: +d8 em Crime ou Furtividade. |
| Esquiva | 1×/rodada, ação livre: Acrobacia oposta ao ataque; vence, evita. |
| Curandeiro | Ação + 2 PD; Medicina DT 7; cura PV = RA; 1× por alvo na cena. |
| Mentoria | Ao ajudar, testa a mesma perícia DT 7: o ajudado troca um dado pela sua RA. |
| Parceiro animal | +d6 em ataque corpo a corpo; deu 1, fora de cena. |
| Guardiã | +1 PV por patamar (já na ficha); 1×/rodada, 2 PD: vira alvo no lugar do aliado. |
| Instinto de Sobrevivência | Com PV ≤ metade: +1 passo em tudo. |
| Plano Estratégico | Ação + 3 PD; Aptidão (Guerra) DT 7: o grupo ganha d6, +d6 a cada 3 de excedente, para gastar até o fim da cena. |
| Segredo do Aço | Usa equipamento marcial; item com armadura dá +1 ponto. |
| Herança | Riqueza +1; regra de compra não publicada. |

**Equipamento** passa a ter mecânica. O que o item precisa declarar:

| Campo | Exemplos |
|---|---|
| Tipo de ataque | corpo a corpo, à distância |
| Bônus de dano | `RA+0` a `RA+4` |
| Marcial | gládio e cota exigem saber usar equipamento marcial |
| Pontos de armadura | corselete 1, elmo 1, cota de malha 2 |
| Passo em perícia | cota –1 em Atletismo e Furtividade; elmo –1 em Percepção |
| Efeitos pontuais | +1 passo no primeiro ataque; crítico com valores ≥ 5; +1 em ataque; munição com +1 passo e +1 de dano |

## 13. O que o beta não traz

NEX (só citado: `NEX 35%+ evita`), progressão e patamares, compra de itens, cura e descanso, ficha
definitiva, combate em zonas, sobrecarga mental, hackear, ferramentas da Ordo Realitas, regra
geral de perseguição e de furtividade.
