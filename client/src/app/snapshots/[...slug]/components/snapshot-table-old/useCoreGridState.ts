import {GridSelection} from '@glideapps/glide-data-grid';
import {useState} from 'react';
export const useCoreGridState = () => {
    const [hoveredRow, setHoveredRow] = useState<number | undefined>();
    const [currentSelection, setCurrentSelection] = useState<GridSelection | undefined>();
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});

    return {
        hoveredRow,
        setHoveredRow,
        currentSelection,
        setCurrentSelection,
        columnWidths,
        setColumnWidths,
    };
};