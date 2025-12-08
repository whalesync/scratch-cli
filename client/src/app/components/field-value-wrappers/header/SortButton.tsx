import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { ArrowDownUp } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

interface SortButtonProps {
  isHovered: boolean;
  currentSort: 'asc' | 'desc' | null;
  setSort: (sort: 'asc' | 'desc' | null) => void;
}

export const SortButton: React.FC<SortButtonProps> = ({ isHovered, currentSort, setSort }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        buttonRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering header sort
    if (!isMenuOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 2,
        right: window.innerWidth - rect.right,
      });
    }
    setIsMenuOpen(!isMenuOpen);
  };

  const handleSortAsc = () => {
    setSort('asc');
    setIsMenuOpen(false);
  };

  const handleSortDesc = () => {
    setSort('desc');
    setIsMenuOpen(false);
  };

  const handleClearSort = () => {
    setSort(null);
    setIsMenuOpen(false);
  };

  if (!(isHovered || isMenuOpen || currentSort)) {
    return null;
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={buttonRef}
        onClick={handleButtonClick}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '2px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '2px',
          opacity: currentSort ? 1 : 0.7,
          transition: 'opacity 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '1';
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = currentSort ? '1' : '0.7';
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
        title="Sort column"
      >
        <StyledLucideIcon Icon={ArrowDownUp} size={14} />
      </button>

      {/* Dropdown menu */}
      {isMenuOpen && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: menuPosition.top,
            right: menuPosition.right,
            backgroundColor: '#2d2d2d',
            border: '0.5px solid #444',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
            zIndex: 10000,
            minWidth: '150px',
            padding: '4px 0',
          }}
        >
          <button
            onClick={handleSortAsc}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: currentSort === 'asc' ? 'rgba(255, 255, 255, 0.1)' : 'none',
              border: 'none',
              color: '#ffffff',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor =
                currentSort === 'asc' ? 'rgba(255, 255, 255, 0.1)' : 'transparent';
            }}
          >
            Sort Ascending ↑
          </button>
          <button
            onClick={handleSortDesc}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: currentSort === 'desc' ? 'rgba(255, 255, 255, 0.1)' : 'none',
              border: 'none',
              color: '#ffffff',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor =
                currentSort === 'desc' ? 'rgba(255, 255, 255, 0.1)' : 'transparent';
            }}
          >
            Sort Descending ↓
          </button>
          {currentSort && (
            <>
              <div style={{ height: '1px', backgroundColor: '#444', margin: '4px 0' }} />
              <button
                onClick={handleClearSort}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'none',
                  border: 'none',
                  color: '#ffffff',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                Clear Sort
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
