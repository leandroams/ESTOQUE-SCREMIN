-- Traz os produtos do banco antigo da Scremin (caderneta) para o banco novo.
-- São dois passos, cada um num projeto diferente do Supabase.


-- PASSO 1: rodar no SQL Editor do projeto ANTIGO (isuuamburwyvuskojgiw).
-- O resultado é uma linha só de texto. Copie ela inteira.

select string_agg(
    format('(%L, %s, %s)', trim(nome), coalesce(preco, 0), greatest(coalesce(estoque, 0), 0)),
    E',\n' order by nome
) as copiar
from produtos;


-- PASSO 2: rodar no SQL Editor do projeto NOVO (xbndasacccfrczejngia).
-- Cole o texto do passo 1 no lugar de COLAR_AQUI.
-- O preço vira preço de venda, o custo e o estoque mínimo ficam 0 pra
-- preencher depois na tela de produtos, e o estoque de cada produto entra
-- como uma movimentação de entrada (assim o saldo continua sendo calculado).

with dados (nome, preco, estoque) as (
    values
COLAR_AQUI
),
novos as (
    insert into produtos (nome, preco_venda, custo, estoque_minimo)
    select nome, preco, 0, 0
    from dados
    where nome not in (select nome from produtos)
    returning id, nome
)
insert into movimentacoes (produto_id, tipo, quantidade, observacao)
select n.id, 'entrada', d.estoque, 'Estoque do sistema antigo'
from novos n
join dados d on d.nome = n.nome
where d.estoque > 0;
