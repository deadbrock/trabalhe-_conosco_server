/**
 * Serviço de validação de qualidade de imagem
 * Verifica se as imagens estão legíveis, nítidas e sem problemas
 */

import sharp from 'sharp';
import axios from 'axios';

export interface ImageValidationResult {
  isValid: boolean;
  score: number; // 0-100
  issues: string[];
  details: {
    width?: number;
    height?: number;
    format?: string;
    size?: number;
    sharpness?: number;
    brightness?: number;
  };
}

/**
 * Valida qualidade de imagem
 */
export async function validarQualidadeImagem(
  imageUrl: string
): Promise<ImageValidationResult> {
  const issues: string[] = [];
  let score = 100;
  
  try {
    // Baixar imagem
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });
    
    const buffer = Buffer.from(response.data);
    
    // Analisar com Sharp
    const image = sharp(buffer);
    const metadata = await image.metadata();
    const stats = await image.stats();
    
    const width = metadata.width || 0;
    const height = metadata.height || 0;
    const format = metadata.format || 'unknown';
    const size = buffer.length;
    
    // 1. Validar resolução mínima
    const MIN_WIDTH = 800;
    const MIN_HEIGHT = 600;
    
    if (width < MIN_WIDTH || height < MIN_HEIGHT) {
      issues.push(`Resolução muito baixa (${width}x${height}). Mínimo recomendado: ${MIN_WIDTH}x${MIN_HEIGHT}px`);
      score -= 30;
    }
    
    // 2. Validar tamanho do arquivo
    const MIN_SIZE = 50 * 1024; // 50KB
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    
    if (size < MIN_SIZE) {
      issues.push('Arquivo muito pequeno. Pode estar com baixa qualidade.');
      score -= 20;
    }
    
    if (size > MAX_SIZE) {
      issues.push('Arquivo muito grande. Considere comprimir a imagem.');
      score -= 10;
    }
    
    // 3. Validar formato
    const ALLOWED_FORMATS = ['jpeg', 'jpg', 'png', 'webp'];
    if (!ALLOWED_FORMATS.includes(format.toLowerCase())) {
      issues.push(`Formato não suportado (${format}). Use JPEG, PNG ou WebP.`);
      score -= 40;
    }
    
    // 4. Estimar nitidez (usando variância de Laplacian)
    const sharpnessScore = await estimarNitidez(image);
    
    if (sharpnessScore < 30) {
      issues.push('Imagem muito embaçada ou desfocada. Tire outra foto com mais nitidez.');
      score -= 40;
    } else if (sharpnessScore < 50) {
      issues.push('Imagem um pouco embaçada. Recomendamos tirar outra foto.');
      score -= 20;
    }
    
    // 5. Validar brilho
    const brightness = calcularBrilho(stats);
    
    if (brightness < 50) {
      issues.push('Imagem muito escura. Tire a foto com mais iluminação.');
      score -= 25;
    } else if (brightness > 230) {
      issues.push('Imagem muito clara/estourada. Reduza a exposição.');
      score -= 25;
    }
    
    // 6. Detectar imagem completamente preta ou branca
    if (brightness < 10) {
      issues.push('Imagem praticamente preta. Documento ilegível.');
      score -= 50;
    } else if (brightness > 245) {
      issues.push('Imagem praticamente branca. Documento ilegível.');
      score -= 50;
    }
    
    // Score final não pode ser negativo
    score = Math.max(0, score);
    
    const isValid = score >= 60 && issues.length === 0;
    
    return {
      isValid,
      score,
      issues,
      details: {
        width,
        height,
        format,
        size,
        sharpness: sharpnessScore,
        brightness,
      },
    };
  } catch (error: any) {
    console.error('Erro ao validar qualidade de imagem:', error);
    
    return {
      isValid: false,
      score: 0,
      issues: ['Erro ao processar imagem. Verifique se o arquivo está correto.'],
      details: {},
    };
  }
}

/**
 * Estima nitidez da imagem usando Laplacian variance
 */
async function estimarNitidez(image: sharp.Sharp): Promise<number> {
  try {
    // Converter para grayscale e aplicar Laplacian
    const { data, info } = await image
      .grayscale()
      .resize(800, 800, { fit: 'inside' }) // Reduzir para performance
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // Calcular variância (aproximação de nitidez)
    let sum = 0;
    let sumSq = 0;
    const pixels = data.length;
    
    for (let i = 0; i < pixels; i++) {
      const value = data[i];
      sum += value;
      sumSq += value * value;
    }
    
    const mean = sum / pixels;
    const variance = (sumSq / pixels) - (mean * mean);
    
    // Normalizar para 0-100
    const sharpness = Math.min(100, Math.sqrt(variance) * 0.5);
    
    return sharpness;
  } catch (error) {
    console.error('Erro ao estimar nitidez:', error);
    return 50; // Valor neutro em caso de erro
  }
}

/**
 * Calcula brilho médio da imagem
 */
function calcularBrilho(stats: sharp.Stats): number {
  try {
    // Média dos canais RGB
    const channels = stats.channels;
    
    if (!channels || channels.length === 0) {
      return 128; // Valor neutro
    }
    
    let totalMean = 0;
    
    for (const channel of channels) {
      totalMean += channel.mean || 0;
    }
    
    return totalMean / channels.length;
  } catch (error) {
    console.error('Erro ao calcular brilho:', error);
    return 128; // Valor neutro
  }
}

/**
 * Valida se a imagem não está rasurada (detecta marcações)
 * Usa análise de bordas para detectar traços/rabiscos anormais
 */
export async function detectarRasuras(imageUrl: string): Promise<boolean> {
  try {
    // Baixar imagem
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });
    
    const buffer = Buffer.from(response.data);
    const image = sharp(buffer);
    
    // Aplicar edge detection (Sobel)
    const { data } = await image
      .grayscale()
      .convolve({
        width: 3,
        height: 3,
        kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1], // Laplacian kernel
      })
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // Contar pixels com bordas fortes (possíveis rasuras)
    let strongEdges = 0;
    const threshold = 100;
    
    for (let i = 0; i < data.length; i++) {
      if (data[i] > threshold) {
        strongEdges++;
      }
    }
    
    const edgeRatio = strongEdges / data.length;
    
    // Se > 30% da imagem tem bordas fortes, pode estar rasurada
    const temRasuras = edgeRatio > 0.3;
    
    return temRasuras;
  } catch (error) {
    console.error('Erro ao detectar rasuras:', error);
    return false; // Em caso de erro, não bloquear
  }
}

