let userButton, userPopup, userIdInput, userSuggestions, saveUserButton;

function openUserPopup() {
    userPopup.style.display = 'flex';
    userIdInput.focus();
    fetchUserSuggestions();
}


function closeUserPopup() {
    userPopup.style.display = 'none';
}


function updateUserButton(user) {
    const firstLetter = user.charAt(0).toUpperCase();
    userButton.textContent = firstLetter;
}


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


async function saveUser() {
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
                populateDropdown();
                closeUserPopup();
                return true;
            } else {
                const errorData = await response.json();
                console.error('Error saving user:', errorData.error);
                return false;
            }
        } catch (error) {
            console.error('Error saving user:', error);
            return false;
        }
    }
    return false;
}

document.addEventListener('DOMContentLoaded', function() {   
    userButton = document.getElementById('userButton');
    userPopup = document.getElementById('userPopup');
    userIdInput = document.getElementById('userIdInput');
    userSuggestions = document.getElementById('userSuggestions');
    saveUserButton = document.getElementById('saveUserButton');
    
    // Load current user from local storage or set default value
    currentUser = localStorage.getItem('currentUser') || 'User';
    updateUserButton(currentUser);
    
    // Event Listeners
    userButton.addEventListener('click', function() {
        openUserPopup();
    });
    
    // Close popup when clicked outside
    userPopup.addEventListener('click', function(e) {
        if (e.target === userPopup) {
            closeUserPopup();
        }
    });
    
    userIdInput.addEventListener('input', function() {
        fetchUserSuggestions(this.value);
    });
    
    saveUserButton.addEventListener('click', async function() {
        await saveUser();
    });
});