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
        
        const strategyCell = answer.strategy === 'None' ? 
            answer.strategy : 
            `<button class="strategy-toggle">${answer.strategy}</button>`;
            
        const feedbackButton = answer.has_feedback ?
            '<button class="feedback-btn" disabled>Feedback Submitted</button>' :
            '<button class="feedback-btn">Feedback</button>';
            
        rowsHTML += `
            <tr class="${combinedClass}" data-answer-id="${answer.id.split(':')[1]}">
                <td>${answer.id}</td>
                <td><div class="scrollable-answer">${parseMarkdown(answer.answer)}</div></td>
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
                        <div class="metaprompt-text">${parseMarkdown(answer.metaprompt || 'N/A')}</div>
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
}