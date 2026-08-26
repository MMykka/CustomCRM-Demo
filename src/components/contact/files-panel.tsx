"use client";

import { useRef, useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { Download, Paperclip, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { deleteFile, getSignedFileUrl, recordFileUpload } from "@/lib/actions/files";
import type { ContactFile } from "@/lib/types";

export type FileWithUploader = ContactFile & { uploader: { full_name: string | null; email: string } | null };

function formatBytes(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Uploads go straight from the browser to Supabase Storage (avoids the
// server action body-size limit for larger files); the server action only
// records the metadata row + issues signed URLs, since the bucket is
// private.
export function FilesPanel({ contactId, organizationId, files }: { contactId: string; organizationId: string; files: FileWithUploader[] }) {
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadFiles(fileList: FileList | File[]) {
    setIsUploading(true);
    const supabase = createClient();
    try {
      for (const file of Array.from(fileList)) {
        const path = `${organizationId}/${contactId}/${crypto.randomUUID()}-${file.name}`;
        const { error } = await supabase.storage.from("contact-files").upload(path, file);
        if (error) throw error;
        await recordFileUpload(contactId, { storagePath: path, fileName: file.name, mimeType: file.type || null, sizeBytes: file.size });
      }
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDownload(file: FileWithUploader) {
    const url = await getSignedFileUrl(file.storage_path);
    window.open(url, "_blank");
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center gap-1.5 rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground ${
          dragOver ? "border-primary bg-primary/5" : ""
        }`}
      >
        <Upload className="size-5" />
        <p>Drag files here, or</p>
        <Button variant="outline" size="sm" disabled={isUploading} onClick={() => inputRef.current?.click()}>
          {isUploading ? "Uploading..." : "Choose files"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <ul className="flex flex-col divide-y">
        {files.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">No files yet.</p>
        ) : (
          files.map((file) => (
            <li key={file.id} className="flex items-center gap-2 py-2 text-sm">
              <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{file.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(file.size_bytes)} · {formatDistanceToNow(new Date(file.created_at), { addSuffix: true })}
                </p>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={() => handleDownload(file)} title="Download">
                <Download className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={isPending}
                onClick={() => startTransition(() => deleteFile(file.id, contactId, file.storage_path))}
                title="Delete"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
