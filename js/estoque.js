// Regras do estoque. Não acessa banco nem tela, por isso dá pra testar
// separado (testes/estoque.test.js).

(function (global) {

    // saldo de cada produto = entradas - saídas
    // retorna { produto_id: { entradas, saidas, saldo, ultimaSaida } }
    function calcularSaldos(movimentacoes) {
        const mapa = {};
        for (const m of movimentacoes || []) {
            if (!mapa[m.produto_id]) {
                mapa[m.produto_id] = { entradas: 0, saidas: 0, saldo: 0, ultimaSaida: null };
            }
            const s = mapa[m.produto_id];
            const qtd = Number(m.quantidade) || 0;
            if (m.tipo === 'entrada') {
                s.entradas += qtd;
            } else if (m.tipo === 'saida') {
                s.saidas += qtd;
                if (!s.ultimaSaida || m.criado_em > s.ultimaSaida) s.ultimaSaida = m.criado_em;
            }
            s.saldo = s.entradas - s.saidas;
        }
        return mapa;
    }

    // retorna a mensagem de erro, ou null se puder lançar
    function validarMovimentacao(tipo, quantidade, saldoAtual) {
        if (tipo !== 'entrada' && tipo !== 'saida') return 'Escolha entrada ou saída.';
        const qtd = Number(quantidade);
        if (!Number.isInteger(qtd) || qtd <= 0) return 'Quantidade inválida.';
        const saldo = Number(saldoAtual) || 0;
        if (tipo === 'saida' && qtd > saldo) return `Saldo insuficiente (tem ${saldo}).`;
        return null;
    }

    function situacaoEstoque(saldo, minimo) {
        if (saldo <= 0) return 'zerado';
        if (saldo <= (Number(minimo) || 0)) return 'baixo';
        return 'ok';
    }

    // produtos no mínimo ou abaixo, os mais críticos primeiro
    function produtosAbaixoDoMinimo(produtos, saldos) {
        return (produtos || [])
            .map(p => {
                const saldo = saldos[p.id] ? saldos[p.id].saldo : 0;
                return { ...p, saldo, situacao: situacaoEstoque(saldo, p.estoque_minimo) };
            })
            .filter(p => p.situacao !== 'ok')
            .sort((a, b) => (a.saldo - a.estoque_minimo) - (b.saldo - b.estoque_minimo));
    }

    // Curva ABC pelo valor vendido (qtd x preço de venda) nos últimos `dias`.
    // A até 80% do total acumulado, B até 95%, C o resto.
    // Produto sem saída no período fica como C e marcado como parado.
    function curvaABC(produtos, movimentacoes, dias = 30, agora = new Date()) {
        const inicio = new Date(agora.getTime() - dias * 86400000).toISOString();
        const vendido = {};
        for (const m of movimentacoes || []) {
            if (m.tipo === 'saida' && m.criado_em >= inicio) {
                vendido[m.produto_id] = (vendido[m.produto_id] || 0) + Number(m.quantidade);
            }
        }

        const saldos = calcularSaldos(movimentacoes);
        const linhas = (produtos || []).map(p => {
            const s = saldos[p.id] || { saldo: 0, ultimaSaida: null };
            const qtd = vendido[p.id] || 0;
            return {
                id: p.id,
                nome: p.nome,
                qtdVendida: qtd,
                valorVendido: qtd * (Number(p.preco_venda) || 0),
                saldo: s.saldo,
                capitalParado: s.saldo * (Number(p.custo) || 0),
                diasSemSaida: s.ultimaSaida ? Math.floor((agora - new Date(s.ultimaSaida)) / 86400000) : null,
                parado: qtd === 0
            };
        });
        linhas.sort((a, b) => b.valorVendido - a.valorVendido);

        const total = linhas.reduce((t, l) => t + l.valorVendido, 0);
        let acumulado = 0;
        for (const l of linhas) {
            // usa o acumulado de antes do item: quem passa dos 80% ainda é A
            const antes = total > 0 ? acumulado / total : 1;
            acumulado += l.valorVendido;
            l.percentual = total > 0 ? l.valorVendido / total : 0;
            l.percentualAcumulado = total > 0 ? acumulado / total : 0;
            if (l.parado) l.classe = 'C';
            else if (antes < 0.8) l.classe = 'A';
            else if (antes < 0.95) l.classe = 'B';
            else l.classe = 'C';
        }
        return { linhas, total };
    }

    const Estoque = { calcularSaldos, validarMovimentacao, situacaoEstoque, produtosAbaixoDoMinimo, curvaABC };
    if (typeof module !== 'undefined' && module.exports) module.exports = Estoque;
    else global.Estoque = Estoque;

})(typeof window !== 'undefined' ? window : globalThis);
