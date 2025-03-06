document.addEventListener('DOMContentLoaded', function() {
    const filterButtons = document.querySelectorAll('.filter-button');
    const searchInput = document.getElementById('searchInput');
    const clearSearch = document.getElementById('clearSearch');
    
    function applyFilters() {
        const activeFilterButton = document.querySelector('.filter-button.active');
        const filterType = activeFilterButton ? activeFilterButton.textContent.trim().toLowerCase() : 'all savings';
        const searchQuery = searchInput.value.toLowerCase().trim();
        
        const deals = document.querySelectorAll('.deal-card');
        
        deals.forEach(deal => {
            let show = true;
            
            // Check if the deal matches the search query
            const title = deal.querySelector('.deal-title').textContent.toLowerCase();
            const itemNumber = deal.querySelector('.item-number')?.textContent.toLowerCase() || '';
            const matchesSearch = searchQuery ? (title.includes(searchQuery) || itemNumber.includes(searchQuery)) : true;
            
            // Apply filter conditions
            if (filterType === 'all savings') {
                show = matchesSearch;
            } else if (filterType.includes('$')) {
                const savingsText = deal.querySelector('.deal-saving').textContent;
                const savingsMatch = savingsText.match(/\$(\d+)/);
                const savings = savingsMatch ? parseFloat(savingsMatch[1]) : 0;
                const [min, max] = filterType.match(/\d+/g).map(Number);
                show = savings >= min && (max ? savings <= max : true) && matchesSearch;
            } else if (filterType === 'ending soon') {
                const expiresText = deal.querySelector('.expires').textContent;
                const daysLeftMatch = expiresText.match(/\d+/);
                const daysLeft = daysLeftMatch ? parseInt(daysLeftMatch[0]) : 999;
                show = daysLeft <= 7 && matchesSearch;
            } else if (filterType === 'highest savings') {
                const savingsText = deal.querySelector('.deal-saving').textContent;
                const savingsMatch = savingsText.match(/\$(\d+)/);
                const savings = savingsMatch ? parseFloat(savingsMatch[1]) : 0;
                show = savings >= 50 && matchesSearch;
            }
            
            deal.style.display = show ? 'flex' : 'none';
        });
    }
    
    // Filter button clicks
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            applyFilters();
        });
    });
    
    // Search input changes
    searchInput.addEventListener('input', applyFilters);
    
    // Clear button click
    clearSearch.addEventListener('click', () => {
        searchInput.value = '';
        applyFilters();
    });
    
    // Initial filter application (optional, if default filter is set)
    applyFilters();
});