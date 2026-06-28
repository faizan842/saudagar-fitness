import { state } from './state.js';
import { showToast, closeCardModal } from './ui.js';
import { generateCardImage } from './card.js';
import { loadImage, formatDisplayDate, normalizePhone } from './utils.js';

export function getWhatsAppMessage(member) {
    const start = formatDisplayDate(member.joinDate);
    const end = formatDisplayDate(member.expDate);
    return `Hi ${member.name} ! 🙌 Your gym pass is here! 🎉 You can use it to access Saudagar Fitness Club from ${start} to ${end}`;
}

export function openWhatsAppToNumber(phone, message) {
    const p = normalizePhone(phone);
    const url = `https://wa.me/${p}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
}

export function openWhatsAppInstructionModal(member) {
    const modal = document.getElementById('whatsappInstructionModal');
    const directBtn = document.getElementById('whatsappDirectLink');
    
    directBtn.onclick = () => {
        openWhatsAppToNumber(member.phone, getWhatsAppMessage(member));
        closeWhatsAppInstructionModal();
        closeCardModal();
    };

    modal.classList.remove('hidden');
}

export function closeWhatsAppInstructionModal() {
    document.getElementById('whatsappInstructionModal').classList.add('hidden');
}

export async function imageToPngBlob(dataUrl) {
    const img = await loadImage(dataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext('2d').drawImage(img, 0, 0);
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

export async function sendWhatsAppWithCard(member) {
    state.activeCardMember = member;
    showToast('Preparing gym pass card...');

    try {
        state.activeCardImageUrl = await generateCardImage(member);

        const pngBlob = await imageToPngBlob(state.activeCardImageUrl);
        await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': pngBlob })
        ]);

        showToast('✅ Card copied! Opening steps...');
        openWhatsAppInstructionModal(member);
    } catch (err) {
        console.error('Clipboard copy failed:', err);
        showToast('⚠️ Could not copy card. Opening WhatsApp steps...');
        openWhatsAppInstructionModal(member);
    }
}
