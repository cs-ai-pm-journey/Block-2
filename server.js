// File: server.js
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize API Clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Search Endpoint with Summarization
app.post('/search', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required.' });
    }

    // 1. Embed the user's query
    const queryEmbeddingResponse = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: query,
    });
    const queryEmbedding = queryEmbeddingResponse.data[0].embedding;

    // 2. Perform similarity search using pgvector
    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_count: 5 // Retrieve top 5 matches
    });

    if (error) {
      console.error("Supabase RPC Error:", error.message);
      throw new Error('Database search failed.');
    }

    if (data.length === 0) {
      return res.json({ response: "I'm sorry, I could not find any relevant information in the documents to answer your question." });
    }

    // 3. Create a summarization prompt with retrieved context
    const context = data.map(d => d.content).join("\n\n---\n\n");
    const prompt = `You are a helpful customer support agent.
    
    Using only the following documents, answer the user's question. If the answer cannot be found in the documents, truthfully say that you don't know.
    
    Documents:
    ${context}
    
    Question: ${query}`;

    // 4. Call a large language model to generate the summary
    const chatCompletion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'gpt-3.5-turbo',
    });

    const finalAnswer = chatCompletion.choices[0].message.content;

    res.json({ response: finalAnswer, documents: data });
  } catch (error) {
    console.error("API Error:", error.message);
    res.status(500).json({ error: 'An unexpected error occurred.' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
