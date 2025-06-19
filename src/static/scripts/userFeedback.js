function initializeUserFeedback() {
    const outputsContainer = document.getElementById('outputsContainer');    
    const annotatedBox = outputsContainer.querySelector('.output-box[data-box-key="annotated_answer"]')
    const annotatedBoxExists = annotatedBox !== null;
    
    // Load feedback
    if(annotatedBoxExists){
        annotatedBox.className = 'output-box annotated-box';
                
        const submitButton = document.createElement('button');
        submitButton.className = 'submit-feedback-button';
        submitButton.textContent = 'Submit Feedback';
                
        submitButton.addEventListener('click', async function(e) {
            e.stopPropagation();
            await handleFeedbackSubmission();
            removeAllOutputBoxes();
            createOutputBoxes();
        });

        annotatedBox.appendChild(submitButton);
        showFeedbackSliders();
        return;
    }
    document.querySelectorAll('.output-box').forEach(box => {
    
    // Create feedback section if it doesn't exist
    if(box.dataset.boxKey !== 'annotated_answer') {
        if (!box.querySelector('.user-feedback-section')) {
            const feedbackSection = document.createElement('div');
            feedbackSection.className = 'user-feedback-section';
            
            // Create best answer button
            const bestAnswerbutton = document.createElement('button');
            bestAnswerbutton.className = 'best-answer-button';
            bestAnswerbutton.textContent = 'Best Answer';
            bestAnswerbutton.classList.add('inactive');
            
            // Add click handler for best answer selection
            bestAnswerbutton.addEventListener('click', async function(e) {
                e.stopPropagation();
                
                // Only proceed if the output box is selected
                if (!this.classList.contains('inactive')) {
                    try {
                        // 1. Save to database
                        const boxKey = box.dataset.boxKey;
                        await saveBestAnswerToDatabase(boxKey);
                        
                        // 2. UI Update
                        showFeedbackSliders();
                        
                        console.log('Best answer processed for box:', boxKey);
                    } catch (error) {
                        console.error('Error processing best answer:', error);
                    }
                }
            });
            
            feedbackSection.appendChild(bestAnswerbutton);
            box.appendChild(feedbackSection);
            box.classList.add('has-bestAnswerButton');
        }
    }   
    });
}

async function saveBestAnswerToDatabase(boxKey) {
    // Get the output box content
    const outputBox = document.querySelector(`.output-box[data-box-key="${boxKey}"]`);    
    const answerContent = getAnswerContentOnly(outputBox);

    try {
        // First find the answer and query IDs using the answer text
        const findResponse = await fetch('/api/find_answer_by_content', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                answer_content: answerContent
            })
        });

        if (!findResponse.ok) {
            throw new Error('Failed to find answer in database');
        }

        const { answer_id, query_id } = await findResponse.json();
        
        if (!answer_id || !query_id) {
            throw new Error('Answer or query not found');
        }

        // Then update the query with the best answer
        const updateResponse = await fetch('/api/insert_bestAnswer', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query_id: query_id,
                best_answer_id: answer_id
            })
        });

        if (!updateResponse.ok) {
            throw new Error('Failed to update best answer');
        }

        // Create annotated answer box
        createAnnotatedAnswerBox(query_id);
        return await updateResponse.json();
        
    } catch (error) {
        console.error('Error in saveBestAnswerToDatabase:', error);
        throw error;
    }
}

// Removes feedbackSection text text from output content.
function getAnswerContentOnly(outputBox) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = outputBox.innerHTML;

    const feedbackSection = tempDiv.querySelector('.user-feedback-section');
    if (feedbackSection) {
        feedbackSection.remove();
    }
    
    const cleanHTML = tempDiv.innerHTML;
    return htmlToMarkdown(cleanHTML);
}