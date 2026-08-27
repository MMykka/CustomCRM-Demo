"use client";

import { useState } from "react";
import Papa from "papaparse";
import Link from "next/link";
import { ArrowLeft, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listContactMatchIndex, importContactsChunk, type TargetField } from "@/lib/actions/contacts-import";
import { downloadCsv } from "@/lib/csv";

const FIELD_OPTIONS: { value: TargetField; label: string }[] = [
  { value: "skip", label: "Skip this column" },
  { value: "first_name", label: "First name" },
  { value: "last_name", label: "Last name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "job_title", label: "Job title" },
  { value: "source", label: "Source" },
  { value: "lifecycle_stage", label: "Lifecycle stage" },
  { value: "company_name", label: "Company" },
  { value: "owner_email", label: "Owner (email)" },
  { value: "tag_names", label: "Tags" },
];

function guessMapping(header: string): TargetField {
  const h = header.toLowerCase().replace(/[^a-z]/g, "");
  if (h.includes("first")) return "first_name";
  if (h.includes("last")) return "last_name";
  if (h.includes("email") && !h.includes("owner")) return "email";
  if (h.includes("phone") || h.includes("mobile")) return "phone";
  if (h.includes("title") || h.includes("role")) return "job_title";
  if (h.includes("source")) return "source";
  if (h.includes("stage") || h.includes("lifecycle")) return "lifecycle_stage";
  if (h.includes("company") || h.includes("organization")) return "company_name";
  if (h.includes("owner")) return "owner_email";
  if (h.includes("tag")) return "tag_names";
  return "skip";
}

function normalizePhone(value: string) {
  return value.replace(/[^0-9]/g, "");
}

type Step = "upload" | "map" | "preview" | "importing" | "done";
type ParsedRow = Record<string, string>;
type PreviewRow = { rowIndex: number; values: ParsedRow; matchedContactId: string | null; matchLabel: string | null };
type DuplicateStrategy = "skip" | "update" | "create";
type ImportResult = { created: number; updated: number; skipped: number; errors: { rowIndex: number; reason: string }[] };

export function ImportWizard() {
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, TargetField>>({});
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [duplicateStrategy, setDuplicateStrategy] = useState<DuplicateStrategy>("skip");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<ImportResult>({ created: 0, updated: 0, skipped: 0, errors: [] });

  const duplicateCount = previewRows.filter((r) => r.matchedContactId).length;

  function handleFile(file: File) {
    setFileName(file.name);
    Papa.parse<ParsedRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const fields = results.meta.fields ?? [];
        setHeaders(fields);
        setRows(results.data);
        const guessed: Record<string, TargetField> = {};
        for (const h of fields) guessed[h] = guessMapping(h);
        setMapping(guessed);
        setStep("map");
      },
    });
  }

  async function proceedToPreview() {
    const matchIndex = await listContactMatchIndex();
    const byEmail = new Map(matchIndex.filter((m) => m.emailLower).map((m) => [m.emailLower!, m]));
    const byPhone = new Map(matchIndex.filter((m) => m.phoneNormalized).map((m) => [m.phoneNormalized!, m]));

    const emailHeader = Object.entries(mapping).find(([, t]) => t === "email")?.[0];
    const phoneHeader = Object.entries(mapping).find(([, t]) => t === "phone")?.[0];

    const preview: PreviewRow[] = rows.map((row, index) => {
      const email = emailHeader ? row[emailHeader]?.trim().toLowerCase() : "";
      const phone = phoneHeader ? normalizePhone(row[phoneHeader] ?? "") : "";
      const match = (email && byEmail.get(email)) || (phone && byPhone.get(phone)) || null;
      return {
        rowIndex: index,
        values: row,
        matchedContactId: match?.id ?? null,
        matchLabel: match ? match.fullNameLower || match.emailLower || "existing contact" : null,
      };
    });

    setPreviewRows(preview);
    setStep("preview");
  }

  async function runImport() {
    setStep("importing");
    const CHUNK_SIZE = 200;
    const chunks: PreviewRow[][] = [];
    for (let i = 0; i < previewRows.length; i += CHUNK_SIZE) chunks.push(previewRows.slice(i, i + CHUNK_SIZE));

    setProgress({ done: 0, total: previewRows.length });
    const aggregate: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };

    for (const chunk of chunks) {
      const chunkInput = chunk.map((r) => ({
        rowIndex: r.rowIndex,
        values: r.values,
        action: (r.matchedContactId ? duplicateStrategy : "create") as "create" | "update" | "skip",
        existingContactId: r.matchedContactId ?? undefined,
      }));
      const chunkResult = await importContactsChunk(chunkInput, mapping);
      aggregate.created += chunkResult.created;
      aggregate.updated += chunkResult.updated;
      aggregate.skipped += chunkResult.skipped;
      aggregate.errors.push(...chunkResult.errors);
      setProgress((p) => ({ ...p, done: p.done + chunk.length }));
    }

    setResult(aggregate);
    setStep("done");
  }

  function downloadErrorReport() {
    const errorRows = result.errors.map((e) => ({ ...previewRows[e.rowIndex]?.values, error: e.reason }));
    downloadCsv(`import-errors-${new Date().toISOString().slice(0, 10)}.csv`, errorRows);
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" nativeButton={false} render={<Link href="/contacts" />}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Import contacts</h1>
      </div>

      {step === "upload" ? (
        <div className="flex max-w-md flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
          <Upload className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Upload a CSV file to get started.</p>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>
      ) : null}

      {step === "map" ? (
        <div className="flex max-w-2xl flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            {fileName} · {rows.length} rows. Map each column to a contact field.
          </p>
          <div className="flex flex-col divide-y rounded-lg border">
            {headers.map((header) => (
              <div key={header} className="flex items-center justify-between gap-3 p-2.5">
                <span className="truncate text-sm font-medium">{header}</span>
                <Select
                  value={mapping[header] ?? "skip"}
                  onValueChange={(value) => setMapping((m) => ({ ...m, [header]: (value as TargetField) ?? "skip" }))}
                  items={FIELD_OPTIONS}
                >
                  <SelectTrigger className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <div>
            <Button onClick={proceedToPreview} disabled={!Object.values(mapping).some((v) => v !== "skip")}>
              Next: Preview
            </Button>
          </div>
        </div>
      ) : null}

      {step === "preview" ? (
        <div className="flex max-w-2xl flex-col gap-4">
          <div className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
            <p>
              {previewRows.length} rows · {duplicateCount} possible duplicate{duplicateCount === 1 ? "" : "s"} found (matched by email or phone against
              existing contacts)
            </p>
            {duplicateCount > 0 ? (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">For duplicates:</span>
                <Select
                  value={duplicateStrategy}
                  onValueChange={(v) => setDuplicateStrategy((v as DuplicateStrategy) ?? "skip")}
                  items={[
                    { value: "skip", label: "Skip" },
                    { value: "update", label: "Update existing" },
                    { value: "create", label: "Import as new anyway" },
                  ]}
                >
                  <SelectTrigger size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">Skip</SelectItem>
                    <SelectItem value="update">Update existing</SelectItem>
                    <SelectItem value="create">Import as new anyway</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>

          {duplicateCount > 0 ? (
            <div className="max-h-64 overflow-y-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Matches existing</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows
                    .filter((r) => r.matchedContactId)
                    .slice(0, 100)
                    .map((r) => (
                      <TableRow key={r.rowIndex}>
                        <TableCell>{r.rowIndex + 1}</TableCell>
                        <TableCell className="text-muted-foreground">{r.matchLabel}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          ) : null}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep("map")}>
              Back
            </Button>
            <Button onClick={runImport}>Import {previewRows.length} contacts</Button>
          </div>
        </div>
      ) : null}

      {step === "importing" ? (
        <div className="flex max-w-md flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            Importing {progress.done} of {progress.total}...
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
          </div>
        </div>
      ) : null}

      {step === "done" ? (
        <div className="flex max-w-md flex-col gap-3">
          <div className="rounded-lg border p-4 text-sm">
            <p>{result.created} created</p>
            <p>{result.updated} updated</p>
            <p>{result.skipped} skipped</p>
            <p className={result.errors.length ? "text-destructive" : ""}>{result.errors.length} errors</p>
          </div>
          <div className="flex gap-2">
            {result.errors.length > 0 ? (
              <Button variant="outline" onClick={downloadErrorReport}>
                Download error report
              </Button>
            ) : null}
            <Button nativeButton={false} render={<Link href="/contacts" />}>
              Done
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
