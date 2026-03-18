import httpClient from './httpClient';

export async function getIncomingDocuments(params = {}) {
    const response = await httpClient.get('/api/incoming-documents', {
        params,
    });
    return response.data;
}

export async function getIncomingDocumentById(documentId) {
    const response = await httpClient.get(
        `/api/incoming-documents/${documentId}`,
    );
    return response.data;
}

export async function updateIncomingDocument(documentId, payload) {
    const response = await httpClient.put(
        `/api/incoming-documents/${documentId}`,
        payload,
    );
    return response.data;
}

export async function getOutgoingDocuments() {
    const response = await httpClient.get('/api/outgoing-documents');
    return response.data;
}

export async function getOutgoingDocumentById(documentId) {
    const response = await httpClient.get(
        `/api/outgoing-documents/${documentId}`,
    );
    return response.data;
}

export async function searchOutgoingDocuments(query) {
    const response = await httpClient.get('/api/outgoing-documents/search', {
        params: { q: query },
    });
    return response.data;
}
