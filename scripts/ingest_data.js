// File: scripts/ingest_data.js
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// 1. Initialize API Clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// 2. Data Chunking and Embedding Generation
async function processFile(filePath) {
  const records = [];
  const chunks = [];

  // Read CSV file
  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (data) => records.push(data))
    .on('end', async () => {
      console.log(`Processing ${records.length} records from ${filePath}...`);
      let contentColumn = null;

      if (records.length > 0) {
        // Dynamically find a suitable content column
        if (records[0].Body) {
          contentColumn = 'Body';
        } else if (records[0].text) {
          contentColumn = 'text';
        } else if (records[0].summary) {
          contentColumn = 'summary';
        }
      }

      if (!contentColumn) {
        console.log("No suitable content column found. Skipping this file.");
        return; // Skip processing this file
      }

      console.log(`Using column: '${contentColumn}' for content.`);

      for (const record of records) {
        const content = record[contentColumn];
        if (!content) continue;

        // Simple chunking logic (by paragraph)
        const paragraphs = content.split('\n\n');
        const sourceName = path.basename(filePath);

        for (const paragraph of paragraphs) {
          if (paragraph.trim().length > 0) {
            try {
              // Generate embedding for each chunk
              const embeddingResponse = await openai.embeddings.create({
                model: "text-embedding-ada-002",
                input: paragraph,
              });
              const embedding = embeddingResponse.data[0].embedding;
              
              // Store chunk with metadata
              chunks.push({
                content: paragraph,
                embedding: embedding,
                source_document_name: sourceName,
                timestamp: new Date().toISOString()
              });
              console.log(`Generated embedding for chunk: ${paragraph.substring(0, 30)}...`);
            } catch (error) {
              console.error("Error generating embedding:", error.message);
            }
          }
        }
      }

      // 3. Store in Supabase
      if (chunks.length > 0) {
        console.log(`Uploading ${chunks.length} chunks to Supabase...`);
        const { error } = await supabase.from('documents').insert(chunks);

        if (error) {
          console.error("Error uploading to Supabase:", error.message);
        } else {
          console.log("Data successfully ingested!");
        }
      } else {
        console.log("No chunks to upload. Check your data.");
      }
    });
}

// Call the function for your data files
processFile(path.join(__dirname, '../data/support_tickets_1.csv'));
processFile(path.join(__dirname, '../data/customer_complaints_2.csv'));
