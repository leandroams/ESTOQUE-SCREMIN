# Requisitos do planejamento x sistema

Conferência do que está no planejamento (Projeto 10) com o que foi feito.

## Funcionais

| Requisito do planejamento | Onde está |
|---|---|
| Cadastrar, editar e consultar produtos com custo, preço de venda e estoque mínimo | tela Produtos, função `salvar_produto` no banco |
| Cadastro de categorias | tela Produtos (Categorias), função `salvar_categoria` |
| Registrar entradas e saídas | tela Lançar e botões + / - do Painel, tabela `movimentacoes` |
| Saldo calculado, nunca digitado | view `vw_saldos` (soma entradas e tira saídas); a tela só lê |
| Não aceitar quantidade zero ou negativa | `check (quantidade > 0)` na tabela e `validarMovimentacao` |
| Não deixar saída maior que o saldo | trigger `checar_saida` no banco e `validarMovimentacao` na tela |
| Guardar a data de cada movimentação | coluna `criado_em`, preenchida pelo servidor |
| Avisar produto abaixo do mínimo | Painel (resumo, aba Estoque baixo / Zerados, etiqueta de situação) e aviso ao lançar saída |
| Curva ABC com produtos parados | tela Relatório (30, 60 ou 90 dias), com impressão |
| PIN em ações sensíveis (cadastrar, excluir) | janela do PIN; o PIN é conferido no banco, não fica no código |

## Não funcionais

| Requisito do planejamento | Como foi atendido |
|---|---|
| Custo zero | Supabase (plano grátis) e Vercel (grátis) |
| Front-end e back-end separados por API | site estático na Vercel falando com a API do Supabase |
| Banco relacional normalizado | tabelas `categorias`, `produtos`, `movimentacoes` com chaves estrangeiras |
| Mensagem clara ao salvar (Nielsen) | aviso verde de confirmação, vermelho em erro |
| Confirmação antes de excluir (Nielsen) | janela pedindo o PIN com o nome do item |
| Mesmos botões e cores em todas as telas (Nielsen) | um arquivo de estilo só (`css/sistema.css`) |
| Lançar saída com poucos passos | botão - na linha do produto já abre o lançamento preenchido; leitor de código de barras no painel lança direto |
| Código comentado e organizado em pastas | ver README |
| Git e GitHub, novos recursos em branch | repositório `estoque-scremin`, mudanças por pull request |
| Testes | `npm test` (regras de saldo, validação, situação e curva ABC) |

## Depende da distribuidora

- Custo e estoque mínimo de cada produto. Sem isso o valor em estoque fica zero e nenhum
  produto aparece como abaixo do mínimo.
- Testes de uso com a equipe, treinamento e feedback (etapas 7, 8 e 9).
