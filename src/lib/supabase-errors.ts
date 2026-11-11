import { toast } from "sonner";

/**
 * Mapeia códigos de erro do Supabase/PostgREST/Postgres em mensagens
 * claras para o operador, com dica de como corrigir.
 *
 * Uso:
 *   const { data, error } = await supabase.from("x").select();
 *   if (error) return handleSupabaseError(error, "Falha ao carregar X");
 *
 *   try { ... } catch (e) { handleSupabaseError(e); }
 */

export type SupabaseLikeError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
  status?: number | null;
  name?: string;
};

type Friendly = { title: string; description: string };

/** Códigos PostgREST/Postgres → mensagem amigável (pt-BR). */
const CODE_MAP: Record<string, Friendly> = {
  // PostgREST
  PGRST301: {
    title: "Sessão expirada",
    description: "Faça login novamente para continuar.",
  },
  PGRST302: {
    title: "Não autenticado",
    description: "Você precisa entrar na sua conta para acessar estes dados.",
  },
  PGRST116: {
    title: "Nenhum registro encontrado",
    description: "O item solicitado não existe ou foi removido.",
  },
  PGRST204: {
    title: "Coluna inexistente",
    description:
      "O app tentou usar uma coluna que não existe no banco. Peça ao administrador para revisar a estrutura da tabela.",
  },
  // Postgres RLS / permissões
  "42501": {
    title: "Sem permissão",
    description:
      "Seu perfil não tem permissão para esta operação. Verifique as políticas de acesso (RLS) com um administrador.",
  },
  "42P01": {
    title: "Tabela não encontrada",
    description:
      "A tabela usada por esta tela não existe. Peça ao administrador para rodar as migrações.",
  },
  "23505": {
    title: "Registro duplicado",
    description: "Já existe um item com esses dados.",
  },
  "23503": {
    title: "Referência inválida",
    description: "Este item está vinculado a outro registro que não existe (ou foi apagado).",
  },
  "23502": {
    title: "Campo obrigatório vazio",
    description: "Preencha todos os campos obrigatórios antes de salvar.",
  },
  "23514": {
    title: "Valor inválido",
    description: "Um dos valores enviados não atende às regras da tabela.",
  },
  "22P02": {
    title: "Formato inválido",
    description: "Um dos campos está em formato inválido (ex.: ID/UUID).",
  },
  "40001": {
    title: "Conflito de escrita",
    description: "Outra pessoa alterou este registro. Recarregue e tente novamente.",
  },
  "57014": {
    title: "Consulta demorada",
    description: "A operação demorou demais. Refine os filtros e tente de novo.",
  },
};

function normalize(err: unknown): SupabaseLikeError {
  if (!err) return {};
  if (typeof err === "string") return { message: err };
  if (err instanceof Error) {
    const anyErr = err as Error & Partial<SupabaseLikeError>;
    return {
      name: err.name,
      message: err.message,
      code: anyErr.code ?? null,
      details: anyErr.details ?? null,
      hint: anyErr.hint ?? null,
      status: anyErr.status ?? null,
    };
  }
  if (typeof err === "object") {
    const e = err as Record<string, unknown>;
    return {
      code: (e.code as string | undefined) ?? null,
      message: (e.message as string | undefined) ?? null,
      details: (e.details as string | undefined) ?? null,
      hint: (e.hint as string | undefined) ?? null,
      status: (e.status as number | undefined) ?? null,
    };
  }
  return { message: String(err) };
}

export function friendlySupabaseError(err: unknown, fallback = "Ocorreu um erro"): Friendly {
  const e = normalize(err);
  const raw = `${e.message ?? ""} ${e.details ?? ""} ${e.hint ?? ""}`.toLowerCase();

  if (e.code && CODE_MAP[e.code]) return CODE_MAP[e.code];

  // Heurísticas por texto quando o código não vem preenchido.
  if (raw.includes("row-level security") || raw.includes("permission denied")) {
    return CODE_MAP["42501"];
  }
  if (raw.includes("violates unique")) return CODE_MAP["23505"];
  if (raw.includes("foreign key")) return CODE_MAP["23503"];
  if (raw.includes("null value") && raw.includes("violates not-null")) return CODE_MAP["23502"];
  if (raw.includes("jwt") && (raw.includes("expired") || raw.includes("invalid"))) {
    return CODE_MAP.PGRST301;
  }
  if (e.status === 401 || raw.includes("unauthorized") || raw.includes("no authorization header")) {
    return CODE_MAP.PGRST302;
  }
  if (e.status === 403) return CODE_MAP["42501"];
  if (e.status === 404 || raw.includes("not found")) return CODE_MAP.PGRST116;
  if (raw.includes("failed to fetch") || raw.includes("networkerror") || raw.includes("network")) {
    return {
      title: "Sem conexão",
      description: "Verifique sua internet e tente novamente.",
    };
  }

  return {
    title: fallback,
    description: e.message?.trim() || "Tente novamente em alguns instantes.",
  };
}

/** Mostra um toast padronizado e devolve a mensagem — útil em catch. */
export function handleSupabaseError(err: unknown, fallback = "Ocorreu um erro"): Friendly {
  const f = friendlySupabaseError(err, fallback);
  // Log completo para debug (dev tools / Sentry-like).
  console.error("[Supabase error]", { fallback, err });
  toast.error(f.title, { description: f.description });
  return f;
}
