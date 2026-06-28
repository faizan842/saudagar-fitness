// 1. CONFIGURATION - Paste your Google Web App URL here
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyWE4h_ZqWeMccAr_IuQvwwIc_rRvAgufwD3LJ1rXkdE3bxmXQcYqncZT-ifFCHjvGO2A/exec";

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

// Compress image using canvas - keeps it small enough for Google Sheets
function compressImage(file, maxSize, quality) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                // Resize to maxSize x maxSize (keeping aspect ratio)
                let width = img.width;
                let height = img.height;
                if (width > height) {
                    if (width > maxSize) { height = height * maxSize / width; width = maxSize; }
                } else {
                    if (height > maxSize) { width = width * maxSize / height; height = maxSize; }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                // Convert to compressed JPEG
                const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(compressedDataUrl);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// Store the compressed photo data URL for the current form
let currentPhotoDataUrl = '';

// Function to handle Photo Preview
async function handlePhotoSelect(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('photoPreview');
    
    if (file) {
        // Compress to 150px max dimension, 0.5 quality JPEG (~5-15KB base64)
        const compressed = await compressImage(file, 150, 0.5);
        currentPhotoDataUrl = compressed;
        preview.innerHTML = `<img src="${compressed}" class="w-full h-full object-cover">`;
    }
}

// Bind both camera and gallery inputs to the handler
document.getElementById('mPhotoCamera').addEventListener('change', handlePhotoSelect);
document.getElementById('mPhotoGallery').addEventListener('change', handlePhotoSelect);

// Save members to localStorage as backup
function saveToLocalStorage() {
    localStorage.setItem('saudagar_members', JSON.stringify(members));
}

// Load members from localStorage
function loadFromLocalStorage() {
    const saved = localStorage.getItem('saudagar_members');
    if (saved) {
        try { return JSON.parse(saved); } catch(e) { return []; }
    }
    return [];
}

// SAVE MEMBER (To Google Sheets + Local)
async function saveMember(data) {
    const saveBtn = document.querySelector('button[type="submit"]');
    const originalText = saveBtn.innerText;

    // Show Loading State
    saveBtn.innerText = "Saving to Cloud...";
    saveBtn.disabled = true;
    saveBtn.style.opacity = "0.7";

    try {
        // Send to Google Sheets (fire-and-forget with no-cors)
        await fetch(SCRIPT_URL, {
            method: "POST",
            mode: "no-cors", 
            headers: { "Content-Type": "text/plain" },
            body: JSON.stringify(data)
        });
        
        // Locally add to the list so it shows up immediately
        members.push(data);
        saveToLocalStorage(); // Backup to localStorage
        updateCollections(data.plan, data.admissionFee);
        renderMembers();
        
        alert("✅ Member Saved in Saudagar Fitness Club!");
        closeModal();
        document.getElementById('gymForm').reset();
        document.getElementById('photoPreview').innerHTML = `<i class="fas fa-camera text-3xl text-emerald-400"></i>`;
        
    } catch (error) {
        console.error("Error saving data:", error);
        // Still save locally even if cloud fails
        members.push(data);
        saveToLocalStorage();
        updateCollections(data.plan, data.admissionFee);
        renderMembers();
        alert("⚠️ Cloud sync failed, but member saved locally!");
        closeModal();
        document.getElementById('gymForm').reset();
        document.getElementById('photoPreview').innerHTML = `<i class="fas fa-camera text-3xl text-emerald-400"></i>`;
    } finally {
        saveBtn.innerText = originalText;
        saveBtn.disabled = false;
        saveBtn.style.opacity = "1";
    }
}

// FETCH MEMBERS (From Google Sheets, fallback to localStorage)
async function fetchMembersFromSheet() {
    console.log("Fetching members...");
    try {
        const response = await fetch(SCRIPT_URL);
        if (!response.ok) throw new Error("HTTP " + response.status);
        const data = await response.json();
        members = data;
        saveToLocalStorage(); // Cache the cloud data locally
        renderMembers();
        // Recalculate totals
        members.forEach(m => updateCollections(m.plan, m.admissionFee));
        console.log("✅ Loaded from Google Sheets");
    } catch (e) {
        console.log("Cloud fetch failed, loading from local storage...", e.message);
        // Fallback: Load from localStorage
        members = loadFromLocalStorage();
        if (members.length > 0) {
            renderMembers();
            members.forEach(m => updateCollections(m.plan, m.admissionFee));
            console.log("✅ Loaded " + members.length + " members from local storage");
        } else {
            console.log("No local data found. Add your first member!");
        }
    }
}

// Update the money collection
function updateCollections(plan, admissionFee) {
    let amount = plan == "1" ? 500 : plan == "3" ? 1300 : 4500;
    let fee = parseInt(admissionFee) || 0;
    let total = amount + fee;
    
    const monthlyEl = document.getElementById('monthlyTotal');
    const yearlyEl = document.getElementById('yearlyTotal');
    
    let currentMonthly = parseInt(monthlyEl.innerText.replace('₹', '')) || 0;
    let currentYearly = parseInt(yearlyEl.innerText.replace('₹', '')) || 0;

    monthlyEl.innerText = `₹${currentMonthly + total}`;
    yearlyEl.innerText = `₹${currentYearly + total}`;
}

// Form Submit listener
document.getElementById('gymForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    // Use the pre-compressed photo, or a default placeholder
    const photoSrc = currentPhotoDataUrl || 'https://via.placeholder.com/100'; 
    const admissionChecked = document.getElementById('mAdmissionFee').checked;
    
    const memberData = {
        id: Date.now(),
        profilePic: photoSrc,
        name: document.getElementById('mName').value,
        phone: document.getElementById('mPhone').value,
        weight: document.getElementById('mWeight').value,
        height: document.getElementById('mHeight').value,
        joinDate: document.getElementById('mDate').value,
        plan: document.querySelector('input[name="plan"]:checked').value,
        admissionFee: admissionChecked ? 200 : 0,
        expDate: calculateExpiry(document.getElementById('mDate').value, document.querySelector('input[name="plan"]:checked').value)
    };

    saveMember(memberData);
    // Reset the stored photo
    currentPhotoDataUrl = '';
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

        const profileImg = m.profilePic && m.profilePic.length > 10 
            ? `<img src="${m.profilePic}" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-user text-2xl text-emerald-400\\'></i>'">`
            : `<i class="fas fa-user text-2xl text-emerald-400"></i>`;

        container.innerHTML += `
            <div class="member-card flex items-center gap-4 ${isWarning ? 'border-red-200 bg-red-50/30' : 'border-emerald-50'}">
                <div class="w-16 h-16 rounded-full overflow-hidden border-2 ${isWarning ? 'border-red-500' : 'border-emerald-500'} shadow-sm bg-emerald-100 flex items-center justify-center">
                    ${profileImg}
                </div>
                <div class="flex-1">
                    <h3 class="font-bold text-emerald-950 leading-tight">${m.name}</h3>
                    <p class="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Plan: ${m.plan} Mo</p>
                    <p class="text-xs ${isWarning ? 'text-red-600 font-bold' : 'text-emerald-600'}">Expires: ${m.expDate}</p>
                    ${isWarning ? '<span class="text-[9px] bg-red-600 text-white px-2 py-0.5 rounded-full uppercase font-bold tracking-wider mt-1 inline-block">15 Days Left</span>' : ''}
                </div>
                <div class="flex flex-col gap-2">
                    <a href="https://wa.me/${m.phone}?text=Hello ${m.name}, your membership at Saudagar Fitness Club expires on ${m.expDate}. Please renew soon!" 
                       class="w-10 h-10 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl flex items-center justify-center shadow-md active:scale-90 transition-transform">
                        <i class="fab fa-whatsapp"></i>
                    </a>
                    <button onclick="deleteMember(${m.id})" class="w-10 h-10 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl active:scale-90 transition-transform">
                        <i class="fas fa-trash-alt text-sm"></i>
                    </button>
                </div>
            </div>
        `;
    });
}

async function deleteMember(id) {
    if(confirm("Are you sure you want to remove this member?")) {
        members = members.filter(m => m.id !== id);
        saveToLocalStorage();
        renderMembers();
        
        try {
            await fetch(SCRIPT_URL, {
                method: "POST",
                mode: "no-cors",
                headers: { "Content-Type": "text/plain" },
                body: JSON.stringify({ action: "delete", id: id })
            });
            console.log("Deleted from Cloud successfully");
        } catch(e) {
            console.error("Could not delete from Cloud:", e);
        }
    }
}