# Estoque Scremin

Sistema interno de controle de estoque da Distribuidora Scremin (Paranaguá-PR),
usado pelos funcionários. Feito para a prestação de serviço do curso de ADS.

Telas: painel, lançamento de entradas e saídas, produtos e relatório ABC.

## Banco

Supabase. O arquivo `supabase/schema.sql` cria as tabelas, a view de saldo, a trava
de saída maior que o saldo e as funções que pedem PIN. Rodar no SQL Editor.

Trocar o PIN:

```sql
update configuracoes set valor = 'NOVO_PIN' where chave = 'pin';
```

URL e chave do projeto ficam em `js/config.js`.

## Rodar

Abrir o `index.html` no navegador, ou subir a pasta na Vercel.

Testes das regras (precisa do Node): `npm test`

## Pastas

```
css/        estilos
js/         config, regras (estoque.js), banco e telas (app.js)
supabase/   script do banco
docs/       diagramas UML
testes/     testes
```
