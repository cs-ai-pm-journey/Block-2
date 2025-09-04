// File: public/app.js
document.getElementById('search-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const queryInput = document.getElementById('query-input');
    const query = queryInput.value;
    const resultsContainer = document.getElementById('results-container');
    const feedbackMessage = document.getElementById('feedback-message');
    
    // Reset state for a new search
    resultsContainer.innerHTML = '<p class="text-center text-gray-500">Searching...</p>';
    feedbackMessage.innerHTML = 'Was this helpful? <span id="thumbs-up" class="cursor-pointer text-green-500 hover:text-green-700 transition-colors duration-200">👍</span> / <span id="thumbs-down" class="cursor-pointer text-red-500 hover:text-red-700 transition-colors duration-200">👎</span>';
    feedbackMessage.classList.add('hidden');
    
    if (!query.trim()) {
      resultsContainer.innerHTML = `<p class="text-center text-gray-500">Please enter a question.</p>`;
      return;
    }

    try {
        const response = await fetch('/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query })
        });

        if (!response.ok) {
            throw new Error('API request failed.');
        }

        const data = await response.json();
        resultsContainer.innerHTML = '';

        if (data.documents && data.documents.length > 0) {
            
            const totalSimilarity = data.documents.reduce((sum, doc) => sum + doc.similarity, 0);
            const averageSimilarity = totalSimilarity / data.documents.length;
            
            let confidenceMessage = '';
            let confidenceColor = '';

            if (averageSimilarity >= 0.85) {
                confidenceMessage = 'Highly relevant results found.';
                confidenceColor = 'text-green-600';
            } else if (averageSimilarity >= 0.65) {
                confidenceMessage = 'Relevant results found.';
                confidenceColor = 'text-yellow-600';
            } else {
                confidenceMessage = 'Some relevant results found. Use with caution.';
                confidenceColor = 'text-red-600';
            }

            const confidenceBanner = document.createElement('div');
            confidenceBanner.className = `text-center font-semibold mb-4 ${confidenceColor}`;
            confidenceBanner.textContent = confidenceMessage;
            resultsContainer.appendChild(confidenceBanner);

            const answerCard = document.createElement('div');
            answerCard.className = 'bg-gray-50 p-6 rounded-lg shadow-sm border border-gray-200 mb-6';
            
            const answerText = data.response ? data.response : "I'm sorry, I couldn't generate an answer from the provided documents. Please check the sources below.";
            answerCard.innerHTML = `<p class="font-bold text-lg mb-2">Answer:</p><p class="text-gray-800">${answerText}</p>`;
            resultsContainer.appendChild(answerCard);

            const documentsList = document.createElement('div');
            documentsList.innerHTML = `<p class="font-bold text-lg mb-2">Sources (Top ${data.documents.length}):</p>`;
            
            data.documents.forEach((doc) => {
                const docCard = document.createElement('div');
                docCard.className = 'bg-gray-100 p-4 rounded-lg shadow-sm border border-gray-200 mb-2 cursor-pointer';
                
                docCard.innerHTML = `
                    <p class="font-semibold text-gray-800">${doc.content.substring(0, 100)}...</p>
                    <div class="flex items-center justify-between text-sm text-gray-500 mt-2">
                        <span>Source: ${doc.source_document_name}</span>
                        <span class="font-bold text-blue-600">Relevance: ${doc.similarity.toFixed(2)}</span>
                    </div>
                `;
                
                const previewSection = document.createElement('div');
                previewSection.className = 'bg-white p-4 rounded-lg mt-4 hidden';
                previewSection.innerHTML = `<p class="text-gray-800">${doc.content}</p>`;

                docCard.addEventListener('click', () => {
                    previewSection.classList.toggle('hidden');
                });
                
                documentsList.appendChild(docCard);
                documentsList.appendChild(previewSection);
            });
            
            resultsContainer.appendChild(documentsList);
            
            feedbackMessage.classList.remove('hidden');

            const sendFeedback = (feedback) => {
                // Bug fix: The body must match the server's expected format.
                // The documents are the full objects, not just an array of names.
                fetch('/log', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        query: query, 
                        answer: data.response,
                        documents: data.documents,
                        feedback: feedback
                    })
                });
                feedbackMessage.innerHTML = 'Thanks for your feedback!';
            };

            // Bug fix: The event listeners must be attached AFTER the elements are available in the DOM.
            document.getElementById('thumbs-up').addEventListener('click', () => sendFeedback('helpful'));
            document.getElementById('thumbs-down').addEventListener('click', () => sendFeedback('not_helpful'));

        } else {
            resultsContainer.innerHTML = `<p class="text-center text-gray-500">No relevant results found. Try a different query.</p>`;

            fetch('/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    query: query, 
                    answer: data.response,
                    documents: [],
                    feedback: 'not_applicable'
                })
            });
        }
    } catch (error) {
        resultsContainer.innerHTML = `<p class="text-center text-red-500">An error occurred: ${error.message}</p>`;
        console.error(error);
    }
});