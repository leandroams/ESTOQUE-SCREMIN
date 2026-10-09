// Dados do Supabase (Project Settings > API)
const SUPABASE_URL = 'https://xbndasacccfrczejngia.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Ut9gCk4Lp5P0ig_AHRBRGw__5jGnqEE';


// mostra uma mensagem rápida no rodapé da tela
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

// 2026-10-09T14:32:00Z -> 09/10 11:32
function dataCurta(iso) {
    const d = new Date(iso);
    const dois = n => String(n).padStart(2, '0');
    return `${dois(d.getDate())}/${dois(d.getMonth() + 1)} ${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

// evita que um nome com < ou & quebre o html da tabela
function esc(texto) {
    return String(texto ?? '').replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
