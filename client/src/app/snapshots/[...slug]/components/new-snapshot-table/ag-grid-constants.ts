
/**
 * TODO: move these to a CSS module
 */

const suggestionGreen = `rgba(44, 233, 213, 1)`
const suggestionBlue = `rgba(5, 81, 207, 1)`
export const AG = {
  colors: {
    light: {
      innerBorder: suggestionBlue,
      
      // Text colors
      readOnlyText: '#6b7280',
       // Text colors
      normalText: '#ffffff',
      
      // Background colors
      rowBackground: '#000000',
      
      // Diff colors
      diffAdded: suggestionBlue,
      diffRemoved: 'rgba(165, 161, 175, 1)',
      
      // Diff background colors (very transparent)
      diffAddedBg: 'rgba(44, 233, 213, 0.1)',
      diffRemovedBg: 'rgba(165, 161, 175, 0.1)',
      
    },
    dark: {
      innerBorder: suggestionGreen,
      
      // Text colors
      readOnlyText: '#6b7280',
       // Text colors
      normalText: '#ffffff',
      
      // Background colors
      rowBackground: '#000000',
      
      // Diff colors
      diffAdded: suggestionGreen,
      diffRemoved: 'rgba(165, 161, 175, 1)',
      
      // Diff background colors (very transparent)
      diffAddedBg: 'rgba(44, 233, 213, 0.1)',
      diffRemovedBg: 'rgba(165, 161, 175, 0.1)',
    },
  },
  
  // Border dimensions
  borders: {
    outerBorderWidth: '1px',
    outerBorderHeight: '90%',
    innerBorderWidth: '1px',
    innerBorderHeight: '18px',
    paddingLeft: '8px',
  },
  
  // Selection corner borders
  selection: {
    cornerSize: '8px',
    cornerWidth: '2px',
  },
  
  // Grid configuration
  grid: {
    defaultMinWidth: 200,
    defaultFlex: 1,
  },
} as const;
