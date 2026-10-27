import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, FileText, Paperclip, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import hero from "@/assets/espanha-hero.jpg";
import {
  initialItems,
  progress,
  attach,
  detach,
  setAttachmentOwner,
  sortAttachments,
  sumAttachments,
  type Attachment,
  type AttachmentOwner,
  type Item,
  type Status,
  type Traducao,
  type Secao,
} from "@/lib/checklist-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rumo à Espanha – Checklist de documentos" },
      { name: "description", content: "Acompanhe os documentos de Jonathan e Esther para a mudança para a Espanha." },
      { property: "og:title", content: "Rumo à Espanha – Checklist de documentos" },
      { property: "og:description", content: "Acompanhe os documentos da mudança para a Espanha." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const KEY = "checklist-espanha-v1";
const STATUSES: Status[] = ["Pendente", "Feito", "N/A"];
const MAX_FILE_BYTES = 800 * 1024;

const statusCls: Record<Status, string> = {
  Feito: "bg-success text-primary-foreground border-success",
  Pendente: "bg-card text-primary border-primary/40",
  "N/A": "bg-muted text-muted-foreground border-border",
};
const tradCls: Record<Traducao, string> = {
  Sim: "bg-primary/10 text-primary",
  Talvez: "bg-gold/30 text-gold-foreground",
  Não: "bg-muted text-muted-foreground",
};
const whoCls: Record<AttachmentOwner, string> = {
  ambos: "bg-gold/25 text-gold-foreground border-gold/60",
  jonathan: "bg-primary/10 text-primary border-primary/40",
  esther: "bg-success/15 text-success border-success/40",
};
const whoLabel: Record<AttachmentOwner, string> = {
  ambos: "Dos dois",
  jonathan: "Jonathan",
  esther: "Esther",
};

function isImage(a: Attachment) {
  return a.mime.startsWith("image/");
}

async function fileToAttachment(file: File, who: AttachmentOwner): Promise<Attachment> {
  if (file.type.startsWith("image/")) {
    const dataUrl = await compressImage(file);
    return { id: crypto.randomUUID(), name: file.name, mime: "image/jpeg", dataUrl, who };
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
  return { id: crypto.randomUUID(), name: file.name, mime: file.type || "application/pdf", dataUrl, who };
}

async function compressImage(file: File): Promise<string> {
  const src = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = src;
  });
  const max = 1600;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

interface ViewerState {
  itemId: string;
  attId: string;
}

function Index() {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "pendentes" | "feitos">("todos");
  const [editing, setEditing] = useState<Item | null>(null);
  const [openAtt, setOpenAtt] = useState<Record<string, boolean>>({});
  const [viewer, setViewer] = useState<ViewerState | null>(null);

  useEffect(() => {
    const s = localStorage.getItem(KEY);
    if (s) try { setItems(JSON.parse(s)); } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => { if (loaded) localStorage.setItem(KEY, JSON.stringify(items)); }, [items, loaded]);

  const update = (id: string, patch: Partial<Item>) =>
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const updateItem = (next: Item) =>
    setItems((xs) => xs.map((x) => (x.id === next.id ? next : x)));
  const cycle = (s: Status) => STATUSES[(STATUSES.indexOf(s) + 1) % 3];

  const visible = useMemo(() => items.filter((i) => {
    if (q && !(i.documento + i.obs).toLowerCase().includes(q.toLowerCase())) return false;
    if (filtro === "pendentes") return i.jonathan === "Pendente" || i.esther === "Pendente";
    if (filtro === "feitos") return i.jonathan !== "Pendente" && i.esther !== "Pendente";
    return true;
  }), [items, q, filtro]);

  const totals = useMemo(() => sumAttachments(items), [items]);

  const save = (it: Item) => {
    setItems((xs) => (xs.some((x) => x.id === it.id) ? xs.map((x) => (x.id === it.id ? it : x)) : [...xs, it]));
    setEditing(null);
  };

  const exportCsv = () => {
    const rows = [["Seção", "Documento", "Onde / observação", "Tradução juramentada", "Jonathan", "Esther"],
      ...items.map((i) => [i.secao, i.documento, i.obs, i.traducao, i.jonathan, i.esther])];
    const csv = "\uFEFF" + rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "checklist-espanha.csv";
    a.click();
  };

  const viewerItem = viewer ? items.find((i) => i.id === viewer.itemId) : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="relative overflow-hidden text-primary-foreground">
        <img src={hero} alt="Plaza de España e Sagrada Família ao pôr do sol" width={1920} height={800}
          className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-hero-overlay" />
        <div className="relative mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6 md:pb-32 md:pt-16">
          <div className="flex items-center gap-2">
            <span className="flag-es h-4 w-6 rounded-sm shadow" />
            <p className="text-xs uppercase tracking-[0.3em] text-gold sm:text-sm">¡Vamos a España!</p>
          </div>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight drop-shadow sm:text-5xl md:text-6xl">
            Checklist de documentos<br /><span className="italic text-gold">rumo à Espanha</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm text-primary-foreground/90 sm:text-base">
            Toque no status para alternar entre Pendente, Feito e N/A. Anexe fotos e PDFs em cada documento.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs sm:text-sm">
            {["1. Tire o documento", "2. Apostile", "3. Traduza"].map((t) => (
              <span key={t} className="rounded-full border border-gold/60 bg-foreground/30 px-3 py-1 backdrop-blur">{t}</span>
            ))}
          </div>
        </div>
        <div className="flag-stripe relative h-2" />
      </header>

      <main className="relative mx-auto -mt-16 max-w-6xl px-4 pb-16 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {(["jonathan", "esther"] as const).map((w) => {
            const p = progress(items, w);
            return (
              <div key={w} className="rounded-2xl border bg-card p-5 shadow-card">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-2xl font-semibold capitalize">{w === "jonathan" ? "🕺 " : ""}{w === "esther" ? "🌹 " : ""}{w}</h2>
                  <span className="text-sm text-muted-foreground">{p.done} de {p.total}</span>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-hero transition-all duration-500" style={{ width: `${p.pct * 100}%` }} />
                </div>
                <div className="mt-2 flex items-end justify-between gap-2">
                  <p className="font-display text-3xl font-bold text-primary">{Math.round(p.pct * 100)}%</p>
                  <span className="inline-flex items-center gap-1 rounded-full border border-gold/60 bg-gold/15 px-2.5 py-0.5 text-xs text-gold-foreground">
                    <Paperclip className="h-3 w-3" /> {totals[w]} {totals[w] === 1 ? "anexo" : "anexos"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:flex lg:items-center">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar documento…"
            className="h-11 rounded-xl sm:col-span-2 lg:flex-1 border bg-card px-4 outline-none focus:ring-2 focus:ring-ring" />
          <div className="flex rounded-xl border bg-card p-1 sm:col-span-2 lg:col-auto">
            {(["todos", "pendentes", "feitos"] as const).map((f) => (
              <button key={f} onClick={() => setFiltro(f)}
                className={`flex-1 rounded-lg px-3 py-1.5 text-sm capitalize ${filtro === f ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{f}</button>
            ))}
          </div>
          <button onClick={() => setEditing({ id: crypto.randomUUID(), secao: "BRASIL", documento: "", obs: "", traducao: "Não", jonathan: "Pendente", esther: "Pendente" })}
            className="h-11 rounded-xl bg-primary px-4 font-medium text-primary-foreground hover:opacity-90">+ Documento</button>
          <button onClick={exportCsv} className="h-11 rounded-xl border bg-card px-4 text-sm hover:bg-secondary">Exportar planilha</button>
        </div>

        {(["BRASIL", "ESPANHA"] as Secao[]).map((sec) => {
          const list = visible.filter((i) => i.secao === sec);
          if (!list.length) return null;
          return (
            <section key={sec} className="mt-10">
              <h2 className="mb-4 flex items-center gap-3 text-2xl font-bold">
                <span className="text-3xl">{sec === "BRASIL" ? "🇧🇷" : "🇪🇸"}</span>
                <span>{sec === "BRASIL" ? "No Brasil" : "En España"}<span className="block text-sm font-normal italic text-muted-foreground">{sec === "BRASIL" ? "Antes de embarcar" : "Al llegar — bienvenidos"}</span></span>
                <span className="text-sm font-normal text-muted-foreground">({list.length})</span>
              </h2>
              <div className="grid gap-3">
                {list.map((i) => {
                  const atts = i.attachments ?? [];
                  const open = !!openAtt[i.id];
                  return (
                    <div key={i.id} className="group rounded-2xl border border-l-4 border-l-primary bg-card transition hover:-translate-y-0.5 hover:shadow-card">
                      <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
                        <button onClick={() => setEditing(i)} className="col-span-2 text-left md:col-span-1">
                          <p className="font-medium">{i.documento}</p>
                          <p className="text-sm text-muted-foreground">{i.obs}</p>
                          <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs ${tradCls[i.traducao]}`}>Tradução: {i.traducao}</span>
                        </button>
                        {(["jonathan", "esther"] as const).map((w) => (
                          <div key={w} className="flex flex-col gap-1 md:items-center">
                            <span className="text-xs uppercase tracking-wide text-muted-foreground">{w}</span>
                            <button aria-label={`Status de ${i.documento} para ${w}`} onClick={() => update(i.id, { [w]: cycle(i[w]) })}
                              className={`min-w-24 rounded-full border px-3 py-1 text-sm font-medium transition ${statusCls[i[w]]}`}>
                              {i[w] === "Feito" ? "✓ Feito" : i[w]}
                            </button>
                          </div>
                        ))}
                        <button onClick={() => setEditing(i)} className="col-span-2 justify-self-end text-sm md:col-span-1 text-muted-foreground hover:text-primary">Editar</button>
                      </div>
                      <div className="border-t px-4 py-2">
                        <button
                          aria-expanded={open}
                          onClick={() => setOpenAtt((m) => ({ ...m, [i.id]: !open }))}
                          className="flex w-full items-center gap-2 text-sm text-muted-foreground hover:text-primary"
                        >
                          <Paperclip className="h-4 w-4" />
                          <span className="font-medium">Anexos</span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{atts.length}</span>
                          <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
                        </button>
                        {open && (
                          <Attachments
                            item={i}
                            onChange={updateItem}
                            onView={(attId) => setViewer({ itemId: i.id, attId })}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        <footer className="mt-12 text-center"><p className="font-display text-2xl italic text-primary">¡Buena suerte y hasta pronto! 🇪🇸</p></footer>
        <p className="mt-6 rounded-2xl border border-gold bg-gold/15 p-4 text-sm text-muted-foreground">
          Lista de apoio, não é orientação jurídica. Confirmem no Consulado da Espanha (exteriores.gob.es) e, se possível, com um advogado de extranjería.
        </p>
      </main>

      {editing && <EditDialog item={editing} onClose={() => setEditing(null)} onSave={save}
        onDelete={(id) => { setItems((xs) => xs.filter((x) => x.id !== id)); setEditing(null); }} />}

      {viewer && viewerItem && (
        <ViewerDialog
          item={viewerItem}
          attId={viewer.attId}
          onNavigate={(attId) => setViewer({ itemId: viewer.itemId, attId })}
          onChange={updateItem}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}

function Attachments({ item, onChange, onView }: { item: Item; onChange: (i: Item) => void; onView: (attId: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [who, setWho] = useState<AttachmentOwner>("ambos");
  const [busy, setBusy] = useState(false);
  const atts = sortAttachments(item.attachments ?? []);

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    const accepted: Attachment[] = [];
    let skipped = 0;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/") && file.type !== "application/pdf") { skipped++; continue; }
      if (!file.type.startsWith("image/") && file.size > MAX_FILE_BYTES) { skipped++; continue; }
      try {
        accepted.push(await fileToAttachment(file, who));
      } catch {
        skipped++;
      }
    }
    if (accepted.length) onChange(attach(item, accepted));
    if (skipped) toast.error(`${skipped} arquivo(s) não anexado(s): use fotos ou PDFs de até 800 KB.`);
    if (accepted.length) toast.success(`${accepted.length} arquivo(s) anexado(s) para ${whoLabel[who]}.`);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="pb-2 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border bg-background p-0.5 text-xs">
          {(["ambos", "jonathan", "esther"] as const).map((w) => (
            <button key={w} onClick={() => setWho(w)}
              className={`rounded-md px-2.5 py-1 capitalize transition ${who === w ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              {whoLabel[w]}
            </button>
          ))}
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          <Paperclip className="h-4 w-4" /> {busy ? "Anexando…" : "Adicionar arquivo"}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
        <span className="text-xs text-muted-foreground">Fotos ou PDFs · pode escolher vários de uma vez</span>
      </div>

      {atts.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {atts.map((a) => (
            <button
              key={a.id}
              onClick={() => onView(a.id)}
              aria-label={`Ver anexo ${a.name}`}
              className="group/thumb relative overflow-hidden rounded-xl border bg-muted text-left transition hover:ring-2 hover:ring-ring"
            >
              {isImage(a) ? (
                <img src={a.dataUrl} alt={a.name} className="h-20 w-full object-cover" />
              ) : (
                <div className="flex h-20 flex-col items-center justify-center gap-1 text-muted-foreground">
                  <FileText className="h-7 w-7" />
                  <span className="px-1 text-[10px] uppercase">PDF</span>
                </div>
              )}
              <span className={`absolute left-1 top-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${whoCls[a.who]}`}>
                {whoLabel[a.who]}
              </span>
              <span className="block truncate px-1.5 py-1 text-[11px] text-muted-foreground">{a.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ViewerDialog({ item, attId, onNavigate, onChange, onClose }: {
  item: Item;
  attId: string;
  onNavigate: (attId: string) => void;
  onChange: (i: Item) => void;
  onClose: () => void;
}) {
  const atts = sortAttachments(item.attachments ?? []);
  const idx = atts.findIndex((a) => a.id === attId);
  const att = atts[idx];
  if (!att) return null;

  const prev = () => idx > 0 && onNavigate(atts[idx - 1].id);
  const next = () => idx < atts.length - 1 && onNavigate(atts[idx + 1].id);
  const remove = () => {
    if (!confirm("Excluir este anexo?")) return;
    const nextItem = detach(item, att.id);
    onChange(nextItem);
    const remaining = sortAttachments(nextItem.attachments ?? []);
    if (!remaining.length) onClose();
    else onNavigate(remaining[Math.min(idx, remaining.length - 1)].id);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-foreground/80 backdrop-blur-sm" onClick={onClose}>
      <div className="flex items-center gap-2 p-3 text-primary-foreground" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{att.name}</p>
          <p className="text-xs opacity-80">{item.documento} · {idx + 1} de {atts.length}</p>
        </div>
        <select
          aria-label="Dono do anexo"
          value={att.who}
          onChange={(e) => onChange(setAttachmentOwner(item, att.id, e.target.value as AttachmentOwner))}
          className="h-9 rounded-lg border border-primary-foreground/30 bg-foreground/40 px-2 text-sm"
        >
          <option value="ambos">Dos dois</option>
          <option value="jonathan">Jonathan</option>
          <option value="esther">Esther</option>
        </select>
        <button aria-label="Excluir anexo" onClick={remove} className="rounded-lg border border-primary-foreground/30 p-2 hover:bg-foreground/40">
          <Trash2 className="h-4 w-4" />
        </button>
        <button aria-label="Fechar" onClick={onClose} className="rounded-lg border border-primary-foreground/30 p-2 hover:bg-foreground/40">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-3" onClick={(e) => e.stopPropagation()}>
        {idx > 0 && (
          <button aria-label="Anexo anterior" onClick={prev}
            className="absolute left-2 z-10 rounded-full border border-primary-foreground/30 bg-foreground/40 p-2 text-primary-foreground hover:bg-foreground/60">
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {isImage(att) ? (
          <img src={att.dataUrl} alt={att.name} className="max-h-full max-w-full rounded-xl object-contain shadow-2xl" />
        ) : (
          <iframe title={att.name} src={att.dataUrl} className="h-full w-full max-w-3xl rounded-xl bg-card" />
        )}
        {idx < atts.length - 1 && (
          <button aria-label="Próximo anexo" onClick={next}
            className="absolute right-2 z-10 rounded-full border border-primary-foreground/30 bg-foreground/40 p-2 text-primary-foreground hover:bg-foreground/60">
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}

function EditDialog({ item, onClose, onSave, onDelete }: { item: Item; onClose: () => void; onSave: (i: Item) => void; onDelete: (id: string) => void }) {
  const [f, setF] = useState(item);
  const field = "mt-1 h-10 w-full rounded-lg border bg-background px-3 outline-none focus:ring-2 focus:ring-ring";
  const sel = <K extends keyof Item>(k: K, opts: string[]) => (
    <select className={field} value={f[k] as string} onChange={(e) => setF({ ...f, [k]: e.target.value })}>
      {opts.map((o) => <option key={o}>{o}</option>)}
    </select>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 md:items-center md:p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-3xl border-t-8 border-primary bg-card p-6 md:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-2xl font-bold">{item.documento ? "Editar documento" : "Novo documento"}</h3>
        <div className="mt-4 grid gap-3">
          <label className="text-sm">Documento<input className={field} value={f.documento} onChange={(e) => setF({ ...f, documento: e.target.value })} /></label>
          <label className="text-sm">Onde / observação<input className={field} value={f.obs} onChange={(e) => setF({ ...f, obs: e.target.value })} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">Seção{sel("secao", ["BRASIL", "ESPANHA"])}</label>
            <label className="text-sm">Tradução{sel("traducao", ["Sim", "Não", "Talvez"])}</label>
            <label className="text-sm">Jonathan{sel("jonathan", STATUSES)}</label>
            <label className="text-sm">Esther{sel("esther", STATUSES)}</label>
          </div>
        </div>
        <div className="mt-6 flex items-center gap-2">
          <button onClick={() => confirm("Excluir este documento?") && onDelete(item.id)} className="text-sm text-destructive">Excluir</button>
          <div className="flex-1" />
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button>
          <button disabled={!f.documento.trim()} onClick={() => onSave(f)} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">Salvar</button>
        </div>
      </div>
    </div>
  );
}
