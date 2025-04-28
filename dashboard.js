import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { 
    getFirestore, 
    collection, 
    addDoc, 
    deleteDoc,
    updateDoc,
    doc,
    getDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { 
    getStorage, 
    ref, 
    uploadBytes, 
    getDownloadURL,
    deleteObject 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAfoQ5NEw8Cbl5Lp51FdNgDDHdV_eP01pU",
    authDomain: "householdapp-b358d.firebaseapp.com",
    projectId: "householdapp-b358d",
    storageBucket: "householdapp-b358d.firebasestorage.app",
    messagingSenderId: "88859917799",
    appId: "1:88859917799:web:a4f489b8e274584b0f1142",
    measurementId: "G-5FCLN35ZE6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Global variables
let currentUser = null;
let currentHouseholdId = null;

// DOM Elements
const userEmailSpan = document.getElementById('user-email');
const householdInfoSpan = document.getElementById('household-info');
const logoutButton = document.getElementById('logout-button');

// Tab switching function
window.openTab = function(evt, tabName) {
    const tabContents = document.getElementsByClassName('tab-content');
    for (let content of tabContents) {
        content.style.display = 'none';
    }
    
    const tabLinks = document.getElementsByClassName('tab-link');
    for (let link of tabLinks) {
        link.classList.remove('active');
    }
    
    document.getElementById(tabName).style.display = 'block';
    evt.currentTarget.classList.add('active');
};

// Helper function to get user's household ID
async function getUserHouseholdId(userId) {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
            return userDoc.data().householdId;
        }
        throw new Error('User document not found');
    } catch (error) {
        console.error('Error getting household ID:', error);
        throw error;
    }
}

// Helper function to format date
function formatDate(date) {
    return new Date(date).toLocaleDateString();
}

// Helper function to handle image upload
async function uploadImage(file, itemId) {
    if (!file) return null;
    
    const fileRef = ref(storage, `households/${currentHouseholdId}/items/${itemId}/${file.name}`);
    await uploadBytes(fileRef, file);
    return await getDownloadURL(fileRef);
}

// Helper function to delete image
async function deleteImage(imageUrl) {
    if (!imageUrl) return;
    try {
        const imageRef = ref(storage, imageUrl);
        await deleteObject(imageRef);
    } catch (error) {
        console.error('Error deleting image:', error);
    }
}

// Render functions for different item types
function renderKitchenItem(doc) {
    const item = doc.data();
    const li = document.createElement('li');
    
    const createdByUser = item.createdByEmail || 'Unknown user';
    const createdDate = item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleString() : 'Unknown date';
    
    li.innerHTML = `
        <div class="item-content">
            ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${item.description}" class="item-image">` : ''}
            <div class="item-details">
                <div class="item-description">${item.description}</div>
                <div class="item-quantity">Quantity: ${item.quantity}</div>
                <div class="item-meta">Added by ${createdByUser} on ${createdDate}</div>
            </div>
        </div>
        <button class="delete-button" data-id="${doc.id}" data-image="${item.imageUrl || ''}">Delete</button>
    `;
    
    return li;
}

function renderShoppingItem(doc) {
    const item = doc.data();
    const li = document.createElement('li');
    
    const createdByUser = item.createdByEmail || 'Unknown user';
    const createdDate = item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleString() : 'Unknown date';
    
    li.innerHTML = `
        <div class="item-content">
            ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${item.description}" class="item-image">` : ''}
            <div class="item-details">
                <div class="item-description">${item.description}</div>
                <div class="item-quantity">Quantity: ${item.quantity}</div>
                <div class="item-meta">Added by ${createdByUser} on ${createdDate}</div>
            </div>
        </div>
        <button class="delete-button" data-id="${doc.id}" data-image="${item.imageUrl || ''}">Delete</button>
    `;
    
    return li;
}

function renderBillItem(doc) {
    const item = doc.data();
    const li = document.createElement('li');
    
    const createdByUser = item.createdByEmail || 'Unknown user';
    const createdDate = item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleString() : 'Unknown date';
    
    li.innerHTML = `
        <div class="item-content">
            <div class="item-details">
                <div class="item-description">${item.description}</div>
                <div class="item-amount">Amount: $${parseFloat(item.amount).toFixed(2)}</div>
                <div class="item-due-date">Due: ${formatDate(item.dueDate)}</div>
                <div class="item-meta">Added by ${createdByUser} on ${createdDate}</div>
            </div>
        </div>
        <button class="delete-button" data-id="${doc.id}">Delete</button>
    `;
    
    return li;
}

// Setup real-time listeners for each collection
function setupKitchenListener() {
    const q = query(
        collection(db, 'kitchenItems'),
        where('householdId', '==', currentHouseholdId)
    );
    
    return onSnapshot(q, (snapshot) => {
        const list = document.getElementById('kitchen-item-list');
        list.innerHTML = '';
        
        if (snapshot.empty) {
            list.innerHTML = '<li>No items in kitchen</li>';
            return;
        }
        
        // Sort the documents in memory instead of in the query
        const sortedDocs = snapshot.docs.sort((a, b) => {
            const timeA = a.data().createdAt?.seconds || 0;
            const timeB = b.data().createdAt?.seconds || 0;
            return timeB - timeA;
        });
        
        sortedDocs.forEach(doc => {
            list.appendChild(renderKitchenItem(doc));
        });
    });
}

function setupShoppingListener() {
    const q = query(
        collection(db, 'shoppingItems'),
        where('householdId', '==', currentHouseholdId)
    );
    
    return onSnapshot(q, (snapshot) => {
        const list = document.getElementById('shopping-item-list');
        list.innerHTML = '';
        
        if (snapshot.empty) {
            list.innerHTML = '<li>No items in shopping list</li>';
            return;
        }
        
        // Sort the documents in memory
        const sortedDocs = snapshot.docs.sort((a, b) => {
            const timeA = a.data().createdAt?.seconds || 0;
            const timeB = b.data().createdAt?.seconds || 0;
            return timeB - timeA;
        });
        
        sortedDocs.forEach(doc => {
            list.appendChild(renderShoppingItem(doc));
        });
    });
}

function setupBillsListener() {
    const q = query(
        collection(db, 'bills'),
        where('householdId', '==', currentHouseholdId)
    );
    
    return onSnapshot(q, (snapshot) => {
        const list = document.getElementById('bill-item-list');
        list.innerHTML = '';
        
        if (snapshot.empty) {
            list.innerHTML = '<li>No bills</li>';
            return;
        }
        
        // Sort the documents in memory by due date
        const sortedDocs = snapshot.docs.sort((a, b) => {
            const dateA = new Date(a.data().dueDate);
            const dateB = new Date(b.data().dueDate);
            return dateA - dateB;
        });
        
        sortedDocs.forEach(doc => {
            list.appendChild(renderBillItem(doc));
        });
    });
}

// Add item functions
async function addKitchenItem(description, quantity, imageFile) {
    try {
        const docRef = await addDoc(collection(db, 'kitchenItems'), {
            description,
            quantity: parseInt(quantity),
            householdId: currentHouseholdId,
            createdAt: serverTimestamp(),
            createdBy: currentUser.uid,
            createdByEmail: currentUser.email
        });
        
        if (imageFile) {
            const imageUrl = await uploadImage(imageFile, docRef.id);
            await updateDoc(docRef, { imageUrl });
        }
    } catch (error) {
        console.error('Error adding kitchen item:', error);
        alert('Failed to add item');
    }
}

async function addShoppingItem(description, quantity, imageFile) {
    try {
        const docRef = await addDoc(collection(db, 'shoppingItems'), {
            description,
            quantity: parseInt(quantity),
            householdId: currentHouseholdId,
            createdAt: serverTimestamp(),
            createdBy: currentUser.uid,
            createdByEmail: currentUser.email
        });
        
        if (imageFile) {
            const imageUrl = await uploadImage(imageFile, docRef.id);
            await updateDoc(docRef, { imageUrl });
        }
    } catch (error) {
        console.error('Error adding shopping item:', error);
        alert('Failed to add item');
    }
}

async function addBillItem(description, amount, dueDate) {
    try {
        await addDoc(collection(db, 'bills'), {
            description,
            amount: parseFloat(amount),
            dueDate,
            householdId: currentHouseholdId,
            createdAt: serverTimestamp(),
            createdBy: currentUser.uid,
            createdByEmail: currentUser.email
        });
    } catch (error) {
        console.error('Error adding bill:', error);
        alert('Failed to add bill');
    }
}

// Delete item functions
async function deleteItem(id, collection, imageUrl) {
    try {
        if (imageUrl) {
            await deleteImage(imageUrl);
        }
        await deleteDoc(doc(db, collection, id));
    } catch (error) {
        console.error('Error deleting item:', error);
        alert('Failed to delete item');
    }
}

// Event Listeners
document.getElementById('add-kitchen-item').addEventListener('click', () => {
    const description = document.getElementById('kitchen-item-desc').value.trim();
    const quantity = document.getElementById('kitchen-item-qty').value;
    const imageFile = document.getElementById('kitchen-item-image').files[0];
    
    if (description) {
        addKitchenItem(description, quantity, imageFile);
        document.getElementById('kitchen-item-desc').value = '';
        document.getElementById('kitchen-item-qty').value = '1';
        document.getElementById('kitchen-item-image').value = '';
    }
});

document.getElementById('add-shopping-item').addEventListener('click', () => {
    const description = document.getElementById('shopping-item-desc').value.trim();
    const quantity = document.getElementById('shopping-item-qty').value;
    const imageFile = document.getElementById('shopping-item-image').files[0];
    
    if (description) {
        addShoppingItem(description, quantity, imageFile);
        document.getElementById('shopping-item-desc').value = '';
        document.getElementById('shopping-item-qty').value = '1';
        document.getElementById('shopping-item-image').value = '';
    }
});

document.getElementById('add-bill-item').addEventListener('click', () => {
    const description = document.getElementById('bill-desc').value.trim();
    const amount = document.getElementById('bill-amount').value;
    const dueDate = document.getElementById('bill-due-date').value;
    
    if (description && amount && dueDate) {
        addBillItem(description, amount, dueDate);
        document.getElementById('bill-desc').value = '';
        document.getElementById('bill-amount').value = '';
        document.getElementById('bill-due-date').value = '';
    }
});

// Delete button event listeners
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('delete-button')) {
        const id = e.target.dataset.id;
        const imageUrl = e.target.dataset.image;
        
        if (e.target.closest('#kitchen-item-list')) {
            deleteItem(id, 'kitchenItems', imageUrl);
        } else if (e.target.closest('#shopping-item-list')) {
            deleteItem(id, 'shoppingItems', imageUrl);
        } else if (e.target.closest('#bill-item-list')) {
            deleteItem(id, 'bills');
        }
    }
});

// Logout handler
logoutButton.addEventListener('click', async () => {
    try {
        await signOut(auth);
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Error signing out:', error);
    }
});

// Authentication state observer
auth.onAuthStateChanged(async (user) => {
    if (user) {
        try {
            currentUser = user;
            userEmailSpan.textContent = user.email;
            
            // Get user's household ID
            currentHouseholdId = await getUserHouseholdId(user.uid);
            householdInfoSpan.textContent = `Household: ${currentHouseholdId}`;
            
            // Setup real-time listeners
            setupKitchenListener();
            setupShoppingListener();
            setupBillsListener();
        } catch (error) {
            console.error('Error setting up dashboard:', error);
            alert('Error loading your household data. Please try logging in again.');
            await signOut(auth);
            window.location.href = 'index.html';
        }
    } else {
        window.location.href = 'index.html';
    }
});