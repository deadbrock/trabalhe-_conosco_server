# 🚀 Backend - Sistema de Recrutamento

## 📋 Requisitos
- Node.js 18+
- PostgreSQL 13+
- Resend API (Email)
- Twilio API (WhatsApp)

## ⚙️ Setup Local

### 1. Instalar dependências
```bash
npm install
```

### 2. Configurar variáveis de ambiente
Crie um arquivo `.env` na raiz do `server/`:
```bash
DATABASE_URL=postgresql://...
JWT_SECRET=seu_secret_aqui
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
RESEND_API_KEY=re_...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
PORT=3333
NODE_ENV=development
```

**📱 Para configurar Twilio, veja:** [TWILIO_CONFIG.md](../TWILIO_CONFIG.md)

### 3. Rodar migrações
```bash
npm run migrate              # Migração principal
npm run migrate:banco-talentos  # Banco de talentos
npm run migrate:fase1        # Fase 1 (comentários, tags, etc)
npm run migrate:fase3        # Fase 3 (notificações, atividades)
npm run migrate:sprint2      # Sprint 2 (comunicação)
```

### 4. Popular templates
```bash
npm run seed:templates       # Templates de email e WhatsApp
```

### 5. Iniciar servidor
```bash
npm run dev                  # Desenvolvimento
npm start                    # Produção
```

## 🚢 Deploy Railway

### 1. Criar novo serviço
1. Acesse: https://railway.app/
2. New Project → Deploy from GitHub
3. Selecione o repositório
4. Root directory: `server/`

### 2. Configurar variáveis de ambiente
Adicione as mesmas variáveis do `.env` local

### 3. Deploy automático
- Push para `main` → Deploy automático ✅

## 📱 Twilio WhatsApp

### Configuração Completa
Veja: [TWILIO_CONFIG.md](../TWILIO_CONFIG.md)

### Teste rápido
```bash
# Verificar status
curl https://seu-backend.railway.app/whatsapp/status \
  -H "Authorization: Bearer SEU_TOKEN"

# Enviar teste
curl -X POST https://seu-backend.railway.app/whatsapp/testar \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"numero":"11999999999","mensagem":"Teste!"}'
```

## 📊 Estrutura

```
server/
├── src/
│   ├── index.ts              # Server principal
│   ├── middleware/           # Autenticação, etc
│   ├── routes/               # Rotas da API
│   │   ├── candidatos.ts
│   │   ├── vagas.ts
│   │   ├── comunicacao.ts
│   │   ├── whatsapp.ts
│   │   └── ...
│   └── services/             # Serviços
│       ├── emailService.ts   # Resend
│       ├── whatsappService.ts # Twilio
│       └── gatilhosService.ts # Triggers
├── package.json
└── tsconfig.json
```

## 🔧 Scripts Disponíveis

```bash
npm run dev              # Desenvolvimento com watch
npm run build            # Build para produção
npm start                # Iniciar produção
npm run migrate          # Migração principal
npm run migrate:fase1    # Migração Fase 1
npm run migrate:fase3    # Migração Fase 3
npm run migrate:sprint2  # Migração Sprint 2
npm run seed:templates   # Popular templates
```

## 📚 Documentação

- [TWILIO_CONFIG.md](../TWILIO_CONFIG.md) - Configuração Twilio WhatsApp
- [FASE3_RESUMO.md](../FASE3_RESUMO.md) - Fase 3 completa
- [SPRINT2_RESUMO_COMPLETO.md](../SPRINT2_RESUMO_COMPLETO.md) - Sprint 2 completa

## 💡 Troubleshooting

### Erro de conexão com banco
```bash
# Verificar se DATABASE_URL está correto
echo $DATABASE_URL
```

### Erro de email
```bash
# Verificar RESEND_API_KEY
curl https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY"
```

### Erro de WhatsApp
```bash
# Verificar credenciais Twilio
curl -X GET 'https://api.twilio.com/2010-04-01/Accounts/YOUR_ACCOUNT_SID.json' \
  -u YOUR_ACCOUNT_SID:YOUR_AUTH_TOKEN
```

---

**Dúvidas?** Consulte a documentação ou abra uma issue! 😊 
