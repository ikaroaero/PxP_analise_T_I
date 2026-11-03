/**
 * Módulo de Discussão (Aluno & Orientadora) via Supabase
 * Mensagens são criptografadas com AES-256-GCM no cliente antes do envio.
 * Mensagens não autenticadas ou adulteradas (lixo) são descartadas do mural.
 */
const Discussao = (() => {
  const STORAGE_RASCUNHO = 'pxp_portal_rascunho_discussao';

  function escapeHtml(texto) {
    if (!texto) return '';
    return String(texto)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatarData(isoStr) {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoStr;
    }
  }

  function estaSupabaseConfigurado() {
    return typeof CONFIG_PORTAL !== 'undefined' &&
      CONFIG_PORTAL.supabase &&
      Boolean(CONFIG_PORTAL.supabase.url) &&
      Boolean(CONFIG_PORTAL.supabase.anonKey);
  }

  async function buscarMensagensRemotas() {
    const url = `${CONFIG_PORTAL.supabase.url}/rest/v1/mensagens?select=id,criado_em,autor,iv,texto_cifrado&order=criado_em.asc`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': CONFIG_PORTAL.supabase.anonKey,
        'Authorization': `Bearer ${CONFIG_PORTAL.supabase.anonKey}`,
        'Accept': 'application/json'
      }
    });

    if (!resp.ok) {
      const errTexto = await resp.text();
      throw new Error(`Falha ao buscar mensagens do Supabase (${resp.status}): ${errTexto}`);
    }

    return await resp.json();
  }

  async function enviarMensagemRemota(autor, iv, textoCifrado) {
    const url = `${CONFIG_PORTAL.supabase.url}/rest/v1/mensagens`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': CONFIG_PORTAL.supabase.anonKey,
        'Authorization': `Bearer ${CONFIG_PORTAL.supabase.anonKey}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        autor,
        iv,
        texto_cifrado: textoCifrado
      })
    });

    if (!resp.ok) {
      const errTexto = await resp.text();
      throw new Error(`Falha ao registrar mensagem no Supabase (${resp.status}): ${errTexto}`);
    }
    return await resp.json();
  }

  async function carregar() {
    const muralEl = document.getElementById('mural-mensagens');
    const avisoConfigEl = document.getElementById('aviso-config-supabase');
    if (!muralEl) return;

    if (!Auth.estaAutenticado()) {
      muralEl.innerHTML = '<div class="vazio">🔒 Faça login no portal para acessar o mural de discussões criptografado.</div>';
      return;
    }

    // Alerta de configuração pendente
    if (!estaSupabaseConfigurado()) {
      if (avisoConfigEl) {
        avisoConfigEl.style.display = 'block';
        avisoConfigEl.innerHTML = `
          <strong>⚙️ Supabase não configurado:</strong>
          As credenciais do Supabase ainda não foram preenchidas em <code>js/config.js</code>.
          O mural operará apenas em modo de teste local (rascunho). Consulte as instruções no <code>README.md</code>.
        `;
      }
      carregarRascunhosLocais(muralEl);
      configurarFormulario();
      return;
    } else {
      if (avisoConfigEl) avisoConfigEl.style.display = 'none';
    }

    muralEl.innerHTML = '<p style="color: #607080;">Sincronizando e decifrando mensagens...</p>';

    try {
      const msgs = await buscarMensagensRemotas();
      await renderizarMensagens(msgs, muralEl);
    } catch (err) {
      muralEl.innerHTML = `<div class="figura-erro">Erro na comunicação com o Supabase: ${escapeHtml(err.message)}</div>`;
    }

    configurarFormulario();
  }

  async function renderizarMensagens(lista, muralEl) {
    muralEl.replaceChildren();

    let mensagensValidas = 0;

    for (const m of (lista || [])) {
      // 3. Oculta mensagens lixo ou de terceiros que não decifrarem com a chave do portal
      const textoPlano = await Auth.decifrarTexto(m.iv, m.texto_cifrado);
      if (!textoPlano) {
        continue;
      }

      mensagensValidas++;
      const autorTipo = (m.autor === 'orientadora') ? 'orientadora' : 'aluno';
      const autorRotulo = (autorTipo === 'orientadora') ? 'Orientadora' : 'Aluno';

      const art = document.createElement('article');
      art.className = `mensagem-item ${autorTipo}`;

      const header = document.createElement('div');
      header.className = 'mensagem-header';

      const spanAutor = document.createElement('span');
      spanAutor.className = 'mensagem-autor';
      spanAutor.textContent = autorRotulo;

      const spanData = document.createElement('span');
      spanData.className = 'mensagem-data';
      spanData.textContent = formatarData(m.criado_em);

      header.append(spanAutor, spanData);

      const corpo = document.createElement('div');
      corpo.className = 'mensagem-corpo';
      corpo.textContent = textoPlano; // Seguro contra XSS, conteúdo puro

      art.append(header, corpo);
      muralEl.append(art);
    }

    if (mensagensValidas === 0) {
      const vazio = document.createElement('div');
      vazio.className = 'vazio';
      vazio.innerHTML = `
        <h3 style="margin-top:0; color: #17324d;">Nenhuma mensagem registrada ainda</h3>
        <p>Utilize o formulário abaixo para enviar recados, dúvidas ou anotações para a orientadora. Todo o texto é criptografado no seu navegador antes do envio.</p>
      `;
      muralEl.append(vazio);
      return;
    }

    muralEl.scrollTop = muralEl.scrollHeight;
  }

  function carregarRascunhosLocais(muralEl) {
    const raw = localStorage.getItem(STORAGE_RASCUNHO);
    let lista = [];
    if (raw) {
      try { lista = JSON.parse(raw); } catch { lista = []; }
    }
    renderizarMensagens(lista, muralEl);
  }

  function configurarFormulario() {
    const form = document.getElementById('form-discussao');
    const txtArea = document.getElementById('discussao-texto');
    const selAutor = document.getElementById('discussao-autor');
    if (!form || form.dataset.configurado) return;
    form.dataset.configurado = 'true';

    // Restaura rascunho de digitação se houver
    const rascunhoSalvo = localStorage.getItem('pxp_rascunho_digitacao');
    if (rascunhoSalvo && txtArea) txtArea.value = rascunhoSalvo;

    if (txtArea) {
      txtArea.addEventListener('input', () => {
        localStorage.setItem('pxp_rascunho_digitacao', txtArea.value);
      });
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const texto = txtArea.value.trim();
      if (!texto) return;

      if (texto.length > 3000) {
        alert('A mensagem não pode ultrapassar 3000 caracteres.');
        return;
      }

      const autor = selAutor.value === 'orientadora' ? 'orientadora' : 'aluno';
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Criptografando e enviando...';
      }

      try {
        const { iv, texto_cifrado } = await Auth.cifrarTexto(texto);

        if (estaSupabaseConfigurado()) {
          await enviarMensagemRemota(autor, iv, texto_cifrado);
          txtArea.value = '';
          localStorage.removeItem('pxp_rascunho_digitacao');
          await carregar();
        } else {
          // Modo local/offline fallback
          const raw = localStorage.getItem(STORAGE_RASCUNHO);
          let lista = raw ? JSON.parse(raw) : [];
          lista.push({
            id: Date.now(),
            criado_em: new Date().toISOString(),
            autor,
            iv,
            texto_cifrado
          });
          localStorage.setItem(STORAGE_RASCUNHO, JSON.stringify(lista));
          txtArea.value = '';
          localStorage.removeItem('pxp_rascunho_digitacao');
          const muralEl = document.getElementById('mural-mensagens');
          await renderizarMensagens(lista, muralEl);
        }
      } catch (err) {
        alert(`Erro ao enviar mensagem: ${err.message}`);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Enviar Mensagem';
        }
      }
    });
  }

  return { carregar };
})();
