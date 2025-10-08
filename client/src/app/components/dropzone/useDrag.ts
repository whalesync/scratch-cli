import {useEffect, useRef, useState} from 'react';
export const useDrag = () => {
    const [isDragging, setIsDragging] = useState(false);
    const dragCounterRef = useRef(0);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
    useEffect(() => {
      const handleDragEnter = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
  
        dragCounterRef.current += 1;
  
        if (dragCounterRef.current === 1 && e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
          // Clear any existing timeout
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          setIsDragging(true);
        }
      };
  
      const handleDragLeave = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
  
        dragCounterRef.current -= 1;
  
        if (dragCounterRef.current === 0) {
          // Add a small delay to prevent flashing when moving between elements
          timeoutRef.current = setTimeout(() => {
            setIsDragging(false);
          }, 50);
        }
      };
  
      const handleDragOver = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
      };
  
      const handleDragDrop = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        setIsDragging(false);
        dragCounterRef.current = 0;
      };
  
      // Add event listeners to the document
      document.addEventListener('dragenter', handleDragEnter);
      document.addEventListener('dragleave', handleDragLeave);
      document.addEventListener('dragover', handleDragOver);
      document.addEventListener('drop', handleDragDrop);
  
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        document.removeEventListener('dragenter', handleDragEnter);
        document.removeEventListener('dragleave', handleDragLeave);
        document.removeEventListener('dragover', handleDragOver);
        document.removeEventListener('drop', handleDragDrop);
      };
    }, []);
    return { isDragging, setIsDragging };

};