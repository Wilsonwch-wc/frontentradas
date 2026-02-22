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
  padding: '0',
  width: '100%',
  maxWidth: '520px',
  maxHeight: '92vh',
  overflow: 'hidden',
  boxShadow: '0 10px 40px rgba(0,0,0,0.35)',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column'
};

const containerStyleWide = {
  ...containerStyle,
  maxWidth: 'min(90vw, 900px)',
  width: 'min(90vw, 900px)',
  minHeight: 'min(70vh, 500px)',
  maxHeight: '90vh'
};

const containerStyleLarge = {
  ...containerStyle,
  maxWidth: '98vw',
  maxHeight: '96vh',
  width: '98vw',
  height: '96vh',
  display: 'flex',
  flexDirection: 'column'
};

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '16px 20px',
  borderBottom: '1px solid #e5e7eb',
  flexShrink: 0,
  background: '#fafafa'
};

const Modal = ({ isOpen, onClose, title, children, tools, closeOnOverlayClick = true, large = false, wide = false }) => {
  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && closeOnOverlayClick) {
      onClose?.();
    }
  };

  const getContainerStyle = () => {
    if (large) return containerStyleLarge;
    if (wide) return containerStyleWide;
    return containerStyle;
  };

  const contentLayoutStyle = {
    display: 'grid',
    gridTemplateColumns: tools ? '250px minmax(0, 1fr)' : '1fr',
    gap: '8px',
    alignItems: 'stretch',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    ...(large && { minHeight: 'calc(96vh - 80px)' })
  };

  return (
    <div style={overlayStyle} onClick={handleOverlayClick}>
      <div style={getContainerStyle()}>
        <div style={headerStyle}>
          <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              cursor: 'pointer',
              background: '#fff',
              fontWeight: 500
            }}
          >
            Cerrar
          </button>
        </div>
        <div style={contentLayoutStyle}>
          {tools && (
            <div className="modal-tools" style={{
              overflowY: 'auto',
              borderRight: '1px solid #e5e7eb',
              paddingRight: '8px',
              paddingLeft: '4px'
            }}>
              {tools}
            </div>
          )}
          <div className="modal-body" style={{ overflowY: 'auto', minHeight: 0, flex: 1 }}>{children}</div>
        </div>
      </div>
    </div>
  );
};

export default Modal;

