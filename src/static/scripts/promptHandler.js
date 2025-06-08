// Function to handle sending prompt to backend for a specific model
async function sendPromptToModel(prompt, model) {
    try {
        const response = await fetch('/api/prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt: prompt, model: model })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.response;
    } catch (error) {
        console.error(`Error sending prompt to model ${model}:`, error);
        return `Error: ${error.message}`;
    }
}

// Function to handle user input
async function queryDistribution() {
    const userInput = document.getElementById('userInput');
    const outputsContainer = document.getElementById('outputsContainer');

    userInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            const prompt = userInput.value.trim();
            if (prompt) {
                // Get all output boxes (excluding dummy boxes)
                const outputBoxes = Array.from(outputsContainer.querySelectorAll('.output-box:not(.dummy-box)'));
                
                // Display loading state
                outputBoxes.forEach(box => {
                    box.innerHTML = '<div class="loading-spinner"></div>';
                    box.style.opacity = '0.8';
                });
                
                // Filter out META_PROMPTING_MODELS_ONLY from MODELS
                const activeModels = MODELS.filter(model => !META_PROMPTING_MODELS_ONLY.includes(model));
                
                try {
                    // Collect all responses before displaying anything
                    const responses = [];
                    
                    for (const model of activeModels) {
                        const response = await sendPromptToModel(prompt, model);
                        responses.push(response);
                    }
                    
                    // Show all results at once
                    showResults(responses, outputBoxes);
                } catch (error) {
                    console.error('Error processing models:', error);
                    outputBoxes.forEach(box => {
                        box.innerHTML = `<p>Error: ${error.message}</p>`;
                        box.style.opacity = '1';
                    });
                }
            }
        }
    });
}

function showResults(responses, outputBoxes) {
    // Update all boxes in a single operation
    outputBoxes.forEach((box, index) => {
        box.textContent = responses[index] || 'No response received';
        box.style.opacity = '1';
    });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', queryDistribution);