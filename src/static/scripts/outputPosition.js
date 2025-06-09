document.addEventListener('DOMContentLoaded', function() {
    updateDummyBoxes();
    // Update dummy boxes on window resize
    window.addEventListener('resize', updateDummyBoxes);
});

// Function to update dummy boxes (now accessible globally)
function updateDummyBoxes() {
    const outputsContainer = document.getElementById('outputsContainer');
    if (!outputsContainer) return;
    
    document.querySelectorAll('.dummy-box').forEach(d => d.remove());
    
    const containerWidth = outputsContainer.clientWidth;
    const boxWidth = 420;
    const gap = 20;        

    const boxesPerRow = Math.max(1, Math.floor((containerWidth + gap) / (boxWidth + gap)));
    
    const visibleBoxes = outputsContainer.querySelectorAll('.output-box').length;
    if (visibleBoxes > boxesPerRow) {
        const remainder = visibleBoxes % boxesPerRow;
        if (remainder > 0) {
            const dummyCount = boxesPerRow - remainder;
            for (let i = 0; i < dummyCount; i++) {
                const dummy = document.createElement('div');
                dummy.className = 'dummy-box';
                outputsContainer.appendChild(dummy);
            }
        }
    }
}

function randomizeOutputPositions() {
    const container = document.getElementById('outputsContainer');
    const boxes = Array.from(container.getElementsByClassName('output-box'));
    
    // Random box shuffling
    for (let i = boxes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        container.appendChild(boxes[j]);
        boxes.splice(j, 1);
    }
    if (boxes.length > 0) {
        container.appendChild(boxes[0]);
    }

    updateDummyBoxes();
}