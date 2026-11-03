/**
 * Módulo de Relatórios Periódicos
 * Decifra relatorios.json e arquivos .md em memória
 */
const Relatorios = (() => {
  let relatoriosCache = [];

  function escapeHtml(texto) {
    if (!texto) return '';
    return String(texto)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Parser Markdown seguro e autocontido
  function parseMarkdown(md) {
    if (!md) return '';
    // Escapa HTML bruto primeiro para prevenir injeções
    let safe = escapeHtml(md);

    // Converte sintaxe Markdown suportada
    let html = safe
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^---$/gim, '<hr>')
      .replace(/\*\*\*(.*?)\*\*\*/gim, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>')
      .replace(/`([^`]+)`/gim, '<code>$1</code>')
      .replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>')
      .replace(/^\s*\d+\.\s+(.*$)/gim, '<li>$1</li>')
      .replace(/^\&gt; (.*$)/gim, '<blockquote>$1</blockquote>');

    // Agrupa <li>
    html = html.replace(/(<li>.*?<\/li>(\n| )*)+/gim, '<ul>$&</ul>');

    // Parágrafos
    return html.split('\n\n').map(p => {
      p = p.trim();
      if (!p) return '';
      if (/^<(h1|h2|h3|ul|ol|pre|blockquote|hr)/.test(p)) return p;
      return `<p>${p.replace(/\n/g, '<br>')}</p>`;
    }).join('\n');
  }

  async function carregar() {
    const listaEl = document.getElementById('lista-relatorios');
    const visualizadorEl = document.getElementById('visualizador-relatorio-conteudo');
    if (!listaEl || !visualizadorEl) return;

    if (!Auth.estaAutenticado()) {
      visualizadorEl.innerHTML = '<div class="vazio">🔒 Faça login para visualizar os relatórios.</div>';
      return;
    }

    visualizadorEl.innerHTML = '<p style="color: #607080;">Carregando índice de relatórios...</p>';

    try {
      relatoriosCache = await Auth.decifrarArquivoJSON('relatorios.json');
      if (!relatoriosCache || relatoriosCache.length === 0) {
        listaEl.innerHTML = '<li style="padding: 10px; color: #718096; font-size: 0.88rem;">Nenhum relatório cadastrado.</li>';
        visualizadorEl.innerHTML = `
          <div class="vazio">
            <h3 style="margin-top:0; color: #17324d;">Nenhum relatório publicado ainda</h3>
            <p>Os relatórios periódicos para a orientadora (em formato Markdown) aparecerão aqui assim que forem adicionados pelo aluno em <code>conteudo/relatorios/</code> e o build for executado.</p>
          </div>
        `;
        return;
      }

      renderizarIndice(relatoriosCache, listaEl);
      abrirRelatorio(relatoriosCache[0].id);
    } catch (err) {
      listaEl.innerHTML = `<li style="color: #c53030;">Erro ao carregar índice</li>`;
      visualizadorEl.innerHTML = `<div class="figura-erro">Erro ao carregar relatórios: ${escapeHtml(err.message)}</div>`;
    }
  }

  function renderizarIndice(relatorios, listaEl) {
    listaEl.innerHTML = relatorios.map(rel => `
      <li>
        <button class="item-relatorio-btn" id="btn-rel-${escapeHtml(rel.id)}" onclick="Relatorios.abrirRelatorio('${escapeHtml(rel.id)}')">
          <div class="data">${escapeHtml(rel.data || '')}</div>
          <div class="titulo">${escapeHtml(rel.titulo || 'Sem título')}</div>
        </button>
      </li>
    `).join('');
  }

  async function abrirRelatorio(id) {
    const visualizadorEl = document.getElementById('visualizador-relatorio-conteudo');
    const item = relatoriosCache.find(r => r.id === id);
    if (!item || !visualizadorEl) return;

    document.querySelectorAll('.item-relatorio-btn').forEach(b => b.classList.remove('ativo'));
    const btnAtivo = document.getElementById(`btn-rel-${id}`);
    if (btnAtivo) btnAtivo.classList.add('ativo');

    visualizadorEl.innerHTML = '<p style="color: #607080;">Decifrando relatório...</p>';

    try {
      const textoMarkdown = await Auth.decifrarArquivoTexto(item.arquivo);
      const conteudoHtml = parseMarkdown(textoMarkdown);
      visualizadorEl.innerHTML = conteudoHtml;
    } catch (err) {
      visualizadorEl.innerHTML = `<div class="figura-erro">Não foi possível decifrar este relatório.<br><small>${escapeHtml(err.message)}</small></div>`;
    }
  }

  return {
    carregar,
    abrirRelatorio
  };
})();
