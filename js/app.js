// Módulo Principal / Router do Portal
const App = (() => {
  const ABAS = ['simulacoes', 'relatorios', 'resultados', 'discussao'];
  let abaAtiva = 'simulacoes';

  function navegarPara(abaId, atualizarHash = true) {
    if (!ABAS.includes(abaId)) abaId = 'simulacoes';
    abaAtiva = abaId;

    if (atualizarHash) {
      window.location.hash = `#${abaId}`;
    }

    // Atualiza botões da navbar
    document.querySelectorAll('.aba-btn').forEach(btn => {
      btn.classList.toggle('ativa', btn.dataset.aba === abaId);
    });

    // Atualiza seções de conteúdo
    document.querySelectorAll('.secao-conteudo').forEach(secao => {
      secao.classList.toggle('ativa', secao.id === `secao-${abaId}`);
    });

    // Carrega módulo correspondente se autenticado
    if (Auth.estaAutenticado()) {
      carregarAbaAtual();
    }
  }

  function carregarAbaAtual() {
    switch (abaAtiva) {
      case 'simulacoes':
        Simulacoes.carregar();
        break;
      case 'relatorios':
        Relatorios.carregar();
        break;
      case 'resultados':
        Resultados.carregar();
        break;
      case 'discussao':
        Discussao.carregar();
        break;
    }
  }

  function inicializar() {
    Auth.inicializar();

    // Eventos de clique nas abas
    document.querySelectorAll('.aba-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        navegarPara(btn.dataset.aba);
      });
    });

    // Roteamento baseado em hash da URL
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '');
      if (ABAS.includes(hash)) {
        navegarPara(hash, false);
      }
    });

    const hashInicial = window.location.hash.replace('#', '');
    navegarPara(ABAS.includes(hashInicial) ? hashInicial : 'simulacoes', false);
  }

  return {
    inicializar,
    navegarPara,
    carregarAbaAtual
  };
})();

// Inicializa a aplicação quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', App.inicializar);
