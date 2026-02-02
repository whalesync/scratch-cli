package merge

// MergeFolder performs three-way merge for an entire folder.
//
// Parameters:
// - localFiles: Files from the CLI (user's local state)
// - dirtyFiles: Files from the dirty branch (server state)
//
// Returns merged result with files, deletions, and conflicts.
func MergeFolder(localFiles []LocalFile, dirtyFiles []DirtyFile) *FolderMergeResult {
	result := &FolderMergeResult{
		Files:        []SyncedFile{},
		DeletedFiles: []DeletedFileInfo{},
		Conflicts:    []ConflictInfo{},
	}

	// Build maps for easy lookup
	localMap := make(map[string]*LocalFile)
	for i := range localFiles {
		localMap[localFiles[i].Name] = &localFiles[i]
	}

	dirtyMap := make(map[string]*DirtyFile)
	for i := range dirtyFiles {
		dirtyMap[dirtyFiles[i].Name] = &dirtyFiles[i]
	}

	// Collect all file names
	allFileNames := make(map[string]bool)
	for name := range localMap {
		allFileNames[name] = true
	}
	for name := range dirtyMap {
		allFileNames[name] = true
	}

	// Process each file
	for fileName := range allFileNames {
		local := localMap[fileName]
		dirty := dirtyMap[fileName]

		fileResult := mergeFile(fileName, local, dirty)

		if fileResult.Deleted && fileResult.DeletedInfo != nil {
			result.DeletedFiles = append(result.DeletedFiles, *fileResult.DeletedInfo)
		} else if fileResult.Content != nil {
			result.Files = append(result.Files, SyncedFile{
				Name:    fileName,
				Content: *fileResult.Content,
				Hash:    Hash(*fileResult.Content),
			})
		}

		if len(fileResult.Conflicts) > 0 {
			result.Conflicts = append(result.Conflicts, fileResult.Conflicts...)
		}
	}

	return result
}

// mergeFile performs three-way merge for a single file.
//
// Cases:
// 1. File only on server -> include it
// 2. File only locally (new file) -> include it
// 3. File deleted locally -> delete it
// 4. File deleted on server -> delete it (warn if local had changes)
// 5. Both have file -> three-way merge
func mergeFile(fileName string, local *LocalFile, dirty *DirtyFile) *FileMergeResult {
	// Case 1: File only exists on server
	if local == nil && dirty != nil {
		content := dirty.Content
		return &FileMergeResult{
			Content:   &content,
			Deleted:   false,
			Conflicts: []ConflictInfo{},
		}
	}

	// Case 2: File only exists locally
	if local != nil && dirty == nil {
		if local.OriginalHash == "" {
			// New local file - include it
			content := local.Content
			return &FileMergeResult{
				Content:   &content,
				Deleted:   false,
				Conflicts: []ConflictInfo{},
			}
		}
		// File was deleted on server
		localHash := Hash(local.Content)
		hadLocalChanges := localHash != local.OriginalHash

		return &FileMergeResult{
			Content: nil,
			Deleted: true,
			DeletedInfo: &DeletedFileInfo{
				Name:            fileName,
				DeletedBy:       "server",
				HadLocalChanges: hadLocalChanges,
			},
			Conflicts: []ConflictInfo{},
		}
	}

	// Case 3: File deleted locally
	if local != nil && local.Deleted {
		return &FileMergeResult{
			Content: nil,
			Deleted: true,
			DeletedInfo: &DeletedFileInfo{
				Name:            fileName,
				DeletedBy:       "local",
				HadLocalChanges: false,
			},
			Conflicts: []ConflictInfo{},
		}
	}

	// Case 4: File exists on both sides - need to merge
	if local == nil || dirty == nil {
		// Shouldn't happen, but handle gracefully
		return &FileMergeResult{
			Content:   nil,
			Deleted:   true,
			Conflicts: []ConflictInfo{},
		}
	}

	localContent := local.Content
	dirtyContent := dirty.Content
	baseHash := local.OriginalHash
	localHash := Hash(localContent)
	dirtyHash := Hash(dirtyContent)

	// If local unchanged since last sync, take server version
	if localHash == baseHash {
		return &FileMergeResult{
			Content:   &dirtyContent,
			Deleted:   false,
			Conflicts: []ConflictInfo{},
		}
	}

	// If server unchanged since last sync, take local version
	if dirtyHash == baseHash {
		return &FileMergeResult{
			Content:   &localContent,
			Deleted:   false,
			Conflicts: []ConflictInfo{},
		}
	}

	// If both have same content, no conflict
	if localHash == dirtyHash {
		return &FileMergeResult{
			Content:   &localContent,
			Deleted:   false,
			Conflicts: []ConflictInfo{},
		}
	}

	// Both changed differently - need three-way merge
	// For JSON files, do field-level merge
	// For other files, local wins entirely
	if isJSON(fileName) {
		result, err := mergeJSONContent(fileName, local.OriginalContent, localContent, dirtyContent)
		if err == nil {
			return result
		}
		// If JSON parsing fails, treat as text and local wins
		return &FileMergeResult{
			Content: &localContent,
			Deleted: false,
			Conflicts: []ConflictInfo{
				{
					File:        fileName,
					Resolution:  "local_wins",
					LocalValue:  truncate(localContent, 50),
					ServerValue: truncate(dirtyContent, 50),
				},
			},
		}
	}

	// Non-JSON: local wins entirely
	return &FileMergeResult{
		Content: &localContent,
		Deleted: false,
		Conflicts: []ConflictInfo{
			{
				File:        fileName,
				Resolution:  "local_wins",
				LocalValue:  truncate(localContent, 50),
				ServerValue: truncate(dirtyContent, 50),
			},
		},
	}
}
