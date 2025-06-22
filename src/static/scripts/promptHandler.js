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
    //console.log(`called with: ${prompt}, ${strategy}, ${model} }`);

    let metaPromptArgs;

    switch (strategy) {
        case 'S-Template':
            console.log(`@applyMetaPrompt : S-Template`);
            metaPromptArgs = useBasicTemplate(prompt);
            break;
        case 'A-Template':
            console.log(`@applyMetaPrompt : A-Template`);
            metaPromptArgs = adaptBasicTemplate(prompt);
            break;
        case 'auto-PE':
            console.log(`@applyMetaPrompt : auto-PE`);
            metaPromptArgs = useAutoPE(prompt);
            break;
        case 'Rephrasing':
            console.log(`@applyMetaPrompt : Rephrasing`);
            metaPromptArgs = useRephrasing(prompt);
            break;
    }

    // non-reference strategy return
    return await sendPromptToModel(metaPromptArgs.metaPrompt.trim(), model, metaPromptArgs.systemPrompt.trim());
}


// non-functional atm (CORS error)
async function queryDBpedia(queryInSPARQL) {
    console.log(`queryDBpedia called with: ${queryInSPARQL}}`);
    const endpointUrl = 'https://dbpedia.org/sparql';
    const queryUrl = `${endpointUrl}?query=${encodeURIComponent(queryInSPARQL)}&format=json`;

    try {
        const response = await fetch(queryUrl, {
            headers: {
                'Accept': 'application/sparql-results+json'
            }
        });
        const data = await response.json();
        console.log(data.results.bindings);

        return data;

    } catch (error) {
        console.error('query error:', error);
    }
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
                let appliedStrategyResult;
                let outputModel = box.dataset.outputModel;
                let referenceArgs;
                let queryInSPARQL;

                const promptModel = box.dataset.promptModel;
                const strategy = box.dataset.strategy;
                
                
                if (box.dataset.strategy == 'none') { 
                    // Raw output                    
                    response = await sendPromptToModel(prompt, outputModel);
                } else {


                    switch (strategy) {
                        case 'L-Reference':
                            console.log(`@queryDistribution : L-Reference`);
                            referenceArgs = useLReferenceIN(prompt);
                            queryInSPARQL = await sendPromptToModel(referenceArgs.metaPrompt.trim(), promptModel, referenceArgs.systemPrompt.trim());
                            queryDBpedia(queryInSPARQL);    // does not work atm (CORS error)
                            response = queryInSPARQL;       // the SPARQL-query is the fallback answer, as long as the querying of dbpedia doesn't work
                            
                            //todo: translate answer from dbpedia to natural language
                            //referenceArgs = useLReferenceOUT(queryDBpedia(queryInSPARQL));
                            //response = await sendPromptToModel(referenceArgs.metaPrompt.trim(), outputModel, referenceArgs.systemPrompt.trim());
                            break;
                        case 'C-Reference':
                            console.log(`@queryDistribution : C-Reference`);
                            // at the begeinning just like the 'none'-variant
                            response = await sendPromptToModel(prompt, outputModel);
                            // but with an additional proofread-layer extra
                            referenceArgs = useCReference(prompt, response);
                            response = await sendPromptToModel(referenceArgs.metaPrompt.trim(), promptModel, referenceArgs.systemPrompt.trim());
                            break;
                        default:
                            console.log(`@queryDistribution : default-case promptHandler`);
                            // regular Meta-prompted output           
                            appliedStrategyResult = await applyMetaPrompt(prompt, strategy, promptModel);
                            response = await sendPromptToModel(appliedStrategyResult, outputModel);
                    }
           
                    // Save data for metaprompt
                    metaPromptsData.push({
                        user: currentUser,
                        question_text: prompt,
                        strategy_name: strategy,
                        metaPrompt: appliedStrategyResult,
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