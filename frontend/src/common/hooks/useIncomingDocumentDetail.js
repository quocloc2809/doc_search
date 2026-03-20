import { useCallback, useEffect, useState } from 'react';
import { documentsApi } from '../api';

export function useIncomingDocumentDetail(id, { autoLoad = true } = {}) {
    const [document, setDocument] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchIncomingDocument = useCallback(async () => {
        setIsLoading(true);
        setError('');

        try {
            const result = await documentsApi.getIncomingDocumentById(id);
            if (result?.success) {
                setDocument(result.data || {});
            } else {
                setDocument({});
                setError(
                    result?.message || 'Không thể tải chi tiết văn bản đến',
                );
            }
        } catch (apiError) {
            setDocument({});
            setError(
                apiError?.response?.data?.message ||
                    'Không thể kết nối máy chủ',
            );
        } finally {
            setIsLoading(false);
        }
    }, [id]);

    useEffect(() => {
        if (autoLoad) {
            fetchIncomingDocument();
        }
    }, [autoLoad, fetchIncomingDocument]);

    return {
        document,
        isLoading,
        error,
        refetch: fetchIncomingDocument,
    };
}
