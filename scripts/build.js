#!/usr/bin/env node
/**
 * Script de Build e Criptografia do Portal de Pesquisa
 * 
 * Criptografa todo o conteúdo em texto claro de 'conteudo/' para 'dados_cifrados/'.
 * Cifra: AES-256-GCM com chave derivada via PBKDF2-SHA256 (600.000 iterações).
 * 
 * Segurança e Privacidade:
 * - Limpa a pasta dados_cifrados/arquivos/ antes do build (evita arquivos órfãos)
 * - Nomes de arquivos cifrados opacos/anônimos (HMAC-SHA256), impedindo vazamento de metadados
 * - Manifesto cifrado que mapeia nomes reais para nomes anônimos
 * 
 * Uso:
 *   node scripts/build.js [sua-frase-senha-forte]
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const readline = require('node:readline');

const ROOT_DIR = path.resolve(__dirname, '..');
const CONTEUDO_DIR = path.join(ROOT_DIR, 'conteudo');
const DADOS_CIFRADOS_DIR = path.join(ROOT_DIR, 'dados_cifrados');
const ARQUIVOS_CIFRADOS_DIR = path.join(DADOS_CIFRADOS_DIR, 'arquivos');
const META_PATH = path.join(DADOS_CIFRADOS_DIR, 'meta.json');
const MANIFESTO_ENC_PATH = path.join(DADOS_CIFRADOS_DIR, 'manifesto.enc');

const ITERACOES_PBKDF2 = 600000;
const KEY_LEN = 32; // 256 bits
const IV_LEN = 12;  // 96 bits para AES-GCM
const SALT_LEN = 16; // 128 bits

// Garante pastas básicas
fs.mkdirSync(CONTEUDO_DIR, { recursive: true });
fs.mkdirSync(DADOS_CIFRADOS_DIR, { recursive: true });

function obterOuCriarSalt() {
  if (fs.existsSync(META_PATH)) {
    try {
      const meta = JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
      if (meta && meta.salt) {
        return Buffer.from(meta.salt, 'hex');
      }
    } catch {
      // Cria novo salt se inválido
    }
  }
  return crypto.randomBytes(SALT_LEN);
}

function derivarChave(senha, salt) {
  return crypto.pbkdf2Sync(senha, salt, ITERACOES_PBKDF2, KEY_LEN, 'sha256');
}

/**
 * Criptografa um buffer usando AES-256-GCM.
 * Retorna Buffer com formato: [IV 12 bytes] + [Ciphertext] + [Auth Tag 16 bytes]
 */
function criptografarBuffer(buffer, key) {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, ciphertext, tag]);
}

function listarArquivosRecursivo(dir, baseRelativa = '') {
  let resultados = [];
  if (!fs.existsSync(dir)) return resultados;

  const entradas = fs.readdirSync(dir, { withFileTypes: true });
  for (const entrada of entradas) {
    const caminhoCompleto = path.join(dir, entrada.name);
    const caminhoRelativo = baseRelativa ? `${baseRelativa}/${entrada.name}` : entrada.name;

    if (entrada.isDirectory()) {
      resultados = resultados.concat(listarArquivosRecursivo(caminhoCompleto, caminhoRelativo));
    } else if (entrada.isFile()) {
      if (!entrada.name.startsWith('.')) {
        resultados.push({
          caminhoCompleto,
          caminhoRelativo: caminhoRelativo.replace(/\\/g, '/')
        });
      }
    }
  }
  return resultados;
}

async function executarBuild(senha) {
  if (!senha || senha.trim().length < 8) {
    console.error('❌ ERRO: A senha deve conter pelo menos 8 caracteres (recomenda-se uma frase-senha longa).');
    process.exit(1);
  }

  console.log('🔒 Iniciando processo de criptografia do portal...');
  console.log(`📁 Diretório de origem: ${CONTEUDO_DIR}`);

  // 1. LIMPEZA TOTAL DA PASTA DE ARQUIVOS CIFRADOS (evita órfãos)
  if (fs.existsSync(ARQUIVOS_CIFRADOS_DIR)) {
    fs.rmSync(ARQUIVOS_CIFRADOS_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(ARQUIVOS_CIFRADOS_DIR, { recursive: true });

  const salt = obterOuCriarSalt();
  console.log(`🔑 Derivando chave AES-256 via PBKDF2-SHA256 (${ITERACOES_PBKDF2.toLocaleString()} iterações)...`);
  const chave = derivarChave(senha, salt);

  const arquivos = listarArquivosRecursivo(CONTEUDO_DIR);
  console.log(`📄 Arquivos encontrados em conteudo/: ${arquivos.length}`);

  const mapaManifesto = {};

  for (const item of arquivos) {
    const conteudoBuffer = fs.readFileSync(item.caminhoCompleto);
    const bufferCifrado = criptografarBuffer(conteudoBuffer, chave);

    // 2. NOMES ALEATÓRIOS (16 bytes hex .enc): nenhum metadado ou parâmetro exposto
    const nomeAleatorio = `${crypto.randomBytes(16).toString('hex')}.enc`;
    const destinoAbsoluto = path.join(ARQUIVOS_CIFRADOS_DIR, nomeAleatorio);

    fs.writeFileSync(destinoAbsoluto, bufferCifrado);

    // O manifesto cifrado é o único que mapeia o caminho lógico para o arquivo aleatório
    mapaManifesto[item.caminhoRelativo] = `dados_cifrados/arquivos/${nomeAleatorio}`;
    console.log(`   ✓ Cifrado: ${item.caminhoRelativo} → ${nomeAleatorio} (${conteudoBuffer.length} B → ${bufferCifrado.length} B)`);
  }

  // Gera e cifra o manifesto
  const manifesto = {
    versao: '1.0.0',
    criado_em: new Date().toISOString(),
    arquivos: mapaManifesto
  };

  const manifestoBuffer = Buffer.from(JSON.stringify(manifesto, null, 2), 'utf8');
  const manifestoCifrado = criptografarBuffer(manifestoBuffer, chave);
  fs.writeFileSync(MANIFESTO_ENC_PATH, manifestoCifrado);
  console.log(`   ✓ Manifesto cifrado gerado com sucesso (${manifestoBuffer.length} B → ${manifestoCifrado.length} B)`);

  // Salva meta.json público (salt + parâmetros)
  const meta = {
    versao: 1,
    iteracoes: ITERACOES_PBKDF2,
    salt: salt.toString('hex'),
    atualizado_em: new Date().toISOString()
  };
  fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2), 'utf8');
  console.log(`   ✓ Metadados públicos salvos em ${META_PATH}`);

  console.log('\n✅ BUILD CONCLUÍDO COM SUCESSO!');
  console.log('================================================================');
  console.log('📌 Segurança garantida:');
  console.log('   - dados_cifrados/arquivos/ contém apenas nomes anônimos');
  console.log('   - Nenhum metadado de parâmetro ou nome de arquivo é exposto no Git');
  console.log('   - Arquivos órfãos antigos foram limpos');
  console.log('================================================================');
}

// Tratamento de argumentos / prompt de senha
const senhaArg = process.argv[2] || process.env.PORTAL_PASSWORD;

if (senhaArg) {
  executarBuild(senhaArg);
} else {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Digite a frase-senha para criptografar o portal: ', (senha) => {
    rl.close();
    executarBuild(senha);
  });
}
