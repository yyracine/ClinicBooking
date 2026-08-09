import { jsPDF } from "jspdf";
import { formatFullDate, formatPrice } from "@/lib/clinic";

/**
 * Reçu / facture PDF d'un rendez-vous payé (P6). Reprend le style des PDF
 * existants (dossier médical, ordonnance) : en-tête teal, typographie
 * Helvetica, montants en FCFA.
 */

/** Normalize text for the PDF's WinAnsi encoding (French accents are fine). */
function pdfSafe(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2013/g, "-")
    .replace(/\u2014/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ");
}

export interface ReceiptData {
  /** Patient display name. */
  patientName: string;
  /** Patient dossier number (ex. "D-0001"), when available. */
  dossierNumber?: string | null;
  patientEmail?: string | null;
  serviceName: string;
  doctorName: string;
  doctorTitle?: string;
  date: string; // "yyyy-MM-dd"
  time: string; // "HH:mm"
  /** Full consultation price (FCFA). */
  price: number;
  /** Portion covered by the insurance (FCFA). */
  covered: number;
  /** Amount actually collected (FCFA). */
  amountPaid: number;
  paidAt?: number;
  notes?: string;
  /** Receipt reference — defaults to a sequential-looking id from the date. */
  reference?: string;
}

/** Build and download a formatted A4 receipt (reçu de paiement). */
export function downloadAppointmentReceipt(data: ReceiptData): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const PAGE_W = 210;
  const PAGE_H = 297;
  const MARGIN = 18;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  let y = 0;

  const ACCENT: [number, number, number] = [13, 148, 136];
  const DARK: [number, number, number] = [30, 41, 59];
  const MUTED: [number, number, number] = [100, 116, 139];
  const LIGHT: [number, number, number] = [241, 245, 249];

  const reference =
    data.reference ??
    `R-${data.date.replace(/-/g, "")}-${data.time.replace(":", "")}`;

  const paidOn = data.paidAt
    ? new Date(data.paidAt).toLocaleString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : formatFullDate(data.date);

  /* ---------- Header ---------- */
  doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.rect(0, 0, PAGE_W, 32, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text("CLINIC BOOKINGS", MARGIN, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Reçu de paiement", MARGIN, 22);
  doc.setFont("helvetica", "bold");
  doc.text(pdfSafe(reference), PAGE_W - MARGIN, 14, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(pdfSafe(`Encaissé le ${paidOn}`), PAGE_W - MARGIN, 22, {
    align: "right",
  });

  y = 46;

  /* ---------- Patient + consultation ---------- */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.text("CONSULTATION", MARGIN, y);
  y += 7;

  doc.setFontSize(15);
  doc.setTextColor(DARK[0], DARK[1], DARK[2]);
  doc.text(pdfSafe(data.patientName), MARGIN, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  const identity = [
    data.dossierNumber ? `Dossier ${data.dossierNumber}` : null,
    data.patientEmail ? pdfSafe(data.patientEmail) : null,
  ]
    .filter(Boolean)
    .join(" — ");
  if (identity) {
    doc.text(pdfSafe(identity), MARGIN, y);
    y += 5;
  }

  y += 4;

  /* ---------- Details table ---------- */
  const row = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(pdfSafe(label), MARGIN, y);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(DARK[0], DARK[1], DARK[2]);
    doc.text(pdfSafe(value), PAGE_W - MARGIN, y, { align: "right" });
    y += 6.5;
  };

  row("Service", data.serviceName);
  row(
    "Praticien",
    data.doctorName
      ? `${data.doctorName}${data.doctorTitle ? ` — ${data.doctorTitle}` : ""}`
      : "—",
  );
  row("Date", formatFullDate(data.date));
  row("Horaire", data.time);
  if (data.notes?.trim()) row("Notes", data.notes.trim());

  /* ---------- Totals block ---------- */
  y += 4;
  doc.setFillColor(LIGHT[0], LIGHT[1], LIGHT[2]);
  doc.roundedRect(MARGIN, y, CONTENT_W, 34, 2, 2, "F");

  const boxY = y;
  y += 9;
  row("Montant de la consultation", formatPrice(data.price));
  row("Pris en charge", `− ${formatPrice(data.covered)}`);

  y += 2;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(MARGIN + 6, y, PAGE_W - MARGIN - 6, y);
  y += 7;
  row("Total encaissé", formatPrice(data.amountPaid), true);

  /* Box footer reset */
  y = boxY + 34 + 4;

  /* ---------- Footer ---------- */
  doc.setFontSize(8);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(
    "Merci de votre confiance — ce document fait office de reçu officiel.",
    MARGIN,
    PAGE_H - 22,
  );
  doc.text("Document confidentiel — Clinic Bookings", MARGIN, PAGE_H - 17);

  doc.save(`${reference}.pdf`);
}
