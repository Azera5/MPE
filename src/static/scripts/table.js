document.addEventListener('DOMContentLoaded', function() {
    const tableContainer = document.querySelector('.table-container');
    const tableRows = document.querySelectorAll('.queries-table tbody tr');
      
    // Handle SQL query execution
    const sqlQueryBtn = document.querySelector('.sql-query-btn');
    const sqlQueryInput = document.querySelector('.sql-query-input');
    
    if (sqlQueryBtn && sqlQueryInput) {
        // Automatic height adjustment for the textarea
        function adjustTextareaHeight() {
            sqlQueryInput.style.height = 'auto';
            sqlQueryInput.style.height = (sqlQueryInput.scrollHeight) + 'px';
        }

        // Initial adjustment and event listener
        adjustTextareaHeight();
        sqlQueryInput.addEventListener('input', adjustTextareaHeight);

        // Event listeners for button and Enter key
        sqlQueryBtn.addEventListener('click', executeCustomQuery);
        sqlQueryInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault(); // Prevents line break on Enter
                executeCustomQuery();
            }
            // Shift+Enter allows line breaks
        });
    }
    
    async function executeCustomQuery() {
        const query = sqlQueryInput.value.trim();
        
        if (!query) {
            alert('Please enter a SQL query');
            return;
        }
        
        try {
            const response = await fetch('/api/custom_query', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query: query })
            });
            
            const result = await response.json();
            
            if (result.error) {
                alert('Query Error: ' + result.error + (result.details ? '\n' + result.details : ''));
                return;
            }
            
            // Remove existing custom table
            const existingCustomTable = document.querySelector('.custom-table-container');
            if (existingCustomTable) {
                existingCustomTable.remove();
            }
            
            // Remove existing answer table
            const existingAnswerTable = document.querySelector('.answers-table-container');
            if (existingAnswerTable) {
                existingAnswerTable.remove();
            }
            
            // Create and display custom table
            const customTableHTML = createCustomTable(result.columns, result.rows);
            tableContainer.insertAdjacentHTML('beforeend', customTableHTML);
            
        } catch (error) {
            console.error('Error:', error);
            alert('Error executing query: ' + error.message);
        }
    }
    
    function createCustomTable(columns, rows) {
        let headerHTML = '';
        columns.forEach(col => {
            headerHTML += `<th>${col}</th>`;
        });
        
        let rowsHTML = '';
        rows.forEach((row, index) => {
            const rowClass = index % 2 === 0 ? 'even-row' : 'odd-row';
            rowsHTML += `<tr class="${rowClass}">`;
            columns.forEach(col => {
                const cellValue = row[col] || '';
                rowsHTML += `<td>${parseMarkdown(cellValue)}</td>`;
            });
            rowsHTML += '</tr>';
        });
        
        return `
            <div class="custom-table-container">
                <h3>Custom Query Results (${rows.length} rows)</h3>
                <div class="table-scroll-wrapper">
                    <table class="table custom-table">
                        <thead>
                            <tr>
                                ${headerHTML}
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHTML}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
    
    tableRows.forEach(row => {
        row.addEventListener('click', async function() {
            // Remove previous selection
            document.querySelectorAll('.queries-table tbody tr.selected').forEach(r => {
                r.classList.remove('selected');
            });
            
            // Add selection to clicked row
            this.classList.add('selected');
            
            const queryId = this.dataset.queryId;
            
            // Remove any existing tables
            const existingAnswerTable = document.querySelector('.answers-table-container');
            if (existingAnswerTable) {
                existingAnswerTable.remove();
            }
            
            const existingCustomTable = document.querySelector('.custom-table-container');
            if (existingCustomTable) {
                existingCustomTable.remove();
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
    
    // Initialize search functionality
    const searchInput = document.querySelector('.table-search');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            tableRows.forEach(row => {
                const text = row.textContent.toLowerCase();
                if (text.includes(searchTerm)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        });
    }
});


function createAnswersTable(answers) {
    let rowsHTML = '';
    answers.forEach((answer, index) => {
        const bestAnswerClass = answer.is_best ? 'best-answer' : '';
        const rowClass = index % 2 === 0 ? 'even-row' : 'odd-row';
        const combinedClass = `${rowClass} ${bestAnswerClass}`.trim();
        
        // Create strategy toggle button
        const strategyCell = answer.strategy === 'None' ?
            answer.strategy :
            `<button class="strategy-toggle">${answer.strategy}</button>`;

        // Create answer cell with toggle functionality
        const shortAnswer = parseMarkdown(answer.answer);
        const fullAnswer = parseMarkdown(answer.answer);
        const answerCell = `
            <div class="scrollable-answer clickable-answer" 
                 data-short-answer="${encodeURIComponent(shortAnswer)}"
                 data-full-answer="${encodeURIComponent(fullAnswer)}">
                ${shortAnswer}
            </div>
        `;

        // Format feedback scores
        const completeness = answer.feedback?.completeness !== null ? Math.round(answer.feedback.completeness) : '-';
        const relevance = answer.feedback?.relevance !== null ? Math.round(answer.feedback.relevance) : '-';
        const clarity = answer.feedback?.clarity !== null ? Math.round(answer.feedback.clarity) : '-';
        const feedbackCell = `${completeness} | ${relevance} | ${clarity}`;
        
        const metapromptTokens = answer.metaprompt?.tokens ? answer.metaprompt.tokens.replace(/\//g, ' | ') : '- | - | -';
        const answerTokens = answer.tokens ? answer.tokens.replace(/\//g, ' | ') : '- | - | -';
        
        rowsHTML += `
            <tr class="${combinedClass}" data-answer-id="${answer.id.split(':')[1]}">
                <td>${answer.id}</td>
                <td>${answerCell}</td>
                <td>${answer.model}</td>
                <td style="min-width: 125px;" class="strategy-cell">${strategyCell}</td>
                <td style="min-width: 200px;" class="feedback-scores">${answerTokens}</td>
                <td>${answer.score ? answer.score.toFixed(2) : 'N/A'}</td>
                <td style="min-width: 120px;" class="feedback-scores">${feedbackCell}</td>
            </tr>
            <tr class="details-row" style="display: none;">
                <td colspan="7">
                    <div class="answer-details" style="display: none;">
                        <div class="metaprompt-content">
                            <h4>Full Answer</h4>
                            <div class="metaprompt-text">${fullAnswer}</div>
                            <p><strong>Answer Tokens:</strong> ${answerTokens}</p>
                        </div>
                    </div>
                    <div class="strategy-details" style="display: none;">
                        <div class="metaprompt-content">
                            <h4>Strategy Details</h4>
                            <div class="metaprompt-text">${parseMarkdown(answer.metaprompt?.prompt || 'N/A')}</div>
                            <p><strong>Model:</strong> ${answer.metaprompt?.model || 'N/A'}</p>
                            <p><strong>Tokens:</strong> ${metapromptTokens}</p>
                        </div>
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
                        <th>Answer Tokens<br>(P | E | T)</th>
                        <th>F1 Score</th>
                        <th>Feedback<br>(Co | R | Cl)</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHTML}
                </tbody>
            </table>
        </div>
    `;
}

document.addEventListener('DOMContentLoaded', function() {
    // Delegate click events for both answer toggles and strategy toggles
    document.addEventListener('click', function(e) {
        // Handle answer toggle clicks
        if (e.target.classList.contains('clickable-answer')) {
            const answerCell = e.target;
            const row = answerCell.closest('tr');
            const detailsRow = row.nextElementSibling;
            const answerDetails = detailsRow.querySelector('.answer-details');
            const strategyDetails = detailsRow.querySelector('.strategy-details');
            const strategyButton = row.querySelector('.strategy-toggle');

            // If details row is hidden, show answer details
            if (detailsRow.style.display === 'none') {
                detailsRow.style.display = '';
                answerDetails.style.display = '';
                strategyDetails.style.display = 'none';
                if (strategyButton) strategyButton.classList.remove('active');
            } 
            // If answer details are already showing, hide everything
            else if (answerDetails.style.display !== 'none') {
                detailsRow.style.display = 'none';
            }
            // If strategy details are showing, switch to answer details
            else {
                answerDetails.style.display = '';
                strategyDetails.style.display = 'none';
                if (strategyButton) strategyButton.classList.remove('active');
            }
        }
        
        // Handle strategy toggle clicks
        if (e.target.classList.contains('strategy-toggle')) {
            const button = e.target;
            const row = button.closest('tr');
            const detailsRow = row.nextElementSibling;
            const answerDetails = detailsRow.querySelector('.answer-details');
            const strategyDetails = detailsRow.querySelector('.strategy-details');

            // If details row is hidden, show strategy details
            if (detailsRow.style.display === 'none') {
                detailsRow.style.display = '';
                strategyDetails.style.display = '';
                answerDetails.style.display = 'none';
                button.classList.add('active');
            } 
            // If strategy details are already showing, hide everything
            else if (strategyDetails.style.display !== 'none') {
                detailsRow.style.display = 'none';
                button.classList.remove('active');
            }
            // If answer details are showing, switch to strategy details
            else {
                strategyDetails.style.display = '';
                answerDetails.style.display = 'none';
                button.classList.add('active');
            }
        }
    });
});

function setupStrategyToggleHandlers() {
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('strategy-toggle')) {
            const row = e.target.closest('tr');
            const detailsRow = row.nextElementSibling;
            const strategyDetails = detailsRow.querySelector('.strategy-details');
            const answerDetails = detailsRow.querySelector('.answer-details');
            
            // Check if strategy details are currently visible
            const isStrategyVisible = strategyDetails.style.display !== 'none';
            
            if (isStrategyVisible) {
                // If strategy is visible, hide it and collapse the details row
                strategyDetails.style.display = 'none';
                
                // Only hide the entire details row if answer details are also hidden
                if (answerDetails.style.display === 'none') {
                    detailsRow.style.display = 'none';
                }
            } else {
                // Show strategy details and ensure details row is visible
                detailsRow.style.display = 'table-row';
                strategyDetails.style.display = 'block';
                
                // Hide answer details when showing strategy details
                answerDetails.style.display = 'none';
            }
        }
        
        // Handle answer cell clicks (existing functionality)
        if (e.target.classList.contains('clickable-answer')) {
            const row = e.target.closest('tr');
            const detailsRow = row.nextElementSibling;
            const answerDetails = detailsRow.querySelector('.answer-details');
            const strategyDetails = detailsRow.querySelector('.strategy-details');
            
            // Check if answer details are currently visible
            const isAnswerVisible = answerDetails.style.display !== 'none';
            
            if (isAnswerVisible) {
                // If answer is visible, hide it and collapse the details row
                answerDetails.style.display = 'none';
                
                // Only hide the entire details row if strategy details are also hidden
                if (strategyDetails.style.display === 'none') {
                    detailsRow.style.display = 'none';
                }
            } else {
                // Show answer details and ensure details row is visible
                detailsRow.style.display = 'table-row';
                answerDetails.style.display = 'block';
                
                // Hide strategy details when showing answer details
                strategyDetails.style.display = 'none';
            }
        }
    });
}