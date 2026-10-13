import { importDocument, type DocumentImportOptions } from "../src/lib/documentImport";
import { analyzeLocally } from "../src/lib/analyzeLocally";
import { evaluationFields, evaluationFieldValue, evaluationFieldConfidence, evaluationMatches, evaluationRules, textSimilarity, type EvaluationCase } from "../src/lib/evaluation";

/** A portrait phone capture: wrapped text, page margins, slight camera rotation. */
async function phonePages(text: string): Promise<Blob[]> {
  const width = 1200, height = 1800, margin = 85, lineHeight = 40;
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d")!;
  context.font = "27px Arial";
  const lines = text.split("\n").flatMap((paragraph) => {
    const wrapped: string[] = [];
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && context.measureText(next).width > width - margin * 2) { wrapped.push(line); line = word; }
      else line = next;
    }
    wrapped.push(line);
    return wrapped;
  });
  const pageLines = Math.floor((height - margin * 2) / lineHeight);
  const pages: Blob[] = [];
  for (let offset = 0; offset < lines.length; offset += pageLines) {
    context.fillStyle = "#e6e6e6"; context.fillRect(0, 0, width, height);
    context.save();
    context.translate(width / 2, height / 2); context.rotate(0.2 * Math.PI / 180); context.translate(-width / 2, -height / 2);
    context.fillStyle = "#fff"; context.fillRect(30, 20, width - 60, height - 40);
    context.fillStyle = "#171717"; context.textBaseline = "top"; context.font = "27px Arial";
    lines.slice(offset, offset + pageLines).forEach((line, index) => context.fillText(line, margin, margin + index * lineHeight));
    context.restore();
    pages.push(await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Cannot render phone image")), "image/png")));
  }
  return pages;
}

export async function evaluateUpload(sample: EvaluationCase, pdfBase64: string, assets: DocumentImportOptions["ocrAssets"]) {
  const pdf = new File([Uint8Array.from(atob(pdfBase64), (letter) => letter.charCodeAt(0))], "evaluation.pdf", { type: "application/pdf" });
  const extractedPdf = await importDocument(pdf, { ocrAssets: assets });
  const imagePages = await phonePages(sample.text);
  const imageResults = [];
  for (const [index, blob] of imagePages.entries()) imageResults.push(await importDocument(new File([blob], `page-${index + 1}.png`, { type: "image/png" }), { ocrAssets: assets }));
  const original = analyzeLocally(sample.text);
  return [
    { format: "pdf" as const, text: extractedPdf.text, pages: extractedPdf.pages },
    { format: "image" as const, text: imageResults.map((result) => result.text).join("\n\n"), pages: imageResults.flatMap((result, index) => result.pages.map((page) => ({ ...page, page: index + 1 }))) },
  ].map(({ format, text, pages }) => {
    const result = analyzeLocally(text);
    const similarity = textSimilarity(sample.text, text);
    const fields = evaluationFields.filter((field) => field in sample.expected).map((field) => {
      const actual = evaluationFieldValue(field, result), expected = sample.expected[field] ?? null;
      return { field, actual, expected, correct: evaluationMatches(field, actual, expected), confidence: evaluationFieldConfidence(field, result) };
    });
    return { name: sample.name, format, similarity, minimumSimilarity: evaluationRules.uploadSimilarity[format],
      originalBand: original.riskBand, band: result.riskBand, pages, fields,
      confidentlyWrong: fields.filter((field) => !field.correct && field.confidence >= evaluationRules.confidentWrongThreshold).length,
      ...((similarity < evaluationRules.uploadSimilarity[format] || original.riskBand !== result.riskBand) ? { extractedText: text } : {}) };
  });
}
