// testes das regras de estoque: npm test
const test = require('node:test');
const assert = require('node:assert');
const E = require('../js/estoque.js');

const mov = (produto_id, tipo, quantidade, criado_em = '2026-10-01T10:00:00Z') =>
    ({ produto_id, tipo, quantidade, criado_em });

test('saldo é entradas menos saídas', () => {
    const s = E.calcularSaldos([mov(1, 'entrada', 10), mov(1, 'saida', 3), mov(2, 'entrada', 5)]);
    assert.strictEqual(s[1].saldo, 7);
    assert.strictEqual(s[2].saldo, 5);
});

test('recusa quantidade zero, negativa ou quebrada', () => {
    assert.ok(E.validarMovimentacao('entrada', 0, 10));
    assert.ok(E.validarMovimentacao('entrada', -2, 10));
    assert.ok(E.validarMovimentacao('entrada', 1.5, 10));
    assert.strictEqual(E.validarMovimentacao('entrada', 3, 0), null);
});

test('recusa saída maior que o saldo', () => {
    assert.match(E.validarMovimentacao('saida', 8, 7), /tem 7/);
    assert.strictEqual(E.validarMovimentacao('saida', 7, 7), null);
});

test('situação do estoque', () => {
    assert.strictEqual(E.situacaoEstoque(0, 5), 'zerado');
    assert.strictEqual(E.situacaoEstoque(5, 5), 'baixo');
    assert.strictEqual(E.situacaoEstoque(6, 5), 'ok');
});

test('lista quem está abaixo do mínimo', () => {
    const produtos = [{ id: 1, nome: 'A', estoque_minimo: 5 }, { id: 2, nome: 'B', estoque_minimo: 2 }];
    const saldos = E.calcularSaldos([mov(1, 'entrada', 3), mov(2, 'entrada', 10)]);
    const r = E.produtosAbaixoDoMinimo(produtos, saldos);
    assert.deepStrictEqual(r.map(p => p.id), [1]);
});

test('curva ABC classifica pelo valor vendido e marca parados', () => {
    const agora = new Date('2026-10-09T12:00:00Z');
    const produtos = [
        { id: 1, nome: 'Muito vendido', preco_venda: 10, custo: 5 },
        { id: 2, nome: 'Médio', preco_venda: 10, custo: 5 },
        { id: 3, nome: 'Pouco', preco_venda: 10, custo: 5 },
        { id: 4, nome: 'Parado', preco_venda: 10, custo: 5 }
    ];
    const movs = [
        mov(1, 'entrada', 100), mov(2, 'entrada', 100), mov(3, 'entrada', 100), mov(4, 'entrada', 10),
        mov(1, 'saida', 80, '2026-10-05T10:00:00Z'),
        mov(2, 'saida', 15, '2026-10-05T10:00:00Z'),
        mov(3, 'saida', 5, '2026-10-05T10:00:00Z'),
        mov(4, 'saida', 1, '2026-07-01T10:00:00Z')   // fora dos 30 dias
    ];
    const { linhas, total } = E.curvaABC(produtos, movs, 30, agora);
    const classe = Object.fromEntries(linhas.map(l => [l.nome, l.classe]));
    assert.strictEqual(total, 1000);
    assert.deepStrictEqual(classe, { 'Muito vendido': 'A', 'Médio': 'B', 'Pouco': 'C', 'Parado': 'C' });
    const parado = linhas.find(l => l.nome === 'Parado');
    assert.strictEqual(parado.parado, true);
    assert.strictEqual(parado.capitalParado, 45);
    assert.strictEqual(parado.diasSemSaida, 100);
});
