import { APP_NAME } from "@/lib/brand";
import { moneyCdf, moneyUsd, num } from "@/lib/format";
import type { PeriodFiche } from "@/lib/period-fiche";

function ymdFr(ymd: string) {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

function pdfStr(value: string) {
  let out = "";
  for (const ch of value) {
    if (ch === "\\" || ch === "(" || ch === ")") {
      out += `\\${ch}`;
      continue;
    }
    const code = ch.charCodeAt(0);
    if (code >= 32 && code <= 126) out += ch;
    else if (code <= 255) out += `\\${code.toString(8).padStart(3, "0")}`;
    else out += "?";
  }
  return `(${out})`;
}

function buildPdf(lines: string[]) {
  const pageW = 595;
  const pageH = 842;
  const margin = 42;
  const leading = 14;
  const maxY = pageH - 40;
  const pages: string[][] = [[]];
  let y = pageH - 48;
  for (const line of lines) {
    if (y < 48) {
      pages.push([]);
      y = pageH - 48;
    }
    pages[pages.length - 1]!.push(`1 0 0 1 ${margin} ${y} Tm ${pdfStr(line)} Tj`);
    y -= leading;
  }

  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  const pageIds: number[] = [];
  let nextId = 3;
  const fontId = nextId++;
  const contentIds: number[] = [];
  for (const page of pages) {
    const contentId = nextId++;
    const pageId = nextId++;
    contentIds.push(contentId);
    pageIds.push(pageId);
    objects[contentId - 1] = `<< /Length ${page.join("\n").length + 32} >>\nstream\nBT\n/F1 10 Tf\n${page.join("\n")}\nET\nendstream`;
    objects[pageId - 1] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`;
  }
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  objects[fontId - 1] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";

  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    if (!objects[i]) {
      objects[i] = "<< >>";
    }
    offsets[i + 1] = body.length;
    const obj = objects[i]!;
    if (obj.includes("stream")) body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
    else body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  }
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n`;
  body += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i++) {
    body += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return body;
}

export async function downloadPeriodFichePdf(fiche: PeriodFiche, company: string) {
  const lines: string[] = [
    company || APP_NAME,
    "Fiche de periode — CA au jour de livraison",
    `Du ${ymdFr(fiche.from)} au ${ymdFr(fiche.to)}`,
    "Les commandes comptent le jour ou le livreur clique Livrer.",
    "",
    `CA periode (hors livraison CDF)    ${moneyUsd(fiche.revenue)}`,
    `Ventes caisse / POS                ${num(fiche.posCount)}  ·  ${moneyUsd(fiche.posAmount)}`,
    `Livraisons encaissees              ${num(fiche.deliveredCount)}  ·  ${moneyUsd(fiche.deliveredAmount)}`,
    `Commandes saisies                  ${num(fiche.createdCount)}`,
    `Echecs / retours                   ${num(fiche.failedCount)}`,
    `Depenses                           ${moneyUsd(fiche.spent)}`,
    `Resultat                           ${moneyUsd(fiche.result)}`,
    `Encaisse USD                       ${moneyUsd(fiche.receivedUsd)}`,
    `Encaisse CDF                       ${moneyCdf(fiche.receivedCdf)}`,
    `Frais de livraison (hors CA)       ${moneyCdf(fiche.feesCdf)}`,
    "",
    "Produits les plus vendus",
    ...(fiche.topProducts.length
      ? fiche.topProducts.map((r) => `  ${r.label}  ·  ${num(r.qty)}  ·  ${moneyUsd(r.amount)}`)
      : ["  Aucune donnee"]),
    "",
    "Variantes les plus vendues",
    ...(fiche.topVariants.length
      ? fiche.topVariants.map((r) => `  ${r.label}  ·  ${num(r.qty)}  ·  ${moneyUsd(r.amount)}`)
      : ["  Aucune donnee"]),
    "",
    "Par livreur",
    ...(fiche.byDriver.length
      ? fiche.byDriver.map((r) => `  ${r.label}  ·  ${num(r.qty)}  ·  ${moneyUsd(r.amount)}`)
      : ["  Aucune donnee"]),
    "",
    "Par boutique",
    ...(fiche.byBoutique.length
      ? fiche.byBoutique.map((r) => `  ${r.label}  ·  ${num(r.qty)}  ·  ${moneyUsd(r.amount)}`)
      : ["  Aucune donnee"]),
    "",
    "Detail jour par jour",
    ...(fiche.byDay.length
      ? fiche.byDay.map((r) => `  ${ymdFr(r.day)}  POS ${moneyUsd(r.pos)}  ·  total ${moneyUsd(r.total)}`)
      : ["  Aucune donnee"]),
    "",
    `Edite le ${new Date().toLocaleString("fr-FR", { timeZone: "Africa/Kinshasa" })} · Kinshasa`,
  ];

  const pdf = buildPdf(lines);
  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fiche-${fiche.from}_${fiche.to}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
