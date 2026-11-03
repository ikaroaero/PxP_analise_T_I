# Portal de Pesquisa — Dinâmica Presa-Predador em Redes Complexas (PxP)

Ambiente web estático e seguro para acompanhamento contínuo de simulações científicas, leitura de relatórios periódicos, análise comparativa de gráficos e mural de comunicação entre aluno e orientadora.

---

## 🔒 Princípio de Segurança e Criptografia

O repositório é **público**, hospedado via GitHub Pages. Para proteger os dados científicos antes da publicação oficial do artigo:

- **Fonte em texto claro (`conteudo/`):** Vive **apenas no computador local** do pesquisador e está configurada no `.gitignore`. **Nunca é enviada ao GitHub.**
- **Dados cifrados no Git (`dados_cifrados/`):** Todos os arquivos (tabelas de simulação, textos de relatórios, parâmetros e figuras) são criptografados com **AES-256-GCM** antes de qualquer commit/push.
- **Chave criptográfica:** Derivada a partir de uma frase-senha mestra usando **PBKDF2-SHA256 com 600.000 iterações**.
- **Decifração em memória (RAM):** O navegador da orientadora deriva a chave a partir da senha e decifra os dados diretamente na memória do cliente via Web Crypto API nativa do W3C.
- **Mural de Discussão:** Mensagens trocadas são criptografadas no cliente com AES-256-GCM antes de serem enviadas ao banco de dados Supabase. Qualquer pessoa que inspecione o banco ou o tráfego de rede só enxergará texto cifrado indecifrável.

---

## 🚀 Como Rodar Localmente

Como o portal utiliza requisições assíncronas (`fetch`) para carregar os arquivos cifrados, ele deve ser servido via HTTP local (não dê dois cliques diretamente no arquivo `index.html` via `file:///`):

1. Abra o terminal na raiz do projeto (`PxP_analise_T_I`).
2. Inicie um servidor HTTP local simples com Python ou Node.js:
   ```bash
   # Opção A (Python):
   python -m http.server 8000

   # Opção B (Node.js npx):
   npx serve .
   ```
3. Abra seu navegador em: [http://localhost:8000](http://localhost:8000).
4. Insira a sua frase-senha para desbloquear o portal.

---

## 📝 Como Adicionar Conteúdo

Toda a edição é feita na pasta local `conteudo/`, utilizando arquivos simples (JSON, Markdown e imagens PNG):

### 1. Adicionar ou Atualizar Simulações
Edite `conteudo/simulacoes.json`. Cada rodada é um objeto JSON:
```json
[
  {
    "id": "SIM-01",
    "titulo": "Calibração Topológica Base (T=10, I=0.50)",
    "status": "concluido",
    "progresso": 100,
    "maquina": "Cluster 01 — Nó 4",
    "inicio": "2026-10-25 09:00",
    "fim": "2026-10-27 18:30",
    "parametros": {
      "T": "10.0",
      "I": "0.50",
      "passos": "1.000.000",
      "replicas": 50
    },
    "resumo": "Estabilidade alcançada sem extinções precoces. Dados convergiram para atrator característico."
  }
]
```
*Status permitidos:* `"concluido"`, `"em_andamento"`, `"planejado"`, `"erro"`.

### 2. Publicar um Novo Relatório
1. Crie o arquivo Markdown dentro de `conteudo/relatorios/`, por exemplo: `conteudo/relatorios/relatorio_01.md`.
2. Registre o relatório em `conteudo/relatorios.json`:
```json
[
  {
    "id": "rel-01",
    "data": "2026-11-01",
    "titulo": "Relatório Quinzenal #01 — Primeiras Rodadas de T e I",
    "autor": "Aluno",
    "resumo": "Análise da dinâmica espacial com variação de perturbação I.",
    "arquivo": "relatorios/relatorio_01.md"
  }
]
```

### 3. Cadastrar Novas Figuras e Parâmetros
1. Coloque as figuras dentro de `conteudo/figuras/` seguindo a estrutura de pastas do seu modelo (ex.: `conteudo/figuras/MEDIAS/principal_I0.50_MEDIA.png`).
2. Ajuste `conteudo/configuracao_resultados.json` para adicionar novos conjuntos ou parâmetros:
```json
{
  "versao": "1.0.0",
  "conjuntos": [
    { "id": "principal", "nome": "Cluster 01 — Principal", "prefixo": "" }
  ],
  "tipos": [
    {
      "id": "densidade_tempo",
      "nome": "Densidade de Espécies × Tempo",
      "pasta": "MEDIAS",
      "depende_de": ["I"],
      "formato": "{prefixo}MEDIAS/{conjunto}_I{I}_MEDIA.png"
    }
  ],
  "parametros": {
    "T": ["5.0", "10.0", "15.0", "20.0"],
    "I": ["0.01", "0.20", "0.50", "0.99"]
  }
}
```

---

## 🔐 Como Rodar o Build de Criptografia (Antes do Push)

Sempre que alterar arquivos em `conteudo/`, você deve rodar o script de criptografia para atualizar `dados_cifrados/`:

```bash
node scripts/build.js "sua-frase-senha-forte"
```
*(Se você omitir a senha na linha de comando, o script solicitará que você a digite no terminal com segurança).*

O script executará:
1. Derivação da chave mestra AES-256 via PBKDF2 (600.000 iterações).
2. Criptografia individual de cada arquivo de `conteudo/` com IV aleatório exclusivo de 96 bits.
3. Geração do arquivo `dados_cifrados/manifesto.enc` autenticado via AES-GCM.
4. Atualização dos metadados públicos em `dados_cifrados/meta.json` (salt e iterações).

Após o build, envie apenas os dados cifrados e o código:
```bash
git add dados_cifrados/
git commit -m "feat: atualiza dados cifrados de simulacoes e relatorios"
git push origin main
```

---

## 🔑 Política e Troca de Senha

### Como escolher uma senha forte
O repositório é **público**, portanto qualquer pessoa na internet pode baixar o arquivo `manifesto.enc`. **A força da sua frase-senha é a única barreira de proteção dos dados.**
- **Não use:** senhas curtas, datas de aniversário ou palavras simples de dicionário.
- **Use:** uma **frase-senha longa** (passphrase) com pelo menos 5 a 6 palavras aleatórias ou mais de 25 caracteres.  
  *Exemplo:* `girassol-dinamica-predador-floresta-equacao-2026!`

### Como trocar a senha
Caso queira alterar a senha compartilhada com a orientadora:
1. Execute novamente o script de build passando a nova senha:
   ```bash
   node scripts/build.js "nova-frase-senha-longa"
   ```
2. Faça commit e push dos novos arquivos em `dados_cifrados/`.
3. Informe a nova frase-senha para a orientadora.

---

## 💬 Configuração do Supabase (Mural de Discussão)

O mural de comentários utiliza o **Supabase** (banco PostgreSQL na nuvem com API REST gratuita e instantânea).

### Passo a passo para o Aluno:
1. Acesse [supabase.com](https://supabase.com) e crie uma conta gratuita.
2. Crie um novo projeto (ex: `pxp-discussao-portal`).
3. No menu lateral esquerdo, clique em **SQL Editor** -> **New query**.
4. Cole o script SQL abaixo e clique em **Run**:

```sql
-- 1. Cria tabela de mensagens com criptografia ponta-a-ponta
CREATE TABLE public.mensagens (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  autor TEXT NOT NULL CHECK (autor IN ('aluno', 'orientadora')),
  iv TEXT NOT NULL,
  texto_cifrado TEXT NOT NULL,
  CONSTRAINT limite_texto_cifrado CHECK (length(texto_cifrado) <= 10000)
);

-- 2. Ativa Row Level Security (RLS)
ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;

-- 3. Permite leitura pública (anon) das mensagens cifradas
CREATE POLICY "Permitir leitura de mensagens cifradas"
  ON public.mensagens
  FOR SELECT
  TO anon
  USING (true);

-- 4. Permite inserção de mensagens cifradas
CREATE POLICY "Permitir envio de mensagens cifradas"
  ON public.mensagens
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- 5. Bloqueia alteração e exclusão por usuários anon
CREATE POLICY "Bloquear edicao"
  ON public.mensagens
  FOR UPDATE
  TO anon
  USING (false);

CREATE POLICY "Bloquear exclusao"
  ON public.mensagens
  FOR DELETE
  TO anon
  USING (false);
```

5. No Supabase, vá em **Project Settings** (ícone de engrenagem) -> **API**.
6. Copie os valores:
   - **Project URL** (ex: `https://abcdefghijkl.supabase.co`)
   - **anon public key** (ex: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)
7. Abra o arquivo [`js/config.js`](file:///G:/Meu%20Drive/Artigo_PP_compex/PxP_analise_T_I/js/config.js) no seu editor e preencha:
   ```javascript
   const CONFIG_PORTAL = {
     supabase: {
       url: 'https://seu-projeto.supabase.co',
       anonKey: 'sua-chave-anon-aqui'
     }
   };
   ```
8. Salve o arquivo. Pronto! O mural de mensagens agora está sincronizado e todas as mensagens são decifradas apenas por quem tiver a senha mestra do portal.

---

## 🌐 Como Ativar o GitHub Pages

1. Acesse o repositório no GitHub: `https://github.com/ikaroaero/PxP_analise_T_I`.
2. Vá em **Settings** -> **Pages** (no menu lateral esquerdo).
3. Na seção **Build and deployment**:
   - Source: **Deploy from a branch**
   - Branch: **main** / pasta: **/(root)**
4. Clique em **Save**.
5. Em cerca de 1 a 2 minutos, o portal estará acessível em:  
   `https://ikaroaero.github.io/PxP_analise_T_I/`
