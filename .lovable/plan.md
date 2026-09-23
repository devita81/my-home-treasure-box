# Comparação flexível e controles com destaque

## Objetivo
Tornar os controles da página Variações visualmente destacados do fundo e permitir comparar o mês principal com qualquer outro mês disponível.

## Implementação
- Reforçar contraste, borda e sombra dos seletores e abas, preservando o visual sóbrio e compacto.
- Manter as comparações rápidas existentes: mês anterior, mesmo mês do ano anterior e média de 3 meses.
- Incluir no seletor de comparação todos os meses disponíveis como opções diretas, identificadas por “vs. Mês/Ano”.
- Adaptar os cálculos, rótulos, tabela e detalhamento para usar corretamente o mês-base escolhido.
- Validar enquadramento, legibilidade e funcionamento em celular e desktop.

## Detalhes técnicos
- A seleção continuará em dois controles: mês analisado à esquerda e base de comparação à direita.
- A opção mensal específica será armazenada separadamente das bases predefinidas, sem alterar os dados existentes.
