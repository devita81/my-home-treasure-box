// Edge function para importar XLSX da Prefeitura de SP para a tabela itbi_transactions.
// Importa TODOS os campos disponíveis e usa hash único por linha para evitar duplicatas
// entre execuções (idempotente — pode reimportar os mesmos arquivos sem criar duplicatas).
// Apenas admins podem invocar.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 500;

const MES_MAP: Record<string, number> = {
  JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, JUN: 6,
  JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12,
};

const SKIP_SHEETS = new Set(["LEGENDA", "EXPLICACOES", "EXPLICAÇÕES", "TABELA DE USOS", "TABELA DE PADROES", "TABELA DE PADRÕES"]);

function normalizeHeader(s: string): string {
  return (s ?? "").toString().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function findCol(headers: string[], ...keywords: string[]): number {
  const normHeaders = headers.map(normalizeHeader);
  for (const kw of keywords) {
    const k = normalizeHeader(kw);
    const idx = normHeaders.findIndex((h) => h === k || h.includes(k));
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    const d = XLSX.SSF.parse_date_code(value);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(value).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return isNaN(value) ? null : value;
  const s = String(value).replace(/[R$\s]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function strOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function detectMonthFromSheet(sheetName: string): number | null {
  const upper = sheetName.toUpperCase();
  for (const [abbr, num] of Object.entries(MES_MAP)) {
    if (upper.includes(abbr)) return num;
  }
  const m = sheetName.match(/(\d{1,2})/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= 12) return n;
  }
  return null;
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

    const { data: roleData } = await adminClient
      .from("user_roles").select("role")
      .eq("user_id", userId).eq("role", "admin").maybeSingle();
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

    const { data: logRow, error: logErr } = await adminClient
      .from("itbi_import_log")
      .insert({
        ano_referencia: ano, mes_referencia: mes ?? null,
        source_url: sourceUrl, status: "in_progress", imported_by: userId,
      })
      .select().single();
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
      const wb = XLSX.read(buf, { type: "array", cellDates: true });

      for (const sheetName of wb.SheetNames) {
        const upperSheet = sheetName.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (SKIP_SHEETS.has(upperSheet)) {
          console.log(`[itbi-import] Pulando aba "${sheetName}" (metadata).`);
          continue;
        }

        const mesAba = mes ?? detectMonthFromSheet(sheetName);
        if (mes && mesAba !== mes) continue; // filtra para mês específico se solicitado

        const ws = wb.Sheets[sheetName];
        const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
        if (rows.length < 2) continue;

        const headers = (rows[0] as unknown[]).map((h) => String(h ?? ""));
        const idx = {
          sql: findCol(headers, "N° DO CADASTRO (SQL)", "CADASTRO (SQL)", "SQL"),
          logradouro: findCol(headers, "NOME DO LOGRADOURO", "LOGRADOURO"),
          numero: findCol(headers, "NUMERO", "NÚMERO"),
          complemento: findCol(headers, "COMPLEMENTO"),
          bairro: findCol(headers, "BAIRRO"),
          referencia: findCol(headers, "REFERENCIA", "REFERÊNCIA"),
          cep: findCol(headers, "CEP"),
          natureza: findCol(headers, "NATUREZA DE TRANSACAO", "NATUREZA"),
          valor: findCol(headers, "VALOR DE TRANSACAO", "VALOR DE TRANSAÇÃO"),
          data: findCol(headers, "DATA DE TRANSACAO", "DATA DE TRANSAÇÃO"),
          venal: findCol(headers, "VALOR VENAL DE REFERENCIA", "VALOR VENAL"),
          proporcao: findCol(headers, "PROPORCAO TRANSMITIDA", "PROPORÇÃO TRANSMITIDA"),
          venalProp: findCol(headers, "VALOR VENAL DE REFERENCIA (PROPORCIONAL)", "VENAL DE REFERENCIA (PROPORCIONAL)"),
          baseCalc: findCol(headers, "BASE DE CALCULO", "BASE DE CÁLCULO"),
          tipoFin: findCol(headers, "TIPO DE FINANCIAMENTO"),
          valorFin: findCol(headers, "VALOR FINANCIADO"),
          cartorio: findCol(headers, "CARTORIO DE REGISTRO", "CARTÓRIO DE REGISTRO"),
          matricula: findCol(headers, "MATRICULA DO IMOVEL", "MATRÍCULA DO IMÓVEL"),
          situacao: findCol(headers, "SITUACAO DO SQL", "SITUAÇÃO DO SQL"),
          areaTerr: findCol(headers, "AREA DO TERRENO", "ÁREA DO TERRENO"),
          testada: findCol(headers, "TESTADA"),
          fracao: findCol(headers, "FRACAO IDEAL", "FRAÇÃO IDEAL"),
          areaCons: findCol(headers, "AREA CONSTRUIDA", "ÁREA CONSTRUÍDA"),
          uso: findCol(headers, "USO (IPTU)"),
          descUso: findCol(headers, "DESCRICAO DO USO (IPTU)", "DESCRIÇÃO DO USO (IPTU)"),
          padrao: findCol(headers, "PADRAO (IPTU)", "PADRÃO (IPTU)"),
          descPadrao: findCol(headers, "DESCRICAO DO PADRAO (IPTU)", "DESCRIÇÃO DO PADRÃO (IPTU)"),
          acc: findCol(headers, "ACC (IPTU)"),
        };

        if (idx.logradouro === -1) {
          console.warn(`[itbi-import] Aba "${sheetName}" sem coluna logradouro, pulando.`);
          continue;
        }

        let batch: Record<string, unknown>[] = [];
        for (let i = 1; i < rows.length; i++) {
          const r = rows[i];
          const logradouro = r[idx.logradouro];
          if (!logradouro || String(logradouro).trim() === "") {
            skipped++;
            continue;
          }

          const sqlIptu = idx.sql !== -1 ? strOrNull(r[idx.sql]) : null;
          const dataTransacao = idx.data !== -1 ? parseDate(r[idx.data]) : null;
          const valorTransacao = idx.valor !== -1 ? parseNumber(r[idx.valor]) : null;
          const numero = idx.numero !== -1 ? strOrNull(r[idx.numero]) : null;
          const complemento = idx.complemento !== -1 ? strOrNull(r[idx.complemento]) : null;

          // Hash determinístico (idempotente entre reimportações)
          const hashInput = [
            sqlIptu ?? "",
            String(logradouro).trim(),
            numero ?? "",
            complemento ?? "",
            dataTransacao ?? "",
            valorTransacao ?? "",
            ano,
            mesAba ?? 0,
          ].join("|");
          const linhaHash = await sha256Hex(hashInput);

          batch.push({
            sql_iptu: sqlIptu,
            logradouro: String(logradouro).trim(),
            numero,
            complemento,
            bairro: idx.bairro !== -1 ? strOrNull(r[idx.bairro]) : null,
            referencia: idx.referencia !== -1 ? strOrNull(r[idx.referencia]) : null,
            cep: idx.cep !== -1 ? strOrNull(r[idx.cep]) : null,
            natureza_transacao: idx.natureza !== -1 ? strOrNull(r[idx.natureza]) : null,
            valor_transacao: valorTransacao,
            data_transacao: dataTransacao,
            valor_venal: idx.venal !== -1 ? parseNumber(r[idx.venal]) : null,
            proporcao_transmitida: idx.proporcao !== -1 ? parseNumber(r[idx.proporcao]) : null,
            valor_venal_proporcional: idx.venalProp !== -1 ? parseNumber(r[idx.venalProp]) : null,
            base_calculo: idx.baseCalc !== -1 ? parseNumber(r[idx.baseCalc]) : null,
            tipo_financiamento: idx.tipoFin !== -1 ? strOrNull(r[idx.tipoFin]) : null,
            valor_financiado: idx.valorFin !== -1 ? parseNumber(r[idx.valorFin]) : null,
            cartorio_registro: idx.cartorio !== -1 ? strOrNull(r[idx.cartorio]) : null,
            matricula_imovel: idx.matricula !== -1 ? strOrNull(r[idx.matricula]) : null,
            situacao_sql: idx.situacao !== -1 ? strOrNull(r[idx.situacao]) : null,
            area_terreno: idx.areaTerr !== -1 ? parseNumber(r[idx.areaTerr]) : null,
            testada: idx.testada !== -1 ? parseNumber(r[idx.testada]) : null,
            fracao_ideal: idx.fracao !== -1 ? parseNumber(r[idx.fracao]) : null,
            area_construida: idx.areaCons !== -1 ? parseNumber(r[idx.areaCons]) : null,
            uso_iptu: idx.uso !== -1 ? strOrNull(r[idx.uso]) : null,
            descricao_uso_iptu: idx.descUso !== -1 ? strOrNull(r[idx.descUso]) : null,
            padrao_iptu: idx.padrao !== -1 ? strOrNull(r[idx.padrao]) : null,
            descricao_padrao_iptu: idx.descPadrao !== -1 ? strOrNull(r[idx.descPadrao]) : null,
            acc_iptu: idx.acc !== -1 ? strOrNull(r[idx.acc]) : null,
            ano_referencia: ano,
            mes_referencia: mesAba ?? 0,
            linha_hash: linhaHash,
          });

          if (batch.length >= BATCH_SIZE) {
            const { error: insErr } = await adminClient
              .from("itbi_transactions")
              .upsert(batch, { onConflict: "linha_hash", ignoreDuplicates: true });
            if (insErr) throw insErr;
            imported += batch.length;
            batch = [];
          }
        }
        if (batch.length > 0) {
          const { error: insErr } = await adminClient
            .from("itbi_transactions")
            .upsert(batch, { onConflict: "linha_hash", ignoreDuplicates: true });
          if (insErr) throw insErr;
          imported += batch.length;
        }
        console.log(`[itbi-import] Aba "${sheetName}" (mês ${mesAba}): ${imported} acumulados.`);
      }

      await adminClient.from("itbi_import_log").update({
        rows_imported: imported, rows_skipped: skipped,
        status: "completed", completed_at: new Date().toISOString(),
      }).eq("id", logRow.id);

      return new Response(JSON.stringify({ imported, skipped, logId: logRow.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      await adminClient.from("itbi_import_log").update({
        rows_imported: imported, rows_skipped: skipped,
        status: "failed", error_message: errorMessage,
        completed_at: new Date().toISOString(),
      }).eq("id", logRow.id);
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
