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
* Create output boxes dynamically
*
* Calculate total number of output boxes
* Raw outputs: one per output model
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
    outputModels.forEach(outputModel => {
        const rawOutputBox = document.createElement('div');
        rawOutputBox.className = 'output-box';
        rawOutputBox.textContent = `${outputModel} (Raw Output) ready`;
        
        // Store raw output info in data attributes
        rawOutputBox.dataset.outputModel = outputModel;
        rawOutputBox.dataset.isRaw = 'true';
        rawOutputBox.dataset.boxIndex = boxIndex;
        
        outputsContainer.appendChild(rawOutputBox);
        boxIndex++;
    });
    
    // Then create output boxes for each combination with metaprompt
    outputModels.forEach(outputModel => {
        promptModels.forEach(promptModel => {
            selectedStrategies.forEach(strategy => {
                const outputBox = document.createElement('div');
                outputBox.className = 'output-box';
                outputBox.textContent = `${outputModel} → ${promptModel} (${strategy}) ready`;
                
                // Store combination info in data attributes
                outputBox.dataset.outputModel = outputModel;
                outputBox.dataset.promptModel = promptModel;
                outputBox.dataset.strategy = strategy;
                outputBox.dataset.boxIndex = boxIndex;
                
                outputsContainer.appendChild(outputBox);
                boxIndex++;
            });
        });
    });
    
    randomizeOutputPositions();
}

document.addEventListener('DOMContentLoaded', function() {
    initApp();
});