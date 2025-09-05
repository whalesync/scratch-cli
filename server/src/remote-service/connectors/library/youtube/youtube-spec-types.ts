/* eslint-disable @typescript-eslint/no-empty-object-type */

// YouTube-specific extensions to base table and column specs

export interface YouTubeTableSpecExtras {}

export interface YouTubeColumnSpecExtras {
  // YouTube field mapping (e.g., 'snippet.title', 'statistics.viewCount')
  youtubeField?: string;
}
