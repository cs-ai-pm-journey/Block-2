// File: public/app.js
document.getElementById('search-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = document.getElementById('query-input').value;
    const resultsContainer = document.getElementById('results-container');
    resultsContainer.innerHTML = '<p class="text-center text-gray-500">Searching...</p>';
    document.getElementById('feedback-message').classList.add('hidden');

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

        // Check if a response was generated
        if (data.response) {
            const answerCard = document.createElement('div');
            answerCard.className = 'bg-gray-50 p-6 rounded-lg shadow-sm border border-gray-200 mb-6';
            answerCard.innerHTML = `<p class="font-bold text-lg mb-2">Answer:</p><p class="text-gray-800">${data.response}</p>`;
            resultsContainer.appendChild(answerCard);

            const documentsList = document.createElement('div');
            documentsList.innerHTML = `<p class="font-bold text-lg mb-2">Sources (Top 5):</p>`;
            
            if (data.documents && data.documents.length > 0) {
                data.documents.forEach(doc => {
                    const docCard = document.createElement('div');
                    docCard.className = 'bg-gray-100 p-4 rounded-lg shadow-sm border border-gray-200 mb-2';
                    docCard.innerHTML = `
                        <p class="font-semibold text-gray-800">${doc.content.substring(0, 100)}...</p>
                        <p class="text-sm text-gray-500">Source: ${doc.source_document_name} | Similarity: ${doc.similarity.toFixed(2)}</p>
                    `;
                    documentsList.appendChild(docCard);
                });
                resultsContainer.appendChild(documentsList);
            }
            
            document.getElementById('feedback-message').classList.remove('hidden');
        } else {
            resultsContainer.innerHTML = `<p class="text-center text-gray-500">No relevant results found. Try a different query.</p>`;
        }
    } catch (error) {
        resultsContainer.innerHTML = `<p class="text-center text-red-500">An error occurred: ${error.message}</p>`;
        console.error(error);
    }
});
