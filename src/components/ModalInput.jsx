import { useState, useEffect } from 'react';
import './ModalInput.css';

const ModalInput = ({ isOpen, onClose, onConfirm, title, message, placeholder, initialValue = '' }) => {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
      // Focus en el input cuando se abre el modal
      setTimeout(() => {
        const input = document.querySelector('.modal-input-field');
        if (input) input.focus();
      }, 100);
    }
  }, [isOpen, initialValue]);

  const handleConfirm = () => {
    if (value && value.trim()) {
      onConfirm(value.trim());
      setValue('');
      onClose();
    }
  };

  const handleCancel = () => {
    setValue('');
    onClose();
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-input-overlay" onClick={handleCancel}>
      <div className="modal-input-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-input-content">
          {title && <h3 className="modal-input-title">{title}</h3>}
          {message && <p className="modal-input-message">{message}</p>}
          <input
            type="text"
            className="modal-input-field"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={placeholder}
            autoFocus
          />
          <div className="modal-input-actions">
            <button
              type="button"
              className="modal-input-btn modal-input-btn-cancel"
              onClick={handleCancel}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="modal-input-btn modal-input-btn-confirm"
              onClick={handleConfirm}
              disabled={!value || !value.trim()}
            >
              Aceptar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalInput;

