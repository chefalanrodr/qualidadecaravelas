import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type AppSupabaseClient = SupabaseClient<Database>;
type PdfQuestion = readonly [title: string, weight: number];
type PdfAreaSeed = {
  name: string;
  slug: string;
  items: readonly PdfQuestion[];
};

export const QUALITY_PDF_AREA_SEED: readonly PdfAreaSeed[] = [
  {
    name: "HIGINE DE PANELAS",
    slug: "higine-de-panelas",
    items: [
      ["Teto", 1],
      ["Paredes", 1],
      ["Luminárias", 1],
      ["Piso", 1],
      ["Ralo", 1],
      ["Prateleiras de Utensílios", 1],
      ["Bancada com Pia Dupla", 1],
      ["Pias Limpas", 1],
      ["Papel Toalha Abastecido", 2],
      ["Estante de Utensílios Preta", 1],
      ["Local da Gordura", 1],
      ["Estrados", 1],
      ["Lixeiras", 1],
      ["Utensílios Limpos", 1],
      ["Ausência de Caixa de Papelão", 2],
      ["Ausência de Saco Reciclado", 2],
      ["Funcionários sem Adornos", 2],
      ["Higiene Pessoal Adequada", 2],
      ["Ausência de Objeto Pessoais", 2],
      ["Uniforme Completo", 2],
      ["Uniforme Limpo", 2],
      ["Sem Barba", 2],
      ["Unhas Curtas e sem Esmalte", 2],
      ["Ausência de Cílios Postiços", 2],
      ["Planilha - Higiene de Equipamentos", 2],
    ],
  },
  {
    name: "CÂMARA DE MATURAÇÃO DE PEIXES",
    slug: "camara-de-maturacao-de-peixes",
    items: [
      ["Teto", 1],
      ["Paredes", 1],
      ["Luminárias", 1],
      ["Piso", 1],
      ["Ralo Externo", 1],
      ["Porta", 1],
      ["Suporte de Inox", 1],
      ["Gangos", 1],
      ["Vidro", 1],
      ["Utensílios Limpos", 1],
      ["Planilha - Higiene e Temperatura dos Equipamentos", 2],
    ],
  },
  {
    name: "BAR",
    slug: "bar",
    items: [
      ["Paredes", 1],
      ["Luminárias", 1],
      ["Piso", 1],
      ["Ralo", 1],
      ["Bancada de Pedidos", 1],
      ["Estufas de Xícaras", 1],
      ["Cafeteiras", 1],
      ["Calhas da Estação 1", 1],
      ["Refrigerador do Beck Bar 1", 1],
      ["Estação 1", 1],
      ["Cuba de Gelo da Estação 1", 1],
      ["Pia Limpa da Estação 1", 1],
      ["Refrigerador da Estação 1", 1],
      ["Lixeira da Estação 1", 1],
      ["Gavetas de Inox", 1],
      ["Ultracongelador", 1],
      ["Calhas da Estação 2", 1],
      ["Refrigerador do Beck Bar 2", 1],
      ["Estação 2", 1],
      ["Cuba de Gelo da Estação 2", 1],
      ["Pia Limpa da Estação 2", 1],
      ["Refrigerador da Estação 2", 1],
      ["Prateleiras Decorativas", 1],
      ["Vidro Externo da Câmara", 1],
      ["Refrigerador Devassa / Corredor", 1],
      ["Máquina de Gelo / Corredor", 1],
      ["Refrigerador Coca Cola / Corredor", 1],
      ["Refrigerador Heineken / Corredor", 1],
      ["Utensílios Limpos", 1],
      ["Ausência de Caixa de Papelão", 2],
      ["Alimentos com Etiqueta", 2],
      ["Alimentos sem Contato com o Chão", 2],
      ["Alimentos em Boas Condições Sensoriais", 2],
      ["Alimentos Protegidos", 2],
      ["Alimentos com PVPS", 2],
      ["Ausência de Saco Reciclado", 2],
      ["Alimentos em Temperatura Adequada", 2],
      ["Ausência de Alimentos Vencidos", 3],
      ["Funcionários sem Adornos", 2],
      ["Higiene Pessoal Adequada", 2],
      ["Ausência de Objeto Pessoais", 2],
      ["Uniforme Completo", 2],
      ["Uniforme Limpo", 2],
      ["Sem Barba", 2],
      ["Unhas Curtas e sem Esmalte", 2],
      ["Ausência de Cílios Postiços", 2],
      ["Pia de Mãos Limpa", 2],
      ["Papel Toalha Abastecido", 2],
      ["Sabonete Bactericida Abastecido", 2],
      ["Lixeira com Pedal - Pia de Mãos", 2],
      ["Planilha - Higiene de Equipamentos", 2],
      ["Planilha - Higiene de Hortifrutis", 2],
      ["Planilha - Higiene de Latinhas", 2],
    ],
  },
  {
    name: "CÂMARA REFRIGERADA",
    slug: "camara-refrigerada",
    items: [
      ["Teto", 1],
      ["Paredes", 1],
      ["Luminárias", 1],
      ["Piso", 1],
      ["Ralo Externo", 1],
      ["Porta", 1],
      ["Estantes", 1],
      ["Estrados", 1],
      ["Caixas Plásticas", 1],
      ["Utensílios Limpos", 1],
      ["Ausência de Caixa de Papelão", 2],
      ["Alimentos com Etiqueta", 2],
      ["Alimentos sem Contato com o Chão", 2],
      ["Alimentos em Boas Condições Sensoriais", 2],
      ["Alimentos Protegidos", 2],
      ["Alimentos com PVPS", 2],
      ["Ausência de Saco Reciclado", 2],
      ["Alimentos em Temperatura Adequada", 2],
      ["Ausência de Alimentos Vencidos", 3],
      ["Funcionários sem Adornos", 2],
      ["Higiene Pessoal Adequada", 2],
      ["Ausência de Objeto Pessoais", 2],
      ["Uniforme Completo", 2],
      ["Uniforme Limpo", 2],
      ["Sem Barba", 2],
      ["Unhas Curtas e sem Esmalte", 2],
      ["Ausência de Cílios Postiços", 2],
    ],
  },
];

export const QUALITY_PDF_TOTAL_ITEMS = QUALITY_PDF_AREA_SEED.reduce(
  (sum, area) => sum + area.items.length,
  0,
);

export const QUALITY_PDF_TOTAL_WEIGHT = QUALITY_PDF_AREA_SEED.reduce(
  (sum, area) => sum + area.items.reduce((areaSum, [, weight]) => areaSum + weight, 0),
  0,
);

export async function resetQualityPdfStructure(supabase: AppSupabaseClient) {
  const cleanupWarnings: string[] = [];

  const answersCleanup = await supabase
    .from("quality_audit_answers")
    .delete()
    .not("id", "is", null);
  if (answersCleanup.error) cleanupWarnings.push(answersCleanup.error.message);

  const sectorScoresCleanup = await supabase
    .from("quality_audit_sectors")
    .delete()
    .not("id", "is", null);
  if (sectorScoresCleanup.error) cleanupWarnings.push(sectorScoresCleanup.error.message);

  const areaCleanup = await supabase
    .from("quality_areas")
    .delete()
    .not("id", "is", null);
  if (areaCleanup.error) throw areaCleanup.error;

  const { data: setor, error: setorError } = await supabase
    .from("quality_areas")
    .insert({
      name: "Raiz cozinha brasileira",
      slug: "raiz-cozinha-brasileira",
      target_score: 90,
      position: 1,
      is_active: true,
    })
    .select("id")
    .single();
  if (setorError) throw setorError;

  const { data: areas, error: areasError } = await supabase
    .from("quality_sectors")
    .insert(
      QUALITY_PDF_AREA_SEED.map((area, index) => ({
        area_id: setor.id,
        name: area.name,
        slug: area.slug,
        target_score: 90,
        position: index + 1,
        is_active: true,
      })),
    )
    .select("id, slug");
  if (areasError) throw areasError;

  const areaIdBySlug = new Map((areas ?? []).map((area) => [area.slug, area.id]));
  const items = QUALITY_PDF_AREA_SEED.flatMap((area) => {
    const sectorId = areaIdBySlug.get(area.slug);
    if (!sectorId) throw new Error(`Área não criada: ${area.name}`);
    return area.items.map(([title, weight], index) => ({
      sector_id: sectorId,
      title,
      weight,
      position: index + 1,
      is_critical: false,
      requires_photo: false,
      is_active: true,
    }));
  });

  const { error: itemsError } = await supabase.from("quality_items").insert(items);
  if (itemsError) throw itemsError;

  return {
    areas: QUALITY_PDF_AREA_SEED.length,
    items: QUALITY_PDF_TOTAL_ITEMS,
    totalWeight: QUALITY_PDF_TOTAL_WEIGHT,
    cleanupWarnings,
  };
}
