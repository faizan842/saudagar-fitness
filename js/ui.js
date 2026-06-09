import { state } from './state.js';
import { getPlanLabel, formatDisplayDate } from './utils.js';
import { loadPhotoLocally } from './storage.js';
import { generateCardImage } from './card.js';
import { ADMISSION_FEE } from './config.js';

export function handleLogin() {
    const pin = document.getElementById('pinInput').value;
    if (pin === "1234") {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('appContent').classList.remove('hidden');
    } else {
        alert("Wrong PIN! Try 1234");
    }
}

export function handleLogout() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('appContent').classList.add('hidden');
    document.getElementById('pinInput').value = "";
}

export function openModal() { document.getElementById('memberModal').classList.remove('hidden'); }
export function closeModal() { document.getElementById('memberModal').classList.add('hidden'); }
export function closeCardModal() { document.getElementById('cardModal').classList.add('hidden'); }

export function switchTab(tab) {
    const isMembers = tab === 'members';
    document.getElementById('membersSection').classList.toggle('hidden', !isMembers);
    document.getElementById('gallerySection').classList.toggle('hidden', isMembers);
    document.getElementById('tabMembers').className = `tab-btn flex-1 py-3 rounded-xl font-bold text-sm ${isMembers ? 'bg-emerald-600 text-white' : 'text-emerald-700'}`;
    document.getElementById('tabGallery').className = `tab-btn flex-1 py-3 rounded-xl font-bold text-sm ${!isMembers ? 'bg-emerald-600 text-white' : 'text-emerald-700'}`;
    if (!isMembers) renderGallery();
}

export function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => t.classList.add('hidden'), 4000);
}

export async function showMembershipCard(member) {
    state.activeCardMember = member;
    const preview = document.getElementById('cardPreviewArea');
    document.getElementById('cardModal').classList.remove('hidden');

    preview.innerHTML = '<p class="text-center text-slate-400 py-8">Generating card...</p>';
    try {
        state.activeCardImageUrl = await generateCardImage(member);
        preview.innerHTML = `<img src="${state.activeCardImageUrl}" class="w-full rounded-xl" alt="Membership Card">`;
    } catch (err) {
        console.error(err);
        preview.innerHTML = '<p class="text-center text-red-500 py-8">Could not generate card. Try again.</p>';
    }
}

export function updateStats() {
    const today = new Date();
    const expiringSoon = state.members.filter(m => {
        const diffDays = Math.ceil((new Date(m.expDate) - today) / (1000 * 60 * 60 * 24));
        return diffDays <= 15 && diffDays > 0;
    }).length;

    document.getElementById('memberCount').innerText = state.members.length;
    document.getElementById('expiringCount').innerText = expiringSoon;
}

export function renderMembers() {
    const container = document.getElementById('memberList');
    container.innerHTML = '';

    state.members.forEach(m => {
        const today = new Date();
        const expDateObj = new Date(m.expDate);
        const diffDays = Math.ceil((expDateObj - today) / (1000 * 60 * 60 * 24));
        const isWarning = diffDays <= 15 && diffDays > 0;
        const mid = m.membershipId || '-';
        const planLabel = getPlanLabel(m.plan);
        const photoSrc = m.profilePic || loadPhotoLocally(m.id) || 'https://via.placeholder.com/200?text=No+Photo';
        container.innerHTML += `
            <div class="bg-white p-4 rounded-[2rem] shadow-sm border ${isWarning ? 'border-red-200 bg-red-50/30' : 'border-emerald-50'} flex items-center gap-4 animate-in">
                <div class="w-16 h-16 rounded-full overflow-hidden border-2 ${isWarning ? 'border-red-500' : 'border-emerald-500'} shadow-sm bg-emerald-100">
                    <img src="${photoSrc}" class="w-full h-full object-cover">
                </div>
                <div class="flex-1">
                    <h3 class="font-bold text-emerald-900 leading-tight">${m.name}</h3>
                    <p class="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">ID: ${mid} · ${planLabel}</p>
                    ${m.admissionFee ? `<p class="text-[10px] text-amber-600 font-bold">Admission: ₹${m.admissionFee}</p>` : ''}
                    <p class="text-xs ${isWarning ? 'text-red-600 font-bold' : 'text-emerald-600'}">Expires: ${formatDisplayDate(m.expDate)}</p>
                    ${isWarning ? '<span class="text-[9px] bg-red-600 text-white px-2 py-0.5 rounded-full uppercase">15 Days Left</span>' : ''}
                </div>
                <div class="flex flex-col gap-2">
                    <button onclick="window.showMembershipCardId(${m.id})" class="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center shadow-sm" title="View Card">
                        <i class="fas fa-id-card"></i>
                    </button>
                    <button onclick="window.sendPassToMember(${m.id})"
                       class="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-md" title="Send Gym Pass on WhatsApp">
                        <i class="fab fa-whatsapp"></i>
                    </button>
                    <button onclick="window.deleteMember(${m.id})" class="w-10 h-10 bg-red-50 text-red-400 rounded-xl">
                        <i class="fas fa-trash-alt text-sm"></i>
                    </button>
                </div>
            </div>
        `;
    });
}

export function renderGallery() {
    const grid = document.getElementById('galleryGrid');
    if (!grid) return;
    grid.innerHTML = '';

    if (!state.members.length) {
        grid.innerHTML = '<p class="col-span-3 text-center text-slate-400 py-10">No members yet. Add your first member!</p>';
        return;
    }

    state.members.forEach(m => {
        const photoSrc = m.profilePic || loadPhotoLocally(m.id) || 'https://via.placeholder.com/200?text=No+Photo';
        grid.innerHTML += `
            <button onclick="window.showMembershipCardId(${m.id})" class="gallery-item group">
                <img src="${photoSrc}" alt="${m.name}" class="w-full h-full object-cover">
                <div class="gallery-overlay">
                    <p class="text-white text-[10px] font-bold truncate px-1">${m.name}</p>
                    <i class="fas fa-id-card text-white text-xs"></i>
                </div>
            </button>
        `;
    });
}
