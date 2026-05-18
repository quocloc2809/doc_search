export function formatDateTime(value) {
    if (!value) {
        return '-';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '-';
    }

    return date.toLocaleString('vi-VN');
}

export const formatDate = date => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('vi-VN');
};

function normalizeFilePart(value, fallback = '') {
    const normalized = String(value || '')
        .trim()
        .replace(/[\\/]+/g, '.')
        .replace(/[<>:"|?*]/g, '_')
        .replace(/\s*\.\s*/g, '.')
        .replace(/\s+/g, '_')
        .replace(/_?\._?/g, '.')
        .replace(/\.+/g, '.')
        .replace(/_+/g, '_')
        .replace(/^[_.]+|[_.]+$/g, '');

    return normalized || fallback;
}

export function buildDocumentDownloadTitle(documentNo, dateValue) {
    const noPart = normalizeFilePart(documentNo, 'van_ban');

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
        return noPart;
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear());

    return `${noPart}_${day}_${month}_${year}`;
}
