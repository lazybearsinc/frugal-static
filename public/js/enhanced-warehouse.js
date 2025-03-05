document.addEventListener('DOMContentLoaded', function() {
    // Handle filter buttons
    const filterButtons = document.querySelectorAll('.filter-button');
    filterButtons.forEach(button => {
        button.addEventListener('click', handleFilter);
    });
});

function handleFilter() {
    // Remove active class from all buttons in the group
    const group = this.closest('.filter-group');
    group.querySelectorAll('.filter-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Add active class to clicked button
    this.classList.add('active');
    
    // Get all deal cards
    const deals = document.querySelectorAll('.deal-card');
    const filterType = this.textContent.trim().toLowerCase();

    deals.forEach(deal => {
        const savings = deal.querySelector('.deal-saving').textContent;
        const daysLeft = deal.querySelector('.expires').textContent;
        
        // Show all deals if "All Savings" is selected
        if (filterType === 'all savings') {
            deal.style.display = 'flex';
            return;
        }

        // Handle savings range filters
        if (filterType.includes('$')) {
            const amount = parseInt(savings.match(/\$(\d+)/)[1]);
            const [min, max] = filterType.match(/\d+/g).map(Number);
            
            if (max) {
                deal.style.display = (amount >= min && amount <= max) ? 'flex' : 'none';
            } else {
                deal.style.display = (amount >= min) ? 'flex' : 'none';
            }
        }

        // Handle "Ending Soon" filter
        if (filterType === 'ending soon') {
            const days = parseInt(daysLeft.match(/\d+/)[0]);
            deal.style.display = (days <= 7) ? 'flex' : 'none';
        }

        // Handle "Highest Savings" filter
        if (filterType === 'highest savings') {
            const amount = parseInt(savings.match(/\$(\d+)/)[1]);
            deal.style.display = (amount >= 50) ? 'flex' : 'none';
        }
    });
}