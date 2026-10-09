let categorias = [];
let produtos = [];
let movimentacoes = [];
let saldos = {};

const $ = id => document.getElementById(id);

const saldoDe = id => (saldos[id] ? saldos[id].saldo : 0);
const produtoPorId = id => produtos.find(p => p.id === id);
const nomeCategoria = id => (categorias.find(c => c.id === id) || {}).nome || '-';

async function carregar() {
    try {
        let listaSaldos;
        [categorias, produtos, movimentacoes, listaSaldos] = await Promise.all([
            Banco.listarCategorias(),
            Banco.listarProdutos(),
            Banco.listarMovimentacoes(),
            Banco.listarSaldos()
        ]);
        // saldo vem da view vw_saldos
        saldos = {};
        listaSaldos.forEach(s => { saldos[s.produto_id] = { saldo: s.saldo, ultimaSaida: s.ultima_saida }; });
        mostrarPainel();
        mostrarListaLancar();
        mostrarHistorico();
        mostrarProdutos();
        mostrarCategorias();
        mostrarRelatorio();
    } catch (e) {
        console.error(e);
        avisar('Erro ao carregar os dados: ' + e.message, 'erro');
    }
}


// navegação

function abrirTela() {
    let tela = location.hash.slice(1);
    if (!$('tela-' + tela)) tela = 'painel';
    document.querySelectorAll('.tela').forEach(s => s.classList.toggle('ativa', s.id === 'tela-' + tela));
    document.querySelectorAll('#menu a').forEach(a => a.classList.toggle('ativo', a.dataset.tela === tela));
}
window.addEventListener('hashchange', abrirTela);


// painel

let filtroPainel = 'todos';

const codigo = id => String(id).padStart(4, '0');

function mostrarPainel() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    $('hoje').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    // ultima movimentação
    const ultimaMov = {};
    movimentacoes.forEach(m => { ultimaMov[m.produto_id] = m.criado_em; });

    const linhas = produtos.map(p => {
        const saldo = saldoDe(p.id);
        return { ...p, saldo, situacao: Estoque.situacaoEstoque(saldo, p.estoque_minimo), valor: saldo * Number(p.custo) };
    });

    const baixos = linhas.filter(p => p.situacao === 'baixo').length;
    const zerados = linhas.filter(p => p.situacao === 'zerado').length;
    const movHoje = movimentacoes.filter(m => new Date(m.criado_em) >= hoje);

    $('r-itens').textContent = produtos.length;
    $('r-unidades').textContent = linhas.reduce((t, p) => t + Math.max(p.saldo, 0), 0);
    $('r-valor').textContent = dinheiro(linhas.reduce((t, p) => t + Math.max(p.valor, 0), 0));
    $('r-repor').textContent = baixos + zerados;
    $('r-hoje').textContent = movHoje.length + (movHoje.length === 1 ? ' lançamento' : ' lançamentos');
    $('c-todos').textContent = linhas.length;
    $('c-baixo').textContent = baixos;
    $('c-zerado').textContent = zerados;

    const termo = $('pos-busca').value.trim().toLowerCase();
    const lista = linhas.filter(p =>
        (filtroPainel === 'todos' || p.situacao === filtroPainel) &&
        (p.nome.toLowerCase().includes(termo) || codigo(p.id).includes(termo) ||
         (p.codigo_barras || '').includes(termo)));

    const nomeSituacao = { ok: 'Normal', baixo: 'Baixo', zerado: 'Zerado' };
    const pagina = paginar('posicao', lista, mostrarPainel);
    $('tab-posicao').innerHTML = pagina.length
        ? pagina.map(p => `<tr>
            <td class="cod">${codigo(p.id)}</td>
            <td>${esc(p.nome)}</td>
            <td class="some-cel">${esc(nomeCategoria(p.categoria_id))}</td>
            <td class="dir forte">${p.saldo}</td>
            <td class="dir some-cel">${p.estoque_minimo}</td>
            <td><span class="etiqueta ${p.situacao}">${nomeSituacao[p.situacao]}</span></td>
            <td class="dir some-cel">${dinheiro(p.valor)}</td>
            <td class="dir some-cel">${ultimaMov[p.id] ? dataCurta(ultimaMov[p.id]) : '-'}</td>
            <td class="dir acoes">
                <button class="btn" title="Entrada" onclick="lancarDireto('entrada', ${p.id})">+</button><button class="btn" title="Saída" onclick="lancarDireto('saida', ${p.id})">-</button>
            </td>
          </tr>`).join('')
        : '<tr><td colspan="9" class="vazio">Nenhum produto encontrado.</td></tr>';

    const corrente = {};
    const depois = movimentacoes.map(m => {
        corrente[m.produto_id] = (corrente[m.produto_id] || 0) + (m.tipo === 'entrada' ? m.quantidade : -m.quantidade);
        return { ...m, saldoApos: corrente[m.produto_id] };
    });
    const ultimas = depois.slice(-10).reverse();
    $('tab-ultimas').innerHTML = ultimas.length
        ? ultimas.map(m => {
            const p = produtoPorId(m.produto_id);
            return `<tr>
                <td>${p ? esc(p.nome) : '(excluído)'}<span class="obs">${dataCurta(m.criado_em)}</span></td>
                <td class="dir ${m.tipo}-txt">${m.tipo === 'entrada' ? '+' : '-'}${m.quantidade}</td>
                <td class="dir">${m.saldoApos}</td>
            </tr>`;
        }).join('')
        : '<tr><td colspan="3" class="vazio">Nada lançado ainda.</td></tr>';
}

function filtrarPainel(ev) {
    const botao = ev.target.closest('button');
    if (!botao) return;
    filtroPainel = botao.dataset.filtro;
    primeiraPagina('posicao');
    document.querySelectorAll('#pos-abas button').forEach(b => b.classList.toggle('ativo', b === botao));
    mostrarPainel();
}

// leitor de código de barras
async function lerCodigo(ev) {
    ev.preventDefault();
    const campo = $('leitor-codigo');
    const cod = campo.value.trim();
    campo.value = '';
    if (!cod) return;

    $('leitor-ultimo').textContent = '';
    const p = produtos.find(x => x.codigo_barras === cod);
    if (!p) return cadastrarCodigo(cod);

    const tipo = document.querySelector('input[name=leitor-tipo]:checked').value;
    const qtd = Number($('leitor-qtd').value);
    const erro = Estoque.validarMovimentacao(tipo, qtd, saldoDe(p.id));
    if (erro) return avisar(`${p.nome}: ${erro}`, 'erro');

    try {
        await Banco.registrarMovimentacao(p.id, tipo, qtd, 'Leitor');
        const novo = saldoDe(p.id) + (tipo === 'entrada' ? qtd : -qtd);
        $('leitor-ultimo').textContent = `${tipo === 'entrada' ? 'Entrada' : 'Saída'} de ${qtd} ${p.nome}. Saldo: ${novo}`;
        avisar(`${p.nome}: saldo ${novo}.`, 'ok');
        $('leitor-qtd').value = 1;
        await carregar();
    } catch (e) {
        avisar(e.message, 'erro');
    }
    campo.focus();
}

// código novo abre o cadastro
function cadastrarCodigo(cod) {
    avisar(`Código ${cod} não cadastrado. Preencha o produto.`, 'erro');
    location.hash = 'produtos';
    abrirTela();
    abrirFormProduto(null);
    $('p-codigo').value = cod;
}

function lancarDireto(tipo, id) {
    document.querySelector(`input[name=tipo][value=${tipo}]`).checked = true;
    trocouTipo();
    $('mov-busca').value = '';
    mostrarListaLancar();
    if (id) $('mov-produto').value = id;
    mostrarSaldoSelecionado();
    location.hash = 'lancar';
    if (id) $('mov-qtd').select(); else $('mov-busca').focus();
}


// lançar entrada / saída

function tipoEscolhido() {
    return document.querySelector('input[name=tipo]:checked').value;
}

function trocouTipo() {
    const entrada = tipoEscolhido() === 'entrada';
    $('mov-salvar').textContent = entrada ? 'Salvar entrada' : 'Salvar saída';
    $('mov-salvar').className = 'btn ' + (entrada ? 'verde' : 'vermelho');
}

function mostrarListaLancar() {
    const termo = $('mov-busca').value.trim().toLowerCase();
    const pelCodigo = produtos.find(p => p.codigo_barras && p.codigo_barras === termo);
    if (pelCodigo) {
        $('mov-produto').innerHTML = `<option value="${pelCodigo.id}">${esc(pelCodigo.nome)} (${saldoDe(pelCodigo.id)})</option>`;
        $('mov-produto').value = pelCodigo.id;
        mostrarSaldoSelecionado();
        return;
    }
    const anterior = Number($('mov-produto').value);
    $('mov-produto').innerHTML = produtos
        .filter(p => p.nome.toLowerCase().includes(termo))
        .map(p => `<option value="${p.id}">${esc(p.nome)} (${saldoDe(p.id)})</option>`)
        .join('');
    if (anterior) $('mov-produto').value = anterior;
    mostrarSaldoSelecionado();
}

function mostrarSaldoSelecionado() {
    const p = produtoPorId(Number($('mov-produto').value));
    $('mov-saldo').textContent = p ? `Saldo atual: ${saldoDe(p.id)}  |  mínimo: ${p.estoque_minimo}` : '';
}

async function salvarMovimentacao(ev) {
    ev.preventDefault();
    const p = produtoPorId(Number($('mov-produto').value));
    if (!p) return avisar('Selecione o produto.', 'erro');

    const tipo = tipoEscolhido();
    const qtd = Number($('mov-qtd').value);
    const erro = Estoque.validarMovimentacao(tipo, qtd, saldoDe(p.id));
    if (erro) return avisar(erro, 'erro');

    $('mov-salvar').disabled = true;
    try {
        await Banco.registrarMovimentacao(p.id, tipo, qtd, $('mov-obs').value.trim());
        const novo = saldoDe(p.id) + (tipo === 'entrada' ? qtd : -qtd);
        if (tipo === 'saida' && Estoque.situacaoEstoque(novo, p.estoque_minimo) !== 'ok') {
            avisar(`Salvo. ${p.nome} ficou com ${novo}, abaixo do mínimo.`, 'erro');
        } else {
            avisar(`Salvo. ${p.nome}: saldo ${novo}.`, 'ok');
        }
        $('mov-qtd').value = 1;
        $('mov-obs').value = '';
        $('mov-busca').value = '';
        $('mov-produto').value = '';
        await carregar();
        $('mov-busca').focus();
    } catch (e) {
        avisar(e.message, 'erro');
    }
    $('mov-salvar').disabled = false;
}

function linhaMov(m) {
    const p = produtoPorId(m.produto_id);
    const obs = m.observacao ? `<span class="obs">${esc(m.observacao)}</span>` : '';
    return `<tr>
        <td>${p ? esc(p.nome) : '(excluído)'}${obs}</td>
        <td class="${m.tipo}-txt">${m.tipo === 'entrada' ? 'Entrada' : 'Saída'}</td>
        <td class="dir">${m.quantidade}</td>
        <td class="dir">${dataCurta(m.criado_em)}</td>
    </tr>`;
}

function mostrarHistorico() {
    const dias = Number($('hist-dias').value);
    const inicio = new Date();
    inicio.setHours(0, 0, 0, 0);
    inicio.setDate(inicio.getDate() - (dias - 1));
    const lista = movimentacoes.filter(m => new Date(m.criado_em) >= inicio).reverse();
    const pagina = paginar('historico', lista, mostrarHistorico);
    $('tab-historico').innerHTML = pagina.length
        ? pagina.map(linhaMov).join('')
        : '<tr><td colspan="4" class="vazio">Nenhuma movimentação no período.</td></tr>';
}


// produtos

function mostrarProdutos() {
    const filtro = $('prod-filtro').value || 'todos';
    $('prod-filtro').innerHTML = '<option value="todos">Todas as categorias</option>'
        + '<option value="repor">Abaixo do mínimo</option>'
        + categorias.map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join('');
    $('prod-filtro').value = [...$('prod-filtro').options].some(o => o.value === filtro) ? filtro : 'todos';

    const termo = $('prod-busca').value.trim().toLowerCase();
    const lista = produtos.filter(p => {
        if (!p.nome.toLowerCase().includes(termo) && (p.codigo_barras || '') !== termo) return false;
        const f = $('prod-filtro').value;
        if (f === 'repor') return Estoque.situacaoEstoque(saldoDe(p.id), p.estoque_minimo) !== 'ok';
        if (f !== 'todos') return String(p.categoria_id) === f;
        return true;
    });

    const pagina = paginar('produtos', lista, mostrarProdutos);
    $('tab-produtos').innerHTML = pagina.length
        ? pagina.map(p => {
            const saldo = saldoDe(p.id);
            return `<tr class="${Estoque.situacaoEstoque(saldo, p.estoque_minimo)}">
                <td>${esc(p.nome)}</td>
                <td class="some-cel">${esc(nomeCategoria(p.categoria_id))}</td>
                <td class="dir">${saldo}</td>
                <td class="dir">${p.estoque_minimo}</td>
                <td class="dir some-cel">${dinheiro(p.custo)}</td>
                <td class="dir some-cel">${dinheiro(p.preco_venda)}</td>
                <td class="dir">
                    <button class="btn" onclick="editarProduto(${p.id})">Editar</button>
                    <button class="btn" onclick="excluirProduto(${p.id})">Excluir</button>
                </td>
            </tr>`;
        }).join('')
        : '<tr><td colspan="7" class="vazio">Nenhum produto.</td></tr>';
}

function abrirFormProduto(p) {
    $('p-categoria').innerHTML = '<option value="">Sem categoria</option>'
        + categorias.map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join('');
    $('p-id').value = p ? p.id : '';
    $('p-nome').value = p ? p.nome : '';
    $('p-codigo').value = p && p.codigo_barras ? p.codigo_barras : '';
    $('p-categoria').value = p && p.categoria_id ? p.categoria_id : '';
    $('p-custo').value = p ? p.custo : '';
    $('p-venda').value = p ? p.preco_venda : '';
    $('p-minimo').value = p ? p.estoque_minimo : '';
    // estoque inicial so no cadastro
    $('p-inicial').value = 0;
    $('p-inicial-campo').classList.toggle('escondido', !!p);
    $('form-produto').classList.remove('escondido');
    $('p-nome').focus();
}

function fecharFormProduto() {
    $('form-produto').classList.add('escondido');
}

function editarProduto(id) {
    abrirFormProduto(produtoPorId(id));
}

async function salvarProduto(ev) {
    ev.preventDefault();
    const id = Number($('p-id').value) || null;
    const dados = {
        id,
        nome: $('p-nome').value.trim(),
        codigo_barras: $('p-codigo').value.trim(),
        categoria_id: Number($('p-categoria').value) || null,
        custo: Number($('p-custo').value),
        preco_venda: Number($('p-venda').value),
        estoque_minimo: parseInt($('p-minimo').value, 10)
    };
    const repetido = produtos.some(p => p.id !== id && p.nome.toLowerCase() === dados.nome.toLowerCase());
    if (repetido) return avisar('Já existe um produto com esse nome.', 'erro');
    const outro = dados.codigo_barras && produtos.find(p => p.id !== id && p.codigo_barras === dados.codigo_barras);
    if (outro) return avisar(`Esse código já é do produto ${outro.nome}.`, 'erro');

    const inicial = id ? 0 : Number($('p-inicial').value) || 0;
    if (!Number.isInteger(inicial) || inicial < 0) return avisar('Estoque inicial inválido.', 'erro');

    try {
        const novoId = await Banco.salvarProduto(dados);
        // estoque inicial entra como entrada
        if (inicial > 0) await Banco.registrarMovimentacao(novoId, 'entrada', inicial, 'Estoque inicial');
        fecharFormProduto();
        avisar(id ? 'Produto alterado.' : 'Produto cadastrado.', 'ok');
        await carregar();
    } catch (e) {
        avisar(e.message, 'erro');
    }
}

async function excluirProduto(id) {
    const p = produtoPorId(id);
    const pin = await pedirPin(`Excluir ${p.nome}? O histórico de movimentações continua salvo.`);
    if (pin === null) return;
    try {
        await Banco.excluirProduto(pin, id);
        avisar('Produto excluído.', 'ok');
        await carregar();
    } catch (e) {
        avisar(e.message, 'erro');
    }
}


// categorias

function mostrarCategorias() {
    $('tab-categorias').innerHTML = categorias.length
        ? categorias.map(c => {
            const qtd = produtos.filter(p => p.categoria_id === c.id).length;
            return `<tr>
                <td>${esc(c.nome)}</td>
                <td class="dir">${qtd} produto(s)</td>
                <td class="dir"><button class="btn" onclick="excluirCategoria(${c.id})">Excluir</button></td>
            </tr>`;
        }).join('')
        : '<tr><td class="vazio">Nenhuma categoria.</td></tr>';
}

async function salvarCategoria(ev) {
    ev.preventDefault();
    const nome = $('cat-nome').value.trim();
    if (categorias.some(c => c.nome.toLowerCase() === nome.toLowerCase())) {
        return avisar('Essa categoria já existe.', 'erro');
    }
    const pin = await pedirPin(`Adicionar a categoria ${nome}?`);
    if (pin === null) return;
    try {
        await Banco.salvarCategoria(pin, nome);
        $('cat-nome').value = '';
        avisar('Categoria adicionada.', 'ok');
        await carregar();
    } catch (e) {
        avisar(e.message, 'erro');
    }
}

async function excluirCategoria(id) {
    const c = categorias.find(x => x.id === id);
    const pin = await pedirPin(`Excluir a categoria ${c.nome}? Os produtos dela ficam sem categoria.`);
    if (pin === null) return;
    try {
        await Banco.excluirCategoria(pin, id);
        avisar('Categoria excluída.', 'ok');
        await carregar();
    } catch (e) {
        avisar(e.message, 'erro');
    }
}


// relatório

let filtroGiro = 'todos';

const quandoSaiu = dias => dias === null ? 'nunca' : dias === 0 ? 'hoje' : dias === 1 ? 'ontem' : `há ${dias} dias`;

function mostrarRelatorio() {
    const dias = Number($('abc-dias').value);
    const { linhas, total } = Estoque.curvaABC(produtos, movimentacoes, dias);
    const inicio = new Date(Date.now() - dias * 86400000);
    $('abc-periodo').textContent = `De ${inicio.toLocaleDateString('pt-BR')} até hoje`;

    // resumo por classe
    const resumoClasse = c => {
        const da = linhas.filter(l => l.classe === c && !l.parado);
        const valor = da.reduce((t, l) => t + l.valorVendido, 0);
        const pct = total > 0 ? Math.round(valor / total * 100) : 0;
        return `${da.length} produtos <small>${pct}% do valor</small>`;
    };
    const parados = linhas.filter(l => l.parado);
    const valorParado = parados.reduce((t, l) => t + Math.max(0, l.capitalParado), 0);
    $('g-total').textContent = dinheiro(total);
    $('g-a').innerHTML = resumoClasse('A');
    $('g-b').innerHTML = resumoClasse('B');
    $('g-c').innerHTML = resumoClasse('C');
    $('g-parados').innerHTML = `${parados.length} produtos <small>${dinheiro(valorParado)} em estoque</small>`;

    const termo = $('giro-busca').value.trim().toLowerCase();
    const lista = linhas.filter(l => {
        if (!l.nome.toLowerCase().includes(termo)) return false;
        if (filtroGiro === 'parado') return l.parado;
        if (filtroGiro !== 'todos') return l.classe === filtroGiro && !l.parado;
        return true;
    });

    const maior = Math.max(...linhas.map(l => l.percentual), 0.0001);
    const pagina = paginar('giro', lista, mostrarRelatorio);
    $('tab-giro').innerHTML = pagina.length
        ? pagina.map(l => `<tr>
            <td>${l.parado
                ? '<span class="etiqueta parado">Parado</span>'
                : `<span class="etiqueta classe-${l.classe}">${l.classe}</span>`}</td>
            <td>${esc(l.nome)}</td>
            <td class="dir some-cel">${l.qtdVendida}</td>
            <td class="dir">${dinheiro(l.valorVendido)}</td>
            <td class="some-cel"><span class="barra-pct"><i style="width:${l.percentual / maior * 100}%"></i></span>${(l.percentual * 100).toFixed(1)}%</td>
            <td class="dir">${l.saldo}</td>
            <td class="dir some-cel">${quandoSaiu(l.diasSemSaida)}</td>
        </tr>`).join('')
        : '<tr><td colspan="7" class="vazio">Nenhum produto.</td></tr>';
}

function filtrarGiro(ev) {
    const botao = ev.target.closest('button');
    if (!botao) return;
    filtroGiro = botao.dataset.filtro;
    primeiraPagina('giro');
    document.querySelectorAll('#giro-abas button').forEach(b => b.classList.toggle('ativo', b === botao));
    mostrarRelatorio();
}


// PIN

function pedirPin(texto) {
    const dlg = $('dlg-pin');
    $('dlg-texto').textContent = texto;
    $('dlg-pin-campo').value = '';
    dlg.returnValue = '';
    dlg.showModal();

    return new Promise(resolve => {
        $('form-pin').onsubmit = async ev => {
            ev.preventDefault();
            const pin = $('dlg-pin-campo').value;
            try {
                if (await Banco.verificarPin(pin)) {
                    dlg.close('ok');
                    return resolve(pin);
                }
                avisar('PIN incorreto.', 'erro');
                $('dlg-pin-campo').select();
            } catch (e) {
                avisar(e.message, 'erro');
            }
        };
        dlg.onclose = () => { if (dlg.returnValue !== 'ok') resolve(null); };
    });
}


// início

$('form-mov').addEventListener('submit', salvarMovimentacao);
document.querySelectorAll('input[name=tipo]').forEach(r => r.addEventListener('change', trocouTipo));
$('mov-busca').addEventListener('input', mostrarListaLancar);
$('mov-busca').addEventListener('keydown', ev => {
    if (ev.key === 'Enter') { ev.preventDefault(); $('mov-qtd').select(); }
});
$('mov-produto').addEventListener('change', mostrarSaldoSelecionado);
$('hist-dias').addEventListener('change', () => { primeiraPagina('historico'); mostrarHistorico(); });

$('btn-novo').addEventListener('click', () => abrirFormProduto(null));
$('p-cancelar').addEventListener('click', fecharFormProduto);
$('form-produto').addEventListener('submit', salvarProduto);
$('prod-busca').addEventListener('input', () => { primeiraPagina('produtos'); mostrarProdutos(); });
$('prod-filtro').addEventListener('change', () => { primeiraPagina('produtos'); mostrarProdutos(); });
$('form-categoria').addEventListener('submit', salvarCategoria);

$('abc-dias').addEventListener('change', () => { primeiraPagina('giro'); mostrarRelatorio(); });
$('giro-abas').addEventListener('click', filtrarGiro);
$('giro-busca').addEventListener('input', () => { primeiraPagina('giro'); mostrarRelatorio(); });
$('pos-abas').addEventListener('click', filtrarPainel);
$('form-leitor').addEventListener('submit', ev => ev.preventDefault());
$('leitor-codigo').addEventListener('keydown', ev => { if (ev.key === 'Enter') lerCodigo(ev); });
$('p-codigo').addEventListener('keydown', ev => {
    if (ev.key === 'Enter') { ev.preventDefault(); $('p-custo').focus(); }
});
$('pos-busca').addEventListener('input', () => { primeiraPagina('posicao'); mostrarPainel(); });

// imprime a lista inteira
let tamanhoAntes;
window.addEventListener('beforeprint', () => {
    tamanhoAntes = paginas.giro.tamanho;
    paginas.giro.tamanho = 0;
    mostrarRelatorio();
});
window.addEventListener('afterprint', () => {
    paginas.giro.tamanho = tamanhoAntes;
    mostrarRelatorio();
});

trocouTipo();
abrirTela();
carregar();
