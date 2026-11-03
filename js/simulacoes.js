/**
 * Módulo de Andamento das Simulações
 * Carrega e decifra conteudo/simulacoes.json em memória
 */
const Simulacoes = (() => {
  function escapeHtml(texto) {
    if (texto === null || texto === undefined) return '';
    return String(texto)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function carregar() {
    const container = document.getElementById('painel-simulacoes-conteudo');
    if (!container) return;

    if (!Auth.estaAutenticado()) {
      container.innerHTML = '<div class="vazio">🔒 Faça login para visualizar o andamento das simulações.</div>';
      return;
    }

    container.innerHTML = '<p style="color: #607080;">Decifrando dados das simulações...</p>';

    try {
      const itens = await Auth.decifrarArquivoJSON('simulacoes.json');
      renderizar(itens || [], container);
    } catch (err) {
      container.innerHTML = `<div class="figura-erro">Erro ao carregar simulações: ${escapeHtml(err.message)}</div>`;
    }
  }

  function renderizar(itens, container) {
    if (!itens || itens.length === 0) {
      container.innerHTML = `
        <div class="vazio">
          <h3 style="margin-top:0; color: #17324d;">Nenhuma simulação registrada ainda</h3>
          <p>O andamento e os parâmetros das rodadas computacionais aparecerão aqui assim que forem adicionados pelo aluno em <code>conteudo/simulacoes.json</code> e o build for executado.</p>
        </div>
      `;
      return;
    }

    const total = itens.length;
    const concluidas = itens.filter(i => i.status === 'concluido').length;
    const emAndamento = itens.filter(i => i.status === 'em_andamento').length;
    const planejadas = itens.filter(i => i.status === 'planejado').length;

    const cardsHtml = `
      <div class="resumo-metricas">
        <div class="metrica-card">
          <div class="num">${total}</div>
          <div class="rotulo">Total de Rodadas</div>
        </div>
        <div class="metrica-card">
          <div class="num" style="color: #276749;">${concluidas}</div>
          <div class="rotulo">Concluídas</div>
        </div>
        <div class="metrica-card">
          <div class="num" style="color: #2b6cb0;">${emAndamento}</div>
          <div class="rotulo">Em Andamento</div>
        </div>
        <div class="metrica-card">
          <div class="num" style="color: #4a5568;">${planejadas}</div>
          <div class="rotulo">Planejadas</div>
        </div>
      </div>
    `;

    const linhasHtml = itens.map(item => {
      const statusKey = ['concluido', 'em_andamento', 'planejado', 'erro'].includes(item.status) ? item.status : 'planejado';
      const badgeClasse = `badge badge-${statusKey}`;
      const rotuloStatus = {
        'concluido': 'Concluído',
        'em_andamento': 'Em Andamento',
        'planejado': 'Planejado',
        'erro': 'Erro'
      }[statusKey] || statusKey;

      const progressoNum = Math.min(100, Math.max(0, Number(item.progresso) || 0));

      const params = Object.entries(item.parametros || {})
        .map(([k, v]) => `<strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}`)
        .join(' &nbsp;|&nbsp; ');

      return `
        <tr>
          <td><strong>${escapeHtml(item.id)}</strong></td>
          <td>
            <div style="font-weight: 600; color: #17324d;">${escapeHtml(item.titulo)}</div>
            <div style="font-size: 0.85rem; color: #718096; margin-top: 2px;">${escapeHtml(item.resumo || '')}</div>
          </td>
          <td>
            <span class="${badgeClasse}">${rotuloStatus}</span>
            <div class="barra-progresso" title="${progressoNum}%">
              <div class="barra-progresso-preenchimento" style="width: ${progressoNum}%;"></div>
            </div>
            <span style="font-size: 0.75rem; color: #718096;">${progressoNum}%</span>
          </td>
          <td><span style="font-size: 0.88rem; background: #edf2f7; padding: 2px 6px; border-radius: 4px;">${escapeHtml(item.maquina || '—')}</span></td>
          <td style="font-size: 0.88rem;">${params || '—'}</td>
          <td style="font-size: 0.82rem; color: #4a5568;">
            <div><strong>Início:</strong> ${escapeHtml(item.inicio || '—')}</div>
            <div><strong>Fim:</strong> ${escapeHtml(item.fim || '—')}</div>
          </td>
        </tr>
      `;
    }).join('');

    const tabelaHtml = `
      <div class="tabela-container">
        <table class="tabela-sim">
          <thead>
            <tr>
              <th>ID</th>
              <th>Simulação / Descrição</th>
              <th>Status & Progresso</th>
              <th>Máquina / Nó</th>
              <th>Parâmetros Chave</th>
              <th>Datas</th>
            </tr>
          </thead>
          <tbody>
            ${linhasHtml}
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = cardsHtml + tabelaHtml;
  }

  return { carregar };
})();
