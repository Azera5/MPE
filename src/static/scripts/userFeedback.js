function initializeUserFeedback() {
    document.querySelectorAll('.output-box').forEach(box => {    
        // Create feedback section if it doesn't exist
    if (!box.querySelector('.user-feedback-section')) {
        const feedbackSection = document.createElement('div');
        feedbackSection.className = 'user-feedback-section';
        
        // Create best answer button
        const bestAnswerbutton = document.createElement('button');
        bestAnswerbutton.className = 'best-answer-button';
        bestAnswerbutton.textContent = 'Best Answer';
        
        // Add click handler (will be implemented later)
        bestAnswerbutton.addEventListener('click', () => {
            console.log('Best answer selected for box:', box);
            // Will implement feedback handling later
        });
        
        feedbackSection.appendChild(bestAnswerbutton);
        box.appendChild(feedbackSection);
        box.classList.add('has-feedback');
    }

    });
}