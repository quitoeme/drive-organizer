export const DRIVE_SCOPES = 'https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/drive.file';

export async function listFiles(folderId: string, accessToken: string) {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=files(id,name,mimeType,thumbnailLink,size,createdTime)&access_token=${accessToken}`
  );
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.files;
}

export async function renameAndMoveFile(fileId: string, newName: string, targetFolderId: string, accessToken: string, currentFolderId: string) {
  // Rename
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?access_token=${accessToken}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: newName })
  });

  // Move (if different folder)
  if (targetFolderId !== currentFolderId) {
    await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${targetFolderId}&removeParents=${currentFolderId}&access_token=${accessToken}`,
      { method: 'PATCH' }
    );
  }
}

export async function createFolderIfNotExist(name: string, parentId: string, accessToken: string) {
  // Check if exist
  const searchResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${name}'+and+'${parentId}'+in+parents+and+mimeType='application/vnd.google-apps.folder'+and+trashed=false&fields=files(id)&access_token=${accessToken}`
  );
  const searchData = await searchResponse.json();
  
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create
  const createResponse = await fetch(`https://www.googleapis.com/drive/v3/files?access_token=${accessToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId]
    })
  });
  const createData = await createResponse.json();
  return createData.id;
}
