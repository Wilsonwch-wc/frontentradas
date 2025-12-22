import React from 'react';

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 2000,
  padding: '12px'
};

const containerStyle = {
  background: '#fff',
  borderRadius: '12px',
  padding: '12px',
  width: '100%',
  maxWidth: '1500px',
  maxHeight: '92vh',
  overflow: 'hidden',
  boxShadow: '0 10px 40px rgba(0,0,0,0.35)',
  boxSizing: 'border-box'
};

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '12px'
};

const Modal = ({ isOpen, onClose, title, children, tools, closeOnOverlayClick = true }) => {
  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && closeOnOverlayClick) {
      onClose?.();
    }
  };

  const contentLayoutStyle = {
    display: 'grid',
    gridTemplateColumns: tools ? '250px minmax(0, 1fr)' : '1fr',
    gap: '8px',
    alignItems: 'stretch'
  };

  return (
    <div style={overlayStyle} onClick={handleOverlayClick}>
      <div style={containerStyle}>
        <div style={headerStyle}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              padding: '8px 10px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              cursor: 'pointer',
              background: '#f9fafb'
            }}
          >
            Cerrar
          </button>
        </div>
        <div style={contentLayoutStyle}>
          {tools && (
            <div className="modal-tools" style={{
              overflowY: 'hidden',
              borderRight: '1px solid #e5e7eb',
              paddingRight: '8px',
              paddingLeft: '4px'
            }}>
              {tools}
            </div>
          )}
          <div style={{ overflow: 'auto' }}>{children}</div>
        </div>
      </div>
    </div>
  );
};

export default Modal;

