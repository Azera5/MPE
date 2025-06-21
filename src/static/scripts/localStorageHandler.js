// LocalStorage helper functions for persistence
function saveStateToLocalStorage() {
    const stateData = {
        modelSelections: modelSelections,
        selectedStrategies: Array.from(selectedStrategies),
        outputBoxesContent: outputBoxesContent,
        currentUser: currentUser,
        questionCounters: questionCounters,
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
            if (data.questionCounters) {
                questionCounters = data.questionCounters;
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

function getUserQuestionCount(questionText) {
    if (!questionCounters[questionText] || !currentUser) return 0;
    
    const userEntry = questionCounters[questionText].find(
        entry => entry.user === currentUser
    );
    return userEntry ? userEntry.count : 0;
}

function incrementUserQuestionCount(questionText) {
    if (!questionText || !currentUser) return false;
    const entries = questionCounters[questionText] = questionCounters[questionText] || [];
    const entry = entries.find(e => e.user === currentUser);
    entry ? entry.count++ : entries.push({user: currentUser, count: 1});
    return true;
}