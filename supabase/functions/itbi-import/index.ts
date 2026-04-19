// Edge function para importar XLSX da Prefeitura de SP para a tabela itbi_transactions.
// Recebe { ano, mes, sourceUrl } e processa o arquivo em batches.
// Apenas admins podem invocar.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 500;

// Tenta encontrar o índice da coluna procurando por palavras-chave no header
function findCol(headers: string[], ...keywords: string[]): number {
  const norm = (s: string) => (s ?? "").toString().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const normHeaders = headers.map(norm);
  for (const kw of keywords) {
    const k = norm(kw);
    const idx = normHeaders.findIndex((h) => h.includes(k));
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseDate(value: any): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(value);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(value).trim();
  // dd/mm/yyyy
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

function parseNumber(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  const s = String(value).replace(/[R$\s.]/g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    // Verificar se é admin
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem importar dados ITBI" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { ano, mes, sourceUrl } = await req.json();
    if (!ano || !sourceUrl) {
      return new Response(JSON.stringify({ error: "ano e sourceUrl são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cria registro de log
    const { data: logRow, error: logErr } = await adminClient
      .from("itbi_import_log")
      .insert({
        ano_referencia: ano,
        mes_referencia: mes ?? null,
        source_url: sourceUrl,
        status: "in_progress",
        imported_by: userId,
      })
      .select()
      .single();
    if (logErr) throw logErr;

    let imported = 0;
    let skipped = 0;
    let errorMessage: string | null = null;

    try {
      console.log(`[itbi-import] Baixando ${sourceUrl}...`);
      const xlsxResp = await fetch(sourceUrl);
      if (!xlsxResp.ok) throw new Error(`Falha ao baixar XLSX: HTTP ${xlsxResp.status}`);
      const buf = new Uint8Array(await xlsxResp.arrayBuffer());

      console.log(`[itbi-import] Parseando ${buf.length} bytes...`);
      const wb = XLSX.read(buf, { type: "array" });

      // Processar todas as abas (cada aba normalmente é um mês)
      for (const sheetName of wb.SheetNames) {
        // Se mes foi especificado, tenta filtrar abas pelo nome
        if (mes && !sheetName.toLowerCase().includes(String(mes).padStart(2, "0")) && !sheetName.includes(`${mes}`)) {
          // Não pula se nome da aba não tem padrão claro; processa mesmo assim na primeira aba
        }
        const ws = wb.Sheets[sheetName];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
        if (rows.length < 2) continue;

        const headers = rows[0].map((h) => String(h ?? ""));
        const idx = {
          sql: findCol(headers, "SQL", "S.Q.L"),
          natureza: findCol(headers, "NATUREZA"),
          logradouro: findCol(headers, "NOME DO LOGRADOURO", "LOGRADOURO"),
          numero: findCol(headers, "NUMERO", "NÚMERO"),
          complemento: findCol(headers, "COMPLEMENTO"),
          bairro: findCol(headers, "BAIRRO"),
          cep: findCol(headers, "CEP"),
          data: findCol(headers, "DATA DE TRANSACAO", "DATA TRANSACAO", "DATA DA TRANSACAO"),
          valor: findCol(headers, "VALOR DE TRANSACAO", "VALOR TRANSACAO"),
          venal: findCol(headers, "VALOR VENAL", "VALOR DE REFERENCIA"),
          areaCons: findCol(headers, "AREA CONSTRUIDA", "ÁREA CONSTRUÍDA"),
          areaTerr: findCol(headers, "AREA DO TERRENO", "AREA TERRENO"),
        };

        if (idx.logradouro === -1) {
          console.warn(`[itbi-import] Aba "${sheetName}" sem coluna logradouro reconhecível, pulando.`);
          continue;
        }

        // Detectar mês pela aba se não foi passado
        let mesAba = mes ?? null;
        const mAba = sheetName.match(/(\d{1,2})/);
        if (!mesAba && mAba) {
          const m = parseInt(mAba[1], 10);
          if (m >= 1 && m <= 12) mesAba = m;
        }

        let batch: any[] = [];
        for (let i = 1; i < rows.length; i++) {
          const r = rows[i];
          const logradouro = r[idx.logradouro];
          if (!logradouro || String(logradouro).trim() === "") {
            skipped++;
            continue;
          }
          batch.push({
            sql_iptu: idx.sql !== -1 ? (r[idx.sql] ? String(r[idx.sql]).trim() : null) : null,
            natureza_transacao: idx.natureza !== -1 ? (r[idx.natureza] ? String(r[idx.natureza]).trim() : null) : null,
            logradouro: String(logradouro).trim(),
            numero: idx.numero !== -1 && r[idx.numero] != null ? String(r[idx.numero]).trim() : null,
            complemento: idx.complemento !== -1 && r[idx.complemento] != null ? String(r[idx.complemento]).trim() : null,
            bairro: idx.bairro !== -1 && r[idx.bairro] != null ? String(r[idx.bairro]).trim() : null,
            cep: idx.cep !== -1 && r[idx.cep] != null ? String(r[idx.cep]).trim() : null,
            data_transacao: idx.data !== -1 ? parseDate(r[idx.data]) : null,
            valor_transacao: idx.valor !== -1 ? parseNumber(r[idx.valor]) : null,
            valor_venal: idx.venal !== -1 ? parseNumber(r[idx.venal]) : null,
            area_construida: idx.areaCons !== -1 ? parseNumber(r[idx.areaCons]) : null,
            area_terreno: idx.areaTerr !== -1 ? parseNumber(r[idx.areaTerr]) : null,
            ano_referencia: ano,
            mes_referencia: mesAba ?? 0,
          });

          if (batch.length >= BATCH_SIZE) {
            const { error: insErr } = await adminClient.from("itbi_transactions").insert(batch);
            if (insErr) throw insErr;
            imported += batch.length;
            batch = [];
          }
        }
        if (batch.length > 0) {
          const { error: insErr } = await adminClient.from("itbi_transactions").insert(batch);
          if (insErr) throw insErr;
          imported += batch.length;
        }
        console.log(`[itbi-import] Aba "${sheetName}": ${imported} inseridos até agora.`);
      }

      await adminClient
        .from("itbi_import_log")
        .update({
          rows_imported: imported,
          rows_skipped: skipped,
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", logRow.id);

      return new Response(JSON.stringify({ imported, skipped, logId: logRow.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      await adminClient
        .from("itbi_import_log")
        .update({
          rows_imported: imported,
          rows_skipped: skipped,
          status: "failed",
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq("id", logRow.id);
      throw err;
    }
  } catch (error) {
    console.error("[itbi-import] Erro:", error);
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
