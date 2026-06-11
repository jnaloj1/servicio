} else {
    const errorData = await response.json().catch(() => ({}));
    updateSyncUI('offline', errorData.error || 'Error servidor');
}