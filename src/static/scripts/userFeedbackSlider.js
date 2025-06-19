function showFeedbackSliders() {
    document.querySelectorAll('.output-box').forEach(box => {
        if (box.dataset.boxKey === 'annotated_answer') return        
        box.classList.add('has-feedbackSlider');

        const feedbackSection = box.querySelector('.user-feedback-section');
        if (feedbackSection) {
            // Remove the best answer button
            const bestAnswerButton = feedbackSection.querySelector('.best-answer-button');
            if (bestAnswerButton) {
                bestAnswerButton.remove();
            }

            // Create sliders container
            const slidersContainer = document.createElement('div');
            slidersContainer.className = 'feedback-sliders-container';

            // Define the feedback criteria
            const criteria = [
                { name: 'accuracy', label: 'Accuracy' },
                { name: 'completeness', label: 'Completeness' },
                { name: 'relevance', label: 'Relevance' },
                { name: 'coherence', label: 'Coherence' },
                { name: 'clarity', label: 'Clarity' }
            ];

            // Create sliders for each criterion
            criteria.forEach(criterion => {
                const sliderGroup = document.createElement('div');
                sliderGroup.className = 'slider-group-with-scale';

                const mainGroup = document.createElement('div');
                mainGroup.className = 'slider-group';

                // Create label
                const label = document.createElement('div');
                label.className = 'slider-label';
                label.textContent = criterion.label;

                // Create slider container
                const sliderContainer = document.createElement('div');
                sliderContainer.className = 'slider-container';

                // Create slider
                const slider = document.createElement('input');
                slider.type = 'range';
                slider.className = 'feedback-slider';
                slider.min = '-2';
                slider.max = '2';
                slider.step = '1';
                slider.value = '0';
                slider.dataset.criterion = criterion.name;

                // Create scale indicators
                const scaleContainer = document.createElement('div');
                scaleContainer.className = 'slider-scale';

                const scaleLabels = ['-2', '-1', '0', '+1', '+2'];
                scaleLabels.forEach(label => {
                    const scaleLabel = document.createElement('span');
                    scaleLabel.textContent = label;
                    scaleContainer.appendChild(scaleLabel);
                });

                // Add slider group
                sliderContainer.appendChild(slider);
                sliderContainer.appendChild(scaleContainer);
                
                mainGroup.appendChild(label);
                mainGroup.appendChild(sliderContainer);               

                sliderGroup.appendChild(mainGroup);
                slidersContainer.appendChild(sliderGroup);
            });

            // Create action buttons
            const actionsContainer = document.createElement('div');
            actionsContainer.className = 'slider-actions';
        

            
            // actionsContainer.appendChild(cancelButton);
            slidersContainer.appendChild(actionsContainer);

            // Replace content in feedback section
            feedbackSection.innerHTML = '';
            feedbackSection.appendChild(slidersContainer);

            // Adjust height for sliders            
            feedbackSection.style.minHeight = '300px';
        
        }
    });
}

function updateSliderThumbColor(slider, value) {
    // Create a custom CSS property for the thumb color based on value
    const colors = {
        '-2': 'var(--error-color)',
        '-1': 'var(--warning-color)',
        '0': 'var(--muted-text)',
        '1': 'var(--success-color)',
        '2': 'var(--accent-primary)'
    };
    
    const color = colors[value] || 'var(--muted-text)';
    slider.style.setProperty('--thumb-color', color);
}

async function handleFeedbackSubmission() {
    // TODO
    return
}
