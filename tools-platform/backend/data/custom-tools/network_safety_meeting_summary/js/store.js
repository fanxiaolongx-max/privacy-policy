// js/store.js
export const STORAGE_KEY = 'networkSafetyDeckHtml.v5';
export const ACTIVE_KEY = 'networkSafetyDeckActiveSlide.v5';
export const THUMB_ZOOM_KEY = 'networkSafetyDeckThumbZoom.v5';

export function saveState(htmlContent) {
    localStorage.setItem(STORAGE_KEY, htmlContent);
}

export function loadState() {
    return localStorage.getItem(STORAGE_KEY);
}

export function saveActiveSlideIndex(index) {
    localStorage.setItem(ACTIVE_KEY, String(index));
}

export function getActiveSlideIndex() {
    return Number(localStorage.getItem(ACTIVE_KEY) || 0);
}

export function saveThumbZoom(value) {
    localStorage.setItem(THUMB_ZOOM_KEY, String(value));
}

export function getThumbZoom() {
    return localStorage.getItem(THUMB_ZOOM_KEY) || '34';
}

export function clearState() {
    localStorage.removeItem(STORAGE_KEY);
}
