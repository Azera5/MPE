let customInput = false;

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
            const responses = [];
            
            for (const [index, box] of outputBoxes.entries()) {
                let response;
                let boxKey;
                let appliedStrategyResult;
                let outputModel = box.dataset.outputModel;
                let referenceArgs;
                let queryInSPARQL;

                const promptModel = box.dataset.promptModel;
                const strategy = box.dataset.strategy;

                if(promptModel){
                    boxKey = generateBoxKey(outputModel, promptModel, strategy, false);
                } else boxKey = generateBoxKey(outputModel, null, null, true);

                box.dataset.boxKey = boxKey;
                saveOutputBoxContent(boxKey, ' ');

                console.log(boxKey);
                
                // Prepare answer data structure
                const answerData = {
                    user: currentUser,                    
                    answer: '', // will be set later
                    model: outputModel,
                    strategy: strategy,
                    position: index,
                    metaprompt_data: null 
                };
                
                if (box.dataset.strategy == 'none') { 
                    // Raw output                    
                    response = await sendPromptToModel(prompt, outputModel);
                } else {
                    let metaPromptText = '';

                    switch (strategy) {
                        case 'L-Reference':
                            console.log(`@queryDistribution : L-Reference`);
                            referenceArgs = useLReferenceIN(prompt);
                            queryInSPARQL = await sendPromptToModel(referenceArgs.metaPrompt.trim(), promptModel, referenceArgs.systemPrompt.trim());
                            queryDBpedia(queryInSPARQL);    // does not work atm (CORS error)
                            response = queryInSPARQL;       // the SPARQL-query is the fallback answer, as long as the querying of dbpedia doesn't work
                            metaPromptText = referenceArgs.metaPrompt.trim();
                            
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
                            metaPromptText = referenceArgs.metaPrompt.trim();
                            break;
                        default:
                            console.log(`@queryDistribution : default-case promptHandler`);
                            // regular Meta-prompted output           
                            appliedStrategyResult = await applyMetaPrompt(prompt, strategy, promptModel);
                            response = await sendPromptToModel(appliedStrategyResult, outputModel);
                            metaPromptText = appliedStrategyResult;
                    }
           
                    // Set metaprompt data for strategies other than 'none'
                    answerData.metaprompt_data = {
                        strategy_name: strategy,
                        metaPrompt: metaPromptText,
                        prompt_model: promptModel
                    };
                }
                
                // Set the actual response
                answerData.answer = response;
                responses.push(response);
                answersData.push(answerData);
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

            const status = backendResponse_insert_query.status;
            const result_backendResponse_insert_query = await backendResponse_insert_query.json();
            const query_id = result_backendResponse_insert_query.query_id;           
            
            customInput = status === 200 ? true : false;
            
            // Only stores data in database when using predefined prompts
            if(!customInput){
                // Integrated call - answers and metaprompts are created together
                const backendResponse_insert_answer = await fetch('/insert_answer', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        answers: answersData.map(answer => ({
                            ...answer,
                            query_id: query_id
                        }))                    
                    })
                });
                
                const result_backendResponse_insert_answer = await backendResponse_insert_answer.json();
                if (!backendResponse_insert_answer.ok) {
                    console.error('Backend error:', result_backendResponse_insert_answer);
                } else{
                    // Store answer IDs and metaprompt IDs for all outputs (local storage)
                    result_backendResponse_insert_answer.results.forEach(answerInfo => {
                        let boxKey;
                        
                        if (answerInfo.strategy === 'none') {
                            boxKey = generateBoxKey(answerInfo.model, null, null, true);
                        } else {
                            boxKey = generateBoxKey(answerInfo.model, answerInfo.prompt_model, answerInfo.strategy, false);
                        }
                        
                        if (boxKey) {
                            outputBoxesContent[boxKey].answer_id = answerInfo.answer_id;
                            outputBoxesContent[boxKey].query_id = answerInfo.query_id;
                            if (answerInfo.metaprompt_id) {
                                outputBoxesContent[boxKey].metaprompt_id = answerInfo.metaprompt_id;
                            }
                        }
                    });                
                }
            }

            incrementUserQuestionCount(prompt);
            populateDropdown();
            showResults(responses, outputBoxes);
        } catch (error) {
            console.error('Error processing models:', error);
            outputBoxes.forEach(box => {
                const errorContent = `<p>Error: ${error.message}</p>`;
                box.innerHTML = errorContent;
                
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
            if (currentUser === 'User') {
                openUserPopup();
                return;
            }
            await processPrompt();
        }
    });
    
    // Handle Send button click
    sendButton.addEventListener('click', async () => {
        if (currentUser === 'User') {
            openUserPopup();
            return;
        }
        await processPrompt();
    });
}

function showResults(responses, outputBoxes) {
    // Update all boxes in a single operation and save to localStorage
    outputBoxes.forEach((box, index) => {
        box.removeAttribute('style');
        const responseContent = responses[index] || 'No response received';
        box.innerHTML = parseMarkdown(responseContent);
        // box.style.opacity = '1';
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