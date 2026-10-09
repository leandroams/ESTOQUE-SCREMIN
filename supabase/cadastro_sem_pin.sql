-- Cadastro e edição de produto sem PIN (o PIN continua para excluir).
-- Rodar uma vez no SQL Editor, depois do codigo_barras.sql.

create or replace function salvar_produto(
    p_pin text, p_id bigint, p_nome text, p_categoria_id bigint,
    p_custo numeric, p_preco_venda numeric, p_estoque_minimo integer,
    p_codigo_barras text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare
    novo_id bigint;
    codigo text := nullif(trim(p_codigo_barras), '');
begin
    if p_id is null then
        insert into produtos (nome, categoria_id, custo, preco_venda, estoque_minimo, codigo_barras)
        values (trim(p_nome), p_categoria_id, p_custo, p_preco_venda, p_estoque_minimo, codigo)
        returning id into novo_id;
        return novo_id;
    end if;
    update produtos set nome = trim(p_nome), categoria_id = p_categoria_id, custo = p_custo,
           preco_venda = p_preco_venda, estoque_minimo = p_estoque_minimo, codigo_barras = codigo
     where id = p_id;
    return p_id;
end $$;
