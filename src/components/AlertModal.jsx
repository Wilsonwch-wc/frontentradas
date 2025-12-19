import { useEffect } from 'react';
import './AlertModal.css';

const AlertModal = ({ isOpen, onClose, onConfirm, title, message, type = 'info', showCancel = false, confirmText = 'Aceptar', cancelText = 'Cancelar' }) => {
  useEffect(() => {
    if (isOpen) {
      // Prevenir scroll del body cuando el modal está abierto
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
    }

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
      default:
        return 'ℹ️';
    }
  };

  return (
    <div className="alert-modal-overlay" onClick={handleCancel}>
      <div className="alert-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className={`alert-modal-content alert-modal-${type}`}>
          <div className="alert-modal-icon">{getIcon()}</div>
          {title && <h3 className="alert-modal-title">{title}</h3>}
          <div className="alert-modal-message">
            {typeof message === 'string' ? (
              message.split('\n').map((line, idx) => (
                <p key={idx}>{line}</p>
              ))
            ) : (
              message
            )}
          </div>
          <div className="alert-modal-actions">
            {showCancel && (
              <button
                className="alert-modal-btn alert-modal-btn-cancel"
                onClick={handleCancel}
              >
                {cancelText}
              </button>
            )}
            <button
              className={`alert-modal-btn alert-modal-btn-confirm alert-modal-btn-${type}`}
              onClick={handleConfirm}
              autoFocus
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlertModal;

