"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { updateOrgLogo } from "@/lib/actions/organizations";
import { initialsFor } from "@/lib/types";

export function OrgLogoUpload({ organizationId, orgName, logoUrl }: { organizationId: string; orgName: string; logoUrl: string | null }) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(logoUrl);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    setIsUploading(true);
    try {
      const supabase = createClient();
      const path = `${organizationId}/${crypto.randomUUID()}-${file.name}`;
      const { error } = await supabase.storage.from("org-logos").upload(path, file);
      if (error) throw error;
      await updateOrgLogo({ storagePath: path });
      setPreviewUrl(URL.createObjectURL(file));
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className="size-14">
        <AvatarImage src={previewUrl ?? undefined} alt={orgName} />
        <AvatarFallback>{initialsFor(orgName)}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-1.5">
        <Button variant="outline" size="sm" disabled={isUploading} onClick={() => inputRef.current?.click()}>
          <Upload className="size-3.5" />
          {isUploading ? "Uploading..." : "Upload logo"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
