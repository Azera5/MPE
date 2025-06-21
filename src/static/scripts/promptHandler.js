// Function to handle sending prompt to backend for a specific model
async function sendPromptToModel(prompt, model, systemPrompt = '') {
    try {
        const response = await fetch('/api/prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt: prompt, model: model, systemPrompt: systemPrompt})
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
    console.log(`queryDistribution called with: ${prompt}, ${strategy}, ${model} }`);

    const generalSystemPrompt = `
    You are a specialized prompt engineer with extensive expertise in effective communication. Your task is to revise input prompts to ensure they:
        1. Activate deeper cognitive processes.
        2. Uncover potential reasoning errors.
        3. Clearly interpret and understand the presented question.
    Work methodically and always preserve the prompt's structure as a question under any circumstances.
    `;

    // 'Templates', 'auto-PE', 'Rephrasing', 'L-Reference', 'C-Reference'
    switch (strategy) {
        case 'S-Template':
        return await sendPromptToModel(useBasicTemplate(prompt).metaPrompt.trim() ,model, useBasicTemplate(prompt).systemPrompt.trim());
        case 'A-Template':
            return await sendPromptToModel(adaptBasicTemplate(prompt).metaPrompt.trim(), model);
        case 'auto-PE':
            return await sendPromptToModel(useAutoPE(prompt).metaPrompt.trim(), model);
        case 'Rephrasing':
            return await sendPromptToModel(seRephrasing(prompt).metaPrompt.trim(), model);
        case 'L-Reference':
            return prompt; // todo
        case 'C-Reference':
            return prompt; // todo
        default:
            return prompt; // todo
    }

        // return {
        //     metaPrompt: prompt,
        //     strategyId: parseInt(strategy), // Strategy ID for backend
        //     modelId: parseInt(model) // Model ID for backend
        // };
    // metaPromptResult.metaPrompt
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
        let outputBoxes = Array.from(outputsContainer.querySelectorAll('.output-box:not(.dummy-box)'));
        
        // Display loading state
        outputBoxes.forEach(box => {
            box.innerHTML = '<div class="loading-spinner"></div>';
            // box.style.opacity = '0.8';
            
            const boxKey = box.dataset.boxKey;
            if (boxKey) {
                saveOutputBoxContent(boxKey, '<div class="loading-spinner"></div>');
            }
            
        });

        randomizeOutputPositions();
        outputBoxes = Array.from(outputsContainer.querySelectorAll('.output-box:not(.dummy-box)'));
        
        try {
            // Collect all responses before displaying anything
            const answersData = [];
            const metaPromptsData = [];
            const responses = [];
            
            for (const [index, box] of outputBoxes.entries()) {
                let response;
                let metaPromptResult;
                let outputModel = box.dataset.outputModel;

                const promptModel = box.dataset.promptModel;
                const strategy = box.dataset.strategy;
                
                
                if (box.dataset.strategy == 'none') { 
                    // Raw output                    
                    response = await sendPromptToModel(prompt, outputModel);
                } else {

                    // Meta-prompted output
                   
                    metaPromptResult = await applyMetaPrompt(prompt, strategy, promptModel);
                    response = await sendPromptToModel(metaPromptResult, outputModel);
                    
                    // Save data for metaprompt
                    metaPromptsData.push({
                        user: currentUser,
                        question_text: prompt,
                        strategy_name: strategy,
                        metaPrompt: metaPromptResult,
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
                    strategy: strategy,
                    position: index,
                    score: 0.0 // Not implemented yet
                });

            
            }
            
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
                // Stores answer IDs for outputs generated without metaprompting (local storage)
                result_backendResponse_insert_answer.results.forEach(answerInfo => {
                    let boxKey;
                     
                    if (answerInfo.strategy === 'none') {
                        boxKey = generateBoxKey(answerInfo.model, null, null, true)
                    }
                    if (boxKey) {
                    saveOutputBoxContent(boxKey, ' ');
                    
                    outputBoxesContent[boxKey].answer_id = answerInfo.answer_id;
                    outputBoxesContent[boxKey].query_id = answerInfo.query_id;                    
                    }
                });
                console.log('Interaction saved:', result_backendResponse_insert_answer);
            }

            if (metaPromptsData && metaPromptsData.length > 0) {
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
                     // Stores answer IDs for outputs generated with metaprompting (local storage)
                    result_backendResponse_insert_metaPrompt.results.forEach(answerInfo => {
                    let boxKey;
                    
                    if (answerInfo.strategy !== 'none') {
                        boxKey = generateBoxKey(answerInfo.outputModel, answerInfo.promptModel, answerInfo.strategy, false);
                    }                    
                        if (boxKey) {
                        saveOutputBoxContent(boxKey, '');                                            
                        
                        // Only store answer_id and query_id in the existing structure
                        outputBoxesContent[boxKey].answer_id = answerInfo.answer_id;
                        outputBoxesContent[boxKey].query_id = answerInfo.query_id;
                        outputBoxesContent[boxKey].metaPrompt_id = answerInfo.metaPrompt_id;                        
                    }
                });
                    console.log('Interaction saved:', result_backendResponse_insert_metaPrompt);
                }
            }

            showResults(responses, outputBoxes);
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
        box.removeAttribute('style');
        const responseContent = responses[index] || 'No response received';
        box.innerHTML = parseMarkdown(responseContent);
        box.style.opacity = '1';
        box.classList.remove('centered');
        
        // Save content to localStorage
        const boxKey = box.dataset.boxKey;
        if (boxKey) {
            saveOutputBoxContent(boxKey, responseContent);
        }
    });

    initializeUserFeedback();
}

// Initialize the function when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    queryDistribution();
});