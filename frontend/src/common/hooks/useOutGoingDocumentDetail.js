import { useCallback, useEffect, useState } from 'react';
import { documentsApi } from '../api';

export function useOutgoingDocumentDetail(id, params = {}, { autoLoad = true } = {}) {
    const [document, setDocument] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchOutgoingDocument = useCallback(async () => {
        setIsLoading(true);
        setError('');

        try {
            const result = await documentsApi.getOutgoingDocumentByIdWithParams(id, params);
            if (result?.success) {
                setDocument(result.data || {});
            } else {
                setDocument({});
                setError(
                    result?.message || 'Không thể tải chi tiết văn bản đi',
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
    }, [id, params]);

    useEffect(() => {
        if (autoLoad) {
            fetchOutgoingDocument();
        }
    }, [autoLoad, fetchOutgoingDocument]);

    return {
        document,
        isLoading,
        error,
        refetch: fetchOutgoingDocument,
    };
}
