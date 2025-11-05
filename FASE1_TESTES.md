# 🧪 GUIA DE TESTES - FASE 1 (Backend)

## 📋 **PRÉ-REQUISITOS**

1. **Executar a migração do banco de dados:**
```bash
cd server
npm run migrate:fase1
```

2. **Iniciar o servidor local:**
```bash
npm run dev
```

---

## 🔑 **AUTENTICAÇÃO**

**IMPORTANTE:** Todas as rotas da FASE 1 são protegidas e requerem token JWT.

### Login para obter token:
```bash
POST http://localhost:3333/auth/login
Content-Type: application/json

{
  "email": "admin@fgservices.com.br",
  "senha": "admin123"
}
```

**Resposta esperada:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Use o token em todas as requisições seguintes:**
```
Authorization: Bearer SEU_TOKEN_AQUI
```

---

## 📝 **1. TESTES - COMENTÁRIOS**

### Listar comentários de um candidato:
```bash
GET http://localhost:3333/comentarios/1
Authorization: Bearer SEU_TOKEN
```

### Adicionar comentário:
```bash
POST http://localhost:3333/comentarios
Authorization: Bearer SEU_TOKEN
Content-Type: application/json

{
  "candidato_id": 1,
  "usuario_id": 1,
  "usuario_nome": "Admin FG",
  "comentario": "Candidato com ótimo perfil!",
  "importante": true
}
```

### Atualizar comentário:
```bash
PUT http://localhost:3333/comentarios/1
Authorization: Bearer SEU_TOKEN
Content-Type: application/json

{
  "comentario": "Candidato excelente, agendar entrevista!",
  "importante": true
}
```

### Remover comentário:
```bash
DELETE http://localhost:3333/comentarios/1
Authorization: Bearer SEU_TOKEN
```

---

## 🏷️ **2. TESTES - TAGS**

### Listar todas as tags:
```bash
GET http://localhost:3333/tags
Authorization: Bearer SEU_TOKEN
```

### Listar tags de um candidato:
```bash
GET http://localhost:3333/tags/candidato/1
Authorization: Bearer SEU_TOKEN
```

### Criar nova tag:
```bash
POST http://localhost:3333/tags
Authorization: Bearer SEU_TOKEN
Content-Type: application/json

{
  "nome": "Inglês Fluente",
  "cor": "#10B981"
}
```

### Adicionar tag a um candidato:
```bash
POST http://localhost:3333/tags/candidato
Authorization: Bearer SEU_TOKEN
Content-Type: application/json

{
  "candidato_id": 1,
  "tag_id": 1
}
```

### Remover tag de um candidato:
```bash
DELETE http://localhost:3333/tags/candidato/1/1
Authorization: Bearer SEU_TOKEN
```

### Atualizar tag:
```bash
PUT http://localhost:3333/tags/1
Authorization: Bearer SEU_TOKEN
Content-Type: application/json

{
  "nome": "Inglês Avançado",
  "cor": "#3B82F6"
}
```

---

## 📅 **3. TESTES - AGENDAMENTOS**

### Listar todos os agendamentos:
```bash
GET http://localhost:3333/agendamentos
Authorization: Bearer SEU_TOKEN
```

### Listar agendamentos de um candidato:
```bash
GET http://localhost:3333/agendamentos?candidato_id=1
Authorization: Bearer SEU_TOKEN
```

### Buscar agendamento por ID:
```bash
GET http://localhost:3333/agendamentos/1
Authorization: Bearer SEU_TOKEN
```

### Criar novo agendamento:
```bash
POST http://localhost:3333/agendamentos
Authorization: Bearer SEU_TOKEN
Content-Type: application/json

{
  "candidato_id": 1,
  "vaga_id": 1,
  "usuario_id": 1,
  "titulo": "Entrevista Técnica",
  "descricao": "Entrevista com o time técnico",
  "data_hora": "2025-11-05T10:00:00",
  "local": "Escritório FG - Sala 3",
  "link_video": "https://meet.google.com/abc-defg-hij",
  "status": "agendado"
}
```

### Atualizar agendamento:
```bash
PUT http://localhost:3333/agendamentos/1
Authorization: Bearer SEU_TOKEN
Content-Type: application/json

{
  "status": "confirmado",
  "descricao": "Candidato confirmou presença"
}
```

### Remover agendamento:
```bash
DELETE http://localhost:3333/agendamentos/1
Authorization: Bearer SEU_TOKEN
```

### Agendamentos próximos (7 dias):
```bash
GET http://localhost:3333/agendamentos/proximos/semana
Authorization: Bearer SEU_TOKEN
```

---

## ⭐ **4. TESTES - PONTUAÇÃO**

### Calcular pontuação de um candidato:
```bash
POST http://localhost:3333/pontuacao/calcular/1
Authorization: Bearer SEU_TOKEN
```

**Resposta esperada:**
```json
{
  "candidatoId": "1",
  "score": 45,
  "message": "Pontuação calculada com sucesso"
}
```

### Recalcular todas as pontuações:
```bash
POST http://localhost:3333/pontuacao/recalcular-todos
Authorization: Bearer SEU_TOKEN
```

### Ver ranking de candidatos:
```bash
GET http://localhost:3333/pontuacao/ranking?limit=10
Authorization: Bearer SEU_TOKEN
```

### Ranking por vaga:
```bash
GET http://localhost:3333/pontuacao/ranking?vaga_id=1&limit=5
Authorization: Bearer SEU_TOKEN
```

### Candidatos por faixa de pontuação:
```bash
GET http://localhost:3333/pontuacao/por-faixa?min_score=30&max_score=60
Authorization: Bearer SEU_TOKEN
```

---

## 📊 **CRITÉRIOS DE PONTUAÇÃO**

O sistema calcula automaticamente baseado em:

- ✅ **Tempo de resposta rápido** (24h): +20 pontos
- ✅ **Tempo de resposta médio** (48h): +10 pontos
- ✅ **Localização próxima**: +15 pontos
- ✅ **Currículo anexado**: +10 pontos
- ✅ **Cada tag**: +5 pontos
- ✅ **Cada comentário importante**: +5 pontos
- ✅ **Status "entrevista"**: +10 pontos
- ✅ **Status "aprovado"**: +20 pontos
- ✅ **Status "banco_talentos"**: +15 pontos

---

## ✅ **CHECKLIST DE TESTES**

### Comentários:
- [ ] Listar comentários de um candidato
- [ ] Adicionar comentário
- [ ] Marcar comentário como importante
- [ ] Editar comentário
- [ ] Remover comentário

### Tags:
- [ ] Listar todas as tags disponíveis
- [ ] Criar nova tag personalizada
- [ ] Adicionar tag a candidato
- [ ] Remover tag de candidato
- [ ] Listar tags de um candidato específico

### Agendamentos:
- [ ] Criar agendamento de entrevista
- [ ] Listar agendamentos futuros
- [ ] Filtrar por candidato
- [ ] Atualizar status (agendado → confirmado → realizado)
- [ ] Ver agendamentos da semana
- [ ] Cancelar agendamento

### Pontuação:
- [ ] Calcular score de um candidato
- [ ] Recalcular todos os scores
- [ ] Ver ranking geral
- [ ] Ver ranking por vaga
- [ ] Filtrar por faixa de pontuação

---

## 🐛 **TROUBLESHOOTING**

### Erro 401 (Unauthorized):
- Verifique se o token está correto
- Verifique se o header `Authorization: Bearer TOKEN` está presente

### Erro 404 (Not Found):
- Verifique se o ID existe no banco
- Verifique se a URL está correta

### Erro 500 (Internal Server Error):
- Verifique os logs do servidor
- Verifique se a migração foi executada
- Verifique a conexão com o banco de dados

---

## 📌 **PRÓXIMOS PASSOS**

Após validar todos os endpoints:
1. ✅ Integrar no frontend
2. ✅ Criar componentes React para cada funcionalidade
3. ✅ Testar fluxo completo
4. ✅ Deploy no Railway/Vercel

---

**🎉 FASE 1 Backend completo!**

