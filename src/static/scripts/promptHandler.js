// Function to handle sending prompt to backend and displaying response
async function sendPromptToLLM(prompt) {
    try {
        const response = await fetch('/api/prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt: prompt })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.response;
    } catch (error) {
        console.error('Error sending prompt:', error);
        return `Error: ${error.message}`;
    }
}

// Function to handle user input
function setupPromptHandling() {
    const userInput = document.getElementById('userInput');
    const outputBox1 = document.querySelector('.output-box:first-child');
    const outputBox2 = document.querySelector('.output-box:nth-child(2)');

    userInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            const prompt = userInput.value.trim();
            if (prompt) {
                
                // Display "Loading..." while waiting for response
                outputBox1.textContent = 'Loading...';
                outputBox2.textContent = 'Loading...';
                
                // Send prompt to LLM and get response
                const llmResponse = await sendPromptToLLM(prompt);
                
                // Move previous output to second box and display new response in first box
                outputBox1.textContent = llmResponse;
                outputBox2.textContent = 'Output 2';

                // Randomize output positions after receiving response
                randomizeOutputPositions();
            }
        }
    });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', setupPromptHandling);