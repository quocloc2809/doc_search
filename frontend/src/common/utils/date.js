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
