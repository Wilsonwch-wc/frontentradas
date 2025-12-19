import { createContext, useState, useContext, useCallback } from 'react';
import AlertModal from '../components/AlertModal';

const AlertContext = createContext();

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert debe usarse dentro de AlertProvider');
  }
  return context;
};

export const AlertProvider = ({ children }) => {
  const [alertState, setAlertState] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
    showCancel: false,
    confirmText: 'Aceptar',
    cancelText: 'Cancelar',
    onConfirm: null
  });

  const showAlert = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      setAlertState({
        isOpen: true,
        title: options.title || '',
        message,
        type: options.type || 'info',
        showCancel: false,
        confirmText: options.confirmText || 'Aceptar',
        cancelText: options.cancelText || 'Cancelar',
        onConfirm: () => resolve(true)
      });
    });
  }, []);

  const showConfirm = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      setAlertState({
        isOpen: true,
        title: options.title || 'Confirmar',
        message,
        type: options.type || 'warning',
        showCancel: true,
        confirmText: options.confirmText || 'Aceptar',
        cancelText: options.cancelText || 'Cancelar',
        onConfirm: () => resolve(true)
      });
    });
  }, []);

  const closeAlert = useCallback(() => {
    setAlertState((prev) => ({
      ...prev,
      isOpen: false,
      onConfirm: null
    }));
  }, []);

  const handleConfirm = useCallback(() => {
    if (alertState.onConfirm) {
      alertState.onConfirm();
    }
    closeAlert();
  }, [alertState.onConfirm, closeAlert]);

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      <AlertModal
        isOpen={alertState.isOpen}
        onClose={closeAlert}
        onConfirm={handleConfirm}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
        showCancel={alertState.showCancel}
        confirmText={alertState.confirmText}
        cancelText={alertState.cancelText}
      />
    </AlertContext.Provider>
  );
};

