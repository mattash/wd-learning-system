"use client";

import { useState, type ChangeEvent } from "react";

import { Input } from "@/components/ui/input";

export function DocumentUploadField({
  onMessage,
  onUploaded,
}: {
  onMessage: (message: string) => void;
  onUploaded: (url: string) => void;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.set("file", file);
    setIsUploading(true);
    setStatus(null);

    try {
      const response = await fetch("/api/admin/uploads/documents", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as { error?: string; url?: string };

      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Failed to upload PDF.");
      }

      onUploaded(payload.url);
      onMessage("PDF uploaded. Save lesson to keep the document link.");
      setStatus(file.name);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to upload PDF.";
      onMessage(message);
      setStatus(null);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="space-y-2 md:col-span-2">
      <Input
        accept="application/pdf,.pdf"
        aria-label="Upload PDF"
        disabled={isUploading}
        onChange={handleChange}
        type="file"
      />
      <p className="text-xs text-muted-foreground">
        Uploads the PDF to Cloudflare R2 and fills the document URL automatically.
      </p>
      {status ? <p className="text-xs text-muted-foreground">Uploaded: {status}</p> : null}
    </div>
  );
}
