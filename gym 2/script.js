// 1. CONFIGURATION - Paste your Google Web App URL here
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzlUv97inWJyk7VxjlLfW3OW4-S3LKQQEfwrPqwqSA-QEE6rNM9d0YKdAWtBnGm_o8/exec";

// Data Logic
let members = [];

// Load data from Google Sheets when the app opens
window.onload = () => {
    fetchMembersFromSheet();
};

// Auth Logic
function handleLogin() {
    const pin = document.getElementById('pinInput').value;
    if(pin === "1234") { 
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('appContent').classList.remove('hidden');
    } else {
        alert("Wrong PIN! Try 1234");
    }
}

function handleLogout() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('appContent').classList.add('hidden');
    document.getElementById('pinInput').value = "";
}

function openModal() { document.getElementById('memberModal').classList.remove('hidden'); }
function closeModal() { document.getElementById('memberModal').classList.add('hidden'); }

// Function to handle Photo Preview
document.getElementById('mPhoto').addEventListener('change', function(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('photoPreview');
    
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            preview.innerHTML = `<img src="${event.target.result}" class="w-full h-full object-cover">`;
        }
        reader.readAsDataURL(file);
    }
});

// SAVE MEMBER (To Google Sheets + Local)
async function saveMember(data) {
    const saveBtn = document.querySelector('button[type="submit"]');
    const originalText = saveBtn.innerText;

    // Show Loading State
    saveBtn.innerText = "Saving to Cloud...";
    saveBtn.disabled = true;
    saveBtn.style.opacity = "0.7";

    try {
        await fetch(SCRIPT_URL, {
            method: "POST",
            mode: "no-cors", 
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        
        // Locally add to the list so it shows up immediately
        members.push(data);
        updateCollections(data.plan);
        renderMembers();
        
        alert("✅ Member Saved in Saudagar Fitness Club!");
        closeModal();
        document.getElementById('gymForm').reset();
        document.getElementById('photoPreview').innerHTML = `<i class="fas fa-camera text-3xl text-emerald-400"></i>`;
        
    } catch (error) {
        console.error("Error saving data:", error);
        alert("⚠️ Connection Error. Saved on screen only.");
    } finally {
        saveBtn.innerText = originalText;
        saveBtn.disabled = false;
        saveBtn.style.opacity = "1";
    }
}

// FETCH MEMBERS (To see previously added members)
async function fetchMembersFromSheet() {
    console.log("Fetching members...");
    try {
        const response = await fetch(SCRIPT_URL); // Note: doGet() must be in your Google Script
        const data = await response.json();
        members = data;
        renderMembers();
        // Recalculate totals
        members.forEach(m => updateCollections(m.plan));
    } catch (e) {
        console.log("Initial fetch failed. Add your first member!");
    }
}

// Update the money collection
function updateCollections(plan) {
    let amount = plan == "1" ? 500 : plan == "3" ? 1300 : 4500;
    const monthlyEl = document.getElementById('monthlyTotal');
    const yearlyEl = document.getElementById('yearlyTotal');
    
    let currentMonthly = parseInt(monthlyEl.innerText.replace('₹', '')) || 0;
    let currentYearly = parseInt(yearlyEl.innerText.replace('₹', '')) || 0;

    monthlyEl.innerText = `₹${currentMonthly + amount}`;
    yearlyEl.innerText = `₹${currentYearly + amount}`;
}

// Form Submit listener
document.getElementById('gymForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const photoElement = document.querySelector('#photoPreview img');
    const photoSrc = photoElement ? photoElement.src : 'https://via.placeholder.com/100'; 
    
    const memberData = {
        id: Date.now(),
        profilePic: photoSrc,
        name: document.getElementById('mName').value,
        phone: document.getElementById('mPhone').value,
        weight: document.getElementById('mWeight').value,
        height: document.getElementById('mHeight').value,
        joinDate: document.getElementById('mDate').value,
        plan: document.querySelector('input[name="plan"]:checked').value,
        expDate: calculateExpiry(document.getElementById('mDate').value, document.querySelector('input[name="plan"]:checked').value)
    };

    saveMember(memberData);
});

function calculateExpiry(date, months) {
    let d = new Date(date);
    d.setMonth(d.getMonth() + parseInt(months));
    return d.toDateString();
}

function renderMembers() {
    const container = document.getElementById('memberList');
    container.innerHTML = '';
    
    members.forEach(m => {
        // Expiry Warning logic (15 days)
        const today = new Date();
        const expDateObj = new Date(m.expDate);
        const diffDays = Math.ceil((expDateObj - today) / (1000 * 60 * 60 * 24));
        const isWarning = diffDays <= 15 && diffDays > 0;

        container.innerHTML += `
            <div class="bg-white p-4 rounded-[2rem] shadow-sm border ${isWarning ? 'border-red-200 bg-red-50/30' : 'border-emerald-50'} flex items-center gap-4 animate-in">
                <div class="w-16 h-16 rounded-full overflow-hidden border-2 ${isWarning ? 'border-red-500' : 'border-emerald-500'} shadow-sm bg-emerald-100">
                    <img src="${m.profilePic}" class="w-full h-full object-cover">
                </div>
                <div class="flex-1">
                    <h3 class="font-bold text-emerald-900 leading-tight">${m.name}</h3>
                    <p class="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Plan: ${m.plan} Mo</p>
                    <p class="text-xs ${isWarning ? 'text-red-600 font-bold' : 'text-emerald-600'}">Expires: ${m.expDate}</p>
                    ${isWarning ? '<span class="text-[9px] bg-red-600 text-white px-2 py-0.5 rounded-full uppercase">15 Days Left</span>' : ''}
                </div>
                <div class="flex flex-col gap-2">
                    <a href="https://wa.me/${m.phone}?text=Hello ${m.name}, your membership at Saudagar Fitness Club expires on ${m.expDate}. Please renew soon!" 
                       class="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-md">
                        <i class="fab fa-whatsapp"></i>
                    </a>
                    <button onclick="deleteMember(${m.id})" class="w-10 h-10 bg-red-50 text-red-400 rounded-xl">
                        <i class="fas fa-trash-alt text-sm"></i>
                    </button>
                </div>
            </div>
        `;
    });
}

function deleteMember(id) {
    if(confirm("Are you sure you want to remove this member?")) {
        members = members.filter(m => m.id !== id);
        renderMembers();
        // Note: Real deletion from Google Sheets requires a 'DELETE' request setup in Apps Script.
    }
}