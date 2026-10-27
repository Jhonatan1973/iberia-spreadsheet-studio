import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { BUCKET, getSupabase } from "@/lib/supabase";
import {
  DEFAULT_NAMES,
  initialItems,
  normalizeNames,
  withAttachments,
  type Attachment,
  type AttachmentOwner,
  type Item,
  type Names,
} from "@/lib/checklist-data";

export const LOCAL_KEY = "checklist-espanha-v1";
const LOCAL_NAMES_KEY = "checklist-espanha-nomes";
const MIGRATED_KEY = "checklist-espanha-v1-enviado-para-nuvem";

/**
 * carregando  → ainda verificando
 * local       → Lovable Cloud não ativado: salva só neste navegador
 * login       → banco ativo, falta entrar
 * sem-acesso  → entrou, mas o e-mail não está na tabela "membros"
 * nuvem       → tudo compartilhado
 */
export type Mode = "carregando" | "local" | "login" | "sem-acesso" | "nuvem";

/** Arquivo pronto para salvar (imagem já comprimida). */
export interface PreparedFile {
  name: string;
  mime: string;
  blob: Blob;
}

interface ItemRow {
  id: string;
  secao: Item["secao"];
  documento: string;
  obs: string;
  traducao: Item["traducao"];
  jonathan: Item["jonathan"];
  esther: Item["esther"];
  ordem: number;
}
interface AnexoRow {
  id: string;
  item_id: string;
  nome: string;
  mime: string;
  path: string;
  who: AttachmentOwner;
}

const toRow = (i: Item, ordem: number): ItemRow => ({
  id: i.id,
  secao: i.secao,
  documento: i.documento,
  obs: i.obs,
  traducao: i.traducao,
  jonathan: i.jonathan,
  esther: i.esther,
  ordem,
});

function readLocal<T>(key: string): T | null {
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : null;
  } catch {
    return null;
  }
}
function writeLocal(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}
function extOf(mime: string, name: string) {
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/jpeg") return "jpg";
  const fromName = name.split(".").pop();
  return fromName && fromName.length <= 5 ? fromName.toLowerCase() : "bin";
}

export function useChecklist() {
  const sb = typeof window === "undefined" ? null : getSupabase();
  const [mode, setMode] = useState<Mode>("carregando");
  const [session, setSession] = useState<Session | null>(null);
  const [items, setItems] = useState<Item[]>(initialItems);
  const [names, setNamesState] = useState<Names>(DEFAULT_NAMES);
  const [hasLocalData, setHasLocalData] = useState(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const urlCache = useRef(new Map<string, { url: string; exp: number }>());

  // ---------- carregamento ----------
  const loadCloud = useCallback(async () => {
    if (!sb) return;
    const [{ data: rows, error: e1 }, { data: anexos, error: e2 }, { data: cfg }] =
      await Promise.all([
        sb.from("itens").select("*").order("ordem"),
        sb.from("anexos").select("id,item_id,nome,mime,path,who").order("created_at"),
        sb.from("config").select("valor").eq("chave", "nomes").maybeSingle(),
      ]);
    if (e1 || e2) {
      toast.error("Não consegui carregar os dados compartilhados.");
      return;
    }
    let list = (rows ?? []) as ItemRow[];
    if (!list.length) {
      // Primeira vez: cria a lista padrão no banco.
      const seed = initialItems.map((i, idx) => toRow(i, idx));
      const { error } = await sb.from("itens").upsert(seed);
      if (error) {
        toast.error("Não consegui criar a lista inicial no banco.");
        return;
      }
      list = seed;
    }
    const base: Item[] = list.map(({ ordem: _o, ...r }) => ({ ...r }));
    const atts = ((anexos ?? []) as AnexoRow[]).map((a) => ({
      id: a.id,
      itemId: a.item_id,
      name: a.nome,
      mime: a.mime,
      path: a.path,
      who: a.who,
    }));
    setItems(withAttachments(base, atts));
    setNamesState(normalizeNames(cfg?.valor));
  }, [sb]);

  const decide = useCallback(
    async (s: Session | null) => {
      setSession(s);
      if (!sb) return;
      if (!s) {
        setMode("login");
        return;
      }
      const { data } = await sb.from("membros").select("email").maybeSingle();
      if (!data) {
        setMode("sem-acesso");
        return;
      }
      await loadCloud();
      setMode("nuvem");
    },
    [sb, loadCloud],
  );

  useEffect(() => {
    const localItems = readLocal<Item[]>(LOCAL_KEY);
    const localNames = readLocal<Names>(LOCAL_NAMES_KEY);
    if (!sb) {
      if (localItems) setItems(localItems);
      setNamesState(normalizeNames(localNames));
      setMode("local");
      return;
    }
    setHasLocalData(!!localItems && !localStorage.getItem(MIGRATED_KEY));
    sb.auth.getSession().then(({ data }) => decide(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") decide(s);
    });
    return () => sub.subscription.unsubscribe();
  }, [sb, decide]);

  // Ao vivo: mudanças feitas por outra pessoa aparecem aqui.
  useEffect(() => {
    if (!sb || mode !== "nuvem") return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const reload = () => {
      clearTimeout(t);
      t = setTimeout(loadCloud, 400);
    };
    const ch = sb
      .channel("checklist")
      .on("postgres_changes", { event: "*", schema: "public", table: "itens" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "anexos" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "config" }, reload)
      .subscribe();
    window.addEventListener("focus", reload);
    return () => {
      clearTimeout(t);
      window.removeEventListener("focus", reload);
      sb.removeChannel(ch);
    };
  }, [sb, mode, loadCloud]);

  // Modo local: grava no navegador e avisa se lotar.
  useEffect(() => {
    if (mode !== "local") return;
    if (!writeLocal(LOCAL_KEY, items)) {
      toast.error(
        "O navegador ficou sem espaço e esta alteração não foi salva. Ative o Lovable Cloud para salvar online.",
      );
    }
  }, [items, mode]);

  const fail = (msg: string) => {
    toast.error(msg);
    if (mode === "nuvem") loadCloud();
  };

  // ---------- ações ----------
  const patchItem = (id: string, patch: Partial<Item>) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    if (mode === "nuvem" && sb) {
      const { attachments: _a, ...fields } = patch;
      sb.from("itens")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("id", id)
        .then(({ error }) => error && fail("Não consegui salvar a alteração."));
    }
  };

  const saveItem = (it: Item) => {
    const existing = itemsRef.current.findIndex((x) => x.id === it.id);
    setItems((xs) => (existing >= 0 ? xs.map((x) => (x.id === it.id ? it : x)) : [...xs, it]));
    if (mode === "nuvem" && sb) {
      const ordem = existing >= 0 ? existing : itemsRef.current.length;
      sb.from("itens")
        .upsert(toRow(it, ordem))
        .then(({ error }) => error && fail("Não consegui salvar o documento."));
    }
  };

  const deleteItem = async (id: string) => {
    const it = itemsRef.current.find((x) => x.id === id);
    setItems((xs) => xs.filter((x) => x.id !== id));
    if (mode === "nuvem" && sb) {
      const paths = (it?.attachments ?? []).map((a) => a.path).filter(Boolean) as string[];
      if (paths.length) await sb.storage.from(BUCKET).remove(paths);
      const { error } = await sb.from("itens").delete().eq("id", id);
      if (error) fail("Não consegui excluir o documento.");
    }
  };

  const addFiles = async (
    itemId: string,
    files: PreparedFile[],
    who: AttachmentOwner,
  ): Promise<number> => {
    let ok = 0;
    for (const f of files) {
      const id = crypto.randomUUID();
      if (mode === "nuvem" && sb) {
        const path = `${itemId}/${id}.${extOf(f.mime, f.name)}`;
        const up = await sb.storage.from(BUCKET).upload(path, f.blob, { contentType: f.mime });
        if (up.error) continue;
        const { error } = await sb
          .from("anexos")
          .insert({ id, item_id: itemId, nome: f.name, mime: f.mime, path, who });
        if (error) {
          await sb.storage.from(BUCKET).remove([path]);
          continue;
        }
        const att: Attachment = { id, name: f.name, mime: f.mime, path, who };
        setItems((xs) =>
          xs.map((x) =>
            x.id === itemId ? { ...x, attachments: [...(x.attachments ?? []), att] } : x,
          ),
        );
        ok++;
      } else {
        const att: Attachment = {
          id,
          name: f.name,
          mime: f.mime,
          dataUrl: await blobToDataUrl(f.blob),
          who,
        };
        setItems((xs) =>
          xs.map((x) =>
            x.id === itemId ? { ...x, attachments: [...(x.attachments ?? []), att] } : x,
          ),
        );
        ok++;
      }
    }
    return ok;
  };

  const removeAttachment = async (itemId: string, att: Attachment) => {
    setItems((xs) =>
      xs.map((x) =>
        x.id === itemId
          ? { ...x, attachments: (x.attachments ?? []).filter((a) => a.id !== att.id) }
          : x,
      ),
    );
    if (mode === "nuvem" && sb) {
      if (att.path) await sb.storage.from(BUCKET).remove([att.path]);
      const { error } = await sb.from("anexos").delete().eq("id", att.id);
      if (error) fail("Não consegui excluir o anexo.");
    }
  };

  const setOwner = (itemId: string, attId: string, who: AttachmentOwner) => {
    setItems((xs) =>
      xs.map((x) =>
        x.id === itemId
          ? {
              ...x,
              attachments: (x.attachments ?? []).map((a) => (a.id === attId ? { ...a, who } : a)),
            }
          : x,
      ),
    );
    if (mode === "nuvem" && sb) {
      sb.from("anexos")
        .update({ who })
        .eq("id", attId)
        .then(({ error }) => error && fail("Não consegui trocar o dono do anexo."));
    }
  };

  const setNames = (next: Names) => {
    const n = normalizeNames(next);
    setNamesState(n);
    if (mode === "nuvem" && sb) {
      sb.from("config")
        .upsert({ chave: "nomes", valor: n, updated_at: new Date().toISOString() })
        .then(({ error }) => error && fail("Não consegui salvar os nomes."));
    } else {
      writeLocal(LOCAL_NAMES_KEY, n);
    }
  };

  /** Link para abrir o anexo (no modo nuvem é um link temporário de 1 hora). */
  const getUrl = useCallback(
    async (att: Attachment): Promise<string | null> => {
      if (att.dataUrl) return att.dataUrl;
      if (!att.path || !sb) return null;
      const hit = urlCache.current.get(att.path);
      if (hit && hit.exp > Date.now()) return hit.url;
      const { data } = await sb.storage.from(BUCKET).createSignedUrl(att.path, 3600);
      if (!data?.signedUrl) return null;
      urlCache.current.set(att.path, { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 });
      return data.signedUrl;
    },
    [sb],
  );

  /** Envia para a nuvem o que estava salvo só neste navegador. */
  const migrateLocal = async () => {
    if (!sb || mode !== "nuvem") return;
    const local = readLocal<Item[]>(LOCAL_KEY) ?? [];
    const localNames = readLocal<Names>(LOCAL_NAMES_KEY);
    const current = itemsRef.current;
    let files = 0;
    let novos = 0;
    for (const li of local) {
      const idx = current.findIndex((c) => c.id === li.id);
      const { error } = await sb
        .from("itens")
        .upsert(toRow(li, idx >= 0 ? idx : current.length + novos++));
      if (error) continue;
      for (const a of li.attachments ?? []) {
        if (!a.dataUrl) continue;
        const already = current[idx]?.attachments?.some((c) => c.id === a.id);
        if (already) continue;
        const path = `${li.id}/${a.id}.${extOf(a.mime, a.name)}`;
        const up = await sb.storage
          .from(BUCKET)
          .upload(path, await dataUrlToBlob(a.dataUrl), { contentType: a.mime, upsert: true });
        if (up.error) continue;
        const ins = await sb.from("anexos").upsert({
          id: a.id,
          item_id: li.id,
          nome: a.name,
          mime: a.mime,
          path,
          who: a.who ?? "ambos",
        });
        if (!ins.error) files++;
      }
    }
    if (localNames)
      await sb.from("config").upsert({ chave: "nomes", valor: normalizeNames(localNames) });
    localStorage.setItem(MIGRATED_KEY, "1");
    setHasLocalData(false);
    await loadCloud();
    toast.success(`Dados deste navegador enviados (${files} anexo(s)).`);
  };

  const dismissLocal = () => {
    localStorage.setItem(MIGRATED_KEY, "1");
    setHasLocalData(false);
  };

  const signIn = async (email: string, password: string) => {
    if (!sb) return "Banco não configurado.";
    const { error } = await sb.auth.signInWithPassword({ email, password });
    return error ? "E-mail ou senha incorretos." : null;
  };
  const signUp = async (email: string, password: string) => {
    if (!sb) return "Banco não configurado.";
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) return error.message;
    return data.session
      ? null
      : "Conta criada! Confirme pelo link enviado ao seu e-mail e depois entre.";
  };
  const signOut = () => sb?.auth.signOut();

  return {
    mode,
    session,
    items,
    names,
    hasLocalData,
    maxFileBytes: mode === "nuvem" ? 10 * 1024 * 1024 : 800 * 1024,
    patchItem,
    saveItem,
    deleteItem,
    addFiles,
    removeAttachment,
    setOwner,
    setNames,
    getUrl,
    migrateLocal,
    dismissLocal,
    signIn,
    signUp,
    signOut,
  };
}

export type Checklist = ReturnType<typeof useChecklist>;
