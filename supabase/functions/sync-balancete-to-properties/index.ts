// Sincroniza valores do imóvel (aluguel, condomínio, IPTU, taxa adm, alugado, inquilino)
// a partir do lançamento mais recente do balancete vinculado por property_id.
// REGRAS:
// - Só atualiza imóveis com pelo menos 1 lançamento de balancete vinculado.
// - Para cada campo, sobrescreve apenas se o balancete tiver valor (não-nulo e diferente de zero
//   para os monetários; para alugado/inquilino sobrescreve se houver valor explícito).
// - Se a informação não estiver no balancete, mantém o que já existe em properties.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verifica usuário autenticado
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    // Service client para ler balancete (ignorando RLS) e atualizar properties
    const admin = createClient(supabaseUrl, serviceKey);

    // 1. Properties do usuário
    const { data: props, error: propsErr } = await admin
      .from("properties")
      .select(
        "id, valor_aluguel, valor_condominio, iptu_value, taxa_administracao, alugado, inquilino"
      )
      .eq("user_id", userId);
    if (propsErr) throw propsErr;
    const propIds = (props ?? []).map((p) => p.id);
    if (propIds.length === 0) {
      return new Response(
        JSON.stringify({ updated: 0, skipped: 0, message: "Sem imóveis." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Para cada property, pegar último (ano,mes) com vínculo
    const { data: bals, error: balErr } = await admin
      .from("property_balancete")
      .select(
        "property_id, ano, mes, aluguel, condominio, iptu, taxa_administracao, alugado, locatario"
      )
      .in("property_id", propIds)
      .order("ano", { ascending: false })
      .order("mes", { ascending: false });
    if (balErr) throw balErr;

    const latestByProp = new Map<string, typeof bals[number]>();
    for (const r of bals ?? []) {
      if (!r.property_id) continue;
      if (!latestByProp.has(r.property_id)) latestByProp.set(r.property_id, r);
    }

    // 3. Atualiza cada property somente com valores presentes no balancete
    let updated = 0;
    let skipped = 0;
    const details: Array<{ id: string; changes: string[] }> = [];

    for (const p of props ?? []) {
      const last = latestByProp.get(p.id);
      if (!last) {
        skipped++;
        continue;
      }
      const patch: Record<string, unknown> = {};
      const changes: string[] = [];

      // Aluguel: balancete usa valor positivo (receita). Sobrescreve se != 0
      if (last.aluguel != null && Number(last.aluguel) !== 0) {
        const v = Number(last.aluguel);
        if (v !== Number(p.valor_aluguel ?? 0)) {
          patch.valor_aluguel = v;
          changes.push("aluguel");
        }
      }
      // Condomínio: balancete grava negativo (despesa). properties guarda positivo.
      if (last.condominio != null && Number(last.condominio) !== 0) {
        const v = Math.abs(Number(last.condominio));
        if (v !== Number(p.valor_condominio ?? 0)) {
          patch.valor_condominio = v;
          changes.push("condominio");
        }
      }
      // IPTU: balancete grava mensal negativo; properties usa valor anual.
      // Convertemos: valor mensal absoluto * 12.
      if (last.iptu != null && Number(last.iptu) !== 0) {
        const mensal = Math.abs(Number(last.iptu));
        const anual = Math.round(mensal * 12 * 100) / 100;
        if (anual !== Number(p.iptu_value ?? 0)) {
          patch.iptu_value = anual;
          changes.push("iptu");
        }
      }
      // Taxa de administração: balancete negativo; properties positivo.
      if (
        last.taxa_administracao != null &&
        Number(last.taxa_administracao) !== 0
      ) {
        const v = Math.abs(Number(last.taxa_administracao));
        if (v !== Number(p.taxa_administracao ?? 0)) {
          patch.taxa_administracao = v;
          changes.push("taxa_adm");
        }
      }
      // Alugado / inquilino: só sobrescreve se houver flag explícita
      if (typeof last.alugado === "boolean" && last.alugado !== p.alugado) {
        patch.alugado = last.alugado;
        changes.push("alugado");
      }
      if (
        last.locatario &&
        last.locatario.trim() !== "" &&
        last.locatario !== p.inquilino
      ) {
        patch.inquilino = last.locatario;
        changes.push("inquilino");
      }

      if (Object.keys(patch).length === 0) {
        skipped++;
        continue;
      }

      const { error: updErr } = await admin
        .from("properties")
        .update(patch)
        .eq("id", p.id);
      if (updErr) {
        console.error("Erro ao atualizar", p.id, updErr);
        skipped++;
        continue;
      }
      updated++;
      details.push({ id: p.id, changes });
    }

    return new Response(
      JSON.stringify({
        updated,
        skipped,
        total: props?.length ?? 0,
        com_balancete: latestByProp.size,
        details,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("sync-balancete-to-properties error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
