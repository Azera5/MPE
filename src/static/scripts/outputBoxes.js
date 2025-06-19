async function initApp() {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();
        MODELS = config.models;
        META_PROMPTING_MODELS_ONLY = config.meta_models;
        
        // Initialize modelSelections for all models
        // Temporary defaults - final roles not defined yet
        MODELS.forEach(model => {
            if (!modelSelections[model]) {
                modelSelections[model] = {
                    output: false,
                    prompt: false
                };
            }
        });
        
        // Check if boxes already exist in storage
        if (Object.keys(outputBoxesContent).length > 0) {
            showOutputBoxes(); // Restore existing boxes
        } else {
            createOutputBoxes(); // Create new boxes
        }
    } catch (error) {
        console.error("Failed to load config:", error);
    }
}

/** 
* Create output boxes dynamically and restore saved content
*
* Calculate total number of output boxes:
* Raw outputs: one per output model when strategy 'none' is selected
* Metaprompt outputs: outputModels * promptModels * strategies
*/
function createOutputBoxes() {
    const outputsContainer = document.getElementById('outputsContainer');
    outputsContainer.innerHTML = ''; // Clear any existing boxes

    boxIndex = 0;
    
    // Count models with output: true
    const outputModels = Object.keys(modelSelections).filter(model => 
        modelSelections[model].output === true
    );
    
    // Count models with prompt: true
    const promptModels = Object.keys(modelSelections).filter(model => 
        modelSelections[model].prompt === true
    );    
  
    // If no output models are selected, show no boxes
    if (outputModels.length === 0) {
        return;
    }
    
    // Create output boxes for each combination
    

    outputModels.forEach(outputModel => {        
        // First, create raw output boxes for each output model (without metaprompt)
        if(selectedStrategies.has('none')){
            outputsContainer.appendChild(createOutputBox(outputModel,'none'));             
        }

        // Then create output boxes for each combination with metaprompt
        promptModels.forEach(promptModel => {
            selectedStrategies.forEach(strategy => {
                if (strategy !='none'){
                    outputsContainer.appendChild(createOutputBox(outputModel,strategy, promptModel));
                }
            });
        });
    });
    updateDummyBoxes();
}

function showOutputBoxes() {
    const outputsContainer = document.getElementById('outputsContainer');
    outputsContainer.innerHTML = ''; // Clear any existing boxes
    
    Object.entries(outputBoxesContent).forEach(([boxKey, contentObj]) => {
        // Parse the boxKey to get parameters
        const [outputModel, strategy, promptModel] = boxKey.split('|');
        
        // Create the box with saved parameters
        const box = strategy === 'none'
            ? createOutputBox(outputModel, strategy)
            : createOutputBox(outputModel, strategy, promptModel);
        
            

        // Restore saved content
        if (typeof contentObj === 'object' && contentObj.content) {
            box.innerHTML =  parseMarkdown(contentObj.content);
            box.style.textAlign = 'left';
            box.classList.remove('centered')
        } else {
            // Fallback for plain text content
            box.innerHTML = contentObj;
        }
        
        // Make sure to set the boxKey for future reference
        box.dataset.boxKey = boxKey;
        outputsContainer.appendChild(box);
        
        updateDummyBoxes();
        initializeUserFeedback();
    });    
}

// Function to save output box content
function saveOutputBoxContent(boxKey, content) {
    outputBoxesContent[boxKey] = {
        content: content,
        timestamp: Date.now()
    };
    debouncedSave();
}

// Function to get output box content
function getOutputBoxContent(boxKey) {
    return outputBoxesContent[boxKey]?.content || null;
}

// Function to generate unique key for output box
function generateBoxKey(outputModel, promptModel = null, strategy = null, isRaw = false) {
    if (isRaw) {
        return `raw_${outputModel}`;
    } else {
        return `meta_${outputModel}_${promptModel}_${strategy}`;
    }
}

// Function to completely remove output boxes
function removeAllOutputBoxes() {
    const outputBoxes = document.querySelectorAll('.output-box');    
    outputBoxes.forEach(box => {
        const boxKey = box.dataset.boxKey;
        if (boxKey) {
            delete outputBoxesContent[boxKey];
            box.remove(); // This completely removes the element from DOM
        }
    });
    
    // Save the cleared state
    debouncedSave();
}

// Create a single output Box
function createOutputBox(outputModel, strategy, promptModel = 'none'){
    // Create content container
    const outputBox = document.createElement('div');
    outputBox.className = 'output-box';
   
    let boxKey;

    // Generate unique key for this box
    if(strategy == 'none') boxKey = generateBoxKey(outputModel, null, null, true);
    else boxKey = generateBoxKey(outputModel, promptModel, strategy, false );
    
    // Restore saved content or set default text
    const savedContent = getOutputBoxContent(boxKey);
    if (savedContent) {
        outputBox.innerHTML = parseMarkdown(savedContent);
        outputBox.style.display('block');
    } else {
        outputBox.classList.add('centered');
        if (strategy == 'none') outputBox.textContent = `${outputModel} (Raw Output) ready`;
        else outputBox.textContent = `${outputModel} → ${promptModel} (${strategy}) ready`;        
    }
    
    // Store output info in data attributes
    outputBox.dataset.outputModel = outputModel;
    if (promptModel != 'none') outputBox.dataset.promptModel = promptModel;
    outputBox.dataset.strategy = strategy;
    outputBox.dataset.boxIndex = boxIndex;
    outputBox.dataset.boxKey = boxKey; // Store the key for easy access

    // Add click event listener to enable the best answer button when the box is clicked
    outputBox.addEventListener('click', function() {
         // Find the Best Answer button inside this box
        const bestAnswerButton = this.querySelector('.best-answer-button');
        if (bestAnswerButton && bestAnswerButton.classList.contains('inactive')) {
            bestAnswerButton.classList.remove('inactive');
            
            // Visual feedback to show the box is selected
            this.style.boxShadow = '0 0 0 2px var(--accent-primary)';
            
            // Deactivate all other buttons in other boxes
            document.querySelectorAll('.output-box').forEach(otherBox => {
                if (otherBox !== this) {
                    const otherButton = otherBox.querySelector('.best-answer-button');
                    if (otherButton) {
                        otherButton.classList.add('inactive');
                        otherBox.style.boxShadow = 'none';
                    }
                }
            });
        }
    });

    boxIndex++;
    return outputBox;
}

async function createAnnotatedAnswerBox(query_id){
    const outputsContainer = document.getElementById('outputsContainer');
    
    const annotatedBoxExists = outputsContainer.querySelector('.output-box[data-box-key="annotated_answer"]') !== null;
    if(annotatedBoxExists) return;

    const annotatedBox = document.createElement('div');
    annotatedBox.className = 'output-box annotated-box';
    annotatedBox.dataset.boxKey = 'annotated_answer';
    annotatedBox.dataset.type = 'annotated';

    const submitButton = document.createElement('button');
    submitButton.className = 'submit-feedback-button';
    submitButton.textContent = 'Submit Feedback';
    
    
    submitButton.addEventListener('click', async function(e) {
        e.stopPropagation();
        await handleFeedbackSubmission();
        removeAllOutputBoxes();
        createOutputBoxes();
    });
    
    

    try {
        const response = await fetch('/api/get_annotated_answer', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query_id: query_id
            })
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();
        const answerText = data.annotated_answer;

        annotatedBox.textContent = answerText;
        saveOutputBoxContent('annotated_answer', answerText)
        outputsContainer.appendChild(annotatedBox);
        annotatedBox.appendChild(submitButton);
        updateDummyBoxes();

    } catch (error) {
        console.error('Error fetching annotated answer:', error);
        annotatedBox.textContent = 'Error loading answer';
    }   
}

document.addEventListener('DOMContentLoaded', function() {
    initApp();
});


// Converts basic Markdown syntax to HTML (bold, italic, code, line breaks).
function parseMarkdown(text) {
    if (typeof text !== 'string') return text;
    return text
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')               // **bold** → <b>
        .replace(/\*(.*?)\*/g, '<i>$1</i>')                   // *italic* → <i>
        .replace(/`(.*?)`/g, '<code>$1</code>')               // `code` → <code>
        .replace(/\n/g, '<br>');                              // Only <br> for line breaks
}


// Converts HTML back to original Markdown (reverse of parseMarkdown).
function htmlToMarkdown(html) {
    if (typeof html !== 'string') return html;
    return html
        .replace(/<b>(.*?)<\/b>/g, '**$1**')     // <b> → **bold**
        .replace(/<i>(.*?)<\/i>/g, '*$1*')       // <i> → *italic*
        .replace(/<code>(.*?)<\/code>/g, '`$1`')  // <code> → `code`
        .replace(/<br\s?\/?>/g, '\n');           // <br> → Newline
}