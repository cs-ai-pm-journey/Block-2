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

        const results = await response.json();
        resultsContainer.innerHTML = '';

        if (results.length === 0) {
            resultsContainer.innerHTML = '<p class="text-center text-gray-500">No relevant results found. Try a different query.</p>';
        } else {
            results.forEach(result => {
                const resultCard = document.createElement('div');
                resultCard.className = 'bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-200';
                resultCard.innerHTML = `
                    <p class="font-bold text-lg mb-2">${result.content.substring(0, 100)}...</p>
                    <p class="text-sm text-gray-500">Source: ${result.source_document_name} | Similarity: ${result.similarity.toFixed(2)}</p>
                    <button class="text-blue-500 mt-2 text-sm font-semibold hover:underline">Read More</button>
                `;
                resultsContainer.appendChild(resultCard);
            });
            document.getElementById('feedback-message').classList.remove('hidden');
        }
    } catch (error) {
        resultsContainer.innerHTML = `<p class="text-center text-red-500">An error occurred: ${error.message}</p>`;
        console.error(error);
    }
});