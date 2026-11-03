/**
 * Módulo de Painel de Resultados (Estilo artigoNRK com decifração de Blob URLs)
 */
const Resultados = (() => {
  let config = null;

  function escapeHtml(texto) {
    if (!texto) return '';
    return String(texto)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function carregar() {
    const container = document.getElementById('controles-resultados');
    const galeria = document.getElementById('galeria-resultados');
    if (!container || !galeria) return;

    if (!Auth.estaAutenticado()) {
      galeria.innerHTML = '<div class="vazio">🔒 Faça login para visualizar os resultados e comparar figuras.</div>';
      return;
    }

    try {
      config = await Auth.decifrarArquivoJSON('configuracao_resultados.json');
      montarControles(config);
    } catch (err) {
      galeria.innerHTML = `<div class="figura-erro">Erro ao carregar configurações de resultados: ${escapeHtml(err.message)}</div>`;
    }
  }

  function montarControles(cfg) {
    const elConjunto = document.getElementById('sel-conjunto');
    const elTipo = document.getElementById('sel-tipo');
    const elT = document.getElementById('sel-param-t');
    const elI = document.getElementById('sel-param-i');
    const btnAdd = document.getElementById('btn-add-comparacao');
    const btnLimpar = document.getElementById('btn-limpar-comparacao');
    const galeria = document.getElementById('galeria-resultados');

    if (!elConjunto || !elTipo || !elT || !elI) return;

    const temParametros = (cfg.parametros?.T?.length > 0) || (cfg.parametros?.I?.length > 0);

    // Popula Conjuntos
    elConjunto.innerHTML = (cfg.conjuntos || []).map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.nome)}</option>`).join('');

    // Popula Tipos
    elTipo.innerHTML = (cfg.tipos || []).map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.nome)}</option>`).join('');

    // Popula Parâmetros
    if (cfg.parametros?.T && cfg.parametros.T.length > 0) {
      elT.innerHTML = cfg.parametros.T.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
    } else {
      elT.innerHTML = '<option value="">(Nenhum T cadastrado)</option>';
    }

    if (cfg.parametros?.I && cfg.parametros.I.length > 0) {
      elI.innerHTML = cfg.parametros.I.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
    } else {
      elI.innerHTML = '<option value="">(Nenhum I cadastrado)</option>';
    }

    function atualizarVisibilidade() {
      const tipoSel = cfg.tipos?.find(t => t.id === elTipo.value);
      if (!tipoSel) return;

      const dependeDe = tipoSel.depende_de || [];
      const labelT = elT.closest('label');
      const labelI = elI.closest('label');

      if (labelT) labelT.hidden = !dependeDe.includes('T');
      if (labelI) labelI.hidden = !dependeDe.includes('I');
    }

    elTipo.onchange = atualizarVisibilidade;
    atualizarVisibilidade();

    if (!temParametros) {
      galeria.innerHTML = `
        <div class="vazio">
          <h3 style="margin-top:0; color: #17324d;">Nenhuma figura cadastrada ainda</h3>
          <p>Assim que os parâmetros (T e I) forem definidos em <code>conteudo/configuracao_resultados.json</code> e as figuras forem geradas em <code>conteudo/figuras/</code>, o seletor acima permitirá compará-las lado a lado.</p>
        </div>
      `;
    } else {
      restaurarVazio();
    }

    btnAdd.onclick = adicionarCard;
    btnLimpar.onclick = () => {
      galeria.replaceChildren();
      restaurarVazio();
    };
  }

  function obterItemSelecionado() {
    if (!config) return null;
    const elConjunto = document.getElementById('sel-conjunto');
    const elTipo = document.getElementById('sel-tipo');
    const elT = document.getElementById('sel-param-t');
    const elI = document.getElementById('sel-param-i');

    const conjuntoObj = config.conjuntos?.find(c => c.id === elConjunto.value) || { id: 'principal', nome: 'Principal', prefixo: '' };
    const tipoObj = config.tipos?.find(t => t.id === elTipo.value) || { id: 'padrao', nome: 'Padrão', formato: '{prefixo}{tipo}.png' };
    const valorT = elT.value;
    const valorI = elI.value;

    let caminho = (tipoObj.formato || '')
      .replace('{prefixo}', conjuntoObj.prefixo || '')
      .replace('{conjunto}', conjuntoObj.id)
      .replace('{I}', valorI)
      .replace('{T}', valorT);

    const partesTitulo = [conjuntoObj.nome, tipoObj.nome];
    if (tipoObj.depende_de?.includes('T') && valorT) partesTitulo.push(`T=${valorT}`);
    if (tipoObj.depende_de?.includes('I') && valorI) partesTitulo.push(`I=${valorI}`);

    return {
      titulo: partesTitulo.join(' — '),
      caminhoRelativo: `figuras/${caminho}`
    };
  }

  function restaurarVazio() {
    const galeria = document.getElementById('galeria-resultados');
    if (!galeria.querySelector('.cartao')) {
      galeria.innerHTML = '<div class="vazio">Escolha os parâmetros nos seletores acima e clique em "+ Adicionar à comparação" para comparar as figuras lado a lado.</div>';
    }
  }

  async function adicionarCard() {
    const item = obterItemSelecionado();
    if (!item) return;

    const galeria = document.getElementById('galeria-resultados');
    const vazioEl = galeria.querySelector('.vazio');
    if (vazioEl) vazioEl.remove();

    if (galeria.querySelector(`[data-arquivo="${item.caminhoRelativo}"]`)) {
      alert('Esta figura já está na galeria de comparação.');
      return;
    }

    const card = document.createElement('article');
    card.className = 'cartao';
    card.dataset.arquivo = item.caminhoRelativo;

    const h2 = document.createElement('h2');
    h2.textContent = item.titulo;

    const placeholder = document.createElement('div');
    placeholder.style.padding = '40px 20px';
    placeholder.style.color = '#718096';
    placeholder.textContent = 'Decifrando figura...';
    card.append(h2, placeholder);
    galeria.append(card);

    try {
      const blobUrl = await Auth.obterBlobUrlFigura(item.caminhoRelativo);
      const img = document.createElement('img');
      img.src = blobUrl;
      img.alt = item.titulo;
      img.loading = 'lazy';

      const acoes = document.createElement('div');
      acoes.className = 'acoes';

      const linkAbrir = document.createElement('a');
      linkAbrir.href = blobUrl;
      linkAbrir.target = '_blank';
      linkAbrir.textContent = 'Abrir imagem cheia';

      const btnRemover = document.createElement('button');
      btnRemover.type = 'button';
      btnRemover.textContent = 'Remover';
      btnRemover.onclick = () => {
        card.remove();
        restaurarVazio();
      };

      acoes.append(linkAbrir, btnRemover);
      placeholder.replaceWith(img);
      card.append(acoes);
    } catch (err) {
      const errBox = document.createElement('div');
      errBox.className = 'figura-erro';
      errBox.innerHTML = `<strong>Figura não disponível</strong><br><small style="color:#718096">${escapeHtml(item.caminhoRelativo)}</small>`;

      const btnRemover = document.createElement('button');
      btnRemover.type = 'button';
      btnRemover.style.marginTop = '10px';
      btnRemover.textContent = 'Remover';
      btnRemover.onclick = () => {
        card.remove();
        restaurarVazio();
      };

      placeholder.replaceWith(errBox);
      card.append(btnRemover);
    }
  }

  return {
    carregar,
    adicionarCard
  };
})();
