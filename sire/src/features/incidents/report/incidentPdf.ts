/**
 * Renderização do relatório da ocorrência em PDF (A4, jsPDF).
 * Toda página traz faixa e marca d'água "DEMONSTRAÇÃO · DADOS FICTÍCIOS".
 * Assinaturas são SIMULADAS e declaradas como sem validade jurídica.
 */
import type { jsPDF as JsPDF } from 'jspdf';
import type { ReportKV, ReportModel } from './reportModel';
import { formatDateTime } from '../../../domain/time';

const PAGE_W = 210;
const PAGE_H = 297;
const M = 14; // margem
const CONTENT_W = PAGE_W - 2 * M;
const BOTTOM = PAGE_H - 18;

const BRAND: [number, number, number] = [0, 126, 121];
const INK: [number, number, number] = [29, 52, 53];
const MUTED: [number, number, number] = [101, 122, 123];
const LINE: [number, number, number] = [205, 216, 216];
const BAND: [number, number, number] = [235, 242, 242];

/** As fontes padrão do PDF usam WinAnsi: troca caracteres fora desse conjunto. */
export function pdfSafe(text: string): string {
  return text
    .replace(/→/g, '->')
    .replace(/[≥]/g, '>=')
    .replace(/[≤]/g, '<=')
    .replace(/²/g, '2')
    .replace(/₂/g, '2')
    .replace(/[✓✔]/g, 'v')
    .replace(/[^\t\n\r\u0020-\u00FF\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u2026]/g, '');
}

async function rasterize(dataUrl: string, mime: string): Promise<{ data: string; format: 'JPEG' | 'PNG'; ratio: number } | null> {
  if (mime === 'image/jpeg' || mime === 'image/png') {
    const ratio = await new Promise<number>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.height / img.width || 0.61);
      img.onerror = () => resolve(0.61);
      img.src = dataUrl;
    });
    return { data: dataUrl, format: mime === 'image/png' ? 'PNG' : 'JPEG', ratio };
  }
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = dataUrl;
    });
    const w = img.naturalWidth || 720;
    const h = img.naturalHeight || 440;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return { data: canvas.toDataURL('image/jpeg', 0.85), format: 'JPEG', ratio: h / w };
  } catch {
    return null;
  }
}

export async function renderIncidentPdf(model: ReportModel, generatedBy: string, now = new Date()): Promise<JsPDF> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({ title: `Relatório ${model.protocol} (DEMONSTRAÇÃO)`, subject: 'SIRE — dados fictícios', creator: 'SIRE demo', author: 'SIRE (demonstração)' });
  let y = 0;

  const watermark = () => {
    doc.saveGraphicsState();
    doc.setTextColor(238, 243, 243);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(46);
    doc.text(pdfSafe('DEMONSTRAÇÃO · DADOS FICTÍCIOS'), PAGE_W / 2, PAGE_H / 2 + 20, { align: 'center', angle: 35 });
    doc.restoreGraphicsState();
  };

  const header = (first: boolean) => {
    watermark();
    doc.setFillColor(...BRAND);
    doc.rect(0, 0, PAGE_W, first ? 26 : 14, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(first ? 13 : 9);
    doc.text(pdfSafe(first ? 'SIRE · Relatório de Atendimento à Ocorrência' : `SIRE · ${model.protocol}`), M, first ? 11 : 9);
    if (first) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(pdfSafe('Sistema Integrado de Resposta à Emergência · projeto demonstrativo independente'), M, 17);
    }
    // selo DEMONSTRAÇÃO
    const sw = 38;
    doc.setFillColor(242, 181, 38);
    doc.roundedRect(PAGE_W - M - sw, first ? 7 : 3.5, sw, 7, 1.5, 1.5, 'F');
    doc.setTextColor(43, 32, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(pdfSafe('DEMONSTRAÇÃO'), PAGE_W - M - sw / 2, first ? 11.8 : 8.3, { align: 'center' });
    y = first ? 34 : 22;
    doc.setTextColor(...INK);
  };

  const ensure = (h: number) => {
    if (y + h > BOTTOM) {
      doc.addPage();
      header(false);
    }
  };

  const section = (title: string) => {
    ensure(14);
    doc.setFillColor(...BAND);
    doc.rect(M, y, CONTENT_W, 7, 'F');
    doc.setFillColor(...BRAND);
    doc.rect(M, y, 1.4, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    doc.text(pdfSafe(title.toUpperCase()), M + 4, y + 4.9);
    y += 10;
  };

  const kvGrid = (items: ReportKV[], cols = 4) => {
    const colW = CONTENT_W / cols;
    for (let i = 0; i < items.length; i += cols) {
      const row = items.slice(i, i + cols);
      const heights = row.map((it) => doc.splitTextToSize(pdfSafe(it.value), colW - 3).length);
      const h = 4 + Math.max(...heights) * 4.2 + 2;
      ensure(h);
      row.forEach((it, j) => {
        const x = M + j * colW;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...MUTED);
        doc.text(pdfSafe(it.label.toUpperCase()), x, y + 2.5);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...INK);
        doc.text(doc.splitTextToSize(pdfSafe(it.value), colW - 3), x, y + 6.5);
      });
      y += h;
    }
    y += 1;
  };

  const paragraph = (text: string) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    const lines = doc.splitTextToSize(pdfSafe(text), CONTENT_W);
    for (const line of lines) {
      ensure(4.6);
      doc.text(line, M, y + 3.2);
      y += 4.4;
    }
    y += 2;
  };

  const table = (headers: string[], rows: string[][], widths: number[], empty = 'Nenhum registro.') => {
    const total = widths.reduce((a, b) => a + b, 0);
    const ws = widths.map((w) => (w / total) * CONTENT_W);
    const drawHead = () => {
      ensure(7);
      doc.setFillColor(246, 248, 248);
      doc.rect(M, y, CONTENT_W, 6, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      let x = M;
      headers.forEach((h, i) => {
        doc.text(pdfSafe(h.toUpperCase()), x + 1.5, y + 4.1);
        x += ws[i] as number;
      });
      y += 6;
    };
    drawHead();
    if (rows.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(...MUTED);
      doc.text(pdfSafe(empty), M + 1.5, y + 4);
      y += 7;
      return;
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    for (const r of rows) {
      const cells = r.map((c, i) => doc.splitTextToSize(pdfSafe(c), (ws[i] as number) - 3) as string[]);
      const h = Math.max(...cells.map((c) => c.length)) * 3.9 + 2.6;
      if (y + h > BOTTOM) {
        doc.addPage();
        header(false);
        drawHead();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
      }
      doc.setTextColor(...INK);
      let x = M;
      cells.forEach((c, i) => {
        doc.text(c, x + 1.5, y + 3.6);
        x += ws[i] as number;
      });
      y += h;
      doc.setDrawColor(...LINE);
      doc.line(M, y, M + CONTENT_W, y);
    }
    y += 3;
  };

  // ------------------------------------------------------------ conteúdo
  header(true);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(pdfSafe(model.protocol), M, y + 2);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED);
  doc.text(pdfSafe(`Status: ${model.status}`), PAGE_W - M, y + 2, { align: 'right' });
  y += 7;
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  const titleLines = doc.splitTextToSize(pdfSafe(model.title), CONTENT_W);
  doc.text(titleLines, M, y + 2);
  y += titleLines.length * 5 + 4;

  section('Identificação');
  kvGrid(model.identification);
  section('Local e responsáveis');
  kvGrid(model.location, 3);
  section('Fatos');
  kvGrid(model.facts);
  paragraph(model.description);

  section('Tempo resposta · marcos');
  table(['Marco', 'Horário (Brasília)'], model.milestones, [3, 2]);
  section('Indicadores de tempo (definições parametrizáveis)');
  table(['Indicador', 'Definição', 'Resultado', 'Meta (exemplo)'], model.durations, [2.2, 3.6, 1.4, 1.2]);

  section('Recursos utilizados');
  table(['Viatura', 'Descrição', 'Km inicial', 'Km final', 'Km rodados'], model.vehicles, [1.2, 2.6, 1.1, 1.1, 1.1], 'Nenhuma viatura vinculada.');
  table(['Efetivo (fictício)', 'Função na ocorrência'], model.personnel, [3, 3], 'Efetivo não registrado.');
  if (model.otherResources.length) table(['Categoria', 'Recurso', 'Qtd.'], model.otherResources, [2, 4, 0.8]);
  kvGrid(model.combat);

  section('Vítimas (pseudonimizadas)');
  table(['Identificação', 'Condição', 'Destino', 'Vínculo'], model.victims, [1.4, 2, 2, 1.6], 'Sem vítimas detalhadas.');
  section('Testemunhas');
  table(['Nome (fictício)', 'Registrado em', 'Depoimento'], model.witnesses, [1.6, 1.4, 5], 'Sem depoimentos.');
  section('Acionamentos registrados (simulados)');
  table(['Órgão / função', 'Horário', 'Registrado por'], model.notifications, [3, 1.6, 2.4], 'Nenhum acionamento registrado.');
  section('Histórico da ocorrência');
  table(['Quando', 'Evento', 'Detalhe'], model.history, [1.4, 2, 4.6]);

  if (model.photos.length) {
    section('Registro fotográfico');
    const colW = (CONTENT_W - 6) / 2;
    let col = 0;
    let rowH = 0;
    for (const p of model.photos) {
      const img = await rasterize(p.dataUrl, p.mimeType);
      const h = colW * (img?.ratio ?? 0.61);
      if (col === 0) {
        ensure(h + 10);
        rowH = 0;
      }
      const x = M + col * (colW + 6);
      doc.setDrawColor(...LINE);
      if (img) {
        doc.addImage(img.data, img.format, x, y, colW, h);
      } else {
        doc.rect(x, y, colW, h);
        doc.setFontSize(8);
        doc.text('Imagem indisponível', x + colW / 2, y + h / 2, { align: 'center' });
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(doc.splitTextToSize(pdfSafe(p.caption), colW), x, y + h + 4);
      doc.setTextColor(...INK);
      rowH = Math.max(rowH, h + 9);
      col++;
      if (col === 2) {
        col = 0;
        y += rowH;
      }
    }
    if (col === 1) y += rowH;
  }

  section('Encerramento');
  if (model.closing.cancelReason) {
    kvGrid([{ label: 'Justificativa do cancelamento', value: model.closing.cancelReason }], 1);
  }
  kvGrid(
    [
      { label: 'Encerrada/cancelada em', value: model.closing.closedAt || 'Em aberto' },
      { label: 'Por', value: model.closing.closedBy || '—' },
    ],
    2,
  );
  if (model.closing.summary) paragraph(model.closing.summary);

  // Assinaturas simuladas
  ensure(34);
  y += 2;
  const sigW = (CONTENT_W - 8) / 2;
  model.signatures.forEach((s, i) => {
    const x = M + i * (sigW + 8);
    doc.setDrawColor(...LINE);
    doc.roundedRect(x, y, sigW, 28, 2, 2);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(pdfSafe(`${s.role.toUpperCase()} · ASSINATURA SIMULADA`), x + 3, y + 5);
    doc.setFont('times', 'italic');
    doc.setFontSize(14);
    doc.setTextColor(...BRAND);
    doc.text(pdfSafe(s.name), x + 3, y + 15);
    doc.setDrawColor(...MUTED);
    doc.line(x + 3, y + 18, x + sigW - 3, y + 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(pdfSafe(`${s.name}${s.at ? ` · ${s.at}` : ''}`), x + 3, y + 22.5);
    doc.text(pdfSafe('Sem validade jurídica — demonstração'), x + 3, y + 26);
  });
  y += 32;

  // Rodapé em todas as páginas
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LINE);
    doc.line(M, PAGE_H - 13, PAGE_W - M, PAGE_H - 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(pdfSafe(`Gerado pelo SIRE em ${formatDateTime(now.toISOString())} por ${generatedBy} · Protocolo ${model.protocol}`), M, PAGE_H - 9);
    doc.text(pdfSafe('PROJETO DEMONSTRATIVO · DADOS FICTÍCIOS · NÃO OFICIAL'), M, PAGE_H - 5.5);
    doc.text(`${p} / ${pages}`, PAGE_W - M, PAGE_H - 9, { align: 'right' });
  }
  return doc;
}

export async function downloadIncidentPdf(model: ReportModel, generatedBy: string): Promise<void> {
  const doc = await renderIncidentPdf(model, generatedBy);
  doc.save(`SIRE_${model.protocol}_DEMO.pdf`);
}

export async function openIncidentPdf(model: ReportModel, generatedBy: string): Promise<string> {
  const doc = await renderIncidentPdf(model, generatedBy);
  return String(doc.output('bloburl'));
}
