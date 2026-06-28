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
        updateStats();
        
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
        updateStats();
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
        updateStats();
        // Recalculate totals
        members.forEach(m => updateCollections(m.plan, m.admissionFee));
        console.log("✅ Loaded from Google Sheets");
    } catch (e) {
        console.log("Cloud fetch failed, loading from local storage...", e.message);
        // Fallback: Load from localStorage
        members = loadFromLocalStorage();
        if (members.length > 0) {
            renderMembers();
            updateStats();
            members.forEach(m => updateCollections(m.plan, m.admissionFee));
            console.log("✅ Loaded " + members.length + " members from local storage");
        } else {
            console.log("No local data found. Add your first member!");
        }
    }
}

// Update the money collection
function updateCollections(plan, admissionFee) {
    let amount = plan == "1" ? 500 : plan == "3" ? 1300 : plan == "6" ? 2500 : 4500;
    let fee = parseInt(admissionFee) || 0;
    let total = amount + fee;
    
    const monthlyEl = document.getElementById('monthlyTotal');
    const yearlyEl = document.getElementById('yearlyTotal');
    
    let currentMonthly = parseInt(monthlyEl.innerText.replace('₹', '')) || 0;
    let currentYearly = parseInt(yearlyEl.innerText.replace('₹', '')) || 0;

    monthlyEl.innerText = `₹${currentMonthly + total}`;
    yearlyEl.innerText = `₹${currentYearly + total}`;
}

// Update member count stats
function updateStats() {
    const today = new Date();
    const expiringSoon = members.filter(m => {
        const diffDays = Math.ceil((new Date(m.expDate) - today) / (1000 * 60 * 60 * 24));
        return diffDays <= 15 && diffDays > 0;
    }).length;

    document.getElementById('memberCount').innerText = members.length;
    document.getElementById('expiringCount').innerText = expiringSoon;
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

// Helper: get plan label text
function getPlanLabel(plan) {
    const labels = { "1": "1 month", "3": "3 months", "6": "6 months", "12": "1 year" };
    return labels[plan] || `${plan} month`;
}

// Helper: format date nicely
function formatDisplayDate(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Helper: normalize phone number for wa.me link
function normalizePhone(phone) {
    let digits = String(phone).replace(/\D/g, '');
    if (digits.length === 10) digits = '91' + digits;
    if (digits.startsWith('0') && digits.length === 11) digits = '91' + digits.slice(1);
    return digits;
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
        const planLabel = getPlanLabel(m.plan);

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
                    <p class="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">${planLabel}</p>
                    ${m.admissionFee ? `<p class="text-[10px] text-amber-600 font-bold">Admission: ₹${m.admissionFee}</p>` : ''}
                    <p class="text-xs ${isWarning ? 'text-red-600 font-bold' : 'text-emerald-600'}">Expires: ${formatDisplayDate(m.expDate)}</p>
                    ${isWarning ? '<span class="text-[9px] bg-red-600 text-white px-2 py-0.5 rounded-full uppercase font-bold tracking-wider mt-1 inline-block">15 Days Left</span>' : ''}
                </div>
                <div class="flex flex-col gap-2">
                    <button onclick="showMembershipCard(${m.id})" class="w-10 h-10 bg-emerald-100 hover:bg-emerald-200 text-emerald-600 rounded-xl flex items-center justify-center shadow-sm active:scale-90 transition-all" title="View Card">
                        <i class="fas fa-id-card"></i>
                    </button>
                    <button onclick="sendPassToMember(${m.id})"
                       class="w-10 h-10 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl flex items-center justify-center shadow-md active:scale-90 transition-all" title="Send Gym Pass">
                        <i class="fab fa-whatsapp"></i>
                    </button>
                    <button onclick="deleteMember(${m.id})" class="w-10 h-10 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl active:scale-90 transition-all" title="Delete">
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
        updateStats();
        
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

// ═══════════════════════════════════════════════════════
//  MEMBERSHIP CARD GENERATION (Canvas-based)
// ═══════════════════════════════════════════════════════

const GYM_PHONE = "+91-8888946574";
const GYM_OWNER = "Faizan Saudagar";

function loadImage(src) {
    return new Promise((resolve, reject) => {
        if (!src) return reject(new Error('No image source'));
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = src;
    });
}

async function generateCardImage(member) {
    const W = 600, H = 320;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    // Decorative circle
    ctx.beginPath();
    ctx.arc(W + 30, H / 2 + 30, 140, 0, Math.PI * 2);
    ctx.fillStyle = '#10b981';
    ctx.fill();

    // Title
    ctx.fillStyle = '#111111';
    ctx.font = '900 28px Outfit, Inter, Arial, sans-serif';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText('Saudagar Fitness Club', 28, 22);

    // Phone/Owner
    ctx.fillStyle = '#555555';
    ctx.font = '400 14px Outfit, Inter, Arial, sans-serif';
    ctx.fillText(`${GYM_PHONE} (${GYM_OWNER})`, 28, 56);

    // Logo circle
    const logoX = W - 60, logoY = 42;
    ctx.beginPath();
    ctx.arc(logoX, logoY, 26, 0, Math.PI * 2);
    ctx.fillStyle = '#ecfdf5';
    ctx.fill();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#059669';
    ctx.font = '900 16px Outfit, Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SF', logoX, logoY);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Decorative wave
    const waveY = 82;
    const grad = ctx.createLinearGradient(20, waveY, W - 20, waveY);
    grad.addColorStop(0, '#10b981');
    grad.addColorStop(0.5, '#34d399');
    grad.addColorStop(1, '#10b981');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(W / 2, waveY + 12, (W - 40) * 0.55, 12, 0, Math.PI, 0);
    ctx.fill();

    // Photo circle
    const photoX = 100, photoY = 200, photoR = 68;
    ctx.beginPath();
    ctx.arc(photoX, photoY, photoR + 4, 0, Math.PI * 2);
    ctx.fillStyle = '#10b981';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(photoX, photoY, photoR, 0, Math.PI * 2);
    ctx.fillStyle = '#f0fdf4';
    ctx.fill();

    // Draw member photo
    try {
        const pic = member.profilePic;
        if (pic && pic.length > 10) {
            const img = await loadImage(pic);
            ctx.save();
            ctx.beginPath();
            ctx.arc(photoX, photoY, photoR, 0, Math.PI * 2);
            ctx.clip();
            const ratio = img.width / img.height;
            let dw, dh;
            if (ratio > 1) { dh = photoR * 2; dw = dh * ratio; }
            else { dw = photoR * 2; dh = dw / ratio; }
            ctx.drawImage(img, photoX - dw / 2, photoY - dh / 2, dw, dh);
            ctx.restore();
        }
    } catch (e) {
        ctx.fillStyle = '#059669';
        ctx.font = '36px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('👤', photoX, photoY);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
    }

    // Member details
    const detailX = 198;
    let detailY = 118;
    const lineH = 33;
    const details = [
        ['Name: ', member.name || ''],
        ['Plan: ', getPlanLabel(member.plan)],
        ['Start: ', formatDisplayDate(member.joinDate)],
        ['Expires: ', formatDisplayDate(member.expDate)]
    ];

    details.forEach(([label, value]) => {
        ctx.fillStyle = '#111111';
        ctx.font = '800 15px Outfit, Inter, Arial, sans-serif';
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        const lw = ctx.measureText(label).width;
        ctx.fillText(label, detailX, detailY);
        ctx.font = '400 15px Outfit, Inter, Arial, sans-serif';
        ctx.fillText(value, detailX + lw, detailY);
        detailY += lineH;
    });

    // Border
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

    return canvas.toDataURL('image/jpeg', 0.92);
}

// ═══════════════════════════════════════════════════════
//  CARD MODAL & WHATSAPP SHARING
// ═══════════════════════════════════════════════════════

let activeCardMember = null;
let activeCardImageUrl = null;

function closeCardModal() {
    document.getElementById('cardModal').classList.add('hidden');
}

function closeWhatsAppInstructionModal() {
    document.getElementById('whatsappInstructionModal').classList.add('hidden');
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => t.classList.add('hidden'), 4000);
}

async function showMembershipCard(id) {
    const member = members.find(m => m.id === id);
    if (!member) return;

    activeCardMember = member;
    const preview = document.getElementById('cardPreviewArea');
    document.getElementById('cardModal').classList.remove('hidden');

    preview.innerHTML = '<p class="text-center text-slate-400 py-8">Generating card...</p>';
    try {
        activeCardImageUrl = await generateCardImage(member);
        preview.innerHTML = `<img src="${activeCardImageUrl}" class="w-full rounded-xl" alt="Membership Card">`;
    } catch (err) {
        console.error(err);
        preview.innerHTML = '<p class="text-center text-red-500 py-8">Could not generate card. Try again.</p>';
    }
}

async function imageToPngBlob(dataUrl) {
    const img = await loadImage(dataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext('2d').drawImage(img, 0, 0);
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

async function shareCardOnWhatsApp() {
    if (!activeCardMember) return;
    showToast('Preparing gym pass card...');

    try {
        if (!activeCardImageUrl) {
            activeCardImageUrl = await generateCardImage(activeCardMember);
        }
        const pngBlob = await imageToPngBlob(activeCardImageUrl);
        await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': pngBlob })
        ]);
        showToast('✅ Card copied! Opening steps...');
        openWhatsAppInstructionModal(activeCardMember);
    } catch (err) {
        console.error('Clipboard copy failed:', err);
        showToast('⚠️ Could not copy card. Opening WhatsApp...');
        openWhatsAppInstructionModal(activeCardMember);
    }
}

async function sendPassToMember(id) {
    const member = members.find(m => m.id === id);
    if (!member) return;

    activeCardMember = member;
    showToast('Preparing gym pass card...');

    try {
        activeCardImageUrl = await generateCardImage(member);
        const pngBlob = await imageToPngBlob(activeCardImageUrl);
        await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': pngBlob })
        ]);
        showToast('✅ Card copied! Opening steps...');
        openWhatsAppInstructionModal(member);
    } catch (err) {
        console.error('Clipboard copy failed:', err);
        showToast('⚠️ Could not copy card. Opening WhatsApp...');
        openWhatsAppInstructionModal(member);
    }
}

function openWhatsAppInstructionModal(member) {
    const modal = document.getElementById('whatsappInstructionModal');
    const directBtn = document.getElementById('whatsappDirectLink');
    
    const start = formatDisplayDate(member.joinDate);
    const end = formatDisplayDate(member.expDate);
    const message = `Hi ${member.name}! 🙌 Your gym pass is here! 🎉 You can use it to access Saudagar Fitness Club from ${start} to ${end}`;

    directBtn.onclick = () => {
        const p = normalizePhone(member.phone);
        const url = `https://wa.me/${p}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
        closeWhatsAppInstructionModal();
        closeCardModal();
    };

    modal.classList.remove('hidden');
}