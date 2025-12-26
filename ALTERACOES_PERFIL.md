# 🔧 Alterações Realizadas - Sistema de Perfil

## 📋 Problema Identificado

O erro `column "foto_perfil" does not exist` ocorria porque a tabela `usuarios` não tinha as colunas necessárias para o sistema de perfil do usuário RH.

## ✅ Solução Implementada

### 1. **Correção do JWT** (`src/routes/auth.ts`)
- Adicionado campo `id` no payload do JWT (anteriormente só tinha `sub`)
- Agora o token inclui: `id`, `sub`, `nome`, `email`, `perfil`

### 2. **Migration Automática** (`src/index.ts`)
- Criada função `executarMigracaoPerfil()` que executa automaticamente na inicialização
- Verifica se a coluna `foto_perfil` existe
- Se não existir, executa a migration `add_usuario_perfil_fields.sql`

### 3. **Colunas Adicionadas** (via migration SQL)
- `foto_perfil` - URL da foto de perfil (Cloudinary)
- `telefone` - Telefone de contato
- `cargo` - Cargo/função do usuário
- `criado_em` - Data de criação do usuário
- `data_atualizacao` - Data da última atualização

### 4. **Frontend - Logo no Rodapé** (`components/RHLayout.tsx`)
- Logo movida do topo para o rodapé
- Exibida ao lado do "© 2025 Aestron"

## 🚀 Como Fazer o Deploy

### Opção 1: Via Git (Recomendado)

```bash
# No diretório do backend
cd C:\Users\Souza\OneDrive\Documentos\trabalheconoscofg\trabalhe-_conosco_server

# Verificar alterações
git status

# Adicionar arquivos
git add .

# Commit
git commit -m "fix: adicionar colunas de perfil e corrigir JWT"

# Push para o Railway
git push origin main
```

O Railway vai detectar o push e fazer o deploy automaticamente. Quando o servidor subir, a migration será executada automaticamente.

### Opção 2: Deploy Manual via Railway Dashboard

1. Acesse o painel do Railway
2. Vá até o projeto do backend
3. Clique em "Deploy" ou "Redeploy"

## 📝 O Que Acontecerá no Próximo Deploy

1. ✅ O servidor será compilado com as novas alterações
2. ✅ Na inicialização, a função `executarMigracaoPerfil()` será chamada
3. ✅ A migration SQL será executada (se necessário)
4. ✅ As colunas `foto_perfil`, `telefone`, `cargo`, `criado_em`, `data_atualizacao` serão criadas
5. ✅ O endpoint `/perfil` funcionará corretamente
6. ✅ Upload de foto de perfil funcionará
7. ✅ Atualização de perfil funcionará

## 🔍 Verificação Pós-Deploy

Após o deploy, verifique nos logs do Railway:

```
✅ Colunas de perfil adicionadas com sucesso!
```

Ou, se as colunas já existirem, não aparecerá nenhuma mensagem (a migration só roda se necessário).

## 🎯 Próximos Passos

1. ✅ Fazer o push das alterações
2. ⏳ Aguardar o deploy no Railway (~2-3 minutos)
3. ✅ Fazer novo login no frontend (tokens antigos não terão o campo `id`)
4. ✅ Testar a página de configurações
5. ✅ Testar upload de foto de perfil

---

**Data**: 25/12/2025
**Versão**: 1.3.2

