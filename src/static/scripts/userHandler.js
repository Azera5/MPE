document.addEventListener('DOMContentLoaded', function() {
    const userButton = document.getElementById('userButton');
    const userPopup = document.getElementById('userPopup');
    const userIdInput = document.getElementById('userIdInput');
    const userSuggestions = document.getElementById('userSuggestions');
    const saveUserButton = document.getElementById('saveUserButton');
    
    // Load current user from local storage or set default value
    let currentUser = localStorage.getItem('currentUser') || 'User';
    updateUserButton(currentUser);
    
    userButton.addEventListener('click', function() {
        userPopup.style.display = 'flex';
        userIdInput.focus();
        fetchUserSuggestions();
    });
    
    // Close popup when clicked outside
    userPopup.addEventListener('click', function(e) {
        if (e.target === userPopup) {
            userPopup.style.display = 'none';
        }
    });
    
    userIdInput.addEventListener('input', function() {
        fetchUserSuggestions(this.value);
    });
    
    saveUserButton.addEventListener('click', async function() {
        const newUser = userIdInput.value.trim();
        if (newUser) {
            try {
                // Save the user to the backend
                const response = await fetch('/api/users', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ user: newUser })
                });
                
                if (response.ok) {
                    currentUser = newUser;
                    localStorage.setItem('currentUser', currentUser);
                    updateUserButton(currentUser);
                    userPopup.style.display = 'none';
                } else {
                    const errorData = await response.json();
                    console.error('Error saving user:', errorData.error);
                }
            } catch (error) {
                console.error('Error saving user:', error);
            }
        }
    });
    
    function updateUserButton(user) {
        const firstLetter = user.charAt(0).toUpperCase();
        userButton.textContent = firstLetter;
    }
    
    // Function to retrieve user suggestions
    async function fetchUserSuggestions(filter = '') {
        try {
            const response = await fetch(`/api/users?filter=${encodeURIComponent(filter)}`);
            const users = await response.json();
            
            userSuggestions.innerHTML = '';
            users.forEach(user => {
                const div = document.createElement('div');
                div.textContent = user;
                div.addEventListener('click', function() {
                    userIdInput.value = user;
                    userSuggestions.innerHTML = '';
                });
                userSuggestions.appendChild(div);
            });
        } catch (error) {
            console.error('Error retrieving user suggestions:', error);
        }
    }
});