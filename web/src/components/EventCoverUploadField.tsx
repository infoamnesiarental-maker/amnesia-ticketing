"use client";

import Image from "next/image";
import { useId, useState, useTransition } from "react";

import { uploadEventCoverImage } from "@/app/app/actions";
import { EVENT_COVER_MAX_BYTES } from "@/lib/upload-limits";

interface EventCoverUploadFieldProps {
  imageUrl: string;
  onImageUrlChange: (url: string) => void;
  disabled?: boolean;
}

export function EventCoverUploadField({ imageUrl, onImageUrlChange, disabled }: EventCoverUploadFieldProps) {
  const inputId = useId();
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [uploading, startUpload] = useTransition();

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || disabled) return;
    if (file.size > EVENT_COVER_MAX_BYTES) {
      const mb = (EVENT_COVER_MAX_BYTES / (1024 * 1024)).toFixed(0);
      setLocalErr(`La imagen es demasiado pesada. Máximo ${mb} MB.`);
      return;
    }
    setLocalErr(null);
    const fd = new FormData();
    fd.set("file", file);
    startUpload(async () => {
      const res = await uploadEventCoverImage(fd);
      if ("error" in res) {
        setLocalErr(res.error);
        return;
      }
      onImageUrlChange(res.publicUrl);
    });
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-white/90">Imagen de tapa</p>
          <p className="mt-1 text-xs text-white/50">
            JPG, PNG o WebP · máx. {(EVENT_COVER_MAX_BYTES / (1024 * 1024)).toFixed(0)} MB. Se muestra en la home y en la card.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onFileChange} disabled={disabled || uploading} />
          <label
            htmlFor={inputId}
            className="inline-flex cursor-pointer items-center justify-center rounded-full border border-brand/50 bg-brand/15 px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? "Subiendo…" : "Subir imagen"}
          </label>
          {imageUrl ? (
            <button
              type="button"
              className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10 disabled:opacity-50"
              onClick={() => onImageUrlChange("")}
              disabled={disabled || uploading}
            >
              Quitar
            </button>
          ) : null}
        </div>
      </div>

      {localErr ? <p className="text-xs text-red-300">{localErr}</p> : null}

      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
        {imageUrl ? (
          <Image src={imageUrl} alt="" fill className="object-cover" sizes="(max-width: 640px) 100vw, 36rem" unoptimized />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-brand/10 via-white/[0.03] to-transparent p-6 text-center">
            <p className="text-sm text-white/45">Todavía no hay tapa</p>
            <p className="text-xs text-white/35">Subí una imagen con el botón de arriba</p>
          </div>
        )}
      </div>
    </div>
  );
}
