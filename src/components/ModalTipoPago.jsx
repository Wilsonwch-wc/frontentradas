import { useState } from 'react';
import './ModalTipoPago.css';

const ModalTipoPago = ({ isOpen, onClose, onSelect, title = 'Tipo de pago', disabled = false, compraTotal = 0 }) => {
  const [esRegalo, setEsRegalo] = useState(false);
  const [esOferta, setEsOferta] = useState(false);
  const [precioOriginal, setPrecioOriginal] = useState('');

  if (!isOpen) return null;

  const handleSelect = (tipo) => {
    if (disabled) return;
    const payload = { tipoPago: tipo };
    if (esRegalo) {
      payload.tipo_venta = 'REGALO_ADMIN';
    } else if (esOferta && precioOriginal && !isNaN(parseFloat(precioOriginal))) {
      payload.tipo_venta = 'OFERTA_ADMIN';
      payload.precio_original = parseFloat(precioOriginal);
    }
    onSelect(payload);
    onClose();
    setEsRegalo(false);
    setEsOferta(false);
    setPrecioOriginal('');
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
          <div className="modal-tipo-pago-extra">
            <label>
              <input
                type="checkbox"
                checked={esRegalo}
                onChange={(e) => {
                  setEsRegalo(e.target.checked);
                  if (e.target.checked) setEsOferta(false);
                }}
              />
              <span> Entrada gratis (regalo del administrador)</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={esOferta}
                onChange={(e) => {
                  setEsOferta(e.target.checked);
                  if (e.target.checked) setEsRegalo(false);
                }}
              />
              <span> Precio especial (oferta)</span>
            </label>
            {esOferta && (
              <div style={{ marginTop: '6px', marginLeft: '24px' }}>
                <span>Precio original Bs. </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={compraTotal}
                  value={precioOriginal}
                  onChange={(e) => setPrecioOriginal(e.target.value)}
                  style={{ width: '80px', padding: '4px', marginLeft: '4px' }}
                />
              </div>
            )}
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
