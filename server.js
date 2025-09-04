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

// Set a relevance threshold. This is the key change.
// You'll need to tune this value based on your data and desired accuracy.
// A value between 0.7 and 0.8 is often a good starting point for OpenAI embeddings.
const RELEVANCE_THRESHOLD = 0.75;

// Endpoint for logging search events
app.post('/log', async (req, res) => {
    try {
        const { query, answer, documents, feedback } = req.body;
        const logData = {
            query,
            answer,
            documents: documents.map(doc => ({
                source_document_name: doc.source_document_name,
                similarity: doc.similarity
            })),
            feedback,
            timestamp: new Date().toISOString()
        };
        
        // In a real application, you would log this to a database or a file.
        // For this demo, we'll just log to the console.
        console.log("Search Logged:", JSON.stringify(logData, null, 2));
        
        // Here you would add the code to insert into your 'search_logs' table in Supabase
        // const { data, error } = await supabase.from('search_logs').insert([logData]);
        
        res.status(200).json({ status: 'Logged successfully' });
    } catch (error) {
        console.error("Logging Error:", error.message);
        res.status(500).json({ error: 'An unexpected error occurred during logging.' });
    }
});

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
    // The match_count is now set higher (e.g., 10) to give us a pool of candidates to filter.
    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_count: 10
    });

    if (error) {
      console.error("Supabase RPC Error:", error.message);
      throw new Error('Database search failed.');
    }
    
    // ----------------------------------------------------
    // THE CRITICAL NEW LOGIC: Filter out irrelevant documents
    // This is where you solve the dog-walking problem.
    // ----------------------------------------------------
    const relevantDocuments = data.filter(doc => doc.similarity > RELEVANCE_THRESHOLD);

    // 3. Check if any relevant documents were found after filtering
    if (relevantDocuments.length === 0) {
      // If no relevant documents are found, return a clean response with no documents.
      return res.json({ response: "I'm sorry, I could not find any relevant information in the documents to answer your question.", documents: [] });
    }

    // 4. Create a summarization prompt with the relevant context
    // The context is now built only from the documents that passed the relevance filter.
    const context = relevantDocuments.map(d => d.content).join("\n\n---\n\n");
    const prompt = `You are a helpful customer support agent.
    
    Using only the following documents, answer the user's question. If the answer cannot be found in the documents, truthfully say that you don't know.
    
    Documents:
    ${context}
    
    Question: ${query}`;

    // 5. Call a large language model to generate the summary
    const chatCompletion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'gpt-3.5-turbo',
    });

    const finalAnswer = chatCompletion.choices[0].message.content;

    // Return the final answer and only the relevant documents
    res.json({ response: finalAnswer, documents: relevantDocuments });
    
  } catch (error) {
    console.error("API Error:", error.message);
    res.status(500).json({ error: 'An unexpected error occurred.' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});