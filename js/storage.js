export function savePhotoLocally(id, dataUrl) {
    try {
        localStorage.setItem(`gym_photo_${id}`, dataUrl);
    } catch (e) {
        console.warn('Photo save failed (storage full?):', e);
    }
}

export function loadPhotoLocally(id) {
    return localStorage.getItem(`gym_photo_${id}`) || '';
}

export function deletePhotoLocally(id) {
    localStorage.removeItem(`gym_photo_${id}`);
}
