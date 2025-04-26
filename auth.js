const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const showSignupLink = document.getElementById('show-signup');
const showLoginLink = document.getElementById('show-login');

const loginEmailInput = document.getElementById('login-email');
const loginPasswordInput = document.getElementById('login-password');
const loginButton = document.getElementById('login-button');
const loginError = document.getElementById('login-error');

const signupEmailInput = document.getElementById('signup-email');
const signupPasswordInput = document.getElementById('signup-password');
const householdIdInput = document.getElementById('household-id'); // For joining/creating
const signupButton = document.getElementById('signup-button');
const signupError = document.getElementById('signup-error');

// Toggle forms
showSignupLink.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.style.display = 'none';
    signupForm.style.display = 'block';
});

showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    signupForm.style.display = 'none';
    loginForm.style.display = 'block';
});

// --- Authentication State Observer ---
// Redirects if user is already logged in
auth.onAuthStateChanged(async (user) => {
    if (user) {
        // Check if user has household data (simplified)
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists && userDoc.data().householdId) {
             console.log('User logged in and has household, redirecting to dashboard...');
             window.location.href = 'dashboard.html'; // Redirect to dashboard
        } else {
            // Handle case where user is logged in but household setup isn't complete
            // Maybe show a "Join/Create Household" screen within index.html or a separate page
            console.log('User logged in but no household ID found. Stay on login/signup page or redirect to household setup.');
            // For this example, we'll keep them here, but ideally guide them.
            if (!signupForm.style.display || signupForm.style.display === 'none') {
                 // If they are on login, maybe prompt them about household setup
            }
        }
    } else {
        console.log('No user logged in.');
        // Ensure forms are visible if not logged in and on index.html
        if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
             loginForm.style.display = 'block'; // Show login by default
             signupForm.style.display = 'none';
        }
    }
});


// --- Login ---
loginButton.addEventListener('click', async (e) => {
    e.preventDefault();
    loginError.textContent = '';
    const email = loginEmailInput.value;
    const password = loginPasswordInput.value;

    try {
        await auth.signInWithEmailAndPassword(email, password);
        // onAuthStateChanged will handle the redirect
    } catch (error) {
        console.error("Login failed:", error);
        loginError.textContent = error.message;
    }
});

// --- Signup ---
signupButton.addEventListener('click', async (e) => {
    e.preventDefault();
    signupError.textContent = '';
    const email = signupEmailInput.value;
    const password = signupPasswordInput.value;
    const householdId = householdIdInput.value.trim(); // Get desired household ID

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        console.log('User signed up:', user.uid);

        let finalHouseholdId = householdId;

        // Determine Household: Create new or use existing
        if (!householdId) {
            // Create a new household document and get its ID
            const newHouseholdRef = await db.collection('households').add({
                name: `${email.split('@')[0]}'s Household`, // Default name
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                members: [user.uid] // Add creator as first member
            });
            finalHouseholdId = newHouseholdRef.id;
            console.log('Created new household:', finalHouseholdId);
        } else {
             // Add user to existing household (Basic - needs validation/invites in real app)
             const householdRef = db.collection('households').doc(householdId);
             await householdRef.update({
                 members: firebase.firestore.FieldValue.arrayUnion(user.uid)
             });
             console.log('Added user to existing household:', finalHouseholdId);
             // **NOTE:** In a real app, you'd verify the householdId exists first!
        }


        // Store user profile data (including their household ID) in Firestore
        await db.collection('users').doc(user.uid).set({
            email: user.email,
            householdId: finalHouseholdId,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        console.log('User profile created with household ID.');
        // onAuthStateChanged will handle the redirect after user profile is set

    } catch (error) {
        console.error("Signup failed:", error);
        signupError.textContent = error.message;
         // If error is "auth/email-already-in-use", provide a specific message
        if (error.code === 'auth/email-already-in-use') {
            signupError.textContent = 'This email address is already in use. Please log in or use a different email.';
        } else {
            signupError.textContent = error.message;
        }
    }
});