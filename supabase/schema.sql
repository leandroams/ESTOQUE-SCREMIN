-- tabelas
create table if not exists categorias (
    id         bigint generated always as identity primary key,
    nome       text not null unique,
    criado_em  timestamptz not null default now()
);

create table if not exists produtos (
    id              bigint generated always as identity primary key,
    nome            text not null,
    categoria_id    bigint references categorias(id) on delete set null,
    custo           numeric(10,2) not null default 0 check (custo >= 0),
    preco_venda     numeric(10,2) not null default 0 check (preco_venda >= 0),
    estoque_minimo  integer not null default 0 check (estoque_minimo >= 0),
    codigo_barras   text unique,
    ativo           boolean not null default true,   -- excluir so desativa
    criado_em       timestamptz not null default now()
);

create table if not exists movimentacoes (
    id          bigint generated always as identity primary key,
    produto_id  bigint not null references produtos(id),
    tipo        text not null check (tipo in ('entrada', 'saida')),
    quantidade  integer not null check (quantidade > 0),
    observacao  text,
    criado_em   timestamptz not null default now()
);
create index if not exists idx_mov_produto on movimentacoes(produto_id);
create index if not exists idx_mov_data    on movimentacoes(criado_em);

-- pin
create table if not exists configuracoes (
    chave  text primary key,
    valor  text not null
);
insert into configuracoes (chave, valor) values ('pin', '1234')
on conflict (chave) do nothing;


-- saldo
create or replace view vw_saldos as
select p.id as produto_id,
       coalesce(sum(case when m.tipo = 'entrada' then m.quantidade end), 0)
     - coalesce(sum(case when m.tipo = 'saida'   then m.quantidade end), 0) as saldo,
       max(case when m.tipo = 'saida' then m.criado_em end) as ultima_saida
from produtos p
left join movimentacoes m on m.produto_id = p.id
group by p.id;


-- nao deixa sair mais do que tem
create or replace function checar_saida()
returns trigger language plpgsql as $$
declare
    saldo_atual integer;
begin
    if new.tipo = 'saida' then
        perform 1 from produtos where id = new.produto_id for update;
        select saldo into saldo_atual from vw_saldos where produto_id = new.produto_id;
        if coalesce(saldo_atual, 0) < new.quantidade then
            raise exception 'Saída maior que o saldo. Disponível: %', coalesce(saldo_atual, 0);
        end if;
    end if;
    new.criado_em := now();   -- data do servidor
    return new;
end $$;

drop trigger if exists trg_checar_saida on movimentacoes;
create trigger trg_checar_saida
before insert on movimentacoes
for each row execute function checar_saida();


-- funções
create or replace function pin_valido(p_pin text)
returns boolean language sql security definer set search_path = public as $$
    select exists (select 1 from configuracoes where chave = 'pin' and valor = p_pin);
$$;

create or replace function verificar_pin(p_pin text)
returns boolean language sql security definer set search_path = public as $$
    select pin_valido(p_pin);
$$;

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

create or replace function excluir_produto(p_pin text, p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
    if not pin_valido(p_pin) then raise exception 'PIN incorreto'; end if;
    update produtos set ativo = false where id = p_id;
end $$;

create or replace function salvar_categoria(p_pin text, p_nome text)
returns bigint language plpgsql security definer set search_path = public as $$
declare
    novo_id bigint;
begin
    if not pin_valido(p_pin) then raise exception 'PIN incorreto'; end if;
    insert into categorias (nome) values (trim(p_nome)) returning id into novo_id;
    return novo_id;
end $$;

create or replace function excluir_categoria(p_pin text, p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
    if not pin_valido(p_pin) then raise exception 'PIN incorreto'; end if;
    delete from categorias where id = p_id;
end $$;


-- permissões
alter table categorias    enable row level security;
alter table produtos      enable row level security;
alter table movimentacoes enable row level security;
alter table configuracoes enable row level security;

drop policy if exists "ler categorias"    on categorias;
drop policy if exists "ler produtos"      on produtos;
drop policy if exists "ler movimentacoes" on movimentacoes;
drop policy if exists "lancar movimentacao" on movimentacoes;

create policy "ler categorias"      on categorias    for select using (true);
create policy "ler produtos"        on produtos      for select using (true);
create policy "ler movimentacoes"   on movimentacoes for select using (true);
create policy "lancar movimentacao" on movimentacoes for insert with check (true);

grant select on vw_saldos to anon, authenticated;
revoke execute on function pin_valido(text) from anon, authenticated, public;
