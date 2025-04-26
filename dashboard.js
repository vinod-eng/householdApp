const userEmailSpan = document.getElementById('user-email');
const householdInfoSpan = document.getElementById('household-info');
const logoutButton = document.getElementById('logout-button');

// Kitchen elements
const addKitchenItemButton = document.getElementById('add-kitchen-item');
const kitchenItemDescInput = document.getElementById('kitchen-item-desc');
const kitchenItemQtyInput = document.getElementById('kitchen-item-qty');
const kitchenItemList = document.getElementById('kitchen-item-list');

// Bill elements
const addBillItemButton = document.getElementById('add-bill-item');
const billDescInput = document.getElementById('bill-desc');
const billAmountInput = document.getElementById('bill-amount');
const billItemList = document.getElementById('bill-item-list');

// Shopping List elements
const addShoppingItemButton = document.getElementById('add-shopping-item');
const shoppingItemDescInput = document.getElementById('shopping-item-desc');
const shoppingItemQtyInput = document.getElementById('shopping-item-qty');
const shoppingItemList = document.getElementById('shopping-item-list');

let currentUser = null;
let householdId = null;
let householdListener = null; // To detach listener later

// --- Tab Switching Logic ---
function openTab(evt, tabName) {
  let i, tabcontent, tablinks;
  tabcontent = document.getElementsByClassName("tab-content");
  for (i = 0; i < tabcontent.length; i++) {
    tabcontent[i].style.display = "none";
  }
  tablinks = document.getElementsByClassName("tab-link");
  for (i = 0; i < tablinks.length; i++) {
    tablinks[i].className = tablinks[i].className.replace(" active", "");
  }
  document.getElementById(tabName).style.display = "block";
  evt.currentTarget.className += " active";
}

// --- Authentication Check ---
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        userEmailSpan.textContent = user.email;

        // Get household ID from user's profile in Firestore
        const userDocRef = db.collection('users').doc(user.uid);
        const userDoc = await userDocRef.get();

        if (userDoc.exists && userDoc.data().householdId) {
            householdId = userDoc.data().householdId;
            householdInfoSpan.textContent = `ID: ${householdId}`; // Display household ID
            // Start listening for data changes for this household
            listenForHouseholdData(householdId);
        } else {
            // User logged in but no household ID found - critical issue
            console.error("User is logged in but household ID is missing!");
            householdInfoSpan.textContent = "Error: Household not found!";
             alert("Error: Could not find your household information. Please sign up again or contact support.");
            // Maybe force logout or redirect to a setup page
             auth.signOut(); // Force logout as something is wrong
        }

    } else {
        // No user logged in, redirect to login page
        console.log('No user logged in, redirecting to index.html');
        window.location.href = 'index.html';
    }
});

// --- Logout ---
logoutButton.addEventListener('click', () => {
    auth.signOut().then(() => {
        console.log('User signed out');
        // Listener will redirect via onAuthStateChanged
    }).catch((error) => {
        console.error('Sign out error:', error);
    });
});


// --- Firestore Data Listener ---
function listenForHouseholdData(hId) {
    if (!hId) return;

    // Detach previous listener if exists
    if (householdListener) householdListener();

    // Listen for Kitchen Items (Real-time)
    db.collection('kitchenItems')
      .where('householdId', '==', hId)
      .orderBy('createdAt', 'desc') // Optional: order by time added
      .onSnapshot(snapshot => {
          renderList(kitchenItemList, snapshot.docs, 'kitchen');
      }, error => {
          console.error("Error listening to kitchen items:", error);
      });

    // Listen for Bills (Real-time)
     db.collection('bills')
      .where('householdId', '==', hId)
      .orderBy('createdAt', 'desc')
      .onSnapshot(snapshot => {
          renderList(billItemList, snapshot.docs, 'bill');
      }, error => {
          console.error("Error listening to bills:", error);
      });

    // Listen for Shopping List Items (Real-time)
     db.collection('shoppingListItems')
      .where('householdId', '==', hId)
      .orderBy('createdAt', 'desc')
      .onSnapshot(snapshot => {
          renderList(shoppingItemList, snapshot.docs, 'shopping');
      }, error => {
          console.error("Error listening to shopping list:", error);
      });

      // Store a reference to the listeners if needed (e.g., to detach multiple)
      // For simplicity here, we just overwrite householdListener
      // In a complex app, manage listeners more carefully
}

// --- Render List Function ---
function renderList(listElement, docs, type) {
    listElement.innerHTML = ''; // Clear current list
    if (docs.length === 0) {
        listElement.innerHTML = '<li>No items yet.</li>';
        return;
    }

    docs.forEach(doc => {
        const item = doc.data();
        const li = document.createElement('li');
        let content = '';

        // Customize display based on type
        if (type === 'kitchen') {
            content = `${item.description} - Quantity: ${item.quantity || 1}`;
        } else if (type === 'bill') {
            content = `${item.description} - Amount: $${item.amount ? item.amount.toFixed(2) : 'N/A'}`;
        } else if (type === 'shopping') {
             content = `${item.description} - Quantity: ${item.quantity || 1}`;
        }

        li.textContent = content;

         // Add a delete button (Example)
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'X';
        deleteBtn.classList.add('delete-button'); // Add class for styling
        deleteBtn.onclick = () => deleteItem(doc.id, type); // Pass doc ID and type
        li.appendChild(deleteBtn);


        listElement.appendChild(li);
    });
}

// --- Add Item Functions ---
async function addItem(collectionName, data) {
     if (!currentUser || !householdId) {
        console.error("Cannot add item: User or Household ID missing.");
        return;
    }
    try {
        await db.collection(collectionName).add({
            ...data, // Spread the item data (desc, qty/amount)
            householdId: householdId,
            userId: currentUser.uid, // Track who added it
            createdAt: firebase.firestore.FieldValue.serverTimestamp() // Timestamp
        });
        console.log(`${collectionName} item added`);
    } catch (error) {
        console.error(`Error adding ${collectionName} item:`, error);
    }
}

// Event listeners for adding items
addKitchenItemButton.addEventListener('click', () => {
    const description = kitchenItemDescInput.value.trim();
    const quantity = parseInt(kitchenItemQtyInput.value) || 1;
    if (description) {
        addItem('kitchenItems', { description, quantity });
        kitchenItemDescInput.value = ''; // Clear input
        kitchenItemQtyInput.value = '1';
    }
});

addBillItemButton.addEventListener('click', () => {
    const description = billDescInput.value.trim();
    const amount = parseFloat(billAmountInput.value);
     if (description && !isNaN(amount) && amount > 0) {
         addItem('bills', { description, amount });
         billDescInput.value = '';
         billAmountInput.value = '';
     } else {
         alert("Please enter a valid description and amount for the bill.");
     }
});

 addShoppingItemButton.addEventListener('click', () => {
    const description = shoppingItemDescInput.value.trim();
    const quantity = parseInt(shoppingItemQtyInput.value) || 1;
    if (description) {
        addItem('shoppingListItems', { description, quantity });
        shoppingItemDescInput.value = '';
        shoppingItemQtyInput.value = '1';
    }
});

// --- Delete Item Function ---
async function deleteItem(docId, type) {
    if (!currentUser || !householdId) {
        console.error("Cannot delete item: User or Household ID missing.");
        return;
    }
    let collectionName = '';
    if (type === 'kitchen') collectionName = 'kitchenItems';
    else if (type === 'bill') collectionName = 'bills';
    else if (type === 'shopping') collectionName = 'shoppingListItems';
    else return; // Unknown type

    if (!docId) {
        console.error("Cannot delete item: Document ID is missing.");
        return;
    }


    if (confirm(`Are you sure you want to delete this ${type} item?`)) {
        try {
            await db.collection(collectionName).doc(docId).delete();
            console.log(`${type} item deleted:`, docId);
        } catch (error) {
            console.error(`Error deleting ${type} item:`, error);
             alert(`Failed to delete the ${type} item. Please try again.`);
        }
    }
}