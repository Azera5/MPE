document.addEventListener('DOMContentLoaded', function() {
    const tableContainer = document.querySelector('.table-container');
    const tableRows = document.querySelectorAll('.queries-table tbody tr');
    
    tableRows.forEach(row => {
        row.addEventListener('click', async function() {
            // Remove previous selection
            document.querySelectorAll('.queries-table tbody tr.selected').forEach(r => {
                r.classList.remove('selected');
            });
            
            // Add selection to clicked row
            this.classList.add('selected');
            
            const queryId = this.dataset.queryId;
            
            // Remove any existing answer tables
            const existingAnswerTable = document.querySelector('.answers-table-container');
            if (existingAnswerTable) {
                existingAnswerTable.remove();
            }
            
            try {
                // Fetch answers for this query
                const response = await fetch(`/api/query_answers/${queryId}`);
                const answers = await response.json();
                
                if (answers.error) {
                    console.error('Error fetching answers:', answers.error);
                    return;
                }
                
                // Create and append the answers table
                const answersTableHTML = createAnswersTable(answers);
                tableContainer.insertAdjacentHTML('beforeend', answersTableHTML);
                
                // Add event listeners for the new table
                setupAnswersTableEvents();
                
            } catch (error) {
                console.error('Error:', error);
            }
        });
    });
    
    // Initialize search/filter functionality
    const searchInput = document.querySelector('.queries-search');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            console.log('Search:', this.value);
        });
    }
});

function createAnswersTable(answers) {
    let rowsHTML = '';
    
    answers.forEach(answer => {
        const bestAnswerClass = answer.is_best ? 'best-answer' : '';
        const strategyCell = answer.strategy === 'None' ? 
            answer.strategy : 
            `<button class="strategy-toggle">${answer.strategy}</button>`;
            
        const feedbackButton = answer.has_feedback ?
            '<button class="feedback-btn" disabled>Feedback Submitted</button>' :
            '<button class="feedback-btn">Feedback</button>';
            
        rowsHTML += `
            <tr class="${bestAnswerClass}" data-answer-id="${answer.id.split(':')[1]}">
                <td>${answer.id}</td>
                <td><div class="scrollable-answer">${answer.answer}</div></td>
                <td>${answer.model}</td>
                <td class="strategy-cell">${strategyCell}</td>
                <td>${answer.tokens}</td>
                <td>${answer.score ? answer.score.toFixed(2) : 'N/A'}</td>
                <td>${feedbackButton}</td>
            </tr>
            <tr class="metaprompt-details" style="display: none;">
                <td colspan="7">
                    <div class="metaprompt-content">
                        <h4>Metaprompt Details</h4>
                        <p><strong>Prompt:</strong> ${answer.metaprompt || 'N/A'}</p>
                        <p><strong>Model:</strong> ${answer.metaprompt_model || 'N/A'}</p>
                        <p><strong>Tokens:</strong> ${answer.tokens}</p>
                    </div>
                </td>
            </tr>
        `;
    });
    
    return `
        <div class="answers-table-container">
            <table class="table answers-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Answer</th>
                        <th>Model</th>
                        <th>Strategy</th>
                        <th>Tokens (P | E | T)</th>
                        <th>F1 Score</th>
                        <th>Feedback</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHTML}
                </tbody>
            </table>
        </div>
    `;
}

function setupAnswersTableEvents() {
    // Strategy toggle buttons
    document.querySelectorAll('.strategy-toggle').forEach(button => {
        button.addEventListener('click', function() {
            const row = this.closest('tr');
            const detailsRow = row.nextElementSibling;
            
            if (detailsRow.style.display === 'none') {
                detailsRow.style.display = 'table-row';
            } else {
                detailsRow.style.display = 'none';
            }
        });
    });
    
    // Feedback buttons
    document.querySelectorAll('.feedback-btn:not([disabled])').forEach(button => {
        button.addEventListener('click', function() {
            const answerId = this.closest('tr').dataset.answerId;
            // Here you would implement the feedback submission logic
            console.log('Feedback requested for answer:', answerId);
            // You might want to open a modal or navigate to a feedback page
        });
    });
}