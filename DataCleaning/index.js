// index.js
// Usage: `node index.js`
// Adjust INPUT_* and OUTPUT_* paths as needed.

const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const { stringify } = require("csv-stringify/sync");
const { v4: uuidv4 } = require("uuid");

// ---------- CONFIG ----------
const INPUT_TECH = path.resolve("./Technical Support Dataset.csv");
const INPUT_IT = path.resolve("./IT Support Ticket Data.csv");
const OUTPUT_UNIFIED = path.resolve("./unified_semantic_search_dataset.csv");

const CHUNK_MAX_TOKENS = 300;   // approx by words
const CHUNK_OVERLAP_TOKENS = 50;

// Fields we’ll try to use to construct summary text from the “Technical Support” dataset
const TECH_TEXT_FIELDS = [
  "Topic",
  "Status",
  "Priority",
  "Source",
  "Product group",
  "Support Level",
  "Country"
];

// Body field for the “IT Support Ticket Data” dataset
const IT_BODY_FIELD = "Body";
// --------------------------------

function loadCsv(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true
  });
  return rows;
}

function cleanText(str) {
  if (str === undefined || str === null) return "";
  return String(str)
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

function chunkText(text, maxTokens = CHUNK_MAX_TOKENS, overlap = CHUNK_OVERLAP_TOKENS) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const chunks = [];
  let start = 0;
  while (start < words.length) {
    const end = Math.min(words.length, start + maxTokens);
    chunks.push(words.slice(start, end).join(" "));
    if (end === words.length) break;
    start += (maxTokens - overlap);
  }
  return chunks;
}

function safeJsonStringify(obj) {
  try {
    return JSON.stringify(obj);
  } catch {
    // Fallback if circular refs or weird values (unlikely here)
    const plain = {};
    for (const [k, v] of Object.entries(obj)) {
      plain[k] = typeof v === "string" ? v : String(v ?? "");
    }
    return JSON.stringify(plain);
  }
}

function buildTechText(row) {
  // Build a short, meaningful summary text from selected fields
  const parts = [];
  if (row["Topic"]) parts.push(cleanText(row["Topic"]));
  if (row["Status"]) parts.push(`Status: ${cleanText(row["Status"])}`);
  if (row["Priority"]) parts.push(`Priority: ${cleanText(row["Priority"])}`);
  if (row["Source"]) parts.push(`Source: ${cleanText(row["Source"])}`);
  if (row["Product group"]) parts.push(`Product group: ${cleanText(row["Product group"])}`);
  if (row["Support Level"]) parts.push(`Support Level: ${cleanText(row["Support Level"])}`);
  if (row["Country"]) parts.push(`Country: ${cleanText(row["Country"])}`);
  return cleanText(parts.filter(Boolean).join(". "));
}

function buildItText(row) {
  return cleanText(row[IT_BODY_FIELD] || "");
}

function asCleanMetadata(row, extra) {
  const md = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === IT_BODY_FIELD) continue; // don't duplicate large text in metadata
    md[k] = cleanText(v);
  }
  for (const [k, v] of Object.entries(extra || {})) {
    md[k] = v;
  }
  return md;
}

function toUnifiedRowsTech(rows) {
  const out = [];
  for (const r of rows) {
    const text = buildTechText(r);
    if (!text) continue;

    const ticketId = r["Ticket ID"] ? String(r["Ticket ID"]) : "";
    const chunks = chunkText(text);
    const metadata = asCleanMetadata(r, { source_dataset: "Technical Support Dataset" });

    chunks.forEach((chunk, i) => {
      out.push({
        id: `tech_${ticketId || uuidv4()}_${i}`,
        document_id: ticketId || "",
        chunk_id: i,
        text: chunk,
        metadata: safeJsonStringify(metadata)
      });
    });
  }
  return out;
}

function toUnifiedRowsIt(rows) {
  const out = [];
  rows.forEach((r, idx) => {
    const text = buildItText(r);
    if (!text) return;

    const chunks = chunkText(text);
    const metadata = asCleanMetadata(r, { source_dataset: "IT Support Ticket Data" });

    chunks.forEach((chunk, i) => {
      out.push({
        id: `itbody_${idx}_${i}`,
        document_id: "",
        chunk_id: i,
        text: chunk,
        metadata: safeJsonStringify(metadata)
      });
    });
  });
  return out;
}

function main() {
  console.log("Loading CSVs…");
  const techRows = loadCsv(INPUT_TECH);
  const itRows = loadCsv(INPUT_IT);

  console.log(`Technical Support Dataset: ${techRows.length} rows`);
  console.log(`IT Support Ticket Data:   ${itRows.length} rows`);

  // Prepare unified rows
  const unifiedTech = toUnifiedRowsTech(techRows);
  const unifiedIt = toUnifiedRowsIt(itRows);
  const unified = [...unifiedTech, ...unifiedIt];

  console.log(`Unified rows (pre-write): ${unified.length}`);

  // Write unified CSV
  const csv = stringify(unified, {
    header: true,
    columns: ["id", "document_id", "chunk_id", "text", "metadata"]
  });

  fs.writeFileSync(OUTPUT_UNIFIED, csv, "utf8");
  console.log(`✅ Wrote ${unified.length} rows to: ${OUTPUT_UNIFIED}`);
}

main();
