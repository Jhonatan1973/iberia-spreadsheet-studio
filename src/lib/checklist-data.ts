export type Status = "Feito" | "Pendente" | "N/A";
export type Traducao = "Sim" | "Não" | "Talvez";
export type Secao = "BRASIL" | "ESPANHA";
export type Who = "jonathan" | "esther";
export type AttachmentOwner = Who | "ambos";

export interface Attachment {
  id: string;
  name: string;
  mime: string;
  dataUrl: string;
  who: AttachmentOwner;
}

export interface Item {
  id: string;
  secao: Secao;
  documento: string;
  obs: string;
  traducao: Traducao;
  jonathan: Status;
  esther: Status;
  attachments?: Attachment[];
}

const raw: [Secao, string, string, Traducao, Status, Status][] = [
  ["BRASIL", "Passaporte", "Polícia Federal", "Não", "Pendente", "Pendente"],
  ["BRASIL", "Certificado militar (dispensa ou reservista)", "Exigido p/ passaporte (homens de 19 a 45 anos)", "Não", "Feito", "N/A"],
  ["BRASIL", "Quitação eleitoral", "TSE / app e-Título", "Não", "Pendente", "Pendente"],
  ["BRASIL", "ETIAS (se já estiver em vigor)", "Autorização online da União Europeia – confirmar", "Não", "Pendente", "Pendente"],
  ["BRASIL", "Passagem de volta ou saída do Schengen", "Companhia aérea", "Não", "Pendente", "Pendente"],
  ["BRASIL", "Comprovante de hospedagem", "Reserva ou carta de invitación do anfitrião", "Não", "Pendente", "Pendente"],
  ["BRASIL", "Comprovante de dinheiro", "Extratos / cartões (~€120 por dia – confirmar valor)", "Não", "Pendente", "Pendente"],
  ["BRASIL", "Seguro viagem", "Mín. €30.000, todo o Schengen – peça a apólice em inglês ou espanhol", "Não", "Pendente", "Pendente"],
  ["BRASIL", "Antecedentes criminais (apostilado)", "Polícia Federal + cartório", "Sim", "Pendente", "Pendente"],
  ["BRASIL", "Certidão de nascimento inteiro teor (apostilada)", "Cartório", "Sim", "Pendente", "Pendente"],
  ["BRASIL", "Certidão de casamento ou escritura de união estável (apostilada)", "Cartório – necessária para serem reconhecidos como casal", "Sim", "Pendente", "Pendente"],
  ["BRASIL", "Diploma (apostilado)", "Instituição de ensino + cartório", "Sim", "Pendente", "Pendente"],
  ["BRASIL", "Histórico escolar (apostilado)", "Instituição de ensino + cartório", "Sim", "Pendente", "Pendente"],
  ["BRASIL", "Comprovantes de experiência profissional", "Carteira digital, contratos, cartas", "Talvez", "Pendente", "Pendente"],
  ["BRASIL", "Extrato do CNIS", "Meu INSS", "Não", "Pendente", "Pendente"],
  ["BRASIL", "CNH", "Detran", "Talvez", "Pendente", "Pendente"],
  ["BRASIL", "Permissão Internacional para Dirigir (PID)", "Detran", "Não", "Pendente", "Pendente"],
  ["BRASIL", "Receitas e laudos médicos", "Se usar remédio contínuo – tradução simples basta", "Não", "Pendente", "Pendente"],
  ["BRASIL", "Saída Definitiva do País", "Receita Federal – se a mudança for de vez", "Não", "Pendente", "Pendente"],
  ["BRASIL", "Procuração para alguém no Brasil", "Cartório", "Não", "Pendente", "Pendente"],
  ["ESPANHA", "Empadronamiento", "Prefeitura (Ayuntamiento) – fazer logo", "Não", "Pendente", "Pendente"],
  ["ESPANHA", "Autorização de residência e trabalho", "Visto, arraigo ou outra via", "Não", "Pendente", "Pendente"],
  ["ESPANHA", "NIE / TIE", "Polícia – após a autorização", "Não", "Pendente", "Pendente"],
  ["ESPANHA", "Número da Seguridad Social", "Seguridad Social", "Não", "Pendente", "Pendente"],
  ["ESPANHA", "Tarjeta sanitaria", "Centro de saúde", "Não", "Pendente", "Pendente"],
  ["ESPANHA", "Conta bancária", "Banco", "Não", "Pendente", "Pendente"],
  ["ESPANHA", "Cl@ve ou certificado digital", "Para serviços online do governo", "Não", "Pendente", "Pendente"],
  ["ESPANHA", "Homologação do diploma", "Ministério espanhol – usa o diploma e histórico traduzidos", "Não", "Pendente", "Pendente"],
  ["ESPANHA", "Troca da CNH pela carteira espanhola", "DGT – após a residência", "Não", "Pendente", "Pendente"],
  ["ESPANHA", "Matrícula consular", "Consulado do Brasil", "Não", "Pendente", "Pendente"],
];

export const initialItems: Item[] = raw.map(([secao, documento, obs, traducao, jonathan, esther], i) => ({
  id: `d${i}`, secao, documento, obs, traducao, jonathan, esther,
}));

export function progress(items: Item[], who: Who) {
  const done = items.filter((i) => i[who] === "Feito").length;
  const total = items.filter((i) => i[who] !== "N/A").length;
  return { done, total, pct: total ? done / total : 0 };
}

export function attach(item: Item, atts: Attachment[]): Item {
  return { ...item, attachments: [...(item.attachments ?? []), ...atts] };
}

export function detach(item: Item, attId: string): Item {
  return { ...item, attachments: (item.attachments ?? []).filter((a) => a.id !== attId) };
}

export function setAttachmentOwner(item: Item, attId: string, who: AttachmentOwner): Item {
  return {
    ...item,
    attachments: (item.attachments ?? []).map((a) => (a.id === attId ? { ...a, who } : a)),
  };
}

const ownerWeight: Record<AttachmentOwner, number> = { ambos: 0, jonathan: 1, esther: 2 };

export function sortAttachments(atts: Attachment[]): Attachment[] {
  return [...atts].sort((a, b) => ownerWeight[a.who] - ownerWeight[b.who]);
}

export function sumAttachments(items: Item[]): Record<AttachmentOwner, number> {
  const sum: Record<AttachmentOwner, number> = { jonathan: 0, esther: 0, ambos: 0 };
  for (const i of items) for (const a of i.attachments ?? []) sum[a.who]++;
  return sum;
}
