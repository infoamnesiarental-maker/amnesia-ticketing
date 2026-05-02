"use client";

import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { useEffect, useMemo, useRef, useState } from "react";

import { checkInByUidManualAction, checkInTicketAction, searchDoorTicketsAction } from "./actions";

interface DoorEvent {
  id: string;
  name: string;
  starts_at: string | null;
  place: string | null;
}

interface CheckinUiResult {
  ok: boolean;
  code: string;
  message: string;
  checkedInAt?: string;
  ticketUid?: string;
  ticketTypeName?: string;
}

interface ManualFoundItem {
  uid: string;
  status: string;
  ticketTypeName: string;
  attendeeName: string;
  attendeeDni: string;
  attendeePhone: string;
  buyerEmail: string;
  isBuyer: boolean;
  issuedAt: string;
}

function formatDate(iso: string | null): string {
  if (!iso) return "Sin fecha";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" });
}

function colorByCode(code: string): string {
  if (code === "ok_first_checkin") return "border-emerald-400/35 bg-emerald-500/10 text-emerald-100";
  if (code === "already_checked_in") return "border-amber-400/35 bg-amber-500/10 text-amber-100";
  return "border-red-400/35 bg-red-500/10 text-red-100";
}

function normalizeUid(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    return (url.searchParams.get("uid") || trimmed).trim();
  } catch {
    return trimmed;
  }
}

export function DoorScannerClient({ events }: { events: DoorEvent[] }) {
  const defaultEventId = events[0]?.id ?? "";
  const [selectedEventId, setSelectedEventId] = useState(defaultEventId);
  const [activeView, setActiveView] = useState<"scanner" | "lista">("scanner");
  const [scanning, setScanning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [result, setResult] = useState<CheckinUiResult | null>(null);
  const [cameraError, setCameraError] = useState("");
  /** getUserMedia disponible (HTTPS / permisos / navegador) */
  const [cameraCapable, setCameraCapable] = useState(false);
  /** Chrome/Edge: BarcodeDetector; resto: fallback ZXing sobre el mismo video */
  const [useNativeDetector, setUseNativeDetector] = useState(false);
  const [dniQuery, setDniQuery] = useState("");
  const [manualFound, setManualFound] = useState<ManualFoundItem[]>([]);
  const [manualInfo, setManualInfo] = useState("");
  const [isSearchingDni, setIsSearchingDni] = useState(false);
  const [manualBusyUid, setManualBusyUid] = useState("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<any>(null);
  const zxingReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const zxingControlsRef = useRef<{ stop: () => void } | null>(null);
  const rafRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  const lastUidRef = useRef("");
  const lastReadAtRef = useRef(0);
  const deviceId = useMemo(() => {
    if (typeof window === "undefined") return "";
    const key = "door_scanner_device_id";
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const next = `door-${crypto.randomUUID()}`;
    window.localStorage.setItem(key, next);
    return next;
  }, []);

  useEffect(() => {
    const hasCamera =
      typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function";
    const hasNative = typeof window !== "undefined" && "BarcodeDetector" in window;
    setCameraCapable(hasCamera);
    setUseNativeDetector(hasNative);
  }, []);

  useEffect(() => {
    return () => {
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitCheckin(rawText: string) {
    const uid = normalizeUid(rawText);
    if (!uid || !selectedEventId || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await checkInTicketAction({ eventId: selectedEventId, qrText: uid, deviceId });
      setResult(res);
      if (res.ok && res.code === "ok_first_checkin") {
        setSessionCount((v) => v + 1);
        if (typeof window !== "undefined" && "vibrate" in window.navigator) window.navigator.vibrate(45);
      } else if (typeof window !== "undefined" && "vibrate" in window.navigator) {
        window.navigator.vibrate([35, 35, 35]);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSearchByDni() {
    if (!selectedEventId || isSearchingDni) return;
    setIsSearchingDni(true);
    setManualInfo("");
    setManualFound([]);
    try {
      const res = await searchDoorTicketsAction({ eventId: selectedEventId, query: dniQuery });
      setManualInfo(res.message);
      setManualFound(res.items);
    } finally {
      setIsSearchingDni(false);
    }
  }

  useEffect(() => {
    if (activeView !== "lista" || !selectedEventId) return;
    void handleSearchByDni();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, selectedEventId]);

  async function handleManualCheckin(uid: string) {
    if (!selectedEventId || !uid || manualBusyUid) return;
    setManualBusyUid(uid);
    try {
      const res = await checkInByUidManualAction({ eventId: selectedEventId, ticketUid: uid, deviceId });
      setResult(res);
      if (res.ok && res.code === "ok_first_checkin") {
        setSessionCount((v) => v + 1);
        setManualFound((items) =>
          items.map((item) => (item.uid === uid ? { ...item, status: "checked_in" } : item)),
        );
      }
    } finally {
      setManualBusyUid("");
    }
  }

  async function startScanner() {
    setCameraError("");
    setResult(null);
    if (!cameraCapable) {
      setCameraError(
        "Este navegador no puede abrir la cámara desde esta página (probá HTTPS, actualizar el navegador o revisar permisos). Podés usar la lista de puerta como alternativa.",
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();

      if (useNativeDetector) {
        const DetectorCtor = (window as any).BarcodeDetector;
        detectorRef.current = new DetectorCtor({ formats: ["qr_code"] });
        setScanning(true);
        scanLoop();
        return;
      }

      const hints = new Map<DecodeHintType, unknown>();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
      const reader = new BrowserMultiFormatReader(hints);
      zxingReaderRef.current = reader;
      const controls = await reader.decodeFromStream(stream, video, (result, _err) => {
        if (!result) return;
        const raw = String(result.getText() ?? "").trim();
        if (!raw) return;
        const uid = normalizeUid(raw);
        const now = Date.now();
        if (uid === lastUidRef.current && now - lastReadAtRef.current < 1500) return;
        lastUidRef.current = uid;
        lastReadAtRef.current = now;
        void (async () => {
          if (busyRef.current) return;
          busyRef.current = true;
          await submitCheckin(uid);
          busyRef.current = false;
        })();
      });
      zxingControlsRef.current = controls;
      setScanning(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : "No se pudo iniciar la cámara.";
      setCameraError(message);
      stopScanner();
    }
  }

  function stopScanner() {
    if (rafRef.current != null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (zxingControlsRef.current) {
      try {
        zxingControlsRef.current.stop();
      } catch {
        /* no-op */
      }
      zxingControlsRef.current = null;
    }
    zxingReaderRef.current = null;
    detectorRef.current = null;
    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) t.stop();
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
    busyRef.current = false;
  }

  function scanLoop() {
    rafRef.current = window.requestAnimationFrame(async () => {
      const video = videoRef.current;
      const detector = detectorRef.current;
      if (!video || !detector || video.readyState < 2) {
        scanLoop();
        return;
      }
      if (busyRef.current) {
        scanLoop();
        return;
      }
      try {
        const barcodes = await detector.detect(video);
        const raw = String(barcodes?.[0]?.rawValue ?? "").trim();
        if (raw) {
          const uid = normalizeUid(raw);
          const now = Date.now();
          if (!(uid === lastUidRef.current && now - lastReadAtRef.current < 1500)) {
            lastUidRef.current = uid;
            lastReadAtRef.current = now;
            busyRef.current = true;
            await submitCheckin(uid);
            busyRef.current = false;
          }
        }
      } catch {
        // no-op
      }
      scanLoop();
    });
  }

  const selectedEvent = events.find((e) => e.id === selectedEventId);
  const hasEvents = events.length > 0;
  const totalList = manualFound.length;
  const checkedIn = manualFound.filter((i) => i.status === "checked_in").length;
  const voided = manualFound.filter((i) => i.status === "void").length;
  const remaining = manualFound.filter((i) => i.status === "issued").length;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Puerta · Escáner QR</h1>
          <p className="mt-1 text-sm text-white/65">Seleccioná evento, activá cámara y empezá a validar ingresos.</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/70">
          Escaneados en esta sesión: <span className="font-semibold text-white">{sessionCount}</span>
        </div>
      </div>

      <div className="mt-5 surface-glass p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveView("scanner")}
            className={`min-h-[40px] rounded-full border px-4 text-xs font-semibold transition ${
              activeView === "scanner"
                ? "border-brand/50 bg-brand/15 text-white"
                : "border-white/15 bg-white/[0.03] text-white/70 hover:bg-white/[0.08]"
            }`}
          >
            Escáner QR
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveView("lista");
              stopScanner();
            }}
            className={`min-h-[40px] rounded-full border px-4 text-xs font-semibold transition ${
              activeView === "lista"
                ? "border-brand/50 bg-brand/15 text-white"
                : "border-white/15 bg-white/[0.03] text-white/70 hover:bg-white/[0.08]"
            }`}
          >
            Lista de puerta (manual)
          </button>
        </div>

        <label className="grid gap-2 text-sm font-medium text-white/90">
          Evento
          <select
            className="input-design h-11"
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            disabled={isSubmitting || !hasEvents}
          >
            {hasEvents ? (
              events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                </option>
              ))
            ) : (
              <option value="">No hay eventos disponibles</option>
            )}
          </select>
        </label>
        {selectedEvent ? (
          <p className="mt-2 text-xs text-white/55">
            {formatDate(selectedEvent.starts_at)}
            {selectedEvent.place ? ` · ${selectedEvent.place}` : ""}
          </p>
        ) : null}

        {activeView === "scanner" ? (
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              {!scanning ? (
                <button
                  type="button"
                  className="btn-cta-primary min-h-[46px] px-5 text-sm"
                  onClick={startScanner}
                  disabled={!selectedEventId || isSubmitting || !hasEvents}
                >
                  Iniciar escáner
                </button>
              ) : (
                <button
                  type="button"
                  className="min-h-[46px] rounded-full border border-white/20 bg-white/[0.06] px-5 text-sm font-semibold text-white transition hover:bg-white/[0.12]"
                  onClick={stopScanner}
                >
                  Detener escáner
                </button>
              )}
            </div>
            {!hasEvents ? (
              <p className="mt-3 text-xs text-amber-200">Primero necesitás crear al menos un evento para usar el escáner.</p>
            ) : null}

            <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-black/45">
              <div className="relative aspect-[4/3] w-full">
                <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
                {!scanning ? (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-white/60">
                    Cámara inactiva
                  </div>
                ) : null}
              </div>
            </div>
            {scanning && !useNativeDetector ? (
              <p className="mt-2 text-xs text-white/50">
                Modo compatible: tu navegador no trae el lector nativo de QR; usamos uno por software (un poco más lento,
                misma cámara).
              </p>
            ) : null}
            {cameraError ? <p className="mt-2 text-xs text-red-300">{cameraError}</p> : null}
          </>
        ) : (
          <p className="mt-2 text-xs text-white/55">Usá el buscador de la vista Lista para marcar ingresos manuales.</p>
        )}
      </div>

      {activeView === "lista" ? (
        <div className="mt-5 surface-glass p-4 sm:p-5">
          <p className="text-sm font-semibold text-white">Lista de puerta</p>
          <p className="mt-1 text-xs text-white/55">
            Buscá por nombre o DNI y marcá ingreso manual desde la tabla.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
              <p className="text-[11px] uppercase tracking-wider text-white/45">En lista</p>
              <p className="mt-1 text-xl font-bold text-white tabular-nums">{totalList}</p>
            </div>
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wider text-emerald-200/80">Ingresaron</p>
              <p className="mt-1 text-xl font-bold text-emerald-100 tabular-nums">{checkedIn}</p>
            </div>
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wider text-amber-200/80">Faltan</p>
              <p className="mt-1 text-xl font-bold text-amber-100 tabular-nums">{remaining}</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-white/45">Anuladas: {voided}</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            className="input-design h-11 flex-1"
            value={dniQuery}
            onChange={(e) => setDniQuery(e.target.value)}
            placeholder="Buscar nombre o DNI..."
            disabled={isSearchingDni || isSubmitting}
          />
          <button
            type="button"
            className="btn-cta-primary min-h-[44px] justify-center px-4 text-sm sm:w-auto"
            onClick={handleSearchByDni}
              disabled={!selectedEventId || isSearchingDni || isSubmitting}
          >
            {isSearchingDni ? "Buscando…" : "Buscar"}
          </button>
        </div>
        {manualInfo ? <p className="mt-3 text-xs text-white/70">{manualInfo}</p> : null}

        {manualFound.length > 0 ? (
          <div className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-black/20">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-white/5 text-[11px] uppercase tracking-wider text-white/55">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Nombre y apellido</th>
                  <th className="px-3 py-2.5 font-medium">DNI</th>
                  <th className="px-3 py-2.5 font-medium">Ingreso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {manualFound.map((item) => {
                  const checked = item.status === "checked_in";
                  const voided = item.status === "void";
                  return (
                    <tr key={item.uid} className="hover:bg-white/[0.03]">
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-white">{item.attendeeName}</p>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-white/80">{item.attendeeDni || "—"}</td>
                      <td className="px-3 py-2.5">
                        {checked ? (
                          <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-100">
                            Ya ingresó
                          </span>
                        ) : voided ? (
                          <span className="rounded-full border border-red-400/40 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-100">
                            Anulada
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="min-h-[40px] rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/25 disabled:opacity-50"
                            onClick={() => handleManualCheckin(item.uid)}
                            disabled={Boolean(manualBusyUid)}
                          >
                            {manualBusyUid === item.uid ? "Marcando…" : "Marcar ingreso manual"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
        </div>
      ) : null}

      {result ? (
        <div className={`mt-5 rounded-xl border px-4 py-3 ${colorByCode(result.code)}`}>
          <p className="text-sm font-semibold">{result.message}</p>
          <p className="mt-1 text-xs opacity-90">
            {result.ticketTypeName ? `Tipo: ${result.ticketTypeName}` : "Entrada"}
            {result.ticketUid ? ` · UID: ${result.ticketUid}` : ""}
          </p>
          {result.checkedInAt ? (
            <p className="mt-1 text-xs opacity-80">Hora: {formatDate(result.checkedInAt)}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
