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

    outputModels.forEach(outputModel => {        
        // First, create raw output boxes for each output model (without metaprompt)
        if(selectedStrategies.has('none')){
            outputsContainer.appendChild(createOutputBox(outputModel,'none', boxIndex));
            boxIndex++; 
        }

        // Then create output boxes for each combination with metaprompt
        promptModels.forEach(promptModel => {
            selectedStrategies.forEach(strategy => {
                if (strategy !='none'){
                    outputsContainer.appendChild(createOutputBox(outputModel,strategy, promptModel, boxIndex));
                    boxIndex++;
                }
            });
        });
    });
        
    randomizeOutputPositions();
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
            box.textContent = contentObj.content;
        } else {
            // Fallback for plain text content
            box.textContent = contentObj;
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
function createOutputBox(outputModel, strategy, promptModel = 'none', boxIndex){
    // Create content container
    const outputBox = document.createElement('div');
    outputBox.className = 'output-box';

    outputBox.style.justifyContent = 'center';
    outputBox.style.alignItems = 'center';
    outputBox.style.textAlign = 'center';
    
    let boxKey;

    // Generate unique key for this box
    if(strategy == 'none') boxKey = generateBoxKey(outputModel, null, null, true);
    else boxKey = generateBoxKey(outputModel, promptModel, strategy, false );
    
    // Restore saved content or set default text
    const savedContent = getOutputBoxContent(boxKey);
    if (savedContent) {
        outputBox.innerHTML = savedContent;
    } else {
        if (strategy == 'none') outputBox.textContent = `${outputModel} (Raw Output) ready`;
        else outputBox.textContent = `${outputModel} → ${promptModel} (${strategy}) ready`;
    }
    
    // Store output info in data attributes
    outputBox.dataset.outputModel = outputModel;
    if (promptModel != 'none') outputBox.dataset.promptModel = promptModel;
    outputBox.dataset.strategy = strategy;
    outputBox.dataset.boxIndex = boxIndex;
    outputBox.dataset.boxKey = boxKey; // Store the key for easy access

    return outputBox;
}

document.addEventListener('DOMContentLoaded', function() {
    initApp();
});