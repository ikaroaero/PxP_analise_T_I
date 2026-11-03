/**
 * Configuração de Serviços Externos do Portal
 * 
 * Instruções para o Aluno:
 * 1. Crie um projeto gratuito no Supabase (https://supabase.com).
 * 2. No menu SQL Editor do Supabase, execute o script SQL fornecido no README.md
 *    para criar a tabela 'mensagens' com as políticas de RLS ativadas.
 * 3. Copie a URL do projeto e a chave anônima (anon public key) do menu
 *    Project Settings -> API e cole nos campos abaixo.
 * 4. Salve este arquivo e envie para o repositório (a chave anon pode ser pública,
 *    pois todas as mensagens são criptografadas no cliente antes do envio).
 */
const CONFIG_PORTAL = {
  supabase: {
    // Exemplo: 'https://seu-projeto.supabase.co'
    url: '',
    // Exemplo: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
    anonKey: ''
  }
};
