import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cloud,
  ExternalLink,
  FileText,
  HardDrive,
  LogOut,
  Paperclip,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import hero from "@/assets/espanha-hero.jpg";
import {
  progress,
  sortAttachments,
  sumAttachments,
  ownerLabel,
  WHOS,
  type Attachment,
  type AttachmentOwner,
  type Item,
  type Names,
  type Status,
  type Traducao,
  type Secao,
} from "@/lib/checklist-data";
import { useChecklist, type Checklist, type PreparedFile } from "@/hooks/use-checklist";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rumo à Espanha – Checklist de documentos" },
      {
        name: "description",
        content: "Acompanhe os documentos de Jhonatan e Ester para a mudança para a Espanha.",
      },
      { property: "og:title", content: "Rumo à Espanha – Checklist de documentos" },
      { property: "og:description", content: "Acompanhe os documentos da mudança para a Espanha." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const STATUSES: Status[] = ["Pendente", "Feito", "N/A"];
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

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
const whoEmoji: Record<"jonathan" | "esther", string> = { jonathan: "🕺", esther: "🌹" };

function isImage(a: Attachment) {
  return a.mime.startsWith("image/");
}

async function prepareFile(file: File): Promise<PreparedFile> {
  if (file.type.startsWith("image/")) {
    return { name: file.name, mime: "image/jpeg", blob: await compressImage(file) };
  }
  return { name: file.name, mime: file.type || "application/pdf", blob: file };
}

async function compressImage(file: File): Promise<Blob> {
  const src = URL.createObjectURL(file);
  try {
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
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("falha ao comprimir"))),
        "image/jpeg",
        0.85,
      ),
    );
  } finally {
    URL.revokeObjectURL(src);
  }
}

/** Busca o link do anexo (local ou temporário da nuvem). */
function useAttachmentUrl(att: Attachment | undefined, getUrl: Checklist["getUrl"]) {
  const [url, setUrl] = useState<string | null>(att?.dataUrl ?? null);
  useEffect(() => {
    let alive = true;
    setUrl(att?.dataUrl ?? null);
    if (att) getUrl(att).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [att?.id, att?.path, att?.dataUrl, getUrl]);
  return url;
}

interface ViewerState {
  itemId: string;
  attId: string;
}

function Index() {
  const c = useChecklist();
  const { items, names, mode } = c;
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "pendentes" | "feitos">("todos");
  const [editing, setEditing] = useState<Item | null>(null);
  const [editingNames, setEditingNames] = useState(false);
  const [openAtt, setOpenAtt] = useState<Record<string, boolean>>({});
  const [viewer, setViewer] = useState<ViewerState | null>(null);

  const cycle = (s: Status) => STATUSES[(STATUSES.indexOf(s) + 1) % 3];

  const visible = useMemo(
    () =>
      items.filter((i) => {
        if (q && !(i.documento + i.obs).toLowerCase().includes(q.toLowerCase())) return false;
        if (filtro === "pendentes") return i.jonathan === "Pendente" || i.esther === "Pendente";
        if (filtro === "feitos") return i.jonathan !== "Pendente" && i.esther !== "Pendente";
        return true;
      }),
    [items, q, filtro],
  );

  const totals = useMemo(() => sumAttachments(items), [items]);

  const exportCsv = () => {
    const rows = [
      [
        "Seção",
        "Documento",
        "Onde / observação",
        "Tradução juramentada",
        names.jonathan,
        names.esther,
      ],
      ...items.map((i) => [i.secao, i.documento, i.obs, i.traducao, i.jonathan, i.esther]),
    ];
    const csv =
      "﻿" + rows.map((r) => r.map((x) => `"${x.replace(/"/g, '""')}"`).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "checklist-espanha.csv";
    a.click();
  };

  const viewerItem = viewer ? items.find((i) => i.id === viewer.itemId) : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="relative overflow-hidden text-primary-foreground">
        <img
          src={hero}
          alt="Plaza de España e Sagrada Família ao pôr do sol"
          width={1920}
          height={800}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-hero-overlay" />
        <div className="relative mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6 md:pb-32 md:pt-16">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flag-es h-4 w-6 rounded-sm shadow" />
            <p className="text-xs uppercase tracking-[0.3em] text-gold sm:text-sm">
              ¡Vamos a España!
            </p>
            <ModeBadge c={c} />
          </div>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight drop-shadow sm:text-5xl md:text-6xl">
            Checklist de documentos
            <br />
            <span className="italic text-gold">rumo à Espanha</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm text-primary-foreground/90 sm:text-base">
            Toque no status para alternar entre Pendente, Feito e N/A. Anexe fotos e PDFs em cada
            documento.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs sm:text-sm">
            {["1. Tire o documento", "2. Apostile", "3. Traduza"].map((t) => (
              <span
                key={t}
                className="rounded-full border border-gold/60 bg-foreground/30 px-3 py-1 backdrop-blur"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="flag-stripe relative h-2" />
      </header>

      <main className="relative mx-auto -mt-16 max-w-6xl px-4 pb-16 sm:px-6">
        {(mode === "login" || mode === "sem-acesso") && <LoginCard c={c} />}

        {mode === "carregando" && (
          <div className="rounded-2xl border bg-card p-6 text-center text-muted-foreground shadow-card">
            Carregando…
          </div>
        )}

        {(mode === "local" || mode === "nuvem") && (
          <>
            {mode === "local" && (
              <p className="mb-4 rounded-2xl border border-gold bg-card p-4 text-sm shadow-card">
                <strong>Salvando só neste navegador.</strong> Para que os anexos e alterações
                apareçam para todo mundo, ative o Lovable Cloud no projeto (veja o passo a passo no
                README).
              </p>
            )}
            {mode === "nuvem" && c.hasLocalData && (
              <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-gold bg-card p-4 text-sm shadow-card">
                <p className="flex-1">
                  Este navegador tem dados antigos salvos só aqui. Quer enviá-los para a lista
                  compartilhada?
                </p>
                <button
                  onClick={async () => {
                    toast.info("Enviando…");
                    await c.migrateLocal();
                  }}
                  className="h-9 rounded-lg bg-primary px-3 font-medium text-primary-foreground"
                >
                  Enviar para a nuvem
                </button>
                <button onClick={c.dismissLocal} className="h-9 rounded-lg border px-3">
                  Ignorar
                </button>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              {WHOS.map((w) => {
                const p = progress(items, w);
                return (
                  <div key={w} className="rounded-2xl border bg-card p-5 shadow-card">
                    <div className="flex items-baseline justify-between gap-2">
                      <h2 className="flex items-center gap-2 text-2xl font-semibold">
                        {whoEmoji[w]} {names[w]}
                        <button
                          onClick={() => setEditingNames(true)}
                          aria-label="Trocar nomes"
                          title="Trocar nomes"
                          className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-primary"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </h2>
                      <span className="text-sm text-muted-foreground">
                        {p.done} de {p.total}
                      </span>
                    </div>
                    <div className="mt-3 h-3 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-hero transition-all duration-500"
                        style={{ width: `${p.pct * 100}%` }}
                      />
                    </div>
                    <div className="mt-2 flex items-end justify-between gap-2">
                      <p className="font-display text-3xl font-bold text-primary">
                        {Math.round(p.pct * 100)}%
                      </p>
                      <span className="inline-flex items-center gap-1 rounded-full border border-gold/60 bg-gold/15 px-2.5 py-0.5 text-xs text-gold-foreground">
                        <Paperclip className="h-3 w-3" /> {totals[w]}{" "}
                        {totals[w] === 1 ? "anexo" : "anexos"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:flex lg:items-center">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar documento…"
                className="h-11 rounded-xl border bg-card px-4 outline-none focus:ring-2 focus:ring-ring sm:col-span-2 lg:flex-1"
              />
              <div className="flex rounded-xl border bg-card p-1 sm:col-span-2 lg:col-auto">
                {(["todos", "pendentes", "feitos"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFiltro(f)}
                    className={`flex-1 rounded-lg px-3 py-1.5 text-sm capitalize ${filtro === f ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <button
                onClick={() =>
                  setEditing({
                    id: crypto.randomUUID(),
                    secao: "BRASIL",
                    documento: "",
                    obs: "",
                    traducao: "Não",
                    jonathan: "Pendente",
                    esther: "Pendente",
                  })
                }
                className="h-11 rounded-xl bg-primary px-4 font-medium text-primary-foreground hover:opacity-90"
              >
                + Documento
              </button>
              <button
                onClick={() => setEditingNames(true)}
                className="h-11 rounded-xl border bg-card px-4 text-sm hover:bg-secondary"
              >
                Trocar nomes
              </button>
              <button
                onClick={exportCsv}
                className="h-11 rounded-xl border bg-card px-4 text-sm hover:bg-secondary"
              >
                Exportar planilha
              </button>
            </div>

            {(["BRASIL", "ESPANHA"] as Secao[]).map((sec) => {
              const list = visible.filter((i) => i.secao === sec);
              if (!list.length) return null;
              return (
                <section key={sec} className="mt-10">
                  <h2 className="mb-4 flex items-center gap-3 text-2xl font-bold">
                    <span className="text-3xl">{sec === "BRASIL" ? "🇧🇷" : "🇪🇸"}</span>
                    <span>
                      {sec === "BRASIL" ? "No Brasil" : "En España"}
                      <span className="block text-sm font-normal italic text-muted-foreground">
                        {sec === "BRASIL" ? "Antes de embarcar" : "Al llegar — bienvenidos"}
                      </span>
                    </span>
                    <span className="text-sm font-normal text-muted-foreground">
                      ({list.length})
                    </span>
                  </h2>
                  <div className="grid gap-3">
                    {list.map((i) => {
                      const atts = i.attachments ?? [];
                      const open = !!openAtt[i.id];
                      return (
                        <div
                          key={i.id}
                          className="group rounded-2xl border border-l-4 border-l-primary bg-card transition hover:-translate-y-0.5 hover:shadow-card"
                        >
                          <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
                            <button
                              onClick={() => setEditing(i)}
                              className="col-span-2 text-left md:col-span-1"
                            >
                              <p className="font-medium">{i.documento}</p>
                              <p className="text-sm text-muted-foreground">{i.obs}</p>
                              <span
                                className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs ${tradCls[i.traducao]}`}
                              >
                                Tradução: {i.traducao}
                              </span>
                            </button>
                            {WHOS.map((w) => (
                              <div key={w} className="flex flex-col gap-1 md:items-center">
                                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                                  {names[w]}
                                </span>
                                <button
                                  aria-label={`Status de ${i.documento} para ${names[w]}`}
                                  onClick={() => c.patchItem(i.id, { [w]: cycle(i[w]) })}
                                  className={`min-w-24 rounded-full border px-3 py-1 text-sm font-medium transition ${statusCls[i[w]]}`}
                                >
                                  {i[w] === "Feito" ? "✓ Feito" : i[w]}
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() => setEditing(i)}
                              className="col-span-2 justify-self-end text-sm text-muted-foreground hover:text-primary md:col-span-1"
                            >
                              Editar
                            </button>
                          </div>
                          <div className="border-t px-4 py-2">
                            <button
                              aria-expanded={open}
                              onClick={() => setOpenAtt((m) => ({ ...m, [i.id]: !open }))}
                              className="flex w-full items-center gap-2 text-sm text-muted-foreground hover:text-primary"
                            >
                              <Paperclip className="h-4 w-4" />
                              <span className="font-medium">Anexos</span>
                              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                                {atts.length}
                              </span>
                              <ChevronDown
                                className={`ml-auto h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
                              />
                            </button>
                            {open && (
                              <Attachments
                                item={i}
                                c={c}
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
          </>
        )}

        <footer className="mt-12 text-center">
          <p className="font-display text-2xl italic text-primary">
            ¡Buena suerte y hasta pronto! 🇪🇸
          </p>
        </footer>
        <p className="mt-6 rounded-2xl border border-gold bg-gold/15 p-4 text-sm text-muted-foreground">
          Lista de apoio, não é orientação jurídica. Confirmem no Consulado da Espanha
          (exteriores.gob.es) e, se possível, com um advogado de extranjería.
        </p>
      </main>

      {editing && (
        <EditDialog
          item={editing}
          names={names}
          onClose={() => setEditing(null)}
          onSave={(it) => {
            c.saveItem(it);
            setEditing(null);
          }}
          onDelete={(id) => {
            c.deleteItem(id);
            setEditing(null);
          }}
        />
      )}

      {editingNames && (
        <NamesDialog
          names={names}
          onClose={() => setEditingNames(false)}
          onSave={(n) => {
            c.setNames(n);
            setEditingNames(false);
            toast.success("Nomes atualizados.");
          }}
        />
      )}

      {viewer && viewerItem && (
        <ViewerDialog
          item={viewerItem}
          attId={viewer.attId}
          c={c}
          onNavigate={(attId) => setViewer({ itemId: viewer.itemId, attId })}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}

function ModeBadge({ c }: { c: Checklist }) {
  if (c.mode === "nuvem") {
    return (
      <span className="ml-auto inline-flex items-center gap-2 rounded-full border border-gold/60 bg-foreground/30 px-3 py-1 text-xs backdrop-blur">
        <Cloud className="h-3.5 w-3.5" /> Compartilhado
        <button
          onClick={c.signOut}
          title="Sair"
          aria-label="Sair"
          className="opacity-80 hover:opacity-100"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </span>
    );
  }
  if (c.mode === "local") {
    return (
      <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-gold/60 bg-foreground/30 px-3 py-1 text-xs backdrop-blur">
        <HardDrive className="h-3.5 w-3.5" /> Só neste navegador
      </span>
    );
  }
  return null;
}

function LoginCard({ c }: { c: Checklist }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const field =
    "mt-1 h-10 w-full rounded-lg border bg-background px-3 outline-none focus:ring-2 focus:ring-ring";

  if (c.mode === "sem-acesso") {
    return (
      <div className="mx-auto max-w-md rounded-2xl border bg-card p-6 shadow-card">
        <h2 className="text-xl font-bold">Acesso não liberado</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          O e-mail <strong>{c.session?.user.email}</strong> ainda não está na lista de membros. Peça
          para incluí-lo na tabela <code>membros</code> do Lovable Cloud.
        </p>
        <button onClick={c.signOut} className="mt-4 rounded-lg border px-4 py-2 text-sm">
          Sair
        </button>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const err = creating
      ? await c.signUp(email.trim(), password)
      : await c.signIn(email.trim(), password);
    setBusy(false);
    if (err) setMsg(err);
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-md rounded-2xl border bg-card p-6 shadow-card">
      <h2 className="text-xl font-bold">{creating ? "Criar acesso" : "Entrar"}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Os documentos ficam protegidos. Entre para ver e anexar arquivos.
      </p>
      <label className="mt-4 block text-sm">
        E-mail
        <input
          type="email"
          required
          autoComplete="email"
          className={field}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="mt-3 block text-sm">
        Senha
        <input
          type="password"
          required
          minLength={6}
          autoComplete={creating ? "new-password" : "current-password"}
          className={field}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {msg && <p className="mt-3 text-sm text-destructive">{msg}</p>}
      <button
        disabled={busy}
        className="mt-4 h-10 w-full rounded-lg bg-primary font-medium text-primary-foreground disabled:opacity-50"
      >
        {busy ? "Aguarde…" : creating ? "Criar acesso" : "Entrar"}
      </button>
      <button
        type="button"
        onClick={() => setCreating(!creating)}
        className="mt-3 w-full text-sm text-muted-foreground hover:text-primary"
      >
        {creating ? "Já tenho acesso — entrar" : "Primeira vez? Criar acesso"}
      </button>
    </form>
  );
}

function Attachments({
  item,
  c,
  onView,
}: {
  item: Item;
  c: Checklist;
  onView: (attId: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [who, setWho] = useState<AttachmentOwner>("ambos");
  const [busy, setBusy] = useState(false);
  const atts = sortAttachments(item.attachments ?? []);
  const limit =
    c.maxFileBytes >= 1024 * 1024
      ? `${Math.round(c.maxFileBytes / 1024 / 1024)} MB`
      : `${Math.round(c.maxFileBytes / 1024)} KB`;

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    const prepared: PreparedFile[] = [];
    let skipped = 0;
    for (const file of Array.from(files)) {
      const isImg = file.type.startsWith("image/");
      if (!isImg && !ACCEPTED.includes(file.type)) {
        skipped++;
        continue;
      }
      try {
        const p = await prepareFile(file);
        if (p.blob.size > c.maxFileBytes) {
          skipped++;
          continue;
        }
        prepared.push(p);
      } catch {
        skipped++;
      }
    }
    const ok = prepared.length ? await c.addFiles(item.id, prepared, who) : 0;
    skipped += prepared.length - ok;
    if (skipped)
      toast.error(`${skipped} arquivo(s) não anexado(s): use fotos ou PDFs de até ${limit}.`);
    if (ok) toast.success(`${ok} arquivo(s) anexado(s) para ${ownerLabel(c.names, who)}.`);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="pb-2 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border bg-background p-0.5 text-xs">
          {(["ambos", "jonathan", "esther"] as const).map((w) => (
            <button
              key={w}
              onClick={() => setWho(w)}
              className={`rounded-md px-2.5 py-1 transition ${who === w ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {ownerLabel(c.names, w)}
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
        <span className="text-xs text-muted-foreground">
          Fotos ou PDFs · pode escolher vários de uma vez
        </span>
      </div>

      {atts.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {atts.map((a) => (
            <Thumb key={a.id} att={a} c={c} onClick={() => onView(a.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function Thumb({ att, c, onClick }: { att: Attachment; c: Checklist; onClick: () => void }) {
  const url = useAttachmentUrl(isImage(att) ? att : undefined, c.getUrl);
  return (
    <button
      onClick={onClick}
      aria-label={`Ver anexo ${att.name}`}
      className="group/thumb relative overflow-hidden rounded-xl border bg-muted text-left transition hover:ring-2 hover:ring-ring"
    >
      {isImage(att) ? (
        url ? (
          <img src={url} alt={att.name} className="h-20 w-full object-cover" />
        ) : (
          <div className="h-20 w-full animate-pulse bg-muted" />
        )
      ) : (
        <div className="flex h-20 flex-col items-center justify-center gap-1 text-muted-foreground">
          <FileText className="h-7 w-7" />
          <span className="px-1 text-[10px] uppercase">PDF</span>
        </div>
      )}
      <span
        className={`absolute left-1 top-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${whoCls[att.who]}`}
      >
        {ownerLabel(c.names, att.who)}
      </span>
      <span className="block truncate px-1.5 py-1 text-[11px] text-muted-foreground">
        {att.name}
      </span>
    </button>
  );
}

function ViewerDialog({
  item,
  attId,
  c,
  onNavigate,
  onClose,
}: {
  item: Item;
  attId: string;
  c: Checklist;
  onNavigate: (attId: string) => void;
  onClose: () => void;
}) {
  const atts = sortAttachments(item.attachments ?? []);
  const idx = atts.findIndex((a) => a.id === attId);
  const att = atts[idx];
  const url = useAttachmentUrl(att, c.getUrl);
  if (!att) return null;

  const prev = () => {
    const a = atts[idx - 1];
    if (a) onNavigate(a.id);
  };
  const next = () => {
    const a = atts[idx + 1];
    if (a) onNavigate(a.id);
  };
  const remove = () => {
    if (!confirm("Excluir este anexo?")) return;
    c.removeAttachment(item.id, att);
    const remaining = atts.filter((a) => a.id !== att.id);
    if (!remaining.length) onClose();
    else onNavigate((remaining[Math.min(idx, remaining.length - 1)] ?? remaining[0]!).id);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-foreground/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex items-center gap-2 p-3 text-primary-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{att.name}</p>
          <p className="text-xs opacity-80">
            {item.documento} · {idx + 1} de {atts.length}
          </p>
        </div>
        <label className="flex items-center gap-1 text-xs opacity-90">
          <span className="hidden sm:inline">De quem:</span>
          <select
            aria-label="Dono do anexo"
            value={att.who}
            onChange={(e) => c.setOwner(item.id, att.id, e.target.value as AttachmentOwner)}
            className="h-9 rounded-lg border border-primary-foreground/30 bg-card px-2 text-sm text-foreground"
          >
            {(["ambos", "jonathan", "esther"] as const).map((w) => (
              <option key={w} value={w}>
                {ownerLabel(c.names, w)}
              </option>
            ))}
          </select>
        </label>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            download={att.name}
            aria-label="Abrir em nova aba"
            title="Abrir em nova aba"
            className="rounded-lg border border-primary-foreground/30 p-2 hover:bg-foreground/40"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
        <button
          aria-label="Excluir anexo"
          onClick={remove}
          className="rounded-lg border border-primary-foreground/30 p-2 hover:bg-foreground/40"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <button
          aria-label="Fechar"
          onClick={onClose}
          className="rounded-lg border border-primary-foreground/30 p-2 hover:bg-foreground/40"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden p-3"
        onClick={(e) => e.stopPropagation()}
      >
        {idx > 0 && (
          <button
            aria-label="Anexo anterior"
            onClick={prev}
            className="absolute left-2 z-10 rounded-full border border-primary-foreground/30 bg-foreground/40 p-2 text-primary-foreground hover:bg-foreground/60"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {!url ? (
          <p className="text-primary-foreground/80">Carregando…</p>
        ) : isImage(att) ? (
          <img
            src={url}
            alt={att.name}
            className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
          />
        ) : (
          <iframe
            title={att.name}
            src={url}
            className="h-full w-full max-w-3xl rounded-xl bg-card"
          />
        )}
        {idx < atts.length - 1 && (
          <button
            aria-label="Próximo anexo"
            onClick={next}
            className="absolute right-2 z-10 rounded-full border border-primary-foreground/30 bg-foreground/40 p-2 text-primary-foreground hover:bg-foreground/60"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}

function NamesDialog({
  names,
  onClose,
  onSave,
}: {
  names: Names;
  onClose: () => void;
  onSave: (n: Names) => void;
}) {
  const [f, setF] = useState(names);
  const field =
    "mt-1 h-10 w-full rounded-lg border bg-background px-3 outline-none focus:ring-2 focus:ring-ring";
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 md:items-center md:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl border-t-8 border-primary bg-card p-6 md:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-2xl font-bold">Trocar nomes</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Os status e anexos de cada pessoa continuam os mesmos.
        </p>
        <div className="mt-4 grid gap-3">
          {WHOS.map((w) => (
            <label key={w} className="text-sm">
              {whoEmoji[w]} Pessoa {w === "jonathan" ? 1 : 2}
              <input
                className={field}
                maxLength={40}
                value={f[w]}
                onChange={(e) => setF({ ...f, [w]: e.target.value })}
              />
            </label>
          ))}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">
            Cancelar
          </button>
          <button
            disabled={!f.jonathan.trim() || !f.esther.trim()}
            onClick={() => onSave(f)}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function EditDialog({
  item,
  names,
  onClose,
  onSave,
  onDelete,
}: {
  item: Item;
  names: Names;
  onClose: () => void;
  onSave: (i: Item) => void;
  onDelete: (id: string) => void;
}) {
  const [f, setF] = useState(item);
  const field =
    "mt-1 h-10 w-full rounded-lg border bg-background px-3 outline-none focus:ring-2 focus:ring-ring";
  const sel = <K extends keyof Item>(k: K, opts: string[]) => (
    <select
      className={field}
      value={f[k] as string}
      onChange={(e) => setF({ ...f, [k]: e.target.value })}
    >
      {opts.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  );
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 md:items-center md:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl border-t-8 border-primary bg-card p-6 md:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-2xl font-bold">
          {item.documento ? "Editar documento" : "Novo documento"}
        </h3>
        <div className="mt-4 grid gap-3">
          <label className="text-sm">
            Documento
            <input
              className={field}
              value={f.documento}
              onChange={(e) => setF({ ...f, documento: e.target.value })}
            />
          </label>
          <label className="text-sm">
            Onde / observação
            <input
              className={field}
              value={f.obs}
              onChange={(e) => setF({ ...f, obs: e.target.value })}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">Seção{sel("secao", ["BRASIL", "ESPANHA"])}</label>
            <label className="text-sm">Tradução{sel("traducao", ["Sim", "Não", "Talvez"])}</label>
            <label className="text-sm">
              {names.jonathan}
              {sel("jonathan", STATUSES)}
            </label>
            <label className="text-sm">
              {names.esther}
              {sel("esther", STATUSES)}
            </label>
          </div>
        </div>
        <div className="mt-6 flex items-center gap-2">
          {item.documento && (
            <button
              onClick={() =>
                confirm("Excluir este documento e os anexos dele?") && onDelete(item.id)
              }
              className="text-sm text-destructive"
            >
              Excluir
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">
            Cancelar
          </button>
          <button
            disabled={!f.documento.trim()}
            onClick={() => onSave(f)}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
