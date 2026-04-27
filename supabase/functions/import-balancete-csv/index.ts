// Importa balancete a partir de CSV enviado pelo cliente.
// Fluxo:
// 1. Apaga TODOS os registros de balancete do usuário autenticado.
// 2. Faz parse do CSV (formato fixo definido pelo template do usuário).
// 3. Para cada linha, monta a "chave forte" (cidade+rua+numero+apartamento+complemento normalizados)
//    e tenta vincular ao imóvel correspondente em `properties` do mesmo usuário.
// 4. Insere todas as linhas na tabela `property_balancete` (vinculadas ou não).
// 5. Sincroniza valores em `properties` com o último (ano,mes) por imóvel — só sobrescreve campos
//    que tenham valor não-nulo/diferente de zero no balancete; do contrário mantém o que já existe.
// 6. Retorna relatório: linhas do balancete sem property + propriedades sem nenhum balancete.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Normalização IDÊNTICA à função SQL public.normalize_addr_part — mantida em sync.
function normalizeAddrPart(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildKey(
  cidade: string | null,
  rua: string | null,
  numero: string | null,
  apartamento: string | null,
  complemento: string | null
): string {
  return [
    normalizeAddrPart(cidade),
    normalizeAddrPart(rua),
    normalizeAddrPart(numero),
    normalizeAddrPart(apartamento),
    normalizeAddrPart(complemento),
  ].join("|");
}

// Parser CSV simples com suporte a campos entre aspas e vírgulas/quebras dentro de aspas.
function parseCSV(text: string): string[][] {
  // Remove BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        cur.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        cur.push(field);
        field = "";
        // ignora linhas totalmente vazias
        if (cur.length > 1 || (cur.length === 1 && cur[0].trim() !== "")) {
          rows.push(cur);
        }
        cur = [];
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    if (cur.length > 1 || (cur.length === 1 && cur[0].trim() !== "")) {
      rows.push(cur);
    }
  }
  return rows;
}

// Converte string em número (aceita "" → 0, vírgula decimal, etc.)
function toNum(v: string | undefined | null): number {
  if (v == null) return 0;
  const s = String(v).trim();
  if (!s) return 0;
  const cleaned = s.replace(/\s/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function toInt(v: string | undefined | null): number {
  const n = toNum(v);
  return Math.trunc(n);
}

function toBool(v: string | undefined | null): boolean | null {
  if (v == null) return null;
  const s = v.trim().toLowerCase();
  if (!s) return null;
  if (["sim", "true", "1", "yes", "y", "s"].includes(s)) return true;
  if (["nao", "não", "false", "0", "no", "n"].includes(s)) return false;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // 1. Autenticação
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const userId = userData.user.id;

    // 2. Recebe CSV (multipart/form-data com campo "file")
    const ct = req.headers.get("content-type") ?? "";
    let csvText: string;
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return new Response(
          JSON.stringify({ error: "Arquivo CSV não enviado (campo 'file')" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      csvText = await file.text();
    } else {
      // fallback: corpo é o próprio CSV em texto
      csvText = await req.text();
    }
    if (!csvText || !csvText.trim()) {
      return new Response(
        JSON.stringify({ error: "CSV vazio" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Parse
    const rows = parseCSV(csvText);
    if (rows.length < 2) {
      return new Response(
        JSON.stringify({ error: "CSV sem linhas de dados" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const header = rows[0].map((h) => h.trim().toLowerCase());
    const idx = (name: string) => header.findIndex((h) => h === name.toLowerCase());

    const colId = idx("id");
    const colAno = idx("ano");
    const colMes = idx("mes");
    const colCidade = idx("cidade");
    const colBairro = idx("bairro");
    const colRua = idx("rua");
    const colNumero = idx("numero");
    const colApto = idx("apartamento");
    const colComp = idx("complemento");
    const colAlugado = header.findIndex((h) => h.startsWith("alugado"));
    const colLocatario = idx("locatário") >= 0 ? idx("locatário") : idx("locatario");
    const colCpf = idx("cpf locador");
    const colPeriodo = idx("periodo contrato");
    const colAluguel = idx("aluguel");
    const colCondominio = idx("condominio");
    const colReembCond = idx("reembolso condominio");
    const colIptu = idx("iptu");
    const colReembIptu = idx("reembolso iptu");
    const colTaxa = idx("taxa administração") >= 0 ? idx("taxa administração") : idx("taxa administracao");
    const colOutras = idx("outras despesas");
    const colReembOutras = idx("reembolso outras despesas");

    if (colAno < 0 || colMes < 0 || colCidade < 0 || colRua < 0) {
      return new Response(
        JSON.stringify({
          error: "Cabeçalho do CSV inválido — colunas obrigatórias: ano, mes, cidade, rua",
          headerRecebido: header,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Carrega properties do usuário para montar índice por chave forte
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: props, error: propsErr } = await admin
      .from("properties")
      .select(
        "id, cidade, rua, numero, apartamento, complemento, valor_aluguel, valor_condominio, iptu_value, taxa_administracao, alugado, inquilino"
      )
      .eq("user_id", userId);
    if (propsErr) throw propsErr;

    type PropRow = NonNullable<typeof props>[number];
    const propsByKey = new Map<string, PropRow>();
    const matchedPropIds = new Set<string>();
    for (const p of props ?? []) {
      const k = buildKey(p.cidade, p.rua, p.numero, p.apartamento, p.complemento);
      if (k.replace(/\|/g, "").length > 0) {
        // Em caso de duplicata na chave, o último ganha; mas avisaremos no log
        if (propsByKey.has(k)) {
          console.warn("Chave forte duplicada em properties:", k);
        }
        propsByKey.set(k, p as PropRow);
      }
    }

    // 5. Apaga TODOS os registros antigos do balancete deste usuário
    const { error: delErr, count: deletedCount } = await admin
      .from("property_balancete")
      .delete({ count: "exact" })
      .eq("user_id", userId);
    if (delErr) throw delErr;

    // 6. Monta linhas para insert + relatório de não vinculados
    const inserts: Array<Record<string, unknown>> = [];
    const naoVinculados: Array<{
      external_id: string | null;
      cidade: string | null;
      rua: string | null;
      numero: string | null;
      apartamento: string | null;
      complemento: string | null;
      ano: number;
      mes: number;
    }> = [];
    let parseErrors = 0;

    // Para sync: guarda último (ano,mes) por property_id
    type LastByProp = {
      ano: number;
      mes: number;
      aluguel: number;
      condominio: number;
      iptu: number;
      taxa_administracao: number;
      alugado: boolean | null;
      locatario: string | null;
    };
    const latestByProp = new Map<string, LastByProp>();

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.every((c) => !c || !c.trim())) continue;

      const ano = toInt(row[colAno]);
      const mes = toInt(row[colMes]);
      if (!ano || !mes || mes < 1 || mes > 12) {
        parseErrors++;
        continue;
      }

      const cidade = (row[colCidade] ?? "").trim() || null;
      const bairro = colBairro >= 0 ? ((row[colBairro] ?? "").trim() || null) : null;
      const rua = (row[colRua] ?? "").trim() || null;
      const numero = colNumero >= 0 ? ((row[colNumero] ?? "").trim() || null) : null;
      const apartamento = colApto >= 0 ? ((row[colApto] ?? "").trim() || null) : null;
      const complemento = colComp >= 0 ? ((row[colComp] ?? "").trim() || null) : null;

      const key = buildKey(cidade, rua, numero, apartamento, complemento);
      const matched = propsByKey.get(key);
      const propertyId = matched?.id ?? null;
      if (propertyId) matchedPropIds.add(propertyId);

      const externalId = colId >= 0 ? ((row[colId] ?? "").trim() || null) : null;

      if (!propertyId) {
        naoVinculados.push({
          external_id: externalId,
          cidade,
          rua,
          numero,
          apartamento,
          complemento,
          ano,
          mes,
        });
      }

      const aluguel = colAluguel >= 0 ? toNum(row[colAluguel]) : 0;
      const condominio = colCondominio >= 0 ? toNum(row[colCondominio]) : 0;
      const reembCond = colReembCond >= 0 ? toNum(row[colReembCond]) : 0;
      const iptu = colIptu >= 0 ? toNum(row[colIptu]) : 0;
      const reembIptu = colReembIptu >= 0 ? toNum(row[colReembIptu]) : 0;
      const taxa = colTaxa >= 0 ? toNum(row[colTaxa]) : 0;
      const outras = colOutras >= 0 ? toNum(row[colOutras]) : 0;
      const reembOutras = colReembOutras >= 0 ? toNum(row[colReembOutras]) : 0;
      // `liquido` é coluna gerada no banco — não enviar no insert

      const alugado = colAlugado >= 0 ? toBool(row[colAlugado]) : null;
      const locatario = colLocatario >= 0 ? ((row[colLocatario] ?? "").trim() || null) : null;
      const cpfLocador = colCpf >= 0 ? ((row[colCpf] ?? "").trim() || null) : null;
      const periodo = colPeriodo >= 0 ? ((row[colPeriodo] ?? "").trim() || null) : null;

      inserts.push({
        external_id: externalId,
        user_id: userId,
        property_id: propertyId,
        ano,
        mes,
        cidade,
        bairro,
        rua,
        numero,
        apartamento,
        complemento,
        alugado,
        locatario,
        cpf_locador: cpfLocador,
        periodo_contrato: periodo,
        aluguel,
        condominio,
        reembolso_condominio: reembCond,
        iptu,
        reembolso_iptu: reembIptu,
        taxa_administracao: taxa,
        outras_despesas: outras,
        reembolso_outras_despesas: reembOutras,
        liquido,
      });

      // Atualiza latestByProp
      if (propertyId) {
        const prev = latestByProp.get(propertyId);
        const isNewer =
          !prev || ano > prev.ano || (ano === prev.ano && mes > prev.mes);
        if (isNewer) {
          latestByProp.set(propertyId, {
            ano,
            mes,
            aluguel,
            condominio,
            iptu,
            taxa_administracao: taxa,
            alugado,
            locatario,
          });
        }
      }
    }

    // 7. Insere em lotes
    let insertedCount = 0;
    const BATCH = 500;
    for (let i = 0; i < inserts.length; i += BATCH) {
      const slice = inserts.slice(i, i + BATCH);
      const { error: insErr } = await admin.from("property_balancete").insert(slice);
      if (insErr) throw insErr;
      insertedCount += slice.length;
    }

    // 8. Sincroniza properties — só sobrescreve campos com valor não-nulo/diferente de zero
    let propsUpdated = 0;
    const syncDetails: Array<{ id: string; changes: string[] }> = [];
    for (const p of props ?? []) {
      const last = latestByProp.get(p.id);
      if (!last) continue;
      const patch: Record<string, unknown> = {};
      const changes: string[] = [];

      if (last.aluguel != null && Number(last.aluguel) !== 0) {
        const v = Number(last.aluguel);
        if (v !== Number(p.valor_aluguel ?? 0)) {
          patch.valor_aluguel = v;
          changes.push("aluguel");
        }
      }
      if (last.condominio != null && Number(last.condominio) !== 0) {
        const v = Math.abs(Number(last.condominio));
        if (v !== Number(p.valor_condominio ?? 0)) {
          patch.valor_condominio = v;
          changes.push("condominio");
        }
      }
      if (last.iptu != null && Number(last.iptu) !== 0) {
        const v = Math.round(Math.abs(Number(last.iptu)) * 100) / 100;
        if (v !== Number(p.iptu_value ?? 0)) {
          patch.iptu_value = v;
          changes.push("iptu");
        }
      }
      if (last.taxa_administracao != null && Number(last.taxa_administracao) !== 0) {
        const v = Math.abs(Number(last.taxa_administracao));
        if (v !== Number(p.taxa_administracao ?? 0)) {
          patch.taxa_administracao = v;
          changes.push("taxa_adm");
        }
      }
      if (typeof last.alugado === "boolean" && last.alugado !== p.alugado) {
        patch.alugado = last.alugado;
        changes.push("alugado");
      }
      if (last.locatario && last.locatario.trim() !== "" && last.locatario !== p.inquilino) {
        patch.inquilino = last.locatario;
        changes.push("inquilino");
      }

      if (Object.keys(patch).length === 0) continue;
      const { error: upErr } = await admin
        .from("properties")
        .update(patch)
        .eq("id", p.id);
      if (upErr) {
        console.error("Erro ao sincronizar property", p.id, upErr);
        continue;
      }
      propsUpdated++;
      syncDetails.push({ id: p.id, changes });
    }

    // 9. Properties sem nenhum balancete vinculado
    const propsSemBalancete = (props ?? [])
      .filter((p) => !matchedPropIds.has(p.id))
      .map((p) => ({
        id: p.id,
        cidade: p.cidade,
        rua: p.rua,
        numero: p.numero,
        apartamento: p.apartamento,
        complemento: p.complemento,
      }));

    return new Response(
      JSON.stringify({
        ok: true,
        deletedAntes: deletedCount ?? 0,
        linhasCsv: rows.length - 1,
        linhasInseridas: insertedCount,
        parseErrors,
        vinculadas: insertedCount - naoVinculados.length,
        balanceteSemImovel: naoVinculados,
        propriedadesSemBalancete: propsSemBalancete,
        propertiesAtualizadas: propsUpdated,
        syncDetails,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("import-balancete-csv error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
