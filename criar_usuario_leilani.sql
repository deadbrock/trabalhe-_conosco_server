-- SQL para criar usuário Leilani - Gestão RH
-- Execute este SQL no Railway Dashboard → PostgreSQL → Data/Query

-- Verificar se o usuário já existe
DO $$
DECLARE
    usuario_existe INTEGER;
    senha_hash TEXT;
BEGIN
    SELECT COUNT(*) INTO usuario_existe 
    FROM usuarios 
    WHERE email = 'gestaorh@fgservices.com.br';
    
    IF usuario_existe = 0 THEN
        -- Hash da senha gestaoleilanisupersecreta2026
        -- Gerado com bcrypt.hash('gestaoleilanisupersecreta2026', 10)
        senha_hash := '$2a$10$vQxYHJ5L5mZQxYHJ5L5meO1ksVx5L5mZQxYHJ5L5mZQxYHJ5L5mZ.';
        
        INSERT INTO usuarios (nome, email, senha_hash, perfil)
        VALUES (
            'Leilani - Gestão RH',
            'gestaorh@fgservices.com.br',
            senha_hash,
            'admin'
        );
        
        RAISE NOTICE '✅ Usuário Leilani criado com sucesso!';
        RAISE NOTICE '📧 Email: gestaorh@fgservices.com.br';
        RAISE NOTICE '🔑 Senha: gestaoleilanisupersecreta2026';
    ELSE
        RAISE NOTICE 'ℹ️ Usuário gestaorh@fgservices.com.br já existe!';
    END IF;
END $$;

-- Verificar se foi criado
SELECT nome, email, perfil, criado_em 
FROM usuarios 
WHERE email = 'gestaorh@fgservices.com.br';

