import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import hero from "@/assets/espanha-hero.jpg";
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
            Toque no status para alternar entre Pendente, Feito e N/A.
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
                  <h2 className="text-2xl font-semibold capitalize">{w === "jonathan" ? "💃🏻 " : ""}{w === "esther" ? "🌹 " : ""}{w}</h2>
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
                {list.map((i) => (
                  <div key={i.id} className="group grid grid-cols-2 gap-3 rounded-2xl border border-l-4 border-l-primary bg-card p-4 transition hover:-translate-y-0.5 hover:shadow-card md:grid-cols-[1fr_auto_auto_auto] md:items-center">
                    <button onClick={() => setEditing(i)} className="col-span-2 text-left md:col-span-1">
                      <p className="font-medium">{i.documento}</p>
                      <p className="text-sm text-muted-foreground">{i.obs}</p>
                      <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs ${tradCls[i.traducao]}`}>Tradução: {i.traducao}</span>
                    </button>
                    {(["jonathan", "esther"] as const).map((w) => (
                      <div key={w} className="flex flex-col gap-1 md:items-center">
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">{w}</span>
                        <button onClick={() => update(i.id, { [w]: cycle(i[w]) })}
                          className={`min-w-24 rounded-full border px-3 py-1 text-sm font-medium transition ${statusCls[i[w]]}`}>
                          {i[w] === "Feito" ? "✓ Feito" : i[w]}
                        </button>
                      </div>
                    ))}
                    <button onClick={() => setEditing(i)} className="col-span-2 justify-self-end text-sm md:col-span-1 text-muted-foreground hover:text-primary">Editar</button>
                  </div>
                ))}
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
