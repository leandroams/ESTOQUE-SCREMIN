// Acesso ao Supabase. A tela só usa as funções do objeto Banco.
// Cadastro, edição e exclusão passam por funções no banco que conferem o PIN
// (ver supabase/schema.sql), então o PIN não fica no código do site.

// se a biblioteca não carregou (sem internet), sb fica null e as funções avisam
const sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

function checarErro(error) {
    if (!error) return;
    if (error.message.includes('PIN incorreto')) throw new Error('PIN incorreto.');
    throw new Error(error.message);
}

// o Supabase devolve no máximo 1000 linhas por consulta
async function buscarTodos(tabela, ordem) {
    if (!sb) throw new Error('não foi possível conectar. Verifique a internet.');
    const linhas = [];
    for (let de = 0; ; de += 1000) {
        const { data, error } = await sb.from(tabela).select('*')
            .order(ordem).range(de, de + 999);
        checarErro(error);
        linhas.push(...data);
        if (data.length < 1000) return linhas;
    }
}

const Banco = {
    listarCategorias() {
        return buscarTodos('categorias', 'nome');
    },

    async listarProdutos() {
        const todos = await buscarTodos('produtos', 'nome');
        return todos.filter(p => p.ativo);
    },

    listarMovimentacoes() {
        return buscarTodos('movimentacoes', 'criado_em');
    },

    // saldo de cada produto calculado no banco (view vw_saldos)
    listarSaldos() {
        return buscarTodos('vw_saldos', 'produto_id');
    },

    async registrarMovimentacao(produto_id, tipo, quantidade, observacao) {
        const { error } = await sb.from('movimentacoes')
            .insert({ produto_id, tipo, quantidade, observacao: observacao || null });
        checarErro(error);
    },

    async verificarPin(pin) {
        const { data, error } = await sb.rpc('verificar_pin', { p_pin: pin });
        checarErro(error);
        return data === true;
    },

    async salvarProduto(pin, p) {
        const { error } = await sb.rpc('salvar_produto', {
            p_pin: pin,
            p_id: p.id || null,
            p_nome: p.nome,
            p_categoria_id: p.categoria_id || null,
            p_custo: p.custo,
            p_preco_venda: p.preco_venda,
            p_estoque_minimo: p.estoque_minimo
        });
        checarErro(error);
    },

    async excluirProduto(pin, id) {
        const { error } = await sb.rpc('excluir_produto', { p_pin: pin, p_id: id });
        checarErro(error);
    },

    async salvarCategoria(pin, nome) {
        const { error } = await sb.rpc('salvar_categoria', { p_pin: pin, p_nome: nome });
        checarErro(error);
    },

    async excluirCategoria(pin, id) {
        const { error } = await sb.rpc('excluir_categoria', { p_pin: pin, p_id: id });
        checarErro(error);
    }
};
