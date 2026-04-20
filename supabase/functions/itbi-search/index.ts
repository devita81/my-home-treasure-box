// itbi-search: busca genérica na tabela itbi_transactions (cidade SP).
// Filtros AND combináveis: tipo, logradouro, número, bairro, CEP.
// Retorna até 500 registros deduplicados, ordenados por data desc.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Tipos residenciais que devem descartar garagens/vagas/depósitos.
const NON_RESIDENTIAL_RE = /\b(GARAGEM|GAR|VAGA|VG|BOX|ESTACIONAMENTO|DEPOSITO|DEP|HOBBY|CUBICULO)\b/i;
const COMMERCIAL_RE = /\b(SALA|LOJA|CONJ|CONJUNTO|COMERCIAL|ESCRITORIO)\b/i;

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
        "id, data_transacao, logradouro, numero, complemento, bairro, cep, sql_iptu, area_construida, valor_transacao, valor_venal, ano_referencia, mes_referencia",
      )
      .order("data_transacao", { ascending: false, nullsFirst: false })
      .limit(500);

    if (logradouro) {
      const norm = normalize(logradouro);
      // Remove prefixos comuns para melhorar match
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

    // Filtro de TIPO (server-side, baseado no complemento)
    let descartados = 0;
    if (tipo === "apartamento" || tipo === "casa" || tipo === "residencial") {
      const before = rows.length;
      rows = rows.filter((r: any) => {
        const compl = (r.complemento ?? "").toString();
        if (NON_RESIDENTIAL_RE.test(compl)) return false;
        if (r.area_construida != null && Number(r.area_construida) > 0 && Number(r.area_construida) < 25) return false;
        return true;
      });
      descartados = before - rows.length;
    } else if (tipo === "garagem" || tipo === "vaga") {
      rows = rows.filter((r: any) => NON_RESIDENTIAL_RE.test((r.complemento ?? "").toString()));
    } else if (tipo === "comercial" || tipo === "sala" || tipo === "loja") {
      rows = rows.filter((r: any) => COMMERCIAL_RE.test((r.complemento ?? "").toString()));
    } else if (tipo === "terreno") {
      // Terrenos: sem complemento ou com área_construida nula/zero
      rows = rows.filter((r: any) => {
        const compl = (r.complemento ?? "").toString().trim();
        return !compl && (!r.area_construida || Number(r.area_construida) === 0);
      });
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
