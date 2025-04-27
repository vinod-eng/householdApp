import { 
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { 
    doc, 
    getDoc, 
    setDoc, 
    collection, 
    addDoc,
    updateDoc,
    serverTimestamp,
    arrayUnion,
    enableNetwork,
    disableNetwork
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

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

async function checkUserProfile(auth, db, user) {
    try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists() && userDoc.data().householdId) {
            console.log('User profile found, redirecting to dashboard...');
            window.location.href = 'dashboard.html';
        } else {
            console.log('No household ID found for user');
            // Optionally, you could redirect to a profile setup page here
        }
    } catch (error) {
        console.error('Error checking user data:', error);
        // Don't redirect if we can't verify the user's profile
        return false;
    }
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

    // Add network status handling
    let isOnline = navigator.onLine;
    window.addEventListener('online', async () => {
        isOnline = true;
        try {
            await enableNetwork(db);
            console.log('Network connection restored');
            // If user is logged in, try to sync data
            const user = auth.currentUser;
            if (user) {
                checkUserProfile(auth, db, user);
            }
        } catch (error) {
            console.error('Error enabling network:', error);
        }
    });

    window.addEventListener('offline', async () => {
        isOnline = false;
        try {
            await disableNetwork(db);
            console.log('Network disabled due to offline status');
        } catch (error) {
            console.error('Error disabling network:', error);
        }
    });

    // Toggle forms
    showSignupLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.style.display = 'none';
        signupForm.style.display = 'block';
        loginError.textContent = '';
    });

    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        signupForm.style.display = 'none';
        loginForm.style.display = 'block';
        signupError.textContent = '';
    });

    // --- Authentication State Observer ---
    onAuthStateChanged(auth, async (user) => {
        console.log('Auth state changed:', user ? 'User logged in' : 'No user');
        if (user) {
            // Wait a bit for Firestore to be ready
            setTimeout(async () => {
                try {
                    await checkUserProfile(auth, db, user);
                } catch (error) {
                    console.error('Error in auth state change:', error);
                }
            }, 1000);
        }
    });

    // --- Login ---
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
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            console.log('Login successful:', userCredential.user.email);
            
            // After successful login, check user profile
            await checkUserProfile(auth, db, userCredential.user);
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

    // --- Signup ---
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
                    const newHouseholdRef = await addDoc(collection(db, 'households'), {
                        name: `${email.split('@')[0]}'s Household`,
                        createdAt: serverTimestamp(),
                        members: [user.uid]
                    });
                    finalHouseholdId = newHouseholdRef.id;
                    console.log('Created new household:', finalHouseholdId);
                } catch (error) {
                    console.error('Error creating household:', error);
                    throw error;
                }
            } else {
                console.log('Joining existing household:', householdId);
                try {
                    const householdRef = doc(db, 'households', householdId);
                    const householdDoc = await getDoc(householdRef);
                    
                    if (!householdDoc.exists()) {
                        throw new Error('Household ID not found');
                    }
                    
                    await updateDoc(householdRef, {
                        members: arrayUnion(user.uid)
                    });
                    console.log('Added user to existing household:', householdId);
                } catch (error) {
                    console.error('Error joining household:', error);
                    throw error;
                }
            }

            // Step 3: Create user profile
            console.log('Creating user profile...');
            try {
                await setDoc(doc(db, 'users', user.uid), {
                    email: user.email,
                    householdId: finalHouseholdId,
                    createdAt: serverTimestamp()
                });
                console.log('User profile created successfully');
                
                // Step 4: Redirect to dashboard
                console.log('Redirecting to dashboard...');
                window.location.href = 'dashboard.html';
            } catch (error) {
                console.error('Error creating user profile:', error);
                throw error;
            }

        } catch (error) {
            console.error('Signup error:', error);
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
                default:
                    signupError.textContent = error.message;
            }
        } finally {
            signupButton.disabled = false;
        }
    });
}