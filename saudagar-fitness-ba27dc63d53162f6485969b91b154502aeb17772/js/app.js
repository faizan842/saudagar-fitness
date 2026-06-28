import { state } from './state.js';
import { ADMISSION_FEE } from './config.js';
import { fetchMembersFromSheet, saveMember, deleteMember } from './api.js';
import { handleLogin, handleLogout, openModal, closeModal, closeCardModal, switchTab, showMembershipCard } from './ui.js';
import { closeWhatsAppInstructionModal, sendWhatsAppWithCard } from './whatsapp.js';
import { getNextMembershipId, calculateExpiry } from './utils.js';

// Expose globals for HTML inline onclick handlers
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
window.switchTab = switchTab;
window.openModal = openModal;
window.closeModal = closeModal;
window.closeCardModal = closeCardModal;
window.closeWhatsAppInstructionModal = closeWhatsAppInstructionModal;

window.showMembershipCardId = (id) => {
    const member = state.members.find(m => m.id === id);
    if (member) showMembershipCard(member);
};

window.sendPassToMember = (id) => {
    const member = state.members.find(m => m.id === id);
    if (member) sendWhatsAppWithCard(member);
};

window.deleteMember = deleteMember;

window.shareCardOnWhatsApp = () => {
    if (state.activeCardMember) sendWhatsAppWithCard(state.activeCardMember);
};

// Initialization
window.onload = () => {
    fetchMembersFromSheet();
};

// Form Handlers
document.getElementById('mPhoto').addEventListener('change', function (e) {
    const file = e.target.files[0];
    const preview = document.getElementById('photoPreview');
    if (file) {
        const reader = new FileReader();
        reader.onload = function (event) {
            preview.innerHTML = `<img src="${event.target.result}" class="w-full h-full object-cover">`;
        };
        reader.readAsDataURL(file);
    }
});

document.getElementById('gymForm').addEventListener('submit', function (e) {
    e.preventDefault();

    const photoElement = document.querySelector('#photoPreview img');
    const photoSrc = photoElement ? photoElement.src : '';

    const memberData = {
        id: Date.now(),
        membershipId: getNextMembershipId(),
        profilePic: photoSrc,
        name: document.getElementById('mName').value,
        phone: document.getElementById('mPhone').value,
        weight: document.getElementById('mWeight').value,
        height: document.getElementById('mHeight').value,
        joinDate: document.getElementById('mDate').value,
        plan: document.querySelector('input[name="plan"]:checked').value,
        admissionFee: document.getElementById('mAdmission').checked ? ADMISSION_FEE : 0,
        expDate: calculateExpiry(document.getElementById('mDate').value, document.querySelector('input[name="plan"]:checked').value)
    };

    saveMember(memberData);
});
