/**
 * Serviço de validação OCR para comprovante de residência
 * Extrai data de emissão e valida se está dentro de 3 meses
 */

import axios from 'axios';
import { createWorker } from 'tesseract.js';

export interface ComprovanteValidationResult {
  isValid: boolean;
  dataEmissao?: Date;
  diasAtras?: number;
  tipoComprovante?: string;
  issues: string[];
}

/**
 * Valida comprovante de residência
 * - Extrai data via OCR
 * - Verifica se está dentro de 3 meses
 */
export async function validarComprovanteResidencia(
  imageUrl: string,
  nomeCandidato: string
): Promise<ComprovanteValidationResult> {
  const issues: string[] = [];
  
  try {
    // Baixar imagem
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 60000,
    });
    
    const buffer = Buffer.from(response.data);
    
    // Executar OCR com Tesseract.js
    console.log('🔍 Iniciando OCR no comprovante de residência...');
    
    const worker = await createWorker('por'); // Português
    
    const { data } = await worker.recognize(buffer);
    const texto = data.text.toLowerCase();
    
    await worker.terminate();
    
    console.log('📄 Texto extraído (primeiras 500 chars):', texto.substring(0, 500));
    
    // 1. Detectar tipo de comprovante
    const tipoComprovante = detectarTipoComprovante(texto);
    
    if (!tipoComprovante) {
      issues.push('Não foi possível identificar o tipo de comprovante (luz, água, internet, etc.)');
    }
    
    // 2. Extrair datas do texto
    const datasEncontradas = extrairDatas(texto);
    
    if (datasEncontradas.length === 0) {
      issues.push('Nenhuma data foi encontrada no documento. Verifique se a imagem está legível.');
      
      return {
        isValid: false,
        issues,
        tipoComprovante: tipoComprovante || 'Desconhecido',
      };
    }
    
    console.log('📅 Datas encontradas:', datasEncontradas);
    
    // 3. Pegar a data mais recente (provavelmente é a emissão)
    const dataEmissao = datasEncontradas.sort((a, b) => b.getTime() - a.getTime())[0];
    
    // 4. Calcular diferença de dias
    const hoje = new Date();
    const diasAtras = Math.floor((hoje.getTime() - dataEmissao.getTime()) / (1000 * 60 * 60 * 24));
    
    // 5. Validar se está dentro de 90 dias (3 meses)
    const MAX_DIAS = 90;
    
    if (diasAtras > MAX_DIAS) {
      issues.push(`Comprovante muito antigo (${diasAtras} dias atrás). Envie um comprovante de até 3 meses.`);
      
      return {
        isValid: false,
        dataEmissao,
        diasAtras,
        issues,
        tipoComprovante: tipoComprovante || 'Desconhecido',
      };
    }
    
    if (diasAtras < 0) {
      issues.push('Data do comprovante está no futuro. Verifique se a imagem está correta.');
      
      return {
        isValid: false,
        dataEmissao,
        diasAtras,
        issues,
        tipoComprovante: tipoComprovante || 'Desconhecido',
      };
    }
    
    // 6. Validar nome do candidato (opcional, mas recomendado)
    const nomeEncontrado = validarNomeCandidato(texto, nomeCandidato);
    
    if (!nomeEncontrado) {
      issues.push('O nome do candidato não foi encontrado no comprovante. Verifique se o documento está em seu nome.');
    }
    
    // Comprovante válido
    console.log(`✅ Comprovante válido: ${tipoComprovante}, ${diasAtras} dias atrás`);
    
    return {
      isValid: issues.length === 0,
      dataEmissao,
      diasAtras,
      tipoComprovante: tipoComprovante || 'Desconhecido',
      issues,
    };
  } catch (error: any) {
    console.error('Erro ao validar comprovante via OCR:', error);
    
    return {
      isValid: false,
      issues: ['Erro ao processar documento. Verifique se a imagem está legível e tente novamente.'],
    };
  }
}

/**
 * Detecta tipo de comprovante
 */
function detectarTipoComprovante(texto: string): string | null {
  const tipos = [
    { palavras: ['energia', 'eletrica', 'neoenergia', 'celpe', 'cemig', 'copel', 'cpfl'], nome: 'Conta de Luz' },
    { palavras: ['agua', 'saneamento', 'compesa', 'sabesp', 'cedae'], nome: 'Conta de Água' },
    { palavras: ['internet', 'banda larga', 'fibra', 'oi', 'vivo', 'tim', 'claro', 'net'], nome: 'Conta de Internet' },
    { palavras: ['telefone', 'telefonia', 'celular'], nome: 'Conta de Telefone' },
    { palavras: ['gas', 'comgas', 'gaspetro'], nome: 'Conta de Gás' },
    { palavras: ['condominio', 'taxa condominial'], nome: 'Conta de Condomínio' },
  ];
  
  for (const tipo of tipos) {
    for (const palavra of tipo.palavras) {
      if (texto.includes(palavra)) {
        return tipo.nome;
      }
    }
  }
  
  return null;
}

/**
 * Extrai datas do texto (formatos: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY)
 */
function extrairDatas(texto: string): Date[] {
  const datas: Date[] = [];
  
  // Regex para datas
  const regexDatas = [
    /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/g, // DD/MM/YYYY
    /(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/g, // YYYY/MM/DD
  ];
  
  for (const regex of regexDatas) {
    let match;
    
    while ((match = regex.exec(texto)) !== null) {
      try {
        // Tentar interpretar como DD/MM/YYYY
        const dia = parseInt(match[1]);
        const mes = parseInt(match[2]);
        const ano = parseInt(match[3]);
        
        if (ano > 2000 && ano <= new Date().getFullYear() + 1 && mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31) {
          const data = new Date(ano, mes - 1, dia);
          
          if (!isNaN(data.getTime())) {
            datas.push(data);
          }
        }
      } catch (error) {
        // Ignorar datas inválidas
      }
    }
  }
  
  // Remover duplicatas
  return datas.filter((data, index, self) =>
    index === self.findIndex((d) => d.getTime() === data.getTime())
  );
}

/**
 * Valida se o nome do candidato aparece no comprovante
 */
function validarNomeCandidato(texto: string, nomeCandidato: string): boolean {
  const nomeNormalizado = nomeCandidato.toLowerCase().trim();
  const textoNormalizado = texto.toLowerCase();
  
  // Separar nome em partes (ex: "João Silva" → ["joão", "silva"])
  const partesNome = nomeNormalizado.split(/\s+/).filter(p => p.length > 2);
  
  // Verificar se pelo menos 2 partes do nome aparecem no texto
  let partesEncontradas = 0;
  
  for (const parte of partesNome) {
    if (textoNormalizado.includes(parte)) {
      partesEncontradas++;
    }
  }
  
  return partesEncontradas >= Math.min(2, partesNome.length);
}

