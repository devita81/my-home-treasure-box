// itbi-search: busca genérica na tabela itbi_transactions (cidade SP).
// Filtros AND combináveis: tipo, logradouro, número, bairro, CEP.
// Retorna até 500 registros deduplicados, ordenados por data desc.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// === Heurísticas para classificação de tipo ===
// Apartamento: complemento começa com AP / APTO / APT (mais sufixo numérico).
const APARTMENT_RE = /^\s*(AP|APTO?|APART(AMENTO)?)\b/i;
// Garagem / vaga / box / depósito / hobby (descartar quando busca residencial).
const GARAGE_RE = /\b(GARAGEM|GAR|VAGA|VG|BOX|ESTACIONAMENTO|DEPOSITO|DEP|HOBBY|CUBICULO)\b/i;
// Comercial: salas, lojas, conjuntos, escritórios.
const COMMERCIAL_RE = /\b(SALA|SL|LOJA|LJ|CONJ|CONJUNTO|COMERCIAL|ESCRITORIO|ESCRIT|GALPAO)\b/i;
// Casa: complemento explícito de casa/sobrado/fundos.
const HOUSE_RE = /\b(CASA|SOBRADO|FUNDOS|FRENTE|TERREO)\b/i;

// Mapeia descricao_uso_iptu (texto da Prefeitura) para uma categoria interna.
function categoryFromUsoIptu(desc: string | null | undefined): string | null {
  if (!desc) return null;
  const u = desc.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/APARTAMENTO/.test(u)) return "apartamento";
  if (/(RESIDENCIA|CASA|SOBRADO)/.test(u)) return "casa";
  if (/GARAGEM|VAGA|BOX|ESTACIONAMENTO/.test(u)) return "garagem";
  if (/(LOJA|SALA|ESCRITORIO|COMERCIAL|HOTEL|GALPAO|INDUSTRIAL|ARMAZEM|OFICINA)/.test(u)) return "comercial";
  if (/TERRENO/.test(u)) return "terreno";
  return null;
}

// Heurística no complemento (fallback quando descricao_uso_iptu estiver vazio).
function categoryFromComplemento(compl: string | null | undefined): string | null {
  if (!compl || !compl.trim()) return null;
  const c = compl.trim();
  if (APARTMENT_RE.test(c)) return "apartamento";
  if (GARAGE_RE.test(c)) return "garagem";
  if (COMMERCIAL_RE.test(c)) return "comercial";
  if (HOUSE_RE.test(c)) return "casa";
  return null;
}

// Decide a categoria final combinando IPTU (prioridade) + complemento + área.
function inferCategory(row: any): string | null {
  const fromIptu = categoryFromUsoIptu(row.descricao_uso_iptu);
  if (fromIptu) return fromIptu;
  const fromCompl = categoryFromComplemento(row.complemento);
  if (fromCompl) return fromCompl;
  // Sem complemento + sem área construída => provável terreno
  const area = row.area_construida == null ? 0 : Number(row.area_construida);
  if ((!row.complemento || !String(row.complemento).trim()) && area === 0) return "terreno";
  return null;
}

function normalize(s: string): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const tipo = (body.tipo ?? "").toString().toLowerCase().trim();
    const logradouro = (body.logradouro ?? "").toString().trim();
    const numero = (body.numero ?? "").toString().trim();
    const bairro = (body.bairro ?? "").toString().trim();
    const cep = (body.cep ?? "").toString().replace(/\D/g, "");

    // Pelo menos 1 critério é obrigatório
    if (!logradouro && !numero && !bairro && !cep) {
      return new Response(JSON.stringify({
        results: [],
        total: 0,
        message: "Informe pelo menos um filtro (logradouro, número, bairro ou CEP).",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build query — AND entre filtros
    let query = userClient
      .from("itbi_transactions")
      .select(
        "id, data_transacao, logradouro, numero, complemento, bairro, cep, sql_iptu, area_construida, valor_transacao, valor_venal, ano_referencia, mes_referencia, descricao_uso_iptu, descricao_padrao_iptu",
      )
      .order("data_transacao", { ascending: false, nullsFirst: false })
      .limit(500);

    if (logradouro) {
      const norm = normalize(logradouro);
      const cleaned = norm.replace(/^(R|RUA|AV|AVENIDA|AL|ALAMEDA|TRAV|TRAVESSA|EST|ESTRADA|PRC|PRACA|LARGO)\s+/i, "");
      query = query.ilike("logradouro_normalizado", `%${cleaned}%`);
    }
    if (numero) {
      const numClean = numero.replace(/\D/g, "");
      if (numClean) query = query.eq("numero_limpo", numClean);
    }
    if (bairro) {
      const bnorm = normalize(bairro);
      query = query.ilike("bairro_normalizado", `%${bnorm}%`);
    }
    if (cep) {
      query = query.eq("cep", cep);
    }

    const { data, error } = await query;
    if (error) throw error;

    let rows = data ?? [];

    // === Filtro de TIPO ===
    // Prioridade: descricao_uso_iptu > complemento > heurística por área.
    let descartados = 0;
    if (tipo) {
      const before = rows.length;
      rows = rows.filter((r: any) => {
        const cat = inferCategory(r);
        const area = r.area_construida == null ? 0 : Number(r.area_construida);

        if (tipo === "apartamento") {
          if (cat === "apartamento") return true;
          // Sem sinal claro: aceita se NÃO for garagem/comercial/casa/terreno e área >= 25m²
          if (cat == null && area >= 25) return true;
          return false;
        }
        if (tipo === "casa") return cat === "casa";
        if (tipo === "residencial") {
          return cat === "apartamento" || cat === "casa" || (cat == null && area >= 25);
        }
        if (tipo === "garagem" || tipo === "vaga") return cat === "garagem";
        if (tipo === "comercial" || tipo === "sala" || tipo === "loja") return cat === "comercial";
        if (tipo === "terreno") return cat === "terreno";
        return true;
      });
      descartados = before - rows.length;
    }

    // Deduplicação (ITBI registra comprador + vendedor)
    const seen = new Set<string>();
    const dedup = rows.filter((r: any) => {
      const key = `${r.data_transacao ?? ""}|${r.valor_transacao ?? ""}|${r.sql_iptu ?? ""}|${r.numero ?? ""}|${r.complemento ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return new Response(
      JSON.stringify({
        results: dedup,
        total: dedup.length,
        raw_count: data?.length ?? 0,
        descartados_por_tipo: descartados,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[itbi-search] erro:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
