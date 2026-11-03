/**
 * Módulo de Autenticação e Criptografia do Portal (Web Crypto API)
 * 
 * Implementa:
 * - Derivação de chave AES-256 via PBKDF2-SHA256 (600.000 iterações) a partir da senha
 * - Verificação de login via decifração e autenticação AES-256-GCM do manifesto cifrado
 * - Armazenamento da chave derivada (não da senha) em sessionStorage
 * - Decifração em memória de arquivos JSON, Markdown e imagens (Blob URL)
 * - Criptografia ponta-a-ponta de mensagens para o Supabase
 */
const Auth = (() => {
  const STORAGE_KEY_DERIVED = 'pxp_portal_chave_derivada';
  let cryptoKeyCache = null;
  let manifestoCache = null;
  const blobUrlsCache = new Map();

  function toHex(buffer) {
    const bytes = new Uint8Array(buffer);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function fromHex(hexStr) {
    const bytes = new Uint8Array(hexStr.length / 2);
    for (let i = 0; i < hexStr.length; i += 2) {
      bytes[i / 2] = parseInt(hexStr.substr(i, 2), 16);
    }
    return bytes;
  }

  async function obterMetaPublico() {
    const resp = await fetch('dados_cifrados/meta.json');
    if (!resp.ok) {
      throw new Error('Não foi possível carregar os metadados em dados_cifrados/meta.json. Execute o build.');
    }
    return await resp.json();
  }

  async function derivarChaveDaSenha(senha, saltHex, iteracoes) {
    const enc = new TextEncoder();
    const saltBytes = fromHex(saltHex);

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(senha),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBytes,
        iterations: iteracoes,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true, // extractable para salvar raw em sessionStorage
      ['encrypt', 'decrypt']
    );
  }

  async function decifrarBufferComChave(arrayBufferCompleto, key) {
    if (arrayBufferCompleto.byteLength < 28) {
      throw new Error('Buffer corrompido ou menor que o tamanho mínimo de IV+Tag');
    }
    const iv = new Uint8Array(arrayBufferCompleto.slice(0, 12));
    const dadosCifradosETag = new Uint8Array(arrayBufferCompleto.slice(12));

    return await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      dadosCifradosETag
    );
  }

  async function carregarManifesto(key) {
    const resp = await fetch('dados_cifrados/manifesto.enc');
    if (!resp.ok) {
      throw new Error('Manifesto cifrado não encontrado em dados_cifrados/manifesto.enc');
    }
    const buf = await resp.arrayBuffer();
    const decifrado = await decifrarBufferComChave(buf, key);
    const texto = new TextDecoder('utf-8').decode(decifrado);
    manifestoCache = JSON.parse(texto);
    return manifestoCache;
  }

  async function restaurarSessao() {
    const rawHex = sessionStorage.getItem(STORAGE_KEY_DERIVED);
    if (!rawHex) return false;

    try {
      const rawBytes = fromHex(rawHex);
      cryptoKeyCache = await crypto.subtle.importKey(
        'raw',
        rawBytes,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
      await carregarManifesto(cryptoKeyCache);
      return true;
    } catch (err) {
      console.warn('Falha ao restaurar sessão criptografada:', err);
      sessionStorage.removeItem(STORAGE_KEY_DERIVED);
      cryptoKeyCache = null;
      manifestoCache = null;
      return false;
    }
  }

  async function autenticarComSenha(senha) {
    if (!senha || senha.trim().length === 0) return false;

    const meta = await obterMetaPublico();
    const chave = await derivarChaveDaSenha(senha.trim(), meta.salt, meta.iteracoes);

    try {
      // Teste de autenticação real: decifra o manifesto com verificação de auth tag GCM
      await carregarManifesto(chave);

      // Senha correta: guarda a chave derivada bruta em sessionStorage
      cryptoKeyCache = chave;
      const rawExport = await crypto.subtle.exportKey('raw', chave);
      sessionStorage.setItem(STORAGE_KEY_DERIVED, toHex(rawExport));
      return true;
    } catch (err) {
      // Se a auth tag falhar, senha incorreta
      console.warn('Falha na autenticação GCM (senha incorreta):', err);
      return false;
    }
  }

  function estaAutenticado() {
    return cryptoKeyCache !== null && manifestoCache !== null;
  }

  function obterChave() {
    return cryptoKeyCache;
  }

  function obterManifesto() {
    return manifestoCache;
  }

  function bloquear() {
    sessionStorage.removeItem(STORAGE_KEY_DERIVED);
    cryptoKeyCache = null;
    manifestoCache = null;
    blobUrlsCache.forEach(url => URL.revokeObjectURL(url));
    blobUrlsCache.clear();
    window.location.reload();
  }

  async function decifrarArquivoTexto(caminhoRelativo) {
    if (!estaAutenticado()) throw new Error('Não autenticado');
    const caminhoCifrado = manifestoCache.arquivos[caminhoRelativo];
    if (!caminhoCifrado) throw new Error(`Arquivo não registrado no manifesto: ${caminhoRelativo}`);

    const resp = await fetch(caminhoCifrado);
    if (!resp.ok) throw new Error(`Falha ao baixar arquivo cifrado: ${caminhoCifrado}`);
    const buf = await resp.arrayBuffer();
    const decifrado = await decifrarBufferComChave(buf, cryptoKeyCache);
    return new TextDecoder('utf-8').decode(decifrado);
  }

  async function decifrarArquivoJSON(caminhoRelativo) {
    const texto = await decifrarArquivoTexto(caminhoRelativo);
    return JSON.parse(texto);
  }

  async function obterBlobUrlFigura(caminhoRelativo, mimeType = 'image/png') {
    if (!estaAutenticado()) throw new Error('Não autenticado');
    if (blobUrlsCache.has(caminhoRelativo)) {
      return blobUrlsCache.get(caminhoRelativo);
    }

    const caminhoCifrado = manifestoCache.arquivos[caminhoRelativo];
    if (!caminhoCifrado) {
      throw new Error(`Figura não encontrada no manifesto: ${caminhoRelativo}`);
    }

    const resp = await fetch(caminhoCifrado);
    if (!resp.ok) throw new Error(`Falha ao buscar figura cifrada: ${caminhoCifrado}`);
    const buf = await resp.arrayBuffer();
    const decifrado = await decifrarBufferComChave(buf, cryptoKeyCache);

    const blob = new Blob([decifrado], { type: mimeType });
    const url = URL.createObjectURL(blob);
    blobUrlsCache.set(caminhoRelativo, url);
    return url;
  }

  // Criptografia de mensagem (texto plano -> { iv, texto_cifrado })
  async function cifrarTexto(texto) {
    if (!estaAutenticado()) throw new Error('Não autenticado');
    const enc = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cifradoETag = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKeyCache,
      enc.encode(texto)
    );
    return {
      iv: toHex(iv),
      texto_cifrado: toHex(cifradoETag)
    };
  }

  // Decifração de mensagem ({ iv, texto_cifrado } -> texto plano ou null se adulterada/lixo)
  async function decifrarTexto(ivHex, textoCifradoHex) {
    if (!estaAutenticado()) throw new Error('Não autenticado');
    try {
      const iv = fromHex(ivHex);
      const cifradoETag = fromHex(textoCifradoHex);
      const decifrado = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        cryptoKeyCache,
        cifradoETag
      );
      return new TextDecoder('utf-8').decode(decifrado);
    } catch {
      // Falha na verificação de autenticação GCM: mensagem lixo ou chave incompatível
      return null;
    }
  }

  async function inicializar() {
    const overlay = document.getElementById('gatekeeper-overlay');
    const form = document.getElementById('form-login');
    const inputSenha = document.getElementById('input-chave');
    const msgErro = document.getElementById('msg-erro-login');
    const btnLock = document.getElementById('btn-logout');

    // Tenta restaurar sessão prévia
    const restaurado = await restaurarSessao();
    if (restaurado) {
      if (overlay) overlay.style.display = 'none';
      App.carregarAbaAtual();
    } else {
      if (overlay) overlay.style.display = 'flex';
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        msgErro.style.display = 'none';
        const senha = inputSenha.value;
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Verificando chave...';
        }

        try {
          const ok = await autenticarComSenha(senha);
          if (ok) {
            inputSenha.value = '';
            overlay.style.display = 'none';
            App.carregarAbaAtual();
          } else {
            msgErro.textContent = 'Chave incorreta ou dados corrompidos. Verifique a senha digitada.';
            msgErro.style.display = 'block';
            inputSenha.focus();
          }
        } catch (err) {
          msgErro.textContent = `Erro ao autenticar: ${err.message}`;
          msgErro.style.display = 'block';
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Desbloquear Portal';
          }
        }
      });
    }

    if (btnLock) {
      btnLock.addEventListener('click', () => {
        if (confirm('Deseja bloquear o portal e limpar a chave da sessão?')) {
          bloquear();
        }
      });
    }
  }

  return {
    inicializar,
    estaAutenticado,
    autenticarComSenha,
    bloquear,
    obterChave,
    obterManifesto,
    decifrarArquivoTexto,
    decifrarArquivoJSON,
    obterBlobUrlFigura,
    cifrarTexto,
    decifrarTexto
  };
})();
