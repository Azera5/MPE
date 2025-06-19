// LocalStorage helper functions for persistence
function saveStateToLocalStorage() {
    const stateData = {
        modelSelections: modelSelections,
        selectedStrategies: Array.from(selectedStrategies),
        outputBoxesContent: outputBoxesContent,
        currentUser: currentUser,
        timestamp: Date.now()
    };
    
    try {
        localStorage.setItem('appState', JSON.stringify(stateData));
        console.log('State saved to localStorage');
    } catch (error) {
        console.error('Error saving to localStorage:', error);
    }
}

function loadStateFromLocalStorage() {
    try {
        const savedState = localStorage.getItem('appState');
        if (savedState) {
            const data = JSON.parse(savedState);
            
            if (data.modelSelections) {
                modelSelections = data.modelSelections;
            }
            if (data.selectedStrategies) {
                selectedStrategies = new Set(data.selectedStrategies);
            }
            if (data.outputBoxesContent) {
                outputBoxesContent = data.outputBoxesContent;
            }
            if (data.currentUser) {
                currentUser = data.currentUser;
            }
            
            console.log('State loaded from localStorage');
            return Promise.resolve(data);
        }
    } catch (error) {
        console.error('Error loading from localStorage:', error);
    }
    return Promise.resolve({});
}

function clearLocalStorage() {
    localStorage.removeItem('appState');
    outputBoxesContent = {};
    console.log('State cleared from localStorage');
}

// Auto-save with debouncing (prevents saving too often)
let saveTimeout;
function debouncedSave() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveStateToLocalStorage, 500);
}