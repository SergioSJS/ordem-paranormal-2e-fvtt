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

### Curva do problema matemático no hack técnico (spec §7.3)

O texto só dá a direção: quanto maior o resultado, mais fácil o problema.

**Decisão:** fica como ferramenta de mestre (timer + banco de perguntas) na fase 3, sem
curva automática.

## Como adicionar uma lacuna nova

1. Documente aqui: o que a fonte diz, onde é ambígua, e o default escolhido com o motivo.
2. Registre o setting em `module/settings/register.mjs`.
3. Traduza `OP2.Config.<chave>.name` e `.hint` nos dois arquivos de idioma.
4. Cite a seção da spec no comentário do código que lê o setting.
