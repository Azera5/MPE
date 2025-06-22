document.addEventListener('DOMContentLoaded', function() {
    // Initialize table functionality
    const tableRows = document.querySelectorAll('.queries-table tbody tr');
    
    tableRows.forEach(row => {
        row.addEventListener('click', function() {
            const queryId = this.dataset.queryId;
            console.log('Query selected:', queryId);
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