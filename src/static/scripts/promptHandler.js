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

// Dummy function for meta-prompting (to be expanded later)
async function applyMetaPrompt(prompt, strategy, model) {
    // For now, just return the original prompt
    // This will be expanded later to actually apply meta-prompting strategies
    console.log('applyMetaPrompt called with:', { prompt, strategy, model });
    return {
            metaPrompt: prompt,
            strategyId: parseInt(strategy), // Strategy ID for backend
            modelId: parseInt(model) // Model ID for backend
        };
}

// Function to handle user input
async function queryDistribution() {
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');
    const outputsContainer = document.getElementById('outputsContainer');
    
    // Common function to process the prompt
    async function processPrompt() {
        const prompt = userInput.value.trim();
        if (!prompt) return;
        
        // Get all output boxes (excluding dummy boxes)
        const outputBoxes = Array.from(outputsContainer.querySelectorAll('.output-box:not(.dummy-box)'));
        
        // Display loading state
        outputBoxes.forEach(box => {
            box.innerHTML = '<div class="loading-spinner"></div>';
            // box.style.opacity = '0.8';
            
            const boxKey = box.dataset.boxKey;
            if (boxKey) {
                saveOutputBoxContent(boxKey, '<div class="loading-spinner"></div>');
            }
            
        });
        
        try {
            // Collect all responses before displaying anything
            const answersData = [];
            const metaPromptsData = [];
            const responses = [];
            
            for (const box of outputBoxes) {
                let response;
                let metaPromptResult;
                let outputModel = box.dataset.outputModel;
                
                
                if (box.dataset.isRaw === 'true') { 
                    // Raw output                    
                    response = await sendPromptToModel(prompt, outputModel);
                } else {
                    // Meta-prompted output                    
                    const promptModel = box.dataset.promptModel;
                    const strategy = box.dataset.strategy;
                    
                    metaPromptResult = await applyMetaPrompt(prompt, strategy, promptModel);
                    response = await sendPromptToModel(metaPromptResult.metaPrompt, outputModel);
                    
                    // Save data for metaprompt
                    metaPromptsData.push({
                        user: currentUser,
                        question_text: prompt,
                        strategy_name: strategy,
                        metaPrompt: metaPromptResult.metaPrompt,
                        model: promptModel,
                        answer_text: response
                    });
                }                
                
                responses.push(response);
                
                answersData.push({
                    user: currentUser,
                    question_text: prompt,
                    answer: response,
                    model: outputModel,
                    position: 0, // Not implemented yet
                    score: 0.0 // Not implemented yet
                });

            
            }
            
            showResults(responses, outputBoxes);

            const insertQueryData = {
                user: currentUser,
                question_text: prompt
            };

            const backendResponse_insert_query = await fetch('/insert_query', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(insertQueryData)
            });

            const result_backendResponse_insert_query = await backendResponse_insert_query.json();
            console.log(result_backendResponse_insert_query);
            
            const backendResponse_insert_answer = await fetch('/insert_answer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    answers: answersData                    
                })
            });
            
            const result_backendResponse_insert_answer = await backendResponse_insert_answer.json();
            if (!backendResponse_insert_answer.ok) {
                console.error('Backend error:', result_backendResponse_insert_answer);
            } else {
                console.log('Interaction saved:', result_backendResponse_insert_answer);
            }

            const backendResponse_insert_metaPrompt = await fetch('/insert_metaprompt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(metaPromptsData)
            });

            const result_backendResponse_insert_metaPrompt = await backendResponse_insert_metaPrompt.json();
            if (!backendResponse_insert_metaPrompt.ok) {
                console.error('Backend error:', result_backendResponse_insert_metaPrompt);
            } else {
                console.log('Interaction saved:', result_backendResponse_insert_metaPrompt);
            }
            
        } catch (error) {
            console.error('Error processing models:', error);
            outputBoxes.forEach(box => {
                const errorContent = `<p>Error: ${error.message}</p>`;
                box.innerHTML = errorContent;
                box.style.opacity = '1';
                
                // Save error content to localStorage
                const boxKey = box.dataset.boxKey;
                if (boxKey) {
                    saveOutputBoxContent(boxKey, errorContent);
                }
            });
        }
    }
    
    // Handle Enter key in input field
    userInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            await processPrompt();
        }
    });
    
    // Handle Send button click
    sendButton.addEventListener('click', async () => {
        await processPrompt();
    });
}

function showResults(responses, outputBoxes) {
    // Update all boxes in a single operation and save to localStorage
    outputBoxes.forEach((box, index) => {
        const responseContent = responses[index] || 'No response received';
        box.textContent = responseContent;
        box.style.opacity = '1';
        
        // Save content to localStorage
        const boxKey = box.dataset.boxKey;
        if (boxKey) {
            saveOutputBoxContent(boxKey, responseContent);
        }
    });
}

// Initialize the function when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    queryDistribution();
});