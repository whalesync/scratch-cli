import { DotsThreeVertical } from '@phosphor-icons/react';
import { IHeaderParams } from 'ag-grid-community';
import React, { useEffect, useRef, useState } from 'react';

// interface CustomHeaderComponentProps extends IHeaderParams {
//   Add any custom props here
// }

export const CustomHeaderComponent: React.FC<IHeaderParams> = (props) => {
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

  const handleMenuClick = () => {
    if (!isMenuOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 2,
        right: window.innerWidth - rect.right,
      });
    }
    setIsMenuOpen(!isMenuOpen);
  };

  const handleTestClick = () => {
    console.debug('Test menu item clicked for column:', props.displayName);
    setIsMenuOpen(false);
  };

  const onSortChanged = () => {
    props.setSort('asc');
  };

  const onSortRemoved = () => {
    props.setSort(null);
  };

  const handleHeaderClick = () => {
    // Toggle sort when clicking on header text
    const currentSort = props.column.getSort();
    if (currentSort === 'asc') {
      props.setSort('desc');
    } else if (currentSort === 'desc') {
      props.setSort(null);
    } else {
      props.setSort('asc');
    }
  };

  return (
    <div
      className="ag-header-cell-comp-wrapper"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', height: '100%' }}
    >
      {/* Header label - clickable for sorting */}
      <div
        className="ag-header-cell-label"
        style={{
          display: 'flex',
          alignItems: 'center',
          flex: 1,
          cursor: props.enableSorting ? 'pointer' : 'default',
          padding: '0 4px',
        }}
        onClick={props.enableSorting ? handleHeaderClick : undefined}
      >
        <span className="ag-header-cell-text">{props.displayName}</span>
        {props.enableSorting && (
          <span className="ag-header-icon ag-sort-icon" style={{ marginLeft: '4px' }}>
            {props.column.getSort() === 'asc' && '↑'}
            {props.column.getSort() === 'desc' && '↓'}
          </span>
        )}
      </div>

      {/* Menu button */}
      <div style={{ position: 'relative' }}>
        <button
          ref={buttonRef}
          onClick={handleMenuClick}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '2px',
            opacity: 0.7,
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '1';
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '0.7';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
          title="Column menu"
        >
          <DotsThreeVertical size={14} color="#ffffff" />
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
              border: '1px solid #444',
              borderRadius: '4px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
              zIndex: 10000,
              minWidth: '150px',
              padding: '4px 0',
            }}
          >
            {/* Sort options */}
            {props.enableSorting && (
              <>
                <button
                  onClick={onSortChanged}
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
                  Sort Ascending
                </button>
                <button
                  onClick={onSortRemoved}
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
                <div style={{ height: '1px', backgroundColor: '#444', margin: '4px 0' }} />
              </>
            )}

            {/* Test menu item */}
            <button
              onClick={handleTestClick}
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
              Test
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
