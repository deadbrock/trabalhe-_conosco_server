# ☁️ Configuração do Cloudinary

## Por que Cloudinary?

O Railway usa **containers efêmeros**, ou seja, toda vez que o servidor reinicia, os arquivos na pasta `uploads/` são perdidos. O Cloudinary resolve isso armazenando os currículos na nuvem de forma **permanente e gratuita** (até 25GB).

---

## 🚀 Passo a Passo:

### 1. Criar conta no Cloudinary (Gratuito)

1. Acesse: https://cloudinary.com/users/register_free
2. Crie sua conta gratuita
3. Confirme seu email

### 2. Pegar as credenciais

Após fazer login:

1. Vá em **Dashboard** → https://console.cloudinary.com/
2. Você verá um box **"Account Details"** com:
   ```
   Cloud Name: seu-cloud-name
   API Key: 123456789012345
   API Secret: aBcDeFgHiJkLmNoPqRsTuVwXyZ
   ```

### 3. Configurar no Railway

1. Acesse: https://railway.app
2. Entre no projeto do **backend** (trabalhe-conoscoserver)
3. Vá em **"Variables"**
4. Adicione estas 3 variáveis:

```
CLOUDINARY_CLOUD_NAME=seu-cloud-name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=aBcDeFgHiJkLmNoPqRsTuVwXyZ
```

### 4. Redeploy

1. Vá na aba **"Deployments"**
2. Clique nos **3 pontinhos (...)** do último deploy
3. Selecione **"Redeploy"**

---

## ✅ Pronto!

Agora os currículos serão enviados diretamente para o Cloudinary e ficam salvos permanentemente, mesmo quando o Railway reiniciar!

---

## 🧪 Testar

Após configurar e fazer redeploy:

1. Vá no site e candidate-se a uma vaga
2. Envie um currículo em PDF
3. Acesse o painel RH → Candidatos
4. Clique no botão **"📥 Currículo"**
5. O arquivo deve abrir diretamente do Cloudinary! 🎉

---

## 📊 Monitorar

Acesse o Cloudinary Dashboard para ver:
- Quantos arquivos foram enviados
- Espaço usado
- URLs dos currículos

https://console.cloudinary.com/pm/c-YOUR_CLOUD_NAME/media-explorer/curriculos

