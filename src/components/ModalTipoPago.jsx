import './ModalTipoPago.css';

const ModalTipoPago = ({ isOpen, onClose, onSelect, title = 'Tipo de pago', disabled = false }) => {
  if (!isOpen) return null;

  const handleSelect = (tipo) => {
    if (disabled) return;
    onSelect(tipo);
    onClose();
  };

  return (
    <div className="modal-tipo-pago-overlay" onClick={onClose}>
      <div className="modal-tipo-pago-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-tipo-pago-content">
          <h3 className="modal-tipo-pago-title">{title}</h3>
          <p className="modal-tipo-pago-message">¿Cómo pagó el cliente?</p>
          <div className="modal-tipo-pago-buttons">
            <button
              type="button"
              className="modal-tipo-pago-btn btn-qr"
              onClick={() => handleSelect('QR')}
              disabled={disabled}
            >
              <span className="btn-icon">📱</span>
              <span className="btn-label">QR</span>
              <span className="btn-desc">Pago digital</span>
            </button>
            <button
              type="button"
              className="modal-tipo-pago-btn btn-efectivo"
              onClick={() => handleSelect('EFECTIVO')}
              disabled={disabled}
            >
              <span className="btn-icon">💵</span>
              <span className="btn-label">Efectivo</span>
              <span className="btn-desc">Pago en efectivo</span>
            </button>
          </div>
          <button
            type="button"
            className="modal-tipo-pago-cancel"
            onClick={onClose}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalTipoPago;
