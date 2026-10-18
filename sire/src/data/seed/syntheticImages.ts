/**
 * Gera "fotos" SINTÉTICAS (ilustrações vetoriais) para anexos da demonstração.
 * Nunca usa imagens reais. Cada imagem traz a marca "IMAGEM SINTÉTICA · DEMO".
 */
export type SyntheticScene = 'fogo' | 'viatura' | 'equipe' | 'area' | 'contencao';

const SCENES: Record<SyntheticScene, { sky: string; ground: string; label: string; art: string }> = {
  fogo: {
    sky: '#2b2f3a',
    ground: '#3b3a36',
    label: 'Foco de incendio (ilustrativo)',
    art: `<path d="M300 300 C 280 240 330 220 320 170 C 360 210 380 240 370 300 Z" fill="#f2a23a"/>
          <path d="M315 300 C 305 260 335 245 330 215 C 350 245 360 265 352 300 Z" fill="#f6d365"/>
          <rect x="180" y="250" width="90" height="60" fill="#55606e"/><rect x="420" y="230" width="120" height="80" fill="#4a5361"/>`,
  },
  viatura: {
    sky: '#9cc7d8',
    ground: '#6f7a72',
    label: 'Viatura posicionada (ilustrativo)',
    art: `<rect x="190" y="210" width="230" height="80" rx="8" fill="#c8312a"/><rect x="420" y="230" width="80" height="60" rx="8" fill="#b02a24"/>
          <rect x="430" y="240" width="45" height="25" fill="#cfe6f0"/><rect x="200" y="250" width="210" height="8" fill="#f2c94c"/>
          <circle cx="240" cy="295" r="20" fill="#222"/><circle cx="450" cy="295" r="20" fill="#222"/>`,
  },
  equipe: {
    sky: '#b6d3df',
    ground: '#717a6c',
    label: 'Equipe em operacao (ilustrativo)',
    art: `<g fill="#1d3435"><circle cx="250" cy="185" r="16"/><rect x="236" y="203" width="28" height="70" rx="6"/>
          <circle cx="330" cy="180" r="16"/><rect x="316" y="198" width="28" height="75" rx="6"/></g>
          <g fill="#f2b526"><rect x="236" y="225" width="28" height="6"/><rect x="316" y="222" width="28" height="6"/></g>
          <path d="M344 220 C 420 200 480 215 540 260" stroke="#e9eef0" stroke-width="10" fill="none"/>`,
  },
  area: {
    sky: '#c9dde5',
    ground: '#8a8f86',
    label: 'Area afetada (ilustrativo)',
    art: `<rect x="160" y="200" width="160" height="100" fill="#7a8088"/><rect x="360" y="170" width="200" height="130" fill="#6d737b"/>
          <path d="M120 300 L 600 300" stroke="#f2b526" stroke-width="6" stroke-dasharray="18 12"/>`,
  },
  contencao: {
    sky: '#b9cdd6',
    ground: '#5f6a63',
    label: 'Contencao e isolamento (ilustrativo)',
    art: `<ellipse cx="360" cy="285" rx="150" ry="30" fill="#2f3b44" opacity="0.8"/>
          <g stroke="#f2b526" stroke-width="8"><path d="M190 300 L 530 300"/></g>
          <g fill="#e8eef0"><rect x="200" y="260" width="10" height="40"/><rect x="520" y="260" width="10" height="40"/></g>`,
  },
};

export function syntheticPhoto(scene: SyntheticScene, index: number): string {
  const s = SCENES[scene];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="440" viewBox="0 0 720 440">
  <rect width="720" height="320" fill="${s.sky}"/><rect y="300" width="720" height="140" fill="${s.ground}"/>
  ${s.art}
  <rect x="0" y="380" width="720" height="60" fill="rgba(0,0,0,0.55)"/>
  <text x="24" y="416" font-family="Segoe UI, Arial, sans-serif" font-size="22" fill="#ffffff">${s.label} #${index}</text>
  <text x="696" y="416" text-anchor="end" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700" fill="#f2b526">IMAGEM SINTETICA - DEMO</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const SCENE_CAPTIONS: Record<SyntheticScene, string> = {
  fogo: 'Foco identificado na chegada da equipe',
  viatura: 'Viatura posicionada em local seguro',
  equipe: 'Equipe realizando linha preventiva',
  area: 'Visão geral da área afetada',
  contencao: 'Contenção e isolamento da área',
};

export const ALL_SCENES: SyntheticScene[] = ['fogo', 'viatura', 'equipe', 'area', 'contencao'];
