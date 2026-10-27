import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { initialItems, progress, type Item, type Status, type Traducao, type Secao } from "@/lib/checklist-data";

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

function Index() {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "pendentes" | "feitos">("todos");
  const [editing, setEditing] = useState<Item | null>(null);

  useEffect(() => {
    const s = localStorage.getItem(KEY);
    if (s) try { setItems(JSON.parse(s)); } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => { if (loaded) localStorage.setItem(KEY, JSON.stringify(items)); }, [items, loaded]);

  const update = (id: string, patch: Partial<Item>) =>
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const cycle = (s: Status) => STATUSES[(STATUSES.indexOf(s) + 1) % 3];

  const visible = useMemo(() => items.filter((i) => {
    if (q && !(i.documento + i.obs).toLowerCase().includes(q.toLowerCase())) return false;
    if (filtro === "pendentes") return i.jonathan === "Pendente" || i.esther === "Pendente";
    if (filtro === "feitos") return i.jonathan !== "Pendente" && i.esther !== "Pendente";
    return true;
  }), [items, q, filtro]);

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

  return (
    <div className="min-h-screen bg-background">
      <header className="relative overflow-hidden bg-hero text-primary-foreground">
        <div className="absolute inset-0 tile-pattern opacity-40" />
        <div className="relative mx-auto max-w-6xl px-5 pb-24 pt-10 md:pt-14">
          <p className="text-sm uppercase tracking-[0.3em] text-gold">¡Vamos a España!</p>
          <h1 className="mt-2 text-4xl font-extrabold leading-tight md:text-6xl">
            Checklist de documentos <span className="italic text-gold">Mudança para a Espanha</span>
          </h1>
          <p className="mt-4 max-w-2xl text-primary-foreground/85">
            Toque no status para alternar entre Pendente, Feito e N/A. Ordem: tire o documento → apostile → traduza.
          </p>
        </div>
        <div className="h-3 bg-gold" />
      </header>

      <main className="relative mx-auto -mt-16 max-w-6xl px-5 pb-16">
        <div className="grid gap-4 md:grid-cols-2">
          {(["jonathan", "esther"] as const).map((w) => {
            const p = progress(items, w);
            return (
              <div key={w} className="rounded-2xl border bg-card p-5 shadow-card">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-2xl font-semibold capitalize">{w}</h2>
                  <span className="text-sm text-muted-foreground">{p.done} de {p.total}</span>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-hero transition-all duration-500" style={{ width: `${p.pct * 100}%` }} />
                </div>
                <p className="mt-2 font-display text-3xl font-bold text-primary">{Math.round(p.pct * 100)}%</p>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex flex-col gap-3 md:flex-row md:items-center">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar documento…"
            className="h-11 flex-1 rounded-xl border bg-card px-4 outline-none focus:ring-2 focus:ring-ring" />
          <div className="flex rounded-xl border bg-card p-1">
            {(["todos", "pendentes", "feitos"] as const).map((f) => (
              <button key={f} onClick={() => setFiltro(f)}
                className={`rounded-lg px-3 py-1.5 text-sm capitalize ${filtro === f ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{f}</button>
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
                {sec === "BRASIL" ? "No Brasil" : "En España"}
                <span className="text-sm font-normal text-muted-foreground">({list.length})</span>
              </h2>
              <div className="grid gap-3">
                {list.map((i) => (
                  <div key={i.id} className="group grid gap-3 rounded-2xl border bg-card p-4 transition hover:shadow-card md:grid-cols-[1fr_auto_auto_auto] md:items-center">
                    <button onClick={() => setEditing(i)} className="text-left">
                      <p className="font-medium">{i.documento}</p>
                      <p className="text-sm text-muted-foreground">{i.obs}</p>
                      <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs ${tradCls[i.traducao]}`}>Tradução: {i.traducao}</span>
                    </button>
                    {(["jonathan", "esther"] as const).map((w) => (
                      <div key={w} className="flex items-center gap-2 md:flex-col md:items-center md:gap-1">
                        <span className="w-20 text-xs uppercase tracking-wide text-muted-foreground md:w-auto">{w}</span>
                        <button onClick={() => update(i.id, { [w]: cycle(i[w]) })}
                          className={`min-w-24 rounded-full border px-3 py-1 text-sm font-medium transition ${statusCls[i[w]]}`}>
                          {i[w] === "Feito" ? "✓ Feito" : i[w]}
                        </button>
                      </div>
                    ))}
                    <button onClick={() => setEditing(i)} className="justify-self-end text-sm text-muted-foreground hover:text-primary">Editar</button>
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        <p className="mt-12 rounded-2xl border border-gold bg-gold/15 p-4 text-sm text-muted-foreground">
          Lista de apoio, não é orientação jurídica. Confirmem no Consulado da Espanha (exteriores.gob.es) e, se possível, com um advogado de extranjería.
        </p>
      </main>

      {editing && <EditDialog item={editing} onClose={() => setEditing(null)} onSave={save}
        onDelete={(id) => { setItems((xs) => xs.filter((x) => x.id !== id)); setEditing(null); }} />}
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
