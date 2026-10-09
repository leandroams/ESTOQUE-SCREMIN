let timerAviso;
function avisar(texto, tipo = '') {
    const el = document.getElementById('aviso');
    el.textContent = texto;
    el.className = tipo;
    el.style.display = 'block';
    clearTimeout(timerAviso);
    timerAviso = setTimeout(() => { el.style.display = 'none'; }, 3500);
}

function dinheiro(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function dataCurta(iso) {
    const d = new Date(iso);
    const dois = n => String(n).padStart(2, '0');
    return `${dois(d.getDate())}/${dois(d.getMonth() + 1)} ${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

function esc(texto) {
    return String(texto ?? '').replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}


// paginação

const TAMANHOS = [10, 20, 50, 0];   // 0 = todos
const paginas = {};

function paginar(nome, lista, redesenhar) {
    if (!paginas[nome]) paginas[nome] = { atual: 1, tamanho: 20 };
    const pg = paginas[nome];
    pg.redesenhar = redesenhar;

    const totalPaginas = pg.tamanho ? Math.max(1, Math.ceil(lista.length / pg.tamanho)) : 1;
    if (pg.atual > totalPaginas) pg.atual = totalPaginas;
    const inicio = pg.tamanho ? (pg.atual - 1) * pg.tamanho : 0;
    const parte = pg.tamanho ? lista.slice(inicio, inicio + pg.tamanho) : lista;

    const opcoes = TAMANHOS.map(t =>
        `<option value="${t}" ${t === pg.tamanho ? 'selected' : ''}>${t || 'Todos'}</option>`).join('');
    const de = lista.length ? inicio + 1 : 0;
    document.getElementById('pag-' + nome).innerHTML = `
        <label>Mostrar <select onchange="mudarTamanho('${nome}', this.value)">${opcoes}</select></label>
        <span>${de}-${inicio + parte.length} de ${lista.length}</span>
        <button type="button" class="btn" onclick="mudarPagina('${nome}', -1)" ${pg.atual <= 1 ? 'disabled' : ''}>Anterior</button>
        <button type="button" class="btn" onclick="mudarPagina('${nome}', 1)" ${pg.atual >= totalPaginas ? 'disabled' : ''}>Próxima</button>`;
    return parte;
}

function mudarPagina(nome, passo) {
    paginas[nome].atual += passo;
    paginas[nome].redesenhar();
}

function mudarTamanho(nome, tamanho) {
    paginas[nome].tamanho = Number(tamanho);
    paginas[nome].atual = 1;
    paginas[nome].redesenhar();
}

function primeiraPagina(nome) {
    if (paginas[nome]) paginas[nome].atual = 1;
}
