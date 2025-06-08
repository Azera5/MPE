let MODELS = [];
let META_PROMPTING_MODELS_ONLY = [];

async function initApp() {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();
        MODELS = config.models;
        META_PROMPTING_MODELS_ONLY = config.meta_models;
        
        createOutputBoxes();
    } catch (error) {
        console.error("Failed to load config:", error);
    }
}

// Create output boxes dynamically based on active models count
function createOutputBoxes() {
    const outputsContainer = document.getElementById('outputsContainer');
    outputsContainer.innerHTML = ''; // Clear any existing boxes
    
    const activeModels = MODELS.filter(model => !META_PROMPTING_MODELS_ONLY.includes(model));

    activeModels.forEach((model, index) => {
        const outputBox = document.createElement('div');
        outputBox.className = 'output-box';
        outputBox.textContent = `Model ${index+1} ready`;
        outputBox.dataset.model = model; // Store model info in data attribute (hidden from user)
        outputsContainer.appendChild(outputBox);
    });
    
    randomizeOutputPositions()
}


document.addEventListener('DOMContentLoaded', function() {
    initApp();
    createOutputBoxes();
});