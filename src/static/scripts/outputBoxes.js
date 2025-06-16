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
        
        createOutputBoxes();
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
    let boxIndex = 0;
    
    // First, create raw output boxes for each output model (without metaprompt)
    if(selectedStrategies.has('none')){
        outputModels.forEach(outputModel => {
            const rawOutputBox = document.createElement('div');
            rawOutputBox.className = 'output-box';
            
            // Generate unique key for this box
            const boxKey = generateBoxKey(outputModel, null, null, true);
            
            // Restore saved content or set default text
            const savedContent = getOutputBoxContent(boxKey);
            if (savedContent) {
                rawOutputBox.innerHTML = savedContent;
            } else {
                rawOutputBox.textContent = `${outputModel} (Raw Output) ready`;
            }
            
            // Store raw output info in data attributes
            rawOutputBox.dataset.outputModel = outputModel;
            rawOutputBox.dataset.strategy = 'none';
            rawOutputBox.dataset.boxIndex = boxIndex;
            rawOutputBox.dataset.boxKey = boxKey; // Store the key for easy access
            
            outputsContainer.appendChild(rawOutputBox);
            boxIndex++;
        });
    }
    // Then create output boxes for each combination with metaprompt
    outputModels.forEach(outputModel => {
        promptModels.forEach(promptModel => {
            selectedStrategies.forEach(strategy => {
                if (strategy !='none'){
                    const outputBox = document.createElement('div');
                    outputBox.className = 'output-box';
                    
                    // Generate unique key for this box
                    const boxKey = generateBoxKey(outputModel, promptModel, strategy, false);
                    
                    // Restore saved content or set default text
                    const savedContent = getOutputBoxContent(boxKey);
                    if (savedContent) {
                        outputBox.innerHTML = savedContent;
                    } else {
                        outputBox.textContent = `${outputModel} → ${promptModel} (${strategy}) ready`;
                    }
                    
                    // Store combination info in data attributes
                    outputBox.dataset.outputModel = outputModel;
                    outputBox.dataset.promptModel = promptModel;
                    outputBox.dataset.strategy = strategy;
                    outputBox.dataset.boxIndex = boxIndex;
                    outputBox.dataset.boxKey = boxKey; // Store the key for easy access
                    
                    outputsContainer.appendChild(outputBox);
                    boxIndex++;
                }
            });
        });
    });
    
    randomizeOutputPositions();
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

// Function to clear all output boxes content (useful for reset functionality)
function clearAllOutputBoxes() {
    const outputBoxes = document.querySelectorAll('.output-box');
    outputBoxes.forEach(box => {
        const boxKey = box.dataset.boxKey;
        if (boxKey) {
            delete outputBoxesContent[boxKey];
            
            // Reset to default text
            if (box.dataset.isRaw === 'true') {
                box.textContent = `${box.dataset.outputModel} (Raw Output) ready`;
            } else {
                box.textContent = `${box.dataset.outputModel} → ${box.dataset.promptModel} (${box.dataset.strategy}) ready`;
            }
        }
    });
    
    // Save the cleared state
    debouncedSave();
}

document.addEventListener('DOMContentLoaded', function() {
    initApp();
});