import { 
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signOut // Added signOut import
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { 
    doc, 
    getDoc, 
    setDoc, 
    collection, 
    updateDoc,
    serverTimestamp,
    arrayUnion,
    enableNetwork,
    disableNetwork
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Flag to prevent multiple redirects
let isRedirecting = false;

// Wait for DOM to be ready and Firebase to be initialized
document.addEventListener('DOMContentLoaded', function() {
    // Wait for Firebase services to be available
    const checkFirebaseInterval = setInterval(() => {
        if (window.firebaseServices) {
            clearInterval(checkFirebaseInterval);
            initializeAuth();
        }
    }, 100);
});

async function checkUserProfileAndRedirect(auth, db, user) {
    if (isRedirecting) return; // Prevent multiple redirects

    try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists() && userDoc.data().householdId) {
            console.log('User profile found, redirecting to dashboard...');
            isRedirecting = true;
            window.location.href = 'dashboard.html';
        } else {
            console.log('No household ID found for user. User may need to complete profile or join a household.');
            // If on index.html and no household ID, keep them on the login/signup page
            if (window.location.pathname.endsWith('/dashboard.html')) {
                 // If somehow on dashboard without householdId, maybe redirect back to index
                 console.warn('User on dashboard without household ID, redirecting to index.');
                 window.location.href = 'index.html';
            }
        }
    } catch (error) {
        console.error('Error checking user data:', error);
        // Don't redirect if we can't verify the user's profile
    }
}

// Function to generate a unique 6-digit numerical ID
async function generateUniqueHouseholdId(db) {
    let isUnique = false;
    let newId = '';
    const maxRetries = 20; // Increased retries
    let retries = 0;

    while (!isUnique && retries < maxRetries) {
        // Generate a random 6-digit number (100000 to 999999)
        newId = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Check if a household with this ID already exists
        const householdRef = doc(db, 'households', newId);
        // Use a fresh get to avoid potential caching issues during generation
        const householdDoc = await getDoc(householdRef);

        if (!householdDoc.exists()) {
            isUnique = true;
        } else {
            console.log(`Generated ID ${newId} already exists, retrying...`);
            retries++;
        }
    }

    if (!isUnique) {
        throw new Error('Failed to generate a unique 6-digit household ID after multiple retries.');
    }

    return newId;
}

function initializeAuth() {
    const { auth, db } = window.firebaseServices;
    
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
    const householdIdInput = document.getElementById('household-id');
    const signupButton = document.getElementById('signup-button');
    const signupError = document.getElementById('signup-error');

    // Add network status handling (assuming it's already present and correct)
    // ... (keep your existing online/offline logic here)
     let isOnline = navigator.onLine;
     const offlineBanner = document.getElementById('offline-banner');
     const body = document.body;

     function updateOnlineStatus() {
        if (navigator.onLine) {
            isOnline = true;
            offlineBanner.classList.remove('visible');
            body.classList.remove('offline');
            enableNetwork(db).catch(error => console.error('Error enabling network:', error));
            console.log('Network connection restored');
            // Re-check auth state and profile after network is back
            const user = auth.currentUser;
            if (user) {
                 // Small delay to allow network to stabilize
                 setTimeout(() => checkUserProfileAndRedirect(auth, db, user), 500);
            } else if (!window.location.pathname.endsWith('/index.html')) {
                // If not logged in and not on index page after going online, redirect to index
                 console.log('Offline user came online, redirecting to index');
                 window.location.href = 'index.html';
            }

        } else {
            isOnline = false;
            offlineBanner.classList.add('visible');
            body.classList.add('offline');
            disableNetwork(db).catch(error => console.error('Error disabling network:', error));
            console.log('Network disabled due to offline status');
        }
    }

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    // Initial check with a slight delay to ensure Firebase is ready
    setTimeout(updateOnlineStatus, 200);

    // Toggle forms (assuming it's already present and correct)
    // ... (keep your existing form toggle logic here)
     if (showSignupLink) {
         showSignupLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginForm.style.display = 'none';
            signupForm.style.display = 'block';
            loginError.textContent = '';
            signupError.textContent = ''; // Clear signup error on toggle
        });
     }

    if (showLoginLink) {
        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            signupForm.style.display = 'none';
            loginForm.style.display = 'block';
            signupError.textContent = '';
            loginError.textContent = ''; // Clear login error on toggle
        });
    }

    // --- Authentication State Observer ---
    // This is the primary handler for redirection after any auth change
    onAuthStateChanged(auth, async (user) => {
        console.log('Auth state changed:', user ? 'User logged in' : 'No user');
        if (user) {
            // Check and redirect after auth state change
            // Add a small delay to allow potential Firestore writes to complete
             setTimeout(() => checkUserProfileAndRedirect(auth, db, user), 300); // Small delay

        } else {
            console.log('No user logged in.');
            // If on dashboard.html and no user, redirect to index.html
            if (window.location.pathname.endsWith('/dashboard.html')) {
                console.log('No user on dashboard, redirecting to index.');
                 // Add a small delay before redirecting to avoid potential race conditions
                 setTimeout(() => { window.location.href = 'index.html'; }, 100);
            }
             isRedirecting = false; // Reset redirect flag if user logs out
        }
    });

    // --- Login ---
    if (loginButton) {
        loginButton.addEventListener('click', async (e) => {
            e.preventDefault();
            loginError.textContent = '';
            loginButton.disabled = true;
            
            try {
                if (!navigator.onLine) {
                    throw new Error('Unable to log in while offline. Please check your internet connection.');
                }

                const email = loginEmailInput.value.trim();
                const password = loginPasswordInput.value;

                if (!email || !password) {
                    throw new Error('Please enter both email and password');
                }

                console.log('Attempting login with email:', email);
                // signInWithEmailAndPassword will trigger onAuthStateChanged
                await signInWithEmailAndPassword(auth, email, password);
                console.log('Sign-in process initiated. Waiting for auth state change...');
                // Redirection is now handled by the onAuthStateChanged listener

            } catch (error) {
                console.error('Login error:', error);
                switch (error.code) {
                    case 'auth/user-not-found':
                        loginError.textContent = 'No account found with this email';
                        break;
                    case 'auth/wrong-password':
                        loginError.textContent = 'Incorrect password';
                        break;
                    case 'auth/invalid-email':
                        loginError.textContent = 'Invalid email format';
                        break;
                     case 'auth/invalid-credential': 
                        loginError.textContent = 'Invalid email or password';
                        break;
                    case 'auth/network-request-failed':
                        loginError.textContent = 'Network error. Please check your internet connection.';
                        break;
                    default:
                        loginError.textContent = error.message;
                }
            } finally {
                loginButton.disabled = false;
            }
        });
    }

    // --- Signup ---
    if (signupButton) {
        signupButton.addEventListener('click', async (e) => {
            e.preventDefault();
            signupError.textContent = '';
            signupButton.disabled = true;

            try {
                if (!navigator.onLine) {
                    throw new Error('Unable to sign up while offline. Please check your internet connection.');
                }

                const email = signupEmailInput.value.trim();
                const password = signupPasswordInput.value;
                const householdId = householdIdInput.value.trim();

                if (!email || !password) {
                    throw new Error('Please enter both email and password');
                }

                console.log('Starting signup process...');
                console.log('Attempting signup with email:', email);
                
                // Step 1: Create user account
                let userCredential;
                try {
                    // createUserWithEmailAndPassword will trigger onAuthStateChanged
                    userCredential = await createUserWithEmailAndPassword(auth, email, password);
                    console.log('User account created successfully:', userCredential.user.uid);
                } catch (error) {
                    console.error('Error creating user account:', error);
                    throw error;
                }

                const user = userCredential.user;
                let finalHouseholdId = householdId;

                // Step 2: Create or join household
                if (!householdId) {
                    console.log('No household ID provided, creating new household...');
                    try {
                        // Generate a unique 6-digit ID
                        finalHouseholdId = await generateUniqueHouseholdId(db);
                        
                        // Use setDoc with the generated ID
                        await setDoc(doc(db, 'households', finalHouseholdId), {
                            name: `${email.split('@')[0]}'s Household`, // Default name
                            createdAt: serverTimestamp(),
                            members: [user.uid]
                        });
                        console.log('Created new household with ID:', finalHouseholdId);
                    } catch (error) {
                        console.error('Error creating household:', error);
                         // If household creation fails, we might want to delete the auth user
                         // This is advanced error handling and not implemented here.
                         throw new Error('Failed to create household: ' + error.message);
                    }
                } else {
                    console.log('Joining existing household:', householdId);
                    try {
                        // Validate the format 
                         if (!/^[0-9]{6}$/.test(householdId)) {
                             throw new Error('Invalid household ID format. Must be a 6-digit number.');
                         }

                        const householdRef = doc(db, 'households', householdId);
                        // Get the document to check existence before trying to update
                        const householdDoc = await getDoc(householdRef);
                        
                        if (!householdDoc.exists()) {
                            throw new Error('Household ID not found');
                        }
                        
                        await updateDoc(householdRef, {
                            members: arrayUnion(user.uid)
                        });
                        finalHouseholdId = householdId; // Set finalHouseholdId to the joined ID
                        console.log('Added user to existing household:', householdId);
                    } catch (error) {
                        console.error('Error joining household:', error);
                         // If joining fails, we might want to delete the auth user
                         throw new Error('Failed to join household: ' + error.message);
                    }
                }

                // Step 3: Create user profile (This will also trigger onAuthStateChanged again)
                console.log('Creating user profile...');
                try {
                    await setDoc(doc(db, 'users', user.uid), {
                        email: user.email,
                        householdId: finalHouseholdId,
                        createdAt: serverTimestamp()
                    });
                    console.log('User profile created successfully. Waiting for auth state change...');
                    // Redirection is handled by the onAuthStateChanged listener
                    
                } catch (error) {
                    console.error('Error creating user profile:', error);
                     // Clean up user account if profile creation fails?
                     // This is complex and might require server-side logic.
                     throw new Error('Error setting up user profile: ' + error.message);
                }

            } catch (error) {
                console.error('Signup error:', error);
                // General error handling for the signup process steps
                switch (error.code) {
                    case 'auth/email-already-in-use':
                        signupError.textContent = 'This email is already registered. Please log in instead.';
                        break;
                    case 'auth/invalid-email':
                        signupError.textContent = 'Invalid email format';
                        break;
                    case 'auth/weak-password':
                        signupError.textContent = 'Password is too weak. Please use at least 6 characters';
                        break;
                    case 'auth/network-request-failed':
                        signupError.textContent = 'Network error. Please check your internet connection.';
                        break;
                     case 'auth/operation-not-allowed':
                        signupError.textContent = 'Email/Password sign up is not enabled in Firebase Auth.';
                        break;
                    default:
                         // Display the specific error message from the catch blocks above
                         signupError.textContent = error.message;
                }
                 // If a user was created in auth but subsequent steps failed,
                 // you might want to delete the user here to avoid orphaned accounts.
                 // This requires `auth.currentUser.delete()`, but handle with care.
            } finally {
                signupButton.disabled = false;
            }
        });
    }

    // --- Logout ---
     const logoutButton = document.getElementById('logout-button');
     if (logoutButton) {
         logoutButton.addEventListener('click', async () => {
             try {
                 await signOut(auth);
                 console.log('User logged out');
                 // onAuthStateChanged will handle the redirect to index.html
             } catch (error) {
                 console.error('Logout error:', error);
             }
         });
     }
}
