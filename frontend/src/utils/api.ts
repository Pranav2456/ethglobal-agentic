export const callApi = async (endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any) => {
    try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${process.env.NEXT_PUBLIC_API_AUTH}`
            },
            ...(body && { body: JSON.stringify(body) })
        });

        if (!response.ok) {
            throw new Error('API request failed');
        }

        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}; 