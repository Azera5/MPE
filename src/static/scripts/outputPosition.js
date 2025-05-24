document.addEventListener('DOMContentLoaded', function() {
    const container = document.getElementById('outputsContainer');
    const boxes = Array.from(container.getElementsByClassName('output-box'));

    const updateDummyBoxes = () => {
        document.querySelectorAll('.dummy-box').forEach(d => d.remove());
        
        const containerWidth = container.clientWidth;
        const boxWidth = 420;
        const gap = 20;        

        const boxesPerRow = Math.max(1, Math.floor((containerWidth + gap) / (boxWidth + gap)));
        
        const visibleBoxes = container.querySelectorAll('.output-box').length;
        if (visibleBoxes > boxesPerRow) {
            const remainder = visibleBoxes % boxesPerRow;
            if (remainder > 0) {
                const dummyCount = boxesPerRow - remainder;
                for (let i = 0; i < dummyCount; i++) {
                    const dummy = document.createElement('div');
                    dummy.className = 'dummy-box';
                    container.appendChild(dummy);
                }
            }
        }
    };
    
    // Update dummy boxes on window resize
    window.addEventListener('resize', updateDummyBoxes);
});


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